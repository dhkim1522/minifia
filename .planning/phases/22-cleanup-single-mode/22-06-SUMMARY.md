---
phase: 22-cleanup-single-mode
plan: "06"
subsystem: errand-witness-trace-removal
tags: [cleanup, errand, witness, trace, placeart, legacy-room, e2e]
requires: [22-05]
provides:
  - "PhaseId 에 errand 가 없다. PHASE_DEFS.dayAnnounce.next = discussion 이고 nextPhaseOf(phase) 는 단계 표의 next 만 읽는다(규칙 인자 삭제)"
  - "Ruleset 필드는 badge·whisper·pickTurn·runoff·showdown 다섯뿐. ERRAND_*·RECORD_MAX·MORNING_TRACE_MS 상수와 MorningView.trace·seen, DayView.evidence, MyInfo.errand·record, errand 메시지·근처 snap(near 표시)·PLACE_IDS·TRACE_PIECE_IDS 가 와이어에서 없다"
  - "shared/game/{errand,errandFake,trace}.ts 삭제. 근처 판정(nearPhaseOf)·근처 표본 타이머(errandTickAt·nextWakeAt 항·runErrandTick)·봇 errandGo/errandAct·MapDef.places(BAR_PLACES·PLAZA_PLACES) 삭제. discussion 진입·enterNight 의 심부름 키 정리와 enterMorning 의 흔적·목격 로직 삭제(enterMorning 은 인자 없이 state 하나)"
  - "화면: 심부름 부품 4·목격 카드·흔적(증거) 카드·errandView·recordView·traceMark·traceText·useErrandPos·useErrandStartCard·placeText·evidence.css·WorldStage 의 심부름 층·HeadStack 의 traceMark/seenMark·hostLine 의 errand.*·witness·trace·discussion.evidence 줄·V2Icon 선 그림 7개(arrow·thread·hand·flame·flameOff·footprint·window)·game.css/v2.css 의 심부름·기록·흔적 규칙 삭제"
  - "장소 그림: scripts/make-placeart.mjs·placeArt.tsx 삭제와 package.json 의 placeart·placeart:check·typecheck 체인 항목 삭제를 한 커밋에서 했다. design/v3.0/assets/*.svg 는 설계 이력이라 둔다"
  - "옛 방 표시: isLegacyV3Room 에 단계 errand, 방 키 errandTickAt·errandLast, 개인 키 errandPlaces·errandDone·errandNear·errandSeen·errandFake 추가 — 해당 방은 대기실로(legacyRoom.test 5건 + 판정 표 갱신)"
  - "시험·E2E·스크립트: 기능 시험 18개와 scripts/e2e/errand.mjs 삭제. lib.mjs·browser.mjs·flows.mjs 의 errand 판정·읽기·표식·흐름 등록 삭제. smoke·uat-test-room·bots·perf-run 의 errand 경로와 단계 기대값 삭제. basic-off 의 없음(0건) 판정은 남김"
affects: [22-07, 22-08, 22-14]
key-files:
  deleted:
    - shared/game/errand.ts
    - shared/game/errandFake.ts
    - shared/game/trace.ts
    - src/game/{errandView,recordView,traceMark,traceText,placeText}.ts
    - src/net/{useErrandPos,useErrandStartCard}.ts
    - src/components/v2/{ErrandAct,ErrandDots,ErrandMarker,ErrandStartCard,EvidenceCard,RecordCard,placeArt}.tsx
    - src/styles/evidence.css
    - scripts/make-placeart.mjs
    - scripts/e2e/errand.mjs
    - "시험 17개(unit 8: errand·errandFake·errandNear·errandView·placeArt·trace·traceMark·traceView / client 5: errandParts·errandScreen·evidenceCard·placeArt·recordTrace / worker 4: errand·errandLeak·errandNear·trace)"
  modified:
    - shared/{protocol,schemas}.ts, shared/game/{ruleset,phases,tick,night,discussion,movement,audience,bots,view,room,map,mapPlaza}.ts
    - worker/room.ts
    - src/{screens/{GameMap,RoomScreen},components/{WorldStage,TestTools,v2/{HeadStack,HostBand,V2Icon}},game/{hostLine,dayView,scenes},world/{store,presence,runtime},audio/director}.ts(x), src/styles/{game,v2}.css, src/net/useMapInsets.ts
    - package.json
    - scripts/{smoke,smoke.test,uat-test-room,bots,perf-run,perf-run.test}.mjs, scripts/e2e/{lib,lib.test,browser,flows,host,modes,polish,polish.test,sound}.mjs
    - 시험 약 45개(사슬·허용 목록·단계 열 갱신, legacyRoom.test 에 심부름 방 describe 추가)
