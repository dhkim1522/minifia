---
phase: 08-day-execution-ghost
plan: "26"
subsystem: docs-deploy-handoff
tags: [docs, deploy, smoke, e2e, handoff, device-checks, backlog]
status: complete

requires:
  - phase: 08-day-execution-ghost
    provides: 08-25 맵 게임 갤러리와 로컬 전체 E2E 초록, 08-24 맵 게임 E2E 흐름 여섯, 08-27·28 옛 시험 정리
provides:
  - docs/screen-map.md 의 '게임 맵 화면' 절(층·패널 종류와 높이·지목 버튼·결과 알림·유령·검사 계약)과 새 E2E 흐름 목록
  - docs/architecture.md 의 낮 처형 단계·이동 마스크·위치 전송(mover/viewer 기준)·서버 주도 모이기(멱등)·무대 예외·찬반/유령 공개 원칙(결정 0060)
  - .planning/phases/08-day-execution-ghost/08-DEVICE-CHECKS.md (표 A 배포본 자동 확인, 표 B 실기기 이월 14항목, 표 C 다른 기기, 열린 질문 둘)
  - ROADMAP 백로그 Phase 999.5
  - minifia-v2 배포(커밋 86b9d06)와 배포본 smoke full·새 E2E 흐름 초록
  - HANDOFF.md 8페이즈 완료 인계(5973바이트)
affects: [9페이즈 UI-SPEC·계획, 실기기 확인 묶음]

actuals:
  tokens: 14000
  tasks: 3
  commits: 5
plan_head_before: face892faaa5e4f5c638998d78b4501de3d41994
plan_head_after: 539dbbe8ce5b2b0cac28e50a731e84d4060d8147

key-decisions:
  - "dayload 렌더 측정·유령 이름표 대비는 사용자 결정(2026-11-03)대로 08-DEVICE-CHECKS.md 표 B 와 ROADMAP 999.5 로 이월했다. 8페이즈 완료를 막지 않는다"
  - "배포본 E2E 의 day NT1 은 판정을 바꾸지 않고 구동만 고쳤다: 눌러서 넘기지 않고 서버 타이머가 밤으로 가는 것을 기다린다"
  - "smoke 의 처형 발표 키 집합 기대를 결정 0060-5 에 맞춰 seat 하나로 고쳤다"

requirements-completed: []

duration: 약 1시간
completed: 2026-11-03
---

# Phase 8 Plan 26: 문서·배포·인계 Summary

화면 지도와 구조 문서를 8페이즈 구조로 고치고 실기기 이월 목록(백로그 999.5)을 남긴 뒤, 가드 체인으로 minifia-v2 에 배포(`86b9d06`)해 배포본 smoke full 과 새 E2E 여섯 흐름이 초록임을 확인하고, HANDOFF 를 갱신해 origin/v2 로 push 했다.

## 작업별 결과

| 작업 | 내용 | 결과 | 커밋 |
|------|------|------|------|
| 1 | screen-map(게임 맵 화면 절·새 E2E 흐름), architecture(결정 0060 규칙 5개), 08-DEVICE-CHECKS.md 신규, ROADMAP 999.5 | 계획의 자동 검사 4개 통과, 저장소 위생 검사 통과 | 86b9d06 |
| 2 | `npm run deploy` → health → smoke full → 새 E2E | 배포 1회(Version ID `11df41ba-9e7b-4d83-bd31-2322088dd6c0`), health `2026-11-02T18:25:46Z+86b9d06`, smoke `SMOKE OK full`, E2E `E2E OK`(157초, 실패 0) — 아래 편차 2건 참고 | e49747a, 5f170e3, ddb7ce7 |
| 3 | HANDOFF 갱신(5973바이트), handoff 시험 | `test/unit/handoff.test.ts` 2/2 통과, 해결 항목(결정 0056 완화·테이블 틀 삭제 예정·UI-SPEC D1 이월·작은 폰 테이블 가림) 삭제 | 539dbbe |

## 배포본 검증(표 A 요약)

