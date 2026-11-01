import { describe, expect, it } from "vitest";
import {
  CHAT_BURST_MAX,
  CHAT_BURST_WINDOW_MS,
  CHAT_MAX_GRAPHEMES,
  CHAT_MIN_GAP_MS,
  CHAT_REPEAT_MS,
  TYPING_MIN_GAP_MS,
  checkChatSend,
  sanitizeChatText,
  typingRelay,
} from "../../shared/game/chatRules";
import type { ChatSenderRate } from "../../shared/game/chatRules";

// 보이지 않는 문자는 소스에 날것으로 넣지 않고 \u 이스케이프로 쓴다.
// 비교는 스칼라 값(문자열·불리언)으로 한다 — 여러 줄 diff 는 TAP 보고서를 깨뜨린다.
const FAMILY = "\u{1F468}‍\u{1F469}‍\u{1F467}"; // 가족 이모지: 자소 1개, ZWJ 포함

function textOf(raw: string): string {
  const r = sanitizeChatText(raw);
  return r.ok ? r.text : `REJECT:${r.why}`;
}

/** 수락만 이어 붙인다. 거절되면 테스트 준비가 틀린 것이다. */
function accept(prev: ChatSenderRate | undefined, text: string, now: number): ChatSenderRate {
  const r = checkChatSend(prev, text, now);
  if (!r.ok) throw new Error(`expected accept at ${now}: ${r.why}`);
  return r.next;
}

function whyOf(prev: ChatSenderRate | undefined, text: string, now: number): string {
  const r = checkChatSend(prev, text, now);
  return r.ok ? "ok" : r.why;
}

describe("상수 (UI-SPEC D5 시작값, 한 곳)", () => {
  it("값", () => {
    expect(CHAT_MAX_GRAPHEMES).toBe(100);
    expect(CHAT_MIN_GAP_MS).toBe(600);
    expect(CHAT_BURST_WINDOW_MS).toBe(5000);
    expect(CHAT_BURST_MAX).toBe(5);
    expect(CHAT_REPEAT_MS).toBe(3000);
    expect(TYPING_MIN_GAP_MS).toBe(1500);
  });
});

describe("sanitizeChatText", () => {
  it("탭·줄바꿈은 공백이 되고 공백을 접어 앞뒤를 자른다", () => {
    expect(textOf("  안녕\t하세요\n ")).toBe("안녕 하세요");
    expect(textOf("한\r\n\r\n줄")).toBe("한 줄");
    expect(textOf("a b c")).toBe("a b c");
  });

  it("방향 제어(U+202E)와 영폭 공백(U+200B)은 공백이 된다", () => {
    expect(textOf("‮역방향")).toBe("역방향");
    expect(textOf("a​b")).toBe("a b");
    expect(textOf("a⁦b﻿c")).toBe("a b c");
  });

  it("ZWJ(가족 이모지)는 보존한다", () => {
    expect(textOf(FAMILY)).toBe(FAMILY);
    expect(textOf(`가${FAMILY}나`)).toBe(`가${FAMILY}나`);
  });

  it("보이는 글자가 없으면 other: 공백만·영폭 공백만·채움 문자만", () => {
    expect(textOf("   ")).toBe("REJECT:other");
    expect(textOf("")).toBe("REJECT:other");
    expect(textOf("​")).toBe("REJECT:other");
    expect(textOf("​​ ​")).toBe("REJECT:other");
    expect(textOf("ㅤㅤ")).toBe("REJECT:other");
    expect(textOf("ᅟᅠﾠ⠀")).toBe("REJECT:other");
    expect(textOf(" ㅤ ​ ")).toBe("REJECT:other");
  });

  it("글자 사이의 채움 문자는 공백으로 접힌다 (화면에 빈칸으로 보이는 위장을 막는다)", () => {
    expect(textOf("가ㅤㅤ나")).toBe("가 나");
  });

  it("자소 100개까지 ok, 101개는 length", () => {
    expect(textOf("가".repeat(100)).length).toBe(100);
    expect(textOf("가".repeat(101))).toBe("REJECT:length");
  });

  it("가족 이모지 100개(자소 100)는 ok, 101개는 length", () => {
    expect(textOf(FAMILY.repeat(100)) === FAMILY.repeat(100)).toBe(true);
    expect(textOf(FAMILY.repeat(101))).toBe("REJECT:length");
  });

  it("공백을 접은 뒤의 길이로 센다", () => {
    expect(textOf(`${"가".repeat(100)}     `)).toBe("가".repeat(100));
    expect(textOf(`가${" ".repeat(300)}나`)).toBe("가 나");
  });

  it("NFC: 분해된 한글 자모가 완성형으로 합쳐진다", () => {
    expect(textOf("한")).toBe("한");
    expect(textOf("가")).toBe("가");
  });

  it("같은 입력에 같은 결과 (전역 정규식의 lastIndex 가 남지 않는다)", () => {
    const results = ["a​b", "a​b", "a​b"].map(textOf);
    expect(results.join("|")).toBe("a b|a b|a b");
    const visible = ["안녕", "안녕", "​", "안녕"].map(textOf);
    expect(visible.join("|")).toBe("안녕|안녕|REJECT:other|안녕");
  });
});

