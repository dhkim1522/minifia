---
phase: 23-keyword-day-one
plan: "07"
subsystem: ui
tags: [answer-reveal, result-announce, host-band, chat-lock, reconnect]
requires: ["23-05"]
provides:
  - "ResultAnnounce 선택 prop label(data-announce-label, .mf-announce__label)·still(is-still)"
  - "dayView answerReveal 알림 시간표(처형 없음 0~1.4초 → 정답 3초), answerStillOf, ANNOUNCE_NOEXEC_MS = NO_EXECUTION_MS"
  - "hostLine answerReveal 키(빈 줄, blank 띠)·머리 제목 '정답'·GamePanel 채팅 입력줄 잠금"
  - "test/client/answerReveal.test.tsx"
affects: [23-08, 23-12, 23-13]
status: complete
actuals:
  tokens: 11300
  tasks: 2
  commits: 5
plan_head_before: 1280534a371ce7ecaf7883485bf6d263cce44cb9
plan_head_after: 5bef6f7faf7e44a68a68bce095192d9c0fe57dc3
tech-stack:
  added: []
  patterns:
    - "큰 글 알림은 DayAnnounce{ text, label?, at, ms } 한 가지 틀 — 정답 공개도 execution 과 같은 시간표 표(phaseEntry) 안에서 만든다"
    - "재접속 첫 스냅샷의 정답 큰 글은 서버 시계 차(phaseEndsAt - serverNow)로 남은 시간을 구해 기기 시계와 무관하게 그린다"
key-files:
  created:
    - test/client/answerReveal.test.tsx
  modified:
    - src/components/ResultAnnounce.tsx
    - src/styles/game.css
    - src/game/dayView.ts
    - src/net/useDayFx.ts
    - src/screens/GameMap.tsx
    - src/game/hostLine.ts
    - src/screens/GamePanel.tsx
    - test/unit/dayView.test.ts
    - test/unit/hostLine.test.ts
    - test/unit/e2eContract.test.ts
    - scripts/e2e/lib.mjs
    - scripts/e2e/lib.test.mjs
key-decisions:
  - "정답 큰 글의 글자는 view.day.keyword.answer 하나뿐이다 — 값이 없으면 알림도 없다(T-23-25). 역할·생존 분기가 없다(T-23-27)"
  - "처형 없는 첫날은 prev ∈ {verdict, nomination, runoff, showdown} 이고 day.noExecution.reason 이 있을 때 '처형 없음' 1.4초 뒤 정답 3초. 밤 진입은 prev 목록에 answerReveal 이 없어 '처형 없음' 이 다시 나오지 않는다(D-22)"
  - "answerReveal 에서는 UI 가 유언 깃펜을 그리지 않는다(서버 MAP_PHASES 는 유언 저장을 받지만 화면이 길을 열지 않는다) — 밤과 달리 3초 잠긴 화면이라 의도된 차이로 기록"
requirements-completed: [SC4]
---

# Phase 23 Plan 07: 첫날 정답 공개 화면 Summary

**첫날 처형(또는 처형 없는 낮) 뒤 밤 직전에 모든 사람(마피아·시민·유령)이 같은 큰 글 "정답" + 키워드를 3초 보고, 처형 없는 첫날은 '처형 없음' 1.4초 다음에 이어지며, 띠는 초·막대만, 제목은 "정답", 채팅 입력줄은 잠기고, 재접속하면 남은 시간만 모션 없이 보인다.**

## 해낸 것

