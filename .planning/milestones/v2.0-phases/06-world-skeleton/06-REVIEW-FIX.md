---
phase: 06-world-skeleton
fixed_at: 2026-11-01T14:40:00+09:00
review_path: .planning/phases/06-world-skeleton/06-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 6
skipped: 0
status: all_fixed
---

# Phase 6: Code Review Fix Report

**Fixed at:** 2026-11-01
**Source review:** .planning/phases/06-world-skeleton/06-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 6 (CR-01, WR-01 ~ WR-05. 사용자 승인 범위. IN-01 ~ IN-06 은 범위 밖이라 고치지 않았다)
- Fixed: 6
- Skipped: 0

**검증 위치:** `workflow.use_worktrees=false` 라 격리 worktree 없이 메인 체크아웃(`/Users/dhkim1522/personal/minifia`, 브랜치 `v2`)에서 고치고 검증했다. 아래 수치는 이 체크아웃에서 그대로 재현된다.

**마무리 검증(모두 통과):**
- `npx vitest run` — 137 파일, 3710 통과 · 1 건너뜀
- `npm run typecheck` — 통과
- `node --test scripts/e2e/lib.test.mjs` — 219 통과 (`node --test scripts/*.test.mjs` 48 통과도 확인)
- `npm run build` — 통과, `dist/client/assets/index-haVRrznm.js` 에 `WebGLRenderer` 없음
- Cloudflare 계정을 건드리는 명령(`npm run deploy`, wrangler deploy)과 `minifia.dhplay.workers.dev` 요청은 하지 않았다. 모든 테스트는 오프라인이다.

## Fixed Issues

### CR-01: `assertNotV1` 이 끝 점이 붙은 호스트로 우회된다

**Files modified:** `scripts/deploy-target.mjs`, `scripts/deploy-target.test.mjs`, `scripts/e2e/lib.test.mjs`
**Commit:** a9707d9
**Applied fix:** 호스트 비교 전에 끝 점을 지운다(`replace(/\.+$/, "")`). 테스트가 `https://minifia.dhplay.workers.dev.`, 경로·포트·대문자·여러 끝 점·`%2e`·전각 마침표·사용자 정보 변형을 모두 거부하고, v2(`minifia-v2`, 끝 점 포함)와 이름만 접두로 공유하는 다른 도메인은 통과시킴을 고정한다. e2e `resolveTarget` 도 끝 점 v1 주소를 거부한다. 수정 전 새 케이스 7 개가 실패함을 확인했다.

### WR-01: 프레임 루프에 예외 방어가 없다

**Files modified:** `src/world/runtime.ts`, `test/client/worldStage.test.tsx`
**Commit:** 60fa788
**Applied fix:** `frame()` 을 `try { drawFrame(r) } catch { reportFrameError } finally { schedule() }` 로 나눴다. 한 프레임이 던져도 다음 프레임이 예약된다. 오류 로그는 1초에 한 번만 낸다. 테스트: 렌더가 한 번 던진 뒤에도 rAF 가 예약되고 다음 프레임에 그리기가 이어짐, 매 프레임 던져도 루프가 살아 있고 로그가 5 회 미만임. 수정 전 실패 확인.
**상태:** fixed (오류 시 사용자에게 카드로 알리는 방식은 택하지 않았다. 리뷰의 두 안 중 "루프를 멈추지 않는다" 쪽이다.)

### WR-02: 숨은 탭에서도 소실 타이머가 돈다

**Files modified:** `src/world/runtime.ts`, `src/world/status.ts`, `test/unit/status.test.ts`, `test/client/worldStage.test.tsx`
**Commit:** a50547b
**Applied fix:** 1초 tick 핸들러가 `document.visibilityState === "hidden"` 이면 상태기계로 tick 을 보내지 않는다. 돌아오면 기존 `visible` 이벤트가 소실 시계를 그때부터 다시 센다. 리듀서의 `visible` 은 `recreating` 에서도 `lostAt` 을 옮기되 상태는 유지해 `shouldRecreate` 가 다시 참이 되지 않는다(재생성은 소실 한 번에 한 번, T-06-06). 이 때문에 기존 단위 테스트 "recreating 중 visible(true) 는 재생성 시계를 되돌리지 않는다" 의 기대를 의도적으로 바꿨다(재생성 횟수는 그대로 한 번). 테스트: 숨은 채 소실 후 20 초가 지나도 재생성·실패 카드가 없고 돌아온 3 초 뒤 재생성 한 번, 재생성 중 30 초 숨었다 돌아와도 실패로 굳지 않음. 수정 전 실패 확인.
**상태:** fixed: requires human verification (기존 테스트 기대를 바꾼 상태 전이 변경. `recreating` 중 복귀 시 5 초 포기 시계가 복귀 시점부터 다시 시작되는 것이 의도와 맞는지 확인 바람)

