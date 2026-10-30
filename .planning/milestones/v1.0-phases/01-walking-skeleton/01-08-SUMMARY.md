---
phase: 01-walking-skeleton
plan: 08
subsystem: ui
tags: [react, countdown, role-card, icon, css, vitest, tdd]

requires:
  - phase: 01-walking-skeleton
    provides: "01-03 clock.ts remainingMs, 01-05 assets.ts roleArtSrc·ds.css 토큰 규칙"
provides:
  - "countdown/formatMmSs/useCountdown: 서버 마감 시각으로 남은 시간·m:ss·마지막 5초 판정"
  - "Timer: 단계 이름을 모르는 공통 타이머 부품"
  - "cardFace: 역할 카드 면 전이 순수 함수(5초 자동 한 번, 누르면 앞·뒤)"
  - "RoleCard: 뒷면 공통 마크업·앞면 지연 마운트 역할 카드"
  - "roleText: 역할 이름·한 줄 설명·동료 줄 문구 단일 출처"
  - "Icon: 1페이즈 인라인 SVG 8종"
  - "phase.css: .mf-timer*, .mf-card* 부품 스타일"
affects: [01-09, 01-10, 01-11, 01-12, 01-13]

actuals:
  tokens: 10000
  tasks: 3
  commits: 6
plan_head_before: 42bef63ad167ea5de21981febc90a1e5833057bc
plan_head_after: 60fd13cbd2cafd3a5b90f875cef3931d43f0dd1d

tech-stack:
  added: []
  patterns:
    - "시각은 인자로만 받는 순수 함수(countdown, cardFace) 위에 얇은 훅·부품을 얹는다"
    - "부품이 자기 CSS 를 직접 import(phase.css) — 병렬 계획 사이 CSS 충돌 방지"
    - "역할이 드러날 수 있는 DOM 은 처음 필요해질 때 마운트(앞면 지연 마운트)"
    - "토큰에 없는 길이는 부품 안 지역 CSS 변수(--mf-timer-tick, --mf-timer-pop, --mf-card-rise)"

key-files:
  created:
    - src/net/countdown.ts
    - src/net/cardFace.ts
    - src/game/roleText.ts
    - src/components/Icon.tsx
    - src/components/Timer.tsx
    - src/components/RoleCard.tsx
    - src/styles/phase.css
    - test/unit/countdown.test.ts
    - test/unit/cardFace.test.ts
    - test/client/timer.test.tsx
    - test/client/roleCard.test.tsx
  modified: []

key-decisions:
  - "RoleCard 카드 폭은 min(min(64vw, 240px), calc(52dvh * 2 / 3)) 로 둔다: width 와 max-height 를 따로 주면 높이가 모자랄 때 비율이 깨져서, 높이 한도에서 거꾸로 폭을 구해 2:3 을 지킨다"
  - "직업 그림은 폭 150·height auto·flex-shrink 허용·object-fit contain: 마피아 카드(그림+이름+설명+구분선+동료 줄)가 낮은 화면에서도 글자가 잘리지 않도록 그림이 먼저 줄어든다"
  - "role 이 null 이어도 카드는 같은 role=button 이고 onFlip 을 부른다: 뒤집을지는 cardFace.onTap 이 정한다(마크업을 역할 유무로 가르지 않기 위함)"
  - "앞면이 한 번 마운트된 뒤 다시 뒷면이 되면 앞면은 남기되 aria-hidden 으로 접근성 트리에서 숨긴다(되돌림 애니메이션 유지)"

patterns-established:
  - "Pattern: 앞면은 mountedFront 상태가 face 가 처음 front 가 될 때 참이 되는 '렌더 중 상태 조정'으로 마운트"
  - "Pattern: RED 커밋에 빈 값 뼈대 모듈을 함께 넣어 import 실패가 아닌 단언 실패로 RED 를 만든다(01-05 와 같음)"

requirements-completed: [GAME-01, ROLE-02]

