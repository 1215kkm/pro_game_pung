<!-- 강팀 트리거 룰 (BEGIN) — install-global.sh 가 ~/.claude/CLAUDE.md 에 자동 삽입 -->
## 강팀 불러오기 트리거

사용자가 다음 중 하나를 말하면, 메인 클로드는 답변 시늉 대신 *바로* `pull-team.sh` 를 실행한다:

- "강팀 불러와" / "강팀 가져와" / "강팀 박아"
- "Ai_Team에서 강팀 ..." / "1215kkm/Ai_Team에서 ..."
- `/강팀불러오기`

```bash
if [[ -f scripts/pull-team.sh ]]; then
  bash scripts/pull-team.sh
elif [[ -f ~/.claude/bin/pull-team.sh ]]; then
  bash ~/.claude/bin/pull-team.sh
else
  curl -fsSL https://raw.githubusercontent.com/1215kkm/Ai_Team/main/scripts/pull-team.sh | bash
fi
```

설치 후 사용자에게 한 줄만 보고: "강팀 도착 — `/회의시작` 가능".

## 강팀 업데이트 (다른 레포 → 강팀 본체로 학습 PR)

사용자가 "강팀에 올려", "강팀 업데이트", "이 패턴 강팀에 박아", `/강팀업데이트`
라고 하면 → `scripts/promote-to-team.sh` (또는 `~/.claude/bin/promote-to-team.sh`) 실행.
PR URL 한 줄만 보고. *자동 머지 금지* — CEO 가 PR 페이지에서 직접.

## 디자인 스타일 전환 트리거

사용자가 "디자인 스타일 N번 적용해", `/디자인스타일 N` 이라고 하면 →
`designer` Agent 호출 (메인 클로드 시늉 금지). 강디가 `active.txt` 와
`styles/tokens.css` 를 한 트랜잭션에 갱신.

## ⛔ 강팀 발언 규칙 (절대)

`.claude/agents/` 가 있는 레포에서, 강팀 닉네임(강팀장·강디·강개발·강체크·아뱅)으로
발언해야 할 때 메인 클로드가 시늉하지 말고 *반드시* `Agent` 툴로 해당
서브에이전트(`pm`, `designer`, `developer`, `qa`, `marketer`)를 호출한다.

**한 AI 가 두 역할을 동시에 하면 회의록·글로벌 브레인이 오염되고 각 에이전트의 학습이 멈춘다.**

예외: CEO 와의 시스템·운영 대화 (강팀 셋업, 텔레그램 디버깅 등) 는 메인 클로드가 직접 답해도 됨.

## 보고서 톤 (모든 보고서 공통)

- 실무자 단어 그대로 — "CTR", "ROAS", "픽셀". 단 *처음 등장 시* 괄호로 한 줄 풀이.
- 숫자엔 *기준·맥락* 함께: "CPC ₩300 (한국 인스타 평균 ₩500~800 대비 낮음)".
- 너무 짧게 요약해 *왜* 가 빠지지 않게. 결정·근거·담당 셋트.
- "검토 필요", "고민 중" 같은 *허공 단어* 금지.
<!-- 강팀 트리거 룰 (END) -->
