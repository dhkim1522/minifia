---
phase: 15-errand-and-trace
plan: "10"
subsystem: docs-verify-deploy
tags: [decision-0074, screen-map, regression, perf, deploy, minifia-v3, handoff, errand, trace, v3.0]
status: complete

requires:
  - phase: 15-09
    provides: "E2E errand·witness·trace 와 갱신된 옛 흐름"
provides:
  - "결정 0074(0074-1~9, 위임 기본값 U-1~U-18, 계획·실행 편차, 한계, 미정) + 0073 개정 표시 + screen-map·architecture·product 갱신"
  - "로컬 전체 검증(typecheck·build·스크립트 시험 509·npm test 7346·폰 6종 E2E 전 흐름 회귀 1회·nightload 5분) 통과"
  - "minifia-v3 에 v3.0 전체 배포(version 2026-11-07T09:14:56Z+f882224e), v1·v2 변화 없음, 배포본 smoke full OK"
  - "HANDOFF: v3.0 개발 완료·배포, 다음 = v3.0 전체 실테스트 한 번"
affects: []

requirements-completed: [ERRAND-01, ERRAND-02, ERRAND-03, ERRAND-04, ERRAND-05, TRACE-01, TRACE-02, TRACE-03, DEPLOY-03]

actuals:
  tokens: 17600
  tasks: 3
  commits: 7

plan_head_before: aca19d33e16e2a2a9578fff4fbbba6ec26012e93
plan_head_after: 1390b20d41db09e5e163b77a44d3e71d9095d6c3

tech-stack:
  added: []
  patterns:
    - "배포본 smoke 의 기대는 제품 계약이 바뀔 때 같은 계획에서 고친다(문턱을 낮추지 않고 닫힌 집합으로 좁혀 허용)"
    - "공개 레포 위생 검사는 새 파일뿐 아니라 추적 중인 전체의 적중 수를 기준 커밋과 비교한다"

key-files:
  created:
    - docs/decisions/0074-v3-errand-and-trace.md
    - .planning/phases/15-errand-and-trace/perf/nightload-390x844-x4.json
    - .planning/phases/15-errand-and-trace/perf/nightload-390x844-x4.png
  modified:
    - docs/decisions/0073-v3-host-and-labels.md
    - docs/screen-map.md
    - docs/architecture.md
    - docs/product.md
    - scripts/e2e/flows.mjs
    - scripts/e2e/result.mjs
    - scripts/e2e/result.test.mjs
    - scripts/perf-run.mjs
    - scripts/perf-run.test.mjs
    - scripts/smoke.mjs
    - HANDOFF.md
    - .planning/REQUIREMENTS.md
    - .planning/phases/15-errand-and-trace/deferred-items.md
    - .planning/phases/15-errand-and-trace/15-03-SUMMARY.md

key-decisions:
  - "result-reveal 의 마피아 밤 채팅 줄 검사는 후보 1 로 바꿨다(시험 전용 훅 없음): RT-M 입력칸 없음, RT14 채팅 줄 없음, RT7 구분선은 없거나 모두 {n}밤"
  - "15-09 가 다시 돌리지 못한 흐름(day·ghost·noexec·basic-off·basic-vote·emcee-tools·emcee-sound·avatar-phases·sound-script)은 전체 회귀에서 모두 통과해야 했고 통과했다"
  - "배포는 계정 가드(check-account)·배포 대상 가드를 거친 npm run deploy 로 했고 가드를 우회하지 않았다"
  - "결정 0074 에 15-01~15-09 이월 메모 전부와 U-1~U-18 표(U-11 개정 포함)를 적었다"

metrics:
  duration: 약 2시간 30분
  completed: 2026-11-07
---

# Phase 15 Plan 10: 결정 0074·전체 회귀·성능·배포·HANDOFF Summary

**15페이즈(= v3.0)를 닫았다. 결정 0074 와 지도 문서를 쓰고, 폰 6종 전 흐름 회귀 한 번과 5분 성능을 재고, minifia-v3 에 v3.0 전체를 배포해 배포본 smoke·E2E 까지 확인했으며, HANDOFF 를 "v3.0 개발 완료·배포, 다음은 전체 실테스트 한 번"으로 바꿨다.**

## 한 일

