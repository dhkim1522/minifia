// 로컬 Vite 서버의 실제 맵·좌석 모델로 홈 장면을 굽는다. 런타임에서는 WebP 한 장만 읽는다.
// node scripts/render-entry-scene.mjs http://127.0.0.1:5173 && node scripts/make-og.mjs
import { existsSync } from "node:fs";
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
    const { createCharacter, figForSeat } = await import("/src/world/character.ts");
    const { LADDER } = await import("/src/world/renderer.ts");
    const bar = buildBarScene(LADDER[0]);
    bar.setLighting("night");
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setSize(1200, 1800, false);

    // 재즈 바 뒤쪽 펜던트 아래의 두 의자와 램프를 그대로 사용한다.
    const tableX = -2.4, tableZ = -4.6;
    const subjects = [];
    function place(seat, x, z, angle, seated) {
      const actor = createCharacter(figForSeat(seat), "coat");
      actor.root.position.set(tableX + x, seated ? 0.14 : 0, tableZ + z);
      actor.root.rotation.y = angle;
      if (seated) {
        for (const leg of ["legA", "legB"]) actor.root.getObjectByName(leg).rotation.x = -1.13;
        for (const child of actor.root.children) if (child.isMesh) child.visible = false;
      }
      bar.root.add(actor.root);
      subjects.push(actor);
      return actor.root;
    }
    const left = place(3, -0.71, 0.37, 0.9, true);
    left.getObjectByName("neck").rotation.y = 0.08;
    const speaker = place(5, -0.62, -1.16, 0.13, false);
    speaker.getObjectByName("armA").rotation.x = -0.54;
    const right = place(1, 0.71, -0.37, -0.33, true);
    right.getObjectByName("neck").rotation.z = -0.07;

    // 램프의 빛이 큰 얼굴에서도 읽히게 촬영용 조명을 맵의 실광원과 같은 자리에 둔다.
    bar.lights.hemi.intensity *= 0.75;
    bar.lights.stage.intensity *= 0.5;
    const key = new THREE.PointLight("#ffc080", 1.6, 3);
    key.position.set(tableX, 1.15, tableZ + 0.28);
    const fill = new THREE.DirectionalLight("#c1d6fc", 0.88);
    fill.position.set(0.7, 2, 4);
    bar.root.add(key, fill);

    const camera = new THREE.PerspectiveCamera(38, 2 / 3, 0.1, 50);
    camera.position.set(tableX + 3.98, 4.86, tableZ + 7.65);
    camera.lookAt(tableX, 0.99, tableZ);
    renderer.render(bar.root, camera);
    const result = renderer.domElement.toDataURL();
    for (const subject of subjects) subject.dispose();
    bar.dispose();
    renderer.dispose();
    return result;
  });
  const output = fileURLToPath(new URL("../public/backgrounds/noir-entry.webp", import.meta.url));
  await sharp(Buffer.from(png.split(",")[1], "base64")).resize(900, 1350).webp({ quality: 86, effort: 6 }).toFile(output);
} finally {
  await browser.close();
}
