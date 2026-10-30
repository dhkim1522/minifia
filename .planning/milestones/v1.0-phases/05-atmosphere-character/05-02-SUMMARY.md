---
phase: 05-atmosphere-character
plan: 02
subsystem: client-wake-lock
tags: [conn, wake-lock, tracer, tdd, CONN-03]
status: complete

requires:
  - phase: 05-atmosphere-character
    provides: "05-UI-SPEC §12 Wake Lock 계약(훅 이름·active 조건·요청/재요청/해제/생략)"
provides:
  - "useWakeLock(active) 훅 — src/net/useWakeLock.ts. DOM 에 그리지 않고 요청·visibilitychange 재요청·해제·조용한 생략만 한다"
  - "RoomScreen 의 훅 호출 한 줄(view 가 있고 ended 가 아니며 replaced·failed·removed 가 아닐 때 active, 대기실 포함)"
  - "test/helpers/wakeLockFake.ts: 모의 sentinel·navigator.wakeLock·visibilityState 도우미 — 05-07 E2E 와 별개인 단위 시험용"
affects: [05-07, 05-08, 05-09]

actuals:
  tokens: 5200
  tasks: 2
  commits: 4
plan_head_before: b1fb0ab5d4f70e98ed28945c8e0d5a0f03b83422
plan_head_after: ff28fa7a1b93d5974aaabc6c92c8006d54d84826

tech-stack:
  added: []
  patterns:
    - "브라우저 기능 훅은 환경에 없으면 조용히 끝낸다(useReducedMotion 선례). 상태는 effect 한 번의 수명에 갇힌 지역 값이고 정리 함수가 푼다"
    - "재시도 루프 방지: 재요청 경로는 visibilitychange(visible) 하나, 거부·release 이벤트는 재시도를 일으키지 않는다"

key-files:
  created:
    - src/net/useWakeLock.ts
    - test/client/useWakeLock.test.tsx
    - test/helpers/wakeLockFake.ts
  modified:
    - src/screens/RoomScreen.tsx
    - test/client/roomScreen.test.tsx

key-decisions:
  - "대기실부터 화면 꺼짐 방지를 건다(P5-7 기본값, 확인 대기). active 조건 한 줄이라 바꾸기 쉽다. 결정 0038 기록은 05-08 의 몫이다."
  - "재요청은 visibilitychange 한 곳뿐이다. sentinel 의 release 이벤트는 참조를 비우는 표시로만 쓴다."

requirements-completed: []

duration: about 6min
completed: 2026-10-29
---

# Phase 5 Plan 02: 화면 꺼짐 방지(Wake Lock) Summary

**`useWakeLock(active)` 훅을 만들어 `RoomScreen` 에 한 줄로 연결했다. 방을 보여 주는 동안(대기실 포함) `navigator.wakeLock.request("screen")` 을 한 번 요청하고, 탭이 다시 보일 때만 재요청하며, 결과 화면·연결 포기·다른 창 대체·언마운트에서 풀고, 미지원·예외·거부에서는 화면도 콘솔도 조용하다.**

## 수행한 일

화면 마크업·문구·서버·와이어는 바꾸지 않았다(클라이언트 전용, D-13). 새 의존성 없음.

### Task 1 — 트레이서 (RED `65893b0` → GREEN `8557c43`)

- `RoomScreen` → `useWakeLock` → 모의 `navigator.wakeLock` 까지 가장 얇게 꿰었다. 훅 단독(active false → true 에 요청 1번, 같은 active 리렌더에 재요청 없음)과 연결(대기실 렌더에 `request("screen")` 1번, assigning → roleReveal → claim 전환에도 1번)을 RED 로 쓰고 실패 4건을 확인한 뒤 최소 훅으로 통과시켰다.
- `RoomScreen`: `useWakeLock(view !== null && view.phase !== "ended" && status !== "replaced" && status !== "failed" && status !== "removed")` 한 줄과 근거 주석(D-12, P5-7).
- 트레이서 게이트: 자동 모드가 아니고 `<verify>` 가 자동 명령뿐이라 관련 시험을 다시 돌려 통과(13건)를 확인하고 이어 갔다.

### Task 2 — 나머지 갈래 (RED `4ad6eeb` → GREEN `ff28fa7`)

