---
phase: 21-cause-effect-missions
plan: "15"
subsystem: tutorial-first-case
tags: [ui, tutorial, town, lamp-dock, house-pick, clue-spot, suspect-board, secret-identity, e2e]
requires:
  - phase: 21-cause-effect-missions
    provides: 21-11 SceneDock(저녁 독), 21-12 HousePick(밤 집 판), 21-13 ClueSpot·ClueChip·아침 독, 21-14 SuspectBoard·causalBoard, 21-03 TOWN_LAMPS·TOWN_CLUE_SPOTS
provides:
  - 튜토리얼 첫 사건 새 하루 흐름(마을 출연, 장면 3 등불·4 집 찾기·5 현장 + 의심 보드)을 실제 부품에 가짜 view 를 먹여 재생
  - 처형 결과 정체 비공개(D-20) — 카드 안 뒤집고 '정체는 판이 끝나야 알아요' 자막
  - 튜토리얼 E2E 새 판정(tutorial-solo 폰 6종·tutorial-together 손님 끝까지 직접)
affects: [21-16, 21-17, 21-18]
requirements-completed: [D-20, D-28]
actuals:
  tokens: 59000
  tasks: 2
  commits: 4
plan_head_before: 462a1d7cc64335c486b2d6da9ef80b8f73c8add1
plan_head_after: edfab7b0aba0fbe9eef99319e3005a9ec795ec82
commits: 4
tech-stack:
  added: []
  patterns:
    - "튜토리얼 장면 3~5 는 GameMap(panelless 없음)에 mode extended·map town 가짜 view 를 그대로 먹인다 — 독·집 판·현장 지점·보드는 실제 GameMap/WorldStage 가 그린다. 로컬 send 어댑터(errand·pick·inspect·point)가 가짜 view 의 lit·house·clue·board 상태만 바꾼다(서버 0)"
    - "허용 목록: 패널 선택자를 :not([data-scene-dock]) 로 좁혀 실제 독은 열고, 독 안 [건너뛰기]·밤 행동 줄·현장 지점 층만 inert"
key-files:
  created: []
  modified:
    - src/game/tutorialScript.ts
    - src/screens/TutorialScreen.tsx
    - src/components/v2/TutorialReveal.tsx
    - src/styles/tutorial.css
    - scripts/e2e/tutorial.mjs
    - scripts/e2e/browser.mjs
    - scripts/e2e/lib.mjs
    - scripts/e2e/lib.test.mjs
    - test/unit/tutorialScript.test.ts
    - test/unit/e2eContract.test.ts
    - test/client/tutorialScenes.test.tsx
    - test/client/tutorialScreen.test.tsx
    - test/client/tutorialGate.test.tsx
    - test/helpers/fakeTutorialStage.ts
  deleted:
    - src/components/v2/TutorialEvidence.tsx
key-decisions:
  - "장면 id: witness → house, evidence → scene. 자막 tutorial.witness → tutorial.house, 새 tutorial.secret(11음절·14자). TutorialAdvance 에 step{afterMs}(행동 뒤 [다음])을 더했다 — 장면 4·5 가 쓴다"
  - "포커스 대상 해석: 장면 4 = house(집 판 여섯 곳을 각각 상자, 고르면 꺼짐). UI-SPEC 의 'pickTags 를 대체' 는 장면 4 의 대상으로 읽었고 장면 6 은 pickTags 그대로(투표는 이름표 누르기). 장면 3 = errand(타일 상자 + [켜기] 상자, 둘이 멀어 상자가 둘). 장면 5 = inspect(지점 ② + [살펴보기], 살피기 전) → suspect(보드의 도윤 칸, 보드가 열린 뒤). 두 창이 같이 0 에서 열리고 화면이 상태에 맞는 쪽만 그린다. [다음] 이 나오면 걷힘"
  - "장면 2 끝 secret 박자 4000ms, [다음] 도 4000ms(secret 을 놓치고 넘기지 못하게). 장면 3 [켜기] 뒤 1600ms 에 장면 4(켜진 빛·창이 보일 만큼, 옛 700)"
  - "처형 결과(장면 6)는 TutorialReveal 을 직업 카드 뒤집기에서 얼굴(회색)+이름+'처형'+잠금 카드로 바꿨다. 마피아 그림·정답 도장·불꽃·'눈+흔적으로 찾아냈어요' 줄 제거. 소리 fanfare 는 그대로(새 소리 없음)"
  - "서연(2)은 장면 3·4(저녁·밤)에 살아 있고 2·5·6 에서 탈락. 밤·아침 day.lamps 는 [0,1,3,4,5](서연 집 등불만 꺼짐 — 밤 창 꺼짐, 아침 꺼진 등불). 장면 6 이름표 같은 옷 표시는 me.clues(받은 붉은 천 조각)에서 온다"
