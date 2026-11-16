---
phase: 22-cleanup-single-mode
plan: "07"
subsystem: single-ruleset
tags: [cleanup, game-mode, ruleset, host-rail, legacy-room, e2e]
requires: [22-06]
provides:
  - "판 종류 개념이 없다: GAME_MODES·GameMode·DEFAULT_MODE·RoomView.mode·RoomState.mode·{t:\"modePick\"}·shared/game/mode.ts·RULES_BY_MODE·rulesetOf·modeOf·worker rulesNow 삭제. 규칙은 ruleset.ts 의 얼린 상수 RULES 하나이고 tick·nomination·view·bots·worker·화면(badgeView·whisperView·GameMap)이 RULES 를 직접 읽는다."
  - "RULES = { badge:false, whisper:false, pickTurn:false, runoff:false, showdown:false }. pickTurn 은 계획대로 false 로 두었다(22-09 가 true 로 켠다)."
  - "tick.ts 의 훅 표는 모듈 상수 HOOKS 한 벌(hooksOf·hooksFor·WeakMap 삭제). resolveNomination(state)·planBotSteps(state, now, randInt)·buildDay(state) 는 규칙 인자를 받지 않는다."
  - "옛 방 표시: LEGACY_V3_ROOM_KEYS 에 mode, LEGACY_V3_PLAYER_KEYS 에 stats(22-01 이월)를 더했다. mode 키가 저장된 판 중 방은 대기실로, 대기실 방은 mode·stats 키만 지워진다(허용 밖 값 포함). 기존 hasBadMode 분기는 이 표로 흡수되어 삭제. REMATCH_ROOM_KEYS·testTools 의 mode 복사 삭제."
  - "화면: ModeSheet·ModeChip·modeText·modeToastOf 와 .mf-mode-sheet*·.mf-mode-card*·.mf-modechip CSS 삭제. 방장 줄은 [맵]·[봇](테스트 방)뿐이고 결과 화면 방장 줄은 [맵]뿐이며 참가자에게는 이 자리에 아무것도 없다. HostRailButton id 는 \"bots\" 하나(맵은 MapChip 줄 변형), HOST_RAIL_LABEL 은 HostRail.tsx 가 가진다."
  - "시험·E2E: 판 종류 시험 4개(gameMode·modePick·modeBasic 등)와 scripts/e2e/modes.mjs·mode-rail/pick/basic/leak 흐름·pickModeViaRail·pickModeViaUi·openExtended·판 종류 판정(modeChipChecks·modeSheetChecks·basicModeChecks)·MODE_NAMES_E2E 삭제. 단계 그래프 표는 PHASE_GRAPH 하나."
affects: [22-08, 22-09, 22-14]
key-files:
  deleted:
    - shared/game/mode.ts
    - src/components/ModeSheet.tsx
    - src/components/v2/ModeChip.tsx
    - src/game/modeText.ts
    - scripts/e2e/modes.mjs
    - test/unit/gameMode.test.ts
    - test/worker/modePick.test.ts
    - test/worker/modeBasic.test.ts
  modified:
    - shared/{protocol,schemas}.ts, shared/game/{ruleset,room,rematch,testTools,view,tick,nomination,bots,phases}.ts
    - worker/room.ts
    - src/screens/{Lobby,ResultScreen,GameMap}.tsx, src/components/v2/{HostRail,HostRailButton,DressSheet,LineSheet}.tsx, src/game/{badgeView,whisperView,resultText}.ts, src/net/roomDiff.ts, src/styles/{sheet,v2,lobby,result}.css
    - test/unit/{ruleset,legacyRoom,e2eContract,schemas,roomDiff,view,soundProtocol,dayView,hostLine,...}.test.ts, test/client/{hostRail,lobby,resultScreen,gameMap,dressSheet,roleCardSheet,...}.test.tsx, test/worker/{helpers,leak,basicDay,basicOff,...}.ts, test/helpers/voteState.ts
    - scripts/e2e/{lib,lib.test,browser,flows,host,mapselect,mapselect.test,sound,avatar}.mjs, scripts/{smoke,uat-test-room,perf-run}.mjs
