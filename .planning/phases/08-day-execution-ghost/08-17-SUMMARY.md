---
phase: 08-day-execution-ghost
plan: "17"
subsystem: ghost-view
tags: [tdd, tracer, gamemap, worldstage, ghost, spectate, rolechip, usedayfx]
status: complete

requires:
  - phase: 08-day-execution-ghost
    provides: 08-03 RoleChip, 08-05 HeadStack role·ghost, 08-08 presence(visibleSeats·cameraModeOf), 08-09 서버 유령 전송 분리, 08-12 WorldStage tagProps·canWalk, 08-13 GameMap·headerFor, 08-15·16 useDayFx 구조
provides:
  - GameMap 유령 분기 — 내가 탈락했고 서버가 spectate 를 보냈을 때만 루트 data-ghost-view="true", 모든 이름표에 직업 칩(role), 죽은 좌석 ghost
  - WorldStage 죽은 좌석 이름표 data-ghost-seat (유령 화면에서만 생김)
  - useDayFx 유령이 되는 순간 — 산 → 탈락 전환에서 ghost 시스템 줄 한 번, ghostEnter 신호
  - GameMap 유령 안내 '모두의 직업이 보여요' 2.5초 재표시, data-ghost-enter, game.css 직업 칩 등장(dur-med, 모션 줄이기면 none)
  - test/client/ghostView.test.tsx (21개)
affects: [08-18 밤·아침 맵(유령 밤 화면), 08-19 DayScene 삭제(유령 시작 줄 규칙이 useDayFx 로 옮겨 옴), 08-23 E2E, 08-24 E2E H 묶음(이름표 글자 대비 A1)]

actuals:
  tokens: 9500
  tasks: 3
  commits: 5
plan_head_before: 62b3ad1f958a949fb4801a17bf9bd5b0ea87548b
plan_head_after: a762399b58a52e21423f33a42de697cf614c882f

tech-stack:
  added: []
  patterns:
    - "유령 분기는 서버가 보낸 값에서만 켜진다: ghost = (내 alive false) && view.spectate !== undefined. 산 사람 view 에 spectate 가 잘못 섞여 와도 내가 산 사람이면 분기가 없다(시험으로 변이 확인)"
    - "연출 신호는 번호(ghostEnter)로 넘기고 화면은 직전 번호를 ref 로 기억해 번호가 바뀔 때만 반응한다(처음 마운트의 값은 지난 일). 타이머는 효과 정리가 아니라 언마운트에서만 풀어 개발 모드 이중 실행에 안전하다"
    - "전환 감지(산 → 탈락)는 렌더 중 view 차이(번호)와 효과 단계(채팅 줄) 둘로 나눈다: 번호는 칩이 처음 그려지는 렌더에 같이 올라가야 하고, 채팅 줄은 chat 저장소의 마지막 줄을 읽어 중복을 거른다"

key-files:
  created:
    - test/client/ghostView.test.tsx
  modified:
    - src/screens/GameMap.tsx
    - src/components/WorldStage.tsx
    - src/net/useDayFx.ts
    - src/screens/RoomScreen.tsx
    - src/styles/game.css

key-decisions:
  - "data-ghost-seat 는 tagProps 가 ghost 를 준 좌석이거나 유령 viewer 의 장면 표 ghost 인 좌석에 붙는다. 둘 다 서버가 보낸 값에서 나오고 산 사람 화면에는 둘 다 없다"
  - "유령 시작 줄은 DayScene 규칙(직전 줄이 같은 안내면 생략)을 그대로 useDayFx 로 옮겼다. 밤·아침 탈락은 DayScene 도 같은 줄을 만들 수 있으나 마지막 줄 비교로 두 번 생기지 않는다"
  - "직업 칩 등장 연출은 유령이 된 순간에만 켠다(루트 data-ghost-enter, 2.5초). 재접속 첫 화면은 연출 없이 칩이 바로 서 있다. 모션 줄이기는 CSS media query 로 끈다"

