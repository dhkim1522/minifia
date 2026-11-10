// 18.1 화면 E2E (18.1-08) — 역할 확인 카드(R1)·시간대 배지(R4)의 판정·읽기와 새 흐름 polish-reveal.
// 판정은 순수 함수(playwright·네트워크 없음, 단위 시험은 polish.test.mjs)이고 흐름은 화면을 읽기만 한다.
// 결과 줄(detail)에는 크기·직업·단계·숫자·사각형만 싣는다 — 닉네임·토큰·채팅 본문은 싣지 않는다(T-18.1-15).
// 문턱은 UI-SPEC(18.1-UI-SPEC.md A1·A2·D) 값 그대로다. 실패를 줄이려고 낮추지 않는다. 앱 결함은 SUMMARY 에 분류해 남긴다.
// flows.mjs 가 이미 3천 줄이라 흐름 본문은 이 파일에 둔다: `makePolishFlows(helpers)` (host.mjs·tutorial.mjs 와 같은 모양, 서로 import 하지 않는다).
// helpers: { recorder, attempt, openGame, closeGame }
import { ROLE_LINES, rectInside, rectsOverlap } from "./lib.mjs";
import { closeRoleCard, openRoleCard, settle, skipTo, sleep } from "./browser.mjs";

// ---- 사본·UI-SPEC 값 ----

/** 역할 카드 문구의 카드 줄 수 상한(UI-SPEC A-1 계약 2·A1b) */
export const ROLE_CARD_MAX_LINES = 3;
/** 360×560 의사만 4줄 허용(알려진 한계, UI-SPEC A-1 계약 2) */
export const ROLE_CARD_MAX_LINES_SHORT_DOCTOR = 4;
/** [내 역할] 시트 문구 줄 수 상한(A1b) */
export const ROLE_SHEET_MAX_LINES = 4;
/** 튜토리얼 직업 카드 문구 줄 수 상한(A1b·A1f) */
export const TUTORIAL_ROLE_MAX_LINES = 4;
/** 직업 그림 높이 하한(A-1 계약 6·A1e) */
export const ROLE_ART_MIN_H = 64;
/** 카드 면 안쪽 틀선(.mf-card__face::after inset, A1e) */
export const CARD_INNER_INSET = 14;
/** 시간대 배지 한 변(D 계약 4) */
export const TOD_BOX = 44;
/** 배지의 헤더 안 세로 범위(D 계약 1: 위 8~52) */
export const TOD_HEADER_Y = Object.freeze([8, 52]);
/** 카드 위 끝과 소리 단추 독 아랫변의 최소 간격(P181-2, A2b) */
export const REVEAL_DOCK_GAP = 8;
/** 게임 헤더 높이(.mf-game__header, D4 — 배지가 헤더를 키우지 않는다) */
export const GAME_HEADER_H = 62;
/** 시간대 id 네 개, 표시 순서 (src/game/timeOfDay.ts TOD_ORDER 의 사본) */
export const TOD_IDS = Object.freeze(["morning", "day", "dusk", "night"]);
/** 게임 맵 단계 → 시간대 (src/game/timeOfDay.ts todOf 의 사본 — test/unit/e2eContract.test.ts 가 모든 키에서 같음을 고정한다) */
export const TOD_BY_PHASE = Object.freeze({
  dayAnnounce: "day",
  errand: "day",
  discussion: "day",
  nomination: "dusk",
  runoff: "dusk",
  showdown: "dusk",
  defense: "dusk",
  verdict: "dusk",
  execution: "dusk",
  night: "night",
  morning: "morning",
});
/** 배지를 그리지 않는 단계(대기실·튜토리얼·역할 배정·역할 확인·결과, D 계약 2) */
export const TOD_ABSENT_PHASES = Object.freeze(["lobby", "tutorial", "assigning", "roleReveal", "ended"]);

/** 허용 오차(px) — 반올림·서브픽셀 */
const TOL = 1;

// ---- 도우미 ----

const isNum = (x) => typeof x === "number" && Number.isFinite(x);
const isRect = (r) => r !== null && typeof r === "object" && isNum(r.left) && isNum(r.top) && isNum(r.width) && isNum(r.height);
const bottomOf = (r) => r.bottom ?? r.top + r.height;
const rightOf = (r) => r.right ?? r.left + r.width;
const row = (id, label, bad) => ({ id, label, ok: bad.length === 0, detail: bad.length === 0 ? "" : bad.join("; ") });
const noMeasure = (id, label, what) => row(id, label, [`측정값 없음(${what})`]);
const fmt = (n) => Math.round(n * 10) / 10;
const rectText = (r) => `(${fmt(r.left)},${fmt(r.top)} ${fmt(r.width)}×${fmt(r.height)})`;
const ROLE_NAMES = { mafia: "마피아", police: "경찰", doctor: "의사", citizen: "시민" };

/** 줄 수: 높이 ÷ 줄 높이(반올림), 인라인 글처럼 높이가 없으면 읽기가 센 lines */
function linesOf(b) {
  if (isNum(b.height) && isNum(b.lineHeight) && b.lineHeight > 0) return Math.round(b.height / b.lineHeight);
  return isNum(b.lines) ? b.lines : null;
}

/** 한 줄 문구 상자의 공통 문제 목록(줄바꿈 보존·첫 문장 한 줄·둘째 문장 새 줄·줄 수 상한) */
function lineBoxProblems(b, max, who) {
  const bad = [];
  const n = linesOf(b);
  if (n === null) return [`${who} 줄 수 측정값 없음`];
  if (b.whiteSpace !== "pre-line") bad.push(`${who} white-space ${b.whiteSpace} (기대 pre-line)`);
  if (b.firstLines !== 1) bad.push(`${who} 첫 문장 ${b.firstLines}줄 (기대 1줄)`);
  if (b.secondNewLine !== true) bad.push(`${who} 둘째 문장이 새 줄에서 시작하지 않음`);
  if (n > max) bad.push(`${who} ${n}줄 > 상한 ${max}줄`);
  if (n < 2) bad.push(`${who} ${n}줄 (기대 2줄 이상)`);
  return bad;
}

// ---- A1 역할 확인 카드 앞면 ----

/**
 * A1a~A1e 판정. 입력 m = { face, inner, children: [{ kind, rect }], desc: { height, lineHeight, whiteSpace, text, firstLines, secondNewLine }, blocks, goalCount, domText }
 *  face 카드 앞면 사각형 · inner 안쪽 14 틀선 사각형 · children 앞면 직접 자식(kind: art|name|desc|divider|mates) · desc 문구 요소 읽기
 *  blocks 앞면의 글 덩어리(p) 수 · goalCount 문서의 `.mf-goal`·`[data-role-goal]` 수 · domText 앞면 글자 전체.
 * ctx = { size: { w, h }, role }.
 * A1a 글 덩어리 = 이름 + 문구(마피아는 + 동료 줄), 목표 줄 0 · A1b 줄 구성(첫 문장 한 줄·둘째 문장 새 줄·pre-line·전체 ≤ 3줄, 360×560 의사만 4) ·
 * A1c 문구 = ROLE_LINES 사본 · A1d 다른 직업 문장 없음 · A1e 자식이 안쪽 틀 안·서로 교차 없음·그림 높이 ≥ 64.
 */
