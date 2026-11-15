param([Parameter(Mandatory=$true)][int]$BrowserPid,[Parameter(Mandatory=$true)][string]$Root,[Parameter(Mandatory=$true)][string]$ProfileDirectory)
$ErrorActionPreference='Stop'
$row=Get-CimInstance Win32_Process -Filter "ProcessId = $BrowserPid"
if (-not $row) { throw 'Expected test browser PID is absent; do not infer cleanup success' }
if ($row.ExecutablePath -ne 'C:\Program Files\Google\Chrome\Application\chrome.exe') { throw 'Not the expected installed native Chrome' }
if (-not $row.CommandLine.Contains(('--user-data-dir="' + $Root + '"')) -or -not $row.CommandLine.Contains(('--profile-directory="' + $ProfileDirectory + '"'))) { throw 'Native test profile identity mismatch' }
$p=Get-Process -Id $BrowserPid
if ($p.MainWindowHandle -eq 0 -or $p.MainWindowTitle -ne 'about:blank - Google Chrome') { throw 'Expected blank test window not observed' }
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$r=[System.Windows.Automation.AutomationElement]::FromHandle($p.MainWindowHandle)
$c=[System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::ControlTypeProperty,[System.Windows.Automation.ControlType]::TabItem)
$tabs=$r.FindAll([System.Windows.Automation.TreeScope]::Descendants,$c)
if ($tabs.Count -ne 1 -or $tabs[0].Current.Name -ne 'about:blank') { throw 'Refuse cleanup: expected exactly one disposable about:blank tab' }
$handle=$p.MainWindowHandle.ToInt64()
# Process lifecycle API; no desktop keys, no debugger, no forced termination.
if (-not $p.CloseMainWindow()) { throw 'Normal close request was not accepted' }
$deadline=[DateTime]::UtcNow.AddSeconds(20)
do {
 $alive=Get-Process -Id $BrowserPid -ErrorAction SilentlyContinue
 if (-not $alive) { @{status='PASS';pid=$BrowserPid;handle=$handle;tabCountBefore=1;tabName='about:blank';tabClosed=$true;browserExited=$true;method='Normal CloseMainWindow of owned single-blank-tab test process'} | ConvertTo-Json -Compress; exit 0 }
 Start-Sleep -Milliseconds 200
} while ([DateTime]::UtcNow -lt $deadline)
throw 'Owned test browser did not exit after normal close; do not start a warm next round'
