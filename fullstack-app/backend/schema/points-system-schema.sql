-- ============================================================================
-- COMPREHENSIVE POINTS & REWARDS SYSTEM SCHEMA
-- Version: 3.0
-- Description: Advanced gamification, achievements, leaderboards, and rewards
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For fuzzy search

-- ============================================================================
-- USER POINTS TABLE
-- Tracks total points and current balance for each user
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_points (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    total_points_earned BIGINT DEFAULT 0 NOT NULL,
    current_balance BIGINT DEFAULT 0 NOT NULL,
    points_spent BIGINT DEFAULT 0 NOT NULL,
    lifetime_rank INTEGER,
    current_rank INTEGER,
    rank_percentile DECIMAL(5,2),
    streak_days INTEGER DEFAULT 0,
    last_activity_date DATE,
    multiplier DECIMAL(3,2) DEFAULT 1.00,
    bonus_expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_points UNIQUE(user_id),
    CONSTRAINT positive_points CHECK (current_balance >= 0),
    CONSTRAINT valid_multiplier CHECK (multiplier >= 0.1 AND multiplier <= 10.0)
);

CREATE INDEX idx_user_points_user_id ON user_points(user_id);
CREATE INDEX idx_user_points_total_earned ON user_points(total_points_earned DESC);
CREATE INDEX idx_user_points_current_balance ON user_points(current_balance DESC);
CREATE INDEX idx_user_points_current_rank ON user_points(current_rank);
CREATE INDEX idx_user_points_streak ON user_points(streak_days DESC);

-- ============================================================================
-- POINT TRANSACTIONS TABLE
-- Detailed history of all point-related transactions
-- ============================================================================
CREATE TABLE IF NOT EXISTS point_transactions (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    transaction_type VARCHAR(50) NOT NULL, -- 'earn', 'spend', 'bonus', 'refund', 'expire', 'admin_adjustment'
    amount BIGINT NOT NULL,
    balance_after BIGINT NOT NULL,
    reason VARCHAR(100) NOT NULL, -- 'attack_completed', 'achievement_unlocked', 'daily_login', etc.
    reference_type VARCHAR(50), -- 'attack', 'achievement', 'purchase', etc.
    reference_id INTEGER,
    metadata JSONB DEFAULT '{}',
    multiplier_applied DECIMAL(3,2) DEFAULT 1.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    is_expired BOOLEAN DEFAULT FALSE,
    CONSTRAINT valid_transaction_type CHECK (transaction_type IN ('earn', 'spend', 'bonus', 'refund', 'expire', 'admin_adjustment'))
);

