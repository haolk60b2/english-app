# Đồng bộ từng thẻ (protocol 2)

## Cấu trúc

- `cards`: mỗi từ/cụm từ một dòng; nghĩa EN/VI, ví dụ, phiên âm và lịch ôn là cột riêng. Giữ UUID của bảng, thêm `client_id` để khớp mã thẻ đã lưu trên máy.
- `user_progress`: XP, streak, số lượt ôn, mục tiêu ngày.
- `study_sessions`: một dòng cho mỗi ngày học. JSON nhỏ chứa câu hỏi, đáp án, thời gian và mã thẻ; không chứa bản sao các thẻ. Lịch sử buổi học cũ được giữ trong database.
- `library_progress`: mỗi bài học một dòng; bỏ đánh dấu được đồng bộ bằng `is_read=false`.
- `learning_sync_state`: chỉ mã tài khoản, revision, ngày buổi học hiện tại và thời gian cập nhật; không chứa kho từ.
- `learning_data`: giữ nguyên snapshot cũ làm bản dự phòng, chuyển sang chỉ đọc sau migration. App mới không ghi vào bảng này.

App chỉ gửi các thẻ mới/thay đổi, mã thẻ đã xóa, và phần tiến độ thay đổi. `save_learning_changes` ghi cả lần đồng bộ trong một giao dịch, kiểm tra revision dưới khóa dòng để ngăn ghi đè cập nhật từ thiết bị khác. `get_learning_changes` chỉ trả các dòng có revision mới hơn cache. Lần mở trên thiết bị mới cần tải toàn bộ kho từ một lần; những lần sau chỉ tải thay đổi. RPC trả tất cả thay đổi của tài khoản, không bị giới hạn 1.000 dòng của truy vấn bảng mặc định.

## Áp dụng

1. Bạn tự mở Supabase project `nytleycczqwvzpcnvdnb` → SQL Editor → New query.
2. Sao chép toàn bộ file `migrations/20261004170328_normalize_learning_sync.sql`, dán vào SQL Editor rồi bấm Run. File dành cho dự án hiện tại đã có `cards`, `user_progress` và `learning_data`. Migration là giao dịch: chuyển đổi lỗi sẽ rollback cả schema và dữ liệu. Mỗi snapshot chỉ được nhập một lần; chạy lại không ghi đè các thẻ đã cập nhật. Không cần xóa dữ liệu hoặc tài khoản.
3. Kiểm tra số dòng `cards` so với `jsonb_array_length(learning_data.payload->'cards')`, nội dung mẫu, RLS và advisors. Chạy `verify-learning-sync.sql` để kiểm tra đọc/ghi trong giao dịch rollback.
4. Chạy build và triển khai app mới cùng thời điểm chuyển schema. App cũ chỉ biết ghi snapshot sẽ bị chặn ghi; dữ liệu học vẫn ở trên máy và cần mở bản app mới để gửi tiếp.

Website mới: tạo schema cơ sở từ `schema.sql`, bảng snapshot từ migration cũ nếu cần, rồi áp dụng migration chuẩn hóa. Migration `20261004_learning_sync.sql` là bản SQL thủ công từ trước, không phải lịch sử CLI của dự án; giữ để tham khảo và dựng fixture kiểm tra.

Sau khi chạy, dùng truy vấn sau để kiểm tra số thẻ. `cards` cần có từng thẻ riêng; `learning_data` vẫn giữ bản dự phòng cũ nên còn một dòng cho mỗi tài khoản là bình thường.

```sql
select
  (select coalesce(sum(jsonb_array_length(payload->'cards')), 0) from public.learning_data) as cards_in_old_backup,
  (select count(*) from public.cards where deleted_at is null) as cards_in_new_table,
  (select count(*) from public.learning_sync_state) as synced_accounts;
```

Các URL đăng nhập được cấu hình trong Authentication → URL Configuration:

- `http://localhost:3000/settings`
- `http://localhost:3012/settings` (bản xem thử)
- `https://english-app-six-rouge.vercel.app/settings`

## Dùng app

Mở Cài đặt → Tài khoản & đồng bộ Supabase → đăng nhập. Dữ liệu khách trên máy được nhập vào tài khoản ở lần đầu; từ trùng được ghép theo nội dung từ, giữ ID cloud ổn định. Khi chuyển thiết bị/địa chỉ web, đăng nhập cùng tài khoản. LocalStorage không tự chuyển giữa localhost và Vercel; cần đăng nhập ở địa chỉ đang giữ dữ liệu cũ để gửi dữ liệu đó.

Cache từng tài khoản tách biệt. Mất mạng vẫn học được; thay đổi chờ nằm trên máy và được gửi khi có mạng, khi quay lại cửa sổ hoặc mỗi phút. Nếu hai thiết bị đều sửa từ lần đồng bộ trước, app yêu cầu chọn bản và giữ cả hai bản trong bản sao nội bộ. Tải bản sao JSON trước khi chọn. RLS chỉ cho tài khoản đã đăng nhập đọc/ghi dòng của mình. RPC dùng SECURITY INVOKER, không bỏ qua RLS, và khách không được gọi RPC. Khóa AI, mật khẩu và âm thanh không nằm trong dữ liệu học gửi lên Supabase.

Giới hạn hiện tại: app tải kho từ vào bộ nhớ và lưu offline bằng localStorage, phù hợp kho từ cá nhân; không phải giao diện duyệt hàng triệu thẻ. Màn hình học hiển thị một buổi hiện tại, dù database giữ các buổi cũ. XP khi nhập dữ liệu khách lần đầu lấy giá trị lớn hơn giữa máy/cloud để tránh đếm lại cùng tiến độ.

## Kiểm tra cục bộ

```powershell
node --test --test-isolation=none tests/cloud-sync.test.cjs
```

Kiểm tra SQL chạy trong Postgres WASM PGlite, được cài tạm ngoài dependencies của app:

```powershell
npm install --prefix "$env:TEMP/english-app-pglite" --no-save --package-lock=false @electric-sql/pglite@0.5.8
$env:PGLITE_MODULE = Join-Path $env:TEMP 'english-app-pglite/node_modules/@electric-sql/pglite'
node --test --test-isolation=none tests/normalized-sql.test.cjs
```

Các trường hợp: chuyển snapshot và giữ bản dự phòng, chạy migration lại, đọc/ghi từng tài khoản, chặn thay đổi chủ thẻ, revision cũ, rollback batch lỗi, xóa mềm, bỏ đánh dấu bài, giữ lịch sử buổi học, và kho 10.000 từ chỉ gửi một thẻ khi sửa một từ.
