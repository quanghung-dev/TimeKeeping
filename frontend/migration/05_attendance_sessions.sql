-- 7. ATTENDANCE SESSIONS
CREATE TABLE IF NOT EXISTS attendance_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    attendance_day_id UUID NOT NULL
        REFERENCES attendance_days(id) ON DELETE CASCADE,

    check_in_at TIMESTAMPTZ NOT NULL,
    check_out_at TIMESTAMPTZ,

    check_in_source VARCHAR(30) NOT NULL DEFAULT 'manual'
        CHECK (
            check_in_source IN (
                'manual',
                'gps',
                'automatic',
                'imported'
            )
        ),

    check_out_source VARCHAR(30)
        CHECK (
            check_out_source IS NULL
            OR check_out_source IN (
                'manual',
                'gps',
                'automatic',
                'imported'
            )
        ),

    check_in_latitude NUMERIC(10, 7),
    check_in_longitude NUMERIC(10, 7),

    check_out_latitude NUMERIC(10, 7),
    check_out_longitude NUMERIC(10, 7),

    note TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_attendance_session_time
        CHECK (
            check_out_at IS NULL
            OR check_out_at > check_in_at
        ),

    CONSTRAINT chk_check_in_latitude
        CHECK (
            check_in_latitude IS NULL
            OR check_in_latitude BETWEEN -90 AND 90
        ),

    CONSTRAINT chk_check_in_longitude
        CHECK (
            check_in_longitude IS NULL
            OR check_in_longitude BETWEEN -180 AND 180
        ),

    CONSTRAINT chk_check_out_latitude
        CHECK (
            check_out_latitude IS NULL
            OR check_out_latitude BETWEEN -90 AND 90
        ),

    CONSTRAINT chk_check_out_longitude
        CHECK (
            check_out_longitude IS NULL
            OR check_out_longitude BETWEEN -180 AND 180
        )
);

DROP TRIGGER IF EXISTS trg_attendance_sessions_set_updated_at ON attendance_sessions;

CREATE TRIGGER trg_attendance_sessions_set_updated_at
BEFORE UPDATE ON attendance_sessions
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- INDEXES
CREATE UNIQUE INDEX IF NOT EXISTS ux_attendance_one_open_session
ON attendance_sessions (attendance_day_id)
WHERE check_out_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_attendance_sessions_day
ON attendance_sessions (attendance_day_id, check_in_at);
