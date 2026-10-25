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
  - src/game/dayTable.ts
  - src/screens/Lobby.tsx
  - src/screens/Assigning.tsx
  - src/styles/lobby.css
  - src/styles/phase.css
  - src/components/Table.tsx
  - shared/seatLayout.ts
  - test/client/dayScene.test.tsx
  - test/client/roleCardFlow.test.tsx
  - test/client/journal.test.tsx
  - test/client/dayTable.test.tsx
  - test/client/nightIntro.test.tsx
  - test/client/lobby.test.tsx
  - test/client/phaseScreens.test.tsx
  - test/client/stageBox.test.tsx
  - test/client/icon.test.tsx
  - test/client/testTools.test.tsx
  - test/client/table.test.tsx
  - test/unit/dayTable.test.ts
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
  tokens: 400000
  raw_tokens: 400000
  tasks: 5
  confidence: low

must_haves:
  truths:
    - "낮 직업 주장 차례 자리의 발밑 하얀 링(.mf-dt__spot)은 뒤쪽 호(윗쪽 반)가 캐릭터 그림 뒤에, 앞쪽 호(아랫쪽 반)가 캐릭터 그림 앞에 그려진다. 링의 크기(폭 140%·높이 24%)·두께 3px·색 gray-50·빛 18px 은 그대로이고 .mf-dt__spot 은 차례 자리마다 정확히 한 개다. 이름표 1~11·캐릭터 12~22·어둡게 층 30·방금 탈락한 유령 31·이모티콘 60+ 규칙은 바뀌지 않고 D3a(이름표 z < 캐릭터 z)가 그대로 통과한다 (U-02)"
    - "같은 접속에서 비밤 단계 → 밤으로 넘어가는 순간에만 모든 사람 화면(탈락자 포함)에 'N일차 / 밤이 되었습니다' 가 한 번 떠서 사라진다. 길이는 낮 시작 발표와 같은 DAY_ANNOUNCE_MS(2초), 번짐 800ms·ease-out 과 축소 모션 처리(전역 규칙)도 같다. 처음 마운트·재접속(epoch 변화)·밤 안의 다시 그리기·밤을 벗어난 뒤에는 뜨지 않고, 터치를 막지 않으며(pointer-events none), 역할에 따라 문구가 달라지지 않는다. 서버 규칙·시간·와이어는 바뀌지 않는다 (U-03)"
    - "밤 끝 알림(눌러서 보기)은 어디에도 없다: 알림 컴포넌트·CSS·DayScene 연결·활동 기록 열기 연결·문구(JOURNAL_TEXT.notice)·테스트·E2E 알림 규칙이 모두 정리된다. [역할 카드] 앰버 점과 활동 기록 탭 안읽음 점·NEW·읽은 개수 저장은 그대로 동작한다 (U-01)"
    - "테이블·캐릭터 기하는 모든 상황(대기실·역할 배정·낮·밤·아침)에서 승인 시안 P2 값으로 고정이다: 390폭(장면 폭 366)에서 테이블 면 216×108(위 150), 좌석 원 cy 210·rx 146·ry 100, 캐릭터 72×96·k0 0.8. 다른 폭은 rx = clamp(floor(장면 폭/2 + 장면 여백 − 49), 124, 150), 면 폭 = 2·(rx − 38)(360폰 rx 131·면 186, 375폰 138·200, 430폰 150·224). 4~8명 모두에서 캐릭터 상자가 장면 안에 있고(최소 여백 4.6) 양옆 캐릭터는 발 줄에서 테이블 면과 4px 이상(계산 최소 6.2) 떨어지며, 이름표 z/보이는 비율 바닥(D3a/D3b)·D2·D4·D9 가 그대로 통과한다 (U-04)"
    - "장면 상자는 모든 단계에서 같다: 위 = 헤더 119.2, 아래 = 뷰포트 − 하단 패널 157, 좌우 여백 12(폰 폭 < 390 이면 4). 대기실·역할 배정도 헤더 119.2·패널 157 을 유지하고 DayTable 을 그대로 써서, 같은 인원이면 대기실 → 배정 → 낮 → 밤 → 아침에서 장면 상자·테이블 면·내 캐릭터 사각형이 ±0.5px 같다(E2E T1). 대기실에서 n 명은 좌석 번호 순서의 등간격 타원에 앉고(내가 맨 아래 가운데, 2명 마주 봄, 3명 삼각), 사람이 들어오고 나가면 나머지가 짧은 CSS 전이로 새 자리로 미끄러진다(축소 모션에서는 전이 없음). 방장 왕관·끊김 흐림·끊긴 사람 내보내기 누르기·입장/퇴장 전이·내 링은 그대로 동작한다. 서버 좌석 번호(lowestFreeSeat)·낮 차례 순서는 바뀌지 않는다 (U-04)"
    - "E2E 기준 수치(OVERLAP_EPS 0.5, ONE_LINE_FACTOR 1.6, FACE_RATIO 0.45, TAP_MIN 44, PANEL_H 157)와 허용 목록(TEXT_SIZE_ALLOW 는 .mf-journal__new·.mf-tt* 뿐)은 그대로이고, 승인된 완화 M1·D3a/D3b·D4 외 완화는 없다. 새 검사 K4(링 앞뒤 층)·N6/N7(밤 시작 문구)·T1(단계가 바뀌어도 장면 상자·테이블·내 캐릭터 그대로)·T2(양옆 캐릭터가 테이블 면 바깥)·L6(대기실 둘이면 마주 봄·셋이면 삼각)이 더해지고 R6 은 알림이 없음을 보는 검사로 바뀐다 (U-05)"
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
    - path: "src/game/dayTable.ts"
      provides: "P2 승인 기하의 단일 출처 — seatRx(장면 폭, 여백)·feltWidthOf(rx) 와 dayTableGeometry/daySeatLayout(여백 인자). 대기실·배정·낮·밤·아침이 모두 이 규칙을 쓴다"
      contains: "SEAT_RX_MAX"
    - path: "src/screens/Lobby.tsx"
      provides: "대기실이 DayTable 을 쓰고(좌석 번호 순서 등간격, 인원 변화 시 미끄러짐), 머리 119.2·시트 157 장면 상자"
      contains: "DayTable"
    - path: "test/client/stageBox.test.tsx"
      provides: "머리 119.2·패널 157·여백 12/4 가 낮·대기실·배정 CSS 에서 같다는 교차 검사"
      contains: "157px"
    - path: "scripts/e2e/lib.mjs"
      provides: "K4 링 앞뒤 층 검사, N6 밤 시작 문구 검사, R6 알림 없음 검사, T1 단계가 바뀌어도 장면 상자·테이블 그대로, T2 양옆 캐릭터 간격, L6 대기실 자리 모양"
      contains: "stageStable"
    - path: "docs/decisions/0028-test-feedback-fixes.md"
      provides: "알림 제거·링 층 분리·테이블 기하 P2 고정(폭별 규칙)·장면 상자 통일과 대기실 등간격·밤 시작 연출 결정 기록"
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
    - from: "src/game/dayTable.ts dayTableGeometry/daySeatLayout"
      to: "src/components/DayTable.tsx"
      via: "DayTable 이 장면 크기와 CSS 변수 --mf-scene-pad(또는 scenePad prop)로 규칙을 부르고 낮·밤·아침·대기실·배정이 모두 이 한 부품을 쓴다"
      pattern: "scenePad"
    - from: "src/screens/Lobby.tsx · src/screens/Assigning.tsx"
      to: "src/components/DayTable.tsx"
      via: "두 화면이 옛 Table 대신 DayTable 을 같은 장면 상자(머리 119.2·패널 157)에 놓는다"
      pattern: "<DayTable"
    - from: "scripts/e2e/browser.mjs readStage"
      to: "scripts/e2e/lib.mjs stageStable·feltGapChecks"
      via: "대기실·배정·낮·밤·아침의 장면 상자·테이블 면·캐릭터 사각형을 같은 모양으로 읽어 T1·T2 가 판정"
      pattern: "readStage"
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
| 사용자 지시 U-04 | (4) 개정: 사용자가 시안 P2 를 승인하고 테이블·캐릭터 기하를 모든 상황(대기실·역할 배정·낮·밤·아침)에서 고정하라고 요청 — 하단 패널이 없어져도 아무것도 늘어나지 않는다. 대기실은 좌석 번호 순서의 등간격 자리 + 인원 변화 때 미끄러짐. (이전 비트반전 표시 슬롯 안은 폐기) | 과제 3(상수·규칙·낮/밤/아침·E2E T1·T2)·과제 4(대기실·배정 통일) |
| 사용자 지시 U-05 | TDD(RED→GREEN 커밋쌍), 검증 순서, 결정 0028, HANDOFF·UI-SPEC 갱신, 마지막에 배포·push | 과제 5 (+ 각 과제의 RED 커밋) |

과제 1·2 는 이미 실행기가 끝냈다(수정하지 않는다). 과제 3·4 는 사용자의 개정 요청(2026-10-25)으로 옛 과제 3(비트반전 표시 슬롯)을 대체한다.

범위 밖(건드리지 않는다): `shared/game/` 서버 규칙·와이어·좌석 번호(`lowestFreeSeat` 등)·낮 차례 순서. 이전 판에서 범위 밖이던 「낮 테이블·캐릭터 위치(대기실과 낮의 기하 통일)와 역할 배정 화면이 늘어나는 문제」는 시안 P2 승인으로 이 계획에 들어왔다. 승인 사본 `design/screens/table-v1/` 은 고치지 않는다.

