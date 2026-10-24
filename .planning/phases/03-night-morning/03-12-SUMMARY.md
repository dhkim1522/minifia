---
phase: 03-night-morning
plan: 12
subsystem: deploy-verification-scripts
tags: [smoke, bot-uat, deploy, tracer, night, morning, spectator, handoff]
status: complete

requires:
  - phase: 03-night-morning/03-09
    provides: 밤·관전 누출 전수 검사, 결정 0020 밤 계약
  - phase: 03-night-morning/03-11
    provides: 경찰 수사 기록 화면(마지막 화면 계획)
provides:
  - "scripts/smoke.mjs full 단계가 낮 한 바퀴 → 밤 30초(역할별 pick·마피아 채팅) → 아침 5초 → 2일차 dayAnnounce 까지 돌고 밤·아침·관전 경계를 단언한다 (한도 300초)"
  - "scripts/uat-night.mjs 봇 밤 시나리오(두 밤, 결과 표, 종료 코드 0/1/2, 4~8명)"
  - "scripts/bots.mjs 의 밤 행동(역할별 pick, 마피아 밤 채팅·이모티콘, 탈락한 봇은 멈춤)"
  - "scripts/uat-day.mjs 새 루프 시간(2일차 대기 180초, 단계 도착 차이 표에 night·morning)"
  - "새 배포 버전 2026-10-24T16:35:44Z+696c1d2 (이전 2026-10-24T11:54:33Z+59c3363)"
  - "HANDOFF.md 3페이즈 실행 완료·실기기 확인 목록·결정 0021 에 맞춘 규칙 줄·다음 할 일, main push"
affects: [04-execution-victory]

requirements-completed: [NIGHT-01, NIGHT-02, NIGHT-03, NIGHT-04, NIGHT-05, NIGHT-06, ELIM-01, COMM-04]

actuals:
  tokens: 10800
  tasks: 3
  commits: 3
plan_head_before: 1a1cad18663685126dd234793264392b9c7924e3
plan_head_after: 0c6545595f197f0e2b46bf84bcbefc90c6a96b7b

tech-stack:
  added: []
  patterns:
    - "스크립트가 전지적으로 view.me.role 을 읽어 역할대로 행동시키고, 받을 사람이 아닌 클라이언트의 프레임에 흔적이 0 인지 실제 네트워크로 센다"
    - "밤 창구 = 그 클라이언트가 night n 을 받은 시각부터 morning n 을 받은 시각 전까지의 프레임"
    - "배포 직전 wrangler whoami 로 개인 계정 확인 → 이전 버전 기록 → 배포 → --previous-version 으로 새 버전 확인"

key-files:
  created:
    - scripts/uat-night.mjs
    - .planning/phases/03-night-morning/03-12-SUMMARY.md
  modified:
    - scripts/smoke.mjs
    - scripts/bots.mjs
    - scripts/uat-day.mjs
    - HANDOFF.md

key-decisions:
  - "스모크 밤 행동은 계획대로 결정적(마피아 전원 → 가장 작은 시민 seat, 경찰 → 가장 작은 마피아, 의사 → 자신)이라 아침 탈락자가 X 로 고정된다"
  - "uat-night 의 의사는 항상 자신을 보호한다 — 8명판 동률 추첨에서 의사 구출이 끼어 탈락자가 사라지지 않게 하기 위해서다(후보 A·B 는 시민이라 자신과 겹치지 않는다)"
  - "uat-night 의 '마감 뒤 pick' 은 계획대로 '아침 state 를 받은 뒤 보낸 pick → WRONG_PHASE' 로 확인한다"
  - "uat-day.mjs 의 단계 도착 차이 표에 night1·morning1 을 더했다(계획의 선택 항목을 채택)"

duration: 약 25분 (배포본 스모크 3회 + 봇 3회 대기 포함)
completed: 2026-10-25
---

# Phase 3 Plan 12: 스크립트·봇 밤 시나리오·배포·HANDOFF Summary

