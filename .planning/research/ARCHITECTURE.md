# Architecture Research — v2.0 "같은 공간"

**Domain:** 방 하나 = Durable Object 하나인 실시간 소셜 추리 게임에, 공유 맵 이동·자유 채팅·동작·유령 계층을 얹기
**Researched:** 2026-10-30
**Confidence:** HIGH (v1.0 코드를 직접 읽고 통합점을 짚음, Cloudflare 한도·과금은 공식 문서 확인) / MEDIUM (이동 모델·주기·수치는 설계 제안이며 팀 테스트로 조정)

> 범위: v2.0 새 기능이 기존 구조(`worker/room.ts`, `shared/`, `src/`)에 어떻게 붙는지만 다룬다. v1.0 에서 그대로 쓰는 것(토큰 재접속, 서버 타이머, 알람 하나, zod 검증, 봇)은 반복하지 않는다.

---

## 1. 한 줄 결론

1. **이동은 "탭 목표만 보내고, 서버가 경로·속도를 정해 구간(segment) 하나로 방송, 클라이언트가 같은 함수로 보간"** 한다. 연속 위치 스트림은 쓰지 않는다. 서버에 틱 루프가 없으니 DO 가 하이버네이션을 유지하고, 속도 조작이 불가능하며, 메시지 수가 사람당 초당 한두 개 이하다.
2. **권위 상태(`state` 뷰)와 휘발 상태(위치·입력 중·동작·채팅)를 두 길로 나눈다.** 권위 상태는 v1 그대로 "저장 → `buildView` 방송". 휘발 데이터는 `world`/`chat`/`typing`/`emote` 이벤트 프레임으로, **받는 사람을 한 함수(`audience`)가 정하고** 저장은 지연·묶음으로 한다. v1 이 이미 `chat`/`emoji` 를 `onEvent` 로 흘린 선례가 있어 클라이언트 구조도 이어진다.
3. **누설 안전은 "받는 사람 집합을 단계×신분 표 한 곳에서 계산"** 하는 것으로 지킨다. `broadcastEvent`(무차별 전송)를 없애고 모든 이벤트가 `audience` 를 통과해야 컴파일되게 한다. 보내지 않는 것이 유일한 방어선이라는 결정 0002 의 원칙 그대로다.
4. **v1 단계 기계는 `claim`, `candidateVote`, `candidateVoteReveal` 를 지우고 `accuse` 를 더하며, `execVote` 를 "변론 뒤 찬반" 으로 재배치**한다. 투표 집계 코드(`vote.ts`)는 거의 재사용된다. 단 `enterExecVote` 가 `verdict` 를 지우는 위치를 옮기지 않으면 후보가 날아간다(함정 1).
5. **빌드 순서는 "월드 뼈대(로비 맵) → 채널·audience → 낮 흐름 교체 → 밤 → 유령 → 끝(재대결·시상) → 방장 이양·소리"**. 첫 단계부터 새 Worker(`minifia-v2`)에 배포해 팀원이 로비에서 걷게 한다.

---

## 2. 현재 구조에서 확인한 통합점 (실제 파일)

| 통합점 | 파일 | v2 에서 하는 일 |
|---|---|---|
| 메시지 진입·속도 제한·디스패치 | `worker/room.ts` `webSocketMessage`, `overRateLimit`(연결당 1초 20개), `switch (msg.t)` 의 `never` 가드 | 새 메시지 추가 시 `never` 가드가 누락을 컴파일 오류로 잡아 준다. 유지. 속도 제한은 종류별 예산을 더한다 |
| 프레임 크기 | `shared/protocol.ts` `MAX_FRAME_BYTES = 1024` | 채팅 80자(한글 3바이트 ≈ 240B), 유언 140자(≈ 420B)까지 들어간다. 올릴 필요 없음. 글자 수 상한은 스키마에서 코드포인트 단위로 건다 |
| 입력 검증 | `shared/schemas.ts` `ClientMessageSchema`(strictObject) | 새 메시지는 모두 `strictObject`. 신원은 항상 소켓 첨부 `playerId` 이고 메시지에 seat/id 를 싣지 않는다(v1 규칙 유지). 채널은 클라이언트가 고르지 않는다 |
| 권위 상태 저장·방송 | `Room.persistAndBroadcast`, `broadcast`, `sendViewTo`, `buildView`(`shared/game/view.ts`) | 느리게 바뀌는 것만 여기로: 단계, 생존, 의상, 지목 현황, 아침 결과, 분필 윤곽 |
| 휘발 이벤트 전송 | `Room.broadcastEvent`, `broadcastEventTo`, `nightChatRecipientIds`(`shared/game/night.ts`) | `audience.ts` 로 일반화. `broadcastEvent` 제거 |
| 단계 표·전이 | `shared/game/phases.ts` `PHASE_DEFS`, `shared/game/tick.ts` `ON_ENTER`/`ON_DEADLINE`, `shared/game/discussion.ts` `phaseDurationOf` | 단계 추가·삭제·시간 변경, 단계 표에 `world`/`chat` 정책 열 추가 |
| 처형 규칙 | `shared/game/vote.ts`(`castExecVote`, `resolveExecVote`, `tallyCandidateVote`), `shared/game/execution.ts`, `shared/game/endgame.ts`, `shared/game/win.ts` | `tallyCandidateVote` → 지목 집계로, `castExecVote` 는 찬반으로 재사용 |
| 밤 규칙 | `shared/game/night.ts` `pickTarget`, `resolveNight`, `enterMorning`, `pickRecipientIds` | 마피아 `pickTarget` 에 근접 검사를 더함. 경찰·의사는 그대로 |
| 방 상태 | `shared/game/room.ts` `RoomState`/`Player`, `startGame`, `leaveRoom`, `kickPlayer`, `normalizeStoredRoom` | 의상·유언·쪽지·방장 부재 필드 추가, claim 필드 삭제, 재대결 전이 추가 |
| 봇 | `shared/game/bots.ts`, `Room.actAsBot`(`never` 가드) | 봇 행동 종류를 새 메시지로 교체. 봇도 위치를 가진다(같은 `applyMove`) |
| 클라이언트 연결 | `src/net/useRoomConnection.ts` `parseServerMessage`(화이트리스트), `RoomEvent`, `onEvent`, `offset`(시계 보정, `src/net/clock.ts`) | **`parseServerMessage` 가 알 수 없는 `t` 를 조용히 버린다** — 새 프레임 종류를 여기에 안 더하면 화면에 아무것도 안 온다 |
| 화면 | `src/screens/RoomScreen.tsx`, `DayScene.tsx`, `Lobby.tsx`, `src/components/DayTable.tsx` | 고정 테이블 → 맵 무대. `usePhaseArrival` 은 단계가 앞으로만 간다고 가정하지 않는지 확인(재대결은 `ended → lobby` 역행) |
| 누설 검사 | `test/worker/leak.test.ts`(전 프레임 키 경로 검사, `FORBIDDEN_KEYS`, `SERVER_ONLY_KEYS`, `ROLE_PATHS_*`), `test/worker/helpers.ts`(`evictDurableObject` 포함) | 새 프레임 종류의 허용 경로·수신자 행렬 테스트 추가 |
| 배포 | `wrangler.jsonc`(`name: "minifia"`, `exports.Room` sqlite) | `name` 을 `minifia-v2` 로. 새 Worker 이름 = 새 DO 네임스페이스라 v1 저장 방과 섞이지 않는다 |

