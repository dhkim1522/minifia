---
phase: 07-free-chat
plan: "16"
subsystem: dev-scripts-verification
tags: [smoke, bots, perf, chatload, chat, chatLog, chatReject, typing, node-websocket, playwright-core]

requires:
  - phase: 07-free-chat
    provides: "07-10~07-14 서버 채팅 와이어(chat·typing·chatLog·chatReject, audience 채널, D5 제한, 재접속 복원), 07-13 제품 로비 ChatPanel"
provides:
  - "scripts/smoke.mjs full: 주장 없는 한 판 낮 한 바퀴 + 로비·낮·밤·탈락자 채널 도달 범위, 600ms 거절, 입력 중, 재접속 chatLog 복원 확인 (기본 create 단계·배포 확인 명령 node scripts/smoke.mjs --prod 그대로)"
  - "scripts/bots.mjs: 고정 문구 자유 채팅 손 봇 + --chat <초> 로비 채팅 부하"
  - "scripts/perf-run.mjs --mode chatload (--bots, --minutes, --throttle, --dpr): 제품 로비 채팅 부하 하 rAF fps 측정, 결과 .planning/phases/07-free-chat/perf/chatload-{크기}-x{감속}.json"
affects: [07-17, 07-18, 07-20, 07-21]

actuals:
  tokens: 21800
  tasks: 3
  commits: 4
  plan_head_before: ada40829a2def07a68e52cc10d04486350b1c29d
  plan_head_after: 53ab58c51f490e4745e2a6fc0835710118fabf21

tech-stack:
  added: []
  patterns:
    - "소켓 스크립트의 단계 키(pk)는 받은 마지막 state 의 `${day.n ?? 0}:${phase}` 로 만든다(audience.phaseKey 와 같은 모양)"
    - "재접속 복원 확인은 '그 클라이언트가 실시간·지난 chatLog 로 이미 받은 줄(채널별 최근 30)과 정확히 같은가' 로 한다 — 복원이 라이브보다 넓어지지 않는다는 것을 한 식으로 본다"
    - "거절은 클라이언트별 기대 목록(expectedRejects)에 쌓아 두고 끝에서 실제 chatReject 프레임과 맞춘다 — 보낸 쪽에만 갔는지 한 번에 본다"
    - "성능 측정 스크립트는 판정하지 않고 숫자와 baseline 칸만 남긴다. 대조 측정(--bots 0)을 같은 환경에서 같이 돌려 원인을 가른다"

key-files:
  created:
    - .planning/phases/07-free-chat/perf/chatload-390x844-x1.json
    - .planning/phases/07-free-chat/perf/chatload-390x844-x4.json
    - .planning/phases/07-free-chat/perf/chatload-390x844-x4-run2.json
    - .planning/phases/07-free-chat/perf/chatload-390x844-x4-control.json
  modified:
    - scripts/smoke.mjs
    - scripts/bots.mjs
    - scripts/perf-run.mjs
    - .planning/phases/07-free-chat/deferred-items.md

key-decisions:
  - "smoke full 의 옛 직업 문자열 검사(collectClaimStringPaths)는 지우되 역할 이름 누설 검사 자체는 collectRoleStringPaths 로 남겼다. 채널 이름 mafia 가 든 ch·lines[].ch·view.me.chat 경로만 따로 허용하고 그 경로의 누설은 채널 도달 단언이 맡는다"
  - "smoke 의 SERVER_ONLY_KEYS 에 옛 claim 키·claimLog·turn 과 채팅 서버 전용 키(chatRates·typingRelays·nextSeq)를 넣어, 옛 키가 와이어에 다시 나오면 회귀로 잡는다"
  - "chatload 에서 --bots 0 을 허용해 채팅 없는 대조 측정을 같은 환경에서 돌릴 수 있게 했다(계획은 기본 7만 적었다)"
  - "측정이 기준에 못 미쳐도 baseline(55fps·끊김 5회/5분)을 낮추지 않고 숫자를 그대로 남겼다(계획의 prohibition)"

