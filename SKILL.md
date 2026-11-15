---
name: browse-open
description: Opens and controls Chromium GUI tabs on Windows through a verified CDP CLI/MCP harness. Discovers existing profiles, safely reuses sessions and verifies DOM read/fill/click without desktop input. Chrome Stable and Beta are outside its scope.
---

# Browse Open

Chỉ hỗ trợ **Chromium**, bao gồm Chromium do Playwright phân phối. Chrome Stable/native và Chrome Beta đã bỏ khỏi phạm vi. Không gọi native_launch hay dùng executable Chrome thay thế.

## Chọn browser và profile

1. Khảo sát tool, rồi dùng MCP `browse_open/doctor` hoặc `node <skill-dir>/scripts/browse-open.mjs doctor` trên host. Antigravity có terminal cô lập ưu tiên MCP; không lặp shell khi HOST_INSPECTION_FAILED.
2. Luôn chọn `browser: chromium`, executable Chromium thật từ doctor. Chrome khác có thể xuất hiện trong inventory để tránh đụng process/profile; chúng không được launch/attach bằng skill.
3. Dùng profiles cho root hiện có. Danh tính là executable + user-data-dir + profileDirectory, không phải tên hiển thị. Giữ lựa chọn đã chốt; nếu có nhiều profile chưa chọn thì liệt kê đánh số và hỏi một lần. Một profile phù hợp thì dùng và nêu danh tính. Không có profile hợp lệ: BLOCKED, không tạo/copy profile.
4. Không URL thì about:blank; có URL task thì dùng đúng URL, không hỏi lại hoặc thay URL lỗi bằng blank.
5. Đọc [nhánh Chromium](references/chromium.md) khi cần chi tiết launch/reuse; hướng dẫn DOM bên dưới dùng chung CLI/MCP.

## Contract mở và điều khiển

- MCP `browse_open` và CLI có cùng 9 command: `doctor`, `profiles`, `connect`, `tabs`, `open`, `verify`, `read`, `fill`, `click`. JSON có schemaVersion/status/data hoặc error/effects; kiểm tra exit code.
- `open` chỉ PASS khi CDP owner PID, root/profile, DOM, URL/target và cửa sổ host cùng khớp. Gửi lệnh Start-Process hoặc có handle riêng lẻ không đủ.
- Giữ endpoint, PID, targetId từ open. DOM commands cần đúng selection, target và **URL dự kiến chính xác** để tránh tác động nhầm tab sau redirect.
- `read` trả snapshot giới hạn của body hoặc CSS selector. `fill` dùng selector và value, có đọc lại value để xác minh. `click` chỉ chứng minh đã gửi mouse events tới element; agent **phải read lại trạng thái mong đợi** trước khi báo task thành công. Không có arbitrary eval/desktop input.
- Mỗi command là một CLI riêng, ngắt CDP nhưng giữ browser sống. MCP host gọi cùng harness; không nhận shell/JS tùy ý. Các tác động gửi/submit/xóa chỉ được thực hiện trong phạm vi task đã được người dùng yêu cầu.
- DOM proof trên trang local chỉ chứng minh luồng đã chạy; không suy rộng thành Google Docs, Facebook hoặc mọi website.

## Bảo toàn session và quyền

Ưu tiên reuse instance trùng executable/root/profile và được harness xác minh. Không restart/tắt browser, xóa lock/profile, copy cookie/session, đổi profile hoặc bật autoConnect. CDP launch chỉ dùng root automation hiện có; chặn default personal roots. Không tự bấm/cố bỏ hộp thoại cấp quyền. Instance không kết nối được: BLOCKED, không chuyển sang launcher GUI-only rồi báo thành công.

Phân biệt PASS/FAIL/BLOCKED/NOT_TESTED theo bằng chứng. User visual confirmation vẫn NOT_TESTED nếu chưa có; không bắt buộc hỏi lại sau mỗi lần mở.

Đọc [CLI/MCP](references/cli.md) để biết tham số, [capability map](references/capabilities.json) để biết guard, [lịch sử kiểm chứng](references/verification.md) để biết phạm vi đã chạy thật.
