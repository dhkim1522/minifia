// 12-08: 주요 버튼(primary) 클릭은 닫힌 신호 tap 만 보낸다 — 어떤 소리를 낼지는 감독이 정한다 (D-3, LS-7).
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { bindSignals, type LocalSignal } from "../../src/audio/signals";
import { Button } from "../../src/components/Button";

afterEach(cleanup);

function listen(): { got: LocalSignal[]; off: () => void } {
  const got: LocalSignal[] = [];
  const off = bindSignals((s) => got.push(s));
  return { got, off };
}

describe("Button: ui.tap 신호", () => {
  it("primary 클릭은 tap 신호를 보내고 onClick 도 부른다", () => {
    const { got, off } = listen();
    let clicks = 0;
    const { getByText } = render(<Button onClick={() => (clicks += 1)}>시작</Button>);
    fireEvent.click(getByText("시작"));
    off();
    expect(got).toEqual([{ kind: "tap" }]);
    expect(clicks).toBe(1);
  });

  it("variant 를 안 주면 primary 로 본다", () => {
    const { got, off } = listen();
    const { getByText } = render(<Button>확인</Button>);
    fireEvent.click(getByText("확인"));
    off();
    expect(got).toHaveLength(1);
  });

  it.each(["secondary", "text"] as const)("%s 는 신호를 보내지 않는다", (variant) => {
    const { got, off } = listen();
    const { getByText } = render(<Button variant={variant}>보조</Button>);
    fireEvent.click(getByText("보조"));
    off();
    expect(got).toEqual([]);
  });

  it("비활성 primary 는 신호를 보내지 않는다", () => {
    const { got, off } = listen();
    const { getByText } = render(<Button disabled>잠김</Button>);
    fireEvent.click(getByText("잠김"));
    off();
    expect(got).toEqual([]);
  });

  it("신호에는 종류 말고 아무것도 없다 (선택값·역할·좌석 없음, LS-7)", () => {
    const { got, off } = listen();
    const { getByText } = render(<Button onClick={() => undefined}>준비</Button>);
    fireEvent.click(getByText("준비"));
    off();
    expect(Object.keys(got[0]!)).toEqual(["kind"]);
  });

  it("바인딩이 없는 화면(홈)에서 눌러도 아무 일도 없다", () => {
    const { getByText } = render(<Button>방 만들기</Button>);
    expect(() => fireEvent.click(getByText("방 만들기"))).not.toThrow();
  });

  it("onClick 이 없어도 터지지 않는다", () => {
    const { getByText } = render(<Button>없음</Button>);
    expect(() => fireEvent.click(getByText("없음"))).not.toThrow();
  });
});
