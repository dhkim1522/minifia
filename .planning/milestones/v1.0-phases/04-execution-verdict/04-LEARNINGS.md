---
phase: 4
phase_name: "처형과 승패"
project: "minifia"
generated: "2026-10-30"
counts:
  decisions: 6
  lessons: 6
  patterns: 6
  surprises: 5
missing_artifacts: []
---

# Phase 4 Learnings: 처형과 승패

## Decisions

### 분기는 마감 훅의 next? 로, PHASE_DEFS.next 는 기본값 데이터로
여부 투표 → 후보 선택 → 밤 같은 분기를 마감 훅이 돌려주는 `next?` 로 표현하고, `PHASE_DEFS[phase].next` 는 기본 다음 단계로만 둔다.

**Rationale:** 표가 없으면 밤으로, 과반 찬성이면 후보 선택으로 가는 식의 분기를 데이터 표에 넣으면 단순 반복 테스트가 깨진다. 분기를 훅에 모으면 `tick.ts` 의 ON_ENTER/ON_DEADLINE 표 한 곳에서 흐름이 읽힌다.
**Source:** 04-01-SUMMARY.md, 04-02-SUMMARY.md

### 후보 선택 집계는 공개 구간 진입 훅에서 한 번에, 개인 표는 집계 직후 지운다
마감 훅에는 난수 인자가 없으므로 집계와 표 공개 순서(Fisher–Yates)를 공개 진입 훅에서 정한다. 집계 뒤 `Player.candidateVote`·`execVote` 는 키째 지우고 같은 내용은 `voteLog.cand.votes` 로만 남긴다.

**Rationale:** 서버가 공개 순서를 정해야 클라이언트가 임의로 순서를 바꿀 수 없고(결정 0002), 개인 표가 상태에 남아 view 로 새는 경로를 없앤다.
**Source:** 04-04-SUMMARY.md, 04-01-SUMMARY.md

### 승패는 연결 상태와 무관하게 생존자 수로만 판정한다
`checkWinner`: 마피아 0 이면 시민 승, 마피아 수 ≥ 나머지 생존자 수면 마피아 승. 끊긴 생존자도 생존자로 센다. 판정은 처형·아침 마감 훅에서만 한다.

**Rationale:** 폰을 꺼 둔 사람이 있어도 각 단계가 제때 마감되어야 한다(CONN-02). 연결 여부가 판정에 끼면 접속 끊김으로 승패를 조작할 수 있다.
**Source:** 04-06-SUMMARY.md, 04-VERIFICATION.md

### 종료 방은 새 타이머 없이 만료 시각을 앞당겨 30분 뒤 정리
`ended` 진입 때 `expiresAt` 을 `min(기존, 진입 시각 + 30분)` 으로 줄인다. 결과 화면용 `result` view 는 `ended` 에서만, 기존 관전자 루프를 재사용하지 않고 따로 만든다.

**Rationale:** 새 알람을 추가하지 않아 기존 만료 경로를 그대로 쓰고, 관전자 전용 규칙이 결과 화면 노출에 섞이지 않게 한다.
**Source:** 04-06-SUMMARY.md

### 시간·타이밍 상수는 phases.ts/verdict.ts 한 출처, 공개 길이는 서버가 표 수로 결정
토론 40초·여부 13초(카드 3초 포함)·공개 한 표 2초 등을 `phases.ts` 상수 하나로 두고, 서버(`phaseDurationOf`)와 화면(`useRevealState`)이 같은 값을 쓴다. 연출 수치(700ms 확정 박동, 축소 모션 유지 시간)도 `verdict.ts` 한 곳(D-38).

**Rationale:** 서버 마감과 화면 연출이 어긋나면 표가 잘리거나 빈 시간이 생긴다. 실테스트 뒤 결정 0039·0040 으로 값이 바뀌었을 때 고칠 곳이 한 곳이었다.
**Source:** 04-VERIFICATION.md, 04-20-SUMMARY.md, docs/decisions/0039-playtest-pacing.md