export function revealCardChecks(m, { size, role }) {
  const L = {
    A1a: "카드 글 덩어리가 이름 + 문구(마피아는 + 동료 줄)뿐이고 목표 줄이 없다",
    A1b: "문구 첫 줄이 한 줄·둘째 문장이 새 줄·전체 줄 수가 상한 이하",
    A1c: "문구가 ROLE_TEXT 와 글자 그대로 같다",
    A1d: "자기 직업의 문구만 있고 다른 직업의 문장은 없다",
    A1e: "카드 앞면 자식이 안쪽 틀 안에서 서로 겹치지 않고 직업 그림 높이 ≥ 64",
  };
  const ids = ["A1a", "A1b", "A1c", "A1d", "A1e"];
  if (m === null || typeof m !== "object") return ids.map((id) => noMeasure(id, L[id], "카드 앞면 읽기 값"));
  const out = [];

  // A1a
  if (!isNum(m.blocks) || !isNum(m.goalCount)) out.push(noMeasure("A1a", L.A1a, "글 덩어리·목표 줄 수"));
  else {
    const bad = [];
    const want = role === "mafia" ? 3 : 2;
    if (m.blocks !== want) bad.push(`${ROLE_NAMES[role] ?? role} 글 덩어리 ${m.blocks}개 (기대 ${want})`);
    if (m.goalCount !== 0) bad.push(`목표 줄 ${m.goalCount}개`);
    out.push(row("A1a", L.A1a, bad));
  }

  // A1b
  const d = m.desc;
  if (d === null || typeof d !== "object") out.push(noMeasure("A1b", L.A1b, "문구 요소"));
  else {
    const shortDoctor = role === "doctor" && size?.w === 360 && size?.h === 560;
    const max = shortDoctor ? ROLE_CARD_MAX_LINES_SHORT_DOCTOR : ROLE_CARD_MAX_LINES;
    out.push(row("A1b", L.A1b, lineBoxProblems(d, max, "카드")));
  }

  // A1c
  const want = ROLE_LINES[role];
  if (typeof d?.text !== "string") out.push(noMeasure("A1c", L.A1c, "문구 글자"));
  else out.push(row("A1c", L.A1c, d.text === want ? [] : [`문구가 ROLE_LINES.${role} 와 다름`]));

  // A1d
  if (typeof m.domText !== "string") out.push(noMeasure("A1d", L.A1d, "앞면 글자"));
  else {
    const bad = [];
    for (const [r, text] of Object.entries(ROLE_LINES)) {
      if (r === role) continue;
      for (const sentence of text.split("\n")) if (m.domText.includes(sentence)) bad.push(`${ROLE_NAMES[r]} 문장이 화면에 있음`);
    }
    out.push(row("A1d", L.A1d, bad));
  }

  // A1e
  const kids = Array.isArray(m.children) ? m.children : null;
  if (kids === null || kids.length === 0 || !isRect(m.inner) || !kids.every((c) => isRect(c.rect))) out.push(noMeasure("A1e", L.A1e, "자식·안쪽 틀 사각형"));
  else {
    const bad = [];
    for (const c of kids) {
      if (c.kind === "art") continue; // 그림은 높이 하한으로 따로 본다(UI-SPEC A1e: 그림 제외)
      if (!rectInside(c.rect, m.inner)) bad.push(`${c.kind} ${rectText(c.rect)} 가 안쪽 틀 ${rectText(m.inner)} 밖`);
    }
    for (let i = 0; i < kids.length; i++) for (let j = i + 1; j < kids.length; j++) if (rectsOverlap(kids[i].rect, kids[j].rect)) bad.push(`${kids[i].kind} 와 ${kids[j].kind} 겹침`);
    const art = kids.find((c) => c.kind === "art");
    if (!art) bad.push("직업 그림 없음");
    else if (art.rect.height < ROLE_ART_MIN_H - 0.5) bad.push(`직업 그림 높이 ${fmt(art.rect.height)} < ${ROLE_ART_MIN_H}`);
    out.push(row("A1e", L.A1e, bad));
  }
  return out;
}

// ---- A2 역할 확인 무대 ----

/**
 * A2a·A2b 판정. 입력 m = { tagsVisible, card, headerButtons: [rect], band, soundButtons: [rect], dock }
 * A2a 보이는 `.mf-world__tags .mv-tag` 0개 · A2b 카드 사각형이 헤더 단추·띠 면·소리 단추와 교차 0, 카드 위 끝 ≥ 소리 단추 독 아랫변 + 8.
 */
export function revealStageChecks(m) {
  const L = {
    A2a: "보이는 3D 이름표가 0개다",
    A2b: "카드가 헤더 단추·띠·소리 단추와 겹치지 않고 독 아랫변과 8 이상 떨어진다",
  };
  if (m === null || typeof m !== "object") return ["A2a", "A2b"].map((id) => noMeasure(id, L[id], "무대 읽기 값"));
  const out = [];
  if (!isNum(m.tagsVisible)) out.push(noMeasure("A2a", L.A2a, "이름표 수"));
  else out.push(row("A2a", L.A2a, m.tagsVisible === 0 ? [] : [`보이는 이름표 ${m.tagsVisible}개`]));

  const buttons = Array.isArray(m.headerButtons) ? m.headerButtons : null;
  const sounds = Array.isArray(m.soundButtons) ? m.soundButtons : null;
  if (!isRect(m.card) || buttons === null || sounds === null || !isRect(m.band) || !isRect(m.dock)) out.push(noMeasure("A2b", L.A2b, "카드·헤더 단추·띠·소리 단추·독 사각형"));
  else {
    const bad = [];
    buttons.forEach((b, i) => {
      if (rectsOverlap(m.card, b)) bad.push(`카드 ${rectText(m.card)} 가 헤더 단추 ${i} ${rectText(b)} 와 겹침`);
    });
    if (rectsOverlap(m.card, m.band)) bad.push(`카드 ${rectText(m.card)} 가 띠 ${rectText(m.band)} 와 겹침`);
    sounds.forEach((s, i) => {
      if (rectsOverlap(m.card, s)) bad.push(`카드 ${rectText(m.card)} 가 소리 단추 ${i} ${rectText(s)} 와 겹침`);
    });
    const gap = m.card.top - bottomOf(m.dock);
    if (gap < REVEAL_DOCK_GAP - 0.5) bad.push(`카드 위 끝이 독 아랫변보다 ${fmt(gap)} (기대 ≥ ${REVEAL_DOCK_GAP})`);
    out.push(row("A2b", L.A2b, bad));
  }
  return out;
}

// ---- 문구 상자(시트·튜토리얼 카드 공용) ----

/**
 * 한 줄 문구 상자 목록 판정 — [내 역할] 시트(max 4, id A1s)·튜토리얼 직업 카드(max 4, id TC6)가 쓴다. 한 줄(row) 하나를 돌려준다.
 * boxes[i] = { height, lineHeight 또는 lines, whiteSpace, firstLines, secondNewLine, goalCount? }, count 가 있으면 상자 개수가 그 수여야 한다.
 */
export function roleLineBoxChecks(boxes, { max, id, count }) {
  const label = `직업 문구가 pre-line·첫 문장 한 줄·둘째 문장 새 줄·${max}줄 이하`;
  if (!Array.isArray(boxes) || boxes.length === 0) return noMeasure(id, label, "문구 상자");
  const bad = [];
  if (count !== undefined && boxes.length !== count) bad.push(`문구 상자 ${boxes.length}개 (기대 ${count})`);
  boxes.forEach((b, i) => {
    const who = boxes.length > 1 ? `문구 ${i + 1}` : "문구";
    bad.push(...lineBoxProblems(b, max, who));
    if (isNum(b.goalCount) && b.goalCount > 0) bad.push(`목표 줄 ${b.goalCount}개`);
  });
  return row(id, label, bad);
}

// ---- D 시간대 배지 ----

