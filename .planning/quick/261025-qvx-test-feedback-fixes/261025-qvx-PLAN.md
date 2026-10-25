---
phase: quick-261025-qvx
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/screens/DayScene.tsx
  - src/screens/RoomScreen.tsx
  - src/components/RoleCardToast.tsx
  - src/styles/rolecard-toast.css
  - src/game/journalText.ts
  - src/components/DayTable.tsx
  - src/styles/daytable.css
  - src/components/NightIntro.tsx
  - src/styles/night.css
  - shared/seatLayout.ts
  - src/components/Table.tsx
  - test/client/dayScene.test.tsx
  - test/client/roleCardFlow.test.tsx
  - test/client/journal.test.tsx
  - test/client/dayTable.test.tsx
  - test/client/nightIntro.test.tsx
  - test/client/table.test.tsx
  - test/unit/seatLayout.test.ts
  - scripts/e2e/lib.mjs
  - scripts/e2e/lib.test.mjs
  - scripts/e2e/browser.mjs
  - scripts/e2e/flows.mjs
  - docs/decisions/0028-test-feedback-fixes.md
  - .planning/phases/03.1-sequential-claims-role-card/03.1-UI-SPEC.md
  - HANDOFF.md
autonomous: true
requirements: [QUICK-261025-qvx]

estimate:
  tokens: 200000
  raw_tokens: 200000
  tasks: 4
  confidence: low

must_haves:
  truths:
    - "낮 직업 주장 차례 자리의 발밑 하얀 링(.mf-dt__spot)은 뒤쪽 호(윗쪽 반)가 캐릭터 그림 뒤에, 앞쪽 호(아랫쪽 반)가 캐릭터 그림 앞에 그려진다. 링의 크기(폭 140%·높이 24%)·두께 3px·색 gray-50·빛 18px 은 그대로이고 .mf-dt__spot 은 차례 자리마다 정확히 한 개다. 이름표 1~11·캐릭터 12~22·어둡게 층 30·방금 탈락한 유령 31·이모티콘 60+ 규칙은 바뀌지 않고 D3a(이름표 z < 캐릭터 z)가 그대로 통과한다 (U-02)"
    - "같은 접속에서 비밤 단계 → 밤으로 넘어가는 순간에만 모든 사람 화면(탈락자 포함)에 'N일차 / 밤이 되었습니다' 가 한 번 떠서 사라진다. 길이는 낮 시작 발표와 같은 DAY_ANNOUNCE_MS(2초), 번짐 800ms·ease-out 과 축소 모션 처리(전역 규칙)도 같다. 처음 마운트·재접속(epoch 변화)·밤 안의 다시 그리기·밤을 벗어난 뒤에는 뜨지 않고, 터치를 막지 않으며(pointer-events none), 역할에 따라 문구가 달라지지 않는다. 서버 규칙·시간·와이어는 바뀌지 않는다 (U-03)"
    - "밤 끝 알림(눌러서 보기)은 어디에도 없다: 알림 컴포넌트·CSS·DayScene 연결·활동 기록 열기 연결·문구(JOURNAL_TEXT.notice)·테스트·E2E 알림 규칙이 모두 정리된다. [역할 카드] 앰버 점과 활동 기록 탭 안읽음 점·NEW·읽은 개수 저장은 그대로 동작한다 (U-01)"
    - "대기실·역할 배정 화면(Table.tsx)의 표시 슬롯은 좌석 번호에만 의존하는 고정 순서(8슬롯 비트반전 0,4,2,6,1,5,3,7)에 나를 맨 아래로 돌려 놓는다: 2명이면 마주 보고 3명이면 삼각으로 보이고, 사람이 나가 빈 자리가 생겨도 다른 사람의 위치가 움직이지 않으며, 나는 늘 맨 아래 가운데다. 서버 좌석 번호(lowestFreeSeat 등)·낮 DayTable 배치(daySeatLayout)·차례 순서는 바뀌지 않는다 (U-04)"
    - "E2E 기준 수치(OVERLAP_EPS 0.5, ONE_LINE_FACTOR 1.6, FACE_RATIO 0.45, TAP_MIN 44, PANEL_H 157)와 허용 목록(TEXT_SIZE_ALLOW 는 .mf-journal__new·.mf-tt* 뿐)은 그대로이고, 승인된 완화 M1·D3a/D3b·D4 외 완화는 없다. 새 검사 K4(링 앞뒤 층)·N6/N7(밤 시작 문구)이 더해지고 R6 은 알림이 없음을 보는 검사로 바뀐다 (U-05)"
    - "로컬 `npm run dev` 와 배포본 모두에서 `npm run e2e` 가 전부 통과(E2E OK)하고, 배포본에서 `node scripts/smoke.mjs --prod --stage full` 이 4·5·8명 모두 SMOKE OK 다. 결정 0028·HANDOFF·UI-SPEC 이 갱신되어 개인 원격에 push 된다 (U-05)"
  artifacts:
    - path: "src/components/DayTable.tsx"
      provides: "차례 링 묶음 .mf-dt__spot 안의 뒤쪽 호 --back, 앞쪽 호 --front 두 요소(캐릭터 그림 뒤에 앞쪽 호가 오는 마크업 순서)"
      contains: "mf-dt__spot-arc--front"
    - path: "src/styles/daytable.css"
      provides: "쌓임 맥락을 만들지 않는 링 묶음 + 반원 clip-path 두 호(뒤쪽 호 z-index -1)"
      contains: "mf-dt__spot-arc--back"
    - path: "src/components/NightIntro.tsx"
      provides: "밤 시작 문구 오버레이(N일차 + 밤이 되었습니다), NIGHT_INTRO_MS = DAY_ANNOUNCE_MS, 마운트 때 한 번 거는 해제 타이머"
      contains: "밤이 되었습니다"
    - path: "shared/seatLayout.ts"
      provides: "SPREAD_ORDER·spreadSlot — 좌석 번호만으로 정해지는 표시 슬롯, seatLayout 의 slot 이 나 기준으로 돌린다"
      contains: "SPREAD_ORDER"
    - path: "scripts/e2e/lib.mjs"
      provides: "K4 링 앞뒤 층 검사, N6 밤 시작 문구 검사, R6 알림 없음 검사"
      contains: "K4"
    - path: "docs/decisions/0028-test-feedback-fixes.md"
      provides: "알림 제거·링 층 분리·대기실 자리 표시 규칙·밤 시작 연출 결정 기록"
      contains: "0026"
  key_links:
    - from: "src/components/DayTable.tsx (.mf-dt__spot 묶음)"
      to: "src/styles/daytable.css (.mf-dt__spot-arc--back / --front)"
      via: "묶음은 쌓임 맥락을 만들지 않고(transform·z-index·opacity·animation 없음) 자리(.mf-dt__seat)의 쌓임 맥락 안에서 뒤쪽 호 z -1, 앞쪽 호는 그림 다음 마크업 순서로 그림 위"
      pattern: "mf-dt__spot-arc--(back|front)"
    - from: "src/screens/DayScene.tsx 단계 전환 조정"
      to: "src/components/NightIntro.tsx"
      via: "렌더 중 상태 조정에서 prevPhase !== night && phase === night && epoch 불변일 때만 켜고, 밤을 벗어나거나 epoch 가 바뀌면 끈다"
      pattern: "NightIntro"
    - from: "shared/seatLayout.ts spreadSlot"
      to: "src/components/Table.tsx seatLayout 호출"
      via: "Table 은 seatLayout(i, mySeat) 만 부르고 slot = spreadSlot(seat) - spreadSlot(mySeat) (mod 8)"
      pattern: "spreadSlot"
    - from: "scripts/e2e/browser.mjs 스냅숏(ring)"
      to: "scripts/e2e/lib.mjs turnChecks K4"
      via: "차례 링 묶음·두 호의 계산된 z-index·position·clip-path·DOM 순서를 읽어 K4 가 판정"
      pattern: "ring"
---

<objective>
사용자 실기기 테스트 피드백 4건을 한 계획으로 고친다(quick 261025-qvx). 시안은 만들지 않는다. 기준은 `.planning/phases/03.1-sequential-claims-role-card/03.1-UI-SPEC.md` 와 `design/tokens.json` 토큰이며, 참고 이미지·에셋 경로는 받지 않았다(자체 판단 없이 기존 승인 값을 따른다 — 링 값은 UI-SPEC B, 밤 시작 문구는 낮 시작 발표 S-06a 의 구현·길이).

