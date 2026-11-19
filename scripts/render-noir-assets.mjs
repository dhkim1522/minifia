// B안 2D 그림을 실제 Three.js 에셋에서 렌더한다.
// npm run dev 실행 후 node scripts/render-noir-assets.mjs http://127.0.0.1:5173
// 얼굴과 전신만 다시 만들 때는 --seat-portraits-only.
// 역할 카드만 다시 만들 때는 --role-portraits-only.
// 동물 얼굴·전신·역할·옷장 그림만 다시 만들 때는 --animal-portraits-only.
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import sharp from "sharp";
import { findChrome } from "./e2e/lib.mjs";
import { renderBackdrops } from "./make-backdrops.mjs";

const root = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const origin = new URL(process.argv[2] ?? "http://127.0.0.1:5173");
if (!["localhost", "127.0.0.1"].includes(origin.hostname)) throw new Error("에셋 렌더는 로컬 개발 서버만 사용한다.");

const browser = await chromium.launch({ executablePath: findChrome(process.platform, process.env, existsSync), headless: true });

/** 생산 에셋의 URL, 밀도, 크기는 기존 화면 계약과 같다. */
async function savePng(data, path, width, height) {
  const input = Buffer.from(data.split(",")[1], "base64");
  const png = await sharp(input).resize(width, height, { fit: "fill" }).png({ palette: true, quality: 95 }).toBuffer();
  await writeFile(root(path), png);
}