---

## 3. 권장 아키텍처

### 3.1 두 개의 길

```
                     클라이언트 (src/)
   ┌───────────────────────────────────────────────────────────┐
   │ React 트리(상태)            월드 스토어(React 밖, rAF 렌더)   │
   │  RoomView ← state 프레임     WorldClient ← world 프레임       │
   │  채팅 목록 ← chat 프레임      typing / emote 만료 타이머        │
   └──────────▲───────────────────────────▲───────────────────┘
              │ state (느림, 저장 후)        │ world/chat/typing/emote (빠름, 저장은 지연)
   ┌──────────┴───────────────────────────┴───────────────────┐
   │                Room Durable Object (worker/room.ts)         │
   │  webSocketMessage → zod → advance(tick) → 종류별 apply*      │
   │                                                             │
   │  권위 길: RoomState(room 키) ──buildView──▶ sendTo(viewer)    │
   │  휘발 길: World(메모리) + ChatLog(메모리) ──audience──▶ 받는 사람│
   │                                                             │
   │  저장: "room"(권위, 즉시) · "world"(위치 구간, 지연 2s)        │
   │        "log"(채팅 기록·통계, 지연 2s)                          │
   └─────────────────────────────────────────────────────────────┘
```

원칙: **게임 결과를 바꾸는 것은 권위 길, 사람이 서로를 느끼게 하는 것은 휘발 길.** 휘발 길의 값이 판정에 쓰이는 경우(마피아 근접 암살)는 서버 메모리의 같은 `World` 를 서버가 직접 읽는다 — 클라이언트가 보낸 위치를 믿는 일은 없다.

### 3.2 신규·수정 구성요소

| 구분 | 구성요소 | 책임 | 통신 상대 |
|---|---|---|---|
| **신규** | `shared/game/map.ts` | 맵 상수(크기, 이동 가능 격자, 로비 스폰점 8곳, 집결 링 슬롯 8곳, 이동 속도). 클라이언트·서버가 같은 것을 import | world.ts, 클라이언트 렌더 |
| **신규** | `shared/game/world.ts` | 순수 규칙: `Segment`, `positionAt(seg, t)`, `findPath(from, to)`(격자 A*), `applyMove`, `gather`, `freeze`, `disperse`, `distance`. 시각은 인자로만 받음 | room.ts(DO), 봇, 클라이언트 예측 |
| **신규** | `shared/game/audience.ts` | **받는 사람 계산 한 곳.** `audienceOf(kind, state, senderId?)`, `visibleSubjects(state, viewerId)`, `channelOf(state, sender)`. 단계×신분 표 | room.ts 의 모든 휘발 전송 |
| **신규** | `shared/game/chat.ts`(교체) | 자유 텍스트 정규화·길이·쿨다운 검사, 채널 결정(`day`/`night`/`ghost`), 기록용 줄 생성. v1 템플릿 표 삭제 | audience.ts |
| **신규** | `shared/game/emotes.ts` | 동작 ID 표(`EMOTE_IDS`), 허용 단계·신분, 쿨다운 | audience.ts |
| **신규** | `shared/game/awards.ts` | 종료 시 통계 → 칭호 계산(순수, 난수는 인자) | endgame.ts |
| **신규** | `shared/game/accuse.ts` | `pointAt` 설정, 지목 집계(최다 1명, 동률·0표는 후보 없음), 진입/마감 훅 | tick.ts, vote.ts 재사용 |
| **신규** | `shared/game/rematch.ts` | `ended → lobby` 전이(멤버 유지, 이탈자 정리, 역할·기록 초기화, 만료 갱신). `testTools.resetToLobby` 를 실서비스용으로 일반화 | room.ts |
| **신규** | `shared/game/host.ts` | 방장 부재 판정·이양 후보 선택(순수) | room.ts, tick.ts(`nextWakeAt`) |
| **신규** | `src/net/useWorld.ts` + `src/components/MapStage.tsx` | React 밖 가변 스토어, rAF 보간, 카메라 추적, 탭→월드 좌표, 입력 중 "…"·동작 말풍선 | useRoomConnection(`onEvent`) |
| **신규** | `src/components/ChatDock.tsx` | 하단 채팅창, 채널 표시, 입력 중 전송(상승/하강 엣지) | useRoomConnection |
| **수정** | `shared/protocol.ts` | 새 메시지·프레임·뷰 필드(§4), v1 템플릿/주장/후보 선택 타입 삭제 | 전부 |
| **수정** | `shared/schemas.ts` | 새 `strictObject` 들 | worker/room.ts |
| **수정** | `shared/game/phases.ts`, `tick.ts`, `discussion.ts`, `view.ts`, `vote.ts`, `execution.ts`, `night.ts`, `endgame.ts`, `room.ts`, `bots.ts`, `testTools.ts` | §6 |  |
| **수정** | `worker/room.ts` | 새 apply* 들, 월드 로드/저장, `audience` 경유 전송, hello 시 스냅샷, 방장 이양 알람 | — |
| **수정** | `src/net/useRoomConnection.ts` | `parseServerMessage` 화이트리스트 확장, `RoomEvent` 확장 | — |
| **삭제** | `shared/game/claim.ts`, `src/components/ClaimPanel.tsx`, `src/net/claimLines.ts`, `QuickMessageSheet.tsx`, `EmojiTraySheet.tsx`, `DefenseChips.tsx`, `CandidateVotePanel.tsx`, `src/components/DayTable.tsx`·`src/game/dayTable.ts`·`seatFloats.ts`·`useSeatTransitions.ts`(고정 테이블 계열) | 계획 단계에서 import 그래프로 한 번 더 확인 | — |

---

## 4. 이동·위치 설계 (질문 1 의 답)

### 4.1 모델 선택: "탭 목표 + 서버 구간 + 결정적 보간"

| 후보 | 클라→서버 | 서버→클라 | 평가 |
|---|---|---|---|
| A. 연속 위치 (10~20Hz) | 위치 좌표 스트림 | 모두의 위치 스트림 | 메시지 80~160/s(8명), 하이버네이션 불가(틱이 필요), 속도 조작 방어 필요, 누설 표면 넓음. **기각** |
| B. 탭 목표 → 서버가 구간 하나 방송 (**채택**) | `move {x, y}` 탭당 1개 | `world.move {s, p[], t0}` 탭당 1개 | 메시지가 사람당 ~1/s 이하. 위치는 `positionAt(seg, t)` 순수 함수로 어느 쪽이든 같은 값. 서버 틱 없음 |
| C. 서버 틱(10Hz)으로 모두의 위치 방송 | 탭 | 일괄 스냅샷 | 서버 안정적이나 알람/타이머 상시 가동 → 하이버네이션 불가·과금 증가. 이득이 B 와 같다. **기각** |

B 에서 서버가 저장하는 것은 사람당 구간 하나뿐이다.

```ts
// shared/game/world.ts (순수 — DOM/workerd API 금지, 시각은 인자)
export interface Segment {
  p: number[];   // [x0,y0,x1,y1,...] 맵 정수 좌표, 경로 꼭짓점 (최대 12점 정도)
  t0: number;    // 서버 시각(ms) — 이 구간이 시작된 순간
  v: number;     // 속도(맵 단위/초). 서버가 정하고 클라이언트가 고르지 않는다
}
export function positionAt(seg: Segment, t: number): { x: number; y: number };
export function findPath(from: Pt, to: Pt): Pt[] | null;  // 격자 A*, 도착점은 가장 가까운 이동 가능 칸으로 당김
```