| 출처 | 항목 | 담당 |
|------|------|------|
| 사용자 지시 U-01 | (3) 밤 끝 알림 완전 제거. [역할 카드] 앰버 점·활동 기록 탭 안읽음 점은 유지 | 과제 1 |
| 사용자 지시 U-02 | (1) 차례 링 뒤쪽 반은 캐릭터 뒤, 앞쪽 반은 캐릭터 앞 층. 다른 z 규칙 불변 | 과제 2 가 |
| 사용자 지시 U-03 | (2) 밤 진입 때만 1회 '밤이 되었습니다' (낮 시작 발표와 같은 방식·길이·축소 모션) | 과제 2 나 |
| 사용자 지시 U-04 | (4) 대기실 표시 슬롯만 고르게 퍼지는 고정 순서로. 서버 좌석 번호·낮 DayTable 불변 | 과제 3 |
| 사용자 지시 U-05 | TDD(RED→GREEN 커밋쌍), 검증 순서, 결정 0028, HANDOFF·UI-SPEC 갱신, 마지막에 배포·push | 과제 4 (+ 각 과제의 RED 커밋) |

범위 밖(건드리지 않는다): 낮 테이블·캐릭터 위치(대기실과 낮의 기하 통일)와 역할 배정 화면이 늘어나는 문제는 시안 먼저 진행 중이다. `src/game/dayTable.ts` 의 기하 숫자(cy 210, rx 132, 테이블 면 280×108 등)·`shared/game/` 서버 규칙·와이어는 이 계획에서 바뀌지 않는다.

Tracer 생략 사유: 네 건은 서로 독립인 수정이고 각 건이 화면 → 단위 테스트 → E2E 규칙을 RED→GREEN 으로 끝까지 닫는다. 얇은 관통 슬라이스를 따로 둘 새 계층이 없다.

Output: 위 4건의 코드·테스트·E2E 규칙, `docs/decisions/0028-test-feedback-fixes.md`, 갱신된 `HANDOFF.md`·`03.1-UI-SPEC.md`, 배포 및 push.
</objective>

<execution_context>
@~/.claude-personal/gsd-core/workflows/execute-plan.md
@~/.claude-personal/gsd-core/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/STATE.md
@.planning/phases/03.1-sequential-claims-role-card/03.1-UI-SPEC.md
@docs/decisions/0025-screen-e2e.md
@docs/decisions/0026-role-card-journals.md
@docs/decisions/0027-sequential-claims-wire.md
@HANDOFF.md

