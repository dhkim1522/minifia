---
phase: 19-game-modes
plan: "07"
subsystem: testing
tags: [game-mode, basic-mafia, e2e, leak, dom-scan, host-line, contract, tdd]
status: complete

requires:
  - phase: 19-01 (판 종류 서버)
    provides: view.mode, basic 판에서 심부름·목격 기록·증거 키를 싣지 않는 view, 심부름 단계를 건너뛰는 단계 흐름, 판 규칙을 따르는 봇
  - phase: 19-06 (방장 줄·판 종류 E2E)
    provides: openGame 의 mode 인자, pickModeViaRail, modes.mjs, 판정 절의 자리
provides:
  - "E2E 순수 판정: basicModeChecks(BM1~BM3)·basicViewKeyChecks(BM1k), 사본 BASIC_ABSENT_SELECTORS·BASIC_ABSENT_ATTR_PREFIX·BASIC_FORBIDDEN_LINES·BASIC_OFF_VIEW_KEYS"
  - "E2E 감시: hostLineScannerScript·readHostLines(자막 띠 글 100ms)"
  - "새 흐름 mode-basic(기본 마피아 봇 판 완주, 390x844)·mode-leak(기본 마피아 역할 다섯 시점 누설, 390x844)"
  - "host.mjs: lobbyWith·walkLeak 의 mode 인자, 두 누설 흐름이 함께 쓰는 leakFlow"
  - "두 판 대조 결과: 기본 마피아(mode-basic·mode-leak)와 확장판(basic-off·emcee-leak·trace) 모두 로컬 통과"
affects: [19-08]

actuals:
  tokens: 11796
  tasks: 3
  commits: 5

plan_head_before: 7adcb914e151c1bdd15ecb08a9f7c6403efd4188
plan_head_after: 9f86bdc70c7a7dd86ef8f42a04b1f2a0f5eea543
commits: 5

tech-stack:
  added: []
  patterns:
    - "없어야 하는 것의 판정은 반대 판(있어야 하는 판)에서 한 번 실패시켜 본다 — 감시가 실제로 잡는지를 통과 기록만으로는 알 수 없다"
    - "금지 문구 사본은 '닿지 않는 키의 값'에서 '닿는 다른 키와 글이 같은 값'을 뺀 것이다 — 계약 시험이 뺀 키를 이름으로 고정한다"
    - "같은 본문을 판 종류만 바꿔 도는 흐름은 '그 판 종류가 실제로 적용됐는가'를 한 줄로 남긴다(적용이 안 된 채 통과하는 것을 막는다)"

key-files:
  created: []
  modified:
    - scripts/e2e/lib.mjs
    - scripts/e2e/lib.test.mjs
    - scripts/e2e/browser.mjs
    - scripts/e2e/modes.mjs
    - scripts/e2e/host.mjs
    - scripts/e2e/flows.mjs
    - test/unit/e2eContract.test.ts

key-decisions:
  - "띠 금지 문구는 넷이다 — errand.ghost('지켜봐 주세요')는 낮 발표·투표·찬반의 유령 줄과 같은 문장이라 기본 마피아의 유령 화면에 그대로 나온다. 계획의 '다섯 키 값'에서 이 하나를 빼고 계약 시험이 뺀 키를 errand.ghost 로 고정한다"
  - "BM2 는 계획의 세 조건(errand 없음·낮 발표 다음 토론·필수 단계)에 더해 전체 전이 표로 순서를 본다 — 낮 발표 → 토론 → 투표 → (변론 → 찬반 → 처형) → 밤 → 아침"
  - "받은 키 판정(BM1k: me.errand·me.record·day.evidence 0건)을 더해 mode-basic 두 페이지와 mode-leak 다섯 판에 쓴다 — 화면에 없는 것과 서버가 싣지 않은 것을 따로 잰다"
  - "앱(src·shared·worker)은 고치지 않았다 — 다섯 흐름이 첫 실행부터 통과했다"