patterns-established:
  - "chat 줄·chatLog·typing·chatReject 프레임의 키 허용 목록 검사를 스모크가 모든 프레임에 건다(id·역할·토큰·수신자 마스크 없음)"

requirements-completed: [CHAT-01, CHAT-02, CHAT-03, CHAT-06]

coverage:
  - id: D1
    description: "smoke full 이 주장 단계 없이 한 판 낮 한 바퀴(로비 채팅 → 낮 시작 발표 → 낮 토론 → 처형 여부 투표(미통과) → 밤 → 아침 → 2일차 낮 시작 발표)를 돌고, 낮 토론 줄은 모든 클라이언트에 ch all·seq 틈 없이(보낸 사람 포함) 간다"
    requirement: "CHAT-01"
    verification:
      - kind: e2e
        ref: "node scripts/smoke.mjs http://localhost:5173 --stage full --players 5 (SMOKE OK full) · --players 6 (SMOKE OK full)"
        status: pass
    human_judgment: false
  - id: D2
    description: "밤 마피아 chat·typing 은 마피아에게만 가고 시민 편 클라이언트는 chat·typing 0건, 시민의 밤 chat 은 보낸 쪽에만 chatReject{phase}, 탈락자 줄은 ch ghost 로 탈락자에게만 간다"
    requirement: "CHAT-02"
    verification:
      - kind: e2e
        ref: "node scripts/smoke.mjs http://localhost:5173 --stage full --players 5|6 (채널 도달 단언)"
        status: pass
    human_judgment: false
  - id: D3
    description: "600ms 안 두 번째 전송은 보낸 클라이언트에만 chatReject{rate}, 재접속하면 hello 직후 chatLog 로 자기가 받았던 줄만 돌아온다(산 시민 재접속에 mafia 줄 0, 마피아는 밤 마피아 줄 포함)"
    requirement: "CHAT-03"
    verification:
      - kind: e2e
        ref: "node scripts/smoke.mjs http://localhost:5173 --stage full --players 5|6 (거절 기대 목록·reconnectAndReplay)"
        status: pass
    human_judgment: false
  - id: D4
    description: "smoke 가 say·emoji·claim 을 보내지 않고 claimLog·turn 키를 기대하지 않으며, 프레임 키 허용 목록(chat·typing·chatReject·chatLog)을 검사한다. 기본 create 단계와 배포 확인 명령은 그대로 돈다"
    requirement: "CHAT-06"
    verification:
      - kind: other
        ref: "grep -n -E 't: \"(claim|say|emoji)\"' scripts/smoke.mjs scripts/bots.mjs (0건) · node scripts/smoke.mjs http://localhost:5173 (SMOKE OK create) · node --test scripts/*.test.mjs scripts/e2e/lib.test.mjs (280 통과)"
        status: pass
    human_judgment: false
  - id: D5
    description: "손 봇이 자유 채팅을 하고(낮 토론·밤 마피아·변론 후보) --chat <초> 로 로비 채팅 부하를 만든다"
    requirement: "CHAT-01"
    verification:
      - kind: other
        ref: "bots.mjs --count 3 --chat 2 20초 실행 → 브라우저 로비 기록 칸에 봇 3명 줄 30개(playwright-core 확인 스크립트), 소켓 관찰기 21초 chat 31줄·typing 켜짐 29·꺼짐 28·막힘 0"
        status: pass
    human_judgment: false
  - id: D6
    description: "perf-run --mode chatload 가 제품 로비에서 채팅 부하 하 평균 fps·끊김·p95 를 JSON 으로 남긴다. 6페이즈 기준(55fps·끊김 5회/5분) 대비 결과는 판정 없이 기록"
    requirement: "CHAT-01"
    verification:
      - kind: other
        ref: "node scripts/perf-run.mjs --mode chatload --url http://localhost:5173 --minutes 1 --throttle 1 --bots 3 → chatload-390x844-x1.json (frames.avgFps·jank·p95 키 있음), v1.0 주소는 종료 1"
        status: pass
    human_judgment: false
  - id: D7
    description: "채팅 부하 하 로비 fps 가 6페이즈 기준에 닿는지(UI-SPEC 로비 성능 확인 항목)"
    verification: []
    human_judgment: true
    rationale: "로컬 개발 서버·1분 측정은 53.5fps·끊김 29·43회로 기준 아래였다(대조 60fps·끊김 0). 판정은 배포본 5분 측정으로 07-21 에서 사용자에게 보인다(계획 prohibition)"

