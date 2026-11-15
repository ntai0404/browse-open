# browse-open

Windows Agent Skill for Chromium GUI tabs with a verified CLI/MCP CDP harness. Chrome Stable/native and Chrome Beta are outside its scope. Start with [SKILL.md](SKILL.md).

```powershell
git clone https://github.com/ntai0404/browse-open.git .agents/skills/browse-open
agy mcp add browse_open -- node "<absolute-skill-dir>/scripts/mcp-server.mjs"
```

Requires Windows, Node >=22, PowerShell, installed Chromium and an existing selected profile. No npm dependencies. Restart the agent conversation after upgrading MCP schemas.

Commands: doctor, profiles, connect, tabs, open, verify, read, fill, click. Use browser=chromium. The harness verifies process/CDP/profile identity; open requires DOM/target/window evidence. Fill checks the input value. Click requires reading back the intended outcome. No arbitrary eval, desktop input, profile creation/copy/deletion or browser close/restart is exposed.

Run `node --test tests/harness.test.mjs tests/mcp.test.mjs tests/chromium.test.mjs` from an authorized Windows host. See [CLI](references/cli.md) and [verification history](references/verification.md) for scope and evidence. Historical native Chrome GUI tests do not prove Chromium DOM control. Raw artifacts/profile/session data are excluded from publication.
