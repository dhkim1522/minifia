---
phase: 03-night-morning
plan: 02
subsystem: day-table-ui
tags: [tdd, tracer, day-table, night-pick, ghost, spectator, badges, design-refs]
status: complete

requires:
  - phase: 02-day-discussion
    provides: DayTable·daySeatLayout(결정 0017), Figure, Icon, daytable.css 토큰 규칙
  - phase: 03-night-morning/03-01
    provides: night·morning 단계와 와이어 계약(이 계획은 화면 부품만 만든다)
provides:
  - DayTableSeat 의 pick{mine,ally}·dead·spectatorPicks·onPick, DayTableProps 의 pickVerb·pickDisabled·allyMarkLabel (src/components/DayTable.tsx)
  - DayTagRow 의 { kind "dead" }·{ kind "real"; job } — 탈락 아랫줄, 관전용 실제 직업 아랫줄
  - SpectatorPick 타입("mafia" | "police" | "doctor"), PickBadge 부품(표적 배지)
  - Figure 의 ghost 속성과 ghostSrc() (src/net/assets.ts) — 유령 그림 URL 단일 출처
  - Icon target·notebook (src/components/Icon.tsx)
  - daytable.css 규칙 — mf-dt__seat--pick·mf-dt__sel·mf-dt__pick(--me/--ally/--police/--doctor)·mf-dt__tag--dead·mf-dt__claim--dead·mf-dt__claim--real(·--mafia)·mf-figure--ghost
affects: [03-08, 03-10, 03-11]

tech-stack:
  added: []
  patterns:
    - "onPick 이 있는 자리만 <button aria-pressed>, 없으면 지금의 div role=group 그대로 — 안쪽 자식(Figure·링·마름모·왕관·배지)은 두 경우가 같은 JSX 조각을 쓴다"
    - "부품 입력에는 역할 필드가 없다. 동사(pickVerb)·관전 배지(spectatorPicks)·실제 직업 아랫줄(real)은 장면이 값으로 넘긴다"
    - "탈락 흐림 없음: 유령 그림은 필터·투명도 없이 그리고 끊김 흐림(.mf-figure--disconnected)만 더한다"
    - "배지 쌓기: DOM 순서 경찰 → 의사 → 마피아 → 내 링 → 내 배지, z-index 로 내 것이 위"

key-files:
  created: []
  modified:
    - src/components/DayTable.tsx
    - src/components/Figure.tsx
    - src/components/Icon.tsx
    - src/net/assets.ts
    - src/styles/daytable.css
    - test/client/dayTable.test.tsx

key-decisions:
  - "동사·관전 배지·실제 직업은 모두 장면이 넘기는 값이다(부품에 역할 이름을 넣지 않는다). pickVerb 기본값은 '선택'이다"
  - "실제 직업 아랫줄은 { kind: 'real'; job: RoleId } 한 가지다(UI-SPEC 표의 role 키 대신 기존 주장 줄과 같은 job)"
  - "관전 마피아(spectatorPicks)와 pick.ally 가 함께 오면 --ally 배지는 하나만 그리고 관전 쪽(role=img)이 이긴다"
  - "의사 배지의 초록은 시안 hex 와 값이 같은 기존 토큰 var(--seat-3) 를 쓴다(새 색 값 없음)"

requirements-completed: [NIGHT-04, ELIM-01]

duration: 약 6분
completed: 2026-10-25

