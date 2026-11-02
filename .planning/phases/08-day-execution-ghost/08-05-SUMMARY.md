---
phase: 08-day-execution-ghost
plan: "05"
subsystem: ui-parts
tags: [tdd, v2-parts, head-stack, chat-system-lines, font-serif, tokens, react19]
status: complete

requires:
  - phase: 08-day-execution-ghost
    provides: 08-03 의 VoteBadge·SureStamp·RoleChip 부품과 배지·도장 CSS
provides:
  - HeadStack 속성 role·count·lead·sure·mine·done·blink·ghost 와 쌓임 순서 typing → RoleChip → SureStamp → VoteBadge → 이름표
  - NameTag 클래스 is-mine·is-blink·is-ghost, 이름표 안 point 아이콘(내가 가리킨 사람)·.mv-tag__done 체크(투표함)
  - .mv-head 의 data-count·data-lead·data-sure·data-mine·data-done·data-ghost (켜질 때만)
  - ChatStoreLine·ChatPanelMessage kind 'vote'·'hot', ChatStore.addSystem 옵션 kind (기본 system)
  - ChatPanel vote 줄(point 14)·hot 줄(아이콘 없음)과 .mv-chat__sys.is-vote·.is-hot 규칙
  - 토큰 --font-serif (design/tokens.json type.families.serif → gen-tokens.mjs → tokens.css), index.html 의 Gowun Batang 700 링크
affects: [08-15~17 게임 화면(지목·변론·찬반·유령), 08-17 유령 화면 분기(role 은 거기서만 넘김), 08-20 정적 가드, 08-24 E2E H 묶음(is-ghost 대비)]

actuals:
  tokens: 9800
  tasks: 3
  commits: 6
plan_head_before: 082ce5ceee1782dc203c831758fdcb9a5f60e14f
plan_head_after: e8dd60346f4b0b6da41833efd1b1043eed9d0ff4

tech-stack:
  added: []
  patterns:
    - "상태 data-* 는 켜질 때만 싣는다(값 'true', count 는 숫자 문자열) — 끄면 속성 자체가 없다"
    - "RoleChip 은 role 을 넘길 때만 그린다 — HeadStack 은 서버 상태·역할 표를 불러오지 않는다(소스 검사로 고정)"
    - "TAP RED 증거: 기대값에 따옴표가 든 문자열 비교·빈 문자열 actual 은 Malformed TAP 이 된다 — 불리언·개수·경로 문자열 비교로 쪼갠다"

key-files:
  created: []
  modified:
    - src/components/v2/HeadStack.tsx
    - src/components/v2/ChatPanel.tsx
    - src/net/chatStore.ts
    - src/net/useChat.ts
    - src/styles/v2.css
    - src/styles/tokens.css
    - design/tokens.json
    - scripts/gen-tokens.mjs
    - index.html
    - test/client/v2parts.test.tsx
    - test/client/chatPanel.test.tsx
    - test/client/chatStore.test.ts
    - test/client/useChat.test.tsx
    - test/client/voteParts.test.tsx
    - test/unit/tokensV2.test.ts

key-decisions:
  - "글자 스타일 세 개(배지 숫자 22/1/700 명조, 단위 12/1/700, 도장 15/1/700 자간 0.12em)는 tokens.css 가 아니라 v2.css 의 세 규칙에 직접 쓴다 — 생성기는 :root 변수만 만든다 (계획 A1)"
  - "is-ghost 는 불투명도 0.6 으로 둔다. 이름표 글자 대비 4.5:1 미달 시 면만 0.8 로 올리는 판정은 08-24 E2E H 묶음이 잰다 (계획 A2)"
  - "내가 가리킨 사람(mine) 이름표 안에 승인 bundle.js 대로 point 아이콘 16(읽을 이름 '내가 가리킨 사람')을 함께 그린다 — 계획 본문은 색만 말했지만 승인 NameTag 의 일부다"

requirements-completed: [DAY-04, DAY-06, GHOST-02]

metrics:
  duration: 약 14분
  completed: 2026-11-02
---

