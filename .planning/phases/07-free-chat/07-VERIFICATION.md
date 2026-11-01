---
phase: 07-free-chat
verified: 2026-11-02T04:30:00Z
status: human_needed
score: 3/4 must-haves verified
covered_files: [".planning/phases/07-free-chat/07-01-PLAN.md", ".planning/phases/07-free-chat/07-01-SUMMARY.md", ".planning/phases/07-free-chat/07-02-PLAN.md", ".planning/phases/07-free-chat/07-02-SUMMARY.md", ".planning/phases/07-free-chat/07-03-PLAN.md", ".planning/phases/07-free-chat/07-03-SUMMARY.md", ".planning/phases/07-free-chat/07-04-PLAN.md", ".planning/phases/07-free-chat/07-04-SUMMARY.md", ".planning/phases/07-free-chat/07-05-PLAN.md", ".planning/phases/07-free-chat/07-05-SUMMARY.md", ".planning/phases/07-free-chat/07-06-PLAN.md", ".planning/phases/07-free-chat/07-06-SUMMARY.md", ".planning/phases/07-free-chat/07-07-PLAN.md", ".planning/phases/07-free-chat/07-07-SUMMARY.md", ".planning/phases/07-free-chat/07-08-PLAN.md", ".planning/phases/07-free-chat/07-08-SUMMARY.md", ".planning/phases/07-free-chat/07-09-PLAN.md", ".planning/phases/07-free-chat/07-09-SUMMARY.md", ".planning/phases/07-free-chat/07-10-PLAN.md", ".planning/phases/07-free-chat/07-10-SUMMARY.md", ".planning/phases/07-free-chat/07-11-PLAN.md", ".planning/phases/07-free-chat/07-11-SUMMARY.md", ".planning/phases/07-free-chat/07-12-PLAN.md", ".planning/phases/07-free-chat/07-12-SUMMARY.md", ".planning/phases/07-free-chat/07-13-PLAN.md", ".planning/phases/07-free-chat/07-13-SUMMARY.md", ".planning/phases/07-free-chat/07-14-PLAN.md", ".planning/phases/07-free-chat/07-14-SUMMARY.md", ".planning/phases/07-free-chat/07-15-PLAN.md", ".planning/phases/07-free-chat/07-15-SUMMARY.md", ".planning/phases/07-free-chat/07-16-PLAN.md", ".planning/phases/07-free-chat/07-16-SUMMARY.md", ".planning/phases/07-free-chat/07-17-PLAN.md", ".planning/phases/07-free-chat/07-17-SUMMARY.md", ".planning/phases/07-free-chat/07-18-PLAN.md", ".planning/phases/07-free-chat/07-18-SUMMARY.md", ".planning/phases/07-free-chat/07-19-PLAN.md", ".planning/phases/07-free-chat/07-19-SUMMARY.md", ".planning/phases/07-free-chat/07-20-PLAN.md", ".planning/phases/07-free-chat/07-20-SUMMARY.md", ".planning/phases/07-free-chat/07-21-PLAN.md", ".planning/phases/07-free-chat/07-21-SUMMARY.md", ".planning/phases/07-free-chat/07-22-PLAN.md", ".planning/phases/07-free-chat/07-22-SUMMARY.md", "shared/game/audience.ts", "shared/game/chatLog.ts", "shared/game/chatRules.ts", "shared/protocol.ts", "shared/schemas.ts", "src/components/v2/ChatPanel.tsx", "src/game/scenes.ts", "src/net/chatStore.ts", "src/net/useChat.ts", "src/screens/DayScene.tsx", "src/screens/Lobby.tsx", "test/worker/chatLeak.test.ts", "worker/room.ts"]
covered_digest: "v3:sha256:75c8d16745f6f9b5b5d6718c2a06bcafa70d8bae43ab1452050d07435ecd1fd2"
behavior_unverified: 1
overrides_applied: 0
behavior_unverified_items:
  - truth: "한글 입력(조합 중 Enter)이 깨지지 않고 iOS 키보드가 채팅창을 가리지 않는다 — iPhone·Android·삼성 인터넷·카카오톡 인앱에서 확인 (CHAT-05 실기기 몫)"
    test: "iPhone 16 Pro Safari 와 iOS용 Chrome 에서 배포본 로비 입력칸을 눌러 합격 검사 1~7 과 한글 IME 를 확인한다(07-DEVICE-CHECKS.md 의 '사용자가 아침에 할 일' 1~3)"
    expected: "입력줄·보내기가 키보드에 가려지지 않고, 캔버스 크기가 변하지 않으며, 내 캐릭터가 남은 영역에 보이고, 조합 중 Enter·보내기에 한 줄만 전송되고 입력칸에 잔여 글자가 없다"
    why_human: "실제 iOS 키보드·visualViewport·IME 는 헤드리스 Chromium(Input.imeSetComposition, 가상 키보드 값 주입)이 완전히 흉내 내지 못한다. 코드·E2E 는 있으나 실기기에서 실행된 증거가 없다"
