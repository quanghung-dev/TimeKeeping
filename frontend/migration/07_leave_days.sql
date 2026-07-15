-- 9. LEAVE DAYS
CREATE TABLE IF NOT EXISTS leave_days (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    leave_date DATE NOT NULL,

    leave_type VARCHAR(30) NOT NULL
        CHECK (
            leave_type IN (
                'paid_leave',
                'unpaid_leave',
                'sick_leave',
                'personal_leave',
                'other'
            )
        ),

    leave_period VARCHAR(20) NOT NULL DEFAULT 'full_day'
        CHECK (
            leave_period IN (
                'full_day',
                'morning',
                'afternoon',
                'hourly'
            )
        ),

    duration_minutes INTEGER
        CHECK (
            duration_minutes IS NULL
            OR duration_minutes > 0
        ),

    reason TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_leave_days_user_date
        UNIQUE (user_id, leave_date),

    CONSTRAINT chk_hourly_leave_duration
        CHECK (
            leave_period <> 'hourly'
            OR duration_minutes IS NOT NULL
        )
);

DROP TRIGGER IF EXISTS trg_leave_days_set_updated_at ON leave_days;

CREATE TRIGGER trg_leave_days_set_updated_at
BEFORE UPDATE ON leave_days
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_leave_days_user_date
ON leave_days (user_id, leave_date);
