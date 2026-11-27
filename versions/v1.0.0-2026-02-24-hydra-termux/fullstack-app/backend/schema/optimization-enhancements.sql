-- PostgreSQL Schema Updates for 10000% Optimization Integration
-- Version: 2.0.1
-- Date: 2025-12-31

-- ============================================================================
-- OPTIMIZATION TRACKING TABLES
-- ============================================================================

-- Track optimization configuration per attack
CREATE TABLE IF NOT EXISTS attack_optimizations (
    id SERIAL PRIMARY KEY,
    attack_id INTEGER REFERENCES attacks(id) ON DELETE CASCADE,
    protocol TEXT NOT NULL,
    threads_used INTEGER NOT NULL,
    timeout_used INTEGER NOT NULL,
    optimization_level TEXT DEFAULT '10000%',
    username_priority_used BOOLEAN DEFAULT TRUE,
    blank_password_tried BOOLEAN DEFAULT TRUE,
    success_rate_estimated NUMERIC(5,2),
    actual_success_rate NUMERIC(5,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_attack_optimizations_attack_id ON attack_optimizations(attack_id);
CREATE INDEX idx_attack_optimizations_protocol ON attack_optimizations(protocol);
CREATE INDEX idx_attack_optimizations_created ON attack_optimizations(created_at);

-- Track optimization profiles loaded
CREATE TABLE IF NOT EXISTS optimization_profiles (
    id SERIAL PRIMARY KEY,
    profile_name TEXT NOT NULL UNIQUE,
    version TEXT NOT NULL,
    protocols_supported TEXT[] NOT NULL,
    file_path TEXT NOT NULL,
    file_size_kb INTEGER,
    loaded_count INTEGER DEFAULT 0,
    last_loaded_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_optimization_profiles_name ON optimization_profiles(profile_name);

-- Track protocol-specific statistics
CREATE TABLE IF NOT EXISTS protocol_statistics (
    id SERIAL PRIMARY KEY,
    protocol TEXT NOT NULL,
    total_attacks INTEGER DEFAULT 0,
    successful_attacks INTEGER DEFAULT 0,
    failed_attacks INTEGER DEFAULT 0,
    average_duration_seconds INTEGER,
    average_threads_used INTEGER,
    average_timeout_used INTEGER,
    most_common_username TEXT,
    most_common_credential TEXT,
    blank_password_successes INTEGER DEFAULT 0,
    last_attack_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT protocol_statistics_protocol_unique UNIQUE (protocol)
);

CREATE INDEX idx_protocol_statistics_protocol ON protocol_statistics(protocol);
CREATE INDEX idx_protocol_statistics_updated ON protocol_statistics(updated_at);

-- Track optimization tips accessed
CREATE TABLE IF NOT EXISTS optimization_tips_accessed (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    protocol TEXT NOT NULL,
    tip_category TEXT,
    access_count INTEGER DEFAULT 1,
    last_accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_optimization_tips_user_id ON optimization_tips_accessed(user_id);
CREATE INDEX idx_optimization_tips_protocol ON optimization_tips_accessed(protocol);

-- ============================================================================
-- ENHANCED ATTACK RESULTS TRACKING
-- ============================================================================

-- Add optimization columns to existing attacks table (if not exists)
ALTER TABLE attacks 
ADD COLUMN IF NOT EXISTS optimization_enabled BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS optimization_profile TEXT DEFAULT 'optimized_attack_profiles.conf',
ADD COLUMN IF NOT EXISTS threads_optimized INTEGER,
ADD COLUMN IF NOT EXISTS timeout_optimized INTEGER,
ADD COLUMN IF NOT EXISTS success_rate_category TEXT;

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_attacks_optimization_enabled ON attacks(optimization_enabled);
CREATE INDEX IF NOT EXISTS idx_attacks_success_rate_category ON attacks(success_rate_category);

-- ============================================================================
-- TARGET SCANNER RECOMMENDATIONS TRACKING
-- ============================================================================

-- Track scanner recommendations
CREATE TABLE IF NOT EXISTS scanner_recommendations (
    id SERIAL PRIMARY KEY,
    scan_id TEXT NOT NULL,
    target TEXT NOT NULL,
    service_detected TEXT NOT NULL,
    port INTEGER NOT NULL,
    recommended_script TEXT NOT NULL,
    success_rate_estimated NUMERIC(5,2),
    attack_strategy TEXT,
    priority_level INTEGER DEFAULT 5,
    recommendation_used BOOLEAN DEFAULT FALSE,
    attack_id INTEGER REFERENCES attacks(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_scanner_recommendations_scan_id ON scanner_recommendations(scan_id);
CREATE INDEX idx_scanner_recommendations_target ON scanner_recommendations(target);
CREATE INDEX idx_scanner_recommendations_service ON scanner_recommendations(service_detected);
CREATE INDEX idx_scanner_recommendations_priority ON scanner_recommendations(priority_level);

-- ============================================================================
-- RESULTS VIEWER 30-DAY HISTORY
-- ============================================================================

-- Add retention policy tracking
CREATE TABLE IF NOT EXISTS results_retention_policy (
    id SERIAL PRIMARY KEY,
    policy_name TEXT NOT NULL UNIQUE,
    retention_days INTEGER NOT NULL DEFAULT 30,
    auto_cleanup_enabled BOOLEAN DEFAULT TRUE,
    last_cleanup_at TIMESTAMP,
    records_cleaned_last_run INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default 30-day policy
INSERT INTO results_retention_policy (policy_name, retention_days, auto_cleanup_enabled)
VALUES ('attack_results_30_day', 30, TRUE)
ON CONFLICT (policy_name) DO NOTHING;

-- Add results archival tracking
CREATE TABLE IF NOT EXISTS results_archive (
    id SERIAL PRIMARY KEY,
    original_result_id INTEGER,
    target TEXT NOT NULL,
    protocol TEXT NOT NULL,
    port INTEGER,
    username TEXT,
    success BOOLEAN,
    archived_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    original_created_at TIMESTAMP,
    archive_reason TEXT DEFAULT '30_day_retention'
);

CREATE INDEX idx_results_archive_target ON results_archive(target);
CREATE INDEX idx_results_archive_protocol ON results_archive(protocol);
CREATE INDEX idx_results_archive_archived ON results_archive(archived_at);

-- ============================================================================
-- OPTIMIZATION ANALYTICS
-- ============================================================================

-- Track optimization performance over time
CREATE TABLE IF NOT EXISTS optimization_analytics (
    id SERIAL PRIMARY KEY,
    date DATE NOT NULL,
    protocol TEXT NOT NULL,
    total_attacks INTEGER DEFAULT 0,
    optimized_attacks INTEGER DEFAULT 0,
    unoptimized_attacks INTEGER DEFAULT 0,
    avg_speed_improvement_percent NUMERIC(5,2),
    avg_success_rate_optimized NUMERIC(5,2),
    avg_success_rate_unoptimized NUMERIC(5,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT optimization_analytics_date_protocol_unique UNIQUE (date, protocol)
);

CREATE INDEX idx_optimization_analytics_date ON optimization_analytics(date);
CREATE INDEX idx_optimization_analytics_protocol ON optimization_analytics(protocol);

-- ============================================================================
-- FUNCTIONS FOR OPTIMIZATION TRACKING
-- ============================================================================

-- Function to update protocol statistics after attack
CREATE OR REPLACE FUNCTION update_protocol_statistics()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO protocol_statistics (
        protocol,
        total_attacks,
        successful_attacks,
        failed_attacks,
        last_attack_at
    )
    VALUES (
        NEW.protocol,
        1,
        CASE WHEN NEW.success = TRUE THEN 1 ELSE 0 END,
        CASE WHEN NEW.success = FALSE THEN 1 ELSE 0 END,
        NOW()
    )
    ON CONFLICT (protocol) DO UPDATE SET
        total_attacks = protocol_statistics.total_attacks + 1,
        successful_attacks = protocol_statistics.successful_attacks + 
            CASE WHEN NEW.success = TRUE THEN 1 ELSE 0 END,
        failed_attacks = protocol_statistics.failed_attacks + 
            CASE WHEN NEW.success = FALSE THEN 1 ELSE 0 END,
        last_attack_at = NOW(),
        updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update protocol statistics
DROP TRIGGER IF EXISTS trigger_update_protocol_statistics ON attacks;
CREATE TRIGGER trigger_update_protocol_statistics
    AFTER INSERT ON attacks
    FOR EACH ROW
    EXECUTE FUNCTION update_protocol_statistics();

-- Function to cleanup old results (30-day retention)
CREATE OR REPLACE FUNCTION cleanup_old_results()
RETURNS INTEGER AS $$
DECLARE
    records_archived INTEGER;
    retention_days INTEGER;
BEGIN
    -- Get retention days from policy
    SELECT retention_days INTO retention_days
    FROM results_retention_policy
    WHERE policy_name = 'attack_results_30_day'
    AND auto_cleanup_enabled = TRUE;
    
    IF retention_days IS NULL THEN
        RETURN 0;
    END IF;
    
    -- Archive old results
    WITH archived AS (
        INSERT INTO results_archive (
            original_result_id,
            target,
            protocol,
            port,
            username,
            success,
            original_created_at
        )
        SELECT 
            id,
            target,
            protocol,
            port,
            username,
            success,
            created_at
        FROM attacks
        WHERE created_at < NOW() - (retention_days || ' days')::INTERVAL
        AND id NOT IN (SELECT original_result_id FROM results_archive WHERE original_result_id IS NOT NULL)
        RETURNING *
    )
    SELECT COUNT(*) INTO records_archived FROM archived;
    
    -- Update last cleanup info
    UPDATE results_retention_policy
    SET last_cleanup_at = NOW(),
        records_cleaned_last_run = records_archived,
        updated_at = NOW()
    WHERE policy_name = 'attack_results_30_day';
    
    RETURN records_archived;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- VIEWS FOR OPTIMIZATION REPORTING
-- ============================================================================

-- View for optimization performance summary
CREATE OR REPLACE VIEW v_optimization_performance AS
SELECT 
    p.protocol,
    p.total_attacks,
    p.successful_attacks,
    p.failed_attacks,
    ROUND((p.successful_attacks::NUMERIC / NULLIF(p.total_attacks, 0) * 100), 2) AS success_rate_percent,
    p.average_duration_seconds,
    p.average_threads_used,
    p.average_timeout_used,
    p.most_common_username,
    p.blank_password_successes,
    ROUND((p.blank_password_successes::NUMERIC / NULLIF(p.successful_attacks, 0) * 100), 2) AS blank_password_success_rate,
    p.last_attack_at,
    p.updated_at
FROM protocol_statistics p
ORDER BY p.successful_attacks DESC;

-- View for 30-day attack history
CREATE OR REPLACE VIEW v_30_day_attack_history AS
SELECT 
    a.id,
    a.target,
    a.protocol,
    a.port,
    a.username,
    a.success,
    a.optimization_enabled,
    a.threads_optimized,
    a.timeout_optimized,
    a.success_rate_category,
    a.duration_seconds,
    a.created_at,
    DATE(a.created_at) AS attack_date,
    EXTRACT(DAY FROM NOW() - a.created_at) AS days_ago
FROM attacks a
WHERE a.created_at >= NOW() - INTERVAL '30 days'
ORDER BY a.created_at DESC;

-- View for scanner recommendations with usage
CREATE OR REPLACE VIEW v_scanner_recommendations_usage AS
SELECT 
    sr.service_detected,
    sr.recommended_script,
    COUNT(*) AS recommendations_made,
    SUM(CASE WHEN sr.recommendation_used THEN 1 ELSE 0 END) AS recommendations_used,
    ROUND(AVG(sr.success_rate_estimated), 2) AS avg_estimated_success_rate,
    ROUND(SUM(CASE WHEN sr.recommendation_used THEN 1 ELSE 0 END)::NUMERIC / 
          NULLIF(COUNT(*), 0) * 100, 2) AS usage_rate_percent
FROM scanner_recommendations sr
GROUP BY sr.service_detected, sr.recommended_script
ORDER BY recommendations_made DESC;

-- ============================================================================
-- INITIAL DATA
-- ============================================================================

-- Insert optimization profile record
INSERT INTO optimization_profiles (
    profile_name,
    version,
    protocols_supported,
    file_path,
    file_size_kb
)
VALUES (
    'optimized_attack_profiles.conf',
    '2.0.1',
    ARRAY['ssh', 'ftp', 'mysql', 'postgresql', 'rdp', 'smb', 'web', 'redis', 'mongodb', 'snmp', 'telnet', 'vnc', 'imap', 'pop3', 'smtp', 'ldap', 'rtsp', 'sip'],
    'config/optimized_attack_profiles.conf',
    18
)
ON CONFLICT (profile_name) DO UPDATE SET
    version = EXCLUDED.version,
    protocols_supported = EXCLUDED.protocols_supported,
    updated_at = NOW();

-- ============================================================================
-- MAINTENANCE JOBS (Run periodically via cron or scheduler)
-- ============================================================================

-- Run cleanup of old results (30-day retention)
-- Schedule this to run daily:
-- SELECT cleanup_old_results();

-- Vacuum and analyze optimization tables
-- Schedule this to run weekly:
-- VACUUM ANALYZE attack_optimizations;
-- VACUUM ANALYZE protocol_statistics;
-- VACUUM ANALYZE scanner_recommendations;

-- ============================================================================
-- GRANTS (Adjust based on your user setup)
-- ============================================================================

-- GRANT ALL ON TABLE attack_optimizations TO hydra_app_user;
-- GRANT ALL ON TABLE optimization_profiles TO hydra_app_user;
-- GRANT ALL ON TABLE protocol_statistics TO hydra_app_user;
-- GRANT ALL ON TABLE optimization_tips_accessed TO hydra_app_user;
-- GRANT ALL ON TABLE scanner_recommendations TO hydra_app_user;
-- GRANT ALL ON TABLE results_retention_policy TO hydra_app_user;
-- GRANT ALL ON TABLE results_archive TO hydra_app_user;
-- GRANT ALL ON TABLE optimization_analytics TO hydra_app_user;

-- GRANT ALL ON SEQUENCE attack_optimizations_id_seq TO hydra_app_user;
-- GRANT ALL ON SEQUENCE optimization_profiles_id_seq TO hydra_app_user;
-- GRANT ALL ON SEQUENCE protocol_statistics_id_seq TO hydra_app_user;
-- GRANT ALL ON SEQUENCE optimization_tips_accessed_id_seq TO hydra_app_user;
-- GRANT ALL ON SEQUENCE scanner_recommendations_id_seq TO hydra_app_user;
-- GRANT ALL ON SEQUENCE results_retention_policy_id_seq TO hydra_app_user;
-- GRANT ALL ON SEQUENCE results_archive_id_seq TO hydra_app_user;
-- GRANT ALL ON SEQUENCE optimization_analytics_id_seq TO hydra_app_user;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check optimization tables exist
SELECT 'Optimization tables created successfully' AS status
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'attack_optimizations')
  AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'protocol_statistics')
  AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'scanner_recommendations');

-- Check views exist
SELECT 'Optimization views created successfully' AS status
WHERE EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'v_optimization_performance')
  AND EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'v_30_day_attack_history')
  AND EXISTS (SELECT 1 FROM information_schema.views WHERE table_name = 'v_scanner_recommendations_usage');

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
