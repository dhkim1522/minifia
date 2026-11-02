---
phase: 08-day-execution-ghost
plan: "15"
subsystem: nomination-screen
tags: [tdd, tracer, gamemap, nomination, pick-button, toast-queue, deny, blink, reject]
status: complete

requires:
  - phase: 08-day-execution-ghost
    provides: 08-06 dayView(pointsTally·dayEvents·ToastQueue·DAY_COPY), 08-08 presence(sceneLook·pointingOf·leaderShift), 08-12 WorldStage(pick·tagProps·scene·deny·canWalk), 08-13 GameMap 틀·useDayFx(announce)
provides:
  - GameMap 지목 단계 — pick(나를 뺀 산 사람의 이름표 버튼 + 낙관적 mine)·tagProps(서버 집계의 배지·선두·도장·깜빡임)·장면 표에 낙관적 mine 반영
  - useDayFx — ToastQueue 구동(toast 반환)과 선두 교체 손사래 신호(deny 반환)
  - 지목 거절 처리(WRONG_PHASE / 그 밖) 와 서버 값으로 되돌림
  - 처음 보는 지목 3초 깜빡임(localStorage mf-hint-point)
  - test/client/nominationScreen.test.tsx (37개)
affects: [08-16 변론 화면(같은 GameMap·tagProps 확장), 08-17 유령 화면(RoleChip 분기), 08-23 E2E(8개 버튼 무가림·6개 폭)]

actuals:
  tokens: 10500
  tasks: 3
  commits: 6
plan_head_before: 398966c0621346f8fa8a85595bfc9e36b8e1c47f
plan_head_after: 4bd6694a3b7df532d27348e5d2ea1aaf18a1eea1

tech-stack:
  added: []
  patterns:
    - "연출 상태는 방 화면(RoomScreen)의 useDayFx 가 쥐고 상태로 내려준다: 위 알림은 id 가 붙은 값(화면은 id 가 바뀔 때만 띄우고 마운트 때 값은 지난 것으로 본다), 손사래는 {seat, nonce} 선언형 신호"
    - "낙관적 선택은 useViewChoice(서버 view 가 오면 서버 값이 이김) + 거절 카운터로 서버 값 복귀 (GamePanel 의 endDiscussion 과 같은 방식)"
    - "남의 지목·득표·선두·과반은 서버 day.points 의 집계(pointsTally)에서만 — 내 선택만 응답 전에 보인다 (T-08-38)"

key-files:
  created:
    - test/client/nominationScreen.test.tsx
  modified:
    - src/screens/GameMap.tsx
    - src/net/useDayFx.ts
    - src/screens/RoomScreen.tsx
    - src/components/v2/TopToast.tsx

key-decisions:
  - "위 알림은 RoomScreen 의 useDayFx 가 ToastQueue 로 순서를 세우고 상태 `toast {id,text,icon,durationMs}` 로 내려, GameMap 이 id 가 바뀔 때 TopToast 에 띄운다(GameMap 은 낮 시작마다 새로 마운트되어 직전 view 를 모르는 08-13 구조 때문). 계획의 '속성으로 show 를 받음' 대신 상태 반환을 택했다"
  - "TopToast.show 에 선택 인자 durationMs 를 더했다(대기 2건 이상이면 건당 0.8초). 기존 호출은 그대로 1.5초"
  - "깜빡임 기록은 3초가 끝나거나 이름표를 누를 때 한다(시작 때 기록하면 개발 모드 이중 실행의 두 번째 실행이 기록을 읽고 깜빡임을 꺼 버린다). 저장소를 못 읽으면 깜빡이고 못 쓰면 이번 방문에서만 본다"
  - "지목 거절 판정: 지목을 보낸 뒤 3초 안, 서버가 내 선택을 아직 확인하지 않은 때의 오류 프레임만 지목 거절로 본다. WRONG_PHASE 는 '지금은 고를 수 없어요', 그 밖은 '보내지 못했어요. 다시 해 보세요'. 보낸 적 없는 지목에 대한 그 밖의 오류(채팅 속도 제한 등)는 알림도 되돌림도 없다(08-13 의 E1 #4 시험 유지)"
  - "보내지 못했을 때(send false)는 내 선택 표시를 바꾸지 않고, 같은 사람을 다시 누르면 보내지도 않는다(취소 없음)"
  - "tagProps 와 pick 은 지목 단계에서만 넘긴다. 변론의 변론자 배지·도장(08-16)과 유령의 직업 칩(08-17)은 그 계획이 같은 자리를 확장한다"

