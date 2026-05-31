# start-meeting.ps1 — 강팀 새 회의 폴더 생성 (Windows)
#
# 사용: pwsh ./scripts/start-meeting.ps1 "회의 주제"

param(
    [Parameter(Mandatory=$true, Position=0)]
    [string]$Title
)

$ErrorActionPreference = "Stop"

$date = Get-Date -Format "yyyy-MM-dd"
$slug = ($Title -replace ' ', '-') -replace '[\/\\:*?"<>|]', ''
$dir  = ".ai-team/meetings/${date}-${slug}"

New-Item -ItemType Directory -Force -Path $dir | Out-Null

function Find-Template($name) {
    $candidates = @(
        ".claude/templates/$name",
        "$HOME/.claude/templates/$name",
        (Join-Path $PSScriptRoot "../templates/$name")
    )
    foreach ($p in $candidates) {
        if (Test-Path $p) { return (Resolve-Path $p).Path }
    }
    throw "템플릿을 찾을 수 없음: $name"
}

$meetingTpl = Find-Template "meeting.html"
$mockupTpl  = Find-Template "mockup.html"

(Get-Content $meetingTpl -Raw) `
    -replace '{{TITLE}}', $Title `
    -replace '{{DATE}}', $date `
    -replace '{{AGENDA}}', $Title |
  Set-Content "$dir/meeting.html" -Encoding utf8

(Get-Content $mockupTpl -Raw) `
    -replace '{{TITLE}}', $Title |
  Set-Content "$dir/mockup.html" -Encoding utf8

Write-Host "회의 폴더 생성:"
Write-Host "  $dir/meeting.html  (브라우저로 열어 회의 진행)"
Write-Host "  $dir/mockup.html   (강디2가 화면 안건 시 채움)"
Write-Host ""
Write-Host "다음: 강팀장이 'meeting.html'을 열고 첫 턴 (안건·참석자·진행 순서)을 적는다."
