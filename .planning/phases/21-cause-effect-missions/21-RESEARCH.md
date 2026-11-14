# Phase 21: 원인→결과 하루 흐름과 등불·집 찾기·현장 조사 - Research

**Researched:** 2026-11-14
**Domain:** 자체 코드베이스 안의 규칙·프로토콜·화면 확장(서버 Durable Object + 공유 순수 규칙 + React/three 클라이언트 + 시험 계층). 외부 라이브러리 도입 없음.
**Confidence:** HIGH (코드 구조·시험 배치·통합 지점은 이 세션에서 직접 읽어 확인) / MEDIUM (새 규칙의 세부 해석 — 아래 Open Questions)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

(21-CONTEXT.md `## Implementation Decisions` 의 D-01~D-30 을 그대로 옮긴다. 자동 진행으로 추천안이 채택된 값이고 사용자가 돌아와 바꿀 수 있다.)

#### 하루 순서와 단계
- D-01: 확장판의 낮 단계 순서는 `roleReveal`(첫날만) → `errand`(저녁 등불 당번, 지금의 단계 id 를 그대로 쓰되 자리를 옮긴다) → `night`(집 찾기) → `morning`(현장 조사) → `discussion` → `nomination` → `defense` → `verdict` → `execution` → (다음 날) `errand` … 이다. 처형이 없으면 execution 을 건너뛴다. 단계 id 를 새로 늘리지 않는다 — 같은 id 의 의미와 자리만 확장판에서 바뀐다(`nextPhaseOf(phase, rules)` 가 판 규칙으로 가른다).
- D-02: `dayAnnounce`(낮 시작 발표)는 확장판에서 `morning` 의 앞머리로 합친다(첫 아침 포함). 기본 마피아에서는 그대로 `dayAnnounce` 를 쓴다.
- D-03: 길이(추천 기본값, 사용자가 바꿀 수 있음): `errand`(저녁) 40초, `night`(집 찾기) 지금 값 그대로, `morning`(현장 조사) 30초, `discussion` 지금 값 그대로. 한 판 길이는 시간 목표일 뿐 고정 제한이 아니다.
- D-04: 저녁 단계 진입 때 "처형 직후" 연출이 끝난 뒤 곧바로 해가 지는 조명으로 이어진다(저녁 조명 이미 있음, 결정 0083-1 의 "저녁 · 할 일" 헤더 글자). 밤에는 켜진 등불만 빛나고 꺼진 등불은 어둡다(조명 열 `houseLit`).

#### 저녁 등불 당번 (원인 만들기)
- D-05: 지금 심부름(장소 배정·근처 표본·처리 거리 `ERRAND_ACT_R`·완료 표시)을 그대로 다시 쓴다. 장소는 마을의 가로등 자리 8곳(광장 둘레의 `lamp` 계열 장소 id 를 마을 좌표로 새로 정한다)이고, 각자 배정된 3곳 중 처리하는 것이 "등불을 켠다"이다. 모든 역할이 같은 목록·같은 개수·같은 처리 규칙을 받는다(결정 0074 D-03 유지).
- D-06: 마피아는 같은 단추로 "켜는 대신 심지를 자른다"가 가능하다. 서버는 마피아의 처리를 `cut` 으로 기록하고(역할 판정은 서버 전용), 화면과 응답은 켜기와 같다(겉보기 같음). 심지를 자른 등불은 저녁 동안 켜진 것처럼 보이다가 **밤에 꺼진다**. 마피아가 자르지 않고 켜기만 해도 된다(선택).
- D-07: 켜진 등불 = 그 등불과 가까운 집들이 "불이 켜진 창"을 가진다. 등불 ↔ 집 대응은 마을 지도 위 거리로 정한 고정 표다(등불 8 ↔ 집 8, 각 집에 가장 가까운 등불).
- D-08: 꺼진 등불은 **아침에 공개**된다(어느 등불이 꺼졌는지, 누가 껐는지는 아니다). 마피아 아닌 사람이 우연히 안 켜서 꺼진 등불(처리 못함)과 마피아가 자른 등불은 구별되지 않는다 — 둘 다 "꺼진 등불"이다.
- D-09: 근처 표본·목격 기록(`record`)은 저녁 단계에서 쓰인다: 누가 어느 등불 곁을 지나갔는지의 기록(지금 구조). 결정 0074 의 목격 기록 규칙 그대로(근처 사람, 같은 구역).

#### 밤 집 찾기 (원인이 정해지는 곳)
- D-10: 밤 고르기는 모든 역할이 같은 화면·같은 메시지(`pick { target }`)로 지도에서 집 하나를 누른다. 서버 메시지·판정(마피아 전원 일치 → 그 사람이 피해자, 의사 보호, 경찰 조사)은 지금 그대로이고, **화면만** 얼굴 목록 대신 마을 지도의 집(문패 얼굴)을 누르는 것이다. 자기 집을 누르는 것도 허용(응답으로 역할이 갈라지지 않게, 결정 0074-4·D-08).
- D-11: 밤에는 걸어 다니지 않는다(실시간 이동 없음 — 0074-4 의 누설 문제 회피). 밤 시작 때 모두 자기 집 앞으로 순간이동하고(지금 `teleportHome` 같은 장치 재사용), 지도 위 집들이 보이는 고정 시점에서 고른다. 고른 뒤에는 "고름" 표시(자기 화면에만).
- D-12: 밤 결과는 아침에 "발자국"으로 남는다: 피해자 집(또는 미수 집) 앞의 **발자국 수** = 그 밤 그 집을 고른 산 사람 수(본인 제외). 이 수 하나만 공개 단서다(누가인지는 아니다).

#### 아침 현장 조사 (결과가 단서가 되는 곳)
- D-13: 아침에 피해자 집(암살이 구출되면 미수 집) 앞 단서 지점 3곳이 생긴다: ① 발자국 ② 옷 조각 ③ 창문. 모든 산 사람이 자기 몸으로 지점 하나 이상을 살필 수 있다(걸어가서 [살펴보기], 지금 심부름 처리 단추와 같은 조작·같은 처리 거리). 한 사람이 한 지점을 한 번만 살핀다.
- D-14: 지점별 단서(나만 본다, 늘 단서일 뿐 확정이 아니다):
  - ① 발자국: 정확한 수(D-12). 누가 고른 것인지는 없다.
  - ② 옷 조각: 그 밤 그 집을 고른 사람 중 한 명의 의상 조각(결정 0074 D-06 `trace.ts` 그대로).
  - ③ 창문: 피해자 집 옆에서 **불이 켜진 창을 가진 이웃**(D-07)만 "창문에서 본 것" 하나를 받는다 — 그 밤 어느 한 사람이 그 집 쪽으로 가는 모습의 의상 조각 한 개(②와 다른 사람이면 우선, 없으면 같은 조각). 불이 꺼진 이웃의 창문 지점은 "어두워서 못 봤다"가 된다(꺼진 등불의 대가).
- D-15: 마피아가 만진 지점은 **흐려진다**: 마피아가 어떤 지점을 살필 때 그 지점은 "먼저 손댄 흔적" 상태가 되고, 그 뒤에 살핀 사람은 그 지점의 단서 대신 "먼저 손댄 흔적이 있다"만 받는다(단서를 못 얻음). 마피아 자신은 평소처럼 단서를 받는다. 마피아가 아닌 사람이 먼저 살피면 흐려지지 않는다. 서버만 역할을 안다 — 화면 응답 모양은 모든 역할이 같다(누설 검사).
- D-16: 구출된 밤(의사가 막음)은 미수 현장이다: 피해자가 없어 "누군가 살아났습니다"(결정 0083 그대로) 아침이지만 미수 집 앞에 같은 지점 셋이 생긴다. 어느 집인지는 공개하지 않고 현장 조사는 그 집 앞에서 이루어진다(집 문패 얼굴이 그대로 보이므로 누구 집인지는 보인다 — 이 정보가 새는 것은 의도다: 시민이 의사가 지켜 낸 집을 알게 되는 대가로 마피아가 노출된다는 균형, 결정 0081-3). 정체(직업)는 공개하지 않는다.
- D-17: 피해자도 미수도 없는 밤(마피아 의견 갈림, 아무도 안 죽음)은 현장이 없다 — 아침 조사 단계는 건너뛰고 바로 토론으로 간다.

#### 의심 보드와 토론
- D-18: 아침 조사가 끝나면 모두 광장 가운데로 모이고(지금 gather 장치 재사용) 토론이 시작된다. 토론 화면에는 **의심 보드**(얼굴 줄 + 표시)가 한 곳에 있다: 내가 얻은 단서(발자국 수·옷 조각·창문·먼저 손댄 흔적)가 해당 얼굴 옆의 표시로 보인다(옷 조각은 지금 흔적↔옷 표시, 결정 0079). 남의 단서는 보이지 않는다 — 말로 공유한다.
- D-19: 지금 [목격 기록] 단추(저녁 근처 목격)는 의심 보드 안의 한 칸으로 합친다. 말·채팅은 지금 그대로(구역과 무관).
- D-20: 처형된 사람의 정체는 판이 끝날 때까지 비공개를 유지한다(결정 0081-5). 튜토리얼에서 "정체는 판이 끝나야 알아요"를 미리 보여 준다.

#### 서버 판정·누설
- D-21: 등불의 `cut`, 단서 지점의 흐려짐은 서버 전용 값이다. 뷰에 싣는 것은 모든 역할이 같은 모양의 값뿐이다(예: 내가 살핀 지점 목록과 받은 단서). 남의 역할은 어떤 응답 모양·타이밍으로도 새지 않는다 — 누설 전수 시험(월드 프레임 + 뷰 키)에 새 단계를 넣는다. 거절 응답은 사유를 구별하지 않는다(L40).
- D-22: 모든 새 판정은 순수 모듈(shared/game)에 둔다(시각·난수는 인자). 기존 심부름·흔적·마을 구역 규칙을 최대한 재사용한다.
- D-23: 한 판 길이가 늘지 않도록 저녁·아침 단계에는 [건너뛰기]가 있다(모두 끝냈음을 누르면 일찍 넘어간다, 지금 토론 끝내기와 같은 방식, 공개 값은 누른 수뿐).

#### 화면 (글 최소, 보고 누르는 조작)
- D-24: 저녁: 마을 지도에서 가로등 자리가 보이고 배정된 3곳이 깜빡이는 금빛 테두리로 표시된다(지금 심부름 표시 재사용), 가까이 가면 [켜기] 단추. 켠 등불은 따뜻한 빛으로 켜진다.
- D-25: 밤: 고정 시점의 마을 지도에서 집 8채가 문패 얼굴과 함께 보이고, 집을 누르면 "고름" 표시(문패에 금빛 테두리). 불 켜진 창·꺼진 창이 집마다 보인다.
- D-26: 아침: 피해자(또는 미수) 집 앞 단서 지점 3곳이 반짝이고, 가까이 가서 [살펴보기]. 살핀 지점은 아이콘(발자국·옷 조각·창문)이 내 화면에 남고 의심 보드로 옮겨진다.
- D-27: 시안은 Design 캔버스 2~3개 + 추천안 바로 구현(사용자 확정). 오케스트레이터가 캔버스를 만들고 사본을 `design/v3.0/lamp-house/` 에 둔다.

#### 튜토리얼 (성공 기준 6)
- D-28: 17페이즈 튜토리얼 "첫 사건"을 새 흐름(저녁 등불 → 밤 집 찾기 → 아침 현장 → 의심 보드)과 "정체는 판이 끝나야 안다"는 안내로 고친다. 혼자 하기(서버 0)와 방장 스위치 두 진입로는 그대로다.

#### 검증·배포
- D-29: 서버 단위·워커 시험(새 단계 순서·등불·밤·아침 단서·흐려짐·누설), E2E(저녁 등불·밤 집 찾기·아침 현장 조사·의심 보드 한 판 완주, 확장판과 기본 마피아 두 판 모두), 튜토리얼 E2E, 누설 검사. 폰 6종은 새 화면의 겹침·보임만, 완주는 390×844.
- D-30: 바뀐 흐름만 돌리고 폰 6종 전체 회귀는 페이즈 끝에 한 번(로컬). 끝나면 minifia-v3 에 배포한다. 실기기 확인은 v3.0 끝 실테스트.

