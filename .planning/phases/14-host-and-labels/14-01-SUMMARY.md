---
phase: 14-host-and-labels
plan: "01"
subsystem: ui-host-band
tags: [host-band, hostLine, caption, timer-bar, minifia-v3, host-01, host-03, host-05, tool-02]
status: complete

requires:
  - phase: 13-basic-day-flow
    provides: 기본판 낮 흐름(15초 동시 투표), 꺼진 장치 화면 게이트, 투표 화면 색 약속
provides:
  - src/game/hostLine.ts — 사회자 문구 표(HOST_LINES)·hostKeyOf·hostLineOf·callTargetsOf·hostTimeOf·hostChimeOf (순수, 허용 목록만 읽음)
  - src/components/v2/HostBand.tsx — 자막 띠(종·문장·"{n}초"·막대)와 소리 단추 독, 띠 아래 자리 측정(--mf-host-top·bottom·dock)
  - bell 아이콘, .mv-host CSS 블록
  - 방 화면(쉬는 사람 제외) 모든 단계에 같은 자리·같은 모양의 띠
  - 띠 아래로 밀려난 자리 정리(테스트 단추·맵 칩·위 알림·스테이지 위쪽 안전선)
affects: [14-02, 14-03, 14-04, 14-05, 14-06, 14-07, 14-08, 14-09, 15]

requirements-completed: [HOST-01, HOST-03, HOST-05, TOOL-02]

actuals:
  tokens: 21200
  tasks: 3
  commits: 5

plan_head_before: 06d6bec0050ec66d619e5443f71ae7e83e1807f6
plan_head_after: 2f116ac0cd4581f982e528d0d9012fed098b03ea

tech-stack:
  added: []
  patterns:
    - "사회자 문장은 클라이언트가 자기 view 의 허용 목록 값만으로 만든다(서버 diff 0). 읽은 경로를 기록하는 Proxy 시험이 고정한다"
    - "띠 아래 자리는 방 틀 CSS 변수(--mf-host-top·bottom·dock)로 알리고, 측정이 0 이면 변수를 지워 CSS 기본값(옛 자리 70·62·80)으로 돌아간다"
    - "초마다 다시 그리기는 HostTime 안에 가둔다(맵은 다시 그리지 않음)"

key-files:
  created:
    - src/game/hostLine.ts
    - src/components/v2/HostBand.tsx
    - test/unit/hostLine.test.ts
    - test/client/hostBand.test.tsx
  modified:
    - src/components/v2/V2Icon.tsx
    - src/screens/RoomScreen.tsx
    - src/styles/v2.css
    - src/styles/lobby.css
    - src/styles/game.css
    - src/styles/result.css
    - src/net/useMapInsets.ts
    - test/unit/soundButtonSheet.test.ts
    - test/client/guide.test.tsx
    - test/client/lobby.test.tsx
    - test/client/phaseScreens.test.tsx
    - test/client/roleCardFlow.test.tsx
    - test/client/v2parts.test.tsx

key-decisions:
  - "[data-host-band] 는 띠 루트(.mv-host)에 둔다 — 소리 단추 독이 그 안에 있어야 시험·시트 숨김 선택자가 성립한다. 스테이지 안전선 측정은 그 안의 띠 면 '[data-host-band] .mv-host__band' 만 본다(독은 넣지 않음)"
  - "쉬는 사람·연결 실패·다른 창 안내 화면에는 띠 대신 소리 단추만 있는 HostDock 을 둔다(옛 자리 유지)"
  - "떠 있는 재접속 띠(.mf-reconnect--floating)는 같은 자리와 겹쳐 z 를 z-overlay + 2 로 올려 띠 위에 둔다"

patterns-established:
  - "HostKey = 단계 × 상태(act|wait|ghost) × 역할(밤만), 키마다 한 줄. 15페이즈는 errand·witness·trace 행에 문구만 채운다"

duration: 약 40분
completed: 2026-11-07
---

# Phase 14 Plan 01: 사회자 자막 띠 트레이서 Summary

