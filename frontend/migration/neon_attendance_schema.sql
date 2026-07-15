-- =========================================================
-- PERSONAL ATTENDANCE WEB - POSTGRESQL / NEON DATABASE SCHEMA
-- File: neon_attendance_schema.sql
-- Timezone recommendation: store timestamps in UTC using TIMESTAMPTZ
-- =========================================================

BEGIN;

-- ---------------------------------------------------------
-- 1. EXTENSIONS
-- ---------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ---------------------------------------------------------
-- 2. COMMON UPDATED_AT TRIGGER
-- ---------------------------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


-- ---------------------------------------------------------
-- 3. USERS
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash TEXT,
    display_name VARCHAR(100) NOT NULL,

    timezone VARCHAR(100) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_users_set_updated_at ON users;

CREATE TRIGGER trg_users_set_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


-- ---------------------------------------------------------
-- 4. USER SETTINGS
-- ---------------------------------------------------------

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


-- ---------------------------------------------------------
-- 5. WORK SCHEDULES
-- day_of_week: 1 = Monday, 7 = Sunday
-- ---------------------------------------------------------

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


-- ---------------------------------------------------------
-- 6. ATTENDANCE DAYS
-- One record per user per work date
-- ---------------------------------------------------------

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


-- ---------------------------------------------------------
-- 7. ATTENDANCE SESSIONS
-- Supports multiple check-in/check-out sessions per day
-- ---------------------------------------------------------

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

CREATE UNIQUE INDEX IF NOT EXISTS ux_attendance_one_open_session
ON attendance_sessions (attendance_day_id)
WHERE check_out_at IS NULL;


-- ---------------------------------------------------------
-- 8. BREAK SESSIONS
-- ---------------------------------------------------------

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

CREATE UNIQUE INDEX IF NOT EXISTS ux_break_one_open_break
ON break_sessions (attendance_session_id)
WHERE ended_at IS NULL;


-- ---------------------------------------------------------
-- 9. LEAVE DAYS
-- One record per leave date
-- ---------------------------------------------------------

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


-- ---------------------------------------------------------
-- 10. HOLIDAYS
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS holidays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    holiday_date DATE NOT NULL,
    name VARCHAR(150) NOT NULL,

    is_paid BOOLEAN NOT NULL DEFAULT TRUE,
    note TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_holidays_user_date
        UNIQUE (user_id, holiday_date)
);

DROP TRIGGER IF EXISTS trg_holidays_set_updated_at ON holidays;

CREATE TRIGGER trg_holidays_set_updated_at
BEFORE UPDATE ON holidays
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


-- ---------------------------------------------------------
-- 11. DAILY NOTES
-- ---------------------------------------------------------

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


-- ---------------------------------------------------------
-- 12. SALARY SETTINGS
-- Stores salary history by effective period
-- ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS salary_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id UUID NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    salary_type VARCHAR(20) NOT NULL
        CHECK (
            salary_type IN (
                'monthly',
                'hourly',
                'daily'
            )
        ),

    base_salary NUMERIC(15, 2) NOT NULL DEFAULT 0
        CHECK (base_salary >= 0),

    hourly_rate NUMERIC(15, 2)
        CHECK (hourly_rate IS NULL OR hourly_rate >= 0),

    daily_rate NUMERIC(15, 2)
        CHECK (daily_rate IS NULL OR daily_rate >= 0),

    weekday_overtime_multiplier NUMERIC(5, 2) NOT NULL DEFAULT 1.5
        CHECK (weekday_overtime_multiplier >= 0),

    weekend_overtime_multiplier NUMERIC(5, 2) NOT NULL DEFAULT 2.0
        CHECK (weekend_overtime_multiplier >= 0),

    holiday_overtime_multiplier NUMERIC(5, 2) NOT NULL DEFAULT 3.0
        CHECK (holiday_overtime_multiplier >= 0),

    effective_from DATE NOT NULL,
    effective_to DATE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT chk_salary_effective_dates
        CHECK (
            effective_to IS NULL
            OR effective_to >= effective_from
        ),

    CONSTRAINT chk_salary_type_rate
        CHECK (
            (salary_type = 'monthly' AND base_salary >= 0)
            OR (salary_type = 'hourly' AND hourly_rate IS NOT NULL)
            OR (salary_type = 'daily' AND daily_rate IS NOT NULL)
        )
);

DROP TRIGGER IF EXISTS trg_salary_settings_set_updated_at ON salary_settings;

CREATE TRIGGER trg_salary_settings_set_updated_at
BEFORE UPDATE ON salary_settings
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();


-- ---------------------------------------------------------
-- 13. INDEXES
-- ---------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_attendance_days_user_date
ON attendance_days (user_id, work_date DESC);

CREATE INDEX IF NOT EXISTS idx_attendance_days_status
ON attendance_days (user_id, status, work_date DESC);

CREATE INDEX IF NOT EXISTS idx_attendance_sessions_day
ON attendance_sessions (attendance_day_id, check_in_at);