/**
 * D1·D4·D5 판정(게임 맵 단계 하나). 입력 m = { count, tod, rect, radius, imgs: [{ src, naturalWidth, opacity }], title, roleBtn, band, soundButtons: [rect], header }
 * ctx = { phase }. 사각형은 같은 좌표계(보이는 화면)이고, 헤더 안 y 는 header.top 을 뺀 값으로 본다.
 * D1 배지 1개·값 = TOD_BY_PHASE[phase]·헤더 안(y 8~52 ±1)·제목·[역할 카드]·띠와 겹침 없음 ·
 * D4 사회자 띠·소리 단추 자리가 배지 때문에 밀리지 않음(배지가 둘과 겹치지 않고 헤더 높이 62) ·
 * D5 img 4장 모두 불러와짐·지금 시간대만 불투명도 1·44×44·원형.
 */
export function todChecks(m, { phase }) {
  const L = {
    D1: `시간대 배지가 하나·값 ${TOD_BY_PHASE[phase] ?? "?"}·헤더 안 제자리·제목·[역할 카드]·띠와 겹치지 않는다`,
    D4: "배지가 사회자 띠·소리 단추와 겹치지 않고 헤더 높이가 그대로다",
    D5: "배지 그림 4장이 불러와지고 지금 시간대만 보이며 44×44 원형이다",
  };
  if (m === null || typeof m !== "object") return ["D1", "D4", "D5"].map((id) => noMeasure(id, L[id], "배지 읽기 값"));
  const out = [];
  const want = TOD_BY_PHASE[phase];

  // D1
  if (!isNum(m.count)) out.push(noMeasure("D1", L.D1, "배지 수"));
  else {
    const bad = [];
    if (want === undefined) bad.push(`${phase} 는 배지가 있는 맵 단계가 아님`);
    if (m.count !== 1) bad.push(`배지 ${m.count}개 (기대 1)`);
    else {
      if (m.tod !== want) bad.push(`값 ${m.tod} (기대 ${want})`);
      if (!isRect(m.rect)) bad.push("측정값 없음(배지 사각형)");
      else {
        const top0 = isRect(m.header) ? m.header.top : 0;
        const y0 = m.rect.top - top0;
        const y1 = bottomOf(m.rect) - top0;
        if (y0 < TOD_HEADER_Y[0] - TOL || y1 > TOD_HEADER_Y[1] + TOL) bad.push(`배지 y ${fmt(y0)}~${fmt(y1)} (기대 ${TOD_HEADER_Y[0]}~${TOD_HEADER_Y[1]} ±${TOL})`);
        for (const [name, r] of [["제목", m.title], ["[역할 카드]", m.roleBtn], ["띠", m.band]]) {
          if (!isRect(r)) bad.push(`측정값 없음(${name} 사각형)`);
          else if (rectsOverlap(m.rect, r)) bad.push(`배지 ${rectText(m.rect)} 가 ${name} ${rectText(r)} 와 겹침`);
        }
      }
    }
    out.push(row("D1", L.D1, bad));
  }

  // D4
  if (!isRect(m.rect) || !isRect(m.band) || !Array.isArray(m.soundButtons) || !isRect(m.header)) out.push(noMeasure("D4", L.D4, "배지·띠·소리 단추·헤더 사각형"));
  else {
    const bad = [];
    if (rectsOverlap(m.rect, m.band)) bad.push(`배지가 띠 ${rectText(m.band)} 와 겹침`);
    m.soundButtons.forEach((s, i) => {
      if (rectsOverlap(m.rect, s)) bad.push(`배지가 소리 단추 ${i} ${rectText(s)} 와 겹침`);
    });
    if (Math.abs(m.header.height - GAME_HEADER_H) > TOL) bad.push(`헤더 높이 ${fmt(m.header.height)} (기대 ${GAME_HEADER_H})`);
    out.push(row("D4", L.D4, bad));
  }

  // D5
  const imgs = Array.isArray(m.imgs) ? m.imgs : null;
  if (imgs === null || !imgs.every((i) => isNum(i.naturalWidth) && isNum(i.opacity) && typeof i.src === "string") || !isRect(m.rect) || !isNum(m.radius)) out.push(noMeasure("D5", L.D5, "배지 그림·크기·반경"));
  else {
    const bad = [];
    if (imgs.length !== TOD_IDS.length) bad.push(`그림 ${imgs.length}장 (기대 ${TOD_IDS.length})`);
    imgs.forEach((i, k) => {
      if (i.naturalWidth <= 0) bad.push(`그림 ${k} 가 불러와지지 않음(naturalWidth ${i.naturalWidth})`);
    });
    const on = imgs.filter((i) => i.opacity > 0.99);
    const off = imgs.filter((i) => i.opacity < 0.01);
    if (on.length !== 1) bad.push(`불투명도 1 인 그림 ${on.length}장 (기대 1)`);
    else if (want !== undefined && !on[0].src.includes(`weather-${want}.svg`)) bad.push("보이는 그림이 지금 시간대가 아님");
    if (on.length + off.length !== imgs.length) bad.push("전환 중인 그림이 있음(불투명도가 0·1 이 아님)");
    if (Math.abs(m.rect.width - TOD_BOX) > TOL || Math.abs(m.rect.height - TOD_BOX) > TOL) bad.push(`배지 ${fmt(m.rect.width)}×${fmt(m.rect.height)} (기대 ${TOD_BOX}×${TOD_BOX})`);
    if (m.radius < TOD_BOX / 2) bad.push(`border-radius ${fmt(m.radius)} (기대 ≥ ${TOD_BOX / 2}, 원형)`);
    out.push(row("D5", L.D5, bad));
  }
  return out;
}

/** D2: 배지를 그리지 않는 화면에 `[data-tod]` 가 0개다. screen = 화면 이름(로비·역할 확인 등) */
export function todAbsentChecks(count, { screen }) {
  const label = `시간대 배지가 없다(${screen})`;
  if (!isNum(count)) return noMeasure("D2", label, "배지 수");
  return row("D2", label, count === 0 ? [] : [`배지 ${count}개 (기대 0)`]);
}

// ---- 페이지 읽기 ----

/** 역할 확인 카드 앞면 읽기(roleReveal, 뒤집힌 뒤). 앞면이 없으면 null */
export function readRevealCard(page) {
  return page.evaluate((inset) => {
    const rect = (el) => {
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
    };
    const face = document.querySelector(".mf-card__front");
    if (!face) return null;
    const fr = rect(face);
    const kindOf = (el) => {
      if (el.matches(".mf-card__art")) return "art";
      if (el.matches(".mf-card__desc")) return "desc";
      if (el.matches(".mf-card__divider")) return "divider";
      if (el.matches(".mf-card__mates")) return "mates";
      if (el.matches(".mf-t-display")) return "name";
      return "other";
    };
    const tops = (range) => {
      const t = [];
      for (const r of range.getClientRects()) if (r.width > 0 && !t.some((x) => Math.abs(x - r.top) < 3)) t.push(r.top);
      return t;
    };
    const descEl = face.querySelector(".mf-card__desc");
    let desc = null;
    if (descEl) {
      const cs = getComputedStyle(descEl);
      const node = [...descEl.childNodes].find((n) => n.nodeType === 3);
      const text = descEl.textContent ?? "";
      let firstLines = null;
      let secondNewLine = null;
      let lines = null;
      if (node) {
        const len = node.data.length;
        const idx = node.data.indexOf("\n");
        const all = document.createRange();
        all.setStart(node, 0);
        all.setEnd(node, len);
        lines = tops(all).length;
        if (idx > 0 && idx < len - 1) {
          const first = document.createRange();
          first.setStart(node, 0);
          first.setEnd(node, idx);
          const second = document.createRange();
          second.setStart(node, idx + 1);
          second.setEnd(node, idx + 2);
          const ft = tops(first);
          const st = tops(second);
          firstLines = ft.length;
          secondNewLine = st.length > 0 && st[0] > Math.max(...ft) + 3;
        }
      }
      desc = { height: descEl.getBoundingClientRect().height, lineHeight: parseFloat(cs.lineHeight), whiteSpace: cs.whiteSpace, text, firstLines, secondNewLine, lines };
    }
    return {
      face: fr,
      inner: { left: fr.left + inset, top: fr.top + inset, width: fr.width - inset * 2, height: fr.height - inset * 2, right: fr.right - inset, bottom: fr.bottom - inset },
      children: [...face.children].map((el) => ({ kind: kindOf(el), rect: rect(el) })),
      desc,
      blocks: face.querySelectorAll("p").length,
      goalCount: document.querySelectorAll(".mf-goal, [data-role-goal]").length,
      domText: face.textContent ?? "",
    };
  }, CARD_INNER_INSET);
}

