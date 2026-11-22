// B안 2D 그림을 실제 Three.js 에셋에서 렌더한다.
// npm run dev 실행 후 node scripts/render-noir-assets.mjs http://127.0.0.1:5173
// 얼굴과 전신만 다시 만들 때는 --seat-portraits-only.
// 역할 카드만 다시 만들 때는 --role-portraits-only.
// 동물 얼굴·전신·역할·옷장·참가자 그림만 다시 만들 때는 --animal-portraits-only.
// 참가자 카드의 상반신만 다시 만들 때는 --participant-portraits-only.
// 개선된 3D 에셋의 초상·맵·홈·초대 그림을 한 번에 갱신할 때는 --3d-art-refresh.
// 재즈 바 카드와 배경만 다시 만들 때는 --bar-art-only.
// 채팅과 기록의 정사각형 초상화만 다시 만들 때는 --faces-only.
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import sharp from "sharp";
import { findChrome } from "./e2e/lib.mjs";
import { renderBackdrops } from "./make-backdrops.mjs";

const root = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const origin = new URL(process.argv[2] ?? "http://127.0.0.1:5173");
if (!["localhost", "127.0.0.1"].includes(origin.hostname)) throw new Error("에셋 렌더는 로컬 개발 서버만 사용한다.");

const backdropsOnly = process.argv.includes("--backdrops-only");
const refreshArt = !backdropsOnly && process.argv.includes("--3d-art-refresh");
const PARTICIPANT_SIZE = 224;
const browser = await chromium.launch({ executablePath: findChrome(process.platform, process.env, existsSync), headless: true });
let renderEntry = false;

/** 생산 에셋의 URL, 밀도, 크기는 기존 화면 계약과 같다. */
async function savePng(data, path, width, height) {
  const input = Buffer.from(data.split(",")[1], "base64");
  const png = await sharp(input).resize(width, height, { fit: "fill" }).png({ palette: true, quality: 95 }).toBuffer();
  await saveBytes(root(path), png);
}

async function saveBytes(destination, bytes) {
  const previous = await readFile(destination).catch(error => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
  if (!previous?.equals(bytes)) await writeFile(destination, bytes);
}

async function saveParticipantPortrait(data, path) {
  const input = Buffer.from(data.split(",")[1], "base64");
  const image = sharp(input).resize(PARTICIPANT_SIZE, PARTICIPANT_SIZE).ensureAlpha();
  const pixels = await image.clone().raw().toBuffer();
  const size = PARTICIPANT_SIZE;
  let foreground = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (pixels[(y * size + x) * 4 + 3] <= 12) continue;
      foreground++;
      if (x < 4 || x >= size - 4 || y < 4 || y >= size - 4) throw new Error(`상반신 그림이 가장자리에 닿았습니다: ${path}`);
    }
  }
  if (foreground < size ** 2 * 0.08) throw new Error(`상반신 렌더가 비었습니다: ${path}`);
  await saveBytes(root(path), await image.webp({ quality: 90, alphaQuality: 100 }).toBuffer());
}

