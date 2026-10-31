import { describe, expect, it } from "vitest";
import type { MapStatusEvent, MapStatusState } from "../../src/world/status";
import {
  FAIL_AFTER_MS,
  initialMapStatus,
  inputBlocked,
  isSoftwareRenderer,
  MAP_STATUS_COPY,
  mapStatusReducer,
  RECREATE_AFTER_MS,
  shouldRecreate,
} from "../../src/world/status";

function run(events: MapStatusEvent[], from: MapStatusState = initialMapStatus): MapStatusState {
  return events.reduce(mapStatusReducer, from);
}
const ready = () => run([{ t: "ready" }]);
const lostAt = (at: number) => run([{ t: "ready" }, { t: "lost", at }]);

describe("상수와 초기 상태", () => {
  it("재생성은 소실 3초 뒤, 실패는 5초 뒤", () => {
    expect(RECREATE_AFTER_MS).toBe(3000);
    expect(FAIL_AFTER_MS).toBe(5000);
  });
  it("처음에는 loading, 소실 시각 없음", () => {
    expect(initialMapStatus).toEqual({ status: "loading", lostAt: null });
  });
});

describe("불러오기: loading → ready / loadFailed / unsupported", () => {
  it("loading + ready → ready", () => {
    expect(run([{ t: "ready" }])).toEqual({ status: "ready", lostAt: null });
  });
  it("loading + loadError → loadFailed, retry → loading", () => {
    const failed = run([{ t: "loadError" }]);
    expect(failed.status).toBe("loadFailed");
    expect(mapStatusReducer(failed, { t: "retry" })).toEqual({ status: "loading", lostAt: null });
  });
  it("loadFailed 는 retry 말고는 어떤 이벤트에도 그대로다", () => {
    const failed = run([{ t: "loadError" }]);
    for (const e of [{ t: "ready" }, { t: "lost", at: 5 }, { t: "tick", now: 99999 }, { t: "restored" }, { t: "loadError" }] as MapStatusEvent[]) {
      expect(mapStatusReducer(failed, e)).toBe(failed);
    }
  });
  it("loading + unsupported → unsupported, 이후 어떤 이벤트에도 그대로(몰래 다른 화면으로 대체하지 않는다)", () => {
    const u = run([{ t: "unsupported" }]);
    expect(u.status).toBe("unsupported");
    const events: MapStatusEvent[] = [
      { t: "ready" },
      { t: "loadError" },
      { t: "lost", at: 1 },
      { t: "restored" },
      { t: "recreated" },
      { t: "tick", now: 1e9 },
      { t: "retry" },
      { t: "visible", contextLost: true, at: 5 },
      { t: "unsupported" },
    ];
    for (const e of events) expect(mapStatusReducer(u, e)).toBe(u);
  });
  it("loading 중의 소실·복구·재생성·tick 은 무시한다(불러오기 실패는 loadError 로만 알린다)", () => {
    for (const e of [{ t: "lost", at: 1 }, { t: "restored" }, { t: "recreated" }, { t: "tick", now: 1e9 }, { t: "visible", contextLost: true, at: 1 }] as MapStatusEvent[]) {
      expect(mapStatusReducer(initialMapStatus, e)).toBe(initialMapStatus);
    }
  });
  it("ready 에 다시 ready·loadError·retry·unsupported 가 와도 그대로", () => {
    const r = ready();
    for (const e of [{ t: "ready" }, { t: "loadError" }, { t: "retry" }, { t: "unsupported" }, { t: "restored" }, { t: "recreated" }] as MapStatusEvent[]) {
      expect(mapStatusReducer(r, e)).toBe(r);
    }
  });
});

describe("소실과 복구", () => {
  it("ready + lost(at 1000) → lost(lostAt 1000)", () => {
    expect(lostAt(1000)).toEqual({ status: "lost", lostAt: 1000 });
  });
  it("lost + restored → ready(lostAt null)", () => {
    expect(mapStatusReducer(lostAt(1000), { t: "restored" })).toEqual({ status: "ready", lostAt: null });
  });
  it("소실 직후(같은 ms)에 복구돼도 ready 로 돌아온다", () => {
    expect(run([{ t: "ready" }, { t: "lost", at: 7 }, { t: "restored" }])).toEqual({ status: "ready", lostAt: null });
  });
  it("소실 중 다시 소실이 와도 처음 소실 시각을 지키고 같은 객체를 돌려준다", () => {
    const s = lostAt(1000);
    expect(mapStatusReducer(s, { t: "lost", at: 2500 })).toBe(s);
  });
  it("복구 뒤 다시 소실되면 새 소실 시각으로 시작한다", () => {
    expect(run([{ t: "ready" }, { t: "lost", at: 1000 }, { t: "restored" }, { t: "lost", at: 9000 }])).toEqual({ status: "lost", lostAt: 9000 });
  });
  it("recreating 도중 restored 가 와도 ready 로 돌아온다", () => {
    const rec = mapStatusReducer(lostAt(1000), { t: "tick", now: 4000 });
    expect(rec.status).toBe("recreating");
    expect(mapStatusReducer(rec, { t: "restored" })).toEqual({ status: "ready", lostAt: null });
  });
  it("ready 에서 tick 은 아무 일도 없다", () => {
    const r = ready();
    expect(mapStatusReducer(r, { t: "tick", now: 123456 })).toBe(r);
  });
});

