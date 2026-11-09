// 17-02: 사회자 웅얼 목소리 — 문장이 음절 대본으로 예약된다 (TUT-04, 0078-4, UI-SPEC 사회자 띠·목소리 계약).
// 모듈은 문구를 인자로만 받는다. 엔진은 가짜(runScript 호출만 기록)라 소리 출력 없이 간격·음높이·예약 횟수를 건다.
import { describe, expect, it } from "vitest";
import type { ScriptItem } from "../../src/audio/script";

type VoiceModule = typeof import("../../src/audio/voice");

/** 모듈이 있어야 한다는 단언을 import 오류가 아닌 실패 메시지로 남기려고 동적으로 가져온다 */
async function loadVoice(): Promise<VoiceModule> {
  const mod = (await import("../../src/audio/voice").catch(() => null)) as VoiceModule | null;
  expect(mod, "src/audio/voice.ts 모듈이 있어야 한다").not.toBeNull();
  return mod!;
}

const cents = (ratio: number): number => Math.round(1200 * Math.log2(ratio));

function fakeEngine(): { calls: { key: string; items: readonly ScriptItem[] }[]; runScript: (key: string, items: readonly ScriptItem[]) => void } {
  const calls: { key: string; items: readonly ScriptItem[] }[] = [];
  return { calls, runScript: (key, items) => void calls.push({ key, items }) };
}

describe("sayItems — 글자마다 음절 하나 (85ms, 띄어쓰기 +50ms, 시작 50ms)", () => {
  it('"서연 님이" → 항목 4개, at [50, 135, 270, 355], totalMs 520', async () => {
    const { sayItems } = await loadVoice();
    const { items, totalMs } = sayItems("서연 님이");
    expect(items.map((i) => i.at)).toEqual([50, 135, 270, 355]);
    expect(items.every((i) => i.id === "voice.syl")).toBe(true);
    expect(items.map((i) => i.cents)).toEqual([cents(1), cents(1.12), cents(1.26), cents(1.06)]);
    expect(totalMs).toBe(520);
  });

  it("음높이는 6단계 순환이고 7번째 글자마다 ×0.88 이다", async () => {
    const { sayItems } = await loadVoice();
    const { items } = sayItems("가나다라마바사아자차카타파");
    const steps = [1, 1.12, 1.26, 1.06, 1.19, 0.94];
    expect(items).toHaveLength(13);
    for (let n = 0; n < items.length; n += 1) {
      const ratio = steps[n % 6]! * (n % 7 === 6 ? 0.88 : 1);
      expect(items[n]!.cents).toBe(cents(ratio));
    }
    // 7번째(n=6)는 순환 첫 값 ×0.88, 14번째(n=13)도 같은 규칙
    expect(items[6]!.cents).toBe(cents(0.88));
    expect(items[6]!.cents).toBeLessThan(items[0]!.cents!);
  });

  it("빈 문장은 항목 없이 totalMs 130, 공백뿐인 문장도 항목이 없다", async () => {
    const { sayItems } = await loadVoice();
    expect(sayItems("")).toEqual({ items: [], totalMs: 130 });
    expect(sayItems("   ").items).toEqual([]);
  });

  it("totalMs 는 마지막 음절 at + 165 (글자 수 × 85 + 80 + 시작 50)", async () => {
    const { sayItems } = await loadVoice();
    const { items, totalMs } = sayItems("안녕하세요");
    expect(totalMs).toBe(items[items.length - 1]!.at + 165);
  });
});

describe("say·hush — 같은 key 한 번씩 예약", () => {
  it("say 는 runScript 를 (voice.host, items) 로 한 번 부르고 totalMs 를 돌려준다", async () => {
    const { say, sayItems, VOICE_KEY } = await loadVoice();
    const eng = fakeEngine();
    const total = say(eng, "서연 님이");
    expect(VOICE_KEY).toBe("voice.host");
    expect(eng.calls).toHaveLength(1);
    expect(eng.calls[0]!.key).toBe("voice.host");
    expect(eng.calls[0]!.items).toEqual(sayItems("서연 님이").items);
    expect(total).toBe(520);
  });

  it("두 번 연속 say 하면 같은 key 로 두 번 불린다(엔진이 앞 예약을 끊는다)", async () => {
    const { say } = await loadVoice();
    const eng = fakeEngine();
    say(eng, "첫 문장");
    say(eng, "새 문장");
    expect(eng.calls.map((c) => c.key)).toEqual(["voice.host", "voice.host"]);
  });

  it("hush 는 (voice.host, []) 로 한 번 부른다", async () => {
    const { hush } = await loadVoice();
    const eng = fakeEngine();
    hush(eng);
    expect(eng.calls).toEqual([{ key: "voice.host", items: [] }]);
  });
});
