---
phase: 18-quick-fixes
plan: "08"
subsystem: e2e-tutorial
tags: [e2e, tutorial, spotlight, next-pill, scene5-lines, spots, tdd, sc-3, sc-5]
status: complete

requires:
  - phase: 18-quick-fixes
    provides: 18-03 panelless·고정 카메라, 18-06 스포트라이트·[다음] 알약·직업 문구·선 clamp, 18-04·18-11 (조명·E2E 기반)
provides:
  - E2E 순수 판정 다섯 묶음 tutorialLineChecks(EV6~EV8)·tutorialDimChecks(TD1~TD3)·tutorialNextChecks(TN3·TN4)·tutorialHiddenChecks(TH1)·tutorialRoleLineChecks(TC5)와 TUTORIAL_LINE_INSET·TUTORIAL_ROLE_LINES_E2E
  - readTutorial 읽기 필드 evidence.lines·evidence.suspectTag·dim·nextLabel·errandDots·hidden·roleLines
  - 측정으로 정한 도윤 장면 자리 TUTORIAL_SPOTS[1] = (1.3, -1.5)
  - 로컬 tutorial solo 폰 6종·together 전부 통과(참고 줄 밖 실패 0)
affects: [18-10]

actuals:
  tokens: 8500
  tasks: 3
  commits: 6

plan_head_before: 413e83e60ddf53d0390091aa8d1f9f70fa259796
plan_head_after: cb7d5ff1d801760d8ef35287d71a89f33f256cf8
commits: 6

tech-stack:
  added: []
  patterns:
    - "mask 안의 rect 는 getBoundingClientRect 가 0 이라 구멍 사각형은 속성(x·y·width·height) + svg 화면 원점으로 읽는다"
    - "TD 줄은 기존 진행 점 판정(TD1·TD2)과 id 가 겹쳐 `<장면>/dim` 시나리오에 따로 쌓는다"

key-files:
  created: []
  modified:
    - scripts/e2e/lib.mjs
    - scripts/e2e/lib.test.mjs
    - scripts/e2e/browser.mjs
    - scripts/e2e/tutorial.mjs
    - test/unit/e2eContract.test.ts
    - src/game/tutorialScript.ts
    - test/unit/tutorialScript.test.ts

key-decisions:
  - "도윤 자리 TUTORIAL_SPOTS[1] = (1.3, -1.5): 후보 순서 A→B→C 중 B 는 연단에 걸려 걸을 수 없는 칸이라 건너뛰고 C 가 처음 통과"
  - "고정 카메라 target 은 그대로(0, 0) — 도윤 자리만으로 폰 5종이 통과해 z 를 옮기지 않았다"
  - ".tut-dim z 값은 그대로 — 390x844 스크린샷에서 띠·[건너뛰기]·진행 점은 밝고 머리 제목·맵은 어둡게 보였다(RESEARCH 가정 A1 확인)"

requirements-completed: [SC-3, SC-5]

coverage:
  - id: D1
    description: "장면 5 선 두 개의 끝과 도윤 이름표가 폰 5종 화면 안쪽 8 안이고 증거 카드·띠·수식 줄·[다음] 과 교차 0(360x560 참고 행)"
    requirement: "SC-3"
    verification:
      - kind: unit
        ref: "scripts/e2e/lib.test.mjs#tutorialLineChecks EV6~EV8"
        status: pass
      - kind: e2e
        ref: "npm run e2e -- --url http://localhost:5173 --only tutorial-solo (EV6~EV8, 폰 6종)"
        status: pass
    human_judgment: false
  - id: D2
    description: "스포트라이트 막 개수·구멍이 상자를 덮음·흐림 없음, [다음] 알약 폭·높이·가운데·글·진행 점 교차 0, 장면 2~6 숨김, 직업 카드 한 줄 = ROLE_TEXT"
    requirement: "SC-3"
    verification:
      - kind: unit
        ref: "scripts/e2e/lib.test.mjs#tutorialDimChecks TD1~TD3 / tutorialNextChecks TN3·TN4 / tutorialHiddenChecks TH1 / tutorialRoleLineChecks TC5"
        status: pass
      - kind: unit
        ref: "test/unit/e2eContract.test.ts#TUTORIAL_ROLE_LINES_E2E 가 ROLE_TEXT 의 시민·마피아·의사·경찰 desc 와 같다 (18-08)"
        status: pass
      - kind: e2e
        ref: "npm run e2e -- --url http://localhost:5173 --only tutorial (solo 폰 6종·together)"
        status: pass
    human_judgment: false
  - id: D3
    description: "TT1(허용 밖 터치)이 머리 영역 가운데를 눌러 반응 없음을 본다, tutorial-together 통과"
    requirement: "SC-5"
    verification:
      - kind: e2e
        ref: "tutorial-solo/scene3 TT1·TT2, tutorial-together 30/30"
        status: pass
    human_judgment: false
  - id: D4
    description: "스포트라이트가 실제 화면에서 밝은 띠·[건너뛰기]·진행 점 위로 올라오고 머리 제목·맵만 어둡게 보인다"
    requirement: "SC-3"
    verification: []
    human_judgment: true
    rationale: "390x844 스크린샷 한 장을 눈으로 확인했다(아래). 다른 폭의 시각 검토와 실기기는 v3.0 끝으로 몰아서 한다(사용자 결정)"
