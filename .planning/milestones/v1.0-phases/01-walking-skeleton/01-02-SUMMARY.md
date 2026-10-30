---
phase: 01-walking-skeleton
plan: 02
subsystem: infra
tags: [cloudflare-workers, durable-objects, websocket-hibernation, zod, react, vite, wrangler]
commits: 4
plan_head_before: 66d3440784e69fbfa4bcf2290c15d525d0dc4d1d
plan_head_after: ccffa4422d68bd4b9a55ae0e93b776b0bfda1c4b

requires:
  - phase: 01-walking-skeleton
    provides: "01-01 골격 (Vite+React, Worker, 빈 Room DO, wrangler.jsonc, 테스트 도구)"
provides:
  - "1페이즈 전체 와이어 계약 shared/protocol.ts (상수·타입만, zod 없음)와 서버 전용 shared/schemas.ts"
  - "순수 방 상태·허용 목록 뷰 (shared/game/room.ts, view.ts)와 방 코드 생성 (shared/roomCode.ts)"
  - "POST /api/rooms, GET /api/rooms/{code}/ws, Room DO (Hibernation WebSocket, hello 토큰 신원, 만료 알람)"
  - "클라이언트 useRoomConnection 훅, Home·RoomScreen·Lobby 화면"
  - "https://minifia.dhplay.workers.dev 실제 배포와 scripts/smoke.mjs (create 단계, --prod, --print-version)"
affects: [01-04, 01-05, 01-06, 01-07, 01-08, 01-09, 01-10]

actuals:
  tokens: 16093
  tasks: 3
  commits: 4

tech-stack:
  added: []
  patterns:
    - "interface-first: 프로토콜 계약을 1페이즈 전체 분량으로 먼저 고정"
    - "공개 뷰는 객체 리터럴 허용 목록 (Player 를 펼쳐 복사하지 않음)"
    - "토큰은 WebSocket hello 본문으로만 전달 (URL·쿼리·로그에 없음)"
    - "순수 함수(shared/game)와 DO 입출력(worker/room.ts) 분리, 변경마다 storage.put 후 방송"

key-files:
  created:
    - shared/protocol.ts
    - shared/schemas.ts
    - shared/roomCode.ts
    - shared/game/room.ts
    - shared/game/view.ts
    - worker/random.ts
    - worker/allocate.ts
    - src/net/api.ts
    - src/net/useRoomConnection.ts
    - src/screens/Home.tsx
    - src/screens/RoomScreen.tsx
    - src/screens/Lobby.tsx
    - src/styles/screens.css
    - scripts/smoke.mjs
    - scripts/prod-url.txt
    - test/worker/http.test.ts
    - test/worker/allocate.test.ts
    - test/worker/random.test.ts
    - test/unit/roomCode.test.ts
    - test/unit/gameRoom.test.ts
    - test/unit/roomSocketUrl.test.ts
    - test/client/screens.test.tsx
    - test/client/useRoomConnection.test.tsx
  modified:
    - worker/index.ts
    - worker/room.ts
    - src/App.tsx
    - src/main.tsx
    - package.json

key-decisions:
  - "Worker 이름 minifia, 계정 workers.dev 서브도메인 dhplay 로 공개 주소를 https://minifia.dhplay.workers.dev 로 확정"
  - "방 코드 충돌은 DO createRoom 이 CODE_TAKEN 으로 거부하고 Worker 가 allocate 로직으로 최대 8번 재시도 (덮어쓰기 없음)"
  - "새 hello 는 같은 플레이어의 이전 소켓을 4001 replaced 로 닫는다 (낡은 소켓의 닫힘이 새 연결을 덮지 않게)"
  - "클라이언트 자동 재연결은 1초 간격 임시 구현, 연속 5회 끊김이면 중단 (01-05 가 백오프로 교체)"

patterns-established:
  - "워커 테스트는 테스트마다 다른 방 코드를 쓴다"
  - "스모크는 Node 내장 fetch·WebSocket 만 사용 (OS 무관, 셸 의존 없음)"

requirements-completed: [ROOM-01, DEPLOY-01]