try {
  const page = await browser.newPage();
  const endpoint = new URL("/__noir-asset-render", origin).href;
  await page.route(endpoint, (route) => route.fulfill({ contentType: "text/html", body: "<!doctype html><main></main>" }));
  await page.goto(endpoint);

  const { figures, outfits, animals } = await page.evaluate(async () => {
    const THREE = await import("/node_modules/three/build/three.module.js");
    const model = await import("/src/world/character.ts");
    const { buildGhost3d } = await import("/src/world/ghost3d.ts");
    const { FIGURE_IDS } = await import("/src/net/assets.ts");
    const { OUTFIT_IDS } = await import("/shared/protocol.ts");
    const { ANIMAL_IDS } = await import("/shared/game/animals.ts");
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setClearColor(0, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.14;

    const studio = new THREE.Scene();
    studio.add(new THREE.HemisphereLight("#dce6fa", "#696274", 2.25));
    const key = new THREE.DirectionalLight("#ffe0ac", 2.4);
    key.position.set(-3, 5, 6);
    const rim = new THREE.DirectionalLight("#88a8dd", 1.55);
    rim.position.set(3, 4, -3);
    studio.add(key, rim);

    window.noirPortrait = ({ seat, outfit, colors, head, ghost, animal, ratio }) => {
      const character = ghost ? buildGhost3d() : model.createCharacter(model.figForSeat(seat), outfit, colors, animal);
      const subject = character.root;
      // 실제 램프의 발밑 그림자와 선택 표시가 투명 PNG의 알파에 들어가지 않게 한다.
      if (!ghost) for (const part of subject.children) if (part.isMesh) part.visible = false;
      subject.rotation.y = head ? (animal === "crocodile" || animal === "parrot" ? -0.42 : -0.07) : -0.16;
      studio.add(subject);
      const boundBy = head ? subject.getObjectByName("neck") : subject;
      const box = new THREE.Box3().setFromObject(boundBy);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      // 작은 얼굴 버튼에서도 모자와 볼이 다 읽히고 코트 깃이 조금 보인다.
      if (head && !animal) center.y -= 0.12;
      const margin = animal ? 0.59 : head ? 0.69 : 0.56;
      const half = Math.max(size.y, size.x / ratio) * margin;
      const camera = new THREE.OrthographicCamera(-half * ratio, half * ratio, half, -half, 0.1, 20);
      camera.position.copy(center).add(new THREE.Vector3(0.42, head ? 0.21 : 0.57, 5.8));
      camera.lookAt(center);
      renderer.setSize(Math.round(768 * ratio), 768, false);
      renderer.render(studio, camera);
      studio.remove(subject);
      character.dispose();
      return renderer.domElement.toDataURL();
    };

    const { createThreeRenderer } = await import("/src/world/threeRenderer.ts");
    window.noirMap = async ({ mapId, phase, width, height, x, z, zoom, offset }) => {
      const host = document.querySelector("main");
      const world = await createThreeRenderer({ host, width, height, mapId, budgetStep: 0, allowSoftware: true });
      world.setView({ x, z }, offset);
      world.setZoom(zoom);
      world.setLighting(phase);
      world.render();
      window.disposeNoirMap = () => world.dispose();
    };
    return { figures: FIGURE_IDS, outfits: OUTFIT_IDS, animals: ANIMAL_IDS };
  });

  async function scene(options) {
    await page.setViewportSize({ width: options.width, height: options.height });
    await page.evaluate((settings) => window.noirMap(settings), options);
    try {
      return await page.locator("main canvas").screenshot();
    } finally {
      await page.evaluate(() => window.disposeNoirMap());
    }
  }

  const portrait = (options) => page.evaluate((opts) => window.noirPortrait(opts), options);

  async function renderSeatPortraits() {
    for (const [seat, figure] of figures.entries()) {
      const full = await portrait({ seat, outfit: "coat", ratio: 0.75 });
      await savePng(full, `public/characters/table/${figure}_default@2x.png`, 144, 192);
      await savePng(full, `public/characters/table/${figure}_default@4x.png`, 288, 384);
      const head = await portrait({ seat, outfit: "coat", head: true, ratio: 1 });
      await savePng(head, `public/characters/faces/face-${seat}.png`, 200, 200);
    }
  }

  async function renderRolePortraits() {
    // 역할 그림은 본인 카드에만 등장한다. 살아 있는 인물의 공개 외형은 좌석·꾸미기와만 연동된다.
    for (const [role, seat, outfit, colors] of [
      ["citizen", 2, "coat", { coat: "#a07754", shirt: "#b6bd9e", tie: "", pants: "#545c59", shoe: "#4a352c" }],
      ["police", 0, "police", { coat: "#305889", shirt: "#a6bbd5", pants: "#243b5a" }],
      ["doctor", 5, "doctor", { coat: "#e6e7e6", shirt: "#397e77", pants: "#576d79" }],
      ["mafia", 3, "mafia"],
    ]) {
      const image = await portrait({ seat, outfit, colors, ratio: 0.75 });
      await savePng(image, `public/characters/roles/${role}_default@2x.png`, 144, 192);
      await savePng(image, `public/characters/roles/${role}_default@4x.png`, 288, 384);
    }
  }

  async function renderAnimalPortraits() {
    for (const animal of animals) {
      const dir = `public/characters/animals/${animal}`;
      await mkdir(root(dir), { recursive: true });
      const head = await portrait({ animal, seat: 0, outfit: "coat", head: true, ratio: 1 });
      await savePng(head, `${dir}/face.png`, 200, 200);
      for (const outfit of outfits) {
        const form = outfit === "coat" ? "figure" : outfit;
        const image = await portrait({ animal, seat: 0, outfit, ratio: 0.75 });
        const writes = [savePng(image, `${dir}/${form}-sm.png`, 144, 192)];
        // 확대 역할 카드와 입장 미리보기에서 사용하는 의상만 고밀도로 저장한다.
        if (outfit === "coat" || outfit === "mafia" || outfit === "police" || outfit === "doctor") {
          writes.push(savePng(image, `${dir}/${form}-lg.png`, 288, 384));
        }
        await Promise.all(writes);
      }
    }
  }

  async function renderGhostPortrait() {
    const ghost = await portrait({ ghost: true, ratio: 0.75 });
    await savePng(ghost, "public/characters/ghost/ghost_default@2x.png", 144, 192);
    await savePng(ghost, "public/characters/ghost/ghost_default@4x.png", 288, 384);
  }

  async function renderOutfitPortraits() {
    for (const outfit of outfits) {
      const image = await portrait({ seat: 0, outfit, ratio: 0.8 });
      await savePng(image, `public/outfits/outfit-${outfit}.png`, 240, 300);
    }
  }

  async function renderMapCards() {
    for (const [mapId, x, z, zoom] of [["bar", -1.3, -1.2, 0.64], ["plaza", -0.25, -1.4, 0.62]]) {
      const image = await scene({ mapId, phase: "talk", width: 560, height: 320, x, z, zoom, offset: 0 });
      const png = await sharp(image).resize(560, 320).removeAlpha().png({ palette: true, quality: 95 }).toBuffer();
      await writeFile(root(`public/maps/map-${mapId}.png`), png);
    }
  }

  if (process.argv.includes("--backdrops-only")) {
    await renderBackdrops(scene);
  } else if (process.argv.includes("--seat-portraits-only")) {
    await renderSeatPortraits();
  } else if (process.argv.includes("--role-portraits-only")) {
    await renderRolePortraits();
  } else if (process.argv.includes("--animal-portraits-only")) {
    await renderAnimalPortraits();
  } else if (process.argv.includes("--outfit-portraits-only")) {
    await renderOutfitPortraits();
  } else {
    await renderSeatPortraits();
    await renderRolePortraits();
    await renderAnimalPortraits();
    await renderGhostPortrait();
    await renderOutfitPortraits();
    await renderMapCards();
    await renderBackdrops(scene);
  }
} finally {
  await browser.close();
}
