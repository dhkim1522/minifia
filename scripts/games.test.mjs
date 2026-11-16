// node --test scripts/games.test.mjs
// npm run games(23-02, D-17): 인자 가드·고정 SQL·한국어 요약·원격 계정 확인 순서.
// exec 는 wrangler 인자 배열만 받는 가짜 실행기다(실제 실행기는 셸 없이 node 로 wrangler 를 부른다).
import { test } from "node:test";
import assert from "node:assert/strict";
import { planGames, summarySql, formatSummary, runGames } from "./games.mjs";
import { EXPECTED_EMAIL } from "./check-account.mjs";

test("planGames: 인자 없음은 로컬·봇 제외, --remote·--all 은 각각 바꾼다", () => {
  assert.deepEqual(planGames([]), { ok: true, target: "local", includeBots: false });
  assert.deepEqual(planGames(["--local"]), { ok: true, target: "local", includeBots: false });
  assert.deepEqual(planGames(["--remote"]), { ok: true, target: "remote", includeBots: false });
  assert.deepEqual(planGames(["--all"]), { ok: true, target: "local", includeBots: true });
  assert.deepEqual(planGames(["--remote", "--all"]), { ok: true, target: "remote", includeBots: true });
});

test("planGames: --local 과 --remote 를 함께 주면 거부한다", () => {
  const p = planGames(["--local", "--remote"]);
  assert.equal(p.ok, false);
  assert.match(p.reason, /--local/);
});

test("planGames: 허용 목록 밖 인자는 사용법과 함께 거부한다(SQL·명령 주입 시도 포함)", () => {
  for (const bad of [["--command"], ["x; drop table games"], ["--remote", "--command=select 1"], ["--ALL"], [""]]) {
    const p = planGames(bad);
    assert.equal(p.ok, false, JSON.stringify(bad));
    assert.match(p.reason, /--local/);
    assert.match(p.reason, /--remote/);
    assert.match(p.reason, /--all/);
  }
});

test("summarySql: 고정 문자열 둘 중 하나, 봇 제외일 때만 has_bots 조건이 있다", () => {
  const excluded = summarySql(false);
  const all = summarySql(true);
  assert.notEqual(excluded, all);
  assert.match(excluded, /has_bots = 0/);
  assert.doesNotMatch(all, /has_bots/);
  for (const sql of [excluded, all]) {
    assert.match(sql, /FROM games/);
    assert.doesNotMatch(sql, /\?|\$\{/);
  }
  // 호출마다 같은 문자열(상수)
  assert.equal(summarySql(false), excluded);
});

test("formatSummary: 한국어 요약 한 화면", () => {
  const out = formatSummary([
    { games: 10, mafia_win_rate: 0.6, avg_duration_s: 754, first_day_caught_rate: 0.25, probe_success_rate: 0.5, avg_players: 5.5 },
  ]);
  assert.match(out, /판 10/);
  assert.match(out, /마피아 승률 60%/);
  assert.match(out, /평균 길이 12분 34초/);
  assert.match(out, /첫날 잡힘 25%/);
  assert.match(out, /떠보기 성공 50%/);
  assert.match(out, /평균 인원 5\.5명/);
});

test("formatSummary: 0판이거나 행이 없으면 '아직 기록이 없어요'", () => {
  assert.equal(formatSummary([{ games: 0, mafia_win_rate: null }]), "아직 기록이 없어요");
  assert.equal(formatSummary([]), "아직 기록이 없어요");
  assert.equal(formatSummary(undefined), "아직 기록이 없어요");
});

const WHOAMI_OK = `You are logged in with an OAuth Token, associated with the email ${EXPECTED_EMAIL}.`;
const WHOAMI_OTHER = "You are logged in with an OAuth Token, associated with the email someone@example.com.";
const D1_JSON = JSON.stringify([
  { results: [{ games: 2, mafia_win_rate: 0.5, avg_duration_s: 60, first_day_caught_rate: 0, probe_success_rate: 1, avg_players: 4 }], success: true },
]);

test("runGames: 로컬은 셸 없이 인자 배열로 wrangler d1 execute 를 한 번 부른다", () => {
  const calls = [];
  const exec = (args) => {
    calls.push({ args });
    return { status: 0, stdout: D1_JSON, stderr: "" };
  };
  const r = runGames({ ok: true, target: "local", includeBots: false }, { exec });
  assert.equal(r.ok, true);
  assert.match(r.output, /판 2/);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].args.slice(0, 5), ["d1", "execute", "DB", "--local", "--json"]);
  assert.equal(calls[0].args[5], "--command");
  assert.equal(calls[0].args[6], summarySql(false));
  assert.equal(calls[0].args.length, 7);
});

test("runGames: 원격은 먼저 whoami 를 부르고 개인 계정일 때만 d1 execute 를 부른다", () => {
  const calls = [];
  const exec = (args) => {
    calls.push(args.slice(0, 2).join(" "));
    return args[0] === "whoami" ? { status: 0, stdout: WHOAMI_OK, stderr: "" } : { status: 0, stdout: D1_JSON, stderr: "" };
  };
  const r = runGames({ ok: true, target: "remote", includeBots: true }, { exec });
  assert.equal(r.ok, true);
  assert.deepEqual(calls, ["whoami", "d1 execute"]);
});

test("runGames: 원격에서 개인 계정이 아니면 d1 execute 를 부르지 않고 실패한다", () => {
  const calls = [];
  const exec = (args) => {
    calls.push(args.slice(0, 2).join(" "));
    return { status: 0, stdout: WHOAMI_OTHER, stderr: "" };
  };
  const r = runGames({ ok: true, target: "remote", includeBots: false }, { exec });
  assert.equal(r.ok, false);
  assert.match(r.reason, /개인 계정이 아님/);
  assert.deepEqual(calls, ["whoami"]);
});

test("runGames: wrangler 실패나 읽을 수 없는 출력은 실패로 돌려준다", () => {
  const failed = runGames({ ok: true, target: "local", includeBots: false }, { exec: () => ({ status: 1, stdout: "", stderr: "boom" }) });
  assert.equal(failed.ok, false);
  const garbled = runGames({ ok: true, target: "local", includeBots: false }, { exec: () => ({ status: 0, stdout: "not json", stderr: "" }) });
  assert.equal(garbled.ok, false);
});

test("runGames: plan 이 거부 상태이면 아무것도 실행하지 않는다", () => {
  let n = 0;
  const r = runGames({ ok: false, reason: "x" }, { exec: () => (n++, { status: 0, stdout: "", stderr: "" }) });
  assert.equal(r.ok, false);
  assert.equal(n, 0);
});
