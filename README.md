# TimeKeeping

Ứng dụng chấm công cá nhân mobile-first gồm chấm vào/ra, nhiều phiên trong ngày, nghỉ giải lao, lịch, nghỉ phép, làm thêm, công việc/timer, báo cáo, lương, xuất/sao lưu và PWA offline. Mọi dữ liệu nghiệp vụ được lọc bằng `user_id` lấy từ JWT HttpOnly cookie; frontend không kết nối trực tiếp Neon.

## Kiến trúc và công nghệ

- `frontend/`: Next.js 16 App Router, React 19, TypeScript strict, Tailwind CSS 4, Radix/shadcn, TanStack Query, React Hook Form, Zod, Recharts, Dexie và service worker.
- `backend/`: Express 5 TypeScript, PostgreSQL/Neon, JWT access/refresh rotation, BCrypt, Zod, Pino, Helmet, CORS, Swagger, ExcelJS và PDFKit.
- `frontend/migration/`: `00`–`11` là schema gốc; `12`–`14` chỉ bổ sung tiến tới, không sửa/drop dữ liệu cũ.
- `DATABASE_MAPPING.md` ánh xạ schema; `IMPLEMENTATION_PLAN.md` mô tả kiến trúc và thứ tự triển khai.

Backend tách theo controller, application service/validator, domain, repository, authentication và common. Frontend tách theo app route, feature, shared component, service, schema, type, API và offline.

## Chạy local

Yêu cầu Node.js 22+, npm và PostgreSQL/Neon bật SSL.

```powershell
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env.local
```

Điền `DATABASE_URL`, ba secret JWT/HMAC dài ít nhất 32 ký tự và origin. Không đặt connection string trong frontend hoặc biến `NEXT_PUBLIC_*`.

```powershell
Set-Location backend
npm install
npm run migration:status
```

Nếu database đã có migration gốc `00`–`11` nhưng chưa có `schema_migrations`, chạy `npm run migration:baseline` một lần, sau đó `npm run migration:up`. Database mới chỉ cần `npm run migration:up`.

```powershell
npm run dev
# terminal khác
Set-Location ../frontend
npm install
npm run dev
```

Mở `http://localhost:3000`; API ở `http://localhost:4000/api`; Swagger ở `/api/docs`.

## Kiểm thử và build

```powershell
Set-Location backend
npm run typecheck
npm test
npm run build
Set-Location ../frontend
npm run lint
npm run build
```

Khi frontend/backend test và database riêng đang chạy, cài browser một lần bằng `npx playwright install chromium`, rồi chạy `npm run test:e2e` trong `frontend` (có thể đặt `E2E_BASE_URL`).

Test backend bao phủ token, health, tính giờ/nghỉ, nhiều phiên, muộn/sớm, làm tròn, ca qua ngày và payroll/OT. Integration test database thật cần `DATABASE_URL` test riêng.

## PWA và offline

Manifest, icon, offline fallback và service worker được tích hợp. API không được cache. Khi mất mạng, thao tác attendance lưu IndexedDB outbox với UUID/timestamp/trạng thái; khi có mạng app gửi tuần tự và backend chống trùng bằng idempotency key.

## Biến môi trường

Backend dùng `DATABASE_URL`, `DATABASE_DIRECT_URL`, `DATABASE_SSL`, ba token secret, `FRONTEND_ORIGINS`, TTL và `APP_URL`. Email reset cần `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, `EMAIL_FROM`. Google Calendar và web push cần credentials bên ngoài trước khi bật.

Frontend dùng `BACKEND_ORIGIN` cho rewrite và `NEXT_PUBLIC_APP_URL`. Không có tài khoản demo/seed tự động trong production.

## Chức năng

- Auth cookie/CSRF, refresh rotation, rate limit login và reset password một lần.
- Hồ sơ, timezone, lịch làm việc; attendance/break, sửa/xoá, overlap/audit.
- Lịch hợp nhất, nghỉ phép, làm thêm, task/project/timer/journal.
- Báo cáo aggregate, biểu đồ, payroll decimal và snapshot.
- CSV/XLSX/PDF, backup JSON/restore merge.
- PWA cài đặt được, dark/light, mobile navigation và offline sync.

Xem [DEPLOYMENT.md](DEPLOYMENT.md), [API_DOCUMENTATION.md](API_DOCUMENTATION.md) và [PWA_OFFLINE_FLOW.md](PWA_OFFLINE_FLOW.md).
