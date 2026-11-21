// 일찍 넘어가기 순수 규칙(23페이즈, 결정 0089-26·D-11·D-12·D-25). 현재 시각을 스스로 읽지 않고(now 는 인자) 입력 상태를 바꾸지 않는다.
//
// 키워드·투표·밤의 개인 행동이 모두 끝나면 마감을 "지금 + 1.5초" 로 줄인다(원래 마감을 넘지 않는다).
//  - 키워드: 산 사람 중 사람 전원이 확정 제출(봇은 대상 아님 — 봇은 답을 내지 않는다).
//  - 찬반: 산 사람 전원이 투표. 번복이 들어오면 다시 지금 + 1.5초(상한은 원래 마감, D-25).
//  - 밤: 능력 사용과 실험방 시민의 밤 마치기를 센다. 처음 한 번만 줄이고 연장하지 않는다 — 연장 방송은 밤 행동에 대해 새 신호가 된다(D-25).
//  - 결선·결전의 동시 투표: 선택권이 있는 생존자 전원의 표를 센다.
// 연결이 끊긴 사람은 고르지 않으므로 조건이 참이 되지 않아 그 판은 정해진 시간을 다 쓴다(D-12, 연결 여부는 보지 않는다).
// 역할 확인(전원 확인), 유언([남기기]), 단계 건너뛰기(전원 동의)는 별도의 메시지에서 정상 마감 경로로 진행한다.
//
// 종료 시각 = 마지막 산 사람이 행동한 시각 + 1.5초라 역할과 무관하다(D-13). 단계 길이(phaseDurationOf)는 건드리지 않아 화면 막대가 0~1 로 미끄러진다.
// 원래 마감은 earlyFrom(서버 전용)에 보관한다 — 줄이고 나면 값을 잃어 번복 연장의 상한을 알 수 없기 때문이다. 단계나 차례가 바뀌면 지운다.
// 봇 계획 키("단계:마감")도 새 마감으로 같이 갈아 끼운다 — 마감이 바뀌었다는 이유로 syncBotPlan 이 계획을 다시 세우지(난수를 쓰고 봇이 다시 던지지) 않게 한다(Pitfall 5).
import { isAlive } from "./alive";
import { botPlanKey, isBot } from "./bots";
import { firstPlaytestDay } from "./playtest";
import type { RoomState } from "./room";
import { runoffVotersOf } from "./runoff";

/** 전원이 끝낸 뒤 남기는 시간(0089-26 문언 1.5초). 유예 안 번복·변경을 받아 주는 여유이자 화면이 "곧 넘어감" 을 보여 주는 시간이다. */
export const EARLY_GRACE_MS = 1_500;

/** 지금 단계의 "개인 행동"이 산 사람 전원 끝났는가. 연결 여부는 보지 않는다 — 끊긴 사람은 고르지 않으니 자연히 거짓이다(D-12). */
export function earlyReady(state: RoomState): boolean {
  const alive = state.players.filter((p) => isAlive(p) && (state.playtest !== true || p.left !== true));
  switch (state.phase) {
    case "keyword": {
      const humans = alive.filter((p) => !isBot(p));
      if (humans.length === 0) return false;
      const submits = state.answerSubmits ?? [];
      return humans.every((p) => submits.some((s) => s.seat === p.seat));
    }
    case "verdict":
      if (firstPlaytestDay(state)) {
        return state.firstBallotOutcome === undefined && alive.length > 0 && alive.every((p) => p.firstBallot !== undefined);
      }
      return alive.length > 0 && alive.every((p) => p.verdictVote !== undefined);
    case "runoff": {
      if (state.runoff?.step !== 1) return false;
      const voters = runoffVotersOf(state);
      return voters.length > 0 && voters.every((p) => p.runoffVote !== undefined);
    }
    case "showdown": {
      const turn = state.showdown;
      if (turn?.i !== 3) return false;
      const voters = alive.filter((p) => turn.order.includes(p.seat));
      return voters.length > 0 && voters.every((p) => p.showdownPick !== undefined);
    }
    case "night":
      if (state.playtest === true) {
        return alive.length > 0 && alive.every((p) => p.role === "citizen"
          ? p.nightDone === true || isBot(p)
          : p.nightPick !== undefined);
      }
      return alive.length > 0 && alive.every((p) => p.nightPick !== undefined);
    default:
      return false;
  }
}

/**
 * 준비됐으면 마감을 min(원래 마감, now + EARLY_GRACE_MS) 으로 줄인 새 상태, 아니면 입력 그대로(같은 객체).
 * extend: false(밤·키워드) — 같은 단계·같은 날에 이미 줄였으면 더 건드리지 않는다. extend: true(찬반) — 번복마다 원래 마감 이내에서 다시 정한다(늘어날 수 있다).
 */
export function shrinkDeadline(state: RoomState, now: number, opts: { extend: boolean }): RoomState {
  if (state.phaseEndsAt === null || !earlyReady(state)) return state;
  const key = { phase: state.phase, day: state.day ?? 0 };
  const from = state.earlyFrom !== undefined && state.earlyFrom.phase === key.phase && state.earlyFrom.day === key.day ? state.earlyFrom : undefined;
  if (from !== undefined && !opts.extend) return state;
  const origin = from?.endsAt ?? state.phaseEndsAt;
  const target = Math.min(origin, now + EARLY_GRACE_MS);
  if (target === state.phaseEndsAt) return state;
  const next: RoomState = { ...state, phaseEndsAt: target, earlyFrom: { ...key, endsAt: origin } };
  return next.botPlan === undefined ? next : { ...next, botPlan: { ...next.botPlan, key: botPlanKey(next) ?? next.botPlan.key } };
}
