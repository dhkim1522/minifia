// node --test scripts/deploy-target.test.mjs
// 배포 대상 단일 출처(deploy-target.mjs)와 v1.0 거부 판정(결정 0043-3·0044-24, DEPLOY-02).
// 이 파일은 v1.0 호스트 문자열을 의도적으로 담는다 — 거부 대상이기 때문이다(정적 검사 허용 목록).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  WORKER_NAME,
  V1_NAME,
  V1_HOST,
  V1_ORIGIN,
  WORKERS_SUBDOMAIN,
  expectedOrigin,
  assertNotV1,
  stripJsonComments,
  judgeDeployTarget,
} from "./deploy-target.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const read = (rel) => readFileSync(`${ROOT}${rel}`, "utf8");

const V2_ORIGIN = "https://minifia-v2.dhplay.workers.dev";
const goodInput = () => ({ builtName: "minifia-v2", sourceName: "minifia-v2", prodUrl: V2_ORIGIN, previewUrls: false });

test("상수: v2 Worker 이름과 파생 주소", () => {
  assert.equal(WORKER_NAME, "minifia-v2");
  assert.equal(V1_NAME, "minifia");
  assert.equal(WORKERS_SUBDOMAIN, "dhplay");
  assert.equal(V1_HOST, "minifia.dhplay.workers.dev");
  assert.equal(V1_ORIGIN, "https://minifia.dhplay.workers.dev");
  assert.equal(expectedOrigin(), V2_ORIGIN);
});

for (const v1 of [
  "https://minifia.dhplay.workers.dev",
  "https://minifia.dhplay.workers.dev/",
  "https://MINIFIA.dhplay.workers.dev/room/1234",
  "http://minifia.dhplay.workers.dev",
]) {
  test(`assertNotV1 은 v1.0 주소를 거부: ${v1}`, () => {
    assert.throws(() => assertNotV1(v1), /v1\.0/);
  });
}

test("assertNotV1 은 v2 주소의 origin 을 돌려준다", () => {
  assert.equal(assertNotV1(V2_ORIGIN), V2_ORIGIN);
  assert.equal(assertNotV1(`${V2_ORIGIN}/room/1`), V2_ORIGIN);
});

test("assertNotV1 은 로컬 주소를 통과시킨다(로컬 E2E)", () => {
  assert.equal(assertNotV1("http://localhost:5173"), "http://localhost:5173");
  assert.equal(assertNotV1("http://127.0.0.1:8787"), "http://127.0.0.1:8787");
  assert.equal(assertNotV1("http://[::1]:8787"), "http://[::1]:8787");
});

test("assertNotV1 은 주소가 아닌 문자열을 거부", () => {
  assert.throws(() => assertNotV1("not a url"));
});

test("stripJsonComments: 줄·블록 주석을 지우고 문자열 안의 // 는 남긴다", () => {
  const out = stripJsonComments('{ "a": "x//y", // 줄 주석\n /* 블록\n주석 */ "b": 1 }');
  assert.deepEqual(JSON.parse(out), { a: "x//y", b: 1 });
});

test("stripJsonComments: 이스케이프된 따옴표 뒤의 // 도 문자열로 본다", () => {
  const out = stripJsonComments('{ "a": "q\\"//still" } // 끝');
  assert.deepEqual(JSON.parse(out), { a: 'q"//still' });
});

test("stripJsonComments: 지금 wrangler.jsonc 가 JSON.parse 된다", () => {
  const parsed = JSON.parse(stripJsonComments(read("wrangler.jsonc")));
  assert.equal(typeof parsed.name, "string");
});

test("judgeDeployTarget: 모두 맞으면 통과", () => {
  assert.deepEqual(judgeDeployTarget(goodInput()), { ok: true, problems: [] });
});

test("judgeDeployTarget: 낡은 산출물(name minifia)은 dist/worker/wrangler.json 을 짚어 실패", () => {
  const r = judgeDeployTarget({ ...goodInput(), builtName: "minifia" });
  assert.equal(r.ok, false);
  assert.ok(r.problems.some((p) => p.includes("dist/worker/wrangler.json")));
});

test("judgeDeployTarget: 소스 name 이 다르면 실패", () => {
  assert.equal(judgeDeployTarget({ ...goodInput(), sourceName: "minifia" }).ok, false);
});

test("judgeDeployTarget: prod-url 호스트가 다르면 실패", () => {
  assert.equal(judgeDeployTarget({ ...goodInput(), prodUrl: "https://minifia.dhplay.workers.dev" }).ok, false);
});

test("judgeDeployTarget: previewUrls 가 true 거나 누락이면 실패", () => {
  assert.equal(judgeDeployTarget({ ...goodInput(), previewUrls: true }).ok, false);
  assert.equal(judgeDeployTarget({ ...goodInput(), previewUrls: undefined }).ok, false);
});

test("저장소 사실: wrangler.jsonc name === WORKER_NAME", () => {
  assert.equal(JSON.parse(stripJsonComments(read("wrangler.jsonc"))).name, WORKER_NAME);
});

test("저장소 사실: prod-url.txt === expectedOrigin()", () => {
  assert.equal(read("scripts/prod-url.txt").trim(), expectedOrigin());
});

test("저장소 사실: preview_urls 는 false 그대로(결정 0042)", () => {
  assert.equal(JSON.parse(stripJsonComments(read("wrangler.jsonc"))).preview_urls, false);
});

test("저장소 사실: npm run deploy 는 계정 확인 → 빌드 → 산출물 검사 → 배포 순서", () => {
  assert.equal(
    JSON.parse(read("package.json")).scripts.deploy,
    "node scripts/check-account.mjs && vite build && node scripts/check-deploy-target.mjs && wrangler deploy",
  );
});
