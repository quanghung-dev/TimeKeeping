# Deployment

## Neon

Dùng pooled URL cho `DATABASE_URL`, direct URL cho `DATABASE_DIRECT_URL` và SSL. Chạy migration từ môi trường quản trị: status, baseline nếu schema gốc đã tồn tại, rồi up. Migration không chạy tự động trong request/build.

## Backend Vercel

Deploy thư mục `backend`; `vercel.json` trỏ vào Express handler `src/index.ts`. Cấu hình biến trong `.env.example`; ba token secret khác nhau và dài ít nhất 32 ký tự. `APP_URL` là frontend HTTPS. Resend cần key và sender đã xác minh.

Đặt `CRON_SECRET` đủ mạnh để bảo vệ `/api/internal/reminders`. Trên Vercel Hobby, dùng scheduler bên ngoài gọi endpoint này mỗi 15 phút bằng Bearer token; khi nâng Pro có thể thêm lại Vercel Cron với lịch `*/15 * * * *`. Chỉ bật web push hoặc Google Calendar khi đã cung cấp credentials thật.

## Frontend Vercel

Deploy thư mục `frontend`; đặt `BACKEND_ORIGIN=https://<backend-domain>`. Backend `FRONTEND_ORIGINS` là danh sách origin chính xác. Không đưa database URL/token secret vào frontend.

Sau deploy kiểm tra health, auth/CSRF, chu kỳ attendance/break, export, manifest/service worker và offline outbox. Google OAuth, email và push chỉ bật sau khi có credentials thực; API không báo thành công giả khi provider chưa cấu hình.