requirements-completed: []

coverage:
  - id: G1
    description: "탈락한 내 view(+spectate): 루트 data-ghost-view 하나, 모든 이름표에 직업 칩(직업 이름 aria-label), 죽은 좌석 data-ghost-seat·data-ghost. spectate 가 없으면(산 사람 view, 또는 탈락했지만 서버가 안 보낸 경우) 셋 다 0개"
    requirement: GHOST-02
    verification:
      - kind: component
        ref: "test/client/ghostView.test.tsx '유령 화면 — 서버가 보낸 관전 정보로 그려진다' (4 tests)"
        status: pass
    human_judgment: false
  - id: G2
    description: "유령이 되는 순간: ghost 아이콘 시스템 줄 한 번(재전송·재렌더에도 하나), 처형으로 탈락해도 한 번, 안내 '모두의 직업이 보여요' 2.5초 후 접힘, 루트 data-ghost-enter 2.5초, 재접속 첫 스냅샷은 줄·연출 없음"
    requirement: GHOST-01
    verification:
      - kind: component
        ref: "test/client/ghostView.test.tsx '유령이 되는 순간' (6 tests)"
        status: pass
    human_judgment: false
  - id: G3
    description: "유령 조작: 지목·찬반·토론 끝내기 버튼 없음, 지목 단계에서도 맵 탭으로 move 전송(산 사람은 안 함), 토론 follow·그 밖 fixed 카메라, 채팅 안내 '유령끼리만 보여요'. 유령이 보내는 point·verdict·endDiscussion 없음"
    requirement: GHOST-01
    verification:
      - kind: component
        ref: "test/client/ghostView.test.tsx '유령 조작 없음 · 걷기 · 카메라' (5 tests) · '유령은 산 사람과 상호작용하지 않는다' (1 test)"
        status: pass
    human_judgment: false
  - id: G4
    description: "산 사람 화면 단계 전수(낮 시작·토론·지목·변론·찬반·처형): data-ghost-view·data-ghost-enter·data-role-chip·data-ghost-seat·data-ghost 0개, '유령끼리만 보여요'·'유령 채팅'·'모두의 직업이 보여요' 0건, 이름표·장면 표 좌석 = 산 좌석, 잘못 섞인 spectate·유령 채널 chat/typing 프레임에도 흔적 없음"
    requirement: GHOST-02
    verification:
      - kind: component
        ref: "test/client/ghostView.test.tsx '산 사람 화면에는 유령의 흔적이 없다' (5 tests)"
        status: pass
    human_judgment: false
  - id: G5
    description: "전체: 타입 검사 통과, client 59 파일 1861 통과, vite build 통과, 시험에 .skip/.todo 0건"
    verification:
      - kind: command
        ref: "npm run typecheck; npx vitest run --project client; npx vite build"
        status: pass
    human_judgment: false
  - id: G6
    description: "직업 칩이 이름표 위에 나타나는 등장 연출의 보기·반투명 0.6 이름표 글자 대비(A1)·유령 떠다님 체감"
    verification: []
    human_judgment: true
    rationale: "화면 시험은 DOM 속성·CSS 규칙 존재만 고정할 뿐 시각 품질을 보지 않는다. 대비 측정은 08-24 E2E H 묶음, 체감은 9페이즈 팀 테스트"

duration: 14min
completed: 2026-11-02
---

# Phase 8 Plan 17: 유령 화면 Summary

**탈락한 내 view 에 서버가 실어 보낸 관전 정보(spectate)가 있을 때만 유령 화면이 그려진다 — 모든 이름표 위에 직업 칩, 죽은 좌석은 반투명, 지목·찬반·토론 끝내기 없이 맵을 걷고 유령끼리 채팅하며, 산 사람 화면 DOM 에는 유령의 흔적이 단계 전수로 0건이다.**

## Accomplishments

