// 17-04: 첫 사건 화면 시험용 가짜 WorldStage. 받은 props 를 기억하고, 마운트 때 onReady 를 부르며,
// 허용 목록 시험이 보는 층(입력면·심부름 층·[처리] 층·이름표 층 + 지목 버튼)만 최소 DOM 으로 그린다. 실제 구조(WorldStage.tsx)와 같은 형제 관계다.
// 21-15: 새 흐름의 층도 그린다 — 심부름 타일(받은 장소마다), 현장 단서 지점(clues.spotsOn), 밤 집 판(houses). 그림은 진짜 부품(ErrandMarker·ClueSpot·HousePick)이고
// 위치는 쓰지 않는다(투영은 실제 WorldStage 의 일이다).
// 쓰는 법(vi.mock 은 파일마다 있어야 한다):
//   vi.mock("../../src/components/WorldStage", async () => ({ WorldStage: (await import("../helpers/fakeTutorialStage")).FakeTutorialStage }));
import { createElement, useEffect } from "react";
import type { ReactElement } from "react";
import type { WorldStageProps } from "../../src/components/WorldStage";
import { ClueSpot } from "../../src/components/v2/ClueSpot";
import { ErrandMarker } from "../../src/components/v2/ErrandMarker";
import { HousePick } from "../../src/components/v2/HousePick";

export const tutorialStage: { props: WorldStageProps | null } = { props: null };

const noop = (): void => {};

export function FakeTutorialStage(props: WorldStageProps): ReactElement {
  tutorialStage.props = props;
  useEffect(() => {
    props.onReady?.();
    // 마운트 때 한 번만 알린다(실제 WorldStage 도 런타임이 준비된 한 번)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const actId = props.errand?.actId ?? null;
  const clues = props.clues;
  return createElement(
    "div",
    { "data-world-stage-fake": "" },
    createElement("div", { className: "mf-world__input" }),
    props.errand
      ? createElement(
          "div",
          { "data-errand-layer": "" },
          ...props.errand.places.map((pl) => createElement(ErrandMarker, { key: pl.id, id: pl.id, done: pl.done, call: false, onWalk: noop })),
        )
      : null,
    props.errand
      ? createElement(
          "div",
          { "data-errand-act-layer": "" },
          actId !== null && props.errand.dock !== true ? createElement("button", { "data-errand-act": "", type: "button", onClick: () => props.errand?.onAct?.() }, "처리") : null,
        )
      : null,
    clues
      ? createElement(
          "div",
          { "data-clue-layer": "" },
          ...(clues.spotsOn && clues.house !== undefined
            ? ([1, 2, 3] as const).map((spot) => createElement(ClueSpot, { key: spot, spot, state: clues.states[spot], call: clues.actSpot === spot, onWalk: noop }))
            : []),
        )
      : null,
    props.houses ? createElement(HousePick, { ...props.houses }) : null,
    createElement(
      "div",
      { className: "mf-world__tags" },
      ...props.view.players.map((p) =>
        createElement(
          "div",
          { key: p.seat, className: "mf-world__tag", "data-seat": p.seat },
          props.pick?.seats.has(p.seat) ? createElement("button", { type: "button", "data-pick": p.seat, className: "mf-world__pick", onClick: () => props.pick?.onPick(p.seat) }, p.nickname) : null,
        ),
      ),
    ),
  );
}
