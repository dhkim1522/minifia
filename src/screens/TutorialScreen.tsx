import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useSound } from "../audio/useSound";
import { FocusRing } from "../components/v2/FocusRing";
import { MeasuredOpeningFx } from "../components/v2/OpeningFx";
import type { FocusGroup } from "../components/v2/FocusRing";
import { TutorialHostBand } from "../components/v2/TutorialHostBand";
import { TutorialNext } from "../components/v2/TutorialNext";
import { TutorialProgress } from "../components/v2/TutorialProgress";
import { TutorialLinks } from "../components/v2/TutorialEvidence";
import { TutorialReveal } from "../components/v2/TutorialReveal";
import { TutorialRoleCards } from "../components/v2/TutorialRoleCards";
import { WorldStage } from "../components/WorldStage";
import { TUTORIAL_CAST, TUTORIAL_LINES, TUTORIAL_PICK, TUTORIAL_SCENES, WRONG_HINT_AFTER, makeTutorialSend, tutorialSnap, tutorialStageLook, tutorialStageView, tutorialView, tutorialCameraOf } from "../game/tutorialScript";
import type { TutorialFocusWindow, TutorialLineKey, TutorialSceneNo } from "../game/tutorialScript";
import { preloadRoleAssets } from "../net/assets";
import { ChatStore } from "../net/chatStore";
import { useFixedRoomHeight } from "../net/useFixedRoomHeight";
import { playTutorialCue, sayTutorialLine, useTutorialDirector } from "../net/useTutorialDirector";
import { WorldStore } from "../world/store";
import { GameMap } from "./GameMap";
import "../styles/phase.css";
import "../styles/room.css";
import "../styles/tutorial.css";

// 첫 사건 화면(17-04, TUT-03·05, 결정 0078-7·0080-12; 21-12 가 새 흐름으로 고침, TUT-06·D-28): 혼자·함께 공통. 대본(tutorialScript, 17-03)을 읽어 실제 게임 화면 위에서 장면 1~7 을 차례로 재생한다.
// 지도 장면(2~6)은 실제 GameMap 에 가짜 view(원인 흐름 판)·로컬 WorldStore·ChatStore·로컬 send 어댑터를 주고, 무대 장면(1·7)은 실제 WorldStage 를 직접 쓴다.
// 새 흐름의 실제 부품: 3 등불 켜기(가로등 표지·진행 점·[켜기] = ErrandMarker·ErrandDots·ErrandAct) · 4 현장 조사(ClueSpot·[살펴보기]·ClueCard) · 5 의심 보드(GameMap 토론 경로가 가짜 view 의 boardOf 결과로 실제 SuspectBoard 를 그린다).
// 모두 props·가짜 view 만 읽는 부품이라 서버 훅·내 역할이 필요 없다.
// 서버·소켓에는 아무것도 보내지 않는다: GameMap·WorldStage 에는 makeTutorialSend 결과만 주고, 실제 연결 훅·fetch·WebSocket 을 가져오지 않는다(T-17-10, 정적 가드).
// 화면 위에 튜토리얼에만 더하는 층(포커스 상자·진행 점·[건너뛰기]·[다음])을 얹는다. 장면별 연출은 renderSceneLayer·onPoint 자리에 얹는다:
// 17-05 가 장면 6 의 지목·오답 도움(이 파일)과 장면 5 의 연결 선(21-12: 칩 → 도윤 얼굴 선 하나)을, 17-08 이 장면 1 오프닝(OpeningFx, 2.6·3.3초 무대 모양 전환)과 장면 7 직업 카드를 채운다.
// 21-12 의 장면 6 정체 카드는 뒤집히지 않는다(뒷면 + 자물쇠 + "정체는 판이 끝나야 알아요" + 도장 "처형", D-20).

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
/** 좌석 → 출연 이름(위 알림·정체 공개 글에 쓴다 — 실제 닉네임이 아니다) */
const CAST_NAME: Readonly<Record<number, string>> = Object.fromEntries(TUTORIAL_CAST.seats.map((c) => [c.seat, c.name]));
/** 장면 6 정답 뒤 정체 공개까지(ms) — 장면 표의 pick.revealAfterMs 와 같은 값이다 */
const REVEAL_AFTER_MS = (() => {
  const adv = TUTORIAL_SCENES.find((x) => x.n === 6)?.advance;
  return adv?.kind === "pick" ? adv.revealAfterMs : 1100;
})();

