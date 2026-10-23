import type { ReactElement } from "react";
import { Icon } from "./Icon";

export interface ReconnectBannerProps {
  mode: "reconnecting" | "restored";
}

// C-02 재접속 띠. 흐름 안에 놓여 아래 내용을 밀어낸다(위치 지정 없음). 높이 52px 는 room.css 의 지역 상수.
// 문구는 고정 짧은 문구라 길어질 일이 없다(E12 long-text).
export function ReconnectBanner({ mode }: ReconnectBannerProps): ReactElement {
  return (
    <div className={`mf-reconnect mf-reconnect--${mode}`} role="status">
      {mode === "reconnecting" ? (
        <>
          <Icon name="disconnected" size={20} />
          <span className="mf-reconnect__dot" aria-hidden="true" />
          <span>연결이 끊겼어요 · 다시 연결하는 중</span>
        </>
      ) : (
        <>
          <Icon name="check" size={20} />
          <span>다시 연결됐어요</span>
        </>
      )}
    </div>
  );
}