human_verification:
  - test: "iPhone 16 Pro Safari + iOS용 Chrome, 로비(검사 1·2·3·5·6): https://minifia-v2.dhplay.workers.dev?test=1 에서 방 만들기 → 입력칸 탭"
    expected: "입력줄·보내기가 키보드에 안 가려짐 / 맵이 깜빡이거나 크기가 바뀌지 않음 / 내 캐릭터가 남은 맵 영역에 보임 / '안녕하세요' 전송 뒤에도 키보드가 닫히지 않음 / 맵 빈 곳을 눌러 닫을 때 화면이 튀지 않음"
    why_human: "실제 iOS 키보드 높이·visualViewport 동작은 헤드리스로 재현 불가"
  - test: "iPhone 한글 IME(검사 4): '안녕하세요' 마지막 글자 조합 중 키보드 보내기(Enter), 이어서 화면의 보내기 버튼"
    expected: "기록에 한 줄만, 입력칸에 남는 글자 없음"
    why_human: "실제 iOS IME 이벤트 순서(compositionend 타이밍, 리뷰 IN-03 의 꼬리 글자 휴리스틱 포함)"
  - test: "iPhone 테이블 화면(검사 7): [테스트] 봇 3명 → 시작 → 낮 토론까지 넘겨 1·2 반복"
    expected: "낮 토론 하단에서도 입력줄이 안 가려짐(테이블 아래 인물 가림은 알려진 한계)"
    why_human: "실기기 키보드"
  - test: "두 기기(폰 + PC 등)에서 한쪽이 글자를 입력 (CHAT-04)"
    expected: "상대 화면의 내 캐릭터 이름표 위에 '…' 가 뜨고 입력을 비우면 사라진다"
    why_human: "서버 중계·채널 제한·화면 표시는 자동 시험(worker/client/E2E)으로 확인했으나 iPhone 실기기 표시는 미확인"
  - test: "5분 채팅 부하 체감: iPhone 로비를 둔 채 Mac 에서 node scripts/bots.mjs <방 코드> --count 7 --prod --chat 2 실행"
    expected: "끊김 체감 없음/가끔, 5분 뒤 열감 차갑다/미지근 (조건 B 데스크톱은 60.00fps·끊김 0 으로 통과, 결정 0055 로 Mac 숫자만으로 통과 선언 불가)"
    why_human: "실기기 렌더 성능"
  - test: "https://minifia-v2.dhplay.workers.dev/?chat-mock=1 다섯 줄 (6페이즈 이월, 표 D)"
    expected: "입력줄 안 가려짐 / 캔버스 크기 불변 / 내 캐릭터 보임 / 한글 조합 Enter / 닫을 때 튐 없음"
    why_human: "6페이즈에서 이월된 iPhone 실기기 확인"
  - test: "Android Chrome · 삼성 인터넷 · 카카오톡 인앱(iOS·Android) — 로드맵 성공 기준 3 이 명시한 확인 기기"
    expected: "위 검사 1·2·4 가 같은 방식으로 통과하거나, 사용자가 9페이즈 팀 테스트로 이월을 결정한다"
    why_human: "실기기 없음. 에이전트가 이월을 임의로 결정할 수 없다 — 사용자 결정 필요(07-DEVICE-CHECKS 표 C: 미확인, 합격으로 세지 않음)"
  - test: "WR-03 낮 시작 문구 결정: src/game/scenes.ts 71·79행 '토론 전에 먼저 직업을 공개해요' / '곧 직업 공개가 시작돼요'"
    expected: "사라진 직업 공개 단계를 안내하는 문구를 어떻게 바꿀지(deferred-items.md 의 두 안) 사용자가 정한다"
    why_human: "문구 결정은 사용자 몫(열린 질문)"
