// 23페이즈 첫날 키워드·정답 공개·조기 진행 E2E (23-12, UI-SPEC "E2E 표식과 판정 초안" P23-1~13 = KW1~KW13).
// 판정 문턱은 이 파일의 순수 함수(kw1PhaseColumns~kw13Leak)에만 있고 keyword.test.mjs 가 단위 시험한다. 흐름 본문(makeKeywordFlows)은 얇게 읽고 부른다.
// day.mjs·avatar.mjs 와 같은 모양: helpers 를 받고 서로 import 하지 않는다.
// helpers: { recorder, attempt, openGame, closeGame, allAt, untilGame, gameGH, GAME_HOST_NICK }.
// 표식(data-keyword-*·data-answer-*·data-announce-label·data-early)에는 역할·키워드 값이 없다 — 키워드는 텍스트 노드로만 읽는다(T-23-43).
import { chooseVerdict, installFakeViewport, openTestSheet, readGame, settle, skipTo, sleep } from "./browser.mjs";
import { OVERLAP_EPS, TAP_MIN } from "./lib.mjs";

const isNum = (x) => typeof x === "number" && Number.isFinite(x);
const result = (id, label, bad) => ({ id, label, ok: bad.length === 0, detail: bad.length === 0 ? "" : bad.join("; ") });
const noMeasure = (id, label, what) => result(id, label, [`측정값 없음(${what})`]);
const fmt = (n) => Math.round(n * 10) / 10;
const rectOk = (r) => !!r && [r.left, r.top, r.right, r.bottom, r.width, r.height].every(isNum);
const overlaps = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > OVERLAP_EPS && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > OVERLAP_EPS;

// ---- 사본 상수(test/unit/e2eContract.test.ts 가 서버·앱 상수와 대조한다) ----
/** 키워드 단계 길이(ms) = 읽기 3초 + 쓰기 10초 */
export const KEYWORD_MS_COPY = 13_000;
/** 읽기 잠금(ms) — 입력줄은 이 동안 locked */
export const KEYWORD_READ_MS_COPY = 3_000;
/** 정답 공개 단계 길이(ms) */
export const ANSWER_REVEAL_MS_COPY = 3_000;
/** 답 길이 상한(자소) */
export const ANSWER_MAX_GRAPHEMES_COPY = 20;
/** 서버의 답 전송 최소 간격(ms) */
export const ANSWER_MIN_GAP_MS_COPY = 400;
/** 전원이 끝낸 뒤 남기는 시간(ms) */
export const EARLY_GRACE_MS_COPY = 1_500;
/** 금지어 거절 문구(모두 같다)와 알림이 떠 있는 시간(ms) */
export const KEYWORD_REJECT_COPY = "쓸 수 없는 말이에요";
export const KEYWORD_NOTICE_MS_COPY = 2_500;
/** 키워드 카드 각주(사용자 글) */
export const KEYWORD_NOTE_COPY = "* 직접적인 키워드는 언급하면 안 됩니다.";
/** 판정 시간 오차(ms) */
export const KW_TOL_MS = 800;
/** 방장 화면에만 있는 테스트 방 키(me) — 마피아·시민 키 비교에서 방장 전용으로 허용한다 */
export const HOST_ONLY_ME_KEYS = ["testMode", "testRole", "testBots", "testBotVote"];

const MASK = "???";

// ---- 순수 판정 ----

/**
 * KW1(P23-1) 첫날 단계 열. m = { seq(받은 단계 id 의 연속 중복 없는 목록), endedDayOne(첫날 처형으로 끝난 판) }.
 * 계속되는 판: 역할 확인 → 키워드 → 낮 시작 … 정답 공개 → 밤, 이후 날에는 keyword·answerReveal 이 없다(둘째 날 낮 시작 발표가 보여야 측정이 된다).
 * 첫날 끝난 판: 키워드는 있고 answerReveal 은 없이 ended 로 닫힌다.
 */
