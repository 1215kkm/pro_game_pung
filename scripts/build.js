#!/usr/bin/env node
/* build.js — 무의존 번들러.
 * index.html 을 읽어 styles/tokens.css 링크를 인라인 <style> 로,
 * game.js 스크립트 링크를 인라인 <script> 로 치환해 docs/play.html 생성.
 * 정적 호스팅(Pages)에서 단일 파일로 배포 가능한 자립 번들.
 *
 * 사용: node scripts/build.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const INDEX = path.join(ROOT, 'index.html');
const TOKENS = path.join(ROOT, 'styles', 'tokens.css');
const GAMEJS = path.join(ROOT, 'game.js');
const OUT = path.join(ROOT, 'docs', 'play.html');

function read(p) { return fs.readFileSync(p, 'utf8'); }

let html = read(INDEX);
const css = read(TOKENS);
const js = read(GAMEJS);

// 1) tokens.css <link> → 인라인 <style>
const linkRe = /<link\s+rel=["']stylesheet["']\s+href=["']styles\/tokens\.css["']\s*\/?>/i;
if (!linkRe.test(html)) {
  console.error('경고: index.html 에서 tokens.css <link> 를 찾지 못함.');
} else {
  html = html.replace(linkRe, '<style>\n/* inlined from styles/tokens.css */\n' + css + '\n</style>');
}

// 2) game.js <script src> → 인라인 <script>
const scriptRe = /<script\s+src=["']game\.js["']\s*>\s*<\/script>/i;
if (!scriptRe.test(html)) {
  console.error('경고: index.html 에서 game.js <script> 를 찾지 못함.');
} else {
  html = html.replace(scriptRe, '<script>\n/* inlined from game.js */\n' + js + '\n</script>');
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html, 'utf8');

// 3) 외부참조 잔존 검사
const stillHasCssLink = /href=["']styles\/tokens\.css["']/.test(html);
const stillHasJsSrc = /src=["']game\.js["']/.test(html);
if (stillHasCssLink || stillHasJsSrc) {
  console.error('실패: 외부참조가 남아 있음 — tokens.css:' + stillHasCssLink + ' game.js:' + stillHasJsSrc);
  process.exit(1);
}

console.log('OK: docs/play.html 생성 (' + html.length + ' bytes, 외부참조 0)');
