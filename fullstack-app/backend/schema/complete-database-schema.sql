-- ============================================================================
-- HYDRA-TERMUX COMPLETE DATABASE SCHEMA
-- PostgreSQL / Supabase Compatible
-- Version: 2.0.0
-- Date: 2025-12-31
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE attack_status AS ENUM ('queued', 'running', 'completed', 'failed', 'cancelled');
CREATE TYPE attack_protocol AS ENUM ('ssh', 'ftp', 'http', 'https', 'rdp', 'mysql', 'postgresql', 'smb', 'telnet', 'vnc', 'smtp', 'pop3', 'imap', 'ldap');
CREATE TYPE user_role AS ENUM ('user', 'admin', 'super_admin');
CREATE TYPE log_level AS ENUM ('debug', 'info', 'warning', 'error', 'critical');

-- ============================================================================
-- USERS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role DEFAULT 'user',
    is_active BOOLEAN DEFAULT TRUE,
    is_verified BOOLEAN DEFAULT FALSE,
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    two_factor_secret VARCHAR(255),
    last_login_at TIMESTAMP,
    login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP,
    api_key VARCHAR(255) UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_api_key ON users(api_key);
CREATE INDEX idx_users_role ON users(role);

-- ============================================================================
-- TARGETS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS targets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    host VARCHAR(255) NOT NULL,
    port INTEGER,
    protocol attack_protocol,
    description TEXT,
    tags TEXT[],
    is_active BOOLEAN DEFAULT TRUE,
    last_scanned_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_targets_user_id ON targets(user_id);
CREATE INDEX idx_targets_host ON targets(host);
CREATE INDEX idx_targets_protocol ON targets(protocol);
CREATE INDEX idx_targets_tags ON targets USING GIN(tags);

