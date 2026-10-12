# Start Claude Code with the HydraDB plugin's key taken from Infisical.
# The key lives only in this process's environment; nothing is written to disk.
#   .\dogfood\claude-hydradb.ps1              resume the latest conversation here
#   .\dogfood\claude-hydradb.ps1 -Fresh       start a new conversation
param([switch]$Fresh)

$root = Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
  # Keep workspace docs flowing into the company brain across Claude restarts.
  $watching = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" |
    Where-Object { $_.CommandLine -match 'dogfood[\\/]sync\.mjs.*--watch' }
  if (-not $watching) {
    Start-Process -WindowStyle Minimized -WorkingDirectory $root -FilePath node -ArgumentList 'dogfood/sync.mjs', '--watch'
  }

  $key = (& infisical secrets get hydradb_apy_key --env=dev --path=/ --domain=https://app.infisical.com/api --plain --silent | Out-String).Trim()
  if (-not $key) { Write-Error 'Infisical returned no HydraDB key. Run `infisical login` and retry.'; exit 1 }
  $env:HYDRADB_API_KEY = $key
  Remove-Variable key
  if ($Fresh) { & claude } else { & claude --continue }
} finally {
  Remove-Item Env:\HYDRADB_API_KEY -ErrorAction SilentlyContinue
  Pop-Location
}
