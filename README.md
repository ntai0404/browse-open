# browse-open

An Agent Skill for opening Chromium or the user's installed native Google Chrome on Windows, with explicit profile selection. Start with [SKILL.md](SKILL.md).

## Install

```powershell
git clone https://github.com/ntai0404/browse-open.git .agents/skills/browse-open
```

The repository is private. Authenticate Git with an authorized account. Requirements: Windows, Node.js 22+ with native WebSocket, PowerShell, an installed browser and existing profiles. No npm dependencies are required for the supplied harnesses.

For Antigravity, register the host transport:

```powershell
agy mcp add browse_open -- node "<absolute-skill-dir>/scripts/mcp-server.mjs"
```

Start a new agent conversation to load the tools. An existing chromium_open utility registration must be replaced when its installed folder is renamed; leave unrelated MCP servers intact.

## Variants

- [Chromium](references/chromium.md): verified TCP CDP reuse or GUI launch of an existing selected profile, with DOM/target/window verification.
- [Native Chrome](references/chrome-native.md): list real Chrome profiles, ask the user to choose one, then dispatch a normal native launch without enabling debugging. Direct page control requires an already authorized connection whose profile can be verified. Native launch dispatch is not proof of tab control.

A request with no URL opens about:blank. Neither branch creates/copies profiles, resets login, or restarts the user's browser. The native branch never initiates an authorization prompt when the user forbids it. Without a suitable connection, native control is BLOCKED; it does not silently switch to Chromium.

## Tests and limits

```powershell
node --test tests/harness.test.mjs tests/mcp.test.mjs tests/native.test.mjs
```

Run from an authorized Windows host with CIM access. Current result: 29/29 tests pass. Native adapter tests are explicitly mocked; a real native launch was observed separately, while native DOM/click/input remain blocked on the tested machine because no authorized transport was available. See [verification history](references/verification.md).

The opt-in live test needs CHROMIUM_OPEN_ROOT, CHROMIUM_OPEN_PROFILE and CHROMIUM_OPEN_EXE and preserves the browser. The Antigravity acceptance runners are project-specific tools requiring an existing secrets/chrome-chromium-profile and configured project/model. The cold runner closes the selected test browser, including a matching pre-existing instance. Do not run it without explicit authorization to close that browser. Earlier 10/10 cold-start tests supplied profile/URL; they do not prove autonomous handling of a minimal prompt.

Raw artifacts, browser profiles and login sessions are excluded from the repository.
