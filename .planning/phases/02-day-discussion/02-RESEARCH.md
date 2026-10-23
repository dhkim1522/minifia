# Phase 2: 낮 토론 - Research

**Researched:** 2026-10-24
**Domain:** 서버 권위 실시간 게임 규칙(Cloudflare Durable Object) 위에 얹는 단계 4개(낮 시작 발표·직업 공개·공개 연출·낮 토론)와 빠른 메시지·이모티콘 채널. React 19 화면.
**Confidence:** HIGH (대부분 이 저장소 코드를 이번 세션에 직접 읽고 확인한 결과다. 새 외부 패키지가 없어 외부 조사 의존이 작다)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

화면의 구성·문구·장면은 화면설계서 v0.2 S-06(직업 공개)·S-07(낮 토론)·S-08(빠른 메시지 시트·이모티콘 트레이)와 `design/screens/05_B5_Role.png`·`06_B6_Day.png` 를 따른다(결정 0012). 아래는 설계서가 비웠거나 가정으로만 둔 것을 정한 것이다(결정 0015). 설계서와 어긋나는 곳(빠른 메시지 문구 5개, 직업 칩 범위)은 이 문서가 이긴다.

**직업 공개 (DAY-02)**
- **D-01:** 동시 공개. 고른 사람은 자기 캐릭터 위에 "완료" 배지만 보이고, 무엇을 골랐는지는 마감까지 서버가 다른 사람에게 보내지 않는다. 마감 순간 모든 주장이 한꺼번에 공개된다. — Reversibility: costly — 서버가 마감 전 선택을 숨기는 구조(뷰 생성)와 공개 이벤트가 이 방식에 맞춰진다
- **D-02:** 단계 시간 15초, 전원이 골라도 마감까지 기다린다(밤 NIGHT-05 와 같은 원칙). 시간 값은 6페이즈 플레이테스트로 조정한다.
- **D-03:** 마감 전까지 칩을 다시 눌러 바꿀 수 있다. 마지막 선택이 공개된다. 완료 배지는 한 번 뜨면 유지된다.
- **D-04:** 공개 연출: 마감 순간 모든 캐릭터 위에 주장 말풍선이 한꺼번에 팝 + 흔들림으로 뜨고 약 2초 머문 뒤 낮 토론으로 넘어간다. [말 안 함]은 흐릿하게. CSS 애니메이션 기본형이며 5페이즈가 다듬는다(결정 0006).
- **D-05:** 시간이 넘도록 고르지 못한 사람(끊긴 사람 포함)은 말 안 함(CONN-02 정책, 서버가 처리).
- **D-06:** 공개된 주장은 그 사람 자리(이름표 옆)에 낮 토론 내내 유지된다(S-07).

**선택지와 말 바꿈 (DAY-02)**
- **D-07:** 직업 칩은 이번 판 구성에 있는 직업 + [말 안 함]. 4명판은 의사 칩이 없다. 구성은 인원에서 정해지므로(ROLE-01 표) 공개 정보이고 서버가 뷰에 실어도 역할 누수가 아니다. 이 목록은 서버 구성표 한 곳에서 나온다. — Reversibility: costly — 직업 칩·"[OO]는 [직업]이었어요"·서버 검증이 같은 목록을 쓴다
- **D-08:** "말 바꿈": 다음 낮의 공개에서 직전 낮과 다른 직업을 고른 사람의 이름표 옆에 "말 바꿈"만 작게 표시한다. 이전 주장 이력은 보이지 않는다. 직전 낮이 [말 안 함]이었던 경우의 말 바꿈 여부는 Claude 재량(권장: 말 안 함 → 직업은 바꿈으로 치지 않고 처음 주장으로 본다).
- **D-09:** 2일차 이후 직업 공개 화면의 초기 선택은 어제 주장이다. 가만히 있어도 어제 주장이 이어지고, 바꾸면 말 바꿈이 된다. 어제 말 안 함이었으면 말 안 함이 미리 선택된다. 서버는 마지막 주장을 자리별로 보관한다.
- **D-10:** 서버는 주장의 참·거짓을 확인하지 않는다(거짓말 가능, 결정 0007). 서버는 선택지 목록 안의 값만 받는다.

**빠른 메시지와 이모티콘 (COMM-01, 02, 04)**
- **D-11:** 빠른 메시지에서 "저는 [직업]이에요" 를 뺀다 — 문구는 5개: "[OO] 의심돼요", "[OO] 믿어요", "[OO]는 [직업]이었어요", "저 아니에요", "[OO] 투표해요". 직업 주장은 공개 단계가 맡는다. 필요 시 문구는 플레이테스트로 더한다. — Reversibility: reversible — 템플릿 표 한 곳에 행을 더하면 된다
- **D-12:** "[OO]는 [직업]이었어요"의 직업 칩은 D-07 과 같은 이번 판 직업 목록을 쓴다(두 줄로 대상, 직업 순서로 고름).
- **D-13:** 대상 칩은 나를 뺀 생존자. 메시지는 낮 토론 단계에서만 서버가 받는다(직업 공개 중·그 밖은 거부). 서버는 템플릿 ID·대상 seat·직업 값만 받고 단계·형식·대상 유효성을 검증한 뒤 방 전체에 보낸다. 자유 텍스트는 받지 않는다(COMM-04). 이 페이즈에서는 탈락자가 없으니 생존 판정은 공용 함수로 두고 3페이즈가 탈락을 더한다.
- **D-14:** 한 사람당 2초에 한 번(메시지·이모티콘 합산, 설계서). 위반은 서버가 RATE_LIMITED 로 거부하고 다른 폰에는 나타나지 않는다. 클라이언트는 보낸 직후 두 버튼을 2초 흐리게 한다.
- **D-15:** 메시지는 서버가 낮 동안 최근 약 20개까지 보관하고, 재접속 때 최근 메시지(말풍선 중 남은 것과 최근 3줄)를 복원한다. 낮이 끝나면(다음 낮으로 넘어가면) 비운다. 메시지는 공개 정보이고 역할을 싣지 않는다. 메시지 로그 항목은 보낸 seat·템플릿 ID·값·서버 시각을 가진다. — Reversibility: costly — 방 상태 스키마(영속 상태)에 메시지 보관이 들어간다
- **D-16:** 말풍선은 보낸 사람 캐릭터 위에 3초, 이모티콘은 원형 말풍선 안에 2초(설계서). 이모티콘은 8개: 웃음, 크게 웃음, 놀람, 의심, 화남, 슬픔, 좋아요, 느낌표. 그림은 형태 시안이며 최종 그림은 캐릭터 톤에 맞춰 따로 만든다.
- **D-17:** 메시지 세 번 이하 탭(템플릿 → 대상·직업 → 보내기), 닫으면 고른 내용을 버린다(설계서).

**낮 토론 조작과 임시 루프 (DAY-01)**
- **D-18:** 방장 전용: [+30초 연장]은 낮 토론마다 1회(쓰면 "이미 연장했어요", 다음 낮에 다시 1회). [넘기기]는 즉시(확인 없음). 방장이 아닌 사람에게는 이 줄이 없다. 서버는 NOT_HOST 로 거부한다. 방장이 끊겨 있으면 조작할 사람이 없고 타이머대로 넘어간다(중대하지 않음).
- **D-19:** 임시 낮 루프: 낮 토론이 끝나거나 넘기면 일차 +1 로 다음 낮 시작 발표(S-06) → 직업 공개 → 낮 토론을 반복한다. 3페이즈가 이 지점(낮 토론의 `next`)을 밤으로 바꾸고, 4페이즈가 사이에 투표·처형을 끼운다. 일차 번호는 서버 상태에 두고 뷰로 보낸다(1페이즈의 "1일차" 고정 문구를 바꾼다). — Reversibility: costly — 단계 표의 next 한 줄과 일차 카운터가 3·4페이즈에 의존한다
- **D-20:** 낮 시작 발표(S-06)는 약 2초(설계서의 제안), 이후 직업 공개로 자동 이동한다. 2일차 이후는 아침 발표(3페이즈) 뒤에 이 화면이 나온다.

### Claude's Discretion
- 이모티콘 트레이 열림·닫힘, 연타 시 흐림 처리의 세부 모션
- 말풍선 겹침 처리(여러 명이 동시에 보낼 때)와 최근 메시지 3줄 스크롤 규칙
- D-08 의 말 안 함 → 직업 전환 표시 여부(위 권장안)
- 직업 칩·완료 배지의 구체 크기·애니메이션 길이(토큰으로 올릴지 포함)
- 서버 메시지 형식(`ClientMessage`/`ServerMessage` 추가분), 방 상태 스키마 변경 방식, 기존 방 데이터 호환

### Deferred Ideas (OUT OF SCOPE)
- 주장 이력 시트(이전 낮 주장 모두 보기) — 범위 확대라 보류. 플레이테스트에서 필요하면 v2
- "저는 [직업]이에요" 문구 복귀 — 플레이테스트에서 직업 공개 뒤 토론 중 재강조가 필요하다는 피드백이 나오면
- 자유 채팅(COMMX-01), 마피아 비밀 메시지(COMMX-02) — v2 (기존)
- 디자인 문서 동기화: 화면설계서 S-08(문구 5개)·S-06(칩 이번 판 직업만)·직업 공개 연출, 화면 흐름의 단계 시간(직업 공개 15초) — 2페이즈 UI 단계에서 같이 한다(`/gsd-ui-phase 2`)