decisions:
  - "한 커밋으로 묶었다(Task 1~3). 앱 tsconfig 가 test/ 를 포함하고 e2eContract.test 가 scripts 와 묶여 있어 서버·화면·시험·스크립트가 한 번에 맞아야 typecheck 와 vitest 가 초록이다. 계획 Task 1 의 verify 도 앱 tsc 를 안 돌리지만 src 가 같은 protocol 을 import 해 Task 1 만으로는 앱 typecheck 가 빨갛다."
  - "nextPhaseOf 는 함수를 남기고 규칙 인자만 지웠다(nextPhaseOf(phase)). 22-07 이 낮 순서를 다시 고칠 때 한 곳을 유지하기 위함이다."
  - "src/net/recordsSeen.ts 는 지우지 않았다. 계획 Task 2 파일 목록에 있었지만 실제 내용은 활동 기록 탭(me.records, 경찰·마피아·의사 일지)의 읽은 개수 저장이라 목격 기록(me.record)과 무관하다. RoomScreen 이 계속 쓴다. test/unit/recordsSeen.test.ts 도 그대로다."
  - "useKeyboardLift 도 남겼다. useMapInsets·useSheetLayer(useVisualViewportHeight)가 쓴다."
  - "서버 전용 키 목록 SERVER_ONLY_KEYS(leak.test 의 errandPlaces 등)는 일부러 남겼다 — 지운 키가 어떤 프레임에도 나오지 않는다는 감시선이다. 마찬가지로 leak.test 의 허용 경로 접두에 me.errand·me.record·day.evidence 를 남기고 허용 목록에서만 뺐다."
  - "MapDef.places·PlaceDef·BAR_PLACES·PLAZA_PLACES(심부름 장소 후보)를 지웠다. 계획 파일 목록에 없지만 심부름 전용이라 PLACE_IDS 와 함께 없앤다(22-05 가 PLACE_IDS 를 16개로 줄여 둔 값)."
  - "runtime.ts 의 onProject·walkTo 는 WorldStage 가 더는 쓰지 않지만 worldStage.test 의 런타임 시험이 직접 쓰는 일반 훅이라 남겼다(주석만 일반화)."
  - "MORNING_MAX_MS(16초 상한)는 그대로다. 흔적 5초가 없어져 아침 최대 길이가 11초라 상한은 도달하지 않지만 안전 상한으로 둔다."
  - "NIGHTLOAD_DWELL 은 errand 행을 지워 한 바퀴 합이 70초 → 50초다. nightloadDwell(map) 필터 함수는 필요 없어져 지웠다(perf-run 이 표를 그대로 쓴다)."
metrics:
  tasks: 3
  duration: 약 3시간
status: complete
actuals:
  tokens: 235000
  tasks: 3
  commits: 1
plan_head_before: f52acc4b4fb8180eb033e5f08b3b8ec29af2a0c1
plan_head_after: 37aa30d80ea46051f7bf78f980a8a6a60ee3b6dc
commits: 1
---

# Phase 22 Plan 06: 심부름·목격 기록·밤 흔적·장소 그림 삭제 Summary

심부름(결정 0074)·목격 기록·아침 밤 흔적과 장소 그림 생성기를 서버·와이어·화면·소리·시험·E2E·스크립트에서 지웠다(결정 0089-13, D-04). 낮 시작 발표 다음은 곧바로 토론이고, 남는 규칙 필드는 정치 장치 다섯뿐이다. 재즈 바·시계탑 광장 맵과 흰 분필 윤곽(morningCards·night 시험)은 그대로다. 127개 파일, +517 −10910 줄(커밋 `37aa30d8`).

## 한 일