### Claude's Discretion
- 가로등·단서 지점의 정확한 좌표·치수, 단서 아이콘 모양, 단계 길이의 세부, 새 와이어 필드 이름.
- 계획을 몇 개로 나눌지(서버 규칙·화면·튜토리얼·검증 순서), 파일 나누기·시험 이름.
- 20페이즈의 알려진 한계: 좌석 0·7 집의 문 앞 자리(문에서 약 1.3 떨어진 모서리 쪽 칸)는 현장 조사 지점을 그 자리에 맞춘다. 닫힌 방 안 암살의 분필(P20-18)은 이 페이즈에서 정한다 — 추천: 암살은 집 앞(바깥)에서만 일어나므로 실내 분필 문제가 생기지 않는다.

### Deferred Ideas (OUT OF SCOPE)
- 소도시 블록(골목·부두·창고), 전체 지도 시트, 방명록, 구역 채팅(말이 벽을 넘지 않기).
- 집 안에 들어가 조사하기, 확정 증거(단서는 늘 단서).
- "정통 판"(배지·귓속말·결선), 판 종류별 튜토리얼.
</user_constraints>

<phase_requirements>
## Phase Requirements

ROADMAP 의 Phase 21 요구사항은 `TBD` 다. 아래 ID 는 이 연구가 제안하는 것이다(기존 접두 FLOW·HOST·ERRAND·TRACE·TUT·DEPLOY 와 겹치지 않게 새 접두를 썼다). 플래너가 `REQUIREMENTS.md` 에 옮기고 확정한다. `[ASSUMED]` — 사용자 확정 아님.

| ID(제안) | Description | Research Support |
|----|-------------|------------------|
| DAYFLOW-01 | 확장판 하루가 `roleReveal`(첫날) → `errand` → `night` → `morning` → `discussion` → … → `execution` → `errand` 로 돈다. 처형 없으면 execution 을 건너뛰고(→ 저녁), 현장 없는 밤은 morning 을 건너뛴다. 기본 마피아는 그대로 | "단계 흐름 재배선" 표, 패턴 1·2 |
| LAMP-01 | 저녁 등불 당번: 가로등 8곳 중 배정 3곳을 처리, 모든 역할 같은 목록·같은 응답 | 패턴 3, 장소 id 선택지 |
| LAMP-02 | 마피아 심지 자르기(`cut`, 서버 전용), 밤에 꺼짐, 꺼진 등불 아침 공개, 이유 구별 불가 | 패턴 3·4 |
| HOUSE-01 | 밤 집 찾기: 모든 역할 같은 화면·같은 `pick` 메시지, 순간이동·고정 개관 시점, 고름 표시 | 패턴 6·8(카메라), 기존 `pickTarget` |
| HOUSE-02 | 집 창이 `houseLit`(등불↔집 고정 표)에서 켜짐/꺼짐, 밤 조명이 역할로 갈라지지 않음 | 함정 6, 패턴 8 |
| SCENE-01 | 아침 현장: 피해자(미수) 집 앞 단서 지점 3, 살피기 1회/사람, 단서 3종(발자국 수·옷 조각·창문) | 패턴 5 |
| SCENE-02 | 마피아가 만진 지점은 "먼저 손댄 흔적", 구출 밤은 미수 현장, 현장 없음은 morning 건너뜀 | 패턴 5, 함정 4 |
| BOARD-01 | 토론 시작 때 광장 가운데 모임 + 의심 보드(단서 칩·얼굴 줄·꺼진 등불 줄·목격 칸), 처형자 정체 비공개 유지 | 패턴 7 |
| SKIP-01 | 저녁·아침 [건너뛰기](누른 수만 공개, 과반 규칙은 Open Question) | 패턴 4, Open Q 5 |
| TUT-06 | 튜토리얼 "첫 사건"이 새 흐름과 "정체는 판이 끝나야 알아요"를 보여 준다(혼자 하기·방장 스위치 모두) | 패턴 9 |
| LEAK-02 | 누설 전수 시험이 새 단계·새 view 키·새 메시지·서버 전용 이름(`errandCut`·touched 등)까지 넓어진다 | 보안 절, 검증 구조 |
| DEPLOY-06 | 페이즈 끝 폰 6종 회귀 + `minifia-v3` 배포(실기기 확인은 v3.0 끝 실테스트) | 검증 구조 |
</phase_requirements>

## Summary

이 페이즈는 새 라이브러리 없이 이미 있는 부품을 **재배선**하고 서버 규칙 네 가지(등불 `cut`·집 등불 표·현장 단서·건너뛰기)와 화면 네 가지(가로등 저녁·집 문패 밤·단서 지점 아침·의심 보드)를 더하는 일이다. 서버는 단계 표의 "기본 다음 단계"를 데이터로 두고 분기를 `nextPhaseOf(phase, rules)` 와 훅이 정한다 — 이 구조가 이미 19페이즈에서 `dayAnnounce` 분기 하나로 확장판/기본판을 갈랐으므로 같은 방식으로 확장하면 된다. 가장 큰 위험은 **코드가 아니라 시험 이전**이다: 기본 판 종류가 확장판이라 `dayAnnounce → errand → discussion` 순서를 가정한 시험이 test/ 아래 81개 파일에 있고(`grep -rl "dayAnnounce" test`), 심부름 단계를 직접 쓰는 시험이 40개 파일이다(`"errand"|errandPlaces|errandDone`).

두 번째 위험은 **의미가 어긋나는 곳**이다. ① `day` 일차가 `dayAnnounce` 진입 훅에서만 오르는데 확장판은 `dayAnnounce` 를 건너뛴다. ② `enterNight` 가 심부름 키를 지워 토론의 목격 기록이 사라진다. ③ 밤 조명·장면 표가 `me.role` 을 읽는다(`nightCitizen`, `lightingFor`) — D-04·UI-SPEC 의 "역할로 갈라지지 않는 밤"과 충돌한다. ④ 낮 `home`(토론 끝난 자리) 기억이 밤 순간이동의 출처인데, 새 흐름의 밤은 토론 뒤가 아니라 저녁 뒤라 집 앞 좌표 기억으로 바꿔야 한다. ⑤ `canMoveIn`·`audience`·`lightingOf`·`todOf`·`hostChimeOf` 가 단계 id 만 보고 판 규칙을 모른다. 이 다섯은 모두 "같은 id, 다른 의미" 결정(D-01)의 직접 비용이다.

세 번째로 계획에 영향을 주는 열린 설계 결정이 몇 개 있다(Open Questions): 가로등 `PlaceId` 8개를 어떻게 더할지, 새 규칙 플래그와 시험 이전 방식, 창문 단서가 지점 기준인지 살피는 사람 기준인지, 개관 카메라가 현재 카메라 상수와 맞는지, 아침에 남의 위치를 어디까지 보낼지.

**Primary recommendation:** `Ruleset` 에 확장판 전용 플래그 하나(예: `cause`)를 더하고 `nextPhaseOf`·훅·`canMoveIn`·`audience`·`view` 를 그 플래그로 갈라 서버를 먼저 끝낸 뒤(계획 1~4), 화면(5~8)·튜토리얼·검증 순으로 간다. 시험은 "옛 확장판 순서"를 가정한 파일을 한꺼번에 고치지 말고 플래그 시험 잠금(`lockModeMaps` 와 같은 모양)으로 보호한 상태에서 새 흐름 시험을 더하고, 마지막에 잠금을 걷는 계획을 둔다(Open Q 2).

## Architectural Responsibility Map

이 앱의 층: 클라이언트(React DOM 오버레이 + three 캔버스) · 방 Durable Object(`worker/room.ts`, 권위) · 공유 순수 규칙(`shared/game/*`, DO 와 화면이 같이 import).

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 하루 단계 순서·분기 | 공유 순수 규칙(`phases.ts`·`tick.ts`·`ruleset.ts`) | DO(알람·afterTransition) | 판정은 서버(결정 0002). 화면은 view.phase 만 읽음 |
| 등불 처리·`cut`·꺼진 등불 집계 | 공유 규칙(`errand.ts` 확장) | DO(메시지 수신·저장) | 역할을 읽는 곳은 서버 전용 모듈 한 곳(`errandFake.ts` 의 선례) |
| 집 등불 표(등불↔집) | 공유 규칙(고정 상수 + 순수 함수) | 클라이언트(3D 창·문패 점이 같은 view 값에서 그림) | 두 곳이 같은 값에서 나와야 어긋나지 않음(UI-SPEC P21-4) |
| 밤 집 고르기 | 공유 규칙(`night.ts pickTarget` 그대로) | 클라이언트(집 문패 단추 → `pick`) | 메시지·판정 변경 없음(D-10) |
| 현장 단서 생성·흐려짐·개인 기록 | 공유 규칙(새 `scene.ts`) | DO(저장·본인에게만 `sendViewTo`) | 단서는 서버 판정, 응답은 본인 view 에만 |
| 밤 위치(집 앞 순간이동)·아침 걷기 가시성 | DO(`syncHome`·`snapFrameFor`) + `audience.ts` | 클라이언트(개관 카메라) | 좌표를 보내는 길은 전부 서버가 거름(결정 0002·0021) |
| 개관 카메라·문패 DOM 단추·단서 표지 | 클라이언트(`camera.ts`·`HouseTag`·`ClueSpot`) | — | 장면은 3D, 눌림은 DOM(P21-3) |
| 의심 보드 | 클라이언트(view 의 내 단서·공개 값에서 파생) | — | 서버는 개인 단서·공개 꺼진 등불만 줌 |
| 건너뛰기 집계 | 공유 규칙(`toggleEnd` 와 같은 모양) | DO | 공개 값은 누른 수뿐 |
| 튜토리얼 | 클라이언트(`tutorialScript.ts` 가짜 view) | — | 서버 상태를 읽지도 바꾸지도 않음(TUT-05) |

## Standard Stack

### Core (이미 있는 것 — 새 설치 없음)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react / react-dom | 19.3.1 | DOM 오버레이(문패·단서 표지·보드) | `package.json` 직접 확인 [VERIFIED: package.json] |
| three | 0.186.1 | 마을 3D(가로등·창·개관 카메라) | 동상 [VERIFIED: package.json] |
| zod | 4.6.7 | 새 클라이언트 메시지 스키마(strictObject) | `shared/schemas.ts` 가 서버 입력 검증 원천 [VERIFIED: package.json, shared/schemas.ts] |
| vitest | 4.1.12 | unit·client·worker 세 프로젝트 | `vitest.config.ts` [VERIFIED: package.json, vitest.config.ts] |
| @cloudflare/vitest-plugin | 1.4.6 | worker 프로젝트(DO 통합 시험) | 동상 |
| playwright-core | 1.64.1 | E2E(`scripts/e2e/*`) | 동상 |
| typescript | 7.0.2 | `npm run typecheck`(앱·워커 두 tsconfig) | 동상 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| 가로등 `PlaceId` 8개를 새 id 로 추가 | 기존 id 8개를 좌표만 옮겨 슬롯으로 재사용(화면은 규칙으로 가로등 그림) | 새 id 는 타입 검사가 안내하지만 `PLACE_IDS`·`PLACE_NAME`·`PLACE_ART`(생성물)·E2E 사본 둘이 같이 바뀜. 재사용은 변경이 작지만 id 가 슬롯 번호로 의미가 바뀌어 읽기 어렵다(Open Q 1) |
| 개관 카메라를 `fixed` + 낮은 zoom | `camera.ts` 에 정사에 가까운 새 기저 | 기존 카메라 방위·높이는 모듈 상수라 `fixed` 는 경사 시점 그대로(집 사이 압축). 문패 겹침 검사를 통과하는지 계산 필요(함정 9) |

**Installation:** 없음. `npm install` 이 필요한 변경이 이 페이즈에 없다.

**Version verification:** 위 버전은 `package.json` 의 고정값을 읽은 것이다. 새 패키지가 없어 레지스트리 조회는 하지 않았다.

## Package Legitimacy Audit

이 페이즈는 외부 패키지를 설치하지 않는다 — **해당 없음**. (`gsd-tools query package-legitimacy check` 대상 0개. 새 의존성이 필요해 보이면 그것은 범위 이탈이다.)

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram (확장판 하루, 데이터 흐름)

