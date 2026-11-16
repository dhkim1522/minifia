// 23페이즈 첫날 키워드·정답 공개·조기 진행 E2E (23-12, UI-SPEC "E2E 표식과 판정 초안" P23-1~13 = KW1~KW13).
// 판정 문턱은 이 파일의 순수 함수(kw1PhaseColumns~kw13Leak)에만 있고 keyword.test.mjs 가 단위 시험한다. 흐름 본문(makeKeywordFlows)은 얇게 읽고 부른다.
// day.mjs·avatar.mjs 와 같은 모양: helpers 를 받고 서로 import 하지 않는다.
// helpers: { recorder, attempt, openGame, closeGame, allAt, untilGame, gameGH, GAME_HOST_NICK }.
// 표식(data-keyword-*·data-answer-*·data-announce-label·data-early)에는 역할·키워드 값이 없다 — 키워드는 텍스트 노드로만 읽는다(T-23-43).
import { chooseVerdict, installFakeViewport, settle, skipDayToExecution, skipTo, sleep, watchSockets } from "./browser.mjs";
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
/** 23페이즈 전부터 역할에 따라 있던 me 키(마피아 동료·활동 기록) — 키워드와 무관한 기존 차이라 KW13 비교에서 뺀다 */
export const ROLE_ME_KEYS = ["allies", "records", "allyPicks", "nightTally", "nightSure"];

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
 * 최상위·day 키 집합은 같고, me 는 시민에게만 keyword(방장 전용 테스트 키 hostOnlyMe·23페이즈 전부터 있던 역할 키 roleMe 는 빼고) — 마피아 프레임에는 키워드 문자열이 없다.
 */
