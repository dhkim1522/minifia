# 설계서

> 초안 (2026-10-21). 패키지와 버전은 결정 0009 에서 확정했다.

## 기술 스택

| 영역 | 선택 | 이유 |
|---|---|---|
| 클라이언트 | React 19.3.1 + TypeScript 7.0.2 + Vite 8.3.5 (v1 은 PWA 없이 웹 주소로 배포. 설치형은 앱 전환 때 판단, 결정 0041) | 링크로 바로 참가, 설치 불필요 (결정 0001) |
| 실시간 서버 | Cloudflare Workers + Durable Objects (wrangler 4.151.3, `@cloudflare/vite-plugin` 1.64.0, `Room` 클래스는 `exports` 로 선언) | 방 하나 = Durable Object 하나, WebSocket (결정 0002, 0009) |
| 정적 파일 배포 | Cloudflare Workers 정적 에셋 | 서버와 같은 곳에서 배포 |
| 테스트 | vitest 4.1.12 (unit / client / worker 세 프로젝트), `@cloudflare/vitest-plugin` 1.4.6, happy-dom 21.0.4, playwright-core 1.64.1(화면 E2E — 시스템 Chrome, dev 전용, 결정 0025) | 순수 규칙은 Node 에서, Durable Object 는 workerd 안에서 (결정 0009) |
| 메시지 검증 | zod 4.6.7 | 서버가 클라이언트 입력을 값으로 검증 |
| 캐릭터 | three.js 구·원통 조립 3D 인물, 관절 키프레임 동작 (v2.0, 결정 0047) | 맵과 같은 장면에서 그림. 외부 모델 파일·애니메이션 라이브러리 없음 |
| 앱 출시 | Capacitor 로 같은 웹 코드를 감쌈 | 정식 출시 단계에서 (결정 0001) |

## 구조

```
브라우저(각 플레이어 폰)
   │  WebSocket
   ▼
Worker  ── 방 코드로 라우팅 ──▶  Room Durable Object (방마다 하나)
                                  - 참가자 목록, 역할, 단계, 타이머
                                  - 밤 행동·투표 집계와 판정
                                  - 플레이어별로 볼 수 있는 상태만 골라서 전송
```

- 저장소는 한 저장소에 웹과 서버를 둔다. 공통 타입(메시지, 게임 상태)은 함께 쓴다.
- 디렉토리: `src/` 는 React 앱(화면·접속·스타일), `worker/` 는 Worker 진입점과 `Room` Durable Object, `shared/` 는 서버와 브라우저가 함께 쓰는 프로토콜과 순수 게임 규칙, `test/` 는 `unit`(Node)·`client`(happy-dom)·`worker`(workerd) 세 갈래 테스트다. `shared/` 는 앱과 워커 두 tsconfig 에 모두 들어가므로 DOM 전용·workerd 전용 API 를 쓰지 못한다. 이 규칙을 두 타입체크가 함께 강제한다.
- 서버가 단계 전환과 타이머의 기준이다. 클라이언트 타이머는 서버가 보낸 마감 시각으로 표시만 한다.
- Durable Object 의 WebSocket Hibernation API 를 써서 대기 중 비용을 줄인다.
- 기본판(결정 0072): 아래 낮 장치(순차 지목·결선·마지막 3인·배지·귓속말)는 `shared/game/ruleset.ts` 의 `RULESET` 다섯 값으로 꺼져 있다. 켜면 아래 설명대로 돈다. 꺼진 `badge`·`whisper` 메시지는 `BAD_MESSAGE` 한 프레임으로 거절한다.
- 낮 단계 흐름(결정 0066·0067): 지목이 정확히 두 사람 동점이면 **runoff**(결선: 앞머리 1 + 투표 5 + 결과 1.5초 서버 사슬, `stepRunoff`·`castRunoffVote`, 투표 메시지는 기존 `point` 를 단계로 분기)로 가고, 낮 시작에 산 사람이 정확히 3명이면 토론 대신 **showdown**(마지막 3인: 모이기 → 한마디 셋 → 동시 지목 → 공개)이다. showdown 진입은 낮 시작 발표(`dayAnnounce`) 마감 훅 한 곳이고, 한마디는 기존 `chat` 을 차례 주인에 한해 확정하며 동시 지목은 기존 `point` 다. 새 메시지는 `badge`(직업 주장 배지)·`whisper`(귓속말) 둘뿐이다.
- 핀 조명(`setPin`, `src/world/pinPlan.ts`): 렌더러가 처음부터 가진 focus 점광과 실내등 세기만 움직인다(새 광원 없음). 지목 차례·마지막 3인 한마디·결선·판결 순간에 쓰고, 판결 순간에는 줌 1.10 도 함께 쓴다(값은 결정 0067-8).

