---
phase: 15-errand-and-trace
plan: "09"
subsystem: e2e-errand-trace
tags: [e2e, errand, witness, trace, night-face-list, overlap, minifia-v3, d-02, d-03, d-04, d-05, d-06, d-07]
status: complete

requires:
  - phase: 15-05
    provides: "심부름 표지·화살표·근처 링·ErrandDock 표식"
  - phase: 15-07
    provides: "[기록]·기록 카드·아침 흔적 카드 표식"
  - phase: 15-08
    provides: "밤 얼굴 목록 통일(마피아 전용 밤 화면 삭제)"
provides:
  - "lib.mjs 순수 판정: errandChecks(EA1~6)·errandOverlapChecks(EO1~4)·recordChecks(RC1~4)·traceChecks(TC1~5)·nightFaceChecks(NF1~6)와 ERRAND_MARKERS·ERRAND_PLACE_IDS·ERRAND_LINES 사본(e2eContract 가 제품 값과 고정)"
  - "browser.mjs 읽기·조작 도우미: readErrand·readRecord·readTrace·readNightFaces·walkToPlace·pressErrandAct·waitErrandDone"
  - "새 흐름 errand·witness·trace(폰 6종, errand.mjs makeErrandFlows) 와 FLOWS 등록, OVERALL_LIMIT_MS 1620초"
  - "옛 흐름 갱신: night·night-sizes·result·sound-night-parity·avatar-phases-night·emcee-band·emcee-sound·emcee-leak(HL4 새 의미)"
affects: [15-10]

requirements-completed: [ERRAND-01, ERRAND-02, ERRAND-03, ERRAND-04, ERRAND-05, TRACE-01, TRACE-02, TRACE-03]

actuals:
  tokens: 90000
  tasks: 3
  commits: 3

plan_head_before: a946a1a5533c46c78df01706a2be6be048d3a743
plan_head_after: 02e7d7499934eb10dfd441f14ea93543c66d914f

tech-stack:
  added: []
  patterns:
    - "판정은 lib.mjs 순수 함수(문턱은 lib 에만, 측정 누락은 측정값 없음 실패), 흐름은 읽기만 한다"
    - "심부름 40초 안에 못 끝낸 것은 SetupError 로 던져 실행기가 다시 돈다(판정을 느슨하게 하지 않는다)"

key-files:
  created:
    - scripts/e2e/errand.mjs
  modified:
    - scripts/e2e/lib.mjs
    - scripts/e2e/lib.test.mjs
    - scripts/e2e/browser.mjs
    - scripts/e2e/flows.mjs
    - scripts/e2e/host.mjs
    - scripts/e2e/sound.mjs
    - scripts/e2e/avatar.mjs
    - test/unit/e2eContract.test.ts
    - .planning/phases/15-errand-and-trace/deferred-items.md

key-decisions:
  - "근처 밖 이름표 요소는 방의 사람 수만큼 DOM 에 남고(공개 목록) opacity 0 이다 — E2E 는 '보이는(opacity > 0) 이름표 수 ≤ 월드 좌석 수' 로 판정하고, 근처를 막 벗어난 사람은 퇴장 연출이 끝나는 3초 안에 사라지는지 본다"
  - "기록 카드는 채팅 기록 칸을 덮는 것이 설계다(UI-SPEC 기록 카드 영역: 아래는 입력줄 윗변 − 8) — RC3 은 아래 패널 전체가 아니라 입력줄(.mv-chat__form) 윗변 − 8 과 띠·독 + 8 을 판정한다"
  - "마피아 밤 동작 칸이 없어졌으므로(15-08) sound-night-parity E1 은 '밤 마피아 로그의 emote.* 0개', avatar-phases-night AP5b 는 '마피아 방장에도 동작 버튼 0개' 로 바꿨다"
  - "HL4 는 '산 사람 밤 화면 data-call 수가 역할과 무관하게 같음'(서로 다른 역할 둘 미만이면 측정 불가)"
  - "OVERALL_LIMIT_MS 900초 → 1620초: 새 흐름 3개 × 6 크기(errand 약 90초·witness 100초·trace 170초)를 MAX_PARALLEL 3 으로 나눈 720초를 더함"