이 페이즈에서 만들지 않는 것: 투표·최후 변론·찬반·처형(4페이즈), 밤·아침·탈락(3페이즈), 변론 메시지(COMM-03, 4페이즈), 자유 채팅(v2 COMMX-01), 캐릭터 프레임 애니메이션 연출 전반(5페이즈).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DAY-01 | 낮 토론(90초) 동안 생존자 목록과 남은 시간이 보인다. 방장만 한 번 +30초 연장하거나 토론을 넘길 수 있다. | "연장·넘기기" 패턴(§Pattern 4), `view.phaseDurationMs` 파생(§Pitfall 3), 알람 재설정(§Pitfall 4) |
| DAY-02 | 낮마다 낮 토론 전에 직업 공개 단계. 선택지 + [말 안 함], 시간 초과 시 말 안 함, 서버는 참·거짓 미확인, 다음 낮에 다른 직업이면 "말 바꿈". | 전이 훅(§Pattern 1), 주장 상태·마감 확정(§Pattern 2), 뷰 누출 방지(§Pitfall 1), 말 바꿈 규칙표(§Pattern 2) |
| COMM-01 | 낮 토론 중 빠른 메시지(템플릿 + 대상·직업), 말풍선 + 최근 메시지 목록. 참·거짓 미확인. | 템플릿 표·검증 함수(§Pattern 3), 메시지 보관·뷰(§Pattern 5), 클라이언트 문장 만들기(§Code Examples) |
| COMM-02 | 이모티콘 6~8개, 보낸 사람 캐릭터 위에 잠깐 표시. | 이모티콘 이벤트(§Pattern 5), 클라이언트 SeatFloat 훅(§Pattern 7) |
| COMM-04 | 서버는 템플릿 ID·값만 받고 단계·생존·형식 검증 후 방 전체 전송. 자유 텍스트 거부, 2초 1회. | `z.strictObject` + 도메인 검증(§Pattern 3), 속도 제한 위치(§Pitfall 5), 검증 매트릭스(§Validation Architecture) |
</phase_requirements>

## Summary

이 페이즈의 본질은 "1페이즈의 단계 전환 틀(`PHASE_DEFS` + 순수 `tick`)이 **단계 진입 때 상태를 바꾸는 일**을 지금은 못 한다"는 점을 풀면서, 그 위에 네 단계와 두 채널(주장·메시지)을 올리는 것이다. 직접 확인한 사실: `tick` 은 `phase`와 `phaseEndsAt` 두 필드만 바꾼다. 그런데 이 페이즈는 낮이 시작될 때 일차 +1·메시지 비우기·연장 초기화, 직업 공개가 끝날 때 미선택자 확정·말 바꿈 계산 같은 **진입 시 전이**가 필수다. 알람이 늦어 여러 단계를 한 번에 따라잡는 경우에도 훅이 단계마다 빠짐없이 돌아야 하므로, 훅은 `tick` 의 루프 안에 들어가야 한다. 이것이 계획의 중심축이다.

두 번째 축은 "마감 전 남의 선택을 보내지 않는다"(D-01)다. 서버 뷰 생성(`buildView`)이 이미 허용 목록 방식이므로, 새 필드를 같은 방식으로 단계 조건부로만 만들고, 기존 전수 누출 테스트(`view.test.ts`, `leak.test.ts`)가 "뷰에 든 역할 값은 본인 것 하나뿐"이라는 정규식을 쓰고 있어 **이 불변식이 공개 주장·구성 목록·메시지 때문에 깨진다**는 점을 먼저 정리해야 한다(§Pitfall 2). 필드 이름을 `role` 로 쓰지 않고 `claim`/`claimedRole`/`roles` 로 두면 "`role` 키는 `me` 아래에만"이라는 더 강한 불변식은 그대로 지킬 수 있다.

세 번째는 클라이언트 구조다. `RoomScreen` 이 `key={view.phase}` 로 단계마다 화면을 새로 마운트하므로 직업 공개 → 공개 연출 → 낮 토론에서 테이블이 깜빡인다. UI-SPEC 은 장면을 유지하라고 하므로 세 단계를 한 `DayScene` 이 쥐도록 `RoomScreen` 의 래퍼 키·`phase-enter` 래퍼를 바꿔야 한다. 새 패키지는 필요 없다(UI-SPEC 확정).

**Primary recommendation:** `PHASE_DEFS` 는 순수 데이터로 두고 `tick.ts` 에 `ON_ENTER` 훅 표를 추가해 루프 안에서 실행한다. 단계는 `dayAnnounce(2s) → claim(15s) → claimReveal(2s, 서버 단계로 분리) → discussion(90s) → dayAnnounce…` 로 둔다. 새 상태는 모두 optional 필드로 더하고(저장된 옛 방 호환), 뷰는 `view.day?` 한 덩어리로 단계 조건부 허용 목록 리터럴로만 만든다.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 단계 순서·시간·진입 전이(일차, 메시지 비우기, 주장 확정) | API / Backend (Room DO + `shared/game` 순수 함수) | — | 결정 0002. 클라이언트는 `phaseEndsAt` 로 표시만 한다 |
| 직업 선택지 목록(이번 판 구성) | API / Backend (`ROLE_TABLE` 한 곳) | Browser (뷰로 받은 목록을 칩으로 그림) | D-07: 칩·검증·메시지 직업 칩이 같은 목록 |
| 주장 보관·마감 확정·말 바꿈 판정 | API / Backend | — | 마감 전 남의 선택 비공개(D-01), 서버만 아는 값 |
| 메시지 검증(단계·생존·형식·대상·속도) | API / Backend | — | COMM-04. 클라이언트 검증은 UX 용일 뿐 |
| 메시지 문장 만들기("하윤 의심돼요") | Browser (템플릿 ID + seat + 직업 → 문장) | — | 서버는 문장을 보내지 않는다(UI-SPEC). 한국어 조사 처리는 화면 몫 |
| 메시지 보관(최근 20개)·재접속 복원 | API / Backend (영속 상태) | Browser (말풍선 남은 시간 계산) | D-15 |
| 이모티콘 전달 | API / Backend (이벤트 방송, 저장 안 함) | Browser (2초 표시) | UI-SPEC: 재접속 복원 없음 |
| 말풍선·이모티콘·완료 알약·주장 알약 렌더 | Browser (Table 확장, `SeatFloat`, `ClaimTag`) | — | 순수 표시 |
| 전송 쿨다운(2초) | API / Backend (판정) | Browser (버튼 흐림 = UX) | 서버가 기준, 클라이언트는 연타 방지 |
| 장면 유지(세 단계) | Browser (`DayScene`) | — | UI-SPEC "장면은 다시 그려지지 않는다" |

## Standard Stack

### Core (모두 이미 설치됨, 새 패키지 없음)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react / react-dom | 19.3.1 | 화면 | `package.json` 고정 버전 [VERIFIED: package.json:`"react": "19.3.1"`] |
| zod | 4.6.7 | 서버 입력 검증(`ClientMessageSchema`) | 이미 `shared/schemas.ts` 가 사용 [VERIFIED: node_modules/zod/package.json `"version": "4.6.7"`]. `z.strictObject` 있음 [VERIFIED: node_modules/zod/v4/classic/schemas.d.ts:531 `export declare function strictObject<T extends core.$ZodLooseShape>(shape: T, params?: string | core.$ZodObjectParams)`] |
| vitest | 4.1.12 | unit / client / worker 세 프로젝트 | [VERIFIED: vitest.config.ts, 이번 세션 `npx vitest run` → 42 files · 675 tests passed] |
| wrangler / `@cloudflare/vite-plugin` / `@cloudflare/vitest-plugin` | 4.151.3 / 1.64.0 / 1.4.6 | DO 개발·테스트 | [VERIFIED: package.json] |

### Supporting
없음. 이 페이즈는 새 패키지를 설치하지 않는다(UI-SPEC "Registry Safety": 새 패키지 설치 없음).

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `tick.ts` 훅 표 | `PHASE_DEFS` 행에 `onEnter` 함수 | 데이터 표에 로직이 들어가면 `phases.ts` ↔ `room.ts` 순환 import 위험, 기존 표 테스트가 행 모양(`durationMs/next/revealsOwnRole`)을 문자열로 비교하는 것과도 어긋난다. 훅 표는 `tick.ts` 에 둔다 |
| `claimReveal` 을 서버 단계로 분리 | 낮 토론 시작 후 2초 연출만 | 분리하면 모든 폰이 같은 시각에 시작·종료하고, 단계 검증(메시지 거부)이 자동으로 된다. 비분리는 "연출 중" 상태를 클라이언트가 추측해야 한다. **분리를 권장** |
| 방 상태에 `phaseDurationMs` 저장 | `extendUsed` 불리언 + 파생 | 후자가 필드가 적고 UI 가 `extendUsed` 를 어차피 필요로 한다. **파생을 권장** |
| 메시지를 별도 이벤트로 방송 | 메시지를 `state` 뷰에 포함 | 메시지는 재접속 복원이 필요하므로 상태에 둔다. 이모티콘만 이벤트 |

**Installation:** 없음.

**Version verification:** 새 패키지가 없어 레지스트리 조회 대상이 없다. 버전은 `package.json` 정확 고정값을 그대로 쓴다.

## Package Legitimacy Audit

이 페이즈는 외부 패키지를 설치하지 않는다. 감사 대상 없음.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (없음) | — | — | — | — | — | — |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
 폰(각자)                          Worker                    Room Durable Object (방당 1개)
 ─────────                         ──────                    ───────────────────────────────
 칩 탭/메시지/이모티콘/연장/넘기기
   │  WebSocket JSON (ClientMessage, 1024B 이하)
   ▼
 [연결당 20개/초 제한] ──▶ JSON.parse ──▶ ClientMessageSchema(strictObject)
                                              │ 실패 → error BAD_MESSAGE
                                              ▼
                                  advance(now): 만료 확인 + tick(상태, now)
                                              │          ▲
                                              │          └─ 마감 지난 단계마다 ON_ENTER 훅
                                              │             (dayAnnounce: day+1·메시지 비움·연장 초기화·claimLast 로 이월
                                              │              claim: 선택 초기화
                                              │              claimReveal: 미선택자 확정·changed 계산
                                              │              discussion: extendUsed=false)
                                              ▼
              ┌───────────── 핸들러(소켓 첨부의 playerId 로만 신원 확인) ─────────────┐
              │ claim   → 단계=claim?  선택지 ∈ 이번 판 직업+none?  → player.claimChoice 저장
              │ say     → 단계=discussion? 생존? 템플릿 형식? 대상 유효? 쿨다운? → messages 에 추가
              │ emoji   → 단계=discussion? 생존? 아이콘 ∈ 8개? 쿨다운?        → (저장 없이) 이벤트
              │ extend  → 방장? 단계=discussion? 이번 낮 미사용? → phaseEndsAt+30000, extendUsed
              │ skip    → 방장? 단계=discussion? → phaseEndsAt=now 로 놓고 tick
              └──────────────────────────────────────────────────────────────────────┘
                                              │ 실패 → error{WRONG_PHASE|NOT_HOST|RATE_LIMITED|BAD_MESSAGE|…}
                                              ▼
                    persist(storage "room") → 방송 (reschedule: 알람 = min(phaseEndsAt, expiresAt))
                       │ state: 연결마다 buildView(허용 목록 리터럴, 단계 조건부)
                       │ emoji: {t:"emoji", seat, icon, at} 이벤트(전원 동일, 저장 안 함)
                       ▼
 폰: useRoomConnection(parseServerMessage 에 "emoji" 추가) → RoomScreen → DayScene(장면 유지)
        단계별 패널: ClaimPanel / (공개 연출 패널) / DiscussionControls+MessageLog
        SeatFloat 훅: view.day.messages(at 기준 남은 3초) + emoji 이벤트(2초)