requirements-completed: []

coverage:
  - id: D1
    description: "나를 뺀 산 사람 이름표가 data-pick 버튼('{닉네임} 님 가리키기', role=group '지목'), 누르면 point 전송과 그 이름표만 즉시 mine·이전 것 해제, 같은 사람 재누름은 전송·변화 없음, 소켓 닫힘(send false)이면 표시 불변, 끊김이면 모두 aria-disabled, 유령에게는 버튼 0"
    requirement: DAY-04
    verification:
      - kind: component
        ref: "test/client/nominationScreen.test.tsx '이름표 하나 누르기' (4 tests) · '거절·끊김' (3 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "득표 배지·선두·유력 도장은 서버 day.points 집계에서만(0표는 배지 없음, 동점이면 선두 해제, 과반 풀리면 도장 사라짐), 내 선택은 응답 전에도 내 캐릭터 pointAt 에만 반영"
    requirement: DAY-05
    verification:
      - kind: component
        ref: "test/client/nominationScreen.test.tsx '이름표 하나 누르기' · '장면 상태' (7 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "위 알림: 합치기 창 400ms 뒤 '영희 → 서준'(point 아이콘)·'(바꿈)'·'영희·지아 → 서준' 합치기·서로 다른 대상은 줄 세워 0.8초 간격, 채팅 vote 줄·'지목 시작'·hot '님이 앞서요'·'님 과반', 닉네임은 텍스트 노드"
    requirement: DAY-04
    verification:
      - kind: component
        ref: "test/client/nominationScreen.test.tsx '위 알림·채팅 줄' (9 tests)"
        status: pass
    human_judgment: false
  - id: D4
    description: "재접속·새로 고침 첫 화면과 epoch 가 바뀐 직후 view 는 배지·선두를 상태로 보이되 알림·채팅 줄·손사래를 만들지 않음"
    requirement: DAY-04
    verification:
      - kind: component
        ref: "test/client/nominationScreen.test.tsx '재접속·새로 고침 첫 화면' · '연결 번호(epoch)' · '재접속 직후 선두 손사래' (3 tests)"
        status: pass
    human_judgment: false
  - id: D5
    description: "처음 보는 지목에서만 누를 수 있는 이름표 4개가 3초 깜빡이고 mf-hint-point 기록, 다음 지목에서는 없음, 누르면 즉시 멈춤, 저장소 불가면 깜빡임, 토론·유령 화면에는 없음"
    requirement: DAY-04
    verification:
      - kind: component
        ref: "test/client/nominationScreen.test.tsx '처음 보는 지목 깜빡임' (5 tests)"
        status: pass
    human_judgment: false
  - id: D6
    description: "장면 표: 지목 동안 조명 vote·고정 카메라·선두 긴장 1·과반 긴장 2, 스테이지 400 이면 1.08 확대·300 이면 1, 산 사람의 맵 탭은 move 를 보내지 않음(토론에서는 보냄)"
    requirement: MAP-04
    verification:
      - kind: component
        ref: "test/client/nominationScreen.test.tsx '장면 상태' (7 tests)"
        status: pass
    human_judgment: false
  - id: D7
    description: "선두가 새 사람으로 바뀔 때마다 runtime.deny 한 번(처음 생길 때 포함, 같은 선두 이어짐·동점·첫 스냅샷·epoch 직후는 없음)"
    requirement: DAY-04
    verification:
      - kind: component
        ref: "test/client/nominationScreen.test.tsx '손사래' (3 tests)"
        status: pass
    human_judgment: false
  - id: D8
    description: "거절: WRONG_PHASE 는 '지금은 고를 수 없어요', 지목 직후 그 밖의 코드는 '보내지 못했어요. 다시 해 보세요', 둘 다 내 선택이 서버 값으로 돌아옴. 지목 안 보낸 때의 그 밖의 오류는 무반응"
    requirement: DAY-04
    verification:
      - kind: component
        ref: "test/client/nominationScreen.test.tsx '거절·끊김' (6 tests)"
        status: pass
    human_judgment: false
  - id: D9
    description: "역할 표식 없음: 지목·배지·선두·도장·mine 화면에 crimson·RoleChip·선 요소가 없고 GameMap·useDayFx 소스에 crimson/innerHTML 없음, 8자 닉네임 버튼이 말줄임 없이 그려짐, .mf-world__pick 44×44 규칙 유지"
    requirement: DAY-04
    verification:
      - kind: component
        ref: "test/client/nominationScreen.test.tsx '역할 표식 없음·8명·긴 닉네임' (3 tests)"
        status: pass
    human_judgment: false
  - id: D10
    description: "전체: 타입 검사 0 오류, client 프로젝트 57 파일 1808 통과, vite build 통과, 시험에 .skip/.todo 0건"
    verification:
      - kind: command
        ref: "npm run typecheck; npx vitest run --project client; npx vite build"
        status: pass
    human_judgment: false
  - id: D11
    description: "손가락 뻗기·손사래·선두 맥박·도장 찍힘·고정 카메라·위 알림의 실제 화면에서의 보기 좋음, 8개 버튼 무가림(폰 6종), 몰릴 때 알림 간격의 체감(시작값 400ms·1.5/0.8초)"
    verification: []
    human_judgment: true
    rationale: "화면 시험은 DOM 속성·장면 표·호출을 고정할 뿐 시각 품질과 체감 시간을 보지 않는다. 무가림은 가정 A3 대로 08-23 E2E 가, 알림 시간표는 UI-SPEC 남은 위험 7 대로 9페이즈 팀 테스트가 확인한다"