**문구 표(hostLine.ts) 순수 함수 → 자막 띠(HostBand) → RoomScreen 연결 → 띠 아래 자리 정리까지 이어, 방 화면 모든 단계(쉬는 사람 제외)에 "무슨 일 + 내 할 일" 한 줄과 시간 막대·"{n}초"가 같은 자리에 보인다. 문장은 내 view 허용 목록 값만 읽고 서버·공유 diff 는 0 이다.**

## 한 일

1. **Task 1 (트레이서, RED `ec7503c7` → GREEN `cce47603`)** — 토론 view 에서 띠 한 줄 + 90초 막대가 방 화면에 뜬다.
   - hostLine.ts 뼈대(타입·표 자리·hostTimeOf), HostBand(종 `bell`·문장·"{n}초" `role="timer"`·막대·`data-tone`), 소리 단추를 방 틀 직속에서 띠 아래 독으로 옮김, 시트가 열리면 숨기는 선택자와 시험(soundButtonSheet)을 새 자리로 고침.
   - 단계가 바뀐 렌더에서만 문장 페이드·종 흔들림(key 를 단계로), 첫 마운트·같은 단계 안에는 없음. 모션 줄이기 블록에 즉시 교체·계단 막대 추가.
2. **Task 2 (RED `0d7e7775` → GREEN `4a4d7ce6`)** — 문구 표 전부(UI-SPEC 표 원문), hostKeyOf 단계×상태×역할 분기, callTargetsOf(빛남 계약 표), hostChimeOf(낮 시작→토론 제외).
   - 시험 56개: 키마다 한 줄, 36자 이하(8자 이름 포함 최대 34), 역할 이름 없음, 할 일 없는 줄은 역할과 무관, 예약 행, HOST-05 기록 Proxy(단계 14 × 시점 8 × cardSeen 2)와 허용 목록 밖 필드를 채운/지운 view 결과 동일.
3. **Task 3 (`2f116ac0`)** — 띠 아래 자리.
   - HostBand 가 헤더(헤더 안 단추 아랫변 포함)·띠 면·독 아랫변을 재서 방 틀에 `--mf-host-top`(헤더 + 8)·`--mf-host-bottom`·`--mf-host-dock` 을 쓴다(가상 뷰포트 이동 제외, 값이 같으면 다시 쓰지 않음, 측정 0 이면 지움, 띠가 사라지면 지움).
   - `.mf-lobby__test`·`.mf-lobby__map`·`.mf-game__test`·`.mf-result__map` top = `calc(var(--mf-host-bottom, 62px) + 8px)`, `.mv-toast--top` top = 독 아랫변 + 8, useMapInsets 스테이지 위 끝 = max(헤더, 띠 면 아랫변).

## 검증

- `npm test` 전체 초록: 239 파일 / 6927 통과(261 skip). `npm run typecheck` 오류 없음.
- 수락 기준: `git diff --quiet 2736a336 -- worker shared` 성공(서버·공유 diff 0, T-14-02). `grep` 기준 전부 충족(hostLine 함수 5, HostBand 2 이상, bell, mv-host, data-host-band, mf-host-bottom·dock).
- useMapInsets 의 띠 반영이 시험에 물리는지 확인했다(그 한 줄을 빼면 "스테이지 위쪽 안전선" 시험이 실패).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - 누락 기능] 쉬는 사람·안내 화면의 소리 단추 유지**
- **Found during:** Task 1
- **Issue:** 소리 단추가 띠 안 독으로 옮겨지면서, 띠가 없는 화면(쉬는 사람, 연결 실패·다른 창 안내)에서 소리를 끄고 켤 수 없게 된다. 옛 구현은 view 만 있으면 모든 화면에 있었다.
- **Fix:** 띠 없이 독만 그리는 `HostDock` 을 같은 파일에 추가하고 RoomScreen 이 그 경우에 쓴다. `[data-host-band]` 는 없다(T-14-04 유지).
- **Files modified:** src/components/v2/HostBand.tsx, src/screens/RoomScreen.tsx
- **Commit:** cce47603