metrics:
  duration: 약 3시간
  completed: 2026-11-07
---

# Phase 15 Plan 09: E2E 심부름·목격 기록·밤 통일·아침 흔적 Summary

**errand·witness·trace 세 흐름이 폰 6종에서 UI-SPEC 의 검사 항목(심부름·기록 카드·흔적 카드 영역, 밤 얼굴 목록 네 역할 동일, 소리)을 통과하고, 15페이즈로 깨진 옛 밤·낮 흐름의 기대는 새 계약으로 갱신되어 로컬에서 통과한다. 남은 것은 result-reveal 의 마피아 밤 채팅 줄 하나뿐(15-10 결정).**

## 한 일

- **Task 1** — `lib.mjs` 에 `ERRAND_MARKERS`(12)·`ERRAND_PLACE_IDS`(16)·`ERRAND_LINES` 와 순수 판정 다섯을 더하고 `lib.test.mjs` 단위 시험(정상·항목별 어긋남·측정 누락)을 썼다. `e2eContract.test.ts` 가 표식이 src 에 있고 장소 id·3곳·40초·3초·반경·띠 문장 사본이 제품 값과 같음을 고정한다. `browser.mjs` 에 읽기 도우미 일곱(읽기는 클릭·입력 없음, 닉네임·토큰 미반환). `NIGHT_CITIZEN_PANEL_H`·`GAME_PANEL_EXTRA.nightMafia` 삭제, HL4 새 의미, HS3(낮 시작 → 심부름 0번), OVERALL_LIMIT_MS.
- **Task 2** — `errand.mjs` 의 세 흐름.
  - **errand**: 도착 직후 칩 3·"0/3"·[처리] aria-disabled·띠 errand.act·근처 링, 반경 밖 [처리] 무변화, 월드·이름표에 근처 밖 좌석 0, 장소 셋을 걸어 처리(칩·표지·진행), 3/3 에서 [처리] 완료·띠 errand.done, 표지·화살표 영역(도착·중간 두 번), 근처를 벗어난 좌석의 이름표 소멸 관찰, 390x844 에서 마피아 판/시민 판 DOM 서명 비교, 묶음 G·H, 소리(낮 시작 → 심부름 0번·심부름 → 토론 1번).
  - **witness**: 방장·손님 둘(사람) + 봇 2. 방장과 첫 손님이 심부름을 마치고 방장이 첫 손님의 위치로 걸어가 만난다. 토론에서 [기록] 1·카드 접힘·띠 witness, 열기·aria-expanded·빛 이동, 입력칸 포커스에 접힘, 못 마친 둘째 손님 0건, 지목으로 넘어가면 단추·카드 0.
  - **trace**: 사람 8명(방장 경찰 + 손님 7). 첫 밤에 마피아·경찰·의사·시민의 얼굴 목록 동일(칸 수·높이·eye/heal 0·마피아 고리 0·거절 알림 0), 마피아 둘이 같은 사람을 골라 피해자, 아침 구간 전 카드 0·구간 안에서 8명 모두(유령 포함) 같은 카드 1개·알림 동시 0·영역·ui.card 한 번, 둘째 밤에 마피아가 갈려 아무도 안 죽는 아침은 카드 0·띠 trace 아님.
- **Task 3** — 옛 흐름 갱신: night(마피아 장면 NA2~NA12 를 얼굴 목록·확정 check 표시·걷지 않음으로)·night-sizes(마피아·경찰·시민 얼굴 목록, 88 패널 삭제)·result(밤 고르기 얼굴 칸)·nightMismatch·nightPolice(나 포함)·sound-night-parity(NP1 얼굴 칸, NP5 동작 칸 없음, E1 새 의미)·avatar-phases-night(AP5b, AP5 표본)·emcee-band(BAND_REQUIRED + errand)·emcee-sound(dayToErrand)·driveToEnd 시도 8회·lib.test 의 15-01 이후 낡은 기대(EXPECTED_SCENE·BASIC 순서 열 등).

