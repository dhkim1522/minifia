// Nyquist 검증(3.1): 여러 날을 실제 전이(startGame, tick, pickTarget)로 돌리며 독립 모델과 대조한다.
// 개별 규칙 단위 테스트가 놓치기 쉬운 '낮이 거듭될 때의 누적' 을 본다: 낮 시작 발표 다음이 바로 토론인지·일지 누적·누출 키 부재.
import { describe, expect, it } from "vitest";
import { pickTarget } from "../../shared/game/night";
import { DISCUSSION_MS, ERRAND_MS, SHOWDOWN_GATHER_MS } from "../../shared/game/phases";
import { RULESET } from "../../shared/game/ruleset";
import { attachConnection, createRoomState, joinRoom, startGame } from "../../shared/game/room";
import type { Player, RoomState } from "../../shared/game/room";
import { tick } from "../../shared/game/tick";
import { buildView } from "../../shared/game/view";
import { seededRandInt } from "../helpers/seededRandom";

function lobbyOf(n: number): RoomState {
  const created = createRoomState({ code: "0420", hostId: "pid-0000-aaaa", hostToken: "tok-secret-0000-aaaa-0123456789", hostNickname: "이름0", now: 0 });
  if (!created.ok) throw new Error("create");
  let s = attachConnection(created.state, "pid-0000-aaaa", "c0");
  for (let i = 1; i < n; i += 1) {
    const id = `pid-000${i}-aaaa`;
    const j = joinRoom(s, { playerId: id, token: `tok-secret-000${i}-aaaa-0123456789`, nickname: `이름${i}` });
    if (!j.ok) throw new Error("join");
    s = attachConnection(j.state, id, `c${i}`);
  }
  return s;
}

const living = (s: RoomState): Player[] => s.players.filter((p) => p.alive !== false);

/** 밤 행동을 규칙대로 고른다: 마피아는 가장 낮은 seat 의 비마피아, 의사는 가장 높은 seat 생존자, 경찰은 가장 낮은 seat 의 다른 생존자. */
function actNight(s: RoomState): RoomState {
  let st = s;
  for (const p of living(s)) {
    const others = living(st).filter((q) => q.id !== p.id);
    let target: Player | undefined;
    if (p.role === "mafia") target = others.filter((q) => q.role !== "mafia").sort((a, b) => a.seat - b.seat)[0];
    else if (p.role === "doctor") target = living(st).sort((a, b) => b.seat - a.seat)[0];
    else if (p.role === "police") target = others.sort((a, b) => a.seat - b.seat)[0];
    if (!target) continue;
    const r = pickTarget(st, p.id, target.seat);
    if (!r.ok) throw new Error(`pick ${p.role}: ${r.error}`);
    st = r.state;
  }
  return st;
}

describe("여러 날 낮 흐름 + 일지 누적 (CHAT-06, NIGHT-04, ELIM-01)", () => {
  for (const n of [5, 6, 7, 8]) {
    for (const seed of [1, 2, 3]) {
      it(`${n}명 seed ${seed}: 날마다 낮 시작 발표 다음이 바로 토론(산 사람이 셋이면 마지막 3인 결전)이고 일지가 독립 모델과 같다`, () => {
        const rand = seededRandInt(seed);
        const lobby = lobbyOf(n);
        const started = startGame(lobby, lobby.hostId, 10_000, rand);
        if (!started.ok) throw new Error("start");
        let s = started.state;
        let days = 0;
        const dayRecords: Array<{ day: number; died: number | undefined }> = [];
        for (let guard = 0; guard < 400 && s.phase !== "ended" && days < 4; guard += 1) {
          if (s.phaseEndsAt === null) break;
          if (s.phase === "dayAnnounce") {
            days += 1;
            // 뷰에는 서버 전용 주장 키가 없고 day 에 turn 이 없다(07-08: 순차 주장 단계 제거)
            for (const p of s.players) {
              const v = JSON.stringify(buildView(s, p.id, s.phaseEndsAt! - 1));
              for (const k of ["claimPick", "claimOrder", "claimIdx", "claimStart", "turn"]) expect(v).not.toContain(`"${k}"`);
            }
            // 낮 시작 발표 마감 다음이 심부름(15페이즈, 마감 = 이전 마감 + ERRAND_MS)이고 그 마감 다음이 토론(+ DISCUSSION_MS)이다.
            // 단 산 사람이 정확히 셋이고 결전이 켜져 있으면 낮 시작 다음이 마지막 3인 결전(모이기 SHOWDOWN_GATHER_MS)이다(결정 0066-5).
            const last3 = RULESET.showdown && living(s).length === 3; // 기본판(결정 0072)은 산 셋도 토론이다
            const after = tick(s, s.phaseEndsAt!, rand);
            if (last3) {
              expect(after.phase).toBe("showdown");
              expect(after.phaseEndsAt).toBe(s.phaseEndsAt! + SHOWDOWN_GATHER_MS);
            } else {
              expect(after.phase).toBe("errand");
              expect(after.phaseEndsAt).toBe(s.phaseEndsAt! + ERRAND_MS);
              const talk = tick(after, after.phaseEndsAt!, rand);
              expect(talk.phase).toBe("discussion");
              expect(talk.phaseEndsAt).toBe(after.phaseEndsAt! + DISCUSSION_MS);
            }
            for (const k of ["claimPick", "claimOrder", "claimIdx", "claimStart", "claimLog"]) expect(Object.hasOwn(after, k)).toBe(false);
          }
          if (s.phase === "night") s = actNight(s);
          const before = s;
          s = tick(s, s.phaseEndsAt!, rand);
          if (before.phase === "night") {
            const died = before.players.find((p) => p.alive !== false && s.players.find((q) => q.id === p.id)?.alive === false);
            dayRecords.push({ day: before.day ?? 1, died: died?.seat });
          }
        }
        expect(days).toBeGreaterThanOrEqual(2);
        // 일지: 마피아의 암살일지는 그 밤 실제 사망과 일치(died=true ⇔ 그날 사망자 존재), 경찰은 매 밤 한 줄 이하
        const mafia = s.players.filter((p) => p.role === "mafia");
        for (const m of mafia) {
          for (const rec of m.assassinations ?? []) {
            const night = dayRecords.find((d) => d.day === rec.n);
            if (night) expect(rec.died).toBe(night.died === rec.target);
          }
        }
        // 마피아 팀원은 같은 일지를 가진다
        if (mafia.length > 1) {
          const sig = (m: Player) => JSON.stringify((m.assassinations ?? []).map((r) => [r.n, r.target, r.died]));
          // 밤에 살아 있던 팀원끼리만 비교 가능: 둘 다 끝까지 산 경우
          const alive = mafia.filter((m) => m.alive !== false);
          if (alive.length === mafia.length) expect(new Set(mafia.map(sig)).size).toBe(1);
        }
        // 시민에게는 어떤 일지 키도 view 에 없다
        for (const c of s.players.filter((p) => p.role === "citizen")) {
          expect("records" in buildView(s, c.id, s.phaseEndsAt ?? 0).me).toBe(false);
        }
      });
    }
  }
});