CREATE INDEX idx_point_transactions_user_id ON point_transactions(user_id);
CREATE INDEX idx_point_transactions_created_at ON point_transactions(created_at DESC);
CREATE INDEX idx_point_transactions_type ON point_transactions(transaction_type);
CREATE INDEX idx_point_transactions_reference ON point_transactions(reference_type, reference_id);
CREATE INDEX idx_point_transactions_expires_at ON point_transactions(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_point_transactions_metadata ON point_transactions USING GIN (metadata);

-- ============================================================================
-- ACHIEVEMENTS TABLE
-- Define available achievements users can unlock
-- ============================================================================
CREATE TABLE IF NOT EXISTS achievements (
    id SERIAL PRIMARY KEY,
    code VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL, -- 'attack', 'discovery', 'social', 'streak', 'special'
    tier VARCHAR(20) DEFAULT 'bronze', -- 'bronze', 'silver', 'gold', 'platinum', 'diamond'
    icon_url TEXT,
    points_reward INTEGER NOT NULL DEFAULT 0,
    requirements JSONB NOT NULL, -- Conditions to unlock
    is_secret BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_tier CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum', 'diamond'))
);

CREATE INDEX idx_achievements_category ON achievements(category);
CREATE INDEX idx_achievements_tier ON achievements(tier);
CREATE INDEX idx_achievements_active ON achievements(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_achievements_requirements ON achievements USING GIN (requirements);

-- Insert default achievements
INSERT INTO achievements (code, name, description, category, tier, points_reward, requirements) VALUES
('first_blood', 'First Blood', 'Complete your first attack', 'attack', 'bronze', 100, '{"attacks_completed": 1}'),
('century', 'Century', 'Complete 100 attacks', 'attack', 'silver', 1000, '{"attacks_completed": 100}'),
('millenium', 'Millennium', 'Complete 1000 attacks', 'attack', 'gold', 10000, '{"attacks_completed": 1000}'),
('key_finder', 'Key Finder', 'Discover your first credential', 'discovery', 'bronze', 200, '{"credentials_found": 1}'),
('treasure_hunter', 'Treasure Hunter', 'Discover 100 credentials', 'discovery', 'silver', 2000, '{"credentials_found": 100}'),
('vault_breaker', 'Vault Breaker', 'Discover 1000 credentials', 'discovery', 'gold', 20000, '{"credentials_found": 1000}'),
('week_warrior', 'Week Warrior', 'Maintain a 7-day streak', 'streak', 'silver', 500, '{"streak_days": 7}'),
('month_master', 'Month Master', 'Maintain a 30-day streak', 'streak', 'gold', 3000, '{"streak_days": 30}'),
('protocol_master', 'Protocol Master', 'Successfully attack using 5 different protocols', 'special', 'silver', 1500, '{"unique_protocols": 5}'),
('speed_demon', 'Speed Demon', 'Complete an attack in under 10 seconds', 'special', 'gold', 5000, '{"attack_duration_under": 10}'),
('night_owl', 'Night Owl', 'Complete 50 attacks between midnight and 6am', 'special', 'silver', 1000, '{"night_attacks": 50}'),
('perfect_week', 'Perfect Week', 'Complete attacks every day for 7 days', 'streak', 'gold', 2500, '{"consecutive_days": 7}')
ON CONFLICT (code) DO NOTHING;

-- ============================================================================
-- USER ACHIEVEMENTS TABLE
-- Track which achievements users have unlocked
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_achievements (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    achievement_id INTEGER NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
    progress JSONB DEFAULT '{}',
    progress_percentage INTEGER DEFAULT 0,
    unlocked_at TIMESTAMP,
    is_unlocked BOOLEAN DEFAULT FALSE,
    notified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_user_achievement UNIQUE(user_id, achievement_id),
    CONSTRAINT valid_progress_percentage CHECK (progress_percentage >= 0 AND progress_percentage <= 100)
);

CREATE INDEX idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX idx_user_achievements_achievement_id ON user_achievements(achievement_id);
CREATE INDEX idx_user_achievements_unlocked ON user_achievements(unlocked_at DESC) WHERE is_unlocked = TRUE;
CREATE INDEX idx_user_achievements_progress ON user_achievements USING GIN (progress);

-- ============================================================================
-- LEADERBOARDS TABLE
-- Different types of leaderboards (all-time, monthly, weekly, protocol-specific)
-- ============================================================================
CREATE TABLE IF NOT EXISTS leaderboards (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'all_time', 'monthly', 'weekly', 'daily', 'protocol'
    description TEXT,
    metric VARCHAR(50) NOT NULL, -- 'total_points', 'attacks_completed', 'credentials_found'
    filter_criteria JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    reset_frequency VARCHAR(20), -- 'daily', 'weekly', 'monthly', 'never'
    last_reset_at TIMESTAMP,
    next_reset_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_leaderboard_name UNIQUE(name),
    CONSTRAINT valid_reset_frequency CHECK (reset_frequency IN ('daily', 'weekly', 'monthly', 'never'))
);

CREATE INDEX idx_leaderboards_type ON leaderboards(type);
CREATE INDEX idx_leaderboards_active ON leaderboards(is_active) WHERE is_active = TRUE;

-- Insert default leaderboards
INSERT INTO leaderboards (name, type, description, metric, reset_frequency) VALUES
('All-Time Champions', 'all_time', 'Top users by lifetime points earned', 'total_points', 'never'),
('Monthly Masters', 'monthly', 'Top users this month', 'total_points', 'monthly'),
('Weekly Warriors', 'weekly', 'Top users this week', 'total_points', 'weekly'),
('Daily Dominators', 'daily', 'Top users today', 'total_points', 'daily'),
('Attack Leaders', 'all_time', 'Most attacks completed', 'attacks_completed', 'never'),
('Credential Champions', 'all_time', 'Most credentials discovered', 'credentials_found', 'never')
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- LEADERBOARD ENTRIES TABLE
-- Track user positions in different leaderboards with historical data
-- ============================================================================
CREATE TABLE IF NOT EXISTS leaderboard_entries (
    id BIGSERIAL PRIMARY KEY,
    leaderboard_id INTEGER NOT NULL REFERENCES leaderboards(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rank INTEGER NOT NULL,
    score BIGINT NOT NULL,
    previous_rank INTEGER,
    rank_change INTEGER DEFAULT 0, -- Positive = moved up, Negative = moved down
    percentile DECIMAL(5,2),
    snapshot_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_rank CHECK (rank > 0),
    CONSTRAINT valid_score CHECK (score >= 0)
);

CREATE INDEX idx_leaderboard_entries_leaderboard ON leaderboard_entries(leaderboard_id, rank);
CREATE INDEX idx_leaderboard_entries_user ON leaderboard_entries(user_id, leaderboard_id);
CREATE INDEX idx_leaderboard_entries_score ON leaderboard_entries(score DESC);
CREATE INDEX idx_leaderboard_entries_date ON leaderboard_entries(snapshot_date DESC);
CREATE UNIQUE INDEX idx_leaderboard_entries_unique ON leaderboard_entries(leaderboard_id, user_id, snapshot_date);

-- ============================================================================
-- POINT MULTIPLIERS TABLE
-- Track active multiplier campaigns and bonuses
-- ============================================================================
CREATE TABLE IF NOT EXISTS point_multipliers (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    multiplier DECIMAL(3,2) NOT NULL,
    applies_to VARCHAR(50), -- 'all', 'attack', 'discovery', 'achievement'
    user_id INTEGER REFERENCES users(id), -- NULL means applies to all users
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    conditions JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_multiplier_value CHECK (multiplier >= 1.0 AND multiplier <= 10.0),
    CONSTRAINT valid_date_range CHECK (end_date > start_date)
);

CREATE INDEX idx_point_multipliers_active ON point_multipliers(is_active, start_date, end_date);
CREATE INDEX idx_point_multipliers_user ON point_multipliers(user_id);
CREATE INDEX idx_point_multipliers_applies_to ON point_multipliers(applies_to);

-- ============================================================================
-- POINT REWARDS TABLE
-- Define point rewards for different actions
-- ============================================================================
CREATE TABLE IF NOT EXISTS point_rewards (
    id SERIAL PRIMARY KEY,
    action VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    base_points INTEGER NOT NULL,
    requires_success BOOLEAN DEFAULT TRUE,
    cooldown_minutes INTEGER DEFAULT 0, -- Prevent spam
    daily_limit INTEGER, -- Max times per day
    is_active BOOLEAN DEFAULT TRUE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT positive_base_points CHECK (base_points > 0)
);

CREATE INDEX idx_point_rewards_action ON point_rewards(action);
CREATE INDEX idx_point_rewards_active ON point_rewards(is_active) WHERE is_active = TRUE;

-- Insert default point rewards
INSERT INTO point_rewards (action, description, base_points, requires_success, cooldown_minutes, daily_limit) VALUES
('attack_completed', 'Complete an attack successfully', 50, TRUE, 0, NULL),
('attack_failed', 'Attempted an attack', 5, FALSE, 0, NULL),
('credential_found', 'Discover a valid credential', 100, TRUE, 0, NULL),
('daily_login', 'Log in once per day', 10, TRUE, 1440, 1),
('first_attack_of_day', 'Complete first attack of the day', 20, TRUE, 1440, 1),
('consecutive_day_streak', 'Maintain daily streak (per day)', 5, TRUE, 0, NULL),
('target_added', 'Add a new target', 15, TRUE, 5, 50),
('wordlist_uploaded', 'Upload a wordlist', 25, TRUE, 10, 20),
('referral_signup', 'Refer a new user', 500, TRUE, 0, NULL),
('profile_completed', 'Complete user profile', 50, TRUE, 0, 1),
('webhook_configured', 'Set up a webhook', 30, TRUE, 0, 10)
ON CONFLICT (action) DO NOTHING;

-- ============================================================================
-- WEBHOOK EVENTS EXTENDED TABLE
-- Track all webhook-related events including point transactions
-- ============================================================================
CREATE TABLE IF NOT EXISTS webhook_events_extended (
    id BIGSERIAL PRIMARY KEY,
    webhook_id INTEGER REFERENCES webhooks(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    event_data JSONB NOT NULL,
    delivery_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'delivered', 'failed', 'retrying'
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 5,
    next_retry_at TIMESTAMP,
    delivered_at TIMESTAMP,
    response_code INTEGER,
    response_body TEXT,
    error_message TEXT,
    signature VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_delivery_status CHECK (delivery_status IN ('pending', 'delivered', 'failed', 'retrying'))
);

CREATE INDEX idx_webhook_events_extended_webhook ON webhook_events_extended(webhook_id);
CREATE INDEX idx_webhook_events_extended_user ON webhook_events_extended(user_id);
CREATE INDEX idx_webhook_events_extended_status ON webhook_events_extended(delivery_status);
CREATE INDEX idx_webhook_events_extended_type ON webhook_events_extended(event_type);
CREATE INDEX idx_webhook_events_extended_retry ON webhook_events_extended(next_retry_at) WHERE delivery_status = 'retrying';
CREATE INDEX idx_webhook_events_extended_data ON webhook_events_extended USING GIN (event_data);

-- ============================================================================
-- MATERIALIZED VIEWS FOR PERFORMANCE
-- Pre-computed views for fast leaderboard access
-- ============================================================================

-- All-time leaderboard
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_leaderboard_alltime AS
SELECT 
    ROW_NUMBER() OVER (ORDER BY total_points_earned DESC) as rank,
    u.id as user_id,
    u.username,
    u.email,
    up.total_points_earned as score,
    up.current_balance,
    up.streak_days,
    PERCENT_RANK() OVER (ORDER BY total_points_earned DESC) * 100 as percentile,
    up.updated_at
FROM user_points up
JOIN users u ON u.id = up.user_id
ORDER BY total_points_earned DESC
LIMIT 1000;

CREATE UNIQUE INDEX idx_mv_leaderboard_alltime_rank ON mv_leaderboard_alltime(rank);
CREATE INDEX idx_mv_leaderboard_alltime_user ON mv_leaderboard_alltime(user_id);

-- Monthly leaderboard
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_leaderboard_monthly AS
SELECT 
    ROW_NUMBER() OVER (ORDER BY SUM(pt.amount) DESC) as rank,
    u.id as user_id,
    u.username,
    u.email,
    SUM(pt.amount) as score,
    COUNT(pt.id) as transactions_count,
    MAX(pt.created_at) as last_activity
FROM point_transactions pt
JOIN users u ON u.id = pt.user_id
WHERE pt.created_at >= DATE_TRUNC('month', CURRENT_TIMESTAMP)
  AND pt.transaction_type = 'earn'
GROUP BY u.id, u.username, u.email
ORDER BY score DESC
LIMIT 1000;

CREATE UNIQUE INDEX idx_mv_leaderboard_monthly_rank ON mv_leaderboard_monthly(rank);
CREATE INDEX idx_mv_leaderboard_monthly_user ON mv_leaderboard_monthly(user_id);

-- ============================================================================
-- FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function to update user points
CREATE OR REPLACE FUNCTION update_user_points()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.transaction_type IN ('earn', 'bonus', 'refund') THEN
        UPDATE user_points 
        SET current_balance = current_balance + NEW.amount,
            total_points_earned = total_points_earned + NEW.amount,
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = NEW.user_id;
    ELSIF NEW.transaction_type = 'spend' THEN
        UPDATE user_points 
        SET current_balance = current_balance - ABS(NEW.amount),
            points_spent = points_spent + ABS(NEW.amount),
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = NEW.user_id;
    ELSIF NEW.transaction_type = 'expire' THEN
        UPDATE user_points 
        SET current_balance = current_balance - ABS(NEW.amount),
            updated_at = CURRENT_TIMESTAMP
        WHERE user_id = NEW.user_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_points
    AFTER INSERT ON point_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_user_points();

-- Function to initialize user points
CREATE OR REPLACE FUNCTION initialize_user_points()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO user_points (user_id, total_points_earned, current_balance)
    VALUES (NEW.id, 0, 0)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_initialize_user_points
    AFTER INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION initialize_user_points();

-- Function to update user streaks
CREATE OR REPLACE FUNCTION update_user_streak()
RETURNS TRIGGER AS $$
DECLARE
    last_activity DATE;
    current_streak INTEGER;
BEGIN
    SELECT last_activity_date, streak_days INTO last_activity, current_streak
    FROM user_points WHERE user_id = NEW.user_id;
    
    IF last_activity IS NULL OR last_activity < CURRENT_DATE - INTERVAL '1 day' THEN
        -- Reset streak if more than 1 day gap
        UPDATE user_points 
        SET streak_days = CASE 
            WHEN last_activity = CURRENT_DATE - INTERVAL '1 day' THEN streak_days + 1
            ELSE 1
        END,
        last_activity_date = CURRENT_DATE
        WHERE user_id = NEW.user_id;
    ELSIF last_activity = CURRENT_DATE THEN
        -- Same day, just update last_activity
        UPDATE user_points 
        SET last_activity_date = CURRENT_DATE
        WHERE user_id = NEW.user_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_streak
    AFTER INSERT ON point_transactions
    FOR EACH ROW
    WHEN (NEW.transaction_type = 'earn')
    EXECUTE FUNCTION update_user_streak();

-- Function to check and award achievements
CREATE OR REPLACE FUNCTION check_achievements(p_user_id INTEGER)
RETURNS void AS $$
DECLARE
    achievement RECORD;
    user_stats JSONB;
    is_completed BOOLEAN;
BEGIN
    -- Build user stats
    SELECT jsonb_build_object(
        'attacks_completed', COUNT(DISTINCT a.id),
        'credentials_found', COUNT(DISTINCT r.id),
        'unique_protocols', COUNT(DISTINCT a.protocol),
        'streak_days', up.streak_days
    ) INTO user_stats
    FROM users u
    LEFT JOIN attacks a ON a.user_id = u.id AND a.status = 'completed'
    LEFT JOIN results r ON r.attack_id = a.id
    LEFT JOIN user_points up ON up.user_id = u.id
    WHERE u.id = p_user_id
    GROUP BY u.id, up.streak_days;
    
    -- Check each achievement
    FOR achievement IN 
        SELECT * FROM achievements WHERE is_active = TRUE
    LOOP
        -- Simple requirement checking (can be expanded)
        is_completed := TRUE;
        
        -- Check if already unlocked
        IF EXISTS (
            SELECT 1 FROM user_achievements 
            WHERE user_id = p_user_id 
            AND achievement_id = achievement.id 
            AND is_unlocked = TRUE
        ) THEN
            CONTINUE;
        END IF;
        
        -- Award achievement if completed
        IF is_completed THEN
            INSERT INTO user_achievements (user_id, achievement_id, is_unlocked, unlocked_at, progress_percentage)
            VALUES (p_user_id, achievement.id, TRUE, CURRENT_TIMESTAMP, 100)
            ON CONFLICT (user_id, achievement_id) 
            DO UPDATE SET 
                is_unlocked = TRUE,
                unlocked_at = CURRENT_TIMESTAMP,
                progress_percentage = 100;
            
            -- Award points
            INSERT INTO point_transactions (user_id, transaction_type, amount, balance_after, reason, reference_type, reference_id)
            SELECT p_user_id, 'earn', achievement.points_reward, 
                   (SELECT current_balance FROM user_points WHERE user_id = p_user_id) + achievement.points_reward,
                   'achievement_unlocked',
                   'achievement',
                   achievement.id;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Function to refresh leaderboard materialized views
CREATE OR REPLACE FUNCTION refresh_leaderboards()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_leaderboard_alltime;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_leaderboard_monthly;
END;
$$ LANGUAGE plpgsql;

-- Function to award points for actions
CREATE OR REPLACE FUNCTION award_points(
    p_user_id INTEGER,
    p_action VARCHAR(100),
    p_reference_type VARCHAR(50) DEFAULT NULL,
    p_reference_id INTEGER DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS BIGINT AS $$
DECLARE
    reward RECORD;
    final_points BIGINT;
    multiplier DECIMAL(3,2);
    new_balance BIGINT;
BEGIN
    -- Get reward configuration
    SELECT * INTO reward FROM point_rewards 
    WHERE action = p_action AND is_active = TRUE;
    
    IF reward IS NULL THEN
        RAISE EXCEPTION 'Invalid or inactive action: %', p_action;
    END IF;
    
    -- Get active multiplier
    SELECT COALESCE(MAX(pm.multiplier), 1.0) INTO multiplier
    FROM point_multipliers pm
    WHERE pm.is_active = TRUE
    AND pm.start_date <= CURRENT_TIMESTAMP
    AND pm.end_date >= CURRENT_TIMESTAMP
    AND (pm.user_id IS NULL OR pm.user_id = p_user_id)
    AND (pm.applies_to = 'all' OR pm.applies_to = p_reference_type);
    
    -- Calculate final points
    final_points := FLOOR(reward.base_points * multiplier);
    
    -- Get current balance
    SELECT current_balance INTO new_balance FROM user_points WHERE user_id = p_user_id;
    new_balance := new_balance + final_points;
    
    -- Create transaction
    INSERT INTO point_transactions (
        user_id, transaction_type, amount, balance_after, reason, 
        reference_type, reference_id, metadata, multiplier_applied
    ) VALUES (
        p_user_id, 'earn', final_points, new_balance, p_action,
        p_reference_type, p_reference_id, p_metadata, multiplier
    );
    
    RETURN final_points;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE user_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE point_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboard_entries ENABLE ROW LEVEL SECURITY;

-- Users can see their own data
CREATE POLICY user_points_select_own ON user_points FOR SELECT USING (user_id = current_user_id());
CREATE POLICY point_transactions_select_own ON point_transactions FOR SELECT USING (user_id = current_user_id());
CREATE POLICY user_achievements_select_own ON user_achievements FOR SELECT USING (user_id = current_user_id());

-- Everyone can view leaderboards (read-only)
CREATE POLICY leaderboard_entries_select_all ON leaderboard_entries FOR SELECT TO public USING (true);

-- Admins can see and modify everything
CREATE POLICY admin_all_access ON user_points FOR ALL USING (is_admin());
CREATE POLICY admin_transactions_all ON point_transactions FOR ALL USING (is_admin());
CREATE POLICY admin_achievements_all ON user_achievements FOR ALL USING (is_admin());

-- Helper function for current user ID (implement based on your auth system)
CREATE OR REPLACE FUNCTION current_user_id()
RETURNS INTEGER AS $$
BEGIN
    RETURN NULLIF(current_setting('app.current_user_id', TRUE), '')::INTEGER;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN COALESCE(current_setting('app.is_admin', TRUE), 'false')::BOOLEAN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PERFORMANCE OPTIMIZATION INDEXES
-- ============================================================================

-- Composite indexes for common queries
CREATE INDEX idx_point_transactions_user_date ON point_transactions(user_id, created_at DESC);
CREATE INDEX idx_point_transactions_type_date ON point_transactions(transaction_type, created_at DESC);
CREATE INDEX idx_user_achievements_user_unlocked ON user_achievements(user_id, is_unlocked) WHERE is_unlocked = TRUE;

-- Partial indexes for active records
CREATE INDEX idx_achievements_active_category ON achievements(category) WHERE is_active = TRUE;
CREATE INDEX idx_point_multipliers_active_dates ON point_multipliers(start_date, end_date) WHERE is_active = TRUE;

-- GIN indexes for JSONB columns
CREATE INDEX idx_achievements_requirements_gin ON achievements USING GIN (requirements jsonb_path_ops);
CREATE INDEX idx_point_transactions_metadata_gin ON point_transactions USING GIN (metadata jsonb_path_ops);

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE user_points IS 'Stores total and current point balances for users with ranking information';
COMMENT ON TABLE point_transactions IS 'Complete audit trail of all point-related transactions';
COMMENT ON TABLE achievements IS 'Defines available achievements users can unlock';
COMMENT ON TABLE user_achievements IS 'Tracks achievement progress and unlocks for each user';
COMMENT ON TABLE leaderboards IS 'Configuration for different leaderboard types';
COMMENT ON TABLE leaderboard_entries IS 'Historical leaderboard positions and rankings';
COMMENT ON TABLE point_multipliers IS 'Active point multiplier campaigns and bonuses';
COMMENT ON TABLE point_rewards IS 'Base point rewards for different user actions';
COMMENT ON TABLE webhook_events_extended IS 'Extended webhook event tracking with retry logic';

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant appropriate permissions (adjust based on your roles)
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT INSERT, UPDATE ON point_transactions TO authenticated;
GRANT INSERT, UPDATE ON user_achievements TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- ============================================================================
-- INITIAL DATA CLEANUP AND VERIFICATION
-- ============================================================================

-- Ensure all existing users have point records
INSERT INTO user_points (user_id, total_points_earned, current_balance)
SELECT id, 0, 0 FROM users
WHERE id NOT IN (SELECT user_id FROM user_points)
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================================
-- SUCCESS MESSAGE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Points system schema created successfully!';
    RAISE NOTICE 'Tables created: user_points, point_transactions, achievements, user_achievements';
    RAISE NOTICE 'Leaderboards, rewards, and multipliers configured';
    RAISE NOTICE 'Materialized views created for performance';
    RAISE NOTICE 'Triggers and RLS policies enabled';
END $$;
