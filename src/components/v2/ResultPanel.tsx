import { useState } from "react";
import { useEffect, useRef } from "react";
import type { CSSProperties, KeyboardEvent, ReactNode, Ref } from "react";
import "../../styles/v2.css";
import { dayDivider, nightDivider, RESULT_PANEL_TEXT, RESULT_TABS } from "../../game/resultText";
import type { ResultTabId } from "../../game/resultText";
import type { ResultLogChatLine, ResultLogWhisperLine } from "../../../shared/protocol";
import type { ResultLogSnapshot } from "../../net/resultLogStore";
import { dayLinesOf, timelineOf } from "../../game/timelineView";
import type { TimelineViewInput } from "../../game/timelineView";
import { faceSrc, seatColorVar } from "../../net/assets";
import { DayDetail } from "./DayDetail";
import { TimelineStrip } from "./TimelineStrip";
import { V2Icon } from "./V2Icon";
import type { V2IconName } from "./V2Icon";

// 결과 탭 패널 (11-07, 결정 D-2·D-3·D-9, UI-SPEC A-3). 순수 표시다: 어느 탭이 열렸는지·열린 적이 있는지·연출 시계는 부르는 쪽(ResultScreen)이 쥔다.
// 탭 행(아이콘만 44×44, 선택된 탭만 라벨 14px) + 몸통. 전체 탭의 몸통은 allSlot(ResultScreen 이 기존 채팅 패널을 넣는다)이고,
// 마피아·유령·귓속말 탭은 resultLog 프레임으로 받은 값만 읽는다 — 탭을 열기 전에는 본문이 DOM 에 없다(T-11-23). 기록 탭(11-11)은 view 로 일차 카드 띠와 하루 상세를 그린다(logSlot 이 있으면 그것이 우선).
// 확장(expanded)이면 패널이 위로 자라고(높이 expandedHeight) 입력줄(allSlot)은 DOM 에서 빠지며 알약 자리(pill, 11-12)만 폭 전체로 남는다.
// 줄 모양은 게임 중 채팅 줄과 같은 클래스(mv-chat__msg·dot·name·text)를 쓴다. 닉네임·본문은 React 텍스트 노드로만 그린다(T-11-22).

export type ResultTab = ResultTabId;

const TAB_ICON: Readonly<Record<ResultTab, V2IconName>> = { all: "send", mafia: "roleMafia", ghost: "ghost", whisper: "whisper", log: "timeline" };
/** 처음 나타날 때 점 표식이 붙는 탭(기록 탭은 없다) */
const DOT_TABS: readonly ResultTab[] = ["mafia", "ghost", "whisper"];

export interface ResultPanelProps {
  /** 지금 탭 */
  tab: ResultTab;
  onTab(t: ResultTab): void;
  /** 확장(전체가 아닌 탭) */
  expanded: boolean;
  /** 확장 높이 px. 없으면 CSS 기본값 */
  expandedHeight?: number;
  /** 거짓이면 탭 행에 전체 탭 하나뿐(첫 뒤집기 전) */
  tabsVisible: boolean;
  /** resultLog 부분별 줄 */
  lines: ResultLogSnapshot;
  /** 좌석 → 닉네임(없으면 이름 칸 비움) */
  contacts: ReadonlyMap<number, string>;
  /** 열어 본 적 있는 탭. 여기 없는 마피아·유령·귓속말 탭에 점이 붙는다 */
  opened: ReadonlySet<ResultTab>;
  /** 전체 탭 몸통(채팅 패널) */
  allSlot: ReactNode;
  /** 기록 탭 몸통을 직접 채운다(있으면 view 보다 우선) */
  logSlot?: ReactNode;
  /** 기록 탭의 귓속말 쌍을 눌렀다: 귓속말 탭의 그날(n 일차)로 이동한다 */
  onJumpWhisper?(n: number): void;
  /** 귓속말 탭이 열릴 때 보이게 스크롤할 일차 구분선 */
  focusDay?: number;
  /** 기록 탭이 읽는 공개 값(result·day.voteLog). 있으면 기록 탭이 일차 카드 띠와 하루 상세를 그린다(11-11) */
  view?: TimelineViewInput;
  /** 알약 자리(11-12). 확장일 때 폭 전체로 남는다 */
  pill?: ReactNode;
  /** 패널 요소 ref(스테이지 사각형 측정) */
  panelRef?: Ref<HTMLElement>;
  /** 키보드가 열려 있다: 탭 행을 숨겨 패널 높이를 키보드 열림 높이로 둔다 */
  kb?: boolean;
}

