-- 8. BREAK SESSIONS
CREATE TABLE IF NOT EXISTS break_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    attendance_session_id UUID NOT NULL
        REFERENCES attendance_sessions(id) ON DELETE CASCADE,

    break_type VARCHAR(30) NOT NULL DEFAULT 'personal'
        CHECK (
            break_type IN (
                'lunch',
                'short_break',
                'personal',
                'outside',
                'other'
            )
        ),

    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,

    note TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_break_session_time
        CHECK (
            ended_at IS NULL
            OR ended_at > started_at
        )
);

DROP TRIGGER IF EXISTS trg_break_sessions_set_updated_at ON break_sessions;

CREATE TRIGGER trg_break_sessions_set_updated_at
BEFORE UPDATE ON break_sessions
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- INDEXES
CREATE UNIQUE INDEX IF NOT EXISTS ux_break_one_open_break
ON break_sessions (attendance_session_id)
WHERE ended_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_break_sessions_attendance
ON break_sessions (attendance_session_id, started_at);
