// ?pose-strip=1 포즈 스트립 디버그 화면(10-06, D-8·O-11). 제품 화면이 아니다 — 개발 빌드·?e2e=1 문맥에서만, 지연 로드 청크로만 열린다(perfProbe.initPerfDebug).
// 행 = 동작 9종 + 서기 + 걷기, 열 = 4 샘플 시각(strip) / 의상 9행 × 인물 5열(combos). 하나의 WebGLRenderer 와 scissor 로 칸마다 자세를 잡아 그린다.
// 걷기·방향·모자·소품 겹침을 눈으로 확인하는 용도다. 머리 위에는 아무것도 그리지 않는다. 글자는 textContent 로만 넣는다(innerHTML 없음).
import { ACESFilmicToneMapping, AmbientLight, Color, DirectionalLight, PerspectiveCamera, SRGBColorSpace, Scene, WebGLRenderer } from "three";
import { EMOTE_LABEL } from "../game/chatText";
import { POSE_BLEND_MS, WALK_PHASE_RATE, createCharacter } from "../world/character";
import { FIGS, OUTFITS, type OutfitId } from "../world/characterData";
import { OUTFIT_ORDER, STRIP_COLS, parsePoseStripParams, samplePlan, stripRows } from "./poseStripData";
import type { PoseStripParams, SamplePlan, StripRow } from "./poseStripData";

const CELL_W = 180;
const CELL_H = 230;
/** 인물이 카메라 쪽으로 몸을 비튼 3/4 각도(rad) */
const YAW = 0.55;

export interface PoseStrip {
  dispose(): void;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, css: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.style.cssText = css;
  if (text !== undefined) e.textContent = text;
  return e;
}

function rowLabel(row: StripRow): string {
  if (row === "idle") return "서기";
  if (row === "walk") return "걷기";
  return `${row} ${EMOTE_LABEL[row]}`;
}

/** 칸 하나의 자세를 잡는다. 걷기는 섞임이 끝난 뒤 목표 위상에 맞춘다 */
function pose(c: ReturnType<typeof createCharacter>, plan: SamplePlan): void {
  if (plan.kind === "emote" && plan.id) {
    c.playEmote(plan.id);
    c.update(plan.t, 0, false);
  } else if (plan.kind === "walk") {
    const warm = POSE_BLEND_MS / 1000;
    c.update(warm, 0, true);
    const twoPi = Math.PI * 2;
    const want = (((plan.phase ?? 0) - warm * WALK_PHASE_RATE) % twoPi + twoPi) % twoPi;
    c.update(want / WALK_PHASE_RATE, 0, true);
  } else {
    c.update(plan.t, plan.t, false);
  }
}

