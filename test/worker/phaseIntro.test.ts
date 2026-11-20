import { afterEach, beforeEach, expect, it } from "vitest";
import { PHASE_INTRO_MS, PHASE_INTRO_SWITCH } from "../../shared/game/phases";
import { openKeyword } from "../helpers/keyword";
import { advanceTo, chatSend, connect, hello, lastViewOf, nextFrame, pause, seat, send } from "./helpers";

let restoreKeyword: () => void;
beforeEach(() => {
  PHASE_INTRO_SWITCH.on = true;
  restoreKeyword = openKeyword();
});
afterEach(() => {
  PHASE_INTRO_SWITCH.on = false;
  restoreKeyword();
});

it("모든 접속과 재접속이 같은 토론 열림 시각을 받고 그 뒤 채팅할 수 있다", async () => {
  const room = await seat(3, 0, { testMode: true });
  const sockets = [room.host, ...room.guests.map((guest) => guest.sock)];
  send(room.host, { t: "start" });
  await Promise.all(sockets.map((sock) => nextFrame(sock, (message) => message.t === "state" && message.view.phase === "assigning")));
  await advanceTo(room.code, sockets, "discussion");
  const views = sockets.map(lastViewOf);
  const openAt = views[0]!.phaseStartsAt!;
  expect(typeof openAt).toBe("number");
  expect(views.every((view) => view.phaseStartsAt === openAt && view.phaseEndsAt === openAt + view.phaseDurationMs!)).toBe(true);
  expect(views[0]!.serverNow).toBeLessThan(openAt);
  expect(openAt - views[0]!.serverNow).toBeLessThanOrEqual(PHASE_INTRO_MS);

  chatSend(room.host, "조금 일찍 보낸 채팅");
  expect(await nextFrame(room.host, (message) => message.t === "chatReject")).toEqual({ t: "chatReject", why: "phase" });
  send(room.host, { t: "endDiscussion", on: true });
  expect(await nextFrame(room.host, (message) => message.t === "error")).toEqual({ t: "error", code: "WRONG_PHASE" });

  const guest = room.guests[0]!;
  const reconnected = await connect(room.code);
  const opening = await hello(reconnected, guest.token);
  expect(opening.view.phaseStartsAt).toBe(openAt);
  expect(opening.view.phaseEndsAt).toBe(views[0]!.phaseEndsAt);

  await pause(Math.max(0, openAt - Date.now()) + 20);
  chatSend(room.host, "토론이 열리고 보낸 채팅");
  const chat = await nextFrame(reconnected, (message) => message.t === "chat");
  expect(chat).toMatchObject({ text: "토론이 열리고 보낸 채팅" });
  expect(lastViewOf(room.host).me.endDiscussion).toBeUndefined();
});
