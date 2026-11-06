---
status: diagnosed
trigger: "UAT G-07-9 (Test 9) — 로비 맵에서 움직일 때 핑이 튀는 것처럼 끊기고, 살짝 멈췄다 움직이는 느낌 (iPhone 16 Pro, 배포본 https://minifia-v2.dhplay.workers.dev)"
created: 2026-11-02T00:00:00Z
updated: 2026-11-02T00:00:00Z
goal: find_root_cause_only
audit_acknowledged:
  milestone: v2.0
  at: 2026-11-07
  status: diagnosed
---

## Current Focus

hypothesis: 확정(합성 원인, AND 조건) — (1) 코드/설계: 내 캐릭터도 서버 구간 응답이 올 때까지 움직이지 않고(예측 없음), 새 구간이 오면 옛 구간 위치에서 새 구간 위치로 섞음 없이 즉시 바뀐다. (2) 환경: 한국 클라이언트가 이 배포의 Cloudflare 엣지를 LAX 로 타서 왕복(RTT)이 약 155ms 로 길다. 정지 시간 = RTT, 응답 순간의 튐 = MOVE_V × RTT/2 가 모두 RTT 에 비례한다. 둘 중 하나만 있으면 체감이 작다(RTT 60ms 면 정지 60ms·튐 2px).
test: (a) 실제 shared/game/world.ts 의 requestMove·positionAt 으로 탭 → 서버 수신 → 클라이언트 수신을 모사했다. (b) 배포본에 실제 WebSocket 으로 붙어 ping RTT·move 응답 지연·유휴 뒤 첫 응답·엣지 위치(cf-ray)를 쟀다.
expecting: (완료) RTT 155ms 에서 정지 155ms(+프레임 0~17ms), 서 있다 출발할 때 앞으로 튐 0.14단위, 걷는 중 방향 전환·남의 방향 전환 때 최대 0.28단위(13px대).
next_action: 없음(진단만). 호출자가 사용자에게 "예측 이동 금지" 잠금(06-UI-SPEC) 완화 여부를 확인받은 뒤 갭 수정 계획에서 처리한다.

reasoning_checkpoint:
  hypothesis: "탭 → 첫 걸음 사이 RTT 만큼 캐릭터가 선 채로 있고(예측 없음), 응답이 오면 서버 시각 기준 RTT/2 만큼 이미 걸은 위치로 한 프레임에 튄다. RTT 가 ~155ms 인 것은 이 호스트가 한국에서 LAX 엣지로 연결되기 때문이다."
  confirming_evidence:
    - "runtime.ts drawFrame 은 모든 캐릭터를 store.positionOf(seat, serverNow) 로만 놓는다. 예측·보간·섞기 코드가 없다(runtime.ts:670, store.ts:44)."
    - "world.ts requestMove 는 t0 = 서버 수신 now 로 구간을 만든다. 클라이언트가 응답을 받는 순간 추정 서버 시각은 t0 + RTT/2 이므로 첫 프레임은 이미 v×RTT/2 앞이다(모사 [A]: RTT155 → 0.140 단위)."
    - "배포본 실측: ping RTT p50 155ms(min 148, p90 164), move 탭→move 프레임 p50 156ms, TCP connect 136~162ms, cf-ray 가 모두 -LAX, 같은 Mac 에서 cloudflare.com 은 ICN·connect 12ms."
    - "서버 처리 시간은 무시할 수준: move 응답 p50(156) ≈ ping p50(155). 유휴 5·12·25·45초 뒤 첫 응답 155~172ms 로 콜드스타트/하이버네이션 지연 없음."
  falsification_test: "예측 없이도 RTT 가 60ms 아래인 환경(예: 같은 지역 엣지·로컬 wrangler dev)에서 같은 탭을 했을 때 여전히 끊겨 보이면 이 가설은 틀린 것이다. 반대로 iPhone 에서 탭→링 표시 후 캐릭터 출발까지를 120fps 화면 녹화로 재면 170~200ms 가 나와야 한다."
  fix_rationale: "(진단만 하므로 수정 안 함) 원인이 'RTT 동안 정지 + 응답 순간 순간이동' 이므로 증상 완화는 예측 시작(RTT 은닉) + 구간 교체 시 위치 차이를 100~150ms 에 걸쳐 풀어 주는 섞기(오프셋 감쇠)다. 네트워크 경로 자체(LAX)는 코드로 못 바꾼다."
  blind_spots: "iPhone 의 실제 RTT·지터(LTE/5G 면 더 큼)는 못 쟀다 — 측정은 같은 한국 ISP 의 Mac 이다. 프레임 시간(60→30fps 저전력 모드, GC, 렌더 hitch)이 섞였을 가능성은 실기기 프로파일 없이 배제 못 한다(UAT 5 가 이월됨). 무료 플랜이 LAX 라우팅의 '원인'이라는 인과는 공식 근거 없이 정황(커뮤니티 보고)뿐이다."
  candidate_causes:
    - "code: 예측 없음 + 구간 교체 시 섞기 없음(확정, 주원인)"
    - "environment: 한국→Cloudflare LAX 엣지 라우팅으로 RTT ≈155ms(확정, 증폭 조건)"
    - "environment: DO 콜드스타트/하이버네이션, 저장 쓰기(output gate)로 응답 지연(기각 또는 미미: 아래 Eliminated)"
    - "code: 시계 오프셋 재추정 계단(기각: 접속 직후·복귀 때만 재추정)"
    - "environment(device): 프레임 hitch(미확인 — 배제 못 함)"
  and_gate: "yes — 정지/튐의 크기는 (RTT 에 결합된 구조) × (RTT 가 큼) 이 모두 있어야 체감된다. root_cause 는 두 조건의 합."

