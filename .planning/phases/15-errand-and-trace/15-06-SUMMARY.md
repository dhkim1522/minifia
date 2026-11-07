---
phase: 15-errand-and-trace
plan: "06"
subsystem: leak-tests-and-contract-consumers
tags: [leak, frames, errand, record, trace, night-pick, smoke, bots, uat-room, minifia-v3, d-02, d-04, d-05, d-06, d-08, deploy-03]
status: complete

requires:
  - phase: 15-01
    provides: "me.errand·errand 단계·장소 id"
  - phase: 15-02
    provides: "근처 snap(near)·표본 알람·me.record"
  - phase: 15-03
    provides: "밤 고르기 통일·day.morning.trace"
provides:
  - "test/worker/errandLeak.test.ts: 역할 다섯 시점(마피아·경찰·의사·시민·유령)의 실제 소켓 프레임 전수 시험 14개 — me.errand 구조, 근처 집합 독립 계산 대비 snap 좌석, move 는 본인·유령만, me.record 본인 한정, 밤 응답 동일성, 아침 흔적 동일값, 허용 밖 키 음성 시험"
  - "test/unit/viewRoles15.test.ts: 같은 생존 상태 viewer 사이 me 밖 한 글자 동일, me 안 허용 키, errand·record 구조 동일"
  - "test/worker/leak.test.ts: 15페이즈 허용 경로 목록(FIFTEEN_PATHS, 이유 주석)·서버 전용 이름 6개 추가·전체 판 시험의 받을 권리 단언·음성 시험"
  - "scripts/smoke.mjs·bots.mjs·uat-test-room.mjs: dayAnnounce → errand → discussion 전이, errand 40초 대기, 밤에 시민도 pick"
  - "test/unit/e2eContract.test.ts: smoke.mjs 의 ERRAND_MS 가 phases.ts 와 같음 + 스크립트 전이 표 시험"
affects: [15-09, 15-10]

requirements-completed: [ERRAND-03, ERRAND-04, ERRAND-05, TRACE-01, TRACE-02, TRACE-03]
requirements-partial: [DEPLOY-03]  # 누설 검사 확장·smoke 반영 부분만. 배포 자체는 15-10 에서 닫는다(REQUIREMENTS.md 는 Pending 유지)

actuals:
  tokens: 65000
  tasks: 2
  commits: 4

plan_head_before: aa297bd6c6ed48fa7da94c7acd25c501065313de
plan_head_after: 14d7fdd699404268920fe434f041e52035ff186b

key-files:
  created:
    - test/worker/errandLeak.test.ts
    - test/unit/viewRoles15.test.ts
  modified:
    - test/worker/leak.test.ts
    - test/worker/continuity.test.ts
    - scripts/smoke.mjs
    - scripts/bots.mjs
    - scripts/uat-test-room.mjs
    - test/unit/e2eContract.test.ts

key-decisions:
  - "근처 판정은 시험이 좌표만으로 독립 계산한다(nearOf = hypot ≤ ERRAND_NEAR_R×100, 경계 R 포함·R+1 제외). 서버 판정 함수를 다시 쓰지 않는다. 위치는 메모리 world 에 직접 쓰고(errandNear.test.ts 선례) 표본 알람은 errandTickAt 을 과거로 당겨 돌린다"
  - "같은 모양은 값이 아니라 구조로 견준다. 밤 응답은 me 를 뺀 나머지를 stable() 로 견주고 me 안은 역할별 정당한 차이(records·allies·nightTally)가 있어 me.pick 일치와 요약 열로 본다"
  - "me.record 존재 검사는 문자열 검색이 아니라 키 경로로 한다 — 장소 id 에 'record'(레코드 가게)가 있어 errand 프레임에 '\"record\"' 문자열이 정상적으로 들어 있다"
  - "허용 목록 검사 도우미는 시험 파일 안에 둔다(제품 코드에 넣지 않는다). 허용 경로 접두는 '그 키 자신 또는 그 아래'라 기존 .view.me.records 와 겹치지 않고, me.errandNear 같은 이름은 서버 전용 이름 검사가 마지막 키로 잡는다"

duration: 약 70분
completed: 2026-11-07
---

# Phase 15 Plan 06: 누설 검사·서버 계약 소비자 Summary

**심부름·목격 기록·밤 선택·아침 흔적의 실제 소켓 프레임을 역할 다섯 시점으로 전수 검사하는 시험(14개)과 공유 view 비교 시험, 전체 판 누설 시험의 새 허용 경로를 더했고, 배포 smoke·소켓 봇·UAT 방 스크립트가 errand 단계를 정상 흐름으로 읽게 했다. 서버 누설 결함은 나오지 않았다.**

## 한 일

**Task 1 — 전수 누설 시험 (dd2f3bf2)**