### E2E 기준 수치는 낮추지 않고 화면을 고친다
공개 칩이 이름표와 겹칠 때(P10), 집계 줄이 360 폭에서 잘릴 때(G2), 변론 흐림이 배포본에서 사라질 때 모두 검사 기준을 완화하지 않고 구현·문구를 고쳤다.

**Rationale:** 검사는 실제 사용자 결함을 잡는 용도이므로 기준을 낮추면 의미가 없다. 각 수정마다 고치기 전 코드로 되돌려 실패하는 양성 대조를 확인했다.
**Source:** 04-32-SUMMARY.md, 04-33-SUMMARY.md, 04-35-SUMMARY.md

---

## Lessons

### dev 서버 E2E 는 minify 결과를 못 잡는다
Vite 8 의 lightningcss 는 `backdrop-filter` 와 `-webkit-backdrop-filter` 를 한 규칙에 같이 쓰면 접두만 내보낸다. 로컬 E2E(dev, minify 없음)는 통과했지만 배포본에서 Chrome 계열의 변론 흐림이 사라졌다.

**Context:** 배포본 E2E(04-35)에서 vote5·result-c 의 `defense` 단계 P5 가 세 폭 모두 실패해 발견했다. 소스에는 비접두 한 번만 쓰고 접두는 빌드에 맡기도록 고쳤고, 단위 시험이 lightningcss 변환 결과를 직접 확인한다.
**Source:** 04-35-SUMMARY.md

### 서버 규칙을 바꾸면 규칙과 무관해 보이는 테스트·스크립트가 무작위로 깨진다
`testSkip` 이 봇 표를 채우게 되자 낮을 건너뛰던 기존 워커 테스트와 UAT·E2E 스크립트가 70% 찬성 → 처형 → 종료 경로를 무작위로 타 불규칙 실패했다. 승패 규칙이 들어오자 4명판 spec4 도 1대1 종료로 버튼이 사라졌다.

**Context:** 해결은 봇 표를 전원 반대로 고정하는 도우미(`skipDayToNight`), 방을 되돌려 재시도하는 루프, `run.mjs` 재시도 4번이었다. 남은 무작위는 설계대로의 확률임을 시드 2만 판 모의로 확인했다(4명판 0.332, 5명판 0.199~0.252).
**Source:** 04-08-SUMMARY.md, 04-11-SUMMARY.md, 04-32-SUMMARY.md, deferred-items.md

### RED 커밋에 던지는 껍데기가 필요했다
없는 모듈을 import 하면 파일 전체가 로드 실패라 TDD 증거 검사가 `INVALID_RED` 로 분류해 GREEN 을 허가하지 않았다. 또 `toStrictEqual` 객체 비교와 빈 문자열 `actual:` 이 TAP/YAML 진단을 깨서 `check tdd-red-evidence` 가 거부했다.

**Context:** `vote.ts`·`execution.ts` 에 던지는 함수만 둔 껍데기를 RED 커밋에 넣고, 객체 비교는 `JSON.stringify` 문자열 비교·빈 값은 `"-"` 로 바꿨다. 단언 강도는 그대로다.
**Source:** 04-01-SUMMARY.md, 04-04-SUMMARY.md

### 검사 기준이 UI-SPEC 과 모순될 수 있다
P9 가 관전자 화면에서 후광 0개를 요구했으나, 탈락한 방장은 모든 직업을 받으므로 마피아 동료 진홍 후광이 투표 장면에도 남는 것이 설계(D-33)였다.

**Context:** 검사 쪽 기준을 `spectator` 일 때만 진홍을 제외하도록 TDD 로 고치고 UI-SPEC P9 행에 한 줄 보탰다. 인트로 카드(1.8초)가 남아 글자 검사에 걸린 것은 스크립트가 카드 소멸을 기다리게 해 해결했다.
**Source:** 04-33-SUMMARY.md

### 계산된 색은 문자열 포함이 아니라 8비트 sRGB 로 비교한다
후광 filter 의 계산된 색이 `color(srgb …)` 로 나와, 진홍 토큰 문자열 포함 검사가 진홍 후광을 세지 못했고 "시민 방장 진홍 0" 검사가 거짓 통과가 되었다.

