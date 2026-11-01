// E2E 순수 도우미(scripts/e2e/lib.mjs)와 앱 상수의 동일성 (05-05, T-05-12).
// 두 목록이 어긋나면 UX1(안내·타이머 검사)이 거짓 통과·거짓 실패한다 — scenes.test.ts 의 EXPECTED_SCENE 비교와 같은 방식.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { BAR_MASK } from "../../shared/game/map";
import { candidateRevealMs } from "../../shared/game/phases";
import { NICKNAME_MAX_GRAPHEMES, countGraphemes } from "../../shared/nickname";
import { TIMELESS_PHASES } from "../../src/game/scenes";
import { BLANK_TAP_SLOP_PX } from "../../src/game/blankTap";
import { EXEC_INTRO_MS, VERDICT_TEXT } from "../../src/game/verdict";
import { RESTORED_MS } from "../../src/net/linkReducer";
import { STAGE_SIZES } from "../../src/world/camera";
import { DRAW_CALL_BUDGET } from "../../src/world/renderer";
import { FAIL_AFTER_MS, MAP_STATUS_COPY, RECREATE_AFTER_MS } from "../../src/world/status";
// 타입 선언이 없는 .mjs 다(allowJs 없음).
// @ts-expect-error -- 선언 없는 스크립트 모듈
import * as e2eLib from "../../scripts/e2e/lib.mjs";

describe("E2E 의 TIMELESS_PHASES 와 앱 상수", () => {
  it("scripts/e2e/lib.mjs 의 TIMELESS_PHASES 가 src/game/scenes.ts 의 같은 이름 상수와 같은 목록이다", () => {
    const e2e = (e2eLib as { TIMELESS_PHASES: readonly string[] }).TIMELESS_PHASES;
    expect(Array.isArray(e2e)).toBe(true);
    expect([...e2e].sort()).toEqual([...TIMELESS_PHASES].sort());
    expect(e2e.length).toBe(TIMELESS_PHASES.length);
  });
});

describe("E2E 의 시간 사본과 앱 상수 (결정 0039)", () => {
  it("INTRO_GONE_MS = EXEC_INTRO_MS + 200 (측정 여유는 예전과 같다)", () => {
    expect((e2eLib as { INTRO_GONE_MS: number }).INTRO_GONE_MS).toBe(EXEC_INTRO_MS + 200);
  });

  it("candidateRevealMs(n) 사본이 shared/game/phases 와 n = 0..8 에서 같다", () => {
    const copy = (e2eLib as { candidateRevealMs: (n: number) => number }).candidateRevealMs;
    for (let n = 0; n <= 8; n += 1) expect(copy(n)).toBe(candidateRevealMs(n));
  });
});

describe("E2E 의 후보 선택 안내·빈 곳 여유 사본 (결정 0040)", () => {
  it("CANDIDATE_GUIDE 가 VERDICT_TEXT 의 두 안내 문장과 같다", () => {
    const copy = (e2eLib as { CANDIDATE_GUIDE: { none: string; picked: string } }).CANDIDATE_GUIDE;
    expect(copy.none).toBe(VERDICT_TEXT.candidateGuideNone);
    expect(copy.picked).toBe(VERDICT_TEXT.candidateGuidePicked);
  });

  it("BLANK_TAP_E2E_MARGIN 은 앱 여유(BLANK_TAP_SLOP_PX)의 두 배 이상이다 (측정 점이 분명히 빈 곳)", () => {
    expect((e2eLib as { BLANK_TAP_E2E_MARGIN: number }).BLANK_TAP_E2E_MARGIN).toBeGreaterThanOrEqual(2 * BLANK_TAP_SLOP_PX);
  });
});

describe("E2E 의 로비 크기 목록과 앱 상수 (06-17, 결정 0052)", () => {
  type Size = { w: number; h: number; label: string };
  const lib = e2eLib as { LOBBY_SIZES: readonly Size[]; DEFAULT_SIZES: readonly Size[]; LOBBY_EXTRA_SIZES: readonly Size[] };

  it("LOBBY_SIZES 의 w·h·label 이 src/world/camera.ts 의 STAGE_SIZES 와 같다 (순서까지)", () => {
    expect(lib.LOBBY_SIZES.length).toBe(STAGE_SIZES.length);
    expect(lib.LOBBY_SIZES.map((s) => ({ w: s.w, h: s.h, label: s.label }))).toEqual(STAGE_SIZES.map((s) => ({ w: s.w, h: s.h, label: s.label })));
  });

  it("LOBBY_SIZES 는 DEFAULT_SIZES(v1.0 게임 흐름, 그대로 4개) + 390x844 + 402x874 이고 LOBBY_EXTRA_SIZES 는 그 두 개다", () => {
    expect(lib.DEFAULT_SIZES.map((s) => s.label)).toEqual(["360x640", "390x664", "430x932", "360x560"]);
    expect(lib.LOBBY_SIZES.slice(0, lib.DEFAULT_SIZES.length)).toEqual([...lib.DEFAULT_SIZES]);
    expect(lib.LOBBY_EXTRA_SIZES.map((s) => s.label)).toEqual(["390x844", "402x874"]);
  });
});

