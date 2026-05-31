/* 튕기기 — 30판 정복 + 무한 마스터모드.
   순수 JS + Canvas + Web Audio. 프레임워크/외부 라이브러리 0.
   상태: menu → playing → gameover / win → (마스터모드는 다시 playing).

   30판 구조: 공을 한 번 받을 때마다 +1판(1캐치=1판). 30판째를 받으면 클리어.
   판이 오를수록 받을 띠의 세로 높이가 지수형으로 줄어든다(1판=화면 전체, 30판=극소).
   5판마다 공이 +1개 늘어 저글링이 된다 — 공 하나라도 바닥에 떨어지면 게임오버.
   클리어 후 마스터모드: zone 최소 고정, 판 카운트 31,32… 무한 증가, 점수 경쟁.
   배경 음악은 절차적 레이어로 판이 오를수록 BPM↑·공격적(톱니/디스토션)·급박.

   색 상수: 캔버스 셰이딩·파티클용 부수 색은 tokens.css 가 아니라
   여기 JS 상수로 둔다(스펙·훅 규칙). 브랜드 색은 CSS 변수에서 읽어 온다. */
'use strict';

(function () {
  // ---------- DOM ----------
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const elHud = document.getElementById('hud');
  const elHudStage = document.getElementById('hudStage');
  const elHudOf = document.getElementById('hudOf');
  const elHudCombo = document.getElementById('hudCombo');
  const elHudBest = document.getElementById('hudBest');
  const elMenu = document.getElementById('menu');
  const elMenuBest = document.getElementById('menuBest');
  const elStart = document.getElementById('startBtn');
  const elBlindToggle = document.getElementById('blindToggle');
  const elMuteToggle = document.getElementById('muteToggle');
  const elGameover = document.getElementById('gameover');
  const elNewRecord = document.getElementById('newRecordBadge');
  const elFinalScore = document.getElementById('finalScore');
  const elGoBest = document.getElementById('goBest');
  const elRetry = document.getElementById('retryBtn');
  const elShare = document.getElementById('shareBtn');
  const elMenuBtn = document.getElementById('menuBtn');
  const elBlindBanner = document.getElementById('blindBanner');
  const elWin = document.getElementById('winScreen');
  const elWinCombo = document.getElementById('winCombo');
  const elWinRetry = document.getElementById('winRetryBtn');
  const elWinShare = document.getElementById('winShareBtn');
  const elWinMenu = document.getElementById('winMenuBtn');
  const elWinMaster = document.getElementById('winMasterBtn');   // 마스터모드 계속하기

  // ---------- 브랜드 색 (CSS 변수에서 읽음) ----------
  const cssVar = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const COL = {
    primary: cssVar('--primary') || '#EF4444',
    secondary: cssVar('--secondary') || '#FACC15',
    refractFrom: cssVar('--ball-refract-from') || '#8A38F5',
    refractTo: cssVar('--ball-refract-to') || '#D53A6B',
    bg: cssVar('--canvas-bg') || '#1B1D21',
  };
  // 부수 색(셰이딩/파티클) — 스펙상 JS 상수로 둠
  const SHADE = {
    glassEdge: 'rgba(255,255,255,0.85)',
    glassFaint: 'rgba(255,255,255,0.10)',
    zoneFill: 'rgba(239,68,68,0.16)',
    zoneEdge: 'rgba(250,204,21,0.55)',
    zenDim: 'rgba(10,10,16,0.62)',
    shard: '#BFE3FF',
  };

  // ---------- 상태 ----------
  const STATE = { MENU: 0, PLAYING: 1, GAMEOVER: 2, WIN: 3 };
  let state = STATE.MENU;

  let W = 0, H = 0, DPR = 1;
  const GRAVITY = 1900;          // px/s^2 (CSS px 기준)
  const MAX_DT = 1 / 30;         // 백그라운드 복귀 dt 폭주 방지

  // ----- 30판 구조 + 무한 마스터모드 -----
  const TOTAL_STAGES = 30;
  const CATCHES_PER_STAGE = 1;   // 1캐치 = +1판 (30캐치 = 클리어)
  // 띠 높이(화면 높이 대비). 1판=거의 전체, 30판=극소. 지수형(후반이 가파름).
  const ZONE_MAX_H = 0.96;       // 1판: 화면 거의 전체
  const ZONE_MIN_H = 0.045;      // 30판: 아주 얇은 띠
  // 진행도 p(0~1)에 대한 곡선. 큰 지수 → 초반 완만, 후반(22~30판) 급가파름.
  const ZONE_CURVE = 2.6;
  function zoneFracForStage(stage) {
    // 30판 이상(마스터모드)은 최소값 고정
    const p = (Math.max(1, Math.min(TOTAL_STAGES, stage)) - 1) / (TOTAL_STAGES - 1); // 0..1
    const eased = Math.pow(p, ZONE_CURVE);
    return ZONE_MAX_H + (ZONE_MIN_H - ZONE_MAX_H) * eased;
  }
  // 판 → 공 개수: 1~5판=1, 6~10판=2, …, 30판=6. 마스터모드도 5판마다 +1.
  function ballsForStage(stage) {
    return Math.floor((Math.max(1, stage) - 1) / 5) + 1;
  }

  let best = 1;                  // 최고 도달 판수
  let muted = false;
  let blindMode = false;

  // 게임 변수
  let stage, catchesInStage, combo, maxCombo, zoneH, slowFactor, slowTimer, zenActive, zenScored;
  let masterMode = false;       // 30판 클리어 후 무한 모드
  let flashAlpha = 0;
  let shake = 0;
  let lastTime = 0;
  let running = false;
  let winParticles = [];        // 클리어 축하 파티클

  // ----- 멀티볼 -----
  let ballRadius = 30;          // 화면 비율 기반(리사이즈에서 갱신)
  let balls = [];
  let nextBallId = 1;
  function makeBall(x, y, vx, vy) {
    return {
      id: nextBallId++,
      x: x, y: y, vx: vx, vy: vy, r: ballRadius,
      sx: 1, sy: 1,            // squash & stretch
      spinPhase: 0,
      trail: [],
      spawnY: y,               // 등장 애니메이션 목표(부드러운 진입)
      entering: false,         // true 동안 중력 면제(화면 위에서 미끄러져 들어옴)
      glass: false, glassTimer: 0,   // 유리화는 공별 적용
    };
  }
  let particles = [];

  // 펜타토닉 (메이저): C D E G A — 콤보 사다리
  const PENTA = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99, 880.0];

  // ---------- localStorage (판 기반 키) ----------
  try { best = parseInt(localStorage.getItem('pung_best_stage') || '1', 10) || 1; } catch (e) { best = 1; }
  if (best < 1) best = 1;
  function saveBest() { try { localStorage.setItem('pung_best_stage', String(best)); } catch (e) { /* 무시: 프라이빗 모드 */ } }

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
    // 음악 레이어는 별도 버스(효과음보다 낮게) — 같은 마스터 밑이라 음소거로 함께 꺼짐
    musicGain = actx.createGain();
    musicGain.gain.value = 0.0001;
    musicGain.connect(masterGain);
  }
  function setMasterMute() { if (masterGain) masterGain.gain.value = muted ? 0 : 0.9; }

  // ---------- 절차적 배경 음악 (판 기반 에스컬레이션) ----------
  // 16분음표 스텝 시퀀서. BPM·공격성·퍼커션 밀도·피치를 판에 따라 끌어올림.
  // intensity 0(1판)~1(30판). 초반 차분 → 후반(22~30판) 과격·급박. 마스터모드는 최대 고정.
  const music = {
    on: false,
    nextNoteTime: 0,
    step: 0,
    timer: null,
  };
  function musicIntensity() {
    if (masterMode) return 1;   // 마스터모드: 최대 고정
    return Math.max(0, Math.min(1, (stage - 1) / (TOTAL_STAGES - 1)));
  }
  function musicBPM() {
    // 88(차분) → 188(급박). 마스터모드는 살짝 더 공격적(200). 후반 가속 위해 약간 지수형.
    if (masterMode) return 200;
    const t = Math.pow(musicIntensity(), 1.15);
    return 88 + t * 100;
  }
  // 마이너 펜타토닉 베이스라인 음정(저음 → 긴장)
  const BASS_HZ = [98.0, 110.0, 130.81, 146.83, 110.0, 98.0, 130.81, 164.81];

  function scheduleKick(t, intensity) {
    const o = actx.createOscillator(); const g = actx.createGain();
    o.type = 'sine';
    const startHz = 150 + intensity * 110;   // 후반: 더 높고 타격감
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
    // 후반: sine → sawtooth 로 전환하며 디스토션감
    o.type = intensity > 0.45 ? 'sawtooth' : 'triangle';
    o.frequency.setValueAtTime(hz, t);
    const lp = actx.createBiquadFilter(); lp.type = 'lowpass';
    // 후반엔 필터를 열어 더 거칠고 밝게(공격적)
    lp.frequency.setValueAtTime(360 + intensity * 2600, t);
    lp.Q.value = 2 + intensity * 8;
    const peak = 0.12 + intensity * 0.14;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp); lp.connect(g); g.connect(musicGain);
    o.start(t); o.stop(t + dur + 0.05);
  }
  // 후반 긴장 리드(고음 톱니 stab)
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
    const secPerStep = 60 / musicBPM() / 4;   // 16분음표
    // 부족분 미리 스케줄(드리프트 방지)
    while (music.nextNoteTime < actx.currentTime + 0.12) {
      const t = music.nextNoteTime;
      const inten = musicIntensity();
      const s = music.step % 16;

      // 킥: 초반 1,9 → 후반 더 촘촘(1,5,9,13 + 가끔 오프비트)
      if (s === 0 || s === 8) scheduleKick(t, inten);
      else if (inten > 0.35 && (s === 4 || s === 12)) scheduleKick(t, inten);
      else if (inten > 0.7 && (s === 6 || s === 14) && Math.random() < 0.6) scheduleKick(t, inten);

      // 하이햇: 밀도 = intensity. 8분 → 16분으로 촘촘.
      const hatEvery = inten > 0.55 ? 1 : (inten > 0.25 ? 2 : 4);
      if (s % hatEvery === 0) scheduleHat(t, inten);

      // 베이스: 매 4스텝(8분음표 느낌). 후반엔 더 잦게.
      const bassEvery = inten > 0.6 ? 2 : 4;
      if (s % bassEvery === 0) {
        const hz = BASS_HZ[(music.step / bassEvery | 0) % BASS_HZ.length];
        scheduleBass(t, hz, inten, secPerStep * bassEvery * 0.9);
      }

      // 긴장 stab: intensity 0.7+ (대략 22판+) 부터 등장, 갈수록 잦게. 마스터모드 최다.
      if (inten > 0.7 && (s === 2 || s === 10) && Math.random() < (inten - 0.7) * 3) {
        scheduleStab(t, inten);
      }

      music.step++;
      music.nextNoteTime += secPerStep;
    }
    music.timer = setTimeout(musicTick, 25);
  }
  function startMusic() {
    if (!actx || music.on) return;
    music.on = true;
    music.step = 0;
    music.nextNoteTime = actx.currentTime + 0.08;
    // 음악 볼륨 페이드 인
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

  // 시원한 boing: 피치 슬라이드 + 짧은 잔향. pan = 스테레오(눈 감고 모드용)
  function playBoing(freq, pan) {
    if (!actx || muted) return;
    const t = actx.currentTime;
    const osc = actx.createOscillator();
    const g = actx.createGain();
    const panner = actx.createStereoPanner ? actx.createStereoPanner() : null;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq * 0.55, t);
    osc.frequency.exponentialRampToValueAtTime(freq, t + 0.09);   // "띠요오옹" 슬라이드 업
    osc.frequency.exponentialRampToValueAtTime(freq * 0.92, t + 0.32);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);        // 짧은 잔향 꼬리
    let tail = g;
    if (panner) { panner.pan.value = Math.max(-1, Math.min(1, pan || 0)); g.connect(panner); tail = panner; }
    osc.connect(g); tail.connect(masterGain);
    osc.start(t); osc.stop(t + 0.45);
  }

  // 유리 깨짐: 화이트노이즈 버스트 + 고음 "챙—"
  function playGlassBreak() {
    if (!actx || muted) return;
    const t = actx.currentTime;
    // 챙
    const o = actx.createOscillator(); const og = actx.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(2300, t);
    o.frequency.exponentialRampToValueAtTime(1400, t + 0.25);
    og.gain.setValueAtTime(0.4, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    o.connect(og); og.connect(masterGain); o.start(t); o.stop(t + 0.5);
    // 파편 노이즈
    const len = Math.floor(actx.sampleRate * 0.3);
    const buf = actx.createBuffer(1, len, actx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = actx.createBufferSource(); src.buffer = buf;
    const ng = actx.createGain(); ng.gain.value = 0.25;
    const hp = actx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1800;
    src.connect(hp); hp.connect(ng); ng.connect(masterGain); src.start(t);
  }

  function playFlash() { // Zen 성공 플래시음
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

  // 30판 클리어 팡파레 (상행 아르페지오 + 빛나는 코드)
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
    // 마무리 풍성한 메이저 코드
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
    if (navigator.vibrate) { try { navigator.vibrate(pattern); } catch (e) { /* 미지원 graceful */ } }
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
    // 공이 많아질수록 살짝 작게(저글링 가독성). 화면 비율 기반.
    ballRadius = Math.max(18, Math.min(W, H) * 0.070);
    // 모든 공: 반지름 갱신 + 화면 비율 기반으로 위치 재배치(리사이즈/회전)
    if (state === STATE.PLAYING && prevW > 0 && prevH > 0) {
      for (const b of balls) {
        b.x = (b.x / prevW) * W;   // 가로 비율 유지
        b.y = (b.y / prevH) * H;   // 세로 비율 유지
        b.r = ballRadius;
        b.x = Math.max(b.r, Math.min(W - b.r, b.x));
        if (b.y < b.r) b.y = b.r;
      }
    } else {
      for (const b of balls) b.r = ballRadius;
    }
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 150));

  // ---------- 게임 흐름 ----------
  function zoneTop() {
    const zh = zoneH * H;
    return H - zh;
  }
  function recalcZone() {
    zoneH = zoneFracForStage(stage);
  }

  // 새 공이 화면 위에서 부드럽게 등장 (x 분산으로 기존 공과 겹치지 않게)
  function spawnBall() {
    // 기존 공들과 가장 멀리 떨어진 x 슬롯 고르기
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
    nb.entering = true;            // 살짝 미끄러져 들어오는 동안 중력 면제
    nb.spawnY = H * 0.18;
    balls.push(nb);
  }

  // 판이 5의 배수를 넘으면 공 개수를 목표치까지 맞춤(부드러운 등장)
  function reconcileBalls() {
    const want = ballsForStage(stage);
    while (balls.length < want) spawnBall();
  }

  function startGame() {
    ensureAudio();
    stage = 1; catchesInStage = 0; combo = 0; maxCombo = 0;
    slowFactor = 1; slowTimer = 0; zenActive = false; zenScored = false;
    masterMode = false; flashAlpha = 0; shake = 0;
    recalcZone();
    // 멀티볼 초기화: 1판은 공 1개
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
    elHud.classList.remove('hidden');
    elHud.setAttribute('aria-hidden', 'false');
    elBlindBanner.classList.toggle('hidden', !blindMode);
    updateHud();
    startMusic();
    lastTime = performance.now();
    if (!running) { running = true; requestAnimationFrame(loop); }
  }

  function gameOver() {
    state = STATE.GAMEOVER;
    stopMusic();
    if (stage > best) { best = stage; saveBest(); elNewRecord.classList.remove('hidden'); }
    else elNewRecord.classList.add('hidden');
    elFinalScore.textContent = stage;
    // 마스터모드면 "도달 판수"를 강조
    elGoBest.textContent = (masterMode ? '마스터 도달 ' : '최고 도달 ') + best + '판';
    elHud.classList.add('hidden');
    elHud.setAttribute('aria-hidden', 'true');
    elBlindBanner.classList.add('hidden');
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
    elHud.classList.add('hidden');
    elHud.setAttribute('aria-hidden', 'true');
    elBlindBanner.classList.add('hidden');
    elWin.classList.remove('hidden');
    spawnWinParticles();
    playFanfare();
    flashAlpha = 1;
    vibrate([40, 30, 40, 30, 40, 30, 120]);
  }

  // 마스터모드 진입: 클리어 화면에서 "계속하기" → 판 카운트 유지하며 무한 진행.
  function enterMasterMode() {
    masterMode = true;
    state = STATE.PLAYING;
    // zone은 최소 고정(zoneFracForStage 가 30 이상이면 ZONE_MIN_H 반환)
    recalcZone();
    // 현재 살아있는 공은 유지(클리어 시점 공 그대로) — 부족하면 채움
    reconcileBalls();
    flashAlpha = 0;
    elWin.classList.add('hidden');
    elGameover.classList.add('hidden');
    elHud.classList.remove('hidden');
    elHud.setAttribute('aria-hidden', 'false');
    elBlindBanner.classList.toggle('hidden', !blindMode);
    updateHud();
    startMusic();
    lastTime = performance.now();
  }

  function toMenu() {
    state = STATE.MENU;
    stopMusic();
    elGameover.classList.add('hidden');
    elWin.classList.add('hidden');
    elBlindBanner.classList.add('hidden');
    elMenu.classList.remove('hidden');
    elMenuBest.textContent = '최고 도달 ' + best + '판';
  }

  function updateHud() {
    elHudStage.textContent = stage;
    elHudCombo.textContent = combo;
    elHudBest.textContent = best;
    // 마스터모드는 "/ 30판" 대신 ∞ 표기
    if (elHudOf) elHudOf.textContent = masterMode ? ' MASTER' : ' / 30판';
  }

  // 어쩌면 Zen Drop 트리거 (30판 기준: 띠가 좁아지는 중반부터 가끔, 후반엔 거의 안 나오게)
  // 중반(8~22판)에 숨돌릴 슬로우모션 보너스. 후반·마스터모드엔 급박함 유지 위해 확률↓.
  function maybeZen() {
    if (zenActive) return;
    if (balls.some((b) => b.glass)) return;   // 유리화 중이면 보류
    if (stage < 5) return;
    // 멀티볼(공 2개 이상)에선 저글링 난도를 위해 Zen 빈도 더 낮춤
    const multi = balls.length > 1;
    let prob = stage <= 18 ? 0.16 : 0.07;     // 후반 갈수록 드물게
    if (masterMode) prob = 0.04;              // 마스터모드: 거의 안 나옴
    if (multi) prob *= 0.6;
    if (Math.random() < prob) {
      zenActive = true; zenScored = false;
      slowTimer = 2.6;
    }
  }

  // 콤보 음정 + 튕긴 높이 매핑한 피치
  function bouncePitch(b) {
    const baseIdx = Math.min(combo, PENTA.length - 1);
    const base = PENTA[baseIdx];
    // 튕긴 높이(공이 위로 올라갈 정도) → 미세 피치 ±
    const heightFactor = Math.min(1, Math.abs(b.vy) / 1500);
    return base * (1 + heightFactor * 0.18);
  }

  // 튕김 처리 (성공적으로 받음) — 받은 공 b 를 인자로
  function doBounce(b) {
    const power = 1000 + Math.min(stage * 5, 420) + (b.glass ? 120 : 0);
    b.vy = -power;
    b.vx += (Math.random() * 2 - 1) * 120;
    b.vx = Math.max(-380, Math.min(380, b.vx));
    b.sy = 1.5; b.sx = 0.65;   // stretch 위로

    combo += 1;
    if (combo > maxCombo) maxCombo = combo;

    const pan = (b.x / W) * 2 - 1;   // 스테레오 팬: 좌-1 ~ 우+1
    playBoing(bouncePitch(b), pan);

    // Zen 성공 보너스 → 한 판 더 진행
    const zenBonus = zenActive && !zenScored;
    if (zenBonus) {
      zenScored = true; flashAlpha = 0.85; playFlash();
      vibrate([20, 40, 20]);   // Zen 햅틱
      slowTimer = Math.min(slowTimer, 0.25);
    } else {
      vibrate(blindMode ? 30 : 15);   // 평타 햅틱
    }

    // 판 진행: 1캐치=+1판 (Zen 성공 시 한 판 더)
    catchesInStage += (zenBonus ? 2 : 1);
    while (catchesInStage >= CATCHES_PER_STAGE && (masterMode || stage < TOTAL_STAGES)) {
      catchesInStage -= CATCHES_PER_STAGE;
      stage += 1;
      // 일반 모드에서 30판째에 도달하면 즉시 클리어(추가 진행 멈춤)
      if (!masterMode && stage >= TOTAL_STAGES) break;
    }
    recalcZone();
    reconcileBalls();   // 5의 배수 넘으면 공 +1 (부드러운 등장)
    updateHud();

    // 30판 도달 → 클리어 (마스터모드 진입 흐름은 winGame 화면에서)
    if (!masterMode && stage >= TOTAL_STAGES) { winGame(); return; }

    // 유리화: 판 기반 — 10판마다 한 번 보너스(받은 공만 유리화, 받기 쉬운 강타).
    if (stage % 10 === 0 && !b.glass && combo >= 3) {
      b.glass = true; b.glassTimer = 1.2;
      spawnShards(b);
      playGlassBreak();
      shake = 10;
      vibrate([40, 30, 40, 30, 60]); // 유리화 햅틱(강)
      combo = 0;   // 콤보 리셋
      updateHud();
    } else {
      maybeZen();
    }
  }

  function spawnShards(b) {
    for (let i = 0; i < 22; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 120 + Math.random() * 360;
      particles.push({
        x: b.x, y: b.y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120,
        life: 0.7 + Math.random() * 0.4, age: 0,
        size: 3 + Math.random() * 6, rot: Math.random() * Math.PI,
      });
    }
  }

  // 클리어 축하 파티클 (화면 하단에서 솟구치는 컨페티)
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

  // ---------- 입력 (멀티터치: 각 손가락이 가장 가까운 공 1개 처리) ----------
  // 한 점(px,py)으로 가장 가까운 받을 수 있는 공을 찾아 튕김. 이미 처리한 공은 hitSet 으로 중복 방지.
  function tryHit(px, py, hitSet) {
    if (state !== STATE.PLAYING) return;
    const inZone = py >= zoneTop();
    if (!inZone) return;
    let target = null, bestD = Infinity;
    for (const b of balls) {
      if (b.entering) continue;            // 등장 중인 공은 아직 못 받음
      if (hitSet && hitSet.has(b.id)) continue;
      if (b.vy < -80) continue;            // 내려오는/거의 정점일 때만
      const d = Math.hypot(px - b.x, py - b.y);
      const hitR = b.r + 36;
      // 눈 감고 모드: 띠 안이면 관대하게(가장 가까운 공)
      if (d < hitR || blindMode) {
        if (d < bestD) { bestD = d; target = b; }
      }
    }
    if (target) {
      if (hitSet) hitSet.add(target.id);
      doBounce(target);
    }
  }

  // 이벤트에서 모든 포인터 좌표를 캔버스 좌표로 변환해 배열로 반환
  function pointsFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    const pts = [];
    if (e.touches || e.changedTouches) {
      const list = e.changedTouches && e.changedTouches.length ? e.changedTouches : e.touches;
      for (let i = 0; i < list.length; i++) {
        pts.push({ x: list[i].clientX - rect.left, y: list[i].clientY - rect.top });
      }
    } else {
      pts.push({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
    return pts;
  }

  function onPointer(e) {
    ensureAudio();
    if (state !== STATE.PLAYING) return;
    e.preventDefault();
    const pts = pointsFromEvent(e);
    const hitSet = new Set();   // 한 제스처에서 같은 공을 두 손가락이 중복 처리 방지
    for (const p of pts) tryHit(p.x, p.y, hitSet);
  }
  canvas.addEventListener('touchstart', onPointer, { passive: false });
  canvas.addEventListener('mousedown', onPointer);

  // ---------- 업데이트 ----------
  function update(dt) {
    // 슬로우모션
    if (slowTimer > 0) {
      slowTimer -= dt;
      slowFactor = 0.34;
      if (slowTimer <= 0) { slowFactor = 1; zenActive = false; zenScored = false; }
    } else slowFactor = 1;

    const sdt = dt * slowFactor;

    let fell = false;   // 아무 공이나 바닥으로 떨어지면 게임오버(저글링 룰)
    for (const b of balls) {
      if (b.entering) {
        // 화면 위에서 spawnY 까지 부드럽게 미끄러져 진입(중력 면제)
        b.x += b.vx * sdt;
        b.y += (b.spawnY - b.y) * Math.min(1, dt * 4) + 260 * sdt;   // 위에서 아래로 흘러내림
        if (b.y >= b.spawnY) { b.entering = false; b.vy = 0; }
        // 진입 중 좌우 벽 클램프
        if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx); }
        if (b.x > W - b.r) { b.x = W - b.r; b.vx = -Math.abs(b.vx); }
      } else {
        b.vy += GRAVITY * sdt;
        b.x += b.vx * sdt;
        b.y += b.vy * sdt;

        // 좌우 벽 반사
        if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx) * 0.8; }
        if (b.x > W - b.r) { b.x = W - b.r; b.vx = -Math.abs(b.vx) * 0.8; }

        // 바닥 = 게임오버 (공 하나라도 영역 아래로 떨어지면)
        if (b.y - b.r > H) fell = true;
      }

      // squash & stretch 회복
      b.sx += (1 - b.sx) * Math.min(1, dt * 9);
      b.sy += (1 - b.sy) * Math.min(1, dt * 9);
      b.spinPhase += b.vx * sdt * 0.01;

      // trail
      b.trail.push({ x: b.x, y: b.y, r: b.r });
      if (b.trail.length > 10) b.trail.shift();

      // 유리화 타이머(공별)
      if (b.glass) { b.glassTimer -= dt; if (b.glassTimer <= 0) b.glass = false; }
    }

    // 파티클
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.age += dt;
      p.vy += GRAVITY * 0.5 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += dt * 6;
      if (p.age >= p.life) particles.splice(i, 1);
    }

    // 플래시·셰이크 감쇠
    flashAlpha *= Math.max(0, 1 - dt * 4);
    shake *= Math.max(0, 1 - dt * 8);

    // 바닥 = 게임오버 (어떤 공이든 떨어지면)
    if (fell) gameOver();
  }

  // 클리어 화면 파티클·플래시 갱신
  function updateWin(dt) {
    flashAlpha *= Math.max(0, 1 - dt * 3);
    for (let i = winParticles.length - 1; i >= 0; i--) {
      const p = winParticles[i];
      p.age += dt;
      p.vy += GRAVITY * 0.35 * dt;
      p.vx *= (1 - dt * 0.6);
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += dt * 5;
      if (p.age >= p.life) winParticles.splice(i, 1);
    }
  }

  // ---------- 렌더 ----------
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

  function drawBalls() {
    for (const b of balls) drawOneBall(b);
  }

  function drawOneBall(b) {
    const x = b.x, y = b.y, r = b.r;
    const frozen = b.glass;
    // 잔상
    for (let i = 0; i < b.trail.length; i++) {
      const t = b.trail[i];
      const a = (i / b.trail.length) * 0.22;
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r * (0.6 + i / b.trail.length * 0.4), 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(213,58,107,' + a.toFixed(3) + ')';
      ctx.fill();
    }

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(b.sx, b.sy);

    // 본체: 라디얼 그라데이션(유리/굴절)
    const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r);
    if (frozen) {
      grad.addColorStop(0, 'rgba(220,240,255,0.95)');
      grad.addColorStop(0.5, 'rgba(150,190,230,0.55)');
      grad.addColorStop(1, 'rgba(80,110,160,0.35)');
    } else {
      grad.addColorStop(0, 'rgba(255,255,255,0.92)');
      grad.addColorStop(0.35, hexToRgba(COL.refractFrom, 0.55));
      grad.addColorStop(0.75, hexToRgba(COL.refractTo, 0.45));
      grad.addColorStop(1, hexToRgba(COL.refractTo, 0.12));
    }
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = grad; ctx.fill();

    // 굴절 림 (가장자리 밝은 테)
    ctx.lineWidth = Math.max(1.5, r * 0.06);
    ctx.strokeStyle = SHADE.glassFaint;
    ctx.stroke();

    // 내부 굴절 보라→분홍 코어
    const core = ctx.createLinearGradient(-r * 0.4, -r * 0.4, r * 0.4, r * 0.5);
    core.addColorStop(0, hexToRgba(COL.refractFrom, frozen ? 0.15 : 0.5));
    core.addColorStop(1, hexToRgba(COL.refractTo, frozen ? 0.12 : 0.4));
    ctx.beginPath(); ctx.arc(Math.cos(b.spinPhase) * r * 0.15, r * 0.12, r * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = core; ctx.fill();

    // 하이라이트
    ctx.beginPath();
    ctx.ellipse(-r * 0.32, -r * 0.4, r * 0.26, r * 0.16, -0.5, 0, Math.PI * 2);
    ctx.fillStyle = SHADE.glassEdge; ctx.fill();

    ctx.restore();
  }

  function drawParticles() {
    for (const p of particles) {
      const a = 1 - p.age / p.life;
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(p.rot);
      ctx.globalAlpha = a;
      ctx.fillStyle = SHADE.shard;
      ctx.beginPath();
      ctx.moveTo(0, -p.size); ctx.lineTo(p.size * 0.7, p.size * 0.5); ctx.lineTo(-p.size * 0.6, p.size * 0.5);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  // 떠오르는 콤보 음표/숫자
  function drawComboFloat() {
    if (combo <= 0 || balls.length === 0) return;
    // 가장 높이 떠 있는 공 위에 표시(가장 눈에 띔)
    let anchor = balls[0];
    for (const b of balls) if (b.y < anchor.y) anchor = b;
    ctx.save();
    const pulse = 1 + Math.sin(performance.now() / 220) * 0.05;
    ctx.translate(anchor.x, anchor.y - anchor.r - 40);
    ctx.scale(pulse, pulse);
    ctx.font = '800 ' + Math.round(anchor.r * 1.1) + 'px ' + COL_FONT;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = COL.secondary;
    ctx.shadowColor = hexToRgba(COL.secondary, 0.6); ctx.shadowBlur = 18;
    ctx.fillText('♪' + combo, 0, 0);
    ctx.restore();
  }
  const COL_FONT = "'Pretendard Variable', -apple-system, sans-serif";

  function render() {
    ctx.save();
    if (shake > 0.5) ctx.translate((Math.random() * 2 - 1) * shake, (Math.random() * 2 - 1) * shake);

    // 배경
    ctx.fillStyle = COL.bg;
    ctx.fillRect(-20, -20, W + 40, H + 40);

    if (state === STATE.PLAYING) {
      // 눈 감고 모드: 화면 검게 (공·띠 숨김)
      if (blindMode) {
        ctx.fillStyle = '#000';
        ctx.fillRect(-20, -20, W + 40, H + 40);
      } else {
        drawZone();
        drawParticles();
        drawBalls();
        drawComboFloat();
      }
      // Zen 디밍
      if (slowFactor < 1) {
        ctx.fillStyle = SHADE.zenDim;
        ctx.fillRect(-20, -20, W + 40, H + 40);
        if (!blindMode) { drawBalls(); drawComboFloat(); }
      }
      // Zen 성공 플래시
      if (flashAlpha > 0.01) {
        ctx.fillStyle = 'rgba(255,255,255,' + flashAlpha.toFixed(3) + ')';
        ctx.fillRect(-20, -20, W + 40, H + 40);
      }
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
    if (dt > MAX_DT) dt = MAX_DT;   // 백그라운드 복귀 폭주 clamp
    if (state === STATE.PLAYING) update(dt);
    else if (state === STATE.WIN) updateWin(dt);
    render();
    requestAnimationFrame(loop);
  }

  // ---------- 색 유틸 ----------
  function hexToRgba(hex, a) {
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  // ---------- 공유 카드 ----------
  async function shareResult() {
    const cw = 600, ch = 800;
    const cv = document.createElement('canvas');
    cv.width = cw; cv.height = ch;
    const c = cv.getContext('2d');
    // 배경 그라데이션
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
      try {
        await navigator.share({ files: [file], title: '튕기기', text: stage + '판 도달!' });
        return;
      } catch (e) { /* 취소/실패 → 폴백 */ }
    }
    // 폴백: 다운로드
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'pung-score.png';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
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

  // 백그라운드: 시간 기준 리셋 + 오디오 일시정지(배터리·스케줄 폭주 방지)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (actx && actx.state === 'running') { try { actx.suspend(); } catch (e) { /* 미지원 무시 */ } }
    } else {
      lastTime = performance.now();
      if (actx && actx.state === 'suspended') { try { actx.resume(); } catch (e) { /* 미지원 무시 */ } }
      // 음악 스케줄러 시점이 정지 중 어긋났으면 현재 시각으로 복구
      if (music.on && actx && music.nextNoteTime < actx.currentTime) {
        music.nextNoteTime = actx.currentTime + 0.05;
      }
    }
  });

  // 첫 제스처에 AudioContext resume
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
