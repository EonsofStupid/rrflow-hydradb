param([ValidateSet('dev','start')][string]$Mode = 'dev', [ValidatePattern('^\.next(?:-[a-z0-9-]+)?$')][string]$BuildDirectory = '.next', [ValidateRange(1024,65535)][int]$Port = 3100, [switch]$QdrantCloud)
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
  if ($QdrantCloud) {
    $taskQdrantValues = @{}
    foreach ($taskQdrantName in @('qdrant', 'qdrant-endpoint')) {
      $taskQdrantJson = & infisical secrets get $taskQdrantName --env dev --output json --expand=false --include-imports=false --silent --domain 'https://app.infisical.com/api' 2>$null
      if ($LASTEXITCODE -ne 0) { throw 'Infisical could not retrieve the Qdrant cloud connection.' }
      $taskQdrantValues[$taskQdrantName] = [string](@(($taskQdrantJson | ConvertFrom-Json) | Where-Object secretKey -eq $taskQdrantName)[0].secretValue)
    }
    if ($taskQdrantValues['qdrant'].Length -lt 16 -or $taskQdrantValues['qdrant-endpoint'] -notmatch '^https://') { throw 'The saved Qdrant cloud endpoint or key is missing.' }
    $env:QDRANT_PERSONAL_URL = $taskQdrantValues['qdrant-endpoint']; $env:QDRANT_WORK_URL = $env:QDRANT_PERSONAL_URL
    $env:QDRANT_PERSONAL_API_KEY = $taskQdrantValues['qdrant']; $env:QDRANT_WORK_API_KEY = $env:QDRANT_PERSONAL_API_KEY
    $env:QDRANT_PERSONAL_COLLECTION = 'rrflow_personal_sources'; $env:QDRANT_WORK_COLLECTION = 'rrflow_shippin_sources'
    $env:WSLENV += ':QDRANT_PERSONAL_URL/u:QDRANT_WORK_URL/u:QDRANT_PERSONAL_API_KEY/u:QDRANT_WORK_API_KEY/u:QDRANT_PERSONAL_COLLECTION/u:QDRANT_WORK_COLLECTION/u'
    $taskQdrantJson = $null; $taskQdrantValues = $null
  }
  $taskSecretJson = $null
  $taskRecords = $null
  $taskRaindropJson = $null
  if ($Port -eq 3100) {
    & wsl -d Ubuntu -- bash "$taskLinuxRoot/rrflow-app/scripts/wsl-run.sh" $Mode
  } elseif ($Mode -eq 'start') {
    & wsl -d Ubuntu -- bash "$taskLinuxRoot/rrflow-app/scripts/wsl-run.sh" --filter '@rrflow/app' exec next start --hostname 127.0.0.1 --port $Port
  } else {
    & wsl -d Ubuntu -- bash "$taskLinuxRoot/rrflow-app/scripts/wsl-run.sh" --filter '@rrflow/app' exec next dev --webpack --hostname 127.0.0.1 --port $Port
  }
} finally {
  $env:HYDRA_DB_API_KEY = $null
  $env:RRFLOW_RESEARCH_PATH = $null
  $env:HYDRA_DB_DATABASE = $null
  $env:RAINDROP_WRITE_KEY = $null
  $env:RAINDROP_PROJECT_ID = $null
  $env:RRFLOW_DIST_DIR = $null
  foreach ($taskQdrantEnv in @('QDRANT_PERSONAL_URL','QDRANT_WORK_URL','QDRANT_PERSONAL_API_KEY','QDRANT_WORK_API_KEY','QDRANT_PERSONAL_COLLECTION','QDRANT_WORK_COLLECTION')) { [Environment]::SetEnvironmentVariable($taskQdrantEnv, $null, 'Process') }
  $env:WSLENV = $taskOldWslEnv
  Set-Location -LiteralPath $taskPreviousLocation.Path
}