### 4.2 메시지

```ts
// 클라이언트 → 서버 (strictObject)
{ t: "move"; x: number; y: number }          // 정수, 0..MAP_W/H. 탭한 곳의 맵 좌표

// 서버 → 클라이언트 (이벤트 프레임, 상태가 아님)
{ t: "world"; k: "move"; s: number; p: number[]; t0: number }   // 한 사람의 새 구간
{ t: "world"; k: "snap"; at: number; ents: Array<{ s: number; p: number[]; t0: number }> } // 보이는 사람 전부
```

`s` 는 seat 이다(v1 공개 식별자와 같음). `snap` 은 ① hello 직후 ② 보이는 집합이 바뀐 순간(§5.3) ③ 집결/흩어짐/재대결처럼 여러 명이 한꺼번에 움직일 때 보낸다.

### 4.3 서버 검증 (`applyMove`, 순수)

검사 순서(v1 규칙 함수와 같은 방식 — 계약으로 문서화):

1. 단계 표의 `world.mover` 가 이 사람에게 이동을 허용하는가 (로비·낮 토론: 산 사람 전부 / 밤: 산 마피아만 / 유령: 항상 / 그 외: 불가)
2. 보낸 사람이 방에 있는가 (탈락자는 유령 규칙으로)
3. 좌표가 정수이고 범위 안인가 → 아니면 `BAD_MESSAGE`
4. 최소 간격 150ms (넘치면 **오류 없이 버림** — 탭 연타는 정상 동작이라 `RATE_LIMITED` 를 쏟아 내지 않는다)
5. 현재 위치 = `positionAt(기존 구간, now)`, 새 경로 = `findPath(현재, 목표)`. 실패하면 거절
6. 새 구간 `{p, t0: now, v: MOVE_SPEED}` 로 교체. 속도는 서버 상수라 속도 조작이 불가능하다

거절(이동 불가 단계, 경로 없음)이면 보낸 사람에게만 **제자리 보정**(`world.move` 로 길이 0 경로)을 보내 클라이언트의 예측 이동을 멈춘다. 이 보정이 `sendRejection`(v1: 오류 + 전체 state 재전송)을 이동에는 쓰지 않는 이유다 — 이동 거절 때마다 큰 뷰를 보낼 필요가 없다.

캐릭터끼리 충돌은 두지 않는다(겹쳐 서 있어도 됨). 충돌은 서버 판정·경로 계산을 복잡하게 하고 한 폰의 지연이 남을 막는 일을 만든다.

### 4.4 방송 빈도와 비용

| 항목 | 값 | 근거 |
|---|---|---|
| 수신 메시지 | 사람당 ≤ 약 1/s (탭), 8명 ≤ 약 8/s | 탭 이동. 과금은 수신 WebSocket 메시지 20:1 비율 → 초당 0.4 요청 (공식 가격 문서) |
| 송신 | 구간 1개 × 볼 수 있는 사람 수(≤ 8) → 최대 64/s | 송신 메시지는 과금 없음 |
| 집결·흩어짐 | `snap` 1개씩 8명 | 구간 8개를 한 프레임에 |
| 틱 루프 | **없음** | `setInterval` 은 하이버네이션을 막고 시간당 과금을 늘린다 |
| DO 한도 | 객체당 초당 1000 요청 소프트 한도 | 연속 위치(A) 도 8명×20Hz=160/s 로 한도 안이지만, 하이버네이션·단순성에서 B 가 우세 |

공식 문서의 조언("작은 메시지를 많이 보내면 DO 가 과부하될 수 있다. 고빈도 데이터는 50~100ms 단위로 묶어라")은 연속 스트림을 택할 때의 이야기이고, B 는 애초에 고빈도 스트림이 없다. 다만 동작이 몰리는 장면(전원이 동시에 탭) 대비로, 같은 이벤트 루프 턴에서 같은 수신자에게 가는 `world` 프레임을 묶는 최적화(배열 프레임)는 **측정 후 필요하면** 한다.

### 4.5 클라이언트 보간

- 시간 기준은 기존 `offset`(서버시각−로컬시각, `useRoomConnection`)이다: `serverNow ≈ Date.now() + offset`.
- 렌더(rAF)마다 모든 보이는 캐릭터를 `positionAt(seg, serverNow)` 로 계산한다. **구간이 결정적이라 "보간 버퍼·지연 렌더" 가 필요 없다.** 탭이 숨겨져(rAF 정지) 있다 돌아와도 따라잡기 계산이 없다.
- 남의 새 구간이 올 때: 구간은 서버 수신 시각 `t0` 에서 시작하므로 클라이언트는 이미 `RTT/2` 만큼 앞서 있다. 화면 위치와 새 경로 위치의 차이(속도 × 지연, 몇 px)를 100~150ms 동안 섞어 튐을 없앤다.
- 내 탭: **즉시 예측 이동**(같은 `findPath`/`positionAt`), 서버가 같은 사람의 `world.move` 를 돌려주면 서버 구간으로 교체한다. 거절 시 서버 보정으로 멈춘다.
- 위치는 **React 상태가 아니다.** `useWorld` 는 `Map<seat, Segment>` 를 가진 외부 스토어이고 rAF 가 DOM transform(또는 canvas)을 직접 갱신한다. 이모티콘 폭주가 렌더로 번지지 않게 한 v1 의 `RoomEvent` 설계(T-02-22)를 이어 간다.

### 4.6 하이버네이션과 월드

| 문제 | 해법 |
|---|---|
| 하이버네이션/퇴거로 메모리 `World` 가 사라진다 | `"world"` 키(구간 맵, 수 KB)를 만들고 **생성자의 `blockConcurrencyWhile` 에서 `"room"` 과 함께 읽는다**. 쓰기는 이동이 있을 때 **2초 지연 묶음 + 단계 전환 시 즉시**. 지연 타이머(`setTimeout`)가 살아 있는 동안은 DO 가 하이버네이션하지 않으므로(공식 문서) 플러시 전에 잠드는 일이 없다. 배포·크래시로 잃는 것은 최근 2초 이내의 탭뿐이고 구간은 어차피 곧 끝난다 |
| 이동마다 `storage.put("room")` 을 부르면? | **하지 않는다.** v1 `applySay` 는 쿨다운 때문에 채팅마다 `room` 전체를 다시 쓴다. v2 의 쿨다운·타이핑 상태는 메모리(`Map<playerId,…>`)로 둔다. 쓰기가 앞에 있으면 출력 게이트가 같은 턴의 송신을 쓰기 완료까지 붙잡기도 한다 |
| 소켓 첨부(`serializeAttachment`)에 위치를 넣을까? | 아니다. 첨부는 연결 단위이고 연결이 닫히면 사라진다(최대 16,384바이트, 공식 문서). 재접속이 핵심인 이 게임에는 맞지 않는다 |
| 하이버네이션에서 깨어난 뒤 핑 응답 | 기존 `ping`/`pong` 은 시계 보정용 `serverNow` 를 담아 정적 자동 응답(`setWebSocketAutoResponse`)을 쓸 수 없다. 클라이언트가 주기 핑을 보내지 않는 현 구조(접속 직후 3개 + 복귀 확인)를 유지한다 |

