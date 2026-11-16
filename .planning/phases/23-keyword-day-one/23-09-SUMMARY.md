---
phase: 23-keyword-day-one
plan: "09"
subsystem: client-keyword-input
tags: [keyword, answer-input, draft-autosave, ime, compact-card, host-band]
requires: ["23-06", "23-07"]
provides:
  - "src/net/useKeywordAnswer.ts: 읽기 3초 잠금(locked)·쓰기(open)·확정(sent) 상태, 초안 자동 저장(600ms·마감 700ms 전), 확정 제출, 금지어 거절 알림, 본인 view(me.answer) 복원"
  - "src/screens/Keyword.tsx 입력줄(data-answer-state·input·send·secs·count·notice·done)과 컴팩트 카드(data-compact)"
  - "사회자 줄 keyword.wait '곧 모두의 답이 나와요', keyword.act 빛남 대상 = 입력칸(chat 도구)"
affects: [23-10, 23-11, 23-12, 23-13]
status: complete
actuals:
  tokens: 14000
  tasks: 3
  commits: 7
plan_head_before: e60c5bfdd58a706e8d3cd787335d5ed64604b4c0
plan_head_after: b35648b1359ccc54a79e4945dc9885c376c5eafe
tech-stack:
  added: []
  patterns:
    - "거절 감지: 확정을 보낸 뒤 3초 안, 서버 view 가 확정을 돌려주기 전의 error 프레임(코드 무관)을 그 확정의 거절로 본다. 그 시간이 지난 뒤 늦게 온 거절은 조용히 넘긴다(22 WILL_QUIET_MS 교훈)"
    - "입력줄은 채팅 입력줄 클래스(.mv-chat__form·__field·__input·__send·__notice·.is-call)를 그대로 쓰고 ChatPanel 컴포넌트는 쓰지 않는다. 새 토큰·hex·아이콘·소리 없음(tap·deny 는 기존 신호)"
    - "한글 조합: 조합 중에는 값을 자르지 않고(setValue(raw, true)) 조합이 끝나면 자소 20으로 자른다. 제출은 useComposedText.settle 로 조합 끝 값을 기다린다(IME_WAIT_MS)"
    - "빛남은 사회자 표(callTargetsOf)와 훅(callInput = 열림 + 한 글자도 안 씀)이 모두 참일 때만 — 시각은 화면의 3초 잠금이 정한다"
key-files:
  created:
    - src/net/useKeywordAnswer.ts
    - test/client/useKeywordAnswer.test.tsx
  modified:
    - src/screens/Keyword.tsx
    - src/styles/phase.css
    - src/screens/RoomScreen.tsx
    - src/game/hostLine.ts
    - test/client/keywordScreen.test.tsx
    - test/unit/hostLine.test.ts
key-decisions:
  - "[보내기] 접근성 이름은 제출 전 '답 보내기'(UI-SPEC 문구 표), 제출 뒤 '답 보냄'. 제출 뒤에는 aria-disabled 를 달지 않아 .45 흐림 없이 면 gray-100 을 유지한다"
  - "읽기 3초가 끝나 open 이 되는 순간 입력칸에 초점을 준다(키보드가 안 올라오는 기기에서는 빛나는 입력칸을 직접 누른다)"
  - "지운 글도 빈 초안으로 보낸다(서버가 공백뿐인 초안을 키째 지운다) — 안 보내면 지우기 전 초안이 마감에 나간다"
requirements-completed: [SC1, SC3]
---

# Phase 23 Plan 09: 키워드 답 입력줄 Summary

키워드 카드 아래에 입력줄을 붙였다. 읽는 3초는 잠기고, 풀리면 입력칸이 빛나며, 20자소까지 쓰고 [보내기]로 확정하면 곧바로 '냈어요'가 된다. 금지어 거절은 모두에게 같은 문구이고, 쓰던 글은 자동 저장되어 시간이 끝나면 서버가 낸다. 서버 계약(answer 메시지·me.answer)은 23-06 이 만든 것을 그대로 쓴다.