- 계정: 배포 가드(`scripts/check-account.mjs`)가 개인 Cloudflare 계정으로 통과시켰다. 배포 대상 가드는 `minifia-v2` 를 확인했다. v1.0 주소에는 요청을 보내지 않았다.
- E2E(배포본, 크기 6종): day 99/99 × 6, ghost 37/37(360x560·402x874 는 29/29), noexec 15/15, night-roles 62/62, result 10/10, chat-game 13/13.
- 배포 뒤 `src`·`worker`·`shared`·`public` 은 바뀌지 않았다(스크립트·문서 커밋만). health 해시는 배포 시점 HEAD 와 같고, 이후 HEAD 는 그 위에 스크립트·문서만 올라간 커밋이다.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] smoke 가 옛 처형 발표 키 집합을 기대함**
- **Found during:** Task 2 (배포본 smoke full 첫 실행)
- **Issue:** `scripts/smoke.mjs` 가 `day.execution` 키 집합을 `phrase,seat` 로 검사했다. 결정 0060-5 로 문구 번호가 없어져 서버는 `seat` 만 보낸다(`ExecutionView`). 앱이 아니라 검사 스크립트의 낡은 기대였다.
- **Fix:** 기대를 `seat` 하나로 바꾸고 이유(결정 0060-5)를 메시지에 적었다. 다시 돌려 `SMOKE OK full`.
- **Files modified:** scripts/smoke.mjs
- **Commit:** e49747a

**2. [Rule 1 - Bug] E2E day 흐름 NT1 이 배포본 지연에서 밤을 건너뜀**
- **Found during:** Task 2 (배포본 E2E 첫 실행: 6개 크기 중 5개 NT1 실패)
- **Issue:** 흐름이 처형 구간 판정을 마친 뒤 '다음 단계로 넘기기' 를 눌러 밤으로 갔다. 배포본은 지연이 커서 판정이 처형 5초를 넘기면 서버 타이머가 이미 밤으로 보낸 뒤라, 눌림이 밤을 건너뛰어 아침·다음 날 토론까지 갔다(실패 상세에 서버·손님 화면 단계를 남기도록 한 뒤 둘 다 `discussion` 임을 확인). 로컬에서는 지연이 작아 드러나지 않았다.
- **Fix:** 눌러 넘기지 않고 `ht.waitFor(phase === "night", 9000)` 로 서버 타이머 전환을 기다린 뒤 손님 화면 15초 판정은 그대로 둔다. 판정 기준·문턱은 낮추지 않았다.
- **Files modified:** scripts/e2e/flows.mjs
- **Commit:** 5f170e3

### 일시 오류 (코드 변경 없음)

- 고친 뒤 둘째 배포본 E2E 에서 ghost 한 줄이 `GET /backgrounds/bg_game_morning.webp 502`(Cloudflare 일시 오류)로 실패했다. 같은 파일을 세 번 받아 200 · `image/webp`, 허용 목록은 넓히지 않고 셋째 전체 실행에서 실패 0 을 얻었다.

### 실기기·측정 이월 (사용자 결정, 편차 아님)

- dayload 렌더 측정(55fps·끊김 게이트)과 유령 이름표 대비는 앱을 바꾸지 않고 08-DEVICE-CHECKS.md 표 B 와 ROADMAP 999.5 로 이월했다. 6페이즈 게이트 기준은 낮추지 않았다.

## 청소 후보 (이월)

- `scripts/uat-vote.mjs`(옛 처형 여부 투표 시나리오, `EXECUTION_PHRASE_COUNT` 복사본)·`scripts/uat-night.mjs` 의 `EXEC_VOTE_MS` 복사본, `src/styles/day.css` 의 `.mf-dayscene`·`.mf-sceneintro` 규칙은 값 하나가 아니라 스크립트·규칙 묶음이라 싸게 지울 수 없어 ROADMAP 999.5 의 정리 후보로 남겼다.

## 열린 질문 (HANDOFF '확인 대기' 에 올림, 고치지 않음)

- 맵에는 밤이 시작될 때 "밤이 되었습니다" 알림이 없다(마피아 시작 줄만) — 08-27 확인.
- 낮 채팅 패널이 서버 `me.chat` 없이도 항상 그려진다(`me.chat ?? "all"`) — 08-27 확인.

## Known Stubs

없음. 이 계획은 문서·스크립트 두 줄·배포만 다뤘다.

## Threat Flags

없음. 새 엔드포인트·인증 경로·파일 접근 없음. T-08-59(배포 대상): 가드 체인 통과. T-08-60(공개 저장소 문서): 위생 검사 통과. T-08-SC: 패키지를 설치하지 않았다.

## Issues Encountered

- 저장소 위생 검사는 변경한 모든 파일(docs·ROADMAP·DEVICE-CHECKS·HANDOFF·smoke·flows)에서 결과 없음이었다.

## Self-Check: PASSED

- 생성 파일 확인: 08-DEVICE-CHECKS.md, 08-26-SUMMARY.md 존재.
- 커밋 확인: 86b9d06, e49747a, 5f170e3, ddb7ce7, 539dbbe 가 HEAD 의 조상.
