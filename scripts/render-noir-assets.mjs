// B안 2D 그림을 실제 Three.js 에셋에서 렌더한다.
// npm run dev 실행 후 node scripts/render-noir-assets.mjs http://127.0.0.1:5173
// 얼굴과 전신만 다시 만들 때는 --seat-portraits-only.
// 역할 카드만 다시 만들 때는 --role-portraits-only.
// 동물 얼굴·전신·역할·옷장·참가자 그림만 다시 만들 때는 --animal-portraits-only.
// 참가자 카드의 상반신만 다시 만들 때는 --participant-portraits-only.
// 12종의 네 방향을 검수할 때는 --portrait-review=/tmp/review [--review-outfit=hood] [--review-face=happy] [--review-full].
// 개선된 3D 에셋의 초상·맵·홈·초대 그림을 한 번에 갱신할 때는 --3d-art-refresh.
// 재즈 바 카드와 배경만 다시 만들 때는 --bar-art-only.
// 채팅과 기록의 정사각형 초상화만 다시 만들 때는 --faces-only.
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { chromium } from "playwright-core";
import sharp from "sharp";
import { findChrome } from "./e2e/lib.mjs";
import { renderBackdrops } from "./make-backdrops.mjs";

const root = (path) => fileURLToPath(new URL(`../${path}`, import.meta.url));
const origin = new URL(process.argv[2] ?? "http://127.0.0.1:5173");
if (!["localhost", "127.0.0.1"].includes(origin.hostname)) throw new Error("에셋 렌더는 로컬 개발 서버만 사용한다.");

const backdropsOnly = process.argv.includes("--backdrops-only");
const refreshArt = !backdropsOnly && process.argv.includes("--3d-art-refresh");
const option = (name) => process.argv.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const reviewDir = option("portrait-review");
if (process.argv.includes("--portrait-review") || reviewDir === "") throw new Error("--portrait-review=/tmp/review 형식으로 검수 폴더를 지정해 주세요.");
const PARTICIPANT_SIZE = 224;
const browser = await chromium.launch({ executablePath: findChrome(process.platform, process.env, existsSync), headless: true });
let renderEntry = false;

