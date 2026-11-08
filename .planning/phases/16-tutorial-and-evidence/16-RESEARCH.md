# Phase 16: 단추 정리·심부름 증거 - Research

**Researched:** 2026-11-08
**Domain:** React 19 + Vite 클라이언트(단추·심부름 화면·SVG 에셋) + Cloudflare Durable Object 서버 규칙(마피아 가짜 장소·마지막 목격·아침 증거 view). 새 외부 패키지 없음.
**Confidence:** HIGH (대부분 이 세션에서 소스를 직접 읽어 확인). 게임 설계 해석 두 곳은 `[ASSUMED]`(Assumptions Log A1·A2).

> **범위(결정 0078)**: 튜토리얼은 17페이즈로 이관됐다. 이 문서는 ROADMAP Phase 16 성공 기준 **SC-1~4**만 다룬다. CONTEXT 의 D-02~D-04, UI-SPEC 의 "튜토리얼 계약"·V-8~V-18·UI Considerations #5~#11·연습/기다림 문구·방장 스위치 줄(+56)은 16 에서 **구현하지 않는다**(방장 대기실 패널은 250/306 그대로, 대기실에 [튜토리얼] 없음). 17 이 서버에서 필요로 할 것은 맨 끝 "17 로 넘김" 절에만 적었다.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- D-01 이름표 삭제: 아이콘 단추 아래 한 단어 이름표(`data-tool-label`)를 모두 없앤다. `aria-label` 은 남긴다. 0073 의 자막 띠·빛남은 그대로 둔다.
- D-05 단추 배치: 머리에는 나가기·공유만 둔다. 소리·맵(방장)·봇(방장)·옷장은 오른쪽 세로 한 줄에 같은 크기 원으로 둔다. 자막 띠 주변은 비운다. 시안 2A 를 따른다.
- D-06 심부름 화면: 시작할 때 "오늘 심부름" 카드(장소 그림)를 띄운다. 맵에서는 해야 할 장소에 빛을 주고, 가장 가까운 장소에 방향 화살표를 둔다. 장소에 닿으면 그 자리에 [처리]가 나온다.
- D-07 컬러 에셋: 장소 16개와 흔적 조각 9개를 시안 A(도톰한 고유색 그림, `Main.dc.html`)로 바꾼다. B(색 동전)는 쓰지 않는다. 그림은 다시 그리지 않고 옮긴다.
- D-08 마피아 가짜 장소: 마피아는 처리되지 않는 가짜 장소 하나를 받는다. 목록의 모양과 개수는 시민과 같다. 화면·네트워크 모양에서 역할이 드러나지 않는다.
- D-09 아침 흔적이 나오면 그 흔적과 같은 옷을 입은 사람을 표시한다. 흔적은 지금처럼 그 밤 피해자를 고른 사람의 옷에서 나온다.
- D-10 아침에 피해자를 마지막으로 근처에서 본 사람을 공개한다.
- D-11 사회자 문구를 근거를 가리키는 말로 바꾼다(예: "같은 옷, 엇갈린 목격").
- D-12 규칙은 서버가 정한다(0002). 다른 사람의 역할은 보내지 않는다(0021) — 누설 검사를 새 메시지·단계·view 필드까지 넓힌다. 글은 최소로(0051). `RULESET` 에 새 스위치 없음. 감정표현은 몸동작만. 햅틱·진동 없음. 낮에도 명도·채도를 낮게.
- (17로 이동, 구현 금지) D-02·D-03·D-04 튜토리얼.

### Claude's Discretion (이 문서가 추천안으로 확정)
- UI-SPEC "기본값 기록" V-1~V-32 를 따른다(튜토리얼 V-8~V-18 제외).
- 가짜 장소의 서버 규칙(15 D-04 와의 맞물림, 엇갈림이 드러나는 방식, 봇 마피아) → 아래 "확정한 재량 항목" R-1.
- 마지막 목격자 판정 기준·장소 id 동봉 여부 → R-2.
- 같은 옷 판정: 클라이언트가 이미 공개된 의상으로 계산(V-29), 서버가 따로 계산해야 하는지 → R-3.

### Deferred Ideas (OUT OF SCOPE)
- 마피아의 심부름 방해 행동, 시상에 목격 반영 — Future(0074).
- 실기기·팀 확인은 v3.0 실테스트에서 한 번에.
- 범위 밖: 정통 판 장치, 새 맵, 새 소리 레시피(V-31), 연습 진행의 영구 저장, 앱 전용 기능, 튜토리얼 전부(17).
</user_constraints>

## Summary

16 은 크게 둘이다. (a) **클라이언트 정리**: `data-tool-label`·`.mv-tool__label`·`.mf-mapchip__label`·`.mv-float__label`·`.mv-sound__label` 이름표를 모두 걷고, 머리 단추(44 정사각)·오른쪽 세로 한 줄(52 원)·입력줄(48 원)로 모으고, 심부름 화면을 시작 카드·64 컬러 타일·방향 화살표·타일 위 [처리]·진행 점으로 바꾸고, 인라인 SVG 25개를 JSX 표로 옮긴다. (b) **서버 규칙 세 가지**: 마피아 가짜 장소, 마지막 목격자, 아침 증거를 낮 끝까지 싣는 view 필드. 새 `PhaseId`·새 클라이언트 메시지는 **없다**(튜토리얼이 빠지면서 컴파일 연쇄가 사라졌다).

가장 중요한 발견 다섯 가지: ① `errand.ts` 는 `.role` 을 읽지 않는 것이 15 의 증명 장치이므로 가짜 장소 배정은 **별도 모듈**에서 한다(난수 호출 순서도 안 건드린다). ② 아침 흔적 표시는 UI-SPEC 대로면 "낮이 끝날 때까지" 유지돼야 하는데 현재 `day.morning` 은 morning 단계에만 실린다 → **새 공개 필드 `day.evidence`** 가 필요하다. ③ 마지막 목격 자료인 `errandSeen`·`errandNear` 는 `enterNight` 가 지우고 줄에 시각이 없다 → **방 상태에 `errandLast`**(피해자별 마지막 관찰자)를 따로 쌓아 `enterMorning` 이 쓴다. ④ 같은 옷 표시는 `view.players[].look` + `TRACE_OF_OUTFIT` 역표로 클라이언트가 계산 가능(서버 계산 불필요). ⑤ 이름표 삭제의 영향은 src 보다 **E2E 스크립트·테스트 11개**가 훨씬 크다(`TOOL_ROW_EXTRA` 는 src 에 없고 `scripts/e2e` 에만 있다).

