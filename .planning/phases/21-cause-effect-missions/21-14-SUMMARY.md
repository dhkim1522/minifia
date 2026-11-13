---
phase: 21-cause-effect-missions
plan: "14"
subsystem: discussion-suspect-board
tags: [ui, discussion, suspect-board, clue-chip, same-outfit, skipped-morning]
requires:
  - phase: 21-cause-effect-missions
    provides: 21-13 의 ClueChip 부품, 21-08 의 clueChipsOf·boardMarksOf·discussion.clue/act 띠, 21-04 의 me.record(토론 단계만), 21-06 의 me.clues
provides:
  - SuspectBoard(의심 보드 카드 — 칩 줄·목격 펼치기·얼굴 줄 같은 옷 배지·단서 없음·본문 스크롤 머리 고정)
  - RecordRows(RecordCard 줄 목록 부분 export, 탈락 좌석 얼굴 is-ghost 회색)
  - 확장판 토론 화면 배선(GameMap): {일차}:board 래치 자동 열림, 헤더 [의심 보드] 단추, 옛 기록 카드·증거 카드 숨김, 받은 옷 조각 기준 이름표 같은 옷 표시
  - 건너뛴 아침(밤 → 확장판 토론)의 조용한 밤 결과 알림(dayView phaseEntry discussion)
affects: [21-15, 21-16, 21-18]
requirements-completed: [D-09, D-17, D-18, D-19, D-20, D-27]
actuals:
  tokens: 12700
  tasks: 2
  commits: 4
plan_head_before: 99fda9214e95449d369f41ac65a60c68f355698f
plan_head_after: 7d2f870a95710ee265016fe41592a836d989036d
commits: 4
tech-stack:
  added: []
  patterns:
    - "보드 부품은 역할 prop 이 없고 입력은 내가 받은 값(칩 = clueChipsOf(me.clues, me.record), 배지 = boardMarksOf)과 공개 얼굴 목록뿐이다. 마피아·시민·경찰·의사 렌더의 보드 outerHTML 이 같다는 시험이 고정한다(T-21-33)"
    - "열림은 키 래치 둘: boardSeenKey(그날 자동 열림을 이미 했다)·boardOpenKey(지금 열려 있다). 닫으면 열림 키만 지운다 — 래치가 남아 같은 일차 다시 그리기로는 다시 열리지 않는다"
key-files:
  created:
    - src/components/v2/SuspectBoard.tsx
    - test/client/suspectBoard.test.tsx
  modified:
    - src/components/v2/RecordCard.tsx
    - src/screens/GameMap.tsx
    - src/game/dayView.ts
    - src/styles/v2.css
    - test/client/gameMap.test.tsx
    - test/unit/dayView.test.ts
