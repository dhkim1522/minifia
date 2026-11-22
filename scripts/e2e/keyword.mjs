// 23페이즈 첫날 키워드·정답 공개·조기 진행 E2E (23-12, UI-SPEC "E2E 표식과 판정 초안" P23-1~13 = KW1~KW13).
// 판정 문턱은 이 파일의 순수 함수(kw1PhaseColumns~kw13Leak)에만 있고 keyword.test.mjs 가 단위 시험한다. 흐름 본문(makeKeywordFlows)은 얇게 읽고 부른다.
// day.mjs·avatar.mjs 와 같은 모양: helpers 를 받고 서로 import 하지 않는다.
// helpers: { recorder, attempt, openGame, closeGame, allAt, untilGame, gameGH, GAME_HOST_NICK }.
// 표식(data-keyword-*·data-answer-*·data-announce-label·data-early)에는 역할·키워드 값이 없다 — 키워드는 텍스트 노드로만 읽는다(T-23-43).
import { chooseVerdict, installFakeViewport, openRoleCard, openTableDockPane, settle, showPeopleTarget, skipDayToExecution, skipTo, sleep, waitForPhaseStart, watchSockets } from "./browser.mjs";
import { OVERLAP_EPS, TAP_MIN } from "./lib.mjs";

const isNum = (x) => typeof x === "number" && Number.isFinite(x);
const result = (id, label, bad) => ({ id, label, ok: bad.length === 0, detail: bad.length === 0 ? "" : bad.join("; ") });
const noMeasure = (id, label, what) => result(id, label, [`측정값 없음(${what})`]);
const fmt = (n) => Math.round(n * 10) / 10;
const rectOk = (r) => !!r && [r.left, r.top, r.right, r.bottom, r.width, r.height].every(isNum);
const overlaps = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > OVERLAP_EPS && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > OVERLAP_EPS;

// ---- 사본 상수(test/unit/e2eContract.test.ts 가 서버·앱 상수와 대조한다) ----
/** 제시어가 표시된 순간부터 단서를 쓸 수 있는 시간(ms) */
export const KEYWORD_MS_COPY = 35_000;
/** 정답 공개 단계 길이(ms) */
export const ANSWER_REVEAL_MS_COPY = 3_000;
/** 답 길이 상한(자소) */
export const ANSWER_MAX_GRAPHEMES_COPY = 20;
/** 서버의 답 전송 최소 간격(ms) */
export const ANSWER_MIN_GAP_MS_COPY = 400;
/** 전원이 끝낸 뒤 남기는 시간(ms) */
export const EARLY_GRACE_MS_COPY = 1_500;
/** 제시어를 아는 사람의 수정 안내 */
export const KEYWORD_BLOCKED_COPY = "제시어가 들어 있어요. 다른 표현으로 바꿔 주세요.";
/** 키워드 카드 각주(사용자 글) */
export const KEYWORD_NOTE_COPY = "제시어는 쓰지 말고 단서를 남겨요";
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

/** KW2(P23-2) 시민 카드. m = { genre(주제 줄 글), word(키워드 줄 글), note(각주 글) } */
export function kw2CitizenCard(m) {
  const label = "시민 카드: 주제 줄 `주제 · …` · 키워드 줄 · 각주가 사용자 글과 같다";
  if (!m || typeof m.genre !== "string" || typeof m.word !== "string" || typeof m.note !== "string") return noMeasure("KW2", label, "장르·키워드·각주 글");
  const bad = [];
  if (!/^주제 · \S.*$/.test(m.genre.trim())) bad.push(`주제 줄 '${m.genre}'`);
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
  if (typeof m.genre !== "string" || !/^주제 · \S/.test(m.genre.trim())) bad.push(`주제 줄 '${m.genre}'`);
  if (m.html.includes(m.answer)) bad.push("DOM 원문에 키워드가 있음");
  if (m.attrs.includes(m.answer)) bad.push("속성 값에 키워드가 있음");
  return result("KW3", label, bad);
}

/** KW4(P23-4) 첫 입력 상태, 서버 단계 길이, 입력칸 옆 남은 초를 확인한다. */
export function kw4ImmediateInput(m) {
  const label = "제시어가 뜨면 입력할 수 있고 35초 제한과 줄어드는 남은 시간을 표시한다";
  if (!m || typeof m.firstState !== "string" || !isNum(m.duration) || !isNum(m.firstSeconds) || !isNum(m.laterSeconds)) {
    return noMeasure("KW4", label, "입력 상태·제한 시간·남은 초");
  }
  const bad = [];
  if (m.firstState !== "open" || m.readOnly !== false) bad.push(`처음 입력 상태 ${m.firstState}`);
  if (m.duration !== KEYWORD_MS_COPY) bad.push(`서버 제한 시간 ${m.duration}ms`);
  if (m.firstSeconds <= 0 || m.firstSeconds > KEYWORD_MS_COPY / 1000) bad.push(`처음 남은 시간 ${m.firstSeconds}초`);
  if (m.laterSeconds <= 0 || m.laterSeconds >= m.firstSeconds) bad.push(`뒤에 남은 시간 ${m.laterSeconds}초`);
  return result("KW4", label, bad);
}

