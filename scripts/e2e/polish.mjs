// 18.1 화면 E2E (18.1-08) — 역할 확인 카드(R1)·시간대 글자(R4, 0083-1)의 판정·읽기와 새 흐름 polish-reveal.
// 판정은 순수 함수(playwright·네트워크 없음, 단위 시험은 polish.test.mjs)이고 흐름은 화면을 읽기만 한다.
// 결과 줄(detail)에는 크기·직업·단계·숫자·사각형만 싣는다 — 닉네임·토큰·채팅 본문은 싣지 않는다(T-18.1-15).
// 문턱은 UI-SPEC(18.1-UI-SPEC.md A1·A2·D) 값 그대로다. 실패를 줄이려고 낮추지 않는다. 앱 결함은 SUMMARY 에 분류해 남긴다.
// flows.mjs 가 이미 3천 줄이라 흐름 본문은 이 파일에 둔다: `makePolishFlows(helpers)` (host.mjs·tutorial.mjs 와 같은 모양, 서로 import 하지 않는다).
// helpers: { recorder, attempt, openGame, closeGame }
import { ROLE_LINES, rectInside, rectsOverlap } from "./lib.mjs";
import { closeRoleCard, openRoleCard, settle, skipTo, sleep } from "./browser.mjs";

// ---- 사본·UI-SPEC 값 ----

// 줄 수 상한 넷은 2026-11-12 에 하나씩 낮췄다(3·4·4·4 → 2·3·3·3). 사용자 요청으로 첫 문장(정체 선언, 언제나 한 줄)을 없애 문구가 할 일 한 문장만 남았고,
// 남은 문장은 글자·글꼴·열 폭이 그대로라 접히는 자리도 그대로다 — 줄 수가 정확히 한 줄 줄어든다(UI-SPEC A-1 확정 문구 표의 "둘째 문장 폭" 189·173·190·219px).
/** 역할 카드 문구의 카드 줄 수 상한(UI-SPEC A-1 계약 2·A1b) — 안쪽 146px 에서 시민·마피아·경찰 2줄 */
export const ROLE_CARD_MAX_LINES = 2;
/** 360×560 의사만 3줄 허용(알려진 한계, UI-SPEC A-1 계약 2 — 219px 문장이 146px 에서 세 줄로 접힌다) */
export const ROLE_CARD_MAX_LINES_SHORT_DOCTOR = 3;
/** [내 역할] 시트 문구 줄 수 상한(A1b) */
export const ROLE_SHEET_MAX_LINES = 3;
/** 튜토리얼 직업 카드 문구 줄 수 상한(A1b·A1f) — 열 130px@360 에서 의사 3줄 */
export const TUTORIAL_ROLE_MAX_LINES = 3;
/** 직업 그림 높이 하한(A-1 계약 6·A1e) */
export const ROLE_ART_MIN_H = 64;
/** 카드 면 안쪽 틀선(.mf-card__face::after inset, A1e) */
export const CARD_INNER_INSET = 14;
/** 헤더 시간대 글자 한 줄 높이 상한(24px × 줄 높이 1.2 ≈ 29 — 두 줄이면 58, 0083-1) */
export const TOD_LINE_MAX_H = 40;
/** 카드 위 끝과 소리 단추 독 아랫변의 최소 간격(P181-2, A2b) */
export const REVEAL_DOCK_GAP = 8;
/** 게임 헤더 높이(.mf-game__header, D4 — 시간대 글자가 헤더를 키우지 않는다) */
export const GAME_HEADER_H = 62;
/** 시간대 id 네 개, 표시 순서 (src/game/timeOfDay.ts TOD_ORDER 의 사본) */
export const TOD_IDS = Object.freeze(["morning", "day", "dusk", "night"]);
/** 시간대 → 헤더 낱말 (src/game/timeOfDay.ts TOD_LABEL 의 사본 — test/unit/e2eContract.test.ts 가 같음을 고정한다) */
export const TOD_WORD = Object.freeze({ morning: "아침", day: "낮", dusk: "저녁", night: "밤" });
/** 낱말 요소 없이 단계 이름 한 단어로만 쓰는 시간대(밤·아침 — 단계 이름이 낱말과 같다, 0083-1) */
const ONE_WORD_TODS = Object.freeze(["morning", "night"]);
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
/** 시간대 글자를 그리지 않는 단계(대기실·튜토리얼·역할 배정·역할 확인·결과, D 계약 2) */
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

/** 문구 상자의 공통 문제 목록: 한 문장(줄바꿈 문자 없음 — newlines 는 글자 안의 \n 수)·줄 수 1 이상 상한 이하 */
function lineBoxProblems(b, max, who) {
  const bad = [];
  const n = linesOf(b);
  if (n === null) return [`${who} 줄 수 측정값 없음`];
  if (b.newlines !== 0) bad.push(`${who} 줄바꿈 문자 ${isNum(b.newlines) ? `${b.newlines}개` : "측정값 없음"} (기대 0 — 한 문장)`);
  if (n > max) bad.push(`${who} ${n}줄 > 상한 ${max}줄`);
  if (n < 1) bad.push(`${who} ${n}줄 (기대 1줄 이상)`);
  return bad;
}