---

# Phase 18 Plan 08: 튜토리얼 폰 6종 E2E 판정과 도윤 자리 측정 Summary

**장면 5 선·도윤 이름표, 스포트라이트 막, [다음] 알약, 숨김, 직업 문구를 폰 6종 실제 브라우저 판정(EV6~EV8·TD1~TD3·TN3·TN4·TH1·TC5)으로 확인하고, 도윤 자리를 (1.3, -1.5) 로 측정해 정했다.**

## 수행한 일

- **Task 1 (트레이서)**: 읽기(선 `data-from·data-to`·도윤 이름표 사각형) → 순수 판정 `tutorialLineChecks` → tutorial-solo 폰 6종 실행. 처음 값 (1.3, -2.3) 은 폰 4종에서 EV7 실패(이름표 오른쪽이 안쪽 8 밖). 참고 측정 행 `EVm` 을 흐름에 남겨 이름표·선 끝 좌표가 결과 표에 보인다.
- **Task 2 (도윤 자리)**: 후보 순서대로 측정해 (1.3, -1.5) 로 정했다. 시험에 "다른 좌석과 1.2 이상" 을 더했다.
- **Task 3**: 판정 네 묶음과 사본 상수, 읽기 필드, 장면 2~7 기록, TT1 머리 영역 터치. 스크린샷 확인.

## 도윤 자리 측정 (Task 1·2)

기준: 폰 5종(360x560 제외)의 EV6~EV8 이 모두 통과. 이름표 사각형은 `left,top w x h`, 폭은 어느 크기에서나 100x27.

| 후보 | 360x640 | 390x844 | 430x932 | 결과 |
|---|---|---|---|---|
| 처음 (1.3, -2.3) | (278,333) 오른쪽 378 > 352 EV7 실패 | (293,435) 오른쪽 393 > 382 EV7 실패 | 통과 | 실패 (402x874·390x664 도 EV7 실패) |
| A (1.1, -1.9) | (253,337) 오른쪽 353 > 352, 1px 모자람 EV7 실패 | 통과 | 통과 | 실패 |
| B (0.9, -1.5) | 통과 | 통과 | 통과 | 연단에 걸려 걸을 수 없는 칸(`tutorialScript.test` 걸을 수 있는 칸 시험 실패) → 쓸 수 없음 |
| C (1.3, -1.5) | (245,352) 오른쪽 345, 통과 | (260,454) 통과 | (280,498) 통과 | 채택 |

C 로 폰 6종을 한 번 돈 결과(EV6~EV8 전부 통과, EV8 의 360x560 만 참고 행):

| 크기 | 이름표 | 선 1 시작→끝 | 선 2 시작→끝 | EV6 / EV7 / EV8 |
|---|---|---|---|---|
| 360x640 | (245,352) | (55,225)→(275,350) | (143,285)→(315,350) | 통과 / 통과 / 통과 |
| 390x664 | (260,364) | (70,225)→(290,362) | (158,285)→(330,362) | 통과 / 통과 / 통과 |
| 390x844 | (260,454) | (70,225)→(290,452) | (158,285)→(330,452) | 통과 / 통과 / 통과 |
| 402x874 | (266,469) | (76,225)→(296,467) | (164,285)→(336,467) | 통과 / 통과 / 통과 |
| 430x932 | (280,498) | (90,225)→(310,496) | (178,285)→(350,496) | 통과 / 통과 / 통과 |
| 360x560 (참고 행) | (245,311) | (55,225)→(275,309) | (143,285)→(315,309) | 통과 / 통과 / 증거 카드(16,190 328x130) 와 겹침 — 알려진 한계 참고 줄 |

