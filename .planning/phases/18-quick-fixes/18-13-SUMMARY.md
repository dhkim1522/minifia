---
phase: 18-quick-fixes
plan: "13"
subsystem: smoke-script
tags: [smoke, e2e-contract, tracer, tdd, gap-closure, g-18-3, sc-5]
status: complete

requires:
  - phase: 18-quick-fixes
    provides: "18-12 까지의 서버 view(18-01 players[].look 옷 id, 16 페이즈 morning.seen). 18-UAT G-18-3 진단(서버 결함 없음, smoke 낡은 단언 3개 + 망 지터를 재는 편차 문턱)"
provides:
  - "scripts/smoke.mjs 를 가져올 수 있다(직접 실행 가드, 가져오면 부작용 없음)"
  - "순수 판정 도우미 export: roleStringAllowed·morningProblems·serverSpread·linkReport + 사본 상수 OUTFIT_IDS·PLACE_IDS·MORNING_KEYS·LOOK_PATH (TRACE_PIECES·ALLOWED_PLAYER_KEYS·OPTIONAL_PLAYER_KEYS·collectRoleStringPaths 는 export 만 더함)"
  - "scripts/smoke.test.mjs(node --test 13건)와 e2eContract 의 smoke·서버 buildView 묶음 describe(2건)"
  - "SMOKE OK 줄 형식 serverSpread=…ms/…ms arrivalSpread=…ms/…ms"
affects: [18-14]

actuals:
  tokens: 5000
  tasks: 2
  commits: 4

plan_head_before: bf16bffc2bf638f1a13d438813f0aec8af2ac326
plan_head_after: 4ca3863526ac6b5633af95cf4cb3e62ad5346b98
commits: 4

tech-stack:
  added: []
  patterns:
    - "스크립트의 판정을 순수 함수로 떼어 export 하고, 흐름 안 단언과 시험이 같은 함수를 부른다(사본 판정 없음). 사본 상수는 e2eContract 가 shared 와 같은지 묶는다"
    - "직접 실행 가드: process.argv[1] 를 resolve 한 값이 fileURLToPath(import.meta.url) 와 같을 때만 main (perf-run.mjs 와 같은 방식)"

key-files:
  created:
    - scripts/smoke.test.mjs
  modified:
    - scripts/smoke.mjs
    - test/unit/e2eContract.test.ts

key-decisions:
  - "편차 판정은 서버 시각(각 클라이언트 첫 프레임의 view.serverNow 차) 기준, 문턱 500ms 그대로. 도착 편차는 info·SMOKE OK 줄에 숫자로만 남긴다(근거 아래)"
  - "재접속 복원 검사는 2일차 errand(40초) 안에서 한다. 첫 아침에 판이 끝나는 판(4명)은 아침에 한 번 한다. day.n >= dayNo 로 푸는 완화는 고르지 않았다"
  - "look 허용은 view.players[].look 경로에서 값이 OUTFIT_IDS 사본 안일 때만(citizen 은 여전히 실패)"

requirements-completed: [SC-5]

duration: 약 25분
completed: 2026-11-10
---

# Phase 18 Plan 13: smoke 낡은 단언 고치기 Summary

**smoke full 이 서버 결함 없이 실패하던 원인(옷 look 오탐·아침 seen 키·처형 대기의 탈락자 경쟁·도착 편차 문턱)을 smoke 쪽에서 고치고, 허용 키·경로를 서버 buildView 와 시험으로 묶었다. 로컬 4명·5명 판 모두 통과.**

## 결과 한눈에

- G-18-3 원인 1·2·3 이 사라졌고(로컬 4·5명 통과) 원인 4 는 재는 대상이 도착 시각에서 서버 시각으로 바뀌었다(문턱 500ms 그대로).
- 다음 실패는 메시지만 보고 원인을 알 수 있다: waitUntil 이 소켓 닫힘(닉네임·code)을 바로 알리고, 시간 초과에 클라이언트별 소켓 상태·마지막 프레임 경과 ms·마지막 단계가 붙는다.
- 배포본 5회 이상 재검증은 18-14 가 한다(이 계획은 배포하지 않았다).

## 완료한 일

