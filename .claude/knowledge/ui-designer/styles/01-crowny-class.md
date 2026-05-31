# Crowny Class · 크라톡(CrowTalk) 디자인 시스템

> **적용 범위**: 강팀이 작업하는 *모든* 프로젝트의 **기본 디자인 시스템**.
> **오버라이드**: 프로젝트별로 다른 디자인이 필요하면 그 프로젝트의 `./.claude/knowledge/ui-designer/`에 별도 파일을 두면 그것이 우선.
> **PC·모바일 동일 스타일** (브레이크포인트로만 분기).
> 모든 색상·간격·폰트·컴포넌트가 **하나의 시스템**으로 통일되어 있으니 새 페이지 만들 때 이 문서를 그대로 따라주세요.

---

## 1. 브랜드 아이덴티티

- 서비스명(메인): **Crowny Class** (학원·강사·학생 통합 케어 프로그램)
- 서비스명(커뮤니티 서브브랜드): **크라톡 (CrowTalk)**
- 슬로건: "강사 강의 플랫폼"
- 핵심 컬러: 보라(Primary) → 분홍(Secondary) 그라데이션
- 분위기: 친근·밝음·생동감·정돈됨. 학습 공간이라 차분하되 지루하지 않게.

---

## 2. 색상 팔레트 (Color Tokens)

### 2.1 브랜드 컬러

| 토큰 | HEX | 용도 |
|---|---|---|
| `--primary` | `#8A38F5` | 메인 보라. 강조·CTA·링크·활성 상태 |
| `--primary-dark` | `#7030D4` | 호버·눌림 |
| `--primary-light` | `#A855F7` | 보조 강조·배지 |
| `--secondary` | `#D53A6B` | 분홍. 그라데이션 끝 색, 보조 강조 |
| `--secondary-light` | `#F472B6` | 부드러운 분홍 강조 |

**메인 그라데이션** (모든 주요 CTA·로고·배지 등에 사용):

```css
--gradient: linear-gradient(135deg, #8A38F5 0%, #D53A6B 100%);
```

`--primary-rgb`: `138, 56, 245` (rgba 효과·그림자용)

### 2.2 다크 영역 (사이드바·네비)

| 토큰 | HEX | 용도 |
|---|---|---|
| `--dark-bg` | `#1B1D21` | 사이드바 메인 배경 |
| `--dark-secondary` | `#1A1C22` | 사이드바 보조 |
| `--dark-tertiary` | `#2B2D35` | 다크 위 호버 |
| `--dark-border` | `#3D3D54` | 다크 영역 구분선 |

### 2.3 라이트 영역 (콘텐츠)

| 토큰 | HEX | 용도 |
|---|---|---|
| `--light-bg` | `#F3F4F6` | 페이지 배경 |
| `--light-card` | `#FFFFFF` | 카드·모달·시트 배경 |
| `--light-border` | `#E5E7EB` | 카드 테두리·구분선 |
| `--light-hover` | `#F9FAFB` | 라이트 위 호버 |

### 2.4 텍스트

| 토큰 | HEX | 용도 |
|---|---|---|
| `--text-primary` | `#FFFFFF` | 다크 배경 위 텍스트 |
| `--text-dark` | `#1F2937` | 라이트 배경 위 본문 |
| `--text-secondary` | `#9CA3AF` | 다크 위 보조 |
| `--text-muted` | `#6B7280` | 라이트 위 약함 (캡션·메타) |

### 2.5 상태(Semantic) 컬러 — 항상 한 쌍 (메인 + light 배경)

| 상태 | 메인 | 배경(연한) | 용도 |
|---|---|---|---|
| 성공 | `#22C55E` | `#DCFCE7` | 완료·정상 |
| 경고 | `#F59E0B` | `#FEF3C7` | 주의·확인 필요 |
| 에러 | `#EF4444` | `#FEE2E2` | 실패·삭제·차단 |
| 정보 | `#3B82F6` | `#DBEAFE` | 안내·중립 알림 |