CREATE INDEX IF NOT EXISTS idx_break_sessions_attendance
ON break_sessions (attendance_session_id, started_at);

CREATE INDEX IF NOT EXISTS idx_leave_days_user_date
ON leave_days (user_id, leave_date);

CREATE INDEX IF NOT EXISTS idx_holidays_user_date
ON holidays (user_id, holiday_date);

CREATE INDEX IF NOT EXISTS idx_daily_notes_user_date
ON daily_notes (user_id, note_date DESC);

CREATE INDEX IF NOT EXISTS idx_salary_settings_effective_date
ON salary_settings (user_id, effective_from DESC);


-- ---------------------------------------------------------
-- 14. DAILY ATTENDANCE SUMMARY VIEW
-- Open sessions and breaks are calculated up to NOW().
-- ---------------------------------------------------------

CREATE OR REPLACE VIEW v_daily_attendance_summary AS
WITH session_summary AS (
    SELECT
        attendance_day_id,
        ROUND(
            SUM(
                EXTRACT(
                    EPOCH FROM (
                        COALESCE(check_out_at, NOW()) - check_in_at
                    )
                ) / 60.0
            )
        )::INTEGER AS session_minutes
    FROM attendance_sessions
    GROUP BY attendance_day_id
),
break_summary AS (
    SELECT
        attendance_sessions.attendance_day_id,
        ROUND(
            SUM(
                EXTRACT(
                    EPOCH FROM (
                        COALESCE(break_sessions.ended_at, NOW())
                        - break_sessions.started_at
                    )
                ) / 60.0
            )
        )::INTEGER AS break_minutes
    FROM break_sessions
    INNER JOIN attendance_sessions
        ON attendance_sessions.id = break_sessions.attendance_session_id
    GROUP BY attendance_sessions.attendance_day_id
)
SELECT
    attendance_days.id AS attendance_day_id,
    attendance_days.user_id,
    attendance_days.work_date,
    attendance_days.status,

    COALESCE(session_summary.session_minutes, 0)
        AS session_minutes,

    COALESCE(break_summary.break_minutes, 0)
        AS break_minutes,

    (
        COALESCE(session_summary.session_minutes, 0)
        - COALESCE(break_summary.break_minutes, 0)
        + attendance_days.manual_adjustment_minutes
    ) AS actual_work_minutes,

    COALESCE(work_schedules.standard_minutes, 0)
        AS standard_minutes,

    (
        COALESCE(session_summary.session_minutes, 0)
        - COALESCE(break_summary.break_minutes, 0)
        + attendance_days.manual_adjustment_minutes
        - COALESCE(work_schedules.standard_minutes, 0)
    ) AS difference_minutes,

    GREATEST(
        (
            COALESCE(session_summary.session_minutes, 0)
            - COALESCE(break_summary.break_minutes, 0)
            + attendance_days.manual_adjustment_minutes
            - COALESCE(work_schedules.standard_minutes, 0)
        ),
        0
    ) AS overtime_minutes,

    GREATEST(
        (
            COALESCE(work_schedules.standard_minutes, 0)
            - (
                COALESCE(session_summary.session_minutes, 0)
                - COALESCE(break_summary.break_minutes, 0)
                + attendance_days.manual_adjustment_minutes
            )
        ),
        0
    ) AS missing_minutes

FROM attendance_days

LEFT JOIN work_schedules
    ON work_schedules.id = attendance_days.schedule_id

LEFT JOIN session_summary
    ON session_summary.attendance_day_id = attendance_days.id

LEFT JOIN break_summary
    ON break_summary.attendance_day_id = attendance_days.id;


-- ---------------------------------------------------------
-- 15. OPTIONAL SAMPLE DATA
-- Uncomment and replace values when needed.
-- ---------------------------------------------------------

/*
INSERT INTO users (
    email,
    password_hash,
    display_name,
    timezone
)
VALUES (
    'you@example.com',
    NULL,
    'Do Quang Hung',
    'Asia/Ho_Chi_Minh'
)
RETURNING id;
*/

/*
-- Replace USER_UUID with the UUID returned from the users insert.

INSERT INTO user_settings (
    user_id
)
VALUES (
    'USER_UUID'
);

INSERT INTO work_schedules (
    user_id,
    day_of_week,
    is_working_day,
    start_time,
    end_time,
    standard_minutes,
    default_break_minutes
)
VALUES
    ('USER_UUID', 1, TRUE,  '08:00', '17:00', 480, 60),
    ('USER_UUID', 2, TRUE,  '08:00', '17:00', 480, 60),
    ('USER_UUID', 3, TRUE,  '08:00', '17:00', 480, 60),
    ('USER_UUID', 4, TRUE,  '08:00', '17:00', 480, 60),
    ('USER_UUID', 5, TRUE,  '08:00', '17:00', 480, 60),
    ('USER_UUID', 6, FALSE, NULL,    NULL,    0,   0),
    ('USER_UUID', 7, FALSE, NULL,    NULL,    0,   0);
*/

COMMIT;
