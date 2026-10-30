---
phase: 02-day-discussion
plan: 18
subsystem: deploy-verification-docs
tags: [smoke, bot-uat, deploy, gap-closure, docs-alignment, decision-0017]
gap_closure: true
gap_ids: [G-02-1, G-02-2]
status: complete

requires:
  - phase: 02-day-discussion
    provides: 02-12 chat 프레임·서버 한도 1800ms, 02-13 닉네임 5자, 02-14~02-17 고정 테이블·하단 157·채팅 모달·방장 줄 제거
provides:
  - scripts/smoke.mjs full 단계가 chat 프레임·extend/skip BAD_MESSAGE·서버 타이머 대기 기준 (한도 240초)
  - scripts/uat-day.mjs 가 chat 프레임 기준 오탐 계산, 방장 skip 없이 토론 타이머를 기다려 2일차까지
  - 새 배포 버전 2026-10-24T11:54:33Z+59c3363 (이전 2026-10-23T18:47:24Z+1ca2b41)
  - 배포본 5명·8명 스모크와 봇 UAT 수치 (G-02-2 회귀: 2000ms 오탐 0)
  - ROADMAP SC2·3·5, REQUIREMENTS DAY-01·COMM-01·COMM-04, 기획서 낮 토론 줄, 결정 0016 5·6·7·상수 목록이 결정 0017·G-02-2 의 지금 동작과 같은 문장
  - 02-VALIDATION.md 갭 클로저 검사 행, 02-UI-SPEC 대체 표시, 02-UAT 봇 재확인 note, 결정 0017·SPEC.md 의 높이 적응 세로 위치 기록
  - HANDOFF.md 갱신 + main push
affects: []

requirements-completed: [DAY-01, DAY-02, COMM-01, COMM-02, COMM-04]

actuals:
  tokens: 14200
  tasks: 3
  commits: 5
plan_head_before: 31fe6f95f902da1370f38241400f79a3411d961d
plan_head_after: ea924cf1ea9ac0c5e239eef9a20a7dc9ffd61297

tech-stack:
  added: []
  patterns:
    - "스모크·봇이 메시지 수락을 state 가 아니라 chat 프레임(seq·seat·target)으로 판정한다 — 서버가 메시지를 보관하지 않기 때문"
    - "넘기기 없이 서버 타이머(토론 90초 + 여유)를 기다려 낮 루프를 증명한다"

key-files:
  created:
    - .planning/phases/02-day-discussion/02-18-SUMMARY.md
  modified:
    - scripts/smoke.mjs
    - scripts/uat-day.mjs
    - .planning/phases/02-day-discussion/02-VALIDATION.md
    - .planning/phases/02-day-discussion/02-UAT.md
    - .planning/phases/02-day-discussion/02-UI-SPEC.md
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
    - docs/product.md
    - docs/decisions/0016-day-loop-structure.md
    - docs/decisions/0017-day-table-redesign.md
    - design/screens/day-v3/SPEC.md
    - HANDOFF.md

key-decisions:
  - "스모크 전체 한도를 240초로(토론 90초를 다 기다림), 5명(기본)과 8명 두 번 돈다 (계획의 재량 결정)"
  - "UAT.md 의 result 필드는 바꾸지 않고 봇 수치는 note 로만 남긴다. 테스트 1~5·7 은 실기기 재확인 대기"
  - "높이 적응 세로 위치(장면 높이 < 359 → cy = max(177, H − 149))를 SPEC 과의 의도적 차이로 결정 0017·SPEC.md 메모·HANDOFF 에 기록"

duration: 약 25분 (스모크 2회 + 봇 2회 대기 포함)
completed: 2026-10-24
---

# Phase 2 Plan 18: 갭 클로저 배포·봇 확인·문서 정렬 Summary

스모크·봇 시나리오를 chat 프레임과 타이머 진행 기준으로 고쳐 새 버전(`2026-10-24T11:54:33Z+59c3363`)을 배포하고, 배포본 5명·8명에서 낮 한 바퀴와 2000ms 간격 전송 오탐 0 을 확인한 뒤 원천 문서와 HANDOFF 를 결정 0017·G-02-2 의 지금 동작에 맞췄다.

## 한 일

### Task 1 (tracer): full 스모크 수정 → 배포 → 배포본 5명·8명

