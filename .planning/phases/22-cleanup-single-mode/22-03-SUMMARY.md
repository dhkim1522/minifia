---
phase: 22-cleanup-single-mode
plan: "03"
subsystem: tutorial-removal/legacy-room
tags: [tutorial, cleanup, normalizeStoredRoom, legacy-room, e2e]
requires: [22-01, 22-02]
provides:
  - "서버·와이어에서 옛 튜토리얼 제거: PhaseId tutorial·TUTORIAL_MS·tutorialDone·start.tutorial 옵션·view.tutorial·me.tutorialDone·shared/game/tutorial.ts"
  - "isLegacyV3Room(stored) 옛 방 표시 판정 한 곳(LEGACY_V3_* 표)과 toLobbyFromLegacy(stored) 대기실 되돌림 — 이후 22-04~22-07 이 표시를 더한다"
  - "normalizeStoredRoom 첫머리에서 옛 표시 방을 대기실로 되돌림(표시 없는 판 중 방은 같은 객체, DO 재기동 안전)"
  - "첫 화면·방장 줄에서 튜토리얼 진입 마운트 제거(DOM 0건)"
  - "소리 id 68 -> 56(tut.* 12개 삭제, voice.syl 유지)"
affects: [22-04, 22-05, 22-06, 22-07, 22-14, 24]
key-files:
  created:
    - test/unit/legacyRoom.test.ts
  modified:
    - shared/game/room.ts
    - shared/game/phases.ts
    - shared/game/tick.ts
    - shared/game/view.ts
    - shared/game/audience.ts
    - shared/protocol.ts
    - shared/schemas.ts
    - worker/room.ts
    - src/screens/Home.tsx
    - src/screens/Lobby.tsx
    - src/screens/RoomScreen.tsx
    - src/components/v2/HostRailButton.tsx
    - src/net/session.ts
    - src/audio/recipes.ts
    - src/audio/director.ts
    - src/debug/soundLabTable.ts
    - scripts/e2e/lib.mjs
    - scripts/e2e/browser.mjs
    - scripts/e2e/flows.mjs
    - scripts/bots.mjs
    - docs/audio.md
    - docs/screen-map.md
  deleted:
    - shared/game/tutorial.ts
    - src/screens/TutorialScreen.tsx
    - "src/components/v2/Tutorial{EndCard,Entry,Evidence,HostBand,Next,Progress,Reveal,RoleCards,Wait}.tsx"
    - src/components/v2/FocusRing.tsx
    - src/components/v2/OpeningFx.tsx
    - src/game/tutorialScript.ts
    - src/net/useTutorialDirector.ts
    - src/net/useTutorialWarm.ts
    - "src/styles/tutorial.css, tutorialEntry.css, tutorialRoom.css"
    - scripts/e2e/tutorial.mjs
    - "시험 14개(unit 3·worker 2·client 8 + focusRing.test.tsx 1)와 헬퍼 test/helpers/fakeTutorialStage.ts"
decisions:
  - "옛 방 정규화는 '옛 표시가 있는 방만' 대기실로 되돌린다(RESEARCH A6 의 일괄 재설정 대신 D-03 문언). 방 DO 가 하이버네이션이라 생성자가 판 중에도 자주 다시 돈다 — 전부 되돌리면 새 판이 깰 때마다 사라진다. 결정 0090 은 22-14 가 쓰므로 이 선택을 22-14 로 넘긴다."
  - "toLobbyFromLegacy 는 REMATCH_ROOM_KEYS·REMATCH_PLAYER_KEYS 허용 목록으로 키만 남기고(펼쳐 복사 아님) 쉬는 사람(bench)도 참가자로 합류시킨다(resetToLobby 와 같음)"
  - "FocusRing·OpeningFx 는 튜토리얼 전용이라(data-tutorial-* 표식·tutorialScript import) 함께 삭제했다(Rule 3, 편차 참조)"
  - "voice.syl 과 voice.ts 는 남긴다(소리 id 하나, 24페이즈 새 튜토리얼이 쓸 사회자 웅얼 음절)"
  - "OVERALL_LIMIT_MS(1740초)는 줄이지 않는다 — 기준 수치가 아니라 중단 한도"
metrics:
  tasks: 3
  duration: 약 16분
status: complete
actuals:
  tokens: 9700
  tasks: 3
  commits: 4
