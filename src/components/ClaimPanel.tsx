import { useState } from "react";
import type { ReactElement } from "react";
import type { Claim, ClientMessage, RoomView } from "../../shared/protocol";
import { Chip } from "./Chip";
import { claimName } from "./ClaimTag";
import "../styles/chip.css";
import "../styles/day.css";

// 직업 공개 하단 패널(S-06b). 칩 목록은 서버가 준 이번 판 구성(view.day.roles) 뒤에 "말 안 함" 을 붙인 것이다 —
// 클라이언트가 직업 목록을 따로 만들지 않고(D-07), 내 실제 역할로 칩이나 문구를 바꾸지 않는다(T-02-25).
const GUIDE_FIRST_DAY = "거짓말도 괜찮아요. 시간이 끝나면 모두에게 한꺼번에 공개돼요";
const GUIDE_LATER_DAY = "거짓말도 괜찮아요. 바꾸지 않으면 어제 선택이 그대로 공개돼요";

export interface ClaimPanelProps {
  view: RoomView; // claim 단계
  canSend: boolean;
  send: (msg: ClientMessage) => boolean;
}

export function ClaimPanel({ view, canSend, send }: ClaimPanelProps): ReactElement {
  // 낙관적 선택: 어느 view 를 보고 있을 때 눌렀는지 함께 기억한다. 새 서버 view(다른 객체)가 오면 버려
  // 서버 값(view.me.claim)을 따른다 — 서버가 거절하면 같은 소켓에 이전 값으로 state 를 다시 보낸다(T-02-26).
  const [pending, setPending] = useState<{ view: RoomView; claim: Claim } | null>(null);
  const live = pending !== null && pending.view === view ? pending.claim : undefined;
  const selected: Claim | undefined = live ?? view.me.claim;

  const day = view.day;
  const options: Claim[] = [...(day?.roles ?? []), "none"];
  const guide = (day?.n ?? 1) === 1 ? GUIDE_FIRST_DAY : GUIDE_LATER_DAY;

  const press = (claim: Claim): void => {
    if (claim === selected) return; // 선택 해제 없음, 같은 칩 재누름은 아무 일도 없다
    setPending({ view, claim });
    send({ t: "claim", claim });
  };

  return (
    <div className="mf-claimpanel">
      <h2 className="mf-claimpanel__title">주장할 직업을 고르세요</h2>
      <p className="mf-claimpanel__guide">{guide}</p>
      <div className="mf-chips" role="group" aria-label="주장할 직업">
        {options.map((claim) => (
          <Chip key={claim} selected={selected === claim} disabled={!canSend} onPress={() => press(claim)}>
            {claimName(claim)}
          </Chip>
        ))}
      </div>
    </div>
  );
}
