import { describe, expect, it, vi } from "vitest";
import type { ResultLogFrame } from "../../shared/protocol";
import { ResultLogStore } from "../../src/net/resultLogStore";

// 결과 공개 프레임(resultLog)을 모으는 클라이언트 저장소 (11-07, D-2·D-9). 시각을 읽지 않는 순수에 가까운 클래스다(ChatStore 선례).
const chat = (part: "mafia" | "ghost", i: number, end: boolean, lines: { seat: number; n: number; text: string }[]): ResultLogFrame => ({
  t: "resultLog",
  part,
  i,
  end,
  lines: lines.map((l, k) => ({ ...l, at: 1000 + i * 100 + k })),
});
const whisper = (i: number, end: boolean, lines: { seat: number; to: number; n: number; text: string }[]): ResultLogFrame => ({
  t: "resultLog",
  part: "whisper",
  i,
  end,
  lines: lines.map((l, k) => ({ ...l, at: 2000 + i * 100 + k })),
});
const empty = (part: ResultLogFrame["part"]): ResultLogFrame => ({ t: "resultLog", part, i: 0, end: true, lines: [] }) as ResultLogFrame;

describe("ResultLogStore (11-07)", () => {
  it("처음에는 다섯 부분이 모두 비어 있고 끝나지 않았다", () => {
    const s = new ResultLogStore();
    const snap = s.snapshot();
    for (const part of ["mafia", "ghost", "whisper", "claim", "ballots"] as const) {
      expect(snap[part].lines).toEqual([]);
      expect(snap[part].complete).toBe(false);
    }
  });

  it("프레임 다섯 부분을 받으면 부분별 줄이 쌓이고 end 를 받은 부분만 complete 다", () => {
    const s = new ResultLogStore();
    s.apply(chat("mafia", 0, true, [{ seat: 3, n: 1, text: "오늘 밤" }]), 1);
    s.apply(chat("ghost", 0, false, [{ seat: 2, n: 2, text: "아이고" }]), 1);
    s.apply(whisper(0, true, [{ seat: 0, to: 1, n: 1, text: "비밀" }]), 1);
    s.apply(empty("claim"), 1);
    const snap = s.snapshot();
    expect(snap.mafia.lines.map((l) => l.text)).toEqual(["오늘 밤"]);
    expect(snap.mafia.complete).toBe(true);
    expect(snap.ghost.lines.map((l) => l.text)).toEqual(["아이고"]);
    expect(snap.ghost.complete).toBe(false);
    expect(snap.whisper.lines[0]).toMatchObject({ seat: 0, to: 1, n: 1, text: "비밀" });
    expect(snap.whisper.complete).toBe(true);
    expect(snap.claim.complete).toBe(true);
    expect(snap.ballots.complete).toBe(false);
  });

  it("같은 부분의 프레임이 i 순서가 아니어도 i 순서로 정렬해 이어 붙인다", () => {
    const s = new ResultLogStore();
    s.apply(chat("mafia", 1, true, [{ seat: 1, n: 2, text: "둘째" }]), 1);
    s.apply(chat("mafia", 0, false, [{ seat: 1, n: 1, text: "첫째" }, { seat: 3, n: 1, text: "첫째 둘" }]), 1);
    expect(s.snapshot().mafia.lines.map((l) => l.text)).toEqual(["첫째", "첫째 둘", "둘째"]);
  });

  it("같은 (부분, i) 프레임이 다시 오면 겹쳐 쌓지 않고 바꾼다", () => {
    const s = new ResultLogStore();
    s.apply(chat("ghost", 0, true, [{ seat: 2, n: 1, text: "하나" }]), 1);
    s.apply(chat("ghost", 0, true, [{ seat: 2, n: 1, text: "하나" }]), 1);
    expect(s.snapshot().ghost.lines).toHaveLength(1);
  });

  it("낡은 epoch 프레임은 버리고 새 epoch 의 첫 프레임은 이전 값을 비운다", () => {
    const s = new ResultLogStore();
    s.apply(chat("mafia", 0, true, [{ seat: 3, n: 1, text: "옛 연결" }]), 2);
    s.apply(chat("mafia", 0, true, [{ seat: 3, n: 1, text: "더 옛 연결" }]), 1);
    expect(s.snapshot().mafia.lines.map((l) => l.text)).toEqual(["옛 연결"]);
    s.apply(chat("ghost", 0, true, [{ seat: 2, n: 1, text: "새 연결" }]), 3);
    const snap = s.snapshot();
    expect(snap.mafia.lines).toEqual([]);
    expect(snap.mafia.complete).toBe(false);
    expect(snap.ghost.lines.map((l) => l.text)).toEqual(["새 연결"]);
  });

  it("reset() 은 모두 비우고 epoch 도 처음으로 돌려 어떤 연결의 프레임이든 다시 받는다", () => {
    const s = new ResultLogStore();
    s.apply(chat("mafia", 0, true, [{ seat: 3, n: 1, text: "한 판" }]), 5);
    s.reset();
    expect(s.snapshot().mafia.lines).toEqual([]);
    expect(s.snapshot().mafia.complete).toBe(false);
    s.apply(chat("mafia", 0, true, [{ seat: 3, n: 1, text: "다음 판" }]), 1);
    expect(s.snapshot().mafia.lines.map((l) => l.text)).toEqual(["다음 판"]);
  });

  it("구독자에게 변경을 알리고, 바뀐 게 없으면 스냅샷 참조도 그대로다", () => {
    const s = new ResultLogStore();
    const cb = vi.fn();
    const off = s.subscribe(cb);
    const before = s.snapshot();
    expect(s.snapshot()).toBe(before);
    s.apply(empty("mafia"), 1);
    expect(cb).toHaveBeenCalledTimes(1);
    expect(s.snapshot()).not.toBe(before);
    const after = s.snapshot();
    s.apply(empty("mafia"), 1); // 같은 프레임 — 내용이 같아도 새로 받았으니 알림은 허용되지만 snapshot 은 안정적이어야 한다
    expect(s.snapshot().mafia.lines).toEqual(after.mafia.lines);
    off();
    cb.mockClear();
    s.apply(empty("ghost"), 1);
    expect(cb).not.toHaveBeenCalled();
  });

  it("revision() 은 바뀔 때만 늘어난다 (useSyncExternalStore 용)", () => {
    const s = new ResultLogStore();
    const r0 = s.revision();
    s.apply(empty("mafia"), 1);
    expect(s.revision()).toBeGreaterThan(r0);
    s.reset();
    const r1 = s.revision();
    s.reset(); // 이미 비어 있으면 바뀌지 않는다
    expect(s.revision()).toBe(r1);
  });
});