```

### Recommended Project Structure
```
shared/
├── protocol.ts            # PhaseId·ClientMessage·ServerMessage·RoomView·WsErrorCode 확장 (값 import 금지 유지)
├── schemas.ts             # 새 ClientMessage 의 strictObject 스키마 (Worker 만 import)
└── game/
    ├── phases.ts          # 단계 4행 추가·day 행 제거(순수 데이터 유지) + 시간 상수
    ├── tick.ts            # ON_ENTER 훅 표를 루프 안에서 실행
    ├── claim.ts           # 신설: 선택지 목록·선택·마감 확정·말 바꿈 (순수, TDD)
    ├── chat.ts            # 신설: 템플릿 표·이모티콘 ID·검증·쿨다운·로그 보관 (순수, TDD)
    ├── discussion.ts      # 신설: 연장·넘기기 (순수, TDD)  ← claim/chat 와 합쳐도 무방
    ├── alive.ts           # 신설: isAlive 공용 함수 (3페이즈가 탈락을 더함)
    ├── roles.ts           # rolesInPlay(playerCount) 추가
    ├── room.ts            # Player/RoomState optional 필드, startGame 초기화
    └── view.ts            # view.day? 단계 조건부 허용 목록
worker/room.ts             # 핸들러 5개, emoji 이벤트 방송, 옛 방 정규화
src/
├── net/useRoomConnection.ts  # parseServerMessage 에 emoji 허용, 이벤트 구독
├── net/seatFloats.ts         # 신설 훅: 말풍선·이모티콘 층 상태
├── game/messageText.ts       # 신설: 템플릿 → 문장 (은/는, 이었어요/였어요)
├── components/               # Chip, ClaimPanel, MessageLog, DiscussionControls, QuickMessageSheet, EmojiTraySheet, ClaimTag, SeatFloat; Table·Figure·Icon 확장
└── screens/                  # Day.tsx 개정(낮 시작 발표), DayScene.tsx 신설, RoomScreen.tsx 단계 switch 개정
test/{unit,client,worker}/    # 새 테스트 + 기존 4개 테스트 수정 (§Pitfall 2, 8)
scripts/smoke.mjs             # PHASE_ORDER·종료 단계 수정 (§Pitfall 9)
```

### Pattern 1: 단계 진입 훅은 `tick` 루프 안에서 (이 페이즈의 핵심)

**What:** `PHASE_DEFS` 는 데이터만 둔다. 진입 전이 함수는 `tick.ts` 의 `ON_ENTER: Partial<Record<PhaseId, (s: RoomState) => RoomState>>` 표에 두고, 루프에서 `phase = next` 로 바꾼 직후 그 단계 훅을 적용한다. 훅은 시각을 모르는 순수 함수다(마감 경계 시각이 필요하면 `phaseEndsAt` 로 충분하다).

**When to use:** 단계가 바뀔 때마다 상태 정리가 필요한 모든 경우. 3·4페이즈도 같은 표에 행을 더한다(결정 D-19 의 "next 한 줄").

**근거(직접 확인):** 현재 `tick` 은 아래처럼 `phase`·`phaseEndsAt` 만 바꾸고 상태를 넘기지 않는다.
[VERIFIED: shared/game/tick.ts:12-23] `phase = next; phaseEndsAt = duration === null ? null : phaseEndsAt + duration;` … `return { ...state, phase, phaseEndsAt };`
알람이 늦으면 한 번에 여러 단계를 따라잡으므로(주석: "늦게 불리면 여러 단계를 한 번에 따라잡는다") 훅이 루프 밖에 있으면 중간 단계의 전이가 사라진다.

**Example:**
```typescript
// shared/game/tick.ts — 권장 모양 (이 저장소 코드 스타일에 맞춘 초안)
const ON_ENTER: Partial<Record<PhaseId, (s: RoomState) => RoomState>> = {
  dayAnnounce: enterDay,          // day = (day ?? 0) + 1, messages = [], 모든 선수 claimLast ← claimPublished 이월 아님(아래 주의)
  claim: enterClaim,              // 모든 선수 claimChoice 초기화
  claimReveal: enterClaimReveal,  // 미선택자 확정 + changed 계산 + claimLast 갱신
  discussion: enterDiscussion,    // extendUsed = false
};