---

# Phase 7: 자유 채팅 검증 보고서

**Phase Goal:** 로비부터 자유롭게 채팅하고, 밤 마피아 채팅과 탈락자 채팅이 다른 편 폰으로는 네트워크로도 가지 않는다
**Verified:** 2026-11-02T04:30:00Z
**Status:** human_needed
**Re-verification:** 아니오 — 최초 검증

## 한 줄 결론

서버 측 목표(채널 분리·네트워크 비누설·제한·옛 기능 제거)는 코드와 시험으로 확인했고 미달 항목은 없다. 다만 성공 기준 3의 "iOS 키보드·한글 IME 실기기 확인"은 아직 아무 기기에서도 사람이 수행하지 않아 통과로 세지 않았다. 그래서 `passed` 가 아니라 `human_needed` 다. CHAT-05 는 REQUIREMENTS.md 에서도 `Pending` 그대로이며 이 판단과 일치한다.

## 목표 달성

### 관찰 가능한 사실 (ROADMAP 성공 기준 4개)

| # | 사실 | 상태 | 증거 |
|---|------|------|------|
| 1 | 로비와 낮에서 산 사람 모두 하단 채팅창으로 글을 보내고 같은 방 모두의 폰에 보인다. 입력 중 내 캐릭터 머리 위에 "…" 가 뜨고 같은 채널을 보는 사람에게만 보인다 (CHAT-01·04) | ✓ VERIFIED | `shared/game/audience.ts` `channelOf`: 산 사람은 낮·로비에서 `all`. `worker/room.ts` `applyChat`→`deliver(audience(room,{k:"chat",ch}))`, `handleTyping` 은 같은 채널에서 보낸 사람만 빼고 중계. 화면 연결: `Lobby.tsx:158,219`·`DayScene.tsx:162,167` 이 `useChat`+`ChatPanel`, `RoomScreen.tsx:171` 이 chat/typing/chatLog/chatReject 를 `ChatStore` 로 전달, `WorldStage.tsx:228`→`HeadStack typing`→`.mv-typing`(aria-label). 시험: `chat.test.ts`(worker) 통과. 배포본 smoke full: ch all 4줄 seq 연속·전원 동일(07-DEVICE-CHECKS 표 A, 배포 해시 `4147d32` 가 HEAD 와 동일함을 직접 확인). iPhone 에서의 "…" 표시만 사람 확인 대기 |
| 2 | 밤에는 산 마피아끼리만 채팅하고 그 내용·입력 중 표시는 시민 편 폰으로 오가는 메시지에 한 번도 없다. 탈락자 채팅도 산 사람 폰에는 가지 않는다 (CHAT-02·03) | ✓ VERIFIED | 채널은 클라이언트 입력이 아니라 보낸 사람의 서버 상태로만 정한다(`channelOf`; 밤의 산 비마피아는 `null`→폐기). `audience` 방어 장치: `mafia` 는 night 에만, `ghost` 는 탈락자만. 모든 이벤트 프레임이 `deliver` 한 길(`worker/room.ts:788`)이고 `broadcastEvent` 류 무차별 길은 정적 가드 시험(`chatStaticGuard.test.ts`)이 막는다. 단계 키 불일치는 더 넓은 채널로 돌리지 않고 `phase` 하나로 폐기. `chatLeak.test.ts`(a) 밤 마피아 활동 구간과 무활동 구간에서 시민 소켓 프레임 열이 동일, (b) 탈락자 채팅·입력 중이 산 사람 소켓 0건, (c) 틀린 단계 키 줄 0건·저장 안 됨, (d) 재접속 chatLog 도 보낼 때의 마스크만 사용. 내가 11개 파일 289개 시험을 직접 돌려 전부 통과(`audience`·`chatRules`·`chatLog`·`chatStaticGuard`·`chat`·`chatLeak`·`chatReplay`·`leak`·`chatPanel`·`chatStore`·`nightChat`). 배포본 smoke: 밤 마피아 채널 도달 1명(= 수신 대상만), 탈락자 채널 1명. **설계상 예외(결함 아님):** 탈락자 관전은 밤 마피아 채팅을 받는다(결정 0021, `audience.ts` 주석·테스트로 명시) — "산 시민 편 폰" 기준으로 성립 |
| 3 | 글자 수나 도배 한도를 넘기면 서버가 막고 보낸 사람에게 알린다. 한글 입력(조합 중 Enter)이 깨지지 않고 iOS 키보드가 채팅창을 가리지 않는다 — iPhone·Android·삼성 인터넷·카카오톡 인앱에서 확인 (CHAT-05) | ⚠️ PRESENT_BEHAVIOR_UNVERIFIED | **서버 몫은 검증됨:** `chatRules.ts` 상수(100자 자소·600ms·5초 5줄·같은 문장 3초), `applyChat` 이 정리→D5 제한 순으로 판정하고 거절은 보낸 소켓에만 `chatReject` (smoke: 거절 2건 보낸 쪽에만). **화면 코드는 있고 연결됨:** `ChatPanel` 의 form 제출 한 길+`compositionend` 대기, `useKeyboardLift`. 자동 E2E(배포본) `chat-ime` 10/10(CDP `imeSetComposition`)·`chat-keyboard` 6개 크기 통과. **그러나** 실제 iOS 키보드·IME 는 에뮬레이션이 대체하지 못하며 07-DEVICE-CHECKS 표 C·D 의 iPhone 칸이 전부 `대기`/`미확인`이고 Android·삼성·카카오톡 행도 `미확인`이다. 상태 전이/실기기 동작을 실행한 증거가 없어 VERIFIED 로 세지 않는다 |
| 4 | 순차 직업 주장·빠른 메시지·텍스트 이모티콘이 화면과 서버에서 모두 사라지고, 낮 토론은 자유 채팅으로 진행된다 (CHAT-06) | ✓ VERIFIED (경고 1건, WR-03) | `src/ shared/ worker/` 에서 `claimLog`·`QuickMessage`·`emoji`·`ClaimPanel`·`TurnPanel`·`say` 코드 식별자 0건(남은 `claim*` 은 `shared/game/room.ts:293-343` 의 옛 저장 방 정규화 주석/키 목록과 CSS 클래스 이름뿐). `schemas.ts:45` 에 `say`/`emoji`/`claim` 메시지가 유니온에 없어 `BAD_MESSAGE`. 서버 단계 흐름은 `dayAnnounce`→`discussion`(tick/phase 시험 통과). **경고:** 사라진 기능을 안내하는 문구가 낮 시작 화면에 남아 있다 — 아래 WR-03 |

