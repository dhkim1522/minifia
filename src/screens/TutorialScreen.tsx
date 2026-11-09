import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useSound } from "../audio/useSound";
import { FocusRing } from "../components/v2/FocusRing";
import type { FocusGroup } from "../components/v2/FocusRing";
import { TutorialHostBand } from "../components/v2/TutorialHostBand";
import { TutorialNext } from "../components/v2/TutorialNext";
import { TutorialProgress } from "../components/v2/TutorialProgress";
import { WorldStage } from "../components/WorldStage";
import { TUTORIAL_CAST, TUTORIAL_LINES, TUTORIAL_SCENES, makeTutorialSend, tutorialSnap, tutorialStageLook, tutorialStageView, tutorialSuspectWalk, tutorialView } from "../game/tutorialScript";
import type { TutorialFocusWindow, TutorialSceneNo } from "../game/tutorialScript";
import { ChatStore } from "../net/chatStore";
import { useFixedRoomHeight } from "../net/useFixedRoomHeight";
import { useTutorialDirector } from "../net/useTutorialDirector";
import { WorldStore } from "../world/store";
import { GameMap } from "./GameMap";
import "../styles/phase.css";
import "../styles/room.css";
import "../styles/tutorial.css";

// 첫 사건 화면(17-04, TUT-03·05, 결정 0078-7·0080-12): 혼자·함께 공통. 대본(tutorialScript, 17-03)을 읽어 실제 게임 화면 위에서 장면 1~7 을 차례로 재생한다.
// 지도 장면(2~6)은 실제 GameMap 에 가짜 view·로컬 WorldStore·ChatStore·로컬 send 어댑터를 주고, 무대 장면(1·7)은 실제 WorldStage 를 직접 쓴다.
// 서버·소켓에는 아무것도 보내지 않는다: GameMap·WorldStage 에는 makeTutorialSend 결과만 주고, 실제 연결 훅·fetch·WebSocket 을 가져오지 않는다(T-17-10, 정적 가드).
// 화면 위에 튜토리얼에만 더하는 층(포커스 상자·진행 점·[건너뛰기]·[다음])을 얹는다. 장면별 연출(목격·증거·투표·정체 공개, 오프닝·직업 카드)은 renderSceneLayer·onPick 자리에 17-05·17-08 이 얹는다.

/** 이 화면이 재생하는 장면(1~7). 8(마무리 카드)은 이 화면 밖이다 */
type PlayableScene = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface TutorialScreenProps {
  /** 혼자 하기·함께 진행 모두 같은 장면이다(0080-14). 함께 진행의 끝났음 알림은 부르는 쪽이 한다 */
  mode: "solo" | "together";
  /** 장면 7 의 [다음] 은 "done", [건너뛰기] 는 어느 장면에서나 "skipped" */
  onEnd(reason: "done" | "skipped"): void;
  /** 시작 장면(시험과 [다시 보기] 가 쓴다). 기본 1 */
  initialScene?: TutorialSceneNo;
}

/** [처리] 를 누른 뒤 다음 장면으로 넘어가기까지(ms) — 장면 표의 act afterMs 와 같은 값이다 */
const ERRAND_NEXT_MS = 700;
/** 도윤 포커스 상자가 이름표 아래 몸까지 덮도록 더 늘리는 높이(0080-9, 시안 상자 96×132) */
const SUSPECT_BODY_PX = 90;

/** 장면 번호로 갈리는 겹침 층(17-05·17-08 이 채운다). 지금은 없다 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- 장면 확장 자리: 뒤 계획이 scene 으로 갈라 그린다
function renderSceneLayer(scene: TutorialSceneNo): ReactNode {
  return null;
}

// ---- 허용 목록(T-10, 0080-6, Pitfall 7) ----
// 튜토리얼은 정해진 한 길로만 눌린다. 장면마다 허용 목록 밖(머리·맵 입력면·심부름 타일 층·아래 패널·오른쪽 단추 열·시트 층, 장면 6 밖의 이름표 층)에 inert 를 붙인다.
// inert 는 자손이 풀 수 없으므로 허용 대상([처리] 층·이름표 층(장면 6)·[다음]·[건너뛰기]·소리 단추)은 차단 컨테이너 밖에 있어야 한다 —
// WorldStage 의 [처리] 층(data-errand-act-layer)은 입력면·타일 층·이름표 층의 형제이고, [다음]·[건너뛰기]·소리 단추는 GameMap 밖에 있다.
// 로컬 어댑터가 이동 메시지를 버리는 것이 세 번째 방어선이다.
const ALWAYS_BLOCKED = [".mf-game__header", ".mf-world__input", "[data-errand-layer]", "[data-world-panel]", ".mf-game__panel", "[data-side-column]", ".mv-float", ".mf-game__record", "[data-sheet-layer]", ".mf-game__test"] as const;
/** 어떤 차단 컨테이너도 이 안을 가려선 안 된다(허용 대상 보호막) */
const ALLOWED = "[data-tutorial-skip], [data-tutorial-next], [data-sound-button], [data-tutorial-host]";

