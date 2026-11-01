// 07-14: 채팅 전송 길과 지운 식별자의 정적 가드 (CHAT-02·03·06, T-07-39).
// "무차별 전송 길이 다시 생기지 않는다" 를 소스 문자열로 고정한다. 동작 시험이 아니라 구조 회귀 시험이다(scripts/deploy-target.test.mjs 와 같은 방식).
// 주석(// 줄·/* */ 블록)은 지우고 본다: 지운 이름을 설명하는 주석은 허용하고, 코드에 남은 이름만 잡는다.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const read = (rel: string): string => readFileSync(`${ROOT}${rel}`, "utf8");

/**
 * 문자열·템플릿 안의 // 는 남기고 주석만 지운다. 줄 수는 유지한다(오류 보고가 줄 번호를 말할 수 있게).
 * ' 와 " 는 줄 끝에서 닫힌 것으로 본다(JSX 본문의 아포스트로피가 뒤 코드를 삼키지 않게).
 */
export function stripComments(src: string): string {
  let out = "";
  let i = 0;
  let quote: string | null = null;
  while (i < src.length) {
    const c = src[i]!;
    const next = src[i + 1];
    if (quote !== null) {
      out += c;
      if (c === "\\") {
        out += next ?? "";
        i += 2;
        continue;
      }
      if (c === quote || (c === "\n" && quote !== "`")) quote = null;
      i += 1;
      continue;
    }
    if (c === "/" && next === "/") {
      while (i < src.length && src[i] !== "\n") i += 1;
      continue;
    }
    if (c === "/" && next === "*") {
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) {
        if (src[i] === "\n") out += "\n";
        i += 1;
      }
      i += 2;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") quote = c;
    out += c;
    i += 1;
  }
  return out;
}

/** 주석을 지운 코드에서 단어 경계로 맞는 이름을 '파일:이름' 으로 모아 돌려준다. 비어 있어야 통과다. */
export function foundIdentifiers(files: ReadonlyArray<{ path: string; src: string }>, names: readonly string[]): string[] {
  const hits: string[] = [];
  for (const f of files) {
    const code = stripComments(f.src);
    for (const name of names) if (new RegExp(`\\b${name}\\b`).test(code)) hits.push(`${f.path}:${name}`);
  }
  return hits;
}

/** 주석을 지운 코드의 줄 가운데 re 에 맞는데 must 를 담지 않은 줄(앞뒤 공백 제거)을 돌려준다. */
export function linesMissing(code: string, re: RegExp, must: string): string[] {
  return code
    .split("\n")
    .filter((line) => re.test(line) && !line.includes(must))
    .map((line) => line.trim());
}

/** 지운 식별자(07-11·07-12 가 서버·와이어·화면에서 지웠다). 이름이 다시 코드에 나타나면 옛 길이 되살아난 것이다. */
export const REMOVED_IDENTIFIERS = [
  "QUICK_TEMPLATES",
  "selectClaim",
  "EMOJI_IDS",
  "TEMPLATE_IDS",
  "nightChatRecipientIds",
  "ClaimPanel",
  "TurnPanel",
  "QuickMessageSheet",
  "EmojiTraySheet",
  "DefenseChips",
  "DiscussionControls",
  "MessageLog",
  "ChatHistorySheet",
  "useSendLock",
  "seatFloats",
  "messageText",
  "claimLinesOf",
] as const;

/** 단계를 가리지 않고 모든 소켓에 이벤트를 흘리던 옛 전송 함수 이름들. */
export const INDISCRIMINATE_SENDERS = ["broadcastEvent", "broadcastAll", "sendToAll", "sendAll"] as const;

