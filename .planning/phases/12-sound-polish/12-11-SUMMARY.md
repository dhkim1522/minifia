---
phase: 12-sound-polish
plan: "11"
subsystem: ui
tags: [web-audio, director, result, award, signals, tdd, e2e, playwright]
status: complete
requires:
  - phase: 12-sound-polish
    provides: "12-02 resultScript·awardScript·RESULT_AT, 12-08/10 director·signals·useSound·sound.mjs"
  - phase: 11-result-rematch
    provides: "ResultScreen 시계(goto/schedule)·resultDirector RESULT_TIMELINE·CEREMONY·ReadyPill"
provides:
  - "result 닫힌 신호(flip{i} · light{win} · plate{k,total}) — ResultScreen 시계의 goto 에서만 한 번씩"
  - "flipCue·lightCues·plateCues 순수 함수(사건 하나의 소리), resultScript·awardScript 절대 시각 표와 같은 줄임을 시험이 단언"
  - "감독 resultSignal: ended 에서만 소리, 박수 꼬리 대본 키는 ended 를 떠나면 취소"
  - "ReadyPill 준비 토글·[시작] 의 tap 신호(흐림 제외)"
  - "E2E sound-result(R1~R6 + 건너뛰기 K1·K2)"
affects: [12-12]
actuals:
  tokens: 26000
  tasks: 3
  commits: 3
plan_head_before: cce55fa6f3b15410059feb459a8b23a4157ef83f
plan_head_after: cd123e578d6db5f52944f835e1ae89ae62591c4f
tech-stack:
  added: []
  patterns: ["소리는 절대 시각 대본을 따로 돌리지 않고 11페이즈 시계가 낸 사건에 붙는다(건너뛰기·일시정지·재접속이 소리에서도 같은 규칙)", "모션 줄이기 도착의 승패 소리는 한 틱 미룬다(자식 효과가 부모 소리 훅 효과보다 먼저 돈다)"]
key-files:
  created:
    - test/unit/soundResult.test.ts
  modified:
    - src/audio/script.ts
    - src/audio/signals.ts
    - src/audio/director.ts
    - src/screens/ResultScreen.tsx
    - src/components/v2/ReadyPill.tsx
    - scripts/e2e/sound.mjs
    - scripts/e2e/flows.mjs
    - scripts/e2e/lib.mjs
    - scripts/e2e/lib.test.mjs
    - test/unit/soundScript.test.ts
    - test/unit/soundDirector.test.ts
    - test/unit/e2eContract.test.ts
    - test/client/resultScreen.test.tsx
key-decisions:
  - "신호 지점은 ResultScreen 의 goto(마크 도달) 한 곳 — 건너뛰어 지나친 마크는 goto 를 거치지 않으니 소급 재생이 없고, 일시정지는 타이머가 없으니 신호도 없다"
  - "audioView 에 필드를 더하지 않았다: 감독은 이미 phase 를 알고 result 신호는 ended 에서만 소리가 된다(허용 경로 목록 불변)"
  - "win 은 ResultScreen 이 castOf 와 winningTeam 으로 계산한 불리언(내 좌석이 표에 없으면 참)"
---

# Phase 12 Plan 11: 결과·시상 소리 Summary

결과 화면 시계가 낸 사건(직업 뒤집기·이긴 팀 조명·시상 패)마다 닫힌 `result` 신호가 한 번 나가고, 감독이 ended 단계에서만 role.flip · result.win/lose(+박수·침대 덕킹) · award.plate/final(+박수)로 바꾼다. 건너뛰기·일시정지·재접속·모션 줄이기는 시계의 기존 분기 그대로 소리에도 적용된다. E2E sound-result 390×844 18/18 통과.

## 이름표 (12-UI-SPEC 추정 vs 11페이즈 실제)

| 추정 | 실제 |
|------|------|
| `window.__mfResult` | 같음 `{ stage, chips, dimmed, costumes, tab, awards, shown, sat }` |
| `data-award-plate` | 같음(`data-award-id` 도) |
| `RESULT_AT` 1200/400/4600/5600/2500/900 | 같음: `RESULT_TIMELINE`{flipStartMs 1200, flipGapMs 400, lightAtMs 4600, ceremonyStartMs 5600} · `CEREMONY`{windowMs 2500, plateAtMs 900} — 이름만 다르다. 시험이 둘을 import 해 대조 |
| `useResultClock` 훅 | 없음. ResultScreen 안의 `goto(mark)` / `schedule(from)` (표시각 setTimeout) |
| 건너뛰기 | `skip()`(무대 탭, 4600 으로 점프) · 시상 `skipAwardNow()`(`skipAward(t,n)`) |
| 준비 알약 | `ReadyPill`(`data-ready-pill`), 활성 = `mark >= 4600` |
| 이월 메모의 `CLAP_MAX` | resultDirector 4(시각용). 소리 박수는 3개(`CLAP_COUNT`) — 별개 상수 |

## 결과