**Context:** 색 함수를 8비트 sRGB 로 환산해 ±2 로 비교하고 양성 대조로 확인했다. `rebaseSeries` 도 같은 환산을 04-32·04-33 이 재사용한다.
**Source:** 04-31-SUMMARY.md

### 시안·글 폭 가정은 360px 실측으로 확인해야 한다
봇이 모두 투표해 남은 수가 0 이 되면 `모두 투표했어요 · 마감까지 바꿀 수 있어요` 가 360 폭 패널(328)에서 잘렸지만, 봇 투표 시각에 따라 일부 실행에서만 나타났다. 다른 사례로 앞줄 이름표가 뒷줄 머리 높이까지 올라와 공개 칩과 겹쳤다.

**Context:** 문구를 `모두 냈어요 · 마감까지 바꿀 수 있어요`(220.9px)로 줄이고, 칩은 순수 함수 `chipPlacement` 로 이름표 회피(옆으로 → 위로)를 계산하게 했다. 스크립트는 최악 상태(`모두 냈어요`)를 결정적으로 기다려 읽는다.
**Source:** 04-33-SUMMARY.md, 04-32-SUMMARY.md

---

## Patterns

### 서버 웨이브 → 화면 웨이브 → 한 단위 배포
04-01~04-12 서버·공유 로직, 04-13~04-34 화면, 04-35 한 번에 배포로 나눴다. 순수 모듈(`verdict.ts`)을 먼저 만들고 화면이 그것을 소비한다.

**When to use:** 서버 계약과 화면이 함께 바뀌는 페이즈. 서버 쪽 계약 문서(결정 0036)를 먼저 쓰고 04-12 에서 코드와 재대조한다.
**Source:** 04-VALIDATION.md, 04-03-SUMMARY.md, 04-12-SUMMARY.md

### 허용 목록 view + 전 프레임 누출 전수 검사
`view.ts` 가 허용 키만 실어 보내고, 4~8명 × 투표 이후 단계 × 모든 viewer × 시드로 token·id·role·allies·서버 전용 키를 전수 검사하며, 소켓 스크립트(`uat-vote`)와 `leak.test.ts` 가 실제 프레임을 확인한다.

**When to use:** 서버 권위 게임에서 새 단계를 추가할 때(결정 0002). 변이(mutation)로 실패를 확인하는 단계를 포함한다.
**Source:** 04-04-SUMMARY.md, 04-09-SUMMARY.md, 04-10-SUMMARY.md

### 집계는 실시간과 마감이 같은 순수 함수
`execTallyOf` 한 함수가 진행 중 집계와 마감 집계를 모두 만든다. 서버가 `execTally` 만 전원에게, `voteAgree` 는 본인에게만 싣는다.

**When to use:** 중간 집계를 공개하되 개인 표는 숨겨야 하는 투표. 차분 단위 시험으로 두 경로가 같음을 보인다.
**Source:** 04-01-SUMMARY.md, 04-VERIFICATION.md

### 양성 대조로 검사 자체를 검증
고친 코드를 되돌려 같은 검사가 결정적으로 실패하는지 확인한 뒤 복구한다(vote5 G2 옛 문구, P10 35/35 실패, 진홍 후광 누출).

**When to use:** E2E/시각 검사를 새로 만들거나 기준 수치를 건드리지 않고 화면을 고쳤을 때, 검사가 거짓 통과가 아님을 증명할 때.
**Source:** 04-32-SUMMARY.md, 04-33-SUMMARY.md, 04-31-SUMMARY.md

### 좌표·배치는 순수 함수 + 전 조합 시험
`chipAnchor`·`chipPlacement`·`candidateCenter`·`capHalos` 를 순수 함수로 만들고 4~8명 × 폰 폭 4종 × 패널 2종 × 모든 자리를 전수 시험한다. `capHalos` 는 한 자리 하나, 최대 동시 개수 상한으로 우선순위를 정한다.

**When to use:** 화면 겹침·잘림이 폰 폭과 인원수에 따라 달라지는 연출. 같은 공식을 시험이 DayTable 에 중복되지 않음까지 확인한다.
**Source:** 04-13-SUMMARY.md, 04-21-SUMMARY.md, 04-32-SUMMARY.md

