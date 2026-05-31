#!/usr/bin/env bash
# agent-brief.sh — 회의시작 프로토콜이 에이전트를 호출하기 *직전* 부르는 헬퍼.
# 전체 정의·전체 카탈로그를 통째로 던지지 말고, *이번 안건에 필요한 한 페이지*만 추출해 stdout.
#
# 사용:
#   bash scripts/agent-brief.sh <agent-id> "<topic>"
#
# 예:
#   bash scripts/agent-brief.sh designer "결제 페이지 카드 컴포넌트"
#   bash scripts/agent-brief.sh qa "결제 금액 검증"
#   bash scripts/agent-brief.sh marketer "신규 강의 런칭 캠페인"

set -u

AGENT="${1:-}"
TOPIC="${2:-}"

if [[ -z "$AGENT" || -z "$TOPIC" ]]; then
  echo "사용: $0 <agent-id> \"<topic>\"" >&2
  echo "agents: pm | designer | developer | qa | marketer" >&2
  exit 1
fi

REPO="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
KNOW="$REPO/.claude/knowledge"

# 1) 활성 디자인 스타일 (디자인·구현 안건일 때 항상 한 줄)
ACTIVE_STYLE=""
if [[ -f "$KNOW/ui-designer/styles/active.txt" ]]; then
  N="$(tr -d '[:space:]' < "$KNOW/ui-designer/styles/active.txt")"
  P="$(printf '%02d' "$N" 2>/dev/null || echo "$N")"
  STYLE_FILE="$(ls "$KNOW/ui-designer/styles/"${P}-*.md 2>/dev/null | head -1)"
  if [[ -n "$STYLE_FILE" ]]; then
    ACTIVE_STYLE="현재 활성 디자인 스타일: #${N} — $(grep -m1 '^# ' "$STYLE_FILE" | sed 's/^# *//')  (출처: ${STYLE_FILE#$REPO/})"
  fi
fi

# 2) 안건 키워드 추출 (간단: 공백 분리, 1~2글자 단어 제거)
KEYWORDS=()
for w in $TOPIC; do
  [[ ${#w} -ge 2 ]] && KEYWORDS+=("$w")
done

# 3) 에이전트별 *지도*만 출력 — 전체 .md 가 아니라 책임 한 줄·금기 5개·응답 형식
print_map() {
  local role="$1"
  case "$role" in
    pm)
      cat <<'EOF'
[강팀장 지도]
- 책임: 우선순위 정리 + 태스크 분해 + 라우팅 + CEO 결정 포인트 묶기
- 절대 금기: 혼자 결정 / 무조건 동의 / 핑퐁 질문 / 활성 스타일 토큰 밖 산출물 통과
- 응답 형식: ① 요청 한 줄 재서술 ② 반대 시각 한 줄 ③ 우선순위 매트릭스(항목 3+ 시) ④ 태스크 분해 ⑤ CEO 결정 필요 묶음 ⑥ 다음 액션
EOF
      ;;
    designer)
      cat <<'EOF'
[강디 지도] — UX 먼저, UI 나중
- 책임: 사용자 흐름·IA·마찰 진단(UX) + 활성 스타일 토큰 위에 컴포넌트·상태·시각 위계(UI)
- 절대 금기: 흐름 없이 시각부터 / 임의 HEX·즉석 토큰 / 폰트 < 16px / 상태(loading/error/empty) 누락 / Pretendard·Lucide 외 도입
- 응답 형식: ① 사용자 목표 ② 흐름(분기 ≤2, 단계 ≤3) ③ 시각 위계 ④ 컴포넌트+상태 ⑤ 토큰 매핑 ⑥ 강개발 핸드오프
- 회의 첫 발언에 활성 스타일 한 줄 박을 것
EOF
      ;;
    developer)
      cat <<'EOF'
[강개발 지도]
- 책임: 강디 안 → 동작 코드. CSS 라이브러리 금지·순수 CSS·CSS 변수만·Lucide·Pretendard.
- 절대 금기: 추측 수정 / 선제 추상화 / 에러 삼키기 / 테스트 없는 "끝났습니다" / Tailwind·MUI·임의 HEX
- 응답 형식: ① 요구사항 재확인 ② 구현 가능성·비용 ③ 가장 단순한 접근 ④ 위험 요소·롤백 ⑤ 테스트 계획(골든+엣지 2~3개)
EOF
      ;;
    qa)
      cat <<'EOF'
