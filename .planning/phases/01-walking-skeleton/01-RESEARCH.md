# Phase 1: 걷는 뼈대 - Research

**Researched:** 2026-10-21 (개정 2026-10-23: 화면설계서 v0.2 승인·결정 0012 반영)
**Domain:** Cloudflare Workers + Durable Objects(WebSocket Hibernation) 실시간 방 서버, React 19 + Vite 8 세로 폰 웹앱(디자인 시스템 부품 이식), 서버 기준 타이머·플레이어별 상태 필터링
**Confidence:** HIGH (스택·배포·테스트 조합은 로컬 스파이크로 직접 실행해 확인함. 개정에서 추가한 정적 에셋·`_headers`·`<dialog>`·`import.meta.glob` 동작도 스크래치 사본에서 실행해 확인함. 운영 환경 일부와 iOS 동작은 MEDIUM/ASSUMED 로 표시)

## 개정 요약 (2026-10-23, 이전 연구 대비)

01-01~01-03 은 실행 완료(코드 있음)이고 01-04~01-10 은 아래 변경을 기준으로 처음부터 다시 계획한다. 이전 연구에서 맞는 것은 그대로 두었고 바뀐 것만 고쳤다.

| # | 바뀐 것 | 근거 | 이 문서의 어디 |
|---|---------|------|----------------|
| C1 | 시작 조건 = **연결된 사람 4명 이상**(끊긴 사람도 자리에 있으면 역할을 받는다, 정원은 자리 수) | 결정 0012, REQUIREMENTS ROOM-03 | Pattern 8, Code Examples, Validation |
| C2 | `RoomPreview` 에 `players: {seat, nickname}[]` 추가, S-02 가 10초마다 다시 받음 | 결정 0012, UI-SPEC S-02 | Pattern 6, Pitfall 17·18, Security |
| C3 | [내 역할] = 바텀 시트(C-01). **Pitfall 10(길게 누르기) 삭제**, 접근 가능한 시트 지침 추가 | 결정 0012 | Pattern 9, Pitfall 19 |
| C4 | 역할 카드: 5초 자동 앞면(한 번) + 누르면 앞/뒤 토글, 800ms | 결정 0012 | Pattern 10, Pitfall 20 |
| C5 | 대기실 토스트는 뷰 차이로 클라이언트가 만든다(첫 렌더·재접속 없음) | 결정 0012 | Pattern 11 |
| C6 | 재접속 띠 52px(내용을 밂), "다시 연결됐어요" 2초, 30초 실패 화면 | UI-SPEC C-02 | Pattern 12, Pitfall 8·21·22 |
| C7 | 세트 C PNG·A_cute SVG 배경 사용, `public/` 에셋 처리 | 결정 0010·0011 | Pattern 13, Pitfall 14~16 |
| C8 | 공유는 시트(C-03): [공유하기]/[링크 복사] 분리 | UI-SPEC C-03 | Pitfall 6 |
| C9 | 토큰 원천 = `design/tokens.json` → `npm run tokens`(생성), `--check` | 결정 0011 | Pitfall 23 |
| C10 | 디자인 시스템 참고 구현(`React.createElement` IIFE)을 앱 TSX 로 이식 | UI-SPEC "Design System" | Pattern 14(이식표) |
| 삭제 | Pitfall 10(길게 누르기), 임시 실루엣 관련 지침, 1차 ShareButton·32px 배너 지침 | 위 | — |

## User Constraints (from CONTEXT.md)

### Locked Decisions

> **2026-10-23 개정 (결정 0012)**: 화면설계서 v0.2(`design/screens/`)가 승인되어 1페이즈 화면은 설계서와 `01-UI-SPEC.md` 를 따른다. 아래 결정 가운데 다음은 바뀌었다 — D-05(링크 참가 화면 구성), D-07(첫 화면 코드 참가 거절은 칸 아래 오류 문장), D-10(대기실 토스트 사용), D-11(방장 왕관 → "방장" 배지, 인원·안내 문구), D-13(5초 자동 뒤집기 + 다시 누르면 가림), D-16(시작 조건은 **연결된 사람 4명 이상**), D-19(누르고 있기 → 내 역할 시트), D-21·D-25(임시 실루엣 → 세트 C 그림, 결정 0010·0011). 실제 캐릭터 그림을 1페이즈부터 쓰므로 "실제 캐릭터 그림(5페이즈)" 제외 항목도 그림 자체에는 해당하지 않는다(프레임 애니메이션·연출은 여전히 5페이즈). 나머지 D 번호는 그대로 유효하다.

**게임 흐름 변경 (결정 0007)**
- **D-01:** 역할 확인 다음 첫 단계는 **낮**이다(밤 먼저 → 낮 먼저). 첫 낮도 다른 낮과 같은 기본 시간이고, 단계 시간 조정은 플레이테스트(6페이즈) 결과로 한다. 전체 순서: 역할 배정 → 역할 확인 → [낮: 직업 공개 → 낮 토론 → 투표 → 최후 변론 → 찬반 → 처형] → 밤 → 아침 → 낮… — **Reversibility:** costly — 단계 순서는 서버 단계 전환 틀·기획서·요구사항·로드맵 순서에 함께 걸려 있다
- **D-02:** 1페이즈의 마지막 단계는 서버의 `낮` 단계다. 화면은 "낮이 되었습니다" 와 [내 역할] 버튼만 있는 자리 화면이고, 타이머·행동은 없다. 새 2페이즈가 이 자리에 직업 공개·낮 토론을 얹는다. 단계 전환 틀은 역할 배정 → 역할 확인 → 낮의 세 단계로 검증한다.
- **D-03:** 매 낮 시작에 고정 "직업 공개" 단계를 두기로 했다(결정 0007, 새 요구사항 DAY-02). 1페이즈에서는 만들지 않고, 서버 단계 정의에 미리 넣어 두지도 않는다. 새 2페이즈가 단계 전환 틀에 추가한다.

**첫 화면·참가 흐름**
- **D-04:** 주소를 그냥 열면 한 화면에 닉네임 입력칸, [방 만들기], [코드로 참가 ____] 가 있다. 방장도 닉네임을 입력한다.
- **D-05:** 참가 링크로 열면 방 정보("○○님의 방", 현재 인원/8)와 닉네임 입력칸, [들어가기] 하나만 보인다. 코드 입력·방 만들기는 숨긴다. *(결정 0012 로 구성 변경 — UI-SPEC S-02 가 우선)*
- **D-06:** 닉네임은 1~8자. 같은 방에 같은 닉네임이 있으면 "이미 있는 이름이에요" 로 다시 입력받는다(서버 검증). 마지막으로 쓴 닉네임은 브라우저에 기억해 다음에 미리 채운다.
- **D-07:** 들어갈 수 없는 방은 이유를 한 문장으로 보여 주고 처음 화면으로 돌아가는 버튼을 준다: "없는 방이에요" / "방이 꽉 찼어요" / "이미 게임이 시작됐어요". 단, 그 방의 플레이어 토큰이 있는 사람은 게임 시작 후에도 그대로 자기 자리로 들어간다(CONN-01). *(결정 0012: 첫 화면 코드 참가 거절은 칸 아래 오류 문장, 문구는 UI-SPEC Copywriting)*

**대기실·참가자 등장**
- **D-08:** 대기실은 **둥근 테이블** 둘레 8자리다(2.5D 원근 타원 구도, D-24). 세로 폰 폭에서 이름이 좁아지는 문제는 이름을 자리 바깥쪽에 두거나 말줄임으로 푼다(Claude 재량).
- **D-09:** 자리는 들어온 순서로 고정되고 게임 내내 유지된다(이후 페이즈의 낮·밤·투표 화면도 같은 테이블 배치를 쓴다). 각자 폰에서는 **내 자리가 항상 맨 아래 가운데**에 오도록 테이블을 돌려 보여 준다. 둘러앉은 순서는 모든 폰에서 같다. 마피아 규칙에 좌우 의미가 없고 빠른 메시지는 이름으로 대상을 고르므로 회전해도 문제없다(사용자 확인). — **Reversibility:** costly — 이후 모든 단계 화면이 같은 테이블 배치 부품을 쓴다
- **D-10:** 참가·퇴장은 **자리 애니메이션만** 쓴다: 빈 의자에 인물이 등장하고, 나가면 사라져 빈 의자가 된다. 별도 안내 문구(토스트)는 없다. *(결정 0012: 토스트 사용, 자리 등장 애니메이션은 유지)*
- **D-11:** 하단: 모두에게 "4/8명" 과 한 문장 상태. 방장에게만 [게임 시작] 버튼 — 4명 미만이면 흐리게 + "1명 더 필요해요", 4명 이상이면 활성. 참가자에게는 "방장이 시작하기를 기다리는 중…". [공유] 버튼(Web Share, 미지원 시 링크 복사)과 방 코드는 모두에게 보인다. 방장 자리에는 왕관 표시. *(결정 0012: "방장" 배지, 인원 = 연결된 인원, 안내 문구는 UI-SPEC)*

**배정·역할 카드·카운트다운**
- **D-12:** 역할 배정 약 3초: 화면이 어두워지고 가운데 "직업을 배정하고 있습니다…" 가 숨쉬듯 커졌다 작아지는 맥박 효과(점 3개 애니메이션). 서버 단계이며 모든 폰에서 같은 시각에 시작·끝난다.
- **D-13:** 역할 확인 15초: 뒷면 카드와 "눌러서 확인" 이 뜨고, 누르면 뒤집히며 역할이 공개된다. 5초 안에 누르지 않으면 저절로 뒤집힌다. 카드에는 역할 이름과 한 줄 설명(Claude 재량 문구). *(결정 0012: 앞면에서 다시 누르면 뒷면으로 가려진다)*
- **D-14:** 마피아는 카드 아래 "동료: ○○" 를 보고, 테이블의 동료 자리에 진홍 표시가 붙는다. 이 표시는 게임 내내 그 마피아의 화면에만 남는다(서버가 마피아에게만 동료 정보를 보낸다). 마피아가 1명이면 "이번 판 마피아는 당신 혼자입니다".
- **D-15:** 카운트다운은 화면 위쪽의 줄어드는 막대 + 숫자. 마지막 5초는 막대가 진홍으로 바뀌고 숫자가 초마다 크게 튄다. 서버가 보낸 마감 시각 기준으로 그린다. 이후 단계(낮·밤·투표)도 쓰는 **공통 타이머 부품**으로 만든다.

**연결 끊김·이탈 처리**
- **D-16:** 대기실에서 연결이 끊긴 사람은 자리에 남고 흐릿하게 표시된다. 직접 [나가기]를 누른 사람만 자리가 빈다. 방장은 흐릿한 사람을 내보낼 수 있다. 흐릿한 사람이 있어도 4명 이상이면 시작할 수 있고, 그 사람은 돌아오면 자기 역할로 이어서 한다. *(결정 0012: 시작 조건은 **연결된 사람 4명 이상**. 끊긴 사람은 자리를 지키지만 시작 인원에 넣지 않고, 역할은 시작 때 앉아 있는 모든 사람(끊긴 사람 포함)에게 배정한다)*
- **D-17:** 방장이 끊기면 다른 사람처럼 흐릿하게 남고 돌아오길 기다린다. 방장이 [나가기]를 누르면 다음으로 들어온 사람이 방장이 된다. 끊긴 채 오래 안 돌아올 때의 자동 이양은 v2 CONNX-01.
- **D-18:** CONN-02 확정: 게임 중 끊긴 사람을 기다리지 않고 서버 타이머대로 진행한다. 놓친 투표·찬반은 기권, 밤 행동은 행동 없음, 직업 공개는 말 안 함. 게임 중에도 끊긴 사람은 테이블에서 흐릿하게 표시한다(연결 여부는 역할과 무관한 공개 정보). CONN-02 구현 자체는 4페이즈 요구사항이지만 1페이즈의 연결 상태 모델은 이 정책을 전제로 짠다.
- **D-19:** 역할 확인 뒤 모든 단계에 같은 모양의 [내 역할] 버튼을 둔다. 누르고 있는 동안만 내 역할 카드가 보인다. 역할 확인을 놓치고 돌아온 사람도 여기서 확인한다. 모든 사람에게 같은 버튼이라 역할을 드러내지 않는다. *(결정 0012: 누르면 내 역할 시트(C-01)가 올라오고 [닫기]·아래로 끌기로 내린다)*

**1페이즈 화면 톤**
- **D-20:** 색 방향: 바탕은 **밤 남색**, 판·글자·중립 면은 **회색**, 강조(마피아·위험·마지막 5초)는 **진홍**. 5페이즈가 이 방향을 다듬는다.
- **D-21:** 캐릭터가 나오기 전(1~4페이즈) 테이블 자리에는 **같은 정장 몸 실루엣**을 두고 자리마다 색(또는 모자·가면 윤곽)으로 구분한다. 5페이즈에서 같은 자리에 실제 캐릭터를 끼운다. *(결정 0012: 세트 C 그림으로 대체)*
- **D-22:** 5페이즈에서 캐릭터 표현이 프레임 PNG 애니메이션으로 바뀐다(사용자 희망, 결정 0008). 1페이즈의 테이블·자리·인물은 게임 상태(자리 번호, 닉네임, 연결 여부, 방장, 마피아 동료 표시)를 받아 그리기만 하는 화면 부품으로 분리해, 나중에 그리는 방식만 바꿔 끼울 수 있게 만든다. — **Reversibility:** costly — 상태와 그리기가 섞이면 5페이즈에서 테이블을 쓰는 모든 단계 화면을 고쳐야 한다

**그리는 방식 (결정 0008)**
- **D-23:** 실시간 3D 장면은 쓰지 않는다. 화면 구조는 일반 웹 화면(2D)이고, 보이는 모습을 입체감 있는 **2.5D** 로 만든다(사용자: 맵 이동·고품질 3D 가 아니라 간단하지만 구색과 완성도가 있는 2.5D). 계획 전 스파이크는 하지 않는다. — **Reversibility:** costly — 나중에 실시간 3D 로 바꾸면 테이블을 쓰는 모든 단계 화면을 다시 만들어야 한다
- **D-24:** 1페이즈 테이블은 비스듬히 내려다본 **원근 타원 테이블**이다. 내 자리(맨 아래, D-09)가 가장 가깝고 크게, 건너편 자리는 작게 보인다. 그림자·조명 레이어·앞뒤 겹침으로 입체감을 기본형으로 넣는다(배경 패럴랙스는 Claude 재량). 이후 페이즈도 같은 구도를 쓴다.
- **D-25:** 1페이즈에서 완성 캐릭터 에셋은 만들지 않는다. 원근 테이블에 임시 정장 실루엣(D-21)을 두고, 5페이즈에서 프레임 PNG 캐릭터(일러스트 또는 3D 렌더링)와 연출로 바꿔 끼운다(D-22). *(결정 0012: 임시 실루엣 대신 세트 C 그림 사용)*

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

### 결정 0012 로 정해진 것 (UI-SPEC 개정 2 가 이를 옮김, 계획의 기준)
- 화면의 기준은 화면설계서 v0.2(`design/screens/`)와 `01-UI-SPEC.md`(개정 2). 01-CONTEXT 와 어긋나면 설계서가 이긴다.
- 방장이 끊긴 채 안 돌아올 때의 자동 이양은 v2(CONNX-01): 1페이즈는 "방장 연결을 기다리는 중이에요" 안내만.
- 재연결이 30초 넘게 실패하면 "연결할 수 없어요" + [다시 시도]·[처음으로](30초는 가정, 플레이테스트로 조정).

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ROOM-01 | 방장이 방을 만들면 4자리 방 코드와 참가 링크가 나오고, 공유 버튼(Web Share, 미지원 시 링크 복사)으로 카카오톡 등에 보낼 수 있다 | 01-02 완료(POST /api/rooms, 방 코드). 개정: 공유 시트 C-03([공유하기]/[링크 복사] 분리, Pitfall 6), 기존 `shareRoom` 재사용 |
| ROOM-02 | 링크·4자리 코드로 설치·로그인 없이 닉네임만 입력해 들어오고 대기실 목록에 바로 나타난다 | `GET /api/rooms/:code` 미리보기(+`players`), `POST .../join`, 10초 폴링(Pattern 6), 뷰 차이 토스트(Pattern 11) |
| ROOM-03 | 방은 4~8명을 받는다. 방장은 **연결된 사람이 4명 이상**일 때만 시작(끊긴 사람도 자리에 있으면 역할을 받는다), 8명이 차면 더 못 들어옴 | Pattern 8(`connectedCount`/`canStart`, 정원은 자리 수), 서버 재검증, 오류 코드 |
| CONN-01 | 플레이어 토큰 발급·브라우저 저장, 같은 폰으로 다시 열면 같은 자리·역할로 현재 단계 | 토큰·`hello`·재접속 상태기계(Pattern 12), 세션 저장 단일 슬롯 규칙, 낡은 세션은 미리보기로 먼저 확인(Pitfall 22) |
| DEPLOY-01 | `wrangler deploy` 한 번으로 웹+서버가 같은 주소에 갱신 | 01-02 완료. 개정: `public/` 에셋·`_headers`·`@` 파일명 처리(Pitfall 14·15) |
| GAME-01 | 서버가 단계 전환·타이머 기준, 클라이언트는 마감 시각으로 표시. 역할 배정(약 3초) → 역할 확인(15초) → 낮 | `PHASE_DEFS`+`tick`+알람 다중화(Pattern 1·4), 시계 오프셋(Pattern 5), Timer `m:ss`(Pattern 15) |
| ROLE-01 | 인원 구성표대로 서버가 무작위 배정, 구성표는 서버 한 곳 | 01-03 완료(`ROLE_TABLE`, `assignRoles`). 개정: 배정 대상 = 시작 때 앉은 **모든** 자리(끊긴 사람 포함) |
| ROLE-02 | 자기 역할 카드만 보고 마피아는 동료도 본다. 남의 역할은 클라이언트로 보내지 않는다 | `buildView` 허용 목록 + `me.role`/`me.allies`, 카드 뒷면 DOM 에 역할 없음(Pitfall 20), 미리보기에도 역할·토큰 없음(Security) |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

