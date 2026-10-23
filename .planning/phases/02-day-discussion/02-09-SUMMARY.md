---
phase: 02-day-discussion
plan: 09
subsystem: client-ui
tags: [message-log, discussion-controls, seat-floats, cooldown, host-row, toast, tdd, client]
status: complete

requires:
  - phase: 02-day-discussion
    provides: 02-05 의 서버 say·emoji·extend·skip 처리와 오류 코드, 02-06 의 useSeatFloats·messageText·RoomConnection.onEvent, 02-07 의 Table float·Toast, 02-08 의 DayScene 배선, 02-10 의 QuickMessageSheet·EmojiTraySheet
provides:
  - MessageLog — 3줄 고정 높이 최근 메시지 로그(위로 밀면 보관분, 맨 아래일 때만 자동 스크롤)
  - DiscussionControls — 방장 줄(연장·넘기기), 말하기 줄, 시트 열림, 메시지·이모티콘 합산 2초 쿨다운, RATE_LIMITED·BAD_MESSAGE 처리, 연장 토스트
  - DayScene 낮 토론 배선 — useSeatFloats 말풍선·이모티콘 층, 하단 패널, 토스트, 이모티콘 live 줄
  - test/client/discussion.test.tsx — 낮 토론 화면 통합 테스트 26개
affects: [02-11]

tech-stack:
  added: []
  patterns:
    - "시트 열림 상태를 패널 부품(DiscussionControls)이 쥔다 — 단계가 바뀌어 패널이 언마운트되면 시트도 닫힌다(D-19, Pitfall 11)"
    - "쿨다운은 setTimeout 하나 + 불리언 상태: 보낸 순간·RATE_LIMITED 수신 순간 모두 같은 lock() 이 지금부터 2초로 다시 잡는다"
    - "연장 토스트는 prev ref 비교(false → true)로 한 번만, 마운트 때 이미 true 면 알리지 않는다"
    - "로그 문장은 messageText(템플릿 ID·seat·직업) 로만 만들어 React 텍스트로 그린다 — 서버 문자열·HTML 경로 없음"

key-files:
  created:
    - src/components/MessageLog.tsx
    - src/components/DiscussionControls.tsx
    - test/client/discussion.test.tsx
  modified:
    - src/screens/DayScene.tsx
    - src/styles/day.css
    - test/client/phaseScreens.test.tsx

key-decisions:
  - "쿨다운 기준은 보낸 순간 로컬 시각 + 2000ms 의 단순안(계획 가정 그대로). 서버 시각 기준 전환은 6페이즈 실기기 오탐을 본 뒤 정하고 결정 0016(02-11)에 기록한다"
  - "연결이 끊겨 send 가 false 를 돌려주면 쿨다운도 넘기기 잠금도 걸지 않는다 — 버려진 입력이 잠금만 남기지 않게"
  - "이모티콘 live 줄은 토론 단계에서만 DOM 에 두고(요소는 고정, 글자만 교체), 단계가 바뀌면 지난 이모티콘을 비운다"
  - "로그 이름 요소는 b 가 아니라 span.mf-msglog__name — 닉네임에 든 HTML 이 요소로 해석되지 않음을 테스트로 고정"

requirements-completed: [DAY-01, COMM-01, COMM-02, COMM-04]

actuals:
  tokens: 9300
  tasks: 3
  commits: 6
plan_head_before: 7f19021b3c088779a7777735289c9581a27083f5
plan_head_after: 2a5ea42267033b8c67d0b090bc61d46cd41c4b18
commits: 6