key-decisions:
  - "자동 열림 래치 규칙: 키 `{일차}:board`. 확장판 토론의 산 사람이 단계에 진입할 때(첫 렌더 또는 키가 바뀔 때) boardSeenKey·boardOpenKey 를 한 번 세운다. 닫으면 boardOpenKey 만 null. 헤더 단추는 둘 다 갱신(다시 열기). 다음 일차는 키가 바뀌어 다시 한 번 자동으로 열린다. 모이기 move 를 기다리지 않는다(모이는 동안에도 위에 겹친다)"
  - "보드 얼굴 줄은 산 사람만, 목격 줄은 이미 탈락한 좌석 이름도 그대로 두고 얼굴만 유령 회색(is-ghost, filter brightness 0.45 + grayscale — 기존 .mf-tl__face.is-dead 와 같은 값). 새 글 없음. 정체 표시 없음(D-20)"
  - "의심 보드 카드 아래 끝은 옛 카드(입력줄 윗변 − 8)가 아니라 아래 패널 전체 윗변 − 8 이다(UI-SPEC P21-14). --mf-record-bottom 을 보드가 열려 있는 동안 panelRef 로 잰다. 채팅 입력칸에 포커스가 가면 옛 카드처럼 보드도 접힌다(헤더 단추로 다시 연다)"
  - "얼굴 칸 compact(56)는 GameMap 이 이미 아는 스테이지 높이(stageH)가 ≤ 640 인지로 정한다 — UI-SPEC 폰 6종 표의 토론 스테이지(276·356·380·560·590 → 56, 648 → 64)와 같은 경계다"
  - "확장판 판정은 causalBoard = rules.errand && view.mode !== undefined 다. 서버 view 는 mode 를 늘 싣는다. mode 가 없는 튜토리얼의 가짜 view(tutorialScript, 장면 5 가 day.evidence 증거 카드를 그린다)는 옛 증거 경로 그대로 둔다 — 그 시험을 약화하지 않고, 튜토리얼을 새 장면으로 바꾸는 일은 21-18"
  - "이름표 같은 옷 표시(확장판)는 me.clues 의 cloth·window 조각마다 sameOutfitSeats 를 합친 좌석(산 사람)이고 색은 먼저 받은 조각의 TRACE_MARK 색이다. day.evidence 가 있어도 쓰지 않고 마지막 목격자 표시(seenMark)는 확장판에 없다. 서버도 확장판엔 day.evidence 를 싣지 않는다(21-07)"
metrics:
  duration: 약 55분
  completed: 2026-11-13
status: complete
---

# Phase 21 Plan 14: 토론 · 의심 보드 Summary

**확장판 토론이 시작되면 스테이지 위(위 호스트 독 + 8 ~ 아래 패널 위 − 8)에 의심 보드 카드가 그날 한 번 자동으로 열린다. 머리 '내가 아는 것' + 닫기 44, 칩 줄(발자국·옷 조각·창문은 금빛, 먼저 손댄 흔적은 점선 회색, 목격 n 은 눌러 펼치는 button), 산 사람 4열 얼굴 줄에 받은 옷 조각과 같은 옷이면 금빛 2px 테두리 + 18px 배지 cloth/window. 닫아도 헤더 [의심 보드] 단추로 다시 연다. 보드는 나만 보고, 남의 단서·정체 표시는 없다.**

## RED 증거 (단일 줄)

- Task 1 (`9e1d8317`): `Error: Failed to resolve import "../../src/components/v2/SuspectBoard" from "test/client/suspectBoard.test.tsx". Does the file exist?`
- Task 2 (`3adf28b9`): `AssertionError: expected null not to be null` (확장판 토론 첫 렌더에 [data-suspect-board] 없음) · `AssertionError: expected [ +0, +0, 1 ] to deeply equal [ +0, +0, +0 ]` (옛 [기록] 단추가 남아 있음) · `AssertionError: the given combination of arguments (undefined and string) is invalid for this assertion` (건너뛴 아침 알림 없음 — [data-announce] 가 없는 DOM)

## 자동 열림 래치 규칙

위 key-decisions 첫 줄과 같다. 시험이 (1) 첫 렌더 열림 (2) 닫으면 없어짐 (3) 같은 일차 다시 그리기로는 열리지 않음 (4) 헤더 단추로 다시 열림 (5) 다음 일차는 다시 자동 열림을 고정한다.

## 헤더 단추와 표식

- 확장판 토론의 산 사람 헤더에는 단서가 없어도 `[기록]` 자리(`.mf-game__record-slot`, 기존 E2E 표식 `data-record-button` 유지)에 `ToolButton` 이름 '의심 보드'(timeline 22, `aria-expanded`)가 있다. 빛남(call)은 없다 — 사회자 띠가 discussion.clue/act 이고(21-08) 빛은 채팅이 받는다.
- 옛 [기록] 단추·목격 기록 카드·증거 카드는 확장판(`causalBoard`)에서 그리지 않는다. 기본 마피아에는 보드도 헤더 의심 보드 단추도 없다.