## 월드 (로비 맵)

v2.0 대기실은 "같은 공간" 맵이다(결정 0044·0050). 이동은 서버가 정하고 클라이언트는 그린다.

- 규칙 모듈: `shared/game/map.ts`(맵 정의 · 걸을 수 있는 칸 · `routeFx` 경로), `shared/game/world.ts`(이동 상태 · 스냅샷 · 복원). `shared/` 규칙대로 DOM 도 workerd 전용 API 도 쓰지 않는다.
- 서버 권위 이동: 클라이언트는 목적지만 보낸다. `Room` DO 가 `routeFx` 로 걸을 수 있는 경로를 구간 `{p, t0, v}`(점 목록 · 출발 시각 · 속도)로 바꿔 `emitWorld` 로 보낸다. `emitWorld` 가 world 프레임의 유일한 전송 경로이고 6페이즈 수신자는 로비의 연결된 전원이다(게임 중에는 world 프레임이 나가지 않는다). 7~9페이즈의 audience 함수가 이 자리로 들어온다.
- 저장: storage 의 `world` 키, `room` 키와 분리(위치가 room 키를 매번 다시 쓰지 않게). 이동 뒤 2초 디바운스로 쓰고, 나가기 · 내보내기 · 시작 · 마지막 연결 끊김 · 알람에서는 즉시 쓴다. DO 가 퇴거돼도 생성자가 두 키를 읽어 위치를 되살린다.
- 클라이언트: `src/world/` — `WorldStore`(서버 구간을 받아 시각별 위치를 계산, `RoomScreen` 이 연결과 같은 수명으로 소유) → `runtime`(rAF 한 곳에서 그림 · 카메라 · 입력 · 목적지 링) → three 렌더러(`threeRenderer`, `import()` 지연 청크라 방 입장 화면에서 미리 받는다) · 3D 캐릭터(`character`) · DOM 이름표(`WorldStage` 의 이름표 층). 게임이 시작되면 맵을 가린 뒤 WebGL 자원을 해제한다. 내 캐릭터는 탭하자마자 공용 planMoveSegment 로 예측 구간을 그리고 서버 구간이 오면 그쪽으로 맞춘다. 그릴 구간이 바뀌면 화면 위치 차이를 150ms 에 걸쳐 줄이고 방향·자세도 짧게 섞는다. 남은 예측하지 않는다(결정 0059, src/world/motion.ts).
- 성능 사다리(결정 0055): 합격선은 프레임 55fps 이상 등 숫자 기준이고, 모자라면 배율 → 그림자 → 광원 → 소품 → 안개 → 미리 구운 맵 이미지 순으로 줄인다. 그래픽을 못 쓰는 기기는 오류 카드를 띄우고 v1.0 테이블 로비로 몰래 바꾸지 않는다. 측정은 `?perf=1` 스파이크 장면에서 한다.
- 낮 처형 단계(결정 0060-1): 서버 단계는 `discussion`(90초) → `nomination`(기본판은 15초 동시 투표 `NOMINATION_MS`: `castPoint` 로 마감까지 바꾸기, `day.points` 공개, 같은 사람 250ms 안 재지목은 방송 없음, 봇은 2~8초 안 한 번) → `defense`(최후 변론 20초) → `verdict`(찬반 10초) → `execution`(처형 5초) → `night`(30초) → `morning`(5초)이고 값은 `shared/game/phases.ts` 한 곳에 둔다. 토론은 산 사람 과반이 [토론 끝내기](`endDiscussion`)를 누르면 마감이 당겨진다. 지목은 마감에 최다 득표가 정확히 한 명일 때만 변론자가 되고, 동률이나 0표면 처형 없이 밤으로 간다(기본판은 결선 없음). 찬반은 변론자를 뺀 산 사람 수 E 를 분모로 찬성 × 2 > E 면 처형이며, 전원이 던져도 마감까지 기다린다. 처형된 사람은 유령이 되고 역할은 알리지 않는다(결정 0053).
- 심부름·목격 기록·밤 통일·흔적(결정 0074): 서버 단계 `errand`(40초, 낮 시작 → errand → 토론, `ERRAND_MS`)가 낮 시작 다음에 끼고 `shared/game/errand.ts` 가 장소 3곳 뽑기·처리 판정을 맡는다(`{t:"errand"}` 한 메시지, 필드 없음·거절 응답 동일). 위치는 사건이 아니라 표본이다: 알람이 `ERRAND_TICK_MS` 1초마다 깨어 산 사람끼리 근처(`ERRAND_NEAR_R`)를 재고, 받는 사람마다 "나 + 근처 사람"의 `world` 프레임(`near: true`, 구간은 `ERRAND_VIEW_HORIZON_MS` 로 자름)만 보낸다. 같은 표본에서 본 사람·장소를 `Player.errandSeen` 에 쌓아 3곳을 마친 산 사람의 `me.record`(본인에게만, 상한 `RECORD_MAX`)로 토론에서 보낸다. 밤은 모든 산 사람이 같은 `pick` 메시지(대상 seat 하나)·같은 응답·본인 한 칸 snap 이고(마피아 걷기·접근 삭제, 밤 채팅 채널은 서버에 유지), 피해자가 나온 아침은 `shared/game/trace.ts` 가 피해자를 고른 산 사람 중 난수로 한 명의 의상에서 조각 id 하나를 정해 `day.morning.trace` 로 보낸다(아침 +`MORNING_TRACE_MS`). 허용 경로 사본 다섯 곳과 근처 집합을 독립 계산하는 누설 시험이 새 표면을 고정한다. RULESET 에 새 스위치는 없다.
- 순차 지목(결정 0063-1·0064-3·0064-11, `RULESET.pickTurn` 일 때만 — 기본판은 아래 동시 투표): 모이기 3초 → 자리 순 한 명씩 8초 → 사이 0.9초 → 끝 2초. 서버가 진입 때 산 사람 좌석 순서를 `pickTurn`(서버 전용)에 두고 `stepNomination` 이 차례를 넘기며, `castTurnPoint` 는 차례 주인의 지목만 받는다(바꾸기 없음). 끊긴 사람의 차례도 8초를 기다린다. 공개 차례는 `day.turn` 이다.
- 이동 마스크(MAP-04, 결정 0060-6): 서버 순수 함수 `canMove` 가 정한다. 로비 · 낮 시작 · 토론은 산 사람이 자유롭고, 지목 · 변론 · 찬반 · 처형 · 밤 · 아침은 산 사람이 정지한다. 유령은 모든 지도 단계에서 자유롭다. 막힌 요청은 오류 없이 버린다. 채팅은 막지 않는다.
- 지도 단계 위치 전송: world 프레임의 받는 사람은 **움직인 사람(mover) 기준**이다 — 산 사람이 움직이면 방 전원(산 사람 + 유령), 유령이 움직이면 유령에게만 간다(`shared/game/audience.ts`, mover 는 서버가 소켓의 playerId 로 넣는다). 접속(hello) 스냅샷은 **보는 사람(viewer) 기준**이다 — 산 사람에게는 산 사람 위치만, 유령에게는 전원. 그래서 유령의 위치는 산 사람 폰에 네트워크로도 가지 않는다(GHOST-01). 처형 연출은 화면이 처형 이벤트 하나로 그리는 일회성이고 서버가 산 사람에게 유령 위치를 보내는 것이 아니다.
- 서버 주도 모이기(결정 0060-7): 지목이 시작되면 서버가 산 사람 N명(2~8)을 무대 둘레 반지름 2.65 원 위 슬롯으로 걷게 한다(`shared/game/gather.ts`). 배치는 "지금 단계가 요구하는 배치"를 맞추는 **멱등 동기화**라서 알람 따라잡기 · 퇴거 · 재접속에도 같은 결과가 나온다. 변론 · 찬반 동안 변론자는 무대 위 `STAGE_SPOT`(`shared/game/map.ts`)에 서며, 이것이 이동 마스크(`lineWalkable` · `snapToWalkable` · 저장 복원이 같은 판정)의 **단일 예외**다.
- 화면 층 구조와 폰 크기별 영역은 `docs/screen-map.md` 의 '대기실 (맵 로비)'와 '게임 맵 화면'.

