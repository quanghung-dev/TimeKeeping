-- 4. USER SETTINGS
CREATE TABLE IF NOT EXISTS user_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL UNIQUE
        REFERENCES users(id) ON DELETE CASCADE,

    time_format VARCHAR(10) NOT NULL DEFAULT '24h'
        CHECK (time_format IN ('12h', '24h')),

    week_starts_on SMALLINT NOT NULL DEFAULT 1
        CHECK (week_starts_on BETWEEN 1 AND 7),

    late_grace_minutes INTEGER NOT NULL DEFAULT 5
        CHECK (late_grace_minutes >= 0),

    early_leave_grace_minutes INTEGER NOT NULL DEFAULT 5
        CHECK (early_leave_grace_minutes >= 0),

    overtime_after_minutes INTEGER NOT NULL DEFAULT 480
        CHECK (overtime_after_minutes >= 0),

    rounding_minutes INTEGER NOT NULL DEFAULT 1
        CHECK (rounding_minutes IN (1, 5, 10, 15, 30)),

    auto_detect_overtime BOOLEAN NOT NULL DEFAULT TRUE,
    auto_deduct_break BOOLEAN NOT NULL DEFAULT TRUE,

    currency VARCHAR(10) NOT NULL DEFAULT 'VND',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_user_settings_set_updated_at ON user_settings;

CREATE TRIGGER trg_user_settings_set_updated_at
BEFORE UPDATE ON user_settings
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
