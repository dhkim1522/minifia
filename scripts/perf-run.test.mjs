// perf-run.mjs 의 순수 도우미 단위 테스트(12-06). 실행: node --test scripts/perf-run.test.mjs
// --sound on|off 파싱과 소리 도우미 셋(soundInitScript·wakeAudio·readSoundState)을 가짜 page 객체로 확인한다.
// nightload 실행 자체는 이 시험이 하지 않는다(실행과 성능 합격선은 12-12).
import test from "node:test";
import assert from "node:assert/strict";
import { USAGE, parseArgs, readSoundState, soundInitScript, wakeAudio } from "./perf-run.mjs";

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