export function tick(state: RoomState, now: number): RoomState {
  let cur = state;
  let phaseEndsAt = state.phaseEndsAt;
  while (phaseEndsAt !== null && now >= phaseEndsAt) {
    const next = PHASE_DEFS[cur.phase].next;
    if (next === null) break;
    const duration = PHASE_DEFS[next].durationMs;
    phaseEndsAt = duration === null ? null : phaseEndsAt + duration;
    cur = { ...cur, phase: next, phaseEndsAt };
    cur = ON_ENTER[next]?.(cur) ?? cur;
  }
  return cur;   // 바뀐 게 없으면 입력 객체를 그대로(루프가 한 번도 안 돌면 cur === state)
}
```
**주의:** 현재 코드는 마지막에 `if (phase === state.phase && phaseEndsAt === state.phaseEndsAt) return state;` 로 항등 반환을 보장한다(워커의 `advance` 가 `next === room` 비교에 의존 — [VERIFIED: worker/room.ts `const next = tick(room, now); if (next === room) return;`]). 훅을 넣어도 루프가 안 돌면 같은 객체가 나가야 한다.

### Pattern 2: 주장 상태와 마감 확정 (D-01, D-03, D-05, D-08, D-09)

**상태(모두 optional — 옛 방 호환):** `Player` 에 `claimChoice?: Claim`(이번 낮 직접 고른 값, 없으면 미선택), `claimShown?: Claim`(이번 낮 공개된 값), `claimLast?: Claim`(직전 낮 공개 값, 어제 선택으로 쓰임), `claimChanged?: boolean`. `type Claim = RoleId | "none"`.

**전이 규칙표 (서버가 쥐는 단일 출처, 순수 함수로 구현하고 표 그대로 테스트):**

| 상황 | `me.claim`(내 화면 초기 선택) | 마감 때 공개되는 값 | `changed` |
|------|------------------------------|---------------------|-----------|
| 1일차, 직접 선택 X | 없음 | `none` | false |
| 1일차, 직접 선택 R | R | R | false (어제 없음) |
| 2일차+, 어제 R, 직접 선택 없음, **연결됨** | R (미리 선택) | R (유지) | false |
| 2일차+, 어제 R, 직접 선택 없음, **끊김** | R | `none` (D-05) | false (R→none 은 표시 없음) |
| 2일차+, 어제 R, 오늘 R' ≠ R | — | R' | **true** |
| 2일차+, 어제 R, 오늘 `none` | — | `none` | false |
| 2일차+, 어제 `none`, 오늘 R | — | R | false (처음 주장으로 본다, 권장안) |
| 2일차+, 어제 `none`, 직접 선택 없음, 연결됨 | `none` 미리 선택 | `none` | false |

[CITED: 02-UI-SPEC.md "확인 필요 2번, 확정" · "S-06c"] 연결된 사람이 가만히 있으면 어제 선택이 공개되고, 끊긴 사람만 말 안 함이다(사용자 확정). 공개 때 "연결됨"은 **마감 처리 시점의 `players[].connected`** 다.

`changed = prev !== undefined && prev !== "none" && shown !== "none" && shown !== prev`. 어제가 `none`이면 그 날 `claimLast = "none"` 이므로 D-08 의 "직전 낮이 말 안 함" 정의와 정확히 맞는다. (하루 걸러 `R → none → R` 이면 표시 없음. 이는 권장안의 직접 결과이므로 계획서에 명시한다.)

**누출 규칙:** `claim` 단계의 뷰는 (a) 모두에게 "선택한 자리 목록 `claimDone: number[]`", (b) 본인에게만 `me.claim`(= `claimChoice ?? claimLast`, 없으면 키 자체를 만들지 않음)을 싣는다. `claimShown`·`claimChanged` 는 `claimReveal` 이후 단계에서만 `view.day.claims` 로 싣는다. `claimLast` 는 어떤 뷰에도 직접 싣지 않는다(어제 공개된 정보라도 `claim` 단계 중 다른 사람 화면에 어제 값을 띄우면 "가만히 있는 사람"과 "고른 사람" 구분이 흐려지는 UI 문제만 생긴다 — 싣지 않는 것이 단순하다).

### Pattern 3: 메시지 템플릿 표와 검증 (COMM-01, COMM-04)

**What:** `shared/game/chat.ts` 에 템플릿 ID 5개를 데이터 표로 둔다(D-11 "행 하나만 더하면 된다").
```typescript
export const QUICK_TEMPLATES = {
  suspect:  { target: true,  role: false }, // "{닉네임} 의심돼요"
  trust:    { target: true,  role: false }, // "{닉네임} 믿어요"
  claimed:  { target: true,  role: true  }, // "{닉네임}은/는 {직업}이었어요"
  innocent: { target: false, role: false }, // "저 아니에요"
  vote:     { target: true,  role: false }, // "{닉네임} 투표해요"
} as const;
export const EMOJI_IDS = ["smile","grin","surprised","suspicious","angry","sad","heart","exclaim"] as const;
```
[CITED: 02-UI-SPEC.md "문장 만들기 규칙" 표, "이모티콘 그림 규격" 표의 이름 목록 `smile`(웃음), `grin`(크게 웃음), `surprised`(놀람), `suspicious`(의심), `angry`(화남), `sad`(슬픔), `heart`(좋아요), `exclaim`(느낌표)]

**검증 순서(권장, 순수 함수 `checkSay(state, playerId, msg, now)`):**
1. 단계가 `discussion` 아니면 `WRONG_PHASE` (직업 공개·공개 연출 포함 — 성공 기준 5)
2. 보낸 사람이 방에 있고 `isAlive` 여야 한다. 이 페이즈에는 탈락자가 없으니 거부 코드는 `BAD_MESSAGE` 로 두고(3페이즈가 확정), 지금은 `isAlive` 를 호출만 해 두고 테스트에서 `alive: false` 인 선수를 만들어 거부를 검증한다
3. 템플릿 형식: 필요한 칸(`target`/`role`)이 있고 불필요한 칸은 없어야 한다. 어긋나면 `BAD_MESSAGE`
4. `target` 은 방에 있는 seat, 보낸 사람 본인 아님, `isAlive`. 아니면 `BAD_MESSAGE`
5. `role`(claimed 만) 은 `rolesInPlay(players.length)` 안의 값. 아니면 `BAD_MESSAGE` (D-12; `none` 은 불가)
6. 쿨다운: `now - (player.lastSendAt ?? -Infinity) < 2000` 이면 `RATE_LIMITED`. **거부된 요청은 `lastSendAt` 을 갱신하지 않는다**(스팸이 잠금을 연장하지 못하게)
7. 통과하면 `lastSendAt = now`, `messages` 끝에 `{id, seat, template, target?, claimedRole?, at: now}` 추가 후 최근 20개만 남긴다

**스키마:** 와이어 스키마는 `z.strictObject` 로 알 수 없는 키(예: `text`)를 `BAD_MESSAGE` 로 거부한다. zod 4 에서 일반 `z.object` 는 미지 키를 조용히 버리므로(자유 텍스트가 "무시되며 통과"하는 모양) 거부 근거가 필요한 COMM-04 에는 strict 가 맞다. 조합 검증(템플릿별 필수 칸)은 스키마가 아니라 위 도메인 함수가 맡는다(테스트 가능, 클라이언트 번들에 zod 불포함 유지). [CITED: node_modules/zod/v4/classic/schemas.d.ts:531 — strictObject 선언]

**와이어 모양(권장):**
```typescript
| { t: "claim"; claim: RoleId | "none" }
| { t: "say"; template: TemplateId; target?: number; claimedRole?: RoleId }
| { t: "emoji"; icon: EmojiId }
| { t: "extend" }
| { t: "skip" }
```
신원은 **소켓 첨부(`attachmentOf(ws).playerId`)에서만** 얻는다. 메시지에 보낸 사람 seat 를 넣지 않는다(위조 불가). [VERIFIED: worker/room.ts `private attachmentOf(ws: WebSocket): SocketAttachment | null`, handleStart 가 `att.playerId` 만 사용]

### Pattern 4: 연장·넘기기 (DAY-01)

- `extend`: 방장 아니면 `NOT_HOST`, 단계가 `discussion` 아니면 `WRONG_PHASE`, `extendUsed` 면 새 코드(권장 `ALREADY_EXTENDED`, 클라이언트는 무시하고 서버 `state` 를 따른다 — 기존 `WRONG_PHASE` 재사용은 의미가 어긋남). 통과 시 `phaseEndsAt += 30_000`, `extendUsed = true`. **알람을 다시 걸어야 한다**(`reschedule()` — 안 하면 원래 마감에 알람이 먼저 깨어 `tick` 이 "마감 안 지남"으로 아무 일도 안 하고, 새 마감 알람이 없어 단계가 멈춘다. 이 저장소의 `alarm()` 은 `advance` 뒤 `reschedule` 하므로 실제로는 한 번 헛돌고 복구되지만, 방송 직후 `reschedule` 호출을 빠뜨리지 않는 것이 규칙이다).
- `skip`: 방장 아니면 `NOT_HOST`, 단계가 `discussion` 아니면 `WRONG_PHASE`. `{...state, phaseEndsAt: now}` 로 놓고 `tick(…, now)` 를 호출해 일반 전이 경로(훅 포함)를 그대로 쓴다. 다음 단계 마감은 `now + 2000`(이전 마감 + 길이 규칙이 그대로 성립).
- 방장 판정은 서버 상태의 `hostId` 와 소켓 첨부 `playerId` 로만 한다. 기존 `checkStart` 가 같은 패턴이다. [VERIFIED: shared/game/room.ts `if (actorId !== state.hostId) return "NOT_HOST";`]
- 뷰의 `phaseDurationMs` 는 파생한다: `def.durationMs + (phase === "discussion" && extendUsed ? 30_000 : 0)`. 현재 뷰 코드는 `phaseDurationMs: def.durationMs` 한 줄이다 [VERIFIED: shared/game/view.ts:58 `phaseDurationMs: def.durationMs,`] — 이 줄이 바뀌어야 연장 뒤 막대 비율이 맞다.

### Pattern 5: 메시지는 상태에, 이모티콘은 이벤트로

- 메시지: `RoomState.messages`(최대 20)·`nextMessageId`. 뷰의 `view.day.messages` 로 보내고 클라이언트는 `id` 로 새 것을 판별한다. 말풍선 남은 시간은 `view.serverNow - at` 으로 계산한다 — **서버 시각끼리 빼므로 시계 오프셋이 필요 없다**. 재접속 첫 `state` 에서도 같은 식으로 3초가 안 지난 것만 복원된다(UI-SPEC "재접속").
- 이모티콘: `{ t: "emoji"; seat: number; icon: EmojiId; at: number }` 를 연결된 모든 소켓에 방송(저장 안 함). 쿨다운 때문에 `lastSendAt` 만 상태에 쓴다.
- 서버→클라이언트 새 메시지 종류를 더하면 `ServerMessage` 유니온과 **클라이언트 `parseServerMessage` 허용 목록**을 함께 고쳐야 한다(§Pitfall 6).

### Pattern 6: 옛 방 호환 — 모든 새 필드는 optional, 읽는 쪽이 기본값을 쥔다

`everConnected?: boolean` 이 선례다: "이 필드가 없는 옛 상태(이미 살아 있던 방)는 접속한 것으로 본다." [VERIFIED: shared/game/room.ts:30-35 주석 + `everConnected?: boolean;`]. 같은 방식으로 `day?`, `extendUsed?`, `messages?`, `nextMessageId?`, `Player.claim*?`, `Player.lastSendAt?` 를 둔다. 읽는 곳은 `(state.day ?? 0)`, `state.messages ?? []`.

**배포 시점에 `day`(옛 단계) 에 있던 방:** 저장된 `phase === "day"`, `phaseEndsAt === null` 인 방은 새 `PhaseId` 에 없는 값이라 뷰가 `PHASE_DEFS["day"]` 에서 터진다. 방 수명이 3시간이고 1페이즈는 방금 끝난 테스트 단계라 위험은 낮지만, DO 생성자의 복구 지점에서 정규화 한 줄이면 막는다: `phase === "day"` 이면 `phase = "dayAnnounce"`, `phaseEndsAt = now + 2000`, `day = 1`. [VERIFIED: worker/room.ts 생성자가 storage 에서 `stored` 를 읽어 `this.room = {...stored, players: ...}` 로 복구] 이 정규화는 순수 함수 `normalizeStoredRoom(stored, now)` 로 `shared/game/room.ts` 에 두어 unit 테스트한다.

### Pattern 7: 클라이언트 — `DayScene` 이 장면을 쥔다

**문제(직접 확인):** `RoomScreen` 은 `<div key={view.phase} className="mf-phase-enter">` 로 단계마다 통째로 새로 그린다. [VERIFIED: src/screens/RoomScreen.tsx:125 `<div key={view.phase} className="mf-phase-enter">`] 이 방식이면 `claim → claimReveal → discussion` 에서 테이블·인물이 다시 마운트되어 깜빡인다(UI-SPEC "장면은 다시 그려지지 않는다").

**권장:**
- `RoomScreen.renderBody` 에서 래퍼 키를 `sceneKey = phase ∈ {claim, claimReveal, discussion} ? "dayScene" : phase` 로 바꾸고, `dayScene` 일 때는 바깥 `mf-phase-enter` 래퍼를 쓰지 않는다.
- `DayScene` 이 `Backdrop` + `Table` + 위쪽 바를 쥐고, 단계별 패널(`ClaimPanel` / 공개 연출 패널 / `DiscussionControls`+`MessageLog`)과 `PhaseBar` 에만 `key={phase}` + `phase-enter` 를 준다.
- 직업 공개 → 공개 연출을 **실시간으로 본** 경우에만 팝·흔들림을 돌린다: `DayScene` 이 `prevPhaseRef` 를 쥐고 `prev === "claim" && phase === "claimReveal"` 일 때 `animate=true`. 그렇지 않으면(재접속) 주장 알약만 정적으로 그린다.
- 공개 연출 중 타이머는 "0:00 과 빈 막대"여야 하므로 `view.phaseEndsAt`(2초 뒤)를 `Timer` 에 넘기지 않는다. `Timer endsAt={0} durationMs={...} offset={0}` 로 넘기면 `remainingMs` 가 0 으로 고정된다. [VERIFIED: src/net/clock.ts `return Math.max(0, deadline - (localNow + offset));`, src/net/countdown.ts `running = value.remainingMs > 0`]
- 말풍선·이모티콘 층(`SeatFloat`)은 `useSeatFloats(view, emojiEvents)` 훅이 `{[seat]: {kind, content, key, expiresAt}}` 를 쥔다. 자리마다 하나, 새 것이 이전 것을 바꾼다(UI-SPEC).
- 이모티콘 이벤트 전달: `useRoomConnection` 에 구독 함수(`onEvent(listener) → unsubscribe`, ref 기반)를 노출한다. 상태로 쌓으면 이벤트마다 전체 화면 렌더가 일어난다.

### Anti-Patterns to Avoid
- **`claim` 단계 뷰에 모든 자리의 `claimChoice` 를 실은 뒤 화면에서 숨기기:** CLAUDE.md "화면에서 숨기는 것으로 대신하지 않는다". 서버가 만들 때 단계 조건으로 키 자체를 안 만든다.
- **`role` 이라는 키 이름 재사용:** 기존 불변식 "role 키는 `.view.me.role` 에만"을 깨뜨리고 테스트를 느슨하게 만들어야 한다. `claim`/`claimedRole`/`roles` 를 쓴다.
- **메시지에 보낸 사람 seat 를 포함:** 신원은 소켓 첨부에서만. 클라이언트가 보낸 seat 는 쓰지 않는다.
- **`tick` 바깥에서 단계 전이를 구현(예: 알람 핸들러에서 훅 호출):** 지각 알람의 다단계 따라잡기가 훅을 건너뛴다.
- **공개 연출을 클라이언트 타이머로만 구현:** 서버 단계(`claimReveal`)가 없으면 폰마다 시작·끝이 달라지고 메시지 거부 근거가 모호해진다.
- **단계마다 `key={view.phase}` 로 장면 포함 화면을 통째로 새로 마운트:** §Pattern 7.
- **2초 쿨다운을 소켓 단위 메모리 `WeakMap` 에만 두기:** 기존 `rates` 가 그런 구조인데, 소켓이 바뀌면(재접속·교체) 쿨다운이 풀린다. 쿨다운은 플레이어 단위(`Player.lastSendAt`)로 둔다.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 입력 검증 | 손으로 쓴 `typeof`·`in` 검사 | 기존 `ClientMessageSchema`(zod 4.6.7) 에 `z.strictObject` 변형 추가 | 미지 키 거부·범위 검사·타입 좁히기. 이미 `satisfies z.ZodType<ClientMessage>` 로 와이어 타입과 묶여 있다 |
| 단계 시간·마감 연쇄 | 새 타이머·`setTimeout` | 기존 `PHASE_DEFS` + `tick` + DO 알람(`nextWakeAt`) | 하이버네이션에서도 살아남고, 마감 = 이전 마감 + 길이 규칙으로 폰 간 편차가 없다 |
| 서버 시계 보정 | 새 오프셋 계산 | 기존 `estimateOffset`/`remainingMs`/`useCountdown`, 말풍선 나이는 `view.serverNow - at` | 서버 시각끼리 빼면 오프셋이 필요 없다 |
| 시트 틀 | 새 모달 | 기존 `Sheet`(네이티브 `<dialog>.showModal()`) | 포커스 가두기·Esc·드래그 닫기·iOS 키패드·진입 폴백이 이미 해결됨(G-01-9 이력) |
| 토스트 | 새 알림 | 기존 `useToast`/`Toast` (`placement="top"`) | 한 칸 상태, 타이머 정리 포함. 위치만 UI-SPEC 값으로 덮어쓴다 |
| 자리 좌표 | 새 배치 계산 | `seatLayout(seat, mySeat)` | 모든 폰에서 같은 앉은 순서, 말풍선 위치도 이 좌표에서 파생 |
| 한국어 조사 | 라이브러리 | 12줄 `hasBatchim(ch)` 함수(유니코드 한글 음절 `(code - 0xAC00) % 28 !== 0`) | 요구가 "은/는"·"이었/였" 두 쌍뿐이고 한글 아닌 끝글자는 "는"(사용자 확정)이라 규칙이 닫혀 있다 |
| 난수 | 해당 없음 | — | 이 페이즈에 난수가 없다 |

**Key insight:** 이 페이즈는 새 기술이 아니라 **기존 틀 위의 규칙 추가**다. 위험은 라이브러리가 아니라 (1) 전이 훅 위치, (2) 뷰 단계 조건, (3) 기존 테스트 불변식 갱신에서 생긴다.

## Runtime State Inventory

이 페이즈는 개명·이관 페이즈는 아니지만 `PhaseId` 의 `"day"` 를 `"dayAnnounce"` 로 바꾸고 영속 상태 스키마를 확장하므로, 같은 질문("코드 갱신 뒤에도 남는 런타임 상태")을 짧게 확인한다.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | DO storage 키 `"room"` 의 `RoomState` 가 `phase: "day"` 로 저장된 살아 있는 방이 있을 수 있다(방 수명 3시간, `ROOM_TTL_MS = 3 * 60 * 60 * 1000`) [VERIFIED: shared/game/room.ts `export const ROOM_TTL_MS = 3 * 60 * 60 * 1000;`]. 새 optional 필드는 없는 상태로 저장돼 있다 | **코드 편집 + 정규화 함수**(§Pattern 6). 데이터 마이그레이션 작업은 없다(방이 곧 만료) |
| Live service config | 없음 — Cloudflare 설정은 `wrangler.jsonc` 에 있고 새 바인딩·마이그레이션이 필요 없다. `Room` 클래스 이름은 바꾸면 방 데이터가 지워지므로 그대로 둔다(결정 0009, HANDOFF) | 없음 |
| OS-registered state | 없음 — 확인: 로컬 OS 등록(작업 스케줄러·launchd) 없음, 배포 대상은 Workers | 없음 |
| Secrets / env vars | 없음 — 이 페이즈가 읽는 새 비밀·환경 변수 없음 | 없음 |
| Build artifacts | `dist/`(vite 빌드 산출물), `worker-configuration.d.ts`(typecheck 가 생성) | 배포 때 `npm run deploy` 가 `vite build` 를 다시 하므로 별도 작업 없음 |

## Common Pitfalls

### Pitfall 1: 마감 전 남의 선택이 뷰나 프레임에 실린다
**What goes wrong:** `view.players[]` 나 `view.day.claims` 를 `claim` 단계에도 채우면 네트워크 탭에서 남의 선택이 보인다. 이 게임에서 직업 주장은 참/거짓과 무관하게 "동시 공개"가 규칙이라 선공개는 곧 규칙 위반이다(D-01).
**Why it happens:** `buildView` 를 한 번에 만들고 "나중에 필터"하려는 습관.
**How to avoid:** `view.day` 를 단계 조건부 허용 목록 리터럴로만 만든다. `claim` 단계: `claimDone`(seat 배열)과 `me.claim` 만. `claims` 키는 `claimReveal`·`discussion` 에서만 생성(키 자체가 없음).
**Warning signs:** `claim` 단계 프레임에 `"mafia"`/`"police"` 문자열이 본인 `me.claim` 외에 등장한다. → 워커 통합 테스트: 서로 다른 선택을 한 두 소켓의 `claim` 단계 프레임 전체 문자열에서 상대 선택 값이 어느 프레임에도 없어야 한다.

### Pitfall 2: 기존 누출 테스트의 "역할 값은 하나뿐" 정규식이 합법적인 공개 값 때문에 깨진다
**What goes wrong:** `view.test.ts` 와 `leak.test.ts` 는 뷰 JSON 에서 `"(mafia|police|doctor|citizen)"` 를 세어 `me.role` 하나(허용 1 또는 0)와 다르면 실패한다. [VERIFIED: test/unit/view.test.ts 전수 누출 검사 — `const roleValues = /"(mafia|police|doctor|citizen)"/g; … if (found.length !== allowed) violations.push(...)`]. 새 뷰는 합법적으로 `view.day.roles`(구성 목록), 공개된 주장 값, 메시지의 `claimedRole` 을 싣는다. 그대로 두면 **정상 구현이 테스트에 걸리고**, 반대로 테스트를 통째로 느슨하게 만들면 진짜 누출을 못 잡는다.
**How to avoid:** 허용 경로 목록을 명시해 그 경로의 값은 세지 않고 나머지에서만 센다. 허용: `me.role`, `me.claim`(claim 단계), `day.roles[]`, `day.claims[].claim`(claimReveal·discussion), `day.messages[].claimedRole`. 또 "`role` 키는 `me` 아래에만" 불변식은 유지한다(필드 이름 규칙으로 가능). 개정은 Wave 0 첫 작업으로 둔다. `PHASES` 배열(`["lobby","assigning","roleReveal","day"]`)과 단계 개수 단언도 함께 고쳐야 한다.
**Warning signs:** 새 필드를 넣자마자 `view.test.ts` 가 `NN role values, allowed 1` 로 실패한다.

### Pitfall 3: 연장 뒤 `phaseDurationMs` 가 90000 으로 남는다
**What goes wrong:** 뷰가 `def.durationMs` 를 그대로 보내면 연장 뒤 `Timer` 의 `ratio = remaining / durationMs` 가 1 을 넘어 막대가 꽉 찬 채 멈춘다(`Math.min(1, …)` 로 잘림).
**How to avoid:** §Pattern 4 의 파생식. 단위 테스트: 연장 전 `90000`, 연장 후 `120000`, 다음 낮 `discussion` 진입 후 다시 `90000` 과 `extendUsed === false`.

### Pitfall 4: 연장/넘기기 뒤 알람을 다시 걸지 않는다
**What goes wrong:** 단계 마감이 바뀌었는데 DO 알람은 이전 시각이라 마감이 지연되거나(연장) 불필요하게 일찍 깨어난다(넘기기는 `tick` 을 직접 불러 상태는 맞지만 다음 단계 마감 알람이 필요).
**How to avoid:** `handleStart` 와 같은 순서 — 상태 교체 → `persistAndBroadcast()` → `reschedule()`. [VERIFIED: worker/room.ts handleStart `this.room = result.state; await this.persistAndBroadcast(); await this.reschedule();`]

### Pitfall 5: 2초 제한이 서버·클라이언트 어느 한쪽에만 있다 / 쓰임이 두 겹
**What goes wrong:** (a) 연결당 `RATE_MAX_MESSAGES = 20`/초 제한은 있지만 이것은 도배 방어일 뿐 "2초에 하나"가 아니다. [VERIFIED: worker/room.ts:43-44 `const RATE_WINDOW_MS = 1000; const RATE_MAX_MESSAGES = 20;`] (b) 소켓 단위 메모리라 재접속으로 풀린다. (c) 클라이언트가 보낸 직후 2000ms 흐림을 걸고 서버도 2000ms 를 걸면, **네트워크 지터로 두 번째 요청이 첫 번째보다 서버에 2000ms 미만 간격으로 도착**해 정상 사용자가 `RATE_LIMITED` 를 받을 수 있다(UI-SPEC 은 이 경우 조용히 버튼만 다시 잠근다 = 메시지 소실).
**How to avoid:** 플레이어 단위 `lastSendAt`(영속)과 순수 함수 `now` 주입으로 판정·테스트. 서버 한도는 성공 기준대로 2000ms 로 두되, 클라이언트 쿨다운은 보낸 시각이 아니라 **내 메시지가 `view.day.messages` 에 `at` 으로 돌아온 뒤(이모티콘은 이벤트 `at`)부터** 세는 것을 검토한다(= 서버 시각 기준, 지터 제거). 단순안(보낸 시각 +2000ms)은 UI-SPEC 문구와 맞고 위험은 낮다 — 계획에서 택일(§Open Questions 2).
**Warning signs:** 실기기에서 "정확히 2초마다 연타"하면 간헐적으로 메시지가 안 뜬다.

### Pitfall 6: 클라이언트 `parseServerMessage` 가 새 메시지 종류를 조용히 버린다
**What goes wrong:** 지금은 `v.t === "state" || "pong" || "error"` 만 통과한다. [VERIFIED: src/net/useRoomConnection.ts:57 `if (v && (v.t === "state" || v.t === "pong" || v.t === "error")) return v as ServerMessage;`] `{t:"emoji"}` 를 서버가 보내도 클라이언트가 `null` 로 버려 이모티콘이 영영 안 뜬다. 타입 검사로는 안 잡힌다(런타임 허용 목록).
**How to avoid:** 허용 목록에 `"emoji"` 추가 + `useRoomConnection` 테스트에 emoji 프레임 수신 케이스.

### Pitfall 7: `RoomScreen` 의 `PHASE_ANNOUNCE` 와 `renderPhase` switch 누락
**What goes wrong:** 새 `PhaseId` 를 더하면 `PHASE_ANNOUNCE`(`as const` 객체)·`renderPhase`(switch)가 컴파일 오류로 알려 주지만, 접근성 안내 문구 4개(UI-SPEC: `dayAnnounce` "{N}일차 낮이 되었습니다", `claim` "직업 공개. 주장할 직업을 고르세요", `claimReveal` "직업이 공개되었습니다", `discussion` "낮 토론")는 `{N}` 이 있어 객체 상수가 아니라 함수가 필요하다. [CITED: 02-UI-SPEC.md "접근성·상호작용 규칙"]
**How to avoid:** `PHASE_ANNOUNCE` 를 `(view) => string` 으로 바꾼다.

### Pitfall 8: 기존 테스트가 새 단계 구성과 충돌한다 (Wave 0 에서 한꺼번에 정리)
직접 확인한 충돌 지점:
- `test/unit/tick.test.ts`: "단계는 lobby·assigning·roleReveal·day 네 개뿐이다" 와 `"roleReveal"… day: "null/null/true"` 행 문자열 단언 [VERIFIED: tick.test.ts `expect(\`${keys.length}:${keys.join(",")}\`).toBe("4:assigning,day,lobby,roleReveal")`]
- `test/unit/view.test.ts`: `PHASES` 배열, `day:null` 길이 문자열, `roleReveal` 마감 + `day` 마감 `null` 단언
- `test/worker/alarm.test.ts`: "roleReveal 마감 뒤 알람은 모두를 day 로 넘기고 phaseEndsAt 이 null 이며 다음 알람은 방 만료 시각이다"
- `test/worker/leak.test.ts`: `waitAll("day")`, `msg.view.phase === "day"`
- `scripts/smoke.mjs`: `const PHASE_ORDER = ["lobby", "assigning", "roleReveal", "day"];` 과 마지막 단계가 `day` 라는 단언(§Pitfall 9)
- `test/client/*`: `RoomView` 픽스처 3곳(`lobby.test.tsx`, `roomScreen.test.tsx`, `phaseScreens.test.tsx`)과 `PHASE_ANNOUNCE`. `tsconfig.app.json` 의 include 에 `test/client` 가 있어 `npm run typecheck` 가 검사한다. `RoomView` 에 필수 필드를 더하면 픽스처가 전부 깨진다 → **`view.day?` 를 optional 한 덩어리로** 두면 로비·배정·역할 확인 픽스처는 그대로다.

