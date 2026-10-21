# Phase 1: 걷는 뼈대 - Research

**Researched:** 2026-10-21
**Domain:** Cloudflare Workers + Durable Objects(WebSocket Hibernation) 실시간 방 서버, React 19 + Vite 8 세로 폰 웹앱, 서버 기준 타이머·플레이어별 상태 필터링
**Confidence:** HIGH (스택·배포·테스트 조합은 로컬 스파이크로 직접 실행해 확인함. 일부 운영 동작은 MEDIUM/ASSUMED로 표시)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**게임 흐름 변경 (결정 0007)**
- **D-01:** 역할 확인 다음 첫 단계는 **낮**이다(밤 먼저 → 낮 먼저). 첫 낮도 다른 낮과 같은 기본 시간이고, 단계 시간 조정은 플레이테스트(6페이즈) 결과로 한다. 전체 순서: 역할 배정 → 역할 확인 → [낮: 직업 공개 → 낮 토론 → 투표 → 최후 변론 → 찬반 → 처형] → 밤 → 아침 → 낮… — **Reversibility:** costly — 단계 순서는 서버 단계 전환 틀·기획서·요구사항·로드맵 순서에 함께 걸려 있다
- **D-02:** 1페이즈의 마지막 단계는 서버의 `낮` 단계다. 화면은 "낮이 되었습니다" 와 [내 역할] 버튼만 있는 자리 화면이고, 타이머·행동은 없다. 새 2페이즈가 이 자리에 직업 공개·낮 토론을 얹는다. 단계 전환 틀은 역할 배정 → 역할 확인 → 낮의 세 단계로 검증한다.
- **D-03:** 매 낮 시작에 고정 "직업 공개" 단계를 두기로 했다(결정 0007, 새 요구사항 DAY-02). 1페이즈에서는 만들지 않고, 서버 단계 정의에 미리 넣어 두지도 않는다. 새 2페이즈가 단계 전환 틀에 추가한다.

**첫 화면·참가 흐름**
- **D-04:** 주소를 그냥 열면 한 화면에 닉네임 입력칸, [방 만들기], [코드로 참가 ____] 가 있다. 방장도 닉네임을 입력한다.
- **D-05:** 참가 링크로 열면 방 정보("○○님의 방", 현재 인원/8)와 닉네임 입력칸, [들어가기] 하나만 보인다. 코드 입력·방 만들기는 숨긴다.
- **D-06:** 닉네임은 1~8자. 같은 방에 같은 닉네임이 있으면 "이미 있는 이름이에요" 로 다시 입력받는다(서버 검증). 마지막으로 쓴 닉네임은 브라우저에 기억해 다음에 미리 채운다.
- **D-07:** 들어갈 수 없는 방은 이유를 한 문장으로 보여 주고 처음 화면으로 돌아가는 버튼을 준다: "없는 방이에요" / "방이 꽉 찼어요" / "이미 게임이 시작됐어요". 단, 그 방의 플레이어 토큰이 있는 사람은 게임 시작 후에도 그대로 자기 자리로 들어간다(CONN-01).

**대기실·참가자 등장**
- **D-08:** 대기실은 **둥근 테이블** 둘레 8자리다(2.5D 원근 타원 구도, D-24). 세로 폰 폭에서 이름이 좁아지는 문제는 이름을 자리 바깥쪽에 두거나 말줄임으로 푼다(Claude 재량).
- **D-09:** 자리는 들어온 순서로 고정되고 게임 내내 유지된다(이후 페이즈의 낮·밤·투표 화면도 같은 테이블 배치를 쓴다). 각자 폰에서는 **내 자리가 항상 맨 아래 가운데**에 오도록 테이블을 돌려 보여 준다. 둘러앉은 순서는 모든 폰에서 같다. 마피아 규칙에 좌우 의미가 없고 빠른 메시지는 이름으로 대상을 고르므로 회전해도 문제없다(사용자 확인). — **Reversibility:** costly — 이후 모든 단계 화면이 같은 테이블 배치 부품을 쓴다
- **D-10:** 참가·퇴장은 **자리 애니메이션만** 쓴다: 빈 의자에 인물이 등장하고, 나가면 사라져 빈 의자가 된다. 별도 안내 문구(토스트)는 없다.
- **D-11:** 하단: 모두에게 "4/8명" 과 한 문장 상태. 방장에게만 [게임 시작] 버튼 — 4명 미만이면 흐리게 + "1명 더 필요해요", 4명 이상이면 활성. 참가자에게는 "방장이 시작하기를 기다리는 중…". [공유] 버튼(Web Share, 미지원 시 링크 복사)과 방 코드는 모두에게 보인다. 방장 자리에는 왕관 표시.

**배정·역할 카드·카운트다운**
- **D-12:** 역할 배정 약 3초: 화면이 어두워지고 가운데 "직업을 배정하고 있습니다…" 가 숨쉬듯 커졌다 작아지는 맥박 효과(점 3개 애니메이션). 서버 단계이며 모든 폰에서 같은 시각에 시작·끝난다.
- **D-13:** 역할 확인 15초: 뒷면 카드와 "눌러서 확인" 이 뜨고, 누르면 뒤집히며 역할이 공개된다. 5초 안에 누르지 않으면 저절로 뒤집힌다. 카드에는 역할 이름과 한 줄 설명(Claude 재량 문구).
- **D-14:** 마피아는 카드 아래 "동료: ○○" 를 보고, 테이블의 동료 자리에 진홍 표시가 붙는다. 이 표시는 게임 내내 그 마피아의 화면에만 남는다(서버가 마피아에게만 동료 정보를 보낸다). 마피아가 1명이면 "이번 판 마피아는 당신 혼자입니다".
- **D-15:** 카운트다운은 화면 위쪽의 줄어드는 막대 + 숫자. 마지막 5초는 막대가 진홍으로 바뀌고 숫자가 초마다 크게 튄다. 서버가 보낸 마감 시각 기준으로 그린다. 이후 단계(낮·밤·투표)도 쓰는 **공통 타이머 부품**으로 만든다.

**연결 끊김·이탈 처리**
- **D-16:** 대기실에서 연결이 끊긴 사람은 자리에 남고 흐릿하게 표시된다. 직접 [나가기]를 누른 사람만 자리가 빈다. 방장은 흐릿한 사람을 내보낼 수 있다. 흐릿한 사람이 있어도 4명 이상이면 시작할 수 있고, 그 사람은 돌아오면 자기 역할로 이어서 한다.
- **D-17:** 방장이 끊기면 다른 사람처럼 흐릿하게 남고 돌아오길 기다린다. 방장이 [나가기]를 누르면 다음으로 들어온 사람이 방장이 된다. 끊긴 채 오래 안 돌아올 때의 자동 이양은 v2 CONNX-01.
- **D-18:** CONN-02 확정: 게임 중 끊긴 사람을 기다리지 않고 서버 타이머대로 진행한다. 놓친 투표·찬반은 기권, 밤 행동은 행동 없음, 직업 공개는 말 안 함. 게임 중에도 끊긴 사람은 테이블에서 흐릿하게 표시한다(연결 여부는 역할과 무관한 공개 정보). CONN-02 구현 자체는 4페이즈 요구사항이지만 1페이즈의 연결 상태 모델은 이 정책을 전제로 짠다.
- **D-19:** 역할 확인 뒤 모든 단계에 같은 모양의 [내 역할] 버튼을 둔다. 누르고 있는 동안만 내 역할 카드가 보인다. 역할 확인을 놓치고 돌아온 사람도 여기서 확인한다. 모든 사람에게 같은 버튼이라 역할을 드러내지 않는다.

**1페이즈 화면 톤**
- **D-20:** 색 방향: 바탕은 **밤 남색**, 판·글자·중립 면은 **회색**, 강조(마피아·위험·마지막 5초)는 **진홍**. 5페이즈가 이 방향을 다듬는다.
- **D-21:** 캐릭터가 나오기 전(1~4페이즈) 테이블 자리에는 **같은 정장 몸 실루엣**을 두고 자리마다 색(또는 모자·가면 윤곽)으로 구분한다. 5페이즈에서 같은 자리에 실제 캐릭터를 끼운다.
- **D-22:** 5페이즈에서 캐릭터 표현이 프레임 PNG 애니메이션으로 바뀐다(사용자 희망, 결정 0008). 1페이즈의 테이블·자리·인물은 게임 상태(자리 번호, 닉네임, 연결 여부, 방장, 마피아 동료 표시)를 받아 그리기만 하는 화면 부품으로 분리해, 나중에 그리는 방식만 바꿔 끼울 수 있게 만든다. — **Reversibility:** costly — 상태와 그리기가 섞이면 5페이즈에서 테이블을 쓰는 모든 단계 화면을 고쳐야 한다

**그리는 방식 (결정 0008)**
- **D-23:** 실시간 3D 장면은 쓰지 않는다. 화면 구조는 일반 웹 화면(2D)이고, 보이는 모습을 입체감 있는 **2.5D** 로 만든다(사용자: 맵 이동·고품질 3D 가 아니라 간단하지만 구색과 완성도가 있는 2.5D). 계획 전 스파이크는 하지 않는다. — **Reversibility:** costly — 나중에 실시간 3D 로 바꾸면 테이블을 쓰는 모든 단계 화면을 다시 만들어야 한다
- **D-24:** 1페이즈 테이블은 비스듬히 내려다본 **원근 타원 테이블**이다. 내 자리(맨 아래, D-09)가 가장 가깝고 크게, 건너편 자리는 작게 보인다. 그림자·조명 레이어·앞뒤 겹침으로 입체감을 기본형으로 넣는다(배경 패럴랙스는 Claude 재량). 이후 페이즈도 같은 구도를 쓴다.
- **D-25:** 1페이즈에서 완성 캐릭터 에셋은 만들지 않는다. 원근 테이블에 임시 정장 실루엣(D-21)을 두고, 5페이즈에서 프레임 PNG 캐릭터(일러스트 또는 3D 렌더링)와 연출로 바꿔 끼운다(D-22).

### Claude's Discretion
- 방 코드 형식(숫자 4자리 권장), 빈 방·끝난 방 정리 시점, 코드 재사용 규칙
- 공유 링크 미리보기(카카오톡 제목·문구·이미지)
- 패키지·버전, 애니메이션 구현 방식(CSS 우선 등), 서버 메시지 형식 — 리서치·계획에서 정한다
- 역할 카드 설명 문구, 상태 문구 세부 표현
- 둥근 테이블에서 이름 배치·말줄임 방식

