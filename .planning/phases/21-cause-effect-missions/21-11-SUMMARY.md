---
phase: 21-cause-effect-missions
plan: "11"
subsystem: client-discussion-suspect-board
tags: [cause-effect, discussion, suspect-board, tdd]
status: complete

requires:
  - phase: 21-cause-effect-missions
    provides: "21-04 의 me.scene(ClueLine)·day.lamps, 21-05 의 토론 모이기(서버)·공개 흔적 폐지, 21-08 의 hostLine discussion.board 갈래, 21-10 의 sceneText·ClueSpot SPOT_ICON·단서 카드 글 표"
provides:
  - "src/game/boardView.ts: boardOf(view)(칩·등불 줄·산 사람 얼굴 줄과 닮은 옷 표시·목격 칸) — 역할을 읽지 않는 순수 파생"
  - "src/components/v2/SuspectBoard.tsx: 의심 보드 카드(role=region·aria-label 의심 보드, data-board·-chips·-lamps·-face·-record-rows) — props 만 받아 튜토리얼이 가짜 view 로 같은 부품을 쓴다"
  - "v2.css .mv-board 규칙(.mv-record 껍데기 위에 안쪽만 더함, 토큰 변수만)"
  - "GameMap: 원인 흐름 토론에서 [보드](lens) 가 [기록] 자리를 이어받고 보드가 열린 채 시작, 입력칸 포커스·[닫기]·토론 이탈에서 접힘, 확장판의 [기록]·RecordCard 단독·EvidenceCard 없음"
affects: [21-12, 21-13]

requirements-completed: [BOARD-01]

estimate:
  tokens: 85000
  tasks: 3

actuals:
  tokens: 9400
  tasks: 3
  commits: 6

plan_head_before: 9d287375bd579ea6e2497123a9df9e85ac25933c
plan_head_after: 79833191a0912bf31bbb35f31105f008a2819685
commits: 6

tech-stack:
  added: []
  patterns:
    - "보드는 RecordCard 의 껍데기(.mv-record 면·자리 .mf-game__record·--mf-record-bottom)를 그대로 쓰고 안쪽(.mv-board__*)만 더한다 — 새 영역 배치 코드 없음"
    - "열림 상태: 기록 카드는 '연 키'(기본 접힘), 보드는 '접은 키'(기본 열림)를 쥔다. 둘 다 단계·일차 키(recordKey)에 묶여 키가 바뀌면 처음 상태로 돌아가고, 토론을 벗어나면 접은 키도 지운다"

key-files:
  created:
    - src/game/boardView.ts
    - src/components/v2/SuspectBoard.tsx
    - test/unit/boardView.test.ts
    - test/client/suspectBoard.test.tsx
    - test/client/boardDiscussion.test.tsx
  modified:
    - src/screens/GameMap.tsx
    - src/styles/v2.css

key-decisions:
  - "새 와이어 형식 없음 — me.scene·me.record·day.lamps·players[] 는 모두 21-04·21-05 가 이미 만든 값이라 test/worker/causeLeak.test.ts 의 ALLOWED_NEW/SERVER_ONLY_NAMES 는 그대로다"
  - "닮은 옷 표시는 BoardFace.marks 배열(옷 조각·창문 각각 { kind, piece })이다 — UI-SPEC 의 '창문 조각이 있으면 같은 규칙으로 두 번째 조각 기준' 을 한 사람이 두 조각과 모두 같은 옷일 때도 잃지 않으려고. data-mark 는 'cloth' | 'window' | 'cloth window'"
  - "boardOf 는 판 규칙(cause)을 확인하지 않는다(튜토리얼 가짜 view 에서도 같은 함수). 보드를 그릴지는 GameMap 이 rulesetOf(modeOf(view)).cause 로 정한다"
  - "보드는 원인 흐름 산 사람이면 me.record 가 없어도 있다(칩·등불·얼굴 줄은 늘 있다). 목격 칸만 me.record 가 있고 줄이 1 이상일 때 나온다"

metrics:
  duration: 약 35분
  completed: 2026-11-15
---

# Phase 21 Plan 11: 의심 보드 Summary

확장판(원인 흐름) 토론이 열린 의심 보드로 시작한다: 내가 받은 단서 칩 → 꺼진 등불 8점 → 산 사람 얼굴 4열(옷 조각·창문 조각과 같은 옷의 얼굴에 금빛 2px + thread 배지, 보기 전용) → 접힌 목격 칸(누르면 기존 기록 줄). 헤더 [보드]가 [기록] 자리를 이어받고, 입력칸 포커스·[닫기]·투표 단계에서 접힌다. 처형된 사람의 직업·남의 단서·역할은 보드 어디에도 없고, 기본판·옛 확장판 토론은 [기록]·RecordCard 그대로다.

## Accomplishments

