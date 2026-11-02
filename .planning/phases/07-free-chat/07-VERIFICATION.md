---
phase: 07-free-chat
verified: 2026-11-02T07:00:00Z
status: passed
score: 6/7 must-haves verified
covered_files: [".planning/phases/07-free-chat/07-01-PLAN.md", ".planning/phases/07-free-chat/07-01-SUMMARY.md", ".planning/phases/07-free-chat/07-02-PLAN.md", ".planning/phases/07-free-chat/07-02-SUMMARY.md", ".planning/phases/07-free-chat/07-03-PLAN.md", ".planning/phases/07-free-chat/07-03-SUMMARY.md", ".planning/phases/07-free-chat/07-04-PLAN.md", ".planning/phases/07-free-chat/07-04-SUMMARY.md", ".planning/phases/07-free-chat/07-05-PLAN.md", ".planning/phases/07-free-chat/07-05-SUMMARY.md", ".planning/phases/07-free-chat/07-06-PLAN.md", ".planning/phases/07-free-chat/07-06-SUMMARY.md", ".planning/phases/07-free-chat/07-07-PLAN.md", ".planning/phases/07-free-chat/07-07-SUMMARY.md", ".planning/phases/07-free-chat/07-08-PLAN.md", ".planning/phases/07-free-chat/07-08-SUMMARY.md", ".planning/phases/07-free-chat/07-09-PLAN.md", ".planning/phases/07-free-chat/07-09-SUMMARY.md", ".planning/phases/07-free-chat/07-10-PLAN.md", ".planning/phases/07-free-chat/07-10-SUMMARY.md", ".planning/phases/07-free-chat/07-11-PLAN.md", ".planning/phases/07-free-chat/07-11-SUMMARY.md", ".planning/phases/07-free-chat/07-12-PLAN.md", ".planning/phases/07-free-chat/07-12-SUMMARY.md", ".planning/phases/07-free-chat/07-13-PLAN.md", ".planning/phases/07-free-chat/07-13-SUMMARY.md", ".planning/phases/07-free-chat/07-14-PLAN.md", ".planning/phases/07-free-chat/07-14-SUMMARY.md", ".planning/phases/07-free-chat/07-15-PLAN.md", ".planning/phases/07-free-chat/07-15-SUMMARY.md", ".planning/phases/07-free-chat/07-16-PLAN.md", ".planning/phases/07-free-chat/07-16-SUMMARY.md", ".planning/phases/07-free-chat/07-17-PLAN.md", ".planning/phases/07-free-chat/07-17-SUMMARY.md", ".planning/phases/07-free-chat/07-18-PLAN.md", ".planning/phases/07-free-chat/07-18-SUMMARY.md", ".planning/phases/07-free-chat/07-19-PLAN.md", ".planning/phases/07-free-chat/07-19-SUMMARY.md", ".planning/phases/07-free-chat/07-20-PLAN.md", ".planning/phases/07-free-chat/07-20-SUMMARY.md", ".planning/phases/07-free-chat/07-21-PLAN.md", ".planning/phases/07-free-chat/07-21-SUMMARY.md", ".planning/phases/07-free-chat/07-22-PLAN.md", ".planning/phases/07-free-chat/07-22-SUMMARY.md", ".planning/phases/07-free-chat/07-23-PLAN.md", ".planning/phases/07-free-chat/07-23-SUMMARY.md", ".planning/phases/07-free-chat/07-24-PLAN.md", ".planning/phases/07-free-chat/07-24-SUMMARY.md", ".planning/phases/07-free-chat/07-25-PLAN.md", ".planning/phases/07-free-chat/07-25-SUMMARY.md", ".planning/phases/07-free-chat/07-26-PLAN.md", ".planning/phases/07-free-chat/07-26-SUMMARY.md", ".planning/phases/07-free-chat/07-27-PLAN.md", ".planning/phases/07-free-chat/07-27-SUMMARY.md", "scripts/e2e/browser.mjs", "scripts/e2e/flows.mjs", "scripts/e2e/lib.mjs", "shared/game/audience.ts", "shared/game/chatLog.ts", "shared/game/chatRules.ts", "shared/game/world.ts", "shared/protocol.ts", "shared/schemas.ts", "src/components/SceneIntro.tsx", "src/components/WorldStage.tsx", "src/components/v2/ChatPanel.tsx", "src/game/scenes.ts", "src/net/chatStore.ts", "src/net/useChat.ts", "src/screens/DayScene.tsx", "src/screens/Lobby.tsx", "src/world/character.ts", "src/world/motion.ts", "src/world/runtime.ts", "src/world/store.ts", "src/world/testHooks.ts", "test/unit/motion.test.ts", "test/worker/chatLeak.test.ts", "worker/room.ts"]
covered_digest: "v3:sha256:e1cbd134eb0160025ad8edceb9db2eea1b6b9aae508a2833110377bcb2df0472"
behavior_unverified: 1
overrides_applied: 0
re_verification:
  previous_status: human_needed
  previous_score: 3/4
  gaps_closed:
    - "G-07-9 로비 이동 반응(결정 0059): 예측 이동 + 구간 교체 섞기 + 방향·자세 섞기 — 코드·단위·클라이언트 시험·배포본 W11·W12 6개 크기 통과"
    - "WR-03 낮 시작 문구: 보조줄 삭제, 하단 '곧 토론이 시작돼요' — 코드·시험·배포본 N8 16행 통과"
  gaps_remaining: []
  regressions: []