coverage:
  - id: C1
    description: "onPick 을 준 자리만 aria-pressed 버튼이고 접근성 이름이 '{닉네임}{ (나)}, {동사} 대상' 이며, 누르면 onPick 이 한 번 불리고 pickDisabled 면 눌러도 불리지 않는다. 입력이 없는 테이블에는 button·선택 마크가 없다"
    requirement: "NIGHT-04"
    verification:
      - kind: unit
        ref: "test/client/dayTable.test.tsx#DayTable: 밤 대상 선택 (D-01·D-02, UI-SPEC N-1)"
        status: pass
    human_judgment: false
  - id: C2
    description: "내 선택에 발밑 링(.mf-dt__sel)과 머리 위 표적 배지(--me)가 뜨고, target·notebook 아이콘이 시안 경로로 그려지며, 시안 값이 토큰 변수로만 옮겨진다(hex 없음)"
    requirement: "NIGHT-04"
    verification:
      - kind: unit
        ref: "test/client/dayTable.test.tsx#daytable.css: 밤 선택 표시 (03-02)"
        status: pass
      - kind: unit
        ref: "test/client/dayTable.test.tsx#Icon target·notebook (03-02)"
        status: pass
    human_judgment: false
  - id: C3
    description: "탈락자는 유령 그림(탈락 흐림 없음, 끊기면 끊김 흐림만)·회색 이름표·'탈락' 아랫줄이고 접근성 이름이 '{닉네임}{ (나)}, 탈락{, 연결 끊김}' 이다. 동료 링·마름모는 그대로이고 allyMarkLabel 로 읽기 이름을 바꿀 수 있다"
    requirement: "ELIM-01"
    verification:
      - kind: unit
        ref: "test/client/dayTable.test.tsx#DayTable: 탈락과 관전 아랫줄 (D-15·결정 0021)"
        status: pass
      - kind: unit
        ref: "test/client/dayTable.test.tsx#daytable.css: 탈락과 관전 아랫줄 (03-02)"
        status: pass
    human_judgment: false
  - id: C4
    description: "관전용 실제 직업 아랫줄(점선·gray-300, 마피아는 진홍)과 자리 접근성 이름 '{닉네임}, {실제 직업}'(탈락이면 ', 탈락')이 공개 주장 알약과 구분된다"
    requirement: "ELIM-01"
    verification:
      - kind: unit
        ref: "test/client/dayTable.test.tsx#DayTable: 탈락과 관전 아랫줄 (D-15·결정 0021)"
        status: pass
    human_judgment: false
  - id: C5
    description: "종류별 표적 배지가 시안대로 그려진다 — 동료 선택(진홍, 장식), 관전의 마피아·경찰·의사(role=img + 읽기 이름), 여럿이면 DOM 순서 경찰·의사·마피아·내 링·내 배지이고 내 배지가 z-index 최상. 진홍은 ally 가 없으면 HTML 에 없다"
    requirement: "NIGHT-04, ELIM-01"
    verification:
      - kind: unit
        ref: "test/client/dayTable.test.tsx#DayTable: 종류별 표적 배지"
        status: pass
      - kind: unit
        ref: "test/client/dayTable.test.tsx#daytable.css: 종류별 배지 (03-02)"
        status: pass
    human_judgment: false
  - id: C6
    description: "새 입력 없는 테이블 출력(낮 세 단계·대기실)이 바뀌지 않는다. 좌표 계산(game/dayTable.ts)과 대기실 Table 은 BASE 와 같다"
    requirement: "NIGHT-04"
    verification:
      - kind: command
        ref: "npx vitest run (56 파일 1094 통과) + git diff --quiet b8e2263 -- src/game/dayTable.ts src/components/Table.tsx"
        status: pass
    human_judgment: false
  - id: C7
    description: "8명 전원 + 선택 링·표적 배지(최대 세 종류 겹침) + 이름표 2줄이 360폰(장면 352)에서 이웃 이름표·배지와 겹치거나 화면 끝에서 잘리지 않는다"
    human_judgment: true
    rationale: "계획이 backstop 으로 둔 항목이다. 좌표는 03-08·03-10 이 장면에 꽂은 뒤 실제 화면에서 봐야 하고, 이 계획은 부품만 만들어 jsdom 단위 테스트로는 겹침 측정이 되지 않는다. 03-12 배포본 확인에서 본다"

actuals:
  tokens: 7700
  tasks: 3
  commits: 6
plan_head_before: b8e2263f017218a27d258750bf9e0916c31c9852
plan_head_after: 565fb6ca617f0abca782ad8d7e96190e8b0cc28e
---

# Phase 3 Plan 02: 테이블 밤 선택·탈락·관전 표시 Summary

**낮 화면 고정 테이블(DayTable)이 밤 대상 버튼(aria-pressed)·내 선택 링과 표적 배지·종류별 배지(동료·마피아·경찰·의사)·유령 그림 탈락 표시·관전용 실제 직업 아랫줄을 그리도록 넓혔고, 새 입력이 없으면 출력은 그대로다.**

## Performance

- **Duration:** 약 6분 (2026-10-25)
- **Tasks:** 3 (Task 1 트레이서 TDD, Task 2·3 TDD)
- **Files:** 소스 5개 + 테스트 1개 변경 (+486 −31)

## Accomplishments