### Deferred Ideas (OUT OF SCOPE)
- 직업 공개 단계 상세 — 다른 사람 선택을 실시간으로 보여 줄지 다 고른 뒤 동시 공개할지, 선택지를 이번 판에 있는 직업만 보일지, 단계 시간, 빠른 메시지의 "저는 [직업]이에요" 템플릿과의 통합, 자리 옆 주장 표시와 "말 바꿈" 표현 → 새 2페이즈(낮 토론) 논의
- 로드맵 순서 변경: 2 낮 토론(직업 공개 포함) ↔ 3 밤과 아침 맞바꿈 → 이번 논의에서 ROADMAP.md 에 반영
- 방장 자동 이양, 오래 안 돌아오는 사람 자동 정리 → v2 CONNX-01, CONNX-02 (기존)
- 캐릭터 에셋 방식(입체감 있는 일러스트 프레임 PNG vs 3D 모델을 Blender 스크립트로 렌더링한 프레임 PNG·스프라이트 시트, Rive/Lottie 비교)과 공개된 캐릭터 에셋 생성 스킬·도구 조사 → 5페이즈 논의 (결정 0008)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ROOM-01 | 방장이 방을 만들면 4자리 방 코드와 참가 링크가 나오고, 공유 버튼(Web Share, 미지원 시 링크 복사)으로 카카오톡 등에 보낼 수 있다 | `POST /api/rooms` + DO 이름=코드(`getByName`), 코드 생성·충돌 재시도, Web Share/클립보드/HTTP 대체 경로, OG 태그 정적 미리보기 |
| ROOM-02 | 링크·4자리 코드로 설치·로그인 없이 닉네임만 입력해 들어오고 대기실 목록에 바로 나타난다 | `/r/:code` SPA 폴백, `GET /api/rooms/:code` 미리보기, `POST .../join`, WS 전체 스냅샷 방송, 닉네임 검증(Intl.Segmenter) |
| ROOM-03 | 4~8명, 방장만 4명 이상일 때 시작, 8명이면 더 못 들어옴 | 순수 함수 `canStart`/`join` 규칙, 서버 검증 오류 코드 |
| CONN-01 | 플레이어 토큰 발급·브라우저 저장, 같은 폰으로 다시 열면 같은 자리·역할로 현재 단계 | 128bit 토큰, localStorage, `hello{token}` 재접속, 생성자에서 DO 상태 복구·연결 상태 보정, 클라이언트 재연결 규칙 |
| DEPLOY-01 | `wrangler deploy` 한 번으로 웹+서버가 같은 주소에 갱신 | `@cloudflare/vite-plugin` 빌드 출력(`dist/client`, `dist/worker/wrangler.json`)과 `wrangler deploy` 리다이렉트 구성, 정적 에셋 기본 캐시 헤더(`max-age=0, must-revalidate`) |
| GAME-01 | 서버가 단계 전환·타이머 기준, 클라이언트는 마감 시각으로 표시. 역할 배정(약 3초) → 역할 확인(15초) → 낮 | 데이터 표 기반 `PHASE_DEFS` + 순수 `tick(state, now)`, DO 알람 단일 다중화, 마감 시각 연쇄 계산, 시계 오프셋 |
| ROLE-01 | 인원 구성표대로 서버가 무작위 배정, 구성표는 서버 한 곳 | 상수 표 + 주입 가능한 RNG(Fisher–Yates, `crypto.getRandomValues`) |
| ROLE-02 | 자기 역할 카드만 보고 마피아는 동료도 본다. 남의 역할은 클라이언트로 보내지 않는다 | 연결별 `buildView(state, playerId)` 순수 함수, 공개 필드 허용 목록, 직렬화 스캔 테스트·실제 네트워크 스모크 |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

`./CLAUDE.md`(저장소 루트, `/Users/dhkim1522/personal/minifia/CLAUDE.md`)에서 추린 지시. 계획과 코드가 모두 지켜야 한다.

- 게임 규칙·판정은 서버(방 Durable Object)가 정한다. 클라이언트는 받은 상태를 보여 주고 행동만 보낸다 (결정 0002).
- 다른 사람의 역할은 서버가 클라이언트로 보내지 않는다. 화면에서 숨기는 것으로 대신하지 않는다.
- 기획·계획은 참여 플레이어의 몰입을 기준으로 한다. 각 페이즈는 자기 구간의 이펙트·액션을 기본형으로 함께 만든다 (결정 0006).
- 새 결정은 `docs/decisions/` 에 다음 번호(0009~)로 파일을 추가한다.
- 작업을 마칠 때마다 `HANDOFF.md` 를 갱신하고 push한다 (Mac / 집 Windows 오가며 작업 → 스크립트·경로가 두 OS에서 동작해야 함).
- GSD 산출물(`.planning/`)과 응답은 한국어. 코드·명령·파일 이름·요구사항 ID 는 원문.
- 작은 MVP: v1에 필요한 것만. 이른 배포: 1페이즈 성공 기준에 실제 배포 포함, 이후 검증은 배포본으로.
- 디자인 참고 자료: `design/references/` 의 이미지를 직접 열어 보고 따른다(`gsd-addons:design-refs` 스킬이 planner·executor·ui 에이전트에 설정됨). 1페이즈에서 쓰는 것은 색 방향(D-20), 임시 실루엣(D-21), 2.5D 원근 구도(D-24)뿐.
- 프로젝트 스킬(`.claude/skills/`, `.agents/skills/`)은 없음 (확인함).

## Summary

이 페이즈는 신규 저장소(코드 없음)에 "Vite 빌드 하나 + Worker 하나 + Durable Object(`Room`) 하나"를 세우고, Cloudflare에 배포해 폰 여러 대가 같은 방에서 역할 카드만 받는 가장 얇은 세로 슬라이스를 만든다. 2026-10-21 기준 최신 도구 조합(React 19.3.1, Vite 8.3.5, `@cloudflare/vite-plugin` 1.64.0, wrangler 4.151.3, vitest 4.1.12, **`@cloudflare/vitest-plugin` 1.4.6**, TypeScript 7.0.2)을 로컬 스파이크로 설치·빌드·타입체크·`wrangler deploy --dry-run`·DO WebSocket/알람/eviction 테스트·`vite dev` (LAN 포함) WebSocket까지 실제로 돌려 확인했다. 기존 지식과 달라진 점이 여럿 있다: `@cloudflare/vitest-pool-workers` 는 **`@cloudflare/vitest-plugin` 으로 이름이 바뀌었고 더 이상 갱신되지 않으며**, DO 클래스 선언은 `migrations` 대신 `exports` 필드를 쓸 수 있고, 로컬 workerd가 지원하는 날짜보다 "오늘 날짜"가 앞서면 `vite dev` 가 뜨지 않는다.

설계의 중심은 세 가지다. (1) **순수 게임 코어**: 역할 구성표·배정·단계 표·`tick(state, now)`·`buildView(state, playerId)`·닉네임 검증·자리 배치 계산을 DO/브라우저와 무관한 순수 TypeScript로 `shared/` 에 두고 plain vitest(node)로 TDD한다. DO는 이를 호출하는 얇은 어댑터(저장·소켓·알람)다. (2) **플레이어별 상태 방송**: 매 변경마다 연결별 첨부(`serializeAttachment` 의 `playerId`)로 그 사람의 `RoomView` 전체 스냅샷을 새로 만들어 보낸다(델타 없음 → 재접속이 곧 "현재 스냅샷 한 번 받기"). 공개 필드는 허용 목록(seat, nickname, connected, isHost)이고 역할은 `me` 에만, 동료는 마피아의 `me.allies` 에만 들어간다. (3) **서버 기준 타이머**: 단계 정의 표 + 마감 시각(`phaseEndsAt`, epoch ms) 연쇄 계산 + DO 알람 하나(DO당 알람은 하나뿐이라 단계 알람과 방 만료 알람을 한 곳에서 다중화) + 모든 진입점에서 `tick` 먼저 실행(늦은 알람·재시도에도 멱등).

**Primary recommendation:** 한 패키지 루트에 `src/`(React) · `worker/`(Worker + `Room` DO) · `shared/`(프로토콜·순수 게임 코어) 를 두고, `@cloudflare/vite-plugin` 으로 단일 `vite build` → `wrangler deploy` 파이프라인을 만든다. 1번째 계획에서 "빈 Worker+DO+정적 페이지를 먼저 배포"해 DEPLOY-01을 끝내고, 이후 모든 계획은 순수 코어를 TDD로 먼저 만든 뒤 DO 어댑터와 화면을 얹는다. 로컬 개발은 `vite dev --host`(LAN 폰 접속·WebSocket 모두 확인됨), 서비스 워커/PWA 플러그인은 이 페이즈에서 넣지 않는다(배포 즉시 반영 기준 5번과 충돌 위험).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 방 생성·4자리 코드 발급·충돌 재시도 | API / Backend (Worker) | Database / Storage (DO 상태) | 코드 유일성은 DO 이름 공간이 보증. Worker가 난수 코드를 만들고 DO가 "이미 사용 중"을 판정 |
| 참가 검증(정원·시작 여부·닉네임 중복) | API / Backend (Room DO) | — | 규칙은 서버 기준(결정 0002). 클라이언트 검증은 UX 보조일 뿐 |
| 플레이어 토큰 발급·검증 | API / Backend (Room DO) | Browser / Client (localStorage 보관) | 토큰은 서버가 만들고 클라이언트는 보관만 한다 |
| 역할 배정·구성표 | API / Backend (Room DO, 순수 코어) | — | 서버 한 곳(ROLE-01). 클라이언트 번들에 구성표를 넣을 이유 없음 |
| 플레이어별 상태 필터링·방송 | API / Backend (Room DO) | — | 남의 역할은 네트워크에 나가지 않아야 함(ROLE-02) |
| 단계 전환·타이머·알람 | API / Backend (Room DO) | Browser / Client (마감 시각으로 표시만) | GAME-01. 클라이언트 타이머는 권위 없음 |
| 방 영속(재접속·하이버네이션 복구) | Database / Storage (DO storage, SQLite 백엔드의 KV API) | — | 인메모리는 하이버네이션/배포 때 사라진다 |
| 시계 오프셋 보정·카운트다운 표시 | Browser / Client | API / Backend (`pong.serverNow` 제공) | 표시용 계산만 클라이언트 몫 |
| 2.5D 테이블·자리·카드 그리기 | Browser / Client | — | 상태를 받아 그리기만 하는 화면 부품(D-22) |
| 정적 파일(HTML/JS/CSS) 서빙 | CDN / Static (Workers Static Assets) | API / Backend (`/api/*` 만 Worker 우선) | 에셋 우선 서빙, SPA 폴백으로 `/r/:code` 처리 |
| 공유(Web Share/복사)·카카오톡 미리보기 | Browser / Client | CDN / Static (OG 메타 태그) | 공유 시트는 브라우저 API, 미리보기는 카카오 서버가 OG 태그를 긁어감 |
| 재접속(visibility/online 이벤트, 백오프) | Browser / Client | API / Backend (`hello` 스냅샷 응답) | 폰 화면이 꺼지면 소켓이 끊김(iOS) |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react / react-dom | 19.3.1 | UI | 결정 0001. 스파이크에서 Vite 8 + plugin-react 6 로 빌드·번들 확인 [CITED: npm registry, 2026-10-21 `npm view react version`] |
| vite | 8.3.5 | 번들러/개발 서버 | `@cloudflare/vite-plugin` 1.64.0 의 peer가 `vite ^6 \|\| ^7 \|\| ^8`, `@vitejs/plugin-react` 6.1.2 의 peer가 `vite ^8.0.0` [VERIFIED: 스파이크 `npm i` 충돌 없음 + `vite build` 성공] |
| @vitejs/plugin-react | 6.1.2 | React 빌드/HMR | Cloudflare React 가이드가 이 플러그인 사용 [CITED: developers.cloudflare.com/workers/framework-guides/web-apps/react/] |
| @cloudflare/vite-plugin | 1.64.0 | Worker+DO+정적 에셋을 Vite 로 개발·빌드. `dist/client` + `dist/worker/wrangler.json` 출력 | 공식 권장 경로. 스파이크: 빌드, `wrangler deploy --dry-run`, `vite dev` 모두 동작 [VERIFIED: 로컬 스파이크] |
| wrangler | 4.151.3 | 배포·타입 생성(`wrangler types`)·dry-run | 공식 CLI. `wrangler deploy` 가 `.wrangler/deploy/config.json` 리다이렉트로 `dist/worker/wrangler.json` 사용 [VERIFIED: 스파이크 dry-run 출력 "Using redirected Wrangler configuration"] |
| typescript | 7.0.2 | 타입체크 | 스파이크에서 `tsc -p` 로 앱/워커 구성 둘 다 통과 [VERIFIED: 로컬 스파이크, `npm view typescript` OK 판정] |
| zod | 4.6.7 | 클라이언트→서버 메시지·HTTP 본문 검증 (ASVS V5) | 서버만 값(value)으로 import, 클라이언트는 `import type` 만 → 번들 크기 불변 확인(219.5kB 그대로) [VERIFIED: 스파이크 빌드] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | 4.1.12 (`V4` dist-tag) | 테스트 러너 | 공식 문서가 `vitest@^4.1.0` 로 안내. 5.0.5 도 스파이크에서 통과했으나 문서 기준 4.x 고정 권장 [CITED: developers.cloudflare.com/workers/testing/vitest-integration/write-your-first-test/; VERIFIED: 스파이크 둘 다 통과] |
| @cloudflare/vitest-plugin | 1.4.6 | workerd 안에서 DO/Worker 통합 테스트 (`cloudflare:test`, `cloudflare:workers`) | **`@cloudflare/vitest-pool-workers` 는 이름이 바뀌어 더 이상 갱신되지 않음**(npm deprecated 메시지) [VERIFIED: npm `deprecated` 필드] |
| @testing-library/react / @testing-library/dom | 16.3.3 / 10.4.2 | 훅·부품 테스트 | 타이머 부품, 역할 카드 정도만 가볍게 [VERIFIED: 스파이크 컴포넌트 테스트 통과, 합법성 OK] |
| happy-dom | 21.0.4 | 위 테스트용 DOM 환경 (`// @vitest-environment happy-dom`) | 클라이언트 훅/부품 테스트에만 [VERIFIED: 스파이크] |
| @types/react / @types/react-dom | 19.3.0 | 타입 | 합법성 OK [VERIFIED: gsd 합법성 검사] |

