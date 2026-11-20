import { CanvasTexture, LatheGeometry, Mesh, MeshStandardMaterial, SRGBColorSpace, Vector2, type Object3D } from "three";
import { NOTE_MAX_VISIBLE } from "../../shared/game/postit";
import { NOTE_COLORS } from "./palette";

const RED = "#9e1532";
export const HAT_HEIGHT = 0.35;
export const HAT_STEP = 0.076;
export const HAT_SETTLE_MS = 230;
const HAT_DROP = 0.14;

function createHatGeometry(): LatheGeometry {
  const profile = [
    [0.18, 0], [0.245, 0], [0.26, 0.01], [0.265, 0.023], [0.256, 0.036],
    [0.233, 0.047], [0.22, 0.062], [0.202, 0.088], [0.12, 0.21],
    [0.049, 0.312], [0.026, 0.338], [0.012, 0.347], [0, HAT_HEIGHT],
  ].map(([radius, height]) => new Vector2(radius, height));
  const geometry = new LatheGeometry(profile, 24);
  const uv = geometry.getAttribute("uv");
  const position = geometry.getAttribute("position");
  for (let i = 0; i < uv.count; i++) uv.setY(i, position.getY(i) / HAT_HEIGHT);
  return geometry;
}

type HatCanvas = Pick<CanvasRenderingContext2D, "fillStyle" | "fillRect" | "strokeStyle" | "lineWidth"
  | "font" | "textAlign" | "textBaseline" | "fillText" | "strokeText">;

/** 네 방향에 같은 표기를 인쇄하고, 접힌 단과 주름은 UV에 구워 넣는다. */
export function paintHat(ctx: HatCanvas, count: number): void {
  const width = 512;
  const height = 128;
  ctx.fillStyle = RED;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#a21b37";
  ctx.fillRect(0, 111, width, 17);
  ctx.fillStyle = "#f18d99";
  ctx.fillRect(0, 115, width, 2);
  ctx.fillStyle = "#d3485a";
  ctx.fillRect(0, 124, width, 2);

  // 재현되는 짧은 섬유 결은 작은 텍스처에서도 얼룩이 생기지 않도록 낮은 대비로 굽는다.
  let grain = 0x97c472a1;
  for (const fiber of ["#ffd7c826", "#430d2633"]) {
    ctx.fillStyle = fiber;
    for (let i = 0; i < 2500; i++) {
      grain = (Math.imul(grain, 1664525) + 1013904223) >>> 0;
      ctx.fillRect(grain & 511, (grain >>> 10) & 127, 1 + ((grain >>> 22) & 1), 1);
    }
  }

  ctx.fillStyle = "#fee2c89c";
  for (let x = 1; x < width; x += 7) ctx.fillRect(x, 119, 3, 1);
  for (let seam = 0; seam < width; seam += width / 4) {
    ctx.fillStyle = "#750c255c";
    ctx.fillRect(seam, 8, 2, 103);
    ctx.fillStyle = "#ffd4c36b";
    for (let y = 10; y < 110; y += 8) ctx.fillRect(seam + 2, y, 1, 4);
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#630d2a";
  ctx.fillStyle = NOTE_COLORS.paper;
  for (let x = width / 8; x < width; x += width / 4) {
    ctx.font = '900 49px "Malgun Gothic", "Apple SD Gothic Neo", system-ui, sans-serif';
    ctx.strokeText("의심", x, 79);
    ctx.fillText("의심", x, 79);
    if (count > NOTE_MAX_VISIBLE) {
      ctx.font = "900 32px system-ui, sans-serif";
      ctx.strokeText(String(count), x, 45);
      ctx.fillText(String(count), x, 45);
    }
  }
}

function createHatTexture(count: number): CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  try {
    const ctx = canvas.getContext("2d");
    if (ctx === null) return null;
    paintHat(ctx, count);
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    return texture;
  } catch {
    return null;
  }
}