- RED: 미지원, 동기 예외, 거부(재시도 없음), release 이벤트로는 재요청 없음 · hidden 은 요청 없음 · visible 복귀에서 정확히 한 번 더, 비활성 중 visible 무시, 비활성·언마운트 해제 1번과 리스너 제거, 늦은 도착 즉시 release, release 거부 삼킴을 시험으로 쓰고 11건 실패를 확인.
- GREEN: 훅에 진행 중 표시·sentinel·비활성 표시, `visibilitychange` 리스너, 정리 함수의 release(거부 삼킴)를 넣었다. RoomScreen 쪽 시험은 ended·failed·replaced 전환의 release 1번, reconnecting 동안 유지, 미지원에서도 대기실 정상 렌더·콘솔 0·화면 꺼짐 문구 없음, 언마운트 release 를 단언한다.

## 시험·검증 결과

| 검사 | 결과 |
|------|------|
| `npx vitest run --project client test/client/useWakeLock.test.tsx test/client/roomScreen.test.tsx test/client/app.test.tsx` | 44건 통과 |
| `npm test` (unit + client + worker) | 104 파일, 2890건 통과 |
| `npm run typecheck` | 종료 코드 0 |
| `node scripts/tsc-scoped.mjs tsconfig.app.json '^(src/net/useWakeLock|src/screens/RoomScreen|test/client/(useWakeLock|roomScreen))'` | OK |

인수 기준 grep: `useWakeLock(` 는 RoomScreen 1, `export function useWakeLock` 1, `visibilitychange` 3(주석 포함, 1 이상), 주석 제외 `console.` 0, 훅 시험 `it(` 13(7 이상). 기준 수치·E2E 한도는 건드리지 않았다.

## 계획과 달라진 점

### 자동 수정한 것

없음(버그·누락 수정 없음).

### 계획 문구와 다르게 한 것

1. **상태 보관 위치:** 계획은 sentinel·진행 중 여부를 `useRef` 에 두라고 했다. effect 안 지역 변수로 두었다. effect 한 번의 수명 안에서만 필요하고, active 가 꺼졌다 켜질 때 옛 진행 중 요청이 새 effect 의 상태를 오염시키지 않으며(늦은 도착은 자기 effect 의 `alive` 만 본다) 시험 갈래가 모두 같다. 동작 계약은 같다.
2. **시험 도우미 파일 추가:** `files_modified` 에 없는 `test/helpers/wakeLockFake.ts` 를 만들었다. 훅 시험과 RoomScreen 시험이 같은 모의(sentinel·`navigator.wakeLock`·`visibilityState`)를 쓰므로 중복을 피했다. 05-07 의 E2E 는 브라우저에서 따로 한다.

## 인증 게이트

없음.

## 알려진 스텁

없음.

## 위협 표면 점검

새 엔드포인트·인증 경로·파일 접근·스키마 변경 없음. 위협 T-05-03(재요청 루프)은 재요청 경로를 visibilitychange 하나로 제한하고 시험 ④-a·「거부가 반복돼도」 가 요청 수로 단언해 닫았다. T-05-04(오류 노출)는 예외·거부·release 거부를 삼키고 `console.` 호출이 코드에 없으며 시험이 error·warn 스파이 0 을 단언한다. T-05-05(잠금 유지)는 비활성·언마운트 해제와 늦은 도착 즉시 해제 시험으로 닫았다.

## 사람이 할 일 · 이어지는 계획

- 실제 기기(iOS Safari·저전력 모드·Android Chrome·탭 전환)에서 게임 중 화면이 저절로 꺼지지 않는지는 `backstop` 항목이라 05-09 의 HANDOFF 실기기 확인 목록으로 간다. 이 계획은 코드 쪽만 모의로 고정했다.
- 대기실 포함(P5-7)은 확인 대기 기본값이다. 결정 0038 에 `바뀔 수 있는 기본값` 으로 적는 일은 05-08 의 몫이다.
- 미지원 환경 E2E(`WL1`)와 요청 스파이(`WL2`)는 05-07 이 만든다. 요구사항 CONN-03 은 E2E 와 실기기 확인이 끝난 뒤 완료 표시한다(이 계획에서는 표시하지 않음).

## Self-Check: PASSED

- 만든 파일 `src/net/useWakeLock.ts`, `test/client/useWakeLock.test.tsx`, `test/helpers/wakeLockFake.ts`, 이 SUMMARY 존재 확인.
- 커밋 `65893b0`·`8557c43`·`4ad6eeb`·`ff28fa7` 이 HEAD 의 조상임을 확인.
- `commits: 4` 는 `git rev-list --count b1fb0ab..HEAD` 로 쟀다.