coverage:
  - id: D1
    description: "[방 만들기] 트레이서: POST /api/rooms -> Room DO 저장 -> WebSocket hello -> 대기실 RoomView (코드, 방장 표시 닉네임)"
    requirement: ROOM-01
    verification:
      - kind: integration
        ref: "test/worker/http.test.ts"
        status: pass
      - kind: unit
        ref: "test/unit/roomCode.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "공개 뷰 허용 목록 네 키, 어떤 프레임에도 토큰 없음, 잘못된 토큰 4003, 없는 방 404, 1024바이트 초과·잘못된 JSON·스키마 불일치는 상태 불변"
    verification:
      - kind: integration
        ref: "test/worker/http.test.ts"
        status: pass
      - kind: unit
        ref: "test/unit/gameRoom.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "클라이언트 번들에 zod 없음 (서버 전용 스키마 분리)"
    verification:
      - kind: other
        ref: "npm run build && ! grep -l ZodError dist/client/assets/*.js"
        status: pass
    human_judgment: false
  - id: D4
    description: "개인 Cloudflare 계정의 workers.dev 에 정적 화면과 Worker·Room DO 가 함께 배포되고 배포 주소 스모크가 통과"
    requirement: DEPLOY-01
    verification:
      - kind: e2e
        ref: "node scripts/smoke.mjs --prod --stage create"
        status: pass
    human_judgment: false
  - id: D5
    description: "실기기(iPhone Safari, Android Chrome)에서 배포 주소의 첫 화면과 방 만들기 -> 대기실 전환"
    verification: []
    human_judgment: true
    rationale: "실기기 브라우저·모바일 네트워크의 렌더링과 WebSocket 연결은 자동 스모크로 대신할 수 없다 (Task 3 human-check, 대기 중)"

duration: 52min
completed: 2026-10-22
status: complete
---

# Phase 1 Plan 02: 방 만들기 트레이서와 첫 실제 배포 Summary

**[방 만들기] 버튼부터 Worker, Room Durable Object(저장), 토큰, WebSocket hello, 플레이어별 허용 목록 RoomView, 대기실 화면까지 한 줄로 잇고, 개인 Cloudflare 계정의 https://minifia.dhplay.workers.dev 에 실제 배포해 배포본 스모크로 확인했다**

## Performance

- **Duration:** 약 52분 (벽시계 기준. Cloudflare 로그인·이메일 인증·서브도메인 변경 같은 사람 작업 대기 시간 포함)
- **Started:** 2026-10-22T01:18:53Z
- **Completed:** 2026-10-22T02:10:26Z
- **Tasks:** 3 (Task 1 tracer TDD, Task 2 checkpoint:human-action, Task 3 auto)
- **Files modified:** 28 (이 계획의 커밋 기준)

## Accomplishments

- 트레이서 한 경로가 로컬 workerd 통합 테스트로 증명되었다: 201 `{code, token, seat:0}`, hello 후 첫 프레임에 `players[0]` 키가 정확히 `connected, isHost, nickname, seat`, 프레임 원문에 토큰 없음, 잘못된 토큰은 4003 `invalid_token`, 없는 방은 404 `ROOM_NOT_FOUND`.
- 프로토콜 계약(`shared/protocol.ts`)을 1페이즈 전체 분량으로 고정해 이후 계획이 같은 이름으로 병렬 작업할 수 있다. 클라이언트 번들(`dist/client`)에 zod 가 들어가지 않는다 (`ZodError` 없음 확인).
- 실제 배포 완료: `npm run deploy` 한 번으로 정적 화면과 Worker·Room DO(SQLite) 가 같은 주소에 올라갔다. `node scripts/smoke.mjs --prod --stage create` 가 `SMOKE OK create code=3135 version=2026-10-22T02:09:51Z+9625cab` 를 출력했다.
- 전체 회귀 통과: 테스트 파일 16개 / 123개 테스트 통과, `npm run typecheck` 종료 코드 0, 빌드 통과.

## Task Commits

1. **Task 1: 트레이서 (TDD)**
   - RED: `c5ca8f4` (test) — 프로토콜·방 코드와 실패하는 http·roomCode 테스트
   - GREEN: `2d4c640` (feat) — 순수 상태·뷰, Worker 라우팅, Room DO, 클라이언트 훅·화면 3개
   - 트레이서 피드백 게이트: 자동 모드에서 `<verify>` 를 처음부터 끝까지 다시 실행해 통과, "Tracer verified end-to-end — expanding" 기록 후 확장
3. **Task 3: 첫 실제 배포와 배포 주소 스모크**
   - `9625cab` (feat) — `scripts/smoke.mjs` 와 `package.json` 의 `smoke` 스크립트
   - `ccffa44` (feat) — `scripts/prod-url.txt` 에 배포 주소 기록, 배포본 스모크 통과

