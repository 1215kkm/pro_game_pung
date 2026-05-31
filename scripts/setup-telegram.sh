#!/usr/bin/env bash
# setup-telegram.sh — 강팀 텔레그램 봇 연결 초기 세팅
#
# 1) BotFather에서 봇 만든 토큰 입력
# 2) 본인 chat_id 자동 감지 또는 수동 입력
# 3) ~/.claude/team-config/telegram.env 에 저장 (chmod 600)
# 4) 테스트 메시지 1건 발송으로 검증

set -euo pipefail

CONFIG_DIR="$HOME/.claude/team-config"
CONFIG="$CONFIG_DIR/telegram.env"

# 비대화형 자동 셋업 — 환경변수에 토큰·chat_id 가 이미 있으면 그대로 저장하고 종료.
# 클로드 웹 컨테이너·Codespaces·CI 환경에서 매번 새로 묻지 않도록.
if [[ -n "${TELEGRAM_BOT_TOKEN:-}" && -n "${TELEGRAM_CHAT_ID:-}" ]]; then
  mkdir -p "$CONFIG_DIR"
  umask 077
  {
    echo "# 강팀 텔레그램 설정 (환경변수에서 자동 주입됨)"
    echo "TELEGRAM_BOT_TOKEN=\"$TELEGRAM_BOT_TOKEN\""
    echo "TELEGRAM_CHAT_ID=\"$TELEGRAM_CHAT_ID\""
    [[ -n "${AI_TEAM_TOKEN:-}" ]] && echo "AI_TEAM_TOKEN=\"$AI_TEAM_TOKEN\""
  } > "$CONFIG"
  chmod 600 "$CONFIG"
  echo "✓ 환경변수에서 텔레그램 설정 자동 저장 — $CONFIG"
  if curl -sS --max-time 5 -X POST \
       "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
       --data-urlencode "chat_id=$TELEGRAM_CHAT_ID" \
       --data-urlencode "text=✅ 강팀 → 텔레그램 자동 연결 완료 (환경변수)" \
       | grep -q '"ok":true'; then
    echo "✓ 테스트 메시지 발송 성공"
  else
    echo "⚠ 테스트 메시지 실패 — 토큰/chat_id 확인 필요 (네트워크 일시 장애일 수 있음)"
  fi
  exit 0
fi

cat <<'EOF'
강팀 → 텔레그램 연결 세팅
─────────────────────────

준비 1: 텔레그램에서 @BotFather 검색 → /newbot
        → 봇 이름·@username 정해주면 토큰 줍니다 (123456:ABC-DEF...).
준비 2: 방금 만든 봇과 텔레그램에서 대화 시작 — 아무 메시지나 한 번 보내주세요
        (안 보내면 chat_id 자동 감지 안 됨).

대화형 입력을 피하려면: 환경변수 TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID 를 세팅한 뒤
다시 실행하면 *묻지 않고* 자동 저장됩니다.

EOF

read -r -p "1) 봇 토큰 (BotFather가 준 문자열): " TOKEN
[[ -z "$TOKEN" ]] && { echo "토큰이 비었습니다." >&2; exit 1; }

# chat_id 자동 감지 시도
echo
echo "2) chat_id 감지 중... (봇과 한 번이라도 대화해야 잡힙니다)"
UPDATES=$(curl -sS --max-time 10 "https://api.telegram.org/bot${TOKEN}/getUpdates" || echo "")
CHAT_ID=$(echo "$UPDATES" \
  | grep -oE '"chat":\{"id":-?[0-9]+' \
  | head -1 | sed 's/.*"id"://')

if [[ -n "$CHAT_ID" ]]; then
  echo "   감지됨: chat_id = $CHAT_ID"
  read -r -p "   이 값으로 진행할까요? (Y/n) " ans
  if [[ "$ans" == "n" || "$ans" == "N" ]]; then CHAT_ID=""; fi
fi

if [[ -z "$CHAT_ID" ]]; then
  echo "   자동 감지 실패. 수동 입력하시려면 다음 방법:"
  echo "   - 봇에게 메시지 한 번 보낸 뒤 브라우저에서 열기:"
  echo "     https://api.telegram.org/bot${TOKEN}/getUpdates"
  echo "   - 응답 JSON에서 \"chat\":{\"id\":...} 의 숫자."
  read -r -p "   chat_id 직접 입력: " CHAT_ID
fi
[[ -z "$CHAT_ID" ]] && { echo "chat_id가 비었습니다." >&2; exit 1; }

# 3) (선택) AI_TEAM_TOKEN — 다른 레포에서 강팀 학습 PR 만들 때 필요한 PAT
echo
echo "3) (선택) Ai_Team 학습 토큰"
echo "   다른 프로젝트 회의에서 텔레그램 🧠 버튼 누르면 Ai_Team 레포에 자동 PR 만드는 데 필요한"
echo "   fine-grained PAT 입니다 (Repo: 1215kkm/Ai_Team, Permissions: Issues read/write)."
echo "   지금 안 만들었으면 Enter 로 스킵 가능 (나중에 'bash setup-telegram.sh' 다시 실행)."
read -r -p "   AI_TEAM_TOKEN (없으면 Enter): " AI_TEAM_TOKEN

# 저장
mkdir -p "$CONFIG_DIR"
umask 077
{
  echo "# 강팀 텔레그램 봇 설정 — 절대 깃에 올리지 마세요."
  echo "TELEGRAM_BOT_TOKEN=\"$TOKEN\""
  echo "TELEGRAM_CHAT_ID=\"$CHAT_ID\""
  [[ -n "$AI_TEAM_TOKEN" ]] && echo "AI_TEAM_TOKEN=\"$AI_TEAM_TOKEN\""
} > "$CONFIG"
chmod 600 "$CONFIG"
echo
echo "저장됨: $CONFIG (권한 600)"

# 테스트
echo
echo "3) 테스트 메시지 발송..."
RESP=$(curl -sS --max-time 10 -X POST \
  "https://api.telegram.org/bot${TOKEN}/sendMessage" \
  --data-urlencode "chat_id=$CHAT_ID" \
  --data-urlencode "text=✅ 강팀 → 텔레그램 연결 성공
이제 회의 마감 시 회의록이 여기로 전송됩니다.")
if echo "$RESP" | grep -q '"ok":true'; then
  echo "   ✓ 텔레그램에서 메시지 확인하세요."
  echo
  echo "끝. 다음부터는 회의 마감 시 자동 전송됩니다."
  echo "   수동 전송: bash scripts/send-meeting.sh"
else
  echo "   ✗ 실패:" >&2
  echo "$RESP" >&2
  exit 1
fi
