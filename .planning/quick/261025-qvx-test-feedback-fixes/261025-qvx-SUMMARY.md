---
phase: quick-261025-qvx
plan: 01
status: complete
subsystem: screens-e2e
tags: [day-table, lobby, night-intro, ring-layers, e2e, decision-0028, deploy]
requirements: [QUICK-261025-qvx]
completed: 2026-10-25
completed_tasks: [1, 2, 3, 4, 5]
remaining_tasks: []
commits: 17
plan_head_before: bce014ff68c209d8221bf38a92679a63e4743981
plan_head_after: c39247ed434ba49db72e1879d26211d9e5f391a8
deployed_version: "2026-10-25T11:40:42Z+d2af5a9"
previous_version: "2026-10-25T10:09:11Z+bce014f"
key-files:
  created:
    - docs/decisions/0028-test-feedback-fixes.md
    - src/components/NightIntro.tsx
    - test/client/nightIntro.test.tsx
    - test/client/stageBox.test.tsx
    - test/client/icon.test.tsx
  modified:
    - src/game/dayTable.ts
    - src/components/DayTable.tsx
    - src/styles/daytable.css
    - src/screens/DayScene.tsx
    - src/screens/Lobby.tsx
    - src/screens/Assigning.tsx
    - src/screens/RoomScreen.tsx
    - scripts/e2e/lib.mjs
    - scripts/e2e/browser.mjs
    - scripts/e2e/flows.mjs
    - .planning/phases/03.1-sequential-claims-role-card/03.1-UI-SPEC.md
    - HANDOFF.md
  deleted:
    - src/components/RoleCardToast.tsx
    - src/styles/rolecard-toast.css
    - src/components/Table.tsx
    - shared/seatLayout.ts
estimate:
  tokens: 400000
  raw_tokens: 400000
  tasks: 5
  confidence: low
actuals:
  tokens: 30100
  tasks: 5
  commits: 17
---

# Quick 261025-qvx: 테스트 피드백 4건 수정과 테이블 기하 P2 고정 - Summary

**밤 끝 알림 제거, 차례 링 뒤쪽·앞쪽 호 분리, 밤 시작 문구 1회, 그리고 테이블·캐릭터 기하를 시안 P2 값으로 대기실·배정·낮·밤·아침에서 고정(대기실·배정이 `DayTable` 을 같은 장면 상자에서 씀)을 구현하고 `2026-10-25T11:40:42Z+d2af5a9` 로 배포했다.**

`actuals.tokens` 는 `estimateTokens`(chars/4) 로 `bce014f..HEAD` 의 추가된 줄(design/·이 SUMMARY 폴더 제외, 120,412자)을 센 값이다. `actuals.commits` 17 은 측정값(`git rev-list --count bce014f..HEAD`, 원장 `gsd-plan-head-before-quick-261025-qvx-01`)이고 아래 「커밋 목록」 대로 체크포인트 문서 커밋 넷(bf97504·17b94b0·84207cd·c818ee2)과 이 계획 밖에서 들어온 디자인 문서 커밋 하나(8e80abd)를 포함한다. 이 SUMMARY 를 담는 마무리 커밋은 이 수에 들어가지 않는다.

## 완료한 과제

### 과제 1: 밤 끝 알림 완전 제거 (U-01)

| 단계 | 커밋 | 내용 |
|------|------|------|
| RED | 129767c | `test(qvx): 밤 끝 알림이 없다는 기준으로 바꾼다` |
| GREEN | b068558 | `feat(qvx): 밤 끝 알림을 없앤다 (결정 0028)` |

- 삭제: `RoleCardToast.tsx`, `rolecard-toast.css`. `DayScene` 의 알림 import·4초 `useToast`·기록 길이 효과 둘·JSX·선택 props(`roleCardOpen`, `onOpenActivity`) 제거, `RoomScreen` 의 `onOpenActivity` 제거, `JOURNAL_TEXT.notice` 제거. 앰버 점·탭 점·`NEW`·읽은 개수 저장은 그대로.
- E2E: `noticeChecks` -> `noNightNoticeChecks`(R6, 보이는 `[role="status"]` 의 일지 알림 글자가 0 개, 측정값 없으면 실패). `browser.mjs` 는 `noticeTexts` 를 싣고 `clickNotice` 삭제, `flows.mjs` 의 `roleCardViaNotice` 삭제.

### 과제 2: 차례 링 앞뒤 층 분리 (U-02) + 밤 시작 문구 (U-03)

