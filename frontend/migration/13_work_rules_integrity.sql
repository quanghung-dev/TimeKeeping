-- 17. WORK SHIFTS, IDEMPOTENCY AND AUDIT INTEGRITY

CREATE TABLE IF NOT EXISTS work_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(30) NOT NULL DEFAULT 'blue',
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    standard_minutes INTEGER NOT NULL DEFAULT 480 CHECK (standard_minutes > 0),
    default_break_minutes INTEGER NOT NULL DEFAULT 0 CHECK (default_break_minutes >= 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_work_shift_times CHECK (start_time <> end_time),
    CONSTRAINT uq_work_shifts_user_name UNIQUE (user_id, name)
);

DROP TRIGGER IF EXISTS trg_work_shifts_set_updated_at ON work_shifts;
CREATE TRIGGER trg_work_shifts_set_updated_at
BEFORE UPDATE ON work_shifts
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX IF NOT EXISTS idx_work_shifts_user_active
ON work_shifts (user_id, is_active, start_time);

CREATE TABLE IF NOT EXISTS work_schedule_shifts (
    work_schedule_id UUID NOT NULL REFERENCES work_schedules(id) ON DELETE CASCADE,
    work_shift_id UUID NOT NULL REFERENCES work_shifts(id) ON DELETE CASCADE,
    sort_order SMALLINT NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
    PRIMARY KEY (work_schedule_id, work_shift_id),
    CONSTRAINT uq_work_schedule_shift_order UNIQUE (work_schedule_id, sort_order)
);

ALTER TABLE attendance_sessions
    ADD COLUMN IF NOT EXISTS shift_id UUID REFERENCES work_shifts(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS client_recorded_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS device_id VARCHAR(100);

ALTER TABLE attendance_sessions
    DROP CONSTRAINT IF EXISTS attendance_sessions_check_in_source_check,
    DROP CONSTRAINT IF EXISTS attendance_sessions_check_out_source_check,
    ADD CONSTRAINT attendance_sessions_check_in_source_check
        CHECK (check_in_source IN ('manual', 'web', 'mobile', 'offline', 'gps', 'automatic', 'imported')),
    ADD CONSTRAINT attendance_sessions_check_out_source_check
        CHECK (
            check_out_source IS NULL OR
            check_out_source IN ('manual', 'web', 'mobile', 'offline', 'gps', 'automatic', 'imported')
        );

CREATE INDEX IF NOT EXISTS idx_attendance_sessions_shift
ON attendance_sessions (shift_id, check_in_at)
WHERE shift_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS idempotency_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_request_id UUID NOT NULL,
    operation VARCHAR(100) NOT NULL,
    request_hash VARCHAR(64) NOT NULL,
    response_status INTEGER,
    response_body JSONB,
    resource_type VARCHAR(100),
    resource_id UUID,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 days'),
    CONSTRAINT uq_idempotency_user_request_operation
        UNIQUE (user_id, client_request_id, operation),
    CONSTRAINT chk_idempotency_response_status
        CHECK (response_status IS NULL OR response_status BETWEEN 100 AND 599),
    CONSTRAINT chk_idempotency_expiry CHECK (expires_at > created_at)
);

CREATE INDEX IF NOT EXISTS idx_idempotency_keys_expiry
ON idempotency_keys (expires_at);

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    entity_type VARCHAR(100) NOT NULL,
    entity_id UUID NOT NULL,
    action VARCHAR(30) NOT NULL,
    before_data JSONB,
    after_data JSONB,
    client_request_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_audit_log_action
        CHECK (action IN ('create', 'update', 'delete', 'cancel', 'resolve', 'restore'))
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_entity
ON audit_logs (user_id, entity_type, entity_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created
ON audit_logs (user_id, created_at DESC);