- `scripts/smoke.mjs`: `FULL_TOTAL_LIMIT_MS = 240_000`, 토론 대기 상수 `DISCUSSION_WAIT_MS`(90초 + 여유). 낮 토론 묶음을 chat 프레임 기준으로 바꿈 — suspect say 뒤 모든 클라이언트가 `t === "chat"` 프레임을 받고 키 집합이 `at,seat,seq,t,target,template`; 2초 안 두 번째는 `RATE_LIMITED`, `text` 키는 `BAD_MESSAGE`; 거부 뒤 방장이 받은 clients[1] 의 chat 프레임은 정확히 하나; 손님·방장의 `extend`·`skip` 이 모두 `BAD_MESSAGE` 이고 마감(`phaseEndsAt`·`phaseDurationMs` 90000)이 그대로; 그 뒤 넘기기 없이 서버 타이머로 `dayAnnounce`(day.n 2) 도착. 단언 묶음에 모든 state 프레임에 `messages`·`extendUsed` 키 없음, chat 프레임 키 허용 집합(`t, seq, seat, template, target, claimedRole, at`) 안이고 `id`·`role`·`token` 없음을 더함(T-02-48). 기존 누출·순서·편차·에셋 단언은 그대로.
- 배포 전 게이트: `npx vitest run` 56 파일 1052 테스트 통과, `npm run typecheck` exit 0 (02-14 높이 300~460 배치 검사와 02-16·02-17 장면 높이 배선 검사 포함).
- 배포 직전 `npx wrangler whoami` = `dhkim1522@naver.com`(개인 계정) 확인 후 `npm run deploy` → Worker `minifia`, 주소 https://minifia.dhplay.workers.dev, Version ID `6cb0df31-7841-4a78-bd1b-5b2f548b9f81`.
- BASE `31fe6f9`, OLD_VERSION `2026-10-23T18:47:24Z+1ca2b41` → 새 버전 `2026-10-24T11:54:33Z+59c3363` (`--print-version`, 다름).
- 배포본 스모크 결과:

```
SMOKE OK full code=8393 players=5 spread=0ms reveal=0ms version=2026-10-24T11:54:33Z+59c3363   (--previous-version OLD_VERSION 통과)
SMOKE OK full code=6204 players=8 spread=7ms reveal=32ms version=2026-10-24T11:54:33Z+59c3363
```

- `02-VALIDATION.md` Per-Task Verification Map 에 02-12~02-18 행 10줄을 더하고(02-03·02-09 대체 표시, Manual-Only 행 교체), 02-18 봇 행은 Task 2 에서 green 으로 바꿈.

### Task 2: 봇 UAT 시나리오 수정 → 배포본 5명·8명 (G-02-2 회귀)

- `scripts/uat-day.mjs`: `seenSeqs` 를 chat 프레임 seq 집합으로, `burst` 의 수락 판정을 "내 seat·이번 target 의 새 chat 프레임이 error 보다 먼저 오면 수락, `RATE_LIMITED` 가 먼저면 오탐" 으로 변경. 테스트 7 의 이모티콘 검사를 "chat 프레임이 아니고 어떤 state 에도 messages 키가 없음" 으로. 방장 skip 을 지우고 토론 타이머가 끝날 때까지(최대 130초) 2일차 claim 을 기다림. 종료 코드 규칙 그대로.
- 배포본 결과 표 (모두 종료 코드 0):

5명 (방 8754):

| 테스트 | 항목 | 결과 | 내용 |
| --- | --- | --- | --- |
| 6 | 2000ms 간격 4명×4번 | 통과 | 오탐 0/16 |
| 6 | 2050ms 간격 4명×4번 | 통과 | 오탐 0/16 |
| 6 | 2150ms 간격 4명×4번 | 통과 | 오탐 0/16 |
| 6 | 받아들인 메시지가 모든 폰에 도착 | 통과 | 빠진 줄(폰별) 0,0,0,0,0 |
| 7 | 이모티콘이 모든 폰에 도착 | 통과 | 보낸 뒤 93ms 안, 폰 사이 차이 4ms |
| 7 | 이모티콘은 chat 프레임이 아니고 state 의 day 에 messages 키가 없음 | 통과 | |
| 3 | 다른 직업 → 모든 폰에 changed | 통과 | mafia → doctor |
| 3 | 같은 직업 → changed 아님 | 통과 | |
| 8 | 2일차에 안 고른 사람의 공개 값 | 통과 | 어제 police → 오늘 police |
| 8 | 이틀 다 안 고른 사람의 공개 값 | 통과 | none |
| 7 | 단계 전환 도착 차이(같은 PC) | 통과 | dayAnnounce1 3ms · claim1 6ms · claimReveal1 7ms · discussion1 5ms · dayAnnounce2 4ms · claim2 1ms · claimReveal2 9ms · discussion2 5ms |

8명 (방 8691):

| 테스트 | 항목 | 결과 | 내용 |
| --- | --- | --- | --- |
| 6 | 2000ms 간격 7명×4번 | 통과 | 오탐 0/28 |
| 6 | 2050ms 간격 7명×4번 | 통과 | 오탐 0/28 |
| 6 | 2150ms 간격 7명×4번 | 통과 | 오탐 0/28 |
| 6 | 받아들인 메시지가 모든 폰에 도착 | 통과 | 빠진 줄(폰별) 0,0,0,0,0,0,0,0 |
| 7 | 이모티콘이 모든 폰에 도착 | 통과 | 보낸 뒤 133ms 안, 폰 사이 차이 26ms |
| 7 | 이모티콘은 chat 프레임이 아니고 state 의 day 에 messages 키가 없음 | 통과 | |
| 3 | 다른 직업 → 모든 폰에 changed | 통과 | mafia → doctor |
| 3 | 같은 직업 → changed 아님 | 통과 | |
| 8 | 2일차에 안 고른 사람의 공개 값 | 통과 | 어제 police → 오늘 police |
| 8 | 이틀 다 안 고른 사람의 공개 값 | 통과 | none |
| 7 | 단계 전환 도착 차이(같은 PC) | 통과 | dayAnnounce1 22ms · claim1 25ms · claimReveal1 26ms · discussion1 21ms · dayAnnounce2 23ms · claim2 21ms · claimReveal2 0ms · discussion2 43ms |