**Primary recommendation:** 서버 3건(가짜 장소·`errandLast`·`day.evidence`)을 먼저 세로로 끝내고(순수 모듈 + 누설 시험), 클라이언트는 "단추 정리 → 컬러 에셋 → 심부름 화면 → 증거 표시" 순으로 쪼갠다. 에셋 25개는 스크립트로 기계 변환한다.

## Phase Requirements (제안 — REQUIREMENTS.md 에 추가할 ID)

<phase_requirements>
| ID | Description | Research Support |
|----|-------------|------------------|
| TOOL-04 | 아이콘 단추 아래 글 이름표가 어느 화면에도 없고(`data-tool-label` 0건), 모든 아이콘 단추에 비어 있지 않은 접근성 이름이 있다(TOOL-01 을 대체) | 이름표 삭제 지도(Pitfall 1·테스트 표) |
| BTN-01 | 머리에는 정사각 44 단추만(대기실 나가기·공유 / 게임 기록·내 역할), 입력줄 단추는 48 원 | V-1·V-6, ToolButton·ChatPanel |
| BTN-02 | 소리·맵(방장)·봇(방장)·옷장이 오른쪽 세로 한 줄 52 원이고 자막 띠 주변은 비어 있다. 손님에게는 맵·봇 없음 | V-2~V-5, SideColumn |
| ERRAND-06 | 심부름 시작 2초 카드가 내 장소 3곳을 컬러 그림으로 보여 준다 | V-19 |
| ERRAND-07 | 해야 할 장소 64 타일 + 가장 가까운 곳 빛·방향 화살표 + 닿으면 장소 위 [처리] + 진행 점 3(독 삭제) | V-20~V-24 |
| ASSET-01 | 장소 16·흔적 조각 9 아이콘이 승인 컬러 에셋 A 이고(다시 그리지 않고 이식) id·aria-label 이 1:1 이다 | 에셋 변환 절 |
| ERRAND-08 | 마피아가 받는 목록에 처리되지 않는 장소 1곳이 있고, 마크업·네트워크 모양·응답이 시민과 같다 | R-1 |
| EVID-01 | 아침 흔적과 같은 옷을 입은 산 사람의 이름표에 표시가 붙고 낮 끝까지 유지된다 | R-3, `day.evidence` |
| EVID-02 | 피해자를 마지막으로 근처에서 본 사람(+장소)이 모두에게 공개된다 | R-2 |
| EVID-03 | 사회자 문구가 근거를 가리킨다(`trace`·`discussion.evidence`) | UI-SPEC 문구 표 |
| DEPLOY-04 | 누설 검사를 새 view 필드까지 넓힌 채 v3 에 배포(DEPLOY-03 과 같은 방식) | 누설 시험 목록 |

매핑: SC-1 → TOOL-04 · SC-2 → BTN-01·02 · SC-3 → ERRAND-06·07·ASSET-01 · SC-4 → ERRAND-08·EVID-01~03. (ID 접두는 기존 FLOW/HOST/TOOL/ERRAND/TRACE/DEPLOY 에 이어 붙였다.)
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 가짜 장소 배정·[처리] 무변화 응답 | API/Backend (방 DO 규칙 모듈) | — | 규칙은 서버(0002). 클라이언트는 목록 3곳만 받고 가짜 여부를 모른다 |
| 마지막 목격자 계산 | API/Backend (`sampleErrand` 표본) | — | 위치는 서버만 안다(근처 비공개, D-02) |
| 증거(흔적+목격) 공개 | API/Backend (`buildView`) | Browser | 모두에게 같은 공개 값. 낮 끝까지 view 가 싣는다(재접속 안전) |
| 같은 옷 판정·표시 | Browser (공개 look + 조각→옷 표) | — | 새 서버 값 없음, 이미 공개된 데이터의 함수 |
| 이름표 삭제·단추 열·입력줄 | Browser (React + CSS) | — | 순수 표시 |
| 심부름 타일·화살표·[처리] 위치 | Browser (`WorldStage` 투영 층) | — | 맵 투영은 클라이언트가 안다. 처리 판정은 서버 |
| 컬러 에셋 | Browser (JSX 표) + 저장소 사본 | — | 정적 에셋 |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react / react-dom | 19.3.1 | UI | 기존 스택 `[VERIFIED: package.json:21-22]` |
| zod | 4.6.7 | 메시지 스키마(`strictObject`) | 이 페이즈는 새 메시지가 없어 스키마 변경 없음 `[VERIFIED: package.json]` |
| vitest | 4.1.12 | 시험(unit·client·worker 프로젝트) | `[VERIFIED: vitest.config.ts]` |
| playwright-core | 1.64.1 | E2E(`scripts/e2e`) | 기존 |

설치할 패키지 없음. SVG 변환은 Node 내장(정규식·`fs`)만 쓴다.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SVGR 등 변환 패키지 | 일회성 Node 스크립트로 `placeArt.tsx` 생성 | 25개·태그 4종(circle/ellipse/path/rect)뿐이라 패키지가 과하다. 새 의존성 = 공급망 위험 |
| `day.morning` 을 낮 내내 싣기 | 새 `day.evidence` | 기존 시험이 "morning 단계에서만"을 고정한다. 새 키가 회귀 범위를 줄인다 |

## Package Legitimacy Audit

이 페이즈는 외부 패키지를 설치하지 않는다 → 감사 대상 없음. **Packages removed [SLOP]: none. Flagged [SUS]: none.** (`npm install` 금지; 에셋 변환은 `node` 내장만.)

## Architecture Patterns

### 데이터 흐름

