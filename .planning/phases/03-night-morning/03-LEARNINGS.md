---
phase: 3
phase_name: "밤과 아침"
project: "minifia"
generated: "2026-10-30"
counts:
  decisions: 7
  lessons: 5
  patterns: 6
  surprises: 4
missing_artifacts:
  - "03-UAT.md"
---

# Phase 3 Learnings: 밤과 아침

## Decisions

### 단계 표 확장과 3페이즈 와이어 계약을 첫 계획에서 한 번에 확정
루프는 `discussion → night(30초) → morning(5초) → dayAnnounce` 이고 일차는 dayAnnounce 진입 훅에서만 오른다. `PhaseId`, `InvestigationRecord`, `MorningView`, `MyInfo.pick·allyPicks·records`, `spectate`, `pick` 메시지를 03-01 에서 한꺼번에 타입으로 정했고, 03-09 에서 결정 0020 에 되돌리기 비용과 함께 기록했다.

**Rationale:** 서버·화면 12개 계획이 같은 와이어 값을 읽으므로 한 곳에서 먼저 굳히면 계획 사이 불일치가 없다. 문서는 코드가 굳은 뒤(03-12 직전)에 써서 코드와 같다.
**Source:** 03-01-SUMMARY.md, 03-09-SUMMARY.md

---

### tick 의 난수는 세 번째 인자로만 받고, 기본값은 호출 즉시 Error
`tick(state, now, randInt = NO_RANDOM)`. 기본값은 불리면 `Error('tick: randInt is required to resolve the night')` 를 던지고 방 DO 는 `cryptoRandInt` 를 넘긴다.

**Rationale:** 난수를 빠뜨렸을 때 조용히 틀린 판정이 나가는 것을 막고, 공유 규칙 모듈을 전역 난수·시각 없는 순수 상태로 유지한다.
**Source:** 03-01-SUMMARY.md, 03-SECURITY.md (T-03-02)

---

### 밤 판정 규칙표: 동시 해결, 고른 표만 집계, 의사 구출은 "지목 없음"과 같은 결과
마피아는 실제로 고른 사람의 표만 센다(A2). 동률은 seat 오름차순 목록에서 `randInt` 로 뽑는다. 같은 밤 행동은 모두 동시에 해결된다(A1: 지목된 경찰의 조사와 의사의 보호도 적용). 의사 보호가 지목과 같으면 morning 은 `{}` 이며 지목 없음과 구별되지 않는다.

**Rationale:** 의사 구출을 "탈락 없음"과 구분 불가하게 해서 살아 남은 사람이 구출 여부를 추론하지 못하게 한다. 판정 순서 의존을 없애려고 동시 해결을 택했다.
**Source:** 03-03-SUMMARY.md, 03-09-SUMMARY.md

---

### 거부 코드는 한 규칙: 틀린 단계는 WRONG_PHASE, 맞는 단계의 탈락자·방 밖 사용자는 BAD_MESSAGE
`pick`, `say`, `emoji`, `claim` 모두 같은 규칙이다. 밤에 살아 있는 비마피아의 say·emoji 는 WRONG_PHASE 이고, 거부된 pick 은 보낸 소켓에만 error + 최신 state 를 보낸다.

**Rationale:** 거부가 어떤 소켓에도 새 정보를 주지 않게 하고, 결정 0016 A4 의 탈락자 거부 코드를 확정한다. 쿨다운은 연결당 속도 제한이 이미 있어서 두지 않았다.
**Source:** 03-03-SUMMARY.md, 03-04-SUMMARY.md, 03-07-SUMMARY.md

---

### 밤 마피아 채팅 줄 번호는 낮 번호와 분리한 `nextNightSeq`
밤 줄은 `RoomState.nextNightSeq` 로 세고 낮 `nextMessageSeq` 는 밤에 바뀌지 않는다. 밤 chat 은 메시지를 저장하지 않고 살아 있는 마피아와 탈락자에게만 방송한다.

