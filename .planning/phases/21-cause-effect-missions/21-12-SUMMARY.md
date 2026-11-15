---
phase: 21-cause-effect-missions
plan: "12"
subsystem: client-tutorial-first-case
tags: [cause-effect, tutorial, suspect-board, lamp, clue-spot, hidden-identity, tdd]
status: complete

requires:
  - phase: 21-cause-effect-missions
    provides: "21-02 의 TOWN_LAMPS·TOWN_CLUE_SPOTS, 21-08 의 ErrandAct·[켜기] 모양(LAMP_ACT_LOOK), 21-10 의 ClueSpot·ClueCard·spotsOf·clueCardsOf, 21-11 의 boardOf·SuspectBoard(props 만 받는 부품)"
provides:
  - "tutorialScript.ts 새 흐름: 출연 맵 town·등불 셋(lamp2 목표)·서연 집 앞 지점(TOWN_CLUE_SPOTS[2])·가짜 view 가 원인 흐름 판(mode extended), tutorial.hidden 키와 새 문구 표, 오프닝 개관(overview) 카메라와 집 창 하나씩 꺼짐"
  - "TutorialScreen: 장면 3 [켜기]→진행 1/3→0.7초 뒤 4, 장면 4 [살펴보기]→단서 카드 '붉은 천 조각'→[다음], 장면 5 GameMap 토론 경로의 실제 SuspectBoard + 선 하나, 장면 6 뒤집히지 않는 정체 카드"
  - "TutorialReveal: 뒷면 마름모 + lock + '정체는 판이 끝나야 알아요' + 도장 '처형'(직업 이름·그림·불꽃·팡파르 없음)"
  - "직업 카드 줄(시민·마피아·의사 새 문장, 경찰 그대로)·마무리 '단서로 거짓말을 잡아요'·기다림 팁 새 두 줄"
affects: [21-13, 21-14, 21-15]

requirements-completed: [TUT-06]

estimate:
  tokens: 95000
  raw_tokens: 95000
  tasks: 2
  confidence: low

actuals:
  tokens: 45000
  tasks: 2
  commits: 5

plan_head_before: 390c044dbb62f3df6aa99e35dc6cafce49157601
plan_head_after: d225a56d02658dd6f32653b809a1916bb5c90bba
commits: 5

tech-stack:
  added: []
  patterns:
    - "튜토리얼 가짜 view 는 mode extended 를 명시한다 — 화면 부품이 rulesetOf(modeOf(view)) 로 저녁 등불·아침 지점·토론 보드를 가르기 때문. 시험은 openCause() 아래에서 돈다"
    - "행동 상태(lit·inspected)는 장면 시작 시각(at)을 같이 들고 있어 장면이 바뀌면 저절로 깨끗해진다(기존 VoteState 와 같은 방식)"
    - "출연 좌표는 마을 표에서 파생한다: TUTORIAL_START = lamp2 에서 남쪽 0.5, TUTORIAL_CLUE_START = 옷 조각 지점에서 서쪽 0.5 — 상수가 두 곳에 없다"

key-files:
  created: []
  modified:
    - src/game/tutorialScript.ts
    - src/screens/TutorialScreen.tsx
    - src/components/v2/TutorialReveal.tsx
    - src/components/v2/TutorialEvidence.tsx
    - src/components/v2/TutorialRoleCards.tsx
    - src/components/v2/TutorialEndCard.tsx
    - src/components/v2/TutorialWait.tsx
    - src/styles/tutorial.css
    - src/styles/phase.css
    - test/unit/tutorialScript.test.ts
    - test/unit/tutorialStaticGuard.test.ts
    - test/client/tutorialScenes.test.tsx
    - test/client/tutorialScreen.test.tsx
    - test/client/tutorialGate.test.tsx
    - test/client/tutorialOpening.test.tsx
    - test/client/tutorialEntry.test.tsx
    - test/client/tutorialWait.test.tsx
    - test/helpers/fakeTutorialStage.ts
    - test/unit/e2eContract.test.ts
    - scripts/e2e/lib.mjs
    - scripts/e2e/lib.test.mjs
    - scripts/e2e/tutorial.mjs
    - scripts/e2e/browser.mjs