- `errandLeak.test.ts` (14개, 3회 연속 통과):
  - ① 산 마피아·경찰·의사·시민의 me.errand 키 집합 `done,places`·장소 3곳(서로 다른 PLACE_IDS)·done 빈 배열, 유령은 키 없음.
  - ② 근처 집합 독립 계산 대비 snap 좌석(두 배치, 경계 R 포함·R+1 제외), 근처 사람 구간 끝은 반경 안·먼 목적지 좌표가 프레임에 없음, 네 역할이 각각 걸어도 다른 산 사람은 world 프레임 0개·유령은 받음, errand 진입 snap(유령 전원·near 표시 없음), 토론 전환 때만 전체 snap·다음 날 errand 진입에서 다시 근처 snap.
  - ③ me.record: A(마피아·시민 두 번)만, 줄 키 `place,seat`, B(2곳)·유령·그 밖 사람 프레임에 키 경로 없음, 아무도 못 본 A 는 빈 배열, 토론 단계 state 에서만 나타남.
  - ④ 밤: 마피아·경찰·의사·시민이 같은 대상을 고르면 응답이 모두 `[state:night]` 한 프레임이고 me 밖이 같으며 죽은 대상·앉지 않은 seat 는 모두 같은 BAD_MESSAGE 열.
  - ⑤ 흔적: 마피아 전원+시민 하나가 고른 X 의 아침, 다섯 시점의 day.morning 키 `eliminated,trace`·같은 값·조각 id·의상·역할 단어 아님. 구출 아침은 `{saved:true}`·무효 아침은 `{}`(trace 없음).
  - ⑥ 음성: 허용 밖 키(me.errandNear·me.errand.near·me.record[].role·morning.victim)·서버 전용 이름·금지 키·엉뚱한 단계의 새 필드·역할 닮은 값·world 밖 경로가 위반으로 판정된다.
  - 모든 시점이 받은 모든 프레임에 금지 키(token·id·playerId·connId·nicknameKey·joinSeq·hostId)·서버 전용 이름(errandPlaces·errandDone·errandNear·errandSeen·errandTickAt·nightPick)·허용 밖 새 경로가 0개.
- `viewRoles15.test.ts` (6개): errand·discussion·night·morning × 인원 4·6·8 × 시드 3, 산/유령 viewer 끼리 me 밖 JSON 동일, me 안 허용 키, 서버 전용 이름 부재, errand·record·morning 구조 동일, 음성.
- `leak.test.ts`: `FIFTEEN_PATHS`(이유 주석)·`SERVER_ONLY_KEYS` 6개 추가, 6명 한 판 시험에서 errand 는 errand 단계 산 본인 여섯 모두·record 는 아무에게도(심부름을 안 한 판)·trace 는 아침에만 단언, "15페이즈 허용 경로" 음성 describe 추가. view.test.ts·e2eContract 는 이미 errand·record 키를 알고 있어 수정 없음(VIEW_*_KEYS ↔ view.test.ts 비교 시험이 이미 통과).

**Task 2 — 서버 계약 소비자 (0646e258)**

- `smoke.mjs`: `ERRAND_MS = 40_000`·`ERRAND_WAIT_MS`, PHASE_NEXT `dayAnnounce → errand → discussion`, DAY_PHASES 에 errand, 첫 낮에 errand 상태의 phaseEndsAt 동일·길이 40000·me.errand 3곳 단언(로그 줄에 토큰·역할 없음), discussion 대기 한도를 errand 만큼 늘림(첫 낮·다음 낮들), 밤에 시민 하나의 pick 이 오류 없이 me.pick 으로 돌아옴, `FULL_TOTAL_LIMIT_MS` 720→900초(하루 40초씩 늘어남).
- `bots.mjs`: errand 분기(행동 없이 지나감), 밤에 시민 봇도 pick.
- `uat-test-room.mjs`: errand 를 끼운 전이 표·넘기기 열("한 번에 하나씩" 문구와 순서), errand 단계 me.errand 확인, 넘긴 밤의 morning 에 trace 문자열 확인.
- `e2eContract.test.ts`: smoke.mjs 의 ERRAND_MS = phases.ts 의 ERRAND_MS, 세 스크립트 전이 표·대기·봇 분기 문자열 시험 4개.

**보류 항목 해결 (14d7fdd6)** — `continuity.test.ts` "옛 방장이 같은 토큰으로 돌아오면…"의 5초 시간 초과(15-02 이전부터)의 원인을 찾아 고쳤다. editRoom(DO 퇴거 포함)이 이 환경에서 약 2초 걸려, 4초로 옮긴 disconnectedAt 이 알람 시점에 6초를 넘고 이양과 함께 옛 방장이 정리됐다. 옛 방장의 hello 에는 응답이 없어 `hello` 가 3초를 기다리다 테스트 한도(5초)에 먼저 걸렸다. `PAST_GRACE_MS` 를 3200 으로(3초 이상·6초 미만이 지연 0~2.5초에서 모두 성립) 줄였다. 15페이즈 변경과 무관한 시험 시각 문제.

