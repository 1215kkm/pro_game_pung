#!/usr/bin/env bash
# promote-to-team.sh — 다른 레포에서 강팀이 회의·작업한 내용 중 *재사용 가능한 부분*을
# Ai_Team 본체 레포에 PR 로 올린다. 자동 머지하지 않음 — CEO 가 PR 페이지에서 직접 머지.
#
# 사용:
#   bash promote-to-team.sh [회의폴더경로]
#     - 인자 없으면 ./.ai-team/meetings/ 의 가장 최근 폴더 선택
#
# 동작:
#   1) 현재 프로젝트·회의 식별 (프로젝트명·주제·날짜·요약)
#   2) Ai_Team 레포를 /tmp 에 clone → 새 브랜치 (learn/<프로젝트>-<날짜>-<슬러그>)
#   3) .claude/knowledge/team-memory/lessons/<날짜>-<프로젝트>-<슬러그>.md 추가
#      (회의 요약 + 출처 + "재사용 가능 패턴" 섹션)
#   4) gh CLI 있으면 PR 자동 생성, 없으면 push 만 하고 URL 안내.

set -euo pipefail

MEETING_DIR=""
TEAM_REPO="1215kkm/Ai_Team"
TEAM_BRANCH_BASE="main"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --repo)   TEAM_REPO="$2"; shift 2 ;;
    --base)   TEAM_BRANCH_BASE="$2"; shift 2 ;;
    -h|--help)
      sed -n '2,/^set -e/p' "$0" | sed 's/^# \{0,1\}//;/^set -e/d'; exit 0 ;;
    *) MEETING_DIR="$1"; shift ;;
  esac
done

err() { echo "오류: $*" >&2; exit 1; }
log() { echo "$@" >&2; }

# 1) 회의 폴더 결정
if [[ -z "$MEETING_DIR" ]]; then
  [[ -d ".ai-team/meetings" ]] || err ".ai-team/meetings/ 가 없습니다. 회의가 한 번도 없었거나 위치가 다릅니다."
  MEETING_DIR="$(find .ai-team/meetings -mindepth 1 -maxdepth 1 -type d -print0 \
    | xargs -0 ls -dt 2>/dev/null | head -1 || true)"
  [[ -n "$MEETING_DIR" ]] || err ".ai-team/meetings/ 안에 회의 폴더가 없습니다."
fi
[[ -d "$MEETING_DIR" ]] || err "회의 폴더 없음: $MEETING_DIR"
MEETING_HTML="$MEETING_DIR/meeting.html"
[[ -f "$MEETING_HTML" ]] || err "meeting.html 없음: $MEETING_HTML"

# 2) 메타 추출
TITLE="$(grep -m1 -oE '<title>[^<]*</title>' "$MEETING_HTML" | sed 's/<[^>]*>//g' || echo "강팀 회의")"
DATE="$(grep -m1 -oE '날짜: [0-9-]+' "$MEETING_HTML" | sed 's/날짜: //' || date +%F)"
[[ -z "$DATE" ]] && DATE="$(date +%F)"

PROJECT_NAME=""
if git rev-parse --show-toplevel >/dev/null 2>&1; then
  PROJECT_NAME="$(basename "$(git rev-parse --show-toplevel)")"
  REMOTE_URL="$(git config --get remote.origin.url 2>/dev/null || true)"
  [[ -n "$REMOTE_URL" ]] && PROJECT_NAME="$(echo "$REMOTE_URL" | sed -E 's#.*[:/]([^/]+/[^/.]+)(\.git)?$#\1#')"
fi
[[ -z "$PROJECT_NAME" ]] && PROJECT_NAME="$(basename "$(pwd)")"

# 슬러그 — 영문/숫자/하이픈만
SLUG="$(echo "$TITLE" | tr '[:upper:]' '[:lower:]' \
        | sed -E 's/[^a-z0-9가-힣]+/-/g; s/^-+|-+$//g' \
        | cut -c1-40)"
[[ -z "$SLUG" ]] && SLUG="meeting"

