// E2E 순수 도우미(scripts/e2e/lib.mjs)와 앱 상수의 동일성 (05-05, T-05-12).
// 두 목록이 어긋나면 UX1(안내·타이머 검사)이 거짓 통과·거짓 실패한다 — scenes.test.ts 의 EXPECTED_SCENE 비교와 같은 방식.
import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { BAR_MASK } from "../../shared/game/map";
import { DEFENSE_MS, EXECUTION_MS, NOMINATION_END_MS, NOMINATION_GATHER_MS, NOMINATION_MS, PICK_GAP_MS, PICK_TURN_MS, SHOWDOWN_GATHER_MS, SHOWDOWN_POINT_MS, SHOWDOWN_REVEAL_MS, SHOWDOWN_TURN_MS, nominationMaxMs } from "../../shared/game/phases";
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
  DISCUSSION_LOG_H,
  DISCUSSION_PANEL_EXTRA,
  KB_PANEL_H,
  KB_PANEL_REST,
  LOBBY_PANEL_EXTRA,
  LOG_H,
  LOG_OPEN_MAX,
  OPEN_STAGE_MIN,
  TYPING_PILL_H,
  lobbyPanelHeight,
  openLogHeight,
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
import * as smoke from "../../scripts/smoke.mjs";
// @ts-expect-error -- 선언 없는 스크립트 모듈
import * as resultE2e from "../../scripts/e2e/result.mjs";
// @ts-expect-error -- 선언 없는 스크립트 모듈
import * as mapSelectE2e from "../../scripts/e2e/mapselect.mjs";
// @ts-expect-error -- 선언 없는 스크립트 모듈
import * as polishE2e from "../../scripts/e2e/polish.mjs";
import { TOD_LABEL, TOD_ORDER, todOf } from "../../src/game/timeOfDay";
import { enterMorning, pickTarget } from "../../shared/game/night";
import { attachConnection, createRoomState, joinRoom, startGame } from "../../shared/game/room";
import type { Player, RoomState } from "../../shared/game/room";
import { tick } from "../../shared/game/tick";
import { buildView } from "../../shared/game/view";
import { OUTFIT_IDS } from "../../shared/protocol";
import type { OutfitId, PhaseId } from "../../shared/protocol";
import { seededRandInt } from "../helpers/seededRandom";
import { HOST_HIDDEN_PHASES, HOST_LINES, type HostKey } from "../../src/game/hostLine";
import { ROLE_TEXT } from "../../src/game/roleText";
import { RESULT_TEXT } from "../../src/game/verdict";
import { JOB_OUTFIT } from "../../src/world/jobOutfit";
import { CHAT_PANEL_EXTRA as RESULT_CHAT_EXTRA } from "../../src/game/chatUi";
import { hostRailLayout } from "../../src/components/v2/HostRail";
import { SIDE_CELL, SIDE_GAP } from "../../src/components/v2/SideColumn";
import { HOST_RAIL_LABEL } from "../../src/components/v2/HostRail";
import { nextPhaseOf, afterDayOf, WILL_REVEAL_MS, PIN_OFF_EXEC_AT, KEYWORD_MS, KEYWORD_READ_MS, ANSWER_REVEAL_MS } from "../../shared/game/phases";
import { ANSWER_MAX_GRAPHEMES, ANSWER_MIN_GAP_MS } from "../../shared/game/answerRules";
import { EARLY_GRACE_MS } from "../../shared/game/early";
import { KEYWORD_NOTICE_MS, KEYWORD_REJECT_COPY } from "../../src/net/useKeywordAnswer";
// @ts-expect-error -- 선언 없는 스크립트 모듈
import * as e2eDay from "../../scripts/e2e/day.mjs";
// @ts-expect-error -- 선언 없는 스크립트 모듈
import * as e2eKeyword from "../../scripts/e2e/keyword.mjs";

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
    LOG_H: number;
    LOBBY_PANEL_EXTRA: number;
    CHAT_PANEL_EXTRA: number;
    KB_PANEL_H: number;
    TYPING_PILL_H: number;
    lobbyPanelHeight: (logH: number, host?: boolean) => number;
  };
  const lib = e2eLib as unknown as ChatCopy;

  it("상수가 chatUi 와 같다(LOG_H·LOBBY_PANEL_EXTRA·CHAT_PANEL_EXTRA·KB_PANEL_H 포함, 18.1 B 계약 4)", () => {
    expect(lib.LOG_H).toBe(LOG_H);
    expect(lib.LOG_H).toBe(68);
    expect(lib.KB_PANEL_H).toBe(146);
    expect(KB_PANEL_H).toBe(146);
    expect(lib.LOBBY_PANEL_EXTRA).toBe(LOBBY_PANEL_EXTRA);
    // 19-04(P19-12): 방장 패널 증분 상수는 앱에도 E2E 사본에도 없다(이름을 그대로 적지 않는다 — 남은 곳을 찾는 검색에 걸리지 않게)
    expect(Object.keys(e2eLib).includes(["LOBBY", "HOST", "TUTORIAL", "EXTRA"].join("_"))).toBe(false);
    expect(lib.CHAT_PANEL_EXTRA).toBe(CHAT_PANEL_EXTRA);
    expect(lib.KB_PANEL_H).toBe(KB_PANEL_H);
    expect(lib.TYPING_PILL_H).toBe(TYPING_PILL_H);
  });

  it("늘어난 기록 칸 상수(LOG_OPEN_MAX·OPEN_STAGE_MIN·KB_PANEL_REST) 사본이 chatUi 와 같다 (0083-4)", () => {
    const l = e2eLib as unknown as { LOG_OPEN_MAX: number; OPEN_STAGE_MIN: number; KB_PANEL_REST: number };
    expect(l.LOG_OPEN_MAX).toBe(LOG_OPEN_MAX);
    expect(l.OPEN_STAGE_MIN).toBe(OPEN_STAGE_MIN);
    expect(l.KB_PANEL_REST).toBe(KB_PANEL_REST);
    const p = polishE2e as unknown as { CHAT_OPEN_MAX: number; CHAT_OPEN_STAGE_MIN: number; CHAT_KB_PANEL_REST: number };
    expect(p.CHAT_OPEN_MAX).toBe(LOG_OPEN_MAX);
    expect(p.CHAT_OPEN_STAGE_MIN).toBe(OPEN_STAGE_MIN);
    expect(p.CHAT_KB_PANEL_REST).toBe(KB_PANEL_REST);
  });

  it("늘어난 높이 식 사본(polish.chatOpenHeight)과 openLogHeight 가 고정 입력 표에서 같은 값이다(다섯 + 폰 6종의 방 높이)", () => {
    const copy = (polishE2e as unknown as { chatOpenHeight: (i: { roomH: number; lift: number; hostBottom: number; panelRest: number }) => number }).chatOpenHeight;
    const rows = [
      { roomH: 844, lift: 0, hostBottom: 126, panelRest: 154 },
      { roomH: 844, lift: 336, hostBottom: 126, panelRest: 78 },
      { roomH: 640, lift: 0, hostBottom: 126, panelRest: 154 },
      { roomH: 640, lift: 260, hostBottom: 126, panelRest: 78 },
      { roomH: 560, lift: 260, hostBottom: 126, panelRest: 78 },
    ];
    // 폰 6종(360x560·360x640·375x667·390x664·390x844·412x915)의 방 높이 × 키보드 없음·있음 × 손님·방장 패널 나머지
    for (const roomH of [560, 640, 667, 664, 844, 915]) for (const lift of [0, 336]) for (const panelRest of [78, 154, 230]) rows.push({ roomH, lift, hostBottom: 124.6, panelRest });
    for (const r of rows) expect(copy(r), JSON.stringify(r)).toBe(openLogHeight(r));
  });

  it("지운 테이블 상수의 사본은 lib 에 없다(TABLE_PANEL_EXTRA·PANEL_H·tablePanelHeight·expectedPanelH)", () => {
    const keys = Object.keys(e2eLib as Record<string, unknown>);
    for (const gone of ["TABLE_PANEL_EXTRA", "PANEL_H", "HEADER_H", "tablePanelHeight", "expectedPanelH"]) expect(keys).not.toContain(gone);
  });

  it("lib 에 옛 기록 칸 사본 이름이 없다(기록 칸 높이는 LOG_H 하나)", () => {
    const keys = Object.keys(e2eLib as Record<string, unknown>);
    for (const gone of ["LOG_H_SHORT", "LOG_H_TALL", "LOG_H_KB", "TALL_ROOM_MIN_H", "logHeightFor"]) expect(keys).not.toContain(gone);
  });

  it("GAME_PANEL_EXTRA 의 채팅과 토론은 앱 치수와 같고 찬반은 각각 218·126이다", () => {
    const extra = (e2eLib as unknown as { GAME_PANEL_EXTRA: Record<string, number>; gamePanelHeight: (h: number, k: string) => number }).GAME_PANEL_EXTRA;
    const gamePanelHeight = (e2eLib as unknown as { gamePanelHeight: (h: number, k: string) => number }).gamePanelHeight;
    expect(extra.chat).toBe(CHAT_PANEL_EXTRA);
    expect(extra.talk).toBe(DISCUSSION_PANEL_EXTRA);
    expect(extra.verdictVoter).toBe(218);
    expect(extra.verdictViewer).toBe(126);
    // 16-05: 입력줄 단추가 48 원이라 입력칸 48 과 높이가 같다 — 패널 높이에 보정이 없고, 판정은 "기록 칸 + 여분" 이다. CSS 의 단추 크기와도 견준다
    const css = readFileSync(new URL("src/styles/v2.css", new URL("../../", import.meta.url)), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const rule = (sel: string) => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter((m) => (m[1] ?? "").split(",").some((x) => x.trim() === sel)).map((m) => m[2] ?? "").join(";");
    expect(rule(".mv-tool")).toMatch(/(^|[;\s])width:\s*var\(--tap-min\)/);
    expect(rule(".mv-tool")).toMatch(/(^|[;\s])height:\s*var\(--tap-min\)/);
    for (const sel of [".mv-chat__emote", ".mv-chat__send", ".mv-chat__will"]) {
      expect(rule(sel)).toContain("width: var(--control-input)");
      expect(rule(sel)).toContain("height: var(--control-input)");
    }
    for (const roomH of [560, 640, 664, 779, 780, 844, 874, 932]) {
      expect(gamePanelHeight(roomH, "chat")).toBe(LOG_H + CHAT_PANEL_EXTRA);
      expect(gamePanelHeight(roomH, "talk")).toBe(DISCUSSION_LOG_H + DISCUSSION_PANEL_EXTRA);
    }
  });

  it("lobbyPanelHeight 사본이 chatUi 와 같고, 채팅 패널 높이는 LOG_H + CHAT_PANEL_EXTRA 다", () => {
    expect(lib.lobbyPanelHeight(LOG_H)).toBe(lobbyPanelHeight(LOG_H));
    expect(lib.lobbyPanelHeight(LOG_H)).toBe(160);
    // 19-04(P19-12): 방장 패널 = 참가자 패널. 예전의 두 번째 인자(방장)를 줘도 앱·E2E 사본 모두 160 다
    expect(lib.lobbyPanelHeight(LOG_H, true)).toBe(160);
    expect((lobbyPanelHeight as (logH: number, host?: boolean) => number)(LOG_H, true)).toBe(160);
    expect(lib.LOG_H + lib.CHAT_PANEL_EXTRA).toBe(LOG_H + CHAT_PANEL_EXTRA);
    expect(LOG_H + CHAT_PANEL_EXTRA).toBe(160);
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

  it("밤 패널 종류는 얼굴 목록 하나다(15-08)", () => {
    expect(Object.hasOwn(lib.GAME_PANEL_EXTRA, "nightMafia")).toBe(false);
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

  it("AVATAR_MARKERS 가 8개(동작 4 + 의상 3 + 잠긴 카드 1)이고 각 표식이 git 이 추적하는 src/ 파일 어딘가에 있다(표식 이름 오타 방지)", () => {
    expect(tracked.length).toBeGreaterThan(20);
    expect(lib.AVATAR_MARKERS.length).toBe(8);
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
    RESULT_PANEL_H: number;
    TIMELINE_CARD: { w: number; h: number; gap: number };
    READY_PILL: { w: number; h: number; inputExtra: number };
  };
  const root = new URL("../../", import.meta.url);
  const tracked = execFileSync("git", ["ls-files", "src"], { cwd: root, encoding: "utf8" })
    .split("\n")
    .filter((f) => /\.(tsx?|css)$/.test(f));
  const sources = tracked.map((f) => ({ f, text: readFileSync(new URL(f, root), "utf8") }));

  it("RESULT_MARKERS 가 git 이 추적하는 src/ 파일 어딘가에 있다(표식 이름 오타 방지)", () => {
    expect(r.RESULT_MARKERS).toEqual(["data-result-stage", "data-result-panel", "data-result-announce", "__mfResult", "data-result-tab", "data-result-dot", "data-result-divider", "data-ready-pill", "data-ready", "data-ready-count", "data-bench-view"]);
    const missing = r.RESULT_MARKERS.filter((m) => !sources.some((s) => s.text.includes(m)));
    expect(missing).toEqual([]);
  });

  it("시상식 표식(칭호 패·패 id·넘기기 진행 숫자)은 src/ 에 없고 E2E 목록에도 없다 (18.1-16, 0083-7)", () => {
    for (const gone of ["data-award-plate", "data-award-id", "data-float-count"]) {
      expect(r.RESULT_MARKERS, gone).not.toContain(gone);
      expect(sources.filter((s) => s.text.includes(gone)).map((s) => s.f), gone).toEqual([]);
    }
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
  });

  it("탭 id 와 접근성 이름·구분선 꼴이 앱 상수와 같다 (11-07, E2E 사본이 어긋나지 않게)", () => {
    expect([...(r as unknown as { RESULT_TAB_IDS: readonly string[] }).RESULT_TAB_IDS]).toEqual([...RESULT_TABS]);
    expect(RESULT_PANEL_TEXT.tabName.mafia).toBe("마피아 밤 대화");
  });

  it("직업 의상 표·승리 한 줄·패널 높이가 앱 상수와 같다 (E2E 사본이 어긋나지 않게)", () => {
    expect({ ...r.RESULT_JOB_OUTFIT }).toEqual({ ...JOB_OUTFIT });
    expect({ ...r.RESULT_WIN_TITLE }).toEqual({ citizenWin: RESULT_TEXT.title.citizenWin, mafiaWin: RESULT_TEXT.title.mafiaWin });
    expect(r.RESULT_PANEL_H).toBe(LOG_H + RESULT_CHAT_EXTRA);
    expect(r.RESULT_PANEL_H).toBe(160);
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
    // 입력줄 여백 192 = 보내기 48 원 + 알약 96 + 요소 사이 8 × 2 + 좌우 16 × 2
    expect(48 + r.READY_PILL.w + 8 * 2 + 16 * 2).toBe(r.READY_PILL.inputExtra);
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
    // 16-04(TOOL-04): 이름표 표식 data-tool-label 은 없어졌다. 16-06: 열의 첫 칸임을 알리는 data-side-button="sound" 가 더해졌다(값은 고정 낱말, T-16-14)
    expect(dataAttrs).toEqual(["data-side-button", "data-sound-button", "data-sound-state"]);
    expect(text).toContain('data-side-button="sound"');
    expect(text).not.toMatch(/role=|seat|nonce|mafia/i);
  });

  // 19-04·19-05(D-13): 봇·맵 단추가 방장 줄(data-host-rail-btn)로 옮겨 가 오른쪽 열은 방장도 소리·옷장 둘이다. 19-06: E2E 사본 SIDE_ORDER 도 둘이다.
  // src 에 남은 값 map 은 어느 화면도 쓰지 않는 MapChip 의 줄 아닌 변형 한 곳뿐이다 — 화면이 그 변형을 다시 쓰면 아래 단언이 잡는다
  it("SIDE_MARKERS(16-06 오른쪽 열 표식)가 src/ 에 있고, 화면이 쓰는 data-side-button 값은 sound·dress 고정 낱말뿐이다(T-16-14)", () => {
    const side = e2eLib as unknown as { SIDE_MARKERS: readonly string[]; SIDE_ORDER: readonly string[] };
    expect(side.SIDE_MARKERS).toEqual(["data-side-column", "data-side-button"]);
    expect(side.SIDE_MARKERS.filter((m) => !sources.some((s) => s.text.includes(m)))).toEqual([]);
    expect(side.SIDE_ORDER.join(",")).toBe("sound,dress");
    const found: { value: string; f: string }[] = [];
    for (const s of sources) {
      for (const m of s.text.replace(/\/\/.*$/gm, "").matchAll(/data-side-button(?:"?\s*[:=]\s*|=)\{?"([a-z]+)"/g)) found.push({ value: m[1]!, f: s.f });
      for (const m of s.text.replace(/\/\/.*$/gm, "").matchAll(/<FloatAction\b[^>]*\sside="([a-z]+)"/g)) found.push({ value: m[1]!, f: s.f });
    }
    expect([...new Set(found.map((x) => x.value))].sort().join(",")).toBe("dress,map,sound");
    const outside = found.filter((x) => !side.SIDE_ORDER.includes(x.value));
    expect(outside.map((x) => `${x.value}@${x.f}`).join(",")).toBe("map@src/components/v2/MapChip.tsx");
    // 화면은 MapChip 을 줄 변형(rail)으로만 쓴다 — 오른쪽 열에 맵이 다시 생기지 않는다
    const uses = sources.filter((s) => s.f.startsWith("src/screens/")).flatMap((s) => [...s.text.matchAll(/<MapChip\b[^>]*>/g)].map((m) => m[0]));
    expect(uses.length).toBeGreaterThan(0);
    expect(uses.filter((u) => !/\srail[\s/>]/.test(u))).toEqual([]);
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
  const maps = mapSelectE2e as unknown as { MAP_MARKERS: readonly string[]; MAP_CHIP: { disc: number; hit: number }; MAP_CARD: { w: number; h: number; gap: number; total: number } };
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
    expect(maps.MAP_CHIP.disc).toBe(52); // 16-06: 상자가 곧 52 원(--control-button)
    expect(body(".mf-mapchip")).toContain("width: var(--control-button)");
    expect(body(".mf-mapchip")).toContain("height: var(--control-button)");
    expect(maps.MAP_CHIP.hit).toBe(52);
    // 19-06: 칩은 왼쪽 방장 줄의 칸이다 — 줄 안 자리(왼쪽 16·띠 아래 12)는 lib.mjs HOST_RAIL_E2E 계약이 고정한다
    expect(Object.keys(maps.MAP_CHIP).sort().join(",")).toBe("disc,hit");
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

  it("흐름이 낮추지 못하는 문턱은 sound.mjs 에 숫자로 쓰지 않는다 (announceAt 3000·tolerance 250 은 lib.mjs 에만, 22-12 P22-13)", () => {
    expect(sound).not.toMatch(/\b2600\b|announceAt/);
    expect(lib).toMatch(/announceAt: 3000/);
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
    ROLE_LINES: Record<string, string>;
    VIEW_TOP_KEYS: ReadonlySet<string>;
    VIEW_ME_KEYS: ReadonlySet<string>;
    VIEW_DAY_KEYS: ReadonlySet<string>;
    HOST_MARKERS: readonly string[];
    HOST_BLANK_PHASES: readonly string[];
    HOST_OFF_PHASES: readonly string[];
    HOST_LINE_MAX: number;
  };
  const lib = e2eLib as unknown as L;
  const root = new URL("../../", import.meta.url);

  it("HOST_ACT_LINES 는 src/game/hostLine.ts 의 밤 역할별 줄과, ROLE_LINES 는 roleText.ts 의 역할 문구(desc)와 한 글자도 다르지 않다", () => {
    expect(lib.HOST_ACT_LINES).toEqual({ mafia: HOST_LINES["night.mafia"], police: HOST_LINES["night.police"], doctor: HOST_LINES["night.doctor"] });
    expect(lib.ROLE_LINES).toEqual({ mafia: ROLE_TEXT.mafia.desc, police: ROLE_TEXT.police.desc, doctor: ROLE_TEXT.doctor.desc, citizen: ROLE_TEXT.citizen.desc });
    // A1c: goal 키 폐지 — 문구는 desc 하나뿐
    for (const r of ["mafia", "police", "doctor", "citizen"] as const) expect(Object.hasOwn(ROLE_TEXT[r], "goal"), `${r}.goal`).toBe(false);
  });

  it("18.1-12: HOST_BLANK_PHASES 의 단계마다 그 단계 키들의 줄이 모두 빈 문자열이고, 빈 줄인 키는 모두 그 단계들 안에 있다", () => {
    const keysOf: Record<string, HostKey[]> = { execution: ["execution.passed"], answerReveal: ["answerReveal"], morning: ["morning"] };
    expect([...lib.HOST_BLANK_PHASES].sort()).toEqual(Object.keys(keysOf).sort());
    for (const phase of lib.HOST_BLANK_PHASES) for (const key of keysOf[phase]!) expect(HOST_LINES[key], `${phase}/${key}`).toBe("");
    const blankKeys = (Object.keys(HOST_LINES) as HostKey[]).filter((k) => HOST_LINES[k] === "").sort();
    expect(blankKeys).toEqual(Object.values(keysOf).flat().sort());
  });

  it("18.1-12: HOST_OFF_PHASES 는 앱의 HOST_HIDDEN_PHASES 와 같고, 한 줄 문턱(HOST_LINE_MAX)은 2 다", () => {
    expect([...lib.HOST_OFF_PHASES]).toEqual([...HOST_HIDDEN_PHASES]);
    expect(lib.HOST_LINE_MAX).toBe(2);
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
    expect(lib.HOST_MARKERS).toEqual(["data-host-band", "data-host-line", "data-host-time", "data-call", "data-role-line", "data-guide"]);
    expect(lib.HOST_MARKERS.filter((m) => !all.includes(m))).toEqual([]);
  });
});

describe("서버 계약 소비자 스크립트의 낮 시작 → 토론 흐름 (15-06, DEPLOY-03; 22-06 에서 심부름 단계가 없어졌다)", () => {
  const scriptText = (name: string): string => readFileSync(new URL(`../../scripts/${name}`, import.meta.url), "utf8");

  it("scripts/smoke.mjs 에 지운 상수(ERRAND_MS·MORNING_TRACE_MS)가 없고 아침 길이 기대는 9초다", () => {
    const text = scriptText("smoke.mjs");
    expect(text).not.toMatch(/ERRAND_MS|ERRAND_WAIT_MS|MORNING_TRACE_MS/);
    expect(text).toMatch(/const morningWant = 9_000;/);
  });

  it("scripts/smoke.mjs 의 DEFENSE_MS 사본이 서버의 유언 단계 길이(10_000)와 같다 (22-11 D-15)", () => {
    const text = scriptText("smoke.mjs");
    expect(DEFENSE_MS).toBe(10_000);
    expect(text).toMatch(/const DEFENSE_MS = 10_000;/);
    expect(text).toMatch(/유언 10초/);
  });

  it("E2E 처형 시간표 사본(EXEC_TIMING·VERDICT_TIMING·day.mjs WILL_REVEAL_MS_COPY)이 서버 상수와 같다 (22-13)", () => {
    expect(e2eLib.EXEC_TIMING.cardOffAt).toBe(WILL_REVEAL_MS);
    expect(e2eLib.EXEC_TIMING.announceAt).toBe(WILL_REVEAL_MS);
    expect(e2eLib.EXEC_TIMING.pinOffAt).toBe(PIN_OFF_EXEC_AT);
    expect(e2eLib.EXEC_TIMING.endsBy[0]).toBeLessThanOrEqual(EXECUTION_MS);
    expect(e2eLib.EXEC_TIMING.endsBy[1]).toBeGreaterThanOrEqual(EXECUTION_MS);
    expect(e2eLib.VERDICT_TIMING.announceAt).toBe(WILL_REVEAL_MS);
    expect(e2eDay.WILL_REVEAL_MS_COPY).toBe(WILL_REVEAL_MS);
  });

  it("키워드 E2E 사본 상수(KEYWORD_MS·KEYWORD_READ_MS·ANSWER_REVEAL_MS·ANSWER_MAX_GRAPHEMES·ANSWER_MIN_GAP_MS·EARLY_GRACE_MS·거절 문구·알림 시간)가 서버·앱 상수와 같다 (23-12)", () => {
    expect(e2eKeyword.KEYWORD_MS_COPY).toBe(KEYWORD_MS);
    expect(e2eKeyword.KEYWORD_READ_MS_COPY).toBe(KEYWORD_READ_MS);
    expect(e2eKeyword.ANSWER_REVEAL_MS_COPY).toBe(ANSWER_REVEAL_MS);
    expect(e2eKeyword.ANSWER_MAX_GRAPHEMES_COPY).toBe(ANSWER_MAX_GRAPHEMES);
    expect(e2eKeyword.ANSWER_MIN_GAP_MS_COPY).toBe(ANSWER_MIN_GAP_MS);
    expect(e2eKeyword.EARLY_GRACE_MS_COPY).toBe(EARLY_GRACE_MS);
    expect(e2eKeyword.KEYWORD_REJECT_COPY).toBe(KEYWORD_REJECT_COPY);
    expect(e2eKeyword.KEYWORD_NOTICE_MS_COPY).toBe(KEYWORD_NOTICE_MS);
  });

  it("scripts/smoke.mjs 의 EXECUTION_MS 사본이 서버의 처형 단계 길이(6_600, 유언 카드 3.0 + 처형 3.0 + 꼬리 0.6)와 같다 (22-12 P22-13)", () => {
    const text = scriptText("smoke.mjs");
    expect(EXECUTION_MS).toBe(6_600);
    expect(text).toMatch(/const EXECUTION_MS = 6_600;/);
    expect(text).not.toMatch(/VERDICT_LEAD_MS/);
  });

  // smoke.mjs 의 전이 표(PHASE_NEXT)는 판 종류가 없어 하나이고 서버와 같다.
  const smokeGraph = (smoke as unknown as { PHASE_NEXT: Record<string, string[]> }).PHASE_NEXT;

  it("smoke.mjs 의 전이 표가 하나이고 dayAnnounce → discussion 이며 낮 단계 목록에 errand 가 없다", () => {
    const text = scriptText("smoke.mjs");
    expect(text).toMatch(/dayAnnounce: \["discussion"\]/);
    expect(text).not.toMatch(/errand/);
    expect(text).not.toMatch(/PHASE_NEXT_BY_MODE|FIRST_DAY_PHASE/);
  });

  it("smoke.mjs 의 전이 표가 서버의 nextPhaseOf·afterDayOf 와 같다: 표가 가리키는 모든 단계(기본 다음 단계·처형 없는 낮 분기)가 들어 있고, 낮 시작 발표 다음은 토론이다 (T-21-45)", () => {
    const graph = smokeGraph;
    expect(Object.keys(graph).sort(), "표의 단계 목록").toEqual(
      ["lobby", "assigning", "roleReveal", "keyword", "dayAnnounce", "discussion", "nomination", "defense", "verdict", "execution", "answerReveal", "night", "morning", "ended"].sort(),
    );
    for (const [from, nexts] of Object.entries(graph)) {
      if (from === "ended" || from === "lobby") continue; // 방장의 start 가 넘기는 단계라 표의 next 가 없다
      const want = nextPhaseOf(from as PhaseId);
      if (from === "verdict") {
        // 찬반 마감: 통과면 지목, 부결이면 처형 없이 afterDayOf(state) — 둘째 날부터는 night, 첫날 키워드 판은 answerReveal(Pitfall 7)
        expect([...nexts].sort(), "verdict").toEqual([afterDayOf({ day: 2 }), afterDayOf({ day: 1, keyword: {} }), "nomination"].sort());
        continue;
      }
      if (from === "nomination") {
        // 지목 마감: 최다 한 명이면 변론(유언), 처형 없이 끝나면 afterDayOf(state) — 둘째 날부터는 night, 첫날 키워드 판은 answerReveal
        expect([...nexts].sort(), "nomination").toEqual([afterDayOf({ day: 2 }), afterDayOf({ day: 1, keyword: {} }), "defense"].sort());
        continue;
      }
      if (from === "execution") {
        // 처형 마감: 승패가 나면 ended, 첫날 키워드 판이면 answerReveal, 아니면 표의 기본(night) — 마감 훅 routeAfterExecution(23-05)
        expect([...nexts].sort(), "execution").toEqual([want, "answerReveal", "ended"].sort());
        continue;
      }
      expect(nexts, `${from} → ${want}`).toContain(want);
    }
    // 첫날 정답 공개(23-05, D-02): answerReveal 다음은 night 하나, afterDayOf(state) 는 상태 인자 두 경우로 갈린다.
    expect([...smokeGraph.answerReveal!]).toEqual([nextPhaseOf("answerReveal")]);
    expect([...smokeGraph.answerReveal!]).toEqual(["night"]);
    expect(afterDayOf({ day: 2 })).toBe("night");
    expect(afterDayOf({ day: 1, keyword: {} })).toBe("answerReveal");
    expect(afterDayOf({ day: 1 })).toBe("night");
    // 첫날 키워드(23-01, D-01): 역할 확인 다음은 keyword, keyword 다음은 낮 시작 발표다 — 서버 표와 같다.
    expect([...smokeGraph.roleReveal!]).toEqual([nextPhaseOf("roleReveal")]);
    expect([...smokeGraph.roleReveal!]).toEqual(["keyword"]);
    expect([...smokeGraph.keyword!]).toEqual(["dayAnnounce"]);
    expect(nextPhaseOf("keyword")).toBe("dayAnnounce");
    expect([...smokeGraph.night!]).toEqual(["morning"]);
    expect(nextPhaseOf("morning")).toBe("dayAnnounce");
    expect(nextPhaseOf("night")).toBe("morning");
  });

  it("uat-test-room.mjs 의 전이 표도 하나이고 smoke 와 같은 첫날 순서(키워드 → 낮 시작 발표 → 토론 → 찬반 … 정답 공개 → 밤)다", () => {
    const text = scriptText("uat-test-room.mjs");
    const table = /const PHASE_NEXT = \{([\s\S]*?)\n\};/.exec(text)?.[1] ?? "";
    const parsed = Object.fromEntries([...table.matchAll(/(\w+): \[([^\]]*)\]/g)].map((m) => [m[1], m[2]!.split(",").map((x) => x.trim().replace(/"/g, "")).filter(Boolean)]));
    for (const [from, nexts] of Object.entries(parsed)) expect(nexts, `uat ${from}`).toEqual([...smokeGraph[from]!]);
    expect(Object.keys(parsed)).toEqual(expect.arrayContaining(["roleReveal", "keyword", "dayAnnounce", "discussion", "verdict", "answerReveal", "night", "morning"]));
    expect(text).toContain('await skipTo("keyword")');
    expect(text).toContain('await skipTo("answerReveal")');
    expect(text).not.toContain("errand");
    expect(text).not.toMatch(/mode(?:Pick)/); // 옛 판 종류 고르기 메시지를 더는 보내지 않는다
    expect(text).not.toContain("view.mode");
  });

  it("bots.mjs 는 errand 단계를 모르고 밤에는 시민 봇도 고른다", () => {
    const text = scriptText("bots.mjs");
    expect(text).not.toContain("errand");
    expect(text).toContain('role !== "citizen"');
  });
});

// 18-13(G-18-3): smoke 의 아침 키·역할 문자열 허용 경로가 서버가 실제로 만드는 view 와 어긋나 배포본 smoke 가 서버 결함 없이 실패했다.
// 판정 함수(smoke.morningProblems·roleStringAllowed)를 shared 의 실제 전이·buildView 로 만든 아침 view 에 대 본다.
describe("smoke 허용 키·경로와 서버 view (18-13, G-18-3)", () => {
  const s = smoke as {
    OUTFIT_IDS: string[];
    MORNING_KEYS: string[];
    LOOK_PATH: string;
    ALLOWED_PLAYER_KEYS: string[];
    OPTIONAL_PLAYER_KEYS: string[];
    collectRoleStringPaths: (value: unknown, path: string, out: Array<{ path: string; value: string }>) => void;
    roleStringAllowed: (path: string, value: string, ctx: { spectate: boolean; ended: boolean; frameType: string }) => boolean;
    morningProblems: (morning: unknown, seats: number[]) => string[];
  };
  const START_AT = 10_000;

  /** 6명 판 1일차 밤을 실제 전이로 만든다. */
  function nightOf6(seed = 11): RoomState {
    const created = createRoomState({ code: "0420", hostId: "player-id-0000-aaaa", hostToken: "token-secret-0000-aaaa-0123456789", hostNickname: "이름0", now: 0 });
    if (!created.ok) throw new Error("createRoomState failed");
    let lobby = attachConnection(created.state, "player-id-0000-aaaa", "conn-0");
    for (let i = 1; i < 6; i += 1) {
      const id = `player-id-000${i}-aaaa`;
      const joined = joinRoom(lobby, { playerId: id, token: `token-secret-000${i}-aaaa-0123456789`, nickname: `이름${i}` });
      if (!joined.ok) throw new Error(`joinRoom failed: ${joined.error}`);
      lobby = attachConnection(joined.state, id, `conn-${i}`);
    }
    const started = startGame(lobby, lobby.hostId, START_AT, seededRandInt(seed));
    if (!started.ok) throw new Error(`startGame failed: ${started.error}`);
    let state = started.state;
    while (state.phase !== "night") {
      if (state.phaseEndsAt === null) throw new Error("phase has no deadline");
      state = tick(state, state.phaseEndsAt, seededRandInt(seed));
    }
    return state;
  }

  const pickAs = (st: RoomState, actor: Player, target: Player): RoomState => {
    const r = pickTarget(st, actor.id, target.seat);
    if (!r.ok) throw new Error(`pickTarget rejected: ${r.error}`);
    return r.state;
  };

  it("사본 상수 OUTFIT_IDS 가 shared/protocol.ts 와 같고 MORNING_KEYS 는 eliminated 하나다(22-06: trace·seen 이 없어졌다)", () => {
    expect([...s.OUTFIT_IDS]).toEqual([...OUTFIT_IDS]);
    expect([...s.MORNING_KEYS]).toEqual(["eliminated"]);
    expect(s.LOOK_PATH).toBe("view.players[].look");
  });

  // smoke 의 morningProblems 는 eliminated 필수다(22-06: trace·seen 이 없어졌다).
  it("실제 전이로 만든 아침 view(eliminated, 직업 이름과 같은 옷 look)를 smoke 판정이 통과시키고 누설 검사는 look 한 경로만 허용한다", () => {
    const night = nightOf6();
    const mafia = night.players.filter((p) => p.role === "mafia").sort((a, b) => a.seat - b.seat);
    const citizens = night.players.filter((p) => p.role === "citizen").sort((a, b) => a.seat - b.seat);
    const [m1, m2] = mafia as [Player, Player];
    const victim = citizens[0]!;
    // 옷 look: 직업 이름과 같은 단어 셋(서버는 look 을 역할의 함수로 만들지 않는다 — 서버 쪽 증명은 dress.test.ts L25)
    const looks: OutfitId[] = ["police", "doctor", "mafia"];
    const dressed: RoomState = { ...night, players: night.players.map((p, i) => (i < 3 ? { ...p, look: looks[i]! } : p)) };
    const base = enterMorning(pickAs(pickAs(dressed, m1, victim), m2, victim));
    const morningState: RoomState = { ...base, phase: "morning" };
    const seats = morningState.players.map((p) => p.seat);
    let lookLeaves = 0;
    for (const p of morningState.players) {
      const view = buildView(morningState, p.id, START_AT);
      const morning = view.day?.morning as Record<string, unknown>;
      expect(Object.keys(morning).sort(), `${p.nickname} 의 아침 키`).toEqual([...s.MORNING_KEYS]);
      expect(s.morningProblems(morning, seats)).toEqual([]);
      const spectator = morningState.players.find((q) => q.id === p.id)?.alive === false;
      const leaves: Array<{ path: string; value: string }> = [];
      s.collectRoleStringPaths({ t: "state", view }, "", leaves);
      for (const l of leaves) {
        expect(s.roleStringAllowed(l.path, l.value, { spectate: spectator, ended: false, frameType: "state" }), `${p.nickname}: ${l.path}=${l.value}`).toBe(true);
        if (l.path === s.LOOK_PATH) lookLeaves += 1;
      }
      const allowed = new Set([...s.ALLOWED_PLAYER_KEYS, ...s.OPTIONAL_PLAYER_KEYS]);
      for (const pp of view.players) for (const k of Object.keys(pp)) expect(allowed.has(k), `players 키 ${k}`).toBe(true);
    }
    expect(lookLeaves).toBeGreaterThan(0);
  });
});

describe("E2E 의 시간대 사본과 앱 todOf·TOD_LABEL (18.1-11, 0083-1)", () => {
  const e = polishE2e as { TOD_BY_PHASE: Record<string, string>; TOD_ABSENT_PHASES: readonly string[]; TOD_IDS: readonly string[]; TOD_WORD: Record<string, string> };
  const ALL_PHASES: PhaseId[] = ["lobby", "assigning", "roleReveal", "keyword", "dayAnnounce", "discussion", "nomination", "runoff", "showdown", "defense", "verdict", "execution", "answerReveal", "night", "morning", "ended"];

  it("TOD_BY_PHASE 의 모든 키에서 값이 todOf(키)와 같다", () => {
    for (const [phase, tod] of Object.entries(e.TOD_BY_PHASE)) expect(tod, phase).toBe(todOf(phase as PhaseId));
  });

  it("TOD_BY_PHASE 키와 TOD_ABSENT_PHASES 를 합치면 PhaseId 전부다(겹침 없음)", () => {
    const keys = Object.keys(e.TOD_BY_PHASE);
    expect([...keys, ...e.TOD_ABSENT_PHASES].sort()).toEqual([...ALL_PHASES].sort());
  });

  it("TOD_IDS 가 앱 TOD_ORDER 와 같다", () => {
    expect([...e.TOD_IDS]).toEqual([...TOD_ORDER]);
  });

  it("TOD_WORD 의 네 값이 앱 TOD_LABEL 과 같다(0083-1)", () => {
    expect({ ...e.TOD_WORD }).toEqual({ ...TOD_LABEL });
  });
});

describe("방장 줄 E2E 사본 계약 (19-06, T-19-18·T-19-19; 22-07 판 종류 칩·시트 없어짐)", () => {
  type Layout = { crown: boolean; columns: number[] };
  const lib = e2eLib as unknown as {
    HOST_RAIL_E2E: { cell: number; gap: number; crownH: number; left: number; testShift: number };
    HOST_RAIL_MARKERS: readonly string[];
    HOST_RAIL_ORDER: readonly string[];
    TOOL_ICON_RGB: string;
    TOOL_BORDER_RGBA: string;
    LOG_H: number;
    lobbyPanelHeight(logH: number): number;
    hostRailLayoutE2E(n: number, maxH: number): Layout;
  };
  const root = new URL("../../", import.meta.url);
  const tracked = execFileSync("git", ["ls-files", "src"], { cwd: root, encoding: "utf8" })
    .split("\n")
    .filter((f) => /\.(tsx?|css)$/.test(f));
  const sources = tracked.map((f) => ({ f, text: readFileSync(new URL(f, root), "utf8") }));
  const tokens = readFileSync(new URL("src/styles/tokens.css", root), "utf8");
  const css = readFileSync(new URL("src/styles/v2.css", root), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  const body = (sel: string): string => [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].find((m) => (m[1] ?? "").trim() === sel)?.[2] ?? "";
  /** tokens.css 의 #rrggbb 토큰을 getComputedStyle 이 주는 "rgb(r, g, b)" 글로 바꾼다 */
  const rgbOf = (name: string): string => {
    const m = new RegExp(`${name}:\\s*#([0-9a-fA-F]{6})\\b`).exec(tokens);
    if (!m) throw new Error(`${name} 토큰을 못 찾음`);
    const hex = m[1]!;
    return `rgb(${parseInt(hex.slice(0, 2), 16)}, ${parseInt(hex.slice(2, 4), 16)}, ${parseInt(hex.slice(4, 6), 16)})`;
  };

  it("HOST_RAIL_E2E 의 지름·간격이 SideColumn 의 SIDE_CELL·SIDE_GAP 과 같고, 나머지 치수가 v2.css 의 줄 규칙과 같다", () => {
    expect(lib.HOST_RAIL_E2E.cell).toBe(SIDE_CELL);
    expect(lib.HOST_RAIL_E2E.gap).toBe(SIDE_GAP);
    expect(body(".mf-hostrail")).toContain("left: var(--space-md)");
    expect(/--space-md:\s*(\d+)px/.exec(tokens)?.[1]).toBe(String(lib.HOST_RAIL_E2E.left));
    expect(body(".mf-hostrail")).toContain(`top: calc(var(--mf-host-bottom, 62px) + ${lib.HOST_RAIL_E2E.gap}px)`);
    expect(body(".mf-hostrail[data-test-shift]")).toContain(`+ ${lib.HOST_RAIL_E2E.gap}px + ${lib.HOST_RAIL_E2E.testShift}px)`);
    expect(body(".mf-hostrail__crown")).toContain(`height: ${lib.HOST_RAIL_E2E.crownH}px`);
    expect(body(".mf-hostrail__crown")).toContain(`margin-bottom: ${lib.HOST_RAIL_E2E.gap}px`);
    expect(body(".mf-hostrail__cols")).toContain(`gap: ${lib.HOST_RAIL_E2E.gap}px`);
    expect(body(".mf-hostrail__col")).toContain(`gap: ${lib.HOST_RAIL_E2E.gap}px`);
    expect(body(".mv-hostrail-btn")).toContain("width: var(--control-button)");
    expect(/--control-button:\s*(\d+)px/.exec(tokens)?.[1]).toBe(String(lib.HOST_RAIL_E2E.cell));
  });

  it("hostRailLayoutE2E 가 n 0..5 × 최대 높이 100..600(4 간격)과 측정 전(무한)에서 앱 hostRailLayout 과 같다", () => {
    const diff: string[] = [];
    for (let n = 0; n <= 5; n++) {
      for (const maxH of [...Array.from({ length: 126 }, (_, i) => 100 + i * 4), Number.POSITIVE_INFINITY]) {
        const want = hostRailLayout(n, maxH);
        const got = lib.hostRailLayoutE2E(n, maxH);
        if (got.crown !== want.crown || got.columns.join(",") !== want.columns.join(",")) diff.push(`${n}@${maxH}`);
      }
    }
    expect(diff.slice(0, 5).join(" ")).toBe("");
  });

  it("줄의 접근성 이름은 '방장 전용' 이고 lib 의 사본과 같다", () => {
    expect(HOST_RAIL_LABEL).toBe("방장 전용");
    expect(readFileSync(new URL("scripts/e2e/lib.mjs", root), "utf8")).toContain(`const HOST_RAIL_NAME = "${HOST_RAIL_LABEL}";`);
  });

  it("방장 줄과 참가자 도구의 테두리가 토론 타일 색과 같다", () => {
    expect(lib.TOOL_ICON_RGB).toBe(rgbOf("--noir-paper"));
    expect(lib.TOOL_BORDER_RGBA).toBe("rgba(100, 115, 142, 0.65)");
    expect(tokens).toContain("--noir-control-line: #64738ea6");
    for (const selector of [".mv-hostrail-btn", ".mv-float", ".mv-sound"]) {
      expect(body(selector)).toContain("border: 1px solid var(--noir-control-line)");
      expect(body(selector)).toContain("color: var(--noir-paper)");
    }
  });

  it("판 종류 흐름(mode-rail·mode-pick·mode-basic·mode-leak)과 modes.mjs 는 없고 방장 줄 판정(hostRailChecks)은 lib.mjs 에 남아 map-select 가 쓴다", () => {
    const flows = readFileSync(new URL("scripts/e2e/flows.mjs", root), "utf8");
    expect(flows).not.toMatch(/id: "mode-/);
    expect(flows).not.toContain("modes.mjs");
    expect(execFileSync("git", ["ls-files", "scripts/e2e/modes.mjs"], { cwd: root, encoding: "utf8" }).trim()).toBe("");
    const libText = readFileSync(new URL("scripts/e2e/lib.mjs", root), "utf8");
    expect(libText).toMatch(/export function hostRailChecks\b/);
    for (const gone of ["modeChipChecks", "modeSheetChecks", "MODE_NAMES_E2E", "basicModeChecks"]) expect(libText, gone).not.toContain(gone);
    expect(readFileSync(new URL("scripts/e2e/mapselect.mjs", root), "utf8")).toContain("hostRailChecks");
  });

  it("대기실 패널 기대 높이(HR8)는 160 = lobbyPanelHeight(LOG_H) 이다", () => {
    expect(lib.lobbyPanelHeight(lib.LOG_H)).toBe(160);
  });

  it("DOM 표식 셋이 git 이 추적하는 src/ 에 있고 값은 enum 낱말뿐이다 — 좌석·역할 값이 실리지 않는다. 판 종류 표식은 src 에 없다", () => {
    expect(lib.HOST_RAIL_MARKERS.join(",")).toBe("data-host-rail,data-host-rail-btn,data-host-rail-crown");
    expect(lib.HOST_RAIL_MARKERS.filter((m) => !sources.some((s) => s.text.includes(m)))).toEqual([]);
    const text = (file: string): string => sources.find((s) => s.f.endsWith(file))!.text.replace(/\/\/.*$/gm, "");
    // 줄 단추 표식 값: HostRailButton 의 id 유니언 + MapChip 줄 변형의 "map" = HOST_RAIL_ORDER
    const union = /id: ((?:"[a-z]+"(?: \| )?)+);/.exec(text("components/v2/HostRailButton.tsx"))?.[1] ?? "";
    const ids = [...union.matchAll(/"([a-z]+)"/g)].map((m) => m[1]!);
    expect(text("components/v2/HostRailButton.tsx")).toContain("data-host-rail-btn={id}");
    expect(text("components/v2/MapChip.tsx")).toContain('"data-host-rail-btn": "map"');
    expect([...ids, "map"].sort().join(",")).toBe([...lib.HOST_RAIL_ORDER].sort().join(","));
    expect(lib.HOST_RAIL_ORDER.join(",")).toBe("map,bots");
    // 값 없는 표식 둘
    expect(text("components/v2/HostRail.tsx")).toContain('data-host-rail=""');
    expect(text("components/v2/HostRail.tsx")).toContain('data-host-rail-crown=""');
    for (const f of ["components/v2/HostRail.tsx", "components/v2/HostRailButton.tsx"]) expect(text(f), f).not.toMatch(/seat|nonce|mafia|police|doctor/i);
    // 판 종류 표식·부품은 src 어디에도 없다(22-07)
    expect(sources.filter((s) => /data-mode-(?:chip|sheet|card)/.test(s.text)).map((s) => s.f)).toEqual([]);
  });
});