/** 역할 확인 무대 읽기: 보이는 이름표 수와 카드·헤더 단추·띠·소리 단추·독 사각형 */
export function readRevealStage(page) {
  return page.evaluate(() => {
    const rect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
    };
    const shown = (el) => {
      const cs = getComputedStyle(el);
      return cs.visibility !== "hidden" && cs.display !== "none" && Number(cs.opacity) > 0 && el.getBoundingClientRect().width > 0;
    };
    return {
      tagsVisible: [...document.querySelectorAll(".mf-world__tags .mv-tag")].filter(shown).length,
      card: rect(document.querySelector(".mf-card")),
      headerButtons: [...document.querySelectorAll(".mf-reveal__header button")].filter(shown).map(rect),
      band: rect(document.querySelector("[data-host-band] .mv-host__band")),
      soundButtons: [...document.querySelectorAll(".mv-sound")].filter(shown).map(rect),
      dock: rect(document.querySelector("[data-host-band] .mv-host__dock")),
    };
  });
}

/**
 * 문구 상자 읽기(선택자에 맞는 요소마다): 높이·줄 높이·white-space·줄 수·첫 문장 줄 수·둘째 문장이 새 줄인지·문서의 목표 줄 수.
 * 인라인 요소(튜토리얼 카드 글)는 높이가 줄 높이를 뜻하지 않아 height 를 비우고 lines(글자 범위의 줄 수)만 둔다.
 */
export function readRoleLineBoxes(page, selector) {
  return page.evaluate((sel) => {
    const tops = (range) => {
      const t = [];
      for (const r of range.getClientRects()) if (r.width > 0 && !t.some((x) => Math.abs(x - r.top) < 3)) t.push(r.top);
      return t;
    };
    const goalCount = document.querySelectorAll(".mf-goal, [data-role-goal]").length;
    return [...document.querySelectorAll(sel)].map((el) => {
      const cs = getComputedStyle(el);
      const node = [...el.childNodes].find((n) => n.nodeType === 3);
      let lines = null;
      let firstLines = null;
      let secondNewLine = null;
      if (node) {
        const len = node.data.length;
        const idx = node.data.indexOf("\n");
        const all = document.createRange();
        all.setStart(node, 0);
        all.setEnd(node, len);
        lines = tops(all).length;
        if (idx > 0 && idx < len - 1) {
          const first = document.createRange();
          first.setStart(node, 0);
          first.setEnd(node, idx);
          const second = document.createRange();
          second.setStart(node, idx + 1);
          second.setEnd(node, idx + 2);
          const ft = tops(first);
          const st = tops(second);
          firstLines = ft.length;
          secondNewLine = st.length > 0 && st[0] > Math.max(...ft) + 3;
        }
      }
      const block = cs.display !== "inline";
      return { height: block ? el.getBoundingClientRect().height : null, lineHeight: parseFloat(cs.lineHeight), whiteSpace: cs.whiteSpace, lines, firstLines, secondNewLine, goalCount };
    });
  }, selector);
}

