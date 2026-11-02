---
phase: 08-day-execution-ghost
plan: "16"
subsystem: verdict-screen
tags: [tdd, tracer, gamemap, gamepanel, defense, verdict, execution, ghost-rise, fading]
status: complete

requires:
  - phase: 08-day-execution-ghost
    provides: 08-03 VerdictPicker, 08-05 HeadStack done·count·sure, 08-06 dayView(dayEvents·headerFor·ANNOUNCE_*), 08-08 presence(sceneLook·visibleSeats·executionFade), 08-13 GameMap·GamePanel·ResultAnnounce, 08-15 useDayFx 구조
provides:
  - GamePanel 찬반 줄 — 변론자 아닌 산 사람은 VerdictPicker + DotProgress('투표한 사람', 산 사람 − 1), 변론자 본인·유령은 점만, 키보드 열림이면 숨김
  - 찬반 한 표 — send verdict {agree}, 내 눌림은 즉시, 서버 me.verdictVote 가 이김, 투표한 좌석은 이름표 체크(done)만
  - 최후 변론 — 변론자 이름표만 지목 득표 배지 + 유력 도장 유지(공개 기록 voteLog), dayView.defenderVotes
  - 처형 — useDayFx fading(좌석 → 시작 시각)으로 변론자가 알림 시작(2.0초)에 떠오르고 4.4초에 장면에서 빠짐, 처형 단계의 비활성 찬반 줄
  - test/client/verdictScreen.test.tsx (32개)
affects: [08-17 유령 화면(처형된 본인 쪽 연출·직업 칩), 08-21 옛 단계 삭제, 08-23 E2E(찬반 줄 패널 높이 207/299)]

actuals:
  tokens: 8400
  tasks: 3
  commits: 6
plan_head_before: 17ac7595e6d9cf0bc3b2199b1efb8b8fc3cc1bbc
plan_head_after: d2a747403e7c62bf2eebdf67f447fafd72310ada

tech-stack:
  added: []
  patterns:
    - "처형 떠오름 연출 상태(fading)는 useDayFx 가 view 차이로 렌더 중에 정한다(이전 view 기억 방식): 처형 단계 view 는 처형된 사람이 이미 탈락으로 와서, 효과 단계(useEffect)에서 정하면 진입 한 프레임 동안 좌석이 사라졌다 돌아온다. 타이머는 끝난 좌석을 놓아주는 정리만 맡는다"
    - "연출 시작 시각을 미래(단계 진입 + at)로 두면 runtime 의 executionFade 가 음수 경과를 0 으로 보아 불투명 그대로 서 있다 — 별도 '대기' 상태가 필요 없다"
    - "서버가 보내지 않는 값(처형 단계의 me.verdictVote)은 화면이 마지막으로 본 값을 ref 로 이어 보여 준다"

key-files:
  created:
    - test/client/verdictScreen.test.tsx
  modified:
    - src/screens/GamePanel.tsx
    - src/screens/GameMap.tsx
    - src/screens/RoomScreen.tsx
    - src/net/useDayFx.ts
    - src/game/dayView.ts
    - src/styles/game.css

key-decisions:
  - "변론자 이름표의 득표 배지·도장은 최후 변론에서만 유지한다. 계획 작업 2 의 '변론·찬반·처형 분기' 대신 승인 보드(Verdict.dc.html 의 trialSure 는 trialOthers·trialSelf 만)와 UI-SPEC('최후 변론' 절)을 따라 찬반·처형에서는 배지가 사라진다"
  - "fading 상태는 계획의 '지연 이벤트를 타이머로 적용' 대신 렌더 중 view 차이로 정하고 타이머는 정리만 한다(진입 한 프레임 깜빡임 방지, 시험 '한 번도 사라지지 않고')"
  - "처형 단계에서도 찬반 줄(VerdictPicker 비활성)을 둔다. 서버는 처형 단계에 me.verdictVote 를 싣지 않으므로(view.ts) GamePanel 이 찬반 때 마지막으로 본 내 선택을 ref 로 이어 보여 준다. 점은 처형 단계에 없다(voted 가 오지 않는다)"
  - "찬반 점 개수·체크는 서버 값만(낙관적 done 없음). 내 눌림 하나만 응답 전에 바뀐다"
  - "공개 기록 voteLog 줄이 없으면(변론 단계에 처음 들어온 직후 등) 변론자 배지·도장을 그리지 않는다 — 득표 수를 꾸며 내지 않는다"
  - "찬반 줄의 간격은 .mf-game__verdict 의 gap 8 + 패널 gap 10 으로 쌓는다(UI-SPEC 84 + 8 + 9 + 10). chatUi.ts 에 높이 상수를 새로 만들지 않았다"