| 단계 | 커밋 | 내용 |
|------|------|------|
| U-02 RED | 4f9589b | `test(qvx): 차례 링을 뒤쪽 호·앞쪽 호로 나누는 기준` |
| U-02 GREEN | aa077bc | `feat(qvx): 차례 링 뒤쪽 호는 캐릭터 뒤, 앞쪽 호는 캐릭터 앞 (결정 0028)` |
| U-03 RED | 8de3ac4 | `test(qvx): 밤 시작 문구의 기준` |
| U-03 GREEN | 133e1c5 | `feat(qvx): 밤이 시작되면 '밤이 되었습니다' 가 한 번 뜬다 (결정 0028)` |

- 링: `.mf-dt__spot` 은 쌓임 맥락 없는 묶음, 안에 `.mf-dt__spot-arc--back`(z -1, 윗쪽 반 `clip-path`)과 `--front`(그림 다음 마크업 순서, 아랫쪽 반). 크기·두께 3px·gray-50·빛 18px·페이드·축소 모션 처리 불변, 바깥 z 규칙 불변(D3a 통과). E2E K4.
- 밤 문구: 새 `NightIntro`(`NIGHT_INTRO_MS = DAY_ANNOUNCE_MS`, 마운트 때 한 번 거는 타이머), `.mf-nightintro`(z 40, `pointer-events: none`, 막 `--night-950` 85%). `DayScene` 렌더 중 조정에서 같은 epoch 의 비밤 -> 밤일 때만 켠다. 서버 불변. E2E N6·N7.

### 과제 3: 테이블·캐릭터 기하를 P2 승인값으로 고정 (U-04, 1/2)

| 단계 | 커밋 | 내용 |
|------|------|------|
| RED | 6f15452 | `test(qvx): 테이블 기하를 P2 승인값으로 고정하는 기준` |
| GREEN | 6482625 | `feat(qvx): 테이블·캐릭터 기하를 P2 승인값으로 고정한다 (결정 0028)` |

- `src/game/dayTable.ts`: `seatRx(장면 폭, 여백)`·`feltWidthOf(rx)`와 상수(`SEAT_RX_MIN` 124·`SEAT_RX_MAX` 150·`RX_TAG_HALF` 49·`FELT_SIDE` 38·`SCENE_PAD_DEFAULT` 12·`SCENE_PAD_NARROW` 4). 390폭 면 216×108·rx 146·cy 210·ry 100. 계획 산술 표(rx 131/138/146/150, 면 폭 186/200/216/224, 장면 안 최소 여백, 간격 ≥ 6.2, 99px 이름표 폰 가장자리 여유 -0.5/0.0/-0.5/15.5)가 단위 테스트로 그대로 재현되어 불일치가 없었다.
- `DayTable`: `scenePad` prop 또는 `--mf-scene-pad`, 마운트 직후 동기 측정. E2E: `feltGapChecks`(T2), `stageStable`(T1), `readStage`.

### 과제 4: 대기실·역할 배정을 같은 `DayTable`·장면 상자로 통일 (U-04, 2/2)

| 단계 | 커밋 | 내용 |
|------|------|------|
| RED | 19946de | `test(qvx): 대기실·배정을 같은 테이블과 장면 상자로 통일하는 기준` |
| GREEN | a82e401 | `feat(qvx): 대기실·역할 배정도 같은 테이블과 장면 상자를 쓴다 (결정 0028)` |

- `Lobby`·`Assigning` 이 옛 `Table` 대신 `DayTable`(대기실은 `slide`)을 쓰고, 머리 119.2·패널/시트 157·여백 12/4 를 낮과 같게 했다(`stageBox.test.tsx` 교차 검사). 대기실은 좌석 번호 순서의 등간격 자리 + 인원 변화 때 미끄러짐(축소 모션에서는 없음). 배정은 어두운 막과 안내이고 역할을 읽지 않는다.
- 삭제: `Table.tsx`, `shared/seatLayout.ts`, 옛 `lobby.css`·`phase.css` 규칙, 옛 테스트 둘(단언은 이동). E2E: L6(`lobbyShapeChecks`), D7·D9·T1 이 대기실·배정까지 포함.

### 과제 5: 결정 0028·UI-SPEC·HANDOFF -> 전체 검증 -> 배포 -> 배포본 확인 -> push