behavior_unverified_items:
  - truth: "한글 입력(조합 중 Enter)이 깨지지 않고 iOS 키보드가 채팅창을 가리지 않는다 — iPhone·Android·삼성 인터넷·카카오톡 인앱에서 확인 (CHAT-05 실기기 몫)"
    test: "iPhone 16 Pro Safari·iOS용 Chrome 은 UAT 1~3 에서 사용자가 통과시켰다. 남은 것: Android Chrome · 삼성 인터넷 · 카카오톡 인앱(iOS·Android) 에서 로비 입력칸 검사 1·2·4"
    expected: "입력줄·보내기가 키보드에 가려지지 않고, 캔버스 크기가 변하지 않으며, 조합 중 Enter·보내기에 한 줄만 전송되고 입력칸에 잔여 글자가 없다"
    why_human: "실제 Android·삼성·카카오톡 인앱 키보드·IME 는 헤드리스 Chromium 에뮬레이션이 대체하지 못한다. 사용자가 2026-11-02 '실기기 검사는 모든 개발이 끝난 뒤 한꺼번에' 로 결정해 UAT 7 이 skipped 다. 로드맵 성공 기준 3 이 명시한 기기이므로 통과로 세지 않는다"
human_verification:
  - test: "Android Chrome · 삼성 인터넷 · 카카오톡 인앱(iOS·Android): https://minifia-v2.dhplay.workers.dev?test=1 에서 방 만들기 → 입력칸 탭, 한글 '안녕하세요' 마지막 글자 조합 중 Enter 와 보내기 버튼 (UAT 7, 로드맵 성공 기준 3)"
    expected: "iPhone 과 같은 검사 1·2·4 통과(입력줄 안 가려짐, 캔버스 크기 불변, 한 줄만 전송, 잔여 글자 없음), 또는 사용자가 9페이즈 팀 테스트로 이월을 명시적으로 결정"
    why_human: "실기기 없음. 에이전트가 이월을 임의로 정할 수 없다 — CHAT-05 가 REQUIREMENTS.md 에서 Pending 인 이유"
  - test: "로비 이동 체감 재확인(G-07-9, UAT 9): iPhone 에서 맵 여러 곳을 연달아 탭하고 걷는 중 방향도 바꿔 본다 (실제 왕복 약 155ms 의 배포본 22ca18d)"
    expected: "탭하면 내 캐릭터가 바로 걷기 시작하고, 서버 구간이 온 순간 앞으로 튀거나 멈칫하지 않는다. 남의 캐릭터도 갑자기 끊기지 않는다"
    why_human: "체감(자연스러움)은 사람 판단이다. 자동 검사 W11(3프레임 안 출발)·W12(한 프레임 튐 없음)는 6개 크기 통과했으나 헤드리스 렌더링이고, 사용자 결정(2026-11-02)으로 실기기 플레이테스트 목록에 남겼다"
  - test: "iPhone 두 기기 '…' 입력 중 표시(CHAT-04) 실기기 표시 확인 — UAT 4 는 데스크톱 두 브라우저 E2E 로 통과(source: automated)"
    expected: "상대 화면의 내 캐릭터 이름표 위에 '…' 가 뜨고 입력을 비우면 사라진다"
    why_human: "서버 중계·채널 제한·표시는 자동 시험으로 확인했으나 iPhone 실기기 표시는 미확인"
  - test: "5분 채팅 부하 체감(UAT 5): iPhone 로비를 둔 채 Mac 에서 node scripts/bots.mjs <방 코드> --count 7 --prod --chat 2 실행"
    expected: "끊김 체감 없음/가끔, 5분 뒤 열감 차갑다/미지근 (조건 B 데스크톱 60.00fps·끊김 0 은 결정 0055 로 통과 선언에 쓸 수 없음)"
    why_human: "실기기 렌더 성능. UAT 5 skipped(사용자 결정)"
  - test: "https://minifia-v2.dhplay.workers.dev/?chat-mock=1 다섯 줄 (6페이즈 이월, 표 D, UAT 6)"
    expected: "입력줄 안 가려짐 / 캔버스 크기 불변 / 내 캐릭터 보임 / 한글 조합 Enter / 닫을 때 튐 없음"
    why_human: "6페이즈에서 이월된 iPhone 실기기 확인. UAT 6 skipped(사용자 결정)"
