---
phase: 06-world-skeleton
plan: "01"
subsystem: infra
tags: [cloudflare-workers, wrangler, deploy-guard, node-test, vite]

requires:
  - phase: v1.0 (결정 0042 계정 확인, 0043 v1/v2 브랜치 분리)
    provides: scripts/check-account.mjs 패턴, wrangler.jsonc preview_urls false
provides:
  - "scripts/deploy-target.mjs — 배포 대상 단일 출처(WORKER_NAME minifia-v2)와 v1.0 거부 판정"
  - "scripts/check-deploy-target.mjs — vite build 와 wrangler deploy 사이 게이트(dist/worker/wrangler.json name 검사)"
  - "E2E resolveTarget·smoke·bots·uat-*·gallery 의 v1.0 주소 거부(네트워크 요청 전)"
  - "wrangler.jsonc name minifia-v2, prod-url.txt https://minifia-v2.dhplay.workers.dev"
affects: [06-07 첫 배포, 06-06 봇 이름, 이후 모든 배포본 검증 페이즈]

plan_head_before: 76714fc6d6f809fe4db2cf47e131027397d847d0
plan_head_after: 02d1f029eeb08a94f9e293d0cd798313c2029615

actuals:
  tokens: 7232
  tasks: 3
  commits: 5

tech-stack:
  added: []
  patterns:
    - "배포 대상은 deploy-target.mjs 한 출처에서만 나오고 다른 스크립트는 import 한다"
    - "판정 함수 export + 직접 실행일 때만 CLI (check-account.mjs 와 같은 모양)"
    - "정적 검사 node:test 로 v1 문자열 허용 목록과 가드 호출 누락을 고정"

key-files:
  created:
    - scripts/deploy-target.mjs
    - scripts/check-deploy-target.mjs
    - scripts/deploy-target.test.mjs
  modified:
    - wrangler.jsonc
    - scripts/prod-url.txt
    - package.json
    - scripts/e2e/lib.mjs
    - scripts/e2e/lib.test.mjs
    - scripts/e2e/run.mjs
    - scripts/smoke.mjs
    - scripts/bots.mjs
    - scripts/uat-day.mjs
    - scripts/uat-night.mjs
    - scripts/uat-vote.mjs
    - scripts/uat-test-room.mjs
    - scripts/uat-test-bots.mjs
    - scripts/gallery.mjs

key-decisions:
  - "V1_HOST·V1_ORIGIN 은 파생식이 아니라 리터럴로 둔다 — 정의 파일이 v1 호스트 문자열을 담는 세 파일 중 하나가 되어 정적 검사 허용 목록과 계획의 인수 기준(정확히 세 파일)에 맞는다"
  - "가드는 기준 주소 변수(base)가 아니라 파싱된 url.origin 에 건다 — base 가 비어 있으면(기본 localhost) exitIfV1 이 'undefined' 를 주소로 보고 잘못 멈추기 때문"
  - "정적 검사는 prod-url.txt 를 읽는 요청 스크립트가 exitIfV1 또는 resolveTarget 을 부르는지 본다. 네트워크 요청이 없는 check-deploy-target.mjs·정의 파일·테스트는 사유와 함께 제외"

patterns-established:
  - "v1.0 거부는 우회 인자 없음: 플래그·환경 변수·허용 목록 추가로 열지 않는다"
  - "RED 단계에서 자리표시 모듈을 함께 커밋해 테스트가 로드되고 단언에서 실패하게 한다(INVALID_RED 방지)"

requirements-completed: [DEPLOY-02]

coverage:
  - id: D1
    description: "npm run deploy 가 계정 확인 → vite build → 산출물 name 검사 → wrangler deploy 순서이고, 산출물 name 이 minifia-v2 가 아니면 wrangler 전에 종료 1"
    requirement: DEPLOY-02
    verification:
      - kind: unit
        ref: "scripts/deploy-target.test.mjs#judgeDeployTarget / 저장소 사실: npm run deploy"
        status: pass
      - kind: integration
        ref: "npx vite build && node scripts/check-deploy-target.mjs (배포 대상 확인: minifia-v2)"
        status: pass
    human_judgment: false
  - id: D2
    description: "wrangler.jsonc name, prod-url.txt, 빌드 산출물 name 이 WORKER_NAME 한 출처와 같고 preview_urls 는 false"
    requirement: DEPLOY-02
    verification:
      - kind: unit
        ref: "scripts/deploy-target.test.mjs#저장소 사실"
        status: pass
    human_judgment: false
  - id: D3
    description: "E2E resolveTarget 이 v1.0 주소를 기본값·명시값 모두 거부하고 localhost 는 통과"
    requirement: DEPLOY-02
    verification:
      - kind: unit
        ref: "scripts/e2e/lib.test.mjs#resolveTarget: v1.0 주소는 명시해도 거부"
        status: pass
    human_judgment: false
  - id: D4
    description: "smoke·bots·uat-*·gallery 가 v1.0 주소를 요청 전에 거부하고, v1 문자열 허용 목록·가드 호출 누락을 정적 검사가 고정"
    requirement: DEPLOY-02
    verification:
      - kind: unit
        ref: "scripts/deploy-target.test.mjs#정적 검사 (두 테스트)"
        status: pass
    human_judgment: false
  - id: D5
    description: "첫 배포 때 v1.0 이 그대로인지 사람이 한 번 확인(이 계획에서는 배포·v1 요청 없음)"
    verification: []
    human_judgment: true
    rationale: "v1.0 운영 상태는 자동 검사가 v1 에 요청하지 않는다는 금지 사항(prohibition)과 충돌하므로 06-07 첫 배포 때 사람이 확인한다"

