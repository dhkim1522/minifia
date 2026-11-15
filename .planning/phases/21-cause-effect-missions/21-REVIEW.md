---
phase: 21-cause-effect-missions
reviewed: 2026-11-15T22:30:00Z
depth: standard
files_reviewed: 78
files_reviewed_list:
  - shared/game/lamps.ts
  - shared/game/scene.ts
  - shared/game/skip.ts
  - shared/game/errand.ts
  - shared/game/night.ts
  - shared/game/tick.ts
  - shared/game/view.ts
  - shared/game/room.ts
  - shared/game/world.ts
  - shared/game/map.ts
  - shared/game/mapTown.ts
  - shared/game/movement.ts
  - shared/game/audience.ts
  - shared/game/discussion.ts
  - shared/game/phases.ts
  - shared/game/ruleset.ts
  - shared/game/gather.ts
  - shared/game/execution.ts
  - shared/game/nomination.ts
  - shared/game/runoff.ts
  - shared/game/showdown.ts
  - shared/protocol.ts
  - shared/schemas.ts
  - worker/room.ts
  - src/game/houseView.ts
  - src/game/lampView.ts
  - src/game/sceneView.ts
  - src/game/boardView.ts
  - src/game/hostLine.ts
  - src/game/errandView.ts
  - src/net/useMorningAnnouncing.ts
  - src/net/useErrandPos.ts
  - src/components/v2/ErrandAct.tsx
  - src/screens/GamePanel.tsx
  - src/screens/GameMap.tsx
  - src/world/camera.ts
  - src/world/runtime.ts
  - src/world/presence.ts
  - src/world/testHooks.ts
findings:
  critical: 0
  warning: 3
  info: 5
  total: 8
  necessity: 0
status: issues_found
---

# Phase 21: 코드 리뷰 보고서

**검토 시각:** 2026-11-15
**깊이:** standard (서버 권위·누설 경로는 deep 수준으로 호출 사슬을 따라 추적)
**범위:** 931593a2 이후 HEAD(v3)까지의 소스 변경 78개(shared·worker·src). 테스트 파일은 신뢰성에 영향 줄 때만 보았다.
**상태:** issues_found (치명 0, 경고 3, 정보 5)

## 요약

중점 항목을 하나씩 추적했다. `npx tsc -p tsconfig.app.json` · `tsconfig.worker.json` 은 오류 없음, `vitest run test/unit` 은 154 파일 통과(5154 테스트).

**누설 경로(결과: 증명된 누설 없음).**
- `errandCut`(마피아 자르기)은 `lamps.ts withCut` 만 쓰고 `view.ts` 는 읽지 않는다. 공개되는 것은 `day.lamps` boolean 여덟뿐이고, 안 켠 등불과 자른 등불은 구별되지 않는다.
- `hold` 는 zod 에서 `boolean().optional()`(strictObject)이고 `applyErrand` 가 hold·역할과 무관하게 같은 저장 1회 + 본인 state 1프레임을 낸다. 응답 모양·횟수가 같다.
- `inspectSpot` 은 거절 사유를 가르지 않고, 받아들일 때 마피아의 `touched` 표시는 같은 상태 쓰기에 실려 응답이 같다. `scene`(서버 전용)은 `day.scene = { house }` 만 필드 복사로 나간다.
- `skipVote` 는 `day.skipCount`(수)와 본인 `me.skip` 으로만 간다. `sceneSeen` 은 본인 `me.scene` 으로만 간다.
- 근처 단계(`nearPhaseOf`)로 아침 걸음·snap 을 저녁과 같이 근처로만 보낸다.
- 새 클라이언트 코드는 `me.role` 을 읽는 곳이 문구 분기 한 곳(밤 줄)과 마피아 안내 힌트뿐이다.

**기본판 불변(결과: 유지).** `rules.cause` 가 거짓이면 `enterNight`(errandPlaces·errandDone·errandSeen 키째 삭제), `enterMorning`(trace·seen 난수 호출 포함), `morningMsOf`, `canMoveIn`, `layoutKey`, 훅 표, `nextPhaseOf`, `afterDayOf` 모두 이전과 같은 값·같은 난수 호출 순서다. `syncErrandTransition` 의 호출 위치가 `syncLayout` 앞으로 옮겨졌지만, 기본판은 errand 직후 `layoutKey` 가 null 이라 결과가 같다.

남은 지적은 밸런스·견고성·유지보수 수준이다.

## 경고

### WR-01: 한 자리에서 단서 지점 셋이 모두 닿는다 — 마피아 한 명이 현장 단서를 1초 안에 전부 지울 수 있다

