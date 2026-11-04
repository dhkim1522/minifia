import { useEffect, useRef } from "react";
import "../../styles/v2.css";
import { SHOWDOWN_COPY } from "../../game/showdownView";
import { V2Icon } from "./V2Icon";

// 마지막 한마디 칩 시트(09.1.1-15, UI-SPEC E-2). 내 한마디 차례에만, 아래 채팅 패널 자리를 그대로 덮는다(높이 = 패널 높이 188 · 244, 윗변·아랫변이 패널과 같다).
// 칩 = 빠른 문구 4개(LAST_WORD_CHIPS) + [직접 쓰기]. 높이 44, 안쪽 좌우 16, 사이 8, 줄 바꿈 — 최대 3줄 148 + 안쪽 12 → 172 ≤ 188.
// 서버로 가는 길은 부르는 쪽의 onPick 하나뿐이다(기존 chat 전송 — 서버가 차례 주인의 채팅 한 줄을 그 차례의 한마디로 확정한다).
// 문구는 모두 React 텍스트 노드다. 칩 mousedown 의 기본 동작을 막아 포커스를 뺏지 않고, 열리면 첫 칩으로 초점(preventScroll)을 옮긴다.

export interface SpeakSheetProps {
  chips: readonly string[];
  /** 칩을 눌렀다: 그 문구를 그대로 보낸다 */
  onPick(text: string): void;
  /** [직접 쓰기]: 같은 자리가 한 줄 입력 시트로 바뀐다 */
  onWrite(): void;
  /** 패널 높이(px). 없으면 CSS 변수 --mf-panel-h(화면 틀이 잰 값)를 쓴다 */
  height?: number;
  /** 연결 끊김: 칩이 aria-disabled 이고 눌러도 아무 일 없다 */
  disabled?: boolean;
}

export function SpeakSheet({ chips, onPick, onWrite, height, disabled }: SpeakSheetProps) {
  const firstRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    firstRef.current?.focus({ preventScroll: true });
  }, []);
  return (
    <div className="mv-speak-sheet" role="group" aria-label={SHOWDOWN_COPY.writeTitle} data-speak-sheet="" {...(height !== undefined && height > 0 ? { style: { height } } : {})}>
      {chips.map((text, i) => (
        <button
          key={text}
          ref={i === 0 ? firstRef : undefined}
          type="button"
          className="mv-speak-chip"
          data-speak-chip=""
          aria-disabled={disabled ? "true" : undefined}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            if (disabled) return;
            onPick(text);
          }}
        >
          {text}
        </button>
      ))}
      <button
        type="button"
        className="mv-speak-chip is-write"
        data-speak-write=""
        aria-disabled={disabled ? "true" : undefined}
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          if (disabled) return;
          onWrite();
        }}
      >
        <V2Icon name="quill" size={20} />
        {SHOWDOWN_COPY.write}
      </button>
    </div>
  );
}