정리된 사실(계획 작성 시점 HEAD = bce014f, 이 계획의 불변 검사 기준 커밋):
- `shared/seatLayout.ts` 의 `seatLayout` 은 `src/components/Table.tsx`(대기실·역할 배정)만 쓴다. 낮 `DayTable` 은 `src/game/dayTable.ts` 의 `daySeatLayout`(n 명 등간격)을 쓴다. `test/unit/seatLayout.test.ts`·`test/client/table.test.tsx` 가 `seatLayout` 을 직접 부른다.
- 차례 링 `.mf-dt__spot` 은 `.mf-dt__seat`(position absolute + transform scale + 인라인 z-index 12~22/31)의 자식이다. 자리가 쌓임 맥락이라 링 한 요소로는 캐릭터 앞뒤로 갈릴 수 없다. 전역 `*{box-sizing:border-box}`(base.css) 라 지금 링의 바깥 크기는 폭 140%×높이 24% 이다.
- 낮 시작 발표는 서버 단계 `dayAnnounce`(DAY_ANNOUNCE_MS 2000)의 별도 화면 `src/screens/Day.tsx` 이다: `.mf-day__morning` 방사형 빛(opacity 0→1, `--dur-slow` 800ms, `--ease-out`), `N일차`(mf-t-heading) + `낮이 되었습니다`(mf-t-display, 800ms 번짐·scale 1.04→1). 축소 모션은 개별 규칙이 아니라 `src/styles/base.css` 전역 규칙(animation-duration 0.01ms)이 맡는다. 밤(30초)에는 별도 단계가 없으므로 밤 문구는 DayScene 안의 클라이언트 오버레이다.
- DayScene 은 `claim → discussion → night → morning` 에서 같은 장면 키라 다시 마운트되지 않는다. `useRoomConnection` 의 `epoch` 는 새 연결의 첫 state 마다 1씩 늘고 view 와 같은 렌더에서 바뀐다. DayScene 에는 이미 `prevPhase` 렌더 중 상태 조정 블록이 있다.
- E2E: `scripts/e2e/lib.mjs` 의 `turnChecks`(K1·K2)·`noticeChecks`(R6)·`dayChecks`(D3a 는 `.mf-dt__tag` z 최댓값 < `.mf-dt__seat` z 최솟값), `browser.mjs` 의 `collectSnapshot`·`clickNotice`, `flows.mjs` 의 `roleCardViaNotice`·`morningRoleChecks`·`gameFlow`(밤 상태). 검사 ID K4·N6·N7 은 비어 있다.
- 로컬 E2E 는 `npm run dev`(기본 5173)를 띄우고 `npm run e2e -- --url http://localhost:5173` 로 돈다. 배포본 주소는 `scripts/prod-url.txt`(https://minifia.dhplay.workers.dev). 결정 번호 다음 값은 0028.

</context>

<!-- planner-discipline-allow: RoleCardToast -->
<!-- planner-discipline-allow: rolecard-toast -->
<!-- planner-discipline-allow: onOpenActivity -->
<!-- planner-discipline-allow: roleCardOpen -->
<!-- planner-discipline-allow: clickNotice -->
<!-- planner-discipline-allow: roleCardViaNotice -->
<!-- planner-discipline-allow: rolecard-notice -->

<tasks>

<task type="auto" tdd="true">
  <name>과제 1: 밤 끝 알림 완전 제거 — RED(알림이 없다는 기준) → GREEN(코드·E2E 정리) (U-01)</name>
  <files>test/client/dayScene.test.tsx, test/client/roleCardFlow.test.tsx, test/client/journal.test.tsx, scripts/e2e/lib.test.mjs, src/screens/DayScene.tsx, src/screens/RoomScreen.tsx, src/components/RoleCardToast.tsx (삭제), src/styles/rolecard-toast.css (삭제), src/game/journalText.ts, scripts/e2e/lib.mjs, scripts/e2e/browser.mjs, scripts/e2e/flows.mjs</files>
  <read_first>src/screens/DayScene.tsx, src/screens/RoomScreen.tsx, src/components/RoleCardToast.tsx, src/game/journalText.ts, test/client/roleCardFlow.test.tsx (눌리는 밤 끝 알림 describe), test/client/dayScene.test.tsx (알림 describe 두 개), scripts/e2e/lib.mjs (noticeChecks), scripts/e2e/browser.mjs (알림 스냅숏·알림 누르기), scripts/e2e/flows.mjs (morningRoleChecks·알림 흐름), .planning/phases/03.1-sequential-claims-role-card/03.1-UI-SPEC.md (D·R6·S13)</read_first>
  <behavior>
    - 경찰·마피아·의사가 밤 → 아침으로 기록이 늘어도 role=status 알림이 뜨지 않고 눌리는 알림 버튼이 없다. [역할 카드] 앰버 점은 켜진다
    - 헤더 [역할 카드] → 활동 기록 탭을 열면 헤더 점·탭 점이 사라지고 새 줄에 NEW 가 붙고 읽은 개수(저장 값 1)가 저장된다 — 알림을 누르는 경로 없이도 같은 값
    - 알림 컴포넌트·CSS 파일이 저장소에 없고, JOURNAL_TEXT 각 역할 항목의 키는 name·empty 둘뿐이다
    - E2E R6 은 모든 역할의 아침에 '밤 끝 알림이 화면에 없음'을 보고, 측정값 필드가 없으면 조용히 통과시키지 않고 실패한다
  </behavior>
  <action>
    진행 순서는 RED 커밋 → GREEN 커밋이다(사용자 지시 U-05, TDD 커밋쌍). 이 과제의 맨 처음에 `git status --short` 로 작업 트리를 확인한다(추적 안 된 `.planning/milestone.lock` 외에는 깨끗해야 한다).

    가. RED — 테스트를 먼저 고치고 실패를 확인한 뒤 `test(qvx): 밤 끝 알림이 없다는 기준으로 바꾼다` 로 커밋한다.
    - `test/client/dayScene.test.tsx`: 알림을 가정한 describe 두 개(눌리는 밤 끝 알림 동작, 알림 CSS 규약)를 지우고 그것들만 쓰던 import 를 정리한다. 대신 describe 「DayScene 밤 끝 알림 없음 (결정 0028)」을 더한다 — 경찰·마피아·의사 각각 밤 → 아침으로 view 를 바꾸며 기록 길이를 늘려도 텍스트에 `일지` 가 든 role=status 요소와 알림 버튼이 0 개다. 알림 전용 선택 props 를 하나도 넘기지 않고도 장면이 그려진다. 알림 컴포넌트 파일과 알림 CSS 파일이 저장소에 없다(`node:fs` 의 `existsSync` 로 두 경로, 파일 경로는 위 `<files>` 의 삭제 표시 두 개).
    - `test/client/roleCardFlow.test.tsx`: 알림 도우미 두 개와 눌리는 알림 describe 를 지운다. 대신 (i) 세 역할에서 기록이 늘어도 알림이 없고 헤더 앰버 점만 켜진다, (ii) 헤더 [역할 카드] 버튼 → 활동 기록 탭으로 열면 점·탭 점이 사라지고 새 줄에 `NEW`, 읽은 개수 저장 값이 `1` — 옛 「알림을 누르면…」 테스트가 보증하던 값을 버튼 경로로 옮겨 유지한다(삭제하지 않는다). 시민에게 알림도 점도 없는 기존 테스트는 그대로 둔다.
    - `test/client/journal.test.tsx`: 알림 문구 세 줄 단언을 「각 역할 항목의 키가 name·empty 둘뿐」 단언으로 바꾼다.
    - `scripts/e2e/lib.test.mjs`: 알림 문구·누른 뒤 탭 두 테스트를 지우고 새 순수 함수 `noNightNoticeChecks(snap)` 테스트로 바꾼다 — `snap.roleCard.noticeTexts` 가 빈 배열이면 id R6 통과, 항목이 있으면 실패하고 내용 칸에 그 문구, 필드가 없으면(undefined) 통과시키지 않고 `측정값 없음` 으로 실패(G7 의 smallText 와 같은 방식). 픽스처 `rcSnap()` 에 `noticeTexts: []` 를 더하고 import 를 맞춘다.
    - 실행: `npx vitest run test/client/dayScene.test.tsx test/client/roleCardFlow.test.tsx test/client/journal.test.tsx` 와 `node --test scripts/e2e/lib.test.mjs` 가 지금은 실패해야 한다(알림이 아직 있고 새 함수가 아직 없다). 실패 이유가 의도한 것인지 확인하고 커밋한다.

    나. GREEN — `feat(qvx): 밤 끝 알림을 없앤다 (결정 0028)` 로 커밋한다.
    - 알림 컴포넌트와 알림 CSS 파일을 `git rm` 한다.
    - `src/screens/DayScene.tsx`: 알림 컴포넌트 import·일지 문구 import, 4초짜리 알림용 `useToast` 호출과 그 show/dismiss, 본인 일지 역할·기록 길이·이전 기록 ref 와 두 개의 알림 효과(기록이 늘 때 띄우기, 시트가 열리면 지우기), JSX 의 알림 렌더, 그리고 알림 전용이던 선택 props 둘(역할 카드 시트 열림 여부, 활동 기록 열기 콜백)과 인터페이스 주석을 지운다. 선택 거부 토스트용 기본 `useToast()` 와 `Toast` 렌더는 그대로 둔다. `useRef` 가 더는 쓰이지 않으면 import 에서 뺀다. 머리 주석의 밤 끝 알림 설명도 지운다.
    - `src/screens/RoomScreen.tsx`: 활동 기록 탭을 여는 알림 전용 함수와 DayScene 에 넘기던 위 두 props 를 지운다. 시트 열림·탭 상태(`roleCard`)와 읽음 처리 효과는 건드리지 않는다.
    - `src/game/journalText.ts`: 타입과 세 항목에서 알림 문구 필드를 지운다. `journalArt(role, "icon")` 슬롯과 `public/journals/` 는 다른 곳에서 쓸 수 있으니 건드리지 않는다.
    - E2E: `lib.mjs` 의 알림 검사 함수를 `noNightNoticeChecks` 로 바꾼다(id R6, 라벨 「밤 끝 알림 없음」). `browser.mjs` 에서 알림 요소 조회와 `notice` 필드를 지우고, 대신 `roleCard.noticeTexts` = 보이는 `[role="status"]` 요소 중 글자에 `일지가 추가됐어요` 또는 `눌러서 보기` 가 든 것의 글자 배열을 싣는다(요소 클래스 이름에 기대지 않는다). 알림 누르기 도우미를 지운다. `flows.mjs` 에서 해당 import 와 알림 누르기 흐름 함수와 그 상태 분기를 지우고, 마피아 흐름(mafia8)은 알림 상태 대신 버튼 경로 상태(경찰·의사와 같은 역할 카드 흐름)로 바꾼다. 아침 역할 카드 검사 함수는 모든 역할(시민 포함)에 R6 알림 없음 검사를 돌리고, 시민이 아닌 역할은 R1 을 `unread: true` 로 그대로 본다.
    - D4 단순화 확인(사용자 지시 「알림이 사라지면 D4 예외가 단순해지는지 확인」): `lib.mjs` 의 D4 판정(`d4TestButton`)에는 알림 전용 예외 분기가 없었음을 코드로 확인하고(없으면 건드리지 않는다), 알림 때문에 생긴 360폭 좁은 폭 규칙은 CSS 파일 삭제로 사라졌음을 확인한다. 검색: src·scripts/e2e·`src/styles/testtools.css` 에서 `알림`·`S13`·`389px` 로 알림 때문에 남은 조건이 있는지 보고, 있으면 지운다. D4 의 깊이 ≤ 3px·가운데 점 눌림 기준은 승인된 완화 그대로 두고 더 완화하지 않는다. 확인 결과는 SUMMARY 에 한 줄로 적는다.
    - 옛 알림을 가정한 주석·문서 문장이 src·scripts 에 남았으면 지운다(UI-SPEC·HANDOFF 는 과제 4).
    - 실행: 위 두 검사가 모두 통과해야 한다. 알림 전용 export 가 없어져 타입 오류가 나는 곳이 있으면(다른 테스트가 그 props 를 넘기는 경우 등) 그 테스트를 새 계약에 맞게 고친다 — 기준 수치를 낮추지 않는다.
  </action>
  <verify>
    <automated>npx vitest run test/client/dayScene.test.tsx test/client/roleCardFlow.test.tsx test/client/journal.test.tsx test/client/roomScreen.test.tsx && node --test scripts/e2e/lib.test.mjs && npm run typecheck && test ! -e src/components/RoleCardToast.tsx && test ! -e src/styles/rolecard-toast.css && ! grep -rnE "RoleCardToast|rolecard-toast|onOpenActivity|roleCardOpen|clickNotice|roleCardViaNotice|rolecard-notice" src scripts/e2e</automated>
  </verify>
  <done>밤 끝 알림이 코드·스타일·문구·테스트·E2E 어디에도 없고, [역할 카드] 앰버 점·탭 점·NEW·읽은 개수 저장 테스트는 버튼 경로로 계속 통과한다. E2E R6 은 알림이 없음을 모든 역할 아침에서 본다. RED 커밋과 GREEN 커밋이 따로 있다.</done>
</task>

<task type="auto" tdd="true">
  <name>과제 2: 차례 링 앞뒤 층 분리(U-02)와 밤 시작 문구(U-03) — 각각 RED → GREEN</name>
  <files>test/client/dayTable.test.tsx, test/client/nightIntro.test.tsx, scripts/e2e/lib.test.mjs, src/components/DayTable.tsx, src/styles/daytable.css, src/components/NightIntro.tsx, src/styles/night.css, src/screens/DayScene.tsx, scripts/e2e/lib.mjs, scripts/e2e/browser.mjs, scripts/e2e/flows.mjs</files>
  <read_first>src/components/DayTable.tsx, src/styles/daytable.css (z-index 머리 주석·.mf-dt__spot·축소 모션), test/client/dayTable.test.tsx (차례·CSS 규약 describe), src/screens/Day.tsx, src/styles/phase.css (S-06 낮 시작: mf-day__morning·mf-day__title), src/styles/day.css (mf-day__sub), src/styles/base.css (축소 모션 전역 규칙), src/components/MorningCard.tsx 와 src/styles/night.css (지연 변수·퇴장 방식), src/screens/DayScene.tsx (prevPhase 렌더 중 조정), shared/game/phases.ts (DAY_ANNOUNCE_MS), scripts/e2e/lib.mjs (turnChecks), scripts/e2e/flows.mjs (gameFlow 밤 상태)</read_first>
  <behavior>
    - 차례 자리: `.mf-dt__spot` 한 개 안에 뒤쪽 호(`--back`)와 앞쪽 호(`--front`)가 이 순서로 있고, 자리 안에서 캐릭터 `img.mf-figure` 가 `.mf-dt__spot` 보다 앞(DOM 순서)이다. 자리 인라인 z-index 는 배치 결과(12~22) 그대로, 탈락 강조는 31
    - CSS: `.mf-dt__spot` 은 폭 140%·높이 24%·`left:-20%`·`bottom: calc(-4px - 12%)`·pointer-events none 이고 transform·z-index·opacity·filter·isolation·animation 이 없다(쌓임 맥락을 만들지 않는다). 두 호는 border 3px solid gray-50·빛 18px·페이드 `mf-dt-fade`·pointer-events none, 뒤쪽 호 `z-index:-1` + 위쪽 반만 보이는 clip-path, 앞쪽 호는 아래쪽 반만 보이는 clip-path
    - E2E K4: 링 묶음이 평범(쌓임 맥락 없음)·뒤쪽 호 z<0·앞쪽 호가 absolute 이고 캐릭터 그림 다음 순서·두 clip-path 가 위/아래 반·자리가 쌓임 맥락이면 통과, 하나라도 어긋나면 실패하고 이유를 말한다
    - 밤 문구: 같은 epoch 에서 비밤 → 밤이면 `.mf-nightintro`(aria-hidden, `N일차` + `밤이 되었습니다`)가 뜨고 정확히 2000ms 에 사라진다(1999ms 에는 있다). 처음 마운트가 밤이거나, 단계와 epoch 가 함께 바뀌었거나(재접속), 밤 안에서 view 만 바뀌는 다시 그리기에는 뜨지 않거나 타이머가 연장되지 않는다. 밤을 벗어나면 즉시 사라지고 다음 밤(일차 증가)에 다시 뜬다. 역할 4종·탈락자 모두 같은 글자
    - E2E N6: 밤 진입 직후 `.mf-nightintro` 가 있고 글자 [N일차, 밤이 되었습니다], pointer-events none, aria-hidden 이면 통과. N7: 3.5초 안에 DOM 에서 사라짐
  </behavior>
  <action>
    진행 순서는 가(RED) → 나(GREEN) → 다(RED) → 라(GREEN) 이고 네 개의 커밋이다. 두 건 사이 공유 파일(`scripts/e2e/lib.mjs`, `browser.mjs`, `flows.mjs`, `lib.test.mjs`)은 각 건이 자기 부분만 고친다.

    가. U-02 RED — 테스트만 먼저 고쳐 실패를 확인하고 `test(qvx): 차례 링을 뒤쪽 호·앞쪽 호로 나누는 기준` 으로 커밋한다.
    - `test/client/dayTable.test.tsx`: 차례 describe 의 구조 테스트를 위 behavior 첫 항목대로 더한다(두 호의 클래스 이름은 `mf-dt__spot-arc mf-dt__spot-arc--back` / `mf-dt__spot-arc mf-dt__spot-arc--front`, 묶음 `.mf-dt__spot` 은 차례 자리마다 한 개 — 기존 개수 단언 `spotEls(...).length` 는 그대로 유효하다). 내 자리가 차례일 때 내 링과 차례 링이 둘 다 있는 기존 단언도 유지. 차례 자리가 있어도 이름표 z 최댓값 < 자리 z 최솟값(D3a 의 단위 버전)이 4~8명 모두 참인 테스트를 더한다. CSS 규약 테스트: 옛 `.mf-dt__spot` 단언(폭 140%·높이 24%·border 3px·pointer-events)을 새 규칙에 맞게 나눈다 — 묶음에는 폭·높이·left·bottom·pointer-events·「쌓임 맥락 없음」(transform|z-index|opacity|filter|isolation|animation 선언 없음), 호에는 border 3px solid var(--gray-50)·box-shadow 0 0 18px color-mix(in srgb, var(--gray-50) 75%, transparent)·border-radius 50%·페이드, 뒤쪽 호 z-index -1·clip-path inset(-24px -24px 50% -24px), 앞쪽 호 clip-path inset(50% -24px -24px -24px)·음수 z-index 없음, 축소 모션 규칙이 호의 animation 을 끈다. 빛이 잘리지 않도록 clip-path 바깥 방향 음수 여백(24px > 빛 18px)을 쓰는 이유를 테스트 주석에 한 줄 적는다.
    - `scripts/e2e/lib.test.mjs`: `turnChecks` 의 K4 테스트(통과 픽스처 하나와 위 behavior 의 각 어긋남 — 묶음이 평범하지 않음, 뒤쪽 호 z 가 0 이상이거나 없음, 앞쪽 호가 그림보다 앞 순서, clip-path 가 반대, 자리가 쌓임 맥락이 아님, ring 정보 자체가 없음 — 마다 실패)를 더한다. K4 는 차례가 있는 상태(expectNone 아님)에서만 돌고, expectNone 일 때는 반환 목록이 K1 하나로 그대로여야 한다(기존 테스트 유지). 기존 K1·K2 테스트는 K4 를 읽지 않는다.
    - 실행해 실패(구조/CSS/K4 부재)를 확인한 뒤 커밋.

    나. U-02 GREEN — `feat(qvx): 차례 링 뒤쪽 호는 캐릭터 뒤, 앞쪽 호는 캐릭터 앞 (결정 0028)` 로 커밋.
    - `src/components/DayTable.tsx`: 차례 자리의 `<span className="mf-dt__spot" />` 한 개를 묶음 `.mf-dt__spot` 안에 뒤쪽 호·앞쪽 호 두 span 이 든 구조로 바꾼다. 마크업 순서는 `Figure` → (동료/내 링·왕관) → 묶음 → 말풍선 배지 그대로여야 한다(앞쪽 호가 그림 뒤 순서). 묶음에 aria-hidden 을 새로 달지 않는다(E2E G2 가 보던 요소 집합을 줄이지 않기 위해). 머리 주석에 링이 앞뒤로 나뉜다는 한 줄을 더한다.
    - `src/styles/daytable.css`: 머리 z-index 주석에 「발밑 링은 자리 안 쌓임 맥락에서 뒤쪽 호 z -1, 앞쪽 호는 그림 위. 바깥 규칙(이름표 1~11·캐릭터 12~22·어둡게 층 30·유령 31·이모티콘 60+)은 불변」 을 더한다. `.mf-dt__spot` 은 옛 transform 가운데 맞춤을 지우고 `left:-20%`(= 50% − 폭 140%/2)와 `bottom: calc(-4px - 12%)`(= 옛 bottom −4px 과 translateY(50%) 의 합 — 높이 24% 의 절반)로 같은 위치를 만든다. 묶음은 쌓임 맥락을 만들지 않는다(transform·z-index·opacity·filter·isolation·animation 없음). 두 호는 `position:absolute; inset:0` 로 묶음을 채우고 border 3px solid var(--gray-50)·box-shadow·border-radius 50%·옛 링의 페이드 애니메이션을 가진다(링 두께·색·크기·빛은 그대로). 뒤쪽 호는 `z-index:-1` 과 위쪽 반만 보이는 clip-path, 앞쪽 호는 아래쪽 반만 보이는 clip-path(테스트가 정한 값). 축소 모션 규칙의 옛 링 선택자를 호 선택자로 바꾼다. 위치·크기 숫자는 UI-SPEC 의 링 값이며 `src/game/dayTable.ts` 숫자는 건드리지 않는다.
    - `scripts/e2e/browser.mjs`: `collectSnapshot` 의 `turn` 객체에 `ring` 을 더한다 — 첫 `.mf-dt__spot` 이 없으면 null, 있으면 `{ plain, back, front, figBeforeFront, seatContext }`. `plain` = 묶음의 계산된 position absolute·z-index auto·transform none·opacity 1·filter none·isolation auto·clip-path none·animation-name none·will-change auto·mix-blend-mode normal 모두 참. `back`/`front` = 각 호의 `{ z(계산된 z-index 정수, auto 면 null), position, clip(계산된 clip-path 문자열) }`. `figBeforeFront` = 같은 자리의 `img.mf-figure` 가 앞쪽 호보다 문서 순서에서 앞(`compareDocumentPosition`). `seatContext` = 자리 요소의 계산된 z-index 가 유한한 정수. 문자열·값만 싣고 토큰·프레임은 싣지 않는다.
    - `scripts/e2e/lib.mjs`: `turnChecks` 가 차례가 있는 상태에서 `K4`(라벨 「차례 링이 캐릭터 뒤·앞 반으로 갈라짐」)를 K1 다음에 돌려준다. 판정: ring 있음, `plain`, 뒤쪽 호 z < 0, 앞쪽 호 z 가 음수 아님·position absolute·`figBeforeFront`, 뒤쪽 clip 은 `inset(<a> <b> 50% <c>)` 꼴(아래쪽이 50%), 앞쪽 clip 은 `inset(50% <a> <b> <c>)` 꼴(위쪽이 50%), `seatContext`. 로컬 실측 clip-path 문자열 모양이 정규식과 다르면(브라우저가 정규화한 경우) 정규식을 실측에 맞추되 「위/아래 반」 의미는 지킨다. `flows.mjs` 는 `recAll(turnChecks(...))` 가 이미 모든 결과를 쌓으므로 고치지 않는다.
    - 실행: `npx vitest run test/client/dayTable.test.tsx test/client/dayScene.test.tsx` 와 `node --test scripts/e2e/lib.test.mjs` 가 통과하고, `src/game/dayTable.ts` 는 바뀌지 않아야 한다.

    다. U-03 RED — `test(qvx): 밤 시작 문구의 기준` 으로 커밋.
    - 새 파일 `test/client/nightIntro.test.tsx`: `dayScene.test.tsx` 의 view 픽스처 방식(`makeView`·`conn`)을 이 파일 안에 최소로 옮겨 쓴다. behavior 의 밤 문구 항목을 하나씩 테스트한다 — (1) 토론 → 밤 같은 epoch 에서 `.mf-nightintro` 가 있고 글자에 `1일차`·`밤이 되었습니다`, `aria-hidden="true"`, 장면 제목 h1 은 여전히 한 개(`밤`), (2) 처음 마운트가 밤이면 없음, (3) 단계와 epoch 가 함께 바뀌면 없음, (4) 가짜 타이머로 1999ms 에는 있고 2000ms 에는 없음 + `NIGHT_INTRO_MS` 가 `shared/game/phases` 의 `DAY_ANNOUNCE_MS` 와 같음, (5) 1000ms 에 같은 밤의 새 view 로 다시 그려도 2000ms 에 사라짐(타이머가 연장되지 않음)과 사라진 뒤 다시 그려도 돌아오지 않음, (6) 밤 → 아침으로 가면 즉시 사라지고 2일차 다음 밤에는 `2일차` 로 다시 뜸, (7) 역할 4종과 탈락자 view 에서 글자가 같음(역할 유출 없음), (8) `src/styles/night.css` 규칙 테스트: `.mf-nightintro` 는 position absolute·inset 0·pointer-events none·z-index 가 0 보다 크고 `--z-overlay`(50)보다 작은 정수(DayTable 위, [테스트] 닻과 토스트 — 둘 다 50 — 아래), 제목 번짐은 `var(--dur-slow)`·`var(--ease-out)`, 퇴장 지연은 인라인 변수에서 받음, 이 규칙들 안에 `prefers-reduced-motion` 개별 처리가 없고(낮 시작 발표처럼 `base.css` 전역 규칙에 맡김 — 그 전역 규칙 존재도 확인), 코드 줄에 `#` 색 값이 없음.
    - `scripts/e2e/lib.test.mjs`: 새 순수 함수 `nightIntroChecks(intro)`(id N6) 테스트 — 통과 픽스처 `{ texts: ["1일차","밤이 되었습니다"], pointerEvents: "none", ariaHidden: true }` 와, null·글자 다름·pointerEvents auto·aria-hidden 아님이 각각 실패.
    - 실행해 실패를 확인하고 커밋.

    라. U-03 GREEN — `feat(qvx): 밤이 시작되면 '밤이 되었습니다' 가 한 번 뜬다 (결정 0028)` 로 커밋.
    - 새 `src/components/NightIntro.tsx`: `NIGHT_INTRO_MS = DAY_ANNOUNCE_MS`(shared/game/phases 에서 import — 길이가 낮 시작 발표와 한 곳에서 같다)를 export 하고, `NightIntro({ n, onDone })` 를 만든다. 마크업: 루트 `div.mf-nightintro`(`aria-hidden="true"`, 인라인 변수 `--mf-nightintro-exit-delay` = `NIGHT_INTRO_MS - 300` ms — MorningCard 의 지연 변수 방식), 그 안에 `div.mf-nightintro__veil`(막)과 `div.mf-nightintro__center`(가운데 쌓기) > `p.mf-t-heading.mf-nightintro__count`(`N일차`) + `p.mf-t-display.mf-nightintro__title`(`밤이 되었습니다`). 제목 요소(h1)는 쓰지 않는다 — 장면 제목 h1 과 겹치고 E2E D1 이 위쪽 바의 h1 만 본다. 해제 타이머는 마운트 때 한 번만 건다: `onDone` 은 ref 로 쥐어 부모가 다시 그려도 타이머가 리셋·연장되지 않게 하고, 언마운트 때 `clearTimeout`. 문구는 어떤 view 값도 읽지 않는다(`n` 만).
    - `src/styles/night.css`(이미 DayScene 이 import): `.mf-nightintro` — `position:absolute; inset:0; z-index:40`(DayTable 루트는 `isolation:isolate` 로 자기 안의 z 값을 가두니 그 위, [테스트] 닻과 `.mf-toast` — 둘 다 `--z-overlay` 50 — 아래라 문구가 떠 있어도 [테스트] 버튼과 선택 거부 토스트는 가려지지 않는다. 시트(dialog)는 최상위 레이어), flex 세로 가운데(`gap: var(--space-sm)`, 아래 여백 `var(--space-3xl)` — 낮 시작 발표의 `.mf-day__center` 와 같은 배치), `text-align:center`, `pointer-events:none`, 퇴장은 마지막 300ms 의 opacity 1→0(`animation: mf-nightintro-out 300ms linear var(--mf-nightintro-exit-delay) forwards`). 막은 낮 시작 발표 `.mf-day__morning` 과 같은 방사형 기하(70% 55% at 50% 38%)에 색만 `var(--night-950)`(중앙 불투명도 85% — 뒤의 테이블이 어렴풋이 보이게; 디자인 재량이며 사용자가 실기기에서 보고 바꾸라 하면 이 값만 고친다)이고 `opacity 0→1`을 `var(--dur-slow)` `var(--ease-out)` 로 번진다. 제목은 `.mf-day__title` 과 같은 번짐(opacity 0→1 + scale 1.04→1, `var(--dur-slow)`, `var(--ease-out)`), 글자에 `var(--shadow-text)`. 키프레임 이름은 `mf-nightintro-*` 로 따로 둔다. 색 값을 직접 쓰지 않고 토큰 변수만 쓴다. 축소 모션 개별 규칙은 두지 않는다(전역 규칙이 지속 시간을 0.01ms 로 만들고 지연은 남아 1700ms 에 사라진다 — 낮 시작 발표와 같은 처리).
    - `src/screens/DayScene.tsx`: 기존 `prevPhase` 렌더 중 조정 블록을 확장한다. 이전 epoch 를 기억하는 상태를 더하고, 단계가 바뀌는 렌더에서 `view.phase === "night" && prevPhase !== "night" && epoch 불변` 일 때만 밤 문구 상태(일차 `n`)를 켠다. 그 밖의 단계 변화(밤을 벗어남 포함)나 epoch 변화에서는 끈다. 처음 마운트는 `prevPhase` 초기값이 현재 단계라 켜지지 않는다. 문구 상태가 있으면 `NightIntro` 를 장면 루트 안(Toast 다음)에 렌더하고 `onDone` 에서 끈다. `PHASE_ANNOUNCE`·RoomScreen·서버 코드는 건드리지 않는다.
    - E2E: `browser.mjs` 에 `readNightIntro(page)` 를 export — `.mf-nightintro` 가 없으면 null, 있으면 `{ texts(자식 p 의 글자 배열), pointerEvents(계산된 값), ariaHidden(boolean), rect }`. `lib.mjs` 에 `nightIntroChecks(intro)`(N6, 라벨 「밤 시작 문구가 한 번 보임」: 있음·글자 [N일차, 밤이 되었습니다] 형식 `^\d+일차$`·pointerEvents none·aria-hidden)을 더한다. `flows.mjs` 의 `gameFlow` 밤 상태: `skipTo(night)` 직후 `settle` 전에 `readNightIntro` 로 N6 을 기록하고, 밤 상태의 나머지 검사(스냅숏 G·D, 밤 정적 검사, 선택 동작)는 문구가 아직 떠 있을 수 있는 시점에 그대로 돌려 문구가 터치·검사를 방해하지 않는 것을 함께 증명한 뒤, 밤 상태 끝에서 `.mf-nightintro` 가 DOM 에서 사라지길 3.5초 안에 기다려 N7(라벨 「밤 시작 문구가 사라짐」)을 기록한다(`attempt` 사용).
    - 실행: `npx vitest run test/client/nightIntro.test.tsx test/client/dayScene.test.tsx test/client/nightScene.test.tsx test/client/roomScreen.test.tsx` 와 `node --test scripts/e2e/lib.test.mjs` 가 통과해야 한다.
  </action>
  <verify>
    <automated>npx vitest run test/client/dayTable.test.tsx test/client/dayScene.test.tsx test/client/nightIntro.test.tsx test/client/nightScene.test.tsx test/client/roomScreen.test.tsx && node --test scripts/e2e/lib.test.mjs && npm run typecheck && grep -c "mf-dt__spot-arc--back" src/styles/daytable.css src/components/DayTable.tsx && grep -c "밤이 되었습니다" src/components/NightIntro.tsx && git diff --quiet bce014f -- src/game/dayTable.ts shared/game worker</automated>
  </verify>
  <done>차례 자리의 링이 뒤쪽 호(캐릭터 뒤)·앞쪽 호(캐릭터 앞)로 갈라져 그려지고 크기·두께·색·빛·위치와 다른 z 규칙은 그대로다(D3a 불변 통과, E2E K4 가 구조를 증명). 밤 진입 때만 '밤이 되었습니다' 가 낮 시작 발표와 같은 길이·방식으로 한 번 뜨고 사라지며, 재접속·새로 마운트·밤 안 다시 그리기에는 뜨지 않고 터치를 막지 않는다. 서버 코드와 `src/game/dayTable.ts` 는 바뀌지 않았다. RED/GREEN 커밋쌍이 두 건 각각 있다.</done>
</task>

<task type="auto" tdd="true">
  <name>과제 3: 대기실·역할 배정 표시 슬롯을 고르게 퍼지는 고정 순서로 (U-04)</name>
  <files>test/unit/seatLayout.test.ts, test/client/table.test.tsx, shared/seatLayout.ts, src/components/Table.tsx</files>
  <read_first>shared/seatLayout.ts, src/components/Table.tsx, test/unit/seatLayout.test.ts, test/client/table.test.tsx, src/screens/Lobby.tsx, src/screens/Assigning.tsx, shared/game/room.ts (lowestFreeSeat — 읽기만)</read_first>
  <behavior>
    - 표시 슬롯 순서: 좌석 0..7 → 슬롯 0,4,2,6,1,5,3,7 (SPREAD_ORDER). 나 기준으로 돌린다: `slot = (spreadSlot(seat) - spreadSlot(mySeat) + 8) % 8`. 나는 늘 slot 0 = 맨 아래 가운데(x 50, y 72, scale 1, z 10)
    - 2명(좌석 0·1, 누가 나여도): 상대는 slot 4 = 맨 위 가운데(마주 봄). 3명(좌석 0·1·2, 누가 나여도): 세 슬롯의 원형 최소 간격 ≥ 2이고 세 점이 한 직선이 아님(삼각). 4명: 슬롯이 0·2·4·6 집합
    - 좌석 0..7 전체로 슬롯이 0~7 을 한 번씩 쓰고 좌표가 모두 다르다(어느 mySeat 에서도)
    - 안정성: 같은 (seat, mySeat) 는 누가 더 있든 없든 같은 좌표다 — Table 컴포넌트에서 좌석 1을 비워도(null) 좌석 0·2 의 left/top 이 그대로
    - total 이 8 이 아닐 때와 rx·ry 인자는 지금 동작 그대로 (`seatLayout(0, 0, 8, 30, 10).y` ≈ 60)
  </behavior>
  <action>
    진행 순서는 RED 커밋 → GREEN 커밋이다. 이 과제는 서버 좌석 번호(`shared/game/room.ts` 의 `lowestFreeSeat` 등)와 낮 `DayTable` 배치(`src/game/dayTable.ts`)를 읽기만 하고 바꾸지 않는다(사용자 지시 U-04).

    가. RED — `test(qvx): 대기실 표시 슬롯이 고르게 퍼지는 기준` 으로 커밋.
    - `test/unit/seatLayout.test.ts`: 새 순서를 가정하도록 고친다. 「이웃 자리의 slot 차이는 항상 1」 테스트는 「slot 은 나 기준으로 돈 표시 슬롯: `(spreadSlot(seat) - spreadSlot(mySeat) + 8) % 8` 와 같고 SPREAD_ORDER 가 [0,4,2,6,1,5,3,7]」 로 바꾼다. 「맞은편 자리」 테스트는 mySeat 3 기준 맞은편이 좌석 2 (spreadSlot(3)=6, 맞은편 슬롯 (6+4)%8=2)임을 기대하도록 고친다. 대칭 테스트(slot k 와 8−k)는 좌표가 슬롯으로만 정해지므로 seat 대신 「해당 slot 인 좌석」 을 찾아 비교하도록 고친다. 내 자리 맨 아래·8자리 좌표 모두 다름·rx/ry 인자 테스트는 유지. 새 테스트: 2명(어느 쪽이 나여도 상대 slot 4), 3명(세 mySeat 각각 최소 원형 슬롯 간격 ≥ 2, 세 좌표 비공선: 외적 ≠ 0), 4명(슬롯 집합 {0,2,4,6}), 한 명이 빠져도 나머지의 (seat, mySeat) 좌표가 그대로.
    - `test/client/table.test.tsx`: 내 자리 맨 아래 가운데 테스트는 그대로 통과해야 하고(좌석 1 이 나, 좌석 0 은 마주 보는 맨 위), 새 테스트 둘을 더한다 — (i) 좌석 0·1·2 에 세 명, 내가 좌석 0 일 때 세 인물의 left/top 퍼센트가 서로 달라 한 직선이 아님, (ii) 좌석 1 을 null 로 바꿔 다시 그려도 좌석 0·2 요소의 style left/top 이 그대로.
    - 실행해 실패(새 순서 부재)를 확인하고 커밋.

    나. GREEN — `feat(qvx): 대기실 자리가 한 명씩 이웃하지 않고 고르게 퍼진다 (결정 0028)` 로 커밋.
    - `shared/seatLayout.ts`: 길이 8 의 `SPREAD_ORDER`(좌석 번호 → 절대 슬롯, 비트반전 순서 0,4,2,6,1,5,3,7)와 `spreadSlot(seat, total)` 을 export 한다(total 이 `SEAT_COUNT` 일 때만 표를 쓰고 범위 밖이거나 다른 total 이면 좌석 번호 그대로 — 다른 total 의 옛 동작을 지킨다). `seatLayout` 의 `slot` 계산을 `(spreadSlot(seat) - spreadSlot(mySeat))` 의 total 나머지로 바꾸고 좌표·scale·z·depth 식은 그대로 둔다. 파일 머리 주석에 「표시 전용 순서이며 서버 좌석 번호와 무관, 좌석 번호만으로 정해져 빈 자리가 생겨도 다른 사람이 움직이지 않는다」 를 적는다.
    - `src/components/Table.tsx`: 로직은 `seatLayout(i, mySeat)` 호출이 그대로 새 순서를 받으므로 코드 변경은 없다. 머리 주석의 좌표 설명 문장 뒤에 표시 슬롯 규칙 한 줄만 더한다.
    - `seatLayout` 의 다른 사용처가 없음을 다시 확인한다(`grep -rn "seatLayout" src shared worker`: 정의와 `Table.tsx` 뿐이어야 한다). `Lobby.tsx`·`Assigning.tsx` 는 좌석 번호로 배열을 채우므로 고치지 않는다.
  </action>
  <verify>
    <automated>npx vitest run test/unit/seatLayout.test.ts test/client/table.test.tsx test/client/lobby.test.tsx test/client/screens.test.tsx && npm run typecheck && grep -c "SPREAD_ORDER" shared/seatLayout.ts && git diff --quiet bce014f -- shared/game worker src/game/dayTable.ts</automated>
  </verify>
  <done>대기실·역할 배정 화면에서 2명은 마주 보고 3명은 삼각으로 보이며, 나는 늘 맨 아래 가운데이고 빈 자리가 생겨도 다른 사람은 움직이지 않는다. 서버 좌석 번호·낮 DayTable·차례 순서 코드는 바뀌지 않았다. RED/GREEN 커밋쌍이 있다.</done>
</task>

<task type="auto">
  <name>과제 4: 결정 0028·UI-SPEC·HANDOFF → 전체 검증 → 배포 → 배포본 확인 → push (U-05)</name>
  <files>docs/decisions/0028-test-feedback-fixes.md, .planning/phases/03.1-sequential-claims-role-card/03.1-UI-SPEC.md, HANDOFF.md</files>
  <read_first>docs/decisions/0027-sequential-claims-wire.md (형식), HANDOFF.md 상단 3.1 항목과 실기기 확인 목록, .planning/phases/03.1-sequential-claims-role-card/03.1-UI-SPEC.md, scripts/prod-url.txt, wrangler.jsonc</read_first>
  <precondition>과제 1~3 의 커밋이 모두 있고 `npx vitest run`·`node --test scripts/e2e/lib.test.mjs` 가 통과한다. 배포 단계에 들어가기 전 `npx wrangler whoami` 출력에 dhkim1522@naver.com 이 있고 `wrangler.jsonc` 의 name 이 minifia 이다 — 하나라도 아니면 배포하지 않고 멈춘다.</precondition>
  <action>
    가. 문서(`docs(qvx): …` 한 커밋).
    - `docs/decisions/0028-test-feedback-fixes.md` 를 짧게 쓴다(형식은 0027: 제목, 상태 채택, 날짜 2026-10-25, 배경, 결정, 결과). 배경: 2026-10-25 실기기 테스트 피드백 4건, 낮 테이블·역할 배정 늘어남은 시안 진행 중이라 범위 밖. 결정 네 가지 — (1) 밤 끝 알림 제거(결정 0026-6 의 알림 조항을 대체, 앰버 점·탭 점·NEW 유지, UI-SPEC R6·S13 폐기, E2E R6 은 알림 없음 검사로), (2) 차례 링을 자리 쌓임 맥락 안에서 뒤쪽 호 z −1·앞쪽 호 그림 위로 나눔(크기·두께·색·빛 불변, 바깥 z 규칙 불변, E2E K4), (3) 대기실·역할 배정 표시 슬롯 = 좌석 번호만으로 정해지는 비트반전 순서에 나를 맨 아래로 회전(서버 좌석 번호·낮 DayTable·차례 순서 불변, 알려진 한계: 대기실과 낮의 시계 방향 순서가 다르다 — 기하 통일은 시안 뒤), (4) 밤 시작 문구는 클라이언트 오버레이(서버 단계·시간·와이어 불변, 길이 = DAY_ANNOUNCE_MS, 같은 epoch 의 비밤 → 밤에서만, 재접속·새로 마운트 제외, 막 색·중앙 불투명도 85% 는 디자인 재량). 결과에 되돌리기 비용(모두 화면 한 곳을 고치면 되는 쉬운 변경)과 아티팩트 동기화 목록(화면설계서의 R6 알림 화면 삭제, 차례 링 앞뒤 층, 밤 시작 문구, 대기실 자리 순서; 디자인 세션 몫)을 적는다.
    - `03.1-UI-SPEC.md`: `grep -n "알림\|R6\|S13\|S10\|nb-toast\|rolecard-toast\|toast\|F4" ` 로 모든 알림 관련 줄을 찾아 정리한다 — 필수: Spacing 예외 표의 S10(알림 위치)·S13(좁은 폭 알림 여백)을 폐기 표시 또는 삭제, D 절의 밤 끝 알림 문단 삭제(사용자 지시 「R6·S13·링」), 열기 설명의 「알림을 누르면 활동 기록 탭」 삭제, E2E 표의 R6 행을 「밤 끝 알림이 화면에 없음(결정 0028)」 으로 교체, 확정 F4(눌리는 알림)·모션 표의 알림 행·Copywriting 의 알림 문구 행·상태 표(empty/partial/overflow/phase-change/reconnect)의 알림 언급·아티팩트 동기화 목록의 R6 알림 언급·입력/크기 목록(`DayScene` 변경 설명, 누르기 영역 44 목록, 간격 sm/md 설명, 글자 표의 알림 글자, 앰버 예약 설명)의 알림 언급을 고친다. 링: B 절 「테이블」 의 `.mf-dt__spot` 설명을 새 구조(묶음 + 뒤쪽/앞쪽 호, `left:-20%`·`bottom: calc(-4px - 12%)`, 크기·두께·빛 불변, 뒤쪽 호 z −1·앞쪽 호 그림 위)로 바꾸고, 「이름표 층 순서」 표에 「링 뒤쪽 호 / 앞쪽 호: 자리 안(캐릭터 12~22 층 내부)에서 그림 뒤 / 그림 위, 바깥 값 불변」 행을 더하고, E2E 표에 K4 행과 N6·N7 행, D3a 설명 끝에 「차례 링이 있어도 불변」 을 더한다. 밤 시작 문구: 낮 시작 발표와 같은 방식이라는 한 문단(위치·길이·번짐·축소 모션·재접속 제외)과 모션 표 행을 더한다. 대기실 표시 슬롯 규칙은 UI-SPEC 범위 밖(03.1 은 낮 화면)이라 결정 0028 에만 둔다. 문서를 고친 뒤 같은 grep 으로 남은 알림 언급이 의도된 「제거됨」 표기뿐인지 확인한다.
    - `HANDOFF.md`: 「현재 상태」 맨 위에 이번 quick 항목을 더한다(제목에 quick 261025-qvx, 근거 결정 0028). 아직 배포 결과 칸은 비워 두고 아래 다/마 단계에서 채운다. 3.1 항목의 「밤 끝 알림」 언급과 실기기 확인 목록 (6) 의 360폭 알림 문장은 「(qvx 에서 제거)」 로 정리한다. 이번 항목에 새 실기기 확인 목록(차례 링이 캐릭터 발을 감싸 보이는지, 밤 시작 문구가 읽히고 밤 선택을 방해하지 않는지·길이가 적절한지, 대기실에서 2명 마주 봄·3명 삼각·사람이 나가도 안 움직임, 알림 없이도 앰버 점으로 새 기록을 알아차리는지)과 아티팩트 동기화 목록(결정 0028 결과 절과 같은 내용)을 적는다. `CLAUDE.md` 는 고치지 않는다.
    - 커밋 메시지 예: `docs(qvx): 결정 0028 과 UI-SPEC·HANDOFF 를 테스트 피드백 4건에 맞춘다`.

    나. 로컬 전체 검증(코드 변경 없음, 실패하면 원인을 고치고 해당 과제 방식으로 커밋).
    - `npm run typecheck`, `npx vitest run`(전체), `node --test scripts/e2e/lib.test.mjs` 가 모두 통과해야 한다. E2E 불변 상수 테스트(OVERLAP_EPS 0.5·ONE_LINE_FACTOR 1.6·FACE_RATIO 0.45·TAP_MIN 44·PANEL_H 157)와 TEXT_SIZE_ALLOW(.mf-journal__new·.mf-tt* 만) 테스트가 통과하는지 눈으로 확인하고 이 두 군데는 고치지 않는다.
    - 서버·낮 기하 불변 확인: `git diff --stat bce014f -- shared/game worker src/game/dayTable.ts shared/protocol.ts shared/schemas.ts` 가 비어야 한다.
    - 로컬 E2E: 5173 포트가 비어 있는지 확인(`lsof -i :5173`)하고 `npm run dev` 를 백그라운드로 띄워 응답을 기다린 뒤(출력의 실제 주소 사용) `npm run e2e -- --url http://localhost:5173` 를 돌린다. 마지막 줄이 `E2E OK` 여야 한다(흐름 여섯 × 크기 셋 전부 통과, 새 검사 K4·N6·N7·R6 포함). 실패하면 완화하지 말고 원인(앱 결함 또는 새 검사의 측정 오류)을 고친다 — 완화가 허용되는 것은 이미 승인된 M1·D3a/D3b·D4 뿐이다. 끝나면 띄운 dev 서버를 종료한다.

    라. 배포본 확인: `node scripts/smoke.mjs --prod --stage full --players 4`, `--players 5 --previous-version V`, `--players 8` 이 모두 `SMOKE OK full` 이어야 하고, `node scripts/e2e/run.mjs --url https://minifia.dhplay.workers.dev` 마지막 줄이 `E2E OK` 여야 한다. 실패하면 로컬로 되돌려 원인을 고치고 다시 배포한다.
    마. 마무리: `HANDOFF.md` 의 이번 항목에 새 배포 버전(스모크 출력의 version)·게이트 결과(vitest 파일/테스트 수, e2e 흐름/크기 통과, 스모크 3종 도착 편차)를 채우고 `docs(qvx): 배포 결과와 인계를 갱신한다` 로 커밋한다. `git status` 로 추적 안 된 `.planning/milestone.lock` 외 불필요한 파일이 없는지, `git remote -v` 가 개인 원격(git@github.com:dhkim1522/minifia.git)인지 확인한 뒤 `git push origin main` 한다. 이 계획의 `261025-qvx-SUMMARY.md` 를 작성해 함께 커밋·push 한다.
  </action>
  <verify>
    <automated>npm run typecheck && npx vitest run && node --test scripts/e2e/lib.test.mjs && git diff --quiet bce014f -- shared/game worker src/game/dayTable.ts shared/protocol.ts shared/schemas.ts && test -f docs/decisions/0028-test-feedback-fixes.md</automated>
  </verify>
  <done>결정 0028·UI-SPEC·HANDOFF 가 갱신됐고, 로컬 `npm run e2e -- --url http://localhost:5173` 와 배포본 `node scripts/e2e/run.mjs --url https://minifia.dhplay.workers.dev` 가 모두 E2E OK, 배포본 스모크 full 4·5·8명이 모두 SMOKE OK 다. Worker minifia 만 개인 계정(dhkim1522@naver.com)으로 배포됐고, 모든 커밋이 개인 원격 main 에 push 됐다.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| 서버 view → 화면 | 화면은 받은 값만 그린다. 새 화면 요소(링 호·밤 문구·대기실 슬롯)는 역할 정보를 입력으로 받지 않는다 |
| 좌석 번호 → 표시 슬롯 | 대기실 표시 규칙의 입력은 공개된 좌석 번호뿐이다 |
| 개발 PC → Cloudflare 계정 | `npm run deploy` 가 어느 계정·어느 Worker 에 올리는지 |
| 개발 PC → git 원격 | push 대상이 개인 원격이어야 한다 |
| E2E 실행기 → 배포본 | 테스트 방만 만들고 토큰은 출력하지 않는다 |

## STRIDE Threat Register

Threat IDs 는 이 quick 안에서만 고유하다(`T-qvx-NN`). `T-qvx-SC` 는 예약이며 모든 계획이 가진다.

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-qvx-01 | Information Disclosure | 밤 시작 문구(NightIntro) | medium | mitigate | 문구는 `n`(일차)만 입력으로 받고 역할·생존 여부를 읽지 않는다. 역할 4종·탈락자 view 에서 글자가 같다는 단위 테스트(nightIntro.test.tsx) |
| T-qvx-02 | Denial of Service | 밤 시작 문구가 첫 2초 동안 터치를 가림 | medium | mitigate | `pointer-events:none`(CSS 테스트) + 밤 상태 E2E 의 N5(모든 대상 자리 탭 가능)·선택 동작(N2/N3)이 문구가 떠 있는 시점에도 통과, N6 이 pointer-events 를 확인, N7 이 사라짐을 확인 |
| T-qvx-03 | Information Disclosure | 대기실 표시 슬롯(spreadSlot) | low | accept | 입력이 좌석 번호뿐이고 역할·닉네임을 읽지 않는다. Table 입력 타입에 역할 키 없음(기존 타입 테스트 유지) |
| T-qvx-05 | Information Disclosure | E2E·스모크 새 코드(readNightIntro, ring 스냅숏) | low | mitigate | 새 스냅숏은 계산된 스타일·글자·DOM 순서만 읽고 프레임 원문·토큰을 싣지 않는다. 출력은 기존 redact 한 경로만 쓴다 |
| T-qvx-06 | Repudiation | 알림 제거로 새 일지를 알아차리기 어려워짐 | low | accept | [역할 카드] 앰버 점·탭 점·NEW 는 그대로이고 R1~R4 E2E 가 계속 보증한다. 실기기 확인 목록에 「알림 없이 점으로 알아차리는지」 를 넣는다 |
| T-qvx-07 | Tampering | 잘못된 원격으로 push | medium | mitigate | `git remote -v` 가 git@github.com:dhkim1522/minifia.git 인지 확인 후 push. `gh auth setup-git`·`~/.gitconfig` 변경 금지 |
| T-qvx-SC | Tampering | npm/pip/cargo installs | high | accept | 이 계획은 패키지를 설치·추가하지 않는다(package.json·lock 불변). 설치가 필요해지면 멈추고 보고한다 |
</threat_model>

<verification>
- `npm run typecheck`, `npx vitest run`(전체), `node --test scripts/e2e/lib.test.mjs` 통과
- 서버·낮 기하 불변: `git diff --stat bce014f -- shared/game worker src/game/dayTable.ts shared/protocol.ts shared/schemas.ts` 가 비어 있다
- 알림 잔재 없음: `test ! -e src/components/RoleCardToast.tsx`, `test ! -e src/styles/rolecard-toast.css`, 알림 식별자 grep(src·scripts/e2e) 0건
- 로컬 `npm run e2e -- --url http://localhost:5173` → `E2E OK` (K4·N6·N7·R6 포함 전 항목)
- 배포본 `node scripts/smoke.mjs --prod --stage full` 4·5·8명 모두 `SMOKE OK full`, `node scripts/e2e/run.mjs --url https://minifia.dhplay.workers.dev` → `E2E OK`
- `git log` 에 과제 1·2(두 건)·3 각각 RED 커밋 → GREEN 커밋 순서가 보이고, 마지막에 push 된다
</verification>

<success_criteria>
- 사용자 지시 U-01~U-05 가 모두 구현되고, 금지된 변경(서버 규칙·시간·와이어, 좌석 번호, 낮 DayTable 기하, 낮 테이블/역할 배정 시안 작업)이 없다
- E2E 기준 수치와 허용 목록은 낮아지지 않았고 승인 완화 M1·D3a/D3b·D4 외 완화가 없다
- 로컬과 배포본에서 모든 자동 검사가 통과하고, 결정 0028·HANDOFF·UI-SPEC 이 현재 상태와 일치한다
- 실기기 확인 목록과 아티팩트 동기화 목록이 HANDOFF 에 남아 다음 세션이 이어서 확인할 수 있다
</success_criteria>

<output>
Create `.planning/quick/261025-qvx-test-feedback-fixes/261025-qvx-SUMMARY.md` when done
</output>
