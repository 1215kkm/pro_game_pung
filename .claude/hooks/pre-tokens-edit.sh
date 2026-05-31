#!/usr/bin/env bash
# pre-tokens-edit.sh — PreToolUse 훅 (Edit/Write 매처).
# styles/tokens.css 가 *활성 디자인 스타일과 어긋나는* 값으로 변경되려 할 때 차단.
#
# 입력: stdin 으로 JSON (tool_input.file_path, tool_input.new_string 등)
# 출력: stdout 으로 차단 메시지 / 종료코드 0 = 허용, 2 = 차단(에이전트에 메시지 노출)
#
# 호출 시점: Edit/Write 가 실행되기 *직전*. tools.input 의 file_path 가 styles/tokens.css 일 때만 검사.

set -u
REPO="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$REPO" 2>/dev/null || exit 0

# 1) tool_input 받기 (jq 있으면 사용, 없으면 grep)
INPUT="$(cat)"
FILE_PATH="$(echo "$INPUT" | grep -oE '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"\([^"]*\)"$/\1/')"

# tokens.css 아니면 조용히 통과
case "$FILE_PATH" in
  */styles/tokens.css|styles/tokens.css)
    ;;
  *)
    exit 0
    ;;
esac

# 2) 활성 스타일 파일 찾기
ACTIVE_FILE="$REPO/.claude/knowledge/ui-designer/styles/active.txt"
[[ -f "$ACTIVE_FILE" ]] || exit 0  # 활성 스타일 없으면 (정의 안 됨) 통과

N="$(tr -d '[:space:]' < "$ACTIVE_FILE")"
P="$(printf '%02d' "$N" 2>/dev/null || echo "$N")"
STYLE_FILE="$(ls "$REPO/.claude/knowledge/ui-designer/styles/"${P}-*.md 2>/dev/null | head -1)"
[[ -n "$STYLE_FILE" && -f "$STYLE_FILE" ]] || exit 0  # 스타일 파일 못 찾으면 통과

# 3) new_string 추출 + HEX 발견 검사 (스타일 파일에 없는 HEX 박으려 하면 차단)
NEW_STRING="$(echo "$INPUT" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("tool_input",{}).get("new_string","") or json.load(sys.stdin).get("tool_input",{}).get("content",""))' 2>/dev/null || echo "")"
[[ -z "$NEW_STRING" ]] && exit 0

# new_string 에서 HEX 추출 (3·6자리)
NEW_HEXES="$(echo "$NEW_STRING" | grep -oiE '#[0-9a-f]{6}|#[0-9a-f]{3}\b' | tr 'a-f' 'A-F' | sort -u)"
[[ -z "$NEW_HEXES" ]] && exit 0

# 활성 스타일 파일에 있는 HEX
STYLE_HEXES="$(grep -oiE '#[0-9a-f]{6}|#[0-9a-f]{3}\b' "$STYLE_FILE" | tr 'a-f' 'A-F' | sort -u)"

# 4) 차이 — 활성 스타일에 *없는* HEX
UNAUTHORIZED=()
while IFS= read -r hex; do
  [[ -z "$hex" ]] && continue
  if ! echo "$STYLE_HEXES" | grep -qF "$hex"; then
    UNAUTHORIZED+=("$hex")
  fi
done <<< "$NEW_HEXES"

if [[ ${#UNAUTHORIZED[@]} -gt 0 ]]; then
  STYLE_NAME="$(grep -m1 '^# ' "$STYLE_FILE" | sed 's/^# *//')"
  cat <<EOF >&2
⛔ 차단: styles/tokens.css 에 활성 디자인 스타일(#${N} ${STYLE_NAME})에 *없는* HEX 가 박히려 했습니다.

발견된 미등록 HEX: ${UNAUTHORIZED[*]}

활성 스타일 파일: ${STYLE_FILE#$REPO/}

해결:
  1) 의도된 색이면 → 위 스타일 파일에 *먼저* 토큰 추가 (§2 색상 팔레트 / §15 CSS 변수)
  2) 실수면 → 활성 스타일에 정의된 var(--primary), var(--secondary) 등을 쓰세요
  3) 새 스타일이 필요하면 → /디자인스타일 N (새 번호 등록)
EOF
  exit 2
fi

exit 0
