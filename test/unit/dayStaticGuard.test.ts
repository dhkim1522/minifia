// 08-20·08-22: 지운 v1.0 낮·처형 화면·로직·서버·와이어 이름의 정적 가드 (DAY-07, T-08-49).
// "옛 테이블·후보 선택 화면이 다시 생기지 않는다" 를 소스 문자열로 고정한다. 동작 시험이 아니라 구조 회귀 시험이다(chatStaticGuard 와 같은 방식).
// 주석(// 줄·/* */ 블록)은 지우고 본다: 지운 이름을 설명하는 주석은 허용하고, 코드에 남은 이름만 잡는다.
// stripComments·foundIdentifiers 는 chatStaticGuard 에서 가져온다. 그 파일의 describe 도 이 파일 안에서 한 번 더 도는데, 결과는 같고 무해하다.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { foundIdentifiers, stripComments } from "./chatStaticGuard.test";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const read = (rel: string): string => readFileSync(`${ROOT}${rel}`, "utf8");

/**
 * 08-19·08-20 이 지운 클라이언트 화면·로직 이름과 08-21·08-22 가 지운 서버·와이어 이름. 이름이 코드에 다시 나타나면 옛 길이 되살아난 것이다.
 * 서버·와이어 쪽(옛 세 단계 이름, 옛 두 메시지, 옛 규칙 함수, 후보 공개 길이 공식, 처형 문구 번호)은 SERVER_REMOVED_IDENTIFIERS 에 따로 둔다.
 */
export const REMOVED_DAY_IDENTIFIERS = [
  "DayTable",
  "DayScene",
  "verdictScene",
  "ExecVotePanel",
  "CandidateVotePanel",
  "ExecIntroCard",
  "NoExecutionCard",
  "RevealLayer",
  "UserRecordSheet",
  "ReadOnlyRow",
  "SceneIntro",
  "MorningCard",
  "useRevealState",
  "recordRows",
  "dayTableGeometry",
  "tablePanelHeight",
  // 9페이즈 삭제 목록(UI-SPEC 335행), 결정 0061: 8페이즈 밤 임시 틀 — 밤 알약 패널 부품 셋, 알약 문구 표, GamePanel 의 밤 알약 변수,
  // 경찰·의사 지도 이름표 동사 표, 옛 마피아 밤 안내 키, v1.0 선택 오류·마피아 채팅 안내 문구 키. 경찰·의사는 얼굴 목록(FaceList)으로 고른다.
  "NightPanel",
  "PickPill",
  "NoticePill",
  "NIGHT_PANEL_TEXT",
  "nightPill",
  "pillPick",
  "PICK_VERB",
  "mafiaNightHint",
  "pickError",
  "mafiaChatNotice",
  // 9페이즈(09-18) 삭제 목록, 결정 0061-17: v1.0 아침 탈락 문구 체계 — 꼬리 문장 일곱 가지 표, 번호로 고르는 제목 함수, 무사 문구 객체,
  // 카드 문장 함수와 그 반환 모양. 아침 알림은 morningText(세 문장)가 대신한다.
  "ELIMINATION_TAILS",
  "eliminationTitle",
  "MORNING_SAFE",
  "morningCardText",
  "MorningCardContent",
] as const;

/**
 * 08-21·08-22 가 서버·와이어·단계 표에서 지운 이름(옛 처형 여부 투표·후보 선택·후보 공개 흐름). 주석 밖 코드에는 0건이어야 한다.
 * 예외 하나: shared/game/room.ts 의 normalizeStoredRoom 이 옛 저장 방을 토론으로 옮기려고 문자열로 비교하는 표(LEGACY_*) —
 * 따옴표 안·구조 분해의 옛 키 이름이라 단어 경계 검색에 걸린다. 그 파일의 해당 줄 모양만 ROOM_LEGACY_LINES 로 허용하고 그 밖의 줄은 실패시킨다.
 */
