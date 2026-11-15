# Native Chrome through CDP

Use installed Google Chrome (`browser: chrome`), not Beta, Chromium or Chrome for Testing. Windows and Node >=22 are required. Use the authorized host or MCP browse_open when the agent terminal lacks GUI/process access.

## Select and preserve data

Run doctor, then profiles for each relevant existing root. Select by executable + user-data-dir + profileDirectory. A display name such as Nguyen Xuan is not the directory key Profile 1. Preserve selections already made by the user; otherwise list numbered profiles and ask once when multiple choices exist.

Reuse an existing verified CDP instance for the selected identity. A new command cannot add a debugging port to a running browser without restarting it. Do not restart it automatically.

Chrome 136+ ignores port/pipe switches on its default personal data root. A profile-directory flag does not change that restriction. This variant does not use autoConnect or its Allow dialog.

If the user explicitly authorizes copying the selected personal profile, copy it into a fresh separate root inside an ignored secrets directory. Never overwrite a destination or publish the copied data. Copy authorization does not authorize closing the source browser. With a running source, copy is best effort, not atomic; locked files, caches, locks and links are recorded as omissions. For a consistent offline copy, ask permission to close the source only when that is needed and not already authorized. Even a complete copy does not guarantee encrypted cookies remain usable. Do not bypass encryption or locks.

## Stable CLI

Replace the absolute paths with discovered values; destination parent must exist.

```powershell
node <skill-dir>/scripts/browse-open.mjs profiles --user-data-dir "C:/Users/USER/AppData/Local/Google/Chrome/User Data"
node <skill-dir>/scripts/browse-open.mjs copy-profile --user-data-dir "C:/Users/USER/AppData/Local/Google/Chrome/User Data" --profile-directory "Profile 1" --destination-root "C:/WORKSPACE/secrets/chrome-native-copy-UNIQUE" --copy-authorized yes --timeout 120000
node <skill-dir>/scripts/browse-open.mjs open --browser chrome --executable "C:/Program Files/Google/Chrome/Application/chrome.exe" --user-data-dir "C:/WORKSPACE/secrets/chrome-native-copy-UNIQUE" --profile-directory "Profile 1" --port 4444 --url about:blank
```

copy-authorized yes records authorization already present in the conversation; the flag does not itself grant permission. The command copies selected-profile files and Local State without printing cookie/password contents. Manifest: destination/browse-open-copy.json. Read omissions, complete, consistency and loginSession. TIMEOUT may leave a partial root identified in effects.profileCopyRoot: inspect before retry, use a new destination and do not silently delete it.

Open accepts optional port 1024..65535; omitted port chooses a free port. Occupied port: PORT_IN_USE, never stop its owner. Existing selected browser on a different requested port: PORT_MISMATCH, never restart. For connect/tabs/read/fill/click/verify, pass endpoint http://127.0.0.1:4444 rather than port.

MCP copy-profile fields: userDataDir, profileDirectory, destinationRoot, copyAuthorized (string yes). Open fields include browser (chrome) and port (string 4444). Restart the agent conversation after upgrading schemas.

## Verify and control

The harness checks loopback listener ownership, browser PID via CDP and explicit selected root/profile in the host process command line. It verifies the CDP command line too. For an existing native instance without enable-automation, only that specific CDP rejection allows a fallback: create a temporary chrome://version tab, compare its profile_path with the selected root/directory, then close only that verification tab. Other CDP failures propagate.

Keep endpoint, PID and targetId from open. DOM read/fill/click require the selected identity, exact expected URL and target. Fill verifies input readback. Click requires a subsequent read of the expected outcome. No desktop input or arbitrary eval command is exposed. See [CLI](cli.md).

Report separately: profile-copy completeness/consistency, GUI/CDP/DOM, login status. Do not open Facebook or send data unless requested. No URL means about:blank. A copied profile is independent; it is not direct control of the original root and does not synchronize back.

## Observed evidence

2026-11-16: installed Chrome 157.0.8103.78, selected Profile 1 copied into secrets/chrome-native-copy-20261116-005737. PID 1552, loopback port 4444. Initial copy: 8520 files, 18 locked-file errors including Cookies and session files. Profile path matched chrome://version. Two fresh connections passed local DOM fill/click/read. Authentication NOT_TESTED. These observations do not guarantee every machine/profile.

Official references: https://developer.chrome.com/blog/remote-debugging-port and https://developer.chrome.com/docs/devtools/agents/get-started/configuration/
