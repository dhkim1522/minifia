import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  AUTO_SCROLL_SLOP_PX,
  CHAT_KEEP_LINES,
  DUP_SUBMIT_MS,
  IME_WAIT_MS,
  KB_OPEN_MIN_LIFT,
  KB_PANEL_H,
  CHAT_PANEL_EXTRA,
  LOBBY_PANEL_EXTRA,
  LOG_H,
  LOG_H_KB,
  LOG_H_SHORT,
  LOG_H_TALL,
  NOTICE_MS,
  SEND_DIM_MS,
  TALL_ROOM_MIN_H,
  TAIL_WINDOW_MS,
  TYPING_EXPIRE_MS,
  TYPING_IDLE_OFF_MS,
  TYPING_PILL_H,
  TYPING_REFRESH_MS,
  lobbyPanelHeight,
  logHeightFor,
} from "../../src/game/chatUi";

// 07-03 Task 3: 채팅 패널 치수·시각 상수 한 곳 (07-UI-SPEC 구조 표). DOM 을 읽지 않는 상수·순수 함수뿐이다.

describe("logHeightFor — 기록 칸 고정 높이 (UI-SPEC 구조)", () => {
  it("방 높이 779 는 96, 780 은 152 — 경계는 780", () => {
    expect(TALL_ROOM_MIN_H).toBe(780);
    expect(logHeightFor(779)).toBe(96);
    expect(logHeightFor(780)).toBe(152);
  });

  it("작은 값·큰 값도 같은 규칙이다", () => {
    expect(logHeightFor(560)).toBe(LOG_H_SHORT);
    expect(logHeightFor(932)).toBe(LOG_H_TALL);
  });

  it("키보드 열림 기록 칸은 72 이다", () => {
    expect(LOG_H_KB).toBe(72);
  });
});

describe("패널 높이 식 (18.1 B 계약 4 — 기록 칸 68 한 값)", () => {
  it("기록 칸 68 = 24 × 2 + 4 + 8 × 2", () => {
    expect(LOG_H).toBe(68);
    expect(LOG_H).toBe(24 * 2 + 4 + 8 * 2);
  });

  it("로비 패널 = LOG_H + 154, 14 + 8 + 48 + 10 + 52 + 22 에서 나온다 — 대기실 손님 222·방장 298", () => {
    expect(LOBBY_PANEL_EXTRA).toBe(154);
    expect(LOBBY_PANEL_EXTRA).toBe(14 + 8 + 48 + 10 + 52 + 22);
    expect(lobbyPanelHeight(LOG_H)).toBe(222);
    expect(lobbyPanelHeight(LOG_H, true)).toBe(298);
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

describe("chatUi.ts 는 DOM 을 읽지 않는다", () => {
  it("window·document·navigator 참조가 없다", () => {
    const code = readFileSync("src/game/chatUi.ts", "utf8")
      .split("\n")
      .filter((l) => !/^\s*(\/\/|\*)/.test(l))
      .join("\n");
    expect(/\b(window|document|navigator|visualViewport)\b/.test(code), "DOM 참조").toBe(false);
  });
});