```
[처형 or 건너뜀] ──(execution→errand, 또는 nomination/runoff/showdown 동률 next:"night" → "errand")
        │
        ▼
 errand(저녁 40s) ─ 클라이언트 [켜기](짧게=light / 길게=hold)  ──▶ errand 메시지(+hold?)
        │                                                       │
        │   서버: 산 사람 배정 3곳(가로등 id) ◀─ enterErrand       ▼ actErrand: 반경·미처리·산 사람 검사
        │   근처 표본 sampleErrand(같은 구역)                      마피아&hold → errandCut 기록 + errandDone 기록
        │                                                          그 밖 → errandDone 만 (응답 모양 동일)
        ▼
 night(집 찾기) ◀ enterNight: ① 꺼진 등불 집계(cut 이 이김 or 아무도 안 켬) → houseLit[8] 확정(공개 키)
        │                    ② 심부름 키는 지우지 않음(토론 목격 기록용)
        │   DO syncHome: 집 앞 순간이동(HomeMemo = TOWN_HOUSES[seat].front)  — 걷기 없음
        │   클라이언트: 개관 고정 카메라 + 집 문패 8 DOM 단추 ──▶ pick{target} (기존 pickTarget, 마지막 선택이 이김)
        ▼
 morning(현장 30s) ◀ enterMorning: resolveNight(기존) + buildScene()
        │      ├ 피해자/미수 집 seat, 발자국 수(고른 산 사람 − 본인), 옷 조각 ②, 창문 조각 ③(+이웃 houseLit)
        │      └ 서버 전용 touched{spot}, 개인 기록 sceneSeen[playerId]
        │   없음(D-17) → duration 0 으로 즉시 통과 or 규칙이 discussion 으로 직행
        │   클라이언트: 단서 지점 3 표지 + [살펴보기] ──▶ inspect 메시지 ──▶ 본인 view(me.scene)에만 단서/흔적/어둠
        ▼
 discussion ◀ 광장 가운데 gather(layoutKey 확장) + 의심 보드(me.scene + me.record + day.lamps)
        ▼
 nomination → defense → verdict → execution ─▶ (다음 날 errand)
```

### Recommended Project Structure (추가·변경 지점만)

```
shared/game/
├── ruleset.ts        # + 플래그 1개(예 cause) — 확장판 true
├── phases.ts         # nextPhaseOf 분기 확장, 단계 길이 상수(MORNING_SCENE_MS 등) 한 곳
├── tick.ts           # hooksOf(rules): errand 훅에 일차 +1, night/morning 훅 교체, 마감 훅 분기
├── errand.ts         # actErrand(hold), 가로등 후보(맵 데이터에서)
├── lamps.ts (신규)   # 등불 8 ↔ 집 8 표, 꺼진 등불 집계(houseLitOf) — 순수
├── scene.ts (신규)   # buildScene / inspectSpot / 흐려짐 / 개인 기록 — 순수, 역할은 여기서만 읽음
├── skip.ts (신규 or discussion.ts 일반화) # 저녁·아침 건너뛰기
├── mapTown.ts        # + 가로등 좌표 8, 단서 지점 좌표(집 앞 기준), 이웃 쌍 표
├── view.ts           # me.errand 게이트(확장판 errand 단계 유지), me.scene, day.lamps, day.scene(공개 지점)
├── movement.ts       # canMoveIn(phase, alive, rules?) — morning 걷기 허용
├── audience.ts       # morning 의 world 수신자(근처만) — Open Q 6
shared/protocol.ts    # PlaceId 확장, ClientMessage(+inspect, skip, errand.hold), RoomView 키
shared/schemas.ts     # 새 strictObject 3개
worker/room.ts        # handleErrand(hold)·handleInspect·handleSkip, syncHome(집 앞), captureHomeNow 분기
src/world/camera.ts   # overview 모드 / presence.ts lightingOf·lightingFor·visibleSeats 판 규칙화
src/world/maps/town.ts# 가로등 8, houseLit 창
src/components/v2/    # HouseTag, ClueSpot, ClueCard, SuspectBoard (신규) + ErrandAct(prop) 
src/game/             # hostLine(표 확장), phaseText, errandView(가로등), tutorialScript
```

### Pattern 1: 같은 id, 판 규칙으로 갈리는 다음 단계

**What:** `PHASE_DEFS` 는 "기본 다음 단계" 데이터이고 판 규칙에 따라 갈리는 한 곳을 `nextPhaseOf` 가 고른다. 지금은 분기가 하나뿐이다.
[VERIFIED: shared/game/phases.ts:102-105] 현재 본문(verbatim):
```ts
export function nextPhaseOf(phase: PhaseId, rules: Ruleset): PhaseId | null {
  if (phase === "dayAnnounce") return rules.errand ? "errand" : "discussion";
  return PHASE_DEFS[phase].next;
}
```
`PHASE_DEFS` 의 관련 줄 [VERIFIED: shared/game/phases.ts:81-88]: `roleReveal … next: "dayAnnounce"`, `errand … next: "discussion"`, `execution … next: "night"`, `night … next: "morning"`, `morning … next: "dayAnnounce"`.

**새 흐름에서 바뀌어야 하는 모든 다음 단계(전수):**

| 출발 | 기본판(그대로) | 확장판(cause) | 어디서 정해지나 |
|------|----------------|----------------|-----------------|
| `roleReveal` | dayAnnounce | **errand** | `nextPhaseOf` |
| `errand` | — | **night** | `nextPhaseOf`(표 값은 discussion) |
| `night` | morning | morning | 표 그대로 |
| `morning` | dayAnnounce | **discussion**(현장 없으면 morning 자체를 건너뜀) | `nextPhaseOf` + 아침 길이 |
| `execution` | night | **errand** | `nextPhaseOf` |
| `nomination` 동률·0표 | night | **errand** | `nomination.ts:89` 의 리터럴 `next: "night"` |
| `runoff` 동률 | night | errand | `runoff.ts:56,100,102` |
| `showdown` | night | errand | `showdown.ts:71,153`(둘 다 두 판에서 꺼짐이지만 코드가 남아 있음) |
| 승패 | ended | ended | `routeAfterExecution`·`routeAfterMorning` — 아침 마감에서 승패 판정이 morning→discussion 사이로 옮겨 감 |

리터럴 `"night"` 가 마감 훅 네 파일에 있다 [VERIFIED: grep `shared/game/{nomination,runoff,showdown}.ts`]. 하나의 도우미(예 `afterDayPhase(rules)`)로 모아야 누락이 없다. 훅은 `hooksOf(rules)` 를 받으므로 규칙을 넘길 수 있다(`nomination: (s) => resolveNomination(s, rules)` 가 이미 그 선례).

**승패 판정 위치:** `routeAfterMorning` 은 morning 마감에서 승패를 본다. 새 흐름에서 morning 이 30초 현장이면 그 마감에서 `ended` 로 가는 것이 맞다(암살로 마피아가 이긴 경우 토론이 없어야 함). 현장 없음으로 morning 이 길이 0 이면 마감 훅은 즉시 돈다 — 같은 훅이 처리하므로 안전하다(tick 은 `now >= phaseEndsAt` 이면 루프로 계속 넘긴다 [VERIFIED: shared/game/tick.ts `while (current.phaseEndsAt !== null && now >= current.phaseEndsAt)`]).

### Pattern 2: 일차(day) 증가 위치

[VERIFIED: shared/game/tick.ts:42-44] `export function enterDayAnnounce(state) { return { ...state, day: (state.day ?? 0) + 1 }; }` 가 `hooksOf` 의 `dayAnnounce` 줄에만 걸려 있다(tick.ts:79). 확장판은 `dayAnnounce` 를 건너뛰므로 일차가 영원히 `undefined` 다. 권장: `errand` 진입 훅이 확장판에서 일차를 +1 한다(첫 저녁 = 1일차, 밤 1·아침 1·토론 1·처형 1이 같은 일차 — 기본판과 같은 번호 매김). `assignErrandFake` 가 `state.day ?? 1` 을 쓰고(`errandFake.ts`), `resolveNight`·`nightLog`·`voteLog` 가 `state.day ?? 1` 을 쓴다 — 모두 errand 진입 뒤에 불리므로 증가를 `enterErrand` 앞에 두면 일관하다. 일차 숫자는 `DayView.n`·`voteLog`·`nightLog`·`investigations[].n` 로 노출되므로 시험이 많다(`nyquist-03.1`·`nyquist-04` 가 일차를 단언).

### Pattern 3: 심부름 모듈 재사용 + `cut`

- [VERIFIED: shared/game/errand.ts `enterErrand`] 후보는 `mapOf(roomMapId(state)).places` 에서 오고 산 사람 seat 오름차순 부분 피셔–예이츠, 난수 호출 순서가 계약(시드 시험 고정). 가로등 후보를 맵 데이터에서 읽게 하려면 `MapDef` 에 장소 목록을 판 규칙으로 고르는 한 칸(예 `MapDef.lamps?`)을 더하거나 마을 `places` 자체를 가로등 8곳으로 바꾼다(Open Q 1). 마을 `places` 를 바꾸면 `test/worker/town*.test.ts`·`mapTown.test.ts`(장소 8곳 규칙)·`townErrand`·`townLeak` 이 같이 바뀐다.
- `actErrand(state, actorId, posFx)` 의 반환은 `{ ok:true, state } | { ok:false }` 이고 거절 사유를 가르지 않는다 [VERIFIED: errand.ts]. 긴 누르기 구분을 위해 호출 인자에 `hold: boolean` 하나를 더한다. 마피아 판정은 `errandFake.ts` 의 방식을 따라 **역할을 읽는 모듈 한 곳**에만 둔다(errand.ts 의 불변식 "이 파일은 역할을 읽지 않는다" 주석을 깨지 않도록 새 파일 `lamps.ts` 에서 `errandCut` 을 쓰고 errand.ts 는 키 이름만 다루는 현재 방식 유지).
- 처리는 `errandDone` 에 더하고, 마피아의 `hold` 이면 서버 전용 `Player.errandCut: PlaceId[]` 에 같은 id 를 더한다. 모든 경우 상태 변화 모양은 같다(응답·저장 횟수 동일). 시민의 `hold` 는 그냥 light 로 기록(UI-SPEC P21-7: "서버가 그냥 켜기로 기록").
- **마피아의 가짜 장소(`errandFake`)는 확장판 저녁에서 쓰지 않는 것을 권장**: D-06 이 마피아에게 `cut` 이라는 별도의 비밀 행동을 주므로 "3곳을 못 끝내 목격 기록을 못 받음" 장치가 겹친다. `assignErrandFake` 훅을 `rules.cause` 에서 빼면 마피아도 3곳을 끝내 목격 기록을 받는다(Open Q 3). 기본판엔 errand 자체가 없다.
- 꺼진 등불 집계(`houseLitOf`): 한 가로등 L 이 켜짐 ⇔ 누군가의 `errandDone` 에 있고 아무의 `errandCut` 에도 없음(**cut 이 이긴다** — Open Q 4 권장). 안 켠 등불은 꺼짐. 집 i 의 불 ⇔ 등불 i 의 켜짐(등불 8 ↔ 집 8 전단사, D-07). 집계는 `enterNight` 에서 한 번 하고 서버 상태에 저장(공개 키 `day.lamps: boolean[8]` 로만 노출).
- **저녁 도중 켜진 등불을 다른 사람에게 보이게 할지**: 지금 `applyErrand` 는 받아들이면 `sendViewTo([playerId])`(본인에게만)이고 이유는 타이밍 누설 방지다 [VERIFIED: worker/room.ts applyErrand 주석 "진행은 본인 view 에만 있어 다른 폰에 방송할 것이 없다"]. 전원에게 켜짐을 방송하면 쓰기·방송이 늘고(결정 0076 의 DO 쓰기 한도) "누군가 지금 행동했다" 타이밍이 샌다. 권장: 저녁에는 **내가 처리한 등불만** 내 화면에서 켜지고, 전원 공개 값은 밤 진입(`enterNight`) 뒤 `day.lamps` 로만 나온다.

### Pattern 4: 건너뛰기(저녁·아침)

