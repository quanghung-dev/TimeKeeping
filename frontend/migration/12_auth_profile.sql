-- 16. AUTHENTICATION, PROFILE AND USER PREFERENCES
-- Forward-only supplement. Existing migrations 00-11 remain unchanged.

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS company VARCHAR(150),
    ADD COLUMN IF NOT EXISTS job_title VARCHAR(100);

ALTER TABLE user_settings
    ADD COLUMN IF NOT EXISTS language VARCHAR(5) NOT NULL DEFAULT 'vi',
    ADD COLUMN IF NOT EXISTS theme_mode VARCHAR(10) NOT NULL DEFAULT 'system',
    ADD COLUMN IF NOT EXISTS accent_color VARCHAR(30) NOT NULL DEFAULT 'blue',
    ADD COLUMN IF NOT EXISTS schedule_mode VARCHAR(20) NOT NULL DEFAULT 'fixed',
    ADD COLUMN IF NOT EXISTS earliest_check_in_minutes INTEGER NOT NULL DEFAULT 120,
    ADD COLUMN IF NOT EXISTS latest_check_in_minutes INTEGER NOT NULL DEFAULT 240,
    ADD COLUMN IF NOT EXISTS standard_work_days_per_month NUMERIC(5, 2) NOT NULL DEFAULT 22,
    ADD COLUMN IF NOT EXISTS checkout_open_break_policy VARCHAR(20) NOT NULL DEFAULT 'require_end',
    ADD COLUMN IF NOT EXISTS max_session_minutes INTEGER NOT NULL DEFAULT 960,
    ADD COLUMN IF NOT EXISTS overtime_rule VARCHAR(30) NOT NULL DEFAULT 'after_daily_threshold';

-- The original migration used 1 as "no rounding" and also allowed 30.
-- The public contract requires exactly 0, 5, 10 or 15 minutes.
UPDATE user_settings SET rounding_minutes = 0 WHERE rounding_minutes = 1;
UPDATE user_settings SET rounding_minutes = 15 WHERE rounding_minutes = 30;

ALTER TABLE user_settings
    ALTER COLUMN rounding_minutes SET DEFAULT 0,
    DROP CONSTRAINT IF EXISTS user_settings_rounding_minutes_check,
    ADD CONSTRAINT user_settings_rounding_minutes_check
        CHECK (rounding_minutes IN (0, 5, 10, 15)),
    ADD CONSTRAINT chk_user_settings_language
        CHECK (language IN ('vi', 'en')),
    ADD CONSTRAINT chk_user_settings_theme_mode
        CHECK (theme_mode IN ('light', 'dark', 'system')),
    ADD CONSTRAINT chk_user_settings_schedule_mode
        CHECK (schedule_mode IN ('fixed', 'flexible', 'shift')),
    ADD CONSTRAINT chk_user_settings_check_in_limits
        CHECK (earliest_check_in_minutes >= 0 AND latest_check_in_minutes >= 0),
    ADD CONSTRAINT chk_user_settings_standard_work_days
        CHECK (standard_work_days_per_month > 0),
    ADD CONSTRAINT chk_user_settings_checkout_break_policy
        CHECK (checkout_open_break_policy IN ('require_end', 'auto_end')),
    ADD CONSTRAINT chk_user_settings_max_session_minutes
        CHECK (max_session_minutes BETWEEN 60 AND 2880),
    ADD CONSTRAINT chk_user_settings_overtime_rule
        CHECK (overtime_rule IN ('after_daily_threshold', 'outside_schedule', 'manual_only'));

CREATE TABLE IF NOT EXISTS user_avatars (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    content_type VARCHAR(50) NOT NULL,
    file_size INTEGER NOT NULL CHECK (file_size BETWEEN 1 AND 2097152),
    content BYTEA NOT NULL,
    content_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_user_avatar_content_type
        CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp'))
);

DROP TRIGGER IF EXISTS trg_user_avatars_set_updated_at ON user_avatars;
CREATE TRIGGER trg_user_avatars_set_updated_at
BEFORE UPDATE ON user_avatars
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    family_id UUID NOT NULL,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    replaced_by_token_id UUID REFERENCES refresh_tokens(id) ON DELETE SET NULL,
    created_by_ip_hash VARCHAR(64),
    user_agent VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_refresh_token_expiry CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_active
ON refresh_tokens (user_id, expires_at DESC)
WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_family
ON refresh_tokens (family_id, created_at);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_password_reset_expiry CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user
ON password_reset_tokens (user_id, expires_at DESC);

CREATE TABLE IF NOT EXISTS login_attempts (
    id BIGSERIAL PRIMARY KEY,
    email_hash VARCHAR(64) NOT NULL,
    ip_hash VARCHAR(64) NOT NULL,
    succeeded BOOLEAN NOT NULL DEFAULT FALSE,
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_lookup
ON login_attempts (email_hash, ip_hash, attempted_at DESC);
