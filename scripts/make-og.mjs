// 임시 OG 이미지(카카오톡 등 메신저 링크 미리보기) 생성기.
//
// *** 임시 그림이다. *** 정식 이미지는 클로드 데스크톱에서 만들어 public/og.png 를 바꾼다
// (정식 출시 마일스톤. 정식 이름·주소가 정해질 때 함께). 카카오 캐시(약 1시간)는 카카오 공유 디버거로 초기화한다.
//
// 패키지 없이 node:fs·node:zlib 만으로 1200×630 RGB PNG 를 쓴다. 한글 글꼴 래스터라이저가 없으므로
// '미니피아' 는 직선·원으로 이루어진 자모(ㅁ ㅣ ㄴ ㅍ ㅇ ㅏ)를 도형으로 그린다.
// 색은 design/tokens.json 의 night-900(바탕)·gray-50(글자) 두 가지만 읽는다 — 진홍은 장식에 쓰지 않는다.
// 출력은 결정적이다(같은 입력 → 같은 바이트).
//
// 사용법: node scripts/make-og.mjs   → public/og.png
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const root = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const W = 1200;
const H = 630;
const T = 22; // 획 두께

function tokenColor(name) {
  const tokens = JSON.parse(readFileSync(root("design/tokens.json"), "utf8")).color.tokens;
  const t = tokens.find((x) => x.name === name);
  if (!t || !/^#[0-9a-f]{6}$/i.test(t.value)) throw new Error(`design/tokens.json 에서 ${name} 색을 읽을 수 없음`);
  const n = parseInt(t.value.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const BG = tokenColor("night-900");
const FG = tokenColor("gray-50");

const pixels = new Uint8Array(W * H * 3);
for (let i = 0; i < W * H; i++) pixels.set(BG, i * 3);

function rect(x, y, w, h) {
  for (let yy = Math.max(0, y); yy < Math.min(H, y + h); yy++) {
    for (let xx = Math.max(0, x); xx < Math.min(W, x + w); xx++) pixels.set(FG, (yy * W + xx) * 3);
  }
}

function ring(cx, cy, outer, inner) {
  for (let yy = Math.max(0, cy - outer); yy <= Math.min(H - 1, cy + outer); yy++) {
    for (let xx = Math.max(0, cx - outer); xx <= Math.min(W - 1, cx + outer); xx++) {
      const d2 = (xx - cx) ** 2 + (yy - cy) ** 2;
      if (d2 <= outer * outer && d2 >= inner * inner) pixels.set(FG, (yy * W + xx) * 3);
    }
  }
}

// 글자 칸 높이 140. (x0, y0) 는 칸의 왼쪽 위. 각 함수는 그린 칸의 폭을 돌려준다.
const VOWEL_X = 92;
function vowelI(x0, y0) { rect(x0 + VOWEL_X, y0, T, 140); }
function mieum(x0, y0) { // ㅁ
  rect(x0, y0 + 30, 78, T);
  rect(x0, y0 + 88, 78, T);
  rect(x0, y0 + 30, T, 80);
  rect(x0 + 56, y0 + 30, T, 80);
}
function nieun(x0, y0) { // ㄴ
  rect(x0, y0 + 20, T, 100);
  rect(x0, y0 + 98, 78, T);
}
function pieup(x0, y0) { // ㅍ
  rect(x0, y0 + 25, 78, T);
  rect(x0, y0 + 93, 78, T);
  rect(x0 + 12, y0 + 47, T, 46);
  rect(x0 + 44, y0 + 47, T, 46);
}
function ieung(x0, y0) { ring(x0 + 40, y0 + 70, 40, 40 - T); } // ㅇ
function vowelA(x0, y0) { // ㅏ
  rect(x0 + VOWEL_X, y0, T, 140);
  rect(x0 + VOWEL_X + T, y0 + 59, 26, T);
}

const syllables = [
  { w: 114, draw: (x, y) => { mieum(x, y); vowelI(x, y); } }, // 미
  { w: 114, draw: (x, y) => { nieun(x, y); vowelI(x, y); } }, // 니
  { w: 114, draw: (x, y) => { pieup(x, y); vowelI(x, y); } }, // 피
  { w: 140, draw: (x, y) => { ieung(x, y); vowelA(x, y); } }, // 아
];
const GAP = 30;
const totalW = syllables.reduce((s, c) => s + c.w, 0) + GAP * (syllables.length - 1);
let cursor = Math.round((W - totalW) / 2);
const top = Math.round((H - 140) / 2);
for (const s of syllables) {
  s.draw(cursor, top);
  cursor += s.w + GAP;
}

// ---- PNG 인코딩: 서명 + IHDR + IDAT + IEND ----
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  crcTable[n] = c >>> 0;
}
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const typeAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([len, typeAndData, crc]);
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; // 비트 깊이
ihdr[9] = 2; // RGB
const raw = Buffer.alloc((W * 3 + 1) * H);
for (let y = 0; y < H; y++) {
  raw[y * (W * 3 + 1)] = 0; // 필터 바이트 0
  Buffer.from(pixels.buffer, y * W * 3, W * 3).copy(raw, y * (W * 3 + 1) + 1);
}
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw, { level: 9 })),
  chunk("IEND", Buffer.alloc(0)),
]);
writeFileSync(root("public/og.png"), png);
console.log(`public/og.png ${W}x${H} ${png.length} bytes`);