`./CLAUDE.md`(`/Users/dhkim1522/personal/minifia/CLAUDE.md`)에서 추린 지시. 계획과 코드가 모두 지켜야 한다.

- 게임 규칙·판정은 서버(방 Durable Object)가 정한다. 클라이언트는 받은 상태를 보여 주고 행동만 보낸다 (결정 0002).
- 다른 사람의 역할은 서버가 클라이언트로 보내지 않는다. 화면에서 숨기는 것으로 대신하지 않는다.
- 기획·계획은 참여 플레이어의 몰입을 기준으로 한다. 각 페이즈는 자기 구간의 이펙트·액션을 기본형으로 함께 만든다 (결정 0006).
- 새 결정은 `docs/decisions/` 에 다음 번호로 파일을 추가한다(0012 까지 있음 → 다음은 0013).
- 작업을 마칠 때마다 `HANDOFF.md` 를 갱신하고 push 한다. Mac 과 집 Windows PC 를 오간다 → 스크립트·경로가 두 OS 에서 동작해야 한다(Node 스크립트, `rm -rf` 같은 셸 전용 명령 금지).
- GSD 산출물(`.planning/`)과 응답은 한국어. 코드·명령·파일 이름·요구사항 ID 는 원문.
- 작은 MVP: v1 에 필요한 것만. 이른 배포: 이후 검증은 배포본으로.
- 디자인 참고 자료: `design/screens/` PNG 를 직접 열어 보고 따른다. 색·간격 값은 그림에서 읽지 말고 토큰을 쓴다. 승인본의 저장소 사본(`design/`)이 기준이다(아티팩트는 에이전트가 열 수 없음).
- 화면 페이즈는 UI-SPEC 먼저(이미 있음: `01-UI-SPEC.md` 개정 2).
- 프로젝트 스킬(`.claude/skills/`, `.agents/skills/`)은 없음.

## Summary

기반(Vite 빌드 하나 + Worker 하나 + Room DO 하나, 배포 주소 `https://minifia.dhplay.workers.dev`)과 순수 규칙 5묶음(닉네임·역할·자리 배치·시계·공유)은 이미 있다. 남은 일은 (1) 서버 규칙 확장(참가·나가기·내보내기·**연결자 4명 시작 조건**·단계 표·`tick`·역할 필터링 뷰·미리보기 `players`), (2) DO·HTTP 배선, (3) 승인된 화면설계서 v0.2 를 따르는 화면 전체(입장 2개, 대기실, 배정, 역할 확인, 낮, 시트 3종, 재접속)다. 개정으로 화면 몫이 크게 늘었다: 디자인 시스템 참고 구현 20개 부품 가운데 1페이즈에 필요한 것(Button, TextField, Timer, PhaseBar, ReconnectBanner, ConfirmSheet, RoleCard, Figure, Table, Backdrop, Icon, 그리고 이번에 새로 필요한 Sheet·Toast·공유 시트)을 **새 패키지 없이** React 19 TSX + 일반 CSS 로 옮긴다.

설계 원칙은 그대로다. (1) **순수 코어**: 규칙·단계·뷰·뷰 차이(토스트·자리 전이)·카드 면 전이·연결 상태기계를 DOM/workerd 와 무관한 순수 TypeScript 로 두고 plain vitest 로 TDD. (2) **플레이어별 상태 방송**: 연결마다 허용 목록 `buildView`, 역할은 `me` 에만. 미리보기(`GET /api/rooms/:code`)도 같은 원칙의 허용 목록 빌더로 만들고 누출 테스트를 건다. (3) **서버 기준 타이머**: 마감 시각 연쇄 + 알람 하나 다중화. 개정으로 추가된 실무 위험은 화면 쪽에 몰려 있다: Workers 정적 에셋이 `@` 가 든 파일명을 `%40` 으로 307 리다이렉트하는 점(로컬 확인), 4:5 테이블 장면이 폰 높이 안에서 줄어드는 방식, `<dialog>` 기반 시트의 포커스·종료 애니메이션, 뷰 차이로 만드는 토스트의 "첫 렌더 제외", 재접속 30초 타이머가 화면 잠금과 섞이는 문제, 오래된 세션으로 열린 소켓이 404 로 조용히 실패하는 문제다. 모두 아래 Pitfall 과 Code Examples 로 처방했다.

**Primary recommendation:** 서버 규칙(01-04·01-07)과 순수 화면 로직(뷰 차이·카드 면·연결 상태기계·카운트다운·에셋 경로)을 TDD 로 먼저 고정하고, 디자인 시스템 부품은 `design/design-system/components/bundle.css` 를 `src/styles/ds.css` 로 옮겨 **UI-SPEC 과 다른 곳(이식표의 델타)만 고쳐** TSX 로 이식한다. 에셋 URL 은 `%40` 헬퍼 한 곳으로, 시트는 네이티브 `<dialog>.showModal()` 한 부품으로, 토큰은 `npm run tokens:check` 를 `typecheck` 앞에 건다.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 방 생성·4자리 코드 발급·충돌 재시도 | API / Backend (Worker) | Database / Storage (DO 상태) | 01-02 완료. 코드 유일성은 DO 이름 공간이 보증 |
| 참가 검증(정원·시작 여부·닉네임 중복) | API / Backend (Room DO) | — | 규칙은 서버 기준(결정 0002). 정원은 **자리 수**(끊긴 사람 포함) |
| **시작 조건(연결된 사람 ≥ 4) 판정** | API / Backend (순수 코어 `canStart`) | Browser / Client (같은 `connectedCount` 로 버튼 활성만 표시) | 서버가 start 때 다시 검증, 클라이언트는 표시용 |
| 플레이어 토큰 발급·검증 | API / Backend (Room DO) | Browser / Client (localStorage 보관) | 토큰은 서버가 만들고 클라이언트는 보관만 |
| 역할 배정(끊긴 사람 포함)·구성표 | API / Backend (순수 코어) | — | ROLE-01 |
| 플레이어별 상태 필터링·방송 | API / Backend (Room DO) | — | ROLE-02 |
| **방 미리보기(앉은 사람 자리·닉네임)** | API / Backend (Worker 라우트 → DO RPC) | Browser / Client (S-02 가 10초마다 폴링) | 역할·토큰 없는 허용 목록 응답, 비인증 공개 엔드포인트 |
| 단계 전환·타이머·알람 | API / Backend (Room DO) | Browser / Client (마감 시각으로 표시만) | GAME-01 |
| 방 영속(재접속·하이버네이션 복구) | Database / Storage (DO storage) | — | 인메모리는 사라진다 |
| 시계 오프셋 보정·카운트다운 표시 | Browser / Client | API / Backend (`pong.serverNow`) | 표시용 계산만 |
| **토스트(입장·방장 변경)·자리 등장/퇴장 전이** | Browser / Client (뷰 차이) | — | 서버는 이벤트를 따로 보내지 않는다. 스냅샷 두 개의 차이로 계산 |
| **재접속 상태기계·띠·30초 포기** | Browser / Client | API / Backend (`hello` 스냅샷) | 화면 잠금·네트워크는 클라이언트만 안다 |
| **역할 카드 면 전이(5초 자동·토글)** | Browser / Client | API / Backend (단계 시작 시각 `phaseEndsAt - phaseDurationMs` 제공) | 표시 상태. 역할 값 자체는 서버가 `me` 에만 보냄 |
| 2.5D 테이블·카드·시트 그리기 | Browser / Client | — | 상태를 받아 그리기만(D-22) |
| 정적 파일·그림(PNG/SVG)·`_headers` | CDN / Static (Workers Static Assets) | API / Backend (`/api/*` 만 Worker 우선) | 에셋 우선 서빙 |
| 공유(Web Share/복사) | Browser / Client | CDN / Static (OG 메타) | 브라우저 API |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react / react-dom | 19.3.1 | UI | 결정 0001. 설치됨 [VERIFIED: package.json `"react": "19.3.1"`] |
| vite | 8.3.5 | 번들러/개발 서버 | 설치됨 [VERIFIED: package.json] |
| @vitejs/plugin-react | 6.1.2 | React 빌드/HMR | 설치됨 |
| @cloudflare/vite-plugin | 1.64.0 | Worker+DO+정적 에셋 빌드. `dist/client`(+`_headers`) + `dist/worker/wrangler.json` | 설치됨. 이번 세션 스크래치 사본 `vite build` 로 `public/` 과 `_headers` 가 `dist/client` 로 복사됨을 확인 [VERIFIED: 스크래치 사본 빌드 출력 `dist/client: _headers assets backgrounds characters index.html`] |
| wrangler | 4.151.3 | 배포·타입 생성 | 설치됨 |
| typescript | 7.0.2 | 타입체크 | 설치됨 |
| zod | 4.6.7 | 클라이언트→서버 입력 검증(서버만 값 import) | 설치됨 |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | 4.1.12 | 테스트 러너(unit/client/worker 3 프로젝트) | 이번 세션 기준 기존 스위트: 16 파일 123 테스트 통과 [VERIFIED: `npx vitest run` 출력 "Test Files 16 passed (16) / Tests 123 passed (123)"] |
| @cloudflare/vitest-plugin | 1.4.6 | workerd 안 DO/Worker 통합 테스트 | worker 프로젝트 |
| @testing-library/react, /dom | 16.3.3 / 10.4.2 | 부품 테스트 | Sheet·RoleCard·Timer·Toast 등 |
| happy-dom | 21.0.4 | 클라이언트 테스트 DOM | `HTMLDialogElement.showModal()`·`inert` 지원을 이번 세션에 확인 [VERIFIED: node 스크립트 출력 "showModal function close function / open after showModal true / inert prop true"] |

**새 패키지는 필요 없다**(UI-SPEC "새 패키지 설치 없음"과 일치). 이번 개정에서 필요한 기능은 전부 플랫폼·기존 패키지로 된다: `<dialog>`, `react-dom` 의 `preload`, `import.meta.glob`(Vite, 테스트에서 파일 존재 확인), `Intl.Segmenter`(이미 사용), Web Share/Clipboard(이미 사용).

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| 직접 짠 `Room` DO | partyserver / agents | 채택하지 않음(하이버네이션·알람·연결별 필터링을 직접 통제해야 함) |
| 네이티브 `<dialog>` 시트 | focus-trap-react, Radix Dialog, vaul(바텀 시트) | 새 패키지 금지(UI-SPEC). `<dialog>.showModal()` 이 포커스 가두기·Esc·배경 비활성을 기본 제공 [ASSUMED: 브라우저 표준 동작, 스펙 지식. 실기기 UAT 로 확인] |
| `::backdrop` 로 막 그리기 | 대화상자 안에 막 `<div>` 를 직접 둠 | MDN: "`::backdrop` neither inherits from nor is inherited by any other elements" [CITED: developer.mozilla.org/en-US/docs/Web/CSS/::backdrop] → `var(--scrim)` 이 닿는지 불확실. 직접 둔 막이 안전 |
| `exports` 필드 | `migrations` | 이미 `exports` 로 배포됨(결정 0009), 되돌릴 수 없음 |
| Workers Rate Limiting 바인딩 | 1페이즈에서는 넣지 않음 | 설정 형태 `simple.limit`/`simple.period`(10 또는 60초), 위치별 근사치·최종 일관 [CITED: developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/]. 정식 출시 단계(LAUNCH)로 미룸 — Open Question 5 |

**Installation:** 이미 설치됨. 개정으로 추가 설치 없음.

**Version verification:** 버전은 `package.json` 에 정확히 고정됨(`^`/`~` 없음). 의존성 갱신 시에만 `npm view <pkg> version` 으로 재확인.

## Package Legitimacy Audit

이번 개정에서 **새로 설치하는 패키지가 없다.** 01-01 에서 설치한 15개는 2026-10-21 `gsd-tools query package-legitimacy check` 결과 SUS(`too-new`, 해당 버전이 최근 게시됨) 10개 + OK 5개였고, 사용자가 01-01 의 체크포인트에서 정확한 버전 그대로 설치하도록 승인했다(01-01-SUMMARY: "SUS(too-new) 10개 패키지를 리서치가 검증한 정확한 버전 그대로 설치 — 사용자 승인(approved)").

| Package | Registry | Verdict (2026-10-21) | Disposition |
|---------|----------|----------------------|-------------|
| wrangler, @cloudflare/vite-plugin, @cloudflare/vitest-plugin, vitest, react, react-dom, vite, @vitejs/plugin-react, zod, happy-dom | npm | SUS (`too-new`만) | 01-01 에서 사용자 승인·설치 완료 |
| typescript, @types/react, @types/react-dom, @testing-library/react, @testing-library/dom | npm | OK | Approved |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** 위 10개(이미 승인·설치됨). 이번 개정 계획에서 추가 `checkpoint:human-verify` 불필요.

**주의:** `@types/node` 는 `node_modules/@types/node` 로 존재하지만 `package.json` 에 선언돼 있지 않다(전이 의존) [VERIFIED: `ls node_modules/@types` 출력에 `node` 있음, package.json devDependencies 에 없음]. 테스트에서 `node:fs` 를 import 하지 말고 `import.meta.glob` 을 쓴다(Pattern 13 / Pitfall 16).

## Architecture Patterns

### System Architecture Diagram

```
[폰 브라우저 (React SPA)]
   │ ① GET /, /r/1234  ─────────────▶ [Workers Static Assets]  (에셋 우선, 없는 "페이지 이동" 은 index.html 폴백)
   │      /characters/*, /backgrounds/* (public/, `_headers` 로 캐시)  /assets/* (해시 파일)
   │
   │ ② S-01 첫 화면: 저장된 세션 있으면 ──▶ GET /api/rooms/{code} (방 살아있나?) ─ 없음 → 세션 삭제·첫 화면
   │    POST /api/rooms {nickname}                      ─┐
   │    GET  /api/rooms/{code}  ← 미리보기 {…, players[{seat,nickname}]}  (S-02: 열 때·10초마다·화면 복귀 때)
   │    POST /api/rooms/{code}/join {nickname}           ├─▶ [Worker] run_worker_first:["/api/*"]
   │                                                    ─┘     └─▶ env.ROOM.getByName(code)  (DO RPC: createRoom / preview / join)
   │ ③ WS /api/rooms/{code}/ws ─────────────────────▶ [Room DO]
   │    → hello{token} / ping / start / leave / kick     ├─ 모든 진입: tick(state, now) → 순수 코어(shared/game)
   │    ← state{view}(연결마다 buildView) / pong / error  ├─ start: canStart(연결자≥4) → 전원(끊긴 사람 포함) 역할 배정 → assigning
   │                                                    ├─ 변경: storage.put → 알람 재설정 → 방송
   ▼                                                    └─ alarm(): tick → 방송 → 재설정 / 만료 시 deleteAll
[클라이언트]
   useRoomConnection(재연결 상태기계·핑 표본·visibility) ──▶ view 스냅샷 1개
        ├─ diffRoomViews(prev, next) ─▶ 토스트(입장·방장 변경) · 자리 등장/퇴장 전이
        ├─ RoomScreen(단계 분기) + 재접속 띠(52px, 흐름 안) + 30초 포기 화면
        │     lobby→S-03 / assigning→S-04 / roleReveal→S-05 / day→S-06   (+ 입장 S-01·S-02, ErrorScreen)
        └─ 시트(`<dialog>`): 내 역할(C-01) · 공유(C-03) · 확인(ConfirmSheet)  — RoomScreen 이 열림 상태를 쥔다
```

