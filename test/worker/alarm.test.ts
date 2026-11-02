import { env, exports } from "cloudflare:workers";
import { runDurableObjectAlarm, runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { RoomView, ServerMessage } from "../../shared/protocol";
import { DISCUSSION_MS, NOMINATION_MS } from "../../shared/game/phases";
import { ROOM_TTL_MS, UNCONNECTED_ROOM_TTL_MS } from "../../shared/game/room";
import { alarmOf, closed, connect, createRoom, editRoom, forceDue, hello, nextFrame, seat, send, storedRoom } from "./helpers";
import type { Seated } from "./helpers";

const phaseIs = (phase: string) => (m: ServerMessage) => m.t === "state" && m.view.phase === phase;

function allSockets(r: Seated) {
  return [r.host, ...r.guests.map((g) => g.sock)];
}

async function viewsOf(r: Seated, phase: string): Promise<RoomView[]> {
  const views: RoomView[] = [];
  for (const s of allSockets(r)) {
    const m = await nextFrame(s, phaseIs(phase));
    if (m.t === "state") views.push(m.view);
  }
  return views;
}

async function startedRoom(): Promise<Seated> {
  const r = await seat(3, 0);
  send(r.host, { t: "start" });
  await viewsOf(r, "assigning");
  return r;
}

describe("알람", () => {
  it("assigning 마감 뒤 알람은 모두를 roleReveal 로 넘기고 각자 자기 역할을 받으며 마감은 이전 마감 + 15000 이다", async () => {
    const r = await startedRoom();
    await forceDue(r.code, "phaseEndsAt");
    const forced = (await storedRoom(r.code)).phaseEndsAt!;
    expect(await runDurableObjectAlarm(env.ROOM.getByName(r.code))).toBe(true);

    const views = await viewsOf(r, "roleReveal");
    expect(views.every((v) => typeof v.me.role === "string")).toBe(true);
    expect(views.every((v) => v.phaseEndsAt === forced + 15000)).toBe(true);
    expect(views.every((v) => v.phaseDurationMs === 15000)).toBe(true);
  });

  it("roleReveal 마감 뒤 알람은 모두를 dayAnnounce 로 넘기고 마감은 이전 마감 + 2000, 다음 알람은 그 마감이다", async () => {
    const r = await startedRoom();
    await forceDue(r.code, "phaseEndsAt");
    await runDurableObjectAlarm(env.ROOM.getByName(r.code));
    await viewsOf(r, "roleReveal");
    // 첫 알람 뒤 마감은 다시 미래라, 두 번째 전이 앞에도 forceDue 가 필요하다.
    await forceDue(r.code, "phaseEndsAt");
    const forced = (await storedRoom(r.code)).phaseEndsAt!;
    expect(await runDurableObjectAlarm(env.ROOM.getByName(r.code))).toBe(true);

    const views = await viewsOf(r, "dayAnnounce");
    expect(views.every((v) => v.phaseEndsAt === forced + 2000)).toBe(true);
    expect(views.every((v) => v.phaseDurationMs === 2000)).toBe(true);
    const room = await storedRoom(r.code);
    expect(room.phase).toBe("dayAnnounce");
    expect(room.phaseEndsAt).toBe(forced + 2000);
    expect(await alarmOf(r.code)).toBe(forced + 2000);
  });

  it("낮 한 바퀴와 밤·아침(dayAnnounce → discussion → nomination → night → morning → dayAnnounce)을 알람이 차례로 넘기고 저장된 일차는 2 가 된다", async () => {
    const r = await startedRoom();
    const stub = env.ROOM.getByName(r.code);
    const advance = async (): Promise<number> => {
      await forceDue(r.code, "phaseEndsAt");
      const forced = (await storedRoom(r.code)).phaseEndsAt!;
      expect(await runDurableObjectAlarm(stub)).toBe(true);
      return forced;
    };
    await advance(); // assigning → roleReveal
    await viewsOf(r, "roleReveal");
    await advance(); // roleReveal → dayAnnounce
    await viewsOf(r, "dayAnnounce");
    expect((await storedRoom(r.code) as { day?: number }).day).toBe(1);

    const steps: Array<[string, number]> = [
      // 07-08: 순차 주장 단계가 없다 — 낮 시작 발표 마감 다음이 바로 토론이다
      ["discussion", DISCUSSION_MS],
      ["nomination", NOMINATION_MS], // 지목이 0표이므로 다음은 night
      ["night", 30_000],
      ["morning", 5_000],
      ["dayAnnounce", 2_000],
    ];
    for (const [phase, ms] of steps) {
      const forced = await advance();
      const views = await viewsOf(r, phase);
      expect(views.every((v) => v.phaseEndsAt === forced + ms)).toBe(true);
      expect(views.every((v) => v.phaseDurationMs === ms)).toBe(true);
      expect(await alarmOf(r.code)).toBe(forced + ms);
    }
    expect((await storedRoom(r.code) as { day?: number }).day).toBe(2);
  });

  it("방 만료 알람은 모든 소켓을 4003 'room_closed' 로 닫고 미리보기가 404 다", async () => {
    const r = await startedRoom();
    await forceDue(r.code, "expiresAt");
    expect(await runDurableObjectAlarm(env.ROOM.getByName(r.code))).toBe(true);

    for (const s of allSockets(r)) expect(await closed(s)).toBe("4003 room_closed");
    const res = await exports.default.fetch(`http://x/api/rooms/${r.code}`);
    expect(res.status).toBe(404);
  });

  it("roleReveal 도중 미연결이던 사람이 돌아오면 다른 사람과 같은 phaseEndsAt 과 자기 me.role 을 받는다", async () => {
    const r = await seat(3, 1);
    send(r.host, { t: "start" });
    await viewsOf(r, "assigning");
    await forceDue(r.code, "phaseEndsAt");
    await runDurableObjectAlarm(env.ROOM.getByName(r.code));
    const hostView = (await viewsOf(r, "roleReveal"))[0]!;

    const late = await connect(r.code);
    const back = await hello(late, r.offline[0]!.token);
    expect(back.view.phase).toBe("roleReveal");
    expect(back.view.phaseEndsAt).toBe(hostView.phaseEndsAt);
    expect(typeof back.view.me.role).toBe("string");
  });

  it("알람 처리 중 예외가 나면 1초 뒤 알람을 다시 걸고, 다음 알람은 정상 처리한다", async () => {
    const r = await startedRoom();
    await forceDue(r.code, "phaseEndsAt");
    const stub = env.ROOM.getByName(r.code);
    // 한 번만 실패하도록 reschedule 을 바꿔 끼운다.
    await runInDurableObject(stub, async (instance) => {
      const target = instance as unknown as { reschedule: () => Promise<void> };
      const original = target.reschedule.bind(target);
      let failed = false;
      target.reschedule = async () => {
        if (!failed) {
          failed = true;
          throw new Error("boom");
        }
        await original();
      };
    });
    const before = Date.now();
    expect(await runDurableObjectAlarm(stub)).toBe(true);
    const retryAt = await alarmOf(r.code);
    expect(retryAt).not.toBeNull();
    expect(retryAt!).toBeGreaterThanOrEqual(before + 900);
    expect(retryAt!).toBeLessThanOrEqual(Date.now() + 1100);

    // 단계 전이는 이미 반영되어 있고, 재시도 알람이 알람 시각을 단계 마감으로 되돌린다.
    expect(await runDurableObjectAlarm(stub)).toBe(true);
    expect((await storedRoom(r.code)).phase).toBe("roleReveal");
    const room = await storedRoom(r.code);
    expect(await alarmOf(r.code)).toBe(room.phaseEndsAt);
  });
});

describe("연결자가 없던 방의 짧은 수명 (WR-05)", () => {
  it("만들기만 하고 아무도 hello 하지 않은 방은 짧게 만료되고, 알람이 그 시각에 걸리며, 만료 알람이 방을 지운다", async () => {
    const { code } = await createRoom("방장");
    const room = await storedRoom(code);
    expect(room.expiresAt - room.createdAt).toBe(UNCONNECTED_ROOM_TTL_MS);
    expect(await alarmOf(code)).toBe(room.expiresAt);

    await forceDue(code, "expiresAt");
    expect(await runDurableObjectAlarm(env.ROOM.getByName(code))).toBe(true);
    const res = await exports.default.fetch(`http://x/api/rooms/${code}`);
    expect(res.status).toBe(404);
  });

  it("첫 hello 가 오면 만료가 생성 시각 + 3시간으로 늘고 알람도 그 시각으로 옮겨 간다", async () => {
    const { code, token } = await createRoom("방장");
    const sock = await connect(code);
    await hello(sock, token);
    const room = await storedRoom(code);
    expect(room.expiresAt - room.createdAt).toBe(ROOM_TTL_MS);
    expect(await alarmOf(code)).toBe(room.expiresAt);
  });
});

describe("만료됐지만 아직 정리되지 않은 방 코드로 만들기 (WR-06)", () => {
  it("알람이 울리기 전에 같은 코드로 만들면 옛 방의 소켓을 4003 room_closed 로 닫고 새 방을 만든다", async () => {
    const r = await seat(1, 0);
    await forceDue(r.code, "expiresAt"); // 알람은 아직 돌리지 않는다: 만료됐지만 정리 전
    const stub = env.ROOM.getByName(r.code);

    const created = await stub.createRoom({ code: r.code, nickname: "새방장", now: Date.now() });
    expect(created.ok).toBe(true);
    expect(await closed(r.host)).toBe("4003 room_closed");
    expect(await closed(r.guests[0]!.sock)).toBe("4003 room_closed");
    const room = await storedRoom(r.code);
    expect(room.players.length).toBe(1);
  });

  it("만료 전이면 여전히 CODE_TAKEN 이고 옛 소켓은 그대로다", async () => {
    const r = await seat(1, 0);
    const stub = env.ROOM.getByName(r.code);
    const result = await stub.createRoom({ code: r.code, nickname: "새방장", now: Date.now() });
    expect(result).toEqual({ ok: false, error: "CODE_TAKEN" });
    expect(await closed(r.host, 200)).toBe("0 not_closed");
  });
});

describe("claim 단계로 저장된 방 (07-08, CHAT-06)", () => {
  it("07-08 claim 으로 저장된 방은 깨어날 때 discussion 으로 열리고 claim 키가 지워지며 알람이 새 마감으로 옮겨진다", async () => {
    const r = await startedRoom();
    const before = Date.now();
    await editRoom(r.code, (room) => ({
      ...room,
      phase: "claim",
      phaseEndsAt: before + 5_000,
      day: 1,
      claimOrder: [0, 1, 2, 3],
      claimIdx: 1,
      claimStart: 0,
      claimPick: "police",
      claimLog: [{ n: 1, seat: 0, claim: "police" }],
    }));

    const sock = await connect(r.code);
    const first = await hello(sock, r.hostToken);
    expect(`${first.view.phase}:${first.view.day?.n}`).toBe("discussion:1");
    expect(JSON.stringify(first.view).includes("claimLog")).toBe(false);
    expect(Object.keys(first.view.day ?? {}).includes("turn")).toBe(false);
    const stored = await storedRoom(r.code);
    expect(stored.phase).toBe("discussion");
    expect(stored.phaseEndsAt! - before >= DISCUSSION_MS).toBe(true);
    for (const key of ["claimOrder", "claimIdx", "claimStart", "claimPick", "claimLog"]) {
      expect(`${key}:${Object.hasOwn(stored, key)}`).toBe(`${key}:false`);
    }
    expect(await alarmOf(r.code)).toBe(stored.phaseEndsAt);
  });
});
