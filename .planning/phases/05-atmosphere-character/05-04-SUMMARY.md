---
phase: 05-atmosphere-character
plan: 04
subsystem: client-layout-character
tags: [ux, short-phone, table-fit, join-by-link, char-audit, tdd, UX-02, CHAR-01]
status: complete

requires:
  - phase: 05-atmosphere-character
    provides: "05-UI-SPEC §10 CHAR-01 점검표, §11 측정(결함 둘)과 압축 계약(지원 하한 516·장면 240, 299 이상 불변)"
provides:
  - "dayTable.ts: TABLE_FIT_MIN_SCALE(0.78)·TABLE_FIT_SPAN(276.8)·tableFitScale(sceneH), 기하 결과의 fit 값, 장면 높이 299 미만 압축"
  - "JoinByLink: 앉은 사람 5명 이상일 때 mf-join__seated--many·mf-join--many 수정자, ds.css 광장 축소 규칙"
  - "test/client/characterAudit.test.tsx: CHAR-01 점검표 시험 12건"
affects: [05-05, 05-06, 05-08, 05-09]

actuals:
  tokens: 7100
  tasks: 3
  commits: 5
plan_head_before: d502f9f2e3b1df3aea5e61612363cde097bf7ca9
plan_head_after: eb209b656590920c0dcf1c0309c9d28ab527b6d5

tech-stack:
  added: []
  patterns:
    - "H >= 299 분기는 HEAD 식 그대로 두고 압축은 H < 299 분기에만 둔다(기존 값 불변을 참조 구현 시험으로 고정)"
    - "압축은 기하 결과(cy·ry·fit·felt)로만 흐르고 DayTable.tsx·verdict.ts 는 바꾸지 않는다"

key-files:
  created:
    - test/client/characterAudit.test.tsx
  modified:
    - src/game/dayTable.ts
    - src/screens/JoinByLink.tsx
    - src/styles/ds.css
    - test/unit/dayTable.test.ts
    - test/client/dayTable.test.tsx
    - test/client/joinByLink.test.tsx

key-decisions:
  - "하한 0.78 (UI-SPEC 권장 0.8 과 다름): 장면 240 에서 모델 기준(이름표 22) 넘침 0 이 되려면 0.7876 미만이어야 한다. 결정 0038 기록은 05-08 의 몫이다."
  - "링크 참가 광장 축소 값: 인물 48x64, 광장 gap 4·아래 여백 8, 머리글 아래 24, 카드 위 16, 위 여백 32, ul row-gap 4. 글자 14px 불변."

requirements-completed: []

duration: about 20min
completed: 2026-10-29
---

# Phase 5 Plan 04: 짧은 폰 테이블 압축 · 링크 참가 광장 축소 · CHAR-01 점검 Summary

**장면 높이 299 미만에서 좌석 원 세로 반지름·캐릭터 배율·테이블 면 높이를 같은 배율로 줄이고(하한 0.78), 링크 참가 화면은 5명 이상일 때 광장을 줄여 7명이 앉아도 360x640·390x664 한 화면에 들게 했으며, CHAR-01 점검표를 화면 렌더 시험으로 고정했다. 단, 실제 브라우저 측정에서 짧은 폰 맨 앞 이름표가 장면 아래로 4px 넘치는 것이 남았다(아래 「결정 필요」).**

## 수행한 일

서버·와이어·새 의존성·새 캐릭터 에셋 없음. `DayTable.tsx`·`verdict.ts` 불변.

### Task 1 — 트레이서: 짧은 장면 압축 (RED `8014df3` → GREEN `ec43c0e`)

- RED: HEAD 식을 시험 안 참조 구현으로 옮기고, 장면 높이 299~700 정수 × 폭 352·366·367·406 × 4~8명에서 새 기하·배치의 모든 필드가 참조 구현과 같음을 요구했다. 240~299 미만 모든 정수 높이 × 폭 4종 × 4~8명에서 맨 앞 이름표 아래끝 ≤ 장면 높이, 머리 위 ≥ 0, 이름표 상자(폭 100) 겹침 없음, 면 top ≥ 0. 240 미만(239·236·204.8·160.8·0)에서 배율이 하한에서 멈추고 머리 위 ≥ 0, `candidateCenter` 이름표 아래끝 ≤ 장면 − 4. 0·음수·NaN·Infinity 높이가 유한한 값(T-05-09). DayTable 렌더(`height={240}`·8명·폭 352)에서 모든 `.mf-dt__tag` top + 22 ≤ 240. 「받아들인 한계」 시험은 P5-3 새 계약 시험으로 교체했다.
- GREEN: `TABLE_FIT_SPAN`(= 2·SEAT_RY + FIG_H·DEPTH_K0 = 276.8)·`TABLE_FIT_MIN_SCALE`(0.78)·`tableFitScale`, `DayGeometry.fit`. `dayTableGeometry` 는 H ≥ 299 이면 HEAD 식 그대로(fit 1), 아니면 `ry = 100f`, `cy = max(ry + 76.8f, H − 22 − ry)`, 면 `top = cy − 60f`·`height = 108f`. `daySeatLayout` 은 `scale` 에 `fit` 을 곱한다. 이름표·가로 반지름·면 폭은 그대로. 머리 주석에 짧은 장면 규칙 한 문단. H = 299 에서 두 식이 cy 177 로 이어진다(298.99 도 ≈ 177).
- 트레이서 게이트: 자동 모드가 아니고 `<verify>` 가 자동 명령뿐이라 관련 시험(dayTable·verdict·stageBox·defense) 재실행 통과를 확인하고 이어 갔다.

