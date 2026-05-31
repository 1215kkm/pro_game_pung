#requires -Version 5.1
<#
.SYNOPSIS
  강팀 텔레그램 봇 연결 초기 세팅 (Windows / PowerShell)
.DESCRIPTION
  1) BotFather에서 만든 토큰 입력
  2) 본인 chat_id 자동 감지 또는 수동 입력
  3) $HOME\.claude\team-config\telegram.env 에 저장
  4) 테스트 메시지로 검증
#>

$ErrorActionPreference = "Stop"

Write-Host @"
강팀 → 텔레그램 연결 세팅
─────────────────────────

준비 1: 텔레그램에서 @BotFather 검색 → /newbot
        → 봇 이름·@username 정해주면 토큰 줍니다 (123456:ABC-DEF...).
준비 2: 방금 만든 봇과 텔레그램에서 대화 시작 — 아무 메시지나 한 번 보내주세요
        (안 보내면 chat_id 자동 감지 안 됨).

"@

$Token = Read-Host "1) 봇 토큰 (BotFather가 준 문자열)"
if (-not $Token) { Write-Error "토큰이 비었습니다."; exit 1 }

Write-Host ""
Write-Host "2) chat_id 감지 중... (봇과 한 번이라도 대화해야 잡힙니다)"
$ChatId = ""
try {
  $resp = Invoke-RestMethod -Uri "https://api.telegram.org/bot$Token/getUpdates" -TimeoutSec 10
  if ($resp.ok -and $resp.result.Count -gt 0) {
    $ChatId = $resp.result[0].message.chat.id
  }
} catch { }

if ($ChatId) {
  Write-Host "   감지됨: chat_id = $ChatId"
  $ans = Read-Host "   이 값으로 진행할까요? (Y/n)"
  if ($ans -eq "n" -or $ans -eq "N") { $ChatId = "" }
}
if (-not $ChatId) {
  Write-Host "   자동 감지 실패. 봇에게 메시지 한 번 보낸 뒤 브라우저에서:"
  Write-Host "     https://api.telegram.org/bot$Token/getUpdates"
  Write-Host "   응답의 chat.id 숫자를 직접 입력하세요."
  $ChatId = Read-Host "   chat_id"
}
if (-not $ChatId) { Write-Error "chat_id가 비었습니다."; exit 1 }

$ConfigDir = Join-Path $HOME ".claude\team-config"
$Config = Join-Path $ConfigDir "telegram.env"
New-Item -ItemType Directory -Force -Path $ConfigDir | Out-Null
@"
# 강팀 텔레그램 봇 설정 — 절대 깃에 올리지 마세요.
TELEGRAM_BOT_TOKEN="$Token"
TELEGRAM_CHAT_ID="$ChatId"
"@ | Set-Content -Path $Config -Encoding UTF8

Write-Host ""
Write-Host "저장됨: $Config"

Write-Host ""
Write-Host "3) 테스트 메시지 발송..."
try {
  $r = Invoke-RestMethod -Uri "https://api.telegram.org/bot$Token/sendMessage" `
    -Method Post -Body @{
      chat_id = $ChatId
      text = "✅ 강팀 → 텔레그램 연결 성공`n이제 회의 마감 시 회의록이 여기로 전송됩니다."
    } -TimeoutSec 10
  if ($r.ok) {
    Write-Host "   ✓ 텔레그램에서 메시지 확인하세요."
    Write-Host ""
    Write-Host "끝. 다음부터는 회의 마감 시 자동 전송됩니다."
    Write-Host "   수동 전송: pwsh scripts/send-meeting.ps1"
  } else {
    Write-Error "테스트 실패: $($r | ConvertTo-Json -Depth 5)"
  }
} catch {
  Write-Error "테스트 실패: $_"
}
