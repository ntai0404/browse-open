# browse-open

Windows Agent Skill for Chromium and native Chrome GUI tabs with a verified CLI/MCP CDP harness. Native Google Chrome is supported through loopback CDP with a separate selected data root or an explicitly authorized profile copy. Chrome Beta is unsupported. Start with [SKILL.md](SKILL.md).

```powershell
git clone https://github.com/ntai0404/browse-open.git .agents/skills/browse-open
agy mcp add browse_open -- node "<absolute-skill-dir>/scripts/mcp-server.mjs"
```

Requires Windows, Node >=22, PowerShell, installed Chromium or Google Chrome and an existing selected profile. No npm dependencies. Restart the agent conversation after upgrading MCP schemas.

Commands: doctor, profiles, connect, tabs, open, verify, read, fill, click, copy-profile. Use browser=chromium or chrome. The harness verifies process/CDP/profile identity; open requires DOM/target/window evidence. Fill checks the input value. Click requires reading back the intended outcome. No arbitrary eval, desktop input, implicit profile creation/copy/deletion or browser close/restart is exposed.

Run `node --test tests/harness.test.mjs tests/mcp.test.mjs tests/chromium.test.mjs tests/profile-copy.test.mjs tests/native.test.mjs` from an authorized Windows host. See [CLI](references/cli.md) and [verification history](references/verification.md) for scope and evidence. Historical native Chrome GUI tests do not prove Chromium DOM control. Raw artifacts/profile/session data are excluded from publication.

Native Chrome: read [contract](references/chrome-native.md). Copy is best effort with omissions; DOM success does not establish preserved login.
