---
phase: 07-free-chat
plan: "27"
subsystem: deploy
tags: [deploy, e2e, deployed-verification, handoff, gap-closure]
gap_closure: true
gap_ids: [G-07-9]

requires:
  - phase: 07-free-chat
    provides: "07-23 낮 시작 문구, 07-24~25 예측 이동·구간 섞기(결정 0059), 07-26 E2E W11·W12"
provides:
  - "minifia-v2 배포본 22ca18d (Version ID c5be229d-37a4-49bf-a754-e456230ff9c9)"
  - "배포본 smoke 와 E2E(흐름 나눠 실행) 통과 기록: W11·W12 6개 크기, N8 16행"
  - "HANDOFF.md 갭 수정 마감 인계, v2 push"
affects: [verify-work 7, 08-ui-phase]

plan_head_before: 22ca18d975284c435f15ebc24098bde0026e7c12
plan_head_after: d75c06eb5f2a365542b70a32c8681646e81e5b72

actuals:
  tokens: 900
  tasks: 2
  commits: 1

tech-stack:
  added: []
  patterns:
    - "배포본 전체 E2E 가 900초 제한을 넘기면 제한·문턱값을 건드리지 않고 못 끝낸 흐름을 --only 로 따로 돌려 가른다"

key-files:
  created: []
  modified:
    - HANDOFF.md

key-decisions:
  - "배포본 전체 E2E 한 번이 900초 제한을 넘겨 중단됐다. 제한·판정은 바꾸지 않고 못 끝낸 reconnect 와 setup goto 시간 초과로 실패한 result-m·lobby 를 --only 로 단독 재실행해 통과를 확인했다"

requirements-completed: [MAP-02, CHAT-06]

coverage:
  - id: D1
    description: "이 커밋(22ca18d)이 가드 체인으로 minifia-v2 에만 배포되고 health 와 smoke --prod 가 통과한다"
    requirement: MAP-02
    verification:
      - kind: command
        ref: "npm run deploy; curl /api/health = 2026-11-02T05:46:59Z+22ca18d; node scripts/smoke.mjs --prod = SMOKE OK"
        status: pass
    human_judgment: false
  - id: D2
    description: "실제 왕복 지연(약 155ms)의 배포본에서 탭 뒤 3프레임 안 화면 출발(W11)과 한 프레임 튐 없음(W12)이 6개 크기 모두 통과하고, 낮 시작 제목 한 줄(N8)이 16행 통과한다"
    requirement: MAP-02
    verification:
      - kind: e2e
        ref: "node scripts/e2e/run.mjs --url https://minifia-v2.dhplay.workers.dev (scripts/e2e/out/deployed-07-27.log: world/walk W11·W12 통과 12행, N8 통과 16행)"
        status: pass
    human_judgment: false
  - id: D3
    description: "배포본 전체 E2E 가 FAIL 행 없이 'E2E OK' 로 한 번에 끝난다"
    requirement: MAP-02
    verification:
      - kind: e2e
        ref: "전체 실행은 900초 제한 초과로 중단(exit 2, 실패 행 2건은 page.goto 8초 시간 초과). 해당 흐름 단독 재실행 reconnect·result-m·lobby 는 모두 E2E OK"
        status: unknown
    human_judgment: true
    rationale: "한 번의 전체 실행이 'E2E OK' 로 끝나지 않았다. 실행 시간이 제한을 넘긴 것이고 코드 실패는 아니라고 판단하지만 판정은 검증 단계가 한다"
  - id: D4
    description: "HANDOFF.md 가 갭 수정 결과로 갱신되고 6KB 이하이며 v2 가 개인 원격에 push 된다"
    requirement: CHAT-06
    verification:
      - kind: unit
        ref: "test/unit/handoff.test.ts (2 통과), HANDOFF.md 5476바이트"
        status: pass
    human_judgment: false

duration: 28min
completed: 2026-11-02
status: complete
---

# Phase 07 Plan 27: 갭 수정 배포와 배포본 확인 Summary

**결정 0059(내 캐릭터 예측 이동 + 구간 섞기)와 낮 시작 문구 수정을 가드 체인으로 minifia-v2 에 배포하고, 실제 왕복 지연의 배포본에서 W11·W12(6개 크기)·N8 이 통과함을 확인한 뒤 HANDOFF 를 갱신해 v2 를 push 했다. 배포본 전체 E2E 는 한 번에 900초 제한을 넘겨 못 끝낸 흐름을 단독 재실행으로 마무리했다.**

## Performance