key-decisions:
  - "TutorialEvidence 는 쓰지 않는 대신 줄여서 남겼다: 눈 표시·수식 줄·두 번째 선·증거 카드 위의 선을 지우고 TutorialLinks(칩 → 도윤 얼굴 선 하나, 1초 draw)와 clampPoint 만 둔다. 보드 자체는 GameMap 의 토론 경로가 가짜 view 의 boardOf 결과로 실제 SuspectBoard 를 그린다(같은 코드 길을 타서 어긋날 수 없다)"
  - "장면 3 의 가로등 표지는 셋이다(진행 점 0/3 과 맞추려고 내 등불 3곳을 배정). 한 곳(lamp2)만 반경 안이라 [켜기] 가 서고 포커스 상자는 표지 + [켜기] 한 묶음이다. 표지 하나만 그리는 길은 GameMap 을 바꿔야 해서 쓰지 않았다"
  - "장면 4 의 [다음] 은 시간표가 아니라 행동이 연다: 새 진행 방식 { kind: inspect } (장면 표 4행)"
  - "정체 카드의 줄은 tutorial.hidden 한 곳(TUTORIAL_LINES)에서 읽고 TUTORIAL_PICK.reveal = { line } 이다(소리 없음). 정답의 소리는 이름표를 누를 때 tut.stamp 한 번뿐"
  - "경찰 카드 줄은 '그대로' 로 읽어 ROLE_TEXT.police.desc('의심되는 사람을 조사하세요.')를 유지했다 — UI-SPEC 표의 '밤에 한 명이 마피아인지 알아봐요' 와 글이 달라 다음 검토에서 정해야 한다"
  - "정체 카드에서 진홍을 뺐다(마피아 이름·그림이 없으므로). phase.css 머리 주석의 진홍 예약 6번에서 '정체 공개' 를 지웠다"

metrics:
  duration: 약 1시간 40분
  completed: 2026-11-15
---

# Phase 21 Plan 12: 튜토리얼 첫 사건 새 흐름 Summary

튜토리얼 "첫 사건"이 새 흐름을 따른다: 1 밤(마을 개관 시점에서 집 창이 하나씩 꺼지고 비명) → 2 아침 → 3 등불 켜기(가로등 표지·진행 점 0/3·[켜기]) → 4 현장 조사(서연 집 앞 지점 셋·[살펴보기]·카드 '붉은 천 조각') → 5 의심 보드(실제 SuspectBoard, 칩 → 도윤 얼굴 선 하나) → 6 투표(정답이어도 정체 카드는 뒤집히지 않는다: 뒷면 + 자물쇠 + "정체는 판이 끝나야 알아요" + 도장 "처형") → 7 직업 카드 → 8 마무리. 장면 수 8·두 진입로·서버 0 은 그대로다.

## TDD 증거 (RED 2줄)

- Task 1: `test(21-12)` `61e59e5d` — `--reporter=tap-flat` **not ok 31 / ok 71**(대본 단위 + 정적 가드). 의미 확인: 실패는 장면 표 advance·출연 맵 town·새 문구 아홉·가짜 view(원인 흐름 판, 서연 집 앞 지점, boardOf 칩·얼굴 표시)·TUTORIAL_PICK 새 모양·오프닝 개관 카메라·집 창 꺼짐·마을 상수 import 단언에서 났고, import·구문 오류가 아니다(일부는 아직 없는 필드를 읽는 TypeError 로 계획한 단언과 같은 뜻의 실패). 통과 71 은 보존 시험(좌석·점 수·오프닝 큐·소리 시각 등). 기계 분류기(`check tdd-red-evidence`)는 돌리지 않았고 tap-flat 출력과 의미 검사로 대신했다.
- Task 2: `test(21-12)` `7012f09f` — **not ok 21 / ok 191**(client 튜토리얼 시험 8파일 + 정적 가드). 처음 돌렸을 때는 Task 1 이 없앤 내보내기를 부르던 화면 모듈이 읽히지 않아 121건이 "모듈이 있어야 한다" 로 실패해 RED 로 셀 수 없었다 → 그 자리만 고친 `fix(21-12)` `893a6628` 을 먼저 넣고 다시 돌린 21건만이 RED 다(진행 1/3·단서 카드·보드 선 하나·정체 카드 문구·직업 카드 줄·마무리/기다림 글·오프닝 집 창·장면 4 허용 목록 등 단언 실패, 모듈 없음 0건).

## Task Commits

