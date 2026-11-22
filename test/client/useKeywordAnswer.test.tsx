// 제시어 입력 훅의 단계 시작, 남은 시간, 초안 저장, 확정, 금지 단서 안내를 가짜 시계와 서버 응답으로 확인한다.
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bindSignals, type LocalSignal } from "../../src/audio/signals";
import { KEYWORD_MS } from "../../shared/game/phases";
import type { ClientMessage, RoomView } from "../../shared/protocol";
import type { RoomEvent } from "../../src/net/useRoomConnection";
import { useKeywordAnswer, KEYWORD_AUTOSAVE_MS, KEYWORD_BLOCKED_COPY, KEYWORD_LAST_SEND_LEAD_MS, KEYWORD_NOTICE_MS } from "../../src/net/useKeywordAnswer";

const NOW = 1_700_000_000_000;
const DURATION = KEYWORD_MS;

function makeView(opts: { elapsed?: number; answer?: RoomView["me"]["answer"]; word?: string; role?: "mafia" | "citizen" } = {}): RoomView {
  const endsAt = NOW - (opts.elapsed ?? 0) + DURATION;
  return {
    code: "0042",
    phase: "keyword",
    phaseEndsAt: endsAt,
    phaseDurationMs: DURATION,
    serverNow: NOW,
    minPlayers: 4,
    maxPlayers: 8,
    players: [
      { seat: 0, nickname: "지우", connected: true, isHost: true, alive: true },
      { seat: 1, nickname: "하윤", connected: true, isHost: false, alive: true },
      { seat: 2, nickname: "민지", connected: true, isHost: false, alive: true },
      { seat: 3, nickname: "도현", connected: true, isHost: false, alive: true },
    ],
    me: { seat: 0, isHost: true, role: opts.role ?? "citizen", ...(opts.answer ? { answer: opts.answer } : {}), ...(opts.word ? { keyword: opts.word } : {}) },
    day: { n: 1, roles: ["mafia", "police", "doctor", "citizen"], keyword: { genre: "영화" } },
  } as RoomView;
}

interface Harness {
  sent: ClientMessage[];
  emit: (e: RoomEvent) => void;
}

function setup(initial: RoomView, opts: { canSend?: boolean; offset?: number } = {}) {
  const sent: ClientMessage[] = [];
  const listeners = new Set<(e: RoomEvent, meta: { epoch: number }) => void>();
  const send = (m: ClientMessage): boolean => {
    sent.push(m);
    return true;
  };
  const onEvent = (l: (e: RoomEvent, meta: { epoch: number }) => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  };
  const h: Harness = { sent, emit: (e) => listeners.forEach((l) => l(e, { epoch: 0 })) };
  const hook = renderHook(
    ({ view }: { view: RoomView }) => useKeywordAnswer({ view, send, canSend: opts.canSend ?? true, offset: opts.offset ?? 0, onEvent }),
    { initialProps: { view: initial } },
  );
  return { ...hook, ...h };
}

