---
phase: 20-map-expansion
plan: "09"
subsystem: perf
tags: [map, town, perf, nightload, tm12, tdd]
status: complete

requires:
  - phase: 20-map-expansion
    provides: "20-04 마을 장면(그리기 단위·재질 공유) / 20-07 확장판 방장 줄·pickModeViaUi / 20-08 마을 E2E"
provides:
  - "scripts/perf-run.mjs — --map town|bar|plaza (town 은 확장판 그대로, bar·plaza 는 기본 마피아로 바꾼 뒤 맵 선택), 시작 뒤 view.map 확인, 저장 이름 끝 -town·-bar·-plaza"
  - "perf-run nightload 의 장면 중 그리기 통계(renderer.during·duringMax)와 기본 마피아의 errand 건너뛰기(nightloadDwell)"
  - "src/debug/perf/scenario.ts parsePerfParams 의 map=town (마을 스파이크)"
  - ".planning/phases/20-map-expansion/perf/ 의 마을·광장 nightload JSON"
affects: [20-10]

actuals:
  tokens: 14500
  tasks: 2
  commits: 3

plan_head_before: 7c38fb4d2bd0a7a8e3cf1522e2b8aee573c083b6
plan_head_after: d0b69681ec9ed47641e133a809c2aeed7b6adc84
commits: 3

tech-stack:
  added: []
  patterns:
    - "nightload 의 그리기 통계는 로비가 아니라 장면 끝나기 직전(dwell − 300ms)에 한 번씩 읽는다. 게이트의 calls·점광원은 장면 중 가장 큰 값(duringMax)"
    - "기본 마피아(재즈 바·광장)에는 낮 심부름 단계가 없다 — nightloadDwell(map) 이 errand 를 뺀다. 마을(확장판)은 전부"

key-files:
  created:
    - .planning/phases/20-map-expansion/perf/nightload-390x844-x4-town.json
    - .planning/phases/20-map-expansion/perf/nightload-390x844-x4-plaza.json
  modified:
    - scripts/perf-run.mjs
    - scripts/perf-run.test.mjs
    - src/debug/perf/scenario.ts
    - src/debug/perf/perfScene.ts
    - test/unit/perfScenario.test.ts

key-decisions:
  - "옵션이 없는 nightload 는 아무것도 고르지 않아 이제 마을을 잰다. JSON params.map 은 옵션이 아니라 시작 뒤 view.map 으로 확인한 기대 맵(town|bar|plaza)을 적는다 — 잘못된 맵을 잰 결과는 오류로 끝나 남지 않는다"
  - "town.ts 는 고치지 않았다 — 게이트를 모두 넘었다(경량화 없음)"

requirements-completed: [D-21, D-22]
---

# Phase 20 Plan 09: 마을 nightload 성능 측정 Summary

perf-run `--map town|bar|plaza` 와 마을 스파이크를 만들고, 로컬 개발 서버에서 nightload 마을 5분과 광장 대조 5분을 쟀다. 마을은 평균 59.8fps·끊김 1·그리기 호출 최대 82·점광원 3 으로 게이트(평균 ≥ 55·끊김 ≤ 5·calls ≤ 120·점광원 3)를 모두 넘었고, 광장 대조(59.7fps·끊김 2·calls 71·점광원 3)와 0.1fps 차다. 장면은 고치지 않았다.

## 측정 (390×844, CPU 4배 감속, 5분, 헤드리스 시스템 Chrome, 로컬 `http://localhost:5173`)

| 맵 | 평균 fps | 끊김(>50ms) | p95 | 그리기 호출(최대) | 삼각형(최대) | 점광원 | 가장 낮은 장면 | 잰 시간 |
|---|---|---|---|---|---|---|---|---|
| 마을(확장판, `--map town`) | 59.80 | 1 | 16.7ms | 82 | 93,996 | 3 | mafia:nomination 58.4 | 420초 |
| 광장(기본 마피아, `--map plaza`, 대조) | 59.68 | 2 | 16.8ms | 71 | 91,688 | 3 | mafia:nomination 58.0 | 300초 |
| 지난 nightload(18.1, 재즈 바) | 59.80 | 9 | 16.7ms | 로비 값 32 | 로비 값 40,630 | 4(로비) | — | — |