### Recommended Project Structure
굵게 표시한 것이 이번 개정에서 새로 생기거나 크게 바뀌는 것이다(01-01~03 결과물은 그대로 쓴다).
```
minifia/
├── index.html                  # OG 메타·title 을 "미니피아" 로(UI-SPEC E13)
├── design/                     # 승인본 사본(원천). tokens.json, screens/, design-system/, characters/, backgrounds/
├── public/
│   ├── _headers                # **신규** 에셋 캐시(Pitfall 15)
│   ├── characters/{table,roles,ghost}/*_default@{2x,4x}.png   # 있음(세트 C)
│   ├── backgrounds/bg_{entry,game}_{lobby,night,day,verdict}.svg   # 있음(A_cute)
│   └── og.png                  # **신규** 임시 1200×630(UI-SPEC E13, 01-10)
├── shared/                     # 순수 코어(DOM/workerd 금지)
│   ├── protocol.ts             # **RoomPreview.players 추가**, RoomView.me.role/allies(01-07)
│   ├── schemas.ts              # 서버 전용 zod
│   ├── nickname.ts roomCode.ts seatLayout.ts   # 있음(01-03)
│   └── game/ room.ts(join/leave/kick/start/canStart 추가) view.ts(+buildPreview) phases.ts tick.ts roles.ts
├── worker/                     # index.ts(+GET 미리보기, POST join 라우트), room.ts(+start/leave/kick/preview/알람)
├── src/
│   ├── main.tsx App.tsx        # **라우팅(/, /r/:code), 세션 이어받기**
│   ├── net/                    # api.ts(+getPreview, joinRoom), session.ts(**신규**), useRoomConnection.ts(**상태기계로 교체**), clock.ts share.ts(있음), assets.ts(**신규**: URL 헬퍼·preload), roomDiff.ts(**신규**), cardFace.ts(**신규**), copy.ts(**신규**: messageForApiError 등 문구)
│   ├── components/             # **신규** Button TextField Icon Backdrop Table Figure Timer PhaseBar RoleCard Sheet Toast ReconnectBanner ConfirmSheet ShareSheet MyRoleSheet
│   ├── screens/                # Home(S-01) JoinByLink(S-02) ErrorScreen Lobby(S-03) Assigning(S-04) RoleReveal(S-05) Day(S-06) RoomScreen
│   └── styles/                 # tokens.css(생성) base.css ds.css(**신규**, bundle.css 이식) screens.css(**다시 씀**)
├── scripts/ gen-tokens.mjs smoke.mjs(+full 단계)
└── test/{unit,client,worker}/
```

### Pattern 1: 순수 코어 + 얇은 DO 어댑터 (TDD 핵심) — 유지
`(state, input, now, rng) → newState` 순수 함수. `shared/game/room.ts` 는 이미 `createRoomState`, `findPlayerByToken`, `attachConnection`, `detachConnection` 이 있다. 개정으로 `join`·`leave`·`kick`·`startGame`·`canStart`·`connectedCount` 가 더해진다(01-04·01-07).
```typescript
// shared/game/phases.ts  (D-02, D-03: 직업 공개 같은 후속 단계는 미리 넣지 않는다)
export type PhaseId = "lobby" | "assigning" | "roleReveal" | "day";   // protocol.ts:11 와 동일
export const PHASE_DEFS = {
  lobby:      { durationMs: null,   next: null },
  assigning:  { durationMs: 3_000,  next: "roleReveal" },
  roleReveal: { durationMs: 15_000, next: "day" },
  day:        { durationMs: null,   next: null },   // 1페이즈는 여기서 멈춘다 (D-02)
} as const;
// tick: 마감 = "이전 마감 + 길이" 로 연쇄 → 알람 지연이 누적되지 않고 모든 폰이 같은 마감을 본다 (이전 연구 Pattern 1 그대로)
```
[ASSUMED 설계안. 알람 의미론은 공식 문서 확인: DO당 알람 하나, at-least-once, 멱등 — developers.cloudflare.com/durable-objects/api/alarms/]

### Pattern 2: 연결별 필터링 스냅샷 방송 (ROLE-02) — 현재 코드와 개정 방향
현재 `buildView` 는 객체 리터럴 허용 목록으로 `players` 를 만들고 `me` 는 `{ seat, isHost }` 다 [VERIFIED: shared/game/view.ts:10-29, `me: { seat: me.seat, isHost: me.id === state.hostId }`, `phaseDurationMs: null, // 01-07 이 단계 표로 채운다`]. 01-07 이 더할 것: `phaseDurationMs` 채우기, `me.role`(roleReveal·day 에서만), `me.allies`(마피아에게만, **seat 번호 배열**).

화면이 필요한 정보는 모두 이 필드로 파생된다 — **뷰에 새 필드를 더하지 않는다**:
- "{연결된 인원} / 8명" = `connectedCount(view.players)`, "8 / 8명 · 가득 찼어요" = `view.players.length >= view.maxPlayers`
- 동료 줄 "동료 · 서준, 민지" = `me.allies` 의 seat → `players.find(seat).nickname`
- 테이블 동료 링 = `allies.includes(seat)`
- 카드 5초 자동 시각 = `view.phaseEndsAt - view.phaseDurationMs + 5000`
- 방장이 끊겼는지 = `players.find(isHost).connected`
`minPlayers`(= 4)는 이미 뷰에 있다. [ASSUMED 설계 권고]

### Pattern 3: 영속화 = 단일 키 스냅샷 + 생성자 복구 + 연결 상태 보정 — 유지
01-02 에서 구현 완료(`worker/room.ts` 생성자가 `connId` 기준으로 `connected` 재계산).

### Pattern 4: 알람 하나로 단계 마감 + 방 만료 다중화 — 유지
현재 `alarm()` 은 만료만 처리한다(01-02). 01-08 이 `nextWakeAt = min(phaseEndsAt ?? ∞, expiresAt)` 로 확장한다. 예외 시 재설정하지 않으면 6회 재시도 후 멈춘다 [CITED: .../durable-objects/api/alarms/].

### Pattern 5: 서버 시계 오프셋 — 구현 있음, 훅 연결이 남음
`src/net/clock.ts` 의 `estimateOffset(samples)`·`remainingMs(deadline, offset, localNow)` 가 있다(01-03). 현재 `useRoomConnection` 은 상태 메시지마다 `serverNow - Date.now()` 한 점으로 오프셋을 정한다 [VERIFIED: useRoomConnection.ts:78 `setOffset(msg.view.serverNow - Date.now())`] — 편차가 네트워크 지연만큼 생긴다. 새 훅은 접속 직후·`visible` 복귀 때 `ping{c}` 3~5회로 최소 RTT 표본을 모아 `estimateOffset` 을 쓴다.

### Pattern 6: 방 만들기·참가·미리보기를 HTTP(RPC)로, 실시간은 WS `hello{token}` 으로 — 미리보기 확장
현재 Worker 라우트는 `/api/health`, `POST /api/rooms`, `GET /api/rooms/:code/ws` 뿐이다 [VERIFIED: worker/index.ts:65-76]. 01-08 이 `GET /api/rooms/:code`(미리보기)와 `POST /api/rooms/:code/join` 을 더한다. `RoomPreview` 의 현재 모양과 개정:
```typescript
// shared/protocol.ts:29-35 (현재, 그대로 인용)
export interface RoomPreview {
  code: string;
  hostNickname: string;
  playerCount: number;
  maxPlayers: number;
  phase: PhaseId;
}
// 개정(C2): players 추가. 역할·토큰·playerId·connected 없음 — 키는 정확히 {seat, nickname}
export interface PreviewPlayer { seat: number; nickname: string }
export interface RoomPreview { /* 위 필드 + */ players: PreviewPlayer[] }
```
- **허용 목록 빌더**: `buildPreview(state, now)` 를 `shared/game/view.ts` 에 두고 객체 리터럴로 만든다(`Player` 를 펼쳐 복사하지 않는다 — buildView 와 같은 규칙).
- **`players` 는 `phase === "lobby"` 일 때만 채우고 그 밖에는 `[]`**를 권고한다(시작된 방의 앉은 사람 목록은 S-02 가 쓰지 않는다: 시작됨·정원 초과는 사유 문구만. 비인증 공개 엔드포인트의 노출을 줄임). [ASSUMED 설계 권고 — Open Question 5]
- `playerCount` 는 **자리 수**(끊긴 사람 포함), 정원 판정과 같은 기준. 연결자 수는 미리보기에 넣지 않는다(UI 가 쓰지 않음; S-02 문구 "{n} / 8명이 모였어요" 는 앉은 사람 수).
- `hostNickname` 은 현재 UI-SPEC S-02 가 쓰지 않는다("○○님의 방" 제거). 01-02 의 테스트가 의존하는지 계획에서 확인하고, 안 쓰면 유지(해가 없음)하거나 제거. 공유 문구는 방장 닉네임을 `RoomView` 에서 얻는다(`buildShareText(host, code)`).
- 응답 헤더 `cache-control: no-store`(현재 `json()` 헬퍼가 이미 설정 [VERIFIED: worker/index.ts:11-19]). 존재하지 않는/만료 방은 404 `ROOM_NOT_FOUND`, 코드 형식 오류는 `isRoomCode` 로 DO 를 부르기 전에 404.
- **S-02 폴링**: `document.visibilityState === "visible"` 인 동안만 10초 간격, `visibilitychange`→visible 때 즉시 1회, 화면을 떠나면 정리. 실패(네트워크)는 마지막 표시 유지(조용히 다음 주기). 404 는 "방을 찾을 수 없어요" 로 전환. 폴링 1회 = DO 요청 1회(빈 방은 쓰기 없음)라 비용은 작지만 열어 둔 탭이 많으면 곱해진다(Pitfall 18).
- 참가는 `POST .../join` → `{token, seat}` 또는 4xx `{error}`. 응답 코드 → 화면 위치 → 문구 매핑은 UI-SPEC "Error state" 표가 정본이다. 매핑 함수 `messageForApiError(error, context: "home-code" | "link" | "create")` 를 `src/net/copy.ts` 에 두고 단위 테스트(R16).
- **HTTP join 직후 WS 연결 전**에는 서버 상태 `connected=false` 다 — 이 창에서는 시작 조건 계산에서 빠진다(Pitfall 24). join 처리 직후에도 기존 소켓들에 방송해야 다른 사람 화면에 자리가 나타난다.

### Pattern 7: 자리 배치 순수 함수 — 구현 있음
`shared/seatLayout.ts` 가 있다(01-03) [VERIFIED: shared/seatLayout.ts:17-36 `seatLayout(seat, mySeat, total = SEAT_COUNT, rx = 40, ry = 22)`, `scale: 0.62 + 0.38 * depth`]. 디자인 시스템 `Table` 의 `seatLayout` 과 같은 식이다. 장면 크기 문제는 Pitfall 16.

### Pattern 8: 시작 조건 = 연결된 사람 ≥ 4, 정원 = 자리 수 (C1)
**What:** 두 개념을 분리한다. 정원(`MAX_PLAYERS` = 8)은 `players.length`(끊긴 사람 포함, 나가기·내보내기로만 줄어듦). 시작 조건은 `connectedCount(players) >= MIN_PLAYERS`. 역할은 시작 순간 `players` **전원**에게 배정한다(자리 ≥ 연결자 ≥ 4 이므로 `ROLE_TABLE` 의 4~8 범위 안).
**Where it lands:** 순수 규칙·테스트 = 01-04, `startGame` = 01-07, DO `start` 처리 = 01-08, 화면 = 01-06.
**테스트 경계(꼭 넣을 케이스):** ① 연결 4 + 끊김 0 = 시작 가능 ② 연결 4 + 끊김 2(자리 6) = 시작 가능, 6인 구성표로 6명 모두 역할 ③ 연결 3 + 끊김 5(자리 8) = `NOT_ENOUGH_PLAYERS` ④ 비방장 `NOT_HOST` ⑤ lobby 아님 `WRONG_PHASE` ⑥ 시작 직전에 연결자가 3으로 줄면 서버가 거절하고 **그 소켓에 최신 `state` 를 다시 보낸다**(클라이언트 스냅샷이 권위, UI-SPEC "시작이 거절되면 서버 view 대로 다시 그린다") ⑦ 끊긴 사람이 `assigning`/`roleReveal` 도중 `hello` 로 돌아오면 같은 `phaseEndsAt` 와 자기 `me.role` 을 받는다 ⑧ 시작 후 `kick` 은 `CANNOT_KICK`.
**공유 헬퍼:** `connectedCount(players: readonly {connected: boolean}[])` 를 `shared/game/room.ts` 에서 export 해 서버(`canStart`)와 클라이언트(`PublicPlayer[]`, 버튼·인원 표시)가 같은 함수를 쓴다.

### Pattern 9: 접근 가능한 바텀 시트 = 네이티브 `<dialog>` 한 부품 (C3)
**What:** C-01(내 역할)·C-03(공유)·ConfirmSheet 가 같은 `Sheet` 부품을 쓴다. 규격은 UI-SPEC(닫기 버튼·막 누르기·아래로 끌기·Esc, 면 `--night-800`, 위 모서리 `--radius-lg`, 240ms).
**구조(권고):**
- `<dialog>` 를 화면 전체(`width:100%; height:100%; max-width:none; max-height:none; border:0; padding:0; background:transparent`)로 만들고, 안에 ① 막 `<div>`(배경 `var(--scrim)`, 누르면 닫기) ② 시트 `<div role=… >`(`margin: auto auto 0; max-width: 430px`) 를 둔다. `::backdrop` 은 투명으로 둔다. `showModal()` 은 배경 비활성(inert)·포커스 가두기·Esc(`cancel` 이벤트)를 기본 제공한다 [ASSUMED: HTML 스펙 지식, UAT 로 iOS Safari 확인].
- `cancel` 이벤트는 `preventDefault()` 후 **자체 닫기 애니메이션**(`closing` 상태 → 240ms 뒤 `close()`)으로 처리한다. 종료 애니메이션은 `animationend` 에만 의존하지 말고 **타임아웃 폴백**(240ms + 여유)도 둔다(탭이 숨겨진 상태 등에서 이벤트가 안 오면 시트가 안 닫힘).
- 열림 상태는 시트 안이 아니라 **`RoomScreen` 이 쥔다**: 단계가 바뀌어도 [내 역할] 시트는 열린 채(UI-SPEC E14 phase-change), `Sheet` 는 단계 화면이 언마운트돼도 살아 있어야 한다.
- 포커스: 열 때 `dialogRef.current.showModal()` 직후 **명시적으로** 포커스를 줄 요소(`ConfirmSheet` 는 [취소], 나머지는 [닫기])를 `focus()` 한다. React 의 `autoFocus` 는 마운트 시점(대화상자가 열리기 전)에 동작하므로 의존하지 않는다 [ASSUMED]. 닫으면 브라우저가 이전 포커스(열었던 버튼)로 돌려준다 [ASSUMED: 스펙 동작].
- StrictMode: effect 가 두 번 돈다 → `if (!dlg.open) dlg.showModal()` 로 가드, 정리 함수에서 `dlg.open` 이면 `close()`.
- **끌어서 닫기(단순형):** 손잡이 막대 영역에만 `touch-action: none` + 포인터 이벤트(`setPointerCapture`), 이동량을 시트 `transform: translateY(var(--drag-y))` 로 반영, 놓을 때 `dy > 96px` 또는 속도 > 0.5px/ms 이면 닫기, 아니면 원위치. 시트 본문은 스크롤 가능하므로 본문에는 걸지 않는다. 라이브러리 없음.
- 높이: 내용만큼, `max-height: 80dvh; overflow-y: auto`(UI-SPEC E14 overflow).
- `prefers-reduced-motion`: 전역 규칙이 전환을 0.01ms 로 만든다. 상태 로직(닫힘)은 타임아웃 폴백이 있으므로 영향 없음.
- happy-dom 에서 `showModal()`/`open` 은 동작하지만 포커스 가두기는 재현되지 않는다 → 클라이언트 테스트는 열림/닫힘·Esc(`cancel` 디스패치)·막 클릭·`aria-label`, 포커스 가두기는 실기기 UAT 로 둔다.