1. Task 1 RED `61e59e5d` test(21-12): 첫 사건 새 흐름 대본 실패 시험
2. Task 1 GREEN `1c862a88` feat(21-12): 첫 사건 대본을 새 흐름으로
3. (맞춤) `893a6628` fix(21-12): 화면이 새 대본 내보내기를 읽도록 임시 맞춤
4. Task 2 RED `7012f09f` test(21-12): 첫 사건 새 흐름 화면 실패 시험
5. Task 2 GREEN `d225a56d` feat(21-12): 첫 사건 새 흐름 화면과 정체 비공개 카드

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - 막는 것 해소] Task 1 GREEN 커밋 시점에는 `npm run typecheck` 가 초록이 아니었다.** 대본이 없앤 내보내기(`tutorialSuspectWalk`·`tutorialSuspectStand`·`TUTORIAL_CAST.witness`·`.trace`·`TUTORIAL_PICK.reveal.sfx`)를 화면이 아직 부르고 있어서 `src/screens/TutorialScreen.tsx`·`TutorialEvidence.tsx` 가 tsc 에서 걸렸다. 계획의 Task 1 verify 는 typecheck 를 요구하지만 화면을 고치는 일이 Task 2 라, 대본 단위 시험(117건)만 초록으로 두고 커밋했다. 이어서 `fix(21-12)` 로 화면이 읽히게 한 줄씩만 맞췄고(이 때문에 Task 2 RED 가 유효해졌다), Task 2 GREEN 에서 `npm run typecheck` 가 exit 0 이 됐다. **Files:** src/screens/TutorialScreen.tsx, src/components/v2/TutorialEvidence.tsx. **Commits:** `1c862a88`·`893a6628`·`d225a56d`.

**2. [Rule 1 - 버그] RED 시험의 한 단언이 틀렸다.** tutorialGate 의 "[켜기] 뒤 장면 4 에서도 같은 층이 차단" 이 장면 4 에 없는 `[data-errand-layer]` 를 inert 로 기대했다(장면 4 는 현장 지점 층 `[data-clue-layer]` 가 막힌다). GREEN 커밋에서 목록을 바로잡았다. **Files:** test/client/tutorialGate.test.tsx. **Commit:** `d225a56d`.

**3. [Rule 2 - 빠진 필수] 허용 목록에 현장 지점 층을 더했다.** 장면 4 가 실제 ClueSpot 층(`data-clue-layer`)을 그리므로 튜토리얼이 정해진 한 길로만 눌리게 `ALWAYS_BLOCKED` 에 `[data-clue-layer]` 를, [살펴보기] 층(`[data-errand-act-layer]`)은 장면 3 뿐 아니라 4 에서도 열도록 고쳤다(T-10). **Files:** src/screens/TutorialScreen.tsx. **Commit:** `d225a56d`.

**4. [Rule 3 - 막는 것 해소] 계획의 files_modified 밖 파일을 고쳤다.** (a) `test/helpers/fakeTutorialStage.ts` — 심부름 타일·[켜기]·지점 표지·[살펴보기]를 실제 부품(ErrandMarker·ErrandAct·ClueSpot)으로 그리게 바꿨다(공유 도우미라 tutorialScreen.test 의 인라인 가짜 무대는 이것으로 대체). (b) `test/client/tutorialGate·Opening·Entry·Wait.test.tsx` — 바뀐 문구·장면 4 허용 목록·집 창 시험. (c) `src/styles/phase.css` 머리 주석의 진홍 예약 문구. (d) E2E 사본 상수(`scripts/e2e/lib.mjs`·`lib.test.mjs`·`tutorial.mjs`·`browser.mjs`)와 `test/unit/e2eContract.test.ts` — `e2eContract` 가 앱 대본과 E2E 사본의 일치를 고정하므로 등불 목표 `lamp2`·오답 문구·직업 카드 줄 사본만 맞췄다. **E2E 흐름 자체(장면 4 눈 표시·장면 5 선 둘·정체 공개 검사 등)는 아직 옛 흐름을 가정하며 21-15 가 새 흐름으로 다시 쓴다.**

**Total deviations:** 4 (맞춤 1, 시험 오류 1, 허용 목록 1, 범위 밖 파일 1 — 서버·와이어 변화 없음).

## 검증 결과