**파일:** `shared/game/mapTown.ts:TOWN_CLUE_SPOTS`(약 285~294행), `shared/game/scene.ts:inspectSpot`(반경 판정), `shared/game/phases.ts:66`(`ERRAND_ACT_R = 1.2`)
**문제:** 처리 반경은 1.2(고정소수점 120)인데 같은 집의 세 지점 간격은 100~112 다. 모든 집(예: 집 0 의 중간점 (-325,-775) 에서 앞뒤 점까지 112·100)에서 가운데 지점에 서면 세 지점이 모두 반경 안이다. 그래서
1. 시민은 "지점 셋을 걸어 다니며 살핀다"가 아니라 한 자리에서 3번 누르면 끝난다(걷는 즐거움·경쟁이 없다).
2. 산 마피아 한 명이 가운데에 서서 `inspect` 를 3번(간격 `ERRAND_MIN_GAP_MS` 250ms) 누르면 세 지점이 모두 `touched` 가 된다. 이후 시민이 살피면 발자국·옷 조각·창문 전부 "먼저 손댄 흔적"만 받는다. 마피아 자신은 평소 단서를 받는다(D-15). 마피아의 첫 클릭은 현장 도착 직후 1초면 끝나므로, 아침 30초 현장 시간 동안 시민이 받을 수 있는 증거가 사실상 도착 순서 경쟁 하나로 줄어든다. 서버는 아침 발표(큰 글)가 끝나기를 기다리지 않아 `inspect` 가 morning 첫 ms 부터 받아들여진다(클라이언트가 지점을 숨기는 것은 화면 연출일 뿐이다).
**수정:** 지점 간격을 반경보다 크게 벌리거나(≥ 2.5, 반경 1.2 의 두 배 이상), `inspectSpot` 이 "반경 안의 가장 가까운 한 지점"이 아니라 "지점 중심 반경 0.6 같은 더 작은 값"을 쓰게 하거나, 한 사람이 같은 위치에서 연속으로 살피지 못하게 사람당 살핌 사이에 이동 조건/쿨다운(예: 다음 살핌까지 3초)을 둔다. 마피아 독점 방지가 의도라면 결정 0088 에 "먼저 손댄 흔적" 이 지점별 1회 한정임을 밸런스 근거와 함께 적는다. (밸런스 문제이며 누설은 아니다.)

### WR-02: `skip` 메시지에 속도 제한이 없다 — 켰다 껐다 반복이 매번 저장 + 전원 방송

**파일:** `worker/room.ts:applySkip`(약 1010~1025행), `shared/game/skip.ts:toggleSkip`
**문제:** `errand`·`inspect` 는 `ERRAND_MIN_GAP_MS` 로 연타를 막지만 `applySkip` 은 막지 않는다. "같은 값이면 같은 객체라 저장·전송 없음"(T-21-20)만 연타 방어로 쓰는데, on/off 를 번갈아 보내면 매 메시지가 `persistAndBroadcast` — `ctx.storage.put` 1회 + 모든 소켓 view 재전송 — 이 된다. 한 클라이언트가 초당 수십 번 토글하면 방 전원에게 증폭된 프레임이 간다. 토론 끝내기(`applyEndDiscussion`)와 같은 구멍을 새 메시지가 그대로 복제했다.
**수정:** `applyErrand` 처럼 `writeAt.get(\`skip:${playerId}\`)` 로 최소 간격(예: 250ms)을 두고, 간격 안의 요청은 상태 변화 없이 본인 view 한 프레임만 보낸다.

### WR-03: 진행 중이던 확장판 방이 배포 순간 원인 흐름 규칙을 받는다 — 아침 근처 표본이 영영 돌지 않을 수 있다

**파일:** `shared/game/ruleset.ts:rulesetOf`, `shared/game/movement.ts:nearPhaseOf`, `shared/game/tick.ts`(morning 진입 훅), `shared/game/room.ts:normalizeStoredRoom`
**문제:** `rulesetOf(modeOf(state))` 는 저장된 `mode`(없으면 기본 extended)로 `cause: true` 를 돌려준다. 배포 전에 시작돼 morning 에 있던 확장판 방은 `errandTickAt` 이 없는데 `nearPhaseOf` 가 참이 되어, 아침 중 걸음이 본인·유령에게만 가고 `runErrandTick` 은 `errandTickAt === undefined` 라 영영 근처 snap 을 보내지 않는다(산 사람이 서로 안 보인다). 정규화(`normalizeStoredRoom`)에는 이 경우를 다루는 줄이 없다. `lamps`·`scene` 없이 night 를 지난 방은 기능이 조용히 빠질 뿐이지만, morning·dayAnnounce 중이던 방은 판이 끝날 때까지 어긋난다. 이전 페이즈들은 "배포 순간 한 번뿐인 수용 가능한 이전"으로 처리해 왔으나(room.ts 주석) 이번에는 규칙을 바꾸는 것이라 크기가 다르다.
**수정:** (a) `normalizeStoredRoom` 에서 저장된 방이 `cause` 이고 `phase` 가 morning·night·dayAnnounce 인데 원인 흐름 상태가 없으면 그 단계의 `errandTickAt` 을 `now + ERRAND_TICK_MS` 로 채우거나 `mode` 를 basic 으로 고정하고, 또는 (b) 배포 전 진행 방은 `ruleset` 을 저장 시점 값으로 읽도록 스냅샷한다. 최소한 HANDOFF 의 알려진 한계에 "배포 시 진행 중 방은 비운 뒤 배포" 를 적는다.

