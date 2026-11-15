# CLI và giới hạn

## Danh tính

- `browser`: loại executable đã xác định (`chrome`, `chromium`), không phải tên profile. Runtime hiện tại nhận Chrome cài ở đường dẫn Google/Chrome/Application và Chromium Playwright/chromium; executable phân phối khác trả unknown và không được tự launch.
- `instance`: PID browser gốc, không phải renderer PID hoặc số tab.
- `user-data-dir`: root chứa Local State và các thư mục profile.
- `profile-directory`: directory key thực tế như `Default`, `Profile 1`; khác `displayName` có thể trùng/là Unicode.
- `endpoint`: HTTP loopback có port rõ ràng. Harness đối chiếu netstat owner, CDP browser PID và CDP browser command line. Không chấp nhận endpoint máy khác, credentials hoặc proxy owner PID khác.

`doctor` suy luận root mặc định của Chrome từ vị trí cài đặt khi process không có flag; trường này ghi `rootSource: standard-chrome-location`, không dùng nó để khẳng định profile đang active. Kết nối vẫn đòi `--profile-directory` rõ trong command line và xác minh lại qua CDP. Quyền không đủ đọc process có thể dẫn tới BLOCKED, không phải browser không tồn tại.

## Giao diện

`--help` là nguồn command/options chuẩn, capability map cung cấp ngữ nghĩa. Các option là cặp `--name value`, không dùng `--name=value`. Guest Profile và System Profile không được liệt kê là profile persistent có thể chọn. Không có interactive prompt trong CLI; agent áp dụng bảng quyết định profile/URL trong SKILL.md; chỉ hỏi lựa chọn profile còn mơ hồ hoặc thiếu thông tin cần thiết.

`doctor` kiểm kê OS, binaries, processes và roots. `profiles` chỉ đọc metadata root đã chỉ định. `connect` và `tabs` cần root/profile có sẵn, optional `--instance`, `--endpoint`, `--browser`, `--executable`. `open` nhận `--url` tùy chọn (HTTP(S) không có credentials hoặc đúng `about:blank`); bỏ URL sẽ mở `about:blank` mà không cần hỏi; nếu cần launch phải chọn kind hoặc executable rõ ràng. `verify` thêm `--target` và `--url`; có thể dùng `--expect-title` cho open/verify. Mọi command có `--timeout`.

Khi launch, harness chỉ chạy browser bằng root/profile tồn tại, explicit profile-directory, local debugging port và GUI. Browser tồn tại độc lập với CLI. `--enable-automation` cho phép đọc lại browser command line qua CDP để đối chiếu profile. Kết thúc WebSocket chỉ disconnect client; không gửi Browser.close. Start-Process chạy trên host; trong môi trường GUI bị cô lập có thể tạo process mà chưa có cửa sổ người dùng thấy. `GUI_NOT_OBSERVED` không được coi là PASS.

## Failure cases

| Code | Hành động |
| --- | --- |
| PROFILE_NOT_FOUND / PROFILE_METADATA_INVALID | Chọn lại directory từ metadata có thật; không tạo profile. |
| BROWSER_NOT_FOUND / BROWSER_AMBIGUOUS / BROWSER_UNSUPPORTED | Chọn executable đã xác định qua doctor. Không giả download/install. |
| PROFILE_UNVERIFIED / PROFILE_MISMATCH | Dừng thao tác tab, xác định lại profile. Không reset login. |
| INSTANCE_NOT_CONNECTABLE | Browser không có TCP CDP hoặc dùng pipe của client khác; dùng kết nối client đó hoặc báo BLOCKED. |
| ENDPOINT_OWNER_MISMATCH / BROWSER_PID_MISMATCH | Endpoint không thuộc đúng PID; không tiếp tục. |
| DEFAULT_CHROME_CDP_UNSUPPORTED | Harness không tự launch CDP vào default user-data-dir Chrome hiện đại; không thay thế bằng profile trắng. |
| CONNECTION_FAILED / CDP_ERROR / TIMEOUT | Kiểm tra lại runtime và effects. Không kill browser để thử lại. |
| GUI_NOT_OBSERVED / VERIFICATION_FAILED | Báo phần chưa xác minh; kiểm tra đúng host/target/URL. |

Nếu gặp timeout sau launch, `effects.browserStartedPid` có thể tồn tại; sau tạo tab có `effects.tabCreatedId`. Nếu helper timeout đúng lúc spawn trước khi trả PID, effects có thể chưa ghi được; luôn chạy doctor trước retry. Không tự rollback bằng đóng browser.

## Tests

```powershell
node --test <skill-dir>/tests/harness.test.mjs <skill-dir>/tests/live.test.mjs
```

Live test chỉ chạy khi có `CHROMIUM_OPEN_ROOT`, `CHROMIUM_OPEN_EXE` và optional `CHROMIUM_OPEN_PROFILE` (mặc định `Default`). Root/profile phải tồn tại và được chọn cho bài test. `CHROMIUM_OPEN_EVIDENCE` là file JSON bằng chứng do người chạy chỉ định. Không dùng profile khác nếu selection lỗi.

