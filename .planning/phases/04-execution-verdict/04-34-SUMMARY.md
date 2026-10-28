---
phase: 04-execution-verdict
plan: 34
subsystem: verdict-docs-and-predeploy-gates
tags: [decision-0037, validation, handoff, pre-deploy, local-gates, host-death-investigation, VOTE-01, VOTE-02, VOTE-03, VOTE-04, COMM-03, CONN-02, END-01, END-02]
status: complete

requires:
  - phase: 04-execution-verdict
    provides: "04-13~04-33 화면 웨이브 전부(순수 모듈·화면·E2E 도구·흐름 10개)와 그 SUMMARY 의 결정·편차"
provides:
  - "docs/decisions/0037-execution-screens.md — 장면 매핑·색 의미·토큰·연출 상수·후광 규칙·패널 236·기록 카드·처형 문구·testBotVote·모션 줄이기·한 단위 배포, 코드와 UI-SPEC 이 어긋난 곳, 알려진 한계, 바뀔 수 있는 기본값 표(P-1~P-18 상태), 되돌리기 비용"
  - "design/screens/execution-v1/SPEC.md 알려진 불일치에 P-1·P-2·P-3·P-7·P-8·P-10·P-18 반영"
  - "04-VALIDATION.md 화면 웨이브 47행 + 04-34 3행, Manual-Only 를 실기기 여섯 줄로 분리, status screen-wave-complete-pre-deploy"
  - "배포 직전 로컬 게이트 전부 초록(숫자는 아래) 과 HANDOFF(4.4KB) — 실기기 확인 8항목·아티팩트 동기화 목록, 개인 원격 push (배포 없음)"
  - "살아 있는 방장 E2E 의 첫 밤 방장 탈락 빈도 조사 결론: 설계대로의 무작위, 서버 버그 아님"
affects: [04-35 (사용자 go-ahead 뒤 배포·배포본 검증·요구사항 체크)]

actuals:
  tokens: 5000
  tasks: 3
  commits: 3
plan_head_before: f3bf2ec4e6c2bda7bf258133c02c27c603c98b5c
plan_head_after: ecf83ec5872a5626c1a079a9c537317822c79ab9

tech-stack:
  added: []
  patterns:
    - "문서가 코드를 따른다: SUMMARY 편차와 코드 상수를 결정 0037 에 옮기고 UI-SPEC 과 다른 곳은 코드 기준 한 줄"
    - "로컬 smoke 의 정적 캐시 헤더 단언은 dev 서버가 헤더를 안 주므로 스크래치 사본(단언 두 줄만 끔)으로 게임 단언 전체를 확인하고 저장소 파일은 그대로 둔다 (04-10 과 같은 방식)"

key-files:
  created:
    - docs/decisions/0037-execution-screens.md
  modified:
    - design/screens/execution-v1/SPEC.md
    - .planning/phases/04-execution-verdict/04-VALIDATION.md
    - .planning/phases/04-execution-verdict/deferred-items.md
    - HANDOFF.md

key-decisions:
  - "결정 0037 은 사용자 확정(P-7 아이콘 없음·D-12 개정, P-18 36px, 공개 첫 표 선두 규칙 유지, 확정 700ms 안 추가 표마다 두근 재생 유지)을 확정으로, 나머지 P-1~P-6·P-8~P-17 과 HANDOFF 확인 대기 항목(iOS backdrop-filter·가운데 후보에 내 자리 가림·360 셰브런·칩 비켜서기·`모두 냈어요`·유령 .9)을 확인 대기로 표에 모았다"
  - "HANDOFF 는 4.4KB 로 줄였다: 해결된 항목(선두 규칙·두근·P-18·변론·처형·무효·결과 세부 확인 문구 등)은 지우고 상세는 결정 0037·SUMMARY 로 보냈다"
  - "배포 직전 acceptance 의 `git log origin/main -1` 이 handoff 커밋 제목이어야 한다는 문구는 handoff 커밋 시점에 만족시켰고(ecf83ec push), 이후 SUMMARY·STATE 커밋을 같은 main 에 한 번 더 push 한다"

requirements-completed: []  # VOTE·COMM-03·CONN-02·END 는 04-35 의 배포본 검증 뒤에 체크한다(HANDOFF·사용자 지시)

