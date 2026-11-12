// 튜토리얼 단계 누설 시험(17-12, DEPLOY-05·TUT-05, 결정 0021·0080-11, 위협 T-17-28): 역할이 모두 다른 사람 여섯이 켜고 시작해 몇 명이 끝났음을 보내고 나머지도 보내 assigning 까지 가는 동안
// 모든 소켓이 받은 실제 프레임을 모아 ① 서버 전용 tutorialPassed 가 어떤 깊이에도 없고 ② 새 공개 경로가 허용 목록 안이며 ③ 역할 낱말 문자열이 허용 경로 밖에 없고
// ④ tutorial 단계 view 가 역할이 다른 모든 소켓에서 같음(본인 값 me.seat·me.isHost·me.tutorialDone 만 뺀다)을 단언한다. 허용 목록·검사 도우미는 leak.test.ts 와 같은 모양이다(테스트 파일끼리 가져오지 않는다).
import { describe, expect, it } from "vitest";
import { rulesetOf } from "../../shared/game/ruleset";
import type { RoomView, ServerMessage } from "../../shared/protocol";
import { framesOf, lastViewOf, mark, nextFrame, seat, send, settle, storedRoom } from "./helpers";
import type { TestSocket } from "./helpers";
const GAME_RULES = rulesetOf("extended");

type StateMsg = Extract<ServerMessage, { t: "state" }>;

/** JSON 을 걸어 내려가며 (경로, 키) 를 모두 모은다(leak.test.ts keyPaths 와 같다). */
function keyPaths(value: unknown, path = ""): string[] {
  if (Array.isArray(value)) return value.flatMap((v) => keyPaths(v, `${path}[]`));
  if (value !== null && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) => [`${path}.${k}`, ...keyPaths(v, `${path}.${k}`)]);
  }
  return [];
}

/** JSON 을 걸어 내려가며 (경로, 문자열 값) 을 모은다. 배열 칸은 [] 로 접는다(leak.test.ts stringPaths 와 같다). */
function stringPaths(value: unknown, path = ""): Array<[string, string]> {
  if (Array.isArray(value)) return value.flatMap((v) => stringPaths(v, `${path}[]`));
  if (value !== null && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) => stringPaths(v, `${path}.${k}`));
  }
  return typeof value === "string" ? [[path, value]] : [];
}

const ROLE_WORDS = new Set(["mafia", "police", "doctor", "citizen", "none"]);
/** 살아 있는 소켓이 역할 값 문자열을 받아도 되는 경로(leak.test.ts ROLE_PATHS_ALIVE 와 같다). tutorial 단계에는 아무것도 해당하지 않아야 한다. */
const ROLE_PATHS_ALIVE = [".view.me.role", ".view.day.roles[]", ".view.me.chat", ...(GAME_RULES.badge ? [".view.players[].badge"] : []), ".view.players[].look"];
/** tutorial 의 새 공개 경로(leak.test.ts TUTORIAL_PATHS 와 같다): view.tutorial 은 tutorial 단계의 모든 소켓, me.tutorialDone 은 보낸 본인만. */
const TUTORIAL_PATHS: ReadonlySet<string> = new Set([".view.tutorial", ".view.tutorial.done", ".view.tutorial.total", ".view.tutorial.endsAt", ".view.me.tutorialDone"]);
const TUTORIAL_PREFIXES = [".view.tutorial", ".view.me.tutorialDone"];
const underTutorial = (path: string): boolean => TUTORIAL_PREFIXES.some((p) => path === p || path.startsWith(`${p}.`) || path.startsWith(`${p}[]`));

const stateFrames = (sock: TestSocket, from: number): StateMsg[] => framesOf(sock).slice(from).filter((m): m is StateMsg => m.t === "state");
const inPhase = (phase: string) => (m: ServerMessage): boolean => m.t === "state" && m.view.phase === phase;

/** 본인 값 셋(me.seat·me.isHost·me.tutorialDone)과 보낸 시각 serverNow(소켓마다 방송 시각이 다르다)를 뺀 view 의 JSON. */
function withoutOwn(view: RoomView): string {
  const { seat: _seat, isHost: _isHost, tutorialDone: _done, ...me } = view.me;
  return JSON.stringify({ ...view, serverNow: 0, me });
}