`toggleEnd`/`endCountOf`/`endReached` 가 선례이다 [VERIFIED: shared/game/discussion.ts]: `Player.endVote?: true`, 공개 `day.endCount`(수만), `me.endDiscussion`(본인), 과반 `majorityOf(산 사람 수)` 이면 일찍 끝난다. 같은 모양으로 저녁·아침용을 만들거나 `endVote` 를 단계에 무관하게 일반화한다. 주의: `enterDiscussion` 이 `endVote` 를 지운다(discussion.ts) — 저녁·아침 건너뛰기 표는 **자기 단계 진입 훅이 지워야** 한다(안 지우면 저녁 표가 아침에 새어 아침이 즉시 끝난다). 과반 기준 vs "모두" 기준은 Open Q 5(UI-SPEC P21-13 은 "n/N" 공개, D-23 은 "모두 끝냈음을 누르면" 이라 전원 기준으로도 읽힌다).

### Pattern 5: 현장 단서 서버 모델

`enterMorning` 안(또는 새 훅)에서 `resolveNight` 직후, `nightPick` 을 지우기 **전** 상태로 만든다 [VERIFIED: night.ts `enterMorning` 주석 "풀은 nightPick 을 지우기 전의 players 로 만든다"]. 서버 전용 `RoomState.scene`(이름은 재량) 예:

```ts
interface SceneState {
  house: number;          // 피해자 또는 미수 집 seat (resolveNight 의 target; 없으면 scene 자체가 없음 → D-17)
  rescued: boolean;       // 의사가 막음 → 미수 현장 (공개 morning 은 { saved: true } 그대로)
  footprints: number;     // 그 집을 고른 산 사람 수(그 집 주인 본인 제외) — trace.ts traceCandidates 와 같은 풀
  cloth?: TracePiece;     // pickTracePiece 결과(풀이 비면 없음)
  window?: TracePiece | "dark";   // 이웃 집 불 켜짐 + 풀에서 ②와 다른 사람 우선
  touched: Record<"footprint"|"cloth"|"window", true>;   // 서버 전용: 마피아가 먼저 살핀 지점
}
// Player.sceneSeen?: Array<{ spot: SpotId; r: "clue"|"touched"|"dark"|"none"; v?: number|TracePiece }>  (서버 전용 개인 기록)
```

- 풀: [VERIFIED: shared/game/trace.ts `traceCandidates`] "밤 시작 때 산 사람 중 nightPick 이 피해자 seat 인 사람(피해자 본인 제외), seat 오름차순. 역할을 읽지 않는다." 발자국 수 = 이 풀의 길이(D-12 "본인 제외"). 옷 조각 ② = `pickTracePiece`(난수 `randInt(풀 크기)` 한 번). 창문 ③은 ②와 다른 사람을 우선 뽑는 두 번째 난수(풀이 1명이면 같은 조각) — **난수 호출 순서가 시드 시험을 고정하므로 새 분기 안에서만 호출을 늘린다**(bots.ts 머리 주석의 계약).
- 풀이 비는 경우(마피아 전원이 고른 피해자를 아무 비마피아도 안 고름 — 마피아 자신들이 고른 것은 풀에 들어간다). 마피아 팀이 확정 대상을 낸 밤에는 최소 산 마피아 수만큼 풀이 있으므로 정상 경로에서 비지 않는다. 그래도 방어적으로 `cloth` 없음 → "아무것도 없어요" 카드(UI-SPEC P21-12).
- 이웃(D-14 ③): 집은 모서리 쌍으로 붙어 있다. 중심 간격 4.8단위 쌍은 (0,7)·(1,2)·(3,4)·(5,6) 이다 [VERIFIED: shared/game/mapTown.ts:75-84 의 좌표 — 집0(−5.0,−8.4)·집7(−8.4,−5.0) 등, 0↔7 거리 √(3.4²+3.4²)=4.81; UI-SPEC "중심 간격 4.8단위" 와 일치]. 창문 단서가 "살피는 사람 기준"인지 "지점 기준(이웃 집 불 켜짐)"인지는 문서가 모호하다 — Open Q 7.
- **살피기(inspect)**: 단계 `morning` · 행위자 산 사람 · 위치가 그 지점 반경(`ERRAND_ACT_R` 1.2) 안 · 그 사람이 아직 안 살핀 지점 중 가장 가까운 하나. 거절은 `{ ok:false }` 하나(사유 구별 없음, L40). 마피아면 그 지점 `touched` 를 켜되 **자기 기록은 평범한 clue**. 응답·저장 횟수·타이밍은 역할과 무관하게 같아야 한다(저장은 `storage.put("room")` 한 번, 본인에게만 `sendViewTo`). `ERRAND_MIN_GAP_MS` 250ms 연타 방어를 같이 쓴다.
- 지점 좌표: 각 집의 문 앞 칸(`TOWN_HOUSES[i].front`)을 기준으로 UI-SPEC P21-9 가 정한 오프셋(문 중심에서 바깥 1.0~1.6, 옆 −1.0/0/+1.0)에 놓되 좌석 0·7 은 문 앞 칸이 모서리 쪽(문에서 약 1.3)이라 걷는 칸 안으로 당겨야 한다. **마스크 시험**(3곳 모두 걷는 칸·서로 ≥ 1.0)을 `mapTown.test.ts` 옆에 새로 둔다. 지점 좌표는 집 seat 별 고정 표(서버·화면이 같은 상수 import)이고 E2E 사본은 `e2eContract.test.ts` 가 대조한다(UI-SPEC "E2E 사본 상수").

### Pattern 6: 위치 — 집 앞 순간이동·아침 걷기·토론 모이기

- 밤 순간이동은 `HomeMemo`(`{ day, pos: Record<playerId,[x,z]> }`) 를 만들어 `teleportHome` 에 넘기는 기존 장치다 [VERIFIED: shared/game/world.ts `captureHome`·`teleportHome`]. 확장판은 `captureHomeNow`(토론 끝난 자리를 기억)를 쓰지 않고 **집 앞 좌표로 HomeMemo 를 직접 만든다**: `pos[player.id] = [TOWN_HOUSES[seat].front.x, .z]`(고정소수점 이미 `front` 가 ×100 정수). `teleportHome` 은 기록한 자리로 `restSegment` 를 만들고 `settleZones` 가 구역 기억을 알림 없이 맞춘다(기존 syncHome 이 이미 함께 부른다). `worker/room.ts captureHomeNow` 의 판단 조건 `room.phase === "errand"` 제외 목록에 확장판 분기를 더해야 한다 — 그대로면 밤 진입에서 errand 끝 자리가 home 으로 기억돼 집 앞이 아니다.
- 분필: `fillChalk` 는 피해자 `home.pos` 를 분필 좌표로 쓴다 [VERIFIED: worker/room.ts fillChalk — `memo ?? 구간 끝`]. HomeMemo 가 집 앞이면 분필이 저절로 집 앞에 놓인다. 구출·무효 밤에는 채우지 않는다(기존 결정 0044-22). 20페이즈 한계 P20-18(닫힌 방 안 분필)은 암살이 집 앞 바깥에서만 일어나므로 발생하지 않는다 — 추천을 따르면 이 페이즈에서 새로 할 일이 없고 문서(결정 기록)에 한 줄만 남긴다.
- 아침 걷기: `canMoveIn` 은 단계 id 와 생존만 본다 [VERIFIED: shared/game/movement.ts:32-37] `return phase === "dayAnnounce" || phase === "errand" || phase === "discussion";` — 확장판 morning 에서도 산 사람이 걸어야 하므로 규칙을 인자로 받게 한다(`GameMap.tsx:357` 이 같은 표를 클라이언트에서 부른다). 서버 측 권위는 `worker/room.ts` 의 `canMove(room, me)`(1962행) 이다.
- 아침의 world 프레임 수신자: `audience.ts` 의 world 는 `errand` 만 "본인 + 유령" 이고 `night` 는 빈 집합이며 그 밖(morning 포함)은 산 사람 전원이다 [VERIFIED: shared/game/audience.ts world 분기]. 새 아침에서 모두에게 걸음을 보내면 "누가 어느 지점을 먼저 살폈는지"가 눈에 보여 마피아가 **걷는 모습으로** 노출된다. 권장: 저녁과 같이 근처만(`nearSnapFrame` 재사용). 이 선택은 `worldVisibleTo`·`snapFrameFor`(room.ts:1467 의 `room.phase === "errand"` 조건)·`syncErrandView`/`syncErrandTransition`·`audience` 네 곳을 같이 건드린다 — 한 곳을 빠뜨리면 누설 전수 시험이 잡는다(Open Q 6).
- 토론 모이기: `layoutKey(state)` 가 단계별 배치 키를 돌려주고 `discussion` 은 `null`(아무것도 안 함)이다 [VERIFIED: shared/game/gather.ts layoutKey]. 확장판 discussion 에 `${day}:ring` 을 돌려주면 지목 단계의 같은 키와 만나 멱등이라 토론 때 선 둘레 자리가 지목에서도 이어진다. 토론 중 걷기를 허용할지(지금은 허용)와 "고정 카메라"(UI-SPEC 단계 표 5행 "광장 가운데 모임(고정, 기존)")는 서로 맞지 않는 표현이라 Open Q 8.

### Pattern 7: view 키와 누설 면(허용 목록 리터럴 원칙)

[VERIFIED: shared/game/view.ts] 모든 키는 허용 목록 리터럴로 만든다(`Player` 를 펼쳐 복사하지 않는다). 새 키 제안(이름은 재량, 게이트는 필수):

| 키 | 받는 사람 | 단계 | 비고 |
|----|-----------|------|------|
| `me.errand`(기존) | 산 본인 | errand | 가로등 id. 게이트 `rules.errand && state.phase === "errand"`(view.ts:285) 그대로 |
| `me.record`(기존) | 3곳 다 처리한 산 본인 | **discussion** | 게이트(view.ts:291-292)는 `errandPlaces`·`errandDone` 가 discussion 까지 남아 있어야 한다 → `enterNight` 가 지우는 줄(night.ts:49)을 확장판에서 건너뛰어야 한다(함정 2) |
| `day.lamps: boolean[8]` | 모두 | night·morning·discussion(…) | **공개**. 켜짐/꺼짐뿐. cut 과 안 켠 이유는 없음 |
| `day.scene: { house, spots }` | 모두 | morning | 공개 지점 위치/존재만(D-16 이 미수 집 공개를 인정). 발자국 수·옷·창문 값은 없음 |
| `me.scene: Array<{spot, state, v?}>` | 산 본인 | morning·discussion | 내가 살핀 지점과 받은 단서. `state` 값 집합이 모든 역할에서 같다(touched/dark/none 포함) |
| `me.skip?: true`·`day.skipCount` | 본인 / 모두 | errand·morning | `endDiscussion`·`endCount` 선례 |

서버 전용(어떤 view 에도 없음): `errandCut`, `scene.touched`, `scene.footprints`(수는 지점 ①을 살핀 사람만 받음, UI-SPEC P21-16), 낱개 clue 풀. 누설 시험이 키 집합을 "시민 view 와 마피아 view 가 같다"로 대조한다 — 새 키가 역할로 갈리면 안 된다.

**기존 공개 증거 폐지(UI-SPEC P21-15):** `day.evidence`·`morning.trace`/`seen`·`EVIDENCE_PHASES` 가 확장판에서 더 안 나가야 한다. `rules.trace`/`rules.witness` 를 확장판 true 로 두면 `enterMorning` 이 `pickTracePiece`·`errandLast` 로 공개 증거를 계속 만든다 [VERIFIED: night.ts:169-170]. 권장: 새 `rules.cause` 가 켜지면 공개 증거 경로를 건너뛰고 개인 `scene` 만 만든다(기존 `rules.trace`·`rules.witness` 의 뜻은 "기본판 꺼짐/구 확장판 켜짐" 그대로 둔다 — Open Q 2 의 시험 잠금과 맞물림).

### Pattern 8: 클라이언트 통합 지점