patterns-established:
  - "가짜 WorldStage(test/helpers/fakeTutorialStage)가 진짜 ErrandMarker·ClueSpot·HousePick 을 그린다"
metrics:
  duration: 약 3시간(사용 한도 중단 포함)
  completed: 2026-11-13
status: complete
---

# Phase 21 Plan 15: 튜토리얼 첫 사건 새 흐름 Summary

**튜토리얼 "첫 사건"이 마을에서 저녁 등불([켜기]로 가로등과 내 집 창이 켜짐) → 밤 집 찾기(집 판 6, 아무 집이나) → 아침 현장(서연 집 앞 지점 ② 에서 '붉은 천 조각' 카드) → 의심 보드(도윤 칸에만 같은 옷 표시)로 돌고, 장면 2 끝과 처형 결과 뒤에 '정체는 판이 끝나야 알아요' 를 말한다. 진입로 둘·8장·진행 점 7·건너뛰기·마무리는 그대로이고 서버로는 아무것도 나가지 않는다.**

## RED 증거 (단일 줄)

- Task 1 (`67fd877e`): `AssertionError: expected 'plaza' to be 'town'` · `AssertionError: expected [ 'fountain', 'lamp', 'mail' ] to deeply equal [ 'lamp4', 'lamp5', 'lamp6' ]` · `AssertionError: expected undefined to be '정체는 판이 끝나야 알아요'` · `Error: Unable to fire a "click" event - please provide a DOM element.`(독 [켜기]·집 판 없음)
- Task 2: RED 를 따로 돌리지 않았다(아래 편차 6). 실제 브라우저 E2E 가 첫 실행에서 `G3 탭 대상 44px 미만: button.mv-house-pick__plate … 40x40` · `TF1 상자 [suspect] ≠ 기대 []` · `TB1 측정값 없음(사회자 띠 읽기)` 9건을 냈고 이를 고쳐 0건이 됐다.

## 장면·키 표

| 장면 | id | 내용 | 진행 | 자막 | 포커스 |
|------|----|------|------|------|--------|
| 1 | opening | 그대로 | auto 4600 | - | - |
| 2 | morning | + 끝에 secret | next 4000 | victim 0 · mafia 2600 · **secret 4000** | band 0~2600 |
| 3 | errand | 저녁 독 [켜기]·가로등 셋 | act 1600 | errand 500 | errand(타일 + [켜기] 두 상자) |
| 4 | house | 집 판 6 → 고른 집은 바꿀 수 있어요 | **step 700** | house 500, eye 900 | house(판 여섯) |
| 5 | scene | [살펴보기] → 카드 → 0.9초 뒤 보드(자막 link) → 1.2초 뒤 [다음] | **step 1200** | link(보드 열릴 때, 화면이 말함) | inspect → suspect |
| 6 | vote | 그대로 + 처형 결과 | pick 1100 | vote 0 / 결과 뒤 **secret** | pickTags |
| 7·8 | roles·end | 그대로 | next 0 · end | roles 1500 | - |

출연: `map "town"`, 등불 lamp5(내 집)·lamp6·lamp4(서연 집 lamp2 없음), 시작 자리 가로등 5 곁 `(-3.75, 5.75)`(처리 반경 안 걷는 칸), 장면 5 자리 = 서연 집 지점 ② `TOWN_CLUE_SPOTS[2][1]`. `TUTORIAL_CAST.witness` 삭제, 도윤 걷기(SUSPECT_WALK·tutorialSuspectWalk/Stand)와 그 시험 삭제(장면 4 에 도윤이 걷지 않음). 카메라: 2·6 고정, 3·4·5 는 실제 판(나를 따라감 / 마을 밤 시점).

