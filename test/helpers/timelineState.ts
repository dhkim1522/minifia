// 기록 타임라인(11-11) 시험 도우미: 끝난 판의 공개 값(result·voteLog)과 resultLog 부분(claim·ballots·whisper)을 손으로 짠다. 테스트에서만 import 한다.
// 6명: 0·1 마피아, 2 경찰, 3 의사, 4·5 시민. 3일 이야기:
//  1일차 낮 4 처형(찬성 4·반대 1) · 밤 마피아 2 지목, 의사가 지킴
//  2일차 낮 처형 없음(2 후보, 부결) · 밤 3 사망
//  3일차 낮 0 처형(마지막 결전: 찬반 0·0), 밤 없음
import type { GameResult, ResultLogBallotsLine, ResultLogClaimLine, ResultLogWhisperLine, VoteLogEntry } from "../../shared/protocol";
import type { TimelineLog, TimelineViewInput } from "../../src/game/timelineView";

export const TL_ROLES = ["mafia", "mafia", "police", "doctor", "citizen", "citizen"] as const;

export const TL_VOTE_LOG: VoteLogEntry[] = [
  {
    n: 1,
    exec: { yes: 4, no: 1, passed: true },
    cand: {
      votes: [
        { seat: 2, target: 4 },
        { seat: 3, target: 4 },
        { seat: 0, target: 4 },
        { seat: 5, target: 4 },
        { seat: 1, target: 2 },
        { seat: 4, target: 2 },
      ],
      candidate: 4,
    },
  },
  {
    n: 2,
    exec: { yes: 1, no: 3, passed: false },
    cand: {
      votes: [
        { seat: 0, target: 2 },
        { seat: 1, target: 2 },
        { seat: 5, target: 2 },
        { seat: 2, target: 0 },
        { seat: 3, target: 0 },
      ],
      candidate: 2,
    },
  },
  {
    n: 3,
    exec: { yes: 0, no: 0, passed: false },
    cand: {
      votes: [
        { seat: 2, target: 0 },
        { seat: 5, target: 0 },
        { seat: 0, target: 2 },
      ],
      candidate: 0,
    },
  },
];

export const TL_RESULT: GameResult = {
  winner: "citizenWin",
  seats: TL_ROLES.map((job, seat) => ({ seat, job })),
  summary: [
    { n: 1, exec: { yes: 4, no: 1, passed: true, candidate: 4 }, night: { target: 2, died: false } },
    { n: 2, exec: { yes: 1, no: 3, passed: false, candidate: 2 }, night: { target: 3, died: true } },
    { n: 3, exec: { yes: 0, no: 0, passed: false, candidate: 0 } },
  ],
};

export const tlView = (over: Partial<TimelineViewInput> = {}): TimelineViewInput => ({ result: TL_RESULT, day: { voteLog: TL_VOTE_LOG }, ...over });

const part = <L,>(lines: L[]) => ({ lines, complete: true });

export const TL_CLAIMS: ResultLogClaimLine[] = [
  { seat: 0, n: 1, v: "citizen" },
  { seat: 2, n: 1, v: "police" },
  { seat: 4, n: 1, v: "police" },
  { seat: 5, n: 1, v: "none" },
  { seat: 0, n: 2, v: "police" },
  { seat: 3, n: 2, v: "doctor" },
];
export const TL_BALLOTS: ResultLogBallotsLine[] = [
  { n: 1, yes: [2, 3, 0, 5], no: [1] },
  { n: 2, yes: [1], no: [0, 5, 2] },
];
export const TL_WHISPERS: ResultLogWhisperLine[] = [
  { seat: 2, to: 3, n: 1, text: "비밀 하나", at: 1 },
  { seat: 0, to: 1, n: 1, text: "비밀 둘", at: 2 },
  { seat: 1, to: 0, n: 2, text: "비밀 셋", at: 3 },
];

export const tlLog = (over: Partial<TimelineLog> = {}): TimelineLog => ({
  claim: part(TL_CLAIMS),
  ballots: part(TL_BALLOTS),
  whisper: part(TL_WHISPERS),
  ...over,
});

export const TL_NAMES = new Map<number, string>([
  [0, "지우"],
  [1, "하윤"],
  [2, "민지"],
  [3, "도현"],
  [4, "서연"],
  [5, "수빈"],
]);
