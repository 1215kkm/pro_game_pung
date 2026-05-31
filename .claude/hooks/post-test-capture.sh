#!/usr/bin/env bash
# post-test-capture.sh — PostToolUse 훅 (Bash 매처).
# 테스트 명령(npm test / pytest / vitest / jest 등) 실행 직후 stdout/stderr 의 끝 30줄을
# .ai-team/last-test-output.txt 에 적재 — 다음 강체크·강개발 호출 컨텍스트에 자동 주입됨.
#
# 입력: stdin 으로 JSON (tool_input.command, tool_result.stdout, tool_result.stderr 등)
# 출력: 항상 종료코드 0 (관찰만, 차단 X)

set -u
REPO="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$REPO" 2>/dev/null || exit 0

INPUT="$(cat)"

# tool_input.command 추출
CMD="$(echo "$INPUT" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("tool_input",{}).get("command",""))' 2>/dev/null || echo "")"

# 테스트 명령인지 확인 (간단 휴리스틱)
case "$CMD" in
  *"npm test"*|*"npm run test"*|*"pytest"*|*"vitest"*|*"jest"*|*"go test"*|*"cargo test"*|*"phpunit"*|*"rspec"*)
    ;;
  *)
    exit 0
    ;;
esac

mkdir -p "$REPO/.ai-team"
OUT_FILE="$REPO/.ai-team/last-test-output.txt"

# stdout + stderr 추출, 마지막 30줄
{
  echo "=== 마지막 테스트 명령 — $(date '+%Y-%m-%d %H:%M:%S') ==="
  echo "명령: $CMD"
  echo ""
  echo "--- stdout (마지막 30줄) ---"
  echo "$INPUT" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("tool_result",{}).get("stdout",""))' 2>/dev/null | tail -30
  echo ""
  echo "--- stderr (마지막 30줄) ---"
  echo "$INPUT" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("tool_result",{}).get("stderr",""))' 2>/dev/null | tail -30
} > "$OUT_FILE" 2>/dev/null

exit 0