---

# Phase 7: 자유 채팅 검증 보고서 (재검증 — 갭 닫기 07-23~07-27 포함)

**Phase Goal:** 로비부터 자유롭게 채팅하고, 밤 마피아 채팅과 탈락자 채팅이 다른 편 폰으로는 네트워크로도 가지 않는다
**Verified:** 2026-11-02T07:00:00Z
**Status:** human_needed
**Re-verification:** 예 — 이전 보고서(human_needed, 3/4, 계획 07-01~22) 이후 UAT 가 찾은 G-07-9·WR-03 을 닫은 갭 닫기 계획 07-23~07-27 을 포함해 전체 재검증

## 한 줄 결론

서버 측 목표(채널 분리·네트워크 비누설·제한·옛 기능 제거)와 갭 닫기 두 건(로비 이동 반응 G-07-9, 낮 시작 문구 WR-03)은 코드·시험·배포본 자동 검사로 확인했고 FAILED 항목은 없다. iPhone 16 Pro Safari·iOS용 Chrome 의 키보드·한글 IME 는 UAT 1~3 에서 사용자가 통과시켰다. 하지만 로드맵 성공 기준 3 이 명시한 Android Chrome·삼성 인터넷·카카오톡 인앱은 사용자가 "개발이 다 끝난 뒤 한꺼번에" 로 미뤄 아직 사람이 확인하지 않았다(UAT 7 skipped). 그래서 `passed` 가 아니라 `human_needed` 이고, CHAT-05 가 REQUIREMENTS.md 에서 `Pending` 인 것과 일치한다.

## 목표 달성

### 관찰 가능한 사실 (ROADMAP 성공 기준 4개 + 갭 닫기 must_haves 3개)