## 밤과 아침 (9페이즈, 결정 0061)

밤에는 산 마피아만 맵을 걷고 시민 편은 어둠 속에 있으며, 아침에 현장·유언·쪽지가 공개된다. 판정은 모두 서버가 하고 화면은 받은 상태만 그린다.

- 받는 사람(`shared/game/audience.ts`, 결정 0061-2·3): 이동 권한은 `canMoveIn(phase, alive, isMafia)` 한 표다(8페이즈 `canMove` 대체). 밤의 audience 는 산 마피아가 움직이면 {산 마피아 + 유령}, 산 비마피아는 이동 요청을 오류 없이 버리고 프레임이 가지 않는다. 보는 사람 기준 위치 snap 은 `worldVisibleTo` 가 정한다 — 밤 진입에서 시민·경찰·의사는 본인 한 칸, 산 마피아는 산 사람 전원, 유령은 전원이고 재접속 첫 snap 도 같은 함수를 지난다. 아침 snap 만 모든 산 소켓에 같은 내용이다.
- 전환 후처리는 `worker/room.ts` 의 `afterTransition` 한 함수다(결정 0061-19). 단계 마감·토론 끝내기·테스트 넘기기가 같은 순서를 지난다(지목 중 넘기기는 남은 차례를 봇 표로 채워 지목을 한 번에 끝낸다, `finishNomination`): home 기억 → 분필 → 저장·방송 → 밤·아침 위치 동기화 → 새 유령 snap → 낮 배치 → 카드. 새 전송 경로를 더하지 않는다.
- home 기억(0061-3~5): 그날 처음 걷기 단계(지목 이후)를 벗어날 때 각자 구간 끝점을 world 저장 키의 `home`(`{day, pos}`)에 기록하고 즉시 저장한다(`captureHome` 은 같은 일차면 입력 그대로라 멱등). 밤 진입은 home 으로 걷기 없이 옮기고(`teleportHome`), 아침은 산 사람과 그 밤의 피해자를 home 으로 되돌린다. home 은 서버 전용이라 프레임에 싣지 않는다. 지도 단계 레이아웃 키에 `{day}:night`·`{day}:morning` 이 더해졌다. 알람 따라잡기로 아침을 건너뛰어도 `:night` 키가 남으면 다음 지도 단계 진입에서 home 되돌림 + 보는 사람별 snap 한 번을 한다(0062-10).
- 마피아 확정(0061-6·7): 산 마피아 전원이 같은 산 비마피아를 골랐을 때만 확정이다(도착은 조건이 아니고 판정에 난수가 없다). 연결은 보지 않는다 — 고르지 않은 채 끊긴 마피아가 있으면 그 밤은 무효, 고른 뒤 끊기면 선택이 유지된다. 집계는 산 마피아 본인 view 의 `me.nightTally`·`me.nightSure` 로만 가고 시민 편·유령 view 에는 키가 없다.
- 유언·쪽지(0061-9·10): 메시지 `will`·`note`, 유언 50자(`WILL_MAX_GRAPHEMES`, 0064-15)·쪽지 100자(채팅과 같은 정리 함수), 사람마다 최소 간격 500ms 이고 초과는 오류 없이 버린다. 저장 응답은 본인 소켓(`me.will`)과 산 마피아 소켓(`me.note`)에만 가며 다른 사람에게는 어떤 프레임도 가지 않는다(입력 중 신호 포함). 쪽지는 확정일 때만 저장하고 작성자는 저장하지 않으며, 탈락이 없는 밤(무효·구출)에는 아침 판정에서 버린다.
- 사망 카드·분필(0061-11·14): 사람이 죽으면 서버가 `all` 채널에 카드 줄(`k: "will"`·`"note"`, 피해자 seat)을 만든다. 순서는 앞선 처형 유언 → 그 밤 피해자 유언 → 쪽지이고 채팅 보관·재접속 30줄 복원을 그대로 따른다. 분필은 `day.chalk`(고정소수점 x·z)로 공개하고 다음 밤 진입에서 지운다(처형에는 없다).
- 유언 편지(0063-3·0064-5·0064-7): 암살 유언은 카드(`k: "will"`)로 오고 화면이 가운데 편지로 보인 뒤 접힐 때 카드를 채팅에 낸다(카드 보류, 새 메시지 종류 없음). 처형 유언은 카드 그대로(0064-8). 시간 값은 `src/game/willLetter.ts` 한 곳, 손글씨 글꼴은 `public/fonts/nanum-pen-script/` 의 같은 출처 조각이다.
- 아침 길이(0061-13, `shared/game/phases.ts`): 기본 5초 + 실제 탈락 2초 + 피해자 유언 2초 + 공개된 쪽지 2초, 상한 15초. 아침에 공개되는 내용만의 함수라 비공개 밤 행동은 길이에 영향이 없다. 값은 이 한 곳에서만 고친다.
- 긴장 연출(0061-15): 시민 편 진홍 맥박·발소리 큐(`src/world/tension.ts`)는 클라이언트가 자기 난수와 로컬 시계만으로 만든다. 서버 프레임·시각·마피아 수와 무관하고 소리는 없다. `test/unit/tensionStaticGuard.test.ts` 가 큐 모듈(`src/world/tension.ts`)은 import 0개, 화면 부품(`TensionVignette.tsx`)은 허용 목록 밖 import 와 서버 시각 이름이 없음을 정적으로 검사한다.
- 누설 시험: 밤 비밀(마피아 이동·선택·쪽지)이 시민 편 소켓에 가지 않음은 `test/worker/nightLeak.test.ts` 의 메타모픽 시험(마피아 행동만 바꾼 두 판에서 시민 편 프레임 열이 같음)과 `leak.test.ts` 의 서버 전용 키 검사가 맡는다.
- 성능: 밤은 시민 편이 캐릭터 1명이라 가볍고 마피아 판이 기준이다. 크롬 CPU 4배 스로틀 측정(`scripts/perf-run.mjs --mode nightload`)은 낮 + 밤 + 아침 5분 흐름의 숫자를 남기고, 폰 합격은 실기기에서 판정한다(`.planning/phases/09-night-morning/09-DEVICE-CHECKS.md`).