### Pattern 10: 역할 카드 면 전이 = 순수 함수 (C4)
**규칙:** 상태 `{ face: "back"|"front", locked: boolean, seenFront: boolean }`. ① 시작 시각 `t0 = phaseEndsAt - phaseDurationMs`, 자동 시각 `t0 + 5000`(서버시각, 오프셋 보정). ② 사용자가 누르면 면을 뒤집고 **`locked = true`(자동 뒤집기 소진)**. ③ 5초 시각에 `locked` 가 아니면 앞면으로 뒤집고 `locked = true`. ④ `now >= t0+5000` 에 들어온 사람(재접속)은 처음부터 `{front, locked}`. ⑤ `me.role` 이 없으면 뒤집기 입력 무시(뒷면 고정). ⑥ 앞면이 한 번이라도 되면 `seenFront = true`.
이 전이를 순수 함수(`nextCardState(state, event, now)`)로 두고 타이머는 **마감 시각까지 `setTimeout` 하나**(`delay = autoAt - serverNow`)로 건다(간격 타이머 불필요). 타이머는 effect 정리에서 해제, 단계가 바뀌면 상태 초기화.
**시트와의 관계(C-01, UI-SPEC "S-05 에서 카드를 한 번도 앞면으로 보지 않았으면 시트에도 카드 뒷면만"):** `seenFront` 를 `RoomScreen` 으로 올려 `roleReveal` 동안 `!seenFront` 면 시트에 뒷면만 보인다. `roleReveal` 이후(day)에는 시트가 항상 앞면(역할 확인을 놓친 사람도 여기서 확인, D-19) — 이 경계는 UI-SPEC 문구가 모호하다(Open Question 1).
**DOM 비노출:** 뒷면은 모든 사람에게 같은 마크업이고 역할을 읽지 않는다. 참고 구현 `RoleCard` 는 앞면을 항상 렌더한다(Pitfall 20).
**애니메이션:** 800ms `rotateY`, `perspective: 900px`, `backface-visibility: hidden`(+`-webkit-` 접두), 카드 컨테이너 `transform-style: preserve-3d`. 면 전환은 상태가 정하고 CSS 전환이 그린다.

### Pattern 11: 토스트·자리 전이는 뷰 차이에서 (C5)
서버는 이벤트를 따로 보내지 않는다. 순수 함수 하나가 두 소비자(토스트, 자리 등장/퇴장 애니메이션)를 먹인다:
```typescript
// src/net/roomDiff.ts — 순수. prev 가 null 이면(첫 스냅샷·재접속 직후) 빈 결과.
import type { RoomView } from "../../shared/protocol";
export interface RoomDiff { joined: { seat: number; nickname: string }[]; left: number[]; newHost: { seat: number; nickname: string } | null }
export function diffRoomViews(prev: RoomView | null, next: RoomView): RoomDiff {
  if (!prev) return { joined: [], left: [], newHost: null };
  const key = (p: { seat: number; nickname: string }) => `${p.seat}:${p.nickname}`;   // 자리 재사용을 다른 사람으로 구분
  const before = new Set(prev.players.map(key));
  const after = new Set(next.players.map(key));
  const joined = next.players.filter((p) => !before.has(key(p)) && p.seat !== next.me.seat);   // 나에 대한 입장 토스트 없음
  const left = prev.players.filter((p) => !after.has(key(p))).map((p) => p.seat);
  const prevHost = prev.players.find((p) => p.isHost);
  const nextHost = next.players.find((p) => p.isHost);
  const newHost = prevHost && nextHost && prevHost.seat !== nextHost.seat ? { seat: nextHost.seat, nickname: nextHost.nickname } : null;
  return { joined, left, newHost };
}
```
[ASSUMED 설계안 — 필드 이름은 protocol.ts:59-64 의 `PublicPlayer { seat, nickname, connected, isHost }` 와 맞춤]
- 토스트 우선순위: 같은 diff 에 `newHost` 와 `joined` 가 함께 나오면 **방장 변경**을 보인다(한 번에 하나, 새 것이 이전 것을 바꿈 — UI-SPEC). `connected` 변화는 토스트 없음(UI-SPEC 은 입장·방장 변경 둘뿐).
- **"처음 화면을 열 때·재접속 때 없음":** `prev` 를 소켓이 새로 열릴 때마다 `null` 로 리셋해야 한다. 훅이 `epoch`(소켓 `open` 마다 +1)를 노출하고, 소비 쪽은 `epoch` 가 바뀌면 `prevRef = null`. 같은 이유로 StrictMode 이중 effect 에서도 첫 스냅샷에 토스트가 나오면 안 된다(테스트로 고정).
- 자리 등장 애니메이션도 같은 diff: `joined`/`left` 로 `entering`/`leaving` 표시. `left` 는 320ms 동안 직전 뷰의 인물을 `leaving` 으로 남겨 두어야 사라지는 애니메이션이 보인다(훅 `useSeatTransitions`). 처음 그릴 때 이미 앉아 있던 사람은 애니메이션 없음(UI-SPEC Motion 규칙). 빈 자리는 비워 둔다(빈 의자 없음 — 참고 구현 `Chair` 는 쓰지 않는다).

### Pattern 12: 연결 상태기계 — 띠 52px·"다시 연결됐어요"·30초 포기 (C6)
현재 훅: 1초 고정 재시도, 연속 5회 실패면 멈춤 [VERIFIED: useRoomConnection.ts:17-20 `const RETRY_DELAY_MS = 1000;` `const MAX_CONSECUTIVE_FAILURES = 5;`], 상태 `"connecting" | "open" | "reconnecting" | "replaced" | "removed"`(`:5`). 01-05 가 이를 교체한다. 권고 모양:
- 상태에 `"failed"`(30초 포기) 추가. 순수 리듀서(`linkReducer(state, event, now)`)로 `status`, `bannerMode: "hidden" | "reconnecting" | "restored"`, `failingSince`, `epoch` 를 관리하고 훅은 이벤트(`open`, `close`, `visible`, `hidden`, `online`, `tick`, `retryClicked`)만 넘긴다 → fake timer 없이 테스트.
- 띠 규칙: `view` 가 있고 `status ∈ {connecting, reconnecting}` 이면 `reconnecting`. 다시 `open`+첫 `state` 를 받으면 `restored`(2초) → `hidden`. `view` 가 없으면 띠 대신 전체 화면 "연결 중…".
- **30초는 "보이는 상태에서 실패한 시간"**: `failingSince` 는 **페이지가 visible 인 동안 첫 실패 시각**으로 정하고 `hidden` 에서는 흘려보내지 않거나 `visible` 복귀 때 리셋한다. 단순히 "끊긴 시각으로부터 30초" 로 하면 화면 잠금 2분 뒤 켜는 순간 곧바로 "연결할 수 없어요" 가 뜬다(Pitfall 21). 포기 후 [다시 시도] 는 `failingSince` 리셋 + 즉시 재연결.
- 재시도: 지수 백오프(예: 0.5s→1→2→4→5s 상한) + 지터. `visibilitychange`(visible)·`pageshow`·`online` 에서 즉시 `ping`, 2~3초 안에 `pong` 이 없으면 소켓을 닫고 재연결(iOS 좀비 소켓, Pitfall 8).
- 닫힘 코드: 4001(`REPLACED`) → "다른 창에서 이 방에 들어갔어요"([다시 연결]/[처음으로]), 4003(`REMOVED`) → 사유별 ErrorScreen [VERIFIED: protocol.ts:91-92 `CLOSE_CODES = { REPLACED: 4001, REMOVED: 4003 }`, `RemovedReason = "left" | "kicked" | "invalid_token" | "room_closed"`].
- 끊긴 동안 서버로 가는 입력은 UI 에서 끈다(`canSend = status === "open"`). 현재 `send` 는 OPEN 이 아니면 조용히 버린다 [VERIFIED: useRoomConnection.ts:107-110] — 화면이 이를 믿고 버튼을 켜 두면 눌림이 사라진다. 카드 뒤집기·시트처럼 화면 안에서 끝나는 동작은 그대로 된다.
- **레이아웃:** 띠는 흐름 안 `flex: none; height: var(--space-…)`가 아니라 52px(UI-SPEC 예외 항목, 토큰 없음 → CSS 상수 또는 tokens.json `size` 에 추가). 게임 화면의 장면은 `flex: 1; min-height: 0` 로 남은 높이를 받아 띠 등장 시 줄어든다. 띠가 나타나고 사라질 때 장면 크기가 바뀌므로 `transition: height 180ms` 정도로 부드럽게(선택).

### Pattern 13: 에셋 경로 헬퍼·프리로드·존재 검사 (C7)
- **경로는 한 모듈**(`src/net/assets.ts`)에서만 만든다. `FIGURE_IDS` 는 참고 구현에서 그대로 옮긴다 [VERIFIED: design/design-system/components/bundle.js:196 `var FIGURE_IDS = ['fig1_boy_brown', 'fig2_boy_black', 'fig3_boy_blonde', 'fig4_girl_brown', 'fig5_girl_black', 'fig6_girl_auburn', 'fig7_boy_blackhat', 'fig8_girl_tanhat'];`]. 자리 → 인물 = `FIGURE_IDS[seat]`(seat 0~7).
- **파일명의 `@` 는 URL 에서 `%40` 으로 쓴다**(Pitfall 14).
- `<img>` 는 `width={72} height={96}`(논리 크기) + `srcSet` — 밀도 서술자 선택은 Pitfall 15.
- **프리로드**: React 19 `preload()`(`react-dom`)는 렌더 중·effect·이벤트 처리기 어디서나 호출 가능하고 같은 `href`(이미지는 `imageSrcSet`·`imageSizes` 포함) 중복 호출은 한 번과 같다 [CITED: react.dev/reference/react-dom/preload]. 시점: ① 앱 시작(S-01·S-02 마운트): `bg_game_lobby.svg` + 8명 인물(대기실 첫 그림이 비어 보이지 않게) ② 대기실·배정(S-04) 동안: `bg_game_day.svg`(S-06 에서 800ms 아침빛이 번질 때 튀지 않게)와 **직업 그림 4종 전부**(어떤 역할인지 상관없이 같은 네트워크 패턴, 카드가 뒤집히는 800ms 중 이미지가 늦게 뜨는 일 방지; 합계 약 150KB). [ASSUMED: 용량은 `ls -la` 로 각 약 35~39KB(@2x) 확인, 합산은 추정]
- **존재 검사 테스트**: `import.meta.glob("/public/characters/table/*.png")` 의 키로 헬퍼가 만드는 모든 URL(디코딩한 경로)이 실제 파일인지 확인한다. 이 방식은 Vite 기능이라 `node:fs`·`@types/node` 가 필요 없다 [VERIFIED: 스크래치 사본에서 `import.meta.glob("/public/characters/table/*.png")` 를 unit 프로젝트(node 환경)에서 실행해 통과, `tsc -p tsconfig.app.json --noEmit` 오류 없음].

### Pattern 14: 디자인 시스템 참고 구현 → 앱 이식 (C10)
**방법(권고):** `design/design-system/components/bundle.css`(약 19KB, 값은 토큰 변수만 씀)를 `src/styles/ds.css` 로 복사해 클래스 이름 `mf-*` 를 유지한 채 아래 델타만 고친다. `bundle.js` 의 `React.createElement` IIFE 를 TSX 로 옮기되 `window.React`·`asset()`·`ASSET_BLOBS`(캔버스 전용 `/_blob/…` 주소)는 쓰지 않는다. 타입은 `index.d.ts` 의 props 를 기준으로 한다. 이렇게 하면 디자인 시스템과 앱의 클래스·구조가 같아 이후 아티팩트와 대조하기 쉽다.

| 참고 구현 | 앱 부품(파일) | UI-SPEC 과 다른 곳 → 앱에서 바꿀 것 |
|-----------|--------------|--------------------------------------|
| `Button`, `TextField`, `Icon` | components/Button, TextField, Icon | `Icon` 경로(`share`, `close`, `check`, `disconnected`, `diamond` 등)는 그대로 옮겨 쓴다. 아이콘 폰트·이모지 금지. TextField 에러 문구 `role="alert"`+`aria-describedby` 이미 있음 |
| `Timer(remainingMs, durationMs)` | components/Timer | 숫자가 정수 초(`sec`)인 것을 **`m:ss`**(`0:15`)로. UI-SPEC 의 `timer-pop`(220ms, 마지막 5초 매 초) 추가, `role="timer"`·`aria-label="남은 시간 N초"` 유지. 입력은 `endsAt, durationMs, offset`(UI-SPEC)이고 참고 구현은 `remainingMs` — 훅 `useCountdown` 이 변환 |
| `PhaseBar` | components/PhaseBar | UI-SPEC S-05 는 제목(heading)·안내(label)·[내 역할]·Timer 배치 — 참고 구현은 `phase`/`instruction`(16px 700) 구조라 맞춰 다시 배치 |
| `ReconnectBanner` | components/ReconnectBanner | **32px `position:absolute` → 52px 흐름 안**(내용을 밀어냄), 면 `--night-700`, 문구 "연결이 끊겼어요 · 다시 연결하는 중", "다시 연결됐어요" 2초 상태 추가 |
| `ConfirmSheet` | components/ConfirmSheet | `div` 대화상자 → Pattern 9 의 `<dialog>` `Sheet` 위에 얹는다. 열면 [취소] 포커스 |
| `RoleCard` | components/RoleCard | 뒤집기 600ms → **800ms**, 폭 `min(72vw,280px)` → **`min(64vw,240px)`** 이고 높이 ≤ 52dvh, 직업 그림 폭 150(`@2x`), 동료 줄 "동료: …" → **"동료 · {이름}, {이름}" / "혼자예요"**, 뒷면 힌트("눌러서 확인")는 카드 밖 안내 두 줄로 이동, **앞면을 항상 렌더하는 구조 → 뒤집기 시점에 마운트**(Pitfall 20) |
| `MyRoleButton` | components/MyRoleButton | 누르고 있기·`aria-pressed`·안내 "누르고 있는 동안만 보여요" **전부 삭제**. [내 역할] = 보조 버튼 작은 크기(44) + 카드 아이콘, 눌러 시트 열기 |
| `Figure` | components/Figure | `@4x` 만 쓰고 `asset()` 경유 → `%40` 헬퍼 + `srcSet`(Pitfall 15), 끊김은 CSS `grayscale(1)` + `opacity .6`(참고 구현 `.mf-figure--disconnected` 와 같음), `dead` 상태는 1페이즈 미사용 |
| `Backdrop` | components/Backdrop | `asset()` → `/backgrounds/bg_{layout}_{variant}.svg` 절대 경로. 배경 교차 페이드는 같은 단계 안에서는 장면을 바꾸지 않으므로 필수 아님 |
| `Table` | components/Table | **빈 의자(`Chair`) 삭제**, 방장 **왕관 → "방장" 알약 배지**(이름표 아래), 동료 마름모·링은 유지(막 위층 z). 이름표 `max-width` 96/72px 는 UI-SPEC 과 같음. 인물 높이 `FIG_H = 21.33` 은 **장면이 4:5 일 때만 맞는 값**(Pitfall 16) |
| (없음) | components/Sheet, Toast, ShareSheet, MyRoleSheet | 참고 구현에 없음(R18) — UI-SPEC 문서가 정본 |
| `Announcement`, `Chip`, `EmojiBar`, `QuickMessagePanel`, `MessageLog`, `VerdictPicker`, `ResultList`, `Notice` | **이식하지 않는다**(1페이즈 범위 밖) | 이후 페이즈 |

CSS 정리: 기존 `src/styles/screens.css`(161줄)는 진홍 버튼·진홍 포커스 링·진홍 방장 배지와 글자 크기 12/13/15/17/40/56px 를 쓰고 있어 UI-SPEC(글자 14/16/24/36, 진홍 예약 5곳)과 어긋난다 [VERIFIED: screens.css grep 결과 `outline: 2px solid var(--crimson-400);`, `background: var(--crimson-500);`, `font-size: 17px;` 등]. `base.css` 의 `.app-version` 도 `font-size: 11px; color: var(--gray-500);`(글자에 gray-500 금지) — 다시 쓴다(UI-SPEC R2). `ds.css` 와 새 `screens.css` 모두 hex 직접 사용 금지(토큰 변수만).

### Pattern 15: 카운트다운 `useCountdown`
입력 `endsAt`, `durationMs`, `offset`(UI-SPEC). 순수 함수 `countdown(endsAt, durationMs, offset, localNow)` → `{ remainingMs, seconds(ceil), urgent(≤5000 && >0), ratio }`, 표시 `formatMmSs(seconds)`. 컴포넌트는 `remainingMs > 0` 인 동안 250ms 간격으로 다시 그리고(`visibilitychange` 에서도 한 번), 막대는 `transform: scaleX(ratio)` + `transition: transform 250ms linear`. 초가 바뀔 때 `timer-pop` 을 다시 돌리려면 숫자 `span` 의 `key` 를 `seconds` 로 둔다. 마감이 지나면 0:00 + 빈 막대.