### 2.6 분류용 컬러 (Chip · 카테고리 라벨)

본 시스템은 카테고리 칩 색을 **약 10%~12% opacity 배경 + 진한 텍스트** 패턴으로 사용:

| 분류 예 | 배경 | 텍스트 |
|---|---|---|
| 보라 (브랜드) | `rgba(138, 56, 245, 0.10)` | `#6B46C1` |
| 파랑 | `rgba(59, 130, 246, 0.10)` | `#1D4ED8` |
| 초록 | `rgba(34, 197, 94, 0.10)` | `#15803D` |
| 주황 | `rgba(245, 158, 11, 0.12)` | `#B45309` |
| 분홍 | `rgba(236, 72, 153, 0.10)` | `#BE185D` |
| 청록 | `rgba(14, 165, 233, 0.25)` | `#7DD3FC` (다크용) |

---

## 3. 타이포그래피

### 3.1 폰트 패밀리

- **본문/UI**: `'Pretendard Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`
  - CDN: `https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css`
- **로고/장식 텍스트**: `'Agbalumo', cursive`
  - CDN: `https://fonts.googleapis.com/css2?family=Agbalumo&display=swap`
  - 사용: 로고 "Crowny Class" / "크라톡" 만. 본문 X.

### 3.2 폰트 사이즈 토큰

> **최소 폰트 크기 = 16px (`--font-md`).** 캡션·뱃지·라벨도 *16px 아래로 내리지 않는다*. 가독성 우선. 마케팅 페이지 헤딩은 위로 자유.

| 토큰 | px | 용도 |
|---|---|---|
| `--font-xs` | 16px | 캡션·뱃지·아주 작은 라벨 (최소 폰트 — 더 내리지 않음) |
| `--font-sm` | 16px | 보조 텍스트·작은 버튼 |
| `--font-md` | 16px | **본문·일반 버튼 (기본)** |
| `--font-lg` | 18px | 사이드바 메뉴·강조 본문 |
| `--font-xl` | 20px | 카드 제목·작은 헤딩 |
| `--font-2xl` | 26px | 섹션 제목·H2 |
| `--font-3xl` | 32px | 페이지 H1 |

### 3.3 굵기

- 본문: `font-weight: 400~500`
- 강조: `600` (semibold)
- 헤딩: `700` (bold)
- 매우 강한 헤딩: `800` (extrabold) — 마케팅 페이지 한정

### 3.4 줄간격

- 본문: `line-height: 1.6`
- 헤딩: `line-height: 1.3`
- UI 라벨: `line-height: 1.4`

---

## 4. 간격 (Spacing)

8픽셀 그리드 기반:

| 토큰 | px | 용도 |
|---|---|---|
| `--spacing-xs` | 4px | 인라인 요소 사이 |
| `--spacing-sm` | 8px | 작은 요소 묶음 |
| `--spacing-md` | 16px | 카드 내부 패딩·블록 간격 |
| `--spacing-lg` | 24px | 섹션 간격·카드 사이 |
| `--spacing-xl` | 32px | 페이지 큰 섹션 |

> Tailwind 사용 시 동등치: `xs=1, sm=2, md=4, lg=6, xl=8`

---

## 5. 모서리 (Border Radius)

| 토큰 | px | 용도 |
|---|---|---|
| `--radius-sm` | 6px | 작은 인풋·태그·뱃지 |
| `--radius-md` | 10px | **버튼·인풋 기본** |
| `--radius-lg` | 12px | 카드 내부 요소·메뉴 항목 |
| `--radius-xl` | 16px | **카드·모달 기본** |
| `--radius-2xl` | 20px | 큰 카드·히어로 |
| `--radius-full` | 9999px | 아바타·원형 뱃지·필 칩 |

---

## 6. 그림자 (Shadow)