# Phase 8 Plan 05: 이름표 쌓임·채팅 시스템 줄 종류·명조 토큰 Summary

HeadStack 을 typing → 직업 칩 → 유력 도장 → 득표 배지 → 이름표(mine·blink·ghost·done)로 넓히고, 채팅 시스템 줄에 vote·hot 종류를 ChatStore → useChat → ChatPanel 한 길로 더했으며, 명조 `--font-serif` 를 토큰 생성기 → tokens.css → Google Fonts 링크까지 이었다. 게임 화면에서 쓰는 곳은 08-15~17 이다.

## 한 일

| 태스크 | 내용 | 커밋 |
| --- | --- | --- |
| 1 (tracer) | HeadStack 속성 8개와 쌓임 순서, data-* 는 켜질 때만. role 이 없으면 RoleChip·data-role-chip 이 DOM 에 없음. NameTag 의 is-mine·is-blink·is-ghost, point·체크(투표함). v2.css 에 mine·blink(0.9초 × 3)·ghost 0.6·.mv-tag__done·mv-blink 키프레임과 모션 줄이기 | 588dc17 test, b798bf4 feat |
| 2 | addSystem `kind` 옵션(기본 system), useChat 이 kind 그대로 전달, ChatPanel vote(point 14 강제)·hot(아이콘 없음), .is-vote gray-100·.is-hot brass-200 | c9f3659 test, 8f322c9 feat |
| 3 | design/tokens.json `type.families.serif`, gen-tokens.mjs 가 `font-serif` 변수 생성, `npm run tokens` 로 tokens.css 재생성, index.html 글꼴 한 요청(Gowun Batang 700 + Gowun Dodum), v2.css 의 serif 대체값 제거 | c8a869e test, e8dd603 feat |

트레이서 게이트: 기본(end-of-phase) 모드이고 `<verify>` 가 자동 명령뿐이라 Task 1 직후 `npx vitest run test/client/v2parts.test.tsx test/client/voteParts.test.tsx` 를 다시 돌려 105건 통과를 확인하고 확장(Task 2·3)으로 갔다.

## TDD 기록

### RED (세 번, 모두 `gsd_run check tdd-red-evidence` = RED_EVIDENCE_OK)

- Task 1: 대상 "count 2 · lead 면 .mv-head 안 순서가 VoteBadge(.is-lead) → 이름표이고 …". actual `mv-tag` / expected `mv-badge,mv-tag`. 의미 평가: HeadStack 이 count·lead 를 아직 받지 않아 배지 칸이 없는 계획된 단언에서 실패했고, 같은 실행에서 mine·blink·ghost·done·CSS 시험 10건이 함께 실패했다.
- Task 2: 대상 "addSystem 에 kind 를 주면 그 종류로 남고(vote·hot), 안 주면 system 이다". actual `system,system,system` / expected `vote,hot,system`. 첫 두 증거는 INVALID_RED(Malformed TAP)였다 — 원인은 CSS 시험의 빈 문자열 `actual:` 줄과, 따옴표가 든 SVG innerHTML 기대값의 이중 이스케이프. 시험을 규칙 개수 먼저 단언·path d 값 비교로 고친 뒤(미 커밋 상태에서) RED_EVIDENCE_OK 를 받고 RED 커밋.
- Task 3: 대상 "tokens.css 에 --font-serif 한 줄이 생성되어 있다". actual `0` / expected `1`. 첫 증거는 INVALID_RED 였다 — 따옴표가 든 글꼴 문자열을 toBe 로 비교한 기대값. 불리언 비교로 바꾼 뒤 RED_EVIDENCE_OK.

### GREEN / REFACTOR

세 GREEN 커밋(b798bf4, 8f322c9, e8dd603). REFACTOR 커밋 없음(정리할 중복 없음).

## 계획 대비 변경 (Deviations)

### Auto-fixed