- 잰 시간이 다른 까닭: 마을(확장판)은 낮 심부름(errand) 단계가 있어 한 바퀴가 길고, 기본 마피아에는 그 단계가 없다(`--minutes 5` 는 판당 150초 + 150초의 한 바퀴 단위로 채운다).
- 마을 장면별 그리기 호출: errand 28 · discussion 24~30 · nomination·defense·verdict·execution 81~82(카메라가 마을 전체를 비추는 장면) · night 22~24 · morning 26~35. 광장은 discussion 49 · nomination~execution 70~71 · night 14~15 · morning 51~56.
- 마을 판별 평균: 마피아 판 59.8fps(끊김 1), 시민 판 59.8fps(끊김 0).
- 지난 페이즈 기준의 그리기 통계는 로비에서 읽은 값이라(예전 perf-run 은 로비에서만 읽었다) 장면 중 값과 직접 비교하지 않는다. 마을의 로비 값은 이전 실행(1차)에서 calls 32·삼각형 40,630(같은 숫자)이었다.

## 게이트 판정 (UI-SPEC I 절, P20-17, TM12)

| 항목 | 기준 | 마을 | 판정 |
|---|---|---|---|
| 평균 fps | ≥ 55 | 59.80 | 통과 |
| 끊김 | ≤ 5 | 1 | 통과 |
| 그리기 호출 | ≤ 120 | 82 (최대 장면) | 통과 |
| 점광원 | 3 | 3 (모든 장면) | 통과 |
| 광장 대조 대비 | 3fps 이내(참고) | 광장 59.68 → 마을 59.80 (+0.12) | 통과 |

### 근거의 한계 (실기기 확인으로 남긴다)

- 헤드리스 소프트웨어 GL 에서 rAF 는 60Hz 로 맞춰 도는 편이라 모든 장면이 58~60fps 로 붙는다 — 게이트를 넘었다는 것은 「CPU 4배 감속에서 메인 스레드가 16.7ms 안에 끝난다」는 뜻이고, 폰 GPU 의 채움 속도·발열 때문에 생기는 끊김은 못 본다. 마을과 광장이 같은 환경에서 거의 같은 값이라 마을이 광장보다 무겁지 않다는 비교는 유효하다.
- 삼각형 9만 대·그리기 호출 82 는 폰 6종 실기기에서 확인한 적이 없다 — v3.0 끝 실테스트에서 마을 `nomination~execution` 장면(전체 조망)을 폰으로 본다.
- 최악 장면(방·집·시계탑·사람 8명)은 지목·변론·찬반·처형에서 잡힌다(calls 81~82). 낮 토론 카메라는 내 몸 둘레만 비춰 calls 24~30 이다.

## RED 증거

- `node --test --test-reporter=tap scripts/perf-run.test.mjs`: `# fail 1` — `--map town` 파싱이 UsageError.
- `npx vitest run test/unit/perfScenario.test.ts --reporter=tap-flat`: 실패 2 — `parsePerfParams(map=town)`: expected 'bar' to be 'town'; perf-run `--map town` 파일 이름·주소 사례. (마을 마스크 시나리오 시험은 `cellCenterFx` 가 이미 맵을 받고 있어 처음부터 통과한다.)

## Task Commits

| # | 해시 | 내용 |
|---|---|---|
| 1 (RED) | 1ea8b299 | test(20-09): 마을 성능 측정 옵션 실패 시험 |
| 1 (GREEN) | 1fcb335c | feat(20-09): perf-run·스파이크의 마을 맵 |
| 2 (도구 보강) | d0b69681 | fix(20-09): nightload 의 장면 중 그리기 통계와 기본 마피아의 errand 건너뛰기 |
| 2 (측정) | (이 문서와 같은 docs 커밋) | docs(20-09): 마을 nightload 측정 |

## Deviations from Plan (계획과 달라진 점)

