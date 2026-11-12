---
phase: 19-game-modes
verified: 2026-11-12T19:50:00Z
status: human_needed
score: 60/63 must-haves verified
covered_files:
  - ".planning/phases/19-game-modes/19-01-PLAN.md"
  - ".planning/phases/19-game-modes/19-01-SUMMARY.md"
  - ".planning/phases/19-game-modes/19-02-PLAN.md"
  - ".planning/phases/19-game-modes/19-02-SUMMARY.md"
  - ".planning/phases/19-game-modes/19-03-PLAN.md"
  - ".planning/phases/19-game-modes/19-03-SUMMARY.md"
  - ".planning/phases/19-game-modes/19-04-PLAN.md"
  - ".planning/phases/19-game-modes/19-04-SUMMARY.md"
  - ".planning/phases/19-game-modes/19-05-PLAN.md"
  - ".planning/phases/19-game-modes/19-05-SUMMARY.md"
  - ".planning/phases/19-game-modes/19-06-PLAN.md"
  - ".planning/phases/19-game-modes/19-06-SUMMARY.md"
  - ".planning/phases/19-game-modes/19-07-PLAN.md"
  - ".planning/phases/19-game-modes/19-07-SUMMARY.md"
  - ".planning/phases/19-game-modes/19-08-PLAN.md"
  - ".planning/phases/19-game-modes/19-08-SUMMARY.md"
  - "docs/decisions/0086-v3-game-modes.md"
  - "scripts/e2e/browser.mjs"
  - "scripts/e2e/flows.mjs"
  - "scripts/e2e/host.mjs"
  - "scripts/e2e/lib.mjs"
  - "scripts/e2e/modes.mjs"
  - "shared/game/bots.ts"
  - "shared/game/mode.ts"
  - "shared/game/night.ts"
  - "shared/game/nomination.ts"
  - "shared/game/phases.ts"
  - "shared/game/rematch.ts"
  - "shared/game/room.ts"
  - "shared/game/ruleset.ts"
  - "shared/game/testTools.ts"
  - "shared/game/tick.ts"
  - "shared/game/view.ts"
  - "shared/protocol.ts"
  - "shared/schemas.ts"
  - "src/components/ModeSheet.tsx"
  - "src/components/WorldStage.tsx"
  - "src/components/v2/HostRail.tsx"
  - "src/components/v2/HostRailButton.tsx"
  - "src/components/v2/LineSheet.tsx"
  - "src/components/v2/MapChip.tsx"
  - "src/components/v2/ModeChip.tsx"
  - "src/components/v2/V2Icon.tsx"
  - "src/game/badgeView.ts"
  - "src/game/chatUi.ts"
  - "src/game/modeText.ts"
  - "src/game/resultText.ts"
  - "src/game/whisperView.ts"
  - "src/net/roomDiff.ts"
  - "src/screens/GameMap.tsx"
  - "src/screens/Lobby.tsx"
  - "src/screens/ResultScreen.tsx"
  - "src/styles/lobby.css"
  - "src/styles/result.css"
  - "src/styles/sheet.css"
  - "src/styles/tutorialRoom.css"
  - "src/styles/v2.css"
  - "test/client/hostRail.test.tsx"
  - "test/unit/gameMode.test.ts"
  - "test/worker/modeBasic.test.ts"
  - "test/worker/modePick.test.ts"
  - "worker/room.ts"
