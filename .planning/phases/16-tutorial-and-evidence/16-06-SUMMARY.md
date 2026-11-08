---
phase: 16-tutorial-and-evidence
plan: "06"
subsystem: ui-side-column
tags: [css, side-column, buttons, e2e, tdd, vitest, BTN-02]
requires:
  - phase: 16-05
    provides: 상자가 곧 면인 아이콘 단추 규칙(머리 44·입력줄 48), 라벨 규칙 삭제
provides:
  - SideColumn 부품과 순수 함수 splitSideColumn(칸 나누기, 한 열 최소 2개, 오른쪽 열부터)
  - 소리·맵·봇·옷장이 오른쪽 16, 위 = 띠 아랫변 + 12, 지름 52, 간격 12 의 같은 원(상자가 곧 면)
  - 방장 대기실 소리·맵·봇·옷장 / 손님 소리·옷장, 결과 화면(시상 뒤) 방장 소리·맵·옷장 / 손님 소리·옷장
  - 소리 독 아랫변 = 띠 아랫변 + 64
  - useMapInsets 가 열 최대 높이 sideMaxH 를 잰다
  - E2E sideColumnChecks(SC1~SC6)·SIDE_COLUMN_EXCEPTIONS·SIDE_MARKERS, 소리 기하 52/12, 지도 칩·옷장·시상 [넘기기] 판정 갱신
affects: [16-07, 16-08, 16-10]
actuals:
  tokens: 38000
  tasks: 3
  commits: 4
plan_head_before: 10b83db3ffc718d74ffc731f0bfe96065cea1267
commits: 4
plan_head_after: ed8ff818ccf92ea9fc7a8ee743b01ea804f99034
tech-stack:
  added: []
  patterns:
    - "열 단추는 상자가 곧 면: .mv-sound·.mf-mapchip 은 52 원 상자 자신(안쪽 face/disc 요소 없음), .mv-float 은 48 원 상자이고 data-side-button 이 붙으면 52"
    - "열 나누기는 CSS wrap 이 아니라 splitSideColumn 이 칸 수를 정한다: k = max(2, floor((maxH+12)/64)), 열 div 는 row-reverse 로 오른쪽부터"
    - "첫 칸 .mv-side__slot 은 독의 소리 단추 자리를 비워 둔다(aria-hidden, 눌림 통과) — HostBand.tsx 는 바꾸지 않는다"
key-files:
  created:
    - src/components/v2/SideColumn.tsx
    - test/client/sideColumn.test.tsx
  modified:
    - src/components/v2/SoundButton.tsx
    - src/components/v2/MapChip.tsx
    - src/components/v2/FloatAction.tsx
    - src/net/useMapInsets.ts
    - src/screens/Lobby.tsx
    - src/screens/ResultScreen.tsx
    - src/styles/v2.css
    - src/styles/lobby.css
    - src/styles/result.css
    - test/client/soundButton.test.tsx
    - test/client/mapChip.test.tsx
    - test/client/hostBand.test.tsx
    - test/client/lobby.test.tsx
    - test/client/resultScreen.test.tsx
    - test/client/dressSheet.test.tsx
    - test/client/toolLabels.test.tsx
    - test/unit/tokensV2.test.ts
    - test/unit/e2eContract.test.ts
    - scripts/e2e/lib.mjs
    - scripts/e2e/lib.test.mjs
    - scripts/e2e/browser.mjs
    - scripts/e2e/flows.mjs
    - scripts/e2e/avatar.mjs
    - scripts/e2e/mapselect.mjs
    - scripts/e2e/mapselect.test.mjs
    - scripts/e2e/result.mjs
    - scripts/e2e/result.test.mjs
    - scripts/e2e/sound.mjs
decisions:
  - "열 단추 52 원은 data-side-button 이 붙은 것만이다. 게임 화면 떠 있는 단추(직업·귓속말)와 시상식 [넘기기]는 48 원 그대로 제자리"
  - "시트(꾸미기)가 열려 있거나 키보드가 열려 있으면 대기실 열을 그리지 않는다. 결과 화면은 시상이 끝나고 확장 탭·시트가 닫혀 있을 때만 그린다"
  - "열 최대 높이는 useMapInsets 의 측정(방 높이 − 패널 높이 − 8 − (띠 아랫변 + 12))으로 넘긴다. 측정 전에는 Infinity 라 한 열"
  - "손님에게는 맵 칩을 그리지 않는다(맵 선택은 서버가 방장만 받는 그대로, T-16-13). 방장의 칩만 mapChip host 로 그린다"
status: complete
---

# Phase 16 Plan 06: 오른쪽 한 줄 열 Summary

소리·맵·봇·옷장을 오른쪽 세로 한 줄의 같은 52 원으로 모으고(SideColumn), 손님에게서 맵·봇을 빼고, 넘치면 두 번째 열로 접히게 했다. 결과 화면도 같은 열을 쓰고 E2E 가 폰 크기마다 열 규칙·교차를 판정한다.

## 한 일

