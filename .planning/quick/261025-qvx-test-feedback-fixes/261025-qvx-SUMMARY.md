---
phase: quick-261025-qvx
plan: 01
status: incomplete
progress: "4/5 과제 완료 (과제 1·2·3·4 완료, 과제 5 남음)"
commits: 14
plan_head_before: bce014ff68c209d8221bf38a92679a63e4743981
plan_head_after: a82e401f26050a3e54decb5d9bcd1db1dc276d00
completed_tasks: [1, 2, 3, 4]
remaining_tasks: [5]
requirements: [QUICK-261025-qvx]
---

# Quick 261025-qvx: 테스트 피드백 4건 수정 - 진행 체크포인트 (4/5)

> status: incomplete. 이 파일은 4회차까지(과제 1·2·3·4)의 진행 기록이다. 계획은 사용자 개정(2026-10-25)으로 5과제가 되었다(옛 과제 3 비트반전 슬롯 안 폐기 → 과제 3 기하 고정, 과제 4 대기실·배정 통일, 과제 5 문서·검증·배포). 모든 과제가 끝나면 최종 SUMMARY 로 다시 쓴다.

## 완료한 과제

### 과제 1: 밤 끝 알림 완전 제거 (U-01)

| 단계 | 커밋 | 내용 |
|------|------|------|
| RED | 129767c | `test(qvx): 밤 끝 알림이 없다는 기준으로 바꾼다` |
| GREEN | b068558 | `feat(qvx): 밤 끝 알림을 없앤다 (결정 0028)` |

RED 시점 실패 8건(알림 없음 3 + 알림 파일 부재 1 + JOURNAL_TEXT 키 1 + roleCardFlow 3)은 모두 의도한 이유였고, E2E `lib.test.mjs` 는 `noNightNoticeChecks` export 부재로 실패했다. GREEN 후 전부 통과.

- 삭제: `src/components/RoleCardToast.tsx`, `src/styles/rolecard-toast.css`
- `src/screens/DayScene.tsx`: 알림 import·4초 `useToast`·기록 길이 효과 둘·JSX 알림 렌더·선택 props(`roleCardOpen`, `onOpenActivity`) 제거. 선택 거부 토스트용 기본 `useToast()` 는 유지. `useRef` import 제거.
- `src/screens/RoomScreen.tsx`: `onOpenActivity` 와 DayScene 에 넘기던 두 props 제거 (시트 열림·탭 상태와 읽음 처리 효과는 그대로).
- `src/game/journalText.ts`: `notice` 필드 제거 (항목 키는 name·empty 둘뿐).
- E2E: `noticeChecks` -> `noNightNoticeChecks(snap)` (id R6, 라벨 「밤 끝 알림 없음」, `roleCard.noticeTexts` 가 배열이 아니면 `측정값 없음` 으로 실패). `browser.mjs` 는 `roleCard.notice` 대신 `noticeTexts`(보이는 `[role="status"]` 중 `일지가 추가됐어요`/`눌러서 보기` 가 든 글자 배열)를 싣고 `clickNotice` 삭제. `flows.mjs` 는 `roleCardViaNotice`·`rolecard-notice` 상태 삭제, mafia8 은 `rolecard-btn`, `morningRoleChecks` 는 모든 역할(시민 포함)에 R6 을 돌린다.
- 테스트: `dayScene.test.tsx`(알림 describe 둘 -> 「DayScene 밤 끝 알림 없음」), `roleCardFlow.test.tsx`(알림 describe -> 「밤 끝 알림 없음」: 세 역할 앰버 점만, 시민 알림 없음, 버튼 경로로 활동 기록을 열면 점·탭 점 소멸·NEW·읽은 개수 `1` 저장), `journal.test.tsx`(키가 `empty,name` 뿐), `lib.test.mjs`(R6 새 함수 테스트).

### 과제 2: 차례 링 앞뒤 층 분리 (U-02) + 밤 시작 문구 (U-03)

