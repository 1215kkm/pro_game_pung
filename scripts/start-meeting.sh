#!/usr/bin/env bash
# start-meeting.sh — 강팀 새 회의 폴더 생성
#
# 사용: bash start-meeting.sh "회의 주제"
#   현재 디렉토리 아래 .ai-team/meetings/YYYY-MM-DD-slug/ 폴더 + meeting.html + mockup.html 생성

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "사용: $0 \"회의 주제\"" >&2
  exit 1
fi

TITLE="$1"
DATE=$(date +%F)
# slug: 한글/영문 모두 OK, 공백→하이픈, 특수문자 일부 제거
SLUG=$(echo "$TITLE" | tr ' ' '-' | tr -d '/\\:*?"<>|')

DIR=".ai-team/meetings/${DATE}-${SLUG}"
mkdir -p "$DIR"

# 템플릿 찾기 — 프로젝트 .claude/templates 우선, 없으면 전역 ~/.claude/templates
find_template() {
  local name="$1"
  for p in \
    ".claude/templates/$name" \
    "$HOME/.claude/templates/$name" \
    "$(dirname "$0")/../templates/$name"; do
    if [[ -f "$p" ]]; then echo "$p"; return 0; fi
  done
  echo "템플릿을 찾을 수 없음: $name" >&2
  return 1
}

MEETING_TPL=$(find_template "meeting.html")
MOCKUP_TPL=$(find_template "mockup.html")

# placeholder 치환
sed -e "s/{{TITLE}}/${TITLE}/g" -e "s/{{DATE}}/${DATE}/g" -e "s/{{AGENDA}}/${TITLE}/g" \
  "$MEETING_TPL" > "$DIR/meeting.html"
sed -e "s/{{TITLE}}/${TITLE}/g" "$MOCKUP_TPL" > "$DIR/mockup.html"

echo "회의 폴더 생성:"
echo "  $DIR/meeting.html  (브라우저로 열어 회의 진행)"
echo "  $DIR/mockup.html   (강디가 화면 안건 시 채움)"
echo ""
echo "다음: 강팀장이 'meeting.html'을 열고 첫 턴 (안건·참석자·진행 순서)을 적는다."
