// 시트 진입 위치 계측 본체(G-01-9) — 지연 로드 청크. ?sheetdebug=1 탭에서만 sheetProbe.initSheetDebug 가 불러온다.
// 시트가 열릴 때부터 1초 동안 뷰포트·다이얼로그·시트 값을 재서 폰 화면 패널·콘솔·탭 저장소에 남기고,
// 판정 규칙(classifyTrace)으로 원인 후보를 계산한다. 시트 안 글자·그림 주소·주소·방 코드·토큰은 읽지 않는다(T-01-62).
import type { StorageLike } from "../net/session";
import type { SheetProbe, SheetTrace, SheetTraceTarget } from "./sheetProbe";

export const TRACE_MS = 1000;
export const DISCARD_MS = 50;
export const SHIFT_PX = 20;
export const STEADY_PX = 4;
export const UNIT_MATCH_PX = 2;
export const MAX_TRACES = 12;
export const TRACES_KEY = "minifia:sheetdebug:traces";
export const SEQ_KEY = "minifia:sheetdebug:seq";
export const CHANGE_ROWS = 8;

const TIMED_MS = [100, 200, 300, 500, 1000] as const;

export type SheetImgState = "none" | "pending" | "loaded" | "error";
export type SheetVerdict =
  | "A-svh"
  | "A-lvh"
  | "A-dvh"
  | "A-none"
  | "B"
  | "D"
  | "mixed"
  | "viewport"
  | "sheet-drift"
  | "stable";

export interface SheetSample {
  t: number;
  ev: string;
  vvH: number | null;
  vvTop: number | null;
  inH: number | null;
  docH: number | null;
  docSH: number | null;
  scY: number | null;
  dvh: number | null;
  svh: number | null;
  lvh: number | null;
  pct: number | null;
  ins: number | null;
  safeB: number | null;
  dlgT: number | null;
  dlgB: number | null;
  dlgH: number | null;
  shT: number | null;
  shB: number | null;
  shH: number | null;
  shTY: number | null;
  cls: string;
  img: SheetImgState;
}

export interface SheetTraceRecord {
  n: number;
  label: string;
  screen: string;
  ua: string;
  dpr: number;
  screenH: number;
  standalone: boolean;
  startedAt: string;
  samples: SheetSample[];
  verdict: SheetVerdict | "";
}

export interface SheetClassification {
  verdict: SheetVerdict;
  dlgShift: number;
  shGrow: number;
  vpShift: number;
  shDrift: number;
  unit: "svh" | "lvh" | "dvh" | null;
  scrolled: boolean;
}

// ---- 판정 규칙 (순수 함수) ----

/** 시트의 변환 전 아래 끝이 다이얼로그 아래 끝에서 떨어진 거리. 진입·닫힘 이동은 shB 와 shTY 가 함께 바뀌어 잡히지 않는다. */
function gapOf(s: SheetSample): number | null {
  if (s.shB === null || s.shTY === null || s.dlgB === null) return null;
  return s.shB - s.shTY - s.dlgB;
}

function maxAbsDiff(samples: SheetSample[], pick: (s: SheetSample) => number | null, ref: number | null): number {
  if (ref === null) return 0;
  let max = 0;
  for (const s of samples) {
    const v = pick(s);
    if (v === null) continue;
    max = Math.max(max, Math.abs(v - ref));
  }
  return max;
}

