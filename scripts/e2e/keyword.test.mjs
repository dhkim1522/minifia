// scripts/e2e/keyword.mjs 의 순수 판정 단위 시험(23-12): KW1~KW13 = UI-SPEC P23-1~13.
// 각 판정은 맞는 측정에서 통과하고, 하나씩 어긋난 측정에서 그 ID 만 실패하며, 값이 없으면 "측정값 없음" 으로 실패한다.
import assert from "node:assert/strict";
import test from "node:test";
import {
  EARLY_GRACE_MS_COPY,
  KEYWORD_NOTE_COPY,
  KEYWORD_READ_MS_COPY,
  KEYWORD_REJECT_COPY,
  kw1PhaseColumns,
  kw2CitizenCard,
  kw3MafiaCard,
  kw4ReadLock,
  kw5InputLimit,
  kw6Reject,
  kw7CompactGeometry,
  kw8AnswerTurns,
  kw9Reconnect,
  kw10Reveal,
  kw11FirstDayEnd,
  kw12Early,
  kw13Leak,
} from "./keyword.mjs";

const rect = (left, top, width, height) => ({ left, top, width, height, right: left + width, bottom: top + height });
const noMeasure = (r) => !r.ok && /측정값 없음/.test(r.detail);

test("사본 상수: 읽기 3초·조기 진행 유예 1.5초", () => {
  assert.equal(KEYWORD_READ_MS_COPY, 3000);
  assert.equal(EARLY_GRACE_MS_COPY, 1500);
});

// ---- KW1 ----
const DAY1 = ["lobby", "assigning", "roleReveal", "keyword", "dayAnnounce", "discussion", "verdict", "nomination", "defense", "execution", "answerReveal", "night", "morning", "dayAnnounce", "discussion", "verdict"];
test("KW1: 첫날 역할 확인 → 키워드 → 낮 시작 … 처형 → 정답 공개 → 밤, 둘째 날 키워드·정답 공개 없음이면 통과", () => {
  const r = kw1PhaseColumns({ seq: DAY1, endedDayOne: false });
  assert.equal(r.id, "KW1");
  assert.equal(r.ok, true);
  assert.deepEqual(Object.keys(r).sort(), ["detail", "id", "label", "ok"]);
});
test("KW1: 키워드가 없거나 순서가 어긋나거나 둘째 날에 다시 나오면 실패", () => {
  assert.equal(kw1PhaseColumns({ seq: DAY1.filter((p) => p !== "keyword"), endedDayOne: false }).ok, false);
  assert.equal(kw1PhaseColumns({ seq: DAY1.filter((p) => p !== "answerReveal"), endedDayOne: false }).ok, false);
  assert.equal(kw1PhaseColumns({ seq: [...DAY1, "keyword"], endedDayOne: false }).ok, false);
  assert.equal(kw1PhaseColumns({ seq: [...DAY1, "answerReveal"], endedDayOne: false }).ok, false);
  assert.equal(kw1PhaseColumns({ seq: ["lobby", "roleReveal", "dayAnnounce", "keyword", "discussion", "night"], endedDayOne: false }).ok, false);
});
test("KW1: 첫날 처형으로 끝난 판은 정답 공개 없이 ended 면 통과, 정답 공개가 끼면 실패", () => {
  const ended = ["lobby", "roleReveal", "keyword", "dayAnnounce", "discussion", "verdict", "nomination", "defense", "execution", "ended"];
  assert.equal(kw1PhaseColumns({ seq: ended, endedDayOne: true }).ok, true);
  assert.equal(kw1PhaseColumns({ seq: [...ended.slice(0, -1), "answerReveal", "ended"], endedDayOne: true }).ok, false);
});
test("KW1: 열이 없으면 측정값 없음", () => assert.ok(noMeasure(kw1PhaseColumns({ seq: [], endedDayOne: false }))));