`@cloudflare/workers-types` 는 **필요 없다**: `wrangler types` 가 `worker-configuration.d.ts` 에 workerd 런타임 타입(`WebSocketPair`, `DurableObjectState` 등)과 `Env` 를 함께 생성한다 [VERIFIED: 스파이크 생성 파일 헤더 "Runtime types generated with workerd@1.20261019.1"].

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| 직접 짠 `Room` DO | `partyserver` 0.5.10 / `agents` 0.29.0 | 보일러플레이트를 줄이지만 하이버네이션·알람 제어가 추상화 뒤로 숨고, 이 프로젝트는 연결별 필터링·알람 다중화를 직접 통제해야 한다. 직접 짠다 (패키지 이름은 WebSearch/레지스트리 발견이라 이 연구에서는 `[ASSUMED]` 수준 — 채택하지 않음) |
| 직접 짠 3-라우트 라우터 | hono 4.13.13 | 경로가 `/api/rooms`, `/api/rooms/:code`, `/api/rooms/:code/join`, `/api/rooms/:code/ws` 뿐. 의존성 불필요 |
| 직접 짠 경로 파싱(`/` , `/r/:code`) | react-router | 화면 전환은 서버 단계 기준이고 URL은 2개뿐. 불필요 |
| 상태관리 라이브러리 | Zustand 등 | 서버 스냅샷 하나를 `useSyncExternalStore`/`useReducer` 로 들고 있으면 충분 |
| vite-plugin-pwa 2.0.0 | — | **이 페이즈에서 넣지 않는다.** 서비스 워커는 "배포하면 새 버전이 바로 보인다"(성공 기준 5)와 충돌할 수 있다. 설치형(PWA)은 5~6페이즈에서 판단 |
| `exports` 필드 | `migrations: [{tag:"v1", new_sqlite_classes:["Room"]}]` | 둘 다 스파이크에서 빌드·dry-run·테스트 통과. 두 방식은 동시에 쓸 수 없고 `exports` 로 배포한 뒤 `migrations` 로 못 돌아간다 [CITED: developers.cloudflare.com/durable-objects/reference/durable-objects-migrations/]. 현재 공식 문서의 신규 방식인 `exports` 를 권장 |

**Installation:**
```bash
npm i react@19.3.1 react-dom@19.3.1
npm i -D vite@8.3.5 @vitejs/plugin-react@6.1.2 @cloudflare/vite-plugin@1.64.0 wrangler@4.151.3 \
  typescript@7.0.2 zod@4.6.7 vitest@4.1.12 @cloudflare/vitest-plugin@1.4.6 \
  @types/react@19.3.0 @types/react-dom@19.3.0 \
  @testing-library/react@16.3.3 @testing-library/dom@10.4.2 happy-dom@21.0.4
```
(zod 는 런타임에 Worker 번들로 들어가므로 `dependencies` 에 두어도 된다. 어느 쪽이든 Vite 가 번들한다.) Node는 wrangler `>=22`, vitest 4 `^22.12 || ^24 || >=26` — 이 Mac은 v26.0.0 [VERIFIED: `npm view wrangler engines`, `node --version`]. `package.json` 에 `"type": "module"` 필수 [CITED: developers.cloudflare.com/workers/vite-plugin/get-started/].

**Version verification:** 위 버전은 2026-10-21 `npm view <pkg> version` 결과이고 한 세트로 스파이크 설치·빌드·테스트까지 확인했다. 레지스트리 최신이 계속 바뀌므로 계획 단계에서 정확한 버전으로 **고정(`package-lock.json` 커밋)** 한다.

## Package Legitimacy Audit

`gsd_run query package-legitimacy check --ecosystem npm ...` 결과 (2026-10-21):

| Package | Registry | Age/최신 게시 | Downloads/wk | Source Repo | Verdict | Disposition |
|---------|----------|--------------|--------------|-------------|---------|-------------|
| wrangler | npm | 최신 2026-10-20 | 18.1M | github.com/cloudflare/workers-sdk | SUS (`too-new`) | Flagged — 아래 설명 |
| @cloudflare/vite-plugin | npm | 최신 2026-10-14 | 4.0M | github.com/cloudflare/workers-sdk | SUS (`too-new`) | Flagged |
| @cloudflare/vitest-plugin | npm | 최신 2026-10-20 | 624K | github.com/cloudflare/workers-sdk | SUS (`too-new`) | Flagged |
| vitest | npm | 최신 2026-10-15 | 77.5M | github.com/vitest-dev/vitest | SUS (`too-new`) | Flagged |
| react / react-dom | npm | 최신 2026-10-14 | 116M / 109M | facebook/react | SUS (`too-new`) | Flagged |
| vite | npm | 최신 2026-10-21 | 119M | vitejs/vite | SUS (`too-new`) | Flagged |
| @vitejs/plugin-react | npm | 최신 2026-10-05 | 59.8M | vitejs/vite-plugin-react | SUS (`too-new`) | Flagged |
| zod | npm | 최신 2026-10-12 | 207M | colinhacks/zod | SUS (`too-new`) | Flagged |
| happy-dom | npm | 최신 2026-10-20 | 13.1M | capricorn86/happy-dom | SUS (`too-new`) | Flagged |
| typescript | npm | 최신 2026-07-08 | 184M | microsoft/TypeScript | OK | Approved |
| @types/react, @types/react-dom | npm | 2026-09-09 | 106M / 91M | DefinitelyTyped | OK | Approved |
| @testing-library/react, @testing-library/dom | npm | 2026-08 / 2026-09 | 41.6M / 50.1M | testing-library | OK | Approved |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** wrangler, @cloudflare/vite-plugin, @cloudflare/vitest-plugin, vitest, react, react-dom, vite, @vitejs/plugin-react, zod, happy-dom — 모두 사유가 `too-new` 하나뿐이다(해당 **버전**이 최근 게시됨; 이 패키지들은 수년간 운영되는 공식 조직 패키지이고 주간 다운로드가 수백만~억 단위, `scripts.postinstall` 없음 [VERIFIED: `npm view <pkg> scripts.postinstall` 전부 빈 값]). 위험은 낮다고 판단하지만 프로토콜대로 **planner 는 설치 직전에 `checkpoint:human-verify` 를 한 번 넣는다**(패키지별이 아니라 "위 SUS 목록 일괄 확인" 한 개로 충분. 확인 방법: 정확한 버전으로 고정하고 `package-lock.json` 을 커밋, 필요하면 한 단계 이전 패치로 낮춤).

패키지 이름은 모두 공식 문서(Cloudflare·Vite·Vitest·React)에서 발견했다. `partyserver`, `agents`, `hono`, `vite-plugin-pwa` 는 대안 검토용으로만 언급했고 설치하지 않는다.

## Architecture Patterns

### System Architecture Diagram

```
[폰 브라우저 (React SPA)]
   │ ① GET /, /r/1234  ──────────────▶ [Workers Static Assets]  (에셋 우선 서빙, 없는 경로는 index.html 로 SPA 폴백)
   │
   │ ② POST /api/rooms {nickname}      ─┐
   │    GET  /api/rooms/1234 (미리보기)  │  run_worker_first: ["/api/*"]
   │    POST /api/rooms/1234/join        ├──▶ [Worker 진입점] ── 경로 분기 ─▶ env.ROOM.getByName("1234")
   │         {nickname}                 ─┘                                       │  (DO RPC: createRoom / preview / join)
   │                                                                             ▼
   │ ③ WS  /api/rooms/1234/ws  ───────────────────────────────▶ [Room Durable Object — 방 하나 = DO 하나]
   │    → {t:"hello", token}                                       ├─ 생성자: storage.get("room") 복구 → 연결 상태 보정
   │    → {t:"ping", c}  / ← {t:"pong", c, serverNow}              ├─ 메시지/HTTP/알람 모든 진입: tick(state, now)
   │    → {t:"start"} {t:"leave"} {t:"kick", seat}                 │     → 순수 코어(shared/game): 규칙·역할배정·단계표
   │                                                               ├─ 변경 시: storage.put("room") → 알람 재설정(단계 마감/만료 중 빠른 것)
   │    ← {t:"state", view}  (연결마다 buildView(state, playerId)) ◀┤─ 방송: getWebSockets() 각각의 attachment.playerId 로 개별 뷰 생성
   │    ← {t:"error", code}                                        └─ alarm(): tick → 방송 → 다음 알람/만료 시 deleteAll
   ▼
[클라이언트 상태: 서버 스냅샷 1개 + 시계 오프셋 + 재연결 백오프]
   └─ 화면 = f(view.phase): lobby / assigning / roleReveal / day  (+ 공통 [내 역할] 버튼, 공통 Timer 부품)
```

