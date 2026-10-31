---
phase: 06-world-skeleton
plan: "12"
subsystem: ui-v2-parts
tags: [react19, v2-design-system, nametag, headstack, toast, action-row, css-tokens, tdd]

requires:
  - phase: 06-world-skeleton
    provides: "06-04 tokens.css 의 v2 토큰(--overlay-ink·--z-tags·--z-toast·--toast-top·--dur-toast·--seat-1~8 등)"
provides:
  - "src/components/v2/HeadStack.tsx: NameTag·HeadStack(name·color·me·away) — mv-tag/mv-head 마크업, 말줄임·최대 폭 없음"
  - "src/components/v2/V2Icon.tsx: point·crown·play·check·roleCitizen 5종(24 격자·선 2px·currentColor)"
  - "src/components/v2/PhaseHeader.tsx: 제목 + 접히는 안내(+ time·total 있을 때만 시간 링)"
  - "src/components/v2/TopToast.tsx: TopToast + useTopToast(show(text, icon?)·dismiss·props, 한 번에 하나·1500ms)"
  - "src/components/v2/DotProgress.tsx: count 개 켜진 점 + 읽어 주는 이름"
  - "src/components/ActionButton.tsx: ActionButton(primary·inactive·flat) + ActionRow(repeat(n, minmax(0, 1fr)))"
  - "src/styles/v2.css: mv-*·mf-act* 규칙(토큰 변수만, hex 없음)"
affects: [06-13-nametag-layer, 06-15-lobby-frame, 06-17-e2e, 07-day-ui, 08-vote-ui]

actuals:
  tokens: 9184
  tasks: 2
  commits: 4
plan_head_before: 5be3ec390c18aa408bf233634b4a89cb8e052c31
plan_head_after: 2c28dfeb20de9cc5db0d3561472ea0a07e794425

tech-stack:
  added: []
  patterns:
    - "승인 v2 디자인 시스템(bundle.js 의 React 18 전역 h())을 모듈 TSX 로 옮기고 bundle.css 의 해당 mv-* 규칙만 src/styles/v2.css 로 옮긴다 — 런타임에 bundle.js 를 불러오지 않는다"
    - "CSS 파일 텍스트 검사로 스타일 계약(nowrap·max-width/ellipsis 없음·치수·hex 없음)을 테스트에 고정 — happy-dom 이 글자 폭을 못 재서(A1)"
    - "알림 훅은 { props, show, dismiss } 를 돌려주고 <TopToast {...toast.props} /> 로 쓴다(v1 useToast 와 같이 한 번에 하나)"

key-files:
  created:
    - src/components/v2/V2Icon.tsx
    - src/components/v2/HeadStack.tsx
    - src/components/v2/PhaseHeader.tsx
    - src/components/v2/TopToast.tsx
    - src/components/v2/DotProgress.tsx
    - src/components/ActionButton.tsx
    - src/styles/v2.css
    - test/client/v2parts.test.tsx
  modified: []

key-decisions:
  - "이름표는 max-width·overflow hidden·text-overflow 가 전혀 없고 white-space: nowrap 만 둔다 — 전각 8자 + ' (나)' 도 잘리지 않는다. 스타일 계약을 CSS 파일 텍스트 검사 테스트로 고정"
  - "닉네임은 React 텍스트 노드로만 렌더(innerHTML·dangerouslySetInnerHTML 없음) — '<b>x</b>' 를 이름표·알림에 넣는 테스트로 T-06-26 고정"
  - "mv-ring 의 급할 때 진홍(crimson-500/400)은 옮기지 않았다 — 진홍은 이 페이즈 UI 에 없다(UI-SPEC Color, 계획 truths). 급하면 숫자만 나타나고 색은 그대로. 시간 링을 쓰는 페이즈가 색을 정한다"
  - "TopToast 에 mv-toast--top(absolute·top var(--toast-top)·z var(--z-toast))을 기본으로 붙였다 — 원본은 위치를 쓰는 쪽에 맡겼으나 toast-top 토큰이 이 용도다. 06-15 가 담는 틀(position: relative)만 주면 된다"
  - "행동 버튼 높이는 height 가 아니라 min-height: var(--control-button) — 보드 act() 와 같고, 시스템 글자 확대에서도 잘리지 않는다"
  - "useTopToast 는 1500ms 뒤 꺼지고 220ms(opacity 전환) 뒤 글자를 비운다 — 빈 알림은 .mv-toast__text:empty 로 자리를 차지하지 않는다"

patterns-established:
  - "CSS 규칙 검사 헬퍼 rulesFor(css, selector): 다음 글자가 이름 글자가 아닐 때만 선택자로 인정(.mf-act 가 .mf-act-row 를 끌어오지 않음)"
  - "RED 는 존재하지 않는 모듈 import 로 시작(계획 type 이 execute 라 #3770 RED 증거 분류기 대상 아님)"

