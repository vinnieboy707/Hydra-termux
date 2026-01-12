-- ============================================================================
-- HYDRA-TERMUX ENHANCED DATABASE SCHEMA
-- PostgreSQL / Supabase Compatible
-- Version: 3.0.0 - ALHacking & AI Assistant Support
-- Date: 2026-01-11
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements"; -- Performance monitoring

-- ============================================================================
-- NEW ENUMS FOR ALHACKING & AI
-- ============================================================================

CREATE TYPE alhacking_tool AS ENUM (
    'phishing', 'webcam', 'subscan', 'gmail_bomber', 'ddos',
    'ip_info', 'dorks_eye', 'hacker_pro', 'red_hawk', 'virus_crafter',
    'info_site', 'bad_mod', 'facebash', 'darkarmy', 'auto_ip_changer'
);

CREATE TYPE tool_action AS ENUM ('started', 'completed', 'failed', 'cancelled');
CREATE TYPE ai_interaction_type AS ENUM ('hint', 'workflow', 'help', 'suggestion', 'progress');
CREATE TYPE user_experience_level AS ENUM ('beginner', 'intermediate', 'advanced', 'expert');

-- ============================================================================
-- ALHACKING EVENTS TABLE
-- Tracks usage of ALHacking tools
-- ============================================================================

CREATE TABLE IF NOT EXISTS alhacking_events (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tool alhacking_tool NOT NULL,
    action tool_action NOT NULL,
    target VARCHAR(500),
    results JSONB,
    duration_seconds INTEGER,
    error_message TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    ip_address INET,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_alhacking_events_user_id (user_id),
    INDEX idx_alhacking_events_tool (tool),
    INDEX idx_alhacking_events_action (action),
    INDEX idx_alhacking_events_created (created_at DESC)
);

COMMENT ON TABLE alhacking_events IS 'Tracks all ALHacking tool usage events';
COMMENT ON COLUMN alhacking_events.results IS 'JSON storage for tool-specific results';

-- ============================================================================
-- USER ALHACKING STATISTICS TABLE
-- Aggregated stats per user per tool
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_alhacking_stats (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tool alhacking_tool NOT NULL,
    total_uses INTEGER DEFAULT 0,
    successful_runs INTEGER DEFAULT 0,
    failed_runs INTEGER DEFAULT 0,
    total_targets_scanned INTEGER DEFAULT 0,
    first_used TIMESTAMP,
    last_used TIMESTAMP,
    average_duration_seconds DECIMAL(10,2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, tool),
    INDEX idx_user_alhacking_stats_user (user_id),
    INDEX idx_user_alhacking_stats_tool (tool)
);

COMMENT ON TABLE user_alhacking_stats IS 'Aggregated statistics for ALHacking tool usage per user';

-- ============================================================================
-- AI ASSISTANT ANALYTICS TABLE
-- Tracks AI assistant interactions
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_assistant_analytics (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    interaction_type ai_interaction_type NOT NULL,
    context VARCHAR(255) NOT NULL,
    user_level user_experience_level NOT NULL,
    helpful BOOLEAN,
    action_taken VARCHAR(255),
    metadata JSONB DEFAULT '{}'::jsonb,
    session_id UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_ai_analytics_user_id (user_id),
    INDEX idx_ai_analytics_type (interaction_type),
    INDEX idx_ai_analytics_context (context),
    INDEX idx_ai_analytics_created (created_at DESC)
);

COMMENT ON TABLE ai_assistant_analytics IS 'Tracks AI assistant usage and effectiveness';
COMMENT ON COLUMN ai_assistant_analytics.helpful IS 'User feedback on whether the hint/suggestion was helpful';

-- ============================================================================
-- USER AI STATISTICS TABLE
-- Aggregated AI interaction stats per user
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_ai_stats (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    total_interactions INTEGER DEFAULT 0,
    helpful_interactions INTEGER DEFAULT 0,
    unhelpful_interactions INTEGER DEFAULT 0,
    beginner_interactions INTEGER DEFAULT 0,
    intermediate_interactions INTEGER DEFAULT 0,
    advanced_interactions INTEGER DEFAULT 0,
    expert_interactions INTEGER DEFAULT 0,
    first_interaction TIMESTAMP,
    last_interaction TIMESTAMP,
    current_level user_experience_level DEFAULT 'beginner',
    level_updated_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_ai_stats_level (current_level)
);

COMMENT ON TABLE user_ai_stats IS 'Aggregated AI assistant interaction statistics per user';

