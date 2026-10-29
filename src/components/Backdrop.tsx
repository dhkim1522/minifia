import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { SCENES, SCENE_FADE_MS, SCENE_IMAGE_WAIT_MS, headerScrimGradient, nightVignetteGradient } from "../game/scenes";
import type { SceneId } from "../game/scenes";
import { backdropUrl } from "../net/assets";
import "../styles/atmosphere.css";

type LayerState = "entering" | "current" | "leaving";
interface Layer {
  id: number;
  scene: SceneId;
  state: LayerState;
}

interface BaseProps {
  /** 전환 없이 바로 바꾼다(재접속처럼 서버 시각이 건너뛴 렌더) */
  instant?: boolean;
  className?: string;
  children?: ReactNode;
}
export type BackdropProps =
  | (BaseProps & {
      layout: "game";
      scene: SceneId;
      /** 처음에는 이 장면이 보였다가 곧 scene 으로 크로스페이드한다 */
      fromScene?: SceneId;
      /** 밤 그림 층 안에 가장자리 비네팅 하나를 둔다(05-03, DayScene 만 켠다). 층과 함께 켜지고 꺼진다. */
      vignette?: boolean;
    })
  | (BaseProps & { layout: "entry"; scene: "lobby"; fromScene?: undefined; vignette?: undefined });

/** 동시에 그리는 층의 최대 수: 걷히는 중 둘 + 켜지는 중(또는 current) 하나 */
const MAX_LAYERS = 3;
/** 전환이 끝난 뒤 걷어내기 전 여유(ms) */
const REMOVE_SLACK_MS = 100;

// entry 구도는 lobby 장면뿐이라(BackdropProps 가 보장) game 시그니처로 좁혀 부른다. 구도는 값 그대로 쓰인다.
const urlOf = (layout: "game" | "entry", scene: SceneId) => backdropUrl(layout as "game", scene);

/** 새 그림이 준비되면 끝나는 약속. Image.decode 가 없으면(또는 Image 가 없으면) 바로 끝난다. 실패해도 끝난다(기다리다 멈추지 않게). */
function whenImageReady(url: string): Promise<void> {
  if (typeof Image === "undefined") return Promise.resolve();
  const img = new Image();
  img.src = url;
  if (typeof img.decode !== "function") return Promise.resolve();
  return img.decode().then(
    () => undefined,
    () => undefined,
  );
}

/** 새 장면으로 가는 층 목록. 기다리던 층은 걷어내고, 이미 current 가 그 장면이면 그대로 둔다. */
function withTarget(layers: Layer[], scene: SceneId, id: number): Layer[] {
  const kept = layers.filter((l) => l.state !== "entering");
  if (kept.some((l) => l.state === "current" && l.scene === scene)) return kept;
  const next = [...kept, { id, scene, state: "entering" as const }];
  // 층이 넘치면 가장 오래된 leaving 부터 걷는다
  while (next.length > MAX_LAYERS) {
    const i = next.findIndex((l) => l.state === "leaving");
    if (i < 0) break;
    next.splice(i, 1);
  }
  return next;
}

// 화면 뒤 배경 장면. 그림은 cover 로 채우고 기준은 가운데 위쪽이다.
// 장면(scene)이 바뀌면 층을 쌓아 0.8초 크로스페이드한다: 새 층은 그림이 준비된 뒤(상한 1.2초) 켜지고, 그동안 이전 그림이 그대로 보인다.
// 처음 마운트와 instant 는 전환 없이 한 층이다. 막이 있는 장면(아침·낮)은 헤더 위쪽 어두운 막을, vignette 가 켜진 밤은 가장자리 비네팅을 같은 층 안에 가져 층과 함께 전환된다.
export function Backdrop(props: BackdropProps) {
  const { layout, scene, fromScene, vignette, instant, className, children } = props;
  const nextId = useRef(1);
  const rootRef = useRef<HTMLDivElement>(null);
  const [layers, setLayers] = useState<Layer[]>(() => [{ id: 0, scene: fromScene && !instant ? fromScene : scene, state: "current" }]);
  // 렌더 중 상태 조정: 요청된 장면이 바뀌면 바로 층 목록을 고쳐 한 프레임도 이전 그림에 머물지 않는다.
  const [requested, setRequested] = useState<SceneId>(layers[0]!.scene);
  if (requested !== scene) {
    setRequested(scene);
    if (instant) setLayers([{ id: nextId.current++, scene, state: "current" }]);
    else setLayers(withTarget(layers, scene, nextId.current++));
  }

  // 켜지는 층: 그림이 준비되면(상한 SCENE_IMAGE_WAIT_MS) 이전 current 는 leaving, 이 층은 current
  const enteringId = layers.find((l) => l.state === "entering")?.id;
  const enteringScene = layers.find((l) => l.state === "entering")?.scene;
  useEffect(() => {
    if (enteringId === undefined || enteringScene === undefined) return;
    let done = false;
    const start = () => {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      setLayers((ls) =>
        ls.some((l) => l.id === enteringId && l.state === "entering")
          ? ls.map((l) => (l.id === enteringId ? { ...l, state: "current" as const } : l.state === "current" ? { ...l, state: "leaving" as const } : l))
          : ls,
      );
    };
    const timer = window.setTimeout(start, SCENE_IMAGE_WAIT_MS);
    void whenImageReady(urlOf(layout, enteringScene)).then(start);
    return () => {
      done = true;
      window.clearTimeout(timer);
    };
  }, [enteringId, enteringScene, layout]);

  // 막 켜진 층의 시작 불투명도(0)를 브라우저가 먼저 확정하게 한다 — 그래야 current 로 바뀔 때 전환이 걸린다
  useLayoutEffect(() => {
    for (const el of rootRef.current?.querySelectorAll<HTMLElement>('.mf-backdrop__art[data-state="entering"]') ?? []) void getComputedStyle(el).opacity;
  }, [layers]);

  // 걷히는 층: 전환이 끝나면 걷어낸다
  const leavingKey = layers
    .filter((l) => l.state === "leaving")
    .map((l) => l.id)
    .join(",");
  useEffect(() => {
    if (leavingKey === "") return;
    const timer = window.setTimeout(() => setLayers((ls) => ls.filter((l) => l.state !== "leaving")), SCENE_FADE_MS + REMOVE_SLACK_MS);
    return () => window.clearTimeout(timer);
  }, [leavingKey]);

  const classes = ["mf-backdrop", `mf-backdrop--${scene}`, className].filter(Boolean).join(" ");
  return (
    <div className={classes} ref={rootRef}>
      {layers.map((l) => {
        const style: CSSProperties & Record<string, string> = {
          backgroundImage: `url("${urlOf(layout, l.scene)}")`,
          backgroundPosition: "center top",
        };
        if (SCENES[l.scene].scrim) style["--mf-scrim"] = headerScrimGradient();
        // 비네팅은 night 그림 층의 자식이라 층의 0.8초 크로스페이드를 그대로 따른다(재접속 instant 는 한 층이라 바로 켜진 상태).
        const vignetteStyle: CSSProperties & Record<string, string> = { "--mf-vignette": nightVignetteGradient() };
        return (
          <div key={l.id} className="mf-backdrop__art" data-scene={l.scene} data-state={l.state} style={style} aria-hidden="true">
            {vignette && l.scene === "night" ? <div className="mf-backdrop__vignette" style={vignetteStyle} /> : null}
          </div>
        );
      })}
      {children ? <div className="mf-backdrop__content">{children}</div> : null}
    </div>
  );
}
