import { useId, useMemo, useRef } from "react";
import type { KeyboardEvent, ReactElement, RefObject } from "react";
import type { RoomView } from "../../shared/protocol";
import type { RoleId } from "../../shared/game/roles";
import { ROLE_TEXT, alliesText, allyNicknames } from "../game/roleText";
import { suspectLogByDay } from "../game/suspectView";
import { roleArtSrc, seatColorVar } from "../net/assets";
import type { JournalRole } from "../net/assets";
import { Journal } from "./Journal";
import { Diamond } from "./RoleCard";
import { Sheet } from "./Sheet";
import { V2Icon } from "./v2/V2Icon";
import "../styles/phase.css";
import "../styles/rolecard.css";

export type RoleCardTab = "role" | "activity" | "records";

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

const TAB_LABEL: Record<RoleCardTab, string> = { role: "내 역할", activity: "활동 기록", records: "의심 기록" };

// 활동 기록(일지)이 있는 역할. 시민은 기록이 없어 탭 줄도 없다(결정 0026).
function journalRoleOf(role: RoleId | null): JournalRole | null {
  return role === "police" || role === "mafia" || role === "doctor" ? role : null;
}

// 역할 카드 시트(결정 0026, UI-SPEC D, 시안 R2~R5). [내 역할]·[수사 기록] 두 시트를 하나로 합친 것이다.
// 내용은 서버가 본인에게만 보낸 me.role·me.records 에서만 만든다(T-01-45). 직업 그림은 내 역할 하나만 그린다(T-03.1-20).
export function RoleCardSheet({ view, showBack, tab, onTab, unread, newCount, onClose }: RoleCardSheetProps): ReactElement {
  const role = view.me.role ?? null;
  const journalRole = showBack ? null : journalRoleOf(role);
  const hasRecords = !showBack && role !== null && (view.day?.suspectLog?.length ?? 0) > 0;
  const baseId = useId();
  const tabId = (t: RoleCardTab): string => `${baseId}-tab-${t}`;
  const panelId = `${baseId}-panel`;
  const tabRefs: Record<RoleCardTab, RefObject<HTMLButtonElement | null>> = {
    role: useRef<HTMLButtonElement>(null),
    activity: useRef<HTMLButtonElement>(null),
    records: useRef<HTMLButtonElement>(null),
  };

  // 시민에게는 공통 기록만, 나머지 역할에는 활동 기록 탭도 보인다(D-14·P23-16)
  const tabOrder = useMemo<readonly RoleCardTab[]>(() => {
    if (showBack || role === null) return [];
    const list: RoleCardTab[] = ["role"];
    if (journalRole !== null) list.push("activity");
    if (hasRecords) list.push("records");
    return list.length > 1 ? list : [];
  }, [showBack, role, journalRole, hasRecords]);
  const tabbed = tabOrder.length > 0;
  const selectedTab: RoleCardTab = tabbed && tabOrder.includes(tab) ? tab : "role";
  const showingRecords = tabbed && selectedTab === "records";

  // ←/→ 는 이전/다음(끝에서 돈다), Home/End 는 처음/끝. 선택과 포커스를 함께 옮긴다.
  function onTabKeyDown(e: KeyboardEvent<HTMLButtonElement>, current: RoleCardTab): void {
    const at = tabOrder.indexOf(current);
    let next: number;
    if (e.key === "ArrowRight") next = (at + 1) % tabOrder.length;
    else if (e.key === "ArrowLeft") next = (at - 1 + tabOrder.length) % tabOrder.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabOrder.length - 1;
    else return;
    e.preventDefault();
    const target = tabOrder[next]!;
    onTab(target);
    tabRefs[target].current?.focus();
  }

  const tabButton = (t: RoleCardTab): ReactElement => {
    const selected = selectedTab === t;
    const hasDot = t === "activity" && unread > 0;
    return (
      <button
        key={t}
        ref={tabRefs[t]}
        type="button"
        role="tab"
        id={tabId(t)}
        className="mf-rolecard__tab"
        data-rolecard-tab={t}
        aria-selected={selected}
        aria-controls={selected ? panelId : undefined}
        aria-label={t === "activity" ? (hasDot ? "활동 기록, 새 기록" : "활동 기록") : undefined}
        tabIndex={selected ? 0 : -1}
        onClick={() => onTab(t)}
        onKeyDown={(e) => onTabKeyDown(e, t)}
      >
        {TAB_LABEL[t]}
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
  } else if (tabbed) {
    content = (
      <div role="tabpanel" id={panelId} aria-labelledby={tabId(selectedTab)} className="mf-rolecard__panel">
        {selectedTab === "records" ? (
          <RecordsPanel view={view} />
        ) : selectedTab === "activity" && journalRole !== null ? (
          <Journal role={journalRole} records={view.me.records ?? []} players={view.players} mySeat={view.me.seat} newCount={newCount} />
        ) : (
          <Front view={view} role={role} />
        )}
      </div>
    );
  } else {
    content = <Front view={view} role={role} />;
  }

  const title = showingRecords ? TAB_LABEL.records : "역할 카드";
  return (
    <Sheet
      label={title}
      onClose={onClose}
      showClose
      className="mf-sheet--rolecard"
      initialFocusRef={tabbed && selectedTab !== "role" ? tabRefs[selectedTab] : undefined}
    >
      <h2 className="mf-t-heading mf-sheet__title">{title}</h2>
      {tabbed ? (
        <div role="tablist" aria-label="역할 카드 탭" className={`mf-rolecard__tabs mf-rolecard__tabs--${tabOrder.length}`}>
          {tabOrder.map((t) => tabButton(t))}
        </div>
      ) : null}
      {content}
    </Sheet>
  );
}

function RecordsPanel({ view }: { view: RoomView }): ReactElement {
  const nick = (seat: number): string => view.players.find((p) => p.seat === seat)?.nickname ?? "";
  const days = suspectLogByDay(view);
  return (
    <div className="mf-suspect-log">
      {days.map(({ n, rows }) => (
        <section key={n} className="mf-suspect-log__day" data-log-day={n}>
          <div className="mf-suspect-log__head">
            <span className="mf-suspect-log__dayname">{n}일차</span>
          </div>
          <ul className="mf-suspect__list" data-suspect-list="">
            {rows.map((r) => {
              const mine = r.from === view.me.seat;
              return (
                <li
                  key={r.from}
                  className={mine ? "mf-suspect__row mf-suspect__row--mine" : "mf-suspect__row"}
                  data-suspect-row=""
                  data-suspect-from={r.from}
                  data-suspect-to={r.to}
                  aria-label={mine ? `${nick(r.to)} 님에게 내가 붙인 의심딱지` : `${nick(r.from)} 님이 ${nick(r.to)} 님에게 붙인 의심딱지`}
                >
                  <span className="mf-suspect__dot" style={{ background: seatColorVar(r.from) }} aria-hidden="true" />
                  <span className="mf-suspect__nick mf-suspect__nick--from">{nick(r.from)}</span>
                  <span className="mf-suspect__arrow" aria-hidden="true">
                    <V2Icon name="chevronRight" size={16} />
                  </span>
                  <span className="mf-suspect__dot" style={{ background: seatColorVar(r.to) }} aria-hidden="true" />
                  <span className="mf-suspect__nick mf-suspect__nick--to">{nick(r.to)}</span>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
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