// ---- KW2·KW3 ----
test("KW2: 주제 줄·키워드·각주가 맞으면 통과, 하나씩 어긋나면 실패", () => {
  const ok = { genre: "주제 · 영화", word: "기생충", note: KEYWORD_NOTE_COPY };
  assert.equal(kw2CitizenCard(ok).ok, true);
  assert.equal(kw2CitizenCard({ ...ok, genre: "영화" }).ok, false);
  assert.equal(kw2CitizenCard({ ...ok, word: "???" }).ok, false);
  assert.equal(kw2CitizenCard({ ...ok, word: "" }).ok, false);
  assert.equal(kw2CitizenCard({ ...ok, note: "다른 글" }).ok, false);
  assert.ok(noMeasure(kw2CitizenCard(null)));
});
test("KW3: 마피아 카드는 ??? 이고 DOM 원문·속성 어디에도 정답이 없어야 통과", () => {
  const ok = { word: "???", genre: "주제 · 영화", html: "<main>주제 · 영화 ???</main>", attrs: "data-keyword-card class", answer: "기생충" };
  assert.equal(kw3MafiaCard(ok).ok, true);
  assert.equal(kw3MafiaCard({ ...ok, word: "기생충" }).ok, false);
  assert.equal(kw3MafiaCard({ ...ok, html: "<p>기생충</p>" }).ok, false);
  assert.equal(kw3MafiaCard({ ...ok, attrs: "aria-label=기생충" }).ok, false);
  assert.ok(noMeasure(kw3MafiaCard({ ...ok, answer: "" })));
});

// ---- KW4·KW5 ----
test("KW4: 처음 locked, 3초(±) 뒤 open, 입력칸 data-call 이면 통과", () => {
  const ok = { firstState: "locked", firstAtMs: 600, openAtMs: 3050, callAtMs: 3100 };
  assert.equal(kw4ReadLock(ok).ok, true);
  assert.equal(kw4ReadLock({ ...ok, firstState: "open" }).ok, false);
  assert.equal(kw4ReadLock({ ...ok, openAtMs: 1200 }).ok, false);
  assert.equal(kw4ReadLock({ ...ok, openAtMs: 5200 }).ok, false);
  assert.equal(kw4ReadLock({ ...ok, callAtMs: null }).ok, false);
  assert.ok(noMeasure(kw4ReadLock({ ...ok, openAtMs: null })));
});
test("KW5: 20자소에서 멈추고 20/20, 보내면 sent·읽기 전용·단서 보냄이면 통과", () => {
  const ok = { inputLen: 20, countText: "20/20", afterSend: { state: "sent", readOnly: true, label: "단서 보냄" } };
  assert.equal(kw5InputLimit(ok).ok, true);
  assert.equal(kw5InputLimit({ ...ok, inputLen: 21 }).ok, false);
  assert.equal(kw5InputLimit({ ...ok, countText: "21/20" }).ok, false);
  assert.equal(kw5InputLimit({ ...ok, afterSend: { ...ok.afterSend, readOnly: false } }).ok, false);
  assert.equal(kw5InputLimit({ ...ok, afterSend: { ...ok.afterSend, state: "open" } }).ok, false);
  assert.equal(kw5InputLimit({ ...ok, afterSend: { ...ok.afterSend, label: "단서 보내기" } }).ok, false);
  assert.ok(noMeasure(kw5InputLimit(null)));
});

// ---- KW6 ----
const rej = (who, over = {}) => ({ who, text: KEYWORD_REJECT_COPY, noticeMs: 2500, valueKept: true, stateAfter: "open", ...over });
test("KW6: 두 페이지가 같은 문구를 같은 시간(2.5초) 보고 글이 남고 다시 낼 수 있으면 통과", () => {
  assert.equal(kw6Reject([rej("시민"), rej("마피아", { noticeMs: 2620 })]).ok, true);
  assert.equal(kw6Reject([rej("시민"), rej("마피아", { text: "금지어예요" })]).ok, false);
  assert.equal(kw6Reject([rej("시민"), rej("마피아", { noticeMs: 4300 })]).ok, false);
  assert.equal(kw6Reject([rej("시민", { noticeMs: 1000 }), rej("마피아", { noticeMs: 1050 })]).ok, false);
  assert.equal(kw6Reject([rej("시민"), rej("마피아", { valueKept: false })]).ok, false);
  assert.equal(kw6Reject([rej("시민"), rej("마피아", { stateAfter: "sent" })]).ok, false);
  assert.ok(noMeasure(kw6Reject([rej("시민")])));
});