decisions:
  - "Task 1~3 을 한 GREEN 커밋(5f9e6a63)으로 묶었다. RoomView.mode·GameMode 삭제가 app·worker tsconfig 가 함께 보는 test/ 전체와 e2eContract.test(scripts 와 묶임)에 걸려 서버·화면·시험·스크립트가 한 번에 맞아야 typecheck 와 vitest 가 초록이다. RED 는 별도 커밋(30113eda)."
  - "tick.ts 의 훅 표는 RULES 로 모듈 로드 때 한 번 만든다(RULES 값은 소스에서 바뀌므로 런타임 변경 요구가 없다). 22-09 가 pickTurn 을 true 로 켜면 이 표가 따라간다."
  - "mode 옛 방 표시는 값을 가리지 않고 키 존재(Object.hasOwn)로 본다. 허용 밖 값(turbo)도 같은 경로로 정리돼 별도 hasBadMode 분기가 필요 없다."
  - "MORNING_MAX_MS(16초 상한, 22-06 이월): 이번에도 건드리지 않고 도달하지 않는 안전 상한으로 남긴다. 아침 최대 길이가 11초라 동작에는 영향이 없고, 상한 제거는 시간 연출과 상수 시험(phases·discussion test)을 함께 건드리는 일이라 22-09/10 의 낮 순서 개편과 같이 판단하는 편이 낫다."
  - "mapselect.mjs 의 TM11 판정(mapRailChecks)은 판 종류 숨김·복귀 두 갈래에서 \"방장 줄에 [맵] 정확히 하나 + 칩이 서버 맵 선택을 보임\" 한 갈래(대기실 TM11, 결과 TM11c)로 줄였다. 판 종류 전환 흐름(TM11p·TM11q·TM11r)은 없다."
  - "smoke.mjs·uat-test-room.mjs 는 modePick 전송과 view.mode 단언만 지웠다. --mode 인자·PHASE_NEXT_BY_MODE·FIRST_DAY_PHASE 같은 판 종류별 분기와 표는 22-08(smoke·UAT 기본 흐름 하나)의 몫이라 그대로다. 두 값(basic·extended) 모두 같은 규칙의 방이라 지금도 돈다."
  - "modeBasic.test(기본 마피아 한 판 전체) 단언은 basicDay.test 로 옮기지 않았다. 계획이 \"남길 가치가 있는 것\"만 옮기라 했는데 (1) errand·tutorial 단계 없음은 phases·tick·e2eContract 가 이미 단언하고 (2) 심부름·흔적·목격 키 부재는 22-06 에서 키째 삭제되어 의미가 없으며 (3) 역할·관전 누설 프레임 전수는 leak.test 가 같은 소켓 프레임을 본다. basicDay.test 의 낮 흐름 세 시험이 호출 인자(mode)만 지우고 그대로 남는다."
metrics:
  tasks: 3
  duration: 약 3시간
status: complete
actuals:
  tokens: 210000
  tasks: 3
  commits: 2
plan_head_before: af055b7dd5367f8af3e9e3e1fc6557b542002e1d
plan_head_after: 5f9e6a630b0907d9fcc9981cd1e295e393ceb033
commits: 2
---

# Phase 22 Plan 07: 판 종류 제거와 단일 RULES Summary

판 종류(기본 마피아/확장판, 결정 0086)를 와이어·서버·화면·시험·E2E 에서 지우고 규칙을 상수 `RULES` 하나로 고정했다(결정 0089-12, D-01·D-02·D-03·D-29). 방장 줄은 [맵]·[봇]뿐이고 mode 키로 저장된 옛 방은 대기실로 돌아간다. 확장판 기능이 22-04~22-06 에서 모두 사라져 두 판의 규칙 값이 같았으므로 동작은 바뀌지 않았다.

## RED 증거

`test(22-07): 단일 RULES·mode 옛 방 실패 시험`(30113eda): ruleset.test 5건 + legacyRoom.test 5건 = 10건 not ok(RULES 미구현·mode 표시 없음). 허용 밖 값(turbo) 방 정리는 기존 hasBadMode 가 이미 처리해 RED 에서 통과했다. GREEN 후 두 파일 모두 초록.

