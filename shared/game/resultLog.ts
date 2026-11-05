// 결과 공개(resultLog) 프레임 만들기(결정 D-9·D-10, 미결 O-14): 판 중 숨겨 둔 기록을 ended 에서 모두에게 같게 연다.
// 순수 모듈이다: 시각·난수를 읽지 않고 입력을 바꾸지 않으며 DOM·workerd API 가 없다(앱·워커 두 tsconfig 에 모두 들어간다).
// 마스크 없이 전체를 담는다 — 마피아·유령 채팅은 채널 전체 보관 줄, 귓속말·주장은 채팅 보관 상한 밖 원본(whispers·badgeLog), 찬반은 ballots 카드를 푼 것이다.
import type {
  ResultLogBallotsLine,
  ResultLogChatLine,
  ResultLogClaimLine,
  ResultLogFrame,
  ResultLogWhisperLine,
} from "../protocol";
import { parseBallotsCardText } from "./ballots";
import type { ChatLog } from "./chatLog";
import type { RoomState } from "./room";

/** 한 프레임의 최대 줄 수(O-14). 채팅 100자소 × 40줄이 한 프레임 20KB 안쪽이다. */
export const RESULT_LOG_CHUNK = 40;

/** 필요한 만큼만 읽는다 — 방 전체가 아니라 이 두 키다. */
export type ResultLogInput = {
  players: ReadonlyArray<{ seat: number; badgeLog?: ReadonlyArray<{ n: number; v: ResultLogClaimLine["v"] }> }>;
  whispers?: RoomState["whispers"];
};

/** 줄 배열을 40줄씩 나눈다. 비어 있어도 { i:0, end:true, lines:[] } 한 덩이는 낸다(화면이 '아무도 말하지 않았다'는 사실도 쓴다). */
function chunked<L>(lines: readonly L[]): Array<{ i: number; end: boolean; lines: L[] }> {
  if (lines.length === 0) return [{ i: 0, end: true, lines: [] }];
  const total = Math.ceil(lines.length / RESULT_LOG_CHUNK);
  return Array.from({ length: total }, (_, i) => ({ i, end: i === total - 1, lines: lines.slice(i * RESULT_LOG_CHUNK, (i + 1) * RESULT_LOG_CHUNK) }));
}

/** 다섯 부분을 mafia → ghost → whisper → claim → ballots 순으로 프레임 열로 만든다. */
export function buildResultLog(state: ResultLogInput, chatLog: ChatLog): ResultLogFrame[] {
  const talk = (ch: "mafia" | "ghost"): ResultLogChatLine[] =>
    chatLog.records.filter((r) => r.ch === ch && r.k === undefined).map((r) => ({ seat: r.seat, n: r.n, text: r.text, at: r.at }));
  const whispers: ResultLogWhisperLine[] = (state.whispers ?? []).map((w) => ({ seat: w.from, to: w.to, n: w.n, text: w.text, at: w.at }));
  // 일차 오름차순 → 좌석 오름차순 → 원래 순서(Array.sort 는 안정 정렬이다).
  const claims: ResultLogClaimLine[] = state.players
    .flatMap((p) => (p.badgeLog ?? []).map((b) => ({ seat: p.seat, n: b.n, v: b.v })))
    .sort((a, b) => a.n - b.n || a.seat - b.seat);
  const ballots: ResultLogBallotsLine[] = [];
  for (const r of chatLog.records) {
    if (r.k !== "ballots") continue;
    const parsed = parseBallotsCardText(r.text);
    if (parsed !== null) ballots.push({ n: r.n, yes: parsed.yes, no: parsed.no });
  }
  const frames: ResultLogFrame[] = [];
  for (const part of ["mafia", "ghost"] as const) for (const c of chunked(talk(part))) frames.push({ t: "resultLog", part, i: c.i, end: c.end, lines: c.lines });
  for (const c of chunked(whispers)) frames.push({ t: "resultLog", part: "whisper", i: c.i, end: c.end, lines: c.lines });
  for (const c of chunked(claims)) frames.push({ t: "resultLog", part: "claim", i: c.i, end: c.end, lines: c.lines });
  for (const c of chunked(ballots)) frames.push({ t: "resultLog", part: "ballots", i: c.i, end: c.end, lines: c.lines });
  return frames;
}
