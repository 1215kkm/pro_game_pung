#!/usr/bin/env bash
# install-global.sh — Ai_Team을 전역 (~/.claude/)에 설치
# Linux / macOS / Git Bash on Windows
#
# 사용:
#   bash ./scripts/install-global.sh           # 기존 파일 있으면 확인
#   bash ./scripts/install-global.sh --force   # 묻지 않고 덮어쓰기

set -euo pipefail

FORCE=0
[[ "${1:-}" == "--force" ]] && FORCE=1

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SRC_AGENTS="$REPO_ROOT/.claude/agents"
SRC_CMDS="$REPO_ROOT/.claude/commands"
SRC_KNOW="$REPO_ROOT/.claude/knowledge"
SRC_HOOKS="$REPO_ROOT/.claude/hooks"
SRC_TPL="$REPO_ROOT/templates"
SRC_BIN="$REPO_ROOT/scripts"
DST_ROOT="$HOME/.claude"
DST_AGENTS="$DST_ROOT/agents"
DST_CMDS="$DST_ROOT/commands"
DST_KNOW="$DST_ROOT/knowledge"
DST_HOOKS="$DST_ROOT/hooks"
DST_TPL="$DST_ROOT/templates"
DST_BIN="$DST_ROOT/bin"
DST_WF="$DST_ROOT/workflows"
SRC_WF="$REPO_ROOT/.github/workflows"

if [[ ! -d "$SRC_AGENTS" ]]; then
  echo "에이전트 폴더를 찾지 못함: $SRC_AGENTS" >&2
  echo "레포 루트에서 실행했나요?" >&2
  exit 1
fi

echo "Ai_Team 전역 설치"
echo "  source : $REPO_ROOT"
echo "  target : $DST_ROOT"
echo

mkdir -p "$DST_AGENTS" "$DST_CMDS" "$DST_KNOW" "$DST_HOOKS" "$DST_TPL" "$DST_BIN" "$DST_WF"

copy_tree() {
  local from="$1" to="$2" label="$3"
  while IFS= read -r -d '' file; do
    local rel="${file#$from/}"
    local target="$to/$rel"
    mkdir -p "$(dirname "$target")"

    if [[ -e "$target" && $FORCE -eq 0 ]]; then
      read -r -p "[$label] 덮어쓸까? $rel  (y/N) " ans
      if [[ "$ans" != "y" && "$ans" != "Y" ]]; then
        echo "  스킵: $rel"
        continue
      fi
    fi
    cp "$file" "$target"
    echo "  복사: $rel"
  done < <(find "$from" -type f -print0)
}

echo "[1/6] agents 복사"
copy_tree "$SRC_AGENTS" "$DST_AGENTS" "agents"
echo
echo "[2/6] commands 복사 (슬래시 커맨드: /회의시작, /진행)"
if [[ -d "$SRC_CMDS" ]]; then
  copy_tree "$SRC_CMDS" "$DST_CMDS" "commands"
fi
echo
echo "[3/6] knowledge 복사 (전역 브레인 포함)"
copy_tree "$SRC_KNOW" "$DST_KNOW" "knowledge"
echo
echo "[4/6] templates 복사 (회의록·목업·회고)"
copy_tree "$SRC_TPL" "$DST_TPL" "templates"
echo
echo "[5/6] scripts 복사 (start-meeting, send-meeting, pull-team, promote-to-team, new-project 등)"
copy_tree "$SRC_BIN" "$DST_BIN" "scripts"
chmod +x "$DST_BIN"/*.sh 2>/dev/null || true

if [[ -d "$SRC_HOOKS" ]]; then
  echo
  echo "[5b] hooks 복사 (session-start 등)"
  copy_tree "$SRC_HOOKS" "$DST_HOOKS" "hooks"
  chmod +x "$DST_HOOKS"/*.sh 2>/dev/null || true
fi

echo
echo "[6/7] GitHub Actions workflows 복사 (telegram-poll 등)"
if [[ -d "$SRC_WF" ]]; then
  copy_tree "$SRC_WF" "$DST_WF" "workflows"
fi

echo
echo "[7/7] 글로벌 CLAUDE.md 에 트리거 룰 삽입 (강팀 불러오기 / 발언 규칙)"
GLOBAL_MD="$DST_ROOT/CLAUDE.md"
SNIPPET="$REPO_ROOT/templates/global-trigger-rule.md"
if [[ -f "$SNIPPET" ]]; then
  mkdir -p "$DST_ROOT"
  touch "$GLOBAL_MD"
  if grep -q "강팀 트리거 룰 (BEGIN)" "$GLOBAL_MD" 2>/dev/null; then
    # 기존 블록을 새 내용으로 교체 (BEGIN~END 사이만)
    awk -v snippet="$SNIPPET" '
      BEGIN { skip=0 }
      /강팀 트리거 룰 \(BEGIN\)/ { skip=1; while ((getline line < snippet) > 0) print line; close(snippet); next }
      /강팀 트리거 룰 \(END\)/  { skip=0; next }
      skip==0 { print }
    ' "$GLOBAL_MD" > "$GLOBAL_MD.tmp" && mv "$GLOBAL_MD.tmp" "$GLOBAL_MD"
    echo "  ✓ 기존 트리거 룰 블록 갱신"
  else
    printf '\n' >> "$GLOBAL_MD"
    cat "$SNIPPET" >> "$GLOBAL_MD"
    echo "  ✓ 새 트리거 룰 블록 추가"
  fi
fi

echo
echo "완료. 이제 어떤 레포에서든:"
echo "  • Claude Code 열면 5인(강팀장·강디·강개발·강체크·아뱅) 호출 가능"
echo "  • 회의 시작:   /회의시작  (Claude Code 슬래시 커맨드)"
echo "  • 강팀 불러오기 (다른 레포에서): \"강팀 불러와\" 또는 /강팀불러오기"
echo "  • 텔레그램 셋업: bash ~/.claude/bin/setup-telegram.sh   (한 번만)"
echo "  • 새 프로젝트: bash ~/.claude/bin/new-project.sh \"이름\""
echo "  • 기존 레포 시크릿 등록: bash ~/.claude/bin/setup-repo-secrets.sh"
echo "프로젝트 .claude/ 에 같은 파일이 있으면 그쪽이 우선."
