// 10-03: 사람 동작 동시 재생 상한(D-13)의 순수 선택. 시각은 인자이고 three·DOM 을 모른다.
import { describe, expect, it } from "vitest";
import { EMOTE_MS } from "../../shared/game/emote";
import { EMOTES, type EmoteId } from "../../src/world/characterData";
import { admitEmote, EMOTE_RENDER_MAX, emoteDurationMs, type PlayingEmote } from "../../src/world/emoteCap";

const at = (seat: number, until = 10_000): PlayingEmote => ({ seat, until });

describe("EMOTE_RENDER_MAX (D-13)", () => {
  it("동시에 보이는 사람 동작은 4개다", () => {
    expect(EMOTE_RENDER_MAX).toBe(4);
  });
});

describe("admitEmote", () => {
  it("상한 미만이면 새 것이 뒤에 붙고 멈출 좌석은 없다", () => {
    const r = admitEmote([at(1), at(2)], at(3), 0, 4);
    expect(r.playing.map((p) => p.seat)).toEqual([1, 2, 3]);
    expect(r.stopSeats).toEqual([]);
  });

  it("이미 상한이면 가장 먼저 도착한 항목이 stopSeats 로 나가고 새 것은 항상 들어간다", () => {
    const r = admitEmote([at(5), at(1), at(2), at(3)], at(7), 0, 4);
    expect(r.stopSeats).toEqual([5]);
    expect(r.playing.map((p) => p.seat)).toEqual([1, 2, 3, 7]);
  });

  it("순서는 도착 순서(배열 순서)다 — 좌석 번호나 프레임 n 으로 정하지 않는다", () => {
    const r = admitEmote([at(7), at(0), at(3), at(2)], at(1), 0, 4);
    expect(r.stopSeats).toEqual([7]);
  });

  it("끝난 항목(until ≤ now)은 먼저 걷어 내 상한을 채우지 않는다 — 멈추라고 하지도 않는다", () => {
    const r = admitEmote([at(1, 500), at(2, 1000), at(3, 9000), at(4, 9000)], at(5), 1000, 4);
    expect(r.stopSeats).toEqual([]);
    expect(r.playing.map((p) => p.seat)).toEqual([3, 4, 5]);
  });

  it("같은 좌석의 이전 항목은 새 것으로 바뀐다 — 상한을 두 번 세지 않는다", () => {
    const r = admitEmote([at(1), at(2), at(3), at(4)], at(2, 20_000), 0, 4);
    expect(r.stopSeats).toEqual([]);
    expect(r.playing.map((p) => p.seat)).toEqual([1, 3, 4, 2]);
    expect(r.playing.at(-1)!.until).toBe(20_000);
  });

  it("max 보다 많이 쌓여 있어도 새 것이 들어갈 자리가 max - 1 이 되도록 오래된 것부터 모두 내보낸다", () => {
    const r = admitEmote([at(1), at(2), at(3), at(4), at(5), at(6)], at(7), 0, 4);
    expect(r.stopSeats).toEqual([1, 2, 3]);
    expect(r.playing.map((p) => p.seat)).toEqual([4, 5, 6, 7]);
  });

  it("입력 배열과 항목을 바꾸지 않는다", () => {
    const input = [at(1), at(2)];
    const copy = JSON.parse(JSON.stringify(input)) as PlayingEmote[];
    admitEmote(input, at(2, 5), 0, 1);
    expect(input).toEqual(copy);
  });
});

describe("emoteDurationMs", () => {
  it("보통은 서버의 EMOTE_MS 표와 같다", () => {
    for (const id of Object.keys(EMOTES) as EmoteId[]) expect(emoteDurationMs(id, false)).toBe(EMOTE_MS[id]);
  });

  it("모션 줄이기는 반복(cycles)을 2 로 제한한다 — 이미 2 이하인 동작은 그대로다", () => {
    for (const id of Object.keys(EMOTES) as EmoteId[]) {
      const d = EMOTES[id];
      const cycles = Math.min(d.cycles, 2);
      expect(emoteDurationMs(id, true)).toBe(Math.round((d.frames.length * d.seg * cycles + d.hold) * 1000));
      if (d.cycles <= 2) expect(emoteDurationMs(id, true)).toBe(EMOTE_MS[id]);
      else expect(emoteDurationMs(id, true)).toBeLessThan(EMOTE_MS[id]);
    }
  });
});
