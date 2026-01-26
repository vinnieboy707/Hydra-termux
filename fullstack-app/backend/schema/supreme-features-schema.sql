-- ============================================================================
-- HYDRA-TERMUX SUPREME FEATURES SCHEMA
-- Email-IP Attacks, Supreme Combos, DNS Intelligence, Advanced Analytics
-- Version: 3.0.0
-- Date: 2025-01-15
-- ============================================================================

-- ============================================================================
-- NEW ENUMS
-- ============================================================================

CREATE TYPE email_attack_status AS ENUM ('queued', 'running', 'completed', 'failed', 'cancelled', 'paused');
CREATE TYPE combo_attack_type AS ENUM ('email_ip', 'credential_stuffing', 'api_endpoint', 'cloud_service', 'active_directory', 'web_application');
CREATE TYPE dns_record_type AS ENUM ('A', 'AAAA', 'MX', 'TXT', 'SPF', 'DMARC', 'DKIM', 'NS', 'CNAME', 'PTR', 'SOA');
CREATE TYPE attack_severity AS ENUM ('critical', 'high', 'medium', 'low', 'info');

-- ============================================================================
-- EMAIL-IP ATTACKS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_ip_attacks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    target_email VARCHAR(255) NOT NULL,
    target_ip VARCHAR(45) NOT NULL,
    target_port INTEGER DEFAULT 587,
    protocol VARCHAR(20) DEFAULT 'smtp', -- smtp, imap, pop3
    status email_attack_status DEFAULT 'queued',
    
    -- Attack Configuration
    wordlist_id INTEGER REFERENCES wordlists(id) ON DELETE SET NULL,
    combo_list_path TEXT,
    use_ssl BOOLEAN DEFAULT TRUE,
    use_tls BOOLEAN DEFAULT TRUE,
    timeout_seconds INTEGER DEFAULT 30,
    max_threads INTEGER DEFAULT 4,
    retry_attempts INTEGER DEFAULT 3,
    
    -- Results
    total_attempts INTEGER DEFAULT 0,
    successful_attempts INTEGER DEFAULT 0,
    failed_attempts INTEGER DEFAULT 0,
    credentials_found JSONB DEFAULT '[]'::jsonb,
    
    -- Metadata
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    duration_seconds INTEGER,
    error_message TEXT,
    attack_vector TEXT,
    notes TEXT,
    tags TEXT[],
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_email_ip_attacks_user_id ON email_ip_attacks(user_id);
CREATE INDEX idx_email_ip_attacks_status ON email_ip_attacks(status);
CREATE INDEX idx_email_ip_attacks_target_email ON email_ip_attacks(target_email);
CREATE INDEX idx_email_ip_attacks_target_ip ON email_ip_attacks(target_ip);
CREATE INDEX idx_email_ip_attacks_created_at ON email_ip_attacks(created_at DESC);
CREATE INDEX idx_email_ip_attacks_tags ON email_ip_attacks USING GIN(tags);

-- ============================================================================
-- SUPREME COMBO ATTACKS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS supreme_combo_attacks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    attack_type combo_attack_type NOT NULL,
    status email_attack_status DEFAULT 'queued',
    
    -- Target Configuration
    target_service VARCHAR(255) NOT NULL, -- gmail, office365, aws, azure, etc.
    target_urls TEXT[], -- Multiple URLs for web attacks
    target_endpoints JSONB DEFAULT '[]'::jsonb,
    
    -- Combo Script Configuration
    script_name VARCHAR(255) NOT NULL,
    script_path TEXT NOT NULL,
    combo_file_path TEXT NOT NULL,
    combo_count INTEGER DEFAULT 0,
    
    -- Advanced Configuration
    proxy_list TEXT[],
    user_agent_rotation BOOLEAN DEFAULT TRUE,
    captcha_bypass BOOLEAN DEFAULT FALSE,
    rate_limit_bypass BOOLEAN DEFAULT FALSE,
    use_tor BOOLEAN DEFAULT FALSE,
    use_vpn BOOLEAN DEFAULT FALSE,
    
    -- Execution Settings
    max_threads INTEGER DEFAULT 10,
    timeout_seconds INTEGER DEFAULT 60,
    retry_failed BOOLEAN DEFAULT TRUE,
    save_screenshots BOOLEAN DEFAULT FALSE,
    
    -- Results
    total_combos_tested INTEGER DEFAULT 0,
    successful_logins INTEGER DEFAULT 0,
    failed_attempts INTEGER DEFAULT 0,
    rate_limited INTEGER DEFAULT 0,
    captcha_hit INTEGER DEFAULT 0,
    valid_credentials JSONB DEFAULT '[]'::jsonb,
    
    -- Performance Metrics
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    duration_seconds INTEGER,
    combos_per_second DECIMAL(10, 2),
    success_rate DECIMAL(5, 2),
    
    -- Metadata
    error_message TEXT,
    output_file_path TEXT,
    screenshot_dir TEXT,
    notes TEXT,
    tags TEXT[],
    priority INTEGER DEFAULT 5,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_supreme_combo_attacks_user_id ON supreme_combo_attacks(user_id);