```
[errand 40s]  sampleErrand(1s 표본) ──> player.errandNear/Seen (본인 기록, 3/3 만 me.record)
      │                          └──> state.errandLast[B] = 가장 가까운 관찰자 A + B 곁 장소  (신규, 서버 전용)
      ▼
[night] enterNight: errandPlaces/Done/Near/Seen/Fake 삭제, errandLast 는 남김
      ▼
[morning] enterMorning: 피해자 있으면  morning.trace(기존) + morning.seen = errandLast[피해자]  → errandLast 삭제
      ▼
buildDay: morning..execution 단계에서 day.evidence = { trace?, seen? }  (공개, 역할 없음)
      ▼
Client: evidence.trace → TRACE_OF_OUTFIT 역표 → players[].look 와 비교 → 이름표 thread 표시 / evidence.seen.seat → eye 표시 / EvidenceCard
enterNight: state.morning 삭제 → evidence 소멸(표시 끝)
```
마피아 가짜 장소: `ON_ENTER.errand = enterErrand → assignErrandFake`, `actErrand` 가 가짜를 후보에서 뺀다 → 보낸 사람에게 기존 거절과 같은 "state 한 프레임".

### 확정한 재량 항목

**R-1 마피아 가짜 장소 `[ASSUMED 해석 — A1]`**
- *배정*: 신규 `shared/game/errandFake.ts` 의 `assignErrandFake(state)` 가 산 마피아의 `errandPlaces` 중 하나를 `Player.errandFake`(서버 전용)에 쓴다. 고르는 법은 **난수 없이** `places[(seat + (day ?? 1)) % places.length]`. 이유: `errand.ts` 는 역할을 읽지 않는 것이 15 의 증명이고(15-01 SUMMARY "errand.ts 의 `.role` 0"), `enterErrand` 의 난수 호출 순서(seat 오름차순 × k, `errand.ts:55-58` 주석)와 봇 시드 고정 값(`bots.test.ts` 디지스트)을 건드리지 않는다. `tick.ts` 의 `errand: enterErrand` 한 줄을 `(s, r, at) => assignErrandFake(enterErrand(s, r, at))` 로 감싼다.
- *처리*: `actErrand` 후보 순회에서 `id === actor.errandFake` 를 `continue`(이 줄은 역할이 아니라 `errandFake` 키만 읽는다). 가짜 근처에서 누르면 후보 없음 → 기존 `{ ok: false }` 와 **같은 경로**, 워커 `applyErrand` 는 이미 거절 시 `sendViewTo([playerId])` 한 프레임만 보낸다(`worker/room.ts:713-731`). 새 오류 프레임·방송 없음. `enterErrand`(재배정) 와 `enterNight`(`night.ts:46` 구조분해 목록)에 `errandFake` 를 지우는 키를 더한다.
- *15 D-04 와의 맞물림*: 기록 조건 `done.length >= places.length`(`view.ts:266-272`)는 **고치지 않는다**. 마피아는 3/3 이 불가능하므로 `me.record` 를 영영 못 받는다 = "마피아도 같은 규칙"이 그대로 성립하고, 규칙의 결과로 마피아만 기록이 없다. 시민도 시간 부족으로 기록이 없을 수 있어 "기록 없음"이 곧 마피아 증거는 아니다.
- *엇갈림이 드러나는 방식*: **새 네트워크 필드 없음.** 목록은 각자 비공개라 "그 장소가 남의 가짜임"은 아무도 알 수 없고 알 필요도 없다. 엇갈림의 실체는 정보 비대칭이다 — 기록을 받는 쪽은 시민뿐이라 마피아가 "내가 본 건…"을 말하려면 지어내야 하고, 지어낸 목격("C 를 시계탑에서 봤다")은 C 본인의 기억·진짜 목격자 기록과 어긋난다(D-11 문구 "엇갈린 목격"이 가리키는 것). 공개 증거 두 개(같은 옷 표시·마지막 목격)가 어긋남을 검증할 기준점이 된다. 기록 줄에 "처리했는가" 비트를 싣는 안은 타이밍 잡음이 크고 새 누설 표면이라 **채택하지 않는다**(Open Question 1).
- *봇 마피아*: `bots.ts` 변경 없음. `errandGo` 는 미완료 장소(가짜 포함)로 걷고 `errandAct` 는 가짜에서 조용히 실패 → 2/3 에서 멈추고 시민 봇은 3/3. **`test/worker/errand.test.ts:125-133`("봇 전원 3/3 · 처리 목록이 배정 목록과 같음")을 "마피아 봇은 가짜 1곳 제외 2/3, 나머지 3/3" 로 고쳐야 한다**(4인 이상이면 마피아가 항상 있다).
- *화면*: 마피아 화면은 시민과 같은 마크업. [처리] 알약이 가짜 곁에서 켜진 채 눌러도 안 차는 것은 마피아 자신만 본다(V-25 가 설명 문구를 금지). 시험: 마피아·시민 `me.errand` 프레임 키 집합·길이 동일, 가짜 [처리] 응답 프레임 == 반경 밖 [처리] 응답 프레임, `SERVER_ONLY_NEW` 에 `errandFake`·`errandLast` 추가.

