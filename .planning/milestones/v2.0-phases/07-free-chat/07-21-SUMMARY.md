---
phase: 07-free-chat
plan: "21"
subsystem: deploy-verification
tags: [cloudflare-workers, deploy-guard, e2e, perf, docs, ios-device-check]

requires:
  - phase: 07-free-chat
    provides: "07-20 E2E 하네스 정리와 전체 초록, 07-16 chatload·smoke 도구, 07-17 uat 스크립트"
provides:
  - "minifia-v2 배포본 (+4147d32) — 7페이즈 채팅 결과물, health 해시 일치"
  - "배포본 smoke(create·full)·E2E chat 5개 흐름 전부 통과, 채팅 부하 5분(Chrome CPU 4x·DPR 2·봇 7) 평균 60.00fps·끊김 0"
  - "docs/screen-map.md 7페이즈 기준(채팅 패널 치수·검사 계약·알려진 한계), docs/architecture.md 채팅 문단(결정 0058)"
  - "07-DEVICE-CHECKS.md: 자동 결과 표 A·B, 기기 표 C·D, 이월 후보 행, 사용자 아침 확인 절차"
affects: [07-22, verify-work-7, phase-9-team-test]

actuals:
  tokens: 8600
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "배포 검증: npm run deploy 가드 체인 → health 해시 → smoke → E2E → chatload 순서 (06-19 선례 그대로)"
    - "chatload 결과는 --file 로 이름을 달리해 기존 로컬 측정 JSON 을 덮어쓰지 않는다"

key-files:
  created:
    - .planning/phases/07-free-chat/07-DEVICE-CHECKS.md
    - .planning/phases/07-free-chat/perf/chatload-prod-390x844-x4-dpr2.json
    - .planning/phases/07-free-chat/perf/chatload-prod-390x844-x4-dpr2.png
  modified:
    - docs/screen-map.md
    - docs/architecture.md
    - .planning/phases/07-free-chat/deferred-items.md

key-decisions:
  - "chatload 배포본 결과를 chatload-prod-390x844-x4-dpr2 로 따로 저장 — 07-16 로컬 측정(chatload-390x844-x4*.json)을 보존"
  - "Task 3(iPhone 실기기)은 자동 승인하지 않고 미확인 — 사용자 확인 대기로 기록, 계획은 대기 없이 마무리"
  - "낮 시작 문구(옛 직업 공개 문장)는 사용자에게 물을 수 없어 코드 변경 없이 안만 deferred-items 에 남김"

patterns-established:
  - "사람 확인 칸은 '대기' 로 두고 합격으로 세지 않는다 — 이월 후보 행은 '미확인 — 9페이즈 팀 테스트 이월 후보'"

requirements-completed: [CHAT-01, CHAT-02, CHAT-03, CHAT-04, CHAT-05, CHAT-06]

coverage:
  - id: D1
    description: "페이즈 결과물이 가드 체인으로 minifia-v2 에 배포되고 /api/health version 이 이 커밋 해시(4147d32)와 일치한다"
    requirement: "CHAT-01"
    verification:
      - kind: other
        ref: "npm run deploy ; curl -s https://minifia-v2.dhplay.workers.dev/api/health | grep -q 4147d32"
        status: pass
    human_judgment: false
  - id: D2
    description: "배포본에서 smoke(create·full)와 E2E chat 5개 흐름(chat-lobby·chat-keyboard·chat-table·chat-ime·chat-ghost)이 통과한다"
    requirement: "CHAT-06"
    verification:
      - kind: e2e
        ref: "node scripts/smoke.mjs --prod ; node scripts/smoke.mjs --prod --stage full ; npm run e2e -- --only chat"
        status: pass
    human_judgment: false
  - id: D3
    description: "채팅 부하(봇 7명 2초마다 채팅·입력 중) 5분 평균 fps 가 데스크톱 Chrome CPU 4x·DPR 2 에서 6페이즈 기준(55fps·끊김 5회)을 넘는다"
    requirement: "CHAT-04"
    verification:
      - kind: automated_ui
        ref: "node scripts/perf-run.mjs --mode chatload --minutes 5 --throttle 4 --dpr 2 --bots 7 → perf/chatload-prod-390x844-x4-dpr2.json (60.00fps, jank 0)"
        status: pass
    human_judgment: true
    rationale: "결정 0055: 고사양 Mac 숫자만으로 채팅 부하 성능 통과를 선언하지 않는다. iPhone 16 Pro 체감·열감(사용자 확인 대기)과 함께 판정해야 한다"
  - id: D4
    description: "docs/screen-map.md·architecture.md 가 7페이즈 채팅 패널·검사 계약·알려진 한계·audience/deliver/chat: 보관을 적는다"
    requirement: "CHAT-06"
    verification:
      - kind: other
        ref: "grep data-chat-panel / LOG_H + 154 / 결정 0058 / 카카오톡 인앱 Android (Task 1 automated verify)"
        status: pass
    human_judgment: false
  - id: D5
    description: "iPhone 16 Pro(Safari·iOS용 Chrome) 합격 검사 1~7·한글 IME·?chat-mock=1 다섯 줄·머리 위 '…'·5분 채팅 부하 체감"
    verification: []
    human_judgment: true
    rationale: "Task 3 은 checkpoint:human-verify gate=blocking-human — 사용자 실기기 확인이 필요하고 자동 승인 불가. 사용자가 자는 중이라 미확인 — 사용자 확인 대기 (아침 /gsd-verify-work 7)"
  - id: D6
    description: "Android Chrome·삼성 인터넷·카카오톡 인앱(iOS·Android) 행은 미확인 이월 후보로 남고 합격으로 세지 않는다"
    verification: []
    human_judgment: true
    rationale: "폰이 없어 확인 불가(사용자 결정 5) — 검증 때 9페이즈 팀 테스트 이월 여부를 사용자에게 묻는다"