- **유령 분기 (GHOST-02, 트레이서)**: `GameMap` 이 `ghost = 내 alive 거짓 && view.spectate 있음` 으로 루트에 `data-ghost-view` 를 달고, `tagProps` 를 겹쳐 모든 좌석에 `role`(spectate.seats 의 job), 죽은 좌석에 `ghost: true` 를 준다. `WorldStage` 는 죽은 좌석 이름표 div 에 `data-ghost-seat` 를 단다. 산 사람 view 에는 spectate 키가 없어 이 분기 전체가 그려지지 않는다(받아서 CSS 로 감추는 방식이 아니다).
- **유령이 되는 순간 (GHOST-01)**: `useDayFx` 가 직전 view 의 내가 산 사람이고 지금 탈락이면 `CHAT_TEXT.channelStart.ghost` 시스템 줄(ghost 아이콘, 직전 줄이 같으면 생략)을 한 번 만들고 `ghostEnter` 번호를 올린다. `GameMap` 은 번호가 바뀔 때만 안내 '모두의 직업이 보여요'를 2.5초 다시 보이고 루트에 `data-ghost-enter` 를 켜서 직업 칩이 dur-med 로 나타나게 한다(모션 줄이기면 none). 이전 채팅 기록은 건드리지 않는다. 재접속 첫 스냅샷은 줄도 연출도 없이 칩·반투명·유령 채널로 돌아온다.
- **유령 조작·걷기·카메라**: 08-13·15·16 의 조건 분기(산 사람만 버튼)가 이미 유령에게 지목·찬반·토론 끝내기를 막고 있어 코드를 더하지 않고 시험으로 고정했다. `canWalk = canMoveIn(phase, meAlive)` 가 이미 유령의 모든 단계 걷기를 허용하고, 카메라는 08-08 `cameraModeOf` 가 토론 follow·그 밖 fixed 를 준다. 채팅 입력은 유령 채널 안내 '유령끼리만 보여요'.
- **산 사람 쪽 0건 (T-08-44)**: 유령 둘이 있는 판의 산 사람 view 로 6개 낮 단계를 모두 그려 유령 속성·문구 0건, 이름표·장면 표 좌석 = 산 좌석을 확인했다. 변이 확인: `spectate` 를 내 생존과 무관하게 읽도록 바꾸면 '잘못 섞인 spectate' 시험이 실패한다.

## TDD Gate Compliance

| 작업 | RED 커밋 | GREEN 커밋 | 비고 |
|------|----------|------------|------|
| 1 (트레이서) | eaf9ea6 | 40abb7b | RED: 4개 중 2 실패(data-ghost-view 없음, data-ghost-seat 없음). 산 사람 0개 시험 2개는 현재 동작 고정이라 통과 |
| 2 | 0ce104d | 44f4838 | RED: 15개 중 4 실패(유령 시작 줄, 안내 재표시, data-ghost-enter·CSS). 유령 조작 없음·걷기·카메라·채널 안내 시험은 08-13·15·16 이 이미 만든 동작의 특성 시험이라 통과 |
| 3 | (없음) | a762399 | 시험만 더하는 작업이고 구현은 작업 1·2 에서 끝나 있어 RED 가 없다(계획 구조상 특성 시험). 대신 변이 확인으로 시험이 실제로 잡는지 보았다 |

**semanticAssessment**: 작업 1 RED 는 `expected null to be 'true'`·`expected false to be true`(data-ghost-seat 없음)로 계획한 단언의 실패다. 작업 2 RED 는 `expected [] to deeply equal [ {text, icon} ]`(시스템 줄 없음)·`expected true to be false`(안내가 접힌 채)·`expected null to be 'true'`(data-ghost-enter 없음)다. 처음 RED 를 돌릴 때 '살아 있는 사람 화면' 시험이 시작 안내 '지목 시작' 줄 때문에 실패해 단언을 '유령 줄이 없다'로 좁힌 뒤 RED 커밋에 담았다(구현과 무관한 시험 오류). `gsd_run check tdd-red-evidence` 는 따로 돌리지 않았다(08-10·08-12·08-15·08-16 과 같음).