**Rationale:** 낮 chat 프레임 seq 의 간격으로 밤 메시지 수를 알아낼 수 없게 한다(T-03-40).
**Source:** 03-01-SUMMARY.md, 03-04-SUMMARY.md, 03-SECURITY.md

---

### 탈락자 관전 데이터는 `spectate.seats[].job` 한 경로로만 보내고 키 이름은 `job`
누출 검사는 `role` 키를 `me` 밖에서 금지한다. 역할 값이 허용되는 경로는 탈락한 viewer 에게 오는 `spectate.seats[].job` 하나다. 탈락한 마피아는 `allies` 만 계속 받고 `allyPicks`·`pick` 은 받지 않는다(A3). `alive` 는 서버가 항상 싣는다(A7).

**Rationale:** 누출 불변식을 키 이름 하나로 기계적으로 검사하게 만들려는 설계이고, 게임 규칙과 비공개 정보는 서버가 정한다는 결정 0002 와 탈락자 관전 결정 0021 을 따른다.
**Source:** 03-01-SUMMARY.md, 03-05-SUMMARY.md, 03-VERIFICATION.md

---

### 마피아 채팅 안내 문구는 역할 이름이 아니라 채널 이름으로 허용
화면 문구 '마피아끼리만 보여요'·'마피아 채팅' 은 UI-SPEC 고정 문구이므로, "역할 이름 없음" 테스트에서 허용 문구로 빼고 검사한다. 관전 안내는 DayScene 에 글자로 둔다.

**Rationale:** 누출 방지 테스트를 느슨하게 하지 않으면서 UI-SPEC 의 고정 문구와 충돌하지 않게 한다.
**Source:** 03-08-SUMMARY.md

---

## Lessons

### RED 증거가 유효하려면 실패 출력이 한 줄이어야 한다
`expect(order).toEqual([...])` 의 여러 줄 diff 가 tap-flat 보고서를 깨 `INVALID_RED` 가 되었다. 한 줄 문자열 비교(`order.join(">")`)로 바꿔 RED 증거를 다시 얻은 뒤 push 전 RED 커밋을 amend 했다. 03-06 에서는 없는 모듈의 정적 import 가 파일 전체를 로드 실패(INVALID_RED)로 만들어 `import.meta.glob` 으로 RED 를 만들고 GREEN 에서 정적 import 로 바꿨다.

**Context:** TDD 게이트(`gsd-tools check tdd-red-evidence`)를 쓰는 화면·부품 계획 전반.
**Source:** 03-02-SUMMARY.md, 03-06-SUMMARY.md

---

### 클래스 이름 부분 문자열 검사는 오탐한다
`innerHTML.includes("mf-ro")` 가 `class="mf-root …"` 에 걸려 관전 노드가 없는데도 처음부터 실패했다. 선택자(`container.querySelector(".mf-ro")`)로 바꿔 해결했다.

**Context:** "살아 있는 경찰 화면에 관전 클래스가 없다" 가드 테스트.
**Source:** 03-08-SUMMARY.md

---

### 필드 하나를 view 에 더하면 키를 정확히 비교하는 테스트가 계획 밖에서 깨진다
`PublicPlayer.alive` 를 항상 싣자 계획에 없던 `join.test.ts` 와 `view.test.ts` 의 키 단언이 실패했다. 각 계획의 `<verify>` 가 파일 전체 통과를 요구하므로 같은 계획 안에서 함께 고쳐야 했다. 하드코딩된 목록 길이(`toHaveLength(5)`, preload 호출 횟수)도 같은 부류였다.

**Context:** 와이어 계약 필드 추가 시 영향 받는 테스트를 계획 단계에서 전수 검색해야 한다.
**Source:** 03-05-SUMMARY.md, 03-08-SUMMARY.md

---