duration: 30min
completed: 2026-11-02
---

# Phase 8 Plan 15: 지목 화면 Summary

**낮 지목 단계의 산 사람은 나를 뺀 산 사람의 이름표를 직접 눌러 가리키고(내 선택만 즉시 mine), 득표 배지·선두 맥박·유력 도장·손가락·손사래는 서버 day.points 에서만 그려지며, 몰린 지목은 ToastQueue 로 합쳐 위 알림과 채팅 줄에 남고, 처음 보는 사람에게만 3초 깜빡이고, 거절되면 서버 값으로 돌아온다.**

## Accomplishments

- **이름표 버튼과 낙관적 선택 (DAY-04, 트레이서)**: 지목 단계의 산 사람 화면에서 WorldStage `pick` 에 나를 뺀 산 사람 좌석을 넘긴다(`{닉네임} 님 가리키기`, 그룹 `지목`). 누르면 `point {target}` 을 보내고 그 이름표만 즉시 mine, 이전 것은 풀린다. 같은 사람 재누름은 보내지 않고, `send` 가 false 면 표시를 바꾸지 않는다. 서버 view 가 오면 `useViewChoice` 로 서버 값(day.points 의 내 줄)이 이긴다. 유령에게는 `pick` 자체가 없다.
- **서버 집계 배지 (DAY-04·05)**: `tagProps` 가 `pointsTally(view)` 의 counts·leader·sure 로 count·lead·sure 를 만든다. 0표에는 배지가 없고, 동점이면 선두 효과가 풀리고, 과반이 풀리면 도장이 사라진다. 남의 표는 서버 응답 전에 미리 그리지 않는다.
- **장면 상태 (MAP-04)**: `sceneLook(view, {stageH, mine})` 에 낙관적 mine 을 넣어 내 캐릭터가 누르자마자 그쪽을 가리킨다. 조명 vote·고정 카메라·긴장 1/2·스테이지 360 이상일 때 1.08 확대는 08-08 표가 이미 정한 값을 그대로 받는다. 산 사람의 맵 탭은 move 를 보내지 않는다.
- **위 알림과 채팅 줄 (E2 #9)**: `useDayFx` 가 `dayEvents` 의 toasts 를 `ToastQueue` 에 세우고 합치기 창이 닫힌 뒤(+1ms) 하나씩 꺼내 `toast {id,…}` 로 내려준다. GameMap 은 id 가 바뀔 때만 TopToast 에 띄운다(길이 지정). 채팅 vote·hot·`지목 시작` 줄은 08-13 의 줄 연결 그대로 지목에도 적용된다.
- **첫 스냅샷 무연출 (E2 #10)**: 직전 view 가 없거나 epoch 가 바뀐 직후면 배지·선두·도장은 상태로 바로 보이되 알림·줄·손사래는 만들지 않는다.
- **손사래 (결정 0049)**: `leaderShift(prev, view)` 가 새 선두를 알리면 `deny {seat, nonce}` 를 갱신하고 WorldStage 가 한 번 손사래를 한다.
- **처음 보는 지목 깜빡임**: `mf-hint-point` 가 없으면 누를 수 있는 이름표가 3초 깜빡이고, 끝나거나 누르면 기록한다. 저장소를 못 읽으면 깜빡이고 못 쓰면 이번 방문에서만 본다.
- **거절 (E1 #4)**: 지목 직후 3초 안의 오류 프레임을 지목 거절로 보고 WRONG_PHASE 는 `지금은 고를 수 없어요`, 그 밖은 `보내지 못했어요. 다시 해 보세요` 를 띄운 뒤 내 선택을 서버 값으로 되돌린다.

## TDD Gate Compliance

| 작업 | RED 커밋 | GREEN 커밋 | 비고 |
|------|----------|------------|------|
| 1 (트레이서) | abf586b | ca9f0cd | RED: 새 시험 4개 중 3 실패(버튼 없음), 유령 시험은 구현 없이도 맞는 대조 |
| 2 | ea19cf7 | b5e48e9 | RED: 새 시험 14개 중 8 실패(알림 빈 글자 5·깜빡임 0개 3) |
| 3 | 96d85fb | 4bd6694 | RED: 거절 2건 실패. 나머지 시험은 작업 2 에서 이미 연결된 동작(손사래·장면 표)의 특성 시험이라 통과 |

**semanticAssessment**: 작업 1 RED 는 `expected [] to deeply equal ['1','2','3','4']`·`Unable to fire a "click" event`(버튼 없음)로 계획한 단언의 실패이고 import·문법 오류가 아니다. 작업 2 RED 8건은 `expected '' to be '영희 → 서준'`(알림 없음)과 `expected +0 to be 4`(깜빡임 이름표 없음)로 계획한 행동 단언이다. 작업 3 RED 는 `expected true to be false`(WRONG_PHASE 뒤 mine 이 풀리지 않음)와 `expected '' to be '보내지 못했어요. 다시 해 보세요'` 이다. 작업 3 의 손사래·긴장·확대·카메라 시험은 작업 2 가 `deny`·`toast` 를 RoomScreen 에서 GameMap 으로 잇는 순간 이미 만족되어 RED 가 아니었다 — 그 시험들은 새 동작 개발이 아니라 이미 연결된 계약의 고정이다. `gsd_run check tdd-red-evidence` 는 따로 돌리지 않았다(08-10·08-12 와 같음). 첫 RED 커밋 전에 계획 커밋 원장을 쓰지 못해 두 번째 줄(`HEAD~1`)에서 복원했다(기록값은 계획 시작 직전 HEAD 와 같다).

**트레이서 게이트**: 작업 1 `<verify>`(`npx vitest run test/client/nominationScreen.test.tsx`) 통과 뒤 확장했다(⚡ Tracer verified end-to-end — expanding).

## Task Commits

| 작업 | 커밋 | 내용 |
|------|------|------|
| 1 RED | abf586b | test: 이름표 버튼·point 전송·배지·mine·유령 무버튼 |
| 1 GREEN | ca9f0cd | feat: 지목 pick·tagProps·낙관적 mine·서버 집계 배지 |
| 2 RED | ea19cf7 | test: 위 알림 큐·채팅 줄·첫 스냅샷 무연출·깜빡임 |
| 2 GREEN | b5e48e9 | feat: useDayFx ToastQueue·deny 신호, GameMap 알림·깜빡임, TopToast durationMs |
| 3 RED | 96d85fb | test: 장면 상태·손사래·거절 알림·끊김·역할 표식 없음 |
| 3 GREEN | 4bd6694 | feat: 지목 거절 알림·서버 값 되돌림 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - 막힘 해소] 위 알림이 RoomScreen 의 훅에서 GameMap 의 TopToast 로 닿을 길이 없음**
- **Found during:** Task 2
- **Issue:** 계획은 "useDayFx 에 TopToast 연결(속성으로 show 를 받음)" 이라 했으나 `useDayFx` 는 08-13 에서 RoomScreen 이 쥐고(GameMap 은 낮 시작마다 새로 마운트), `useTopToast` 는 GameMap 안에 있어 RoomScreen 이 `show` 를 부를 수 없다.
- **Fix:** `useDayFx` 가 `toast {id, text, icon, durationMs}` 상태와 `deny {seat, nonce}` 를 돌려주고 RoomScreen 이 GameMap 에 `toast`·`deny` 속성으로 넘긴다. GameMap 은 id 가 바뀔 때만 띄운다. 계획 `files_modified` 밖의 `RoomScreen.tsx`·`TopToast.tsx`(선택 인자 `durationMs`)를 건드렸다.
- **Files modified:** src/net/useDayFx.ts, src/screens/GameMap.tsx, src/screens/RoomScreen.tsx, src/components/v2/TopToast.tsx
- **Commit:** b5e48e9

**2. [Rule 1 - 버그 예방] 깜빡임 기록 시점**
- **Found during:** Task 2 설계
- **Issue:** 지목 시작 때 곧바로 `mf-hint-point` 를 기록하면 개발 모드 이중 실행의 두 번째 실행이 기록을 읽고 깜빡임을 꺼 버린다.
- **Fix:** 3초가 끝나거나 이름표를 누를 때 기록한다. 지목이 3초 안에 끝나 버리면 다음 지목에서 한 번 더 깜빡일 수 있으나 해롭지 않다.
- **Commit:** b5e48e9

**3. [Rule 1 - 버그 예방] 지목 거절 판정 범위**
- **Found during:** Task 3 설계
- **Issue:** 계획대로 "그 밖의 코드는 모두 '보내지 못했어요'" 로 하면 지목과 무관한 오류(채팅 RATE_LIMITED)가 선택을 되돌리고 알림을 띄우며, 08-13 의 E1 #4 시험('RATE_LIMITED 는 알림도 되돌림도 없다')과 충돌한다.
- **Fix:** 지목을 보낸 뒤 3초 안이고 서버가 내 선택을 아직 확인하지 않았을 때의 오류만 지목 거절로 본다.
- **Commit:** 4bd6694

### 검증 방식 차이

- 계획 작업 3 의 "가짜 캐릭터 holdPose(point)·가짜 렌더러 setLighting/setTension/setZoom" 은 GameMap 화면 시험에서 **런타임이 받은 장면 표(`setScene`)** 로 단언했다. 이 시험은 진짜 WorldStage + 가짜 런타임이라 렌더러를 거치지 않는다. 장면 표를 렌더러 호출(holdPose·setLighting·setTension·setZoom·deny)로 옮기는 일은 08-12 의 `worldStage.test.tsx` 가 이미 고정한다(`지목 자세·손사래`·`조명·긴장`·`카메라` 절). 두 시험을 이으면 같은 계약이 끝까지 확인된다.

**Total deviations:** 3 auto-fixed (1 blocking, 2 bug 예방) + 검증 방식 차이 1. **Impact:** 계획이 의도한 동작은 모두 구현됐고, 위 알림 전달 방식과 거절 범위만 08-13 의 구조에 맞게 좁혔다.

## Known Stubs

None. 스텁·자리표시 없음. `human_judgment` D11(시각 품질·체감 시간)은 사람이 볼 항목으로 명시했다.

## Threat Flags

None — 새 네트워크 표면 없음. `point` 는 대상 좌석 하나만 보내고(T-08-38), 알림 도배는 ToastQueue 합치기·4건 상한(T-08-39), 지목 화면의 진홍·역할 표식 0건은 시험으로 고정했다(T-08-40). 패키지 설치 없음(T-08-SC).

## Self-Check: PASSED

- 파일 있음: src/screens/GameMap.tsx, src/net/useDayFx.ts, src/screens/RoomScreen.tsx, src/components/v2/TopToast.tsx, test/client/nominationScreen.test.tsx
- 커밋 6개 모두 HEAD 의 조상: abf586b, ca9f0cd, ea19cf7, b5e48e9, 96d85fb, 4bd6694
- 인수 기준: `t: "point"`·`pointsTally(` (GameMap) / `ToastQueue` (useDayFx)·`"mf-hint-point"` (GameMap) / `leaderShift(` (useDayFx)·`지금은 고를 수 없어요` (GameMap) / 시험 `.skip(`·`.todo(` 0건 — 모두 성공
- 계획 검증: `npm run typecheck && npx vitest run --project client && npx vite build` 통과 (client 57 파일 1808 시험)
