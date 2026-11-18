// 혼자 하기의 실제 게임 화면 조립. 위치와 채팅은 이 화면에만 있으며 모든 입력은 로컬 대본으로 돌아온다.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent, RefObject } from "react";
import { emitSignal } from "../audio/signals";
import { useSound } from "../audio/useSound";
import { Button } from "../components/Button";
import { RoleCardSheet } from "../components/RoleCardSheet";
import { FocusRing } from "../components/tutorial/FocusRing";
import { TutorialFrame } from "../components/tutorial/TutorialFrame";
import { HostBand } from "../components/v2/HostBand";
import { V2Icon } from "../components/v2/V2Icon";
import type { V2IconName } from "../components/v2/V2Icon";
import { dayEvents } from "../game/dayView";
import {
  ANSWER_ROW_LAST_EXTRA_MS,
  ANSWER_ROW_START_MS,
  ANSWER_ROW_STEP_MS,
  ROLE_ICON_STEP_MS,
  TUTORIAL_CAST,
  TUTORIAL_CHAT,
  TUTORIAL_PILLS,
  tutorialSnap,
  tutorialView,
} from "../game/tutorialScript";
import type { TutorialSceneId, TutorialTargetId } from "../game/tutorialScript";
import { preloadRoleAssets } from "../net/assets";
import { ChatStore } from "../net/chatStore";
import { useFixedRoomHeight } from "../net/useFixedRoomHeight";
import { useTutorialScene } from "../net/useTutorialScene";
import { WorldStore } from "../world/store";
import { GameMap } from "./GameMap";
import { Keyword } from "./Keyword";
import { PreGame } from "./PreGame";
import { RoleReveal } from "./RoleReveal";
import "../styles/room.css";
import "../styles/tutorial.css";

const ROLE_ICONS: readonly V2IconName[] = ["roleCitizen", "roleMafia", "rolePolice", "roleDoctor"];
const PANEL = "[data-world-panel], .mf-keyword__answer";
const CONTROL = "button, input, textarea, select, a[href]";
const ALWAYS_ALLOWED = "[data-tutorial-exit], [data-tutorial-home], [data-tutorial-replay], [data-sound-button]";
const NOOP = () => {};

function selectorFor(target: TutorialTargetId, scene: TutorialSceneId): string {
  switch (target) {
    case "send": return "[data-answer-send]";
    case "endDiscussion": return "[data-end-discussion]";
    case "yes": return '[data-verdict="yes"]';
    case "tag-4": return scene === "postit" ? '[data-suspect-tag="4"]' : '[data-pick="4"]';
    case "face-0": return '[data-face="0"]';
    case "suspect-btn": return "[data-suspect-btn]";
  }
}

function useTutorialLayout(root: RefObject<HTMLDivElement | null>, target: string | null, scene: TutorialSceneId, beat: string) {
  const [bottomEdge, setBottomEdge] = useState(0);
  useLayoutEffect(() => {
    const host = root.current;
    if (host === null) return;
    const panel = host.querySelector<HTMLElement>(PANEL);
    const measure = () => {
      const next = panel === null ? 0 : Math.max(0, Math.round(host.getBoundingClientRect().bottom - panel.getBoundingClientRect().top));
      setBottomEdge(next);
    };
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(host);
    if (panel !== null) observer?.observe(panel);
    return () => observer?.disconnect();
  }, [root, scene, beat]);

  useLayoutEffect(() => {
    const host = root.current;
    if (host === null) return;
    const allow = target === null ? ALWAYS_ALLOWED : `${ALWAYS_ALLOWED}, ${target}`;
    const blocked = new Set<HTMLElement>();
    const markControls = () => {
      for (const control of host.querySelectorAll<HTMLElement>(CONTROL)) {
        if (!control.matches(allow) && !control.hasAttribute("inert")) {
          blocked.add(control);
          control.setAttribute("inert", "");
        }
      }
    };
    markControls();
    const observer = new MutationObserver(markControls);
    observer.observe(host, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      for (const control of blocked) control.removeAttribute("inert");
    };
  }, [root, target, scene, beat]);
  return bottomEdge;
}