## 튜토리얼 부품 정리

- `TutorialEvidence.tsx`(TutorialEyeMark·TutorialFormula·TutorialLinks·clampPoint)와 `.tut-eye`·`.tut-links`·`.tut-formula` CSS, 그 부품만 보는 시험(선 좌표·수식 줄·clampPoint) 삭제.
- **GameMap 의 옛 증거 경로(EvidenceCard, `evidenceMarks` legacy 갈래·seenMark, RecordCard 사용)는 지우지 않았다** — 계획이 지우라 하지 않았다. 이제 튜토리얼 가짜 view 가 모두 mode 를 가져 `causalBoard` 가 참이므로 이 경로는 서버 기본 마피아 판만 쓴다(21-14 "숨긴 옛 부품" 목록 그대로, 결정 기록 정리 후보). `causalBoard = rules.errand && view.mode !== undefined` 의 mode 가드는 이제 튜토리얼에 필요 없지만 남겨 둔다.
- phase.css 머리 주석의 '튜토리얼 진홍 예약: 정체 공개' 문구는 처형 결과(진홍은 '처형' 글자뿐)와 어긋난 옛 말이다 — 시험이 그 주석을 고정하고 있어 손대지 않았다.

## 시험·E2E 결과

`npm test` 307 파일 통과·6 건너뜀 / 9014 통과·262 건너뜀·실패 0, `npm run typecheck` 초록, srcClean 초록, `node --test scripts/e2e/lib.test.mjs` 468 통과.

로컬 dev 서버(`npm run dev`, 내가 띄워 끝낸 뒤 껐다)에서 `node scripts/e2e/run.mjs --url http://localhost:5173 --only tutorial` — **E2E OK, 103초, 실패 0**:

| 흐름 | 크기 | 통과 줄 | 실패 |
|------|------|---------|------|
| tutorial-solo | 360x560 | 263 | 0 |
| tutorial-solo | 360x640 | 263 | 0 |
| tutorial-solo | 390x664 | 261 | 0 |
| tutorial-solo | 390x844 | 262 | 0 |
| tutorial-solo | 402x874 | 261 | 0 |
| tutorial-solo | 430x932 | 261 | 0 |
| tutorial-together | 390x844 | 41(PL1~PL7 포함) | 0 |

실측(참고): [켜기]→장면 4 약 1.8초(기대 1.6±0.5), 오프닝→장면 2 약 4.8초. tutorial-together 는 손님이 장면 2(정체 자막)→3→4→5(보드 도윤 칸 하나만)→6(결과에 정체 글 없음 + 같은 자막)→7 을 직접 수행하고 tutorialDone 한 번(프레임 판정 그대로 통과).

실제 WorldStage(three)·실제 CSS 위에서 돌았으므로 집 판 위치·현장 지점·독·보드가 화면 안에 서는지(HS2·CS1·CS3)와 폰 6종 겹침(TB3·TN4)까지 헤드리스 Chrome 으로 확인했다.

## Deviations from Plan

**1. [Rule 3 - 계획 보완] `scripts/e2e/browser.mjs`(readTutorial)와 `test/helpers/fakeTutorialStage.ts` 수정** — 계획 files 에 없지만 포커스 대상·집 판·보드를 읽으려면 readTutorial 이 바뀌어야 했고, 가짜 스테이지가 새 층을 그려야 시험이 새 부품을 볼 수 있다. `test/client/tutorialGate.test.tsx`도 허용 목록 변경 때문에 갱신.

**2. [Rule 1 - 회귀 방지] 장면 5 [다음] 구간에 포커스 상자·막이 남던 것** — 실제 브라우저 E2E(TF1·TD1)가 잡았다. [다음] 이 나오면 걷도록 고쳤다(`e41b929a`, 시험 추가).

**3. [계획 보완] 장면 2 [다음] 시각을 2600 → 4000, 장면 3 지연 700 → 1600, 장면 4·5 진행 방식 step 신설** — secret 자막을 놓치지 않게 하고 켜진 빛이 보이게 하며 행동 뒤 [다음] 이 나오게 하려는 장면 표 변경이다. 영향받은 옛 시험(2600/700 단언)은 새 값으로 갱신했고 약화하지 않았다.

