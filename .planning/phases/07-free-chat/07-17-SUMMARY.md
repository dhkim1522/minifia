---
phase: 07-free-chat
plan: "17"
subsystem: uat-scripts
tags: [uat, socket-scripts, free-chat, chat-channels, d5-limits, typing]

requires:
  - phase: 07-free-chat
    provides: "07-11 chat/typing/chatReject 와이어, 07-14 chatLog·누설 검사, 07-16 smoke/bots 자유 채팅 기준"
provides:
  - "uat-day: 자유 채팅 seq 틈 없음·D5 거절 셋·pk 불일치 거절·typing 프레임 확인"
  - "uat-night: 밤 마피아 chat(ch mafia)·typing, 탈락자 chat 은 ch ghost, 산 비마피아 밤 chat 은 chatReject phase"
  - "uat-vote: 누구나의 변론 chat(ch all), 종료 중 chat 은 chatReject{phase}"
  - "uat-test-room·uat-test-bots: claim 넘기기 제거, 봇 낮·밤 chat 줄이 고정 문구 목록 안 확인"
affects: [07-18, 07-20]

actuals:
  tokens: 40000
  tasks: 2
  commits: 2
plan_head_before: c5ce6fbefb4df6085f23271ef170d6087e43a90f
plan_head_after: 28e000579826b2f90e15cb943480fb57312be64e

tech-stack:
  added: []
  patterns:
    - "스크립트마다 작은 도우미(pkOf·sendChat·sendTyping)를 각자 둔다 — 스크립트끼리 import 하지 않는 관례 유지"
    - "거절은 보낸 폰에만 간다는 증명: 다른 폰의 chatReject·chat 프레임 수가 전송 전후로 같음"

key-files:
  created: []
  modified:
    - scripts/uat-day.mjs
    - scripts/uat-night.mjs
    - scripts/uat-vote.mjs
    - scripts/uat-test-room.mjs
    - scripts/uat-test-bots.mjs
    - .planning/phases/07-free-chat/deferred-items.md

key-decisions:
  - "uat-vote 의 역할 문자열 누출 검사에서 view.me.chat 경로를 허용하고, 대신 마피아가 아닌 사람 프레임에 me.chat 'mafia' 가 없는지를 따로 본다(채널 이름 mafia 가 역할 id 와 같은 글자)."
  - "마피아 봇의 밤 채팅은 60% 확률이라 오지 않아도 실패로 보지 않고, 오면 ch mafia·고정 밤 문구 안인지 본다."

patterns-established:
  - "UAT 스크립트의 옛 v1.0 전용 항목은 주석·건너뛰기로 남기지 않고 지우거나 자유 채팅 항목으로 바꾼다"

requirements-completed: [CHAT-02, CHAT-03, CHAT-06]

coverage:
  - id: D1
    description: "uat-day 가 자유 채팅 낮 시나리오를 실제 서버에서 확인한다(동시 전송 seq 틈 없음, D5 거절이 보낸 폰에만, pk 불일치 phase 거절, typing 프레임, 2일차 seq 이어짐)"
    requirement: CHAT-02
    verification:
      - kind: e2e
        ref: "node scripts/uat-day.mjs http://localhost:5173 --players 5 (17/17 통과)"
        status: pass
    human_judgment: false
  - id: D2
    description: "uat-night 가 밤 마피아 채널·탈락자 ghost 채널·산 비마피아 0건을 확인한다"
    requirement: CHAT-03
    verification:
      - kind: e2e
        ref: "node scripts/uat-night.mjs http://localhost:5173 (5명 41/41, --players 6 41/41)"
        status: pass
    human_judgment: false
  - id: D3
    description: "uat-vote·uat-test-room·uat-test-bots 가 주장·빠른 메시지·이모티콘 없이 돈다"
    requirement: CHAT-06
    verification:
      - kind: e2e
        ref: "node scripts/uat-vote.mjs (57/57), uat-test-room.mjs (27/27), uat-test-bots.mjs (46/46)"
        status: pass
      - kind: unit
        ref: "node --test scripts/*.test.mjs scripts/e2e/lib.test.mjs (280 pass), scripts/deploy-target.test.mjs (33 pass)"
        status: pass
    human_judgment: false

duration: 약 45min
completed: 2026-11-02
status: complete
---

# Phase 7 Plan 17: UAT 소켓 스크립트 자유 채팅 기준 전환 Summary

**v1.0 UAT 를 봇으로 대신 돌던 소켓 스크립트 다섯 개에서 주장·빠른 메시지·이모티콘 송신과 기대를 걷어내고, 자유 채팅 seq 연속성·D5 거절(보낸 폰에만)·typing 프레임·밤 마피아/ghost 채널·변론 누구나 chat·종료 중 chatReject 확인으로 바꿔 로컬 서버에서 모두 통과시켰다.**