- **단계 표시·문구:** `hostKeyOf`·`HOST_LINES`·`callTargetsOf`(src/game/hostLine.ts)는 단계 id 만 본다. `errand` 문구("빛나는 곳을 찾아 처리해 주세요")를 확장판 문장으로, `morning` 의 빈 문장·`trace` 키를 새 `scene.*` 키로 바꾸려면 view.mode(`rulesetOf(modeOf(view))`)로 가른다 — 기본판 키·문장은 그대로여야 한다(UI-SPEC). HOST-05 시험이 "읽은 경로를 기록해 고정"하므로 새 읽기 경로(`view.mode`, `me.scene` 유무)는 허용 목록에 명시해야 시험이 통과한다.
- **조명·시간대:** [VERIFIED: src/world/presence.ts:147-151] `lightingFor` 가 밤에 `view.me.role === "mafia" ? "night" : "nightCitizen"` 을 쓰고, `visibleSeats` 가 `nightCitizen` 이면 남의 좌석을 그리지 않는다(87-90행). 이 페이즈의 밤은 모두 같은 개관 장면이므로 확장판 밤에서는 이 role 분기를 끈다(UI-SPEC "밤 조명 통일"). 같은 이유로 `nightDarkOf(view)`·`data-night-dark`·소리의 시각 큐 갈래(RoomScreen)도 확장판 밤에서 역할로 안 갈려야 한다. 또 `lightingOf(phase)`·`todOf(phase)` 는 `phase` 만 받아 `errand` 를 낮(`talk`)으로 본다 — 저녁 조명(해가 지는 노을)은 확장판 `errand` 에서 `vote`/dusk 류로 가야 하므로 `view.mode` 를 받는 시그니처가 필요하다(`PHASE_SCENE.errand: "day"` 배경 그림 표도 같다, scenes.ts).
- **카메라:** 현재 `CameraMode = { mode: "follow" } | { mode: "fixed"; target; zoom; zoomMs? }` [VERIFIED: presence.ts:20]. 방위 `CAM_YAW = π/4`, 거리 17, 높이 12.5 는 `camera.ts` 모듈 상수라 경사 시점이다. UI-SPEC P21-2 의 "거의 정사, 배율 ≈ 17.3 px/단위(= 일반 58.2 의 약 30%)" 는 `fixed` + `zoom 0.30` 으로 **배율만** 흉내 낼 수 있지만 경사 시점이라 집 간격이 세로로 압축된다(sin 35° ≈ 0.57). 문패 겹침 ≥ 44px 검사를 (폰 6종 × 띠 한 줄/두 줄)로 **먼저 계산**하고 필요하면 `overview` 용 기저를 `camera.ts` 에 따로 둔다 — `groundToScreen`·`screenRay` 가 모듈 상수 `RIGHT`·`UP`·`BACK` 을 쓰므로 모드별 기저로 일반화해야 하고 `threeCamera.ts`·`threeRenderer.ts` 가 같은 상수를 쓴다(`cameraThree.test.ts` 가 두 구현의 일치를 증명). 위험이 큰 항목이다(함정 9).
- **밤 누르기:** 현재 밤 고르기는 `FaceList`(얼굴 목록, GamePanel)이고 `callFaceSeats`·`onNightPickSent` 로 연결돼 있다. 확장판 밤은 `HouseTag`(DOM 문패 단추)가 `send({ t: "pick", target: seat })` 를 보낸다. 서버 쪽은 **마지막 선택이 이긴다** — [VERIFIED: night.ts:34-38] `if (actor.nightPick === target) return { ok: true, state };` 뒤에 `nightPick: target` 으로 덮는다(고른 뒤 바꿀 수 있음, UI-SPEC P21-5 확인 항목 해결). 자기 집·동료 집 선택도 받아들인다(응답 동일).
- **저녁 표지·[켜기]:** `ErrandMarker`·`ErrandAct`·`ErrandDots`·`ErrandStartCard`·`useErrandPos`·`placeCentersOf`·`actablePlaceOf`(errandView.ts)는 `PlaceId` 와 `mapOf(view.map).places` 를 읽는다(Open Q 1 과 직결). 빛남 규칙이 "다음 장소 하나" → "안 켠 배정 전부"로 바뀐다(P21-6, `callTargetsOf` 의 `kind:"place"` 가 단수라 복수 표현이 필요).
- **아침 지점 표지:** 같은 `ErrandMarker` 투영 규칙·방향 화살표 칩을 쓰는 `ClueSpot` — `WorldStage.tsx` 의 `ErrandLayerProps`(places 배열 + nextId + actId)에 지점 3곳을 같은 모양으로 먹이는 것이 최소 변경이다(`ErrandLayerProps.places: {id, x, z, done}`).
- **의심 보드:** `RecordCard` 껍데기(층·자리·열고 닫기 로직 `recordOpenKey` 등, GameMap.tsx 408-447)를 이어받는다. 단서 칩·얼굴 줄·등불 줄·목격 칸은 모두 view 값에서 파생(순수 함수는 `src/game/` 에 둔다 — `recordView.ts`·`traceMark.ts`·`traceText.ts` 가 선례). `sameOutfitSeats(view.players, piece)` 와 `TRACE_MARK` 로 닮은 옷 표시를 그린다 [VERIFIED: GameMap.tsx:497].
- **3D 가로등·창:** `town.ts` 는 `setOwners(seats)` 로 창 두 묶음(`winLit`·`winDark`)을 다시 만든다 [VERIFIED: town.ts:438-455]. `houseLit: boolean[8]` 를 받는 새 훅(예 `setHouseLit`)으로 바꾸거나 `setOwners` 의 입력 의미를 "켜진 집 좌석"으로 바꾼다. `TOWN_LIT.houseOwned` 열은 `night`·`morning` 단계에서 창 밝기를 정하는 값 — UI-SPEC 이 `houseLit` 열로 대체하라고 한다(20 의 팔레트 대조 시험 `palette.test.ts` 갱신). 새 점광원을 만들지 않는다(그리기 예산: 점광원 3, `renderer.calls ≤ 120`).

### Pattern 9: 튜토리얼

`src/game/tutorialScript.ts` 가 장면 표 한 곳(8장면·`TutorialSceneNo` 1~8)과 가짜 `RoomView` 를 쥔다 [VERIFIED: src/game/tutorialScript.ts 머리·타입]. UI-SPEC "튜토리얼 변경" 표가 장면별 변경을 이미 정했다(3 등불 켜기, 4 현장 조사, 5 의심 보드, 6 정체 비공개 카드, 7 카드 문구, 8 마무리 글). 필요한 것: `TutorialLineKey` 의 `tutorial.errand`·`tutorial.witness`·`tutorial.link` 문구 교체와 `tutorial.hidden` 키 추가, `TutorialEvidence`·`TutorialReveal`(정체 카드)·`TutorialRoleCards` 부품 수정. 서버를 안 읽는 규칙(TUT-05) 때문에 새 `SuspectBoard` 부품을 가짜 view 로 그릴 수 있어야 한다 — 부품이 `me.role` 이나 서버 훅을 직접 읽지 않아야 튜토리얼이 같은 부품을 쓴다.

### Anti-Patterns to Avoid

- **판 종류 분기를 화면 곳곳에 `view.mode === "extended"` 로 흩뿌리기:** `rulesetOf(modeOf(view))` 한 곳에서 규칙 객체를 얻어 읽는다(ruleset.ts 머리 주석이 이미 강제: "전역 규칙 상수는 없다").
- **`me.role` 로 화면을 갈라 누설을 "화면에서 숨기기":** CLAUDE.md 작업 규칙 위반. 새 부품(`HouseTag`·`ClueSpot`·`ClueCard`·`SuspectBoard`·`ErrandAct`·`hostLineOf` 분기)은 `me.role` 을 읽지 않는다.
- **새 단계 id 추가:** D-01 이 금지. `PhaseId`·`PHASE_DEFS`·`PHASE_SCENE`(Record<PhaseId,…>)·`TestTools` 이름표 등 컴파일이 따라오는 곳이 늘어난다.
- **서버 전용 값을 view 로 옮겨 "뷰 키 같음" 시험 통과시키기:** `cut`·`touched`·`footprints`(전체 수)는 서버에만.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 밤 선택 판정·마지막 선택이 이김 | 새 집 선택 메시지 | 기존 `pick { target }` + `pickTarget` | D-10. 판정·일지(경찰·의사·마피아 일지)가 이미 이 경로에 묶여 있음 |
| 등불 처리 반경·배정·근처 표본 | 새 처리 규칙 | `enterErrand`·`actErrand`·`sampleErrand`·`nearIdsOf`(구역 거르기 포함) | D-05·D-09. 근처·구역 규칙은 20페이즈가 시험으로 고정(`nearIdsOf` 시그니처) |
| 의상 → 조각 | 새 조각 표 | `TRACE_OF_OUTFIT`·`traceCandidates`·`pickTracePiece` | D-14 ②. 의상 id 는 싣지 않는 불변식 |
| 건너뛰기·토론 끝내기 수 | 새 투표 집계 | `toggleEnd`/`endCountOf`/`majorityOf` 의 모양 | 공개 값은 수뿐·키째 지우는 위생 선례 |
| 밤 순간이동·구역 기억 | 직접 `segs` 수정 | `teleportHome` + `settleZones` + `snapEachViewer` | 문 통과 가짜 프레임 방지(T-20-08) |
| 모이기 배치 | 새 둘레 자리 | `layoutFor`/`RING_SLOTS`/`assignSlots` | 멱등·퇴거 복원 이미 시험됨 |
| 결과 아이콘·조각 그림 | 새 SVG 손그림 | `PlaceArt`·`TraceArt`(생성물), `V2Icon` 새 4개는 UI-SPEC 경로 그대로 | 그림 교체 절차가 `scripts/make-placeart.mjs` 한 방향(생성물 직접 수정 금지) |
| 토큰·색 | 화면 CSS hex | `tokens.css` 변수 | `tokens:check`·`palette.test.ts` 가 대조 |
| 한 판 완주 누설 판정 | 시험마다 키 순회 | 기존 `errandLeak`·`townLeak`·`nightLeak` 의 `keyPaths`/`judge` 패턴 | 이미 월드 프레임 + 뷰 키 전수 판정 틀이 있음 |

**Key insight:** 이 도메인의 "복잡한 점"은 알고리즘이 아니라 **불변식(역할 누설 없음·순서 계약·시드 고정)** 이다. 새 기능은 모두 기존 불변식 지탱 모듈의 확장으로 넣어야 시험 자산이 그대로 보호를 준다.

## Runtime State Inventory

이 페이즈는 이름 변경·마이그레이션이 아니다. 다만 **저장된 방 상태의 호환**이 한 가지 있다: 서버 상태 필드를 늘리고(`errandCut`·`scene`·`sceneSeen`·`day.lamps` 의 근거 값) 단계 순서를 바꾸므로, 배포 시점에 진행 중인 확장판 방이 있으면 옛 순서 상태가 새 규칙을 만난다. [VERIFIED: shared/game/room.ts:486·581] 에 `isLegacyDay` 처럼 옛 저장 방을 정규화하는 선례가 있다. 모든 새 필드는 optional 로 두고(읽는 쪽이 기본값) 진행 중이던 방은 방 만료(`ROOM_TTL_MS` 3시간)로 자연 소멸하도록 둔다 — 별도 데이터 마이그레이션 작업은 필요 없다고 판단한다 `[ASSUMED]`.

## Common Pitfalls

### Pitfall 1: 시험 이전 폭발 (가장 큰 비용)
**What goes wrong:** 기본 판 종류가 확장판(`DEFAULT_MODE = "extended"`, [VERIFIED: shared/protocol.ts:514])이고 시험 헬퍼는 모드를 지정하지 않으므로, 확장판 흐름을 바꾸는 순간 `dayAnnounce → errand → discussion → … → night → morning → dayAnnounce` 를 가정한 시험이 한꺼번에 깨진다(`grep -rl dayAnnounce test` = 81, 심부름 단계 직접 사용 40). 대표: `test/unit/{phases,tick,nyquist-03.1,nyquist-04,errand*,view*,hostLine}.test.ts`, `test/worker/{errand,errandLeak,trace,basicDay,modeBasic,nightCatchup,town*}.test.ts`, `test/client/{gameMap,phaseScreens,roomScreen,…}.test.tsx`, E2E 계약 `test/unit/e2eContract.test.ts`, 스크립트 `scripts/smoke.mjs`·`scripts/uat-test-room.mjs` 의 단계 그래프(`roleReveal: ["dayAnnounce"], dayAnnounce: ["errand"], …`).
**Why it happens:** 19페이즈가 판 규칙을 `rulesetOf(modeOf(state))` 로 만들었지만 시험의 기본 모드가 확장판이라 "옛 확장판"이 곧 시험의 기본 세계다.
**How to avoid:** (a) 새 규칙 플래그로 새 흐름을 가르고 시험 setup 이 플래그를 끈 채 시작(맵 잠금 `lockModeMaps`/`openTown` 의 선례, [VERIFIED: test/helpers/playable.ts]), 새 흐름 시험은 `openCause()` 같은 도우미로 그 시험 동안만 켜기; 마지막 계획에서 잠금을 걷고 남은 옛 흐름 시험을 기본판(`mode: "basic"`)이나 새 흐름으로 옮긴다. (b) 또는 한 번에 이전. 선택은 Open Q 2. **어느 쪽이든 "시험 이전" 을 별도 계획(들)으로 잡아야 한다** — 서버 계획 안에 묻으면 검증 게이트가 열리지 않는다.
**Warning signs:** `npm test` 에서 수십 개 파일이 같은 단계 순서 단언으로 실패. 플래그 기본값을 true 로 바꾼 커밋 하나에서 대량 적색.

