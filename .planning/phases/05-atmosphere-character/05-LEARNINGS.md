---
phase: 5
phase_name: "분위기와 캐릭터"
project: "minifia"
generated: "2026-10-30"
counts:
  decisions: 6
  lessons: 5
  patterns: 5
  surprises: 4
missing_artifacts:
  - "05-UAT.md 항목별 기록 없음 (전체 승인만 기록됨)"
---

# Phase 5 Learnings: 분위기와 캐릭터

## Decisions

### 안내 문장은 상수 한 곳에서 만들고 역할을 입력으로 받지 않는다
`PHASE_GUIDE_FILL`·`TIMELESS_PHASES` 를 `src/game/scenes.ts` 한 곳에 두고, 낮 시작 하단은 생존자·탈락자 모두 같은 두 줄로 한다.

**Rationale:** 안내 문장이 역할을 드러내지 않게 하고(T-05-01), 점검표 시험과 E2E 상수 동일성(`e2eContract.test.ts`)을 한 곳에서 지키기 위해서다.
**Source:** 05-01-SUMMARY.md, 05-SECURITY.md

### Wake Lock 재요청은 visibilitychange 한 곳뿐
sentinel 의 release 이벤트는 참조를 비우는 표시로만 쓰고, 거부·release 에서는 재시도하지 않는다. 대기실부터 화면 꺼짐 방지를 건다(active 조건 한 줄이라 바꾸기 쉬운 기본값).

**Rationale:** 저전력 모드에서 반복 거부 시 재요청 루프를 막고(T-05-03), 실패는 조용히 삼켜 미지원 기기에서도 게임이 진행되게 한다.
**Source:** 05-02-SUMMARY.md, 05-SECURITY.md

### 짧은 폰 압축 하한은 0.77, 이름표 상자 26 기준
UI-SPEC 권장 0.8 이 아니라 `f=(H-26)/276.8`, 하한 `TABLE_FIT_MIN_SCALE=0.77` 로 정했다. 장면 높이 240 에서 넘침이 0 이려면 0.7731 미만이어야 한다.

**Rationale:** 실제 DOM 의 `.mf-dt__tag` 상자가 26 이고 알약(22)이 그 안에 놓이며, E2E D2 가 이 상자를 잰다.
**Source:** 05-04-SUMMARY.md, 05-08-SUMMARY.md

### [테스트] 버튼은 장면 높이 299 미만에서만 44 폭으로 좁힌다 (사용자 결정)
360x560 에서 버튼이 2번 자리 상자와 세로 35.9px 겹쳤다. dayTable 압축으로는 풀 수 없어 위치는 두고 폭만 88 → 44 로 줄였다. D4 허용 3px 는 그대로다.

**Rationale:** 자리 2 를 33px 내리면 맨 앞 이름표가 장면 밖으로 넘친다. 기준 수치를 완화하지 않는 쪽을 택했다.
**Source:** 05-06-SUMMARY.md

### 캐릭터 외형은 자리 번호만의 함수, 움직임·새 에셋 없음
`figureSrc(seat)` 는 역할·능력과 무관하다. 직업 그림은 관전자 한 곳에서만 보인다.

**Rationale:** 외형으로 역할을 추측하지 못하게 한다(T-05-10). 움직임 없음·새 에셋 없음은 사용자 결정(0038 D-01·D-02)이다.
**Source:** 05-VERIFICATION.md, 05-SECURITY.md

### 게이트 실패는 기준 완화가 아니라 원인 분류로 다룬다
`APPROVED_RELAXATIONS` 5건과 smoke 도착 편차 한도 500ms 를 건드리지 않고, 간헐 실패는 같은 버전 단독 재실행으로 가려 모든 시도를 표로 적었다.

**Rationale:** 게이트 실패를 기준 완화로 덮는 것(T-05-19)을 막고 정직한 집계를 남긴다.
**Source:** 05-09-SUMMARY.md, 05-SECURITY.md

---

## Lessons

### 로컬 브라우저 실측이 모델 가정의 오류를 먼저 잡았다
계획은 판정을 E2E 에 미뤘지만 헤드리스 크롬으로 재 보니 첫 판 압축이 맨 앞 이름표를 4px 넘치게 했다. 이름표를 22 로 모델링한 것이 원인이었다.

**Context:** 05-04 하한 0.78 첫 판. 후속 수정으로 26 기준으로 고쳤다.
**Source:** 05-04-SUMMARY.md

### 측정 프로브가 틀린 것을 앱 결함으로 오인하지 말 것
AT2 실패는 `.mf-dt__tag` 가 평소 `pointer-events: none` 이라 프로브가 이름표를 건너뛴 측정 결함이었다. CSS 쌓임은 정상이라 `atmosphere.css` 는 건드리지 않았다.

**Context:** 밤·아침 층이 탭을 가로채는지 `elementFromPoint` 로 판정하는 E2E.
**Source:** 05-06-SUMMARY.md

### 짧은 화면 문제는 한 곳의 기하로 풀리지 않을 수 있다
`dayTable.ts` 의 H<299 분기만으로는 D4 겹침이 풀리지 않아 UI 부품(`TestTools`)을 따로 조정해야 했다. 계획의 `files_modified` 밖 편차였고 사용자 결정이 필요했다.

**Context:** 360x560 의 [테스트] 버튼과 2번 자리 겹침.
**Source:** 05-06-SUMMARY.md

