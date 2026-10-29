// 배경 장면 목록·단계→장면 규칙표·WebP 예산(결정 0030, 사용자 지시 V-04).
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DAY_ANNOUNCE_MS, PHASE_DEFS } from "../../shared/game/phases";
import type { PhaseId } from "../../shared/protocol";
import {
  HEADER_SCRIM_LENGTH_PX,
  HEADER_SCRIM_STOPS,
  NIGHT_VIGNETTE_ELLIPSE,
  NIGHT_VIGNETTE_FADE_MS,
  NIGHT_VIGNETTE_STOPS,
  PHASE_GUIDE_FILL,
  PHASE_INTRO,
  PHASE_SCENE,
  SCENES,
  SCENE_FADE_MS,
  SCENE_IMAGE_WAIT_MS,
  SCENE_INTRO_MS,
  SCENE_IDS,
  TIMELESS_PHASES,
  headerScrimGradient,
  nightVignetteGradient,
  sceneOfPhase,
} from "../../src/game/scenes";
// 타입 선언이 없는 .mjs 다(allowJs 없음). 모양은 아래 SourceRow 로 직접 적는다.
// @ts-expect-error -- 선언 없는 스크립트 모듈
import * as backdropScript from "../../scripts/make-backdrops.mjs";
// @ts-expect-error -- 선언 없는 스크립트 모듈
import * as e2eLib from "../../scripts/e2e/lib.mjs";

interface SourceRow {
  out: string;
  src: string;
  quality: number;
  maxKB: number;
}
const SOURCES = (backdropScript as { SOURCES: SourceRow[] }).SOURCES;

const KB = 1024;
const PHASES = Object.keys(PHASE_DEFS) as PhaseId[];

describe("장면 목록(SCENES)", () => {
  it("장면 여섯 개: lobby·night·morning·day·dusk·verdictDusk, 파일 이름 조각이 정해져 있다", () => {
    expect([...SCENE_IDS]).toEqual(["lobby", "night", "morning", "day", "dusk", "verdictDusk"]);
    expect(Object.keys(SCENES).sort()).toEqual([...SCENE_IDS].sort());
    expect(SCENES.lobby.file).toBe("lobby");
    expect(SCENES.night.file).toBe("night");
    expect(SCENES.morning.file).toBe("morning");
    expect(SCENES.day.file).toBe("day");
    expect(SCENES.dusk.file).toBe("dusk");
    expect(SCENES.verdictDusk.file).toBe("verdict_dusk");
  });

  it("실내 배경은 어떤 장면에도 헤더 막이 없고, entry 구도는 lobby 만 갖는다", () => {
    expect(SCENE_IDS.filter((id) => SCENES[id].scrim)).toEqual([]);
    expect(SCENE_IDS.filter((id) => SCENES[id].entry)).toEqual(["lobby"]);
  });
});

describe("단계 → 장면 규칙표(PHASE_SCENE)", () => {
  it("모든 단계를 덮는다 (4페이즈는 PhaseId 와 함께 행을 더하면 타입 오류가 알려 준다)", () => {
    expect(Object.keys(PHASE_SCENE).sort()).toEqual([...PHASES].sort());
  });

  it("대기실·배정·역할 확인은 lobby, 낮 시작·주장·토론은 day, 밤은 night, 아침은 morning, 투표·공개·변론·처형은 dusk, 판 종료는 night", () => {
    expect(PHASE_SCENE).toEqual({
      lobby: "lobby",
      assigning: "lobby",
      roleReveal: "lobby",
      dayAnnounce: "day",
      claim: "day",
      discussion: "day",
      night: "night",
      morning: "morning",
      execVote: "dusk",
      candidateVote: "dusk",
      candidateVoteReveal: "dusk",
      defense: "dusk",
      execution: "dusk",
      ended: "night",
    });
    for (const phase of PHASES) expect(sceneOfPhase(phase)).toBe(PHASE_SCENE[phase]);
  });

  it("dusk 는 투표·공개·변론·처형 다섯 단계를 가리키고 verdictDusk 는 등록만 남아 어떤 단계도 가리키지 않는다 (P-1·P-2, D-14·D-29)", () => {
    const used = new Set(Object.values(PHASE_SCENE));
    expect(used.has("verdictDusk")).toBe(false);
    expect(used.has("dusk")).toBe(true);
    expect(PHASES.filter((p) => PHASE_SCENE[p] === "dusk").sort()).toEqual(
      ["candidateVote", "candidateVoteReveal", "defense", "execVote", "execution"].sort(),
    );
    expect(PHASE_SCENE.ended).toBe("night");
    expect(SCENE_IDS).toContain("dusk");
    expect(SCENE_IDS).toContain("verdictDusk");
    expect(SCENES.verdictDusk.file).toBe("verdict_dusk");
  });
});