duration: 25min
completed: 2026-11-02
status: complete
---

# Phase 7 Plan 16: 배포본 검증 스크립트 자유 채팅 기준 전환 Summary

**smoke full·손 봇을 chat·typing·chatReject·chatLog 기준으로 다시 쓰고, perf-run 에 제품 로비 채팅 부하 fps 측정(--mode chatload)을 더했다 — 로컬에서 채팅 부하가 걸리면 로비가 53.5fps·끊김 29~43회(대조 60fps·0회)로 나온다.**

## Performance

- **Duration:** 약 25분
- **Started:** 2026-11-01T15:20:00Z (근사)
- **Completed:** 2026-11-01T15:46:00Z (근사)
- **Tasks:** 3
- **Files modified:** 3 스크립트 + 측정 원자료 8개 + deferred-items.md

## Accomplishments

- **smoke full:** 주장 차례·say·emoji 를 모두 지우고 한 판 낮 한 바퀴를 자유 채팅 기준으로 다시 썼다. 로비 채팅 한 줄, 낮 토론 줄(ch all·seq 1~4 틈 없음·전원 동일·보낸 사람에게도 돌아옴), 같은 순간 두 번째 줄의 chatReject{rate}(보낸 클라이언트에만, 본문 표식은 어느 프레임에도 없음), 입력 중 켜짐·꺼짐 도달, 밤 마피아 chat·typing(시민 편 0건)·시민의 밤 chat 에 chatReject{phase}, 아침 탈락자 줄(ch ghost 는 탈락자에게만), 재접속 chatLog 복원(산 시민 4줄 전부 ch all, 마피아는 밤 줄 포함)을 확인한다. 5명·6명 판 모두 `SMOKE OK full`(약 1분 48초). 기본 create 단계와 `--prod` 배포 확인 명령은 그대로다.
- **bots.mjs:** 직업 주장·이모티콘·빠른 메시지를 지우고 낮 토론 50% 고정 문구 한 줄, 밤 마피아 가끔 한 줄, 변론 후보 한 줄을 자유 채팅으로 보낸다(단계 키는 받은 state 로). `--chat <초>`(1~600)는 로비에서 봇마다 간격(±30%)으로 입력 중 켜짐 → 1초 뒤 chat → 꺼짐을 보낸다. 실제 게임(4명, 봇 3)에서 토론·변론 줄이 들어갔고 chatReject 는 0건.
- **perf-run --mode chatload:** 제품 로비(`?e2e=1`)를 CPU 감속·DPR 아래 열고 소켓 봇 N명이 2초마다 입력 중 → chat → 꺼짐을 보내는 동안 rAF 간격을 재 평균 fps·끊김(>50ms)·p50/p95/p99/최장·받은 줄 수를 JSON 으로 남긴다. 6페이즈 기준은 JSON `baseline` 칸에만 적고 판정하지 않는다.

### 측정 숫자 (로컬 개발 서버, CPU 4배, DPR 2, 390x844, 1분 — 07-21 판정 입력)

| 실행 | 봇 | 평균 fps | 끊김(>50ms) | p95 | 최장 |
|------|----|---------|-------------|-----|------|
| x4 | 7명(chat 210줄) | 53.5 | 29 | 33.4ms | 83.4ms |
| x4-run2 | 7명(chat 210줄) | 53.5 | 43 | 33.4ms | 66.8ms |
| x4-control | 0명 | 60.0 | 0 | 16.7ms | 16.8ms |
| x1 (동작 확인) | 3명(chat 90줄) | 60.0 | 0 | 16.7ms | 16.8ms |