/** 시간대 배지 읽기: [data-tod] 수와(있으면) 값·사각형·반경·그림 네 장과 비교용 사각형. 그림 전환(420ms)이 끝나길 최대 1.2초 기다린다 */
export async function readTodBadge(page) {
  const read = () =>
    page.evaluate(() => {
      const rect = (el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { left: r.left, top: r.top, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
      };
      const shown = (el) => {
        const cs = getComputedStyle(el);
        return cs.visibility !== "hidden" && cs.display !== "none" && el.getBoundingClientRect().width > 0;
      };
      const els = [...document.querySelectorAll("[data-tod]")];
      const el = els[0] ?? null;
      return {
        count: els.length,
        tod: el ? el.getAttribute("data-tod") : null,
        rect: rect(el),
        radius: el ? parseFloat(getComputedStyle(el).borderTopLeftRadius) : null,
        imgs: el ? [...el.querySelectorAll("img")].map((i) => ({ src: i.getAttribute("src") ?? "", naturalWidth: i.naturalWidth, opacity: Number(getComputedStyle(i).opacity) })) : [],
        title: rect(document.querySelector(".mf-game__header .mv-phase__title")),
        roleBtn: rect(document.querySelector(".mf-game__header .mf-rolecard-btn")),
        band: rect(document.querySelector("[data-host-band] .mv-host__band")),
        soundButtons: [...document.querySelectorAll(".mv-sound")].filter(shown).map(rect),
        header: rect(document.querySelector(".mf-game__header")),
      };
    });
  let m = await read();
  for (let i = 0; i < 12 && m.count > 0 && m.imgs.some((x) => x.opacity > 0.01 && x.opacity < 0.99); i++) {
    await sleep(100);
    m = await read();
  }
  return m;
}

// ---- B 채팅 두 줄 창·기록 시트 (18.1-09) ----

/** 기록 칸 높이 (UI-SPEC B1, src/game/chatUi.ts LOG_H 의 사본 — e2eContract 가 lib.mjs LOG_H 와 같음을 고정한다) */
export const CHAT_LOG_H = 68;
/** 기록 칸 위 흐림 띠 높이(LOG_FADE_H 사본) — 이 띠 안은 '보이는 줄' 로 세지 않는다 */
export const CHAT_FADE_H = 12;
/** 기록 칸 안에 보이는 채팅 줄 상한(B2) */
export const CHAT_WINDOW_MAX_LINES = 2;
/** 입력칸·보내기 한 변(B1) */
export const CHAT_CONTROL_H = 48;
/** 기록 시트 끌어 닫기 거리 — Sheet 의 문턱 96 보다 크게 */
export const CHAT_SHEET_DRAG_PX = 120;
/** 닫기 시작 뒤 대화상자가 없어져야 하는 시간(ms) */
export const CHAT_SHEET_CLOSE_MS = 300;
/** B2 를 재려면 보낸 채팅 줄이 이만큼은 있어야 한다(공허 통과 금지) */
export const CHAT_MIN_LINES = 6;

/** 사각형 r 이 [bandTop, bandBottom] 띠와 겹친 높이 */
const overlapH = (r, bandTop, bandBottom) => Math.max(0, Math.min(bottomOf(r), bandBottom) - Math.max(r.top, bandTop));

/**
 * B1·B2(·B2L) 판정. m = { log, input, send, lineHeight, msgs } — 기록 칸·입력칸·보내기 사각형, 채팅 줄 높이(px), `.mv-chat__msg` 사각형들(시스템 줄 제외).
 * B1 기록 칸 높이 68±1·입력칸 48·보내기 48×48. B2 기록 칸의 [위 + 12, 아래] 띠 안에 줄 높이 절반 이상 보이는 채팅 줄이 1~2개
 * (보낸 줄이 6 미만이면 '측정 조건 미달' 로 실패 — 공허 통과 금지). long 이면 가장 새 줄(마지막)의 보이는 글줄 ≤ 2 이고 그 줄이 칸 아래를 넘치지 않음을 B2L 로 더한다.
 */
export function chatWindowChecks(m, { long = false } = {}) {
  const L = {
    B1: `기록 칸 ${CHAT_LOG_H}·입력칸 ${CHAT_CONTROL_H}·보내기 ${CHAT_CONTROL_H}x${CHAT_CONTROL_H}`,
    B2: `보낸 채팅 줄이 ${CHAT_MIN_LINES}개 이상일 때 기록 칸 안에 보이는 채팅 줄이 ${CHAT_WINDOW_MAX_LINES}개 이하`,
    B2L: "긴 줄: 기록 칸에 가장 새 줄의 끝 두 줄만 보이고 칸 아래를 넘치지 않는다",
  };
  const want = long ? ["B1", "B2", "B2L"] : ["B1", "B2"];
  const ok = m !== null && typeof m === "object" && isRect(m.log) && isRect(m.input) && isRect(m.send) && Array.isArray(m.msgs) && m.msgs.every(isRect) && isNum(m.lineHeight);
  if (!ok) return want.map((id) => noMeasure(id, L[id], "기록 칸·입력칸·보내기·줄 사각형"));
  const out = [];

  const bad1 = [];
  if (Math.abs(m.log.height - CHAT_LOG_H) > TOL) bad1.push(`기록 칸 ${fmt(m.log.height)} (기대 ${CHAT_LOG_H})`);
  if (Math.abs(m.input.height - CHAT_CONTROL_H) > TOL) bad1.push(`입력칸 ${fmt(m.input.height)} (기대 ${CHAT_CONTROL_H})`);
  if (Math.abs(m.send.height - CHAT_CONTROL_H) > TOL || Math.abs(m.send.width - CHAT_CONTROL_H) > TOL) bad1.push(`보내기 ${fmt(m.send.width)}x${fmt(m.send.height)} (기대 ${CHAT_CONTROL_H}x${CHAT_CONTROL_H})`);
  out.push(row("B1", L.B1, bad1));

  const bandTop = m.log.top + CHAT_FADE_H;
  const bandBottom = bottomOf(m.log);
  const visible = m.msgs.filter((r) => r.height > 0 && overlapH(r, bandTop, bandBottom) * 2 >= r.height);
  const bad2 = [];
  if (m.msgs.length < CHAT_MIN_LINES) bad2.push(`측정 조건 미달: 채팅 줄 ${m.msgs.length}개 (기대 ${CHAT_MIN_LINES}개 이상)`);
  else if (visible.length > CHAT_WINDOW_MAX_LINES) bad2.push(`보이는 채팅 줄 ${visible.length}개 > 상한 ${CHAT_WINDOW_MAX_LINES}개 (전체 ${m.msgs.length}줄)`);
  else if (visible.length < 1) bad2.push(`보이는 채팅 줄 0개 (전체 ${m.msgs.length}줄 — 창이 비어 있음)`);
  const r2 = row("B2", L.B2, bad2);
  out.push({ ...r2, detail: r2.ok ? `보이는 ${visible.length}줄 / 전체 ${m.msgs.length}줄` : r2.detail });

  if (long) {
    const last = m.msgs[m.msgs.length - 1];
    const bad = [];
    if (!last) bad.push("채팅 줄 없음");
    else {
      const n = Math.max(1, Math.round(last.height / m.lineHeight));
      let seen = 0;
      for (let i = 0; i < n; i++) {
        const line = { top: last.top + i * m.lineHeight, height: m.lineHeight };
        if (overlapH(line, bandTop, bandBottom) * 2 >= m.lineHeight) seen += 1;
      }
      if (seen > CHAT_WINDOW_MAX_LINES) bad.push(`보이는 글줄 ${seen}줄 > ${CHAT_WINDOW_MAX_LINES}줄 (가장 새 줄 ${n}글줄)`);
      if (seen < 1) bad.push(`보이는 글줄 0줄 (가장 새 줄 ${n}글줄)`);
      if (bottomOf(last) > bottomOf(m.log) + TOL) bad.push(`가장 새 줄 아래 끝 ${fmt(bottomOf(last))} > 기록 칸 아래 ${fmt(bottomOf(m.log))}`);
      const r = row("B2L", L.B2L, bad);
      out.push({ ...r, detail: r.ok ? `가장 새 줄 ${n}글줄 중 보이는 ${seen}줄` : r.detail });
      return out;
    }
    out.push(row("B2L", L.B2L, bad));
  }
  return out;
}

/**
 * B3·B4 판정. m = { open: { dialog, sheetClass, sheetLines, windowLines }, closes: [{ via, closed, focusOnOpenBtn }], draft: { before, after: [..] } }.
 * B3 [data-chat-open] 을 누르면 .mf-sheet--chatlog 대화상자가 열리고 시트 줄 수 ≥ 칸 줄 수, [닫기]·끌어 내리기·Esc 셋 모두 닫히고 포커스가 [data-chat-open] 으로 돌아온다.
 * B4 입력칸의 쓰던 글이 열고 닫는 내내 그대로(처음부터 비어 있으면 잴 것이 없어 실패).
 */
export function chatSheetChecks(m) {
  const L = {
    B3: "[data-chat-open] 이 기록 시트를 열고 [닫기]·끌어 내리기·Esc 로 닫히며 포커스가 [data-chat-open] 으로 돌아온다",
    B4: "입력칸에 쓰던 글이 시트를 열고 닫아도 그대로다",
  };
  const ok = m !== null && typeof m === "object" && m.open && typeof m.open === "object" && Array.isArray(m.closes) && m.draft && typeof m.draft === "object" && Array.isArray(m.draft.after);
  if (!ok) return ["B3", "B4"].map((id) => noMeasure(id, L[id], "시트 열기·닫기·입력칸 읽기"));
  const bad3 = [];
  if (m.open.dialog !== true) bad3.push("시트(dialog)가 열리지 않음");
  else if (m.open.sheetClass !== true) bad3.push(".mf-sheet--chatlog 가 아님");
  if (!isNum(m.open.sheetLines) || !isNum(m.open.windowLines)) bad3.push("줄 수 측정값 없음");
  else if (m.open.sheetLines < m.open.windowLines) bad3.push(`시트 줄 ${m.open.sheetLines}개 < 칸 줄 ${m.open.windowLines}개`);
  for (const via of ["button", "escape", "drag"]) {
    const c = m.closes.find((x) => x && x.via === via);
    if (!c) bad3.push(`${via} 로 닫기를 재지 못함`);
    else {
      if (c.closed !== true) bad3.push(`${via}: ${CHAT_SHEET_CLOSE_MS}ms 안에 안 닫힘`);
      if (c.focusOnOpenBtn !== true) bad3.push(`${via}: 포커스가 [data-chat-open] 이 아님${typeof c.active === "string" ? `(지금 ${c.active})` : ""}`);
    }
  }
  const bad4 = [];
  const { before, after } = m.draft;
  if (typeof before !== "string" || before === "") bad4.push("처음 입력칸이 비어 있음(잴 것이 없음)");
  else after.forEach((v, i) => v !== before && bad4.push(`${i + 1}번째 닫은 뒤 입력칸 ${typeof v === "string" ? v.length : "?"}자 (기대 ${before.length}자 그대로)`));
  if (after.length < 3) bad4.push(`닫은 뒤 읽기 ${after.length}번 (기대 3번)`);
  return [row("B3", L.B3, bad3), row("B4", L.B4, bad4)];
}

/**
 * 채팅 두 줄 창 읽기: 기록 칸·입력칸·보내기 사각형, 채팅 줄 높이, `.mv-chat__msg` 사각형들, 칸 안 줄(시스템·카드 포함) 수, [data-chat-open] 수. 칸이 없으면 null.
 * 채팅 본문·닉네임은 읽지 않는다(T-18.1-19).
 */
export function readChatWindow(page) {
  return page.evaluate(() => {
    const rect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
    };
    const log = document.querySelector("[data-chat-log]");
    if (!log) return null;
    const msgs = [...log.querySelectorAll(".mv-chat__msg")];
    return {
      log: rect(log),
      input: rect(document.querySelector("[data-chat-input]")),
      send: rect(document.querySelector("[data-chat-send]")),
      lineHeight: msgs[0] ? parseFloat(getComputedStyle(msgs[0]).lineHeight) : 24,
      msgs: msgs.map(rect),
      allLines: log.children.length - log.querySelectorAll("[data-chat-notice]").length,
      openButtons: document.querySelectorAll("[data-chat-open]").length,
    };
  });
}