- Task 1 verify: `npx vitest run test/unit/tutorialScript.test.ts test/unit/tutorialStaticGuard.test.ts test/unit/tutorial.test.ts` — **3 files, 117 passed**.
- Task 2 verify 묶음: `npx vitest run test/client/tutorialScenes test/client/tutorialScreen test/client/tutorialGate test/client/tutorialOpening test/client/tutorialEntry test/client/tutorialWait test/client/tutorialTogether test/client/tutorialHostBand test/unit/tutorialStaticGuard test/unit/tutorialScript` — **tap-flat not ok 0 / ok 278**.
- `npx vitest run --project client` — **99 files passed, 3252 tests passed | 77 skipped**.
- `npx vitest run --project unit` — **154 files passed | 1 skipped, 5123 tests passed | 107 skipped**(`e2eContract` 101 건 포함).
- `node --test scripts/e2e/lib.test.mjs` — 465 pass / 0 fail.
- `npm run typecheck`(tokens:check·placeart:check·wrangler types·tsc 앱·worker) — **exit 0**.
- worker 시험은 돌리지 않았다 — 이 계획은 클라이언트·대본 전용이고 와이어·서버가 바뀌지 않았다(알려진 간헐 5000ms 타임아웃 때문에 `--project worker` 전체도 돌리지 않음).
- acceptance grep: `tutorial.hidden` 3 · `"town"` 1 · `TOWN_CLUE_SPOTS` 3 · `등불을 켜 보세요` 1 · `정체는 판이 끝나야 알아요`(Reveal 1·대본 2) · `SuspectBoard`(TutorialScreen 1·TutorialEvidence 1, 모두 주석) · `단서로 거짓말을 잡아요` 1.
- 위생: 바뀐 파일 diff 에 hex 리터럴·innerHTML·"참가자" 없음, CR 0, CSS 는 토큰 변수만.
- **실제 브라우저·실기기 확인은 하지 않았다.** jsdom 시험은 위치 투영·3D 창 불·개관 시점의 시각을 재지 않는다 — 폰 6종 겹침과 두 진입로 완주는 21-15(E2E)·v3.0 끝 실테스트 몫.

## 알려진 한계·미결

- **UI-SPEC 와 계획의 한 줄이 어긋난다(경찰 카드).** UI-SPEC 표는 경찰을 "밤에 한 명이 마피아인지 알아봐요(그대로)" 라고 적었지만 코드의 현재 경찰 줄(ROLE_TEXT.police.desc)은 "의심되는 사람을 조사하세요." 다. 계획이 "경찰 그대로" 라 코드의 현재 글을 유지했다. 바꾸려면 TutorialRoleCards 의 한 줄과 E2E 사본(`TUTORIAL_ROLE_LINES_E2E`)만 고치면 된다.
- **장면 3 의 표지는 셋이다**(계획 must_haves 의 "가로등 표지 1개"는 진행 점 3 과 같이 쓰려면 배정 3곳이 필요해 셋으로 했고, 반경 안은 lamp2 하나라 [켜기]·포커스 상자는 하나다). 한 개만 그리고 싶으면 GameMap 의 errandCenters 를 튜토리얼 전용으로 거르는 변경이 필요하다.
- 개관 장면의 시안 대조(카메라 `overview` 에서 출연 여섯 좌석의 크기·집 창 8의 켜짐)는 jsdom 으로 못 본다. 출연 좌석은 광장 가운데 둘레(반지름 약 2.6)라 개관에서 작을 수 있다.
- 장면 4 의 가짜 view 에 `day.lamps`(피해자 집만 꺼짐)를 두었다 — 아침 3D 창이 실제 판처럼 보이게 하려는 것이고 화면 부품이 읽는 값은 아니다.

## Known Stubs

없음.

## Threat Flags

없음 — 새 엔드포인트·메시지·서버 상태 없음. 위협 대응: T-21-42(tutorialStaticGuard 정적 가드 전 파일 0 위반 + 새 가드 3건 — 대본이 mapTown 상수만 읽고 worker·useRoomConnection 을 가져오지 않음, 정체 카드 코드에 직업 이름·roleArtSrc·ROLE_TEXT 없음; tutorialScreen 의 fetch·WebSocket 스파이 0 건과 connection.calls 0 은 한 바퀴 완주 시험이 그대로 지킨다), T-21-43(함께 진행은 끝났음 메시지 하나 — tutorialTogether 시험 그대로 초록).

## Self-Check: PASSED

- 파일 존재: src/game/tutorialScript.ts · src/screens/TutorialScreen.tsx · src/components/v2/TutorialReveal.tsx · src/components/v2/TutorialEvidence.tsx · test/unit/tutorialScript.test.ts · test/client/tutorialScenes.test.tsx — 모두 있음.
- 커밋 다섯(61e59e5d·1c862a88·893a6628·7012f09f·d225a56d) 모두 HEAD 의 조상.
