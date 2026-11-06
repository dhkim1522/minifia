---
phase: 14-host-and-labels
plan: "02"
subsystem: ui-host-band
tags: [host-band, data-guide, phase-header, map-header, minifia-v3, host-01, host-05, tool-02]
status: complete

requires:
  - phase: 14-01
    provides: 자막 띠(HostBand)·문구 표(hostLine.ts)·띠 아래 자리 변수
provides:
  - "data-guide 위치 이동 — 모든 방 화면에서 '지금 할 일' 표식은 자막 띠 문장(<p data-host-line data-guide>) 하나"
  - "PhaseHeader 의 guide prop 삭제 (제목 + extra, 꺼진 장치 화면만 hint·time·total)"
  - "기본판 맵 헤더·대기실 헤더 = 제목 + [역할 카드] / [나가기]·제목·[공유] (안내 줄·시간 링 없음)"
  - "guide.test 새 점검표(12단계 × 시점)와 HOST-05 DOM 누설 시험"
affects: [14-03, 14-04, 14-05, 14-06, 14-07, 14-09]

requirements-completed: [HOST-01, HOST-05, TOOL-02]

actuals:
  tokens: 14000
  tasks: 2
  commits: 4

plan_head_before: 8657f8c2274f26df3be13835774ded6bea3b6214
plan_head_after: b7705b2594ec823368fe787a1f92472547cf9593

tech-stack:
  added: []
  patterns:
    - "헤더 갈래 분리: MapHeader 가 꺼진 장치 여부(blockModeOf 또는 귓속말 모드)로 PhaseHeader(제목만)와 LegacyMapHeader(안내·링)를 나눠, 시계 훅은 꺼진 장치 갈래 안에만 둔다"
    - "화면당 data-guide 하나 = 띠 문장. 속성 값은 빈 문자열(역할·좌석 값 없음)"

key-files:
  created: []
  modified:
    - src/components/v2/HostBand.tsx
    - src/components/v2/PhaseHeader.tsx
    - src/screens/GameMap.tsx
    - src/screens/Lobby.tsx
    - src/screens/RoleReveal.tsx
    - src/screens/Assigning.tsx
    - src/screens/ResultScreen.tsx
    - test/client/guide.test.tsx
    - test/client/lobby.test.tsx
    - test/client/gameMap.test.tsx
    - test/client/ghostView.test.tsx
    - test/client/verdictScreen.test.tsx
    - test/client/nightMap.test.tsx
    - test/client/nominationScreen.test.tsx
    - test/client/runoffScreen.test.tsx

key-decisions:
  - "꺼진 장치 화면(day.turn 이 있는 순차 지목·결선·마지막 3인·귓속말 모드)은 13페이즈 계약 그대로 헤더 안내 줄·차례 링을 쓴다. 기본판 서버는 그 view 를 보내지 않아 나타나지 않는다(결정 0072 선례). 결정 0073 에 기록할 계획 선택 — 0073 파일은 아직 없다(14-09 에서 쓴다)"
  - "유령이 된 순간 헤더 안내 줄을 다시 띄우지 않는다. 직업 칩 등장 연출(data-ghost-enter)은 그대로"
  - "대기실은 안내 줄·접힘 상태(hintOn)·WorldStage onReady 전달을 모두 지웠다 (onReady 는 선택 prop 이라 다른 데 영향 없음)"

duration: 약 25분
completed: 2026-11-07
---

# Phase 14 Plan 02: 띠 하나로 합치기 (data-guide 이동 + 헤더 정리) Summary

**"지금 할 일" 표식 data-guide 를 자막 띠 문장 하나로 모으고, 기본판 맵 화면·대기실 헤더에서 안내 줄과 시간 링을 껐다. 헤더에는 단계 이름과 [역할 카드] 만 남고 남은 시간은 띠의 막대 + 초가 맡는다. 꺼진 장치 화면은 13 계약 그대로다.**

## 한 일

1. **Task 1 (RED `4e2e9665` → GREEN `aeac645c`)** — data-guide 를 띠 문장으로.
   - HostBand 문장 칸에 `data-guide=""` 추가. PhaseHeader 의 `guide` prop·안내 줄 data-guide 삭제. 대기실은 `<PhaseHeader title="대기실" />` 로 줄이고 hintOn·HINT_MS·onReady 효과를 지움. RoleReveal 안내 p·Assigning h2·ResultScreen 제목 h1 에서 data-guide 속성만 뗌(글자·요소는 그대로, 정리는 14-05).
   - guide.test.tsx 를 새 계약으로 다시 씀: 12단계 × 시점(대기실 none, 역할 확인 4, 나머지 5 + 결과)마다 `[data-guide]` 정확히 하나·`[data-host-band]` 안·글자 = `hostLineOf(view, {cardSeen:false})`·`data-guide`/`data-host-line` 값 빈 문자열(T-14-07). 08-18 의 "산 사람 안내 0개" 예외 삭제. describe "HOST-05 한 화면에 다른 역할 줄이 없다": 밤 5시점에서 night.mafia·police·doctor 중 내 줄만 있음, 밤 이외 7단계에서 역할 줄 없음, 할 일 없는 줄(낮 시작·변론 비변론자·처형·아침)은 산 네 역할에서 동일.