coverage:
  - id: G1
    description: "낮 토론 하단 패널이 최근 메시지 로그(role=log, aria-live polite, 빈 상태 '아직 메시지가 없어요')와 [빠른 메시지]·[이모티콘] 말하기 줄을 보이고, 위쪽 바에 '낮 · 토론'·'{N}일차'·90초 타이머가 있으며, 빠른 메시지를 보내면 {t: say, ...} 한 번과 시트 닫힘"
    requirement: "DAY-01"
    verification:
      - kind: unit
        ref: "test/client/discussion.test.tsx#낮 토론 화면 — 로그·말하기 줄"
        status: pass
    human_judgment: false
  - id: G2
    description: "서버 state 의 새 줄이 로그 맨 아래 줄(내 줄은 '나')과 보낸 사람 머리 위 3초 말풍선으로 같은 문장이 되고, 4줄이면 항목 4개·마지막 줄만 밝은 클래스이며, 재접속은 3초 안 줄만 말풍선을 복원하고, 서버가 보낸 문자열·HTML 은 그려지지 않고, 단계가 바뀌면 열린 시트가 사라진다"
    requirement: "COMM-01"
    verification:
      - kind: unit
        ref: "test/client/discussion.test.tsx#낮 토론 화면 — 로그·말하기 줄"
        status: pass
    human_judgment: false
  - id: G3
    description: "이모티콘 트레이 전송이 {t: emoji, icon} 를 보내고 트레이는 열린 채 두 버튼과 여덟 칸이 2초 꺼지며(메시지와 합산), RATE_LIMITED 는 표시 없이 지금부터 2초 다시 잠그고, BAD_MESSAGE 만 토스트를 띄우고 WRONG_PHASE·NOT_HOST·ALREADY_EXTENDED 는 무표시, emoji 이벤트는 보낸 사람 머리 위 원형 말풍선 2초와 live 줄 '{닉네임}: {이름}' 이며 로그에 남지 않는다"
    requirement: "COMM-02, COMM-04"
    verification:
      - kind: unit
        ref: "test/client/discussion.test.tsx#낮 토론 화면 — 이모티콘·합산 쿨다운·오류"
        status: pass
    human_judgment: false
  - id: G4
    description: "방장 줄은 view.me.isHost 에게만 있고, [+30초 연장] 은 {t: extend} 를 보내며 extendUsed 가 되면 꺼지고 '이미 연장했어요', 모든 폰에 연장 토스트가 한 번 뜨고 타이머가 1:55 로 늘어나며(재접속 마운트는 토스트 없음), [넘기기] 는 확인 없이 {t: skip} 후 두 버튼이 꺼지고, 다음 낮에 연장이 다시 켜지며, 끊기면 둘 다 꺼진다. 전체 테스트·타입 검사 통과"
    requirement: "DAY-01"
    verification:
      - kind: unit
        ref: "test/client/discussion.test.tsx#낮 토론 화면 — 방장 줄"
        status: pass
      - kind: command
        ref: "npm run typecheck && npx vitest run"
        status: pass
    human_judgment: false
  - id: G5
    description: "폭 360px·높이 640px 실기기에서 로그 3줄·방장 줄·말하기 줄 패널(약 240px)과 8자리 테이블이 세로 스크롤 없이 함께 보이는지, [+30초 연장] 뒤 모든 폰의 토스트·타이머 막대 체감, 위쪽 바 아래 토스트 위치가 타이머를 가리지 않는지는 단위 테스트로 볼 수 없다"
    requirement: "DAY-01"
    verification: []
    human_judgment: true
    rationale: "실기기 높이·안전 영역에서 패널이 장면을 얼마나 줄이는지는 happy-dom 으로 단정할 수 없다(UI-SPEC backstop). 02-11 배포본에서 확인한다"
---

# Phase 2 Plan 09: 낮 토론 화면(로그·말하기·방장 줄) Summary

**DayScene 의 discussion 단계에 3줄 고정 메시지 로그, 보낸 사람 머리 위 말풍선·이모티콘 층, 메시지·이모티콘 합산 2초 쿨다운과 서버 오류 처리, 방장 전용 연장·넘기기 줄과 모든 폰 연장 토스트를 배선해 앱만으로 낮 토론이 성립하게 했다.**

## 성과

