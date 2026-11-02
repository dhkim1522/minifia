// 08-20: 지운 v1.0 낮·처형 화면·로직 이름의 정적 가드 (DAY-07, T-08-49).
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
 * 08-19·08-20 이 지운 클라이언트 화면·로직 이름. 이름이 코드에 다시 나타나면 옛 화면이 되살아난 것이다.
 * 08-22 가 서버·와이어 쪽 이름(execVote·candidateVote 등)을 이 목록에 더한다.
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
] as const;

describe("가드 도우미 — 일부러 틀린 사본에서는 실패한다", () => {
  it("코드에 남은 지운 이름은 잡고 주석 속 이름과 이름의 일부는 잡지 않는다", () => {
    const bad = [{ path: "x.tsx", src: 'import { DayTable } from "./DayTable";' }];
    const commentOnly = [{ path: "y.ts", src: "// DayScene 은 08-19 에서 지웠다\n/* tablePanelHeight */ const ok = 1;" }];
    const partial = [{ path: "z.ts", src: "const MyDayTableau = 1; const RevealLayerCount = 2; const recordRowsOf = 3;" }];
    expect(foundIdentifiers(bad, REMOVED_DAY_IDENTIFIERS).join(",")).toBe("x.tsx:DayTable");
    expect(foundIdentifiers(commentOnly, REMOVED_DAY_IDENTIFIERS)).toEqual([]);
    expect(foundIdentifiers(partial, REMOVED_DAY_IDENTIFIERS)).toEqual([]);
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
  const tracked = execFileSync("git", ["ls-files", "src", "shared"], { cwd: ROOT, encoding: "utf8" })
    .split("\n")
    .filter((p) => /\.tsx?$/.test(p));

  it("src·shared 의 .ts·.tsx 주석 밖 코드에 지운 이름이 없다", () => {
    expect(tracked.length).toBeGreaterThan(20); // 검사가 아무것도 못 보는 일이 없게
    const files = tracked.map((path) => ({ path, src: read(path) }));
    expect(foundIdentifiers(files, REMOVED_DAY_IDENTIFIERS).join(",")).toBe("");
  });

  it("지운 파일이 저장소에 없다", () => {
    const gone = [
      "src/game/dayTable.ts",
      "src/game/recordRows.ts",
      "src/game/blankTap.ts",
      "src/screens/DayScene.tsx",
      "src/screens/verdictScene.tsx",
      "src/components/DayTable.tsx",
      "src/net/useRevealState.ts",
      "src/styles/daytable.css",
      "src/styles/verdict.css",
      "src/styles/urecord.css",
    ];
    const present = new Set(execFileSync("git", ["ls-files", ...gone], { cwd: ROOT, encoding: "utf8" }).split("\n").filter(Boolean));
    expect([...present]).toEqual([]);
  });
});