coverage:
  - id: E1
    description: "결정 0037 이 화면 웨이브 결정과 P-1~P-18 상태, 되돌리기 비용을 한 곳에 적고 결정 0036 은 그대로다 (VOTE-01~04, COMM-03, END-02)"
    requirement: "VOTE-01"
    verification:
      - kind: automated
        ref: "test -f docs/decisions/0037-execution-screens.md && grep 되돌리기·VERDICT_DIM_PERCENT·dusk·testBotVote·P-PANEL-236·amber-700·verdictDusk (모두 존재), git diff 0036 비어 있음"
        status: pass
    human_judgment: false
  - id: E2
    description: "04-VALIDATION.md 에 04-13-T1 ~ 04-33-T3 47행이 있고 사람 확인 몫이 실기기 항목으로 남아 있다"
    requirement: "CONN-02"
    verification:
      - kind: automated
        ref: "grep -cE '^\\| 04-(1[3-9]|2[0-9]|3[0-3])-T[1-3] ' → 47, status screen-wave-complete-pre-deploy, nyquist_compliant: true, backdrop-filter 행"
        status: pass
    human_judgment: false
  - id: E3
    description: "배포 직전 로컬 게이트가 모두 초록이다 (VOTE-01~04, COMM-03, CONN-02, END-01, END-02)"
    requirement: "END-02"
    verification:
      - kind: automated
        ref: "npm test 102 파일 2777건 통과 · npm run typecheck 통과 · npm run build 통과 · node --test scripts/e2e/lib.test.mjs scripts/tsc-scoped.test.mjs 152건 통과 · smoke full 5명(캐시 헤더 단언 제외 사본) SMOKE OK · uat-vote 48/48 · uat-test-bots 45/45 · uat-test-room 28/28 · uat-day(16 통과 줄, exit 0) · uat-night 36/36 · npm run e2e -- --url http://localhost:5173 → 30/30 작업 E2E OK 276초"
        status: pass
    human_judgment: false
  - id: E4
    description: "HANDOFF 가 6KB 이하이고 배포 직전·실기기 확인·아티팩트 동기화 목록을 담으며 개인 원격에 push 됐다. 배포는 하지 않았다"
    requirement: "CONN-02"
    verification:
      - kind: automated
        ref: "npx vitest run test/unit/handoff.test.ts 통과(4403 바이트), 32자 이상 16진 문자열 0, git push origin main ecf83ec, npm run deploy 미실행"
        status: pass
    human_judgment: false
  - id: E5
    description: "연출 체감·iOS backdrop-filter·가독성(45%·3px)·8명판 후광·처형/무효 카드·배포본 한 판은 사람이 실기기에서 본다"
    requirement: "VOTE-03"
    verification:
      - kind: manual
        ref: "04-VALIDATION.md Manual-Only 표, HANDOFF 실기기 확인 목록"
        status: pending
    human_judgment: true
---

# Phase 4 Plan 34: 결정 0037·검증 표·배포 직전 게이트·HANDOFF Summary

**화면 웨이브(04-13~04-33)의 결정을 결정 0037 한 곳에 모으고, 검증 표를 47행 채우고, 로컬 전체 게이트(단위·타입·빌드·소켓 스크립트 6종·전체 E2E 30작업)를 모두 초록으로 확인한 뒤 HANDOFF 를 "배포 직전" 으로 줄여 개인 원격에 push 했다. 배포는 하지 않았다. 살아 있는 방장 E2E 흐름의 첫 밤 방장 탈락이 잦다는 의문은 서버 버그가 아니라 설계대로의 확률임을 시드 모의로 확인했다.**

## 한 일

