import { useId, useRef } from "react";
import type { KeyboardEvent, ReactElement } from "react";
import type { RoomView } from "../../shared/protocol";
import type { RoleId } from "../../shared/game/roles";
import { ROLE_TEXT, alliesText, allyNicknames } from "../game/roleText";
import { roleArtSrc } from "../net/assets";
import type { JournalRole } from "../net/assets";
import { Journal } from "./Journal";
import { Diamond } from "./RoleCard";
import { Sheet } from "./Sheet";
import "../styles/phase.css";
import "../styles/rolecard.css";

export type RoleCardTab = "role" | "activity";

export interface RoleCardSheetProps {
  view: RoomView;
  /** true 면 카드 뒷면만 보인다(역할 확인 단계에서 앞면을 본 적이 없는 사람). 역할 글자·그림·탭을 아예 만들지 않는다 */
  showBack: boolean;
  /** 제어 컴포넌트: 선택된 탭은 부모(RoomScreen)가 쥔다 — 단계가 바뀌어도 열린 채다(Pitfall 19 ⑧) */
  tab: RoleCardTab;
  onTab: (tab: RoleCardTab) => void;
  /** 안 읽은 기록 수(점 표시용 — 숫자는 화면에 쓰지 않는다) */
  unread: number;
  /** 활동 기록의 맨 위 몇 줄에 NEW 를 다는가 */
  newCount: number;
  onClose: () => void;
}

const TAB_ORDER: readonly RoleCardTab[] = ["role", "activity"];

// 활동 기록(일지)이 있는 역할. 시민은 기록이 없어 탭 줄도 없다(결정 0026).
function journalRoleOf(role: RoleId | null): JournalRole | null {
  return role === "police" || role === "mafia" || role === "doctor" ? role : null;
}

// 역할 카드 시트(결정 0026, UI-SPEC D, 시안 R2~R5). [내 역할]·[수사 기록] 두 시트를 하나로 합친 것이다.
// 내용은 서버가 본인에게만 보낸 me.role·me.records 에서만 만든다(T-01-45). 직업 그림은 내 역할 하나만 그린다(T-03.1-20).
export function RoleCardSheet({ view, showBack, tab, onTab, unread, newCount, onClose }: RoleCardSheetProps): ReactElement {
  const role = view.me.role ?? null;
  const journalRole = showBack ? null : journalRoleOf(role);
  const baseId = useId();
  const tabId = (t: RoleCardTab): string => `${baseId}-tab-${t}`;
  const panelId = `${baseId}-panel`;
  const roleTabRef = useRef<HTMLButtonElement>(null);
  const activityTabRef = useRef<HTMLButtonElement>(null);
  const tabRefs: Record<RoleCardTab, typeof roleTabRef> = { role: roleTabRef, activity: activityTabRef };

  // ←/→ 는 이전/다음(끝에서 돈다), Home/End 는 처음/끝. 선택과 포커스를 함께 옮긴다.
  function onTabKeyDown(e: KeyboardEvent<HTMLButtonElement>, current: RoleCardTab): void {
    const at = TAB_ORDER.indexOf(current);
    let next: number;
    if (e.key === "ArrowRight") next = (at + 1) % TAB_ORDER.length;
    else if (e.key === "ArrowLeft") next = (at - 1 + TAB_ORDER.length) % TAB_ORDER.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = TAB_ORDER.length - 1;
    else return;
    e.preventDefault();
    const target = TAB_ORDER[next]!;
    onTab(target);
    tabRefs[target].current?.focus();
  }

  const tabButton = (t: RoleCardTab, label: string, ref: typeof roleTabRef): ReactElement => {
    const selected = tab === t;
    const hasDot = t === "activity" && unread > 0;
    return (
      <button
        ref={ref}
        type="button"
        role="tab"
        id={tabId(t)}
        className="mf-rolecard__tab"
        aria-selected={selected}
        aria-controls={selected ? panelId : undefined}
        aria-label={t === "activity" ? (hasDot ? "활동 기록, 새 기록" : "활동 기록") : undefined}
        tabIndex={selected ? 0 : -1}
        onClick={() => onTab(t)}
        onKeyDown={(e) => onTabKeyDown(e, t)}
      >
        {label}
        {hasDot ? <span className="mf-rolecard__dot" aria-hidden="true" /> : null}
      </button>
    );
  };

  let content: ReactElement;
  if (role === null) {
    content = <p className="mf-rolecard__empty">아직 역할이 없어요</p>;
  } else if (showBack) {
    content = (
      <div className="mf-rolecard__body mf-rolecard__body--back">
        <div className="mf-rolecard__back" aria-hidden="true">
          <Diamond />
        </div>
      </div>
    );
  } else if (journalRole !== null) {
    const selectedTab = tab;
    content = (
      <div role="tabpanel" id={panelId} aria-labelledby={tabId(selectedTab)} className="mf-rolecard__panel">
        {selectedTab === "activity" ? (
          <Journal role={journalRole} records={view.me.records ?? []} players={view.players} mySeat={view.me.seat} newCount={newCount} />
        ) : (
          <Front view={view} role={role} />
        )}
      </div>
    );
  } else {
    content = <Front view={view} role={role} />;
  }

  return (
    <Sheet
      label="역할 카드"
      onClose={onClose}
      showClose
      className="mf-sheet--rolecard"
      initialFocusRef={journalRole !== null && tab === "activity" ? activityTabRef : undefined}
    >
      <h2 className="mf-t-heading mf-sheet__title">역할 카드</h2>
      {journalRole !== null ? (
        <div role="tablist" aria-label="역할 카드 탭" className="mf-rolecard__tabs">
          {tabButton("role", "내 역할", roleTabRef)}
          {tabButton("activity", "활동 기록", activityTabRef)}
        </div>
      ) : null}
      {content}
    </Sheet>
  );
}

// 내 역할 본문: 왼쪽 128×160 액자 + 오른쪽 직업명·설명(마피아는 동료 줄).
function Front({ view, role }: { view: RoomView; role: RoleId }): ReactElement {
  const { src, srcSet } = roleArtSrc(role);
  const text = ROLE_TEXT[role];
  const allies = allyNicknames(view);
  return (
    <div className="mf-rolecard__body">
      <img className="mf-rolecard__art" src={src} srcSet={srcSet} width={128} height={160} alt="" draggable={false} />
      <div className="mf-rolecard__t">
        <h3 className="mf-rolecard__name">{text.name}</h3>
        <p className="mf-rolecard__desc" data-role-line="">{text.desc}</p>
        {allies !== null ? <p className="mf-rolecard__mates">{alliesText(allies)}</p> : null}
      </div>
    </div>
  );
}
