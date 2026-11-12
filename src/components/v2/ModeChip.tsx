import "../../styles/v2.css";
import type { GameMode } from "../../../shared/protocol";
import { MODE_TEXT } from "../../game/modeText";
import { V2Icon } from "./V2Icon";

// 참가자의 판 종류 칩 (19-03, D-07, UI-SPEC C, 시안 design/v3.0/host-rail/Guest.dc.html): 읽기 전용이다.
// 방장 줄이 없는 참가자의 왼쪽 위에 이 칩 하나만 놓인다. 방장에게는 그리지 않는다(줄의 [판 종류] 단추가 같은 정보를 준다).
// 대기실과 결과 화면이 같은 부품을 쓴다(P19-10). 자리는 방장 줄 위 시작 높이 + 8(P19-11), 테스트 방은 [테스트] 단추 아래로(testShift).
// 누를 수 없다 — button 이 아니고 포커스를 받지 않으며 눌림을 통과시킨다. 높이 32 알약, 아이콘 deck 16 + 판 이름.
// 글이 두 값(기본 마피아·확장판) 중 하나라 길이가 고정이다. 바뀜은 한 줄 알림이 알린다(modeToastOf) — 여기에 aria-live 를 두지 않는다.
// 일반 요소의 aria-label 은 읽히지 않으므로 접근성 글 "판 종류: " 를 화면에 안 보이는 텍스트(.mf-sr-only)로 둔다.
// 값은 서버가 방송한 판 종류(modeOf(view))다. 표식 값은 enum 뿐이다.

export interface ModeChipProps {
  /** 서버가 방송한 판 종류 */
  mode: GameMode;
  /** 테스트 방: [테스트] 단추 아래로 48 내려온다 */
  testShift?: boolean;
}

export function ModeChip({ mode, testShift }: ModeChipProps) {
  return (
    <div className="mf-modechip" data-mode-chip={mode} {...(testShift ? { "data-test-shift": "" } : {})}>
      <V2Icon name="deck" size={16} />
      <span className="mf-sr-only">{`${MODE_TEXT.title}: `}</span>
      <span className="mf-modechip__name">{MODE_TEXT.name[mode]}</span>
    </div>
  );
}
