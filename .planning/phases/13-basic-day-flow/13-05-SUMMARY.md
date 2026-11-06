---
phase: 13-basic-day-flow
plan: "05"
subsystem: e2e-basic-day
tags: [e2e, playwright, absence-check, simultaneous-vote, flow-01, flow-02, flow-03, flow-05]

requires:
  - phase: 13-01
    provides: RULESET(다섯 값 모두 꺼짐), 15초 동시 투표 nomination
  - phase: 13-02
    provides: 봇 동시 투표, 테스트 방 넘기기가 봇 표를 채움
  - phase: 13-03
    provides: 동시 투표 화면(제목 투표, 깜빡임 3초, 헤더 링 15초)
  - phase: 13-04
    provides: 꺼진 장치 view 게이트·화면 진입점 게이트
provides:
  - 꺼진 장치 부재 판정 순수 함수(OFF_DEVICE_SELECTORS, offDeviceKeysOf, basicOrderChecks)와 시험
  - tracker 가 판 전체의 꺼진 장치 경로(offKeys)·단계 열(phases)을 모음
  - day·noexec·sound-script 가 동시 투표 흐름을 검사(NM1~NM10, NE0~NE9, SC6~SC8)
  - 새 흐름 basic-off(한 판 전체 부재) · basic-vote(8명 투표 화면 기하)
  - 꺼진 장치 흐름 7개는 지우지 않고 skipByDefault
affects: [13-06]

requirements-completed: [FLOW-01, FLOW-02, FLOW-03, FLOW-05]

actuals:
  tokens: 19400
  tasks: 3
  commits: 5

plan_head_before: 36b7eb27dcc000b915f7069b65b53289c0afbcf1
plan_head_after: 67a33d6c3d1717b3483c2da0c51355162eea7cfa

tech-stack:
  added: []
  patterns:
    - "부재 검사는 단계마다 한 번 재지 않고 로비부터 결과까지 100ms 감시 스크립트(init script)가 처음 걸린 것만 기록한다"
    - "프레임 흔적은 경로 문자열만 모은다(값·원문·토큰 없음). 빈 resultLog 묶음은 흔적이 아니다"
    - "투표 기하는 모여서 멈춘 뒤(버튼 사각형이 두 번 연속 같음) 잰다 — 15초 안에 걸어 모이므로"

key-files:
  created: []
  modified:
    - scripts/e2e/lib.mjs
    - scripts/e2e/lib.test.mjs
    - scripts/e2e/browser.mjs
    - scripts/e2e/flows.mjs
    - scripts/e2e/sound.mjs
    - src/screens/GameMap.tsx
    - test/client/badgeUi.test.tsx
    - test/unit/e2eContract.test.ts

key-decisions:
  - "basic-vote 는 계획의 봇 7 대신 방장 + 4자 이름 사람 손님 7 로 만든다(봇 첫 이름이 8자 고정이라 UI-SPEC 의 '4자 이름' 전제와 다름)"
  - "basic-off 는 목표 단계를 정하지 않고 한 칸씩(skipOnce) 넘긴다 — 동률·0표로 단계가 건너뛰어도 멈추지 않는다"
  - "서버 표 바꾸기 연타 방어(250ms)는 시험이 간격을 둔다(문턱·서버는 그대로)"

status: complete
---

# Phase 13 Plan 05: 기본판 낮 흐름 E2E Summary

**브라우저 E2E 가 동시 투표 낮 흐름(토론 → 투표 → 변론 → 찬반 → 처형)과 처형 없음, 그리고 꺼진 장치가 로비부터 결과까지 DOM·프레임·단계 순서·결과 탭 어디에도 0건임을 폰 6종에서 확인하며, 이 검사가 실제 흔적 하나(배지 스크린리더 줄)를 잡아 고쳤다.**

## 한 일

### Task 1 — 순수 판정 (RED `f1cc3dc1` → GREEN `b7c059fc`)

