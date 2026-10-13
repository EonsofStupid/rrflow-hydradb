[CmdletBinding()]
param([switch]$Seed)
$ErrorActionPreference = 'Stop'
$appDirectory = Split-Path -Parent $PSScriptRoot
$composePath = Join-Path $appDirectory 'qdrant/compose.yml'
$linuxComposeResult = & wsl -d Ubuntu -- wslpath -a $composePath.Replace('\', '/')
if ($LASTEXITCODE -ne 0 -or !$linuxComposeResult) { throw 'Could not resolve the Qdrant Compose path in Ubuntu WSL.' }
$linuxComposePath = $linuxComposeResult.Trim()
& wsl -d Ubuntu -u root -- docker compose -f $linuxComposePath up -d
if ($LASTEXITCODE -ne 0) { throw 'Qdrant services could not start. Their existing data volumes were preserved.' }
if ($Seed) {
  $seedPath = (Join-Path $PSScriptRoot 'qdrant-seed.mjs').Replace('\', '/')
  $linuxSeedResult = & wsl -d Ubuntu -- wslpath -a $seedPath
  if ($LASTEXITCODE -ne 0 -or !$linuxSeedResult) { throw 'Could not resolve the Qdrant seed script path.' }
  $linuxSeedPath = $linuxSeedResult.Trim()
  & wsl -d Ubuntu -- /home/devcontainers/.local/share/fnm/node-versions/v22.23.3/installation/bin/node $linuxSeedPath
  if ($LASTEXITCODE -ne 0) { throw 'Qdrant seeding did not complete. Check the local Personal seed input and service readiness.' }
}
& wsl -d Ubuntu -u root -- docker compose -f $linuxComposePath ps