- 단위·클라이언트: soundResult 신규(상수 대조 · 사건 ↔ 절대 시각 표 일치 n=4·8 × win · total 4·8·12 · ended 가드 13단계 · 키 집합 · 재접속 · 다시 하기 game.start/bed.lobby), resultScreen 신호 16건(1200+400i flip · 4600 light · win 네 경우 · 건너뛰기 · 일시정지 · 재접속/에포크 · 모션 줄이기 · 패 · [넘기기] 연타 · 소급 없음 · 알약 tap).
- E2E sound-result 390×844 18/18 (36초): role.flip 4(참가자 4) · result.lose 1회(방장=마피아 패배) · award.plate 3 + award.final 1(패 4) · 박수 15 · 새로고침 로그는 bed.result 만 · 무대 탭 건너뛰기 판은 role.flip < 4, 승패 1회.

## Deviations from Plan

**1. [Rule 3 - 계획 해석] 순수 함수 반환 모양** — 계획의 `{ id, gainDb?, cents?, atMs }` 대신 기존 `ScriptItem`(`at`)을 재사용했다(`flipCue/plateCues → ScriptItem[]`, `lightCues → Script & { duck }`). 변환 없이 감독의 `emitTimed` 와 엔진 `runScript` 가 그대로 받는다.

**2. [Rule 1 - 낡은 시험 기대값] soundDirector.test.ts** 의 SIGNAL_KINDS 목록에 `result` 추가.

**3. [계획 해석] tap 신호** — ReadyPill 은 primary Button 이 아니라 tap 이 안 나갔다. 알약 파일에 `emitSignal({kind:"tap"})` 를 더했다(방장 흐림=인원 부족 토스트 경로 제외). Task 2 의 RED(알약 tap 시험)는 별도 커밋 없이 GREEN 커밋에 함께 들어갔다.

**4. TDD 순서** — Task 3 의 lib 판정(`soundResultChecks`)과 진리표는 같은 커밋에서 같이 썼다(별도 RED 커밋 없음). 진리표는 판정 실패 경로(누락·초과·순서·새로고침 오염)를 모두 닫는다.

그 밖의 계획 이탈 없음. audioView 필드 추가 없음(계획의 네 곳 편집 불필요).

## Known Stubs

없음.

## Threat Flags

없음. result 신호는 정수·불리언뿐이고(시험이 키 집합 단언) ended 밖에서는 무음이다(T-12-41), 재접속·처음 마운트는 신호 0(T-12-44, E2E R6), 시간표 상수는 시험이 대조한다(T-12-42).

## Self-Check: PASSED

- 파일 확인: test/unit/soundResult.test.ts, scripts/e2e/sound.mjs(soundResultFlow), 본 SUMMARY.
- 커밋 3개(272e132e · 74d1ae7e · cd123e57)가 HEAD 의 조상. `commits: 3` 은 `git log --grep="(12-11)"` 로 센 값이고 `plan_head_before..HEAD` 범위에는 병렬 12-04 의 커밋이 섞여 있다.

## 이월 메모

- 신호 지점: `ResultScreen.tsx` 의 `goto(m)` 끝(flip=마크 1200+400i · light=4600 · plate=창 시작+900) + 모션 줄이기 도착의 `lightSent` 효과(setTimeout 0, 부모 소리 훅 효과 뒤). 감독은 `director.ts` `resultSignal`, 박수 꼬리 키는 `result:light`·`result:plate:{k}`(ended 의 `scriptKeys`).
- 11페이즈가 시간표를 바꾸면 고칠 두 곳: `script.ts` `RESULT_AT`(+`RESULT_CLAP_DB`·`RESULT_DUCK`) 한 곳이고, 시험 soundResult.test.ts 가 RESULT_TIMELINE·CEREMONY 와 대조해 알려 준다.
- audioView 는 건드리지 않았다(12-09 메모의 네 곳 편집 불필요). 새 신호는 `SIGNAL_KINDS`·`LocalSignal`·`directSignal` 분기 한 줄.
- sound.mjs 흐름 전체: sound-render · sound-unlock(+360x560) · sound-script(SC1~SC12 + 처형 통과/부결) · sound-night-parity(+동작 누설) · sound-result(본판 R1~R6 + 건너뛰기 K1·K2, 약 36초).
- 12-12 가 회귀에서 돌릴 소리 흐름 다섯: `sound-render`, `sound-unlock`, `sound-script`, `sound-night-parity`, `sound-result`(unlock 은 360x560 변형 포함).
- 알려진 한계: 시상 패가 많을 때 [넘기기] 연타는 소리를 소급하지 않는다(의도). 건너뛰기 E2E 는 탭 시점의 flip 수를 판정에 쓰지 않는다(K1 은 참가자 수 미만만 본다). 결과 소리 레시피 dB 는 실기기 UAT 대기.
- E2E 실행: 빈 포트로 `vite dev --host 127.0.0.1 --port <p> --strictPort` 뒤 `npm run e2e -- --url http://127.0.0.1:<p> --only sound-result`.