### Pitfall 2: `enterNight` 가 심부름 키를 지워 토론 목격 기록이 사라짐
**What goes wrong:** [VERIFIED: night.ts:44-50] `enterNight` 가 `errandPlaces`·`errandDone`·`errandNear`·`errandSeen`·`errandFake` 를 키째 지운다("토론 때 쓴다"는 주석이 옛 순서 전제). 새 순서는 errand → night → morning → discussion 이라 discussion 에서 `me.record` 게이트(view.ts:291-292: `errandPlaces` 존재·`errandDone.length >= errandPlaces.length`)가 거짓이 된다.
**How to avoid:** 확장판은 `enterNight` 에서 지우지 않고 **다음 `enterErrand`(이미 지움, errand.ts)** 에서 지우거나 `enterDiscussion` 말미에서 `errandSeen` 을 보관 후 지운다. `errandLast` 는 새 흐름에서 쓰이지 않는다(공개 마지막 목격 폐지) — `sampleErrand` 가 계속 만들면 DO 저장만 늘므로 확장판에서 건너뛴다(저장 비교키 `errandMarks`, worker/room.ts 마지막 줄 참고).

### Pitfall 3: 일차가 오르지 않음 (Pattern 2)
`day` 가 `undefined` 인 채 `?? 1` 로 모든 일이 1일차가 되고 `voteLog` 가 매일 같은 `n` 으로 쌓인다. `routeAfterExecution`/`buildSummary`/시상(`awards.ts`)이 일차에 의존.

### Pitfall 4: 같은 응답 모양 — 마피아가 "먼저 손댄" 지점
**What goes wrong:** 살피기 응답이 마피아와 시민에서 (1) 저장 횟수 (2) 응답 프레임 수 (3) 지연 (4) 본인 view 의 키 집합 중 하나라도 다르면 오라클이 된다. 특히 "touched 로 바뀐 순간 저장 쓰기가 한 번 더" 같은 구현 습관.
**How to avoid:** 처리 본체가 모든 경우에 정확히 한 번 `storage.put("room")` 하고 `sendViewTo([actor])` 한 번. touched 를 켜는 일은 같은 상태 객체에 같은 쓰기에 실린다. 시험: 마피아·시민 두 소켓의 프레임 수열(키 목록)이 같음을 대조(`errandLeak.test.ts` 선례).

### Pitfall 5: 저녁 도중 공개 값이 늘어 타이밍이 샘
등불 켜짐을 전원에게 방송하면 "누군가 지금 행동했다" 타이밍 + DO 쓰기 증가(결정 0076). 전원 공개는 밤 진입 이후로 미룬다(Pattern 3).

### Pitfall 6: 밤 조명·장면이 `me.role` 로 갈림
[VERIFIED: presence.ts:87,150] 확장판 밤에서 마피아는 `night`, 비마피아는 `nightCitizen`(거의 깜깜, 남의 좌석 생략). 개관 장면은 모두 같아야 한다. 영향: `lightingFor`·`visibleSeats`·`nightDarkOf`(src/game/nightDark.ts)·`data-night-dark`·`RoomScreen` 의 소리 갈래·`TOWN_LIT.nightCitizen` 열. 기본판 밤은 그대로(판 규칙으로 가름).

### Pitfall 7: `canMoveIn`·`audience`·`snapFrameFor`·`hostChimeOf` 가 판 규칙을 모름
단계 id 만 보는 표라 확장판 morning 걷기/가시성/알림음이 틀린다. `hostChimeOf` 는 `prev === "dayAnnounce" && (cur === "discussion" || cur === "errand")` 같은 쌍 규칙을 갖는다(hostLine.ts) — 새 쌍(`execution → errand` 는 울리지 않음, UI-SPEC "알림음")을 반영해야 한다.

### Pitfall 8: 가로등 후보·좌표
`TOWN_PLACES` 는 "서로 2.0 이상(시험이 지킨다)" 이고 방 안 4곳이 들어 있다 [VERIFIED: mapTown.ts TOWN_PLACES 주석]. 새 가로등 8곳은 광장 둘레 반경 4~5, 서로 ≥ 2.0, **걷는 칸 중심**, 등불 i ↔ 집 i 가 "각 집에 가장 가까운 등불" 전단사여야 한다(D-07). 광장에 이미 가로등 기둥 장애물 4개(PLAZA_OBSTACLES 의 `circle r 0.08 (3.8,−2.4)` 등)와 시계탑(−4.3,−4.3, 2.6×2.6)이 있어 좌표가 충돌한다. 장애물을 더하면 `TOWN_MASK`(48×48) 를 `MAP_PRINT=1 npx vitest run test/unit/mapTown.test.ts -t 래스터화` 로 다시 만들어야 하고 걷는 칸 943 고정 시험이 바뀐다 — 가로등을 **장식**(마스크에 안 닿는 3D 소품, "얇은 장식이라 넣지 않는다" 선례)으로 두고 처리 위치만 걷는 칸 중심으로 정하는 편이 마스크를 안 건드린다.

### Pitfall 9: 개관 카메라 문패 겹침
인접 집 중심 4.8단위 → 배율 17.3 px/단위면 정사 가정에서 약 83px(UI-SPEC). 경사 시점에서는 세로가 압축된다. 폰 6종 × 띠 한 줄/두 줄에서 문패 중심 거리 ≥ 44 와 "스테이지 안쪽 8 inset·독 줄 밖"을 **구현 전에 계산하는 단위 시험**(`camera.test.ts` 확장)으로 먼저 고정한다. 알려진 한계로 360×560 은 위쪽이 비좁다(UI Considerations).

### Pitfall 10: `PLACE_IDS` 사본이 여러 곳
protocol.ts(원천) · `scripts/e2e/lib.mjs:3579 ERRAND_PLACE_IDS` · `scripts/smoke.mjs:140 PLACE_IDS` · `placeText.ts PLACE_NAME: Record<PlaceId,…>` · `placeArt.tsx`(생성물 `Record<PlaceId, ArtEntry>`) · `test/unit/e2eContract.test.ts`(대조). id 를 늘리면 이 전부가 따라와야 하고 생성물은 생성기(`scripts/make-placeart.mjs`)를 고쳐야 한다. `placeart:check` 가 `npm run typecheck` 에 묶여 있다 [VERIFIED: package.json typecheck 스크립트].

### Pitfall 11: `noExecutionOf` 가 `night` 에서만 값을 줌
[VERIFIED: execution.ts:36] `if (state.phase !== "night") return undefined;` — 새 흐름에서 처형이 안 이뤄지면 다음 단계는 `errand` 라 "처형이 성립하지 않아 밤으로 온" 이유 코드(`day.noExecution`, 큰 글)가 저녁에 떠야 한다. 파생 단계를 `errand`(확장판)로 넓히거나 UI 가 어디서 알릴지 정해야 한다.

### Pitfall 12: 봇·테스트 도구
`worker/room.ts` 봇 계획은 `errandGo`/`errandAct` 로 가짜 장소를 마지막에 미루는 로직(errandFake)과 맵 `places` 를 안다. 가로등 흐름에서 봇은 가로등을 처리하고(선택적으로 cut 없음), 아침 현장은 봇이 안 살펴도 타이머로 지나가므로 필수 아님. `skipPhase`(testTools.ts) 는 night 에서만 `botsPickNow` 를 먼저 한다 — 새 단계에서 testSkip 이 올바로 넘기는지 시험한다. 소켓 봇 `scripts/bots.mjs` 는 errand 에서 행동 없이 기다린다.

## Code Examples

### 단계 분기 도우미(제안 모양)

```ts
// shared/game/phases.ts — Source: 기존 nextPhaseOf(phases.ts:102) 확장 제안
export function nextPhaseOf(phase: PhaseId, rules: Ruleset): PhaseId | null {
  if (rules.cause) {
    switch (phase) {
      case "roleReveal": return "errand";
      case "errand": return "night";
      case "morning": return "discussion";   // 현장 없음(D-17)은 morning 길이 0 으로 즉시 통과
      case "execution": return "errand";
      default: return PHASE_DEFS[phase].next;
    }
  }
  if (phase === "dayAnnounce") return rules.errand ? "errand" : "discussion";
  return PHASE_DEFS[phase].next;
}
/** 처형 없이 하루가 끝났을 때의 다음 단계(nomination·runoff·showdown 훅의 리터럴 "night" 자리). */
export const afterDayOf = (rules: Ruleset): PhaseId => (rules.cause ? "errand" : "night");
```

### 꺼진 등불·집 불 켜짐 집계(제안 모양, 순수)

```ts
// shared/game/lamps.ts — 역할을 읽지 않는다(errandCut 키 이름만). cut 이 이긴다(Open Q 4 권장).
export function houseLitOf(players: readonly Player[], lampIds: readonly PlaceId[]): boolean[] {
  const done = new Set(players.flatMap((p) => p.errandDone ?? []));
  const cut = new Set(players.flatMap((p) => p.errandCut ?? []));
  return lampIds.map((id) => done.has(id) && !cut.has(id)); // lampIds[i] ↔ 집 i (D-07 고정 표)
}
```

### 누설 시험의 틀(기존 패턴 인용)

[VERIFIED: test/worker/townLeak.test.ts 머리] "산 사람 소켓이 그 동안 받은 모든 world 프레임에서 남의 좌표가 받는 사람 구역 안인지 한 곳(judge)에서 판정", 프레임은 처음부터 끝까지 모으고 개수는 "있다"로만 단언, 실패 출력은 한 줄(TAP)이라 문자열 비교. 새 시험은 이 틀에 ① 저녁 `hold` 응답 프레임 수열 동일 ② 마피아·시민 view 키 집합 동일(저녁·밤·아침·토론) ③ 살피기 응답(마피아가 먼저 만진 지점 포함) 동일 ④ view 어디에도 `errandCut`·`touched` 같은 서버 전용 이름·역할 값 없음 ⑤ 아침 world 프레임 수신자 집합 검사를 더한다.

## State of the Art

해당 없음 — 외부 라이브러리·표준 변화와 무관한 자체 규칙 확장이다. 내부 변화 기록만 남긴다.

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 하루: dayAnnounce → errand → discussion … night → morning | 확장판: 저녁→밤→아침→토론 | 이 페이즈(결정 0081-2) | 시험·스크립트·화면 표 전반 |
| 밤: 얼굴 목록(`FaceList`) | 확장판: 지도의 집 문패(`HouseTag`) | 이 페이즈(D-10) | 화면만 — 서버 메시지 불변 |
| 아침 공개 증거 카드(`EvidenceCard`) | 개인 단서(`ClueCard`) | 이 페이즈(P21-15) | `rules.trace`·`day.evidence` 확장판 경로 폐지 |