## Symptoms

<!-- 오케스트레이터가 채워 줌 — 불변 -->

expected: 맵을 탭하면 내 캐릭터가 바로 걷기 시작하고, 걷는 중 멈칫하거나 앞으로 튀지 않는다
actual: (사용자 원문) "문제는 없는데 서버가 cloudflare 무료라그런지 움직일때 핑이튀는것처럼 끊기는데 왜그런건가요? / 약간 자연스럽지않고 살짝 멈췄다 움직이는 느낌"
errors: 없음
reproduction: .planning/phases/07-free-chat/07-UAT.md Test 9 (iPhone 16 Pro Safari, 배포본 로비 맵 탭)
started: 7페이즈 UAT 중 발견 (이동 자체는 6페이즈 산출물)

## Eliminated

- hypothesis: Durable Object 콜드스타트/하이버네이션 깨어남이 첫 탭을 늦춘다 (무료 플랜 의심 1)
  evidence: 배포본에서 5·12·25·45초 유휴 뒤 첫 ping RTT 가 172·156·157·155ms 로 평소(p50 155)와 같다. 깨어남 비용이 보이지 않는다.
  timestamp: 2026-11-02

- hypothesis: 서버 처리·CPU 한도(무료 플랜)가 move 응답을 늦춘다 (무료 플랜 의심 2)
  evidence: move 탭→move 프레임 p50 156ms ≈ ping p50 155ms (두 번 측정, n=20·70). 서버가 더하는 시간은 1ms 안팎이다. 90퍼센타일 172ms, 최대 217ms.
  timestamp: 2026-11-02

- hypothesis: 시계 오프셋(estimateOffset)이 시간이 지나며 계단식으로 바뀌어 모두가 튄다
  evidence: useRoomConnection.ts — 표본은 접속 직후 3개와 checkAlive(화면 복귀·online)에서만 추가된다(clock.ts min-RTT). 걷는 도중 주기적 재추정은 없다. 접속 직후 첫 pong 이 거친 값(view.serverNow − Date.now())을 바꿀 때 한 번(약 0.14단위) 튀는 것은 입장 직후 1회성이다.
  timestamp: 2026-11-02