## 건너뛴 아침(D-17)

`dayView.phaseEntry` 에 `discussion` 갈래를 더했다. 직전 view 가 night 이고 지금이 확장판 discussion 이면 아침과 같은 시각·길이(`ANNOUNCE_MORNING_AT`·`ANNOUNCE_MORNING_MS`)로 `MORNING_TEXT.quiet`('아무 일도 없었습니다') 알림과 같은 hot 줄을 한 번 만든다. 건너뛴 아침은 피해자도 미수도 없는 밤이라 문구는 quiet 뿐이다(새 문구 없음, day.morning 은 읽지 않는다). 기본 마피아는 밤 다음이 늘 아침이라 이 길이 없다. 소리(`audio/script.ts` 의 morning.calm)는 아침 진입에만 걸려 있어 건너뛴 아침에는 울리지 않는다 — 새 소리를 만들지 않았다(P21-18).

## 숨긴 옛 부품 (결정 기록 정리 후보)

확장판에서 쓰이지 않게 된 공개 흔적 경로 — 지우지 않았고 기본 마피아·튜토리얼 가짜 view 가 쓴다.
- `GameMap` 의 `witnessRows` → `RecordCard` + 헤더 [기록] 단추(확장판에서는 null). 서버도 기본판에는 me.record 를 싣지 않으므로 서버 view 로는 이 경로가 도달하지 않는다(튜토리얼은 자체 RecordCard 를 그린다).
- `GameMap` 의 `EvidenceCard`(`traceShown && !causalBoard`) 와 day.evidence 기반 이름표 표시(`evidenceMarks` 의 legacy 갈래, `seenMark`). 서버는 확장판 day.evidence 를 걷었고(21-07) 기본판엔 원래 없다. 현재는 튜토리얼 장면 5 의 가짜 view 만 쓴다 — 21-18 이 튜토리얼을 현장 + 보드로 바꾸면 이 경로·`EvidenceCard`·`RecordCard` 의 GameMap 사용을 걷어 낼 수 있다.
- `hostLine` 의 `witness`·`discussion.evidence`(UI-SPEC 192행에서 확장판 미사용 확정, 21-08).

## Deviations from Plan

### Auto-fixed / 계획 보완

**1. [Rule 3 - 계획 보완] 건너뛴 아침 알림은 GameMap 이 아니라 dayView(알림을 만드는 길)에 있다**
- 계획의 files_modified 에 `src/game/dayView.ts`·`test/unit/dayView.test.ts` 가 없다. 지금 아침 알림은 `dayEvents`(phaseEntry) → useDayFx → RoomScreen → GameMap `announce` 로 흐르므로 "같은 부품·같은 시간" 을 지키려면 그 길에 갈래를 더하는 것이 맞다(GameMap 이 따로 알림 상태를 만들면 두 길이 생긴다). 단위 시험 한 개 추가(기존 시험 불변).
- **Commit:** 7d2f870a

**2. [Rule 1 - 회귀 방지] 확장판 판정에 `view.mode !== undefined` 를 더했다 (causalBoard)**
- 튜토리얼의 가짜 view 에는 mode 가 없어(`modeOf` 기본값 extended) `rules.errand` 만으로 가르면 `tutorialScenes.test` 장면 5 세 시험(증거 카드·선 둘)이 깨진다. 시험을 바꾸거나 건너뛰지 않고 서버 view 는 mode 를 늘 싣는다는 사실로 갈랐다. 21-18 이 튜토리얼을 새 장면으로 바꿀 때 mode 를 넣거나 이 가드를 걷는다.
- **Commit:** 7d2f870a

**3. [계획 보완] 옛 확장판 단언 두 개를 새 기대로 고쳤다**
- gameMap.test 의 "extended + me.record + day.evidence 면 [기록] 이 하나이고 이름표 표시(seenMark)" → 헤더 단추 [의심 보드] 하나·[기록] 0·seenMark 없음, "extended + 흔적 아침 증거 카드 하나" → 0. 계획 action 이 허용한 갱신이다(기본 마피아 단언은 그대로).
- **Commit:** 3adf28b9