requirements-completed: []

coverage:
  - id: D1
    description: "찬반의 변론자가 아닌 산 사람 패널 = 찬성/반대 버튼 + '투표한 사람' 점(산 사람 − 1). 누르면 verdict {agree} 전송, 내 눌림만 즉시, 서버 me.verdictVote 가 이김, 소켓 닫힘(send false)이면 표시 불변"
    requirement: DAY-06
    verification:
      - kind: component
        ref: "test/client/verdictScreen.test.tsx '찬반 화면 — 한 표' (6 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "투표한 좌석 이름표에 체크(data-done)만 붙고 고른 값은 이름표·DOM 어디에도 없음. 변론자 본인과 유령은 점 + 채팅뿐"
    requirement: DAY-06
    verification:
      - kind: component
        ref: "test/client/verdictScreen.test.tsx '한 표'(다른 좌석 체크) · '신분별 패널·안내·조명'"
        status: pass
    human_judgment: false
  - id: D3
    description: "최후 변론: 안내 '{닉네임} 님의 변론'/'해명할 시간이에요', 변론자 이름표만 배지(voteLog 득표)+도장, 다른 배지·선두 없음, 행동 줄 없음, 조명 trial. 찬반: 안내 '{닉네임} 님을 처형할까요?'/'결과를 기다려요', 조명 vote·긴장 1(초점 변론자), 변론자 배지 사라짐"
    requirement: DAY-05
    verification:
      - kind: component
        ref: "test/client/verdictScreen.test.tsx '최후 변론 화면' (6 tests) · '찬반 화면 — 신분별 패널·안내·조명' (6 tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "키보드가 열리면 찬반 줄(버튼·점)이 숨고 채팅은 남으며 닫으면 돌아온다. 찬반 줄 CSS 간격 8, 진홍·놋쇠 없음"
    requirement: DAY-06
    verification:
      - kind: component
        ref: "test/client/verdictScreen.test.tsx '키보드가 열리면 숨고…' (2 tests) · '찬반 줄 배치 CSS' (1 test)"
        status: pass
    human_judgment: false
  - id: D5
    description: "처형 시간표: 0ms 알림 '찬성 5 · 반대 2'+같은 hot 줄+찬반 줄 disabled(내 선택 유지), 2.0초 '{닉네임} 님 처형' 알림·hot 줄, 변론자는 진입부터 한 번도 사라지지 않고 서 있다가 fadeAt=진입+2.0초, 4.4초에 장면 표·이름표에서 빠지고 다시 나타나지 않음"
    requirement: DAY-06
    verification:
      - kind: component
        ref: "test/client/verdictScreen.test.tsx '처형 화면' 앞 5 tests"
        status: pass
    human_judgment: false
  - id: D6
    description: "부결이면 2.0초에 '처형 없음' 1.4초 뒤 사라지고 어떤 좌석에도 fadeAt 이 없음. 재접속 첫 화면이 처형 단계면 알림·줄·연출 없이 처형된 사람이 없음"
    requirement: DAY-06
    verification:
      - kind: component
        ref: "test/client/verdictScreen.test.tsx '처형 화면' 부결·재접속 2 tests"
        status: pass
    human_judgment: false
  - id: D7
    description: "역할 비공개: 처형 단계 DOM 에 마피아·경찰·의사·시민·직업 칩·crimson 0건, 확인 시트 없음. 8자 닉네임 알림은 한 요소 한 문장이고 CSS 는 36px·keep-all·nowrap 없음·28px 없음. 연출은 서버 유령 위치가 아니라 fadeAt 만(장면 표 ghost 아님)"
    requirement: DAY-06
    verification:
      - kind: component
        ref: "test/client/verdictScreen.test.tsx '처형 화면' 마지막 3 tests + 역할 비공개 1 test"
        status: pass
    human_judgment: false
  - id: D8
    description: "전체: 타입 검사 통과(typecheck rc 0), client 58 파일 1840 통과, vite build 통과, 시험에 .skip/.todo 0건"
    verification:
      - kind: command
        ref: "npm run typecheck; npx vitest run --project client; npx vite build"
        status: pass
    human_judgment: false
  - id: D9
    description: "찬반 줄(엄지 두 칸 84 + 점)의 실제 화면 보기 좋음·패널 높이 207/299(폰 6종), 변론자가 떠오르며 흐려지는 연출과 이름표 함께 사라짐의 체감, 결과 알림 8자 닉네임 두 줄 감김의 보기"
    verification: []
    human_judgment: true
    rationale: "화면 시험은 DOM 속성·장면 표·타이머 시각을 고정할 뿐 시각 품질과 체감을 보지 않는다. 패널 높이와 폰 폭별 무가림은 가정대로 08-23 E2E 가, 떠오름 체감은 9페이즈 팀 테스트가 확인한다"