### 판 흐름을 막는 무작위는 결정적으로 고정하거나 한도 있는 재시도
봇 투표를 전원 반대로 저장해 두고 넘기기, 방을 대기실로 되돌려 최대 N번 재시도, 워커 시험의 속도 한도는 `resetRateWindow` 로 비운다.

**When to use:** 서버 무작위(밤 암살 대상 등)를 테스트에서 고정할 수 없는 흐름 시험. 실패 확률과 재시도 횟수를 SUMMARY 에 정직하게 적는다.
**Source:** 04-08-SUMMARY.md, 04-15-SUMMARY.md, 04-32-SUMMARY.md

---

## Surprises

### 35개 계획으로 불어난 페이즈
한 페이즈가 서버 12 + 화면 22 + 배포 1, 총 35개 계획·수천 개 시험(최종 111 파일 3035 시험)이 되었다. 마지막 승인 때 실테스트 이후 결정 0039·0040 이 들어와 일부 시간·UX 가 갱신되었다.

**Impact:** ROADMAP 성공 기준 1번의 "10초" 문구가 0039 의 13초와 어긋난 채 남았다(VERIFICATION 참고 사항). 문서 갱신을 결정과 함께 해야 한다.
**Source:** 04-VERIFICATION.md, 04-VALIDATION.md

### 배포본 smoke 의 간헐 실패는 이 PC 네트워크 지터
5명 smoke 의 도착 편차가 500ms 한도를 여러 번 넘겼지만(515·583·558·607·1004ms) 같은 코드가 재실행에서 통과했다. 서버 코드는 두 배포 사이 CSS 외 변경이 없었다.

**Impact:** 한도를 올리거나 낮추지 않고 실패 횟수를 그대로 적었다. VALIDATION 에는 `flaky (통과)` 로 표시되었다.
**Source:** 04-35-SUMMARY.md, 04-VALIDATION.md

### 4명판은 첫 밤에 방장이 죽지 않으면 둘째 밤 뒤 1대1 로 끝난다
승패 규칙(마피아 ≥ 나머지)이 들어오자 spec4 의 `testSkip` 버튼이 없어져 360·390 폭에서 4/4 실패했다. 밤 암살 대상은 서버 무작위라 고정할 수 없었다.

**Impact:** 방을 되돌려 최대 8번 재시도(실패 약 4%)하는 편법이 필요했다. 「살아 있는 방장」 흐름은 방장 시민 4명판 1/3, 5명판 약 1/5 로 `SetupError` 후 재시도한다.
**Source:** 04-32-SUMMARY.md, deferred-items.md

### 전체 시험이 파일의 마지막 @media 를 읽는다
`reveal.test.tsx` 가 `css.lastIndexOf("@media (prefers-reduced-motion: reduce)")` 로 마지막 분기를 읽어, 새 CSS 구역을 파일 끝에 붙이면 기존 시험 두 개가 실패했다. 또 `assets.test.ts` 가 `slice(-12)` 로 토큰 꼬리 위치에 기대고 있었다.

**Impact:** 새 CSS 구역을 `과반 확정 두근` 구역 앞에 두고(04-21·04-24), 토큰 시험은 이름 찾기로 바꿨다. 시험이 위치에 암묵적으로 기대는 곳이 있음을 알게 되었다.
**Source:** 04-24-SUMMARY.md, 04-14-SUMMARY.md, 04-21-SUMMARY.md

### 테스트 시트가 결과 화면을 가렸다
테스트 방 방장이 도구 시트(`testOpen`)를 연 채 판이 끝나면 모달이 남아 [처음으로] 가 눌리지 않았다. 단계가 바뀌어도 시트가 열려 있는 설계(대기실 때문)가 원인이었다.

**Impact:** `phase === "ended"` 효과에서 `setTestOpen(false)` 를 호출해 해결했다. 브라우저 검증(`elementFromPoint`)으로만 발견되어 단위 시험으로는 못 잡을 결함이었다.
**Source:** 04-25-SUMMARY.md