export function kw1PhaseColumns(m) {
  const label = m?.endedDayOne ? "첫날 처형으로 끝난 판: 역할 확인 → 키워드 → 낮 시작 … 처형 → 결과(정답 공개 없음)" : "첫날 단계 열: 역할 확인 → 키워드 → 낮 시작 … 처형 → 정답 공개 → 밤, 둘째 날 키워드·정답 공개 없음";
  const seq = m?.seq;
  if (!Array.isArray(seq) || seq.length === 0) return noMeasure("KW1", label, "단계 열");
  const bad = [];
  const at = (p, from = 0) => seq.indexOf(p, from);
  const iRole = at("roleReveal");
  const iKw = at("keyword");
  if (iRole < 0) bad.push("roleReveal 이 없음");
  if (iKw < 0) bad.push("keyword 가 없음");
  if (iRole >= 0 && iKw >= 0 && iKw !== iRole + 1) bad.push(`keyword 가 roleReveal 바로 다음이 아님(${seq[iRole + 1]})`);
  if (iKw >= 0 && seq[iKw + 1] !== "dayAnnounce") bad.push(`keyword 다음이 dayAnnounce 가 아님(${seq[iKw + 1] ?? "없음"})`);
  if (at("keyword", iKw + 1) >= 0) bad.push("keyword 가 두 번 이상 나옴");
  if (m.endedDayOne) {
    if (at("answerReveal") >= 0) bad.push("처형으로 끝난 판에 answerReveal 이 있음");
    if (seq[seq.length - 1] !== "ended") bad.push(`마지막 단계가 ended 가 아님(${seq[seq.length - 1]})`);
    if (at("night") >= 0) bad.push("끝난 판에 night 가 있음");
    return result("KW1", label, bad);
  }
  const iNight = at("night");
  if (iNight < 0) bad.push("night 가 없음");
  else {
    if (seq[iNight - 1] !== "answerReveal") bad.push(`첫 밤 바로 앞이 answerReveal 이 아님(${seq[iNight - 1]})`);
    if (at("answerReveal") !== iNight - 1) bad.push("answerReveal 이 첫 밤 앞 말고 다른 자리에도 있음");
    const rest = seq.slice(iNight + 1);
    if (!rest.includes("dayAnnounce")) bad.push("둘째 날 낮 시작이 열에 없음(측정 부족)");
    if (rest.includes("keyword")) bad.push("둘째 날 이후에 keyword 가 있음");
    if (rest.includes("answerReveal")) bad.push("둘째 날 이후에 answerReveal 이 있음");
  }
  return result("KW1", label, bad);
}

/** KW2(P23-2) 시민 카드. m = { genre(장르 줄 글), word(키워드 줄 글), note(각주 글) } */
export function kw2CitizenCard(m) {
  const label = "시민 카드: 장르 줄 `장르 : …` · 키워드 줄 · 각주가 사용자 글과 같다";
  if (!m || typeof m.genre !== "string" || typeof m.word !== "string" || typeof m.note !== "string") return noMeasure("KW2", label, "장르·키워드·각주 글");
  const bad = [];
  if (!/^장르 : \S.*$/.test(m.genre.trim())) bad.push(`장르 줄 '${m.genre}'`);
  if (m.word.trim() === "" || m.word.trim() === MASK) bad.push(`키워드 줄 '${m.word}'(시민은 키워드가 보여야 한다)`);
  if (m.note.trim() !== KEYWORD_NOTE_COPY) bad.push(`각주 '${m.note}'`);
  return result("KW2", label, bad);
}