- hypothesis: move 프레임 수신이 React 재렌더(WorldStage·RoomScreen)를 일으켜 메인 스레드를 막는다
  evidence: WorldStore.applyFrame 은 notify() 만 하고, 제품 코드에서 WorldStore.subscribe 구독자가 없다(useChat 의 subscribe 는 채팅 저장소). 위치는 rAF 루프가 직접 읽는다.
  timestamp: 2026-11-02

- hypothesis: 서버가 150ms 속도 제한(TOO_SOON)으로 탭을 버려 멈춘 것처럼 보인다
  evidence: 클라이언트 TAP_MIN_GAP_MS = 250ms(input.ts)가 서버 MOVE_MIN_GAP_MS 150ms 위에 여유 100ms 를 둔다. 실측 지터 p90−p50 ≈ 16ms 라 걸리지 않는다. 걸리면 1.5초 뒤 '연결이 불안정해요' 토스트가 뜨는데 사용자는 문제 없다고 보고했다.
  timestamp: 2026-11-02

## Evidence

- timestamp: 2026-11-02
  checked: 지식 베이스 (.planning/debug/knowledge-base.md)
  found: 파일 없음 (해결된 세션 기록이 아직 없다)
  implication: 이미 아는 패턴 후보 없음. 일반 순서로 진행.

- timestamp: 2026-11-02
  checked: src/world/runtime.ts drawFrame(670~705), tap(819~832), updateRing(525~555); src/world/store.ts positionOf/applyFrame; WorldStage.tsx onTap(170~180)
  found: 내 캐릭터 위치도 store.positionOf(mySeat, Date.now()+offset) 하나로만 정해진다. 탭은 링만 띄우고(runtime.tap) move 를 보낸다. 서버 구간이 store 에 들어오는 순간 같은 프레임에서 위치가 새 구간 값으로 바뀐다. 방향(yaw)도 프레임 간 위치 차로 즉시 바뀐다(runtime.ts:681). 보간·섞기·오프셋 감쇠 코드는 없다.
  implication: 탭 → 응답(RTT) 동안 정지, 응답 순간 위치 불연속. 걷는 도중 새 탭이나 남의 방향 전환도 같은 식으로 즉시 교체된다.

- timestamp: 2026-11-02
  checked: shared/game/world.ts requestMove(131~157), interpFx(40~63), positionAt(66)
  found: 서버는 자기 수신 시각 now 를 t0 로 하고 from = positionAtFx(cur, now) 에서 새 경로를 만든다(v = MOVE_V = 180 → 1.8 단위/초). 클라이언트는 같은 positionAt 으로 추정 서버 시각에 평가한다.
  implication: 클라이언트가 응답을 받는 순간 추정 서버 시각 = t0 + (d_down + e), e = 오프셋 표본 비대칭 오차. 같은 비대칭이면 RTT/2. 따라서 응답 순간 첫 프레임이 이미 v×RTT/2 만큼 앞이다.

- timestamp: 2026-11-02
  checked: 모사 (scratchpad/sim/sim.ts — 실제 world.ts·map.ts·camera.ts groundToScreen 번들)
  found: |
    [A] 서 있다가 탭 (RTT → 정지 / 첫 프레임 튐 단위·px)
      60ms→60ms/0.054·1.8px · 100→100/0.090·3.1px · 155→155/0.140·4.8px · 250→250/0.225·7.7px · 400→400/0.360·12.3px
      (px 는 화면 위쪽 대각 방향 기준. 화면 가로 방향이면 같은 거리가 약 1.7배 크다)
    [B] 걷는 중 새 탭 또는 남의 방향 전환 때 응답 순간 이동 거리 (90도 / 180도, 단위·px)
      100→0.127·7.4 / 0.179·8.8 · 155→0.199·11.6 / 0.278·13.7 · 250→0.323·18.8 / 0.449·22.2 · 400→0.518·30.1 / 0.719·35.5
  implication: 정지 시간은 RTT 그대로(UI-SPEC E3 가 허용한 300~500ms 안의 값). 튐은 RTT 155ms 에서 작지만(5~14px) RTT 250ms+ 면 눈에 띈다. 사용자의 '살짝 멈췄다 움직이는' 은 [A] 의 정지, '튀는 것처럼' 은 [A]·[B] 의 불연속이다.