### Pitfall 9: 배포 스모크(`scripts/smoke.mjs`)가 새 단계 흐름에서 실패한다
1페이즈 성공 기준과 CLAUDE.md "이른 배포" 원칙 때문에 이후 페이즈 검증은 배포본으로 한다. 스모크는 `day` 를 종착으로 가정한다. 2페이즈가 `day` 를 없애므로 `--stage full` 이 깨진다. 스모크를 `discussion` 도달 + 메시지 1건 수신까지로 확장한다(단, 전체 시간이 `FULL_TOTAL_LIMIT_MS` 한도를 넘지 않는지 확인 — 역할 배정 3s + 확인 15s + 발표 2s + 직업 공개 15s + 연출 2s = 약 37초 뒤 토론 도달).

### Pitfall 10: 한 라운드가 109초라 PLAY-01(6~10분) 에 영향
낮 한 바퀴(임시 루프) = 2 + 15 + 2 + 90 = 109초(연장 시 139초). 3·4페이즈 뒤 한 판 전체가 6~10분 안에 들어가는지는 6페이즈에서 판단(결정 0007 이 이미 인정한 사항). 이 페이즈에서는 상수만 한 곳(`phases.ts`)에 둔다.

### Pitfall 11: `phase-enter` 가 장면에 걸려 깜빡인다 / 시트가 단계 전환 때 안 닫힌다
시트는 `discussion` 패널 안에서 열림 상태를 쥐므로 단계가 바뀌어 패널이 언마운트되면 `Sheet` 의 정리 함수가 `dlg.close()` 한다 [VERIFIED: src/components/Sheet.tsx `if (dlg.open) dlg.close();` 정리 함수]. 열림 상태를 `RoomScreen` 같은 위쪽에 두면 단계가 바뀌어도 시트가 남는다 — `[내 역할]` 시트는 의도적으로 위쪽(`RoomScreen`)에 있고 이 두 시트는 반대 규칙이다(UI-SPEC "시트는 단계에 묶여 있다").