/** KW3(P23-3) 마피아 카드. m = { word, genre, html(페이지 문서 원문), attrs(모든 속성 값을 이은 글), answer(그 판 키워드) } */
export function kw3MafiaCard(m) {
  const label = "마피아 카드: 키워드 줄이 ??? 이고 그 판 키워드가 DOM 원문·속성 어디에도 없다";
  if (!m || typeof m.answer !== "string" || m.answer === "" || typeof m.word !== "string" || typeof m.html !== "string" || typeof m.attrs !== "string") return noMeasure("KW3", label, "키워드·DOM 원문·속성");
  const bad = [];
  if (m.word.trim() !== MASK) bad.push(`키워드 줄 '${m.word}' ≠ ???`);
  if (typeof m.genre !== "string" || !/^장르 : \S/.test(m.genre.trim())) bad.push(`장르 줄 '${m.genre}'`);
  if (m.html.includes(m.answer)) bad.push("DOM 원문에 키워드가 있음");
  if (m.attrs.includes(m.answer)) bad.push("속성 값에 키워드가 있음");
  return result("KW3", label, bad);
}

/** KW4(P23-4) 읽기 3초. m = { firstState, firstAtMs(처음 본 시각 − 단계 시작), openAtMs(open 이 된 시각 − 단계 시작), callAtMs(입력칸 data-call 이 생긴 시각 − 단계 시작 | null) } */
export function kw4ReadLock(m) {
  const label = `읽기 ${KEYWORD_READ_MS_COPY / 1000}초 동안 locked → 뒤에 open + 입력칸 빛남(data-call)`;
  if (!m || typeof m.firstState !== "string" || !isNum(m.firstAtMs) || !isNum(m.openAtMs)) return noMeasure("KW4", label, "처음 상태·open 시각");
  const bad = [];
  if (m.firstState !== "locked") bad.push(`처음 상태 ${m.firstState}(${Math.round(m.firstAtMs)}ms)`);
  if (Math.abs(m.openAtMs - KEYWORD_READ_MS_COPY) > KW_TOL_MS) bad.push(`open 시각 ${Math.round(m.openAtMs)}ms(기대 ${KEYWORD_READ_MS_COPY}±${KW_TOL_MS})`);
  if (!isNum(m.callAtMs)) bad.push("입력칸 data-call 이 안 생김");
  else if (m.callAtMs < KEYWORD_READ_MS_COPY - KW_TOL_MS) bad.push(`data-call 이 읽기 끝보다 일찍(${Math.round(m.callAtMs)}ms)`);
  return result("KW4", label, bad);
}

/** KW5(P23-5) 입력·제출. m = { inputLen(21자 입력 뒤 입력칸 자소 수), countText, afterSend: { state, readOnly, label } } */
export function kw5InputLimit(m) {
  const label = `${ANSWER_MAX_GRAPHEMES_COPY}자소에서 멈추고 'n/${ANSWER_MAX_GRAPHEMES_COPY}' 가 맞다 · 보내면 sent·읽기 전용·'답 보냄'`;
  if (!m || !isNum(m.inputLen) || typeof m.countText !== "string" || !m.afterSend) return noMeasure("KW5", label, "입력 길이·글자 수·제출 뒤 상태");
  const bad = [];
  if (m.inputLen !== ANSWER_MAX_GRAPHEMES_COPY) bad.push(`입력칸 ${m.inputLen}자소(기대 ${ANSWER_MAX_GRAPHEMES_COPY})`);
  if (m.countText.trim() !== `${ANSWER_MAX_GRAPHEMES_COPY}/${ANSWER_MAX_GRAPHEMES_COPY}`) bad.push(`글자 수 '${m.countText}'`);
  if (m.afterSend.state !== "sent") bad.push(`제출 뒤 상태 ${m.afterSend.state}`);
  if (m.afterSend.readOnly !== true) bad.push("제출 뒤 입력칸이 읽기 전용이 아님");
  if (m.afterSend.label !== "답 보냄") bad.push(`제출 뒤 [보내기] 이름 '${m.afterSend.label}'`);
  return result("KW5", label, bad);
}

