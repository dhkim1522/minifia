// 16-02: 컬러 에셋 A 25개(장소 16 + 흔적 조각 9) 이식 — 변환 스크립트·사본·정적 JSX 가 어긋나지 않는지 본다(D-07, V-26).
// 원본(design/v3.0/tutorial/Main.dc.html)을 다시 그리지 않고 옮긴 것이므로 id·이름 1:1, 본문 서로 다름, 주입 금지를 고정한다.
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PLACE_IDS, TRACE_PIECE_IDS } from "../../shared/protocol";
import { PLACE_NAME } from "../../src/game/placeText";
import { TRACE_TEXT } from "../../src/game/traceText";
// 타입 선언이 없는 .mjs 다(allowJs 없음). 모양은 아래 ArtScript 로 직접 적는다.
// @ts-expect-error -- 선언 없는 스크립트 모듈
import * as script from "../../scripts/make-placeart.mjs";

interface ArtItem {
  id: string;
  group: "place" | "trace";
  label: string;
  body: string;
}
interface ArtScript {
  buildArt: () => { items: ArtItem[]; files: Map<string, string> };
  readOutputs: (paths: string[]) => Map<string, string>;
  diffOutputs: (expected: Map<string, string>, actual: Map<string, string>) => string[];
}
const art = script as unknown as ArtScript;

const ASSET_DIR = "design/v3.0/assets";
const JSX_PATH = "src/components/v2/placeArt.tsx";
const BAR_PLACES = PLACE_IDS.slice(0, 8);
const PLAZA_PLACES = PLACE_IDS.slice(8);

describe("컬러 에셋 이식 스크립트 --check", () => {
  it("실제 --check 가 0 으로 끝난다(사본·JSX 가 원본과 일치)", () => {
    expect(() => execFileSync(process.execPath, ["scripts/make-placeart.mjs", "--check"], { stdio: "pipe" })).not.toThrow();
  });

  it("비교 함수: 같으면 빈 목록, 한 글자 다르면 그 경로만 돌려준다", () => {
    const { files } = art.buildArt();
    expect(art.diffOutputs(files, new Map(files))).toEqual([]);
    const [firstKey] = [...files.keys()];
    const changed = new Map(files);
    changed.set(firstKey, (files.get(firstKey) as string) + " ");
    expect(art.diffOutputs(files, changed)).toEqual([firstKey]);
    const missing = new Map(files);
    missing.delete(firstKey);
    expect(art.diffOutputs(files, missing)).toEqual([firstKey]);
  });

  it("디스크 파일이 메모리에서 다시 만든 결과와 같다", () => {
    const { files } = art.buildArt();
    expect(art.diffOutputs(files, art.readOutputs([...files.keys()]))).toEqual([]);
  });
});

describe("사본(design/v3.0/assets)", () => {
  const names = readdirSync(ASSET_DIR).filter((f) => f.endsWith(".svg"));

  it("svg 정확히 25개, 파일 이름 집합 = PLACE_IDS ∪ TRACE_PIECE_IDS", () => {
    expect(names.length).toBe(25);
    expect(JSON.stringify([...names].sort())).toBe(JSON.stringify([...PLACE_IDS, ...TRACE_PIECE_IDS].map((id) => `${id}.svg`).sort()));
  });

  it.each([...PLACE_IDS])("장소 %s: aria-label 이 PLACE_NAME 과 같고 48 격자다", (id) => {
    const svg = readFileSync(`${ASSET_DIR}/${id}.svg`, "utf8");
    expect(svg).toContain(`aria-label="${PLACE_NAME[id]}"`);
    expect(svg).toContain('viewBox="0 0 48 48"');
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it.each([...TRACE_PIECE_IDS])("조각 %s: aria-label 이 TRACE_TEXT 와 같고 48 격자다", (piece) => {
    const svg = readFileSync(`${ASSET_DIR}/${piece}.svg`, "utf8");
    expect(svg).toContain(`aria-label="${TRACE_TEXT[piece]}"`);
    expect(svg).toContain('viewBox="0 0 48 48"');
  });

  it("사본에 스크립트·이벤트 속성·foreignObject 가 없다(T-16-05)", () => {
    for (const f of names) {
      const svg = readFileSync(`${ASSET_DIR}/${f}`, "utf8");
      expect(svg).not.toMatch(/<script|foreignObject|\son[a-z]+=/i);
    }
  });
});

describe("생성 JSX(placeArt.tsx)", () => {
  const src = readFileSync(JSX_PATH, "utf8");

  it("머리에 생성물 표시가 있다", () => {
    expect(src).toContain("scripts/make-placeart.mjs");
  });

  it("HTML 문자열 주입·하이픈 속성 이름이 없다", () => {
    expect(src).not.toContain("dangerouslySetInnerHTML");
    expect(src).not.toMatch(/stroke-width|stroke-linejoin|stroke-linecap/);
    // JSX 속성 위치의 하이픈 이름(예: data-·aria- 말고) 전반
    expect(src).not.toMatch(/\s(?:stroke|fill|clip|stop)-[a-z]+=/);
  });

  it("id·이름 1:1: 항목 25개가 PLACE_IDS·TRACE_PIECE_IDS 와 같고 label 이 이름 표와 같다", () => {
    const { items } = art.buildArt();
    const places = items.filter((i) => i.group === "place");
    const traces = items.filter((i) => i.group === "trace");
    expect(JSON.stringify(places.map((i) => i.id))).toBe(JSON.stringify([...PLACE_IDS]));
    expect(JSON.stringify(traces.map((i) => i.id))).toBe(JSON.stringify([...TRACE_PIECE_IDS]));
    for (const p of places) expect(p.label).toBe(PLACE_NAME[p.id as keyof typeof PLACE_NAME]);
    for (const t of traces) expect(t.label).toBe(TRACE_TEXT[t.id as keyof typeof TRACE_TEXT]);
    for (const id of [...PLACE_IDS, ...TRACE_PIECE_IDS]) expect(src).toContain(`${id}:`);
  });

  it("같은 맵 안의 장소 그림 본문이 서로 다르다(재즈 바 8·광장 8·조각 9)", () => {
    const { items } = art.buildArt();
    const bodyOf = (ids: readonly string[]) => ids.map((id) => (items.find((i) => i.id === id) as ArtItem).body);
    for (const ids of [BAR_PLACES, PLAZA_PLACES, TRACE_PIECE_IDS] as readonly (readonly string[])[]) {
      const bodies = bodyOf(ids);
      expect(new Set(bodies).size).toBe(ids.length);
    }
  });

  it("내보내기: PLACE_ART·TRACE_ART·PlaceArt·TraceArt", () => {
    for (const name of ["PLACE_ART", "TRACE_ART", "PlaceArt", "TraceArt"]) expect(src).toMatch(new RegExp(`export (const|function) ${name}\\b`));
  });
});