requirements-completed: [D-08, D-09, D-11, D-12, D-18]

coverage:
  - id: D1
    description: "기본 마피아 판 순수 판정(BM1~BM3·BM1k)과 사본 계약 — 정상 입력 통과, 어긋난 입력마다 해당 판정 실패, 못 잰 입력은 측정값 없음 실패. 금지 문구·없어야 할 표식이 앱 값과 같다"
    requirement: D-09
    verification:
      - kind: unit
        ref: "node --test scripts/e2e/lib.test.mjs (452 tests)"
        status: pass
      - kind: unit
        ref: "test/unit/e2eContract.test.ts#19페이즈 기본 마피아 판 E2E 사본 계약 (19-07, T-19-22)"
        status: pass
    human_judgment: false
  - id: D2
    description: "기본 마피아 봇 판(방장 + 참가자 + 봇 넷)이 실제 브라우저에서 대기실부터 결과까지 완주하고, 방장·참가자(첫날 탈락해 유령) 화면에 심부름·기록·흔적 표식이 한 번도 없으며 단계 순서가 심부름 없는 순서이고 띠가 심부름·증거를 말하지 않는다"
    requirement: D-08
    verification:
      - kind: e2e
        ref: "node scripts/e2e/run.mjs --url http://localhost:5173 --only mode-basic (390x844, 19/19)"
        status: pass
    human_judgment: false
  - id: D3
    description: "기본 마피아 판의 역할 다섯 시점(마피아·경찰·의사·시민·유령)에서 남의 역할 줄·문구가 화면에 없고 받은 view 키가 허용 목록 안이며 심부름·기록·증거 키가 오지 않는다"
    requirement: D-12
    verification:
      - kind: e2e
        ref: "node scripts/e2e/run.mjs --url http://localhost:5173 --only mode-leak (390x844, 25/25)"
        status: pass
    human_judgment: false
  - id: D4
    description: "봇이 기본 마피아 판에서 심부름 없이 투표·밤 고르기를 해 판이 끝까지 간다(여덟 판 모두 ended)"
    requirement: D-11
    verification:
      - kind: e2e
        ref: "mode-basic BM0(세 번) · mode-leak LKm(다섯 판 모두 basic·결과 도달·errand 없음)"
        status: pass
    human_judgment: false
  - id: D5
    description: "확장판 흐름이 그대로 통과한다 — 봇 판 완주와 꺼진 장치(basic-off), 누설(emcee-leak), 아침 흔적·증거(trace)"
    requirement: D-18
    verification:
      - kind: e2e
        ref: "node scripts/e2e/run.mjs --url http://localhost:5173 --only basic-off (10/10) · --only emcee-leak (23/23) · --only trace --sizes 390x844 (53/53)"
        status: pass
    human_judgment: false

duration: 약 20분
completed: 2026-11-13
---

# Phase 19 Plan 07: 기본 마피아 완주·누설 E2E Summary

**기본 마피아 한 판을 실제 브라우저에서 끝까지 돌리며 심부름·기록·흔적 표식 0건, 심부름 없는 단계 순서, 띠 금지 문구 0, 서버가 그 키를 싣지 않음을 재는 판정(BM1~BM3·BM1k)과 흐름 mode-basic·mode-leak 을 만들었고, 확장판 대조 흐름 셋과 함께 다섯 흐름이 로컬에서 모두 통과했다. 앱은 고치지 않았다.**

## 진행

- **걸린 시간:** 약 20분 (2026-11-12T15:39Z ~ 15:59Z)
- **Task:** 3/3
- **바뀐 파일:** 7 (모두 E2E·시험) — 앱(src·shared·worker)은 고치지 않았다
- **커밋:** 5 (test 2 + feat 3) — `7adcb914..9f86bdc7`

## 한 일