## 채팅 (이벤트 프레임)

- 이벤트 프레임(world · chat · typing)의 받는 사람은 `shared/game/audience.ts` 한 함수가 정하고 `worker/room.ts` 의 `deliver` 한 길로만 나간다. 채널은 보낸 사람 서버 상태로 정한다(`all` · `mafia` · `ghost`) — 클라이언트는 채널을 고르지 않고 받은 줄만 그린다. 봇 입력 중은 서버 안 `relayTyping`(사람과 같은 `channelOf`·`typingRelay`·audience)을 지나며 채팅 줄 1.5초 전에 켜진다(0062-9). 테스트 도구 `setBotCount` 는 난수(`randInt`)를 받아 첫 봇만 8자, 나머지를 1~8자로 정한다(0062-8). 채팅 줄은 DO storage 의 `chat:` 키에 보관하고, 재접속 때 보낼 때의 수신자 마스크로 채널별 최근 30줄을 되돌려 준다(결정 0058).
- 귓속말(결정 0066-2·0067-4): 본문 줄(`k: whisper`)과 사실 줄(`k: whispered`, "A → B 귓속말")이 `all` 채널의 같은 seq 를 한 번만 쓴다(틈 없음). 받는 사람은 audience(all) 한 번을 당사자(보낸·받은 사람)와 나머지로 가르고, 본문은 당사자 소켓에만 간다. 본문은 `RoomState.whispers`(서버 전용)에도 쌓는다.
- 찬반 기록 카드(`k: ballots`, 결정 0067-5): 보관 상한 계수·삭제에서 빠지고 복원 때 채널 30줄 한도와 별도로 최근 3장을 더한다(`CHAT_REPLAY_BALLOTS`).