### Pitfall 12: `Table` 이 "역할 필드 없음" 규칙을 어긴다
`Table` 의 입력에 역할 필드를 넣지 않는다는 1페이즈 규칙 [VERIFIED: src/components/Table.tsx 머리 주석 "입력에 역할 필드가 없다(D-22)"] 을 지키면서 공개 주장을 넘겨야 한다. UI-SPEC 의 `claim: { role: RoleId | "none"; changed }` 는 **공개된 주장**이라 와이어 `role` 키와 무관한 컴포넌트 props 이므로 허용되지만, 이름이 헷갈리지 않게 props 에서는 `claim: { job: Claim; changed: boolean }` 로 두는 것을 권장.

## Code Examples

### 이번 판 직업 목록 (서버 구성표 한 곳, D-07)
```typescript
// shared/game/roles.ts 에 추가 — ROLE_TABLE 에서만 파생한다
// Source: 이 저장소 shared/game/roles.ts 의 ROLE_TABLE, ROLE_IDS (직접 확인)
export function rolesInPlay(playerCount: number): RoleId[] {
  if (!isSupportedCount(playerCount)) return [];
  const comp = ROLE_TABLE[playerCount];
  return ROLE_IDS.filter((r) => comp[r] > 0); // 순서: mafia, police, doctor, citizen = UI 순서
}
```
[VERIFIED: shared/game/roles.ts:6-7 `export type RoleId = "mafia" | "police" | "doctor" | "citizen"; export const ROLE_IDS: readonly RoleId[] = ["mafia", "police", "doctor", "citizen"];` · ROLE_TABLE 4명 행 `4: Object.freeze({ mafia: 1, police: 1, doctor: 0, citizen: 2 })`]

### 마감 확정 (진입 훅, 순수)
```typescript
// shared/game/claim.ts — 초안 (규칙표 §Pattern 2 의 구현)
export type Claim = RoleId | "none";
export function enterClaimReveal(state: RoomState): RoomState {
  return {
    ...state,
    players: state.players.map((p) => {
      const shown: Claim = p.claimChoice ?? (p.connected ? (p.claimLast ?? "none") : "none");
      const last = p.claimLast;
      const changed = last !== undefined && last !== "none" && shown !== "none" && shown !== last;
      return { ...p, claimShown: shown, claimChanged: changed, claimLast: shown };
    }),
  };
}
```

### 클라이언트 문장 만들기 (템플릿 ID + seat + 직업)
```typescript
// src/game/messageText.ts — 초안
const hasBatchim = (ch: string): boolean => {
  const c = ch.charCodeAt(0);
  return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0; // 한글 아니면 false → "는"(사용자 확정)
};
const eunNeun = (name: string) => (hasBatchim(name.at(-1) ?? "") ? "은" : "는");
const iEoss = (word: string) => (hasBatchim(word.at(-1) ?? "") ? "이었어요" : "였어요");
// claimed: `${nick}${eunNeun(nick)} ${ROLE_TEXT[role].name}${iEoss(ROLE_TEXT[role].name)}`
```
[CITED: 02-UI-SPEC.md "문장 만들기 규칙" 표: `claimed` — "{닉네임}{은/는} {직업}{이었어요/였어요}", 한글이 아닌 글자는 "는"] · 역할 이름은 `ROLE_TEXT` 에서 가져온다 [VERIFIED: src/game/roleText.ts `mafia: { name: "마피아", … }, police: { name: "경찰", … }, doctor: { name: "의사", … }, citizen: { name: "시민", … }`]. 이름 끝 글자가 이모지·결합 문자일 때 `at(-1)` 은 마지막 UTF-16 코드 유닛이라 한글 판정에서 안전하게 `false` 로 떨어진다(조사는 "는").