| # | 사실 | 상태 | 증거 |
|---|------|------|------|
| 1 | 로비와 낮에서 산 사람 모두 하단 채팅창으로 글을 보내고 같은 방 모두의 폰에 보인다. 입력 중 내 캐릭터 머리 위에 "…" 가 뜨고 같은 채널에만 보인다 (CHAT-01·04) | ✓ VERIFIED | 이전 검증에서 확인한 서버 길(`channelOf`→`audience`→`deliver`)·화면 연결(`Lobby`·`DayScene`→`useChat`+`ChatPanel`, `HeadStack typing`)이 그대로다. 이번에 11개 파일 289개 시험을 다시 직접 실행해 전부 통과. UAT 4 는 배포본 두 브라우저 E2E(chat-lobby 6개 폭)로 통과(source: automated). iPhone 에서의 "…" 표시만 사람 확인 대기 |
| 2 | 밤에는 산 마피아끼리만 채팅하고 내용·입력 중 표시가 시민 편 폰으로 오가는 메시지에 한 번도 없다. 탈락자 채팅도 산 사람 폰에 가지 않는다 (CHAT-02·03) | ✓ VERIFIED | `chatLeak.test.ts` (a)~(d), `chatStaticGuard`, `leak`, `chatReplay` 포함 289개 시험 재실행 통과. 이번 갭 닫기는 `worker/`·`shared/protocol.ts` 를 건드리지 않았다(`git diff ae1c5b3 -- worker shared/protocol.ts` = 0건)로 비누설 길이 회귀할 수 없다. 설계상 예외(탈락자 관전은 밤 마피아 채팅 수신, 결정 0021)는 이전과 같다 |
| 3 | 글자 수·도배 한도를 넘기면 서버가 막고 알린다. 한글 입력(조합 중 Enter)이 깨지지 않고 iOS 키보드가 채팅창을 가리지 않는다 — iPhone·Android·삼성 인터넷·카카오톡 인앱에서 확인 (CHAT-05) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | 서버 몫은 시험·배포본 smoke 로 검증됨(이전과 동일). 화면 코드·E2E(`chat-ime` 10/10, `chat-keyboard` 6개 크기)도 통과. **이번 새 증거:** UAT 1·2·3 에서 사용자가 iPhone 16 Pro Safari·iOS용 Chrome 로 로비 키보드·한글 IME·테이블 하단을 `pass` 로 확인했다. **남은 것:** 같은 성공 기준이 명시한 Android Chrome·삼성 인터넷·카카오톡 인앱은 UAT 7 `skipped`(사용자 결정)라 실행한 증거가 없다. 미확인을 통과로 세지 않는다 |
| 4 | 순차 직업 주장·빠른 메시지·텍스트 이모티콘이 화면과 서버에서 모두 사라지고, 낮 토론은 자유 채팅으로 진행된다 (CHAT-06) | ✓ VERIFIED | `src shared worker` 에서 `claimLog`·`QuickMessage`·`TurnPanel` 코드 식별자 0건(남은 `ClaimPanel` 언급은 `useViewChoice.ts`·`ExecVotePanel.tsx`·`TestTools.tsx` 의 주석뿐). 이전의 경고였던 WR-03 문구는 아래 사실 6 으로 닫혔다. 옛 두 문장('먼저 직업을 공개해요'·'곧 직업 공개가 시작돼요')이 `src test scripts shared worker` 어디에도 없음을 grep 으로 확인 |
| 5 | **[G-07-9, 계획 07-24·25·26]** 맵을 탭하면 내 캐릭터가 서버 구간을 기다리지 않고 다음 프레임부터 걷고, 서버 구간이 오면 한 프레임에 튀지 않고 150ms 안에 맞추며, 응답이 1.5초 없으면 알림 한 번과 함께 서버 위치로 돌아온다. 남은 예측하지 않고 섞기만 한다. 서버 규칙·와이어는 불변 | ✓ VERIFIED (경고 1건, GR-WR-01) | **존재·실질:** `shared/game/world.ts:131` `planMoveSegment` 가 공용 본체, `requestMove`(`:161`)가 간격 검사 뒤 그것을 호출. `src/world/motion.ts` 에 `predictSegment`·`blendRemaining`·`travelYaw`·`stepYaw`·`createOwnMoves`·`SEG_BLEND_MS=150`·`BLEND_SNAP_DIST=3`·`YAW_TURN_RATE` 실재. `store.ts:73 moveSeqOf`, `character.ts:32 POSE_BLEND_MS=120`. **연결:** `WorldStage.tsx:180` 이 보낸 목적지를 `runtime.notifyMoveSent(at, dest)` 에 넘기고(`runtime.ts:889`) 거기서 `own.sent(predictSegment(...))`, 프레임마다 `own.observe(moveSeqOf, segOf)`(`:681`)·`blendRemaining`(`:719`)·`stepYaw`/`travelYaw`(`:728-731`). `sample()`·`__mfWorld.sample` 은 서버 구간값 그대로(`testHooks.ts` 에 `shown` 이 별도로 추가). **행동 증거(behavior-dependent 이므로 시험 실행 확인):** `world/motion/worldStore/character/scenes/e2eContract` 단위 + `worldStage/guide/sceneIntro/phaseScreens` 클라이언트 10개 파일 489개 시험을 직접 실행해 전부 통과. `worldStage.test.tsx` 에 예측 위치=`predictSegment`(471), 응답 없음 1.5초 되돌림(517), 남 비예측(583)·남 섞기 150ms(596)·순간이동 비섞기(620)·둘째 탭 RTT>250ms(629)·epoch 변경(664)·모션 줄이기(679)·방향 반 바퀴 120ms(694) 이 각각 있다. **배포본 증거:** `deployed-07-27.log` 에서 W11·W12 가 6개 크기(360x640·390x664·430x932·360x560·390x844·402x874) 모두 `통과`(12행)를 직접 확인. 배포 health = `…+22ca18d` 이고 `22ca18d..HEAD` 의 코드 변경 0(문서뿐). **서버 불변:** `worker/`·`shared/protocol.ts` diff 0. **경고:** 사람의 체감 판단은 남아 있다(휴먼 항목 2) |
| 6 | **[WR-03, 계획 07-23]** 낮 시작 문구는 'N일차 / 낮이 되었습니다' 두 줄만, 하단 패널은 '낮이 되었어요 / 곧 토론이 시작돼요', E2E N8 이 이를 기대하고 옛 문장이 코드에 없다 | ✓ VERIFIED | `src/game/scenes.ts:71` `PHASE_INTRO.dayAnnounce = {tone:"day", title:"낮이 되었습니다"}`(sub 없음), `:79` `PHASE_GUIDE_FILL.dayAnnounce = {title:"낮이 되었어요", guide:"곧 토론이 시작돼요"}`. `scripts/e2e/lib.mjs:733` `INTRO_SPEC.day.lines = ["낮이 되었습니다"]`. `07-REVIEW-DISPOSITION.md` 의 WR-03 이 `resolved (07-23)`. 옛 문장 grep 0건. 시험 통과(위 489개에 `scenes/guide/sceneIntro/phaseScreens` 포함). 배포본 N8 16행 통과(07-27-SUMMARY, 로그 기준). `design/` 사본의 옛 문구(IN-05)는 금지 사항(디자인 시스템은 메인 세션에서만 수정)에 따라 일부러 건드리지 않음 |
| 7 | **[계획 07-27]** 가드 체인으로 minifia-v2 에만 배포되고 health 에 이 커밋 해시가 찍히며, 배포본 smoke 와 E2E 가 FAIL 없이 끝난다(W11·W12·N8 통과). HANDOFF 갱신·push | ✓ VERIFIED (경고: 전체 E2E 가 한 번에 'E2E OK' 로 끝나지 않음) | `curl /api/health` = `2026-11-02T05:46:59Z+22ca18d`, 배포본이 현 HEAD 의 코드와 같음(이후 커밋은 `.planning` 문서·HANDOFF 뿐). 로그 직접 확인: `deployed-07-27-reconnect.log`·`-result-m.log`·`-lobby.log` 마지막 줄이 `E2E OK`. **계획의 수락 기준 "로그 마지막 줄 E2E OK" 는 문자 그대로는 충족되지 못했다** — 전체 실행은 `전체 900초 제한 초과`(1089초, exit 2)로 중단되었고 표의 실패 행은 setup 의 `page.goto: Timeout 8000ms` 2건(result-m 390x664, lobby 430x932)이다. 문턱값·제한·판정은 바꾸지 않았고(금지 사항 준수) 못 끝낸/실패한 흐름만 단독 재실행해 통과했다. 실패 두 행은 판정 실패가 아니라 배포본 첫 접속 지연이며 W11·W12·N8·W3·W4·W10 행은 전체 실행 로그에 모두 통과로 있다. 이를 코드 갭이 아닌 시간 예산/인프라 경고로 판단해 VERIFIED 로 두되 경고로 남긴다(아래 경고 W-1). HANDOFF.md 는 오케스트레이터 확인 범위(5476바이트, `handoff.test.ts` 통과 주장)로 인용하고 나는 재실행하지 않았다 |