## 캐릭터·동작·의상 (10페이즈, 결정 0068)

- 새 메시지는 `emote`(`id`·`pk`)와 `dress`(`look`) 둘이고, 새 프레임은 `{t:"emote",seat,id,n}` 하나다. 채널·받는 사람은 서버가 정한다(채팅과 같은 `audience`, `n` 은 all·mafia·ghost 채널별). 동작은 복원·저장하지 않는다.
- 연타·간격 규칙은 `shared/game/emote.ts`(`emoteGate`, 앞 동작이 끝나야 다음·마지막 수락과 1000ms·10초에 5번). 기록은 `worker/room.ts` 의 인메모리 `emoteRates` 뿐이고 버려진 동작은 아무 응답이 없다. 서버 봇은 동작하지 않는다.
- 의상 `Player.look` 은 공개 값이다. 대기실에서만 바꾸고(`shared/game/look.ts`, 250ms 간격) `players[].look` 으로 모든 단계·모든 viewer 에게 같이 실린다. 역할과 무관하고 게임 시작·다시 하기 뒤에도 남는다.
- 장면: 좌석마다 look 을 입히고(`wear`), 유령 화면에서는 직업 의상 안개가 고른 의상을 덮은 뒤 끝나면 복원한다. 동시 동작 렌더 상한 4(`src/world/emoteCap.ts`, 도착 순서), 단계가 바뀌면 `stopAllEmotes` 로 정리한다. 이름표 층에는 동작 슬롯이 없다(머리 위 표시 없음).
- 테스트 훅(`?e2e=1`·개발 빌드): `window.__mfEmotes`(마지막 프레임·재생 중 좌석)·`window.__mfLooks`(좌석 → 의상 id).

## 결과 공개·다시 하기·방 연속성·맵 (11페이즈, 결정 0069)

