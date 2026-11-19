// 로컬 Vite 서버의 실제 맵·동물 모델로 홈 장면을 굽는다. 런타임에서는 WebP 한 장만 읽는다.
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
    const { createCharacter } = await import("/src/world/character.ts");
    const { LADDER } = await import("/src/world/renderer.ts");
    // 실제 재즈 바의 중앙 스탠드를 둘러싼 세 캐릭터를 홈 화면에 담는다.
    const tableX = 0, tableZ = 0;
    const bar = buildBarScene(LADDER[0], { compact: true, omitCenterSeats: true });
    await bar.woodReady;
    bar.setLighting("night");
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setSize(1200, 1800, false);

    const subjects = [];
    function place(animal, outfit, x, z, angle) {
      const actor = createCharacter(0, outfit, undefined, animal);
      actor.root.position.set(tableX + x, 0, tableZ + z);
      actor.root.rotation.y = angle;
      bar.root.add(actor.root);
      subjects.push(actor);
      return actor.root;
    }
    const left = place("rabbit", "mafia", -1.10, 0.93, 0.88);
    left.getObjectByName("neck").rotation.y = 0.08;
    const speaker = place("fox", "coat", -0.48, -1.10, 0.20);
    speaker.getObjectByName("armA").rotation.x = -0.54;
    const right = place("elephant", "coat", 1.21, 0.10, -0.43);
    right.getObjectByName("neck").rotation.z = -0.07;

    // 램프의 빛이 큰 얼굴에서도 읽히게 촬영용 조명을 맵의 실광원과 같은 자리에 둔다.
    bar.lights.hemi.intensity *= 0.75;
    bar.lights.stage.intensity *= 0.5;
    const key = new THREE.PointLight("#ffc080", 1.6, 3);
    key.position.set(tableX, 1.15, tableZ + 0.28);
    const fill = new THREE.DirectionalLight("#c1d6fc", 0.88);
    fill.position.set(0.7, 2, 4);
    bar.root.add(key, fill);

    const camera = new THREE.PerspectiveCamera(39, 2 / 3, 0.1, 50);
    camera.position.set(tableX + 4.04, 4.68, tableZ + 10.59);
    camera.lookAt(tableX, 0.72, tableZ);
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