- **Task 1 — 큰 글**: `ResultAnnounce` 에 선택 prop `label`(위 줄, Body 16/700 gray-300, 글자 위 간격 8은 body gap)을 더했다. 읽는 글은 role=status 안에서 `정답 해리포터` 하나다(두 줄 사이 공백 텍스트). `DayAnnounce.label`, `DAY_COPY.answerLabel`, `phaseEntry` 의 `case "answerReveal"`(처형 있었으면 정답만 0초부터, 처형 없음이면 '처형 없음' 줄·알림 0~1.4초 다음 정답 1.4초부터 3초), `ANNOUNCE_NOEXEC_MS = NO_EXECUTION_MS`(서버 상수와 한 값). `GameMap` 이 `label`·`still` 을 넘긴다.
- **Task 2 — 띠·제목·패널**: `HostKey "answerReveal"`(빈 줄, 역할·생존을 읽지 않음 → `hostBandModeOf` 가 시간 행 때문에 blank), `callTargetsOf` 는 null. `dayView.titles.answerReveal = "정답"`(시간대 낱말 "저녁" 은 헤더가 말한다). `GamePanel` 은 잠금 조건을 `defense || answerReveal` 로 넓혀 채팅 입력줄이 `data-chat-locked`·aria-disabled 가 되고 보내기·동작 단추가 없다. 기록 칸 높이는 일반 낮 패널과 같음을 시험으로 고정(P23-21).
- **재접속**: `answerStillOf(view)` 가 `phaseEndsAt - serverNow` 남은 시간(최대 3초)만큼 모션 없는(`is-still`) 정답 큰 글을 준다. `useDayFx` 가 첫 스냅샷·epoch 직후에 이를 적용한다. 처형 없는 첫날의 앞 1.4초는 되살리지 않는다.

## 검증 (실제 실행)

| 명령 | 결과 |
|------|------|
| `npx vitest run test/unit/dayView.test.ts test/client/answerReveal.test.tsx test/client/gameMap.test.tsx test/client/killFx.test.tsx && npm run typecheck` (Task 1 verify) | 4 파일 통과, tsc 오류 없음 |
| `npx vitest run test/unit/hostLine.test.ts test/client/answerReveal.test.tsx test/client/willFlow.test.tsx test/client/ghostView.test.tsx && npm run typecheck` (Task 2 verify, dayView 단위 포함) | 5 파일 272건 통과, tsc 오류 없음 |
| `npx vitest run --project client` (plan verification) | 75 파일, 2585 통과·77 건너뜀(기존 skip), 실패 0 |
| `npx vitest run --project unit` | 처음 1건 실패(e2eContract HOST_BLANK_PHASES 사본, 아래 Deviation) → 수정 후 `test/unit/e2eContract.test.ts` 86건 통과. unit 전체는 수정 뒤 다시 돌리지 않았고, 수정 전 126 파일 중 그 한 건만 실패였다 |
| `node --test scripts/e2e/lib.test.mjs` | 387건 통과 |
| 승인 기준 grep | data-announce-label 1, `case "answerReveal"` dayView 1·hostLine 1, `ANNOUNCE_NOEXEC_MS = NO_EXECUTION_MS` 1, GamePanel answerReveal 5, hostLine.test `"answerReveal"` 5 |

TDD: RED `748c4aca`(실패 11건 확인) → GREEN `aa7205d8`, RED `0bd16d4c`(실패 5건 확인) → GREEN `e061583b`.

## 커밋

| 커밋 | 내용 |
|------|------|
| 748c4aca | test: 정답 공개 큰 글 실패 시험 |
| aa7205d8 | feat: 정답 공개 큰 글 — 처형 없음 다음 3초 |
| 0bd16d4c | test: 정답 공개 띠·패널 실패 시험 |
| e061583b | feat: 정답 공개 띠·제목·패널 잠금 |
| 5bef6f7f | chore: E2E 사본 HOST_BLANK_PHASES 에 answerReveal 추가 |

(`commits: 5` 는 이 SUMMARY 커밋을 뺀 코드 커밋 수이고 `plan_head_after` 도 코드 마지막 커밋이다.)

## Deviations from Plan

