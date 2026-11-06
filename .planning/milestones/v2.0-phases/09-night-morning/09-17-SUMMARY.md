---
phase: 09-night-morning
plan: "17"
subsystem: client-will-note-screen
tags: [will, note, quill, sheet, keyboard-lift, tdd, tracer]
status: complete

requires:
  - phase: 09-night-morning
    provides: WillSheet·useComposedText (09-08), ChatPanel 깃펜 onWill (09-11), will·note 서버와 me.will·me.note (09-12), 밤 시민·경찰·의사 아래 패널 (09-15), me.nightSure (09-07)
provides:
  - src/net/useWill.ts — useWill 훅(시트 열림·초안·저장 확인·실패·사망/확정 풀림 닫기·초점 복귀), WILL_SAVE_TIMEOUT_MS
  - GamePanel 의 [유언](밤 시민·경찰·의사)·[쪽지](밤 산 마피아) 행동 줄과 낮·아침·밤 마피아 깃펜 배선
  - GameMap 의 유언·쪽지 시트 층(.mf-will-layer)과 키보드 배치(패널 가림·compact·초점 복귀)
  - useKeyboardLift 의 inSheet·useVisualViewportHeight
affects: [09-18, 09-19, 09-20]

actuals:
  tokens: 16500
  tasks: 3
  commits: 6
plan_head_before: e30c9cd6d5d7dccc7eee5f031302a3f709808771
plan_head_after: 5143f1e53391c32553fcd2004970361c22adfebe

tech-stack:
  added: []
  patterns:
    - "저장 확인은 서버가 본인에게 보낸 view 의 me.will·me.note 가 보낸 글의 정리한 값(sanitizeChatText)과 같아지는 것으로 한다. 3초 안에 안 바뀌거나 거절이 오면 실패"
    - "시트 부품은 바꾸지 않고 층 선택자(.mf-will-layer)로 키보드 lift 대상에 넣는다"

key-files:
  created:
    - src/net/useWill.ts
    - test/client/willFlow.test.tsx
  modified:
    - src/screens/GamePanel.tsx
    - src/screens/GameMap.tsx
    - src/net/useKeyboardLift.ts
    - src/net/useMapInsets.ts
    - src/components/v2/ChatPanel.tsx
    - src/styles/night.css
    - src/styles/v2.css
    - test/client/nightMap.test.tsx

key-decisions:
  - "저장 확인 비교는 서버와 같은 정리 함수(sanitizeChatText)를 지난 값으로 한다 — 앞뒤·겹친 공백이 서버에서 정리돼도 저장 실패로 오인하지 않는다"
  - "저장하지 못한 글은 종류별로 훅이 기억해 다시 열면 이어 쓴다(쪽지는 확정이 풀려도, 유언은 닫기 저장 실패·연결 끊김에도). 서버가 확인하면 지운다"
  - "시트 textarea 초점으로 열린 키보드는 채팅 패널 압축·행동 줄 숨김을 일으키지 않는다(kbInSheet) — 시트를 연 버튼이 남아야 닫을 때 초점이 돌아온다. 패널은 lift 로 올라간다"
  - "유언·쪽지 저장 중 거절은 알림 '보내지 못했어요. 다시 해 보세요' 한 번만 — GameMap 오류 핸들러가 저장 대기 중이면 '지금은 고를 수 없어요'를 띄우지 않는다"

requirements-completed: [WILL-01, NIGHT-12]

metrics:
  duration: 약 25분
  completed: 2026-11-03
---

# Phase 9 Plan 17: 유언·쪽지 화면 흐름 Summary

**밤 시민 편 [유언] 행동 줄과 마피아 [쪽지] 행동 줄, 채팅 깃펜을 같은 useWill 훅·WillSheet 로 이어, 서버 me.will·me.note 로 저장을 확인하고 실패·사망·확정 풀림·키보드 배치까지 처리했다.**

## 수행 내용

- **Task 1 (tracer)**: useWill 훅과 GamePanel 밤 시민·경찰·의사 [유언] 줄, GameMap 시트 층. 버튼 -> 시트 -> `{t:"will"}` 한 번 -> 서버 me.will -> "저장됨". 같은 값은 보내지 않고, 닫기(바뀐 내용 있음)도 같은 한 메시지를 보낸 뒤 초점이 [유언] 버튼으로 돌아온다. 전 과정 typing 0회.
- **Task 2**: 산 사람·지도 단계에만 ChatPanel 깃펜(onWill·willOpen·willSaved), 유령·로비에는 없음. 밤 산 마피아 [쪽지]: 확정 전 `aria-disabled` + `aria-describedby` 숨김 글, 확정이면 쪽지 시트(tone mafia, `{t:"note"}`). 실패(send false, 거절, 3초), 빈 칸 저장, 사망·단계 이탈 닫기, 확정 풀림 닫기와 초안 보존, 연결 끊김 `aria-disabled`.
- **Task 3**: `.mf-will-layer` 안 textarea 도 키보드 lift 대상. 패널 + 시트 + 8 이 visualViewport 높이 − 62 를 넘으면 패널을 가리고(`data-will-hide-panel`) 시트만 키보드 위에 붙이며, 높이 300 미만이면 compact(2줄).