/** 기록 탭 몸통(11-11, D-8): 위 일차 카드 띠(고정), 아래 하루 상세(스크롤). 탭을 열 때 처음 그려지고 첫 일차가 선택돼 있다 */
function LogBody({ view, lines, contacts, onJumpWhisper }: { view: TimelineViewInput; lines: ResultLogSnapshot; contacts: ReadonlyMap<number, string>; onJumpWhisper?: (n: number) => void }) {
  const cards = timelineOf(view, lines);
  const [picked, setPicked] = useState<number | null>(null);
  const selected = picked !== null && cards.some((c) => c.n === picked) ? picked : (cards[0]?.n ?? 1);
  if (cards.length === 0) return <Empty />;
  return (
    <>
      <TimelineStrip cards={cards} selected={selected} onSelect={setPicked} contacts={contacts} />
      <DayDetail key={selected} lines={dayLinesOf(view, lines, selected)} contacts={contacts} {...(onJumpWhisper ? { onJumpWhisper } : {})} />
    </>
  );
}

function Arrow() {
  return (
    <svg className="mf-result__arrow" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </svg>
  );
}

function Empty() {
  return (
    <div className="mf-result__empty" data-result-empty="">
      <V2Icon name="quiet" size={32} />
    </div>
  );
}

/** 줄의 n 이 바뀔 때마다 앞에 구분선을 한 번 끼워 넣는다 */
function withDividers<L extends { n: number }>(lines: readonly L[], label: (n: number) => string, row: (l: L, i: number) => ReactNode): ReactNode[] {
  const out: ReactNode[] = [];
  let last: number | null = null;
  lines.forEach((l, i) => {
    if (l.n !== last) {
      last = l.n;
      out.push(
        <p key={`d${i}`} className="mf-result__divider" data-result-divider="" data-day={l.n}>
          {label(l.n)}
        </p>,
      );
    }
    out.push(row(l, i));
  });
  return out;
}

function ChatRows({ lines, contacts, label, ch }: { lines: readonly ResultLogChatLine[]; contacts: ReadonlyMap<number, string>; label: (n: number) => string; ch: "mafia" | "ghost" }) {
  if (lines.length === 0) return <Empty />;
  return (
    <>
      {withDividers(lines, label, (l, i) => (
        <p key={`l${i}`} className={ch === "mafia" ? "mv-chat__msg is-mafia" : "mv-chat__msg"} data-seat={l.seat} data-ch={ch}>
          <span className="mv-chat__dot" style={{ background: seatColorVar(l.seat) }} />
          <span className="mv-chat__name">{contacts.get(l.seat) ?? ""}</span>
          <span className="mv-chat__text">{l.text}</span>
        </p>
      ))}
    </>
  );
}

function WhisperRows({ lines, contacts }: { lines: readonly ResultLogWhisperLine[]; contacts: ReadonlyMap<number, string> }) {
  if (lines.length === 0) return <Empty />;
  return (
    <>
      {withDividers(lines, dayDivider, (l, i) => (
        <div key={`l${i}`} className="mf-result__whisper" data-result-whisper="" data-seat={l.seat} data-to={l.to}>
          <span className="mf-result__whisper-head">
            <span className="mf-result__whisper-dot" style={{ background: seatColorVar(l.seat) }} />
            <img className="mf-result__face" src={faceSrc(l.seat)} alt={contacts.get(l.seat) ?? ""} width={28} height={28} />
            <Arrow />
            <img className="mf-result__face" src={faceSrc(l.to)} alt={contacts.get(l.to) ?? ""} width={28} height={28} />
          </span>
          <span className="mf-result__whisper-text">{l.text}</span>
        </div>
      ))}
    </>
  );
}