/** 장면 1 무대 모양이 바뀌는 시각(ms, 장면 시계 기준): 2.6초에 서연이 사라지고 3.3초에 밤 조명이 dur-slow 로 켜진다(UI-SPEC 첫 사건 장면 계약 1행) */
const OPENING_GONE_MS = 2600;
const OPENING_NIGHT_MS = 3300;
/** 장면 1 에서 집 창이 하나씩 꺼지는 시각(ms): 장면 표의 tut.lampOff 큐 시각과 같은 값을 읽는다(소리와 창이 같이 꺼진다, D-28) */
const OPENING_LAMP_MS: readonly number[] = (TUTORIAL_SCENES[0]?.beats ?? []).filter((b) => b.sfx === "tut.lampOff").map((b) => b.at);

/** 장면 층이 읽는 화면 상태 */
interface SceneLayerCtx {
  /** 장면 6 정체 카드(뒤집히지 않는다) 중 */
  revealed: boolean;
  /** 장면 1 오프닝 연출 층을 그린다(무대가 준비돼 장면 시계가 선 뒤) */
  openingOn: boolean;
}

/** 장면 번호로 갈리는 겹침 층: 1 = 오프닝 연출(17-08), 5 = 의심 보드 위의 연결 선 하나, 6 = 정체 카드(정답 뒤 1.1초), 7 = 직업 카드 4장(17-08). 3·4·5 의 본체(표지·단서 카드·보드)는 GameMap 이 그린다 */
function renderSceneLayer(scene: TutorialSceneNo, ctx: SceneLayerCtx): ReactNode {
  if (scene === 1 && ctx.openingOn) return <MeasuredOpeningFx />;
  if (scene === 5) return <TutorialLinks />;
  if (scene === 6 && ctx.revealed) return <TutorialReveal name={CAST_NAME[TUTORIAL_CAST.suspect]} />;
  if (scene === 7) return <TutorialRoleCards />;
  return null;
}

// ---- 허용 목록(T-10, 0080-6, Pitfall 7) ----
// 튜토리얼은 정해진 한 길로만 눌린다. 장면마다 허용 목록 밖(머리·맵 입력면·심부름 타일 층·아래 패널·오른쪽 단추 열·시트 층, 장면 6 밖의 이름표 층)에 inert 를 붙인다.
// inert 는 자손이 풀 수 없으므로 허용 대상([처리] 층·이름표 층(장면 6)·[다음]·[건너뛰기]·소리 단추)은 차단 컨테이너 밖에 있어야 한다 —
// WorldStage 의 [처리] 층(data-errand-act-layer)은 입력면·타일 층·이름표 층의 형제이고, [다음]·[건너뛰기]·소리 단추는 GameMap 밖에 있다.
// 로컬 어댑터가 이동 메시지를 버리는 것이 세 번째 방어선이다.
const ALWAYS_BLOCKED = [".mf-game__header", ".mf-world__input", "[data-errand-layer]", "[data-clue-layer]", "[data-world-panel]", ".mf-game__panel", "[data-side-column]", ".mv-float", ".mf-game__record", "[data-sheet-layer]", ".mf-game__test"] as const;
/** 어떤 차단 컨테이너도 이 안을 가려선 안 된다(허용 대상 보호막) */
const ALLOWED = "[data-tutorial-skip], [data-tutorial-next], [data-sound-button], [data-tutorial-host]";

