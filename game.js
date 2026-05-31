/* 튕기기 — 30판 정복 + 무한 마스터모드 + 상점/스킨/배경/막대기.
   순수 JS + Canvas + Web Audio. 프레임워크/외부 라이브러리 0.
   상태: menu → playing → (paused / checkpoint) → gameover / win.

   난이도 레버: 속도(왕복시간 T) + 공 개수 + 공 크기. 받는 영역(존)은 넓게 고정.
   대칭 발사: 판마다 g·v 를 계산해 올라감/내려옴 시간이 같다(부드러움).
   잘 튕긴 공은 회색→흰색으로 익다가 터지며 코인을 준다. 코인으로 상점에서
   스킨·배경·막대기를 산다. 막대기는 떨어지는 공을 자동으로 받아주는 패들.

   색 상수: 캔버스 셰이딩·파티클·스킨·배경 색은 tokens.css 가 아니라
   여기 JS 상수로 둔다(스펙·훅 규칙). 브랜드 색만 CSS 변수에서 읽어 온다. */
'use strict';

(function () {
  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);
  const canvas = $('game');
  const ctx = canvas.getContext('2d');
  const elHud = $('hud');
  const elHudStage = $('hudStage');
  const elHudOf = $('hudOf');
  const elHudCombo = $('hudCombo');
  const elHudBest = $('hudBest');
  const elHudLives = $('hudLives');
  const elMenu = $('menu');
  const elMenuBest = $('menuBest');
  const elStart = $('startBtn');
  const elBlindToggle = $('blindToggle');
  const elMuteToggle = $('muteToggle');
  const elGameover = $('gameover');
  const elNewRecord = $('newRecordBadge');
  const elFinalScore = $('finalScore');
  const elGoBest = $('goBest');
  const elRetry = $('retryBtn');
  const elShare = $('shareBtn');
  const elMenuBtn = $('menuBtn');
  const elBlindBanner = $('blindBanner');
  const elWin = $('winScreen');
  const elWinCombo = $('winCombo');
  const elWinRetry = $('winRetryBtn');
  const elWinShare = $('winShareBtn');
  const elWinMenu = $('winMenuBtn');
  const elWinMaster = $('winMasterBtn');
  // 상점 / 일시정지 / 체크포인트 / 스틱
  const elShopBtn = $('shopBtn');
  const elShop = $('shop');
  const elShopCoins = $('shopCoins');
  const elTabBalls = $('tabBalls');
  const elTabBgs = $('tabBgs');
  const elTabItems = $('tabItems');
  const elGridBalls = $('gridBalls');
  const elGridBgs = $('gridBgs');
  const elGridItems = $('gridItems');
  const elShopBack = $('shopBack');
  const elPhotoInput = $('photoInput');
  const elPauseBtn = $('pauseBtn');
  const elPause = $('pause');
  const elPauseResume = $('pauseResume');
  const elPauseShopBtn = $('pauseShopBtn');
  const elPauseMenu = $('pauseMenu');
  const elCheckpoint = $('checkpoint');
  const elCpTitle = $('cpTitle');
  const elCpContinue = $('cpContinue');
  const elCpStop = $('cpStop');
  const elStickTray = $('stickTray');
  const elStickMerge = $('stickMerge');

  // ---------- 브랜드 색 (CSS 변수에서 읽음) ----------
  const cssVar = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const COL = {
    primary: cssVar('--primary') || '#EF4444',
    secondary: cssVar('--secondary') || '#FACC15',
    refractFrom: cssVar('--ball-refract-from') || '#8A38F5',
    refractTo: cssVar('--ball-refract-to') || '#D53A6B',
    bg: cssVar('--canvas-bg') || '#1B1D21',
  };
  // 부수 색(셰이딩/파티클/스킨/배경) — 스펙상 JS 상수로 둠
  const SHADE = {
    glassEdge: 'rgba(255,255,255,0.85)',
    glassFaint: 'rgba(255,255,255,0.10)',
    zoneFill: 'rgba(239,68,68,0.13)',
    zoneEdge: 'rgba(250,204,21,0.45)',
    zenDim: 'rgba(10,10,16,0.62)',
    shard: '#BFE3FF',
    ripeGrey: '#9A9A9A',
    coin: '#FFD24A',
    stick: '#C9A66B',
    stickDark: '#8A6D3B',
  };

  // ---------- 상태 ----------
  const STATE = { MENU: 0, PLAYING: 1, GAMEOVER: 2, WIN: 3, PAUSED: 4, CHECKPOINT: 5 };
  let state = STATE.MENU;

  let W = 0, H = 0, DPR = 1;
  const MAX_DT = 1 / 30;          // 백그라운드 복귀 dt 폭주 방지

  // ----- 30판 구조 + 무한 마스터모드 -----
  const TOTAL_STAGES = 30;
  const LIVES_START = 3, LIVES_MAX = 5; // 하트(생명)

  // ----- 난이도: 속도 곡선 (대칭, 고정 정점, 가변 중력) -----
  const RISE_FRAC = 0.72;         // 정점 높이 = 화면의 72%
  const T_START = 3.0;            // 1판 왕복시간(초) — 아기도 할 만큼 느림
  const T_END = 0.5;              // 30판 왕복시간(초)
  const T_CURVE = 1.7;            // p^1.7 → 중반까지 느림, 후반 급강
  const T_MASTER_MIN = 0.28;      // 마스터모드 왕복시간 하한
  let gNow = 600, vNow = 800;     // 현재 판의 중력·발사속도(recomputeKinematics 갱신)
  let gUp = 600, gDown = 600;     // 마스터모드 상승/하강 분리 중력
  function recomputeKinematics() {
    const h = RISE_FRAC * H;
    let T;
    if (masterMode) {
      // 마스터모드: T 를 0.5 미만으로 더 줄임(판이 오를수록), 하한 T_MASTER_MIN
      const over = Math.max(0, stage - TOTAL_STAGES);
      T = Math.max(T_MASTER_MIN, T_END - over * 0.012);
    } else {
      const p = Math.max(0, Math.min(1, (stage - 1) / (TOTAL_STAGES - 1)));
      T = T_START + (T_END - T_START) * Math.pow(p, T_CURVE);
    }
    gNow = 8 * h / (T * T);
    vNow = 4 * h / T;
    if (masterMode) {
      // 상승은 느슨하게, 하강은 매섭게(비대칭 허용 — 30판까지는 금지)
      gUp = gNow * 0.8;
      gDown = gNow * 1.6;
    } else {
      gUp = gNow; gDown = gNow;
    }
  }

  // 판 → 공 개수: 1~5판=1, 6~10판=2, …, 30판=6.
  function ballsForStage(stage) {
    return Math.floor((Math.max(1, stage) - 1) / 5) + 1;
  }

  // 판 → 요구 튕김 횟수: 1판 5회 → 30판 20회, 마스터(31+) 상한 30회까지 증가.
  function catchesForStage(stage) {
    const p = Math.max(0, Math.min(1, (stage - 1) / (TOTAL_STAGES - 1)));
    return Math.min(30, Math.round(5 + p * 15));
  }

  let best = 1;                   // 최고 도달 판수
  let muted = false;
  let blindMode = false;

  // 게임 변수
  let stage, catchesInStage, combo, maxCombo, slowFactor, slowTimer, zenActive, zenScored;
  let masterMode = false;
  let lives;
  let flashAlpha = 0;
  let shake = 0;
  let lastTime = 0;
  let running = false;
  let winParticles = [];
  // 토스트(비차단)
  let toastText = '', toastTimer = 0;
  // 코인 획득 카운터(5개째 축하용)
  let popsThisRun = 0;

  // ----- 멀티볼 -----
  let ballRadius = 30;
  let balls = [];
  let nextBallId = 1;
  function makeBall(x, y, vx, vy) {
    return {
      id: nextBallId++,
      x: x, y: y, vx: vx, vy: vy, r: ballRadius,
      sx: 1, sy: 1,
      spinPhase: 0,
      trail: [],
      spawnY: y,
      entering: false,
      pops: 0,                    // 이 공을 튕긴 횟수 → 익음(ripeness)
    };
  }
  let particles = [];
  const POP_AT = 8;               // 이만큼 튕기면 터짐

  // 펜타토닉 (메이저)
  const PENTA = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99, 880.0];
  const COL_FONT = "'Pretendard Variable', -apple-system, sans-serif";

  // ---------- 색 유틸 ----------
  function hexToRgba(hex, a) {
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  function hexToRgb(hex) {
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  // ================= 스토어 모듈 (localStorage) =================
  const STORE_DEFAULT = {
    owned: { skins: ['default'], bgs: ['default'], features: [] },
    equipped: { skin: 'default', bg: 'default' },
    sticks: 0,
    photo: null,
  };
  let store = JSON.parse(JSON.stringify(STORE_DEFAULT));
  let coins = 0;

  try { best = parseInt(localStorage.getItem('pung_best_stage') || '1', 10) || 1; } catch (e) { best = 1; }
  if (best < 1) best = 1;
  function saveBest() { try { localStorage.setItem('pung_best_stage', String(best)); } catch (e) { /* 프라이빗 모드 */ } }

  function loadStore() {
    try { coins = parseInt(localStorage.getItem('pung_coins') || '0', 10) || 0; } catch (e) { coins = 0; }
    if (coins < 0) coins = 0;
    try {
      const raw = localStorage.getItem('pung_store');
      if (raw) {
        const parsed = JSON.parse(raw);
        store = {
          owned: {
            skins: (parsed.owned && Array.isArray(parsed.owned.skins)) ? parsed.owned.skins : ['default'],
            bgs: (parsed.owned && Array.isArray(parsed.owned.bgs)) ? parsed.owned.bgs : ['default'],
            features: (parsed.owned && Array.isArray(parsed.owned.features)) ? parsed.owned.features : [],
          },
          equipped: {
            skin: (parsed.equipped && parsed.equipped.skin) || 'default',
            bg: (parsed.equipped && parsed.equipped.bg) || 'default',
          },
          sticks: parsed.sticks | 0,
          photo: parsed.photo || null,
        };
        if (store.owned.skins.indexOf('default') < 0) store.owned.skins.push('default');
        if (store.owned.bgs.indexOf('default') < 0) store.owned.bgs.push('default');
      }
    } catch (e) { store = JSON.parse(JSON.stringify(STORE_DEFAULT)); }
  }
  function saveStore() {
    try { localStorage.setItem('pung_coins', String(coins)); } catch (e) { /* 무시 */ }
    try { localStorage.setItem('pung_store', JSON.stringify(store)); }
    catch (e) {
      // quota 초과: 사진 제거 후 1회 재시도
      try { store.photo = null; localStorage.setItem('pung_store', JSON.stringify(store)); }
      catch (e2) { /* 그래도 실패하면 포기(메모리에는 유지) */ }
    }
  }
  function getCoins() { return coins; }
  function addCoins(n) { coins += n; if (coins < 0) coins = 0; saveStore(); }
  function spend(n) { if (coins < n) return false; coins -= n; saveStore(); return true; }
  function isOwned(cat, id) {
    const arr = store.owned[cat];
    return !!(arr && arr.indexOf(id) >= 0);
  }
  function buy(cat, id, price) {
    if (isOwned(cat, id)) return true;
    if (!spend(price)) return false;
    store.owned[cat].push(id);
    saveStore();
    return true;
  }
  function equip(cat, id) {
    // cat: 'skin' | 'bg' (단수). owned 키는 복수형.
    const ownKey = cat === 'skin' ? 'skins' : 'bgs';
    if (!isOwned(ownKey, id)) return false;
    store.equipped[cat] = id;
    saveStore();
    return true;
  }
  loadStore();

  // ================= 공 스킨 (정밀 코드 드로잉) =================
  // 각 draw(ctx,x,y,r,phase) — 원점(0,0) 기준이 아니라 (x,y) 중심. squash 는 호출부에서 적용.
  const SKIN_COL = {
    soccerWhite: '#F4F4F4', soccerBlack: '#1A1A1A',
    basketOrange: '#E0792B', basketLine: '#23150A',
    jupTan: '#D9B48F', jupBand: '#A06A3E', jupSpot: '#B23A2E',
    saturnBody: '#E8D9A8', saturnRing: '#C9A06B', saturnRing2: '#8A6D3B',
    pengBlack: '#2A2A30', pengWhite: '#F5F5F5', pengBeak: '#F2A53A', pengEye: '#16161A',
  };

  function drawDefaultSkin(c, x, y, r, phase) {
    // 보라→분홍 굴절 공
    const grad = c.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
    grad.addColorStop(0, 'rgba(255,255,255,0.92)');
    grad.addColorStop(0.35, hexToRgba(COL.refractFrom, 0.7));
    grad.addColorStop(0.75, hexToRgba(COL.refractTo, 0.6));
    grad.addColorStop(1, hexToRgba(COL.refractTo, 0.22));
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = grad; c.fill();
    // 내부 굴절 코어(회전)
    const core = c.createLinearGradient(x - r * 0.4, y - r * 0.4, x + r * 0.4, y + r * 0.5);
    core.addColorStop(0, hexToRgba(COL.refractFrom, 0.5));
    core.addColorStop(1, hexToRgba(COL.refractTo, 0.4));
    c.beginPath(); c.arc(x + Math.cos(phase) * r * 0.15, y + r * 0.12, r * 0.5, 0, Math.PI * 2);
    c.fillStyle = core; c.fill();
  }

  function clipCircle(c, x, y, r) { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.clip(); }

  function drawSoccerSkin(c, x, y, r, phase) {
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = SKIN_COL.soccerWhite; c.fill();
    c.save(); clipCircle(c, x, y, r);
    // 중앙 오각형(검정)
    c.fillStyle = SKIN_COL.soccerBlack;
    const drawPenta = (cx, cy, pr, rot) => {
      c.beginPath();
      for (let i = 0; i < 5; i++) {
        const a = rot + i * Math.PI * 2 / 5 - Math.PI / 2;
        const px = cx + Math.cos(a) * pr, py = cy + Math.sin(a) * pr;
        if (i === 0) c.moveTo(px, py); else c.lineTo(px, py);
      }
      c.closePath(); c.fill();
    };
    drawPenta(x + Math.sin(phase) * r * 0.05, y, r * 0.34, phase * 0.3);
    // 주변 오각형 5개(살짝)
    for (let i = 0; i < 5; i++) {
      const a = phase * 0.3 + i * Math.PI * 2 / 5 - Math.PI / 2;
      const cx = x + Math.cos(a) * r * 0.82, cy = y + Math.sin(a) * r * 0.82;
      drawPenta(cx, cy, r * 0.26, a);
    }
    // 연결선
    c.strokeStyle = SKIN_COL.soccerBlack; c.lineWidth = Math.max(1.2, r * 0.05);
    for (let i = 0; i < 5; i++) {
      const a = phase * 0.3 + i * Math.PI * 2 / 5 - Math.PI / 2;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); c.stroke();
    }
    c.restore();
  }

  function drawBasketSkin(c, x, y, r, phase) {
    const grad = c.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    grad.addColorStop(0, '#F09A4E'); grad.addColorStop(1, SKIN_COL.basketOrange);
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = grad; c.fill();
    c.save(); clipCircle(c, x, y, r);
    c.strokeStyle = SKIN_COL.basketLine; c.lineWidth = Math.max(1.5, r * 0.07);
    // 세로 중앙선 + 가로 중앙선
    c.beginPath(); c.moveTo(x, y - r); c.lineTo(x, y + r); c.stroke();
    c.beginPath(); c.moveTo(x - r, y); c.lineTo(x + r, y); c.stroke();
    // 곡선 심 2개(양옆)
    c.beginPath(); c.ellipse(x - r * 0.9, y, r * 0.55, r, 0, -Math.PI / 2.2, Math.PI / 2.2); c.stroke();
    c.beginPath(); c.ellipse(x + r * 0.9, y, r * 0.55, r, 0, Math.PI - Math.PI / 2.2, Math.PI + Math.PI / 2.2); c.stroke();
    c.restore();
  }

  function drawJupiterSkin(c, x, y, r, phase) {
    c.save(); clipCircle(c, x, y, r);
    // 가로 줄무늬 그라데이션
    const g = c.createLinearGradient(0, y - r, 0, y + r);
    g.addColorStop(0, SKIN_COL.jupTan); g.addColorStop(0.2, SKIN_COL.jupBand);
    g.addColorStop(0.4, SKIN_COL.jupTan); g.addColorStop(0.6, SKIN_COL.jupBand);
    g.addColorStop(0.8, SKIN_COL.jupTan); g.addColorStop(1, SKIN_COL.jupBand);
    c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
    // 줄무늬 강조(가는 띠)
    c.fillStyle = 'rgba(120,80,50,0.35)';
    for (let i = -3; i <= 3; i++) {
      const yy = y + i * r * 0.28 + Math.sin(phase + i) * r * 0.02;
      c.fillRect(x - r, yy, r * 2, r * 0.08);
    }
    // 대적점
    c.beginPath();
    c.ellipse(x + r * 0.35, y + r * 0.22, r * 0.28, r * 0.18, 0, 0, Math.PI * 2);
    c.fillStyle = SKIN_COL.jupSpot; c.fill();
    c.restore();
  }

  function drawSaturnSkin(c, x, y, r, phase) {
    const body = r * 0.7;
    // 고리(뒤쪽 절반)
    c.save();
    c.translate(x, y); c.rotate(-0.45);
    c.strokeStyle = SKIN_COL.saturnRing; c.lineWidth = Math.max(2, r * 0.13);
    c.beginPath(); c.ellipse(0, 0, r * 1.05, r * 0.4, 0, Math.PI, Math.PI * 2); c.stroke();
    c.strokeStyle = SKIN_COL.saturnRing2; c.lineWidth = Math.max(1, r * 0.05);
    c.beginPath(); c.ellipse(0, 0, r * 1.05, r * 0.4, 0, Math.PI, Math.PI * 2); c.stroke();
    c.restore();
    // 본체
    const g = c.createRadialGradient(x - body * 0.3, y - body * 0.3, body * 0.1, x, y, body);
    g.addColorStop(0, '#F6ECC8'); g.addColorStop(1, SKIN_COL.saturnBody);
    c.beginPath(); c.arc(x, y, body, 0, Math.PI * 2); c.fillStyle = g; c.fill();
    // 본체 가로 띠
    c.save(); clipCircle(c, x, y, body);
    c.strokeStyle = 'rgba(160,130,70,0.4)'; c.lineWidth = Math.max(1, r * 0.05);
    for (let i = -2; i <= 2; i++) {
      c.beginPath(); c.moveTo(x - body, y + i * body * 0.4); c.lineTo(x + body, y + i * body * 0.4); c.stroke();
    }
    c.restore();
    // 고리(앞쪽 절반)
    c.save();
    c.translate(x, y); c.rotate(-0.45);
    c.strokeStyle = SKIN_COL.saturnRing; c.lineWidth = Math.max(2, r * 0.13);
    c.beginPath(); c.ellipse(0, 0, r * 1.05, r * 0.4, 0, 0, Math.PI); c.stroke();
    c.restore();
  }

  function drawPenguinSkin(c, x, y, r, phase) {
    // 머리/몸 검정
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = SKIN_COL.pengBlack; c.fill();
    c.save(); clipCircle(c, x, y, r);
    // 흰 배(아래 큰 타원)
    c.beginPath(); c.ellipse(x, y + r * 0.18, r * 0.62, r * 0.78, 0, 0, Math.PI * 2);
    c.fillStyle = SKIN_COL.pengWhite; c.fill();
    // 흰 얼굴(눈 주변)
    c.beginPath(); c.ellipse(x, y - r * 0.28, r * 0.5, r * 0.36, 0, 0, Math.PI * 2);
    c.fillStyle = SKIN_COL.pengWhite; c.fill();
    c.restore();
    // 눈 2개
    const ex = r * 0.22, ey = -r * 0.32, es = r * 0.12;
    c.fillStyle = SKIN_COL.pengEye;
    c.beginPath(); c.arc(x - ex, y + ey, es, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(x + ex, y + ey, es, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#FFFFFF';
    c.beginPath(); c.arc(x - ex + es * 0.3, y + ey - es * 0.3, es * 0.4, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.arc(x + ex + es * 0.3, y + ey - es * 0.3, es * 0.4, 0, Math.PI * 2); c.fill();
    // 부리(삼각형)
    c.fillStyle = SKIN_COL.pengBeak;
    c.beginPath();
    c.moveTo(x - r * 0.16, y - r * 0.05);
    c.lineTo(x + r * 0.16, y - r * 0.05);
    c.lineTo(x, y + r * 0.16);
    c.closePath(); c.fill();
  }

  const SKINS = [
    { id: 'default', name: '기본 굴절공', price: 0, draw: drawDefaultSkin },
    { id: 'soccer', name: '축구공', price: 30, draw: drawSoccerSkin },
    { id: 'basket', name: '농구공', price: 30, draw: drawBasketSkin },
    { id: 'jupiter', name: '목성', price: 60, draw: drawJupiterSkin },
    { id: 'saturn', name: '토성', price: 80, draw: drawSaturnSkin },
    { id: 'penguin', name: '펭귄', price: 100, draw: drawPenguinSkin },
  ];
  function skinById(id) { return SKINS.find((s) => s.id === id) || SKINS[0]; }

  // ================= 배경 (코드 3종 + 사진) =================
  let photoImg = null;            // 사진 배경 캐시
  function loadPhotoImage() {
    photoImg = null;
    if (!store.photo) return;
    const img = new Image();
    img.onload = () => { photoImg = img; };
    img.src = store.photo;
  }
  loadPhotoImage();

  function bgDefault(c) { c.fillStyle = COL.bg; c.fillRect(-20, -20, W + 40, H + 40); }
  function bgSunset(c) {
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#2A1B3D'); g.addColorStop(0.5, '#B5446E'); g.addColorStop(1, '#F2994A');
    c.fillStyle = g; c.fillRect(-20, -20, W + 40, H + 40);
    // 태양
    c.beginPath(); c.arc(W * 0.5, H * 0.62, Math.min(W, H) * 0.16, 0, Math.PI * 2);
    c.fillStyle = 'rgba(255,220,150,0.55)'; c.fill();
  }
  function bgSpace(c) {
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#05060F'); g.addColorStop(1, '#15203A');
    c.fillStyle = g; c.fillRect(-20, -20, W + 40, H + 40);
    // 별(고정 시드처럼 보이게 결정적 배치)
    c.fillStyle = 'rgba(255,255,255,0.8)';
    for (let i = 0; i < 60; i++) {
      const sx = (i * 73 % 100) / 100 * W;
      const sy = (i * 137 % 100) / 100 * H;
      const sz = (i % 3) * 0.6 + 0.5;
      c.fillRect(sx, sy, sz, sz);
    }
  }
  function bgPhoto(c) {
    bgDefault(c);
    if (photoImg && photoImg.width) {
      // cover 핏
      const ir = photoImg.width / photoImg.height, sr = W / H;
      let dw, dh;
      if (ir > sr) { dh = H; dw = H * ir; } else { dw = W; dh = W / ir; }
      c.drawImage(photoImg, (W - dw) / 2, (H - dh) / 2, dw, dh);
      c.fillStyle = 'rgba(0,0,0,0.32)'; c.fillRect(-20, -20, W + 40, H + 40); // 가독성 오버레이
    }
  }
  const BGS = [
    { id: 'default', name: '기본 다크', price: 0, render: bgDefault },
    { id: 'sunset', name: '노을', price: 40, render: bgSunset },
    { id: 'space', name: '우주', price: 40, render: bgSpace },
    { id: 'photo', name: '내 사진', price: 150, render: bgPhoto },
  ];
  function bgById(id) { return BGS.find((b) => b.id === id) || BGS[0]; }

  const STICK_PRICE = 50;

  // ---------- Web Audio ----------
  let actx = null, masterGain = null, musicGain = null;
  function ensureAudio() {
    if (actx) { if (actx.state === 'suspended') actx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    actx = new AC();
    masterGain = actx.createGain();
    masterGain.gain.value = muted ? 0 : 0.9;
    masterGain.connect(actx.destination);
    musicGain = actx.createGain();
    musicGain.gain.value = 0.0001;
    musicGain.connect(masterGain);
  }
  function setMasterMute() { if (masterGain) masterGain.gain.value = muted ? 0 : 0.9; }

  // ---------- 절차적 배경 음악 ----------
  const music = { on: false, nextNoteTime: 0, step: 0, timer: null };
  function musicIntensity() {
    if (masterMode) return 1;
    return Math.max(0, Math.min(1, (stage - 1) / (TOTAL_STAGES - 1)));
  }
  function musicBPM() {
    if (masterMode) return 200;
    const t = Math.pow(musicIntensity(), 1.15);
    return 88 + t * 100;
  }
  const BASS_HZ = [98.0, 110.0, 130.81, 146.83, 110.0, 98.0, 130.81, 164.81];

  function scheduleKick(t, intensity) {
    const o = actx.createOscillator(); const g = actx.createGain();
    o.type = 'sine';
    const startHz = 150 + intensity * 110;
    o.frequency.setValueAtTime(startHz, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.10);
    const peak = 0.55 + intensity * 0.35;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(g); g.connect(musicGain); o.start(t); o.stop(t + 0.2);
  }
  function scheduleHat(t, intensity) {
    const len = Math.floor(actx.sampleRate * 0.04);
    const buf = actx.createBuffer(1, len, actx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = actx.createBufferSource(); src.buffer = buf;
    const hp = actx.createBiquadFilter(); hp.type = 'highpass';
    hp.frequency.value = 6000 + intensity * 3000;
    const g = actx.createGain();
    g.gain.value = 0.06 + intensity * 0.14;
    src.connect(hp); hp.connect(g); g.connect(musicGain); src.start(t);
  }
  function scheduleBass(t, hz, intensity, dur) {
    const o = actx.createOscillator(); const g = actx.createGain();
    o.type = intensity > 0.45 ? 'sawtooth' : 'triangle';
    o.frequency.setValueAtTime(hz, t);
    const lp = actx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(360 + intensity * 2600, t);
    lp.Q.value = 2 + intensity * 8;
    const peak = 0.12 + intensity * 0.14;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp); lp.connect(g); g.connect(musicGain);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function scheduleStab(t, intensity) {
    const hz = 440 * Math.pow(2, (Math.floor(Math.random() * 5)) / 12) * (1 + intensity * 0.5);
    const o = actx.createOscillator(); const g = actx.createGain();
    o.type = 'sawtooth'; o.frequency.value = hz;
    const lp = actx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200 + intensity * 4000;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.10 + intensity * 0.10, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o.connect(lp); lp.connect(g); g.connect(musicGain);
    o.start(t); o.stop(t + 0.15);
  }
  function musicTick() {
    if (!music.on || !actx) return;
    const secPerStep = 60 / musicBPM() / 4;
    while (music.nextNoteTime < actx.currentTime + 0.12) {
      const t = music.nextNoteTime;
      const inten = musicIntensity();
      const s = music.step % 16;
      if (s === 0 || s === 8) scheduleKick(t, inten);
      else if (inten > 0.35 && (s === 4 || s === 12)) scheduleKick(t, inten);
      else if (inten > 0.7 && (s === 6 || s === 14) && Math.random() < 0.6) scheduleKick(t, inten);
      const hatEvery = inten > 0.55 ? 1 : (inten > 0.25 ? 2 : 4);
      if (s % hatEvery === 0) scheduleHat(t, inten);
      const bassEvery = inten > 0.6 ? 2 : 4;
      if (s % bassEvery === 0) {
        const hz = BASS_HZ[(music.step / bassEvery | 0) % BASS_HZ.length];
        scheduleBass(t, hz, inten, secPerStep * bassEvery * 0.9);
      }
      if (inten > 0.7 && (s === 2 || s === 10) && Math.random() < (inten - 0.7) * 3) scheduleStab(t, inten);
      music.step++;
      music.nextNoteTime += secPerStep;
    }
    music.timer = setTimeout(musicTick, 25);
  }
  function startMusic() {
    if (!actx || music.on) return;
    music.on = true; music.step = 0;
    music.nextNoteTime = actx.currentTime + 0.08;
    musicGain.gain.cancelScheduledValues(actx.currentTime);
    musicGain.gain.setValueAtTime(Math.max(0.0001, musicGain.gain.value), actx.currentTime);
    musicGain.gain.exponentialRampToValueAtTime(0.5, actx.currentTime + 0.6);
    musicTick();
  }
  function stopMusic() {
    music.on = false;
    if (music.timer) { clearTimeout(music.timer); music.timer = null; }
    if (musicGain && actx) {
      musicGain.gain.cancelScheduledValues(actx.currentTime);
      musicGain.gain.setValueAtTime(Math.max(0.0001, musicGain.gain.value), actx.currentTime);
      musicGain.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + 0.3);
    }
  }

  function playBoing(freq, pan) {
    if (!actx || muted) return;
    const t = actx.currentTime;
    const osc = actx.createOscillator();
    const g = actx.createGain();
    const panner = actx.createStereoPanner ? actx.createStereoPanner() : null;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * 0.55, t);
    osc.frequency.exponentialRampToValueAtTime(freq, t + 0.09);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.92, t + 0.32);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);
    let tail = g;
    if (panner) { panner.pan.value = Math.max(-1, Math.min(1, pan || 0)); g.connect(panner); tail = panner; }
    osc.connect(g); tail.connect(masterGain);
    osc.start(t); osc.stop(t + 0.45);
  }

  // 터짐: 길고 시원한 화이트노이즈 스윕 + 상승 스파클 (0.6~0.9s 테일)
  function playPop() {
    if (!actx || muted) return;
    const t = actx.currentTime;
    // 화이트노이즈 스윕(밴드패스 위로)
    const len = Math.floor(actx.sampleRate * 0.85);
    const buf = actx.createBuffer(1, len, actx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = actx.createBufferSource(); src.buffer = buf;
    const bp = actx.createBiquadFilter(); bp.type = 'bandpass';
    bp.frequency.setValueAtTime(600, t);
    bp.frequency.exponentialRampToValueAtTime(7000, t + 0.6);
    bp.Q.value = 0.8;
    const ng = actx.createGain();
    ng.gain.setValueAtTime(0.35, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
    src.connect(bp); bp.connect(ng); ng.connect(masterGain); src.start(t);
    // 상승 스파클(쪼개지는 종소리 3음)
    [880, 1320, 1760].forEach((f, i) => {
      const o = actx.createOscillator(); const g = actx.createGain();
      o.type = 'triangle'; o.frequency.value = f;
      const st = t + i * 0.05;
      g.gain.setValueAtTime(0.0001, st);
      g.gain.exponentialRampToValueAtTime(0.32, st + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, st + 0.7);
      o.connect(g); g.connect(masterGain); o.start(st); o.stop(st + 0.75);
    });
  }

  function playFlash() {
    if (!actx || muted) return;
    const t = actx.currentTime;
    [523.25, 659.25, 783.99].forEach((f, i) => {
      const o = actx.createOscillator(); const g = actx.createGain();
      o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t + i * 0.04);
      g.gain.exponentialRampToValueAtTime(0.3, t + i * 0.04 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.04 + 0.5);
      o.connect(g); g.connect(masterGain); o.start(t + i * 0.04); o.stop(t + i * 0.04 + 0.55);
    });
  }

  function playFanfare() {
    if (!actx || muted) return;
    const t = actx.currentTime;
    const seq = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    seq.forEach((f, i) => {
      const o = actx.createOscillator(); const g = actx.createGain();
      o.type = 'triangle'; o.frequency.value = f;
      const st = t + i * 0.10;
      g.gain.setValueAtTime(0.0001, st);
      g.gain.exponentialRampToValueAtTime(0.35, st + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, st + 0.6);
      o.connect(g); g.connect(masterGain); o.start(st); o.stop(st + 0.65);
    });
    const chordT = t + seq.length * 0.10;
    [523.25, 659.25, 783.99].forEach((f) => {
      const o = actx.createOscillator(); const g = actx.createGain();
      o.type = 'sawtooth'; o.frequency.value = f;
      const lp = actx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3000;
      g.gain.setValueAtTime(0.0001, chordT);
      g.gain.exponentialRampToValueAtTime(0.2, chordT + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, chordT + 1.4);
      o.connect(lp); lp.connect(g); g.connect(masterGain); o.start(chordT); o.stop(chordT + 1.5);
    });
  }

  // ---------- 햅틱 ----------
  function vibrate(pattern) {
    if (navigator.vibrate) { try { navigator.vibrate(pattern); } catch (e) { /* graceful */ } }
  }

  // ---------- 막대기(패들) ----------
  // sticks 트레이: 보유 개수만큼 아이콘. 탭하면 활성 패들 켜짐.
  let paddle = null;              // { x, half, bouncesLeft, count }
  let mergeSticks = false;        // 합치기 토글
  const PADDLE_BAND = 26;         // 패들 y 두께(px)
  function paddleY() { return H - 90; }
  function activatePaddle() {
    if (store.sticks <= 0) return;
    const count = mergeSticks ? Math.min(3, store.sticks) : 1;
    const half = (count >= 3 ? 0.8 : count === 2 ? 0.55 : 0.3) * W / 2;
    paddle = { x: W / 2, half: half, bouncesLeft: 3 * count, count: count };
    renderStickTray();
  }
  function consumePaddleSticks() {
    // 패들 소멸 → 사용한 count 만큼 sticks 차감
    if (!paddle) return;
    store.sticks = Math.max(0, store.sticks - paddle.count);
    saveStore();
    paddle = null;
    renderStickTray();
  }

  // ---------- 리사이즈 / 회전 ----------
  function resize() {
    const prevW = W, prevH = H;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    // 공 크기 약 1.4배(기존 0.070 → 0.098)
    ballRadius = Math.max(24, Math.min(W, H) * 0.098);
    if ((state === STATE.PLAYING || state === STATE.PAUSED || state === STATE.CHECKPOINT) && prevW > 0 && prevH > 0) {
      for (const b of balls) {
        b.x = (b.x / prevW) * W;
        b.y = (b.y / prevH) * H;
        b.r = ballRadius;
        b.x = Math.max(b.r, Math.min(W - b.r, b.x));
        if (b.y < b.r) b.y = b.r;
      }
    } else {
      for (const b of balls) b.r = ballRadius;
    }
    if (typeof stage === 'number') recomputeKinematics();
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 150));

  // ---------- 게임 흐름 ----------
  // 받는 영역 고정: 상단 38% 위, 하단 62% 받음.
  function zoneTop() { return H * 0.38; }

  function spawnBall() {
    const margin = ballRadius * 1.5;
    let bestX = W / 2, bestGap = -1;
    for (let k = 0; k < 7; k++) {
      const cand = margin + (W - 2 * margin) * (k / 6);
      let minD = Infinity;
      for (const b of balls) minD = Math.min(minD, Math.abs(cand - b.x));
      if (balls.length === 0) { bestX = W * 0.5; break; }
      if (minD > bestGap) { bestGap = minD; bestX = cand; }
    }
    const nb = makeBall(bestX, -ballRadius * 1.2, (Math.random() * 2 - 1) * 60, 0);
    nb.entering = true;
    nb.spawnY = H * 0.18;
    balls.push(nb);
  }
  function reconcileBalls() {
    const want = ballsForStage(stage);
    while (balls.length < want) spawnBall();
  }

  function startGame() {
    ensureAudio();
    stage = 1; catchesInStage = 0; combo = 0; maxCombo = 0;
    slowFactor = 1; slowTimer = 0; zenActive = false; zenScored = false;
    masterMode = false; flashAlpha = 0; shake = 0;
    lives = LIVES_START;
    toastText = ''; toastTimer = 0; popsThisRun = 0;
    paddle = null;
    recomputeKinematics();
    balls = [];
    const b0 = makeBall(W / 2, H * 0.3, (Math.random() * 2 - 1) * 80, 0);
    balls.push(b0);
    reconcileBalls();
    particles = [];
    winParticles = [];
    state = STATE.PLAYING;
    elMenu.classList.add('hidden');
    elGameover.classList.add('hidden');
    elWin.classList.add('hidden');
    elShop.classList.add('hidden');
    elPause.classList.add('hidden');
    elCheckpoint.classList.add('hidden');
    elHud.classList.remove('hidden');
    elHud.setAttribute('aria-hidden', 'false');
    elPauseBtn.classList.remove('hidden');
    elBlindBanner.classList.toggle('hidden', !blindMode);
    renderStickTray();
    updateHud();
    startMusic();
    lastTime = performance.now();
    if (!running) { running = true; requestAnimationFrame(loop); }
  }

  function hidePlayChrome() {
    elHud.classList.add('hidden');
    elHud.setAttribute('aria-hidden', 'true');
    elBlindBanner.classList.add('hidden');
    elPauseBtn.classList.add('hidden');
    elStickTray.classList.add('hidden');
  }

  function gameOver() {
    state = STATE.GAMEOVER;
    stopMusic();
    if (stage > best) { best = stage; saveBest(); elNewRecord.classList.remove('hidden'); }
    else elNewRecord.classList.add('hidden');
    elFinalScore.textContent = stage;
    elGoBest.textContent = (masterMode ? '마스터 도달 ' : '최고 도달 ') + best + '판';
    hidePlayChrome();
    elGameover.classList.remove('hidden');
    vibrate(60);
  }

  function winGame() {
    state = STATE.WIN;
    stopMusic();
    if (stage > best) best = stage;
    if (best < TOTAL_STAGES) best = TOTAL_STAGES;
    saveBest();
    elWinCombo.textContent = maxCombo;
    hidePlayChrome();
    elWin.classList.remove('hidden');
    spawnWinParticles();
    playFanfare();
    flashAlpha = 1;
    vibrate([40, 30, 40, 30, 40, 30, 120]);
  }

  function enterMasterMode() {
    masterMode = true;
    state = STATE.PLAYING;
    recomputeKinematics();
    reconcileBalls();
    flashAlpha = 0;
    elWin.classList.add('hidden');
    elGameover.classList.add('hidden');
    elHud.classList.remove('hidden');
    elHud.setAttribute('aria-hidden', 'false');
    elPauseBtn.classList.remove('hidden');
    elBlindBanner.classList.toggle('hidden', !blindMode);
    renderStickTray();
    updateHud();
    startMusic();
    lastTime = performance.now();
  }

  function toMenu() {
    state = STATE.MENU;
    stopMusic();
    elGameover.classList.add('hidden');
    elWin.classList.add('hidden');
    elShop.classList.add('hidden');
    elPause.classList.add('hidden');
    elCheckpoint.classList.add('hidden');
    hidePlayChrome();
    elMenu.classList.remove('hidden');
    elMenuBest.textContent = '최고 도달 ' + best + '판';
  }

  // 체크포인트 (3판마다 차단)
  function enterCheckpoint(clearedStage) {
    state = STATE.CHECKPOINT;
    stopMusic();
    elCpTitle.textContent = clearedStage + '판 클리어!';
    elCheckpoint.classList.remove('hidden');
  }
  function resumeFromCheckpoint() {
    elCheckpoint.classList.add('hidden');
    state = STATE.PLAYING;
    startMusic();
    lastTime = performance.now();
  }

  // 일시정지
  function pauseGame() {
    if (state !== STATE.PLAYING) return;
    state = STATE.PAUSED;
    stopMusic();
    elPause.classList.remove('hidden');
  }
  function resumeGame() {
    if (state !== STATE.PAUSED) return;
    elPause.classList.add('hidden');
    state = STATE.PLAYING;
    startMusic();
    lastTime = performance.now();
  }

  function updateHud() {
    elHudStage.textContent = stage;
    elHudCombo.textContent = combo;
    elHudBest.textContent = best;
    if (elHudOf) elHudOf.textContent = masterMode ? ' MASTER' : ' / 30판';
    if (elHudLives) {
      const n = Math.max(0, lives | 0);
      elHudLives.textContent = '♥'.repeat(Math.min(n, LIVES_MAX)) + '♡'.repeat(Math.max(0, LIVES_MAX - n));
    }
  }

  function showToast(text) { toastText = text; toastTimer = 0.9; }

  function maybeZen() {
    if (zenActive) return;
    if (stage < 5) return;
    const multi = balls.length > 1;
    let prob = stage <= 18 ? 0.16 : 0.07;
    if (masterMode) prob = 0.04;
    if (multi) prob *= 0.6;
    if (Math.random() < prob) { zenActive = true; zenScored = false; slowTimer = 2.6; }
  }

  function bouncePitch(b) {
    const baseIdx = Math.min(combo, PENTA.length - 1);
    const base = PENTA[baseIdx];
    const heightFactor = Math.min(1, Math.abs(b.vy) / 1500);
    return base * (1 + heightFactor * 0.18);
  }

  // 코인 지급(1터짐=1코인, 5개째마다 축하)
  function awardCoin() {
    addCoins(1);
    popsThisRun += 1;
    if (popsThisRun % 5 === 0) showToast('+5 코인! 🪙');
  }

  // 큰 버스트 파티클(스킨색→흰색) + 링 충격파
  function spawnBurst(b) {
    const skin = skinById(store.equipped.skin);
    let base = COL.refractTo;
    if (skin.id === 'soccer') base = '#FFFFFF';
    else if (skin.id === 'basket') base = SKIN_COL.basketOrange;
    else if (skin.id === 'jupiter') base = SKIN_COL.jupTan;
    else if (skin.id === 'saturn') base = SKIN_COL.saturnBody;
    else if (skin.id === 'penguin') base = SKIN_COL.pengWhite;
    const c1 = hexToRgb(base);
    for (let i = 0; i < 42; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 160 + Math.random() * 460;
      const mix = Math.random();
      const col = 'rgb(' +
        Math.round(c1[0] + (255 - c1[0]) * mix) + ',' +
        Math.round(c1[1] + (255 - c1[1]) * mix) + ',' +
        Math.round(c1[2] + (255 - c1[2]) * mix) + ')';
      particles.push({
        x: b.x, y: b.y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120,
        life: 0.7 + Math.random() * 0.5, age: 0,
        size: 3 + Math.random() * 7, rot: Math.random() * Math.PI,
        color: col, ring: false,
      });
    }
    // 링 충격파
    particles.push({ x: b.x, y: b.y, vx: 0, vy: 0, life: 0.5, age: 0, size: b.r, rot: 0, color: '#FFFFFF', ring: true });
  }

  // 공 터짐: 제거 + 코인 + 새 공 보충
  function popBall(b) {
    spawnBurst(b);
    playPop();
    shake = 12;
    vibrate([40, 30, 40, 30, 60]);
    awardCoin();
    lives = Math.min(LIVES_MAX, lives + 1);
    updateHud();
    const idx = balls.indexOf(b);
    if (idx >= 0) balls.splice(idx, 1);
    reconcileBalls();
  }

  // 튕김 처리(성공적으로 받음) — paddleHit=true면 패들이 받은 것
  function doBounce(b, paddleHit) {
    b.pops += 1;

    // 임계 도달 → 터짐
    if (b.pops >= POP_AT) {
      // 터지기 직전 살짝 튕겨 보이게(시각) 후 즉시 제거
      combo += 1;
      if (combo > maxCombo) maxCombo = combo;
      popBall(b);
      // 판 진행은 일반 캐치와 동일하게 처리
      progressStage(false);
      return;
    }

    b.vy = -vNow;
    b.vx += (Math.random() * 2 - 1) * 120;
    b.vx = Math.max(-380, Math.min(380, b.vx));
    b.sy = 1.5; b.sx = 0.65;

    combo += 1;
    if (combo > maxCombo) maxCombo = combo;

    const pan = (b.x / W) * 2 - 1;
    playBoing(bouncePitch(b), pan);

    const zenBonus = zenActive && !zenScored;
    if (zenBonus) {
      zenScored = true; flashAlpha = 0.85; playFlash();
      vibrate([20, 40, 20]);
      slowTimer = Math.min(slowTimer, 0.25);
    } else if (!paddleHit) {
      vibrate(blindMode ? 30 : 15);
    }

    progressStage(zenBonus);
    maybeZen();
  }

  // 판 진행 로직(터짐·일반 공통). zenBonus면 두 판.
  function progressStage(zenBonus) {
    const prevStage = stage;
    catchesInStage += (zenBonus ? 2 : 1);
    while (catchesInStage >= catchesForStage(stage) && (masterMode || stage < TOTAL_STAGES)) {
      catchesInStage -= catchesForStage(stage);
      stage += 1;
      if (!masterMode && stage >= TOTAL_STAGES) break;
    }
    recomputeKinematics();
    reconcileBalls();
    updateHud();

    // 클리어 검사(체크포인트보다 우선)
    if (!masterMode && stage >= TOTAL_STAGES) { winGame(); return; }

    // 판이 실제로 올랐다면(여러 판 점프 가능) — 가장 최근 클리어 판들 처리
    for (let s = prevStage; s < stage; s++) {
      const cleared = s;  // s판을 막 깬 것
      // 토스트(비차단)
      showToast(cleared + '판 클리어!');
      // 3판마다 체크포인트(차단). 클리어(30)은 위에서 이미 winGame.
      if (cleared % 3 === 0) { enterCheckpoint(cleared); return; }
    }
  }

  function spawnWinParticles() {
    const colors = [COL.primary, COL.secondary, COL.refractFrom, COL.refractTo, '#FFFFFF'];
    for (let i = 0; i < 120; i++) {
      const a = -Math.PI / 2 + (Math.random() * 2 - 1) * 0.7;
      const sp = 380 + Math.random() * 620;
      winParticles.push({
        x: W * (0.2 + Math.random() * 0.6), y: H + 10,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 1.6 + Math.random() * 1.2, age: 0,
        size: 4 + Math.random() * 8, rot: Math.random() * Math.PI,
        color: colors[(Math.random() * colors.length) | 0],
      });
    }
  }

  // ---------- 입력 ----------
  function tryHit(px, py, hitSet) {
    if (state !== STATE.PLAYING) return;
    const inZone = py >= zoneTop();
    if (!inZone) return;
    let target = null, bestD = Infinity;
    for (const b of balls) {
      if (b.entering) continue;
      if (hitSet && hitSet.has(b.id)) continue;
      if (b.vy < -80) continue;
      const d = Math.hypot(px - b.x, py - b.y);
      const hitR = b.r + 36;
      if (d < hitR || blindMode) { if (d < bestD) { bestD = d; target = b; } }
    }
    if (target) {
      if (hitSet) hitSet.add(target.id);
      doBounce(target, false);
    }
  }

  function pointsFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    const pts = [];
    if (e.touches || e.changedTouches) {
      const list = e.changedTouches && e.changedTouches.length ? e.changedTouches : e.touches;
      for (let i = 0; i < list.length; i++) pts.push({ x: list[i].clientX - rect.left, y: list[i].clientY - rect.top });
    } else {
      pts.push({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
    return pts;
  }

  let paddleDragging = false;
  function onPointer(e) {
    ensureAudio();
    if (state !== STATE.PLAYING) return;
    e.preventDefault();
    const pts = pointsFromEvent(e);
    // 패들이 있으면 하단 근처 터치는 패들 드래그
    if (paddle && pts.length) {
      const py = pts[0].y;
      if (py > paddleY() - 80) { paddleDragging = true; paddle.x = pts[0].x; }
    }
    const hitSet = new Set();
    for (const p of pts) tryHit(p.x, p.y, hitSet);
  }
  function onPointerMove(e) {
    if (state !== STATE.PLAYING || !paddle || !paddleDragging) return;
    e.preventDefault();
    const pts = pointsFromEvent(e);
    if (pts.length) paddle.x = Math.max(paddle.half, Math.min(W - paddle.half, pts[0].x));
  }
  function onPointerUp() { paddleDragging = false; }
  canvas.addEventListener('touchstart', onPointer, { passive: false });
  canvas.addEventListener('mousedown', onPointer);
  canvas.addEventListener('touchmove', onPointerMove, { passive: false });
  canvas.addEventListener('mousemove', (e) => { if (paddleDragging) onPointerMove(e); });
  canvas.addEventListener('touchend', onPointerUp);
  canvas.addEventListener('mouseup', onPointerUp);

  // 공 낙하 피드백(플래시/셰이크/진동/사운드)
  function onBallLost() {
    flashAlpha = Math.max(flashAlpha, 0.5);
    shake = 14;
    vibrate([30, 40, 30]);
    if (actx && !muted) {
      const t = actx.currentTime;
      const o = actx.createOscillator();
      const g = actx.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(320, t);
      o.frequency.exponentialRampToValueAtTime(90, t + 0.28);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.32, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
      o.connect(g); g.connect(masterGain); o.start(t); o.stop(t + 0.35);
    }
  }

  // ---------- 업데이트 ----------
  function update(dt) {
    if (slowTimer > 0) {
      slowTimer -= dt;
      slowFactor = 0.34;
      if (slowTimer <= 0) { slowFactor = 1; zenActive = false; zenScored = false; }
    } else slowFactor = 1;

    const sdt = dt * slowFactor;
    const py = paddleY();

    let fellCount = 0;
    for (let i = 0; i < balls.length; i++) {
      const b = balls[i];
      if (b.entering) {
        b.x += b.vx * sdt;
        b.y += (b.spawnY - b.y) * Math.min(1, dt * 4) + 260 * sdt;
        if (b.y >= b.spawnY) { b.entering = false; b.vy = 0; }
        if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx); }
        if (b.x > W - b.r) { b.x = W - b.r; b.vx = -Math.abs(b.vx); }
      } else {
        const g = (b.vy < 0) ? gUp : gDown;   // 마스터모드는 분리, 그 외엔 동일
        b.vy += g * sdt;
        b.x += b.vx * sdt;
        b.y += b.vy * sdt;

        if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx) * 0.8; }
        if (b.x > W - b.r) { b.x = W - b.r; b.vx = -Math.abs(b.vx) * 0.8; }

        // 패들 충돌(바닥 체크보다 먼저). 낙하 중(vy>0)이고 패들 밴드에 닿으면 자동 반사+캐치.
        if (paddle && b.vy > 0 && b.y + b.r >= py - PADDLE_BAND / 2 && b.y - b.r <= py + PADDLE_BAND / 2) {
          if (b.x >= paddle.x - paddle.half && b.x <= paddle.x + paddle.half) {
            b.y = py - PADDLE_BAND / 2 - b.r;
            doBounce(b, true);
            paddle.bouncesLeft -= 1;
            if (paddle.bouncesLeft <= 0) consumePaddleSticks();
            // doBounce가 공을 제거(터짐)했을 수 있으니 인덱스 보정
            if (balls[i] !== b) { i--; continue; }
          }
        }

        // 낙하(바닥 아래로): 그 공 제거 + 하트 1 차감 (즉시 게임오버 아님)
        if (b.y - b.r > H) {
          balls.splice(i, 1);
          lives -= 1;
          fellCount += 1;
          i--;
          continue;
        }
      }

      b.sx += (1 - b.sx) * Math.min(1, dt * 9);
      b.sy += (1 - b.sy) * Math.min(1, dt * 9);
      b.spinPhase += b.vx * sdt * 0.01;

      b.trail.push({ x: b.x, y: b.y, r: b.r });
      if (b.trail.length > 10) b.trail.shift();
    }

    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.age += dt;
      if (!p.ring) { p.vy += gNow * 0.4 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += dt * 6; }
      if (p.age >= p.life) particles.splice(i, 1);
    }

    flashAlpha *= Math.max(0, 1 - dt * 4);
    shake *= Math.max(0, 1 - dt * 8);
    if (toastTimer > 0) toastTimer -= dt;

    if (fellCount > 0) {
      onBallLost();
      if (lives <= 0) { gameOver(); return; }
      reconcileBalls();
      updateHud();
    }
  }

  function updateWin(dt) {
    flashAlpha *= Math.max(0, 1 - dt * 3);
    for (let i = winParticles.length - 1; i >= 0; i--) {
      const p = winParticles[i];
      p.age += dt;
      p.vy += 900 * dt;
      p.vx *= (1 - dt * 0.6);
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += dt * 5;
      if (p.age >= p.life) winParticles.splice(i, 1);
    }
  }

  // ---------- 렌더 ----------
  function drawBackground() {
    const bg = bgById(store.equipped.bg);
    bg.render(ctx);
  }

  function drawZone() {
    const top = zoneTop();
    ctx.save();
    ctx.fillStyle = SHADE.zoneFill;
    ctx.fillRect(0, top, W, H - top);
    ctx.strokeStyle = SHADE.zoneEdge;
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 8]);
    ctx.beginPath(); ctx.moveTo(0, top); ctx.lineTo(W, top); ctx.stroke();
    ctx.restore();
  }

  function drawBalls() { for (const b of balls) drawOneBall(b); }

  function drawOneBall(b) {
    const x = b.x, y = b.y, r = b.r;
    const ripeness = Math.min(1, b.pops / POP_AT);
    // 잔상
    for (let i = 0; i < b.trail.length; i++) {
      const t = b.trail[i];
      const a = (i / b.trail.length) * 0.18;
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r * (0.6 + i / b.trail.length * 0.4), 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(213,58,107,' + a.toFixed(3) + ')';
      ctx.fill();
    }

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(b.sx, b.sy);

    // 스킨 본체 (원점 기준)
    const skin = skinById(store.equipped.skin);
    skin.draw(ctx, 0, 0, r, b.spinPhase);

    // 굴절 림
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.lineWidth = Math.max(1.5, r * 0.06);
    ctx.strokeStyle = SHADE.glassFaint; ctx.stroke();

    // 익음(ripeness) 공통 오버레이: 0~0.7 회색화, 0.7~1 백색화
    if (ripeness > 0.01) {
      let overAlpha, overCol;
      if (ripeness <= 0.7) {
        overAlpha = (ripeness / 0.7) * 0.55;
        overCol = SHADE.ripeGrey;
      } else {
        overAlpha = 0.55 + ((ripeness - 0.7) / 0.3) * 0.42;
        overCol = '#FFFFFF';
      }
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(overCol, overAlpha); ctx.fill();
      // 임계 임박 글로우
      if (ripeness > 0.85) {
        ctx.beginPath(); ctx.arc(0, 0, r * (1.05 + Math.sin(performance.now() / 120) * 0.05), 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = Math.max(2, r * 0.08); ctx.stroke();
      }
    }

    // 하이라이트
    ctx.beginPath();
    ctx.ellipse(-r * 0.32, -r * 0.4, r * 0.26, r * 0.16, -0.5, 0, Math.PI * 2);
    ctx.fillStyle = SHADE.glassEdge; ctx.fill();

    ctx.restore();
  }

  function drawParticles() {
    for (const p of particles) {
      const a = Math.max(0, 1 - p.age / p.life);
      if (p.ring) {
        const rr = p.size * (1 + p.age / p.life * 2.2);
        ctx.save();
        ctx.globalAlpha = a * 0.6;
        ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 4 * a;
        ctx.beginPath(); ctx.arc(p.x, p.y, rr, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
        continue;
      }
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color || SHADE.shard;
      ctx.beginPath();
      ctx.moveTo(0, -p.size); ctx.lineTo(p.size * 0.7, p.size * 0.5); ctx.lineTo(-p.size * 0.6, p.size * 0.5);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  function drawPaddle() {
    if (!paddle) return;
    const py = paddleY();
    ctx.save();
    const x0 = paddle.x - paddle.half, w = paddle.half * 2;
    const g = ctx.createLinearGradient(0, py - PADDLE_BAND, 0, py + PADDLE_BAND);
    g.addColorStop(0, SHADE.stick); g.addColorStop(1, SHADE.stickDark);
    ctx.fillStyle = g;
    roundRect(ctx, x0, py - PADDLE_BAND / 2, w, PADDLE_BAND, PADDLE_BAND / 2); ctx.fill();
    // 내구도 표시
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '700 13px ' + COL_FONT;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(paddle.bouncesLeft + '', paddle.x, py);
    ctx.restore();
  }

  function drawComboFloat() {
    if (combo <= 0 || balls.length === 0) return;
    let anchor = balls[0];
    for (const b of balls) if (b.y < anchor.y) anchor = b;
    ctx.save();
    const pulse = 1 + Math.sin(performance.now() / 220) * 0.05;
    ctx.translate(anchor.x, anchor.y - anchor.r - 40);
    ctx.scale(pulse, pulse);
    ctx.font = '800 ' + Math.round(anchor.r * 0.9) + 'px ' + COL_FONT;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = COL.secondary;
    ctx.shadowColor = hexToRgba(COL.secondary, 0.6); ctx.shadowBlur = 18;
    ctx.fillText('♪' + combo, 0, 0);
    ctx.restore();
  }

  function drawToast() {
    if (toastTimer <= 0) return;
    const a = Math.min(1, toastTimer / 0.3);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = '800 30px ' + COL_FONT;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const ty = H * 0.16;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    roundRect(ctx, W / 2 - 130, ty - 28, 260, 56, 16); ctx.fill();
    ctx.fillStyle = COL.secondary;
    ctx.shadowColor = hexToRgba(COL.secondary, 0.5); ctx.shadowBlur = 14;
    ctx.fillText(toastText, W / 2, ty);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function render() {
    ctx.save();
    if (shake > 0.5) ctx.translate((Math.random() * 2 - 1) * shake, (Math.random() * 2 - 1) * shake);

    drawBackground();

    if (state === STATE.PLAYING || state === STATE.PAUSED || state === STATE.CHECKPOINT) {
      if (blindMode && state === STATE.PLAYING) {
        ctx.fillStyle = '#000';
        ctx.fillRect(-20, -20, W + 40, H + 40);
      } else {
        drawZone();
        drawParticles();
        drawBalls();
        drawPaddle();
        drawComboFloat();
      }
      if (slowFactor < 1 && state === STATE.PLAYING) {
        ctx.fillStyle = SHADE.zenDim;
        ctx.fillRect(-20, -20, W + 40, H + 40);
        if (!blindMode) { drawBalls(); drawPaddle(); drawComboFloat(); }
      }
      if (flashAlpha > 0.01) {
        ctx.fillStyle = 'rgba(255,255,255,' + flashAlpha.toFixed(3) + ')';
        ctx.fillRect(-20, -20, W + 40, H + 40);
      }
      drawToast();
    } else if (state === STATE.WIN) {
      drawWinParticles();
      if (flashAlpha > 0.01) {
        ctx.fillStyle = 'rgba(255,255,255,' + (flashAlpha * 0.7).toFixed(3) + ')';
        ctx.fillRect(-20, -20, W + 40, H + 40);
      }
    }
    ctx.restore();
  }

  function drawWinParticles() {
    for (const p of winParticles) {
      const a = Math.max(0, 1 - p.age / p.life);
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  // ---------- 루프 ----------
  function loop(now) {
    let dt = (now - lastTime) / 1000;
    lastTime = now;
    if (dt > MAX_DT) dt = MAX_DT;
    if (state === STATE.PLAYING) update(dt);
    else if (state === STATE.WIN) updateWin(dt);
    render();
    requestAnimationFrame(loop);
  }

  // ---------- 공유 카드 ----------
  async function shareResult() {
    const cw = 600, ch = 800;
    const cv = document.createElement('canvas');
    cv.width = cw; cv.height = ch;
    const c = cv.getContext('2d');
    const g = c.createLinearGradient(0, 0, cw, ch);
    g.addColorStop(0, COL.primary); g.addColorStop(1, COL.secondary);
    c.fillStyle = g; c.fillRect(0, 0, cw, ch);
    c.fillStyle = 'rgba(27,29,33,0.78)';
    roundRect(c, 40, 40, cw - 80, ch - 80, 24); c.fill();

    const cleared = state === STATE.WIN || stage >= TOTAL_STAGES;
    c.textAlign = 'center'; c.fillStyle = '#FFFFFF';
    c.font = "800 64px " + COL_FONT;
    c.fillText('튕기기', cw / 2, 180);
    c.font = "500 28px " + COL_FONT; c.fillStyle = '#9CA3AF';
    c.fillText(masterMode ? '마스터모드' : (cleared ? '30판 정복!' : '30판 도전'), cw / 2, 230);
    c.font = "800 150px " + COL_FONT; c.fillStyle = COL.secondary;
    c.fillText(String(stage), cw / 2, 460);
    c.font = "500 32px " + COL_FONT; c.fillStyle = '#FFFFFF';
    c.fillText('판 도달', cw / 2, 525);
    c.font = "700 30px " + COL_FONT; c.fillStyle = '#FFFFFF';
    c.fillText('최고 도달 ' + best + '판', cw / 2, 620);
    c.font = "600 26px " + COL_FONT; c.fillStyle = '#9CA3AF';
    c.fillText('최대 콤보 ' + maxCombo, cw / 2, 670);

    const blob = await new Promise((res) => cv.toBlob(res, 'image/png'));
    if (!blob) return;
    const file = new File([blob], 'pung-score.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: '튕기기', text: stage + '판 도달!' }); return; }
      catch (e) { /* 폴백 */ }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'pung-score.png';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function roundRect(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  // ================= 상점 UI =================
  let shopReturnTo = STATE.MENU;   // 닫을 때 돌아갈 상태(메뉴 or 일시정지)

  function openShop(fromPause) {
    shopReturnTo = fromPause ? STATE.PAUSED : STATE.MENU;
    if (fromPause) elPause.classList.add('hidden');
    else elMenu.classList.add('hidden');
    elShop.classList.remove('hidden');
    showTab('balls');
    renderShop();
  }
  function closeShop() {
    elShop.classList.add('hidden');
    if (shopReturnTo === STATE.PAUSED) elPause.classList.remove('hidden');
    else elMenu.classList.remove('hidden');
  }
  function showTab(which) {
    elGridBalls.classList.toggle('hidden', which !== 'balls');
    elGridBgs.classList.toggle('hidden', which !== 'bgs');
    elGridItems.classList.toggle('hidden', which !== 'items');
    elTabBalls.setAttribute('aria-pressed', String(which === 'balls'));
    elTabBgs.setAttribute('aria-pressed', String(which === 'bgs'));
    elTabItems.setAttribute('aria-pressed', String(which === 'items'));
  }

  function renderShop() {
    elShopCoins.textContent = getCoins() + ' 🪙';
    renderSkinGrid();
    renderBgGrid();
    renderItemGrid();
    renderStickTray();
  }

  // 카드 미리보기 캔버스
  function makePreviewCanvas(drawFn) {
    const cv = document.createElement('canvas');
    cv.width = 120; cv.height = 120;
    cv.className = 'shop-prev';
    const c = cv.getContext('2d');
    drawFn(c, cv.width, cv.height);
    return cv;
  }

  function buildCard(prevCanvas, name, owned, equipped, price, onAction) {
    const card = document.createElement('div');
    card.className = 'shop-card';
    card.appendChild(prevCanvas);
    const nm = document.createElement('div'); nm.className = 'shop-name'; nm.textContent = name;
    card.appendChild(nm);
    const btn = document.createElement('button');
    btn.className = 'btn ' + (equipped ? 'btn-ghost' : 'btn-primary');
    btn.style.padding = '8px 14px'; btn.style.fontSize = '14px'; btn.style.minHeight = '36px';
    if (equipped) { btn.textContent = '장착됨'; btn.disabled = true; }
    else if (owned) { btn.textContent = '장착'; }
    else { btn.textContent = price + ' 🪙'; }
    btn.addEventListener('click', onAction);
    card.appendChild(btn);
    return card;
  }

  function renderSkinGrid() {
    elGridBalls.innerHTML = '';
    for (const skin of SKINS) {
      const owned = isOwned('skins', skin.id);
      const equipped = store.equipped.skin === skin.id;
      const prev = makePreviewCanvas((c, cw, ch) => {
        c.fillStyle = '#1B1D21'; c.fillRect(0, 0, cw, ch);
        skin.draw(c, cw / 2, ch / 2, cw * 0.36, 0.6);
      });
      const card = buildCard(prev, skin.name, owned, equipped, skin.price, () => {
        if (equipped) return;
        if (owned) { equip('skin', skin.id); }
        else { if (!buy('skins', skin.id, skin.price)) { showShopMsg('코인이 부족해요'); return; } equip('skin', skin.id); }
        renderShop();
      });
      elGridBalls.appendChild(card);
    }
  }

  function renderBgGrid() {
    elGridBgs.innerHTML = '';
    for (const bg of BGS) {
      const owned = isOwned('bgs', bg.id);
      const equipped = store.equipped.bg === bg.id;
      const prev = makePreviewCanvas((c, cw, ch) => {
        // 배경 미리보기: 임시 W/H 컨텍스트 흉내 (render는 전역 W/H 사용하므로 직접 미니 렌더)
        miniBgPreview(c, bg.id, cw, ch);
      });
      let label = bg.name;
      const card = buildCard(prev, label, owned, equipped, bg.price, () => {
        if (equipped) return;
        if (bg.id === 'photo' && owned && !store.photo) { elPhotoInput.click(); return; }
        if (owned) { equip('bg', bg.id); }
        else {
          if (bg.id === 'photo') {
            // 사진 배경: 사면서 사진 먼저 고르게
            if (!buy('bgs', bg.id, bg.price)) { showShopMsg('코인이 부족해요'); return; }
            equip('bg', bg.id);
            elPhotoInput.click();
          } else {
            if (!buy('bgs', bg.id, bg.price)) { showShopMsg('코인이 부족해요'); return; }
            equip('bg', bg.id);
          }
        }
        renderShop();
      });
      elGridBgs.appendChild(card);
    }
  }

  function miniBgPreview(c, id, cw, ch) {
    if (id === 'default') { c.fillStyle = '#1B1D21'; c.fillRect(0, 0, cw, ch); }
    else if (id === 'sunset') {
      const g = c.createLinearGradient(0, 0, 0, ch);
      g.addColorStop(0, '#2A1B3D'); g.addColorStop(0.5, '#B5446E'); g.addColorStop(1, '#F2994A');
      c.fillStyle = g; c.fillRect(0, 0, cw, ch);
    } else if (id === 'space') {
      const g = c.createLinearGradient(0, 0, 0, ch);
      g.addColorStop(0, '#05060F'); g.addColorStop(1, '#15203A');
      c.fillStyle = g; c.fillRect(0, 0, cw, ch);
      c.fillStyle = '#FFFFFF';
      for (let i = 0; i < 20; i++) c.fillRect((i * 53 % 100) / 100 * cw, (i * 31 % 100) / 100 * ch, 1.5, 1.5);
    } else if (id === 'photo') {
      if (photoImg && photoImg.width) {
        c.drawImage(photoImg, 0, 0, cw, ch);
      } else {
        c.fillStyle = '#2B2D35'; c.fillRect(0, 0, cw, ch);
        c.fillStyle = '#9CA3AF'; c.font = '600 13px ' + COL_FONT; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText('사진 선택', cw / 2, ch / 2);
      }
    }
  }

  function renderItemGrid() {
    elGridItems.innerHTML = '';
    // 막대기 카드
    const prev = makePreviewCanvas((c, cw, ch) => {
      c.fillStyle = '#1B1D21'; c.fillRect(0, 0, cw, ch);
      const g = c.createLinearGradient(0, ch / 2 - 12, 0, ch / 2 + 12);
      g.addColorStop(0, SHADE.stick); g.addColorStop(1, SHADE.stickDark);
      c.fillStyle = g;
      roundRect(c, cw * 0.12, ch / 2 - 9, cw * 0.76, 18, 9); c.fill();
    });
    const card = document.createElement('div');
    card.className = 'shop-card';
    card.appendChild(prev);
    const nm = document.createElement('div'); nm.className = 'shop-name';
    nm.textContent = '막대기 (보유 ' + store.sticks + ')';
    card.appendChild(nm);
    const btn = document.createElement('button');
    btn.className = 'btn btn-primary';
    btn.style.padding = '8px 14px'; btn.style.fontSize = '14px'; btn.style.minHeight = '36px';
    btn.textContent = STICK_PRICE + ' 🪙 구매';
    btn.addEventListener('click', () => {
      if (!spend(STICK_PRICE)) { showShopMsg('코인이 부족해요'); return; }
      store.sticks += 1; saveStore();
      renderShop();
    });
    card.appendChild(btn);
    elGridItems.appendChild(card);

    // 안내
    const info = document.createElement('div');
    info.className = 'shop-info';
    info.textContent = '막대기는 떨어지는 공을 자동으로 받아줍니다. 게임 화면 하단 트레이에서 켜고, 막대당 3번 받으면 사라져요. 합치기로 더 긴 패들을 만들 수 있습니다.';
    elGridItems.appendChild(info);
  }

  let shopMsgTimer = null;
  function showShopMsg(text) {
    elShopCoins.textContent = text;
    if (shopMsgTimer) clearTimeout(shopMsgTimer);
    shopMsgTimer = setTimeout(() => { elShopCoins.textContent = getCoins() + ' 🪙'; }, 1200);
  }

  // 사진 업로드 → 다운스케일 → store.photo
  function onPhotoSelected(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 720;
        let w = img.width, h = img.height;
        if (w > h && w > maxDim) { h = Math.round(h * maxDim / w); w = maxDim; }
        else if (h >= w && h > maxDim) { w = Math.round(w * maxDim / h); h = maxDim; }
        const cv = document.createElement('canvas');
        cv.width = w; cv.height = h;
        cv.getContext('2d').drawImage(img, 0, 0, w, h);
        let dataUrl;
        try { dataUrl = cv.toDataURL('image/jpeg', 0.7); } catch (err) { showShopMsg('사진을 읽지 못했어요'); return; }
        store.photo = dataUrl;
        // 사진 배경 자동 소유/장착
        if (!isOwned('bgs', 'photo')) store.owned.bgs.push('photo');
        store.equipped.bg = 'photo';
        saveStore();
        if (!store.photo) { showShopMsg('사진 용량 초과 — 더 작은 사진을'); }
        loadPhotoImage();
        renderShop();
      };
      img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  // ================= 스틱 트레이 (게임 중) =================
  function renderStickTray() {
    const inPlay = (state === STATE.PLAYING || state === STATE.PAUSED || state === STATE.CHECKPOINT);
    if (!inPlay || store.sticks <= 0) { elStickTray.classList.add('hidden'); return; }
    elStickTray.classList.remove('hidden');
    elStickTray.innerHTML = '';
    // 합치기 토글
    const merge = document.createElement('button');
    merge.id = 'stickMergeBtn';
    merge.className = 'stick-merge' + (mergeSticks ? ' on' : '');
    merge.textContent = mergeSticks ? '합치기 ON' : '합치기';
    merge.addEventListener('click', () => { mergeSticks = !mergeSticks; if (paddle) activatePaddle(); renderStickTray(); });
    elStickTray.appendChild(merge);
    // 아이콘 최대 3개
    const show = Math.min(3, store.sticks);
    for (let i = 0; i < show; i++) {
      const ic = document.createElement('button');
      ic.className = 'stick-icon' + (paddle ? ' active' : '');
      ic.textContent = '|';
      ic.addEventListener('click', () => { if (paddle) { paddle = null; } else { activatePaddle(); } renderStickTray(); });
      elStickTray.appendChild(ic);
    }
    if (store.sticks > 3) {
      const more = document.createElement('span'); more.className = 'stick-more'; more.textContent = '+' + (store.sticks - 3);
      elStickTray.appendChild(more);
    }
  }

  // ---------- UI 바인딩 ----------
  function refreshToggleLabels() {
    elBlindToggle.textContent = blindMode ? '눈 감고 치기 켜짐' : '눈 감고 치기 끄기';
    elBlindToggle.setAttribute('aria-pressed', String(blindMode));
    elMuteToggle.textContent = muted ? '소리 꺼짐' : '소리 켜짐';
    elMuteToggle.setAttribute('aria-pressed', String(muted));
  }

  elStart.addEventListener('click', startGame);
  elRetry.addEventListener('click', startGame);
  elMenuBtn.addEventListener('click', toMenu);
  elShare.addEventListener('click', shareResult);
  elWinRetry.addEventListener('click', startGame);
  elWinMenu.addEventListener('click', toMenu);
  elWinShare.addEventListener('click', shareResult);
  if (elWinMaster) elWinMaster.addEventListener('click', enterMasterMode);
  elBlindToggle.addEventListener('click', () => {
    blindMode = !blindMode; refreshToggleLabels();
    if (state === STATE.PLAYING) elBlindBanner.classList.toggle('hidden', !blindMode);
  });
  elMuteToggle.addEventListener('click', () => {
    muted = !muted; ensureAudio(); setMasterMute(); refreshToggleLabels();
  });

  // 상점
  elShopBtn.addEventListener('click', () => openShop(false));
  elPauseShopBtn.addEventListener('click', () => openShop(true));
  elShopBack.addEventListener('click', closeShop);
  elTabBalls.addEventListener('click', () => showTab('balls'));
  elTabBgs.addEventListener('click', () => showTab('bgs'));
  elTabItems.addEventListener('click', () => showTab('items'));
  elPhotoInput.addEventListener('change', onPhotoSelected);

  // 일시정지
  elPauseBtn.addEventListener('click', pauseGame);
  elPauseResume.addEventListener('click', resumeGame);
  elPauseMenu.addEventListener('click', toMenu);

  // 체크포인트
  elCpContinue.addEventListener('click', resumeFromCheckpoint);
  elCpStop.addEventListener('click', toMenu);

  // 합치기(오버레이용 — 트레이 버튼과 동기화)
  if (elStickMerge) elStickMerge.addEventListener('click', () => {
    mergeSticks = !mergeSticks; if (paddle) activatePaddle(); renderStickTray();
  });

  // 백그라운드
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (actx && actx.state === 'running') { try { actx.suspend(); } catch (e) { /* 무시 */ } }
    } else {
      lastTime = performance.now();
      if (actx && actx.state === 'suspended') { try { actx.resume(); } catch (e) { /* 무시 */ } }
      if (music.on && actx && music.nextNoteTime < actx.currentTime) music.nextNoteTime = actx.currentTime + 0.05;
    }
  });

  ['touchstart', 'mousedown', 'keydown'].forEach((ev) =>
    window.addEventListener(ev, ensureAudio, { once: false }));

  // ---------- 부팅 ----------
  resize();
  elMenuBest.textContent = '최고 도달 ' + best + '판';
  refreshToggleLabels();
  running = true;
  lastTime = performance.now();
  requestAnimationFrame(loop);
})();