## 만든 것

- **useKeywordAnswer 훅**: `{ value, setValue, state, secondsLeft, count, notice, canSubmit, submit, callInput }`. 단계 시작 = phaseEndsAt − phaseDurationMs(서버 시각, offset 보정), 시작 뒤 `KEYWORD_READ_MS` 까지 locked. 초안은 입력이 바뀌고 `KEYWORD_AUTOSAVE_MS`(600) 뒤 한 번 + 마감 `KEYWORD_LAST_SEND_LEAD_MS`(700) 전 한 번 더, 같은 글은 다시 보내지 않는다. 확정은 400ms(`ANSWER_MIN_GAP_MS`) 안 연타를 조용히 무시하고 응답을 기다리지 않고 sent 가 된다. 거절은 `KEYWORD_REJECT_COPY` 한 문구를 `KEYWORD_NOTICE_MS`(2500) 동안 띄우고 ui.deny 를 내며 open 으로 돌아온다(글 유지). 키워드 서버 모듈은 import 하지 않는다(정적 가드 통과).
- **Keyword 입력줄**: 메타 줄(왼쪽 n초 · 가운데 거절 알림/냈어요 · 오른쪽 n/20, 20이면 `data-full`) + 입력 행(입력칸 + [보내기] send → check). 입력칸은 locked 에서 disabled, sent 에서 readOnly. [보내기] mousedown 기본 동작을 막아 포커스·키보드를 유지한다. 마피아·시민의 입력줄 DOM 은 시험으로 완전히 같음을 고정했다.
- **컴팩트 카드**: `useKeyboardLift` 로 열림을 알아 카드가 `data-compact="true"`·`is-compact`(각주 `hidden`, 키워드 24 한 줄 nowrap, 안쪽 8 16, 줄 간격 없이 높이 72)로 바뀌고 입력줄은 `--mf-kb-lift` 만큼 키보드 위로 올라간다. 닫히면 큰 카드로 돌아온다. 재접속은 기존 still 규칙으로 모션 없이 보인다.
- **띠**: `keyword.act`/`keyword.wait`(`me.answer.final` 만 읽는다 — 역할·글은 읽지 않고 시험이 읽은 경로로 고정). keyword.act 빛남 대상은 입력칸(chat 도구).

## 검증 (실제로 돌린 것)

| 명령 | 결과 |
|------|------|
| `npx vitest run test/client/useKeywordAnswer.test.tsx` | 통과(24) |
| `npx vitest run test/client/keywordScreen.test.tsx test/client/useKeywordAnswer.test.tsx test/client/phaseScreens.test.tsx test/unit/keywordStaticGuard.test.ts` | 통과(110) |
| `npx vitest run test/unit/hostLine.test.ts test/client/keywordScreen.test.tsx test/client/hostBand.test.tsx` | 통과 |
| `npx vitest run --project client` | 76 파일 통과, 2620 통과·77 건너뜀 |
| `npx vitest run --project unit` | 128 파일 통과, 4299 통과·99 건너뜀(참고용 추가 실행) |
| `npm run typecheck` | 초록(매 커밋 전) |
| 인수 grep | useKeywordAnswer·ANSWER_MIN_GAP_MS 있음, 서버 모듈 import 0, data-answer-state·data-compact 있음, phase.css hex 0, keyword.wait·'곧 모두의 답이 나와요' 있음 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 글을 모두 지워도 옛 초안이 서버에 남아 마감에 나가는 문제**
- **Found during:** 마무리 점검(서버 keywordAnswer 의 "공백뿐인 초안은 키째 삭제" 규칙 대조)
- **Issue:** 처음 구현은 빈 글이면 초안을 보내지 않아, 한 번 저장된 초안을 지우고 시간이 끝나면 지우기 전 글이 "쓴 글"로 나갈 수 있었다.
- **Fix:** 빈 글도 마지막으로 보낸 값(또는 서버 값)과 다르면 빈 초안으로 보낸다. 아무것도 안 쓴 경우는 보내지 않는다. 시험 2건 추가.
- **Files modified:** src/net/useKeywordAnswer.ts, test/client/useKeywordAnswer.test.tsx
- **Commit:** b35648b1

