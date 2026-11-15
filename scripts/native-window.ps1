param(
    [Parameter(Mandatory = $true)][int]$TaskProcessId,
    [Parameter(Mandatory = $true)][ValidateSet('Close', 'Resize', 'SaveDialog')][string]$Action,
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
}
'@
$taskProcess.Refresh()
$taskHandle = $taskProcess.MainWindowHandle
if ($taskHandle -eq [IntPtr]::Zero) { throw 'Desktop window is not ready' }
if ($Action -eq 'Close') {
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
    $taskEditCondition = New-Object System.Windows.Automation.PropertyCondition(
        [System.Windows.Automation.AutomationElement]::AutomationIdProperty, '1001')
    $taskEdit = $null
    for ($taskAttempt = 0; $taskAttempt -lt 50; $taskAttempt++) {
        $taskWindows = [System.Windows.Automation.AutomationElement]::RootElement.FindAll(
            [System.Windows.Automation.TreeScope]::Children, $taskProcessCondition)
        foreach ($taskWindow in $taskWindows) {
            $taskEdit = $taskWindow.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $taskEditCondition)
            if ($taskEdit) { break }
        }
        if ($taskEdit) { break }
        Start-Sleep -Milliseconds 100
    }
    if (-not $taskEdit) { throw 'Native save dialog filename input was not found' }
    $taskValue = $taskEdit.GetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern)
    $taskValue.SetValue($taskResolvedDestination)
    $taskSaveCondition = New-Object System.Windows.Automation.AndCondition(
        (New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::AutomationIdProperty, '1')),
        (New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::Button)))
    $taskSave = $taskWindow.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $taskSaveCondition)
    if (-not $taskSave) { throw 'Native save button was not found' }
    $taskInvoke = $taskSave.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern)
    $taskInvoke.Invoke()
}