// ---- KW7 ----
const geo = (over = {}) => ({
  vw: 360,
  vh: 224,
  compact: true,
  header: rect(0, 0, 360, 48),
  card: rect(16, 56, 328, 160),
  meta: rect(28, 132, 304, 20),
  form: rect(28, 156, 304, 56),
  input: rect(28, 160, 304, 48),
  send: rect(284, 160, 48, 48),
  gauge: rect(140, 24, 80, 8),
  count: rect(289, 134, 40, 16),
  ...over,
});
test("KW7: 컴팩트 카드 한 장에 답을 쓸 수 있고 머리와 겹치지 않으면 통과", () => {
  assert.equal(kw7CompactGeometry(geo()).ok, true);
  assert.equal(kw7CompactGeometry(geo({ compact: false })).ok, false);
  assert.equal(kw7CompactGeometry(geo({ card: rect(24, 30, 312, 70) })).ok, false); // 머리와 겹침
  assert.equal(kw7CompactGeometry(geo({ card: rect(16, 56, 328, 145) })).ok, false); // 입력줄이 카드 밖
  assert.equal(kw7CompactGeometry(geo({ send: rect(292, 160, 40, 40) })).ok, false);
  assert.equal(kw7CompactGeometry(geo({ send: rect(332, 160, 48, 48) })).ok, false);
  assert.equal(kw7CompactGeometry(geo({ form: rect(12, 190, 336, 56) })).ok, false); // 보이는 높이 밖
  assert.equal(kw7CompactGeometry(geo({ gauge: rect(0, 0, 0, 0) })).ok, false);
  assert.equal(kw7CompactGeometry(geo({ gauge: rect(40, 24, 80, 8) })).ok, false);
  assert.ok(noMeasure(kw7CompactGeometry(geo({ card: null }))));
});

// ---- KW8·KW9 ----
const expectedOrder = [1, 3, 0, 2];
const turns = expectedOrder.map((seat, index) => ({
  order: index + 1, total: 4, seat, text: index === 1 ? null : "단서", cardMatches: true, onlyCurrent: true, focused: true,
}));
const pg = (who, over = {}) => ({
  who, clueCount: 0, dialogOpen: false, inputVisible: true, logVisible: true, turns, ...over,
});
test("KW8: 물리 좌석 순서, 한 줄 발표, 카메라와 토론 전환을 검사한다", () => {
  assert.equal(kw8AnswerTurns([pg("시민"), pg("마피아")], expectedOrder).ok, true);
  for (const over of [{ clueCount: 1 }, { dialogOpen: true }, { inputVisible: false }, { logVisible: false }, { turns: turns.slice(1) }]) {
    assert.equal(kw8AnswerTurns([pg("시민"), pg("마피아", over)], expectedOrder).ok, false);
  }
  for (const edit of [{ seat: 7 }, { cardMatches: false }, { onlyCurrent: false }, { focused: false }, { text: "다름" }]) {
    assert.equal(kw8AnswerTurns([pg("시민"), pg("마피아", { turns: turns.map((turn, i) => i === 1 ? { ...turn, ...edit } : turn) })], expectedOrder).ok, false);
  }
  assert.ok(noMeasure(kw8AnswerTurns([], expectedOrder)));
});
test("KW9: 새로고침과 역할 기록에 첫날 집계를 반복하지 않는다", () => {
  const ok = { autoOpened: false, recordRows: 0 };
  assert.equal(kw9Reconnect(ok).ok, true);
  assert.equal(kw9Reconnect({ ...ok, autoOpened: true }).ok, false);
  assert.equal(kw9Reconnect({ ...ok, recordRows: 1 }).ok, false);
  assert.ok(noMeasure(kw9Reconnect(null)));
});

