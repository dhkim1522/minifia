# 0027 직업 주장 차례는 claim 단계 안의 서버 상태로 돌고, 와이어는 day.turn·day.claimLog 와 역할별 me.records 로 바뀐다

- 상태: 채택
- 날짜: 2026-10-25

## 배경

- 결정 0023(직업 주장은 한 명씩 차례로)과 0026(역할 카드의 역할별 일지)은 서버 와이어 계약 변경을 "구현 계획의 기록으로" 미뤘다. 이 문서가 결정 0020(밤·아침 계약)과 같은 방식으로 그 변경을 한 곳에 적는다.
- 03.1-01 이 순수 규칙(`shared/game/claim.ts`·`tick.ts` 의 `ON_DEADLINE`·`view.ts`)을, 03.1-02 가 방 Durable Object·알람·서버 봇 배선을 만들었다. 일지 와이어(11번)는 03.1-04 가 구현하고 여기에 미리 적는다.
- 누출 검사 `test/unit/view.test.ts`(4~8명 × 시드 전수)와 `test/worker/leak.test.ts`(6명 한 판의 모든 실제 프레임)가 이 계약을 지킨다.

## 결정

1. **단계**: `claim` 은 차례 하나가 한 단계 마감이다. `phaseEndsAt` 은 지금 차례의 마감이고 `phaseDurationMs` 는 8000(`CLAIM_TURN_MS`, `shared/game/phases.ts`)이다. `tick` 의 `ON_DEADLINE` 표(`claim` → `resolveClaimTurn`)가 남은 차례가 있으면 같은 단계에 머물게 하고 마감을 "이전 마감 + 8000" 으로 옮긴다(알람이 늦어도 모든 폰이 같은 마감을 받는다). 마지막 차례 뒤에는 곧바로 `discussion` 이다.
2. **공개 연출 단계는 삭제한다**(D-07). `PhaseId` 에서 `claimReveal` 이 빠진다. 그 단계로 저장된 방은 `normalizeStoredRoom` 이 `discussion`(마감 now + 90초)으로, 차례 상태가 없는 옛 `claim` 방은 `enterClaim` 으로 만든 첫 차례(마감 now + 8초)로 옮기고 옛 Player 주장 필드 넷(`claimChoice`·`claimShown`·`claimLast`·`claimChanged`)을 지운다. 배포 직후 열린 방의 옛 번들은 새 규칙을 모른다 — 수용한다(열린 방은 최대 3시간).
3. **차례 순서와 시작 자리**: 살아 있는 seat 오름차순(끝에서 처음으로 이어짐)을 시작 seat 부터 한 바퀴. 1일차 시작은 방장(탈락했으면 첫 생존 seat)이고, 이후 낮마다 직전 시작 자리(`claimStart`) 다음의 살아 있는 seat 로 한 칸 옮긴다. 서버 상태 `claimOrder`·`claimIdx`·`claimStart`·`claimPick`·`claimLog` 는 서버 전용이고 view 에 그대로 실리지 않는다(view 는 3·6번의 파생 값만 가진다).
4. **메시지 `{ t: "claim", claim }` 는 지금 차례인 사람만** 보낼 수 있다. 검사 순서가 계약이다: 단계(`claim` 아님 → `WRONG_PHASE`) → 방에 있는 사람·생존(없거나 탈락 → `BAD_MESSAGE`) → 차례(지금 차례가 아니거나 이미 골랐음 → `WRONG_PHASE`) → 값(이번 판 직업·`none` 이 아님 → `BAD_MESSAGE`). 거부는 보낸 소켓에만 `error` 와 최신 `state` 다. 통과하면 방 Durable Object 가 `selectClaim`(선택을 적고 마감을 now 로 당김) 위에서 곧바로 `tick` 을 불러 정상 마감과 같은 경로로 다음 차례(마지막이면 낮 토론)로 넘기고, 모든 소켓에 state 를 방송한 뒤 알람과 봇 계획을 새 마감으로 옮긴다(`reschedule`). 결정 0020 의 `pick` 은 마감이 불변이지만 `claim` 은 차례가 끝나므로 마감이 바뀐다 — 일찍 고르면 다음 차례가 그 시점부터 8초를 받는다.
5. **시간 초과·끊긴 사람의 차례는 `none`** 이고 어제 주장을 이어받지 않는다(옛 `claimLast` 폐기, D-02). 연결 여부는 보지 않는다. 탈락자는 차례 순서에 없고 기록 줄도 없다.
6. **view 필드**: 새 키 `day.turn { seat }`(`claim` 단계에서만)와 `day.claimLog [{ n, seat, claim }]`(낮 단계마다 항상, 일차 오름차순 + 같은 일차는 차례 순서). 삭제된 키는 `day.claims`·`day.claimDone`·`me.claim`·`SeatClaim.changed` 다. 끝나지 않은 차례의 선택(`claimPick`)은 어떤 키로도 나가지 않는다. 허용 경로의 직업 문자열은 `me.role`·`day.roles[]`·`day.claimLog[].claim`(관전자는 `spectate.seats[].job` 추가)뿐이다.
7. **주장 채팅 줄**: 서버는 주장에 대해 `chat` 프레임을 보내지 않는다. 화면이 `day.claimLog`(그날 줄)에서 "저는 경찰이에요" 같은 줄을 만든다 — 재접속해도 그날 주장 줄이 복원되고 순서가 상태 프레임과 어긋나지 않는다. 표시용 `TEMPLATE_IDS` 값 `claimRole`·`claimNone` 은 03.1-07 이 더하며 서버는 `say` 로 받지 않는다(`BAD_MESSAGE`). 문장표는 화면(`src/game/roleText.ts`)이 쥔다.
8. **claim 중 이모티콘은 보낼 수 있고**(살아 있는 사람 누구나, 차례와 무관, 모든 소켓에 방송) **빠른 메시지(`say`)는 거부한다**(`WRONG_PHASE`). 이모티콘은 빠른 메시지와 같은 보낸 시각 쿨다운(`lastSendAt`)을 공유한다.
9. **테스트 방**(결정 0022): `claim` 중 `testSkip` 은 한 번에 한 차례씩 넘어간다(지금 차례가 `none` 으로 기록됨). 단계 단위가 아니라 차례 단위다 — 테스터가 차례를 하나씩 눈으로 확인하고, 단계를 한 번에 넘기면 남은 사람의 주장이 모두 `none` 으로 지워져 기록이 의미를 잃기 때문이다. 8명 판은 낮 토론까지 여덟 번 누른다(E2E 도우미가 반복한다). 대기실 복귀(`testReset`)는 허용 목록 리터럴로 방을 다시 만들므로 `claimOrder`·`claimIdx`·`claimStart`·`claimPick`·`claimLog` 가 자동으로 지워진다.
10. **서버 봇**(결정 0024): `botClaimChoice` 는 `claim` 단계가 아니거나 탈락했거나 지금 차례(`currentClaimSeat`)가 그 봇이 아니면 난수를 부르지 않고 `null` 이다. 차례인 봇의 난수 호출 순서(`randInt(100)` → `randInt(직업 수)` → `randInt(3000)`)와 상수는 그대로다. `botPlanKey` 는 `claim:{phaseEndsAt}:{claimIdx}` 이다 — 차례마다 계획이 새로 서고, 마감이 우연히 같아져도(테스트 넘기기 연타) 낡은 계획이 살아남지 않는다. 봇의 주장은 사람과 같은 본체(`applyClaim`)를 지난다.
11. **일지 와이어**(결정 0026-7, 구현 03.1-04): `me.records` 는 역할별 배열이다 — 경찰 `{ n, target, isMafia }`, 마피아 `{ n, target, died }`(마피아 전원이 같은 팀 기록을 본다. 의사가 살려도 `died: false`), 의사 `{ n, target }`(보호 대상만, 구출 여부 없음). 본인에게만, 역할을 싣는 모든 단계에서, 탈락한 뒤에도 보인다. 직업 이름 문자열은 어떤 줄에도 없다(불리언·숫자만).