**R-2 마지막 목격자 `[ASSUMED 해석 — A2]`**
- *정의*: 피해자가 나온 날 **그 낮의 심부름 단계**에서, 마지막으로 피해자가 반경(`ERRAND_NEAR_R` = 3.0) 안에 있었던 표본 틱에서 **피해자에게 가장 가까운 다른 산 사람**(거리 같으면 낮은 좌석). 밤 위치는 쓰지 않는다 — 밤에는 각자 집 자리에 한 칸씩이라 "근처"가 없다(`view.ts`·`audience.ts` 밤 규칙). 관찰자가 3/3 을 마쳤는지·역할은 보지 않는다.
- *자료*: `errandSeen` 은 줄에 시각이 없고 첫 진입만 기록하며 `RECORD_MAX` 로 잘리고 `enterNight`(`night.ts:46`)가 지운다 → 못 쓴다. `sampleErrand`(`errand.ts:157-178`)가 이미 틱마다 위치를 가지므로 같은 곳에서 `state.errandLast?: Array<{ seat; by; place }>`(피해자 후보 좌석별 최신 한 줄)를 갱신한다. 장소는 `nearestPlaceId(map, B 위치)`. `enterErrand` 가 비우고, `enterNight` 는 **지우지 않으며**, `enterMorning` 이 `errandLast` 에서 피해자 줄을 꺼내 `morning.seen = { seat: by, place }` 로 옮긴 뒤 지운다. 피해자가 없거나 줄이 없으면 `seen` 키 없음(= 화면 "0").
- *장소 id 동봉*: **예.** V-30 의 장소 칸을 그대로 쓰고, 값은 닫힌 집합 `PlaceId` 하나뿐(좌표·역할 없음)이라 누설 표면이 늘지 않는다.
- *저장 비용(결정 0076)*: `errandLast` 가 바뀔 때만 저장되게 `errandMarks`(`worker/room.ts:1954-1955`의 JSON 문자열)에 포함한다. 같은 관찰자·같은 장소면 값이 같아 쓰기가 늘지 않는다(근처가 바뀔 때 이미 저장되는 빈도와 같은 규모).
- *프로토콜*: `MorningView.seen?: { seat: number; place: PlaceId }` (`protocol.ts:77-81`). 관찰자가 이미 처형돼 죽었어도 값은 유효(공개 사실).

**R-3 같은 옷 판정**: 서버가 새로 계산하지 않는다. 클라이언트가 `view.players[].look ?? "coat"`(공개, `view.ts:211-212`, 기본 `DEFAULT_LOOK`)와 `TRACE_OF_OUTFIT`(`trace.ts:16-26`)의 역표를 쓴다. `TRACE_OF_OUTFIT` 은 이미 `shared/game/trace.ts` 에 export 돼 있어 클라이언트가 import 한다(역표는 `Object.entries` 한 줄). **`__mfLooks` 는 쓰지 않는다**(E2E 훅이고, 3D 쪽 look 사본이라 유령 안개와 별개 — `testHooks.ts:40`). 의상은 `setLook` 이 lobby·ended 에서만 바꾸므로(`look.ts:25`) 판 중 변하지 않는다. 같은 의상을 여러 명이 입을 수 있어 표시는 여러 명일 수 있다(의도).

**R-4 낮 끝까지 유지 = 서버 `day.evidence`**: `buildDay` 는 `day.morning` 을 morning 단계에서만 만든다(`view.ts:131`). `state.morning` 은 `enterNight` 만 지운다(`night.ts:41`, 다른 곳에서 지우는 줄 없음을 grep 으로 확인). 따라서 `buildDay` 에 "단계 ∈ {morning, dayAnnounce, errand, discussion, nomination, runoff, showdown, defense, verdict, execution} 이고 `state.morning` 에 `trace` 또는 `seen` 이 있으면 `day.evidence = { trace?, seen? }`(필드별 복사)"를 더한다. `day.morning` 은 건드리지 않는다. 클라이언트 새 코드는 `day.evidence` 만 읽는다. (클라이언트 상태로만 들면 새로고침·재접속에서 표시가 사라진다.)

### 권장 구조
```
shared/game/errandFake.ts          # 신규 순수 모듈(역할을 읽는 유일한 심부름 모듈)
shared/game/errand.ts              # actErrand 가짜 제외, sampleErrand 가 errandLast 갱신
shared/game/night.ts               # enterNight 키 삭제 목록 + enterMorning seen
shared/protocol.ts · view.ts       # MorningView.seen, DayView.evidence
src/components/v2/placeArt.tsx     # 생성물(PLACE_ART·TRACE_ART)
src/components/v2/SideColumn.tsx   # 오른쪽 열
src/components/v2/{ErrandStartCard,ErrandAct,ErrandDots,ErrandArrow→글리프}.tsx , EvidenceCard.tsx
design/v3.0/assets/{id}.svg        # 원본 사본 25개
scripts/make-placeart.mjs          # 변환 스크립트(재실행 가능, --check 로 사본·JSX 일치 검사)
```

### Pattern: 에셋 변환 `[VERIFIED: 이 세션 스크립트 실행]`
`Main.dc.html` 에서 `<svg … aria-label="…">…</svg>` 25개가 정규식으로 잡힌다(본문 합계 6,086자). 본문 태그는 `circle ellipse path rect`, 속성은 `cx cy d fill height opacity r rx ry stroke stroke-width width x y` 뿐이다. 루트는 `viewBox="0 0 48 48"`, `stroke="#1a1420" stroke-width="2"`, 일부에 `stroke-linejoin`·`stroke-linecap`. 변환 규칙: ① aria-label → id(장소는 `PLACE_NAME`, 조각은 `TRACE_TEXT` 의 낱말과 역매핑 — 25개 모두 두 표와 일치 `[VERIFIED: placeText.ts:6-23, traceText.ts:5-15, Main.dc.html aria-label 목록]`) ② 하이픈 속성 → camelCase(`strokeWidth`, `strokeLinejoin`, `strokeLinecap`) ③ 루트 `width/height` 는 `size` prop 으로 대체, `role="img" aria-label` 은 단독 의미일 때만(장식이면 `aria-hidden`) ④ 정적 JSX 로 커밋(런타임 파싱·`dangerouslySetInnerHTML` 금지). 사본 `design/v3.0/assets/{id}.svg` 도 같은 스크립트가 쓴다. `V2Icon.tsx` 의 `place*` 16개(`V2Icon.tsx:148-232`)는 삭제하고, `placeIconOf` 사용처는 `RecordCard.tsx:36`·`ErrandMarker.tsx:40` 두 곳과 `test/unit/errandView.test.ts:17,40` 뿐이다(`thread` 는 이름표 표시용으로 남긴다).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 가짜 장소 난수 | 새 `randInt` 호출 | `(seat + day) % 3` 결정 규칙 | 호출 순서 계약·봇 시드 고정 값 보존 |
| 같은 옷 서버 계산 | 새 view 필드 | `TRACE_OF_OUTFIT` 역표 + `players[].look` | 이미 공개된 값의 함수 |
| 마지막 목격 | `errandSeen` 재해석 | `sampleErrand` 안 `errandLast` | `errandSeen` 은 시각 없음·상한·밤에 삭제 |
| 에셋 변환 | SVGR·직접 손으로 25개 | 일회성 Node 스크립트 + `--check` | 기계적·재현 가능 |
| 가짜 응답 | 전용 오류 프레임 | 기존 거절 경로(`sendViewTo` 한 프레임) | 응답이 역할 오라클이 되지 않게(D-08) |
| 맵 투영 위치 | 새 좌표 계산 | `WorldStage` errand 층(`ErrandLayerProps`, `WorldStage.tsx:62-70`) | 이미 투영·가림 규칙이 있음 |