### 테스트 시나리오 헬퍼의 단계 전진 오류는 RED 에서는 드러나지 않는다
`advanceTo(s, "night")` 를 이미 night 인 상태에서 불러 1일차 밤을 두 번 센 상태가 되었다. records 가 없어 RED 가 이유와 무관하게 실패했기 때문에 GREEN 단계에서야 발견되었다.

**Context:** 2일차 records 테스트.
**Source:** 03-05-SUMMARY.md

---

### 누출 테스트가 통과해도 돌연변이로 실제로 보고 있는지 확인해야 한다
03-09 는 임시 변경 여섯 가지(살아 있는 사람에게도 spectate, allyPicks 를 비마피아에게, 밤 chat 수신자를 경찰·의사까지 등)로 새 단언이 실패하는지 확인했다. 한 변이(pick 뒤 state 를 모두에게)는 각 소켓이 자기 view 만 받아 통과했고, 프레임 수 경계는 다른 단언이 지켰다.

**Context:** 단언이 작성 즉시 모두 통과했을 때 위양성을 배제하는 방법.
**Source:** 03-09-SUMMARY.md

---

## Patterns

### 새 단계는 단계 표에 행을 더하는 방식으로만 늘린다
`PHASE_DEFS` 에 night·morning 행을 더하고, 진입 훅은 `ON_ENTER` 표에, 마감 분기는 `ON_DEADLINE` 표에 둔다. 새 마감은 `deadline + duration` 이라 늦은 알람도 한 단계씩 따라잡는다.

**When to use:** 이후 페이즈가 단계를 끼워 넣을 때. 4페이즈가 처형 구간을 `discussion` 과 `night` 사이에 끼웠지만 밤·아침 길이와 훅은 그대로였다.
**Source:** 03-01-SUMMARY.md, 03-VERIFICATION.md, 03-SECURITY.md (T-03-01)

---

### 화면은 모르는 단계·옛 서버 view 를 폴백으로 견딘다
`PHASE_ANNOUNCE[view.phase]?.(view) ?? ""` 와 `renderPhase` default('연결 중…') 폴백으로 모르는 단계를 받아도 깨지지 않는다. `spectate` 가 없는 탈락자 view 는 이름표에 '탈락' 표시만 한다.

**When to use:** 서버와 번들이 따로 배포되어 버전이 어긋날 수 있는 모든 화면.
**Source:** 03-01-SUMMARY.md, 03-08-SUMMARY.md, 03-SECURITY.md (T-03-03)

---

### 플레이어별 view 는 허용 목록 리터럴로 필드별 생성하고 전송 대상은 순수 함수가 정한다
view 는 펼쳐 복사 없이 필드별로 만든다. 받는 사람 집합은 `pickRecipientIds`·`nightChatRecipientIds` 순수 함수가 정하고, 방 DO 는 `sendViewTo`/`broadcastEventTo` 로 보낸다. 누출은 `leak.test.ts` 전수 프레임과 `view.test.ts` 아홉 단계 뷰로 지킨다.

**When to use:** 비공개 정보가 걸린 새 필드나 이벤트를 더할 때.
**Source:** 03-VERIFICATION.md, 03-SECURITY.md, 03-07-SUMMARY.md

---

### 부품은 화면 값만 받고 역할 이름·동사는 장면이 넘긴다
`pickVerb`, 관전 배지, 실제 직업 줄은 모두 장면이 주는 값이며 부품에는 역할 이름이 없다. 문구 표(`NIGHT_PANEL_TEXT`)에 토스트와 안내도 함께 둔다.

**When to use:** 역할에 따라 문구가 달라지는 부품을 만들 때(누출 방지와 재사용을 함께 얻는다).
**Source:** 03-02-SUMMARY.md, 03-08-SUMMARY.md

---

### 저장소 의존 상태는 try/catch 와 메모리 대체를 쓰고 성공하면 대체값을 지운다
`recordsSeen` 은 저장 실패 시 메모리로 대체하고, 저장 성공 시 해당 키의 메모리 값을 지워 옛 값이 되살아나지 않게 한다. 로비·assigning 초기화에서 seen 0 을 저장해 같은 방 코드의 새 판에 옛 값이 남지 않게 한다.