**2. [Rule 3 - 막힘 해소] `data-host-band` 표식 위치**
- **Found during:** Task 1·3 계획 대조
- **Issue:** Task 1 은 표식을 루트(독 포함)에, Task 3 은 "띠 면에 이미 있다"고 적어 서로 어긋난다. 소리 단추가 `[data-host-band]` 안에 있어야 하는 시험은 루트 표식을 요구한다.
- **Fix:** 표식은 루트에 두고, 스테이지 측정은 `[data-host-band] .mv-host__band`(띠 면)만 읽는다. 독은 안전선에 넣지 않는다.
- **Commit:** cce47603, 2f116ac0

**3. [Rule 1 - 계약 변경에 따른 시험 수정] 기존 시험 5개 파일**
- **Found during:** Task 3 (`--project client`)
- **Issue:** 새 띠가 `role="timer"`·`role="status"` 를 하나씩 더해 옛 시계·상태 알림을 세는 시험이 깨졌고, v2.css 색 검사(놋쇠 금지)가 띠의 놋쇠·진홍 규칙을 잡았고, 대기실 [테스트] top 70 문자열이 바뀌었다.
- **Fix:** 판정을 느슨하게 하지 않고 새 계약으로 고쳤다 — 옛 시계 시험은 띠 밖 timer 만 세는 도우미(`stageTimer`), roleCardFlow 의 statusCount 는 `[data-host-line]` 제외, guide 의 모이는 중 링 없음은 띠 밖만, v2parts 의 예외 목록에 `.mv-host*`(14-UI-SPEC "색 약속 정리"), lobby 시험은 `--mf-host-bottom` 기본값 식. 14-02 가 옛 시계를 지우면 이 우회가 필요 없어진다.
- **Files modified:** test/client/{guide,lobby,phaseScreens,roleCardFlow,v2parts}.test.tsx
- **Commit:** 2f116ac0

**4. [처리] 재접속 띠 겹침**
- 떠 있는 재접속 띠(대기실, top 72)가 띠와 같은 자리라 `z-index` 를 `calc(var(--z-overlay) + 2)` 로 올려 띠 위에 두었다(새 자리 규칙 없음, 계획 Task 3-4).

**5. [절차] Task 3 의 RED 커밋을 따로 두지 못함**
- 띠·측정 구현을 먼저 써 두고 시험을 붙여 RED 단독 커밋이 없다. 대신 구현 한 줄을 되돌려 시험이 실패함을 확인한 뒤 한 커밋(`feat`)으로 묶었다. Task 1·2 는 RED 커밋이 있다(`ec7503c7`, `0d7e7775`).

## 알려진 사항

- **UI#13**(폰 6종에서 이름표 8개가 띠에 가려지지 않음)은 계획대로 14-08 E2E 가 잰다. **UI#14**(360×560 가장자리 이름표 잘림)는 가정·알려진 한계로 두었다.
- 옛 `data-guide`·헤더 시계·역할 확인 Timer 는 아직 그대로다(14-02 가 지우며 띠로 옮긴다) — 지금은 화면에 안내·시계가 중복된다. 의도된 중간 상태이며 시험은 띠 밖만 센다.
- callTargetsOf·hostChimeOf 는 구현·시험만 있고 아직 어느 화면·소리도 쓰지 않는다(14-03·14-04 가 쓴다). 예약 행 errand·witness·trace 의 빈 문구는 15페이즈용이다.
- 알려진 불안정 시험(continuity "옛 방장이…" 5초, bots 타이밍 2건)은 이번 전체 실행에서 통과했다.

## Known Stubs

없음. (예약 행 `errand`·`witness`·`trace` 의 빈 문자열은 15페이즈가 채우도록 계획에 명시된 의도이며 hostKeyOf 가 돌려주지 않아 화면에 나오지 않는다.)

## Self-Check: PASSED

- 생성 파일 존재: src/game/hostLine.ts, src/components/v2/HostBand.tsx, test/unit/hostLine.test.ts, test/client/hostBand.test.tsx — FOUND
- 커밋 존재(HEAD 의 조상): ec7503c7, cce47603, 0d7e7775, 4a4d7ce6, 2f116ac0 — FOUND
