---
status: complete
phase: 07-free-chat
source: [07-VERIFICATION.md]
started: 2026-11-01T18:49:34Z
updated: 2026-11-02T06:36:15.255Z
---

## Current Test

[testing complete]

## Tests

### 1. iPhone 16 Pro Safari + iOS용 Chrome, 로비(검사 1·2·3·5·6): https://minifia-v2.dhplay.workers.dev?test=1 에서 방 만들기 → 입력칸 탭
expected: 입력줄·보내기가 키보드에 안 가려짐 / 맵이 깜빡이거나 크기가 바뀌지 않음 / 내 캐릭터가 남은 맵 영역에 보임 / '안녕하세요' 전송 뒤에도 키보드가 닫히지 않음 / 맵 빈 곳을 눌러 닫을 때 화면이 튀지 않음
result: pass

### 2. iPhone 한글 IME(검사 4): '안녕하세요' 마지막 글자 조합 중 키보드 보내기(Enter), 이어서 화면의 보내기 버튼
expected: 기록에 한 줄만, 입력칸에 남는 글자 없음
result: pass

### 3. iPhone 테이블 화면(검사 7): [테스트] 봇 3명 → 시작 → 낮 토론까지 넘겨 1·2 반복
expected: 낮 토론 하단에서도 입력줄이 안 가려짐(테이블 아래 인물 가림은 알려진 한계)
result: pass

### 4. 두 기기(폰 + PC 등)에서 한쪽이 글자를 입력 (CHAT-04)
expected: 상대 화면의 내 캐릭터 이름표 위에 '…' 가 뜨고 입력을 비우면 사라진다
result: pass
source: automated
note: "사용자 요청으로 Claude 가 배포본에 E2E 실행 — node scripts/e2e/run.mjs --url https://minifia-v2.dhplay.workers.dev --only chat-lobby, 두 브라우저(방장·손님) 6개 폭 CL6·CL7·CL8 모두 통과(138/138, 2026-11-02)"

### 5. 5분 채팅 부하 체감: iPhone 로비를 둔 채 Mac 에서 node scripts/bots.mjs <방 코드> --count 7 --prod --chat 2 실행
expected: 끊김 체감 없음/가끔, 5분 뒤 열감 차갑다/미지근 (조건 B 데스크톱은 60.00fps·끊김 0 으로 통과, 결정 0055 로 Mac 숫자만으로 통과 선언 불가)
result: skipped
reason: "Deferred follow-up: 실기기 항목 — 사용자 결정(2026-11-02): 페이즈마다 실기기 검사를 하지 않고 모든 개발이 끝난 뒤 실기기로 게임을 진행하며 한꺼번에 피드백한다. 7페이즈 완료로 넘기고 백로그로 이월(2026-11-02 재확인)"

### 6. https://minifia-v2.dhplay.workers.dev/?chat-mock=1 다섯 줄 (6페이즈 이월, 표 D)
expected: 입력줄 안 가려짐 / 캔버스 크기 불변 / 내 캐릭터 보임 / 한글 조합 Enter / 닫을 때 튐 없음
result: skipped
reason: "Deferred follow-up: 실기기 항목 — 사용자 결정(2026-11-02): 페이즈마다 실기기 검사를 하지 않고 모든 개발이 끝난 뒤 실기기로 게임을 진행하며 한꺼번에 피드백한다. 7페이즈 완료로 넘기고 백로그로 이월(2026-11-02 재확인)"

### 7. Android Chrome · 삼성 인터넷 · 카카오톡 인앱(iOS·Android) — 로드맵 성공 기준 3 이 명시한 확인 기기
expected: 위 검사 1·2·4 가 같은 방식으로 통과하거나, 사용자가 9페이즈 팀 테스트로 이월을 결정한다
result: skipped
reason: "Deferred follow-up: 실기기 항목 — 사용자 결정(2026-11-02): 페이즈마다 실기기 검사를 하지 않고 모든 개발이 끝난 뒤 실기기로 게임을 진행하며 한꺼번에 피드백한다. 7페이즈 완료로 넘기고 백로그로 이월(2026-11-02 재확인)"

### 8. WR-03 낮 시작 문구 결정: src/game/scenes.ts 71·79행 '토론 전에 먼저 직업을 공개해요' / '곧 직업 공개가 시작돼요'
expected: 사라진 직업 공개 단계를 안내하는 문구를 어떻게 바꿀지(deferred-items.md 의 두 안) 사용자가 정한다
result: pass
decision: "2026-11-02 사용자 결정 — PHASE_INTRO.dayAnnounce.sub 문장 삭제(제목 '낮이 되었습니다'만), PHASE_GUIDE_FILL.dayAnnounce.guide → '곧 토론이 시작돼요'. 문구 반영(scenes.ts·scenes.test.ts·scripts/e2e/lib.mjs INTRO_SPEC 등)은 갭 수정 계획에 함께 넣는다"

