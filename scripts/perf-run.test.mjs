// perf-run.mjs 의 순수 도우미 단위 테스트(12-06). 실행: node --test scripts/perf-run.test.mjs
// --sound on|off 파싱과 소리 도우미 셋(soundInitScript·wakeAudio·readSoundState)을 가짜 page 객체로 확인한다.
// nightload 실행 자체는 이 시험이 하지 않는다(실행과 성능 합격선은 12-12).
import test from "node:test";
import assert from "node:assert/strict";
import { LIGHT_MORNING_RATIO, LIGHT_TALK_RATIO, LIGHT_VOTE_DELTA, NIGHTLOAD_DWELL, USAGE, colorStats, lightRankVerdict, outputBase, parseArgs, readSoundState, soundInitScript, wakeAudio } from "./perf-run.mjs";

test("parseArgs --map (20-09): bar·plaza 를 받고 저장 이름 끝이 -bar·-plaza, 없으면 그대로", () => {
  const o = parseArgs(["--mode", "nightload", "--map", "plaza"]);
  assert.equal(o.map, "plaza");
  assert.equal(outputBase(o), "nightload-390x844-x4-plaza");
  assert.equal(outputBase(parseArgs(["--mode", "nightload", "--map", "bar"])), "nightload-390x844-x4-bar");
  assert.equal(outputBase(parseArgs(["--mode", "nightload"])), "nightload-390x844-x4");
  assert.throws(() => parseArgs(["--map", "space"]), /--map/);
  assert.throws(() => parseArgs(["--map", "town"]), /--map/);
  assert.match(USAGE, /--map bar\|plaza\]/);
});

test("parseArgs --sound: 기본 on, on·off 를 받는다", () => {
  assert.equal(parseArgs([]).sound, "on");
  assert.equal(parseArgs(["--mode", "nightload", "--sound", "on"]).sound, "on");
  assert.equal(parseArgs(["--mode", "nightload", "--sound", "off"]).sound, "off");
});

test("parseArgs --sound: on·off 이외 값이나 값 없음은 사용법 오류", () => {
  assert.throws(() => parseArgs(["--sound", "maybe"]), /--sound/);
  assert.throws(() => parseArgs(["--sound", "ON"]), /--sound/);
  assert.throws(() => parseArgs(["--sound"]), /--sound/);
  assert.throws(() => parseArgs(["--sound", "--mode", "nightload"]), /--sound/);
});

test("parseArgs --sound: nightload 가 아닌 모드에서도 파싱은 통과한다(무시)", () => {
  assert.equal(parseArgs(["--mode", "chatload", "--sound", "off"]).mode, "chatload");
  assert.equal(parseArgs(["--mode", "perf", "--sound", "off"]).sound, "off");
});

test("parseArgs --sound: 다른 기본값은 그대로(nightload 출력 폴더·크기·봇 수)", () => {
  const o = parseArgs(["--mode", "nightload"]);
  assert.equal(o.mode, "nightload");
  assert.deepEqual(o.size, { w: 390, h: 844 });
  assert.equal(o.bots, 7);
});

test("USAGE 에 --sound on|off 가 있다", () => {
  assert.match(USAGE, /--sound on\|off/);
});

test("soundInitScript: off 면 저장값 minifia:sound = {\"v\":1,\"on\":false} 를 쓰는 문자열, on 이면 없음(null)", () => {
  assert.equal(soundInitScript("on"), null);
  const s = soundInitScript("off");
  assert.equal(typeof s, "string");
  const writes = [];
  new Function("localStorage", s)({ setItem: (k, v) => writes.push([k, v]) });
  assert.deepEqual(writes, [["minifia:sound", '{"v":1,"on":false}']]);
  // 저장소가 막혀 있어도 던지지 않는다
  assert.doesNotThrow(() =>
    new Function("localStorage", s)({
      setItem() {
        throw new Error("blocked");
      },
    }),
  );
});

test("wakeAudio: on 이면 좌상단 가장자리(4,4)를 한 번 탭하고 true, off 면 탭하지 않는다", async () => {
  const taps = [];
  const page = { touchscreen: { tap: async (x, y) => taps.push([x, y]) } };
  assert.equal(await wakeAudio(page, { w: 390, h: 844 }, "on"), true);
  assert.deepEqual(taps, [[4, 4]]);
  assert.equal(await wakeAudio(page, { w: 390, h: 844 }), true);
  assert.equal(taps.length, 2);
  assert.equal(await wakeAudio(page, { w: 390, h: 844 }, "off"), false);
  assert.equal(taps.length, 2);
});

test("wakeAudio: 탭이 실패해도(터치 없는 컨텍스트) 던지지 않고 false", async () => {
  const page = {
    touchscreen: {
      tap: async () => {
        throw new Error("no touch");
      },
    },
  };
  assert.equal(await wakeAudio(page, { w: 390, h: 844 }, "on"), false);
});