- `lib.mjs`: `NOMINATION_MS`(15000 사본), `OFF_DEVICE_SELECTORS`(UI-SPEC 표 10개, 동결), `OFF_DEVICE_ATTR_PREFIX`(`data-turn`), `offDeviceKeysOf(msg)`, `basicOrderChecks(phases)`. `SOUND_SCRIPT_STEPS` 의 SC6~SC8 은 기본판 기대(bed.vote·phase.vote, 차례 소리 pin.on·pick.turn·pick.tick·pick.point·pin.move 는 나오면 안 됨)로 바꿨다.
- `browser.mjs` tracker 에 `offKeys`(경로 문자열만)·`phases`(연속 중복 접음)를 더했다. 순차 전용 함수·상수(`turnBlockChecks`, `nominationMaxMs` 등)는 지우지 않았다.
- `test/unit/e2eContract.test.ts` 에 `NOMINATION_MS` 사본이 앱 상수와 같은지 확인하는 줄을 더했다.
- `node --test scripts/e2e/lib.test.mjs` 322 통과.

### Task 2 — 기존 흐름을 동시 투표로 (`2d329224`)

- `day`: 순차 NT 블록을 동시 투표 NM1~NM6(되살림) + NM2b·NM7(제목 "투표")·NM8·NM8b(시작 직후 이름표 깜빡임 3초 안에 멈춤)·NM9·NM9b(마음 바꾸기에 모든 페이지 배지가 따라 바뀌고 되돌림)·NM10(`[data-turn-block]` 0·어둡게 막 꺼짐)로 교체. 문턱은 낮추지 않았다.
- `noexec`: NE0 "아무도 안 고르면 투표 15초 뒤 변론 없이 밤"(`NOMINATION_MS + 8000` 한도), 봇 부분은 동시 투표(NE6~NE9: 버튼 8자 이름 기하, 봇 셋이 2~8초 안에 방장을 가리킴, 배지 합 = 봇 수).
- `sound-script`: 내 차례 대기를 "투표 진입 → 내가 한 사람을 누름"으로 바꾸고 SC6~SC8 기대를 따름. 판결 순간 관찰(soundVerdictWatch)은 봇 표로 변론자를 정함.
- FLOWS: politics-badge·whisper·pin·runoff·runoff-tie·showdown·showdown-tie 에 `skipByDefault: true`(politics-verdict 는 그대로). lib.test 에 "꺼진 장치 흐름 7개는 skipByDefault" 단언 추가, extraSizes 정규식이 skipByDefault 항목도 읽도록 고침.
- 쓰지 않게 된 가져오기(tapTurnPick·waitSysLine·turnBlockChecks·nominationMaxMs·PICK_*)를 flows.mjs 에서 정리.

### Task 3 — 새 흐름 + 로컬 실행 (`54382b09`, `67a33d6c`)

- `basic-off`(OFF0~OFF5, 390x844): 방장 + 봇 5(pick other·exec yes)를 `skipOnce` 로 한 칸씩 넘겨 ended 까지. 페이지 init 스크립트(100ms 감시)가 선택자 10개와 `data-turn*` 속성을 로비부터 결과 연출까지 지켜본다. 이후 `tracker.offKeys` 비어 있음, `basicOrderChecks(tracker.phases)`, 결과 화면 탭은 있고 귓속말 탭 없음, 토론에 `[토론 끝내기]` 하나.
- `basic-vote`(BV1·BV2·BV4~BV6, 폰 6종): 투표 화면 이름표 버튼 7개의 44×44·무가림(`pickButtonChecks`), 묶음 G·H, 제목 "투표"와 헤더 시간 링, 순차 블록 없음, 손님 일곱이 방장을 누르면 득표 배지 합 7, 표가 쌓인 뒤 기하 유지.
- `browser.mjs`: `skipOnce`(한 칸 넘기기), `offScannerScript`·`readOffScan`(감시) 추가.

