#!/usr/bin/env bash
# new-project.sh — 강팀이 들어간 새 프로젝트 스캐폴드
#
# 사용:
#   bash new-project.sh "프로젝트명" [--dir 경로] [--stack html|next|vite] [--no-git]
#
# 만드는 것:
#   • 프로젝트 폴더 + git init
#   • .claude/, templates/, scripts/ 전역에서 복사 (이미 install-global 됐으면)
#   • CLAUDE.md (이 프로젝트 전용)
#   • 디자인 시스템 CSS 변수 한 묶음 (styles/tokens.css)
#   • 기본 스택 골조

set -euo pipefail

NAME=""
DIR=""
STACK="html"
NO_GIT=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dir) DIR="$2"; shift 2 ;;
    --stack) STACK="$2"; shift 2 ;;
    --no-git) NO_GIT=1; shift ;;
    -h|--help)
      sed -n '2,/^set -e/p' "$0" | sed 's/^# \{0,1\}//;/^set -e/d'; exit 0 ;;
    *) [[ -z "$NAME" ]] && NAME="$1" || { echo "알 수 없는 인자: $1" >&2; exit 1; }; shift ;;
  esac
done

[[ -z "$NAME" ]] && { echo "사용: $0 \"프로젝트명\"" >&2; exit 1; }
[[ -z "$DIR" ]] && DIR="./$NAME"

# 강팀 글로벌 위치
GLOBAL="$HOME/.claude"
if [[ ! -d "$GLOBAL/agents" ]]; then
  echo "강팀 전역 설치본을 찾지 못함: $GLOBAL/agents" >&2
  echo "먼저 Ai_Team 레포에서 'bash scripts/install-global.sh' 실행해주세요." >&2
  exit 1
fi

mkdir -p "$DIR"
cd "$DIR"

echo "📦 강팀 새 프로젝트: $NAME"
echo "   위치: $(pwd)"
echo "   스택: $STACK"
echo

# 1) .claude/ 복사 (프로젝트 로컬 — 전역보다 우선 적용)
mkdir -p .claude
for sub in agents commands knowledge; do
  if [[ -d "$GLOBAL/$sub" ]]; then
    cp -r "$GLOBAL/$sub" ".claude/$sub"
  fi
done

# 2) templates, scripts (회의 시작·텔레그램 전송용)
mkdir -p templates scripts
cp -r "$GLOBAL/templates/." templates/ 2>/dev/null || true
cp "$GLOBAL/bin/"*.sh scripts/ 2>/dev/null || true
cp "$GLOBAL/bin/"*.ps1 scripts/ 2>/dev/null || true
chmod +x scripts/*.sh 2>/dev/null || true

# 3) 디자인 시스템 토큰 CSS (강개발이 모든 페이지에서 var(--...) 로 참조)
mkdir -p styles
cat > styles/tokens.css <<'EOF'
/* Crowny Class 디자인 시스템 토큰 — 이 파일만 수정해도 전 페이지 반영됨.
   상세 명세: ../.claude/knowledge/ui-designer/design-system.md */
@import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css');
@import url('https://fonts.googleapis.com/css2?family=Agbalumo&display=swap');