interface TutorialTestHook {
  scene(): string;
  skipTo(scene: TutorialSceneId): void;
}
type TestWindow = Window & { __mfTutorial?: TutorialTestHook };

export function TutorialScreen({ onExit }: { onExit: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  useFixedRoomHeight(root);
  const clickSuspect = useCallback(() => root.current?.querySelector<HTMLButtonElement>("[data-suspect-btn]")?.click(), []);
  const { cursor, scene, beat, target, send, openSuspect, go } = useTutorialScene(clickSuspect);
  const { index, startedAt, beatAt, acted } = cursor;
  const sceneId = scene.id;
  const beatId = beat.id;
  const selector = target === null ? null : selectorFor(target, sceneId);
  const bottomEdge = useTutorialLayout(root, selector, sceneId, beatId);
  const [store] = useState(() => {
    const world = new WorldStore();
    world.applyFrame(tutorialSnap("roles", startedAt), 0);
    return world;
  });
  const [chat] = useState(() => new ChatStore());
  const [cardSeen, setCardSeen] = useState(false);
  const [shownAnswers, setShownAnswers] = useState(0);

  const view = useMemo(() => tutorialView(sceneId, beatId, startedAt, acted), [sceneId, beatId, startedAt, acted]);
  const timelessView = useMemo(() => ({ ...view, phaseEndsAt: null, phaseDurationMs: null }), [view]);
  const answers = view.day?.keyword?.answers;
  const recordsView = sceneId === "answers" && view.day && answers
    ? { ...view, day: { ...view.day, keyword: { ...view.day.keyword, genre: TUTORIAL_CAST.genre, answers: answers.slice(0, shownAnswers) } } }
    : view;
  const sound = useSound({ view: timelessView });

  useEffect(() => preloadRoleAssets(), []);
  useLayoutEffect(() => {
    store.applyFrame(tutorialSnap(sceneId, startedAt), 0);
    if (sceneId === "roles") {
      chat.reset();
      setCardSeen(false);
    }
  }, [sceneId, startedAt, store, chat]);
  const entrySoundAt = useRef<number | null>(null);
  useEffect(() => {
    if (entrySoundAt.current === startedAt) return;
    entrySoundAt.current = startedAt;
    emitSignal({ kind: "host" });
  }, [startedAt]);
  useEffect(() => {
    if (beat.sfx === "ui.card") emitSignal({ kind: "card", delayMs: 0 });
    if (beat.sfx === "ui.tap") emitSignal({ kind: "tap" });
    if (beat.sfx === "ui.host") emitSignal({ kind: "host" });
  }, [beat, startedAt]);

  useEffect(() => {
    setShownAnswers(0);
    if (sceneId !== "answers" || answers === undefined) return;
    const timers = answers.map((_, i) => setTimeout(
      () => setShownAnswers(i + 1),
      ANSWER_ROW_START_MS + ANSWER_ROW_STEP_MS * i + (i === answers.length - 1 ? ANSWER_ROW_LAST_EXTRA_MS : 0),
    ));
    return () => timers.forEach(clearTimeout);
  }, [sceneId, startedAt]);
  useEffect(() => {
    if (sceneId !== "discussion") return;
    const timers = TUTORIAL_CHAT.map((line, i) => setTimeout(() => {
      const now = Date.now();
      chat.apply({ t: "chat", ch: "all", seat: line.seat, seq: i + 1, text: line.text, at: now }, 0, now);
      if (line.emote) store.applyEmote({ t: "emote", seat: line.seat, id: line.emote, n: i + 1 }, 0);
    }, line.atMs));
    return () => timers.forEach(clearTimeout);
  }, [sceneId, startedAt, chat, store]);

  const points = view.day?.points;
  const lastPoint = points?.at(-1);
  const nPoints = points?.length ?? 0;
  const pointSeat = lastPoint?.seat;
  useEffect(() => {
    if (sceneId === "pick" && pointSeat !== undefined) store.applyEmote({ t: "emote", seat: pointSeat, id: "point", n: nPoints }, 0);
  }, [sceneId, pointSeat, nPoints, store]);
  useEffect(() => {
    if (sceneId !== "end") return;
    for (const { seat } of TUTORIAL_CAST.seats) {
      if (seat === TUTORIAL_CAST.executed || seat === TUTORIAL_CAST.nightVictim) continue;
      store.applyEmote({ t: "emote", seat, id: "clap", n: 1 }, 0);
    }
  }, [sceneId, startedAt, store]);

  const testScene = useRef<TutorialSceneId>(sceneId);
  testScene.current = sceneId;
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("e2e") !== "1") return;
    const targetWindow = window as TestWindow;
    const hook = { scene: () => testScene.current, skipTo: go };
    targetWindow.__mfTutorial = hook;
    return () => {
      if (targetWindow.__mfTutorial === hook) delete targetWindow.__mfTutorial;
    };
  }, [go]);

  const onClick = (event: MouseEvent<HTMLDivElement>) => {
    const element = event.target instanceof Element ? event.target : null;
    if (element?.closest(ALWAYS_ALLOWED)) return;
    if (selector !== null && element?.closest(selector)) {
      if (target === "suspect-btn") openSuspect();
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  };
  const pregame = sceneId === "roles" || sceneId === "keyword";
  const finalScreen = sceneId === "end";
  const liveAnnouncements = sceneId === "will" && beatId === "b"
    ? dayEvents(tutorialView("pick", "c", startedAt), view).announces
    : sceneId === "night" && beatId === "c"
    ? dayEvents(tutorialView("night", "b", startedAt), view).announces
    : [];
  const fading = sceneId === "will" && beatId === "b" ? new Map([[TUTORIAL_CAST.executed, beatAt]]) : undefined;
  return (
    <div
      ref={root}
      className="mf-root mf-room tut-room"
      data-tutorial-screen=""
      data-tutorial-scene={sceneId}
      data-tutorial-beat={beatId}
      onClickCapture={onClick}
      onKeyDownCapture={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onExit();
        }
      }}
    >
      <HostBand view={timelessView} offset={0} cardSeen={cardSeen} sound={sound.supported ? sound : null} />
      <div className="mf-room__body">
        {pregame ? (
          <PreGame view={view} store={store} send={send} canSend offset={0} onLeave={onExit}>
            {sceneId === "roles" ? (
              <RoleReveal view={view} offset={0} myRoleButton={null} onSeenFront={() => setCardSeen(true)} />
            ) : (
              <Keyword key={beatId} view={view} offset={0} myRoleButton={null} send={send} canSend timeless />
            )}
          </PreGame>
        ) : (
          <GameMap view={view} store={store} chat={chat} send={send} canSend offset={0} tod={false}
            timeless bottomExtra={60} onLeave={onExit} announce={liveAnnouncements[0] ?? null}
            {...(fading === undefined ? {} : { fading })} />
        )}
      </div>
      {sceneId === "roles" && (beatId === "b" || beatId === "c") ? (
        <div className="tut-role-icons" aria-hidden="true">
          {ROLE_ICONS.map((icon, i) => <span key={icon} style={{ animationDelay: `${i * ROLE_ICON_STEP_MS}ms` }}><V2Icon name={icon} size={22} /></span>)}
        </div>
      ) : null}
      {sceneId === "answers" ? (
        <RoleCardSheet view={recordsView} showBack={false} tab="records" onTab={NOOP} unread={0} newCount={0} onClose={NOOP} modal={false} />
      ) : null}
      {finalScreen ? (
        <section className="tut-end" aria-labelledby="tut-end-title">
          <h2 id="tut-end-title" className="mf-t-heading">이제 친구와 한 판 해요</h2>
          <Button block data-tutorial-home="" onClick={onExit}>홈으로</Button>
          <Button variant="text" block data-tutorial-replay="" onClick={() => go("roles")}>다시 보기</Button>
        </section>
      ) : null}
      <div key={startedAt} className="tut-cut" aria-hidden="true" />
      <FocusRing target={target === null || selector === null ? null : { id: target, selectors: [selector], pill: target === "tag-4" }} />
      <TutorialFrame step={index + 1} pill={beat.pill === null ? null : TUTORIAL_PILLS[beat.pill]}
        place={sceneId === "answers" ? "top" : bottomEdge > 0 && !finalScreen ? "aboveBottom" : "bottom"}
        bottomEdge={bottomEdge} hideExit={finalScreen} onExit={onExit} />
    </div>
  );
}
