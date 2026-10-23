// 링크 미리보기(OG) 이미지 생성기: 입장 배경 + 인물 4명 + 'Minifia' 제목 → public/og.png (1200×630).
//
// 글자는 Gowun Dodum(OFL)에서 이 이미지에 필요한 글자만 뽑은 design/fonts/GowunDodum-og-subset.ttf 로 그린다.
// 문구를 바꾸면 부분 폰트에 없는 글자는 빈칸이 되니 pyftsubset 으로 다시 뽑는다(design/fonts/README.md).
// 카카오 캐시(약 1시간)는 이미지를 바꾼 뒤 카카오 공유 디버거로 초기화한다.
//
// 사용법: node scripts/make-og.mjs   → public/og.png
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const W = 1200;
const H = 630;
const FONT = root("design/fonts/GowunDodum-og-subset.ttf");
const FONT_FAMILY = "Gowun Dodum";

// 입장 배경(SVG)을 1200×630 으로 채우고 위아래를 어둡게 가린다(제목·인물이 읽히도록).
const background = await sharp(root("public/backgrounds/bg_entry_lobby.svg"), { density: 144 })
  .resize(W, H, { fit: "cover", position: "centre" })
  .png()
  .toBuffer();

const veil = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs><linearGradient id="v" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#0a0e1c" stop-opacity="0.55"/>
      <stop offset="0.6" stop-color="#0a0e1c" stop-opacity="0.25"/>
      <stop offset="1" stop-color="#0a0e1c" stop-opacity="0.55"/>
    </linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#v)"/>
  </svg>`,
);

// Pango 로 글자 이미지를 만든다. 그림자는 같은 글자를 검게 아래로 조금 내려 깐다.
async function text(content, size, rgba, extra = {}) {
  return sharp({
    text: {
      text: `<span font_family="${FONT_FAMILY}" foreground="${rgba}" font_size="${size * 1024}">${content}</span>`,
      font: FONT_FAMILY,
      fontfile: FONT,
      rgba: true,
      ...extra,
    },
  })
    .png()
    .toBuffer();
}

// 글자 이미지를 가로 가운데에 놓는다.
async function centered(input, top) {
  const { width } = await sharp(input).metadata();
  return { input, left: Math.round((W - width) / 2), top };
}

const title = await text("Minifia", 168, "#f1f2f5");
const titleShadow = await text("Minifia", 168, "#000000");
const sub = await text("친구들과 5분 만에 한 판, 마피아 게임", 44, "#e6e8ee");
const subShadow = await text("친구들과 5분 만에 한 판, 마피아 게임", 44, "#000000");

async function figure(id, width) {
  return sharp(root(`public/characters/table/${id}_default@4x.png`)).resize({ width }).png().toBuffer();
}
// 왼쪽부터 fig1, fig7, fig4, fig6. 가운데 둘이 조금 크고 아래로 더 내려간다(시안 A).
const figs = [
  { id: "fig1_boy_brown", w: 192, x: 224, bottom: -12 },
  { id: "fig7_boy_blackhat", w: 200, x: 424, bottom: -28 },
  { id: "fig4_girl_brown", w: 200, x: 636, bottom: -28 },
  { id: "fig6_girl_auburn", w: 192, x: 840, bottom: -12 },
];
const figLayers = [];
for (const f of figs) {
  const input = await figure(f.id, f.w);
  const meta = await sharp(input).metadata();
  figLayers.push({ input, left: f.x, top: H - meta.height - f.bottom });
}

const out = await sharp(background)
  .composite([
    { input: veil, left: 0, top: 0 },
    ...figLayers,
    await centered(titleShadow, 108),
    await centered(title, 100),
    await centered(subShadow, 322),
    await centered(sub, 320),
  ])
  .png()
  .toBuffer();

await sharp(out).toFile(root("public/og.png"));
console.log(`public/og.png ${W}×${H} ${out.length} bytes`);