**Task 1 — 결정 0037·시안 사본** (`1e8af98`)
- `docs/decisions/0037-execution-screens.md`(결정 10항 + 코드와 UI-SPEC 이 어긋난 곳 + 알려진 한계 + 바뀔 수 있는 기본값 + 결과). 상수는 `src/game/verdict.ts` 에서 이름을 직접 읽어 적었다(`VERDICT_DIM_PERCENT`·`VERDICT_BLUR_PX` 등). 토큰 값은 `design/tokens.json` 과 대조했다.
- 사용자 확정은 확정으로 적었다: P-18 36px, P-7 아이콘 없음(D-12 개정), 첫 표 1표짜리도 선두(그대로), 확정 700ms 안 추가 표마다 두근 재생(그대로). 확인 대기는 P-1~P-6·P-8~P-17 과 HANDOFF 의 여섯 항목(iOS backdrop-filter·가운데 후보에 내 자리 가림·360 셰브런·칩 비켜서기·`모두 냈어요`·유령 .9)이다.
- `design/screens/execution-v1/SPEC.md` 알려진 불일치에 네 항목(P-1·P-2 배경, P-3·P-18 무효 카드, P-8 변론 시트 재사용, P-10 처형 문구·P-7)을 더했다. 결정 0036 은 불변.

**Task 2 — 검증 표** (`0c8114d`)
- `04-VALIDATION.md` 에 04-13-T1 ~ 04-33-T3 47행(요구사항·작업 이름·각 작업 PLAN 의 첫 `<automated>` 명령, 상태 green)과 04-34-T1~T3 를 더했다. Manual-Only 는 `연출 체감`·`backdrop-filter 의 iOS 동작`·`어둡게 45%·흐림 3px 가독성`·`후광 8명판 프레임`·`처형 카드/무효 카드 순서`·`배포본에서 한 판 끝까지` 여섯 줄로 나누고 "실기기에서 확인할 것" 과 `사람 확인 대기` 를 달았다. 통과 표시는 하지 않았다.

**Task 3 — 로컬 게이트·HANDOFF·push** (`ecf83ec`)
- 아래 게이트 결과 표. HANDOFF 는 5984 → 4403 바이트로 줄이고 세 구역(지금 상태·확인 대기·다음 할 일)을 지켰다. 실기기 확인 8항목, 아티팩트 동기화 목록(디자인 시스템·화면설계서·화면 흐름), `testBotVote` 사용법을 담았다. 개인 원격(`git@github.com:dhkim1522/minifia.git`)에 push 했다.

## 배포 직전 로컬 게이트 결과 (로컬 dev 서버 `http://localhost:5173`, 내가 띄워 내가 끔)

| 게이트 | 결과 |
|---|---|
| `npm test` | 102 파일 2777건 통과 |
| `npm run typecheck` | 통과(토큰 검사 + app/worker tsc) |
| `npm run build` | 통과 |
| `node --test scripts/e2e/lib.test.mjs scripts/tsc-scoped.test.mjs` | 152건 통과 |
| `smoke full --players 5` | 게임 단언 전부 통과(여부 투표 집계·notMajority·차례 순서 포함). 저장소 파일 그대로는 마지막 정적 캐시 헤더 단언(`max-age=86400`)에서 실패 — dev 서버가 헤더를 주지 않는 알려진 제약(04-10·03.1-13 과 같음). 그 두 줄만 끈 스크래치 사본으로 `SMOKE OK full players=5` 확인 |
| `uat-vote` | 48/48 OK |
| `uat-test-bots` | 45/45 통과 |
| `uat-test-room` | 28/28 통과 |
| `uat-day --players 5` | 통과(exit 0, 통과 16줄) |
| `uat-night --players 5` | 36/36 통과 |
| 로컬 전체 E2E | **10흐름 × 3폭 30작업 모두 통과, `E2E OK`, 276초**(재시도 로그 없는 첫 실행) |

## 조사: 살아 있는 방장 E2E 의 첫 밤 방장 탈락이 잦은 이유