**트레이서 게이트**: 작업 1 `<verify>`(`npx vitest run test/client/ghostView.test.tsx`) 통과 뒤 확장했다(⚡ Tracer verified end-to-end — expanding).

## Task Commits

| 작업 | 커밋 | 내용 |
|------|------|------|
| 1 RED | eaf9ea6 | test: data-ghost-view·직업 칩·죽은 좌석 표시 |
| 1 GREEN | 40abb7b | feat: GameMap 유령 분기·WorldStage data-ghost-seat |
| 2 RED | 0ce104d | test: 유령이 되는 순간·유령 조작 없음·걷기·카메라 |
| 2 GREEN | 44f4838 | feat: useDayFx ghostEnter·유령 시작 줄, GameMap 안내·등장 속성, game.css 칩 등장 |
| 3 | a762399 | test: 산 사람 화면 유령 흔적 0건 단계 전수 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - 막힘 해소] 계획 files_modified 밖 파일**
- **Issue:** 유령 안내·칩 등장 신호를 방 화면에서 GameMap 으로 잇는 데 `RoomScreen.tsx`(08-15·16 과 같은 이유로 useDayFx 를 쥐는 곳)에 한 줄이 필요했다.
- **Files modified:** src/screens/RoomScreen.tsx
- **Commit:** 44f4838

**2. [Rule 1 - 버그 예방] 연출 타이머를 효과 정리에서 풀지 않음**
- **Found during:** Task 2 구현
- **Issue:** '번호가 바뀔 때만 반응'하는 효과에서 타이머를 효과 정리로 풀면 개발 모드 이중 실행이 첫 실행의 타이머를 지워 data-ghost-enter 가 켜진 채 남는다.
- **Fix:** 타이머를 ref 에 두고 언마운트 때만 푼다.
- **Files modified:** src/screens/GameMap.tsx
- **Commit:** 44f4838

**Total deviations:** 2 auto-fixed. **Impact:** 의도한 동작은 모두 구현됐다.

### 검증 방식 차이

- 계획 작업 3 의 "가짜 렌더러 addCharacter 좌석" 은 08-15·16 과 같은 이유로 가짜 런타임이 받은 장면 표(`setScene`)의 좌석 키로 단언했다(표에 없는 좌석은 캐릭터도 이름표도 생기지 않음은 08-08·08-12 시험이 고정).
- 계획 작업 2 의 "동작: 유령 view 의 입력 placeholder" 는 채팅 입력 `[data-chat-input]` 의 placeholder·aria-label 로 읽었다.

## Known Stubs

None.

## Threat Flags

None — 새 네트워크 표면 없음. 유령 분기는 서버가 보낸 spectate 가 있을 때만 그려져(T-08-44) 단계 전수 DOM 0건과 변이 확인으로 고정했고, 유령에게 지목·찬반·토론 끝내기 UI 가 없다(T-08-45). 패키지 설치 없음(T-08-SC).

## Self-Check: PASSED

- 파일 있음: test/client/ghostView.test.tsx, src/screens/GameMap.tsx, src/components/WorldStage.tsx, src/net/useDayFx.ts, src/screens/RoomScreen.tsx, src/styles/game.css
- 커밋 5개 모두 HEAD 의 조상: eaf9ea6, 40abb7b, 0ce104d, 44f4838, a762399
- 인수 기준: `data-ghost-view`·`spectate` (GameMap) / `data-ghost-seat` (WorldStage) / `channelStart.ghost` (useDayFx) / 시험 `it(` 21개 / `.skip(`·`.todo(` 0건 — 모두 성공
- 계획 검증: `npm run typecheck`(rc 0) · `npx vitest run --project client`(59 파일 1861 시험) · `npx vite build` 통과
