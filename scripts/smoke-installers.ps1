# Intended only for a disposable GitHub-hosted Windows runner.
$ErrorActionPreference = 'Stop'
if ($env:GITHUB_ACTIONS -ne 'true' -or !$env:RUNNER_TEMP) {
    throw 'Run installer verification only on a disposable GitHub Actions runner.'
}
$workspace = (Get-Location).Path
$taskRoot = [IO.Path]::GetFullPath((Join-Path $env:RUNNER_TEMP 'StyleDNA-installer-check'))
$runnerRoot = [IO.Path]::GetFullPath($env:RUNNER_TEMP).TrimEnd('\') + '\'
if (!$taskRoot.StartsWith($runnerRoot, [StringComparison]::OrdinalIgnoreCase)) {
    throw 'Installation target must remain under RUNNER_TEMP.'
}
New-Item -ItemType Directory -Path $taskRoot -Force | Out-Null

function Run-Installer([string]$Executable, [string]$Arguments) {
    $task = Start-Process -FilePath $Executable -ArgumentList $Arguments -WindowStyle Hidden -PassThru
    if (!$task.WaitForExit(180000)) { $task.Kill(); throw 'Installer timed out' }
    if ($task.ExitCode -notin @(0, 3010)) { throw "Installer exited $($task.ExitCode)" }
}

foreach ($format in @('msi', 'nsis')) {
    $extension = if ($format -eq 'msi') { '*.msi' } else { '*-setup.exe' }
    $package = @(Get-ChildItem -LiteralPath "src-tauri/target/release/bundle/$format" -Filter $extension)
    if ($package.Count -ne 1) { throw "Expected exactly one $format installer" }
    $installDir = Join-Path $taskRoot $format
    $log = Join-Path $workspace "test-results/install-$format.log"
    New-Item -ItemType Directory -Path 'test-results' -Force | Out-Null
    $installed = $false
    try {
        if ($format -eq 'msi') {
            Run-Installer 'msiexec.exe' "/i `"$($package[0].FullName)`" /qn /norestart INSTALLDIR=`"$installDir`" /L*v `"$log`""
        } else {
            Run-Installer $package[0].FullName "/S /D=$installDir"
        }
        $installed = $true
        $app = Join-Path $installDir 'styledna-desktop.exe'
        $service = Join-Path $installDir 'styledna-service.exe'
        if (!(Test-Path -LiteralPath $app) -or !(Test-Path -LiteralPath $service)) {
            throw 'Installer did not deploy the application and bundled Python service'
        }
        & uv run python scripts/smoke-sidecar.py --binary $service
        if ($LASTEXITCODE -ne 0) { throw 'Installed service smoke failed' }
        $env:STYLEDNA_SMOKE_APP = $app
        $env:STYLEDNA_SMOKE_DATA_DIR = Join-Path $taskRoot "data-$format"
        & node scripts/smoke-desktop.mjs
        if ($LASTEXITCODE -ne 0) { throw 'Installed desktop smoke failed' }
    } finally {
        if ($installed) {
            if ($format -eq 'msi') {
                Run-Installer 'msiexec.exe' "/x `"$($package[0].FullName)`" /qn /norestart"
            } else {
                Run-Installer (Join-Path $installDir 'uninstall.exe') '/S'
            }
        }
        Remove-Item Env:STYLEDNA_SMOKE_APP -ErrorAction SilentlyContinue
        Remove-Item Env:STYLEDNA_SMOKE_DATA_DIR -ErrorAction SilentlyContinue
    }
    for ($i = 0; $i -lt 100 -and (Test-Path -LiteralPath $app); $i++) { Start-Sleep -Milliseconds 100 }
    if ((Test-Path -LiteralPath $app) -or (Test-Path -LiteralPath $service)) {
        throw 'Uninstaller left application executables behind'
    }
    if (!(Test-Path -LiteralPath (Join-Path $taskRoot "data-$format/styledna.sqlite3"))) {
        throw 'Expected test library to remain after uninstall'
    }
    Write-Output "${format}: install, bundled service, real desktop workflow, uninstall, and data preservation PASS"
}