### 말풍선 남은 시간 (서버 시각끼리)
```typescript
// 새 메시지 판별은 id, 남은 시간은 view.serverNow - at (오프셋 불필요)
const remaining = BUBBLE_MS - (view.serverNow - entry.at); // > 0 이면 표시
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 1페이즈 `day` = 종착 단계(시간·next 없음) | `dayAnnounce` + 3단계, `discussion.next = dayAnnounce` 임시 루프 | 이 페이즈 | 3페이즈가 `discussion.next` 를 밤으로, 4페이즈가 사이에 투표 단계를 끼움 |
| `tick` 이 phase/phaseEndsAt 만 갱신 | 진입 훅 표 | 이 페이즈 | 3·4페이즈의 모든 진입 전이가 같은 표를 쓴다 |
| 단계마다 화면 통째 재마운트(`key={phase}`) | 장면(`DayScene`)은 유지, 패널만 교체 | 이 페이즈 | 3페이즈의 밤·아침 화면도 장면 유지 방식을 따르게 될 수 있다 |

**Deprecated/outdated:**
- 로드맵 성공 기준 3 의 예시 "저는 [경찰]이에요" — D-11 로 빠졌다. ROADMAP.md 문구 정정이 필요하다(§Open Questions 3).
- `EmojiBar/README.md` 의 옛 이모티콘 이름 목록(의심·놀람·물음·웃음·한숨·당황·믿음·화남) — UI-SPEC M8 이 8개를 확정했다.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 쿨다운 위반 시 `lastSendAt` 을 갱신하지 않는 것이 맞다(스팸이 잠금을 연장하지 못하게). CONTEXT 에 명시 없음 | Pattern 3 | 낮음. 갱신하는 쪽으로 바뀌어도 테스트 한 줄 |
| A2 | 연장 중복 시 새 에러 코드 `ALREADY_EXTENDED` 를 추가해 클라이언트가 무시하는 것이 `WRONG_PHASE` 재사용보다 낫다. UI-SPEC 오류표에 이 상황이 없다 | Pattern 4 | 낮음. 어느 쪽이든 화면은 "표시 없음 + 서버 state 따름" |
| A3 | 하루 걸러 `R → none → R` 는 말 바꿈 표시가 없다(D-08 권장안의 직접 귀결). 직전 "직업" 주장을 따로 보관해 비교하는 대안도 가능 | Pattern 2 | 중간. 플레이 감각에서 "말 안 함으로 말 바꿈을 숨기는" 전략이 가능 — 사용자 확인 가치 있음(권장안은 CONTEXT 가 이미 채택) |
| A4 | 낮 토론 중 모든 선수가 `isAlive` 라 탈락자 메시지 거부 코드는 이 페이즈에서 정할 필요가 없다(3페이즈 몫). `BAD_MESSAGE` 로 두고 테스트용 `alive: false` 픽스처로만 검증 | Pattern 3 | 낮음 |
| A5 | DO 가 활동 없이 약 10초 뒤 하이버네이션될 수 있어 인메모리 쿨다운은 부적합하다고 보았다. 이 결론은 쿨다운을 영속 상태에 두는 근거일 뿐이고, 정확한 하이버네이션 시간은 이번 세션에 문서로 확인하지 않았다 | Anti-Patterns | 낮음. 영속 저장은 어느 쪽이든 안전 |
| A6 | 매 이모티콘마다 `storage.put("room")` 한 번(쿨다운 영속)이 8명 규모에서 비용·지연 문제가 없다 | Pattern 5 | 낮음. 문제 시 `lastSendAt` 만 인메모리 + 영속 이중화로 완화 |
| A7 | 직업 공개 중 2일차 이후 `claim` 단계 화면에서 다른 사람 자리에 어제 주장 알약을 띄우지 않는다(`claimLast` 비노출). UI-SPEC 은 "직업 공개 중 알약"을 명시하지 않음 | Pattern 2 | 낮음. 어제 주장은 공개 정보라 보여 줘도 누출은 아니지만 "고른 사람" 구분과 겹침 |
| A8 | `claimReveal` 서버 단계 분리가 비분리보다 낫다는 판단 | Standard Stack > Alternatives | 낮음. UI-SPEC 이 계획에 위임("확인 필요 3")하고 권장안이 분리 |

## Open Questions

1. **`ALREADY_EXTENDED` 같은 새 `WsErrorCode` 를 둘지**
   - What we know: UI-SPEC 오류표가 `RATE_LIMITED`·`WRONG_PHASE`·`NOT_HOST`·`BAD_MESSAGE` 만 다룬다.
   - What's unclear: 연장 중복을 어느 코드로 돌릴지.
   - Recommendation: 새 코드를 추가하고(클라이언트는 무시), 거절 응답에 `state` 를 함께 보내 `handleStart` 처럼 화면을 서버 값으로 되돌린다.

2. **전송 쿨다운의 클라이언트 기준 시각**
   - What we know: UI-SPEC 은 "보낸 직후 2초 흐림", 서버는 2000ms.
   - What's unclear: 지터로 인한 오탐 `RATE_LIMITED` 의 허용 여부(§Pitfall 5).
   - Recommendation: 단순안(보낸 시각 + 2000ms)으로 시작하고 6페이즈 실기기에서 오탐이 나오면 서버 시각 기준으로 바꾼다. 위험이 크면 서버 한도를 1800ms 로 완화하는 것도 성공 기준 5(2초 내 재전송 거부)와 테스트를 모두 통과한다.

3. **문서 정정 항목**
   - 로드맵 성공 기준 3 의 "저는 [경찰]이에요" 예시와 성공 기준 6 의 "세 번 이하"(`claimed` 템플릿은 4번 — 사용자 확정, UI-SPEC 에 "성공 기준 6 은 '대상·직업이 필요한 문구는 예외'로 고친다"고 적혀 있음)를 ROADMAP.md 에서 고쳐야 한다. 계획의 문서 작업 한 줄로 넣는다.

4. **말 바꿈의 하루 걸러 규칙(A3)**
   - 사용자에게 다시 묻기보다 CONTEXT 권장안대로 구현하고 테스트 이름에 규칙을 명시한다.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | 전체 | ✓ | v26.0.0 (`engines` ≥22.12 충족) | — |
| wrangler | 워커 테스트·배포 | ✓ | 4.151.3 | — |
| vitest (unit/client/worker) | 검증 | ✓ | 4.1.12, 이번 세션 42 files · 675 tests 통과(약 5초) | — |
| Cloudflare 계정·`wrangler login` | 배포(`npm run deploy`) | 미확인 | — | 배포 직전 `npx wrangler whoami` 로 개인 계정 확인(HANDOFF 환경 메모). 로컬 `vitest` 검증은 계정 불필요 |
| 실기기(iPhone Safari·Android) | 360×640 레이아웃, 말풍선 클램프, 시트 | 사람 확인 | — | UAT 단계(`human_verify_mode: end-of-phase`) |

**Missing dependencies with no fallback:** 없음.
**Missing dependencies with fallback:** Cloudflare 로그인 상태는 이번 세션에 확인하지 않았다(배포 전 확인).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.12 — 프로젝트 3개: `unit`(node) · `client`(happy-dom) · `worker`(workerd, `@cloudflare/vitest-plugin`) [VERIFIED: vitest.config.ts] |
| Config file | `/Users/dhkim1522/personal/minifia/vitest.config.ts` |
| Quick run command | `npx vitest run --project unit` (순수 규칙, 수 초) |
| Full suite command | `npx vitest run` (기준선 약 5초) + `npm run typecheck` |

`workflow.tdd_mode: true` [VERIFIED: .planning/config.json]. `shared/game/*` 순수 함수는 테스트 먼저(RED) → 구현(GREEN).

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DAY-02 | 선택지 = 이번 판 직업 + none(4명판은 의사 없음) | unit | `npx vitest run test/unit/claim.test.ts -t "rolesInPlay"` | ❌ Wave 0 |
| DAY-02 | 규칙표 8행(미선택·끊김·말 바꿈·none 전이) | unit | `npx vitest run test/unit/claim.test.ts` | ❌ Wave 0 |
| DAY-02 | 마감 전 다른 사람 선택이 뷰에 없음(`claimDone` 만) | unit + worker | `npx vitest run test/unit/view.test.ts test/worker/day.test.ts -t "claim 누출"` | ✅ view.test.ts 수정 / ❌ day.test.ts Wave 0 |
| DAY-02 | tick 훅: 일차+1, 선택 초기화, 지각 알람의 다단계 따라잡기에서도 훅이 순서대로 | unit | `npx vitest run test/unit/tick.test.ts` | ✅ 수정 |
| DAY-02 | 단계 흐름·마감 연쇄(roleReveal→dayAnnounce→claim→claimReveal→discussion→dayAnnounce) | worker | `npx vitest run test/worker/alarm.test.ts test/worker/day.test.ts` | ✅ 수정 / ❌ |
| DAY-01 | 방장만 연장·넘기기, 연장 1회/낮, 다음 낮 재사용, `phaseDurationMs` 파생 | unit | `npx vitest run test/unit/discussion.test.ts` | ❌ Wave 0 |
| DAY-01 | 연장·넘기기 뒤 알람 재설정, 비방장 거부(`NOT_HOST`), 연장 중복 거부 | worker | `npx vitest run test/worker/day.test.ts -t "연장"` | ❌ Wave 0 |
| DAY-01 | 방장 줄이 방장에게만 렌더, 생존자 목록·타이머 | client | `npx vitest run test/client/day.test.tsx` | ❌ Wave 0 |
| COMM-01 | 템플릿 5개 검증(필수·불필요 칸, 대상 유효성, 직업 ∈ 이번 판) | unit | `npx vitest run test/unit/chat.test.ts` | ❌ Wave 0 |
| COMM-01 | 문장 만들기(은/는, 이었/였, 한글 아닌 끝글자) | unit | `npx vitest run test/unit/messageText.test.ts` | ❌ Wave 0 |
| COMM-01 | 최근 20개 보관·낮이 끝나면 비움·뷰 복원 | unit | `npx vitest run test/unit/chat.test.ts -t "보관"` | ❌ Wave 0 |
| COMM-01 | 시트 조작 횟수(대상 필요 문구: 템플릿 선택이 미리 되어 있어 대상 → 보내기, `claimed` 4번) | client | `npx vitest run test/client/quickMessageSheet.test.tsx` | ❌ Wave 0 |
| COMM-02 | 이모티콘 이벤트 방송(저장 안 함, 쿨다운 공유) | worker | `npx vitest run test/worker/day.test.ts -t "emoji"` | ❌ Wave 0 |
| COMM-02 | `parseServerMessage` 가 emoji 를 통과, 2초 층 표시 | client | `npx vitest run test/client/useRoomConnection.test.tsx test/client/seatFloats.test.tsx` | ✅ 수정 / ❌ |
| COMM-04 | 단계(직업 공개·공개 연출 포함)·자유 텍스트(`text` 키)·미지 템플릿·2초 내 재전송 거부, 거부된 것은 다른 소켓 프레임에 없음 | unit + worker | `npx vitest run test/unit/chat.test.ts test/worker/day.test.ts -t "거부"` | ❌ Wave 0 |
| COMM-04 | 쿨다운 경계 2000ms(1999 거부 / 2000 허용), 거부는 `lastSendAt` 불변 | unit | `npx vitest run test/unit/chat.test.ts -t "쿨다운"` | ❌ Wave 0 |
| (회귀) | 새 필드가 옛 저장 방(필드 없음)에서도 뷰 생성 가능, `phase:"day"` 저장 방 정규화 | unit | `npx vitest run test/unit/gameRoom.test.ts -t "정규화"` | ❌ Wave 0 |
| (회귀) | 전수 누출: 새 허용 경로 외 역할 값 없음, `role` 키는 `me` 아래에만 | unit + worker | `npx vitest run test/unit/view.test.ts test/worker/leak.test.ts` | ✅ 수정 |

### Sampling Rate
- **Per task commit:** `npx vitest run --project unit` (또는 해당 파일 하나)
- **Per wave merge:** `npx vitest run` + `npm run typecheck`
- **Phase gate:** 전체 green + `node scripts/smoke.mjs --prod --stage full`(확장 후) + 실기기 UAT 항목(§UI-SPEC 🧪 backstop 5건: 8명 360px 알약 겹침, 360×640 스크롤 없음 ×2, 말풍선 클램프, 주장 알약 최대 폭)

### Wave 0 Gaps
- [ ] `test/unit/{claim,chat,discussion,messageText}.test.ts` — 새 순수 함수
- [ ] `test/worker/day.test.ts` — 낮 단계 진행·검증 거부·누출 통합 (`forceDue` + `runDurableObjectAlarm` 를 한 단계씩, 헬퍼 `advanceTo(code, phase)` 필요)
- [ ] `test/worker/helpers.ts` — `advanceTo`, 방 꾸미기에서 `discussion` 까지 가는 헬퍼. `forceDue` 는 `phaseEndsAt` 를 `Date.now() - 1` 로 두므로 전이마다 한 단계만 넘어간다(새 마감 = 이전 마감 + 길이 > now) [VERIFIED: test/worker/helpers.ts forceDue, tick 의 연쇄 규칙]
- [ ] `test/client/{day,quickMessageSheet,seatFloats}.test.tsx` 및 `RoomView` 픽스처 정리
- [ ] 기존 테스트 개정: `tick.test.ts`, `view.test.ts`, `alarm.test.ts`, `leak.test.ts`, `useRoomConnection.test.tsx`, `phaseScreens.test.tsx`, `roomScreen.test.tsx`
- [ ] 2초 쿨다운을 워커 통합에서 실제로 기다리지 않도록: 저장된 `lastSendAt` 을 `runInDurableObject` 로 과거로 옮기는 헬퍼(기존 `forceDue` 방식)

## Security Domain

`security_enforcement` 는 활성(`config.json` 에 `true`, `security_asvs_level: 1`, `security_block_on: "high"`) [VERIFIED: .planning/config.json].

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (신규 없음) | 기존 토큰 hello. 이 페이즈는 신원을 소켓 첨부로만 사용 |
| V3 Session Management | no (신규 없음) | 기존 |
| V4 Access Control | **yes** | 방장 전용 `extend`/`skip` 은 서버 `hostId` 비교, 단계·생존 검증을 서버가 수행. 클라이언트에서 방장 줄을 숨기는 것은 UX 일 뿐 |
| V5 Input Validation | **yes** | zod `strictObject`(미지 키 거부) + 도메인 검증(대상 seat 존재·본인 아님, 직업 ∈ 구성, 템플릿별 필수/불필요 칸). 프레임 1024바이트 상한 유지 |
| V6 Cryptography | no | 난수·암호 사용 없음 |
| V8 Data Protection | **yes** | 마감 전 남의 선택 비공개(허용 목록 뷰), 토큰·id·connId 비노출 유지 |
| V13 API / WebSocket | yes | 연결당 20개/초(기존) + 플레이어 단위 2초 쿨다운(신규) |

### Known Threat Patterns for 이 스택

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| 마감 전 남의 직업 주장 열람(네트워크 탭) | Information Disclosure | 뷰를 단계 조건부 허용 목록으로 생성, 워커 통합 테스트로 전 프레임 검사 |
| 자유 텍스트 우회 주입(`say` 에 `text` 추가) | Tampering / XSS 유발 | `z.strictObject`, 서버가 문장을 만들지 않고 클라이언트가 템플릿 ID 로 만든다. 닉네임은 React 텍스트·`title` 로만 렌더 |
| 보낸 사람 위조(메시지에 seat 포함) | Spoofing | 와이어에 보낸 사람 필드 없음, 소켓 첨부 `playerId` 사용 |
| 비방장의 연장·넘기기 | Elevation of Privilege | 서버 `hostId` 검사, `NOT_HOST` |
| 단계 경합(직업 공개 중·종료 직후 메시지) | Tampering | `advance(now)` 가 먼저 돌고 단계 검증이 `WRONG_PHASE` 로 거부 |
| 메시지 도배·로그 팽창 | DoS | 2초 쿨다운 + 최대 20개 보관 + 낮 종료 시 비움 + 프레임 1024B + 연결당 20/초 |
| 유효하지 않은 대상 seat(빈 자리·범위 밖·탈락자) | Tampering | `target` 이 방에 있고 `isAlive` 이며 보낸 사람이 아님을 서버가 검사. 스키마에서 `int().min(0).max(7)` |
| 구성에 없는 직업 주장(`claimed`, `claim`) | Tampering | `rolesInPlay(n)` 밖은 `BAD_MESSAGE`. `claim: "none"` 은 `claim` 메시지에만 허용, `claimed` 템플릿에는 불허 |
| 경합 이중 연장(두 방장 소켓/연타) | Tampering | DO 단일 스레드 + `extendUsed` 를 상태에서 확인 후 갱신 |

## Project Constraints (from CLAUDE.md)

- 게임 규칙·판정은 서버(방 Durable Object)가 정한다. 클라이언트는 받은 상태를 보여 주고 행동만 보낸다(결정 0002).
- 다른 사람의 역할은 서버가 클라이언트로 보내지 않는다. 화면에서 숨기는 것으로 대신하지 않는다. (이 페이즈에는 "마감 전 다른 사람의 직업 선택"에도 같은 원칙이 적용된다 — D-01)
- 기획·계획은 참여 플레이어의 몰입이 기준이다. 각 페이즈는 자기 구간의 이펙트·액션을 기본형으로 함께 만든다(결정 0006) → 공개 연출·말풍선·이모티콘·완료 알약이 이 페이즈 범위다.
- 새 결정은 `docs/decisions/` 에 다음 번호(0016)로 파일을 추가한다. 계획 중 확정할 결정 후보: `claimReveal` 서버 단계 분리, `tick` 진입 훅 표, 하루 걸러 말 바꿈 규칙(A3).
- 작업을 마칠 때마다 `HANDOFF.md` 를 갱신하고 push 한다.
- GSD 산출물(`.planning/`)과 응답은 한국어. 코드·명령·파일 이름·요구사항 ID 는 원문.
- 작은 MVP: 요구사항 밖 기능 추가 금지(주장 이력 시트 등은 보류 — CONTEXT 의 Deferred).
- 이른 배포: 이후 페이즈 검증은 배포본으로 한다 → `scripts/smoke.mjs` 갱신이 계획에 들어가야 한다(§Pitfall 9).
- 화면이 있는 페이즈는 `/gsd-ui-phase` 가 먼저(완료, 02-UI-SPEC.md approved). 디자인 참고 자료 규칙(design-refs): 승인본 사본은 `design/` 에 있다. GSD 에이전트는 아티팩트를 열 수 없다.
- 코드 스타일(관찰): 주석은 한국어로 규칙·결정 번호(D-xx, R-xx)를 남긴다. `shared/` 는 DOM·workerd 전용 API 금지(두 tsconfig 에 모두 들어감). `shared/protocol.ts` 는 값 import(zod 등) 금지. 서버 전용 스키마는 `shared/schemas.ts`(Worker 만 import). 뷰는 허용 목록 리터럴로만 만든다(`Player` 를 펼쳐 복사 금지). 값·색은 `tokens.css` 변수로만, 새 패키지 설치 없음.

## Sources

### Primary (HIGH confidence — 이번 세션에 직접 읽은 저장소 파일)
- `/Users/dhkim1522/personal/minifia/shared/protocol.ts`, `shared/schemas.ts`, `shared/game/{phases,tick,room,view,roles}.ts`, `shared/seatLayout.ts` — 단계 표·tick·상태·뷰·구성표
- `/Users/dhkim1522/personal/minifia/worker/room.ts` — DO 핸들러·알람·방송·속도 제한
- `/Users/dhkim1522/personal/minifia/src/screens/{RoomScreen,Day,RoleReveal,Lobby}.tsx`, `src/components/{Table,Figure,PhaseBar,Timer,Sheet,Toast,Icon}.tsx`, `src/net/{useRoomConnection,countdown,clock,roomDiff,useSeatTransitions}.ts`, `src/game/roleText.ts`, `src/styles/phase.css` — 재사용 부품과 확장 지점
- `/Users/dhkim1522/personal/minifia/test/**`(`tick`·`view`·`alarm`·`leak`·`helpers`), `vitest.config.ts`, `tsconfig.*.json`, `scripts/smoke.mjs` — 영향받는 테스트와 인프라
- `.planning/{config.json,STATE.md,REQUIREMENTS.md,ROADMAP.md}`, `.planning/phases/02-day-discussion/{02-CONTEXT.md,02-UI-SPEC.md}`, `docs/decisions/{0006,0007,0015}.md`, `docs/architecture.md`, `HANDOFF.md`
- `/Users/dhkim1522/personal/minifia/node_modules/zod/v4/classic/schemas.d.ts` — `strictObject`, `discriminatedUnion` 선언
- 이번 세션 `npx vitest run` 결과(42 files · 675 tests passed), `node --version`(v26.0.0), `npx wrangler --version`(4.151.3)

### Secondary (MEDIUM confidence)
- 없음 (외부 문서 조회가 필요한 새 기술이 없었다)

### Tertiary (LOW confidence)
- Durable Object 하이버네이션 시간·SQLite 저장 쓰기 비용에 대한 일반 지식(A5, A6 — `[ASSUMED]`, 결론이 이 가정에 의존하지 않도록 설계)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 새 패키지 없음, 버전은 `package.json` 고정값을 직접 확인
- Architecture: HIGH — `tick`/`view`/`room.ts`/`RoomScreen` 의 현재 구조를 코드로 직접 확인했고 변경 지점이 좁다. `claimReveal` 분리·훅 표는 설계 판단(MEDIUM 가까운 HIGH)
- Pitfalls: HIGH — 기존 테스트 불변식(Pitfall 2, 8)과 `parseServerMessage`(Pitfall 6)는 코드·테스트에서 직접 확인. 쿨다운 지터(Pitfall 5)는 추론이라 MEDIUM

**Research date:** 2026-10-24
**Valid until:** 2026-11-23 (저장소 내부 구조 기반이라 안정적. 3페이즈 착수 전에 `tick` 훅 표를 3페이즈가 확장하는지 다시 확인)