coverage:
  - id: D1
    description: "공통 Timer: 서버 마감 시각·단계 길이·오프셋으로 막대(scaleX)와 m:ss, 마지막 5초 진홍·timer-pop, role=timer, 마감 뒤 0:00·빈 막대"
    requirement: "GAME-01"
    verification:
      - kind: unit
        ref: "test/unit/countdown.test.ts#countdown / formatMmSs"
        status: pass
      - kind: unit
        ref: "test/client/timer.test.tsx#Timer"
        status: pass
    human_judgment: false
  - id: D2
    description: "역할 카드 면 전이: 5초 자동 한 번, 누르면 앞·뒤, 5초 뒤 입장은 앞면부터, 역할 없는 뷰는 뒤집히지 않음"
    requirement: "GAME-01"
    verification:
      - kind: unit
        ref: "test/unit/cardFace.test.ts#initialCardState / onTap / onAutoTimer / 시각 계산"
        status: pass
    human_judgment: false
  - id: D3
    description: "RoleCard 뒷면이 모든 역할(역할 없음 포함)에서 같은 마크업이고 역할 글자·직업 그림이 없다. 앞면은 처음 front 가 될 때 마운트"
    requirement: "ROLE-02"
    verification:
      - kind: unit
        ref: "test/client/roleCard.test.tsx#RoleCard 뒷면 (ROLE-02, Pitfall 20)"
        status: pass
    human_judgment: false
  - id: D4
    description: "RoleCard 앞면 구성(그림·이름·설명·마피아만 동료 줄 0/1/2명)과 누름·Space·Enter 뒤집기, roleText 문구, Icon 접근성 규칙"
    requirement: "ROLE-02"
    verification:
      - kind: unit
        ref: "test/client/roleCard.test.tsx#RoleCard 앞면 / RoleCard 입력 / roleText / Icon"
        status: pass
    human_judgment: false
  - id: D5
    description: "카드 폭·높이(min(64vw,240px), 52dvh), 800ms 뒤집기 모션, 가장 긴 설명이 폭 360px 에서 세 줄 이내, 마피아 카드가 낮은 화면에서 잘리지 않음"
    verification: []
    human_judgment: true
    rationale: "happy-dom 은 CSS 레이아웃·3D 변환을 계산하지 않아 자동 테스트가 단언하지 못한다(grep 인수 기준으로 규칙 존재만 확인). 실기기 폭 360px 확인은 01-13 화면 조립 뒤 UAT"
  - id: D6
    description: "phase.css 규칙: hex 없음, 진홍은 300·400·500 세 단계(타이머 마지막 5초, 뒷면 마름모, 동료 줄)뿐"
    verification:
      - kind: other
        ref: "Task 3 acceptance_criteria grep 4개"
        status: pass
    human_judgment: false

duration: 약 20min
completed: 2026-10-23
status: complete
---

# Phase 1 Plan 08: 공통 타이머·역할 카드·아이콘 묶음 Summary

**서버 마감 시각만으로 줄어드는 m:ss 공통 Timer(마지막 5초 진홍·timer-pop)와, 뒷면 마크업이 역할과 무관하고 앞면은 처음 뒤집힐 때만 마운트되는 RoleCard(5초 자동 한 번·800ms 뒤집기), 순수 함수 countdown·cardFace, 역할 문구 단일 출처 roleText, 인라인 SVG Icon 8종을 만들었다.**

## Performance

- **Duration:** 약 20분
- **Completed:** 2026-10-23
- **Tasks:** 3 (트레이서 1, 일반 2)
- **Files modified:** 11 (모두 생성)

## Accomplishments

