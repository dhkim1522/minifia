---
phase: 1
phase_name: "걷는 뼈대"
project: "minifia"
generated: "2026-10-30"
counts:
  decisions: 7
  lessons: 6
  patterns: 6
  surprises: 5
missing_artifacts:
  - ".planning/STATE.md (결정 절은 읽지 않음)"
---

# Phase 1 Learnings: 걷는 뼈대

## Decisions

### Worker 이름 `minifia` 와 Durable Object 선언 방식 고정
Worker 이름을 minifia 로 정하고 DO 는 `exports` 로 선언했다. 공개 주소가 `https://minifia.dhplay.workers.dev` 로 확정됐다. 의존성은 검증된 정확한 버전으로 고정했다.

**Rationale:** 이름은 공개 주소이고 `exports` 선언은 배포 후 migrations 로 되돌릴 수 없다. 새로 나온(too-new) 10개 패키지는 리서치가 검증한 버전 그대로 사용자 승인을 받아 설치했다.
**Source:** 01-01-SUMMARY.md, 01-02-SUMMARY.md

### 서버가 모든 판정을 하고 순수 코어 + 얇은 DO 어댑터로 나눈다
`shared/` 순수 코어, `worker/` 얇은 Durable Object 어댑터, `src/` 표현 중심 React 로 나눴다. 역할 배정은 `ROLE_TABLE` 서버 한 곳, 플레이어별 뷰는 `view.ts` 허용 목록으로만 만든다.

**Rationale:** 다른 사람의 역할이 클라이언트로 가지 않게 하고(ROLE-02) 규칙을 테스트하기 쉽게 하기 위해서다.
**Source:** 01-01-SUMMARY.md, 01-07-SUMMARY.md, 01-VERIFICATION.md

### 단계 마감은 `now` 가 아니라 "이전 마감 + 다음 단계 길이" 로 연쇄 계산
알람이 늦게 와도 모든 폰의 마감 시각이 같다. 알람은 `nextWakeAt` 하나로 단계 마감과 방 만료를 함께 다룬다.

**Rationale:** 알람 지연이 폰마다 다른 전환 시각으로 번지지 않게 한다. 실측 낮 전환 시각 차이는 8창 2.8ms, 이전 배포 스모크 467ms(상한 500ms).
**Source:** 01-07-SUMMARY.md, 01-UAT.md

### 방장 승계와 정원·시작 인원 기준 (결정 0012)
방장이 나가면 연결된 사람 중 `joinSeq` 최소가 이어받고, 연결된 사람이 없으면 전체 `joinSeq` 최소가 이어받는다. 정원(`ROOM_FULL`)은 끊긴 사람을 포함한 자리 수, 시작 인원은 연결된 사람 수다. `startGame` 은 연결 여부와 무관하게 앉은 사람 전원에게 역할을 준다.

**Rationale:** 끊긴 사람이 방장이 되면 자동 이양이 없어(v2 CONNX-01) 아무도 시작할 수 없는 방이 될 수 있다.
**Source:** 01-04-SUMMARY.md, 01-07-SUMMARY.md

### 방 코드 충돌과 중복 접속 처리
방 코드 충돌은 DO `createRoom` 이 `CODE_TAKEN` 으로 거부하고 Worker 가 최대 8번 재시도한다(덮어쓰기 없음). 같은 플레이어의 새 hello 는 이전 소켓을 4001 `replaced` 로 닫고, `detachConnection` 은 connId 가 일치할 때만 연결을 뗀다.

**Rationale:** 낡은 소켓의 닫힘이 새 연결 상태를 덮는 문제(RESEARCH Pitfall 3)를 막는다.
**Source:** 01-02-SUMMARY.md, 01-09-SUMMARY.md

### 닉네임 정규화는 `\p{Zs}+` 만 압축, 비교 키에서 보이지 않는 문자를 지움
탭·줄바꿈은 정규화가 건드리지 않고 금지 문자 검사가 거부한다. 01-15 에서 채움 문자는 위치와 무관하게 금지하고, ZWJ·변형 선택자·결합 문자는 표시 이름에 남기되 비교 키에서만 지운다.

**Rationale:** `\s+` 로 줄이면 `a\nb` 가 `a b` 로 통과한다. 위장 닉네임(보이는 모습과 키의 어긋남)을 막으려는 CR-01 처분이다.
**Source:** 01-03-SUMMARY.md, 01-15-SUMMARY.md, 01-REVIEW-DISPOSITION.md

### 사용자 UAT 피드백으로 디자인 결정 변경 (폰트·테이블·OG)
Gowun Dodum 폰트, 크림 대리석 테이블, 새 OG 이미지(입장 배경·인물 4명)로 바꿨고 첫 화면은 카드 없는 구성과 닉네임 시트로 재설계했다.

