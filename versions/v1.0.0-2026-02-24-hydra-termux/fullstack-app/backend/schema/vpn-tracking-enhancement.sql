-- ============================================================================
-- VPN VERIFICATION AND IP ROUTING ENHANCEMENT SCHEMA
-- Version: 2.0.1
-- Date: 2026-01-09
-- Purpose: Add VPN verification and IP rotation tracking capabilities
-- ============================================================================

-- Add VPN and IP fields to attacks table
ALTER TABLE attacks ADD COLUMN IF NOT EXISTS vpn_info JSONB;
ALTER TABLE attacks ADD COLUMN IF NOT EXISTS source_ip VARCHAR(45);

-- Add comment to explain the new fields
COMMENT ON COLUMN attacks.vpn_info IS 'VPN detection information including provider, interface, and detection methods';
COMMENT ON COLUMN attacks.source_ip IS 'Source IP address from which the attack was initiated';

-- Create index on source_ip for tracking
CREATE INDEX IF NOT EXISTS idx_attacks_source_ip ON attacks(source_ip);

-- ============================================================================
-- IP ROTATION LOG TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS ip_rotation_log (
    id SERIAL PRIMARY KEY,
    attack_id INTEGER REFERENCES attacks(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    ip_address VARCHAR(45) NOT NULL,
    total_ips_tracked INTEGER DEFAULT 0,
    unique_ips_last_hour INTEGER DEFAULT 0,
    vpn_detected BOOLEAN DEFAULT FALSE,
    vpn_provider VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ip_rotation_log_attack_id ON ip_rotation_log(attack_id);
CREATE INDEX IF NOT EXISTS idx_ip_rotation_log_user_id ON ip_rotation_log(user_id);
CREATE INDEX IF NOT EXISTS idx_ip_rotation_log_ip_address ON ip_rotation_log(ip_address);
CREATE INDEX IF NOT EXISTS idx_ip_rotation_log_created_at ON ip_rotation_log(created_at);

COMMENT ON TABLE ip_rotation_log IS 'Tracks IP rotation patterns for users routing through multiple VPN endpoints';

-- ============================================================================
-- VPN STATUS LOG TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS vpn_status_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    ip_address VARCHAR(45) NOT NULL,
    vpn_detected BOOLEAN NOT NULL,
    detection_methods JSONB NOT NULL, -- {interface: bool, process: bool, dns: bool, publicIP: bool}
    confidence_score INTEGER, -- 0-100
    vpn_provider VARCHAR(255),
    vpn_interface VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vpn_status_log_user_id ON vpn_status_log(user_id);
CREATE INDEX IF NOT EXISTS idx_vpn_status_log_ip_address ON vpn_status_log(ip_address);
CREATE INDEX IF NOT EXISTS idx_vpn_status_log_vpn_detected ON vpn_status_log(vpn_detected);
CREATE INDEX IF NOT EXISTS idx_vpn_status_log_created_at ON vpn_status_log(created_at);

COMMENT ON TABLE vpn_status_log IS 'Audit log of VPN connection status checks';

-- ============================================================================
-- USER SETTINGS FOR VPN
-- ============================================================================

-- Add VPN preference fields to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS vpn_required BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS min_ip_rotation INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS track_ip_rotation BOOLEAN DEFAULT TRUE;

COMMENT ON COLUMN users.vpn_required IS 'Whether VPN is required for this user to launch attacks';
COMMENT ON COLUMN users.min_ip_rotation IS 'Minimum number of different IPs required in last hour (0 = no requirement)';
COMMENT ON COLUMN users.track_ip_rotation IS 'Whether to track and log IP rotation for this user';

-- ============================================================================
-- VIEWS FOR VPN ANALYTICS
-- ============================================================================

-- View: User VPN compliance
CREATE OR REPLACE VIEW user_vpn_compliance AS
SELECT 
    u.id as user_id,
    u.username,
    u.vpn_required,
    COUNT(DISTINCT irl.ip_address) as unique_ips_used,
    AVG(irl.unique_ips_last_hour) as avg_ip_rotation_rate,
    COUNT(CASE WHEN irl.vpn_detected = TRUE THEN 1 END)::FLOAT / 
        NULLIF(COUNT(*), 0) * 100 as vpn_compliance_percentage,
    MAX(irl.created_at) as last_activity
FROM users u
LEFT JOIN ip_rotation_log irl ON u.id = irl.user_id
GROUP BY u.id, u.username, u.vpn_required;

COMMENT ON VIEW user_vpn_compliance IS 'Shows VPN compliance metrics per user';

-- View: Recent VPN status by user
CREATE OR REPLACE VIEW recent_vpn_status AS
SELECT 
    vsl.user_id,
    u.username,
    vsl.ip_address,
    vsl.vpn_detected,
    vsl.confidence_score,
    vsl.vpn_provider,
    vsl.created_at,
    ROW_NUMBER() OVER (PARTITION BY vsl.user_id ORDER BY vsl.created_at DESC) as recency_rank
FROM vpn_status_log vsl
JOIN users u ON vsl.user_id = u.id
ORDER BY vsl.created_at DESC;

COMMENT ON VIEW recent_vpn_status IS 'Shows most recent VPN status checks for each user';

-- View: IP rotation patterns
CREATE OR REPLACE VIEW ip_rotation_patterns AS
SELECT 
    irl.user_id,
    u.username,
    DATE_TRUNC('hour', irl.created_at) as hour_bucket,
    COUNT(DISTINCT irl.ip_address) as unique_ips,
    COUNT(*) as total_requests,
    AVG(irl.unique_ips_last_hour) as avg_rotation_rate
FROM ip_rotation_log irl
JOIN users u ON irl.user_id = u.id
WHERE irl.created_at > NOW() - INTERVAL '24 hours'
GROUP BY irl.user_id, u.username, DATE_TRUNC('hour', irl.created_at)
ORDER BY hour_bucket DESC, unique_ips DESC;

COMMENT ON VIEW ip_rotation_patterns IS 'Shows IP rotation patterns over time for analysis';

-- ============================================================================
-- FUNCTIONS FOR VPN TRACKING
-- ============================================================================

-- Function to log VPN status check
CREATE OR REPLACE FUNCTION log_vpn_status_check(
    p_user_id INTEGER,
    p_ip_address VARCHAR(45),
    p_vpn_detected BOOLEAN,
    p_detection_methods JSONB,
    p_confidence_score INTEGER DEFAULT NULL,
    p_vpn_provider VARCHAR(255) DEFAULT NULL,
    p_vpn_interface VARCHAR(50) DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
    v_log_id INTEGER;
BEGIN
    INSERT INTO vpn_status_log (
        user_id,
        ip_address,
        vpn_detected,
        detection_methods,
        confidence_score,
        vpn_provider,
        vpn_interface
    ) VALUES (
        p_user_id,
        p_ip_address,
        p_vpn_detected,
        p_detection_methods,
        p_confidence_score,
        p_vpn_provider,
        p_vpn_interface
    ) RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION log_vpn_status_check IS 'Logs a VPN status check for audit trail';

-- Function to get user IP rotation stats
CREATE OR REPLACE FUNCTION get_user_ip_rotation_stats(p_user_id INTEGER)
RETURNS TABLE(
    total_ips_tracked BIGINT,
    unique_ips BIGINT,
    first_seen TIMESTAMP,
    last_seen TIMESTAMP,
    avg_rotation_rate NUMERIC,
    reached_threshold BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_ips_tracked,
        COUNT(DISTINCT ip_address) as unique_ips,
        MIN(created_at) as first_seen,
        MAX(created_at) as last_seen,
        AVG(unique_ips_last_hour) as avg_rotation_rate,
        (COUNT(*) >= 1000) as reached_threshold
    FROM ip_rotation_log
    WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_user_ip_rotation_stats IS 'Returns IP rotation statistics for a user';

-- ============================================================================
-- SAMPLE DATA / DOCUMENTATION
-- ============================================================================

-- Example vpn_info JSONB structure:
-- {
--   "vpnDetected": true,
--   "clientIP": "203.0.113.45",
--   "vpnProvider": "ProtonVPN",
--   "detectedInterface": "tun0"
-- }

-- Example detection_methods JSONB structure:
-- {
--   "interface": true,
--   "process": true,
--   "dns": false,
--   "publicIP": true
-- }

-- ============================================================================
-- GRANTS (adjust based on your role setup)
-- ============================================================================

-- Example grants (uncomment and adjust as needed):
-- GRANT SELECT ON ip_rotation_log TO authenticated;
-- GRANT INSERT ON ip_rotation_log TO authenticated;
-- GRANT SELECT ON vpn_status_log TO authenticated;
-- GRANT INSERT ON vpn_status_log TO authenticated;
-- GRANT SELECT ON user_vpn_compliance TO authenticated;
-- GRANT SELECT ON recent_vpn_status TO authenticated;
-- GRANT SELECT ON ip_rotation_patterns TO authenticated;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Insert migration record (optional, adjust table name to your migration tracking)
-- INSERT INTO schema_migrations (version, description, applied_at)
-- VALUES ('2.0.1', 'Add VPN verification and IP rotation tracking', NOW());