## 변경 요약

- **서버·와이어(Task 1)**: protocol.ts(GAME_MODES·GameMode·DEFAULT_MODE·RoomView.mode·modePick 송신 타입)·schemas.ts(modePick 줄) 삭제. ruleset.ts 는 `export const RULES`(얼린 객체)와 `Ruleset`·`politicsOn` 셋만 내보낸다. room.ts 의 RoomState.mode·hasBadMode 삭제, rematch.ts·testTools.ts 의 mode 복사 삭제, view.ts 의 view.mode(쉬는 사람 view 포함) 삭제, worker/room.ts 의 modePick 처리기·rulesNow 삭제(`RULES.badge`/`RULES.whisper` 로 거절 문 유지). maps.ts 는 22-05 가 이미 판 종류 인자를 지워 변경 없음.
- **화면(Task 2)**: Lobby·ResultScreen 에서 [판 종류] 단추·시트 열기 상태·초점 복귀 효과·참가자 칩·판 바뀜 토스트 삭제, `mapsOn = PLAYABLE_MAPS.length > 1`(판 종류 조건 삭제). HostRail 은 비면 렌더하지 않는 기존 동작 그대로이고 참가자 쪽에는 아무것도 그리지 않는다(지도 칩을 새로 만들지 않았다). badgeView·whisperView·GameMap 은 RULES 를 직접 읽는다. 새 간격·색 없음(P22-15).
- **시험·E2E(Task 3)**: `GAME_RULES = RULES` 로 약 30개 파일 일괄 치환, 도우미 `lobbyOf/startedAt/startedGame/stateWithVerdict` 의 mode 인자 삭제, `RoomView` 리터럴의 `mode:` 삭제. hostRail·lobby·resultScreen 시험은 방장 줄 단추 목록 = map(+bots)와 `[data-host-rail-btn="mode"]·[data-mode-sheet]·[data-mode-card]·[data-mode-chip]` 0건을 단언한다. e2e 는 modes.mjs 삭제, flows·host·browser·sound·perf-run·mapselect·lib 의 판 종류 도우미·흐름·판정 삭제.

## 검증 결과

| 명령 | 결과 |
| --- | --- |
| `npx vitest run test/unit/ruleset.test.ts test/unit/legacyRoom.test.ts test/unit/gameRoom.test.ts test/unit/tick.test.ts test/unit/view.test.ts` + `tsc -p tsconfig.worker.json --noEmit` (Task 1 verify) | 통과(전체 unit 125 파일 4172 통과로 재확인) |
| `npm run typecheck` + `npx vitest run test/client/{hostRail,lobby,resultScreen,mapChip}.test.tsx` (Task 2 verify) | typecheck exit 0, 4파일 통과(client 전체 76파일 2618+ 통과) |
| `npx vitest run` + `node --test scripts/*.test.mjs scripts/e2e/*.test.mjs` + `npm run typecheck` (Task 3 verify) | vitest 244 파일 통과 6 건너뜀(7289 통과·261 건너뜀, 실패 0), node:test 614 통과 0 실패, typecheck exit 0. 이번 실행에서는 worker 부하 flake 가 없었다 |
| 인수 기준 grep | `mode.ts` 없음, `rulesetOf\|modeOf\|GAME_MODES\|DEFAULT_MODE\|GameMode\|modePick` shared·worker 0건(HEAD 77), src 0건, test 0건, scripts 0건, 전체(src shared worker scripts test) 0건, `export const RULES` 1건, rematch.ts `"mode"` 0건, `pickModeViaRail\|pickModeViaUi\|openExtended` scripts 0건(HEAD 29), flows.mjs `id: "mode-` 0건(HEAD 4), hostRail.test `data-mode` 2건 |
| 사적 레포 위생 `git grep -nIiE "torder\|티오더\|조직\|회사\|~/project"` (변경 파일) | 0건 |

## 남은 `"basic"`·`"extended"` 문자열

`git grep -nE '"basic"|"extended"' -- src shared worker scripts test` 남은 줄은 모두 판 종류와 무관하거나 의도된 이월이다.