2000ms 간격 오탐: 5명 **0/16**, 8명 **0/28** (이전 G-02-2 측정: 5명 3/16, 8명 7/28). 2050·2150ms 도 0. 이 수치를 `02-UAT.md` 테스트 6 note 에 적음(result 필드는 그대로).

- `02-UAT.md`: Current Test expected 를 "G-02-1·G-02-2 갭 닫기(02-12~02-18) 완료 — 새 화면으로 테스트 1~5·7 을 실기기에서 다시 확인" / awaiting `human re-verification` 으로, 갭 G-02-1·G-02-2 에 note. **테스트 1~5·7 의 result 는 바꾸지 않음**(`result: pass` 는 테스트 8 하나 그대로).
- `02-UI-SPEC.md`: 머리에 결정 0017 이 대체한 부분과 새 기준(`design/screens/day-v3/SPEC.md`) 한 문단.
- 높이 적응 세로 위치(plan checker W3): 결정 0017 "결과" 절 끝과 `design/screens/day-v3/SPEC.md` 좌석 원 줄 아래 메모에 기록. SPEC.md 는 승인본 사본이라 메모 줄만 더함(`git diff --numstat 31fe6f9`: +3 −0).

### Task 3: 문서 정렬·HANDOFF·push

- REQUIREMENTS DAY-01·COMM-01·COMM-04 + 마지막 갱신 줄, ROADMAP Phase 2 성공 기준 2·3·5(계획 목록·진행표는 건드리지 않음), `docs/product.md` 낮 토론 줄, 결정 0016 5·6·7 끝 갱신 줄과 조정 상수 목록(EXTEND_MS·MESSAGE_KEEP 삭제, `SERVER_MIN_SEND_GAP_MS` 추가).
- HANDOFF.md: 현재 상태 첫 항목을 갭 클로저 완료 요약(새 버전, 스모크·봇 수치, 바뀐 것, 실기기 확인 목록)으로 교체, 02-15~02-17 진행 줄 삭제, 옛 실기기 항목 정리, 디자인 세션 몫에 "결정 0017 동기화"와 "높이 적응 세로 위치 S-07 반영 여부" 추가, 다음 할 일 1번을 `/gsd-verify-work 2` 로, 옛 `--gaps` 항목 삭제. 환경 메모는 그대로.
- `git push`(SSH `git@github.com:dhkim1522/minifia.git`) 성공, 로컬 HEAD 가 `origin/main` 과 같음(`ea924cf` 시점).

## 실기기 확인 (사람 몫, 통과 표시 안 함)

UAT 테스트 1~5·7 은 `/gsd-verify-work 2` 에서 사람이 한다. 목록은 HANDOFF.md 맨 위 항목에 있다 (고정 테이블·이름표 잘림/겹침, 공개 연출 팝·흔들림, 채팅 세 줄·이름표 반전·이모티콘, 360×640·390 폭 스크롤 없음과 짧은 화면, 채팅 내역 모달, 2초 간격 연속 전송, 방장 줄 없음). 배치 수치는 02-14·02-16·02-17 의 자동 검사가 지킨다.

## Deviations from Plan

None - plan executed exactly as written. (스크립트 실수로 인한 재실행 없음; 서버 동작은 모두 기대와 같았다.)

계획 acceptance 중 `grep -c ... 't === "chat"'` 은 1 이상 조건에 2 로 충족, `FULL_TOTAL_LIMIT_MS = 240_000` 1, `^\| 02-1[2-8] ·` 10줄, `day?.messages` 0, `"skip"`/`day.messages` (uat-day) 0, `"chat"` (uat-day) 2.

## Known Stubs

없음.

## Threat Flags

없음. T-02-48(배포본 chat·state 프레임 누출)은 스모크가 기존 토큰·role·주장 단언에 chat 프레임 키 허용 집합과 state 의 `messages`·`extendUsed` 부재를 더해 배포본에서 확인했고(5명·8명 통과), T-02-49(배포 계정)는 배포 직전 `wrangler whoami` 로 `dhkim1522@naver.com` 을 확인했다. 새 패키지 설치 없음.

## Self-Check: PASSED

- 파일 존재: scripts/smoke.mjs, scripts/uat-day.mjs, HANDOFF.md, 02-VALIDATION.md, 02-UAT.md, 02-UI-SPEC.md 모두 확인.
- 커밋 존재: 59c3363, b99354c, d4c6d55, e702143, ea924cf 모두 HEAD 의 조상.
- 배포 버전이 OLD_VERSION 과 다름, 스모크 5명·8명 `SMOKE OK full`, 봇 5명·8명 종료 코드 0.