- 판 번호 `round`(`view.round`)가 단계 키 `'{판}:{일차}:{단계}'` 앞에 붙는다(`phaseKey` 한 곳). 새 메시지는 `ready{on,round}`·`rematch{round}`·`mapPick{map}`이고 거절은 오류 없이 보낸 소켓에 `state` 한 프레임이다.
- 결과 단계 채팅은 `CHAT_PHASES`·`channelOf`(ended 에서 null)가 아니라 `applyChat`·`audience` 분기·`view.me.chat` 으로 열린다. 전체 채널 하나, 동작·입력 중은 서버가 버린다.
- `resultLog{part,i,end,lines}` 프레임: mafia → ghost → whisper → claim → ballots, 40줄 청크, ended 진입 때 한 번과 hello 재전송(`shared/game/resultLog.ts`). 신분별 차이 없음, ended 전용.
- `result.awards`: 칭호 점수·동점·패 순서를 서버가 끝내고(`shared/game/awards.ts`) 화면은 재정렬하지 않는다. 입력은 서버 전용 `Player.stats`(판 중 `say`·`emote`).
- 다시 하기(`shared/game/rematch.ts`): `ready` 한 연결된 사람 ≥ 4 이면 방장 `rematch`, 허용 목록 리터럴로 방을 다시 만든다(의상 유지). 준비 안 한 사람은 `bench`(게임 코드가 안 봄)에서 쉬다 `sat` 로 결과에 합류, 본인 view 는 `resting` + 자기 한 줄 `players`.
- 연속성(`shared/game/continuity.ts`): 방장 이양(끊긴 지 45초, 가장 이른 `joinSeq`)·대기실 정리(3분)·결과 단계 `left` 표시, 테스트 방 3초·6초. 알람은 `nextWakeAt` 한 곳.
- 맵: `MAPS` 표(`shared/game/maps.ts`, 광장은 `mapPlaza.ts`), `PLAYABLE_MAPS = ["bar","plaza"]`, 랜덤은 시작(`beginGame`)에서 서버가 정해 `view.map` 에 싣는다(시작 전엔 키 없음).

## 소리 (12페이즈, 결정 0070)

- 소리 56개(배경음 7·효과음 49)는 전부 Web Audio 합성이고 외부 파일·라이브러리가 없다. 서버는 소리를 모른다 — 새 메시지·프레임·view 키가 0이다(`test/unit/soundProtocol.test.ts`). 출처와 레시피 지도는 `docs/audio.md`.
- `src/audio/` 구조:

  | 파일 | 역할 |
  |------|------|
  | `recipes.ts` | 소리 id → 레시피 표(`RECIPES`·`BEDS`), 한계·믹스 상수, 결정적 렌더 계획(`renderPlan`·`bedPlan`). import 0, 순수 데이터 |
  | `script.ts` | 시간표 대본(판결·밤·아침·결과·시상·유언·틱)과 동작 소리 게이트. 순수 함수 |
  | `synth.ts` | 렌더 계획을 노드 그래프로(실시간 엔진과 오프라인 렌더가 함께 씀), 버스·compressor |
  | `engine.ts` | 컨텍스트·보이스 상한(8)·노드 예산(48)·침대 크로스페이드·덕킹·대본 실행, `createEngine(deps)` |
  | `prefs.ts` | 켬/끔 저장값(`localStorage`), 서버로 가지 않는다 |
  | `testHook.ts` | `window.__mfSound`(요청 로그, id·시각만). `?e2e=1`·개발 빌드에서만 |
  | `unlock.ts` | 앱 하나의 엔진(`getEngine`)과 참가 버튼용 동기 잠금 해제 |
  | `useSound.ts` | 방 화면이 쥐는 훅: 엔진 구독, 제스처 resume, 숨김 suspend, 감독 연결 |
  | `audioView.ts` | 감독이 읽는 공개 view 필드 허용 목록(`AudioView`) |
  | `director.ts` | `AudioView` 차이와 닫힌 로컬 신호를 소리 출력으로 바꾸는 순수 함수(감독) |
  | `signals.ts` | 닫힌 로컬 신호 종류(`tap`·`card`·`deny`·`vote`·`emote`·`tensionCue`·`result`) |

