---
phase: 01-walking-skeleton
plan: 01
subsystem: infra
tags: [cloudflare-workers, durable-objects, vite, react, vitest, wrangler, typescript]

requires: []
provides:
  - "고정 버전 의존성(package.json + package-lock.json)과 dev/build/test/typecheck/deploy/cf-typegen 스크립트"
  - "wrangler.jsonc: Worker minifia, compatibility_date 2026-10-12, 정적 에셋 SPA 폴백, /api/* Worker 우선, ROOM 바인딩, Room 선언(exports)"
  - "빈 Room Durable Object 와 GET /api/health, 알 수 없는 /api/* 의 NOT_FOUND JSON"
  - "vitest unit / client / worker 세 프로젝트와 앱·워커 분리 tsconfig 타입체크"
  - "첫 화면(minifia 제목 + 빌드 버전)과 D-20 색·글꼴·모션 토큰"
  - "결정 기록 0009 (Worker 이름, DO 선언 방식, 고정 버전)"
affects: [01-02, 01-03, 01-04, 01-05, 01-06, 01-07, 01-08, 01-09, 01-10]

actuals:
  tokens: 4700
  tasks: 3
  commits: 1
plan_head_before: 82f623f70779430e17377bed78a4ee9636f1dc19
plan_head_after: b1c33e2c85f20b9a7f4856a5c1007cf12e12f1ad

tech-stack:
  added: [react 19.3.1, react-dom 19.3.1, zod 4.6.7, vite 8.3.5, "@vitejs/plugin-react 6.1.2", "@cloudflare/vite-plugin 1.64.0", wrangler 4.151.3, typescript 7.0.2, vitest 4.1.12, "@cloudflare/vitest-plugin 1.4.6", "@testing-library/react 16.3.3", "@testing-library/dom 10.4.2", happy-dom 21.0.4, "@types/react 19.3.0", "@types/react-dom 19.3.0"]
  patterns:
    - "순수 코어(shared/) + 얇은 Durable Object 어댑터(worker/) + 표현 중심 React(src/)"
    - "shared/ 는 앱·워커 두 tsconfig 에 모두 들어가 DOM·workerd 전용 API 를 쓰지 못한다"
    - "빌드 버전은 vite define(__APP_VERSION__)으로 앱·워커 번들 양쪽에 주입, 없으면 dev"
    - "passWithNoTests 를 켜지 않아 파일 필터가 비면 검증이 실패한다"

key-files:
  created:
    - package.json
    - package-lock.json
    - wrangler.jsonc
    - vite.config.ts
    - vitest.config.ts
    - tsconfig.json
    - tsconfig.app.json
    - tsconfig.worker.json
    - index.html
    - src/main.tsx
    - src/App.tsx
    - src/styles/tokens.css
    - shared/version.ts
    - worker/index.ts
    - worker/room.ts
    - test/unit/version.test.ts
    - test/client/app.test.tsx
    - test/worker/health.test.ts
    - docs/decisions/0009-worker-identity-and-toolchain.md
  modified:
    - .gitignore
    - docs/architecture.md

key-decisions:
  - "Worker 이름 minifia + exports 선언(option-a) — 사용자 결정, 이름은 공개 주소이고 exports 는 배포 후 migrations 로 되돌릴 수 없다"
  - "SUS(too-new) 10개 패키지를 리서치가 검증한 정확한 버전 그대로 설치 — 사용자 승인(approved), 낮춘 패키지 없음"
  - "compatibility_date 2026-10-12 고정 — 로컬 vite dev 의 workerd(1.20261012.1)가 지원하는 날짜 이하여야 한다"
  - "@cloudflare/vitest-pool-workers 대신 @cloudflare/vitest-plugin, @cloudflare/workers-types 는 설치하지 않음(wrangler types 로 대체), PWA·린터는 1페이즈에서 제외"

patterns-established:
  - "하나의 버전 문자열(UTC 시각+커밋 해시)이 첫 화면 푸터와 /api/health 응답에 같이 나온다 — 재배포 후 새 버전 확인 수단"
  - "토큰 CSS 변수(--night-*, --gray-*, --crimson-*, --dur-*, --z-*)가 이후 모든 화면의 색·모션 기준"

requirements-completed: [DEPLOY-01]