### Anti-Patterns to Avoid
- 클라이언트에서 역할을 숨기는 방식(모든 역할 전송 후 가리기), `players[]` 에 `role` 을 넣고 `undefined` 로 비우기: 프로젝트 불변식 위반. 미리보기 응답에도 해당.
- `setTimeout`/`setInterval` 로 **서버** 단계 타이머 구현(하이버네이션). (클라이언트 표시용 타이머는 마감 시각에서 계산하므로 무방.)
- `ws.accept()` 사용(하이버네이션 불가). 클라이언트 입력 무검증.
- **카드 앞면(역할 이름·직업 그림)을 뒷면 상태에서도 DOM 에 렌더**(참고 구현 방식 그대로 이식).
- **에셋 URL 에 `@` 를 그대로 쓰기**(307 한 번 더, Pitfall 14), 에셋 URL 을 컴포넌트마다 문자열로 흩뿌리기.
- **토스트·애니메이션을 서버 이벤트로 따로 보내기**: 스냅샷 방식과 재접속 규칙이 깨진다. 뷰 차이로 계산.
- **재연결 30초를 벽시계로 재기**(화면 잠금 복귀 즉시 포기 화면).
- 시트 막을 `::backdrop` + 커스텀 속성으로 그리기, `autoFocus` 에 의존해 대화상자 포커스 지정.
- 이식하며 참고 구현의 UI-SPEC 과 다른 값(600ms, 32px 띠, 누르고 있기, 왕관, 빈 의자, 정수 초)을 그대로 두기 — Pattern 14 표 확인.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Worker+DO+정적 에셋 파이프라인 | 자체 esbuild/업로드 스크립트 | `@cloudflare/vite-plugin` + `wrangler deploy` | 01-01 완료 |
| DO 테스트 하네스 | 가짜 타이머 | `cloudflare:test` `runDurableObjectAlarm`·`evictDurableObject` | 이전 연구 |
| 하이버네이션 WebSocket 관리 | `Map` 보관 | `ctx.acceptWebSocket` + 첨부 | 01-02 완료 |
| 메시지 스키마 검증 | `typeof` 체인 | zod `discriminatedUnion("t")` | 01-02 완료 |
| 닉네임 길이·중복 | `.length` | `shared/nickname.ts`(Intl.Segmenter) | 01-03 완료 |
| 난수 | `Math.random()` | `crypto.getRandomValues`(`worker/random.ts`) | 01-02 완료 |
| **시트의 포커스 가두기·Esc·배경 비활성** | 포커스 트랩 직접 구현, focus-trap 패키지 | 네이티브 `<dialog>.showModal()` | 직접 만든 트랩은 `Tab` 순환·스크린리더 가상 커서·`inert` 를 놓치기 쉽다. 패키지는 새 의존 금지 |
| **이미지 프리로드** | `Image()` 객체를 전역에 쌓기 | `react-dom` 의 `preload()` | React 19 내장, 중복 호출 합쳐짐 [CITED: react.dev/reference/react-dom/preload] |
| **에셋 존재 확인 테스트** | `node:fs` 로 디렉터리 읽기(@types/node 미선언) | `import.meta.glob` | 위 Pattern 13 |
| **토스트 라이브러리** | react-hot-toast 등 | 한 번에 하나만 보이는 `Toast`(상태 1개 + 2초 타이머) | UI-SPEC "한 번에 하나, 새 토스트가 이전 것을 바꿈" 은 상태 한 칸이면 끝 |
| **바텀 시트 제스처 라이브러리** | vaul 등 | 포인터 이벤트 + `translateY`(Pattern 9) | 요구는 "끌어서 닫기" 단순형뿐 |
| 카카오톡 공유 SDK | 카카오 JS SDK | OG 메타 + Web Share | 앱 등록·도메인 등록이 필요, 과함 |
| 서비스 워커/PWA | vite-plugin-pwa | 넣지 않는다 | 이 페이즈 성공 기준 5(재배포 즉시 반영)와 충돌 위험 |

**Key insight:** 이 페이즈의 복잡성은 라이브러리 부족이 아니라 "상태 공개 경계", "하이버네이션 생애주기", 그리고 이번 개정으로 늘어난 "스냅샷 두 개의 차이로 UI 이벤트를 만드는 규칙"에 있다. 전부 순수 함수 + 허용 목록 타입으로 눌러 두면 이후 페이즈(밤·투표)도 같은 틀을 재사용한다.

## Common Pitfalls

### Pitfall 1: `compatibility_date` 를 "오늘"로 쓰면 로컬 `vite dev` 가 뜨지 않는다 — 유지
`compatibility_date` 는 설치된 workerd 가 지원하는 날짜 이하(현재 `2026-10-12`)로 고정한다. 의존성을 올릴 때 `npm ls workerd miniflare` 로 확인(현재 `workerd@1.20261012.1` [VERIFIED: `npm ls workerd` 출력]).

### Pitfall 2: 하이버네이션 후 인메모리 상태·`connected` 플래그가 틀어진다 — 유지(01-02 구현됨)

### Pitfall 3: 같은 사람의 탭 2개/재접속으로 낡은 소켓의 close 가 `connected=false` 를 덮는다 — 유지(01-02 구현됨: `connId`, 4001 replaced)

### Pitfall 4: 알람 하나뿐인데 두 용도로 쓰다 서로 덮어쓴다 — 유지(01-08)

### Pitfall 5: `wrangler deploy` 시 DO 클래스 이름·선언을 바꾸면 되돌릴 수 없다 — 유지(결정 0009)

### Pitfall 6: 공유가 LAN 개발(HTTP)에서 조용히 죽는다 — 개정(C8: 시트로 분리)
`navigator.share`·`navigator.clipboard` 는 보안 컨텍스트(HTTPS)에서만 있다 [CITED: developer.mozilla.org Navigator/share, Clipboard/writeText]. LAN `http://192.168.x.x:5173` 에서는 둘 다 없다. `share()` 는 사용자 제스처 안에서만, 취소는 `AbortError`.
**C-03 의 두 버튼은 다른 동작이다:** [공유하기] = Web Share 만(없으면 **버튼을 숨김**: `typeof navigator.share === "function"` 로 렌더 시 판단), [링크 복사] = 클립보드만(성공 시 2초 "복사했어요", 실패 시 링크 칸 선택 + "길게 눌러 복사하세요"). 기존 `shareRoom`(공유 → 복사 → 수동 3단 체인, `ShareOutcome = "shared" | "copied" | "manual" | "cancelled"`)은 이 분리에 맞지 않으므로, `src/net/share.ts` 에 `copyLink(nav, url)` 와 `shareOnly(nav, data)` 를 **더하고** 기존 체인은 유지 또는 제거를 계획에서 정한다(01-03 테스트가 체인을 검증 중). [VERIFIED: share.ts `export type ShareOutcome = "shared" | "copied" | "manual" | "cancelled";`]
**제스처:** 두 핸들러 모두 클릭 처리기 **안에서 첫 `await` 앞에** 호출한다(다른 `await` 뒤에 부르면 iOS 가 사용자 활성화를 잃을 수 있음 [ASSUMED]). 링크 칸은 `readOnly` 이고 포커스 시 전체 선택: iOS 는 `input.select()` 만으로 부족해 `setSelectionRange(0, input.value.length)` 도 호출한다 [ASSUMED]. 최종 카카오톡 공유 확인은 배포(HTTPS) 주소에서 실제 폰으로(수동 UAT).

### Pitfall 7: DO + WebSocket 통합 테스트가 격리 설정에 민감하다 — 유지
테스트마다 서로 다른 방 코드를 쓰고, 불안정해지면 해당 프로젝트만 `--max-workers=1 --no-isolate`. 동적 `import()` 는 DO 핸들러 안에서 실패하므로 정적 import 만. (01-02 에서 워커 테스트 통과 중.)

### Pitfall 8: iOS Safari 에서 화면 잠금 후 "열려 있는 척하는" 소켓 — 유지, Pattern 12 와 연결
복귀 시 `readyState` 가 OPEN 인 좀비 소켓일 수 있다 `[ASSUMED]`. `visibilitychange`/`pageshow`/`online` 에서 즉시 `ping`, 2~3초 `pong` 없으면 닫고 재연결. StrictMode 는 개발에서 effect 를 두 번 돌리므로 정리에서 소켓을 닫고 연결 로직은 멱등하게.

### Pitfall 9: 서버가 연결 끊김을 늦게 안다(죽은 피어) — 유지
이벤트 기반만 구현, 실기기 UAT 에서 관찰. 시작 조건이 이제 `connected` 에 직접 의존하므로(C1) 좀비 `connected=true` 가 남으면 시작이 가능한 것처럼 보이다가 실제로는 사람이 없는 채 시작될 수 있다 — 이 경우 그 사람은 "돌아오면 이어서" 규칙(D-16)으로 처리되므로 치명적이지 않지만 UAT 에서 확인한다(Open Question 7).

### ~~Pitfall 10: [내 역할] 길게 누르기가 iOS 기본 동작에 가로채인다~~ — **삭제(결정 0012)**
[내 역할] 은 누르고 있기가 아니라 시트다. `-webkit-touch-callout`/`contextmenu` 억제 지침과 `pointercancel` 처리는 더 이상 필요 없다. 화면 캡처는 막을 수 없다는 설계상 수용은 그대로(UI-SPEC "역할 비노출").

### Pitfall 11: 카카오톡 미리보기 캐시와 `og:url` — 개정
카카오 스크랩은 약 1시간 캐시, 이미지는 JPG/PNG, `og:url` 이 실제 주소와 다르면 `og:url` 쪽을 읽는다 [CITED: devtalk.kakao.com 스크랩 FAQ]. `/r/:code` 도 같은 `index.html` 이라 OG 는 모든 방 링크에서 동일 → **`og:url` 은 넣지 않는다**. **개정:** UI-SPEC E13 은 임시 `public/og.png`(1200×630) + `og:image` 절대 주소·크기를 요구한다. 배포 주소가 `https://minifia.dhplay.workers.dev` 로 확정됐으므로(`scripts/prod-url.txt`) 절대 URL 을 쓸 수 있다. PNG 는 빌드 도구 없이 **한 번 만들어 커밋**한다(예: `design/backgrounds/A_cute/bg_entry_lobby.png` 를 1200×630 으로 잘라 "미니피아" 글자 얹기 — 새 패키지 없이 가능한 수단은 계획에서 정함, Open Question 8). `<title>`·OG 제목·설명도 "미니피아" 기준으로 바꾼다(현재 index.html 은 "minifia — 마피아 한 판" [VERIFIED: index.html]). 방별 문구는 Web Share 의 `text` 로 보낸다.

### Pitfall 12: 닉네임 비교·표시 — 유지(01-03 구현됨)

> 번호 13 은 비어 있다(이전 연구에 없었음). 개정에서 새로 더한 항목은 14부터 시작한다.

### Pitfall 14: 에셋 파일명의 `@` 가 정적 에셋 서빙에서 307 리다이렉트된다 (C7)
**What goes wrong:** `/characters/table/fig1_boy_brown_default@2x.png` 를 요청하면 `307 Temporary Redirect → location: /characters/table/fig1_boy_brown_default%402x.png` 가 오고 그 주소가 200 이다. 이미지마다 왕복이 한 번 늘어난다.
**Evidence:** `vite build && vite preview` 스크래치 실행. `curl -I …default@2x.png` → `HTTP/1.1 307 Temporary Redirect … location: /characters/table/fig1_boy_brown_default%402x.png`, `curl -I …default%402x.png` → `HTTP/1.1 200 OK … content-type: image/png` [VERIFIED: 로컬 vite preview(miniflare) 출력]. 프로덕션(`workers.dev`)에서도 같은지는 이 세션에서 검증하지 못했다(에셋 미배포) — 같은 정적 에셋 서빙 코드를 쓸 것으로 추정 `[ASSUMED]`.
**How to avoid:** 코드에서 에셋 URL 을 만들 때 `@` 를 `%40` 으로 쓴다(헬퍼 한 곳). 파일을 개명하지 않아도 되고 디자인 원본 규칙(`ASSET_SPEC.md`: `<id>_<상태>@2x.png`)과 `public/` 사본이 같게 유지된다. 01-10 배포 후 `curl -I https://minifia.dhplay.workers.dev/characters/table/fig1_boy_brown_default%402x.png` 가 200 이고 `@` 형태가 307 인지 확인해 가정을 닫는다.
**Warning signs:** 개발자 도구 Network 에 같은 이미지 요청이 307 + 200 두 줄.

### Pitfall 15: 인물 그림 `srcset` 밀도 선택 — UI-SPEC 의 `@4x 2x` 는 DPR 2 폰에 3배 용량을 보낸다 (C7)
**What:** 파일은 `@2x` = 144×192, `@4x` = 288×384 이고 논리 크기는 72×96 CSS px [VERIFIED: `file` 출력 "PNG image data, 144 x 192" / "288 x 384"]. UI-SPEC 문구는 `src=@2x`, `srcset="…@4x.png 2x"`. 그러면 DPR 2 기기가 288px 파일(약 92KB)을 받아 144 장치 픽셀로 그린다 — 8명 × 약 92KB ≈ 740KB 대 `@2x` 8명 ≈ 255KB(파일 크기 `ls -la`: `@2x` 약 31~34KB, `@4x` 약 86~99KB [VERIFIED: ls 출력]). 자리는 크기 변환으로 최대 72px(내 자리)이라 DPR 2 에는 `@2x` 로 충분하다.
**처방(권고, UI-SPEC 과 다른 점은 계획에서 확정):** 밀도 서술자를 파일의 실제 밀도에 맞춘다: `srcSet="…%402x.png 2x, …%404x.png 4x"`, `src` 는 `@2x`. DPR 2 → `@2x`, DPR 3 → `@4x`(서술자 ≥ DPR 중 가장 작은 것을 고르는 것이 일반적 동작 `[ASSUMED]`). 느린 모바일 망에서 첫 대기실 그림 용량이 1/3 이 된다. Open Question 3.
**직업 그림:** 카드 앞면 폭 150px → DPR 2 에 300 장치 픽셀이 필요해 `@4x`(288)가 알맞다. `srcSet="…%402x.png 2x, …%404x.png 4x"` 로 같은 규칙을 쓰되, 카드 폭이 150(논리) 이므로 `@2x` 는 144px 로 약간 모자란다 — 직업 그림은 `@4x` 고정 + `width=150` 권고. [ASSUMED]

### Pitfall 16: 4:5 테이블 장면은 폰 높이 안에서 "줄어들어야" 하고, 참고 구현의 퍼센트 좌표는 4:5 일 때만 맞는다 (C7)
**What goes wrong:** 참고 구현 `.mf-table` 은 `aspect-ratio: 4/5`, 인물 높이 `FIG_H = 21.33`(장면 높이 대비 %) 이다. 이 값은 자리 폭 20%·그림 3:4·장면 4:5 에서만 나온다 — 자리 폭 = 장면 폭의 20%, 인물 높이 = 폭 × 4/3 = 장면 폭의 26.67%, 장면 높이는 폭의 1.25배 → 26.67 / 1.25 = 21.33% [VERIFIED: 계산, bundle.js:236 근처 `var FIG_H = 21.33; /* 인물 높이: 장면 높이 대비 % (72x96, 자리 폭 20%, 장면 4:5) */`]. 장면 높이를 억지로 줄이면(세로로 찌그러뜨리면) 이름표·링 위치가 어긋난다.
**크기 계산(추정):** 360×640 에서 위쪽 바(방 코드 display 36px + 라벨) 약 75~80px, 하단 시트 약 150~170px(방장) / 약 200px(참가자) → 장면에 남는 높이 약 390 / 340px. 재접속 띠 52px 가 더해지면 약 340 / 290px. 4:5 장면의 폭 = 높이 × 0.8 ≈ 310 / 270(띠 있을 때 270 / 230)px. [ASSUMED: 단위 추정, 01-10 실기기·폭 360 확인 대상 🧪]
**How to avoid:** 장면 상자를 **높이 기준**으로 만든다: 부모는 `flex: 1; min-height: 0`, 장면은 `height: 100%; aspect-ratio: 4 / 5; max-width: 100%; margin: 0 auto`(폭이 모자라면 폭에 맞춰 줄고, 남으면 가운데). 인물·이름표는 장면 상자 안의 퍼센트 좌표를 그대로 쓴다. 이름표는 항상 14px 이므로 장면이 작아지면 서로 겹칠 수 있다 — 360×640(+띠) 에서 겹침이 보이면 이름표 최대 폭(96/72px)을 줄이거나 말줄임을 더 쓴다(Claude 재량, D-08). 배경 그림은 장면 상자가 아니라 화면 전체(`cover`, `center top`)에 깐다.
**S-02 의 8명 한 줄은 360px 에서 안 들어간다(추정):** 좌우 여백 24 → 가용 312px / 8명 = 인물당 39px. 이름표(14px, 한글 3자 ≈ 42px)가 인물보다 넓다. 설계서는 3명 예시만 그렸다. 권고: 5명 이상이면 `flex-wrap` 으로 한 줄 4명씩 두 줄(인물 폭 56px 안팎)로 접는다 — UI-SPEC 의 "한 줄"과 다르므로 UAT(E2 overflow 🧪)에서 확정. [ASSUMED]