requirements-completed: [MAP-07, MAP-01]

coverage:
  - id: D1
    description: "이름표(NameTag)·HeadStack 이 승인 v2 마크업 그대로 전각 8자 + ' (나)' 를 말줄임 없이 그린다 (스타일 계약)"
    requirement: MAP-07
    verification:
      - kind: unit
        ref: "test/client/v2parts.test.tsx#NameTag (MAP-07, MAP-01), v2.css 이름표 스타일 계약"
        status: pass
    human_judgment: true
    rationale: "실제 글자 폭·잘림 여부는 happy-dom 이 못 잰다(가정 A1). 06-17 E2E 가 폰 6종에서 scrollWidth === clientWidth 로 확인한다. 이 계획은 실브라우저 측정만 한 번 했다(아래 NameTag 폭)"
  - id: D2
    description: "닉네임이 이름표·알림에서 HTML 이 아니라 글자로만 그려진다 (T-06-26)"
    requirement: MAP-01
    verification:
      - kind: unit
        ref: "test/client/v2parts.test.tsx#닉네임에 HTML 이 들어 있어도 글자 그대로 (NameTag·TopToast)"
        status: pass
    human_judgment: false
  - id: D3
    description: "PhaseHeader·TopToast·DotProgress·ActionButton·ActionRow 가 승인 모양·토큰으로 있고 hex·진홍·놋쇠가 없다"
    requirement: MAP-01
    verification:
      - kind: unit
        ref: "test/client/v2parts.test.tsx#PhaseHeader·DotProgress·TopToast·ActionButton·ActionRow"
        status: pass
      - kind: other
        ref: "npm run typecheck"
        status: pass
    human_judgment: true
    rationale: "시안과 같은 생김새(간격·색 균형)는 06-15 로비 틀에 얹은 뒤 실기기에서 사람이 본다"

duration: 10min
completed: 2026-10-31
status: complete
---

# Phase 6 Plan 12: v2 이름표·로비 틀 부품 이식 Summary

**승인 v2.0 디자인 시스템의 NameTag·HeadStack·PhaseHeader·TopToast·DotProgress·V2Icon(5종)과 보드의 행동 버튼(ActionButton/ActionRow)을 React 19 TSX 와 `src/styles/v2.css`(토큰 변수만)로 옮기고, 이름표가 말줄임하지 않는다는 스타일 계약과 닉네임 XSS 방어를 테스트 38개로 고정했다**

## Performance

- **Duration:** 10 min
- **Started:** 2026-10-31T17:03:00Z (기준선 기록 17:05:29Z)
- **Completed:** 2026-10-31T17:13:00Z
- **Tasks:** 2 (Task 1 트레이서 + Task 2)
- **Files modified:** 8 (전부 신규)

## Accomplishments

- 이름표: 알약(radius-pill)·면 overlay-ink·글자 gray-50 14px 700·shadow-text·안쪽 2px 8px·점 8×8과 이름 6px. 내 이름표는 ' (나)' + 안쪽 테두리 1.5px gray-100, 끊긴 이름표는 불투명도 0.55·점 gray-700. 최대 폭 없음, 말줄임 없음(nowrap)
- 단계 머리(접히는 안내, time·total 이 있을 때만 시간 링)·위 알림(한 줄·role status·aria-live polite·새 알림이 이전 알림을 바꿈·1500ms)·점 진행(0개/8개 경계)
- ActionButton 세 모양(primary·inactive·flat)과 ActionRow `repeat(n, minmax(0, 1fr))` gap 8. 360 폭 한 칸에서 '시작' + 점 8개가 들어가는 계산: 칸 328 − 안쪽 26 = 302 안에 아이콘 22 + 8 + 라벨 약 32 + 8 + 점 8개(9×8 + 5×7 = 107) = 약 177
- 트레이서 게이트: Task 1 `<verify>` 자동 검사만 있어 다시 돌려 통과 → "Tracer verified end-to-end — expanding", Task 2 진행

## Task Commits

1. **Task 1 (트레이서): 이름표·HeadStack·V2Icon·v2.css** — RED `7647fbf` (test) → GREEN `333ccb3` (feat)
2. **Task 2: PhaseHeader·TopToast·DotProgress·ActionButton** — RED `c388d5e` (test) → GREEN `2c28dfe` (feat)

**Plan metadata:** 이 SUMMARY 와 STATE·ROADMAP·REQUIREMENTS 갱신은 docs(06-12) 커밋 하나

## NameTag 폭 측정 (오케스트레이터 요청 — PAN_BOX 영향 확인)