## 검증

- `npx vitest run test/worker/errandLeak.test.ts test/unit/viewRoles15.test.ts test/worker/leak.test.ts test/worker/ghostLeak.test.ts test/worker/nightLeak.test.ts test/unit/view.test.ts test/unit/e2eContract.test.ts`: 7 파일 233 통과.
- `node --check` 세 스크립트 통과, tsc(app·worker) 해당 파일 오류 없음.
- 전체 `npx vitest run` 두 번: 1차 1 실패(continuity, 위 원인), 수정 뒤 2차 255 파일 7363 통과·0 실패.
- 실제 배포본 smoke·UAT 방 실행은 이 계획 범위가 아니다(15-10).

## 편차

**1. [Rule 1 - 시험 결함] 장소 id "record" 와 문자열 검색 충돌** — errand 프레임의 `places` 에 장소 id `record`(레코드 가게)가 들어 있어 `raw.includes('"record"')` 가 거짓 양성이었다. 키 경로(`.view.me.record`)로 검사하도록 시험을 고쳤다. 같은 방식의 문자열 검색이 `errandNear.test.ts`(15-02)에 있으나 그 시험은 errand 프레임이 mark 이전이라 현재는 안전하다(바꾸지 않음).

**2. [Rule 3 - 차단 해제] 같은 토큰 재연결로 옛 소켓이 닫힘** — 유령 시점을 새 소켓으로 열면 옛 소켓은 닫혀 이후 advanceTo 가 기다리다 실패했다. 이후 단계 전환은 살아 있는 소켓 목록(유령은 새 소켓)으로만 기다리게 했다.

**3. [Rule 1 - 기존 시험 결함] continuity 시험 시각 의존** — 위 "보류 항목 해결". 계획 파일 목록 밖(`test/worker/continuity.test.ts`)이나 15-02 가 15-06 에 넘긴 보류 항목이라 고쳤다.

**4. 서버 누설 결함 없음** — 새 시험은 15-01~03 서버 위에서 처음부터 통과했다(느슨하게 한 곳 없음).

## 불안정(flaky) 재확인

15-02·15-03 이월 메모의 `errand.test.ts`(거절 이유가 여섯 가지여도 응답 같음)·`bots.test.ts`(밤 chat 등) 부하 민감성은 이번 전체 회귀 두 번에서 재현되지 않았다. 원인을 확정하지 못했고 시험은 바꾸지 않았다(병렬 부하와 겹칠 때만 드물게 나타나는 시각 민감 시험으로 보인다). 다시 나타나면 `forceDue`/알람 빈도와 `at` 비교 시험을 먼저 의심한다.

## 이월 메모 (다음 계획용)

- **15-09 (E2E)**: `scripts/e2e/*` 는 건드리지 않았다. 낮 시작 이후 errand 40초가 끼므로 기존 E2E 의 `dayAnnounce → discussion` 대기·`skipTo("discussion")` 가정(15-03 이월 메모도 같은 지적)을 확인해야 한다. smoke 의 errand 구간은 전환 대기만 하고 걷지 않는다.
- **15-10 (결정 0074·배포 검증)**: `npm run` 이 아니라 `node scripts/smoke.mjs --stage full` 이 errand 40초 × 낮 수만큼 길어진다(제한 900초로 올림). 첫 낮 smoke 는 errand 의 phaseEndsAt 동일·길이·me.errand 구조를 단언한다. 결정 0074 에 적을 것: 시험이 근처 집합을 독립 계산한다는 원칙, 허용 경로 목록(FIFTEEN_PATHS) 운영 규칙, record 문자열 검색 금지(장소 id 'record').
- 새 키를 view 에 더하면 `FIFTEEN_PATHS`(leak.test.ts)·`ALLOWED_NEW_PATHS`(errandLeak.test.ts)·`ME_ALLOWED`(viewRoles15)·`ME_KEYS`(view.test.ts)·`VIEW_ME_KEYS`(scripts/e2e/lib.mjs) 다섯 곳을 같이 고쳐야 시험이 통과한다.

## Known Stubs

없음.

## Threat Flags

없음. (T-15-23~26 은 위 시험이 닫는다. 새 로그 줄에는 토큰·역할을 쓰지 않았다.)

## Self-Check: PASSED

- 파일: test/worker/errandLeak.test.ts, test/unit/viewRoles15.test.ts, 수정 파일들 존재 확인.
- 커밋: dd2f3bf2, 0646e258, 14d7fdd6 가 HEAD 의 조상.