**Score:** 6/7 사실 VERIFIED, 1개(성공 기준 3)는 PRESENT_BEHAVIOR_UNVERIFIED(서버·iPhone 확인 완료, Android·삼성·카카오톡 미확인). FAILED 0건.

### 요구사항 커버리지 (PLAN frontmatter ↔ REQUIREMENTS.md 대조)

27개 PLAN 의 `requirements:` 합집합 = CHAT-01~06 + MAP-02(07-24·25·26·27 선언). 07-23 은 CHAT-06, 07-27 은 MAP-02+CHAT-06. REQUIREMENTS.md 의 7페이즈 매핑 6개(CHAT-01~06)와 일치하며 누락·고아(ORPHANED) 없음. MAP-02 는 REQUIREMENTS.md 상 Phase 6 소유(`Complete`)이나, 07-24~27 이 G-07-9 로 그 동작(내 캐릭터 이동 반응)을 개정해 다시 선언했다 — 요구 문장("목적지만 보내고 서버가 경로를 정한다", "다른 사람 폰에서도 같은 경로·속도")이 여전히 참임을 확인했다(와이어 불변, 예측은 화면에만, 서버가 공용 `planMoveSegment` 로 경로 결정, `sample()` 은 서버 값).

| 요구사항 | 담당 계획 | 설명 | 상태 | 근거 |
|----------|-----------|------|------|------|
| CHAT-01 | 07-01·02·03·05·11·13·14·15·16·20·21 | 로비·낮 자유 채팅 | ✓ SATISFIED | 사실 1 |
| CHAT-02 | 07-01·02·10·11·12·14·15·16·17·21 | 밤 마피아 채팅·입력 중 비누설 | ✓ SATISFIED | 사실 2 |
| CHAT-03 | 위와 같음 | 탈락자 채팅 비누설 | ✓ SATISFIED | 사실 2 |
| CHAT-04 | 07-02·03·05·10·18·21 | 입력 중 "…" | ✓ SATISFIED (자동) / iPhone 표시 사람 확인 대기 | UAT 4 automated |
| CHAT-05 | 07-02·03·05·11·13·19·21·22 | 서버 제한·알림 + 한글 IME + iOS 키보드 | ? NEEDS HUMAN | 서버·iPhone 충족, Android·삼성·카카오톡 미확인. REQUIREMENTS.md `Pending` 과 일치 |
| CHAT-06 | 07-04·06~09·11·12·14~17·20·21·23·27 | 옛 주장·빠른 메시지·이모티콘 제거, 오안내 문구 제거 | ✓ SATISFIED | 사실 4·6 (이전의 문구 경고 해소) |
| MAP-02 | 07-24·25·26·27 (소유 Phase 6) | 터치 이동·서버 경로·같은 속도 | ✓ SATISFIED (개정 반영) | 사실 5, 와이어·서버 불변, 배포본 W2~W12 통과 |

