---
phase: 23-keyword-day-one
plan: "01"
subsystem: game-flow
tags: [phase-id, keyword, view-leak-guard, pregame-card, feature-switch]
requires: []
provides:
  - "keyword 단계(PHASE_DEFS·KEYWORD_* 상수·roleReveal 마감 훅 routeAfterRoleReveal·beginGame 키워드 선택)"
  - "view 의 day.keyword(장르 라벨, 모두 같음)·me.keyword(산 시민 편 본인만, 마피아는 키 없음)"
  - "shared/game/keywords.ts(영화 장르 한 개·단어 32개·KEYWORD_SWITCH)와 shared/game/keywordAnswer.ts(서버 전용)"
  - "src/screens/Keyword.tsx 카드(PreGame 무대 위)·.mf-keyword__* 스타일·사회자 줄 keyword.act"
  - "시험 스위치(setup 두 곳 + openKeyword)와 가입 목록·스크립트 사본 갱신"
affects: [23-02, 23-03, 23-04, 23-05, 23-06, 23-09]
actuals:
  tokens: 22000
  tasks: 2
  commits: 4
plan_head_before: 09bea27876501b600f1856a27e91cd30c2ec7f25
plan_head_after: 161cb8a2fdb9c8a547a44149ec0af24d12c56928
tech-stack:
  added: []
  patterns:
    - "한 키 기능 스위치: RoomState.keyword 가 없으면 keyword 단계를 건너뛴다(D-29)"
    - "시험 보호 스위치: KEYWORD_SWITCH.on 을 setup 이 끄고 openKeyword() 가 시험 동안만 켠다(PLAYABLE_MAPS 잠금과 같은 방식)"
    - "서버 전용 값은 field-by-field 리터럴로만 view 에 싣는다(me.keyword 는 phase·생존·역할 세 조건)"
key-files:
  created:
    - shared/game/keywords.ts
    - shared/game/keywordAnswer.ts
    - src/screens/Keyword.tsx
    - test/helpers/keyword.ts
    - test/unit/keywordFlow.test.ts
    - test/worker/keyword.test.ts
    - test/client/keywordScreen.test.tsx
  modified:
    - shared/protocol.ts
    - shared/game/phases.ts
    - shared/game/room.ts
    - shared/game/tick.ts
    - shared/game/view.ts
    - shared/game/audience.ts
    - src/screens/RoomScreen.tsx
    - src/styles/phase.css
    - src/audio/director.ts
    - src/game/scenes.ts
    - src/game/dayView.ts
    - src/game/hostLine.ts
    - src/components/TestTools.tsx
    - scripts/smoke.mjs
    - scripts/e2e/lib.mjs
    - scripts/e2e/polish.mjs
key-decisions:
  - "시험 스위치는 setup 에서 끄고 켜는 시험만 openKeyword() 로 연다(연구의 startedGame 키 지우기 안 대신) — 워커 시험 22개 파일이 {t:\"start\"} 를 직접 보내고 단위 시험이 시작 때 난수 호출 수를 세므로 diff 가 작고 결정적이다"
  - "routeAfterRoleReveal 은 서버 전용 keywordAnswer.ts 에 둔다 — 클라이언트가 import 하는 phases.ts 는 키워드 모듈을 import 하지 않는다(Pitfall 8)"
  - "keywords.ts 는 최상위 함수 호출 없이 리터럴 + as const satisfies 만 쓴다 — room.ts 를 클라이언트가 import 해도 목록이 번들에 안 실린다"
  - "view.test.ts 는 파일 동안 스위치를 켠다 — 모든 단계 view 허용 목록 전수 검사가 keyword 단계와 그 앞뒤를 실제 전이로 지나게 한다"
requirements-completed: [SC1, SC7]
---

# Phase 23 Plan 01: 첫날 키워드 단계 트레이서 Summary

**첫날 역할 확인 → 13초 키워드 카드 → 낮 시작이 서버 단계·view·PreGame 위 카드까지 한 길로 돌고, 장르는 모두에게·키워드는 산 시민 편 본인에게만 가며 마피아 view 에는 키가 없다. 방 상태에 keyword 키가 없으면 옛 흐름 그대로다.**

## 해낸 것