describe("checkChatSend", () => {
  it("첫 전송은 ok", () => {
    expect(whyOf(undefined, "가", 1000)).toBe("ok");
  });

  it("같은 사람 600ms 간격: 599ms 는 rate, 600ms 는 ok (마지막 수락 기준)", () => {
    const s = accept(undefined, "가", 1000);
    expect(whyOf(s, "나", 1599)).toBe("rate");
    expect(whyOf(s, "나", 1600)).toBe("ok");
  });

  it("5초 창에 5줄까지 수락, 여섯 번째는 rate", () => {
    let s: ChatSenderRate | undefined;
    const times = [0, 600, 1200, 1800, 2400];
    times.forEach((t, i) => {
      s = accept(s, `문장${i}`, t);
    });
    expect(whyOf(s, "문장5", 3000)).toBe("rate");
    expect(whyOf(s, "문장5", 4999)).toBe("rate");
  });

  it("첫 줄로부터 5000ms 지나면 다시 ok", () => {
    let s: ChatSenderRate | undefined;
    [0, 600, 1200, 1800, 2400].forEach((t, i) => {
      s = accept(s, `문장${i}`, t);
    });
    expect(whyOf(s, "문장5", 5000)).toBe("ok");
  });

  it("같은 문장은 3초 안에 repeat: 2999ms 는 repeat, 3000ms 는 ok", () => {
    const s = accept(undefined, "가", 1000);
    expect(whyOf(s, "가", 3999)).toBe("repeat");
    expect(whyOf(s, "가", 4000)).toBe("ok");
  });

  it("다른 문장은 repeat 아님", () => {
    const s = accept(undefined, "가", 1000);
    expect(whyOf(s, "나", 1700)).toBe("ok");
  });

  it("거절된 전송은 입력 기록을 바꾸지 않는다", () => {
    const s = accept(undefined, "가", 1000);
    const before = JSON.stringify(s);
    expect(whyOf(s, "나", 1100)).toBe("rate");
    expect(whyOf(s, "가", 2000)).toBe("repeat");
    expect(JSON.stringify(s)).toBe(before);
    const r = checkChatSend(s, "나", 1100);
    expect("next" in r).toBe(false);
  });

  it("거절된 시도는 간격 기준을 미루지 않는다 (마지막 수락 시각 기준)", () => {
    const s = accept(undefined, "가", 1000);
    expect(whyOf(s, "나", 1500)).toBe("rate");
    expect(whyOf(s, "나", 1600)).toBe("ok"); // 1500 의 거절이 기준을 1500 으로 옮겼다면 rate 였을 것이다
  });

  it("거절된 시도는 5초 창을 채우지 않는다", () => {
    let s: ChatSenderRate | undefined;
    [0, 600, 1200, 1800].forEach((t, i) => {
      s = accept(s, `문장${i}`, t);
    });
    for (let t = 1900; t < 2400; t += 100) expect(whyOf(s, "빠른", t)).toBe("rate");
    s = accept(s, "문장4", 2400);
    expect(whyOf(s, "문장5", 3000)).toBe("rate"); // 수락 5줄 때문이지 거절 횟수 때문이 아니다
  });

  it("입력 기록 객체를 바꾸지 않는다 (새 객체)", () => {
    const s = accept(undefined, "가", 1000);
    const next = accept(s, "나", 2000);
    expect(next === s).toBe(false);
    expect(JSON.stringify(s)).toBe(JSON.stringify(accept(undefined, "가", 1000)));
  });

  it("사람마다 따로: 다른 사람의 기록은 서로 영향이 없다", () => {
    const a = accept(undefined, "가", 1000);
    expect(whyOf(undefined, "가", 1100)).toBe("ok"); // b 는 기록이 없다
    expect(whyOf(a, "가", 1100)).toBe("rate");
  });
});

describe("typingRelay", () => {
  it("처음 켜짐은 중계", () => {
    const r = typingRelay(undefined, true, 0);
    expect(r.relay).toBe(true);
    expect(r.next.on).toBe(true);
  });

  it("켜짐은 1.5초에 한 번만: 1499ms 는 안 함(기록 불변), 1500ms 는 중계", () => {
    const first = typingRelay(undefined, true, 0).next;
    const quiet = typingRelay(first, true, 1499);
    expect(quiet.relay).toBe(false);
    expect(JSON.stringify(quiet.next)).toBe(JSON.stringify(first));
    const again = typingRelay(first, true, 1500);
    expect(again.relay).toBe(true);
    expect(again.next.lastOnAt).toBe(1500);
  });

  it("1.5초는 마지막 중계 기준이다 (무시된 신호가 기준을 미루지 않는다)", () => {
    let s = typingRelay(undefined, true, 0).next;
    s = typingRelay(s, true, 1000).next;
    expect(typingRelay(s, true, 1500).relay).toBe(true);
  });

  it("꺼짐은 켜져 있을 때만 중계", () => {
    const on = typingRelay(undefined, true, 0).next;
    const off = typingRelay(on, false, 100);
    expect(off.relay).toBe(true);
    expect(off.next.on).toBe(false);
    expect(typingRelay(off.next, false, 200).relay).toBe(false);
    expect(typingRelay(undefined, false, 200).relay).toBe(false);
  });

  it("꺼짐은 간격 제한을 받지 않는다 (켠 직후라도 중계)", () => {
    const on = typingRelay(undefined, true, 0).next;
    expect(typingRelay(on, false, 1).relay).toBe(true);
  });

  it("끈 뒤 다시 켜는 것도 1.5초 안이면 조용히 거른다", () => {
    const on = typingRelay(undefined, true, 0).next;
    const off = typingRelay(on, false, 100).next;
    expect(typingRelay(off, true, 800).relay).toBe(false);
    expect(typingRelay(off, true, 1500).relay).toBe(true);
  });

  it("입력 기록 객체를 바꾸지 않는다", () => {
    const on = typingRelay(undefined, true, 0).next;
    const before = JSON.stringify(on);
    typingRelay(on, false, 100);
    typingRelay(on, true, 2000);
    expect(JSON.stringify(on)).toBe(before);
  });
});
