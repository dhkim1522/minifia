// 로컬 Vite 서버의 실제 맵·동물 모델로 홈 장면을 굽는다. 런타임에서는 WebP 한 장만 읽는다.
// node scripts/render-entry-scene.mjs http://127.0.0.1:5173 && node scripts/make-og.mjs
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import sharp from "sharp";
import { findChrome } from "./e2e/lib.mjs";

const origin = new URL(process.argv[2] ?? "http://127.0.0.1:5173");
if (!["localhost", "127.0.0.1"].includes(origin.hostname)) throw new Error("로컬 개발 서버 주소가 필요합니다.");
const browser = await chromium.launch({ executablePath: findChrome(process.platform, process.env, existsSync), headless: true });
try {
  const page = await browser.newPage();
  const entry = new URL("/__entry-composition", origin).href;
  await page.route(entry, route => route.fulfill({ contentType: "text/html", body: "<!doctype html>" }));
  await page.goto(entry);
  const png = await page.evaluate(async () => {
    const THREE = await import("/node_modules/three/build/three.module.js");
    const { buildBarScene } = await import("/src/world/maps/bar.ts");
    const { createSeatedBarArt } = await import("/src/world/barAssets/seated-bar.ts");
    const { createCharacter } = await import("/src/world/character.ts");
    const { LADDER } = await import("/src/world/renderer.ts");
    const { BAR_SEAT_HEIGHT, BAR_SEATS_FX, UNIT } = await import("/shared/game/map.ts");
    const bar = buildBarScene(LADDER[0], { compact: true, omitCenterSeats: true });
    await bar.woodReady;
    const seated = createSeatedBarArt(bar);
    bar.setCenterTable(true);
    bar.setLighting("talk");
    seated.setConversationLighting(true);
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setSize(1200, 1800, false);

    const subjects = [];
    // 홈의 세 인물은 실제 바의 맞은편 세 좌석에 앉는다.
    function place(animal, outfit, seat, gaze) {
      const actor = createCharacter(0, outfit, undefined, animal);
      const [x, z] = BAR_SEATS_FX[seat];
      actor.root.position.set(x / UNIT, BAR_SEAT_HEIGHT - 0.30, z / UNIT);
      actor.setYaw(Math.atan2(-x, -z));
      actor.setSeated(true, false);
      actor.setGaze(gaze, 0);
      actor.update(0, 0, false);
      bar.root.add(actor.root);
      subjects.push(actor);
    }
    place("rabbit", "mafia", 6, -0.33);
    place("fox", "coat", 2, 0.12);
    place("elephant", "coat", 7, 0.24);

    const fill = new THREE.DirectionalLight("#c1d6fc", 0.62);
    fill.position.set(0.3, 2, 4);
    bar.root.add(fill);

    // 좁은 휴대폰이 그림 양쪽을 잘라도 세 얼굴과 중앙 램프가 남는다.
    const camera = new THREE.PerspectiveCamera(107, 2 / 3, 0.1, 50);
    camera.position.set(0, 1.63, 2.32);
    camera.lookAt(0.08, 1.14, -1.06);
    renderer.render(bar.root, camera);
    const result = renderer.domElement.toDataURL();
    for (const subject of subjects) subject.dispose();
    bar.dispose();
    renderer.dispose();
    return result;
  });
  const output = fileURLToPath(new URL("../public/backgrounds/noir-entry.webp", import.meta.url));
  const source = sharp(Buffer.from(png.split(",")[1], "base64")).resize(900, 1350);
  let bytes;
  for (const quality of [86, 80, 74]) {
    bytes = await source.clone().webp({ quality, effort: 6 }).toBuffer();
    if (bytes.length <= 96 * 1024) break;
  }
  if (bytes.length > 96 * 1024) throw new Error(`홈 배경이 96KiB를 넘었습니다 (${bytes.length}B).`);
  await writeFile(output, bytes);
} finally {
  await browser.close();
}
