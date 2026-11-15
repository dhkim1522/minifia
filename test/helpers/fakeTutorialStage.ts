// 17-04·21-12: 첫 사건 화면 시험용 가짜 WorldStage. 받은 props 를 기억하고, 마운트 때 onReady 를 부르며,
// 허용 목록 시험이 보는 층(입력면·등불 층·현장 지점 층·[처리]/[켜기]/[살펴보기] 층·이름표 층 + 지목 버튼)만 최소 DOM 으로 그린다. 실제 구조(WorldStage.tsx)와 같은 형제 관계다.
// 21-12: 심부름 타일·[켜기] 알약·현장 지점 표지·[살펴보기] 알약은 실제 부품(ErrandMarker·ErrandAct·ClueSpot)으로 그린다 — 실제 층이 하는 일(깜빡임 data-call·글·접근성 이름)만 흉내 낸다. 위치 투영은 없다.
// 쓰는 법(vi.mock 은 파일마다 있어야 한다):
//   vi.mock("../../src/components/WorldStage", async () => ({ WorldStage: (await import("../helpers/fakeTutorialStage")).FakeTutorialStage }));
import { createElement, useEffect } from "react";
import type { ReactElement } from "react";
import type { WorldStageProps } from "../../src/components/WorldStage";
import { ErrandAct } from "../../src/components/v2/ErrandAct";
import { ErrandMarker } from "../../src/components/v2/ErrandMarker";
import { ClueSpot } from "../../src/components/v2/ClueSpot";
import { INSPECT_ACT_LOOK, inspectLabel } from "../../src/game/sceneText";
import { PLACE_NAME } from "../../src/game/placeText";

export const tutorialStage: { props: WorldStageProps | null } = { props: null };

export function FakeTutorialStage(props: WorldStageProps): ReactElement {
  tutorialStage.props = props;
  useEffect(() => {
    props.onReady?.();
    // 마운트 때 한 번만 알린다(실제 WorldStage 도 런타임이 준비된 한 번)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const errand = props.errand;
  const clues = props.clues;
  const look = errand?.actLook;
  return createElement(
    "div",
    { "data-world-stage-fake": "" },
    createElement("div", { className: "mf-world__input" }),
    errand
      ? createElement(
          "div",
          { "data-errand-layer": "" },
          ...errand.places.map((pl) =>
            createElement(ErrandMarker, {
              key: pl.id,
              id: pl.id,
              done: pl.done,
              call: errand.callPlaces !== undefined ? errand.callPlaces.includes(pl.id) : errand.callPlace && errand.nextId === pl.id,
              onWalk: () => errand.onWalk?.(pl.id),
            }),
          ),
        )
      : null,
    errand
      ? createElement(
          "div",
          { "data-errand-act-layer": "" },
          errand.actId !== null
            ? createElement(ErrandAct, {
                id: errand.actId,
                call: false,
                onPress: (hold: boolean) => errand.onAct?.(hold),
                ...(look === undefined ? {} : { label: look.label, icon: look.icon, aria: `${PLACE_NAME[errand.actId]}에서 ${look.verb}` }),
              })
            : null,
        )
      : null,
    clues
      ? createElement(
          "div",
          { "data-clue-layer": "" },
          ...clues.spots.map((sp) =>
            createElement(ClueSpot, {
              key: sp.id,
              id: sp.id,
              state: sp.state,
              ...(sp.why !== undefined ? { why: sp.why } : {}),
              call: clues.callSpots?.includes(sp.id) === true,
              onWalk: () => {},
            }),
          ),
        )
      : null,
    clues
      ? createElement(
          "div",
          { "data-errand-act-layer": "" },
          clues.actId !== null
            ? createElement(ErrandAct, { call: false, onPress: () => clues.onAct?.(), label: INSPECT_ACT_LOOK.label, icon: INSPECT_ACT_LOOK.icon, aria: inspectLabel(clues.actId) })
            : null,
        )
      : null,
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