export const SERVER_REMOVED_IDENTIFIERS = [
  "execVote",
  "candidateVote",
  "candidateVoteReveal",
  "ExecTally",
  "execTallyOf",
  "castExecVote",
  "castCandidateVote",
  "tallyCandidateVote",
  "enterExecVote",
  "enterCandidateVoteReveal",
  "candidateRevealMs",
  "EXECUTION_PHRASE_COUNT",
  "lastExecPhrase",
  // 9페이즈(09-18), 결정 0061-17: 아침 문구 수 상수와 직전 문구 기억 필드. 서버는 문구 번호를 더 이상 채우지 않고 와이어도 싣지 않는다.
  "MORNING_PHRASE_COUNT",
  "lastPhrase",
  // 09.1-04, 결정 0063-1: 동시 지목의 15초 단계 상수와 같은 사람 250ms 지목 간격 상수를 지웠으나, 13-01(결정 0072)이 기본판 동시 투표로 되살렸다 — 이 둘은 더 이상 지운 이름이 아니다.
  // 09.1-05 가 지운 옛 봇 지연 지목의 지연 상수 POINT_BASE_MS·POINT_SPAN_MS 도 13-02(결정 0072)가 기본판 동시 투표 봇 계획으로 되살렸다 — 더 이상 지운 이름이 아니다.
] as const;

const ROOM_PATH = "shared/game/room.ts";
/** room.ts 정규화 표에서 옛 이름이 나타나도 되는 줄 모양(앞뒤 공백 제거). 이유: 옛 저장 방의 단계 이름·키를 문자열로 비교하고 키째 빼야 한다(결정 0060-12). */
const ROOM_LEGACY_LINES: readonly RegExp[] = [
  /^(execVote|candidateVote|candidateVoteReveal): "\1",$/,
  /^const LEGACY_VOTE_PHASES: readonly string\[\] = \[LEGACY_PHASES\.execVote, LEGACY_PHASES\.candidateVote, LEGACY_PHASES\.candidateVoteReveal\];$/,
  /^const LEGACY_VOTE_PLAYER_KEYS = \["execVote", "candidateVote"\] as const;$/,
  /^const hasOldVoteRoomKey = Object\.hasOwn\(stored, "lastExecPhrase"\);$/,
  /^lastExecPhrase: _execPhrase,$/,
  /^lastExecPhrase\?: unknown;$/,
];

/** 주석을 지운 room.ts 코드에서 옛 이름이 든 줄 가운데 허용 모양이 아닌 줄을 돌려준다. */
export function roomLegacyViolations(src: string): string[] {
  const names = new RegExp(`\\b(${SERVER_REMOVED_IDENTIFIERS.join("|")})\\b`);
  return stripComments(src)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => names.test(line) && !ROOM_LEGACY_LINES.some((re) => re.test(line)));
}

describe("가드 도우미 — 일부러 틀린 사본에서는 실패한다", () => {
  it("코드에 남은 지운 이름은 잡고 주석 속 이름과 이름의 일부는 잡지 않는다", () => {
    const bad = [{ path: "x.tsx", src: 'import { DayTable } from "./DayTable";' }];
    const commentOnly = [{ path: "y.ts", src: "// DayScene 은 08-19 에서 지웠다\n/* tablePanelHeight */ const ok = 1;" }];
    const partial = [{ path: "z.ts", src: "const MyDayTableau = 1; const RevealLayerCount = 2; const recordRowsOf = 3;" }];
    expect(foundIdentifiers(bad, REMOVED_DAY_IDENTIFIERS).join(",")).toBe("x.tsx:DayTable");
    expect(foundIdentifiers(commentOnly, REMOVED_DAY_IDENTIFIERS)).toEqual([]);
    expect(foundIdentifiers(partial, REMOVED_DAY_IDENTIFIERS)).toEqual([]);
  });

  it("서버 이름 가드: 코드에 남은 옛 단계 이름·함수는 잡고 주석은 잡지 않으며, room.ts 정규화 표 모양만 허용한다", () => {
    const bad = [{ path: "s.ts", src: 'if (state.phase === "execVote") castExecVote(s);' }];
    const commentOnly = [{ path: "c.ts", src: "// candidateRevealMs 는 08-22 에서 지웠다\nconst ok = 1;" }];
    expect(foundIdentifiers(bad, SERVER_REMOVED_IDENTIFIERS).join(",")).toBe("s.ts:execVote,s.ts:castExecVote");
    expect(foundIdentifiers(commentOnly, SERVER_REMOVED_IDENTIFIERS)).toEqual([]);
    expect(roomLegacyViolations('  execVote: "execVote",\n  const x = 1;')).toEqual([]);
    expect(roomLegacyViolations('if (phase === "execVote") return 1;')).toEqual(['if (phase === "execVote") return 1;']);
    expect(roomLegacyViolations("lastExecPhrase: phrase,")).toEqual(["lastExecPhrase: phrase,"]);
  });

  it("stripComments 는 문자열 안의 // 를 남기고 줄 수를 지킨다", () => {
    const src = ['const a = "http://x"; // DayTable', "/* DayScene", "   verdictScene */ const b = 1;"].join("\n");
    const code = stripComments(src);
    expect(code.includes("DayTable") || code.includes("DayScene") || code.includes("verdictScene")).toBe(false);
    expect(code.includes('"http://x"')).toBe(true);
    expect(code.split("\n").length).toBe(src.split("\n").length);
  });
});

