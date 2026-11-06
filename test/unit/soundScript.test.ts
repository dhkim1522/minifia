// 12-02: 순수 대본(script.ts) — 시각은 상수의 함수, 난수는 인자로만 (D-10, D-11, D-13, D-15, LS-11).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { EXECUTION_MS } from "../../shared/game/phases";
import { ANNOUNCE_LEAD_MS, ANNOUNCE_MORNING_AT, ANNOUNCE_TALLY_MS, ANNOUNCE_VICTIM_AT } from "../../src/game/dayView";
import { BALLOT_END_AT, BALLOT_NO_AT, BALLOT_YES_AT } from "../../src/game/verdictMoment";
import { LETTER_FOLD_AT_MS, LETTER_SEAL_GAP_MS, LETTER_WRITE_AT_MS } from "../../src/game/willLetter";
import { mulberry32, recipeDurationMs } from "../../src/audio/recipes";
import {
  awardScript,
  EMOTE_GATE_EMPTY,
  EMOTE_SOUND_MAX,
  EMOTE_SOUND_PER_SEC,
  EMOTE_SOUND_WINDOW_MS,
  emoteSoundGate,
  type EmoteGateState,
  morningScript,
  nightCues,
  nightScript,
  pickTickSchedule,
  resultScript,
  tickSchedule,
  verdictScript,
  willScript,
} from "../../src/audio/script";
import { EMOTE_RENDER_MAX } from "../../src/world/emoteCap";
import { planTensionCues } from "../../src/world/tension";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const ids = (s: { items: readonly { id: string }[] }): string[] => s.items.map((i) => i.id);

describe("판결 대본 — verdictScript (D-13, LS-11, T-12-07)", () => {
  const FULL = { passed: true, last: false, hasBallots: true } as const;

  it("앞머리: 심장 박동 다섯 번과 찬반 소리가 상수 시각에 난다", () => {
    const s = verdictScript(FULL);
    const hearts = s.items.filter((i) => i.id === "verdict.heart").map((i) => i.at);
    expect(hearts).toEqual([0, 800, 1500, 2050, 2400]);
    expect(s.items.find((i) => i.id === "ballot.yes")!.at).toBe(BALLOT_YES_AT);
    expect(s.items.find((i) => i.id === "ballot.no")!.at).toBe(BALLOT_NO_AT);
    expect(s.items.find((i) => i.id === "ui.card")!.at).toBe(BALLOT_END_AT);
    expect(s.duck).toEqual({ fromMs: 0, toMs: BALLOT_END_AT, db: -14, returnMs: 800 });
  });

  it("2600(= ANNOUNCE_LEAD_MS + ANNOUNCE_TALLY_MS)에 통과면 gavel + rise, 부결이면 reject", () => {
    const at = ANNOUNCE_LEAD_MS + ANNOUNCE_TALLY_MS;
    expect(at).toBe(2600);
    const pass = verdictScript(FULL).items.filter((i) => i.at === at);
    expect(pass.map((i) => i.id).sort()).toEqual(["execution.gavel", "execution.rise"]);
    const fail = verdictScript({ ...FULL, passed: false }).items.filter((i) => i.at === at);
    expect(fail.map((i) => i.id)).toEqual(["verdict.reject"]);
  });

  it("2600 앞 목록(와 덕킹)은 통과/부결에서 같다 — 결과 누설 없음", () => {
    for (const hasBallots of [true, false]) {
      const a = verdictScript({ passed: true, last: false, hasBallots });
      const b = verdictScript({ passed: false, last: false, hasBallots });
      const front = (s: typeof a) => s.items.filter((i) => i.at < ANNOUNCE_LEAD_MS + ANNOUNCE_TALLY_MS);
      expect(front(a)).toEqual(front(b));
      expect(a.duck).toEqual(b.duck);
    }
  });

  it("마지막 3인 처형: 0ms 에 gavel + rise 만", () => {
    const s = verdictScript({ passed: true, last: true, hasBallots: true });
    expect(s.items.map((i) => [i.at, i.id]).sort()).toEqual([
      [0, "execution.gavel"],
      [0, "execution.rise"],
    ]);
    expect(s.duck).toBeNull();
  });

  it("찬반 기록이 없으면 ballot.yes·ballot.no·ui.card 가 없다", () => {
    const s = verdictScript({ passed: true, last: false, hasBallots: false });
    for (const id of ["ballot.yes", "ballot.no", "ui.card"]) expect(ids(s)).not.toContain(id);
    expect(ids(s)).toContain("verdict.heart");
  });

  it("모든 소리의 시작 + 길이가 EXECUTION_MS 안이고 at 오름차순", () => {
    for (const passed of [true, false]) {
      for (const last of [true, false]) {
        for (const hasBallots of [true, false]) {
          const s = verdictScript({ passed, last, hasBallots });
          for (const i of s.items) expect(i.at + recipeDurationMs(i.id)).toBeLessThanOrEqual(EXECUTION_MS);
          const ats = s.items.map((i) => i.at);
          expect(ats).toEqual([...ats].sort((a, b) => a - b));
        }
      }
    }
  });

  it("같은 입력이면 같은 출력이고 매번 새 객체를 낸다(변조가 번지지 않는다)", () => {
    const a = verdictScript(FULL);
    const b = verdictScript(FULL);
    expect(a).toEqual(b);
    a.items.length = 0;
    expect(verdictScript(FULL)).toEqual(b);
  });
});