- C 의 다른 좌석 간격: 도윤은 4번(2.6, 0)과 약 1.98, 2번(-1.3, -2.3)과 약 3.2 떨어져 이름표가 겹치지 않는다.
- 고정 카메라 target 은 옮기지 않았다(도윤 자리만으로 통과). 후보 C 로 바뀌어도 장면 6 이름표 넷(TF 줄)·장면 7(TC 줄)은 기존 판정 그대로 통과했다.
- 근거 이동 방향: 도윤이 카메라 쪽(z 가 큼)으로 오면 화면에서 왼쪽으로 온다. 연단(반지름 약 1.75) 안쪽은 걸을 수 없어 x 를 줄이는 쪽(B)은 막혔다.

## E2E 결과 (로컬 `npm run e2e -- --url http://localhost:5173 --only tutorial --shots`)

| 흐름 | 크기 | 통과/전체 |
|---|---|---|
| tutorial-solo | 360x640 | 219/219 |
| tutorial-solo | 390x664 | 217/217 |
| tutorial-solo | 360x560 | 219/219 |
| tutorial-solo | 390x844 | 218/218 |
| tutorial-solo | 402x874 | 217/217 |
| tutorial-solo | 430x932 | 217/217 |
| tutorial-together | 390x844 | 30/30 |

실패 0. 새 판정(스포트라이트 장면 2·3·4·6 켜짐 1개·장면 2·4·5·6 정체·7 꺼짐 0개, 흐림 없음, 장면 2~6 숨김, [다음] 폭·높이·가운데·글, 장면 4 진행 점 숨김, 직업 카드 한 줄 넷)가 폰 6종에서 모두 통과했다. 소켓 프레임 0건(TS 줄 기존 판정)도 그대로 통과. 360x560 의 EV8 한 줄만 참고 줄로 남는다(계약대로).

`--shots` 는 tutorial 흐름이 사진을 저장하지 않아 파일이 생기지 않았다. 대신 같은 로컬 서버에서 390x844 장면 2 를 따로 찍어 확인했다.

- **스크린샷 확인 한 줄 (390x844 장면 2 띠 포커스 구간)**: 사회자 띠·진홍 포커스 테두리·[건너뛰기]·진행 점은 밝게, 머리 제목 "아침"과 맵은 어둡게 보인다. 띠가 어두워지거나 머리가 안 어두워지는 어긋남이 없어 `.tut-dim` z 값은 바꾸지 않았다. [다음] 이 나타난 구간(사진 두 번째)은 막이 사라져 맵이 밝다.

## TDD 증거 (RED)

`gsd_run check tdd-red-evidence` 결과 세 번 모두 `RED_EVIDENCE_OK`(`target_test_failed`).

- Task 1 RED (`dff87b0f`) — `node --test --test-reporter=tap scripts/e2e/lib.test.mjs`: 415개 중 `tutorialLineChecks EV6~EV8` 한 개 실패(자리 함수가 빈 배열을 돌려줘 `deepEqual([], [EV6,EV7,EV8])` 단언 실패). 의미 점검: 대상 시험이 실행되어 계획한 단언에서 실패했다. import·구문·fixture 오류 아님.
- Task 3 RED (`27138a9a`) — 같은 명령: 새 시험 네 개(`tutorialDimChecks`·`tutorialNextChecks`·`tutorialHiddenChecks`·`tutorialRoleLineChecks`) 가 단언 실패(자리 함수 빈 배열·사본 상수 빈 배열). `npx vitest run test/unit/e2eContract.test.ts --reporter=tap-flat`: `TUTORIAL_ROLE_LINES_E2E 가 ROLE_TEXT ... (18-08)` 한 개 실패(`expected '' to be '대화와 투표로 ...'`). 의미 점검: 둘 다 대상 시험이 계획한 단언에서 실패했다.

GREEN: `d305655e`(Task 1), `cb7d5ff1`(Task 3). 도윤 자리 조정(`da57d230`)과 참고 측정 행(`0f5386d9`)은 측정 작업이라 TDD 대상이 아니다. `node --test scripts/e2e/lib.test.mjs` 419 통과, `npm run typecheck` 오류 0, `npm test` 8012 통과·261 건너뜀.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - 차단] 후보 B 가 걸을 수 없는 칸**
- **Found during:** Task 2
- **Issue:** 계획의 후보 B (0.9, -1.5) 는 E2E 로는 통과했지만 연단에 걸려 `tutorialScript.test` 의 "모든 snap 자리는 걸을 수 있는 곳" 시험이 실패한다(연단 반지름 약 1.75 안).
- **Fix:** 계획 순서대로 다음 후보 C (1.3, -1.5) 를 측정해 통과해 채택(걸을 수 있는 칸 시험 통과).
- **Files modified:** src/game/tutorialScript.ts
- **Commit:** da57d230

