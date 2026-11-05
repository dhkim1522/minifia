// 10-01: 동작 누설 검사 L27~L30 (UI-SPEC A-3, 결정 D-12·D-19, 위협 T-10-01·02·04·05).
// "오지 않았음" 은 settle(ping/pong)로 증명한다. 6명 판(마피아 둘·경찰·의사·시민 둘)을 실제로 시작해 돌린다.
// 동작 프레임은 이 파일 안에서 키 집합({t,seat,id,n})과 값(역할 단어가 아닌 id)을 단언한다 — leak.test.ts 의 허용 목록은 넓히지 않는다(L34).
import { describe, expect, it } from "vitest";
import {
  advanceTo,
  advanceToKeep,
  chatKeysOf,
  emoteSend,
  emotesOf,
  killSeats,
  mark,
  observe,
  pause,
  resetEmoteRates,
  seat,
  send,
  settle,
  snapshotStorage,
  startedGame,
  summary,
  withRole,
} from "./helpers";
import type { Actor } from "./helpers";

const ROLE_WORDS = /mafia|police|doctor|citizen|role/i;
/** 프레임 하나가 계약 모양({t,seat,id,n} 뿐, 값에 역할 단어 없음)인지 한 줄 문자열로 돌려준다. */
const shape = (e: ReturnType<typeof emotesOf>[number]): string => `${Object.keys(e).sort().join(",")}/${ROLE_WORDS.test(JSON.stringify(e)) ? "ROLE" : "ok"}`;
const CONTRACT = "id,n,seat,t/ok";

