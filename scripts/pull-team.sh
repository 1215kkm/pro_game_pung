#!/usr/bin/env bash
# pull-team.sh — 어느 레포에서나 "강팀 불러와" 한 문장으로 실행되는 본체.
# GitHub의 Ai_Team 레포에서 최신 강팀을 받아 현재 레포 + 전역(~/.claude/)에 설치.
#
# 사용:
#   bash pull-team.sh                           # 현재 디렉토리에 강팀 박기
#   bash pull-team.sh --no-local                # 전역만 (이 레포엔 .claude 안 박음)
#   bash pull-team.sh --repo OWNER/NAME         # 다른 강팀 포크에서 불러올 때
#   bash pull-team.sh --branch BRANCH           # 특정 브랜치
#
# 원격 한 줄 실행 (강팀이 아직 이 PC/컨테이너에 없을 때):
#   curl -fsSL https://raw.githubusercontent.com/1215kkm/Ai_Team/main/scripts/pull-team.sh | bash

set -euo pipefail

REPO="1215kkm/Ai_Team"
BRANCH="main"
LOCAL=1

while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-local) LOCAL=0; shift ;;
    --repo) REPO="$2"; shift 2 ;;
    --branch) BRANCH="$2"; shift 2 ;;
    -h|--help) sed -n '2,/^set -e/p' "$0" | sed 's/^# \{0,1\}//;/^set -e/d'; exit 0 ;;
    *) echo "알 수 없는 인자: $1" >&2; exit 1 ;;
  esac
done

CWD="$(pwd)"
TMP="$(mktemp -d -t kangteam-XXXXXX)"
trap 'rm -rf "$TMP"' EXIT

echo "강팀 불러오는 중 — $REPO@$BRANCH"
git clone --depth=1 --branch "$BRANCH" "https://github.com/$REPO.git" "$TMP/ai_team" >/dev/null 2>&1

echo "[1/2] 전역 설치 (~/.claude/)"
bash "$TMP/ai_team/scripts/install-global.sh" --force >/dev/null
echo "  ✓ agents · commands · knowledge · templates · scripts · workflows"

if [[ $LOCAL -eq 1 ]]; then
  echo "[2/2] 현재 레포에 .claude/ 박는 중 — $CWD"
  cd "$CWD"
  mkdir -p .claude templates scripts
  for sub in agents commands knowledge hooks; do
    if [[ -d "$TMP/ai_team/.claude/$sub" ]]; then
      mkdir -p ".claude/$sub"
      cp -r "$TMP/ai_team/.claude/$sub/." ".claude/$sub/"
    fi
  done
  # settings.json 은 *덮어쓰지 않음* — 사용자 커스터마이즈 보호. 없을 때만 복사.
  if [[ ! -f .claude/settings.json && -f "$TMP/ai_team/.claude/settings.json" ]]; then
    cp "$TMP/ai_team/.claude/settings.json" .claude/settings.json
  fi
  cp -r "$TMP/ai_team/templates/." templates/ 2>/dev/null || true
  cp "$TMP/ai_team/scripts/"*.sh scripts/ 2>/dev/null || true
  cp "$TMP/ai_team/scripts/"*.ps1 scripts/ 2>/dev/null || true
  chmod +x scripts/*.sh .claude/hooks/*.sh 2>/dev/null || true

  # 강팀 본체 버전 SHA 기록 — SessionStart 훅이 이걸로 업데이트 알림
  KANG_SHA="$(cd "$TMP/ai_team" && git rev-parse HEAD 2>/dev/null || echo "")"
  if [[ -n "$KANG_SHA" ]]; then
    echo "$KANG_SHA" > .claude/.kang-version
  fi

  if [[ ! -f CLAUDE.md ]]; then
    cat > CLAUDE.md <<'EOF'
# 강팀 작업 룰

이 레포는 강팀 (5명짜리 AI 팀)이 운영합니다.

## 발언 규칙 (절대)
강팀 닉네임(강팀장·강디·강개발·강체크·아뱅)으로
발언해야 할 때는 메인 클로드가 시늉하지 말고 *반드시* `Agent` 툴로 해당
서브에이전트(`pm`, `designer`, `developer`, `qa`, `marketer`)를 호출한다.

## 빠른 시작
```bash
/회의시작                 # 강팀장이 안건 자동 생성 → 회의 → 텔레그램 발송
/회의시작 "결제 전환율"   # 주제 지정
/진행                     # 다음 단계 자동 진행
```

## 디자인 베이스
활성 디자인 스타일 카탈로그 — `.claude/knowledge/ui-designer/styles/`
기본 #1 Crowny Class (보라→분홍 그라데이션, Pretendard, radius 10/16, Lucide)
EOF
    echo "  ✓ CLAUDE.md 새로 생성 (기존 룰이 있으면 안 덮어씀)"
  else
    echo "  - CLAUDE.md 이미 있음 — 건드리지 않음"
  fi
else
  echo "[2/2] --no-local 플래그 — 현재 레포는 건드리지 않음"
fi

echo
echo "✅ 강팀 도착. 이제 가능:"
echo "  /회의시작              # 회의 시작"
echo "  /진행                  # 다음 단계 진행"
[[ ! -f "$HOME/.claude/team-config/telegram.env" ]] && \
  echo "  bash ~/.claude/bin/setup-telegram.sh   # 텔레그램 1회 셋업 (선택)"
