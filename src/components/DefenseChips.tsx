import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";
import { QUICK_TEMPLATES } from "../../shared/game/chat";
import type { RoomView, TemplateId } from "../../shared/protocol";
import { DEFENSE_TEMPLATE_ORDER, TEMPLATE_CHIP, messageText } from "../game/messageText";
import { DEFENSE_SENT_MS, VERDICT_TEXT, defenseSent } from "../game/verdict";
import { useSendLock } from "../net/useSendLock";
import type { RoomConnection } from "../net/useRoomConnection";
import { QuickMessageSheet } from "./QuickMessageSheet";
import type { SayPayload } from "./QuickMessageSheet";
import "../styles/day.css";
import "../styles/night.css";
import "../styles/verdict.css";

// 최후 변론 중 후보 본인의 하단(UI-SPEC 8.4, 시안 DC, 높이 236): 제목 + 안내 + 변론 칩 6개(2칸 × 3줄, 번호 순서, D-13).
// 대상·직업이 필요 없는 칩은 누르면 {t:"say", template} 이 바로 나가고, 필요한 칩은 QuickMessageSheet 를 그 칩 하나(templates=[칩])로 열어 고른 뒤 보낸다(P-8).
// 필요 여부는 QUICK_TEMPLATES 가 정한다 — 칩 이름을 여기서 하드코딩하지 않는다. 보내는 것은 템플릿 ID·seat·직업뿐이고 입력창은 없다(COMM-04, T-04-59).
// 후보는 자기 채팅 줄을 패널에서 볼 수 없으므로 보낸 직후 DEFENSE_SENT_MS 동안 안내 줄이 `보냈어요 · {문장}` 이 된다.
// 합산 쿨다운은 useSendLock(DiscussionControls 와 같은 규칙, 서버 1.8초 한도가 한 번 더 막는다)이 쥐고 쿨다운 동안 칩 전체가 꺼진다(T-04-60).
// 시트 열림 상태와 보냄 표시는 이 부품이 쥔다 — 단계가 바뀌어 언마운트되면 시트도 닫히고 타이머도 정리된다.

export interface DefenseChipsProps {
  view: RoomView; // defense 단계, 내가 후보
  connection: RoomConnection;
  /** 낮 화면 토스트(DayScene 이 쥔다) */
  showToast: (text: string) => void;
}

export function DefenseChips({ view, connection, showToast }: DefenseChipsProps): ReactElement {
  const [sheet, setSheet] = useState<TemplateId | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const sentTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const { blocked, sendAndLock } = useSendLock(connection, showToast);

  useEffect(
    () => () => {
      if (sentTimer.current !== undefined) clearTimeout(sentTimer.current);
    },
    [],
  );

  const nicknameOf = (seat: number): string | undefined => view.players.find((p) => p.seat === seat)?.nickname;

  // 보냄 표시는 상태 한 개와 타이머 하나다: 새로 보내면 타이머를 갈아 끼워 2초를 다시 센다
  const send = (payload: SayPayload): void => {
    if (!sendAndLock({ t: "say", ...payload })) return;
    setSent(messageText(payload, nicknameOf));
    if (sentTimer.current !== undefined) clearTimeout(sentTimer.current);
    sentTimer.current = setTimeout(() => {
      sentTimer.current = undefined;
      setSent(null);
    }, DEFENSE_SENT_MS);
  };

  const press = (template: TemplateId): void => {
    const need = QUICK_TEMPLATES[template];
    if (need.target || need.role) setSheet(template);
    else send({ template });
  };

  return (
    <div className="mf-nightpanel">
      <h2 className="mf-claimpanel__title" data-guide="">{VERDICT_TEXT.defenseChooseTitle}</h2>
      <p className="mf-claimpanel__guide" aria-live="polite">
        {sent === null ? VERDICT_TEXT.defenseChooseHint : defenseSent(sent)}
      </p>
      <div className="mf-defchips">
        {DEFENSE_TEMPLATE_ORDER.map((id) => (
          <button key={id} type="button" className="mf-seg__b mf-defchips__b" disabled={blocked} onClick={() => press(id)}>
            {TEMPLATE_CHIP[id]}
          </button>
        ))}
      </div>
      {sheet !== null ? (
        <QuickMessageSheet
          players={view.players}
          mySeat={view.me.seat}
          roles={view.day?.roles ?? []}
          canSend={connection.canSend}
          templates={[sheet]}
          onSend={send}
          onClose={() => setSheet(null)}
        />
      ) : null}
    </div>
  );
}
