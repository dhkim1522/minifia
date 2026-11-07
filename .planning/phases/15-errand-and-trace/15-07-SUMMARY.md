---
phase: 15-errand-and-trace
plan: "07"
subsystem: client-record-trace
tags: [witness-record, trace-card, hostline, tool-button, record-card, trace-card, minifia-v3, d-04, d-06, d-08, d-09]
status: complete

requires:
  - phase: 15-02
    provides: "view.me.record(RecordLine[]) — 토론에서 3곳을 마친 산 사람 본인에게만"
  - phase: 15-03
    provides: "view.day.morning.trace(조각 id 9개 중 하나, 탈락자가 있는 아침에만), 아침 +MORNING_TRACE_MS"
  - phase: 15-04
    provides: "placeIconOf·V2Icon(timeline·eye·thread)·hostLine errand 행·허용 목록 주석"
  - phase: 15-05
    provides: "GameMap errand 분기·ErrandLayerProps 와 별개의 층"
provides:
  - "src/game/traceText.ts: TRACE_TEXT(조각 9개 닫힌 표)·TRACE_NOTE('누구의 것인지는 모릅니다')"
  - "src/game/recordView.ts: recordRowsOf(view)(me.record 유무 → 줄|null, 최대 RECORD_MAX)·traceWindowOf(view, serverNow)(phaseEndsAt - MORNING_TRACE_MS 부터)"
  - "hostLine: HOST_LINES.witness·trace 채움, HostLocal.recordOpened·traceOn, CallTool 'record', witness→tool record"
  - "RecordCard(section[data-record-card][data-record-rows])·TraceCard(div[data-trace-card][role=status])·ToolButton call·expanded"
  - "GameMap: 헤더 [기록](span[data-record-button] 안 ToolButton), 열림 래치·입력칸 포커스 접힘·--mf-record-bottom 측정·아침 흔적 구간 시계·card 신호 한 번"
  - "HostBand local prop + RoomScreen 의 onHostLocal(맵 화면의 recordOpened·traceOn 을 띠에 전달)"
affects: [15-08, 15-09, 15-10]

requirements-completed: [ERRAND-05, TRACE-02, TRACE-03]

actuals:
  tokens: 22000
  tasks: 3
  commits: 6

plan_head_before: 59db7133fb53b42aa83c80c682bd63f33ae180a9
plan_head_after: aa297bd6c6ed48fa7da94c7acd25c501065313de

tech-stack:
  added: []
  patterns:
    - "사회자 띠가 읽는 클라이언트 상태(recordOpened·traceOn)는 맵 화면이 소유하고 콜백으로 방 화면에 올려 띠(HostBand)가 읽는다. 언마운트 때 빈 값으로 비운다"
    - "단계·일차 키 래치(recordOpenKey·recordSeenKey): 키가 바뀌면 자동으로 풀린다(14 의 callUsedKey 선례)"
    - "흔적 구간 소리는 구간 시작 전에 마운트했을 때만 남은 ms 를 담아 한 번 보낸다(이미 구간 안이면 0)"

key-files:
  created:
    - src/game/traceText.ts
    - src/game/recordView.ts
    - src/components/v2/RecordCard.tsx
    - src/components/v2/TraceCard.tsx
    - test/unit/traceView.test.ts
    - test/client/recordTrace.test.tsx
  modified:
    - src/game/hostLine.ts
    - src/components/ToolButton.tsx
    - src/components/v2/HostBand.tsx
    - src/screens/GameMap.tsx
    - src/screens/RoomScreen.tsx
    - src/styles/v2.css
    - src/styles/game.css
    - test/unit/hostLine.test.ts

key-decisions:
  - "[기록]·카드의 유무는 view.me.record 하나이고 GameMap 은 토론 단계에서만, 산 사람에게만 그린다(15-02 이월 메모: 밤까지 record 가 남으므로 단계 조건을 클라이언트가 건다). hostKeyOf 는 단계 조건 없이 discussion 분기에서만 witness 를 낸다"
  - "[기록] 의 빛(recordCall)은 14 의 callUsed(입력칸 포커스·전송)와 무관하다 — 카드를 한 번도 열지 않았다는 사실(recordOpened) 하나가 끈다. 빛 대상은 callTargetsOf 가 정한다(witness → record)"
  - "흔적 구간은 traceWindowOf 한 곳: phaseEndsAt - MORNING_TRACE_MS 부터 단계 끝까지, 서버 시계(Date.now()+offset). 피해자 알림·유언·쪽지 시각은 따로 계산하지 않는다"
  - "card 신호는 구간 시작 전 마운트에서만 delayMs=남은 ms 로 한 번(키 ref 로 개발 모드 이중 실행·재렌더에도 한 번). 구간 안에서 마운트(재접속·새로 고침)하면 신호 0"
  - "카드 아래 끝은 입력줄(.mv-chat__form) 윗변 − 8 을 DOM 에서 재서 --mf-record-bottom 으로 루트에 쓴다(열려 있는 동안 다시 그릴 때마다)"
  - "닉네임은 players[] 의 지금 닉네임, React 텍스트 노드로만 그린다(<b> 문자열 시험)"