| 토큰 | 값 | 용도 |
|---|---|---|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | 보더 대체용 약한 띄움 |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.07)` | 카드 기본 |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.10)` | 떠 있는 카드·드롭다운 |
| `--shadow-xl` | `0 20px 25px rgba(0,0,0,0.15)` | 모달·중요 카드 |
| `--shadow-primary` | `0 4px 14px rgba(138, 56, 245, 0.35)` | 보라 강조 CTA 호버 |

---

## 7. 테두리 (Border)

- 굵기: `1px` 고정
- 라이트 위: `#E5E7EB` (`--light-border`)
- 다크 위: `#3D3D54` (`--dark-border`)
- 활성/포커스: `--primary` (보라)
- 에러 상태: `--error` (`#EF4444`)

---

## 8. 트랜지션

| 토큰 | 값 | 용도 |
|---|---|---|
| `--transition-fast` | `0.15s ease` | 호버·작은 상호작용 |
| `--transition-normal` | `0.2s ease` | 버튼·카드 변화 (기본) |
| `--transition-slow` | `0.3s ease` | 모달 등장·큰 레이아웃 변화 |

---

## 9. 레이아웃 / 반응형

### 9.1 핵심 치수

- 사이드바 너비: **260px** (`--sidebar-width`)
- 헤더 높이: **64px** (`--header-height`)
- 콘텐츠 최대 너비: **1200~1280px** 중앙 정렬
- 모달 기본 너비: **520px** (모바일에서는 `90vw` 이내)

### 9.2 브레이크포인트 (Tailwind 호환)

| 이름 | 폭 | 분기점 |
|---|---|---|
| Mobile | < 640px | 기본 |
| Tablet | ≥ 640px | `sm:` |
| Laptop | ≥ 1024px | `lg:` |
| Desktop | ≥ 1280px | `xl:` |

### 9.3 모바일·PC 동일 룰

- **색상·간격·폰트 토큰은 동일.** 모바일이라고 색·폰트를 바꾸지 않음.
- 모바일에선 사이드바를 **숨기고 하단 탭바**(safe-bottom 적용)로 대체.
- 모달은 모바일에서 바닥 시트 스타일로 (max-width: 100%, border-radius 상단만 둥글게).
- 카드 그리드: `grid-template-columns: repeat(auto-fill, minmax(280px, 1fr))` — 모바일 자동 1열.
- 터치 타겟 최소 **44×44px**.

---

## 10. 컴포넌트

### 10.1 버튼

```html
<!-- Primary (CTA) - 그라데이션 -->
<button class="btn btn-primary">저장</button>
```

- 배경: `linear-gradient(135deg, var(--primary), var(--secondary))`
- 텍스트: 흰색
- 패딩: `10px 20px`
- radius: `10px`
- font: 14px / weight 600
- 호버: `translateY(-2px)` + `box-shadow: 0 4px 12px rgba(138, 56, 245, 0.4)`

```html
<!-- Secondary - 회색 -->
<button class="btn btn-secondary">취소</button>
```

- 배경: `#F3F4F6` (호버 `#E5E7EB`)
- 텍스트: `#374151`

```html
<!-- Outline -->
<button class="btn btn-outline">더보기</button>
```

- 배경: transparent · 보더 `1px solid #D1D5DB`

**크기 변형**:
- 기본: 위와 같음
- `.btn-sm`: padding `6px 12px`, font 13px
- `.btn-icon`: 36×36 정사각형, radius 8px

### 10.2 카드

```html
<div class="card">
  <h3>제목</h3>
  <p>내용</p>
</div>
```

- 배경: `#FFFFFF`
- 보더: `1px solid #E5E7EB`
- radius: 16px (`--radius-xl`)
- 패딩: 16~20px
- 호버 가능 카드: `box-shadow: var(--shadow-md)` + `transform: translateY(-1px)`

### 10.3 입력 (Input / Select / Textarea)

- 배경: `#FFFFFF`
- 보더: `1px solid #E5E7EB`
- 포커스 보더: `var(--primary)` + `box-shadow: 0 0 0 3px rgba(138, 56, 245, 0.12)`
- radius: 10px
- 패딩: 10px 14px
- font: 14px