**Task 1 — 서버·와이어**
- `errand.ts`·`errandFake.ts`·`trace.ts` 삭제. `PhaseId` 의 errand, `PHASE_DEFS.errand`, `ERRAND_*`·`RECORD_MAX`·`MORNING_TRACE_MS`, `Ruleset` 의 errand·witness·trace, `MorningView.trace/seen`, `DayView.evidence`(+`EvidenceView`·`LastSeen`·`TracePiece`), `MyInfo.errand/record`(+`ErrandMine`·`RecordLine`), `{t:"errand"}` 메시지와 schemas 줄, snap 의 `near` 표시를 와이어에서 지웠다. `PLACE_IDS`·`TRACE_PIECE_IDS` 도 없다.
- 단계 집합 리터럴(컴파일러가 못 잡는 곳): `view.ts` DAY_PHASES·EVIDENCE_PHASES(블록째), `movement.ts` MAP_PHASES·canMoveIn·`nearPhaseOf`(함수째), `audience.ts` 의 근처 분기 둘, `bots.ts` planned 목록·errandGo/errandAct·ERRAND_BOT_*, `director.ts`·`scenes.ts`·`dayView.ts`·`TestTools.tsx`·`RoomScreen.tsx` 표의 errand 줄.
- `tick.ts`: errand 진입 훅과 `nextWakeAt` 의 근처 표본 항 삭제. `night.ts`: `enterNight` 의 심부름 키 정리·`enterMorning` 의 흔적·목격(난수 인자와 규칙 인자 포함) 삭제. `discussion.ts`: `morningMsOf` 의 흔적 구간·`errandTickAt` 정리 삭제.
- `worker/room.ts`: errand 메시지 처리(`handleErrand`·`applyErrand`)·봇 errandGo/errandAct·근처 snap(`snapFrameFor` 분기·`syncErrandView`·`syncErrandTransition`·`runErrandTick`·`errandMarks`)·알람 합류·`snapEachCount` 삭제. `syncPositions` 는 prev 인자가 없다.
- `room.ts`: 상태 키 선언 8개(errandPlaces·errandDone·errandNear·errandSeen·errandFake·errandTickAt·errandLast) 삭제, `LEGACY_V3_PHASES`·`LEGACY_V3_ROOM_KEYS`·`LEGACY_V3_PLAYER_KEYS` 에 심부름 표시 추가(T-22-10).
- 시험 도우미 `test/worker/helpers.ts` 의 `startedGame`·`lobbyOf`·`startedAt` 은 `advanceTo`/`skipOnce` 로 단계 이름을 따라가 errand 를 직접 적지 않아 코드는 고칠 곳이 없었다. 사슬이 바뀐 효과는 시험 쪽(아래)에서 흡수했다.

**Task 2 — 화면·소리·장소 그림**
- 삭제: 훅 3(useErrandPos·useErrandStartCard — 계획 목록의 recordsSeen 은 제외, 판단은 결정 참고)·뷰 모듈 4(errandView·recordView·traceMark·traceText)·부품 7(ErrandAct·ErrandDots·ErrandMarker·ErrandStartCard·EvidenceCard·RecordCard·placeArt)·evidence.css·placeText.ts·make-placeart.mjs.
- `GameMap`: 목격 기록 상태·`[기록]` 단추·흔적 구간 타이머와 신호(`emitSignal card delay`)·증거 카드·이름표 흔적 표시·심부름 위치 훅·시작 카드·진행 점·`ErrandLayerProps` 와 `onHostLocal` 연결 삭제. `callTarget` 은 `callTargetsOf(view)` 하나. `noPanel` 은 `panelless` 만.
- `WorldStage`: 심부름 층(`ErrandLayerProps`·`writeErrandLayer`·근처 링·`onErrandPin`·층 두 개) 삭제. `HostBand`·`RoomScreen` 의 `local`/`hostLocal` 통로 삭제(HostLocal 은 cardSeen 하나).
- `hostLine.ts`: 키 5개(errand.act·errand.done·errand.ghost·witness·trace)와 discussion.evidence, `CallTool` 의 errand·record, `CallTarget` 의 place, `HostLocal` 의 pos·recordOpened·traceOn·startCard 삭제. `hostChimeOf` 는 낮 시작 → 토론 무음만.
- `HeadStack` 의 traceMark·seenMark(속성·아이콘·evidence.css import)와 game.css·v2.css 의 심부름·기록·흔적 규칙 삭제. `WorldStore` 의 near snap 분기와 `presence.ts` 의 errand 가림 조건 삭제.
- 소리: `recipes.ts` 에는 심부름·흔적 전용 소리가 없어 손댈 곳이 없었다(director 의 errand 침대 행만 삭제).
- V2Icon 선 그림 7개(arrow·thread·hand = 심부름 전용, flame·flameOff·footprint·window = 22-04 이월분) 삭제.
- package.json: `placeart`·`placeart:check` 와 typecheck 체인의 `npm run placeart:check &&` 를 같은 커밋에서 삭제(Pitfall 5). `npm run typecheck` 초록.

