import { useEffect, useId, useRef } from "react";
import "../../styles/v2.css";
import { countGraphemes } from "../../../shared/nickname";
import { useComposedText } from "../../net/useComposedText";
import { V2Icon } from "./V2Icon";

// 유언·쪽지 시트(WillSheet). 원본 design/v2.0/design-system/components/WillSheet (승인 2026-10-31)를 React 19 로 옮겼다.
// 9페이즈 WILL-01(유언 쓰기)·NIGHT-12(마피아 쪽지). 같은 클래스 계열 mv-will* 를 쓰고, 쪽지는 tone="mafia" (mv-will--mafia).
//
// 원본과 달라진 점: onSave·onClose 가 조합이 끝난 확정 값을 인자로 받는다(조합 중 저장·닫기에서 꼬리 글자가 남지 않게,
// useComposedText). compact(textarea 2줄)·disabled(연결 끊김: [저장] aria-disabled) 를 더했다.
//
// 규칙
// - 시트는 서버로 가는 길(채팅 보내기·입력 중 신호)을 갖지 않는다. 콜백은 onChange·onSave·onClose 뿐이고, 쓰는 동안 다른 사람에게
//   가는 신호가 없다(WILL-01, L7). 저장·닫기의 실제 전송은 부르는 쪽(09-17)이 한다.
// - 글자 수는 그래핌으로 세고(닉네임 8자와 같은 세기, 가정 A1) max 를 넘는 입력은 앞에서 max 그래핌까지 자른다. 빈 값도 저장한다.
// - 본문은 textarea value(React)로만 다룬다 — HTML 주입 없음(T-09-15). 서버가 같은 정리 함수로 한 번 더 자른다.
// - 위치(아래 패널 위 8, 키보드 위)는 부르는 쪽이 정한다(가정 A2). 부품은 폭(부모 − 20)과 안쪽 모양만 갖는다.
// - 버튼 mousedown 의 기본 동작을 막아 키보드(포커스)를 유지한다.

export interface WillSheetProps {
  /** 기본 "유언". 쪽지는 "쪽지" */
  title?: string;
  /** 기본 quill. 쪽지는 note */
  icon?: "quill" | "note";
  /** mafia 면 진홍 테두리·제목(쪽지) */
  tone?: "mafia";
  value: string;
  onChange(value: string): void;
  /** 조합이 끝난 확정 값(max 그래핌 이내) */
  onSave(text: string): void;
  /** true 면 [저장] 이 "저장됨" 비활성. 저장 실패는 부르는 쪽이 false 로 둔다 */
  saved?: boolean;
  max?: number;
  placeholder?: string;
  onClose(text: string): void;
  /** 키보드가 열려 낮을 때 textarea 2줄 */
  compact?: boolean;
  /** 연결 끊김: [저장] 이 aria-disabled 이고 눌러도 아무 일 없다 */
  disabled?: boolean;
}

const WILL_TEXT = { title: "유언", placeholder: "죽으면 모두에게 보여요", close: "닫기", save: "저장", saved: "저장됨" } as const;
const DEFAULT_MAX = 100;

const segmenter = new Intl.Segmenter("ko", { granularity: "grapheme" });

/** 앞에서 max 그래핌까지 */
function clampGraphemes(s: string, max: number): string {
  if (s.length <= max) return s; // 그래핌은 UTF-16 길이보다 많을 수 없다
  if (countGraphemes(s) <= max) return s;
  let out = "";
  let n = 0;
  for (const seg of segmenter.segment(s)) {
    if (n >= max) break;
    out += seg.segment;
    n += 1;
  }
  return out;
}

export function WillSheet(props: WillSheetProps) {
  const { title = WILL_TEXT.title, icon = "quill", tone, value, onChange, onSave, saved, max = DEFAULT_MAX, placeholder = WILL_TEXT.placeholder, onClose, compact, disabled } = props;
  const areaRef = useRef<HTMLTextAreaElement | null>(null);
  const composed = useComposedText(areaRef);
  const inputId = useId();

  // 열리면 입력칸으로 초점(키보드가 함께 올라온다)
  useEffect(() => {
    areaRef.current?.focus({ preventScroll: true });
  }, []);

  const confirmed = (raw: string) => clampGraphemes(raw, max);

  const onInput = (raw: string) => {
    // 조합 중에는 값을 가공하지 않는다(조합이 깨진다). 조합이 끝날 때 자른다.
    onChange(composed.composing() ? raw : confirmed(raw));
  };

  const onCompositionEnd = () => {
    composed.bind.onCompositionEnd();
    const el = areaRef.current;
    if (el) {
      const clipped = confirmed(el.value);
      if (clipped !== el.value) onChange(clipped);
    }
  };

  const save = () => {
    if (disabled || saved) return;
    composed.settle((text) => onSave(confirmed(text)));
  };
  const close = () => composed.settle((text) => onClose(confirmed(text)));

  const shown = confirmed(value);
  const rootCls = ["mv-will", tone === "mafia" && "mv-will--mafia"].filter(Boolean).join(" ");

  return (
    <div className={rootCls} role="dialog" aria-label={title} data-will-sheet={tone === "mafia" ? "note" : "will"}>
      <div className="mv-will__head">
        <span className="mv-will__title">
          <V2Icon name={icon} size={20} />
          {title}
        </span>
        <button type="button" className="mv-will__close" aria-label={WILL_TEXT.close} onMouseDown={(e) => e.preventDefault()} onClick={close}>
          <V2Icon name="close" />
        </button>
      </div>
      <label className="mv-sr" htmlFor={inputId}>
        {title}
      </label>
      <textarea
        ref={areaRef}
        id={inputId}
        className="mv-will__text"
        value={shown}
        rows={compact ? 2 : 3}
        placeholder={placeholder}
        onChange={(e) => onInput(e.target.value)}
        onCompositionStart={composed.bind.onCompositionStart}
        onCompositionEnd={onCompositionEnd}
        onBlur={composed.bind.onBlur}
      />
      <div className="mv-will__foot">
        <span className="mv-will__count">{`${countGraphemes(shown)}/${max}`}</span>
        <button
          type="button"
          className="mv-will__save"
          disabled={!!saved}
          aria-disabled={disabled ? "true" : undefined}
          onMouseDown={(e) => e.preventDefault()}
          onClick={save}
        >
          <V2Icon name="check" size={20} />
          {saved ? WILL_TEXT.saved : WILL_TEXT.save}
        </button>
      </div>
    </div>
  );
}