### Task 2 — 링크 참가 광장 (RED `9a4a74d` → GREEN `cbc68de`)

- `SEATED_COMPACT_FROM = 5`. 앉은 사람 ≥ 5 이면 `ul.mf-join__seated--many` 와 (입력 카드가 보일 때) `main.mf-join--many`. `ds.css`: `.mf-join__seated--many .mf-figure` 48x64(3:4), `ul` row-gap 4, 광장 gap 4·아래 8, 머리글 아래 24, 카드 위 16, 위 여백 32. 모두 `var(--space-*)`(4의 배수). 글자 14px·최대 폭·4열 줄바꿈 불변.
- 시험: 4명 이하 수정자 없음, 5·7명 수정자와 li·그림·닉네임 수, ds.css 규칙(주석 제거) 3:4·글자 불변·4의 배수.
- **로컬 크롬 실측**(임시 스크립트, 저장소에 남기지 않음, 미리보기 응답 모의): 7명 360x640 문서 높이 640(내용 621, 목표 640 이하), 390x664 도 한 화면, 참가하기 버튼 아래끝 532/556. 5명은 360x560·375x553 에서도 스크롤 없음. 7명은 360x560(621)·375x553(621)에서 각각 61·68px 넘친다(계획의 목표 크기는 640·664 라 범위 밖, 이전 UI-SPEC 측정 173·180 에서 줄었다).

### Task 3 — CHAR-01 점검표 (`eb209b6`, 시험만)

- `figureSrc(0..7)` 8개 서로 다름·`figureSrc(s+8) = figureSrc(s)`·인자가 자리뿐. 대기실 5·8명, 낮(주장) 5·8명(내 역할이 시민/마피아여도 그림 동일), 후보 선택 8명(7번 탈락 = 유령 그림 + 닉네임 이름표)·5명, 결과 5·8명(카드마다 닉네임·자리 색 점·그림, 점 서로 다름), 링크 참가 7명(li 7개, 자리 번호 인물 + 닉네임) 12건. 처음부터 통과해 소스는 바꾸지 않았다(UI-SPEC §10 확인). `figureSrc` 를 `Math.min(seat, 5)` 로 망가뜨리면 6건이 실패함을 확인한 뒤 되돌렸다.

## 시험·검증 결과

| 검사 | 결과 |
|------|------|
| `npx vitest run --project unit test/unit/dayTable.test.ts test/unit/verdict.test.ts` | 167건 통과 |
| `npx vitest run --project client test/client/dayTable.test.tsx test/client/stageBox.test.tsx test/client/defense.test.tsx` | 196건 통과 |
| `npx vitest run --project client test/client/joinByLink.test.tsx test/client/entryContrast.test.tsx test/client/screens.test.tsx` | 67건 통과 |
| `npm test` | 105 파일, 2921건 통과 |
| `npm run typecheck` | 종료 코드 0 |

인수 기준 grep: `TABLE_FIT_MIN_SCALE` export 1, `tableFitScale` export 1, 「받아들인 한계」 0, `mf-join__seated--many` JoinByLink 1·ds.css 2, `SEATED_COMPACT_FROM` 2, `DayTable.tsx`·`public/characters`·`design/characters` 의 (05-04) 커밋 0. 기준 수치·E2E 한도(`APPROVED_RELAXATIONS` 포함)는 건드리지 않았다. `.planning/milestone.lock`·`state.json`·`Claude outputs/` 는 커밋하지 않았다.

## 계획과 달라진 점

### 자동 수정한 것

없음.

### 계획 문구와 다르게 한 것

1. **「높이 298 도 cy 177」 시험도 교체:** 계획은 476행 「받아들인 한계」 시험만 교체하라고 했으나, 같은 계약(299 미만에서 cy 가 177 에서 멈춘다)을 단언하던 기하 표의 「높이 298」 시험이 새 계약과 충돌해 「299 미만은 압축한다」 로 바꿨다. 299 이상 시험은 그대로다.
2. **`TABLE_FIT_SPAN` 상수를 export:** 계획의 「배율 식의 분모 상수」 를 시험이 값을 단언하도록 공개 이름으로 뒀다.
3. **로컬 브라우저 실측을 해 봤다:** 계획은 판정을 05-06 E2E 에 미뤘지만, 하한 0.78 이 「넘침 없음」 을 실제로 만족하는지 보려고 로컬 dev + 헤드리스 크롬으로 한 번 쟀다. 그 결과가 아래 「결정 필요」 다.

## 결정 필요 (미해결)

