#!/usr/bin/env bash
# setup-repo-secrets.sh — 현재 git 레포(또는 인자로 받은 레포)에 강팀이 쓰는 시크릿을
# ~/.claude/team-config/telegram.env 에서 읽어 한 번에 등록한다.
#
# 사용:
#   bash setup-repo-secrets.sh                   # 현재 디렉토리의 git 레포
#   bash setup-repo-secrets.sh owner/repo        # 특정 레포 지정
#
# 등록 대상:
#   TELEGRAM_BOT_TOKEN  (필수)
#   TELEGRAM_CHAT_ID    (필수)
#   AI_TEAM_TOKEN       (있으면, 학습 루프용)
#
# 추가로 .github/workflows/telegram-poll.yml 이 없으면 Ai_Team 글로벌 설치본에서 복사.

set -euo pipefail

CONFIG="$HOME/.claude/team-config/telegram.env"
if [[ ! -f "$CONFIG" ]]; then
  echo "$CONFIG 가 없습니다. 먼저 'bash setup-telegram.sh' 실행해주세요." >&2
  exit 1
fi

# shellcheck disable=SC1090
source "$CONFIG"

if ! command -v gh >/dev/null 2>&1; then
  echo "gh CLI 가 필요합니다. https://cli.github.com/" >&2
  exit 1
fi
gh auth status >/dev/null 2>&1 || { echo "gh auth login 필요" >&2; exit 1; }

REPO_ARG="${1:-}"
REPO_FLAG=""
[[ -n "$REPO_ARG" ]] && REPO_FLAG="--repo $REPO_ARG"

set_secret() {
  local name="$1" value="$2"
  if [[ -z "$value" ]]; then
    echo "  - $name: (값 없음, 스킵)"
    return
  fi
  # shellcheck disable=SC2086
  echo "$value" | gh secret set "$name" $REPO_FLAG --body - >/dev/null
  echo "  ✓ $name"
}

echo "🔑 강팀 시크릿 등록: ${REPO_ARG:-$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || echo current)}"
set_secret TELEGRAM_BOT_TOKEN "${TELEGRAM_BOT_TOKEN:-}"
set_secret TELEGRAM_CHAT_ID   "${TELEGRAM_CHAT_ID:-}"
set_secret AI_TEAM_TOKEN      "${AI_TEAM_TOKEN:-}"

# telegram-poll.yml 자동 복사
GLOBAL_WF="$HOME/.claude/bin/../workflows/telegram-poll.yml"
ALT_WF="$HOME/.claude/workflows/telegram-poll.yml"
SRC_WF=""
for cand in "$ALT_WF" "$GLOBAL_WF"; do
  [[ -f "$cand" ]] && SRC_WF="$cand" && break
done

if [[ -n "$SRC_WF" && -z "$REPO_ARG" ]]; then
  if [[ ! -f .github/workflows/telegram-poll.yml ]]; then
    mkdir -p .github/workflows
    cp "$SRC_WF" .github/workflows/telegram-poll.yml
    echo "  ✓ .github/workflows/telegram-poll.yml 복사"
    echo "    → git add + commit + push 한 뒤 GitHub Actions 탭에서 활성화 확인하세요."
  fi
fi

echo
echo "완료. 이 레포에서 텔레그램 명령이 15분 안에 픽업됩니다."