- **단계·상수**: `PhaseId` 에 `keyword`(roleReveal 다음). `KEYWORD_READ_MS 3000 + KEYWORD_WRITE_MS 10000 = KEYWORD_MS 13000`. `roleReveal.next = "keyword"`, `keyword.next = "dayAnnounce"`, `revealsOwnRole: true`. keyword 단계의 `state.day` 는 아직 없다(Pitfall 1).
- **한 키 스위치(D-29)**: `HOOKS.deadline.roleReveal = routeAfterRoleReveal` 이 방 상태에 `keyword` 가 없으면 곧장 dayAnnounce 로 보낸다. keyword 마감 훅은 23-06 이 더하며 지금은 표의 기본 next 다.
- **키워드 선택(D-05)**: `beginGame` 이 `decideMap` 뒤 `randInt` 두 번(장르·단어)으로 `{ genre, word }` 를 고른다. 시작과 다시 하기가 같은 본체다. 스위치가 꺼지면 들어온 상태의 `keyword` 키도 지운다. 다시 하기는 허용 목록 복사라 `keyword` 가 새 판으로 새지 않는다.
- **view(D-06)**: `DAY_PHASES` 에 `keyword`(D-23, `MAP_PHASES`·`CHAT_PHASES` 에는 넣지 않음). `day.keyword = { genre: 라벨 }` 가 모두에게 같고, `me.keyword` 는 phase keyword · 산 사람 · 역할 있음 · 마피아 아님일 때만 만든다.
- **화면**: `Keyword.tsx` — 역할 확인과 같은 PreGame 무대(`sceneKey preGame`, 무대를 다시 만들지 않음) 위 카드(장르 · 큰 키워드/`???` · 각주). 카드 `role=group` 이름 "첫날 문제", 마피아의 키워드 자리 이름 "키워드는 알 수 없어요". 표식 `data-keyword-*` 에는 값이 없다. 등장은 opacity+translateY 420ms, 재접속(단계 시작 420ms 뒤)·모션 줄이기는 모션 없음. 띠 문장은 역할 무관 `keyword.act` "떠오르는 말을 적어요".
- **가입 표**: `BED_OF`·`ENTER_SOUND`·`PHASE_SCENE`·`PHASE_ANNOUNCE`·`TEST_PHASE_LABEL`·`DAY_COPY.titles`·`hostKeyOf` 와 컴파일러가 못 잡는 `worldVisibleTo`·스크립트 사본·시험 표 전부.

## 커밋

| 순서 | 해시 | 내용 |
| ---- | ---- | ---- |
| 1 (RED) | b4814bbe | `test(23-01): 첫날 키워드 단계 한 길 실패 시험` — 세 시험 파일이 모듈 없음으로 실패(3 files failed) |
| 2 (GREEN) | ad1779c8 | `feat(23-01): 첫날 키워드 단계와 카드 — 서버 단계부터 화면까지` |
| 3 (RED) | 5fccc0fc | `test(23-01): keyword 단계 가입 목록 실패 시험` — vitest 5건·node 5건 실패 |
| 4 (GREEN) | 161cb8a2 | `feat(23-01): keyword 단계 가입 목록·사본·번들 가드` |

- **RED 증거**: Task 1 은 `keywordFlow`·`keyword`(worker)·`keywordScreen` 세 파일이 `shared/game/keywords`·`src/screens/Keyword` 부재로 로드 실패. Task 2 는 audience 1건·e2eContract 3건·scenes 1건(vitest 5건), lib.test·polish.test·smoke 표(node 5건)가 실패했다.
- **typecheck 결합**: `PhaseId` 유니온에 `"keyword"` 를 더하면 `Record<PhaseId,…>` 표 여덟 곳(PHASE_DEFS·BED_OF·PHASE_SCENE·PHASE_ANNOUNCE·TEST_PHASE_LABEL·timeOfDay.test·emotePhases.test·phaseScreens.test)이 typecheck 로 묶여 Task 1 의 GREEN 은 서버·화면·표를 한 커밋으로 나눌 수 없었다. 시험·스크립트 사본 churn 은 D-31 대로 Task 2 에서 따로 커밋했다.

## 검증 결과