-- ============================================================================
-- USER PROGRESS MILESTONES TABLE
-- Tracks user achievements and progress
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_progress_milestones (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    milestone_type VARCHAR(100) NOT NULL,
    milestone_name VARCHAR(255) NOT NULL,
    description TEXT,
    achieved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB DEFAULT '{}'::jsonb,
    INDEX idx_milestones_user_id (user_id),
    INDEX idx_milestones_type (milestone_type),
    UNIQUE(user_id, milestone_name)
);

COMMENT ON TABLE user_progress_milestones IS 'Tracks user achievements and progress milestones';

-- ============================================================================
-- WORKFLOW EXECUTIONS TABLE
-- Tracks guided workflow completions
-- ============================================================================

CREATE TABLE IF NOT EXISTS workflow_executions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workflow_name VARCHAR(255) NOT NULL,
    workflow_type VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'in_progress',
    steps_completed INTEGER DEFAULT 0,
    total_steps INTEGER NOT NULL,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    duration_seconds INTEGER,
    success_rate DECIMAL(5,2),
    results JSONB,
    INDEX idx_workflow_user_id (user_id),
    INDEX idx_workflow_name (workflow_name),
    INDEX idx_workflow_status (status)
);

COMMENT ON TABLE workflow_executions IS 'Tracks user completion of guided workflows';

-- ============================================================================
-- SYSTEM PERFORMANCE METRICS TABLE
-- Tracks system performance and optimization metrics
-- ============================================================================

CREATE TABLE IF NOT EXISTS system_performance_metrics (
    id SERIAL PRIMARY KEY,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(15,4) NOT NULL,
    metric_unit VARCHAR(50),
    component VARCHAR(100),
    host_info JSONB,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_perf_metrics_name (metric_name),
    INDEX idx_perf_metrics_component (component),
    INDEX idx_perf_metrics_recorded (recorded_at DESC)
);

COMMENT ON TABLE system_performance_metrics IS 'Stores system performance metrics for monitoring and optimization';

-- ============================================================================
-- OPTIMIZATION HISTORY TABLE
-- Tracks system optimization changes
-- ============================================================================

CREATE TABLE IF NOT EXISTS optimization_history (
    id SERIAL PRIMARY KEY,
    optimization_type VARCHAR(100) NOT NULL,
    component VARCHAR(100) NOT NULL,
    old_value JSONB,
    new_value JSONB,
    performance_impact JSONB,
    applied_by VARCHAR(255),
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_optimization_type (optimization_type),
    INDEX idx_optimization_component (component),
    INDEX idx_optimization_applied (applied_at DESC)
);

COMMENT ON TABLE optimization_history IS 'Tracks all system optimizations for audit and rollback';

-- ============================================================================
-- TRIGGERS FOR AUTO-UPDATE timestamps
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to relevant tables
CREATE TRIGGER update_user_alhacking_stats_updated_at
    BEFORE UPDATE ON user_alhacking_stats
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_ai_stats_updated_at
    BEFORE UPDATE ON user_ai_stats
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- AUTO-LEVEL PROGRESSION FUNCTION
-- Automatically updates user experience level based on interactions
-- ============================================================================

CREATE OR REPLACE FUNCTION auto_update_user_level()
RETURNS TRIGGER AS $$
DECLARE
    new_level user_experience_level;
    total_actions INTEGER;
BEGIN
    -- Calculate total actions
    total_actions := NEW.total_interactions;
    
    -- Determine level based on total interactions
    IF total_actions < 5 THEN
        new_level := 'beginner';
    ELSIF total_actions < 20 THEN
        new_level := 'intermediate';
    ELSIF total_actions < 100 THEN
        new_level := 'advanced';
    ELSE
        new_level := 'expert';
    END IF;
    
    -- Update if level changed
    IF NEW.current_level IS DISTINCT FROM new_level THEN
        NEW.current_level := new_level;
        NEW.level_updated_at := CURRENT_TIMESTAMP;
        
        -- Insert milestone
        INSERT INTO user_progress_milestones (user_id, milestone_type, milestone_name, description)
        VALUES (
            NEW.user_id,
            'level_progression',
            'Level Up: ' || new_level::text,
            'Progressed to ' || new_level::text || ' level with ' || total_actions || ' interactions'
        )
        ON CONFLICT (user_id, milestone_name) DO NOTHING;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_update_user_level
    BEFORE UPDATE ON user_ai_stats
    FOR EACH ROW
    EXECUTE FUNCTION auto_update_user_level();

