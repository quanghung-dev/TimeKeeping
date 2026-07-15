# Database Mapping

## Nguon schema va quy tac migration

- PostgreSQL/Neon la nguon du lieu duy nhat. Frontend khong duoc ket noi truc tiep database.
- Chuoi migration chinh la `frontend/migration/00_setup.sql` den `11_views.sql` theo thu tu ten file.
- `frontend/migration/neon_attendance_schema.sql` la snapshot tong hop cua chuoi `00`-`11`, khong duoc chay cung chuoi migration roi.
- Cac migration cu duoc xem la da chay. Moi thay doi tu day phai nam trong migration moi, forward-only, khong drop table va khong reset du lieu.
- Tat ca query nghiep vu phai dung tham so va loc theo `user_id` lay tu auth context. Entity con phai duoc ownership-join ve entity co `user_id`.

## Extension, function va trigger dung chung

| Doi tuong | Dinh nghia | Muc dich |
| --- | --- | --- |
| `pgcrypto` | PostgreSQL extension | Tao UUID bang `gen_random_uuid()` |
| `set_updated_at()` | Trigger function | Gan `updated_at = NOW()` truoc moi UPDATE |
| `trg_*_set_updated_at` | BEFORE UPDATE trigger | Ap dung cho tat ca bang hien co co `updated_at` |

## Bang hien co

### `users`

- Chuc nang: tai khoan va ho so co ban.
- PK: `id UUID`, mac dinh `gen_random_uuid()`.
- Unique: `email`.
- Cot backend: `id`, `email`, `password_hash`, `display_name`, `timezone`, `created_at`, `updated_at`.
- Bao mat: tuyet doi khong tra `password_hash`; email duoc chuan hoa lowercase truoc khi ghi.
- Quan he: cha cua `user_settings`, `work_schedules`, `attendance_days`, `leave_days`, `holidays`, `daily_notes`, `salary_settings`.
- Thieu: company, job title, avatar, refresh/reset token va cac tuy chon ho so mo rong.

### `user_settings`

- Chuc nang: tuy chon thoi gian, grace period, overtime, rounding va tien te.
- PK: `id`; FK/unique: `user_id -> users(id) ON DELETE CASCADE`, mot dong moi user.
- Check: `time_format` in `12h/24h`; `week_starts_on` 1-7; grace/overtime khong am; `rounding_minutes` hien tai in `1/5/10/15/30`.
- Cot backend: toan bo cot nghiep vu va timestamps.
- Thieu: ngon ngu, theme, schedule mode, gioi han check-in, ngay cong thang, chinh sach checkout khi break dang mo, nguong forgotten checkout.
- Sai khac dac ta: `rounding_minutes` phai la `0/5/10/15`; migration bo sung se chuyen gia tri mac dinh `1` thanh `0` an toan.

### `work_schedules`

- Chuc nang: lich tuan co ban, mot dong cho moi thu cua moi user.
- PK: `id`; FK: `user_id -> users`; unique `(user_id, day_of_week)`.
- Check: `day_of_week` 1-7, phut khong am; ngay lam viec bat buoc co start/end va hai gia tri khac nhau.
- Cot backend: `day_of_week`, `is_working_day`, `start_time`, `end_time`, `standard_minutes`, `default_break_minutes`.
- Quan he: duoc `attendance_days.schedule_id` tham chieu.
- Thieu: nhieu ca trong mot ngay, ten ca, mau ca va thu tu ca.

### `attendance_days`

- Chuc nang: aggregate root cho mot ngay cong cua mot user.
- PK: `id`; FK: `user_id -> users`, `schedule_id -> work_schedules ON DELETE SET NULL`.
- Unique: `(user_id, work_date)`.
- Status: `not_started`, `working`, `on_break`, `completed`, `leave`, `holiday`, `day_off`, `absent`.
- Index: `(user_id, work_date DESC)` va `(user_id, status, work_date DESC)`.
- Cot backend: toan bo cot; `manual_adjustment_minutes` chi duoc thay doi qua service co audit.
- Quan he: cha cua `attendance_sessions`.

### `attendance_sessions`

- Chuc nang: nhieu phien check-in/check-out trong mot ngay.
- PK: `id`; FK: `attendance_day_id -> attendance_days ON DELETE CASCADE`.
- Check: checkout null hoac lon hon check-in; latitude/longitude trong mien hop le; source thuoc `manual/gps/automatic/imported`.
- Unique index partial: mot session mo moi `attendance_day_id`.
- Index: `(attendance_day_id, check_in_at)`.
- Cot backend: timestamps, source, toa do, note va timestamps he thong.
- Quan he: cha cua `break_sessions`; ownership thong qua `attendance_days.user_id`.
- Thieu: `shift_id`, source `web/mobile/offline`, client timestamp va idempotency.

