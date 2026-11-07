---
phase: 15-errand-and-trace
plan: "01"
subsystem: server-errand-tracer
tags: [errand, tracer, minifia-v3, d-01, d-03, d-07, d-08, bots, leak-safe]
status: complete

requires:
  - phase: 14-09
    provides: "사회자 띠(hostLine errand 예약 행)·이름표·빛남 위에 얹는 15페이즈 시작점"
provides:
  - "errand 단계: 낮 시작(dayAnnounce) 다음 40초(ERRAND_MS), 끝나면 토론. 상수 아홉 개가 shared/game/phases.ts 한 블록에만 있다(RULESET 변경 없음)"
  - "맵 장소 후보 8곳씩(BAR_PLACES·PLAZA_PLACES, MapDef.places?) — 걷기 칸·서로 2.0 이상·모든 입장 지점에서 routeFx 로 도달을 시험이 고정"
  - "shared/game/errand.ts: enterErrand(산 사람마다 3곳, 난수 호출 순서가 계약)·actErrand(반경 안 가장 가까운 미완료 장소 하나)·placeCenterFx·nearestPlaceId — 역할·연결을 읽지 않는다"
  - "프로토콜: PhaseId errand, PLACE_IDS/PlaceId, ErrandMine, MyInfo.errand, ClientMessage {t:'errand'}(strictObject 스키마)"
  - "워커 applyErrand: 사람 메시지와 봇 errandAct 가 같은 본체. 거절·무효는 모든 이유·역할에서 보낸 소켓에 자기 state 한 프레임(오류·방송 없음)"
  - "봇 errandGo/errandAct(산 봇마다 go 3 + act 6, 난수 없음), 봇 방 errand 완주 통합 시험"
  - "PhaseId 확장을 따라간 모든 단계 표(장면·헤더 제목·테스트 도구 라벨·소리 침대·RoomScreen 지도 분기·E2E 사본)와 기존 시험 정리"
affects: [15-02, 15-03, 15-04, 15-05, 15-06, 15-07, 15-08, 15-09, 15-10]

requirements-completed: [ERRAND-01, ERRAND-02, ERRAND-04]

actuals:
  tokens: 28800
  tasks: 2
  commits: 3

plan_head_before: afcc84e59206ffed5974bda8b9471134033ce848
plan_head_after: a0648ad7ed00f578e023c0fd3e935958fdf1be9f

tech-stack:
  added: []
  patterns:
    - "진입 훅에서 난수를 쓰는 단계(errand)는 tick 에 randInt 가 필요 — 낮 시작을 지나는 tick 을 부르는 시험은 시드 난수를 넘긴다"
    - "처리 거절은 사유를 가르지 않는 { ok: false } 하나, 워커는 사유와 무관하게 보낸 사람에게 state 한 프레임(오라클 방지, applyDress 선례)"

key-files:
  created:
    - shared/game/errand.ts
    - test/unit/errand.test.ts
    - test/worker/errand.test.ts
  modified:
    - shared/protocol.ts
    - shared/schemas.ts
    - shared/game/phases.ts
    - shared/game/map.ts
    - shared/game/mapPlaza.ts
    - shared/game/room.ts
    - shared/game/tick.ts
    - shared/game/movement.ts
    - shared/game/night.ts
    - shared/game/view.ts
    - shared/game/bots.ts
    - worker/room.ts
    - src/game/scenes.ts
    - src/game/dayView.ts
    - src/screens/RoomScreen.tsx
    - src/components/TestTools.tsx
    - src/audio/director.ts
    - scripts/e2e/lib.mjs

key-decisions:
  - "장소 id 는 닫힌 집합 16개(PLACE_IDS). MapDef.places 는 optional 이라 장소 없는 맵은 목록이 빈 배열"
  - "{t:'errand'} 는 필드가 없고 서버가 위치로 판정한다. 거절·무효·간격 초과 모두 같은 응답(결정 0074 에 적는다 — 15-10)"
  - "처리 요청 간격(ERRAND_MIN_GAP_MS 250ms)은 받아들인 요청뿐 아니라 간격 검사를 통과한 모든 시도에서 기록한다(성공 여부가 타이밍으로 새지 않게)"
  - "심부름 단계는 채팅·동작(emote)을 받지 않는다(CHAT_PHASES 밖, 시험 표 silent) — 걷기와 처리뿐. 유령은 모든 지도 단계에서 자유(A4)라 그대로"
  - "errand 는 STAT_PHASES(판 통계) 에 넣지 않았다 — 채팅·동작이 없는 단계라 올릴 일이 없다"