- **Task 1 (boardOf):** `me.scene` 의 clue·touched·dark 줄만 칩(none 은 칩 없음), `day.lamps` 가 있으면 8점과 꺼진 수, 산 사람 전원(좌석 오름차순, 유령 없음)의 얼굴과 `sameOutfitSeats(players, 조각)` 로 얻은 닮은 옷 표시, `recordRowsOf(view)` 의 목격 줄. 얼굴 항목의 키는 seat·nickname·marks 뿐이다.
- **Task 2 (SuspectBoard):** `.mv-record` 껍데기 + 머리줄(lens 20·"내가 아는 것"·[닫기] 44) + 칩 줄(높이 32, 받은 단서 light-lamp 실선 / 손댄 흔적·어두움 gray-500 점선) + 등불 줄(지름 14·간격 8, `role=img` `aria-label="꺼진 등불 n개"`) + 얼굴 4열(칸 높이 56·얼굴 30·Label 14 한 줄 keep-all) + 접힌 목격 칸(eye + 줄 수 + chevronRight, 누르면 `data-board-record-rows` 와 기존 기록 줄 마크업). 서버 훅·역할 없음, 닉네임은 텍스트 노드뿐.
- **Task 3 (GameMap 연결):** 원인 흐름 discussion 의 산 사람에게 `boardOf(view)` 로 모델을 만들고 헤더에 `<ToolButton name="보드" icon=lens>`(빛나지 않음), 열림은 "접은 키" 방식이라 토론에 들어오면 열린 채 시작한다. 포커스·[닫기]·[보드] 토글·`--mf-record-bottom` 측정은 기록 카드와 같은 길(`panelOpen`)을 쓴다. 원인 흐름에서는 `traceKey`·`tracePiece` 를 막아 EvidenceCard·흔적 구간·이름표 증거 표시를 그리지 않는다(P21-15).

## TDD 증거 (RED 3줄)

- Task 1: `test(21-11)` `edc8a710` — `--reporter=tap-flat` **not ok 8 / ok 5**(자리표시자가 빈 모델을 돌려줘 아직 없어도 통과하는 보존 시험 다섯: 칩 0·lamps 없음·조각 없는 칩·두 역할 같은 결과·직업 값 없음). 의미 확인: 실패 8건 모두 계획한 단언(칩 목록·등불 수·얼굴 목록·닮은 옷 표시·witness 줄·소스의 sameOutfitSeats)에서 실패, import·구문 오류 아님. 기계 분류기(`check tdd-red-evidence`)는 돌리지 않았고 tap-flat 출력과 의미 검사로 대신했다.
- Task 2: `test(21-11)` `6f32c248` — **not ok 10 / ok 2**(ok 2 는 빈 부품이라 없어도 통과하는 '등불 줄 없음'·'목격 칸 없음' 시험). 모두 단언 실패.
- Task 3: `test(21-11)` `2f17bf69` — **not ok 9 / ok 2**(ok 2 는 기본판·옛 확장판 보존 시험). 첫 렌더 단언은 `expected null not to be null`(보드 없음), 증거 카드는 `expected <div> to be null`(지금은 그려짐) 로 의도한 이유로 실패.

## Task Commits

1. Task 1 RED `edc8a710` test(21-11): 의심 보드 파생 실패 시험
2. Task 1 GREEN `42fba227` feat(21-11): 의심 보드 파생
3. Task 2 RED `6f32c248` test(21-11): 의심 보드 부품 실패 시험
4. Task 2 GREEN `2b10bb26` feat(21-11): 의심 보드 부품
5. Task 3 RED `2f17bf69` test(21-11): 토론 보드 연결 실패 시험
6. Task 3 GREEN `79833191` feat(21-11): 토론 의심 보드 연결

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - 막는 것 해소] 보드 CSS 의 자리를 파일 끝에서 심부름 블록 앞으로.** 처음에는 `.mv-board` 규칙을 v2.css 끝에 붙였더니 기존 시험이 깨졌다: `errandParts.test`(첫 `.mv-errand` 부터 파일 끝까지를 보고 light-lamp 는 mv-errand-* 규칙에만 허용)와 `v2parts.test`(8페이즈 부품 밖에서 `--brass-` 금지). 시험을 약하게 하지 않고 CSS 를 옮겼다: 보드 블록을 21-10 의 [건너뛰기] 규칙 뒤·심부름 블록 앞에 두고, 얼굴의 "금빛" 은 놋쇠 대신 `--light-lamp` 로 했다. `.mv-board .mv-board__rows` 는 뒤에 있는 `.mv-record__rows` 에 덮이지 않게 한 단계 높은 선택자를 쓴다. 이 때문에 `suspectBoard.test` 의 "보드 규칙이 .mv-record 규칙 뒤에 있다" 순서 단언을 지웠다(순서가 아니라 hex 없음·모션 줄이기 즉시만 검사). **Files:** src/styles/v2.css, test/client/suspectBoard.test.tsx. **Commit:** `79833191`.

