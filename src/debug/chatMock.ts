// ?chat-mock=1 하단 채팅 배치 시안(UI-SPEC "하단 채팅 레이아웃 확인", RESEARCH R7). 제품 화면이 아니다 — 지연 로드 청크로만 열린다(perfProbe.initPerfDebug).
// 7페이즈가 쓸 배치가 iOS 키보드 앞에서 되는지를 실기기에서 확인한다: 채팅 기록(96~152) + 입력줄(입력 48·[감정표현]·[보내기] 48) + 행동 줄(52),
// 패널 night-800 97%. 키보드가 열리면 패널이 visualViewport 기준으로 키보드 바로 위에 붙고, 캔버스는 재할당하지 않으며(크기 고정)
// 카메라 중심(setView offsetY)만 남은 영역 가운데로 옮긴다. 이벤트마다 값을 기록해 접이식 패널에 보여 준다. 보내기는 아무 데도 보내지 않는다(로그만).
// 글자는 textContent 로만 넣는다(innerHTML 없음).
import { BAR_SPAWNS, UNIT } from "../../shared/game/map";
import { MOVE_V } from "../../shared/game/world";
import { HEADER_BOTTOM } from "../world/camera";
import { createWorldRuntime } from "../world/runtime";
import { WorldStore } from "../world/store";
import { SPIKE_NAMES, makeTag } from "./perf/tags";
import "../styles/world.css";
import "../styles/v2.css";

/** 채팅 기록 칸 최소·최대 높이(px) */
const LOG_MIN = 96;
const LOG_MAX = 152;
/** 입력줄·행동 줄 높이(px) */
const INPUT_H = 48;
const ACTION_H = 52;
/** 포커스·블러 뒤 이만큼 기다렸다가 한 번 더 잰다(ms): 키보드 애니메이션이 끝난 값 */
const SETTLE_SAMPLE_MS = [300, 1000];
/** 로그 줄 수 상한(오래된 것부터 버린다) */
const LOG_MAX_LINES = 300;
/** 기록 칸에 보일 예시 메시지(8줄, 16px) */
const EXAMPLE_MESSAGES: readonly [string, string][] = [
  ["별빛여우", "다들 안녕"],
  ["달토끼", "오늘 누가 마피아일까?"],
  ["마피아왕", "나는 시민이야"],
  ["조용한밤", "일단 지켜보자"],
  ["고양이탐정", "수상한 사람 있어"],
  ["수상한손님", "저 아니에요!"],
  ["반짝이", "투표는 신중하게"],
  ["시민일호", "첫날은 의견 모으자"],
];

export interface ChatMock {
  dispose(): void;
}

const css = (el: HTMLElement, text: string): void => {
  el.style.cssText = text;
};