/** 장면 n 에서 막는 곳의 선택자 */
function blockedSelectors(n: PlayableScene): string[] {
  const out: string[] = [...ALWAYS_BLOCKED];
  if (n !== 6) out.push(".mf-world__tags");
  if (n !== 3) out.push("[data-errand-act-layer]");
  return out;
}

/** root 안에서 막을 요소에 inert 를 붙이고, 더는 막지 않을 요소(전에 우리가 붙인 것)에서는 뗀다. 같은 입력이면 아무것도 바꾸지 않는다 */
function applyInert(root: HTMLElement, n: PlayableScene, marked: Set<Element>): void {
  const want = new Set<Element>();
  for (const el of root.querySelectorAll(blockedSelectors(n).join(","))) {
    if (el.querySelector(ALLOWED) !== null) continue; // 허용 대상을 품은 컨테이너는 막지 않는다
    want.add(el);
  }
  for (const el of [...marked]) {
    if (want.has(el)) continue;
    el.removeAttribute("inert");
    marked.delete(el);
  }
  for (const el of want) {
    if (!el.hasAttribute("inert")) el.setAttribute("inert", "");
    marked.add(el);
  }
}

/** 장면에서 키보드 포커스가 가야 할 첫 허용 단추: [다음] 이 있으면 그것, 아니면 장면 3 은 [처리], 장면 6 은 첫 이름표 */
function firstAllowed(root: HTMLElement, n: PlayableScene, nextShown: boolean): HTMLElement | null {
  if (nextShown) return root.querySelector<HTMLElement>("[data-tutorial-next]");
  if (n === 3) return root.querySelector<HTMLElement>("[data-errand-act]");
  if (n === 6) return root.querySelector<HTMLElement>('button[data-pick]:not([aria-disabled="true"])');
  return null;
}

/** 지금 켜진 포커스 창 → 포커스 상자 묶음 */
function groupsOf(targets: readonly TutorialFocusWindow["target"][]): FocusGroup[] {
  const out: FocusGroup[] = [];
  for (const target of targets) {
    if (target === "band") out.push({ key: "band", selectors: ["[data-tutorial-host] .mv-host__band"] });
    else if (target === "errand") out.push({ key: "errand", selectors: [`button[data-errand-place="${TUTORIAL_CAST.errand.target}"]`, "[data-errand-act]"] });
    else if (target === "suspect") out.push({ key: "suspect", selectors: [`.mf-world__tag[data-seat="${TUTORIAL_CAST.suspect}"]`], extendDown: SUSPECT_BODY_PX });
    else {
      // 지목할 수 있는 이름표 전부(나·탈락자 제외) — 각각 상자 하나, 알약 모서리
      for (const c of TUTORIAL_CAST.seats) {
        if (c.seat === TUTORIAL_CAST.me || c.seat === TUTORIAL_CAST.victim) continue;
        out.push({ key: `pick-${c.seat}`, selectors: [`.mf-world__tag[data-seat="${c.seat}"]`], pill: true });
      }
    }
  }
  return out;
}

/** 장면에 들어갈 때의 위치: 그 장면의 snap 을 epoch 0 으로 넣고, 장면 4 는 도윤이 걸어 들어오는 프레임을 더한다 */
function enterWorld(store: WorldStore, n: PlayableScene, at: number): void {
  store.applyFrame(tutorialSnap(n, at), 0);
  if (n === 4) store.applyFrame(tutorialSuspectWalk(at), 0);
}

interface SceneState {
  n: PlayableScene;
  /** 장면에 들어간 로컬 시각 — 가짜 view 의 시각 기준이다(장면 시작 때 한 번 고정, Pitfall 3) */
  at: number;
}

