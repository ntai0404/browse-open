---
name: browse-open
description: Open and control Chromium or native Google Chrome GUI tabs on Windows through verified CDP. Discover profiles, reuse sessions or explicitly copy a selected Chrome profile to a separate root, and verify DOM read/fill/click.
---

# Browse Open

Two variants: **Chromium** (`browser: chromium`) and installed **native Google Chrome** (`browser: chrome`). Chrome Beta is unsupported. Never silently substitute a different browser or profile.

## Choose browser and profile

1. Inspect available tools, then call MCP `browse_open/doctor` or `node <skill-dir>/scripts/browse-open.mjs doctor` on the host. Prefer the MCP host when Antigravity terminal inspection is isolated; do not repeat a failing isolated shell.
2. Select the executable discovered by doctor for the requested variant. Read [Chromium](references/chromium.md) for Chromium; read [native Chrome](references/chrome-native.md) before selecting a Chrome root, copying data or choosing a port.
3. Call profiles on an existing root. Identity is executable + user-data-dir + profileDirectory; display name is not a directory. Preserve the user's prior selection. If several profiles remain eligible and none was selected, list numbered identities and ask once. One eligible profile can be used with its identity stated. No eligible profile: BLOCKED; do not initialize one.
4. Use the task URL, otherwise about:blank. Do not ask for a URL merely because it was omitted. Keep the requested port when specified.

## Execution contract

CLI and MCP expose ten operations: doctor, profiles, connect, tabs, open, verify, read, fill, click, copy-profile. See [CLI/MCP](references/cli.md) and [capability map](references/capabilities.json). Each call returns JSON schemaVersion/status/data or error/effects and an exit code.

- Reuse a matching, verified TCP CDP instance. Open requires matching OS listener owner, CDP browser PID, selected root/profile, DOM/target URL and host window evidence. Starting a process or observing a window alone is insufficient.
- Native Chrome without enable-automation can require a temporary chrome://version verification tab. The harness closes only that tab. Identity is checked against its reported profile path and host command line.
- Keep endpoint, PID and targetId. DOM operations require the exact expected URL and target. Read returns a bounded snapshot; fill checks exact input value. After click, read the expected resulting state before reporting success.
- No arbitrary JavaScript or desktop input is exposed. External sends/submissions/deletions need task authorization. Disconnecting CLI/MCP leaves the browser alive.

## Preserve sessions

Do not restart/close the user's browser, delete locks/profiles, change selection, bypass permission dialogs, or enable autoConnect. Default personal data roots cannot be launched through port CDP.

A native Chrome **copy** to a separate root is supported only after the user explicitly requests/allows copying that selected profile. Use copy-profile with a fresh destination in an ignored secrets directory. Once authorized and selected, proceed without asking again. The source is untouched; do not decrypt cookies or bypass file locks.

Copy PASS means required metadata exists in the destination, not that all files or login sessions survived. Read omissions, complete, consistency and loginSession. A live source may have locked cookie/session files. A copied profile is independent and does not sync back to the original. Report copy, GUI/CDP/DOM and authentication results separately.

Use PASS/FAIL/BLOCKED/NOT_TESTED according to evidence. A local DOM test does not prove Facebook, Google Docs or all sites. User visual confirmation remains NOT_TESTED without observation; do not require a repeated confirmation question after each successful open. See [verification evidence](references/verification.md).