### 10.4 모달

- 배경 오버레이: `rgba(0, 0, 0, 0.5)` + `backdrop-filter: blur(4px)` (선택)
- 콘텐츠: 흰색 카드, radius **16px**, max-width 520px
- 패딩: 헤더 16~20px, 본문 16~20px, 푸터 16px (오른쪽 정렬 버튼)
- 모바일: 하단 시트 (`bottom: 0`, radius 상단만, 본문 스크롤)

### 10.5 칩(Tag / Badge)

```html
<span class="chip chip-purple">강좌</span>
```

- 패딩: `2px 8px` (작은) / `4px 12px` (큰)
- radius: full
- font: 11~12px / weight 600
- 색상: 위 "2.6 분류용 컬러" 패턴

### 10.6 토스트 / 알림

- 위치: 우측 하단, 16px 여백
- 배경: `#1B1D21` (다크) 또는 흰색 카드
- 자동 닫기: **2초**
- 좌측에 아이콘(성공/에러/정보) + 본문 + 닫기 버튼
- 진입: `slide-up + fade-in 0.2s`

### 10.7 탭바

- 라이트 위: 비활성 텍스트 `#6B7280`, 활성 텍스트 `--primary`, 활성 하단 `2px solid --primary`
- 다크 위: 비활성 `#9CA3AF`, 활성 `--primary-light`
- 패딩: `12px 20px`

### 10.8 네비게이션 (헤더/사이드바)

- 헤더: 흰색 배경, 높이 64px, `box-shadow: 0 1px 3px rgba(0,0,0,0.05)`
- 사이드바: 다크 `#1B1D21`, 너비 260px, 좌측 고정
- 메뉴 항목: 패딩 `12px 16px`, radius 12px, font 16px / weight 500
  - 호버: `rgba(255,255,255,0.06)`
  - 활성: `rgba(139, 92, 246, 0.15)`, 텍스트 `#A78BFA`

---

## 11. 아이콘

- 라이브러리: **Lucide Icons** (`https://unpkg.com/lucide@latest`)
- 사용 패턴: `<i data-lucide="아이콘이름"></i>` → `lucide.createIcons()` 호출
- 기본 크기: 16~20px
- 색상: 텍스트 색상 상속 (`currentColor`)

자주 쓰는 아이콘:
- 액션: `plus`, `pencil`, `trash-2`, `download`, `upload`, `link`, `copy`, `refresh-cw`, `x`, `check`
- 콘텐츠: `book-open`, `video`, `folder`, `file-text`, `paperclip`, `message-square`, `users`, `user`
- 시스템: `settings`, `bell`, `monitor`, `smartphone`, `globe`, `shield`

---

## 12. 로고 사용 규칙

- **메인 사이트(crownyclass.com)**: `images/logo.png` 또는 `logo.svg`, 텍스트는 Agbalumo 폰트로 "Crowny Class"
- **크라톡 사이트**: `images/crowtalk-logo.png` (주황 병아리), 너비 **36px**
- **OG 이미지** (SNS 공유용): 1200×630, 좌측 로고 + 중앙 "강사 강의 플랫폼" 슬로건, 보라 그라데이션 배경
- **Favicon**: 32×32 ico, **Apple touch**: 180×180 png

---

## 13. 작성 규칙 (Voice & Tone)

- **존댓말** 기본 (마케팅·공지·UI 모두)
- 짧고 명확하게 — 한 문장당 한 가지 정보
- 동작 표현은 동사로: "저장", "추가", "삭제" (명사형 X)
- 영문 약어는 가능하면 한글 보조: "OAuth (인증)"
- 이모지 절제 — 안내 박스 ⚠️/✅/ℹ️ 외에는 자제

---

## 14. 접근성

