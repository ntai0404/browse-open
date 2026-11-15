# Bằng chứng kiểm chứng

Ngày chạy: 14/11/2026, Windows 11 10.0.26200, Node 24.3.0. Chỉ source skill được triển khai; không thay đổi source sản phẩm hoặc dependencies dự án.

| Trạng thái | Phạm vi | Bằng chứng |
| --- | --- | --- |
| PASS | Full suite bản cuối | 17/17, exit 0, không skip; 16 bài logic/boundary và 1 bài live integration. |
| PASS | Browser/profile không tồn tại | Filesystem fixture và CLI process thật trả code/JSON tương ứng; không tạo profile hoặc gọi launcher. |
| PASS | Browser đang chạy, chọn sai profile, cổng sai chủ sở hữu | Unit boundary tests kiểm tra routing/guard; không coi mock CDP là browser thật. |
| PASS | Kết nối thất bại và timeout | TCP connection refused và HTTP server không trả response được kiểm tra thật; exit/error có giới hạn. |
| PASS | Launch Chromium với profile có sẵn | Root `secrets/chrome-chromium-profile`, directory `Default`, PID 22224, `reused: false`, host window handle 133436. |
| PASS | Reuse và mở tab bằng browser hiện có | Bản cuối giữ PID 22224, `reused: true`, tạo target mới và kiểm tra lại bằng CLI riêng. |
| PASS | Xác minh độc lập | HTTP fixture nhận request, title marker xuất hiện trong DOM và HTTP `/json/list`; CLI connect/tabs/verify mới chạy sau opener thoát. |
| PASS | Liệt kê Chrome profiles thật | Đọc Local State/directory, phân biệt displayName và directory. Guest/System được loại khỏi selection persistent. |
| BLOCKED | Chromium cũ PID 5828 dùng pipe của client khác | `INSTANCE_NOT_CONNECTABLE`, exit 3, `effects: {}`. Không chiếm pipe, restart hoặc đổi profile. |
| NOT_TESTED | Người dùng nhìn thấy cửa sổ mới | Host có window handle/title; chưa có xác nhận trực quan mới của người dùng. |
| NOT_TESTED | Đăng nhập/tài khoản đã xác thực | Không đăng nhập/logout hay đọc cookie; chỉ dùng trang local để kiểm chứng kỹ thuật. |
| NOT_TESTED | Launch/attach native Chrome | Có inventory/profile listing; không khởi chạy/restart Chrome cá nhân. |
| NOT_TESTED | macOS/Linux, distributions chưa nhận diện | Không triển khai thao tác trên các môi trường đó; harness từ chối thay vì giả hỗ trợ. |

Target launch ban đầu: `AC1DDDDEED101EEE161858603D73A68F`. Target reuse của full suite cuối: `1FFF93C8B046388DF2A159A46AE7220B`. Marker cuối: `ChromiumOpenProof-1794674648692`. Browser được giữ mở; test đã đóng HTTP fixture, nên URL local không phục vụ reload sau bài test.

Bằng chứng JSON chi tiết nằm trong `../artifacts/`: `live.json`, `live-final.json`, `post-hardening-verify.json`, `pipe-blocked.json`, `summary.json`. Artifacts chỉ có ở workspace chạy thử và bị loại khỏi ZIP phân phối; các ID trên là bằng chứng lịch sử, không phải PID/endpoint để agent mới dùng lại mặc định.

Trong quá trình triển khai đã sửa cách parse quoting Windows, chuẩn hóa identity, guard profile và cleanup HTTP fixture. Một lượt suite trước bị giữ sống bởi socket preconnect của fixture; bản cuối đóng đúng socket fixture và toàn suite thoát exit 0. Không đóng browser để sửa lỗi fixture.

## Chạy lại

Chạy unit/boundary tests bằng lệnh ở `cli.md`. Live test cần môi trường host, existing root/profile đã được chọn và executable phù hợp. Nó có thể tạo thêm tab trong instance hiện có; không tự đóng tab hoặc browser sau test. Phải được phép dùng profile đó cho bài test. Kết quả thử cũ không bảo đảm mọi runtime hoặc mọi profile đều kết nối được.

## Nghiệm thu bằng Antigravity CLI ngày 15/11/2026

Bản đầu gọi harness từ `run_command` của Antigravity bị chặn CIM, trả `HOST_INSPECTION_FAILED`; đó là BLOCKED, không phải PASS. Đợt chẩn đoán được dừng sau một lượt có kết quả và một cuộc hội thoại thứ hai chưa hoàn tất. Log giữ tại `../artifacts/antigravity-1794676079287/`. Không dùng trạng thái SUCCESS tổng thể của agent làm bằng chứng: lượt lỗi vẫn có thể trả SUCCESS nhưng không hề mở tab.