export function classifyTrace(record: SheetTraceRecord): SheetClassification {
  const samples = record.samples;
  const B = samples.find((s) => s.ev === "before");
  const S = samples.find((s) => s.ev === "shown");
  const E = samples.find((s) => s.ev === "entered");
  const F = samples[samples.length - 1];
  if (!F) return { verdict: "stable", dlgShift: 0, shGrow: 0, vpShift: 0, shDrift: 0, unit: null, scrolled: false };

  const afterT = E?.t ?? S?.t ?? 0;
  const after = samples.filter((s) => s.t >= afterT);
  const sinceShown = samples.filter((s) => s.t >= (S?.t ?? 0));

  const dlgShift = maxAbsDiff(after, (s) => s.dlgB, F.dlgB);
  const shGrow = maxAbsDiff(after, (s) => s.shH, F.shH);
  const vpShift = Math.max(
    maxAbsDiff(sinceShown, (s) => s.vvH, F.vvH),
    maxAbsDiff(sinceShown, (s) => s.inH, F.inH),
  );
  const shDrift = maxAbsDiff(after, gapOf, gapOf(F));

  let scrolled = false;
  if (B) {
    for (const s of sinceShown) {
      if (s.scY !== null && B.scY !== null && Math.abs(s.scY - B.scY) >= 1) scrolled = true;
      if (s.vvTop !== null && B.vvTop !== null && Math.abs(s.vvTop - B.vvTop) >= 1) scrolled = true;
    }
  }

  // 정적 단위(svh·lvh)를 먼저 본다 — 툴바가 움직여도 값이 변하지 않는다.
  let unit: "svh" | "lvh" | "dvh" | null = null;
  if (S && F.dlgH !== null) {
    for (const u of ["svh", "lvh", "dvh"] as const) {
      const v = S[u];
      if (v !== null && Math.abs(v - F.dlgH) <= UNIT_MATCH_PX) {
        unit = u;
        break;
      }
    }
  }

  let verdict: SheetVerdict;
  if (dlgShift >= SHIFT_PX && shGrow >= SHIFT_PX) verdict = "mixed";
  else if (dlgShift >= SHIFT_PX && scrolled) verdict = "D";
  else if (dlgShift >= SHIFT_PX) verdict = unit ? (`A-${unit}` as SheetVerdict) : "A-none";
  else if (shGrow >= SHIFT_PX) verdict = "B";
  else if (vpShift >= SHIFT_PX) verdict = "viewport";
  else if (shDrift > STEADY_PX) verdict = "sheet-drift";
  else verdict = "stable";

  return { verdict, dlgShift, shGrow, vpShift, shDrift, unit, scrolled };
}

// ---- 표본 측정 ----

const r1 = (n: number) => Math.round(n * 10) / 10;
const rn = (n: number | undefined | null) => (typeof n === "number" && Number.isFinite(n) ? r1(n) : null);

/** getComputedStyle(sheet).transform 의 translateY(px). matrix 6번째, matrix3d 14번째, none·빈 값은 0. DOMMatrix 에 기대지 않는다. */
function translateYOf(transform: string): number {
  const m = /^matrix(3d)?\(([^)]*)\)$/.exec(transform.trim());
  if (!m) return 0;
  const parts = m[2].split(",").map((x) => Number.parseFloat(x));
  const v = m[1] ? parts[13] : parts[5];
  return Number.isFinite(v) ? r1(v) : 0;
}

const UNIT_HEIGHTS = ["100dvh", "100svh", "100lvh", "100%", "", "env(safe-area-inset-bottom, 0px)"];

function makeUnitProbes(doc: Document): { box: HTMLElement; els: HTMLElement[] } {
  const box = doc.createElement("div");
  box.className = "mf-sheetdebug-probes";
  const els = UNIT_HEIGHTS.map((h) => {
    const el = doc.createElement("div");
    Object.assign(el.style, {
      position: "fixed",
      left: "0",
      top: "0",
      width: "1px",
      visibility: "hidden",
      pointerEvents: "none",
    });
    if (h) el.style.height = h;
    else el.style.bottom = "0"; // 높이 지정 없이 top 0 + bottom 0
    box.appendChild(el);
    return el;
  });
  doc.body.appendChild(box);
  return { box, els };
}

const heightOf = (el: Element) => rn(el.getBoundingClientRect().height);

function imgStateOf(sheet: HTMLElement | null): SheetImgState {
  const img = sheet?.querySelector("img");
  if (!img) return "none";
  if (img.complete) return (img.naturalWidth ?? 0) > 0 ? "loaded" : "error";
  return "pending";
}

function screenKind(doc: Document): string {
  if (doc.querySelector("main.mf-day")) return "day";
  if (doc.querySelector("main.mf-reveal")) return "reveal";
  if (doc.querySelector("main.mf-lobby")) return "lobby";
  if (doc.querySelector("main.mf-assign")) return "assign";
  return "other";
}