- **Duration:** 약 28분 (2026-11-02T05:45:51Z ~ 06:14Z)
- **Tasks:** 2
- **Files modified:** 1 (HANDOFF.md)

## 배포 기록

- 사전 확인: `node scripts/check-account.mjs` = 개인 Cloudflare 계정(`dhkim1522@naver.com`).
- 로컬 게이트: `npx vitest run` 143 파일 3897 통과·1 skipped(조건부가 아닌 `.skip(`·`.todo(` 는 `git grep` 으로 없음 확인, 건너뜀 1건은 소스에 수정자가 없는 기존 항목), `npm run typecheck` 통과, `node --test scripts/e2e/lib.test.mjs scripts/*.test.mjs` 288 통과, 빌드 메인 청크 `three-in-main 0`.
- `git status --short`: 커밋 안 된 코드 변경 없음(제외 목록 파일만).
- `npm run deploy`: Worker `minifia-v2`, **Version ID `c5be229d-37a4-49bf-a754-e456230ff9c9`**, 주소 `https://minifia-v2.dhplay.workers.dev`. v1.0 주소에는 어떤 요청도 보내지 않았다.
- health: `{"ok":true,"version":"2026-11-02T05:46:59Z+22ca18d"}` (이 커밋 짧은 해시 22ca18d, 배포 전 기준선은 4147d32).
- `node scripts/smoke.mjs --prod`: `SMOKE OK create code=5032 version=2026-11-02T05:46:59Z+22ca18d`.

## 배포본 E2E 결과

전체 실행: `node scripts/e2e/run.mjs --url https://minifia-v2.dhplay.workers.dev` → `scripts/e2e/out/deployed-07-27.log`.

- 전체 실행은 **`중단: 전체 900초 제한 초과`**(걸린 시간 1089초)로 끝났고 exit 2 였다. 마지막 줄이 `E2E OK` 가 아니다.
- 흐름별 완료 여부: reconnect 만 끝나지 못했다(나머지 19개 흐름은 모든 크기에서 `끝:`).
- 표의 실패 행 2건, 둘 다 `S4 단계 도달` 의 `(실행 오류) page.goto: Timeout 8000ms exceeded.` : `result-m/setup 390x664`, `lobby/setup 430x932`. 판정 실패가 아니라 setup 단계에서 배포본에 처음 접속할 때 8초 안에 로드되지 않은 것이다. 같은 크기의 나머지 행은 통과.
- 문턱값·판정·제한 시간은 바꾸지 않았다. 못 끝낸/실패한 흐름만 단독 재실행:
  - `--only reconnect`: `E2E OK` (걸린 시간 311초)
  - `--only result-m`: `E2E OK` (55초)
  - `--only lobby`: `E2E OK` (62초)
  - 로그: `scripts/e2e/out/deployed-07-27-reconnect.log`·`-result-m.log`·`-lobby.log`
- reconnect 단독이 311초라 배포본 지연에서는 전체를 한 번에 돌리면 900초 제한을 넘기는 것이 거의 확실하다(아래 후속).

### 이번 계획의 핵심 행

| 항목 | 결과 |
| --- | --- |
| W11 탭 → 내 캐릭터 화면 출발 3프레임 이내 | 360x640·390x664·430x932·360x560·390x844·402x874 6개 크기 모두 통과 (통과 행 12 = W11 6 + W12 6) |
| W12 걷는 동안 화면 위치가 한 프레임에 튀지 않음(≤ 5.4 단위/초) | 6개 크기 모두 통과 |
| N8 낮 시작 문구가 한 번 보임 | 16행 통과 (citizen4·police5·mafia8·doctor5 × 4개 크기) |
| W3 목적지 링 100ms / W4 구간 시작 500ms / W10 두 페이지 위치 차 ≤ 0.3 | 6개 크기 모두 통과 |

W9 참고 측정(판정 아님): 링 0.9~1.2ms, 손님 구간 도착 157~188ms(왕복 약 155ms 일치), 두 페이지 실시간 위치 차 최대 0.0036~0.2043 단위. 통과 행의 내용 칸은 W11 프레임 번호·ms, W12 최대 속도를 출력하지 않아 그 수치는 로그에 없다(판정은 통과/실패만 기록).

## Accomplishments

- 가드 체인 배포로 결정 0059 와 낮 시작 문구가 minifia-v2 에 올라갔고 health 에 이 커밋 해시가 찍혔다.
- G-07-9 의 진실(탭 즉시 출발·튐 없음)이 실제 왕복 지연의 배포본에서 자동으로 확인됐다.
- HANDOFF.md 를 갱신했다(0059·WR-03 처리·배포 해시, 낮 시작 문구 항목 삭제, 로비 이동 체감을 실기기 목록에 추가, 다음 할 일 `/gsd-verify-work 7`). 5476바이트, 세 구역 제목 유지.
- v2 를 개인 원격에 push(`23c1229..d75c06e`).