CREATE INDEX idx_supreme_combo_attacks_status ON supreme_combo_attacks(status);
CREATE INDEX idx_supreme_combo_attacks_attack_type ON supreme_combo_attacks(attack_type);
CREATE INDEX idx_supreme_combo_attacks_target_service ON supreme_combo_attacks(target_service);
CREATE INDEX idx_supreme_combo_attacks_created_at ON supreme_combo_attacks(created_at DESC);
CREATE INDEX idx_supreme_combo_attacks_priority ON supreme_combo_attacks(priority DESC);

-- ============================================================================
-- COMBO ATTACK RESULTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS combo_attack_results (
    id SERIAL PRIMARY KEY,
    combo_attack_id INTEGER REFERENCES supreme_combo_attacks(id) ON DELETE CASCADE,
    email_attack_id INTEGER REFERENCES email_ip_attacks(id) ON DELETE CASCADE,
    
    -- Credential Information
    username VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    target VARCHAR(255) NOT NULL,
    
    -- Result Details
    is_valid BOOLEAN DEFAULT FALSE,
    response_code INTEGER,
    response_message TEXT,
    response_time_ms INTEGER,
    
    -- Additional Data
    session_token TEXT,
    cookies JSONB,
    account_info JSONB,
    two_factor_enabled BOOLEAN,
    account_status VARCHAR(100),
    
    -- Metadata
    tested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45),
    user_agent TEXT,
    proxy_used VARCHAR(255),
    screenshot_path TEXT,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_combo_results_combo_attack_id ON combo_attack_results(combo_attack_id);
CREATE INDEX idx_combo_results_email_attack_id ON combo_attack_results(email_attack_id);
CREATE INDEX idx_combo_results_is_valid ON combo_attack_results(is_valid);
CREATE INDEX idx_combo_results_target ON combo_attack_results(target);
CREATE INDEX idx_combo_results_tested_at ON combo_attack_results(tested_at DESC);

