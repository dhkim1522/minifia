---
phase: 02-day-discussion
plan: 11
subsystem: deploy-smoke
tags: [smoke, deploy, cloudflare, decisions, handoff, day-loop]

requires:
  - phase: 02-day-discussion
    provides: 02-05 DO 배선(claim·say·emoji·extend·skip 핸들러), 02-09 낮 토론 화면
provides:
  - 낮 한 바퀴를 배포본에서 끝까지 도는 full 스모크(5명·4명)
  - 새 버전 배포(Worker minifia, 주소 그대로)
  - 결정 0016(2페이즈 구조 결정 7가지)
  - ROADMAP Phase 2 성공 기준 3·6 정정
  - 2페이즈 인계(HANDOFF)와 디자인 아티팩트 동기화 목록
affects: [phase-3-night, phase-4-vote, verify-work-2]

actuals:
  tokens: 14000
  tasks: 2
  commits: 2
plan_head_before: 1ca2b414efd5e6324efb778a5bb0f060451f9f85
plan_head_after: 627020408cbdff99bde49155ba5292c1f4b7c7b0

tech-stack:
  added: []
  patterns:
    - "스모크 단계 순서 검사는 선형 목록이 아니라 허용 전이 표(PHASE_NEXT)로 한다 — 낮 루프처럼 끝이 없는 흐름도 같은 표로 검사한다"
    - "마감 전 누출 검사는 키 이름이 아니라 값 문자열의 경로로 한다 — 역할·주장 값이 허용 경로(view.me.role·view.me.claim·view.day.roles[]) 밖에 나오면 실패"

key-files:
  created:
    - docs/decisions/0016-day-loop-structure.md
  modified:
    - scripts/smoke.mjs
    - .planning/ROADMAP.md
    - HANDOFF.md

key-decisions:
  - "스모크 마지막 단계 단언은 '끝 단계 == dayAnnounce' 가 아니라 'discussion 바로 다음이 dayAnnounce 인 낮 루프를 거침' 으로 했다 — skip 뒤 소켓을 닫기까지 2초 안에 claim 이 올 수 있어 마지막 프레임에 기대지 않는다"
  - "full 스모크의 쿨다운·거부 단언은 서버 한도(2000ms)보다 충분히 짧은 간격으로 보낸 요청(RATE_LIMITED)과 2.1초 대기 뒤 요청(이모티콘)을 쓴다"

requirements-completed: [DAY-01, DAY-02, COMM-01, COMM-02, COMM-04]

coverage:
  - id: D1
    description: "배포 주소에서 4명·5명 방이 낮 시작 발표 → 직업 공개 → 공개 연출 → 토론 → 방장 넘기기 → 다음 낮(day.n 2)까지 돈다"
    requirement: "DAY-01"
    verification:
      - kind: command
        ref: "node scripts/smoke.mjs --prod --stage full --previous-version 2026-10-23T15:17:14Z+e92e932 → SMOKE OK full code=4907 players=5 spread=8ms reveal=26ms"
        status: pass
      - kind: command
        ref: "node scripts/smoke.mjs --prod --stage full --players 4 → SMOKE OK full code=7722 players=4 spread=1ms reveal=0ms"
        status: pass
    human_judgment: false
  - id: D2
    description: "직업 공개 마감 전 모든 프레임에서 역할·주장 문자열이 허용 경로에만 있고 claims 키가 없으며, 서로 다른 선택이 claimReveal 에서 한꺼번에 공개된다"
    requirement: "DAY-02"
    verification:
      - kind: command
        ref: "scripts/smoke.mjs 경로 기반 누출 검사 (full 스모크 두 번 통과)"
        status: pass
    human_judgment: false
  - id: D3
    description: "배포본에서 빠른 메시지가 모든 클라이언트 day.messages 에, 이모티콘이 emoji 프레임으로 가고, 방장 연장은 +30000·phaseDurationMs 120000, 거부(WRONG_PHASE·RATE_LIMITED·BAD_MESSAGE·NOT_HOST·ALREADY_EXTENDED)는 다른 클라이언트에 표식을 남기지 않는다"
    requirement: "COMM-01, COMM-02, COMM-04"
    verification:
      - kind: command
        ref: "scripts/smoke.mjs 낮 토론 구간 (full 스모크 두 번 통과)"
        status: pass
    human_judgment: false
  - id: D4
    description: "재배포 뒤 주소는 그대로이고 /api/health version 이 배포 전과 다르다"
    requirement: "DEPLOY-01"
    verification:
      - kind: command
        ref: "배포 전 2026-10-23T15:17:14Z+e92e932 → 배포 후 2026-10-23T18:47:24Z+1ca2b41, --previous-version 비교 통과"
        status: pass
    human_judgment: false
  - id: D5
    description: "폭 360px 폰·8명 방에서 알약·말풍선·주장 알약이 겹치거나 잘리지 않고 360×640 에서 스크롤이 없다(실기기 backstop 5건)"
    verification: []
    human_judgment: true
    rationale: "실기기 폭·높이·주소창·안전 영역에서의 겹침과 잘림은 자동 테스트로 확인할 수 없다. /gsd-verify-work 2 의 UAT 로 모은다(human_verify_mode end-of-phase)"

duration: 15min
completed: 2026-10-24
status: complete
---

# Phase 2 Plan 11: 배포본 낮 루프 스모크와 인계 Summary

**full 스모크를 낮 한 바퀴 전체(직업 공개·공개 연출·메시지·이모티콘·연장·넘기기·다음 낮)와 경로 기반 누출 검사로 넓혀 개인 Cloudflare 계정으로 재배포한 배포본에서 5명·4명 모두 통과시키고, 결정 0016·ROADMAP 정정·HANDOFF 를 개인 원격에 push 했다.**