export function TutorialScreen({ mode, onEnd, initialScene = 1 }: TutorialScreenProps) {
  const first = Math.min(Math.max(initialScene, 1), 7) as PlayableScene;
  const rootRef = useRef<HTMLDivElement>(null);
  useFixedRoomHeight(rootRef);

  // 로컬 위치·채팅 저장소: 방 화면의 것과 분리된 이 화면만의 것이다. 처음 장면의 위치를 처음 그리기 전에 넣는다
  const [boot] = useState(() => Date.now());
  const [store] = useState(() => {
    const s = new WorldStore();
    enterWorld(s, first, boot);
    return s;
  });
  const [chat] = useState(() => new ChatStore());
  const [cur, setCur] = useState<SceneState>({ n: first, at: boot });
  const curRef = useRef(cur);
  curRef.current = cur;

  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;

  const goto = useCallback(
    (n: PlayableScene): void => {
      const at = Date.now();
      enterWorld(store, n, at);
      setCur({ n, at });
    },
    [store],
  );
  /** 장면 n 을 마치고 다음으로: 7 이면 끝 */
  const advanceFrom = useCallback(
    (n: PlayableScene): void => {
      if (n >= 7) onEndRef.current("done");
      else goto((n + 1) as PlayableScene);
    },
    [goto],
  );

  // 무대 장면의 시계는 WorldStage 준비 뒤에 시작한다 — 그 전에는 기존 장면 가림막이 덮는다(UI Considerations #5)
  const kind = TUTORIAL_SCENES.find((s) => s.n === cur.n)?.render === "stage" ? "stage" : "map";
  const [ready, setReady] = useState<{ n: number; at: number } | null>(null);
  const onStageReady = useCallback((): void => setReady({ n: curRef.current.n, at: Date.now() }), []);
  const startAt = kind === "map" ? cur.at : ready !== null && ready.n === cur.n ? ready.at : null;

  // 장면별 상태: [다음] 이 나타났는가·켜진 포커스 창. 장면 번호를 같이 들고 있어 장면이 바뀌면 저절로 꺼진다
  const [nextFor, setNextFor] = useState<number | null>(null);
  const [focus, setFocus] = useState<{ n: number; targets: readonly TutorialFocusWindow["target"][] }>({ n: 0, targets: [] });
  const nextShown = nextFor === cur.n;
  // 사회자 띠의 지금 문장. 번호(nonce)는 장면과 상관없이 늘어나 같은 글도 새로 말한다. 장면이 바뀌면 띠 글은 저절로 비워진다
  const [said, setSaid] = useState<{ n: number; text: string; speakMs: number; nonce: number } | null>(null);
  const line = said !== null && said.n === cur.n ? said : null;
  const focusTargets = focus.n === cur.n ? focus.targets : [];

  useTutorialDirector({
    scene: cur.n,
    startAt,
    onSay: (key, totalMs) => setSaid((prev) => ({ n: curRef.current.n, text: TUTORIAL_LINES[key], speakMs: totalMs, nonce: (prev?.nonce ?? 0) + 1 })),
    onShowNext: () => setNextFor(curRef.current.n),
    onAuto: () => advanceFrom(curRef.current.n),
    onFocus: (target, on) =>
      setFocus((prev) => {
        const n = curRef.current.n;
        const base = prev.n === n ? prev.targets : [];
        const has = base.includes(target);
        if (on === has) return prev.n === n ? prev : { n, targets: base };
        return { n, targets: on ? [...base, target] : base.filter((t) => t !== target) };
      }),
  });

  // [처리] 로컬 어댑터: 장면 3 에서만 0.7초 뒤 다음 장면. 장면이 바뀌거나 언마운트되면 예약을 푼다
  const errandTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    return () => {
      clearTimeout(errandTimer.current);
      errandTimer.current = undefined;
    };
  }, [cur.n]);
  const onErrand = useCallback((): void => {
    if (curRef.current.n !== 3 || errandTimer.current !== undefined) return;
    errandTimer.current = setTimeout(() => {
      errandTimer.current = undefined;
      advanceFrom(3);
    }, ERRAND_NEXT_MS);
  }, [advanceFrom]);
  // 장면 6 처리기: 정답(도윤)이면 다음 장면으로, 오답이면 아무것도 하지 않는다(17-05 가 정답·오답 연출로 채운다)
  const onPoint = useCallback(
    (seat: number): void => {
      if (curRef.current.n === 6 && seat === TUTORIAL_CAST.suspect) advanceFrom(6);
    },
    [advanceFrom],
  );
  const send = useMemo(() => makeTutorialSend({ onErrand, onPoint }), [onErrand, onPoint]);

  // 가짜 view 는 장면 시작 때 한 번만 만든다(매 렌더 새로 만들면 마감 시각이 흘러 흔적 구간이 흔들린다)
  const mapView = useMemo(() => (cur.n >= 2 && cur.n <= 6 ? tutorialView(cur.n as 2 | 3 | 4 | 5 | 6, { now: cur.at }) : null), [cur.n, cur.at]);
  const stageView = useMemo(() => (cur.n === 1 || cur.n === 7 ? tutorialStageView(cur.n, cur.at) : null), [cur.n, cur.at]);
  const stageLook = useMemo(() => (cur.n === 1 || cur.n === 7 ? tutorialStageLook(cur.n, { night: true, victimGone: false }) : undefined), [cur.n]);

  // 소리: 혼자·함께 모두 같다(0080-14). 소리 단추는 띠 독에 있고 전역 소리 설정을 따른다. 방 view 가 없어 침대·view 차이 소리는 없다
  const sound = useSound({ active: true, view: null });

  // 허용 목록 차단과 포커스 이동: 렌더마다, 그리고 안쪽 DOM 이 바뀔 때(WorldStage 의 [처리] 알약·이름표 버튼이 나중에 생길 수 있다)마다 맞춘다.
  // 포커스는 "장면 × [다음] 유무" 가 바뀐 뒤 처음 허용 단추가 생겼을 때 한 번만 옮긴다 — 이미 옮겼으면 사용자의 포커스를 다시 뺏지 않는다
  const inertMarked = useRef(new Set<Element>());
  const focusedKey = useRef("");
  const gate = useRef({ n: cur.n, nextShown });
  gate.current = { n: cur.n, nextShown };
  const syncGate = useRef((): void => {});
  syncGate.current = (): void => {
    const root = rootRef.current;
    if (root === null) return;
    const { n, nextShown: showNext } = gate.current;
    applyInert(root, n as PlayableScene, inertMarked.current);
    const key = `${n}:${showNext}`;
    if (focusedKey.current === key) return;
    const target = firstAllowed(root, n as PlayableScene, showNext);
    if (target === null) return;
    focusedKey.current = key;
    target.focus({ preventScroll: true });
  };
  useLayoutEffect(() => {
    syncGate.current();
  });
  useEffect(() => {
    const root = rootRef.current;
    if (root === null || typeof MutationObserver === "undefined") return;
    const observer = new MutationObserver(() => syncGate.current());
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  const noop = useCallback((): void => {}, []);
  const skip = useCallback((): void => onEndRef.current("skipped"), []);
  const roleCard = useMemo(() => ({ unread: false, onOpen: noop }), [noop]);

  return (
    <div ref={rootRef} className="mf-root mf-room mf-tut" data-tutorial-screen="" data-tutorial-scene={cur.n} data-tutorial-mode={mode}>
      <TutorialProgress scene={cur.n} onSkip={skip} />
      <div className="mf-room__body">
        <div key={kind} className="mf-phase-enter">
          {kind === "map" && mapView !== null ? (
            <GameMap view={mapView} store={store} chat={chat} send={send} canSend offset={0} roleCard={roleCard} onLeave={skip} />
          ) : stageView !== null ? (
            <div className="mf-tut__stage">
              <WorldStage view={stageView} store={store} scene={stageLook} canWalk={false} send={send} canSend offset={0} onNotice={noop} onLeave={skip} onReady={onStageReady} />
            </div>
          ) : null}
        </div>
      </div>
      {renderSceneLayer(cur.n)}
      <FocusRing groups={groupsOf(focusTargets)} />
      {nextShown ? <TutorialNext onNext={() => advanceFrom(cur.n)} /> : null}
      {/* Tab 순서: [건너뛰기] → 지금 허용된 단추 → [다음] → 소리 단추(띠 독). 띠는 읽기만이라 본문 뒤에 둬도 z 로 위에 뜬다 */}
      <TutorialHostBand line={line?.text ?? null} speakMs={line?.speakMs ?? 0} nonce={line?.nonce ?? 0} sound={sound.supported ? sound : null} />
    </div>
  );
}