참고 자료(`gsd-addons:design-refs` 규칙):

| 경로 | 가져온 요소 |
|------|-------------|
| `design/screens/table-v1/SPEC.md` | 390폭 면 216×108(위 150, 가로 가운데), cy 210·rx 146·ry 100, 캐릭터 72×96·k0 0.8, 모든 단계에서 고정, 장면 상자 = 헤더 119.2 ~ 하단 패널 157(패널이 비어도 157), 다른 폭은 규칙으로 |
| `design/screens/table-v1/P2-new5.dc.html` | 좌석 공식(th = π/2 + i/n·2π, depth = (sin th + 1)/2, scale = 0.8 + 0.2·depth), 면 위치, 왕관 배지 |
| `design/screens/table-v1/P5-assign.dc.html` | 역할 배정 = 같은 테이블 위 어두운 막과 안내, 머리 제목 `역할 배정`, 빈 하단 패널 |
| `.planning/phases/03.1-sequential-claims-role-card/03.1-UI-SPEC.md` | 링 값(B), 이름표 층 순서, D3a/D3b/D4 기준, 낮 시작 발표 값 |

참고 자료와 다르게 한 곳과 이유: (1) 폭별 rx 규칙 — SPEC 의 「장면 폭/2 − 36.4」는 360폰에서 5글자 이름표를 화면 밖으로 최대 9.6px 밀어낸다(아래 산술). 390폭에서는 승인값을 그대로 재현하는 규칙으로 바꿨다. (2) 면 폭 = 2·(rx − 38) — SPEC 식 2·(rx − 38.4)는 승인값 216 이 아닌 215.2 를 낸다. (3) P5 의 [역할 카드] 버튼·진행 막대는 그리지 않는다 — 배정 단계는 역할 정보를 읽지 않는다(D-12).

Tracer 생략 사유: 피드백 네 건은 서로 독립인 수정이고 각 건이 화면 → 단위 테스트 → E2E 규칙을 RED→GREEN 으로 끝까지 닫는다. 얇은 관통 슬라이스를 따로 둘 새 계층이 없다.

Output: 위 피드백 4건과 테이블 기하 고정의 코드·테스트·E2E 규칙, `docs/decisions/0028-test-feedback-fixes.md`, 갱신된 `HANDOFF.md`·`03.1-UI-SPEC.md`, 배포 및 push.
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
- `shared/seatLayout.ts` 의 `seatLayout` 은 `src/components/Table.tsx`(대기실·역할 배정)만 쓴다(그래서 개정된 과제 4 가 둘 다 지울 수 있다). 낮 `DayTable` 은 `src/game/dayTable.ts` 의 `daySeatLayout`(n 명 등간격)을 쓴다. `test/unit/seatLayout.test.ts`·`test/client/table.test.tsx` 가 `seatLayout` 을 직접 부른다.
- 차례 링 `.mf-dt__spot` 은 `.mf-dt__seat`(position absolute + transform scale + 인라인 z-index 12~22/31)의 자식이다. 자리가 쌓임 맥락이라 링 한 요소로는 캐릭터 앞뒤로 갈릴 수 없다. 전역 `*{box-sizing:border-box}`(base.css) 라 지금 링의 바깥 크기는 폭 140%×높이 24% 이다.
- 낮 시작 발표는 서버 단계 `dayAnnounce`(DAY_ANNOUNCE_MS 2000)의 별도 화면 `src/screens/Day.tsx` 이다: `.mf-day__morning` 방사형 빛(opacity 0→1, `--dur-slow` 800ms, `--ease-out`), `N일차`(mf-t-heading) + `낮이 되었습니다`(mf-t-display, 800ms 번짐·scale 1.04→1). 축소 모션은 개별 규칙이 아니라 `src/styles/base.css` 전역 규칙(animation-duration 0.01ms)이 맡는다. 밤(30초)에는 별도 단계가 없으므로 밤 문구는 DayScene 안의 클라이언트 오버레이다.
- DayScene 은 `claim → discussion → night → morning` 에서 같은 장면 키라 다시 마운트되지 않는다. `useRoomConnection` 의 `epoch` 는 새 연결의 첫 state 마다 1씩 늘고 view 와 같은 렌더에서 바뀐다. DayScene 에는 이미 `prevPhase` 렌더 중 상태 조정 블록이 있다.
- E2E: `scripts/e2e/lib.mjs` 의 `turnChecks`(K1·K2)·`noticeChecks`(R6)·`dayChecks`(D3a 는 `.mf-dt__tag` z 최댓값 < `.mf-dt__seat` z 최솟값), `browser.mjs` 의 `collectSnapshot`·`clickNotice`, `flows.mjs` 의 `roleCardViaNotice`·`morningRoleChecks`·`gameFlow`(밤 상태). 검사 ID K4·N6·N7 은 비어 있다.
- 사용자가 시안 P2(`design/screens/table-v1/`, 승인 사본)로 모든 상황의 테이블·캐릭터 위치를 고정하라고 요청했다(과제 1·2 실행 뒤의 개정). 지금 대기실은 고정 높이 `100dvh` 배경·내용 높이 머리·퍼센트 기하 4:5 상자·내용 높이 시트(손잡이 막대 포함 게스트 약 167)이고 배정은 머리·패널 없이 화면 전체에 테이블을 두어서, 단계가 바뀌면 테이블이 늘어난다. 낮은 헤더(`PhaseBar` 실측 119.2 = 16 + 50.4 + 8 + 28.8 + 16) 아래 ~ 하단 패널 157(+안전 영역) 위, 좌우 여백 12(폰 폭 < 390 이면 4)의 장면 상자 안에 `DayTable` 을 둔다.
- 기하 산술(계획 단계에서 분석 스크립트로 계산: 캐릭터 PNG 알파 > 40, E2E D3b 와 같은 0.5px 격자, 이름표 상자 22 높이). 실행자는 단위 테스트로 같은 산술을 재현하고, 숫자가 다르면 멈추고 보고한다.

| 폰 폭×높이 | 장면 폭×높이 | 여백 | rx | 면 폭 | 면 left |
|-----------|-------------|------|----|-------|---------|
| 360×640 | 352×363.8 | 4 | 131 | 186 | 83 |
| 375×667 | 367×390.8 | 4 | 138 | 200 | 83.5 |
| 390×664 | 366×387.8 | 12 | 146 | 216 | 75 |
| 430×932 | 406×655.8 | 12 | 150 | 224 | 91 |

| 폰 | 캐릭터 상자와 장면 가장자리 최소 여백 | 양옆 발 줄 테이블 면 간격 최소(4·8명판) | 99px 이름표의 폰 가장자리 여유(4·8명판) | 70px 이름표 |
|----|------|------|------|------|
| 360 | 12.6 | 6.2 | −0.5 | 14.0 |
| 375 | 13.1 | 6.2 | 0.0 | 14.5 |
| 390 | 4.6 | 6.3 | −0.5 | 14.0 |
| 430 | 20.6 | 6.3 | 15.5 | 30.0 |

간격은 7명판 7.4~7.8, 3·5·6명판 23.2 이상. SPEC 의 「5명판 간격 12px」는 발 줄 기준 계산(26.5)과 다르지만 의도(양옆이 테이블 밖)에는 영향이 없다. 이름표 보이는 비율(D3b, 99px / 70px, 인원별 최솟값, 바닥은 4·5명 99.9 %·6명 85 %·7명 50 %·8명 55 %):

| 폰 | 4·5명 | 6명 | 7명 | 8명 |
|----|-------|-----|-----|-----|
| 360 | 100 / 100 | 97.1 / 95.9 | 61.5 / 58.5 | 62.9 / 68.2 |
| 375 | 100 / 100 | 97.1 / 95.9 | 61.8 / 60.5 | 65.0 / 71.2 |
| 390 | 100 / 100 | 97.1 / 95.9 | 62.2 / 62.7 | 67.4 / 74.6 |
| 430 | 100 / 100 | 97.1 / 95.9 | 62.2 / 63.6 | 68.6 / 76.3 |

