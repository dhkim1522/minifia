---
phase: 06-world-skeleton
plan: 23
subsystem: testing
tags: [e2e, reconnect, deployhold, websocket, gap-closure, tdd]

requires:
  - phase: 06-world-skeleton
    provides: "06-18 reconnect·deployhold E2E 흐름, 06-22 NT3·이름표 판정(건드리지 않음), 진단 .planning/debug/reconnect-banner-deployed.md"
provides:
  - "dropSockets: 앱 방 소켓마다 합성 close(code 1006, wasClean false)를 먼저 dispatch 하고 ws.close() — 배포 서버의 약 10초 close 지연에 의존하지 않음"
  - "deployObservedOf(전, 후) / deployHoldChecks(rounds, { local }): 배포 주소는 /api/health version 변화가 있을 때만 RC5·RC1~RC4 + DH1, 없으면 DH0 미확인 참고 행"
  - "readLinkState().roomSockets, DEPLOY_REAL_OBSERVE_MS(120초) — 6분 띠 대기 제거"
  - "(선택 위생) worker webSocketClose 가 1005·1006 을 뺀 close 를 try/catch 로 맞받아침"
affects: [다음 v2 배포 때 사용자 확인(UAT 테스트 1·6), 06-UAT G-06-6]

actuals:
  tokens: 5300
  tasks: 3
  commits: 6
plan_head_before: a41c9d86c07bfcdebd052dfaf060df03911504fa
plan_head_after: d0063d057061004119a473a57551cf3ef3658988

tech-stack:
  added: []
  patterns:
    - "배포 신호가 있을 때만 배포 주소 판정을 하고, 신호가 없으면 통과가 아니라 info 참고 행(DH0)으로 남긴다"
    - "단절 흉내는 합성 close 를 먼저 보내 서버 핸드셰이크 속도와 분리한다"

key-files:
  created:
    - test/worker/webSocketClose.test.ts
  modified:
    - scripts/e2e/browser.mjs
    - scripts/e2e/lib.mjs
    - scripts/e2e/flows.mjs
    - scripts/e2e/lib.test.mjs
    - worker/room.ts

key-decisions:
  - "제품 연결 코드(src/net)는 바꾸지 않는다 — 진단상 제품 띠는 정상이고 원인은 하네스(dropSockets 가 서버 close 지연에 의존, deployhold 가 배포에서 띠를 기대)"
  - "배포 신호는 /api/health version 변화 하나뿐이다. 같은 커밋 재배포는 신호가 없어 DH0 미확인이 되며 의도한 보수적 동작이다"
  - "deployhold 로컬 갈래(10회·40초·touchWorkerFile·DH0)는 판정 호출만 deployHoldChecks 로 바꾸고 동작은 그대로 둔다"

patterns-established:
  - "info:true 행은 통과로 세지 않는 참고 행이며 recOne 이 통과여도 내용을 남긴다"

requirements-completed: [CONN-04, MAP-05]

duration: 14min
completed: 2026-11-01
status: complete
---

# Phase 6 Plan 23: E2E 하네스 배포본 단절·배포 직후 판정 수정 Summary

**dropSockets 가 합성 close(1006)를 먼저 보내 배포 서버의 10초 close 지연과 무관하게 재접속 띠를 즉시 띄우고, deployhold 는 배포 주소에서 6분 띠 대기를 버리고 /api/health version 변화가 있을 때만 소켓 유지·위치·콘솔을 판정한다 (G-06-6)**

## Performance

- **Duration:** 약 14분 (17:40경 ~ 17:54 KST)
- **Tasks:** 3 (Task 3 선택 위생 포함 수행)
- **Files modified:** 6 (제품 코드 없음, 서버 위생 1곳)

## Accomplishments

- **Task 1 (트레이서):** `dropSockets` 가 앱 방 소켓(`/api/rooms/`, readyState 0·1)마다 `CloseEvent("close", { code: 1006, wasClean: false })` 를 먼저 dispatch 한 뒤 `ws.close()`. 단위 테스트 3개로 순서·제외 대상·반환 수를 고정. 로컬 `--only reconnect` 전체 35/35 통과, offline 종류 10/10 띠를 보고(RC6) 복구(RC5), frozen·reload·lose·lose-idle 도 이전과 같이 통과.
- **Task 2:** `deployObservedOf`·`deployHoldChecks` 추가(단위 테스트 6개), `readLinkState` 에 `roomSockets`, `deployHoldFlow` 의 배포 주소 갈래를 관찰 창 120초 + health version 앞뒤 비교 + 소켓 유지 측정으로 교체. 신호가 없으면 DH0 `info` 참고 행(통과로 세지 않음). 로컬 `--only deployhold` 는 이전과 같이 DH0 미확인 행으로 끝남(3/3, FAIL 없음).
- **Task 3 (선택, 수행):** `webSocketClose(ws, code, reason, wasClean)` 가 `handleDisconnect` 를 먼저 끝내고 1005·1006 이 아니면 `ws.close(code, reason)` 를 try/catch 로 호출. 워커 테스트 3개. Task 3 을 건너뛰어도 G-06-6 은 닫힌 것이며, 닫는 몫은 Task 1·2 의 하네스 수정이다.
- 전체 게이트: vitest 3733 통과(1건은 `CAMERA_PRINT=1` 일 때만 도는 06-03 의 기존 `describe.runIf` 출력 블록이며 `.skip`/`.todo` 가 아님), typecheck 통과, `node --test scripts/e2e/lib.test.mjs scripts/*.test.mjs` 280/280, `git grep` `.skip(`·`.todo(` 0건, 빌드 메인 청크 `index-*.js` 에 WebGLRenderer 없음, `git diff 179880c -- src/net` 없음.