/** KW6(P23-6) 금지어 거절. pages = [{ who, text(알림 글), noticeMs(알림이 보인 시간), valueKept(입력칸에 쓴 글이 남음), stateAfter(거절 뒤 입력줄 상태) }] (시민·마피아 둘) */
export function kw6Reject(pages) {
  const label = `시민·마피아가 같은 문구 '${KEYWORD_REJECT_COPY}' 를 같은 시간(${KEYWORD_NOTICE_MS_COPY / 1000}초) 보고, 글이 입력칸에 남고, 다시 낼 수 있다`;
  if (!Array.isArray(pages) || pages.length < 2) return noMeasure("KW6", label, "두 페이지");
  const bad = [];
  for (const p of pages) {
    if (p.text !== KEYWORD_REJECT_COPY) bad.push(`${p.who} 알림 글 '${p.text}'`);
    if (!isNum(p.noticeMs) || Math.abs(p.noticeMs - KEYWORD_NOTICE_MS_COPY) > KW_TOL_MS) bad.push(`${p.who} 알림 시간 ${isNum(p.noticeMs) ? Math.round(p.noticeMs) : "?"}ms(기대 ${KEYWORD_NOTICE_MS_COPY}±${KW_TOL_MS})`);
    if (p.valueKept !== true) bad.push(`${p.who} 쓴 글이 입력칸에 안 남음`);
    if (p.stateAfter !== "open") bad.push(`${p.who} 거절 뒤 상태 ${p.stateAfter}(다시 낼 수 있어야 open)`);
  }
  const ms = pages.map((p) => p.noticeMs).filter(isNum);
  if (ms.length >= 2 && Math.max(...ms) - Math.min(...ms) > KW_TOL_MS) bad.push(`두 페이지 알림 시간 차 ${Math.round(Math.max(...ms) - Math.min(...ms))}ms`);
  return result("KW6", label, bad);
}

/**
 * KW7(P23-7) 키보드 열림 컴팩트 카드 기하. m = { vw, vh(보이는 영역 높이), compact(data-compact), header, card, meta, form, send, secs, count } (사각형 { left, top, right, bottom, width, height }).
 * 카드가 컴팩트형이고, 머리·카드·메타·입력줄이 서로 겹치지 않으며 보이는 영역 안(머리 아랫변 ≥ 0 포함), n초·n/20·[보내기]가 보이고 보내기는 44 이상이다.
 */
export function kw7CompactGeometry(m) {
  const label = "키보드 열림: 카드가 컴팩트형 · 머리·카드·입력줄이 겹치지 않고 보이는 영역 안 · n초·n/20·[보내기] 보임, 보내기 44 이상";
  const parts = m && isNum(m.vw) && isNum(m.vh) && ["header", "card", "meta", "form", "send", "secs", "count"].every((k) => rectOk(m[k]));
  if (!parts) return noMeasure("KW7", label, "머리·카드·메타·입력줄·보내기·초·글자 수 사각형");
  const bad = [];
  if (m.compact !== true) bad.push("카드가 컴팩트형(data-compact)이 아님");
  const named = [["머리", m.header], ["카드", m.card], ["메타 줄", m.meta], ["입력줄", m.form]];
  for (let i = 0; i < named.length; i++) for (let j = i + 1; j < named.length; j++) if (overlaps(named[i][1], named[j][1])) bad.push(`${named[i][0]}·${named[j][0]} 겹침`);
  if (m.header.bottom < -OVERLAP_EPS) bad.push(`머리 아랫변 ${fmt(m.header.bottom)} < 0`);
  if (m.card.top < m.header.bottom - OVERLAP_EPS) bad.push(`카드 윗변 ${fmt(m.card.top)} 이 머리 아랫변 ${fmt(m.header.bottom)} 위`);
  for (const [n, r] of [...named, ["보내기", m.send]]) if (r.top < -OVERLAP_EPS || r.bottom > m.vh + OVERLAP_EPS || r.left < -OVERLAP_EPS || r.right > m.vw + OVERLAP_EPS) bad.push(`${n} 가 보이는 영역(${fmt(m.vw)}x${fmt(m.vh)}) 밖 ${fmt(r.left)},${fmt(r.top)}~${fmt(r.right)},${fmt(r.bottom)}`);
  for (const [n, r] of [["n초", m.secs], ["n/20", m.count]]) if (r.width <= 0 || r.height <= 0) bad.push(`${n} 가 안 보임`);
  if (m.send.width + OVERLAP_EPS < TAP_MIN || m.send.height + OVERLAP_EPS < TAP_MIN) bad.push(`[보내기] ${fmt(m.send.width)}x${fmt(m.send.height)} < ${TAP_MIN}`);
  return result("KW7", label, bad);
}