**1. [Rule 1 - Bug] 7페이즈 v2.css 놋쇠 금지 검사가 hot 줄 규칙에서 깨짐**
- **Found during:** Task 2
- **Issue:** `test/client/v2parts.test.tsx` 의 "hex 색이 없고 놋쇠 토큰을 쓰지 않으며…" 가 `.mv-badge|.mv-stamp|.mv-rolechip` 외 모든 규칙에서 `--brass-` 를 금지한다. 계획과 승인 디자인대로 `.mv-chat__sys.is-hot` 이 `brass-200` 글자를 쓴다.
- **Fix:** 제외 목록에 `.mv-chat__sys.is-hot` 한 규칙만 더하고 머리 주석을 고쳤다. 다른 규칙의 놋쇠·진홍 금지는 그대로다.
- **Files modified:** test/client/v2parts.test.tsx
- **Commit:** 8f322c9

**2. [Rule 1 - Bug] 08-03 시험이 명조 대체값 `var(--font-serif, serif)` 를 단언**
- **Found during:** Task 3 (전체 client·unit 실행)
- **Issue:** `test/client/voteParts.test.tsx` 두 시험(배지 숫자·도장 CSS 계약)이 08-03 의 임시 대체값을 요구했다. 계획 5)는 토큰이 생기면 `var(--font-serif)` 로 정리하라고 한다.
- **Fix:** 두 단언을 `var(--font-serif)` 로 고치고 시험 이름에서 "대체값" 을 "토큰 변수" 로 바꿨다.
- **Files modified:** test/client/voteParts.test.tsx
- **Commit:** e8dd603

**3. [Rule 2 - 승인 디자인 일치] 접근성 문구 두 개를 HeadStack 안 상수로 둠**
- "투표함"·"내가 가리킨 사람" 은 chatText 에 맞는 자리가 없고 SureStamp 도 문구를 부품 안 상수로 둔 선례가 있어 HeadStack.tsx 안 `DONE_LABEL`·`MINE_LABEL` 로 두었다.

그 밖에는 계획대로 실행했다. 인증 게이트 없음, 새 의존성 없음.

## 검증

- `npx vitest run test/client/v2parts.test.tsx test/client/voteParts.test.tsx` 105건 통과
- `npx vitest run test/client/chatPanel.test.tsx test/client/chatStore.test.ts test/client/useChat.test.tsx` 통과 (v2parts 와 합쳐 199건)
- `npx vitest run test/unit/tokensV2.test.ts` 17건 통과, `npm run tokens:check` 통과
- `npm run typecheck` 종료 0, `npx vitest run --project client --project unit` 127 파일 3922건 통과(1 skipped 는 기존), `npx vite build` 성공
- 수락 기준: Task 1 `VoteBadge`·`RoleChip`·`is-mine` grep 성공과 `test(08-05)` 커밋 존재, Task 2 `is-hot`·`"vote"`·`mv-chat__sys.is-hot` grep 성공, Task 3 `--font-serif:`·`Gowun+Batang:wght@700` grep 성공과 `grep -c font-serif src/styles/v2.css` = 4(3 이상)
- 저장소 위생 규칙 검사(회사·조직 관련 표현 grep) 변경 파일 결과 없음

## Known Stubs

없음. 새 속성·종류는 모두 실제로 그리며, 사용처 배선(지목·찬반·유령 화면, 시스템 줄 생성)은 후속 계획(08-15~17)의 몫이다.

## Threat Flags

없음. T-08-20 은 role 이 없으면 칩·`data-role-chip` 이 0건임을 시험으로 고정하고, HeadStack 소스가 서버 상태·역할 표를 불러오지 않음을 소스 검사로 고정해 완화했다(산 사람 화면이 role 을 넘기지 않음은 08-17 몫). T-08-21 은 새 출처 없이 같은 Google Fonts 호스트라 수용, T-08-SC 는 새 의존성 없음.

## Self-Check: PASSED

- 파일 존재: src/components/v2/HeadStack.tsx, src/components/v2/ChatPanel.tsx, src/net/chatStore.ts, src/net/useChat.ts, src/styles/tokens.css, design/tokens.json, scripts/gen-tokens.mjs, index.html, test/unit/tokensV2.test.ts — 확인
- 커밋 존재: 588dc17, b798bf4, c9f3659, 8f322c9, c8a869e, e8dd603 — 확인
