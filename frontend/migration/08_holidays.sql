-- 10. HOLIDAYS
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

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_holidays_user_date
ON holidays (user_id, holiday_date);