/** KW5(P23-5) 입력·제출. m = { inputLen(21자 입력 뒤 입력칸 자소 수), countText, afterSend: { state, readOnly, label } } */
export function kw5InputLimit(m) {
  const label = `${ANSWER_MAX_GRAPHEMES_COPY}자소에서 멈추고 'n/${ANSWER_MAX_GRAPHEMES_COPY}' 가 맞다 · 보내면 sent·읽기 전용·'단서 보냄'`;
  if (!m || !isNum(m.inputLen) || typeof m.countText !== "string" || !m.afterSend) return noMeasure("KW5", label, "입력 길이·글자 수·제출 뒤 상태");
  const bad = [];
  if (m.inputLen !== ANSWER_MAX_GRAPHEMES_COPY) bad.push(`입력칸 ${m.inputLen}자소(기대 ${ANSWER_MAX_GRAPHEMES_COPY})`);
  if (m.countText.trim() !== `${ANSWER_MAX_GRAPHEMES_COPY}/${ANSWER_MAX_GRAPHEMES_COPY}`) bad.push(`글자 수 '${m.countText}'`);
  if (m.afterSend.state !== "sent") bad.push(`제출 뒤 상태 ${m.afterSend.state}`);
  if (m.afterSend.readOnly !== true) bad.push("제출 뒤 입력칸이 읽기 전용이 아님");
  if (m.afterSend.label !== "단서 보냄") bad.push(`접수 상태 '${m.afterSend.label}'`);
  return result("KW5", label, bad);
}

/** KW6(P23-6) 제시어를 아는 사람의 금지 단서 수정 경로. */
export function kw6Correction(m) {
  const label = "제시어가 들어간 단서는 수정 안내와 입력을 유지하고 다른 표현으로 바꾸면 전송할 수 있다";
  if (!m) return noMeasure("KW6", label, "수정 전후 입력 상태");
  const bad = [];
  if (m.text !== KEYWORD_BLOCKED_COPY) bad.push(`안내 문구 '${m.text}'`);
  if (m.valueKept !== true || m.state !== "open") bad.push("입력칸에서 단서를 수정할 수 없음");
  if (m.blocked !== true || m.sentWhileBlocked !== false) bad.push("금지 단서 전송이 차단되지 않음");
  if (m.canSendAfterEdit !== true || m.noticeCleared !== true) bad.push("다른 표현으로 바꾼 뒤 전송 가능 상태로 돌아오지 않음");
  return result("KW6", label, bad);
}

/**
 * KW7(P23-7) 키보드 열림 컴팩트 카드 기하. 카드가 머리와 겹치지 않고 메타·입력줄이 카드에 들어온다.
 * 보내기 44 이상, 시간 막대·남은 초·글자 수도 보인다.
 */