| 단계 | 커밋 | 내용 |
|------|------|------|
| U-02 RED | 4f9589b | `test(qvx): 차례 링을 뒤쪽 호·앞쪽 호로 나누는 기준` |
| U-02 GREEN | aa077bc | `feat(qvx): 차례 링 뒤쪽 호는 캐릭터 뒤, 앞쪽 호는 캐릭터 앞 (결정 0028)` |
| U-03 RED | 8de3ac4 | `test(qvx): 밤 시작 문구의 기준` |
| U-03 GREEN | 133e1c5 | `feat(qvx): 밤이 시작되면 '밤이 되었습니다' 가 한 번 뜬다 (결정 0028)` |

U-02 (링): `.mf-dt__spot` 은 쌓임 맥락이 없는 묶음(left -20%, bottom calc(-4px - 12%), 폭 140%, 높이 24%)이고 안에 `.mf-dt__spot-arc--back`(z-index -1, `clip-path: inset(-24px -24px 50% -24px)`)과 `.mf-dt__spot-arc--front`(`inset(50% -24px -24px -24px)`, 그림 다음 마크업 순서)가 있다. 두께 3px·gray-50·빛 18px·페이드·축소 모션 처리는 그대로 호로 옮겼다. 이름표 1~11·캐릭터 12~22·어둡게 층 30·유령 31·이모티콘 60+ 와 `src/game/dayTable.ts` 는 바뀌지 않았다(D3a 단위 버전 4~8명 통과). E2E K4(`ringChecks`, 스냅숏 `turn.ring`)는 브라우저가 줄여 돌려주는 `inset(a b c)` 꼴도 네 변으로 펼쳐 읽는다. K4 는 차례가 있는 상태에서만 K1 다음에 돈다.

U-03 (밤 문구): 새 `src/components/NightIntro.tsx`(`NIGHT_INTRO_MS = DAY_ANNOUNCE_MS`, 마운트 때 한 번 거는 타이머, `onDone` 은 ref), `src/styles/night.css` 의 `.mf-nightintro`(absolute inset 0, z-index 40, pointer-events none, 막 `--night-950` 85% 방사형, 제목 800ms 번짐, 마지막 300ms 퇴장, 축소 모션 개별 규칙 없음). `DayScene` 의 렌더 중 조정에 `prevEpoch`·`nightIntroN` 을 더해 같은 epoch 에서 비밤 -> 밤일 때만 켠다. 서버·`RoomScreen`·`PHASE_ANNOUNCE` 는 건드리지 않았다. E2E: `readNightIntro`(browser), N6 `nightIntroChecks`(lib), `gameFlow` 밤 상태에서 `skipTo(night)` 직후 N6, 밤 검사 끝에 N7(`.mf-nightintro` 가 3.5초 안에 detached).

### 과제 3: 테이블·캐릭터 기하를 P2 승인값으로 고정 - 상수·규칙, DayTable, 낮·밤·아침, E2E T1·T2 (U-04, 1/2)

| 단계 | 커밋 | 내용 |
|------|------|------|
| RED | 6f15452 | `test(qvx): 테이블 기하를 P2 승인값으로 고정하는 기준` (계획 개정본 PLAN.md 도 함께 커밋) |
| GREEN | 6482625 | `feat(qvx): 테이블·캐릭터 기하를 P2 승인값으로 고정한다 (결정 0028)` |

RED 시점: `test/unit/dayTable.test.ts` 13건 실패(새 API 부재), `lib.test.mjs` 는 `feltGapChecks`·`stageStable`·`SIDE_GAP_MIN`·`HEADER_H` export 부재로 파일 전체 실패, typecheck 는 새 인자·export 부재로 실패. 모두 의도한 이유였다. `test/client/dayTable.test.tsx` 6건도 새 규칙(left 75·width 216, scenePad, 동기 측정) 때문에 실패했다.

