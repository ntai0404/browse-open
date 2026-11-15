# CLI và MCP

Node >=22, Windows PowerShell, host có quyền process/GUI/loopback. Không cần npm dependencies. Entry point `scripts/browse-open.mjs`; `--help` trả danh sách command/options chuẩn. Tham số theo cặp `--name value`, không dùng `--name=value`.

## Command

- doctor: chỉ kiểm kê OS, executable/kind, instance và root; Chrome Stable có thể được thấy trong inventory nhưng không thuộc nhánh launch được hỗ trợ.
- profiles: `--user-data-dir ROOT`; directory key + tên hiển thị; không tạo profile.
- connect/tabs: root/profile, optional instance/endpoint/browser/executable; kiểm tra owner PID, CDP browser PID và command-line root/profile.
- open: selection như trên; `--url` optional mặc định about:blank, `--expect-title` optional. Browser kind chỉ chromium. Reuse đúng instance hoặc launch đúng executable với root automation chưa dùng. Default personal roots bị chặn.
- verify: selection + `--target ID --url EXACT` và optional expect-title.
- read: selection + target/url, optional `--selector CSS`; trả text/value bounded, không trả password/file value.
- fill: selection + target/url + selector + `--value TEXT`; value rỗng hợp lệ. Dùng Input.insertText rồi kiểm tra DOM readback. Chỉ input/textarea thông thường.
- click: selection + target/url + selector; kiểm tra khả năng tương tác rồi dispatch input vào element; cần read lại kết quả mong muốn.

Mọi command có timeout mặc định 20000ms, range 500..120000. stdout đúng một JSON, schemaVersion 1, status, data/error, effects. Exit 0 PASS, 2 invalid input, 3 BLOCKED precondition, 4 connection/timeout, 5 verification/internal error. Đọc effects cả khi FAIL để tránh retry tạo tab/click trùng. Click timeout không chứng minh chưa click.

## MCP host

```powershell
agy mcp add browse_open -- node "<absolute-skill-dir>/scripts/mcp-server.mjs"
```

Bắt đầu conversation mới khi nâng cấp để tải lại schema. Server có đúng 9 command nêu trên. Không có native_launch, arbitrary eval, shell hoặc close/restart. Antigravity ưu tiên MCP host khi run_command bị cô lập; nếu host cũng không đủ quyền thì BLOCKED.

Ví dụ: `{"ServerName":"browse_open","ToolName":"fill","Arguments":{"browser":"chrome-beta","userDataDir":"<root>","profileDirectory":"Default","instance":123,"endpoint":"http://127.0.0.1:9222","target":"<id>","url":"http://127.0.0.1:8080/proof","selector":"#value","value":"proof"}}`.

Giữ browser sau disconnect. Không xóa lock, restart Chrome, chiếm pipe hay đổi profile để né lỗi. Endpoint phải loopback HTTP host:port; owner phải đúng browser PID. Redirect: xác minh URL đích rõ ràng, không tự chấp nhận mọi redirect.

## Tests

`node --test tests/harness.test.mjs tests/mcp.test.mjs tests/chromium.test.mjs` cho boundary tests; mock được ghi rõ, không phải runtime browser proof.

`tests/live.test.mjs` là opt-in với CHROMIUM_OPEN_ROOT/PROFILE/EXE; chọn BROWSE_OPEN_BROWSER=chromium cho Beta. Không suy rộng bài kiểm thử trang local sang mọi website.

Các batch Antigravity Chromium trong tests là tool nghiệm thu riêng có profile/project/model assumptions. Cold runner đóng browser thử theo chấp thuận riêng; không chạy trên profile đang làm việc. Các runner Chrome Stable/native đã bỏ; log cũ giữ local và không đưa vào ZIP/repo. Xem [verification](verification.md) để phân biệt lịch sử với phiên bản hiện tại.
