# Phase 3: 밤과 아침 - Context

**Gathered:** 2026-10-24
**Status:** Ready for planning

<domain>
## Phase Boundary

낮 토론 다음 밤 30초 동안 마피아·경찰·의사가 행동을 고르고(시민은 안내만), 모두가 일찍 골라도 밤은 30초가 다 지나야 끝난다. 이어지는 아침 5초에 지난밤 결과(탈락자 또는 "아무 일도 없었습니다")가 모든 화면에 발표되고, 탈락한 사람은 "탈락" 화면과 공개된 진행만 본다. 4페이즈가 생기기 전까지는 낮 토론 다음 바로 밤, 아침 다음 다시 낮(직업 공개)으로 돌린다(ROADMAP Notes).

</domain>

<decisions>
## Implementation Decisions

### 밤 화면
- **D-01:** 행동 대상은 낮과 같은 **고정 테이블에서 캐릭터를 직접 탭**해 고른다. 2페이즈의 `DayTable`(좌석 좌표·이름표·이모티콘)을 재사용한다(결정 0017, `design/screens/day-v3/SPEC.md`). 목록 방식은 쓰지 않는다.
- **D-02:** 선택 가능한 대상은 **자신을 포함한 모든 생존자**다. 마피아가 자신이나 동료를 지목하면 서버가 그 지목을 무효 처리한다. 의사는 자신을 고를 수 있다(NIGHT-03).
- **D-03:** **마피아에게는 밤에도 동료 표시를 유지한다**(낮의 `allies` 표시 그대로).
- **D-04:** **시민은 밤에 지목 화면 없이 안내 문구만 본다**(의심 표시 없음).
- **D-05 (결정 0018):** 온라인(비대면)을 기준으로 만들되 오프라인에서도 할 수 있는 형태를 목표로 한다. 옆에서 훔쳐보기·캡처 공유 같은 문제는 정책으로 막지 않고 **플레이어 매너**에 맡긴다. 그래서 NIGHT-04·ROADMAP 성공 기준 1은 "밤 화면이 역할별로 달라도 된다"로 정정했다. 서버는 여전히 다른 사람의 역할을 클라이언트로 보내지 않는다(결정 0002) — 마피아 동료 seat 만 마피아에게 간다. 드러날 수밖에 없는 요소가 생기면 나중에 설정(소리 끄기, 화면 가리기 등)으로 확장한다.

### 행동 확정·바꾸기
- **D-06:** 행동은 **마감 전까지 자유롭게 바꿀 수 있다**. 마감 순간의 선택이 적용된다. 일찍 골라도 밤은 30초가 다 지나야 끝난다(NIGHT-05).
- **D-07:** 마피아끼리는 **동료가 현재 고른 대상이 마피아 화면에 보인다**(실시간 합의). 시간이 끝나면 표가 많은 쪽, 같으면 무작위(NIGHT-01).
- **D-08:** 아무도 고르지 않으면 **행동 없음**으로 처리한다(마피아 전원이 지목 없음 → 아침에 "아무 일도 없었습니다").

### 경찰 결과
- **D-09:** 조사 결과는 **밤이 끝날 때(아침 직전)** 경찰 본인에게만 보인다. 고르자마자 보이지 않는다.
- **D-10:** 결과 표시는 **밤 화면 끝에 팝업**으로 한다(경찰 화면에만). 아침 발표 화면 자체는 모두 같다.
- **D-11:** 지난 날의 조사 결과는 **[내 역할] 시트에 누적**되어 낮 토론 중 다시 볼 수 있다. 결과 기록은 폰 메모리 또는 서버가 본인에게만 보내는 값으로 하며 다른 사람에게는 가지 않는다(결정 0002).

### 아침 발표·탈락
- **D-12:** 아침 5초 화면은 **낮과 같은 테이블 위에 탈락자를 강조**한다(캐릭터 쓰러짐/흐림 + 이름 문구). 아무도 탈락하지 않으면 살아 있는 사람 전원이 보이는 테이블에 "아무 일도 없었습니다".
- **D-13:** 의사가 지켜서 살아난 경우도 **"아무 일도 없었습니다"** 로만 발표한다(의사 존재·구출을 공개하지 않음).
- **D-14:** 탈락한 사람은 **같은 테이블 + "탈락" 표시 띠**를 본다. 메시지는 읽기만 가능하고 남의 역할은 게임이 끝날 때까지 받지 않는다(ELIM-01).
- **D-15:** 탈락자는 테이블에서 **흐림 + 이름표 회색**으로 표시한다. 연결 끊김의 흐림과 구분되도록 탈락은 회색 이름표 표시를 더한다. 탈락자의 직업은 공개하지 않는다(ROADMAP Notes).

### 작업 방식
- **D-16:** 화면이 걸린 부분(밤 화면, 경찰 팝업, 아침 발표, 탈락 화면)은 **코드 전에 Design 캔버스 시안을 먼저 만들고 승인**받는다. 좌석·이름표 겹침은 좌표로 검사한다(사용자 요청, 메모리 `feedback-mockup-before-code`).