describe("가드 도우미 자체 — 일부러 틀린 사본에서는 실패한다", () => {
  it("stripComments: // 줄과 /* */ 블록은 지우고 문자열 안의 // 는 남기며 줄 수를 지킨다", () => {
    const src = ['const a = "http://x"; // QUICK_TEMPLATES', "/* ClaimPanel", "   TurnPanel */ const b = 1;", "const c = `//keep`;"].join("\n");
    const code = stripComments(src);
    expect(code.includes("QUICK_TEMPLATES")).toBe(false);
    expect(code.includes("ClaimPanel") || code.includes("TurnPanel")).toBe(false);
    expect(code.includes('"http://x"')).toBe(true);
    expect(code.includes("`//keep`")).toBe(true);
    expect(code.split("\n").length).toBe(src.split("\n").length);
  });

  it("foundIdentifiers: 코드에 남은 지운 이름은 잡고 주석 속 이름과 이름의 일부는 잡지 않는다", () => {
    const bad = [{ path: "x.ts", src: "export const QUICK_TEMPLATES = [];" }];
    const commentOnly = [{ path: "y.ts", src: "// QUICK_TEMPLATES 는 지웠다\nconst ok = 1;" }];
    const partial = [{ path: "z.ts", src: "const MyMessageLogger = 1; const messageTextual = 2;" }];
    expect(foundIdentifiers(bad, REMOVED_IDENTIFIERS).join(",")).toBe("x.ts:QUICK_TEMPLATES");
    expect(foundIdentifiers(commentOnly, REMOVED_IDENTIFIERS).length).toBe(0);
    expect(foundIdentifiers(partial, REMOVED_IDENTIFIERS).length).toBe(0);
  });

  it("linesMissing: deliver 를 거치지 않고 chat 프레임을 만드는 틀린 사본은 잡는다", () => {
    const wrong = 'this.sendTo(ws, { t: "chat", ...toWire(record) });\nthis.deliver(ids, { t: "chat", seq: 1 });';
    expect(linesMissing(wrong, /t:\s*"(chat|typing)"/, "this.deliver(").join("|")).toBe('this.sendTo(ws, { t: "chat", ...toWire(record) });');
  });
});

describe("worker/room.ts 전송 길 (T-07-39, 결정 0002·0021)", () => {
  const code = stripComments(read("worker/room.ts"));

  it("소켓으로 쓰는 곳은 sendTo 안의 ws.send 한 곳뿐이다", () => {
    expect((code.match(/\.send\(/g) ?? []).length).toBe(1);
    const at = code.indexOf("private sendTo(");
    expect(at).toBeGreaterThan(0);
    expect(code.slice(0, at).includes(".send(")).toBe(false);
    expect(code.slice(at).includes("ws.send(")).toBe(true);
  });

  it("무차별 전송 함수 이름이 없다", () => {
    expect(foundIdentifiers([{ path: "worker/room.ts", src: code }], INDISCRIMINATE_SENDERS).join(",")).toBe("");
  });

  it('t: "chat"·t: "typing" 프레임을 만드는 줄은 모두 this.deliver( 를 거친다', () => {
    const made = code.split("\n").filter((line) => /t:\s*"(chat|typing)"/.test(line));
    expect(made.length).toBeGreaterThanOrEqual(2); // 검사가 아무것도 못 보는 일이 없게
    expect(linesMissing(code, /t:\s*"(chat|typing)"/, "this.deliver(").join("|")).toBe("");
  });

  it('복원 chatLog 프레임은 hello 의 sendTo 로만 나간다 (deliver 로 흘리지 않는다)', () => {
    const made = code.split("\n").filter((line) => /t:\s*"chatLog"/.test(line));
    expect(made.length).toBe(1);
    expect(linesMissing(code, /t:\s*"chatLog"/, "this.sendTo(").join("|")).toBe("");
    const helloAt = code.indexOf("private async handleHello(");
    const nextAt = code.indexOf("private async handleDisconnect(");
    expect(helloAt).toBeGreaterThan(0);
    expect(code.slice(helloAt, nextAt).includes('t: "chatLog"')).toBe(true);
  });
});

describe("지운 식별자 (ROADMAP 계획 메모: 무차별 broadcastEvent 는 지운다)", () => {
  const tracked = execFileSync("git", ["ls-files", "src", "shared", "worker"], { cwd: ROOT, encoding: "utf8" })
    .split("\n")
    .filter((p) => /\.tsx?$/.test(p));

  it("src·shared·worker 의 .ts·.tsx 주석 밖 코드에 지운 식별자가 없다", () => {
    expect(tracked.length).toBeGreaterThan(20);
    const files = tracked.map((path) => ({ path, src: read(path) }));
    expect(foundIdentifiers(files, REMOVED_IDENTIFIERS).join(",")).toBe("");
  });

  it("연결 훅의 서버 프레임 화이트리스트에 chat·typing·chatLog·chatReject·world 가 있고 emoji 는 없다", () => {
    const code = stripComments(read("src/net/useRoomConnection.ts"));
    const line = code.split("\n").find((l) => l.includes('v.t === "pong"'));
    expect(line).toBeDefined();
    const missing = ["chat", "typing", "chatLog", "chatReject", "world"].filter((t) => !line!.includes(`v.t === "${t}"`));
    expect(missing.join(",")).toBe("");
    expect(/emoji/i.test(code)).toBe(false);
  });
});