/** 기록 시트 읽기: 열린 .mf-sheet--chatlog 대화상자 수, 시트 안 줄 수, activeElement 가 [data-chat-open] 인지, 입력칸 값, 대화상자 수. */
export function readChatSheet(page) {
  return page.evaluate(() => {
    const dialogs = [...document.querySelectorAll("dialog[open]")];
    const sheet = document.querySelector("dialog[open] .mf-sheet--chatlog");
    const list = document.querySelector("[data-chat-sheet-log]");
    const input = document.querySelector("[data-chat-input]");
    return {
      dialogs: dialogs.length,
      sheetClass: sheet !== null,
      sheetLines: list ? list.children.length : 0,
      focusOnOpenBtn: document.activeElement === document.querySelector("[data-chat-open]"),
      // 포커스가 어디 있는지(진단용): 태그 + data-* 속성 이름만, 글자는 싣지 않는다
      active: document.activeElement ? `${document.activeElement.tagName.toLowerCase()}${[...document.activeElement.attributes].filter((a) => a.name.startsWith("data-")).map((a) => `[${a.name}]`).join("")}` : "없음",
      inputValue: input ? input.value : null,
    };
  });
}

/**
 * 기록 시트 한 바퀴: [data-chat-open] 을 눌러 열고, via(button·escape·drag)로 닫는다. 닫힘은 닫는 동작이 끝난 시각부터 CHAT_SHEET_CLOSE_MS 안에
 * dialog[open] 이 없어지는 것, 포커스는 닫힌 직후 activeElement 가 [data-chat-open] 인지 본다. 못 닫히면 Esc 로 정리해 다음 바퀴가 이어지게 한다.
 * 돌려주는 값: { opened: readChatSheet(열린 직후), close: { via, closed, focusOnOpenBtn }, input: 닫은 뒤 입력칸 값 }.
 */
async function chatSheetRound(page, via) {
  await page.locator("[data-chat-open]").click({ timeout: 4000 });
  await page.waitForSelector("dialog[open] .mf-sheet--chatlog", { timeout: 3000 });
  await sleep(350); // 올라오는 연출이 끝나길 기다린다(끌기 잡이가 제자리에 있도록)
  const opened = await readChatSheet(page);
  if (via === "button") await page.locator('dialog[open] [aria-label="닫기"]').click({ timeout: 3000 });
  else if (via === "escape") await page.keyboard.press("Escape");
  else {
    const h = await page.locator("dialog[open] .mf-sheet__handle").boundingBox();
    if (!h) throw new Error("끌기 손잡이를 찾지 못함");
    const x = h.x + h.width / 2;
    const y = h.y + h.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + CHAT_SHEET_DRAG_PX / 2, { steps: 6 });
    await page.mouse.move(x, y + CHAT_SHEET_DRAG_PX + 20, { steps: 6 });
    await page.mouse.up();
  }
  const t0 = performance.now();
  let closed = false;
  try {
    await page.waitForFunction(() => document.querySelector("dialog[open]") === null, null, { timeout: CHAT_SHEET_CLOSE_MS + 400, polling: "raf" });
    closed = performance.now() - t0 <= CHAT_SHEET_CLOSE_MS;
  } catch {
    closed = false;
  }
  const after = await readChatSheet(page);
  if (after.dialogs > 0) {
    await page.keyboard.press("Escape");
    await sleep(500);
  }
  return { opened, close: { via, closed, focusOnOpenBtn: after.focusOnOpenBtn, active: after.active }, input: after.inputValue };
}

/**
 * 기록 시트 열고 닫기 B3·B4 의 읽기 전부: 입력칸에 draft 를 넣고, 시트를 [닫기]·Esc·끌기로 세 번 열고 닫는다.
 * 돌려주는 값은 chatSheetChecks 의 입력 모양이다. 닫는 길이 하나 실패해도 나머지는 계속 잰다.
 */
export async function measureChatSheet(page, draft) {
  await page.locator("[data-chat-input]").fill(draft);
  const before = await page.locator("[data-chat-input]").inputValue();
  const windowLines = (await readChatWindow(page))?.allLines ?? null;
  let open = null;
  const closes = [];
  const after = [];
  for (const via of ["button", "escape", "drag"]) {
    const r = await chatSheetRound(page, via);
    if (open === null) open = { dialog: r.opened.dialogs > 0, sheetClass: r.opened.sheetClass, sheetLines: r.opened.sheetLines, windowLines };
    closes.push(r.close);
    after.push(r.input);
  }
  return { open, closes, draft: { before, after } };
}

// ---- C 산 사람 화면 유령·유령 화면 직업 의상 (18.1-09) ----

/** 직업 → 유령 의상(src/world/ghostOutfit.ts 표 사본, flows.mjs GHOST_JOB_OUTFIT 과 같은 값). 알 수 없으면 coat */
export const GHOST_JOB_OUTFIT_E2E = Object.freeze({ mafia: "mafia", police: "police", doctor: "doctor", citizen: "coat" });
/** 산 사람 화면이 탈락자 유령을 그리지 않는 단계(밤·심부름 — 서버가 본인(+근처)만 보내는 단계, 18.1-02 선택) */
export const LIVE_GHOST_ABSENT_PHASES = Object.freeze(["night", "errand"]);
/** 유령이 걷기 전·후 산 사람 화면의 유령 자리가 같다고 보는 허용 오차(월드 단위) */
export const GHOST_STILL_TOL = 0.05;

const isSeatNum = (n) => Number.isInteger(n) && n >= 0;

/**
 * C1·C2 판정(산 사람 화면 유령). m = readLiveGhost 의 값 { hook, seats: [{ seat, shown, ghostTags, chips }], outfits, roleChips, ghostSeats }.
 * ctx = { deadSeats, phase }. 밤·심부름(LIVE_GHOST_ABSENT_PHASES)이 아니면 C1 = 탈락 좌석마다 마지막 자리(shown)에 actor 가 있고 `.mv-tag.is-ghost` 이름표가 정확히 1개이며
 * 훅 의상 표(__mfGhostOutfits)는 없거나 빈 표(산 사람 화면 유령은 훅 표가 아니라 안개 actor 다, L13). 밤·심부름이면 기대가 반대 — shown null·유령 이름표 0.
 * C2 = [data-role-chip]·[data-ghost-seat] 이 0개(신분 단서 없음, 결정 0021) — 단계와 무관.
 */
