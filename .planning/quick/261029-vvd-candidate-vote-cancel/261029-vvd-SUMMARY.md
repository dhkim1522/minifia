---
quick_id: 261029-vvd
slug: candidate-vote-cancel
status: complete
subsystem: candidate-vote-wire-and-client
tags: [vote, cancel, wire, blank-tap, guide-line, deploy, decision-0040]
provides:
  - "후보 선택 취소: 고른 뒤 장면의 빈 곳 탭 = 와이어 candidateVote target null, 서버가 표를 지우고 투표자 본인에게만 state"
  - "안내 줄 두 문장(고르기 전 무효표 안내 / 고른 뒤 취소 안내), 360폭 한 줄"
  - "서버·화면 함께 배포(버전 2026-10-29T14:52:03Z+cb6979c)와 배포본 검증 전부 통과"
actuals:
  tasks: 4
  commits: 13
plan_head_before: 06725019af0f013fa702c0870175fce7dd8f02cf
plan_head_after: bfd53912c0fd504ac93a9059fa0524622b3bad17
completed: 2026-10-29
---

# 261029-vvd: 후보 선택 취소·무효표 안내 Summary

**후보 선택 중 장면의 빈 곳을 누르면 내 표가 취소되고(와이어 `target: null`, 서버는 키를 지우고 투표자에게만 알림), 안내 줄이 무효표와 취소 방법을 알려 준다. 서버와 화면을 `npm run deploy` 한 번으로 개인 계정에 함께 배포했고, 배포본 smoke 4·5·8명(전부 한 번에 통과), UAT 5종, 전체 E2E 가 통과했다.**

`commits: 13` 은 `git rev-list --count ${plan_head_before}..${plan_head_after}` 로 잰 값이다(HANDOFF 커밋 포함, 이 SUMMARY 를 담는 마지막 docs 커밋은 제외).

## 수행한 일

- Task 1~3 (tracer 경로, 안내 줄·좌표 판정·결정 0040, 누출·UAT·E2E 검사)는 `261029-vvd-PROGRESS.md` 에 기록했다(커밋 3dfe7db ~ cb6979c).
- Task 4 (이 문서): 계정 확인 → `npm run deploy` 한 번 → Cache-Control → 배포본 순차 검사 → HANDOFF.

### 로컬 게이트 (배포 직전 재실행)

- `npm test`: 111 파일 / 3035 테스트 통과. `npm run typecheck` 통과(exit 0). Task 3 에서 `npm run build`·`lib.test.mjs` 177·로컬 uat-vote 54/54·로컬 E2E vote5 통과(PROGRESS).

### 계정·배포

- **OLD_VERSION:** `2026-10-29T12:59:26Z+0035862`
- **배포:** `npm run deploy` 한 번(서버 Worker·DO 와 화면 에셋 함께). 에셋 2개 업로드(`index.html`, `index-DgEpuMsZ.js`; CSS 는 해시 그대로라 기존 것 재사용), `Uploaded minifia`, Version ID `dd183702-9fd8-4db1-aa53-85741454309a`.
- **새 버전:** `2026-10-29T14:52:03Z+cb6979c` (첫 확인에서 바뀜).
- **Cache-Control:** `/` = `public, max-age=0, must-revalidate`; 해시 JS(`index-DgEpuMsZ.js`)·CSS(`index-DNR6yb3N.css`) = `public, max-age=31536000, immutable`; `/characters/host/host_badge.svg` = `public, max-age=86400`. (t40 과 같음.)

### 배포본 검사 (순차, 한 번에 하나, 모두 첫 시도에 통과)

| 검사 | 시도 | 결과 줄 | 종료 코드 | 비고 |
|---|---|---|---|---|
| smoke full 5명 | 1 | `SMOKE OK full code=5825 players=5 spread=9ms discSpread=7ms` | 0 | 여부 찬성 2 반대 3 |
| smoke full 8명 | 1 | `SMOKE OK full code=8263 players=8 spread=45ms discSpread=50ms` | 0 | 이전 배포의 2회 실패와 달리 네트워크 안정, 한도 500ms 그대로 |
| smoke full 4명 | 1 | `SMOKE OK full code=6009 players=4 spread=10ms discSpread=17ms` | 0 | |
| uat-vote | 1 | 54/54 OK | 0 | 고르기 전 취소 무전송, C 만 state, 공개 3표·C 줄 없음, 공개 마감 7000/7000/7000/7000ms(마감 1종) |
| uat-test-bots | 1 | 46/46 통과, `UAT TEST-BOTS OK` | 0 | |
| uat-test-room | 1 | 28/28 통과, `UAT TEST-ROOM OK` | 0 | |
| uat-day | 1 | 항목 16개 모두 통과 | 0 | 단계 전환 도착 차이 최대 521ms(같은 PC 항목, 통과) |
| uat-night | 1 | 36/36 통과 | 0 | |
| `npm run e2e` (배포본) | 1 | `E2E OK`, 걸린 시간 419초 | 0 | 아래 표 |

재시도한 검사는 없다. smoke 8명이 통과했으므로 직전 작업(261029-t40)의 smoke 8명 미확인 건은 이 버전(0039 변경 포함)으로 확인된 것이다.

