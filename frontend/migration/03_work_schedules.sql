-- 5. WORK SCHEDULES
CREATE TABLE IF NOT EXISTS work_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    day_of_week SMALLINT NOT NULL
        CHECK (day_of_week BETWEEN 1 AND 7),

    is_working_day BOOLEAN NOT NULL DEFAULT TRUE,

    start_time TIME,
    end_time TIME,

    standard_minutes INTEGER NOT NULL DEFAULT 480
        CHECK (standard_minutes >= 0),

    default_break_minutes INTEGER NOT NULL DEFAULT 60
        CHECK (default_break_minutes >= 0),

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_work_schedules_user_day
        UNIQUE (user_id, day_of_week),

    CONSTRAINT chk_work_schedule_times
        CHECK (
            is_working_day = FALSE
            OR (
                start_time IS NOT NULL
                AND end_time IS NOT NULL
                AND end_time <> start_time
            )
        )
);

DROP TRIGGER IF EXISTS trg_work_schedules_set_updated_at ON work_schedules;

CREATE TRIGGER trg_work_schedules_set_updated_at
BEFORE UPDATE ON work_schedules
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