### 4.7 집결(지목)·흩어짐

- `accuse` 진입 시 서버가 산 사람마다 링 슬롯으로 가는 구간을 만든다(`gather`, 속도 2배). 각자의 집결 직전 위치는 `World.pre[seat]` 로 보관한다. 이후 단계는 `mover: none`.
- **디자인 결정 필요 (기본값 제안: 흩어짐 있음):** 처형 뒤 밤으로 갈 때 모두를 집결 전 위치로 되돌릴지. 되돌리지 않으면 시민이 모두 가운데 링에 있어 마피아의 "다가가 암살" 이 의미가 없어진다(결정 0044-4). 되돌린다면 `execution → night` 진입에서 `disperse` 로 `snap` 한 번.
- 단계가 한 번의 `tick` 안에서 여러 개 지나가면(알람 지연) 중간 단계의 월드 전이는 **건너뛰어도 안전하게** 설계한다: 월드 전이는 "이 단계의 표준 배치로 만든다" 라는 멱등 함수이고, 마지막 단계 기준으로 한 번만 적용한다.

---

## 5. 휘발 데이터 분리와 누설 안전 (질문 2·3 의 답)

### 5.1 어떤 데이터가 어느 길로 가는가

| 데이터 | 길 | 저장 | 받는 사람 | 비고 |
|---|---|---|---|---|
| 단계·타이머·생존·방장·의상 | `state`(뷰) | `room` 즉시 | 모두 | 의상은 공개이며 역할과 무관(결정 0044-8) |
| **지목 현황** (`pointAt`) | `state`(뷰 `day.points`) | `room` 즉시 | 모두(유령 포함) | 판정에 쓰이고 모두에게 공개된 실시간 정보. 빈도는 지목당 1회라 `execTally` 와 같은 길이 맞다 |
| 찬반 집계 | `state` | `room` 즉시 | 모두 | v1 `execTally` 그대로, 개인 표는 본인만(`me.voteAgree`) |
| 밤 지목(`nightPick`)·일지 | `state` | `room` 즉시 | v1 그대로(`pickRecipientIds`) | |
| 분필 윤곽 | `state`(`day.chalk`) | `room` | 모두(살아 있는 사람은 아침부터) | 죽은 위치(밤 시작 시 확정한 시민 위치)를 `room` 에 확정 기록 |
| **위치 구간** | `world` 프레임 | `world` 키 지연 | `audience` | 아래 표 |
| 채팅 줄 | `chat` 프레임 | `log` 키 지연(끝 공개용) | 채널별 `audience` | 채널은 서버가 정한다 |
| 입력 중 | `typing` 프레임 | 저장 안 함 | 채팅 채널 `audience` ∩ 그 캐릭터를 볼 수 있는 사람 | 켜짐/꺼짐 엣지만 전송, 만료는 클라이언트 타이머 |
| 동작(emote) | `emote` 프레임 | 통계 카운터만 | 위치 `audience` 와 같음 | |
| 유언·마피아 쪽지 | 서버 전용 필드 | `room` | **죽은 뒤에만** `day.morning`/탈락 공개로 | 쓰는 동안 어떤 프레임도 나가지 않는다 |
| 끝 채팅 공개 | `reveal` 프레임 1회 | — | 모두(`ended` 에서만) | 뷰에 싣지 않아 `state` 가 비대해지지 않는다 |

### 5.2 `audience` — 받는 사람의 단일 정의

```ts
// shared/game/audience.ts (순수)
type Viewer = "town" | "mafia" | "ghost";               // 산 비마피아 / 산 마피아 / 탈락자
const viewerOf = (s: RoomState, p: Player): Viewer =>
  !isAlive(p) ? "ghost" : p.role === "mafia" ? "mafia" : "town";

/** 이 사람이 이 단계에서 볼 수 있는 캐릭터(seat) 집합. 월드 스냅샷의 단일 근거 */
export function visibleSubjects(s: RoomState, viewer: Player): ReadonlySet<number>;

/** 이 캐릭터의 움직임·동작·입력 중 프레임을 받을 사람 */
export function worldAudience(s: RoomState, subject: Player): ReadonlySet<string>;

/** 채널은 보낸 사람 상태로 서버가 정한다. 클라이언트는 text 만 보낸다 */
export function channelOf(s: RoomState, sender: Player): "day" | "night" | "ghost" | null;
export function chatAudience(s: RoomState, ch: "day" | "night" | "ghost"): ReadonlySet<string>;
```

단계×신분 표 (문서화된 계약, 단위 테스트가 그대로 고정):

| 신분 \ 단계 | 로비·낮·지목·변론·찬반·처형·아침 | 밤 |
|---|---|---|
| 산 시민 편 | 산 사람 위치 · `day` 채널 | **위치 없음 · 채팅 없음 · 동작 없음** (깜깜) |
| 산 마피아 | 산 사람 위치 · `day` 채널 | 산 사람 위치(시민은 정지) · `night` 채널 · 마피아 동작 |
| 유령 | **모든** 위치(산 사람+유령) · `day`+`night`+`ghost` 읽기, `ghost` 쓰기 | 같음 |
| 산 사람이 받는 것 | **유령의 위치·채팅·입력 중·동작은 어느 단계에도 없음** | 마피아 것은 시민에게 없음 |

- 유령이 `day`/`night` 채널을 **읽는** 것은 v1 `nightChatRecipientIds`(탈락자 포함)와 결정 0021(전체 관전)의 계승이다. 유령이 `day`/`night` 에 **쓰지는** 못한다(보낸 사람 규칙).
- `ghost` 채널의 읽기 권한을 유령으로 제한하는 것이 "산 사람에게 유령 채팅이 가지 않는다" 의 전부다.
- 채널 이름에 역할 단어를 쓰지 않는다(`day`/`night`/`ghost`). `leak.test.ts` 의 `ROLE_WORDS` 검사와 충돌하지 않는다.
- 채널별 줄 번호(`seq`)를 따로 센다 — v1 이 낮/밤을 나눈 이유(번호 간격으로 밤 메시지 수가 샌다)와 같다. 유령 채널도 별도 카운터.

### 5.3 "보이는 집합이 바뀌면 스냅샷" 규칙

가시성은 단계·생존·역할에 따라 바뀐다(밤 시작, 사망, 아침). 이벤트 프레임만으로 상태를 맞추려 하면 누락이 생긴다. 그래서:

1. `Room` 이 `state` 를 바꾼 직후(`persistAndBroadcast` 와 같은 자리, 곧 `advance`/`apply*` 의 끝) 각 연결에 대해 **`viewFingerprint = (viewer 종류, 보이는 집합의 크기·해시, 단계 종류)`** 를 비교한다.
2. 달라진 연결에만 `world.snap`(그 사람이 볼 수 있는 구간 전부)을 보낸다. 시민이 밤에 들어가면 빈 `snap`, 사망자는 유령 시점의 전체 `snap`.
3. 같은 근거 함수 `visibleSubjects` 와 `worldAudience` 는 서로의 역(逆)이어야 한다 — **속성 테스트**: 임의 상태·임의 두 사람 `a,b` 에 대해 `a ∈ worldAudience(b) ⇔ b ∈ visibleSubjects(a)`.

### 5.4 누설 경로와 막는 방법

