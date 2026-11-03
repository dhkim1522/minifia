// E2E 순수 도우미(scripts/e2e/lib.mjs)와 앱 상수의 동일성 (05-05, T-05-12).
// 두 목록이 어긋나면 UX1(안내·타이머 검사)이 거짓 통과·거짓 실패한다 — scenes.test.ts 의 EXPECTED_SCENE 비교와 같은 방식.
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { BAR_MASK } from "../../shared/game/map";
import { MOVE_SPEED } from "../../shared/game/world";
import { NICKNAME_MAX_GRAPHEMES, countGraphemes } from "../../shared/nickname";
import { TIMELESS_PHASES } from "../../src/game/scenes";
import {
  CHAT_PANEL_EXTRA,
  KB_PANEL_H,
  LOBBY_PANEL_EXTRA,
  LOG_H_KB,
  LOG_H_SHORT,
  LOG_H_TALL,
  TALL_ROOM_MIN_H,
  TYPING_PILL_H,
  lobbyPanelHeight,
  logHeightFor,
} from "../../src/game/chatUi";
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

describe("E2E 채팅 패널 치수 사본과 src/game/chatUi.ts (07-20, 05-05 사본 일치 규약)", () => {
  // 08-23: 옛 테이블 사본(TABLE_PANEL_EXTRA·tablePanelHeight·expectedPanelH·PANEL_H 157)은 지웠다 — 사본 이름은 앱과 같은 CHAT_PANEL_EXTRA 다.
  type ChatCopy = {
    LOG_H_SHORT: number;
    LOG_H_TALL: number;
    LOG_H_KB: number;
    TALL_ROOM_MIN_H: number;
    LOBBY_PANEL_EXTRA: number;
    CHAT_PANEL_EXTRA: number;
    KB_PANEL_H: number;
    TYPING_PILL_H: number;
    logHeightFor: (roomH: number) => number;
    lobbyPanelHeight: (logH: number) => number;
  };
  const lib = e2eLib as unknown as ChatCopy;

  it("상수 여덟 개가 chatUi 와 같다(LOBBY_PANEL_EXTRA·CHAT_PANEL_EXTRA·KB_PANEL_H 포함)", () => {
    expect(lib.LOG_H_SHORT).toBe(LOG_H_SHORT);
    expect(lib.LOG_H_TALL).toBe(LOG_H_TALL);
    expect(lib.LOG_H_KB).toBe(LOG_H_KB);
    expect(lib.TALL_ROOM_MIN_H).toBe(TALL_ROOM_MIN_H);
    expect(lib.LOBBY_PANEL_EXTRA).toBe(LOBBY_PANEL_EXTRA);
    expect(lib.CHAT_PANEL_EXTRA).toBe(CHAT_PANEL_EXTRA);
    expect(lib.KB_PANEL_H).toBe(KB_PANEL_H);
    expect(lib.TYPING_PILL_H).toBe(TYPING_PILL_H);
  });

  it("지운 테이블 상수의 사본은 lib 에 없다(TABLE_PANEL_EXTRA·PANEL_H·tablePanelHeight·expectedPanelH)", () => {
    const keys = Object.keys(e2eLib as Record<string, unknown>);
    for (const gone of ["TABLE_PANEL_EXTRA", "PANEL_H", "HEADER_H", "tablePanelHeight", "expectedPanelH"]) expect(keys).not.toContain(gone);
  });

  it("logHeightFor 가 경계 779·780 을 포함한 방 높이에서 chatUi 와 같은 값을 낸다", () => {
    for (const h of [0, 560, 640, 664, 779, 780, 844, 874, 932, 2000]) expect(lib.logHeightFor(h)).toBe(logHeightFor(h));
    expect(lib.logHeightFor(779)).toBe(LOG_H_SHORT);
    expect(lib.logHeightFor(780)).toBe(LOG_H_TALL);
  });

  it("GAME_PANEL_EXTRA 의 채팅(92)·토론(154)은 앱의 CHAT_PANEL_EXTRA·LOBBY_PANEL_EXTRA 와 같고, 찬반 두 값(203·111)은 UI-SPEC 표 값 그대로다 (08-23)", () => {
    const extra = (e2eLib as unknown as { GAME_PANEL_EXTRA: Record<string, number>; gamePanelHeight: (h: number, k: string) => number }).GAME_PANEL_EXTRA;
    const gamePanelHeight = (e2eLib as unknown as { gamePanelHeight: (h: number, k: string) => number }).gamePanelHeight;
    expect(extra.chat).toBe(CHAT_PANEL_EXTRA);
    expect(extra.talk).toBe(LOBBY_PANEL_EXTRA);
    expect(extra.verdictVoter).toBe(203);
    expect(extra.verdictViewer).toBe(111);
    for (const roomH of [560, 640, 664, 779, 780, 844, 874, 932]) {
      expect(gamePanelHeight(roomH, "chat")).toBe(logHeightFor(roomH) + CHAT_PANEL_EXTRA);
      expect(gamePanelHeight(roomH, "talk")).toBe(logHeightFor(roomH) + LOBBY_PANEL_EXTRA);
    }
  });

  it("lobbyPanelHeight 사본이 chatUi 와 같고, 채팅 패널 높이는 logH + CHAT_PANEL_EXTRA 다", () => {
    for (const logH of [LOG_H_SHORT, LOG_H_TALL, LOG_H_KB]) expect(lib.lobbyPanelHeight(logH)).toBe(lobbyPanelHeight(logH));
    for (const roomH of [560, 640, 664, 779, 780, 844, 932]) expect(lib.logHeightFor(roomH) + lib.CHAT_PANEL_EXTRA).toBe(logHeightFor(roomH) + CHAT_PANEL_EXTRA);
  });
});