## Task Commits

1. **Task 1 (배포·배포본 확인):** 저장소 파일 변경 없음, 커밋 없음. 결과는 이 SUMMARY 에 기록.
2. **Task 2 (HANDOFF·push):** `d75c06e` docs(07-27): HANDOFF 갱신

## Deviations from Plan

### Auto-fixed Issues

없음(코드 수정 없음).

### 계획과 달랐던 점

**1. 배포본 전체 E2E 한 번이 'E2E OK' 로 끝나지 않았다**
- **Found during:** Task 1 action 5
- **Issue:** 전체 실행이 900초 제한을 넘겨 중단(reconnect 미완), 표에 setup `page.goto` 8초 시간 초과 2건.
- **Resolution:** 제한·문턱값·판정을 건드리지 않고 reconnect·result-m·lobby 를 `--only` 단독 재실행해 모두 `E2E OK`. 계획의 수락 기준 "마지막 줄이 E2E OK" 는 문자 그대로는 충족하지 못했다(대신 흐름별 단독 통과). W11·W12·N8 행은 전체 실행 로그에 있다. 이 변경은 07-23~26 과 무관한 배포본 지연·시간 예산 문제로 판단해 고치지 않았다.
- **Files modified:** 없음.

**2. 로컬 전체 시험에서 한 번 흔들림**
- 첫 `npx vitest run` 에서 `test/worker` 채팅 통합 시험 1건(`botSays(... "동의해요")` 이후 `settle` 단언, 파일은 chatLeak/chat/bots/leak/night 중 하나)이 실패했고 곧바로 재실행해서 143 파일 3897 통과로 재현되지 않았다. 코드 변경 없음, 오케스트레이터가 알려 준 병렬 부하 흔들림과 같은 양상.

## 후속 제안 (deferred-items.md 에 남길 내용)

- 배포본 전체 E2E 가 `OVERALL_LIMIT_MS = 900_000` 을 넘긴다(전체 1089초, reconnect 단독 311초). 배포본 전체를 한 번에 확인하려면 흐름 분할(또는 제한 재검토)이 필요하다 — 이 계획 범위 밖이라 건드리지 않았다.
- setup 단계 `page.goto` 8초 시간 초과가 배포본 병렬 부하에서 가끔 난다(result-m 390x664, lobby 430x932). 단독 재실행은 통과.
- `design/design-system/components/PhaseCards/README.md` 5행에 옛 낮 보조줄 문구가 남아 있다(디자인 시스템은 메인 세션에서만 고침) — HANDOFF 정리 후보에 적었다.

## Issues Encountered

위 '계획과 달랐던 점'.

## Authentication Gates

없음. 개인 Cloudflare 계정 확인 통과, push 는 기존 개인 SSH 설정 그대로.

## Known Stubs

없음.

## Threat Flags

없음. 새 네트워크 표면 없음. 배포는 가드 체인(check-account → check-deploy-target → deploy.mjs)을 그대로 거쳤고 v1.0 주소에는 요청하지 않았다(T-07-65). 커밋은 HANDOFF.md 한 파일만이며 제외 목록(`design/backgrounds/indoor-draft/`·`Claude outputs/`·`.planning/milestone.lock`·`.planning/state.json`)은 커밋하지 않았다(T-07-67). 패키지 설치 없음(T-07-SC).

## Next Phase Readiness

- `/clear` 후 `/gsd-verify-work 7` 에서 UAT 9 를 이 배포본 W11·W12 결과로 다시 판정한다. 로비 이동 체감은 모든 개발이 끝난 뒤 실기기 플레이테스트 목록에 남아 있다(사용자 결정 2026-11-02).
- 그다음 8페이즈 `/gsd-ui-phase 8`.

## Self-Check: PASSED

- 커밋 `d75c06e` 가 HEAD 조상, `HANDOFF.md`·`07-27-SUMMARY.md` 존재.
- `grep -c 0059 HANDOFF.md` = 2, 옛 문구 항목 없음, 마지막 HANDOFF 커밋 파일 목록은 `HANDOFF.md` 하나, `test/unit/handoff.test.ts` 통과.
- 배포본 로그: W11·W12 통과 12행, N8 통과 16행. 인수 기준 중 "로그 마지막 줄 E2E OK" 는 위 이탈 1에 따라 단독 재실행으로 대체.
