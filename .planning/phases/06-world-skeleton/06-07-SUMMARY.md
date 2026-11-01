---
phase: 06-world-skeleton
plan: "07"
subsystem: infra
tags: [cloudflare-workers, deploy, vite-define, react, v2-marker]

requires:
  - phase: 06-world-skeleton
    provides: "06-01 배포 가드 체인(npm run deploy)과 scripts/deploy-target.mjs 단일 출처"
provides:
  - "빌드 상수 WORKER_NAME (shared/version.ts, vite define __WORKER_NAME__) — 단일 출처 scripts/deploy-target.mjs"
  - "첫 화면 'v2.0 시험판' 표식(minifia-v2 빌드에서만)과 탭 제목 'Minifia v2'"
  - "minifia-v2 Worker 첫 배포 https://minifia-v2.dhplay.workers.dev"
  - "README·docs/setup.md·HANDOFF 의 v2 주소와 'v1.0 은 v1 브랜치에서만 배포'"
affects: [06-15, 06-16, 06-17, 06-18, 06-19, 06-20, 06-21]

actuals:
  tokens: 3300
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "배포 대상 이름은 scripts/deploy-target.mjs 한 곳에서 vite define 으로 클라이언트 상수가 된다"

key-files:
  created:
    - test/client/v2Marker.test.tsx
  modified:
    - shared/version.ts
    - vite.config.ts
    - src/screens/Home.tsx
    - src/styles/ds.css
    - index.html
    - README.md
    - docs/setup.md
    - HANDOFF.md

key-decisions:
  - "표식 조건은 WORKER_NAME === 'minifia-v2' 로 걸어 v1 빌드와 dev·테스트에는 나오지 않는다"
  - "og:* 링크 미리보기는 그대로 'Minifia' 로 두고 탭 제목만 'Minifia v2'"

requirements-completed: []  # DEPLOY-02 는 requirements.ready-ids 가 blocked 로 판정해 표시하지 않음(아래 참고)

coverage:
  - id: D1
    description: "v2 빌드 첫 화면에만 'v2.0 시험판' 표식이 나오고 탭 제목이 Minifia v2 다"
    requirement: DEPLOY-02
    verification:
      - kind: unit
        ref: "test/client/v2Marker.test.tsx"
        status: pass
    human_judgment: false
  - id: D2
    description: "가드 체인으로 minifia-v2 에 첫 배포되고 health version 이 이 커밋 해시를 담으며 smoke 가 통과한다"
    requirement: DEPLOY-02
    verification:
      - kind: other
        ref: "curl https://minifia-v2.dhplay.workers.dev/api/health ; node scripts/smoke.mjs --prod"
        status: pass
    human_judgment: false
  - id: D3
    description: "배포 직후 v1.0 주소 health version 이 기준선과 같다"
    requirement: DEPLOY-02
    verification:
      - kind: other
        ref: "curl https://minifia.dhplay.workers.dev/api/health (일회성)"
        status: pass
    human_judgment: false
  - id: D4
    description: "폰과 다른 기기에서 v2 주소로 방을 만들고 참가할 수 있다"
    requirement: DEPLOY-02
    verification: []
    human_judgment: true
    rationale: "실기기 조작 확인 — 사용자가 직접 확인하고 2026-11-01 '확인 마무리' 로 승인"

plan_head_before: 25346453f6b32ed4b554567bd2c827a3351e9b8a
plan_head_after: 9a285aeb5cb8a1c8bfd530c1943d0b2cc4c27648
commits: 3

duration: 약 3분 코딩 + 폰 확인 대기
completed: 2026-11-01
status: complete
---

# Phase 6 Plan 07: v2 첫 배포와 v2.0 시험판 표식 Summary

**빌드 상수 WORKER_NAME(vite define, 단일 출처)으로 minifia-v2 빌드에만 '시험판' 표식과 탭 제목 'Minifia v2' 를 달고, 가드 체인으로 minifia-v2 에 첫 배포해 v1.0 은 건드리지 않았음을 확인했다**

## Performance

- **Duration:** 코딩 약 3분(707683d 01:10 → 9a285ae 01:11, 2026-11-01 KST), 이후 배포·폰 확인
- **Tasks:** 3 (자동 2 + 사람 확인 1)
- **Files modified:** 9 (신규 1)

## Accomplishments

- `shared/version.ts` 에 `WORKER_NAME`(없으면 "dev")을 더하고 `vite.config.ts` 가 `scripts/deploy-target.mjs` 의 `WORKER_NAME` 을 `__WORKER_NAME__` 로 define 했다 — 이름 문자열을 다시 적지 않는다.
- `Home.tsx` 에 `WORKER_NAME === "minifia-v2"` 일 때만 `<p className="mf-entry__build">v2.0 시험판</p>`, `ds.css` 에 `.mf-entry__build`(아래 가운데, Label 14px, gray-300 토큰). `index.html` title 만 `Minifia v2`, og:* 는 그대로.
- `npm run deploy` 가드 체인(계정 확인 → 빌드 → 배포 대상 확인 → wrangler deploy)으로 minifia-v2 에 첫 배포.
- README·docs/setup.md·HANDOFF 를 v2 주소와 'v1.0 은 v1 브랜치에서만 배포' 로 갱신, HANDOFF 의 '덮어쓴다' 경고 제거.

## 배포 사실