export function liveGhostChecks(m, { deadSeats, phase } = {}) {
  const L = {
    C1: "탈락 좌석이 코트 안개 유령으로 남는다(마지막 자리 actor·is-ghost 이름표 1·의상 훅 표 없음, 밤·심부름은 그리지 않음)",
    C2: "산 사람 화면에 직업 칩·죽은 자리 표식이 0개다",
  };
  const ok = m !== null && typeof m === "object" && m.hook === true && Array.isArray(m.seats) && Array.isArray(deadSeats) && deadSeats.length > 0 && deadSeats.every(isSeatNum);
  if (!ok) return ["C1", "C2"].map((id) => noMeasure(id, L[id], "월드 훅·탈락 좌석 읽기"));
  const absent = LIVE_GHOST_ABSENT_PHASES.includes(phase);
  const bad1 = [];
  for (const seat of deadSeats) {
    const r = m.seats.find((x) => x && x.seat === seat);
    if (!r) {
      bad1.push(`좌석 ${seat} 측정값 없음(읽기 없음)`);
      continue;
    }
    const drawn = r.shown !== null && r.shown !== undefined;
    if (absent) {
      if (drawn) bad1.push(`좌석 ${seat} ${phase} 단계인데 유령 actor 가 있음`);
      if (r.ghostTags !== 0) bad1.push(`좌석 ${seat} ${phase} 단계인데 유령 이름표 ${r.ghostTags}개`);
    } else {
      if (!drawn) bad1.push(`좌석 ${seat} 마지막 자리 actor 없음(shown null)`);
      if (r.ghostTags !== 1) bad1.push(`좌석 ${seat} 유령 이름표(.mv-tag.is-ghost) ${r.ghostTags}개 (기대 1)`);
    }
    if (m.outfits !== null && m.outfits !== undefined && Object.prototype.hasOwnProperty.call(m.outfits, seat)) bad1.push(`좌석 ${seat} 가 의상 훅 표에 있음(${m.outfits[seat]})`);
  }
  const bad2 = [];
  if (!isNum(m.roleChips) || !isNum(m.ghostSeats)) bad2.push("칩·표식 수 측정값 없음");
  else {
    if (m.roleChips !== 0) bad2.push(`[data-role-chip] ${m.roleChips}개`);
    if (m.ghostSeats !== 0) bad2.push(`[data-ghost-seat] ${m.ghostSeats}개`);
  }
  for (const r of m.seats) if (r && isNum(r.chips) && r.chips !== 0) bad2.push(`좌석 ${r.seat} 이름표에 직업 칩 ${r.chips}개`);
  return [row("C1", L.C1, bad1), row("C2", L.C2, bad2)];
}

/**
 * C3 판정(유령 화면). m = readLiveGhost 의 값(유령 페이지에서) — seats: [{ seat, chips, ghostTags }], outfits(__mfGhostOutfits 표).
 * ctx = { jobs: { 좌석: 직업 }, seats? } — 탈락 좌석 전원(기본: jobs 의 키)이 직업 칩 1개·`.mv-tag.is-ghost` 1개·의상 = 그 직업 의상(GHOST_JOB_OUTFIT_E2E, 모르면 coat)이어야 한다.
 * 한 좌석이라도 사람 모습(의상 표에 없음)으로 남으면 실패.
 */
export function ghostViewChecks(m, { jobs = {}, seats } = {}) {
  const label = "유령 화면: 탈락 좌석 전원이 직업 칩 1개·유령 이름표·그 직업의 유령 의상이다";
  const list = seats ?? Object.keys(jobs).map(Number);
  const ok = m !== null && typeof m === "object" && Array.isArray(m.seats) && m.outfits !== null && typeof m.outfits === "object" && m.outfits !== undefined && list.length > 0;
  if (!ok) return [noMeasure("C3", label, "유령 화면 읽기·의상 표")];
  const bad = [];
  for (const seat of list) {
    const r = m.seats.find((x) => x && x.seat === seat);
    if (!r) {
      bad.push(`좌석 ${seat} 측정값 없음(읽기 없음)`);
      continue;
    }
    if (r.chips !== 1) bad.push(`좌석 ${seat} 직업 칩 ${r.chips}개 (기대 1)`);
    if (r.ghostTags !== 1) bad.push(`좌석 ${seat} 유령 이름표 ${r.ghostTags}개 (기대 1)`);
    const want = GHOST_JOB_OUTFIT_E2E[jobs[seat]] ?? "coat";
    const got = m.outfits[seat];
    if (got !== want) bad.push(`좌석 ${seat} 의상 ${got ?? "없음(사람 모습)"} (기대 ${want}, 직업 ${jobs[seat] ?? "?"})`);
  }
  return [row("C3", label, bad)];
}

/** GH12(뜻 바뀜, C-6): 유령이 걷는 동안 산 사람 화면의 유령 자리(shown)가 그대로다 — 서버가 유령 구간을 보내지 않으므로 마지막 자리에 서 있는다 */
export function ghostStillChecks(before, after) {
  const label = "유령이 걷는 동안 산 사람 화면의 유령 자리(shown)가 바뀌지 않는다";
  if (before === null && after === null) return noMeasure("GH12", label, "걷기 전·후 유령 자리");
  const bad = [];
  if (before === null || after === null) bad.push(before === null ? "걷기 전에 유령 자리가 없음" : "걷기 뒤 유령 자리가 사라짐");
  else if (![before.x, before.z, after.x, after.z].every(isNum)) bad.push("자리 값이 숫자가 아님");
  else {
    const d = Math.hypot(after.x - before.x, after.z - before.z);
    if (d > GHOST_STILL_TOL) bad.push(`자리가 ${fmt(d)} 만큼 옮겨짐 (허용 ${GHOST_STILL_TOL}, (${fmt(before.x)},${fmt(before.z)}) → (${fmt(after.x)},${fmt(after.z)}))`);
  }
  return row("GH12", label, bad);
}

/**
 * 산 사람/유령 화면 유령 읽기(테스트 훅이 켜진 문맥에서만 값이 있다): 좌석마다 window.__mfWorld.shown(seat) 와 그 좌석 이름표의 `.mv-tag.is-ghost`·직업 칩 수,
 * 페이지 전체 [data-role-chip]·[data-ghost-seat] 수, window.__mfGhostOutfits 표(없으면 null). 닉네임·글자는 읽지 않는다(T-18.1-19).
 */
export function readLiveGhost(page, seats) {
  return page.evaluate((list) => {
    const w = window.__mfWorld;
    const tagOf = (seat) => document.querySelector(`.mf-world__tag[data-seat="${seat}"]`);
    return {
      hook: w !== undefined && typeof w.shown === "function",
      seats: list.map((seat) => {
        const sh = w ? w.shown(seat) : null;
        const tag = tagOf(seat);
        return {
          seat,
          shown: sh ? { x: sh.x, z: sh.z } : null,
          ghostTags: tag ? tag.querySelectorAll(".mv-tag.is-ghost").length : 0,
          chips: tag ? tag.querySelectorAll("[data-role-chip]").length : 0,
        };
      }),
      outfits: window.__mfGhostOutfits === undefined ? null : { ...window.__mfGhostOutfits },
      roleChips: document.querySelectorAll("[data-role-chip]").length,
      ghostSeats: document.querySelectorAll("[data-ghost-seat]").length,
    };
  }, seats);
}

/**
 * 찬반 기록 카드 overflow backstop(UI-SPEC UI Considerations): 기록 칸에서 창보다 큰 시스템 카드는 위가 잘리고, 기록 시트에서는 카드 전체가 목록 안에 보여야 한다.
 * 칸에 찬반 카드(`[data-card="ballots"]`)가 있으면 칸 스크린샷을 남기고, 시트를 열어 카드를 목록 안으로 스크롤한 뒤 사각형을 읽고 시트 스크린샷을 남기고 닫는다.
 * 돌려주는 값: { measured: false, why } 또는 { measured: true, cardH, windowH, cutTop(칸에서 위가 잘린 높이), sheetFits(시트 목록 안에 카드 전체가 듦), listH }. 카드 안 글은 읽지 않는다.
 */
