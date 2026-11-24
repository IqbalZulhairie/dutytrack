$ErrorActionPreference = "Stop"

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$scriptPath = Join-Path $PSScriptRoot "send-duty-reminders.mjs"
$node = Get-Command "node.exe" -ErrorAction Stop
$wscript = Get-Command "wscript.exe" -ErrorAction Stop
$launcherPath = Join-Path $PSScriptRoot "run-duty-reminders-hidden.vbs"
$taskName = "Duty Track - Daily Reminders"
$legacyTaskName = "Duty Track - Daily 8 AM Reminders"

$action = New-ScheduledTaskAction `
  -Execute $wscript.Source `
  -Argument ('//B //NoLogo "{0}" "{1}" "{2}" "{3}"' -f $launcherPath, $node.Source, $scriptPath, $projectRoot) `
  -WorkingDirectory $projectRoot
$trigger = New-ScheduledTaskTrigger `
  -Once `
  -At (Get-Date).AddMinutes(1) `
  -RepetitionInterval (New-TimeSpan -Minutes 1) `
  -RepetitionDuration (New-TimeSpan -Days 3650)
$settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 15) `
  -MultipleInstances IgnoreNew
$principal = New-ScheduledTaskPrincipal `
  -UserId ([System.Security.Principal.WindowsIdentity]::GetCurrent().Name) `
  -LogonType Interactive `
  -RunLevel Limited

if (Get-ScheduledTask -TaskName $legacyTaskName -ErrorAction SilentlyContinue) {
  Unregister-ScheduledTask -TaskName $legacyTaskName -Confirm:$false
}

Register-ScheduledTask `
  -TaskName $taskName `
  -Action $action `
  -Trigger $trigger `
  -Settings $settings `
  -Principal $principal `
  -Description "Checks the configured daily cleaning-duty reminder time every minute." `
  -Force | Out-Null

Write-Output "Registered '$taskName' to check the configured reminder time every minute."
Write-Output "The computer, MySQL service, and your Windows session must be available."
