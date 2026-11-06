---
phase: 06-world-skeleton
plan: "04"
subsystem: dependencies-tokens
tags: [three, three-types, design-tokens, supply-chain, vitest]

requires:
  - phase: 06-world-skeleton
    provides: "06-01 배포 대상 가드와 package.json 기준선"
provides:
  - "three@0.186.1(dependencies)·@types/three@0.186.0(devDependencies) 범위 없는 정확 고정"
  - "package-lock.json 의 three 무결성 값을 고정하는 회귀 테스트(deps.test.ts)"
  - "v2.0 디자인 시스템 토큰 22개가 합쳐진 design/tokens.json 과 재생성된 src/styles/tokens.css"
affects: [06-10 렌더러, 06-11 캐릭터, 06-12 v2 부품]

actuals:
  tokens: 3500
  tasks: 3
  commits: 3
plan_head_before: 79663d505fca67d40b2beaa8d26c12b164295df9
plan_head_after: 50051a2e3fb9d3ce388dc22d8c6762b089d2f578

tech-stack:
  added: [three@0.186.1, "@types/three@0.186.0"]
  patterns:
    - "새 의존성은 --save-exact 로 고정하고 lockfile 무결성을 단위 테스트로 지킨다"
    - "토큰은 design/tokens.json 만 고치고 tokens.css 는 npm run tokens 로 생성한다"

key-files:
  created:
    - test/unit/deps.test.ts
    - test/unit/tokensV2.test.ts
  modified:
    - package.json
    - package-lock.json
    - design/tokens.json
    - src/styles/tokens.css

key-decisions:
  - "three 는 최신 0.187.0(2026-10-30, too-new) 대신 결정 0055-1 의 0.186.1 로 고정한다"
  - "v2 토큰 중 글꼴 serif·글자 스타일 묶음은 합치지 않는다(가정 A1, 7~8페이즈에서 Gowun Batang 과 함께 추가)"
  - "v1.0 전용 토큰은 지우지 않는다(8~9페이즈에서 v1.0 화면을 지울 때 함께 정리)"

requirements-completed: [MAP-01]

coverage:
  - id: D1
    description: "three@0.186.1·@types/three@0.186.0 이 범위 없이 정확히 고정되고 lockfile 무결성·REVISION 186 이 회귀 테스트로 지켜진다"
    requirement: MAP-01
    verification:
      - kind: unit
        ref: "test/unit/deps.test.ts"
        status: pass
      - kind: other
        ref: "npm ls three @types/three"
        status: pass
    human_judgment: false
  - id: D2
    description: "v2.0 토큰 22개가 design/tokens.json 에 같은 값으로 합쳐지고 tokens.css 가 생성 경로로 다시 만들어진다"
    requirement: MAP-01
    verification:
      - kind: unit
        ref: "test/unit/tokensV2.test.ts"
        status: pass
      - kind: other
        ref: "npm run tokens:check"
        status: pass
    human_judgment: false
  - id: D3
    description: "설치 전 패키지 정당성(레지스트리 저장소·무결성·설치 스크립트 없음·too-new 배제) 사람 확인"
    verification: []
    human_judgment: true
    rationale: "공급망 신뢰 판단은 사람이 내린다. 사용자가 조건부 승인을 위임했고 오케스트레이터와 실행자가 읽기 전용 명령으로 조건을 재확인했다"

duration: 3min
completed: 2026-10-31
status: complete
---

# Phase 6 Plan 04: three 정확 고정 설치와 v2.0 토큰 합치기 Summary

**three@0.186.1·@types/three@0.186.0 을 사람 확인 뒤 --save-exact 로 들이고 lockfile 무결성을 테스트로 고정했으며, v2.0 토큰 22개를 design/tokens.json 에 합쳐 tokens.css 를 생성 경로로 재생성했다.**

## Performance

- **Duration:** 약 3분(체크포인트 승인 이후 실행 구간)
- **Started:** 2026-10-31T16:00:27Z
- **Completed:** 2026-10-31T16:02:11Z
- **Tasks:** 3 (Task 1 은 사전 승인된 체크포인트)
- **Files modified:** 6

## 사람 확인 결과 (Task 1, 패키지 정당성 게이트)

- 승인: 사용자가 오케스트레이터의 질문 도구로 "approved" 응답. 5개 조건을 모두 만족할 때만 설치하는 조건부 위임이었고, 오케스트레이터가 2026-11-01 에 읽기 전용 확인을 했다.
- 실행자 재확인(설치 직전, 읽기 전용 `npm view`, 실패 시 닫힘): 아래 값이 오케스트레이터 보고와 모두 같았다.
  - `three@0.186.1` 저장소 `git+https://github.com/mrdoob/three.js.git`
  - `three@0.186.1` `dist.integrity` = `sha512-blFeqb49wRCSGUGj7gtpfnSGHy2lwDk94RhUmS1c/hTby70kvChbWpkJ4Pm1390LqzzvTmzgXKHPEafJwCb8jA==`(계획 값과 글자까지 일치)
  - `scripts` 에 preinstall·install·postinstall 없음. 설치 뒤 `node_modules/three/package.json` 에서도 다시 확인
  - 출간 시각 0.186.1 = 2026-09-24, 0.187.0 = 2026-10-30(latest, 배제)
  - `@types/three@0.186.0` 저장소 DefinitelyTyped(`types/three`), `dist.integrity` = `sha512-mxYSBpDC+D0pLfSP6sW4WZTcT+nrtmZcimMqnVmy36Hte3XpeYSrvgg4TRdaM1GemGog1AWzI5qL2VoIfMXbJQ==`, `scripts` 비어 있음