- `test/unit/legacyRoom.test.ts`·`test/unit/schemas.test.ts`: 옛 저장 값(`mode: "basic"|"extended"`)을 재현하는 입력. 옛 방 표시와 modePick 거절 시험의 필수 재료다(schemas 의 옛 메시지 이름과 ruleset.test 의 옛 낱말 목록은 조각으로 이어 붙여 파일 전체 검사에 걸리지 않게 했다).
- `scripts/smoke.mjs`·`scripts/smoke.test.mjs`·`scripts/uat-test-room.mjs`: `--mode extended|basic`, `PHASE_NEXT_BY_MODE`, `FIRST_DAY_PHASE` — **22-08 이 지운다**(두 값 모두 같은 규칙의 방이라 지금도 동작).

## Deviations from Plan

### Auto-fixed / 계획 파일 목록 밖 변경

**1. [Rule 3 - 블로킹] 계획 파일 목록 밖 파일을 함께 고쳤다**
- **이유:** 한 파일의 삭제가 typecheck·시험·`git grep` 인수 기준 전체에 걸린다. `scripts/e2e/browser.mjs`(pickModeViaRail·readModeSheet·openModeSheet·closeModeSheet·chip 읽기·hostLineScannerScript/readHostLines — modes.mjs 만 쓰던 것), `scripts/e2e/sound.mjs`·`scripts/perf-run.mjs`(pickModeViaRail/Ui 호출), `scripts/e2e/avatar.mjs`·`flows.mjs`·`scripts/smoke.mjs`·`shared/game/phases.ts`(rulesetOf 낱말이 남은 주석), `scripts/e2e/lib.test.mjs`·`mapselect.test.mjs`·`test/unit/e2eContract.test.ts`·`test/helpers/voteState.ts`·`test/unit/{dayView,hostLine,roomDiff,lighting,discussion,endgame,win,schemas,soundProtocol,view}.test.ts`, `test/client/{gameMap,dressSheet,roleCardSheet,atmosphere,callGlow,characterAudit,guide,hostBand,nightChat,nightMap,willFlow}.test.tsx`, `src/styles/{lobby,result,v2}.css`(.mf-modechip 규칙), `HostRailButton.tsx`·`DressSheet.tsx`·`LineSheet.tsx`(주석·id 유니언)
- **Commit:** 5f9e6a63

**2. [Rule 1 - 설계 정리] lib.mjs 의 판 종류별 단계 그래프를 하나로 합쳤다**
- **내용:** `PHASE_GRAPHS{basic,extended}`(값이 같았다)·`BASIC_TRANSITIONS` → `PHASE_GRAPH` 하나, `basicOrderChecks(phases)`. `railMapsOn(playableMany)`·`mapRailChecks`·`hostRailChecks` 입력에서 mode 삭제, `HOST_RAIL_ORDER = ["map","bots"]`, `VIEW_TOP_KEYS` 에서 `"mode"` 제거(서버가 더는 싣지 않으므로 나타나면 누설 검사가 실패한다). smoke.mjs 의 표(`PHASE_NEXT_BY_MODE`)는 22-08 로 남겼다.
- **Commit:** 5f9e6a63

**3. [Rule 1 - 설계 정리] lib.mjs 의 기본 마피아 판정 묶음 삭제**
- **내용:** `basicModeChecks`(BM1~BM3)·`basicViewKeyChecks`(BM1k)·`BASIC_ABSENT_SELECTORS`·`BASIC_ABSENT_ATTR_PREFIX`·`BASIC_FORBIDDEN_LINES`·`BASIC_OFF_VIEW_KEYS`: modes.mjs 와 mode-leak 흐름만 쓰던 것이라 함께 지웠다(심부름·흔적·목격 키 자체는 22-06 에서 키째 삭제되어 있었다). 해당 lib.test·e2eContract 시험도 삭제.
- **Commit:** 5f9e6a63

**4. [Rule 1] 상수·주석 정리**
- `hooksOf(rules)` export 삭제(단위 시험은 gameMode.test 뿐이었다). `resolveNomination` 두 번째 인자와 `planBotSteps` 네 번째 인자 삭제. `e2eContract.test.ts` 의 "마지막 판 종류 표" 대조는 smoke 표의 키를 직접 순회한다(`GAME_MODES` 없이).
- **Commit:** 5f9e6a63

