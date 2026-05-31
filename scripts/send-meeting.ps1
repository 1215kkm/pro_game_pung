#requires -Version 5.1
<#
.SYNOPSIS
  강팀 회의록을 텔레그램으로 전송 (Windows / PowerShell)

.DESCRIPTION
  ./.ai-team/meetings/ 의 가장 최근 폴더에서 meeting.html · mockup.html 을 골라
  텍스트 요약 + HTML 첨부 + (선택) PNG 스크린샷을 본인 봇 DM 으로 전송.

  설정 파일: $HOME\.claude\team-config\telegram.env
  처음이면 ./scripts/setup-telegram.ps1 먼저 실행.

.PARAMETER MeetingDir
  회의 폴더 경로. 생략 시 가장 최근 폴더 자동 선택.

.PARAMETER DryRun
  실제 전송 없이 어떤 내용 갈지만 출력.

.PARAMETER NoPng
  PNG 스크린샷 생략.

.PARAMETER NoHtml
  HTML 파일 첨부 생략.
#>
[CmdletBinding()]
param(
  [string]$MeetingDir = "",
  [switch]$DryRun,
  [switch]$NoPng,
  [switch]$NoHtml
)

$ErrorActionPreference = "Stop"

function Die($msg) { Write-Error $msg; exit 1 }

# ---------- 회의 폴더 찾기 ----------
if (-not $MeetingDir) {
  if (-not (Test-Path ".ai-team/meetings")) {
    Die ".ai-team/meetings 가 없습니다. 인자로 경로를 주거나 그 위치에서 실행하세요."
  }
  $MeetingDir = (Get-ChildItem ".ai-team/meetings" -Directory | Sort-Object LastWriteTime -Descending | Select-Object -First 1).FullName
  if (-not $MeetingDir) { Die "회의 폴더가 비어 있습니다." }
}
if (-not (Test-Path $MeetingDir)) { Die "회의 폴더 없음: $MeetingDir" }

$MeetingHtml = Join-Path $MeetingDir "meeting.html"
$MockupHtml  = Join-Path $MeetingDir "mockup.html"
if (-not (Test-Path $MeetingHtml)) { Die "meeting.html 없음: $MeetingHtml" }

$Title = (Select-String -Path $MeetingHtml -Pattern "<title>(.+?)</title>" -List).Matches.Groups[1].Value
if (-not $Title) { $Title = "강팀 회의" }
$DateMatch = Select-String -Path $MeetingHtml -Pattern "날짜: ([0-9-]+)" -List
$Date = if ($DateMatch) { $DateMatch.Matches.Groups[1].Value } else { (Get-Date -Format "yyyy-MM-dd") }

Write-Host "회의: $Title ($Date)"
Write-Host "폴더: $MeetingDir"

# ---------- 텔레그램 설정 로드 ----------
$Config = Join-Path $HOME ".claude\team-config\telegram.env"
$Token = $null; $ChatId = $null
if (-not $DryRun) {
  if (-not (Test-Path $Config)) { Die "$Config 없음. 먼저 setup-telegram.ps1 을 실행하세요." }
  Get-Content $Config | ForEach-Object {
    if ($_ -match '^\s*TELEGRAM_BOT_TOKEN\s*=\s*"?([^"]+)"?\s*$') { $script:Token  = $Matches[1] }
    if ($_ -match '^\s*TELEGRAM_CHAT_ID\s*=\s*"?([^"]+)"?\s*$')   { $script:ChatId = $Matches[1] }
  }
  if (-not $Token)  { Die "TELEGRAM_BOT_TOKEN 누락" }
  if (-not $ChatId) { Die "TELEGRAM_CHAT_ID 누락" }
}
$Api = "https://api.telegram.org/bot$Token"