## 흐름 × 크기 결과 (로컬 `npm run dev`, `--url http://localhost:5173`)

| 묶음 | 흐름 | 크기 | 결과 |
|------|------|------|------|
| (a) `--only day,ghost` | day | 360x640·390x664·430x932·360x560·390x844·402x874 | 111/111 ×6 |
| (a) | ghost | 360x640·360x560·390x844 | 43/43 |
| (a) | ghost | 430x932·402x874 | 41/41 |
| (a) | ghost | 390x664 | 35/35 |
| (b) `--only noexec,basic-off,chat-game` | noexec | 390x844 | 23/23 |
| (b) | basic-off | 390x844 | 10/10 (OFF0~OFF5 모두 통과) |
| (b) | chat-game | 390x844 | 13/13 |
| (c) `--only basic-vote` | basic-vote | 390x664·360x640·390x844·360x560·402x874 | 15/15 |
| (c) | basic-vote | 430x932 | 14/14 |
| (d) `--only sound-script,politics-verdict` | sound-script | 390x844 | 36/36 |
| (d) | politics-verdict | 6종 전부 | 33/33 ×6 |

basic-off OFF1~OFF5 는 모두 통과다. 개발 서버는 끝낸 뒤 종료했다(5173 비어 있음).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 기본판 낮 시작에 `[data-badge-live]` 빈 스크린리더 줄이 남아 있었다**
- **Found during:** Task 3, basic-off 첫 실행 (OFF1 `[data-badge-live] 1건(dayAnnounce)`)
- **Issue:** UI-SPEC "끄는 장치" 표는 주장 배지의 스크린리더 알림도 그리지 않는다고 하는데 `GameMap.tsx` 가 `role="status"` 줄을 항상 만들었다.
- **Fix:** `RULESET.badge` 가 켜질 때만 줄을 그린다. `test/client/badgeUi.test.tsx` 에 기본판 4단계 0건 시험 추가(RED 확인 후 GREEN), 켜짐 전용 live 시험은 `it.skipIf(!RULESET.badge)`.
- **Files modified:** `src/screens/GameMap.tsx`, `test/client/badgeUi.test.tsx`
- **Commit:** `54382b09`

**2. [Rule 3 - 계획 전제 불일치] basic-vote 를 봇 7 대신 4자 이름 손님 7 로 만들었다**
- **Found during:** Task 3, basic-vote 첫 실행 (6종 모두 PK3 "지목 버튼끼리 가려지지 않음" 실패)
- **Issue:** 계획은 방장 + 봇 7 이지만 봇 이름은 첫 봇이 8자 고정(결정 0052-3·0062-8)이고 UI-SPEC 의 8명 무가림 조건은 "4자 이름" 이다. 8자 이름 8명판은 이름표가 넓어 버튼이 겹쳤다(모이는 도중과 표가 쌓인 뒤 두 시점에서 관측, 모여서 멈춘 뒤 별도 재측정은 하지 않았다).
- **Fix:** 방장 + 4자 이름 손님 일곱(`BASIC_VOTE_GUESTS`)으로 바꾸고, 15초 안에 걸어 모이므로 버튼 사각형이 멈춘 뒤(`readGameStable`)에 잰다. BV6 은 봇 표 대신 손님 일곱이 방장을 누른 득표 배지 합 7 로 바꿨다. 문턱은 그대로다. 6종 모두 통과.
- **남는 사실:** 8자 이름(봇) 8명판 투표 화면의 버튼 겹침은 판정하지 않는다. UI-SPEC 가 4자 이름 기준이라 이 계획에서는 알려진 한계로 두며, 8자 봇 이름 8명판을 쓸지는 13-06 또는 사용자 판단이 필요하다.
- **Files modified:** `scripts/e2e/flows.mjs` (`openGame` 에 `guestNames` 옵션)
- **Commit:** `67a33d6c`