**2. [Rule 1 - 버그] 토론을 벗어났다 돌아오면 보드가 접힌 채였다.** 접은 키만 쥐면 같은 (단계, 일차) 키로 되돌아올 때 접힘이 남는다. 토론이 아니면 접은 키를 지우는 effect 를 더했다(시험 "다시 토론이 오면 열린 채 시작한다" 가 잡았다). **Files:** src/screens/GameMap.tsx.

**3. 자리표시자 파일 두 개를 RED 커밋에 포함.** 새 모듈을 가져오는 시험(`boardView.ts`·`SuspectBoard.tsx`)이 import 실패가 아니라 단언 실패로 RED 가 되도록 빈 값을 돌려주는 자리표시자를 RED 커밋에 함께 넣고 GREEN 에서 실제 구현으로 바꿨다(INVALID_RED 방지, 21-10 까지의 관례와 달리 import 실패를 RED 로 세지 않았다).

**Total deviations:** 3 (CSS 자리 1, 버그 1, 절차 1 — 와이어·서버 규칙 변화 없음).

## 검증 결과

- `npm run typecheck`(tokens:check·placeart:check·wrangler types·tsc 앱·worker) 통과(exit 0, `error TS` 0).
- `npx vitest run test/client` — **99 files passed, 3244 tests passed | 77 skipped**. `npx vitest run test/unit` — **154 files passed | 1 skipped, 5107 tests passed | 107 skipped**(CSS 이동 전 한 번, 이동 후 test/client 전체를 다시 돌려 초록. unit 은 CSS·GameMap 을 읽지 않아 다시 돌리지 않았다).
- Task 3 verify 묶음(boardDiscussion·suspectBoard·recordTrace·gameMap·phaseScreens) 5 files / 210 passed | 2 skipped.
- worker 시험은 돌리지 않았다 — 이 계획은 클라이언트 전용이고 와이어 형식이 바뀌지 않았다(알려진 간헐 5000ms 타임아웃 때문에 `--project worker` 전체도 돌리지 않음). `causeLeak.test.ts` 의 `ALLOWED_NEW`/`SERVER_ONLY_NAMES` 는 그대로다.
- acceptance: `export function boardOf` 1, `sameOutfitSeats` boardView 3(주석·import·호출), `.role` 읽기(주석 제외, boardView·SuspectBoard) 0, `SuspectBoard` GameMap 2, `name="보드"` GameMap 1, `data-board*` SuspectBoard 8줄, `boardDiscussion.test.tsx` 있음.
- 위생: 바뀐 파일 diff 에 hex 리터럴·innerHTML·"참가자" 없음, CSS 는 토큰 변수만, 소스 주석 밖에 "범인"·"증거"·"확정" 없음, CR 0.

## 알려진 한계 (계획이 가정으로 둔 것)

- **360×560 같은 낮은 화면에서는 보드 높이가 내용(약 232)보다 작아(보이는 높이 약 225) 카드 안 세로 스크롤이 생긴다.** 보드가 열린 채 시작하므로 이 폭에서는 아래 얼굴 한 줄·목격 칸이 스크롤 아래에 있을 수 있다. UI-SPEC 의 unresolved 항목을 가정으로 두었고 15 의 기록 카드와 같은 처리다. 실기기에서 눈으로 확인해야 하며 jsdom 시험은 높이를 재지 않는다(`.mv-board` 의 `overflow-y: auto`·`overscroll-behavior: contain` 만 CSS 로 둠).
- 얼굴 칸 폭 68 에서 8자 닉네임이 한 줄에 들어가는지(UI-SPEC long-text backstop)는 jsdom 으로 못 잰다 — 마크업은 한 줄 텍스트 노드 하나이고 CSS 는 `white-space: nowrap; overflow: hidden` 이다. 폰 6종 E2E 확인은 21-13 몫.
- 유령(탈락자)에게는 보드·[보드] 를 그리지 않는다(기존 [기록] 이 산 사람에게만 있던 것과 같다). UI-SPEC 의 "유령이 된 사람의 얼굴 칸은 기존 탈락 표현(흐림)" 은 계획 Task 1 이 "산 사람만" 으로 정해 구현하지 않았다.

## Known Stubs

없음.

## Threat Flags

없음 — 새 엔드포인트·메시지·서버 상태 없음. 위협 대응: T-21-39(boardView·SuspectBoard 소스에 `.role` 0, 네 역할 view 의 `[data-board]` outerHTML 동일 — boardDiscussion·boardView 시험), T-21-40(얼굴 키 seat·nickname·marks 뿐·결과 JSON 에 직업 문자열 없음, 렌더에 직업 이름 없음), T-21-41(닉네임은 React 텍스트 노드, 마크업 문자열 닉네임이 요소를 만들지 않음을 시험).

## Self-Check: PASSED

- 파일 존재: src/game/boardView.ts · src/components/v2/SuspectBoard.tsx · test/unit/boardView.test.ts · test/client/suspectBoard.test.tsx · test/client/boardDiscussion.test.tsx — 모두 있음.
- 커밋 여섯(edc8a710·42fba227·6f32c248·2b10bb26·2f17bf69·79833191) 모두 HEAD 의 조상.