describe("동작 누설 검사 L27~L30 (D-12, D-19, O-7)", () => {
  it("(a) L27 밤: 마피아의 동작은 산 시민·경찰·의사 소켓에 0건이고 마피아 둘과 탈락자는 정확히 한 프레임씩 받는다", async () => {
    const g = await startedGame("night");
    const [mafiaA, mafiaB] = withRole(g, "mafia") as [Actor, Actor];
    const [citizenX] = withRole(g, "citizen") as [Actor, Actor];
    await killSeats(g, [citizenX.seat]);
    for (const s of g.socks) await settle(s, mark(s));
    const townIdx = g.actors.map((a, i) => ({ a, i })).filter((x) => x.a.role !== "mafia" && x.a !== citizenX).map((x) => x.i);
    expect(townIdx.length).toBe(3);

    const p = await observe(g, mafiaA, () => pause(300)); // 가만히 있는 구간
    const q = await observe(g, mafiaA, () => emoteSend(mafiaA.sock, "throat"));

    for (const i of townIdx) {
      expect(summary(p[i]!)).toBe("[]");
      expect(summary(q[i]!)).toBe("[]");
    }
    for (const a of [mafiaA, mafiaB, citizenX]) {
      const got = emotesOf(q[g.actors.indexOf(a)]!);
      expect(got.length).toBe(1);
      expect(shape(got[0]!)).toBe(CONTRACT);
      expect(got[0]!.seat).toBe(mafiaA.seat);
      expect(got[0]!.id).toBe("throat");
    }
  }, 30_000);

  it("(b) L27 낮: 탈락자의 동작은 탈락자만 받고 산 사람 소켓은 0프레임이다(보낸 탈락자 자신은 한 프레임)", async () => {
    const g = await startedGame("discussion");
    const [x, z] = withRole(g, "citizen") as [Actor, Actor];
    await killSeats(g, [x.seat, z.seat]);
    for (const s of g.socks) await settle(s, mark(s));
    await pause(1500); // 낮 시작 배치 걷기가 끝난 뒤(걷는 중 동작은 버려진다)

    const got = await observe(g, x, () => emoteSend(x.sock, "cry"));
    for (const a of g.actors) {
      const msgs = got[g.actors.indexOf(a)]!;
      if (a === x || a === z) {
        const e = emotesOf(msgs);
        expect(e.length).toBe(1);
        expect(shape(e[0]!)).toBe(CONTRACT);
        expect(e[0]!.seat).toBe(x.seat);
      } else {
        expect(summary(msgs)).toBe("[]");
      }
    }
  }, 30_000);

  it("(c) L29 단계 키: 밤 단계 키로 아침 뒤에 도착한 마피아 동작은 모든 소켓 0프레임(보낸 소켓 포함)이고 저장소에도 흔적이 없다", async () => {
    const g = await startedGame("night");
    const mafiaA = withRole(g, "mafia")[0]!;
    await advanceTo(g.code, g.socks, "morning");
    for (const s of g.socks) await settle(s, mark(s));
    const before = await snapshotStorage(g.code);

    const got = await observe(g, mafiaA, () => emoteSend(mafiaA.sock, "throat", "1:1:night"));
    for (const msgs of got) expect(summary(msgs)).toBe("[]");

    const after = await snapshotStorage(g.code);
    expect([...after.keys()].filter((k) => /emote/i.test(k))).toEqual([]);
    expect([...after.keys()].sort()).toEqual([...before.keys()].sort());
    expect((await chatKeysOf(g.code)).length).toBe(0);
  }, 30_000);

  it("(d) L30 신분별 버림: 밤의 산 시민·경찰·의사, 역할 배정·역할 확인 단계의 동작은 보낸 소켓 포함 0프레임이다", async () => {
    const g = await startedGame("night");
    const town = g.actors.filter((a) => a.role !== "mafia");
    for (const a of town) {
      const got = await observe(g, a, () => emoteSend(a.sock, "clap"));
      for (const msgs of got) expect(summary(msgs)).toBe("[]");
    }

    const s = await seat(5, 0);
    const socks = [s.host, ...s.guests.map((x) => x.sock)];
    send(s.host, { t: "start" });
    await advanceTo(s.code, socks, "roleReveal");
    for (const k of socks) await settle(k, mark(k));
    const marks = socks.map((k) => mark(k));
    for (const k of socks) emoteSend(k, "clap");
    for (let i = 0; i < socks.length; i++) expect(summary(await settle(socks[i]!, marks[i]!))).toBe("[]");
  }, 30_000);

  it("(e) 채널별 n: 낮 all 채널 n 은 1·2, 밤 마피아 채널은 1 부터 따로 세고, 시민 편이 받은 emote 프레임의 n 은 틈 없이 이어진다", async () => {
    const g = await startedGame("discussion");
    const [mafiaA, mafiaB] = withRole(g, "mafia") as [Actor, Actor];
    const citizens = withRole(g, "citizen") as [Actor, Actor];
    await pause(1500); // 낮 시작 배치 걷기가 끝난 뒤
    const townIdx = g.actors.map((a, i) => ({ a, i })).filter((x) => x.a.role !== "mafia").map((x) => x.i);

    // 낮: 서로 다른 보낸 사람 둘 -> all 채널 n 1, 2
    const day1 = await observe(g, citizens[0], () => emoteSend(citizens[0].sock, "clap"));
    expect(emotesOf(day1[g.actors.indexOf(mafiaA)]!).map((e) => e.n)).toEqual([1]);
    const day2 = await observe(g, citizens[1], () => emoteSend(citizens[1].sock, "praise"));
    expect(emotesOf(day2[g.actors.indexOf(mafiaA)]!).map((e) => e.n)).toEqual([2]);

    // 밤: 마피아 채널은 1 부터. 시민 편은 한 프레임도 받지 않는다.
    await advanceToKeep(g.code, g.socks, "night");
    for (const s of g.socks) await settle(s, mark(s));
    const n1 = await observe(g, mafiaA, () => emoteSend(mafiaA.sock, "throat"));
    const n2 = await observe(g, mafiaB, () => emoteSend(mafiaB.sock, "point"));
    expect(emotesOf(n1[g.actors.indexOf(mafiaB)]!).map((e) => e.n)).toEqual([1]);
    expect(emotesOf(n2[g.actors.indexOf(mafiaA)]!).map((e) => e.n)).toEqual([2]);
    for (const i of townIdx) {
      expect(summary(n1[i]!)).toBe("[]");
      expect(summary(n2[i]!)).toBe("[]");
    }

    // 다음 날 낮: all 채널 번호는 마피아 채널 활동과 무관하게 3 으로 이어진다.
    await advanceToKeep(g.code, g.socks, "dayAnnounce");
    for (const s of g.socks) await settle(s, mark(s));
    await resetEmoteRates(g.code);
    await pause(1500);
    const day3 = await observe(g, citizens[0], () => emoteSend(citizens[0].sock, "dance"));
    // 시민 편 소켓마다 받은 번호가 1,2,3 으로 틈 없이 이어진다.
    const perReceiver = townIdx.map((i) => [...emotesOf(day1[i]!), ...emotesOf(day2[i]!), ...emotesOf(day3[i]!)].map((e) => e.n).join(","));
    for (const r of perReceiver) expect(r).toBe("1,2,3");
  }, 60_000);
});