- **MessageLog**: `role="log"` · `aria-live="polite"` · `aria-relevant="additions"`, 높이는 UI-SPEC 계산식(`3 * 1.4 * 14px + 2 * xs + 2 * sm`)으로 3줄 고정이고 안에서 세로 스크롤한다. 줄마다 `--seat-{자리+1}` 구분 점·이름(내 자리는 "나", `title` 은 전체 닉네임)·`messageText` 문장(한 줄 말줄임), 가장 최근 줄만 `--gray-100`. 새 줄은 사용자가 맨 아래 24px 안에 있을 때만 맨 아래로 내려간다(위로 밀어 둔 동안은 유지). 빈 상태는 "아직 메시지가 없어요" 한 줄이고 높이는 그대로.
- **DiscussionControls**: 말하기 줄 [빠른 메시지](primary, 남는 폭)·[이모티콘](secondary, 52×52, `aria-label="이모티콘"`). 시트 열림 상태를 이 부품이 쥐어, 단계가 바뀌어 패널이 언마운트되면 시트도 닫힌다. 메시지·이모티콘을 보내면 `lock()` 이 지금부터 `SEND_COOLDOWN_MS`(2000) 동안 두 버튼과 트레이 칸을 잠그고, 서버 `RATE_LIMITED` 도 같은 `lock()` 으로 표시 없이 다시 잠근다. `BAD_MESSAGE` 만 토스트("보내지 못했어요. 다시 시도해 주세요"), 그 밖의 오류 코드는 서버 state 를 따른다.
- **방장 줄**: `view.me.isHost` 일 때만 [+30초 연장](plus)·[넘기기](skip) compact 버튼 둘(같은 폭). `extendUsed` 면 꺼지고 "이미 연장했어요". 연장 토스트("방장이 30초를 늘렸어요")는 패널 마운트 뒤 `extendUsed` 가 false → true 로 바뀐 렌더에서 한 번(방장 여부 무관), 재접속 마운트에서는 없다. [넘기기]는 확인 없이 `{t:"skip"}` 을 보내고 두 버튼이 꺼진다. 끊긴 동안 둘 다 꺼진다. 타이머는 DayScene 위쪽 바가 새 `phaseEndsAt`·`phaseDurationMs`(120초)로 다시 그린다.
- **DayScene**: `useSeatFloats(view, connection.onEvent)` 결과를 자리별 float(bubble: `messageText` 문장, emoji: 아이콘)로 바꿔 Table 에 넣고, 패널에 MessageLog·DiscussionControls 를 놓고, `useToast`·`Toast(top)` 를 장면 루트에 그린다. 토론 단계에서만 보이지 않는 live 줄(`mf-sr-only`, `aria-live="polite"`)이 가장 최근 이모티콘을 "{닉네임}: {이름}" 으로 읽는다.
- **day.css**: 로그 면 `--night-700`·`--radius-md`·안쪽 여백 `sm md`, 180ms 페이드(축소 모션에서는 끔), 방장 줄 2열 격자, 말하기 줄 flex, `.mf-dayscene .mf-toast--top` 을 `calc(var(--space-3xl) * 2 + env(safe-area-inset-top))` 로 덮어써 타이머를 가리지 않게 했다.

## 태스크 커밋

| 태스크 | 커밋 | 내용 |
| --- | --- | --- |
| 1 RED | cd26926 | test(02-09): 로그·빠른 메시지 흐름 실패 테스트 8개 |
| 1 GREEN | a485374 | feat(02-09): MessageLog·DiscussionControls(빠른 메시지)·DayScene 말풍선 배선 |
| 2 RED | d955f4b | test(02-09): 이모티콘·합산 쿨다운·오류 이벤트 실패 테스트 10개 |
| 2 GREEN | 12ef336 | feat(02-09): 이모티콘 트레이·쿨다운·오류 처리·live 줄·토스트 위치 |
| 3 RED | b107f57 | test(02-09): 방장 줄·연장 토스트 실패 테스트 8개 |
| 3 GREEN | 2a5ea42 | feat(02-09): 방장 줄 + phaseScreens 안내 영역 선택자 보정 |

