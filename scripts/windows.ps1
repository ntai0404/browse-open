[CmdletBinding()]
param([ValidateSet('inventory','launch','nativeLaunch')][string]$Operation = 'inventory', [string]$Payload = '')
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
try {
  if ($Operation -eq 'nativeLaunch') {
    $o = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($Payload)) | ConvertFrom-Json
    $version = (Get-Item -LiteralPath $o.executable).VersionInfo
    if ($version.ProductName -ne 'Google Chrome') { throw 'Selected executable is not installed Google Chrome' }
    # Existing native profile only; do not enable debugging or alter auth settings.
    $a = @(('--user-data-dir="' + $o.root + '"'), ('--profile-directory="' + $o.profile + '"'), '--new-tab', ('"' + $o.url + '"'))
    $p = Start-Process -FilePath $o.executable -ArgumentList $a -WindowStyle Normal -PassThru
    @{requestPid=$p.Id; dispatched=$true} | ConvertTo-Json -Compress
    exit 0
  }
  if ($Operation -eq 'launch') {
    $o = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($Payload)) | ConvertFrom-Json
    $a = @('--remote-debugging-address=127.0.0.1', ('--remote-debugging-port=' + $o.port),
      ('--user-data-dir="' + $o.root + '"'), ('--profile-directory="' + $o.profile + '"'),
      '--enable-automation', '--no-first-run', '--no-default-browser-check', 'about:blank')
    $p = Start-Process -FilePath $o.executable -ArgumentList $a -WindowStyle Normal -PassThru
    @{pid=$p.Id} | ConvertTo-Json -Compress
    exit 0
  }
  $rows = @(Get-CimInstance Win32_Process -Filter "Name = 'chrome.exe' OR Name = 'chromium.exe'" | Where-Object {
    $_.CommandLine -notmatch '(?:^|\s)--type='
  } | ForEach-Object {
    $p = Get-Process -Id $_.ProcessId -ErrorAction SilentlyContinue
    if ($p) { $p.Refresh() }
    @{pid=$_.ProcessId; executable=$_.ExecutablePath; commandLine=$_.CommandLine; sessionId=$_.SessionId;
      handle=$(if($p){$p.MainWindowHandle.ToInt64()}else{0}); title=$(if($p){$p.MainWindowTitle}else{''})}
  })
  $listeners = @(& "$env:SystemRoot\System32\netstat.exe" -ano -p tcp | ForEach-Object {
    if ($_ -match '^\s*TCP\s+(\S+)\s+\S+\s+LISTENING\s+(\d+)') {
      $local=$Matches[1]; $owner=[int]$Matches[2]
      if ($local -match '^(.*):(\d+)$') { @{address=$Matches[1]; port=[int]$Matches[2]; pid=$owner} }
    }
  })
  @{processes=$rows; listeners=$listeners; os=[Environment]::OSVersion.VersionString} | ConvertTo-Json -Depth 5 -Compress
} catch {
  [Console]::Error.WriteLine($_.Exception.Message)
  exit 1
}