## 로컬 실행 결과 (`npm run dev` + `npm run e2e -- --url http://localhost:5173 --only …`)

- **새 흐름 폰 6종(`--only errand,witness,trace`, 두 번째 실행 + witness 재실행)**: errand 6/6 크기 통과(390x844 23/23, 나머지 19/19), trace 6/6 통과(23/23), witness 6/6 통과(13/13). 360x560 포함, 판정 문턱을 낮춘 곳 없음(아래 편차 2의 기록 카드 기준 정정은 문턱 완화가 아니라 UI-SPEC 의 설계를 따른 것).
- **바뀐 옛 흐름(390x844, `--only night,emcee-leak,emcee-band,result,chat-game` 등)**: night 143/143, night-sizes 48/48, result 25/25, result-awards 20/20, result-rematch 19/19, sound-result 18/18, chat-game 13/13, emcee-band 31/31, emcee-leak 22/22, emcee-tools·emcee-sound·avatar-phases·sound-script·day·ghost·noexec·basic-off·basic-vote 통과(첫 실행), avatar-phases-night 5/5·sound-night-parity 20/20(수정 뒤).
- **남은 실패 3건(result-reveal 390x844)**: RT-M(방장 마피아의 밤 채팅 입력칸이 없음), RT14, RT7 — 15-08 이 산 마피아 밤 채팅 화면을 지워 생긴 것이며 `deferred-items.md` 에 해결 후보와 함께 적었다. 15-10 이 정한다.
- 6종 전체 회귀(`npm run e2e` 인자 없이)는 이 계획이 돌리지 않았다(15-10 이 한 번).
- 단위: `node --test scripts/e2e/lib.test.mjs` 367 통과, `npx vitest run test/unit/e2eContract.test.ts` 69 통과.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - 시험 결함] 근처 밖 이름표 수와 링 점 수 읽기**
- **Found during:** Task 2 첫 실행
- **Issue:** 이름표 요소는 방의 사람 수만큼 DOM 에 있고 근처 밖은 opacity 0 이라 "DOM 에 없음" 으로 읽으면 항상 실패한다(EA5). 링 점은 `svg` 가 아니라 안의 `polygon points`. 퇴장 연출(페이드)이 끝나기 전의 읽기가 EA5 를 흔들었다.
- **Fix:** 보이는(opacity > 0) 이름표만 세고, 걷다가 막 벗어난 사람은 3초 안에 사라지는지(EF6)와 최종 읽기 전 3초 안에 수렴하는지로 본다. 판정(근처 밖 좌석 0)은 그대로다.
- **Commit:** d680408e

**2. [Rule 1 - 계획 내 모순] 기록 카드와 아래 패널 교차**
- **Found during:** witness 폰 6종 실행(360x640·390x664·360x560 실패)
- **Issue:** 계획은 "카드가 아래 패널과 교차 0" 이라 했지만 UI-SPEC 의 "기록 카드 영역" 은 카드가 채팅 기록 칸을 덮고(아래 = 입력줄 윗변 − 8) 입력줄·[토론 끝내기]만 가리지 않는다고 설계했다. 360×560 에서는 독 아랫변 + 8 과 패널 윗변 사이가 113px 이라 카드(머리 44 + 줄 44×n)가 패널과 겹칠 수밖에 없다.
- **Fix:** RC3 을 "카드 윗변 ≥ 독 아랫변 + 8, 띠와 교차 0, 아랫변 ≤ 입력줄 윗변 − 8" 로 바꾸고 `recordChecks` 입력을 `panelRect` → `inputRect` 로 바꿨다(단위 시험 포함). 제품은 UI-SPEC 대로다.
- **Commit:** 02e7d749

**3. [Rule 1 - 15-08 이월] 마피아 밤 동작 칸·채팅이 없어짐**
- sound-night-parity NP1(얼굴 칸으로 고르기)·NP5(동작 칸 없음)·E1(밤 마피아 emote.* 0개), avatar-phases-night AP5b(마피아 방장도 동작 버튼 0)·AP5c 제거(보낼 수단 없음)·AP7 표본을 새 계약으로 바꿨다.
- **Commit:** 02e7d749

