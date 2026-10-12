param([ValidateSet('dev','start')][string]$Mode = 'dev', [ValidatePattern('^\.next(?:-[a-z0-9-]+)?$')][string]$BuildDirectory = '.next')
$ErrorActionPreference = 'Stop'
$taskWorkspace = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)
$taskPreviousLocation = Get-Location
$taskOldWslEnv = $env:WSLENV
try {
  Set-Location -LiteralPath $taskWorkspace
  $taskSecretJson = & infisical secrets get hydradb_apy_key --env dev --output json --expand=false --include-imports=false --silent --domain 'https://app.infisical.com/api' 2>$null
  if ($LASTEXITCODE -ne 0) { throw 'Infisical could not retrieve the configured HydraDB credential.' }
  $taskRecords = $taskSecretJson | ConvertFrom-Json
  $env:HYDRA_DB_API_KEY = [string](@($taskRecords | Where-Object secretKey -eq 'hydradb_apy_key')[0].secretValue)
  if (-not $env:HYDRA_DB_API_KEY) { throw 'The configured HydraDB credential is missing.' }
  $taskRaindropJson = & infisical secrets get RAINDROP_WRITE_KEY --env dev --output json --expand=false --include-imports=false --silent --domain 'https://app.infisical.com/api' 2>$null
  if ($LASTEXITCODE -ne 0) { throw 'Infisical could not retrieve the configured Raindrop credential.' }
  $env:RAINDROP_WRITE_KEY = [string](@(($taskRaindropJson | ConvertFrom-Json) | Where-Object secretKey -eq 'RAINDROP_WRITE_KEY')[0].secretValue)
  if (-not $env:RAINDROP_WRITE_KEY) { throw 'The configured Raindrop credential is missing.' }
  $env:RAINDROP_PROJECT_ID = 'rrflow-hydradb'
  $env:RRFLOW_DIST_DIR = $BuildDirectory
  $taskPosixWindowsPath = $taskWorkspace.Replace('\', '/')
  $taskLinuxRoot = (& wsl -d Ubuntu -- wslpath -a $taskPosixWindowsPath).Trim()
  $env:RRFLOW_RESEARCH_PATH = "$taskLinuxRoot/research/inputs/brain-sources.json"
  $env:HYDRA_DB_DATABASE = 'seniordev'
  $env:WSLENV = (@($taskOldWslEnv, 'HYDRA_DB_API_KEY/u', 'HYDRA_DB_DATABASE/u', 'RRFLOW_RESEARCH_PATH/u', 'RAINDROP_WRITE_KEY/u', 'RAINDROP_PROJECT_ID/u', 'RRFLOW_DIST_DIR/u') | Where-Object { $_ }) -join ':'
  $taskSecretJson = $null
  $taskRecords = $null
  $taskRaindropJson = $null
  & wsl -d Ubuntu -- bash "$taskLinuxRoot/rrflow-app/scripts/wsl-run.sh" $Mode
} finally {
  $env:HYDRA_DB_API_KEY = $null
  $env:RRFLOW_RESEARCH_PATH = $null
  $env:HYDRA_DB_DATABASE = $null
  $env:RAINDROP_WRITE_KEY = $null
  $env:RAINDROP_PROJECT_ID = $null
  $env:RRFLOW_DIST_DIR = $null
  $env:WSLENV = $taskOldWslEnv
  Set-Location -LiteralPath $taskPreviousLocation.Path
}