### `break_sessions`

- Chuc nang: cac khoang nghi nam trong mot attendance session.
- PK: `id`; FK: `attendance_session_id -> attendance_sessions ON DELETE CASCADE`.
- Type: `lunch`, `short_break`, `personal`, `outside`, `other`.
- Check: end null hoac lon hon start.
- Unique index partial: mot break mo moi attendance session.
- Index: `(attendance_session_id, started_at)`.
- Ownership: join `break_sessions -> attendance_sessions -> attendance_days.user_id`.

### `leave_days`

- Chuc nang: nghi phep theo ngay, nua ngay hoac theo gio.
- PK: `id`; FK: `user_id -> users`; unique `(user_id, leave_date)`.
- Type: paid/unpaid/sick/personal/other; period: full_day/morning/afternoon/hourly.
- Check: duration duong neu co; hourly bat buoc duration.
- Index: `(user_id, leave_date)`.
- Thieu: leave entitlement/balance va request group cho dot nghi nhieu ngay.

### `holidays`

- Chuc nang: ngay le rieng cua user.
- PK: `id`; FK: `user_id -> users`; unique `(user_id, holiday_date)`.
- Index: `(user_id, holiday_date)`.

### `daily_notes`

- Chuc nang: work journal theo ngay, ke hoach ngay sau va diem nang suat.
- PK: `id`; FK: `user_id -> users`; unique `(user_id, note_date)`.
- Check: `productivity_score` null hoac 1-5.
- Index: `(user_id, note_date DESC)`.

### `salary_settings`

- Chuc nang: lich su cau hinh luong theo khoang hieu luc.
- PK: `id`; FK: `user_id -> users`.
- Decimal: `NUMERIC(15,2)` cho rate/salary; `NUMERIC(5,2)` cho multiplier.
- Check: tien khong am, effective_to >= effective_from, rate bat buoc theo salary type.
- Index: `(user_id, effective_from DESC)`.
- Thieu: allowances, deductions va payroll snapshots.

## View hien co

### `v_daily_attendance_summary`

- Tong hop session minutes va break minutes theo `attendance_day_id`, tinh `actual_work_minutes`, `difference_minutes`, `overtime_minutes`, `missing_minutes`.
- Session/break dang mo dung `NOW()` nen view thay doi theo thoi gian truy van.
- Backend phai them bo loc `user_id` va tu tinh late/early theo timezone/schedule; frontend khong tu tai toan bo session de aggregate.

## Phan bo sung can thiet

Migration bo sung 12-14 da bo sung cac nhom sau, khong thay the bang hien co:

- Auth: `refresh_tokens`, `password_reset_tokens`, `login_attempts`.
- Profile/settings: cot mo rong tren `users`/`user_settings`, `user_avatars`.
- Work rules: `work_shifts`, `work_schedule_shifts` va `attendance_sessions.shift_id`.
- Integrity: `idempotency_keys`, `audit_logs`.
- Calendar/leave/overtime: `calendar_events`, `leave_balances`, `overtime_sessions`.
- Productivity: `projects`, `tasks`, `task_time_entries`; `daily_notes` tiep tuc lam work journal.
- Payroll: `payroll_adjustments`, `payroll_snapshots`.
- Notification: `notification_settings`, `notifications`, `push_subscriptions`. Google Calendar dung service abstraction/scaffold va chua luu token khi chua co OAuth credentials.

## Migration bo sung da tao

- `12_auth_profile.sql`: profile/preferences, avatar, refresh/reset token va login attempts.
- `13_work_rules_integrity.sql`: work shifts, idempotency, audit va metadata offline.
- `14_management_modules.sql`: calendar, overtime, projects/tasks/timer, leave balance, notifications va payroll history.

Bang moi co `user_id` truc tiep hoac chi truy cap qua quan he toi ban ghi thuoc user; API khong nhan `user_id` nghiep vu tu payload.

## Quy uoc truy van

- Date API dung `YYYY-MM-DD`, time dung `HH:mm`, timestamp luu `TIMESTAMPTZ` va tra ISO UTC.
- Ngay cong duoc xac dinh bang timezone cua `users`, khong cat timestamp theo UTC date.
- Decimal duoc parse/format thanh string o API boundary, khong chuyen qua float.
- History API luon pagination; report dung CTE/aggregate query trong PostgreSQL.
- Khong `SELECT *` cho auth/profile. Backup chi doc cac bang nghiep vu thuoc nguoi dung da xac thuc, khong xuat mat khau, refresh token hay reset token.