// ---- A1 역할 확인 카드 앞면 ----

/**
 * A1a~A1e 판정. 입력 m = { face, inner, children: [{ kind, rect }], desc: { height, lineHeight, text, newlines, lines }, blocks, goalCount, domText }
 *  face 카드 앞면 사각형 · inner 안쪽 14 틀선 사각형 · children 앞면 직접 자식(kind: art|name|desc|divider|mates) · desc 문구 요소 읽기
 *  blocks 앞면의 글 덩어리(p) 수 · goalCount 문서의 `.mf-goal`·`[data-role-goal]` 수 · domText 앞면 글자 전체.
 * ctx = { size: { w, h }, role }.
 * A1a 글 덩어리 = 이름 + 문구(마피아는 + 동료 줄), 목표 줄 0 · A1b 한 문장(줄바꿈 문자 없음)·전체 ≤ 2줄(360×560 의사만 3) ·
 * A1c 문구 = ROLE_LINES 사본 · A1d 다른 직업 문장 없음 · A1e 자식이 안쪽 틀 안·서로 교차 없음·그림 높이 ≥ 64.
 */
export function revealCardChecks(m, { size, role }) {
  const L = {
    A1a: "카드 글 덩어리가 이름 + 문구(마피아는 + 동료 줄)뿐이고 목표 줄이 없다",
    A1b: "문구가 한 문장(줄바꿈 문자 없음)이고 전체 줄 수가 상한 이하",
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
      if (m.domText.includes(text)) bad.push(`${ROLE_NAMES[r]} 문장이 화면에 있음`);
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
 * 문구 상자 목록 판정 — [내 역할] 시트(max 3, id A1s)·튜토리얼 직업 카드(max 3, id TC6)가 쓴다. 한 줄(row) 하나를 돌려준다.
 * boxes[i] = { height, lineHeight 또는 lines, newlines, goalCount? }, count 가 있으면 상자 개수가 그 수여야 한다.
 */
export function roleLineBoxChecks(boxes, { max, id, count }) {
  const label = `직업 문구가 한 문장(줄바꿈 문자 없음)·${max}줄 이하`;
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

// ---- D 헤더 시간대 글자 (0083-1) ----

/**
 * D1·D4·D5 판정(게임 맵 단계 하나). 입력 m = { count, tod, word, titleText, line, title, header, headerButtons: [rect], oldBadges, weatherImgs } (readTodHead).
 * ctx = { phase }. 사각형은 같은 좌표계(보이는 화면)다.
 * D1 [data-tod] 하나·값 = TOD_BY_PHASE[phase]·낱말 규칙(밤·아침은 낱말 요소 없음, 낮·저녁은 TOD_WORD 낱말) ·
 * D4 헤더 높이 62·시간대 글자가 한 줄·글자 오른쪽 끝이 헤더 단추 왼쪽 끝을 넘지 않음 ·
 * D5 옛 날씨 배지(.mv-tod) 0개·날씨 그림 요소 0개.
 */
export function todChecks(m, { phase }) {
  const L = {
    D1: `시간대 글자가 하나·값 ${TOD_BY_PHASE[phase] ?? "?"}·낱말 규칙대로다(밤·아침은 한 단어)`,
    D4: "헤더 높이가 그대로고 시간대 글자가 한 줄이며 헤더 단추와 겹치지 않는다",
    D5: "옛 날씨 배지와 날씨 그림이 없다",
  };
  if (m === null || typeof m !== "object") return ["D1", "D4", "D5"].map((id) => noMeasure(id, L[id], "시간대 글자 읽기 값"));
  const out = [];
  const want = TOD_BY_PHASE[phase];

  // D1
  if (!isNum(m.count)) out.push(noMeasure("D1", L.D1, "[data-tod] 수"));
  else {
    const bad = [];
    if (want === undefined) bad.push(`${phase} 는 시간대 글자가 있는 맵 단계가 아님`);
    if (m.count !== 1) bad.push(`[data-tod] ${m.count}개 (기대 1)`);
    else {
      if (m.tod !== want) bad.push(`값 ${m.tod} (기대 ${want})`);
      if (want !== undefined) {
        if (ONE_WORD_TODS.includes(want)) {
          if (m.word !== null) bad.push(`${want} 는 한 단어인데 낱말 요소 '${m.word}' 가 있음`);
        } else if (m.word !== TOD_WORD[want]) bad.push(`낱말 ${m.word === null ? "없음" : `'${m.word}'`} (기대 '${TOD_WORD[want]}')`);
      }
      if (typeof m.titleText !== "string" || m.titleText === "") bad.push("측정값 없음(단계 이름 글자)");
    }
    out.push(row("D1", L.D1, bad));
  }

  // D4
  if (!isRect(m.line) || !isRect(m.title) || !isRect(m.header) || !Array.isArray(m.headerButtons) || !m.headerButtons.every(isRect)) out.push(noMeasure("D4", L.D4, "헤더 줄·제목·헤더·헤더 단추 사각형"));
  else {
    const bad = [];
    if (Math.abs(m.header.height - GAME_HEADER_H) > TOL) bad.push(`헤더 높이 ${fmt(m.header.height)} (기대 ${GAME_HEADER_H})`);
    if (m.line.height > TOD_LINE_MAX_H) bad.push(`헤더 줄 높이 ${fmt(m.line.height)} (한 줄 상한 ${TOD_LINE_MAX_H} — 줄이 바뀜)`);
    const right = Math.max(rightOf(m.line), rightOf(m.title));
    m.headerButtons.forEach((b, i) => {
      if (right > b.left + TOL) bad.push(`헤더 줄 오른쪽 끝 ${fmt(right)} 가 헤더 단추 ${i} 왼쪽 끝 ${fmt(b.left)} 를 넘음`);
    });
    out.push(row("D4", L.D4, bad));
  }

  // D5
  if (!isNum(m.oldBadges) || !isNum(m.weatherImgs)) out.push(noMeasure("D5", L.D5, "옛 배지·날씨 그림 수"));
  else {
    const bad = [];
    if (m.oldBadges !== 0) bad.push(`옛 배지 ${m.oldBadges}개 (기대 0)`);
    if (m.weatherImgs !== 0) bad.push(`날씨 그림 ${m.weatherImgs}개 (기대 0)`);
    out.push(row("D5", L.D5, bad));
  }
  return out;
}

/** D2: 시간대 글자를 그리지 않는 화면에 `[data-tod]` 가 0개다. screen = 화면 이름(로비·역할 확인 등) */
export function todAbsentChecks(count, { screen }) {
  const label = `시간대 글자가 없다(${screen})`;
  if (!isNum(count)) return noMeasure("D2", label, "[data-tod] 수");
  return row("D2", label, count === 0 ? [] : [`[data-tod] ${count}개 (기대 0)`]);
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
      let lines = null;
      if (node) {
        const all = document.createRange();
        all.setStart(node, 0);
        all.setEnd(node, node.data.length);
        lines = tops(all).length;
      }
      desc = { height: descEl.getBoundingClientRect().height, lineHeight: parseFloat(cs.lineHeight), text, newlines: text.split("\n").length - 1, lines };
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
 * 문구 상자 읽기(선택자에 맞는 요소마다): 높이·줄 높이·줄 수·글자 안의 줄바꿈 문자 수·문서의 목표 줄 수.
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
      if (node) {
        const all = document.createRange();
        all.setStart(node, 0);
        all.setEnd(node, node.data.length);
        lines = tops(all).length;
      }
      const block = cs.display !== "inline";
      return { height: block ? el.getBoundingClientRect().height : null, lineHeight: parseFloat(cs.lineHeight), lines, newlines: (el.textContent ?? "").split("\n").length - 1, goalCount };
    });
  }, selector);
}