describe("E2E 의 걷는 속도 상수와 앱 MOVE_SPEED (결정 0059, G-07-9)", () => {
  it("WORLD_MOVE_SPEED 는 shared/game/world.ts 의 MOVE_SPEED 와 같고 WORLD_JUMP_SPEED_MAX 는 그 3배다", () => {
    const lib = e2eLib as { WORLD_MOVE_SPEED: number; WORLD_JUMP_SPEED_MAX: number };
    expect(lib.WORLD_MOVE_SPEED).toBe(MOVE_SPEED);
    expect(lib.WORLD_JUMP_SPEED_MAX).toBeCloseTo(3 * MOVE_SPEED, 9);
  });
});

describe("9페이즈 E2E 표식·패널(09-21)", () => {
  const lib = e2eLib as unknown as { NIGHT_MARKERS: readonly string[]; GAME_PANEL_EXTRA: Record<string, number> };

  // git 이 추적하는 src/ 파일만 읽는다(내려받은 파일·생성물이 표식을 우연히 담아도 통과시키지 않는다).
  const root = new URL("../../", import.meta.url);
  const tracked = execFileSync("git", ["ls-files", "src"], { cwd: root, encoding: "utf8" })
    .split("\n")
    .filter((f) => /\.(tsx?|css)$/.test(f));
  const sources = tracked.map((f) => ({ f, text: readFileSync(new URL(f, root), "utf8") }));

  it("NIGHT_MARKERS 가 11개이고 각 표식이 src/ 추적 파일 어딘가에 있다(표식 이름 오타 방지)", () => {
    expect(tracked.length).toBeGreaterThan(20);
    expect(lib.NIGHT_MARKERS.length).toBe(11);
    const missing = lib.NIGHT_MARKERS.filter((m) => !sources.some((s) => s.text.includes(m)));
    expect(missing).toEqual([]);
  });

  it("lib 의 nightMafia 덧셈이 앱 LOBBY_PANEL_EXTRA(154)와 같다 — 어긋나면 E2E 가 거짓 통과·거짓 실패한다", () => {
    expect(lib.GAME_PANEL_EXTRA.nightMafia).toBe(LOBBY_PANEL_EXTRA);
    expect(lib.GAME_PANEL_EXTRA.nightMafia).toBe(lib.GAME_PANEL_EXTRA.talk);
  });
});
