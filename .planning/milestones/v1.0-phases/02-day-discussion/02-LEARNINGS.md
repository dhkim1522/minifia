---
phase: 2
phase_name: "낮 토론"
project: "minifia"
generated: "2026-10-30"
counts:
  decisions: 7
  lessons: 6
  patterns: 6
  surprises: 5
missing_artifacts: []
---

# Phase 2 Learnings: 낮 토론

## Decisions

### claimReveal 을 2초짜리 별도 서버 단계로 분리
직업 공개 마감(claim)과 공개 연출(claimReveal)을 서버 단계 둘로 나눴다.

**Rationale:** 모든 폰이 같은 마감 시각으로 연출을 시작·종료하게 하려는 것이다. 되돌리기 어려운 결정(reversibility costly)으로 표시했다.
**Source:** 02-01-SUMMARY.md

---

### ON_ENTER 훅은 tick 루프 안에서만 호출
단계 진입 훅(`ON_ENTER` 표)은 `tick(state, now, randInt)` 루프 안에서만 실행하고, 알람 핸들러나 DO 가 직접 부르지 않는다. 시각은 인자로만 받는다(`shared/` 에 `Date.now` 0건).

**Rationale:** 알람이 늦어도 "이전 마감 + 길이" 연쇄로 마감이 밀리지 않고, 따라잡는 동안 훅이 정확히 한 번씩 돈다. 클라이언트 입력에는 단계·마감에 대한 권위가 없다.
**Source:** 02-01-SUMMARY.md, 02-VERIFICATION.md, 02-SECURITY.md (T-02-01)

---

### 2일차부터 미선택이면 어제 주장을 유지 (ROADMAP 문구를 구현에 맞춤)
시간이 넘어도 "말 안 함" 이 되지 않고 어제 주장이 이어진다(CONTEXT D-09, 결정 0015). 사용자가 이 동작을 채택해 ROADMAP SC1, REQUIREMENTS DAY-02·CONN-02 문구를 고쳤다.

**Rationale:** 승인된 설계와 ROADMAP 문자 그대로가 어긋났을 때 어느 쪽이 원천인지는 사람이 정한다. 코드를 바꾸지 않고 문서를 맞췄다.
**Source:** 02-UAT.md (테스트 8), 02-VERIFICATION.md

---

### 낮 화면을 고정 테이블에 둘러앉는 구조로 재설계 (결정 0017)
9차례 시안 비교 끝에 둘러앉은 테이블을 유지하되 좌표 계산을 바꿨다. 테이블 280×108, rx132·ry100, 캐릭터 72를 인원과 상관없이 하나로 고정하고, 좌석·이름표·이모티콘을 같은 장면 픽셀 좌표에서 계산한다(clamp 제거). 글자는 14px 아래로 줄이지 않는다.

**Rationale:** 원인은 글자(14px 고정)와 캐릭터(scale .62~1)가 따로 움직이고, 떠 있는 층을 `clamp(70px, x%, 100%-70px)` 로 가둔 것이었다. 실제 방은 4~5명이 대부분이라 옆자리 이름표가 조금 겹치는 것은 받아들였다.
**Source:** 02-UAT.md (G-02-1), docs/decisions/0017-day-table-redesign.md, 02-14-SUMMARY.md

---

### 빠른 메시지는 저장하지 않고 chat 이벤트로만 방송, 방장 연장·넘기기 제거
서버는 `messages` 를 보관하지 않고 통과한 메시지를 방송만 한다. 채팅 내역은 폰 메모리에만 있다. `extend`·`skip` 은 스키마에서 빠져 `BAD_MESSAGE` 가 되고, 별도 오류 코드·핸들러는 두지 않는다. 닉네임 최대는 8자에서 5자로 줄였다.

**Rationale:** 방장만 다른 줄이 있으면 하단 영역을 정돈할 수 없고, 직업 이름을 말줄임하지 않으려면 닉네임이 짧아야 한다. 저장 제거로 DoS·누출 표면도 줄었다.
**Source:** docs/decisions/0017-day-table-redesign.md, 02-12-SUMMARY.md, 02-13-SUMMARY.md, 02-15-SUMMARY.md

---

### 서버 쿨다운 1800ms, 클라이언트 잠금 2000ms
서버 한도를 클라이언트 잠금보다 짧게 두었다(`SERVER_MIN_SEND_GAP_MS` 1800, `SEND_COOLDOWN_MS` 2000).