- `countdown`·`formatMmSs`·`useCountdown` 이 `clock.remainingMs` 위에서 남은 ms·올림 초·마지막 5초(0 초과 5000ms 이하, 경계 포함)·막대 비율(0~1)을 계산한다. 훅은 남은 시간이 있는 동안만 250ms 간격으로 다시 그리고, 탭이 다시 보이면 한 번 다시 계산하며, 정리에서 간격과 리스너를 해제한다.
- `Timer` 는 endsAt·durationMs·offset 만 받는다(단계 이름을 모른다). 막대는 `scaleX(ratio)`(왼쪽 기준, 250ms linear), 숫자는 tabular-nums `m:ss`, 초 단위 `key` 로 마지막 5초에 220ms `timer-pop` 이 매 초 다시 돈다. `role="timer"`·`aria-label="남은 시간 N초"`, 라이브 영역 속성 없음. 마감 뒤에는 0:00·빈 막대로 머물고 간격을 멈춘다. offset 이 바뀌면 그 값으로 다시 그린다.
- `cardFace` 순수 함수: 시작 5초 안에 누르지 않으면 한 번만 자동 앞면, 누르면 앞·뒤 토글과 함께 자동 소진, 5초 뒤 입장은 앞면부터, 역할 없는 뷰는 입력 무시, `seenFront` 기록. 시각은 서버 시각(로컬+오프셋)으로 센다.
- `RoleCard`: 뒷면은 마피아·시민·역할 없음 모두 같은 마크업(outerHTML 까지 동일, 글자·`<img>` 없음, 진홍 마름모만). 앞면은 face 가 처음 front 일 때 마운트(그림 150 → 이름 36 → 설명 → 마피아만 구분선 + 동료 줄 "동료 · 서준, 민지"/"혼자예요"). 누름·Space·Enter 가 앞·뒤 어느 면에서든 `onFlip`. 다시 뒷면이 되면 앞면은 `aria-hidden`.
- `roleText.ts` 가 역할 이름·한 줄 설명·`alliesText` 의 단일 출처. `Icon` 은 1페이즈 8종을 24×24·stroke 2·round 로 그리고 label 이 없으면 `aria-hidden`.
- `phase.css`: Timer·RoleCard 규칙. 진홍은 300·400·500 세 단계뿐, hex 없음.

## Task Commits

TDD(`tdd=true`)로 Task 마다 RED(test) → GREEN(feat) 커밋.

1. **Task 1: 트레이서 — 공통 타이머** - `b2e241e` (test) → `7125425` (feat)
2. **Task 2: 카드 면 전이** - `3a5edc2` (test) → `701335e` (feat)
3. **Task 3: 역할 카드·역할 문구·아이콘 묶음** - `7a0ffb7` (test) → `60fd13c` (feat)

**Plan metadata:** 이 SUMMARY 를 담은 `docs(01-08)` 커밋.

트레이서 피드백 게이트: 모드 `end-of-phase`, 대화형, `<verify>` 가 자동 명령뿐이라 `vitest`·`typecheck` 를 다시 돌려 통과를 확인하고 확장 Task 로 넘어갔다(`⚡ Tracer verified end-to-end — expanding`).

## Files Created/Modified

- `src/net/countdown.ts` - 남은 시간 계산·`m:ss`·`useCountdown`
- `src/net/cardFace.ts` - 카드 면 전이 순수 함수, `AUTO_FLIP_MS`
- `src/game/roleText.ts` - `ROLE_TEXT`, `alliesText`
- `src/components/Icon.tsx` - 인라인 SVG 아이콘 8종
- `src/components/Timer.tsx` - 공통 타이머(phase.css 를 직접 import)
- `src/components/RoleCard.tsx` - 역할 카드(phase.css 를 직접 import)
- `src/styles/phase.css` - `.mf-timer*`, `.mf-card*`, `@keyframes mf-timer-pop`·`mf-card-rise`
- `test/unit/countdown.test.ts`, `test/unit/cardFace.test.ts`, `test/client/timer.test.tsx`, `test/client/roleCard.test.tsx`

## TDD Gate Compliance

세 Task 모두 `test(01-08)` RED 커밋이 `feat(01-08)` GREEN 커밋보다 앞선다. REFACTOR 커밋은 없다.