### Recommended Project Structure
```
minifia/
├── index.html                  # OG 메타(제목·설명), viewport-fit=cover
├── vite.config.ts              # react() + cloudflare({ viteEnvironment:{ name:"worker" } })
├── wrangler.jsonc              # name 고정(URL 유지), assets, durable_objects.bindings, exports
├── vitest.config.ts            # projects: unit(node) / client(happy-dom) / worker(cloudflareTest)
├── tsconfig.app.json           # lib DOM, include src+shared+test/unit+test/client
├── tsconfig.worker.json        # lib ES2022(no DOM), include worker+shared+worker-configuration.d.ts+test/worker
├── worker-configuration.d.ts   # `wrangler types` 생성물 (gitignore, 스크립트로 생성)
├── shared/                     # ★ 서버·클라이언트 공용 (DOM/workerd 전용 API 금지)
│   ├── protocol.ts             # zod 스키마(서버가 value import) + 타입(클라이언트는 import type)
│   ├── game/
│   │   ├── phases.ts           # PHASE_DEFS 표, PhaseId
│   │   ├── roles.ts            # ROLE_TABLE(4~8), assignRoles(players, rng)
│   │   ├── room.ts             # RoomState, join/leave/kick/start 순수 전이, canStart
│   │   ├── tick.ts             # tick(state, now)
│   │   └── view.ts             # buildView(state, playerId, now) → RoomView
│   ├── nickname.ts             # normalizeNickname / validateNickname (Intl.Segmenter)
│   └── seatLayout.ts           # 내 자리를 맨 아래로 돌리는 좌표 계산(순수)
├── worker/
│   ├── index.ts                # fetch 라우팅 + export { Room }
│   └── room.ts                 # class Room extends DurableObject<Env> (얇은 어댑터)
├── src/                        # React 앱
│   ├── main.tsx, App.tsx       # URL(/, /r/:code) 분기
│   ├── net/                    # useRoomConnection(재연결), clock.ts(오프셋), session.ts(localStorage)
│   ├── screens/                # Home, JoinByLink, Lobby, Assigning, RoleReveal, Day
│   ├── components/             # Table(그리기 전용), Seat/Figure, Timer, RoleCard, MyRoleButton, ShareButton
│   └── styles/                 # 토큰(색), 애니메이션 CSS
├── scripts/smoke.mjs           # Node 내장 WebSocket 으로 N명 접속 E2E (로컬/배포 주소 공용)
└── test/{unit,client,worker}/
```

### Pattern 1: 순수 코어 + 얇은 DO 어댑터 (TDD 핵심)
**What:** 규칙·단계·뷰를 `(state, input, now, rng) → newState` 형태의 순수 함수로 두고 DO는 저장·소켓·알람만 담당한다.
**When to use:** 이 페이즈 전체. 이후 페이즈(밤·투표)가 같은 틀에 단계를 추가한다.
**Why:** DO 안의 로직은 workerd 테스트가 필요하지만, 순수 코어는 Node에서 수 ms로 돈다. 알려진 제약(DO+WebSocket 테스트는 격리 설정에 민감, 아래 Pitfall 7)도 코어 테스트에는 영향이 없다.
**Example:**
```typescript
// shared/game/phases.ts  (D-02, D-03: 직업 공개 같은 후속 단계는 미리 넣지 않는다)
export type PhaseId = "lobby" | "assigning" | "roleReveal" | "day";
export interface PhaseDef { durationMs: number | null; next: PhaseId | null }
export const PHASE_DEFS = {
  lobby:      { durationMs: null,   next: null },          // 시작은 이벤트로만 빠져나간다
  assigning:  { durationMs: 3_000,  next: "roleReveal" },  // 요구사항: 역할 배정 약 3초
  roleReveal: { durationMs: 15_000, next: "day" },         // 요구사항: 역할 확인 15초
  day:        { durationMs: null,   next: null },          // 1페이즈는 여기서 멈춘다 (D-02)
} as const satisfies Record<PhaseId, PhaseDef>;

// shared/game/tick.ts — 모든 진입점(메시지·HTTP·알람)에서 먼저 호출. 멱등, 늦은 알람도 따라잡는다.
export function tick(s: RoomState, now: number): RoomState {
  let cur = s;
  while (cur.phaseEndsAt !== null && now >= cur.phaseEndsAt) {
    const nextId = PHASE_DEFS[cur.phase].next;
    if (nextId === null) break;
    const dur = PHASE_DEFS[nextId].durationMs;
    // 마감 시각은 "이전 마감 + 길이"로 연쇄 → 알람 지연이 누적되지 않고 모든 폰이 같은 마감을 본다
    cur = { ...cur, phase: nextId, phaseEndsAt: dur === null ? null : cur.phaseEndsAt + dur };
  }
  return cur;
}
```
[ASSUMED 설계안 — 구조는 이 연구의 권고. 알람 의미론은 공식 문서로 확인: 알람은 DO당 하나, at-least-once, 멱등이어야 함 (developers.cloudflare.com/durable-objects/api/alarms/ , .../best-practices/rules-of-durable-objects/)]

### Pattern 2: 연결별 필터링 스냅샷 방송 (ROLE-02)
**What:** 변경이 있을 때마다 `ctx.getWebSockets()` 의 각 소켓에서 `deserializeAttachment()` 로 `playerId` 를 읽고 그 사람의 `buildView` 결과만 보낸다. 공개 필드 허용 목록 방식이라 실수로 `role` 이 섞이기 어렵다.
**Example:**
```typescript
// shared/game/view.ts
export interface PublicPlayer { seat: number; nickname: string; connected: boolean; isHost: boolean }
export interface RoomView {
  code: string; phase: PhaseId; phaseEndsAt: number | null; serverNow: number;
  minPlayers: 4; maxPlayers: 8;
  players: PublicPlayer[];                       // ← role/token/playerId 필드 자체가 타입에 없다
  me: { seat: number; role?: RoleId; allies?: number[] };  // role 은 roleReveal 이후만, allies 는 마피아에게만 (동료 seat 번호)
}
export function buildView(s: RoomState, playerId: string, now: number): RoomView {
  const me = s.players.find((p) => p.id === playerId)!;
  const revealed = s.phase === "roleReveal" || s.phase === "day";
  return {
    code: s.code, phase: s.phase, phaseEndsAt: s.phaseEndsAt, serverNow: now, minPlayers: 4, maxPlayers: 8,
    players: s.players.map((p) => ({ seat: p.seat, nickname: p.nickname, connected: p.connected, isHost: p.id === s.hostId })),
    me: {
      seat: me.seat,
      ...(revealed && me.role ? { role: me.role } : {}),
      ...(revealed && me.role === "mafia"
        ? { allies: s.players.filter((p) => p.role === "mafia" && p.id !== me.id).map((p) => p.seat) }
        : {}),
    },
  };
}

// worker/room.ts — 방송
#broadcast() {
  const now = Date.now();
  for (const ws of this.ctx.getWebSockets()) {
    const att = ws.deserializeAttachment() as { playerId: string; connId: string } | null;
    if (!att) continue;                            // 아직 hello 전인 소켓에는 아무것도 보내지 않는다
    ws.send(JSON.stringify({ t: "state", view: buildView(this.#s!, att.playerId, now) }));
  }
}
```
**공개 식별자는 `seat` 번호**다(안정적이고 역할과 무관). 내부 `playerId`·`token` 은 다른 사람에게 가는 어떤 메시지에도 넣지 않는다. 이후 페이즈의 투표·지목도 `seat` 로 대상을 가리키면 된다. `[ASSUMED: 설계 권고]`

### Pattern 3: 영속화 = 단일 키 스냅샷 + 생성자 복구 + 연결 상태 보정
**What:** 방 상태 전체(≤ 수 KB)를 `ctx.storage.put("room", state)` 한 키에 쓰고, 생성자의 `blockConcurrencyWhile` 에서 읽어 `this.#s` 에 캐시한다. 생성자는 하이버네이션에서 깨어날 때마다 다시 실행되므로, **살아 있는 소켓 목록으로 `connected` 를 다시 계산**한다(배포·크래시로 소켓이 사라졌는데 저장값이 `true` 로 남는 문제 방지).
**Example:**
```typescript
constructor(ctx: DurableObjectState, env: Env) {
  super(ctx, env);
  ctx.blockConcurrencyWhile(async () => {
    this.#s = (await ctx.storage.get<RoomState>("room")) ?? null;
    if (this.#s) {
      const live = new Set(ctx.getWebSockets().map((w) => (w.deserializeAttachment() as { playerId: string } | null)?.playerId));
      this.#s = { ...this.#s, players: this.#s.players.map((p) => ({ ...p, connected: live.has(p.id) })) };
    }
  });
}
```
KV API는 SQLite 백엔드 DO에서도 동작하며 빈 방을 "조회"만 해도 쓰기가 생기지 않는다(스키마 `CREATE TABLE` 불필요) [CITED: developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/ "The KV API (`ctx.storage.get`/`put`) also works on SQLite DOs"]. Free 플랜은 SQLite 백엔드 DO만 허용 [CITED: developers.cloudflare.com/durable-objects/platform/pricing/].

### Pattern 4: 알람 하나로 단계 마감 + 방 만료 다중화
DO당 알람은 하나이고 `setAlarm` 은 기존 알람을 덮어쓴다 [CITED: developers.cloudflare.com/durable-objects/api/alarms/]. 그러므로 `nextWakeAt = min(phaseEndsAt ?? ∞, expiresAt)` 를 매 변경 뒤 한 곳(`#reschedule()`)에서 계산해 `setAlarm`. `alarm()` 은 (1) 만료됐으면 `deleteAlarm()` 후 `deleteAll()`, (2) 아니면 `tick` → 영속화 → 방송 → `#reschedule()`. 핸들러에서 예외를 잡아 재설정하지 않으면 6번 재시도 후 알람이 영영 멈춘다 [CITED: 같은 페이지]. 생성자에서 무조건 `setAlarm` 하지 말 것(대기 중 알람을 덮어씀).

### Pattern 5: 서버 시계 오프셋 + 마감 시각 기반 카운트다운
서버 메시지마다 `serverNow` 를 싣고, 접속 직후 `ping{c}`/`pong{c,serverNow}` 를 3~5회 교환해 RTT가 가장 작은 표본으로 오프셋을 정한다. 이후 남은 시간 = `phaseEndsAt - (Date.now() + offset)`. 마감 시각 기반이라 탭이 백그라운드였다 돌아와도 드리프트가 없다.
```typescript
// src/net/clock.ts — 순수 함수, fake timer 없이도 테스트 가능
export interface Sample { t0: number; t1: number; serverNow: number }   // t0 보낸 시각, t1 받은 시각 (Date.now)
export function estimateOffset(samples: Sample[]): number {
  const best = samples.reduce((a, b) => (b.t1 - b.t0 < a.t1 - a.t0 ? b : a));
  return best.serverNow + (best.t1 - best.t0) / 2 - best.t1;            // 서버시각 - 클라이언트시각
}
export const remainingMs = (deadline: number, offset: number, localNow = Date.now()) =>
  Math.max(0, deadline - (localNow + offset));
```
`[ASSUMED: NTP류 표준 기법, 공식 문서 인용 없음]`. 화면 전환 자체는 서버가 푸시한 `state` 를 받을 때 일어나므로 폰 간 편차는 대략 네트워크 지연 차이(수십~수백 ms) 수준이다 — "같은 시각"의 허용 오차로 계획에 명시할 것(Open Question 5).