기준(5분 평균 55fps·끊김 5회)은 낮추지 않았다. 채팅 부하가 있는 쪽이 기준 아래이고 같은 환경 대조는 60fps 라 채팅 줄·입력 중 처리 비용이 원인일 가능성이 크다. 다만 개발 서버(번들 안 줄임)이고 측정 중 다른 프로세스가 코어를 쓰고 있었으니(아래 참고) 배포본 5분 측정이 판정 입력이다. 기록 칸은 7명 부하에서 보관 상한 100줄에 닿았다.

## Task Commits

1. **Task 1: smoke full 자유 채팅 기준** - `cc4b87d` (feat)
2. **Task 2: 손 봇 자유 채팅 + --chat 부하** - `59476af` (feat)
3. **Task 3: perf-run --mode chatload** - `25fec06` (feat)
4. **측정 원자료** - `53ab58c` (docs)

**Plan metadata:** 이 SUMMARY 와 STATE·ROADMAP·REQUIREMENTS 를 담은 docs 커밋(아래 금방 생김)

## Files Created/Modified

- `scripts/smoke.mjs` - full 단계를 자유 채팅 기준으로 재작성(프레임 키 허용 목록·채널 도달·거절·재접속 복원), 로컬에서는 배포본 전용 하루 캐시 헤더를 보지 않음
- `scripts/bots.mjs` - 자유 채팅 봇 + `--chat <초>` 로비 부하
- `scripts/perf-run.mjs` - `--mode chatload`, `--bots`, `frameStats`(순수 함수, export), 결과 저장
- `.planning/phases/07-free-chat/perf/chatload-390x844-x*.{json,png}` - 로컬 1분 측정 원자료
- `.planning/phases/07-free-chat/deferred-items.md` - 닫힌 항목·남은 스크립트·로컬 캐시 헤더 조정·채팅 부하 fps 첫 측정 기록

## Decisions Made

- 역할 이름 누설 검사는 지우지 않고 `collectRoleStringPaths` 로 남겼다(허용 경로: `view.me.role`·`view.day.roles[]`·`view.spectate.seats[].job`, 채널 이름 mafia 를 담는 `ch`·`lines[].ch`·`view.me.chat`).
- `SERVER_ONLY_KEYS` 에 `claimLog`·`turn` 과 채팅 서버 전용 키를 넣어 옛 키가 다시 나오면 잡는다.
- chatload `--bots 0` 허용(대조 측정). 계획에는 기본 7 만 있었다.
- 사용자 위임에 따른 추천안 선택: 해당 없음(checkpoint:decision 없음).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 로컬 smoke full 이 배포본 전용 Cache-Control 검사에서 실패**
- **Found during:** Task 1 (로컬 `--stage full` 첫 실행, 채팅 단언은 모두 통과한 뒤 에셋 단계에서)
- **Issue:** 인물 그림·배경 WebP 의 `Cache-Control: max-age=86400` 은 배포본 Workers 정적 에셋 헤더인데 로컬 vite 개발 서버는 `no-cache` 를 준다. 계획의 검증 명령(`smoke.mjs http://localhost:5173 --stage full`)이 이 검사에서 항상 실패했다(이 검사는 이전부터 있었다).
- **Fix:** 두 검사에 `!isLocal` 조건을 붙였다(localhost·127.0.0.1 에서는 건너뜀, 배포본에서는 그대로 본다). 주석에 이유를 적었다.
- **Files modified:** scripts/smoke.mjs
- **Verification:** 로컬 full 5명·6명 `SMOKE OK full`
- **Committed in:** cc4b87d

**2. [Rule 2 - 보강] chatload 대조 측정용 `--bots 0` 허용**
- **Found during:** Task 3 (채팅 부하 측정이 기준 아래로 나왔을 때 원인을 가르려고)
- **Issue:** 계획의 `--bots` 는 1 이상이라 채팅 없는 대조를 같은 스크립트로 못 돌린다.
- **Fix:** 최소값을 0 으로 낮추고 사용법 주석에 대조 용도를 적었다. 판정 로직은 여전히 없다.
- **Files modified:** scripts/perf-run.mjs
- **Verification:** `--bots 0 --file chatload-390x844-x4-control` 60fps·끊김 0 으로 정상 저장
- **Committed in:** 25fec06 (같은 파일을 Task 3 커밋에 함께)