describe("tutorial 단계 누설 (DEPLOY-05, TUT-05, T-17-28)", () => {
  it("역할이 모두 다른 여섯이 시작부터 assigning 까지 받은 모든 프레임에서 tutorialPassed 가 없고 새 경로는 허용 목록 안이며 역할 낱말은 허용 경로 밖에 없다", async () => {
    const r = await seat(5, 0);
    const sockets = [r.host, ...r.guests.map((g) => g.sock)];
    for (const s of sockets) await settle(s, 0);
    const starts = sockets.map((s) => mark(s));
    send(r.host, { t: "start", tutorial: true });
    for (const s of sockets) await nextFrame(s, inPhase("tutorial"));

    // 역할 구성에 마피아·경찰·의사·시민이 모두 있다(시점이 다른 사람이 실제로 있다)
    const stored = await storedRoom(r.code);
    expect(new Set(stored.players.map((p) => p.role))).toEqual(new Set(["mafia", "police", "doctor", "citizen"]));

    // 몇 명이 먼저 끝났음을 보내고, 나머지도 보내 assigning 까지
    for (const g of r.guests.slice(0, 2)) send(g.sock, { t: "tutorialDone" });
    for (const s of sockets) await nextFrame(s, (m) => m.t === "state" && m.view.tutorial?.done === 2);
    for (const s of [r.host, ...r.guests.slice(2).map((g) => g.sock)]) send(s, { t: "tutorialDone" });
    for (const s of sockets) await nextFrame(s, inPhase("assigning"));
    for (const s of sockets) await settle(s, mark(s));

    const seenTutorialPaths = new Set<string>();
    let tutorialFrames = 0;
    for (const [i, s] of sockets.entries()) {
      const frames = framesOf(s).slice(starts[i]!);
      // ① 서버 전용 이름은 원문에도 키로도 없다
      for (const raw of s.frames.slice(starts[i]!)) expect(raw.includes("tutorialPassed")).toBe(false);
      for (const msg of frames) {
        for (const path of keyPaths(msg)) expect(path.slice(path.lastIndexOf(".") + 1)).not.toBe("tutorialPassed");
        // ③ 역할 낱말 문자열은 허용 경로 밖에 없다
        for (const [path, value] of stringPaths(msg)) {
          if (ROLE_WORDS.has(value)) expect(ROLE_PATHS_ALIVE.includes(path), `${path}=${value}`).toBe(true);
        }
      }
      for (const m of stateFrames(s, starts[i]!)) {
        const paths = keyPaths(m).filter(underTutorial);
        if (m.view.phase === "tutorial") {
          // ② tutorial 단계 프레임의 새 경로는 허용 목록 안이다
          tutorialFrames += 1;
          for (const path of paths) {
            expect(TUTORIAL_PATHS.has(path), path).toBe(true);
            seenTutorialPaths.add(path);
          }
          // tutorial 단계에는 역할 값이 어디에도 없다
          expect("role" in m.view.me).toBe(false);
          expect("allies" in m.view.me).toBe(false);
          expect(m.view.players.some((p) => "role" in p)).toBe(false);
        } else {
          // 다른 단계 프레임에는 두 키가 없다
          expect(paths).toEqual([]);
        }
      }
    }
    expect(tutorialFrames).toBeGreaterThanOrEqual(sockets.length);
    // 검사가 비어 있지 않다: 숫자 셋과 본인 값이 실제로 프레임에 실렸다
    expect([...seenTutorialPaths].sort()).toEqual([...TUTORIAL_PATHS].sort());
  });

  it("같은 순간 tutorial 단계 view 는 역할이 다른 모든 소켓에서 me.seat·me.isHost·me.tutorialDone 을 뺀 값이 같다", async () => {
    const r = await seat(5, 0);
    const sockets = [r.host, ...r.guests.map((g) => g.sock)];
    for (const s of sockets) await settle(s, 0);
    send(r.host, { t: "start", tutorial: true });
    for (const s of sockets) await nextFrame(s, inPhase("tutorial"));
    const stored = await storedRoom(r.code);
    expect(new Set(stored.players.map((p) => p.role)).size).toBe(4);

    // 두 명이 끝냈을 때의 모두의 마지막 view(보낸 둘만 본인 값이 다르다)
    for (const g of r.guests.slice(0, 2)) send(g.sock, { t: "tutorialDone" });
    for (const s of sockets) await nextFrame(s, (m) => m.t === "state" && m.view.tutorial?.done === 2);
    for (const s of sockets) await settle(s, mark(s));

    const views = sockets.map((s) => lastViewOf(s));
    for (const v of views) expect(v.phase).toBe("tutorial");
    const [first, ...rest] = views.map(withoutOwn);
    expect(first).toContain('"tutorial"'); // 비교 대상이 비어 있지 않다
    for (const other of rest) expect(other).toBe(first);
    // 본인 값은 소켓마다 다르다(비교가 그 셋을 뺐다는 것이 의미 있다)
    expect(new Set(views.map((v) => v.me.seat)).size).toBe(views.length);
    expect(views.filter((v) => v.me.tutorialDone === true)).toHaveLength(2);
  });
});
