// 23-06 Task 3: 키워드 누설 시험(D-06·D-20, SC7, T-23-18·T-23-20). 정답은 정답 공개(answerReveal) 전에 마피아에게 어떤 프레임·HTTP 응답·거절 모양으로도 가지 않는다.
// 무작위 키워드는 영어 별칭이 토큰 문자열과 우연히 겹칠 수 있어 흔들리므로, 시작 직후(assigning) 저장 키워드를 해리포터로 고정한 판을 쓴다.
// 검사 문자열은 단어와 그 판의 별칭 둘이다: "해리포터"·"Harry Potter"·"해포".
import { exports } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GENRES } from "../../shared/game/keywords";
import type { ServerMessage } from "../../shared/protocol";
import { openKeyword } from "../helpers/keyword";
import { actorsOf, advanceTo, editRoom, lastViewOf, mark, nextFrame, seat, send, settle, storedRoom, summary, verdictAll } from "./helpers";
import type { Actor, Seated, StoredRoom, TestSocket } from "./helpers";

let restore: () => void = () => {};
beforeEach(() => {
  restore = openKeyword();
});
afterEach(() => restore());

const WORD = "해리포터";
const SECRETS = [WORD, "Harry Potter", "해포"] as const;
/** 서버 전용 이름: 어떤 프레임의 어떤 경로에도 키로 없다. RoomState.keyword 는 view 키 day.keyword·me.keyword 와 이름이 같아 넣을 수 없고 값 검사(SECRETS)로 지킨다(RESEARCH P2). */
const SERVER_ONLY_NAMES = ["keywordProbed", "answerSubmits", "answerDraft", "keywordAnswers", "keywordPresentationIndex"] as const;

const socksOf = (room: Seated): TestSocket[] => [room.host, ...room.guests.map((g) => g.sock)];
const answerOf = (sock: TestSocket, text: string, final: boolean): void => send(sock, { t: "answer", text, final });
const frameText = (sock: TestSocket): string => sock.frames.join("\n");
const parse = (raw: string): ServerMessage => JSON.parse(raw) as ServerMessage;
const statesOf = (sock: TestSocket, from = 0): Array<Extract<ServerMessage, { t: "state" }>> =>
  sock.frames.slice(from).map(parse).filter((m): m is Extract<ServerMessage, { t: "state" }> => m.t === "state");

/** 시작 → assigning 직후 저장 키워드를 고정 → keyword 단계 첫 순간. testRole 을 주면 테스트 방(방장 직업 고정)이다. */
async function fixedKeywordGame(options: { hostRole?: "mafia" | "citizen" } = {}): Promise<{ room: Seated; socks: TestSocket[]; startMark: number[] }> {
  const room = await seat(3, 0, options.hostRole ? { testMode: true } : {});
  const socks = socksOf(room);
  for (const sock of socks) await settle(sock, mark(sock));
  if (options.hostRole) {
    send(room.host, { t: "testRole", role: options.hostRole });
    await settle(room.host, mark(room.host));
  }
  const startMark = socks.map((s) => mark(s));
  send(room.host, { t: "start" });
  for (const sock of socks) await nextFrame(sock, (m) => m.t === "state" && m.view.phase === "assigning");
  await editRoom(room.code, (r) => ({ ...r, keyword: { genre: GENRES[0]!.id, word: WORD } }));
  await advanceTo(room.code, socks, "keyword");
  for (const sock of socks) await settle(sock, mark(sock));
  return { room, socks, startMark };
}

const previewText = async (code: string): Promise<string> => {
  const res = await exports.default.fetch(`http://x/api/rooms/${code}`);
  expect(res.status).toBe(200);
  return res.text();
};

const rolesOf = (room: Seated): { mafia: Actor; citizen: Actor; all: Actor[] } => {
  const all = actorsOf(room);
  return { mafia: all.find((a) => a.role === "mafia")!, citizen: all.find((a) => a.role === "citizen")!, all };
};