describe("밤 대본 — nightCues·nightScript (D-11, LS-3)", () => {
  it("elapsedMs 0 이면 50개 시드에서 planTensionCues 와 같은 목록(같은 난수열)", () => {
    for (let seed = 1; seed <= 50; seed += 1) {
      const rngA = mulberry32(seed * 7919);
      const rngB = mulberry32(seed * 7919);
      const cues = nightCues(rngA);
      expect(cues).toEqual(planTensionCues(rngB));
      expect(cues.length).toBeGreaterThanOrEqual(2);
      expect(cues.length).toBeLessThanOrEqual(4);
      expect(cues[0]!).toBeGreaterThanOrEqual(5000);
      for (let i = 1; i < cues.length; i += 1) {
        const gap = cues[i]! - cues[i - 1]!;
        expect(gap).toBeGreaterThanOrEqual(4000);
        expect(gap).toBeLessThanOrEqual(9000);
      }
      expect(cues[cues.length - 1]!).toBeLessThan(28000);
      // 난수를 쓴 횟수도 같다
      expect(rngA()).toBe(rngB());
    }
  });

  it("중간 합류(elapsedMs > 0): 큐는 모두 elapsedMs + 1000 보다 뒤이고 28000 안, 개수 0~4", () => {
    for (const elapsed of [1000, 8000, 15000, 24000, 27500]) {
      for (let seed = 1; seed <= 30; seed += 1) {
        const cues = nightCues(mulberry32(seed), elapsed);
        expect(cues.length).toBeLessThanOrEqual(4);
        for (const c of cues) {
          expect(c).toBeGreaterThan(elapsed + 1000);
          expect(c).toBeLessThan(28000);
        }
      }
    }
  });

  it("nightScript: 처음부터면 night.fall 0 + night.cue 목록, 중간 합류면 큐만", () => {
    const s = nightScript(mulberry32(9));
    expect(s.items[0]).toEqual({ at: 0, id: "night.fall" });
    expect(s.items.slice(1).every((i) => i.id === "night.cue")).toBe(true);
    expect(s.items.slice(1).map((i) => i.at)).toEqual(nightCues(mulberry32(9)));
    const mid = nightScript(mulberry32(9), 10000);
    expect(ids(mid)).not.toContain("night.fall");
  });
});