### 9. 로비 이동 반응 (검사 1 중 사용자 관찰)
expected: 맵을 탭하면 내 캐릭터가 바로 걷기 시작하고, 걷는 중 멈칫하거나 앞으로 튀지 않는다
result: issue
reported: "문제는 없는데 서버가 cloudflare 무료라그런지 움직일때 핑이튀는것처럼 끊기는데 왜그런건가요? / 약간 자연스럽지않고 살짝 멈췄다 움직이는 느낌"
severity: minor

## Summary

total: 9
passed: 5
issues: 1
pending: 0
skipped: 3
blocked: 0

## Deferred Follow-Ups

- test: 5
  idea: "iPhone 로비 5분 채팅 부하 체감·열감 (bots.mjs --count 7 --prod --chat 2) — 모든 개발 뒤 실기기 플레이테스트"
  deferred_at: 2026-11-02
- test: 6
  idea: "?chat-mock=1 다섯 줄 iPhone 실기기 확인(6페이즈 이월 표 D) — 모든 개발 뒤 실기기 플레이테스트"
  deferred_at: 2026-11-02
- test: 7
  idea: "Android Chrome·삼성 인터넷·카카오톡 인앱(iOS·Android) 입력칸 검사 1·2·4 (CHAT-05, 로드맵 성공 기준 3) — 모든 개발 뒤 실기기 플레이테스트"
  deferred_at: 2026-11-02
- test: 9
  idea: "로비 이동 체감 재확인(결정 0059 예측 이동·섞기, 자동 W11·W12 통과) — 모든 개발 뒤 실기기 플레이테스트"
  deferred_at: 2026-11-02

## Gaps

- gap_id: G-07-9
  truth: "맵을 탭하면 내 캐릭터가 바로 걷기 시작하고, 걷는 중 멈칫하거나 앞으로 튀지 않는다"
  status: resolved
  resolved_by: 07-27-PLAN.md
  resolved_at: 2026-11-02
  reason: "User reported: 약간 자연스럽지않고 살짝 멈췄다 움직이는 느낌 (움직일 때 핑이 튀는 것처럼 끊김)"
  severity: minor
  test: 9
  root_cause: "(1) 코드: 내 캐릭터 포함 모든 캐릭터를 서버 구간으로만 그리고(예측 이동 없음, 06-UI-SPEC '예측 이동 금지' 잠금) 구간이 바뀔 때 섞기가 없다 — 탭 뒤 RTT 동안 정지, 응답 첫 프레임에 MOVE_V×RTT/2 앞으로 튐, 걷는 중 방향 전환·남의 전환 때 최대 MOVE_V×RTT 튐. (2) 환경: 한국 클라이언트가 workers.dev 를 Cloudflare LAX 에서 받아 RTT 약 155ms(측정 p50, 서버 처리 0~1ms) — 증폭 요인, 코드로 못 고침"
  artifacts:
    - path: "src/world/runtime.ts"
      issue: "drawFrame 이 store.positionOf(serverNow) 로만 위치를 정함. 탭은 링만 띄우고 내 캐릭터를 움직이지 않음, 구간 교체 시 섞기 없음"
    - path: "src/world/store.ts"
      issue: "applyFrame 이 새 구간으로 즉시 교체"
    - path: "shared/game/world.ts"
      issue: "requestMove 의 t0 = 서버 수신 시각이라 클라이언트 첫 프레임이 이미 RTT/2 앞"
    - path: "src/world/character.ts"
      issue: "걷기/서기 자세·방향 즉시 전환(작은 증폭 요인)"
    - path: ".planning/phases/06-world-skeleton/06-UI-SPEC.md"
      issue: "81·348-360·606·644행 '예측 이동 금지, 출발 300~500ms 정지 허용' 잠금 — 설계대로라 회귀가 아님"
  missing:
    - "구간 교체 때 화면 위치 차이를 100~150ms 에 걸쳐 0으로 줄이는 섞기(내 캐릭터·남 모두), 짧은 자세·방향 섞기"
    - "(결정 0059 채택, 2026-11-02) 탭 즉시 내 캐릭터가 공용 routeFx·BAR_MAP·MOVE_V 로 걷기 시작하고 서버 구간 도착 시 서버 기준으로 맞추는 예측 이동 — 06-UI-SPEC 의 예측 이동 금지 문장에 0059 개정 표시"
    - "막힌 목적지·TOO_SOON 처럼 서버가 조용히 버린 경우 예측 이동을 멈추는 처리(기존 1.5초 응답 없음 경로)"
  debug_session: .planning/debug/lobby-move-hitch.md