- 텍스트/배경 명도 대비 **WCAG AA** (본문 4.5:1, 큰 텍스트 3:1) 이상
- 인터랙티브 요소 포커스 링: `box-shadow: 0 0 0 3px rgba(138, 56, 245, 0.30)`
- 이미지 `alt` 텍스트 필수
- 키보드 탭 순서 자연스럽게
- Lucide 아이콘 단독 사용 시 `aria-label` 추가

---

## 15. 전체 CSS 변수 한 번에 (복붙용)

```css
:root {
  /* ===== 브랜드 ===== */
  --primary: #8A38F5;
  --primary-dark: #7030D4;
  --primary-light: #A855F7;
  --primary-rgb: 138, 56, 245;
  --secondary: #D53A6B;
  --secondary-light: #F472B6;
  --gradient: linear-gradient(135deg, #8A38F5 0%, #D53A6B 100%);

  /* ===== 다크 (사이드바) ===== */
  --dark-bg: #1B1D21;
  --dark-secondary: #1A1C22;
  --dark-tertiary: #2B2D35;
  --dark-border: #3D3D54;

  /* ===== 라이트 (콘텐츠) ===== */
  --light-bg: #F3F4F6;
  --light-card: #FFFFFF;
  --light-border: #E5E7EB;
  --light-hover: #F9FAFB;

  /* ===== 텍스트 ===== */
  --text-primary: #FFFFFF;
  --text-dark: #1F2937;
  --text-secondary: #9CA3AF;
  --text-muted: #6B7280;

  /* ===== 상태 ===== */
  --success: #22C55E;  --success-light: #DCFCE7;
  --warning: #F59E0B;  --warning-light: #FEF3C7;
  --error:   #EF4444;  --error-light:   #FEE2E2;
  --info:    #3B82F6;  --info-light:    #DBEAFE;

  /* ===== 모서리 ===== */
  --radius-sm: 6px;
  --radius-md: 10px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-2xl: 20px;
  --radius-full: 9999px;

  /* ===== 그림자 ===== */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-md: 0 4px 6px rgba(0,0,0,0.07);
  --shadow-lg: 0 10px 15px rgba(0,0,0,0.10);
  --shadow-xl: 0 20px 25px rgba(0,0,0,0.15);
  --shadow-primary: 0 4px 14px rgba(138, 56, 245, 0.35);

  /* ===== 간격 ===== */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;

  /* ===== 레이아웃 ===== */
  --sidebar-width: 260px;
  --header-height: 64px;

  /* ===== 폰트 크기 (최소 16px) ===== */
  --font-xs:  16px;
  --font-sm:  16px;
  --font-md:  16px;   /* 본문 기본 */
  --font-lg:  18px;
  --font-xl:  20px;
  --font-2xl: 26px;
  --font-3xl: 32px;

  /* ===== 트랜지션 ===== */
  --transition-fast:   0.15s ease;
  --transition-normal: 0.2s ease;
  --transition-slow:   0.3s ease;

  /* ===== 보더 ===== */
  --border-color: #E5E7EB;
  --border: 1px solid #E5E7EB;

  /* ===== 폰트 패밀리 ===== */
  --font-family-base:    'Pretendard Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-family-display: 'Agbalumo', cursive; /* 로고·장식 한정 */

  /* ===== 섹션별 공통 간격 ===== */
  --section-gap:       var(--spacing-xl);  /* 32px */
  --section-padding-y: var(--spacing-xl);
  --section-padding-x: var(--spacing-lg);  /* 24px */

  /* ===== 컨텐츠별 공통 간격 ===== */
  --content-gap:    var(--spacing-md);     /* 16px */
  --content-padding: var(--spacing-md);
  --card-padding:    var(--spacing-md);    /* 카드 내부 16~20px */

  /* ===== 콘텐츠 최대 폭 ===== */
  --content-max-width: 1280px;
}

body {
  font-family: var(--font-family-base);
  font-size: var(--font-md);
  line-height: 1.6;
  color: var(--text-dark);
  background: var(--light-bg);
}
```

---

