// three 를 올리려면 결정 기록을 먼저 남긴다(결정 0055-1). 이 테스트는 그 약속을 지킨다.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { REVISION } from "three";

const root = (p: string) => new URL(`../../${p}`, import.meta.url);
const pkg = JSON.parse(readFileSync(root("package.json"), "utf8"));
const lock = JSON.parse(readFileSync(root("package-lock.json"), "utf8"));

const THREE_INTEGRITY =
  "sha512-blFeqb49wRCSGUGj7gtpfnSGHy2lwDk94RhUmS1c/hTby70kvChbWpkJ4Pm1390LqzzvTmzgXKHPEafJwCb8jA==";

describe("three 정확 고정 (결정 0055-1)", () => {
  it("package.json 에서 범위(^·~) 없이 정확한 버전으로 고정되어 있다", () => {
    expect(pkg.dependencies.three).toBe("0.186.1");
    expect(pkg.devDependencies["@types/three"]).toBe("0.186.0");
  });

  it("package-lock.json 의 버전과 무결성 값이 확인된 값과 같다", () => {
    expect(lock.packages["node_modules/three"].version).toBe("0.186.1");
    expect(lock.packages["node_modules/three"].integrity).toBe(THREE_INTEGRITY);
    expect(lock.packages["node_modules/@types/three"].version).toBe("0.186.0");
  });

  it("설치된 three 의 REVISION 이 186 이다", () => {
    expect(REVISION).toBe("186");
  });
});