Đã thêm MCP server stdio `chromium_open`, gọi chính CLI trên host bằng cơ chế MCP chính thức. Không nới guard profile/ownership, không dùng service, không chuyển desktop và không đóng browser. Server đã được đăng ký trên máy thử; agent mới ở máy khác cần cấu hình một lần theo CLI reference.

Sau sửa, tạo năm cuộc hội thoại mới, model `gemini-4-hydrogen-xhigh`. Mỗi prompt yêu cầu dùng `$chromium-open` mở tab GUI, cung cấp cùng lựa chọn profile automation có sẵn `secrets/chrome-chromium-profile`, directory `Default`, và URL fixture riêng. Không cung cấp lệnh launch/harness sẵn trong prompt.

| Lượt | Conversation ID | Target ID | Kết quả |
| --- | --- | --- | --- |
| 1 | `e5520638-f468-4649-b146-8b25b2f9828b` | `8F473156B81FA5A3E61420815F95E544` | PASS |
| 2 | `a0ac6acd-f59b-45b8-93d0-9a6b94415570` | `EAA494C8C42FE2F460F6273E2F4E6C03` | PASS |
| 3 | `bcf2d280-95f7-4f10-887b-b7447c9ec80d` | `8DE1945656A1234FD9D273BD8F091991` | PASS |
| 4 | `8a208087-4428-43fb-8a0f-741b8af54fd7` | `C8A836D45A5B71B3B9EE4BC777391DD4` | PASS |
| 5 | `8b10e881-06cc-430a-a71c-d96435a3cd04` | `04CF5A2AE599A166C733E4E9794AE89A` | PASS |

Cả năm agent đều đọc SKILL.md, khảo sát doctor/profiles, gọi tool open của cùng harness và verify. Sau result của từng agent, bộ kiểm chứng host tìm lại đúng URL/title trong HTTP `/json/list`, chạy CLI verify riêng để đọc DOM và handle, đối chiếu HTTP fixture hit counter. Năm kết quả đều PASS; không có tool error hoặc denied action. Mỗi lượt tạo target riêng, dùng cùng PID 22224/handle 133436, đúng yêu cầu tái sử dụng profile.

Bookend doctor trước/sau có cùng ba PID browser: 5828, 14696, 22224. Không tạo profile hoặc đóng/restart browser. Browser và năm tab được giữ nguyên sau khi agent thoát. Fixture HTTP đã đóng sau test; nội dung đã tải vẫn còn nhưng URL không phục vụ reload.

Bằng chứng: `../artifacts/antigravity-1794676295248/results.json`, các file `round-N.ndjson`, prompt, stderr và doctor-before/after. Artifacts không đóng gói trong ZIP. Xác nhận trực quan từ người dùng cho đợt này vẫn là NOT_TESTED; handle không thay thế xác nhận nhìn thấy trên desktop.

20 automated tests logic/CLI/MCP hiện PASS, gồm bốn bài kiểm tra adapter chỉ nhận command đã triển khai, từ chối shell/argument tùy ý và giữ nguyên JSON/exit code. Kết quả 5/5 là đường tái sử dụng Chromium TCP CDP đã chọn qua Antigravity trên máy này; không phải cam kết mọi profile hoặc môi trường đều thành công, cũng không phải năm lần cold launch browser.

## Nghiệm thu 10 lần khởi động mới ngày 15/11/2026

Theo yêu cầu đóng browser sau mỗi task, đã chạy `tests/antigravity-cold.mjs 10` với mười cuộc hội thoại Antigravity CLI mới, model `gemini-4-hydrogen-xhigh`. Không sửa logic harness hoặc skill để đạt đợt này; chỉ bổ sung bộ điều phối cold-start với cleanup được người dùng cho phép.

Trước lượt đầu, không có Chromium đang chạy; Chrome cá nhân PID 14696 vẫn mở. Trước từng lượt, doctor xác nhận profile thử `secrets/chrome-chromium-profile`, directory `Default`, chưa có browser process. Agent tự đọc skill, khảo sát runtime/profile và gọi open qua MCP để launch browser mới rồi mở URL riêng. Không cho phép dùng profile/instance khác.

| Lượt | Conversation ID | Browser PID mới | reused | Kết quả | Cleanup sau result |
| --- | --- | --- | --- | --- | --- |
| 1 | `12b5a232-e322-4d0c-841a-d27d1115802a` | 2204 | false | PASS | Đã đóng / process thoát |
| 2 | `3b3310cc-736e-43c4-a542-2e603c4b1b16` | 20980 | false | PASS | Đã đóng / process thoát |
| 3 | `4bdd3178-94f1-40b3-ba01-cfd4ad0d50de` | 3856 | false | PASS | Đã đóng / process thoát |
| 4 | `f484d388-6c6d-4795-9956-24eba17292e1` | 22044 | false | PASS | Đã đóng / process thoát |
| 5 | `b032e760-ab85-45cd-a90d-e6ac6ab7b33c` | 4736 | false | PASS | Đã đóng / process thoát |
| 6 | `9cb21439-af35-479d-93e8-10153f562f4a` | 11176 | false | PASS | Đã đóng / process thoát |
| 7 | `88297d7b-1fac-450e-9cc2-0fdd5cf4c45f` | 22100 | false | PASS | Đã đóng / process thoát |
| 8 | `babcc71e-f62d-4217-9049-fbe543ca36c4` | 6196 | false | PASS | Đã đóng / process thoát |
| 9 | `13729e87-dc5d-409b-8a90-4b56e0ac250e` | 18364 | false | PASS | Đã đóng / process thoát |
| 10 | `c8f42780-b543-4d72-99d0-db6dbe055b79` | 17084 | false | PASS | Đã đóng / process thoát |