## 결과

- **되돌리기 비용**
  - `PhaseId` 에서 `claimReveal` 삭제, `day.turn`·`day.claimLog` 이름과 모양, `me.records` 형태는 **비싸다**(costly) — 서버·화면·테스트를 한 배포에서 함께 고쳐야 하고, 열린 방은 최대 3시간 옛 번들을 쓴다. 옛 이름은 `normalizeStoredRoom` 한 곳에만 남는다.
  - 차례 길이 8초(`CLAIM_TURN_MS`)와 시작 자리 규칙(`enterClaim`)은 `phases.ts`·`claim.ts` 한 곳을 고치면 되는 **쉬운 변경**(reversible)이다. 방 Durable Object 가 `claim` 을 전원에게 방송하는 방식도 한 메서드(`applyClaim`) 안의 선택이라 쉽게 바꿀 수 있다.
- 누출 테스트가 이 계약을 지킨다: `test/unit/view.test.ts`(4~8명 × 시드 전수, 끝나지 않은 차례의 선택 부재), `test/worker/leak.test.ts`(6명 한 판의 모든 프레임에서 `claimPick`·`claimOrder`·`claimIdx`·`claimStart` 키 부재, `day.turn` 은 `claim` 단계 state 에만, `claimLog` 줄의 키는 `n`·`seat`·`claim` 뿐), `test/worker/day.test.ts`·`alarm.test.ts`·`testTools.test.ts`·`bots.test.ts`(소켓·알람 단위 차례 흐름).
- 결정 0023 의 "와이어 계약 변경 — 구현 계획에서 기록" 문장과 결정 0024 결과의 "봇 주장은 `botClaimChoice` 한 함수" 문장이 이 문서로 닫혔다. 결정 0016 결과 문단은 건드리지 않는다.
- 결정 0020 의 `day.claims`(낮 토론에 이어 밤·아침에도 싣는다)는 6번의 `day.claimLog` 로 대체되고, `me.records` 의 경찰 전용 형태는 11번으로 넓어진다.
