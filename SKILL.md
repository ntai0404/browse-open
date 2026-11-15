---
name: browse-open
description: Opens Chromium or the user's installed native Chrome on Windows with an explicitly selected profile. Discovers existing sessions, reuses authorized browser connections, and verifies tabs while preserving login sessions. Use the Chromium harness or the native Chrome branch according to the requested browser.
---

# Browse Open

Một skill, hai nhánh. Chọn đúng browser trước khi gọi tool có thể launch; không dùng profile automation thay cho Chrome native của người dùng.

## Router bắt buộc

1. Khảo sát tool browser/MCP, OS, executable, PID, root và khả năng kết nối bằng `node <skill-dir>/scripts/browse-open.mjs doctor` hoặc MCP `browse_open/doctor` trên host. Doctor không chứng minh browser điều khiển được.
2. Người dùng nói Chromium hoặc Chrome for Testing: đọc [nhánh Chromium](references/chromium.md), dùng TCP harness có sẵn. Người dùng nói Chrome native, Chrome đang dùng, phiên đăng nhập cá nhân: đọc [nhánh Chrome native](references/chrome-native.md). Nếu chưa rõ và không có lựa chọn đang dùng trong task, hỏi loại browser; không tự chuyển loại.
3. Liệt kê profile bằng `profiles --user-data-dir <root>`. Với native, mặc định khảo sát `%LOCALAPPDATA%/Google/Chrome/User Data`; xác minh executable là Chrome cài trên máy, không phải Playwright. Danh tính là executable + root + directory, displayName chỉ để đọc.
4. Người dùng tự chọn profile native: đưa danh sách đánh số trước lần mở đầu tiên, kể cả khi chỉ có một profile; giữ nguyên lựa chọn cho các lần sau trong cùng task. Cho phép yêu cầu đổi. Nếu không có profile hợp lệ, báo BLOCKED, không tạo/copy profile. Chromium áp dụng bảng quyết định riêng trong nhánh của nó.
5. Không có URL và chỉ yêu cầu mở GUI/tab: mở `about:blank`, không hỏi URL và không tự mở Google. Có URL task thì dùng đúng URL. Không tự chuyển sang trang trắng khi URL task lỗi.

## Giao diện

- Chromium hoặc TCP đã cấp quyền: `scripts/browse-open.mjs`, [CLI](references/cli.md), MCP `browse_open`.
- Mở Chrome native với profile đã chọn, không bật debugger: `scripts/native-launch.mjs`, theo [contract native](references/chrome-native.md). Đây là mở cửa sổ/tab; không phải bằng chứng điều khiển được.
- Điều khiển native: chỉ qua kết nối browser đã cấp quyền và đã xác minh đúng profile. Tái sử dụng tool theo tab của client; không tự phát minh lệnh desktop. Không tự gọi autoConnect khi chưa biết kết nối đã được cấp quyền, vì nó có thể hiện hộp thoại.

## Ràng buộc phiên

Không restart/tắt browser, xóa lock/profile, sao chép cookie, tự bật debugger, thay profile hoặc tự bấm hộp thoại cấp quyền. Người dùng hiện không chấp nhận thao tác hộp thoại: nếu không có kết nối được cấp quyền sẵn, báo `BLOCKED` cho phần điều khiển. Có thể mở native bằng launcher bình thường khi task yêu cầu mở, nhưng phải tách kết quả mở và kết quả điều khiển.

Không tuyên bố “Chrome native hoạt động” chỉ vì Chromium chạy được hoặc native có process/window handle. Cần kiểm tra executable, profile path, tab ID, URL/DOM và kết quả thao tác đọc lại. Thiếu một phần thì ghi FAIL/BLOCKED/NOT_TESTED đúng phạm vi. Không bắt buộc hỏi xác nhận trực quan sau mỗi lần mở.

## Cài đặt và kiểm chứng

Đọc [CLI và MCP](references/cli.md), [capability map](references/capabilities.json) khi cần schema/exit code. [Lịch sử kiểm chứng](references/verification.md) phân biệt runtime với mock; kết quả cũ có profile/URL sẵn không chứng minh chọn profile tự động.