- `src/game/dayTable.ts`: 상수 `SEAT_RX_MIN` 124 · `SEAT_RX_MAX` 150 · `RX_TAG_HALF` 49 · `FELT_SIDE` 38 · `SCENE_PAD_DEFAULT` 12 · `SCENE_PAD_NARROW` 4 와 `seatRx(장면 폭, 여백)` · `feltWidthOf(rx)` 를 export 한다. `dayTableGeometry(w, h, pad)` 와 `daySeatLayout(…, pad)` 는 여백 인자(기본 12)를 받는다. 옛 상수 `SEAT_RX`·`SEAT_RX_NARROW`·`NARROW_SCENE_BELOW`·`FELT_W`·`FELT_W_NARROW` 는 삭제했고 다른 사용처는 없었다. 캐릭터 72×96·k0 0.8·ry 100·cy 최대 210/최소 177 과 적응 규칙·면 높이 108·이름표 높이 22·z 규칙은 그대로다. 머리 주석에 출처(P2, 결정 0028)·산술 표·이름표 여유 49 의 칼날 경계(대안 49 → 50)를 적었다.
- `src/components/DayTable.tsx`: `scenePad?: number` prop. 없으면 루트의 계산된 `--mf-scene-pad` 를 읽고(숫자가 아니면 12) 크기 관측 콜백마다 다시 읽는다. 마운트 직후 한 번 `getBoundingClientRect` 로 동기 측정해 첫 페인트부터 실제 크기로 그린다. `daytable.css`·마크업·z-index·링 구조는 건드리지 않았다(여백 변수는 이미 `.mf-dt` 에 있었다).
- E2E: `lib.mjs` 에 `SIDE_GAP_MIN` 4 · `HEADER_H` 119.2 · `feltGapChecks`(T2, 타원 현 기준 간격, 측정값 없으면 실패) · `stageStable`(T1, 장면 상자·면·내 캐릭터 ±0.5, 머리 119.2, 패널 157, 패널 위 = 장면 아래, 내 자리 spotlit 이면 내 캐릭터 비교만 건너뜀). `browser.mjs` 에 `readStage(page)`(낮·대기실·배정 선택자 모두 읽음, 글자·토큰 없음). `flows.mjs` 의 `dayState` 가 `readStage` 로 T2 를 기록하고 항목에 `stage`·`mySeat` 를 싣고, `gameFlow`·`specFlow` 끝에 D7·D9 옆으로 T1 을 기록한다. 기존 판정 코드와 기준 수치는 바뀌지 않았다.
- 산술 확인: 계획 산술 표가 단위 테스트로 그대로 재현됐다(rx 131/138/146/150, 면 폭 186/200/216/224, 면 left 83/83.5/75/91, 장면 안 최소 여백 12.6/13.1/4.6/20.6, 99px 이름표 폰 가장자리 여유 -0.5/0.0/-0.5/15.5, 양옆 간격 최소 6.2~6.3). 숫자 불일치 없음.
- 단위 테스트(`test/unit/dayTable.test.ts`)의 기준: 폰 네 가지 x 높이 네 가지(299.8·363.8·387.8·655.8) x 1~8명에서 캐릭터 상자가 장면 안·양옆 간격 4 이상, 여백 4 쪽 장면 폭 340~381 과 여백 12 쪽 366~406 의 모든 정수 폭 x 1~8명에서 99px 이름표가 폰 가장자리 안(허용 -0.5)·100px 이름표끼리 겹침 0.5 이하·간격 4 이상, 등간격·내 자리 맨 아래 가운데·2명 마주 봄·3명 삼각. 옛 D2 단언(장면 기준 왼쪽 여백 1.0)은 폰 기준 -0.5 로 옮겼다(E2E G2·D2 가 재는 틀이며, 임계값을 낮춘 것이 아니라 5글자 이름표가 양옆 자리에서 장면 밖으로 나가는 P2 값에 맞춘 것이다. 주석에 이유 한 줄).