- 설치한 뒤 lockfile 에 같은 three 무결성 값이 들어갔음을 `grep` 으로 확인했다.

## Accomplishments

- `npm install --save-exact three@0.186.1` 과 `--save-dev --save-exact @types/three@0.186.0` 만 실행했다(다른 버전·범위 없음). `npm ls` 가 두 버전을 보고한다.
- `test/unit/deps.test.ts`: package.json 정확 고정, lockfile 버전·무결성, `REVISION === "186"` 을 지킨다.
- `test/unit/tokensV2.test.ts`: v2 의 모든 범주 토큰이 앱 토큰에 같은 값으로 있고, UI-SPEC 22개 이름이 있고, tokens.css 변수가 있고, v1.0 토큰이 줄지 않았음을 지킨다.
- v2 에만 있던 22개(color 11·radius 2·shadow 1·size 2·duration 3·zIndex 3)를 v2 순서대로 각 범주 끝에 더했다. 같은 이름의 값 충돌은 0건이라 가정 A2 에 걸리지 않았다. design/tokens.json 변경은 110줄 추가뿐이고 삭제는 없다.
- `npm run tokens` 로 tokens.css 를 생성(22줄 추가). 직접 고치지 않았고 `tokens:check` 가 일치를 확인한다.

## Task Commits

1. **Task 1: 패키지 정당성 확인** - 코드 변경 없음(사용자 승인 + 실행자 재확인)
2. **Task 2: three·@types/three 정확 고정 설치와 회귀 테스트** - `b2c3e10` (chore)
3. **Task 3: v2.0 토큰 합치기 (TDD)** - RED `2d94fde` (test) → GREEN `50051a2` (feat). REFACTOR 없음

**Plan metadata:** 이 SUMMARY 와 상태 파일을 담은 docs 커밋.

## Files Created/Modified

- `package.json`, `package-lock.json` - three/@types/three 정확 고정
- `test/unit/deps.test.ts` - 버전·무결성·REVISION 회귀 검사
- `test/unit/tokensV2.test.ts` - v2 토큰 합침 회귀 검사
- `design/tokens.json` - v1+v2 합친 토큰 원천(110줄 추가)
- `src/styles/tokens.css` - `npm run tokens` 로 재생성(22줄 추가)

## Decisions Made

- 가정 A1 대로 serif 글꼴 계열과 글자 스타일 묶음은 합치지 않았다(`tokens.json` 의 `type` 은 그대로).
- 새 CSS 토큰은 만들지 않았다(UI-SPEC 의 "이 페이즈 전용 새 토큰 0개").
- 이 계획에서는 three 를 쓰는 앱 코드를 만들지 않았다(06-10·06-11 몫). 테스트만 `three` 를 import 한다.

## Deviations from Plan

None - plan executed exactly as written. (Task 1 은 사용자가 사전에 해결한 체크포인트로 처리했다. 계획 의도대로 읽기 전용 `npm view` 를 실행자가 한 번 더 돌려 값 일치를 확인했다.)

## Issues Encountered

- `npm install` 출력에 `npm audit` 취약점 6건(중간 3·높음 3) 안내가 떴다. `npm audit` 에서 three·@types/three 는 거론되지 않았고(`zod <4.6.6` 등 기존 의존성 쪽), 이 계획 범위 밖이라 고치지 않았다. 별도 점검이 필요하면 후속으로 다룬다.

## Known Stubs

None.

## Threat Flags

None. T-06-SC 는 사람 확인 + 정확 고정 + 무결성 테스트로, T-06-08 은 번들 모듈 import 만 쓰고 CDN 을 쓰지 않아(앱 코드 없음) 지켜진다. 06-17 E2E 가 "다른 출처 요청 없음"을 이어서 지킨다.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 06-10·06-11·06-12 가 `import ... from "three"` 와 v2 토큰(`--light-lamp`, `--z-tags`, `--toast-top` 등)을 바로 쓸 수 있다.
- three 를 올리려면 결정 기록을 먼저 남긴다(결정 0055-1, deps.test.ts 가 지킨다).

## Self-Check: PASSED

- 파일 존재: test/unit/deps.test.ts, test/unit/tokensV2.test.ts, design/tokens.json, src/styles/tokens.css 확인
- 커밋 존재: b2c3e10, 2d94fde, 50051a2 가 HEAD 의 조상임
- 검증: `npx vitest run` 123 파일·3362 통과(1 skipped), `npm run typecheck`(tokens:check 포함) 통과, `npm ls three @types/three` 두 버전 확인, acceptance grep 3건 통과

---
*Phase: 06-world-skeleton*
*Completed: 2026-10-31*