### E2E 흐름 × 크기 (배포본, 통과/전체)

| 흐름 | 360x640 | 390x664 | 430x932 | 360x560 |
|---|---|---|---|---|
| lobby | 26/26 | 26/26 | 26/26 | 25/25 |
| citizen4 | 135/135 | 135/135 | 135/135 | 135/135 |
| police5 | 143/143 | 143/143 | 143/143 | 143/143 |
| mafia8 | 140/140 | 140/140 | 140/140 | 140/140 |
| doctor5 | 139/139 | 139/139 | 139/139 | 139/139 |
| noexec | 41/41 | 41/41 | 41/41 | 41/41 |
| vote5 | 115/115 | 115/115 | 132/132 | 132/132 |
| spec4 | 52/52 | 52/52 | 52/52 | 52/52 |
| result-c | 42/42 | 42/42 | 42/42 | 42/42 |
| result-m | 47/47 | 47/47 | 47/47 | 47/47 |

크기 고정: `pc`(1280x800) 7/7, `wakelock`(360x640) 2/2. 실패 표 비어 있음. E2E 기준 수치·`APPROVED_RELAXATIONS` 는 바꾸지 않았다.

vote5 의 115/132 차이는 후보가 마피아면 처형 뒤 `ended` 로 끝나 밤 구간 검사가 없는 설계상의 무작위 분기다(PROGRESS 와 같음, 실패 0).

### vote5 P11·P12 (배포본 압축 CSS, 네 크기 모두 통과)

| 검사 | 360x640 | 390x664 | 430x932 | 360x560 |
|---|---|---|---|---|
| P11 후보 선택 안내 줄: 문장·한 줄 (고르기 전·고른 뒤·취소 뒤 세 번) | 통과 | 통과 | 통과 | 통과 |
| P12 취소 탭: 이름표는 표 유지·빈 곳은 취소 | 통과 | 통과 | 통과 | 통과 |
| P12 [테스트] 시트로 넘겨도 내 표가 남음(공개에 내 줄) | 통과 | 통과 | 통과 | 통과 |

360폭(압축된 배포 CSS)에서도 안내 줄이 한 줄이다.

## 편차

- **[계획된 기대 변경]** Task 1: `test/unit/vote.test.ts` 의 "대상이 정수가 아니거나…" 목록에서 `null` 을 뺐다(null 은 이제 취소이므로 BAD_MESSAGE 가 아님, 기대 개수 8 → 7). `undefined` 는 BAD_MESSAGE 로 남겼다.
- 그 밖의 Task 1~3 편차(04-UI-SPEC 개정 표기에 두 문장 그대로 기재, guide.test 의 직접 렌더, 이름표 통과 클릭만 보정 없는 마우스 클릭으로 바꾼 터치 탭 한계)는 PROGRESS 참고.
- Task 4: 앱 결함은 나오지 않아 재배포는 하지 않았다(배포 1회). 계획의 "다른 배포본 검사 재시도" 도 필요 없었다.
- HANDOFF 는 6KB 한도 때문에 0039 bullet·smoke 간헐 실패 bullet·4페이즈 bullet 을 짧게 줄였다(내용은 결정·SUMMARY 에 있음).

## 남은 일

1. **실기기 ⑮**: 후보 선택 빈 곳 탭 취소 느낌(이름표·사람 근처 오작동 없음, **PC 마우스 클릭에서도 확인**)·무효표/취소 안내 줄(360폭 한 줄). HANDOFF 확인 대기 1 에 더했다. 어떤 실기기 항목도 통과 표시하지 않았다.
2. 결정 0040 의 알려진 한계: 키보드·화면 읽기 사용자는 빈 곳 탭으로 취소할 수 없다, PC 마우스 빈 곳 클릭은 E2E 가 건드리지 않는다(빈 곳 취소 E2E 는 터치, 이름표 통과 클릭만 마우스).
3. 직전 작업 `261029-t40` 는 SUMMARY `status: partial`(smoke 8명 미통과)로 남아 있다. 이번 smoke 8명 통과로 확인된 셈이지만, 그 문서의 `status` 변경과 STATE.md 올리기는 하지 않았다(오케스트레이터 판단).

## Known Stubs

없음.

## Threat Flags

없음(새 엔드포인트·인증 경로 없음. 기존 `candidateVote` 메시지의 target 에 null 허용만 추가, 위협 표 T-vvd-01~05 의 완화는 단위·워커·누출·uat-vote·E2E 로 확인).

## Self-Check

- HANDOFF.md 6130바이트(6144 이하), `test/unit/handoff.test.ts` 통과, 32자 이상 16진 문자열 0, `0040`·`⑮` 포함.
- 배포 버전 `2026-10-29T14:52:03Z+cb6979c` 가 `/api/health` 에 나온다(OLD_VERSION 과 다름).
- HANDOFF 커밋 bfd5391 는 로컬 HEAD 에 있다(`git rev-list` 로 측정). push 는 이 SUMMARY 커밋과 함께 한다.
- 결과: PASSED. 모든 배포본 검사가 첫 시도에 통과했다.