- **Task 1 (문서, `80f50e57`)**: `docs/decisions/0074-v3-errand-and-trace.md`(0074-1 심부름 단계 · 2 근처 snap · 3 목격 기록과 카드 겹침 규칙 · 4 밤 통일(나 포함 전원·마피아 채팅 화면 삭제·동작 버튼 삭제·선택 수 배지 예외) · 5 흔적 조각 표 9개·아침 +3초 · 6 누설 규칙·검사·다섯 곳 허용 목록 · 7 위임 기본값 U-1~U-18 · 8 계획 단계 결정 · 9 실행 중 편차, 한계, 미정). 0073 에 밤 줄 개정 표시. `docs/screen-map.md` 에 "심부름·기록·흔적(15페이즈)" 절(영역 표·표식 12개·면제 E-4·E-5·새 E2E 흐름), `docs/architecture.md`·`docs/product.md` 에 한 문단씩과 낡은 밤 화면 설명 한 줄 갱신. REQUIREMENTS 의 ERRAND·TRACE 여덟 줄은 이미 완료 표시였다(앞선 계획이 표시함).
- **result-reveal 보류 해결 (`e344506a`)**: 후보 1 — RT-M(방장 마피아에게 밤 채팅 입력칸 없음)·RT14(마피아 탭에 밤 채팅 줄 없음)·RT7(구분선은 없거나 모두 `{n}밤`)과 `result.test.mjs` 단위 시험 갱신. 시험 전용 훅 없음.
- **Task 2 (검증)**: nightload 에 errand 20초 장면을 더함(`5e9c1b23`, 한 바퀴 70초, `perf-run.test.mjs` 로 순서·합 고정). 로컬 전체 검증과 성능 JSON 커밋(`88979da6`). 위생 검사에서 앞선 15-03 SUMMARY 가 위생 패턴 문자열을 적은 것을 찾아 지웠다(`f882224e`).
- **Task 3 (배포·HANDOFF)**: 계정 가드를 통과한 `npm run deploy`, 배포본 smoke full·E2E, `b6ffb3a1`(smoke 낡은 단언 수정), `1390b20d`(HANDOFF·DEPLOY-03·보류 항목 기록).

## 시험 결과

| 항목 | 결과 |
|---|---|
| `npm run typecheck` · `npm run build` | 통과 |
| `node --test scripts/*.test.mjs scripts/e2e/lib.test.mjs result.test.mjs mapselect.test.mjs` | 509/509 통과 |
| `npm test`(누설 시험 포함) | 255 파일 통과(6 건너뜀) · 7346 시험 통과(261 건너뜀). 알려진 간헐 시험(`continuity`·`errand.test.ts`·`bots.test.ts`)은 재현되지 않았다 |
| 폰 6종 E2E 전 흐름 회귀 한 번(`--url http://localhost:5173`, 인자 없음) | 1263초(제한 1620초). 모든 흐름 통과, **실패 3건은 `perfbudget` B2·B2·M1 뿐**(13페이즈부터 지속되는 알려진 실패). `--only perfbudget` 단독 재실행도 같은 3건 |
| 15-09 가 다시 돌리지 못한 흐름 | day 111/111(6크기)·ghost 35~43 전부 통과·noexec 23/23·basic-off 10/10·basic-vote 15/15·emcee-tools 19/19·emcee-sound 8/8·avatar-phases 19/19·sound-script 36/36 전부 통과 |
| result-reveal | 6크기 22/22(RT-M·RT14·RT7 포함) |
| 새 흐름 errand·witness·trace | 폰 6종 통과(errand 23/23(390x844)·19/19, witness 13/13, trace 23/23) |
| RULESET 불변 | `git diff --quiet 42117647 -- shared/game/ruleset.ts` 성공 |
| 위생 검사 | 통과(새 결과 0): 추적 중 전체 적중 수가 기준 커밋과 같다 |

### 성능 (nightload 5분, throttle 4, 390x844, errand 장면 포함)

| 항목 | 값 | 합격선 |
|---|---|---|
| 평균 fps | 59.9 (mafia 판 59.8 · citizen 판 59.9) | ≥ 55 |
| 끊김(>50ms) | 3 (mafia execution 장면 3, 나머지 0) | ≤ 5 |
| p50 / p95 / 최장 | 16.7ms / 16.8ms / 66.7ms | — |
| errand 장면(mafia·citizen 각 60초) | 평균 60.0fps · 끊김 0 · p95 16.7~16.8ms | — |
| draw call(전·후) | 34 → 31 | ≤ 120 |
| 점광원 | 4 | 3 (`perfbudget` B2 와 같은 지속 한계, 13페이즈부터) |

JSON·스크린샷: `.planning/phases/15-errand-and-trace/perf/nightload-390x844-x4.{json,png}`.

## 배포 결과 (DEPLOY-03)