**Rationale:** UAT 1·2·5번에서 사용자가 폰트 감성, 테이블과 배경의 겹침, OG 단순함을 지적했다(결정 0013·0014).
**Source:** 01-UAT.md, 01-VERIFICATION.md

---

## Lessons

### 닉네임 입력 대비는 토큰·계산으로 맞춘다
밤 남색 카드 위 `--gray-300` 14px 라벨과 opacity 0.7 placeholder 가 비활성처럼 보였다. 힌트는 gray-300 불투명도 1, 구분선은 gray-500, 꺼진 버튼 불투명도는 0.6 으로 올렸다(0.5 는 보조 버튼 4.23:1 로 4.5 미달).

**Context:** UAT 1번 사용자 지적, G-01-1b. 사용자가 재배포본에서 또렷함을 확인했다.
**Source:** 01-UAT.md, 01-17-SUMMARY.md

### iOS 시트 문제는 가설이 아니라 실기기 계측으로 확정했다
[내 역할] 시트가 폰에서 떴다가 떨어지는 문제를 첫 프레임(애니메이션) 가설로 고쳤으나 01-16 실기기 확인이 실패했다. 계측 패널(`?sheetdebug=1`) 한 장으로 포커스 이동에 의한 다이얼로그 자동 스크롤임이 드러났고 `.mf-dialog { overflow: clip }` 한 줄(e581bd8)로 해결했다.

**Context:** 추측 코드 수정을 더하지 않고 재진단으로 넘긴 01-16 의 결정이 맞았다. 01-19 의 분기별 수정 계획은 대체됐다.
**Source:** 01-16-SUMMARY.md, 01-18-SUMMARY.md, 01-19-SUMMARY.md, 01-UAT.md

### 계획 문구를 그대로 구현하면 어긋나는 곳이 있었다
공백 압축 `\s+` 는 줄바꿈을 통과시켰고, `width: min(64vw,240px)` + `max-height` 는 낮은 화면에서 카드 2:3 비율을 깼다. 각각 `\p{Zs}+`, `min(min(64vw,240px), calc(52dvh*2/3))` 로 고쳤다.

**Context:** 인수 기준 grep 은 만족시키면서 의도(요구)를 지키는 형태로 보강했다.
**Source:** 01-03-SUMMARY.md, 01-08-SUMMARY.md

### 테스트 환경 가정이 깨졌다 (localStorage, 브라우저 값 정화)
Node 26 은 `--localstorage-file` 없이 전역 `localStorage` 가 `undefined` 라서 테스트 전용 메모리 저장소 헬퍼가 필요했고, 이 과정에서 session.ts 가 방금 쓴 값을 메모리 대체본에서 지우는 버그가 드러났다. `<input>` 은 개행을 자동 제거해 개행 닉네임 케이스를 탭 문자로 대체했다.

**Context:** 앱 코드는 호출 때마다 전역을 읽어 없으면 메모리로 대체한다.
**Source:** 01-06-SUMMARY.md, 01-05-SUMMARY.md

### 하이버네이션·소켓 수명 방어는 계획 밖에서 발견됐다
DO 가 깨어날 때 저장된 `connected` 가 실제 열린 소켓과 어긋날 수 있어 생성자의 `blockConcurrencyWhile` 안에서 `ctx.getWebSockets()` 로 다시 계산했고, 클라이언트 자동 재연결에 상한(연속 5회)을 두었다. 계획은 "1초 뒤 한 번 새로 연결" 이었다.

**Context:** Rule 2(Missing Critical) 자동 수정. 이후 01-05·01-11 이 지수 백오프와 30초 포기 판정으로 교체했다.
**Source:** 01-02-SUMMARY.md, 01-11-SUMMARY.md

### 병렬 워크트리 실행의 환경 마찰
새 워크트리마다 `node_modules` 가 없어 `npm ci`(lockfile 고정)를 해야 했고, 샌드박스가 복합 git 명령을 막아 plan 커밋 장부를 남기지 못한 적이 있다. 첫 plan 은 main 이 보호 브랜치라 phase 브랜치로 옮겨 커밋했다. 여러 plan 이 세션 사용량 한도로 중단됐다가 커밋 이력 기준으로 이어서 재개했다.

**Context:** `plan_head_before` 는 디스패치 때 받은 기준 SHA 로 `git rev-list --count` 를 재서 보완했다.
**Source:** 01-01-SUMMARY.md, 01-09-SUMMARY.md, 01-12-SUMMARY.md, 01-13-SUMMARY.md

---

## Patterns

### RED 커밋에 빈 값 뼈대 모듈을 함께 넣는다
모듈이 없으면 import 실패로 INVALID_RED 가 되므로, 검사만 하고 결과는 비운 뼈대를 RED 커밋에 넣어 단언 실패로 RED 를 만든다.

**When to use:** TDD RED 증거 분류기(`check tdd-red-evidence`)를 쓰는 새 모듈 추가.
**Source:** 01-05-SUMMARY.md, 01-07-SUMMARY.md, 01-08-SUMMARY.md