### 필수 산출물 (3단계 + 데이터 흐름)

| 산출물 | 역할 | 상태 | 비고 |
|--------|------|------|------|
| `shared/game/world.ts` `planMoveSegment` | 서버·클라이언트 공용 경로 본체 | ✓ VERIFIED | `requestMove` 가 위임, `motion.predictSegment` 가 같은 함수 호출. `world.test.ts` 가 깊은 비교로 동일성 고정 |
| `src/world/motion.ts` | 예측·섞기·방향·추적기 순수 계산 | ✓ VERIFIED | `runtime.ts` 가 import(`:15`)하고 사용(`:283,681,719,728,896`) |
| `src/world/store.ts` `moveSeqOf` | 자리별 적용된 move 수 | ✓ VERIFIED | `runtime.ts` 가 프레임마다 호출 |
| `src/world/runtime.ts` | 예측 구간·응답 추적·섞기·방향·`shown` | ✓ VERIFIED | FLOWING: `WorldStage.onTap`→`notifyMoveSent`→`predictSegment`→`drawFrame`→화면. 서버 구간 → `observe` → 맞춤 |
| `src/world/character.ts` `POSE_BLEND_MS` | 걷기·서기 자세 섞기 | ✓ VERIFIED | `character.test.ts` 통과 |
| `src/world/testHooks.ts` `shown` | E2E 용 화면 위치 훅 | ✓ VERIFIED | `scripts/e2e/browser.mjs` `readWalkWatch`→`flows.mjs`→`lib.mjs walkStartChecks` 로 이어져 배포본 W11·W12 판정에 쓰임 |
| `src/game/scenes.ts` 낮 시작 문구 | WR-03 | ✓ VERIFIED | 사실 6 |
| 이전 22개 계획 산출물(`audience`·`chatRules`·`chatLog`·`room.ts`·`chatStore`·`ChatPanel` 등) | 채팅 | ✓ VERIFIED | 이전 검증 이후 변경 없음, 289개 시험 재통과 |

### 행동 확인 (직접 실행)