옛 기하의 8명판은 60.7~63.2 였으므로 같거나 낫다(가장 빡빡한 여유 +7.9%p: 8명 360폭 99px). D9(이름표끼리 겹침)는 모든 인원·폰에서 0건, D4([테스트] 87.7×44 가 장면 (0,8))는 1~8명 모두 통과, 맨 앞 이름표 아래 끝 332 ≤ 장면 높이(363.8 에서 여유 31.8; 높이 299.8 에서는 cy 가 177.8 로 내려가 정확히 299.8), 머리 위 ≥ 0(최소 cy 에서 1.0). SPEC 규칙 「장면 폭/2 − 36.4」를 그대로 쓰면 360폰에서 rx 139.6 이 되어 99px 이름표가 4·8명판 양옆 자리에서 폰 밖으로 9.6px, 5명판 아래 양옆에서 2.8px, 7명판에서 6.1px 나가고 [테스트] 가 7명판 자리 3 과 깊이 9.8 로 겹치므로 쓰지 않는다.
- 알려진 칼날 경계: 양옆 자리(4·8명판, 정확히 180°)의 이름표는 장면 상자 밖으로 나간다(390폭에서 장면 기준 −13, 폰 기준 −0.5). E2E D2·G2 는 폰 폭 전체인 `.mf-dayscene__scene` 와 `left ≥ −0.5` 로 재므로 99px 이름표까지 통과하지만, 5글자 이름표가 실기기 글꼴에서 99px 을 넘으면 폰 가장자리에 걸린다. 대안은 이름표 여유 49 → 50(상수 하나: 390폭 rx 145·면 214·간격 6.7). 이 계획은 승인값 146/216 을 따르고 한계를 문서와 실기기 목록에 남긴다. E2E 봇 이름은 3글자(70px)라 E2E 로는 이 경계가 시험되지 않는다.
- 대기실 머리 119.2 안 계산: 버튼 44×44(top 16, 아래 끝 60), 가운데 라벨 14px×1.4 = 19.6 + 방 코드 36px×1.2 = 43.2(top 16 → 아래 끝 78.8)로 여유 40.4. [테스트] 는 머리가 아니라 장면 상자 안 위 8(= 페이지 y 127.2~171.2)에 있다. 토스트(top 88, 높이 약 36)는 잠시 장면 상자 위 5px 를 덮지만 pointer-events 가 없다. 대기실 시트 157 안: 호스트 8+24(안내 16px×1.5)+8+52(`--control-button`)+12 = 104, 게스트 8+24+8+(19.6+8+52)+12 = 131.6.