### WR-03: 닉네임 스키마 `max(64)` 와 8 자소 규칙 불일치

**Files modified:** `shared/nickname.ts`, `shared/schemas.ts`, `worker/index.ts`, `test/unit/nickname.test.ts`, `test/unit/schemas.test.ts`, `test/worker/http.test.ts`, `test/worker/join.test.ts`
**Commit:** 7e71d9c
**Applied fix:** 8 자소 제품 규칙은 그대로 두고 스키마 상한을 `NICKNAME_MAX_UTF16 = 256`(UTF-16 길이)으로 올렸다. `validateNickname` 도 같은 길이를 넘으면 `TOO_LONG` 을 돌려 클라이언트가 스키마에 걸릴 값을 미리 거른다. 그래도 상한을 넘은 닉네임이 서버에 오면 `BAD_REQUEST`("연결이 불안정해요") 대신 `NICKNAME_INVALID`(닉네임 칸 아래 "1~8자로 입력해 주세요")로 응답한다. 다른 형식 오류는 `BAD_REQUEST` 그대로다. 테스트: 가족 이모지 8 개(길이 88)는 방 만들기 201·합류 200, 9 개는 `NICKNAME_INVALID`, 300 자는 `NICKNAME_INVALID`. 수정 전 실패 확인.
**상태:** fixed

### WR-04: 클라이언트 탭 간격이 서버 `MOVE_MIN_GAP_MS` 와 같다

**Files modified:** `src/world/input.ts`, `test/unit/input.test.ts`, `test/client/worldStage.test.tsx`
**Commit:** 167f62a
**Applied fix:** `TAP_MIN_GAP_MS = MOVE_MIN_GAP_MS + TAP_GAP_MARGIN_MS`(150 + 100 = 250ms). 서버 검증은 건드리지 않아 판정 권한은 서버에 남는다. 테스트: 클라이언트 간격이 서버 간격보다 여유(100ms) 이상 크고, 연타를 게이트에 넣어 통과한 탭들의 최악 도착 어긋남에서도 서버 간격 아래로 내려가지 않음. 월드 스테이지 탭 무시 테스트도 250ms 기준으로 갱신했다.
**상태:** fixed (지터가 100ms 를 넘으면 드문 거짓 알림이 가능하다. 값은 `TAP_GAP_MARGIN_MS` 한 곳에서 조정한다.)

### WR-05: `npm run deploy -- <인자>` 로 배포 이름 가드가 우회된다

**Files modified:** `scripts/deploy.mjs`(새 파일), `scripts/deploy-target.test.mjs`, `package.json`, `docs/architecture.md`
**Commit:** 2f0974d
**Applied fix:** `deploy` 스크립트의 마지막 단계를 `wrangler deploy` 직접 호출에서 `node scripts/deploy.mjs` 로 바꿨다. 이 래퍼는 추가 인자가 있으면 아무것도 실행하지 않고 종료 상태 1 로 멈추며, wrangler 에는 고정 인자(`npx wrangler deploy`)만 넘긴다(argv 를 전달하지 않는다). 새 파일을 만든 것은 수정에 필요해서다(리뷰가 제안한 래퍼). 테스트: `package.json` 의 deploy 가 래퍼로 끝나고 `wrangler deploy` 를 직접 두지 않음, `planDeploy` 가 모든 추가 인자를 거부함, 실제 `node scripts/deploy.mjs --name minifia` 가 wrangler 를 띄우기 전에 종료 상태 1 로 끝남(인자가 있으면 wrangler 실행 전에 끝나므로 오프라인·무부작용). `docs/architecture.md` 의 배포 순서 설명도 맞췄다.
**상태:** fixed (직접 `npx wrangler deploy` 는 여전히 가드 밖이다. 리뷰도 사람이 의도해야 하는 경로로 보았다.)

## Skipped Issues

None. 범위 안 6 건은 모두 고쳤다. IN-01 ~ IN-06 은 사용자 지시에 따라 범위에서 제외해 건드리지 않았다.

---

_Fixed: 2026-11-01_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