duration: 13min
completed: 2026-11-02
plan_head_before: a8a534aaa480e2bc29c6e16f919534c9be151fc4
plan_head_after: 347a6f58ca48d1e96a4aa6154fa222985cf09115
status: complete
human_verification: pending
---

# Phase 7 Plan 21: 배포본 확인과 기기 확인 문서 Summary

**가드 체인으로 minifia-v2(+4147d32)에 배포해 배포본 smoke·E2E chat 494항목 전부 통과·채팅 부하 5분 평균 60.00fps(끊김 0)를 확인하고, 화면 지도·구조 문서를 7페이즈로 고쳤으며, iPhone 실기기 확인(Task 3)은 자동 승인 없이 "사용자 확인 대기"로 남겼다**

## 상태 한 줄 (중요)

**Task 3 (iPhone 16 Pro 실기기 확인)은 통과가 아니라 사용자 확인 대기다.** `checkpoint:human-verify gate="blocking-human"` 은 자동 승인할 수 없고 사용자가 자는 중이라 답을 받지 못했다. `07-DEVICE-CHECKS.md` 의 모든 Task 3 항목(검사 1~7·한글 IME·테이블·"…"·5분 채팅 부하·`?chat-mock=1`)은 "미확인 — 사용자 확인 대기 (아침 `/gsd-verify-work 7`)" 로 적혀 있고, 같은 문서 맨 아래에 사용자가 그대로 따라 할 단계와 명령(`node scripts/bots.mjs <방 코드> --count 7 --prod --chat 2`)이 있다. 성공 기준 3 의 실기기 몫은 이 확인이 끝날 때까지 열려 있다.

## Performance

- **Duration:** 13 min
- **Started:** 2026-11-01T18:01:54Z
- **Completed:** 2026-11-01T18:15Z (KST 2026-11-02 새벽)
- **Tasks:** 2 완료 + Task 3 사용자 확인 대기
- **Files modified:** 6 (문서 3 + 기기 확인 문서 1 + perf 결과 2)

## Accomplishments