-- ============================================================================
-- EMAIL INFRASTRUCTURE INTELLIGENCE TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_infrastructure_intel (
    id SERIAL PRIMARY KEY,
    domain VARCHAR(255) UNIQUE NOT NULL,
    
    -- MX Records
    mx_records JSONB DEFAULT '[]'::jsonb,
    mx_priority_map JSONB DEFAULT '{}'::jsonb,
    
    -- SPF Records
    spf_record TEXT,
    spf_valid BOOLEAN,
    spf_mechanisms JSONB DEFAULT '[]'::jsonb,
    spf_includes TEXT[],
    
    -- DMARC Records
    dmarc_record TEXT,
    dmarc_policy VARCHAR(20),
    dmarc_subdomain_policy VARCHAR(20),
    dmarc_percentage INTEGER,
    dmarc_report_email TEXT[],
    
    -- DKIM Records
    dkim_selectors TEXT[],
    dkim_records JSONB DEFAULT '[]'::jsonb,
    dkim_valid BOOLEAN,
    
    -- DNS Records
    a_records TEXT[],
    aaaa_records TEXT[],
    ns_records TEXT[],
    txt_records TEXT[],
    
    -- Email Provider Detection
    email_provider VARCHAR(100),
    provider_ip_ranges TEXT[],
    uses_cloud_provider BOOLEAN,
    cloud_provider VARCHAR(100),
    
    -- Security Assessment
    has_spf BOOLEAN DEFAULT FALSE,
    has_dmarc BOOLEAN DEFAULT FALSE,
    has_dkim BOOLEAN DEFAULT FALSE,
    security_score INTEGER,
    vulnerability_notes TEXT[],
    
    -- Attack Surface
    open_ports INTEGER[],
    mail_server_software VARCHAR(255),
    mail_server_version VARCHAR(100),
    supports_starttls BOOLEAN,
    supports_ssl BOOLEAN,
    
    -- Metadata
    last_scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    scan_count INTEGER DEFAULT 0,
    notes TEXT,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_email_intel_domain ON email_infrastructure_intel(domain);
CREATE INDEX idx_email_intel_email_provider ON email_infrastructure_intel(email_provider);
CREATE INDEX idx_email_intel_security_score ON email_infrastructure_intel(security_score DESC);
CREATE INDEX idx_email_intel_last_scanned ON email_infrastructure_intel(last_scanned_at DESC);

-- ============================================================================
-- API ENDPOINTS TESTED TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS api_endpoints_tested (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    combo_attack_id INTEGER REFERENCES supreme_combo_attacks(id) ON DELETE SET NULL,
    
    -- Endpoint Information
    endpoint_url TEXT NOT NULL,
    http_method VARCHAR(10) DEFAULT 'POST',
    api_name VARCHAR(255),
    api_version VARCHAR(50),
    
    -- Authentication
    auth_type VARCHAR(50), -- basic, bearer, oauth, api_key, custom
    auth_header_name VARCHAR(100),
    requires_token BOOLEAN DEFAULT FALSE,
    
    -- Request Configuration
    request_headers JSONB DEFAULT '{}'::jsonb,
    request_body_template JSONB,
    content_type VARCHAR(100) DEFAULT 'application/json',
    
    -- Response Analysis
    success_indicators JSONB DEFAULT '[]'::jsonb,
    failure_indicators JSONB DEFAULT '[]'::jsonb,
    expected_status_codes INTEGER[],
    
    -- Testing Results
    total_requests INTEGER DEFAULT 0,
    successful_auths INTEGER DEFAULT 0,
    failed_auths INTEGER DEFAULT 0,
    rate_limited_count INTEGER DEFAULT 0,
    avg_response_time_ms INTEGER,
    
    -- Security Findings
    has_rate_limiting BOOLEAN,
    has_captcha BOOLEAN,
    has_mfa BOOLEAN,
    has_ip_blocking BOOLEAN,
    vulnerability_level attack_severity,
    vulnerability_details TEXT[],
    
    -- Metadata
    last_tested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    test_count INTEGER DEFAULT 0,
    notes TEXT,
    tags TEXT[],
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_api_endpoints_user_id ON api_endpoints_tested(user_id);
CREATE INDEX idx_api_endpoints_combo_attack_id ON api_endpoints_tested(combo_attack_id);
CREATE INDEX idx_api_endpoints_url ON api_endpoints_tested(endpoint_url);
CREATE INDEX idx_api_endpoints_api_name ON api_endpoints_tested(api_name);
CREATE INDEX idx_api_endpoints_vulnerability_level ON api_endpoints_tested(vulnerability_level);

-- ============================================================================
-- CLOUD SERVICE ATTACKS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS cloud_service_attacks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    combo_attack_id INTEGER REFERENCES supreme_combo_attacks(id) ON DELETE SET NULL,
    
    -- Cloud Service Details
    cloud_provider VARCHAR(50) NOT NULL, -- aws, azure, gcp, digitalocean, etc.
    service_name VARCHAR(255) NOT NULL, -- s3, ec2, lambda, storage, compute, etc.
    console_url TEXT,
    api_endpoint TEXT,
    
    -- Attack Configuration
    attack_vector VARCHAR(100), -- credential_stuffing, api_abuse, misconfiguration
    credentials_tested INTEGER DEFAULT 0,
    valid_credentials JSONB DEFAULT '[]'::jsonb,
    
    -- Access Level
    access_level VARCHAR(50), -- read, write, admin, root
    permissions_discovered TEXT[],
    resources_accessible JSONB,
    
    -- Results
    successful_logins INTEGER DEFAULT 0,
    failed_attempts INTEGER DEFAULT 0,
    mfa_required INTEGER DEFAULT 0,
    ip_blocked INTEGER DEFAULT 0,
    
    -- Security Findings
    misconfigurations_found JSONB DEFAULT '[]'::jsonb,
    exposed_resources TEXT[],
    security_score INTEGER,
    risk_level attack_severity,
    
    -- Metadata
    tested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    duration_seconds INTEGER,
    notes TEXT,
    tags TEXT[],
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_cloud_attacks_user_id ON cloud_service_attacks(user_id);
CREATE INDEX idx_cloud_attacks_provider ON cloud_service_attacks(cloud_provider);
CREATE INDEX idx_cloud_attacks_service ON cloud_service_attacks(service_name);
CREATE INDEX idx_cloud_attacks_risk_level ON cloud_service_attacks(risk_level);

-- ============================================================================
-- ACTIVE DIRECTORY ATTACKS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS active_directory_attacks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    combo_attack_id INTEGER REFERENCES supreme_combo_attacks(id) ON DELETE SET NULL,
    
    -- AD Configuration
    domain_name VARCHAR(255) NOT NULL,
    domain_controller_ip VARCHAR(45),
    ldap_port INTEGER DEFAULT 389,
    ldaps_port INTEGER DEFAULT 636,
    
    -- Attack Details
    attack_type VARCHAR(100), -- password_spray, kerberoasting, asreproast, etc.
    credentials_tested INTEGER DEFAULT 0,
    valid_users_found INTEGER DEFAULT 0,
    valid_credentials JSONB DEFAULT '[]'::jsonb,
    
    -- Enumeration Results
    users_enumerated TEXT[],
    groups_enumerated TEXT[],
    computers_enumerated TEXT[],
    service_accounts JSONB DEFAULT '[]'::jsonb,
    
    -- Privilege Escalation
    admin_accounts_found TEXT[],
    privileged_groups TEXT[],
    delegation_issues JSONB,
    
    -- Security Assessment
    password_policy JSONB,
    account_lockout_policy JSONB,
    kerberos_config JSONB,
    vulnerabilities_found TEXT[],
    
    -- Results
    successful_attempts INTEGER DEFAULT 0,
    failed_attempts INTEGER DEFAULT 0,
    locked_accounts INTEGER DEFAULT 0,
    
    -- Metadata
    tested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    duration_seconds INTEGER,
    notes TEXT,
    tags TEXT[],
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ad_attacks_user_id ON active_directory_attacks(user_id);
CREATE INDEX idx_ad_attacks_domain ON active_directory_attacks(domain_name);
CREATE INDEX idx_ad_attacks_attack_type ON active_directory_attacks(attack_type);

-- ============================================================================
-- WEB APPLICATION ATTACKS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS web_application_attacks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    combo_attack_id INTEGER REFERENCES supreme_combo_attacks(id) ON DELETE SET NULL,
    
    -- Web App Details
    app_name VARCHAR(255) NOT NULL,
    base_url TEXT NOT NULL,
    login_url TEXT NOT NULL,
    
    -- Form Configuration
    username_field VARCHAR(100) DEFAULT 'username',
    password_field VARCHAR(100) DEFAULT 'password',
    additional_fields JSONB DEFAULT '{}'::jsonb,
    csrf_token_required BOOLEAN DEFAULT FALSE,
    
    -- Attack Configuration
    attack_type VARCHAR(100) DEFAULT 'credential_stuffing',
    credentials_tested INTEGER DEFAULT 0,
    valid_credentials JSONB DEFAULT '[]'::jsonb,
    
    -- Anti-Automation Detection
    has_captcha BOOLEAN DEFAULT FALSE,
    captcha_type VARCHAR(50),
    has_rate_limiting BOOLEAN DEFAULT FALSE,
    has_waf BOOLEAN DEFAULT FALSE,
    waf_name VARCHAR(100),
    
    -- Results
    successful_logins INTEGER DEFAULT 0,
    failed_attempts INTEGER DEFAULT 0,
    captcha_triggered INTEGER DEFAULT 0,
    rate_limited INTEGER DEFAULT 0,
    ip_blocked INTEGER DEFAULT 0,
    
    -- Session Management
    session_tokens_captured JSONB DEFAULT '[]'::jsonb,
    cookies_captured JSONB DEFAULT '[]'::jsonb,
    authenticated_requests_made INTEGER DEFAULT 0,
    
    -- Vulnerability Assessment
    vulnerabilities_found TEXT[],
    security_headers JSONB,
    risk_level attack_severity,
    
    -- Metadata
    tested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    duration_seconds INTEGER,
    notes TEXT,
    tags TEXT[],
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_web_attacks_user_id ON web_application_attacks(user_id);
CREATE INDEX idx_web_attacks_app_name ON web_application_attacks(app_name);
CREATE INDEX idx_web_attacks_base_url ON web_application_attacks(base_url);
CREATE INDEX idx_web_attacks_risk_level ON web_application_attacks(risk_level);

-- ============================================================================
-- ATTACK ANALYTICS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS attack_analytics (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    
    -- Time Period
    date DATE NOT NULL,
    hour INTEGER,
    
    -- Attack Statistics
    total_attacks INTEGER DEFAULT 0,
    successful_attacks INTEGER DEFAULT 0,
    failed_attacks INTEGER DEFAULT 0,
    cancelled_attacks INTEGER DEFAULT 0,
    
    -- Attack Types
    email_ip_attacks INTEGER DEFAULT 0,
    supreme_combo_attacks INTEGER DEFAULT 0,
    cloud_attacks INTEGER DEFAULT 0,
    ad_attacks INTEGER DEFAULT 0,
    web_app_attacks INTEGER DEFAULT 0,
    
    -- Performance Metrics
    avg_duration_seconds INTEGER,
    avg_success_rate DECIMAL(5, 2),
    total_credentials_tested BIGINT DEFAULT 0,
    total_credentials_found INTEGER DEFAULT 0,
    
    -- Resource Usage
    total_threads_used INTEGER,
    total_bandwidth_mb DECIMAL(10, 2),
    peak_concurrent_attacks INTEGER,
    
    -- Security Events
    captcha_hits INTEGER DEFAULT 0,
    rate_limits_hit INTEGER DEFAULT 0,
    ip_blocks INTEGER DEFAULT 0,
    mfa_encounters INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(user_id, date, hour)
);

CREATE INDEX idx_analytics_user_id ON attack_analytics(user_id);
CREATE INDEX idx_analytics_date ON attack_analytics(date DESC);
CREATE INDEX idx_analytics_user_date ON attack_analytics(user_id, date DESC);

-- ============================================================================
-- CREDENTIAL VAULT TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS credential_vault (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    
    -- Source Attack
    source_attack_type VARCHAR(50), -- email_ip, supreme_combo, cloud, ad, web_app
    source_attack_id INTEGER,
    combo_result_id INTEGER REFERENCES combo_attack_results(id) ON DELETE SET NULL,
    
    -- Credential Information
    username VARCHAR(255) NOT NULL,
    password VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    target_service VARCHAR(255) NOT NULL,
    target_url TEXT,
    
    -- Additional Data
    access_level VARCHAR(50),
    account_status VARCHAR(100),
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    session_token TEXT,
    api_keys JSONB,
    additional_info JSONB,
    
    -- Verification
    is_verified BOOLEAN DEFAULT TRUE,
    last_verified_at TIMESTAMP,
    verification_attempts INTEGER DEFAULT 0,
    
    -- Organization
    category VARCHAR(100), -- email, cloud, vpn, admin, etc.
    tags TEXT[],
    notes TEXT,
    priority INTEGER DEFAULT 5,
    
    -- Security
    encrypted_password TEXT,
    
    -- Timestamps
    discovered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_vault_user_id ON credential_vault(user_id);
CREATE INDEX idx_vault_target_service ON credential_vault(target_service);
CREATE INDEX idx_vault_category ON credential_vault(category);
CREATE INDEX idx_vault_is_verified ON credential_vault(is_verified);
CREATE INDEX idx_vault_priority ON credential_vault(priority DESC);
CREATE INDEX idx_vault_tags ON credential_vault USING GIN(tags);

-- ============================================================================
-- NOTIFICATION SETTINGS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS notification_settings (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    
    -- Email Notifications
    email_enabled BOOLEAN DEFAULT TRUE,
    email_on_attack_complete BOOLEAN DEFAULT TRUE,
    email_on_attack_fail BOOLEAN DEFAULT TRUE,
    email_on_credentials_found BOOLEAN DEFAULT TRUE,
    
    -- Discord Notifications
    discord_enabled BOOLEAN DEFAULT FALSE,
    discord_webhook_url TEXT,
    discord_on_attack_complete BOOLEAN DEFAULT TRUE,
    discord_on_credentials_found BOOLEAN DEFAULT TRUE,
    
    -- Slack Notifications
    slack_enabled BOOLEAN DEFAULT FALSE,
    slack_webhook_url TEXT,
    slack_on_attack_complete BOOLEAN DEFAULT TRUE,
    slack_on_credentials_found BOOLEAN DEFAULT TRUE,
    
    -- Telegram Notifications
    telegram_enabled BOOLEAN DEFAULT FALSE,
    telegram_bot_token TEXT,
    telegram_chat_id TEXT,
    telegram_on_attack_complete BOOLEAN DEFAULT TRUE,
    
    -- Push Notifications
    push_enabled BOOLEAN DEFAULT FALSE,
    push_token TEXT,
    
    -- Notification Preferences
    batch_notifications BOOLEAN DEFAULT FALSE,
    batch_interval_minutes INTEGER DEFAULT 30,
    quiet_hours_start TIME,
    quiet_hours_end TIME,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notification_settings_user_id ON notification_settings(user_id);

-- ============================================================================
-- VIEWS FOR REPORTING
-- ============================================================================

-- User Attack Summary View
CREATE OR REPLACE VIEW user_attack_summary AS
SELECT 
    u.id as user_id,
    u.username,
    COUNT(DISTINCT a.id) as total_attacks,
    COUNT(DISTINCT eia.id) as email_ip_attacks,
    COUNT(DISTINCT sca.id) as supreme_combo_attacks,
    COUNT(DISTINCT csa.id) as cloud_attacks,
    COUNT(DISTINCT ada.id) as ad_attacks,
    COUNT(DISTINCT waa.id) as web_app_attacks,
    COUNT(DISTINCT cv.id) as credentials_found,
    MAX(a.created_at) as last_attack_at
FROM users u
LEFT JOIN attacks a ON u.id = a.user_id
LEFT JOIN email_ip_attacks eia ON u.id = eia.user_id
LEFT JOIN supreme_combo_attacks sca ON u.id = sca.user_id
LEFT JOIN cloud_service_attacks csa ON u.id = csa.user_id
LEFT JOIN active_directory_attacks ada ON u.id = ada.user_id
LEFT JOIN web_application_attacks waa ON u.id = waa.user_id
LEFT JOIN credential_vault cv ON u.id = cv.user_id
GROUP BY u.id, u.username;

-- Recent Credentials View
CREATE OR REPLACE VIEW recent_credentials AS
SELECT 
    cv.*,
    u.username as owner_username,
    CASE 
        WHEN cv.source_attack_type = 'email_ip' THEN eia.name
        WHEN cv.source_attack_type = 'supreme_combo' THEN sca.name
        WHEN cv.source_attack_type = 'cloud' THEN csa.service_name
        WHEN cv.source_attack_type = 'ad' THEN ada.domain_name
        WHEN cv.source_attack_type = 'web_app' THEN waa.app_name
    END as attack_name
FROM credential_vault cv
JOIN users u ON cv.user_id = u.id
LEFT JOIN email_ip_attacks eia ON cv.source_attack_type = 'email_ip' AND cv.source_attack_id = eia.id
LEFT JOIN supreme_combo_attacks sca ON cv.source_attack_type = 'supreme_combo' AND cv.source_attack_id = sca.id
LEFT JOIN cloud_service_attacks csa ON cv.source_attack_type = 'cloud' AND cv.source_attack_id = csa.id
LEFT JOIN active_directory_attacks ada ON cv.source_attack_type = 'ad' AND cv.source_attack_id = ada.id
LEFT JOIN web_application_attacks waa ON cv.source_attack_type = 'web_app' AND cv.source_attack_id = waa.id
ORDER BY cv.discovered_at DESC;

-- Attack Performance View
CREATE OR REPLACE VIEW attack_performance AS
SELECT 
    'email_ip' as attack_type,
    COUNT(*) as total_attacks,
    SUM(successful_attempts) as total_success,
    SUM(failed_attempts) as total_failures,
    AVG(duration_seconds) as avg_duration,
    AVG(CASE WHEN total_attempts > 0 THEN (successful_attempts::DECIMAL / total_attempts * 100) ELSE 0 END) as avg_success_rate
FROM email_ip_attacks
UNION ALL
SELECT 
    'supreme_combo' as attack_type,
    COUNT(*) as total_attacks,
    SUM(successful_logins) as total_success,
    SUM(failed_attempts) as total_failures,
    AVG(duration_seconds) as avg_duration,
    AVG(success_rate) as avg_success_rate
FROM supreme_combo_attacks
UNION ALL
SELECT 
    'cloud_service' as attack_type,
    COUNT(*) as total_attacks,
    SUM(successful_logins) as total_success,
    SUM(failed_attempts) as total_failures,
    AVG(duration_seconds) as avg_duration,
    AVG(CASE WHEN credentials_tested > 0 THEN (successful_logins::DECIMAL / credentials_tested * 100) ELSE 0 END) as avg_success_rate
FROM cloud_service_attacks
UNION ALL
SELECT 
    'active_directory' as attack_type,
    COUNT(*) as total_attacks,
    SUM(successful_attempts) as total_success,
    SUM(failed_attempts) as total_failures,
    AVG(duration_seconds) as avg_duration,
    AVG(CASE WHEN credentials_tested > 0 THEN (successful_attempts::DECIMAL / credentials_tested * 100) ELSE 0 END) as avg_success_rate
FROM active_directory_attacks
UNION ALL
SELECT 
    'web_application' as attack_type,
    COUNT(*) as total_attacks,
    SUM(successful_logins) as total_success,
    SUM(failed_attempts) as total_failures,
    AVG(duration_seconds) as avg_duration,
    AVG(CASE WHEN credentials_tested > 0 THEN (successful_logins::DECIMAL / credentials_tested * 100) ELSE 0 END) as avg_success_rate
FROM web_application_attacks;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Update timestamp trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_email_ip_attacks_updated_at BEFORE UPDATE ON email_ip_attacks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_supreme_combo_attacks_updated_at BEFORE UPDATE ON supreme_combo_attacks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_email_infrastructure_intel_updated_at BEFORE UPDATE ON email_infrastructure_intel FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_api_endpoints_tested_updated_at BEFORE UPDATE ON api_endpoints_tested FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_cloud_service_attacks_updated_at BEFORE UPDATE ON cloud_service_attacks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_active_directory_attacks_updated_at BEFORE UPDATE ON active_directory_attacks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_web_application_attacks_updated_at BEFORE UPDATE ON web_application_attacks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_credential_vault_updated_at BEFORE UPDATE ON credential_vault FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_notification_settings_updated_at BEFORE UPDATE ON notification_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_attack_analytics_updated_at BEFORE UPDATE ON attack_analytics FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SAMPLE DATA (OPTIONAL)
-- ============================================================================

-- Sample notification settings for existing users
INSERT INTO notification_settings (user_id, email_enabled, discord_enabled)
SELECT id, TRUE, FALSE FROM users
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================================
-- PERMISSIONS (ADJUST FOR SUPABASE)
-- ============================================================================

-- Row Level Security (RLS) policies should be configured in Supabase dashboard
-- or via additional SQL scripts based on authentication requirements

COMMENT ON TABLE email_ip_attacks IS 'Email-IP penetration testing attacks tracking';
COMMENT ON TABLE supreme_combo_attacks IS 'Supreme combo script attacks with advanced features';
COMMENT ON TABLE combo_attack_results IS 'Individual results from combo attacks';
COMMENT ON TABLE email_infrastructure_intel IS 'DNS and email infrastructure intelligence';
COMMENT ON TABLE api_endpoints_tested IS 'API endpoint penetration testing results';
COMMENT ON TABLE cloud_service_attacks IS 'Cloud service credential attacks';
COMMENT ON TABLE active_directory_attacks IS 'Active Directory penetration testing';
COMMENT ON TABLE web_application_attacks IS 'Web application credential attacks';
COMMENT ON TABLE attack_analytics IS 'Aggregated attack analytics and metrics';
COMMENT ON TABLE credential_vault IS 'Centralized storage for discovered credentials';
COMMENT ON TABLE notification_settings IS 'User notification preferences and webhooks';