| 단계 | 커밋 | 내용 |
|------|------|------|
| 문서 | d2af5a9 | `docs(qvx): 결정 0028 과 UI-SPEC·HANDOFF 를 테스트 피드백과 테이블 기하 고정에 맞춘다` |
| 인계 | c39247e | `docs(qvx): 배포 결과와 인계를 갱신한다` |

**문서.** `docs/decisions/0028-test-feedback-fixes.md`(결정 다섯: 알림 제거, 링 두 층, 기하 P2 고정과 폭별 규칙·시안 SPEC 규칙을 쓰지 않은 이유·칼날 경계와 대안 `RX_TAG_HALF` 49 -> 50, 장면 상자 통일과 대기실 등간격, 밤 시작 문구, 되돌리기 비용과 아티팩트 동기화 목록). `03.1-UI-SPEC.md`: 알림(R6·S10·S13·F4·D-f·부품 표·모션·카피·UI Considerations)을 폐기 표기로 바꾸고, 「보장 화면 크기와 장면」 표·폭별 규칙·이름표 보이는 비율 표를 새 값으로 교체, 「장면 상자는 모든 단계에서 같다」·대기실·배정 계약과 칼날 경계를 더하고, E2E 표에 K4·N6·N7·T1·T2·L6 행·R6 교체, 차이표 D-h·D-i, 참고 자료 표에 `design/screens/table-v1/` 셋, 확정 F9·F10, 아티팩트 동기화 갱신. 승인 사본 `design/screens/table-v1/` 은 고치지 않았다. 옛 기하 숫자가 남은 곳은 「[테스트] 버튼 겹침 표」(옛 rx 124/132 기준임을 명시하고 새 기하의 확인은 단위 테스트·E2E D4 가 맡는다고 적음, 다시 계산하지 않음)와 그 절 설명뿐이다. `HANDOFF.md`: qvx 항목(바뀐 것, 새 E2E 검사, 실기기 확인 목록 8개와 칼날 경계 5번, 아티팩트 동기화 목록, 알려진 한계)과 3.1 항목의 알림 언급 정리, 다음 할 일 00번.

**로컬 검증.** `npm run typecheck` 통과, `npx vitest run` 76파일 1770테스트 통과, `node --test scripts/e2e/lib.test.mjs` 86/86. E2E 기준 수치(`OVERLAP_EPS` 0.5·`ONE_LINE_FACTOR` 1.6·`FACE_RATIO` 0.45·`TAP_MIN` 44·`PANEL_H` 157)와 `TEXT_SIZE_ALLOW`(`.mf-journal__new`·`.mf-tt-sheet__list small` 둘뿐) 확인, `git diff bce014f -- scripts/e2e/lib.mjs` 에서 허용 목록(`DECORATIVE_ALLOW`·`TAP_ALLOW`)·상수 변경 0건. 서버 불변: `git diff --stat bce014f -- shared worker` 는 `shared/seatLayout.ts` 삭제 하나만, `git diff --quiet bce014f -- shared/game worker shared/protocol.ts shared/schemas.ts` 변경 없음.

**로컬 E2E**(`npm run dev` 5173, PID 로 종료·포트 비움). 첫 실행은 `citizen4 430x932` 준비 실패 1건(S4 「방장이 첫 밤에 탈락해 살아 있는 사람 흐름이 아님」, 검사 실패 아님)으로 `E2E FAIL: 1개 실패`, 같은 명령 재실행은 전부 통과(`E2E OK`, 132초).

| 흐름 | 360x640 | 390x664 | 430x932 |
|------|---------|---------|---------|
| lobby | 20/20 | 20/20 | 20/20 |
| citizen4 | 96/96 | 96/96 | 96/96 |
| police5 | 104/104 | 104/104 | 104/104 |
| mafia8 | 101/101 | 101/101 | 101/101 |
| doctor5 | 100/100 | 100/100 | 100/100 |
| spec4 | 47/47 | 47/47 | 47/47 |

**배포.** `npx wrangler whoami` = dhkim1522@naver.com(Account `Dhkim1522@naver.com's Account`), `wrangler.jsonc` name `minifia` 확인 후 `npm run deploy`(Worker `minifia` 만, Version ID `ba32a951-65b3-4a6c-882d-16a2ae849bf3`). `smoke.mjs --prod --print-version`: 배포 전 `2026-10-25T10:09:11Z+bce014f` -> 배포 후 **`2026-10-25T11:40:42Z+d2af5a9`**.

**배포본 확인.**