Test live mở một tab HTTP cục bộ có marker, kiểm tra DOM/title, HTTP request counter, `/json/list`, host window, rồi gọi connect/tabs/verify bằng các CLI mới sau opener thoát. Nó giữ browser/tab, chỉ đóng HTTP fixture server. Fixture URL không phục vụ reload sau khi test kết thúc.

Unit tests có synthetic profile metadata và mock tại boundary CDP cho kiểm tra routing; chúng không được coi là chứng minh browser thật. Test connection-refused dùng TCP thật đã đóng. Những file fixture chỉ nằm trong temp test directory, không được dùng để launch Chromium.

## Nguồn thiết kế và runtime

Áp dụng cấu trúc harness + doctor + bản đồ hành vi và bằng chứng quan sát độc lập từ [verification-skill-example](https://github.com/poteto/verification-skill-example). Không mang app test framework, checkout setup, clone auth hoặc cleanup browser của ví dụ vào utility này. Repository tham khảo không cung cấp implementation driver; harness của skill này được triển khai riêng.

- [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/).
- [Chrome remote debugging và default profile](https://developer.chrome.com/blog/remote-debugging-port).
- [Agent Skills trong Antigravity](https://antigravity.google/docs/skills).

## MCP host transport cho Antigravity

Server stdio `scripts/mcp-server.mjs` cung cấp sáu command TCP CLI và tool native_launch riêng dưới dạng tool, không nhận shell command và không mở rộng capability. Nó spawn cùng `browse-open.mjs`, giữ mọi guard/profile/timeout và không giữ quyền sở hữu browser sau lệnh.

Đăng ký một lần qua cơ chế MCP chính thức của client, từ môi trường host đã được phép:

```powershell
agy mcp add browse_open -- node "<absolute-skill-dir>/scripts/mcp-server.mjs"
```

Khởi động cuộc hội thoại mới để nạp server. Khi chạy CLI không tương tác, file `tests/antigravity.session.json` cung cấp rule cho các tool đã liệt kê; có thể truyền `--settings <skill-dir>/tests/antigravity.session.json` nếu phạm vi task cho phép các thao tác đó. File không cấp quyền shell và không tắt sandbox. Cho phép các tool cụ thể theo phạm vi task; không dùng bỏ qua toàn bộ quyền. MCP server phải do client host khởi chạy với quyền quan sát process và localhost; cấu hình này không tự cấp quyền vượt chính sách máy. Nếu server cũng bị cô lập, báo BLOCKED thay vì tạo đường chuyển desktop hoặc service.

Ví dụ Antigravity wrapper sau khi đọc schema:

```json
{"ServerName":"browse_open","ToolName":"profiles","Arguments":{"userDataDir":"<existing-root>"}}
```

Với `open`, truyền root/profile đã chọn, URL tùy chọn (mặc định `about:blank`), browser/executable và optional instance/endpoint theo cùng contract CLI. MCP chỉ đổi transport; bản thân `run_command` không trở nên có quyền CIM nhờ việc cài skill.

## Cold-start acceptance runner, chỉ dùng khi được phép đóng browser thử

`node <skill-dir>/tests/antigravity-cold.mjs 10` là bài nghiệm thu dự án, dùng profile automation đã tồn tại `secrets/chrome-chromium-profile` / `Default` trong workspace hiện tại. Nó cần Antigravity CLI, project tương ứng và MCP server đã đăng ký. Không chạy lệnh này trên profile có công việc cần giữ mở: runner sẽ đóng tab và toàn browser của đúng profile thử sau mỗi lượt, theo chấp thuận riêng cho bài test. Nó xác minh profile/PID/port trước khi đóng và dừng nếu cleanup không thành công. Không tạo profile mới và không thay thế bằng profile khác.

Để tái hiện trên môi trường khác, phải chọn lại profile test có sẵn được phép đóng và cấu hình project/model cho môi trường đó. Đây không phải lệnh cleanup mặc định của skill.


## Hai nhánh của browse-open

`SKILL.md` là router. [Chromium](chromium.md) dùng TCP CLI; [Chrome native](chrome-native.md) dùng native launcher và chỉ điều khiển qua kết nối được cấp quyền sẵn. MCP có thêm `native_launch`; tool này chỉ gửi yêu cầu mở profile native, không đảm bảo DOM/target và không tự bật debugger. Chạy `node <skill-dir>/scripts/native-launch.mjs --help` để xem interface.

Sau nâng cấp từ chromium-open: đổi thư mục cài thành browse-open, cập nhật tên skill invocation `$browse-open` và đăng ký lại `browse_open` với đường dẫn mới. Không giữ server utility cũ trỏ đến thư mục đã đổi tên. Client đang chạy có thể cần phiên mới để tải schema mới. Không sửa/xóa server browser khác khi di chuyển entry utility.
