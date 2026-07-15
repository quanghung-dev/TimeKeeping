# Implementation Plan

## Hien trang

- Frontend: Next.js 16.2 App Router, React 19.2, TypeScript strict, Tailwind 4; hien chi co trang mac dinh.
- Backend: Express 5, `pg`, `dotenv`; chua co source, validation, build hoac test.
- Database: migration `00`-`11` da chay, chua co du lieu; 9 bang nghiep vu va view tong hop ngay.
- Deployment: hai Vercel Project cung repository, root lan luot `frontend/` va `backend/`; frontend proxy `/api` sang backend.

## Kien truc muc tieu

- Backend TypeScript: controllers -> application services/DTO/validators -> domain -> repositories/database/auth/notifications -> common errors/responses.
- Frontend: App Router pages/layouts -> feature components/hooks -> typed API services -> shared/base UI.
- PostgreSQL la nguon tinh toan chinh cho report; moi query duoc parameterized va user-scoped.
- Access/refresh JWT trong Secure HttpOnly cookies, refresh rotation, CSRF cho mutation.
- OpenAPI la hop dong API; frontend dung type cu the va khong lap URL/fetch trong component.

## Thu tu trien khai

1. Documentation, migration runner, database connection, response/error/logging/security foundation.
2. Authentication, profile, user/work settings va work shifts.
3. Attendance, break, idempotency, audit, time calculation va dashboard.
4. Calendar, leave, overtime.
5. Projects, tasks, Pomodoro, journal, reports va payroll.
6. Export/backup/restore/data deletion, notifications va external integration scaffolds.
7. PWA manifest/service worker, IndexedDB outbox, sync/conflict UI va install flow.
8. Unit/integration/frontend/E2E/security tests, documentation va Vercel deployment verification.

## Luong nghiep vu chinh

- Register tao user, default settings va lich tuan trong mot transaction; login phat access/refresh cookies.
- Check-in lay user tu auth, khoa aggregate ngay, kiem tra active session, ghi idempotency va tao attendance day/session trong transaction.
- Break chi bat dau tren active session; checkout bi tu choi neu break dang mo; moi thay doi thu cong ghi audit.
- Daily summary = gross sessions - deductible breaks + manual adjustment; late/early dung ca va grace; missing/extra/overtime tinh tren backend.
- Offline action duoc xep theo device sequence, gui batch va replay an toan bang `clientRequestId`.
- Report/payroll aggregate theo khoang ngay tren server; frontend chi render DTO da tinh.

## Migration va rui ro database

- Khong sua hoac chay lai co chu dich migration cu tren database hien tai.
- Runner baseline phai kiem tra object truoc khi danh dau `00`-`11` da ap dung.
- Constraint rounding cu khac dac ta; migration moi backfill `1 -> 0` truoc khi doi constraint.
- Unique partial index hien co ngan active session/break trung; service van phai xu ly violation thanh HTTP 409.
- Pooled `DATABASE_URL` dung runtime; direct SSL URL dung migration. Khong migrate o cold start.

## File/nhom file chinh

- Tao backend `src/controllers`, `src/application`, `src/domain`, `src/infrastructure`, `src/common`, `src/routes`, `tests`.
- Tao frontend `components`, `features`, `hooks`, `lib`, `services`, `schemas`, `types`, cac route group auth/app.
- Bo sung migration `12` tro di va tai lieu `API_DOCUMENTATION.md`, `PWA_OFFLINE_FLOW.md`, `DEPLOYMENT.md`.

## Definition of done

Moi module chi hoan thanh khi co mapping, repository, service, validation, API, UI ket noi that, loading/empty/error/offline state, test nghiep vu va build xanh. Sau moi giai doan chay backend typecheck/test, frontend lint/build/test va ghi lai bien moi truong/kiem tra thu cong.