**3. [Rule 1 - 시험 간격] day NM9b "되돌리기"가 서버 연타 방어(250ms)에 걸렸다**
- **Found during:** Task 3, day 첫 실행
- **Issue:** 한 사람의 표 바꾸기를 250ms 안에 되풀이하면 서버가 받지 않는다(`POINT_MIN_INTERVAL_MS`, 의도된 방어). 시험이 바꾸기·되돌리기를 거의 붙여 눌렀다.
- **Fix:** 표 바꾸기 앞에 600ms 간격을 둔다(사람이 마음을 바꾸는 속도). 서버·문턱은 그대로.
- **Commit:** `67a33d6c`

**4. [Rule 2 - 계획 범위 보완] `offDeviceKeysOf` 가 빈 `resultLog` 묶음을 흔적으로 세지 않는다**
- **Found during:** Task 3, basic-off 첫 실행 (OFF2 `resultLog.part:whisper`·`claim`)
- **Issue:** 결과 화면은 묶음 네 부분을 모두 요청하고 서버는 꺼진 부분을 빈 줄로 답한다(13-04 이월 메모). 계획은 state·chat 프레임만 말하는데 내가 resultLog 까지 넣었다가 빈 응답을 오탐했다.
- **Fix:** 귓속말·주장 부분이 줄을 실제로 싣고 올 때만 표시한다. 시험 추가. state·chat 의 0건 요구는 그대로다.
- **Commit:** `67a33d6c`

## 알려진 간헐 실패

이 계획의 실행 동안 간헐 실패는 없었다(day·ghost 는 위 3번 수정 뒤 6종 전부 한 번에 통과).

## Known Stubs

없음.

## Threat Flags

없음. tracker 와 감시 스크립트는 경로 문자열·개수·단계 이름만 모으고 원문·값·토큰을 싣지 않는다(T-13-16). 문턱·허용 목록은 넓히지 않았고 장치 흐름은 지우지 않고 skipByDefault 다(T-13-15). 패키지 설치 없음(T-13-SC).

## 이월 메모 (13-06)

- 6종 전체 회귀는 13-06 에서 한 번 돈다. 이번에 돈 것은 day·ghost·noexec·basic-off·chat-game·basic-vote·sound-script·politics-verdict 뿐이다. 그 밖의 흐름(avatar-phases, sound-result, result-* 등)은 `skipTo` 로 지목을 지나지만 이번에 돌리지 않았다.
- politics-badge·whisper·pin·runoff·runoff-tie·showdown·showdown-tie 는 `--only` 로만 돈다. `RULESET` 를 켜면 같은 파일로 다시 돈다(`tapTurnPick`·`turnBlockChecks` 는 그대로 남아 있다).
- basic-vote 는 사람 손님 8 페이지라 크기 6종을 병렬 3 으로 돌면 한 묶음이 약 2분이다.
- 8자 이름 봇 8명판의 버튼 겹침은 위 편차 2 의 "남는 사실" 참고(판단 필요).

## Self-Check: PASSED

- 수정 파일 8개(`scripts/e2e/lib.mjs`, `lib.test.mjs`, `browser.mjs`, `flows.mjs`, `sound.mjs`, `src/screens/GameMap.tsx`, `test/client/badgeUi.test.tsx`, `test/unit/e2eContract.test.ts`) 존재, 커밋 f1cc3dc1·b7c059fc·2d329224·54382b09·67a33d6c 가 HEAD 의 조상임.
- 인수 기준: `export const OFF_DEVICE_SELECTORS` 1, `export function offDeviceKeysOf` 1, `export function basicOrderChecks` 1, browser.mjs 의 `offDeviceKeysOf` 사용, flows.mjs `skipByDefault: true` 8개, `"NM7"` 있음, `NOMINATION_MS` 사용, `id: "basic-off"`·`id: "basic-vote"` 각 1.