### 계약을 바꾸면 옛 계약을 단언하던 시험이 함께 깨진다
토론 안내줄 계약 변경으로 계획 목록에 없던 `phaseScreens.test.tsx` 와 `sceneIntro.test.tsx` 의 단언을 고쳐야 했다. 299 계약 변경도 기하 표의 "높이 298" 시험을 함께 바꿔야 했다.

**Context:** 전체 클라이언트 시험을 돌려서야 발견했다.
**Source:** 05-01-SUMMARY.md, 05-04-SUMMARY.md

### 체감 항목은 자동 시험으로 닫을 수 없어 실기기 승인에 의존한다
비네팅·아침 밝아짐의 체감, iOS·저전력 모드 Wake Lock 실효는 사용자가 2026-10-30 에 ①~⑮ 를 전체 승인했으나 항목별 기록은 없다. 조정은 `scenes.ts`·`dayTable.ts` 상수 한 곳에서 한다.

**Context:** 알려진 한계(결정 0038).
**Source:** 05-VERIFICATION.md, 05-UAT.md, 05-03-SUMMARY.md

---

## Patterns

### 값 없는 `data-guide=""` 속성으로 화면당 주 안내 하나를 계약화
항상 주 안내인 부품은 부품 안에서 붙이고, 보조 줄로도 쓰이는 부품은 `guide` prop 으로 장면이 켠다. 점검표 시험은 `Record<PhaseId, 시점[]>` 라서 새 단계가 생기면 타입 오류로 알린다.

**When to use:** 시각 요소의 존재·유일성을 DOM 계약으로 시험하고 E2E 가 같은 속성을 읽게 할 때.
**Source:** 05-01-SUMMARY.md

### 시각 효과 층은 `pointer-events: none` 과 좁은 입력으로 제한
비네팅·아침 밝아짐 층은 입력이 장면·`view.phase`·전환 여부뿐이고 CSS 에 `pointer-events: none` 이 있다. 단위 시험은 CSS 원문을, E2E 는 `elementFromPoint` 탭을 검사한다.

**When to use:** 장식 층이 탭을 막지 않고 역할 정보를 흘리지 않아야 할 때.
**Source:** 05-03-SUMMARY.md, 05-SECURITY.md

### 측정값 누락은 통과가 아니라 "측정값 없음" 실패
E2E 새 검사는 누락·비숫자를 실패로 처리하고, 순수 판정 함수(`lib.mjs`)는 `node --test` 로 따로 시험한다.

**When to use:** 브라우저 측정에 의존하는 검사가 거짓 통과하지 않게 할 때.
**Source:** 05-05-SUMMARY.md, 05-SECURITY.md

### 기하는 순수 함수로 두고 경계·범위 표로 시험
`tableFitScale` 은 NaN·0·음수·Infinity 를 하한으로 처리한다. 240~298 높이 × 폭 4종 × 4~8명 표와 무작위 500단계 × 20 시드 좌석 시험으로 닫았다.

**When to use:** 레이아웃 계산이 브라우저 측정값(첫 측정 0 포함)을 받을 때.
**Source:** 05-04-SUMMARY.md, 05-VALIDATION.md

### 측정 밖 브라우저 API 도 가짜 객체 도우미로 공유
sentinel·`navigator.wakeLock`·`visibilityState` 모의를 `test/helpers/wakeLockFake.ts` 한 곳에 두고 훅 시험과 RoomScreen 시험이 함께 쓴다. E2E 시험 전용 init 스크립트는 `addInitScript` 로 시험 컨텍스트에만 주입한다.

**When to use:** 같은 브라우저 API 모의가 여러 시험에 필요하고 앱 번들에 섞이면 안 될 때.
**Source:** 05-02-SUMMARY.md, 05-SECURITY.md

---

## Surprises

### 299 경계에서 cy 가 약 2.6px 어긋난다
승인 기하(cy 177)와 압축 식(298.99 에서 174.4)이 만나는 지점에 불연속이 있다. 계획이 예상한 약 4px 보다 작았다. H=299~302 에서는 승인 기하 때문에 상자가 최대 4px 넘치지만 현재 E2E 크기에는 걸리지 않는다.

**Impact:** 받아들인 값으로 문서화했고 승인 기하는 건드리지 않았다.
**Source:** 05-04-SUMMARY.md

### 실제 이름표 상자(26)는 알약(22)보다 크다
폭 99 의 5글자 이름표는 상자끼리 약 3px 세로로 겹칠 수 있다. E2E 봇 이름이 3글자라 걸리지 않았다.

**Impact:** 압축 하한이 UI-SPEC 권장값(0.8)과 달라졌고 결정 0038 에 기록했다.
**Source:** 05-04-SUMMARY.md, 05-08-SUMMARY.md

### 배포본 smoke 가 간헐 실패했다
8명(2회)과 4명(1회)이 도착 편차 520ms·958ms 등으로 실패했으나 같은 버전 재실행에서 통과했다. 서버·와이어는 불변이고 ping 은 안정이었다. 4페이즈에서도 같은 경향이다.

**Impact:** 네트워크·CPU 지터로 분류했고 원인은 미확정이다. 한도 500ms 는 유지했다.
**Source:** 05-09-SUMMARY.md, 05-VERIFICATION.md

### 링크 참가 7명은 짧은 화면에서 원래부터 넘친다
360x560·375x553 에서 광장이 넘치며 지원 밖으로 문서화됐다. E2E `UX2-J` 는 높이 640 이상만 판정한다(`JOIN_FIT_MIN_H`).

**Impact:** 지원 범위 제한이 생겼다. 압축으로 풀 수 없는 영역이 있음을 알게 됐다.
**Source:** 05-VERIFICATION.md, 05-05-SUMMARY.md