/** 헤더 시간대 글자 읽기: [data-tod] 수와(있으면) 값·낱말·단계 이름 글자, 헤더 줄·제목·헤더·헤더 단추 사각형, 옛 배지·날씨 그림 수 */
export function readTodHead(page) {
  return page.evaluate(() => {
    const rect = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, width: r.width, height: r.height, right: r.right, bottom: r.bottom };
    };
    const els = [...document.querySelectorAll("[data-tod]")];
    const el = els[0] ?? null;
    const word = el ? el.querySelector(".mv-phase__tod") : null;
    const header = document.querySelector(".mf-game__header");
    const title = header ? header.querySelector(".mv-phase__title") : null;
    return {
      count: els.length,
      tod: el ? el.getAttribute("data-tod") : null,
      word: word ? (word.textContent ?? "") : null,
      titleText: title ? (title.textContent ?? "") : null,
      line: rect(el),
      title: rect(title),
      header: rect(header),
      headerButtons: header ? [...header.querySelectorAll("button")].map(rect) : [],
      oldBadges: document.querySelectorAll(".mv-tod").length,
      weatherImgs: [...document.querySelectorAll("img")].filter((i) => (i.getAttribute("src") ?? "").includes("/weather/")).length,
    };
  });
}

// ---- B 채팅 두 줄 창·늘어나는 기록 칸 (18.1-09, 18.1-14) ----

/** 기록 칸 높이 (UI-SPEC B1, src/game/chatUi.ts LOG_H 의 사본 — e2eContract 가 lib.mjs LOG_H 와 같음을 고정한다) */
export const CHAT_LOG_H = 68;
/** 기록 칸 위 흐림 띠 높이(LOG_FADE_H 사본) — 이 띠 안은 '보이는 줄' 로 세지 않는다 */
export const CHAT_FADE_H = 12;
/** 기록 칸 안에 보이는 채팅 줄 상한(B2) */
export const CHAT_WINDOW_MAX_LINES = 2;
/** 입력칸·보내기 한 변(B1) */
export const CHAT_CONTROL_H = 48;
/** 늘어난 기록 칸 높이 상한(chatUi.LOG_OPEN_MAX 사본, 0083-4) */
export const CHAT_OPEN_MAX = 300;
/** 늘어난 기록 칸 위, 띠 아래에 남기는 스테이지 최소 높이(chatUi.OPEN_STAGE_MIN 사본) */
export const CHAT_OPEN_STAGE_MIN = 120;
/** 키보드 열림 패널에서 기록 칸 밖의 높이(chatUi.KB_PANEL_REST 사본) = 14 + 8 + 48 + 8 */
export const CHAT_KB_PANEL_REST = 78;
/** 늘어난 칸 높이 식의 기본 띠 아랫변(CSS 변수가 없을 때 .mv-chat__log.is-open 이 쓰는 값) */
export const CHAT_HOST_BOTTOM_DEFAULT = 126;
/** B2 를 재려면 보낸 채팅 줄이 이만큼은 있어야 한다(공허 통과 금지) */
export const CHAT_MIN_LINES = 6;