coverage:
  - id: D1
    description: "npm run build 가 dist/client 와 dist/worker/wrangler.json 을 만들고, 로그인 없이 npx wrangler deploy --dry-run 이 ROOM Durable Object 바인딩과 함께 성공한다"
    requirement: DEPLOY-01
    verification:
      - kind: integration
        ref: "npm run build && npx wrangler deploy --dry-run (env.ROOM (Room) Durable Object 출력)"
        status: pass
    human_judgment: false
  - id: D2
    description: "vitest 가 unit·client·worker 세 프로젝트에서 각각 테스트를 실행하고 모두 통과한다"
    verification:
      - kind: unit
        ref: "npx vitest run --project unit|client|worker (각 1 파일 통과, 총 4 테스트)"
        status: pass
    human_judgment: false
  - id: D3
    description: "npm run typecheck 가 앱과 워커 구성 모두 오류 없이 통과한다"
    verification:
      - kind: other
        ref: "npm run typecheck (exit 0, 출력에 error TS 없음)"
        status: pass
    human_judgment: false
  - id: D4
    description: "GET /api/health 는 200 과 {ok:true, version}, 알 수 없는 /api/* 는 404 {error:NOT_FOUND}"
    verification:
      - kind: integration
        ref: "test/worker/health.test.ts#GET /api/health, #알 수 없는 /api/* 경로"
        status: pass
    human_judgment: false
  - id: D5
    description: "모든 의존성이 ^ ~ 없이 정확히 고정되고 package-lock.json 이 커밋되며, Worker 이름·DO 선언이 결정 0009 에 기록된다"
    verification:
      - kind: other
        ref: "acceptance_criteria 노드 검사(exit 0), grep wrangler.jsonc, grep 0009"
        status: pass
    human_judgment: false
  - id: D6
    description: "첫 화면에 minifia 제목과 빌드 버전(v...)이 보이고 바탕은 밤 남색(D-20)이다"
    verification:
      - kind: unit
        ref: "test/client/app.test.tsx#코드명 제목과 빌드 버전을 보여 준다"
        status: pass
    human_judgment: true
    rationale: "제목·버전 텍스트는 테스트로 증명했지만 남색 바탕·색 분위기는 눈으로 보는 판단이다(1페이즈 UAT)"

duration: 3min
completed: 2026-10-22
status: complete
---

# Phase 1 Plan 01: 걷는 뼈대 도구 세트 Summary

**Worker `minifia` + `exports` 선언 Room Durable Object 를 고정 버전 vite 8 / vitest 4 / wrangler 4 도구 세트로 세워, 타입체크·3 프로젝트 테스트·빌드·로그인 없는 배포 dry-run 이 모두 통과하는 저장소 골격**

## Performance

- **Duration:** 약 3분 (코드 작업 구간, 사용자 결정 대기 제외)
- **Started:** 2026-10-22T01:10:24Z
- **Completed:** 2026-10-22T01:13:00Z
- **Tasks:** 3 (Task 1·2 는 오케스트레이터가 사용자와 해결한 체크포인트, Task 3 이 실제 구현)
- **Files modified:** 21 (신규 19, 수정 2)

## Accomplishments

- 사용자 결정으로 확정한 Worker 이름 `minifia` 와 `exports` 선언을 `wrangler.jsonc` 와 결정 0009 에 기록했다. 되돌리기 어려운 두 결정이 첫 배포 전에 닫혔다.
- 리서치가 검증한 15개 패키지를 `--save-exact` 로 설치했고(`^`/`~` 없음, lock 커밋) `npm install` 한 번으로 같은 버전이 깔린다.
- `npm run typecheck`(앱·워커 분리 tsconfig), `npx vitest run`(unit·client·worker 각 1개 이상), `npm run build`, `npx wrangler deploy --dry-run`(`env.ROOM (Room) Durable Object`)이 모두 통과한다.
- 빌드 버전 문자열(UTC 시각 + 커밋 해시)이 앱 번들과 워커 번들 양쪽에 실제로 들어간 것을 빌드 산출물 검색으로 확인했다. 첫 화면 푸터의 `v...` 와 `/api/health` 의 `version` 이 같은 값이다.
- D-20 색·글꼴·반경·모션·층 토큰과 폰 폭(430px) 기본 레이아웃, `prefers-reduced-motion` 전역 규칙을 `src/styles/tokens.css` 로 만들었다.

## Task Commits

1. **Task 1: 배포 정체성 결정 (checkpoint:decision)** — 커밋 없음. 사용자가 option-a 선택, 0009 에 기록.
2. **Task 2: 패키지 합법성 확인 (checkpoint:human-verify, blocking-human)** — 커밋 없음. 사용자가 "approved", 0009 에 기록.
3. **Task 3: 고정 버전 설치와 빌드·테스트·배포 dry-run 이 되는 저장소 골격** — `b1c33e2` (feat)

**Plan metadata:** 이 SUMMARY 와 STATE·ROADMAP·REQUIREMENTS 갱신 커밋 (docs: complete plan)

## Files Created/Modified

- `package.json`, `package-lock.json` - 정확히 고정된 의존성과 스크립트(셸 전용 명령 없음)
- `wrangler.jsonc` - Worker 이름, 고정 호환 날짜, SPA 폴백, `/api/*` Worker 우선, ROOM 바인딩, `exports`
- `vite.config.ts` - react + cloudflare 플러그인, 빌드 버전 define(앱·워커 환경 모두)
- `vitest.config.ts` - unit / client / worker 세 프로젝트, passWithNoTests 꺼짐
- `tsconfig.json`, `tsconfig.app.json`, `tsconfig.worker.json` - DOM 있는 앱 구성과 DOM 없는 워커 구성, `shared/` 는 양쪽
- `index.html` - 한국어, viewport-fit=cover, theme-color, OG 제목·설명(og:url·og:image 없음)
- `src/main.tsx`, `src/App.tsx`, `src/styles/tokens.css` - 첫 화면과 D-20 토큰
- `shared/version.ts` - `APP_VERSION`(define 없으면 `dev`)
- `worker/index.ts`, `worker/room.ts` - `/api/health`, `NOT_FOUND`, 빈 `Room`
- `test/unit/version.test.ts`, `test/client/app.test.tsx`, `test/worker/health.test.ts` - 세 프로젝트 각 1개 이상
- `docs/decisions/0009-worker-identity-and-toolchain.md` - 결정 기록
- `docs/architecture.md` - 버전 표기, 테스트·검증 행, 디렉토리 설명 단락
- `.gitignore` - `worker-configuration.d.ts` 추가(생성물)