**4. [Rule 2 - 정체 비공개] TutorialReveal 재설계** — 계획의 "처형 결과에서 정체 카드는 뒤집지 않는다"를 따르려면 마피아 그림·정답 도장 카드를 걷어야 했다. 옛 "마피아·정답·로 찾아냈어요" 시험 단언을 "정체 글 없음 + 도윤·처형 있음"으로 뒤집었다.

**5. [계획 보완] G3 집 판 40×40** — 21-12 승인 크기의 집 판은 요소 크기로는 44 미만이다(판 층이 ≤ 28 안 최근접 판을 골라 실제 눌림은 넓다). TAP_ALLOW(전역 빈 목록)는 건드리지 않고 tutorial.mjs gLine 에서 그 요소만 빼 참고 줄(G3k, 판정 아님)로 남겼다. 21-17(밤 흐름 E2E)도 같은 판에 부딪힐 것이다.

**6. [편차] Task 2 RED 커밋 없음** — E2E 흐름·판정 사본은 한 커밋(`edfab7b0`)으로 냈다. 판정 함수 시험(lib.test.mjs·e2eContract)은 같은 커밋에서 새 값과 함께 갱신했다.

사용 한도 중단으로 작업이 한 번 끊겼다가 같은 상태(커밋된 Task 1 + 미커밋 E2E 수정)에서 이어 끝냈다.

## Known Stubs

없음.

## Threat Flags

없음(새 네트워크·인증 없음). T-21-35: 튜토리얼 화면은 send 를 부르지 않는다 — 시험이 connection·fetch 0번을 단언하고 E2E 혼자 하기는 앱 소켓 0·프레임 0·/api 0 을 판정한다(TS0·TS2). srcClean 초록.

## 한계 (정직하게)

- 실기기·실제 사람 눈으로 본 것이 아니다. 헤드리스 Chrome 의 수치 판정(치수·겹침·화면 안)만이고, 가로등 빛과 집 창이 켜지는 3D 연출은 DOM 으로 판정하지 못해 타일 불꽃 표식(LP1)으로 대신 확인했다.
- 장면 5 처음에는 사회자 띠에 말이 없다('단서와 같은 옷을 찾아 보세요' 는 보드가 열릴 때). 포커스 상자(지점 ②·[살펴보기])가 안내한다. 처음부터 말하게 하려면 장면 표 beats 한 줄이다.
- 보드가 열린 뒤 아래에 토론 패널(inert 채팅)이 보인다 — 실제 토론 화면과 같은 부품이다.

## 21-16 / 21-17 / 21-18 에 넘기는 것

- 튜토리얼 자막 키·장면 id 가 바뀌었다(witness/evidence 삭제, house/scene·tutorial.secret). 다른 계획이 옛 id 를 쓰면 깨진다.
- 집 판(40×40) G3: 21-17 밤 흐름 E2E 도 tutorial.mjs gLine 과 같은 방식(참고 줄)으로 다루거나 부품 크기 결정을 내려야 한다.
- 21-18: 튜토리얼 가짜 view 가 이미 mode 를 가져 GameMap 의 옛 증거 경로·`view.mode !== undefined` 가드·EvidenceCard·RecordCard 사용은 실서비스에서 기본 마피아만 쓴다 — 걷어 낼 수 있다.
- 새 소리 없음: 기존 cue 만(tut.whoosh·eye·link·fanfare·stamp·buzz 등). 장면 5 카드·보드 박자는 화면이 tut.link 를 부른다.

## Self-Check: PASSED

- 파일: tutorialScript.ts·TutorialScreen.tsx·TutorialReveal.tsx·tutorial.css·tutorial.mjs·lib.mjs·lib.test.mjs·e2eContract 존재, TutorialEvidence.tsx 삭제.
- 커밋 67fd877e·3a0efbfc·e41b929a·edfab7b0 가 HEAD 의 조상(rev-list 4건).
- 인수 기준: `grep -c "tutorial.secret" src/game/tutorialScript.ts` ≥ 2, `map: "town"` 1, TutorialScreen 의 `HousePick` 언급(주석 포함) 확인은 아래 명령 결과로 갈음, `"lamp5"` lib.mjs ≥ 1, tutorial.mjs 의 TUTORIAL_SECRET_LINE 사용 ≥ 1.