export function ResultPanel(props: ResultPanelProps) {
  const { tab, onTab, expanded, expandedHeight, tabsVisible, lines, contacts, opened, allSlot, logSlot, view, onJumpWhisper, focusDay, pill, panelRef, kb } = props;
  const shown: readonly ResultTab[] = tabsVisible ? RESULT_TABS : ["all"];

  const onKey = (e: KeyboardEvent<HTMLElement>): void => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    const at = shown.indexOf(e.currentTarget.getAttribute("data-result-tab") as ResultTab);
    if (at < 0) return;
    e.preventDefault();
    const next = shown[(at + (e.key === "ArrowRight" ? 1 : shown.length - 1)) % shown.length]!;
    onTab(next);
    // 키보드 초점도 새 탭으로 옮긴다
    const list = e.currentTarget.parentElement;
    list?.querySelector<HTMLElement>(`[data-result-tab="${next}"]`)?.focus();
  };

  // 기록 탭의 귓속말 쌍으로 넘어온 경우: 귓속말 탭이 열리면 그날 구분선이 몸통 맨 위에 오도록 몸통만 스크롤한다(페이지는 움직이지 않는다)
  const bodyRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (tab !== "whisper" || focusDay === undefined) return;
    const body = bodyRef.current;
    const divider = body?.querySelector<HTMLElement>(`[data-result-divider][data-day="${focusDay}"]`);
    if (body && divider) body.scrollTop += divider.getBoundingClientRect().top - body.getBoundingClientRect().top;
  }, [tab, focusDay]);

  const style: CSSProperties | undefined = expanded && expandedHeight !== undefined ? { height: expandedHeight } : undefined;
  const cls = ["mf-result__panel", kb && "mf-result__panel--kb", expanded && "is-expanded"].filter(Boolean).join(" ");

  let body: ReactNode;
  if (tab === "all") body = allSlot;
  else if (tab === "mafia") body = <ChatRows lines={lines.mafia.lines} contacts={contacts} label={nightDivider} ch="mafia" />;
  else if (tab === "ghost") body = <ChatRows lines={lines.ghost.lines} contacts={contacts} label={dayDivider} ch="ghost" />;
  else if (tab === "whisper") body = <WhisperRows lines={lines.whisper.lines} contacts={contacts} />;
  else body = logSlot ?? (view ? <LogBody view={view} lines={lines} contacts={contacts} {...(onJumpWhisper ? { onJumpWhisper } : {})} /> : null);

  return (
    <section ref={panelRef} className={cls} style={style} data-world-panel="" data-result-panel="" data-expanded={String(expanded)} data-tab={tab}>
      {kb ? null : (
        <div className="mf-result__tabs" role="tablist" aria-label="결과 기록">
          {shown.map((id) => {
            const selected = id === tab;
            const dot = DOT_TABS.includes(id) && !opened.has(id);
            return (
              <button
                key={id}
                type="button"
                role="tab"
                className={id === "mafia" ? "mf-result__tab is-mafia" : "mf-result__tab"}
                data-result-tab={id}
                aria-selected={selected}
                aria-label={RESULT_PANEL_TEXT.tabName[id]}
                tabIndex={selected ? 0 : -1}
                onClick={() => onTab(id)}
                onKeyDown={onKey}
              >
                <V2Icon name={TAB_ICON[id]} size={24} />
                {selected ? <span className="mf-result__tab-label">{RESULT_PANEL_TEXT.tab[id]}</span> : null}
                {dot ? <i className="mf-result__tab-dot" data-result-dot="" aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
      )}
      {tab === "all" ? (
        body
      ) : (
        <div ref={bodyRef} className={tab === "log" ? "mv-chat__log mf-result__body mf-result__body--log" : "mv-chat__log mf-result__body"} data-result-body={tab} role="tabpanel">
          {body}
        </div>
      )}
      {expanded && pill ? <div className="mf-result__pill">{pill}</div> : null}
    </section>
  );
}
