import { env, exports } from "cloudflare:workers";
import { runDurableObjectAlarm, runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { RoomView, ServerMessage } from "../../shared/protocol";
import { alarmOf, closed, connect, forceDue, hello, nextFrame, seat, send, storedRoom } from "./helpers";
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

  it("roleReveal 마감 뒤 알람은 모두를 day 로 넘기고 phaseEndsAt 이 null 이며 다음 알람은 방 만료 시각이다", async () => {
    const r = await startedRoom();
    await forceDue(r.code, "phaseEndsAt");
    await runDurableObjectAlarm(env.ROOM.getByName(r.code));
    await viewsOf(r, "roleReveal");
    // 첫 알람 뒤 마감은 다시 미래라, 두 번째 전이 앞에도 forceDue 가 필요하다.
    await forceDue(r.code, "phaseEndsAt");
    expect(await runDurableObjectAlarm(env.ROOM.getByName(r.code))).toBe(true);

    const views = await viewsOf(r, "day");
    expect(views.every((v) => v.phaseEndsAt === null)).toBe(true);
    const room = await storedRoom(r.code);
    expect(room.phase).toBe("day");
    const expiresAt = await runInDurableObject(env.ROOM.getByName(r.code), async (_i, state) => {
      return (await state.storage.get<{ expiresAt: number }>("room"))!.expiresAt;
    });
    expect(await alarmOf(r.code)).toBe(expiresAt);
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