metrics:
  duration: 약 1시간
  completed: 2026-11-07
---

# Phase 15 Plan 01: 심부름 트레이서 Summary

**낮 시작 다음의 40초 심부름 단계를 서버 끝에서 끝으로 잇고(단계·상수 → 맵 장소 → 산 사람마다 3곳(마피아도 같은 모양) → `{t:"errand"}` 처리 → `me.errand` → 봇이 걸어가 처리), 봇 방이 dayAnnounce → errand → discussion 을 지나 봇 전원이 3/3 을 마치는 것을 워커 통합 시험으로 고정했다.**

## 한 일

- **Task 1 (트레이서)** — `test(15-01)` 로 시험 먼저, `feat(15-01)` 로 구현.
  - 프로토콜·스키마·단계 표(`PHASE_DEFS`: dayAnnounce.next=errand, errand → discussion)·상수 블록·맵 장소 후보(재즈 바·시계탑 광장 8곳)·`errand.ts`·tick 진입 훅·`enterNight` 의 키째 지우기·`canMoveIn`/`MAP_PHASES`·`view.me.errand`(errand 단계의 산 본인에게만, 필드별 복사)·봇 계획·워커 `applyErrand`/`errandGo`/`errandAct`·`captureHomeNow` 가 errand 를 걷기 단계로 제외.
  - 장소 좌표는 계획 제안값 가운데 시험이 어긋난다고 알려 준 세 곳만 가까운 걷기 칸으로 옮겼다: 재즈 바 piano `(-3.4,-4.6)` → `(-2.6,-5.6)`(원래 자리는 막힌 칸), sax `(-0.8,-5.4)` → `(-0.2,-5.2)`(piano 와 2.0 간격 유지), 광장 lamp `(-3.6,2.2)` → `(-3.0,-0.3)`(tree 와 1.17 로 가까웠음).
- **Task 2 (PhaseId 확장 따라가기)** — `feat(15-01)`.
  - PHASE_SCENE errand → "day", 헤더 제목·소리 안내 "심부름", TestTools 라벨 "심부름", director BED_OF errand → "bed.day"(진입 소리 없음), RoomScreen 지도 단계 분기(`sceneKey`·렌더 switch)에 errand. TIMELESS_PHASES 에는 넣지 않았다.
  - E2E 사본: `VIEW_ME_KEYS`·`BASIC_TRANSITIONS`(dayAnnounce→errand→discussion)·`EXPECTED_SCENE`.
  - 깨진 기존 시험은 "단계가 하나 늘었다"에서 오는 기대값만 새 계약으로 바꿨다(느슨하게 하지 않음).

## 시험 결과

- `npx vitest run test/unit/errand.test.ts test/worker/errand.test.ts` — 28 통과(세 번 연속).
- `npm run typecheck` 0, `npm test` — 244 파일 통과·7093 통과·261 건너뜀(0 실패).
- 인수 기준: errand.ts 존재, `ERRAND_MS` 2줄, protocol `errand` 4줄, errand.ts 의 `.role` 0, `errandGo` bots.ts 5·room.ts 2, `ERRAND_MS =` 정의 1곳, ruleset.ts diff 0.
- 위생: `git grep -nIiE "torder|티오더|조직|회사|~/project"` 새 적중 없음(기존 `.planning/milestones` 의 옛 문서 적중뿐).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] 장소 제안 좌표 세 곳이 맵 규칙(걷기·간격)을 어김**
- **Found during:** Task 1 GREEN (맵 데이터 시험)
- **Fix:** 위 세 곳을 가까운 걷기 칸으로 옮김(계획이 "시험이 알려 주는 대로 옮긴다"고 허용한 범위).
- **Files modified:** shared/game/map.ts, shared/game/mapPlaza.ts

**2. [Rule 3 - Blocking] E2E 사본의 단계 전이·장면 표도 갱신**
- **Found during:** Task 2 (scenes.test.ts 가 `EXPECTED_SCENE` 과 `PHASE_SCENE` 의 일치를 요구, E2E 판정이 dayAnnounce→discussion 을 가정)
- **Fix:** 계획 파일 목록의 `VIEW_ME_KEYS` 외에 `BASIC_TRANSITIONS`·`EXPECTED_SCENE` 에도 errand 를 더함. 새 흐름의 E2E 실행은 15-09 몫이다.
- **Files modified:** scripts/e2e/lib.mjs