06-03 은 이름표를 최대 180×24, 머리 위 4px(`NAMETAG_MAX_W`·`NAMETAG_GAP`, `src/world/camera.ts`)로 가정했다. 실제 Chrome(데스크톱, 뷰포트 360)에서 이 계획의 CSS·tokens.css 로 `getBoundingClientRect().width` 를 쟀다(측정 스크립트는 세션 scratchpad 의 임시 파일이며 저장소에 넣지 않음). Gowun Dodum 웹폰트를 불러온 경우와 폰트 없이 시스템 폰트로 떨어진 경우를 둘 다 쟀다.

| 닉네임 8자(이름표 전체 폭) | Gowun Dodum | 폰트 대체 |
| --- | --- | --- |
| 한글 + ' (나)' | 161.5px | 154.2px |
| 한글(남의 이름표) | 133.0px | 126.9px |
| 넓은 한글 + ' (나)' | 159.8px | 154.2px |
| 전각 대문자 + ' (나)' | 159.2px | 154.2px |
| 영문 W 8개 + ' (나)' | 160.8px | 169.1px |
| 한자 + ' (나)' | 155.3px | 154.2px |
| **이모지 😀 8개 + ' (나)'** | **202.4px** | **201.3px** |

- 글자·한글·한자·영문은 모두 180 안이다(최대 약 169).
- **이모지 8개 + ' (나)' 만 180 을 넘는다(약 202px).** 서버 닉네임 검증(`shared/nickname.ts`)은 기호(`\p{S}`)를 허용하고 8 grapheme 까지 받으므로 이 입력은 실제로 가능하다. ' (나)' 가 붙지 않는 남의 이름표는 약 174px 로 180 안이다.
- 한정된 경우(내 이름표 + 이모지 8개)이고 `camera.ts` 를 바꾸지 않았다. PAN_BOX 의 재유도는 오케스트레이터/06-13·06-17 이 결정한다: 이름표를 중심 기준으로 좌우 절반(약 101px)까지 화면 밖으로 나가지 않게 하는 여유가 필요한 입력이라는 점만 알려 둔다.
- 데스크톱 Chrome 측정이라 폰(iOS Safari)의 폰트 대체와 다를 수 있다. 06-17 E2E 가 폰 6종에서 `scrollWidth === clientWidth` 로 확정한다(가정 A1).

## Files Created/Modified

- `src/components/v2/V2Icon.tsx` — 로비 아이콘 5종, label 없으면 aria-hidden
- `src/components/v2/HeadStack.tsx` — NameTag·HeadStack
- `src/components/v2/PhaseHeader.tsx` — 단계 머리와 시간 링 마크업
- `src/components/v2/TopToast.tsx` — TopToast·useTopToast
- `src/components/v2/DotProgress.tsx` — 점 진행
- `src/components/ActionButton.tsx` — ActionButton·ActionRow
- `src/styles/v2.css` — mv-sr·mv-icon·mv-head·mv-tag*·mv-phase*·mv-ring*·mv-dots*·mv-toast*·mf-act*·mf-act-row, 모션 줄이기 블록
- `test/client/v2parts.test.tsx` — 38개

## Decisions Made

key-decisions 참고. 요약하면: 이름표 스타일 계약 고정, 닉네임은 텍스트 노드로만, 시간 링 급함 색의 진홍은 옮기지 않음, TopToast 에 `--toast-top` 위치 기본값, 버튼 높이는 min-height, 알림 글자는 전환 뒤에 비움.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - 필수 기능] 시간 링 급함 색의 진홍을 옮기지 않음**
- **Found during:** Task 2 (v2.css mv-ring 이식)
- **Issue:** 원본 bundle.css 는 `.mv-ring.is-urgent .mv-ring__bar { stroke: var(--crimson-500) }`, `.mv-ring__num { color: var(--crimson-400) }`. 계획 truths(UI-SPEC Color)는 이 페이즈 UI 에 진홍·놋쇠를 쓰지 않는다고 못 박았고, 테스트가 `--crimson-`/`--brass-` 부재를 확인한다
- **Fix:** 급한 막대 색 규칙을 옮기지 않고(막대는 gray-100 그대로) 숫자 색을 gray-50 으로. 숫자는 5초 이하에서만 나타난다
- **Files modified:** `src/styles/v2.css`
- **Verification:** `v2.css 이름표 스타일 계약 … 진홍·놋쇠 토큰을 쓰지 않는다` 통과
- **Committed in:** `2c28dfe`