| 작업 | 내용 | 커밋 |
| --- | --- | --- |
| 1 RED | SideColumn·splitSideColumn·52 원 CSS·독 B+64·표식 시험 + 크기 기대 갱신 | e66c00ad |
| 1 GREEN | SideColumn.tsx, 소리·맵·FloatAction 52 원(상자가 곧 면), `.mv-side*` CSS, 독 위 안쪽 여백 4 | c4e2aef6 |
| 2 | 대기실·결과 화면 배치, `.mf-lobby__map`·`.mf-result__map` 삭제, useMapInsets 의 sideMaxH, 시험 갱신 | 87aa4f93 |
| 3 | sideColumnChecks, 소리 기하 52/12, DB1·AW5·MS1·MS2·SK4 갱신, 열 읽기 함수, 로컬 E2E | ed8ff818 |

- 열: `.mv-side`(absolute, 오른쪽 16, 위 `calc(var(--mf-host-bottom, 62px) + 12px)`, row-reverse, 간격 12, z-overlay). 눌림은 열 자체가 통과시키고 단추만 받는다. 시트가 열리면 `:has([data-sheet-layer])` 규칙으로 숨는다.
- 소리 독: `.mv-host__dock` 안쪽 위 여백 4 + 띠 아래 간격 8 = 12, 소리 원 52 → 독 아랫변 = 띠 아랫변 + 64(hostBand 시험 기대 182 = 118 + 64). 증거 카드·기록 카드·위 알림은 `--mf-host-dock` 를 그대로 따라 내려간다. HostBand.tsx·RULESET 은 `git diff 9d6dba72` 로 불변을 확인했다.
- 소리 잠김 알약: 상자 자신이 `width:auto; min-width:112` 로 늘어나고 독이 오른쪽 정렬이라 오른쪽 변이 움직이지 않는다. 열 판정은 알약의 오른쪽 52 몫만 쓴다.
- FloatAction 의 `face` 요소, MapChip 의 `disc`, SoundButton 의 `face` 를 모두 없앴다(상자가 곧 면). `.is-call` 빛남 테두리는 pill 모서리를 따른다.

## 로컬 E2E (개발 서버, 360x640 · 360x560)

| 흐름 | 360x640 | 360x560 | 비고 |
| --- | --- | --- | --- |
| lobby | 40/40 | 39/39 | SC1~SC6(방장) 추가 |
| map-select | 51/51 | 51/51 | 방장·손님 SC1~SC6(대기실·결과), MS1 오른쪽 열 52 원, MS2 손님 칩 없음 |
| sound-unlock | 24/24 | 24/24 | SU1~SU7 새 기하(52·띠+12), SK4 갱신 |
| emcee-band | 31/31 | 31/31 | |
| result-rematch | — | 19/19 | 고정 크기(360x560) 흐름 |
| witness | 13/13 | 13/13 | 기록·증거 카드가 독 아랫변 D 를 따름 |
| avatar-dress (추가) | 32/32 | 32/32 | DB1 52 열 단추 |
| result-awards (추가) | 20/20 | 21/21 | AW5 [넘기기] 48x48 제자리 |
| chat-lobby (lobby 와 함께 매칭) | 23/23 | 23/23 | |

처음 한 번 돌렸을 때의 실패 5건(lobby 두 건: 판정 줄 기록 방식, sound-unlock SK4 두 건, avatar-dress 360x560 DB1)을 고쳐 해당 흐름만 다시 돌려 모두 통과했다. 판정 문턱은 낮추지 않았다. 개발 서버는 껐다. 6폰 전체·nightload 는 돌리지 않았다(16-10 몫).

## 시험 결과

- `npm run typecheck` 통과, `npm test` 261 파일 / 7532 시험 통과(6 파일 건너뜀, 기준선 7507 + 새 시험 25).
- `node --test scripts/e2e/lib.test.mjs scripts/e2e/mapselect.test.mjs scripts/e2e/result.test.mjs` 460 통과.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] splitSideColumn 예시 수치가 인터페이스 식과 맞지 않았다**
- **Found during:** Task 1 RED
- **Issue:** `<behavior>` 의 (4, 180) → [2, 2], (5, 180) → [2, 2, 1] 은 interfaces 의 식 `k = max(2, floor((maxH+12)/64))` 와 어긋난다(180 에서 세 칸이 딱 들어가 [3, 1]).
- **Fix:** 식을 기준으로 구현하고 시험은 (4, 180) → [3, 1], (4, 179) → [2, 2], (5, 116) → [2, 2, 1] 로 썼다.
- **Files modified:** src/components/v2/SideColumn.tsx, test/client/sideColumn.test.tsx
- **Commit:** e66c00ad, c4e2aef6