**2. [Rule 1 - 버그] 스포트라이트 구멍을 getBoundingClientRect 로 읽으면 0**
- **Found during:** Task 3 첫 실행(TD2 36건 실패)
- **Issue:** `<mask>` 안의 rect 는 그려지는 상자가 없어 BCR 이 (0,0 0x0) 이다 — 읽기 쪽 버그였고 앱은 정상이었다.
- **Fix:** browser.mjs 가 구멍을 `x·y·width·height` 속성 + svg 의 화면 원점으로 읽는다. TD2 실패 문구에 구멍 사각형을 같이 싣는다.
- **Files modified:** scripts/e2e/browser.mjs, scripts/e2e/lib.mjs
- **Commit:** cb7d5ff1

**3. [Rule 2 - 일관성] TD 줄 id 가 기존 진행 점 판정과 겹침**
- **Found during:** Task 3
- **Issue:** 기존 `tutorialDotChecks` 가 `TD1`·`TD2` 를 쓴다. 같은 시나리오에 쌓으면 결과 표에서 구분이 안 된다.
- **Fix:** 스포트라이트 줄은 id(TD1~TD3)를 그대로 두고 시나리오를 `<장면>/dim` 으로 분리했다.
- **Files modified:** scripts/e2e/tutorial.mjs
- **Commit:** cb7d5ff1

**4. 추가: 참고 측정 행 `EVm`** — 계획의 "크기별 도윤 사각형·선 끝 좌표를 SUMMARY 표에" 를 위해 흐름에 통과 줄(info)로 남겼다(`0f5386d9`). 판정 아님.

**Total deviations:** 3 auto-fixed + 1 추가 참고 행. **Impact:** 판정 문턱은 하나도 바꾸지 않았다. 앱 코드 변경은 도윤 자리 한 줄뿐이다.

## Issues Encountered

- 후보 측정 중 자동화 스크립트의 잘못된 인수로 `tutorialScript.ts` 한 줄이 깨졌고 개발 서버가 구문 오류를 냈다(zsh 가 따옴표 없는 변수를 쪼개지 않음). 즉시 복구했고 커밋에는 영향이 없다.
- `tutorial.css` 의 `.tut-dim` z 값은 고치지 않았다(위 스크린샷 확인).

## Known Stubs

None.

## 남은 문제 · 다음 계획에 넘길 것

- 360x560 의 EV8(도윤 이름표 ↔ 증거 카드 겹침)은 계약상 참고 행이라 "알려진 한계" 로 남는다. 그 밖의 폰 5종은 전부 통과.
- 18-10: 배포본(`minifia-v3`) 에서 `tutorial` solo·together 를 한 번 더 돌려 확인한다. 로컬 개발 서버는 이 계획이 띄웠고 끝에 껐다.
- 360x560·360x640 의 직업 카드 아래 줄과 [다음] 예약(TC4)은 17-08 알려진 한계 그대로 참고 줄(이번 실행에서 실패 줄 없음).

## Threat Flags

None — 새 네트워크·인증·파일 접근 경로 없음. T-18-18(결과 줄에 크기·장면·id·사각형·고정 문구만, 닉네임·토큰 없음)·T-18-19(소켓 프레임 0건 기존 판정 통과)·T-18-20(TUTORIAL_SPOTS[1] 하나만 변경, 걸을 수 있는 칸·간격 시험·폰 6종 전 장면 판정 통과)·T-18-SC(패키지 설치 0) 확인.

## Self-Check: PASSED

- 수정 파일 7개 존재, 커밋 6개(dff87b0f, d305655e, 0f5386d9, da57d230, 27138a9a, cb7d5ff1) HEAD 의 조상.
- 인수 기준: `export function tutorialLineChecks` 1, tutorial.mjs `tutorialLineChecks(` 1, browser `suspectTag` 1, `export function tutorialDimChecks` 1, e2eContract `TUTORIAL_ROLE_LINES_E2E` 2, browser `data-tutorial-dim` 1, tutorial.mjs `tutorialDimChecks(` 2. 전체 검증: `npm run typecheck`·`npm test` 통과, 로컬 `--only tutorial` 실패 0, 위생 git grep 은 이 계획 파일 0건(기존 계획 문서의 일반 용례만).