# 3) 요약 추출
SUMMARY="$(awk '
    /<!-- SUMMARY_START -->/ { flag=1; next }
    /<!-- SUMMARY_END -->/   { flag=0 }
    flag
  ' "$MEETING_HTML" \
  | sed -e 's/<br[^>]*>/\n/gi' -e 's/<\/li>/\n/gi' -e 's/<li[^>]*>/- /gi' \
        -e 's/<\/h[1-6]>/\n/gi' -e 's/<h[1-6][^>]*>/\n### /gi' \
        -e 's/<[^>]*>//g' \
  | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
[[ -z "$SUMMARY" ]] && SUMMARY="(요약 마커가 비어있습니다.)"

# 4) 강팀 레포 clone
WORK="$(mktemp -d -t kangteam-promote-XXXXXX)"
trap 'rm -rf "$WORK"' EXIT
log "강팀 레포 clone — $TEAM_REPO@$TEAM_BRANCH_BASE"
git clone --depth=1 --branch "$TEAM_BRANCH_BASE" \
  "https://github.com/$TEAM_REPO.git" "$WORK/team" >/dev/null 2>&1 \
  || err "강팀 레포 clone 실패. 네트워크 또는 권한 확인."

cd "$WORK/team"
BRANCH="learn/${PROJECT_NAME//\//-}-${DATE}-${SLUG}"
git checkout -b "$BRANCH" >/dev/null 2>&1

# 5) lesson 파일 추가
LESSON_DIR=".claude/knowledge/team-memory/lessons"
mkdir -p "$LESSON_DIR"
LESSON_FILE="$LESSON_DIR/${DATE}-${SLUG}.md"

cat > "$LESSON_FILE" <<EOF
# ${TITLE}

- **출처 프로젝트**: \`${PROJECT_NAME}\`
- **회의 일자**: ${DATE}
- **회의 폴더 (원본)**: \`${MEETING_DIR}\`

## 회의 요약

${SUMMARY}

## 재사용 가능 패턴 (CEO 가 PR 머지 전에 채워 주세요)

- [ ] 이 회의에서 *다른 프로젝트에도 적용할* 결정·패턴·체크리스트가 있나요?
- [ ] 그게 *기존 강팀 지식*과 충돌하나요? (충돌하면 어디?)
- [ ] 어느 에이전트의 룰 (.claude/agents/*.md) 또는 지식 (.claude/knowledge/*.md) 에 박아야 하나요?

## 적용 제안 (선택)

다음 파일에 추가:
- (예) \`.claude/agents/marketer.md\` — § 광고 SOP 항목에 한 줄
- (예) \`.claude/knowledge/team-memory/patterns/sns-paid-ads.md\` 새로 생성
EOF

git add "$LESSON_FILE"
git -c user.email="kang-team-bot@local" -c user.name="강팀 학습 봇" \
    -c commit.gpgsign=false \
    commit -m "learn: ${PROJECT_NAME} → ${TITLE} (${DATE})" >/dev/null

# 6) push + PR
PUSH_URL="https://github.com/$TEAM_REPO/pull/new/$BRANCH"
if git push -u origin "$BRANCH" >/dev/null 2>&1; then
  log "✓ 브랜치 푸시됨: $BRANCH"
else
  err "푸시 실패. 강팀 레포에 push 권한 있는 자격증명이 설정돼 있는지 확인."
fi

if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1; then
  PR_URL="$(gh pr create \
    --repo "$TEAM_REPO" \
    --base "$TEAM_BRANCH_BASE" \
    --head "$BRANCH" \
    --title "learn: ${PROJECT_NAME} → ${TITLE} (${DATE})" \
    --body "회의 \`${PROJECT_NAME}\` (${DATE}) 에서 *재사용 가능 패턴* 후보를 강팀 본체에 올립니다.

리뷰 항목:
- 어느 에이전트/지식 파일에 적용할지
- 기존 룰과 충돌 없는지

원본 회의 폴더: \`${MEETING_DIR}\`
" 2>&1 | tail -1)"
  log "✓ PR 생성: $PR_URL"
  echo "$PR_URL"
else
  log "ℹ gh CLI 없음 — 수동으로 PR 만들기: $PUSH_URL"
  echo "$PUSH_URL"
fi