**Plan metadata:** 이 SUMMARY 를 담는 `docs(01-02)` 커밋 (아래 최종 커밋 참고)

## Files Created/Modified

위 frontmatter `key-files` 참고. 계획의 `files_modified` 밖에서 추가로 만든 파일: `worker/allocate.ts`(방 코드 할당·재시도 로직 분리), `src/styles/screens.css`, `test/worker/allocate.test.ts`, `test/worker/random.test.ts`, `test/unit/gameRoom.test.ts`, `test/unit/roomSocketUrl.test.ts`, `test/client/screens.test.tsx`, `test/client/useRoomConnection.test.tsx`. 추가로 `src/main.tsx` 도 스타일 import 때문에 수정했다.

## Decisions Made

- 공개 주소는 Worker 이름 `minifia` + 계정 서브도메인 `dhplay` 로 `https://minifia.dhplay.workers.dev` 이다. wrangler 가 첫 배포 시도에서 서브도메인을 `minifia` 로 자동 등록했는데, 사용자가 대시보드에서 `dhplay` 로 바꿨다.
- 방 코드 충돌 처리는 DO 가 살아 있는 방이면 `CODE_TAKEN` 으로 거부하고 Worker 가 최대 8번 다시 시도하며, 모두 실패하면 503 `CODE_EXHAUSTED`. 재시도 로직은 테스트하기 쉽게 `worker/allocate.ts` 로 분리했다.
- 클라이언트 재연결은 01-05 가 교체할 임시 구현이다 (아래 편차 참고).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] createRoomState 가 닉네임의 제어 문자를 거부**
- **Found during:** Task 1
- **Issue:** 계획은 trim 후 코드 포인트 1~8자만 검사한다. 제어 문자가 들어간 닉네임이 방 상태·방송으로 나갈 수 있다.
- **Fix:** 제어 문자가 있으면 `NICKNAME_INVALID`. 01-04 가 `shared/nickname.ts` 의 `validateNickname` 으로 교체할 때까지의 임시 방어다 (시그니처는 그대로).
- **Files modified:** `shared/game/room.ts`, `test/unit/gameRoom.test.ts`
- **Verification:** `test/unit/gameRoom.test.ts` 통과
- **Committed in:** `2d4c640`

**2. [Rule 2 - Missing Critical] 새 hello 가 같은 플레이어의 이전 소켓을 4001 replaced 로 닫음**
- **Found during:** Task 1
- **Issue:** 같은 토큰으로 두 번째 소켓이 hello 하면 이전 소켓이 살아 있어, 나중에 닫히는 이전 소켓이 새 연결 상태를 덮을 수 있다 (RESEARCH Pitfall 3).
- **Fix:** hello 시 같은 playerId 의 기존 소켓을 `CLOSE_CODES.REPLACED`(4001) 로 닫고, `detachConnection` 은 connId 가 일치할 때만 연결을 뗀다.
- **Files modified:** `worker/room.ts`, `shared/game/room.ts`
- **Verification:** 통합 테스트·`test/unit/gameRoom.test.ts` 통과
- **Committed in:** `2d4c640`

**3. [Rule 2 - Missing Critical] DO 생성자가 깨어날 때 live 소켓 기준으로 connected 를 다시 계산**
- **Found during:** Task 1
- **Issue:** Hibernation 에서 DO 가 깨어나면 저장된 `connected` 값이 실제 열린 소켓과 어긋날 수 있다.
- **Fix:** 생성자의 `blockConcurrencyWhile` 안에서 `ctx.getWebSockets()` 첨부를 보고 `connected`·`connId` 를 다시 맞춘다.
- **Files modified:** `worker/room.ts`
- **Verification:** 통합 테스트 통과
- **Committed in:** `2d4c640`

**4. [Rule 2 - Missing Critical] 클라이언트 자동 재연결 상한**
- **Found during:** Task 1
- **Issue:** 계획은 "1초 뒤 한 번 새로 연결" 이지만 상태를 한 번도 받지 못한 채 계속 끊기면 무한 재시도 위험이 있다.
- **Fix:** 1초 간격으로 재연결하되 상태를 받지 못하고 연속 5번 끊기면 중단한다. 01-05 가 지수 백오프로 교체한다.
- **Files modified:** `src/net/useRoomConnection.ts`
- **Verification:** `test/client/useRoomConnection.test.tsx` 통과
- **Committed in:** `2d4c640`