### Pitfall 17: 미리보기가 닉네임을 비인증으로 공개한다 (C2)
4자리 코드는 1만 개뿐이라 누구나 열거할 수 있고 `GET /api/rooms/:code` 는 로그인이 없다. 지금도 `playerCount`/`hostNickname` 이 노출되지만 `players[]` 가 더해지면 앉은 사람 전원의 닉네임이 보인다. **역할·토큰·`playerId`·`connected` 는 절대 넣지 않는다**(허용 목록 빌더 + 테스트, Security). 친구 게임 MVP 에서 닉네임 노출은 수용 위험으로 두되 최소화한다: `players` 는 `lobby` 단계에서만 채우고 시작된 방은 `[]`(Pattern 6). 응답은 `no-store`.

### Pitfall 18: S-02 10초 폴링이 DO 를 계속 깨운다 (C2)
각 폴링은 DO 요청 1회(Free 플랜 DO 요청 한도 있음 — 수치는 공식 요금 페이지 [CITED: developers.cloudflare.com/durable-objects/platform/pricing/] 에서 계획 때 확인)이고 하이버네이션 중이던 DO 를 깨운다. 방당 S-02 열람자가 많지 않은 친구 게임에서는 문제없지만 규칙으로 줄인다: ① `visible` 일 때만 ② 화면을 떠나면 중단 ③ 주기 고정 10초(UI-SPEC)에 지터 불필요 ④ 방이 `lobby` 가 아니게 되면 더 폴링하지 않음(사유 화면으로 전환) ⑤ 요청 직렬화(이전 요청이 끝나기 전에 겹쳐 보내지 않음, 느린 망에서 요청이 쌓이는 것 방지). 속도 제한 바인딩은 정식 출시 단계로 미룬다(Open Question 5).

### Pitfall 19: 시트(`<dialog>`) 구현 함정 (C3)
Pattern 9 의 요약: ① `::backdrop` 에 `var(--scrim)` — 커스텀 속성 상속이 불확실, 직접 막 `div` ② `cancel`(Esc) 기본 동작은 즉시 닫아 종료 애니메이션이 사라짐 → `preventDefault` 후 자체 처리 ③ `animationend` 만 믿으면 숨겨진 탭에서 안 닫힘 → 타임아웃 폴백 ④ React `autoFocus` 대신 `showModal()` 뒤 명시적 `focus()` ⑤ StrictMode 이중 effect 에서 `showModal()` 두 번 → `if (!dlg.open)` 가드 ⑥ 최상위 레이어(top layer)에 올라가므로 `#root` 의 `max-width: 430px` 가 적용되지 않는다 → 시트 자체에 `max-width: 430px; margin: auto auto 0` ⑦ 시트가 열려 있을 때 재접속 띠·토스트는 뒤에 가려진다(토스트는 `role="status"` 라 읽히긴 함) — 허용 ⑧ 단계가 바뀌어도 열림 상태 유지 → 상태는 `RoomScreen` 이 보유.

### Pitfall 20: 역할 카드 DOM 이 뒷면에서도 역할을 담는다 (C4)
참고 구현 `RoleCard` 는 `role` 이 있으면 앞면(`mf-card__front`)을 **항상** 렌더하고 `aria-hidden` + `backface-visibility` 로 가릴 뿐이다 [VERIFIED: bundle.js RoleCard 구현 `role ? h('div', { className: 'mf-card__face mf-card__front', 'aria-hidden': face !== 'front' ? 'true' : undefined }, h('img', … src: ROLE_ART[p.role] …`]. 이 구조를 이식하면 뒷면 상태에서도 역할 이름·직업 그림 요청이 DOM·네트워크에 있다(어깨너머·접근성 트리·개발자 도구). UI-SPEC 은 "뒷면(모두 같은 마크업, 역할을 읽지 않는다)". **앞면은 면이 `front` 로 처음 바뀌는 렌더에서 마운트하고(그 뒤로 뒤집기 되돌림 애니메이션을 위해 유지) 뒷면 마크업은 역할과 무관하게 같게** 한다. 클라이언트 테스트: `role="mafia"` 와 `role="citizen"` 의 뒷면 `innerHTML` 이 동일, 앞면 이전에는 역할 이름이 DOM 에 없음. 직업 그림은 `preload` 로 4종 모두 미리 받아 둔다(Pattern 13) — 뒤집기 800ms 안에 이미지가 늦게 뜨는 것을 막되 어떤 역할인지 드러내는 네트워크 패턴을 만들지 않는다.

### Pitfall 21: 재연결 30초를 벽시계로 재면 화면 잠금 복귀가 곧바로 실패 화면이 된다 (C6)
폰 화면이 꺼지면 JS 타이머가 멈추거나 느려지고 소켓은 끊긴다(iOS). 복귀한 순간 "끊긴 지 30초 이상" 이므로 `Date.now() - closedAt` 로 판단하면 곧바로 "연결할 수 없어요" 가 뜬다. `failingSince` 를 **visible 상태에서 첫 재연결 실패가 난 시각**으로 정하고 복귀(`visible`) 때 리셋한다(Pattern 12). 테스트: `hidden` 120초 후 `visible` 에서 포기 상태가 아님, `visible` 후 30초 연속 실패 시에만 `failed`. [ASSUMED 설계 권고]

### Pitfall 22: 낡은 세션으로 열린 소켓은 404 로 조용히 실패한다 (C6)
방이 만료되면 DO 의 `fetch` 가 업그레이드 전에 404 JSON 을 돌려준다 [VERIFIED: worker/room.ts:79 `if (!this.room || Date.now() >= this.room.expiresAt) return jsonError("ROOM_NOT_FOUND", 404);`]. 브라우저의 WebSocket API 는 업그레이드 실패의 HTTP 상태를 노출하지 않는다 → 클라이언트는 일반 끊김(1006)과 구분할 수 없어 재연결을 반복하다 30초 뒤 "연결할 수 없어요" 가 뜬다(UI-SPEC S-01: "방이 없어졌으면 입장 정보를 지우고 첫 화면"). **처방:** 저장된 세션으로 방에 들어가기 전(앱 시작 이어받기)과 재연결이 2~3번 연속 실패할 때 `GET /api/rooms/:code` 로 방이 살아 있는지 확인한다. 404 면 세션 삭제 + 첫 화면(또는 "방이 닫혔어요" ErrorScreen). 이 확인은 미리보기 라우트를 재사용하므로 서버 변경이 없다.

### Pitfall 23: `tokens.css` 는 생성 파일 — `--check` 와 CRLF (C9)
`scripts/gen-tokens.mjs` 는 `design/tokens.json` 에서 `src/styles/tokens.css` 를 만들고 `--check` 는 파일 내용이 다르면 종료 코드 1 이다 [VERIFIED: scripts/gen-tokens.mjs `if (readFileSync(out, "utf8") !== css) { console.error(...); process.exit(1); }`]. 문제 둘: ① `package.json` 에 `tokens`(생성)만 있고 `--check` 를 부르는 스크립트가 없다 [VERIFIED: package.json scripts `"tokens": "node scripts/gen-tokens.mjs"`]. ② `.gitattributes` 에 `*.sh text eol=lf` 뿐이라 Windows(집 PC)에서 `core.autocrlf=true` 이면 `tokens.css` 가 CRLF 로 체크아웃되어 `--check` 가 **가짜로 실패**한다 `[ASSUMED: Git for Windows 기본 설정]`.
**처방:** `"tokens:check": "node scripts/gen-tokens.mjs --check"` 를 추가하고 `typecheck` 스크립트 앞에 건다(`npm run tokens:check && wrangler types && tsc …`). 실행자가 웨이브마다 돌리는 `typecheck` 가 곧 토큰 검사가 된다. `.gitattributes` 에 `src/styles/tokens.css text eol=lf` 를 더한다. 토큰이 모자라면(아래) `design/tokens.json` 을 고치고 `npm run tokens` 로 다시 만든 뒤 HANDOFF 에 "디자인 시스템 아티팩트에도 같은 값을 넣을 것" 을 적는다(UI-SPEC 스타일 규칙). **토큰에 없는 값:** 글자 크기(14/16/24/36, CSS 에 직접), 재접속 띠 높이 52, 시트 240ms·`phase-enter`/`card-rise` 300ms·`seat-leave` 320ms·`timer-pop` 220ms·배정 링 1s. 기존 `--dur-fast/med/slow` = 180/420/800ms [VERIFIED: tokens.css `--dur-fast: 180ms; --dur-med: 420ms; --dur-slow: 800ms;`]. 새 길이를 `tokens.json` 에 더할지 CSS 지역 변수로 둘지는 계획에서 정한다(Open Question 4; 권고: 지역 상수로 `ds.css` 상단에 선언하고 HANDOFF 에 기록 — 토큰 원천을 건드리지 않는 쪽이 작게 간다).

### Pitfall 24: 방금 HTTP 로 참가한 사람은 WS 가 열리기 전까지 `connected=false` — 시작 조건에서 빠진다 (C1)
`connected` 는 `hello` 가 와야 `true` 가 된다(01-02: 방 생성 직후도 `connected: false` [VERIFIED: shared/game/room.ts:60 `connected: false,`]). 방장이 막 입장한 4번째 사람과 거의 동시에 [게임 시작] 을 누르면 서버는 `NOT_ENOUGH_PLAYERS` 를 돌려줄 수 있다(정상). 화면은 서버 뷰 기준으로 버튼을 켜고 끄고 거절 시 최신 `state` 로 다시 그리면 충분하다. 헬퍼·테스트는 "자리에는 있지만 아직 연결 전" 상태를 정상 케이스로 취급한다.

### Pitfall 25: `hello` 이전 소켓은 방송을 못 받는다 — 첫 스냅샷 전 화면 판단
`hello` 전 소켓은 첨부가 없어 방송에서 제외된다(01-02). 클라이언트는 `open` 직후 상태를 `open` 으로 두지만 `state` 를 받기 전에는 `view` 가 없을 수 있다 → 띠/전체 화면 판단은 `view` 유무로 한다(Pattern 12).

### Pitfall 26: 정적 에셋 SPA 폴백과 없는 그림 파일
`not_found_handling: "single-page-application"` 은 요청이 에셋과 맞지 않을 때 `/index.html` 을 200 으로 준다. 공식 문서: Worker 스크립트가 있으면 **페이지 이동이 아닌 요청은 Worker 를 호출하고 Worker 가 응답을 정한다**[CITED: developers.cloudflare.com/workers/static-assets/routing/single-page-application/] — 우리 Worker 는 `/api/*` 밖 요청에 `apiError("NOT_FOUND", 404)` JSON 을 돌려주므로 프로덕션에서 `<img src="없는 파일">` 은 404 가 될 것이다 `[ASSUMED: 문서 문구에서 추정]`. 그러나 로컬 `vite preview` 에서는 없는 이미지 경로가 `200 text/html` 로 돌아왔다 [VERIFIED: `curl -I …/characters/table/nope.png` → `HTTP/1.1 200 OK … content-type: text/html`]. 어느 쪽이든 오타는 깨진 그림으로 조용히 나타나므로 존재 검사 테스트(Pattern 13)가 방어선이다.

## Code Examples

### 시작 조건 (Pattern 8)
```typescript
// shared/game/room.ts 에 더할 것 (설계안). MIN_PLAYERS/MAX_PLAYERS 는 protocol.ts:5-6 의 값(4, 8).
import { MAX_PLAYERS, MIN_PLAYERS } from "../protocol";
export const connectedCount = (players: readonly { connected: boolean }[]): number =>
  players.reduce((n, p) => n + (p.connected ? 1 : 0), 0);
export const isFull = (players: readonly unknown[]): boolean => players.length >= MAX_PLAYERS; // 자리 수(끊긴 사람 포함)
export type StartError = "NOT_HOST" | "WRONG_PHASE" | "NOT_ENOUGH_PLAYERS";                    // protocol.ts:80-86 WsErrorCode 의 부분집합
export function checkStart(state: RoomState, actorId: string): StartError | null {
  if (state.hostId !== actorId) return "NOT_HOST";
  if (state.phase !== "lobby") return "WRONG_PHASE";
  if (connectedCount(state.players) < MIN_PLAYERS) return "NOT_ENOUGH_PLAYERS";
  return null;
}
// startGame: assignRoles(state.players.map(p => p.id), randInt)  ← 끊긴 사람 포함 전원. 자리 수는 연결자 ≥ 4 이므로 4~8.
```
`WsErrorCode` 의 실제 값: `"BAD_MESSAGE" | "NOT_HOST" | "NOT_ENOUGH_PLAYERS" | "WRONG_PHASE" | "CANNOT_KICK" | "RATE_LIMITED"` [VERIFIED: shared/protocol.ts:80-86].

### 미리보기 빌더 (Pattern 6, 허용 목록)
```typescript
// shared/game/view.ts 에 더할 것 (설계안)
export function buildPreview(state: RoomState): RoomPreview {
  const host = state.players.find((p) => p.id === state.hostId);
  return {
    code: state.code,
    hostNickname: host?.nickname ?? "",
    playerCount: state.players.length,          // 자리 수
    maxPlayers: MAX_PLAYERS,
    phase: state.phase,
    players:
      state.phase === "lobby"
        ? [...state.players].sort((a, b) => a.seat - b.seat).map((p) => ({ seat: p.seat, nickname: p.nickname })) // 두 키만
        : [],
  };
}
```
누출 테스트: 모든 단계(lobby/assigning/roleReveal/day)에서 `JSON.stringify(buildPreview(...))` 에 어떤 플레이어의 `token`, `id`, `role`(문자열 `mafia|police|doctor|citizen` 포함)이 없고, `players[*]` 키 집합이 정확히 `["nickname","seat"]` 이다. 워커 통합 테스트에서는 실제 `GET /api/rooms/:code` 응답 본문으로 같은 검사.

### 뷰 차이·카드 면 (Pattern 10·11) — 위 Pattern 11 코드 + 아래
```typescript
// src/net/cardFace.ts — 순수
export interface CardState { face: "back" | "front"; locked: boolean; seenFront: boolean }
export const AUTO_FLIP_MS = 5_000;
export function initialCardState(sinceStartMs: number, hasRole: boolean): CardState {
  const late = hasRole && sinceStartMs >= AUTO_FLIP_MS;           // 5초 뒤에 들어온 사람은 앞면부터
  return { face: late ? "front" : "back", locked: late, seenFront: late };
}
export function onTap(s: CardState, hasRole: boolean): CardState {
  if (!hasRole) return s;                                          // 역할 없는 뷰는 뒤집히지 않는다
  const face = s.face === "back" ? "front" : "back";
  return { face, locked: true, seenFront: s.seenFront || face === "front" };
}
export function onAutoTimer(s: CardState, hasRole: boolean): CardState {
  if (s.locked || !hasRole) return s;
  return { face: "front", locked: true, seenFront: true };
}
```
[ASSUMED 설계안] 타이머: `autoAt = (phaseEndsAt - phaseDurationMs + AUTO_FLIP_MS)` 를 서버시각으로 두고 `delay = autoAt - (Date.now() + offset)` 로 `setTimeout` 하나.

### 에셋 URL 헬퍼 (Pattern 13, Pitfall 14·15)
```typescript
// src/net/assets.ts — FIGURE_IDS 는 design/design-system/components/bundle.js:196 에서 그대로
export const FIGURE_IDS = ["fig1_boy_brown","fig2_boy_black","fig3_boy_blonde","fig4_girl_brown","fig5_girl_black","fig6_girl_auburn","fig7_boy_blackhat","fig8_girl_tanhat"] as const;
export type RoleArtId = "mafia" | "police" | "doctor" | "citizen";   // design-system/components/index.d.ts: type Role = 'mafia' | 'police' | 'doctor' | 'citizen';
const png = (dir: string, id: string, density: 2 | 4) => `/characters/${dir}/${id}_default%40${density}x.png`;   // '@' → %40 (Pitfall 14)
export const figureSrc = (seat: number) => ({
  src: png("table", FIGURE_IDS[((seat % 8) + 8) % 8]!, 2),
  srcSet: `${png("table", FIGURE_IDS[((seat % 8) + 8) % 8]!, 2)} 2x, ${png("table", FIGURE_IDS[((seat % 8) + 8) % 8]!, 4)} 4x`,
});
export const roleArtSrc = (role: RoleArtId) => png("roles", role, 4);
export const backdropUrl = (layout: "entry" | "game", variant: "lobby" | "night" | "day" | "verdict") => `/backgrounds/bg_${layout}_${variant}.svg`;
```
검사 테스트는 `import.meta.glob("/public/characters/**/*.png")`·`("/public/backgrounds/*.svg")` 키에 `decodeURIComponent(url)` 가 들어 있는지 확인(Pattern 13).