const rowsKey = (rows) => rows.map((r) => `${r.order}:${r.seat}:${r.none ? "n" : "a"}`).join(",");
/** 목록 줄 하나가 서로 이어지는 번호(1..n)·답 없음이 맨 끝·답이 하나 이상인지 본다. 어긋난 곳 글 목록을 돌려준다. */
function listProblems(rows, who) {
  const bad = [];
  if (!Array.isArray(rows) || rows.length === 0) return [`${who} 목록이 비어 있음`];
  rows.forEach((r, i) => {
    if (r.order !== i + 1) bad.push(`${who} ${i + 1}번째 줄 번호 ${r.order}`);
  });
  const firstNone = rows.findIndex((r) => r.none);
  if (firstNone === 0) bad.push(`${who} 답이 하나도 없음`);
  if (firstNone >= 0 && rows.slice(firstNone).some((r) => !r.none)) bad.push(`${who} '답 없음' 이 맨 끝이 아님`);
  return bad;
}

/**
 * KW8(P23-8) 모두의 답. pages = [{ who, autoOpened(토론 시작 뒤 시트가 저절로 열림), reopened(닫은 뒤 다시 열림), hasTab(탭 '첫날 답' 있음), rows: [{ order, seat, none }] }].
 * 모두 자동으로 한 번 열리고 닫으면 안 다시 열리며 탭이 있고, 목록이 낸 순서(1..n)·'답 없음' 맨 끝이고, 페이지끼리 같다.
 */
export function kw8AnswerList(pages) {
  const label = "토론 시작 뒤 모두의 답이 자동으로 한 번 열리고 낸 순서·'답 없음' 맨 끝, 닫으면 다시 안 열린다, 탭 '첫날 답'이 있다";
  if (!Array.isArray(pages) || pages.length === 0) return noMeasure("KW8", label, "페이지");
  const bad = [];
  for (const p of pages) {
    if (p.autoOpened !== true) bad.push(`${p.who} 시트가 저절로 안 열림`);
    if (p.reopened === true) bad.push(`${p.who} 닫은 뒤 다시 열림`);
    if (p.hasTab !== true) bad.push(`${p.who} 탭 '첫날 답' 없음`);
    bad.push(...listProblems(p.rows, p.who));
  }
  const keys = pages.filter((p) => Array.isArray(p.rows) && p.rows.length > 0).map((p) => rowsKey(p.rows));
  if (new Set(keys).size > 1) bad.push(`페이지마다 목록이 다름(${keys.join(" ≠ ")})`);
  return result("KW8", label, bad);
}

/** KW9(P23-9) 재접속. m = { autoOpened(재접속 뒤 시트가 저절로 열림), rowsBefore, rowsAfter(탭으로 연 목록) } */
export function kw9Reconnect(m) {
  const label = "토론 중 재접속하면 시트가 자동으로 안 열리고 [내 역할] → 첫날 답 으로 같은 목록을 본다";
  if (!m || !Array.isArray(m.rowsBefore) || !Array.isArray(m.rowsAfter) || m.rowsBefore.length === 0 || m.rowsAfter.length === 0) return noMeasure("KW9", label, "재접속 전·뒤 목록");
  const bad = [];
  if (m.autoOpened === true) bad.push("재접속 뒤 시트가 저절로 열림");
  if (rowsKey(m.rowsBefore) !== rowsKey(m.rowsAfter)) bad.push(`목록이 다름(${rowsKey(m.rowsBefore)} ≠ ${rowsKey(m.rowsAfter)})`);
  return result("KW9", label, bad);
}