plan_head_before: 51386f4108eaea2c319968bd9ee5f6f7803af309
plan_head_after: e11274cd166425e8f686eed504a3be00056a102e
commits: 4
---

# Phase 22 Plan 03: 옛 튜토리얼 삭제와 옛 방 정규화 뼈대 Summary

옛 튜토리얼(서버 단계·와이어·화면·부품·소리·시험·E2E)을 지우고 첫 화면 [혼자 하기]·방장 줄 [튜토리얼 먼저]를 마운트하지 않으며, `normalizeStoredRoom` 이 옛 표시가 있는 방만 대기실로 되돌리는 뼈대(`isLegacyV3Room`·`toLobbyFromLegacy`)를 시험으로 고정했다(결정 0089-15, D-03·D-08·D-29).

## 한 일

**Task 1 — 서버·와이어 (TDD)**
- RED(`2135de07`): `test/unit/legacyRoom.test.ts` 신설(9건). 자리 export 상태에서 6건 실패·3건 통과.
- GREEN(`2bde5f7c`): `shared/game/tutorial.ts` 와 시험 3개 삭제. `PhaseId` 의 `"tutorial"`, `RoomView.tutorial`·`TutorialView`, `me.tutorialDone`, 메시지 `tutorialDone`, `start.tutorial` 옵션을 지웠다. 스키마는 `z.strictObject({ t: "start" })` 라 옛 클라이언트의 `tutorial` 키는 BAD_MESSAGE 로 거절된다(T-22-05). `PHASE_DEFS.tutorial`·`TUTORIAL_MS`, tick 의 `clearTutorial` 진입 훅, `view.ts` 튜토리얼 블록, `audience.ts` 의 tutorial 항목, `worker/room.ts` 의 `handleTutorialDone`·`applyTutorialDone`·끊김 시 전원 완료 분기, `startGame`·`beginGame` 의 옵션 인자를 지웠다. `beginGame` 은 늘 `assigning` 으로 간다.
- `room.ts`: `LEGACY_V3_ROOM_KEYS(tutorialPassed)`·`LEGACY_V3_PLAYER_KEYS(tutorialDone)`·`LEGACY_V3_PHASES(tutorial)` 표와 `isLegacyV3Room`·`toLobbyFromLegacy` 를 구현하고 `normalizeStoredRoom` 첫머리에서 부른다. 대기실 방이면 옛 키만 지우고(같은 객체가 아닌 새 객체), 그 밖의 방은 REMATCH 허용 목록으로 대기실을 새로 만든다(맵 선택·방장·앉은 사람 식별·testMode 유지, day·voteLog·verdict·winner·역할·map 없음).
- 튜토리얼을 단언하던 단위·worker 시험(audience·emotePhases·gameMode·tick·timeOfDay·view·leak·modeBasic)을 지우거나 "없음" 단언으로 바꿨다. leak 시험의 `SERVER_ONLY_KEYS` 에서 `tutorialPassed` 도 뺐다(키가 더는 없다).

**Task 2 — 화면·소리**
- 화면 파일 16개(TutorialScreen, Tutorial* 부품 9, tutorialScript, 훅 2, css 3)와 시험 13개·`fakeTutorialStage` 삭제(FocusRing 시험 1개는 편차 1). `Home.tsx` 는 `TutorialEntry`·`TutorialEndCard` 마운트와 상태·핸들러를 지워 [방 코드 칸]·[방 만들기] 가 위로 올라오고 새 간격을 만들지 않는다(P22-16). `Lobby.tsx`·`HostRailButton.tsx` 는 [튜토리얼 먼저] 단추·상태·`pressTutorial`·`start` 의 `tutorial` 인자를 지웠다. `RoomScreen.tsx` 는 tutorial 단계 분기·완료 전송 ref·useSound 끄기 조건을 지웠다. `session.ts` 의 튜토리얼 본 표시 키 함수 삭제.
- 소리: `tut.*` 12개(SOUND_IDS·레시피·화면 대응 줄·실험실 이름)를 지워 소리 id 가 68 → 56(효과음 61 → 49)이 됐다. `voice.syl` 은 남겨 실험실의 "사회자 목소리" 묶음 하나로 둔다. `docs/audio.md` 지도·개수도 맞췄다.
- 시험: 방장 줄 단추 id 유니언을 `"mode" | "bots"` 로 줄이고 hostRail·lobby·dressSheet·resultScreen 시험을 맞췄다. `lobby.test.tsx` 에 "튜토리얼 진입이 없다(DOM 0건)" describe, `screens.test.tsx`(Home)에 진입 DOM 0건·남은 자식 `FORM,BUTTON` 단언을 더했다.
- E2E lib 의 방장 줄 판정은 앱 변화에 묶여 이 태스크에서 함께 맞췄다(아래 편차).