test("KW10: 공개 제시어가 같고 제목보다 작으며 밤에 남지 않는다", () => {
  const announcement = { label: "제시어", text: "기생충", titlePx: 20, textPx: 16 };
  const ok = { pages: [{ who: "시민", ...announcement }, { who: "마피아", ...announcement }], answer: "기생충", hidden: [{ who: "시민", hidden: true }, { who: "마피아", hidden: true }] };
  assert.equal(kw10Reveal(ok).ok, true);
  assert.equal(kw10Reveal({ ...ok, pages: [ok.pages[0], { ...ok.pages[1], text: "???" }] }).ok, false);
  assert.equal(kw10Reveal({ ...ok, pages: [{ ...ok.pages[0], label: "" }, ok.pages[1]] }).ok, false);
  assert.equal(kw10Reveal({ ...ok, pages: [{ ...ok.pages[0], textPx: 36 }, ok.pages[1]] }).ok, false);
  assert.equal(kw10Reveal({ ...ok, hidden: [{ who: "시민", hidden: false }] }).ok, false);
  assert.ok(noMeasure(kw10Reveal({ ...ok, answer: "" })));
});
test("KW11: 정답 공개 없이 바로 결과로 가고 제시어가 보이지 않는다", () => {
  const ok = { phases: ["execution", "ended"], hostLine: "", keywordPresent: false };
  assert.equal(kw11FirstDayEnd(ok).ok, true);
  assert.equal(kw11FirstDayEnd({ ...ok, phases: ["execution", "answerReveal", "ended"] }).ok, false);
  assert.equal(kw11FirstDayEnd({ ...ok, phases: ["execution", "night"] }).ok, false);
  assert.equal(kw11FirstDayEnd({ ...ok, hostLine: "제시어 · 기생충" }).ok, false);
  assert.equal(kw11FirstDayEnd({ ...ok, keywordPresent: true }).ok, false);
  assert.ok(noMeasure(kw11FirstDayEnd({ phases: [] })));
});

// ---- KW12 ----
const early = [
  { stage: "keyword", advanceMs: 1550, early: true, tone: "calm" },
  { stage: "verdict", advanceMs: 1580, early: true, tone: "calm", extendedMs: 300 },
  { stage: "night", advanceMs: 1520, early: true, parity: true },
];
test("KW12: 키워드·찬반·밤 마감이 1.5초(±)로 줄고 data-early·calm 이며 번복이 늘리고 밤 표식이 같으면 통과", () => {
  assert.equal(kw12Early(early).ok, true);
  assert.equal(kw12Early([{ ...early[0], advanceMs: 5200 }, early[1], early[2]]).ok, false);
  assert.equal(kw12Early([{ ...early[0], early: false }, early[1], early[2]]).ok, false);
  assert.equal(kw12Early([{ ...early[0], tone: undefined }, early[1], early[2]]).ok, false);
  assert.equal(kw12Early([{ ...early[0], tone: "warn" }, early[1], early[2]]).ok, false);
  assert.equal(kw12Early([early[0], { ...early[1], extendedMs: 0 }, early[2]]).ok, false);
  assert.equal(kw12Early([early[0], early[1], { ...early[2], parity: false }]).ok, false);
  assert.ok(noMeasure(kw12Early([early[0]])));
});

// ---- KW13 ----
const keys = (me) => ({ top: ["code", "phase", "me", "day"], me, day: ["n", "keyword"] });
test("KW13: 마피아·시민 view 키가 me.keyword 외 같고 마피아 프레임에 정답이 없으면 통과", () => {
  const citizen = keys(["seat", "role", "keyword"]);
  const mafia = keys(["seat", "role"]);
  const ok = { mafia, citizen, mafiaFrameHits: 0, citizenFrameHits: 1, hostOnlyMe: [] };
  assert.equal(kw13Leak(ok).ok, true);
  assert.equal(kw13Leak({ ...ok, mafiaFrameHits: 1 }).ok, false);
  assert.equal(kw13Leak({ ...ok, citizenFrameHits: 0 }).ok, false); // 시민 쪽은 정답이 있어야 측정이 맞다
  assert.equal(kw13Leak({ ...ok, mafia: keys(["seat", "role", "keyword"]) }).ok, false); // 마피아가 me.keyword 를 받음
  assert.equal(kw13Leak({ ...ok, mafia: keys(["seat", "role", "allies"]) }).ok, false); // 다른 키 차이
  assert.equal(kw13Leak({ ...ok, mafia: { ...mafia, day: ["n"] } }).ok, false); // day 키 차이(장르 day.keyword 는 둘 다 있어야 한다)
  assert.equal(kw13Leak({ ...ok, mafia: { ...mafia, top: ["code"] } }).ok, false); // 최상위 키 차이
  assert.equal(kw13Leak({ ...ok, mafia: keys(["seat", "role", "testRole"]), hostOnlyMe: ["testRole"] }).ok, true); // 방장 전용 테스트 키는 허용
  assert.equal(kw13Leak({ ...ok, mafia: keys(["seat", "role", "allies"]), roleMe: ["allies"] }).ok, true); // 23페이즈 전부터 있던 역할 키는 허용
  assert.ok(noMeasure(kw13Leak({ ...ok, mafia: null })));
});
