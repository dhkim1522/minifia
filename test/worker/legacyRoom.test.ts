// 22 WR-04: 옛 표시가 있어 대기실로 되돌려진 방은 옛 판의 채팅 저장분(chat: 키)과 월드의 lay·home 도 함께 버린다.
// handleRematch·handleTestReset 과 같은 정리다. 표시가 없는 방(지금 판 중인 새 방)은 건드리지 않는다(T-22-04).
import { env } from "cloudflare:workers";
import { evictDurableObject, runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { chatKeysOf, chatSend, connect, helloForLog, mark, seat, settle, storedRoom, worldOf } from "./helpers";
import type { Seated } from "./helpers";

/** 손님 한 명이 대기실에서 한 줄을 보낸 방. 월드에는 옛 자리 기억(lay·home)을 심는다. 옛 표시는 extra 로 더한다. */
async function roomWithOldTraces(extra: Record<string, unknown>): Promise<Seated> {
  const s = await seat(1, 0);
  const guest = s.guests[0]!;
  const mg = mark(guest.sock);
  chatSend(guest.sock, "옛 판 대화");
  await settle(guest.sock, mg);
  expect(await chatKeysOf(s.code)).toHaveLength(1);

  const stub = env.ROOM.getByName(s.code);
  await runInDurableObject(stub, async (_i, state) => {
    const room = (await state.storage.get<Record<string, unknown>>("room"))!;
    const ids = (room.players as Array<{ id: string }>).map((p) => p.id);
    const world = (await state.storage.get<Record<string, unknown>>("world")) ?? { v: 1, segs: {} };
    const slots: Record<string, [number, number]> = {};
    const pos: Record<string, [number, number]> = {};
    for (const id of ids) {
      slots[id] = [1, 1];
      pos[id] = [1, 1];
    }
    await state.storage.put("world", { ...world, lay: { key: "1:ring", slots }, home: { day: 1, pos } });
    await state.storage.put("room", { ...room, ...extra });
  });
  await evictDurableObject(stub);
  return s;
}

describe("옛 방 → 대기실 정규화의 잔재 정리 (22 WR-04)", () => {
  it("옛 표시(mode 키)가 있는 방은 깨어날 때 chat: 키와 월드의 lay·home 이 지워지고 hello 의 chatLog 가 비어 있다", async () => {
    const s = await roomWithOldTraces({ mode: "extended" });
    const guest = s.guests[0]!;
    const sock = await connect(s.code);
    const lines = await helloForLog(sock, guest.token);

    expect(lines).toHaveLength(0);
    expect(await chatKeysOf(s.code)).toEqual([]);
    expect("mode" in ((await storedRoom(s.code)) as unknown as Record<string, unknown>)).toBe(false);
    const world = (await worldOf(s.code)) as (Record<string, unknown> & { v: number }) | undefined;
    expect(world).toBeDefined();
    expect(world!.lay).toBeUndefined();
    expect(world!.home).toBeUndefined();
  });

  it("옛 표시가 없는 방은 같은 저장 상태라도 채팅 저장분을 그대로 되살린다", async () => {
    const s = await roomWithOldTraces({});
    const guest = s.guests[0]!;
    const sock = await connect(s.code);
    const lines = await helloForLog(sock, guest.token);

    expect(lines.map((l) => l.text)).toEqual(["옛 판 대화"]);
    expect(await chatKeysOf(s.code)).toHaveLength(1);
  });
});