부분 로컬 E2E(코드 변경 없이): `npm run dev` 를 띄워 `npm run e2e -- --url http://localhost:5173 --only mafia8` 와 `--only citizen4`, 그리고 참고로 전체 `npm run e2e` 까지 돌렸다.

| 실행 | 360x640 | 390x664 | 430x932 | 결과 |
|------|---------|---------|---------|------|
| `--only mafia8` | 101/101 | 101/101 | 101/101 | E2E OK |
| `--only citizen4` | 96/96 | 96/96 | 96/96 | E2E OK |
| 전체(lobby·citizen4·police5·mafia8·doctor5·spec4) | 전부 통과 | 전부 통과 | 전부 통과 | E2E OK (145초) |

D1~D9·D3a·D3b·D4·G·T1·T2·M·K·N6·N7·R6 전부 통과했다. 이 회차에서 K4·N6·N7 이 처음 실제 브라우저로 확인됐다(통과). 이름표 보이는 비율 바닥(4·5명 100 %, 6명 85 %, 7명 50 %, 8명 55 %)과 D3a 는 한 번도 완화하지 않았고 실패도 없었다. 이 단계에서 T1 은 낮·밤·아침만 비교한다(대기실·배정은 과제 4 에서 더한다). 로컬 dev 서버는 PID 로 종료했고 5173 포트를 비웠다.

### 과제 4: 대기실·역할 배정을 같은 DayTable·장면 상자로 통일 (U-04, 2/2)

| 단계 | 커밋 | 내용 |
|------|------|------|
| RED | 19946de | `test(qvx): 대기실·배정을 같은 테이블과 장면 상자로 통일하는 기준` |
| GREEN | a82e401 | `feat(qvx): 대기실·역할 배정도 같은 테이블과 장면 상자를 쓴다 (결정 0028)` |

RED 시점: vitest 37건(DayTable 확장 7·`lobby.test.tsx`·`phaseScreens` S-04·`stageBox.test.tsx` 의 CSS 값)이 의도한 이유(전이 클래스·`onPress`·`slide`·옛 Table 마크업·CSS 값 부재)로 실패했고, `lib.test.mjs` 는 `lobbyShapeChecks` export 부재로 파일 전체가 실패했으며 typecheck 는 새 prop·필드 부재로 실패했다. 옛 `table.test.tsx`·`test/unit/seatLayout.test.ts` 는 RED 커밋에서 삭제하고(Icon 11건은 `icon.test.tsx` 로 이동, `Table` 단언은 DayTable·로비 테스트로 이동) `DayTableSeat` 역할 키 타입 테스트는 이미 있어 유지했다.