duration: 40min
completed: 2026-11-02
---

# Phase 8 Plan 16: 변론·찬반·처형 화면 Summary

**변론자 이름표만 득표 배지와 도장을 유지한 채 무대에 서고, 변론자가 아닌 산 사람은 엄지 두 칸으로 찬반을 던지며(서버 값이 이김, 남에게는 체크와 점만), 결과는 수만 알린 뒤 통과면 변론자가 알림 시작에 떠올라 4.4초에 산 사람 화면에서 사라진다 — 역할은 어디에도 없다.**

## Accomplishments

- **찬반 한 표 (DAY-06, 트레이서)**: verdict 단계에서 변론자가 아닌 산 사람의 아래 패널 맨 위에 `VerdictPicker` 와 `DotProgress`('투표한 사람', total = 산 사람 − 1)를 둔다. 누르면 `verdict {agree}` 를 보내고 내 눌림만 즉시 바뀌며 서버 `me.verdictVote` 가 오면 서버 값이 이긴다(`useViewChoice`, 거절 시 서버 값으로 복귀). 투표한 좌석은 서버 `day.voted` 로 이름표에 체크(`done`)만 붙는다. 무엇을 골랐는지는 이름표·점·채팅 어디에도 없다.
- **보기 패널 (DAY-06)**: 변론자 본인과 유령은 점 + 채팅뿐. 키보드가 열리면 찬반 줄(버튼·점)이 숨고 닫으면 돌아온다. 안내 문구는 08-06 `headerFor` 한 출처(변론자 '결과를 기다려요', 유령 '모두의 직업이 보여요').
- **최후 변론 (DAY-05)**: `dayView.defenderVotes` 가 그날 `voteLog` 줄의 `cand.votes` 에서 변론자를 가리킨 수를 주고, GameMap `tagProps` 가 변론자 이름표에만 `{count, sure}` 를 준다. 다른 이름표의 배지·선두는 없고 행동 줄도 없다. 조명 trial·고정 카메라는 08-08 표 그대로.
- **처형 (DAY-06)**: 결과 알림 시간표(0초 '찬성 n · 반대 m', 2.0초 처형/처형 없음)는 08-06·08-13 이 이미 만든 것이고, 이 계획이 `useDayFx.fading` 으로 떠오름을 연결했다. 처형 단계 view 에서 변론자는 이미 탈락으로 오는데, 화면은 그 순간부터 4.4초까지 좌석을 표에 붙잡는다(`fadeAt` = 진입 + 2.0초, 그 전에는 불투명 그대로). 끝나면 놓아주고 산 사람 화면에는 영영 없다. 처형 단계에서는 찬반 줄이 비활성(불투명도 0.45)으로 내 마지막 선택을 보인다.
- **누설 면**: 처형 단계 DOM 전체에 마피아·경찰·의사·시민·직업 칩·crimson 이 없다. 처형 확인 시트도 없다.

## TDD Gate Compliance

| 작업 | RED 커밋 | GREEN 커밋 | 비고 |
|------|----------|------------|------|
| 1 (트레이서) | c27fc0c | 25549f4 | RED: 새 시험 6개 전부 실패(버튼 없음·체크 없음) |
| 2 | 621e0e9 | 3177bb1 | RED: 21개 중 4 실패(변론자 배지·도장, 변론자·유령 점, CSS 규칙). 안내 문구·조명·긴장·키보드 시험은 이미 08-06·08-08·08-13 이 만든 동작의 특성 시험이라 통과 |
| 3 | 6051b00 | d2a7474 | RED: 32개 중 3 실패(비활성 찬반 줄·fadeAt/진입 프레임·ghost 아님). 알림 시간표·부결·재접속·역할 단어·8자 닉네임 시험은 기존 동작 고정이라 통과 |

