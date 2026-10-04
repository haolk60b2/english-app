# Đồng bộ dữ liệu học

1. Mở dự án Supabase khớp `NEXT_PUBLIC_SUPABASE_URL` trong `.env`.
2. Chạy `migrations/20261004_learning_sync.sql` trong **SQL Editor**. Migration không xóa các bảng từ vựng cũ.
3. Trong **Authentication → URL Configuration**, cho phép các URL trả về:
   - `http://localhost:3000/settings` (phát triển)
   - `http://localhost:3012/settings` (bản xem thử kiểm tra)
   - `https://english-app-six-rouge.vercel.app/settings` (bản triển khai hiện tại)
   - URL `/settings` của các địa chỉ khác bạn dùng để mở app.
4. Bật Email provider trong Authentication. Mở app → **Cài đặt → Tài khoản & đồng bộ Supabase** → đăng nhập qua email hoặc mật khẩu tài khoản đã có.
5. Sau đăng nhập, app nhập dữ liệu đang học trên máy vào tài khoản. Kiểm tra **Đã đồng bộ** rồi xem dòng của tài khoản trong `public.learning_data`.

## Dữ liệu

`payload` chứa từ vựng và lịch ôn, tiến độ/XP, buổi học 30 phút hiện tại, danh sách tài liệu đã học. Khóa AI và bản ghi âm không được đưa vào payload. RLS và quyền bảng chỉ cho tài khoản đã đăng nhập đọc/ghi dòng có `user_id = auth.uid()`; khách không được truy cập bảng.

Dữ liệu gốc vẫn được lưu trong localStorage. Cache từng tài khoản tách biệt; đăng xuất khôi phục dữ liệu khách trước khi đăng nhập. Các thiết bị tự đồng bộ sau thay đổi, khi có mạng, khi quay lại cửa sổ và mỗi phút. Khi mất mạng hoặc yêu cầu ghi lỗi, dữ liệu chờ vẫn nằm trên máy.

`revision` dùng kiểm tra cập nhật đồng thời. Khi cả máy và Supabase đều thay đổi từ lần đồng bộ trước, app yêu cầu chọn bản sử dụng. Không âm thầm ghi đè bản trên thiết bị khác. Tải bản sao JSON trước khi chọn; bản local và cloud cũng được giữ nội bộ trong localStorage với tiền tố `english-app-cloud-backup:`. Giới hạn: số lượt ôn/XP từ dữ liệu khách và cloud khi nhập lần đầu lấy giá trị lớn hơn, không cộng để tránh đếm lại cùng dữ liệu; nếu có buổi học cùng ngày trên cloud, giữ buổi học cloud. App hiện lưu một buổi học, không có lịch sử đầy đủ mọi ngày.

Khi chuyển địa chỉ web (localhost → Vercel), localStorage không tự chuyển. Đăng nhập và đồng bộ trên địa chỉ cũ trước, rồi mở cùng tài khoản trên địa chỉ mới. Cấu hình hai biến `NEXT_PUBLIC_SUPABASE_*` trong Vercel và triển khai lại để dùng chức năng mới.

## Kiểm tra

Kiểm tra logic: `node --test --test-isolation=none tests/cloud-sync.test.cjs`.
Kiểm tra RLS trực tiếp: chạy `verify-learning-sync.sql` trong SQL Editor sau khi có ít nhất một tài khoản Auth. File này kiểm tra ghi/đọc của chủ tài khoản, chặn truy cập tài khoản khác và kiểm tra revision cũ, rồi rollback toàn bộ dữ liệu thử.

- Hai tài khoản không đọc/ghi được dữ liệu của nhau; khách không đọc được bảng.
- Thêm từ, đánh dấu bài đã học, học rồi tải lại trang; dữ liệu giữ nguyên.
- Đăng nhập cùng tài khoản trên trình duyệt khác để tải dữ liệu.
- Mất mạng → thay đổi → nối mạng để gửi bản chờ.
- Hai thiết bị cùng sửa phải hiện chọn bản; cập nhật revision cũ không được ghi đè.