### Pattern 6: 방 만들기·참가를 HTTP(RPC)로, 실시간은 WS `hello{token}` 으로
`POST /api/rooms {nickname}` → Worker가 4자리 코드 생성 → `env.ROOM.getByName(code).createRoom(nickname)` (DO RPC, 이미 쓰는 중이면 `{ok:false,code:"CODE_TAKEN"}` → 다른 코드로 최대 N회 재시도) → 응답 `{code, token}`. 방장 플레이어와 토큰이 **방 생성과 원자적으로** 만들어져 "첫 접속자가 방장" 경쟁이 없다. 참가도 `POST /api/rooms/:code/join {nickname}` → `{token}` 또는 HTTP 4xx + `{error: "ROOM_FULL" | ...}`(D-07 문구 매핑). 그 뒤 클라이언트가 WS를 열고 첫 메시지로 `hello{token}`. 토큰을 URL 쿼리에 넣지 않는 이유는 요청 URL이 로그에 남기 때문이다. `[ASSUMED: 설계 권고]` 단점: HTTP join 직후 WS 연결 전까지 잠깐 `connected=false`(흐릿) — 화면상 거의 안 보이는 시간이며 D-10 등장 애니메이션과 자연스럽게 겹친다.
DO RPC 호출(`stub.method()`)은 공식 시작 가이드의 방식이다 [CITED: developers.cloudflare.com/durable-objects/get-started/].

### Pattern 7: 자리 배치 순수 함수 (D-09, D-22)
```typescript
// shared/seatLayout.ts — 내 자리가 항상 맨 아래 가운데. 반환값은 퍼센트 좌표/스케일/z-index
export function seatLayout(seat: number, mySeat: number, total = 8, rx = 40, ry = 22) {
  const slot = (seat - mySeat + total) % total;                 // 0 = 나
  const theta = Math.PI / 2 + (slot / total) * Math.PI * 2;     // 화면 좌표(y 아래쪽 +)에서 90° = 맨 아래
  const depth = (Math.sin(theta) + 1) / 2;                      // 0(맨 뒤) ~ 1(맨 앞)
  return { x: 50 + rx * Math.cos(theta), y: 50 + ry * Math.sin(theta), scale: 0.62 + 0.38 * depth, z: Math.round(depth * 10) };
}
```
`<Table>`/`<Seat>`/`<Figure>` 는 `PublicPlayer[]` + `me` 만 props 로 받는 순수 표현 컴포넌트로 만들어 5페이즈에서 `<Figure>` 내부만 PNG 로 교체한다. 입체감은 CSS(타원 `radial-gradient` 조명, `filter: drop-shadow`, 뒤→앞 `z-index`)로 내고 3D 라이브러리는 쓰지 않는다(D-23). `transform`/`opacity` 만 애니메이션하고 `prefers-reduced-motion` 을 존중한다. 정확한 값(rx, ry, 스케일 범위)은 UI 계약(ui-phase)에서 정한다.

### Anti-Patterns to Avoid
- **클라이언트에서 역할을 숨기는 방식**: 모든 역할을 보내고 CSS/상태로 가리기 — 프로젝트 불변식 위반.
- **`players[]` 에 `role` 필드를 넣고 `undefined` 로 비우기**: 타입에서부터 공개 타입(`PublicPlayer`)과 내부 타입(`Player`)을 분리해 컴파일 시점에 막는다.
- **인메모리 필드를 진실로 쓰기**: 하이버네이션/배포/크래시에서 사라진다. 변경마다 `put` 후 방송.
- **`setTimeout`/`setInterval` 로 단계 타이머 구현**: DO가 하이버네이션되면 날아간다. 알람 + 마감 시각 사용.
- **`ws.accept()` 사용**: 하이버네이션이 불가능하고 연결 시간 내내 과금. `ctx.acceptWebSocket(server)` 사용 [CITED: developers.cloudflare.com/durable-objects/best-practices/websockets/].
- **클라이언트→서버 메시지를 검증 없이 신뢰**: 모든 프레임은 길이 상한 → JSON 파싱 → zod 로 검증, 실패는 무시/오류 응답.
- **연결 상태를 `ws` 객체에만 두기**: `connected` 는 영속 상태(공개 정보, D-18)이고 소켓은 첨부로 `playerId` 에 매핑.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Worker+DO+정적 에셋 개발/빌드 파이프라인 | 자체 esbuild/rollup + 수동 에셋 업로드 스크립트 | `@cloudflare/vite-plugin` + `wrangler deploy` | 출력(`dist/client`, `dist/worker/wrangler.json`)과 리다이렉트 구성을 플러그인이 만든다 |
| DO 테스트 하네스(알람 실행, eviction, 스텁) | 알람 시간을 흉내 내는 가짜 타이머 | `cloudflare:test` 의 `runDurableObjectAlarm`, `evictDurableObject`, `runInDurableObject` | 실제 workerd 에서 하이버네이션/알람 경로를 그대로 태운다 (스파이크로 확인) |
| 하이버네이션 가능한 WebSocket 관리 | 소켓을 `Map` 에 직접 보관 | `ctx.acceptWebSocket` + `getWebSockets()` + `serializeAttachment` | 인메모리 맵은 깨어날 때 비어 있다. 첨부는 소켓과 함께 살아남음 (16,384바이트 상한) |
| 메시지 스키마 검증 | `typeof` 체인 | zod `discriminatedUnion("t", ...)` | 입력 검증은 ASVS V5, 스키마에서 타입이 자동 파생 |
| 문자열 길이(닉네임 1~8자) | `.length` | `Intl.Segmenter` grapheme 개수 (workerd·Node 모두 동작 확인) | 이모지·결합 문자에서 `.length` 는 틀린다. 중복 비교는 `normalize("NFC")` + 소문자화 |
| 난수(역할 셔플·토큰·방 코드) | `Math.random()` | `crypto.getRandomValues` / `crypto.randomUUID()` | 토큰 추측 불가(≥128bit) 필요. 셔플은 Fisher–Yates + 편향 없는 정수 추출, RNG 주입으로 테스트 가능 |
| 공유 | 자체 공유 UI | `navigator.share` → 실패/미지원 시 `navigator.clipboard.writeText` → 최후 수단 입력창에 링크 표시 | 아래 Pitfall 6 |
| 카카오톡 공유 SDK | 카카오 JS SDK | OG 메타 태그 + Web Share(시트에서 카카오톡 선택) | SDK는 카카오 앱 등록·도메인 등록 필요. 이 페이즈에서 과함 |

**Key insight:** 이 페이즈의 복잡성은 라이브러리 부족이 아니라 "상태 공개 경계"와 "하이버네이션 생애주기"에 있다. 둘 다 순수 함수 + 허용 목록 타입으로 눌러 두면 이후 페이즈(밤·투표)도 같은 틀을 재사용한다.

## Common Pitfalls

### Pitfall 1: `compatibility_date` 를 "오늘"로 쓰면 로컬 `vite dev` 가 뜨지 않는다
**What goes wrong:** `compatibility_date: "2026-10-21"` 로 두면 `vite dev` 가 `ERR_RUNTIME_FAILURE` — `This Worker requires compatibility date "2026-10-21", but the newest date supported by this server binary is "2026-10-19"` (실제 스파이크 출력; 2026-10-12 로 낮추자 정상).
**Why it happens:** `@cloudflare/vite-plugin` 1.64.0 이 끌고 오는 miniflare/workerd(`workerd@1.20261012.1`)가 vitest 플러그인·wrangler 의 workerd(`1.20261019.1`)보다 오래됐다. 문서 예시는 "오늘 날짜로 설정"이라 안내하지만 로컬 바이너리가 따라가지 못할 수 있다.
**How to avoid:** `compatibility_date` 를 설치된 workerd가 지원하는 날짜로 **고정**(권장 `2026-10-12`). 단 새 동작 플래그의 기준일(예: WebSocket 자동 close 응답은 2026-04-07 이후)보다 뒤여야 한다 — 2026-10-12 는 충족. 의존성을 올릴 때 `npm ls workerd miniflare` 로 확인하고 필요하면 날짜를 올린다.
**Warning signs:** `vite dev` 시작 시 workerd 오류 로그, 또는 `vitest` 와 `vite dev` 에서 결과가 다름.

### Pitfall 2: 하이버네이션 후 인메모리 상태·`connected` 플래그가 틀어진다
**What goes wrong:** 클래스 필드(`this.players`)에 상태를 두면 DO가 깨어날 때 비어 있다. 배포·크래시 뒤에는 저장된 `connected=true` 가 남아 있는데 소켓은 없다.
**How to avoid:** Pattern 3 (단일 키 영속 + 생성자에서 소켓 기준으로 `connected` 재계산). 소켓 첨부(`playerId`)는 하이버네이션을 넘어 살아남지만 연결이 닫히면 사라진다 [CITED: .../websockets/].
**Warning signs:** 재접속 후 자리는 맞는데 "흐릿함" 표시가 틀림. `evictDurableObject` 후 테스트가 실패.

### Pitfall 3: 같은 사람이 탭 2개/재접속으로 소켓이 둘이 되면 낡은 소켓의 close 가 `connected=false` 로 덮어쓴다
**How to avoid:** 첨부에 `{playerId, connId}`, 플레이어 레코드에 최신 `connId` 저장. 새 `hello` 가 오면 이전 소켓을 닫고(`ws.close(4001, "replaced")`) `connId` 갱신. `webSocketClose` 에서 닫힌 소켓의 `connId` 가 최신일 때만 `connected=false`. (플레이어 토큰을 쓰는 새 기기가 기존 세션을 끊는 것이 의도된 동작임을 계획에 적어 둔다.)

### Pitfall 4: 알람 하나뿐인데 두 용도로 쓰다 서로 덮어쓴다
**How to avoid:** Pattern 4(단일 `#reschedule()`). 알람 핸들러는 멱등이어야 하고(at-least-once), 예외 시 재설정한다 [CITED: .../alarms/]. 방 만료를 구현하지 않으면 빈 방 DO 가 영원히 남는다 → 생성 시 +3시간, 게임 시작 시 +3시간으로 갱신(`ROOM_TTL_MS`, 재량; `[ASSUMED]`).

### Pitfall 5: `wrangler deploy` 시 DO 클래스 이름·선언을 바꾸면 되돌릴 수 없다
`exports` 로 배포하면 `migrations` 로 돌아갈 수 없고, 클래스를 삭제하면 데이터가 지워진다 [CITED: .../durable-objects-migrations/]. 클래스 이름(`Room`)과 Worker `name`(= workers.dev 주소)은 첫 배포 전에 확정한다. 정식 이름·도메인은 아직 미정(LAUNCH-01/02)이므로 코드명(`minifia`)을 쓰되 `name` 을 바꾸면 주소가 바뀐다는 점을 HANDOFF에 적는다. 배포하면 기존 DO 인스턴스가 재시작되며 소켓이 끊길 수 있으므로(`[ASSUMED]`) 클라이언트 자동 재접속이 배포 직후 사용자 경험을 지켜 준다.

### Pitfall 6: 공유 버튼이 LAN 개발(HTTP)에서 조용히 죽는다
`navigator.share` 와 `navigator.clipboard` 는 보안 컨텍스트(HTTPS)에서만 존재한다 [CITED: developer.mozilla.org Navigator/share, Clipboard/writeText]. 같은 Wi-Fi 폰에서 `http://192.168.x.x:5173` 으로 열면 둘 다 `undefined`(스파이크로 `vite dev --host` 가 LAN HTTP 200·WS 연결은 확인했고, 보안 컨텍스트 부재는 사양에서 파생). 또 `share()` 는 사용자 제스처 안에서만 호출 가능, 취소 시 `AbortError` 를 던진다.
**How to avoid:** `shareRoom()` 을 `navigator` 를 주입받는 함수로 만들어 단위 테스트: ① `navigator.canShare?.({url})` 이면 `share`, `AbortError` 는 무시 ② 아니면 `clipboard.writeText` ③ 그것도 없으면 링크 문자열을 선택 가능한 입력창으로 보여 줌. 최종 카카오톡 공유 확인은 배포(HTTPS) 주소에서 실제 폰으로(수동 UAT).

