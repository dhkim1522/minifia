// 12-05: window.__mfSound 테스트 훅 — 켜진 문맥에서만, A-4 모양, 역할 정보 없음 (D-22, A-4, LS-9, T-12-15)
import { describe, expect, it } from "vitest";
import { installSoundHook, type MfSoundHook } from "../../src/audio/testHook";
import { makeRig } from "../helpers/soundRig";

type Target = { __mfSound?: MfSoundHook };

describe("installSoundHook", () => {
  it("enabled 가 거짓이면 아무것도 만들지 않는다", () => {
    const { engine } = makeRig();
    const target: Target = {};
    expect(installSoundHook(engine, false, target)).toBeNull();
    expect(target.__mfSound).toBeUndefined();
  });

  it("enabled 이면 { state, on, bed, voices, log, clear } 만 가진다", () => {
    const { engine } = makeRig();
    const target: Target = {};
    installSoundHook(engine, true, target);
    const hook = target.__mfSound!;
    expect(Object.keys(hook).sort()).toEqual(["bed", "clear", "log", "on", "state", "voices"]);
    expect(typeof hook.clear).toBe("function");
  });

  it("값은 엔진을 그대로 비춘다: 잠금 → locked, 풀림 → running, 꺼짐 → off", () => {
    const { engine } = makeRig();
    const target: Target = {};
    installSoundHook(engine, true, target);
    const hook = target.__mfSound!;
    expect(hook.state).toBe("locked");
    expect(hook.on).toBe(true);
    expect(hook.bed).toBeNull();
    expect(hook.voices).toBe(0);
    engine.unlock();
    expect(hook.state).toBe("running");
    engine.play("ui.tap");
    expect(hook.voices).toBe(1);
    engine.setOn(false);
    expect(hook.state).toBe("off");
    expect(hook.on).toBe(false);
  });

  it("log 항목의 키는 id·at·gain·played 뿐이고 사본이다", () => {
    const { engine } = makeRig();
    const target: Target = {};
    installSoundHook(engine, true, target);
    const hook = target.__mfSound!;
    engine.unlock();
    engine.play("ui.tap");
    engine.play("ui.deny");
    expect(hook.log).toHaveLength(2);
    for (const e of hook.log) expect(Object.keys(e).sort()).toEqual(["at", "gain", "id", "played"]);
    (hook.log[0] as { played: boolean }).played = false;
    expect(hook.log[0]!.played).toBe(true);
    const json = JSON.stringify(hook);
    expect(json).not.toMatch(/role|seat|nonce/i);
  });

  it("clear() 는 로그만 비운다", () => {
    const { engine } = makeRig();
    const target: Target = {};
    installSoundHook(engine, true, target);
    const hook = target.__mfSound!;
    engine.unlock();
    engine.play("ui.tap");
    hook.clear();
    expect(hook.log).toHaveLength(0);
    expect(hook.state).toBe("running");
    expect(hook.voices).toBe(1);
  });

  it("bed 는 현재 침대, 숨기면 suspended, 로그는 300개를 넘지 않는다", () => {
    const rig = makeRig();
    const { engine, fake } = rig;
    const target: Target = {};
    installSoundHook(engine, true, target);
    const hook = target.__mfSound!;
    engine.unlock();
    engine.setBed("bed.vote");
    expect(hook.bed).toBe("bed.vote");
    expect(hook.log.at(-1)).toMatchObject({ id: "bed.vote", played: true });
    engine.hidden();
    fake.clock.advance(200);
    expect(hook.state).toBe("suspended");
    engine.clearLog();
    for (let i = 0; i < 350; i += 1) {
      engine.play("ui.tap");
      fake.clock.advance(1);
    }
    expect(hook.log).toHaveLength(300);
    expect(hook.log[0]!.at).toBeLessThan(hook.log[299]!.at);
    expect(hook.log.every((e) => e.played === false)).toBe(true);
  });

  it("interrupted 는 locked 로 보인다", () => {
    const { engine, fake } = makeRig();
    const target: Target = {};
    installSoundHook(engine, true, target);
    engine.unlock();
    fake.ctx().setState("interrupted");
    expect(target.__mfSound!.state).toBe("locked");
  });
});
