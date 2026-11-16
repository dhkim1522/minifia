import { useId, useMemo, useRef } from "react";
import type { KeyboardEvent, ReactElement, RefObject } from "react";
import type { KeywordAnswerRow, RoomView } from "../../shared/protocol";
import type { RoleId } from "../../shared/game/roles";
import { keywordAnswerOf, keywordAnswersOf, keywordGenreOf } from "../game/keywordView";
import { ROLE_TEXT, alliesText, allyNicknames } from "../game/roleText";
import { roleArtSrc, seatColorVar } from "../net/assets";
import type { JournalRole } from "../net/assets";
import { Journal } from "./Journal";
import { Diamond } from "./RoleCard";
import { Sheet } from "./Sheet";
import "../styles/phase.css";
import "../styles/rolecard.css";

export type RoleCardTab = "role" | "activity" | "answers";

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

const TAB_LABEL: Record<RoleCardTab, string> = { role: "내 역할", activity: "활동 기록", answers: "첫날 답" };

// 활동 기록(일지)이 있는 역할. 시민은 기록이 없어 탭 줄도 없다(결정 0026).
function journalRoleOf(role: RoleId | null): JournalRole | null {
  return role === "police" || role === "mafia" || role === "doctor" ? role : null;
}

// 역할 카드 시트(결정 0026, UI-SPEC D, 시안 R2~R5). [내 역할]·[수사 기록] 두 시트를 하나로 합친 것이다.
// 내용은 서버가 본인에게만 보낸 me.role·me.records 에서만 만든다(T-01-45). 직업 그림은 내 역할 하나만 그린다(T-03.1-20).
export function RoleCardSheet({ view, showBack, tab, onTab, unread, newCount, onClose }: RoleCardSheetProps): ReactElement {
  const role = view.me.role ?? null;
  const journalRole = showBack ? null : journalRoleOf(role);
  const answers = keywordAnswersOf(view);
  const hasAnswers = !showBack && role !== null && answers !== undefined;
  const baseId = useId();
  const tabId = (t: RoleCardTab): string => `${baseId}-tab-${t}`;
  const panelId = `${baseId}-panel`;
  const tabRefs: Record<RoleCardTab, RefObject<HTMLButtonElement | null>> = {
    role: useRef<HTMLButtonElement>(null),
    activity: useRef<HTMLButtonElement>(null),
    answers: useRef<HTMLButtonElement>(null),
  };

  // 탭 순서: 시민 [내 역할, 첫날 답], 그 밖 [내 역할, 활동 기록, 첫날 답]. 답이 아직 없으면 지금 배열(시민은 탭 줄 없음, D-14·P23-16)
  const tabOrder = useMemo<readonly RoleCardTab[]>(() => {
    if (showBack || role === null) return [];
    const list: RoleCardTab[] = ["role"];
    if (journalRole !== null) list.push("activity");
    if (hasAnswers) list.push("answers");
    return list.length > 1 ? list : [];
  }, [showBack, role, journalRole, hasAnswers]);
  const tabbed = tabOrder.length > 0;
  const selectedTab: RoleCardTab = tabbed && tabOrder.includes(tab) ? tab : "role";
  const showingAnswers = tabbed && selectedTab === "answers";

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
        {selectedTab === "answers" ? (
          <AnswersPanel view={view} rows={answers ?? []} />
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

  const title = showingAnswers ? "모두의 답" : "역할 카드";
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

// 첫날 답 목록(23-11, P23-18·19). 일차 구역 배열 모양이라 24 가 2일차 이후 구역(포스트잇 줄)을 더할 수 있다.
// 줄 = 번호 원 · 좌석 색 점 · 닉네임 · 답. 서버가 준 순서 그대로(낸 순서 → 답 없음), 글은 React 텍스트 노드만 쓴다(T-23-41).
function AnswersPanel({ view, rows }: { view: RoomView; rows: readonly KeywordAnswerRow[] }): ReactElement {
  const genre = keywordGenreOf(view);
  const correct = keywordAnswerOf(view);
  const nick = (seat: number): string => view.players.find((p) => p.seat === seat)?.nickname ?? "";
  const days = [{ n: 1, rows }];
  return (
    <div className="mf-answers">
      {days.map((d) => (
        <section key={d.n} className="mf-answers__day" data-answer-day={d.n}>
          <div className="mf-answers__head">
            <span className="mf-answers__dayname">{d.n}일차</span>
            {genre !== undefined ? <span className="mf-answers__genre">장르 : {genre}</span> : null}
          </div>
          <ol className="mf-answers__list" data-answer-list="">
            {d.rows.map((r) => {
              const mine = r.seat === view.me.seat;
              const none = r.text === null;
              return (
                <li
                  key={r.seat}
                  className={mine ? "mf-answers__row mf-answers__row--mine" : "mf-answers__row"}
                  data-answer-row=""
                  data-answer-order={r.order}
                  data-answer-seat={r.seat}
                  data-answer-none={none ? "" : undefined}
                  aria-label={mine ? `내 답, ${r.order}번 ${nick(r.seat)} ${none ? "답 없음" : r.text}` : undefined}
                >
                  <span className="mf-answers__no" aria-hidden="true">{r.order}</span>
                  <span className="mf-answers__dot" style={{ background: seatColorVar(r.seat) }} aria-hidden="true" />
                  <span className="mf-answers__nick">{nick(r.seat)}</span>
                  <span className={none ? "mf-answers__text mf-answers__text--none" : "mf-answers__text"}>{none ? "답 없음" : r.text}</span>
                </li>
              );
            })}
          </ol>
          {correct !== undefined ? (
            <p className="mf-answers__correct" data-answer-correct="">
              정답 · {correct}
            </p>
          ) : null}
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