**Task 3 — E2E·스크립트**
- `scripts/e2e/tutorial.mjs` 와 흐름 `tutorial-solo`·`tutorial-together` 삭제, `lib.mjs` 의 튜토리얼 판정 함수·사본 상수 블록(약 450줄)과 시험, `browser.mjs` 의 `readTutorial`·`readTutorialStable`·`readTutorialCase`·`openSoloPage`·튜토리얼 소켓 필드, `bots.mjs` 의 `tutorialDone` 전송, `polish.mjs` 의 `TUTORIAL_ROLE_MAX_LINES` 삭제. `modes.mjs`(D10a 의 토글 켜기를 "토글 0개 확인"으로)·`mapselect.test.mjs` 를 토글 없는 줄에 맞췄다. `docs/screen-map.md` 튜토리얼 절에 "22페이즈에서 지움, 24페이즈가 새로 만든다" 안내 한 단락.

## RED 증거

- Task 1 RED(`2135de07`): `npx vitest run test/unit/legacyRoom.test.ts` → 9건 중 **6건 not ok**(phase tutorial → lobby 되돌림·진행 키 제거·tutorialPassed·tutorialDone·대기실 키 정리·판정 함수), 3건은 "표시 없는 방은 같은 객체"류라 통과.

## 검증 결과 (모두 실제 실행)

| 명령 | 결과 |
| --- | --- |
| Task 1 verify: `npx vitest run test/unit/legacyRoom.test.ts gameRoom tick view audience test/worker/leak` + 확장(gameMode·emotePhases·timeOfDay·modeBasic) | 10 파일 557 통과·22 건너뜀 |
| `npx tsc -p tsconfig.worker.json --noEmit` | 오류 0 |
| Task 2 verify: `npx vitest run --project client` | 90 파일 3052 통과(77 건너뜀) |
| 단위 시험 묶음(session·soundRecipes·soundLab·soundDirector·hostLine·scenes·e2eContract 외) | 통과 |
| `npm run typecheck`(tokens·placeart·wrangler types·app·worker) | 종료 0 |
| Task 3 verify: `node --test scripts/*.test.mjs scripts/e2e/*.test.mjs` | pass 682 / fail 0 |
| `npx vitest run --project unit` | 149 파일 4944 통과(107 건너뜀) |
| 계획 끝 `npx vitest run --project worker` | 61 파일 631 통과(78 건너뜀) — 이번엔 flake 없음 |

수용 기준: `shared/game/tutorial.ts`·`scripts/e2e/tutorial.mjs` 없음 / `"tutorial"` in protocol·phases 0건 / `isLegacyV3Room` 2건 이상 / `git ls-files src | grep -ci tutorial` 0 / `tut.` in recipes 0 / `data-tutorial` in src 0 / `TutorialEntry|TutorialEndCard` in src 0 / flows 의 `tutorial-` 흐름·`makeTutorialFlows` 0.

남은 `tutorial` 문자열(`git grep -n "tutorial\|Tutorial" -- src shared worker scripts test`): ① `room.ts` 옛 키 표·주석, ② `protocol.ts`·`schemas.ts` 주석, ③ 없음 단언(hostRail·lobby·screens·joinByLink·resultScreen·view·modeBasic·legacyRoom·lib.test HR7·VIEW 키), ④ `modes.mjs` D-10 흐름의 단계 검사·토글 0개 확인(22-07 이 흐름째 지운다), ⑤ `design/v3.0/tutorial/Main.dc.html` 원본 경로(`make-placeart.mjs`·`placeArt.tsx`·`placeArt.test.ts` 주석 — 22-06 이 지운다), ⑥ `lib.mjs` 주석 2곳(OVERALL_LIMIT_MS 이력).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] FocusRing·OpeningFx·focusRing 시험을 함께 삭제**
- **Found during:** Task 2
- **Issue:** 계획은 둘을 "남기고 튜토리얼 분기·주석만 지우기"로 적었지만 `OpeningFx` 는 삭제되는 `tutorialScript` 를 import 하고, `FocusRing` 은 `data-tutorial-screen/dim/hole/focus` 표식과 삭제되는 `tutorial.css` 에만 기대며 둘 다 `TutorialScreen` 밖의 사용처가 없었다(수용 기준 `data-tutorial` 0건과도 충돌).
- **Fix:** `src/components/v2/FocusRing.tsx`·`OpeningFx.tsx`·`test/client/focusRing.test.tsx` 삭제. git 이력에 남아 24페이즈가 필요하면 복원할 수 있다(`00829164^`).
- **Commit:** `00829164`