covered_digest: "v3:sha256:50b0112e03623a727a868f8949d47b1a07f4710ea7f94071e48bbd565fe94dfa"
behavior_unverified: 0
overrides_applied: 0
advisory:
  - finding: "전체 `npm test` 한 번에서 `test/worker/bots.test.ts` 의 '봇 셋이 모두 토론 끝내기를 누르면…' 1건이 실패했다(8292 통과·1 실패·261 건너뜀). 계획에 endDiscussion 3개를 기대했는데 2개였다"
    category: other
    reason: "따로 돌리면 통과한다(그 시험만 3번 중 3번, 파일 전체 27/27). 단언 줄은 8페이즈(2026-11-02)의 것이고 19페이즈가 고친 봇 코드(심부름 분기)는 토론 분기를 건드리지 않는다. 전체 실행의 부하에서만 나온 간헐 실패로 본다 — 계획을 세운 알람과 저장 값을 읽는 사이에 봇 행동이 먼저 돈 것으로 추정(원인 미확정). 19-08 요약의 8293 통과·실패 0 과 한 건 다르다"
    evidence_status: "전체 실행 1회 실패 · 단독 4회 통과(재현 안 됨)"
  - finding: "브라우저 E2E(mode-rail·mode-pick·mode-basic·mode-leak 과 전 흐름 회귀)는 이 검증에서 다시 돌리지 않았다"
    category: other
    reason: "값은 19-08-SUMMARY 의 것이다(요약 근거): mode-rail 폰 6종 41·39·39·41·39·39 전부 통과, mode-pick 41/41, mode-basic 19/19, mode-leak 25/25, 마지막 상태 7039 중 7036. mode-* 흐름은 앱 고침(WorldStage 의 탭 삼키기) 전의 한 번 실행 값이다. 같은 계약의 서버·화면 시험과 E2E 판정 함수 시험은 이 검증에서 직접 돌려 통과했다"
    evidence_status: "요약 근거(직접 재실행 없음)"
  - finding: "perfbudget B2(점광원 4 > 3)·M1(지오메트리 35 > 25) 3건이 E2E 실패 줄로 남아 있다"
    category: other
    reason: "13페이즈부터 이어진 알려진 한계(문턱 불변, 결정 0086 '알려진 한계'). 19페이즈가 만든 것이 아니다"
    evidence_status: "요약 근거"
  - finding: "E2E `errand` 흐름이 전체 회귀에서 간헐적으로 흔들린다(HS3·EA3)"
    category: other
    reason: "다시 돌리면 통과한다(원인 미확정, 결정 0086 '알려진 한계')"
    evidence_status: "요약 근거"
  - finding: "360×560 방장 대기실에서 줄이 두 열로 접히면 입장 알림이 둘째 열 단추를 약 1.5초 덮는다. 짧은 폰에서는 왕관 표식이 빠진다. 줄·칩이 이름표 끝을 가릴 수 있다"
    category: other
    reason: "결정 0086 '알려진 한계'. 가장 작은 화면의 진행에 지장 없는 겹침은 그대로 둔다는 사용자 방침"
    evidence_status: "결정 기록·E2E 판정 코드(HOST_RAIL_KNOWN_LIMITS) 대조로 확인"
  - finding: "계획 프런트매터의 key_links `from` 이 '파일 + 기호' 모양이라 `verify.key-links` 도구가 15개를 'Source file not found' 로 돌려보냈다"
    category: other
    reason: "도구 입력 형식 문제다. 17개 모두 선언된 패턴을 해당 파일에서 손으로 확인했다(아래 Key Link 표). 다음 계획에서는 `from` 에 파일 경로만 적는다"
    evidence_status: "grep 으로 확인"
  - finding: "결과 화면의 `expanded` 조건은 지금 켜질 일이 없고, `MapChip` 의 줄 아닌 변형이 쓰이지 않은 채 남아 있다. 판 종류별 튜토리얼이 없다"
    category: other
    reason: "결정 0086 '알려진 한계'"
    evidence_status: "결정 기록 대조"