describe("E2E 가 shared/game/map.ts 원문에서 읽는 걸을 수 있는 칸 (06-17)", () => {
  const lib = e2eLib as { parseBarMask: (src: string) => string[]; walkableCenters: (rows: string[]) => { x: number; z: number }[]; graphemeCount: (t: string) => number };

  it("parseBarMask(map.ts 원문) 이 BAR_MASK 와 같다 — E2E 가 목적지를 고르는 마스크가 앱의 것과 어긋나지 않는다", () => {
    const source = readFileSync(new URL("../../shared/game/map.ts", import.meta.url), "utf8");
    expect(lib.parseBarMask(source)).toEqual([...BAR_MASK]);
  });

  it("walkableCenters 의 칸 수가 BAR_MASK 의 '.' 개수와 같고 모든 중심이 −6.75 ~ 6.75 안이다", () => {
    const dots = BAR_MASK.join("").split(".").length - 1;
    const centers = lib.walkableCenters([...BAR_MASK]);
    expect(centers.length).toBe(dots);
    for (const c of centers) {
      expect(Math.abs(c.x)).toBeLessThanOrEqual(6.75);
      expect(Math.abs(c.z)).toBeLessThanOrEqual(6.75);
    }
  });

  it("E2E 의 graphemeCount 가 앱의 countGraphemes 와 같은 값을 낸다 (8자 닉네임 경계)", () => {
    for (const t of ["방장이름여덟글자", "😀😃😄😁😆😅🤣😂", "화면검사기", "e\u0301", "가나다라마바사아", "ab"]) {
      expect(lib.graphemeCount(t)).toBe(countGraphemes(t));
    }
    expect(lib.graphemeCount("방장이름여덟글자")).toBe(NICKNAME_MAX_GRAPHEMES);
  });
});

describe("E2E 재접속·예산 사본과 앱 상수 (06-18)", () => {
  const lib = e2eLib as { DRAW_CALL_BUDGET: number; RESTORED_GONE_MS: number; isWorldChunkUrl: (u: string) => boolean };

  it("DRAW_CALL_BUDGET 사본이 src/world/renderer.ts 의 DRAW_CALL_BUDGET 과 같다 (예산을 낮춰도 E2E 가 따라온다)", () => {
    expect(lib.DRAW_CALL_BUDGET).toBe(DRAW_CALL_BUDGET);
  });

  it("RESTORED_GONE_MS 는 앱의 띠 유지 시간(RESTORED_MS) 보다 길다 — 복구 뒤 이 시간에 띠가 남았으면 앱이 못 지운 것이다", () => {
    expect(lib.RESTORED_GONE_MS).toBeGreaterThan(RESTORED_MS);
  });

  it("복구 대기 상한(15초)이 앱의 재생성(3초)·포기(5초) 시각보다 충분히 크다", () => {
    expect(RECREATE_AFTER_MS).toBeLessThan(FAIL_AFTER_MS);
    expect(FAIL_AFTER_MS + 2_000 + RECREATE_AFTER_MS).toBeLessThan(15_000);
  });

  it("청크 실패 카드의 제목이 E2E 가 기다리는 글자와 같다", () => {
    expect(MAP_STATUS_COPY.loadFailed.title).toBe("맵을 불러오지 못했어요");
    expect(MAP_STATUS_COPY.loadFailed.action).toBe("다시 시도");
  });

  it("isWorldChunkUrl 이 runtime.ts 가 import() 하는 두 모듈(threeRenderer·character)의 개발 서버 주소를 잡는다", () => {
    const source = readFileSync(new URL("../../src/world/runtime.ts", import.meta.url), "utf8");
    const modules = [...source.matchAll(/import\("\.\/(\w+)"\)/g)].map((m) => m[1]);
    expect(modules.sort()).toEqual(["character", "threeRenderer"]);
    for (const m of modules) expect(lib.isWorldChunkUrl(`http://localhost:5173/src/world/${m}.ts`)).toBe(true);
  });
});