**1. [Rule 1 - 버그] nightload 의 그리기 통계가 로비 값이었다**
- **발견:** Task 2 첫 측정. 마을 JSON 의 renderer.after 가 지난 재즈 바 JSON 과 같은 숫자(calls 32·삼각형 40,630)였다 — 판이 끝난 뒤 로비로 돌아와 읽은 값이라 게임 장면이 아니다.
- **고침:** 장면마다 끝나기 직전(dwell − 300ms)에 info() 를 한 번 읽어 `renderer.during`(장면별)과 `renderer.duringMax`(칸별 최대)에 남기고, 읽는 시간은 sleep 에서 뺀다(측정 구간 길이 불변). 게이트의 calls·점광원은 duringMax 로 판정한다. 첫 마을 측정(평균 59.8·끊김 0)은 이 값이 없어 버리고 다시 쟀다.
- **파일:** scripts/perf-run.mjs · **커밋:** d0b69681

**2. [Rule 1 - 버그] `--map plaza` 가 기본 마피아에서 errand 를 기다리다 실패**
- **발견:** 기본 마피아로 바꾼 광장 측정이 「목표 단계 errand 에 도달하지 못함」으로 끝났다 — 낮 심부름 단계는 확장판에만 있다(결정 0086).
- **고침:** `nightloadDwell(map)` — town 은 전부, bar·plaza 는 errand 를 뺀다. 시험 추가. · **커밋:** d0b69681

**3. [참고] 첫 마을 측정 한 번은 「Execution context was destroyed」로 실패**
- 같은 명령 세 번(1분 1회, 5분 2회)은 모두 정상이어서 재현하지 않았다. 원인은 모르고(페이지 내비게이션 한 번), 재현되면 `PERF_DEBUG=1` 로 스택을 찍을 수 있게 했다.

계획의 `perf(20-09)` 장면 경량화 커밋은 필요하지 않아 만들지 않았다(`town.ts` 는 그대로).

## 20-10(전체 회귀·배포)에 넘기는 것

- 결정 기록에 실을 숫자: 마을 nightload 평균 59.8fps·끊김 1·그리기 호출 최대 82(광장 대조 71)·삼각형 최대 약 9.4만·점광원 3(헤드리스·CPU 4배, 광장 대조 59.7fps). JSON 은 `.planning/phases/20-map-expansion/perf/` 의 두 파일.
- 실기기 확인 항목: 마을 지목~처형 장면(calls 82)의 폰 GPU 부하·발열, 폰 6종의 마을 걷기(town-walk).
- `perf-run.mjs --mode nightload` 를 옵션 없이 돌리면 마을이다. 재즈 바(기본 마피아)를 재려면 `--map bar` 를 명시한다(이름 끝 -bar).
- 스크린샷 PNG 는 커밋하지 않았다(저장소 밖 scratchpad).

## 검증 결과

| 명령 | 결과 |
|---|---|
| `node --test scripts/perf-run.test.mjs` (+ e2e 도구 시험 `scripts/e2e/*.test.mjs`) | 628 통과 · 실패 0 |
| `npx vitest run --project unit --project client` | 7,943 통과 · 184 건너뜀 · 실패 0 |
| `npx vitest run test/unit/perfScenario.test.ts test/unit/perfMetrics.test.ts` | 67 통과 |
| `npm run typecheck` | 오류 0 |
| 원격 레포 위생 git grep (바뀐 파일) | 결과 0 |
| 측정 JSON 의 토큰·닉네임 | 없음(경로·크롬 바이너리 위치만) |

로컬 개발 서버만 썼고(배포본 사용 없음), 이 계획이 띄운 서버는 없다(이미 떠 있던 것을 그대로 썼다).

## Threat Flags

없음. 측정은 로컬이고 perf-run 의 기존 규칙(토큰·닉네임을 JSON 에 싣지 않음)이 그대로다. 패키지를 설치하지 않았다.

## Known Stubs

없음.

## Self-Check: PASSED

- scripts/perf-run.mjs·perf-run.test.mjs·scenario.ts·perfScene.ts·perfScenario.test.ts, 마을·광장 JSON 존재 확인.
- 커밋 1ea8b299·1fcb335c·d0b69681 이 HEAD 의 조상임을 확인.
