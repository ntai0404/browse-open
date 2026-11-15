# Chrome native: profile cá nhân do người dùng chọn

## Phạm vi và điều kiện không hộp thoại

Chrome native là executable Chrome cài trên máy và đúng user-data-dir/profile đang dùng; Playwright Chromium hay bản sao profile không thay thế được.

- Mở tab native bình thường không cần bật remote debugging. Launcher thực hiện yêu cầu mở bằng executable + root + directory rõ ràng.
- Điều khiển DOM/click/input cần kết nối automation đã được cấp quyền. Không tự gọi `connectOverCDP('chrome')`/`--autoConnect` để thử khi người dùng không chấp nhận hộp thoại: kết nối mới có thể yêu cầu quyền ngay trên Chrome.
- Với Chrome native mặc định đang chạy mà không có kết nối hợp lệ, **điều khiển là BLOCKED**. Không có cách được triển khai trong skill để tự cấp quyền hoặc bỏ qua prompt. Đây là giới hạn thực tế, không phải lý do đổi sang Chromium.

Chrome chính thức mô tả autoConnect, toggle tại `chrome://inspect/#remote-debugging` và hộp thoại cho kết nối mới: [Chrome DevTools MCP](https://developer.chrome.com/blog/chrome-devtools-mcp-debug-your-browser-session). CDP flags không còn được Chrome 136+ chấp nhận trên default user-data-dir: [remote debugging changes](https://developer.chrome.com/blog/remote-debugging-port). Không thêm flags rồi restart Chrome của người dùng.

## 1. Chọn đúng profile

1. Doctor xác định executable native. Profiles đọc root Chrome thật, thường là `%LOCALAPPDATA%/Google/Chrome/User Data`.
2. Đưa danh sách directory + displayName cho người dùng chọn. Không dùng lựa chọn Chromium cũ làm lựa chọn Chrome native. Không suy ra profile từ tiêu đề cửa sổ hay root chung chứa nhiều profile.
3. Kiểm tra lại lựa chọn. Thiếu root/Preferences thì BLOCKED; không tạo/copy session. Giữ lựa chọn trong task và cho phép đổi theo yêu cầu.

## 2. Mở không hộp thoại debugger

```powershell
node <skill-dir>/scripts/native-launch.mjs --executable "<installed-Chrome.exe>" --user-data-dir "<existing-native-root>" --profile-directory "<chosen-directory>"
```

URL mặc định `about:blank`. Thêm `--url <HTTP(S)>` khi task chỉ định trang. MCP tương đương: `browse_open/native_launch`, arguments `executable`, `userDataDir`, `profileDirectory`, optional `url`, `timeout`.

`PASS` của native-launch chỉ nghĩa yêu cầu Start-Process đã được gửi. JSON luôn ghi `assurance: LAUNCH_REQUEST_ONLY`, `tabVerification: NOT_TESTED`, `control: NOT_TESTED`. Request PID có thể thoát ngay vì Chrome chuyển yêu cầu sang process đang chạy; không coi nó là PID sở hữu tab. Không báo “đã điều khiển được”.

Không có thao tác tắt Chrome, reset profile, ghi preferences hay tự bật debugging. Native browser vẫn có thể tự hiện UI đăng nhập hoặc UI do chính nó quản lý; launcher không cam kết Chrome sẽ không bao giờ hiện bất kỳ hộp thoại nào.

## 3. Điều khiển khi đã có kết nối được cấp quyền

Khảo sát tool theo tab của client trước. Chỉ dùng kết nối đang hoạt động được cấu hình rõ hoặc endpoint TCP đã được cấp quyền và đối chiếu ownership; không gọi server auto-launch dùng profile riêng.

- Nếu instance có root/profile arguments tường minh và TCP CDP: có thể dùng CLI `browse-open.mjs connect --browser chrome --instance <pid> --endpoint <loopback> --user-data-dir <root> --profile-directory <directory>`. Các guard ownership của harness giữ nguyên. Chrome cá nhân thiếu profile arguments có thể bị guard từ chối; không sửa guard để đoán profile.
- Nếu client đã gắn sẵn vào Chrome native bằng cơ chế chính thức: kiểm tra thông tin connection, executable và profile path thực tế. Dùng tool browser để đọc `chrome://version` trong profile đã chọn nếu tool hỗ trợ. Đối chiếu `Profile Path` với root/directory; không đưa toàn bộ command line/version page vào log công khai. Client không cung cấp bằng chứng profile thì BLOCKED, không dùng tên tài khoản trên website để đoán.
- Với nhiều context/profile, profile path của một tab không chứng minh mọi tab thuộc profile đó. Chỉ thao tác target/context được client gắn với profile đã xác minh. Không xác định được context nào thì BLOCKED.

Agent đọc schema tool thực tế; tên tool dưới đây là ví dụ Chrome DevTools MCP, không phải lệnh giả do harness cung cấp:

1. `list_pages`: lấy page ID thật, chọn tab đúng task trong context đúng profile.
2. `new_page` khi cần mở tab; không navigate tab người dùng đang làm việc nếu task chỉ yêu cầu thêm tab.
3. `select_page` rồi `take_snapshot`: xác minh URL/nội dung, lấy UID thực từ snapshot mới.
4. `fill`/`click`/`press_key` theo schema client và phạm vi task. Không dùng UID/selector của snapshot cũ sau navigation. Không mặc định gửi message, submit hoặc xóa dữ liệu chỉ để thử.
5. Snapshot/DOM đọc lại sau thao tác: input có đúng giá trị, click có kết quả mong đợi, URL/tab đúng. Một tool trả success không đủ chứng minh kết quả.
6. Ngắt client khi xong nếu cần; giữ Chrome và phiên đăng nhập. Không gọi Browser.close.

Nếu cần test input/click, dùng trang local tạm có input/button và marker, do task cho phép mở. PASS của trang test không chứng minh Google Docs hay mọi website đều thao tác được.

## Trạng thái hỗ trợ

| Capability | Implementation | Bằng chứng runtime |
| --- | --- | --- |
| List native profiles | CLI/MCP profiles, chỉ đọc metadata | Đã liệt kê root thật trên máy |
| Native profile launch | native-launch.mjs / native_launch | PASS launch request trên Chrome 157.0.8103.78; đã chọn Profile 1, PID 8648, host thấy cửa sổ about:blank; DOM chưa xác minh |
| Native TCP attach có ownership/profile arguments rõ | Harness TCP hiện có | BLOCKED: native PID 8648 không có TCP CDP, connect trả INSTANCE_NOT_CONNECTABLE |
| Điều khiển qua client đã cấp quyền | Contract dùng tool của client, không thêm general automation framework | BLOCKED hiện tại: chưa có kết nối native được chứng minh, người dùng không chấp nhận prompt |
| Tự cấp quyền / bypass prompt / copy profile | UNSUPPORTED | Không triển khai |