| 확인 | 결과 |
| ---- | ---- |
| Task 1 automated(keywordFlow·worker keyword·keywordScreen·timeOfDay·emotePhases·phaseScreens) | 6 files · 178 tests 통과 |
| `npx vitest run --project unit --project client` | 197 files 통과 · 6715 tests 통과(176 skipped) |
| `node --test scripts/*.test.mjs scripts/e2e/*.test.mjs` | 622 중 622 통과 |
| `npx vitest run --project worker` | 45 files 통과 · 511 tests 통과(62 skipped) — 부하 간헐 실패 없음 |
| `npm run typecheck` | 통과 |
| `npm run build` + 번들 grep | 빌드 성공, `dist/client/assets/*.js` 11개, 표본 별칭 `Harry Potter` 없음, 표본 단어 "해리포터"·"타이타닉"도 없음 |
| 승인 기준 grep | `"keyword"` protocol 1 · `KEYWORD_MS = …` 1 · `roleReveal: routeAfterRoleReveal` 1 · `pickKeyword(` 1 · setup 두 파일 `KEYWORD_SWITCH.on = false` 각 1 · `case "keyword"` 2 · `.freeze(` 0 · `roleReveal: ["keyword"]` smoke·lib 각 1 · audience 1 · MAP_PHASES 0 · polish 1 |

## 집합별 "넣음 / 넣지 않음" 표 (D-04, Pitfall 2)

| 위치 | keyword | 이유 |
| ---- | ------- | ---- |
| `DAY_PHASES`(view.ts) | 넣음 | view.day 가 있어야 day.keyword 를 싣는다(D-23) |
| `worldVisibleTo`(audience.ts) | 넣음 | 키워드 중 재접속한 폰의 PreGame 무대가 비지 않게 |
| `PHASE_DEFS`·`BED_OF`·`PHASE_SCENE`·`PHASE_ANNOUNCE`·`TEST_PHASE_LABEL`·`titles` | 넣음 | Record/표 가입 |
| `ENTER_SOUND` | 넣음 `ui.card` | 카드가 나타나는 한 번 |
| `hostKeyOf` | 넣음 `keyword.act` | `default → fallback` 이라 직접 case 가 필요 |
| `sceneKey`·`renderPhase`(RoomScreen) | 넣음 | preGame 무대를 다시 만들지 않으려고 |
| smoke `PHASE_NEXT`·`DAY_PHASES`, lib `PHASE_GRAPH`·`EXPECTED_SCENE`·`VIEW_ME/DAY_KEYS`, polish `TOD_ABSENT_PHASES` | 넣음 | 서버 사본 |
| `MAP_PHASES`(movement.ts) | 넣지 않음 | 걷기·이동 없음(D-01) |
| `CHAT_PHASES`(audience.ts) | 넣지 않음 | 채팅·동작·입력 중 없는 조용한 시간 |
| `BADGE_PHASES`·`WHISPER_PHASES` | 넣지 않음 | 해당 장치 단계가 아님 |
| `FIXED_PHASES`(presence.ts) | 넣지 않음 | 카메라 고정은 맵 단계용(PreGame 은 걷기 없음) |
| `TICK_PHASES`(director.ts) | 넣지 않음 | P23-26: 키워드에는 카운트다운 틱 없음 |
| `TIMELESS_PHASES`·`HOST_HIDDEN_PHASES` | 넣지 않음 | keyword 는 시간이 있고 띠가 보인다 |
| `layoutKey`(gather.ts) | 변경 없음 | 기본 `null`, 배치 없음 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 계획 밖 시험 파일 갱신**
- **Found during:** Task 2 전체 단위 실행(Task 1 은 지정된 시험 6개만 돌려 놓쳤다)
- **Issue:** Task 1 의 GREEN 이 `test/unit/tick.test.ts`(단계 수·행 값), `scenes.test.ts`(PHASE_SCENE 전수), `testTools.test.ts`(roleReveal skip 다음 단계), `soundDirector.test.ts`(침대 표), `test/client/preGame.test.tsx`(RoomScreen 소스 정규식 `case "assigning": case "roleReveal": return "preGame"`), `scripts/smoke.test.mjs` 의 기대값을 깨뜨렸다.
- **Fix:** 모두 keyword 를 아는 기대값으로 고쳤다(RED 커밋 5fccc0fc 에 시험분, GREEN 커밋 161cb8a2 에 smoke.test).
- **Files modified:** test/unit/tick.test.ts, test/unit/scenes.test.ts, test/unit/testTools.test.ts, test/client/preGame.test.tsx, scripts/smoke.test.mjs
- **Commit:** 5fccc0fc · 161cb8a2

