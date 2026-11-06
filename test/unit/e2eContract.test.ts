// E2E 순수 도우미(scripts/e2e/lib.mjs)와 앱 상수의 동일성 (05-05, T-05-12).
// 두 목록이 어긋나면 UX1(안내·타이머 검사)이 거짓 통과·거짓 실패한다 — scenes.test.ts 의 EXPECTED_SCENE 비교와 같은 방식.
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { BAR_MASK } from "../../shared/game/map";
import { NOMINATION_END_MS, NOMINATION_GATHER_MS, NOMINATION_MS, PICK_GAP_MS, PICK_TURN_MS, SHOWDOWN_GATHER_MS, SHOWDOWN_POINT_MS, SHOWDOWN_REVEAL_MS, SHOWDOWN_TURN_MS, nominationMaxMs } from "../../shared/game/phases";
import { MOVE_SPEED } from "../../shared/game/world";
import { NICKNAME_MAX_GRAPHEMES, countGraphemes } from "../../shared/nickname";
import { ANNOUNCE_MORNING_AT } from "../../src/game/dayView";
import { TIMELESS_PHASES } from "../../src/game/scenes";
import { SOUND_PREF_KEY, SOUND_PREF_VERSION, loadSoundPref } from "../../src/audio/prefs";
import { SOUND_IDS } from "../../src/audio/recipes";
import { SOUND_LIMITS } from "../../src/debug/soundLabTable";
import { LETTER_END_AT_MS, LETTER_FOLD_AT_MS, SEAL_GLYPH } from "../../src/game/willLetter";
import { RESULT_PANEL_TEXT, RESULT_TABS } from "../../src/game/resultText";
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
// @ts-expect-error -- 선언 없는 스크립트 모듈
import * as perfRun from "../../scripts/perf-run.mjs";
// @ts-expect-error -- 선언 없는 스크립트 모듈
import * as resultE2e from "../../scripts/e2e/result.mjs";
// @ts-expect-error -- 선언 없는 스크립트 모듈
import * as mapSelectE2e from "../../scripts/e2e/mapselect.mjs";
import { HOST_LINES } from "../../src/game/hostLine";
import { ROLE_TEXT } from "../../src/game/roleText";
import { CEREMONY_TITLE } from "../../src/game/awardText";
import { RESULT_TEXT } from "../../src/game/verdict";
import { JOB_OUTFIT } from "../../src/world/ghostOutfit";
import { CHAT_PANEL_EXTRA as RESULT_CHAT_EXTRA } from "../../src/game/chatUi";

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

  it("GAME_PANEL_EXTRA 의 채팅(92)·토론(154)은 앱의 CHAT_PANEL_EXTRA·LOBBY_PANEL_EXTRA 와 같고, 찬반 두 값(218·126)은 UI-SPEC 표 값에 숫자 줄 +15 를 더한 값이다(0062-2) (08-23)", () => {
    const extra = (e2eLib as unknown as { GAME_PANEL_EXTRA: Record<string, number>; gamePanelHeight: (h: number, k: string) => number }).GAME_PANEL_EXTRA;
    const gamePanelHeight = (e2eLib as unknown as { gamePanelHeight: (h: number, k: string) => number }).gamePanelHeight;
    expect(extra.chat).toBe(CHAT_PANEL_EXTRA);
    expect(extra.talk).toBe(LOBBY_PANEL_EXTRA);
    expect(extra.verdictVoter).toBe(218);
    expect(extra.verdictViewer).toBe(126);
    // 14-06(TOOL-01): 입력줄 이름표 단추(면 36 + 간격 4 + 라벨 14px × 1.4)가 입력칸 48 보다 11.6 커서 패널이 그만큼 는다 — 판정이 이 값을 더한다
    const toolRow = (e2eLib as unknown as { TOOL_ROW_EXTRA: number }).TOOL_ROW_EXTRA;
    expect(toolRow).toBeCloseTo(36 + 4 + 14 * 1.4 - 48, 9);
    const css = readFileSync(new URL("src/styles/v2.css", new URL("../../", import.meta.url)), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const rule = (sel: string) => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find((m) => (m[1] ?? "").trim() === sel)?.[2] ?? "";
    expect(rule(".mv-tool__face")).toContain("width: 36px");
    expect(rule(".mv-tool__face")).toContain("height: 36px");
    expect(rule(".mv-tool__label")).toContain("font-size: 14px");
    expect(rule(".mv-tool__label")).toContain("line-height: 1.4");
    for (const roomH of [560, 640, 664, 779, 780, 844, 874, 932]) {
      expect(gamePanelHeight(roomH, "chat")).toBeCloseTo(logHeightFor(roomH) + CHAT_PANEL_EXTRA + toolRow, 9);
      expect(gamePanelHeight(roomH, "talk")).toBeCloseTo(logHeightFor(roomH) + LOBBY_PANEL_EXTRA + toolRow, 9);
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

describe("E2E 의 순차 지목 시간 상수와 앱 상수 (09.1-08, 결정 0063-1)", () => {
  const lib = e2eLib as {
    NOMINATION_GATHER_MS: number;
    NOMINATION_MS: number;
    PICK_TURN_MS: number;
    PICK_GAP_MS: number;
    NOMINATION_END_MS: number;
    nominationMaxMs: (n: number) => number;
  };

  it("scripts/e2e/lib.mjs 의 네 상수가 shared/game/phases.ts 의 같은 이름 상수와 같다", () => {
    expect(lib.NOMINATION_GATHER_MS).toBe(NOMINATION_GATHER_MS);
    expect(lib.PICK_TURN_MS).toBe(PICK_TURN_MS);
    expect(lib.PICK_GAP_MS).toBe(PICK_GAP_MS);
    expect(lib.NOMINATION_END_MS).toBe(NOMINATION_END_MS);
  });

  it("기본판 투표(동시) 길이 NOMINATION_MS 사본이 앱 상수와 같다 (13-05)", () => {
    expect(lib.NOMINATION_MS).toBe(NOMINATION_MS);
  });

  it("nominationMaxMs 가 차례 수 1~8 에서 앱 함수와 같은 값을 낸다", () => {
    for (let n = 1; n <= 8; n++) expect(lib.nominationMaxMs(n)).toBe(nominationMaxMs(n));
  });
});

describe("E2E 의 마지막 3인 시간 상수와 앱 상수 (09.1.1-16)", () => {
  const lib = e2eLib as { SHOWDOWN_GATHER_MS: number; SHOWDOWN_TURN_MS: number; SHOWDOWN_POINT_MS: number; SHOWDOWN_REVEAL_MS: number; PICK_GAP_MS: number };

  it("SHOWDOWN_* 네 상수와 사이 PICK_GAP_MS 가 shared/game/phases.ts 의 같은 이름 상수와 같다", () => {
    expect(lib.SHOWDOWN_GATHER_MS).toBe(SHOWDOWN_GATHER_MS);
    expect(lib.SHOWDOWN_TURN_MS).toBe(SHOWDOWN_TURN_MS);
    expect(lib.SHOWDOWN_POINT_MS).toBe(SHOWDOWN_POINT_MS);
    expect(lib.SHOWDOWN_REVEAL_MS).toBe(SHOWDOWN_REVEAL_MS);
    expect(lib.PICK_GAP_MS).toBe(PICK_GAP_MS);
  });
});

describe("E2E 의 유언 편지 상수와 앱 상수 (09.1-11)", () => {
  const lib = e2eLib as { LETTER_FOLD_AT_MS: number; LETTER_END_AT_MS: number; ANNOUNCE_MORNING_AT: number; SEAL_GLYPH: string };

  it("LETTER_FOLD_AT_MS·LETTER_END_AT_MS·ANNOUNCE_MORNING_AT·SEAL_GLYPH 가 앱 상수와 같다", () => {
    expect(lib.LETTER_FOLD_AT_MS).toBe(LETTER_FOLD_AT_MS);
    expect(lib.LETTER_END_AT_MS).toBe(LETTER_END_AT_MS);
    expect(lib.ANNOUNCE_MORNING_AT).toBe(ANNOUNCE_MORNING_AT);
    expect(lib.SEAL_GLYPH).toBe(SEAL_GLYPH);
  });
});

describe("E2E 의 배지·귓속말 치수와 앱 CSS (09.1.1-10)", () => {
  const lib = e2eLib as {
    FLOAT_SIZE: number;
    FLOAT_MARGIN: number;
    FLOAT_GAP: number;
    WHISPER_SHEET_H: number;
    CLAIM_BADGE_SIZE: number;
    CLAIM_ICON_SIZE: number;
    CLAIM_SWAP_SIZE: number;
    CLAIM_OUT_X: number;
    CLAIM_OUT_Y: number;
    SHEET_FONT_MIN: number;
    TAP_MIN: number;
  };
  const read = (f: string): string => readFileSync(new URL(f, import.meta.url), "utf8");
  const tokens = read("../../src/styles/tokens.css");
  const v2 = read("../../src/styles/v2.css");
  const game = read("../../src/styles/game.css");
  const token = (name: string): number => {
    const m = new RegExp(`${name}:\\s*(\\d+)px`).exec(tokens);
    if (!m) throw new Error(`${name} 토큰을 못 찾음`);
    return Number(m[1]);
  };
  const rule = (css: string, selector: string): string => {
    const start = css.indexOf(`${selector} {`);
    if (start < 0) throw new Error(`${selector} 규칙을 못 찾음`);
    return css.slice(start, css.indexOf("}", start));
  };

  it("떠 있는 버튼 지름·여백·간격이 --control-input·--space-md·--space-sm 토큰과 같고 CSS 가 그 토큰을 쓴다", () => {
    expect(lib.FLOAT_SIZE).toBe(token("--control-input"));
    expect(lib.FLOAT_MARGIN).toBe(token("--space-md"));
    expect(lib.FLOAT_GAP).toBe(token("--space-sm"));
    expect(rule(v2, ".mv-float")).toMatch(/width:\s*var\(--control-input\)/);
    expect(rule(game, ".mf-float")).toMatch(/right:\s*var\(--space-md\)/);
    expect(rule(game, ".mf-float")).toMatch(/gap:\s*var\(--space-sm\)/);
  });

  it("귓속말 시트 높이 124 = 안쪽 12 + 머리 44(--tap-min) + 간격 8 + 입력줄 48(--control-input) + 안쪽 12", () => {
    expect(lib.TAP_MIN).toBe(token("--tap-min"));
    expect(lib.WHISPER_SHEET_H).toBe(12 + token("--tap-min") + token("--space-sm") + token("--control-input") + 12);
    expect(rule(v2, ".mv-line-sheet")).toMatch(/padding:\s*12px/);
    expect(rule(v2, ".mv-line__head")).toMatch(/height:\s*var\(--tap-min\)/);
    expect(rule(v2, ".mv-line__row")).toMatch(/height:\s*var\(--control-input\)/);
  });

  it("배지 지름 20·말 바꿈 점 16·바깥 4(--space-xs)·위 −8 이 .mv-claim CSS 와 같다", () => {
    const claim = rule(v2, ".mv-claim");
    expect(claim).toMatch(new RegExp(`width:\\s*${lib.CLAIM_BADGE_SIZE}px`));
    expect(claim).toMatch(new RegExp(`height:\\s*${lib.CLAIM_BADGE_SIZE}px`));
    expect(claim).toMatch(new RegExp(`top:\\s*${lib.CLAIM_OUT_Y}px`));
    expect(claim).toMatch(/right:\s*calc\(var\(--space-xs\) \* -1\)/);
    expect(lib.CLAIM_OUT_X).toBe(token("--space-xs"));
    const swap = rule(v2, ".mv-claim__swap");
    expect(swap).toMatch(new RegExp(`width:\\s*${lib.CLAIM_SWAP_SIZE}px`));
    expect(swap).toMatch(new RegExp(`height:\\s*${lib.CLAIM_SWAP_SIZE}px`));
  });

  it("배지 아이콘 크기가 ClaimBadge.tsx 의 V2Icon size 와 같고 시트 글자 하한 14 는 시트 CSS 의 가장 작은 글자와 같다", () => {
    const badge = read("../../src/components/v2/ClaimBadge.tsx");
    expect(badge).toContain(`size={${lib.CLAIM_ICON_SIZE}}`);
    expect(rule(v2, ".mv-claim-sheet__hint")).toMatch(new RegExp(`font-size:\\s*${lib.SHEET_FONT_MIN}px`));
    expect(rule(v2, ".mv-line__count")).toMatch(new RegExp(`font-size:\\s*${lib.SHEET_FONT_MIN}px`));
  });
});

describe("10페이즈 E2E 표식(10-05)", () => {
  const lib = e2eLib as unknown as { AVATAR_MARKERS: readonly string[] };
  const root = new URL("../../", import.meta.url);
  const tracked = execFileSync("git", ["ls-files", "src"], { cwd: root, encoding: "utf8" })
    .split("\n")
    .filter((f) => /\.(tsx?|css)$/.test(f));
  const sources = tracked.map((f) => ({ f, text: readFileSync(new URL(f, root), "utf8") }));

  it("AVATAR_MARKERS 가 7개(동작 4 + 의상 3)이고 각 표식이 git 이 추적하는 src/ 파일 어딘가에 있다(표식 이름 오타 방지)", () => {
    expect(tracked.length).toBeGreaterThan(20);
    expect(lib.AVATAR_MARKERS.length).toBe(7);
    const missing = lib.AVATAR_MARKERS.filter((m) => !sources.some((s) => s.text.includes(m)));
    expect(missing).toEqual([]);
  });

  it("동작 표식은 ChatPanel·EmoteTray·testHooks 에 각각 있다", () => {
    const has = (file: string, marker: string) => sources.some((s) => s.f.endsWith(file) && s.text.includes(marker));
    expect(has("components/v2/ChatPanel.tsx", "data-emote-button")).toBe(true);
    expect(has("components/v2/EmoteTray.tsx", "data-emote-tray")).toBe(true);
    expect(has("components/v2/EmoteTray.tsx", "data-emote=")).toBe(true);
    expect(has("world/testHooks.ts", "__mfEmotes")).toBe(true);
  });

  it("의상 표식(10-07)은 DressSheet·Lobby 의 떠 있는 버튼·testHooks 에 각각 있다", () => {
    const has = (file: string, marker: string) => sources.some((s) => s.f.endsWith(file) && s.text.includes(marker));
    expect(has("components/v2/DressSheet.tsx", "data-dress-sheet")).toBe(true);
    expect(has("components/v2/DressSheet.tsx", "data-outfit=")).toBe(true);
    expect(has("components/v2/FloatAction.tsx", "data-float=")).toBe(true);
    expect(has("world/testHooks.ts", "__mfLooks")).toBe(true);
  });
});

describe("11페이즈 결과 화면 E2E 표식·표(11-05)", () => {
  const r = resultE2e as unknown as {
    RESULT_MARKERS: readonly string[];
    RESULT_JOB_OUTFIT: Record<string, string>;
    RESULT_WIN_TITLE: Record<string, string>;
    RESULT_PANEL_H: { short: number; tall: number; tallRoomMinH: number };
    AWARD_PLATE: { maxW: number; sideMargin: number; h: number; topGap: number; belowMin: number; float: number; floatRight: number; floatGap: number };
    AWARD_CEREMONY_TITLE: string;
    TIMELINE_CARD: { w: number; h: number; gap: number };
    READY_PILL: { w: number; h: number; inputExtra: number };
  };
  const root = new URL("../../", import.meta.url);
  const tracked = execFileSync("git", ["ls-files", "src"], { cwd: root, encoding: "utf8" })
    .split("\n")
    .filter((f) => /\.(tsx?|css)$/.test(f));
  const sources = tracked.map((f) => ({ f, text: readFileSync(new URL(f, root), "utf8") }));

  it("RESULT_MARKERS 가 git 이 추적하는 src/ 파일 어딘가에 있다(표식 이름 오타 방지)", () => {
    expect(r.RESULT_MARKERS).toEqual(["data-result-stage", "data-result-panel", "data-result-announce", "__mfResult", "data-result-tab", "data-result-dot", "data-result-divider", "data-award-plate", "data-award-id", "data-float-count", "data-day-card", "data-day-detail", "data-whisper-pair", "data-ready-pill", "data-ready", "data-ready-count", "data-bench-view"]);
    const missing = r.RESULT_MARKERS.filter((m) => !sources.some((s) => s.text.includes(m)));
    expect(missing).toEqual([]);
  });

  it("표식은 결과 화면·테스트 훅에 각각 있다", () => {
    const has = (file: string, marker: string) => sources.some((s) => s.f.endsWith(file) && s.text.includes(marker));
    expect(has("screens/ResultScreen.tsx", "data-result-stage")).toBe(true);
    expect(has("components/v2/ResultPanel.tsx", "data-result-panel")).toBe(true); // 11-07: 패널 요소는 ResultPanel 이 그린다
    expect(has("screens/ResultScreen.tsx", "data-result-announce")).toBe(true);
    expect(has("world/testHooks.ts", "__mfResult")).toBe(true);
    // 11-07: 탭 패널 표식과 훅의 현재 탭
    expect(has("components/v2/ResultPanel.tsx", "data-result-tab")).toBe(true);
    expect(has("components/v2/ResultPanel.tsx", "data-result-dot")).toBe(true);
    expect(has("components/v2/ResultPanel.tsx", "data-result-divider")).toBe(true);
    expect(has("screens/ResultScreen.tsx", "patch({ tab })")).toBe(true);
    expect(has("world/testHooks.ts", "tab: string")).toBe(true);
    // 11-09: 시상식 표식 — 패(data-award-plate·data-award-id)·떠 있는 [넘기기](data-float="skip")·진행 숫자·훅 awards/shown
    expect(has("components/v2/AwardPlate.tsx", "data-award-plate")).toBe(true);
    expect(has("components/v2/AwardPlate.tsx", "data-award-id")).toBe(true);
    expect(has("components/v2/FloatAction.tsx", "data-float-count")).toBe(true);
    expect(has("components/v2/FloatAction.tsx", '"skip"')).toBe(true);
    expect(has("screens/ResultScreen.tsx", 'kind="skip"')).toBe(true);
    expect(has("screens/ResultScreen.tsx", "patch({ awards")).toBe(true);
    expect(has("screens/ResultScreen.tsx", "patch({ shown")).toBe(true);
    expect(has("world/testHooks.ts", "awards: [number, string][]")).toBe(true);
    expect(has("world/testHooks.ts", "shown: number")).toBe(true);
  });

  it("탭 id 와 접근성 이름·구분선 꼴이 앱 상수와 같다 (11-07, E2E 사본이 어긋나지 않게)", () => {
    expect([...(r as unknown as { RESULT_TAB_IDS: readonly string[] }).RESULT_TAB_IDS]).toEqual([...RESULT_TABS]);
    expect(RESULT_PANEL_TEXT.tabName.mafia).toBe("마피아 밤 대화");
  });

  it("직업 의상 표·승리 한 줄·패널 높이가 앱 상수와 같다 (E2E 사본이 어긋나지 않게)", () => {
    expect({ ...r.RESULT_JOB_OUTFIT }).toEqual({ ...JOB_OUTFIT });
    expect({ ...r.RESULT_WIN_TITLE }).toEqual({ citizenWin: RESULT_TEXT.title.citizenWin, mafiaWin: RESULT_TEXT.title.mafiaWin });
    expect(r.RESULT_PANEL_H.short).toBe(LOG_H_SHORT + RESULT_CHAT_EXTRA);
    expect(r.RESULT_PANEL_H.tall).toBe(LOG_H_TALL + RESULT_CHAT_EXTRA);
    expect(r.RESULT_PANEL_H.tallRoomMinH).toBe(TALL_ROOM_MIN_H);
  });

  it("시상식 기하·제목이 앱과 같다 (11-09): 패 폭 min(328, 폭 − 32)·높이 96, [넘기기] 지름 48·오른쪽 16, 헤더 '시상식'", () => {
    const css = readFileSync(new URL("src/styles/result.css", root), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const plate = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find((m) => (m[1] ?? "").trim() === ".mv-award")?.[2] ?? "";
    expect(plate).toContain(`height: ${r.AWARD_PLATE.h}px`);
    expect(plate).toContain(`min(${r.AWARD_PLATE.maxW}px, calc(100% - ${r.AWARD_PLATE.sideMargin}px))`);
    expect(r.AWARD_PLATE.float).toBe(48);
    expect(r.AWARD_PLATE.floatRight).toBe(16);
    expect(r.AWARD_CEREMONY_TITLE).toBe(CEREMONY_TITLE);
  });

  it("기록 탭 카드 기하가 앱과 같다 (11-11): 카드 72×112 · 간격은 --space-sm · 표식은 컴포넌트에 있다", () => {
    const css = readFileSync(new URL("src/styles/result.css", root), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const body = (sel: string): string => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find((m) => (m[1] ?? "").trim() === sel)?.[2] ?? "";
    const card = body(".mf-tl__card");
    expect(card).toContain(`width: ${r.TIMELINE_CARD.w}px`);
    expect(card).toContain(`height: ${r.TIMELINE_CARD.h}px`);
    const tokens = readFileSync(new URL("src/styles/tokens.css", root), "utf8");
    expect(body(".mf-tl__strip")).toContain("gap: var(--space-sm)");
    expect(new RegExp(`--space-sm:\\s*${r.TIMELINE_CARD.gap}px`).test(tokens)).toBe(true);
    const has = (file: string, marker: string) => sources.some((s) => s.f.endsWith(file) && s.text.includes(marker));
    expect(has("components/v2/TimelineStrip.tsx", "data-day-card")).toBe(true);
    expect(has("components/v2/DayDetail.tsx", "data-day-detail")).toBe(true);
    expect(has("components/v2/DayDetail.tsx", "data-whisper-pair")).toBe(true);
  });

  it("11-12: 다시 하기 알약·쉬는 사람 화면 표식과 훅 sat 가 앱에 있고, 알약 치수가 CSS 와 같다", () => {
    const has = (file: string, marker: string) => sources.some((s) => s.f.endsWith(file) && s.text.includes(marker));
    expect(has("components/v2/ReadyPill.tsx", "data-ready-pill")).toBe(true);
    expect(has("components/v2/ReadyPill.tsx", "data-ready=")).toBe(true);
    expect(has("components/v2/ReadyPill.tsx", "data-ready-count")).toBe(true);
    expect(has("screens/BenchView.tsx", "data-bench-view")).toBe(true);
    expect(has("world/testHooks.ts", "sat: number[]")).toBe(true); // window.__mfResult.sat
    expect(has("screens/ResultScreen.tsx", "sat: satSeats")).toBe(true);
    const css = readFileSync(new URL("src/styles/v2.css", root), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const pill = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find((m) => (m[1] ?? "").trim() === ".mv-ready")?.[2] ?? "";
    expect(pill).toContain(`width: ${r.READY_PILL.w}px`);
    expect(pill).toContain(`height: ${r.READY_PILL.h}px`);
    // 입력줄 여백 188 = 보내기 이름표 단추 44(14-06, 옛 48) + 알약 96 + 요소 사이 8 × 2 + 좌우 16 × 2
    expect(44 + r.READY_PILL.w + 8 * 2 + 16 * 2).toBe(r.READY_PILL.inputExtra);
  });
});

describe("12페이즈 소리 시험 페이지 E2E 표식·문턱(12-06)", () => {
  const lib = e2eLib as unknown as { SOUND_MARKERS: readonly string[]; SOUND_RENDER_LIMITS: { count: number; peakMaxDb: number; rmsMinDb: number; lengthTolMs: number } };
  const root = new URL("../../", import.meta.url);
  const tracked = execFileSync("git", ["ls-files", "src"], { cwd: root, encoding: "utf8" })
    .split("\n")
    .filter((f) => /\.(tsx?|css)$/.test(f));
  const sources = tracked.map((f) => ({ f, text: readFileSync(new URL(f, root), "utf8") }));

  it("SOUND_MARKERS 여섯 개(시험 페이지 넷 + 소리 단추 둘)가 git 이 추적하는 src/ 파일 어딘가에 있다(표식 이름 오타 방지)", () => {
    expect(lib.SOUND_MARKERS).toEqual(["data-sound-lab", "data-sound-id", "__mfSound", "__mfSoundLab", "data-sound-button", "data-sound-state"]);
    const missing = lib.SOUND_MARKERS.filter((m) => !sources.some((s) => s.text.includes(m)));
    expect(missing).toEqual([]);
  });

  it("표식은 시험 페이지·소리 훅에 각각 있다", () => {
    const has = (file: string, marker: string) => sources.some((s) => s.f.endsWith(file) && s.text.includes(marker));
    expect(has("debug/soundLab.ts", "data-sound-lab")).toBe(true);
    expect(has("debug/soundLab.ts", "data-sound-id")).toBe(true);
    expect(has("debug/soundLab.ts", "__mfSoundLab")).toBe(true);
    expect(has("audio/testHook.ts", "__mfSound")).toBe(true);
    expect(has("components/v2/SoundButton.tsx", "data-sound-button")).toBe(true);
    expect(has("components/v2/SoundButton.tsx", "data-sound-state")).toBe(true);
  });

  it("소리 단추 표식에는 값이 on·off·locked 뿐이다 — 역할·좌석 값이 실리지 않는다(T-12-23)", () => {
    const text = sources.find((s) => s.f.endsWith("components/v2/SoundButton.tsx"))!.text.replace(/\/\/.*$/gm, "");
    const dataAttrs = [...new Set([...text.matchAll(/\b(data-[a-z-]+)=/g)].map((m) => m[1]))].sort();
    // 14-07(TOOL-01): 이름표 표식 data-tool-label 하나만 더했다. 값은 고정 낱말 '소리' — 역할·좌석 값이 아니다(T-12-23 의 뜻은 그대로)
    expect(dataAttrs).toEqual(["data-sound-button", "data-sound-state", "data-tool-label"]);
    expect(text).not.toMatch(/role=|seat|nonce|mafia/i);
  });

  it("E2E 문턱 개수는 SOUND_IDS.length 와 같고, 앱 쪽 SOUND_LIMITS 와 한 글자도 다르지 않다(문턱 완화 방지, T-12-22)", () => {
    expect(lib.SOUND_RENDER_LIMITS.count).toBe(SOUND_IDS.length);
    expect({ ...lib.SOUND_RENDER_LIMITS }).toEqual({ ...SOUND_LIMITS });
  });

  it("perf-run --sound off 가 쓰는 저장값이 앱의 소리 설정 저장 형식과 같아 엔진이 꺼짐으로 읽는다", () => {
    const script = (perfRun as unknown as { soundInitScript(mode: string): string | null }).soundInitScript("off")!;
    const store = new Map<string, string>();
    new Function("localStorage", script)({ setItem: (k: string, v: string) => store.set(k, v) });
    expect([...store.keys()]).toEqual([SOUND_PREF_KEY]);
    expect(store.get(SOUND_PREF_KEY)).toBe(JSON.stringify({ v: SOUND_PREF_VERSION, on: false }));
    expect(loadSoundPref({ getItem: (k: string) => store.get(k) ?? null, setItem: () => {} })).toBe(false);
  });
});

describe("12페이즈 sound-script E2E 기대 표 (12-08)", () => {
  type Step = { id: string; label: string; ids: string[]; notIds?: string[]; counts?: Record<string, number>; onlyPrefix?: string };
  const lib = e2eLib as unknown as { SOUND_SCRIPT_STEPS: readonly Step[] };
  const root = new URL("../../", import.meta.url);

  it("기대 id 는 모두 실제 소리 id 이고 counts 의 키도 마찬가지다 (오타가 거짓 통과를 만들지 않게)", () => {
    const known = new Set<string>(SOUND_IDS);
    const named = lib.SOUND_SCRIPT_STEPS.flatMap((s) => [...s.ids, ...(s.notIds ?? []), ...Object.keys(s.counts ?? {})]);
    expect(named.filter((id) => !known.has(id))).toEqual([]);
  });

  it("sound-script 가 flows.mjs 에 390x844(GAME_SIZE)로 등록돼 있다", () => {
    const flows = readFileSync(new URL("scripts/e2e/flows.mjs", root), "utf8");
    expect(flows).toMatch(/\{ id: "sound-script", run: soundScriptFlow, size: GAME_SIZE \}/);
  });

  it("단계 표는 감독의 단계 → 침대 표와 같은 침대 id 를 쓴다", () => {
    const beds = lib.SOUND_SCRIPT_STEPS.flatMap((s) => s.ids.filter((id) => id.startsWith("bed.")));
    expect([...new Set(beds)].sort()).toEqual(["bed.dawn", "bed.day", "bed.lobby", "bed.night", "bed.reveal", "bed.vote"]);
  });
});

describe("12페이즈 sound-night-parity E2E (12-09)", () => {
  const root = new URL("../../", import.meta.url);

  it("sound-night-parity 가 flows.mjs 에 390x844(GAME_SIZE)로 등록돼 있다", () => {
    const flows = readFileSync(new URL("scripts/e2e/flows.mjs", root), "utf8");
    expect(flows).toMatch(/\{ id: "sound-night-parity", run: soundNightParityFlow, size: GAME_SIZE \}/);
  });

  it("판정 함수는 lib.mjs 의 순수 함수이고 흐름 본문은 sound.mjs 에 있다 (문턱은 순수 함수에만)", () => {
    const lib = readFileSync(new URL("scripts/e2e/lib.mjs", root), "utf8");
    const sound = readFileSync(new URL("scripts/e2e/sound.mjs", root), "utf8");
    expect(lib).toMatch(/export function soundNightParityChecks/);
    expect(sound).toMatch(/soundNightParityChecks/);
    expect(sound).toMatch(/async function soundNightParityFlow/);
  });

  it("흐름이 쓰는 밤 id 집합은 실제 소리 id 이다 (오타 방지)", () => {
    const lib = e2eLib as unknown as { NIGHT_PARITY_IDS: readonly string[] };
    const known = new Set<string>(SOUND_IDS);
    expect(lib.NIGHT_PARITY_IDS.filter((id) => !known.has(id))).toEqual([]);
    expect([...lib.NIGHT_PARITY_IDS].sort()).toEqual(["bed.night", "night.cue", "night.fall"]);
  });
});

describe("11페이즈 맵 선택 E2E 표식·기하 (11-13)", () => {
  const maps = mapSelectE2e as unknown as { MAP_MARKERS: readonly string[]; MAP_CHIP: { disc: number; hit: number; left: number; below: number }; MAP_CARD: { w: number; h: number; gap: number; total: number } };
  const root = new URL("../../", import.meta.url);
  const tracked = execFileSync("git", ["ls-files", "src"], { cwd: root, encoding: "utf8" })
    .split("\n")
    .filter((f) => /\.(tsx?|css)$/.test(f));
  const sources = tracked.map((f) => ({ f, text: readFileSync(new URL(f, root), "utf8") }));

  it("MAP_MARKERS 가 4개이고 각 표식이 git 이 추적하는 src/ 파일 어딘가에 있다(표식 이름 오타 방지)", () => {
    expect(maps.MAP_MARKERS.length).toBe(4);
    const missing = maps.MAP_MARKERS.filter((m) => !sources.some((s) => s.text.includes(m)));
    expect(missing).toEqual([]);
  });

  it("칩·카드 기하가 앱 CSS 와 같다 — 어긋나면 E2E 가 거짓 통과·거짓 실패한다", () => {
    const css = readFileSync(new URL("src/styles/v2.css", root), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const body = (sel: string): string => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find((m) => (m[1] ?? "").trim() === sel)?.[2] ?? "";
    expect(body(".mf-mapchip__disc")).toContain(`width: ${maps.MAP_CHIP.disc}px`);
    expect(body(".mf-mapchip__disc")).toContain(`height: ${maps.MAP_CHIP.disc}px`);
    expect(body(".mf-mapchip")).toContain("width: var(--tap-min)");
    expect(maps.MAP_CHIP.hit).toBe(44);
    expect(maps.MAP_CHIP.left).toBe(16);
    const card = body(".mv-map-card");
    expect(card).toContain(`width: ${maps.MAP_CARD.w}px`);
    expect(card).toContain(`height: ${maps.MAP_CARD.h}px`);
    expect(body(".mv-dress-sheet__maps")).toContain("gap: var(--space-sm)");
    expect(maps.MAP_CARD.total).toBe(3 * maps.MAP_CARD.w + 2 * maps.MAP_CARD.gap);
  });
});

describe("12페이즈 판결 타이밍·동작 소리 누설 E2E (12-10)", () => {
  const root = new URL("../../", import.meta.url);
  const lib = readFileSync(new URL("scripts/e2e/lib.mjs", root), "utf8");
  const sound = readFileSync(new URL("scripts/e2e/sound.mjs", root), "utf8");

  it("판정 함수는 lib.mjs 의 순수 함수이고 흐름(sound.mjs)이 쓴다 (문턱은 순수 함수에만)", () => {
    expect(lib).toMatch(/export function soundVerdictTimingChecks/);
    expect(lib).toMatch(/export function soundEmoteLeakChecks/);
    expect(sound).toMatch(/soundVerdictTimingChecks/);
    expect(sound).toMatch(/soundEmoteLeakChecks/);
  });

  it("흐름이 처형을 실제 시간으로 지켜보고(통과·부결 두 판) 밤 마피아 동작을 보낸다", () => {
    expect(sound).toMatch(/execution/);
    expect(sound).toMatch(/data-emote/);
  });

  it("흐름이 낮추지 못하는 문턱은 sound.mjs 에 숫자로 쓰지 않는다 (2600·250 은 lib.mjs 에만)", () => {
    expect(sound).not.toMatch(/\b2600\b/);
    expect(lib).toMatch(/2600/);
  });
});

describe("12페이즈 sound-result E2E (12-11)", () => {
  const root = new URL("../../", import.meta.url);

  it("sound-result 가 flows.mjs 에 390x844(GAME_SIZE)로 등록돼 있다", () => {
    const flows = readFileSync(new URL("scripts/e2e/flows.mjs", root), "utf8");
    expect(flows).toMatch(/\{ id: "sound-result", run: soundResultFlow, size: GAME_SIZE \}/);
  });

  it("판정 함수는 lib.mjs 의 순수 함수이고 흐름 본문은 sound.mjs 에 있다 (문턱은 순수 함수에만)", () => {
    const lib = readFileSync(new URL("scripts/e2e/lib.mjs", root), "utf8");
    const sound = readFileSync(new URL("scripts/e2e/sound.mjs", root), "utf8");
    expect(lib).toMatch(/export function soundResultChecks/);
    expect(lib).toMatch(/export function soundResultSkipChecks/);
    expect(sound).toMatch(/soundResultChecks/);
    expect(sound).toMatch(/async function soundResultFlow/);
  });

  it("판정이 기대하는 id 는 모두 실제 소리 id 이다 (오타 방지)", () => {
    const sound = readFileSync(new URL("scripts/e2e/lib.mjs", root), "utf8");
    const body = sound.slice(sound.indexOf("export function soundResultChecks"));
    const named = [...body.matchAll(/"((?:role|result|award|bed|game)\.[a-z]+)"/g)].map((m) => m[1]!);
    const known = new Set<string>(SOUND_IDS);
    expect([...new Set(named)].filter((id) => !known.has(id))).toEqual([]);
  });
});

describe("14페이즈 사회자·이름표 E2E 사본과 제품 값 (14-08, 사본 일치 규약)", () => {
  type L = {
    HOST_ACT_LINES: Record<string, string>;
    GOALS: Record<string, string>;
    VIEW_TOP_KEYS: ReadonlySet<string>;
    VIEW_ME_KEYS: ReadonlySet<string>;
    VIEW_DAY_KEYS: ReadonlySet<string>;
    HOST_MARKERS: readonly string[];
  };
  const lib = e2eLib as unknown as L;
  const root = new URL("../../", import.meta.url);

  it("HOST_ACT_LINES 는 src/game/hostLine.ts 의 밤 역할별 줄과, GOALS 는 roleText.ts 의 목표 문장과 한 글자도 다르지 않다", () => {
    expect(lib.HOST_ACT_LINES).toEqual({ mafia: HOST_LINES["night.mafia"], police: HOST_LINES["night.police"], doctor: HOST_LINES["night.doctor"] });
    expect(lib.GOALS).toEqual({ mafia: ROLE_TEXT.mafia.goal, police: ROLE_TEXT.police.goal, doctor: ROLE_TEXT.doctor.goal, citizen: ROLE_TEXT.citizen.goal });
  });

  /** view.test.ts 의 `const NAME ... = new Set([ "a", "b" ])` 안 문자열 목록(줄 주석은 뺀다). 서버 view 허용 목록은 이 페이즈에서 그대로다. */
  const keysIn = (name: string): string[] => {
    const text = readFileSync(new URL("test/unit/view.test.ts", root), "utf8");
    const m = new RegExp(`const ${name}\\b[^=]*=\\s*new Set\\(\\[([\\s\\S]*?)\\]\\)`).exec(text);
    if (!m) throw new Error(`${name} 를 찾지 못함`);
    const body = m[1]!.replace(/\/\/.*$/gm, "");
    return [...body.matchAll(/"([^"]+)"/g)].map((x) => x[1]!);
  };

  // view.test.ts 의 풍부한 상태가 만들지 않는 9페이즈 상태 의존 키(결정 0061-9·10·14) — 실제 판의 프레임에는 나온다. protocol.ts 의 같은 인터페이스에 선언되어 있어야 한다.
  const EXTRA: Record<string, { iface: string; keys: string[] }> = {
    ME_KEYS: { iface: "MyInfo", keys: ["will", "note"] },
    DAY_KEYS: { iface: "DayView", keys: ["chalk"] },
  };

  it("VIEW_TOP/ME/DAY_KEYS 는 test/unit/view.test.ts 의 TOP_KEYS·ME_KEYS·DAY_KEYS 에 9페이즈 상태 의존 키(me.will·me.note·day.chalk)만 더한 집합이다(서버 view 키 사본이 어긋나지 않게)", () => {
    for (const [name, got] of [["TOP_KEYS", lib.VIEW_TOP_KEYS], ["ME_KEYS", lib.VIEW_ME_KEYS], ["DAY_KEYS", lib.VIEW_DAY_KEYS]] as const) {
      const want = keysIn(name);
      expect(want.length, name).toBeGreaterThan(5);
      expect([...got].sort(), name).toEqual([...new Set([...want, ...(EXTRA[name]?.keys ?? [])])].sort());
    }
  });

  it("더한 키 셋(will·note·chalk)은 shared/protocol.ts 의 MyInfo·DayView 인터페이스에 선언되어 있다", () => {
    const text = readFileSync(new URL("shared/protocol.ts", root), "utf8");
    for (const { iface, keys } of Object.values(EXTRA)) {
      const m = new RegExp(`export interface ${iface}\\b[^{]*\\{([\\s\\S]*?)\\n\\}`).exec(text);
      expect(m, iface).not.toBeNull();
      for (const k of keys) expect(m![1]!, `${iface}.${k}`).toMatch(new RegExp(`\\b${k}\\??:`));
    }
  });

  it("HOST_MARKERS(E2E 가 읽는 표식)가 git 이 추적하는 src/ 파일 어딘가에 있다(표식 이름 오타 방지)", () => {
    const tracked = execFileSync("git", ["ls-files", "src"], { cwd: root, encoding: "utf8" })
      .split("\n")
      .filter((f) => /\.(tsx?|css)$/.test(f));
    const all = tracked.map((f) => readFileSync(new URL(f, root), "utf8")).join("\n");
    expect(lib.HOST_MARKERS).toEqual(["data-host-band", "data-host-line", "data-host-time", "data-call", "data-tool-label", "data-role-goal", "data-guide"]);
    expect(lib.HOST_MARKERS.filter((m) => !all.includes(m))).toEqual([]);
  });
});
