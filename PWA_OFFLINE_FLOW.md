# PWA & Offline Flow

Service worker cache app shell/offline page và static asset; mọi `/api/*` bị loại khỏi cache nên response cá nhân không nằm trong Cache Storage.

1. Dashboard tạo UUID, local timestamp, type và payload.
2. Dexie lưu action vào `timekeeping-offline.outbox` với `pending` và `retryCount=0`.
3. UI cập nhật snapshot lạc quan và hiện badge chờ.
4. Event `online` chạy một worker, gửi tuần tự theo `createdAt`.
5. Thành công xoá item; lỗi đánh dấu `failed`, tăng retry và dừng để giữ thứ tự.
6. Backend khóa theo user, so request hash và replay response nếu UUID đã hoàn tất.

Key dùng lại với payload khác trả 409. Timestamp quá cũ/tương lai trả 400 và không bị âm thầm nhận. Đồng bộ chạy khi app đang mở vì cookie/CSRF không được trao cho một background worker độc lập.