**1. [Rule 2 - 누락된 필수 기능] 재접속 정답 큰 글 + `still` prop**
- **Found during:** Task 1
- **Issue:** must_have 는 "재접속으로 answerReveal 중간에 들어오면 큰 글이 남은 시간만 모션 없이 보인다" 인데 기존 `useDayFx` 는 첫 스냅샷에 알림을 만들지 않고 `ResultAnnounce` 에 모션 끄는 길이 없다. 계획 문구("기존 reset/still 규칙을 따른다")만으로는 큰 글이 아예 안 보인다.
- **Fix:** `ResultAnnounce` 에 `still`(is-still), `dayView.answerStillOf`, `useDayFx` 첫 스냅샷 분기 추가. 계획 files 밖(`src/net/useDayFx.ts`)을 건드렸다.
- **Files modified:** src/components/ResultAnnounce.tsx, src/styles/game.css, src/game/dayView.ts, src/net/useDayFx.ts, src/screens/GameMap.tsx
- **Commit:** aa7205d8

**2. [Rule 3 - 막는 문제] E2E 사본 HOST_BLANK_PHASES 갱신**
- **Found during:** 전체 unit 실행
- **Issue:** 빈 줄 키가 하나 늘어(`answerReveal`) `e2eContract` 의 "빈 줄인 키는 모두 HOST_BLANK_PHASES 안에 있다" 가 깨졌다.
- **Fix:** `scripts/e2e/lib.mjs` 의 `HOST_BLANK_PHASES` 에 `answerReveal` 추가, `lib.test.mjs`·`e2eContract.test.ts` 기대값 갱신.
- **Commit:** 5bef6f7f

**3. 기존 시험 기대값 한 줄**: `hostLine.test` 의 "빈 문자열 키" 목록에 `answerReveal` 을 넣었다(표가 단일 출처).

## 이월 메모 처리

- `hostKeyOf` answerReveal fallback → 해결(Task 2). `dayView.titles`·`dayEvents`·`ANNOUNCE_NOEXEC_MS` 정렬 → 해결.
- **유언 깃펜(MAP_PHASES)**: `MAP_PHASES` 에 answerReveal 이 있어 서버 `saveWill` 은 이 단계에서도 받는다(밤과 같은 통과). UI 는 `GamePanel.penOn` 에서 answerReveal 을 빼 깃펜을 그리지 않는다. `useWill.willAllowed` 는 그대로(`MAP_PHASES` 만 읽음)라 이 단계에서 시트를 여는 다른 길이 있는지는 확인하지 않았다(깃펜 단추가 유일한 진입이라 판단). 의도: 3초 잠긴 화면이라 쓰는 길을 열지 않는다.
- **확인하지 않은 것**: 23-05 이월의 `SceneCurtain`·`ResultScreen`(arrivedFrom)·`pinPlan` 등 `"execution"`/`"night"` 만 보는 분기 점검은 이 계획 파일 목록 밖이라 하지 않았다(클라이언트 전체 시험은 통과). 유령에게 `headerFor` 가 `ghostHint` 를 주지만 기본 헤더(MapHeader)는 제목만 그려 answerReveal 화면에는 안내 줄이 없다.

## Known Stubs

없음.

## Threat Flags

없음(새 네트워크·권한 경로 없음). T-23-25(정답은 `day.keyword.answer` 만 읽음), T-23-26(텍스트 노드, XSS 시험), T-23-27(세 역할 화면 동일·DOM 에 역할 값 없음) 모두 answerReveal.test·dayView.test 로 고정.

## 실행하지 못한 확인

- 실기기·배포본에서 360×560 키워드 두 줄 겹침 확인(UI-SPEC 계산식만 따름), E2E 6종은 돌리지 않음(결정: 페이즈 끝에 한 번). 배포 없음.
- `npm run typecheck` 가 `worker-configuration.d.ts` 를 다시 만드는데 이번에는 변경이 생기지 않았다.

## Self-Check: PASSED

- 파일 존재: test/client/answerReveal.test.tsx, 위 수정 파일 전부 커밋에 포함.
- 커밋 존재: 748c4aca, aa7205d8, 0bd16d4c, e061583b, 5bef6f7f 모두 HEAD 의 조상.