- `lib.mjs` 에 "19페이즈 기본 마피아 판 basicModeChecks" 절:
  - `BASIC_ABSENT_SELECTORS`(`[data-trace-mark]`·`[data-seen-mark]`·`[data-lastseen-row]`·`[data-trace-card]`·`[data-record-button]`), `BASIC_ABSENT_ATTR_PREFIX`(`data-errand-`), `BASIC_FORBIDDEN_LINES`(문장 넷), `BASIC_OFF_VIEW_KEYS`(me.errand·me.record·day.evidence).
  - `basicModeChecks({ phases, scan, lines })` → BM1(감시 20회 초과 + 본 표식 0)·BM2(전이 표 + errand 없음 + discussion·nomination·night·morning·ended 를 지남)·BM3(띠 글에 금지 문구 0, 본 글 0개면 측정값 없음).
  - `basicViewKeyChecks(keys)` → BM1k.
- `browser.mjs`: `hostLineScannerScript()`(100ms 마다 `[data-host-line]` 글을 중복 없이 모음)·`readHostLines(page)`.
- `modes.mjs`: `mode-basic` — 방장(시민) + 참가자 + 봇 넷, 두 페이지에 감시 둘을 처음부터 걸고 `skipOnce` 로 ended 까지.
- `host.mjs`: `lobbyWith`·`walkLeak` 의 `mode` 인자, `emceeLeakFlow` 의 본문을 `leakFlow(ctx, id, mode)` 로 묶고 `mode-leak` 을 더했다.
- `flows.mjs`: 두 흐름 등록(390x844). `e2eContract.test.ts`: 금지 문구 사본·없어야 할 표식·흐름 등록 계약.

## Task 커밋

1. **Task 1: 순수 판정과 사본 계약** — `79670eca` (test) → `68d1d500` (feat)
2. **Task 2: 흐름** — `24caf595` (feat)
3. **Task 3: 두 판 실행** — 실행 중 판정 하나를 더했다: `67a90457` (test) → `9f86bdc7` (feat). 결과는 이 문서.

## RED 증거

기록은 `.gsd/red/19-07-{t1-lib,t1-contract,t3-lib}.{tap,json,verdict.json}`(gitignore 된 로컬 파일). 셋 다 `gsd-tools check tdd-red-evidence` 가 `RED_EVIDENCE_OK`(target_test_failed)를 냈다.

- **t1-lib** `node --test --test-reporter=tap scripts/e2e/lib.test.mjs` → exit 1, 450개 중 not ok 6(전부 ERR_ASSERTION), ok 444. 대상: "basicModeChecks: 정상 입력(…)은 BM1~BM3 모두 통과 …" — 기대 판정 줄 id `BM1,BM2,BM3`, 실제 빈 문자열(자리 함수).
- **t1-contract** `npx vitest run test/unit/e2eContract.test.ts --reporter=tap-flat` → exit 1, 97개 중 not ok 2(둘 다 AssertionError), ok 95. 대상: "BASIC_FORBIDDEN_LINES 는 HOST_LINES 의 심부름·목격 기록·증거 줄 값이다 …" — 기대 문장 넷, 실제 빈 문자열(자리 상수).
- **t3-lib**(Task 3 에서 더한 BM1k) 같은 명령 → exit 1, 452개 중 not ok 2(둘 다 ERR_ASSERTION), ok 450. 대상: "basicViewKeyChecks BM1k: …" — 기대 `BM1k:true:`, 실제 `:true:`(자리 함수의 빈 id).

의미 판정: 세 번 모두 대상 시험이 돌았고 계획한 단언에서 실패했다. 실패한 시험은 새로 쓴 것뿐이다. t3-lib 의 첫 실행은 중복 import 로 모듈이 읽히지 않았다(문법 오류) — RED 로 치지 않고 import 를 고친 뒤 다시 돌린 기록이 위 값이다. 그 전에는 구현을 시작하지 않았다.

## 검증 결과

