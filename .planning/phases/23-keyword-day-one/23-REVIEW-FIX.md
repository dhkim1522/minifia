---
phase: 23-keyword-day-one
fixed_at: 2026-11-17T05:15:00Z
review_path: .planning/phases/23-keyword-day-one/23-REVIEW.md
iteration: 1
findings_in_scope: 4
fixed: 4
skipped: 0
status: all_fixed
---

# Phase 23: Code Review Fix Report

**Fixed at:** 2026-11-17
**Source review:** .planning/phases/23-keyword-day-one/23-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 4 (WR-01~04, 요청 범위. INFO 는 문서 한계 기록만)
- Fixed: 4
- Skipped: 0

**검증 위치:** 격리 worktree 를 만들지 않고 메인 체크아웃(브랜치 v3)에서 직접 고치고 시험했다(요청 지시). 아래 시험 결과는 이 트리에서 재현된다.

## Fixed Issues

### WR-01: 자모를 풀어 쓴 답이 금지어 판정을 통과한다

**Files modified:** `shared/game/keywordGuard.ts`, `test/unit/keywordGuard.test.ts`
**Commit:** 39a5e396
**Applied fix:** `jamoSkeleton` 추가 — 정규형의 음절을 초성·중성·종성으로 풀고 종성을 같은 자음의 초성으로, 겹받침·겹모음을 낱 자모로 접는다. 키워드·별칭·답을 같은 함수로 접어 부분 포함을 비교한다(기존 음절 부분 포함·초성열 검사는 그대로). 머리말의 "NFKC 가 이미 합친다" 거짓 문장을 바로잡았다.
**시험:** `ㅁㅕㅇㄹㅑㅇ`(명량)·`ㅂㅜㅅㅏㄴㅎㅐㅇ`(부산행)·혼합 `해리ㅍㅗㅌㅓ`·겹받침/겹모음 풀어쓰기는 막힘, 멍랑·명령·부산상·무관한 문장·`hery foter` 는 통과. 기존 표 전부 유지.
**상태:** fixed: requires human verification (판정 논리 변경)

### WR-02: 확정 직후 모든 error 프레임을 금지어 거절로 읽는다

**Files modified:** `src/net/useKeywordAnswer.ts`, `test/client/useKeywordAnswer.test.tsx`
**Commit:** c0aa9574
**Applied fix:** `e.code !== "BAD_MESSAGE"` 면 무시한다. WRONG_PHASE·RATE_LIMITED 는 알림·deny 소리·되돌림이 없다. 주석 정정.
**시험:** 두 코드에서 notice null·state sent·신호 없음, 이어서 온 BAD_MESSAGE 는 거절로 처리됨(deny 신호 1건).

### WR-03: 키워드 목록이 클라이언트 모듈 그래프에 정적으로 들어 있다

**Files modified:** `shared/game/room.ts`, `shared/game/rematch.ts`, `shared/game/keywords.ts`(머리말), `worker/room.ts`, `test/helpers/keyword.ts`, `test/helpers/voteState.ts`, `test/unit/view.test.ts`, `test/unit/gameLog.test.ts`, `test/unit/keywordFlow.test.ts`, `test/unit/keywordStaticGuard.test.ts`
**Commit:** 78854e20
**Applied fix:** `room.ts` 는 `keywords.ts` 를 import 하지 않는다. `startGame`·`beginGame`·`rematch` 가 마지막 선택 인자 `pickKeyword?: KeywordPicker` 를 받고, 방 DO 가 호출 시점에 `KEYWORD_SWITCH.on ? pickKeyword : undefined` 를 넘긴다(난수 순서·횟수, 스위치 꺼짐 시 keyword 삭제 의미 동일). 시험은 `keywordPickerNow()` 도우미로 같은 의미를 넘긴다.
**시험(keywordStaticGuard):** `src/` 에서 값 import(import type 제외)로 닿는 전이 그래프에 keywords·keywordGuard·keywordAnswer 가 없음을 검사(고치기 전 `room.ts -> keywords.ts` 로 실패 확인), 가드 자기 검사 2건, `dist/client/assets` 가 있을 때 표본 별칭(Harry Potter·해리포터·렛잇고·keywordProbed) 부재 검사(없으면 skip). 빌드를 도는 시험은 느려서 넣지 않았다.

### WR-04: 판 기록 삽입이 waitUntil 로 매달린 약속이다

**Files modified:** `worker/room.ts`, `test/worker/gameLog.test.ts`, `docs/decisions/0091-v3-keyword-day-one.md`(0091-14·23 서술)
**Commit:** 184340f1
**Applied fix:** 행은 전환 직후 동기로 만들고(`gameRowFor`), `afterTransition` 끝에서 `reschedule()` 뒤에 `await recordGame(row)`. try/catch 로 실패를 삼키고 고정 문구 `game log failed` 한 줄만 남긴다(던지지 않음).
**시험:** 삽입 실패 시험이 결과 화면 수신·다시 하기 성공에 더해 저장된 방이 `ended` 임을 확인하고 로그 한 줄을 확인.

## 문서

- 0091-4 와 HANDOFF.md 의 "310개" → 306개(HANDOFF 5564B 유지, 6KB 이하). 커밋 d43efa47.
- 0091-25 "코드 리뷰 INFO 한계" 추가: 한 답에 후보 묶음 떠보기(시도 횟수 = 적중 + 1), `probe_success` 오탐 포함 가능, 연결 끊긴 한 명이 판 전체 조기 진행을 끈다(D-12).
- 다른 INFO 는 요청대로 고치지 않았다.

## 시험 결과

- `npm run typecheck` 통과(각 수정 뒤).
- `npx vitest run --project client --project unit`: 206 파일 통과, 6998 통과.
- `npx vitest run --project worker`: 첫 실행에서 1건 간헐 실패(순서 시험, 알려진 부하 간헐), 재실행 전체 통과(542 통과·62 skip).
- `node --test scripts/*.test.mjs scripts/e2e/*.test.mjs`: 654 통과.
- 위생 grep(금지 표현)은 변경 파일 전부 결과 없음.

---

_Fixed: 2026-11-17_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