| 누설 경로 | 방지 |
|---|---|
| 시민에게 마피아 밤 위치/채팅/동작/입력 중 | 해당 프레임은 `audience` 에 시민이 없어 **전송 자체가 없음**. 밤 시민 `snap` 은 빈 집합 |
| 산 사람에게 유령 위치/채팅 | 같음. 유령은 `World` 에는 있어도 산 사람의 `visibleSubjects` 에 없음 |
| 전체 `state` 재방송이 타이밍을 흘림 | 밤 마피아·유령의 행동으로는 `persistAndBroadcast`(전원 방송)를 하지 않는다. 위치·채팅·동작은 `state` 를 건드리지 않는다. v1 Pitfall 1 규칙 유지 |
| 프레임 개수·`seq` 간격 | 채널별 독립 카운터 |
| **긴장 연출(발소리·심장소리)이 실제 마피아 움직임에 연동** | 시민 쪽 연출은 **서버 이벤트와 무관한 클라이언트 난수/타이머**로만 만든다. 실제 이동·암살 이벤트에 연동하면 위치와 행동이 샌다 |
| 유언·쪽지 작성 사실 | 저장만 하고 어떤 프레임도 보내지 않는다. 쪽지 줄에 작성자 seat 이 없고, 여러 마피아의 쪽지 중 최종 대상에 투표한 사람의 것 하나만 쓴다 |
| 동작/입력 중이 유령과 산 사람을 가름 | 유령 동작은 유령에게만. 산 사람 화면에는 애초에 없음 |
| 새 프레임 타입이 누설 검사 밖 | `leak.test.ts` 에 허용 경로 목록과 **수신자 행렬 테스트**를 같은 작업 단위에서 더한다(§9) |
| 무차별 전송 함수 재도입 | `Room.broadcastEvent` 삭제. 모든 휘발 전송은 `emit(kind, payload, audience)` 하나로, 컴파일 시 `kind → audience` 표가 빠지면 `never` 가드로 실패(v1 Pitfall 15 선례) |

---

## 6. v1 단계 기계에서 지울 것과 바꿀 것 (질문 4 의 답)

### 6.1 새 흐름

```
lobby ─start→ assigning → roleReveal → dayAnnounce → discussion → accuse → defense → execVote(찬반) → execution ─┐
   ▲                                       ▲                                    │불통과/후보 없음                  │
   │                                       │                                    └──────────────→ night ←─────────┘
   │rematch                                └── morning ←───────────────────────────────────────── night
   └────────────── ended ←(승패: execution·morning 마감 훅)
```

| 단계 | v1 | v2 |
|---|---|---|
| `claim` | 순차 직업 주장 | **삭제** (`claim.ts`, `ClaimLogEntry`, `DayView.claimLog/turn`, 봇 claim, `normalizeStoredRoom` 의 claim 보정) |
| `discussion` | 40초 | 90초. 산 사람 과반이 `skipDay` 를 누르면 마감을 `now` 로 당김(`applyClaim` 이 `tick`+`reschedule` 하던 선례와 같은 경로) |
| `execVote` | 토론 직후 여부 투표 | **변론 뒤 찬반**으로 재배치. 길이 10초. `castExecVote`/`execTallyOf`/`resolveExecVote` 재사용 |
| `candidateVote` | 후보 선택 | **삭제** → `accuse` 가 대체 |
| `candidateVoteReveal` | 한 표씩 공개(길이가 표 수에 비례) | **삭제**. `phaseDurationOf` 의 특례, `candidateRevealMs`, `CANDIDATE_REVEAL_*`, `src/game/verdict.ts` 의 공개 시간표 삭제 |
| `accuse`(신규) | — | 15초. 집결 후 `point` 로 실시간 가리키기. 마감 훅에서 최다 지목 1명 → `verdict.candidate`, 동률·0표 → `night`(이유 코드 `tie`/`noVotes` 재사용) |
| `defense` | 후보만 템플릿 | 20초. 후보 = `verdict.candidate`. 채팅은 모두 가능(시선 집중은 화면 연출) |
| `execution` | 후보 탈락 | `execVote` 통과 시에만 진입. 훅은 그대로 |
| `night` | 템플릿 채팅·지목 | 마피아 이동·근접 암살·자유 채팅. 경찰·의사 `pick` 은 그대로 |
| `morning` | 5초 | 8초. 분필·쪽지·유언·"누군가 살아났습니다" |

### 6.2 `tick.ts` 변경점 (표 기반이라 작다)

```ts
// PHASE_DEFS: next 체인
discussion: { next: "accuse" }
accuse:     { next: "defense" }     // ON_DEADLINE: 후보 없으면 next:"night"
defense:    { next: "execVote" }
execVote:   { next: "execution" }   // ON_DEADLINE(resolveExecVote): 불통과면 next:"night"  ← v1 은 반대(통과가 기본 next)
execution:  { next: "night" }
```

- `ON_ENTER`: `claim`, `candidateVoteReveal` 행 삭제. `accuse` 행 추가(`enterAccuse`: `pointAt` 비움, `verdict` 비움). `execVote` 의 훅은 `enterExecVote` 에서 `verdict` 를 지우던 부분을 **빼서** `discussion` 진입 훅(`enterDiscussion`, 또는 `dayAnnounce` 의 `enterDayAnnounce`)으로 옮긴다.
- `ON_DEADLINE`: `claim`, `candidateVoteReveal` 삭제. `accuse` 추가, `execVote`/`execution`/`morning` 은 유지.
- `phaseDurationOf`(`discussion.ts`): `candidateVoteReveal` 특례를 지우면 `PHASE_DEFS[state.phase].durationMs` 한 줄이 된다.

### 6.3 함정 1 — `enterExecVote` 가 후보를 지운다

v1 `vote.ts` 의 `enterExecVote` 는 진입 시 `verdict`·`execution` 을 지운다. v1 에서 `execVote` 는 처형 시퀀스의 **첫** 단계였지만 v2 에서는 `accuse`(후보 확정) **뒤**에 오므로, 그대로 두면 후보가 지워져 `execution` 이 항상 비어 버린다. 지우는 시점을 `discussion` 진입(그날의 첫 처형 단계 전)으로 옮겨라. 이 변경은 `test/unit/vote.test.ts`, `execution.test.ts`, `nyquist-04-*.test.ts` 가 먼저 빨갛게 되므로 안전망이 된다.

### 6.4 단계 표에 정책 열을 더한다

`PhaseDef` 에 단계별 월드·채팅 정책을 데이터로 둔다(v1 철학: "코드 분기 대신 표 한 줄").

```ts
interface PhaseDef {
  durationMs: number | null; next: PhaseId | null; revealsOwnRole: boolean;   // 기존
  world: { mover: "alive" | "mafia" | "none"; layout?: "spawn" | "gather" | "disperse" };
  chat: "all" | "mafia" | "none";            // 유령은 항상 ghost 채널
}
```

`audience.ts`/`world.ts`/`chat.ts` 가 이 표 하나를 읽는다. 밤의 시민 "채팅 없음", 처형·아침의 채팅 허용 여부 같은 기획 변경이 한 줄 수정이 된다.

### 6.5 `view.ts` 변경