/**
 * 늘어난 기록 칸 높이 식 사본(chatUi.openLogHeight, 0083-4) = clamp(68, 방 높이 − 키보드 올림 − 띠 아랫변 − 스테이지 최소 − 패널의 기록 칸 밖 높이, 300), 정수.
 * test/unit/e2eContract.test.ts 가 같은 입력 표에서 openLogHeight 와 같은 값임을 고정한다.
 */
export function chatOpenHeight({ roomH, lift, hostBottom, panelRest }) {
  const room = roomH - lift - hostBottom - CHAT_OPEN_STAGE_MIN - panelRest;
  return Math.round(Math.min(CHAT_OPEN_MAX, Math.max(CHAT_LOG_H, room)));
}

/** 사각형 r 이 [bandTop, bandBottom] 띠와 겹친 높이 */
const overlapH = (r, bandTop, bandBottom) => Math.max(0, Math.min(bottomOf(r), bandBottom) - Math.max(r.top, bandTop));

/**
 * B1·B2(·B2L) 판정. m = { log, input, send, lineHeight, msgs } — 기록 칸·입력칸·보내기 사각형, 채팅 줄 높이(px), `.mv-chat__msg` 사각형들(시스템 줄 제외).
 * B1 기록 칸 높이 68±1·입력칸 48·보내기 48×48. B2 기록 칸의 [위 + 12, 아래] 띠 안에 줄 높이 절반 이상 보이는 채팅 줄이 1~2개
 * (보낸 줄이 6 미만이면 '측정 조건 미달' 로 실패 — 공허 통과 금지). long 이면 가장 새 줄(마지막)의 보이는 글줄 ≤ 2 이고 그 줄이 칸 아래를 넘치지 않음을 B2L 로 더한다.
 */