## Performance

- **Duration:** 약 45분 (대부분 서버 타이머 대기: day 2분, night 3분, vote 8분 ×2, bots 2분)
- **Completed:** 2026-11-02
- **Tasks:** 2
- **Files modified:** 5 스크립트 + deferred-items.md

## Accomplishments

- `uat-day.mjs`: claim 응답기와 시험 3·8(차례·이월)을 지우고 시험 6 을 자유 채팅으로 바꿨다. 5명 동시 전송이 모든 폰(보낸 폰 포함)에 ch all 로 같은 seq 로 가고, D5 거절 셋(600ms 연달아 → rate, 같은 문장 3초 → repeat, 5초 창 6번째 → rate)은 보낸 폰에만 chatReject 로 오며 거절된 줄은 번호를 쓰지 않는다. pk 가 틀린 줄은 phase 거절, typing 은 보낸 폰을 뺀 모든 폰에 typing 프레임으로 가고 state 에 typing·messages 키가 없다. 2일차 토론 줄의 seq 가 이어진다. 단계 도착 시각 차이 표는 그대로 낸다(claim 단계만 뺌).
- `uat-night.mjs`: 낮 주장 차례 대기를 지우고 밤1 마피아 채팅을 chat(ch mafia)·typing 으로 바꿨다. 살아 있는 비마피아의 밤 chat·typing 은 0건, 산 비마피아(경찰)의 밤 chat 은 chatReject phase. 낮2 산 사람의 토론 chat 은 탈락자 포함 모든 폰에 ch all. 밤2 탈락자는 마피아 줄(ch mafia)을 받고 자기 줄은 ch ghost 로 자신에게만, 산 사람 프레임에는 0건이며 탈락자 pick 은 BAD_MESSAGE. 전체 검사로 chat 프레임 키가 ch·seat·seq·text·at 뿐이고 emoji·옛 주장·템플릿 키가 없음을 본다.
- `uat-vote.mjs`: claim 응답기·CLAIM 상수·claimLog 허용 경로를 지우고 변론을 후보·비후보 누구나의 chat(ch all)으로, 종료 중 say 를 chat → chatReject{phase}(다른 폰에 안 감)로 바꿨다.
- `uat-test-room.mjs`: claim 차례 넘기기 반복과 claimLog 확인을 지웠다(넘기기 한 번 = 단계 하나, 순서 표는 dayAnnounce → discussion).
- `uat-test-bots.mjs`: 봇 주장·claimLog·claim 넘기기 반복을 지우고, 낮 토론 봇 줄이 ch all·고정 문구 목록 안, 밤 마피아 봇 줄이 오면 ch mafia·고정 밤 문구 안, chat 프레임 키가 다섯뿐(봇 표시·수신자 없음)임을 본다. 봇 표시 누출 0, 일반 방·손님·시작 뒤 거부 확인은 그대로다(결정 0024).
- 다섯 스크립트 모두 `exitIfV1` 가드가 그대로이고 `deploy-target.test.mjs` 정적 확인이 통과한다.

## 실행 결과 표 (로컬 개발 서버 http://localhost:5173)

| 스크립트 | 결과 | 비고 |
| --- | --- | --- |
| `uat-day.mjs --players 5` | 17/17 통과, exit 0 | 약 1분 50초. 단계 도착 차이 전부 0ms(같은 PC) |
| `uat-night.mjs` (5명) | 41/41 통과, exit 0 | 약 3분 13초 |
| `uat-night.mjs --players 6` | 41/41 통과, exit 0 | 마피아 둘 경로(입력 중 수신) 보강 실행 |
| `uat-vote.mjs` | 57/57 OK, exit 0 | 약 8분. 첫 실행은 54/55 였고 아래 편차 1 로 고친 뒤 통과 |
| `uat-test-room.mjs` | 27/27 통과, UAT TEST-ROOM OK | 약 1분 |
| `uat-test-bots.mjs` | 46/46 통과, UAT TEST-BOTS OK | 약 2분. R2 밤 마피아 봇 줄 "그 사람으로 가요" 수신(ch mafia) |

원자료: `/private/tmp/claude-501/-Users-dhkim1522-personal-minifia/e6ad96d5-9479-4163-8cf1-7ea9e27810d6/scratchpad/07-17/` 의 day.txt·night.txt·night6.txt·vote.txt·room.txt·bots.txt.

