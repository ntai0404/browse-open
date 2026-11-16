---
name: browse-open
description: Open and control Chromium or native Google Chrome GUI tabs on Windows through verified CDP. Discover profiles, reuse sessions or explicitly copy a selected Chrome profile to a separate root, and verify DOM read/fill/click.
---

# Browse Open

Two variants: **Chromium** (`browser: chromium`) and installed **native Google Chrome** (`browser: chrome`). Chrome Beta is unsupported. Never silently substitute a different browser or profile.

## Choose browser and profile

1. Inspect available tools, then call MCP `browse_open/doctor` or `node <skill-dir>/scripts/browse-open.mjs doctor` on the host. Prefer the MCP host when Antigravity terminal inspection is isolated; do not repeat a failing isolated shell.
2. Select the executable discovered by doctor for the requested variant. Read [Chromium](references/chromium.md) for Chromium; read [native Chrome](references/chrome-native.md) before selecting a Chrome root, copying data or choosing a port.
3. **Always discover existing `-agis` profiles before opening.** Read doctor.data.agisProfiles (valid roots ending in -agis beside discovered data roots), and inspect other known browser data parents if necessary. Preserve the selected -agis identity. Exactly one valid -agis profile: reuse it. Multiple: list numbered full root/directory/display names and ask which one; never silently choose.
4. **No valid -agis profile:** list actual device profiles (profiles on discovered roots), with numbered display name + directory + root, and require the user to choose, even if only one exists. Never default to Default, Profile 1, the first item or a historical non-agis copy. Once the user selects A, copy that selection to a new sibling data root named A-agis using copy-profile. This workflow authorizes making that copy after selection; do not ask for duplicate copy approval. Keep the original profile directory key inside the root. See the native reference for exact path rules. Never overwrite, rename or delete an existing profile. Record the source and destination; next task must rediscover and reuse -agis.
5. Default requested launch port is **4444**, not a random port. Before opening/connecting, inspect listeners. If 4444 is occupied, **ask the user to enter the port to use and wait**, including when its owner appears reusable; do not silently reuse that occupied port or pick another. After their explicit port choice, verify its owner if reusing, or verify it is free before launch. If the chosen port is also unavailable, report the owner and ask again; never stop it. An explicit instruction to use an existing endpoint is the user's port selection, so do not ask again about that same endpoint.
6. Use the task URL, otherwise about:blank; do not ask for an omitted URL.


## Execution contract

CLI and MCP expose ten operations: doctor, profiles, connect, tabs, open, verify, read, fill, click, copy-profile. See [CLI/MCP](references/cli.md) and [capability map](references/capabilities.json). Each call returns JSON schemaVersion/status/data or error/effects and an exit code.

- Reuse a matching, verified TCP CDP instance. Open requires matching OS listener owner, CDP browser PID, selected root/profile, DOM/target URL and host window evidence. Starting a process or observing a window alone is insufficient.
- Native Chrome without enable-automation can require a temporary chrome://version verification tab. The harness closes only that tab. Identity is checked against its reported profile path and host command line.
- Keep endpoint, PID and targetId. DOM operations require the exact expected URL and target. Read returns a bounded snapshot; fill checks exact input value. After click, read the expected resulting state before reporting success.
- No arbitrary JavaScript or desktop input is exposed. External sends/submissions/deletions need task authorization. Disconnecting CLI/MCP leaves the browser alive.

## Preserve sessions

Do not restart/close the user's browser, delete locks/profiles, change selection, bypass permission dialogs, or enable autoConnect. Default personal data roots cannot be launched through port CDP.

The -agis setup copies only the profile explicitly selected by the user, under the workflow above. Use copy-profile with a fresh sibling data root ending in -agis beside the source User Data root; keep data outside publication. Once authorized and selected, proceed without asking again. The source is untouched; do not decrypt cookies or bypass file locks.

Copy PASS means required metadata exists in the destination, not that all files or login sessions survived. Read omissions, complete, consistency and loginSession. A live source may have locked cookie/session files. A copied profile is independent and does not sync back to the original. Report copy, GUI/CDP/DOM and authentication results separately.

Use PASS/FAIL/BLOCKED/NOT_TESTED according to evidence. A local DOM test does not prove Facebook, Google Docs or all sites. User visual confirmation remains NOT_TESTED without observation; do not require a repeated confirmation question after each successful open. See [verification evidence](references/verification.md).