**semanticAssessment**: 작업 1 RED 는 `expected [] to deeply equal ['yes','no']`·`Unable to fire a "click" event`·`expected null to be 'true'`(data-done 없음)로 계획한 단언의 실패다. 작업 2 RED 는 `expected null to be '4'`(변론자 배지 없음)·`expected +0 to be 2`(변론자 점 없음)·`expected null not to be null`(유령 점 없음)·`expected undefined to be defined`(CSS 규칙 없음). 작업 3 RED 는 `expected undefined to be 'true'`(처형 단계 찬반 줄 없음)·`expected undefined to be true`(장면 표에 도윤 없음)·`expected undefined to be false`(ghost 값 없음)이다. 작업 3 의 부결 시험은 처음에 내 계산 실수(1.4초 경계)로 실패해 시험을 고친 뒤 RED 커밋에 담았다(구현과 무관한 시험 오류였고 RED 증거에서 뺐다). `gsd_run check tdd-red-evidence` 는 따로 돌리지 않았다(08-10·08-12·08-15 와 같음).

**트레이서 게이트**: 작업 1 `<verify>`(`npx vitest run test/client/verdictScreen.test.tsx`) 통과 뒤 확장했다(⚡ Tracer verified end-to-end — expanding).

## Task Commits

| 작업 | 커밋 | 내용 |
|------|------|------|
| 1 RED | c27fc0c | test: 버튼·send verdict·낙관적 눌림·체크·점 |
| 1 GREEN | 25549f4 | feat: GamePanel 찬반 줄·GameMap done tagProps |
| 2 RED | 621e0e9 | test: 헤더 문구·변론자 배지·보기 패널·키보드·조명 |
| 2 GREEN | 3177bb1 | feat: 변론자 배지·도장, 점만 있는 보기 패널, 찬반 줄 CSS, defenderVotes |
| 3 RED | 6051b00 | test: 처형 알림 시간표·떠오름·처형 없음·역할 비공개 |
| 3 GREEN | d2a7474 | feat: useDayFx fading·RoomScreen/GameMap 연결·비활성 찬반 줄 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - 설계 어긋남 방지] 변론자 배지·도장은 최후 변론에서만**
- **Found during:** Task 2
- **Issue:** 계획 작업 2 의 action 은 "defense·verdict·execution 분기 — 변론자 좌석만 { count, sure: true }" 라 했으나, 승인 보드(`Verdict.dc.html` 의 `trialSure` 는 trialOthers·trialSelf 만)와 UI-SPEC 은 배지·도장 유지를 최후 변론 절에만 적는다. 찬반에서 변론자에게 "5표 · 유력" 을 계속 두면 찬반 투표를 앞서 누르는 효과가 되고 보드와 어긋난다.
- **Fix:** defense 에서만 준다. 찬반·처형에서는 이름표 쌓임이 체크(done)뿐이다. 시험('변론자 이름표에는 배지·도장이 없다')으로 고정.
- **Files modified:** src/screens/GameMap.tsx
- **Commit:** 3177bb1

**2. [Rule 1 - 버그 예방] 처형 떠오름 상태를 렌더 중에 정함**
- **Found during:** Task 3 설계
- **Issue:** 계획은 "지연 이벤트를 타이머로 적용하고 fading 상태로 돌려준다" 였다. 그러나 처형 단계 view 는 처형된 사람이 이미 탈락으로 와서 `visibleSeats` 가 그 좌석을 숨기므로, 효과 단계에서 fading 을 정하면 진입 한 프레임 동안 좌석이 표에서 빠져 런타임이 퇴장을 시작했다 돌아온다(떠오르기 전에 깜빡).
- **Fix:** `useDayFx` 가 렌더 중에 이전 view 와의 차이(`dayEvents.fx`)로 fading 을 같은 렌더에서 정한다(React 의 이전 값 기억 방식). 연출 시작 시각은 진입 + at(미래)이라 그 전에는 불투명 그대로다. 타이머는 끝난 좌석을 놓아주는 정리만 한다. 시험 '한 번도 사라지지 않고'가 진입 이후 기록된 모든 장면 표에 좌석이 있음을 단언한다.
- **Files modified:** src/net/useDayFx.ts
- **Commit:** d2a7474