| 검사 | 결과 |
|------|------|
| `smoke.mjs --prod --stage full --players 5 --previous-version <옛>` | `SMOKE OK full` code 9852, 도착 편차 2ms, 낮 토론 편차 2ms |
| `smoke.mjs --prod --stage full --players 8` | `SMOKE OK full` code 4159, 편차 27ms, 낮 토론 26ms |
| `smoke.mjs --prod --stage full --players 4` | `SMOKE OK full` code 7662, 편차 23ms, 낮 토론 23ms |
| `uat-night.mjs --prod --players 5` | 36/36 통과 |
| `uat-night.mjs --prod --players 8` | 36/36 통과 |
| `uat-test-bots.mjs --prod --previous-version <옛>` | 42/42, `UAT TEST-BOTS OK` |
| `uat-test-room.mjs --prod --previous-version <옛>` | 28/28, `UAT TEST-ROOM OK` |
| `e2e/run.mjs --url https://minifia.dhplay.workers.dev` | 세 번째 실행에서 18개 작업 전체 통과, `E2E OK`(154초) |

배포본 E2E 는 세 번 돌았다. 1회(`citizen4 430x932` 준비 실패 + `police5 360x640` 준비 실패 「토론 진입 실패 (지금 night)」), 2회(`--shots`, `citizen4 360x640` 준비 실패), 3회 전부 통과. 실패 다섯 건은 모두 `S4 단계 도달`(준비 실패)이고 검사(규칙) 실패는 한 번도 없었다. 같은 코드가 로컬에서도 한 번 같은 준비 실패를 냈다(합계 citizen4 3건). 배포본 최종 표:

| 흐름 | 360x640 | 390x664 | 430x932 |
|------|---------|---------|---------|
| lobby | 20/20 | 20/20 | 20/20 |
| citizen4 | 96/96 | 96/96 | 96/96 |
| police5 | 104/104 | 104/104 | 104/104 |
| mafia8 | 101/101 | 101/101 | 101/101 |
| doctor5 | 100/100 | 100/100 | 100/100 |
| spec4 | 47/47 | 47/47 | 47/47 |

**사진 확인**(배포본 `--shots` 실행 + 임시 스크립트, 390x664 위주, 360x640 일부. 사람 눈으로 본 것이 아니라 내가 이미지를 열어 본 기록이다). 대기실 1명: 방장 한 명이 테이블 아래 가운데, 왕관 배지, 시트가 아래 157 로 낮 하단 패널과 같은 높이로 보임. 대기실 2명: 두 명이 위·아래로 마주 보고, 입장 토스트(`…님이 들어왔어요`)가 머리 방 코드 아래에 떠서 잠깐 장면 위쪽을 덮음(`pointer-events` 없음). 대기실 3명(360폭): 나는 맨 아래 가운데, 둘이 테이블 양옆 위쪽에 앉아 삼각형이고 양옆 이름표가 폰 안에 들어옴. 역할 배정: 같은 테이블·같은 자리에 어두운 막과 맥박 링·`직업을 배정하고 있습니다…`, 머리에 `역할 배정` 제목 하나(희미함), 낮 장면과 캐릭터·테이블 위치가 같아 보임. 차례 링(claim-other): 왼쪽 앞쪽 자리의 차례 링이 캐릭터 발을 감싸고 앞쪽 호가 이름표 윗부분과 겹쳐 보임(이름표가 반전되어 읽힘). 아침 카드(8명판 360폭): 카드가 뒷줄 캐릭터를 가리고 오른쪽 캐릭터의 이름표는 폰 오른쪽 가장자리 안, 양옆 캐릭터는 테이블 면 바깥. 눈에 띈 점: 대기실 입장 토스트가 장면 위 5px 정도를 덮는 것(계획에 기록된 동작), 아침 카드 뒤 이름표 글자가 잘려 보임(아침 5초 M1 허용 범위).

## 검증 요약

- 과제별: 과제 1 시점 vitest 75파일 1739, lib.test 67 / 과제 2 시점 76파일 1760, lib.test 71 / 과제 3 시점 76파일 1772, lib.test 81 / 과제 4 시점·최종 76파일 1770, lib.test 86. 모든 시점 typecheck 통과.
- `git log` 에 과제 1·2(두 건)·3·4 각각 RED -> GREEN 커밋 순서가 있다.
- 옛 식별자 grep(`components/Table|shared/seatLayout|SEAT_COUNT|mf-table|mf-seat__`, src·test·scripts·worker·shared) 0건, 알림 식별자 0건(과제 4 시점 확인).
- 임계값·허용 목록 변경 없음, 승인 완화 M1·D3a/D3b·D4 외 완화 없음. D3a/D3b 바닥(4·5명 99.9 %, 6명 85 %, 7명 50 %, 8명 55 %)은 낮추지 않았고 실패한 적도 없다.