---

**Total deviations:** 2 auto-fixed (Rule 3 1건, 보강 1건)
**Impact on plan:** 둘 다 계획의 검증 명령·측정 해석에 필요했다. 범위 확장 없음.

## Issues Encountered

- 이 환경에는 `timeout` 명령이 없어(macOS) 봇 시간 제한 실행은 백그라운드 + SIGINT 로 했다.
- 측정 중 이전 세션에서 남은 vitest 프로세스 둘(PID 17093·17098, CPU 약 100% 씩, 누적 2시간 이상)이 코어를 쓰고 있었다. 이 계획의 것이 아니라 건드리지 않았다. 채팅 부하 측정 숫자에 섞였을 수 있으나 같은 환경의 대조(60fps)가 정상이라 채팅 부하 차이는 남는다. 배포본·조용한 환경 재측정을 권한다.
- 이 실행에서 알려진 flaky 시험(bots.test 밤 마피아 봇)은 건드리지 않았다. 전체 단위 시험(vitest test/unit 1852)과 `node --test scripts/*.test.mjs scripts/e2e/lib.test.mjs`(280) 통과.

## Auth Gates

없음.

## Known Stubs

없음.

## Threat Flags

없음 — 스크립트가 새 서버 표면을 만들지 않았다. T-07-42(대상 주소): 세 스크립트 모두 `exitIfV1` 유지(`scripts/deploy-target.test.mjs` 통과, v1.0 주소로 chatload 를 돌리면 종료 1). T-07-44: 채팅 본문·토큰은 출력하지 않는다(봇은 chatReject 이유만 한 줄). T-07-SC: 패키지를 설치하지 않았다.

## 로컬 개발 서버

GSD 가 띄움 · PID 9710 (`npm run dev`, 실제 vite·로컬 workerd 서버는 PID 9732, 포트 5173). 끄지 않았다 — 07-17 이 확인만 하고 07-18 이 마지막 검증 뒤 끈다. 로그: 저장소 밖 임시 폴더(`.../scratchpad/07-16/dev.log`).

## 로비 기록 칸 관찰 기록 (Task 2 acceptance)

로컬 개발 서버에 방을 하나 만들고 `node scripts/bots.mjs <코드> --count 3 --chat 2 http://localhost:5173` 를 20초 돌렸다. 헤드리스 Chrome 390x844 로비의 기록 칸(`[data-chat-log] .mv-chat__msg`)에 봇 3명(`봇가나다라마바사`·`봇아자차카타파하`·`봇갸냐댜랴먀뱌샤`)의 줄 30개가 쌓였다(대화 속도 약 1.5줄/초 = 3명 × 2초 간격 ±30%).

## Next Phase Readiness

- 07-17: 남은 옛 스크립트(uat-day·uat-night·uat-vote·uat-test-bots·gallery)는 deferred-items.md 에 정리했다. 로컬 서버는 켜져 있다.
- 07-21: 채팅 부하 fps 판정 입력(위 표)과 재측정 권고를 넘긴다.

## Self-Check: PASSED

- 파일: scripts/smoke.mjs·scripts/bots.mjs·scripts/perf-run.mjs·chatload-390x844-x4.json 모두 존재
- 커밋: cc4b87d·59476af·25fec06·53ab58c 모두 HEAD 의 조상
- 수락 기준: `t: "(claim|say|emoji)"` grep 0건(smoke·bots), `"chatLog"`·`"chatReject"` 존재, `--chat`·`exitIfV1` 존재, `"chatload"` 존재, create 단계 exit 0, full 5·6명 통과, chatload JSON 에 avgFps·jank·p95 키

---
*Phase: 07-free-chat*
*Completed: 2026-11-02*