**Score:** 3/4 사실 VERIFIED (1개는 서버 몫 검증·실기기 몫 미확인으로 PRESENT_BEHAVIOR_UNVERIFIED). 미달(FAILED) 0건.

### 요구사항 커버리지 (PLAN frontmatter ↔ REQUIREMENTS.md 대조)

22개 PLAN 의 `requirements:` 합집합 = CHAT-01~06 전부. REQUIREMENTS.md 의 7페이즈 매핑 6개와 일치하며 누락·고아(ORPHANED) 없음.

| 요구사항 | 담당 계획 | 설명 | 상태 | 근거 |
|----------|-----------|------|------|------|
| CHAT-01 | 07-01·02·03·05·11·13·14·15·16·20·21 | 로비·낮 자유 채팅 | ✓ SATISFIED | 성공 기준 1 |
| CHAT-02 | 07-01·02·10·11·12·14·15·16·17·21 | 밤 마피아 채팅·입력 중 비누설 | ✓ SATISFIED | 성공 기준 2, `chatLeak` (a)(c)(d) |
| CHAT-03 | 위와 같음 | 탈락자 채팅 비누설 | ✓ SATISFIED | `chatLeak` (b)(d), `chatReplay` |
| CHAT-04 | 07-02·03·05·10·18·21 | 입력 중 "…" | ✓ SATISFIED (자동) / iPhone 표시 사람 확인 대기 | `handleTyping`, `HeadStack`, `camera.test` |
| CHAT-05 | 07-02·03·05·11·13·19·21·22 | 서버 제한·알림 + 한글 IME + iOS 키보드 | ? NEEDS HUMAN | 서버 제한은 충족, 실기기 몫 미확인. REQUIREMENTS.md 도 `Pending` (일관) |
| CHAT-06 | 07-04·06·07·08·09·11·12·14·15·16·17·20·21 | 옛 주장·빠른 메시지·이모티콘 제거 | ✓ SATISFIED (문구 경고) | 성공 기준 4 |