### 단언은 한 줄 문자열로 비교한다
`outcome(r)` 도우미(성공이면 "ok", 거절이면 오류 코드)와 `tap-flat` 리포터를 써 TAP 보고가 여러 줄 diff 로 깨지는 것을 막는다.

**When to use:** RED 증거를 TAP 으로 남기는 모든 테스트.
**Source:** 01-04-SUMMARY.md, 01-07-SUMMARY.md, 01-09-SUMMARY.md

### 플레이어별 뷰 누출 전수 검사
4~8명 × 단계 × 전원 × 시드 조합으로 token·id·connId·role/allies 키 경로·공개 키 집합·역할 값 개수를 훑는다. 미래 필드(role)를 붙인 상태로도 새지 않는지 `as unknown as RoomState` 로 검사한다.

**When to use:** 서버가 플레이어마다 다른 뷰를 만드는 모든 기능.
**Source:** 01-04-SUMMARY.md, 01-07-SUMMARY.md, 01-VERIFICATION.md

### 하나의 버전 문자열을 화면과 `/api/health` 에 함께 노출
UTC 시각+커밋 해시가 첫 화면 푸터와 health 응답에 같이 나와 재배포 뒤 새 버전을 확인한다.

**When to use:** 이른 배포와 배포본 검증이 필요한 모든 페이즈.
**Source:** 01-01-SUMMARY.md, 01-UAT.md

### 통합 테스트의 시간 전이와 스모크
`forceDue(code, field)` → `runDurableObjectAlarm` 로 전이 한 번씩 진행한다. 스모크는 Node 내장 fetch·WebSocket 만 써 OS 에 의존하지 않는다. 워커 테스트는 테스트마다 다른 방 코드를 쓴다.

**When to use:** Durable Object 알람·단계 전이 테스트.
**Source:** 01-09-SUMMARY.md, 01-02-SUMMARY.md

### 실기기 문제는 운영 번들 영향 없는 지연 로드 계측으로 잰다
플래그 판정과 등록 자리(`sheetProbe.ts`)만 운영 번들에 두고 측정 본체는 동적 import 청크로 두며, 판정은 `classifyTrace` 코드로 고정하고 사람은 "내려앉음이 보였는지" 하나만 정한다.

**When to use:** 데스크톱에서 재현되지 않는 모바일 브라우저 증상.
**Source:** 01-18-SUMMARY.md

---

## Surprises

### 배포본 `POST /api/rooms` 간헐 500 한 건, 원인 미확정
검증 첫 스모크가 500 으로 실패했지만 이후 스모크 6회와 curl 15회는 모두 성공해 재현하지 못했다. 콜드 스타트나 Cloudflare 일시 오류 가능성만 있다.

**Impact:** 비차단. 클라이언트는 NETWORK 오류로 받아 재시도 문구를 보이며 모니터링 대상으로 남았다.
**Source:** 01-VERIFICATION.md

### 끊김 띠가 뜨기까지 약 10초 걸렸다
소켓 강제 단절 후 클라이언트 close 가 CLOSING 상태로 남아 띠가 약 10초 뒤에 떴다(포기 화면은 41초 뒤). 조용한 단절 감지는 실기기 확인이 필요하다.

**Impact:** 통과로 처리됐지만 조용한 단절 감지는 열린 관찰 항목.
**Source:** 01-UAT.md

### 재배포 중 재접속이 너무 빨라 끊김 띠가 보이지 않았다
게임 중 두 번 재배포해도 모두 같은 자리·같은 역할로 유지됐고 띠는 보이지 않았다.

**Impact:** 긍정적. 재접속이 띠 표시 전에 복구된 것으로 보인다.
**Source:** 01-UAT.md

### 의존성 설치가 wrangler/workerd 를 두 벌로 끌고 왔다
`@cloudflare/vite-plugin` 이 `wrangler 4.151.0` / workerd `1.20261012.1` 을 따로 끌고 와 루트 `wrangler 4.151.3` / `1.20261019.1` 과 공존한다.

**Impact:** `compatibility_date` 를 2026-10-12 로 고정해 흡수했다(결정 0009).
**Source:** 01-01-SUMMARY.md

### 코드 리뷰 BLOCKER 처분 표가 실제 코드보다 뒤처졌다
CR-01 이 01-REVIEW-DISPOSITION.md 에 `open` 이었지만 01-15 가 이미 고쳤고 보안 점검(2026-10-30)에서 확인해 `closed` 로 갱신했다. INFO IN-01~IN-09 는 모두 open 으로 남았다.

**Impact:** 문서 어긋남 수정. 보안 감사 결과 `threats_open: 0`, 상태 verified.
**Source:** 01-REVIEW-DISPOSITION.md, 01-SECURITY.md, 01-VERIFICATION.md