**2. [Rule 2 - 필수 기능] 빈 알림이 자리를 차지하지 않게 `.mv-toast__text:empty` 와 글자 비우기 추가**
- **Found during:** Task 2 (TopToast)
- **Issue:** 원본 TopToast 는 알림이 없어도 `padding 8px 16px + 1px 테두리` 알약이 투명하게 자리를 차지한다. 계획 truths 는 "알림이 없으면 자리를 차지하지 않고" 라고 한다
- **Fix:** `.mv-toast__text:empty { display: none }` 와, useTopToast 가 꺼진 뒤 220ms(opacity 전환) 뒤에 글자를 비움
- **Files modified:** `src/styles/v2.css`, `src/components/v2/TopToast.tsx`
- **Verification:** `알림이 없으면 is-on 이 아니고 글자 칸이 비어 있으며 role status·aria-live polite` 통과
- **Committed in:** `2c28dfe`

**3. [계획 해석] TopToast 에 위치 기본값(`mv-toast--top`) 추가, 행동 버튼 높이를 min-height 로**
- 원본 `.mv-toast` 는 위치가 없고 쓰는 쪽이 정한다. 계획 artifacts 가 `--toast-top` 을 언급하고 UI-SPEC 이 위 96→토큰 88px 를 가리켜, 담는 틀이 `position: relative` 이기만 하면 되도록 기본 위치를 줬다. 06-15 가 다르게 두려면 `.mv-toast--top` 만 덮어쓰면 된다.
- 계획 문구 "높이 var(--control-button)" 는 보드 act() 의 `min-height: 52px` 와 같게 `min-height` 로 옮겼다(시스템 글자 확대에서 잘리지 않게). 테스트가 이 형태를 고정한다.

---

**Total deviations:** 2 auto-fixed (Rule 2 두 건) + 해석 1건
**Impact on plan:** 모두 계획 truths(진홍 금지·빈 알림 자리 없음)를 지키기 위한 것이다. 범위 확장 없음.

## TDD 게이트 준수 (tdd="true" 두 작업)

- 계획 type 은 `execute` 라 `type: tdd` 전용 RED 증거 분류기(#3770) 대상이 아니다. 두 작업 모두 `test(06-12)` 커밋이 `feat(06-12)` 커밋보다 앞선다(`7647fbf` < `333ccb3`, `c388d5e` < `2c28dfe`).
- RED 실패 이유: Task 1 은 `HeadStack`·`V2Icon` 모듈이 아직 없어 파일 불러오기 단계에서 실패(`Failed to resolve import`, 테스트 0개 실행). Task 2 도 새 모듈 5개가 없어 같은 이유. 즉 단언 실패가 아니라 불러오기 실패 RED 다. 분류기 기준의 단언 RED 는 아니다.
- GREEN: `npx vitest run test/client/v2parts.test.tsx` 38 passed.
- Task 2 GREEN 중 테스트 도우미 `rulesFor` 의 선택자 일치가 `.mf-act` 를 `.mf-act-row` 와 섞는 테스트 쪽 오류를 한 번 고쳤다(테스트 수정은 feat 커밋에 포함).

## Issues Encountered

없음. (BSD `sed -i` 가 안 먹어 python 으로 고친 것 외에는 막힌 일 없음.)

## Known Stubs

없음. `ActionButton`·`TopToast` 등은 모두 실제 속성으로 동작하고 로비 연결은 06-15 몫이다.

## Threat Flags

없음. T-06-26(닉네임 XSS)은 mitigate 완료: 이름표·알림은 React 텍스트 노드만 쓰며 `<b>x</b>`·`<i>x</i>` 테스트로 고정. 새 네트워크·인증·파일 접근 표면 없음. T-06-SC: 패키지를 설치하지 않았다.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 06-13(이름표 층)은 `HeadStack` 을 `translate(-50%, -100%)` 로 놓고 `--z-tags` 를 주면 된다(z-index 는 이 계획이 주지 않았다).
- 06-15(로비 틀)는 `PhaseHeader`·`TopToast`(담는 틀 `position: relative`)·`ActionRow`/`ActionButton`/`DotProgress` 를 쓴다. 손님은 `<ActionButton variant="flat" label="방장을 기다리는 중…" />`, 시작 조건 미달은 `variant="inactive"`(콜백은 불리므로 이유 알림을 부르는 쪽이 판단).
- 주의: 내 이름표 + 이모지 8개는 약 202px 로 06-03 의 180px 가정을 넘는다(위 측정). 06-13·06-17 에서 PAN_BOX 여유 재유도 여부를 정해야 한다.

## Self-Check: PASSED

- 신규 파일 8개 모두 존재, 커밋 4개(`7647fbf`·`333ccb3`·`c388d5e`·`2c28dfe`) 모두 HEAD 의 조상
- `npx vitest run test/client/v2parts.test.tsx` 38 passed, `npm run typecheck` 통과
- 작업 1·2 acceptance_criteria 전부 통과(파일·export grep, ellipsis 0, nowrap, hex 0, `test(06-12)` 커밋 존재)

---
*Phase: 06-world-skeleton*
*Completed: 2026-10-31*
