---
phase: 14-host-and-labels
plan: "09"
subsystem: docs-verify-deploy
tags: [decision-0073, docs, regression, nightload, deploy, minifia-v3, handoff, host-01, tool-01]
status: complete

requires:
  - phase: 14-08
    provides: "emcee-* E2E 흐름과 새 계약으로 옮긴 기존 흐름 기대"
provides:
  - "결정 0073(0073-1~8, 0051 보완) — 사회자 띠·빛남·알림음·역할 목표·HOST-05·위임 기본값 U-1~U-9·계획 선택·실행 편차·알려진 한계·정하지 않은 것"
  - "지도 문서 갱신(screen-map·architecture·product), 0051 보완 표시, UI-SPEC U-9 예외 한 줄"
  - "로컬 전체 검증(typecheck·build·스크립트 407·npm test 7051·폰 6종 E2E 회귀 한 번·nightload 5분·위생·서버 diff 0)"
  - "minifia-v3 배포 `2026-11-07T00:00:12Z+d77e3dbf` 와 배포본 smoke·E2E 확인, HANDOFF(15페이즈 시작점), push"
affects: [15-errands-witness-traces]

requirements-completed: [HOST-01, HOST-02, HOST-03, HOST-04, HOST-05, TOOL-01, TOOL-02, TOOL-03]

actuals:
  tokens: 21000
  tasks: 3
  commits: 4

plan_head_before: 0e5e474a69e45fb1a352aa357f8b39dbebfd7525
plan_head_after: f295e38e38d303d429d63ddef1a71c3c8befb62f

tech-stack:
  added: []
  patterns:
    - "자동으로 넘어가는 짧은 단계(낮 시작 2초)의 구간 검사는 넘기기를 누르지 않고 자동 전환을 기다려 센다(배포본 지연에서 넘기기가 다음 단계를 건드리는 경쟁 방지)"

key-files:
  created:
    - docs/decisions/0073-v3-host-and-labels.md
    - .planning/phases/14-host-and-labels/perf/nightload-390x844-x4.json
    - .planning/phases/14-host-and-labels/perf/nightload-390x844-x4.png
  modified:
    - docs/decisions/0051-v2-text-minimal-interaction-ui.md
    - docs/screen-map.md
    - docs/architecture.md
    - docs/product.md
    - .planning/phases/14-host-and-labels/14-UI-SPEC.md
    - scripts/e2e/host.mjs
    - HANDOFF.md

key-decisions:
  - "0073 에 체커 지적 두 가지를 적었다: 남은 초는 올림(U-4, 되돌리기 Math.floor), 쉬는 사람 화면은 띠 없음(U-9 예외, T-11-40). UI-SPEC U-9 문장에도 예외를 덧붙임"
  - "0073 에 14-01~14-08 SUMMARY 의 계획 선택과 편차를 옮김: 꺼진 장치 화면의 헤더 유지(LegacyMapHeader)·밤 진입 알림음 LS-7 예외·낮 시작→토론 무음·접근성 이름이 보이는 낱말 포함(WCAG 2.5.3)·PhaseBar/Timer 사용처 0·빛남 '썼음' 로컬·새 기록 점 gray-100 8px·마지막 5초 숫자 crimson-300(UI-SPEC 와 다름)·뷰 키 허용 목록에 me.will/me.note/day.chalk"

duration: 약 1시간 50분
completed: 2026-11-07
---

# Phase 14 Plan 09: 결정 0073·전체 검증·minifia-v3 배포·HANDOFF Summary

**사회자 띠·빛남·한 단어 이름표 계약을 결정 0073(0051 보완)과 지도 문서에 남기고, 폰 6종 전 흐름 회귀·nightload(59.8fps)를 통과시켜 minifia-v3 에 배포(`…+d77e3dbf`)·push 했다.**

## 한 일

1. **결정 0073 + 문서(커밋 d2a02b85)**: 번호 절 0073-1~8(사회자 띠, 0051 보완, 빛남, 알림음, 역할 목표, HOST-05, 위임 기본값 U-1~U-9 표, 계획 선택) + "실행 중 달라진 곳"(14-01~14-08 편차) + 알려진 한계 + 정하지 않은 것(음성 낭독 D-01, 첫 판 안내 D-06). 0051 에 `(보완: 0073-2 …)`, UI-SPEC U-9 에 쉬는 사람 예외, screen-map(새 절·emcee-* 네 줄)·architecture(hostLine·ui.host)·product(사회자 진행). REQUIREMENTS 의 HOST/TOOL 여덟 개는 앞 계획에서 이미 완료 표시였다(확인만).
2. **로컬 전체 검증(커밋 d77e3dbf)**: 아래 표.
3. **배포·HANDOFF(커밋 f295e38e, 8a9b3ce1)**: 배포·배포본 확인·E2E 안정화 한 건·HANDOFF 갱신·push.