full 스모크를 낮 → 밤 → 아침 → 2일차 낮까지 돌게 고쳐 개인 Cloudflare 계정에 새 버전(`2026-10-24T16:35:44Z+696c1d2`)을 배포하고, 배포본에서 스모크 4·5·8명과 봇 밤 시나리오 5·8명, 낮 회귀 5명이 모두 통과하는 것(밤 비공개 경계·관전 데이터 탈락자 한정 포함)을 확인한 뒤 HANDOFF 를 3페이즈 완료 상태로 바꿔 push 했다.

## 한 일

### Task 1 (tracer): full 스모크 수정 → 게이트 → 배포 → 배포본 4·5·8명

- `scripts/smoke.mjs`: 머리 주석, `FULL_TOTAL_LIMIT_MS = 300_000`, `NIGHT_WAIT_MS`·`MORNING_WAIT_MS`, `ALLOWED_PLAYER_KEYS` 다섯 키(`alive` 추가), `PHASE_NEXT`(`discussion: ["night"]`, `night: ["morning"]`, `morning: ["dayAnnounce"]`), `DAY_PHASES` 에 night·morning, 낮 루프 단언을 discussion → night → morning → dayAnnounce 로.
- 낮 토론 확인 뒤 밤을 돈다: 모든 클라이언트가 night 를 받을 때까지 대기 → 각자 `view.me.role` 로 pick(마피아 전원 → 가장 작은 시민 seat X, 경찰 → 가장 작은 마피아 seat, 의사 → 자신, 4명판은 의사 없음) → 본인 선택(`me.pick`) 반영 확인 → 마피아 한 명이 `say nightTarget` → 시민의 밤 say 는 `WRONG_PHASE`(추가 확인) → 2.1초 뒤 `emoji` → morning → 2일차 dayAnnounce.
- 새 단언: (a) 밤 chat·emoji 프레임이 살아 있는 비마피아 0·마피아 1 이상, (b) `allyPicks` 는 마피아 프레임에만·`records` 는 경찰 프레임에만(둘 다 `view.me` 아래), (c) 아침 `day.morning` 이 모든 클라이언트에서 같은 JSON·탈락자 = X·문구 1..8·`players[].alive` 가 X 만 false·아침 마감 일치, (d) 경찰 `me.records` 마지막 `{n:1, target, isMafia:true}`, (e) X 는 아침 전 프레임에 `spectate` 없음·아침부터 `spectate.seats`(각 job 이 그 seat 의 `me.role` 과 같음), 다른 클라이언트에는 `spectate` 키 없음, (f) 모든 프레임에서 역할 문자열은 허용 경로(`view.me.role`·`view.me.claim`·`view.day.roles[]`·`view.day.claims[].claim`, X 의 아침 이후 `view.spectate.seats[].job`)에만.
- 게이트: `npx vitest run` 64 파일 1309 테스트 통과, `npm run typecheck`·`npm run build` 통과.
- 배포 직전 `npx wrangler whoami` = `dhkim1522@naver.com`(개인 계정) 확인 → OLD_VERSION `2026-10-24T11:54:33Z+59c3363` 기록 → `npm run deploy`(Worker `minifia`, 주소 https://minifia.dhplay.workers.dev, Version ID `b4f4fc9e-57d1-4314-bca9-281f96560023`) → `--print-version` 새 버전 `2026-10-24T16:35:44Z+696c1d2` 로 OLD 와 다름.
- 트레이서 게이트: 5명 스모크를 `--previous-version OLD_VERSION` 으로 돌려 통과한 뒤 8·4명으로 확장(자동 검사만이라 사람 중단 없음, 자동 모드 분기).

배포본 스모크 출력(그대로):

```
SMOKE OK full code=9045 players=5 spread=18ms reveal=23ms version=2026-10-24T16:35:44Z+696c1d2   (--previous-version 2026-10-24T11:54:33Z+59c3363 통과)
SMOKE OK full code=0578 players=8 spread=0ms reveal=33ms version=2026-10-24T16:35:44Z+696c1d2
SMOKE OK full code=5629 players=4 spread=0ms reveal=18ms version=2026-10-24T16:35:44Z+696c1d2
```

(각 실행 약 3분. 5명 실행 `time` 2:59.)

### Task 2: 봇 밤 시나리오·밤 봇·낮 시나리오 새 시간

- `scripts/uat-night.mjs`(새 파일): 방 만들기 → 참가 → 시작 → 1일차 낮은 타이머로 넘김 → 밤1(지목·조사·보호·마피아 채팅, 6명 이상이면 마피아 둘이 서로 다른 시민 A·B 지목) → 아침1 → 낮2(탈락자 claim 거부 확인) → 밤2(마피아·의사 → Z, 관전자 수신, 탈락자 행동 거부) → 아침2 → 전체 검사. 결과 표 `테스트 | 항목 | 결과 | 내용`, 종료 코드 0/1/2, 전체 상한 540초, 토큰은 출력하지 않는다.
- `scripts/bots.mjs`: 탈락한 봇은 낮 claim·토론·밤 모두 멈춘다. 밤에는 `${day.n}:night` 키로 한 번만, 마피아는 동료가 아닌 살아 있는 사람·경찰은 살아 있는 아무나·의사는 살아 있는 사람(가끔 자신)을 0.5~4초 뒤 `pick`, 시민은 행동 없음, 마피아 봇은 가끔 밤 `nightAgree`·`emoji`. 확인: 호스트 소켓을 연 임시 스크립트로 봇 4명을 5명 방에 넣어 돌려 밤1 지목으로 탈락자(seat 4)가 생기고 이후 단계가 진행되며 호스트에 error 가 없음을 확인(임시 스크립트는 저장소에 두지 않음).
- `scripts/uat-day.mjs`: 2일차 claim 대기 130초 → 180초(안내 문구 포함), 도착 차이 표에 night1·morning1 추가.

배포본 결과 표(그대로):

`node scripts/uat-night.mjs --prod` (5명, 방 1967, 종료 코드 0, 31/31):

```
테스트 | 항목 | 결과 | 내용
준비 | 역할 구성(마피아·경찰·의사·시민) | 통과 | 마피아 1, 경찰 1, 의사 1, 시민 2
밤1 | 행위자 화면에 본인 선택(me.pick)이 돌아옴 | 통과 | 행동한 사람 3명
밤1 | 마피아 allyPicks 가 동료가 고른 대상 seat 뿐 | 통과 | 마피아 혼자: 빈 배열
아침1 | 아침 state 를 받은 뒤 pick → WRONG_PHASE | 통과 | WRONG_PHASE
아침1 | 모든 폰이 같은 day.morning | 통과 | {"eliminated":0,"phrase":6}
아침1 | 탈락자 = 마피아가 지목한 시민 | 통과 | 후보 0 → 탈락 0
아침1 | 탈락 문구 번호 1..8 정수 | 통과 | 문구 6
아침1 | players[].alive 가 탈락자만 false | 통과 | 
아침1 | 경찰 수사 기록 1건 (n 1, isMafia true) | 통과 | [{"n":1,"target":3,"isMafia":true}]
아침1 | 비경찰 프레임에 records 키 없음 | 통과 | 
밤1 | 살아 있는 비마피아의 밤 chat·emoji 프레임 0 | 통과 | 비마피아 4명 합계 0
밤1 | 마피아는 모두 밤 채팅을 받음 | 통과 | 
밤1 | 행동하지 않은 시민은 밤 동안 state 1개(밤 시작)뿐 | 통과 | 시민 state 수 1
아침1 | 탈락자 아침 state 에 spectate.seats(모든 직업이 실제와 같음) | 통과 | 
아침1 | 탈락자도 아침 전 프레임에는 spectate 없음 | 통과 | 
아침1 | 살아 있는 클라이언트 프레임에 spectate 키 없음 | 통과 | 
아침1 | 살아 있는 클라이언트 프레임에 job 키 없음 | 통과 | 
낮2 | 탈락자의 claim → BAD_MESSAGE | 통과 | BAD_MESSAGE
밤2 | 탈락자가 밤 행동 state(spectate.picks)를 받음 | 통과 | {"mafia":[2],"police":[2],"doctor":[2]}
밤2 | 탈락자 view 의 실제 직업(spectate.seats)이 모두 맞음 | 통과 | 
밤2 | 탈락자가 마피아 밤 채팅·이모티콘을 받음 | 통과 | chat 1, emoji 1
밤2 | 살아 있는 비마피아의 밤 chat·emoji 프레임 0 | 통과 | 비마피아 3명 합계 0
밤2 | 탈락자의 pick·say·emoji → BAD_MESSAGE | 통과 | pick BAD_MESSAGE, say BAD_MESSAGE, emoji BAD_MESSAGE
밤2 | 탈락자의 거부된 요청이 다른 클라이언트에 chat·emoji 로 가지 않음 | 통과 | 
아침2 | 모든 폰이 같은 day.morning | 통과 | {}
아침2 | 의사 구출: morning 이 {} (구출 비공개) | 통과 | {}
아침2 | 탈락자는 X 한 명뿐 (alive) | 통과 | 
아침2 | 경찰 수사 기록 2건 (n 1 마피아 · n 2 시민) | 통과 | [{"n":1,"target":3,"isMafia":true},{"n":2,"target":2,"isMafia":false}]
전체 | 끝까지 살아 있는 클라이언트 프레임에 spectate 키 없음 | 통과 | 
전체 | 소켓이 예상 밖으로 닫히지 않음 | 통과 | 
전체 | 다른 사람의 토큰이 프레임에 없음 | 통과 | 

31/31 통과
exit=0
```

`node scripts/uat-night.mjs --prod --players 8` (방 8513, 종료 코드 0, 31/31):

```
테스트 | 항목 | 결과 | 내용
준비 | 역할 구성(마피아·경찰·의사·시민) | 통과 | 마피아 2, 경찰 1, 의사 1, 시민 4
밤1 | 행위자 화면에 본인 선택(me.pick)이 돌아옴 | 통과 | 행동한 사람 4명
밤1 | 마피아 allyPicks 가 동료가 고른 대상 seat 뿐 | 통과 | 마피아 둘이 서로의 선택만 봄
아침1 | 아침 state 를 받은 뒤 pick → WRONG_PHASE | 통과 | WRONG_PHASE
아침1 | 모든 폰이 같은 day.morning | 통과 | {"eliminated":1,"phrase":7}
아침1 | 탈락자가 두 후보(A·B) 중 하나 (동률 추첨) | 통과 | 후보 1·2 → 탈락 1
아침1 | 탈락 문구 번호 1..8 정수 | 통과 | 문구 7
아침1 | players[].alive 가 탈락자만 false | 통과 | 
아침1 | 경찰 수사 기록 1건 (n 1, isMafia true) | 통과 | [{"n":1,"target":0,"isMafia":true}]
아침1 | 비경찰 프레임에 records 키 없음 | 통과 | 
밤1 | 살아 있는 비마피아의 밤 chat·emoji 프레임 0 | 통과 | 비마피아 6명 합계 0
밤1 | 마피아는 모두 밤 채팅을 받음 | 통과 | 
밤1 | 행동하지 않은 시민은 밤 동안 state 1개(밤 시작)뿐 | 통과 | 시민 state 수 1,1,1
아침1 | 탈락자 아침 state 에 spectate.seats(모든 직업이 실제와 같음) | 통과 | 
아침1 | 탈락자도 아침 전 프레임에는 spectate 없음 | 통과 | 
아침1 | 살아 있는 클라이언트 프레임에 spectate 키 없음 | 통과 | 
아침1 | 살아 있는 클라이언트 프레임에 job 키 없음 | 통과 | 
낮2 | 탈락자의 claim → BAD_MESSAGE | 통과 | BAD_MESSAGE
밤2 | 탈락자가 밤 행동 state(spectate.picks)를 받음 | 통과 | {"mafia":[2],"police":[2],"doctor":[2]}
밤2 | 탈락자 view 의 실제 직업(spectate.seats)이 모두 맞음 | 통과 | 
밤2 | 탈락자가 마피아 밤 채팅·이모티콘을 받음 | 통과 | chat 1, emoji 1
밤2 | 살아 있는 비마피아의 밤 chat·emoji 프레임 0 | 통과 | 비마피아 5명 합계 0
밤2 | 탈락자의 pick·say·emoji → BAD_MESSAGE | 통과 | pick BAD_MESSAGE, say BAD_MESSAGE, emoji BAD_MESSAGE
밤2 | 탈락자의 거부된 요청이 다른 클라이언트에 chat·emoji 로 가지 않음 | 통과 | 
아침2 | 모든 폰이 같은 day.morning | 통과 | {}
아침2 | 의사 구출: morning 이 {} (구출 비공개) | 통과 | {}
아침2 | 탈락자는 X 한 명뿐 (alive) | 통과 | 
아침2 | 경찰 수사 기록 2건 (n 1 마피아 · n 2 시민) | 통과 | [{"n":1,"target":0,"isMafia":true},{"n":2,"target":2,"isMafia":false}]
전체 | 끝까지 살아 있는 클라이언트 프레임에 spectate 키 없음 | 통과 | 
전체 | 소켓이 예상 밖으로 닫히지 않음 | 통과 | 
전체 | 다른 사람의 토큰이 프레임에 없음 | 통과 | 

31/31 통과
exit=0
```

`node scripts/uat-day.mjs --prod --players 5` (방 8080, 종료 코드 0, 11/11):

```
테스트 | 항목 | 결과 | 내용
6 | 2000ms 간격 4명×4번 | 통과 | 오탐 0/16
6 | 2050ms 간격 4명×4번 | 통과 | 오탐 0/16
6 | 2150ms 간격 4명×4번 | 통과 | 오탐 0/16
6 | 받아들인 메시지가 모든 폰에 도착 | 통과 | 빠진 줄(폰별) 0,0,0,0,0
7 | 이모티콘이 모든 폰에 도착 | 통과 | 보낸 뒤 104ms 안, 폰 사이 차이 20ms
7 | 이모티콘은 chat 프레임이 아니고 state 의 day 에 messages 키가 없음 | 통과 | 
3 | 다른 직업 → 모든 폰에 changed | 통과 | mafia → doctor
3 | 같은 직업 → changed 아님 | 통과 | 
8 | 2일차에 안 고른 사람의 공개 값 | 통과 | 어제 police → 오늘 police
8 | 이틀 다 안 고른 사람의 공개 값 | 통과 | none
7 | 단계 전환 도착 차이(같은 PC) | 통과 | dayAnnounce1 25ms · claim1 0ms · claimReveal1 27ms · discussion1 22ms · night1 45ms · morning1 22ms · dayAnnounce2 0ms · claim2 23ms · claimReveal2 22ms · discussion2 23ms
exit=0
```

(8명 시나리오와 낮 시나리오는 서로 다른 방이라 동시에 돌렸다.) 8명판 동률 결과는 한 번의 관측이며 "두 후보 중 하나" 라는 계약만 확인한다(후보 1·2 → 탈락 1).

### Task 3: HANDOFF

- 현재 상태 맨 위 3페이즈 진행 줄을 "3페이즈(밤과 아침) 실행 완료(03-01~03-12) — 실기기 확인 대기" 항목으로 교체: 새·이전 버전, 스모크 세 줄, uat-night 5·8명·uat-day 요약, 바뀐 것 한 단락(결정 0018~0021, A1·A2 사용자 변경 가능), **실기기 확인 목록 (1)~(7)**, 봇 시나리오 사용법 `node scripts/uat-night.mjs --prod [--players 4~8]`.
- 규칙 줄을 결정 0021 에 맞춤: "남의 역할은 살아 있는 사람에게는 보내지 않는다(결정 0002). 토큰은 누구에게도 클라이언트로 보내지 않는다. 마피아에게만 동료 seat 가 간다. 탈락자 관전 예외: …(결정 0021)". 결정 요약에 0018·0019·0020·0021 추가, 최신 배포 버전 갱신, 환경 메모의 배포 명령에 uat-night 추가.
- 다음 할 일: `/gsd-verify-work 3` → secure/validate/extract-learnings 3 → A1·A2 확인 → 디자인 아티팩트 동기화 → `/gsd-discuss-phase 4`, 2페이즈·1페이즈 남은 항목은 아래로 보존.
- 인수 기준 grep: `3페이즈(밤과 아침) 실행 완료` 1, `살아 있는 사람에게는 보내지 않는다` 1, `탈락자 관전` 1, `uat-night.mjs` 3, `/gsd-verify-work 3` 2, `남의 역할·토큰을 보내지 않는다` 0, `토큰은 누구에게도 클라이언트로 보내지 않는다` 1.
- push: 이 SUMMARY 와 STATE·ROADMAP 커밋 뒤 `git push`(개인 SSH 원격) — 결과는 아래 "Push" 에 적었다.

## Commits

- 696c1d2 test(03-12): smoke through night, morning and spectator
- ba78745 test(03-12): night bot scenario, night bots, day uat timings
- 0c65455 docs(03-12): handoff after phase 3 execution

`commits: 3` 은 `git rev-list --count ${plan_head_before}..HEAD` 로 측정한 SUMMARY 작성 시점 값이다(이 SUMMARY·STATE·ROADMAP 커밋은 그 뒤에 더해진다).

## 인수 기준 확인

- Task 1: `night: ["morning"]` 1, `FULL_TOTAL_LIMIT_MS = 300_000` 1, `"alive", "connected", "isHost", "nickname", "seat"` 1, `spectate` 12, SUMMARY 에 OLD_VERSION·새 version 이 다르고 SMOKE OK full 세 줄(4·5·8명) 있음 — 모두 통과.
- Task 2: `scripts/uat-night.mjs` 존재, `spectate` 16(2 이상), `t: "pick"` (bots) 1, `180_000` (uat-day) 1, `console.log` 에 token 0, uat-night 5·8명·uat-day 5명 결과 표와 종료 코드 0 — 모두 통과.
- Task 3: 위 grep 통과, `git status --porcelain HANDOFF.md` 빈 출력, push 는 아래 "Push".

## Deviations from Plan

None - plan executed exactly as written. (계획 범위 안의 보강: 스모크에 시민의 밤 say → `WRONG_PHASE` 확인과 모든 프레임 역할 문자열 경로 검사, uat-night 에 낮2 탈락자 claim 거부·시민 state 1개·끝까지 spectate/토큰 검사를 더했다. 앱 코드 수정과 재배포는 필요 없었다 — 배포는 한 번.)

## Issues Encountered

- 없음. 스모크 3회·봇 3회가 모두 첫 시도에 통과해 수정·재배포가 없었다.
- 참고(고치지 않음): `bots.mjs` 의 직업 공개 키가 존재하지 않는 `view.day.number` 를 읽어 `"d:claim"` 로 고정된다. 낮마다 한 번만 보낸다는 동작은 토론 타이머가 해제될 때 키를 지우므로 지금까지 맞게 돌았고 이번 범위 밖이다.
- 아직 사람이 해야 하는 것: 실기기 확인 (1)~(7) — HANDOFF 목록. 통과 표시하지 않았다.

## Known Stubs

없음.

## Threat Flags

없음. 새 네트워크 입구·인증 경로·신뢰 경계 변화가 없다(스크립트만 변경). T-03-36(배포 직전 `wrangler whoami` = dhkim1522@naver.com 확인)·T-03-38(uat-night 에 token 출력 grep 0, 스모크·봇은 토큰을 찍지 않음)·T-03-39(배포본 스모크·봇이 비마피아 밤 chat 0·spectate 는 탈락자만·records 는 경찰만·allyPicks 는 마피아만을 실제 네트워크로 확인)·T-03-SC(새 패키지 없음)를 지켰다.

## Self-Check: PASSED

- 파일: scripts/smoke.mjs, scripts/uat-night.mjs, scripts/bots.mjs, scripts/uat-day.mjs, HANDOFF.md 존재 확인, 네 스크립트 `node --check` 통과
- 커밋: 696c1d2, ba78745, 0c65455 모두 HEAD 의 조상
- 인수 기준: 위 "인수 기준 확인" 전부 통과
- 전체 검증: 배포 전 `npx vitest run` 1309 통과, `npm run typecheck`, `npm run build` 통과. 배포본 SMOKE OK full 4·5·8명, uat-night 5·8명 31/31, uat-day 5명 11/11, 종료 코드 모두 0

## Next Phase Readiness

3페이즈의 계획 12개가 모두 실행됐다. 다음은 `/gsd-verify-work 3`(HANDOFF 실기기 확인 목록 (1)~(7) — 폰 2대 이상, 360px 폭 하나 포함)과 `/gsd-secure-phase 3`·`/gsd-validate-phase 3`. A1·A2 규칙 가정은 사용자 확인 대기. 4페이즈(처형과 승패)는 discussion 과 night 사이에 투표·처형을 끼운다.