## 16. 신규 페이지/컴포넌트 만들 때 체크리스트

만들 때마다 이 항목 다 만족하는지 확인:

- [ ] 색상은 **위 토큰 안에서만** 사용 (임의 HEX X)
- [ ] 폰트는 **Pretendard** (로고만 Agbalumo)
- [ ] 버튼·카드·인풋의 `border-radius` 가 위 정의대로
- [ ] CTA는 **Primary 그라데이션** + 호버 시 살짝 떠오름
- [ ] 보조 액션은 회색 Secondary 버튼
- [ ] 위험(삭제·종료) 버튼은 빨간 글자·연한 빨강 배경
- [ ] 카드 그림자는 `--shadow-md`, 모달은 `--shadow-xl`
- [ ] 모바일에서 사이드바 → 하단 탭바, 모달 → 바닥 시트
- [ ] 터치 타겟 44px 이상
- [ ] 아이콘은 Lucide
- [ ] 한국어, 존댓말, 명확한 동사 라벨
- [ ] alt 텍스트, 포커스 링, 명도 대비 OK

---

## 17. 디자인 시작 시 프롬프트 예시 (다른 AI 에게)

> "Crowny Class 디자인 시스템(첨부)을 따라 [페이지/컴포넌트명] 을 만들어줘.
> - 메인 컬러: 보라(#8A38F5) → 분홍(#D53A6B) 그라데이션
> - 폰트: Pretendard Variable
> - 카드 radius 16px, 버튼 radius 10px
> - PC·모바일 반응형, 같은 색·폰트 사용
> - 아이콘 Lucide, 한국어 존댓말
> - 첨부한 CSS 변수와 컴포넌트 가이드 외 임의 색상 사용 금지"

---

## 18. 프로젝트별 테마 컬러 (강디 기본 제안 룰)

이 문서의 **`--primary` / `--secondary`** (보라→분홍) 는 **Crowny Class 플랫폼 자체의 기본 컬러**다.
강팀이 *다른 프로젝트*를 만들 때는 그 *주제에 맞는 테마 컬러*를 강디가 **먼저 제안**한다.

### 제안 규칙

1. **새 프로젝트 시작 회의에서 강디가 가장 먼저 한 턴** — 프로젝트 주제·타겟 사용자·경쟁군을 보고 *Primary + Secondary 한 쌍*을 제안. 그라데이션 각도(135deg)·구조·토큰 이름은 그대로 유지, **HEX 값만** 갈아끼움.

2. **주제별 기본 추천** (참고):

| 주제 | Primary 후보 | Secondary 후보 | 이유 |
|---|---|---|---|
| 식음료·F&B | `#FF6B35` (오렌지) | `#FFB627` (옐로) | 식욕·따뜻함 |
| 핀테크·금융 | `#1E40AF` (네이비) | `#0891B2` (시안) | 신뢰·정직 |
| 헬스·피트니스 | `#10B981` (그린) | `#84CC16` (라임) | 활력·자연 |
| 명상·웰니스 | `#7C3AED` (라벤더) | `#EC4899` (소프트핑크) | 안정·집중 |
| 게임·엔터 | `#EF4444` (레드) | `#FACC15` (옐로) | 흥분·도파민 |
| 키즈·교육 | `#3B82F6` (블루) | `#F59E0B` (앰버) | 학습·친근 |
| 럭셔리·뷰티 | `#1E1B4B` (딥네이비) | `#D4AF37` (골드) | 고급·정제 |
| 미정·범용 | `#8A38F5` (Crowny 보라) | `#D53A6B` (Crowny 분홍) | **기본** |

3. **테마 적용 방식** — 프로젝트의 *로컬* `styles/tokens.css` 에서 **브랜드 컬러만** 오버라이드. 나머지 토큰(radius, shadow, spacing, font scale)은 그대로:

```css
:root {
  /* 이 프로젝트의 테마 (예: F&B) */
  --primary: #FF6B35;
  --primary-dark: #E04E1B;
  --primary-light: #FF8F66;
  --primary-rgb: 255, 107, 53;
  --secondary: #FFB627;
  --secondary-light: #FFD180;
  --gradient: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
  --shadow-primary: 0 4px 14px rgba(var(--primary-rgb), 0.35);
}
```

4. **CEO 가 "기본색상으로" 라고 하면 → 즉시 Crowny Class 기본 컬러로 롤백**:

```css
:root {
  --primary: #8A38F5;
  --primary-dark: #7030D4;
  --primary-light: #A855F7;
  --primary-rgb: 138, 56, 245;
  --secondary: #D53A6B;
  --secondary-light: #F472B6;
  --gradient: linear-gradient(135deg, #8A38F5 0%, #D53A6B 100%);
  --shadow-primary: 0 4px 14px rgba(138, 56, 245, 0.35);
}
```

5. **테마 컬러도 시스템 규칙은 깨지 않는다** — 그라데이션 각도 135deg, 톤 한 쌍(밝은·짙은 대비), 명도 대비 WCAG AA, radius·shadow·spacing 토큰 유지. *임의 색을 더 추가*하는 게 아니라 *기본 두 색만 갈아끼움*.

### 강디 응답 패턴 (새 프로젝트 첫 회의)

- "이 프로젝트는 [주제]이라 [Primary HEX] / [Secondary HEX] 를 제안합니다 — 이유: [한 줄]"
- 미리보기 SVG 한 컷 (그라데이션 CTA + 카드)
- "기본색상으로 하실 거면 알려주세요 — 즉시 Crowny 보라/분홍으로 롤백합니다."

---

## 19. 코드 적용 컨벤션 (강개발 룰)

CEO가 박은 절대 룰. 강개발이 디자인 시스템을 코드에 옮길 때:

1. **CSS 라이브러리·UI 프레임워크 금지** — Tailwind / Bootstrap / Material UI / styled-components / Chakra 등 도입 금지. **순수 CSS만**.
2. **모든 디자인 값은 `:root`의 CSS 변수로** — §15의 변수 묶음을 *한 파일*에 두고, 모든 페이지에서 `var(--...)`로 참조. 사용자가 *그 한 파일만 수정*해도 전 페이지에 반영되어야 한다.
3. **임의 HEX / 임의 px / 임의 폰트 금지** — 정말 새 값이 필요하면 §15에 *변수 먼저 추가*하고 사용.
4. **아이콘 = Lucide만**, **폰트 = Pretendard + Agbalumo만**. 추가 라이브러리 도입은 *사용자 승인* 필요.
5. **변수 네이밍 일관성** — 신규 토큰 추가 시 `--{분류}-{단계|역할}` 패턴 유지 (`--spacing-2xl`, `--font-4xl`, `--primary-50` 등).
6. **개별 간격은 변수 늘리지 말고 기존 토큰으로** — 한 섹션만 다른 간격이 필요하면 그 섹션에 `--spacing-lg` 등 *기존 토큰*을 인라인으로. 변수는 *전역 재사용 값*에만.

---

## 20. 디자이너 에이전트가 이 문서를 사용하는 방법

- **새 화면을 디자인할 때**: 위 색상·간격·컴포넌트 명세에서 *기존 토큰을 먼저* 사용. 새 값이 필요하면 *왜* 새로 정의해야 하는지 한 줄로 근거 제시.
- **프로젝트별 오버라이드 확인**: `./.claude/knowledge/ui-designer/design-system.md`(프로젝트 로컬)가 있으면 그것이 우선. 없으면 이 글로벌 문서 사용.
- **모바일이 아닌 프로젝트**: 사이드바·헤더 구조는 그대로, 모바일 한정 컴포넌트(하단 탭바, 바닥 시트)는 데스크탑 변형(좌측 사이드바, 중앙 모달)으로 치환.
- **요청자가 "다른 디자인"이라고 명시하면**: 이 문서를 *참고용으로만* 두고 별도 안 제안.