try {
  const page = await browser.newPage();
  const endpoint = new URL("/__noir-asset-render", origin).href;
  await page.route(endpoint, (route) => route.fulfill({ contentType: "text/html", body: "<!doctype html><main></main>" }));
  await page.goto(endpoint);

  const { figures, outfits, animals } = await page.evaluate(async () => {
    const THREE = await import("/node_modules/three/build/three.module.js");
    const model = await import("/src/world/character.ts");
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

    const participantStudio = new THREE.Scene();
    const portraitKey = new THREE.DirectionalLight("#ffe5c8", 2.05);
    portraitKey.position.set(-3, 5, 6);
    const portraitRim = new THREE.DirectionalLight("#a9c1e1", 0.80);
    portraitRim.position.set(3, 4, -3);
    participantStudio.add(new THREE.HemisphereLight("#fff1df", "#807582", 2.15), portraitKey, portraitRim);

    function participantFrame(subject) {
      const neck = subject.getObjectByName("neck");
      const bounds = new THREE.Box3().setFromObject(neck, true);
      const neckAt = neck.getWorldPosition(new THREE.Vector3());
      const chest = Math.min(neckAt.y - 0.33 * model.CHAR_SCALE, bounds.min.y - 0.035 * model.CHAR_SCALE);
      const vertex = new THREE.Vector3();
      subject.traverseVisible(node => {
        if (!node.isMesh) return;
        const position = node.geometry.getAttribute("position");
        for (let i = 0; i < position.count; i++) {
          vertex.fromBufferAttribute(position, i).applyMatrix4(node.matrixWorld);
          if (vertex.y >= chest) bounds.expandByPoint(vertex);
        }
      });

      const span = Math.max((bounds.max.x - bounds.min.x) / 0.86, (bounds.max.y - chest) / 0.88);
      const half = span / 2;
      const center = new THREE.Vector3((bounds.min.x + bounds.max.x) / 2, chest + span * 0.445, 0);
      const camera = new THREE.OrthographicCamera(-half, half, half, -half, 0.1, 20);
      camera.position.copy(center).add(new THREE.Vector3(0, 0, 5.8));
      camera.lookAt(center);
      return { camera, clip: new THREE.Plane(new THREE.Vector3(0, 1, 0), -chest) };
    }

    window.noirPortrait = ({ seat, outfit, colors, head, animal, ratio, participant }) => {
      const character = model.createCharacter(model.figForSeat(seat), outfit, colors, animal);
      const subject = character.root;
      // 실제 램프의 발밑 그림자와 선택 표시가 투명 PNG의 알파에 들어가지 않게 한다.
      for (const part of subject.children) if (part.isMesh) part.visible = false;
      if (participant) {
        const profile = animal === "crocodile" || animal === "parrot" || animal === "elephant";
        subject.rotation.y = profile ? -0.28 : 0;
        participantStudio.add(subject);
        subject.updateMatrixWorld(true);
        const { camera, clip } = participantFrame(subject);
        renderer.clippingPlanes = [clip];
        renderer.toneMappingExposure = 1.08;
        renderer.setSize(512, 512, false);
        try {
          renderer.render(participantStudio, camera);
          return renderer.domElement.toDataURL();
        } finally {
          renderer.clippingPlanes = [];
          renderer.toneMappingExposure = 1.14;
          participantStudio.remove(subject);
          character.dispose();
        }
      }
      subject.rotation.y = head ? (animal === "crocodile" || animal === "parrot" ? -0.42 : -0.07) : -0.16;
      studio.add(subject);
      const boundBy = head ? subject.getObjectByName("neck") : subject;
      if (head) {
        for (const part of boundBy.parent.children) if (part !== boundBy) part.visible = false;
        // 머리 서브그룹의 바운드에도 몸체 크기와 회전이 반영되어야 한다.
        subject.updateMatrixWorld(true);
      }
      const box = new THREE.Box3().setFromObject(boundBy);
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const margin = head ? 0.57 : animal ? 0.59 : 0.56;
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
      const world = await createThreeRenderer({ host, width, height, mapId, compactBar: mapId === "bar", budgetStep: 0, allowSoftware: true });
      world.setView({ x, z }, offset);
      world.setZoom(zoom);
      world.setLighting(phase);
      world.setTableScene?.(phase !== "trial");
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

  async function renderFace(path, seat, animal) {
    const head = await portrait({ seat, outfit: "coat", head: true, ratio: 1, animal });
    await savePng(head, path, 200, 200);
  }

  async function renderSeatPortraits() {
    for (const [seat, figure] of figures.entries()) {
      const full = await portrait({ seat, outfit: "coat", ratio: 0.75 });
      await savePng(full, `public/characters/table/${figure}_default@2x.png`, 144, 192);
      await savePng(full, `public/characters/table/${figure}_default@4x.png`, 288, 384);
      await renderFace(`public/characters/faces/face-${seat}.png`, seat);
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
      await renderFace(`${dir}/face.png`, 0, animal);
      for (const outfit of outfits) {
        const form = outfit === "coat" ? "figure" : outfit;
        const image = await portrait({ animal, seat: 0, outfit, ratio: 0.75 });
        const writes = [savePng(image, `${dir}/${form}-sm.png`, 144, 192)];
        // 확대 역할 카드와 입장 미리보기에서 사용하는 의상만 고밀도로 저장한다.
        if (outfit === "coat" || outfit === "mafia" || outfit === "police" || outfit === "doctor") {
          writes.push(savePng(image, `${dir}/${form}-lg.png`, 288, 384));
        }
        await Promise.all(writes);
        await renderParticipantPortrait(dir, animal, outfit);
      }
    }
  }

  async function renderParticipantPortrait(dir, animal, outfit) {
    const image = await portrait({ seat: 0, outfit, animal, participant: true });
    await saveParticipantPortrait(image, `${dir}/participant-${outfit}.webp`);
  }

  async function renderParticipantPortraits() {
    for (const animal of animals) {
      const dir = `public/characters/animals/${animal}`;
      await mkdir(root(dir), { recursive: true });
      for (const outfit of outfits) await renderParticipantPortrait(dir, animal, outfit);
    }
  }

  async function renderOutfitPortraits() {
    for (const outfit of outfits) {
      const image = await portrait({ seat: 0, outfit, ratio: 0.75 });
      await savePng(image, `public/outfits/outfit-${outfit}.png`, 144, 192);
    }
  }

  async function renderMapCards(onlyMap) {
    for (const [mapId, x, z, zoom] of [["bar", 0, 0, 0.85], ["plaza", -0.25, -1.4, 0.62]]) {
      if (onlyMap && mapId !== onlyMap) continue;
      const image = await scene({ mapId, phase: "talk", width: 560, height: 320, x, z, zoom, offset: 0 });
      const png = await sharp(image).resize(560, 320).removeAlpha().png({ palette: true, quality: 95 }).toBuffer();
      await writeFile(root(`public/maps/map-${mapId}.png`), png);
    }
  }

  if (backdropsOnly) {
    await renderBackdrops(scene);
  } else if (refreshArt || process.argv.includes("--bar-art-only")) {
    if (refreshArt) await renderAnimalPortraits();
    await renderMapCards("bar");
    await renderBackdrops(scene, "bar");
    renderEntry = refreshArt;
  } else if (process.argv.includes("--faces-only")) {
    for (const [seat] of figures.entries()) await renderFace(`public/characters/faces/face-${seat}.png`, seat);
    for (const animal of animals) await renderFace(`public/characters/animals/${animal}/face.png`, 0, animal);
  } else if (process.argv.includes("--seat-portraits-only")) {
    await renderSeatPortraits();
  } else if (process.argv.includes("--role-portraits-only")) {
    await renderRolePortraits();
  } else if (process.argv.includes("--animal-portraits-only")) {
    await renderAnimalPortraits();
  } else if (process.argv.includes("--participant-portraits-only")) {
    await renderParticipantPortraits();
  } else if (process.argv.includes("--outfit-portraits-only")) {
    await renderOutfitPortraits();
  } else {
    await renderSeatPortraits();
    await renderRolePortraits();
    await renderAnimalPortraits();
    await renderOutfitPortraits();
    await renderMapCards();
    await renderBackdrops(scene);
    renderEntry = true;
  }
} finally {
  await browser.close();
}

if (renderEntry) {
  execFileSync(process.execPath, [root("scripts/render-entry-scene.mjs"), origin.href], { stdio: "inherit" });
  execFileSync(process.execPath, [root("scripts/make-og.mjs")], { stdio: "inherit" });
}