**Deprecated/outdated (확장판 한정):** 공개 흔적 카드·마지막 목격 공개·[기록] 단추 단독·`errandFake`(Open Q 3)·`FaceList` 밤 선택. 기본판은 해당 규칙이 없거나 그대로다.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 새 흐름 플래그 이름·구조(`Ruleset.cause`)와 시험 잠금 방식 | Summary·Pitfall 1 | 시험 이전 비용·계획 분할이 달라짐. 사용자 영향은 없음 |
| A2 | 저녁 도중 켜진 등불을 전원에게 방송하지 않고 밤 진입 뒤 공개 | Pattern 3 | UI-SPEC P21-8("모든 사람이 같은 가로등 8곳을 본다")과 달리 저녁에 남의 켠 등불이 안 보임 — 사용자가 "저녁에도 남이 켠 등불이 보이길" 원하면 방송·쓰기 비용이 늘어남 |
| A3 | 등불 상태: cut 이 이김(한 명이라도 자르면 꺼짐) | Pattern 3 | 반대(마지막 행동이 이김·켠 사람이 이김)이면 마피아의 영향력이 달라짐 |
| A4 | 마피아의 `errandFake` 를 확장판에서 쓰지 않음 | Pattern 3 | 마피아가 목격 기록을 받게 되는 밸런스 변화 |
| A5 | 아침 world 프레임을 근처 사람에게만(저녁과 같은 규칙) | Pattern 6 | 전원에게 보내면 걷는 모습으로 마피아 노출 위험 |
| A6 | 일차 증가를 `errand` 진입 훅에 둠 | Pattern 2 | `dayAnnounce` 증가를 대신 살리려면 확장판에서도 dayAnnounce 길이 0 단계를 둬야 함(D-01·02 위반) |
| A7 | 진행 중이던 방의 데이터 마이그레이션이 필요 없다(방 만료로 소멸) | Runtime State Inventory | 배포 시점에 진행 중인 확장판 방이 깨질 수 있음 — 배포 시각 조율 또는 정규화 한 줄 |
| A8 | 개관 카메라를 `fixed`+낮은 zoom 으로 먼저 계산해 보고 문패 겹침이 안 되면 새 기저 | Pattern 8·Pitfall 9 | 카메라 작업 크기가 한 계획에서 두 계획으로 늘 수 있음 |

## Open Questions

1. **가로등 `PlaceId` 8개를 어떻게 더할까** (UI-SPEC 확인 목록이 계획에 맡김)
   - What we know: `PLACE_IDS` 16개 닫힌 집합에 `lamp` 가 하나뿐 [VERIFIED: protocol.ts:37-41]. 사본 5곳(Pitfall 10). 마을 `places` 는 방 안 4 + 광장 4.
   - What's unclear: 새 id(`lamp1`~`lamp8`)냐 기존 id 슬롯 재사용이냐.
   - Recommendation: **새 id 8개** + `placeLabel`·`PlaceArt` 에 "가로등 별칭" 한 줄(`PLACE_NAME` 모두 "가로등", `PLACE_ART` 는 `lamp` 별칭) + 생성기 템플릿이 별칭 타입을 내도록 수정(`BaseArtId`). 컴파일러가 누락을 잡는다. 재사용안은 id 의미가 어긋나 읽기·시험 이름이 헷갈린다. 마을 `places` 대신 `MapDef.lamps` 로 두면 기존 마을 시험(방 안 심부름 장소)이 안 깨진다.

2. **새 규칙 플래그와 시험 이전 방식**
   - Recommendation: `Ruleset` 에 확장판 true 플래그 하나 + 시험 setup 이 `lockModeMaps` 와 같은 모양으로 기본 꺼짐 + 새 시험만 켬. 훅 표(`HOOKS` 가 모듈 로드 때 `rulesetOf(mode)` 로 만들어짐)가 로드 시점 캐시라 잠금은 **tick 모듈이 import 되기 전**(setup 파일)에 걸어야 하거나 `HOOKS` 를 지연 계산으로 바꿔야 한다 — 이 점을 계획이 확인한다.

3. **마피아 가짜 장소(`errandFake`)와 `cut` 의 관계**
   - Recommendation: 확장판에서는 가짜 장소를 쓰지 않고 `cut` 이 대체(Pattern 3, A4). 목격 기록을 마피아도 받게 됨을 사용자에게 알린다.

4. **등불 상태 규칙**(켠 사람과 자른 사람이 같은 등불을 배정받으면?)
   - Recommendation: cut 이 이김(A3). 한 줄 상수/함수로 두어 바꾸기 쉽게.

5. **[건너뛰기] 기준**(과반 vs 전원)
   - What we know: D-23 "모두 끝냈음을 누르면"; UI-SPEC "n/N" 공개; 토론 끝내기는 과반 `majorityOf`.
   - Recommendation: 토론 끝내기와 같은 과반 규칙(코드 재사용·마피아 한 명이 늘 막지 못함). 사용자가 "전원"을 원하면 `endReached` 대응 한 줄만 바꿈.

6. **아침에 남의 위치를 어디까지**
   - Recommendation: 저녁과 같이 근처(+같은 구역) 사람만(A5). 영향 범위(audience·worldVisibleTo·snapFrameFor·syncErrandView/Transition)를 한 계획으로 묶는다.

7. **창문 단서 ③의 기준**
   - What we know: ROADMAP 3 "켜진 등불 곁 이웃에게만 창문 목격 하나", D-14 ③ "불이 켜진 창을 가진 이웃만 … 받는다", UI-SPEC P21-10 은 지점 상태 `어두워서 못 봄`(③만) 이 "이웃 집 불 켜짐 여부"와 일치한다고 적음(지점 기준).
   - What's unclear: 살피는 사람이 "이웃"이어야 하는지(내 집이 피해자 집의 짝집?) vs 누구든 그 지점을 살피면 같은 결과(지점 기준).
   - Recommendation: **지점 기준**(이웃 집 `houseLit` 한 값으로 ③ 결과가 정해짐, 살피는 사람 누구든 같음). 구현이 단순하고 누설 면이 없음. 사용자가 "내 집이 이웃일 때만"을 원하면 `inspect` 판정에 한 조건 추가.

8. **토론 중 걷기·카메라**(UI-SPEC 표 5행의 "고정, 기존"이 모순)
   - What we know: 지금 `discussion` 은 `canMoveIn` 허용 + `cameraModeOf` 따라가기. D-18 은 "모두 광장 가운데로 모이고 토론".
   - Recommendation: 토론 시작 때 둘레 자리로 gather(서버 강제 이동)하고 이후 걷기는 지금처럼 허용·카메라는 따라가기(변경 최소). 모이기 전 걷는 시간이 토론에 쓰이니 `layoutKey` 가 discussion 에 `${day}:ring` 을 주는 한 줄이면 된다. 사용자가 걷기 금지를 원하면 `canMoveIn` 한 줄.

9. **`rules.trace`/`rules.witness` 의 이후 의미**(UI-SPEC 확인 목록)
   - Recommendation: Pattern 7 — 새 플래그가 켜지면 공개 증거 경로를 건너뜀. 기본판은 어차피 꺼짐.

10. **한 판 길이** — 저녁 40 + 밤 30 + 아침 30 + 토론 90 + 처형 구간 합은 이전보다 길다. 단계 길이는 `phases.ts` 상수 한 곳이라 실테스트 후 수정(고정 제한 아님, CLAUDE.md). 계획은 상수만 두고 조정하지 않는다.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js (≥ 22.12) | 모든 시험·typecheck·E2E | ✗ (이 연구 셸의 PATH 에서 `node` 를 찾지 못함 — Git Bash 와 PowerShell 모두 "인식되지 않음") | — | 실행 PC(사용자의 Mac/집 Windows)에서 확인. `package.json` 의 `engines.node` 가 `>=22.12` [VERIFIED: package.json] |
| node_modules (vitest·tsc·wrangler) | `npm test`·`npm run typecheck` | ✓ (`node_modules/.bin/{vitest,tsc,wrangler}` 존재) | vitest 4.1.12 | — |
| workerd(@cloudflare/vitest-plugin) | `worker` 프로젝트 시험 | 미확인(Node 부재로 실행 못 함) | — | 실행 PC 에서 `npm test -- --project worker` |
| 시스템 Chrome | E2E(`scripts/e2e/run.mjs`) | 미확인 | — | 실행 PC |

이 연구에서는 시험·빌드를 **실행하지 못했다**(Node 부재). 아래 명령은 `package.json`·`vitest.config.ts`·20-10-SUMMARY 에서 읽은 것이고 [VERIFIED: 파일 읽기] 실행 결과는 [ASSUMED] 다.

**Missing dependencies with no fallback:** 이 셸에서는 Node. (계획·실행 PC 에서는 존재한다고 가정.)

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.12(세 프로젝트: `unit`=node, `client`=happy-dom, `worker`=@cloudflare/vitest-plugin) + `node --test`(스크립트 순수 도우미) + playwright-core E2E |
| Config file | `vitest.config.ts`, `test/unit/setup.ts`·`test/worker/setup.ts`(맵 잠금 `lockModeMaps`) |
| Quick run command | `npx vitest run --project unit test/unit/<file>.test.ts` (client: `--project client test/client/<file>.test.tsx`, worker: `--project worker test/worker/<file>.test.ts`) |
| Full suite command | `npm test`(= `vitest run`) · `npm run typecheck` · `node --test scripts/*.test.mjs scripts/e2e/*.test.mjs` [VERIFIED: package.json scripts, 20-10-SUMMARY 의 로컬 전체 검증 목록] |
| E2E | `npm run e2e -- --url http://localhost:5173 --only <흐름 부분문자열>` (`npm run dev` 후). 인자 없으면 배포본 검사 [VERIFIED: HANDOFF.md 도구 메모] |
| 규모 참고 | 직전 페이즈 기준 npm test 8,569개·node --test 689개 [VERIFIED: 20-10-SUMMARY.md:41] |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DAYFLOW-01 | 확장판 단계 사슬·분기(동률→errand, 처형→errand, morning→discussion, 현장 없음 건너뜀), 기본판 사슬 불변, 승패 ended | unit | `npx vitest run --project unit test/unit/dayFlow.test.ts test/unit/phases.test.ts test/unit/tick.test.ts` | ❌ Wave 0 (`dayFlow.test.ts` 신규; phases/tick 은 있음·수정) |
| DAYFLOW-01 | 일차 증가·기록(`voteLog`·`nightLog`) 날짜 일관 | unit | `npx vitest run --project unit test/unit/nyquist-04-multiday-flow.test.ts` | ✅ (확장판 흐름용으로 이전 필요) |
| LAMP-01 | 가로등 배정 3곳·같은 목록·처리 반경·근처 표본 | unit | `npx vitest run --project unit test/unit/errand.test.ts test/unit/lamps.test.ts` | ✅ errand / ❌ `lamps.test.ts` 신규 |
| LAMP-02 | `cut` 서버 전용, 꺼진 등불 집계(cut 이 이김), 등불↔집 전단사·최근접, 아침 공개 값에 이유 없음 | unit | `npx vitest run --project unit test/unit/lamps.test.ts test/unit/mapTown.test.ts` | ❌ / ✅ |
| LAMP-01·02 | 마피아·시민 `hold` 응답 동일(프레임 수열·저장 횟수) | worker | `npx vitest run --project worker test/worker/lampLeak.test.ts` | ❌ Wave 0 |
| HOUSE-01 | 밤 `pick` 마지막 선택이 이김·자기 집 허용·응답 동일, 집 앞 순간이동 HomeMemo | unit+worker | `npx vitest run --project unit test/unit/night.test.ts` · `--project worker test/worker/night.test.ts test/worker/town.test.ts` | ✅ (확장) |
| HOUSE-02 | `houseLit` 3D·DOM 점이 같은 view 값, 밤 조명이 역할로 안 갈림 | unit+client | `npx vitest run --project unit test/unit/lighting.test.ts test/unit/townScene.test.ts` · `--project client test/client/nightMap.test.tsx` | ✅ (확장) |
| SCENE-01 | 발자국 수(풀 길이)·옷 조각·창문(이웃 불)·살피기 1회·반경·구출/미수 현장·현장 없음 | unit | `npx vitest run --project unit test/unit/scene.test.ts` | ❌ Wave 0 |
| SCENE-02 | 마피아가 먼저 만지면 touched, 뒤 사람은 "먼저 손댄 흔적", 마피아 본인은 clue | unit | 동 `scene.test.ts` | ❌ Wave 0 |
| SCENE-01·02 | 살피기 응답 모양 동일(마피아·시민), 지점 좌표 마스크(걷는 칸·좌석 0·7) | worker+unit | `--project worker test/worker/sceneLeak.test.ts` · `--project unit test/unit/mapTown.test.ts` | ❌ / ✅ |
| BOARD-01 | 보드 값 파생(칩·얼굴 줄·닮은 옷·등불 줄·목격 칸), 토론 gather(`layoutKey`), 정체 비공개 | unit+client | `--project unit test/unit/gather.test.ts test/unit/recordView.test.ts`(신규 이름 재량) · `--project client test/client/suspectBoard.test.tsx` | ✅ gather / ❌ 보드 신규 |
| SKIP-01 | 건너뛰기 수 공개·키째 지움·과반 | unit | `npx vitest run --project unit test/unit/skip.test.ts` | ❌ Wave 0 |
| LEAK-02 | 새 단계 × 5 역할 view 키 집합·world 프레임·서버 전용 이름 누설 전수 | worker | `npx vitest run --project worker test/worker/leak.test.ts test/worker/errandLeak.test.ts test/worker/townLeak.test.ts test/worker/nightLeak.test.ts` | ✅ (확장) |
| TUT-06 | 튜토리얼 대본·가짜 view·"정체는 판이 끝나야 알아요", 서버 0 | unit+client | `--project unit test/unit/tutorialScript.test.ts` · `--project client test/client/tutorialScenes.test.tsx test/client/tutorialScreen.test.tsx` | ✅ (수정) |
| 전 구간 | 계약 사본(E2E 상수·PLACE_IDS·가로등 좌표·`ERRAND_*`) | unit | `npx vitest run --project unit test/unit/e2eContract.test.ts` | ✅ (확장) |
| 전 구간 | 타입·토큰·placeart 생성물 | static | `npm run typecheck`(= tokens:check + placeart:check + tsc 앱·워커) | ✅ |
| LH1~LH12 | E2E 저녁/밤/아침/보드/건너뛰기/기본판 불변/튜토리얼/폰 6종/성능 | e2e | `npm run e2e -- --url http://localhost:5173 --only lamp` (새 흐름 이름 재량) + `node --test scripts/e2e/lib.test.mjs` | ❌ Wave 0 |
| 성능 | 마을 nightload(개관 카메라·가로등 빛 무리 쿼드 포함) | perf | `node scripts/perf-run.mjs --mode nightload --map town` | ✅ (UI-SPEC LH12 문턱 그대로) |