### Pitfall 7: DO + WebSocket 통합 테스트가 격리 설정에 민감하다
공식 known-issues: "WebSockets with Durable Objects is not supported with per-file storage isolation. ... run your tests with shared storage using `--max-workers=1 --no-isolate`" (docs.cloudflare.com 사본) / 옛 사본은 `isolatedStorage: false`. [CITED: developers.cloudflare.com/workers/testing/vitest-integration/known-issues/]. **그러나 스파이크(vitest 4.1.12 + plugin 1.4.6, 기본 설정)에서는** `exports.default.fetch` 로 WS 업그레이드 → 메시지 왕복 → `evictDurableObject` 후 첨부 유지 → 알람 `runDurableObjectAlarm` 이 2개 파일 병렬로도 통과했다 [VERIFIED: 스파이크].
**How to avoid:** 그래도 안전망으로 ① 규칙은 순수 코어에서 검증, DO 테스트는 "배선"만 ② 테스트마다 서로 다른 방 코드 사용 ③ 알람은 격리를 따르지 않으므로 테스트가 끝나기 전에 `runDurableObjectAlarm` 하거나 삭제 ④ 불안정해지면 해당 프로젝트만 `--max-workers=1 --no-isolate`. 동적 `import()` 는 DO 핸들러 안에서 실패하므로 정적 import만 쓴다.

### Pitfall 8: iOS Safari에서 화면 잠금 후 "열려 있는 척하는" 소켓
화면이 꺼지면 소켓이 끊기고(문서화된 제약) 복귀 시 `readyState` 가 OPEN으로 남은 좀비 소켓일 수 있다 `[ASSUMED]`. **How to avoid:** `visibilitychange`(visible)/`pageshow`/`online` 에서 즉시 `ping` 을 보내 2~3초 안에 `pong` 이 없으면 소켓을 닫고 재연결(지수 백오프 + 지터, `hello{token}` 재전송). React StrictMode 는 개발에서 effect 를 두 번 실행하므로 effect 정리에서 반드시 소켓을 닫고, 연결 로직은 멱등하게.

### Pitfall 9: 서버가 연결 끊김을 늦게 안다 (죽은 피어)
브라우저 탭 종료·네트워크 단절 시 하이버네이션 중인 소켓의 `webSocketClose` 가 오지 않던 버그(workerd #1187)는 2023-09-19 수정·배포 완료로 종료됐다 [CITED: github.com/cloudflare/workerd/issues/1187]. 하지만 비행기 모드처럼 TCP가 조용히 끊기는 경우는 close 이벤트가 늦을 수 있다 `[ASSUMED]`. 대기실의 흐릿함(D-16)은 "close 이벤트 + 클라이언트 `leave`/beforeunload 시 `ws.close()`"로 우선 구현하고, 정밀 감지(하트비트 `lastSeen` + 알람 청소)는 Open Question 2.

### Pitfall 10: [내 역할] 길게 누르기가 iOS 기본 동작에 가로채인다
`pointerdown`/`pointerup`/`pointercancel`/`pointerleave` 로 "누르고 있는 동안만" 표시하되, iOS 길게 누르기의 텍스트 선택·콜아웃·컨텍스트 메뉴가 끼어든다 → `-webkit-touch-callout: none; user-select: none; touch-action: manipulation` 와 `contextmenu` 이벤트 `preventDefault`. 카드를 뗄 때 즉시 숨기기(`pointercancel` 포함) — 화면 녹화·캡처는 막을 수 없다는 점은 설계상 수용(모든 사람에게 같은 버튼, D-19).

### Pitfall 11: 카카오톡 미리보기 캐시와 `og:url`
카카오 스크랩은 약 1시간 캐시되고 디버거에서 초기화할 수 있으며, 스크랩 가능한 이미지는 JPG/PNG, `og:url` 이 실제 주소와 다르면 `og:url` 쪽 정보를 읽는다 [CITED: devtalk.kakao.com 스크랩 FAQ 검색 결과]. `/r/:code` 도 같은 `index.html` 을 받으므로 OG는 모든 방 링크에서 동일하다 → **`og:url` 은 넣지 않는다**. 이미지는 절대 URL이 필요하므로 주소(workers.dev)가 정해진 뒤 추가하거나 이 페이즈에서는 제목·설명만 둔다(재량). 방별 문구("○○님의 방")는 `navigator.share` 의 `text` 로 보낸다.

### Pitfall 12: 닉네임 비교·표시
`" 철수"`/`"철수"`, NFC/NFD, 대소문자 차이로 중복 검사를 우회할 수 있다. `trim` + `normalize("NFC")` + 공백 압축 후 grapheme 1~8, 제어문자·줄바꿈 거부, 중복 비교는 소문자화한 정규형. React 텍스트 렌더링은 자동 이스케이프(`dangerouslySetInnerHTML` 금지). 클라이언트와 서버가 **같은 `shared/nickname.ts`** 를 쓴다.

## Code Examples

### wrangler.jsonc (스파이크에서 빌드·dry-run·vitest 통과한 형태 + `exports` 변형도 통과)
```jsonc
// Source: developers.cloudflare.com/workers/framework-guides/web-apps/react/ , .../durable-objects/reference/durable-objects-migrations/
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "minifia",                       // 바꾸면 workers.dev 주소가 바뀐다
  "compatibility_date": "2026-10-12",      // Pitfall 1: 설치된 workerd 지원 날짜 이하로 고정
  "main": "./worker/index.ts",
  "upload_source_maps": true,
  "assets": {
    "not_found_handling": "single-page-application",   // /r/1234 → index.html (스파이크: HTTP 200 확인)
    "run_worker_first": ["/api/*"]                      // /api/* 는 Worker가 먼저 (스파이크: 없는 API는 Worker의 404)
  },
  "durable_objects": { "bindings": [{ "name": "ROOM", "class_name": "Room" }] },
  "exports": { "Room": { "type": "durable-object", "storage": "sqlite" } }
  // 대안(구방식): "migrations": [{ "tag": "v1", "new_sqlite_classes": ["Room"] }]  — exports 와 동시 사용 불가
}
```

### vite.config.ts
```typescript
// Source: developers.cloudflare.com/workers/framework-guides/web-apps/react/
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
export default defineConfig({
  plugins: [react(), cloudflare({ viteEnvironment: { name: "worker" } })],
  environments: { worker: { build: { sourcemap: true } } },
});
```

### vitest.config.ts — 세 프로젝트 (스파이크: unit/worker 통과, happy-dom 컴포넌트 테스트 통과)
```typescript
// Source: developers.cloudflare.com/workers/testing/vitest-integration/write-your-first-test/ + 스파이크
import { cloudflareTest } from "@cloudflare/vitest-plugin";
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    projects: [
      { test: { name: "unit", environment: "node", include: ["test/unit/**/*.test.ts"] } },        // shared/ 순수 코어
      { test: { name: "client", environment: "happy-dom", include: ["test/client/**/*.test.{ts,tsx}"] } },
      {
        plugins: [cloudflareTest({ wrangler: { configPath: "./wrangler.jsonc" } })],
        test: { name: "worker", include: ["test/worker/**/*.test.ts"] },                            // workerd 안
      },
    ],
  },
});
```
`test/worker/tsconfig` 또는 `tsconfig.worker.json` 의 `types` 에 `"@cloudflare/vitest-plugin/types"` (`cloudflare:test`, `cloudflare:workers` 타입).

### DO 통합 테스트 — WS 왕복 · eviction · 알람 (스파이크에서 통과한 코드)
```typescript
import { env, exports } from "cloudflare:workers";
import { evictDurableObject, runDurableObjectAlarm } from "cloudflare:test";

async function connect(code: string) {
  const res = await exports.default.fetch(`http://x/api/rooms/${code}/ws`, { headers: { Upgrade: "websocket" } });
  expect(res.status).toBe(101);
  const ws = res.webSocket!; ws.accept(); return ws;
}
const next = (ws: WebSocket) => new Promise<string>((r) => ws.addEventListener("message", (e) => r(e.data as string), { once: true }));