// ---- 패널 글자 ----

const cell = (v: number | string | boolean | null | undefined) => (v === null || v === undefined ? "-" : String(v));

function rowOf(s: SheetSample): string {
  return [s.t, s.ev, s.vvH, s.inH, s.dlgB, s.dlgH, s.shB, s.shH, s.shTY, s.cls, s.img].map(cell).join(" ");
}

const ROW_HEAD = "t ev vvH inH dlgB dlgH shB shH shTY cls img";
const UNIT_HEAD = "단위 dvh svh lvh pct ins safeB docSH scY vvTop";

function unitRow(s: SheetSample): string {
  return [s.ev, s.dvh, s.svh, s.lvh, s.pct, s.ins, s.safeB, s.docSH, s.scY, s.vvTop].map(cell).join(" ");
}

/** 표시할 행: 주요 시점·모든 사건 행 + 앞 표본보다 dlgB·shH·gap 이 STEADY_PX 이상 바뀐 raf 행(앞 CHANGE_ROWS 개, 끝에 <<) */
function visibleRows(samples: SheetSample[]): string[] {
  const rows: string[] = [];
  let changeRows = 0;
  samples.forEach((s, i) => {
    if (s.ev === "raf") {
      const prev = samples[i - 1];
      if (!prev || changeRows >= CHANGE_ROWS) return;
      const gs = gapOf(s);
      const gp = gapOf(prev);
      const moved =
        (s.dlgB !== null && prev.dlgB !== null && Math.abs(s.dlgB - prev.dlgB) >= STEADY_PX) ||
        (s.shH !== null && prev.shH !== null && Math.abs(s.shH - prev.shH) >= STEADY_PX) ||
        (gs !== null && gp !== null && Math.abs(gs - gp) >= STEADY_PX);
      if (!moved) return;
      changeRows += 1;
      rows.push(`${rowOf(s)} <<`);
      return;
    }
    rows.push(rowOf(s));
  });
  return rows;
}

function headerOf(rec: Pick<SheetTraceRecord, "n" | "label" | "screen" | "ua" | "dpr" | "screenH" | "standalone">): string {
  const os = /OS (\d+_\d+(?:_\d+)?)/.exec(rec.ua)?.[0] ?? "";
  const ver = /Version\/\d+(?:\.\d+)*/.exec(rec.ua)?.[0] ?? "";
  return [`#${rec.n}`, rec.label, rec.screen, os, ver, `dpr${rec.dpr}`, `sh${rec.screenH}`, rec.standalone ? "standalone" : "browser"]
    .filter((x) => x !== "")
    .join(" ");
}

function verdictLine(c: SheetClassification): string {
  return `판정 ${c.verdict} dlg ${c.dlgShift} sh ${c.shGrow} vp ${c.vpShift} drift ${c.shDrift} unit ${c.unit ?? "-"}`;
}

function listLine(rec: SheetTraceRecord): string {
  const c = classifyTrace(rec);
  const last = rec.samples[rec.samples.length - 1];
  return [
    `#${rec.n}`,
    rec.label,
    rec.screen,
    c.verdict,
    c.dlgShift,
    c.shGrow,
    c.vpShift,
    c.shDrift,
    c.unit ?? "-",
    last?.img ?? "-",
  ].join(" ");
}

// ---- 저장소 ----

function readRecords(storage: StorageLike | null): SheetTraceRecord[] {
  try {
    const raw = storage?.getItem(TRACES_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as SheetTraceRecord[]) : [];
  } catch {
    return [];
  }
}

function readSeq(storage: StorageLike | null, records: SheetTraceRecord[]): number {
  let seq = 0;
  try {
    seq = Number.parseInt(storage?.getItem(SEQ_KEY) ?? "0", 10) || 0;
  } catch {
    seq = 0;
  }
  const lastN = records.length > 0 ? records[records.length - 1].n : 0;
  return Math.max(seq, lastN);
}

