// 시트 진입 위치 계측 본체(G-01-9) — 지연 로드 청크. 트레이서 최소형: before·shown·focused·entered 표본을 패널에 보인다.
// 시트 안 글자·그림 주소는 읽지 않는다(T-01-62). 기하 값과 label 만 남긴다.
import type { StorageLike } from "../net/session";
import type { SheetMark, SheetProbe, SheetTrace, SheetTraceTarget } from "./sheetProbe";

type EvName = "before" | SheetMark;

interface SheetSample {
  t: number;
  ev: EvName;
  vvH: number | null;
  inH: number | null;
  dlgB: number | null;
  shB: number | null;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

function takeSample(t0: number, ev: EvName, target: SheetTraceTarget): SheetSample {
  const win = target.dialog.ownerDocument.defaultView;
  const vv = win?.visualViewport ?? null;
  return {
    t: Math.round(Date.now() - t0),
    ev,
    vvH: vv ? r1(vv.height) : null,
    inH: win ? r1(win.innerHeight) : null,
    dlgB: r1(target.dialog.getBoundingClientRect().bottom),
    shB: target.sheet ? r1(target.sheet.getBoundingClientRect().bottom) : null,
  };
}

const cell = (v: number | string | null) => (v === null ? "-" : String(v));

export function createSheetProbe(options: { doc?: Document; storage?: StorageLike | null } = {}): SheetProbe {
  const doc = options.doc ?? document;
  const panel = doc.createElement("div");
  panel.className = "mf-sheetdebug";
  panel.setAttribute("data-sheetdebug", "");
  const pre = doc.createElement("pre");
  panel.appendChild(pre);
  pre.textContent = "sheetdebug 켜짐 · 시트를 열면 기록합니다";
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

  return {
    start(target: SheetTraceTarget): SheetTrace {
      const t0 = Date.now();
      const samples: SheetSample[] = [];
      const render = () => {
        const rows = samples.map((s) => [s.t, s.ev, s.vvH, s.inH, s.dlgB, s.shB].map(cell).join(" "));
        pre.textContent = [`${target.label}`, "t ev vvH inH dlgB shB", ...rows].join("\n");
      };
      const add = (ev: EvName) => {
        samples.push(takeSample(t0, ev, target));
        render();
      };
      add("before");
      // 시트가 열려 있는 동안은 top layer 인 dialog 안에 붙여야 보인다.
      target.dialog.appendChild(panel);
      Object.assign(panel.style, { position: "absolute", top: "env(safe-area-inset-top)" });
      render();
      return {
        mark(ev) {
          add(ev);
        },
        end() {
          Object.assign(panel.style, { position: "fixed", top: "35%" });
          doc.body.appendChild(panel);
        },
      };
    },
  };
}
