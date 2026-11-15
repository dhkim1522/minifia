// 21-01 트레이서: 확장판 판의 하루가 원인 → 결과 순서(역할 확인 → 저녁 → 밤 → 아침 → 토론)로 돈다(D-01·D-02·D-03·D-17, 결정 0081-2).
// 방 DO 알람이 단계를 넘기고 소켓이 받은 state 프레임의 view.phase 수열로 관찰한다 — dayAnnounce 는 확장판에서 한 번도 나타나지 않는다.
// 이 폴더는 원인 흐름을 잠가 두므로(test/worker/setup.ts) 새 흐름은 openCause() 로 그 시험 동안만 켠다. 마을 판(제품과 같은 표)은 openTown() 이다.
// 실패 출력은 한 줄이어야 해서(TAP) 단계 수열은 " → " 로 이은 문자열로 비교한다.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PhaseId, RoomView, ServerMessage } from "../../shared/protocol";
import { openCause, openTown, underCauseLock } from "../helpers/playable";
import { advanceTo, closePhase, framesOf, mark, nextFrame, seat, send, settle } from "./helpers";
import type { Seated } from "./helpers";

type State = Extract<ServerMessage, { t: "state" }>;
type Sock = Seated["host"];

/** 소켓이 from 번째 프레임부터 받은 state 의 view 들. */
const viewsOf = (sock: Sock, from: number): RoomView[] =>
  framesOf(sock)
    .slice(from)
    .filter((m): m is State => m.t === "state")
    .map((m) => m.view);

/** view.phase 수열 — 같은 값이 이어지면 하나로 줄이고, 시작(assigning) 앞의 대기실 프레임(참가 방송이 늦게 닿을 수 있다)은 뺀다. */
function chainOf(sock: Sock, from: number): string {
  const phases: PhaseId[] = [];
  for (const view of viewsOf(sock, from)) {
    if (phases.length === 0 && view.phase !== "assigning") continue;
    if (phases.at(-1) !== view.phase) phases.push(view.phase);
  }
  return phases.join(" → ");
}

/** 방장 + 연결 참가자 넷으로 시작해 assigning 프레임까지 받은 판. from 은 시작 직전 방장 소켓의 프레임 수. */
async function startedTable(): Promise<{ room: Seated; socks: Sock[]; from: number }> {
  const room = await seat(4, 0);
  const socks = [room.host, ...room.guests.map((g) => g.sock)];
  const from = mark(room.host);
  send(room.host, { t: "start" });
  for (const sock of socks) await nextFrame(sock, (m) => m.t === "state" && m.view.phase === "assigning");
  return { room, socks, from };
}

describe("원인 흐름 — 확장판 한 판의 단계 사슬 (openCause, 21-01 트레이서)", () => {
  let restoreCause: () => void = () => {};
  let restoreTown: () => void = () => {};
  beforeAll(() => {
    restoreCause = openCause();
    restoreTown = openTown();
  });
  afterAll(() => {
    restoreTown();
    restoreCause();
  });

  it("역할 확인 → 저녁(errand) → 밤으로 돌고 낮 시작 발표(dayAnnounce)는 한 번도 없다 — 첫 저녁은 1일차", async () => {
    const { room, socks, from } = await startedTable();
    await advanceTo(room.code, socks, "night");
    await settle(room.host, mark(room.host));
    expect(chainOf(room.host, from)).toBe("assigning → roleReveal → errand → night");
    const errand = viewsOf(room.host, from).find((v) => v.phase === "errand");
    expect(`day.n=${errand?.day?.n}`).toBe("day.n=1");
    const night = viewsOf(room.host, from).find((v) => v.phase === "night");
    expect(`day.n=${night?.day?.n}`).toBe("day.n=1");
  });

  it("마피아가 아무도 고르지 않은 밤(현장 없음)은 아침을 건너뛰어 곧바로 토론이고 일차는 그대로 1이다 (D-17)", async () => {
    const { room, socks, from } = await startedTable();
    await advanceTo(room.code, socks, "night");
    await closePhase(room.code);
    for (const sock of socks) await nextFrame(sock, (m) => m.t === "state" && m.view.phase !== "night");
    await settle(room.host, mark(room.host));
    expect(chainOf(room.host, from)).toBe("assigning → roleReveal → errand → night → discussion");
    const discussion = viewsOf(room.host, from).find((v) => v.phase === "discussion");
    expect(`day.n=${discussion?.day?.n}`).toBe("day.n=1");
  });
});

describe("원인 흐름 잠금 아래 — 옛 확장판 순서 보호 (21-01)", () => {
  // 꺼진 옛 확장판 경로 — 코드는 끄기만 한다(REQUIREMENTS Out of Scope '기능 코드 삭제'). 21-13: setup 이 더는 잠그지 않으므로 이 시험이 직접 잠근다(갈래 B).
  it("openCause 없이 같은 구성은 역할 확인 다음이 낮 시작 발표다", underCauseLock(async () => {
    const { room, socks, from } = await startedTable();
    await advanceTo(room.code, socks, "dayAnnounce");
    await settle(room.host, mark(room.host));
    expect(chainOf(room.host, from)).toBe("assigning → roleReveal → dayAnnounce");
  }));
});