**4. [계획 보완] CSS 위치·작은 이름 충돌**
- 보드 블록은 21-13 블록 바로 뒤(심부름 `.mv-errand` 블록 앞)에 둔다. `errandParts.test` 가 첫 `.mv-errand` 부터 끝까지에서 `light-lamp` 를 쓰는 선택자를 `mv-errand-*` 로 제한하기 때문이다(시험은 고치지 않음). 색을 쓰지 않는 보드 안 목격 줄 덮어쓰기 두 줄(`.mv-suspect-board .mv-record__rows`·`.mv-record__face.is-ghost`)만 파일 끝에 둔다 — `recordTrace.test` 가 첫 `.mv-record` 부터 끝까지를 보므로 기록 카드 블록 규칙이 먼저 나온다.
- GameMap 지역 이름 `recordRows` 는 `dayStaticGuard` 가 지운 이름으로 막아 `lineRows` 로 지었다.
- **Commit:** 7d2f870a

### 하지 않은 것

- CLUE_PHASES 상수를 화면에서 읽지 않았다(`shared/game/scene.ts` 는 서버 판정 모듈 — 클라이언트 번들에 끌어오지 않는다). me.clues 는 서버가 그 단계에만 싣는다.
- E2E 스크립트(scripts/e2e)의 토론·기록 흐름은 갱신하지 않았다 — `scripts/e2e/errand.mjs`·`browser.mjs` 가 아직 `[data-record-card]` 를 기다리는 곳은 21-16 소관.
- 튜토리얼 장면(21-18), 심부름 중 목격(`me.record` 자체)은 건드리지 않았다.

## Known Stubs

없음.

## Threat Flags

없음(새 네트워크·인증·파일 접근 없음. 보드는 내 me.clues·me.record 와 공개 players 만 읽는다. T-21-33 은 같은 view 의 마피아·시민·경찰·의사 outerHTML 동일 시험과 정체·역할 글·아이콘 없음 시험이 막는다. srcClean 초록).

## 한계 (정직하게)

- **실제 게임 흐름(토론 시작 → 자동 열림 → 모이기)을 실브라우저·실기기로 끝까지 돌려 본 것이 아니다.** WorldStage 는 가짜 + jsdom 이라 보드가 실제 스테이지 위에 겹칠 때의 위치(`.mf-game__record` 의 위 호스트 독 + 8 ~ `--mf-record-bottom`)와 `panelRef` 윗변 측정(실제 레이아웃에서만 값이 나옴), 키보드가 열릴 때의 변화는 보지 못했다. 새 순서 E2E 는 21-16·21-17 소관.
- 대신 headless Chromium(playwright-core 의 chromium-headless-shell)으로 실제 CSS(tokens·ds·v2·game)에 보드 마크업을 그려 값을 쟀다. 390×844(compact 아님): 카드 폭 358, 얼굴 칸 77×64, 같은 옷 칸 테두리 2px 금빛(rgb 255 207 138)·안 같은 칸 투명, 배지 18×18 둘 x 간격 12(−6 겹침), 칩 높이 32, 카드 면 rgb(21 28 54)=night-800·테두리 night-600·둥근 14, 닫기 44×44·머리 44, 본문 넘침 없음. 360×560(compact): 칸 56, 카드 높이 208(가용 높이 안), 본문 204 중 142 가 보여 **카드 안에서 스크롤하고 머리·닫기 44 는 고정**. 스크린샷으로 시안(Board.dc.html)과 같은 모양(머리·칩 둘째 줄 바뀜·4열 얼굴·배지)을 확인했다(얼굴 그림은 시험용 빈 이미지).
- 칩 `목격 n` 의 44 탭 영역은 `::after inset: -6px 0` 로 늘렸다(칩 시각 높이 32 유지). 실기기 탭 감은 끝에 몰아서 본다.
- 채팅 입력칸 포커스로 보드가 접히는 동작(옛 카드 규칙 재사용)은 시험이 고정하지 않았다(단위에서 포커스 이벤트가 실제 키보드 레이아웃과 다르다).

