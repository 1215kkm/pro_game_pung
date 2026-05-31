# install-global.ps1 — Ai_Team을 전역 (~/.claude/)에 설치
# Windows PowerShell 5+ / PowerShell 7+
#
# 사용:
#   pwsh ./scripts/install-global.ps1            # 기존 파일 있으면 확인
#   pwsh ./scripts/install-global.ps1 -Force     # 묻지 않고 덮어쓰기

param(
    [switch]$Force
)

$ErrorActionPreference = "Stop"

$repoRoot   = Split-Path -Parent $PSScriptRoot
$srcAgents  = Join-Path $repoRoot ".claude/agents"
$srcCmds    = Join-Path $repoRoot ".claude/commands"
$srcKnow    = Join-Path $repoRoot ".claude/knowledge"
$srcTpl     = Join-Path $repoRoot "templates"
$srcBin     = Join-Path $repoRoot "scripts"
$srcWf      = Join-Path $repoRoot ".github/workflows"
$dstRoot    = Join-Path $HOME ".claude"
$dstAgents  = Join-Path $dstRoot "agents"
$dstCmds    = Join-Path $dstRoot "commands"
$dstKnow    = Join-Path $dstRoot "knowledge"
$dstTpl     = Join-Path $dstRoot "templates"
$dstBin     = Join-Path $dstRoot "bin"
$dstWf      = Join-Path $dstRoot "workflows"

if (-not (Test-Path $srcAgents)) {
    Write-Error "에이전트 폴더를 찾지 못함: $srcAgents (레포 루트에서 실행했나요?)"
}

Write-Host "Ai_Team 전역 설치"
Write-Host "  source : $repoRoot"
Write-Host "  target : $dstRoot"
Write-Host ""

foreach ($d in @($dstAgents, $dstCmds, $dstKnow, $dstTpl, $dstBin, $dstWf)) {
    New-Item -ItemType Directory -Force -Path $d | Out-Null
}

function Copy-Tree($from, $to, $label) {
    if (-not (Test-Path $from)) { return }
    Get-ChildItem -Path $from -File -Recurse | ForEach-Object {
        $rel    = $_.FullName.Substring($from.Length).TrimStart('\','/')
        $target = Join-Path $to $rel
        $dir    = Split-Path -Parent $target
        if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }

        if ((Test-Path $target) -and -not $Force) {
            $ans = Read-Host "[$label] 덮어쓸까? $rel  (y/N)"
            if ($ans -ne "y" -and $ans -ne "Y") { Write-Host "  스킵: $rel"; return }
        }
        Copy-Item -Path $_.FullName -Destination $target -Force
        Write-Host "  복사: $rel"
    }
}

Write-Host "[1/6] agents 복사"
Copy-Tree $srcAgents $dstAgents "agents"

Write-Host ""
Write-Host "[2/6] commands 복사 (슬래시 커맨드: /회의시작, /진행)"
Copy-Tree $srcCmds $dstCmds "commands"

Write-Host ""
Write-Host "[3/6] knowledge 복사 (전역 브레인 포함)"
Copy-Tree $srcKnow $dstKnow "knowledge"

Write-Host ""
Write-Host "[4/6] templates 복사 (회의록·목업·회고)"
Copy-Tree $srcTpl $dstTpl "templates"

Write-Host ""
Write-Host "[5/6] scripts 복사 (start-meeting, send-meeting, new-project 등)"
Copy-Tree $srcBin $dstBin "scripts"

Write-Host ""
Write-Host "[6/6] GitHub Actions workflows 복사 (telegram-poll 등)"
Copy-Tree $srcWf $dstWf "workflows"

Write-Host ""
Write-Host "완료. 이제 어떤 레포에서든:"
Write-Host "  - Claude Code 열면 강사장·강팀장·강디1·강디2·강개발·강체크·강홍보·강감시·아뱅 호출 가능"
Write-Host "  - 회의 시작 (Claude Code 안에서): /회의시작"
Write-Host "  - 텔레그램 셋업 (한 번만): pwsh ~/.claude/bin/setup-telegram.ps1"
Write-Host "  - 새 프로젝트: bash ~/.claude/bin/new-project.sh '이름'"
Write-Host "  - 기존 레포 시크릿 등록: pwsh ~/.claude/bin/setup-repo-secrets.ps1"
Write-Host "프로젝트 .claude/ 에 같은 파일이 있으면 그쪽이 우선."