**2. [Rule 3 - Blocking] 열 단추의 상자와 면을 합치며 mapselect 판정을 Task 1 에서 먼저 바꿨다**
- **Found during:** Task 1 GREEN
- **Issue:** `test/unit/e2eContract.test.ts` 가 `scripts/e2e/mapselect.mjs` 의 MAP_CHIP(disc 36)을 CSS 와 대조한다. 칩이 52 원이 되면 대조가 깨져 Task 1 커밋이 초록이 될 수 없다.
- **Fix:** MAP_CHIP 을 { disc 52, hit 52, right 16, below 76 } 으로, MS1·MS2 판정과 시험을 Task 1 커밋에서 바꿨다. 흐름 쪽(열 읽기·손님 칩 없음)은 Task 3.
- **Files modified:** scripts/e2e/mapselect.mjs, scripts/e2e/mapselect.test.mjs, test/unit/e2eContract.test.ts
- **Commit:** c4e2aef6

**3. [Rule 1 - Bug] 시트가 열려 있으면 열이 없으므로 맵 칩 E2E 의 읽는 시점을 바꿨다**
- **Found during:** Task 3
- **Issue:** 예전 칩은 시트가 열려 있어도 보였다. 지금은 대기실에서 꾸미기 시트가 열리면(그리고 결과 화면에서도) 열이 그려지지 않는다. map-select 의 MS7·MS9 가 시트가 열린 채 칩 라벨을 읽고 있었다.
- **Fix:** MS7·MS9 는 시트의 선택 카드로 판정하고, 시트를 닫은 뒤 칩 라벨을 MS9b 로 본다. MS1·MS6 은 시트를 열기 전에 읽은 칩 값을 쓴다.
- **Files modified:** scripts/e2e/mapselect.mjs
- **Commit:** ed8ff818

**4. [Rule 1 - Bug] 16-04 가 남긴 낡은 기대 SK4**
- **Found during:** Task 3 로컬 E2E
- **Issue:** sound-unlock SK4 가 끈 단추의 한 단어 라벨 '소리' 를 기대했다. 이름표는 16-04 에서 없어졌다.
- **Fix:** 글이 없음('')을 기대로 바꿨다.
- **Files modified:** scripts/e2e/sound.mjs
- **Commit:** ed8ff818

**5. [Rule 1 - Bug] 옷장 DB1 이 두 열로 접힌 폰(360x560 방장)을 거절했다**
- **Found during:** Task 3 로컬 E2E
- **Issue:** 360x560 방장 대기실은 칸 나누기가 옷장을 둘째 열에 놓아 오른쪽 여백이 80 이었다.
- **Fix:** DB1 은 오른쪽 여백 16 또는 둘째 열 80(= 16 + 52 + 12)을 허용한다. 그 밖의 값은 실패다.
- **Files modified:** scripts/e2e/lib.mjs, scripts/e2e/lib.test.mjs
- **Commit:** ed8ff818

### 계획 해석

- **52 원은 열 단추만:** 이월 메모는 `.mv-float` 전체를 52 로 합치라고 읽힐 수 있었으나, 계획 본문("side 를 준 것", "시상식 [넘기기]는 제자리", FB4 의 48)에 따라 `data-side-button` 이 붙은 단추만 52 원이고 나머지 떠 있는 단추는 48 원(상자가 곧 면)이다. AW5 는 [넘기기] 48x48 로 바꿨다(이월 메모의 현재 실패였던 71.6 기대 해소).
- **sideMaxH 는 useMapInsets 가 잰다:** 계획은 "Lobby·ResultScreen 이 이미 재는 값에서 계산"이라 했으나 방 높이·띠 아랫변·패널 높이를 한곳에서 아는 곳이 훅이라 거기서 계산해 `sideMaxH` 로 돌려준다(측정 전 Infinity).
- **v2parts.test.tsx 는 바꾸지 않았다:** FloatAction 시험은 sideColumn.test.tsx 가 맡는다(그 파일에는 FloatAction 시험이 원래 없었다).
- **결과 화면 시상 중에는 맵 칩이 없다:** 예전 칩은 시상 중에도 헤더 아래에 있었으나(시상 패 밑), 계획대로 열은 시상이 끝난 뒤에만 나온다.
- **360×560 방장 대기실 예외:** `SIDE_COLUMN_EXCEPTIONS` 에 문서화했다. 그러나 실제 측정에서는 열이 두 열로 접혀 교차가 없었고 SC2 가 그대로 통과했다(예외는 쓰이지 않았다). 결정 0079 문서가 아직 없어(`docs/decisions/` 는 0078 까지) 알려진 한계 기록은 그 결정을 쓰는 계획으로 이월한다.

## Known Stubs

없음.

## Threat Flags

없음. data-side-column·data-side-button 값은 sound·map·bots·dress 고정 낱말뿐이고 e2eContract 가 소스의 값 집합을 고정한다(T-16-14). 손님 화면에는 맵 칩·봇 단추가 없고 시험이 검사한다(T-16-13).

## Self-Check: PASSED

- 생성 파일 `src/components/v2/SideColumn.tsx`, `test/client/sideColumn.test.tsx` 확인.
- 커밋 e66c00ad, c4e2aef6, 87aa4f93, ed8ff818 이 HEAD 의 조상임을 확인.