| Task | 내용 | 커밋 |
|------|------|------|
| 1 (tracer, TDD) | smoke 가져오기 가능 + roleStringAllowed·morningProblems 순수 함수, 흐름 안 단언이 같은 함수를 부름, e2eContract 가 shared 의 실제 전이·buildView 아침 view 로 묶음 | RED `1b6b0058` → GREEN `514f52b6` |
| 2 (TDD) | serverSpread·linkReport, 처형 대기 전원, 서버 시각 편차, waitUntil 연결 보고·소켓 단위 닫힘 판정, 재접속 검사 위치, 로컬 smoke 4·5명 | RED `0d546362` → GREEN `4ca38635` |

## TDD 증거 (RED 단언 실패 줄)

RED 1 (`1b6b0058`, 자리 export: roleStringAllowed 늘 true·morningProblems 늘 []·사본 상수 빈 배열):

```
$ node --test scripts/smoke.test.mjs      # tests 7, pass 3, fail 4
✖ roleStringAllowed: view.players[].look 은 값이 옷 id 일 때만 허용한다
✖ roleStringAllowed: 다른 경로의 직업 이름은 여전히 거절한다
✖ roleStringAllowed: 기존 허용 경로(me.role·spectate·result·resultLog part)
✖ morningProblems: 허용 밖 키·eliminated 없음·trace·seen 모양은 문제로 돌려준다
    AssertionError [ERR_ASSERTION]: Expected values to be strictly equal / Expected "actual" to be strictly unequal to: 0

$ npx vitest run test/unit/e2eContract.test.ts      # Tests 2 failed | 78 passed (80)
 FAIL smoke 허용 키·경로와 서버 view ... > 사본 상수 ...
   expect([...s.OUTFIT_IDS]).toEqual([...OUTFIT_IDS])   (받은 값 [] — 기대 coat·police·doctor·mafia·…·noir)
 FAIL ... > 실제 전이로 만든 아침 view ...
   AssertionError: 이름0 의 아침 키: expected [ 'eliminated', 'seen', 'trace' ] to deeply equal []
```

GREEN 1: node --test 7 통과, vitest e2eContract 80 통과, typecheck 통과.

RED 2 (`0d546362`, 자리 serverSpread 늘 0·linkReport 늘 빈 문자열):

```
$ node --test scripts/smoke.test.mjs      # tests 13, pass 7, fail 6
✖ serverSpread: view.serverNow 의 최대 - 최소(반올림 ms)
✖ serverSpread: serverNow 가 없거나 숫자가 아니거나 빈 배열이면 null
✖ linkReport: 열린 소켓·마지막 프레임 경과·마지막 단계를 닉네임과 함께 한 줄에 담는다
✖ linkReport: 예기치 않게 닫힌 클라이언트는 닫힘(code N)
✖ linkReport: 지금 소켓 id 의 프레임만 마지막 프레임으로 센다(재접속 전 프레임은 아니다)
✖ linkReport: 프레임이 없으면 없다고 쓰고, 토큰·채팅 본문·프레임 원문은 결과에 없다
```

GREEN 2: node --test 13 통과.

## 고친 처형 대기 줄 목록

`grep -n "allSee(alive" scripts/smoke.mjs` 로 전부 본 결과, 뒤따르는 코드가 `clients` 전원(탈락자 포함)의 `firstState(...).msg` 를 읽는 곳은 처형 단계 두 곳뿐이었다. 나머지(nomination·defense·verdict·showdown 대기)는 뒤에서 산 사람(`alive`)만 읽어서 그대로 뒀다.

- `runExecutionDay` 의 찬반 마감 뒤 execution 대기(현재 848행): `allSee(alive, "execution", n)` → `allSee(clients, "execution", n)`
- `runShowdownDay` 의 공개 마감 뒤 execution 대기(현재 1014행): 같게

## 편차 판정 기준 근거 (원인 4)

- 실패 판정 = 각 클라이언트 첫 프레임 `view.serverNow` 의 최대 - 최소(문턱 500ms 그대로). 서버는 방송 한 번에 `Date.now()` 를 한 번 재서 모든 소켓에 같은 값을 싣는다(worker/room.ts broadcast). 그래서 이 차이는 서버가 단계를 모두에게 같은 순간 넘겼는가만 잰다. 어떤 클라이언트가 그 단계를 방송이 아니라 나중 프레임(재전송·재접속)으로 처음 받으면 차이가 커져 여전히 잡힌다.
- 도착 시각 차는 한 Mac 에서 먼 지역 엣지까지의 망 지터라 제품이 고칠 수 없고, 실제 플레이어는 각자 다른 망이다.
- 문턱을 올리는 완화는 서버 회귀까지 놓친다. 재는 대상만 바꾸고 문턱은 지킨다. 도착 편차는 `info` 와 SMOKE OK 줄(`arrivalSpread`)에 계속 남긴다. 같은 근거가 스크립트의 `DAY_SPREAD_LIMIT_MS` 위 주석에 있다.
- `serverNow` 가 숫자가 아니면 "서버 시각 편차 측정 못 함" 으로 실패한다.

