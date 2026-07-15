-- 12. SALARY SETTINGS
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

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_salary_settings_effective_date
ON salary_settings (user_id, effective_from DESC);
