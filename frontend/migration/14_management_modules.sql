-- 18. MANAGEMENT MODULES
-- Forward-only tables required by calendar, overtime, productivity,
-- notifications and payroll history. Existing tables remain unchanged.

CREATE TABLE IF NOT EXISTS calendar_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(150) NOT NULL,
    event_type VARCHAR(30) NOT NULL DEFAULT 'custom'
        CHECK (event_type IN ('work', 'remote', 'business_trip', 'day_off', 'custom')),
    starts_at TIMESTAMPTZ NOT NULL,
    ends_at TIMESTAMPTZ NOT NULL,
    is_all_day BOOLEAN NOT NULL DEFAULT FALSE,
    recurrence_rule VARCHAR(500),
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_calendar_event_time CHECK (ends_at > starts_at)
);

DROP TRIGGER IF EXISTS trg_calendar_events_set_updated_at ON calendar_events;
CREATE TRIGGER trg_calendar_events_set_updated_at
BEFORE UPDATE ON calendar_events
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_calendar_events_user_range
ON calendar_events (user_id, starts_at, ends_at);

CREATE TABLE IF NOT EXISTS overtime_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    attendance_day_id UUID REFERENCES attendance_days(id) ON DELETE SET NULL,
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    overtime_type VARCHAR(20) NOT NULL DEFAULT 'weekday'
        CHECK (overtime_type IN ('weekday', 'weekend', 'holiday')),
    multiplier NUMERIC(5, 2) NOT NULL DEFAULT 1.5 CHECK (multiplier > 0 AND multiplier <= 10),
    source VARCHAR(20) NOT NULL DEFAULT 'manual'
        CHECK (source IN ('manual', 'automatic')),
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_overtime_session_time CHECK (ended_at IS NULL OR ended_at > started_at)
);

DROP TRIGGER IF EXISTS trg_overtime_sessions_set_updated_at ON overtime_sessions;
CREATE TRIGGER trg_overtime_sessions_set_updated_at
BEFORE UPDATE ON overtime_sessions
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE UNIQUE INDEX IF NOT EXISTS ux_overtime_user_open
ON overtime_sessions (user_id) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_overtime_user_started
ON overtime_sessions (user_id, started_at DESC);

CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    color VARCHAR(30) NOT NULL DEFAULT 'blue',
    description TEXT,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_projects_user_name UNIQUE (user_id, name)
);

DROP TRIGGER IF EXISTS trg_projects_set_updated_at ON projects;
CREATE TRIGGER trg_projects_set_updated_at
BEFORE UPDATE ON projects
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    task_date DATE NOT NULL,
    priority VARCHAR(10) NOT NULL DEFAULT 'medium'
        CHECK (priority IN ('low', 'medium', 'high')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    estimated_minutes INTEGER CHECK (estimated_minutes IS NULL OR estimated_minutes > 0),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_tasks_set_updated_at ON tasks;
CREATE TRIGGER trg_tasks_set_updated_at
BEFORE UPDATE ON tasks
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_tasks_user_date_status
ON tasks (user_id, task_date DESC, status);
CREATE INDEX IF NOT EXISTS idx_tasks_project
ON tasks (project_id, task_date DESC) WHERE project_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS task_time_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    entry_type VARCHAR(20) NOT NULL DEFAULT 'timer'
        CHECK (entry_type IN ('timer', 'pomodoro', 'manual')),
    started_at TIMESTAMPTZ NOT NULL,
    ended_at TIMESTAMPTZ,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_task_time_entry CHECK (ended_at IS NULL OR ended_at > started_at)
);

DROP TRIGGER IF EXISTS trg_task_time_entries_set_updated_at ON task_time_entries;
CREATE TRIGGER trg_task_time_entries_set_updated_at
BEFORE UPDATE ON task_time_entries
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE UNIQUE INDEX IF NOT EXISTS ux_task_time_user_open
ON task_time_entries (user_id) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_task_time_task
ON task_time_entries (task_id, started_at DESC);

CREATE TABLE IF NOT EXISTS leave_balances (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    balance_year INTEGER NOT NULL CHECK (balance_year BETWEEN 2000 AND 2200),
    allowance_minutes INTEGER NOT NULL DEFAULT 9600 CHECK (allowance_minutes >= 0),
    carried_minutes INTEGER NOT NULL DEFAULT 0 CHECK (carried_minutes >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, balance_year)
);

CREATE TABLE IF NOT EXISTS notification_settings (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    check_in_reminder BOOLEAN NOT NULL DEFAULT TRUE,
    check_out_reminder BOOLEAN NOT NULL DEFAULT TRUE,
    break_reminder BOOLEAN NOT NULL DEFAULT TRUE,
    missing_time_reminder BOOLEAN NOT NULL DEFAULT TRUE,
    daily_summary BOOLEAN NOT NULL DEFAULT TRUE,
    weekly_summary BOOLEAN NOT NULL DEFAULT TRUE,
    browser_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    email_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    notification_type VARCHAR(40) NOT NULL,
    title VARCHAR(150) NOT NULL,
    body TEXT NOT NULL,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
ON notifications (user_id, created_at DESC) WHERE read_at IS NULL;

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_push_subscriptions_endpoint UNIQUE (endpoint)
);

CREATE TABLE IF NOT EXISTS payroll_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    adjustment_date DATE NOT NULL,
    adjustment_type VARCHAR(20) NOT NULL CHECK (adjustment_type IN ('allowance', 'bonus', 'deduction')),
    category VARCHAR(50) NOT NULL,
    amount NUMERIC(15, 2) NOT NULL CHECK (amount >= 0),
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payroll_adjustments_user_date
ON payroll_adjustments (user_id, adjustment_date DESC);

CREATE TABLE IF NOT EXISTS payroll_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    payroll_year INTEGER NOT NULL CHECK (payroll_year BETWEEN 2000 AND 2200),
    payroll_month SMALLINT NOT NULL CHECK (payroll_month BETWEEN 1 AND 12),
    currency VARCHAR(10) NOT NULL,
    gross_amount NUMERIC(15, 2) NOT NULL,
    overtime_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    allowance_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    deduction_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    net_amount NUMERIC(15, 2) NOT NULL,
    calculation JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_payroll_snapshots_user_period UNIQUE (user_id, payroll_year, payroll_month)
);