- timestamp: 2026-11-02
  checked: 배포본 실측 (scratchpad/measure/measure.mjs, measure2.mjs — 이 Mac, 한국 ISP, cloudflare.com/cdn-cgi/trace colo=ICN loc=KR)
  found: |
    ping RTT: n=20 min 148 / p50 155 / p90 164 / max 166 ms (두 번째 12회: 148/155/160/161)
    move 탭 → 내 move 프레임: n=20 p50 156 / p90 172 / max 214, n=70 p50 156 / p90 172 / max 217, 190ms 초과 3/70
    frame.t0 − (보낸 때 추정 서버시각) p50 77ms (= 업링크 한 방향 ≈ RTT/2)
    유휴 5/12/25/45초 뒤 첫 ping: 172/156/157/155 ms
    방 만들기 HTTP 936~952ms, ws 열림 → 첫 state 807~849ms (입장 1회성)
  implication: 서버 처리·콜드스타트는 원인이 아니다. 지연 대부분이 순수 네트워크 왕복이다. 저장 쓰기(2초 디바운스 flush)와 겹칠 때의 output gate 지연은 +40~60ms 꼬리가 약 4%(3/70)에 있다 — 미미한 보조 요인.

- timestamp: 2026-11-02
  checked: 엣지 위치 (curl cf-ray, 연결 시간, dig)
  found: |
    minifia-v2.dhplay.workers.dev → cf-ray 꼬리 -LAX (4회 모두), TCP connect 136~162ms, 응답 IP 172.67.216.54 / 104.21.35.84
    같은 Mac 에서 www.cloudflare.com·cloudflare-dns.com → -ICN, connect 12~20ms
    ws ping RTT(155) ≈ TCP connect(136~162) → DO 가 엣지와 같은 곳(LAX)에 있어 엣지→DO 추가 구간이 없다
  implication: 사용자의 '핑이 튄다'는 느낌은 근거가 있다 — 이 호스트는 한국에서 LAX 엣지로 서빙된다. '무료 플랜 때문' 인과는 직접 증명 못 했다(웹 검색: 한국발 무료 플랜 트래픽의 LAX 라우팅이 커뮤니티에서 널리 보고되나 Cloudflare 공식 문서 확인 없음, Pro/Argo 로 개선됐다는 일화). 서버 컴퓨팅 성능 문제가 아니라 경로 문제다.

- timestamp: 2026-11-02
  checked: 06-UI-SPEC.md (81, 348~360, 470, 606, 644), 06-RESEARCH.md (50, 98, 472), research/ARCHITECTURE.md (159~160), docs/decisions 전체 grep
  found: |
    - '예측 이동 금지' 는 결정 0044-17 이 아니라 06-UI-SPEC 의 잠금/쓰지 않을 것에 있다. 0044-17 원문은 "클라이언트는 목적지만 보내고 서버가 경로를 정해 구간으로 보낸다. 위치 스트림·서버 틱은 두지 않는다." 뿐이고 docs/decisions 에 '예측' 금지 문장은 없다. runtime.ts 1~2행 주석과 store.ts 주석의 "(결정 0044-17)" 인용은 UI-SPEC 의 확장 해석이다.
    - UI-SPEC 상호작용 5·E3: 탭 → 출발 '보통 300ms, 최대 500ms' 를 허용하고 '그 사이 캐릭터는 가만히 있다' 로 못 박았다. 이번 UAT 기대(바로 걷기 시작·멈칫 없음)는 이 허용치보다 엄격하다.
    - research/ARCHITECTURE.md 159~160 은 원래 '내 탭 즉시 예측 이동' 과 '남의 새 구간은 100~150ms 섞기(RTT/2 앞섬 상쇄)' 를 권고했다. 둘 다 구현되지 않았다(06-UI-SPEC 이 예측을 잠갔고 섞기는 계획에 안 들어감).
    - 06-RESEARCH 472: 오프셋 비대칭 ±수십~100ms 와 '구간 시작에 가속 램프(약 150ms)' 완화를 팀 확인 뒤 판단으로 남겼다.
  implication: 현재 동작은 설계대로다(회귀 아님). 갭은 '설계가 허용한 RTT 정지·불연속' 이 RTT 155ms+ 환경에서 사용자에게 부자연스럽다는 것이다.