## 21-15·21-16 에 넘기는 것

- **E2E 표식(21-16)**: 보드 `section[data-suspect-board]`(접근성 이름 '의심 보드'), 헤더 단추 `[data-record-button] button[aria-label='의심 보드']`(`aria-expanded`), 닫기 `[data-suspect-board] button[aria-label='닫기']`, 칩 줄 `ul[aria-label='내가 아는 것']` 안 `[data-clue-chip="footprint|cloth|window|touched|dark|witness|none"]`, 목격 펼치기 `button[aria-expanded]`(안에 `data-clue-chip="witness"`)와 펼친 줄 `[data-record-row]`, 얼굴 칸 `[data-board-face="{seat}"]`(산 사람만, 같은 옷이면 `data-board-mark="cloth"|"window"|"cloth,window"`, 접근성 이름 '{닉네임}' 또는 '{닉네임}, 같은 옷 조각'), 배지 `.mv-suspect-board__badge[data-badge]`. 토론이 시작되면 보드는 이미 열려 있다(단계 진입 때) — 기다릴 필요 없이 `[data-suspect-board]` 를 찾는다. 이름표 같은 옷 표시는 3D 이름표 props(`traceMark`)이므로 E2E 는 보드 배지를 본다.
- **기존 E2E 갱신 필요(21-16)**: `scripts/e2e/errand.mjs` 411·417행·`browser.mjs` 2223행 등의 `[data-record-card]` 기다림, `button[aria-label='기록']` 클릭은 확장판 토론에서 더는 맞지 않는다(보드·[의심 보드] 단추로). 기본 마피아에는 원래 기록이 없다.
- **21-15**: 건너뛴 아침 알림은 위 phaseEntry 한 곳이다. 처형 없는 날(execution 건너뜀)의 결과 알림은 이미 있는 `DAY_COPY.noExecution` 길(밤 진입 알림)이라 이 계획이 건드리지 않았다. 21-15 가 확장판 밤/처형 화면을 만지면 `dayView.phaseEntry` 의 `night`·`discussion` 갈래가 두 개의 "그날 첫 화면 결과 알림" 길임을 참고한다.
- **21-18(튜토리얼)**: `causalBoard` 가드(`view.mode !== undefined`)와 GameMap 의 옛 증거 경로(`EvidenceCard`·`evidenceMarks` legacy)는 튜토리얼 가짜 view 용이다. 튜토리얼이 보드 장면으로 바뀌면 mode 를 view 에 넣고 옛 경로를 걷어 낸다.
- srcClean 유지(lampCut·smudged·skipVote·mafiaTouch·낱말 cut·data-*cut* 없음). 보드는 me.clues·me.record·players(공개) 만 읽고 역할로 갈라지지 않는다.

## Self-Check: PASSED

- 파일: SuspectBoard.tsx·suspectBoard.test.tsx 있음, 수정 파일 모두 커밋됨(`git status` 에 21-14 관련 미커밋 없음).
- 커밋: 9e1d8317(test)·0e062005(feat)·3adf28b9(test)·7d2f870a(feat) 모두 HEAD 의 조상.
- 인수 기준: SuspectBoard.tsx `data-suspect-board` 1·`data-board-face` 1, GameMap `SuspectBoard` 2 이상·`의심 보드` 1 이상, SUMMARY 에 넘기는 것 절.
- `npm test` 8997 통과·262 건너뜀·실패 0, `npm run typecheck` 초록, srcClean 초록, 위생 grep(바뀐 파일) 새 결과 없음.