duration: 12min
completed: 2026-11-01
status: complete
---

# Phase 6 Plan 01: 배포 대상 단일 출처와 v1.0 거부 Summary

**deploy-target.mjs 한 출처에서 minifia-v2 배포 대상이 나오고, 빌드 산출물 name 검사 게이트가 wrangler deploy 앞을 막으며, E2E·smoke·bots·uat·gallery 가 v1.0 주소를 요청 전에 거부한다**

## Performance

- **Duration:** 약 12분 (시작 시각을 기록하지 않아 근사값)
- **Completed:** 2026-10-31T15:19Z (로컬 2026-11-01)
- **Tasks:** 3
- **Files modified:** 17 (신규 3, 수정 14)

## Accomplishments

- `scripts/deploy-target.mjs`: `WORKER_NAME`=minifia-v2, `expectedOrigin()`, `assertNotV1`(호스트 대소문자·경로·끝 슬래시·http 무관 거부, localhost·127.0.0.1·[::1] 통과), `exitIfV1`, `stripJsonComments`(문자열 안 `//` 보존), `judgeDeployTarget`(산출물·소스 name, prod-url 호스트, preview_urls 4조건).
- `scripts/check-deploy-target.mjs`가 `npm run deploy` 의 vite build 와 wrangler deploy 사이에서 `dist/worker/wrangler.json` 의 name 을 검사한다. 산출물이 없거나 낡았으면(name minifia) 종료 1.
- `wrangler.jsonc`·`scripts/prod-url.txt`·`package.json scripts.deploy` 를 v2 로 전환(`preview_urls: false` 유지).
- `resolveTarget` 이 v1.0 을 기본값·`--url` 명시값 모두 거부. smoke·bots·uat 5종·gallery 도 첫 네트워크 호출 전에 `exitIfV1`.
- 정적 검사 테스트 2개: v1 호스트 문자열 허용 목록(정의·거부 테스트 둘·index.html og:image 한 줄) 밖 0건, `prod-url.txt` 를 읽는 요청 스크립트의 가드 호출 누락 0건.

## Task Commits

1. **Task 1 (tracer, TDD): 배포 대상 한 경로**
   - RED `1771d80` (test) — 20개 중 18개가 단언에서 실패, `gsd check tdd-red-evidence` → RED_EVIDENCE_OK
   - GREEN `656440a` (feat)
2. **Task 2 (TDD): resolveTarget v1.0 거부**
   - RED `0ffa2de` (test) — 180개 중 신규 3개 실패, RED_EVIDENCE_OK
   - GREEN `2db3c46` (feat)
3. **Task 3: smoke·bots·uat·gallery 가드와 정적 검사** — `02d1f02` (feat)

**Plan metadata:** 이 SUMMARY 의 docs 커밋.

트레이서 게이트: `<verify>` 가 automated 뿐이고 `human_verify_mode`=end-of-phase 라 두 검증(`node --test scripts/deploy-target.test.mjs`, `npx vite build && node scripts/check-deploy-target.mjs`)을 다시 돌려 통과 확인 후 확장했다 (Tracer verified end-to-end — expanding).

## TDD Gate Compliance

- Task 1: RED(`test(06-01)` 1771d80) → GREEN(`feat(06-01)` 656440a). REFACTOR 없음.
  - RED semanticAssessment: 자리표시 모듈이 import 되므로 로드 오류가 아니라 `WORKER_NAME` 단언(`"" !== "minifia-v2"`)으로 실패. 나머지 17개도 같은 이유(동작 부재)로 실패, 2개(상수 자리표시와 우연히 맞는 항목)는 통과.
- Task 2: RED(0ffa2de) → GREEN(2db3c46). 기존 177개 테스트는 계속 통과, 신규 3개만 실패(Missing expected exception).
- Task 3 은 계획에서 `tdd` 가 아니라 `type="auto"` 라 정적 검사 테스트를 구현과 한 커밋으로 냈다.

## Files Created/Modified