describe("① 마피아 소켓의 어떤 프레임에도 정답이 없다 — 첫날 키워드부터 정답 공개 직전까지", () => {
  it("마피아가 제시어를 적은 판에서 자기 입력의 접수 응답 외에는 공개 전까지 정답이 노출되지 않는다", async () => {
    const { room, socks } = await fixedKeywordGame();
    const { mafia, citizen, all } = rolesOf(room);
    const stored = (await storedRoom(room.code)) as StoredRoom & { keyword?: { word: string } };
    expect(stored.keyword?.word).toBe(WORD);

    // ② 비인증 미리보기: keyword 단계에서도 단어가 없다
    for (const s of SECRETS) expect(await previewText(room.code), `preview keyword ${s}`).not.toContain(s);

    answerOf(mafia.sock, "마법사 같은 글", false);
    await settle(mafia.sock, mark(mafia.sock));
    const ownSubmission = "Harry Potter";
    answerOf(mafia.sock, ownSubmission, true);
    await nextFrame(mafia.sock, (m) => m.t === "state" && m.view.me.answer?.final === true);
    answerOf(citizen.sock, "마법", true);
    await settle(citizen.sock, mark(citizen.sock));

    // 시민의 keyword 단계 프레임에는 단어가 있다 — 검사가 살아 있음을 확인(me.keyword)
    expect(frameText(citizen.sock)).toContain(WORD);
    for (const a of all.filter((x) => x.role !== "mafia")) expect(lastViewOf(a.sock).me.keyword, `seat ${a.seat}`).toBe(WORD);

    await advanceTo(room.code, socks, "dayAnnounce");
    const published = (await storedRoom(room.code)) as StoredRoom & { keywordAnswers?: Array<{ seat: number; text: string | null }> };
    expect(published.keywordAnswers?.[0]?.seat).toBe(citizen.seat);
    expect(published.keywordAnswers?.find((row) => row.seat === mafia.seat)?.text).toBeNull();
    await advanceTo(room.code, socks, "discussion");
    await advanceTo(room.code, socks, "verdict");
    for (const sock of socks) await settle(sock, mark(sock));
    for (const s of SECRETS) expect(await previewText(room.code), `preview verdict ${s}`).not.toContain(s);

    // 정답 공개 직전까지 모든 마피아 소켓의 모든 프레임 원문
    const pre = socks.map((s) => mark(s));
    for (const a of all.filter((x) => x.role === "mafia")) {
      const text = a.sock.frames.slice(0, pre[socks.indexOf(a.sock)]!).map(parse).map((frame) => {
        if (frame.t !== "state" || frame.view.phase !== "keyword" || a.sock !== mafia.sock || frame.view.me.answer?.text !== ownSubmission) return JSON.stringify(frame);
        expect(frame.view.me.answer).toEqual({ text: ownSubmission, final: true });
        return JSON.stringify({ ...frame, view: { ...frame.view, me: { ...frame.view.me, answer: undefined } } });
      }).join("\n");
      for (const s of SECRETS) expect(text, `mafia seat ${a.seat} before reveal: ${s}`).not.toContain(s);
    }
    // 서버 전용 이름은 모든 소켓의 모든 프레임에 키로 없다
    for (const sock of socks) {
      const text = frameText(sock);
      for (const name of SERVER_ONLY_NAMES) expect(text, name).not.toContain(`"${name}"`);
    }

    // 정답 공개: 이 프레임부터 모두에게 같은 값 — 마피아에게 처음 닿는다
    const rejectAll = Object.fromEntries(all.map((a) => [a.seat, false])) as Record<number, boolean>;
    await verdictAll(room.code, all, rejectAll);
    for (const sock of socks) await settle(sock, mark(sock));
    expect((await storedRoom(room.code)).phase).toBe("answerReveal");
    expect(lastViewOf(mafia.sock).day?.keyword?.answer).toBe(WORD);
    expect(lastViewOf(citizen.sock).day?.keyword?.answer).toBe(WORD);
  }, 90_000);
});