**3. [Rule 3 - Blocking] 계획에 없던 소비자 정리**
- RoomScreen 의 `sceneKey`·렌더 분기·`PHASE_ANNOUNCE`(typecheck 가 요구), `test/client/phaseScreens.test.tsx`·`test/unit/emotePhases.test.ts`·`soundProtocol.test.ts`·`soundDirector.test.ts` 의 단계 전수 표(typecheck/시험이 요구).

### 시험 기대값 변경(이유)

- **tick 에 난수 필요**: errand 진입이 randInt 를 쓰므로 낮 시작을 지나는 tick 호출 시험(night·nyquist·tick·audience·gameRoom)에 시드 난수를 넘겼다. `tick.test.ts` 의 "난수 함수는 지금 단계 표만으로는 한 번도 부르지 않는다" 계약은 "errand 진입에서만 불리고 인자는 8·7·6, 호출 수는 산 사람 × 3 의 배수, 밤→아침은 0" 으로 갱신했다.
- **봇 시드 고정 값(`bots.test.ts` 34804349,554531902)은 바꾸지 않았다**: 모든 `at` 이 ERRAND_MS 만큼 밀리므로 디지스트 계산 때 시각만 `- ERRAND_MS` 로 되돌려 같은 값을 지킨다(난수 호출 순서가 불변이라는 증명).
- **emote**: errand 는 `emotePhases` 표에서 silent(채팅·동작 불가). A-6 의 "낮 단계 아홉" 이 그대로다.
- **알람 따라잡기 시험**(`nightCatchup`): 아침 마감 16초 뒤에 깨면 이제 errand 단계다 — 허용 단계에 errand 를 더했다. `basicDay`·`alarm` 은 한 단계(errand)가 늘어난 기대로 갱신.

### 테스트 순서 메모

- RED 를 눈으로 확인하는 단계가 없다: 구현 초안을 먼저 만들고 시험을 쓴 뒤 시험 커밋 → 구현 커밋 순으로 나눠 커밋했다(시험 커밋 시점에는 구현이 커밋되지 않은 상태라 그 커밋만으로는 실패한다).

## 이월 메모 (다음 계획용)

- **15-02**: 이 계획의 errand 위치 전송은 낮 단계와 같다(근처 사람만 보임은 15-02 가 닫는다). `Player.errandNear?`·`errandSeen?` 는 `errandPlaces/errandDone` 옆에 더한다. errandDone 은 토론 단계에도 남아 있다(enterNight 에서 지움) — 목격 기록은 이 값(3/3)을 근거로 쓰면 된다.
- **15-04/05 (사회자·화면)**: `src/game/hostLine.ts` 는 errand 단계에서 `fallback` 줄을 쓴다(키 `errand` 행은 비어 있음). `hostChimeOf` 는 dayAnnounce→errand, errand→discussion 에서 알림음을 낸다 — 낮 시작→토론 무음 규칙을 어떻게 이을지 결정 필요(15-04 문구·15-05 통합). `GameMap.tsx:169` 의 `view.phase !== "dayAnnounce"` 시간 막대 조건은 errand 에서 막대가 보이는 쪽으로 동작(40초라 막대 있음, 계획 의도 일치).
- **15-06**: 누설 검사·smoke 스크립트는 새 단계(errand 40초)에서 대기 시간이 늘어난 것을 반영해야 한다(smoke·E2E 스크립트 본문은 이 계획에서 건드리지 않았다 — 15-06 이 확인).
- **15-10**: 결정 0074 에 적을 것 — 장소 id 16개, errand 메시지 필드 없음·거절 응답 동일, 간격 기록 방식, errand 에서 채팅·동작 불가, 계획 좌표 보정 세 곳.

## Known Stubs

없음. (errand 화면은 15-05 가 만든다 — 이 계획은 서버·표 계약만 닫는다. 클라이언트에는 아직 errand 전용 UI 가 없고 지도만 보인다.)

## Threat Flags

없음 — 새 네트워크 표면은 계획 `<threat_model>` 의 `errand` 메시지 하나이고 T-15-01~04 완화(역할 미참조 grep 기준·같은 응답 시험·strictObject·250ms 간격)를 시험이 고정한다.

## Self-Check: PASSED

- 파일: shared/game/errand.ts, test/unit/errand.test.ts, test/worker/errand.test.ts FOUND
- 커밋: 1bb563e9, 24f29a6e, a0648ad7 FOUND