it("하이버네이션(eviction) 뒤에도 첨부가 살아 있다", async () => {
  const ws = await connect("1234");
  ws.send("hi"); const a = JSON.parse(await next(ws));
  await evictDurableObject(env.ROOM.getByName("1234"));           // 기본값: webSockets "hibernate"
  ws.send("hi"); expect(JSON.parse(await next(ws)).you).toBe(a.you);
});
it("알람이 단계를 넘기고 방송한다", async () => {
  /* ... stub = env.ROOM.getByName(code); const p = next(ws); expect(await runDurableObjectAlarm(stub)).toBe(true); */
});
```
(위 스파이크 라우트는 `/api/room/:code/ws`; 실제 구현은 `/api/rooms/:code/ws`.) `runDurableObjectAlarm` 은 **현재 시각이 아니라 예약된 알람을 즉시 실행**한다 — 시간 의존 로직은 순수 `tick(state, now)` 에서 `now` 를 주입해 검증하고, DO 테스트에서는 `runInDurableObject` 로 `phaseEndsAt` 를 과거로 당겨 두거나 알람 실행 후 상태를 확인하는 식으로 배선만 본다.

### 역할 구성표와 배정 (ROLE-01)
```typescript
// shared/game/roles.ts — 구성표는 한 곳. 값은 REQUIREMENTS.md:36 에서 그대로 옮김:
// "4명: 마피아 1·경찰 1·의사 0·시민 2 / 5명: 1·1·1·2 / 6명: 2·1·1·2 / 7명: 2·1·1·3 / 8명: 2·1·1·4"
export type RoleId = "mafia" | "police" | "doctor" | "citizen";
export const ROLE_TABLE: Record<number, Record<RoleId, number>> = {
  4: { mafia: 1, police: 1, doctor: 0, citizen: 2 },
  5: { mafia: 1, police: 1, doctor: 1, citizen: 2 },
  6: { mafia: 2, police: 1, doctor: 1, citizen: 2 },
  7: { mafia: 2, police: 1, doctor: 1, citizen: 3 },
  8: { mafia: 2, police: 1, doctor: 1, citizen: 4 },
};
export function assignRoles(playerIds: string[], randInt: (n: number) => number): Map<string, RoleId> {
  const comp = ROLE_TABLE[playerIds.length]; if (!comp) throw new Error("unsupported player count");
  const pool = (Object.entries(comp) as [RoleId, number][]).flatMap(([r, n]) => Array<RoleId>(n).fill(r));
  for (let i = pool.length - 1; i > 0; i--) { const j = randInt(i + 1); [pool[i], pool[j]] = [pool[j], pool[i]]; }  // Fisher–Yates
  return new Map(playerIds.map((id, i) => [id, pool[i]]));
}
// randInt 은 서버에서 crypto.getRandomValues 기반(거부 샘플링으로 편향 제거), 테스트에서는 시드 RNG 주입
```
(`RoleId` 문자열 값 `"mafia" | "police" | "doctor" | "citizen"` 은 이 연구가 제안하는 식별자이며 기존 코드에 정의된 값이 아니다 — 계획에서 확정. 화면 문구(마피아·경찰·의사·시민)는 별도 매핑.)

### Node 내장 WebSocket 스모크 (로컬 `vite dev` 와 배포 주소 공용)
```javascript
// scripts/smoke.mjs — Node 22+ 전역 WebSocket (스파이크: Node 26 에서 vite dev 에 접속 확인)
const base = process.argv[2] ?? "http://localhost:5173";
// 1) POST /api/rooms  2) N명 POST join  3) 각자 ws 열고 hello  4) 방장 start  5) 모든 프레임을 수집
// 6) 각 클라이언트 프레임에서 players[*] 키 ⊆ {seat,nickname,connected,isHost} 이고 role 문자열은 own me.role 뿐임을 단언
// 7) ~18초 뒤 모든 클라이언트가 phase === "day" 이고 phaseEndsAt 이 동일했는지 확인
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@cloudflare/vitest-pool-workers` (`defineWorkersConfig`) | `@cloudflare/vitest-plugin` (`cloudflareTest` 플러그인), 코드모드 `npx @cloudflare/codemods vitest:pool-workers-to-vitest-plugin` | 패키지 이름 변경(1.x), 구 패키지는 갱신 중단 | 옛 블로그/예제의 import 를 그대로 쓰면 안 됨 |
| DO 선언: `migrations` + `new_sqlite_classes` | `exports: { Room: { type:"durable-object", storage:"sqlite" } }` | 2026년 (현재 문서의 기본) | 둘은 병용 불가, 한 번 `exports` 로 가면 복귀 불가 |
| `ws.close()` 를 `webSocketClose` 안에서 필수 호출 | 호환 날짜 2026-04-07 이상이면 런타임이 Close 프레임에 자동 응답 | 2026-04-07 | `compatibility_date` 2026-10-12 → 불필요(호출해도 안전) |
| `SELF.fetch` | `exports.default.fetch` (`cloudflare:workers`) | vitest-plugin 문서 | 테스트 코드 형태 |
| `@cloudflare/workers-types` 별도 설치 | `wrangler types` 가 런타임 타입+`Env` 생성 | 최근 | 타입 패키지 불필요 |
| 플러그인 없이 `wrangler dev` + 별도 Vite | `@cloudflare/vite-plugin` (Worker 가 Vite 환경으로 실행, HMR) | 1.x | 개발 서버 한 개로 SPA·API·WS |

**Deprecated/outdated:**
- `@cloudflare/vitest-pool-workers`: npm 에서 "renamed to @cloudflare/vitest-plugin" 로 deprecated.
- 옛 `isolatedStorage: false` 안내: 현재 문서는 `--max-workers=1 --no-isolate`. 스파이크에서는 기본 설정으로도 통과(Pitfall 7).
- TypeScript 5.x 전제의 도구 체인: TypeScript 7.0.2 가 latest 이고 이 구성에서 정상 동작. 단 ESLint(typescript-eslint) 등 컴파일러 API 의존 도구의 호환은 미확인이므로 이 페이즈에서는 린터를 도입하지 않는다.

## Runtime State Inventory

해당 없음 — 신규(greenfield) 페이즈이며 이름 변경·리팩터·이관 작업이 아니다.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 시계 오프셋은 NTP식 최소 RTT 표본(`serverNow + rtt/2 - t1`)으로 충분히 정확하다 | Pattern 5 | 카운트다운이 폰 간 수백 ms 어긋남 → 표본 수·재보정 주기 조정 |
| A2 | 방 만료 TTL 3시간(생성·시작 시 갱신) | Pitfall 4 | 너무 짧으면 진행 중 방 삭제, 너무 길면 쓰레기 DO 누적 (재량 항목, 사용자 확인 대상) |
| A3 | iOS Safari 복귀 시 OPEN 으로 보이는 좀비 소켓이 있을 수 있고 ping/pong 점검이 필요하다 | Pitfall 8 | 점검이 불필요하면 복잡도만 늘어남; 필요한데 빠지면 복귀 후 먹통 — 실제 아이폰 UAT 필요 |
| A4 | 비행기 모드 등 조용한 단절에서 `webSocketClose` 가 늦게 올 수 있다 | Pitfall 9 | 흐릿함 표시가 늦음(대기실 UX). Open Question 2 |
| A5 | `wrangler deploy` 로 DO 코드가 갱신되면 기존 소켓이 끊긴다 | Pitfall 5 | 끊기지 않으면 오히려 이득. 끊기는데 재접속이 없으면 배포 중 판이 깨짐 |
| A6 | 출력 게이트 덕에 `storage.put` 이 끝나기 전에는 `ws.send` 가 나가지 않아 "보낸 상태 = 저장된 상태" | Pattern 3 | 아니라면 방송 직전 `await put` 을 명시 |
| A7 | 카카오톡 미리보기는 정적 OG(제목·설명)로 충분하고 `og:url` 생략이 안전 | Pitfall 11 | 미리보기가 안 뜨면 OG 이미지/태그 보강 (실기기 확인 필요) |
| A8 | `RoleId`/`PhaseId`/오류 코드/메시지 이름(`hello`,`state`,`ping`...)은 이 연구의 제안값이다 | Code Examples | 확정은 계획에서. 기존 코드에는 없음(greenfield) |
| A9 | Workers Free 플랜의 DO 한도(요청 10만/일 등)로 1페이즈 테스트에 충분하다 | Environment | 한도 초과 시 유료 플랜 필요 (수치 자체는 문서 인용) |

## Open Questions

1. **자리 재사용·방장 승계 규칙 (D-09, D-16, D-17)**
   - What we know: 자리는 "들어온 순서로 고정", 나간 사람은 빈 의자, 방장 나가면 "다음으로 들어온 사람"이 방장.
   - What's unclear: 대기실에서 중간 사람이 [나가기]한 뒤 새로 오는 사람이 앉는 자리(가장 낮은 빈 자리 vs 항상 뒤쪽).
   - Recommendation: **가장 낮은 번호의 빈 자리**에 앉히고, 방장 승계는 `joinSeq`(가입 순번) 기준 다음 사람. 게임 시작 뒤에는 자리 불변. 계획에서 확정.
2. **죽은 피어 감지 정밀도**
   - What we know: close 이벤트 + 클라이언트 beforeunload 로 대부분 커버, 버그 #1187은 수정됨.
   - What's unclear: 조용한 단절의 지연. 하트비트(`lastSeen` 첨부 갱신) + 알람 청소는 비용(알람 다중화에 한 항목 추가)이 있다.
   - Recommendation: 1페이즈는 이벤트 기반만 구현하고 실기기 UAT에서 관찰, 문제면 4페이즈(CONN-02)에서 보강.
3. **`wrangler login` 과 workers.dev 서브도메인**
   - What we know: 이 Mac의 wrangler 는 미인증(`You are not authenticated`). 개인 Cloudflare 계정으로 로그인해야 한다(개인 세션 격리 규칙). 첫 배포 때 계정 workers.dev 서브도메인 등록이 필요할 수 있음 `[ASSUMED]`. 임시 배포 옵션 `wrangler deploy --temporary` 가 존재(실사용은 고정 주소가 필요해 부적합).
   - Recommendation: 첫 계획에 `checkpoint:human-action`(로그인·서브도메인) 포함. 집 Windows PC도 별도 로그인 필요(HANDOFF 환경 메모에 추가).
4. **게임 중 [나가기]**: CONTEXT 는 대기실의 나가기만 정의. 시작 뒤 나가기 버튼 유무는 미정 → 1페이즈는 시작 뒤 나가기 없음(연결 끊김만 존재)으로 두고 4페이즈에서 정한다.
5. **"모든 폰에서 같은 시각" 허용 오차**: 서버 푸시 기반 전환이라 폰 간 편차 ≈ 네트워크 지연 차이. 계획의 합격 기준을 "마감 시각 값이 모든 폰에서 동일 + 전환 편차 < 약 0.5초(실측)"로 쓸 것을 권장.
6. **OG 이미지/최종 도메인**: 정식 이름·도메인 미정 → 제목·설명만 먼저, 이미지는 주소 확정 후.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | 전부 | ✓ | v26.0.0 (wrangler `>=22`, vitest 4 `^22.12\|\|^24\|\|>=26` 충족) | — |
| npm | 설치 | ✓ | 11.12.1 | pnpm 도 설치됨 (`/opt/homebrew/bin/pnpm`) — 저장소는 npm 하나로 통일 권장 |
| wrangler (전역) | 배포 | ✗ (전역 없음) | 프로젝트 로컬 4.151.3 사용 (`npx wrangler`) | — |
| Cloudflare 로그인 | DEPLOY-01 | ✗ (`You are not authenticated`) | — | **사람이 `npx wrangler login`(개인 계정)** 필요. 막히면 `--temporary` 는 URL 고정 요건 불충족 |
| 네트워크(npm registry, Cloudflare) | 설치·배포 | ✓ | — | — |
| 실제 폰 2대+ (iOS/Android) | 성공 기준 1·4, UAT | 미확인 | — | PC 브라우저 탭 여러 개 + `vite dev --host` LAN 접속(스파이크로 LAN HTTP·WS 확인) |
| Windows 집 PC | 이어서 작업 | 미확인 | — | 스크립트는 Node 기반(`scripts/smoke.mjs`)으로 OS 비의존 유지, 셸 전용 명령(`rm -rf` 등) 금지 |

**Missing dependencies with no fallback:**
- Cloudflare 개인 계정 로그인 — 사람의 조치 필요 (`checkpoint:human-action`).

**Missing dependencies with fallback:**
- 전역 wrangler: 로컬 devDependency 로 충분.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.12 + `@cloudflare/vitest-plugin` 1.4.6 (workerd) + happy-dom 21.0.4 + @testing-library/react 16.3.3 |
| Config file | `vitest.config.ts` (projects: `unit` / `client` / `worker`) — **Wave 0 에서 생성** |
| Quick run command | `npx vitest run --project unit` (순수 코어, ~1초 이내) |
| Full suite command | `npx vitest run` (+ `npm run typecheck`) |
| 배포본 검증 | `node scripts/smoke.mjs https://<worker>.workers.dev` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ROOM-01 | 코드가 `^\d{4}$`(앞자리 0 허용), 충돌 시 재시도, 생성 응답에 `code`+`token`, 공유 함수의 3단 대체 경로 | unit + worker | `npx vitest run test/unit/roomCode.test.ts test/unit/share.test.ts test/worker/http.test.ts` | ❌ Wave 0 |
| ROOM-02 | 닉네임 1~8자·NFC·중복(대소문자 무시)·제어문자 거부; join 후 다른 소켓들이 스냅샷 수신 | unit + worker | `npx vitest run test/unit/nickname.test.ts test/worker/join.test.ts` | ❌ Wave 0 |
| ROOM-03 | 9번째 join → `ROOM_FULL`; 3명 start 거부, 4명 방장만 start 성공; 비방장 start 거부 | unit + worker | `npx vitest run test/unit/room.test.ts` | ❌ Wave 0 |
| CONN-01 | `hello{token}` 로 같은 seat/role 복구(eviction 후, 소켓 강제 종료 후), 잘못된 토큰 거부, 중복 소켓 교체 시 `connected` 정합 | worker | `npx vitest run test/worker/reconnect.test.ts` | ❌ Wave 0 |
| DEPLOY-01 | 배포 주소에서 방 생성→참가→시작→`day` 도달; 재배포 후 주소 불변·새 버전 | smoke + manual | `node scripts/smoke.mjs <url>`; 수동: 코드 변경→`npm run deploy`→새로고침 | ❌ Wave 0 |
| GAME-01 | `tick` 단계 연쇄(assigning→roleReveal→day, 마감 = 이전 마감+길이), 늦은 알람 따라잡기, `day` 에서 정지, 알람 다중화(`min(phaseEndsAt, expiresAt)`), 오프셋 계산·`remainingMs` | unit + worker | `npx vitest run test/unit/tick.test.ts test/unit/clock.test.ts test/worker/alarm.test.ts` | ❌ Wave 0 |
| ROLE-01 | 4~8명 각 구성표 정확, 모든 플레이어에게 역할 1개, 시드별 결정적·분포 sanity | unit | `npx vitest run test/unit/roles.test.ts` | ❌ Wave 0 |
| ROLE-02 | 모든 인원수·모든 시점에서 `buildView` 가 타인 `role`/`token`/`playerId` 를 포함하지 않음(직렬화 스캔), 마피아만 `allies`, `roleReveal` 이전엔 `me.role` 없음; 실제 소켓 프레임 전수 검사 | unit + worker + smoke | `npx vitest run test/unit/view.test.ts test/worker/leak.test.ts` | ❌ Wave 0 |
| (UI) 자리 배치/타이머 | `seatLayout` 내 자리가 항상 (50, 50+ry) 최대 scale; 모든 폰에서 같은 둘러앉은 순서; Timer 마지막 5초 상태 | unit + client | `npx vitest run test/unit/seatLayout.test.ts test/client/timer.test.tsx` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --project unit`
- **Per wave merge:** `npx vitest run` + `npm run typecheck`
- **Phase gate:** 전체 스위트 green + 배포본 `smoke.mjs` green + 실기기 UAT(폰 2대+, 화면 잠금·새로고침 복귀, 카카오톡 공유, 재배포 후 새 버전) 후 `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `vitest.config.ts` (3 projects) , `tsconfig.app.json`, `tsconfig.worker.json`, `package.json` scripts(`dev`/`build`/`test`/`typecheck`/`deploy`/`cf-typegen`)
- [ ] `test/unit/*` (순수 코어용), `test/worker/*` (DO 배선), `test/client/*` (타이머 등)
- [ ] `scripts/smoke.mjs` (OS 비의존 Node 스크립트)
- [ ] 설치: 위 Installation 명령 + `npx wrangler types`
- [ ] `.gitignore` 추가: `.wrangler`, `worker-configuration.d.ts`, `dist` (이미 `dist/`, `.wrangler/`, `.dev.vars` 있음 — `worker-configuration.d.ts` 만 추가)