- **화면 지도·구조 문서 7페이즈 반영(Task 1):** `docs/screen-map.md` 가 하단 패널 `LOG_H + 92`(188·244, 변론 칩 236 삭제)·로비 아래 패널 `LOG_H + 154`(250·306, 키보드 열림 150)·새 스테이지 사각형 표(키보드 열림 K=336 값 포함)·검사 계약(`data-chat-panel`·`-channel`·`-log`·`-input`·`-send`·`-notice`·`-newdot`·`data-seat`·`data-ch`·`data-typing`·`data-kb-open`)·알려진 한계 두 줄을 적고 이모티콘 60+·주장 차례 말풍선·주장 채팅 줄 문장을 지웠다. 07-20 이 바꾼 장면 압축 하한(299 → 303)도 맞췄다. `docs/architecture.md` 에 audience·deliver·`chat:` 보관 문단(결정 0058)을 더했다.
- **기기 확인 문서(Task 1):** `07-DEVICE-CHECKS.md` 표 A(배포본 자동)·B(채팅 부하)·C(기기 × 검사 1~7+IME)·D(`?chat-mock=1`)·알려진 한계·검사 실패 순서. Android Chrome·삼성 인터넷·카카오톡 인앱(iOS·Android) 4행은 모든 칸을 "미확인 — 9페이즈 팀 테스트 이월 후보" 로 두었다(합격으로 세지 않음).
- **가드 체인 배포(Task 2):** `npm run deploy` 1회 — 계정 확인 `dhkim1522@naver.com` → `vite build` → `배포 대상 확인: minifia-v2 (https://minifia-v2.dhplay.workers.dev)` → `Uploaded minifia-v2`, Version ID `2b9d6cbe-6c0a-440a-b1ea-9e6bfda6a0ec`. `/api/health` = `2026-11-01T18:04:02Z+4147d32` (HEAD 와 일치, 07-20 `dayTable.ts` 수정 포함). v1.0 주소에는 어떤 요청도 보내지 않았다.
- **배포본 자동 확인(Task 2):** `smoke.mjs --prod` OK, `--stage full` OK(자유 채팅 seq 연속·마피아·탈락자 채널 도달·재접속 복원 포함), `npm run e2e -- --only chat` 92초 `E2E OK` 실패 0 — chat-lobby 6크기 각 23/23, chat-keyboard 22~23/22~23, chat-table 6크기 각 33/33, chat-ime 10/10, chat-ghost 13/13.
- **채팅 부하(Task 2):** 배포본 로비, 390×844, DPR 2, CPU 4×, 봇 7명(채팅 1,049줄·입력 중 1,050회·막힘 0): 5분 평균 **60.00fps**·끊김(>50ms) **0**·p50 16.7ms·p95 16.7ms·최장 16.8ms, 첫 1분→끝 1분 60.00→60.00, 기록 칸 100줄 유지, 렌더 예산 변화·자동 강등 없음. 6페이즈 기준(55fps·끊김 5회)을 낮추지 않고 통과. 측정 중 다른 부하: 이전 세션의 고아 vitest 워커 둘(PID 17093·17098)이 CPU 를 쓰고 있었고(로드 평균 약 7.5) 그 상태에서도 통과했으므로 불리한 쪽의 조건이었다. 이 판정은 조건 B(데스크톱 Chrome)만의 것이며 iPhone 조건 A 와 함께 본다(결정 0055).

## Task Commits

1. **Task 1: 화면 지도·구조 문서와 기기 확인 문서 틀** — `4147d32` (docs)
2. **Task 2: 가드 체인 배포 → 배포본 smoke·E2E chat·채팅 부하** — `23709e9` (docs; 결과 기록·perf 원자료. 배포 자체는 코드 변경이 없는 `npm run deploy`)
3. **Task 3: iPhone 실기기 확인** — 커밋 없음. 사용자 확인 대기 기록과 절차는 `23709e9` 의 `07-DEVICE-CHECKS.md` 에 함께 들어 있다(같은 파일이라 분리하지 않음)
4. **deferred-items 정리** — `347a6f5` (docs)

**Plan metadata:** 이 SUMMARY 와 STATE·ROADMAP 갱신 커밋(별도)

## Files Created/Modified

- `docs/screen-map.md` — 7페이즈 채팅 패널 치수·스테이지 표·검사 계약·알려진 한계, 옛 이모티콘·주장 문장 삭제
- `docs/architecture.md` — 채팅(이벤트 프레임) 문단, audience·deliver·`chat:` 보관(결정 0058)
- `.planning/phases/07-free-chat/07-DEVICE-CHECKS.md` — 표 A~D, 이월 후보, 알려진 한계, 사용자 아침 절차
- `.planning/phases/07-free-chat/perf/chatload-prod-390x844-x4-dpr2.json`·`.png` — 배포본 채팅 부하 원자료·스크린샷
- `.planning/phases/07-free-chat/deferred-items.md` — 07-21 정리·남긴 항목

## Decisions Made

- 배포본 chatload 결과를 `--file chatload-prod-390x844-x4-dpr2` 로 따로 저장해 07-16 로컬 측정 JSON 4개를 덮어쓰지 않았다(원자료 보존, `chatload-*.json` glob 은 충족).
- Task 3 은 자동 승인하지 않고 "미확인 — 사용자 확인 대기"로 기록했다(사용자 결정 6, golden rule: blocking-human 은 모든 모드에서 사람 확인). 사용자 위임에 따른 추천안 선택 대상(checkpoint:decision)은 이 계획에 없었다.
- 낮 시작 문구(옛 직업 공개 문장)는 사용자 확인 사항이라 이 계획에서 고치지 않고 안만 남겼다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - 문서 정확성] screen-map 의 장면 압축 하한 값 갱신**
- **Found during:** Task 1
- **Issue:** `docs/screen-map.md` 가 "장면 높이 299 미만" 이라 적었으나 07-20 이 `TABLE_FIT_MIN_H` 를 303 으로 올렸다(이름표 상자 26 기준).
- **Fix:** 303 으로 고치고 07-20 이유를 덧붙임.
- **Files modified:** `docs/screen-map.md`
- **Committed in:** `4147d32`