describe("결과·시상 대본 — resultScript·awardScript (D-15)", () => {
  it("n=4, 내 팀 승: role.flip 4번(+20 cents 씩), 4600 에 result.win + 박수 3 + 침대 −6dB 1400ms", () => {
    const s = resultScript({ n: 4, win: true });
    const flips = s.items.filter((i) => i.id === "role.flip");
    expect(flips.map((i) => [i.at, i.cents])).toEqual([
      [1200, 0],
      [1600, 20],
      [2000, 40],
      [2400, 60],
    ]);
    const at4600 = s.items.filter((i) => i.at >= 4600);
    expect(at4600.map((i) => [i.at, i.id, i.gainDb])).toEqual([
      [4600, "result.win", undefined],
      [4600, "emote.clap", -10],
      [4680, "emote.clap", -10],
      [4760, "emote.clap", -10],
    ]);
    expect(s.items).toHaveLength(8);
    expect(s.duck).toEqual({ fromMs: 4600, toMs: 6000, db: -6, returnMs: 250 });
  });

  it("n=8 졌을 때: role.flip 8번, 마지막 4000, result.lose", () => {
    const s = resultScript({ n: 8, win: false });
    const flips = s.items.filter((i) => i.id === "role.flip");
    expect(flips).toHaveLength(8);
    expect(flips[7]).toEqual({ at: 4000, id: "role.flip", cents: 140 });
    expect(ids(s)).toContain("result.lose");
    expect(ids(s)).not.toContain("result.win");
    expect(s.items).toHaveLength(12);
  });

  it("n 이 8 보다 크면 8번까지만, 0 이하면 뒤집기 없음", () => {
    expect(resultScript({ n: 12, win: true }).items.filter((i) => i.id === "role.flip")).toHaveLength(8);
    expect(resultScript({ n: 0, win: true }).items.filter((i) => i.id === "role.flip")).toHaveLength(0);
  });

  it("시상: k번째 패는 5600 + 2500k + 900, 마지막 패는 award.final, 같은 시각 박수 ×3(−12dB, 80ms 간격)", () => {
    const first = awardScript({ k: 0, total: 3 });
    expect(first.items.map((i) => [i.at, i.id, i.gainDb])).toEqual([
      [6500, "award.plate", undefined],
      [6500, "emote.clap", -12],
      [6580, "emote.clap", -12],
      [6660, "emote.clap", -12],
    ]);
    const last = awardScript({ k: 2, total: 3 });
    expect(last.items[0]).toEqual({ at: 11500, id: "award.final" });
    expect(awardScript({ k: 0, total: 1 }).items[0]!.id).toBe("award.final");
    expect(first.duck).toBeNull();
  });
});

describe("유언 편지 대본 — willScript (D-10)", () => {
  it("쓰기 조각 60ms 마다, 인장은 쓰기 뒤 +gap, 접힘은 5000", () => {
    const s = willScript({ writeMs: 1200 });
    const quills = s.items.filter((i) => i.id === "will.quill");
    expect(quills).toHaveLength(20);
    expect(quills[0]!.at).toBe(LETTER_WRITE_AT_MS);
    expect(quills[19]!.at + 60).toBeLessThanOrEqual(LETTER_WRITE_AT_MS + 1200);
    expect(s.items.find((i) => i.id === "will.seal")!.at).toBe(LETTER_WRITE_AT_MS + 1200 + LETTER_SEAL_GAP_MS);
    expect(s.items.find((i) => i.id === "will.seal")!.at).toBe(2100);
    expect(s.items.find((i) => i.id === "will.fold")!.at).toBe(LETTER_FOLD_AT_MS);
  });

  it("writeMs 0 이하면 빈 목록", () => {
    expect(willScript({ writeMs: 0 }).items).toEqual([]);
    expect(willScript({ writeMs: -5 }).items).toEqual([]);
  });
});

describe("카운트다운 시각표 — tickSchedule·pickTickSchedule", () => {
  it("남은 5·4·3·2·1초 경계까지 남은 ms 만(이미 지난 경계는 뺀다)", () => {
    expect(tickSchedule(7300)).toEqual([2300, 3300, 4300, 5300, 6300]);
    expect(tickSchedule(5000)).toEqual([0, 1000, 2000, 3000, 4000]);
    expect(tickSchedule(3500)).toEqual([500, 1500, 2500]);
    expect(tickSchedule(4999)).toEqual([999, 1999, 2999, 3999]);
    expect(tickSchedule(900)).toEqual([]);
    expect(tickSchedule(0)).toEqual([]);
  });

  it("내 차례 틱은 남은 3·2·1초", () => {
    expect(pickTickSchedule(7300)).toEqual([4300, 5300, 6300]);
    expect(pickTickSchedule(2500)).toEqual([500, 1500]);
    expect(pickTickSchedule(-1)).toEqual([]);
  });
});

