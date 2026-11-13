// 21-07 (D-21, UI-SPEC 겉보기 같음 1): 화면 코드(src)는 서버 전용 상태를 모른다.
// 21페이즈의 등불 자르기(lampCut)와 단서 흐리기(smudged)는 서버 전용이다 — 켜기와 자르기, 먼저 살핀 사람과 뒤에 살핀 사람이 화면에서 갈리면 역할이 샌다.
// 화면 번들에 그 이름이 있으면 그 값을 다루는 길이 생기므로 git 이 추적하는 src/ 파일 전체를 읽어 세 가지를 정적으로 막는다.
//  (a) 서버 전용 이름 넷(lampCut·smudged·skipVote·mafiaTouch)이 어떤 파일에도 없다.
//  (b) 낱말 경계 cut 은 허용 목록(지금 쓰이는 세 파일 — 캐릭터 모자 머리카락, 컷어웨이 지붕, 마을 지도 지붕·앞벽 덩어리)에만 있다. 그 밖에 cut 이 나오면 자르기 기능이 화면에 들어온 것이다.
//  (c) `data-` 로 시작하고 cut 을 품은 속성 이름이 없다(E2E·검사 도구가 읽는 표식으로 자르기 상태가 새지 않는다).
// 21-08 이후 화면 계획(저녁·아침·단서 화면)이 이 시험을 지킨다 — 화면은 서버가 보낸 공개 값(day.lamps·day.scene.house·me.clues)만 그린다.
// 읽는 모양은 test/unit/e2eContract.test.ts 의 표식 시험과 같다(git 이 추적하는 파일만 — 내려받은 파일·생성물이 우연히 이름을 담아도 통과시키지 않는다).
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = new URL("../../", import.meta.url);
const tracked = execFileSync("git", ["ls-files", "src"], { cwd: root, encoding: "utf8" })
  .split("\n")
  .filter((f) => f !== "");
const sources = tracked.map((f) => ({ f, text: readFileSync(new URL(f, root), "utf8") }));

/** 낱말 cut 이 있어도 되는 파일: 모자 머리카락(character.ts)·방 지붕 걷기(cutaway.ts)·마을 지도의 지붕·앞벽 덩어리(maps/town.ts). 모두 3D 장면의 모양 이야기이고 등불 자르기와 무관하다. */
const CUT_WORD_FILES = ["src/world/character.ts", "src/world/cutaway.ts", "src/world/maps/town.ts"];
const SERVER_ONLY_NAMES = ["lampCut", "smudged", "skipVote", "mafiaTouch"];
const CUT_WORD = /\bcut\b/i;
const DATA_CUT_ATTR = /data-[\w-]*cut/i;

describe("src 정적 검사 — 화면 코드는 서버 전용 상태를 모른다 (21-07, D-21)", () => {
  it("git 이 추적하는 src 파일을 실제로 읽는다(빈 목록을 통과로 읽지 않는다)", () => {
    expect(tracked.length).toBeGreaterThan(50);
    expect(sources.every((s) => s.text.length > 0)).toBe(true);
  });

  it("(a) 서버 전용 이름 lampCut·smudged·skipVote·mafiaTouch 가 어떤 파일에도 없다", () => {
    const hits = sources.flatMap((s) => SERVER_ONLY_NAMES.filter((n) => s.text.includes(n)).map((n) => `${s.f}:${n}`));
    expect(hits.join(" ") || "없음").toBe("없음");
  });

  it("(b) 낱말 cut 이 나오는 파일은 허용 목록(character·cutaway·maps/town)과 정확히 같다", () => {
    const files = sources.filter((s) => CUT_WORD.test(s.text)).map((s) => s.f).sort();
    expect(files.join(" ")).toBe([...CUT_WORD_FILES].sort().join(" "));
  });

  it("(c) cut 을 품은 data- 속성 이름이 하나도 없다", () => {
    const hits = sources.filter((s) => DATA_CUT_ATTR.test(s.text)).map((s) => s.f);
    expect(hits.join(" ") || "없음").toBe("없음");
  });
});