**결론: 서버 버그의 증거 없음. 설계대로의 무작위다.**
- **읽기**: 봇 마피아의 밤 지목은 `botNightTarget` 이 "살아 있는 비마피아" 후보 배열에서 `randInt(길이)` 로 고른다(균등). 방 DO 의 `cryptoRandInt` 는 거부 표본 추출이라 편향이 없다. 테스트 방 넘기기(`botsPickNow`)도 같은 함수를 쓰고, 방장이 시민이면 아무것도 고르지 않는다. 봇 처형 투표를 `no` 로 고정하면 처형이 없어 방장이 죽는 길은 밤 암살뿐이다.
- **시드 모의**(일회용 vitest 시험, 실제 `startGame`+`testRole`·`botNightTarget`·`pickTarget`·`resolveNight`, 시드 2만 판씩, 시험 파일은 지움): 방장 탈락률 4명판 방장 시민 **0.332**(이론 1/3), 5명판 방장 시민 0.199·경찰 0.200(이론 1/5: 1/4 × 의사가 같은 사람을 보호할 확률 1/5 제외), 5명판 방장 의사 0.252(이론 1/4, 방장이 안 지킴), 6명판 시민 0.212, 8명판 시민 0.144, 방장 마피아 0.000. 이론과 소수 셋째 자리까지 맞는다.
- **관찰(04-33 의 "시도마다 약 1/2")** 과의 차이는 표본이 작은 탓이다(전체 5회 실행, 흐름당 최대 2~3회 시도, 3개 폭이 각자 흐름). `citizen4` 한 흐름이 두 번 연속 실패할 확률은 1/9, 폭 3개면 한 번 전체 실행의 약 30%이고 `run.mjs` 재시도를 4번(실패 확률 (1/3)^5 ≈ 0.4%/흐름)으로 늘린 뒤 이번 실행은 첫 시도에 통과했다. 결정에 쓰는 수치로는 충분하다.
- **서버 로직은 바꾸지 않았다.** `deferred-items.md` 의 "남은 무작위" 항목을 이 결론으로 갱신했다. 방장 탈락 확률을 없애려면 E2E 쪽에서 방장 보호가 아니라 `testBotVote` 같은 `pick` 훅이 밤에도 필요하지만, 그러면 서버 변경이 되므로 하지 않았다.

## Deviations from Plan

### Auto-fixed Issues

없음. 코드는 한 줄도 바꾸지 않았다(문서·인계만). 계획과 달라진 점은 아래 둘이다.

### 계획과 달라진 점 (편차 아님)

- **smoke 의 정적 캐시 헤더 단언**: 계획은 저장소 `smoke.mjs` 를 그대로 돌리라 했으나 dev 서버가 `public/_headers` 를 적용하지 않아 마지막 단언이 로컬에서 항상 실패한다(04-10 SUMMARY 편차 1, 03.1-13). 단언은 느슨하게 하지 않았다. 배포본(04-35)에서 실제 헤더를 본다.
- **push 가 두 번**: acceptance 의 "`git log origin/main -1` = handoff 커밋 제목" 은 handoff 커밋 시점에 만족시켰다(`ecf83ec`). 이후 SUMMARY·STATE 마감 커밋을 한 번 더 push 해 최종 origin 끝은 그 마감 커밋이다.
- **HANDOFF 확인 대기에서 지운 것**: 이미 확정된 항목(공개 칩 선두 규칙, 확정 두근 재생, P-18)과 04-21~04-26 의 세부 확인 문구는 결정 0037 표로 옮겼다. 규칙 가정 A1·A2, 결정 0036 기본값, 커튼 V2, `CLAUDE.md` 수정 허락은 그대로 남겼다.

## Known Stubs

없음. 문서·인계만 바꿨고 스텁 패턴이 있는 코드를 만들지 않았다.

## Threat Flags

없음. 새 네트워크·인증·파일 경로 없음. T-04-75: HANDOFF·결정 0037·SUMMARY 에 토큰·키를 적지 않았고 32자 이상 16진 문자열은 0건(HANDOFF), 크기 시험 통과. T-04-SC: 새 패키지 설치 없음. push 는 개인 원격 SSH 만 썼고 전역 git 설정은 건드리지 않았다.

## 아직 사람이 봐야 하는 것

실기기 확인 8항목(HANDOFF), 사용자 확인 대기 기본값(결정 0037 표), 디자인 아티팩트 동기화(디자인 세션). 요구사항 체크는 04-35 배포본 검증 뒤.

## Self-Check: PASSED

- 파일: docs/decisions/0037-execution-screens.md, design/screens/execution-v1/SPEC.md, .planning/phases/04-execution-verdict/04-VALIDATION.md, .planning/phases/04-execution-verdict/deferred-items.md, HANDOFF.md — 존재 확인
- 커밋: 1e8af98, 0c8114d, ecf83ec — HEAD 의 조상 확인
