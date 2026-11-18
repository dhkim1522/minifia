// 공개 배지·아이콘·일지 장식을 B안의 같은 선과 팔레트로 내보낸다.
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const save = (path, body) => writeFile(root(`public/${path}`), body);

const signet = (radius, size = 1024) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="${size}" height="${size}">
  <defs>
    <linearGradient id="panel" x2="0" y2="1"><stop stop-color="#263b56"/><stop offset="1" stop-color="#101a2a"/></linearGradient>
    <linearGradient id="moon" x2="1" y2="1"><stop stop-color="#f7e6c7"/><stop offset="1" stop-color="#bc9464"/></linearGradient>
  </defs>
  <rect width="128" height="128" rx="${radius}" fill="#10192b"/>
  <path d="M64 16 105 39v49l-41 24-41-24V39Z" fill="url(#panel)" stroke="#b8966b" stroke-width="2"/>
  <path d="M64 21 100 42v43l-36 21-36-21V42Z" fill="none" stroke="#8096b4" stroke-width="1"/>
  <path d="M42 73c2-17 10-27 17-27 2 0 4 2 5 4 1-2 3-4 5-4 7 0 15 10 17 27Z" fill="url(#moon)"/>
  <path d="M44 69c10 2 30 2 40 0l2 6c-12 3-32 3-44 0Z" fill="#8f5650"/>
  <path d="M32 81c10-8 53-8 64 0-12 9-51 9-64 0Z" fill="url(#moon)"/>
  <path d="M64 29v10m-5-5h10m-32 8v12m-6-6h12m47-6v12m-6-6h12" fill="none" stroke="#bccded" stroke-width="1.6" stroke-linecap="round"/>
</svg>\n`;
await save("favicon.svg", signet(27));
for (const [name, size, opaque] of [
  ["favicon-32.png", 32, false],
  ["apple-touch-icon.png", 180, true],
  ["icon-192.png", 192, false],
  ["icon-512.png", 512, false],
  ["icon-maskable-512.png", 512, true],
]) {
  const graphic = sharp(Buffer.from(signet(opaque ? 0 : 27, size)));
  await save(name, await (opaque ? graphic.removeAlpha() : graphic).png({ palette: true }).toBuffer());
}

await save("characters/host/host_badge.svg", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96">
  <path d="M48 3 87 25v46L48 93 9 71V25Z" fill="#172536" stroke="#bc9464" stroke-width="4"/>
  <path d="m24 33 12 10 12-16 12 16 12-10-5 29H29Z" fill="#e8c38f"/>
  <path d="M29 62h38v7H29Z" fill="#a4774b"/>
  <path d="m48 44 5 6-5 6-5-6Z" fill="#206080"/>
</svg>\n`);

const journals = {
  police: { color: "#9ec2ff", icon: '<circle cx="10" cy="10" r="5.5"/><path d="m14 14 6 6M8 8l2-1"/>', cover: '<circle cx="309" cy="20" r="5.5"/><path d="M313 24L319 30 M307 18L309 17"/>' },
  mafia: { color: "#f2556a", icon: '<path d="M3 16c3-3 15-3 18 0-4 4-14 4-18 0Zm4-2 1-6 4 2 4-2 1 6M12 10v4"/>', cover: '<path d="M302 26 C305 23 317 23 320 26 C316 30 306 30 302 26 Z M306 24 L307 18 L311 20 L315 18 L316 24 M311 20 V24"/>' },
  doctor: { color: "#8fd0bf", icon: '<path d="M9 4h6v5h5v6h-5v5H9v-5H4V9h5Z"/>', cover: '<path d="M308 14 H314 V19 H319 V25 H314 V30 H308 V25 H303 V19 H308 Z"/>' },
};
for (const [role, { color, icon, cover }] of Object.entries(journals)) {
  const base = `xmlns="http://www.w3.org/2000/svg" fill="none" stroke="${color}"`;
  const round = 'stroke-linecap="round" stroke-linejoin="round"';
  await save(`journals/journal_${role}_icon.svg`, `<svg ${base} viewBox="0 0 24 24" width="24" height="24" stroke-width="2" ${round}>${icon}</svg>\n`);
  await save(`journals/journal_${role}_cover.svg`, `<svg ${base} viewBox="0 0 358 44" width="358" height="44" preserveAspectRatio="xMaxYMid slice" stroke-opacity=".46" ${round}>
    <path d="M222 41 H347 L354 34 V10 L347 3 H222 M232 37 H344 L350 31 V13 L344 7 H232"/>
    <path d="M264 11 V33 M269 15 V29 M274 19 V25 M279 22 H294 M327 22 H343 M264 23 L259 27 L254 23 L259 19 Z"/>
    <g stroke-width="1.6">${cover}</g>
  </svg>\n`);
  await save(`journals/journal_${role}_page.svg`, `<svg ${base} viewBox="0 0 8 52" preserveAspectRatio="none" stroke-opacity=".12">
    <path d="M0 49.5 H8 M0 51.5 H8" vector-effect="non-scaling-stroke"/>
  </svg>\n`);
}