- `src/components/DayTable.tsx`: 자리 입력에 `transition?: "entering" | "leaving" | null`·`onPress?` 와 prop `slide?` 를 더했다. 전이는 자리에 `mf-dt__seat--enter/--leave`, 이름표에 `mf-dt__tag--enter/--leave` 를 붙이고, `onPress` 자리는 `button.mf-dt__seat.mf-dt__seat--pick`(읽기 이름 = 자리 읽기 이름, `aria-pressed` 없음)이다. 핸들러 우선순위는 `onPick` > `onInspect` > `onPress`. `slide` 는 마운트 직후 첫 프레임에는 켜지 않고 `requestAnimationFrame` 한 번 뒤에 루트에 `mf-dt--slide` 를 붙인다(언마운트 때 취소).
- `src/styles/daytable.css`: 옛 대기실의 입장(`--dur-med`)·퇴장(지역 상수 `--mf-seat-leave-ms` 320ms) 키프레임을 옮겨 왔다(그림 `.mf-figure` 만 움직여 자리 scale 과 곱해지지 않고 이름표는 페이드). `.mf-dt--slide` 에서 자리 left·top·transform, 이름표 left·top 을 `var(--dur-med) var(--ease-out)` 로 전이한다. 축소 모션에서는 입장·퇴장 애니메이션·미끄러짐 전이가 모두 꺼진다.
- `src/screens/Lobby.tsx`: 옛 `Table`·`SEAT_COUNT` 대신 `DayTable`(`slide`)을 쓴다. 자리 입력은 `useSeatTransitions` 가 돌려준 `seated`(퇴장 중 포함)에서 만든다 — 좌석·닉네임·연결·방장·나·동료(`me.allies`)·`transition`, 방장이 끊긴 다른 사람(퇴장 중 아님) 자리에만 `onPress`(기존 내보내기 확인 시트). 서버 좌석 번호·낮 차례 순서는 바뀌지 않았다(n 명이 번호 순서로 고르게 앉는 것은 `daySeatLayout` 의 기존 규칙).
- `src/screens/Assigning.tsx`: 머리 `.mf-assign__bar`(제목 `역할 배정` 하나), 장면 상자 `.mf-assign__scene` 안 `DayTable`(역할·동료 없음), 빈 패널 `.mf-assign__panel` 을 둔다. 어두운 막·맥박 링·안내는 그대로 화면 전체 위. 마크업은 여전히 역할을 읽지 않는다(innerHTML 동일 테스트 통과).
- 장면 상자 CSS: 대기실 머리 `height: 119.2px`, `.mf-lobby__scene`·`.mf-assign__scene` 는 낮과 같은 `position: relative; flex: 1; min-height: 0; padding: 0 12px`(폭 389 이하 `0 4px`), 대기실 시트·배정 패널은 `calc(157px + env(safe-area-inset-bottom))`·낮 패널과 같은 면·모서리·안쪽 여백·간격(대기실 시트의 손잡이 막대는 없앴다), 대기실 배경은 `flex: 1 1 0` 로 바꿔 `100dvh` 계산을 없앴다(배정 배경은 원래 같은 값). `stageBox.test.tsx` 가 낮·대기실·배정 CSS 의 이 숫자를 교차 확인한다.
- 삭제: `src/components/Table.tsx`, `shared/seatLayout.ts`, `lobby.css` 의 `.mf-table*`·`.mf-seat*`·`.mf-tag` 배치·`.mf-badge`·`.mf-tag__off`·퍼센트 기하·옛 키프레임(`.mf-tag__name` 은 `ds.css` 에 있고 링크 참가 화면이 쓰므로 남김), `phase.css` 의 `.mf-assign__scene .mf-table`. 옛 식별자 grep(`components/Table|shared/seatLayout|SEAT_COUNT|mf-table|mf-seat__`, src·test·scripts·worker·shared) 0건. 옛 클래스 이름이 없다는 테스트는 이름을 조각으로 만들어 grep 0건을 지킨다.
- E2E: `lib.mjs` 에 `lobbyShapeChecks(stage, { n, mySeat })`(L6, 둘이면 마주 봄·셋이면 삼각, 1명·4명 이상은 건너뜀, 둘·셋에서 측정값 없으면 실패)를 더하고 `feltStable`(D7)이 측정값 없는 항목에서 예외 대신 실패하게 했다. `browser.mjs` 의 `startGame(page, tracker, { onAssigning })` 은 [게임 시작] 뒤 `assigning` 이 보이고 장면 테이블이 그려진 뒤 300ms 에 한 번 `onAssigning()` 을 부르고 `roleReveal` 까지 기다린다(배정이 이미 지났으면 건너뜀). `flows.mjs` `lobbyFlow` 는 인원 1 → [봇 늘리기] 2 → 3 → [5명 채우기] 5 에서 `readStage` 로 T2·L6 를 기록하고 마지막에 T1 을 기록한다(시나리오 이름 `lobby/stage`, 기존 `lobby/sheet` 의 T1·T2 와 구분). `gameFlow` 는 [게임 시작] 직전 대기실과 `onAssigning` 의 배정 화면을 `ctx.dayStates` 에 더해 D7·D9·T1 이 대기실 → 배정 → 낮 → 밤 → 아침을 한 번에 본다.
- 검사 기준 수치(OVERLAP_EPS 0.5, ONE_LINE_FACTOR 1.6, FACE_RATIO 0.45, TAP_MIN 44, PANEL_H 157)·`TEXT_SIZE_ALLOW`·D3a/D3b 바닥·D4 완화는 바뀌지 않았다(코드 변경은 위 목록뿐이고 `lib.mjs` 의 기존 판정 상수에 손대지 않았다).