로컬 서버: 07-16 이 띄운 서버(`npm run dev`, PID 9710 / vite PID 9732, 포트 5173)를 그대로 썼다. 이 계획이 띄운 서버는 없고 끄지도 않았다(07-18 이 끈다).

## Task Commits

1. **Task 1: uat-day·uat-night** - `aa7a4b1` (feat)
2. **Task 2: uat-vote·uat-test-room·uat-test-bots** - `28e0005` (feat)

**Plan metadata:** 이 SUMMARY·deferred-items.md·STATE·ROADMAP 커밋(docs)

## Files Created/Modified

- `scripts/uat-day.mjs` - 자유 채팅·D5 거절·typing·도착 시각 시나리오
- `scripts/uat-night.mjs` - 밤 마피아·탈락자 ghost 채널 시나리오
- `scripts/uat-vote.mjs` - 누구나 변론 chat, 종료 중 chatReject, me.chat 채널 검사
- `scripts/uat-test-room.mjs` - claim 넘기기 제거
- `scripts/uat-test-bots.mjs` - 봇 자유 채팅 줄 확인
- `.planning/phases/07-free-chat/deferred-items.md` - 닫힌 UAT 스크립트 항목 갱신(gallery.mjs 만 남음)

## Decisions Made

- `view.me.chat`(서버가 정한 내 채널 이름)은 `mafia` 가 역할 id 와 같은 글자라 uat-vote 의 역할 문자열 누출 검사에 걸린다. 경로를 허용하되 마피아가 아닌 사람의 프레임에 me.chat "mafia" 가 없는지 별도 검사를 더했다(누출 감지력은 유지).
- 마피아 봇의 밤 채팅은 60% 확률이므로 "이번 밤은 없음"도 통과로 보고, 오면 채널·본문을 엄격히 본다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] uat-vote 역할 문자열 누출 검사가 me.chat "mafia" 를 오탐**
- **Found during:** Task 2 (uat-vote 첫 실행 54/55)
- **Issue:** 새 view 필드 `me.chat`(07-11~)이 채널 이름 "mafia" 를 담아 `roleStringLeaks` 가 마피아 본인 프레임을 누출로 센다(스크립트 쪽 기준이 옛 것).
- **Fix:** `view.me.chat` 을 허용 경로에 넣고, `mafiaChannelLeaks` 로 마피아가 아닌 사람 프레임에 me.chat "mafia" 가 없는지를 두 판 모두의 ended 검사에서 본다.
- **Files modified:** scripts/uat-vote.mjs
- **Verification:** 다시 돌려 57/57 OK
- **Committed in:** 28e0005

**2. [Rule 2 - 추가 확인] 거절의 보낸-폰-한정 증명과 마피아 둘 경로 실행**
- 계획 문구("보낸 폰에만")를 수치로 증명하려고 다른 폰의 chatReject·chat 프레임 수가 전후로 같다는 검사를 넣었고, `uat-night --players 6`(마피아 둘, 입력 중 수신 경로)을 보강 실행했다. 계획된 항목의 구체화이며 범위 변화는 없다.

---

**Total deviations:** 1 auto-fixed (Rule 1 오탐 1), 보강 1
**Impact on plan:** 범위 변화 없음.

## Issues Encountered

- 없음(첫 uat-vote 실행의 오탐 1건만, 위 편차 1).
- 남은 orphan vitest 프로세스(PID 17093·17098·16956·17033)는 이 계획 것이 아니라 건드리지 않았다. 이 계획이 시작한 스크립트 프로세스는 모두 종료됐다.

## Known Stubs

없음.

## Threat Flags

없음. 새 네트워크 표면 없음(스크립트만 수정). T-07-45: 다섯 스크립트 모두 `exitIfV1` 호출이 그대로이고 `deploy-target.test.mjs` 33건 통과.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 07-18 이 이어서 돌 수 있다(웨이브 10 끝에 로컬 서버를 끈다). 배포본 UAT 실행(`--prod`)은 이 계획 범위가 아니다.
- 남은 이월: `scripts/gallery.mjs`(화면 갤러리의 emoji 언급)와 프레임 단위 E2E 는 07-20 몫이다.

## Self-Check: PASSED

- 수정 파일 5개와 이 SUMMARY 존재 확인, 커밋 aa7a4b1·28e0005 가 HEAD 의 조상이다.
- acceptance: `grep -n -E 't: "(claim|say|emoji)"|claimLog|day\.turn'` 다섯 파일 0건(grep 종료 1), `node --check` 다섯 개 통과, `node --test scripts/*.test.mjs scripts/e2e/lib.test.mjs` 280 pass·0 fail, 로컬 실행 결과 표 위와 같음.

---
*Phase: 07-free-chat*
*Completed: 2026-11-02*