- `DAY_PHASES` 에서 `claim`, `candidateVote`, `candidateVoteReveal` 제거, `accuse` 추가.
- `buildDay`: `claimLog`/`turn` 삭제. `points: Record<seat, seat>`(accuse·defense, 모두에게), `chalk[]`, `morning.will/note` 추가. `voteLog` 의 `cand` 삭제(`VoteLogEntry` 단순화: `exec` + 후보).
- `PublicPlayer` 에 `outfit`(정수/문자열 슬롯 묶음, 공개). `MyInfo` 에서 `voteTarget` 삭제.
- `ended` 의 `result`: `awards: Array<{ seat; id }>` 추가. 끝 채팅은 뷰가 아니라 `reveal` 프레임.
- `Player.pointAt` 은 서버 필드이지만 뷰 허용 목록 리터럴로 필드별 복사(펼쳐 복사 금지 — v1 규칙). `Player.will`/`Player.note` 는 **`SERVER_ONLY_KEYS` 에 더해** 어떤 프레임의 어떤 경로에도 없어야 하는 키로 검사한다(죽은 뒤 공개되는 값은 `day.morning` 아래 별도 이름).

### 6.6 `normalizeStoredRoom`

새 Worker 이름이라 v1 저장 방은 없다. 그래도 v2 내부 배포 중 읽히는 방을 위해 **새 필드는 모두 optional + 읽는 쪽 기본값**을 지킨다. `claim` 보정 코드는 삭제 가능(v2 에는 옛 방이 없음).

---

## 7. 채팅 라우팅 (질문 2 의 채팅 부분)

흐름: `chat {text}` → zod(`strictObject`, 코드포인트 1..80, 제어문자·줄바꿈 제거) → `advance` → `chat.send(state, actorId, text, now, mem)`:

1. 보낸 사람 방에 있음
2. `channelOf(state, sender)`: 유령 → `ghost` / 산 사람 + 단계 정책 `chat:"all"` → `day` / 산 마피아 + 밤 → `night` / 산 시민 + 밤 → 거절(`WRONG_PHASE`, 역할 정보를 주지 않음 — v1 규칙)
3. 쿨다운(메모리, 연속 700ms 간격 + 5초 5개 같은 값 → 조정 대상)
4. 줄 `{ ch, seq(채널별), seat, text, at }` 생성, 메모리 로그에 추가(상한 줄 수·총 바이트)
5. `emit("chat", line, chatAudience(state, ch))`

`typing {on}`: 같은 채널 규칙, 켜짐/꺼짐 엣지만 서버로(켜진 채 3초마다 갱신 허용), 서버는 쿨다운 후 `emit("typing", {seat, on}, ∩)`. **서버 타이머 없음** — 만료는 클라이언트가 마지막 갱신 시각으로 판단한다. 연결이 끊긴 사람의 "…" 가 남지 않게 `webSocketClose` 에서 `on:false` 를 한 번 방송한다.

채팅 기록은 v1 의 "저장 안 함(결정 0017-7)" 과 달리 **v2 는 끝 공개·시상 때문에 서버가 보관**한다. `log` 키에 채널별 줄(총 400줄/60KB 상한)과 통계 카운터(사람별 채팅 수·동작 수·이동 거리·지목받은 횟수)를 두고 지연 저장한다. 값 상한 2MB 에 한참 못 미친다.

끝 공개: `ended` 진입 시 `reveal {night: ChatLine[], ghost: ChatLine[]}` 를 **모두에게 한 번** 보내고, `ended` 인 방의 `hello` 에도 다시 보낸다(재접속). 이 시점에는 누구도 산 게임을 하고 있지 않아 공개해도 판에 영향이 없다.

---

## 8. 재대결·방장 이양 상태 (질문 5 의 답)

### 8.1 재대결 (`rematch`)

`ended → lobby`, 방장만(또는 방장 부재 시 이양 후). 순수 함수 `rematch.ts`:

| 유지 | 초기화 |
|---|---|
| `players` 의 `id/token/seat/nickname/nicknameKey/joinSeq/outfit/isBot`, `hostId`, `code`, `createdAt`, `testMode` 계열 | `role`, `alive`, `nightPick`, `investigations/assassinations/treatments`, `execVote`, `pointAt`, `will`, `note`, `lastSendAt`; 방 쪽 `day`, `morning`, `verdict`, `voteLog`, `nightLog`, `winner`, `execution`, `chalk`, 채널 `seq`, 채팅 로그·통계, 월드 구간(로비 스폰점으로) |
| 연결된 사람 | **연결이 끊긴 사람은 목록에서 뺀다**(이탈자 정리). 단 돌아오면 `hello` 가 `invalid_token` 으로 `REMOVED` 닫힘 → 클라이언트가 처음 화면으로 — 방 안내 문구 필요 |

- `expiresAt` 를 `now + ROOM_TTL_MS` 로 되돌린다(`enterEnded` 가 30분으로 줄여 놓았다). 알람은 `reschedule`.
- 소켓은 닫지 않는다. 모든 연결에 `state` + `world.snap` 을 보낸다(`testReset` 이 이미 쓰는 길).
- 클라이언트: `usePhaseArrival`, `roomDiff`, `useRevealState` 가 단계가 되돌아오는 경우를 가정하는지 확인(v1 은 `testReset` 으로만 역행). 역할 카드 열림 상태, 본 기록 수(`recordsSeen`) 같은 판 단위 지역 상태를 `epoch` 또는 새 `gameId`(판 번호) 로 리셋해야 한다. **뷰에 `round`(판 번호) 정수를 더하는 것을 권한다.**
- 로비는 다시 `joinRoom` 이 가능하다(단계가 `lobby` 이므로 새 멤버 합류 허용).

### 8.2 방장 이양·이탈

v1: 방장 이양은 로비의 `leaveRoom` 뿐이고 `kickPlayer` 는 로비에서 끊긴 사람만 대상이다. v2 에서:

- `RoomState.hostAwayAt?: number` — `detachConnection` 이 방장이면 기록, `attachConnection` 이 지운다. 서버 전용.
- `host.ts`: `hostAwayAt + HOST_GRACE_MS(예: 30초)` 가 지나면 연결된 사람 중 `joinSeq` 가 가장 작은 사람(봇 제외, v1 `leaveRoom` 의 후보 규칙)에게 이양. 연결된 사람이 없으면 이양하지 않는다.
- **`nextWakeAt` 에 `hostAwayAt + GRACE` 를 더한다**(알람은 DO 당 하나라 단계 마감·만료·봇과 함께 `min` 으로 묶는 v1 구조에 한 항목 추가). 이게 없으면 하이버네이션 중 방장 이양이 일어나지 않는다.
- 명시적 `passHost {seat}` (방장이 현재 연결 중인 사람에게). 이양 결과는 `state` 로 모두에게.
- 로비 이탈자 자동 제거: `disconnectedAt` 기준 60초 후 제거(`kickPlayer` 의 자동판). 게임 중에는 **자리를 유지**(v1 CONN-02: 끊긴 사람도 생존 수에 든다).
- **미결정(요구사항 단계에서 확정):** 게임 중 영구 이탈(`leave` 를 어느 단계에서나 허용할지). 허용하면 탈락 처리(`alive:false`, 역할은 끝에 공개)와 승패 재판정이 필요하고 `win.ts` 분모에 영향이 있다. 기본 제안: 게임 중 `leave` 는 허용하지 않고, 끊김은 재접속을 기다리며 서버 타이머대로 진행(v1 동작)한다.
- WR-01~04(`DEFERRED-BUGS.md`, 연결 계층 경고)는 내용이 문서에 없다. **P1 시작 시 원인 코드(`useRoomConnection`/`linkReducer`/`worker/room.ts` 연결 처리)를 열어 확인**하고, 월드 프레임이 이 계층을 타기 전에 정리한다.