## Task Commits

1. **Task 1 RED** - `12b66d2` (test) / **GREEN** - `4d770d3` (feat)
2. **Task 2 RED** - `ff91e31` (test) / **GREEN** - `1abe748` (feat)
3. **Task 3 RED** - `ec6765e` (test) / **GREEN** - `d0063d0` (feat)

**Plan metadata:** 이 SUMMARY 와 함께 커밋 (docs: complete plan)

## TDD Gate Compliance

세 task 모두 `test(06-23)` RED → `feat(06-23)` GREEN 순서. RED 증거는 `gsd_run check tdd-red-evidence` 로 `RED_EVIDENCE_OK`(target_test_failed)를 받았다.

- Task 1 RED: `dropSockets: 앱 방 소켓(열림·연결 중)마다 합성 close …` 가 "dispatch 없이 close 만 호출됨" 으로 단언 실패(의미 평가: 의도한 이유로 실패).
- Task 2 RED: 모듈 연결 오류로는 INVALID_RED 라서 lib.mjs 에 컴파일용 임시 뼈대(빈 결과 반환)만 두어 6개 테스트가 단언으로 실패하게 했다. 뼈대는 RED 커밋에 함께 있고 GREEN 에서 구현으로 교체됨.
- Task 3 RED: `ws.close` 호출 0회로 단언 실패.

## Files Created/Modified

- `scripts/e2e/browser.mjs` - 합성 close 를 먼저 보내는 dropSockets, readLinkState.roomSockets, 머리 주석
- `scripts/e2e/lib.mjs` - deployObservedOf, deployHoldChecks (DH0/DH1)
- `scripts/e2e/flows.mjs` - 배포 주소 관찰 창·health version·소켓 유지 측정을 쓰는 deployHoldFlow, recOne 의 info 행 keep 처리, DEPLOY_REAL_WAIT_MS 제거
- `scripts/e2e/lib.test.mjs` - dropSockets 3개, deployObservedOf/deployHoldChecks 6개
- `worker/room.ts` - webSocketClose 맞받아치기(위생)
- `test/worker/webSocketClose.test.ts` - 위 규칙 고정 3개

## Decisions Made

계획대로. 배포 신호를 health version 변화로만 정의한 보수적 선택(같은 커밋 재배포는 미확인)을 유지했다.

## Deviations from Plan

None - plan executed exactly as written. (`browser.mjs` 를 테스트에서 import 해도 playwright-core 는 import 만 하고 브라우저를 띄우지 않아 계획의 대체 경로는 필요 없었다. Task 2 RED 의 임시 뼈대는 계획이 허용한 "컴파일 가능한 RED" 범위의 처리다.)

## Issues Encountered

None. 로컬 개발 서버는 이 계획이 띄웠고 E2E 후 껐다.

## 배포본 확인은 남아 있다 (사용자, 다음 v2 배포 때)

이 환경에서는 배포도, 배포 주소(minifia-v2)·v1.0 주소로의 E2E 도 하지 않았다. 따라서 **배포 주소 갈래는 단위 테스트만 거쳤고 실제 확인은 다음 v2 배포 때** 사용자가 한다.

- 배포 주소에서 `npm run e2e -- --only reconnect` 를 돌려 offline 10/10 띠(RC6)가 뜨는지 본다(UAT 테스트 6).
- 배포와 함께 `npm run e2e -- --only deployhold` 를 돌린다. 관찰 창 120초 안에 배포가 들어가 health version 이 바뀌면 DH1 등이 판정되고, 아니면 DH0 미확인 행이 나온다(통과 아님).
- Task 3 의 서버 맞받아치기 효과도 배포 없이는 검증할 수 없다(진단 문서).

## Known Stubs

None.

## Threat Flags

None. 새 네트워크 표면은 없다(E2E 하네스가 대상 주소의 기존 `/api/health` 를 읽는 것뿐이며 배포 주소로는 실행하지 않았다).

## Next Phase Readiness

06 페이즈의 갭 클로저 계획이 모두 끝났다. 남은 것은 다음 v2 배포 때의 사용자 확인(UAT 테스트 1·6)과 verify 단계다. `phase.complete` 는 실행하지 않았다.

## Self-Check: PASSED

- 파일 존재: browser.mjs·lib.mjs·flows.mjs·lib.test.mjs·room.ts·webSocketClose.test.ts 확인
- 커밋 존재: 12b66d2, 4d770d3, ff91e31, 1abe748, ec6765e, d0063d0 확인(`git rev-list --count a41c9d8..HEAD` = 6)
- 인수 기준: wasClean/CloseEvent, dropSockets≥2, deployHoldChecks 함수·호출·테스트≥2, DEPLOY_REAL_WAIT_MS 0, roomSockets, deployObservedOf·api/health, `ws.close(code`, 테스트 파일, `src/net` 불변, RED 커밋 3개 모두 통과

---
*Phase: 06-world-skeleton*
*Completed: 2026-11-01*