## 정보

### IN-01: 서버 봇은 `hold`·`inspect`·`skip` 을 하지 않아 봇 마피아 방에서는 등불 자르기·흔적 남기기가 일어나지 않는다

**파일:** `shared/game/bots.ts:303~308`(`errandAct` 만), `worker/room.ts` 봇 계획 실행부
**문제:** 봇의 `errandAct` 는 `hold` 없이 `applyErrand` 를 부른다. 봇이 마피아이면 자른 등불·`touched` 가 영원히 없다. 사람이 마피아인 방과 봇이 마피아인 방의 동작이 갈려, 봇 채움 방에서 "꺼진 등불 = 사람 마피아" 같은 추론 경로가 생기고 단독 테스트에서 원인 흐름 전체를 시험하기 어렵다. 누설은 아니고 시험·재미 문제다.
**수정:** 봇 계획에 산 마피아 봇이 반경 안 지점에서 `inspect`, 임의 등불에서 `hold` 를 보내는 단계를 난수 없이(좌석 오름차순 기반) 추가하거나, 봇 방에서는 원인 흐름 마피아 효과가 없음을 문서에 적는다.

### IN-02: `CAUSE_MODES` 가 변경 가능한 모듈 전역 배열이다

**파일:** `shared/game/ruleset.ts:34`(`export const CAUSE_MODES: GameMode[]`)
**문제:** 시험이 규칙을 잠그려고 만든 가변 배열이 제품 번들에서도 export 되어 누구든 `push`/`splice` 로 판 규칙(`rulesetOf`)을 바꿀 수 있다. `hooksFor` 는 규칙 객체별 캐시(WeakMap)라 안전하지만, 시험이 `afterEach` 에서 복원하지 못하면 다른 시험이 오염된다. 이 점은 maps.ts 의 `MODE_MAPS` 와 같은 패턴이긴 하다.
**수정:** `readonly GameMode[]` 로 노출하고 변경은 시험 전용 도우미(`lockCause`·`openCause`)의 내부에서만 하게 한다. 가능하면 도우미가 복원 함수를 돌려주게 한다.

### IN-03: 이름이 같고 뜻이 다른 두 `houseLitOf`

**파일:** `shared/game/lamps.ts:houseLitOf(players, lampIds)`, `src/game/lampView.ts:houseLitOf(view)`
**문제:** 하나는 서버가 켜짐을 계산하는 순수 함수이고, 다른 하나는 view 의 `day.lamps` 사본을 읽는 클라이언트 파생이다. 서버 파일의 역할 읽기 분리 약속(주석)을 읽는 사람이 둘을 혼동하기 쉽고, 자동 import 가 잘못 고를 수 있다.
**수정:** 서버 쪽을 `computeHouseLit`, 클라이언트 쪽을 `housesLitInView` 같은 이름으로 구분한다.

### IN-04: `applySkip` 은 마감이 이미 지난(알람 대기 중인) 단계에서도 새 마감을 now 로 덮는다

**파일:** `worker/room.ts:applySkip`(`tick({ ...result.state, phaseEndsAt: now }, now, ...)`)
**문제:** 알람이 늦어 `phaseEndsAt` 이 이미 과거인 상태에서 과반 skip 이 오면, 연쇄 계산의 기준이 원래 마감이 아니라 now 로 바뀌어 다음 단계 마감이 늦어진다(GAME-01 "마감이 밀리지 않는다" 계약과 약하게 어긋남). `applyEndDiscussion` 이 이미 가진 같은 패턴이며 실제 영향은 알람 지연만큼이다.
**수정:** `phaseEndsAt: Math.min(result.state.phaseEndsAt ?? now, now)` 로 둔다.

### IN-05: `morning` 의 `errandTickAt` 갱신이 저장되지 않는다는 가정이 `afterTransition` 뒤처리와 암묵적으로 얽혀 있다

**파일:** `worker/room.ts:runErrandTick`(약 1586~1592행), `shared/game/tick.ts`(morning 훅)
**문제:** 아침 표본은 `this.room = { ...room, errandTickAt }` 로 메모리만 바꾸고 저장하지 않는다(결정 0076). 하이버네이션 뒤에는 저장된 옛 `errandTickAt`(진입 + 1간격)으로 돌아가 알람이 바로 울리고 한 번 더 근처 snap 을 보낸다. 해롭지 않으나, 이후 다른 쓰기(`persistAndBroadcast`)가 이 메모리 값을 우연히 저장하는 경로와 저장 안 하는 경로가 섞여 동작이 비결정적이다(관찰 가능한 차이는 없다).
**수정:** 주석으로 "저장 여부는 동작에 영향 없음" 을 명시하거나, 아침에도 저장 없는 별도 메모리 필드(예: `this.nearTickAt`)로 분리한다.

---

_검토 시각: 2026-11-15_
_검토자: Claude (gsd-code-reviewer)_
_깊이: standard_