| 명령 | 결과 |
| --- | --- |
| `node --test scripts/e2e/lib.test.mjs && npx vitest run test/unit/e2eContract.test.ts` (Task 1) | 통과 — 452 tests · 98 tests |
| `node --check` 네 파일 + `node --test scripts/e2e/lib.test.mjs` (Task 2) | 통과 |
| `node --test scripts/e2e/*.test.mjs` | 통과 — 583 tests |
| `npx vitest run --project unit` | 통과 — 139 files(1 skipped) · 4676 tests(106 skipped) |
| `npx tsc -p tsconfig.app.json --noEmit` | exit 0 |
| 위생 git grep(scripts/e2e·e2eContract) | 결과 없음 |

돌리지 않은 것: client·worker 시험 묶음(앱을 고치지 않았다), 폰 6종 전체 회귀(19-08), 배포.

### E2E 흐름 × 판정 (로컬 `http://localhost:5173`, 390x844, 마지막 실행)

| 흐름 | 판 종류 | 통과/전체 | 판정 구성 |
| --- | --- | --- | --- |
| mode-basic | 기본 마피아 | 19/19 | 준비 2 · BM0 1 · 방장·참가자 각 (BM1·BM2·BM3·BM1k + 참고 셋) 14 · BMm·BMn 2 |
| mode-leak | 기본 마피아 | 25/25 | 준비 10 · LK0 5 · LK1·LK2·LKm 3 · HL1~HL4 4 · VK1·BM1k 2 · 참고(VK1i) 1 |
| basic-off | 확장판 | 10/10 | 준비 2 · OFF0~OFF5(OFF1i·OFF3b 포함) 8 |
| emcee-leak | 확장판 | 23/23 | 준비 10 · LK0 5 · LK1·LK2 2 · HL1~HL4 4 · VK1 1 · 참고(VK1i) 1 |
| trace | 확장판 | 53/53 | 밤 얼굴 목록(NF) · 흔적 카드(TC·TC7·TC8) · TR0~TR10 · OU1·OU2 · 묶음 G·H |

실패 0. 간헐 실패 0(다시 시도한 흐름 없음).

판정별:

| 판정 | 무엇 | mode-basic | mode-leak |
| --- | --- | --- | --- |
| BM0 | 대기실부터 결과까지 닿는다 | 통과 | (LKm 이 다섯 판 결과 도달을 본다) |
| BM1 | 심부름(`data-errand-*`)·흔적·목격 표시·증거 카드·[기록] 단추 DOM 0건 | 방장·참가자 통과 | — |
| BM2 | 심부름 없는 단계 순서로 완주 | 방장·참가자 통과 | — |
| BM3 | 띠에 심부름·기록·증거 안내 0 | 방장·참가자 통과 | — |
| BM1k | 받은 키에 me.errand·me.record·day.evidence 0 | 방장·참가자 통과 | 다섯 판 통과 |
| LK1·LK2 | 역할 다섯 시점·밤 다섯 곳을 읽었다 | — | 통과(읽기 60곳) |
| LKm | 다섯 판 모두 basic·결과 도달·errand 없음 | — | 통과 |
| HL1~HL4 | 남의 역할 줄·문구 없음 · 할 일 없는 시점 띠 같음 · 유령 띠에 역할 이름 없음 · 밤 빛남 수 같음 | — | 통과 |
| VK1 | view 키가 허용 목록 안 | — | 통과(최상위 16·me 12·day 12) |

실행 횟수: mode-basic 은 기본 마피아로 세 번(19/19 세 번), mode-leak 두 번(23/23 → 판정 둘을 더한 뒤 25/25), emcee-leak 두 번(22/22 → 참고 줄을 더한 뒤 23/23), basic-off·trace 한 번씩.

### 두 판 대조