[강체크 지도] — QA + 보안·리스크
- 책임: 사용자 관점 검증(골든·엣지·회귀·디자인 토큰) + 보안·프라이버시·규제·윤리 리스크 진단 + *우회안*
- 절대 금기: "동작합니다"로 끝(증거 없음) / 코드 관점만 / 원인까지 추측 / "안 됩니다"로 끝(우회안 없음) / 강한 심리 레버 자동 약화
- 응답 형식: ① 검증 대상 ② 테스트 케이스(골든+엣지+회귀) ③ 결과+증거 ④ 리스크(🔴/🟡/🟢)+위치+악용 시나리오 ⑤ 우회안 ⑥ 배포 권고
EOF
      ;;
    marketer)
      cat <<'EOF'
[아뱅 지도] — 마케팅 + 심리 레버·수익
- 책임: 카피·채널·캠페인 + 통념 깨기 + 심리 레버 9개 + 수익 경로까지 끌고 가기
- 절대 금기: 베스트프랙티스 나열 / "있어 보이는" 카피(행동 유도 X) / 모든 채널 동시 / 심리 레버 명시 없음 / 수익 경로 없음 / 수치 없는 보고
- 응답 형식: 마케팅 요청 = ①타겟 ②레버 ③카피 A/B ④채널 ⑤측정 / 통념 깨기 = ①표면 ②숨은 진짜 ③레버 ④뒤집은 안 2~3개 ⑤수익 경로 ⑥선제방어+시스템화
- 끝에: "적용 원칙 #N / 당긴 레버 XX / 수익 경로 XX"
EOF
      ;;
    *)
      echo "알 수 없는 agent: $role" >&2
      exit 1
      ;;
  esac
}

# 4) 키워드 기반 *관련 디테일* 발췌 (전체 X)
print_keyword_excerpts() {
  local role="$1"
  shift
  local kws=("$@")

  # 디자인 안건이면 활성 스타일의 §10 컴포넌트·§15 토큰 중 키워드 매칭만
  if [[ "$role" == "designer" || "$role" == "developer" ]] && [[ -n "$ACTIVE_STYLE" && -f "$STYLE_FILE" ]]; then
    echo ""
    echo "[활성 스타일에서 키워드 매칭 발췌]"
    for kw in "${kws[@]}"; do
      grep -in -A 5 "$kw" "$STYLE_FILE" 2>/dev/null | head -20
    done | sort -u | head -40
  fi

  # 마케팅 안건이면 심리 레버 카탈로그에서 키워드 매칭
  if [[ "$role" == "marketer" && -f "$KNOW/abang/psychology.md" ]]; then
    echo ""
    echo "[심리 레버 카탈로그에서 키워드 매칭]"
    for kw in "${kws[@]}"; do
      grep -in -A 3 "$kw" "$KNOW/abang/psychology.md" 2>/dev/null | head -10
    done | sort -u | head -30
  fi

  # QA 안건이면 OWASP·이전 회귀 패턴 (있으면)
  if [[ "$role" == "qa" && -d "$KNOW/qa" ]]; then
    echo ""
    echo "[QA 지식 발췌]"
    for kw in "${kws[@]}"; do
      grep -rin -A 2 "$kw" "$KNOW/qa/" 2>/dev/null | head -10
    done | sort -u | head -30
  fi
}

# 5) 이전 강체크 지적 (있으면 — Ralph Wiggum Loop)
print_prior_qa_findings() {
  local f="$REPO/.ai-team/last-qa-findings.txt"
  if [[ -f "$f" ]]; then
    echo ""
    echo "[이전 강체크 지적 — 이번 호출에 반드시 반영]"
    cat "$f"
  fi
}

# 6) 마지막 테스트 출력 (있으면 — PostToolUse 훅이 적재)
print_last_test() {
  local f="$REPO/.ai-team/last-test-output.txt"
  if [[ -f "$f" ]]; then
    echo ""
    echo "[마지막 테스트 출력 — 마지막 30줄]"
    tail -30 "$f"
  fi
}

# 출력
echo "=== 강팀 에이전트 브리프 ($AGENT) ==="
echo "안건: $TOPIC"
[[ -n "$ACTIVE_STYLE" ]] && echo "$ACTIVE_STYLE"
echo ""
print_map "$AGENT"
print_keyword_excerpts "$AGENT" "${KEYWORDS[@]}"

# Ralph Wiggum Loop 입력 (강개발·강체크·강디 호출 시)
if [[ "$AGENT" == "developer" || "$AGENT" == "qa" || "$AGENT" == "designer" ]]; then
  print_prior_qa_findings
  print_last_test
fi

echo ""
echo "=== 끝. 위 지도·발췌만 보고 응답하라. 전체 카탈로그 Read는 *필요할 때만*. ==="