그 밖의 계획 이탈은 없다. 계획의 "입력칸 빛남 = callTargetsOf 와 callInput 둘 다 참" 은 Task 3 커밋에서 Keyword 에 배선했다(Task 2 시점에는 callInput 만 썼다).

## 확인하지 못한 것 (정직하게)

- **실기기·IME**: happy-dom 은 실제 한글 조합과 visualViewport 키보드를 재현하지 못한다. 키보드 열림은 `useKeyboardLift` 를 가짜로 바꿔 시험했고(측정 자체는 keyboardLift.test 몫), 조합 경로(`settle`·compositionend)는 이벤트 순서만 시험했다. 실기기 검사는 사용자 방침(UAT 실기기는 끝에 몰아서)대로 미뤘다.
- **must_haves 의 backstop 항목**(높이 560~664 폰에서 키보드를 연 채 컴팩트 카드·입력줄이 화면 안이고 [보내기]·n초·n/20 이 가려지지 않음): 레이아웃 계산은 CSS 주석에 대조값으로 적었지만 실제 렌더 측정은 하지 않았다. 23-12·13(E2E·화면 지도)와 실기기에서 확인한다.
- 컴팩트 카드 높이 72 와 12자소 키워드가 한 줄에 드는지는 CSS 규칙(`white-space: nowrap`, 24px)을 정규식으로만 확인했다. 실제 폭 측정은 아니다.
- E2E(`?e2e=1`) 표식은 UI-SPEC 표대로 달았지만 E2E 스크립트로 돌리지 않았다(23-12 몫).

## 이월 · 알려진 한계

- 계획자 가정 그대로 유지: 높이 664 이하 폰에서 키보드를 열면 컴팩트 카드가 띠·소리 단추 줄을 일부 덮는다(남은 시간은 메타 줄 n초가 다시 보인다). 마감 700ms 전 전송 규칙이라 마지막 약 0.7초 입력은 잃을 수 있다. 빈 확정을 보낼 수 없어 모르는 사람이 10초를 다 쓰면 일찍 넘어가기가 늦어진다 — 23-13 이 0091 알려진 한계에 적는다.
- `[보내기]` 의 제출 전 접근성 이름은 UI-SPEC 문구 표의 "답 보내기" 를 썼다(계획 본문의 "답 보냄" 은 제출 뒤 이름).
- 초안의 거절은 훅이 알림 없이 넘긴다(확정을 보낸 적이 없으면 error 프레임을 무시). 확정 3초 창 안에 다른 이유의 error 가 겹치면 거절로 오인할 수 있으나, 입력줄이 막는 경로(빈 글·20자 초과·잠김·연타)는 미리 걸러져 영향이 작다.

## Known Stubs

없음.

## Threat Flags

없음 — 새 네트워크 경로·권한 경계 없음. T-23-32(거절 문구 역할 무관)·T-23-33(DOM 표식에 역할·키워드 없음)·T-23-34(제어 컴포넌트 텍스트)·T-23-35(서버 모듈 import 없음)는 시험으로 고정했다.

## Self-Check: PASSED

- 파일 존재: src/net/useKeywordAnswer.ts, test/client/useKeywordAnswer.test.tsx, src/screens/Keyword.tsx, src/game/hostLine.ts — 확인
- 커밋 존재: 18507f02, 273fe908, f08dabb4, 2b64b3af, 43dd1f0b, 5d28ac05, b35648b1 — 확인(측정 commits 7)