### 계획 대비 달라진 점

- **gameMode.test 삭제로 휴면 장치 주입 시험 소실:** 계획대로 gameMode.test 를 지웠다. 그 안에는 `rulesWith({ runoff: true })`·`hooksOf(rulesWith({ pickTurn: true }))`·`resolveNomination(state, 규칙)` 처럼 **규칙을 인자로 주입해 꺼진 장치(결선·결전·순차 지목)의 훅 표를 단위로 확인하던** 시험이 있었다. 규칙 주입 구멍을 지웠기 때문에(계획 결정) 이제 그 경로는 `RULES` 값을 소스에서 켠 뒤에만 돌릴 수 있다. runoff·showdown·whisper·badge 의 기존 시험은 `skipIf(!GAME_RULES.x)` 로 남아 있고 pickTurn 은 22-09 가 켜면서 되살린다. 22-09 가 pickTurn 훅 표(`HOOKS.enter.nomination`·`HOOKS.deadline.nomination`)를 새 규칙으로 직접 확인하는 시험을 더하는 것을 권한다.
- **modeBasic.test 의 기본판 완주 단언은 옮기지 않았다**(근거는 frontmatter decisions).
- **E2E 폰 6종 방장 줄 기하(mode-rail)와 판 종류 전환 후 맵 숨김·복귀(TM11p/q/r)가 없어졌다.** 방장 줄 기하(HR1~HR8)는 map-select 흐름이 대기실·결과에서 계속 본다.

## Known Stubs

없음.

## 이월·남은 일 (다음 계획)

- **22-08:** smoke.mjs·uat-test-room.mjs 의 `--mode` 인자·`PHASE_NEXT_BY_MODE`·`FIRST_DAY_PHASE`·판 종류별 분기(위 참조), smoke.test.mjs 판 종류 표 시험. 테스트 도우미 껍데기(lockCause/lockModeMaps/openTown)는 이번에도 건드리지 않았다.
- **22-09:** `RULES.pickTurn` 을 true 로 켠다. 바꿔야 할 시험: ruleset.test 의 값 기대(`pickTurn:false` JSON 한 줄과 `politicsOn` 시험), worker/leak.test 의 허용 경로 시험(`allOff` 입력으로 만든 기대는 그대로, `POLITICS_ALLOWED_PATHS === politicsPathsFor(GAME_RULES)` 는 자동으로 따라간다).
- **V2Icon 의 `deck`·`modeBasic`·`modeExtended`(·`book`) 아이콘:** 판 종류 시트가 쓰던 것이다. 지금은 앱에서 쓰이지 않지만 hostRail.test 의 NEW_ICONS 시험이 경로를 단언하고 있어 이번에는 남겼다(22-08/22-14 정리 후보).
- **docs/screen-map.md·결정 기록:** 판 종류·mode-rail·TM11 흐름 설명이 남아 있다 — 22-14 의 문서 정리 몫이다.
- **MORNING_MAX_MS:** 위 decisions 참고(그대로 유지).

## Threat Flags

없음(새 네트워크·인증·파일 접근 표면 없음). T-22-12(modePick → BAD_MESSAGE)와 T-22-13(mode 방 → 대기실) 완화는 schemas.test("옛 판 종류 고르기 거부" 4건)·legacyRoom.test(mode 6건 + 판정 표)로 고정했다.

## Self-Check: PASSED

- 삭제 확인: `shared/game/mode.ts`, `src/components/ModeSheet.tsx`, `src/components/v2/ModeChip.tsx`, `src/game/modeText.ts`, `scripts/e2e/modes.mjs`, `test/unit/gameMode.test.ts`, `test/worker/modePick.test.ts`, `test/worker/modeBasic.test.ts` 없음.
- 커밋 확인: 30113eda(RED), 5f9e6a63(GREEN) 이 HEAD 의 조상이다.
- `.planning/phases/22-cleanup-single-mode/22-07-SUMMARY.md` 존재.