describe("E2E 기대 장면표(EXPECTED_SCENE)와 PHASE_SCENE", () => {
  it("scripts/e2e/lib.mjs 의 EXPECTED_SCENE 이 모든 단계에서 PHASE_SCENE 과 같다 (두 표가 어긋나면 B1 이 거짓 통과·거짓 실패한다)", () => {
    const expected = (e2eLib as { EXPECTED_SCENE: Record<string, string> }).EXPECTED_SCENE;
    expect(Object.keys(expected).sort()).toEqual([...PHASES].sort());
    for (const phase of PHASES) expect(expected[phase], phase).toBe(PHASE_SCENE[phase]);
  });
});

describe("단계별 시작 문구(PHASE_INTRO, 낮·밤 한 부품)", () => {
  it("밤과 낮 시작(dayAnnounce) 두 행뿐이고 다른 단계는 문구가 없다 (4페이즈는 행을 더한다)", () => {
    expect(Object.keys(PHASE_INTRO).sort()).toEqual(["dayAnnounce", "night"]);
    for (const phase of PHASES) {
      if (phase !== "night" && phase !== "dayAnnounce") expect(PHASE_INTRO[phase], phase).toBeUndefined();
    }
  });

  it("밤: 밤 톤·제목 `밤이 되었습니다`·보조줄 없음. 낮 시작: 낮 톤·제목 `낮이 되었습니다`·보조줄 `토론 전에 먼저 직업을 공개해요`", () => {
    expect(PHASE_INTRO.night).toEqual({ tone: "night", title: "밤이 되었습니다" });
    expect(PHASE_INTRO.dayAnnounce).toEqual({ tone: "day", title: "낮이 되었습니다", sub: "토론 전에 먼저 직업을 공개해요" });
  });

  it("문구가 떠 있는 시간 SCENE_INTRO_MS 는 서버 낮 시작 단계 길이(DAY_ANNOUNCE_MS = 2000)와 같다", () => {
    expect(SCENE_INTRO_MS).toBe(DAY_ANNOUNCE_MS);
    expect(SCENE_INTRO_MS).toBe(2000);
  });
});

