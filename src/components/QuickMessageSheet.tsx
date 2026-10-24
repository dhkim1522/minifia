import { useState } from "react";
import type { ReactElement } from "react";
import { QUICK_TEMPLATES } from "../../shared/game/chat";
import { isAlive } from "../../shared/game/alive";
import type { RoleId } from "../../shared/game/roles";
import type { ClientMessage, PublicPlayer, TemplateId } from "../../shared/protocol";
import { TEMPLATE_CHIP, TEMPLATE_ORDER, messageText } from "../game/messageText";
import { ROLE_TEXT } from "../game/roleText";
import { Button } from "./Button";
import { Chip } from "./Chip";
import { Sheet } from "./Sheet";
import "../styles/chip.css";
import "../styles/talk.css";

/** 서버로 보내는 say 메시지에서 t 를 뺀 것. 문장·보낸 사람 seat 는 담지 않는다(COMM-04, D-13). */
export type SayPayload = Omit<Extract<ClientMessage, { t: "say" }>, "t">;

export interface QuickMessageSheetProps {
  players: PublicPlayer[];
  mySeat: number;
  /** 이번 판 직업 목록(서버가 준 구성). 직업 칩은 이 목록 그대로다 */
  roles: RoleId[];
  canSend: boolean;
  /** 보여 줄 문구와 순서(기본 낮 TEMPLATE_ORDER). 밤에는 장면이 NIGHT_TEMPLATE_ORDER 를 넘긴다(D-17) */
  templates?: readonly TemplateId[];
  onSend: (payload: SayPayload) => void;
  onClose: () => void;
}

// 빠른 메시지 시트(S-08a): 문구 → 대상 → (직업) → 보내기. 고른 값은 이 부품의 지역 상태라 시트가 닫히면(언마운트) 버려진다.
// 입력칸이 없다 — 보낼 수 있는 것은 템플릿 ID·seat·직업뿐이다(자유 채팅은 v2). 소켓은 모르고 값만 onSend 로 넘긴다.
// 밤에는 장면이 NIGHT_TEMPLATE_ORDER 를 넘긴다(D-17) — 문구가 쓸 수 있는 때는 서버가 검사한다. 대상·직업 칸 규칙은 QUICK_TEMPLATES 그대로(밤 문구는 직업 칸이 없다).
export function QuickMessageSheet({ players, mySeat, roles, canSend, templates = TEMPLATE_ORDER, onSend, onClose }: QuickMessageSheetProps): ReactElement {
  // 처음엔 첫 문구가 선택돼 있고 해제할 수 없다
  const [template, setTemplate] = useState<TemplateId>(templates[0] ?? "suspect");
  const [target, setTarget] = useState<number | undefined>(undefined);
  const [claimedRole, setClaimedRole] = useState<RoleId | undefined>(undefined);

  const need = QUICK_TEMPLATES[template];
  // 나를 뺀 생존자, seat 오름차순. 끊긴 사람도 있다(S-08a)
  const candidates = players.filter((p) => p.seat !== mySeat && isAlive(p)).sort((a, b) => a.seat - b.seat);
  const nicknameOf = (seat: number): string | undefined => players.find((p) => p.seat === seat)?.nickname;

  // 문구를 바꾸면 그 문구에 필요 없는 칸은 버리고, 필요한 칸에 이미 고른 값은 유지한다
  const pickTemplate = (next: TemplateId): void => {
    if (next === template) return;
    const nextNeed = QUICK_TEMPLATES[next];
    setTemplate(next);
    if (!nextNeed.target) setTarget(undefined);
    if (!nextNeed.role) setClaimedRole(undefined);
  };

  const targetMissing = need.target && target === undefined;
  const roleMissing = need.role && claimedRole === undefined;
  const ready = !targetMissing && !roleMissing;
  const previewText = messageText(
    { template, ...(need.target ? { target } : {}), ...(need.role ? { claimedRole } : {}) },
    nicknameOf,
  );

  const send = (requestClose: () => void): void => {
    if (!ready || !canSend) return;
    // 필요한 키만 리터럴로 담는다 — 입력 객체를 펼치지 않는다(T-02-27)
    const payload: SayPayload =
      need.target && target !== undefined
        ? need.role && claimedRole !== undefined
          ? { template, target, claimedRole }
          : { template, target }
        : { template };
    onSend(payload);
    requestClose();
  };

  return (
    <Sheet label="빠른 메시지" onClose={onClose} showClose>
      {(requestClose, closing) => (
        <div className="mf-qm">
          <h2 className="mf-t-heading mf-sheet__title">빠른 메시지</h2>

          <div className="mf-qm__section">
            <p className="mf-qm__label">무슨 말을 할까요?</p>
            <div className="mf-chips" role="group" aria-label="문구">
              {templates.map((id) => (
                <Chip key={id} selected={template === id} onPress={() => pickTemplate(id)}>
                  {TEMPLATE_CHIP[id]}
                </Chip>
              ))}
            </div>
          </div>

          {need.target ? (
            <div className="mf-qm__section">
              <p className="mf-qm__label">누구에게?</p>
              <div className="mf-chips" role="group" aria-label="대상">
                {candidates.map((p) => (
                  <Chip key={p.seat} selected={target === p.seat} onPress={() => setTarget(p.seat)}>
                    {p.nickname}
                  </Chip>
                ))}
              </div>
            </div>
          ) : null}

          {need.role ? (
            <div className="mf-qm__section">
              <p className="mf-qm__label">무슨 직업이었나요?</p>
              <div className="mf-chips" role="group" aria-label="직업">
                {roles.map((role) => (
                  <Chip key={role} selected={claimedRole === role} onPress={() => setClaimedRole(role)}>
                    {ROLE_TEXT[role].name}
                  </Chip>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mf-qm__section">
            <p className="mf-qm__label">미리보기</p>
            <div className="mf-qm__previewrow">
              <span className={ready ? "mf-qm__preview" : "mf-qm__preview mf-qm__preview--dim"}>
                <span className="mf-qm__text">{previewText}</span>
              </span>
            </div>
          </div>

          <Button variant="primary" block className="mf-qm__send" disabled={!ready || !canSend || closing} onClick={() => send(requestClose)}>
            보내기
          </Button>
        </div>
      )}
    </Sheet>
  );
}