## Common Pitfalls

1. **이름표 삭제 범위를 src 만으로 센다.** `TOOL_ROW_EXTRA` 는 src 에 없고(grep 0건) `scripts/e2e/{lib,result}.mjs` 와 그 시험(`lib.test.mjs`·`result.test.mjs`)에 있다. 이름표 높이는 CSS(`.mv-tool`)가 키웠고 `useMapInsets` 는 패널을 **재서** 쓰므로(`useMapInsets.ts` 측정 effect) 코드 상수 수정은 필요 없다. 뒤집을 곳 — src: `ToolButton.tsx`(`word` 삭제·`name` 필수)·`Button.tsx:14,31,48`·`Sheet.tsx:231`·`RoleCardButton.tsx:19`·`SoundButton.tsx:53`·`MapChip.tsx:31`·`FloatAction.tsx:52`·`ChatPanel.tsx:422,434-447,486-515`·`DressSheet.tsx:74,86`·`WillSheet.tsx:108`·`RecordCard.tsx:26`·`ResultPanel.tsx:195`·`Lobby.tsx`·`ResultScreen.tsx`·`v2.css` `.mv-tool__label`·`.mv-float__label`·`.mf-mapchip__label`·`.mv-sound__label`. 탭(`ResultPanel`·`DressSheet` 탭 2)은 글을 **유지**하고 `data-tool-label` 속성만 지운다(V-7). 시험 — client: `toolLabels`·`gameMap`·`lobby`·`mapChip`·`recordTrace`·`resultPanel`·`resultScreen`·`roleCardFlow`·`soundButton`·`v2parts`·`verdictScreen`(`.tsx`), unit: `e2eContract.test.ts`; E2E: `browser.mjs:1801-1833`(라벨 프로브)·`flows.mjs:571-584`(CP1 패널 높이식)·`host.mjs:98,251,269,312,325`(`[data-tool-label="닫기"|"옷장"|"넘기기"]` 셀렉터 → `aria-label`)·`lib.mjs:284,308,1981,2023,2737-2854`(TL1·TL2·`HOST_MARKERS` 의 `data-tool-label`)·`result.mjs:47,119,235`.
2. **입력줄 유언 단추가 UI-SPEC 에 없다.** `ChatPanel.tsx:502-515` 에는 [동작]·[보내기] 말고 유언 단추가 있다. V-6 은 둘만 적었다 → 유언도 48 원·이름표 없음으로 같게 처리하고 계획에 명시.
3. **[테스트] 버튼(`mf-lobby__test`)과 소리 잠금 알약.** 테스트 방 방장의 [테스트] 는 왼쪽 위(`lobby.css:25`)이고 UI-SPEC 이 안 다룬다 → **그 자리 그대로** 두고 맵 칩만 열로 옮긴다. `SoundButton` 의 locked 알약("소리 켜기" 폭 112, 8초)은 글 단추라 유지하되 열의 첫 칸이 일시적으로 넓어진다 — 오른쪽 정렬로 열이 안 흔들리게 한다(`SoundButton.tsx` PILL_FOLD_MS).
4. **심부름에서 아래 패널을 없애면 `useMapInsets` 가 죽는다.** 훅은 `panel === null` 이면 측정을 건너뛴다(`useMapInsets.ts` effect 첫 줄). V-23 은 패널 자체를 없앤다 → 스테이지 아래 끝 = 0 으로 알리는 분기 필요. `GameMap.tsx:873-876` 의 `mf-game__panel--errand` 블록과 `ErrandDock`·`.mv-errand-dock`·`data-errand-dock/chip`(E2E `errand.mjs`, `lib.mjs:2958-2959` 의 허용 속성 목록)을 함께 정리하고 시험은 "0건" 으로 뒤집는다.
5. **시작 카드는 눌림을 통과하면서 "아무 곳이나 누르면 닫힘"**(V-19) — `pointer-events: none` 만으로는 닫는 입력을 못 받는다. 루트에 캡처 단계 `pointerdown` 리스너(카드 떠 있는 2초만)를 둔다.
6. **WorldStage 상수.** 표지 누르기 상자 `PIN_HALF = 22`·`CHIP_HALF = 18`(`WorldStage.tsx:75-76`)이 36 원 전제다 → 64 타일(반 32)·글리프 화살표(40, 내 발밑 56)로 바꿀 때 가림 판정(띠·소리 열·진행 점 줄·안쪽 8)이 따라와야 한다. 가장자리 화살표 칩(`ErrandArrow` 현재 구현)은 삭제·재작성.
7. **`MORNING_TRACE_MS` 3→5(V-28) 가 아침 상한을 넘긴다.** `MORNING_MS 5 + VICTIM 2 + WILL 2 + NOTE 2 + TRACE 5 = 16 > MORNING_MAX_MS 15`(`phases.ts` 28-32·`discussion.ts:23-31`). 상한이 그대로면 최악의 아침(유언·쪽지 모두)에서 흔적 구간이 1초 줄고 `trace.test.ts:247-249` 의 합 기대가 깨진다. **추천: `MORNING_MAX_MS` 를 16_000 으로 올린다**(`[ASSUMED]` — 사용자 확인 필요). 같이 고칠 사본: `scripts/e2e/lib.mjs` `TRACE_WINDOW_MS`(+ `e2eContract.test.ts:734`), `recordView.ts:43` 는 `MORNING_TRACE_MS` 를 import 하므로 자동.
8. **허용 키 목록 시험이 많다.** `view.test.ts`(day 키 목록 ~289-300)·`e2e/lib.mjs:2754 VIEW_DAY_KEYS`·`errandLeak.test.ts` 의 `ALLOWED_NEW_PATHS`/`NEW_PREFIXES`(`.view.day.evidence`·`.seen`)·`e2eContract.test.ts`·`leak.test.ts` 는 새 키에서 실패한다 — 의도된 실패이므로 계획에 "키 목록 갱신" 작업을 명시한다.
9. **HOST-05 읽기 경로 시험.** `hostLine.ts` 가 읽는 경로를 시험이 기록·고정한다(`hostLine.test.ts`). `discussion.evidence`·`trace` 문구 분기가 읽는 `day.evidence.trace` 의 **유무**를 허용 목록에 더한다. 역할·`players[].look`·`seen` 내용은 읽지 않는다(문구 키는 유무만).
10. **대기실 문구는 건드리지 않는다.** UI-SPEC 문구 표의 `lobby.gather`·`lobby.guest` 수정("튜토리얼을 해 보세요")은 17 몫이다. 16 은 14 문구 그대로.
11. **E2E 로컬 실행.** 전체 로컬 회귀 약 21분·제한 27분(HANDOFF), 배포본에 큰 회귀를 돌리지 않는다(0076). 바뀐 흐름만 `--only` 로, 6종 전체는 페이즈 끝에 한 번.