## Performance

- **Duration:** 약 15분
- **Completed:** 2026-10-24
- **Tasks:** 2 (트레이서 1 + auto 1)
- **Files modified:** 4 (신규 1)

## Accomplishments

- `scripts/smoke.mjs`: 선형 `PHASE_ORDER` 를 허용 전이 표 `PHASE_NEXT` 로 바꿔 `discussion → dayAnnounce` 낮 루프를 허용했다. 종착 대기를 `dayAnnounce`(day.n 1)로 바꾸고 이어서 claim(서로 다른 두 직업) → claimReveal(두 선택과 나머지 none, 첫 낮이라 changed 없음) → discussion(메시지·이모티콘·연장·넘기기) → dayAnnounce(day.n 2)까지 실제 WebSocket 으로 돈다.
- 누출 검사(T-02-32): claimReveal 을 받기 전 모든 프레임에서 역할·주장 값 문자열이 `view.me.role`·`view.me.claim`·`view.day.roles[]` 밖에 없고 `claims` 키가 없으며, `me.claim` 은 본인 선택뿐이다. 기존 토큰·role 키·allies 단언은 그대로 유지했다.
- 거부 검사: claim 단계 say → WRONG_PHASE, 2초 안의 두 번째 say → RATE_LIMITED, `text` 키가 붙은 say → BAD_MESSAGE, 손님 extend·skip → NOT_HOST, 두 번째 extend → ALREADY_EXTENDED. 거부 뒤 `day.messages` 는 성공한 한 줄뿐이고 표식 문자열은 다른 클라이언트 프레임에 없다.
- 배포: 개인 계정 확인(`dhkim1522@naver.com`, Dhkim1522@naver.com's Account) 뒤 `npm run deploy` 로 Worker `minifia` 새 버전. 주소는 `https://minifia.dhplay.workers.dev` 그대로.
- 결정 0016(구조 결정 7가지), ROADMAP Phase 2 성공 기준 3 예시와 6 예외 정정, HANDOFF(현재 상태·실기기 확인 5항목·디자인 아티팩트 동기화 목록·다음 할 일) 갱신.

## 배포본 검증 결과

| 항목 | 결과 |
|------|------|
| 배포 전 버전 V | `2026-10-23T15:17:14Z+e92e932` |
| 배포 후 버전 | `2026-10-23T18:47:24Z+1ca2b41` (V 와 다름) |
| `--stage full --previous-version V`(5명) | `SMOKE OK full code=4907 players=5 spread=8ms reveal=26ms version=2026-10-23T18:47:24Z+1ca2b41` |
| `--stage full --players 4` | `SMOKE OK full code=7722 players=4 spread=1ms reveal=0ms version=2026-10-23T18:47:24Z+1ca2b41` |
| 배포 전 로컬 검증 | `npm run typecheck`, `npx vitest run`(54 파일 974건), `npm run build && npx wrangler deploy --dry-run` 통과 |
| push | `6270204`, push 직후 HEAD = origin/main |

배포 전 개발 서버(`vite dev`)에서 두 인원 모두 낮 루프 전 구간이 통과했고, 마지막 에셋 캐시 헤더(`max-age=86400`) 단언만 개발 서버(no-cache)라 실패했다 — 배포본에서는 통과한다(HANDOFF 에 적음).

## Task Commits

1. **Task 1: 트레이서 — 낮 한 바퀴 full 스모크와 재배포** — `3bd75d8` (feat). 재배포 자체는 코드 변경 없음(배포 버전은 직전 커밋 `1ca2b41` 기준).
2. **Task 2: 결정 0016·ROADMAP 정정·HANDOFF 와 push** — `6270204` (docs)

## Deviations from Plan

None - plan executed exactly as written.

(구현 선택: `<verify>` 의 `npm run build` 는 `wrangler deploy --dry-run` 과 함께 배포 직전에 돌렸다. 트레이서 게이트의 자동 검증은 개발 서버 사전 스모크와 배포본 스모크 두 번이 대신한다.)

## Authentication Gates


## Known Stubs

없음. 02-01 이 남겼던 DayScene 하단 패널 슬롯은 02-08·02-09 가 채웠다(WINDOWS #2 해소 대상).

## Threat Flags

없음 — 새 네트워크 경로·인증·파일 접근 없음. T-02-32(누출 검사)·T-02-33(whoami 확인)·T-02-34(개인 원격 push, force 없음, 전역 git 설정 변경 없음, HEAD = origin/main 확인)·T-02-SC(새 패키지 없음)의 완화를 이행했다.

## Next Phase Readiness

- `/gsd-verify-work 2` — HANDOFF 의 실기기 확인 5항목(+ 쿨다운 오탐 관찰)을 UAT 로 확인한다.
- `/gsd-secure-phase 2`, `/gsd-validate-phase 2`, 이어서 `/gsd-discuss-phase 3`. 3페이즈는 `discussion.next` 임시 루프를 밤으로 바꾸고 ON_ENTER 표에 행을 더하며 스모크의 `PHASE_NEXT` 표도 같이 고친다(결정 0016).
- 디자인 아티팩트 동기화(화면설계서 S-06·S-08, 화면 흐름 단계 시간, 디자인 시스템 부품)는 디자인 세션 몫이다.

## Self-Check: PASSED

- 파일 존재: `scripts/smoke.mjs`, `docs/decisions/0016-day-loop-structure.md`, `HANDOFF.md`, `.planning/ROADMAP.md`
- 커밋 `3bd75d8`·`6270204` 가 HEAD 의 조상이고 HEAD = origin/main(push 완료)
- acceptance_criteria 전부 통과(smoke grep 4건, 0016 grep, ROADMAP·HANDOFF grep, HEAD = origin/main)