beforeEach(() => {
  vi.useFakeTimers({ now: NOW });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const errorFrame = (code = "BAD_MESSAGE"): RoomEvent => ({ t: "error", code, message: "x" }) as RoomEvent;

describe("단계 시작과 입력 가능 시간", () => {
  it("단계 안내 중에는 잠기고 서버 시작 시각부터 바로 단서를 받는다", () => {
    const t = setup({ ...makeView({ elapsed: -1_000 }), phaseStartsAt: NOW + 1_000 });
    expect(t.result.current.state).toBe("locked");
    expect(t.result.current.callInput).toBe(false);
    act(() => t.result.current.setValue("안경"));
    act(() => t.result.current.submit());
    expect(t.sent.filter((m) => m.t === "answer" && m.final)).toHaveLength(0);
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(t.result.current.state).toBe("open");
    expect(t.result.current.callInput).toBe(true);
  });

  it("남은 초는 마감 기준 올림이고 서버 시각 offset 을 반영한다", () => {
    const t = setup(makeView());
    expect(t.result.current.secondsLeft).toBe(35);
    expect(t.result.current.state).toBe("open");
    act(() => {
      vi.advanceTimersByTime(4_000);
    });
    expect(t.result.current.secondsLeft).toBe(31);
  });

  it("처음 한 글자를 쓰면 callInput 이 꺼진다", () => {
    const t = setup(makeView({ elapsed: 5_000 }));
    expect(t.result.current.callInput).toBe(true);
    act(() => t.result.current.setValue("안"));
    expect(t.result.current.callInput).toBe(false);
  });
});

describe("초안 자동 저장 (P23-14)", () => {
  it("입력 600ms 뒤 한 번 final:false 로 보내고 같은 글이면 다시 보내지 않는다", () => {
    const t = setup(makeView({ elapsed: 5_000 }));
    act(() => t.result.current.setValue("안경"));
    act(() => {
      vi.advanceTimersByTime(KEYWORD_AUTOSAVE_MS - 1);
    });
    expect(t.sent).toHaveLength(0);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(t.sent).toEqual([{ t: "answer", text: "안경", final: false }]);
    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    expect(t.sent).toHaveLength(1);
  });

  it("마감 700ms 전에 서버 초안(me.answer)과 다르면 한 번 더 보낸다", () => {
    const t = setup(makeView({ elapsed: 4_000, answer: { text: "옛", final: false } }));
    act(() => t.result.current.setValue("안경"));
    act(() => {
      vi.advanceTimersByTime(KEYWORD_AUTOSAVE_MS);
    });
    expect(t.sent).toHaveLength(1);
    // 서버가 초안을 아직 안 돌려줬어도 같은 글은 다시 보내지 않는다 — 마감 직전 전송도 건너뛴다
    act(() => {
      vi.advanceTimersByTime(DURATION - 4_000 - KEYWORD_AUTOSAVE_MS - KEYWORD_LAST_SEND_LEAD_MS + 50);
    });
    expect(t.sent).toHaveLength(1);
  });

  it("디바운스가 마감을 넘기는 늦은 입력도 마감 700ms 전에 한 번 보내고, 뒤의 디바운스는 같은 글이라 다시 보내지 않는다", () => {
    const t = setup(makeView({ elapsed: DURATION - 4_000 })); // 마감까지 4초 → 마감 직전 전송은 3.3초 뒤
    act(() => {
      vi.advanceTimersByTime(3_000);
    });
    act(() => t.result.current.setValue("안경테"));
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(t.sent).toEqual([{ t: "answer", text: "안경테", final: false }]);
    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    expect(t.sent).toHaveLength(1);
  });

  it("저장된 초안을 모두 지우면 빈 초안을 보내 서버의 옛 초안을 지운다(안 보내면 지우기 전 글이 마감에 나간다)", () => {
    const t = setup(makeView({ elapsed: 5_000 }));
    act(() => t.result.current.setValue("안경"));
    act(() => {
      vi.advanceTimersByTime(KEYWORD_AUTOSAVE_MS);
    });
    act(() => t.result.current.setValue(""));
    act(() => {
      vi.advanceTimersByTime(KEYWORD_AUTOSAVE_MS);
    });
    expect(t.sent).toEqual([
      { t: "answer", text: "안경", final: false },
      { t: "answer", text: "", final: false },
    ]);
  });

  it("아무것도 쓰지 않았으면 빈 초안도 보내지 않는다", () => {
    const t = setup(makeView({ elapsed: 5_000 }));
    act(() => {
      vi.advanceTimersByTime(8_000);
    });
    expect(t.sent).toHaveLength(0);
  });

  it("연결이 끊겨 있으면 작성 중인 글을 보내지 않는다", () => {
    const off = setup(makeView({ elapsed: 5_000 }), { canSend: false });
    act(() => off.result.current.setValue("안경"));
    act(() => {
      vi.advanceTimersByTime(2_000);
    });
    expect(off.sent).toHaveLength(0);
  });
});

describe("확정 제출 (P23-11·12·13)", () => {
  it("시민 편의 제시어가 조합 확정 때 포함돼도 제출하지 않고 정상 단서로 수정할 수 있다", () => {
    const t = setup(makeView({ word: "고양이" }));
    act(() => t.result.current.setValue("고양"));
    act(() => t.result.current.submit("고 양 이"));
    expect(t.sent).toHaveLength(0);
    act(() => t.result.current.setValue("고.양.이처럼"));
    expect(t.result.current.notice).toBe(KEYWORD_BLOCKED_COPY);
    expect(t.result.current.canSubmit).toBe(false);
    act(() => t.result.current.setValue("가을이 좋아요"));
    expect(t.result.current.notice).toBeNull();
    act(() => t.result.current.submit());
    expect(t.sent).toEqual([{ t: "answer", text: "가을이 좋아요", final: true }]);
  });

  it("서버의 별칭 안내는 그 초안에 적용되고 변경 뒤 늦은 응답은 현재 글을 막지 않는다", () => {
    const blocked = makeView({ word: "고양이", answer: { text: "cat", final: false, keywordBlocked: true } });
    const t = setup(blocked);
    expect(t.result.current.notice).toBe(KEYWORD_BLOCKED_COPY);
    expect(t.result.current.canSubmit).toBe(false);
    act(() => t.result.current.setValue("발소리"));
    t.rerender({ view: { ...blocked, serverNow: NOW + 1 } });
    expect(t.result.current.notice).toBeNull();
    expect(t.result.current.canSubmit).toBe(true);
  });

  it("빈 글은 아무것도 보내지 않는다(canSubmit false)", () => {
    const t = setup(makeView({ elapsed: 5_000 }));
    expect(t.result.current.canSubmit).toBe(false);
    act(() => t.result.current.submit());
    expect(t.sent).toHaveLength(0);
    act(() => t.result.current.setValue("   "));
    expect(t.result.current.canSubmit).toBe(false);
  });

  it("연결이 끊겨 있으면 canSubmit false 이고 아무것도 보내지 않는다", () => {
    const t = setup(makeView({ elapsed: 5_000 }), { canSend: false });
    act(() => t.result.current.setValue("안경"));
    expect(t.result.current.canSubmit).toBe(false);
    act(() => t.result.current.submit());
    expect(t.sent).toHaveLength(0);
  });

  it("글이 있으면 send(final:true) 와 함께 즉시 sent 가 되고 400ms 안 두 번째 submit 은 무시한다", () => {
    const t = setup(makeView({ elapsed: 5_000 }));
    act(() => t.result.current.setValue("안경"));
    act(() => t.result.current.submit());
    expect(t.sent).toEqual([{ t: "answer", text: "안경", final: true }]);
    expect(t.result.current.state).toBe("sent");
    act(() => t.result.current.submit());
    expect(t.sent.filter((m) => m.t === "answer" && m.final)).toHaveLength(1);
  });

  it("조합이 끝난 DOM 값을 submit(text) 로 넘기면 그 값을 자소 상한으로 잘라 확정한다", () => {
    const t = setup(makeView({ elapsed: 5_000 }));
    act(() => t.result.current.setValue("안"));
    act(() => t.result.current.submit("안경"));
    expect(t.sent).toEqual([{ t: "answer", text: "안경", final: true }]);
    expect(t.result.current.value).toBe("안경");
  });

  it("sent 뒤에는 입력이 바뀌지 않고 초안도 보내지 않는다", () => {
    const t = setup(makeView({ elapsed: 5_000 }));
    act(() => t.result.current.setValue("안경"));
    act(() => t.result.current.submit());
    act(() => t.result.current.setValue("다른 글"));
    expect(t.result.current.value).toBe("안경");
    act(() => {
      vi.advanceTimersByTime(3_000);
    });
    expect(t.sent).toHaveLength(1);
  });
});

describe("거절 알림 (P23-11, T-23-32)", () => {
  it("확정 3초 안의 error 프레임은 거절이다: notice 가 2.5초 뜨고 open 으로 돌아오며 글은 남는다", () => {
    const t = setup(makeView({ elapsed: 5_000 }));
    act(() => t.result.current.setValue("안경"));
    act(() => t.result.current.submit());
    expect(t.result.current.state).toBe("sent");
    act(() => t.emit(errorFrame()));
    expect(t.result.current.notice).toBe("쓸 수 없는 말이에요");
    expect(t.result.current.state).toBe("open");
    expect(t.result.current.value).toBe("안경");
    act(() => {
      vi.advanceTimersByTime(KEYWORD_NOTICE_MS - 1);
    });
    expect(t.result.current.notice).toBe("쓸 수 없는 말이에요");
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(t.result.current.notice).toBeNull();
  });

  it("WRONG_PHASE·RATE_LIMITED 는 거절이 아니다: 알림도 되돌림도 없고 deny 소리도 나지 않는다(WR-02)", () => {
    const signals: LocalSignal[] = [];
    const unbind = bindSignals((sig) => signals.push(sig));
    for (const code of ["WRONG_PHASE", "RATE_LIMITED"]) {
      const t = setup(makeView({ elapsed: 5_000 }));
      act(() => t.result.current.setValue("안경"));
      act(() => t.result.current.submit());
      signals.length = 0;
      act(() => t.emit(errorFrame(code)));
      expect(t.result.current.notice).toBeNull();
      expect(t.result.current.state).toBe("sent");
      expect(signals).toEqual([]);
      // 그 뒤 진짜 거절(BAD_MESSAGE)은 여전히 거절이다
      act(() => t.emit(errorFrame()));
      expect(t.result.current.notice).toBe("쓸 수 없는 말이에요");
      expect(signals).toEqual([{ kind: "deny" }]);
      cleanup();
    }
    unbind();
  });

  it("마피아와 시민에게 같은 문구·같은 시간이다", () => {
    const seen: Array<string | null> = [];
    for (const role of ["mafia", "citizen"] as const) {
      const t = setup(makeView({ elapsed: 5_000, role }));
      act(() => t.result.current.setValue("안경"));
      act(() => t.result.current.submit());
      act(() => t.emit(errorFrame()));
      seen.push(t.result.current.notice);
      cleanup();
    }
    expect(seen[0]).toBe(seen[1]);
    expect(seen[0]).toBe("쓸 수 없는 말이에요");
  });

  it("확정을 보낸 적이 없을 때(초안만)의 error 프레임은 알림도 되돌림도 없다", () => {
    const t = setup(makeView({ elapsed: 5_000 }));
    act(() => t.result.current.setValue("안경"));
    act(() => {
      vi.advanceTimersByTime(KEYWORD_AUTOSAVE_MS);
    });
    act(() => t.emit(errorFrame()));
    expect(t.result.current.notice).toBeNull();
    expect(t.result.current.state).toBe("open");
  });

  it("확정 뒤 3초가 지나 늦게 온 error(단계가 바뀐 뒤 등)는 조용히 넘긴다", () => {
    const t = setup(makeView({ elapsed: 5_000 }));
    act(() => t.result.current.setValue("안경"));
    act(() => t.result.current.submit());
    act(() => {
      vi.advanceTimersByTime(3_001);
    });
    act(() => t.emit(errorFrame()));
    expect(t.result.current.notice).toBeNull();
    expect(t.result.current.state).toBe("sent");
  });

  it("서버가 확정을 받아 view(me.answer final true)를 돌려준 뒤의 error 는 거절이 아니다", () => {
    const t = setup(makeView({ elapsed: 5_000 }));
    act(() => t.result.current.setValue("안경"));
    act(() => t.result.current.submit());
    t.rerender({ view: makeView({ elapsed: 5_100, answer: { text: "안경", final: true } }) });
    act(() => t.emit(errorFrame()));
    expect(t.result.current.notice).toBeNull();
    expect(t.result.current.state).toBe("sent");
  });
});

describe("복원 (P23-13)", () => {
  it("처음 view 의 me.answer 가 확정이면 value 가 채워지고 sent 이다", () => {
    const t = setup(makeView({ elapsed: 8_000, answer: { text: "안경", final: true } }));
    expect(t.result.current.value).toBe("안경");
    expect(t.result.current.state).toBe("sent");
    expect(t.result.current.canSubmit).toBe(false);
  });

  it("초안을 채우고 시작 시각 뒤라면 바로 입력할 수 있다", () => {
    const t = setup(makeView({ elapsed: 8_000, answer: { text: "안경", final: false } }));
    expect(t.result.current.value).toBe("안경");
    expect(t.result.current.state).toBe("open");
    // 복원한 초안은 서버가 이미 가지고 있어 다시 보내지 않는다
    act(() => {
      vi.advanceTimersByTime(KEYWORD_AUTOSAVE_MS + 100);
    });
    expect(t.sent).toHaveLength(0);
  });

  it("마운트 뒤 view 에 확정이 나타나면(재접속 프레임) 서버 값으로 sent 가 된다", () => {
    const t = setup(makeView({ elapsed: 8_000 }));
    t.rerender({ view: makeView({ elapsed: 8_100, answer: { text: "안경", final: true } }) });
    expect(t.result.current.value).toBe("안경");
    expect(t.result.current.state).toBe("sent");
  });
});

describe("자소 상한 (P23-10)", () => {
  it("21자 입력은 20자소로 잘리고 count 는 20 이다", () => {
    const t = setup(makeView({ elapsed: 5_000 }));
    act(() => t.result.current.setValue("가".repeat(21)));
    expect(t.result.current.value).toBe("가".repeat(20));
    expect(t.result.current.count).toBe(20);
  });

  it("조합 중(composing=true)에는 값을 자르지 않고 count 만 20 으로 막아 보인다", () => {
    const t = setup(makeView({ elapsed: 5_000 }));
    act(() => t.result.current.setValue("가".repeat(21), true));
    expect(t.result.current.value).toBe("가".repeat(21));
    expect(t.result.current.count).toBe(20);
  });
});