- Worker: `minifia-v2`, 주소 https://minifia-v2.dhplay.workers.dev (RESEARCH A7 확정 — 주소 파생이 맞았다)
- Version id: `1611a850-532a-499c-873c-1a21cad24f2c`
- v2 health 원문: `{"ok":true,"version":"2026-10-31T16:12:07Z+9a285ae"}` — 이 커밋의 짧은 해시 `9a285ae` 포함
- `node scripts/smoke.mjs --prod` 통과 (code=7880)
- **v1 일회성 확인 (T-06-14)**: 배포 직후 `curl https://minifia.dhplay.workers.dev/api/health` 응답 원문 `{"ok":true,"version":"2026-10-29T14:52:03Z+cb6979c"}`. 기준선 `2026-10-29T14:52:03Z+cb6979c` 와 **같다** (v1.0 변경 없음). 저장소에는 스크립트로 남기지 않았다. 사람 확인 뒤에는 v1 서버에 새 요청을 보내지 않고 이 기록 값을 썼다.

## Task Commits

1. **Task 1: WORKER_NAME 과 v2.0 시험판 표식·탭 제목** — `707683d` (test, RED), `a3ef0f8` (feat, GREEN)
2. **Task 2: 첫 배포·건강 확인·smoke·v1 확인·문서 갱신** — `9a285ae` (docs; 배포 자체는 커밋 없음)
3. **Task 3: 폰 확인 (checkpoint:human-verify)** — 사용자가 2026-11-01 직접 폰으로 확인 후 '확인 마무리' 로 승인. 커밋 없음.

**Plan metadata:** 이 문서와 함께 올리는 docs 커밋

`commits: 3` 은 이 계획 고유의 커밋 수다. 원장 기준점(`plan_head_before`)부터 현재 HEAD 까지의 `rev-list` 는 53 이지만, 순차 실행 중 06-08~06-14 계획 커밋이 사이에 끼어 있어 측정값에 그 커밋이 섞인다. `plan_head_after` 는 이 계획의 마지막 커밋(9a285ae)의 전체 해시다.

## Files Created/Modified

- `test/client/v2Marker.test.tsx` — WORKER_NAME 모킹으로 표식 표시 조건과 index.html title·og:title 검사
- `shared/version.ts` — 빌드 상수 `WORKER_NAME`
- `vite.config.ts` — `__WORKER_NAME__` define (deploy-target.mjs 에서 가져옴)
- `src/screens/Home.tsx` — 조건부 'v2.0 시험판' 표식
- `src/styles/ds.css` — `.mf-entry__build`
- `index.html` — 탭 제목 `Minifia v2`
- `README.md`, `docs/setup.md`, `HANDOFF.md` — v2 주소·배포 브랜치 규칙

## Decisions Made

- 표식 조건을 이름 비교(`=== "minifia-v2"`)로 걸어 v1 빌드·dev·테스트에서는 나오지 않게 했다.
- 새 결정 기록 없음(Worker 이름은 결정 0043-3·0044-24 가 확정).

## Deviations from Plan

### 기록할 사항

**1. [배포 중복 실행] 같은 커밋·같은 대상으로 `npm run deploy` 를 한 번 더 실행**
- **Found during:** Task 2
- **Issue:** `npm run deploy` 가 의도치 않게 두 번 실행되었다.
- **영향 평가:** 두 번 모두 같은 커밋 9a285ae, 같은 `minifia-v2` 대상이고 가드 체인을 통과했다. 두 번째 실행 뒤에도 v1 health 가 기준선과 같았다(위 원문). 대상 이름이 같으므로 새 Worker 가 아니라 같은 Worker 의 버전 갱신이다. 최종 version id 는 `1611a850-532a-499c-873c-1a21cad24f2c`.
- **조치:** 추가 조치 없음. 이후 새 배포는 하지 않았다.

**2. [요구사항 표시] DEPLOY-02 를 완료로 표시하지 않음**
- `requirements.ready-ids` 가 DEPLOY-02 를 `blocked` 로 판정해 `requirements.mark-complete` 를 호출하지 않았다. REQUIREMENTS.md 는 그대로 Pending 이다. 06-01·06-07 두 계획이 같은 요구사항을 가지며, 페이즈 마무리 검증에서 처리하면 된다.

---

**Total deviations:** 1 사실 기록(중복 배포, 무해) + 1 보류(요구사항 표시)
**Impact on plan:** 범위 확대 없음.

## Issues Encountered

None

## Auth Gates

없음. 배포 계정 확인(`check-account.mjs`)이 통과했다.

## User Setup Required

None - no external service configuration required.

## Known Stubs

없음.

## Threat Flags

없음. 새 공개 주소(minifia-v2)는 계획의 T-06-14·T-06-15 범위 안이다.

## Next Phase Readiness

- v2 배포본이 자기 주소에 올라가 있어 이후 계획의 배포 검증을 이 주소로 할 수 있다. 이 시점의 로비는 v1.0 화면이고, 맵 로비는 뒤 계획이 같은 주소로 다시 배포한다.
- 사람 확인(Task 3): 사용자가 2026-11-01 에 폰으로 확인하고 승인했다.

## Self-Check: PASSED

- 파일 존재: test/client/v2Marker.test.tsx, shared/version.ts, vite.config.ts, index.html — 확인
- 커밋 존재(HEAD 조상): 707683d, a3ef0f8, 9a285ae — 확인

---
*Phase: 06-world-skeleton*
*Completed: 2026-11-01*