/**
 * KW10(P23-10) 정답 공개. m = { pages: [{ who, label(정답 라벨 글), text(키워드 글) }], answer, correct: [{ who, text(정답 줄 글), last(목록 맨 아래) }] }.
 * 정답 공개 3초 동안 '정답' + 키워드가 시민·마피아에게 같고, 그 뒤 목록 맨 아래에 `정답 · {키워드}` 줄이 생긴다.
 */
export function kw10Reveal(m) {
  const label = "정답 공개 3초: '정답' + 키워드가 시민·마피아에게 같다 · 그 뒤 목록 맨 아래에 '정답 · 키워드' 줄";
  if (!m || typeof m.answer !== "string" || m.answer === "" || !Array.isArray(m.pages) || m.pages.length === 0 || !Array.isArray(m.correct) || m.correct.length === 0) return noMeasure("KW10", label, "정답·큰 글·정답 줄");
  const bad = [];
  for (const p of m.pages) {
    if (p.label !== "정답") bad.push(`${p.who} 라벨 '${p.label}'`);
    if (p.text !== m.answer) bad.push(`${p.who} 큰 글 '${p.text}' ≠ 키워드`);
  }
  for (const c of m.correct) {
    if (c.text !== `정답 · ${m.answer}`) bad.push(`${c.who} 정답 줄 '${c.text}'`);
    if (c.last !== true) bad.push(`${c.who} 정답 줄이 목록 맨 아래가 아님`);
  }
  return result("KW10", label, bad);
}

/** KW11(P23-11) 첫날 승패. m = { phases(처형 이후 단계 열), hostLine(결과 띠 글), answer } */
export function kw11FirstDayEnd(m) {
  const label = "첫날 처형으로 끝난 판: 정답 공개 없이 ended, 결과에 '정답 · 키워드' 한 줄";
  if (!m || typeof m.answer !== "string" || m.answer === "" || !Array.isArray(m.phases) || m.phases.length === 0) return noMeasure("KW11", label, "단계 열·정답");
  const bad = [];
  if (m.phases.includes("answerReveal")) bad.push("answerReveal 단계가 끼어 있음");
  if (m.phases[m.phases.length - 1] !== "ended") bad.push(`마지막 단계 ${m.phases[m.phases.length - 1]}(ended 여야 함)`);
  if (m.hostLine !== `정답 · ${m.answer}`) bad.push(`결과 줄 '${m.hostLine}' ≠ '정답 · ${m.answer}'`);
  return result("KW11", label, bad);
}

const EARLY_STAGES = ["keyword", "verdict", "night"];
/**
 * KW12(P23-12) 조기 진행. items = [{ stage, advanceMs(마지막 행동 → 다음 단계), early(data-early 가 보임), tone?(초·띠 색), extendedMs?(유예 안 번복이 마감을 늘린 양, 찬반), parity?(밤 두 페이지 프레임·표식 같음, 밤) }].
 * 키워드·찬반·밤 셋이 모두 있어야 하고, 각 단계 1.5초(+오차) 안에 넘어가며 data-early·calm 이 보인다. 찬반은 번복이 마감을 늘리고, 밤은 두 역할 화면이 같다.
 */
