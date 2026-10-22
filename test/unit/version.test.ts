import { describe, expect, it } from "vitest";
import { APP_VERSION } from "../../shared/version";

describe("APP_VERSION", () => {
  it("빌드 define 이 없는 환경에서는 dev 를 쓴다", () => {
    expect(APP_VERSION).toBe("dev");
  });
});