describe("전환 상수와 헤더 막", () => {
  it("크로스페이드 0.8초(--dur-slow 와 같다), 새 그림을 기다리는 상한 1.2초", () => {
    expect(SCENE_FADE_MS).toBe(800);
    expect(SCENE_IMAGE_WAIT_MS).toBe(1200);
    expect(readFileSync("src/styles/tokens.css", "utf8")).toContain("--dur-slow: 800ms;");
  });

  it("HEADER_SCRIM_STOPS: 시안 .66/.42/.18/0 에서 .70/.58/.40/0, 새 배경(v3)에서 .80/.70/.55/0 으로 올렸다 (사용자 규칙 4.5:1, 길이 150px 은 그대로)", () => {
    expect(HEADER_SCRIM_STOPS).toEqual([
      [0, 0.8],
      [60, 0.7],
      [110, 0.55],
      [150, 0],
    ]);
    expect(HEADER_SCRIM_LENGTH_PX).toBe(150);
    expect(HEADER_SCRIM_STOPS.at(-1)![0]).toBe(HEADER_SCRIM_LENGTH_PX);
  });

  it("headerScrimGradient(): night-900 토큰 color-mix 를 쓰고 150px 끝이 투명이다", () => {
    expect(headerScrimGradient()).toBe(
      "linear-gradient(to bottom, " +
        "color-mix(in srgb, var(--night-900) 80%, transparent) 0px, " +
        "color-mix(in srgb, var(--night-900) 70%, transparent) 60px, " +
        "color-mix(in srgb, var(--night-900) 55%, transparent) 110px, " +
        "color-mix(in srgb, var(--night-900) 0%, transparent) 150px)",
    );
    expect(headerScrimGradient()).not.toMatch(/#[0-9a-f]{3,8}/i);
  });
});

// ---- 5페이즈 두 층: 밤 비네팅·아침 밝아짐 (05-03, LOOK-01, D-05) ----

describe("밤 비네팅 상수와 그라데이션 (P5-1 확정)", () => {
  it("타원·멈춤·시간 상수가 UI-SPEC 9.3 값이고 켜짐·꺼짐 시간은 배경 크로스페이드와 같다", () => {
    expect(NIGHT_VIGNETTE_ELLIPSE).toBe("70% 60% at 50% 44%");
    expect(NIGHT_VIGNETTE_STOPS.map((s) => [...s])).toEqual([
      [0, 0],
      [45, 0],
      [75, 0.4],
      [100, 0.72],
    ]);
    expect(NIGHT_VIGNETTE_FADE_MS).toBe(SCENE_FADE_MS);
  });

  it("nightVignetteGradient(): night-950 토큰 color-mix 방사형이고 # 색 값이 없다", () => {
    expect(nightVignetteGradient()).toBe(
      "radial-gradient(ellipse 70% 60% at 50% 44%, " +
        "color-mix(in srgb, var(--night-950) 0%, transparent) 0%, " +
        "color-mix(in srgb, var(--night-950) 0%, transparent) 45%, " +
        "color-mix(in srgb, var(--night-950) 40%, transparent) 75%, " +
        "color-mix(in srgb, var(--night-950) 72%, transparent) 100%)",
    );
    expect(nightVignetteGradient()).not.toContain("#");
  });
});

// ---- WebP 파일과 용량 예산 ----

const EXPECTED_FILES = [
  "bg_entry_lobby.webp",
  "bg_game_day.webp",
  "bg_game_dusk.webp",
  "bg_game_lobby.webp",
  "bg_game_morning.webp",
  "bg_game_night.webp",
  "bg_game_verdict_dusk.webp",
];
const LIMIT_KB: Record<string, number> = {
  "bg_game_lobby.webp": 40,
  "bg_game_night.webp": 40,
  "bg_game_dusk.webp": 40,
  "bg_game_verdict_dusk.webp": 40,
  "bg_game_morning.webp": 40,
  "bg_game_day.webp": 40,
  "bg_entry_lobby.webp": 52,
};
const TOTAL_LIMIT_KB = 260;

describe("public/backgrounds (WebP 일곱 개, 옛 SVG 는 없다)", () => {
  it("정확히 WebP 일곱 개뿐이고 SVG 는 없다 (원본은 design/ 에만)", () => {
    expect(readdirSync("public/backgrounds").sort()).toEqual(EXPECTED_FILES);
  });

  it("각 파일은 RIFF…WEBP 머리를 갖는다", () => {
    for (const name of EXPECTED_FILES) {
      const head = readFileSync(`public/backgrounds/${name}`).subarray(0, 12);
      expect(head.subarray(0, 4).toString("latin1"), `${name} RIFF`).toBe("RIFF");
      expect(head.subarray(8, 12).toString("latin1"), `${name} WEBP`).toBe("WEBP");
    }
  });

  it("장면 하나 ≤ 상한(game 40KB · entry 52KB), 합계 ≤ 260KB", () => {
    let total = 0;
    for (const name of EXPECTED_FILES) {
      const size = statSync(`public/backgrounds/${name}`).size;
      total += size;
      expect(size, `${name} ${(size / KB).toFixed(1)}KB`).toBeLessThanOrEqual(LIMIT_KB[name]! * KB);
    }
    expect(total / KB).toBeLessThanOrEqual(TOTAL_LIMIT_KB);
  });

  it("원본(design/backgrounds/A_cute·v2·v3)은 그대로 남아 있다", () => {
    expect(existsSync("design/backgrounds/A_cute/bg_entry_lobby.svg")).toBe(true);
    expect(existsSync("design/backgrounds/v2/set2/bg_game_night.png")).toBe(true);
    expect(existsSync("design/backgrounds/v2/set1/bg_game_day.jpg")).toBe(true);
    expect(existsSync("design/backgrounds/v3/bg_game_night.png")).toBe(true);
    expect(existsSync("design/backgrounds/v4/bg_game_night.png")).toBe(true);
    expect(existsSync("design/backgrounds/v5/bg_game_night.png")).toBe(true);
  });
});

describe("scripts/make-backdrops.mjs (SOURCES)", () => {
  const expectedNames = [...SCENE_IDS.map((id) => `bg_game_${SCENES[id].file}.webp`), "bg_entry_lobby.webp"].sort();

  it("출력 이름이 장면 목록과 일치한다 (game 여섯 + entry lobby)", () => {
    expect(SOURCES.map((s) => s.out).sort()).toEqual(expectedNames);
    expect(SOURCES.map((s) => s.out).sort()).toEqual(EXPECTED_FILES);
  });

  it("원본이 있다: 게임 구도는 design/backgrounds/v5(실내 V2), 입구 구도는 v3", () => {
    for (const s of SOURCES) {
      const isEntry = s.out.startsWith("bg_entry_");
      expect(s.src.startsWith(isEntry ? "design/backgrounds/v3/" : "design/backgrounds/v5/"), s.src).toBe(true);
      expect(existsSync(s.src), s.src).toBe(true);
    }
  });

  it("품질 86, 상한은 장면별 예산과 같다", () => {
    for (const s of SOURCES) {
      expect(s.quality).toBe(86);
      expect(s.maxKB, s.out).toBe(LIMIT_KB[s.out]);
    }
  });
});

describe("캐시 규칙", () => {
  it("public/_headers 에 /backgrounds/* 규칙과 max-age=86400 이 있다 (.webp 에도 적용)", () => {
    const headers = readFileSync("public/_headers", "utf8");
    expect(headers).toMatch(/\/backgrounds\/\*\s+Cache-Control: public, max-age=86400/);
  });
});

describe("PHASE_GUIDE_FILL·TIMELESS_PHASES (UX-01 빈 칸 채움, 05-UI-SPEC 7.2)", () => {
  it("낮 시작 하단 두 줄과 토론 헤더 문장이 상수 한 곳에 있다", () => {
    expect(PHASE_GUIDE_FILL.dayAnnounce).toEqual({ title: "낮이 되었어요", guide: "곧 직업 공개가 시작돼요" });
    expect(PHASE_GUIDE_FILL.discussion(1)).toBe("1일차 · 의견을 나눠요");
  });

  it("토론 헤더 문장은 99일차에서도 14자 이하다 (헤더 안내줄 nowrap)", () => {
    expect([...PHASE_GUIDE_FILL.discussion(99)].length).toBeLessThanOrEqual(14);
  });

  it("객체는 동결돼 있다", () => {
    expect(Object.isFrozen(PHASE_GUIDE_FILL)).toBe(true);
    expect(Object.isFrozen(PHASE_GUIDE_FILL.dayAnnounce)).toBe(true);
  });

  it("TIMELESS_PHASES 는 lobby·assigning·ended 순서의 동결 배열이다", () => {
    expect([...TIMELESS_PHASES]).toEqual(["lobby", "assigning", "ended"]);
    expect(Object.isFrozen(TIMELESS_PHASES)).toBe(true);
  });
});