## Code Examples

핵심 값만 인용한다(본문은 파일을 읽을 것).

- 흔적 매핑 `[VERIFIED: shared/game/trace.ts:16-26]`: `coat: "button"`, `police: "pin"`, `doctor: "whiteCloth"`, `mafia: "blackCloth"`, `detective: "brownCloth"`, `reporter: "pencil"`, `elder: "grayThread"`, `hood: "navyThread"`, `noir: "redCloth"`. 클라이언트 역표: `Object.entries(TRACE_OF_OUTFIT)` → `piece → outfit`.
- 장소 id `[VERIFIED: shared/protocol.ts:37-40]`: `"glass", "piano", "sax", "stool", "door", "poster", "record", "candle", "clock", "fountain", "bench", "lamp", "mail", "tree", "flower", "stand"`.
- 아침 view `[VERIFIED: shared/protocol.ts:77-81]`: `MorningView { eliminated?: number; saved?: true; trace?: TracePiece }`. 추가: `seen?: { seat: number; place: PlaceId }`.
- 단계 표 `[VERIFIED: phases.ts PHASE_DEFS]`: `errand: ... durationMs: ERRAND_MS, next: "discussion"`; 상수 `ERRAND_MS = 40_000`, `ERRAND_COUNT = 3`, `ERRAND_ACT_R = 1.2`, `ERRAND_NEAR_R = 3.0`, `ERRAND_TICK_MS = 1_000`, `RECORD_MAX = 6`, `MORNING_TRACE_MS = 3_000`, `MORNING_MAX_MS = 15_000`.
- 가짜 제외 형태(의사 코드): `for (const id of actor.errandPlaces) { if (done.includes(id) || id === actor.errandFake) continue; ... }` — `errand.ts:102` 순회의 한 줄 변경.
- 표시 경계: 이름표 표시는 `HeadStackProps`(`HeadStack.tsx`)에 `traceMark?: string`(`--trace-mark` 로만 CSS 에 전달)·`seenMark?: boolean` 을 더하고 `WorldStage` 의 `tagProps(seat)` 훅(`WorldStage.tsx:210`)으로 넘긴다. 속성 `data-trace-mark`·`data-seen-mark` 값에 좌석·역할 없음.

## State of the Art

| Old | Current | Impact |
|-----|---------|--------|
| 아이콘 아래 한 단어 이름표(0073-나) | 아이콘 + `aria-label` 만(0077-1) | 불변식 "아이콘 단추는 `aria-label` 필수"로 시험이 바뀐다 |
| 임시 선 아이콘 `place*` 16개(0074 한계) | 컬러 에셋 25 | `V2Icon` 에서 삭제 |
| 마피아도 시민과 같은 처리(0074 D-03) | 마피아는 가짜 1곳 | 마피아 봇 3/3 시험이 뒤집힌다 |
| 흔적 카드 3초 단독 | 증거 카드 5초 + 낮 끝까지 표시 | `day.evidence` |

## Runtime State Inventory

해당 없음(이름 변경·이전 페이즈 아님). 단, 저장된 옛 방: 새 필드(`errandFake`·`errandLast`·`morning.seen`)는 모두 optional 이라 옛 상태가 그대로 읽힌다(`normalizeStoredRoom` 변경 불필요, `room.ts` Player 주석의 "모두 optional" 패턴). 배포 순간 진행 중이던 판의 마피아는 `errandFake` 가 없어 그날만 3/3 이 가능한 것이 유일한 차이이고 수용 가능하다.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | 전부 | ✓ | v26.13.0 (engines >=22.12) | — |
| vitest 3 프로젝트(unit/client/worker) | 시험 | ✓ | `npx vitest run test/unit/errand.test.ts` 24 통과 확인 | — |
| Chrome(E2E) | `npm run e2e` | ✓ | `/Applications/Google Chrome.app` 존재 | — |
| wrangler/tsc | typecheck | ✓ | node_modules/.bin 에 있음 | — |