export function mount(root: HTMLElement, params: URLSearchParams): PoseStrip {
  const state: PoseStripParams = parsePoseStripParams(`?${params.toString()}`);
  document.getElementById("root")?.remove(); // 디버그 화면은 앱 자리표시자 없이 맨 위부터
  document.body.style.margin = "0";
  document.body.style.background = "#14161c";

  const wrap = el("div", "font:13px/1.4 system-ui,sans-serif;color:#e9ecf2;padding:8px");
  wrap.setAttribute("data-pose-strip", "loading");
  root.appendChild(wrap);
  wrap.appendChild(el("div", "font-weight:600;margin-bottom:6px", "포즈 스트립 — 머리 위 표시 없음"));

  const bar = el("div", "display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px");
  const select = (label: string, options: [string, string][], value: string, on: (v: string) => void): void => {
    const l = el("label", "display:flex;gap:4px;align-items:center", label);
    const s = el("select", "font:inherit");
    for (const [v, t] of options) {
      const o = document.createElement("option");
      o.value = v;
      o.textContent = t;
      s.appendChild(o);
    }
    s.value = value;
    s.addEventListener("change", () => on(s.value));
    l.appendChild(s);
    bar.appendChild(l);
  };
  select("보기", [["strip", "동작 줄"], ["combos", "45조합"]], state.view, (v) => {
    state.view = v === "combos" ? "combos" : "strip";
    draw();
  });
  select("인물", FIGS.map((f, i) => [String(i), `${i} ${f.name}`]), String(state.fig), (v) => {
    state.fig = Number(v);
    draw();
  });
  select("의상", OUTFIT_ORDER.map((o) => [o, `${o} ${OUTFITS[o].label}`]), state.outfit, (v) => {
    state.outfit = v as PoseStripParams["outfit"];
    draw();
  });
  select("자세(45조합)", [["idle", "서기"], ["walk", "걷기"]], state.pose, (v) => {
    state.pose = v === "walk" ? "walk" : "idle";
    draw();
  });
  wrap.appendChild(bar);

  const board = el("div", "position:relative;display:inline-block");
  const labels = el("div", "position:absolute;left:0;top:0;pointer-events:none");
  const canvas = document.createElement("canvas");
  board.append(canvas, labels);
  wrap.appendChild(board);

  const gl = new WebGLRenderer({ canvas, antialias: true, alpha: false, preserveDrawingBuffer: true });
  gl.outputColorSpace = SRGBColorSpace;
  gl.toneMapping = ACESFilmicToneMapping;
  gl.setPixelRatio(1);
  gl.setScissorTest(true);

  const scene = new Scene();
  scene.add(new AmbientLight(0xffffff, 1.3));
  const key = new DirectionalLight(0xfff2de, 2.2);
  key.position.set(2.5, 5, 6);
  scene.add(key);
  const cam = new PerspectiveCamera(28, CELL_W / CELL_H, 0.1, 50);
  cam.position.set(0, 1.25, 6.3);
  cam.lookAt(0, 1.05, 0);

  function cell(c: number, r: number, rows: number, fig: number, outfit: OutfitId, plan: SamplePlan): void {
    const x = c * CELL_W;
    const y = rows * CELL_H - (r + 1) * CELL_H;
    gl.setViewport(x, y, CELL_W, CELL_H);
    gl.setScissor(x, y, CELL_W, CELL_H);
    gl.setClearColor(new Color((r + c) % 2 === 0 ? "#2a2f3a" : "#242833"));
    const ch = createCharacter(fig, outfit);
    ch.setYaw(YAW);
    pose(ch, plan);
    scene.add(ch.root);
    gl.render(scene, cam);
    scene.remove(ch.root);
    ch.dispose();
  }

  function labelCell(text: string, x: number, y: number): void {
    labels.appendChild(el("div", `position:absolute;left:${x + 4}px;top:${y + 2}px;white-space:nowrap;font:11px system-ui,sans-serif;color:#cfd4e0;text-shadow:0 0 3px #000`, text));
  }

  function draw(): void {
    wrap.setAttribute("data-pose-strip", "loading");
    labels.textContent = "";
    const combos = state.view === "combos";
    const rows = combos ? OUTFIT_ORDER.length : stripRows().length;
    const cols = combos ? FIGS.length : STRIP_COLS;
    const w = cols * CELL_W;
    const h = rows * CELL_H;
    gl.setSize(w, h, false);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    gl.setScissor(0, 0, w, h);
    gl.setClearColor(new Color("#14161c"));
    gl.clear();
    if (combos) {
      OUTFIT_ORDER.forEach((o, r) => {
        FIGS.forEach((f, c) => {
          cell(c, r, rows, c, o, samplePlan({ view: "combos", pose: state.pose }, c));
          labelCell(`${f.name} · ${OUTFITS[o].label}`, c * CELL_W, r * CELL_H);
        });
      });
    } else {
      stripRows().forEach((row, r) => {
        for (let c = 0; c < cols; c++) {
          const plan = samplePlan({ view: "strip", row }, c);
          cell(c, r, rows, state.fig, state.outfit, plan);
          labelCell(c === 0 ? rowLabel(row) : `t=${plan.kind === "walk" ? `${(((plan.phase ?? 0) / Math.PI) * 180).toFixed(0)}°` : plan.t.toFixed(2)}`, c * CELL_W, r * CELL_H);
        }
      });
    }
    wrap.setAttribute("data-pose-strip", "ready");
  }

  draw();
  return {
    dispose(): void {
      gl.dispose();
      wrap.remove();
    },
  };
}