human_verification:
  - test: "방장 폰으로 대기실에 들어가 왼쪽 세로 줄([판 종류]·[맵]·[봇]·[튜토리얼 먼저])과 오른쪽 열([소리]·[옷장])을 본다"
    expected: "방장 전용 단추가 왼쪽에 모여 있고 금빛 테두리·왕관 표식으로 오른쪽 공용 단추와 한눈에 구별된다. 낮은 채도를 유지한다"
    why_human: "색 구별·분위기는 눈으로만 판단할 수 있다(성공 기준 6)"
  - test: "짧은 폰과 긴 폰에서 방장 대기실을 확장판·기본 마피아로 번갈아 본다"
    expected: "줄이 아래 패널과 겹치지 않는다. 넘칠 폰에서는 표식이 먼저 빠지고 두 열로 접힌다"
    why_human: "19-06 backstop 항목. 근거가 E2E 요약 값뿐이라 이 검증에서 직접 관찰하지 못했다"
  - test: "폭이 좁은 폰(360)에서 [판 종류] 시트를 연다"
    expected: "설명 '증거를 찾아 추리해요' 가 두 줄로 접혀도 두 칸 높이가 같고 시트가 화면 밖으로 넘지 않는다"
    why_human: "19-06 backstop 항목. 실제 글자 줄바꿈은 기기에서만 확인된다"
  - test: "한 판을 끝내고 결과 화면을 방장·참가자 폰으로 본다"
    expected: "연출이 끝나기 전에는 줄·칩이 없고, 끝난 뒤 줄이 [처음으로]·[다시 하기]·아래 패널과 겹치지 않는다. 방장이 판 종류를 바꾸고 다시 하기를 시작하면 새 판이 그 종류로 돈다"
    why_human: "19-06 backstop 항목. 연출 시점과 겹침은 실제 화면에서 본다"
  - test: "방장이 판 종류를 바꿀 때 다른 폰의 참가자 화면을 본다"
    expected: "참가자 왼쪽 위 칩이 새 판 이름으로 바뀌고 알림 한 줄 '판 종류: …' 이 뜬다. 참가자는 칩을 눌러도 아무 일 없다"
    why_human: "여러 기기 사이의 방송은 실기기 실테스트로 확인한다"
  - test: "기본 마피아로 한 판, 확장판으로 한 판을 배포본(minifia-v3)에서 끝까지 한다"
    expected: "기본 마피아는 역할 → 토론·투표·처형 → 밤 → 아침 발표뿐이고 심부름·[기록]·흔적 표시가 한 번도 없다. 확장판은 지금까지와 같다"
    why_human: "실제 사람이 하는 한 판의 흐름·몰입은 v3.0 끝 실테스트에서 본다(사용자 방침)"
---

# Phase 19: 방장이 고르는 기본 마피아·확장판 Verification Report

**Phase Goal:** 방장이 대기실에서 "기본 마피아"와 "확장판"을 고를 수 있다(결정 0081-6·0086). 판 규칙은 전역 상수가 아니라 방마다 정해진 값을 서버가 읽는다. 기본 마피아는 심부름·흔적 없이 토론·투표·밤·아침 발표만 있다. 방장 전용 조작은 왼쪽 세로 줄에 모으고 색으로 구별한다.
**Verified:** 2026-11-12T19:50:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

코드·시험으로 확인할 수 있는 must-have 는 모두 통과했다. 남은 것은 실기기 눈 확인 6건이고(사용자 방침에 따라 v3.0 끝 실테스트로 미룬다), 그중 3건은 19-06 의 backstop 항목이다.

근거는 두 가지로 구별해 적는다.

- **직접**: 이 검증에서 코드를 읽거나 명령을 돌려 확인한 것.
- **요약 근거**: 19-06·19-07·19-08 SUMMARY 의 브라우저 E2E 값. 다시 돌리지 않았다.

## Goal Achievement

### Observable Truths — ROADMAP 성공 기준