describe("대본 입력 경계 (LS-11)", () => {
  const src = readFileSync(`${ROOT}src/audio/script.ts`, "utf8");
  const FORBIDDEN_PARAMS = ["phaseEndsAt", "serverNow", "arrivedAt", "frame", "view", "RoomView", "role", "now"];
  const FUNCTIONS = ["verdictScript", "nightCues", "nightScript", "resultScript", "awardScript", "flipCue", "lightCues", "plateCues", "willScript", "tickSchedule", "pickTickSchedule"];

  it.each(FUNCTIONS)("%s 의 인자에 서버 프레임·도착 시각·역할이 없다", (name) => {
    const m = new RegExp(`export function ${name}\\(([^)]*)\\)`).exec(src);
    expect(m).not.toBeNull();
    for (const bad of FORBIDDEN_PARAMS) expect(m![1]).not.toMatch(new RegExp(`\\b${bad}\\b`));
  });

  it("입력 인터페이스의 필드 이름 목록", () => {
    const fields = (iface: string): string[] => {
      const m = new RegExp(`export interface ${iface} \\{([^}]*)\\}`).exec(src);
      expect(m).not.toBeNull();
      return [...m![1]!.matchAll(/^\s*(\w+)\??:/gm)].map((x) => x[1]!);
    };
    expect(fields("VerdictInput")).toEqual(["passed", "last", "hasBallots"]);
    expect(fields("ResultInput")).toEqual(["n", "win"]);
    expect(fields("AwardInput")).toEqual(["k", "total"]);
    expect(fields("LightInput")).toEqual(["win"]);
    expect(fields("WillInput")).toEqual(["writeMs"]);
  });

  it("전역 난수·시계·타이머를 쓰지 않는다", () => {
    const code = src.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
    for (const bad of ["Math.random", "Date.now", "new Date", "performance.now", "setTimeout", "setInterval", "crypto."]) {
      expect(code).not.toContain(bad);
    }
  });

  it("11페이즈 시간표 복사 상수는 RESULT_AT 한 객체에 모여 있다", () => {
    expect(src).toContain("export const RESULT_AT");
  });
});

describe("아침 대본 — morningScript (12-06, C-5, LS-8)", () => {
  const at = (s: { items: readonly { at: number; id: string }[] }, id: string): number | undefined => s.items.find((i) => i.id === id)?.at;

  it("희생자·내가 피해자: 0 morning.dawn · 50 kill.slash · 700 chalk.draw, 침대 bed.dawn", () => {
    const s = morningScript({ outcome: "victim", mine: true });
    expect(s.items.map((i) => [i.at, i.id])).toEqual([
      [0, "morning.dawn"],
      [50, "kill.slash"],
      [ANNOUNCE_VICTIM_AT, "chalk.draw"],
    ]);
    expect(s.bed).toBe("bed.dawn");
    expect(s.duck).toBeNull();
  });

  it("희생자·남의 화면: kill.slash 가 없다", () => {
    const s = morningScript({ outcome: "victim", mine: false });
    expect(ids(s)).toEqual(["morning.dawn", "chalk.draw"]);
  });

  it("평화: 400 morning.calm, 구출: 400 morning.saved (chalk.draw 없음)", () => {
    const calm = morningScript({ outcome: "calm", mine: false });
    const saved = morningScript({ outcome: "saved", mine: false });
    expect(ids(calm)).toEqual(["morning.dawn", "morning.calm"]);
    expect(at(calm, "morning.calm")).toBe(ANNOUNCE_MORNING_AT);
    expect(ids(saved)).toEqual(["morning.dawn", "morning.saved"]);
    expect(at(saved, "morning.saved")).toBe(ANNOUNCE_MORNING_AT);
  });

  it("mine 이 거짓이면 어떤 결과에도 kill.slash 가 없다 (LS-8 의 순수 부분)", () => {
    for (const outcome of ["calm", "saved", "victim"] as const) {
      expect(ids(morningScript({ outcome, mine: false }))).not.toContain("kill.slash");
    }
    // 희생자가 아니면 mine 이 참이어도 slash 는 없다(칼날은 선 본인의 죽음에만)
    expect(ids(morningScript({ outcome: "calm", mine: true }))).not.toContain("kill.slash");
    expect(ids(morningScript({ outcome: "saved", mine: true }))).not.toContain("kill.slash");
  });

  it("시각순으로 정렬돼 있고 같은 입력이면 같은 출력", () => {
    for (const outcome of ["calm", "saved", "victim"] as const) {
      const a = morningScript({ outcome, mine: true });
      expect(a.items.map((i) => i.at)).toEqual([...a.items.map((i) => i.at)].sort((x, y) => x - y));
      expect(morningScript({ outcome, mine: true })).toEqual(a);
    }
  });
});