describe("3초 재생성·5초 실패 경계", () => {
  it("lost(1000) + tick(3999) → lost (같은 객체)", () => {
    const s = lostAt(1000);
    expect(mapStatusReducer(s, { t: "tick", now: 3999 })).toBe(s);
  });
  it("lost(1000) + tick(4000) → recreating 이고 shouldRecreate(prev, next) 가 참", () => {
    const prev = lostAt(1000);
    const next = mapStatusReducer(prev, { t: "tick", now: 4000 });
    expect(next).toEqual({ status: "recreating", lostAt: 1000 });
    expect(shouldRecreate(prev, next)).toBe(true);
  });
  it("recreating + recreated → ready(lostAt null)", () => {
    const rec = run([{ t: "ready" }, { t: "lost", at: 1000 }, { t: "tick", now: 4000 }]);
    expect(mapStatusReducer(rec, { t: "recreated" })).toEqual({ status: "ready", lostAt: null });
  });
  it("재생성 중(recreating) tick(5999) → 그대로, tick(6000) → failed", () => {
    const rec = run([{ t: "ready" }, { t: "lost", at: 1000 }, { t: "tick", now: 4000 }]);
    expect(mapStatusReducer(rec, { t: "tick", now: 5999 })).toBe(rec);
    expect(mapStatusReducer(rec, { t: "tick", now: 6000 })).toEqual({ status: "failed", lostAt: 1000 });
  });
  it("tick 이 듬성듬성 와서 lost 에서 곧바로 6000 이 되면 재생성 없이 failed", () => {
    const next = mapStatusReducer(lostAt(1000), { t: "tick", now: 6000 });
    expect(next.status).toBe("failed");
    expect(shouldRecreate(lostAt(1000), next)).toBe(false);
  });
  it("failed 는 어떤 이벤트에도 그대로다(새로 고침만 남는다)", () => {
    const f = run([{ t: "ready" }, { t: "lost", at: 1000 }, { t: "tick", now: 6000 }]);
    for (const e of [{ t: "restored" }, { t: "recreated" }, { t: "ready" }, { t: "retry" }, { t: "lost", at: 7000 }, { t: "tick", now: 9e9 }, { t: "visible", contextLost: false, at: 7000 }] as MapStatusEvent[]) {
      expect(mapStatusReducer(f, e)).toBe(f);
    }
  });
  it("소실 시각이 0 이어도 경계는 같다 (lostAt 0 은 시각 없음이 아니다)", () => {
    const s = lostAt(0);
    expect(s).toEqual({ status: "lost", lostAt: 0 });
    expect(mapStatusReducer(s, { t: "tick", now: 2999 })).toBe(s);
    expect(mapStatusReducer(s, { t: "tick", now: 3000 }).status).toBe("recreating");
    expect(mapStatusReducer(s, { t: "tick", now: 5000 }).status).toBe("failed");
  });
});

describe("shouldRecreate (T-06-06: 소실 한 번에 재생성 한 번)", () => {
  it("lost → recreating 전이일 때만 참이다", () => {
    const l = lostAt(1000);
    const rec = { status: "recreating", lostAt: 1000 } as const;
    expect(shouldRecreate(l, rec)).toBe(true);
    expect(shouldRecreate(rec, rec)).toBe(false);
    expect(shouldRecreate(initialMapStatus, ready())).toBe(false);
    expect(shouldRecreate(rec, { status: "ready", lostAt: null })).toBe(false);
    expect(shouldRecreate(l, l)).toBe(false);
    expect(shouldRecreate(rec, { status: "failed", lostAt: 1000 })).toBe(false);
  });
  it("소실 한 번에 일어나는 재생성은 정확히 한 번이다 (tick 을 1ms 마다 5100번 흘려도)", () => {
    let s = lostAt(1000);
    let count = 0;
    for (let now = 1000; now <= 6100; now += 1) {
      const next = mapStatusReducer(s, { t: "tick", now });
      if (shouldRecreate(s, next)) count++;
      s = next;
    }
    expect(count).toBe(1);
    expect(s.status).toBe("failed");
  });
  it("소실이 반복돼도 소실마다 한 번씩만 재생성한다 (복구 → 소실 → 재생성)", () => {
    let s = lostAt(0);
    let count = 0;
    const step = (e: MapStatusEvent) => {
      const next = mapStatusReducer(s, e);
      if (shouldRecreate(s, next)) count++;
      s = next;
    };
    step({ t: "tick", now: 3000 });
    step({ t: "recreated" });
    step({ t: "lost", at: 10000 });
    step({ t: "tick", now: 13000 });
    step({ t: "tick", now: 13001 });
    expect(count).toBe(2);
  });
});