export function kw12Early(items) {
  const label = `전원이 끝내면 ${EARLY_GRACE_MS_COPY / 1000}초(+오차) 안에 다음 단계, data-early·calm, 찬반 번복은 마감이 다시 늘고 밤은 역할과 무관하게 같다`;
  if (!Array.isArray(items)) return noMeasure("KW12", label, "단계별 측정");
  const missing = EARLY_STAGES.filter((s) => !items.some((it) => it.stage === s));
  if (missing.length > 0) return noMeasure("KW12", label, `단계 ${missing.join("·")}`);
  const bad = [];
  for (const it of items) {
    if (!isNum(it.advanceMs)) bad.push(`${it.stage} 넘어간 시간 없음`);
    else if (it.advanceMs > EARLY_GRACE_MS_COPY + KW_TOL_MS) bad.push(`${it.stage} ${Math.round(it.advanceMs)}ms 걸림(≤ ${EARLY_GRACE_MS_COPY + KW_TOL_MS})`);
    if (it.early !== true) bad.push(`${it.stage} data-early 가 안 보임`);
    if (it.tone !== undefined && it.tone !== "calm") bad.push(`${it.stage} 색 ${it.tone}(calm 이어야 함)`);
    if (it.stage === "verdict" && !(isNum(it.extendedMs) && it.extendedMs > 0)) bad.push("찬반 번복이 마감을 늘리지 않음");
    if (it.stage === "night" && it.parity !== true) bad.push("밤 프레임·표식이 역할마다 다름");
  }
  return result("KW12", label, bad);
}

const sameSet = (a, b) => a.length === b.length && a.every((k) => b.includes(k));
/**
 * KW13(P23-13) 누설. m = { mafia: { top, me, day }, citizen: { top, me, day }(키 이름 목록), mafiaFrameHits(마피아 소켓 프레임 중 키워드가 든 수), citizenFrameHits(시민 소켓 프레임 중 키워드가 든 수 — 측정이 맞는지 본다), hostOnlyMe }.
 * 최상위·day 키 집합은 같고, me 는 시민에게만 keyword(방장 전용 테스트 키는 빼고) — 마피아 프레임에는 키워드 문자열이 없다.
 */
export function kw13Leak(m) {
  const label = "키워드 단계 view 키 집합이 마피아·시민에서 me.keyword 외 같다 · 마피아 소켓 프레임에 정답 문자열이 없다";
  const ok = (s) => s && Array.isArray(s.top) && Array.isArray(s.me) && Array.isArray(s.day) && s.top.length > 0 && s.me.length > 0;
  if (!m || !ok(m.mafia) || !ok(m.citizen) || !isNum(m.mafiaFrameHits) || !isNum(m.citizenFrameHits)) return noMeasure("KW13", label, "마피아·시민 view 키·프레임 수");
  const bad = [];
  const hostOnly = new Set(m.hostOnlyMe ?? []);
  if (!sameSet(m.mafia.top, m.citizen.top)) bad.push(`최상위 키 차이: ${[...new Set([...m.mafia.top, ...m.citizen.top])].filter((k) => m.mafia.top.includes(k) !== m.citizen.top.includes(k)).join("·")}`);
  if (!sameSet(m.mafia.day, m.citizen.day)) bad.push(`day 키 차이: ${[...new Set([...m.mafia.day, ...m.citizen.day])].filter((k) => m.mafia.day.includes(k) !== m.citizen.day.includes(k)).join("·")}`);
  if (m.mafia.me.includes("keyword")) bad.push("마피아가 me.keyword 를 받음");
  if (!m.citizen.me.includes("keyword")) bad.push("시민이 me.keyword 를 못 받음(측정이 어긋남)");
  const meDiff = [...new Set([...m.mafia.me, ...m.citizen.me])].filter((k) => k !== "keyword" && !hostOnly.has(k) && m.mafia.me.includes(k) !== m.citizen.me.includes(k));
  if (meDiff.length > 0) bad.push(`me 키 차이(keyword 외): ${meDiff.join("·")}`);
  if (m.mafiaFrameHits > 0) bad.push(`마피아 소켓 프레임 ${m.mafiaFrameHits}개에 정답 문자열이 있음`);
  if (m.citizenFrameHits === 0) bad.push("시민 소켓 프레임에서 정답을 못 찾음(측정이 어긋남)");
  return result("KW13", label, bad);
}

// ---- 흐름(Task 2) ----
export function makeKeywordFlows(helpers) {
  void helpers;
  void [chooseVerdict, installFakeViewport, openTestSheet, readGame, settle, skipTo, sleep];
  return { keywordFlow: async () => {}, keywordSizesFlow: async () => {}, earlyFlow: async () => {} };
}
