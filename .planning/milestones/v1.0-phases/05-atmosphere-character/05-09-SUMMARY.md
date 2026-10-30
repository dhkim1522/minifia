---
phase: 05-atmosphere-character
plan: 09
subsystem: deploy-and-deployed-verification
tags: [deploy, cloudflare, smoke, uat, e2e, LOOK-01, CHAR-01, UX-01, UX-02, CONN-03]
status: complete

requires:
  - phase: 05-atmosphere-character
    provides: "05-01~05-08 클라이언트 변경과 배포 전 로컬 게이트(05-08)"
provides:
  - "5페이즈를 개인 Cloudflare 계정 Worker minifia 에 한 번 배포(버전 2026-10-29T11:11:36Z+42d648b)"
  - "배포본에서 smoke full 4·5·8명, uat-vote·uat-test-bots·uat-test-room·uat-day·uat-night, E2E(열 흐름 × 네 크기 + pc + wakelock) 통과"
  - "LOOK-01·CHAR-01·UX-01·UX-02·CONN-03 완료 표시, ROADMAP 5페이즈 9/9 Complete (실기기 체감·Wake Lock 실제 동작은 대기)"
affects: [실기기 확인(사람), /gsd-verify-work 4, /gsd-verify-work 5, 6페이즈]

actuals:
  tokens: 4000
  tasks: 2
  commits: 1
plan_head_before: 42d648bfa0b899d6225036da495b5bca6f25a379
plan_head_after: d085d116bc24dc93582d017af93057e646a4f65d

tech-stack:
  added: []
  patterns:
    - "배포본 검사는 한 번에 한 개씩 순차로 돌린다(병렬 실행이 도착 편차를 키우던 04-35 교훈)"

key-files:
  created: []
  modified:
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
    - HANDOFF.md

key-decisions:
  - "배포 체크포인트는 사용자가 2026-10-29 에 명시적으로 `지금 배포` 라고 답해 deploy 로 해소했다(이 한 번의 배포에만 해당)."
  - "스모크 도착 편차 한도 500ms 와 E2E 기준 수치·APPROVED_RELAXATIONS 는 건드리지 않았다. 간헐 실패는 같은 버전 단독 재실행으로 가려 모든 시도를 적는다."

requirements-completed: [LOOK-01, CHAR-01, UX-01, UX-02, CONN-03]

duration: about 1h 10m
completed: 2026-10-29
---

# Phase 5 Plan 09: 배포와 배포본 검증 Summary

**5페이즈(클라이언트 전용)를 개인 Cloudflare 계정에 한 번 배포하고, 배포본 smoke 4·5·8명·UAT 5종·화면 E2E(열 흐름 × 네 크기 + pc + wakelock)가 모두 통과해 요구사항 다섯 개를 닫았다. 앱 결함은 나오지 않아 재배포는 하지 않았다.**

## 수행한 일

### Task 1 — 개인 계정 배포 → 배포본 스모크·UAT

- **사용자 go-ahead:** 사용자가 2026-10-29 에 `지금 배포` 라고 명시적으로 답했다. 계획상 배포 체크포인트는 DEPLOY 로 처리했다.
- **OLD_VERSION:** `2026-10-28T14:27:59Z+5dcd032`
- **배포:** `npm run deploy` 성공, Version ID `3a30cf39-74b5-4018-8e72-978050f92928`, 새 에셋 3개(`index.html`, `index-ClPC5wSF.css`, `index-Dndsg10V.js`) 업로드. 서버(Worker/DO) 코드 변경 없음.
- **버전 변경:** 첫 확인(5초 간격 중 1회차)에서 `2026-10-29T11:11:36Z+42d648b` 로 바뀜.
- **정적 에셋 Cache-Control:** `/` = `public, max-age=0, must-revalidate`, 해시 CSS·JS = `public, max-age=31536000, immutable`, `/characters/*` = `public, max-age=86400`.
- **배포 CSS 확인(압축된 배포본):** `.mf-backdrop__vignette{…background:var(--mf-vignette)…}`, `.mf-morningglow{…animation:mf-morningglow-out…}`, `.mf-tt[data-compact]{width:var(--tap-min);…}` 와 `.mf-tt[data-compact] .mf-tt__label{clip-path:inset(50%);…}` 가 모두 남아 있다.

### Task 2 — 배포본 화면 E2E → 문서 → push

배포본 E2E 가 통과한 뒤에만 REQUIREMENTS·ROADMAP·HANDOFF 를 고쳤다(`Edit`/치환으로만, 기준 수치 변경 없음).

## 배포본 결과 (버전 2026-10-29T11:11:36Z+42d648b)

| 검사 | 결과 줄 |
|------|---------|
| smoke full 5명 (`--previous-version 2026-10-28T14:27:59Z+5dcd032`) | `SMOKE OK full code=0694 players=5 spread=78ms discSpread=91ms version=2026-10-29T11:11:36Z+42d648b` (첫 시도) |
| smoke full 8명 | 3번째 시도 `SMOKE OK full code=8327 players=8 spread=83ms discSpread=85ms` (아래 시도 표) |
| smoke full 4명 | 2번째 시도 `SMOKE OK full code=3594 players=4 spread=93ms discSpread=0ms` (아래 시도 표) |
| uat-vote | `48/48 OK`, 종료 코드 0 |
| uat-test-bots (`--previous-version 2026-10-28T14:27:59Z+5dcd032`) | `46/46 통과 / UAT TEST-BOTS OK`, 0 |
| uat-test-room | `28/28 통과 / UAT TEST-ROOM OK`, 0 |
| uat-day 5명 | 전 행 통과, 종료 코드 0 (단계 전환 도착 차이 최대 546ms 로 uat-day 판정 통과) |
| uat-night 5명 | `36/36 통과`, 0 |
| E2E (`npm run e2e`, 대상 scripts/prod-url.txt) | 한 번에 통과, 마지막 줄 `E2E OK`, 493초, 실패 표 비어 있음 |