# ---------- 요약 추출 ----------
function Extract-Summary($html) {
  $content = Get-Content -Raw $html
  if ($content -match '(?s)<!-- SUMMARY_START -->(.*?)<!-- SUMMARY_END -->') {
    $body = $Matches[1]
    $body = $body -replace '<br[^>]*>', "`n"
    $body = $body -replace '</li>', "`n"
    $body = $body -replace '<li[^>]*>', "• "
    $body = $body -replace '</h[1-6]>', "`n"
    $body = $body -replace '<h[1-6][^>]*>', "`n■ "
    $body = $body -replace '<[^>]+>', ''
    $body = ($body -split "`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ }) -join "`n"
    return $body
  }
  return ""
}
$Summary = Extract-Summary $MeetingHtml
if (-not $Summary) { $Summary = "(SUMMARY 마커가 비어있습니다. 강팀장이 마감 턴에 채워주세요.)" }

$Message = @"
<b>🎯 강팀 회의록</b>
<i>$Title</i>
<code>$Date</code>

$Summary
"@
if ($Message.Length -gt 3900) {
  $Message = $Message.Substring(0, 3900) + "`n...(잘림 — 첨부 meeting.html 참조)"
}

# ---------- PNG 렌더 ----------
$ScreenMeeting = $null; $ScreenMockup = $null
function Render-Png($src, $out) {
  $chrome = $null
  foreach ($cand in @(
    "chrome", "chromium", "msedge",
    "C:\Program Files\Google\Chrome\Application\chrome.exe",
    "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
  )) {
    if ((Get-Command $cand -ErrorAction SilentlyContinue) -or (Test-Path $cand)) { $chrome = $cand; break }
  }
  if (-not $chrome) { return $false }
  $abs = (Resolve-Path $src).Path -replace '\\','/'
  & $chrome --headless --disable-gpu --hide-scrollbars --virtual-time-budget=3000 `
            --window-size=1200,1800 --screenshot="$out" "file:///$abs" 2>$null | Out-Null
  return (Test-Path $out) -and ((Get-Item $out).Length -gt 0)
}
if (-not $NoPng) {
  $TmpDir = Join-Path $env:TEMP ("kteam-" + [guid]::NewGuid().ToString("N").Substring(0,8))
  New-Item -ItemType Directory -Force -Path $TmpDir | Out-Null
  try {
    $mp = Join-Path $TmpDir "meeting.png"
    if (Render-Png $MeetingHtml $mp) { $ScreenMeeting = $mp; Write-Host "✓ meeting.png 렌더링" }
    else { Write-Host "⚠ 헤드리스 크롬 없음 — PNG 스킵" }
    if (Test-Path $MockupHtml) {
      $kp = Join-Path $TmpDir "mockup.png"
      if (Render-Png $MockupHtml $kp) { $ScreenMockup = $kp; Write-Host "✓ mockup.png 렌더링" }
    }
  } catch { Write-Host "PNG 렌더링 실패: $_" }
}

# ---------- Dry run ----------
if ($DryRun) {
  Write-Host "── DRY RUN ──"
  Write-Host "[메시지]"; Write-Host $Message; Write-Host ""
  Write-Host "[첨부]"
  if (-not $NoHtml) { Write-Host "  - $MeetingHtml" }
  if (-not $NoHtml -and (Test-Path $MockupHtml)) { Write-Host "  - $MockupHtml" }
  if ($ScreenMeeting) { Write-Host "  - $ScreenMeeting (PNG)" }
  if ($ScreenMockup)  { Write-Host "  - $ScreenMockup (PNG)" }
  exit 0
}

# ---------- 텔레그램 전송 ----------
function Send-TG($method, $form) {
  try {
    $resp = Invoke-RestMethod -Uri "$Api/$method" -Method Post -Form $form -TimeoutSec 30
    if (-not $resp.ok) { throw "텔레그램 $method 실패: $($resp | ConvertTo-Json -Depth 5)" }
  } catch {
    Write-Error "텔레그램 $method 실패: $_"
    throw
  }
}

Write-Host "→ 요약 텍스트 전송"
Send-TG "sendMessage" @{
  chat_id = $ChatId
  text = $Message
  parse_mode = "HTML"
  disable_web_page_preview = "true"
}

if (-not $NoHtml) {
  Write-Host "→ meeting.html 전송"
  Send-TG "sendDocument" @{
    chat_id = $ChatId
    document = Get-Item $MeetingHtml
    caption = "meeting.html"
  }
  if (Test-Path $MockupHtml) {
    $mockupContent = Get-Content -Raw $MockupHtml
    $hasScreens = $mockupContent -match '(?s)<!-- SCREENS_START -->(.*?)<!-- SCREENS_END -->' -and `
                  ($Matches[1] -match 'class="screen"')
    if ($hasScreens) {
      Write-Host "→ mockup.html 전송"
      Send-TG "sendDocument" @{
        chat_id = $ChatId
        document = Get-Item $MockupHtml
        caption = "mockup.html"
      }
    } else {
      Write-Host "  mockup.html 비어있음 — 스킵"
    }
  }
}

if ($ScreenMeeting) {
  Write-Host "→ meeting PNG 전송"
  Send-TG "sendPhoto" @{
    chat_id = $ChatId; photo = Get-Item $ScreenMeeting; caption = "📋 회의 흐름"
  }
}
if ($ScreenMockup) {
  Write-Host "→ mockup PNG 전송"
  Send-TG "sendPhoto" @{
    chat_id = $ChatId; photo = Get-Item $ScreenMockup; caption = "🎨 화면 목업"
  }
}

Write-Host "✓ 전송 완료 — 텔레그램에서 확인하세요."