export function kw7CompactGeometry(m) {
  const label = "키보드 열림: 머리 아래 컴팩트 카드 안에 입력줄·글자 수·보내기가 들어가고 모두 보임";
  const parts = m && isNum(m.vw) && isNum(m.vh) && ["header", "card", "meta", "form", "input", "send", "gauge", "count", "seconds"].every((k) => rectOk(m[k]));
  if (!parts) return noMeasure("KW7", label, "머리·카드·메타·입력줄·보내기·시간 막대·글자 수·남은 초 사각형");
  const bad = [];
  if (m.compact !== true) bad.push("카드가 컴팩트형(data-compact)이 아님");
  const named = [["머리", m.header], ["카드", m.card], ["메타 줄", m.meta], ["입력줄", m.form]];
  if (m.card.top < m.header.bottom - OVERLAP_EPS) bad.push("머리와 카드가 겹침");
  if (overlaps(m.meta, m.form)) bad.push("메타 줄과 입력줄이 겹침");
  for (const [n, r] of named.slice(2)) if (r.top < m.card.top - OVERLAP_EPS || r.bottom > m.card.bottom + OVERLAP_EPS || r.left < m.card.left - OVERLAP_EPS || r.right > m.card.right + OVERLAP_EPS) bad.push(`${n}이 카드 밖에 있음`);
  for (const [n, r] of [...named, ["보내기", m.send]]) if (r.top < -OVERLAP_EPS || r.bottom > m.vh + OVERLAP_EPS || r.left < -OVERLAP_EPS || r.right > m.vw + OVERLAP_EPS) bad.push(`${n} 가 보이는 영역(${fmt(m.vw)}x${fmt(m.vh)}) 밖 ${fmt(r.left)},${fmt(r.top)}~${fmt(r.right)},${fmt(r.bottom)}`);
  for (const [n, r] of [["시간 막대", m.gauge], ["n/20", m.count], ["남은 초", m.seconds]]) if (r.width <= 0 || r.height <= 0) bad.push(`${n} 가 안 보임`);
  if (overlaps(m.seconds, m.count) || overlaps(m.seconds, m.form) || !overlaps(m.seconds, m.meta)) bad.push("남은 초가 글자 수·입력줄과 겹치거나 메타 줄을 벗어남");
  // 공용 헤더의 좌우 패딩(14px, 10px) 차이 때문에 실제 가운데에서 2px 옆에 놓인다.
  if (Math.abs((m.gauge.left + m.gauge.right - m.header.left - m.header.right) / 2) > 2 + OVERLAP_EPS) bad.push("시간 막대가 머리 가운데에 있지 않음");
  if (m.send.width + OVERLAP_EPS < TAP_MIN || m.send.height + OVERLAP_EPS < TAP_MIN) bad.push(`[보내기] ${fmt(m.send.width)}x${fmt(m.send.height)} < ${TAP_MIN}`);
  if (m.send.left < m.input.left - OVERLAP_EPS || Math.abs(m.send.right - m.input.right) > OVERLAP_EPS ||
    m.send.top < m.input.top - OVERLAP_EPS || m.send.bottom > m.input.bottom + OVERLAP_EPS) bad.push("[보내기]가 입력칸 오른쪽 안에 없음");
  return result("KW7", label, bad);
}

/** 첫 제출자 이후의 물리 의자 순서, 차례 하나의 표시, 토론 복귀를 확인한다. */
export function kw8AnswerTurns(pages, expectedOrder) {
  const label = "모두가 같은 시계방향으로 답을 한 줄씩 보고 첫 토론으로 이어진다";
  if (!pages?.length || !expectedOrder?.length) return noMeasure("KW8", label, "페이지·의자 순서");
  const bad = [];
  for (const p of pages) {
    if (p.turns.length !== expectedOrder.length) bad.push(`${p.who} 차례 수 ${p.turns.length}`);
    p.turns.forEach((turn, i) => {
      if (turn.order !== i + 1 || turn.total !== expectedOrder.length || turn.seat !== expectedOrder[i]) bad.push(`${p.who} ${i + 1}번째 차례의 좌석 ${turn.seat}`);
      if (!turn.cardMatches) bad.push(`${p.who} ${i + 1}번째 화면에 한 답만 표시되지 않음`);
      if (!turn.onlyCurrent) bad.push(`${p.who} ${i + 1}번째 수신 상태에 다른 답이나 제시어가 있음`);
      if (!turn.focused) bad.push(`${p.who} ${i + 1}번째 화면이 발표자를 바라보지 않음`);
    });
    if (p.clueCount !== 0 || p.dialogOpen !== false || !p.inputVisible || !p.logVisible) bad.push(`${p.who} 발표 뒤 토론 조작이 막힘`);
  }
  if (pages.some(p => p.turns.some((turn, i) => turn.text !== pages[0].turns[i]?.text))) bad.push("시민과 마피아가 본 답안이 다름");
  return result("KW8", label, bad);
}

export function kw9Reconnect(m) {
  const label = "발표가 끝난 답안은 재접속과 역할 카드에서 다시 열리지 않는다";
  if (!m) return noMeasure("KW9", label, "재접속 화면");
  const bad = [];
  if (m.autoOpened !== false) bad.push("재접속 뒤 답안 발표가 다시 열림");
  if (m.recordRows !== 0) bad.push("역할 카드에 첫날 답안이 남음");
  return result("KW9", label, bad);
}

export function kw10Reveal(m) {
  const label = "첫날 제시어는 정답 공개 동안 같고 밤에 이어지지 않는다";
  if (!m?.answer || !m.pages?.length || !m.hidden?.length) return noMeasure("KW10", label, "정답·큰 글·밤 화면");
  const bad = [];
  for (const p of m.pages) {
    if (p.label !== "제시어") bad.push(`${p.who} 제목 '${p.label}'`);
    if (p.text !== m.answer) bad.push(`${p.who} 본문 '${p.text}' ≠ 키워드`);
    if (p.titlePx !== 20 || p.textPx !== 16) bad.push(`${p.who} 제목 ${p.titlePx}px, 본문 ${p.textPx}px`);
  }
  for (const p of m.hidden) {
    if (!p.hidden) bad.push(`${p.who} 밤에 첫날 답이나 제시어가 남음`);
  }
  return result("KW10", label, bad);
}