### 시트 골격 (Pattern 9)
```tsx
// src/components/Sheet.tsx — 설계안
export function Sheet({ label, onClose, initialFocus, children }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const [closing, setClosing] = useState(false);
  const requestClose = useCallback(() => {
    if (closing) return; setClosing(true);
    window.setTimeout(onClose, 260);                     // animationend 에 의존하지 않는 폴백(240ms + 여유)
  }, [closing, onClose]);
  useEffect(() => {
    const dlg = ref.current!; if (!dlg.open) dlg.showModal();   // StrictMode 이중 effect 가드
    initialFocus?.current?.focus();
    return () => { if (dlg.open) dlg.close(); };
  }, [initialFocus]);
  return (
    <dialog ref={ref} className="mf-dialog" aria-label={label}
            onCancel={(e) => { e.preventDefault(); requestClose(); }}>   {/* Esc */}
      <div className="mf-scrim" onClick={requestClose} />
      <div className={closing ? "mf-sheet mf-sheet--closing" : "mf-sheet"} role="document">{children}</div>
    </dialog>
  );
}
```

### wrangler.jsonc / vite.config.ts / vitest.config.ts — 현재 파일 그대로(01-01), 변경 없음
`wrangler.jsonc` 는 `assets.not_found_handling: "single-page-application"`, `run_worker_first: ["/api/*"]`, `exports.Room`(sqlite) [VERIFIED: wrangler.jsonc 전체]. 개정으로 바뀌는 것은 `public/_headers` 추가뿐이다:
```
# public/_headers  (설계안. 규칙 최대 100개·줄 2,000자 [CITED: developers.cloudflare.com/workers/static-assets/headers/])
/characters/*
  Cache-Control: public, max-age=86400
/backgrounds/*
  Cache-Control: public, max-age=86400
/assets/*
  Cache-Control: public, max-age=31536000, immutable
```
이번 세션 `vite build` + `vite preview` 에서 규칙이 적용됨을 확인했다 [VERIFIED: `curl -I …/backgrounds/bg_game_lobby.svg` → `cache-control: public, max-age=86400`; preview 로그 "✨ Parsed 2 valid header rules."]. `_headers` 는 에셋 응답에만 적용되고 Worker 응답에는 적용되지 않는다 [CITED: 같은 문서]. 이 파일이 없어도 동작한다(기본 `public, max-age=0, must-revalidate` + ETag, 매번 조건부 요청) — 느린 망에서 인물 8장 재검증 왕복을 줄이는 선택 최적화다. 그림을 교체할 때는 파일명 버전을 바꾸거나 1일 지연을 수용한다(미해시 파일명). `/assets/*` 는 Vite 가 해시한 파일이라 안전.

### DO 통합 테스트·역할 배정·smoke — 이전 연구의 예시 유지
`evictDurableObject`·`runDurableObjectAlarm`·`exports.default.fetch` 패턴은 01-02 워커 테스트로 이미 쓰이고 있다. 역할 배정(`shared/game/roles.ts`)은 01-03 에서 구현됨(ROLE_TABLE 값은 REQUIREMENTS.md ROLE-01 과 파일 자체가 정본 — 이 문서에 다시 옮기지 않는다). `scripts/smoke.mjs` 는 현재 `--stage create` 만 있고 `ALLOWED_PLAYER_KEYS = ["connected", "isHost", "nickname", "seat"]` 로 키를 검사한다 [VERIFIED: scripts/smoke.mjs:12 `const ALLOWED_PLAYER_KEYS = ["connected", "isHost", "nickname", "seat"];`] — 01-10 의 `full` 단계가 미리보기 키 `["nickname","seat"]` 와 역할 필드 누출 전수 검사를 더한다.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@cloudflare/vitest-pool-workers` | `@cloudflare/vitest-plugin`(`cloudflareTest`) | 패키지 이름 변경 | 이미 적용 |
| DO 선언 `migrations` | `exports: { Room: {type:"durable-object", storage:"sqlite"} }` | 2026 | 이미 적용(결정 0009) |
| 길게 누르기로 보는 [내 역할] | [내 역할] 바텀 시트(C-01) | 결정 0012 (2026-10-23) | Pitfall 10 삭제, Sheet 부품 |
| 임시 SVG 실루엣 인물 | 세트 C PNG(`public/characters/`), A_cute SVG 배경 | 결정 0010·0011 | 에셋 헬퍼·프리로드·`%40` |
| 도구·라이브러리로 포커스 트랩 | 네이티브 `<dialog>.showModal()` | `<dialog>` 가 2022-03 부터 주요 브라우저에서 사용 가능(MDN "Baseline: Widely available … since March 2022", `::backdrop` 항목 [CITED: developer.mozilla.org/en-US/docs/Web/CSS/::backdrop]) | 시트 접근성 기본기를 브라우저에 위임 |
| `new Image()` 수동 프리로드 | React 19 `preload(href, {as:"image", imageSrcSet, imageSizes})` | React 19 | 중복 호출 합쳐짐 |
| 컴포넌트 라이브러리/shadcn | 자체 부품 + 디자인 시스템 참고 구현 이식 | UI-SPEC | 새 패키지 없음 |

**Deprecated/outdated:** 이전 연구의 Pitfall 10, "임시 정장 실루엣"·"빈 의자" 관련 문구, `ShareButton` 단일 버튼 가정, 32px absolute 재접속 배너.

## Runtime State Inventory

해당 없음 — 신규(greenfield) 페이즈이며 이름 변경·리팩터·이관 작업이 아니다. 다만 개정으로 `RoomPreview` 형태가 바뀌므로 이미 배포된 `minifia.dhplay.workers.dev` 의 01-02 배포본에는 미리보기 라우트가 없고(현재 `GET /api/rooms/:code` 미구현) 01-08 배포 때 처음 생긴다 — 데이터 이관 없음.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 시계 오프셋은 최소 RTT 표본으로 충분히 정확하다 | Pattern 5 | 카운트다운 수백 ms 어긋남 |
| A2 | 방 만료 TTL 3시간(생성·시작 시 갱신) | 이전 Pitfall 4, `ROOM_TTL_MS` | 진행 중 방 삭제 또는 쓰레기 DO 누적 |
| A3 | iOS Safari 복귀 시 좀비 OPEN 소켓이 있고 ping/pong 점검이 필요 | Pitfall 8 | 복귀 후 먹통 / 불필요 복잡도. 실기기 UAT |
| A4 | 조용한 단절에서 `webSocketClose` 가 늦다 | Pitfall 9 | 흐릿함·시작 조건(C1)이 늦게 반영 |
| A5 | 배포 시 소켓이 끊기고 재접속이 복구한다 | Pitfall 5 | 배포 중 판이 깨짐 |
| A6 | 출력 게이트 덕에 `put` 완료 전 `send` 안 나감 | Pattern 3 | 방송 직전 `await put` 명시 |
| A7 | 카카오톡 미리보기는 정적 OG + `og:image` 절대 주소로 충분하고 `og:url` 생략이 안전 | Pitfall 11 | 미리보기 실패. 실기기 확인 |
| A8 | 프로토콜 이름들은 이 연구의 제안이며 기존 `protocol.ts` 가 정본(변경 시 그쪽 우선) | Code Examples | 낮음 |
| A9 | Workers Free 플랜 DO 한도로 1페이즈 충분 | Environment | 유료 플랜 필요 |
| A10 | `@` 파일명 307 리다이렉트는 프로덕션에서도 같다 | Pitfall 14 | `%40` 헬퍼가 불필요하지만 해롭지 않음 |
| A11 | 인물 `srcset` 을 `2x/4x` 서술자로 두면 DPR 2 는 `@2x`, DPR 3 은 `@4x` 를 고른다 | Pitfall 15 | 용량 절감이 기대보다 작음. UI-SPEC 문구(`@4x 2x`)에서 벗어남 |
| A12 | `<dialog>.showModal()` 이 iOS Safari 에서 포커스 가두기·Esc·배경 비활성을 기본 제공하고 닫을 때 이전 포커스를 복원한다 | Pattern 9 | 포커스 탈출 → 수동 포커스 관리 추가 |
| A13 | React `autoFocus` 는 대화상자가 열리기 전 마운트 시점에 동작해 `showModal()` 이후 포커스를 보장하지 못한다 | Pattern 9 | 불필요한 명시 `focus()` (무해) |
| A14 | iOS 는 `share()`/`clipboard.writeText()` 를 첫 `await` 앞에서 불러야 사용자 활성화를 유지하고, 읽기 전용 입력 선택에 `setSelectionRange` 가 필요 | Pitfall 6 | 공유·복사 실패율. 실기기 UAT |
| A15 | 장면 높이 추정(360×640 에서 약 390/340px, 띠 있으면 약 290px)과 S-02 8명 한 줄 불가(인물당 39px) | Pitfall 16 | 레이아웃 수치 재조정. 01-10 실기기·폭 360 확인 |
| A16 | `players` 를 `lobby` 에서만 채우고 시작된 방에서는 `[]` | Pattern 6 | S-02 가 시작된 방에서 앉은 사람을 보여 주고 싶다면 변경 |
| A17 | 재연결 30초는 visible 상태 연속 실패 기준(화면 잠금 시간 제외) | Pattern 12, Pitfall 21 | 포기 화면이 너무 늦게/일찍 뜸. 30초 값 자체도 가정(결정 0012) |
| A18 | 프로덕션 정적 에셋은 SPA 폴백에서 페이지 이동이 아닌 요청을 Worker 로 보내 없는 이미지가 404 가 된다 | Pitfall 26 | 없는 그림이 HTML 200 으로 나옴(어느 쪽이든 존재 검사 테스트가 방어) |
| A19 | `.gitattributes` 없이 Windows 에서 `tokens.css` 가 CRLF 가 되어 `--check` 가 가짜 실패한다 | Pitfall 23 | 집 PC 에서 `typecheck` 가 이유 없이 실패 |

## Open Questions

1. **[내 역할] 시트가 `roleReveal` 이후에도 "앞면을 본 적 없으면 뒷면만" 인가?**
   - What we know: UI-SPEC C-01 "S-05 에서 카드를 한 번도 앞면으로 보지 않았으면 시트에도 카드 뒷면만 보인다(설계서 S-05 4번)", D-19 "역할 확인을 놓치고 돌아온 사람도 여기서 확인한다".
   - What's unclear: 두 문장이 `day` 에서 충돌한다(S-05 중에 카드를 못 뒤집은 채 15초가 끝난 사람).
   - Recommendation: `roleReveal` 동안만 `!seenFront` 면 뒷면, `day` 이후는 항상 앞면(구현·테스트가 단순). 계획에서 확정.
2. **"1일차" 를 하드코딩할까 `view.dayNumber` 를 더할까?** — 권고: 1페이즈는 상수 "1일차"(D-03 정신: 미리 넣지 않음). 밤→낮 순환이 생기는 페이즈가 필드를 더한다.
3. **인물 `srcset` 을 UI-SPEC 문구(`@4x 2x`)가 아니라 `@2x 2x, @4x 4x` 로 둘까?** — 권고: 후자(Pitfall 15). UI-SPEC 은 승인본이므로 계획에서 의식적으로 편차를 결정하고 UI-SPEC 한 줄을 고친다.
4. **UI-SPEC 모션 길이(240/300/320/220ms, 배정 링 1s)·재접속 띠 52px 를 `design/tokens.json` 에 더할까 CSS 지역 상수로 둘까?** — 권고: 지역 상수 + HANDOFF 기록(Pitfall 23).
5. **미리보기 `players` 노출 범위와 속도 제한** — `lobby` 에서만, `no-store`, 폴링은 visible 일 때만(Pattern 6·Pitfall 17·18). Workers Rate Limiting 바인딩(키로 IP 는 권장되지 않음, 위치별 근사치 [CITED: developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/])은 정식 출시(LAUNCH) 마일스톤으로 미룬다. 사용자 확인 대상: 1페이즈에서 열거 방어 없이 가도 되는가.
6. **ROOM_TTL 3시간**(A2) — 사용자 확인 대상(재량 항목).
7. **죽은 피어 감지(좀비 `connected=true`)가 시작 조건에 미치는 영향** — 1페이즈는 이벤트 기반만, 실기기 UAT 에서 관찰, 문제면 4페이즈 CONN-02 에서 하트비트 보강.
8. **OG 이미지 1200×630 PNG 를 새 패키지 없이 만드는 방법** — 후보: 디자인 PNG(`design/backgrounds/A_cute/bg_entry_lobby.png`)를 OS 도구로 자르고 글자를 얹어 한 번 커밋, 또는 사용자가 데스크톱에서 만들어 전달(CLAUDE.md "그림 에셋은 클로드 데스크톱에서"). 01-10 에서 정함.
9. **게임 중 [나가기]** 는 1페이즈에 없음(시작 뒤 끊김만 존재), 4페이즈에서 정한다(이전 연구와 동일).
10. **"모든 폰에서 같은 시각" 허용 오차** — 합격 기준: 마감 시각 값이 모든 폰에서 동일 + 전환 편차 약 0.5초 미만(실측).

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | 전부 | ✓ | v26.0.0 (wrangler `>=22`, vitest 4 충족) | — |
| npm | 설치 | ✓ | 11.12.1 | — |
| wrangler(프로젝트 로컬) | 배포 | ✓ | 4.151.3 | — |
| Cloudflare 로그인 | DEPLOY-01 | ✓ (01-02 에서 개인 계정으로 배포 완료: `https://minifia.dhplay.workers.dev`) | — | 집 Windows PC 는 별도 `npx wrangler login` 필요(HANDOFF) |
| 네트워크(npm, Cloudflare) | 설치·배포 | ✓ | — | — |
| 실제 폰 2대+ (iOS/Android) | 성공 기준 1·4, UAT | 미확인 | — | PC 브라우저 탭 여러 개 + `vite dev --host` LAN(공유는 HTTPS 에서만 확인 가능) |
| iOS Safari 360×640 급 화면 | 개정 UAT(시트·테이블 크기·키보드) | 미확인 | — | 데스크톱 반응형 도구는 `<dialog>`·`dvh`·키보드 동작을 대신 못 함 → 실기기 UAT 필수 |
| Windows 집 PC | 이어서 작업 | 미확인 | — | 스크립트는 Node 기반 유지, `.gitattributes` 에 `tokens.css` eol=lf(Pitfall 23) |