**Task 3 — 시험·E2E·스크립트**
- 기능 시험 17개 삭제(위 key-files). 남는 시험은 사슬이 낮 시작 → 토론으로 바뀐 값만 고쳤다: tick(단계 열네 개·마감·"난수는 tick 에서 불리지 않는다"), view, gameRoom, night·nyquist-*(아침 키 eliminated 하나), bots, hostLine(67건), gameMode, ruleset, e2eContract, viewRoles15(허용 키·구조 비교를 discussion·night·morning 으로), leak(허용 경로 접두는 두고 허용 목록만 줄임 + 지운 키가 위반으로 잡히는 시험), nightLeak·modeBasic·modePick·basicDay·alarm·nightCatchup 등.
- `legacyRoom.test`: "errand 단계 방 → 대기실", "심부름 개인 키 5종 각각", "errandLast·errandTickAt 방 키", "대기실 방 심부름 키 제거", "표시 없는 방은 같은 객체"와 판정 표 갱신(T-22-10).
- E2E: `errand.mjs` 삭제, `flows.mjs` 의 import·펼침·`openExtended`·등록 삭제, `lib.mjs`(ERRAND_*·EA/EC/EO/ER/RC/TC 판정과 표식·사본 상수, 단계 그래프의 errand 줄, EXPECTED/TOD 표의 errand, VIEW 허용 키), `browser.mjs`(readErrand·readRecord·readTrace·readMarks·walkToPlace·pressErrandAct·readErrandSignature·readStartCard·waitErrandDone), `host.mjs`(dayToErrand 구간·errand 지남 판정), `polish.mjs`(errand 줄·LIVE_GHOST_ABSENT_PHASES) 정리. `lib.test.mjs` 의 해당 시험 약 30건 삭제.
- smoke·uat·bots·perf-run: ERRAND_MS·심부름 대기·me.errand 단언·TRACE_PIECES·PLACE_IDS 사본·아침 길이의 흔적 항·errand 봇 분기 삭제, 전이 표의 확장판 errand 줄 삭제. perf-run 은 22-05 이월분인 `optional`/`skipOnce`/`skippedScenes` 죽은 분기도 지웠다.

## 시험 분류
- 삭제(기능 시험): unit 8 + client 5 + worker 4.
- 사슬·단계 열·허용 목록만 고침: 약 45개 파일(위 목록). 시드 고정 값(bots 의 discussion·night 디지털 값 등)은 errand 난수가 tick 에 없어도 변하지 않았다.
- 경계 시험으로 바꿈: leak(지운 키 위반 검출), e2eContract(BASIC_ABSENT 표식은 이제 src 에 없음을 단언), legacyRoom(심부름 방).

## 검증 결과 (모두 실제 실행)
- `npm run typecheck` (tokens:check·wrangler types·tsc app·tsc worker) — 초록.
- `npx vitest run` 전체 — 247 files passed · 6 skipped, 7369 tests passed · 261 skipped, exit 0. (첫 전체 실행은 13 파일 14건이 실패했고 모두 이 계획의 삭제가 만든 단계 열·허용 목록·상수 기대값이라 고쳤다. 부하 flake 는 없었다.)
- `node --test scripts/*.test.mjs scripts/e2e/*.test.mjs` — 628 pass · 0 fail.
- `npx vitest run test/worker/morningCards.test.ts test/worker/night.test.ts`(분필 윤곽 유지) — 전체 실행에 포함돼 초록.
- 인수 기준: errand 모듈 3·placeart 3파일·errand.mjs 부재, `grep -c placeart package.json` 0, `data-(errand|record)` 가 src 에 0건, hostLine 의 errand/witness/trace 키 0, `id: "errand"` 0, `rules.errand|witness|trace` 0, `PHASE_DEFS.dayAnnounce.next = discussion`. `git grep '"errand"'` 필터 결과 0(남은 문자열은 LEGACY 표시와 없음(0건) 단언뿐).
- 위생: 변경 파일의 금지어(`torder|티오더|조직|회사|~/project`) git grep 결과 0.