function createNoteKit() {
  const geometry = createHatGeometry();
  const materials = new Map<number, MeshStandardMaterial>();
  return {
    geometry,
    materialFor(count: number): MeshStandardMaterial {
      const key = count > NOTE_MAX_VISIBLE ? count : 0;
      let material = materials.get(key);
      if (material === undefined) {
        const map = createHatTexture(key);
        material = new MeshStandardMaterial({
          map, color: map ? "#ffffff" : RED,
          emissive: map ? "#ffffff" : RED, emissiveMap: map, emissiveIntensity: 0.24,
          roughness: 0.96,
        });
        materials.set(key, material);
      }
      return material;
    },
    dispose(): void {
      geometry.dispose();
      for (const material of materials.values()) {
        material.map?.dispose();
        material.dispose();
      }
    },
  };
}

let shared: ReturnType<typeof createNoteKit> | undefined;
let rigs = 0;

export interface NoteRig {
  set(fromSeats: readonly number[], opts: { animate: boolean }): void;
  setBaseY(y: number): void;
  face(yaw: number): void;
  top(): number | undefined;
  update(dtMs: number): void;
  clear(): void;
  detach(): void;
  counts(): { total: number; visible: number };
}

interface Hat {
  seat: number;
  ageMs: number;
  mesh: Mesh<LatheGeometry, MeshStandardMaterial>;
}

export function createNoteRig(parent: Object3D): NoteRig {
  const kit = shared ??= createNoteKit();
  rigs++;
  let hats: Hat[] = [];
  let total = 0;
  let baseY = 0;
  let facing = 0;
  let detached = false;

  function place(hat: Hat, layer: number): void {
    const t = Math.min(1, hat.ageMs / HAT_SETTLE_MS);
    hat.mesh.position.y = baseY + layer * HAT_STEP + HAT_DROP * (1 - t) ** 2;
  }

  function clear(): void {
    for (const { mesh } of hats) parent.remove(mesh);
    hats = [];
    total = 0;
  }

  return {
    set(fromSeats, { animate }) {
      if (detached) return;
      total = fromSeats.length;
      const available = [...hats];
      hats = fromSeats.slice(-NOTE_MAX_VISIBLE).map((seat, layer, visible) => {
        const index = available.findIndex((hat) => hat.seat === seat);
        const material = kit.materialFor(layer === visible.length - 1 ? total : 0);
        let hat: Hat;
        if (index === -1) {
          const mesh = new Mesh(kit.geometry, material);
          mesh.name = "note";
          mesh.rotation.y = facing + Math.PI / 4;
          mesh.raycast = () => {};
          parent.add(mesh);
          hat = { seat, mesh, ageMs: animate ? 0 : HAT_SETTLE_MS };
        } else {
          [hat] = available.splice(index, 1);
          hat.mesh.material = material;
          if (!animate) hat.ageMs = HAT_SETTLE_MS;
        }
        place(hat, layer);
        return hat;
      });
      for (const { mesh } of available) parent.remove(mesh);
    },
    setBaseY(y) {
      if (baseY === y) return;
      baseY = y;
      hats.forEach(place);
    },
    face(yaw) {
      if (facing === yaw) return;
      facing = yaw;
      for (const { mesh } of hats) mesh.rotation.y = facing + Math.PI / 4;
    },
    top() {
      return hats.length === 0 ? undefined : baseY + (hats.length - 1) * HAT_STEP + HAT_HEIGHT;
    },
    update(dtMs) {
      hats.forEach((hat, layer) => {
        if (hat.ageMs >= HAT_SETTLE_MS) return;
        hat.ageMs += dtMs;
        place(hat, layer);
      });
    },
    clear,
    detach() {
      if (detached) return;
      clear();
      detached = true;
      rigs--;
      if (rigs === 0) {
        kit.dispose();
        shared = undefined;
      }
    },
    counts() {
      return { total, visible: hats.length };
    },
  };
}
