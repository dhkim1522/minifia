---
phase: 07-free-chat
plan: "18"
subsystem: free-chat-typing-indicator
tags: [chat, typing-indicator, head-stack, camera, day-table, useChat]
status: complete

requires:
  - phase: 07-free-chat
    provides: "07-03 HeadStack typing·chatUi 상수, 07-05 ChatStore typingSeats·nextTypingExpiry, 07-10 서버 typing 중계, 07-13·07-15 useChat·ChatPanel"
provides:
  - "useChat: 입력 중 보내기 규칙(켜짐·2초 갱신·4초 무입력 꺼짐·조합 시작·비움·보냄·블러·단계·채널·끊김·언마운트)과 ChatBinding.typingSeats"
  - "WorldStage typingSeats 속성 → 로비 이름표 위 알약, DayTable DayTableSeat.typing → 테이블 이름표 위 알약"
  - "camera.ts HEAD_STACK_H, PANEL_HEIGHT 250, 다시 정한 PAN_BOX 5.7·PLATE_FAR 17"
  - "E2E chat-lobby CL6~CL8 입력 중 단계"
affects: [07-19, 07-20, 07-21]

actuals:
  tokens: 13288
  tasks: 3
  commits: 4
plan_head_before: f46f73cf7fa3538115413e35958b0d9839d0d710
plan_head_after: 7b16750573febd98ad344fac9b381488197485a0

tech-stack:
  added: []
  patterns:
    - "입력 중 상태는 훅이 쥔다: 최신 연결·단계 키는 live ref(useLayoutEffect)로 읽고 타이머는 콜백에서 stopTyping/touchTyping 만 부른다"
    - "수신 만료는 저장소의 nextTypingExpiry 시각에 정확히 타이머를 걸어 다시 계산한다(+1ms 지연 없음)"
    - "ChatPanel 에 넘기지 않을 값은 화면 틀이 구조 분해로 떼어 WorldStage·DayTable 로 넘긴다"

key-files:
  created: []
  modified:
    - src/net/useChat.ts
    - src/components/WorldStage.tsx
    - src/screens/Lobby.tsx
    - src/components/DayTable.tsx
    - src/screens/DayScene.tsx
    - src/styles/daytable.css
    - src/world/camera.ts
    - scripts/e2e/flows.mjs
    - test/client/useChat.test.tsx
    - test/client/worldStage.test.tsx
    - test/client/dayTable.test.tsx
    - test/client/discussion.test.tsx
    - test/client/defense.test.tsx
    - test/client/lobby.test.tsx
    - test/client/roomScreen.test.tsx
    - test/unit/camera.test.ts
    - .planning/phases/07-free-chat/deferred-items.md

key-decisions:
  - "단계 키·채널이 바뀔 때의 꺼짐도 서버에 보낸다(현재 pk 로). 서버 relay 는 단계 전환 때 이미 비워져 조용히 버려질 뿐이라 해가 없고, 채널만 바뀐 경우(같은 단계)에는 새 채널로 꺼짐이 간다."
  - "연결이 끊기면(canSend 거짓) 화면의 내 알약만 끄고 서버에는 보내지 않는다. 돌아온 뒤 다음 입력이 켜짐으로 다시 시작된다."
  - "PAN_BOX 를 ±4.8 에서 ±5.7 로, PLATE_FAR 를 18.5 에서 17 로 다시 정했다(스테이지가 채팅 패널로 줄고 이름표 위로 22px 늘어난 새 가시성 기준의 최소값)."
  - "PANEL_HEIGHT 를 lobbyPanelHeight(LOG_H_SHORT)=250 으로 바꿨다. 로비는 패널을 DOM 에서 재서 넘기므로 이 값은 측정 전 기본값일 뿐이다."

requirements-completed: [CHAT-04]