- **개인 계정 확인**: `npx wrangler whoami` 와 `scripts/check-account.mjs` 가 개인 계정임을 확인했다(식별자·토큰은 적지 않는다). `npm run deploy`(계정 가드 → build → 배포 대상 가드 → 배포)를 우회 없이 돌았다.
- **minifia-v3 /api/health version**: 배포 전 `2026-11-07T00:00:12Z+d77e3dbf` → 배포 후 `2026-11-07T09:14:56Z+f882224e`(Worker 버전 id `07967d21`). 배포된 앱 코드는 이후 커밋과 같다(뒤 커밋은 smoke 스크립트·HANDOFF·문서뿐).
- **v1·v2 health 변화 없음**: v1.0 `2026-10-29T14:52:03Z+cb6979c`, v2.0 `2026-11-06T13:49:18Z+e51942c6` 배포 전후 동일.
- **배포본 smoke full**(`--players 5 --previous-version <배포 전>`): 첫 두 번은 15-03 이후 낡은 단언(아래 편차 1)으로 실패, 고친 뒤 한 번은 `.msg` 읽기 오류로 실패(원인 미확정, `deferred-items.md`), **같은 코드·같은 배포본 재실행은 `SMOKE OK full code=7411 players=5 spread=8ms discSpread=0ms version=…f882224e`**. 심부름(산 5명 같은 40초 마감·같은 모양 me.errand)·밤 시민 편 본인 한 칸 snap·재접속 복원·판 끝·자유 채팅 단언을 지나갔다.
- **배포본 E2E**(`--only errand,witness,trace,day,emcee-band,emcee-tools,emcee-leak,emcee-sound`, 548초): errand·witness·trace·emcee-band 폰 6종 전부 통과, emcee-tools 19/19·emcee-sound 8/8·emcee-leak 22/22. day 한 칸(390x664) PK3 지목 버튼 겹침 2건(가로 3~5px·세로 11~13px, 손님 이름표 — 8자 이름 봇 8명판이 겹칠 수 있는 알려진 한계)이 실패했고 `--only day` 재실행은 **6크기 111/111 통과**(판정 문턱은 건드리지 않았다).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 배포본 smoke 의 낡은 단언 두 곳**
- **Found during:** Task 3 (배포본 smoke full)
- **Issue:** 15-03 이 아침에 흔적(`day.morning.trace`)과 +3초를 더했으나 smoke 는 `day.morning` 키가 `eliminated` 하나·아침 길이 9000ms 를 단언했다. 15-06 이 smoke 를 점검했지만 이 두 곳을 놓쳤다.
- **Fix:** 키는 `eliminated` 또는 `eliminated,trace`, trace 는 닫힌 조각 id 9개 중 하나, 길이는 9000(+흔적이 있으면 3000)으로 좁혀 허용했다. 단언을 지우거나 느슨하게 하지 않았다.
- **Files modified:** scripts/smoke.mjs
- **Commit:** b6ffb3a1

**2. [Rule 1 - Bug] result-reveal 의 마피아 밤 채팅 기대(결정: 후보 1)**
- **Found during:** 15-09(보류) → Task 2
- **Fix:** RT-M·RT14·RT7 을 밤 채팅 화면 삭제 계약으로 바꿨다. RT7 은 "구분선은 없거나 모두 `{n}밤`"(빈 마피아 탭을 허용) — 이 한 곳은 판정이 넓어졌다(마피아 탭이 비는 것이 15-08 의 계약이므로).
- **Files modified:** scripts/e2e/flows.mjs, scripts/e2e/result.mjs, scripts/e2e/result.test.mjs
- **Commit:** e344506a

**3. [Rule 3 - 위생] 앞선 15-03 SUMMARY 의 위생 패턴 문자열 제거**
- **Found during:** Task 2 (위생 검사에서 추적 중 적중 수가 기준 커밋보다 1 많음)
- **Fix:** 해당 한 줄을 "위생 검사로 새 적중 없음."으로 바꿨다(패턴 문자열을 공개 레포에 적지 않는 규칙).
- **Files modified:** .planning/phases/15-errand-and-trace/15-03-SUMMARY.md
- **Commit:** f882224e

### 계획 대비 메모

- nightload 의 첫 `skipTo(discussion)` 는 errand 가 첫 장면이 되도록 지웠다(낮 시작에서 바로 errand 로 넘김). 장면 표는 `export` 해 순서·합을 시험으로 고정했다.
- `REQUIREMENTS.md` 의 ERRAND·TRACE 여덟 줄은 이 계획 이전에 이미 완료 표시였고, DEPLOY-03 만 이 계획이 바꿨다.
- 폰 6종 전체 회귀는 계획대로 한 번만 돌렸고 실패한 흐름만 `--only` 로 다시 돌렸다.

### 미해결·미확정

- 배포본 smoke 의 `Cannot read properties of undefined (reading 'msg')` 한 번(원인 미확정, 재실행 통과) — `SMOKE_STACK=1` 로 다시 나타나면 스택부터(`deferred-items.md`).
- `perfbudget` B2(점광원 4>3)·M1(geometries 35>25)은 13페이즈부터 지속되는 기존 실패다. 이 계획이 만든 것이 아니고 고치지 않았다.

## Known Stubs

없음. (장소 아이콘 16개는 임시 선 그림이라는 한계가 결정 0074 에 있다 — 의도된 것이고 Future 로 둠.)

## Threat Flags

없음. (이 계획이 만든 새 네트워크·인증 표면은 없다. smoke 단언만 좁혀 허용했다.)

## Self-Check: PASSED

- 파일: docs/decisions/0074-v3-errand-and-trace.md · .planning/phases/15-errand-and-trace/perf/nightload-390x844-x4.json · HANDOFF.md(4678바이트, handoff 시험 통과) 존재
- 커밋: e344506a · 80f50e57 · 5e9c1b23 · 88979da6 · f882224e · b6ffb3a1 · 1390b20d 모두 HEAD 의 조상