## 편차

- [Rule 1 - Bug] 과제 2 U-03: RED 커밋(8de3ac4)의 `night.css` 규약 테스트 정규식 둘이 잘못돼 있어(퇴장 지연 기본값 쉼표, `@media` 블록 경계) 구현은 그대로 두고 GREEN 커밋(133e1c5)에서 정규식만 고쳤다. 기준 의미는 같다.
- 과제 4: 계획 밖 변경 없음. 삭제한 두 옛 테스트의 단언은 `icon.test.tsx`·DayTable·로비 테스트로 옮겼다. GREEN 커밋에서 테스트 둘을 고쳤다(끊긴 사람 테스트를 방장 아닌 화면으로, 옛 식별자 확인을 이름 조각 합성으로). 의미는 같다.
- 과제 5: 계획대로이고 코드 변경은 없었다. 배포본·로컬 E2E 가 준비 실패(S4)로 여러 번 끝난 것은 규칙 실패가 아니라 원래부터 있던 확률적 준비 실패라고 판단해 E2E 규칙·재시도 횟수를 고치지 않고 같은 명령을 다시 돌렸다. 이유: citizen4(4명판)는 마피아가 방장을 첫 밤에 지목하면 준비를 못 하는 구조이고 `run.mjs` 는 이 계획에서 바뀌지 않았다. `police5` 360폭의 「토론 진입 실패 (지금 night)」는 한 번만 보였고 재현되지 않았다(마지막 주장 차례 타이머 만료와 [다음 단계로 넘기기] 가 겹치는 harness 경합으로 보이나 확정하지 않았다 — 다시 나오면 `skipTo` 를 조사한다).
- `commits: 17` 에는 이 계획 밖 디자인 문서 커밋 8e80abd(`docs(design): approved table geometry P2`)가 들어 있다(코드 무관).
- 이 계획은 quick task 라서 페이즈 위치용 `state.advance-plan`·`roadmap.update-plan-progress`·`requirements.mark-complete` 는 부르지 않았다(QUICK 요구사항은 `REQUIREMENTS.md` 에 없고 STATE 의 페이즈 위치는 이 계획 소관이 아니다). STATE 에는 빠른 작업 표 한 줄만 `quick-tasks-append` 로 더했다.

## 알려진 스텁

없음.

## 열린 위험과 다음 단계

- **칼날 경계 −0.5px**(4·8명판 양옆 5글자 이름표의 폰 가장자리 여유, 360·390폰): E2E 봇 이름은 3글자라 시험되지 않는다. 실기기에서 걸리면 `src/game/dayTable.ts` 의 `RX_TAG_HALF` 49 -> 50(390폭 rx 145·면 214·양옆 간격 6.7).
- 실기기 확인 목록(HANDOFF qvx 항목 (1)~(8))과 디자인 세션 아티팩트 동기화(화면설계서 R6 삭제·링 앞뒤 층·밤 시작 문구·공통 기하와 장면 상자, 디자인 시스템 테이블 숫자)가 남았다.
- 고치지 않은 것: UI-SPEC [테스트] 겹침 표 숫자(옛 기하 기준 표시).

## Threat Flags

없음. 새 네트워크 경로·인증·파일 접근·스키마 변경이 없다(모두 화면·테스트 변경이고 서버 코드는 `shared/seatLayout.ts` 삭제 외 불변). 배포는 개인 계정 확인 뒤 Worker `minifia` 만, push 는 `git@github.com:dhkim1522/minifia.git`.

## Self-Check: PASSED

- FOUND 커밋(HEAD 의 조상): 129767c, b068558, 4f9589b, aa077bc, 8de3ac4, 133e1c5, 6f15452, 6482625, 19946de, a82e401, d2af5a9, c39247e
- FOUND 파일: docs/decisions/0028-test-feedback-fixes.md, src/components/NightIntro.tsx, test/client/nightIntro.test.tsx, test/client/stageBox.test.tsx, test/client/icon.test.tsx
- 삭제 확인: RoleCardToast.tsx, rolecard-toast.css, Table.tsx, shared/seatLayout.ts