export function chatWindowChecks(m, { long = false } = {}) {
  const L = {
    B1: `기록 칸 ${CHAT_LOG_H}·입력칸 ${CHAT_CONTROL_H}·보내기(있으면) ${CHAT_CONTROL_H}x${CHAT_CONTROL_H}`,
    B2: `보낸 채팅 줄이 ${CHAT_MIN_LINES}개 이상일 때 기록 칸 안에 보이는 채팅 줄이 ${CHAT_WINDOW_MAX_LINES}개 이하`,
    B2L: "긴 줄: 기록 칸에 가장 새 줄의 끝 두 줄만 보이고 칸 아래를 넘치지 않는다",
  };
  const want = long ? ["B1", "B2", "B2L"] : ["B1", "B2"];
  // 접힌 창에서 빈 입력·포커스 없음이면 [보내기] 가 없다(0083-5) — 있으면 48×48 이다
  const ok = m !== null && typeof m === "object" && isRect(m.log) && isRect(m.input) && (m.send === null || isRect(m.send)) && Array.isArray(m.msgs) && m.msgs.every(isRect) && isNum(m.lineHeight);
  if (!ok) return want.map((id) => noMeasure(id, L[id], "기록 칸·입력칸·보내기·줄 사각형"));
  const out = [];

  const bad1 = [];
  if (Math.abs(m.log.height - CHAT_LOG_H) > TOL) bad1.push(`기록 칸 ${fmt(m.log.height)} (기대 ${CHAT_LOG_H})`);
  if (Math.abs(m.input.height - CHAT_CONTROL_H) > TOL) bad1.push(`입력칸 ${fmt(m.input.height)} (기대 ${CHAT_CONTROL_H})`);
  if (m.send !== null && (Math.abs(m.send.height - CHAT_CONTROL_H) > TOL || Math.abs(m.send.width - CHAT_CONTROL_H) > TOL)) bad1.push(`보내기 ${fmt(m.send.width)}x${fmt(m.send.height)} (기대 ${CHAT_CONTROL_H}x${CHAT_CONTROL_H})`);
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
 * B3·B4·B5 판정(0083-4·0083-5). m = { collapsed, opened, closed, byInput, draft, send }:
 *  - collapsed·closed = { logH, expanded } 접힌 두 줄 창(처음, 그리고 같은 단추를 다시 누른 뒤)
 *  - opened = { logH, expanded, dialogs, focusOnInput, formula } 두 줄 창을 누른 뒤. byInput = { logH, expanded, focusOnInput, formula } 입력칸을 눌러서.
 *    formula = { roomH, lift, hostBottom, panelRest } 식의 재료(화면에서 읽은 값)
 *  - draft = { before, after } 쓰던 글(접었다 펴기 전·후 입력칸 값), send = [{ state, send, will, rect? }] 네 경우의 [보내기]·유언 단추 수
 * B3 두 줄 창을 누르면 dialog 없이 같은 자리에서 늘어나(aria-expanded, 높이 = 식의 값 ± 1) 입력칸에 포커스가 없고, 같은 단추를 다시 누르면 68 로 돌아온다.
 * B4 입력칸을 누르면 늘어나고(포커스, 높이 = 식의 값 ± 1) 쓰던 글이 접었다 펴도 남는다(처음부터 비어 있으면 잴 것이 없어 실패).
 * B5 [보내기] 는 빈·포커스 없음 = 없음, 포커스 = 있음, 글(blur) = 있음, 지우고 blur = 없음이고 어느 때도 유언 단추와 함께 있지 않다.
 */
export function chatOpenChecks(m) {
  const L = {
    B3: "두 줄 창을 누르면 시트 없이 제자리에서 식의 높이로 늘어나고(입력칸 포커스 없음) 같은 단추로 68 로 접힌다",
    B4: "입력칸을 누르면 식의 높이로 늘어나고 쓰던 글이 접었다 펴도 남는다",
    B5: "[보내기] 는 입력 중이거나 쓴 글이 있을 때만 있고 유언 단추와 함께 있지 않다",
  };
  const formulaOk = (f) => f && typeof f === "object" && isNum(f.roomH) && isNum(f.lift) && isNum(f.hostBottom) && isNum(f.panelRest);
  const ok =
    m !== null &&
    typeof m === "object" &&
    m.collapsed &&
    isNum(m.collapsed.logH) &&
    m.opened &&
    isNum(m.opened.logH) &&
    formulaOk(m.opened.formula) &&
    m.closed &&
    isNum(m.closed.logH) &&
    m.byInput &&
    isNum(m.byInput.logH) &&
    formulaOk(m.byInput.formula) &&
    m.draft &&
    typeof m.draft === "object" &&
    Array.isArray(m.send);
  if (!ok) return ["B3", "B4", "B5"].map((id) => noMeasure(id, L[id], "늘어난 기록 칸 높이·식 재료·[보내기] 읽기"));

  const bad3 = [];
  if (Math.abs(m.collapsed.logH - CHAT_LOG_H) > TOL || m.collapsed.expanded !== false) bad3.push(`처음 접힌 칸 ${fmt(m.collapsed.logH)}${m.collapsed.expanded === false ? "" : " 늘어나 있음"} (기대 ${CHAT_LOG_H} 접힘)`);
  const wantOpened = chatOpenHeight(m.opened.formula);
  if (m.opened.expanded !== true) bad3.push("두 줄 창을 눌러도 aria-expanded 가 true 가 아님");
  if (m.opened.dialogs !== 0) bad3.push(`열린 대화상자 ${m.opened.dialogs}개 (기대 0 — 시트 없음)`);
  if (Math.abs(m.opened.logH - wantOpened) > TOL) bad3.push(`늘어난 칸 ${fmt(m.opened.logH)} (식의 값 ${wantOpened})`);
  if (m.opened.focusOnInput !== false) bad3.push("두 줄 창을 눌렀는데 입력칸에 포커스가 생김");
  if (Math.abs(m.closed.logH - CHAT_LOG_H) > TOL || m.closed.expanded !== false) bad3.push(`다시 눌러 접은 칸 ${fmt(m.closed.logH)}${m.closed.expanded === false ? "" : " 늘어나 있음"} (기대 ${CHAT_LOG_H} 접힘)`);

  const bad4 = [];
  const wantByInput = chatOpenHeight(m.byInput.formula);
  if (m.byInput.expanded !== true) bad4.push("입력칸을 눌러도 aria-expanded 가 true 가 아님");
  if (m.byInput.focusOnInput !== true) bad4.push("입력칸을 눌렀는데 포커스가 없음");
  if (Math.abs(m.byInput.logH - wantByInput) > TOL) bad4.push(`늘어난 칸 ${fmt(m.byInput.logH)} (식의 값 ${wantByInput})`);
  const { before, after } = m.draft;
  if (typeof before !== "string" || before === "") bad4.push("처음 입력칸이 비어 있음(잴 것이 없음)");
  else if (after !== before) bad4.push(`접었다 편 뒤 입력칸 ${typeof after === "string" ? after.length : "?"}자 (기대 ${before.length}자 그대로)`);

  const bad5 = [];
  const WANT_SEND = { "empty-blur": 0, focus: 1, "text-blur": 1, "cleared-blur": 0 };
  for (const [state, want] of Object.entries(WANT_SEND)) {
    const r = m.send.find((x) => x && x.state === state);
    if (!r) {
      bad5.push(`${state} 를 재지 못함`);
      continue;
    }
    if ((r.send > 0 ? 1 : 0) !== want) bad5.push(`${state}: [보내기] ${r.send}개 (기대 ${want})`);
    if (r.send > 0 && r.will > 0) bad5.push(`${state}: [보내기] ${r.send}개와 유언 단추 ${r.will}개가 함께 있음`);
    if (r.send > 0 && r.rect && (Math.abs(r.rect.width - CHAT_CONTROL_H) > TOL || Math.abs(r.rect.height - CHAT_CONTROL_H) > TOL)) bad5.push(`${state}: [보내기] ${fmt(r.rect.width)}x${fmt(r.rect.height)} (기대 ${CHAT_CONTROL_H}x${CHAT_CONTROL_H})`);
  }
  const r3 = row("B3", L.B3, bad3);
  const r4 = row("B4", L.B4, bad4);
  return [
    { ...r3, detail: r3.ok ? `늘어난 칸 ${fmt(m.opened.logH)}(식 ${wantOpened})` : r3.detail },
    { ...r4, detail: r4.ok ? `입력칸으로 늘어난 칸 ${fmt(m.byInput.logH)}(식 ${wantByInput})` : r4.detail },
    row("B5", L.B5, bad5),
  ];
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

/**
 * 늘어난 기록 칸 읽기(0083-4): 기록 칸 높이, [data-chat-open] 의 aria-expanded, 열린 대화상자 수, 입력칸 포커스·값, [보내기]·유언 단추 수(와 [보내기] 사각형),
 * 높이 식의 재료 = { 방 높이(화면 루트), 키보드 올림(--mf-kb-lift), 띠 아랫변(--mf-host-bottom, 없으면 126), 패널의 기록 칸 밖 높이(패널 − 기록 칸) }. 칸이 없으면 null.
 * 채팅 본문·닉네임은 읽지 않는다.
 */
export function readChatOpen(page) {
  return page.evaluate((hostDefault) => {
    const log = document.querySelector("[data-chat-log]");
    if (!log) return null;
    const btn = document.querySelector("[data-chat-open]");
    const input = document.querySelector("[data-chat-input]");
    const root = log.closest("main") ?? document.body;
    const panel = log.closest('[class*="__panel"]') ?? root;
    const cs = getComputedStyle(root);
    const num = (v) => {
      const n = parseFloat(v);
      return Number.isFinite(n) ? n : null;
    };
    const send = document.querySelector("[data-chat-send]");
    const sr = send ? send.getBoundingClientRect() : null;
    const logH = log.getBoundingClientRect().height;
    return {
      logH,
      expanded: btn ? btn.getAttribute("aria-expanded") === "true" : null,
      dialogs: document.querySelectorAll("dialog[open]").length,
      focusOnInput: document.activeElement === input,
      inputValue: input ? input.value : null,
      sendCount: document.querySelectorAll("[data-chat-send]").length,
      willCount: document.querySelectorAll("[data-will-button]").length,
      sendRect: sr ? { width: sr.width, height: sr.height } : null,
      formula: {
        roomH: root.clientHeight,
        lift: num(cs.getPropertyValue("--mf-kb-lift")) ?? 0,
        hostBottom: num(cs.getPropertyValue("--mf-host-bottom")) ?? hostDefault,
        panelRest: panel.getBoundingClientRect().height - logH,
      },
    };
  }, CHAT_HOST_BOTTOM_DEFAULT);
}

/** [data-chat-open] 의 aria-expanded 가 want 가 될 때까지 기다린 뒤 레이아웃이 가라앉도록 잠깐 쉰다 */
async function waitChatExpanded(page, want) {
  await page.waitForSelector(`[data-chat-open][aria-expanded="${want}"]`, { timeout: 3000 });
  await sleep(200);
}

/**
 * 늘어나는 기록 칸 B3·B4·B5 의 읽기 전부(0083-4·0083-5). 접힌 채 빈 입력·포커스 없음에서 시작해야 한다. 쓰던 글 draft 로:
 * 두 줄 창 누르기(늘어남·포커스 없음) → 다시 누르기(접힘) → 입력칸 누르기(늘어남·포커스) → 글 쓰기·blur → 접었다 펴기 → 글 지우기·blur. 끝나면 접어 둔다.
 * 돌려주는 값은 chatOpenChecks 의 입력 모양이다. 읽지 못한 단계가 있으면 null.
 */
export async function measureChatOpen(page, draft) {
  const input = page.locator("[data-chat-input]");
  const blur = () => page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur());
  const slim = (r) => (r ? { logH: r.logH, expanded: r.expanded } : null);
  const send = [];
  const note = (state, r) => r && send.push({ state, send: r.sendCount, will: r.willCount, rect: r.sendRect });
  const toggle = () => page.locator("[data-chat-open]").click({ timeout: 4000 });

  const collapsed = await readChatOpen(page);
  note("empty-blur", collapsed);
  await toggle();
  await waitChatExpanded(page, "true");
  const opened = await readChatOpen(page);
  await toggle();
  await waitChatExpanded(page, "false");
  const closed = await readChatOpen(page);

  await input.click({ timeout: 4000 });
  await waitChatExpanded(page, "true");
  const byInput = await readChatOpen(page);
  note("focus", byInput);
  await input.fill(draft);
  const before = await input.inputValue();
  await blur();
  await sleep(150);
  note("text-blur", await readChatOpen(page));
  await toggle();
  await waitChatExpanded(page, "false");
  await toggle();
  await waitChatExpanded(page, "true");
  const after = await input.inputValue();
  await input.fill("");
  await blur();
  await sleep(150);
  note("cleared-blur", await readChatOpen(page));
  await toggle();
  await waitChatExpanded(page, "false");
  if (!collapsed || !opened || !closed || !byInput) return null;
  return {
    collapsed: slim(collapsed),
    opened: { ...slim(opened), dialogs: opened.dialogs, focusOnInput: opened.focusOnInput, formula: opened.formula },
    closed: slim(closed),
    byInput: { ...slim(byInput), focusOnInput: byInput.focusOnInput, formula: byInput.formula },
    draft: { before, after },
    send,
  };
}

// ---- C 탈락자는 누구든 같은 유령 그림 (18.1-09, 18.1-17 0083-2: 훅 window.__mfGhosts) ----

/** 산 사람 화면이 탈락자 유령을 그리지 않는 단계(밤·심부름 — 서버가 본인(+근처)만 보내는 단계, 18.1-02 선택) */
export const LIVE_GHOST_ABSENT_PHASES = Object.freeze(["night", "errand"]);
/** 유령이 걷기 전·후 산 사람 화면의 유령 자리가 같다고 보는 허용 오차(월드 단위) */
export const GHOST_STILL_TOL = 0.05;

const isSeatNum = (n) => Number.isInteger(n) && n >= 0;
/** 유령 훅 사본 { seats: number[], ready: boolean } 모양인가 */
const isGhostsHook = (g) => g !== null && typeof g === "object" && Array.isArray(g.seats) && typeof g.ready === "boolean";

/**
 * C1·C2 판정(산 사람 화면 유령). m = readLiveGhost 의 값 { hook, seats: [{ seat, shown, ghostTags, chips }], ghosts: { seats, ready } | null, roleChips, ghostSeats }.
 * ctx = { deadSeats, phase }. 밤·심부름(LIVE_GHOST_ABSENT_PHASES)이 아니면 C1 = 탈락 좌석마다 마지막 자리(shown)에 actor 가 있고 `.mv-tag.is-ghost` 이름표가 정확히 1개이며
 * 유령 훅(__mfGhosts)의 seats 에 그 좌석이 있고 ready(그림을 불러옴)다 — 사람 모양으로 남으면 seats 에 없다. 밤·심부름이면 기대가 반대 — shown null·유령 이름표 0·훅 seats 에 없음.
 * C2 = [data-role-chip]·[data-ghost-seat] 이 0개(신분 단서 없음, 결정 0021) — 단계와 무관.
 */
export function liveGhostChecks(m, { deadSeats, phase } = {}) {
  const L = {
    C1: "탈락 좌석이 유령 그림으로 남는다(마지막 자리 actor·is-ghost 이름표 1·유령 훅 seats 에 있고 ready, 밤·심부름은 그리지 않음)",
    C2: "산 사람 화면에 직업 칩·죽은 자리 표식이 0개다",
  };
  const ok =
    m !== null && typeof m === "object" && m.hook === true && Array.isArray(m.seats) && isGhostsHook(m.ghosts) && Array.isArray(deadSeats) && deadSeats.length > 0 && deadSeats.every(isSeatNum);
  if (!ok) return ["C1", "C2"].map((id) => noMeasure(id, L[id], "월드 훅·유령 훅·탈락 좌석 읽기"));
  const absent = LIVE_GHOST_ABSENT_PHASES.includes(phase);
  const bad1 = [];
  for (const seat of deadSeats) {
    const r = m.seats.find((x) => x && x.seat === seat);
    if (!r) {
      bad1.push(`좌석 ${seat} 측정값 없음(읽기 없음)`);
      continue;
    }
    const drawn = r.shown !== null && r.shown !== undefined;
    const inHook = m.ghosts.seats.includes(seat);
    if (absent) {
      if (drawn) bad1.push(`좌석 ${seat} ${phase} 단계인데 유령 actor 가 있음`);
      if (r.ghostTags !== 0) bad1.push(`좌석 ${seat} ${phase} 단계인데 유령 이름표 ${r.ghostTags}개`);
      if (inHook) bad1.push(`좌석 ${seat} ${phase} 단계인데 유령 훅 seats 에 있음`);
    } else {
      if (!drawn) bad1.push(`좌석 ${seat} 마지막 자리 actor 없음(shown null)`);
      if (r.ghostTags !== 1) bad1.push(`좌석 ${seat} 유령 이름표(.mv-tag.is-ghost) ${r.ghostTags}개 (기대 1)`);
      if (!inHook) bad1.push(`좌석 ${seat} 가 유령 훅 seats 에 없음(유령 그림이 아님)`);
      if (!m.ghosts.ready) bad1.push("유령 그림을 불러오지 못함(ready 거짓)");
    }
  }
  const bad2 = [];
  if (!isNum(m.roleChips) || !isNum(m.ghostSeats)) bad2.push("칩·표식 수 측정값 없음");
  else {
    if (m.roleChips !== 0) bad2.push(`[data-role-chip] ${m.roleChips}개`);
    if (m.ghostSeats !== 0) bad2.push(`[data-ghost-seat] ${m.ghostSeats}개`);
  }
  for (const r of m.seats) if (r && isNum(r.chips) && r.chips !== 0) bad2.push(`좌석 ${r.seat} 이름표에 직업 칩 ${r.chips}개`);
  return [row("C1", L.C1, [...new Set(bad1)]), row("C2", L.C2, bad2)];
}

/**
 * C3 판정(유령 화면). m = readLiveGhost 의 값(유령 페이지에서) — seats: [{ seat, chips, ghostTags }], ghosts(__mfGhosts 훅 사본).
 * ctx = { jobs, seats? } — 탈락 좌석 전원(기본: jobs 의 키)이 직업 칩 1개·`.mv-tag.is-ghost` 1개이고 유령 훅 seats 에 있으며 ready 여야 한다. 모습은 직업과 무관해 직업별 기대가 없다(직업은 칩으로만 보인다).
 * 산 좌석이 유령 훅 seats 에 있으면(사람이 유령으로 그려짐) 실패.
 */
export function ghostViewChecks(m, { jobs = {}, seats } = {}) {
  const label = "유령 화면: 탈락 좌석 전원이 직업 칩 1개·유령 이름표·유령 그림이다(직업과 무관)";
  const list = seats ?? Object.keys(jobs).map(Number);
  const ok = m !== null && typeof m === "object" && Array.isArray(m.seats) && isGhostsHook(m.ghosts) && list.length > 0;
  if (!ok) return [noMeasure("C3", label, "유령 화면 읽기·유령 훅")];
  const bad = [];
  for (const seat of list) {
    const r = m.seats.find((x) => x && x.seat === seat);
    if (!r) {
      bad.push(`좌석 ${seat} 측정값 없음(읽기 없음)`);
      continue;
    }
    if (r.chips !== 1) bad.push(`좌석 ${seat} 직업 칩 ${r.chips}개 (기대 1)`);
    if (r.ghostTags !== 1) bad.push(`좌석 ${seat} 유령 이름표 ${r.ghostTags}개 (기대 1)`);
    if (!m.ghosts.seats.includes(seat)) bad.push(`좌석 ${seat} 가 유령 훅 seats 에 없음(사람 모습으로 남음)`);
  }
  for (const seat of m.ghosts.seats) if (!list.includes(seat)) bad.push(`산 좌석 ${seat} 이 유령 그림으로 그려짐`);
  if (!m.ghosts.ready) bad.push("유령 그림을 불러오지 못함(ready 거짓)");
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
 * 페이지 전체 [data-role-chip]·[data-ghost-seat] 수, window.__mfGhosts 사본(없으면 null). 닉네임·글자는 읽지 않는다(T-18.1-19).
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
      ghosts: window.__mfGhosts === undefined ? null : { seats: [...window.__mfGhosts.seats], ready: window.__mfGhosts.ready },
      roleChips: document.querySelectorAll("[data-role-chip]").length,
      ghostSeats: document.querySelectorAll("[data-ghost-seat]").length,
    };
  }, seats);
}