export function kw11FirstDayEnd(m) {
  const label = "첫날 종료는 바로 결과로 넘어가고 제시어는 결과에 넣지 않는다";
  if (!m?.phases?.length) return noMeasure("KW11", label, "단계 열과 결과");
  const bad = [];
  if (m.phases.includes("answerReveal")) bad.push("answerReveal 단계가 끼어 있음");
  if (m.phases.at(-1) !== "ended") bad.push("마지막 단계가 결과가 아님");
  if (m.keywordPresent !== false || (m.hostLine ?? "").startsWith("제시어")) bad.push("결과에 첫날 제시어가 남음");
  return result("KW11", label, bad);
}

const EARLY_STAGES = ["keyword", "verdict", "night"];
/**
 * KW12(P23-12) 조기 진행. items = [{ stage, advanceMs(마지막 행동 → 다음 단계), early(data-early 가 보임), tone?(키워드의 막대 색), extendedMs?(유예 안 번복이 마감을 늘린 양, 찬반), parity?(밤 두 페이지 프레임·표식 같음, 밤) }].
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
    if ((it.stage === "keyword" || it.tone !== undefined) && it.tone !== "calm") bad.push(`${it.stage} 색 ${it.tone ?? "측정값 없음"}(calm 이어야 함)`);
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
 * 30ms 마다 첫 입력 상태와 조기 진행 표식을 기록한다. 키워드·역할 값은 기록하지 않는다.
 */
export function installKeywordWatch() {
  const st = { firstState: null, earlyAt: null, tones: [] };
  window.__kwWatch = st;
  setInterval(() => {
    const now = Date.now();
    const header = document.querySelector("[data-phase-header][data-early]");
    if ((header || document.querySelector("[data-host-band][data-early]")) && st.earlyAt === null) st.earlyAt = now;
    const root = document.querySelector("[data-answer-state]");
    if (!root || root.closest("[hidden]")) return;
    st.firstState ??= root.getAttribute("data-answer-state");
    if (header) {
      const tone = header.querySelector("[data-phase-gauge]")?.getAttribute("data-tone");
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

/** 입력줄 한 장: 입력칸 자소 수·글자 수 글·상태·읽기 전용·서버 접수 상태 */
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
      label: root?.querySelector("[data-answer-done]")?.textContent ?? null,
      seconds: Number(/^(\d+)초$/.exec(root?.querySelector("[data-answer-seconds]")?.textContent?.trim() ?? "")?.[1]),
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
      input: rectOf(q("[data-answer-input]")),
      send: rectOf(q("[data-answer-send]")),
      check: rectOf(q("[data-answer-check]")),
      gauge: rectOf(q("[data-phase-gauge]")),
      count: rectOf(q("[data-answer-count]")),
      seconds: rectOf(q("[data-answer-seconds]")),
    };
  });

const readDiscussionTools = (page) =>
  page.evaluate(() => {
    const input = document.querySelector("[data-chat-input]");
    const box = input?.getBoundingClientRect();
    const log = document.querySelector("[data-chat-log]");
    const logBox = log?.getBoundingClientRect();
    return {
      clueCount: document.querySelectorAll('[data-answer-presentation], [data-answer-list]').length,
      dialogOpen: !!document.querySelector("dialog.mf-dialog--open"),
      inputVisible: !!box && document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2) === input && !input.disabled,
      logVisible: !!logBox && logBox.height > 0 && log.contains(document.elementFromPoint(logBox.left + logBox.width / 2, logBox.top + logBox.height / 2)),
    };
  });

/** 공개 제시어의 제목과 본문 */
const readAnnounce = (page) =>
  page.evaluate(() => {
    const label = document.querySelector("[data-announce-label]");
    const text = document.querySelector("[data-announce] .mf-announce__text");
    return {
      label: label?.textContent ?? null,
      text: text?.textContent ?? null,
      titlePx: label ? parseFloat(getComputedStyle(label).fontSize) : null,
      textPx: text ? parseFloat(getComputedStyle(text).fontSize) : null,
    };
  });

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