로컬 E2E(`npm run dev` 5173, 개발 서버 PID 로 종료·포트 비움): 부분(`--only lobby`, `--only citizen4`)에 이어 전체 `npm run e2e -- --url http://localhost:5173` 를 돌렸다 — 152초, E2E OK, 실패 0.

| 흐름 | 360x640 | 390x664 | 430x932 |
|------|---------|---------|---------|
| lobby | 20/20 | 20/20 | 20/20 |
| citizen4 | 96/96 | 96/96 | 96/96 |
| police5 | 104/104 | 104/104 | 104/104 |
| mafia8 | 101/101 | 101/101 | 101/101 |
| doctor5 | 100/100 | 100/100 | 100/100 |
| spec4 | 47/47 | 47/47 | 47/47 |

대기실 T1(인원 1·2·3·5)·L6·T2 와 게임 흐름 T1(대기실·배정 포함)·D7·D9·D1~D9·D3a·D3b·D4·G·K·N·R·M 이 전부 통과했다. 임시 로그로 citizen4 의 대기실·배정 두 상태가 세 크기 모두에서 실제로 `ctx.dayStates` 에 들어가는 것을 확인했다(배정 창이 잡힘; 로그는 되돌림). 한 번 보인 재시도는 원래부터 있던 「방장이 첫 밤에 탈락」 준비 실패 재시도였다(임시 로그로 원인 확인).

### D4 단순화 확인 (사용자 지시)

`scripts/e2e/lib.mjs` 의 `d4TestButton` 에는 알림 전용 예외 분기가 원래 없었다(코드로 확인, 수정 없음). 알림 때문에 생긴 360폭 좁은 폭 규칙(`@media (max-width: 389px)`)은 `rolecard-toast.css` 삭제로 사라졌다. `src`, `scripts/e2e`, `src/styles/testtools.css` 에서 `알림`·`S13`·`389px` 검색 결과 알림 때문에 남은 조건 없음(남은 `알림` 단어는 새 R6 주석·라벨뿐). D4 기준(깊이 <= 3px, 가운데 점 눌림)은 건드리지 않았다.

## 검증

- 과제 4 시점: `npx vitest run` 76 파일 1770 통과(옛 Table·seatLayout·Icon 파일을 정리하고 DayTable·로비·배정·stageBox 테스트를 더한 뒤의 총수), `node --test scripts/e2e/lib.test.mjs` 86 통과(+5: L6), `npm run typecheck` 통과, `test ! -e src/components/Table.tsx`·`test ! -e shared/seatLayout.ts`·옛 식별자 grep 0건·`git diff --quiet bce014f -- shared/game worker` 변경 없음(`shared/seatLayout.ts` 삭제만 `shared` 안의 변경), 대소문자만 다른 테스트 파일 이름 중복 없음.
- 과제 3 시점: `npx vitest run` 76 파일 1772 통과(+12: 기하 불변식·산술 표·scenePad·동기 측정 등), `node --test scripts/e2e/lib.test.mjs` 81 통과(+10: T1·T2·상수), `npm run typecheck` 통과. `git diff --quiet bce014f -- shared worker` 변경 없음(과제 2 의 `src/game/dayTable.ts` 불변 검사는 의도대로 더는 유효하지 않다).
- 과제 1 시점: `npx vitest run` 75 파일 1739 통과, `lib.test.mjs` 67 통과, typecheck 통과.
- 과제 2 시점: `npx vitest run` 76 파일 1760 통과(+21: dayTable 구조·CSS 규약, nightIntro 신규 파일 11, 그 밖 기존 갱신), `node --test scripts/e2e/lib.test.mjs` 71 통과(K4 3, N6 1 추가), `npm run typecheck` 통과.
- `git diff --quiet bce014f -- src/game/dayTable.ts shared/game worker` 변경 없음. `grep -c` 확인: `mf-dt__spot-arc--back` 은 daytable.css·DayTable.tsx 각 1, `밤이 되었습니다` 는 NightIntro.tsx 2.
- 임계값(OVERLAP_EPS 0.5, ONE_LINE_FACTOR 1.6, FACE_RATIO 0.45, TAP_MIN 44, PANEL_H 157)·TEXT_SIZE_ALLOW·z-index 규칙은 과제 1~3 모두 변경 없음. 과제 2 시점에는 로컬 E2E 를 돌리지 않았고, K4·N6·N7 은 과제 3 의 로컬 E2E 에서 처음 실제 브라우저로 확인되어 통과했다.