- **RED 평가(의미 검사):** 이 계획은 `type: execute` 라 형식 판정기(`check tdd-red-evidence`)용 TAP 기록은 만들지 않고, 실행 결과를 직접 읽어 판정했다.
  - Task 1: 뼈대 모듈로 26개 전부 단언에서 실패(`remainingMs -1`, 빈 문자열, `role="timer"` 부재). 처음에 "간격 타이머 정리" 테스트 2개가 `getTimerCount() === 0` 만 확인해 뼈대에서도 통과하길래, 마감 전에 타이머가 `> 0` 임을 먼저 단언하도록 강화한 뒤 RED 를 다시 확인했다.
  - Task 2: 18개 중 14개가 단언에서 실패. 통과한 4개는 "역할 없으면 입력 무시"·"이미 잠겼으면 그대로"처럼 항등 뼈대와 기대값이 우연히 같은 케이스라 계획한 동작에 대한 RED 로 쓸 수 없지만, 나머지 14개가 같은 함수들을 계획한 단언에서 떨어뜨린다.
  - Task 3: 36개 중 29개가 단언에서 실패(role 부재, 문구 불일치, 동료 줄 없음, `viewBox` 없음 등). 통과한 7개는 "뒷면에 글자·이미지가 없다" 같은 부정 단언이라 빈 뼈대에서도 참이다(GREEN 에서도 같은 단언이 실제 마크업에 대해 통과한다).
  - 세 Task 모두 뼈대를 RED 커밋에 넣은 이유는 import 실패(INVALID_RED)를 피하기 위해서다(01-05 와 같은 방식).

## Decisions Made

- 카드 폭을 `min(min(64vw, 240px), calc(52dvh * 2 / 3))` 로 둔다. `width` 와 `max-height` 를 따로 주면 높이가 모자란 화면에서 가로세로 비율이 깨진다. 높이 한도(52dvh)에서 폭을 거꾸로 구해 2:3 을 지키고 `max-height: 52dvh` 도 함께 둔다(계획의 `min(64vw, 240px)`·`52dvh` 를 둘 다 유지).
- 직업 그림은 폭 150·`height: auto`·`flex-shrink` 허용·`object-fit: contain`. 마피아 카드(그림 200 + 이름 + 설명 + 구분선 + 동료 줄)는 폭 240 의 카드(높이 360)에 그림 폭 150 그대로는 안 들어가서, 카드가 낮을 때 그림이 먼저 줄어 글자가 잘리지 않게 했다.
- `role` 이 null 이어도 카드는 같은 `role="button"`·`onFlip` 을 부른다. 뒤집을지는 `cardFace.onTap(…, hasRole)` 이 정하므로 마크업을 역할 유무로 가르지 않는다.
- 앞면이 한 번 마운트된 뒤 다시 뒷면이 되면 앞면은 남기되(되돌림 애니메이션) `aria-hidden` 으로 접근성 트리에서 뺀다. 루트 `aria-label` 은 뒷면일 때만 둔다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] RED 가 유효하도록 뼈대 모듈을 RED 커밋에 포함**
- **Found during:** Task 1, 2, 3 (RED 작성)
- **Issue:** 새 모듈이 없으면 테스트가 import 실패로 끝나 INVALID_RED 가 된다.
- **Fix:** 빈 값을 돌려주는 뼈대를 RED 커밋에 넣고 GREEN 에서 채웠다.
- **Files modified:** src/net/countdown.ts, src/components/Timer.tsx, src/net/cardFace.ts, src/game/roleText.ts, src/components/Icon.tsx, src/components/RoleCard.tsx
- **Committed in:** b2e241e, 3a5edc2, 7a0ffb7

**2. [Rule 3 - Blocking] `node_modules` 가 없어 `npm ci` 로 설치**
- **Found during:** 시작 전 환경 확인
- **Issue:** 새 워크트리에 의존성이 없어 vitest·tsc 를 돌릴 수 없었다.
- **Fix:** `package-lock.json` 그대로 `npm ci`. 새 패키지는 추가하지 않았다(T-01-SC 유지).

**3. [Rule 1 - Bug] 폭 계산식을 비율 보존형으로 보강**
- **Found during:** Task 3 (CSS 작성)
- **Issue:** 계획 문구 그대로 `width: min(64vw, 240px)` + `max-height: 52dvh` + `aspect-ratio: 2/3` 이면, 높이가 모자란 화면에서 max-height 가 높이만 잘라 비율이 깨진다("높이가 모자라면 폭이 줄게" 요구와 어긋남).
- **Fix:** 폭을 `min(min(64vw, 240px), calc(52dvh * 2 / 3))` 로 두었다(인수 기준 grep `min(64vw, 240px)`·`52dvh` 모두 만족).
- **Files modified:** src/styles/phase.css
- **Committed in:** 60fd13c