- `onPick` 이 있는 자리만 `<button type="button" aria-pressed>` 이다. 접근성 이름은 `{닉네임}{ (나)}, {pickVerb} 대상`(기본 동사 '선택')이고 `pickDisabled` 면 모든 버튼이 `disabled` 다. 없는 자리는 지금의 `div role=group` 노드라 포커스 순서에도 없다. 안쪽 자식은 같은 JSX 조각이라 두 경우의 모양이 같다.
- 내 선택(`pick.mine`)에 발밑 링 `.mf-dt__sel`(124%×20%·3px gray-50·빛 12px)과 26px 표적 배지(`--me`)가 뜬다. 포커스는 `:focus-visible` gray-100 2px 윤곽이다.
- 탈락(`dead`)은 `Figure ghost` 로 유령 그림(`ghostSrc()`, `/characters/ghost/ghost_default%402x.png`·`%404x.png 4x`)을 그린다. 필터·투명도는 없고 끊긴 사람에게만 `.mf-figure--disconnected` 가 더해진다. 이름표는 윗줄 gray-500, 아랫줄 '탈락'이다.
- 관전용 `{ kind: "real"; job }` 아랫줄은 점선·gray-300이고 마피아는 진홍 글자·테두리다. 자리 접근성 이름은 `{닉네임}, {실제 직업}{, 탈락}{, 연결 끊김}` 이다.
- 표적 배지는 `PickBadge` 한 부품이 종류(me·ally·police·doctor)로 그린다. 관전 배지는 `role=img` + '경찰 조사 대상'·'의사 보호 대상'·'마피아 지목 대상', 마피아 화면의 동료 선택은 장식(`aria-hidden`)이다.
- `allyMarkLabel`(기본 '동료')로 마름모 읽기 이름을 바꿀 수 있다(관전 화면은 '마피아').
- 전체: `npx vitest run` 56 파일·1094 통과(03-01 이후 기준선 1060 → 새 테스트 34개), `npm run typecheck`·`npm run build` 통과. 색은 daytable.css 코드 줄에 hex 가 0개다.

## Task Commits

| Task | 커밋 | 내용 |
|------|------|------|
| 1 RED | `b2d6b0b` test(03-02) | 밤 대상 버튼·내 선택 링·배지·아이콘·CSS 값 단언 |
| 1 GREEN | `16bc3b7` feat(03-02) | onPick 버튼, sel·pick--me, Icon target·notebook, pickVerb·pickDisabled |
| 2 RED | `4a411c0` test(03-02) | 유령 그림·탈락 이름표·real 아랫줄·allyMarkLabel |
| 2 GREEN | `98e6c65` feat(03-02) | ghostSrc·Figure ghost·dead/real 줄·seatLabel·CSS |
| 3 RED | `91ba36d` test(03-02) | 종류별 배지·DOM 순서·z-index (아래 편차 참고: 커밋 한 번 amend) |
| 3 GREEN | `565fb6c` feat(03-02) | PickBadge·pick.ally·spectatorPicks·--ally/--police/--doctor |

`commits: 6` 은 `git rev-list --count ${plan_head_before}..HEAD` 로 측정한 값이다.

## TDD Gate Compliance

| Task | RED | GREEN | 증거 |
|------|-----|-------|------|
| 1 | `b2d6b0b` | `16bc3b7` | `gsd-tools check tdd-red-evidence` → `RED_EVIDENCE_OK`(tap-flat, 대상 "pick.mine 인 자리: aria-pressed='true'…", 54건 중 11건 실패) |
| 2 | `4a411c0` | `98e6c65` | `RED_EVIDENCE_OK`(대상 "allyMarkLabel '마피아' 를 넘기면…", 실패 `expected '동료' to be '마피아'`) |
| 3 | `91ba36d` | `565fb6c` | `RED_EVIDENCE_OK`(대상 "한 자리에 pick.mine·spectatorPicks 셋이 모두 있으면 배지 넷이 DOM 순서…", 75건 중 8건 실패) |

semanticAssessment (Task 1): 대상이 실제로 실행되어 `expected null to be 'true'`(aria-pressed 없음)에서 실패했다. 같은 RED 에서 버튼 수·접근성 이름('button' 역할을 못 찾음)·pickDisabled·Icon·CSS 규칙 단언도 실패했다. 문법·로드 오류가 아니다. 'onPick 없는 테이블 출력 불변' 테스트는 계약을 고정하는 테스트라 RED 에서 통과한다(정상).

semanticAssessment (Task 2): 대상은 마름모 라벨 단언에서 깔끔하게 실패했다. 나머지 dead·real 테스트 일부는 구현 전 `row.kind` 를 못 읽어 TypeError(`reading 'name'`)로, 일부는 클래스·CSS 단언으로 실패했다. 계획된 기능이 없어서 나는 실패이고 로드·문법 오류가 아니다.