metrics:
  duration: 약 50분
  completed: 2026-11-07
---

# Phase 15 Plan 07: 목격 기록·아침 흔적 화면 Summary

**3곳을 마친 산 사람(마피아 포함)에게만 토론 헤더 [기록] 과 접히는 목격 기록 카드, 피해자 있는 아침 마지막 3초에 모두에게 같은 흔적 카드와 띠 줄을 올렸다. 사회자 띠는 기록 유무(불리언)와 흔적 유무만 새로 읽는다.**

## 한 일

- **Task 1 (순수 데이터)** — `test(15-07)` 로 시험 먼저, `feat(15-07)` 로 구현.
  - `traceText.ts`: 조각 9개 이름(UI-SPEC 표 그대로)과 고정 문구. 역할 연상어·'범인'·'증거'·'확정' 이 없다(시험).
  - `recordView.ts`: `recordRowsOf`(me.record 없으면 null, `[]` 이면 `[]`, 최대 6줄, n 은 1부터, 닉네임은 players 에서) · `traceWindowOf`(morning·trace·phaseEndsAt 모두 있을 때만).
  - `hostLine.ts`: witness(산 사람 + me.record 있음 + recordOpened 거짓) · trace(traceOn + day.morning.trace). 예약 키 시험은 이제 "모든 줄이 채워짐" 으로 바뀌었다. 허용 목록 주석에 두 값(me.record 유무·day.morning.trace 유무)과 클라이언트 상태 두 개를 더했다.
- **Task 2 (부품)** — `RecordCard`(머리줄 eye + n + [닫기] 알약, 줄 44·번호·장소 아이콘 24·얼굴 28·닉네임, 줄 0개면 "0" 만), `TraceCard`(thread 44 원 + 조각 이름 + 고정 문구, 폭 328), `ToolButton` 의 `call`·`expanded`. `.mv-record`·`.mv-trace` 블록은 v2.css 끝에 두었고 hex·진홍·새 토큰이 없다. 위치용 `.mf-game__record`·`.mf-game__trace` 는 game.css.
- **Task 3 (GameMap 연결)** — 헤더 `[기록]`(`span[data-record-button]` > ToolButton, [내 역할] 왼쪽), 열림 래치(단계·일차 키), 입력칸 `focusin` 에서 접힘, `--mf-record-bottom` 측정, 흔적 구간 시계와 TraceCard(`위 240`), 구간 전 마운트에서 card 신호 한 번. 띠가 읽는 상태는 `onHostLocal` 콜백으로 RoomScreen 에 올려 `HostBand local` 로 내려 보낸다.

## 시험 결과

- Task 1: `traceView·hostLine·hostBand·hostChime` 4파일 123 통과.
- Task 2: `recordTrace·toolLabels·callGlow·v2parts` 4파일 163 통과.
- Task 3: `recordTrace·gameMap·phaseScreens·callGlow·hostBand·willFlow·nightMap` 7파일 318 통과(2 skipped 는 기존).
- `npx vitest run test/unit test/client`: 207 파일 통과 · 1 skipped(기존), 6820 통과.
- `npm run typecheck`: 오류 0.
- 인수 기준: traceText·recordView 존재 / hostLine `witness|trace` 11(≥6) / traceText `범인|증거|확정` 0 / v2.css `mv-record|mv-trace` 18(≥6) / 새 블록 hex·crimson 0 / ToolButton `data-call|aria-expanded` 4(≥2) / GameMap 신규 식별자 8(≥4) / `kind: "card"` 1 / 새 코드의 me.role·allies 읽기 0.
- 위생: 금지어 grep 새 적중 없음.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - 블로킹] 계획 파일 목록 밖의 변경: `HostBand.tsx`·`RoomScreen.tsx`**
- 사회자 띠는 GameMap 이 아니라 RoomScreen 의 형제 `HostBand` 가 그린다. 띠가 recordOpened·traceOn 을 읽게 하려면 맵 화면이 소유한 상태를 위로 올려야 해서 `GameMap.onHostLocal` → `RoomScreen` 상태 → `HostBand local` 을 더했다(같은 값이면 상태를 바꾸지 않고, 언마운트 때 비운다).

**2. [Rule 1 - 시험 제약] `recordRows` 식별자 금지**
- `dayStaticGuard` 가 v1.0 낮 화면 이름 `recordRows` 를 코드 식별자로 막는다. GameMap 의 변수 이름을 `witnessRows` 로 했다(`recordRowsOf` 는 단어 경계가 달라 괜찮다).