coverage:
  - id: D1
    description: "한 폰이 입력칸에 글자를 넣으면 같은 채널을 보는 다른 폰의 그 사람 이름표 위에 알약(data-typing true)이 뜨고, 칸을 비우면 사라진다. 내 화면의 내 알약은 서버 왕복 없이 즉시 켜진다"
    requirement: CHAT-04
    verification:
      - kind: e2e
        ref: "npm run e2e -- --url http://localhost:5173 --only chat-lobby (6개 크기 23/23, CL6·CL7·CL8)"
        status: pass
      - kind: unit
        ref: "test/client/useChat.test.tsx#내 좌석은 켜짐 직후 서버 왕복 없이 typingSeats 에 들어 있다"
        status: pass
    human_judgment: false
  - id: D2
    description: "보내는 쪽 규칙(첫 글자 켜짐 1회, 2초 갱신, 4초 무입력 꺼짐, 비움·보냄·블러·단계·채널 꺼짐, 연결 끊김 때 미전송)이 시험으로 고정되었다"
    requirement: CHAT-04
    verification:
      - kind: unit
        ref: "test/client/useChat.test.tsx#useChat: 입력 중 보내기 (CHAT-04, UI-SPEC 머리 위 입력 중)"
        status: pass
    human_judgment: false
  - id: D3
    description: "받는 쪽 규칙(4.5초 자동 꺼짐, 채팅 줄 도착 시 꺼짐, 연결이 끊긴 사람 제외, 8명 동시)과 화면에서 만들어 내는 다른 좌석 알약이 없음"
    requirement: CHAT-04
    verification:
      - kind: unit
        ref: "test/client/useChat.test.tsx#useChat: 입력 중 받기 (CHAT-04, T-07-46)"
        status: pass
      - kind: unit
        ref: "test/client/worldStage.test.tsx#이름표 위 입력 중 알약 (CHAT-04, 07-18)"
        status: pass
    human_judgment: false
  - id: D4
    description: "v1.0 테이블 화면(낮 토론·변론·밤·탈락자)에서 이름표 위 옛 말풍선 자리에 같은 알약이 뜬다(서버가 보낸 typing 과 내 입력만)"
    requirement: CHAT-04
    verification:
      - kind: unit
        ref: "test/client/dayTable.test.tsx#DayTable: 이름표 위 입력 중 알약 (CHAT-04, 07-18)"
        status: pass
      - kind: unit
        ref: "test/client/discussion.test.tsx#서버가 보낸 입력 중 좌석의 이름표 위에만 알약이 뜨고"
        status: pass
    human_judgment: true
    rationale: "테이블 장면에서 알약이 이름표 위 가운데에 겹치지 않고 읽히는지의 눈 확인은 07-19 CDP·07-21 iPhone 몫이다. 구조·위치 CSS 규칙은 시험으로 고정"
  - id: D5
    description: "알약은 글자가 없고 aria-hidden 이며 모션 줄이기에서는 점 3개가 정지한 채 보인다"
    requirement: CHAT-04
    verification:
      - kind: unit
        ref: "test/client/dayTable.test.tsx#v2.css: 모션 줄이기면 입력 중 점 애니메이션이 꺼진다"
        status: pass
    human_judgment: false
  - id: D6
    description: "카메라 가시성 검사가 이름표 높이에 입력 중 칸 22px 를 더하고 채팅 패널이 들어온 새 스테이지 사각형으로 다시 돌아 6개 크기 전 격자점이 통과한다"
    requirement: CHAT-04
    verification:
      - kind: unit
        ref: "test/unit/camera.test.ts#가시성: 걷는 영역 전 격자점 × 6개 폰 크기 (UI-SPEC E1 overflow)"
        status: pass
    human_judgment: false
---

# Phase 7 Plan 18: 머리 위 입력 중 알약 Summary

**useChat 입력 중 보내기 규칙(2초 갱신·4초 무입력 꺼짐)과 typingSeats 를 로비 맵 이름표·테이블 이름표에 연결하고, 카메라 가시성을 입력 중 칸 22px + 채팅 패널 스테이지로 다시 정했다(PAN_BOX 5.7·PLATE_FAR 17).**

## 수행한 일

- **Task 1 (트레이서, 6024219)**: useChat 이 빈 칸의 첫 글자에 `{t:"typing", on:true, pk}` 를 보내고 칸이 비면 끈다. `typingSeats` = 저장소의 받은 좌석 − 연결 끊긴 사람 + 내 입력 중이면 내 좌석. Lobby 가 WorldStage 에 `typingSeats` 를 넘겨 `HeadStack typing` 에 연결. E2E chat-lobby 에 CL6(손님 입력 → 방장 화면 손님 이름표 `data-typing`), CL7(내 화면 즉시), CL8(비움 → 사라짐)을 더했다. 로컬 서버 6개 크기 모두 통과.
- **Task 2 (RED 6e93b6a → GREEN e43285d)**: 보내기 규칙 전부(2초 갱신, 4초 무입력 꺼짐, 조합 시작, 블러·단계·채널·끊김·언마운트 꺼짐), `onComposingChange`·`onInputBlur` 를 ChatBinding 에 포함. DayTable `DayTableSeat.typing` 과 `.mf-dt__typing`(이름표 위 가운데, 간격 4), DayScene 이 `typingSeats` 로 채움. 수신 만료 타이머가 만료 시각 +1ms 에 걸려 4.5초 정각에 꺼지지 않던 것을 고쳤다(시험이 잡음).
- **Task 3 (7b16750)**: `HEAD_STACK_H = NAMETAG_H + TYPING_PILL_H`(46), `PANEL_HEIGHT` 250. 가시성·빈 배경 검사가 크기별 `lobbyPanelHeight(logHeightFor(h))` 스테이지(328·352·564·248·476·506)와 HEAD_STACK_H 로 돈다. 6페이즈 값(±4.8)은 360x640 에서 1.5px, 360x560 에서 41.5px 넘쳐 **PAN_BOX 를 ±5.7**(걷는 영역 5.8 안쪽), **PLATE_FAR 를 17** 로 다시 정했다. 크기별 최소 pan: 360x640 4.9 · 360x560 5.7 · 390x664 4.6 · 390x844 4.6 · 402x874 4.5 · 430x932 4.3. 크기별 가장 먼 바닥: 12.0·11.1·12.4·13.7·14.1·14.9. 숫자는 camera.ts 주석에 06-03 형식으로 남겼다.