-- ============================================================================
-- PERFORMANCE INDEXES
-- Additional indexes for query optimization
-- ============================================================================

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_alhacking_events_user_tool_date 
    ON alhacking_events(user_id, tool, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_analytics_user_level_date 
    ON ai_assistant_analytics(user_id, user_level, created_at DESC);

-- Partial indexes for active/recent data
CREATE INDEX IF NOT EXISTS idx_recent_alhacking_events 
    ON alhacking_events(created_at DESC) 
    WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '30 days';

CREATE INDEX IF NOT EXISTS idx_recent_ai_analytics 
    ON ai_assistant_analytics(created_at DESC) 
    WHERE created_at > CURRENT_TIMESTAMP - INTERVAL '30 days';

-- ============================================================================
-- MATERIALIZED VIEWS FOR ANALYTICS
-- Pre-computed analytics for dashboard performance
-- ============================================================================

-- Tool usage summary
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_tool_usage_summary AS
SELECT 
    tool,
    COUNT(*) as total_uses,
    COUNT(DISTINCT user_id) as unique_users,
    AVG(duration_seconds) as avg_duration,
    SUM(CASE WHEN action = 'completed' THEN 1 ELSE 0 END) as successful_runs,
    SUM(CASE WHEN action = 'failed' THEN 1 ELSE 0 END) as failed_runs,
    MAX(created_at) as last_used
FROM alhacking_events
GROUP BY tool;

CREATE UNIQUE INDEX ON mv_tool_usage_summary(tool);

-- AI effectiveness summary
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_ai_effectiveness_summary AS
SELECT 
    interaction_type,
    context,
    user_level,
    COUNT(*) as total_interactions,
    SUM(CASE WHEN helpful = true THEN 1 ELSE 0 END) as helpful_count,
    SUM(CASE WHEN helpful = false THEN 1 ELSE 0 END) as unhelpful_count,
    ROUND(
        100.0 * SUM(CASE WHEN helpful = true THEN 1 ELSE 0 END) / 
        NULLIF(SUM(CASE WHEN helpful IS NOT NULL THEN 1 ELSE 0 END), 0),
        2
    ) as helpful_percentage
FROM ai_assistant_analytics
GROUP BY interaction_type, context, user_level;

CREATE INDEX ON mv_ai_effectiveness_summary(interaction_type, context);

-- Refresh functions (call periodically or via cron)
CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_tool_usage_summary;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_ai_effectiveness_summary;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- CLEANUP FUNCTIONS
-- Automated data retention management
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_old_analytics(days_to_keep INTEGER DEFAULT 90)
RETURNS TABLE(deleted_events INTEGER, deleted_analytics INTEGER) AS $$
DECLARE
    del_events INTEGER;
    del_analytics INTEGER;
BEGIN
    -- Delete old ALHacking events
    DELETE FROM alhacking_events 
    WHERE created_at < CURRENT_TIMESTAMP - (days_to_keep || ' days')::INTERVAL;
    GET DIAGNOSTICS del_events = ROW_COUNT;
    
    -- Delete old AI analytics
    DELETE FROM ai_assistant_analytics 
    WHERE created_at < CURRENT_TIMESTAMP - (days_to_keep || ' days')::INTERVAL;
    GET DIAGNOSTICS del_analytics = ROW_COUNT;
    
    deleted_events := del_events;
    deleted_analytics := del_analytics;
    
    RETURN NEXT;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- GRANT PERMISSIONS (Supabase specific)
-- ============================================================================

-- Grant appropriate permissions for authenticated users
GRANT SELECT, INSERT ON alhacking_events TO authenticated;
GRANT SELECT ON user_alhacking_stats TO authenticated;
GRANT SELECT, INSERT ON ai_assistant_analytics TO authenticated;
GRANT SELECT ON user_ai_stats TO authenticated;
GRANT SELECT ON user_progress_milestones TO authenticated;
GRANT SELECT, INSERT, UPDATE ON workflow_executions TO authenticated;
GRANT SELECT ON system_performance_metrics TO authenticated;

-- Service role has full access
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================

-- Add helpful comments
COMMENT ON DATABASE current_database() IS 'Hydra-Termux v3.0.0 - Enhanced with ALHacking & AI Assistant support';

-- Log schema version
INSERT INTO optimization_history (optimization_type, component, new_value, applied_by)
VALUES (
    'schema_update',
    'database',
    jsonb_build_object(
        'version', '3.0.0',
        'features', jsonb_build_array(
            'alhacking_events',
            'ai_assistant_analytics',
            'user_progress_tracking',
            'workflow_executions',
            'performance_metrics',
            'auto_level_progression'
        )
    ),
    'system_optimizer'
);
