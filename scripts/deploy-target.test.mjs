// node --test scripts/deploy-target.test.mjs
// 배포 대상 단일 출처(deploy-target.mjs)와 v1.0 거부 판정(결정 0043-3·0044-24, DEPLOY-02).
// 이 파일은 v1.0 호스트 문자열을 의도적으로 담는다 — 거부 대상이기 때문이다(정적 검사 허용 목록).
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
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

const V2_ORIGIN = "https://minifia-v3.dhplay.workers.dev";
const goodInput = () => ({ builtName: "minifia-v3", sourceName: "minifia-v3", prodUrl: V2_ORIGIN, previewUrls: false });

test("상수: v2 Worker 이름과 파생 주소", () => {
  assert.equal(WORKER_NAME, "minifia-v3");
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
  // 완전한 도메인 이름(FQDN)의 끝 점도 같은 Worker 로 해석된다 — 우회 금지(06 리뷰 CR-01).
  "https://minifia.dhplay.workers.dev.",
  "https://minifia.dhplay.workers.dev./room/1234",
  "https://MINIFIA.dhplay.workers.dev.:443/x",
  "https://minifia.dhplay.workers.dev..",
  "https://minifia.dhplay.workers.dev%2e",
  "https://minifia\u3002dhplay\u3002workers\u3002dev\u3002",
  "https://user:pw@minifia.dhplay.workers.dev./",
]) {
  test(`assertNotV1 은 v1.0 주소를 거부: ${v1}`, () => {
    assert.throws(() => assertNotV1(v1), /v1\.0/);
  });
}

test("assertNotV1 은 v2 주소의 origin 을 돌려준다", () => {
  assert.equal(assertNotV1(V2_ORIGIN), V2_ORIGIN);
  assert.equal(assertNotV1(`${V2_ORIGIN}/room/1`), V2_ORIGIN);
});

test("assertNotV1 은 v2 주소를 끝 점·대문자 형태에서도 통과시킨다(v1 만 막는다)", () => {
  assert.doesNotThrow(() => assertNotV1("https://minifia-v2.dhplay.workers.dev."));
  assert.doesNotThrow(() => assertNotV1("https://MINIFIA-V2.dhplay.workers.dev"));
  // v1 이름을 접두로만 공유하는 호스트는 v1 이 아니다.
  assert.doesNotThrow(() => assertNotV1("https://minifia.dhplay.workers.dev.example.com"));
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
    "node scripts/check-account.mjs && vite build && node scripts/check-deploy-target.mjs && node scripts/deploy.mjs",
  );
});

// --- 정적 검사: v1.0 문자열 전수·가드 호출 누락(DEPLOY-02, T-06-02) ---
// 가드가 빠진 스크립트를 v1 주소로 실제 실행하면 v1 에 요청이 나가므로, 실행하지 않고 파일 내용으로만 확인한다.
const gitLsFiles = (...paths) =>
  execFileSync("git", ["ls-files", "--", ...paths], { cwd: ROOT, encoding: "utf8" }).split("\n").filter(Boolean);

test("정적 검사: v1.0 호스트 문자열은 허용 목록 밖에 없다", () => {
  const allowedFiles = new Set([
    "scripts/deploy-target.mjs", // 정의(V1_HOST·V1_ORIGIN)
    "scripts/deploy-target.test.mjs", // 거부 테스트
    "scripts/e2e/lib.test.mjs", // resolveTarget 거부 테스트
  ]);
  const allowedLine = (file, line) => file === "index.html" && line.includes('property="og:image"'); // UI-SPEC: og:* 는 이 페이즈에서 바꾸지 않는다
  const found = [];
  for (const file of gitLsFiles("scripts", "src", "shared", "worker", "index.html", "wrangler.jsonc", "package.json")) {
    if (allowedFiles.has(file)) continue;
    let text;
    try {
      text = read(file);
    } catch {
      continue; // 작업 트리에서 지워진 추적 파일
    }
    text.split("\n").forEach((line, i) => {
      if (line.toLowerCase().includes(V1_HOST) && !allowedLine(file, line)) found.push(`${file}:${i + 1}`);
    });
  }
  assert.deepEqual(found, []);
});

test("정적 검사: prod-url.txt 를 읽는 요청 스크립트는 모두 v1.0 가드를 부른다", () => {
  // 가드가 필요 없는 파일: 이 테스트 자신, 정의 파일, 네트워크 요청이 없는 배포 게이트(자체 호스트 대조)
  const exempt = new Set(["scripts/deploy-target.test.mjs", "scripts/deploy-target.mjs", "scripts/check-deploy-target.mjs"]);
  const readers = gitLsFiles("scripts").filter(
    (f) => f.endsWith(".mjs") && !f.endsWith(".test.mjs") && !exempt.has(f) && read(f).includes("prod-url.txt"),
  );
  assert.ok(readers.length >= 5, `prod-url.txt 를 읽는 스크립트 수집 실패: ${readers.join(", ")}`);
  const unguarded = readers.filter((f) => !/\bexitIfV1\(|\bresolveTarget\(/.test(read(f)));
  assert.deepEqual(unguarded, []);
  // 명시적 주소 갈래: 이름이 알려진 세 스크립트는 반드시 exitIfV1 을 직접 부른다
  for (const f of ["smoke", "bots", "uat-test-room"]) {
    assert.match(read(`scripts/${f}.mjs`), /\bexitIfV1\(/, `${f}.mjs`);
  }
  assert.match(read("scripts/gallery.mjs"), /\bexitIfV1\(/);
});

// WR-05(06 리뷰): `npm run deploy -- --name minifia` 가 가드 뒤 wrangler 로 새지 않는다.
test("npm run deploy 의 마지막 단계는 인자를 받지 않는 래퍼다(wrangler deploy 를 직접 두지 않는다)", () => {
  const { scripts } = JSON.parse(read("package.json"));
  assert.match(scripts.deploy, /node scripts\/deploy\.mjs$/);
  assert.doesNotMatch(scripts.deploy, /wrangler deploy/);
  assert.ok(scripts.deploy.indexOf("check-deploy-target.mjs") < scripts.deploy.indexOf("scripts/deploy.mjs"));
});

test("planDeploy: 인자가 없으면 고정 명령, 인자는 하나도 거부", async () => {
  const { planDeploy } = await import("./deploy.mjs");
  assert.deepEqual(planDeploy([]), { ok: true, command: "npx", args: ["wrangler", "deploy"] });
  for (const extra of [["--name", "minifia"], ["--name=minifia"], ["--env", "x"], [""]]) {
    const plan = planDeploy(extra);
    assert.equal(plan.ok, false);
    assert.ok(!("args" in plan));
  }
});

test("scripts/deploy.mjs 는 추가 인자(--name minifia)를 받으면 wrangler 를 띄우지 않고 종료 상태 1", () => {
  // 인자가 있을 때는 wrangler 를 실행하기 전에 끝나므로 오프라인·무부작용이다.
  const r = spawnSync(process.execPath, [`${ROOT}scripts/deploy.mjs`, "--name", "minifia"], { encoding: "utf8" });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /추가 인자/);
  assert.doesNotMatch(r.stdout + r.stderr, /wrangler\s+\d|Uploaded|Deployed/i);
});
