import { useState } from "react";
import type { ReactElement } from "react";
import type { Claim, ClientMessage, RoomView } from "../../shared/protocol";
import { Icon } from "./Icon";
import { claimName } from "../game/roleText";
import "../styles/day.css";

// 내 차례 하단 패널(03.1 UI-SPEC B, 시안 K1·결정 0017-6·0023): 제목 + 안내 + 같은 폭 한 줄 칩(.mf-seg).
// 고른 칩은 반전 + 오른쪽 위 체크 배지가 되고 모든 칩이 꺼진다 — 일찍 고르면 바로 다음 차례로 넘어가므로 바꿀 수 없다.
// DayScene 이 서버의 day.turn.seat 가 내 seat 일 때만 이 패널을 마운트한다(T-03.1-09).
// 공용 Chip(앞 체크 아이콘, 줄바꿈)은 빠른 메시지 시트가 쓰고, 이 패널은 한 줄 전용 버튼(.mf-seg__b)을 쓴다.
// 칩 목록은 서버가 준 이번 판 구성(view.day.roles) 뒤에 "말 안 함" 을 붙인 것이다 —
// 클라이언트가 직업 목록을 따로 만들지 않고(D-07), 내 실제 역할로 칩이나 문구를 바꾸지 않는다(T-02-25).
const TITLE = "내 차례예요";
const GUIDE = "직업을 골라 주장하세요 · 안 고르면 말 안 함";

export interface ClaimPanelProps {
  view: RoomView; // claim 단계, 지금 차례가 나
  canSend: boolean;
  send: (msg: ClientMessage) => boolean;
}

export function ClaimPanel({ view, canSend, send }: ClaimPanelProps): ReactElement {
  // 낙관적 선택: 어느 view 를 보고 있을 때 눌렀는지 함께 기억한다. 새 서버 view(다른 객체)가 오면 버려
  // 서버 값을 따른다 — 서버가 거절하면 같은 소켓에 state 를 다시 보내고(T-02-26) 다음 차례가 시작되면 하단이 바뀐다.
  const [pending, setPending] = useState<{ view: RoomView; claim: Claim } | null>(null);
  const live = pending !== null && pending.view === view ? pending.claim : undefined;
  const locked = live !== undefined;

  const options: Claim[] = [...(view.day?.roles ?? []), "none"];

  const press = (claim: Claim): void => {
    if (locked) return; // 한 번 고르면 끝, 같은 칩 재누름·다른 칩 모두 무시
    setPending({ view, claim });
    send({ t: "claim", claim });
  };

  return (
    <div className="mf-claimpanel">
      <h2 className="mf-claimpanel__title" data-guide="">{TITLE}</h2>
      <p className="mf-claimpanel__guide">{GUIDE}</p>
      <div className="mf-seg" role="group" aria-label="주장할 직업">
        {options.map((claim) => (
          <button
            key={claim}
            type="button"
            className="mf-seg__b"
            aria-pressed={live === claim}
            disabled={locked || !canSend}
            onClick={() => press(claim)}
          >
            {claimName(claim)}
            {live === claim ? (
              <span className="mf-seg__ok" aria-hidden="true">
                <Icon name="check" size={12} />
              </span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}
