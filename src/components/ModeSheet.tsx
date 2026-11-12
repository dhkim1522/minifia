import type { ReactElement } from "react";
import type { GameMode } from "../../shared/protocol";
import { MODE_ORDER, MODE_TEXT } from "../game/modeText";
import { Sheet } from "./Sheet";
import { V2Icon } from "./v2/V2Icon";
import type { V2IconName } from "./v2/V2Icon";

// 판 종류 시트 (19-03, D-05·D-15, UI-SPEC B, 시안 design/v3.0/host-rail/ModeSheet.dc.html).
// 제목과 두 칸(기본 마피아 · 확장판, 순서 고정)뿐이다. 칸이 항상 둘이라 빈 상태가 없다.
// 칸을 누르면 고른 값을 부모에게 한 번 알리고(onPick → modePick) 시트는 열어 둔다. 고른 표시(aria-pressed·테두리·V 배지)는
// 부모가 준 서버 값(mode = modeOf(view))에서만 나온다 — 낙관 갱신이 없다(P19-6). 서버가 거절하면 최신 상태가 와서 표시가 그대로 남는다.
// 이미 고른 칸과 연결 끊김(canSend=false)은 아무것도 보내지 않는다. 방장 판정은 서버가 한다(결정 0002).
// 고른 칸의 색은 밝은 회색이다 — 금빛은 방장 줄 단추의 색이라 섞지 않는다(P19-15).

export interface ModeSheetProps {
  /** 서버가 방송한 판 종류(modeOf(view)). 첫 프레임 전에는 기본값 확장판 */
  mode: GameMode;
  /** 연결돼 있어 보낼 수 있는가 */
  canSend: boolean;
  /** 지금 값과 다른 칸을 눌렀다 */
  onPick(mode: GameMode): void;
  onClose(): void;
}

const ICON: Readonly<Record<GameMode, V2IconName>> = { basic: "modeBasic", extended: "modeExtended" };

export function ModeSheet({ mode, canSend, onPick, onClose }: ModeSheetProps): ReactElement {
  return (
    <Sheet label={MODE_TEXT.title} showClose onClose={onClose} className="mf-mode-sheet">
      {() => (
        <div className="mf-mode-sheet__body" data-mode-sheet="">
          <h2 className="mf-t-heading mf-sheet__title">{MODE_TEXT.title}</h2>
          <div className="mf-mode-sheet__grid">
            {MODE_ORDER.map((m) => {
              const picked = m === mode;
              return (
                <button
                  key={m}
                  type="button"
                  className="mf-mode-card"
                  data-mode-card={m}
                  aria-pressed={picked}
                  aria-disabled={canSend ? undefined : "true"}
                  onClick={() => {
                    if (!canSend || picked) return;
                    onPick(m);
                  }}
                >
                  <V2Icon name={ICON[m]} size={40} className="mf-mode-card__icon" />
                  <span className="mf-mode-card__name">{MODE_TEXT.name[m]}</span>
                  <span className="mf-mode-card__desc">{MODE_TEXT.desc[m]}</span>
                  {picked ? (
                    <span className="mf-mode-card__badge" aria-hidden="true">
                      <V2Icon name="check" size={18} />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </Sheet>
  );
}