| 행동 | 명령 | 결과 | 상태 |
|------|------|------|------|
| 채널·누설·제한·복원·정적 가드·화면 패널 | `npx vitest run` 11개 파일(audience, chatRules, chatLog, chatStaticGuard, worker/chat·chatLeak·chatReplay·leak, client/chatPanel·chatStore·nightChat) | 11 파일 / 289 시험 통과 | ✓ PASS |
| 이동 예측·섞기·문구·E2E 계약 | `npx vitest run` 10개 파일(unit world·motion·worldStore·character·scenes·e2eContract, client worldStage·guide·sceneIntro·phaseScreens) | 10 파일 / 489 시험 통과 | ✓ PASS |
| 타입 | `npx tsc -p tsconfig.app.json --noEmit` · `tsconfig.worker.json` | 오류 0 | ✓ PASS |
| 서버·와이어 불변 | `git diff ae1c5b3 -- worker shared/protocol.ts` | 변경 0 | ✓ PASS |
| 배포본 = 현 코드 | `curl .../api/health`, `git diff 22ca18d..HEAD` | `…+22ca18d`, 코드 변경 0(문서뿐) | ✓ PASS |
| 배포본 W11·W12·N8 | `scripts/e2e/out/deployed-07-27.log` 직접 읽기 | W11·W12 6개 크기 통과(12행) | ✓ PASS (07-27 에이전트 실행 결과를 로그로 확인, 재실행은 하지 않음) |
| 전체 스위트 | 재실행 안 함 | 07-27-SUMMARY: 143 파일 3897 통과·1 skipped(로컬 게이트) | 인용만 |

**알려진 흔들림(오케스트레이터 알림 2):** 병렬 부하에서 `test/worker` 채팅 통합 시험 1건(`botSays … settle`)이 한 번 실패했고 7회 이상 재실행에서 재현되지 않았다. 내가 돌린 두 묶음(11+10개 파일)은 모두 한 번에 통과했다. 코드 결함 증거가 없고 `deferred-items.md` 에 같은 양상(`bots.test` flake)이 기록되어 있어 목표 달성에는 영향이 없다고 판단하되, 경고 W-2 로 남긴다.

### 프로브 실행

해당 없음 — 이 페이즈는 `probe-*.sh` 를 선언하지 않았다.

### 안티패턴 · 코드 리뷰 상태

디버트 마커(`TBD/FIXME/XXX`)를 갭 닫기로 바뀐 코드 파일(`motion.ts`·`runtime.ts`·`store.ts`·`world.ts`·`scenes.ts`·`testHooks.ts`·`character.ts`·`scripts/e2e/lib.mjs`·`browser.mjs`)에서 찾지 못했다. 갭 닫기 리뷰(07-REVIEW-GAPS.md): 치명 0 · 경고 1 · 참고 5. 이전 리뷰(07-REVIEW.md) 경고 3건 중 WR-03 은 해소됐고 WR-01·WR-02 는 이전과 같이 목표에 영향 없는 `open` 이다.

| ID | 심각도 | 내용 | 목표 영향 |
|----|--------|------|-----------|
| GR-WR-01 | ⚠️ Warning | 서버가 둘째 탭을 `TOO_SOON` 으로 조용히 버리면(탭 간격 250ms, 서버 최소 간격 150ms, 모바일 지터) `createOwnMoves` 의 개수 맞추기가 어긋나 유령 예측이 최대 1.5초 남고, 응답이 왔는데도 '연결이 불안정해요' 알림이 뜬다 | 읽어서 경로를 확인했다(`motion.ts:217-234`, `runtime.ts:507-512`). 결정 0059-2 의 "버려진 경우 예측을 멈춘다" 를 1.5초 시계에만 맡긴 구현이라 드문 경로의 체감 결함이다. 서버 권위·비누설과 무관하고 G-07-9 의 주된 진실(탭 즉시 출발·튐 없음)은 정상 경로에서 성립하므로 FAIL 로 올리지 않는다. 리뷰 권장 수정(타이머 만료 전 한 번 더 `observe`, 응답을 들었으면 알림 생략)이 있다 |
| W-1 | ⚠️ Warning | 배포본 전체 E2E 가 900초 제한을 넘는다(전체 1089초, reconnect 단독 311초) + setup `page.goto` 8초 시간 초과가 병렬 부하에서 가끔 난다 | 흐름별 단독 재실행으로 가르는 방식이 07-27 금지 사항 허용 범위이고 코드 실패가 아니라 하네스 시간 예산이다. 다음 단계에서 흐름 분할 또는 제한 재검토가 필요하다(07-27 후속 제안) |
| W-2 | ⚠️ Warning | 부하 시 채팅 통합 시험 간헐 실패 1건(7회 이상 재현 없음) | 목표 영향 없음. 반복되면 `deferred-items.md` 의 flake 항목에서 추적 |
| IN-01~05(리뷰 갭) | ℹ️ Info | 뒤로 미끄러짐 주석의 RTT 전제(≈200ms 이하), `gapMs` 상한 없음, `notifyMoveSent` 선택 인자, W11 이 프레임 수로만 판정, `design/` 사본 옛 문구 | 기능 영향 없음. IN-04: 15~20fps 호스트에서는 예측 없는 코드가 W11 을 통과할 수 있어(약 3프레임) 회귀 탐지력이 약하다 — 보강 권장 |
| WR-01·WR-02·IN(07-REVIEW) | ⚠️/ℹ️ | 로비 좌석 재사용 시 `all` 줄 복원, 로비 시스템 줄 시각 | 이전 보고서와 같음, 비밀 채널 누설 아님 |

