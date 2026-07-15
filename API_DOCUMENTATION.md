# API Documentation

Base path: `/api`. JSON dùng envelope `{ success, message, data, errors, timestamp }`, ngoại trừ file download và HTTP 204. Auth dùng HttpOnly cookies; mutation cần `x-csrf-token` lấy từ `GET /auth/csrf`.

- Auth: register, login, refresh, logout, forgot/reset/change password, me.
- Profile/work: `GET|PUT /profile`, avatar, `/work-settings`, CRUD `/work-shifts`.
- Attendance: today, active, daily, detail; check-in/out; CRUD session và break; cancel latest; resolve forgotten checkout.
- Calendar: day/week/month, CRUD event, copy week, recurring.
- Leave: list/summary/balance và CRUD.
- Overtime: list/active/summary, start/end và CRUD.
- Productivity: project/task CRUD, complete/timer/Pomodoro, journal và summary.
- Reports: dashboard; daily/weekly/monthly/yearly/comparison/productivity.
- Payroll: settings, estimate, history, snapshot, period, allowance/bonus/deduction.
- Notifications: settings, inbox, mark read.
- Data: `GET /exports/report?start=&end=&format=csv|xlsx|pdf`, backup và restore.
- Internal reminder generation: `POST /internal/reminders` dành cho Vercel Cron, xác thực bằng `Authorization: Bearer <CRON_SECRET>`.

Attendance mutation nhận `clientRequestId` UUID. Source `offline` cần ISO timestamp có offset; backend giới hạn 7 ngày và lệch tương lai 5 phút. Google Calendar connect/sync trả 501 khi chưa cấu hình OAuth thật.

Swagger: `/api/docs`. OpenAPI JSON: `/api/openapi.json`.
