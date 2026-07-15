-- 11. DAILY NOTES
CREATE TABLE IF NOT EXISTS daily_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    note_date DATE NOT NULL,

    work_summary TEXT,
    next_day_plan TEXT,

    productivity_score SMALLINT
        CHECK (
            productivity_score IS NULL
            OR productivity_score BETWEEN 1 AND 5
        ),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_daily_notes_user_date
        UNIQUE (user_id, note_date)
);

DROP TRIGGER IF EXISTS trg_daily_notes_set_updated_at ON daily_notes;

CREATE TRIGGER trg_daily_notes_set_updated_at
BEFORE UPDATE ON daily_notes
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_daily_notes_user_date
ON daily_notes (user_id, note_date DESC);