## 로컬 smoke

로컬 개발 서버(`npm run dev`, 5173)를 이 계획이 띄웠다가 끝에 껐다. `SMOKE_STACK=1 node scripts/smoke.mjs http://localhost:5173 --stage full --players N`.

4명 판(첫 아침에 판이 끝나는 길). 재접속 복원 검사 단계: morning

```
  info: 재접속 복원: 산 시민 편 6줄(전부 ch all, 찬반 기록·유언 카드 포함), 마피아 7줄
  info: 재접속 복원 검사 단계: morning
  info: 판 끝: 1일차, mafiaWin, 탈락 2명
  info: 도착 편차(망 포함, 정보용) dayAnnounce 0ms · discussion 0ms
SMOKE OK full code=1000 players=4 serverSpread=0ms/0ms arrivalSpread=0ms/0ms version=2026-11-10T10:15:15Z+0d546362
```

5명 판(2일차 errand 재접속 길). 재접속 복원 검사 단계: errand(2일차)

```
  info: 재접속 복원: 산 시민 편 6줄(전부 ch all, 찬반 기록·유언 카드 포함), 마피아 7줄
  info: 재접속 복원 검사 단계: errand(2일차)
  info: 판 끝: 2일차, citizenWin, 탈락 3명
  info: 도착 편차(망 포함, 정보용) dayAnnounce 0ms · discussion 0ms
SMOKE OK full code=3464 players=5 serverSpread=0ms/0ms arrivalSpread=0ms/0ms version=2026-11-10T10:15:15Z+0d546362
```

두 판 모두 첫 시도에 통과했고 재접속 검사의 기대 줄 목록은 고치지 않았다(2일차 errand 시점의 복원 줄이 첫 아침과 같은 6줄·7줄이었다).

로컬은 같은 기기라 도착 편차가 0ms 다. 망 지터가 낀 편차 숫자는 배포본 재검증(18-14)에서 서버 시각 편차와 나란히 볼 수 있다.

## 시험 결과

- `node --check scripts/smoke.mjs && node --test scripts/smoke.test.mjs` — 13 통과
- `npx vitest run test/unit/e2eContract.test.ts` — 80 통과(새 describe 2건 포함)
- `npm run typecheck` — 통과
- `node --test scripts/*.test.mjs scripts/e2e/*.test.mjs` — 588 통과 0 실패
- `npm test` — Test Files 279 passed | 6 skipped, Tests 8032 passed | 261 skipped
- 위생 git grep: 이 계획이 건드린 파일(scripts/smoke*.mjs, test/unit/e2eContract.test.ts)은 결과 0. 저장소 전체의 기존 일치는 보관된 마일스톤 문서의 일반 용례("공식 조직 패키지" 등)뿐이다.

## Deviations from Plan

None - plan executed exactly as written.

(사소한 구현 메모: linkReport 의 소켓 상태는 계획 문구 "열림|닫힘(code N)" 에 더해, 예기치 않은 닫힘이 아닌데 readyState 가 열림이 아닌 소켓을 "닫힘(정상 종료 중)" 으로 적는다. 시험이 기대하는 두 형식은 그대로다.)

## Threat Flags

없음. 새 네트워크 표면·인증 경로·파일 접근 없음(smoke 판정 도구 변경). 위협 T-18-28(look 허용 범위 한정)·T-18-29(서버 시각 판정, 문턱 유지)·T-18-30(linkReport 에 토큰·채팅 본문 없음, 시험이 단언)은 계획대로 완화했다.

## Known Stubs

없음.

## Self-Check: PASSED

- FOUND: scripts/smoke.test.mjs, scripts/smoke.mjs, test/unit/e2eContract.test.ts
- FOUND commits: 1b6b0058, 514f52b6, 0d546362, 4ca38635
