// 유저 기록 카드의 행 만들기(04-27, VOTE-04, D-08). DOM·시각·난수를 읽지 않는 순수 함수다.
// 입력은 서버가 모두에게 같게 보낸 공개 기록(claimLog·voteLog)뿐이다 — 여부 투표는 익명이라 개인 줄이 타입에 없고(D-02),
// 후보 선택은 공개 구간 이후에 실린 줄만 있다(D-07). 이 파일은 직업 단어를 만들지 않는다: 주장 행은 claim 값만 돌려주고 문장화는 시트가 한다.
import type { Claim, ClaimLogEntry, VoteLogEntry } from "../../shared/protocol";

export type RecordRowKind = "claim" | "exec" | "cand";

export interface RecordRow {
  /** 목록 key — 행마다 겹치지 않는다 */
  key: string;
  /** 일차 */
  day: number;
  kind: RecordRowKind;
  /** kind === "claim": 그 줄의 주장 */
  claim?: Claim;
  /** kind === "exec": 날짜별 집계 한 문장 */
  text?: string;
  /** kind === "cand": 이 사람이 고른 대상의 닉네임 */
  target?: string;
}

export const UNKNOWN_TARGET = "알 수 없는 사람";

/** 처형 여부 집계 문장: 모든 사람에게 같고 개인 표시는 없다(D-02). 통과하지 못했으면 ` · 미통과` 가 붙는다 */
function execText(exec: VoteLogEntry["exec"]): string {
  return `처형 여부 찬성 ${exec.yes} · 반대 ${exec.no}${exec.passed ? "" : " · 미통과"}`;
}

/**
 * seat 한 사람의 기록 행. 일차 내림차순(최신이 위)이고 같은 일차는 주장(기록 역순) → 처형 여부 → 후보 선택 순이다.
 * 후보 선택 기록이 있는 일차에서 이 사람의 줄이 없으면 행을 만들지 않는다 — 탈락해서 못 던졌는지 표를 못 보냈는지 구별할 수 없다(P-16).
 */
export function recordRows(
  seat: number,
  claimLog: readonly ClaimLogEntry[],
  voteLog: readonly VoteLogEntry[],
  nicknameOf: (seat: number) => string | undefined,
): RecordRow[] {
  const days = new Set<number>();
  for (const e of claimLog) if (e.seat === seat) days.add(e.n);
  for (const v of voteLog) days.add(v.n);

  const rows: RecordRow[] = [];
  for (const day of [...days].sort((a, b) => b - a)) {
    // 같은 일차의 주장은 기록 역순(나중 줄이 위). filter 가 새 배열을 만들어 입력은 바뀌지 않는다
    const claims = claimLog.filter((e) => e.seat === seat && e.n === day).reverse();
    claims.forEach((e, i) => rows.push({ key: `claim-${day}-${i}`, day, kind: "claim", claim: e.claim }));
    const vote = voteLog.find((v) => v.n === day);
    if (vote === undefined) continue;
    rows.push({ key: `exec-${day}`, day, kind: "exec", text: execText(vote.exec) });
    const mine = vote.cand?.votes.find((l) => l.seat === seat);
    if (mine !== undefined) rows.push({ key: `cand-${day}`, day, kind: "cand", target: nicknameOf(mine.target) ?? UNKNOWN_TARGET });
  }
  return rows;
}