**2. [Rule 3 - Blocking] E2E lib 의 방장 줄 판정(HR4·HR7)·소리 개수·단계 사본을 Task 2 에서 맞춤**
- **Found during:** Task 2 (e2eContract 가 앱 값과 lib 사본을 대조)
- **Issue:** 앱의 방장 줄 id 가 `mode|bots` 로 줄고 소리 id 가 56 이 되자 `HOST_RAIL_ORDER`·`SOUND_RENDER_LIMITS.count`·`EXPECTED_SCENE`·`TOD_ABSENT_PHASES`·`VIEW_*_KEYS` 사본이 어긋나 e2eContract 가 실패한다. Task 3 으로 미루면 Task 2 verify 가 초록이 될 수 없다.
- **Fix:** 사본을 앱에 맞추고 HR 계열 fixture 를 단추 셋 줄로 다시 계산(`railIn` 높이 212 등). HR7 은 "튜토리얼 토글 없음"으로 의미를 바꿨다(id 는 유지해 `hostRailChecks` 줄 수 8 이 변하지 않는다).
- **Commit:** `00829164`

**3. [Rule 2 - 누락된 정리] 계획 목록 밖 파일 수정**
- `docs/audio.md`(레시피 지도 `tut.*` 행·개수 — `soundProtocol.test` (라)가 지도를 대조), `docs/screen-map.md`(안내 한 단락), `scripts/e2e/sound.mjs`·`polish.mjs`·`polish.test.mjs`, `src/audio/director.ts` 단계 표, `src/debug/soundLabTable.ts`, `src/game/{hostLine,lampView,modeText,scenes}.ts`, `src/components/{TestTools,v2/HostBand}.tsx`, `src/net/useFixedRoomHeight.ts` 주석 — 모두 지운 단계·키·소리를 가리키던 곳이라 컴파일·시험을 위해 고쳤다.

### Deferred / 알려둘 것

- `docs/decisions/0090` 에 적으라던 "옛 방은 옛 표시가 있을 때만 대기실로" 선택은 0090 파일이 22-14 의 산출물이라 여기서 만들지 않았다. 22-14 의 계획(`must_haves` 에 이미 같은 문구)이 받는다.
- `OVERALL_LIMIT_MS` 는 그대로(1740초). 22-12~22-13 이 E2E 흐름을 크게 줄이면 그때 조정한다.
- 이월: `toLobbyFromLegacy` 의 REMATCH 허용 목록에 `mode` 가 아직 있다(22-07 이 mode 를 지울 때 목록과 함께 빠진다). 22-04~22-07 은 `LEGACY_V3_ROOM_KEYS`·`LEGACY_V3_PLAYER_KEYS`·`LEGACY_V3_PHASES` 에 표시를 한 줄씩 더하고 `legacyRoom.test.ts` 에 대응 시험을 더하면 된다.
- 실기기·배포본 확인은 하지 않았다(UAT 는 끝에 몰아서 — 사용자 메모).

## Known Stubs

없음. (voice.syl 은 24페이즈가 다시 쓰기 전까지 쓰는 곳이 없는 소리지만 스텁이 아니라 계획대로 남긴 부품이다.)

## Threat Flags

없음. 새 네트워크 경로·권한 경로를 만들지 않았다. 와이어 입력은 줄었다(`tutorialDone`·`start.tutorial` 거절). 저장소 읽기 경로의 새 분기는 계획의 T-22-03·T-22-04 로 `legacyRoom.test.ts` 가 막는다.

## Self-Check: PASSED

- 4개 커밋 모두 HEAD 의 조상: `2135de07`·`2bde5f7c`·`00829164`·`e11274cd` (`git merge-base --is-ancestor`).
- `test/unit/legacyRoom.test.ts`·`shared/game/room.ts`(`isLegacyV3Room` 2건 이상) 존재, 삭제 대상 파일 부재 확인.
- STATE.md·ROADMAP.md·state.json·`Claude outputs/` 는 건드리지 않았다.