2. **Task 2 (RED `1fba0fc7` → GREEN `b7705b25`)** — 기본판 맵 헤더 = 제목 + [역할 카드].
   - `MapHeader` 가 `blockModeOf(view) !== null`(지목+day.turn·결선·마지막 3인) 또는 귓속말 모드(`hintOverride`)면 `LegacyMapHeader`(13 계약 그대로: 접히는 안내 + 시간·차례 링 + 시계 훅)로, 아니면 `PhaseHeader title extra` 만 그린다. 기본판 갈래에는 `useCountdown`·`useTurnLook` 이 없다.
   - ghostEnter 효과에서 `setHintOn` 만 지우고 `setEntering`(직업 칩 등장)은 유지. hintOn·HINT_MS 효과는 꺼진 장치 화면을 위해 남김.
   - 시험: gameMap 기본판 8단계 × 산 사람·유령에 `.mv-phase__hint`·`.mv-ring`·헤더 `[role=timer]` 0, 제목 하나, [역할 카드] 하나, 단추가 `.mv-phase__side` 안. ghostView 는 안내 줄 없음 + `data-ghost-enter` 켜졌다 꺼짐. verdict·night 헤더 시험은 "안내 줄 없음"(역할별 밤 줄 의미는 guide.test HOST-05 가 이어받는다는 주석). nomination·runoff(꺼진 장치)는 `data-guide` 대신 `.mv-phase__hint` 로 읽게만 바꿈(기대 문구 그대로).
   - U-6 확인: `show(` 호출은 표(투표 위 알림)·거절·연결 불안정·귓속말 수신·참가·퇴장·"N명부터 시작해요"(시작 거절) 뿐이다 — 단계 안내성 문구 없음, 지운 것 없음.

## 검증

- `npm test` 전체 초록: 239 파일 / 6933 통과(261 skip) (14-01 기준 6927 에서 +6). `npm run typecheck` 오류 없음.
- 수락 기준: HostBand `data-guide` 1, RoleReveal·Assigning·ResultScreen·PhaseHeader 의 `data-guide=` 0, `guide?: boolean` 0, guide.test `HOST-05` 1 이상, GameMap `^\s+guide$` 0, gameMap.test "기본판" 8(기준 3), `git diff --quiet 2736a336 -- worker shared` 성공(서버·공유 diff 0, T-14-02).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - 막힘 해소] Task 1 커밋에 GameMap 한 줄 포함**
- **Found during:** Task 1 GREEN (typecheck)
- **Issue:** PhaseHeader 에서 `guide` prop 을 지우자 GameMap MapHeader 의 `guide` 전달이 타입 오류를 냈다.
- **Fix:** 그 한 줄만 Task 1 커밋에서 지웠다. 나머지 GameMap 갈래 작업은 Task 2.
- **Commit:** aeac645c

**2. [Rule 1 - 계약 변경에 따른 시험 수정] 계획 파일 밖 없음 / 시험 문구 보정**
- 계획 목록 밖 파일은 건드리지 않았다. 다만 계획이 언급한 시험 외에 nightMap 의 "산 경찰 … 헤더 [role=timer] 있음" 단언(헤더 링이 없어짐)과 gameMap 의 "[역할 카드] 가 링 앞 형제" 단언(링이 없어짐)도 새 계약에 맞게 고쳤다 — "[역할 카드] 는 `.mv-phase__side` 에 홀로 있고 헤더 타이머 없음".
- **Commit:** b7705b25

**3. [참고] 14-01 이월 우회 중 그대로 둔 것**
- guide.test 의 "띠 밖 timer" 필터는 지목(꺼진 장치) 칸이 쓰므로 남겼다. roleCardFlow 의 statusCount 가 `[data-host-line]` 을 빼는 것은 띠가 영구히 있으므로 정당해서 남겼다. phaseScreens 의 `stageTimer`(띠 밖 timer 하나)는 역할 확인의 옛 `Timer` 때문이라 그 정리를 하는 14-05 에서 푼다.

### 계획 대비 보류

- 결정 0073 파일(`docs/decisions/0073-*`)은 아직 없어 "꺼진 장치 화면은 헤더 안내 줄·차례 링 유지" 계획 선택을 거기에 적지 못했다. 위 key-decisions 에 남겼고 14-09 에서 기록한다.

## Known Stubs

없음.

## Threat Flags

없음 (새 네트워크·인증·파일 표면 없음). T-14-06(역할 줄 누설)은 guide.test HOST-05 describe, T-14-07 은 data-guide·data-host-line 속성 값 빈 문자열 단언, T-14-02 는 서버·공유 diff 0 으로 완화 확인.

## Self-Check: PASSED
