#!/usr/bin/env bash
# session-start.sh — Claude Code 세션 시작 시 강팀 가드.
# stdout 으로 출력되는 내용은 시스템 메시지로 클로드에 주입됨.
#
# 검사:
#   1) .claude/agents/pm.md 가 있는지 (강팀 설치됨?)
#   2) styles/active.txt + 그 스타일 파일이 있는지 (활성 디자인 스타일?)
#   3) styles/tokens.css 가 있는지 (강개발이 var(--...) 로 참조 가능?)
#   4) 강팀 레포 main 의 최신 SHA 와 로컬 .kang-version 비교 (업데이트 있음?)

set -u
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$REPO_ROOT" 2>/dev/null || exit 0

NOTES=()

# 1) 강팀 설치 확인
if [[ ! -f ".claude/agents/pm.md" ]]; then
  NOTES+=("⚠ 강팀(.claude/agents/) 이 이 레포에 없습니다. CEO 가 멤버를 호출하면 '강팀 불러와' 또는 /강팀불러오기 로 먼저 박을 것.")
fi

# 2) 활성 디자인 스타일 확인
ACTIVE_FILE=".claude/knowledge/ui-designer/styles/active.txt"
if [[ -f "$ACTIVE_FILE" ]]; then
  ACTIVE="$(tr -d '[:space:]' < "$ACTIVE_FILE")"
  # 0-padded + plain 둘 다 매치
  PADDED="$(printf '%02d' "$ACTIVE" 2>/dev/null || echo "")"
  STYLE_FILE="$(ls .claude/knowledge/ui-designer/styles/${PADDED}-*.md .claude/knowledge/ui-designer/styles/${ACTIVE}-*.md 2>/dev/null | head -1)"
  if [[ -n "$STYLE_FILE" && -f "$STYLE_FILE" ]]; then
    STYLE_NAME="$(grep -m1 '^# ' "$STYLE_FILE" | sed 's/^# *//')"
    NOTES+=("🎨 활성 디자인 스타일: #${ACTIVE} — ${STYLE_NAME}  (출처: ${STYLE_FILE#./})")
  else
    NOTES+=("⚠ active.txt 는 '#${ACTIVE}' 인데 그 번호의 스타일 파일이 없음. 강디가 카탈로그(styles/README.md)부터 확인해야 함.")
  fi
elif [[ -d ".claude/knowledge/ui-designer" ]]; then
  NOTES+=("⚠ 활성 디자인 스타일이 정해지지 않음 (.claude/knowledge/ui-designer/styles/active.txt 없음). 강디가 #1 로 초기화해야 함.")
fi

# 3) tokens.css 확인 (강개발이 참조하는 단일 진입점)
if [[ ! -f "styles/tokens.css" && -f "$ACTIVE_FILE" ]]; then
  NOTES+=("⚠ styles/tokens.css 없음 — 활성 스타일이 정해졌지만 토큰이 코드로 박혀있지 않음. 강디가 styles/tokens.css 를 만들고 토큰을 박아야 함.")
fi

# 4) 강팀 버전 SHA 체크 (네트워크 있을 때만, 조용히 실패)
LOCAL_SHA_FILE=".claude/.kang-version"
LOCAL_SHA="$([[ -f "$LOCAL_SHA_FILE" ]] && cat "$LOCAL_SHA_FILE" || echo "")"
if [[ -n "$LOCAL_SHA" ]]; then
  REMOTE_SHA="$(curl -fsSL --max-time 3 \
    "https://api.github.com/repos/1215kkm/Ai_Team/commits/main" 2>/dev/null \
    | grep -m1 '"sha"' | head -1 | sed 's/.*"sha": *"\([^"]*\)".*/\1/' || echo "")"
  if [[ -n "$REMOTE_SHA" && "$REMOTE_SHA" != "$LOCAL_SHA" ]]; then
    SHORT_LOCAL="${LOCAL_SHA:0:7}"
    SHORT_REMOTE="${REMOTE_SHA:0:7}"
    NOTES+=("ℹ 강팀 본체 업데이트 있음 (로컬 ${SHORT_LOCAL} → 원격 ${SHORT_REMOTE}). CEO 가 원하면 '강팀 업데이트' 또는 curl 한 줄로 갱신.")
  fi
fi

# 메시지 합쳐서 stdout 으로 (Claude Code 가 SessionStart 훅 stdout 을 컨텍스트에 추가)
if [[ ${#NOTES[@]} -gt 0 ]]; then
  echo "<강팀 가드 — 세션 시작 점검>"
  for n in "${NOTES[@]}"; do
    echo "  $n"
  done
fi

exit 0