---

**Total deviations:** 4 auto-fixed (4 Rule 2)
**Impact on plan:** 모두 정확성·보안 방어이며 계약(`shared/protocol.ts`)과 이후 계획의 시그니처는 바뀌지 않았다.

## Authentication Gates

- **Task 2 (Cloudflare 로그인):** 계획된 `checkpoint:human-action`. 개인 계정으로 로그인 완료.
- **Cloudflare 이메일 인증 (코드 10034):** 첫 배포 시도가 "email not verified" 로 실패했다. 사용자가 개인 계정 이메일을 인증했다. 계획에 없던 계정 수준 관문이며 정상 흐름으로 기록한다.

## Issues Encountered

- 첫 배포 시도 중 wrangler 가 계정 workers.dev 서브도메인을 `minifia` 로 자동 등록했다. 사용자가 대시보드에서 `dhplay` 로 바꿨고, 오케스트레이터가 읽기 전용 API 로 `dhplay` 를 확인했다. 재배포 후 출력 주소가 기대한 `https://minifia.dhplay.workers.dev` 와 정확히 같아서 `prod-url.txt` 는 그대로 썼다.
- 새 workers.dev 경로의 전파 지연은 없었다 (스모크가 첫 시도에 통과).

## Known Stubs

없음. 계획이 의도한 자리(01-04, 01-05, 01-06, 01-08, 01-09 가 채울 `start`·`leave`·`kick` 의 `BAD_MESSAGE` 응답, 단계별 빈 화면 컨테이너, `phaseDurationMs: null`)는 계획에 명시된 후속 계획 몫이다.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: public_preview_urls | wrangler.jsonc | `workers_dev` 와 `preview_urls` 가 설정에 없어 wrangler 가 둘 다 기본 활성화했다. 버전별 미리보기 URL 이 공개 표면으로 늘어난다. 필요하면 `preview_urls = false` 로 명시 (01-10 재배포 때 판단 권장) |

## Pending Human Verification

- **Task 3 human-check (대기 중):** 실기기(iPhone Safari, Android Chrome 각 1대)에서 `https://minifia.dhplay.workers.dev` 를 열어 닉네임을 넣고 [방 만들기] 를 누른다. 기대: 밤 남색 화면에 `minifia` 제목과 아래쪽 버전 (`v2026-…`) 이 보이고, 방을 만들면 4자리 코드와 방장 표시가 붙은 내 닉네임이 있는 대기실로 바뀐다. 자동 스모크가 대신할 수 없어 `/gsd-verify-work` 단계로 넘긴다.

## User Setup Required

외부 서비스 설정은 모두 이 계획 중에 끝났다 (Cloudflare 로그인, 이메일 인증, workers.dev 서브도메인 `dhplay`). 집 Windows PC 에서 배포하려면 그 PC 에서도 `npx wrangler login` 을 한 번 해야 한다 (01-10 이 HANDOFF.md 환경 메모에 적는다).

## Next Phase Readiness

- 01-04 (참가·닉네임 검증), 01-05 (재접속·백오프), 01-06 (2.5D 대기실), 01-07 이후가 같은 프로토콜 계약과 같은 경로를 쓸 수 있다.
- 배포 주소 `scripts/prod-url.txt` 가 기록되어 있어 이후 계획의 배포본 검증에 쓸 수 있다.
- 실기기 확인(위 Pending)만 남아 있고 다른 차단 요소는 없다.

## Self-Check: PASSED

- 파일 존재: `scripts/smoke.mjs`, `scripts/prod-url.txt`, `worker/room.ts`, `shared/protocol.ts`, `shared/game/view.ts` 확인
- 커밋 존재: `c5ca8f4`, `2d4c640`, `9625cab`, `ccffa44` 확인
- Task 3 인수 기준: `prod-url.txt` 형식, `smoke` 스크립트 항목, 셸 의존 없음, `--print-version` 이 `dev` 가 아닌 `2026-…` 로 시작 모두 PASS
- 계획 수준 검증: `npm run typecheck` 종료 0, `npm run build` 통과, `ZodError` 가 번들에 없음, `npx vitest run` 16 파일 / 123 테스트 통과, 배포본 `SMOKE OK create`

---
*Phase: 01-walking-skeleton*
*Completed: 2026-10-22*