| # | Truth | Status | Evidence |
| --- | --- | --- | --- |
| 1 | 방장이 대기실·결과 단계에서 판 종류를 고르고 기본값은 확장판이다. 값은 방 상태에 저장·방송되고 참가자는 읽기 전용 칩으로 보며 다시 하기에서도 유지된다 | ✓ VERIFIED | 직접: `shared/game/mode.ts` `pickMode`(방장·lobby/ended·허용 값), `worker/room.ts` `handleModePick`(거절은 보낸 소켓 state 한 프레임, 같은 값 0프레임, 바뀌면 `persistAndBroadcast`), `shared/protocol.ts` `DEFAULT_MODE = "extended"`, `shared/schemas.ts` strictObject, `view.ts` 가 `mode: modeOf(state)` 를 두 view 모두에 실음, `rematch.ts` `REMATCH_ROOM_KEYS` 와 `testTools.ts` 가 mode 를 남김. `Lobby.tsx`·`ResultScreen.tsx` 가 방장에게 `HostRail` + `ModeSheet`, 참가자에게 `ModeChip`. 시험 `modePick.test.ts`·`modeBasic.test.ts`·`gameMode.test.ts`·`lobby.test.tsx`·`resultScreen.test.tsx` 통과 |
| 2 | `ruleset.ts` 의 규칙이 방 상태의 값이 되고 RULESET 을 읽던 12개 파일이 모두 방 값을 읽는다 | ✓ VERIFIED | 직접: `git grep RULESET -- src shared worker test scripts` 일치 0(종료 코드 1). `ruleset.ts` 는 `rulesetOf`·`modeOf`·`politicsOn` 만 내보냄. tick·nomination·room·phases·view·bots·night·`worker/room.ts`(`rulesNow`)는 `rulesetOf(modeOf(state))`, whisperView·badgeView·GameMap 은 `rulesetOf(modeOf(view))`, resultText 는 화면이 넘긴 `rules.whisper` 인자(`GameMap.tsx:1061` → `LineSheet`) |
| 3 | 기본 마피아 판은 역할 → 낮 토론·투표·처형 → 밤 → 아침 발표이고 심부름·기록·흔적 표시가 나오지 않는다 | ✓ VERIFIED | 직접: `phases.ts` `nextPhaseOf`(dayAnnounce 다음이 `rules.errand ? errand : discussion`), `tick.ts` 가 걸음마다 `HOOKS[modeOf(current)]`, `night.ts` 가 `rules.trace`·`rules.witness` 로 흔적·마지막 목격을 만들지 않음, `view.ts` 가 `me.errand`·`me.record`·`day.evidence`·`morning.trace`·`morning.seen` 키를 싣지 않음. `modeBasic.test.ts`(한 판 전체 프레임에 그 키 0), `gameMap.test.tsx` 기본 마피아 describe(DOM 0), `hostLine.test.ts` 통과. 요약 근거: E2E mode-basic 19/19 |
| 4 | 확장판은 지금 v3.0 흐름 그대로다 | ✓ VERIFIED | 직접: mode 없는 방은 `modeOf` 가 extended, `modeBasic.test.ts` 대조 describe(낮 발표 다음이 심부름, `me.errand` 받음), `modePick.test.ts` 통과. 전체 `npm test` 한 번에서 8292 통과(1건 간헐 실패는 advisory). 요약 근거: 확장판 E2E 흐름(emcee·errand·witness·trace·basic-off) 통과 |
| 5 | 두 판 모두 E2E 한 판 완주와 누설 검사를 통과하고 배포된다 | ✓ VERIFIED | 직접: `/api/health` version `2026-11-12T16:47:00Z+71a10fc8`, `git diff --stat 71a10fc8 HEAD -- src public worker shared scripts test` 가 비어 있음(그 뒤 커밋은 문서뿐). `flows.mjs` 에 mode-rail·mode-pick·mode-basic·mode-leak 이 기본 실행으로 등록됨. 서버 누설 시험 `leak.test.ts`·`modeBasic.test.ts` 통과. 요약 근거: mode-basic 19/19·mode-leak 25/25, 전 흐름 7039 중 7036(남은 3건 perfbudget 알려진 한계) |
| 6 | 방장 전용 기능은 화면 왼쪽 세로 줄에 모으고 단추 색을 공용 단추와 구별한다 | ✓ VERIFIED | 직접: `HostRail.tsx`(role=group '방장 전용', 왕관 표식, 접기), `HostRailButton.tsx`, `v2.css` `.mv-hostrail-btn`(금빛 테두리·아이콘) 대 `.mv-float`(`--night-600` 테두리), 대기실 줄 = 판 종류·맵·봇·튜토리얼, 오른쪽 열 = 소리·옷장. `hostRail.test.tsx`·`lobby.test.tsx`·`resultScreen.test.tsx` 통과. 눈으로 보는 색 구별은 Human Verification 1 |

### Observable Truths — 계획별 must_haves