- **기본 마피아:** 받은 단계 열 `lobby>assigning>roleReveal>dayAnnounce>discussion>nomination>defense>verdict>execution>night>morning>dayAnnounce>discussion>nomination>defense>verdict>execution>ended`(마지막 실행, 방장·참가자 같음. 다른 두 실행은 `…>night>morning>ended` 와 이틀째 아침에 끝남). 감시 방장 271회·참가자 264회, 본 띠 글 14가지·13가지, 없어야 할 표식 0건. 받은 키 me `[allies,allyPicks,chat,isHost,nightTally,records,role,seat,testBotVote,testBots,testMode,testRole]` · day `[ballots,candidate,chalk,endCount,execution,morning,n,points,roles,verdict,voteLog,voted]`(mode-leak 다섯 판 합).
- **확장판:** basic-off 의 감시가 본 단계 열 `… dayAnnounce → errand → discussion → …`(심부름을 지남), trace 의 흔적 판정(TR0~TR10·TC·TC7·TC8) 통과. emcee-leak 다섯 판이 받은 키는 위 목록에 **me.errand 와 day.evidence 가 더해진 것**이다(me 13·day 13) — 두 판의 키 차이가 정확히 심부름·증거다.

### 반대 판으로 본 감시(커밋하지 않은 한 번 실행)

mode-basic 의 판 종류만 확장판으로 바꿔 한 번 돌렸다(파일은 바로 되돌렸다). 9줄이 실패했다 — BM1 `data-errand-* 1건(errand, data-errand-layer); [data-trace-mark] 1건(dayAnnounce)`(방장·참가자), BM2 `errand 단계가 나왔다; dayAnnounce → errand 는 기본 마피아 전이가 아님`(방장·참가자), BM3 `띠에 '빛나는 곳을 찾아 처리해 주세요'`(방장), BM1k `me.errand, day.evidence`(방장·참가자), BMm·BMn. 감시와 판정이 실제로 잡는다(T-19-22).

참가자 쪽 BM3 은 그 실행에서 실패하지 않았다. 참가자는 첫날 탈락해 둘째 날 심부름을 유령 줄("지켜봐 주세요")로 봤고, 첫날 심부름은 시작 카드가 떠 있는 동안 띠가 빈 글이라 250ms 뒤 넘긴 화면에 문장이 나오지 않았다.

## 계획과 달라진 점

### 고친 것

**1. [Rule 1 - 판정] 띠 금지 문구에서 errand.ghost 를 뺐다**
- **찾은 때:** Task 1, `src/game/hostLine.ts` 를 읽을 때
- **무엇:** 계획은 금지 문구를 "HOST_LINES 의 다섯 키(errand.act·errand.done·errand.ghost·witness·discussion.evidence) 값"으로 적었다. errand.ghost 의 값 "지켜봐 주세요"는 dayAnnounce.ghost·nomination.ghost·verdict.ghost 와 같은 문장이다. mode-basic 의 참가자는 첫날 탈락해 유령이 되므로 그대로 넣으면 기본 마피아가 맞는데도 BM3 이 실패한다.
- **고친 것:** `BASIC_FORBIDDEN_LINES` 는 넷이다. 계약 시험은 "다섯 키의 값 중 기본 마피아에서도 닿는 다른 키와 글이 같은 것을 뺀 목록"과 사본이 같음을 보고, 뺀 키가 errand.ghost 하나임을 이름으로 고정한다(문구가 바뀌어 겹침이 늘거나 줄면 시험이 깨진다).
- **파일:** scripts/e2e/lib.mjs, scripts/e2e/lib.test.mjs, test/unit/e2eContract.test.ts · **커밋:** `79670eca`·`68d1d500`

**2. [Rule 2 - 판정] 받은 키 판정 BM1k 를 더했다**
- **찾은 때:** Task 3, mode-leak 과 emcee-leak 의 VK1 이 둘 다 "day 13개"로 나왔을 때(허용 목록 판정이라 기본 마피아가 증거 키를 받았어도 통과한다)
- **무엇:** UI-SPEC E-1 의 판정 근거는 "서버가 키를 싣지 않는다"인데 계획의 BM1 은 화면(DOM)만 잰다. 화면이 키를 무시해 그리지 않는 것과 서버가 싣지 않는 것을 가르지 못한다.
- **고친 것:** `BASIC_OFF_VIEW_KEYS`·`basicViewKeyChecks`(BM1k)를 시험 먼저 쓰고 구현해 mode-basic 두 페이지와 mode-leak 다섯 판에 쓴다. 누설 흐름에는 받은 키 이름 참고 줄(VK1i)도 남긴다. 다시 돌려 보니 기본 마피아는 day 12개(증거 없음)였고 앞의 13은 다른 키였다 — 서버는 처음부터 맞았다.
- **파일:** scripts/e2e/lib.mjs, lib.test.mjs, modes.mjs, host.mjs · **커밋:** `67a90457`·`9f86bdc7`