// ───────────────────────── 12-10: 동작 소리 게이트 (D-14, T-12-39) ─────────────────────────

describe("emoteSoundGate: 초당 3개·동시 4개 (순수, 시각은 인자)", () => {
  /** 순서대로 시도하고 수락 여부 열을 돌려준다. 거절은 상태를 바꾸지 않는다 */
  function run(times: number[], durationMs: number): { oks: boolean[]; state: EmoteGateState } {
    let state: EmoteGateState = EMOTE_GATE_EMPTY;
    const oks: boolean[] = [];
    for (const t of times) {
      const r = emoteSoundGate(state, t, durationMs);
      oks.push(r.ok);
      state = r.next;
    }
    return { oks, state };
  }

  it("상수: 초당 3·창 1000ms·동시 4 이고 동시 상한은 EMOTE_RENDER_MAX 와 같다", () => {
    expect(EMOTE_SOUND_PER_SEC).toBe(3);
    expect(EMOTE_SOUND_WINDOW_MS).toBe(1000);
    expect(EMOTE_SOUND_MAX).toBe(4);
    expect(EMOTE_SOUND_MAX).toBe(EMOTE_RENDER_MAX);
  });

  it("1초 안에 셋까지 수락하고 넷째는 조용히 거절한다", () => {
    expect(run([0, 100, 200, 300], 200).oks).toEqual([true, true, true, false]);
  });

  it("거절은 상태를 바꾸지 않는다 (같은 객체)", () => {
    const { state } = run([0, 100, 200], 200);
    const r = emoteSoundGate(state, 300, 200);
    expect(r.ok).toBe(false);
    expect(r.next).toBe(state);
  });

  it("첫 수락 +1000ms 가 지나면 다시 수락한다 (999 는 거절, 1000 은 수락)", () => {
    expect(run([0, 100, 200, 999], 200).oks).toEqual([true, true, true, false]);
    expect(run([0, 100, 200, 1000], 200).oks).toEqual([true, true, true, true]);
  });

  it("길게 도는 소리는 동시 4개 이상을 거절한다 (초당 3 안이어도)", () => {
    // 3000ms 소리: 0·400·800 수락(초당 3) → 1100(창 안 400·800 + ...)은 수락 → 활성 4 → 1500 거절
    const r = run([0, 400, 800, 1100, 1500, 2100], 3000);
    expect(r.oks).toEqual([true, true, true, true, false, false]);
  });

  it("활성 추정이 끝나면(수락 + 길이) 다시 수락한다", () => {
    const r = run([0, 400, 800, 1100, 3050], 3000);
    expect(r.oks).toEqual([true, true, true, true, true]);
  });

  it("상태는 지난 항목을 정리한다 (무한히 자라지 않음)", () => {
    const times = Array.from({ length: 200 }, (_, i) => i * 1500);
    expect(run(times, 300).state.accepted.length).toBeLessThanOrEqual(EMOTE_SOUND_MAX);
    expect(run(times, 300).oks.every(Boolean)).toBe(true);
  });
});