- 로컬 E2E 는 `npm run dev`(기본 5173)를 띄우고 `npm run e2e -- --url http://localhost:5173` 로 돈다. 배포본 주소는 `scripts/prod-url.txt`(https://minifia.dhplay.workers.dev). 결정 번호 다음 값은 0028.

</context>

<!-- planner-discipline-allow: RoleCardToast -->
<!-- planner-discipline-allow: rolecard-toast -->
<!-- planner-discipline-allow: onOpenActivity -->
<!-- planner-discipline-allow: roleCardOpen -->
<!-- planner-discipline-allow: clickNotice -->
<!-- planner-discipline-allow: roleCardViaNotice -->
<!-- planner-discipline-allow: rolecard-notice -->
<!-- planner-discipline-allow: components/Table -->
<!-- planner-discipline-allow: shared/seatLayout -->
<!-- planner-discipline-allow: SEAT_COUNT -->
<!-- planner-discipline-allow: mf-table -->
<!-- planner-discipline-allow: mf-seat__ -->

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
  <name>과제 3: 테이블·캐릭터 기하를 P2 승인값으로 고정 — 상수·규칙, DayTable, 낮·밤·아침, E2E T1·T2 (U-04, 1/2)</name>
  <files>test/unit/dayTable.test.ts, test/client/dayTable.test.tsx, test/client/dayScene.test.tsx, scripts/e2e/lib.test.mjs, src/game/dayTable.ts, src/components/DayTable.tsx, scripts/e2e/lib.mjs, scripts/e2e/browser.mjs, scripts/e2e/flows.mjs</files>
  <read_first>design/screens/table-v1/SPEC.md, design/screens/table-v1/P2-new5.dc.html, design/screens/table-v1/P5-assign.dc.html, src/game/dayTable.ts, src/components/DayTable.tsx, src/styles/daytable.css, test/unit/dayTable.test.ts, test/client/dayTable.test.tsx, test/client/dayScene.test.tsx (장면 상자·짧은 화면 테스트), .planning/phases/03.1-sequential-claims-role-card/03.1-UI-SPEC.md (이름표 층 순서·D3a/D3b·D4), scripts/e2e/lib.mjs (dayChecks·feltStable·tagsOverlap·상수), scripts/e2e/flows.mjs (dayState·gameFlow·specFlow), scripts/e2e/browser.mjs (collectSnapshot)</read_first>
  <behavior>
    - 규칙: `rx = clamp(floor(장면 폭/2 + 장면 여백 − 49), 124, 150)`, `면 폭 = 2·(rx − 38)`, 면 left = (장면 폭 − 면 폭)/2, 면 높이 108, 면 top = cy − 60, ry 100, cy 는 지금의 적응 규칙(max(177, min(210, 장면 높이 − 122)))
    - 표(장면 폭, 여백) → (rx, 면 폭, 면 left): (352,4) → (131,186,83) · (367,4) → (138,200,83.5) · (366,12) → (146,216,75) · (406,12) → (150,224,91). 클램프: (300,4) → rx 124, (700,12) → rx 150
    - 불변식(위 네 장면 × 인원 1~8 × 장면 높이 299.8·363.8·387.8·655.8): 모든 캐릭터 상자(72×scale)가 장면 안 · 발 줄이 테이블 면 세로 범위에 드는 자리는 그 줄에서 테이블 면(타원 현)과 가로 간격 ≥ 4 · 99px 이름표가 폰 가장자리 안(허용 −0.5) · 100px 이름표끼리 겹침 0.5 이하 · 이름표 아래 끝 ≤ 장면 높이 · 머리 위 ≥ 0 · 이름표 z 최댓값 < 캐릭터 z 최솟값 · 등간격(각 간격 2π/n), 내 자리 맨 아래 가운데, 2명은 마주 봄, 3명은 한 직선이 아님
    - DayTable: `scenePad` prop(없으면 루트의 CSS 변수 `--mf-scene-pad` 를 읽고, 비었으면 12)로 그리고, 마운트 직후 한 번 동기 측정해 첫 페인트부터 실제 크기로 그린다
    - E2E T2: 발 줄이 테이블 면 세로 범위에 드는 캐릭터의 가로 범위와 그 줄의 테이블 면 가로 범위(타원 현)의 간격이 모두 ≥ 4. T1: 단계가 바뀌어도(같은 인원) 장면 상자·테이블 면·내 캐릭터 사각형이 ±0.5 같고, 머리 119.2·하단 패널 157 이며 패널 위 = 장면 아래
  </behavior>
  <action>
    진행 순서는 RED 커밋 → GREEN 커밋이다. 이 과제는 사용자가 승인한 시안 P2(`design/screens/table-v1/`)로 모든 상황의 테이블·캐릭터 기하를 고정하는 일의 1부(상수·규칙과 낮·밤·아침 화면, E2E 규칙)다. 2부(대기실·역할 배정 통일)는 과제 4다. 서버 규칙·좌석 번호·차례 순서와 `shared/` 는 건드리지 않는다. 이 과제로 `src/game/dayTable.ts` 의 기하 숫자를 바꾸는 것은 의도된 변경이며(과제 2 까지의 「기하 불변」 검사와 무관) 이후 불변 기준은 아래 위 산술 표다.

    가. RED — `test(qvx): 테이블 기하를 P2 승인값으로 고정하는 기준` 으로 커밋.
    - `test/unit/dayTable.test.ts`: 상수 테스트에서 옛 좁은 장면 기준·옛 반지름·옛 면 폭 단언을 지우고 새 상수(최소 rx 124, 최대 rx 150, 이름표 여유 49, 면 옆 간격 38, 장면 여백 기본 12·좁은 폰 4)를 단언한다. 기하 테스트는 behavior 의 표 네 줄과 클램프 두 줄, 인원과 무관하다는 기존 단언, 적응 cy 값(높이 332 이상 210 … 299 에서 177)을 유지한다. 「폭 352·366·406 의 rx·면 폭은 예전과 같다」 테스트는 지운다(예전 값이 아니다). 자동 배치 검사는 behavior 의 불변식으로 다시 쓴다: 장면 폭은 「여백 4 쪽 340~381 의 모든 정수 폭」과 「여백 12 쪽 366~406 의 모든 정수 폭」 두 줄을 돌린다(폰 폭 = 장면 폭 + 2·여백이 CSS 의 389px 경계와 맞는 범위). 옛 D2 단언(맨 왼쪽 이름표 왼쪽 ≥ 1.0, 장면 기준)은 P2 에서 5글자 이름표가 양옆 자리(4·8명)에서 장면 밖으로 최대 13px 나가므로 「폰 기준 −0.5 허용(E2E G2·D2 와 같은 기준, 99px 이름표)」 로 옮기고 이유를 주석 한 줄로 남긴다 — 기준을 낮추는 것이 아니라 E2E 가 실제로 재는 틀로 맞추는 것이다. 간격 ≥ 4 를 재는 도우미는 테스트 안에 둔다(타원 현: 면 중심 세로 기준 `반폭·sqrt(1−((y−중심)/반높이)^2)`).
    - `test/client/dayTable.test.tsx`: 인라인 면 left/width 단언을 새 규칙으로 고치고(폭 366 → left 75px·width 216px, 폭 352 + `scenePad` 4 → 83px·186px), `scenePad` prop 과 CSS 변수 비었을 때 기본 12 를 시험한다. 이름표 z < 자리 z(4~8명) 단언과 나머지는 유지.
    - `test/client/dayScene.test.tsx`: 옛 숫자(반지름·면 폭)에 기댄 단언만 새 값으로 고친다. 의미를 약하게 만들지 않는다.
    - `scripts/e2e/lib.test.mjs`: 새 순수 함수의 테스트 — `feltGapChecks(stage)`(id T2): 통과 픽스처(8명판 양옆 간격 6.3), 간격 3.9 면 실패하고 자리·간격이 내용 칸에 나옴, 발 줄이 면 세로 범위 밖인 자리는 건너뜀, `stage.felt` 또는 `stage.seats` 가 없으면 조용히 통과하지 않고 실패. `stageStable(entries)`(id T1): 항목 `{ state, stage, mySeat }` 여럿이 장면 상자·면·내 캐릭터가 ±0.5 같으면 통과, 1px 다르면 실패하고 상태 이름을 말함, 머리 높이 ≠ 119.2 이거나 패널 높이 ≠ 157(상수 `PANEL_H` 재사용)이거나 패널 위 ≠ 장면 아래면 실패, 내 자리가 `spotlit` 이면 내 캐릭터 비교만 건너뜀, 항목이 비면 실패. 상수 `SIDE_GAP_MIN === 4`·`HEADER_H === 119.2` 를 고정하고 기존 불변 상수 테스트(0.5·1.6·0.45·44·157)는 그대로 둔다.
    - 실행해 실패(새 규칙·새 함수 부재)를 확인하고 커밋.

    나. GREEN — `feat(qvx): 테이블·캐릭터 기하를 P2 승인값으로 고정한다 (결정 0028)` 로 커밋.
    - `src/game/dayTable.ts`: 상수 `SEAT_RX_MIN`·`SEAT_RX_MAX`·`RX_TAG_HALF`(= 49, 주석에 「99px 이름표 반폭 49.5 − E2E 허용 0.5」)·`FELT_SIDE`(= 38)·장면 여백 기본값 둘을 두고, `seatRx(장면 폭, 여백)`·`feltWidthOf(rx)` 를 export 한다. `dayTableGeometry(장면 폭, 장면 높이, 여백)` 와 `daySeatLayout(…, 여백)` 은 새 규칙을 쓰고, 옛 좁은 장면 경계·옛 반지름·옛 면 폭 상수는 지운다(다른 사용처는 `grep` 으로 확인 — DayTable·테스트뿐이다). 캐릭터 72×96, k0 0.8, ry 100, cy 최대 210·최소 177 과 적응 규칙, 면 높이 108, 이름표 높이 22·간격 0, z 규칙(이름표 1~11·캐릭터 12~22)은 그대로다. 머리 주석에 이 규칙의 출처(P2, 결정 0028), 산술 표(context), 이름표 여유 49 가 칼날 경계(99px 이름표가 폰 가장자리에 정확히 −0.5)라는 사실을 적는다.
    - `src/components/DayTable.tsx`: `scenePad?: number` prop 을 더한다. 값이 없으면 마운트 때와 크기 관측 콜백에서 루트의 계산된 CSS 변수 `--mf-scene-pad` 를 읽어(숫자가 아니면 12) 쓴다 — 여백의 출처는 CSS 한 곳이다. 같은 레이아웃 효과에서 마운트 직후 한 번 동기로 크기를 재서 첫 페인트부터 실제 크기로 그린다(대기실 → 배정 → 낮에서 한 프레임 튀지 않게; 관측기·실제 크기가 없으면 지금처럼 기본 366×407). 머리 주석의 옛 기하 숫자를 고친다. 마크업·z-index·링 구조는 건드리지 않는다.
    - E2E: `lib.mjs` 에 `SIDE_GAP_MIN`·`HEADER_H` 상수, `feltGapChecks(stage)`(T2, 라벨 「양옆 캐릭터가 테이블 면 바깥」), `stageStable(entries)`(T1, 라벨 「단계가 바뀌어도 장면 상자·테이블·내 캐릭터·패널이 그대로」)을 더한다. `browser.mjs` 에 `readStage(page)` 를 export — 한 번의 evaluate 로 `{ scene, header, panel, felt, seats: [{ seat, rect, spotlit }], tags: [{ seat, rect }] }` 를 돌려준다(scene = 첫 번째 있는 것: `.mf-dayscene__scene`·`.mf-lobby__scene`·`.mf-assign__scene`, header = `.mf-phasebar`·`.mf-lobby__bar`·`.mf-assign__bar`, panel = `.mf-dayscene__panel`·`.mf-lobby__sheet`·`.mf-assign__panel`; 없으면 null). 토큰·프레임은 싣지 않는다. `flows.mjs`: `dayState` 가 스냅숏 뒤 `readStage` 를 읽어 `ctx.dayStates` 항목에 `stage` 로 더하고 그 상태의 T2 를 기록한다(오류 시 기존 되돌림 코드가 항목을 지우는 방식 그대로). `gameFlow`·`specFlow` 끝의 D7·D9 기록 옆에 `stage` 가 있는 항목들로 T1 을 기록한다(`mySeat` 는 `tracker.last().me.seat`). 기존 D7·D9·D3a·D3b·D4·D2 판정 코드와 기준 수치는 바꾸지 않는다.
    - 산술 확인: 테스트가 통과한 뒤에도 context 의 기하 산술 표가 단위 테스트의 계산과 같은 숫자(rx·면 폭·간격 최소·여백 최소)인지 한 번 비교한다. 다르면 이 계획의 숫자가 아니라 테스트가 맞는지 먼저 의심하고, 어긋나면 멈추고 숫자를 보고한다.

    다. 부분 로컬 E2E(커밋 전, 코드 변경 없음): 5173 포트가 비어 있는지 확인하고 `npm run dev` 를 백그라운드로 띄워 응답을 기다린 뒤 `npm run e2e -- --url http://localhost:5173 --only mafia8` 와 `--only citizen4` 를 돌린다(8명판이 가장 빡빡하다). D1~D9·G·T1·T2·M·K 가 전부 통과해야 한다. 이름표 보이는 비율 바닥(D3b: 4·5명 100 %, 6명 85 %, 7명 50 %, 8명 55 %)이나 D3a 가 실패하면 바닥을 낮추지 말고 멈춰 측정 숫자를 SUMMARY 와 반환 메시지에 적는다(계산상 8명 최소는 62.9 %). 끝나면 dev 서버를 종료한다.
  </action>
  <verify>
    <automated>npx vitest run test/unit/dayTable.test.ts test/client/dayTable.test.tsx test/client/dayScene.test.tsx test/client/nightIntro.test.tsx && node --test scripts/e2e/lib.test.mjs && npm run typecheck && grep -c "SEAT_RX_MAX" src/game/dayTable.ts && git diff --quiet bce014f -- shared worker</automated>
  </verify>
  <done>낮·밤·아침 테이블이 390폭 기준 면 216×108(위 150)·rx 146·cy 210·ry 100·캐릭터 72×96·k0 0.8 이고 다른 폭은 규칙표대로이며, 4~8명 모두 캐릭터가 장면 안·양옆 캐릭터가 테이블 면 바깥(간격 ≥ 4)·D3a/D3b/D2/D4/D9 통과다. E2E T1·T2 가 생기고 8명·4명 판 부분 로컬 E2E 가 통과한다. 서버·`shared/` 는 바뀌지 않았다. RED/GREEN 커밋쌍이 있다.</done>
</task>

<task type="auto" tdd="true">
  <name>과제 4: 대기실·역할 배정을 같은 DayTable·같은 장면 상자(헤더 119.2 · 패널 157)로 통일하고 인원 변화에 고르게 미끄러지게 (U-04, 2/2)</name>
  <files>test/client/dayTable.test.tsx, test/client/dayScene.test.tsx, test/client/lobby.test.tsx, test/client/phaseScreens.test.tsx, test/client/stageBox.test.tsx, test/client/icon.test.tsx, test/client/table.test.tsx (삭제), test/client/testTools.test.tsx, test/unit/seatLayout.test.ts (삭제), scripts/e2e/lib.test.mjs, src/components/DayTable.tsx, src/styles/daytable.css, src/screens/Lobby.tsx, src/screens/Assigning.tsx, src/styles/lobby.css, src/styles/phase.css, src/components/Table.tsx (삭제), shared/seatLayout.ts (삭제), scripts/e2e/lib.mjs, scripts/e2e/browser.mjs, scripts/e2e/flows.mjs</files>
  <read_first>design/screens/table-v1/SPEC.md, design/screens/table-v1/P5-assign.dc.html, src/screens/Lobby.tsx, src/screens/Assigning.tsx, src/components/Table.tsx (삭제 전 동작 파악: 방장 표시·끊김·pressable·전이), src/components/DayTable.tsx, src/styles/lobby.css, src/styles/phase.css (S-04 배정), src/styles/daytable.css, src/net/useSeatTransitions.ts, test/client/lobby.test.tsx, test/client/table.test.tsx, test/client/phaseScreens.test.tsx (S-04 describe), test/client/testTools.test.tsx (대기실 [테스트] 위치), scripts/e2e/flows.mjs (lobbyFlow·gameFlow), scripts/e2e/browser.mjs (startGame·setBots), src/components/PhaseBar.tsx, src/styles/ds.css (.mf-btn 높이, .mf-t-label)</read_first>
  <behavior>
    - 대기실·배정은 `DayTable` 을 그대로 쓴다. 자리는 n 명이 좌석 번호 순서로 타원에 등간격(내가 맨 아래 가운데, 2명 마주 봄, 3명 삼각)이고, 같은 인원·같은 폰이면 낮의 자리와 사각형이 같다
    - 대기실 기능 유지: 방장 왕관(role=img 이름 `방장`, 정확히 한 개) · 끊긴 사람 흐림과 자리 읽기 이름 `…, 연결 끊김` · 방장이 끊긴 다른 사람 자리를 누르면 내보내기 확인 시트 · 입장 420ms·퇴장 320ms 전이 표시(`mf-dt__seat--enter/--leave`) · 내 자리 링 · 마피아 동료 표시는 있던 자리에서만(배정 화면은 없음)
    - 인원이 바뀌면 나머지가 새 등간격 자리로 짧은 CSS 전이(left·top·transform, `--dur-med`)로 미끄러진다. 마운트 직후 첫 배치는 미끄러지지 않고, 축소 모션에서는 전이가 없다
    - 장면 상자: 헤더 119.2(대기실 바·배정 바 고정 높이) 아래 ~ 하단 패널 `calc(157px + 안전 영역)` 위, 좌우 여백 12(폭 < 390 은 4). 대기실 시트 안 내용은 호스트·게스트 모두 157 안에 든다(계산: 호스트 8+24+8+52+12 = 104, 게스트 8+24+8+(19.6+8+52)+12 = 131.6). 배정 화면은 헤더·빈 패널 157 을 갖고 어두운 막과 안내는 기존대로 위에 얹힌다
    - 배정 화면 마크업은 역할을 읽지 않는다(마피아 view 와 역할 없는 view 의 innerHTML 이 같다). [역할 카드]·타이머 없음
    - 옛 `Table`·`seatLayout` 과 대기실 퍼센트 기하 CSS 가 코드에 없다. `Table` 전용 테스트 단언은 DayTable·로비 테스트로 옮겼고 약해지지 않았다. Icon 테스트는 새 파일로 옮겼다
    - E2E: L6(대기실 둘이면 마주 봄·셋이면 삼각), 대기실 흐름의 T1(인원 1·2·3·5 에서 장면 상자·면·내 캐릭터 같음, 머리 119.2·시트 157)·T2, 게임 흐름의 T1 이 대기실 → 배정(잡히면) → 낮 → 밤 → 아침을 한 번에 비교
  </behavior>
  <action>
    진행 순서는 RED 커밋 → GREEN 커밋이다. 이 과제는 사용자 지시 「대기실·역할 배정도 같은 테이블 구성으로 고정, 하단 패널이 사라져도 늘어나지 않는다」(승인 시안 P2·P5)의 2부다. 서버 좌석 번호(`lowestFreeSeat` 등)와 낮 차례 순서는 바뀌지 않는다.

    가. RED — `test(qvx): 대기실·배정을 같은 테이블과 장면 상자로 통일하는 기준` 으로 커밋.
    - `test/client/dayTable.test.tsx`: 「DayTable 대기실 확장」 describe — (1) 자리 입력 `transition` 이 `entering`/`leaving` 이면 자리에 `.mf-dt__seat--enter`/`--leave`, 그 이름표에 `.mf-dt__tag--enter`/`--leave`, (2) 자리 입력 `onPress` 가 있으면 `button.mf-dt__seat` 이고 접근성 이름이 자리 읽기 이름(`…, 연결 끊김` 포함, 「대상」·「주장 기록 보기」 없음)·`aria-pressed` 없음·클릭하면 호출, 여러 핸들러가 함께 있으면 우선순위 `onPick` > `onInspect` > `onPress`, (3) prop `slide` 가 켜진 루트의 `.mf-dt--slide` 는 마운트 직후에는 없고 한 프레임 뒤(가짜 rAF)에 생긴다, (4) CSS 규약 — `.mf-dt--slide .mf-dt__seat` 가 left·top·transform 전이, `.mf-dt--slide .mf-dt__tag` 가 left·top 전이(`var(--dur-med)`·`var(--ease-out)`), 축소 모션 블록에서 전이 없음, 입장·퇴장 키프레임 존재(옛 대기실 CSS 의 420ms·320ms 지역 상수를 옮겨 온다), 코드 줄에 `#` 색 값 없음.
    - `test/client/lobby.test.tsx`: `Table` 마크업(퍼센트 left/top, `.mf-seat*`, 「방장」 글자 알약, 이름표 글자의 「(나)」)을 가정한 단언을 DayTable 마크업으로 옮긴다 — 방장 왕관 정확히 한 개(role=img `방장`), 끊긴 사람 자리 읽기 이름과 그림 흐림, 방장만·끊긴 다른 사람만·퇴장 중이 아닌 자리만 누를 수 있고 누르면 내보내기 확인 시트(제목 `○○님을 내보낼까요?`), 입장·퇴장 클래스가 `.mf-dt__seat--enter/--leave`(420ms·320ms 타이밍 그대로), 내 자리가 맨 아래 가운데(`left`·`top` 이 낮 배치와 같은 식의 결과), 동료 표시. 새 테스트: 인원 1~8 을 차례로 그려 자리들이 등간격 타원에 있고(인접 각 간격 2π/n), 2명은 마주 보고(상대 가로 중심 = 내 가로 중심, 세로로 위), 3명은 한 직선이 아니며, 같은 입력의 `DayTable` 직접 렌더와 자리 인라인 `left`/`top`/`transform` 이 같다(화면이 자기 기하를 따로 갖지 않는다). 대기실 머리가 119.2·시트가 157 로 고정이고 배경 높이를 `100dvh` 식으로 따로 계산하지 않는다.
    - `test/client/phaseScreens.test.tsx` S-04: 「테이블」 그룹이 DayTable 이고, 머리 `.mf-assign__bar`(제목 `역할 배정`)와 빈 패널 `.mf-assign__panel` 이 있으며, 막·맥박 링 3개·안내 문구·[역할 카드]/타이머 없음·마크업 역할 무관 단언은 그대로 둔다.
    - `test/client/dayScene.test.tsx`: 「장면 상자 좌우 여백…」 테스트 끝의 「옛 테이블 규칙은 없다」 단언 한 줄(`has(...).toBe(false)`)과 테스트 이름 끝의 그 문구는 옛 컴포넌트가 사라지므로 그 부분만 지운다. 나머지 단언은 그대로 둔다.
    - 새 `test/client/stageBox.test.tsx`: CSS 파일을 `readFileSync` 로 읽어(vitest 가 CSS import 를 비워 버리므로) 세 화면이 같은 상자를 쓰는지 교차 확인한다 — 머리 높이 119.2px(대기실 바·배정 바 고정, 낮 머리는 내용 높이로 119.2 임을 주석으로 연결), 패널 높이 `calc(157px + env(safe-area-inset-bottom))`(낮 패널·대기실 시트·배정 패널 모두), 장면 상자 좌우 여백 12px·`max-width: 389px` 에서 4px, `flex: 1`·`min-height: 0`, 대기실·배정 배경이 낮 배경과 같은 `flex: 1 1 0` 규칙(고정 높이 아님). 한 곳만 바뀌면 이 테스트가 깨진다(상수가 두 군데로 나뉘어 있어서).
    - `test/client/icon.test.tsx`(새) 와 삭제: 옛 `table.test.tsx` 의 Icon 11개 테스트는 새 파일로 옮기고, `Table` 전용 단언은 위 DayTable·로비 테스트로 옮긴 뒤 `table.test.tsx` 와 `test/unit/seatLayout.test.ts` 를 삭제한다. `TableSeat` 에 역할 키를 넣을 수 없다는 타입 테스트는 `DayTableSeat` 에 대한 같은 테스트로 옮긴다(이미 있으면 유지). `test/client/testTools.test.tsx` 의 [테스트] 버튼 위치 테스트는 `.mf-lobby__scene` 안 `.mf-tt-anchor` 를 그대로 유지한다.
    - `scripts/e2e/lib.test.mjs`: `lobbyShapeChecks(stage, { n, mySeat })`(id L6, 라벨 「대기실 자리: 둘이면 마주 봄·셋이면 삼각」) 테스트 — n=2 면 상대 발 가로 중심이 내 발 가로 중심과 ±0.5 같고 상대 발이 내 발보다 80px 이상 위, n=3 이면 세 발 점의 외적 절댓값 > 100 이고 쌍별 거리 > 60, n=1 이나 4 이상이면 건너뛰고 통과, 어긋나면 실패하고 이유를 말함.
    - 실행해 실패를 확인하고 커밋.

    나. GREEN — `feat(qvx): 대기실·역할 배정도 같은 테이블과 장면 상자를 쓴다 (결정 0028)` 로 커밋.
    - `src/components/DayTable.tsx` / `src/styles/daytable.css`: 자리 입력에 `transition?: "entering" | "leaving" | null` 과 `onPress?: () => void` 를 더하고 prop `slide?: boolean` 을 더한다. 전이 클래스는 자리와 이름표에 붙인다. `onPress` 자리는 `button.mf-dt__seat.mf-dt__seat--pick` 으로 그리고 접근성 이름은 자리 읽기 이름이다(핸들러 우선순위 `onPick` > `onInspect` > `onPress`). `slide` 는 마운트 직후 첫 프레임에는 켜지 않고 다음 프레임에 루트 클래스 `mf-dt--slide` 를 붙인다(`requestAnimationFrame`, 언마운트 때 취소). CSS: 옛 대기실 CSS 에 있던 입장·퇴장 키프레임을 옮겨 와 `.mf-dt__seat--enter .mf-figure` / `--leave .mf-figure`(그림만 움직여 자리의 scale 변환과 곱해지지 않게)와 이름표 페이드에 쓰고, `.mf-dt--slide .mf-dt__seat` 에 left·top·transform 전이, `.mf-dt--slide .mf-dt__tag` 에 left·top 전이(`var(--dur-med)`·`var(--ease-out)`), 축소 모션에서 전이·애니메이션 없음. 방장 표시는 기존 왕관을 그대로 쓴다.
    - `src/screens/Lobby.tsx`: `Table` 대신 `DayTable` 을 쓴다. 자리 입력은 `useSeatTransitions` 가 돌려준 `seated`(퇴장 중인 사람 포함)에서 만든다 — 좌석·닉네임·연결·방장·나·동료(`me.allies`)·`transition`, 방장이 끊긴 다른 사람 자리만 `onPress`(누르면 기존 내보내기 확인 시트). `slide` 를 켜고 `mySeat` 는 `view.me.seat`. 좌석 번호 배열(`SEAT_COUNT`)로 채우던 코드는 지운다. 머리(`.mf-lobby__bar`)는 높이 119.2px 고정(안쪽은 지금 구조: 나가기·공유 버튼 44×44 가 top 16, 가운데 `방 코드` 라벨 19.6 + 코드 43.2 → 아래 끝 78.8 ≤ 119.2), 장면 상자(`.mf-lobby__scene`)는 낮 장면 상자와 같은 규칙(flex 1·min-height 0·좌우 12/4 여백·position relative, `[테스트]` 닻은 그 안 첫 자식 그대로), 시트(`.mf-lobby__sheet`)는 높이 `calc(157px + env(safe-area-inset-bottom))`·padding `8px var(--space-md) calc(12px + env(safe-area-inset-bottom))`·gap `var(--space-sm)`·손잡이 막대 없음(낮 하단 패널 규칙). 배경(`.mf-lobby__backdrop`)은 낮·배정 배경과 같은 `flex: 1 1 0; min-height: 0; height: auto` 로 바꾼다. 문구·버튼·잠금·토스트·시트 로직은 바꾸지 않는다.
    - `src/screens/Assigning.tsx` / `src/styles/phase.css`: 머리 `.mf-assign__bar`(고정 높이 119.2, 제목 `역할 배정` 하나 — P5 시안, [역할 카드]·타이머는 없다: 배정 단계는 역할 정보를 읽지 않는다), 장면 상자 `.mf-assign__scene`(낮과 같은 규칙) 안의 `DayTable`(역할·동료 표시 없음, `slide` 없음), 빈 패널 `.mf-assign__panel`(높이 `calc(157px + env(safe-area-inset-bottom))`, 낮 패널과 같은 면·모서리)을 둔다. 어두운 막·맥박 링·안내 문구는 지금대로 화면 전체 위(`.mf-assign` 의 absolute)에 얹힌다. 옛 `.mf-assign__scene` 의 `.mf-table` 규칙은 지운다.
    - 삭제: 옛 `Table` 컴포넌트, `shared/seatLayout.ts`, `lobby.css` 의 `.mf-table*`·`.mf-seat*`·대기실 이름표 배치·퍼센트 기하 규칙과 쓰는 곳이 없어진 규칙(`grep` 으로 확인 — `ds.css` 의 `.mf-tag*` 는 링크 참가 화면이 쓰므로 남긴다). `lobby.css` 의 키프레임이 `daytable.css` 로 옮겨 갔는지 확인한다. 삭제한 것들의 다른 사용처가 없음을 `grep` 으로 확인한다(src·test·scripts·worker).
    - E2E: `lib.mjs` 에 `lobbyShapeChecks` 를 더한다. `browser.mjs`: `startGame(page, tracker, { onAssigning })` 가 [게임 시작] 뒤 `assigning` 이 보이면 300ms 기다려 `onAssigning()` 을 한 번 부르고(3초 창 안에서 `readStage` 하나만), `roleReveal` 까지 기다린다(배정이 이미 지났으면 건너뜀 — 실패 아님). `flows.mjs` `lobbyFlow`: 시작 직후(인원 1) `readStage` 로 T2·T1 기록, [봇 늘리기] 한 번(인원 2, 700ms 기다림) L6·T2, 한 번 더(인원 3) L6·T2, 그다음 기존 [5명 채우기]·[+]/[−] 단계를 그대로 하고 인원 5 에서 T2 와 지금까지 모은 항목의 T1(인원이 달라도 장면 상자·면·내 캐릭터가 같아야 한다 — 입장해도 늘어나지 않는다). 기존 L1~L5 와 시트 쪽 검사(`lobby/sheet` 시나리오의 T1 테스트 시트 열림·T2 닫힘)의 이름과 통과 기준은 그대로 둔다 — 새 기하 규칙 T1·T2(사용자 지정 이름)와 ID 가 겹치지만 시나리오 이름(`lobby/stage`·`{흐름}/table` 대 `lobby/sheet`)으로 결과 표에서 구분되고 코드에서는 서로 다른 곳에서 기록된다. `gameFlow`: [게임 시작] 직전(시트 닫기 전, 봇·직업 설정 뒤 700ms 기다린 상태)의 `readStage` 를 상태 `lobby` 로, `startGame` 의 `onAssigning` 에서 `assigning` 으로 `ctx.dayStates` 에 `{ state, felt, tags, stage }` 로 더한다(D7·D9 가 대기실·배정도 함께 본다). 끝의 T1 이 대기실 → 배정(잡힌 경우) → 낮 → 밤 → 아침을 한 번에 비교한다.

    다. 부분 로컬 E2E(커밋 전, 코드 변경 없음): `npm run dev` 를 백그라운드로 띄운 뒤 `npm run e2e -- --url http://localhost:5173 --only lobby`, `--only citizen4`, `--only mafia8` 를 돌린다. 대기실 → 배정 → 낮 → 밤 → 아침 T1 이 모든 크기에서 통과해야 하고, D7(테이블 안 움직임)이 모든 흐름에서 통과해야 한다. 대기실 머리 119.2 안에 방 코드·나가기·공유가 들어가고 [테스트](장면 상자 안, 위 8)가 머리를 가리지 않으며 G(가로 스크롤·화면 밖·탭 44)가 통과하는지 결과 표로 확인한다. 실패하면 완화하지 말고 원인을 고친다. 끝나면 dev 서버를 종료한다.
  </action>
  <verify>
    <automated>npx vitest run test/client/lobby.test.tsx test/client/phaseScreens.test.tsx test/client/stageBox.test.tsx test/client/dayTable.test.tsx test/client/icon.test.tsx test/client/testTools.test.tsx test/client/roomScreen.test.tsx test/client/dayScene.test.tsx && node --test scripts/e2e/lib.test.mjs && npm run typecheck && test ! -e src/components/Table.tsx && test ! -e shared/seatLayout.ts && ! grep -rnE "components/Table|shared/seatLayout|SEAT_COUNT|mf-table|mf-seat__" src test scripts worker shared && git diff --quiet bce014f -- shared/game worker</automated>
  </verify>
  <done>대기실과 역할 배정이 낮과 같은 DayTable·같은 장면 상자(헤더 119.2·패널 157)를 쓰므로 같은 인원이면 대기실 → 배정 → 낮 → 밤 → 아침에서 테이블과 내 캐릭터 사각형이 ±0.5 같고, 입장·퇴장 때 나머지가 등간격 새 자리로 미끄러진다(2명 마주 봄·3명 삼각). 방장 왕관·끊김 흐림·내보내기 누르기·입장/퇴장 전이는 그대로 동작하고 배정 화면은 역할을 읽지 않는다. 옛 `Table`·`seatLayout`·대기실 퍼센트 기하는 없고 테스트는 약해지지 않고 옮겨졌다. 부분 로컬 E2E 가 통과한다. RED/GREEN 커밋쌍이 있다.</done>
</task>

<task type="auto">
  <name>과제 5: 결정 0028·UI-SPEC·HANDOFF → 전체 검증 → 배포 → 배포본 확인 → push (U-05)</name>
  <files>docs/decisions/0028-test-feedback-fixes.md, .planning/phases/03.1-sequential-claims-role-card/03.1-UI-SPEC.md, HANDOFF.md</files>
  <read_first>docs/decisions/0027-sequential-claims-wire.md (형식), HANDOFF.md 상단 3.1 항목과 실기기 확인 목록, .planning/phases/03.1-sequential-claims-role-card/03.1-UI-SPEC.md, design/screens/table-v1/SPEC.md, scripts/prod-url.txt, wrangler.jsonc</read_first>
  <precondition>과제 1~4 의 커밋이 모두 있고 `npx vitest run`·`node --test scripts/e2e/lib.test.mjs` 가 통과한다. 배포 단계에 들어가기 전 `npx wrangler whoami` 출력에 dhkim1522@naver.com 이 있고 `wrangler.jsonc` 의 name 이 minifia 이다 — 하나라도 아니면 배포하지 않고 멈춘다.</precondition>
  <action>
    가. 문서(`docs(qvx): …` 한 커밋).
    - `docs/decisions/0028-test-feedback-fixes.md` 를 짧게 쓴다(형식은 0027: 제목, 상태 채택, 날짜 2026-10-25, 배경, 결정, 결과). 배경: 2026-10-25 실기기 테스트 피드백 4건과, 사용자가 승인한 시안 P2(`design/screens/table-v1/`)로 테이블·캐릭터 위치를 모든 상황에서 고정하라는 요청(이전에 범위 밖이던 「낮 테이블·캐릭터 위치 통일」을 이 결정이 포함한다). 결정 다섯 가지 — (1) 밤 끝 알림 제거(결정 0026-6 의 알림 조항을 대체, 앰버 점·탭 점·NEW 유지, UI-SPEC R6·S13 폐기, E2E R6 은 알림 없음 검사), (2) 차례 링을 자리 쌓임 맥락 안에서 뒤쪽 호 z −1·앞쪽 호 그림 위로 나눔(크기·두께·색·빛 불변, 바깥 z 규칙 불변, E2E K4), (3) 테이블·캐릭터 기하를 P2 로 고정(390폭 면 216×108·rx 146·cy 210·ry 100, 폭별 규칙 `rx = clamp(floor(장면 폭/2 + 여백 − 49), 124, 150)`·`면 폭 = 2·(rx − 38)` 와 context 의 산술 표, 시안 SPEC 의 규칙 「장면 폭/2 − 36.4」 대신 쓴 이유: 360폰에서 5글자 이름표가 최대 9.6px 화면 밖으로 나가고 면 폭 식이 승인값 216 을 재현하지 못함, 이름표 여유 49 의 칼날 경계 −0.5 와 대안 50(rx 145·면 214), 이름표가 양옆 자리(4·8명)에서 장면 상자 밖으로 최대 13px 나가지만 폰 안이라는 사실), (4) 장면 상자는 모든 단계에서 같다(헤더 119.2·하단 패널 157·여백 12/4)와 대기실·배정이 DayTable 을 쓰며 좌석 번호 순서의 등간격 자리에 인원 변화 때 미끄러진다(서버 좌석 번호·낮 차례 순서 불변, 옛 `Table`·`seatLayout`·비트반전 안은 폐기), (5) 밤 시작 문구는 클라이언트 오버레이(서버 단계·시간·와이어 불변, 길이 = DAY_ANNOUNCE_MS, 같은 epoch 의 비밤 → 밤에서만, 재접속·새로 마운트 제외, 막 색·중앙 불투명도 85% 는 디자인 재량). 결과에 되돌리기 비용(모두 화면 쪽 변경이라 쉬움; 기하 숫자는 `src/game/dayTable.ts` 한 곳)과 아티팩트 동기화 목록(화면설계서: R6 알림 화면 삭제, 차례 링 앞뒤 층, 밤 시작 문구, 대기실·배정·낮 공통 테이블 기하와 장면 상자; 디자인 시스템: 테이블 면·좌석 원 숫자; 디자인 세션 몫)을 적는다.
    - `03.1-UI-SPEC.md`: (알림) `grep -n "알림\|R6\|S13\|S10\|nb-toast\|rolecard-toast\|toast\|F4"` 로 모든 알림 관련 줄을 찾아 정리한다 — 필수: Spacing 예외 표의 S10·S13 폐기 표시 또는 삭제, D 절의 밤 끝 알림 문단 삭제, 열기 설명의 「알림을 누르면 활동 기록 탭」 삭제, E2E 표의 R6 행을 「밤 끝 알림이 화면에 없음(결정 0028)」 으로 교체, 확정 F4·모션 표의 알림 행·Copywriting 의 알림 문구 행·상태 표의 알림 언급·아티팩트 동기화 목록의 R6 알림 언급·`DayScene` 변경 설명·누르기 영역 44 목록·간격 sm/md 설명·글자 표의 알림 글자·앰버 예약 설명의 알림 언급을 고친다. (링) B 절 「테이블」 의 `.mf-dt__spot` 설명을 새 구조(묶음 + 뒤쪽/앞쪽 호, `left:-20%`·`bottom: calc(-4px - 12%)`, 크기·두께·빛 불변, 뒤쪽 호 z −1·앞쪽 호 그림 위)로 바꾸고, 「이름표 층 순서」 표에 링 두 호 행(자리 안에서 그림 뒤/위, 바깥 값 불변)을 더한다. (기하) `grep -n "132\|124\|280\|264\|rx\|테이블 면\|FELT\|좁은\|이름표가 얼마나\|맨 왼쪽 이름표\|장면 상자"` 로 옛 기하 숫자와 가독성 표를 찾아 새 값으로 바꾼다: 기하 상수 표(390폭 면 216×108 위 150·rx 146·ry 100·cy 210·캐릭터 72×96·k0 0.8)와 폭별 규칙·네 폭 표(context 의 표 그대로), 「이름표가 얼마나 보이는가」 표를 context 의 계산값으로 교체(바닥 수치는 그대로), D2 설명(폰 기준 −0.5 허용·양옆 5글자 이름표가 장면 상자 밖으로 최대 13px)·D3a/D3b 설명 갱신, E2E 표에 K4·N6·N7·T1·T2·L6 행 추가(T1·T2 의 ID 는 과제 3·4 에서 실제로 쓴 것과 같게). (장면 상자·대기실/배정) 「장면 상자는 모든 단계에서 같다」 절을 더한다: 머리 119.2·하단 패널 157·좌우 여백 12/4, 대기실·배정의 머리·시트·패널 계약(시트 안 내용 호스트 104·게스트 131.6 ≤ 157), 대기실 등간격 자리와 미끄러짐, 배정은 DayTable 위 어두운 막과 안내. 밤 시작 문구: 낮 시작 발표와 같은 방식이라는 한 문단(위치·길이·번짐·축소 모션·재접속 제외)과 모션 표 행을 더한다. 참고 자료 표에 `design/screens/table-v1/SPEC.md`·`P2-new5.dc.html`·`P5-assign.dc.html` 를 더한다(승인 사본은 고치지 않는다). 문서를 고친 뒤 같은 grep 들로 남은 옛 숫자·알림 언급이 의도된 「제거됨/대체됨」 표기뿐인지 확인한다.
    - `HANDOFF.md`: 「현재 상태」 맨 위에 이번 quick 항목을 더한다(제목에 quick 261025-qvx, 근거 결정 0028). 아직 배포 결과 칸은 비워 두고 아래 다/마 단계에서 채운다. 3.1 항목의 「밤 끝 알림」 언급과 실기기 확인 목록 (6) 의 360폭 알림 문장은 「(qvx 에서 제거)」 로 정리한다. 이번 항목에 새 실기기 확인 목록 — 차례 링이 캐릭터 발을 감싸 보이는지 · 밤 시작 문구가 읽히고 밤 선택을 방해하지 않는지와 길이 · **대기실 → 배정 → 낮에서 테이블과 캐릭터 위치가 그대로인지(늘어나거나 움직이지 않는지)** · **양옆 캐릭터가 테이블 면 바깥에 서는지(4·8명판)** · **5글자 이름표가 양옆 자리에서 폰 가장자리에 걸리지 않는지(칼날 경계 −0.5, 걸리면 이름표 여유 49 → 50)** · **인원이 들어오고 나갈 때 나머지가 고르게 미끄러지는지(2명 마주 봄·3명 삼각, 축소 모션에서는 이동 없음)** · 대기실 머리(방 코드·나가기·공유)가 119.2 안에 답답하지 않게 드는지 · 알림 없이도 앰버 점으로 새 기록을 알아차리는지 — 과 아티팩트 동기화 목록(결정 0028 결과 절과 같은 내용)을 적는다. `CLAUDE.md` 는 고치지 않는다.
    - 커밋 메시지 예: `docs(qvx): 결정 0028 과 UI-SPEC·HANDOFF 를 테스트 피드백과 테이블 기하 고정에 맞춘다`.

    나. 로컬 전체 검증(코드 변경 없음, 실패하면 원인을 고치고 해당 과제 방식으로 커밋).
    - `npm run typecheck`, `npx vitest run`(전체), `node --test scripts/e2e/lib.test.mjs` 가 모두 통과해야 한다. E2E 불변 상수 테스트(OVERLAP_EPS 0.5·ONE_LINE_FACTOR 1.6·FACE_RATIO 0.45·TAP_MIN 44·PANEL_H 157)와 TEXT_SIZE_ALLOW(.mf-journal__new·.mf-tt* 만) 테스트가 통과하는지 눈으로 확인하고 이 두 군데는 고치지 않는다. 허용 목록(`DECORATIVE_ALLOW`·`TAP_ALLOW`)에 항목을 더하지 않았는지 `git diff bce014f -- scripts/e2e/lib.mjs` 로 확인한다.
    - 서버 불변 확인: `git diff --stat bce014f -- shared worker` 가 비어야 한다(`shared/seatLayout.ts` 삭제는 예외 — 그 하나만 나와야 한다).
    - 로컬 E2E: 5173 포트가 비어 있는지 확인(`lsof -i :5173`)하고 `npm run dev` 를 백그라운드로 띄워 응답을 기다린 뒤(출력의 실제 주소 사용) `npm run e2e -- --url http://localhost:5173` 를 돌린다. 마지막 줄이 `E2E OK` 여야 한다(흐름 여섯 × 크기 셋 전부 통과, 새 검사 K4·N6·N7·R6·T1·T2·L6 포함, D7 이 대기실·배정까지 포함해 모든 흐름에서 통과). 실패하면 완화하지 말고 원인(앱 결함 또는 새 검사의 측정 오류)을 고친다 — 완화가 허용되는 것은 이미 승인된 M1·D3a/D3b·D4 뿐이다. D3a/D3b 바닥이 실패하면 낮추지 말고 멈춰 측정 숫자를 보고한다. 끝나면 띄운 dev 서버를 종료한다.

    라. 배포본 확인: `node scripts/smoke.mjs --prod --stage full --players 4`, `--players 5 --previous-version V`, `--players 8` 이 모두 `SMOKE OK full` 이어야 하고, `node scripts/e2e/run.mjs --url https://minifia.dhplay.workers.dev` 마지막 줄이 `E2E OK` 여야 한다. 실패하면 로컬로 되돌려 원인을 고치고 다시 배포한다.
    마. 마무리: `HANDOFF.md` 의 이번 항목에 새 배포 버전(스모크 출력의 version)·게이트 결과(vitest 파일/테스트 수, e2e 흐름/크기 통과, 스모크 3종 도착 편차)를 채우고 `docs(qvx): 배포 결과와 인계를 갱신한다` 로 커밋한다. `git status` 로 추적 안 된 `.planning/milestone.lock` 외 불필요한 파일이 없는지, `git remote -v` 가 개인 원격(git@github.com:dhkim1522/minifia.git)인지 확인한 뒤 `git push origin main` 한다. 이 계획의 `261025-qvx-SUMMARY.md` 를 최종본으로 다시 쓰고(진행 체크포인트 표시 제거, 남은 과제 없음) 함께 커밋·push 한다.
  </action>
  <verify>
    <automated>npm run typecheck && npx vitest run && node --test scripts/e2e/lib.test.mjs && git diff --quiet bce014f -- shared/game worker shared/protocol.ts shared/schemas.ts && test -f docs/decisions/0028-test-feedback-fixes.md</automated>
  </verify>
  <done>결정 0028·UI-SPEC·HANDOFF 가 갱신됐고(테이블 기하 고정·장면 상자·대기실 통일·실기기 목록·아티팩트 동기화 포함), 로컬 `npm run e2e -- --url http://localhost:5173` 와 배포본 `node scripts/e2e/run.mjs --url https://minifia.dhplay.workers.dev` 가 모두 E2E OK, 배포본 스모크 full 4·5·8명이 모두 SMOKE OK 다. Worker minifia 만 개인 계정(dhkim1522@naver.com)으로 배포됐고, 모든 커밋이 개인 원격 main 에 push 됐다.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| 서버 view → 화면 | 화면은 받은 값만 그린다. 새 화면 요소(링 호·밤 문구·대기실 슬롯)는 역할 정보를 입력으로 받지 않는다 |
| 공개 view → 공용 테이블(DayTable) | 대기실·배정·낮이 같은 부품을 쓴다. 입력은 공개된 좌석·닉네임·연결·방장뿐이고 배정 화면은 역할·동료를 읽지 않는다 |
| 개발 PC → Cloudflare 계정 | `npm run deploy` 가 어느 계정·어느 Worker 에 올리는지 |
| 개발 PC → git 원격 | push 대상이 개인 원격이어야 한다 |
| E2E 실행기 → 배포본 | 테스트 방만 만들고 토큰은 출력하지 않는다 |

## STRIDE Threat Register

Threat IDs 는 이 quick 안에서만 고유하다(`T-qvx-NN`). `T-qvx-SC` 는 예약이며 모든 계획이 가진다.

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-qvx-01 | Information Disclosure | 밤 시작 문구(NightIntro) | medium | mitigate | 문구는 `n`(일차)만 입력으로 받고 역할·생존 여부를 읽지 않는다. 역할 4종·탈락자 view 에서 글자가 같다는 단위 테스트(nightIntro.test.tsx) |
| T-qvx-02 | Denial of Service | 밤 시작 문구가 첫 2초 동안 터치를 가림 | medium | mitigate | `pointer-events:none`(CSS 테스트) + 밤 상태 E2E 의 N5(모든 대상 자리 탭 가능)·선택 동작(N2/N3)이 문구가 떠 있는 시점에도 통과, N6 이 pointer-events 를 확인, N7 이 사라짐을 확인 |
| T-qvx-03 | Information Disclosure | 대기실·배정이 DayTable 을 공유 | medium | mitigate | 배정 화면 마크업이 역할을 읽지 않는다는 기존 테스트(마피아 view 와 역할 없는 view 의 innerHTML 동일)를 유지하고, 자리 입력에 역할 키가 없다는 타입 테스트를 DayTable 쪽으로 옮겨 유지한다. 대기실의 동료 표시는 서버가 보낸 me.allies 에서만 만든다 |
| T-qvx-05 | Information Disclosure | E2E·스모크 새 코드(readNightIntro, ring 스냅숏) | low | mitigate | 새 스냅숏은 계산된 스타일·글자·DOM 순서만 읽고 프레임 원문·토큰을 싣지 않는다. 출력은 기존 redact 한 경로만 쓴다 |
| T-qvx-06 | Repudiation | 알림 제거로 새 일지를 알아차리기 어려워짐 | low | accept | [역할 카드] 앰버 점·탭 점·NEW 는 그대로이고 R1~R4 E2E 가 계속 보증한다. 실기기 확인 목록에 「알림 없이 점으로 알아차리는지」 를 넣는다 |
| T-qvx-07 | Tampering | 잘못된 원격으로 push | medium | mitigate | `git remote -v` 가 git@github.com:dhkim1522/minifia.git 인지 확인 후 push. `gh auth setup-git`·`~/.gitconfig` 변경 금지 |
| T-qvx-08 | Denial of Service | 새 기하가 이름표를 폰 밖으로 밀거나 캐릭터가 테이블 면에 걸림 | medium | mitigate | 폭별 규칙과 단위 불변식(장면 안·간격 ≥ 4·이름표 폰 안 −0.5·겹침 0), E2E G2·D2·D9·D4·T2·D3a/D3b. 5글자 이름표의 칼날 경계(−0.5)는 문서와 실기기 목록에 남기고 대안(여유 49 → 50)을 명시. 바닥이 실패하면 낮추지 않고 멈춰 보고 |
| T-qvx-09 | Tampering | 헤더 119.2·패널 157·여백 12/4 가 CSS 여러 곳에 있어 갈라질 위험 | low | mitigate | `stageBox.test.tsx` 교차 검사 + E2E T1(같은 폰에서 단계마다 장면 상자·패널 사각형이 같음) |
| T-qvx-SC | Tampering | npm/pip/cargo installs | high | accept | 이 계획은 패키지를 설치·추가하지 않는다(package.json·lock 불변). 설치가 필요해지면 멈추고 보고한다 |
</threat_model>

<verification>
- `npm run typecheck`, `npx vitest run`(전체), `node --test scripts/e2e/lib.test.mjs` 통과
- 서버 불변: `git diff --stat bce014f -- shared/game worker shared/protocol.ts shared/schemas.ts` 가 비어 있다(낮 기하 숫자는 과제 3 에서 의도적으로 바뀌었다)
- 옛 대기실 기하 제거: `test ! -e src/components/Table.tsx`, `test ! -e shared/seatLayout.ts`, 옛 식별자 grep(src·test·scripts·worker·shared) 0건
- 기하 산술: context 의 표가 `test/unit/dayTable.test.ts` 불변식으로 재현된다(rx·면 폭·장면 안 여백·간격 ≥ 4·이름표 폰 안 −0.5)
- 알림 잔재 없음: `test ! -e src/components/RoleCardToast.tsx`, `test ! -e src/styles/rolecard-toast.css`, 알림 식별자 grep(src·scripts/e2e) 0건
- 로컬 `npm run e2e -- --url http://localhost:5173` → `E2E OK` (K4·N6·N7·R6·T1·T2·L6 포함 전 항목, D7·D9 가 대기실·배정까지 포함)
- 배포본 `node scripts/smoke.mjs --prod --stage full` 4·5·8명 모두 `SMOKE OK full`, `node scripts/e2e/run.mjs --url https://minifia.dhplay.workers.dev` → `E2E OK`
- `git log` 에 과제 1·2(두 건)·3·4 각각 RED 커밋 → GREEN 커밋 순서가 보이고, 마지막에 push 된다
</verification>

<success_criteria>
- 사용자 지시 U-01~U-05 가 모두 구현되고, 금지된 변경(서버 규칙·시간·와이어, 서버 좌석 번호, 낮 차례 순서, 승인 시안 사본 수정)이 없다
- 같은 인원·같은 폰이면 대기실 → 배정 → 낮 → 밤 → 아침에서 장면 상자·테이블 면·내 캐릭터가 움직이거나 늘어나지 않는다(E2E T1)
- E2E 기준 수치와 허용 목록은 낮아지지 않았고 승인 완화 M1·D3a/D3b·D4 외 완화가 없다
- 로컬과 배포본에서 모든 자동 검사가 통과하고, 결정 0028·HANDOFF·UI-SPEC 이 현재 상태와 일치한다
- 실기기 확인 목록과 아티팩트 동기화 목록이 HANDOFF 에 남아 다음 세션이 이어서 확인할 수 있다
</success_criteria>

<output>
Create `.planning/quick/261025-qvx-test-feedback-fixes/261025-qvx-SUMMARY.md` when done
</output>