**When to use:** 폰 localStorage 처럼 사용자가 바꿀 수 있고 실패할 수 있는 저장소를 쓸 때.
**Source:** 03-11-SUMMARY.md, 03-SECURITY.md

---

### 시나리오 한 번에 단언을 여러 개 묶고, 배포본 스모크는 결정적 행동으로 짠다
누출 검사는 같은 `it` 에 단언을 더해 시나리오를 한 번만 돌린다. 스모크의 밤 행동은 결정적(마피아 → 가장 작은 시민 seat, 경찰 → 가장 작은 마피아, 의사 → 자신)이라 탈락자가 고정되고, 봇 시나리오의 의사는 동률 추첨에 끼어 탈락자가 사라지지 않게 항상 자신을 보호한다.

**When to use:** 확률이 섞인 규칙을 배포본에서 재현 가능하게 검증할 때.
**Source:** 03-09-SUMMARY.md, 03-12-SUMMARY.md

---

## Surprises

### 12개 계획 중 9개가 "편차 없음"이었고 배포본 스모크는 3회·봇 3회 모두 첫 시도에 통과
앱 코드 수정과 재배포가 필요 없었고 배포는 한 번이었다. 편차는 대부분 테스트 작성 단계의 사소한 버그(Rule 1)였다.

**Impact:** 와이어 계약을 먼저 확정하고 서버를 뷰·소켓·화면보다 앞세운 순서가 통합 단계의 재작업을 없앴다. 실기기 확인 (1)~(7) 은 사람이 해야 해서 03-12 시점에는 통과 표시하지 않았고, 이후 사용자가 승인했다.
**Source:** 03-12-SUMMARY.md, 03-VERIFICATION.md

---

### 새 누출 단언이 작성 즉시 전부 통과해 `fix(03-09)` 커밋이 한 번도 필요 없었다
단언이 실패하면 진짜 누출이니 원인을 고친다는 경로가 계획에 있었지만 쓰이지 않았다.

**Impact:** 앞선 계획(03-05 view, 03-07 전송)이 이미 경계를 지키고 있었다는 뜻이지만, 위양성 가능성 때문에 돌연변이 확인을 따로 해야 했다.
**Source:** 03-09-SUMMARY.md

---

### 3페이즈의 산출물과 문구 상당수가 이후 결정으로 대체되었다
흐름은 `discussion → night` 직결에서 처형 구간 포함으로, 선택 링·표적 배지는 캐릭터 후광으로, [수사 기록] 헤더 버튼과 시트는 역할 카드 시트의 `활동 기록` 탭으로, 아침 문구는 8개에서 7개(`MORNING_PHRASE_COUNT = 7`)로 바뀌었다. 밤 배경 SVG 와 밤 끝 토스트도 사라졌다.

**Impact:** 검증은 원래 성공 기준이 아니라 현재 코드를 기준으로 했고, 대체된 항목은 갭이 아니라 "나중 결정으로 대체된 항목" 표에 적었다. 와이어 상수(`MORNING_PHRASE_COUNT`)는 서버와 화면이 같은 값을 읽는 구조라 8에서 7로 바꾸는 비용이 작았다.
**Source:** 03-VERIFICATION.md, 03-01-SUMMARY.md

---

### Nyquist 감사에서 인원수 x 무작위 지목 사슬의 교차 불변식 틈 하나가 PARTIAL 로 나왔다
기존 테스트는 개별 규칙을 덮었지만 4~8명 x 시드 40개의 무작위 지목 뒤 viewer 간 아침 동일성, spectate 범위, 탈락자 최대 1명 불변식은 덮지 못했다. `test/unit/nyquist-03-night-chain.test.ts` 로 메웠다.

**Impact:** 규칙별 단위 테스트가 모두 통과해도 조합 불변식은 따로 확인해야 한다.
**Source:** 03-VALIDATION.md