## Deviations from Plan

### Auto-fixed / 판단

**1. [Rule 3 - 계획 파일 목록 오류] `src/net/recordsSeen.ts` 를 지우지 않음**
- 계획 Task 2 목록에 있었으나 내용은 활동 기록 탭의 읽은 일지 수 저장(me.records)이다. 목격 기록(me.record)과 무관하고 RoomScreen 이 쓴다. 지우면 컴파일이 깨지므로 남겼고 `test/unit/recordsSeen.test.ts` 도 그대로다. `useKeyboardLift` 도 다른 화면이 써서 남겼다(계획의 조건 분기대로).

**2. [Rule 3] 계획 파일 목록 밖 파일을 같이 고침**
- 심부름 전용 연관물이라 함께 지웠다: `src/game/placeText.ts`, `MapDef.places`(map.ts·mapPlaza.ts), `src/world/store.ts` near 분기, `src/world/presence.ts`, `src/components/{WorldStage,HostBand,HeadStack,TestTools}.tsx`, `src/net/useMapInsets.ts`(주석), `scripts/e2e/{browser,host,modes,polish,sound,lib.test,polish.test}.mjs`, `scripts/{smoke.test,perf-run.test}.mjs`.

**3. [Rule 3] 한 커밋으로 묶음**
- 계획은 Task 별 커밋을 말하지만 서버·화면·시험·스크립트가 서로 묶여(앱 tsconfig 가 test 포함, e2eContract ↔ scripts) 중간 커밋은 typecheck 나 vitest 가 빨갛다. 22-05 와 같은 방식으로 한 커밋(`37aa30d8`)이다.

**4. [Rule 1] 시험 이름·표시값 정리**
- 지워진 구성요소에 맞춰 시험의 단계 개수·표 크기를 고쳤다: TOD_BY_PHASE 11→10, MAP_PHASES 11→10, 단계 표 15→14, soundDirector "16개 단계" → 14개(원래 이름이 틀렸다).

### 이월 처리(22-04·22-05 이월분)
- V2Icon flame·flameOff·footprint·window 삭제, host/sound/uat/flows/bots 의 cause-* 주석 정리, perf-run `optional`/`skipOnce` 분기 삭제 — 이 계획에서 처리했다.
- LEGACY_V3_* 표에 errand 단계·키를 더했다(22-07 이 mode 를 더한다).

## 실행하지 못했거나 이월하는 것
- 실기기·배포본 검사는 하지 않았다(사용자 방침: 실기기 검사는 끝에 몰아서, 배포는 계획 끝에서). `scripts/e2e` 브라우저 흐름·smoke 의 실제 실행도 하지 않았다 — 순수 도우미 시험(node --test 628)과 e2eContract 로만 검증했다.
- `test/helpers/playable.ts` 의 lockCause 계열 껍데기는 그대로다(22-08 이 호출부와 함께 삭제). `nightLeak.test.ts` 머리 주석의 "원인 흐름을 잠근다" 문구도 22-08 이 정리한다.
- `design/v3.0/assets/*.svg`(장소 그림 사본)는 설계 이력이라 둔다. 22-14 의 문서 갱신에서 `docs/`·`design/` 쪽 설명을 맞춘다.
- `MORNING_MAX_MS`(16초)는 도달하지 않는 상한으로 남아 있다. 22-07 에서 아침 길이를 만질 때 같이 판단한다.
- `docs/screen-map.md`·결정 기록에는 손대지 않았다.

## Known Stubs
없음.

## Threat Flags
없음 — 새 네트워크 면·인증 경로·신뢰 경계 스키마 변경이 없다. 와이어에서 키·메시지가 사라지기만 했다. T-22-10(errand 단계 옛 방)은 legacyRoom.test 로, T-22-11(누설 허용 목록)은 leak.test 의 접두 유지 + 지운 키 위반 검출로 닫았다.

## Self-Check: PASSED
- 커밋 `37aa30d8` 가 HEAD 에 있다(`git merge-base --is-ancestor` 확인).
- 삭제 대상 파일 부재, `.planning/phases/22-cleanup-single-mode/22-06-SUMMARY.md` 존재.
