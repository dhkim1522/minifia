// 실제 소켓 프레임과 HTTP 응답 전수 누출 검사(ROLE-02): 6명 한 판(lobby → dayAnnounce)을 workerd 에서 돌리며 받은 모든 것을 모아 본다.
import { env, exports } from "cloudflare:workers";
import { runDurableObjectAlarm } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { RoomView, ServerMessage } from "../../shared/protocol";
import { collect, connect, forceDue, hello, nextFrame, send } from "./helpers";
import type { TestSocket } from "./helpers";

interface Player {
  nickname: string;
  token: string;
  sock: TestSocket;
}

interface Recorded {
  /** 이 응답을 받을 권리가 있는 사람의 토큰(없으면 비인증 응답이라 토큰이 하나도 있으면 안 된다). */
  owner: string | null;
  body: string;
}

const FORBIDDEN_KEYS = ["token", "id", "playerId", "connId", "nicknameKey", "joinSeq", "hostId"];

/** JSON 을 걸어 내려가며 (경로, 키) 를 모두 모은다. */
function keyPaths(value: unknown, path = ""): string[] {
  if (Array.isArray(value)) return value.flatMap((v) => keyPaths(v, `${path}[]`));
  if (value !== null && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) => [
      `${path}.${k}`,
      ...keyPaths(v, `${path}.${k}`),
    ]);
  }
  return [];
}

const phaseOf = (phase: string) => (m: ServerMessage) => m.t === "state" && m.view.phase === phase;

describe("6명 한 판 전수 누출 검사", () => {
  it("모든 프레임·HTTP 응답에 남의 토큰·역할·동료가 없고 역할 수는 구성표와 같다", async () => {
    const http: Recorded[] = [];
    const record = async (res: Response, owner: string | null): Promise<string> => {
      const text = await res.text();
      http.push({ owner, body: text });
      return text;
    };

    // 방 만들기와 5명 참가 — 응답은 본인 토큰만 담는다.
    const created = await exports.default.fetch("http://x/api/rooms", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nickname: "방장" }),
    });
    const createdBody = (await created.json()) as { code: string; token: string };
    http.push({ owner: createdBody.token, body: JSON.stringify(createdBody) });
    const code = createdBody.code;

    const players: Player[] = [{ nickname: "방장", token: createdBody.token, sock: await connect(code) }];
    await hello(players[0]!.sock, createdBody.token);
    for (let i = 1; i < 6; i += 1) {
      const res = await exports.default.fetch(`http://x/api/rooms/${code}/join`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nickname: `손님${i}` }),
      });
      const joined = (await res.json()) as { token: string };
      http.push({ owner: joined.token, body: JSON.stringify(joined) });
      const sock = await connect(code);
      await hello(sock, joined.token);
      players.push({ nickname: `손님${i}`, token: joined.token, sock });
    }

    // 비인증 미리보기와 오류 응답을 단계마다 모은다.
    const probe = async (withJoin: boolean): Promise<void> => {
      await record(await exports.default.fetch(`http://x/api/rooms/${code}`), null);
      // 대기실에서는 참가가 성공해 자리가 늘어나므로, 시작 뒤(409 GAME_STARTED)에만 참가 응답을 모은다.
      if (!withJoin) return;
      await record(
        await exports.default.fetch(`http://x/api/rooms/${code}/join`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ nickname: "늦은손님" }),
        }),
        null,
      );
    };
    await probe(false); // lobby

    const waitAll = async (phase: string): Promise<void> => {
      for (const p of players) await nextFrame(p.sock, phaseOf(phase));
    };
    send(players[0]!.sock, { t: "start" });
    await waitAll("assigning");
    await probe(true);

    const stub = env.ROOM.getByName(code);
    await forceDue(code, "phaseEndsAt");
    expect(await runDurableObjectAlarm(stub)).toBe(true);
    await waitAll("roleReveal");
    await probe(true);

    await forceDue(code, "phaseEndsAt");
    expect(await runDurableObjectAlarm(stub)).toBe(true);
    await waitAll("dayAnnounce");
    await probe(true);

    // ---- 검사 ----
    const allTokens = players.map((p) => p.token);

    // HTTP 응답: 비인증 응답에는 토큰이 하나도 없고, 본인 응답에는 남의 토큰이 없다.
    for (const r of http) {
      for (const t of allTokens) {
        if (t !== r.owner) expect(r.body.includes(t)).toBe(false);
      }
    }
    expect(http.filter((r) => r.owner === null).length).toBe(7);

    const finalViews: RoomView[] = [];
    for (const p of players) {
      const raws = collect(p.sock);
      expect(raws.length).toBeGreaterThan(0);
      const roles = new Set<string>();
      for (const raw of raws) {
        // 남의 토큰은 어떤 프레임에도 없다(본인 토큰도 서버는 보내지 않는다).
        for (const t of allTokens) expect(raw.includes(t)).toBe(false);
        const msg = JSON.parse(raw) as ServerMessage;
        const paths = keyPaths(msg);
        for (const path of paths) {
          const key = path.slice(path.lastIndexOf(".") + 1);
          expect(FORBIDDEN_KEYS.includes(key)).toBe(false);
          // role·allies 는 오직 view.me 안에만 있다.
          if (key === "role" || key === "allies") expect(path).toBe(`.view.me.${key}`);
        }
        if (msg.t !== "state") continue;
        for (const pl of msg.view.players) {
          expect(Object.keys(pl).sort()).toEqual(["connected", "isHost", "nickname", "seat"]);
        }
        if (msg.view.phase === "lobby" || msg.view.phase === "assigning") {
          expect(msg.view.me.role).toBeUndefined();
          expect(msg.view.me.allies).toBeUndefined();
        }
        if (msg.view.me.role !== undefined) roles.add(msg.view.me.role);
        if (msg.view.phase === "dayAnnounce") finalViews.push(msg.view);
      }
      expect(roles.size).toBeLessThanOrEqual(1);
    }

    // 구성표(6명: 마피아 2·경찰 1·의사 1·시민 2)와 동료 정보의 교차 일치.
    const lastViews = players.map((p) => {
      const states = collect(p.sock)
        .map((raw) => JSON.parse(raw) as ServerMessage)
        .filter((m): m is Extract<ServerMessage, { t: "state" }> => m.t === "state");
      return states[states.length - 1]!.view;
    });
    const counts: Record<string, number> = {};
    for (const v of lastViews) counts[v.me.role!] = (counts[v.me.role!] ?? 0) + 1;
    expect(counts).toEqual({ mafia: 2, police: 1, doctor: 1, citizen: 2 });
    const mafiaSeats = lastViews.filter((v) => v.me.role === "mafia").map((v) => v.me.seat);
    for (const v of lastViews) {
      if (v.me.role === "mafia") {
        expect(v.me.allies).toEqual(mafiaSeats.filter((s) => s !== v.me.seat));
      } else {
        expect(v.me.allies).toBeUndefined();
      }
    }
    expect(finalViews.length).toBeGreaterThan(0);
  });
});