**3. [Rule 3 - 막힘 해소] 계획 files_modified 밖 파일**
- **Issue:** fading 을 방 화면에서 GameMap 으로 잇는 데 `RoomScreen.tsx`(08-15 와 같은 이유로 useDayFx 를 쥐는 곳)가, 변론자 득표 수를 08-06 한 출처에서 읽는 데 `dayView.ts`(`defenderVotes` 추가)가 필요했다. 둘 다 작은 추가이고 기존 동작은 그대로다.
- **Files modified:** src/screens/RoomScreen.tsx, src/game/dayView.ts
- **Commit:** d2a7474, 3177bb1

**4. [Rule 1 - 버그 예방] 처형 단계 찬반 줄의 내 선택 유지**
- **Found during:** Task 3 설계
- **Issue:** 계획은 처형 단계에 VerdictPicker 를 disabled 로 둔다 했으나 서버(`view.ts`)는 찬반 단계에서만 `me.verdictVote` 를 싣는다. 그대로 두면 처형 단계에서 내가 고른 쪽이 사라진다.
- **Fix:** `GamePanel` 이 찬반 단계에서 마지막으로 본 내 선택을 ref 로 이어 처형 단계의 비활성 줄에 보인다. 재접속으로 처형 단계에 처음 들어오면 선택이 비어 있다(가정 A1 대로 상태만).
- **Files modified:** src/screens/GamePanel.tsx
- **Commit:** d2a7474

**Total deviations:** 4 auto-fixed. **Impact:** 의도한 동작은 모두 구현됐고, 배지 범위를 승인 보드에 맞췄으며, 처형 떠오름이 진입 순간에 깜빡이지 않도록 상태 정하는 자리만 옮겼다.

### 검증 방식 차이

- 계획 작업 2 의 `setLighting("trial")`·`setTension(1, 위치)` 와 작업 3 의 "좌석 3 캐릭터 제거" 는 08-15 와 같은 이유로 진짜 WorldStage + 가짜 런타임이 받은 **장면 표(`setScene`)** 로 단언했다(조명 `trial`/`vote`, 긴장 1·초점 좌석, 좌석 `fadeAt`·표에서 빠짐, 이름표 DOM 제거). 장면 표를 렌더러 호출로 옮기는 일과 `fadeAt` 으로 불투명도·높이를 그리는 일은 08-08·08-12 시험이 이미 고정한다.
- 키보드 열림은 `useMapInsets` 를 가짜로 바꿔 `kbOpen` 만 시험이 정한다(훅 자체는 `gameMap.test` 가 고정한다).

## Known Stubs

None. 스텁·자리표시 없음. `human_judgment` D9(시각 품질·체감)는 사람이 볼 항목으로 명시했다.

## Threat Flags

None — 새 네트워크 표면 없음. `verdict` 는 agree 불리언 하나만 보내고(T-08-41 대응으로 남의 값은 DOM·이름표 어디에도 없음을 시험), 처형 단계 DOM 에 역할 단어 0건(T-08-42), 알림은 텍스트 노드(T-08-43, 기존 `ResultAnnounce`). 패키지 설치 없음(T-08-SC).

## Self-Check: PASSED

- 파일 있음: test/client/verdictScreen.test.tsx, src/screens/GamePanel.tsx, src/screens/GameMap.tsx, src/screens/RoomScreen.tsx, src/net/useDayFx.ts, src/game/dayView.ts, src/styles/game.css
- 커밋 6개 모두 HEAD 의 조상: c27fc0c, 25549f4, 621e0e9, 3177bb1, 6051b00, d2a7474
- 인수 기준: `t: "verdict"`·`VerdictPicker` (GamePanel) / `해명할 시간이에요` (dayView)·`kbOpen` (GamePanel) / game.css 에 crimson·brass 0건 / `ghostRise` (useDayFx)·`fading` (GameMap) / 시험 `.skip(`·`.todo(` 0건 — 모두 성공
- 계획 검증: `npm run typecheck`(rc 0) · `npx vitest run --project client`(58 파일 1840 시험) · `npx vite build` 통과
