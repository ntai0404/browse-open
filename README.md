# chromium-open

An Agent Skill for opening and verifying Chrome/Chromium GUI tabs on Windows through a CLI harness or an MCP server. Entry point: [SKILL.md](SKILL.md).

## Requirements

- Windows, Node.js 22+ with native WebSocket, PowerShell.
- An installed Chrome/Chromium executable and an existing browser profile.
- An authorized host context with process inspection, localhost networking and GUI access.

No npm dependencies are required.

## Install

From the target workspace:

```powershell
git clone https://github.com/ntai0404/chromium-open.git .agents/skills/chromium-open
```

The repository is private; Git must authenticate with an account that has access. Have the agent read `.agents/skills/chromium-open/SKILL.md` before using it.

For Antigravity, register the MCP transport once using the absolute installed path:

```powershell
agy mcp add chromium_open -- node "<absolute-skill-dir>/scripts/mcp-server.mjs"
```

Start a new agent conversation after registration. See [CLI and transport reference](references/cli.md) for limitations and troubleshooting.

## Behavior

Discover browsers and profiles before opening. Reuse a verified instance of the selected profile when possible. Ask once if several profiles are eligible and none has been selected. A request to open the GUI without a URL opens `about:blank`. Missing profiles are reported as blocked; profile creation is not implemented.

The utility does not close/restart browsers, delete profiles or copy authentication data. Normal browser operation can update profile history/cache. Nonzero window handles are technical evidence, not human visual confirmation.

## Tests

Run from an authorized Windows host:

```powershell
node --test tests/harness.test.mjs tests/mcp.test.mjs
```

The live test is opt-in and opens a tab in an existing profile. Configure `CHROMIUM_OPEN_ROOT`, `CHROMIUM_OPEN_PROFILE` and `CHROMIUM_OPEN_EXE` before running `node --test tests/live.test.mjs`.

The Antigravity batch runners are project-specific acceptance tools, not portable defaults. They assume an existing `secrets/chrome-chromium-profile` relative to the working directory, an Antigravity project and the configured model. The cold runner closes the selected test browser, including a matching instance present before the batch. Do not run it without explicit authorization to close that browser.

## Verification scope

The latest host suite passed 23/23 tests. The URL-default change was also verified against a live Chromium instance. Earlier 10/10 cold-start Antigravity runs supplied the profile and URL explicitly; they do not prove autonomous profile selection for a minimal prompt. See [verification history](references/verification.md). Raw artifacts, profile data and login sessions are intentionally excluded from this repository.