describe("숨김 중 소실 (visible 이벤트)", () => {
  it("ready + visible(contextLost true, at 2000) → lost(2000)", () => {
    expect(mapStatusReducer(ready(), { t: "visible", contextLost: true, at: 2000 })).toEqual({ status: "lost", lostAt: 2000 });
  });
  it("ready + visible(contextLost false) → 그대로(같은 객체)", () => {
    const r = ready();
    expect(mapStatusReducer(r, { t: "visible", contextLost: false, at: 2000 })).toBe(r);
  });
  it("이미 lost 인데 다시 보이면서 여전히 소실이면 숨겨 둔 시간은 세지 않고 지금부터 센다", () => {
    const s = lostAt(1000);
    const again = mapStatusReducer(s, { t: "visible", contextLost: true, at: 30000 });
    expect(again).toEqual({ status: "lost", lostAt: 30000 });
    expect(mapStatusReducer(again, { t: "tick", now: 30500 })).toBe(again);
  });
  it("recreating 중 visible(true) 는 재생성 시계를 되돌리지 않는다 (재생성은 한 번)", () => {
    const rec = run([{ t: "ready" }, { t: "lost", at: 1000 }, { t: "tick", now: 4000 }]);
    expect(mapStatusReducer(rec, { t: "visible", contextLost: true, at: 4100 })).toBe(rec);
  });
  it("lost 에서 visible(false) 는 그대로(복구는 restored 이벤트로만)", () => {
    const l = lostAt(1000);
    expect(mapStatusReducer(l, { t: "visible", contextLost: false, at: 2000 })).toBe(l);
  });
});

describe("inputBlocked", () => {
  it("ready 만 입력이 열려 있다", () => {
    const states: MapStatusState[] = [
      initialMapStatus,
      ready(),
      lostAt(1),
      { status: "recreating", lostAt: 1 },
      { status: "failed", lostAt: 1 },
      { status: "loadFailed", lostAt: null },
      { status: "unsupported", lostAt: null },
    ];
    expect(states.map(inputBlocked)).toEqual([true, false, true, true, true, true, true]);
  });
});

describe("isSoftwareRenderer", () => {
  it("SwiftShader · llvmpipe · Software 는 소프트웨어 렌더러다", () => {
    expect(isSoftwareRenderer("Google SwiftShader")).toBe(true);
    expect(isSoftwareRenderer("llvmpipe (LLVM 15.0.7, 256 bits)")).toBe(true);
    expect(isSoftwareRenderer("Software Rasterizer")).toBe(true);
    expect(isSoftwareRenderer("ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)")).toBe(true);
  });
  it("대소문자는 가리지 않는다", () => {
    expect(isSoftwareRenderer("SWIFTSHADER")).toBe(true);
    expect(isSoftwareRenderer("LLVMPIPE")).toBe(true);
  });
  it("실제 GPU 는 아니다", () => {
    expect(isSoftwareRenderer("Apple GPU")).toBe(false);
    expect(isSoftwareRenderer("ANGLE (Apple, ANGLE Metal Renderer: Apple M3 Pro, Unspecified Version)")).toBe(false);
    expect(isSoftwareRenderer("Mali-G78")).toBe(false);
    expect(isSoftwareRenderer("")).toBe(false);
  });
});

describe("MAP_STATUS_COPY (UI-SPEC Copywriting Contract, 글자 그대로)", () => {
  it("맵을 불러오는 중…", () => {
    expect(MAP_STATUS_COPY.loading).toEqual({ title: "맵을 불러오는 중…" });
  });
  it("맵을 불러오지 못했어요 / 네트워크를 확인해 주세요 / 다시 시도", () => {
    expect(MAP_STATUS_COPY.loadFailed).toEqual({ title: "맵을 불러오지 못했어요", body: "네트워크를 확인해 주세요", action: "다시 시도" });
  });
  it("이 기기에서는 맵을 열 수 없어요 / 다른 브라우저로 열어 주세요 / 나가기", () => {
    expect(MAP_STATUS_COPY.unsupported).toEqual({ title: "이 기기에서는 맵을 열 수 없어요", body: "다른 브라우저로 열어 주세요", action: "나가기" });
  });
  it("화면을 다시 그리는 중…", () => {
    expect(MAP_STATUS_COPY.redrawing).toEqual({ title: "화면을 다시 그리는 중…" });
  });
  it("화면을 다시 그리지 못했어요 / 새로 고침", () => {
    expect(MAP_STATUS_COPY.failed).toEqual({ title: "화면을 다시 그리지 못했어요", action: "새로 고침" });
  });
  it("말투 규칙: 마침표 없음, 느낌표 없음", () => {
    for (const c of Object.values(MAP_STATUS_COPY)) {
      for (const t of [c.title, c.body ?? "", c.action ?? ""]) {
        expect(t).not.toMatch(/[.!]/);
      }
    }
  });
});

describe("status.ts 소스 규약", () => {
  it("현재 시각·난수·타이머를 부르지 않는다 (시각은 이벤트 인자로만)", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("src/world/status.ts", "utf8")
      .split("\n")
      .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*") && !l.trim().startsWith("/*"))
      .join("\n");
    expect(src).not.toMatch(/Date\.now|new Date|performance\.now|Math\.random|setTimeout|setInterval|location\./);
  });
});