- 감독 입력 규칙: 공개 view 차이 + 닫힌 로컬 신호만. 인자에 선택값·역할·좌석이 없다. 밤에는 서버 입력이 0이고 각자 난수 큐(시민 편은 시각 큐를 구독), 첫 스냅샷·재접속·epoch 변경은 침대만 깔고 일회성 소리는 내지 않는다. 시작 시각은 공개 단계 시각이고 아침·편지만 view 도착 기준이다. 정적 가드(`soundStaticGuard`)가 `src/audio/` 의 import 와 읽는 경로를 고정한다.
- 시험 페이지 `/?sound-lab=1`(개발·`?e2e=1` 문맥, 배포 진입 번들에 없음)이 56개를 들려주고 오프라인 렌더로 피크·NaN·길이를 검사한다(`window.__mfSoundLab`).
- 알림음 `ui.host`(결정 0073-4, 14페이즈): 닫힌 신호 `{ kind: "host" }`(인자 없음)가 띠의 단계 키가 바뀐 프레임에 한 번 울린다(합성 종 두 음, 소리 57개). 밤 진입에도 모든 역할이 같은 소리를 듣는 LS-7 예외이고 낮 시작 → 토론은 무음이다.
- 단추와 알약: `src/components/v2/SoundButton.tsx`. 화면 영역은 `docs/screen-map.md`.

## 상태 공개 원칙

- 서버는 플레이어마다 다른 상태를 보낸다. 시민에게는 다른 사람의 역할을 보내지 않는다.
- 마피아는 서로의 정체를, 경찰은 자기 조사 결과만 받는다.
- 게임이 끝났을 때와 탈락자 관전 화면에서만 전체 역할을 보낸다.
- 찬반(결정 0060-4, 개정 0067-5): 투표 중에는 누가 무엇을 골랐는지 어떤 소켓에도 실리지 않는다. 투표를 마쳤는지(좌석)와 집계 수만 공개하고, 내 값은 본인에게만 보내며 집계 직후 개인 값을 키째 지운다. 마감 뒤 처형 단계의 view 에서만 `day.verdict.ballots`(찬성·반대 좌석 두 묶음)를 모두에게 공개한다. 처형 발표에는 좌석만 싣고 역할은 비공개다. 지목(누가 누구를 가리키는지)과 지목 차례 `day.turn` 은 공개 정보라 모두의 view 에 같은 값으로 실린다(역할 무관, 0064-11).
- 정치·박진감 장치의 공개 값(결정 0066·0067): 공개는 `players[].badge`·`badgeSwapped`(직업 주장 배지와 말 바꿈 표시, 실제 역할이 아니다)·`day.runoff`(결선 후보와 단계, 마감 뒤 득표 수만)·`day.showdown`(단계와 차례, 동시 지목 중에는 `voted` 완료 좌석만, 공개에서 득표)·`day.verdict.ballots`·`day.verdict.last`(마지막 3인 처형)이고, 본인 한정은 `me.ballot`·`me.whisperUsed`다. 서버 전용은 `Player.badgeLog`·`RoomState.whispers`·`runoffVote`·`showdownPick`이며 어떤 프레임에도 실리지 않는다(누설 시험이 서버 전용 키를 본다). 기본판(결정 0072)에서는 `badge`·`badgeSwapped`·`day.turn`·`day.runoff`·`day.showdown`·`me.whisperUsed`·`me.ballot` 이 view 에 없다(누설 검사 허용 경로는 `politicsPathsFor(ruleset)`).
- 캐릭터 의상(결정 0068): 공개는 `players[].look`(역할과 무관, 모든 단계·viewer 같음)이고, 서버 전용은 동작 기록(`emoteRates`, 인메모리)이다. 동작 프레임 `n` 은 채널별로 세어 틈이 다른 채널에 새지 않는다.
- 결과 공개·다시 하기(결정 0069): 공개는 `view.round`·`mapChoice`·`map`·`players[].ready`·`players[].sat`·`resting`(쉬는 사람 본인에게만, 자기 한 줄)·`result.awards`와 ended 에서만 가는 `resultLog` 프레임이다(끝난 뒤라 신분 구분 없음). 서버 전용은 `Player.stats`·`disconnectedAt`·`left`·`bench` 로 어떤 프레임에도 실리지 않는다.
- 사회자 띠·빛남(결정 0073, 14페이즈): 자막 문장과 빛남 대상은 클라이언트의 순수 함수 `src/game/hostLine.ts`(`hostLineOf`·`callTargetsOf`)가 자기 view 의 허용 목록 값(`phase`·`phaseEndsAt`·내 `me.role`·`players[].{seat,nickname,alive}`·`day.candidate` 등)만으로 만든다. 서버·프로토콜에 새 필드·메시지가 없다(`git diff -- worker shared` 가 0). 다른 사람의 역할을 드러내는 `players[].job`·`me.allies`·`day.turn` 은 읽지 않고, 유령 줄도 직업을 말하지 않는다.
- 소리(결정 0070): 서버에 새 값·메시지가 없다. 설정(켬/끔)은 기기 저장소에만 있고, 훅 로그는 소리 id·시각만 싣는다(역할·좌석 없음). 12페이즈 누설 불변식 LS-1~LS-11: 소리가 정보를 나르면 화면에도 이미 있고, 밤 소리는 모든 역할이 같으며, 암살음은 피해자만, 받지 못한 프레임은 소리도 없다.
- 유령(결정 0060-8, 0021): 유령은 모든 사람의 역할과 밤 선택을 본다(spectate 경로). 유령 시점의 직업 의상 안개는 이 spectate 로 화면이 입힌다(서버 새 필드 없음, 0063-2·0064-14). 반대로 산 사람의 소켓 · DOM 에는 유령의 위치 · 움직임 · 채팅 · 입력 중이 없다. 이 규칙은 서버 한 곳(audience)에서 막고 시험과 E2E 누설 검사가 증명한다.