차단 의존성 없음.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.12 (`unit` node · `client` happy-dom · `worker` cloudflare-vitest-plugin) + node 내장 test(`scripts/e2e/*.test.mjs`) |
| Config file | `vitest.config.ts` (projects 3개) |
| Quick run command | `npx vitest run test/unit/<file>.test.ts` (파일 단위) |
| Full suite command | `npm test` (`npm run typecheck` 먼저: tokens:check + wrangler types + tsc 앱·워커) |
| E2E | `npm run e2e -- --url http://localhost:5173 --only <흐름1,흐름2>` (로컬은 `npm run dev` 후) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TOOL-04 | `[data-tool-label]` 0건·모든 button 접근성 이름 | client + e2e | `npx vitest run test/client/toolLabels.test.tsx` (뒤집기) · `--only host,lobby` | ✅ 수정 |
| BTN-01/02 | 머리 44·열 52·손님 맵/봇 없음·교차 0 | client + e2e | `npx vitest run test/client/lobby.test.tsx test/client/mapChip.test.tsx test/client/soundButton.test.tsx` | ✅ 수정 / SideColumn 시험 ❌ Wave 0 |
| ASSET-01 | 25개 id·aria-label 1:1 | unit | `npx vitest run test/unit/placeArt.test.ts` | ❌ Wave 0 |
| ERRAND-06/07 | 시작 카드·타일·화살표·[처리]·점 | client + e2e | `npx vitest run test/client/errandScreen.test.tsx test/client/errandParts.test.tsx` · `--only errand` | ✅ 수정 |
| ERRAND-08 | 가짜 제외·응답 동일·봇 2/3 | unit + worker | `npx vitest run test/unit/errand.test.ts test/worker/errand.test.ts test/worker/errandLeak.test.ts` | ✅ 수정 + `errandFake.test.ts` ❌ Wave 0 |
| EVID-01/02 | `errandLast`·`morning.seen`·`day.evidence` 공개/비공개 | unit + worker | `npx vitest run test/unit/trace.test.ts test/unit/view.test.ts test/worker/trace.test.ts` | ✅ 수정 / `errandLast` 시험 ❌ Wave 0 |
| EVID-03 | 문구 키 | unit | `npx vitest run test/unit/hostLine.test.ts` | ✅ 수정 |
| DEPLOY-04 | 키 허용 목록·누설 | worker | `npx vitest run test/worker/leak.test.ts test/worker/errandLeak.test.ts test/unit/e2eContract.test.ts` | ✅ 수정 |

### Sampling Rate
- **Per task commit:** 바뀐 파일의 시험 한두 개(`npx vitest run <file>`) — 규칙 모듈은 수초
- **Per wave merge:** `npm run typecheck && npm test` (전체 vitest) + 바뀐 흐름만 로컬 E2E
- **Phase gate:** 전체 `npm test` 초록 + 로컬 E2E 6종 전체 한 번(약 21분, 페이즈 끝) → `/gsd-verify-work`. 배포본에는 smoke + 바뀐 흐름만(0076)

### Wave 0 Gaps
- [ ] `test/unit/placeArt.test.ts` — 장소 16·조각 9 매핑, aria-label ↔ `PLACE_NAME`/`TRACE_TEXT`, 실루엣 서명이 서로 다름
- [ ] `test/unit/errandFake.test.ts` — 배정 결정성(같은 상태 같은 가짜)·시민 없음·난수 호출 수 불변·`.role` 은 이 파일에만
- [ ] `errandLast` 갱신·소비 시험(`errand.test.ts` 확장): 가장 가까운 관찰자·동률 낮은 좌석·`enterNight` 보존·`enterMorning` 소비·피해자 없음
- [ ] `test/client/sideColumn.test.tsx`·`evidenceCard.test.tsx` — 열 규칙(손님 둘/방장 넷)·표시 아이콘
- [ ] 변환 스크립트 `--check`(사본·JSX 일치)를 시험으로 고정
- 프레임워크 설치 불필요.

## Security Domain

### Applicable ASVS Categories (level 1)
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2/V3 인증·세션 | no(변경 없음) | 소켓 첨부 `playerId` 만 신원 |
| V4 접근 통제 | **yes** | 서버 `buildView` 허용 목록 필드별 복사, 새 값은 공개/본인만 구분 |
| V5 입력 검증 | no(새 메시지 없음) | 기존 zod `strictObject`; 새 입력 경로 없음 |
| V6 암호 | no | — |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| 가짜 장소가 응답/모양으로 역할 누설 | Information Disclosure | 기존 거절 경로 재사용, 새 필드 없음, `errandFake` 서버 전용(누설 시험 `SERVER_ONLY_NEW`), 마피아·시민 프레임 형태 동일 시험 |
| `day.evidence` 에 역할·풀·의상 id 누설 | Information Disclosure | 조각 id 1개 + `{seat, place}` 만. 의상 id·피해자를 고른 사람 풀 금지, 모든 view 에 같은 값 |
| 마지막 목격이 위치 좌표 누설 | Information Disclosure | 닫힌 집합 `PlaceId` 만(좌표 없음) |
| 에셋 JSX 로 XSS | Tampering | 정적 JSX, `dangerouslySetInnerHTML` 금지, 닉네임은 텍스트 노드만 |
| 타이밍 오라클(가짜 처리 vs 반경 밖) | Info. Disclosure | 응답은 본인에게만 가고 형태 동일(타이밍은 본인만 관측). `writeAt` 간격 기록도 성공 여부와 무관하게 동일(`applyErrand` 현행) |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 마피아가 3/3 불가 → 기록 못 받음 → "지어낸 목격이 엇갈린다"가 0077-6 의 "엇갈림"이다. 기록 줄에 처리 비트를 더하지 않는다 | R-1 | 사용자가 "처리하는 모습이 직접 보이는" 장치를 기대했다면 새 view 필드·누설 표면이 필요해 범위가 커진다 |
| A2 | 마지막 목격 = 그날 심부름의 마지막 근처 표본의 가장 가까운 산 사람(밤 위치 아님), 장소 id 동봉 | R-2 | 정의가 다르면(예: 밤 직전 토론 위치) 자료가 없어 서버 추적 추가 필요 |
| A3 | `MORNING_MAX_MS` 를 16s 로 올린다 | Pitfall 7 | 15s 유지가 우선이면 흔적 구간 1초 단축을 받아들여야 함 |
| A4 | 가짜 고르는 규칙 `(seat + day) % 3`(난수 없음) | R-1 | 사용자가 순수 난수를 원하면 `randInt` 호출 순서 계약·봇 시드 고정 값을 다시 계산해야 함 |
| A5 | [테스트] 버튼은 왼쪽 위 그대로, 유언 단추는 48 원 | Pitfall 2·3 | UI-SPEC 이 말하지 않은 곳이라 사용자가 다르게 원할 수 있음(한 줄 수정) |
| A6 | 재접속 안전을 위해 evidence 를 서버가 싣는다(클라이언트 상태 대신) | R-4 | 클라이언트 상태로 족하다면 서버 변경 하나가 줄지만 새로고침 시 표시 소실 |