| 계획 | truths | Status | Evidence |
| --- | --- | --- | --- |
| 19-01 서버 트레이서 | 9/9 | ✓ VERIFIED | 직접: `modePick.test.ts` 9개·`modeBasic.test.ts` 7개·`gameMode.test.ts` 통과 — 방송·거절 모양·기본값·errand 건너뜀·없는 키·규칙 플래그·튜토리얼 무시(`room.ts:445`)·다시 하기 유지·봇 심부름 계획 0·역할 누설 0 |
| 19-02 전역 상수 제거 | 6/6 | ✓ VERIFIED | 직접: RULESET grep 0, `hooksOf(rules)` 판별 훅 표, 화면의 `modeOf(view)`, 꺼진 장치 시험이 건너뛰어지지 않음(`leak.test.ts:2004` 는 `skipIf(politicsOn(...))` 라 돈다. 건너뛴 6개는 켜진 장치 전용 시험), 기본 마피아 DOM 0, 사회자 줄 키 |
| 19-03 부품 | 9/9 | ✓ VERIFIED | 직접: `hostRail.test.tsx` 전체 통과(단추 상태·시트 낙관 갱신 없음·배치 식·칩 정적 글·표식 값·CSS), `roomDiff.test.ts` `modeToastOf` |
| 19-04 대기실 | 9/9 | ✓ VERIFIED | 직접: `lobby.test.tsx` 19-04 describe 둘 통과(줄 순서, modePick 한 번, 참가자 미렌더, 방장 교체, 토글 switch, 시작 단추 그대로, 알림, 시트·키보드 열림 숨김, 테스트 방 내림, 연결 끊김), `lobbyPanelHeight` 222 계약 |
| 19-05 결과 화면 | 4/4 | ✓ VERIFIED | 직접: `resultScreen.test.tsx` 19-05 describe 통과(줄 = 판 종류·맵, 5600 전에는 없음, modePick, 참가자 칩·알림, expanded·시트·키보드 숨김) |
| 19-06 E2E 줄·판 종류 | 5/8 | 3건 `insufficient_spec` | 직접: `hostRailChecks`·`modeChipChecks`·`modeSheetChecks`·`readHostRail`·`pickModeViaRail` 존재, 스크립트 시험 667 통과, `e2eContract.test.ts` 통과, 오른쪽 열 판정 방장 둘, SUMMARY 실측 표 있음. 요약 근거: mode-rail 폰 6종·mode-pick 41/41. **backstop 3건(세로 넘침·시트 칸 높이·결과 연출 중 겹침)은 직접 관찰한 근거가 없어 Human Verification 2~4 로 넘김** |
| 19-07 E2E 기본 마피아 | 6/6 | ✓ VERIFIED | 직접: `basicModeChecks`·`BASIC_*` 상수·mode-basic·mode-leak 흐름 등록, `BASIC_FORBIDDEN_LINES` 계약 시험 통과, 같은 내용의 서버·화면 시험 통과. 요약 근거: mode-basic 19/19·mode-leak 25/25 |
| 19-08 회귀·배포·문서 | 6/6 | ✓ VERIFIED | 직접: typecheck 종료 0, 스크립트 시험 667, 배포 version, minifia·minifia-v2 health 가 요약의 배포 전 값과 같음, `package.json` deploy 맨 앞 가드, 결정 0086(D-01~D-19·P19-0~17·알려진 한계·실측), ROADMAP 성공 기준 1 문구, 화면 지도, HANDOFF 5217바이트·머리 셋, 19페이즈 커밋에 lock·state 없음, origin/v3 = `8e01fb6a`. `npm test` 는 advisory 1번 참고 |

**Score:** 60/63 truths verified (성공 기준 6/6 · 계획 truths 54/57 · backstop 3건은 사람 확인으로, 0 present, behavior-unverified)

### Required Artifacts

`verify.artifacts` 를 계획 8개에 돌린 결과 27/27 통과(종료 코드 모두 0).