:root {
  /* 브랜드 */
  --primary: #8A38F5;
  --primary-dark: #7030D4;
  --primary-light: #A855F7;
  --primary-rgb: 138, 56, 245;
  --secondary: #D53A6B;
  --secondary-light: #F472B6;
  --gradient: linear-gradient(135deg, #8A38F5 0%, #D53A6B 100%);

  /* 다크 */
  --dark-bg: #1B1D21;
  --dark-secondary: #1A1C22;
  --dark-tertiary: #2B2D35;
  --dark-border: #3D3D54;

  /* 라이트 */
  --light-bg: #F3F4F6;
  --light-card: #FFFFFF;
  --light-border: #E5E7EB;
  --light-hover: #F9FAFB;

  /* 텍스트 */
  --text-primary: #FFFFFF;
  --text-dark: #1F2937;
  --text-secondary: #9CA3AF;
  --text-muted: #6B7280;

  /* 상태 */
  --success: #22C55E; --success-light: #DCFCE7;
  --warning: #F59E0B; --warning-light: #FEF3C7;
  --error:   #EF4444; --error-light:   #FEE2E2;
  --info:    #3B82F6; --info-light:    #DBEAFE;

  /* 모서리 */
  --radius-sm: 6px; --radius-md: 10px; --radius-lg: 12px;
  --radius-xl: 16px; --radius-2xl: 20px; --radius-full: 9999px;

  /* 그림자 */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-md: 0 4px 6px rgba(0,0,0,0.07);
  --shadow-lg: 0 10px 15px rgba(0,0,0,0.10);
  --shadow-xl: 0 20px 25px rgba(0,0,0,0.15);
  --shadow-primary: 0 4px 14px rgba(138, 56, 245, 0.35);

  /* 간격 (8px 그리드) */
  --spacing-xs: 4px; --spacing-sm: 8px; --spacing-md: 16px;
  --spacing-lg: 24px; --spacing-xl: 32px;

  /* 섹션·컨텐츠 */
  --section-gap: var(--spacing-xl);
  --section-padding-y: var(--spacing-xl);
  --section-padding-x: var(--spacing-lg);
  --content-gap: var(--spacing-md);
  --content-padding: var(--spacing-md);
  --card-padding: var(--spacing-md);

  /* 레이아웃 */
  --sidebar-width: 260px;
  --header-height: 64px;
  --content-max-width: 1280px;

  /* 폰트 크기 */
  --font-xs:  11px; --font-sm:  13px; --font-md:  14px;
  --font-lg:  16px; --font-xl:  18px; --font-2xl: 24px; --font-3xl: 28px;

  /* 폰트 패밀리 */
  --font-family-base:    'Pretendard Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-family-display: 'Agbalumo', cursive;

  /* 트랜지션 */
  --transition-fast:   0.15s ease;
  --transition-normal: 0.2s ease;
  --transition-slow:   0.3s ease;

  /* 보더 */
  --border-color: #E5E7EB;
  --border: 1px solid #E5E7EB;
}

* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: var(--font-family-base);
  font-size: var(--font-md);
  line-height: 1.6;
  color: var(--text-dark);
  background: var(--light-bg);
}
EOF

# 4) 프로젝트 전용 CLAUDE.md (이 레포에서 강팀이 어떻게 일할지)
cat > CLAUDE.md <<EOF
# $NAME — 강팀 작업 룰

