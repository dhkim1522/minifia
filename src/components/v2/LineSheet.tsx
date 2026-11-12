import { useEffect, useId, useRef, useState } from "react";
import "../../styles/v2.css";
import { countGraphemes } from "../../../shared/nickname";
import { WHISPER_MAX_GRAPHEMES } from "../../../shared/game/whisper";
import { seatColorVar, faceSrc } from "../../net/assets";
import { RESULT_PANEL_TEXT } from "../../game/resultText";
import { useComposedText } from "../../net/useComposedText";
import { clampGraphemes } from "./WillSheet";
import { V2Icon } from "./V2Icon";
import type { V2IconName } from "./V2Icon";

// 한 줄 입력 시트(LineSheet, 09.1.1-09 UI-SPEC B-2). 귓속말과 마지막 한마디 직접 쓰기(09.1.1-16)가 함께 쓴다.
// 틀은 WillSheet 와 같다(폭 부모 − 20, 면 night-800, 위치·키보드 규칙은 부르는 쪽 시트 층). 높이 12 + 44 + 8 + 48 + 12 = 124.
//
// 규칙
// - 서버로 가는 길은 onSend 하나뿐이다. 쓰는 동안(입력·조합·초점) 부르는 콜백이 없다 — 입력 중 신호가 없다(L7·L17). onChange 는 부모 안의 입력값 갱신용이다.
// - 글자 수는 그래핌으로 세고 max 를 넘는 입력은 앞에서 max 그래핌까지 자른다. 조합 중에는 값을 가공하지 않는다(조합이 끝날 때 자른다, useComposedText).
// - 상대 이름·본문은 React 텍스트 노드/속성으로만 그린다(HTML 주입 없음, T-09.1.1-26). 얼굴 그림이 실패하면 자리 구분색 원으로 바꾼다.
// - 버튼 mousedown 의 기본 동작을 막아 키보드(포커스)를 유지한다. 빈 글은 보낼 수 없다(aria-disabled).

export interface LineSheetPeer {
  seat: number;
  name: string;
}

export interface LineSheetProps {
  /** 그 판 규칙의 귓속말 켜짐(19페이즈 D-03) — 공개 예고 문구가 귓속말을 함께 말할지 정한다. 화면이 view.mode 에서 얻어 넘기고, 없으면 꺼짐이다 */
  whisper?: boolean;
  /** 상대 칩(얼굴 + 이름 + whisper 아이콘). 없으면 title 을 쓴다 */
  peer?: LineSheetPeer;
  /** peer 대신 윗줄에 보이는 제목(마지막 한마디 직접 쓰기는 "한마디") */
  title?: string;
  /** title 앞 아이콘. 기본 whisper */
  icon?: V2IconName;
  value: string;
  onChange(value: string): void;
  /** 조합이 끝난 확정 값(max 그래핌 이내, 빈 글이 아님) */
  onSend(text: string): void;
  onClose(): void;
  /** 글자 수 상한(그래핌). 기본 귓속말 30 */
  max?: number;
  placeholder?: string;
  /** 입력칸 접근성 이름 */
  inputLabel?: string;
  /** 연결 끊김 등: 보내기가 aria-disabled 이고 눌러도 아무 일 없다 */
  disabled?: boolean;
}

const LINE_TEXT = { send: "보내기", close: "닫기", inputLabel: "귓속말 입력" } as const;

export function LineSheet(props: LineSheetProps) {
  const { peer, title, icon = "whisper", value, onChange, onSend, onClose, max = WHISPER_MAX_GRAPHEMES, placeholder, inputLabel = LINE_TEXT.inputLabel, disabled, whisper = false } = props;
  const fieldRef = useRef<HTMLInputElement | null>(null);
  const composed = useComposedText(fieldRef);
  const inputId = useId();

  // 열리면 입력칸으로 초점(키보드가 함께 올라온다)
  useEffect(() => {
    fieldRef.current?.focus({ preventScroll: true });
  }, []);

  const confirmed = (raw: string) => clampGraphemes(raw, max);

  const onInput = (raw: string) => {
    // 조합 중에는 값을 가공하지 않는다(조합이 깨진다). 조합이 끝날 때 자른다.
    onChange(composed.composing() ? raw : confirmed(raw));
  };

  const onCompositionEnd = () => {
    composed.bind.onCompositionEnd();
    const el = fieldRef.current;
    if (el) {
      const clipped = confirmed(el.value);
      if (clipped !== el.value) onChange(clipped);
    }
  };

  const shown = confirmed(value);
  const blank = shown.trim() === "";

  const send = () => {
    if (disabled) return;
    composed.settle((text) => {
      const t = confirmed(text);
      if (t.trim() === "") return;
      onSend(t);
    }, "send");
  };

  return (
    <div className="mv-line-sheet" role="dialog" aria-label={peer ? LINE_TEXT.inputLabel : (title ?? LINE_TEXT.inputLabel)} data-line-sheet="">
      {/* 공개 예고(11-07, A-4): 귓속말 시트가 열려 있는 동안 항상 위쪽에 있다. 모두에게 같은 문구 */}
      {peer ? (
        <p className="mv-line__notice" data-pre-notice="">
          {RESULT_PANEL_TEXT.preNotice(whisper)}
        </p>
      ) : null}
      <div className="mv-line__head">
        {peer ? (
          <span className="mv-line__peer" data-line-peer="">
            <PeerFace seat={peer.seat} />
            <span className="mv-line__name">{peer.name}</span>
            <V2Icon name={icon} size={16} />
          </span>
        ) : (
          <span className="mv-line__peer" data-line-peer="">
            <V2Icon name={icon} size={20} />
            <span className="mv-line__name">{title ?? ""}</span>
          </span>
        )}
        <span className="mv-line__count">{`${countGraphemes(shown)}/${max}`}</span>
        <button type="button" className="mv-line__close" data-line-close="" aria-label={LINE_TEXT.close} onMouseDown={(e) => e.preventDefault()} onClick={onClose}>
          <V2Icon name="close" />
        </button>
      </div>
      <div className="mv-line__row">
        <input
          ref={fieldRef}
          id={inputId}
          className="mv-line__input"
          data-line-input=""
          type="text"
          inputMode="text"
          enterKeyHint="send"
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          aria-label={inputLabel}
          placeholder={placeholder}
          value={shown}
          onChange={(e) => onInput(e.target.value)}
          onCompositionStart={composed.bind.onCompositionStart}
          onCompositionEnd={onCompositionEnd}
          onBlur={composed.bind.onBlur}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button
          type="button"
          className="mv-line__send"
          data-line-send=""
          aria-label={LINE_TEXT.send}
          aria-disabled={blank || disabled ? "true" : "false"}
          onMouseDown={(e) => e.preventDefault()}
          onClick={send}
        >
          <V2Icon name="send" />
        </button>
      </div>
    </div>
  );
}

/** 상대 칩의 얼굴 24px. 그림이 안 열리면 자리 구분색 원으로 바꾼다 */
function PeerFace({ seat }: { seat: number }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className="mv-line__face is-fallback" style={{ background: seatColorVar(seat) }} aria-hidden="true" />;
  return <img className="mv-line__face" src={faceSrc(seat)} alt="" width={24} height={24} draggable={false} onError={() => setFailed(true)} />;
}
