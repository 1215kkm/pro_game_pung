#requires -Version 5.1
<#
.SYNOPSIS
  강팀 시크릿을 현재(또는 지정한) GitHub 레포에 한 번에 등록 (Windows / PowerShell)

.DESCRIPTION
  $HOME\.claude\team-config\telegram.env 에서
    TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, AI_TEAM_TOKEN
  을 읽어 gh CLI 로 레포 시크릿 등록.

  .github\workflows\telegram-poll.yml 이 없으면 전역 설치본
  ($HOME\.claude\workflows\telegram-poll.yml) 에서 복사.

.PARAMETER Repo
  대상 레포 (owner/name). 생략 시 현재 디렉토리의 git 레포.

.EXAMPLE
  pwsh scripts/setup-repo-secrets.ps1
  pwsh scripts/setup-repo-secrets.ps1 -Repo 1215kkm/Ai_Team
#>
[CmdletBinding()]
param(
  [string]$Repo = ""
)

$ErrorActionPreference = "Stop"

$Config = Join-Path $HOME ".claude\team-config\telegram.env"
if (-not (Test-Path $Config)) {
  Write-Error "$Config 가 없습니다. 먼저 'pwsh scripts/setup-telegram.ps1' 을 실행해주세요."
  exit 1
}

# .env 파싱
$Token = $null; $ChatId = $null; $AiToken = $null
Get-Content $Config | ForEach-Object {
  if ($_ -match '^\s*TELEGRAM_BOT_TOKEN\s*=\s*"?([^"]+)"?\s*$') { $script:Token   = $Matches[1] }
  if ($_ -match '^\s*TELEGRAM_CHAT_ID\s*=\s*"?([^"]+)"?\s*$')   { $script:ChatId  = $Matches[1] }
  if ($_ -match '^\s*AI_TEAM_TOKEN\s*=\s*"?([^"]+)"?\s*$')      { $script:AiToken = $Matches[1] }
}

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  Write-Error "gh CLI 가 필요합니다. https://cli.github.com/"
  exit 1
}
& gh auth status 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Error "gh auth login 이 필요합니다."
  exit 1
}

$RepoArgs = @()
if ($Repo) { $RepoArgs = @("--repo", $Repo) }

function Set-Secret([string]$Name, [string]$Value) {
  if (-not $Value) {
    Write-Host "  - $Name : (값 없음, 스킵)"
    return
  }
  $Value | & gh secret set $Name @RepoArgs --body - | Out-Null
  if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ $Name"
  } else {
    Write-Host "  ✗ $Name (실패)"
  }
}

$target = if ($Repo) { $Repo } else {
  try { (& gh repo view --json nameWithOwner -q .nameWithOwner) } catch { "current" }
}
Write-Host "🔑 강팀 시크릿 등록: $target"

Set-Secret "TELEGRAM_BOT_TOKEN" $Token
Set-Secret "TELEGRAM_CHAT_ID"   $ChatId
Set-Secret "AI_TEAM_TOKEN"      $AiToken

# telegram-poll.yml 자동 복사 (cwd 가 레포 안일 때만)
if (-not $Repo) {
  $WfSrc = Join-Path $HOME ".claude\workflows\telegram-poll.yml"
  $WfDst = ".github\workflows\telegram-poll.yml"
  if ((Test-Path $WfSrc) -and -not (Test-Path $WfDst)) {
    New-Item -ItemType Directory -Force -Path ".github\workflows" | Out-Null
    Copy-Item $WfSrc $WfDst
    Write-Host "  ✓ .github\workflows\telegram-poll.yml 복사"
    Write-Host "    → git add + commit + push 후 Actions 탭에서 활성화 확인하세요."
  }
}

Write-Host ""
Write-Host "완료. 이 레포에서 텔레그램 명령이 15분 안에 픽업됩니다."