**3. [Rule 2 - 판정] mode-leak 에 판 종류 적용 확인(LKm)을 더했다**
- **무엇:** 계획은 "판정 id 는 emcee-leak 과 같다"였다. 그대로면 판 종류가 적용되지 않은 채 확장판으로 다섯 판을 돌아도 통과한다.
- **고친 것:** `walkLeak` 이 판마다 마지막 view.mode·errand 를 지났는지·결과 도달을 남기고 LKm 이 "다섯 판 모두 basic·결과 도달·errand 없음"을 본다(T-19-22).
- **커밋:** `24caf595`

### 계획에 없던 작은 선택

4. **BM2 는 전이 표로 순서 전체를 본다.** 계획의 조건(errand 없음·낮 발표 다음 토론 또는 ended·필수 단계)을 포함하고, 그 밖의 건너뜀(예: 토론 → 찬반, tutorial 단계)도 실패다. 전이 표는 기존 OFF3 의 표에서 errand 를 뺀 것이다.
5. **mode-basic 의 참가자는 유령 시점이다.** 계획의 설정(`vote: { pick: "other" }`)에서 봇은 방장이 아닌 가장 낮은 자리 = 참가자를 지목한다. 참가자는 첫날 처형되어 밤·아침·둘째 날을 유령 화면으로 본다. 산 사람 시점(방장)과 유령 시점을 한 판에서 같이 재는 셈이라 그대로 뒀다.
6. **`emceeLeakFlow` 의 본문을 `leakFlow` 로 묶었다.** 두 흐름이 같은 본문을 쓴다(복사하지 않았다). emcee-leak 의 판정은 그대로이고 참고 줄 VK1i 가 한 줄 늘었다(22 → 23).
7. **e2eContract 에 흐름 등록 계약을 더했다**(mode-basic·mode-leak 의 등록 모양, 두 누설 흐름이 leakFlow 를 부르는 모양). 계획은 Task 2 의 파일에 이 파일을 적지 않았다.
8. **개발 서버를 끄지 않았다.** 시작할 때 이미 떠 있던 서버를 그대로 썼다(내가 띄운 것이 아니다). 계획의 "끝나면 끈다"는 띄운 경우의 말로 읽었다.
9. **실행 명령:** `npm run e2e -- …` 대신 같은 스크립트를 `node scripts/e2e/run.mjs …` 로 불렀다.
10. **띠 글 원문은 결과 줄에 남기지 않는다.** 띠 문장에 이름이 들어갈 수 있어 개수만 적고, 실패했을 때만 걸린 금지 문구(고정 문장)를 적는다.

---

**합계:** 고친 것 3(판정 3) + 작은 선택 7. 앱 코드 변경 없음.
**영향:** 1번은 계획이 적은 사본 값에서 벗어난 유일한 곳이고 이유는 문장 겹침이다. 2·3번은 판정을 더한 것이라 통과 기준이 계획보다 엄격하다.

## Threat 처리