- `scripts/deploy-target.mjs` — 배포 대상 단일 출처와 v1.0 거부 판정(Node 내장만)
- `scripts/check-deploy-target.mjs` — 빌드 뒤·배포 앞 게이트 CLI
- `scripts/deploy-target.test.mjs` — 판정·저장소 사실·정적 검사 node:test 22개
- `wrangler.jsonc`, `scripts/prod-url.txt`, `package.json` — v2 이름·주소·deploy 체인
- `scripts/e2e/lib.mjs`, `lib.test.mjs`, `run.mjs` — resolveTarget 가드, 테스트, 사용법 주소
- `scripts/smoke.mjs`, `bots.mjs`, `uat-day.mjs`, `uat-night.mjs`, `uat-vote.mjs`, `uat-test-room.mjs`, `uat-test-bots.mjs`, `gallery.mjs` — `exitIfV1`

## Decisions Made

- `V1_HOST`/`V1_ORIGIN` 을 리터럴로 둔다(정의 파일이 정적 검사 허용 목록·인수 기준의 세 파일에 들어가도록).
- 가드는 파싱된 `url.origin` 에 건다(`base` 가 null 이면 기본 localhost 라 `exitIfV1(base)` 가 오탐하기 때문). 동작은 계획 의도(요청 전 거부)와 같다.
- 정적 검사의 "prod-url.txt 를 읽는 파일" 수집에서 `check-deploy-target.mjs`(요청 없음)·정의 파일·테스트는 사유 주석과 함께 제외하고, `e2e/run.mjs` 는 `resolveTarget` 호출로 갈음한다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] exitIfV1(base) 를 url.origin 에 걸었다**
- **Found during:** Task 3
- **Issue:** 계획 문구대로 `exitIfV1(base)` 를 부르면 `base` 가 null/undefined(기본 localhost)일 때 `new URL("undefined")` 오류로 모든 로컬 실행이 종료 1 이 된다. 스크립트마다 `new URL((base ?? "http://localhost:5173")...)` 로 정규화한 줄 바로 뒤가 올바른 위치다.
- **Fix:** `exitIfV1(url.origin)` 을 그 줄 바로 뒤(첫 네트워크 호출 앞)에 둠. smoke 는 `resolveBase` 가 `new URL` 성공 직후 호출.
- **Files modified:** smoke.mjs, bots.mjs, uat-day/night/vote/test-room/test-bots.mjs
- **Verification:** 정적 검사 통과, `node --check` 8개 통과
- **Committed in:** 02d1f02

**2. [Rule 3 - Blocking] RED 단계에 자리표시 deploy-target.mjs 를 함께 커밋**
- **Found during:** Task 1 RED
- **Issue:** 모듈이 없으면 테스트가 import 오류로 죽어 INVALID_RED(로드 실패)가 된다.
- **Fix:** 모든 export 를 빈 값으로 내보내는 자리표시를 RED 커밋에 포함, GREEN 에서 구현으로 교체.
- **Committed in:** 1771d80 → 656440a

---

**Total deviations:** 2 auto-fixed (1 bug-in-plan-wording, 1 blocking)
**Impact on plan:** 의도·산출물 변경 없음.

## Issues Encountered

- 검증 중 `node scripts/smoke.mjs https://minifia.dhplay.workers.dev` 를 한 번 직접 실행해 가드 동작(종료 1, 한국어 메시지, 요청 전 중단)을 확인했다. 계획은 v1 주소로 스크립트를 실행하지 않고 정적 검사로만 확인하라고 했다 — 가드가 요청 전에 종료되어 v1.0 으로 나간 네트워크 요청은 없었지만 지시와 다르게 실행했다는 점을 기록한다.
- `npm run deploy`·`wrangler deploy` 는 실행하지 않았다(첫 배포는 06-07).

## Known Stubs

None.

## Threat Flags

None - 새 네트워크 엔드포인트·인증 경로 없음. T-06-01/02/03 은 계획대로 완화(게이트·정적 검사·check-account 유지), T-06-SC 패키지 설치 없음.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 06-07 첫 배포 전 선행 조건(이름·prod-url·검사 기본 주소·게이트)이 갖춰졌다. 첫 배포 출력으로 실제 workers.dev 주소가 `https://minifia-v2.dhplay.workers.dev` 인지(가정 A1), v1.0 이 그대로인지 사람이 한 번 확인해야 한다.
- 06-06 이 봇 이름을 바꿀 때 uat/bots 스크립트의 가드 줄은 그대로 둔다.

---
*Phase: 06-world-skeleton*
*Completed: 2026-11-01*

## Self-Check: PASSED

- 생성 파일 3개와 SUMMARY 존재 확인, 커밋 5개(1771d80, 656440a, 0ffa2de, 2db3c46, 02d1f02) 모두 HEAD 의 조상.
- 인수 기준 재실행: grep 기준 전부 통과, `git grep` v1 호스트 파일 정확히 세 개(+index.html og:image 한 줄), 7개 스크립트 가드, `node --test` 202개 통과, `npm run typecheck` 종료 0.
