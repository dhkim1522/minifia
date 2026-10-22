import { exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

describe("Worker /api", () => {
  it("GET /api/health 는 200 과 ok:true, 문자열 version 을 돌려준다", async () => {
    const res = await exports.default.fetch("http://x/api/health");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = (await res.json()) as { ok: boolean; version: unknown };
    expect(body.ok).toBe(true);
    expect(typeof body.version).toBe("string");
  });

  it("알 수 없는 /api/* 경로는 404 와 NOT_FOUND 를 돌려준다", async () => {
    const res = await exports.default.fetch("http://x/api/nope");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "NOT_FOUND" });
  });
});