-- ============================================================================
-- WORDLISTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS wordlists (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'password', 'username', 'mixed'
    file_path TEXT NOT NULL,
    file_size_bytes BIGINT,
    line_count INTEGER,
    description TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    download_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_wordlists_user_id ON wordlists(user_id);
CREATE INDEX idx_wordlists_type ON wordlists(type);
CREATE INDEX idx_wordlists_is_public ON wordlists(is_public);

-- ============================================================================
-- ATTACKS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS attacks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    target_id INTEGER REFERENCES targets(id) ON DELETE SET NULL,
    protocol attack_protocol NOT NULL,
    host VARCHAR(255) NOT NULL,
    port INTEGER NOT NULL,
    status attack_status DEFAULT 'queued',
    wordlist_id INTEGER REFERENCES wordlists(id) ON DELETE SET NULL,
    username_list TEXT,
    password_list TEXT,
    threads INTEGER DEFAULT 16,
    timeout INTEGER DEFAULT 30,
    optimization_enabled BOOLEAN DEFAULT TRUE,
    optimization_profile TEXT,
    threads_optimized INTEGER,
    timeout_optimized INTEGER,
    success_rate_category TEXT,
    credentials_found INTEGER DEFAULT 0,
    attempts_made INTEGER DEFAULT 0,
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    duration_seconds INTEGER,
    error_message TEXT,
    result_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_attacks_user_id ON attacks(user_id);
CREATE INDEX idx_attacks_target_id ON attacks(target_id);
CREATE INDEX idx_attacks_protocol ON attacks(protocol);
CREATE INDEX idx_attacks_status ON attacks(status);
CREATE INDEX idx_attacks_created_at ON attacks(created_at);
CREATE INDEX idx_attacks_optimization_enabled ON attacks(optimization_enabled);

-- ============================================================================
-- RESULTS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS results (
    id SERIAL PRIMARY KEY,
    attack_id INTEGER REFERENCES attacks(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    protocol attack_protocol NOT NULL,
    host VARCHAR(255) NOT NULL,
    port INTEGER NOT NULL,
    username VARCHAR(255) NOT NULL,
    password TEXT NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    verification_date TIMESTAMP,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_results_attack_id ON results(attack_id);
CREATE INDEX idx_results_user_id ON results(user_id);
CREATE INDEX idx_results_host ON results(host);
CREATE INDEX idx_results_protocol ON results(protocol);
CREATE INDEX idx_results_created_at ON results(created_at);

-- ============================================================================
-- LOGS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    attack_id INTEGER REFERENCES attacks(id) ON DELETE CASCADE,
    level log_level NOT NULL,
    message TEXT NOT NULL,
    details JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_logs_user_id ON logs(user_id);
CREATE INDEX idx_logs_attack_id ON logs(attack_id);
CREATE INDEX idx_logs_level ON logs(level);
CREATE INDEX idx_logs_created_at ON logs(created_at);

-- ============================================================================
-- ATTACK OPTIMIZATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS attack_optimizations (
    id SERIAL PRIMARY KEY,
    attack_id INTEGER REFERENCES attacks(id) ON DELETE CASCADE,
    protocol attack_protocol NOT NULL,
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

-- ============================================================================
-- PROTOCOL STATISTICS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS protocol_statistics (
    id SERIAL PRIMARY KEY,
    protocol attack_protocol NOT NULL UNIQUE,
    total_attacks INTEGER DEFAULT 0,
    successful_attacks INTEGER DEFAULT 0,
    failed_attacks INTEGER DEFAULT 0,
    average_duration_seconds INTEGER,
    average_threads_used INTEGER,
    average_timeout_used INTEGER,
    most_common_username TEXT,
    blank_password_successes INTEGER DEFAULT 0,
    last_attack_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_protocol_statistics_protocol ON protocol_statistics(protocol);

-- ============================================================================
-- WEBHOOKS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS webhooks (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    secret VARCHAR(255),
    events TEXT[] NOT NULL, -- ['attack.completed', 'attack.failed', 'credentials.found']
    is_active BOOLEAN DEFAULT TRUE,
    retry_count INTEGER DEFAULT 3,
    last_triggered_at TIMESTAMP,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_webhooks_user_id ON webhooks(user_id);
CREATE INDEX idx_webhooks_is_active ON webhooks(is_active);

-- ============================================================================
-- WEBHOOK LOGS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS webhook_logs (
    id SERIAL PRIMARY KEY,
    webhook_id INTEGER REFERENCES webhooks(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    response_status INTEGER,
    response_body TEXT,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_webhook_logs_webhook_id ON webhook_logs(webhook_id);
CREATE INDEX idx_webhook_logs_created_at ON webhook_logs(created_at);

-- ============================================================================
-- SESSIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

-- ============================================================================
-- REFRESH TOKENS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_targets_updated_at BEFORE UPDATE ON targets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_wordlists_updated_at BEFORE UPDATE ON wordlists FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_attacks_updated_at BEFORE UPDATE ON attacks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_attack_optimizations_updated_at BEFORE UPDATE ON attack_optimizations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_protocol_statistics_updated_at BEFORE UPDATE ON protocol_statistics FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_webhooks_updated_at BEFORE UPDATE ON webhooks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM sessions WHERE expires_at < CURRENT_TIMESTAMP;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up expired refresh tokens
CREATE OR REPLACE FUNCTION cleanup_expired_refresh_tokens()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM refresh_tokens WHERE expires_at < CURRENT_TIMESTAMP;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to update protocol statistics
CREATE OR REPLACE FUNCTION update_protocol_statistics()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.status = 'completed' THEN
        INSERT INTO protocol_statistics (protocol, total_attacks, successful_attacks, last_attack_at)
        VALUES (NEW.protocol, 1, CASE WHEN NEW.credentials_found > 0 THEN 1 ELSE 0 END, CURRENT_TIMESTAMP)
        ON CONFLICT (protocol) DO UPDATE SET
            total_attacks = protocol_statistics.total_attacks + 1,
            successful_attacks = protocol_statistics.successful_attacks + CASE WHEN NEW.credentials_found > 0 THEN 1 ELSE 0 END,
            average_duration_seconds = (COALESCE(protocol_statistics.average_duration_seconds * protocol_statistics.total_attacks, 0) + COALESCE(NEW.duration_seconds, 0)) / (protocol_statistics.total_attacks + 1),
            average_threads_used = (COALESCE(protocol_statistics.average_threads_used * protocol_statistics.total_attacks, 0) + NEW.threads) / (protocol_statistics.total_attacks + 1),
            average_timeout_used = (COALESCE(protocol_statistics.average_timeout_used * protocol_statistics.total_attacks, 0) + NEW.timeout) / (protocol_statistics.total_attacks + 1),
            last_attack_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP;
    ELSIF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.status = 'failed' THEN
        INSERT INTO protocol_statistics (protocol, total_attacks, failed_attacks, last_attack_at)
        VALUES (NEW.protocol, 1, 1, CURRENT_TIMESTAMP)
        ON CONFLICT (protocol) DO UPDATE SET
            total_attacks = protocol_statistics.total_attacks + 1,
            failed_attacks = protocol_statistics.failed_attacks + 1,
            last_attack_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_protocol_stats_trigger
AFTER INSERT OR UPDATE ON attacks
FOR EACH ROW
EXECUTE FUNCTION update_protocol_statistics();

-- ============================================================================
-- INITIAL DATA
-- ============================================================================

-- Insert default admin user (password: admin123 - CHANGE THIS!)
INSERT INTO users (username, email, password_hash, role, is_active, is_verified)
VALUES ('admin', 'admin@hydra-termux.local', '$2b$10$rZvNlFMZ8BxQmH2kqKY9.OJ9uFYM0qN2vX3GqH6kqKY9.OJ9uFYM0q', 'super_admin', TRUE, TRUE)
ON CONFLICT (username) DO NOTHING;

-- Insert initial protocol statistics
INSERT INTO protocol_statistics (protocol, total_attacks, successful_attacks, failed_attacks)
VALUES 
    ('ssh', 0, 0, 0),
    ('ftp', 0, 0, 0),
    ('http', 0, 0, 0),
    ('https', 0, 0, 0),
    ('rdp', 0, 0, 0),
    ('mysql', 0, 0, 0),
    ('postgresql', 0, 0, 0),
    ('smb', 0, 0, 0)
ON CONFLICT (protocol) DO NOTHING;

-- ============================================================================
-- VIEWS
-- ============================================================================

-- View for attack summary
CREATE OR REPLACE VIEW attack_summary AS
SELECT 
    a.id,
    a.protocol,
    a.host,
    a.port,
    a.status,
    a.credentials_found,
    a.attempts_made,
    a.duration_seconds,
    u.username AS user_username,
    t.name AS target_name,
    a.created_at,
    a.updated_at
FROM attacks a
LEFT JOIN users u ON a.user_id = u.id
LEFT JOIN targets t ON a.target_id = t.id;

-- View for user statistics
CREATE OR REPLACE VIEW user_statistics AS
SELECT 
    u.id,
    u.username,
    u.email,
    u.role,
    COUNT(DISTINCT a.id) AS total_attacks,
    COUNT(DISTINCT CASE WHEN a.status = 'completed' THEN a.id END) AS completed_attacks,
    COUNT(DISTINCT CASE WHEN a.credentials_found > 0 THEN a.id END) AS successful_attacks,
    COUNT(DISTINCT r.id) AS total_credentials_found,
    COUNT(DISTINCT t.id) AS total_targets,
    MAX(a.created_at) AS last_attack_at
FROM users u
LEFT JOIN attacks a ON u.id = a.user_id
LEFT JOIN results r ON u.id = r.user_id
LEFT JOIN targets t ON u.id = t.user_id
GROUP BY u.id, u.username, u.email, u.role;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) - For Supabase
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE targets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wordlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE attacks ENABLE ROW LEVEL SECURITY;
ALTER TABLE results ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;

-- Policies for users table
CREATE POLICY "Users can view their own data" ON users FOR SELECT USING (auth.uid()::text = id::text OR role = 'super_admin');
CREATE POLICY "Users can update their own data" ON users FOR UPDATE USING (auth.uid()::text = id::text);

-- Policies for targets table
CREATE POLICY "Users can view their own targets" ON targets FOR SELECT USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can create their own targets" ON targets FOR INSERT WITH CHECK (auth.uid()::text = user_id::text);
CREATE POLICY "Users can update their own targets" ON targets FOR UPDATE USING (auth.uid()::text = user_id::text);
CREATE POLICY "Users can delete their own targets" ON targets FOR DELETE USING (auth.uid()::text = user_id::text);

-- Similar policies for other tables...
-- (Add more policies as needed for your security requirements)

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE users IS 'User accounts with authentication and authorization';
COMMENT ON TABLE targets IS 'Target systems for attacks';
COMMENT ON TABLE wordlists IS 'Password and username wordlists';
COMMENT ON TABLE attacks IS 'Attack execution history and status';
COMMENT ON TABLE results IS 'Discovered credentials from successful attacks';
COMMENT ON TABLE logs IS 'System and attack logs';
COMMENT ON TABLE webhooks IS 'Webhook configurations for event notifications';
COMMENT ON TABLE protocol_statistics IS 'Aggregated statistics per protocol';
COMMENT ON TABLE attack_optimizations IS 'Optimization settings used per attack';

-- ============================================================================
-- COMPLETION
-- ============================================================================

-- Grant permissions (adjust as needed)
-- GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO authenticated;
-- GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO authenticated;

SELECT 'Database schema created successfully!' AS status;