트레이서(태스크 1) 검증: `npx vitest run test/client/discussion.test.tsx` 8개 통과와 acceptance_criteria 확인 뒤 확장(태스크 2·3)으로 넘어갔다(⚡ Tracer verified end-to-end — expanding).

## 검증

- `npx vitest run test/client/discussion.test.tsx test/client/dayScene.test.tsx test/client/phaseScreens.test.tsx` — 통과(discussion 26개)
- `npm run typecheck` — 통과
- `npx vitest run` — 54 파일 974 테스트 통과
- 태스크 acceptance_criteria 모두 PASS(파일·문구 grep, `useSeatFloats(`·`<MessageLog`·`<QuickMessageSheet`·`<EmojiTraySheet`·`SEND_COOLDOWN_MS`·`RATE_LIMITED`·`space-3xl`·`mf-toast--top`·`isHost`, `test(02-09)` 커밋 존재)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 낮 토론에 polite live 영역이 늘어 기존 단계 안내 테스트가 깨짐**
- **Found during:** Task 3 전체 테스트(`npx vitest run`)
- **Issue:** `test/client/phaseScreens.test.tsx` 의 `liveRegion()` 이 문서 순서 첫 `[aria-live="polite"]` 를 단계 안내 영역으로 가정했다. 02-09 가 MessageLog(`aria-live="polite"`, 계획·UI-SPEC 요구)와 이모티콘 live 줄을 더하면서 첫 영역이 로그가 되어 "낮 토론" 단언이 실패했다. 제품 코드 결함이 아니라 테스트가 영역의 유일함을 가정한 것이다.
- **Fix:** 선택자를 방 화면 루트의 직접 자식 `.mf-room > [aria-live="polite"]` 로 좁혔다(단계 안내는 RoomScreen 루트 직계 자식이다).
- **Files modified:** test/client/phaseScreens.test.tsx
- **Commit:** 2a5ea42

**Total deviations:** 1 auto-fixed (Rule 1 테스트 가정 보정). **Impact:** 제품 동작 변경 없음.

(그 밖의 구현 선택: 테스트의 말풍선 자리 식별은 마주 보는 자리(예: 슬롯 1·3)의 x 좌표가 같아 `--mf-float-left` 와 함께 `top` 도 비교한다. 계획 범위 안이다.)

## Known Stubs

없음. 이모티콘 아이콘 그림은 02-07 Icon 의 임시 형태 시안(D-16)이며 이 계획이 만든 스텁이 아니다.

## Threat Flags

없음. 새 네트워크 경로·인증·스키마 경계 없음. T-02-29(방장 줄은 `view.me.isHost` 만 따르고 판정은 서버, 테스트로 양방향 고정), T-02-30(보낸 뒤·RATE_LIMITED 수신 시 2초 합산 잠금), T-02-31(문장은 `messageText` 로만, 닉네임은 텍스트와 `title` 로만 — HTML 닉네임·알 수 없는 `text` 필드 무시 테스트) 완화 완료. T-02-SC 새 패키지 없음.

## 다음 단계

- 02-11: 배포 뒤 폭 360px·높이 640px 폰에서 방장으로 낮 토론까지 진행해 coverage G5(패널 높이·토스트 위치·연장 체감)를 확인한다. 쿨다운 기준(로컬 시각 + 2000ms 단순안)과 RATE_LIMITED 오탐 시 서버 시각 기준 전환은 결정 0016 에 기록한다.

## Self-Check: PASSED

- FOUND: src/components/MessageLog.tsx, src/components/DiscussionControls.tsx, test/client/discussion.test.tsx, src/screens/DayScene.tsx, src/styles/day.css
- FOUND commits: cd26926, a485374, d955f4b, 12ef336, b107f57, 2a5ea42 (git rev-list 7f19021..HEAD = 6)