### Claude's Discretion
- 밤 전용 연출의 세부(배경 톤, 전환 애니메이션 길이)는 5페이즈 "분위기와 캐릭터"가 다듬으므로 3페이즈에서는 어두운 배경 + 기존 테이블 수준으로 최소화.
- 서버 단계 표(`PHASE_DEFS`)와 `ON_ENTER` 진입 훅 표에 `night`·`morning` 행을 더하는 구조는 결정 0016을 따른다.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### 요구사항·규칙
- `.planning/ROADMAP.md` §Phase 3 — 목표·성공 기준 1~4·Notes (D-05 로 성공 기준 1 정정)
- `.planning/REQUIREMENTS.md` — NIGHT-01~06, ELIM-01 (NIGHT-04 정정 필요)
- `docs/product.md` — 역할표, 밤 화면, 탈락자 규칙

### 결정
- `docs/decisions/0002-cloudflare-durable-objects.md` — 서버가 규칙을 정하고 남의 역할은 클라이언트로 보내지 않는다
- `docs/decisions/0016-day-loop-structure.md` — 단계 표(`PHASE_DEFS`)·진입 훅(`ON_ENTER`)·하루 걸러 말 바꿈 규칙 (3페이즈가 `discussion.next` 를 밤으로 바꾼다)
- `docs/decisions/0017-day-table-redesign.md` — 고정 테이블, 이모티콘만 말풍선, 채팅 세 줄, 닉네임 5자
- `docs/decisions/0006-player-immersion.md` — 각 페이즈 구간의 이펙트·액션을 기본형으로 함께 만든다

### 디자인
- `design/screens/day-v3/SPEC.md` — 고정 테이블·2줄 이름표·하단 패널 157 승인 명세 (밤·아침 화면은 이 명세 위에서 시안 작성)
- `design/tokens.json`, `design/design-system/` — 토큰·부품 참고

### 이전 페이즈
- `.planning/phases/02-day-discussion/02-CONTEXT.md` — 낮 루프 결정(D-xx)
- `.planning/phases/02-day-discussion/02-18-SUMMARY.md` — 2페이즈 마무리 상태

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/components/DayTable.tsx`, `src/game/dayTable.ts`: 고정 테이블 배치와 2줄 이름표 — 밤·아침 테이블에 재사용(아랫줄 내용만 단계별로 바뀜).
- `shared/game/phases.ts`(`PHASE_DEFS`), `shared/game/tick.ts`(`ON_ENTER`): 단계 표와 진입 훅 — 밤·아침 행 추가.
- `src/components/MyRoleSheet.tsx`: [내 역할] 시트 — 경찰 조사 결과 누적 표시 위치(D-11).
- `src/screens/DayScene.tsx`: 낮 세 단계 장면 틀 — 밤·아침 장면의 모델.
- `worker/room.ts`: 방 Durable Object — 밤 행동 메시지 처리와 알람.

### Established Patterns
- 서버가 규칙·판정을 하고 클라이언트는 view 를 그리고 행동만 보낸다. 역할·주장 문자열은 허용된 경로(`view.me.*`)에만 있다(누출 테스트 `leak.test.ts` 확장 필요).
- TDD: 정의된 입출력 로직은 RED 커밋 먼저.
- 시안 먼저(Design 캔버스), 겹침은 좌표 검사 스크립트로 확인.

### Integration Points
- `discussion.next`(임시 루프)를 밤으로 바꾸고, 아침 다음은 다시 `dayAnnounce` 로 돌린다.
- 새 클라이언트 메시지: 밤 행동(지목/조사/보호), 마피아 합의용 현재 선택 방송(마피아에게만).
- 탈락 처리: `isAlive` 를 쓰는 곳(`selectClaim`·`say`·`emote` 거부 코드는 지금 `BAD_MESSAGE`, 3페이즈가 확정 — 결정 0016).

</code_context>

<specifics>
## Specific Ideas

- 사용자는 이전에 "직업이 확실히 노출될 때, 거짓말이 들통날 때" 연출에 관심을 보였다. 3페이즈에서는 경찰 조사 결과 팝업(D-10)이 그 첫 순간이다. 처형 시 직업 공개 여부는 4페이즈에서 정한다.
- 시안 확인 시 사용자가 "디자인이 계속 이상해진다"고 피드백한 적이 있으므로 기존 승인 화면(낮 테이블)을 바꾸지 않고 얹는다.

</specifics>

<deferred>
## Deferred Ideas

- 처형·사망 시 직업 공개 여부, 같은 직업 중복 주장 표시(충돌 표시) — 4페이즈(처형과 승패)에서 결정.
- 밤 배경음·효과음·강한 분위기 연출 — 5페이즈(분위기와 캐릭터).
- 두 기종(iPhone Safari·Android Chrome) 실기기 확인 — 6페이즈 플레이테스트.
- 방장이 직업 구성을 조정하는 기능(v2 ROLEX-01).

</deferred>

---

*Phase: 03-night-morning*
*Context gathered: 2026-10-24*
