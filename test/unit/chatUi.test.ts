import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  AUTO_SCROLL_SLOP_PX,
  CHAT_KEEP_LINES,
  DUP_SUBMIT_MS,
  IME_WAIT_MS,
  KB_OPEN_MIN_LIFT,
  KB_PANEL_H,
  KB_PANEL_REST,
  LOG_OPEN_MAX,
  OPEN_STAGE_MIN,
  openLogHeight,
  CHAT_PANEL_EXTRA,
  LOBBY_PANEL_EXTRA,
  LOG_H,
  NOTICE_MS,
  SEND_DIM_MS,
  TAIL_WINDOW_MS,
  TYPING_EXPIRE_MS,
  TYPING_IDLE_OFF_MS,
  TYPING_PILL_H,
  TYPING_REFRESH_MS,
  lobbyPanelHeight,
} from "../../src/game/chatUi";

// 07-03 Task 3: 채팅 패널 치수·시각 상수 한 곳 (07-UI-SPEC 구조 표). DOM 을 읽지 않는 상수·순수 함수뿐이다.

describe("패널 높이 식 (18.1 B 계약 4 — 기록 칸 68 한 값)", () => {
  it("기록 칸 68 = 24 × 2 + 4 + 8 × 2", () => {
    expect(LOG_H).toBe(68);
    expect(LOG_H).toBe(24 * 2 + 4 + 8 * 2);
  });

  it("로비 패널 = LOG_H + 154, 14 + 8 + 48 + 10 + 52 + 22 에서 나온다 — 대기실 손님 222·방장 276", () => {
    expect(LOBBY_PANEL_EXTRA).toBe(154);
    expect(LOBBY_PANEL_EXTRA).toBe(14 + 8 + 48 + 10 + 52 + 22);
    expect(lobbyPanelHeight(LOG_H)).toBe(222);
    expect(LOBBY_HOST_TUTORIAL_EXTRA).toBe(54); // 스위치 줄 44 + 간격 10 (18.1-15, 0083-3)
    expect(lobbyPanelHeight(LOG_H, true)).toBe(276);
  });

  it("채팅 패널 = LOG_H + 92, 14 + 8 + 48 + 22 에서 나온다 — 160", () => {
    expect(CHAT_PANEL_EXTRA).toBe(92);
    expect(CHAT_PANEL_EXTRA).toBe(14 + 8 + 48 + 22);
    expect(LOG_H + CHAT_PANEL_EXTRA).toBe(160);
  });

  it("키보드 열림 패널 146 = 14 + LOG_H + 8 + 48 + 8, 열림 판정 lift > 80", () => {
    expect(KB_PANEL_H).toBe(146);
    expect(KB_PANEL_H).toBe(14 + LOG_H + 8 + 48 + 8);
    expect(KB_OPEN_MIN_LIFT).toBe(80);
  });

  it("입력 중 칸 22px", () => {
    expect(TYPING_PILL_H).toBe(22);
  });
});

describe("클라이언트 시각 상수 (UI-SPEC 입력 중·보내기·막힘·IME)", () => {
  it("값이 UI-SPEC 과 같다", () => {
    expect(SEND_DIM_MS).toBe(600);
    expect(NOTICE_MS).toBe(2500);
    expect(TYPING_EXPIRE_MS).toBe(4500);
    expect(TYPING_IDLE_OFF_MS).toBe(4000);
    expect(TYPING_REFRESH_MS).toBe(2000);
    expect(IME_WAIT_MS).toBe(100);
    expect(DUP_SUBMIT_MS).toBe(300);
    expect(AUTO_SCROLL_SLOP_PX).toBe(24);
    expect(CHAT_KEEP_LINES).toBe(100);
  });

  it("보낸 직후 꼬리 글자 판정 창은 500ms (가정 A2)", () => {
    expect(TAIL_WINDOW_MS).toBe(500);
  });

  it("입력 멈춤 끔(4.0초)은 서버 만료(4.5초)보다 먼저다", () => {
    expect(TYPING_IDLE_OFF_MS).toBeLessThan(TYPING_EXPIRE_MS);
    expect(TYPING_REFRESH_MS).toBeLessThan(TYPING_IDLE_OFF_MS);
  });
});

describe("기록 칸 높이의 출처는 LOG_H 하나 (18.1 B 계약 4 폐지)", () => {
  it("방 높이로 기록 칸을 고르던 옛 이름 다섯 개가 export 에 없다", async () => {
    const keys = Object.keys(await import("../../src/game/chatUi"));
    for (const gone of ["LOG_H_SHORT", "LOG_H_TALL", "LOG_H_KB", "TALL_ROOM_MIN_H", "logHeightFor"]) expect(keys).not.toContain(gone);
  });

  it("남기는 이름은 그대로 있다", async () => {
    const keys = Object.keys(await import("../../src/game/chatUi"));
    for (const kept of ["LOG_H", "LOG_FADE_H", "KB_PANEL_H", "LOBBY_PANEL_EXTRA", "CHAT_PANEL_EXTRA", "LOBBY_HOST_TUTORIAL_EXTRA", "lobbyPanelHeight"]) expect(keys).toContain(kept);
  });
});

describe("늘어난 기록 칸 높이 openLogHeight (0083-4)", () => {
  it("상수: 상한 300·스테이지 최소 120·키보드 패널의 기록 칸 밖 높이 78, KB_PANEL_H 는 LOG_H + KB_PANEL_REST", () => {
    expect(LOG_OPEN_MAX).toBe(300);
    expect(OPEN_STAGE_MIN).toBe(120);
    expect(KB_PANEL_REST).toBe(14 + 8 + 48 + 8);
    expect(KB_PANEL_H).toBe(LOG_H + KB_PANEL_REST);
  });

  it.each([
    [{ roomH: 844, lift: 0, hostBottom: 126, panelRest: 154 }, 300],
    [{ roomH: 844, lift: 336, hostBottom: 126, panelRest: 78 }, 184],
    [{ roomH: 640, lift: 0, hostBottom: 126, panelRest: 154 }, 240],
    [{ roomH: 640, lift: 260, hostBottom: 126, panelRest: 78 }, 68],
    [{ roomH: 560, lift: 260, hostBottom: 126, panelRest: 78 }, 68],
  ])("openLogHeight(%j) = %i", (input, want) => {
    expect(openLogHeight(input)).toBe(want);
  });

  it("결과는 언제나 정수이고 LOG_H 이상 LOG_OPEN_MAX 이하다", () => {
    for (const roomH of [400, 560, 600.5, 667, 740, 844, 1200])
      for (const lift of [0, 120, 333.3])
        for (const panelRest of [78, 154, 230]) {
          const h = openLogHeight({ roomH, lift, hostBottom: 125.4, panelRest });
          expect(Number.isInteger(h)).toBe(true);
          expect(h).toBeGreaterThanOrEqual(LOG_H);
          expect(h).toBeLessThanOrEqual(LOG_OPEN_MAX);
        }
  });
});

describe("chatUi.ts 는 DOM 을 읽지 않는다", () => {
  it("window·document·navigator 참조가 없다", () => {
    const code = readFileSync("src/game/chatUi.ts", "utf8")
      .split("\n")
      .filter((l) => !/^\s*(\/\/|\*)/.test(l))
      .join("\n");
    expect(/\b(window|document|navigator|visualViewport)\b/.test(code), "DOM 참조").toBe(false);
  });
});