async function saveBytes(destination, bytes) {
  const previous = await readFile(destination).catch(error => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
  if (!previous?.equals(bytes)) await writeFile(destination, bytes);
}

const imageOf = (data) => sharp(Buffer.from(data.split(",")[1], "base64"));

/** 생산 에셋의 URL, 밀도, 크기는 기존 화면 계약과 같다. */
async function savePng(data, path, width, height) {
  const png = await imageOf(data).resize(width, height, { fit: "fill" }).png({ palette: true, quality: 95 }).toBuffer();
  await saveBytes(root(path), png);
}

/** 가슴 절단선에서 따로 떠 보이는 꼬리 끝·손에 든 소품의 조각을 걷어낸다. */
function clearBustFragments(pixels, size) {
  const visited = new Uint8Array(size ** 2);
  for (let start = 0; start < visited.length; start++) {
    if (visited[start] || pixels[start * 4 + 3] === 0) continue;
    let top = size;
    const region = [start];
    visited[start] = 1;
    for (let i = 0; i < region.length; i++) {
      const point = region[i];
      const x = point % size;
      const y = Math.floor(point / size);
      top = Math.min(top, y);
      for (const neighbor of [x > 0 ? point - 1 : -1, x + 1 < size ? point + 1 : -1, point - size, point + size]) {
        if (neighbor < 0 || neighbor >= visited.length || visited[neighbor] || pixels[neighbor * 4 + 3] === 0) continue;
        visited[neighbor] = 1;
        region.push(neighbor);
      }
    }
    if (top >= size * 0.75 && region.length < size ** 2 * 0.022) {
      for (const point of region) pixels[point * 4 + 3] = 0;
    }
  }
}

/** 귀·모자나 어깨가 네 가장자리에 닿는 그림은 저장하지 않는다. */
async function participantWebp(data, label) {
  const image = imageOf(data).resize(PARTICIPANT_SIZE, PARTICIPANT_SIZE, { fit: "fill" }).ensureAlpha();
  const pixels = await image.raw().toBuffer();
  clearBustFragments(pixels, PARTICIPANT_SIZE);
  const inset = 4;
  let foreground = 0;
  for (let y = 0; y < PARTICIPANT_SIZE; y++) {
    for (let x = 0; x < PARTICIPANT_SIZE; x++) {
      if (pixels[(y * PARTICIPANT_SIZE + x) * 4 + 3] <= 12) continue;
      foreground += 1;
      if (x >= inset && y >= inset && x < PARTICIPANT_SIZE - inset && y < PARTICIPANT_SIZE - inset) continue;
      throw new Error(`상반신 그림이 가장자리에 닿았습니다: ${label}`);
    }
  }
  if (foreground < PARTICIPANT_SIZE ** 2 * 0.08) throw new Error(`상반신 렌더가 비었습니다: ${label}`);
  return sharp(pixels, { raw: { width: PARTICIPANT_SIZE, height: PARTICIPANT_SIZE, channels: 4 } })
    .webp({ quality: 90, alphaQuality: 100 }).toBuffer();
}

try {
  const page = await browser.newPage();
  const endpoint = new URL("/__noir-asset-render", origin).href;
  await page.route(endpoint, (route) => route.fulfill({ contentType: "text/html", body: "<!doctype html><main></main>" }));
  await page.goto(endpoint);

  const { figures, outfits, animals, faces } = await page.evaluate(async () => {
    const THREE = await import("/node_modules/three/build/three.module.js");
    const model = await import("/src/world/character.ts");
    const { FIGURE_IDS } = await import("/src/net/assets.ts");
    const { OUTFIT_IDS } = await import("/shared/protocol.ts");
    const { ANIMAL_IDS } = await import("/shared/game/animals.ts");
    const { FACE_IDS } = await import("/src/world/characterData.ts");
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
    renderer.setClearColor(0, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.14;

    function createStudio({ sky, ground, fill, keyColor, keyStrength, rimColor, rimStrength }) {
      const studio = new THREE.Scene();
      const key = new THREE.DirectionalLight(keyColor, keyStrength);
      key.position.set(-3, 5, 6);
      const rim = new THREE.DirectionalLight(rimColor, rimStrength);
      rim.position.set(3, 4, -3);
      studio.add(new THREE.HemisphereLight(sky, ground, fill), key, rim);
      return studio;
    }
    const legacyStudio = createStudio({ sky: "#dce6fa", ground: "#696274", fill: 2.25, keyColor: "#ffe0ac", keyStrength: 2.4, rimColor: "#88a8dd", rimStrength: 1.55 });
    const animalStudio = createStudio({ sky: "#fff1df", ground: "#807582", fill: 2.15, keyColor: "#ffe2bc", keyStrength: 2.1, rimColor: "#a9c1e1", rimStrength: 0.72 });

    function bustCamera(subject, neck) {
      const headBounds = new THREE.Box3().setFromObject(neck, true);
      const neckAt = neck.getWorldPosition(new THREE.Vector3());
      const chest = Math.min(neckAt.y - 0.33 * model.CHAR_SCALE, headBounds.min.y - 0.035 * model.CHAR_SCALE);
      const bounds = headBounds.clone();
      const vertex = new THREE.Vector3();
      subject.traverseVisible((node) => {
        const vertices = node.isMesh ? node.geometry.getAttribute("position") : undefined;
        if (!vertices) return;
        for (let i = 0; i < vertices.count; i++) {
          vertex.fromBufferAttribute(vertices, i).applyMatrix4(node.matrixWorld);
          if (vertex.y >= chest) bounds.expandByPoint(vertex);
        }
      });
      const span = Math.max((bounds.max.x - bounds.min.x) / 0.86, (bounds.max.y - chest) / 0.88);
      const target = new THREE.Vector3((bounds.min.x + bounds.max.x) / 2, chest + span * 0.445, 0);
      const half = span / 2;
      const camera = new THREE.OrthographicCamera(-half, half, half, -half, 0.1, 20);
      camera.position.copy(target).add(new THREE.Vector3(0, 0, 5.8));
      camera.lookAt(target);
      return { camera, clip: new THREE.Plane(new THREE.Vector3(0, 1, 0), -chest) };
    }

    window.noirPortrait = ({ seat, outfit, colors, head, animal, ratio, bust, yaw, face }) => {
      const character = model.createCharacter(model.figForSeat(seat), outfit, colors, animal);
      const subject = character.root;
      const studio = animal ? animalStudio : legacyStudio;
      if (face !== undefined) character.setFace(face);
      // 실제 램프의 발밑 그림자와 선택 표시가 투명 PNG의 알파에 들어가지 않게 한다.
      for (const part of subject.children) if (part.isMesh) part.visible = false;
      const longProfile = animal === "crocodile" || animal === "parrot" || animal === "elephant";
      subject.rotation.y = yaw ?? (bust ? (longProfile ? -0.28 : 0)
        : head ? (animal === "crocodile" || animal === "parrot" ? -0.42 : -0.07) : -0.16);
      studio.add(subject);
      try {
        const neck = subject.getObjectByName("neck");
        if (head) for (const part of neck.parent.children) if (part !== neck) part.visible = false;
        subject.updateMatrixWorld(true);
        let camera;
        if (bust) {
          const frame = bustCamera(subject, neck);
          camera = frame.camera;
          renderer.clippingPlanes = [frame.clip];
        } else {
          const box = new THREE.Box3().setFromObject(head ? neck : subject);
          const center = box.getCenter(new THREE.Vector3());
          const size = box.getSize(new THREE.Vector3());
          const margin = head ? 0.57 : animal ? 0.59 : 0.56;
          const half = Math.max(size.y, size.x / ratio) * margin;
          camera = new THREE.OrthographicCamera(-half * ratio, half * ratio, half, -half, 0.1, 20);
          const angleReview = yaw !== undefined;
          camera.position.copy(center).add(new THREE.Vector3(angleReview ? 0 : 0.42, angleReview ? 0 : head ? 0.21 : 0.57, 5.8));
          camera.lookAt(center);
        }
        renderer.toneMappingExposure = animal ? 1.08 : 1.14;
        renderer.setSize(Math.round(768 * ratio), 768, false);
        renderer.render(studio, camera);
        return renderer.domElement.toDataURL();
      } finally {
        renderer.clippingPlanes = [];
        studio.remove(subject);
        character.dispose();
      }
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
    return { figures: FIGURE_IDS, outfits: OUTFIT_IDS, animals: ANIMAL_IDS, faces: FACE_IDS };
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

  async function renderParticipantPortrait(dir, animal, outfit) {
    const image = await portrait({ animal, seat: 0, outfit, ratio: 1, bust: true });
    const bytes = await participantWebp(image, `${animal}/${outfit}`);
    await saveBytes(root(`${dir}/participant-${outfit}.webp`), bytes);
  }

  async function renderParticipantPortraits() {
    for (const animal of animals) {
      const dir = `public/characters/animals/${animal}`;
      await mkdir(root(dir), { recursive: true });
      for (const outfit of outfits) await renderParticipantPortrait(dir, animal, outfit);
    }
  }

  async function renderPortraitReview(dir) {
    const outfit = option("review-outfit") ?? "coat";
    const face = option("review-face") ?? "base";
    const full = process.argv.includes("--review-full");
    if (!outfits.includes(outfit)) throw new Error(`없는 검수 의상: ${outfit}`);
    if (!faces.includes(face)) throw new Error(`없는 검수 표정: ${face}`);

    const views = [["Front", 0], ["Turned", -0.28], ["Side", Math.PI / 2], ["Back", Math.PI]];
    const cell = 168;
    const gutter = 112;
    const header = 48;
    const width = gutter + cell * views.length;
    const height = header + cell * animals.length;
    const layers = [];
    for (const [row, animal] of animals.entries()) {
      for (const [col, [label, yaw]] of views.entries()) {
        const image = await portrait({ seat: 0, animal, outfit, face, yaw, ratio: full ? 0.75 : 1, bust: !full });
        const bytes = full ? Buffer.from(image.split(",")[1], "base64") : await participantWebp(image, `${animal}/${outfit}/${label}`);
        const input = await sharp(bytes).resize(cell, cell, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
        layers.push({ input, left: gutter + col * cell, top: header + row * cell });
      }
    }
    const text = (label, x, y) => `<text x="${x}" y="${y}" fill="#e5d6c0" font-family="sans-serif" font-size="16">${label}</text>`;
    const labels = [
      text(`${outfit} / ${face}`, 12, 28),
      ...views.map(([label], col) => text(label, gutter + col * cell + 16, 28)),
      ...animals.map((animal, row) => text(animal, 12, header + row * cell + cell / 2)),
    ].join("");
    const overlay = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${labels}</svg>`);
    layers.push({ input: overlay });
    const sheet = await sharp({ create: { width, height, channels: 3, background: "#141e2b" } }).composite(layers).webp({ quality: 92 }).toBuffer();
    await mkdir(dir, { recursive: true });
    const destination = join(dir, `portrait-review-${outfit}-${face}-${full ? "full" : "bust"}.webp`);
    await saveBytes(destination, sheet);
    process.stdout.write(`${destination}\n`);
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

  if (reviewDir !== undefined) {
    await renderPortraitReview(reviewDir);
  } else if (backdropsOnly) {
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