- timestamp: 2026-11-02
  checked: input.ts TAP_MIN_GAP_MS(250)·runtime.ts MOVE_ACK_TIMEOUT_MS(1500)·ACK_SLACK_MS(1000)
  found: 탭 간격 250ms 는 서버 150ms 위 여유 100ms 라 실측 지터에서 TOO_SOON 에 안 걸린다. 1.5초 응답 없음 타임아웃도 RTT 155ms 에서는 안 걸린다. 두 값은 정지·튐에 기여하지 않는다. (곁다리: updateRing 은 g.acked 가 true 면 다시 ack 하지 않아, RTT 가 탭 간격 250ms 보다 큰 환경에서 두 번째 탭의 링이 첫 탭의 목적지에 붙을 수 있다 — 정지·튐 원인은 아니고 RTT ≥ 250ms 에서만 보이는 별건.)
  implication: 두 상수는 원인이 아니다.

- timestamp: 2026-11-02
  checked: character.ts update/setYaw(845~862), runtime.ts camera followStep(710~712), camera.ts FOLLOW_TAU_MS(33)
  found: 걷기↔서기 자세 전환과 yaw 는 보간 없이 즉시 바뀐다(walkPose/idlePose 즉시 선택, root.rotation.y = yaw). 카메라는 τ≈152ms 지수 감쇠라 부드럽고 정상 걷기에서 정상 상태 지연은 v·τ ≈ 0.27단위.
  implication: 위치 불연속이 있을 때 자세·방향이 같이 즉시 바뀌어 '끊김' 인상을 키운다(보조). 카메라는 원인이 아니다.

## Resolution

root_cause: |
  합성 원인(두 조건이 함께 있어야 체감된다).
  (1) 코드/설계 — 로비 이동은 '예측 없음 + 구간 교체 시 섞기 없음' 이다. 내 캐릭터는 탭 후 서버 구간(move 프레임)이 올 때까지 가만히 서 있고(runtime.ts drawFrame 은 store.positionOf 만 쓴다), 구간이 오면 서버 수신 시각 t0 기준으로 이미 RTT/2 만큼 걸은 위치(v×RTT/2)로 한 프레임에 건너뛴다. 걷는 중 새 탭이나 다른 사람의 방향 전환도 옛 구간 위치에서 새 구간 위치로 섞음 없이 즉시 바뀐다(최대 v×RTT). 이것은 06-UI-SPEC 의 '예측 이동 금지·출발 300~500ms 허용' 잠금 그대로의 동작이고 결정 0044-17 자체가 예측을 금지한 것은 아니다(research/ARCHITECTURE.md 는 원래 예측+섞기를 권고했다).
  (2) 환경 — 이 배포(minifia-v2.dhplay.workers.dev)는 한국 클라이언트에게 Cloudflare LAX 엣지로 서빙되어 왕복이 약 155ms(안정, p90 164)이고 DO 도 엣지와 같은 곳이라 서버 처리 시간은 ≈0 이다. 그래서 정지 ≈ 155ms(+프레임 0~17ms), 서 있다 출발할 때 튐 0.14단위, 방향 전환 튐 최대 0.28단위(약 5~14px)가 된다. iPhone 셀룰러면 더 크다. '무료 플랜' 의심은 부분적으로 맞다 — 서버 성능이 아니라 한국→LAX 경로 때문이다(무료 플랜이 원인이라는 인과는 정황 근거뿐).
fix: (진단만 — 적용 안 함)
verification: (진단만 — 모사와 배포본 실측으로 원인과 크기를 확인했고 수정 검증은 하지 않았다)
files_changed: []