**4. [Rule 1 - 15-01 이후 낡은 단위 시험]** `lib.test.mjs` 의 EXPECTED_SCENE 열 개수와 기본판 단계 순서 예시에 errand 가 빠져 15-01 이후 실패 중이었다 — errand 를 더해 고쳤다.

### 계획 대비 메모

- **줄 0 의 '0' 표시**: 계획은 "만나지 않은 세 번째 사람" 이 확인한다고 했지만, 그 사람은 3곳을 못 마친 사람이라 기록 카드 자체가 없다(RC1 의 못 마친 사람 0건 판정으로 쓴다). 마친 사람이 줄 0 이면 RC2 가 자동으로 '0' 을 판정한다 — 이번 실행에서는 줄이 있는 사람만 나와 E2E 에서 '0' 을 직접 보지는 못했다(순수 판정 단위 시험과 15-07 의 React 시험이 '0' 을 고정).
- **witness 만남**: 방장이 첫 손님의 위치로 걷는 만남은 남은 시간이 9초 이상일 때만 한다(WF3). 부족하면 건너뛰고 줄 수는 읽은 그대로 판정한다 — 이번 실행 6크기 모두 판정 통과.
- **단일 RED/GREEN 커밋 분리 없음**: 시험과 구현을 같은 커밋에 두었다(순수 판정 시험이 구현과 함께 쓰임). 시험은 구현 전 모듈이 없어 실패하는 것을 확인한 형태가 아니다.
- **trace 의 심부름**: 사람 8명 흐름은 심부름 구간을 testSkip 으로 건너뛴다(각 사람이 걷지 않음). 심부름 상세는 errand·witness 가 본다.

### 범위 밖(보류)

- result-reveal 의 마피아 밤 채팅 줄(RT-M·RT14·RT7) — `deferred-items.md`.

## 이월 메모 (15-10 용)

- **6종 전체 회귀**: errand·witness·trace·night-sizes·result-reveal 등 폰 6종 흐름을 인자 없이 돌려야 한다. 새 흐름은 폰 6종에서 이미 통과했다(위). OVERALL_LIMIT_MS 는 1620초다 — 전체를 돌리면 시간이 늘어난다.
- **결정 0074 에 적을 것**: ① 이름표 DOM 은 방의 사람 수만큼 있고 근처 밖은 opacity 0(공개 목록, 위치 정보 없음) — E2E 는 보이는 수로 판정 ② 기록 카드는 채팅 기록 칸을 덮는 것이 설계, E2E 는 입력줄 윗변 − 8 을 본다 ③ result-reveal 의 마피아 밤 채팅 줄 처리(사용자 결정) ④ 밤 마피아 동작 칸 없음(AP5b·NP5·E1).
- **산 마피아 밤 data-call 수**: HL4 가 4역할 밤 data-call 수를 비교한다(실행에서 통과).
- 닉네임·토큰은 결과 줄에 없다(장소 id·개수·단계 이름뿐). `e2eContract` 가 browser.mjs 15페이즈 읽기 구간에 `nickname`·`token` 영문 낱말이 없음을 확인한다.

## Known Stubs

없음.

## Threat Flags

없음 — 새 네트워크 표면 없음. T-15-35(결과 줄에 장소 id·진행 수·개수·단계 이름만)·T-15-36(문턱은 lib.mjs 에만, 측정 누락은 측정값 없음 실패로 단위 시험 고정)·T-15-37(표식 값에 좌석·역할 없음 EA6·마피아/시민 DOM 서명 EF7·네 역할 밤 얼굴 목록 NF1~NF6 를 실제 브라우저에서 확인)·T-15-38(OVERALL_LIMIT_MS 이유와 함께 상향, MAX_PARALLEL 3 유지)를 처리했다.

## Self-Check: PASSED

- 파일: scripts/e2e/errand.mjs, scripts/e2e/lib.mjs, scripts/e2e/lib.test.mjs, scripts/e2e/browser.mjs, scripts/e2e/flows.mjs, test/unit/e2eContract.test.ts FOUND
- 커밋: 2297d2c7, d680408e, 02e7d749 FOUND