| Artifact | Expected | Status | Details |
| --- | --- | --- | --- |
| `shared/game/ruleset.ts` | `rulesetOf`·`modeOf`·`politicsOn`, 전역 상수 없음 | ✓ VERIFIED | 얼린 규칙 객체 둘, 12곳에서 읽음 |
| `shared/game/mode.ts` | `pickMode` | ✓ VERIFIED | `worker/room.ts` 가 부름 |
| `shared/game/phases.ts` | `nextPhaseOf` | ✓ VERIFIED | `tick.ts` 가 부름 |
| `worker/room.ts` | `handleModePick` | ✓ VERIFIED | 메시지 분기에 연결 |
| `src/components/v2/HostRail.tsx`·`HostRailButton.tsx` | 방장 줄·단추 | ✓ VERIFIED | Lobby·ResultScreen 이 그림 |
| `src/components/ModeSheet.tsx`·`v2/ModeChip.tsx` | 시트·칩 | ✓ VERIFIED | Lobby·ResultScreen 이 그림, 값은 `modeOf(view)` |
| `src/game/modeText.ts` | 문구 한 곳 | ✓ VERIFIED | 부품·알림이 읽음 |
| `src/screens/Lobby.tsx`·`ResultScreen.tsx` | 줄·시트·칩·알림 | ✓ VERIFIED | `send({ t: "modePick" })` 연결 |
| `scripts/e2e/modes.mjs`·`host.mjs`·`lib.mjs`·`browser.mjs` | E2E 흐름·판정 | ✓ VERIFIED | `flows.mjs` 등록 |
| `docs/decisions/0086-v3-game-modes.md` | 결정 기록 | ✓ VERIFIED | 절 일곱 |
| 시험 파일 여섯 | 서버·화면 시험 | ✓ VERIFIED | 모두 통과 |

### Key Link Verification

`verify.key-links` 는 19-03 의 2개만 판정했고 나머지 15개는 `from` 형식 때문에 판정하지 못했다(advisory). 17개 모두 선언된 패턴을 손으로 확인했다.

| From | To | Via | Status | Details |
| --- | --- | --- | --- | --- |
| `worker/room.ts` handleModePick | `mode.ts` pickMode | 서버 상태로 판정 | WIRED | `pickMode` 3곳 |
| `tick.ts` tick | `phases.ts` nextPhaseOf | 규칙으로 다음 단계 | WIRED | `nextPhaseOf(closing.phase, rules)` |
| `view.ts` | `ruleset.ts` modeOf | `view.mode` | WIRED | 두 view 모두 |
| `night.ts` enterMorning | `rules.trace`·`witness` | 흔적·목격 차단 | WIRED | 169·170행 |
| `tick.ts` | rulesetOf·modeOf | 걸음마다 훅 표 | WIRED | `modeOf(current)` |
| whisperView·badgeView·GameMap | `view.mode` | `rulesetOf(modeOf(view))` | WIRED | 셋 모두 |
| `ModeSheet.tsx` | 부모 onPick | 표시는 서버 값 | WIRED | |
| `HostRail.tsx` | `splitSideColumn` | 접기 재사용 | WIRED | |
| `Lobby.tsx`·`ResultScreen.tsx` onPick | `send({ t: "modePick" })` | canSend 일 때만 | WIRED | 각 1곳 |
| `Lobby.tsx` pressStart | `send({ t: "start", tutorial })` | `tutorialOn && mode === "extended"` | WIRED | 서버도 다시 판정 |
| `lib.mjs` 사본 셋 | 앱 값 | `e2eContract.test.ts` | WIRED | lobbyPanelHeight·hostRailLayout·BASIC_FORBIDDEN_LINES |
| `flows.mjs` openGame | `browser.mjs` pickModeViaRail | mode 인자 | WIRED | |
| `modes.mjs` modeBasicFlow | `openGame({ mode: "basic" })` | 줄에서 고름 | WIRED | |
| `npm run deploy` | 계정·대상 가드 | 스크립트 맨 앞 | WIRED | `package.json` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| --- | --- | --- | --- | --- |
| `Lobby.tsx`·`ResultScreen.tsx` | `mode` | `modeOf(view)` ← `view.ts` `modeOf(state)` ← 방 DO 저장 값 | 예(낙관 갱신 없음) | ✓ FLOWING |
| `ModeSheet.tsx` | `mode` 속성 | 부모의 `modeOf(view)` | 예 | ✓ FLOWING |
| `ModeChip.tsx` | `mode` 속성 | 부모의 `modeOf(view)` | 예 | ✓ FLOWING |
| `GameMap.tsx` | 기록·흔적·증거 | `view.me.record`·`view.day.evidence`(기본 마피아에서는 서버가 키를 싣지 않음) | 예 | ✓ FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| --- | --- | --- | --- |
| 타입 검사 | `npm run typecheck` | 종료 0 | ✓ PASS |
| 19페이즈 시험 14개 파일 | `npx vitest run <서버 4·단위 6·화면 4>` | 750 통과·6 건너뜀·실패 0 | ✓ PASS |
| 전체 시험 한 번 | `npm test` | 8292 통과·1 실패·261 건너뜀 | ⚠️ 간헐 1건(advisory) |
| 실패한 시험 단독 | `npx vitest run test/worker/bots.test.ts -t "봇 셋이 모두 토론 끝내기를 누르면"` 3회 + 파일 전체 1회 | 3/3 통과 · 27/27 통과 | ✓ PASS |
| 스크립트·E2E 판정 시험 | `node --test scripts/*.test.mjs scripts/e2e/*.test.mjs` | 667 통과·실패 0 | ✓ PASS |
| 전역 상수 없음 | `git grep RULESET -- src shared worker test scripts` | 일치 0 | ✓ PASS |
| 배포 version | `curl -s https://minifia-v3.dhplay.workers.dev/api/health` | `2026-11-12T16:47:00Z+71a10fc8` | ✓ PASS |
| 배포 뒤 코드 변화 | `git diff --stat 71a10fc8 HEAD -- src public worker shared scripts test` | 비어 있음 | ✓ PASS |
| 브라우저 E2E | — | 다시 돌리지 않음 | ? SKIP(요약 근거) |