---

**Total deviations:** 3 (Rule 3 두 건, Rule 1 한 건, 범위 확대 없음)
**Impact on plan:** 계획한 동작과 산출물은 그대로이고, 검증 방식과 CSS 계산식만 보강했다.

## Issues Encountered

- 인수 기준 `! grep -q "aria-live" src/components/Timer.tsx` 가 처음에는 Timer.tsx 의 주석 속 "aria-live" 글자 때문에 실패했다. 주석 표현을 바꿔 통과시켰다(코드에는 라이브 영역 속성이 처음부터 없었다).
- 이 환경의 실행 도구는 `cat <<EOF` 같은 한 줄 복합 명령을 거부해서 파일은 Write·Edit 로만 만들고 명령은 하나씩 실행했다.

## Known Stubs

없음. 빈 뼈대(`countdown.ts`, `Timer.tsx`, `cardFace.ts`, `roleText.ts`, `Icon.tsx`, `RoleCard.tsx`)는 RED 커밋에만 있었고 GREEN 에서 모두 채웠다. 이 부품들은 아직 화면에 조립되지 않았다(01-13 이 역할 확인 화면으로 조립한다) — 번들에 `phase.css` 가 아직 들어가지 않는 것은 이 때문이다.

## Threat Flags

없음. 새 네트워크 엔드포인트·인증 경로·스키마는 없다. T-01-26(뒷면 DOM·이미지 요청으로 역할 노출)은 `roleCard.test.tsx` 의 뒷면 innerHTML·outerHTML 동일, 글자·`<img>`·역할 id 문자열 부재 테스트로 mitigate 했다. 직업 그림 프리로드는 01-05 의 4종 전체 목록이라 요청 패턴으로도 역할이 드러나지 않는다.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 01-13 은 `Timer`(endsAt·durationMs·offset), `RoleCard`(role·face·allies·onFlip), `cardFace`(`initialCardState`·`onTap`·`onAutoTimer`·`autoFlipDelayMs`·`sinceStartMs`, `seenFront`), `roleText`, `Icon` 을 그대로 가져다 역할 확인 화면(S-05)과 [내 역할] 시트(C-01)를 조립할 수 있다.
- 카드 안 힌트는 없다. "카드를 눌러 직업을 확인하세요" 등 카드 밖 안내 두 줄은 01-13 이 쓴다.
- `phase.css` 를 `main.tsx` 에서 따로 import 할 필요는 없다(부품이 직접 import).
- 실기기 폭 360px 에서 가장 긴 설명 세 줄 이내, 마피아 카드가 낮은 화면(예: 높이 640)에서 잘리지 않는지, 800ms 뒤집기 모션은 01-13 조립 뒤 UAT 몫이다(`coverage` D5 `human_judgment: true`).

웨이브 4 push 미룸 — 병합 뒤 main 에서 HANDOFF 한 줄 갱신과 git push origin main 필요 (이 실행은 병렬 연결 워크트리라 HANDOFF.md·push 조건 1번에 해당하지 않고, 오케스트레이터가 main 병합 뒤 처리한다)

## Self-Check: PASSED

- 생성 파일 11개(`src/net/countdown.ts`, `src/net/cardFace.ts`, `src/game/roleText.ts`, `src/components/Icon.tsx`, `src/components/Timer.tsx`, `src/components/RoleCard.tsx`, `src/styles/phase.css`, 테스트 4개) 모두 존재.
- 커밋 6개(`b2e241e`, `7125425`, `3a5edc2`, `701335e`, `7a0ffb7`, `60fd13c`) 모두 HEAD 의 조상.
- `npx vitest run --project unit --project client` 19개 파일·259개 통과, `npm run typecheck`·`npm run build` 성공.
- 인수 기준(Task 1 grep 3개, Task 2 grep 2개, Task 3 grep 4개) 통과, phase.css 에 hex 없음·진홍 300·400·500 만.

---
*Phase: 01-walking-skeleton*
*Completed: 2026-10-23*