test("readSoundState: window.__mfSound 에서 { state, on, requests } 를 읽고, 훅이 없으면 null", async () => {
  const prev = globalThis.window;
  const page = { evaluate: async (fn) => fn() };
  try {
    globalThis.window = { __mfSound: { state: "running", on: true, log: [{ id: "ui.tap" }, { id: "day.start" }, { id: "bed.day" }] } };
    assert.deepEqual(await readSoundState(page), { state: "running", on: true, requests: 3 });
    globalThis.window = {};
    assert.equal(await readSoundState(page), null);
  } finally {
    if (prev === undefined) delete globalThis.window;
    else globalThis.window = prev;
  }
});

test("readSoundState: page.evaluate 가 던지면 null", async () => {
  const page = {
    evaluate: async () => {
      throw new Error("closed");
    },
  };
  assert.equal(await readSoundState(page), null);
});

test("NIGHTLOAD_DWELL: 토론이 첫 장면이고 errand 장면이 없으며 한 바퀴 합은 50초다", () => {
  assert.deepEqual(NIGHTLOAD_DWELL.map(([phase]) => phase), ["discussion", "nomination", "defense", "verdict", "execution", "night", "morning"]);
  assert.deepEqual(NIGHTLOAD_DWELL[0], ["discussion", 10_000]);
  assert.equal(NIGHTLOAD_DWELL.reduce((sum, [, ms]) => sum + ms, 0), 50_000);
});

// ---- 18-07: --mode light, 조명 렌더 순서 판정 ----

test("parseArgs --mode light: 받는다, 기본 out 은 기존 기본값 그대로", () => {
  const o = parseArgs(["--mode", "light"]);
  assert.equal(o.mode, "light");
  assert.equal(o.out, parseArgs([]).out);
});

test("parseArgs --scene: 네 단계 모두 받는다", () => {
  for (const s of ["talk", "morning", "vote", "night"]) assert.equal(parseArgs(["--scene", s]).scene, s);
});

test("USAGE 에 --mode light 가 있다", () => {
  assert.match(USAGE, /light/);
});

test("고정 카메라 휘도 검사에는 낮과 밤의 대비 상한이 있다", () => {
  assert.equal(LIGHT_VOTE_DELTA, 0.12);
  assert.deepEqual(LIGHT_TALK_RATIO, { min: 1.15, max: 2.8 });
  assert.deepEqual(LIGHT_MORNING_RATIO, { min: 1.12, max: 2.8 });
});

test("lightRankVerdict: 같은 낮의 투표와 읽을 수 있는 밤을 허용한다", () => {
  const v = lightRankVerdict({ talk: 0.1, morning: 0.083, vote: 0.104, night: 0.047 });
  assert.equal(v.ok, true);
  assert.deepEqual(v.rows.map((r) => r.id), ["L4a", "L4b", "L4c"]);
  assert.ok(v.rows.every((r) => r.ok));
});

test("lightRankVerdict: 투표 화면만 지나치게 밝거나 어두우면 L4a가 실패한다", () => {
  for (const vote of [0.06, 0.16]) {
    const v = lightRankVerdict({ talk: 0.1, morning: 0.082, vote, night: 0.046 });
    assert.equal(v.ok, false);
    assert.equal(v.rows.find((r) => r.id === "L4a").ok, false);
  }
});

test("lightRankVerdict: 밤이 너무 어둡거나 시간대가 비슷하면 L4b와 L4c가 실패한다", () => {
  for (const night of [0.02, 0.096]) {
    const v = lightRankVerdict({ talk: 0.1, morning: 0.098, vote: 0.1, night });
    assert.equal(v.rows.find((r) => r.id === "L4b").ok, false);
    assert.equal(v.rows.find((r) => r.id === "L4c").ok, false);
  }
});

test("lightRankVerdict: 숫자가 아닌 값이 있으면 모든 줄이 ok false(측정 못 함)", () => {
  const v = lightRankVerdict({ talk: 0.3, morning: null, vote: 0.12, night: 0.08 });
  assert.equal(v.ok, false);
  assert.equal(v.rows.length, 3);
  assert.ok(v.rows.every((r) => r.ok === false));
});

test("colorStats: 남색 아래쪽 절반 근사 (22, 26, 45) → 채도 0.511·blueLead 19", () => {
  assert.deepEqual(colorStats(22, 26, 45), { r: 22, g: 26, b: 45, sat: 0.511, blueLead: 19 });
});

test("colorStats: 회색 쪽 (100, 98, 96) → 채도 0.04·blueLead −4", () => {
  assert.deepEqual(colorStats(100, 98, 96), { r: 100, g: 98, b: 96, sat: 0.04, blueLead: -4 });
});

test("colorStats: 검정 (0, 0, 0) → 채도 0·blueLead 0", () => {
  assert.deepEqual(colorStats(0, 0, 0), { r: 0, g: 0, b: 0, sat: 0, blueLead: 0 });
});

test("colorStats: r·g·b 는 소수 첫째로 반올림한다", () => {
  const c = colorStats(10.04, 20.06, 30.26);
  assert.equal(c.r, 10);
  assert.equal(c.g, 20.1);
  assert.equal(c.b, 30.3);
});