## Security Domain

`workflow.security_enforcement` 활성(ASVS level 1, block_on high).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | 제한적 (계정 없음) | 로그인 없음. 방 입장 자격 = 닉네임 + 서버 발급 토큰 |
| V3 Session Management | yes | 플레이어 토큰: `crypto.getRandomValues` 32바이트(256bit) base64url, 서버가 발급, WS 첫 메시지로만 전달(URL 금지), 다른 클라이언트에 절대 방송 금지, 추방 시 폐기 |
| V4 Access Control | yes | 방장 전용 동작(`start`, `kick`)과 본인 전용 동작은 서버가 토큰→플레이어로 판정. 클라이언트가 보낸 seat/ID 를 신뢰하지 않음 |
| V5 Input Validation | yes | zod 스키마(`t` 판별 유니온), 프레임 크기 상한(예: 1KB), 닉네임 정규화·길이·제어문자, 방 코드 `^\d{4}$` |
| V6 Cryptography | yes | WebCrypto 난수만 사용, 자체 구현 금지 |
| V7 Errors/Logging | 일부 | 오류 응답에 내부 상태·타 플레이어 정보 금지, 토큰을 로그에 남기지 않음 |
| V13 API/Web Service | yes | `/api/*` 입력 검증, 알 수 없는 메서드/경로는 일관된 4xx |

### Known Threat Patterns for Workers + DO + WebSocket

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| 타인 역할이 방송 페이로드에 섞임 (핵심 위험) | Information Disclosure | 연결별 `buildView` + 공개 타입 허용 목록 + 직렬화 스캔 단위 테스트 + 실제 소켓 프레임 스모크 |
| 토큰 추측/탈취로 타인 자리·역할 획득 | Spoofing | 256bit 난수, URL 비노출, 방송 비노출, 새 `hello` 가 기존 소켓 교체 |
| 4자리 방 코드 열거로 로비 난입 | Spoofing/Elevation | 시작 후에는 토큰 없는 참가 거부(D-07). 로비 난입은 친구 게임 MVP의 **수용 위험**(방장이 흐릿한/모르는 사람 추방 가능, D-16). 방 생성 남용 완화는 TTL + (후속) Cloudflare 속도 제한 규칙 |
| 비방장이 `start`/`kick` 전송 | Elevation of Privilege | 서버에서 `hostId` 검사, 거부 오류 |
| 닉네임을 통한 XSS/사칭 | Tampering | React 자동 이스케이프, 정규화·중복 비교, 길이 제한 |
| 대용량/폭주 프레임으로 DO 소진 | Denial of Service | 프레임 크기 상한, 연결당 간단한 속도 제한, 알 수 없는 `t` 무시 |
| 교차 사이트 WebSocket 하이재킹 | Tampering | 쿠키 인증을 쓰지 않고 토큰을 메시지로 보내므로 해당 없음 (필요시 `Origin` 점검 추가 가능) |
| 만료되지 않는 빈 방 DO 누적 | DoS (자원) | 알람 기반 TTL 후 `deleteAll()` |

## Suggested Plan Slicing (참고용 — 확정은 planner)

TDD 모드이므로 각 계획은 "순수 코어 테스트 먼저 → 구현 → 어댑터/화면" 순서. 1계획에서 배포부터 해 DEPLOY-01 위험을 앞당긴다.
1. **스캐폴드 + 첫 배포**: 위 스택 설치, `wrangler.jsonc`/vite/tsconfig/vitest 3 프로젝트, 빈 `Room` DO + "hello" 정적 페이지를 `wrangler deploy`. (`checkpoint:human-verify` 패키지 SUS 확인, `checkpoint:human-action` Cloudflare 로그인)
2. **공용 프로토콜 + 순수 게임 코어(TDD)**: `nickname`, `roles`, `room`(join/leave/kick/start 규칙), `phases`+`tick`, `view`+누출 테스트, `seatLayout`, `clock`.
3. **Room DO 어댑터**: 영속화·연결 보정·`hello`·방송·알람 다중화·만료, HTTP 라우팅(생성/미리보기/참가), 워커 통합 테스트.
4. **클라이언트 연결 계층**: `useRoomConnection`(재연결·visibility·오프셋), 세션 저장, 화면 라우팅, Home/JoinByLink/오류 화면.
5. **대기실 + 2.5D 테이블 부품**: Table/Seat/Figure(표현 전용), 참가·퇴장 등장 애니메이션, 하단 바·공유 버튼.
6. **배정·역할 확인·낮 화면**: 맥박 연출, 공통 Timer, RoleCard(눌러 뒤집기/5초 자동), 마피아 동료 표시, [내 역할] 버튼, 낮 자리 화면.
7. **E2E 스모크 + 배포 검증 + UAT**: `scripts/smoke.mjs`, 재배포 주소 불변 확인, 실기기 체크리스트, HANDOFF 갱신.

## Sources

### Primary (HIGH confidence)
- developers.cloudflare.com/durable-objects/best-practices/websockets/ — `acceptWebSocket`, 핸들러 시그니처, `serializeAttachment` 16,384바이트, 하이버네이션 시 상태 소실
- developers.cloudflare.com/durable-objects/api/alarms/ — DO당 알람 1개, 덮어쓰기, at-least-once, 6회 재시도
- developers.cloudflare.com/durable-objects/api/state/ — `getWebSockets`, 태그, 자동 응답, 32,768 연결 한도, `blockConcurrencyWhile`
- developers.cloudflare.com/durable-objects/best-practices/rules-of-durable-objects/ — SQLite 권장, KV API, 단일 DO/방, `getByName`, 생성자 초기화
- developers.cloudflare.com/durable-objects/get-started/ , .../reference/durable-objects-migrations/ — `exports` 필드, `migrations` 와 병용 불가
- developers.cloudflare.com/durable-objects/platform/pricing/ — Free 플랜 SQLite DO 허용, WS 메시지 20:1, 알람/하이버네이션 과금
- developers.cloudflare.com/workers/static-assets/binding/ , /headers/ — `run_worker_first`, SPA 폴백, 기본 `Cache-Control: public, max-age=0, must-revalidate` + ETag
- developers.cloudflare.com/workers/framework-guides/web-apps/react/ , /vite-plugin/get-started/ — React+Vite+Worker 구성, 빌드 출력, `wrangler deploy` 리다이렉트
- developers.cloudflare.com/workers/testing/vitest-integration/ (write-your-first-test, test-apis, known-issues, migrate-to-vitest-plugin, recipes) — `cloudflareTest`, `cloudflare:test` API, 격리 한계
- developer.mozilla.org Navigator/share , Clipboard/writeText — 보안 컨텍스트·사용자 활성화·예외
- github.com/cloudflare/workerd/issues/1187 — 죽은 하이버네이션 소켓 버그 수정 이력
- **로컬 스파이크(2026-10-21, Mac, Node 26.0.0)**: 위 전체 버전 세트 설치, `wrangler types`, `tsc -p`(앱/워커 분리), `vite build`, `wrangler deploy --dry-run`, `vitest run`(DO WS 왕복·eviction·알람, Intl.Segmenter, happy-dom 컴포넌트, projects), `vite dev --host` LAN HTTP·WS·SPA 폴백, `exports` 변형 — 작업 폴더는 스크래치패드(저장소 밖)
- npm registry (`npm view`) — 버전, peerDependencies, engines, deprecated, dist-tags

### Secondary (MEDIUM confidence)
- devtalk.kakao.com 스크랩/미리보기 FAQ 검색 결과 — 카카오 OG 스크랩 캐시(약 1시간)·디버거·JPG/PNG·`og:url` 동작
- WebSearch: vitest 플러그인 + DO WebSocket 격리 관련 두 문서 사본의 상충(Pitfall 7에 반영)

### Tertiary (LOW confidence — Assumptions Log 참조)
- 시계 오프셋 기법, iOS 좀비 소켓, 조용한 단절 지연, 배포 시 소켓 끊김, 출력 게이트 동작, 방 TTL 값

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 한 세트로 설치·빌드·타입체크·dry-run·테스트까지 실행 확인. 단 패키지 합법성 검사는 `too-new`로 SUS(위험 낮음, 일괄 확인 체크포인트 필요)
- Architecture: HIGH — 공식 문서 + 스파이크로 하이버네이션/알람/eviction 경로 확인. 알람 다중화·단일 키 영속·연결 보정은 문서 규칙에서 도출한 설계 권고
- Pitfalls: MEDIUM-HIGH — 1·7·가용성은 실행으로 확인, iOS 동작·조용한 단절·카카오 미리보기는 실기기/실서비스 확인 필요(UAT)

**Research date:** 2026-10-21
**Valid until:** 2026-11-04 (Cloudflare 도구가 주 단위로 갱신되고 workerd/호환 날짜가 자주 움직이므로 14일)