export function kw13Leak(m) {
  const label = "키워드 단계 view 키 집합이 마피아·시민에서 me.keyword 외 같다 · 마피아 소켓 프레임에 정답 문자열이 없다";
  const ok = (s) => s && Array.isArray(s.top) && Array.isArray(s.me) && Array.isArray(s.day) && s.top.length > 0 && s.me.length > 0;
  if (!m || !ok(m.mafia) || !ok(m.citizen) || !isNum(m.mafiaFrameHits) || !isNum(m.citizenFrameHits)) return noMeasure("KW13", label, "마피아·시민 view 키·프레임 수");
  const bad = [];
  const hostOnly = new Set([...(m.hostOnlyMe ?? []), ...(m.roleMe ?? [])]);
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

// ---- 페이지 안 감시(init 스크립트) ----

/**
 * 키워드 입력줄 감시. 모든 페이지가 만들어질 때 넣는다(함수 하나 — addInitScript 가 문자열로 직렬화하므로 바깥 값을 쓰지 않는다).
 * 30ms 마다 `[data-answer-state]` 의 상태 바뀜·입력칸 data-call 첫 시각·거절 알림 글(떴다 사라진 시각)·조기 진행 표식(`[data-host-band][data-early]`)을 기록한다.
 * 키워드·역할 값은 기록하지 않는다 — 입력칸 글(사용자가 쓴 글)과 알림 글만 담는다. 읽기는 window.__kwWatch.
 */
export function installKeywordWatch() {
  const st = { states: [], callAt: null, notices: [], earlyAt: null, tones: [] };
  window.__kwWatch = st;
  setInterval(() => {
    const now = Date.now();
    const band = document.querySelector("[data-host-band][data-early]");
    if (band && st.earlyAt === null) st.earlyAt = now;
    const root = document.querySelector("[data-answer-state]");
    if (!root) return;
    const state = root.getAttribute("data-answer-state");
    const lastState = st.states[st.states.length - 1];
    if (!lastState || lastState.state !== state) st.states.push({ state, at: now });
    const input = root.querySelector("[data-answer-input]");
    if (input && input.hasAttribute("data-call") && st.callAt === null) st.callAt = now;
    const text = (root.querySelector("[data-answer-notice]")?.textContent ?? "").trim();
    const last = st.notices[st.notices.length - 1];
    if (text !== "" && (!last || last.endAt !== null)) st.notices.push({ text, startAt: now, endAt: null, value: input ? input.value : "" });
    else if (text === "" && last && last.endAt === null) last.endAt = now;
    if (st.earlyAt !== null) {
      const tone = root.querySelector("[data-answer-secs]")?.getAttribute("data-tone");
      if (tone && !st.tones.includes(tone)) st.tones.push(tone);
    }
  }, 30);
}

// ---- 읽기 ----

const readWatch = (page) => page.evaluate(() => (window.__kwWatch ? JSON.parse(JSON.stringify(window.__kwWatch)) : null));

/** 키워드 카드의 세 줄 글(키워드는 텍스트 노드로만 읽는다) */
const readCard = (page) =>
  page.evaluate(() => ({
    genre: document.querySelector("[data-keyword-genre]")?.textContent ?? null,
    word: document.querySelector("[data-keyword-word]")?.textContent ?? null,
    note: document.querySelector("[data-keyword-note]")?.textContent ?? null,
  }));

/** 문서 원문과 모든 속성 값(키워드·정답이 DOM 어디에도 없는지 보는 재료) */
const readDomText = (page) =>
  page.evaluate(() => {
    const attrs = [];
    for (const el of document.querySelectorAll("*")) for (const n of el.getAttributeNames()) attrs.push(`${n}=${el.getAttribute(n)}`);
    return { html: document.documentElement.outerHTML, attrs: attrs.join("\n") };
  });

/** 입력줄 한 장: 입력칸 자소 수·글자 수 글·상태·읽기 전용·[보내기] 이름 */
const readAnswerLine = (page) =>
  page.evaluate(() => {
    const root = document.querySelector("[data-answer-state]");
    const input = root?.querySelector("[data-answer-input]");
    const v = input ? input.value : "";
    return {
      state: root?.getAttribute("data-answer-state") ?? null,
      value: v,
      inputLen: [...new Intl.Segmenter("ko", { granularity: "grapheme" }).segment(v)].length,
      countText: root?.querySelector("[data-answer-count]")?.textContent ?? "",
      readOnly: !!input && input.readOnly,
      label: root?.querySelector("[data-answer-send]")?.getAttribute("aria-label") ?? null,
    };
  });

/** 키보드 열림 기하(가짜 visualViewport 높이 기준) */
const readGeometry = (page) =>
  page.evaluate(() => {
    const rectOf = (el) => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
    };
    const vv = window.visualViewport;
    const q = (s) => document.querySelector(s);
    return {
      vw: window.innerWidth,
      vh: vv ? vv.height : window.innerHeight,
      compact: q("[data-keyword-card]")?.getAttribute("data-compact") === "true",
      header: rectOf(q(".mf-reveal__header")),
      card: rectOf(q("[data-keyword-card]")),
      meta: rectOf(q(".mf-keyword__meta")),
      form: rectOf(q(".mv-chat__form")),
      send: rectOf(q("[data-answer-send]")),
      secs: rectOf(q("[data-answer-secs]")),
      count: rectOf(q("[data-answer-count]")),
    };
  });

