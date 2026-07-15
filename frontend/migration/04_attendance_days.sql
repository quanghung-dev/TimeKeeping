-- 6. ATTENDANCE DAYS
CREATE TABLE IF NOT EXISTS attendance_days (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    work_date DATE NOT NULL,

    schedule_id UUID
        REFERENCES work_schedules(id) ON DELETE SET NULL,

    status VARCHAR(30) NOT NULL DEFAULT 'not_started'
        CHECK (
            status IN (
                'not_started',
                'working',
                'on_break',
                'completed',
                'leave',
                'holiday',
                'day_off',
                'absent'
            )
        ),

    manual_adjustment_minutes INTEGER NOT NULL DEFAULT 0,

    note TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_attendance_days_user_date
        UNIQUE (user_id, work_date)
);

DROP TRIGGER IF EXISTS trg_attendance_days_set_updated_at ON attendance_days;

CREATE TRIGGER trg_attendance_days_set_updated_at
BEFORE UPDATE ON attendance_days
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_attendance_days_user_date
ON attendance_days (user_id, work_date DESC);

CREATE INDEX IF NOT EXISTS idx_attendance_days_status
ON attendance_days (user_id, status, work_date DESC);