/** 마피아가 직접 입력한 단서의 본인 응답을 제외하고 제시어 누설을 검사한다. */
function withoutOwnAnswer(text, answer) {
  try {
    const frame = JSON.parse(text);
    if (frame.t !== "state" || frame.view?.me?.answer?.text !== answer) return text;
    delete frame.view.me.answer.text;
    return JSON.stringify(frame);
  } catch {
    return text;
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

  async function readCorrection(page, tracker, word) {
    await waitOpen(page);
    const input = page.locator("[data-answer-input]");
    const send = page.locator("[data-answer-send]");
    const notice = page.locator("[data-answer-notice]");
    await input.fill(word);
    await notice.filter({ hasText: KEYWORD_BLOCKED_COPY }).waitFor({ timeout: 3000 });
    await tracker.waitFor((view) => view.me.answer?.text === word && view.me.answer.keywordBlocked === true, 3000, "금지 단서의 작성자 안내");
    const text = await notice.textContent();
    const blocked = await send.isDisabled();
    await input.press("Enter");
    const line = await readAnswerLine(page);
    const sentWhileBlocked = tracker.last()?.me.answer?.final === true;
    await input.fill(KW_WORD);
    await notice.filter({ hasText: KEYWORD_BLOCKED_COPY }).waitFor({ state: "hidden", timeout: 3000 });
    return {
      text,
      blocked,
      sentWhileBlocked,
      state: line.state,
      valueKept: line.value === word,
      canSendAfterEdit: await send.isEnabled(),
      noticeCleared: (await notice.textContent()) === "",
    };
  }

  const waitOpen = (page, ms = 8000) => page.waitForSelector('[data-answer-state="open"]', { timeout: ms });

  async function readPresentation(page, turn, speaker, ownSeat) {
    await page.waitForFunction(({ nickname, text }) =>
      document.querySelector("[data-answer-speaker]")?.textContent.includes(nickname) &&
      document.querySelector("[data-answer-content]")?.textContent === text,
    { nickname: speaker, text: turn.text ?? "미제출" }, { timeout: 2700 });
    const focused = await attempt(async () => {
      await page.waitForFunction(({ target, ownSeat }) => {
        if (window.__mfCamera?.projection !== "eye") return false;
        if (target === ownSeat) return true;
        const at = window.__mfWorld?.sample(target);
        const screen = at && window.__mfWorld?.screenOf(at.x, at.z);
        return screen && Math.abs(screen.sx - window.innerWidth / 2) < window.innerWidth * 0.12;
      }, { target: turn.seat, ownSeat }, { timeout: 2000 });
    });
    return page.evaluate(focused => ({
      cardMatches: document.querySelectorAll("[data-answer-presentation]").length === 1 &&
        document.querySelectorAll("[data-answer-content]").length === 1 && !document.querySelector("[data-answer-list]"),
      focused,
    }), focused.ok);
  }

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
      // KW2·KW4: 참가자(시민 편) 카드와 즉시 입력
      const card = await readCard(gp);
      const word = (card.word ?? "").trim();
      rec1(rec, `${id}/citizen`, kw2CitizenCard(card));
      const opening = await readAnswerLine(gp);
      const duration = g.tracker.last().phaseDurationMs;
      await gp.waitForFunction((seconds) => {
        const current = Number.parseInt(document.querySelector("[data-answer-seconds]")?.textContent, 10);
        return current < seconds;
      }, opening.seconds, { timeout: 3000 });
      const w = await readWatch(gp);
      rec1(rec, `${id}/citizen`, kw4ImmediateInput({
        firstState: w?.firstState ?? opening.state,
        readOnly: opening.readOnly,
        duration,
        firstSeconds: opening.seconds,
        laterSeconds: (await readAnswerLine(gp)).seconds,
      }));

      // KW13: 방장(마피아)·참가자(시민 편) 페이지를 다시 연결해 그 연결의 모든 프레임에 키워드가 있는지 본다(정답 공개 전까지, 시민 쪽은 키워드를 받는 대조군)
      const keyBefore = { mafia: keysOf(ht.last()), citizen: keysOf(g.tracker.last()) };
      const mafiaWs = watchSockets(hp, { needles: [word], projectReceivedText: (text) => withoutOwnAnswer(text, word) });
      const citizenWs = watchSockets(gp, { needles: [word] });
      await Promise.all([hp, gp].map((p) => p.reload({ waitUntil: "domcontentloaded" })));
      await Promise.all([hp, gp].map((p) => p.waitForSelector("[data-keyword-card]", { timeout: 8000 })));

      // KW3: 방장(마피아) 카드 ??? 와 DOM 원문·속성에 키워드 없음
      const mcard = await readCard(hp);
      const dom = await readDomText(hp);
      rec1(rec, `${id}/mafia`, kw3MafiaCard({ word: mcard.word ?? "", genre: mcard.genre ?? "", html: dom.html, attrs: dom.attrs, answer: word }));

      const blank = await readGeometry(gp);

      // KW6: 시민 편은 그 판 제시어를 쓰면 안내를 읽고 단서를 고칠 수 있다.
      rec1(rec, `${id}/reject`, kw6Correction(await readCorrection(gp, g.tracker, word)));

      // KW5: 21자 입력 → 20 에서 멈춤, n/20 → 키보드로 보내면 접수 표시·읽기 전용
      const answerInput = gp.locator("[data-answer-input]");
      await answerInput.fill(KW_LONG);
      await sleep(100);
      const longLine = await readAnswerLine(gp);
      await answerInput.fill(KW_WORD);
      const withText = await readGeometry(gp);
      await at("KW5 키보드 전송", () => answerInput.press("Enter"));
      await gp.waitForSelector("[data-answer-check]", { timeout: 4000 });
      const sent = await readAnswerLine(gp);
      const confirmed = await readGeometry(gp);
      rec1(rec, `${id}/input`, kw5InputLimit({ inputLen: longLine.inputLen, countText: longLine.countText, afterSend: { state: sent.state, readOnly: sent.readOnly, label: sent.label } }));
      const stays = (before, after) => before && after && ["left", "top", "width", "height"].every((key) => Math.abs(before[key] - after[key]) <= OVERLAP_EPS);
      rec(`${id}/input`, "KW5b", "빈 입력칸에는 아이콘이 없고 입력칸 위치를 그대로 두며 전송과 체크가 같은 자리에 뜬다",
        blank.send === null && blank.check === null && confirmed.send === null &&
          stays(blank.input, withText.input) && stays(withText.input, confirmed.input) && stays(withText.send, confirmed.check),
        JSON.stringify({ blank: blank.input, withText: withText.input, confirmed: confirmed.input, send: withText.send, check: confirmed.check }));

      // 마피아의 같은 입력은 접수하되 제시어와의 일치 여부를 보내지 않는다.
      await at("마피아 단서 보내기", () => typeAndSend(hp, word));
      const accepted = await ht.waitFor(v => v.phase === "keyword" && v.me.answer?.final === true, 4000, "마피아 단서 접수");
      await hp.waitForSelector("[data-answer-done]", { state: "attached", timeout: 4000 });
      rec(`${id}/reject`, "KW6b", "마피아의 단서는 평소처럼 접수되고 제시어 포함 여부를 알리지 않는다",
        accepted.me.answer.text === word && !("keywordBlocked" in accepted.me.answer) &&
        (await hp.locator("[data-answer-notice]").textContent()) === "");

      const first = await ht.waitFor(v => v.day?.keyword?.presentation?.order === 1, 10_000, "첫 답 발표");
      const total = first.players.length;
      const speaker = first.day.keyword.presentation.seat;
      const clockwise = await hp.evaluate(seats => seats.map(seat => ({ seat, at: window.__mfWorld?.sample(seat) }))
        .filter(p => p.at).sort((a, b) => Math.atan2(a.at.z, a.at.x) - Math.atan2(b.at.z, b.at.x)).map(p => p.seat), first.players.map(p => p.seat));
      const start = clockwise.indexOf(speaker);
      if (start < 0 || clockwise.length !== total) throw new Error("발표의 원탁 좌석을 읽을 수 없음");
      const expectedOrder = [...clockwise.slice(start), ...clockwise.slice(0, start)];
      const turns = pages.map(() => []);
      let markedSeat;
      let markedBy;
      let suspectCopyMatches = false;

      for (let order = 1; order <= total; order++) {
        const views = await Promise.all(pages.map(p => p.tracker.waitFor(v => v.day?.keyword?.presentation?.order === order, 7000, `답 발표 ${order}`)));
        const current = views[0].day.keyword.presentation;
        const samples = await Promise.all(pages.map(async (p, i) => {
          const turn = views[i].day.keyword.presentation;
          await waitForPhaseStart(p.page, views[i]);
          return readPresentation(p.page, turn, views[i].players.find(row => row.seat === turn.seat)?.nickname, views[i].me.seat);
        }));
        for (let i = 0; i < pages.length; i++) {
          const keyword = views[i].day.keyword;
          turns[i].push({ ...keyword.presentation, ...samples[i], onlyCurrent: keyword.answers === undefined && keyword.answersUntil === undefined && keyword.answer === undefined });
        }
        if (order !== 1) continue;
        const observer = pages.find(p => p.tracker.last().me.seat !== current.seat);
        if (!observer) throw new Error("발표자가 아닌 테스트 화면 없음");
        const suspectButton = observer.page.locator("[data-answer-suspect]");
        const readyCopy = await suspectButton.textContent({ timeout: 1200 });
        await suspectButton.click({ timeout: 1200 });
        await Promise.all(pages.map(p => p.tracker.waitFor(v => v.day?.suspects?.some(note => note.to === current.seat), 2500, "현재 발표자 의심 표시")));
        const markedCopy = await observer.page.locator('[data-answer-suspect][aria-pressed="true"]').textContent({ timeout: 1200 }).catch(() => null);
        suspectCopyMatches = readyCopy?.trim() === "의심!" && markedCopy?.trim() === "의심 해제";
        markedSeat = current.seat;
        markedBy = observer;
      }

      await Promise.all(pages.map(p => p.tracker.waitFor(v => v.phase === "discussion", 7500, "발표 → 첫 토론")));
      const presentations = await Promise.all(pages.map(async (p, i) => {
        await waitForPhaseStart(p.page, p.tracker.last());
        await untilGame(p.page, v => v.phase === "discussion", 5000, "첫 토론 UI");
        return { who: p.who, turns: turns[i], ...await readDiscussionTools(p.page) };
      }));
      rec1(rec, `${id}/answers`, kw8AnswerTurns(presentations, expectedOrder));
      rec(`${id}/answers`, "KW6c", "제시어가 들어간 마피아 단서는 발표에서 모두에게 미제출로 보인다",
        turns.every(rows => rows.some(turn => turn.seat === accepted.me.seat && turn.text === null)));
      rec(`${id}/answers`, "KW8b", "발표 중 [의심!]을 누르면 [의심 해제]가 보이고 표시가 첫 토론에 남는다", suspectCopyMatches && markedSeat !== undefined &&
        pages.every(p => p.tracker.last().day?.suspects?.some(note => note.to === markedSeat)));

      const other = pages.find(p => p !== markedBy);
      const sharedTarget = first.players.find(p => p.seat !== markedSeat && pages.every(x => x.tracker.last().me.seat !== p.seat))?.seat;
      if (!markedBy || !other || sharedTarget === undefined) throw new Error("첫 토론 고깔 조작을 검사할 대상이 없음");
      const chooseHat = async (actor, target, acceptedTarget) => {
        await openTableDockPane(actor.page, "tools");
        await actor.page.locator("[data-suspect-btn]").click({ timeout: 4000 });
        await actor.page.getByRole("region", { name: "딱지 붙이기" }).waitFor({ timeout: 3000 });
        await (await showPeopleTarget(actor.page, `[data-table-seat="${target}"][data-suspect-tag]`)).click({ timeout: 3000 });
        await actor.tracker.waitFor(v => v.me.suspectTo === acceptedTarget, 3000, "내 고깔 변경");
      };
      await chooseHat(markedBy, sharedTarget, sharedTarget);
      await chooseHat(other, sharedTarget, sharedTarget);
      await Promise.all(pages.map(p => p.page.waitForFunction(
        seat => window.__mfWorld?.suspectNotes()[seat]?.visible === 2,
        sharedTarget, { timeout: 4000 },
      )));
      await sleep(650);
      await chooseHat(markedBy, sharedTarget, undefined);
      await Promise.all(pages.map(p => p.page.waitForFunction(
        seat => window.__mfWorld?.suspectNotes()[seat]?.visible === 1,
        sharedTarget, { timeout: 4000 },
      )));
      await sleep(650);
      await chooseHat(markedBy, markedSeat, markedSeat);
      rec(`${id}/discussion`, "KW8c", "첫 토론에서 같은 사람의 고깔은 포개지고 내 고깔만 떼었다가 다시 붙일 수 있다",
        markedBy.tracker.last().me.suspectTo === markedSeat && other.tracker.last().me.suspectTo === sharedTarget);

      // 시민이 확인 직후 다시 들어와도 같은 판의 답안은 뜨지 않는다.
      await gp.reload({ waitUntil: "domcontentloaded" });
      await untilGame(gp, (x) => x.phase === "discussion", 10_000, "재접속 뒤 토론");
      const beforeOpen = await readDiscussionTools(gp);
      await at("KW9 내 역할과 기록", () => openRoleCard(gp));
      const records = await gp.locator('dialog[aria-label="역할 카드"]').evaluate((sheet) => ({
        recordRows: sheet.querySelectorAll("[data-answer-row]").length,
      }));
      rec1(rec, `${id}/reconnect`, kw9Reconnect({
        autoOpened: beforeOpen.clueCount !== 0 || beforeOpen.dialogOpen,
        ...records,
      }));
      await closeOpenSheet(gp);

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
      const hidden = await Promise.all(pages.map(async (p) => {
        await untilGame(p.page, (v) => v.phase === "night", 6000, "밤 화면");
        return { who: p.who, hidden: p.tracker.last().day?.keyword === undefined &&
          await p.page.locator("[data-answer-list], [data-answer-correct]").count() === 0 &&
          await p.page.locator("[data-announce-label]").filter({ hasText: "제시어" }).count() === 0 };
      }));
      rec1(rec, `${id}/reveal`, kw10Reveal({ pages: reveal, answer: word, hidden }));

      // KW1: 둘째 날까지 단계 열
      await skipTo(hp, ht, "dayAnnounce");
      rec1(rec, `${id}/phases`, kw1PhaseColumns({ seq: ht.phases.slice(), endedDayOne: false }));
      await gameGH(ctx, id, "day2", game.host);
    } finally {
      await closeGame(game);
    }

    // KW11: 첫날 처형으로 끝난 판은 제시어 공개 없이 결과로 간다.
    {
      const sc = `${id}/end`;
      const game2 = await openGame(ctx, id, { ...GAME4, role: "mafia", vote: { exec: "yes", pick: "host" }, to: "keyword", hostNick: GAME_HOST_NICK });
      try {
        const { hp, ht, guests } = game2;
        const gp = guests[0].page;
        await gp.waitForSelector("[data-keyword-word]", { timeout: 6000 });
        await skipTo(hp, ht, "discussion");
        await untilGame(gp, (v) => v.phase === "discussion", 6000, "첫날 토론");
        await skipDayToExecution(hp, ht, [gp]);
        await skipTo(hp, ht, "ended");
        await gp.waitForSelector("[data-result-stage]", { timeout: 8000 });
        const line = await gp.locator("[data-host-line]").textContent();
        const from = Math.max(0, ht.phases.indexOf("execution"));
        rec1(rec, sc, kw11FirstDayEnd({ phases: ht.phases.slice(from), hostLine: line, keywordPresent: ht.last().day?.keyword !== undefined }));
        rec1(rec, sc, kw1PhaseColumns({ seq: ht.phases.slice(), endedDayOne: true }), " (첫날 끝)");
      } finally {
        await closeGame(game2);
      }
    }
  }

  // ---- keyword-sizes: 폰 6종 — 단서 수정(KW6)과 키보드 열림 컴팩트 카드 기하(KW7, P23-6·7) ----
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
      const correction = await readCorrection(g.page, g.tracker, word);
      recLines(rec, `${id}/reject`, [kw6Correction(correction)], ` (${ctx.size.label})`);
      // 키보드 열림: 입력칸 포커스 + 가짜 키보드(visualViewport 높이 − K)
      for (const p of pages) {
        await p.page.locator("[data-answer-input]").fill(KW_WORD);
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

      // 키워드: 참가자 둘이 모두 내면 1.5초 안에 첫 발표가 열린다.
      await Promise.all(pages.map((p) => waitOpen(p.page)));
      await typeAndSend(g.page, KW_WORD);
      await typeAndSend(hp, "다른말");
      const tLast = performance.now();
      const left = await phaseLeftAt(ht, "keyword", 6000);
      await sleep(100);
      const wk = await readWatch(hp);
      items.push({ stage: "keyword", advanceMs: left === null ? undefined : left - tLast, early: wk?.earlyAt != null, tone: wk?.tones?.length ? (wk.tones.every((t) => t === "calm") ? "calm" : wk.tones.find((t) => t !== "calm")) : undefined });
      const first = ht.last();
      const announcementMs = (first.day?.keyword?.presentation?.total ?? 1) * (first.phaseDurationMs ?? 0);
      rec(`${id}/keyword`, "KW12k", "참가자 둘이 제출하면 첫 발표로 넘어간다", first.day?.keyword?.presentation?.order === 1, `단계 ${first.phase}`);

      // 찬반: 봇 표가 다 들어온 뒤 사람 둘이 던지면 1.5초 안에 넘어가고, 유예 안 번복은 마감을 다시 늘린다
      const discussion = await ht.waitFor((v) => v.phase === "discussion", announcementMs + 6000, "발표 뒤 토론");
      await waitForPhaseStart(hp, discussion);
      await sleep(900);
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
      await waitForPhaseStart(hp, ht.last());
      await Promise.all(pages.map((p) => untilGame(p.page, (x) => x.phase === "night", 6000, "밤 도착")));
      const seatOf = (t) => t.last().me.seat;
      const aliveOthers = (t) => t.last().players.filter((p) => p.seat !== seatOf(t) && p.alive !== false).map((p) => p.seat);
      for (const p of pages) {
        const target = aliveOthers(p.tracker)[0];
        await (await showPeopleTarget(p.page, `[data-face="${target}"], [data-pick="${target}"]`)).click({ timeout: 4000 });
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