function svgIcon(path: string): SVGSVGElement {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", "24");
  svg.setAttribute("height", "24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  const p = document.createElementNS(ns, "path");
  p.setAttribute("d", path);
  svg.append(p);
  return svg;
}

export function mount(root: HTMLElement, _search: URLSearchParams): ChatMock {
  const t0 = performance.now();
  const vv = window.visualViewport;
  /** 캔버스 높이는 처음 한 번 정해 고정한다 — 키보드가 열려도 줄이지 않는다 */
  const canvasH = window.innerHeight;

  const stage = document.createElement("div");
  stage.className = "mf-world is-open";
  css(stage, "position:fixed;left:0;top:0;width:100%;overflow:hidden");
  stage.style.height = `${canvasH}px`;
  stage.dataset.chatMock = "";
  const host = document.createElement("div");
  host.className = "mf-world__canvas";
  const tags = document.createElement("div");
  tags.className = "mf-world__tags";
  const players = SPIKE_NAMES.map((nickname, seat) => ({ seat, nickname, connected: true }));
  for (const pl of players) tags.append(makeTag(pl.seat, pl.nickname, pl.seat === 0));
  stage.append(host, tags);

  // ----- 헤더(시안) -----
  const header = document.createElement("div");
  css(header, `position:fixed;left:0;top:0;right:0;height:${HEADER_BOTTOM}px;z-index:var(--z-modal);display:flex;align-items:center;justify-content:center;background:color-mix(in srgb, var(--night-950) 80%, transparent);color:var(--gray-100);font:700 16px/1 var(--font-ui)`);
  header.textContent = "헤더 (시안)";

  // ----- 아래 패널: 기록 + 입력줄 + 행동 줄 -----
  const panel = document.createElement("div");
  css(panel, "position:fixed;left:0;right:0;bottom:0;z-index:var(--z-modal);box-sizing:border-box;display:flex;flex-direction:column;gap:var(--space-sm);padding:14px 16px calc(22px + env(safe-area-inset-bottom));border-radius:var(--radius-lg) var(--radius-lg) 0 0;background:color-mix(in srgb, var(--night-800) 97%, transparent);font-family:var(--font-ui)");
  const log = document.createElement("div");
  css(log, `display:flex;flex-direction:column;justify-content:flex-end;gap:var(--space-xs);min-height:${LOG_MIN}px;max-height:${LOG_MAX}px;overflow-y:auto;box-sizing:border-box;padding:var(--space-sm) 12px;border-radius:var(--radius-badge);background:var(--night-900)`);
  EXAMPLE_MESSAGES.forEach(([name, text], seat) => {
    const line = document.createElement("p");
    css(line, "margin:0;font-size:16px;line-height:1.5;color:var(--gray-100);word-break:keep-all;overflow-wrap:anywhere");
    const dot = document.createElement("span");
    css(dot, `display:inline-block;width:8px;height:8px;margin-right:6px;border-radius:var(--radius-pill);vertical-align:2px;background:var(--seat-${seat + 1})`);
    const who = document.createElement("span");
    css(who, "margin-right:6px;color:var(--gray-50)");
    who.textContent = name;
    const body = document.createElement("span");
    body.textContent = text;
    line.append(dot, who, body);
    log.append(line);
  });
  log.scrollTop = log.scrollHeight;

  const form = document.createElement("form");
  css(form, "display:flex;gap:var(--space-sm)");
  const iconStyle = `display:grid;place-items:center;flex:none;width:${INPUT_H}px;height:${INPUT_H}px;padding:0;border-radius:var(--radius-md);cursor:pointer`;
  const emote = document.createElement("button");
  emote.type = "button";
  emote.setAttribute("aria-label", "감정표현");
  css(emote, `${iconStyle};border:1px solid var(--night-600);background:var(--night-700);color:var(--gray-100)`);
  emote.append(svgIcon("M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-3.5-9.5h.01M15.5 11.5h.01M8.5 15a5 5 0 0 0 7 0"));
  const input = document.createElement("input");
  input.type = "text";
  input.name = "chat";
  input.maxLength = 100;
  input.autocomplete = "off";
  input.setAttribute("autocapitalize", "off");
  input.setAttribute("enterkeyhint", "send");
  input.setAttribute("aria-label", "채팅 입력");
  css(input, `flex:1;min-width:0;height:${INPUT_H}px;box-sizing:border-box;padding:0 var(--space-md);border-radius:var(--radius-md);border:1px solid var(--night-600);background:var(--night-900);color:var(--gray-100);font-family:inherit;font-size:16px`);
  const send = document.createElement("button");
  send.type = "submit";
  send.setAttribute("aria-label", "보내기");
  css(send, `${iconStyle};border:0;background:var(--gray-100);color:var(--night-900)`);
  send.append(svgIcon("M5 12h14M13 6l6 6-6 6"));
  form.append(emote, input, send);

  const action = document.createElement("button");
  action.type = "button";
  css(action, `height:${ACTION_H}px;border:0;border-radius:var(--radius-md);background:var(--night-700);color:var(--gray-100);font:700 16px/1 var(--font-ui)`);
  action.textContent = "행동 줄 (시안)";
  panel.append(log, form, action);

  // ----- 기록 패널(접이식) -----
  const details = document.createElement("details");
  css(details, "position:fixed;left:6px;right:6px;top:70px;z-index:calc(var(--z-modal) + 1);border-radius:8px;background:rgba(0,0,0,.78);color:#fff;font:11px/1.45 ui-monospace,Menlo,monospace");
  const summary = document.createElement("summary");
  css(summary, "padding:4px 8px;cursor:pointer");
  summary.textContent = "측정 기록 (펼치기)";
  const pre = document.createElement("pre");
  css(pre, "margin:0;padding:0 8px 8px;max-height:36vh;overflow:auto;white-space:pre-wrap;word-break:break-all");
  const copy = document.createElement("button");
  copy.type = "button";
  copy.textContent = "복사";
  css(copy, "margin:0 8px 8px;font:inherit;color:#fff;background:rgba(255,255,255,.2);border:0;border-radius:4px;padding:2px 10px");
  details.append(summary, pre, copy);

  root.append(stage, header, panel, details);

  // ----- 월드: 서 있는 8명(걷지 않는다), 같은 런타임·talk 조명 -----
  const store = new WorldStore();
  const wall0 = Date.now();
  store.applyFrame(
    {
      t: "world",
      k: "snap",
      at: wall0,
      ents: BAR_SPAWNS.map((sp, s) => ({ s, p: [Math.round(sp.x * UNIT), Math.round(sp.z * UNIT)], t0: wall0, v: MOVE_V })),
    },
    1,
  );
  const seenCue = { getItem: () => "1", setItem: () => {}, removeItem: () => {}, clear: () => {}, key: () => null, length: 0 } as unknown as Storage;
  /** 카메라가 보는 영역의 위·아래 끝(캔버스 좌표). 아래 끝 = 보이는 화면 아래 끝 − 패널 높이 */
  const stageRect = (): { top: number; bottom: number } => {
    const visibleBottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
    return { top: HEADER_BOTTOM, bottom: Math.max(HEADER_BOTTOM + 1, visibleBottom - panel.offsetHeight) };
  };
  const runtime = createWorldRuntime({
    host,
    tagLayer: tags,
    store,
    serverNow: Date.now,
    mySeat: () => 0,
    players: () => players,
    reducedMotion: () => false,
    stageRect,
    onStatus: () => {},
    onNotice: () => {},
    allowSoftware: true,
    autoDegrade: false,
    lighting: "talk",
    storage: seenCue,
  });

  // ----- 기록 -----
  const lines: string[] = [];
  const stamp = (): string => `+${Math.round(performance.now() - t0)}ms`;
  const fmt = (n: number | undefined, d = 1): string => (n === undefined ? "-" : String(Math.round(n * 10 ** d) / 10 ** d));
  const add = (text: string): void => {
    lines.push(`${stamp()} ${text}`);
    if (lines.length > LOG_MAX_LINES) lines.shift();
    pre.textContent = lines.join("\n");
    pre.scrollTop = pre.scrollHeight;
  };

  /** 지금 화면 값: 실기기에서만 의미 있는 것들 */
  const snapshot = (): string => {
    const visibleBottom = vv ? vv.offsetTop + vv.height : window.innerHeight;
    const pr = panel.getBoundingClientRect();
    const ir = input.getBoundingClientRect();
    const me = runtime.sample(0);
    const head = me && runtime.renderer() ? runtime.renderer()!.project({ x: me.x, y: 1.1, z: me.z }) : null;
    const rect = stageRect();
    const inStage = head !== null && head.sy >= rect.top && head.sy <= rect.bottom;
    return [
      `vv.h=${fmt(vv?.height)} vv.top=${fmt(vv?.offsetTop)} vv.pageTop=${fmt(vv?.pageTop)} vv.scale=${fmt(vv?.scale, 2)}`,
      `innerH=${window.innerHeight} clientH=${document.documentElement.clientHeight} scrollY=${fmt(window.scrollY)}`,
      `패널아래-보이는아래=${fmt(pr.bottom - visibleBottom)} (0 이하면 안 가려짐) 입력줄아래-보이는아래=${fmt(ir.bottom - visibleBottom)}`,
      `캔버스=${host.clientWidth}x${host.clientHeight} RO호출=${roCalls}`,
      `내 캐릭터 y=${head ? fmt(head.sy) : "-"} 영역=[${fmt(rect.top)}, ${fmt(rect.bottom)}] ${inStage ? "안" : "밖"}`,
    ].join("\n    ");
  };

  // 캔버스 호스트 ResizeObserver: 처음 관찰 직후의 호출은 세지 않는다(그 뒤 호출이 0 이어야 한다)
  let roCalls = 0;
  let roSeenFirst = false;
  const ro = new ResizeObserver(() => {
    if (!roSeenFirst) {
      roSeenFirst = true;
      return;
    }
    roCalls += 1;
    add(`ResizeObserver 호출 #${roCalls} → ${host.clientWidth}x${host.clientHeight}  (0 이어야 한다)`);
  });
  ro.observe(host);

  // 패널을 키보드 바로 위에 붙인다: 레이아웃 뷰포트 아래 끝에서 보이는 영역 아래 끝까지의 거리만큼 올린다
  let lastVvEventAt = 0;
  const place = (): void => {
    const lift = vv ? Math.max(0, window.innerHeight - (vv.height + vv.offsetTop)) : 0;
    panel.style.bottom = `${lift}px`;
  };
  const onVv = (ev: Event): void => {
    place();
    lastVvEventAt = performance.now();
    add(`vv.${ev.type} h=${fmt(vv?.height)} top=${fmt(vv?.offsetTop)} scrollY=${fmt(window.scrollY)}`);
  };
  vv?.addEventListener("resize", onVv);
  vv?.addEventListener("scroll", onVv);
  place();

  // 포커스·블러: 그 순간과 뒤 값, 정착 시간, 닫을 때 튐
  let focusAt = 0;
  let before = { scrollY: 0, pageTop: 0 };
  const timers: ReturnType<typeof setTimeout>[] = [];
  const onFocus = (): void => {
    focusAt = performance.now();
    before = { scrollY: window.scrollY, pageTop: vv?.pageTop ?? 0 };
    add(`포커스\n    ${snapshot()}`);
    SETTLE_SAMPLE_MS.forEach((ms) => timers.push(setTimeout(() => add(`포커스 +${ms}ms\n    ${snapshot()}`), ms)));
    timers.push(
      setTimeout(() => {
        const settle = lastVvEventAt >= focusAt ? Math.round(lastVvEventAt - focusAt) : 0;
        add(`포커스 → 패널 정착 시간 ${settle}ms (마지막 vv 이벤트까지)`);
      }, Math.max(...SETTLE_SAMPLE_MS) + 50),
    );
  };
  const onBlur = (): void => {
    const blurAt = performance.now();
    add(`블러\n    ${snapshot()}`);
    timers.push(
      setTimeout(() => {
        const dy = window.scrollY - before.scrollY;
        const dp = (vv?.pageTop ?? 0) - before.pageTop;
        add(`블러 +${Math.round(performance.now() - blurAt)}ms 닫힌 뒤: scrollY 튐=${fmt(dy)} pageTop 튐=${fmt(dp)} (0 이면 안 튐)\n    ${snapshot()}`);
      }, 1000),
    );
  };
  input.addEventListener("focus", onFocus);
  input.addEventListener("blur", onBlur);

  // 한글 조합과 Enter: WebKit 은 compositionend 를 Enter keydown 보다 먼저 줘서 isComposing 이 이미 false 일 수 있다(RESEARCH R7)
  let lastCompEnd = -Infinity;
  const comp = (ev: CompositionEvent): void => {
    if (ev.type === "compositionend") lastCompEnd = ev.timeStamp;
    add(`${ev.type} data=${JSON.stringify(ev.data)} ts=${fmt(ev.timeStamp)}`);
  };
  input.addEventListener("compositionstart", comp);
  input.addEventListener("compositionupdate", comp);
  input.addEventListener("compositionend", comp);
  const onKey = (ev: KeyboardEvent): void => {
    if (ev.key !== "Enter") return;
    const since = Number.isFinite(lastCompEnd) ? fmt(ev.timeStamp - lastCompEnd) : "-";
    add(`Enter keydown isComposing=${ev.isComposing} keyCode=${ev.keyCode} compositionend 뒤 ${since}ms`);
  };
  input.addEventListener("keydown", onKey);

  form.addEventListener("submit", (ev) => {
    ev.preventDefault();
    add(`보내기 눌림 (보내지 않음) 길이=${input.value.length}`);
    input.value = "";
  });
  emote.addEventListener("click", () => add("감정표현 눌림"));
  action.addEventListener("click", () => add("행동 줄 눌림"));
  copy.addEventListener("click", () => {
    void navigator.clipboard?.writeText(lines.join("\n")).catch(() => {});
  });

  add(`시작 (캔버스 높이 ${canvasH}px 고정)\n    ${snapshot()}`);
  void runtime.start();

  return {
    dispose() {
      timers.forEach(clearTimeout);
      vv?.removeEventListener("resize", onVv);
      vv?.removeEventListener("scroll", onVv);
      ro.disconnect();
      runtime.dispose();
      for (const el of [stage, header, panel, details]) el.remove();
    },
  };
}