**2. [Rule 2 - 원자료 보존] chatload 결과 파일 이름 분리**
- **Found during:** Task 2
- **Issue:** 계획 명령 그대로 돌리면 기본 이름 `chatload-390x844-x4.json` 이 07-16 로컬 측정 결과를 덮어쓴다(deferred-items 의 판정 입력 원자료).
- **Fix:** `--file chatload-prod-390x844-x4-dpr2` 추가. 측정 조건(5분·CPU 4×·DPR 2·봇 7)은 계획 그대로.
- **Committed in:** `23709e9`

---

**Total deviations:** 2 auto-fixed (1 문서 정확성, 1 원자료 보존)
**Impact on plan:** 범위 확대 없음.

## Authentication Gates

없음. `check-account.mjs` 가 개인 Cloudflare 계정(`dhkim1522@naver.com`)을 찍었고 배포가 바로 진행됐다.

## Issues Encountered

- 자동 확인에서 실패한 항목은 없다. `chat-ghost` 의 G2 는 결정 0056 승인 완화(G2-8ch)가 1건 적용됐다(기존 동작).
- 기계 부하: 고아 vitest 워커 둘이 계속 CPU 를 쓰고 있었으나(내 것이 아니어서 건드리지 않음) 측정 결과는 기준을 넘었다.
- 개발 서버는 띄우지 않았고 포트 5173 은 닫혀 있음을 확인했다.

## Known Stubs

없음. (문서·측정 결과만 변경.)

## Threat Flags

없음. 새 네트워크 표면·권한 경로·스키마 변경 없음. T-07-52(배포 v1 덮어쓰기)는 가드 체인과 출력의 Worker 이름 `minifia-v2` 확인으로 mitigate, T-07-53 은 07-DEVICE-CHECKS.md 에 자동 결과·미확인 행을 그대로 남겨 mitigate, T-07-SC 는 패키지 설치 없음.

## Deferred / 남은 항목

- **Task 3 (사용자 iPhone 확인)** — 아침 `/gsd-verify-work 7` 에서 사용자가 `07-DEVICE-CHECKS.md` 맨 아래 절차대로 확인하고 표 B 조건 A·표 C·표 D·"…" 칸을 채운다. 합격 선언과 성공 기준 3 의 실기기 몫은 그때까지 열려 있다.
- **Android Chrome·삼성 인터넷·카카오톡 인앱(iOS·Android)** — 미확인 이월 후보. 검증 때 사용자에게 9페이즈 팀 테스트 이월 여부를 묻는다(성공 기준 3 해당 환경을 합격으로 세지 않음).
- **낮 시작 문구의 옛 직업 공개 문장** — 사용자 문구 결정 대기(`deferred-items.md` 에 안 두 개). 검증 때 묻는다.
- **테이블 키보드 열림·`#root min-height: 100dvh`** — 실기기 결과에 따라. 알려진 한계 두 줄(작은 폰 키보드 열림 스테이지 128 미만, 테이블 아래 인물 가림)은 기록만 하고 고치지 않음.
- 07-20 의 reconnect RC1 병렬 부하 실패·gallery citizen 은 범위 밖으로 그대로 open.

## Next Phase Readiness

- 07-22(결과 기록·HANDOFF·push)가 이 문서의 표 A·B(자동 결과)와 사용자 확인 대기 상태를 그대로 옮기면 된다. 검증 보고서(07-VERIFICATION)의 기기 표는 표 C 를 그대로 옮기고 Android·삼성·카카오톡 인앱을 "미확인 · 이월 후보"로 적는다(성공 기준 3 해당 환경을 합격으로 세지 않음).
- 차단 요소: 사용자 iPhone 확인(합격 선언에 필수).

---
*Phase: 07-free-chat*
*Completed: 2026-11-02*

## Self-Check: PASSED

- 파일 존재: `docs/screen-map.md`·`docs/architecture.md`·`07-DEVICE-CHECKS.md`·`perf/chatload-prod-390x844-x4-dpr2.json`·`.png` 모두 FOUND
- 커밋 존재: `4147d32`·`23709e9`·`347a6f5` 모두 HEAD 의 조상
- Task 1 acceptance: 옛 문장 grep rc=1(0줄), "미확인 — 9페이즈 팀 테스트 이월 후보" 4줄 PASS
- Task 2 acceptance: smoke full exit 0, e2e chat 실패 0 PASS
- Task 3: 통과 아님 — 사용자 확인 대기(위 상태 한 줄)