export async function measureBallotsBackstop(page, { windowShot, sheetShot }) {
  const win = await page.evaluate(() => {
    const rect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, height: r.height };
    };
    const log = document.querySelector("[data-chat-log]");
    const cards = log ? [...log.querySelectorAll('[data-card="ballots"]')] : [];
    return { log: rect(log), card: rect(cards[cards.length - 1] ?? null), open: document.querySelector("[data-chat-open]") !== null };
  });
  if (!win.log) return { measured: false, why: "기록 칸이 없음" };
  if (!win.card) return { measured: false, why: "찬반 기록 카드가 기록에 없음" };
  if (!win.open) return { measured: false, why: "[data-chat-open] 이 없음" };
  await page.locator("[data-chat-log]").screenshot({ path: windowShot });
  await page.locator("[data-chat-open]").click({ timeout: 4000 });
  await page.waitForSelector("dialog[open] .mf-sheet--chatlog", { timeout: 3000 });
  await sleep(400);
  const sheet = await page.evaluate(() => {
    const list = document.querySelector("[data-chat-sheet-log]");
    const cards = list ? [...list.querySelectorAll('[data-card="ballots"]')] : [];
    const card = cards[cards.length - 1];
    if (!list || !card) return { missing: true, list: list !== null, lines: list ? list.children.length : 0, allCards: document.querySelectorAll('[data-card="ballots"]').length, dialogs: document.querySelectorAll("dialog[open]").length };
    card.scrollIntoView({ block: "nearest" });
    const l = list.getBoundingClientRect();
    const c = card.getBoundingClientRect();
    return { listH: l.height, cardH: c.height, fits: c.top >= l.top - 1 && c.bottom <= l.bottom + 1 };
  });
  await sleep(100);
  await page.screenshot({ path: sheetShot });
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.querySelector("dialog[open]") === null, null, { timeout: 2000 }).catch(() => {});
  if (sheet.missing) return { measured: false, why: `시트 목록에 찬반 기록 카드가 없음(목록 ${sheet.list ? "있음" : "없음"}·줄 ${sheet.lines}개·문서 전체 찬반 카드 ${sheet.allCards}개·열린 대화상자 ${sheet.dialogs}개)` };
  return { measured: true, cardH: sheet.cardH, windowH: win.log.height, cutTop: Math.max(0, win.log.top - win.card.top), sheetFits: sheet.fits, listH: sheet.listH };
}

// ---- 흐름 ----

/** 판정 줄 목록을 한 줄(통과면 비움, 아니면 실패 id 와 이유)로 접는다 */
const fold = (lines) => {
  const bad = lines.filter((l) => !l.ok);
  return { ok: bad.length === 0, detail: bad.map((l) => `${l.id} ${l.detail}`).join(" / ") };
};

/** 네 직업, 시민이 먼저 */
const REVEAL_ROLES = ["citizen", "mafia", "police", "doctor"];

export function makePolishFlows({ recorder, attempt, openGame, closeGame }) {
  /** 카드의 위치·크기가 두 번 연속 같아질 때까지(최대 2.4초) 기다린다 — 올라오기·뒤집기 연출이 끝난 뒤에 잰다 */
  async function waitCardStable(page, selector) {
    let prev = "";
    for (let i = 0; i < 24; i++) {
      const key = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        if (!el) return "";
        const r = el.getBoundingClientRect();
        return [r.left, r.top, r.width, r.height].map((n) => Math.round(n * 10)).join(",");
      }, selector);
      if (key !== "" && key === prev) return true;
      prev = key;
      await sleep(100);
    }
    return false;
  }

  /**
   * polish-reveal (18.1-08, R1): 크기마다 네 직업(시민·마피아·경찰·의사)을 차례로 —
   * 역할 확인에서 카드 뒤(A2: 이름표 0·겹침 없음) → 뒤집은 앞면(A1a~A1e) → [내 역할] 시트(A1s: 문구 줄 수·목표 줄 없음).
   * 방장 한 명 + 봇 5(6명판 — 4명판은 의사가 없고, 6명판은 마피아가 둘이라 동료 줄에 이름이 들어간다). 결과 줄 detail 에는 크기·직업·숫자만 싣는다.
   */
  async function polishRevealFlow(ctx) {
    const id = "polish-reveal";
    const rec = recorder(ctx);
    for (const role of REVEAL_ROLES) {
      const sc = `${id}/${role}`;
      const game = await openGame(ctx, id, { guests: 0, bots: 5, role, to: null });
      try {
        const { hp, ht } = game;
        await attempt(async () => {
          await hp.waitForSelector(".mf-card", { timeout: 6000 });
          await waitCardStable(hp, ".mf-card");
          await settle(hp);
        });
        // 뒤집기 전: 무대(A2)
        const stage = await attempt(async () => {
          const m = await readRevealStage(hp);
          const f = fold(revealStageChecks(m));
          return { ok: f.ok, detail: f.detail };
        });
        rec(sc, "A2", `역할 확인 무대: 이름표 0·카드가 단추·띠·소리 단추와 겹치지 않음(${ctx.size.label}, ${role})`, stage.ok, stage.detail);

        // 뒤집기: 카드를 눌러 앞면을 연다
        const flipped = await attempt(async () => {
          await hp.locator(".mf-card").first().click({ timeout: 4000 });
          await hp.waitForSelector(".mf-card--front", { timeout: 4000 });
          await waitCardStable(hp, ".mf-card__front .mf-card__art");
          await settle(hp);
        });
        rec(sc, "A1x", `카드를 눌러 앞면이 열린다(${ctx.size.label}, ${role})`, flipped.ok, flipped.detail);
        if (flipped.ok) {
          const lines = await attempt(async () => {
            const m = await readRevealCard(hp);
            const rows = revealCardChecks(m, { size: ctx.size, role });
            for (const r of rows) rec(sc, r.id, `${r.label} (${ctx.size.label}, ${role})`, r.ok, r.detail);
            const art = m?.children?.find((c) => c.kind === "art");
            const n = m?.desc ? (isNum(m.desc.height) && m.desc.lineHeight > 0 ? Math.round(m.desc.height / m.desc.lineHeight) : m.desc.lines) : null;
            rec(sc, "A1i", `참고 측정(${ctx.size.label}, ${role}): 문구 ${n}줄, 직업 그림 높이 ${art ? fmt(art.rect.height) : "?"}`, true, `문구 ${n}줄, 그림 높이 ${art ? fmt(art.rect.height) : "?"}`, true);
          });
          if (!lines.ok) rec(sc, "A1r", `앞면을 읽는다(${ctx.size.label}, ${role})`, false, lines.detail);
        }

        // [내 역할] 시트: 낮 시작으로 넘긴 뒤 연다
        const sheet = await attempt(async () => {
          await skipTo(hp, ht, "dayAnnounce");
          await openRoleCard(hp);
          const boxes = await readRoleLineBoxes(hp, 'dialog[aria-label="역할 카드"] .mf-rolecard__desc');
          const r = roleLineBoxChecks(boxes, { max: ROLE_SHEET_MAX_LINES, id: "A1s", count: 1 });
          rec(sc, r.id, `[내 역할] 시트 ${r.label} (${ctx.size.label}, ${role})`, r.ok, r.detail);
          await closeRoleCard(hp);
        });
        if (!sheet.ok) rec(sc, "A1t", `[내 역할] 시트를 연다(${ctx.size.label}, ${role})`, false, sheet.detail);
      } finally {
        await closeGame(game);
      }
    }
  }

  return { polishRevealFlow };
}