(A1·A2·A3·A4 는 계획 전에 사용자(또는 위임 추천 기록)로 확정할 항목. 새 결정 기록 번호는 다음 빈 번호 0079.)

## Open Questions

1. **엇갈림을 더 직접 보이게 할 것인가** — 알려진 것: 현 설계는 새 네트워크 필드 없음. 모르는 것: 사용자가 "처리 모습 목격"을 literal 하게 원하는지. 권고: 16 은 R-1 로 가고, 실테스트(v3.0 끝)에서 판단.
2. **`day.evidence` 이름·위치** — 대안은 `day.morning` 확장. 권고: 새 키(회귀 범위 최소).
3. **유령에게도 같은 표시** — UI-SPEC 은 카드가 모든 사람(유령 포함)에게 같다고 함. 이름표 표시도 같은 규칙으로 두는 것을 권고(역할 무관한 공개 값).

## Plan 분할 제안 (웨이브)

1. **W1 서버(독립, 순수·누설 시험 먼저)**: `errandFake`·`actErrand`·`errandLast`·`morning.seen`·`day.evidence`·프로토콜·키 목록 시험 갱신·봇 시험 수정·상수(`MORNING_TRACE_MS`/MAX).
2. **W2 에셋 변환**: 스크립트·`design/v3.0/assets/`·`placeArt.tsx`·`placeArt.test`·`V2Icon place*` 삭제(사용처 `RecordCard`·`ErrandMarker` 먼저 교체).
3. **W3 단추 정리**: 이름표 삭제 + ToolButton/Button/SideColumn/머리 44/입력줄 48 + CSS + 문서 `screen-map.md` + src 시험 뒤집기(E2E 스크립트는 같은 웨이브 끝에 갱신).
4. **W4 심부름 화면**: 시작 카드·타일·화살표·[처리]·진행 점·독 삭제·`useMapInsets` 패널 없음 분기·`hostLine` `errand.act` 문구.
5. **W5 증거 화면**: `EvidenceCard`·이름표 표시·`hostLine` 문구(`trace`·`discussion.evidence`)·`recordView` 구간 5초.
6. **W6 마감**: E2E 갱신·6종 로컬 회귀 한 번·성능(심부름 타일 투영)·결정 기록 0079·`docs/screen-map.md`·HANDOFF·배포(계정 가드 `scripts/check-account.mjs`).

## 17 로 넘김 (서버가 필요로 할 것, 구현 금지)

17 이 "함께 진행"을 하려면 `PhaseId` 한 개 추가(컴파일 연쇄: `phases.ts PHASE_DEFS`·`scenes.ts PHASE_SCENE`·`RoomScreen PHASE_ANNOUNCE`·`TestTools TEST_PHASE_LABEL`·`audio/director BED_OF`·`hostLine hostChimeOf`·`emotePhases/phaseScreens/scenes/hostLine/view/soundDirector` 시험 표·`e2e/lib.mjs BASIC_TRANSITIONS·EXPECTED_SCENE`), `{t:"start"}` 에 선택 필드(`tutorial?: boolean`, `schemas.ts:79` 근처 `strictObject` 수정; 필드 없으면 꺼짐이라 옛 클라이언트·봇 스크립트 안전), `beginGame`(`room.ts` — `startGame`·`rematch` 공용)에서 단계 분기, 끝 신호 메시지 하나 + 조기 종료는 `applyEndDiscussion` 의 `tick({...state, phaseEndsAt: now})` 패턴, 봇·끊긴 사람은 끝난 것으로 계산(끊김 때 재평가 위치 `handleDisconnect`). 대기실 [시작] 을 UI 로 누르는 E2E 는 `browser.mjs:1175` 한 곳이 입구다. 16 은 이 어느 것도 건드리지 않는다.

## Sources

### Primary (HIGH — 이 세션에서 직접 읽음)
- `shared/game/{phases,tick,errand,trace,night,view,room,look,discussion,world}.ts`, `shared/protocol.ts`, `worker/room.ts`(start·errand·endDiscussion·afterTransition·sample·disconnect), `src/screens/{Lobby,GameMap}.tsx`, `src/components/{ToolButton,WorldStage}.tsx`, `src/components/v2/{FloatAction,MapChip,SoundButton,ErrandMarker,ErrandDock,TraceCard,HeadStack}.tsx`, `src/net/useMapInsets.ts`, `src/game/{hostLine,placeText,traceText}.ts`, `src/styles/{v2,lobby,game,result}.css`(관련 줄)
- `design/v3.0/tutorial/Main.dc.html`(스크립트로 25개 `<svg>` 구조 확인)
- `.planning/` 의 ROADMAP·REQUIREMENTS·STATE·15-CONTEXT·15-01-SUMMARY·16-CONTEXT·16-UI-SPEC, `docs/decisions/0076·0077·0078`, HANDOFF.md, `vitest.config.ts`, `package.json`

### Secondary / Tertiary
- 없음(외부 웹 조사 불필요한 내부 규칙·구현 페이즈. Context7·웹 검색을 쓰지 않았다).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 새 패키지 없음, package.json 확인
- Architecture(서버): HIGH — 호출 순서·저장·view 경로를 소스로 확인. 게임 설계 해석(A1·A2)은 MEDIUM
- Pitfalls: HIGH — grep 으로 참조 지점 열거(이름표·키 목록·TOOL_ROW_EXTRA)
- 클라이언트 레이아웃 수치: MEDIUM — UI-SPEC 숫자를 따르며 실제 CSS 충돌은 구현 때 폰 6종으로 확인

**Research date:** 2026-11-08
**Valid until:** 2026-11-15 (v3 브랜치가 빠르게 변함; 17 결정·UI-SPEC 개정에 따라 갱신)