**Rationale:** 두 값이 같으면 네트워크 지터로 뒤 요청이 먼저 도착해 정상 메시지가 `RATE_LIMITED` 로 표시 없이 사라진다(G-02-2). 쿨다운은 플레이어 단위 `lastSendAt` 으로만 판정해 재접속으로 풀리지 않게 했다.
**Source:** 02-UAT.md (G-02-2, 테스트 6), 02-12-SUMMARY.md, 02-05-SUMMARY.md

---

### 낮 화면 전용 DayTable 부품을 새로 만들고 공용 Table 은 건드리지 않음
대기실·배정이 쓰는 공용 `Table` 은 그대로 두고 낮 전용 부품(`mf-dt__*`)을 새로 만들었다. 하단 패널은 세 단계 모두 `calc(157px + 안전 영역)` 고정 높이로 해 단계가 바뀌어도 테이블이 움직이지 않는다.

**Rationale:** 1페이즈 승인 화면을 보호하고, 최소 높이가 아니라 고정 높이여야 단계마다 레이아웃이 같다.
**Source:** 02-14-SUMMARY.md, 02-17-SUMMARY.md, 02-16-SUMMARY.md

---

## Lessons

### 웹 디자인 가시성은 jsdom·스모크로는 못 잡고 실기기에서 드러난다
자동 검증 6/6 이 통과했지만 8명 방 360px 폰에서 가시성이 떨어지고 알약이 자리에서 어긋난다는 실기기 피드백이 나왔다. 검증 보고서도 이미 레이아웃·애니메이션을 사람 확인 항목으로 올려 두었다(status `human_needed`).

**Context:** 레이아웃 계획 단계에서 좌표·폰트·clamp 가 서로 어긋나는 문제는 단위 테스트에 없었다. 실제 조작 전에 사람이 보는 확인을 일정에 넣어야 한다.
**Source:** 02-UAT.md (G-02-1), 02-VERIFICATION.md

---

### 클라이언트 잠금과 서버 한도를 같은 값으로 두면 경계에서 메시지가 말없이 사라진다
2000ms 간격 전송의 약 19~25%(5명판 3/16, 8명판 7/28)가 `RATE_LIMITED` 였고, 클라이언트는 이를 표시 없이 다시 잠갔다. 코드 리뷰(WR-02)가 위험을 짚었고 봇 시나리오가 재현했다.

**Context:** 경계 동작은 네트워크 지터에 걸려 실제 환경에서만 재현된다. 봇 시나리오(`scripts/uat-day.mjs --prod`)가 회귀 확인 도구가 됐다. 수정 뒤 오탐은 0/16, 0/28 이었다.
**Source:** 02-UAT.md (테스트 6), 02-REVIEW.md (WR-02)

---

### 클라이언트 검증 스키마의 직업 enum 이 ROLE_IDS 의 복사본이라 직업이 늘면 조용히 깨진다
`z.enum([...])` 가 `ROLE_IDS` 와 따로 하드코딩돼 있어 `satisfies` 로는 부분집합 어긋남을 못 잡는다. 새 직업이 늘면 서버가 `BAD_MESSAGE` 로 모두 거부하고 기존 4직업 테스트는 통과한다. `target` 상한도 `MAX_PLAYERS` 와 따로 있다.

**Context:** 리뷰 제안은 `ROLE_IDS` 를 `as const` 튜플로 만들어 스키마가 그대로 쓰게 하는 것이다.
**Source:** 02-REVIEW.md (WR-01)

---

### 서버 프레임 값을 검증 없이 룩업 테이블에 넣으면 모르는 ID 하나가 화면 전체를 무너뜨린다
모르는 이모티콘·직업 ID 하나가 렌더 예외로 번질 수 있었다. 02-16 이 `claimedRole` 을 `ROLE_IDS` 안의 값만 복사하도록 값 검증을 더했다.

**Context:** 서버가 신뢰 경계라 해도 클라이언트는 허용 키·값만 필드별로 복사해야 한다.
**Source:** 02-REVIEW.md (WR-04), 02-16-SUMMARY.md

---

### 직업 이름처럼 게임에 영향이 있는 글자는 말줄임하면 안 된다
메시지 로그가 한 줄 말줄임이라 닉네임이 길면 "[닉네임]은 마피아였어요" 의 직업 부분이 잘린다(WR-05). 해결은 CSS 가 아니라 닉네임 길이 제한(5자)이었다.

