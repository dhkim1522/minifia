---
phase: 06-world-skeleton
plan: 22
subsystem: ui
tags: [nametag, z-order, overlay-ink-strong, e2e, gap-closure, tdd]

requires:
  - phase: 06-world-skeleton
    provides: "06-13 writeTags(이름표 층), 06-17 E2E NT3, 06-12 승인 토큰 overlay-ink-strong"
provides:
  - "rankTags(순수): 내 이름표 맨 위 + 발 y/seat 순위 + 맨 앞 겹침(front) 판정"
  - "이름표 래퍼 data-front=\"true\" (겹친 이름표 중 맨 앞 하나) → 면 overlay-ink-strong(92%), 겹치지 않으면 80% 유지"
  - "E2E NT3: 내 이름표 최상위 z · 맨 앞 겹침 면 알파 ≥ 0.9 · 안 겹치면 ≤ 0.85, 방장·손님 두 시점"
  - "06-UI-SPEC 이름표 규칙·E2 overflow 행·가시성 보장 문장, docs/screen-map.md data-front 계약"
affects: [06-23-reconnect-harness, 06-17-e2e, 06-18-deploy-e2e]

actuals:
  tokens: 8750
  tasks: 3
  commits: 5
plan_head_before: 952ed851524bb7f07d29722ae9f939e8edf250c3
plan_head_after: 141ad011d00ca2564aed314a162b66b2f24b748a

tech-stack:
  added: []
  patterns:
    - "순위·겹침 판정을 three/DOM 없는 순수 함수(rankTags)로 뽑아 단위 테스트로 고정하고, 런타임은 투영 좌표와 캐시 폭만 넘긴다"
    - "이름표 폭은 처음 필요할 때 한 번 재고 syncPlayers 에서만 무효화한다(프레임당 DOM 읽기 0)"

key-files:
  created:
    - src/world/tagOrder.ts
    - test/unit/tagOrder.test.ts
  modified:
    - src/world/runtime.ts
    - src/styles/world.css
    - test/client/worldStage.test.tsx
    - test/client/v2parts.test.tsx
    - scripts/e2e/lib.mjs
    - scripts/e2e/lib.test.mjs
    - scripts/e2e/browser.mjs
    - scripts/e2e/flows.mjs
    - .planning/phases/06-world-skeleton/06-UI-SPEC.md
    - docs/screen-map.md

key-decisions:
  - "G-06-4 사용자 결정(2026-11-01) 그대로: 내 이름표 맨 위 + 겹친 맨 앞 하나만 불투명(overlay-ink-strong). 가장자리 당기기·[테스트] 이동·PAN_BOX/카메라는 하지 않았다"
  - "새 CSS 토큰 없음 — 승인 토큰 overlay-ink-strong 사용, v2.css 의 .mv-tag 면(overlay-ink)은 그대로"
  - "UI-SPEC E2 overflow 행을 backstop 에서 resolved 로 바꾸고 근거를 tagOrder 단위 테스트 + NT3 로 적었다"

requirements-completed: [MAP-07, MAP-01]

coverage:
  - id: D1
    description: "내 이름표는 항상 맨 위(발이 뒤여도·seat 이 작아도), 나머지는 발 y 가 큰 쪽이 위"
    requirement: MAP-07
    verification:
      - kind: unit
        ref: "test/unit/tagOrder.test.ts#rankTags 순위 (G-06-4)"
        status: pass
      - kind: integration
        ref: "test/client/worldStage.test.tsx#내 이름표는 내 발이 뒤여도 발 sy 가 더 큰 다른 이름표보다 위다(G-06-4)"
        status: pass
    human_judgment: false
  - id: D2
    description: "겹친 이름표 중 맨 앞 하나만 data-front 와 overlay-ink-strong 면, 겹치지 않으면 80% 유지"
    requirement: MAP-07
    verification:
      - kind: unit
        ref: "test/unit/tagOrder.test.ts#rankTags 맨 앞 겹침 (G-06-4)"
        status: pass
      - kind: integration
        ref: "test/client/worldStage.test.tsx#이름표 맨 앞 겹침 data-front (G-06-4)"
        status: pass
      - kind: integration
        ref: "test/client/v2parts.test.tsx#겹친 이름표 중 맨 앞(data-front)만 면이 overlay-ink-strong"
        status: pass
    human_judgment: false
  - id: D3
    description: "E2E NT3 가 내 이름표 최상위 z·맨 앞 면 알파·안 겹치면 80% 를 판정, 로컬 world·lobby E2E 통과"
    requirement: MAP-01
    verification:
      - kind: unit
        ref: "scripts/e2e/lib.test.mjs#tagStackChecks NT3"
        status: pass
      - kind: e2e
        ref: "npm run e2e -- --url http://localhost:5173 --only world --sizes 360x640,390x664 (21/21 x2) · --only lobby --sizes 360x640 (34/34)"
        status: pass
    human_judgment: false