---

## 9. 따라야 할 패턴

### 패턴 1 — 순수 규칙 + 얇은 소켓 껍데기 (v1 유지)

`handleX(ws)` 는 소켓 첨부에서 `playerId` 를 꺼내고 오류를 돌려주며, `applyX(playerId)` 가 규칙 함수·저장·전송을 한다. 봇은 `applyX` 만 부른다(특권 없음). 새 메시지(`move`, `chat`, `typing`, `emote`, `point`, `will`, `note`, `outfit`, `skipDay`, `rematch`, `passHost`)도 같다. 봇이 월드에 들어가려면 `applyMove` 를 쓰면 된다.

### 패턴 2 — `emit(kind, payload, audience)` 단일 전송구

```ts
private emit(kind: EventKind, payload: object, ids: ReadonlySet<string>): void {
  const frame = JSON.stringify({ t: kind, ...payload });          // 직렬화 1회
  for (const ws of this.ctx.getWebSockets()) {
    const att = ws.deserializeAttachment() as SocketAttachment | null;
    if (att && ids.has(att.playerId)) ws.send(frame);
  }
}
```

호출부는 `this.emit("chat", line, chatAudience(this.room, line.ch))` 처럼 `audience.ts` 의 함수 결과만 넘긴다. 같은 프레임을 수신자 모두에게 한 번만 직렬화하는 것은 v1 `sendTo`(수신자마다 `JSON.stringify`)보다 이득이다.

### 패턴 3 — 지연 영속(휘발 길)과 즉시 영속(권위 길) 분리

권위 길: `await storage.put("room") → broadcast`(v1). 휘발 길: `emit` 이 먼저, 저장은 `scheduleFlush()`(2초 `setTimeout`, 플래그로 중복 방지, 단계 전환 시 즉시 플러시). 전송 경로에서 `storage.put` 을 부르지 않는다.

### 패턴 4 — 가시성이 바뀌면 스냅샷, 아니면 델타 (§5.3)

### 패턴 5 — 결정적 구간으로 시간을 공유

서버와 클라이언트가 같은 `positionAt` 을 쓴다. 지연이 있어도 같은 시각이면 같은 위치. 판정(근접 암살)도 서버의 `positionAt` 으로 하고, 허용 반경에 지연 여유(예: 한 걸음)를 둔다.

---

## 10. 피해야 할 안티패턴

| 안티패턴 | 왜 나쁜가 | 대신 |
|---|---|---|
| 클라이언트가 보낸 좌표를 그대로 저장 | 순간이동·속도 조작, 근접 암살 우회 | 목표만 받고 서버가 경로·속도를 정한다 |
| 위치 틱(setInterval/알람 반복)으로 방송 | 하이버네이션 불가, 과금 증가, 알람이 단계 마감과 충돌(알람은 DO 당 하나) | 구간 델타 |
| 위치·채팅을 `RoomView` 에 실음 | 매 `state` 방송에 낡은 위치가 실려 보간이 튄다, `state` 가 커진다, 허용 목록 검사 범위가 넓어진다 | 별도 프레임 |
| "화면에서 숨김" 으로 유령/밤 정보를 가림 | 네트워크로 이미 샌다 (결정 0002·0044-14) | `audience` 에서 제외 |
| 이동마다 `room` 전체 `put` | 쓰기 증폭, 출력 게이트 지연 | 메모리 + 지연 `world` 키 |
| 채널을 클라이언트가 지정 | 오라우팅·권한 상승 | 서버가 보낸 사람 상태로 결정 |
| 긴장 연출을 실제 암살/이동 이벤트에 연동 | 시민이 마피아 행동을 알아챔 | 클라이언트 난수 연출 |
| `broadcastEvent` 유지 | 새 프레임 종류가 실수로 전원에게 감 | 삭제하고 `emit` 만 |
| 월드 전이를 단계마다 비멱등으로 작성 | 알람 지연으로 여러 단계를 한 번에 따라잡을 때 중간 전이 누락 | 멱등한 "표준 배치" 함수, 최종 단계 기준 1회 |

---

## 11. 확장성 (4~8명 방 하나 기준)

| 관심사 | 평상시(8명) | 최악(8명 전원 연타) | 비고 |
|---|---|---|---|
| 수신 메시지 | 초당 한 자릿수 | 연결당 20/s 한도(기존) × 8 = 160/s | 이동 150ms 간격 제한으로 실제로는 ~50/s |
| 송신 | 초당 수십 | ≤ 수백 | JSON 100B 내외, 직렬화 1회로 줄임 |
| CPU/요청 | zod 파싱 + `tick` 동일성 검사 + A*(격자 작음) | 동일 | A* 격자는 한 칸 20유닛 안팎으로 작게 시작해 측정 |
| 과금 | 방당 게임 1판 ≈ 수천 수신 → 수백 요청 환산 | — | 무료 플랜(요청 10만/일, 시간 13,000 GB-s/일)이어도 몇십 판은 충분. 팀 테스트 규모에서 문제 없음 |
| 하이버네이션 | 로비 방치·끝 화면에서 잠듦 | 게임 중에는 깨어 있음 | 틱 루프가 없어 로비 대기 중 과금 없음 |
| 배포 | 배포하면 모든 DO 가 재시작·소켓 끊김 | — | 기존 재접속 로직이 처리. 판 도중 배포는 피한다 |

---

## 12. 빌드 순서 (질문 6 의 답)

각 페이즈 끝에 **새 Worker 에 배포되어 팀이 접속·검증**할 수 있어야 한다(작업 원칙: 이른 배포). v1 흐름이 어느 페이즈에서도 깨져 있지 않도록, 새 기능은 "추가 → 교체 → 삭제" 순으로 간다. 디자인(맵·몸체·의상·동작) 승인이 화면 페이즈 앞에 온다(CLAUDE.md "디자인 먼저").