/** 열린 시트 안 목록: 줄(번호·좌석·답 없음)과 정답 줄 글·맨 아래 여부, 탭 수. 시트가 없거나 목록이 없으면 rows null */
const readAnswerSheet = (page) =>
  page.evaluate(() => {
    const dlg = document.querySelector("dialog.mf-dialog--open");
    const list = dlg?.querySelector("[data-answer-list]") ?? null;
    const rows = list ? [...list.querySelectorAll("[data-answer-row]")].map((r) => ({ order: Number(r.getAttribute("data-answer-order")), seat: Number(r.getAttribute("data-answer-seat")), none: r.hasAttribute("data-answer-none") })) : null;
    const correctEl = dlg?.querySelector("[data-answer-correct]") ?? null;
    const rowEls = list ? [...list.querySelectorAll("[data-answer-row]")] : [];
    return {
      open: !!dlg,
      rows,
      tabs: dlg ? dlg.querySelectorAll('[data-rolecard-tab="answers"]').length : 0,
      correct: correctEl ? (correctEl.textContent ?? "").trim() : null,
      correctLast: correctEl ? rowEls.every((r) => (r.compareDocumentPosition(correctEl) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0) : null,
    };
  });

/** 정답 공개 큰 글: 라벨과 키워드 글 */
const readAnnounce = (page) =>
  page.evaluate(() => ({
    label: document.querySelector("[data-announce-label]")?.textContent ?? null,
    text: document.querySelector("[data-announce] .mf-announce__text")?.textContent ?? null,
  }));

const keysOf = (v) => ({ top: Object.keys(v ?? {}), me: Object.keys(v?.me ?? {}), day: Object.keys(v?.day ?? {}) });

/** 시트를 닫는다(닫기 단추). 없으면 그대로 */
async function closeOpenSheet(page) {
  const dlg = page.locator("dialog.mf-dialog--open");
  if ((await dlg.count()) === 0) return;
  await dlg.locator('[aria-label="닫기"]').first().click({ timeout: 3000 });
  await dlg.first().waitFor({ state: "detached", timeout: 3000 });
}

/** 입력칸에 글을 쓰고 [보내기]를 누른다 */
async function typeAndSend(page, text) {
  await page.locator("[data-answer-input]").fill(text);
  await page.locator("[data-answer-send]").click({ timeout: 3000 });
}

/** 거절 알림이 한 번 떴다 사라질 때까지 기다려 그 기록을 돌려준다 */
async function waitNoticeCycle(page, ms = 6000) {
  const start = performance.now();
  for (;;) {
    const w = await readWatch(page);
    const n = w?.notices?.[w.notices.length - 1];
    if (n && n.endAt !== null) return n;
    if (performance.now() - start > ms) return null;
    await sleep(50);
  }
}

/** 단계가 pred 로 바뀔 때까지 tracker 를 10ms 로 읽는다. 바뀐 시각(performance.now) 또는 null */
async function phaseLeftAt(tracker, phase, ms) {
  const start = performance.now();
  while (performance.now() - start < ms) {
    if (tracker.last()?.phase !== phase) return performance.now();
    await sleep(10);
  }
  return null;
}

/** 단계 이름을 오류 글 앞에 붙인다(여러 단추를 누르는 흐름에서 어디서 멈췄는지 알도록) */
async function at(label, fn) {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof Error) e.message = `${label}: ${e.message}`;
    throw e;
  }
}

const KW_WORD = "나만아는말";
const KW_LONG = "가나다라마바사아자차카타파하거너더러머버서"; // 21자
const GAME4 = { guests: 1, bots: 2 };

// ---- 흐름 ----