### Probe Execution

해당 없음 — 이 페이즈는 `scripts/*/tests/probe-*.sh` 를 선언하지 않았다.

### Requirements Coverage

ROADMAP 의 Requirements 는 TBD 이고 `.planning/REQUIREMENTS.md` 에 19페이즈 매핑이 없다. 계획은 19-CONTEXT 의 결정 D-01~D-19 를 요구사항으로 선언했다. 계획이 선언하지 않은 결정은 없다(고아 없음).

| Requirement | Source Plan | Description | Status | Evidence |
| --- | --- | --- | --- | --- |
| D-01·D-02·D-04 | 19-01 | 판 종류 두 값·규칙 플래그·옛 방 정규화 | ✓ SATISFIED | `gameMode.test.ts` |
| D-03 | 19-02 | 전역 상수 제거 | ✓ SATISFIED | grep 0 |
| D-05·D-06·D-07 | 19-01·03·04·05 | 고르기·진행 중 잠금·참가자 칩 | ✓ SATISFIED | `modePick.test.ts`, 화면 시험 |
| D-08·D-09 | 19-01·02·07 | 기본 마피아 흐름·화면 | ✓ SATISFIED | `modeBasic.test.ts`, `gameMap.test.tsx` |
| D-10·D-11·D-12 | 19-01·04·07 | 튜토리얼·봇·누설 | ✓ SATISFIED | 서버 시험, `leak.test.ts` |
| D-13·D-14·D-15·D-17 | 19-03·04·05 | 방장 줄·색·글 최소·시작 단추 | ✓ SATISFIED(눈 확인 남음) | `hostRail.test.tsx`, Human 1 |
| D-16 | 19-03 | 시안 사본 | ✓ SATISFIED | `design/v3.0/host-rail/` |
| D-18 | 19-06·07·08 | 두 판 E2E·누설 | ✓ SATISFIED | 요약 근거 + 서버 시험 직접 |
| D-19 | 19-08 | 배포 | ✓ SATISFIED | health version |

### Anti-Patterns Found

