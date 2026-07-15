-- 13. DAILY ATTENDANCE SUMMARY VIEW
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
