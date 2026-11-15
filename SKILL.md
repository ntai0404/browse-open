---
name: chromium-open
description: Opens and verifies Chrome or Chromium tabs on Windows through an executable CLI harness. Use to discover browsers, list and select profile directories, safely reuse a running CDP instance, launch an existing profile, or diagnose browser connection failures without losing login sessions.
---

# Chromium Open

Dùng CLI của skill để khảo sát, chọn đúng profile và mở tab. Không tự phát minh lệnh launch ngoài harness.

## Antigravity: chọn transport trước

Nếu client đã có MCP server `chromium_open`, dùng các tool cùng tên command của server đó (`doctor`, `profiles`, `open`, `verify`...) để gọi chính harness trên host. Trong Antigravity ưu tiên đường này; `run_command` có thể bị cô lập, chặn CIM/network dù tiến trình CLI bên ngoài chạy trên host. Không lặp lại `doctor` trong terminal khi nó đã trả `HOST_INSPECTION_FAILED`.

Tool arguments dùng camelCase: `userDataDir`, `profileDirectory`, `instance`, `endpoint`, `executable`, `browser`, `url`, `target`, `expectTitle`, `timeout`. Đọc schema tool do client công bố; không đoán file `instructions.md`. Kết quả vẫn là JSON của CLI, có thêm `transport.exitCode`. Không tính lời báo SUCCESS của agent là bằng chứng.

Nếu server chưa có, đọc phần MCP trong [CLI reference](references/cli.md). Không bỏ guard profile/ownership để né sandbox. Agent có terminal host đã được cấp quyền vẫn gọi CLI trực tiếp theo contract dưới đây.

## Execution contract

Gọi `node <skill-dir>/scripts/chromium-open.mjs --help` trước nếu chưa biết giao diện. `<skill-dir>` là thư mục chứa file này, không phụ thuộc cwd. Harness dùng Node >=22 có WebSocket native và PowerShell trên Windows; không cần npm install. Chạy trên host có quyền process/GUI bằng cơ chế chính thức của agent.

Mỗi lệnh trả đúng một object JSON trên stdout, `schemaVersion: 1`, `status`, `command`, `data` hoặc `error`, và `effects`. Exit code phải khớp kết quả. Timeout mặc định 20.000 ms; `--timeout` chấp nhận 500..120.000 ms cho toàn thao tác.

## Khảo sát và chọn

1. Chạy `doctor`; kiểm kê browser, executable, root và instance. Nếu người dùng yêu cầu Chromium, không dùng Chrome thay thế chỉ vì nó đang chạy. `doctor.roots` không quét mọi thư mục trên đĩa: kiểm tra thêm root được người dùng/cấu hình workspace chỉ định; không đoán bừa hoặc đọc cookie/password.
2. Chạy `profiles` cho các root ứng viên. Danh tính lựa chọn là **browser/executable + user-data-dir + profileDirectory**, không phải displayName. Chỉ tính profile hợp lệ: `exists: true`, root có `Local State`, và `profile` được harness chấp nhận; metadata cũ không phải profile dùng được.
3. Áp dụng bảng quyết định dưới đây trước `open`. Khi hỏi, giữ nguyên danh sách đã đánh số để hiểu câu trả lời như “cái thứ 2”. Chỉ hỏi thông tin còn thiếu; không hỏi lại lựa chọn đã rõ.
4. Tái sử dụng instance đúng lựa chọn nếu TCP CDP được xác minh. Không đổi profile để né lỗi kết nối. Pipe thuộc client khác phải dùng client đó hoặc báo `BLOCKED`.

| Trường hợp | Hành động của agent |
| --- | --- |
| Người dùng chỉ định/chuyển profile | Dùng đúng root/directory được chỉ định; yêu cầu mới ghi đè lựa chọn trước. Nếu chỉ nêu tên hiển thị và có trùng tên, hỏi để phân biệt. |
| Đã chọn trong cuộc hội thoại/cấu hình workspace rõ ràng | Kiểm tra lại sự tồn tại và dùng tiếp; không hỏi lại chỉ vì có profile khác. Không tự lưu cấu hình lâu dài. |
| Chưa chọn, chỉ có một profile hợp lệ đúng loại browser | Dùng profile đó và nêu root/directory trong kết quả. |
| Chưa chọn, có nhiều profile hợp lệ | Hỏi một lần bằng danh sách đánh số: browser, root, directory, displayName và tình trạng kết nối. Không ưu tiên tùy tiện profile đầu tiên, profile tên Default hay instance đang chạy. Chọn một profile không phải chạy lần lượt mọi profile. |
| Không tìm được profile hợp lệ | Báo `BLOCKED`: không có profile có thể dùng trong các root đã kiểm tra. Hỏi đường dẫn profile có sẵn nếu chưa được cung cấp. Harness **chưa hỗ trợ tạo profile**, kể cả khi người dùng đồng ý; nói rõ giới hạn đó, không tạo thư mục/Preferences giả và không lặp `open` vào đường dẫn thiếu. |
| Profile đã chọn bị mất/không hợp lệ | Báo lỗi lựa chọn đó; hỏi root/directory đúng hoặc cho phép chọn lại. Không âm thầm chuyển sang profile khác. |
| Profile đúng đang chạy nhưng không kết nối được | Khảo sát lại một lần; dùng kết nối chính thức khác nếu có. Nếu vẫn thiếu quyền/CDP, báo `BLOCKED`, giữ session; không đóng/restart hoặc đổi profile. |