**Context:** 직업 주장이 안 보이면 "앱만으로 토론이 성립한다" 가 깨진다. 글자를 줄이지 않는다는 결정 0017-1 이 레이아웃 겹침 허용보다 우선했다.
**Source:** 02-REVIEW.md (WR-05), docs/decisions/0017-day-table-redesign.md, 02-14-SUMMARY.md

---

### 계획에 쓴 수치와 마감 산술은 실행 시점에 틀릴 수 있다
계획 behavior 의 마감 값(예: `roleReveal(19000)` 에서 `38000+2000`)이 실제 단계 마감과 맞지 않아 RED 작성 중 now 값을 고쳐 의도(훅이 정확히 한 번씩 돔)를 지켰다. 02-06 에도 괄호 설명과 기대 문장이 어긋난 계획 오기재가 있었다.

**Context:** 의도를 먼저 지키고 값을 맞추면 되지만, 단계 길이를 상수 한 곳(`phases.ts`)에서 가져오는 구조가 이런 불일치를 줄인다.
**Source:** 02-01-SUMMARY.md, 02-06-SUMMARY.md

---

## Patterns

### TDD RED 에는 뼈대 모듈을 함께 커밋한다
신규 모듈이 없으면 테스트 import 가 로드 실패가 되어 `INVALID_RED(fixture_or_load_failure)` 가 된다. 상태를 그대로 돌려주는 뼈대를 RED 커밋에 두고 GREEN 에서 구현으로 교체한다. test 커밋은 feat 보다 먼저 둔다.

**When to use:** 새 순수 모듈을 TDD 로 만들 때.
**Source:** 02-02-SUMMARY.md, 02-03-SUMMARY.md

---

### 실패 보고가 TAP 이 되도록 단언을 한 줄 스칼라로 쓴다
객체 `toEqual`, DOM 노드 `toBeNull`, CSS `toMatch` 는 실패 때 여러 줄 출력을 쏟아 `tdd-red-evidence` 가 `Non-TAP data in report` 로 거부한다. 한 줄 문자열 비교, `expect(정규식.test(css)).toBe(true)`, 개수 단언으로 바꾼다. 의미는 같다.

**When to use:** GSD TDD RED 증거 검증을 쓰는 모든 테스트. 여러 계획(02-02, 02-04, 02-14~02-17)에서 반복됐다.
**Source:** 02-02-SUMMARY.md, 02-04-SUMMARY.md, 02-14-SUMMARY.md, 02-15-SUMMARY.md, 02-17-SUMMARY.md

---

### 뷰는 허용 목록 리터럴로만 만들고 전수 누출 검사를 건다
`buildView` 가 허용 키를 리터럴로 만들고 `claimChoice`·`claimLast`·`lastSendAt` 은 어떤 뷰에도 싣지 않는다. 판정 모듈(`claim.ts`·`discussion.ts`·`chat.ts`)은 `.role` 을 읽지 않는다. `view.test.ts` 는 4~8명 × 전 단계 × 전원 × 시드로 전수 검사하고, 스모크는 경로 기반으로 배포본 프레임을 검사한다.

**When to use:** 단계마다 공개 범위가 다른 서버 권위 게임의 모든 뷰·프레임.
**Source:** 02-04-SUMMARY.md, 02-REVIEW.md, 02-11-SUMMARY.md, 02-SECURITY.md

---

### 단계 전환은 배포본 WebSocket 스모크와 봇 시나리오로 확인한다
`scripts/smoke.mjs --prod --stage full` 이 낮 한 바퀴를 5명·4명(이후 8명)으로 돌며 `--previous-version` 비교로 재배포를 확인한다. 봇 시나리오가 기기 간 단계 전환 차이(0~23ms)를 측정한다. 선형 단계 순서는 허용 전이 표(`PHASE_NEXT`)로 바꿨다.

**When to use:** 루프가 있는 단계 흐름을 배포본에서 검증할 때. 마지막 프레임에 기대지 않는다.
**Source:** 02-11-SUMMARY.md, 02-18-SUMMARY.md, 02-UAT.md

---

### 낙관적 선택은 다음 서버 state 에서 버리고 거절 응답은 종류별로 나눈다
클라이언트는 낙관적 선택을 새 view 가 오면 버린다. `WRONG_PHASE` 인 say 만 state 를 다시 보내고 `RATE_LIMITED`·`BAD_MESSAGE` 는 error 만 보낸다. 거절 케이스는 error 를 읽은 뒤 ping 왕복과 짧은 대기(settle)로 다른 소켓에 아무것도 가지 않았음을 확인한다. 보낸 사람은 소켓 첨부 `playerId` 로만 정하고 와이어에 보낸 사람 필드를 두지 않는다.