이 프로젝트는 **강팀**이 운영합니다. 자세한 팀 정체성·디자인 베이스·회의 프로토콜·자동 진행 상태 머신은 \`.claude/\` 폴더에 그대로 들어있습니다.

## 빠른 시작

\`\`\`bash
# 회의 시작 (강팀장이 안건 자동 생성)
/회의시작

# 또는 주제 지정
/회의시작 "결제 페이지 전환율 떨어지는 원인 잡기"

# 회의 끝나면 자동으로 텔레그램 발송됩니다.
# 텔레그램 또는 여기서 "진행해" 라고 하시면 다음 단계 진행.
/진행
\`\`\`

## 디자인 베이스

**Crowny Class 디자인 시스템** — 보라(#8A38F5) → 분홍(#D53A6B) 그라데이션, Pretendard 폰트, Lucide 아이콘. 모든 CSS 값은 \`styles/tokens.css\` 의 변수로만. CSS 라이브러리 사용 금지 — 순수 CSS.

## 스택

- 프론트: $STACK
- 디자인 토큰: \`styles/tokens.css\` 한 파일에 전부
- 회의록·목업: \`.ai-team/meetings/\`
EOF

# 4b) README.md — 빈 레포에 들어오는 *새* 클로드 세션이 첫 메시지에 보게 하는 진입점
#     (글로벌 트리거 룰이 없는 PC·컨테이너에서도 "강팀 불러와"가 작동하게 만드는 핵심)
cat > README.md <<EOF
# $NAME

> **이 레포는 강팀(Ai_Team) 5명짜리 AI 팀이 운영합니다.**
> 클로드 코드 세션 첫 메시지로 아래를 그대로 채팅창에 붙여넣으세요 — 강팀이 자동으로 박힙니다.
>
> \`\`\`
> 이거 한 줄 돌려줘: curl -fsSL https://raw.githubusercontent.com/1215kkm/Ai_Team/main/scripts/pull-team.sh | bash
> \`\`\`
>
> 강팀 도착 후 \`/회의시작\` 으로 첫 회의. 자세한 룰은 \`CLAUDE.md\`.

## 스택
- 프론트: $STACK
- 디자인 토큰: \`styles/tokens.css\` (활성 스타일 #1 Crowny Class)
- 회의록·목업: \`.ai-team/meetings/\`

## 강팀 5명
🎯 강팀장(pm) · 🎨 강디(designer) · ⚙️ 강개발(developer) · 🔍 강체크(qa) · 💡 아뱅(marketer)
EOF

# 5) 스택별 골조
case "$STACK" in
  html)
    cat > index.html <<EOF
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>$NAME</title>
  <link rel="stylesheet" href="styles/tokens.css">
  <link rel="stylesheet" href="styles/app.css">
  <script src="https://unpkg.com/lucide@latest"></script>
</head>
<body>
  <main style="max-width: var(--content-max-width); margin: 0 auto; padding: var(--section-padding-y) var(--section-padding-x);">
    <h1 style="font-family: var(--font-family-display); background: var(--gradient); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">$NAME</h1>
    <p style="color: var(--text-muted);">강팀이 만든 새 프로젝트</p>
    <button style="background: var(--gradient); color: var(--text-primary); border: none; padding: 10px 20px; border-radius: var(--radius-md); font: 600 var(--font-md) var(--font-family-base); cursor: pointer;">
      <i data-lucide="rocket"></i> 시작하기
    </button>
  </main>
  <script>lucide.createIcons();</script>
</body>
</html>
EOF
    cat > styles/app.css <<'EOF'
/* 페이지·컴포넌트 스타일. 모든 값은 tokens.css 의 var(--...) 를 통한다. */
EOF
    ;;
  next|vite)
    echo "($STACK 스택 골조는 강개발이 회의에서 셋업합니다.)"
    cat > styles/app.css <<'EOF'
/* 페이지·컴포넌트 스타일. 모든 값은 tokens.css 의 var(--...) 를 통한다. */
EOF
    ;;
esac

# 6) 상태 머신 초기 파일
mkdir -p .ai-team
cat > .ai-team/state.json <<EOF
{
  "stage": "idle",
  "meeting": null,
  "decisions": [],
  "actions": [],
  "history": [],
  "gates": {
    "deploy": "pending",
    "promote": "pending"
  }
}
EOF

# 7) .gitignore
cat > .gitignore <<'EOF'
node_modules/
.env
.env.local
*.log
.DS_Store
.claude/settings.local.json
# 강팀 로컬 자격증명·텔레그램 마지막 update_id 등은 ~/.claude/team-config/ 로 (이 레포 밖)
EOF

# 8) telegram-poll workflow 자동 복사 (글로벌 설치본에서)
GLOBAL_WF="$GLOBAL/workflows/telegram-poll.yml"
if [[ -f "$GLOBAL_WF" ]]; then
  mkdir -p .github/workflows
  cp "$GLOBAL_WF" .github/workflows/telegram-poll.yml
  echo "  ✓ telegram-poll.yml 복사됨"
fi

# 9) git init
if [[ $NO_GIT -eq 0 ]] && command -v git >/dev/null 2>&1; then
  git init -q
  git add .
  git -c commit.gpgsign=false commit -q -m "chore: scaffold with 강팀 (Crowny Class 디자인 시스템)"
fi

# 10) GitHub 레포 + 시크릿 자동 등록 (gh CLI + ~/.claude/team-config/telegram.env 있을 때만)
SECRETS_SET=0
if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1 \
   && [[ -f "$HOME/.claude/team-config/telegram.env" ]]; then
  echo
  read -r -p "GitHub 레포를 자동 생성하고 시크릿을 등록할까요? (y/N) " ans
  if [[ "$ans" == "y" || "$ans" == "Y" ]]; then
    read -r -p "  레포 공개 범위 [private/public] (기본 private): " VIS
    VIS="${VIS:-private}"
    gh repo create "$NAME" "--$VIS" --source=. --push 2>/dev/null || \
      echo "  (이미 있거나 실패 — 수동으로 'gh repo create' 해주세요)"
    if [[ -x "$GLOBAL/bin/setup-repo-secrets.sh" ]]; then
      bash "$GLOBAL/bin/setup-repo-secrets.sh" && SECRETS_SET=1
    fi
  fi
fi

echo
echo "✅ 완료. 다음 단계:"
echo "  cd $DIR"
if [[ $SECRETS_SET -eq 0 ]]; then
  echo "  # (선택) GitHub 시크릿 한 번에 등록:"
  echo "  bash ~/.claude/bin/setup-repo-secrets.sh"
fi
echo "  # Claude Code 열고:"
echo "  /회의시작"