## Chọn trang cần mở

- Người dùng chỉ yêu cầu “mở Chrome/Chromium GUI”, “mở tab” mà không nêu trang: **mở `about:blank`, không hỏi URL**. Có thể bỏ `url` khi gọi `open`; CLI và MCP cùng áp dụng mặc định này. Verify bằng URL `about:blank` và target ID nhận được.
- Có URL rõ ràng trong yêu cầu/ngữ cảnh task đang tiếp tục: dùng URL đó. Không tái dùng URL của một task cũ không liên quan.
- Có tên dịch vụ và một địa chỉ chính thức đã xác định rõ trong ngữ cảnh: dùng địa chỉ đó. Chỉ hỏi khi việc chọn trang còn mơ hồ và ảnh hưởng đến task, hoặc URL đã chỉ định không được hỗ trợ; không thay URL lỗi bằng trang trắng rồi báo task thành công.
- Hỗ trợ HTTP(S) không có credentials và đúng `about:blank`. Không tự mở Google/example.com như trang mặc định. Các URL nội bộ khác (`chrome://`, `file:`, `data:`, `javascript:` và biến thể `about:`) chưa hỗ trợ.

## Gọi thao tác

```powershell
node <skill-dir>/scripts/chromium-open.mjs doctor
node <skill-dir>/scripts/chromium-open.mjs profiles --user-data-dir "<root>"
node <skill-dir>/scripts/chromium-open.mjs connect --user-data-dir "<root>" --profile-directory "<directory>" --instance <pid>
node <skill-dir>/scripts/chromium-open.mjs open --browser chromium --executable "<exe>" --user-data-dir "<root>" --profile-directory "<directory>" --url "https://example.com/"
```

`open` dùng lại instance trùng root khi có thể; chỉ launch nếu root chưa được browser nào sử dụng và executable đã chọn rõ. Không tự tạo profile. Bỏ `--executable` chỉ khi `doctor` có đúng một executable thuộc loại đã chọn. `--instance` và `--endpoint` giới hạn kết nối vào phiên đã có, không cho phép tự launch khi phiên đó mất.

Sau `open`, giữ `endpoint`, PID và `page.targetId` từ JSON. Dùng `tabs` để xem tab. Gọi `verify` từ một CLI mới với cùng selection/PID/endpoint, `--target <id> --url <expected-url>` để chứng minh browser còn sống sau opener thoát. `--expect-title "<exact-title>"` thêm assertion cho trang kiểm thử. Redirect cần URL đích đã biết để verify; không tự chấp nhận mọi redirect là thành công.

## Diễn giải kết quả

- Exit `0`, `PASS`: các kiểm tra của thao tác đó đạt; không đồng nghĩa đã kiểm tra mọi capability.
- Exit `2`, `FAIL`: sai CLI/URL/lựa chọn. Sửa tham số, không đổi profile để né lỗi.
- Exit `3`, `BLOCKED`: thiếu browser/profile, sai instance, ownership chưa rõ hoặc transport không hỗ trợ. Giữ nguyên browser/session.
- Exit `4`, `FAIL`: kết nối/CDP/timeout. Kiểm tra lại `doctor` và endpoint trước khi thử lại.
- Exit `5`, `FAIL`: không xác minh được DOM/GUI hoặc lỗi nội bộ. Không báo thành công.

Đọc `effects` cả khi thất bại: browser có thể đã được mở hoặc tab đã tạo trước timeout. Khảo sát lại trước khi retry để tránh mở trùng. Harness không tự đóng hoặc rollback phiên đó.

`open`/`verify` chỉ PASS khi PID sở hữu CDP, profile arguments, DOM/target URL và host window handle cùng khớp. `connect`/`tabs` chỉ chứng minh kết nối, không yêu cầu GUI. Handle khác 0 không thay thế xác nhận nhìn thấy trên desktop; báo trạng thái đó là `NOT_TESTED` nếu chưa có bằng chứng quan sát trực tiếp. Không bắt buộc hỏi người dùng có nhìn thấy cửa sổ sau mỗi lần mở; chỉ hỏi khi task yêu cầu xác nhận trực quan hoặc cần chẩn đoán hiển thị.

## Giới hạn bảo toàn session

Không có lệnh đóng, restart, xóa lock, tạo/xóa/copy profile, logout hay ghi session. Không điều khiển toàn desktop. Không tự bật CDP bằng cách tắt browser đang chạy. Chrome mặc định, profile không rõ hoặc pipe thuộc client khác có thể phải báo BLOCKED; không chọn profile khác thay thế. Hoạt động browser bình thường có thể cập nhật history/cache trong profile đã chọn.

Đọc [capability map](references/capabilities.json) để biết precondition, expected result, failure và verification từng lệnh. Đọc [CLI và giới hạn](references/cli.md) khi cần chọn endpoint, xử lý lỗi hoặc kiểm thử. [Bằng chứng](references/verification.md) phân biệt kiểm thử logic, live và phần chưa thử.