**When to use:** 서버 권위 Durable Object 에서 클라이언트 입력을 처리할 때.
**Source:** 02-05-SUMMARY.md, 02-08-SUMMARY.md, 02-SECURITY.md

---

### 서버 문장을 만들지 않고 템플릿 ID 로 클라이언트가 문장을 만든다
`say` 는 `strictObject` + 템플릿 ID/seat/직업 enum 만 받는다. 서버는 문장을 만들지 않고 클라이언트(`messageText`)가 템플릿으로 만들어 React 텍스트로만 그린다. 로그 이름 요소는 `span` 으로 두어 닉네임의 HTML 이 요소로 해석되지 않음을 테스트로 고정했다.

**When to use:** 자유 텍스트를 받지 않는 정해진 채팅·이모티콘 기능.
**Source:** 02-06-SUMMARY.md, 02-09-SUMMARY.md, 02-SECURITY.md (T-02-07)

---

## Surprises

### 승인 설계와 ROADMAP 문구가 어긋나 있었다
구현은 D-09 대로 어제 주장을 이어 가는데 ROADMAP SC1 은 "시간이 넘으면 말 안 함" 이라고 적혀 있었다.

**Impact:** 검증이 `human_needed` 로 남았고, 사용자 결정으로 문서를 구현에 맞췄다.
**Source:** 02-VERIFICATION.md, 02-UAT.md (테스트 8)

---

### 8명 방 UAT 한 번으로 낮 화면 구조가 통째로 바뀌었다
테스트 1 한 건이 갭 닫기 계획 02-12~02-18(7개)과 결정 0017 을 만들었다. 말풍선, 방장 줄, 8자 닉네임을 대상으로 한 UAT 테스트 4건(2~5)이 대상 자체가 없어져 skipped 가 됐고, 닉네임 최대와 서버 스키마까지 바뀌었다.

**Impact:** 5개 UAT 가 skipped 로 남았고 새 화면 기준으로 재확인이 필요했다. 화면 변경이 서버 프로토콜(`extend`·`skip`·`messages`)까지 번졌다.
**Source:** 02-UAT.md, docs/decisions/0017-day-table-redesign.md, 02-15-SUMMARY.md

---

### happy-dom 이 `clamp()`·`max()` 인라인 값을 버린다
`left: clamp(...)` 를 인라인으로 쓰면 `style.left` 가 빈 문자열이 되어 테스트로 읽을 수 없었다(`calc()` 만 산다). `--mf-float-left` 사용자 정의 속성에 같은 값을 넣고 CSS 가 `var()` 로 받게 했다.

**Impact:** 브라우저 결과는 같지만 테스트가 `getPropertyValue` 로 읽어야 했다. vitest 는 CSS 를 처리하지 않아 `?raw` 도 빈 문자열이라 `readFileSync` 로 읽었다.
**Source:** 02-07-SUMMARY.md, 02-10-SUMMARY.md

---

### 낮 진입 훅이 매번 쓰던 `messages: []` 가 알람 테스트를 깨뜨렸다
정규화가 방을 바꾸지 않았는데도 `setAlarm(과거 마감)` 이 대기 중인 알람을 덮어써 알람이 즉시 실행됐다. `normalized.phaseEndsAt !== stored.phaseEndsAt` 일 때만 `setAlarm` 하도록 고쳤다.

**Impact:** "예외는 정규화로 마감이 바뀐 경우뿐" 이라는 생성자 원칙을 확인했고, 02-15 에서 tick 이 키를 더 쓰지 않으며 이 분기는 자연히 무의미해졌다.
**Source:** 02-12-SUMMARY.md, 02-05-SUMMARY.md

---

### 보안 감사 때는 이미 이후 페이즈가 통제를 바꿔 놓은 항목이 있었다
2026-10-30 감사에서 T-02-04(마감 전 선택 → 0023·0027 의 `claimPick`/`claimLog`), T-02-09(`messages` 보관 → 0017-7) 등이 후속 결정으로 대체돼 현재의 등가 통제를 근거로 닫았다. 위협 50개 중 열린 위협은 0건이다.

**Impact:** 페이즈 계획의 위협 완화가 코드 증거와 달라질 수 있으니 감사는 현재 코드 기준으로 해야 한다.
**Source:** 02-SECURITY.md