| # | 페이즈 | 내용 | 선행 | 배포 시 사용자가 보는 것 | 검증 |
|---|---|---|---|---|---|
| **P1** | 월드 뼈대 | `wrangler.jsonc` → `minifia-v2`. `map.ts`·`world.ts`(경로·구간·`positionAt`)·`audience.ts` 골격. `move`/`world` 프레임, hello 스냅샷, `world` 키 지연 저장·생성자 복원. 로비 맵 + 탭 이동 + 카메라. 의상 슬롯 필드와 로비 `outfit`(자리표시 그림). `parseServerMessage` 확장, WR-01~04 확인·정리. 시작 이후는 **v1 흐름 그대로** | 맵·캐릭터 디자인 | 로비에서 서로 걷는 모습 | `world.test`(순수: 경로·보간·속도), 워커 테스트(`evictDurableObject` 후 위치 복원, 이동 간격 버림, 로비 외 단계 거절), 2~8 탭 E2E |
| **P2** | 채널·동작 | 자유 `chat`/`typing`/`emote` + `audience` 행렬 + `emit`. `broadcastEvent` 삭제. 채팅 로그(`log` 키). v1 `say`/`emoji`/템플릿·빠른 메시지 UI 삭제, `claim` 단계 삭제(`RoomScreen`·`DayScene` 에 하단 채팅창). 낮은 아직 v1 테이블 | P1 | 로비·낮·밤 채팅, 입력 중 "…", 동작(자리표시 애니메이션) | **누설 행렬 테스트**(신분×단계×종류), 속성 테스트(`worldAudience`↔`visibleSubjects`), `leak.test` 에 새 프레임 허용 경로 |
| **P3** | 낮 흐름 | 낮 토론을 **맵 위**로(자유 이동), `accuse`(집결·`point`)·`defense`·`execVote`(찬반) 재배치, `candidateVote*` 삭제, `enterExecVote` 의 `verdict` 이동(함정 1), `skipDay`, 시간 시작값(결정 0044-13), 고정 테이블 삭제, 봇 갱신 | P1·P2 | 정통 처형 흐름이 맵에서 돈다 | `tick.test`/`vote.test`/`nyquist-*` 갱신, 봇 한 판 자동 완주(`scripts/bots.mjs`), 배포본 smoke |
| **P4** | 밤·아침 | 마피아 이동 + `pickTarget` 근접 검사, 시민 편 깜깜 화면, 경찰·의사 얼굴 목록(기존 `pick`), `will`/`note`, 분필 윤곽 `day.chalk`, 아침 공개, "누군가 살아났습니다"(결정 0044-5, v1 D-13 변경), 흩어짐 결정, 긴장 연출(클라이언트 난수) | P3 | 밤 한 사이클 | 밤 누설 전수 테스트(시민 프레임에 위치·채팅·동작·쪽지 작성자 없음), 쪽지·유언은 죽기 전 어떤 프레임에도 없음 |
| **P5** | 유령 | 사망 시 유령 전환(스냅샷 재전송), 유령 이동·채팅·동작, 유령 시점 월드(전체 관전) | P4 | 탈락자가 떠다니며 관전 | 산 사람 프레임에 유령 흔적 0 |
| **P6** | 끝 | `reveal`(끝 채팅 공개), 통계·`awards`(시상식), `rematch`, 판 번호 `round`, 이탈자 정리 | P2·P5 | 결과 → 시상 → 같은 멤버로 다시 | 재대결 후 상태 잔재 없음(키 전수), 클라이언트 단계 역행 처리 |
| **P7** | 안정·소리 | 방장 부재 자동 이양(`nextWakeAt` 항목 추가), `passHost`, 로비 자동 제거, 소리(배경음·밤·처형·동작 효과음, iOS 는 참가 버튼에서 오디오 깨우기, 클라이언트 `onEvent` 구독으로 구동) | P6 | 방장이 나가도 판이 이어짐, 소리 | 알람 하이버네이션 중 이양 테스트 |

병행 가능: **의상·동작 에셋 제작**은 P1 이후 프로토콜(`outfit` 슬롯, `EMOTE_IDS`)이 자리표시 그림으로 먼저 돌고 있으므로 어느 페이즈와도 독립으로 진행하고 교체한다. 소리 에셋 확보도 병행.

순서 근거:
- **P1 먼저:** 모든 것이 위치 구간·`audience`·휘발 길 분리에 기대고, 하이버네이션 복원은 가장 늦게 발견되면 가장 비싼 결함이다.
- **P2 가 P3 앞:** 누설 행렬이 낮 흐름의 채팅 허용 범위를 고정하고, 템플릿 UI 를 지워야 낮 화면을 다시 짜기 쉽다.
- **P3 가 P4 앞:** 밤은 낮이 끝난 자리(집결·흩어짐)를 입력으로 쓰고, 처형 흐름이 먼저 돌아야 승패가 난다.
- **P5 가 P6 앞:** 시상 통계와 끝 공개가 유령 채팅·동작 데이터를 쓴다.
- **P7 이 마지막:** 방장 이양은 로비·끝에서 가장 필요하지만 동작만 하면 되는 기본(v1 로비 이양)이 이미 있다. 소리는 전 단계 이벤트가 정해진 뒤에 붙인다.

---

## 13. 열린 질문 (설계 중 결정이 필요)

| 질문 | 기본 제안 | 영향 페이즈 |
|---|---|---|
| 처형 뒤 밤에 집결 전 위치로 흩어질까 | 흩어짐 있음 | P3·P4 |
| 지목 최소 득표(1표로도 후보가 되나) | 최다 1명이면 후보, 동률·0표는 없음(v1 후보 선택 규칙 계승). 팀 테스트 후 조정 | P3 |
| 의사가 살렸을 때 마피아 쪽지 공개 여부 | 공개 안 함(알림 문구만) | P4 |
| 유언 공개 대상 | 사망(암살·처형) 모두 | P4 |
| 처형·아침 단계에서 채팅 허용 | 허용(`chat:"all"`) | P3·P4 |
| 게임 중 영구 이탈(`leave`) 허용 | 허용하지 않음, 끊김은 v1 처리 | P7 |
| 맵 크기·격자 칸·이동 속도 | 디자인 승인 후 상수로 확정, 측정 | P1 |
| 동작에 효과음·이동 영향 | 제자리 실행, 이동은 막지 않음(결정 0044-7) | P2 |
| 몸체 렌더 방식(DOM/canvas, Rive/Lottie) | 위치 갱신이 rAF + transform 이므로 몸체는 어느 쪽이든 붙는다. 에셋 리서치에서 정함 | P1·P2 |

---

## 14. 출처

- 저장소 코드(직접 확인): `worker/room.ts`, `worker/index.ts`, `wrangler.jsonc`, `shared/protocol.ts`, `shared/schemas.ts`, `shared/game/{view,phases,tick,room,chat,night,vote,execution,endgame,discussion,win,bots,testTools,alive}.ts`, `src/net/useRoomConnection.ts`, `src/net/phaseArrival.ts`, `test/worker/leak.test.ts`, `test/worker/helpers.ts` — HIGH
- `.planning/PROJECT.md`, `docs/decisions/0044-v2-same-space.md`, `docs/architecture.md`, `.planning/DEFERRED-BUGS.md` — HIGH
- Cloudflare Durable Objects WebSockets 모범 사례 — 하이버네이션 조건(타이머·알람·`setInterval` 이 막음, 대기 중 과금 없음), 첨부 최대 16,384바이트, 작은 메시지 다수 주의와 50~100ms 묶음 권고, 배포 시 DO 재시작·소켓 끊김. https://developers.cloudflare.com/durable-objects/best-practices/websockets/ — HIGH (공식, 2026-10-30 조회)
- Cloudflare Durable Objects 한도 — 객체당 초당 1000 요청 소프트 한도, 수신 메시지 32 MiB, 값 2 MB 상한, 알람 15분. https://developers.cloudflare.com/durable-objects/platform/limits/ — HIGH
- Cloudflare Durable Objects 가격 — 수신 WebSocket 메시지 20:1 요청 환산, 송신 무과금, 하이버네이션 가능 유휴는 시간 과금 없음, 무료 플랜 요청 10만/일·13,000 GB-s/일. https://developers.cloudflare.com/durable-objects/platform/pricing/ — HIGH
- 출력 게이트(저장 쓰기 중 송신 보류) 동작은 Cloudflare DO 일반 지식이며 이번에 문서를 다시 열어 확인하지 않았다 — MEDIUM. P1 에서 `put` 이 있는 경로와 없는 경로의 송신 지연을 한 번 측정해 확인할 것.