**짧은 폰 맨 앞 이름표가 실제 화면에서 장면 아래로 4px 넘친다.** 모델은 이름표 높이를 22(알약)로 두고 `tagTop` 에서 시작한다고 가정하는데, 실제 DOM 에서는 `.mf-dt__tag` 상자가 26px 이고 알약이 그 안 아래쪽(`tagTop + 4 ~ tagTop + 26`)에 놓인다(인라인 줄 상자의 스트럿; `verdict.ts` 의 「상자는 알약보다 4 크다」 주석과 같은 원인). 로컬 실측(테스트 방 8명, 대기실·주장·후보 선택 같음):

| 방 크기 | 장면 높이 | 맨 앞 이름표 상자 아래끝 − 장면 아래끝 | 알약 아래끝 − 장면 아래끝 | 맨 뒤 머리 위 |
|---|---|---|---|---|
| 360x560 | 283.8 | +4 | +4 | -0.1(반올림) |
| 375x553 | 276.8 | +4 | +4 | 0 |
| 360x640 | 363.8 | -27.8 | - | +33.2 |
| 390x664 | 387.8 | -51.8 | - | +33.2 |

이전 측정(UI-SPEC §11.2: 360x560 +19~21, 375x553 +26)에서 크게 줄었지만 0 이 아니다. E2E D2(`rectInside`, 허용 0.5)는 `.mf-dt__tag` 상자를 재므로 05-05 가 만드는 `360x560` probe 는 이대로면 **D2 가 4px 차로 실패**한다. 이 계획의 단위 시험은 모델(22) 기준이라 모두 통과한다. 같은 4px 은 이미 H = 299~302 구간에서도 존재한다(승인 기하라 건드리지 않음, 현재 E2E 크기에는 걸리지 않음).

선택지(오케스트레이터 결정):
1. **압축 식에 상자 높이 26 반영:** `f = (H − 26)/276.8`, 하한 `(240 − 26)/276.8 = 0.7731` 미만(예 0.77), `cy = H − 26 − ry`. 장면 240 에서 상자 기준 넘침 0. H = 299 경계에서 cy 가 4px 어긋나는 불연속이 생기고, 299~302 의 기존 4px 은 남는다. `dayTable.ts` 와 시험만 바뀐다.
2. **스트럿 제거(CSS `.mf-dt__tag { display: flex }`):** 실측으로 상자 = 알약 = 22, 아래끝 넘침 0 이 되지만 모든 낮 장면의 이름표가 4px 위로 올라가 승인 기하·D3 보이는 비율·후보 이름표 공식(결정 0037)에 영향이 간다. 전체 E2E 가 필요한 더 큰 변경.
3. **지원 하한 높이를 올림:** 방 높이 516 대신 약 520 이상으로(장면 244 이상) 문서화. 하한 문서 결정(P5-3 확정을 다시 여는 일).

그 밖의 알림:
- 하한 0.78 과 UI-SPEC 권장 0.8 의 차이(장면 240 에서 이름표 3.4px 넘침 방지)는 결정 0038 에 적어야 한다(05-08). 선택지 1 을 쓰면 0.77 로 바뀐다.
- 링크 참가 화면: 4명 이하도 360x560·375x553 에서 문서가 48~55px 넘친다(원래부터, 이 계획 범위 밖). 7명은 61~68px. 계획이 요구한 360x640·390x664 는 만족한다.

## 인증 게이트

없음.

## 알려진 스텁

없음.

## 위협 표면 점검

새 엔드포인트·인증 경로·파일 접근·스키마 변경 없음. T-05-09(첫 측정 0·음수·NaN 높이)는 `tableFitScale` 하한과 NaN → 0 처리로 닫았고 시험이 0·-50·NaN·Infinity 에서 모든 기하·배치 값이 유한함을 단언한다. T-05-10(역할로 외형 추측)은 CHAR-01 시험이 외형이 자리 번호만의 함수이고 내 역할이 바뀌어도 모든 자리 그림이 같음을 고정해 닫았다. T-05-SC 새 패키지 없음.

## 사람이 할 일 · 이어지는 계획

- 위 「결정 필요」 의 선택지를 정한 뒤 05-05(`360x560` probe)를 실행해야 D2 가 의미 있게 판정된다.
- 광장 축소의 최종 판정은 05-06 의 `UX2-J`(로컬 실측은 640·664 에서 통과). 모자라면 05-06 이 `ds.css` 값만 조정한다.
- 결정 0038 에 하한 0.78(또는 0.77) 과 광장 수정자, 스트럿 4px 사실을 적는 일은 05-08. 요구사항 UX-02·CHAR-01 은 이 계획에서 완료 표시하지 않는다(E2E 판정 뒤).

## Self-Check: PASSED

- 만든 파일 `test/client/characterAudit.test.tsx`, 이 SUMMARY 존재 확인.
- 커밋 `8014df3`·`ec43c0e`·`9a4a74d`·`cbc68de`·`eb209b6` 이 HEAD 의 조상임을 확인.
- `commits: 5` 는 `git rev-list --count d502f9f..HEAD` 로 쟀다(SUMMARY 커밋 전).