describe("③④ keyword 단계 view 모양: day.keyword 열은 모두 같고, me 키 차이는 keyword(와 역할 구조 키 allies)뿐이다", () => {
  it("모든 소켓의 day.keyword 키 집합이 같다(genre) — 마피아 me 에는 keyword 키 자체가 없다", async () => {
    const { room, socks } = await fixedKeywordGame();
    const { mafia, citizen, all } = rolesOf(room);
    const dayKeys = socks.map((s) => Object.keys(lastViewOf(s).day?.keyword ?? {}).sort().join(","));
    expect(new Set(dayKeys)).toEqual(new Set(["genre"]));
    expect(new Set(socks.map((s) => JSON.stringify(lastViewOf(s).day?.keyword))).size).toBe(1);

    // 같은 초안 상태(둘 다 초안 없음)에서 me 키 집합의 차이 — 시민 편이 keyword 를 더 가진다. 마피아 구조 키 allies(동료 좌석)·records(암살일지)는 이 계획 이전부터 있던 역할별 키다.
    // 키워드·답과 관련된 차이는 keyword 한 키뿐이고 answer 는 양쪽 모두 없다(초안 없음).
    const meKeys = (a: Actor): Set<string> => new Set(Object.keys(lastViewOf(a.sock).me));
    const mine = meKeys(mafia);
    const theirs = meKeys(citizen);
    const diff = [...new Set([...mine, ...theirs])].filter((k) => mine.has(k) !== theirs.has(k)).sort();
    expect(diff).toContain("keyword");
    expect(diff.filter((k) => !["allies", "records"].includes(k))).toEqual(["keyword"]);
    expect(mine.has("answer") || theirs.has("answer")).toBe(false);
    expect(mine.has("keyword")).toBe(false);
    expect(theirs.has("keyword")).toBe(true);
    // 경찰·시민 사이에도 keyword 는 둘 다 가진다(마피아만 없다)
    for (const a of all.filter((x) => x.role !== "mafia")) expect(Object.hasOwn(lastViewOf(a.sock).me, "keyword")).toBe(true);
  }, 60_000);
});

describe("⑤ 제시어를 모르는 작성자의 비공개 초안·확정 접수", () => {
  it("같은 단서를 넣은 마피아는 제시어 일치 여부와 관계없이 같은 응답을 받고 다른 소켓은 받지 않는다", async () => {
    const sent = "해포";
    for (const word of [WORD, "타이타닉"]) {
      const { room, socks } = await fixedKeywordGame();
      const { mafia } = rolesOf(room);
      await editRoom(room.code, (r) => ({ ...r, keyword: { genre: GENRES[0]!.id, word } }));
      for (const final of [false, true]) {
        const marks = socks.map(mark);
        answerOf(mafia.sock, sent, final);
        const frames = await settle(mafia.sock, marks[socks.indexOf(mafia.sock)]!);
        expect(summary(frames)).toBe("[state:keyword]");
        expect(lastViewOf(mafia.sock).me.answer).toEqual({ text: sent, final });
        for (const other of socks.filter((s) => s !== mafia.sock)) {
          expect(summary(await settle(other, marks[socks.indexOf(other)]!))).toBe("[]");
        }
      }
      expect(((await storedRoom(room.code)) as StoredRoom & { keywordProbed?: true }).keywordProbed).toBeUndefined();
    }
  }, 60_000);
});

describe("⑥ 메타모픽: 방장 직업만 다른 두 판(같은 고정 키워드)에서 keyword~dayAnnounce 의 day.keyword 열이 같다", () => {
  it("방장이 마피아인 판과 시민인 판의 방장 소켓이 받은 day.keyword 열(연속 중복 제거)이 같다", async () => {
    const columnOf = async (hostRole: "mafia" | "citizen"): Promise<string[]> => {
      const { room, socks, startMark } = await fixedKeywordGame({ hostRole });
      expect(lastViewOf(room.host).me.role).toBe(hostRole);
      await advanceTo(room.code, socks, "dayAnnounce");
      await settle(room.host, mark(room.host));
      const states = statesOf(room.host, startMark[0]!);
      const col = states.filter((m) => m.view.day !== undefined).map((m) => JSON.stringify(m.view.day?.keyword ?? null));
      return col.filter((v, i) => i === 0 || v !== col[i - 1]);
    };
    const asMafia = await columnOf("mafia");
    const asCitizen = await columnOf("citizen");
    expect(asMafia.length).toBeGreaterThan(1);
    expect(asMafia).toEqual(asCitizen);
    // 단어가 열에 없다
    for (const s of SECRETS) expect(asMafia.join("")).not.toContain(s);
  }, 90_000);
});
