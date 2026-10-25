// 범위 좁힌 타입 검사 게이트(scripts/tsc-scoped.mjs)의 판정 규칙 테스트. node --test scripts/tsc-scoped.test.mjs
import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluate } from "./tsc-scoped.mjs";

const SCOPE = "^shared/";

test("상태 0 이면 출력과 무관하게 통과", () => {
  const r = evaluate({ status: 0, output: "shared/x.ts(1,1): error TS2322: nope\n", scope: SCOPE });
  assert.equal(r.ok, true);
});

test("상태 1 이고 범위 밖 파일 오류만 있으면 통과", () => {
  const output = "src/a.ts(3,5): error TS2322: Type 'string' is not assignable to type 'number'.\n";
  const r = evaluate({ status: 1, output, scope: SCOPE });
  assert.equal(r.ok, true);
  assert.deepEqual(r.inScope, []);
});

test("상태 1 이고 범위 안 파일 오류가 있으면 실패하고 inScope 에 그 줄이 담긴다", () => {
  const line = "shared/x.ts(1,1): error TS2322: Type 'string' is not assignable to type 'number'.";
  const r = evaluate({ status: 1, output: `src/a.ts(3,5): error TS2322: x\n${line}\n`, scope: SCOPE });
  assert.equal(r.ok, false);
  assert.deepEqual(r.inScope, [line]);
});

test("무시 정규식: 무시 대상 파일 오류만 있으면 통과, 다른 범위 안 파일 오류가 섞이면 실패", () => {
  const scope = "^(shared|test/unit)/";
  const ignore = "^test/unit/view\\.test\\.ts";
  const onlyIgnored = "test/unit/view.test.ts(9,1): error TS2339: x\ntest/unit/view.test.ts(12,1): error TS2339: y\n";
  assert.equal(evaluate({ status: 1, output: onlyIgnored, scope, ignore }).ok, true);
  const mixed = `${onlyIgnored}test/unit/claim.test.ts(1,1): error TS2305: z\n`;
  const r = evaluate({ status: 1, output: mixed, scope, ignore });
  assert.equal(r.ok, false);
  assert.equal(r.inScope.length, 1);
});

test("경로 없는 전역 오류 줄은 실패", () => {
  assert.equal(
    evaluate({ status: 1, output: "error TS5058: The specified path does not exist: 'x'.\n", scope: SCOPE }).ok,
    false,
  );
  assert.equal(
    evaluate({
      status: 1,
      output: "error TS2688: Cannot find type definition file for 'vite/client'.\nsrc/a.ts(1,1): error TS2322: x\n",
      scope: SCOPE,
    }).ok,
    false,
  );
});

test("경로 형식이어도 설정 오류 코드(TS5000~TS6999)면 실패", () => {
  assert.equal(
    evaluate({ status: 1, output: "tsconfig.app.json(1,1): error TS5083: Cannot read file 'x'.\n", scope: SCOPE }).ok,
    false,
  );
  assert.equal(
    evaluate({ status: 2, output: "src/a.ts(1,1): error TS6046: Argument for '--x' option must be: y.\n", scope: SCOPE }).ok,
    false,
  );
});

test("상태 1 인데 오류 줄이 하나도 없으면 실패", () => {
  assert.equal(evaluate({ status: 1, output: "", scope: SCOPE }).ok, false);
  assert.equal(evaluate({ status: 1, output: "something odd\n", scope: SCOPE }).ok, false);
});

test("상태가 null·3·undefined(실행 실패·신호·알 수 없음)이면 실패", () => {
  const output = "src/a.ts(3,5): error TS2322: x\n";
  for (const status of [null, 3, undefined]) {
    assert.equal(evaluate({ status, output, scope: SCOPE }).ok, false, `status=${status}`);
  }
});

test("윈도우식 경로도 정규화되어 범위에 걸린다", () => {
  const r = evaluate({ status: 1, output: "shared\\game\\x.ts(1,1): error TS2322: x\n", scope: SCOPE });
  assert.equal(r.ok, false);
  assert.equal(r.inScope.length, 1);
});

test("오류 메시지의 들여쓴 이어지는 줄은 오류 줄로 세지 않는다", () => {
  const output = "src/a.ts(3,5): error TS2322: Type 'a' is not assignable.\n  Type 'b' is not assignable to type 'c'.\n";
  assert.equal(evaluate({ status: 1, output, scope: SCOPE }).ok, true);
});
