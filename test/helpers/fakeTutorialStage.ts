// 24-07: 튜토리얼 화면 시험용 가짜 WorldStage(옛 fakeTutorialStage 를 새 WorldStage props 에 맞춰 되살림). 받은 props 를 기억하고, 마운트 때 onReady 를 부르며,
// 허용 목록 시험이 보는 층(입력면·이름표 층 + 지목 버튼)만 최소 DOM 으로 그린다. 실제 구조(WorldStage.tsx)와 같은 형제 관계다 — 위치 투영은 없다.
// 이름표 지목 버튼은 실제처럼 data-pick 과 pick.attr(예 data-suspect-tag)을 달고, disabled 면 aria-disabled 이며 누르면 onPick 을 부르지 않는다.
// 쓰는 법(vi.mock 은 파일마다 있어야 한다):
//   vi.mock("../../src/components/WorldStage", async () => ({ WorldStage: (await import("../helpers/fakeTutorialStage")).FakeTutorialStage }));
import { createElement, useEffect } from "react";
import type { ReactElement } from "react";
import type { WorldStageProps } from "../../src/components/WorldStage";

/** 마지막으로 받은 props — pick·tagProps·stageInsets·scene·view 등을 시험이 읽는다 */
export const tutorialStage: { props: WorldStageProps | null } = { props: null };

export function FakeTutorialStage(props: WorldStageProps): ReactElement {
  tutorialStage.props = props;
  useEffect(() => {
    props.onReady?.();
    // 마운트 때 한 번만 알린다(실제 WorldStage 도 런타임이 준비된 한 번)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const pick = props.pick;
  return createElement(
    "div",
    { "data-world-stage-fake": "" },
    createElement("div", { className: "mf-world__input" }),
    createElement(
      "div",
      { className: "mf-world__tags", ...(pick !== undefined ? { role: "group", "aria-label": pick.group } : {}) },
      ...props.view.players.map((p) =>
        createElement(
          "div",
          { key: p.seat, className: "mf-world__tag", "data-seat": p.seat },
          pick?.seats.has(p.seat)
            ? createElement(
                "button",
                {
                  type: "button",
                  "data-pick": p.seat,
                  ...(pick.attr !== undefined ? { [pick.attr]: p.seat } : {}),
                  "aria-label": pick.label(p.nickname),
                  "aria-pressed": pick.mine === p.seat ? "true" : "false",
                  ...(pick.disabled === true ? { "aria-disabled": "true" } : {}),
                  className: "mf-world__pick",
                  onClick: () => {
                    if (pick.disabled === true) return;
                    pick.onPick(p.seat);
                  },
                },
                p.nickname,
              )
            : null,
        ),
      ),
    ),
  );
}