### Sampling Rate
- **Per task commit:** 바뀐 파일의 `npx vitest run --project <p> <file>` + 변경이 `shared/` 를 건드리면 `npm run typecheck`.
- **Per wave merge:** `npm test`(전체) + `node --test scripts/*.test.mjs scripts/e2e/*.test.mjs` + `npm run typecheck`.
- **Phase gate:** 전체 green + 폰 6종 E2E(바뀐 흐름은 매 계획, 전 흐름 회귀는 페이즈 끝 한 번, 묶음 10분 이하 — 20-10-SUMMARY 교훈) + 배포 후 `npm run smoke`/`e2e`(배포본) → `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] `test/unit/dayFlow.test.ts` — DAYFLOW-01 단계 사슬·분기·일차(확장판/기본판 두 규칙을 `rulesetOf` 로 둘 다)
- [ ] `test/unit/lamps.test.ts` — 등불↔집 전단사·최근접·`houseLitOf`(cut 이 이김)
- [ ] `test/unit/scene.test.ts` — 현장 단서·흐려짐·구출/현장 없음·살피기 1회
- [ ] `test/unit/skip.test.ts` — 건너뛰기
- [ ] `test/worker/lampLeak.test.ts`·`sceneLeak.test.ts` — 응답 동일·누설
- [ ] `test/client/{houseTag,clueSpot,clueCard,suspectBoard}.test.tsx` — 신규 부품(역할 읽기 0·접근성 이름·`data-*` 표식)
- [ ] 시험 잠금·켜기 도우미(Open Q 2) — `test/helpers/playable.ts` 옆에 `openCause()`/`lockCause()` 와 setup 연결
- [ ] E2E 새 흐름 파일(`scripts/e2e/lamp.mjs` 등) + `lib.mjs` 판정 순수 함수 + `lib.test.mjs`
- [ ] 개관 카메라 문패 겹침 계산 시험(`camera.test.ts` 확장) — 구현 전에 값 고정
- [ ] 위 `Pitfall 1` 의 이전 대상 시험 목록 인벤토리(계획이 파일별로 고칠지/잠글지 표로 확정)

## Security Domain

`security_enforcement` 가 켜져 있음(`.planning/config.json`: `security_enforcement: true`, `security_asvs_level: 1`).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | 아니오(변경 없음) | 기존 토큰·`hello` 흐름 |
| V3 Session Management | 아니오 | 기존 소켓 첨부 `playerId` |
| V4 Access Control | **예** | 모든 새 행동의 행위자는 소켓 첨부 `playerId` 뿐(메시지에 seat·id 없음). 단계·생존·반경 검사는 서버. 역할 분기는 서버 전용 모듈 한 곳 |
| V5 Input Validation | **예** | `shared/schemas.ts` 의 `z.strictObject`(덧붙은 키 거부). 새 메시지 `inspect`·`skip`·`errand.hold` 필드는 불리언·필드 없음 수준 |
| V6 Cryptography | 아니오 | — |
| V8/V13 정보 노출(누설) | **예(핵심)** | 허용 목록 리터럴 view, 누설 전수 시험, 거절 응답 무차별(L40), 서버 전용 이름 금지 키 검사 |

### Known Threat Patterns for 이 스택(DO + WebSocket)

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| 응답 모양·타이밍으로 마피아 식별(긴 누르기·살피기) | Information Disclosure | 모든 역할이 같은 상태 변경·저장 1회·본인 view 1프레임. 거절도 같은 응답. 시험: 프레임 수열·키 집합 대조 |
| 클라이언트 DOM·`data-*`·접근성 이름으로 역할 노출 | Information Disclosure | 새 부품이 `me.role` 을 읽지 않음 + E2E LH2/LH4 가 DOM 구조 동일을 대조 |
| 남의 걷기·위치로 현장 선점자 추적 | Information Disclosure | 아침 world 프레임 근처·같은 구역만(Open Q 6), 누설 전수 시험 확장 |
| 연타로 DO 쓰기 폭주(무료 한도 10만 행/일, 결정 0076) | Denial of Service | `ERRAND_MIN_GAP_MS` 250ms 간격 재사용, 새 행동(`inspect`·`skip`)도 같은 간격, 저녁 공개 방송 금지(Pattern 3) |
| 모르는 키·크기 초과 메시지 | Tampering | `strictObject`·`MAX_FRAME_BYTES`(1024) |
| 사용자 닉네임을 보드·문패에 그림 | XSS(Tampering) | React 텍스트 노드만, `innerHTML` 금지(UI-SPEC 스타일 규칙), 8자 닉네임 말줄임 없는 한 줄 |
| 발자국 수의 공개 범위 혼동(D-12 공개 vs D-14 나만) | Information Disclosure(의도적) | P21-16: 지점 ①을 살핀 사람만 수를 봄. 아침 발표·띠·헤더에 수를 싣지 않음 |
| D-16 미수 집 공개(의사가 지킨 집이 드러남) | Information Disclosure(의도적) | 결정 0081-3 의 균형으로 승인됨. 정체(직업)는 공개하지 않음 — 시험이 직업 키 부재를 대조 |

## Project Constraints (from CLAUDE.md)

- 게임 규칙·판정은 서버(방 DO)가 정한다. 클라이언트는 받은 상태를 보여 주고 행동만 보낸다(결정 0002).
- 다른 사람의 역할은 서버가 살아 있는 사람에게 보내지 않는다(탈락자 관전만 예외, 결정 0021). 화면에서 숨기는 것으로 대신하지 않는다.
- **화면은 글을 최소로, 보고 누르는 조작 중심(결정 0051, 가장 중요한 UI 지침)** — 읽을 글은 단계 이름과 한 줄 이하(3초 규칙), 행동은 대상을 직접 누르게.
- 기획·계획은 참여 플레이어의 몰입을 기준으로, 각 페이즈는 자기 구간의 이펙트·액션을 기본형으로 함께 만든다(결정 0006).
- 새 결정은 `docs/decisions/` 다음 번호(0088)로 추가. 작업을 마칠 때마다 `HANDOFF.md` 갱신·push. 브랜치 `v3`.
- GSD 산출물·응답은 한국어(코드·명령·파일명·요구사항 ID 는 원문). 작은 MVP·이른 배포(`minifia-v3`)·디자인 먼저(시안 사본 `design/v3.0/lamp-house/`)·화면 페이즈는 UI-SPEC 먼저(완료·승인됨).
- 문서 갱신 대상: `docs/screen-map.md`(확장판 하루 흐름 절·표식 표), `docs/decisions/0088-…`(UI-SPEC 확인 목록의 결정), `docs/decisions-summary-v2.0.md` 는 v2.0 용이라 이 페이즈에서 건드리지 않는다.
- `design-refs` 스킬: 환경 스킬 목록에 없어(`gsd-addons:design-refs` 이 이 연구 환경에 정의돼 있지 않음) 건너뜀. UI-SPEC 이 같은 일(참고 자료 경로 기록)을 이미 수행했다.

## Sources

### Primary (HIGH confidence — 이 세션에서 Read/grep 로 직접 확인)
- `shared/game/phases.ts`(단계 표·`nextPhaseOf`·상수)·`ruleset.ts`·`mode.ts`·`tick.ts`(훅 표·루프)·`errand.ts`·`errandFake.ts`·`trace.ts`·`night.ts`·`discussion.ts`·`endgame.ts`·`execution.ts`·`gather.ts`·`mapTown.ts`·`zones.ts`·`movement.ts`·`audience.ts`·`view.ts`·`world.ts`(captureHome/teleportHome)·`maps.ts`
- `shared/protocol.ts`(PhaseId·PLACE_IDS·MorningView·MyInfo·ClientMessage)·`shared/schemas.ts`
- `worker/room.ts`(handleErrand/applyErrand·afterTransition·syncHome·captureHomeNow·snapFrameFor·fillChalk·봇 실행)
- `src/game/hostLine.ts`·`errandView.ts`·`placeText.ts`·`tutorialScript.ts`·`scenes.ts`·`timeOfDay.ts`, `src/world/camera.ts`·`presence.ts`·`maps/town.ts`·`maps/types.ts`, `src/screens/GameMap.tsx`, `src/components/v2/placeArt.tsx`
- `test/unit/setup.ts`·`test/worker/setup.ts`·`test/helpers/playable.ts`·`vitest.config.ts`·`package.json`·`.planning/config.json`
- `scripts/smoke.mjs`·`scripts/uat-test-room.mjs`·`scripts/e2e/{run,errand,flows}.mjs`·`scripts/make-placeart.mjs`
- `docs/decisions/0081-*.md`·`0087-*.md`, `HANDOFF.md`, `.planning/STATE.md`, `.planning/ROADMAP.md`(Phase 21), `.planning/REQUIREMENTS.md`, `21-CONTEXT.md`, `21-UI-SPEC.md`, `design/v3.0/lamp-house/README.md`

### Secondary (MEDIUM)
- `.planning/phases/20-map-expansion/20-VERIFICATION.md`·`20-10-SUMMARY.md`(알려진 한계·시험 규모)

### Tertiary (LOW)
- 없음(외부 웹 조사를 하지 않았다 — 외부 라이브러리가 없는 페이즈).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 새 의존성 없음, `package.json` 직접 확인.
- Architecture: HIGH — 단계 훅·뷰·월드 프레임 구조를 코드에서 확인. 통합 지점 파일·줄을 인용.
- Pitfalls: HIGH(시험 이전·키 삭제·일차·조명 role 분기는 코드 근거) / MEDIUM(개관 카메라 겹침 수치, 가로등 좌표 충돌은 계산 전).
- 규칙 해석(창문 단서·cut 규칙·건너뛰기 기준): MEDIUM — Open Questions 와 Assumptions 에 기록.
- 실행 검증: 시험·빌드를 이 환경에서 돌리지 못함(Node 부재) — 명령은 파일에서 읽은 것.

**Research date:** 2026-11-14
**Valid until:** 코드 변경이 이 브랜치(`v3`)에 쌓이는 동안만 유효 — 다른 페이즈가 `phases.ts`·`view.ts`·`worker/room.ts` 를 건드리면 재확인(약 7일).