Kết quả: 10/10 PASS, mười PID khác nhau, mọi `openResult.effects.browserStartedPid` khớp PID do host/CDP xác minh và mọi `reused` đều false. Không có tool error hoặc denied action. Không có lượt launch phải thử lại.

Sau result của mỗi agent, bộ điều phối kiểm tra HTTP target list, đọc lại DOM/title/URL qua CLI riêng và đối chiếu host window handle cùng HTTP fixture hit counter. Sau đó đóng chính target thử bằng Target.closeTarget, gửi Browser.close trên kết nối đã xác minh đúng PID/root/profile, và chờ OS xác nhận PID thoát. Chỉ bắt đầu lượt kế tiếp khi doctor không còn instance dùng root thử. Lượt 10 cũng được đóng sạch. Cleanup này chỉ nằm trong test runner đã được người dùng cho phép; CLI/MCP utility không thêm lệnh close/restart và không tự áp dụng cleanup cho task bình thường.

Bookend trước/sau còn cùng Chrome cá nhân PID 14696; không đóng browser khác, không tạo hoặc xóa profile, không xóa lock hoặc thay đổi đăng nhập. Đây là cold start ở cấp browser process với cùng profile có sẵn, không phải xóa cache/profile để giả máy mới.

Bằng chứng gốc: `../artifacts/antigravity-cold-1794678773335/results.json`, `summary.json`, `doctor-before.json`, `doctor-after.json` và mười file `round-N.ndjson`/prompt. Nội dung bằng chứng nằm tại workspace thử, không đi vào ZIP phân phối. Xác nhận trực quan từ người dùng cho từng cửa sổ vẫn NOT_TESTED; bằng chứng GUI kỹ thuật là đúng PID/session/title/handle trên host.


## Bổ sung contract chọn profile và URL mặc định — 2026-11-15

- PASS: 23/23 kiểm thử harness/MCP trên host Windows có quyền CIM. Trong sandbox, ca MCP open chạm inventory bị HOST_INSPECTION_FAILED; không coi đó là bằng chứng launch thất bại trên host.
- PASS: MCP `open` không truyền URL, dùng lại PID 25460 / root `secrets/chromium-gui-agent` / `Default`, tạo target `6957A9B608A9A36FF11162F7F1FB5866` với DOM URL `about:blank`, readyState complete. CLI verify ở process mới và HTTP `/json/list` độc lập đều xác nhận cùng target. Bằng chứng local: `artifacts/default-blank.json`.
- NOT_TESTED: chạy lại Antigravity end-to-end với lời nhắn tối giản và từng nhánh hỏi/chọn profile sau sửa contract. Các batch 10/10 trước có sẵn profile/URL, không chứng minh các quyết định hội thoại mới này.
- UNSUPPORTED: tạo profile mới; chưa có implementation, không phải một nhánh đã PASS.


## Browse Open: hai nhánh — 2026-11-15

- Skill đổi tên thành `browse-open`; giữ TCP harness và tách `references/chromium.md`, `references/chrome-native.md`. MCP utility đổi thành `browse_open`; server browser khác giữ nguyên.
- PASS: 29/29 tests harness/MCP/native adapter trên host Windows. Các bài native success là mock OS boundary để kiểm tra routing/guard, không chứng minh browser runtime.
- PASS trong phạm vi launch: người dùng chọn profile native số 2 / `Profile 1`; native launcher gửi yêu cầu mở Chrome cài trên máy. Host ghi nhận ProductName Google Chrome, version 157.0.8103.78, PID 8648, handle 395254, title about:blank - Google Chrome, user-data-dir mặc định Chrome và profile-directory Profile 1 trong command line. Không thêm CDP flags và không gọi autoConnect.
- BLOCKED phần control: CLI connect vào PID 8648 trả INSTANCE_NOT_CONNECTABLE, effects rỗng vì không có TCP CDP. Người dùng không chấp nhận thao tác hộp thoại; không thử cơ chế phát sinh prompt, không thay profile, không restart.
- NOT_TESTED: DOM/URL qua CDP của tab native; input/click trên Chrome native; xác nhận desktop trực quan của lượt này; Antigravity end-to-end sau rename. Skill không tuyên bố hỗ trợ native control thành công trên môi trường này.