**Missing dependencies with no fallback:** 없음(실기기는 단계 끝 UAT 로).
**Missing dependencies with fallback:** 실제 폰(UAT 로 대체 불가 — `human_verify_mode: end-of-phase`).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.12 + `@cloudflare/vitest-plugin` 1.4.6 (workerd) + happy-dom 21.0.4 + @testing-library/react 16.3.3 |
| Config file | `vitest.config.ts` (projects: `unit` node / `client` happy-dom / `worker` cloudflareTest) — 있음 |
| Quick run command | `npx vitest run --project unit` |
| Full suite command | `npx vitest run` + `npm run typecheck`(개정 후 `tokens:check` 포함) |
| 배포본 검증 | `node scripts/smoke.mjs --prod --stage <create\|full>` |
| 현재 기준선 | 16 파일 / 123 테스트 통과 [VERIFIED: 이번 세션 `npx vitest run`] |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ROOM-01 | 코드 `^\d{4}$`, 충돌 재시도, 응답 `code+token`(있음). **공유 시트**: `shareOnly`(취소 `AbortError` 무시)·`copyLink`(실패 시 manual), [공유하기] 숨김 조건, 링크 `{origin}/r/{code}` 에 토큰 없음 | unit + client | `npx vitest run test/unit/share.test.ts test/client/shareSheet.test.tsx` | share ✅ / 시트 ❌ Wave 0 |
| ROOM-02 | 닉네임(있음). join 후 다른 소켓이 스냅샷 수신. **미리보기 `players`**: 키 집합 `["nickname","seat"]`, 자리 순 정렬, lobby 아니면 `[]`, 없는 방 404, 형식 오류 404. S-02 폴링 10초·`hidden` 중단·`visible` 즉시·404 전환 | unit + worker + client | `npx vitest run test/unit/preview.test.ts test/worker/preview.test.ts test/worker/join.test.ts test/client/joinByLink.test.tsx` | ❌ Wave 0 |
| ROOM-03 | `connectedCount`·`checkStart`: 연결 4/자리 6 시작 가능·6인 구성표로 6명 배정, 연결 3/자리 8 거절, 비방장·lobby 아님 거절, 정원 = 자리 수(끊긴 사람 포함 9번째 join `ROOM_FULL`), 거절 시 최신 `state` 재전송, 시작 후 kick `CANNOT_KICK`. 화면: [게임 시작] 활성 조건·안내 문구·"8 / 8명 · 가득 찼어요" | unit + worker + client | `npx vitest run test/unit/gameRoom.test.ts test/worker/start.test.ts test/client/lobby.test.tsx` | gameRoom ✅(확장) / 나머지 ❌ |
| CONN-01 | `hello{token}` 로 같은 seat/role 복구(eviction·강제 종료 후), 잘못된 토큰 거부, 중복 소켓 교체(있음). **상태기계**: 끊김→띠 `reconnecting`→`restored` 2초→`hidden`, `view` 없으면 전체 화면, 30초 visible 연속 실패 → `failed`, `hidden` 120초 후 `visible` 은 포기 아님, 백오프 상한, 4001/4003 분기, `epoch` 증가. 세션: 단일 슬롯, 다른 방 링크는 이어받기 안 함, localStorage 예외 시 메모리 대체. **낡은 세션**: 재연결 연속 실패 시 미리보기 404 → 세션 삭제 | unit + worker + client | `npx vitest run test/unit/linkReducer.test.ts test/unit/session.test.ts test/worker/reconnect.test.ts test/client/useRoomConnection.test.tsx` | useRoomConnection 테스트 ✅(교체) / 나머지 ❌ |
| DEPLOY-01 | 배포 주소에서 방 생성→참가→시작→`day`; 재배포 후 주소 불변·새 버전; **에셋**: `public/` 에 헬퍼가 만드는 모든 URL 의 파일 존재, `_headers` 규칙, 배포본 `%40` URL 이 200 | smoke + manual + unit | `node scripts/smoke.mjs --prod --stage full`; `npx vitest run test/unit/assets.test.ts` | ❌ Wave 0 |
| GAME-01 | `tick` 연쇄·알람 다중화(01-07/08). `countdown`·`formatMmSs`(15→`0:15`, 마지막 5초 `urgent`)·`remainingMs`(있음), 카드 면 전이(`initialCardState`·`onTap`·`onAutoTimer`: 5초 안 탭 시 자동 없음, 5초 뒤 입장은 앞면, 앞면에서 탭하면 뒷면, 자동은 한 번만), Timer 마지막 5초 상태·`role="timer"` | unit + worker + client | `npx vitest run test/unit/tick.test.ts test/unit/countdown.test.ts test/unit/cardFace.test.ts test/worker/alarm.test.ts test/client/timer.test.tsx` | clock ✅ / 나머지 ❌ |
| ROLE-01 | 4~8명 각 구성표(있음, 01-03). 끊긴 사람 포함 전원 배정(Pattern 8) | unit | `npx vitest run test/unit/roles.test.ts test/unit/gameRoom.test.ts` | roles ✅ |
| ROLE-02 | `buildView` 타인 `role`/`token`/`playerId` 미포함, 마피아만 `allies`, `roleReveal` 이전엔 `me.role` 없음(직렬화 스캔), **미리보기 누출 없음**, 실제 소켓 프레임 전수. **카드 뒷면 DOM**: 서로 다른 역할의 뒷면 `innerHTML` 동일·앞면 이전 DOM 에 역할 이름 없음·직업 그림 `<img>` 없음, 시트 `me.role` 없으면 "아직 역할이 없어요" | unit + worker + client + smoke | `npx vitest run test/unit/view.test.ts test/worker/leak.test.ts test/client/roleCard.test.tsx` | ❌ Wave 0 |
| (UI) 시트 | `Sheet`: 열면 `dialog.open`, Esc(`cancel` 디스패치)·막 클릭·[닫기]로 닫힘, 닫기 애니메이션 폴백 타이머(fake timers), `aria-label`, 단계 변경 후에도 열린 채(상위 상태), StrictMode 이중 마운트 무해, ConfirmSheet 열면 [취소] 포커스 | client | `npx vitest run test/client/sheet.test.tsx test/client/confirmSheet.test.tsx` | ❌ Wave 0 |
| (UI) 토스트·전이 | `diffRoomViews`: `prev=null` 빈 결과, join 은 나 제외, 방장 변경 토스트, 같은 diff 에서 방장 변경 우선, 자리 재사용은 다른 사람으로 인식, `epoch` 변경 시 토스트 없음(StrictMode 포함). Toast 한 번에 하나·2초 | unit + client | `npx vitest run test/unit/roomDiff.test.ts test/client/toast.test.tsx` | ❌ Wave 0 |
| (UI) 테이블·장면 | `seatLayout`(있음). Table 입력에 역할 없음(타입), 끊김 `aria` 이름 "{닉네임}, 연결 끊김", 방장 배지 한 명, 동료 표시는 `allies` 일 때만, 빈 자리 의자 없음 | unit + client | `npx vitest run test/unit/seatLayout.test.ts test/client/table.test.tsx` | seatLayout ✅ |
| (문구) | `messageForApiError(error, context)` 가 UI-SPEC "Error state" 표와 같은 문구·위치(닉네임 칸/코드 칸/토스트/사유 화면) | unit | `npx vitest run test/unit/copy.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run --project unit` (+ 해당 client/worker 파일)
- **Per wave merge:** `npx vitest run` + `npm run typecheck`
- **Phase gate:** 전체 스위트 green + 배포본 `smoke.mjs --stage full` green + 실기기 UAT 후 `/gsd-verify-work`
- **실기기 UAT 체크리스트(개정 추가분):** ① iPhone Safari 360×640 급에서 S-03~S-06 이 세로 스크롤 없이 들어가는가(띠 52px 가 나타난 상태 포함), 이름표 겹침 ② S-02 에 8명이 앉았을 때 레이아웃 ③ 시트 3종: 포커스가 시트 밖으로 새지 않는가, Esc 없음(터치)에서 막 누르기·끌어서 닫기, 닫은 뒤 포커스 복귀 ④ 카드: 5초 자동 앞면, 탭 토글, 800ms 에서 직업 그림이 늦게 뜨지 않는가 ⑤ 화면 잠금 → 켜기 → 띠 → "다시 연결됐어요", 잠금을 길게 한 뒤에도 곧바로 포기 화면이 안 뜨는가 ⑥ 카카오톡 공유·링크 복사(HTTPS) ⑦ 느린 망(개발자 도구 스로틀 또는 실제 3G 수준)에서 첫 대기실에 인물이 늦게 채워지는 정도 ⑧ 배포본 `%40` 에셋 200/`@` 307 확인

### Wave 0 Gaps
- [ ] 위 표의 ❌ 테스트 파일들(서버 규칙·미리보기·연결·시트·카드·토스트·에셋·문구)
- [ ] `package.json`: `"tokens:check": "node scripts/gen-tokens.mjs --check"` 추가, `typecheck` 앞에 연결 / `.gitattributes`: `src/styles/tokens.css text eol=lf`
- [ ] `public/_headers`(선택 최적화), `src/styles/ds.css`(bundle.css 이식) — 코드 작업이지 테스트 인프라는 아님
- [ ] `scripts/smoke.mjs` 에 `full` 단계(미리보기 키·연결자 4 시작 조건·재접속·누출 전수) — 01-10
- [ ] 테스트 인프라 신규 설치 없음(happy-dom 이 `<dialog>.showModal` 지원, `import.meta.glob` 으로 파일 존재 확인)

## Security Domain

`workflow.security_enforcement` 활성(ASVS level 1, block_on high).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | 제한적 | 로그인 없음. 입장 자격 = 닉네임 + 서버 발급 토큰 |
| V3 Session Management | yes | 토큰 256bit, WS 첫 메시지로만 전달(URL 금지), 방송·미리보기에 비노출. 클라이언트 보관은 localStorage 단일 슬롯 `{code, token}` — XSS 가 없다는 전제(닉네임은 React 텍스트로만 렌더) |
| V4 Access Control | yes | `start`/`kick`/`leave` 는 토큰→플레이어로 서버 판정, 클라이언트가 보낸 seat/ID 불신 |
| V5 Input Validation | yes | zod, 프레임·본문 1KB 상한, 닉네임 정규화, 방 코드 `^\d{4}$`(미리보기·join·ws 라우트 모두 DO 호출 전에 확인) |
| V6 Cryptography | yes | WebCrypto 난수만 |
| V7 Errors/Logging | 일부 | 오류 응답에 내부 상태·타 플레이어 정보 금지, 토큰 로그 금지. **미리보기·오류 응답이 "토큰이 유효한가"를 알려 주지 않는다** |
| V8 Data Protection | **개정 추가** | 미리보기는 비인증 공개 응답 → 허용 목록 빌더(키 `seat`,`nickname`만), `no-store`, 역할·토큰·playerId·connected 없음, 시작된 방은 `players: []` |
| V13 API/Web Service | yes | `/api/*` 입력 검증, 알 수 없는 경로 일관된 4xx |

### Known Threat Patterns for Workers + DO + WebSocket + 공개 미리보기

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| 타인 역할이 방송 페이로드에 섞임(핵심 위험) | Information Disclosure | 연결별 `buildView` + 허용 목록 타입 + 직렬화 스캔 + 실제 소켓 프레임 스모크 |
| **미리보기 응답에 역할·토큰이 섞임** | Information Disclosure | `buildPreview` 객체 리터럴(펼쳐 복사 금지), 모든 단계 직렬화 스캔 테스트, 워커 통합 테스트로 실제 응답 검사, 스모크 `full` |
| **4자리 코드 열거로 앉은 사람 닉네임 수집** | Information Disclosure | 닉네임만(역할 없음)·`lobby` 에서만·`no-store`. 수용 위험으로 명시, 속도 제한은 LAUNCH 로 미룸(Open Question 5) |
| **미리보기 폴링 폭주로 DO 요청 소진** | DoS | 클라이언트 visible 일 때만 10초, 요청 직렬화. 서버 측 제한은 후속 |
| 토큰 추측/탈취 | Spoofing | 256bit, URL 비노출, 새 `hello` 가 기존 소켓 교체 |
| 비방장이 `start`/`kick` 전송 | Elevation of Privilege | 서버에서 `hostId` 검사 |
| **연결 상태 조작으로 시작 조건 우회** | Tampering | `connected` 는 서버가 소켓 첨부로만 계산(클라이언트가 보낼 수 없음). 서버가 start 때 재계산·재검증 |
| 닉네임을 통한 XSS/사칭 | Tampering | React 자동 이스케이프, `title` 속성도 React 가 이스케이프, 정규화·중복 비교 |
| 대용량/폭주 프레임 | DoS | 프레임 상한, 알 수 없는 `t` 무시 |
| 만료되지 않는 빈 방 DO 누적 | DoS(자원) | 알람 기반 TTL 후 `deleteAll()` |
| **화면 캡처·어깨너머로 역할 노출** | Information Disclosure | 수용(UI-SPEC). 뒷면 DOM 에는 역할 없음(Pitfall 20) |

## Suggested Plan Slicing (참고용 — 확정은 planner)

01-01~03 완료. TDD 모드이므로 각 계획은 "순수 로직 테스트 먼저 → 구현 → 어댑터/화면" 순서다. 이전 번호(04~10)를 유지하되 개정 항목이 들어갈 곳을 표시했다. 계획 간 의존(순서): 04 → 07 → 08, 05·06 은 03 이후 병렬, 09 는 05·06·07 이후, 10 은 마지막.
- **01-04 대기실 규칙(순수):** `join`(정원 = 자리 수, `GAME_STARTED`, 닉네임 `validateNickname`)·`leave`(방장 승계 = `joinSeq` 순)·`kick`(끊긴 사람만, lobby 만)·`connectedCount`·`checkStart`(**C1, R7**)·`buildPreview`(+`players`, **C2**) 와 누출 테스트. 시작 조건 경계 케이스 표(Pattern 8)를 그대로 테스트 목록으로.
- **01-05 입장 흐름·연결 계층(클라이언트):** 라우팅(`/`, `/r/:code`), 세션(단일 슬롯·낡은 세션 미리보기 확인), `messageForApiError` 문구(**R16**), S-01·S-02(**R5·R6**, 폴링 10초), ErrorScreen, 연결 상태기계·띠 52px·30초 포기·핑 표본(**R15, Pattern 12**). 디자인 시스템 부품 중 Button·TextField·Icon·Toast·ReconnectBanner·Backdrop 이식(Pattern 14)을 이 계획이 먼저 깔고, 이후 계획이 재사용.
- **01-06 대기실 + 테이블 + 시트:** Table/Figure(세트 C, `%40` 헬퍼·`srcSet`·장면 높이 기준 크기, **R3·R4·R8**), `diffRoomViews`·`useSeatTransitions`·토스트(**R9**), 하단 시트·시작 버튼·안내 문구·"가득 찼어요"(**R7·R8**), `Sheet`·`ConfirmSheet`·공유 시트(**R10, Pattern 9**), 방장 배지. `@types`·테스트 인프라는 그대로.
- **01-07 서버 단계 코어(순수):** `PHASE_DEFS`·`tick`·`startGame`(끊긴 사람 포함 전원 배정, **R7**)·`nextWakeAt`·`buildView` 확장(`me.role`/`allies`/`phaseDurationMs`).
- **01-08 DO·HTTP 배선:** 미리보기·참가 라우트(**R6**), leave·kick·start(거절 시 최신 `state` 재전송), 알람 다중화, `hello` 재접속, 워커 통합 테스트(누출·미리보기·시작 조건).
- **01-09 배정·역할 확인·낮 + 시트:** Timer(`m:ss`)·PhaseBar·RoleCard(Pattern 10·Pitfall 20, **R12**)·[내 역할] 시트(**R14**)·S-04(**R11**)·S-06(**R13**), 에셋 프리로드(직업 4종·낮 배경), RoomScreen 단계 분기.
- **01-10 스모크·배포 검증·UAT:** `full` 스모크(미리보기 키·연결자 4 시작·재접속·누출 전수), `public/_headers`, OG 이미지(**E13**), 재배포 후 `%40` 에셋 확인(Pitfall 14), 실기기 UAT(위 체크리스트), HANDOFF·README, 디자인 시스템 아티팩트 보정 항목(R18, 계획 범위 밖) 기록.

## Sources

### Primary (HIGH confidence)
- 이번 세션 로컬 실행: `npx vitest run`(16 파일/123 테스트), 스크래치 사본 `vite build`·`vite preview`(에셋 복사, `_headers` 적용, `@`→`%40` 307, 없는 이미지 폴백), happy-dom `showModal`·`inert`, `import.meta.glob` unit 프로젝트, `file`/`ls -la` 로 PNG 크기·SVG 용량 — 저장소 밖 스크래치에서 실행
- 저장소 파일(이번 세션에 직접 열어 읽음): `shared/protocol.ts`, `shared/schemas.ts`, `shared/game/room.ts`, `shared/game/view.ts`, `shared/seatLayout.ts`, `worker/index.ts`, `worker/room.ts`, `worker/allocate.ts`, `src/net/{api,useRoomConnection,share}.ts`, `src/App.tsx`, `src/screens/*.tsx`, `src/styles/*.css`, `scripts/gen-tokens.mjs`, `scripts/smoke.mjs`, `package.json`, `wrangler.jsonc`, `vite.config.ts`, `vitest.config.ts`, `index.html`, `.gitattributes`
- `design/screens/`(03·04·05·11·02 PNG 직접 열람), `design/design-system/components/{bundle.js,bundle.css,index.d.ts,*/README.md}`, `design/characters/ASSET_SPEC.md`, `design/backgrounds/README.md`, `design/tokens.json`
- developers.cloudflare.com/workers/static-assets/headers/ — `_headers` 문법·한도·적용 범위·기본 Cache-Control
- developers.cloudflare.com/workers/static-assets/routing/single-page-application/ — SPA 폴백, Worker 가 있으면 페이지 이동이 아닌 요청은 Worker 호출
- react.dev/reference/react-dom/preload — 이미지 프리로드 옵션·호출 위치·중복 합침
- developers.cloudflare.com/durable-objects/* (이전 연구에서 확인한 websockets·alarms·state·rules·migrations·pricing), /workers/testing/vitest-integration/*

### Secondary (MEDIUM confidence)
- developer.mozilla.org/en-US/docs/Web/CSS/::backdrop — `::backdrop` 상속 문구, `<dialog>` Baseline(2022-03) (페이지 일부만 읽음)
- developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/ — 바인딩 설정·일관성(GA 여부는 페이지에 없음)
- devtalk.kakao.com 스크랩 FAQ(이전 연구)

### Tertiary (LOW confidence — Assumptions Log 참조)
- iOS Safari 의 `<dialog>` 포커스·사용자 활성화·선택 동작, 장면 크기 추정, 프로덕션의 `@` 리다이렉트·SPA 폴백, `srcset` 선택 규칙, Windows CRLF

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 이미 설치·배포·123 테스트 통과, 개정은 새 패키지 없음
- Architecture: HIGH(서버·순수 로직) / MEDIUM(시트·토스트·연결 상태기계는 설계 권고, 실기기 확인 필요)
- Pitfalls: MEDIUM-HIGH — 14·15(로컬 실행 확인), 16·19~22(설계 도출·추정), iOS 동작·프로덕션 에셋 동작은 UAT/배포 후 확인

**Research date:** 2026-10-23
**Valid until:** 2026-11-06 (Cloudflare 도구·workerd 호환 날짜가 주 단위로 움직이므로 14일)