### 필수 산출물 (3단계 + 데이터 흐름)

| 산출물 | 역할 | 상태 | 비고 |
|--------|------|------|------|
| `shared/game/audience.ts` | 받는 사람 한 길 + 채널 결정 | ✓ VERIFIED | 서버 `worker/room.ts` 가 import·사용, 정적 가드 존재 |
| `shared/game/chatRules.ts` | 길이·도배·입력 중 규칙 | ✓ VERIFIED | `applyChat`·`handleTyping` 이 호출 |
| `shared/game/chatLog.ts` | 채널별 seq·보낼 때 마스크·복원 | ✓ VERIFIED | `appendLine`/`replayFor`/`toWire` 가 room.ts 에서 사용, `toWire` 는 마스크 필드를 와이어에 싣지 않음 |
| `worker/room.ts` | 서버 채팅 길 | ✓ VERIFIED | FLOWING: 입력(소켓 첨부 playerId)→`channelOf`→`audience`→저장→`deliver` |
| `src/net/chatStore.ts`·`useChat.ts` | 클라이언트 저장소/훅 | ✓ VERIFIED | `RoomScreen` 이 연결 이벤트를 `chat.apply` 로 전달, Lobby·DayScene 이 읽음 |
| `src/components/v2/ChatPanel.tsx` | 하단 채팅 패널 | ✓ VERIFIED (iOS 실기기 제외) | Lobby·DayScene 에 연결, 입력 중 알약은 `HeadStack` 로 이어짐 |
| `test/worker/chatLeak.test.ts` 등 | 누설 검사 | ✓ VERIFIED | 비어 있지 않은 활동 구간을 단언(구간 Q 에서 마피아 B 가 줄 2·입력 중 2프레임을 받았음을 확인) 후 시민 0프레임 비교 — 공허하지 않다 |

### 행동 확인 (직접 실행)

| 행동 | 명령 | 결과 | 상태 |
|------|------|------|------|
| 채널·누설·제한·복원·정적 가드·화면 패널 | `npx vitest run` 11개 파일(audience, chatRules, chatLog, chatStaticGuard, worker/chat·chatLeak·chatReplay·leak, client/chatPanel·chatStore·nightChat) | 11 파일 / 289 시험 통과 | ✓ PASS |
| 타입 | `npx tsc -p tsconfig.app.json --noEmit` · `tsconfig.worker.json` | 오류 0 | ✓ PASS |
| 배포 해시 | `curl .../api/health` | `2026-11-01T18:04:02Z+4147d32`, `git diff 4147d32..HEAD` 의 코드 변경 0(HANDOFF.md 만) | ✓ 배포본 = 현 코드 |
| 전체 스위트 | 재실행 안 함(오케스트레이터 회귀 게이트 142 파일 3847 통과, 07-REVIEW 도 같은 수치) | — | 인용만 |

배포 smoke·E2E·채팅 부하(5분 60.00fps·끊김 0)는 07-21 에서 에이전트가 실행한 결과를 07-DEVICE-CHECKS.md 에서 읽었고, 배포 해시 일치만 직접 재확인했다. 서버 기반 검사는 서버를 띄우지 않아 재실행하지 않았다.

### 프로브 실행

해당 없음 — 이 페이즈는 `probe-*.sh` 를 선언하지 않았다.

### 안티패턴 · 코드 리뷰 상태 (07-REVIEW.md, 처리 기록 07-REVIEW-DISPOSITION.md)

디버트 마커(`TBD/FIXME/XXX`) 점검은 리뷰·SUMMARY 에 별도 지적이 없었고 이 페이즈 핵심 파일에서 새 마커를 찾지 못했다. 리뷰 결과는 치명 0 · 경고 3 · 참고 7 이며 모두 `open`(사용자 결정 대기):