## 검증

- `npx vitest run` 142 파일 3817 통과(1 skip 은 `describe.runIf` 근거 표 출력). `npm run typecheck` 오류 0. `npx vite build` 통과.
- E2E(로컬 서버): chat-lobby 6개 크기 23/23, chat-table 6개 크기 33/33.
- 시험 안의 `.skip(`·`.todo(` 0건.

## Deviations from Plan

### 자동 수정

**1. [Rule 3 - 막힘] 기존 시험이 typing 송신을 한 번에 센다**
- **Found during:** Task 1 검증
- **Issue:** 글자를 넣으면 이제 `typing` 이 먼저 나가 `send.mock.calls[0]` 이나 `toHaveBeenCalledTimes(1)`·`sent.length` 로 chat 메시지를 보던 시험 5개가 깨졌다.
- **Fix:** 해당 단언을 chat 메시지만 걸러 보게 고쳤다(의도는 그대로).
- **Files modified:** test/client/defense.test.tsx, discussion.test.tsx, lobby.test.tsx, roomScreen.test.tsx, useChat.test.tsx (plan files_modified 밖이지만 같은 변경의 직접 결과)
- **Commit:** 6024219

**2. [Rule 1 - 버그] 수신 입력 중 만료가 4.5초에 꺼지지 않음**
- **Found during:** Task 2 RED
- **Issue:** 만료 타이머를 `expiry − now + 1ms` 에 걸어 정확히 4500ms 에는 알약이 남았다.
- **Fix:** 지연을 `expiry − now` 로(타이머가 일찍 울려도 다음 만료를 다시 건다).
- **Files modified:** src/net/useChat.ts
- **Commit:** e43285d

**3. [Rule 1 - 버그] worldStage 시험이 PAN_BOX 4.8 을 박아 둠**
- **Found during:** Task 3
- **Fix:** `PAN_BOX.maxX` 를 쓰게 고침.
- **Files modified:** test/client/worldStage.test.tsx
- **Commit:** 7b16750

**4. [Rule 3 - 막힘] 근거 표 출력이 보이지 않음**
- **Issue:** `CAMERA_PRINT=1` 의 `console.log` 가 vitest 설정에서 가려져 크기별 숫자를 읽을 수 없었다.
- **Fix:** `process.stdout.write` 로 바꿈.
- **Files modified:** test/unit/camera.test.ts
- **Commit:** 7b16750

**Total deviations:** 4 (Rule 1 ×2, Rule 3 ×2). **Impact:** 계획 범위 안, 범위 확장 없음.

### TDD 메모

useChat 구현(GREEN)은 RED 커밋 전에 작업 트리에 먼저 있었다. 새 시험 9개가 구현 전에는 실패하는 것을 실제로 확인한 뒤(9 failed) 같은 시험을 RED 커밋에 담았고, DayTable·DayScene 쪽은 RED 커밋 시점에 실제로 5개가 실패했다.

## 사용자 위임에 따른 추천안 선택

없음 (체크포인트 없이 끝났다).

## 로컬 서버

07-16 이 띄운 서버(`GSD 가 띄움`, `npm run dev` PID 9710 / vite PID 9732, 포트 5173)를 그대로 썼다. 이 계획이 따로 띄운 서버는 없고, 마지막 검증 뒤 위 두 PID 를 끝냈다(5173 닫힘 확인). 사용자가 미리 띄운 서버는 아니었다.

## Known Stubs

없음.

## Deferred Issues

`deferred-items.md` 에 두 건을 올렸다.
- E2E world 흐름이 360x560 에서 이동 목적지를 못 찾는다(S4). PAN_BOX 를 되돌려도 같은 실패라 이 계획 변경과 무관하며, 하네스 탐색 조건 문제다 → 07-20.
- perfScene 이 `PANEL_HEIGHT` 를 공유해 스테이지 사각형 기본값이 바뀜 → 07-21 판정 때 필요하면 확인.

## Threat Flags

없음. T-07-46(받을 권리 없는 좌석 알약 없음): `typingSeats` 는 저장소가 서버 프레임으로만 채운 좌석과 내 좌석뿐이고 시험으로 고정했다. T-07-47(송신 빈도): 켜짐 1회 + 2초 갱신 + 4초 꺼짐을 시험으로 고정. T-07-SC: 패키지 설치 없음.

## Self-Check: PASSED

- 4개 작업 커밋(6024219, 6e93b6a, e43285d, 7b16750)이 HEAD 의 조상임을 확인.
- 수정 파일 존재, acceptance grep 3묶음 통과, 전체 vitest·typecheck·vite build 통과.