19페이즈가 고친 코드·시험·스크립트 96개 파일에 `TBD`·`FIXME`·`XXX` 가 없다. 자리 표시 구현·빈 처리기·고정 값 반환도 찾지 못했다. 저장소 위생 검사(금지 낱말)도 19페이즈 문서와 결정 0086 에서 결과 0 이다.

| File | Line | Pattern | Severity | Impact |
| --- | --- | --- | --- | --- |
| — | — | 없음 | — | — |

### Human Verification Required

실기기 확인은 v3.0 끝 실테스트 한 번으로 미룬다(사용자 방침). 계획에 `<human-check>` 블록은 없었다.

### 1. 방장 줄의 색 구별

**Test:** 방장 폰으로 대기실에 들어가 왼쪽 세로 줄과 오른쪽 열을 본다.
**Expected:** 방장 전용 단추가 왼쪽에 모여 있고 금빛 테두리·왕관 표식으로 오른쪽 공용 단추와 한눈에 구별된다.
**Why human:** 색 구별·분위기는 눈으로만 판단할 수 있다.

### 2. 방장 줄 세로 넘침 (19-06 backstop)

**Test:** 짧은 폰과 긴 폰에서 방장 대기실을 확장판·기본 마피아로 번갈아 본다.
**Expected:** 줄이 아래 패널과 겹치지 않는다. 넘칠 폰에서는 표식이 먼저 빠지고 두 열로 접힌다.
**Why human:** 근거가 E2E 요약 값뿐이라 직접 관찰하지 못했다.

### 3. 판 종류 시트 칸 높이 (19-06 backstop)

**Test:** 폭이 좁은 폰에서 [판 종류] 시트를 연다.
**Expected:** 설명이 두 줄로 접혀도 두 칸 높이가 같고 시트가 화면 밖으로 넘지 않는다.
**Why human:** 실제 글자 줄바꿈은 기기에서만 확인된다.

### 4. 결과 화면의 줄·칩 (19-06 backstop)

**Test:** 한 판을 끝내고 결과 화면을 방장·참가자 폰으로 본다. 방장이 판 종류를 바꾸고 다시 하기를 시작한다.
**Expected:** 연출이 끝나기 전에는 줄·칩이 없고, 끝난 뒤 [처음으로]·[다시 하기]·아래 패널과 겹치지 않는다. 새 판이 고른 종류로 돈다.
**Why human:** 연출 시점과 겹침은 실제 화면에서 본다.

### 5. 참가자 칩과 알림

**Test:** 방장이 판 종류를 바꿀 때 다른 폰의 참가자 화면을 본다.
**Expected:** 칩이 새 판 이름으로 바뀌고 알림 한 줄이 뜬다. 칩은 눌러도 아무 일 없다.
**Why human:** 여러 기기 사이의 방송은 실기기로 확인한다.

### 6. 두 판 완주

**Test:** 기본 마피아로 한 판, 확장판으로 한 판을 배포본에서 끝까지 한다.
**Expected:** 기본 마피아에는 심부름·[기록]·흔적 표시가 한 번도 없다. 확장판은 지금까지와 같다.
**Why human:** 실제 사람이 하는 한 판의 흐름은 실테스트에서 본다.

### Gaps Summary

코드·시험으로 확인되는 gap 은 없다. 성공 기준 여섯은 모두 코드와 직접 돌린 시험으로 확인했고, 배포본 version 은 마지막 코드 커밋 `71a10fc8` 과 같다.

status 가 `human_needed` 인 이유는 실기기 눈 확인 6건이다. 그중 2~4번은 19-06 이 backstop 으로 표시한 항목이라 E2E 요약 값만으로는 확인으로 세지 않았다.

advisory 로 남긴 것 중 새로 본 것은 하나다: 전체 `npm test` 한 번에서 `test/worker/bots.test.ts` 1건이 실패했고 따로 돌리면 통과한다. 19페이즈 변경과 무관한 간헐 실패로 보지만 원인은 확정하지 않았다. 다시 나오면 계획을 세운 알람과 읽기 사이의 경합을 먼저 본다.

---

_Verified: 2026-11-12T19:50:00Z_
_Verifier: Claude (gsd-verifier)_