/** 장면 n 에서 막는 곳의 선택자 */
function blockedSelectors(n: PlayableScene): string[] {
  const out: string[] = [...ALWAYS_BLOCKED];
  if (n !== 6) out.push(".mf-world__tags");
  if (n !== 3 && n !== 4) out.push("[data-errand-act-layer]");
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

/** 장면에서 키보드 포커스가 가야 할 첫 허용 단추: [다음] 이 있으면 그것, 아니면 장면 3 은 [켜기], 장면 4 는 [살펴보기](둘 다 [data-errand-act]), 장면 6 은 첫 이름표 */
function firstAllowed(root: HTMLElement, n: PlayableScene, nextShown: boolean): HTMLElement | null {
  if (nextShown) return root.querySelector<HTMLElement>("[data-tutorial-next]");
  if (n === 3 || n === 4) return root.querySelector<HTMLElement>("[data-errand-act]");
  if (n === 6) return root.querySelector<HTMLElement>('button[data-pick]:not([aria-disabled="true"])');
  return null;
}

/** 장면 6 오답이 WRONG_HINT_AFTER 번 쌓인 뒤: 정답 이름표 하나만 깜빡인다(T-8) */
function hintGroups(): FocusGroup[] {
  return [{ key: `pick-${TUTORIAL_CAST.suspect}`, selectors: [`.mf-world__tag[data-seat="${TUTORIAL_CAST.suspect}"]`], pill: true }];
}

/** 지금 켜진 포커스 창 → 포커스 상자 묶음 */
function groupsOf(targets: readonly TutorialFocusWindow["target"][]): FocusGroup[] {
  const out: FocusGroup[] = [];
  for (const target of targets) {
    if (target === "band") out.push({ key: "band", selectors: ["[data-tutorial-host] .mv-host__band"] });
    else if (target === "errand") out.push({ key: "errand", selectors: [`button[data-errand-place="${TUTORIAL_CAST.errand.target}"]`, "[data-errand-act]"] });
    else if (target === "clue") out.push({ key: "clue", selectors: [`button[data-clue-spot="${TUTORIAL_CAST.clue.spot}"]`, "[data-errand-act]"] });
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

/** 장면에 들어갈 때의 위치: 그 장면의 snap 을 epoch 0 으로 넣는다(3·4 는 나 하나가 등불·지점 곁에 서 있다) */
function enterWorld(store: WorldStore, n: PlayableScene, at: number): void {
  store.applyFrame(tutorialSnap(n, at), 0);
}

/** 위 알림 한 건(GameMap 의 toast prop 모양 — 실제 판의 알림 경로와 같다. 연결 훅을 가져오지 않으려고 모양만 둔다) */
interface PointToast {
  id: number;
  text: string;
  icon: "point";
}

/** 장면 6 투표 상태(at 은 그 상태가 속한 장면 시작 시각) */
interface VoteState {
  at: number;
  picked: boolean;
  wrong: number;
  revealed: boolean;
}
const freshVote = (at: number): VoteState => ({ at, picked: false, wrong: 0, revealed: false });

/** 장면 3·4 행동 상태(at 은 그 상태가 속한 장면 시작 시각): lit = 등불을 켰다(진행 1/3), inspected = 옷 조각 지점을 살폈다(단서 카드) */
interface ActState {
  at: number;
  lit: boolean;
  inspected: boolean;
}
const freshAct = (at: number): ActState => ({ at, lit: false, inspected: false });

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

  // 직업 그림 네 장(장면 7)을 화면이 열릴 때 미리 받는다 — 혼자 하기에서도 마지막 장면 전에 그림이 와 있다(역할과 무관하게 모든 직업을 받는다)
  useEffect(() => {
    preloadRoleAssets();
  }, []);

  // 장면 6 투표 상태: picked(정답을 눌렀다)·wrong(오답 수)·revealed(정체 공개 중). 장면 시작 시각(at)을 같이 들고 있어 장면이 바뀌면 저절로 깨끗해진다
  const [voteState, setVoteState] = useState<VoteState>(() => freshVote(boot));
  const voteRef = useRef(voteState);
  const vote = voteState.at === cur.at ? voteState : freshVote(cur.at);
  const writeVote = useCallback((next: VoteState): void => {
    voteRef.current = next;
    setVoteState(next);
  }, []);
  // 위 알림(실제 TopToast 경로)과 띠 흔들림 번호
  const [toast, setToast] = useState<PointToast | null>(null);
  const [bandShake, setBandShake] = useState(0);
  // 장면 3·4 행동 상태: 등불을 켰다(lit)·옷 조각 지점을 살폈다(inspected). 장면 시작 시각(at)을 같이 들고 있어 장면이 바뀌면 저절로 깨끗해진다
  const [actState, setActState] = useState<ActState>(() => freshAct(boot));
  const act = actState.at === cur.at ? actState : freshAct(cur.at);
  const inspectedAt = useRef<number | null>(null);

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
  // 장면 1: 무대 모양 단계(step 1 = 서연이 사라짐, 2 = 밤 조명)와 꺼진 집 창 수(lamps, 0.8·1.3초에 하나씩). 장면 시계 시작(at)을 같이 들고 있어 다시 들어오면 저절로 0 으로 돌아간다
  const [opening, setOpening] = useState<{ at: number; step: 0 | 1 | 2; lamps: number } | null>(null);
  const openingNow = cur.n === 1 && opening !== null && startAt !== null && opening.at === startAt ? opening : null;
  const openingStep = openingNow?.step ?? 0;
  const openingLamps = openingNow?.lamps ?? 0;
  useEffect(() => {
    if (cur.n !== 1 || startAt === null) return;
    type Patch = Partial<{ step: 1 | 2; lamps: number }>;
    const patches: ReadonlyArray<readonly [number, Patch]> = [
      ...OPENING_LAMP_MS.map((ms, i): readonly [number, Patch] => [ms, { lamps: i + 1 }]),
      [OPENING_GONE_MS, { step: 1 }],
      [OPENING_NIGHT_MS, { step: 2 }],
    ];
    const apply = (patch: Patch): void =>
      setOpening((prev) => ({ ...(prev !== null && prev.at === startAt ? prev : { at: startAt, step: 0 as const, lamps: 0 }), ...patch }));
    const timers = patches.map(([ms, patch]) => {
      const wait = ms - (Date.now() - startAt);
      if (wait <= 0) {
        apply(patch);
        return undefined;
      }
      return setTimeout(() => apply(patch), wait);
    });
    return () => {
      for (const t of timers) if (t !== undefined) clearTimeout(t);
    };
  }, [cur.n, startAt]);

  // 장면별 상태: [다음] 이 나타났는가·켜진 포커스 창. 장면 번호를 같이 들고 있어 장면이 바뀌면 저절로 꺼진다
  const [nextFor, setNextFor] = useState<number | null>(null);
  const [focus, setFocus] = useState<{ n: number; targets: readonly TutorialFocusWindow["target"][] }>({ n: 0, targets: [] });
  const nextShown = nextFor === cur.n;
  // 사회자 띠의 지금 문장. 번호(nonce)는 장면과 상관없이 늘어나 같은 글도 새로 말한다. 장면이 바뀌면 띠 글은 저절로 비워진다
  const [said, setSaid] = useState<{ n: number; text: string; speakMs: number; nonce: number } | null>(null);
  const line = said !== null && said.n === cur.n ? said : null;
  const focusTargets = focus.n === cur.n ? focus.targets : [];
  // 장면 6: 정답을 누르면 이름표 상자는 모두 꺼지고, 오답이 쌓이면 도윤 하나만 남는다(T-8)
  // 장면 4: 옷 조각 지점을 살핀 뒤에는 포커스를 거둔다(단서 카드와 [다음] 이 나온다)
  const focusGroups = cur.n === 6 && vote.picked ? [] : cur.n === 6 && vote.wrong >= WRONG_HINT_AFTER ? hintGroups() : cur.n === 4 && act.inspected ? [] : groupsOf(focusTargets);

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

  /** 장면 표 밖에서(오답) 사회자가 말한다 — 새 문장이 이전 음절 예약을 끊는다(say 가 처리) */
  const speak = useCallback((key: TutorialLineKey): void => {
    const totalMs = sayTutorialLine(key);
    setSaid((prev) => ({ n: curRef.current.n, text: TUTORIAL_LINES[key], speakMs: totalMs, nonce: (prev?.nonce ?? 0) + 1 }));
  }, []);

  // [켜기] 로컬 어댑터: 장면 3 에서만 한 번 — 진행 1/3 이 되고 0.7초 뒤 다음 장면. 장면이 바뀌거나 언마운트되면 예약을 푼다
  const errandTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const revealTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    return () => {
      clearTimeout(errandTimer.current);
      errandTimer.current = undefined;
      clearTimeout(revealTimer.current);
      revealTimer.current = undefined;
    };
  }, [cur.n]);
  const onErrand = useCallback((): void => {
    if (curRef.current.n !== 3 || errandTimer.current !== undefined) return;
    setActState({ at: curRef.current.at, lit: true, inspected: false });
    errandTimer.current = setTimeout(() => {
      errandTimer.current = undefined;
      advanceFrom(3);
    }, ERRAND_NEXT_MS);
  }, [advanceFrom]);
  // [살펴보기] 로컬 어댑터: 장면 4 에서만 한 번 — 옷 조각 지점을 살펴 단서 카드("붉은 천 조각")가 뜨고 그때 [다음] 이 나온다. 단서 값은 출연 상수(붉은 천 조각)이고 서버로 아무것도 나가지 않는다.
  const onInspect = useCallback((): void => {
    const { n, at } = curRef.current;
    if (n !== 4 || inspectedAt.current === at) return;
    inspectedAt.current = at;
    setActState({ at, lit: false, inspected: true });
    playTutorialCue("tut.eye");
    setNextFor(4);
  }, []);
  // 장면 6 처리기. 정답(도윤): 도장 소리 → 실제 득표 경로(picked 가짜 view)·위 알림 "나 → 도윤" → 1.1초 뒤 정체 카드(뒤집히지 않음, 소리 없음)·[다음].
  // 오답: 버저·"단서를 떠올려 보세요"·띠 흔들림, 오답이 WRONG_HINT_AFTER 번 쌓이면 포커스는 도윤 하나만. 정답 뒤 눌림은 무시한다.
  const onPoint = useCallback(
    (seat: number): void => {
      const { n, at } = curRef.current;
      if (n !== 6) return;
      const v = voteRef.current.at === at ? voteRef.current : freshVote(at);
      if (v.picked) return;
      if (seat === TUTORIAL_CAST.suspect) {
        playTutorialCue(TUTORIAL_PICK.right.sfx);
        writeVote({ ...v, picked: true });
        setToast({ id: 1, text: `${CAST_NAME[TUTORIAL_CAST.me]} → ${CAST_NAME[TUTORIAL_CAST.suspect]}`, icon: "point" });
        clearTimeout(revealTimer.current);
        revealTimer.current = setTimeout(() => {
          revealTimer.current = undefined;
          if (curRef.current.at !== at) return;
          writeVote({ ...voteRef.current, revealed: true });
          setNextFor(6);
        }, REVEAL_AFTER_MS);
      } else {
        playTutorialCue(TUTORIAL_PICK.wrong.sfx);
        speak(TUTORIAL_PICK.wrong.say);
        writeVote({ ...v, wrong: v.wrong + 1 });
        setBandShake((k) => k + 1);
      }
    },
    [speak, writeVote],
  );
  const send = useMemo(() => makeTutorialSend({ onErrand, onInspect, onPoint }), [onErrand, onInspect, onPoint]);

  // 가짜 view 는 장면 시작 때 한 번만 만든다(매 렌더 새로 만들면 시각 기준이 흘러 흔들린다). 장면 3 은 켠 뒤(lit)·장면 4 는 살핀 뒤(inspected) 새 view 로 바뀐다
  // 장면 6 은 정답 뒤(picked)에 득표 한 줄이 든 view 로 바뀐다 — 실제 득표 배지·이름표 테두리가 서는 경로다. 오답마다도 새 view 를 줘서 GameMap 의 임시 "내 선택" 표시를 비운다(표가 없으니 테두리도 없다)
  const picked = cur.n === 6 && vote.picked;
  const wrongs = cur.n === 6 ? vote.wrong : 0;
  const lit = cur.n === 3 && act.lit;
  const inspected = cur.n === 4 && act.inspected;
  // eslint-disable-next-line react-hooks/exhaustive-deps -- wrongs 는 값이 아니라 "새 객체를 만들 때" 신호다
  const mapView = useMemo(() => (cur.n >= 2 && cur.n <= 6 ? tutorialView(cur.n as 2 | 3 | 4 | 5 | 6, { now: cur.at, ...(picked ? { picked: true } : {}), ...(lit ? { lit: true } : {}), ...(inspected ? { inspected: true } : {}) }) : null), [cur.n, cur.at, picked, wrongs, lit, inspected]);
  // 장면 1 은 집 창이 하나씩 꺼지고(openingLamps) 7 은 오프닝이 끝난 모습이다
  const stageView = useMemo(() => (cur.n === 1 ? tutorialStageView(1, cur.at, { lampsOff: openingLamps }) : cur.n === 7 ? tutorialStageView(7, cur.at) : null), [cur.n, cur.at, openingLamps]);
  const stageLook = useMemo(() => {
    if (cur.n === 1) return tutorialStageLook(1, { night: openingStep >= 2, victimGone: openingStep >= 1 });
    return cur.n === 7 ? tutorialStageLook(7, { night: true, victimGone: false }) : undefined;
  }, [cur.n, openingStep]);

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

  return (
    <div ref={rootRef} className="mf-root mf-room mf-tut" data-tutorial-screen="" data-tutorial-scene={cur.n} data-tutorial-mode={mode} {...(openingStep >= 1 ? { "data-tutorial-gone": TUTORIAL_CAST.victim } : {})}>
      <TutorialProgress scene={cur.n} onSkip={skip} />
      <div className="mf-room__body">
        <div key={kind} className="mf-phase-enter">
          {kind === "map" && mapView !== null ? (
            <GameMap view={mapView} store={store} chat={chat} send={send} canSend offset={0} panelless tod={false} camera={tutorialCameraOf(cur.n)} toast={cur.n === 6 ? toast : null} onLeave={skip} />
          ) : stageView !== null ? (
            <div className="mf-tut__stage">
              <WorldStage view={stageView} store={store} scene={stageLook} canWalk={false} send={send} canSend offset={0} onNotice={noop} onLeave={skip} onReady={onStageReady} />
            </div>
          ) : null}
        </div>
      </div>
      {renderSceneLayer(cur.n, { revealed: vote.revealed, openingOn: cur.n === 1 && startAt !== null })}
      <FocusRing groups={focusGroups} />
      {nextShown ? <TutorialNext onNext={() => advanceFrom(cur.n)} /> : null}
      {/* Tab 순서: [건너뛰기] → 지금 허용된 단추 → [다음] → 소리 단추(띠 독). 띠는 읽기만이라 본문 뒤에 둬도 z 로 위에 뜬다 */}
      <TutorialHostBand line={line?.text ?? null} speakMs={line?.speakMs ?? 0} nonce={line?.nonce ?? 0} shake={bandShake} sound={sound.supported ? sound : null} />
    </div>
  );
}