/**
 * 찬반 기록 카드 overflow backstop(UI-SPEC UI Considerations): 접힌 기록 칸에서는 창보다 큰 시스템 카드의 위가 잘리고, 늘어난 기록 칸(0083-4)에서는 카드 전체가 칸 안에 보여야 한다.
 * 칸에 찬반 카드(`[data-card="ballots"]`)가 있으면 칸 스크린샷을 남기고, [data-chat-open] 으로 칸을 늘려 카드를 칸 안으로 스크롤한 뒤 사각형을 읽고 스크린샷을 남기고 접는다.
 * 돌려주는 값: { measured: false, why } 또는 { measured: true, cardH, windowH, cutTop(접힌 칸에서 위가 잘린 높이), openFits(늘어난 칸 안에 카드 전체가 듦), openH(늘어난 칸 높이) }. 카드 안 글은 읽지 않는다.
 */
export async function measureBallotsBackstop(page, { windowShot, openShot }) {
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
  await waitChatExpanded(page, "true");
  const open = await page.evaluate(() => {
    const list = document.querySelector("[data-chat-log]");
    const cards = list ? [...list.querySelectorAll('[data-card="ballots"]')] : [];
    const card = cards[cards.length - 1];
    if (!list || !card) return { missing: true, list: list !== null, lines: list ? list.children.length : 0, allCards: document.querySelectorAll('[data-card="ballots"]').length };
    card.scrollIntoView({ block: "nearest" });
    const l = list.getBoundingClientRect();
    const c = card.getBoundingClientRect();
    return { listH: l.height, cardH: c.height, fits: c.top >= l.top - 1 && c.bottom <= l.bottom + 1 };
  });
  await sleep(100);
  await page.screenshot({ path: openShot });
  await page.locator('[data-chat-open][aria-expanded="true"]').click({ timeout: 4000 }).catch(() => {});
  await page.waitForSelector('[data-chat-open][aria-expanded="false"]', { timeout: 2000 }).catch(() => {});
  if (open.missing) return { measured: false, why: `늘어난 칸에 찬반 기록 카드가 없음(칸 ${open.list ? "있음" : "없음"}·줄 ${open.lines}개·문서 전체 찬반 카드 ${open.allCards}개)` };
  return { measured: true, cardH: open.cardH, windowH: win.log.height, cutTop: Math.max(0, win.log.top - win.card.top), openFits: open.fits, openH: open.listH };
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