## 남은 과제 (이 회차에서 시작하지 않음)

- 과제 5: 결정 0028 문서(`docs/decisions/0028-test-feedback-fixes.md`), UI-SPEC·HANDOFF 갱신, 전체 검증(로컬 e2e, 배포본 e2e·smoke), 배포, push. 이 회차까지 배포·push 는 하지 않았다.

## 편차

- [Rule 1 - Bug] 과제 2 U-03: RED 커밋(8de3ac4)의 `night.css` 규약 테스트 정규식 두 개가 잘못돼 있었다(퇴장 지연 단언이 `var(--mf-nightintro-exit-delay, 1700ms)` 의 기본값 쉼표를 못 읽음, 축소 모션 단언이 다른 @media 블록을 건너 멀리 있는 `.mf-nightintro` 에 걸림). 구현을 바꾸지 않고 테스트 정규식(쉼표 허용, @media 블록 중괄호를 세어 본문만 검사)만 GREEN 커밋(133e1c5)에서 고쳤다. 기준 의미는 같다.
- 과제 4: 계획 밖 변경 없음. RED 커밋에서 삭제한 두 테스트 파일은 단언을 옮겼고(Icon → `icon.test.tsx`, `Table` 단언 → DayTable·로비 테스트) 약해진 것이 없다. GREEN 커밋에 테스트 두 개를 더 고쳤다: ① `lobby.test.tsx` 「끊긴 사람」 테스트는 방장 화면에서 끊긴 자리가 `button` 이 되어(내보내기 버튼 = 자리 자체) `group` 으로 찾을 수 없으므로 방장이 아닌 사람 화면으로 바꿨다(방장 화면의 button 은 내보내기 테스트가 이미 본다). ② 옛 식별자 grep 0건 기준을 지키려고 옛 클래스 이름 확인을 이름 조각 합성으로 썼다. 둘 다 의미는 같다.
- `commits: 14` 는 측정값이다(`git rev-list --count`, 과제 4 GREEN a82e401 까지, 과제 진행 체크포인트 문서 커밋 제외). 앞 판의 `commits: 11` 은 과제 3 GREEN 6482625 까지였다. 이 가운데 8e80abd(`docs(design): approved table geometry P2`)는 이 계획 밖에서 들어온 사용자의 디자인 문서 커밋이다(design/screens/table-v1 6개 파일, 코드 무관).

## 알려진 스텁

없음.

## Self-Check: PASSED

- FOUND: 129767c, b068558, 4f9589b, aa077bc, 8de3ac4, 133e1c5, 6f15452, 6482625, 19946de, a82e401 (HEAD 의 조상)
- 삭제 확인: RoleCardToast.tsx, rolecard-toast.css, Table.tsx, shared/seatLayout.ts, table.test.tsx, seatLayout.test.ts
- 생성 확인: src/components/NightIntro.tsx, test/client/nightIntro.test.tsx, test/client/stageBox.test.tsx, test/client/icon.test.tsx