**2. [Rule 3 - Blocking] smoke 낮 시작 대기 한도 30초 → 45초**
- **Found during:** Task 2 스크립트 사본 갱신
- **Issue:** 역할 확인 15초 + 키워드 13초로 한도 30초가 빠듯해 배포본 smoke 가 거짓 실패할 수 있다.
- **Fix:** `scripts/smoke.mjs` 의 dayAnnounce 대기를 45_000 으로(사유 주석).
- **Commit:** 161cb8a2

**3. [Rule 2/3 - 계획 보강] view.test.ts 는 파일 동안 스위치를 켠다**
- **Issue:** 계획은 view.test 의 PHASES 에 keyword 를 넣으라고만 했는데, setup 이 스위치를 끄면 `stateAt("keyword")` 가 닿지 못한다.
- **Fix:** 파일에 `beforeAll(openKeyword)`·`afterAll(restore)` 를 두고, `phaseKeyViolations` 에 day.keyword(keyword 단계에만, genre 한 키)와 me.keyword(산 시민 편에게만, 서버 값 그대로) 단언을 더했다. 마감 사슬 기대값은 역할 확인 18000 + 키워드 13000 + 발표 2000 으로 고쳤다.
- **Commit:** 5fccc0fc

**4. [작은 보강] pre-game 시험 하나 더**
- `phaseScreens.test.tsx` 에 "역할 확인 → 키워드는 같은 3D 무대 요소, 키워드 → 낮 시작은 새 요소" 시험을 더했다(P23-1).

### 계획과 같게 한 것

- 첫 장르 첫 항목은 context 의 해리포터 줄 그대로. 영화 장르 단어는 32개(23-04 가 장르·별칭을 채운다).

## Known Stubs

없음. `keywords.ts` 는 영화 한 장르만 있는 초안이고 머리 주석에 "초안, 사용자 검토 대기(0089-23)" 를 적었다(23-04 가 채움, 의도된 단계).

## 이월 · 확인하지 못한 것

- **backstop(UI 크기 측정)**: "??? 글자 간격 0.2em 이 360 폭에서 카드 안에 들고 시민 카드와 높이가 같다", 각주 2줄 158·키워드 2줄 201 의 실측은 이 계획에서 브라우저로 재지 않았다(CSS 값만 문서화). 뒤 E2E·실기기 검사에 맡긴다.
- **입력줄·`keyword.wait`·제출 뒤 줄·빛남 표**는 23-09, 답 공개·정답·조기 진행은 23-05·23-06 — 이 계획 범위 밖이다.
- **`scripts/uat-test-room.mjs`**: 전이 표 정규식(`roleReveal: ["dayAnnounce"]`)을 e2eContract 가 그대로 확인하고 있고 이 계획 파일 목록에 없어 건드리지 않았다. 연구 P1 #24 대로 22 에서 이미 낡았고 keyword 가 끼면 더 어긋나므로 24 배포 검증 전에 고쳐야 한다(이월).
- `badgeView.test`·`whisperView.test`·`testTools.test` 의 단계 배열(`ALL`·`SKIPPABLE`)과 `bots.test.ts` 의 `allowed` 목록은 keyword 를 넣지 않았다(스위치가 꺼져 도달하지 않고, 넣지 않아도 초록). 뒤 계획이 키워드를 켠 봇 판을 돌리면 `bots.test` 의 허용 목록에 keyword 를 더해야 한다.
- 로컬 dev 서버·실기기 확인은 하지 않았다(배포·실테스트는 사용자 지시대로 뒤로).

## Threat Flags

없음. 새 네트워크·인증·파일 접근 표면이 없고, 계획의 위협(T-23-01 마피아 view 누설·T-23-02 번들 누설·T-23-03 DOM 표식)은 mitigate 대로 단언 시험과 번들 grep 으로 닫았다.

## Self-Check: PASSED

- 파일 존재: shared/game/keywords.ts · shared/game/keywordAnswer.ts · src/screens/Keyword.tsx · test/helpers/keyword.ts · test/unit/keywordFlow.test.ts · test/worker/keyword.test.ts · test/client/keywordScreen.test.tsx
- 커밋 존재: b4814bbe · ad1779c8 · 5fccc0fc · 161cb8a2