**3. [Rule 3 - 시험 제약] 소스 검사 구간 이동**
- `callGlow.test.tsx` 의 "빛남은 소리를 내지 않는다" 가 `callTargetsOf(view)` 주석부터 `const stageTagProps` 까지 `emitSignal` 이 없음을 검사한다. 흔적 구간·card 신호 코드를 그 구간 앞(빛남 주석 앞)으로 옮겼다. 시험은 고치지 않았다.

**4. [Rule 3 - 스타일 규칙] ellipsis 금지**
- `v2parts.test.tsx` 가 v2.css 에 `ellipsis` 가 없음을 요구해 닉네임·조각 이름의 `text-overflow` 를 쓰지 않았다(`nowrap` + `overflow: hidden`, 닉네임은 8자 이하라 잘리지 않는다).

### 계획 대비 메모

- `[data-record-button]` 은 ToolButton 이 임의 data 속성을 받지 않아 `span.mf-game__record-slot[data-record-button]`(`display: contents`) 로 감쌌다. 15-09 E2E 는 `[data-record-button] button` 또는 `button[data-tool-label="기록"]` 을 쓰면 된다.
- 흔적 카드가 사라질 때의 opacity 전환(dur-fast)은 만들지 않았다: 카드는 아침 단계가 끝나 `SceneCurtain` 이 덮는 순간에 같이 사라지고 등장(opacity+translateY, 모션 줄이기면 즉시)만 CSS 에 있다. 이 선택은 15-10 에 적을 것.
- RED 는 15-01 선례대로 구현 초안 없이 시험을 먼저 쓰고 실패(Task 1 8건·Task 2 모듈 없음·Task 3 14건)를 확인한 뒤 시험 커밋 → 구현 커밋 순으로 나눴다.
- UI#15 long-text(가장 긴 조각 이름 '노란 연필 조각' 6자)는 이름이 8자 이하·카드 폭 328·`white-space: nowrap` 으로 정적 확인했다. 폰 6종 실제 확인은 15-09 E2E 몫.

## 이월 메모 (다음 계획용)

- **15-08 (밤 화면)**: 이 계획은 GameMap 의 `canMoveIn(..., view.me.role === "mafia")` 줄을 건드리지 않았다(15-05 이월 그대로).
- **15-09 (E2E 선택자)**: `button[data-tool-label="기록"]`(+`aria-expanded`·빛일 때 `data-call`), 카드 `section[data-record-card][data-record-rows="n"]` 안 `li[data-record-row]`·`.mv-record__n`·`.mv-record__name`·[닫기] `button[data-tool-label="닫기"]`, 흔적 `div[data-trace-card][role=status]` 안 `.mv-trace__name`·`.mv-trace__note`. 사회자 띠는 `[data-host-line]`. 흔적 카드는 흔적이 있는 아침의 마지막 3초에만 있고 띠가 "현장에 흔적이 남았습니다." 로 바뀐다. 기록 카드는 토론 단계에서만, 열려 있는 동안 스테이지 이름표를 덮을 수 있다.
- **15-10 (결정 0074)**: 흔적 구간 = `phaseEndsAt − MORNING_TRACE_MS`(서버 시계), [기록]·카드 판정은 `me.record` 유무 하나 + 토론 단계, [기록] 빛은 열림 래치 하나로 꺼지고 되살아나지 않음, hostLine 새 읽기 값은 me.record 유무·day.morning.trace 유무와 클라이언트 상태 recordOpened·traceOn, card 신호는 구간 전 마운트에서만 한 번, 흔적 카드 퇴장 전환 없음, `HostBand local`·`onHostLocal` 경로.
- **알려진 한계**: `--mf-record-bottom` 은 카드가 열려 있는 동안 React 렌더 때마다 잰다(키보드·패널 높이 변화는 렌더를 동반한다). 카드가 열린 채 폰 방향이 바뀌는 경우는 다음 렌더에서 맞춰진다.

## Known Stubs

없음. (장소·thread·timeline 아이콘은 15-04 의 임시 선 그림이며 같은 이름의 경로만 나중에 바꾼다.)

## Threat Flags

없음 — 새 네트워크 표면 없음. T-15-27(hostLine 새 읽기 = me.record 유무·day.morning.trace 유무, 기록 줄 내용·me.role 미참조, 마피아·시민 같은 키: Proxy 읽기 경로 시험), T-15-28(조각 이름 닫힌 표·역할 연상어 없음·속성 값에 조각 id·좌석·역할 없음·진홍 없음), T-15-29(닉네임 React 텍스트 노드, `<b>` 문자열 시험), T-15-30(단추·카드는 me.record 가 있을 때만 DOM 에 있음, 못 마친 사람·유령·errand 0건 시험)을 고정했다.

## Self-Check: PASSED

- 파일: src/game/traceText.ts, src/game/recordView.ts, src/components/v2/RecordCard.tsx, src/components/v2/TraceCard.tsx, test/unit/traceView.test.ts, test/client/recordTrace.test.tsx FOUND
- 커밋: 3497b9a2, 9ee5a598, 1e53c220, dec76d43, af6d700e, aa297bd6 FOUND