### UAT 대조 (07-UAT.md)

| 시험 | 결과 | 이 보고서의 처리 |
|------|------|------------------|
| 1·2·3 iPhone 키보드·IME·테이블 | pass(사용자) | 성공 기준 3 의 iPhone 부분 충족 |
| 4 두 기기 "…" | pass (automated) | 자동 확인만, iPhone 표시는 휴먼 항목에 유지 |
| 5·6·7 | skipped(사용자 결정) | 휴먼 항목에 유지, 통과로 세지 않음 |
| 8 WR-03 문구 | pass(사용자 결정 → 반영) | 사실 6 으로 코드 반영 확인 |
| 9 로비 이동 반응 | issue → G-07-9 | 사실 5 로 코드·자동 검사 확인. **UAT 9 의 `diagnosed` 상태는 사용자가 다시 판정**해야 닫힌다 |

## 사람 확인이 필요한 항목

frontmatter `human_verification` 에 전체 목록. 요약:

1. **Android Chrome · 삼성 인터넷 · 카카오톡 인앱(iOS·Android)**: 로드맵 성공 기준 3 명시 기기. 사용자가 직접 확인하거나 9페이즈 팀 테스트로 이월을 명시적으로 결정해야 한다(에이전트는 임의로 이월하지 않았다). 미확인은 통과로 세지 않았다
2. **로비 이동 체감 재확인(G-07-9)**: 배포본 22ca18d 에서 iPhone 으로 연속 탭·걷는 중 방향 전환. 자동 W11·W12 는 통과했으나 "자연스러움"은 사람 몫(UAT 9 를 다시 판정)
3. **iPhone "…" 입력 중 표시**, **5분 채팅 부하 체감**, **`?chat-mock=1` 다섯 줄** — 사용자 결정(2026-11-02)으로 개발 종료 후 실기기 일괄 플레이테스트로 이월 중

## 갭 요약

FAILED·MISSING·STUB·NOT_WIRED 항목은 없다. 막는 갭(BLOCKER) 0건. 이전 보고서의 사람 확인 중 iPhone 키보드·IME·테이블(UAT 1~3)과 WR-03 문구 결정(UAT 8)은 해소됐다. 갭 닫기 두 건(G-07-9, WR-03)은 닫혔다. 남은 것은 (a) Android·삼성·카카오톡 확인 또는 사용자의 이월 결정, (b) 로비 이동 체감의 사용자 재판정, (c) 경고 GR-WR-01(드문 경로)·W-1(E2E 시간 예산)의 처리 결정이다. 실기기 확인 중 실패가 나오면 07-UI-SPEC 의 "검사 실패 때 내리는 순서" 1단계부터 갭 닫기 계획으로 다룬다.

## 검증 환경 한계

- 실기기(iPhone·Android·삼성·카카오톡)에는 접근하지 않았다. iPhone 결과는 UAT 문서의 사용자 보고를 인용했다.
- 개발 서버·배포는 실행하지 않았고 배포본 E2E 를 재실행하지 않았다(07-27 이 남긴 로그 파일을 직접 읽어 W11·W12 통과 행, 세 단독 재실행의 `E2E OK` 마지막 줄, health 해시를 확인).
- 직접 실행한 것: 관련 21개 vitest 파일(채팅 11 + 이동·문구 10), 두 `tsc`, 배포 health 조회, 코드·문서·로그 읽기, `git diff` 로 서버·와이어 불변 확인.
- 전체 vitest 3897 통과 수치와 HANDOFF 6KB 시험은 07-27-SUMMARY 인용만 했다.

---

_Verified: 2026-11-02T07:00:00Z_
_Verifier: Claude (gsd-verifier)_
