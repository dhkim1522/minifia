// node --test scripts/check-account.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { judgeWhoami, EXPECTED_EMAIL } from "./check-account.mjs";

const loggedIn = (email) => `Getting User settings...\n👋 You are logged in with an OAuth Token, associated with the email ${email}.\n🔐 Credentials are stored in: ...`;

test("개인 계정 이메일이면 통과", () => {
  const r = judgeWhoami(loggedIn(EXPECTED_EMAIL), 0);
  assert.equal(r.ok, true);
  assert.equal(r.email, EXPECTED_EMAIL);
});

test("대소문자만 다르면 통과", () => {
  assert.equal(judgeWhoami(loggedIn("Dhkim1522@Naver.com"), 0).ok, true);
});

test("다른 계정이면 멈춤", () => {
  const r = judgeWhoami(loggedIn("someone@example.com"), 0);
  assert.equal(r.ok, false);
  assert.equal(r.email, "someone@example.com");
});

test("로그아웃 상태(이메일 줄 없음)면 멈춤", () => {
  assert.equal(judgeWhoami("You are not authenticated. Please run `wrangler login`.", 0).ok, false);
});

test("wrangler 가 실패하면 멈춤", () => {
  assert.equal(judgeWhoami(loggedIn(EXPECTED_EMAIL), 1).ok, false);
  assert.equal(judgeWhoami("", null).ok, false);
});