## 재접속

- 참가할 때 서버가 플레이어 토큰을 발급하고 브라우저 저장소에 둔다.
- 다시 연결하면 토큰으로 같은 자리에 붙고, 현재 상태를 다시 받는다.
- 끊긴 사람을 기다리지 않고 서버 타이머대로 진행한다. 마감까지 못 보낸 투표는 무효표(던진 표에서 뺀다), 밤 행동은 행동 없음, 직업 공개는 말 안 함으로 처리한다. 끊긴 사람도 생존자 수에 든다. 끊긴 사람은 테이블에서 흐릿하게 표시한다 (1페이즈 논의에서 확정, 4페이즈 결정 0034 로 개정, CONN-02).

## 테스트 배포

- `wrangler deploy` 한 번으로 URL 이 바뀌지 않고 갱신된다. 테스터는 링크만 열면 되고 Android·iPhone 구분이 없다.
- 배포 대상(v2.0 Worker 이름 `minifia-v2` 와 공개 주소)은 `scripts/deploy-target.mjs` 한 곳이 유일한 출처이고, 다른 스크립트는 이 값만 import 한다(결정 0043·0044). `npm run deploy` 는 `check-account.mjs`(개인 Cloudflare 계정 확인) → `vite build` → `check-deploy-target.mjs`(빌드 산출물의 Worker 이름 확인) → `deploy.mjs`(고정 인자로 `wrangler deploy` 실행, `npm run deploy -- <인자>` 는 거부) 순서이고 하나라도 어긋나면 배포 전에 멈춘다. v1.0 주소(`minifia`)는 v2 스크립트가 검사도 배포도 하지 않는다. v1.0 수정 배포는 `v1` 브랜치에서만 한다.
- 개발 중에는 PC 브라우저 탭 여러 개로 4~8명을 흉내 내고, 같은 Wi-Fi 의 폰으로 로컬 서버에 접속해 확인한다.

## iOS Safari 주의

- 화면이 꺼지거나 다른 앱으로 가면 WebSocket 이 끊긴다. 재접속이 필수 기능이다.
- 진동(Vibration API)이 동작하지 않는다. 앱으로 감쌀 때 Capacitor 로 붙인다.
- 소리는 사용자 제스처 안에서만 깨어난다(결정 0070-3, B-3). 참가·만들기 제출 탭 핸들러 맨 앞에서 **동기로** `unlockAudio()` 를 부른다(`await` 뒤는 제스처가 아니다). 재접속은 알약 또는 아무 탭의 `pointerup`·`touchend`에서 `resume()`. 오디오 세션은 `ambient`(무음 스위치 존중, 다른 앱 음악과 섞임), 탭 숨김은 suspend·복귀는 resume(놓친 소리는 안 틂), `interrupted` 복구는 실기기 확정 대기.
- 웹 푸시 알림은 홈 화면에 추가한 경우에만 된다. MVP 에서는 쓰지 않는다.
- 게임 중 화면 꺼짐 방지는 Screen Wake Lock API 를 쓰고, 지원하지 않으면 생략한다. (훅 `src/net/useWakeLock.ts`, 방 화면 `RoomScreen` 이 대기실부터 결과 전까지 건다. 결정 0038)

## 출시 경로

1. 웹 주소로 친구들과 실테스트(사용자 진행, 결정 0041)
2. 정식 출시: 같은 코드를 Capacitor 로 감싸 Android·iOS 스토어에 올린다. 웹 링크 참가는 계속 유지해 앱이 없는 친구도 들어올 수 있게 한다.
3. 스토어 심사(특히 iOS 의 "웹사이트를 감싼 것뿐인 앱" 거절)에 대비해 앱에는 진동, 공유 시트, 알림 같은 기기 기능을 붙인다.
4. 유료 아이템을 앱에서 팔면 스토어 인앱 결제를 써야 한다. 수익화는 출시 전에 따로 정한다.