| Threat | 처리 |
| --- | --- |
| T-19-21 기본 마피아 화면·프레임 누설 | mode-leak 이 역할 다섯 시점 60곳의 DOM·띠·view 키를 HL1~HL4·VK1 로 쟀다(통과). 받은 키에 심부름·기록·증거가 없음(BM1k)도 다섯 판에서 봤다 |
| T-19-22 감시·판정의 공허 통과 | 감시 횟수 > 20·본 띠 글 > 0·받은 me 키 > 0 을 요구한다. 없어야 할 표식 다섯과 `data-errand-` 속성이 git 추적 src 의 .tsx 에 있음을 e2eContract 가 본다. 반대 판 실행에서 판정 넷이 모두 실패함을 확인했다. mode-leak 은 LKm 으로 판 종류 적용을 본다 |
| T-19-23 배포본 쓰기 한도 | 모든 실행은 로컬(`http://localhost:5173`). 배포본을 대상으로 돌리지 않았다 |
| T-19-SC 패키지 설치 | 설치 없음 |

## Known Stubs

없음.

## 다음 계획이 알아야 할 것 (19-08 전체 회귀·문서·배포)

- **기본 실행에 흐름 둘이 더해졌다:** mode-basic(약 25초)·mode-leak(약 90초), 둘 다 390x844 한 크기. `--only mode` 는 이제 네 흐름(mode-rail × 6 · mode-pick · mode-basic · mode-leak)을 고른다.
- **`--only` 부분 일치:** `mode-basic` 과 `basic-off`·`basic-vote` 는 서로 겹치지 않는다. `--only basic` 은 셋 모두 고른다. `--only leak` 은 emcee-leak·mode-leak 둘을 고른다.
- **`docs/screen-map.md` 자동 검사 지도에 옮길 것:** mode-basic(BM0·BM1·BM2·BM3·BM1k·BMm·BMn)·mode-leak(LK1·LK2·LKm·HL1~HL4·VK1·BM1k), 없어야 할 표식 다섯 + `data-errand-*`, 금지 문구 넷(errand.ghost 는 뺀 이유와 함께).
- **이름 주의:** `lib.mjs` 의 13페이즈 "기본판"(OFF* — 꺼진 장치, 두 판 종류 모두 해당)과 19페이즈 "기본 마피아"(BM* — 판 종류)는 다른 축이다. basic-off 는 확장판(서버 기본값)으로 돈다.
- **사회자 문구를 바꾸면** `BASIC_FORBIDDEN_LINES` 사본과 e2eContract 의 "뺀 키는 errand.ghost 하나" 단언이 같이 깨질 수 있다(의도한 고정).
- **심부름·흔적 표식을 새로 만들면** 이름이 `data-errand-` 로 시작하지 않는 한 BM1 이 보지 못한다 — `BASIC_ABSENT_SELECTORS` 에 더한다.
- **아침 흔적 키(`day.morning.trace`)는 E2E 가 프레임에서 보지 않는다**(안쪽 키라 키 집합에 없다). 화면 쪽은 BM1 의 `[data-trace-mark]`·`[data-trace-card]`, 서버 쪽은 19-01 의 modeBasic 시험이 맡는다.
- 19-06 이 넘긴 것(실측 표·알려진 한계 둘·돌리지 않은 흐름·`.planning/WINDOWS.md` 의 열린 항목)은 그대로다 — 이 계획은 건드리지 않았다.

## Self-Check: PASSED

- 파일: `scripts/e2e/lib.mjs`·`scripts/e2e/modes.mjs`·`scripts/e2e/host.mjs`·`scripts/e2e/browser.mjs`·이 문서 — 있음.
- 커밋: `79670eca`·`68d1d500`·`24caf595`·`67a90457`·`9f86bdc7` — HEAD 의 조상.
- Acceptance(Task 1): `export function basicModeChecks` 1 · e2eContract 의 `BASIC_FORBIDDEN_LINES` 4(1 이상) · RED 증거 위 절.
- Acceptance(Task 2): flows.mjs 의 `"mode-basic"` 1 · `"mode-leak"` 1 · browser.mjs 의 `hostLineScannerScript` 2(1 이상) · host.mjs 의 `pickModeViaRail` 2(1 이상).
- Acceptance(Task 3): 위 표에 다섯 흐름의 결과, 실패 0. 앱을 고치지 않아 `npm test` 전체는 돌리지 않았다(unit 묶음은 통과).