| ID | 심각도 | 내용 | 목표 영향 |
|----|--------|------|-----------|
| WR-01 | ⚠️ Warning | 로비에서 나가기·내보내기로 좌석이 재사용되면 새 입장자가 입장 전 `all` 줄을 복원으로 받고, 옛 줄의 보낸 사람 이름이 바뀐다(좌석 기반 마스크 한계) | `all` 채널(로비)에서만 일어나 마피아/탈락자 비밀 누설은 아니다. 결정 0058-2 "복원이 라이브보다 넓어지지 않는다"의 로비 예외. 목표(비밀 채널 비누설) 달성에는 영향 없음 |
| WR-02 | ⚠️ Warning | Lobby 입장·퇴장 시스템 줄만 `Date.now()` (offset 미반영) | 표시 정렬만 |
| WR-03 | ⚠️ Warning | `src/game/scenes.ts:71`, `:79` 낮 시작 화면에 "토론 전에 먼저 직업을 공개해요"·"곧 직업 공개가 시작돼요" 가 배포본에 그대로 나간다 — 존재하지 않는 단계를 약속하는 오안내 | 성공 기준 4 "화면에서 모두 사라지고"를 문구 수준에서 완전히 충족하지 못한다. 기능은 없다. 문구 결정은 사용자 몫(열린 질문) |
| IN-04 | ℹ️ Info | `.mf-claimpanel*` 클래스 이름이 옛 직업 공개 패널 이름인 채 `NightPanel`·`ExecVotePanel` 이 계속 사용, 낡은 주석 | 기능 영향 없음 |
| IN-06 | ℹ️ Info | `chatLeak (a)` 관측 헬퍼는 보낸 소켓 둘 중 한쪽만 settle 해 증명력이 약하다 | 내가 별도로 코드 경로(`deliver(audience)` 단일 길 + 정적 가드)를 확인해 누설 경로가 없음을 보강. 시험 강화는 권장 |

IN-01·02·03·05·07 은 체감/표시/설계 확인용이며 목표에 영향이 없다.

## 사람 확인이 필요한 항목

frontmatter `human_verification` 에 전체 목록. 요약:

1. **iPhone 16 Pro Safari·iOS용 Chrome**: 합격 검사 1~7 (키보드 가림, 캔버스 불변, 내 캐릭터 보임, 닫을 때 튐 없음, 테이블 틀 포함) — 합격 선언에 필수
2. **iPhone 한글 IME**: 조합 중 Enter·보내기에 한 번만 전송, 잔여 글자 없음
3. **iPhone "…" 입력 중 표시** 와 **5분 채팅 부하 체감**(끊김·열감)
4. **`?chat-mock=1`** 다섯 줄 (6페이즈 이월)
5. **Android Chrome · 삼성 인터넷 · 카카오톡 인앱(iOS·Android)**: 로드맵 성공 기준 3 에 적힌 기기. 사용자가 직접 확인하거나 9페이즈 팀 테스트로 이월을 결정해야 한다. 이월은 에이전트가 임의로 정하지 않았고, 미확인은 통과로 세지 않았다
6. **WR-03 낮 시작 문구**: 사용자 결정 필요

## 갭 요약

FAILED·MISSING·STUB·NOT_WIRED 항목은 없다. 막는 갭(BLOCKER) 0건. 다음 진행의 조건은 (a) 위 실기기 확인의 사용자 응답, (b) 리뷰 경고 3건의 처리 결정(리뷰 권장: 경고 3건 수정 `/gsd-code-review 07 --fix` 후 재배포 — 단 재배포하면 이미 쓰인 iPhone 확인 대상 빌드 `4147d32` 가 바뀌므로 확인 순서를 사용자가 정해야 한다)이다. 실기기 확인 중 실패가 나오면 07-UI-SPEC 의 "검사 실패 때 내리는 순서" 1단계부터 갭 닫기 계획으로 다룬다.

## 검증 환경 한계

- iPhone/Android 실기기, 카카오톡 인앱은 접근하지 않았다.
- 개발 서버·배포는 실행하지 않았다. 직접 실행한 것: 관련 11개 vitest 파일, 두 `tsc`, 배포 health 조회, 코드·문서 읽기.
- 오케스트레이터의 "전체 vitest 3847 통과" 수치는 인용만 했다(내가 전체 스위트를 재실행하지 않음).

---

_Verified: 2026-11-02T04:30:00Z_
_Verifier: Claude (gsd-verifier)_