### E2E 흐름 × 크기 (통과/전체, 실패 0)

| 흐름 | 360x640 | 390x664 | 430x932 | 360x560 |
|------|---------|---------|---------|---------|
| lobby | 26/26 | 26/26 | 26/26 | 25/25 |
| citizen4 | 135/135 | 135/135 | 135/135 | 135/135 |
| police5 | 143/143 | 143/143 | 143/143 | 143/143 |
| mafia8 | 140/140 | 140/140 | 140/140 | 140/140 |
| doctor5 | 139/139 | 139/139 | 139/139 | 139/139 |
| spec4 | 52/52 | 52/52 | 52/52 | 52/52 |
| vote5 | 109/109 | 126/126 | 126/126 | 126/126 |
| noexec | 41/41 | 41/41 | 41/41 | 41/41 |
| result-c | 42/42 | 42/42 | 42/42 | 42/42 |
| result-m | 47/47 | 47/47 | 47/47 | 47/47 |

크기 고정 흐름: `pc` 1280x800 7/7, `wakelock` 360x640 2/2. 360x640 의 vote5 는 109 로 다른 크기(126)보다 17개 적다. 로그에서 이 크기의 vote5 는 `night` 장면 항목(17개)이 없고 나머지 장면은 같다. 흐름이 무작위 직업의 봇을 처형 대상으로 고르는 설계라(처형 뒤 승패가 나면 밤이 없다) 판이 밤 전에 끝난 것으로 보지만, 판 종료 여부를 로그에서 직접 확인하지는 않았다. 실패·건너뜀 표시는 없다(05-08 로컬 실행은 네 크기 모두 126). 밤 장면 판정은 같은 실행의 다른 흐름(police5·mafia8·citizen4·doctor5)과 다른 세 크기의 vote5 가 덮는다.

## 간헐 실패 시도 표 (정직한 집계)

서버·와이어 코드는 두 배포 사이에 변경이 없다. 같은 버전에서 단독 재실행으로 통과했다. 이 PC 네트워크·CPU 지터로 분류하며 원인은 미확정이다(04-35 와 같은 부류). 한도 500ms 는 그대로 뒀다.

| 검사 | 시도 | 결과 |
|------|------|------|
| smoke 5명 | 1 | 통과 (spread 78ms) |
| smoke 8명 | 1 | 실패: 6번째 표 뒤 execTally 가 10초 안에 같아지지 않음 |
| smoke 8명 | 2 | 실패: discussion 도착 편차 520ms (이때 `ping` 8회 평균 145.6ms, 표준편차 1.5ms 로 안정) |
| smoke 8명 | 3 | 통과 (spread 83ms) |
| smoke 4명 | 1 | 실패: dayAnnounce 도착 편차 958ms |
| smoke 4명 | 2 | 통과 (spread 93ms) |
| uat-test-room, uat-vote, uat-test-bots, uat-day, uat-night, E2E | 1 | 모두 첫 시도 통과 |

smoke 8명은 계획이 정한 "최대 두 번 더" 안(세 번째 시도)에서 통과했다. 이전 배포(04-35)에서는 8명이 여섯 번째에 통과했으므로 같은 경향이다. 검사는 순차로 돌렸다(병렬 실행 없음).

## 계획과 달라진 점

### 자동 수정한 결함

없음 - 배포본에서 앱 결함이 나오지 않았다. 재배포는 하지 않았다(허용된 한 번을 쓰지 않음). 기준 수치·`APPROVED_RELAXATIONS` 는 바꾸지 않았다.

### 건너뛴 것

- `npm run e2e -- --shots` 사진 확인(선택 단계, "필요하면")은 하지 않았다. 사진 확인은 실기기 확인 목록(⑨~⑬)으로 남는다.
- `05-VALIDATION.md` 가 없어 갱신할 VALIDATION 이 없다.

## 인증 게이트

없음(Wrangler OAuth 로그인이 이미 되어 있었고 push 는 기존 개인 SSH 설정을 썼다).

## 알려진 스텁

없음.

## 위협 표면 점검


## 사람이 할 일

- 실기기 확인 목록(HANDOFF ①~⑬, 폰 2대 이상·360폭·짧은 폰 포함)은 사용자가 모든 개발이 끝난 뒤 한 번에 한다. 통과 표시한 항목은 없다. 5페이즈 항목: ⑨ 밤 비네팅 체감 ⑩ 아침 밝아짐 체감 ⑪ Wake Lock(iOS Safari·저전력 모드·Android Chrome, 탭 전환 뒤) ⑫ 짧은 폰 테이블 압축 ⑬ 링크 참가 화면 7명. 수치 조정은 `src/game/scenes.ts`·`src/game/dayTable.ts` 상수 한 곳.
- 다른 네트워크에서 배포본 smoke 를 한 번 더 돌려 간헐 실패의 원인(PC 네트워크 vs 서버 소켓)을 가려 보면 좋다.

## Self-Check: PASSED

- 파일 존재: `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `HANDOFF.md`(5471바이트), 이 SUMMARY 확인.
- 커밋 존재: `d085d11` 이 HEAD 의 조상이다. `commits: 1` 은 `git rev-list --count 42d648b..HEAD` 로 쟀다(이 SUMMARY 의 docs 커밋 전).
- REQUIREMENTS: 열린 5항목 0, 추적표 `Complete` 5행. ROADMAP: `9/9` 포함, `- [x] **Phase 5:` 1줄. HANDOFF: 6KB 이하, 32자 이상 16진 0, `⑬` 포함, handoff 단위 시험 통과.