## 검증

- `npx vitest run test/client/willFlow.test.tsx` 30 통과, `npm run typecheck` 통과, `npx vitest run --project client` 45 파일 1478 통과, `npm run tokens:check` 통과, test 폴더 `.skip(`·`.todo(` 0건.
- 인수 기준 grep 3개 모두 통과.

## 계획과 다른 점

### Auto-fixed Issues

**1. [Rule 3 - 차단] 후보 0명 시험의 패널 글자 기대값**
- **Found during:** Task 1
- **Issue:** `nightMap.test.tsx` "후보가 0명(경찰 혼자 산 가짜 view)" 이 패널 글자를 빈 문자열로 단언했는데 이제 [유언] 줄이 있다.
- **Fix:** 기대값을 "유언"으로 바꾸고 시민 시험 제목을 "[유언] 행동 줄뿐"으로 고쳤다.
- **Files modified:** test/client/nightMap.test.tsx
- **Commit:** 8216ccf

**2. [Rule 2 - 필수 기능] 깃펜의 연결 끊김 aria-disabled**
- **Found during:** Task 2
- **Issue:** 계획이 canSend 거짓일 때 깃펜도 `aria-disabled` 를 요구하지만 ChatPanel 깃펜에는 그 속성이 없었다.
- **Fix:** ChatPanel 깃펜에 `aria-disabled={sendDisabled ? "true" : undefined}`(바인딩의 sendDisabled 는 `!canSend`), v2.css 에 불투명도 0.45 규칙 한 줄. GamePanel 의 onWill 도 canSend 가 거짓이면 열지 않는다.
- **Files modified:** src/components/v2/ChatPanel.tsx, src/styles/v2.css
- **Commit:** e832783

**3. [Rule 3 - 차단] useMapInsets 노출 값 추가**
- **Found during:** Task 3
- **Issue:** 시트 textarea 초점으로 켜진 키보드와 채팅 입력 초점의 키보드를 GameMap 이 구분해야 하는데 useMapInsets 가 kbOpen 만 노출했다(계획 파일 목록 밖).
- **Fix:** useMapInsets 가 `kbInSheet` 를 노출한다. GameMap 은 kbOpen(압축·행동 줄 숨김)과 lifted(패널 상승)를 나눠 GamePanel 에 넘긴다.
- **Files modified:** src/net/useMapInsets.ts
- **Commit:** 5143f1e

**Total deviations:** 3 auto-fixed. **Impact:** 범위 안의 연결 작업이고 새 와이어·서버 변경 없음.

## 이월·알려진 한계

- **A1 (E7 #39, 계획 가정 그대로)**: 360x560 키보드 열림에서 시트가 헤더에 닿을 수 있다. 2줄 compact 로만 줄이고 더 고치지 않는다.
- 닫기 저장이 실패(send false)하거나 연결이 끊겨 보내지 못하면 시트는 닫히고 글은 훅이 기억한다(닫기를 막지 않는다). 계획의 "저장 실패는 시트가 열린 채"는 [저장] 버튼 경로에만 적용.
- 실기기에서 visualViewport 와 `.mf-will-layer` 위치(패널 위 8, 키보드 위)·시트 textarea 초점 복귀는 육안 확인하지 못했다(자동 시험은 happy-dom 에서 offsetHeight 를 값으로 대신함). 실기기 검사 이월.
- E7 #40(다른 소켓이 받는 프레임 없음)은 backstop — 09-12·09-16 서버 시험이 증명한다. 이 계획은 클라이언트가 typing 을 보내지 않음을 시험했다.

## Known Stubs

None.

## Threat Flags

None. 새 네트워크 경로·권한 경계 없음(`{t:"will"}`·`{t:"note"}` 는 09-12 에서 이미 있음).

## Self-Check: PASSED

- 생성 파일: src/net/useWill.ts, test/client/willFlow.test.tsx 존재.
- 커밋 a3ed558, 8216ccf, c8e0207, e832783, 365ee20, 5143f1e 모두 HEAD 의 조상.