semanticAssessment (Task 3): 대상이 `expected 'me' vs 'police>doctor>ally>me'` 단언에서 실패했다(관전 배지 미구현이라 내 배지만 있음). '진홍 없음' 가드 테스트는 RED 에서도 통과한다(유지용, 정상). 모든 GREEN 앞에 RED 커밋이 있다.

트레이서 게이트: auto 모드가 아니고 `human_verify_mode` 가 end-of-phase 이며 Task 1 의 `<verify>` 가 자동 검사뿐이라 `npx vitest run test/client/dayTable.test.tsx test/client/dayScene.test.tsx`(75건 통과)·`npm run typecheck` 로 통과를 확인하고 확장 태스크로 넘어갔다 — Tracer verified end-to-end.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Task 3 RED 테스트의 배열 diff 가 TAP 보고서를 깨뜨림**
- **Found during:** Task 3 RED 증거 검사
- **Issue:** DOM 순서 테스트가 `expect(order).toEqual([...])` 라 실패 때 여러 줄 diff 가 나와 tap-flat 보고서가 "Non-TAP data" 로 `INVALID_RED` 였다. (처음에는 이 결과를 확인하기 전에 RED 를 커밋했다.)
- **Fix:** 한 줄 문자열 비교(`order.join(">")` 가 `"police>doctor>ally>me"`)로 고치고 RED 증거를 다시 구해 `RED_EVIDENCE_OK` 를 확인한 뒤 아직 push 하지 않은 RED 커밋을 amend 했다(`9d9ce1e` → `91ba36d`). GREEN 은 그 뒤에 만들었다.
- **Files modified:** test/client/dayTable.test.tsx
- **Commit:** `91ba36d`

그 밖의 세부 선택(편차 아님): 관전 마피아와 `pick.ally` 가 함께 오면 --ally 배지는 하나만 그리고 role=img(관전) 쪽을 쓴다. `seatLabel` 의 탈락 분기는 `s.dead` 를 기준으로 한다(아랫줄이 dead 인데 `dead` 를 안 준 입력은 장면 실수라 처리하지 않는다).

## Issues Encountered

- macOS `sed -i` 는 빈 확장자 인자가 필요해 첫 시도가 실패했다(fireEvent import 누락으로 일부 RED 가 잘못된 이유로 실패). import 를 고친 뒤 RED 를 다시 돌려 확인했다.

## Known Stubs

없음. 이 계획의 새 입력(`onPick`·`dead`·`pick`·`spectatorPicks`·`real`)은 아직 장면이 넘기지 않는다 — 03-08(밤 장면)·03-10(아침·관전)이 값을 꽂는다. 의도된 상태이며 부품은 입력이 없으면 이전 출력과 같다. Icon `notebook` 은 03-11(경찰 조사 결과)이 처음 쓴다.

## Threat Flags

없음. 새 네트워크 입구·인증 경로·신뢰 경계 변화가 없다. 계획의 T-03-04(역할 키 없는 입력 타입, real·배지는 장면이 넘길 때만 그림)·T-03-05(닉네임은 React 텍스트·속성으로만, dangerouslySetInnerHTML 없음, 기존 '<img src=x>' 테스트 유지)·T-03-SC(새 패키지 없음)는 모두 지켜졌다.

## Self-Check: PASSED

- 수정 파일 6개 존재, 커밋 6개(`b2d6b0b`, `16bc3b7`, `4a411c0`, `98e6c65`, `91ba36d`, `565fb6c`)가 HEAD 의 조상임을 확인
- 인수 기준: `aria-pressed` 1·`target|notebook` 2 이상·`.mf-dt__sel` 1 이상·hex 0·`kind: "dead"|"real"` 2·`export function ghostSrc` 1·`ghostSrc(` 사용 1·ghost 규칙에 grayscale/opacity 0·`--ally|police|doctor` 3·`spectatorPicks` 4·문구 표 3 모두 통과
- 불변: `git diff --quiet b8e2263 -- src/game/dayTable.ts src/components/Table.tsx` exit 0
- 각 태스크의 `test(03-02)` 커밋이 해당 `feat(03-02)` 커밋보다 앞
- 전체 검증: `npx vitest run` 1094 통과, `npm run typecheck`, `npm run build` 통과

## Next Phase Readiness

03-08(밤 장면)이 `onPick`·`pickVerb`·`pickDisabled`·`pick.mine/ally`·`allyMarkLabel` 을, 03-10(관전)이 `dead`·`row real`·`spectatorPicks` 를 값으로 넘기면 된다. 유령 그림 미리 받기 목록(`ghostSrc`)은 03-08 이 고친다. 360폰 겹침(C7)은 03-12 배포본에서 확인한다.
