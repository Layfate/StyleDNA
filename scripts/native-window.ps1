param(
    [Parameter(Mandatory = $true)][int]$TaskProcessId,
    [Parameter(Mandatory = $true)][ValidateSet('Close', 'Resize', 'SaveDialog', 'StopService', 'CheckClipboard')][string]$Action,
    [int]$Width = 1440,
    [int]$Height = 960,
    [string]$Destination
)
$ErrorActionPreference = 'Stop'
$taskProcess = Get-Process -Id $TaskProcessId
if ($taskProcess.ProcessName -ne 'styledna-desktop') { throw 'Refusing to control an unrelated process' }
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class StyleDnaWindowTest {
    [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr hwnd, uint msg, IntPtr w, IntPtr l);
    [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr hwnd, IntPtr insert, int x, int y, int width, int height, uint flags);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hwnd);
}
'@
$taskProcess.Refresh()
$taskHandle = $taskProcess.MainWindowHandle
if ($taskHandle -eq [IntPtr]::Zero) { throw 'Desktop window is not ready' }
if ($Action -eq 'CheckClipboard') {
    $taskClipboard = Get-Clipboard -Raw
    if (-not $taskClipboard.Contains('## Visual language')) { throw 'Copied Markdown was not found on the clipboard' }
} elseif ($Action -eq 'StopService') {
    $taskServices = @(Get-CimInstance Win32_Process -Filter "ParentProcessId = $TaskProcessId" | Where-Object { $_.Name -eq 'styledna-service.exe' })
    if ($taskServices.Count -eq 0) { throw 'No owned StyleDNA service process was found' }
    foreach ($taskService in $taskServices) {
        $taskWorkers = @(Get-CimInstance Win32_Process -Filter "ParentProcessId = $($taskService.ProcessId)" | Where-Object { $_.Name -eq 'styledna-service.exe' })
        foreach ($taskWorker in $taskWorkers) { Stop-Process -Id $taskWorker.ProcessId -Force -ErrorAction SilentlyContinue }
        Stop-Process -Id $taskService.ProcessId -Force -ErrorAction SilentlyContinue
    }
} elseif ($Action -eq 'Close') {
    if (-not [StyleDnaWindowTest]::PostMessage($taskHandle, 0x10, [IntPtr]::Zero, [IntPtr]::Zero)) { throw 'Could not request native window close' }
} elseif ($Action -eq 'Resize') {
    if (-not [StyleDnaWindowTest]::SetWindowPos($taskHandle, [IntPtr]::Zero, 0, 0, $Width, $Height, 0x16)) { throw 'Could not resize native window' }
} else {
    if (-not $Destination) { throw 'A test export destination is required' }
    $taskWorkspace = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
    $taskResolvedDestination = [IO.Path]::GetFullPath($Destination)
    if (-not $taskResolvedDestination.StartsWith((Join-Path $taskWorkspace 'test-results') + [IO.Path]::DirectorySeparatorChar)) {
        throw 'Native test exports must stay beneath the workspace test-results directory'
    }
    Add-Type -AssemblyName UIAutomationClient
    Add-Type -AssemblyName UIAutomationTypes
    $taskProcessCondition = New-Object System.Windows.Automation.PropertyCondition(
        [System.Windows.Automation.AutomationElement]::ProcessIdProperty, $TaskProcessId)
    $taskDialog = $null
    for ($taskAttempt = 0; $taskAttempt -lt 50; $taskAttempt++) {
        $taskWindows = [System.Windows.Automation.AutomationElement]::RootElement.FindAll(
            [System.Windows.Automation.TreeScope]::Children, $taskProcessCondition)
        foreach ($taskWindow in $taskWindows) {
            if ($taskWindow.Current.Name -eq 'Save As') { $taskDialog = $taskWindow; break }
        }
        if ($taskDialog) { break }
        Start-Sleep -Milliseconds 100
    }
    if (-not $taskDialog) { throw 'Owned native Save As dialog was not found' }
    # This Windows dialog does not expose a filename ValuePattern on this host.
    # Exercise its normal keyboard mnemonic after explicitly focusing this owned dialog.
    [void][StyleDnaWindowTest]::SetForegroundWindow([IntPtr]$taskDialog.Current.NativeWindowHandle)
    Add-Type -AssemblyName System.Windows.Forms
    Start-Sleep -Milliseconds 150
    [System.Windows.Forms.SendKeys]::SendWait('%n')
    [System.Windows.Forms.SendKeys]::SendWait('^a')
    $taskLiteral = $taskResolvedDestination -replace '([+^%~(){}\[\]])', '{$1}'
    [System.Windows.Forms.SendKeys]::SendWait($taskLiteral)
    [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
}
