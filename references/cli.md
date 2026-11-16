# CLI and MCP

Windows, Node >=22, PowerShell and authorized host process/GUI/loopback access. No npm dependencies. Entry point scripts/browse-open.mjs. Use --help for machine-readable commands/options. Arguments are --name value pairs, not --name=value.

## Commands

- doctor: inventory OS, executable kinds, instances, roots and transport capabilities; not a browser health claim.
- profiles: --user-data-dir ROOT; numbered directory IDs and display names; no creation.
- connect/tabs: root/profile plus optional instance/endpoint/browser/executable; verify OS/CDP owner and selected profile. Native Chrome may create/close its own temporary profile-path verification tab.
- open: same selection, optional url (default about:blank), expect-title and port. Browser is chromium or chrome. Reuse matching instance or launch with selected unused non-default data root. Never launch CDP on default personal roots.
- verify: selection plus --target ID --url EXACT, optional expect-title.
- read: selection plus target/url, optional --selector CSS; bounded text/value snapshot excluding password/file values.
- fill: selection plus target/url/selector/--value TEXT; empty value clears. Input.insertText and exact DOM value readback. Ordinary input/textarea only.
- click: selection plus target/url/selector; actionable element check and CDP mouse events. Read the expected resulting state afterward.
- copy-profile: --user-data-dir ROOT --profile-directory DIRECTORY --destination-root NEW_ABSOLUTE_ROOT --copy-authorized yes, optional timeout. Requires existing user authorization. Best-effort copy of selected profile and Local State, no overwrite/source modification. See [native Chrome](chrome-native.md).

All commands: default timeout 20000ms, range 500..120000. Exactly one stdout JSON, schemaVersion 1, status, data/error, effects. Exit 0 PASS, 2 invalid arguments, 3 BLOCKED precondition, 4 connection/timeout, 5 verification/internal error. Inspect effects even on failure before retrying a mutating command; a click timeout does not prove no click occurred.

Browser values: chromium or chrome; Beta unsupported. Open --port 4444 selects a free loopback port; other commands use --endpoint http://127.0.0.1:4444. Port range 1024..65535. Occupied/mismatched ports are blocked without terminating processes. Omitted launch port is 4444. PORT_IN_USE requires asking the user to enter another port, never automatic fallback.

copy-profile JSON: copiedFiles, omissions, complete, consistency, loginSession. Manifest in destination/browse-open-copy.json. Partial copy/timeout identifies destination in effects.profileCopyRoot. Required metadata can exist even when cookies/session files were omitted; copy PASS does not prove login.

## MCP host

```powershell
agy mcp add browse_open -- node "<absolute-skill-dir>/scripts/mcp-server.mjs"
```

Start a new agent conversation after schema upgrades. Same ten commands as CLI. No native_launch, arbitrary eval, shell, close/restart or pipe takeover. Prefer MCP host when Antigravity run_command is isolated; if host is unavailable report BLOCKED.

MCP uses userDataDir/profileDirectory/executable/browser/instance/endpoint/url/target/expectTitle/selector/value. copy-profile adds destinationRoot/copyAuthorized. Open adds port (string, e.g. "4444"). timeout and instance are integers. Unknown fields are rejected.

Example read arguments: {"browser":"chrome","userDataDir":"<selected-root>","profileDirectory":"Profile 1","endpoint":"http://127.0.0.1:4444","target":"<target-id>","url":"http://127.0.0.1:8080/proof","selector":"#result"}.

Disconnect leaves browser alive. No lock deletion, browser restart, permission-dialog bypass or profile substitution. Endpoint must be loopback HTTP with explicit port owned by the selected PID. After a redirect, inspect and assert the actual intended URL rather than accepting arbitrary redirects.

Native without enable-automation: a specific Browser.getBrowserCommandLine rejection allows a temporary chrome://version profile-path check. verification.profileCommandLine covers host command-line selection cross-checked using CDP command line or the version-page path.

## Verification

Run node --test tests/harness.test.mjs tests/mcp.test.mjs tests/chromium.test.mjs tests/profile-copy.test.mjs tests/native.test.mjs on an authorized Windows host. Mocked boundaries are unit evidence, not live browser proof.

Existing tests/live.test.mjs is opt-in using CHROMIUM_OPEN_ROOT/PROFILE/EXE. Historical Antigravity batch runners have project/model/profile assumptions and separate cleanup authorization. Do not run cold cleanup on a working user browser. See [evidence](verification.md) for observed scope; no general website acceptance is implied.

Doctor also returns agisProfiles discovered beside known data roots (including workspace secrets). Follow the mandatory -agis selection and occupied-port question policy in SKILL.md before open/connect.

copy-profile responses return up to 12 omission examples plus omissionCount, omissionsTruncated and manifestPath. Read the manifest only when a specific copy failure requires it; full details are preserved locally without filling the agent context.

## Native cold-launch acceptance runner

Set BROWSE_NATIVE_TEST_ROOT to the explicitly authorized -agis root, BROWSE_NATIVE_TEST_PROFILE to its directory key, and BROWSE_NATIVE_TEST_ENDPOINT to the selected loopback endpoint, then run node tests/antigravity-native-dom.mjs 10 on the host. Current acceptance uses port 4444. This runner requires authorization to close ALL windows of that exact test root, not merely a tab; it must not run against an active working profile. It verifies identity before Browser.close, waits for zero root processes/CDP unavailable, and preserves unrelated browser PIDs. Every round starts a fresh agent and browser, checks DOM independently, and shuts the test browser down before continuing. Ordinary skill open still keeps browser alive: this full shutdown is only the authorized acceptance workflow.