## 검증 결과

| 항목 | 결과 |
|---|---|
| `npm run typecheck` · `npm run build` | 통과 |
| `node --test scripts/*.test.mjs scripts/e2e/lib.test.mjs` | 407 통과 · 0 실패 |
| `npm test` | **7051 통과** · 261 건너뜀 · 242 파일(간헐 continuity·bots 이번엔 통과) |
| 서버·공유 diff | `git diff --quiet 2736a336 -- worker shared` 성공(0) |
| 위생 검사 | 통과(새 결과 0, 작업 트리·변경분·14페이즈 커밋 메시지) |

### 폰 6종 E2E 회귀 (로컬 `npm run dev`, 흐름 묶음 A~E, 각 한 번)

묶음은 한 번의 기본 실행이 제한 시간(900초)에 닿을 수 있어 나누었다. 기본 실행 전 흐름(skipByDefault 제외)이 모두 한 번씩 돌았다.

| 묶음 | 흐름 | 결과 | 걸린 시간 |
|---|---|---|---|
| A | lobby·world·chat-lobby·chat-ime(+360x560)·chat-keyboard·chat-game·day·ghost | 전부 통과(day 111/111 × 폰 6종, lobby 34/34(360x560 33/33), ghost 34~43) | 166초 |
| B | noexec·night(144/144)·night-sizes·basic-off·basic-vote·map-select·host-handoff·reconnect·pc·wakelock | 전부 통과 | 533초 |
| C | result·result-reveal·result-awards·result-rematch·politics-verdict·avatar-emote·avatar-dress·avatar-phases(+night) | 전부 통과 | 230초 |
| D | sound-render·sound-unlock·sound-script·sound-night-parity·sound-result·emcee-band(폰 6종 30/30, 360x560 31/31)·emcee-tools 19/19·emcee-leak 22/22·emcee-sound 8/8 | 전부 통과 | 236초 |
| E | perfbudget | 10/13 — **알려진 간헐 B2(점광원 4>3 ×2)·M1(geometries 35>25), 13페이즈 전부터 기존**. 판정 문턱 그대로 | 48초 |

### nightload 5분 (390x844, CPU 4배 스로틀, 띠 초 갱신 + 빛 맥박 + 8명 투표 구간 포함)

| 지표 | 값 | 합격선 |
|---|---|---|
| 전체 평균 | **59.8 fps** | ≥ 55 |
| 끊김(>50ms) | **2회**(mafia:execution 2, 나머지 0) | ≤ 5 |
| p50 · p95 · 최장 | 16.7ms · 16.7ms · 66.7ms | — |
| 프레임·시간 | 17918프레임·299초, rAF 60Hz | — |
| 단계별 평균 | 투표(nomination) 59.3~59.7, 처형(execution) 58.7~58.9, 나머지 60.0 | — |
| draw call · 점광원 · 삼각형 | 31~34 · 4 · 37k~47k (점광원 4 는 기존 B2 와 같은 값) | — |

재측정 불필요(합격). 결과: `.planning/phases/14-host-and-labels/perf/nightload-390x844-x4.json`·`.png`.

### 배포 (T-14-23)

| 항목 | 배포 전 | 배포 후 |
|---|---|---|
| minifia-v3 `/api/health` version | `2026-11-06T19:07:24Z+5d855a5f` | `2026-11-07T00:00:12Z+d77e3dbf` |
| v1 (minifia.dhplay.workers.dev) | `2026-10-29T14:52:03Z+cb6979c` | 같음(변화 없음) |
| v2 (minifia-v2.dhplay.workers.dev) | `2026-11-06T13:49:18Z+e51942c6` | 같음(변화 없음) |