export function makeKeywordFlows({ recorder, attempt, openGame, closeGame, allAt, untilGame, gameGH, GAME_HOST_NICK }) {
  const recLines = (rec, sc, lines, suffix = "") => {
    for (const l of lines) rec(sc, l.id, `${l.label}${suffix}`, l.ok, l.detail);
  };
  const rec1 = (rec, sc, r, suffix = "") => rec(sc, r.id, `${r.label}${suffix}`, r.ok, r.detail);

  /** 키워드 단계까지: 방장 마피아 + 참가자 1(시민 편) + 봇 2. 두 페이지에 입력줄 감시를 넣는다 */
  const openKeyword = (ctx, id, { extraHost = [], vote = { exec: "no", pick: "host" } } = {}) =>
    openGame(ctx, id, { ...GAME4, role: "mafia", vote, to: "keyword", hostNick: GAME_HOST_NICK, hostInitScripts: [installKeywordWatch, ...extraHost], guestInitScripts: [installKeywordWatch, ...extraHost] });

  /** 키워드 단계 시작(서버 시각, 이 기계에서는 브라우저 시각과 같다) — 아직 아무도 제출하지 않았을 때 읽는다 */
  const startOf = (tracker) => {
    const v = tracker.last();
    return v.phaseEndsAt - v.phaseDurationMs;
  };

  /** 두 페이지가 그 판 키워드를 같이 보내 거절을 받는다. 돌려주는 값: KW6 입력(페이지별 알림 기록) */
  async function rejectBoth(pages, word) {
    for (const p of pages) await waitOpen(p.page);
    await at("거절 보내기", () => Promise.all(pages.map((p) => typeAndSend(p.page, word))));
    const notices = await Promise.all(pages.map((p) => waitNoticeCycle(p.page)));
    const lines = await Promise.all(pages.map((p) => readAnswerLine(p.page)));
    return pages.map((p, i) => ({ who: p.who, text: notices[i]?.text ?? null, noticeMs: notices[i] ? notices[i].endAt - notices[i].startAt : null, valueKept: lines[i].value === word, stateAfter: lines[i].state }));
  }

  const waitOpen = (page, ms = 8000) => page.waitForSelector('[data-answer-state="open"]', { timeout: ms });

  // ---- keyword: 첫날 한 판 완주 (P23-1~6·8~10·13, 390x844) ----
  async function keywordFlow(ctx) {
    const id = "keyword";
    const rec = recorder(ctx);
    const game = await openKeyword(ctx, id);
    try {
      const { hp, ht, guests } = game;
      const [g] = guests;
      const gp = g.page;
      const pages = [{ who: "참가자(시민 편)", page: gp, tracker: g.tracker }, { who: "방장(마피아)", page: hp, tracker: ht }];
      await Promise.all(pages.map((p) => p.page.waitForSelector("[data-keyword-card]", { timeout: 6000 })));
      const t0 = startOf(g.tracker);

      // KW2·KW4: 참가자(시민 편) 카드와 읽기 3초 잠금
      const card = await readCard(gp);
      const word = (card.word ?? "").trim();
      rec1(rec, `${id}/citizen`, kw2CitizenCard(card));
      const answerAtStart = (await readAnswerLine(gp)).state;
      rec(`${id}/citizen`, "KW4a", "키워드 단계가 열리자마자 입력줄이 locked 다", answerAtStart === "locked", `처음 읽은 상태 ${answerAtStart}`);

      // KW13: 방장(마피아)·참가자(시민 편) 페이지를 다시 연결해 그 연결의 모든 프레임에 키워드가 있는지 본다(정답 공개 전까지, 시민 쪽은 키워드를 받는 대조군)
      const keyBefore = { mafia: keysOf(ht.last()), citizen: keysOf(g.tracker.last()) };
      const mafiaWs = watchSockets(hp, { needles: [word] });
      const citizenWs = watchSockets(gp, { needles: [word] });
      await Promise.all([hp, gp].map((p) => p.reload({ waitUntil: "domcontentloaded" })));
      await Promise.all([hp, gp].map((p) => p.waitForSelector("[data-keyword-card]", { timeout: 8000 })));

      // KW3: 방장(마피아) 카드 ??? 와 DOM 원문·속성에 키워드 없음
      const mcard = await readCard(hp);
      const dom = await readDomText(hp);
      rec1(rec, `${id}/mafia`, kw3MafiaCard({ word: mcard.word ?? "", genre: mcard.genre ?? "", html: dom.html, attrs: dom.attrs, answer: word }));

      // KW4: 시작 → locked → 3초 → open + data-call (참가자 페이지 감시 기록)
      await waitOpen(gp);
      await sleep(250);
      const w = await readWatch(gp);
      const openAt = w?.states?.find((s) => s.state === "open")?.at;
      rec1(rec, `${id}/citizen`, kw4ReadLock({ firstState: w?.states?.[0]?.state, firstAtMs: w?.states?.[0] ? w.states[0].at - t0 : undefined, openAtMs: openAt !== undefined ? openAt - t0 : undefined, callAtMs: w?.callAt != null ? w.callAt - t0 : null }));

      // KW6: 시민·마피아가 같은 금지어(그 판 키워드)를 보낸다
      const rej = await rejectBoth([{ who: "참가자(시민 편)", page: gp }, { who: "방장(마피아)", page: hp }], word);
      rec1(rec, `${id}/reject`, kw6Reject(rej));

      // KW5: 21자 입력 → 20 에서 멈춤, n/20 → 보내면 sent·읽기 전용
      await gp.locator("[data-answer-input]").fill(KW_LONG);
      await sleep(100);
      const longLine = await readAnswerLine(gp);
      await at("KW5 보내기", () => typeAndSend(gp, KW_WORD));
      await gp.waitForSelector('[data-answer-state="sent"]', { timeout: 4000 }).catch(() => {});
      const sent = await readAnswerLine(gp);
      rec1(rec, `${id}/input`, kw5InputLimit({ inputLen: longLine.inputLen, countText: longLine.countText, afterSend: { state: sent.state, readOnly: sent.readOnly, label: sent.label } }));

      // 방장도 거절 뒤 다른 글을 보낸다(두 번째로 낸 사람)
      await at("방장 보내기", () => typeAndSend(hp, "다른말"));
      await hp.waitForSelector('[data-answer-state="sent"]', { timeout: 4000 }).catch(() => {});

      // 사람 전원이 냈으니 곧 낮 시작 → 토론. 토론 시작에 모두의 답이 저절로 한 번 열린다(KW8)
      await Promise.all(pages.map((p) => p.tracker.waitFor((v) => v.phase === "discussion", 12_000, "낮 시작 → 토론")));
      const sheets = [];
      for (const p of pages) {
        const opened = await p.page.waitForSelector("dialog.mf-dialog--open [data-answer-list]", { timeout: 4000 }).then(() => true).catch(() => false);
        const sh = await readAnswerSheet(p.page);
        sheets.push({ who: p.who, page: p.page, autoOpened: opened, hasTab: sh.tabs >= 1, rows: sh.rows ?? [] });
      }
      for (const s of sheets) await closeOpenSheet(s.page).catch(() => {});
      await sleep(1600);
      for (const s of sheets) s.reopened = (await readAnswerSheet(s.page)).open;
      rec1(rec, `${id}/answers`, kw8AnswerList(sheets.map(({ page, ...rest }) => rest)));

      // KW9: 참가자 재접속 — 저절로 안 열리고 [내 역할] → 첫날 답 으로 같은 목록. 그 연결 프레임에서 시민은 키워드를 받는다(KW13 대조군)
      const rowsBefore = sheets[0].rows;
      await gp.reload({ waitUntil: "domcontentloaded" });
      await untilGame(gp, (x) => x.phase === "discussion", 10_000, "재접속 뒤 토론");
      await sleep(1800);
      const autoAfter = (await readAnswerSheet(gp)).open;
      await at("KW9 [내 역할]", () => gp.locator(".mf-rolecard-btn").click({ timeout: 4000 }));
      await at("KW9 첫날 답 탭", () => gp.locator('dialog.mf-dialog--open [data-rolecard-tab="answers"]').click({ timeout: 4000 }));
      await gp.waitForSelector("dialog.mf-dialog--open [data-answer-list]", { timeout: 4000 }).catch(() => {});
      const afterSheet = await readAnswerSheet(gp);
      rec1(rec, `${id}/reconnect`, kw9Reconnect({ autoOpened: autoAfter, rowsBefore, rowsAfter: afterSheet.rows ?? [] }));
      await closeOpenSheet(gp).catch(() => {});

      // KW13: 정답 공개 전 마피아 프레임에 키워드 문자열 0, view 키 집합(키워드 단계 스냅샷)
      await sleep(300);
      const mafiaHits = mafiaWs.hits[word] ?? 0;
      const citizenHits = citizenWs.hits[word] ?? 0;
      mafiaWs.stop();
      citizenWs.stop();
      rec1(rec, `${id}/leak`, kw13Leak({ mafia: keyBefore.mafia, citizen: keyBefore.citizen, mafiaFrameHits: mafiaHits, citizenFrameHits: citizenHits, hostOnlyMe: HOST_ONLY_ME_KEYS, roleMe: ROLE_ME_KEYS }));

      // 정답 공개: 찬반 부결(봇 둘 반대) → 처형 없음 → 정답 공개(KW10)
      await at("정답 공개로 넘기기", () => skipTo(hp, ht, "answerReveal"));
      const reveal = await Promise.all(pages.map(async (p) => {
        await p.page.waitForSelector("[data-announce-label]", { timeout: 6000 }).catch(() => {});
        return { who: p.who, ...(await readAnnounce(p.page)) };
      }));
      await Promise.all(pages.map((p) => p.tracker.waitFor((v) => v.phase === "night", 9000, "정답 공개 → 밤")));
      const correct = [];
      for (const p of pages) {
        await at(`KW10 ${p.who} [내 역할]`, () => p.page.locator(".mf-rolecard-btn").click({ timeout: 4000 }));
        await at(`KW10 ${p.who} 첫날 답 탭`, () => p.page.locator('dialog.mf-dialog--open [data-rolecard-tab="answers"]').click({ timeout: 4000 }));
        await p.page.waitForSelector("dialog.mf-dialog--open [data-answer-list]", { timeout: 4000 }).catch(() => {});
        const sh = await readAnswerSheet(p.page);
        correct.push({ who: p.who, text: sh.correct, last: sh.correctLast });
        await closeOpenSheet(p.page).catch(() => {});
      }
      rec1(rec, `${id}/reveal`, kw10Reveal({ pages: reveal, answer: word, correct }));

      // KW1: 둘째 날까지 단계 열
      await skipTo(hp, ht, "dayAnnounce");
      rec1(rec, `${id}/phases`, kw1PhaseColumns({ seq: ht.phases.slice(), endedDayOne: false }));
      await gameGH(ctx, id, "day2", game.host);
    } finally {
      await closeGame(game);
    }

    // KW11: 첫날 처형으로 끝난 판 — 정답 공개 없이 결과로, 결과에 정답 한 줄
    {
      const sc = `${id}/end`;
      const game2 = await openGame(ctx, id, { ...GAME4, role: "mafia", vote: { exec: "yes", pick: "host" }, to: "keyword", hostNick: GAME_HOST_NICK });
      try {
        const { hp, ht, guests } = game2;
        const gp = guests[0].page;
        await gp.waitForSelector("[data-keyword-word]", { timeout: 6000 });
        const word = ((await readCard(gp)).word ?? "").trim();
        await skipTo(hp, ht, "discussion");
        await skipDayToExecution(hp, ht, [gp]);
        await skipTo(hp, ht, "ended");
        let line = "";
        const start = performance.now();
        while (performance.now() - start < 14_000) {
          line = ((await gp.evaluate(() => document.querySelector("[data-host-line]")?.textContent ?? "")) || "").trim();
          if (line.startsWith("정답")) break;
          await sleep(200);
        }
        const from = Math.max(0, ht.phases.indexOf("execution"));
        rec1(rec, sc, kw11FirstDayEnd({ phases: ht.phases.slice(from), hostLine: line, answer: word }));
        rec1(rec, sc, kw1PhaseColumns({ seq: ht.phases.slice(), endedDayOne: true }), " (첫날 끝)");
      } finally {
        await closeGame(game2);
      }
    }
  }

  // ---- keyword-sizes: 폰 6종 — 금지어 거절(KW6)과 키보드 열림 컴팩트 카드 기하(KW7, P23-6·7) ----
  async function keywordSizesFlow(ctx) {
    const id = "keyword-sizes";
    const rec = recorder(ctx);
    const K = 336;
    const game = await openKeyword(ctx, id, { extraHost: [installFakeViewport] });
    try {
      const { hp, ht, guests } = game;
      const [g] = guests;
      const pages = [{ who: "참가자(시민 편)", page: g.page }, { who: "방장(마피아)", page: hp }];
      await Promise.all(pages.map((p) => p.page.waitForSelector("[data-keyword-card]", { timeout: 6000 })));
      const word = (((await readCard(g.page)).word) ?? "").trim();
      const rej = await rejectBoth(pages, word);
      recLines(rec, `${id}/reject`, [kw6Reject(rej)], ` (${ctx.size.label})`);
      // 키보드 열림: 입력칸 포커스 + 가짜 키보드(visualViewport 높이 − K)
      for (const p of pages) {
        await p.page.locator("[data-answer-input]").focus();
        await p.page.evaluate((k) => window.__mfVv.set(window.innerHeight - k, 0), K);
      }
      await sleep(700);
      for (const p of pages) {
        const geo = await readGeometry(p.page);
        recLines(rec, `${id}/keyboard`, [kw7CompactGeometry(geo)], ` (${p.who}, ${ctx.size.label}, K ${K})`);
        // 키보드가 열려도 단계가 그대로 키워드다
      }
      rec(`${id}/keyboard`, "KW7b", `키보드를 열어도 단계가 그대로 키워드다 (${ctx.size.label})`, ht.last().phase === "keyword", `단계 ${ht.last().phase}`);
      for (const p of pages) await p.page.evaluate(() => window.__mfVv.set(window.innerHeight, 0));
    } finally {
      await closeGame(game);
    }
  }

  // ---- early: 일찍 넘어가기 — 키워드·찬반·밤 (P23-12, 390x844) ----
  async function earlyFlow(ctx) {
    const id = "early";
    const rec = recorder(ctx);
    const game = await openKeyword(ctx, id, { vote: { exec: "no", pick: "host" } });
    try {
      const { hp, ht, guests } = game;
      const [g] = guests;
      const gt = g.tracker;
      const pages = [{ who: "참가자(시민 편)", page: g.page, tracker: gt }, { who: "방장(마피아)", page: hp, tracker: ht }];
      const items = [];

      // 키워드: 사람 둘이 모두 내면(봇은 안 낸다) 1.5초 안에 낮 시작
      await Promise.all(pages.map((p) => waitOpen(p.page)));
      await typeAndSend(g.page, KW_WORD);
      await typeAndSend(hp, "다른말");
      const tLast = performance.now();
      const left = await phaseLeftAt(ht, "keyword", 6000);
      await sleep(100);
      const wk = await readWatch(hp);
      items.push({ stage: "keyword", advanceMs: left === null ? undefined : left - tLast, early: wk?.earlyAt != null, tone: wk?.tones?.length ? (wk.tones.every((t) => t === "calm") ? "calm" : wk.tones.find((t) => t !== "calm")) : undefined });
      rec(`${id}/keyword`, "KW12k", "봇은 답을 내지 않고 사람 둘만 냈는데 낮 시작으로 넘어간다", ht.last().phase === "dayAnnounce" || ht.last().phase === "discussion", `단계 ${ht.last().phase}`);

      // 찬반: 봇 표가 다 들어온 뒤 사람 둘이 던지면 1.5초 안에 넘어가고, 유예 안 번복은 마감을 다시 늘린다
      await ht.waitFor((v) => v.phase === "discussion", 6000, "토론");
      await sleep(900);
      for (const p of pages) await closeOpenSheet(p.page).catch(() => {}); // 첫날 토론 시작에 저절로 열린 모두의 답
      await skipTo(hp, ht, "verdict");
      await allAt(pages.map((p) => p.page), "verdict");
      await Promise.all(pages.map((p) => untilGame(p.page, (x) => x.verdictCounts?.yes + x.verdictCounts?.no === 2, 9000, "봇 표 둘")));
      await chooseVerdict(g.page, false);
      await chooseVerdict(hp, false);
      const ends1 = await (async () => {
        const start = performance.now();
        while (performance.now() - start < 3000) {
          const v = ht.last();
          if (v.phase === "verdict" && v.phaseEndsAt - Date.now() <= EARLY_GRACE_MS_COPY + 400) return v.phaseEndsAt;
          await sleep(15);
        }
        return null;
      })();
      await sleep(400);
      await chooseVerdict(g.page, true).catch(() => {});
      const tFlip = performance.now();
      let ends2 = null;
      const sw = performance.now();
      while (performance.now() - sw < 2500 && ends1 !== null) {
        const v = ht.last();
        if (v.phase === "verdict" && v.phaseEndsAt > ends1 + 50) {
          ends2 = v.phaseEndsAt;
          break;
        }
        await sleep(15);
      }
      const leftV = await phaseLeftAt(ht, "verdict", 4000);
      const wv = await readWatch(hp);
      items.push({ stage: "verdict", advanceMs: leftV === null ? undefined : leftV - tFlip, early: wv?.earlyAt != null, extendedMs: ends1 !== null && ends2 !== null ? ends2 - ends1 : 0 });

      // 밤: 정답 공개를 지나 밤. 전원(사람 둘 + 봇 둘)이 고르면 1.5초 안에 넘어간다 — 마피아·시민 두 화면의 마감·표식이 같다
      await ht.waitFor((v) => v.phase === "night", 12_000, "정답 공개 → 밤");
      await Promise.all(pages.map((p) => untilGame(p.page, (x) => x.phase === "night", 6000, "밤 도착")));
      const seatOf = (t) => t.last().me.seat;
      const aliveOthers = (t) => t.last().players.filter((p) => p.seat !== seatOf(t) && p.alive !== false).map((p) => p.seat);
      for (const p of pages) {
        const target = aliveOthers(p.tracker)[0];
        await p.page.locator(`[data-face="${target}"], [data-pick="${target}"]`).first().click({ timeout: 4000 });
      }
      // 봇이 모두 고르면(원래 마감보다 일찍) 마감이 now+1.5초로 줄어든다 — 그 순간을 잡아 다음 단계까지의 시간을 잰다
      const sn = performance.now();
      let shrunkAt = null;
      let endsH = null;
      let endsG = null;
      while (performance.now() - sn < 28_000) {
        const v = ht.last();
        if (v.phase !== "night") break;
        if (v.phaseEndsAt - Date.now() <= EARLY_GRACE_MS_COPY + 300 && v.phaseDurationMs - (v.phaseEndsAt - Date.now()) > 0 && performance.now() - sn > 1500) {
          shrunkAt = performance.now();
          endsH = v.phaseEndsAt;
          endsG = gt.last().phaseEndsAt;
          break;
        }
        await sleep(15);
      }
      const leftN = await phaseLeftAt(ht, "night", 4000);
      const wn = await Promise.all(pages.map((p) => readWatch(p.page)));
      const parity = endsH !== null && endsH === endsG && wn.every((w) => w?.earlyAt != null);
      items.push({ stage: "night", advanceMs: leftN === null || shrunkAt === null ? undefined : leftN - shrunkAt, early: wn.every((w) => w?.earlyAt != null), parity });
      rec1(rec, `${id}/early`, kw12Early(items));
      for (const it of items) rec(`${id}/early`, `KW12-${it.stage}`, `${it.stage}: 마감 단축 측정(참고)`, true, JSON.stringify(it), true);
    } finally {
      await closeGame(game);
    }
  }

  return { keywordFlow, keywordSizesFlow, earlyFlow };
}