export function createSheetProbe(options: { doc?: Document; storage?: StorageLike | null } = {}): SheetProbe {
  const doc = options.doc ?? document;
  const win = doc.defaultView;
  const storage = options.storage ?? null;
  let records = readRecords(storage);

  const panel = doc.createElement("div");
  panel.className = "mf-sheetdebug";
  panel.setAttribute("data-sheetdebug", "");
  const pre = doc.createElement("pre");
  pre.style.margin = "0";
  pre.style.whiteSpace = "pre-wrap";
  panel.appendChild(pre);
  const placeInBody = () => {
    Object.assign(panel.style, {
      position: "fixed",
      top: "35%",
      left: "0",
      right: "0",
      maxHeight: "50%",
      overflow: "hidden",
      pointerEvents: "none",
      zIndex: "1",
      font: "10px/1.25 ui-monospace, monospace",
      color: "var(--gray-50)",
      background: "var(--night-950)",
      opacity: "0.85",
    });
    doc.body.appendChild(panel);
  };
  const placeInDialog = (dialog: HTMLDialogElement) => {
    Object.assign(panel.style, { position: "absolute", top: "env(safe-area-inset-top)" });
    dialog.appendChild(panel);
  };

  const closedText = (): string => {
    if (records.length === 0) return "sheetdebug 켜짐 · 시트를 열면 기록합니다";
    const last = records[records.length - 1];
    return [
      "sheetdebug 켜짐 · 최근 기록",
      ...records
        .slice()
        .reverse()
        .map(listLine),
      "",
      headerOf(last),
      ROW_HEAD,
      ...visibleRows(last.samples),
    ].join("\n");
  };

  pre.textContent = closedText();
  placeInBody();

  return {
    start(target: SheetTraceTarget): SheetTrace {
      const t0 = Date.now();
      const prevText = pre.textContent ?? "";
      const n = readSeq(storage, records) + 1;
      const samples: SheetSample[] = [];
      const base = {
        n,
        label: target.label,
        screen: screenKind(doc),
        ua: win?.navigator?.userAgent ?? "",
        dpr: rn(win?.devicePixelRatio) ?? 1,
        screenH: rn(win?.screen?.height) ?? 0,
        standalone: (() => {
          try {
            return win?.matchMedia?.("(display-mode: standalone)")?.matches === true;
          } catch {
            return false;
          }
        })(),
        startedAt: new Date(t0).toISOString(),
      };
      const probes = makeUnitProbes(doc);
      let verdictText = "판정 기록 중… (1초)";

      const measure = (ev: string): SheetSample => {
        const vv = win?.visualViewport ?? null;
        const root = doc.documentElement;
        const dr = target.dialog.getBoundingClientRect();
        const sr = target.sheet?.getBoundingClientRect() ?? null;
        let shTY: number | null = null;
        if (target.sheet && win) {
          try {
            shTY = translateYOf(win.getComputedStyle(target.sheet).transform ?? "");
          } catch {
            shTY = null;
          }
        }
        const [dvh, svh, lvh, pct, ins, safeB] = probes.els.map(heightOf);
        const cls = target.dialog.classList.contains("mf-dialog--closing")
          ? "closing"
          : target.dialog.classList.contains("mf-dialog--open")
            ? "open"
            : "-";
        return {
          t: Math.round(Date.now() - t0),
          ev,
          vvH: rn(vv?.height),
          vvTop: rn(vv?.offsetTop),
          inH: rn(win?.innerHeight),
          docH: rn(root.clientHeight),
          docSH: rn(root.scrollHeight),
          scY: rn(win?.scrollY),
          dvh,
          svh,
          lvh,
          pct,
          ins,
          safeB,
          dlgT: rn(dr.top),
          dlgB: rn(dr.bottom),
          dlgH: rn(dr.height),
          shT: sr ? rn(sr.top) : null,
          shB: sr ? rn(sr.bottom) : null,
          shH: sr ? rn(sr.height) : null,
          shTY,
          cls,
          img: imgStateOf(target.sheet),
        };
      };

      const render = () => {
        const first = samples[0];
        const shown = samples.find((s) => s.ev === "shown");
        const last = samples[samples.length - 1];
        const units = [first, shown, last].filter((s): s is SheetSample => s !== undefined).map(unitRow);
        pre.textContent = [
          headerOf(base),
          ROW_HEAD,
          ...visibleRows(samples),
          UNIT_HEAD,
          ...units,
          verdictText,
        ].join("\n");
      };

      const add = (ev: string) => {
        samples.push(measure(ev));
        render();
      };

      let finished = false;
      let ended = false;
      let rafId: number | undefined;
      const timers: ReturnType<typeof setTimeout>[] = [];
      const cleanups: (() => void)[] = [];

      const listen = (
        tgt: EventTarget | null | undefined,
        type: string,
        handler: (e: Event) => void,
        opts?: AddEventListenerOptions,
      ) => {
        if (!tgt) return;
        tgt.addEventListener(type, handler, opts);
        cleanups.push(() => tgt.removeEventListener(type, handler, opts));
      };

      const teardown = () => {
        for (const t of timers) clearTimeout(t);
        timers.length = 0;
        if (rafId !== undefined) cancelAnimationFrame(rafId);
        rafId = undefined;
        for (const c of cleanups) c();
        cleanups.length = 0;
        probes.box.remove();
      };

      const finish = () => {
        if (finished) return;
        finished = true;
        teardown();
        const record: SheetTraceRecord = { ...base, samples, verdict: "" };
        const c = classifyTrace(record);
        record.verdict = c.verdict;
        records = [...records, record].slice(-MAX_TRACES);
        try {
          storage?.setItem(TRACES_KEY, JSON.stringify(records));
          storage?.setItem(SEQ_KEY, String(n));
        } catch {
          // 저장소가 막힌 환경: 이 탭 메모리 목록만 쓴다
        }
        console.info("[sheetdebug]", JSON.stringify(record));
        verdictText = verdictLine(c);
        render();
      };

      // 열기 전(before)과 패널 붙이기. 시트가 열려 있는 동안은 top layer 인 dialog 안에 붙여야 보인다.
      add("before");
      placeInDialog(target.dialog);
      render();

      // 사건 리스너 — 사건마다 표본 한 줄
      const onEvent = (ev: string) => () => {
        if (!finished) add(ev);
      };
      listen(win, "resize", onEvent("resize"), { passive: true });
      listen(win, "scroll", onEvent("scroll"), { passive: true });
      listen(win?.visualViewport, "resize", onEvent("vv-resize"));
      listen(win?.visualViewport, "scroll", onEvent("vv-scroll"));
      listen(target.sheet, "transitionend", (e) => {
        if ((e as TransitionEvent).propertyName === "transform" && !finished) add("tr-end");
      });
      const firstImg = target.sheet?.querySelector("img");
      if (firstImg && imgStateOf(target.sheet) === "pending") {
        listen(firstImg, "load", onEvent("img-load"));
        listen(firstImg, "error", onEvent("img-error"));
      }

      // 시점 표본: 100·200·300·500·1000ms, 마지막 시점에서 마무리
      for (const ms of TIMED_MS) {
        timers.push(
          setTimeout(() => {
            if (finished) return;
            add(`t${ms}`);
            if (ms >= TRACE_MS) finish();
          }, ms),
        );
      }

      // 매 프레임 표본 (TRACE_MS 까지)
      const loop = () => {
        rafId = requestAnimationFrame(() => {
          rafId = undefined;
          if (finished) return;
          if (Date.now() - t0 >= TRACE_MS) return;
          add("raf");
          loop();
        });
      };
      loop();

      return {
        mark(ev) {
          if (!finished) add(ev);
        },
        end() {
          if (ended) return;
          ended = true;
          const early = Date.now() - t0 < DISCARD_MS;
          if (!finished) {
            if (early) {
              // StrictMode 이중 effect: 저장·콘솔·패널 갱신 없이 버린다
              finished = true;
              teardown();
              pre.textContent = prevText;
            } else {
              finish();
            }
          }
          probes.box.remove();
          placeInBody();
          if (!early) pre.textContent = closedText();
        },
      };
    },
  };
}