- `npm run deploy` 의 개인 계정·배포 대상(minifia-v3) 가드를 모두 통과했다(우회 없음).
- 배포본 smoke: `SMOKE OK full code=6507 players=5 spread=0ms discSpread=13ms version=2026-11-07T00:00:12Z+d77e3dbf`(`--previous-version` 으로 새 버전 확인).
- 배포본 E2E(`--only emcee,basic-vote,day`, 폰 6종): 첫 실행 3건 실패, 원인 분석 뒤 모두 해소 —
  - `day/nomination` 360x640 PK3 두 줄(손님1·3 지목 이름표 가로 5~6px·세로 10~13px 겹침): **알려진 간헐(night-sizes 360x640 PK3 와 같은 계열)**. `--only day --sizes 360x640,390x844` 재실행에서 111/111. 문턱 그대로.
  - `emcee-sound` HS3(낮 시작 → 토론 0번): 배포본에서 3회 중 2회 실패(구간 10개). 원인은 제품이 아니라 시험 절차의 경쟁 — 낮 시작은 2초 단계라 배포본 지연에서는 [넘기기]가 이미 토론으로 넘어간 뒤 도착해 토론 → 투표 전환(정당한 알림음 1번)을 그 구간에 센다. 별도 커밋 8a9b3ce1 로 넘기기 대신 자동 전환을 기다려 세게 고쳤다(문턱 0번 그대로). 고친 뒤 배포본 3회 모두 8/8.
  - 설정 재시도(설계된 재시도): day 430x932·402x874, basic-vote 430x932, emcee-leak 이 한 번씩 재시도 뒤 통과.
- 위 밖의 흐름은 첫 실행에서 통과.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] emcee-sound 의 낮 시작 → 토론 구간이 배포본에서 경쟁**
- **Found during:** Task 3 (배포본 E2E)
- **Issue:** 14-08 이 만든 구간 검사가 [넘기기]를 눌러 낮 시작 → 토론을 재는데, 낮 시작이 2초라 지연이 큰 배포본에서는 넘기기가 늦게 닿아 토론 → 투표의 알림음을 센다(HS3 실패 3회 중 2회). 로컬에서는 통과해 14-08 에서 못 잡았다.
- **Fix:** 로그를 비운 뒤 낮 시작 → 토론 자동 전환을 기다려 그 구간의 `ui.host` 수를 센다. 판정 문턱(0번)·다른 구간은 그대로.
- **Files modified:** scripts/e2e/host.mjs
- **Commit:** 8a9b3ce1

**2. [처리] 결정 0073 번호 절 형식** — 계획 인수 기준(`^0073-[0-9]\.` 8개 이상)에 맞춰 번호 절은 0073-1~8 로 하고 실행 편차·한계·정하지 않은 것은 `##` 절로 둠(0073-N 문장은 번호 절 안에 요약).

### 계획 대비 기록

- 사용자 확인이 필요한 한 가지를 0073-8(i)·"실행 중 달라진 곳"에 적었다: 마지막 5초 숫자는 crimson-300(대비 5.5:1), 막대는 crimson-400 으로 UI-SPEC "숫자도 같은 색"과 다르다. 되돌리려면 `v2.css` 한 규칙이지만 묶음 H(4.5:1)가 4.2:1 로 실패한다.
- `commits: 4` 는 SUMMARY 작성 시점 실측(`0e5e474a..f295e38e`) 이다. 이 SUMMARY·STATE·ROADMAP 메타데이터 커밋은 그 뒤에 따로 붙는다.

## Known Stubs

없음. (문서·검증·배포 계획이며 사용자 화면 코드를 바꾸지 않았다. 15페이즈용 예약 행 errand·witness·trace 의 빈 문구는 의도된 이월이다.)

## Threat Flags

없음. 새 네트워크 경로·인증·파일 접근 없음. T-14-23(계정·대상 가드 통과, v1·v2 불변), T-14-24(위생 검사 새 결과 0), T-14-25(문턱 유지, 간헐은 재실행 사실 그대로, 고친 것은 별도 커밋), T-14-02(서버·공유 diff 0), T-14-SC(패키지 설치 없음) 모두 이행.

## 알려진 사항 (사용자 확인 필요)

- 위임 기본값 표 둘(13페이즈 U-1~U-9, 14페이즈 U-1~U-9)과 결정 0071~0073 을 돌아와 검토. 값을 바꾸려면 표 한 줄과 해당 시험.
- 실기기 확인은 v3.0 끝 실테스트로 미룸: 360x560 띠 때문에 위쪽이 비좁음(HO1k·R-MS6k·AW4k·GH13k), [유언]·[보내기] 간격 16→8, 8자 이름 이름표 겹침, 헤더 단추 약 57 / 헤더 62.

## Self-Check: PASSED

- 파일: docs/decisions/0073-v3-host-and-labels.md, perf/nightload-390x844-x4.json·.png, 이 SUMMARY — 존재 확인
- 커밋: d2a02b85, d77e3dbf, 8a9b3ce1, f295e38e — 모두 HEAD 의 조상
