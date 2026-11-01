// 06-15: 대기실이 맵(WorldStage)을 그리게 되어, 로비를 거쳐 가는 client 테스트는 캔버스·런타임 대신 이 가짜를 쓴다.
// 캔버스·런타임·이름표는 worldStage.test 가 따로 본다. 가짜는 받은 props 만 기억한다.
// 쓰는 법(vi.mock 은 파일마다 있어야 한다):
//   vi.mock("../../src/components/WorldStage", async () => ({ WorldStage: (await import("../helpers/fakeWorldStage")).FakeWorldStage }));
import { createElement } from "react";
import type { ReactElement } from "react";
import type { WorldStageProps } from "../../src/components/WorldStage";

export const lastWorldStage: { props: WorldStageProps | null } = { props: null };

export function FakeWorldStage(props: WorldStageProps): ReactElement {
  lastWorldStage.props = props;
  return createElement("div", { "data-world-stage-fake": "" });
}