describe("지운 v1.0 낮·처형 화면 이름 (DAY-07)", () => {
  const tracked = execFileSync("git", ["ls-files", "src", "shared", "worker"], { cwd: ROOT, encoding: "utf8" })
    .split("\n")
    .filter((p) => /\.tsx?$/.test(p));

  it("src·shared 의 .ts·.tsx 주석 밖 코드에 지운 이름이 없다", () => {
    expect(tracked.length).toBeGreaterThan(20); // 검사가 아무것도 못 보는 일이 없게
    const files = tracked.map((path) => ({ path, src: read(path) }));
    expect(foundIdentifiers(files, REMOVED_DAY_IDENTIFIERS).join(",")).toBe("");
  });

  it("shared·worker·src 의 주석 밖 코드에 지운 서버·와이어 이름이 없다 (room.ts 정규화 표 줄만 예외)", () => {
    const files = tracked.filter((path) => path !== ROOM_PATH).map((path) => ({ path, src: read(path) }));
    expect(foundIdentifiers(files, SERVER_REMOVED_IDENTIFIERS).join(",")).toBe("");
    expect(roomLegacyViolations(read(ROOM_PATH)).join(" | ")).toBe("");
    // 예외가 실제로 쓰이고 있는지(표가 사라졌는데 예외만 남는 일이 없게)
    expect(read(ROOM_PATH).includes('"candidateVoteReveal"') || read(ROOM_PATH).includes("candidateVoteReveal:")).toBe(true);
  });

  it("와이어 MorningView 필드는 eliminated·saved·trace 셋뿐이고 문구 번호 필드가 없다 (결정 0061-12·17, trace 는 15페이즈 D-06)", () => {
    const code = stripComments(read("shared/protocol.ts"));
    const body = /export interface MorningView \{([^}]*)\}/.exec(code)?.[1] ?? "";
    expect(body.length).toBeGreaterThan(0);
    const keys = [...body.matchAll(/^\s*([A-Za-z]+)\??:/gm)].map((m) => m[1]);
    expect(keys.sort().join(",")).toBe("eliminated,saved,trace");
  });

  it("지운 파일이 저장소에 없다", () => {
    const gone = [
      "src/game/dayTable.ts",
      "src/game/recordRows.ts",
      "src/game/blankTap.ts",
      "src/screens/DayScene.tsx",
      "src/screens/verdictScene.tsx",
      "src/components/DayTable.tsx",
      "src/components/NightPanel.tsx",
      "src/net/useRevealState.ts",
      "src/styles/daytable.css",
      "src/styles/verdict.css",
      "src/styles/urecord.css",
      "shared/game/vote.ts",
    ];
    const present = new Set(execFileSync("git", ["ls-files", ...gone], { cwd: ROOT, encoding: "utf8" }).split("\n").filter(Boolean));
    expect([...present]).toEqual([]);
  });
});