## Decisions Made

- 사용자 결정 (Task 1, option-a): Worker 이름 `minifia` + `exports: { Room: { type: "durable-object", storage: "sqlite" } }`, 클래스 `Room`, 바인딩 `ROOM`, `compatibility_date` `2026-10-12`.
- 사용자 결정 (Task 2, approved): SUS(too-new) 10개 패키지를 리서치 버전 그대로 설치, 낮춘 패키지 없음.
- `compatibility_date` 고정 근거와 도구 선택(vitest-plugin, workers-types 미설치, PWA·린터 제외)은 결정 0009 에 있다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 기본 브랜치(main)에서는 커밋 가드가 막아 phase 브랜치로 옮겼다**
- **Found during:** 커밋 전 HEAD 안전 점검
- **Issue:** 작업 트리가 `main` 이었고 `git.base-branch --is-protected main` 이 `true`, 설정에 `git.allow_default_branch_commits` 키가 없어 커밋 가드가 중단을 요구했다. 설정 파일은 에이전트가 바꿀 수 없다.
- **Fix:** 설정의 `git.phase_branch_template`(`gsd/phase-{phase}-{slug}`)대로 `gsd/phase-01-walking-skeleton` 브랜치를 만들어 그 위에서 커밋했다. 보호 브랜치 참조는 건드리지 않았다.
- **Files modified:** 없음 (브랜치 생성만)
- **Verification:** 커밋 전 `ACTUAL_BRANCH=gsd/phase-01-walking-skeleton`, 이 브랜치에 `b1c33e2` 가 있다.
- **Committed in:** 해당 없음

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** 코드 변경 없음. 다만 `branching_strategy: none` 인 이 프로젝트의 커밋이 main 이 아닌 브랜치에 있으므로 오케스트레이터나 사용자가 main 으로 합치거나(`git merge --ff-only`) `git.allow_default_branch_commits: true` 로 정책을 정해야 한다. 이후 계획 실행자도 같은 가드를 만난다.

## Issues Encountered

- 설치 결과 `@cloudflare/vite-plugin` 이 `wrangler 4.151.0` / workerd `1.20261012.1` 을 따로 끌고 와서, 루트 `wrangler 4.151.3` / workerd `1.20261019.1` 과 공존한다. 호환 날짜 고정(`2026-10-12`)이 이 차이를 흡수한다. 0009 의 결과 항목에 기록했다.
- `vite dev --host` 실제 기동은 이 계획의 검증 범위가 아니라 실행하지 않았다(빌드·dry-run·테스트로 확인).

## Authentication Gates

없음. dry-run 은 로그인 없이 통과했다. `wrangler login`(개인 계정)은 01-02 Task 2 몫이다.

## User Setup Required

없음. Cloudflare 개인 계정 로그인은 01-02 에서 안내한다.

## Known Stubs

없음. `Room` 은 의도적으로 빈 골격이며 기능은 01-02 Task 1 에서 얹는다(계획 명시).

## Threat Flags

없음. 새 신뢰 경계 노출은 계획의 위협 모델(T-01-01 account_id 미설정, T-01-02 .gitignore, T-01-SC 정확 버전·lock·사용자 합법성 확인)로 모두 처리했다.

## Next Phase Readiness

- 01-02(트레이서: 방 만들기 → 대기실 상태)가 같은 명령(`npm run typecheck`, `npx vitest run`, `npm run build`)으로 검증할 수 있다.
- 주의: 커밋이 `gsd/phase-01-walking-skeleton` 브랜치에 있다(위 Deviations). 01-02 이전에 main 합류 방식을 정해야 한다.
- 01-02 Task 2 에서 개인 Cloudflare 계정 로그인(`npx wrangler login`, `npx wrangler whoami`)이 필요하다.

## Self-Check: PASSED

- 신규 파일 19개와 수정 2개 존재 확인(`git ls-files`), 커밋 `b1c33e2` 가 HEAD 의 조상임을 확인했다.
- 수용 기준(고정 버전 노드 검사, lock, 호환 날짜, SPA 폴백·`/api/*`, `class_name`, `.gitignore`, `type: module`, 0009 의 이름 문자열, `dist/client/index.html`·`dist/worker/wrangler.json`, 프로젝트별 vitest)과 계획 검증 3종(typecheck, vitest, build + dry-run)을 모두 통과했다.

---
*Phase: 01-walking-skeleton*
*Completed: 2026-10-22*