duration: 6min
completed: 2026-11-01
status: complete
---

# Phase 6 Plan 22: 이름표 맨 위·맨 앞 불투명 (G-06-4) Summary

**한 점에 8명이 모여도 '(나)' 이름표가 맨 위에서 가려지지 않고, 겹친 이름표 중 맨 앞 하나만 overlay-ink-strong(92%)으로 짙어지며 나머지는 승인값 80% 그대로다 — 순수 함수 rankTags + data-front + NT3 확장으로 고정.**

## Performance

- **Duration:** 약 6분
- **Tasks:** 3 (Task 1 트레이서 RED/GREEN, Task 2 RED/GREEN, Task 3 문서)
- **Files modified:** 12 (생성 2)

## Accomplishments

- `src/world/tagOrder.ts` `rankTags`: 내 이름표 맨 위, 나머지는 발끝 y 큰 쪽(동점이면 seat 큰 쪽)이 위, 사각형이 면적을 가지고 겹친 쌍 중 겹친 모두의 위에 있는 하나만 `front`. 변만 맞닿으면 겹침 아님.
- `writeTags`: 폭(`offsetWidth`)을 처음 한 번만 재서 캐시(0 이면 `NAMETAG_MAX_W`), `syncPlayers` 에서만 무효화. z 와 `data-front` 는 바뀔 때만 DOM 에 쓴다. 이름표를 밀지 않는다.
- `world.css`: `.mf-world__tag[data-front="true"] .mv-tag { background: var(--overlay-ink-strong); }` 한 줄. `v2.css` 의 `.mv-tag` 면은 그대로.
- E2E: `cssAlpha`, `TAG_FRONT_ALPHA_MIN`(0.9), `TAG_BASE_ALPHA_MAX`(0.85), `tagStackChecks`(NT3) 확장, `readWorld` 가 `face` 반환, `world/stack` 에서 손님 시점도 판정.
- 06-UI-SPEC(이름표 규칙·E2 overflow·가시성 보장 문장·토큰 표)과 `docs/screen-map.md`(`data-front`)를 사용자 결정에 맞춤.

## Task Commits

1. Task 1 RED — `b3b64d7` test(06-22): 이름표 내 이름표 맨 위·맨 앞 겹침 data-front 기대
2. Task 1 GREEN — `4941dde` feat(06-22): 내 이름표 맨 위·겹친 이름표 중 맨 앞만 overlay-ink-strong
3. Task 2 RED — `0de6d0a` test(06-22): NT3 판정 기대
4. Task 2 GREEN — `24772d1` feat(06-22): E2E NT3 확장
5. Task 3 — `141ad01` docs(06-22): UI-SPEC·화면 지도 개정

## Deviations from Plan

None - plan executed exactly as written.

(참고: 판정 흔들림이 관찰되지 않아 경계 여유는 넣지 않았다. 기준 0.9/0.85 는 낮추지 않았다.)

## Verification

- `npx vitest run`: 138 파일 3730 통과, 1 건너뜀(`camera.test.ts` 의 기존 `describe.runIf(CAMERA_PRINT)` 출력용 — 이 계획과 무관, `.skip`/`.todo` 없음)
- `npm run typecheck` 통과, `node --test scripts/e2e/lib.test.mjs scripts/*.test.mjs` 271 통과
- 로컬 E2E(`http://localhost:5173`): world 360x640·390x664 각 21/21, lobby 360x640 34/34, NT3 통과(8명 로비·방장·손님). 개발 서버는 끝낸 뒤 껐다. 배포 주소로는 돌리지 않았고 배포하지 않았다.
- `npm run build` 통과, 메인 청크(index-*.js)에 WebGLRenderer 없음
- `git diff 179880c -- src/world/camera.ts src/styles/lobby.css` 변경 없음

## Known Stubs

None.

## Threat Flags

None (새 네트워크·인증·파일 경로 없음; `data-front` 는 런타임이 계산한 불리언 문자열만 쓴다).

## Self-Check: PASSED

- 생성 파일 `src/world/tagOrder.ts`, `test/unit/tagOrder.test.ts` 존재
- 커밋 b3b64d7, 4941dde, 0de6d0a, 24772d1, 141ad01 모두 HEAD 의 조상
- acceptance_criteria 전부 통과 (Task 3: 옛 문장 0건, 새 문장 3건, `data-front` 지도 반영, 카메라·lobby.css 무변경)
