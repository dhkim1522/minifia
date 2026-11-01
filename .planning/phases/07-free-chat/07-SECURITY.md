---
phase: "07"
slug: "free-chat"
status: verified
# threats_open = workflow.security_block_on(high) 이상인 OPEN 위협 수(차단 게이트)
threats_open: 0
asvs_level: 1
created: "2026-11-02"
---

# Phase 07 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

- 검증일: 2026-11-02 / ASVS 레벨 1 (존재 확인 + 경계 위치 확인) / block_on: high
- 검증 방법: 계획 위협 표 77행(T-07-01~55 55개 + T-07-SC 22행)을 고유 위협 56개로 접어 코드·시험에서 직접 확인. 구현 파일은 읽기만 했다.
- 직접 실행한 시험(전부 통과): node:test scripts/deploy-target.test.mjs 33건 · scripts/e2e/lib.test.mjs 233건 / vitest unit 207건·345건 / client 199건 / worker chat·chatLeak·chatReplay·alarm·day 78건, leak·world·night·vote·bots·testTools 122건.
- 결과: 56개 중 closed 56 (mitigate 53 + accept 3), open 0 (blocking 0, 기준 미만 open 0). 아래 "참고 관찰"은 위협이 아니라 후속 메모다.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| 결정 기록 → 구현 계획 | 보관 규칙이 문서에 없으면 구현이 라이브보다 넓게 복원할 수 있다 | 결정 0058 의 마스크 복원·0021-2·무본문 로그 규칙 |
| 서버 상태 → 받는 사람 집합 (audience/channelOf) | 이 함수가 틀리면 모든 전송 경로(chat·typing·world·복원)가 함께 샌다 | 단계·생존·역할 → 받는 player id 집합 |
| 클라이언트 입력 문자열 → 정리된 본문 | 제어·서식·채움 문자로 줄을 위장할 수 있다 | 채팅 본문(UTF-16 300 이하 → 자소 100 이하) |
| 서버가 보낸 줄 문자열 → DOM (ChatPanel·기록 칸) | 다른 사람이 쓴 임의 문자열이 DOM 에 닿는다 | 채팅 줄 본문·닉네임 |
| 화면 문구·서버 view(me.chat)·chat 프레임 → 시민 편 DOM | 역할 단어가 든 문구나 받을 권리 없는 줄이 다른 신분의 DOM 에 나오면 안 된다 | 채널 문구(placeholder·aria-label), me.chat 채널 값 |
| 서버 view(day) → 낮 화면 | 화면이 남은 주장 필드를 그리면 지운 기능이 되살아난다 | day 키 허용 목록, 기록 행 |
| 서버 프레임 → 클라이언트 저장소(ChatStore) | 받은 줄만 든다(보안 경계 아님) | chat·chatLog·typing·chatReject 프레임 |
| 브라우저 visualViewport·IME → 화면 배치 | 신뢰 경계는 아니지만 입력 중복·누락·가림이 생길 수 있다 | visualViewport 높이, 조합 이벤트 |
| 서버 이벤트(옛 chat·emoji) → 변론 하단·낮 화면 | 지운 뒤에도 구독이 남으면 옛 변론 줄·이모티콘이 그려진다 | 옛 chat·emoji 이벤트 |
| DO 저장소(옛 방) → 새 코드 | 배포 시점에 진행 중인 claim 방이 새 코드에서 터지거나 새면 안 된다 | 저장된 RoomState(claim 단계·키) |
| 옛 번들 클라이언트 → 새 서버 | 사라진 claim·emoji·say 메시지를 보낼 수 있다 | 옛 ClientMessage |
| 서버 view → 모든 소켓 | day 키 허용 목록이 와이어 계약이다 | state 프레임의 view |
| 클라이언트 소켓 → 방 DO (typing·chat) | 신원은 소켓 첨부 playerId 뿐, 채널·단계는 서버가 정한다. 임의 문자열·위조 채널 시도 | typing{on,pk}, chat{text,pk} |
| 방 DO → 각 소켓 (typing·world·chat·chatReject·chatLog) | audience 가 정한 받는 사람에게만, 전송 길은 deliver 하나 | 이벤트 프레임, 재접속 복원 줄 |
| 테스트 방 봇 → DO 본체 | 봇도 사람과 같은 규칙(applyChat) | 봇 chat 행동 |
| 화면 → 서버 (chat·typing) | 채널 없이 본문·켜짐 여부·단계 키만 | {t,text,pk}, {t,on,pk} |
| DO storage(chat:) ↔ 메모리 사본 | 퇴거·배포 뒤 복원이 라이브보다 넓어지면 안 된다 | 줄 레코드(g·ch·seq·seat·text·at·n·r) |
| 서버 typing 프레임 → 이름표 알약 | 받은 좌석만 그린다 | typing{seat,on} |
| 측정·스모크·UAT·E2E·갤러리 스크립트 → 배포본 | 자동 트래픽, v1.0 주소 검사·덮어쓰기 금지 | 대상 주소, 방 토큰, 채팅 부하 |
| 개발자 PC → Cloudflare(배포) | 운영 v1.0 을 덮을 수 있는 유일한 경로 | wrangler deploy 대상 Worker 이름 |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-07-01 | Information Disclosure | 결정 0058(보관·복원 규칙) | low | mitigate | docs/decisions/0058-v2-chat-retention.md 결정 2(마스크로만 복원, 0021-2 유지)·6(마스크·g·일차는 와이어에 없음)·8(로그에 본문·닉네임 없음)·9(마스크 밖 전송 금지)로 고정 | closed |
| T-07-02 | Information Disclosure | audience/channelOf | high | mitigate | shared/game/audience.ts:38-45 channelOf(입력 = 서버 상태+보낸 사람 id, 채널 입력 없음)·:55 CHAT_PHASES 밖 빈 집합·:61 밤 아닌 mafia 빈 집합; test/unit/audience.test.ts 단계×생존×역할 전수(it.each 90·144·148·182행) 통과 | closed |
| T-07-03 | Information Disclosure | chatLog 연번(부채널) | medium | mitigate | shared/game/chatLog.ts:39,89 nextSeq 채널별 계산; chatLog.test.ts:120 "공개 줄의 seq 에는 틈이 없다", chat.test.ts:548 | closed |
| T-07-04 | Information Disclosure | replayFor(복원) | high | mitigate | chatLog.ts:104-112 저장 마스크 비트로만 거름(지금의 역할·생존 재계산 없음); chatLog.test.ts:265-361 대본 성질(복원 == 라이브, seat5 첫 밤 mafia 줄 0, 시민 mafia·ghost 0) | closed |
| T-07-05 | Spoofing | sanitizeChatText | medium | mitigate | shared/game/chatRules.ts:25 TO_SPACE(Cc·Zl·Zp·Cf 중 ZWJ 제외·채움 문자 5종)·:28 VISIBLE 보이는 글자 요구·:35-36; chatRules.test.ts:54-79 | closed |
| T-07-06 | Denial of Service | checkChatSend | medium | mitigate | chatRules.ts:54-64(600ms·5초 5줄·같은 문장 3초); schemas.ts:35 text max 300 UTF-16이 스키마에서 먼저 걸리고 :38 자소 판정은 길이 100 초과 때만; chatRules.test.ts:112-180, schemas.test.ts:148-149 | closed |
| T-07-07 | Tampering | ChatPanel 줄 렌더(XSS) | medium | mitigate | src/components/v2/ChatPanel.tsx:233,253 React 텍스트 노드만(src 전체에 dangerouslySetInnerHTML·innerHTML 대입 0건, grep 확인); chatPanel.test.tsx:109-115 "<b>x</b>" 렌더 시험·:237-239 소스 가드 | closed |
| T-07-08 | Information Disclosure | 채널 문구(placeholder·aria-label) | medium | mitigate | ChatPanel.tsx:67-72 channelUi 의 mafia·ghost 분기 안에서만 role 문구 사용; src/game/chatText.ts:15,17,25; chatPanel.test.tsx:441-447 channel all 이면 DOM 에 "마피아"·"유령" 0건 | closed |
| T-07-09 | Information Disclosure | UserRecordSheet·recordRows | low | accept | 수용(AR-07-01). 주장 기록은 원래 공개 정보였고 이 계획은 표시를 없애기만 함; 확인: src/components/UserRecordSheet.tsx·src/game/recordRows.ts 에 claim 0건, 서버 view 에 claim 키 없음(view.test.ts:654-718) | closed |
| T-07-10 | Denial of Service | ChatStore 메모리 | low | mitigate | src/net/chatStore.ts:226-227 100줄 상한(CHAT_KEEP_LINES=chatUi.ts:46)·:198-212 입력 중 좌석 MAX_PLAYERS 상한; chatStore.test.ts:103-119,243 | closed |
| T-07-11 | Information Disclosure | visibleLines | low | accept | 수용(AR-07-02). 표시 흐름 선택일 뿐 받을 권리 없는 줄은 서버가 보내지 않음; chatStore.test.ts:157-166 저장소가 받지 않은 줄을 만들어 내지 않음을 고정 | closed |
| T-07-12 | Information Disclosure | DefensePanel 의 옛 채팅 줄·이모티콘 구독 | low | mitigate | DefensePanel 파일 삭제, src/screens/verdictScene.tsx 에 chat/emoji 구독 없음(하단은 chatBottom 만); src·shared·worker grep 에서 DefenseChips·panel--tall·defenseSent 0건; chatStaticGuard.test.ts:154-165 | closed |
| T-07-13 | Information Disclosure | 옛 이모티콘·채팅 구독(seatFloats·useDayChat) | low | mitigate | seatFloats·useDayChat 파일 없음(find 확인), import 0건; chatStaticGuard.test.ts REMOVED_IDENTIFIERS 에 seatFloats 포함 | closed |
| T-07-14 | Tampering | normalizeStoredRoom(claim 저장 방) | medium | mitigate | shared/game/room.ts:295-360 claim/claimReveal → discussion 이전·claim 계열 키 제거; worker/room.ts:97 생성자가 호출·:113-118 알람 재설정; gameRoom.test.ts:566-767, test/worker/alarm.test.ts:200-227 | closed |
| T-07-15 | Information Disclosure | view 의 서버 전용 주장 키 | low | mitigate | test/worker/leak.test.ts:87 SERVER_ONLY_KEYS 에 claimPick·claimOrder·claimIdx·claimStart 유지(:292,761 단언); view.test.ts:714-718 옛 claim 키 방도 view 에 안 실림 | closed |
| T-07-16 | Denial of Service | 옛 번들의 claim 메시지 | low | mitigate | shared/schemas.ts:39-66 유니온에 claim 없음 → BAD_MESSAGE(worker/room.ts:207-211); 연결당 20/초 worker/room.ts:58-59,194,275-290; schemas.test.ts:107-114, day.test.ts:270 | closed |
| T-07-17 | Information Disclosure | view day 키·역할 단어 허용 경로 | low | mitigate | leak.test.ts ROLE_PATHS_ALIVE(:82)에 claimLog 경로 없음(shared·worker·src 어디에도 claimLog 출력 코드 없음, grep), 금지·서버 전용 키 목록 유지(:87) | closed |
| T-07-18 | Information Disclosure | handleTyping → deliver | high | mitigate | worker/room.ts:802-817 channelOf(:807)+audience(:814)+deliver(:816) 한 길; chat.test.ts:140-165 밤 시민·경찰·의사 신호 0건; chatLeak.test.ts:22-49; leak.test.ts:233-235,427-432,480 6명 한 판 | closed |
| T-07-19 | Spoofing | typing 메시지의 채널·좌석 | high | mitigate | shared/schemas.ts:24-28 TypingMessageSchema strictObject(on·pk 만); 행위자는 att.playerId(worker/room.ts:803); schemas.test.ts:118-132, chat.test.ts:70-90 덧붙은 seat → BAD_MESSAGE | closed |
| T-07-20 | Information Disclosure | 단계 경계 재분류(pk) | high | mitigate | worker/room.ts:806 pk 불일치 조용히 폐기(재분류 없음); chat.test.ts:47-56,208-216 | closed |
| T-07-21 | Information Disclosure | emitWorld 전환 회귀 | high | mitigate | worker/room.ts:977-981 emitWorld = deliver(audience({k:"world"}))·audience.ts:54 로비 아니면 빈 집합; audience.test.ts:129-153, world.test.ts·leak.test.ts:94-97,TYPING/WORLD 허용 목록 통과 | closed |
| T-07-22 | Denial of Service | typing 폭주 | medium | mitigate | shared/game/chatRules.ts:76-88 typingRelay 켜짐 1.5초 1회(worker/room.ts:811-813)+연결당 20/초(:194); chatRules.test.ts:187-235, chat.test.ts:218-248 | closed |
| T-07-23 | Information Disclosure | applyChat → deliver(밤 마피아·유령 줄) | high | mitigate | worker/room.ts:842 channelOf·:851 audience 한 번 계산(await 앞)→:858 deliver; 무차별 전송 함수·say 경로 삭제(grep 0건); chat.test.ts:336-396, chatLeak.test.ts:51-97, leak.test.ts:440-455 시민 mafia·ghost 0건 | closed |
| T-07-24 | Information Disclosure | 단계 경계 재분류 | high | mitigate | worker/room.ts:841 pk 대조→"phase" 폐기·:829-830 chatReject{phase}+state 보낸 소켓에만; chat.test.ts:426-444 "밤 키를 아침에" 시험, chatLeak.test.ts:75-97 | closed |
| T-07-25 | Information Disclosure | seq 부채널 | medium | mitigate | chatLog.ts:89 appendLine 채널별 seq; chatLog.test.ts:108-127, chat.test.ts:545-586 시민 all seq 틈 없음 | closed |
| T-07-26 | Information Disclosure | 거절 이유 | low | mitigate | worker/room.ts:840-845 단계 밖·채널 없음(밤 시민)·미등록 모두 같은 "phase"; chat.test.ts:347-356, leak.test.ts:456-475 | closed |
| T-07-27 | Denial of Service | 도배·거대 입력 | medium | mitigate | 스키마 300 UTF-16(schemas.ts:35)→sanitize 자소 100(room.ts:846)→D5(:848); 프레임 1024B(:195)·연결당 20/초(:194); chat.test.ts:446-540, schemas.test.ts:148-149 | closed |
| T-07-28 | Elevation of Privilege | 봇 채팅 | low | mitigate | worker/room.ts:473-475 actAsBot 이 applyChat 본체 호출(단계 키는 서버 상태에서 생성·거절은 버림); test/worker/bots.test.ts:262-279 마피아 아닌 봇의 밤 줄은 버려짐 | closed |
| T-07-29 | Repudiation | 서버 로그 | low | mitigate | worker/·shared/ 전체 console 호출은 worker/room.ts:685,907 두 줄뿐이고 err.name 만 출력(본문·닉네임 없음, grep 확인). 참고: 이를 고정하는 자동 시험은 없음 | closed |
| T-07-30 | Information Disclosure | 무차별 전송 함수(broadcastEvent 계열) | high | mitigate | worker/room.ts 의 `.send(` 는 :985 sendTo 한 곳뿐, broadcastEvent·broadcastAll·sendToAll·sendAll 0건(grep); chatStaticGuard.test.ts:122-141 정적 가드 통과 | closed |
| T-07-31 | Denial of Service | 옛 번들의 emoji 메시지 | low | mitigate | schemas.ts:45 유니온에 emoji 없음 → BAD_MESSAGE; schemas.test.ts:177-184 | closed |
| T-07-32 | Tampering | 기록 칸 렌더 | medium | mitigate | ChatPanel.tsx:233,253 텍스트 노드; src/net/useChat.ts:62-72 줄 문자열을 가공하지 않고 전달; chatPanel.test.tsx:109-115 | closed |
| T-07-33 | Spoofing | 보내는 메시지 | medium | mitigate | src 의 chat/typing 송신 지점은 useChat.ts:103,171 둘뿐이고 채널 필드 없음(grep); useChat.test.tsx:66 JSON 이 정확히 {t,text,pk}; 서버 strictObject schemas.ts:33-37, schemas.test.ts:153-154 | closed |
| T-07-34 | Denial of Service | 화면 연타 | low | mitigate | useChat.ts:168-182 SEND_DIM_MS=600(chatUi.ts:28) 흐림·ChatPanel.tsx:152-153 300ms 같은 문장 무시; 서버 D5 가 최종(room.ts:848) | closed |
| T-07-35 | Information Disclosure | hello chatLog(복원) | high | mitigate | worker/room.ts:730 replayFor(chatLog, player.seat) 마스크 복원, chatLog 프레임은 sendTo 한 곳(chatStaticGuard.test.ts:143-152); chatReplay.test.ts:148-180, chatLeak.test.ts:99-143 (d) 시민 mafia·ghost 0·새 탈락자 탈락 전 mafia 줄 0 | closed |
| T-07-36 | Information Disclosure | chatLog 와이어 모양 | medium | mitigate | chatLog.ts:96-98 toWire 필드 복사(r·g·n 없음)·room.ts:858 chat 프레임도 toWire; chatLog.test.ts:193-205, leak.test.ts:102,544-560 키 허용 목록, chatReplay.test.ts:37 | closed |
| T-07-37 | Information Disclosure | 부채널(state 방송·프레임 수) | high | mitigate | applyChat/handleTyping 은 state 방송 없이 deliver 만(room.ts:858,816); chatLeak.test.ts:22-49 (a) 마피아 활동 유무로 시민 소켓 프레임 열 동일 | closed |
| T-07-38 | Denial of Service | storage 증가·쓰기 | medium | mitigate | chatLog.ts:14,16 채널별 상한(100/300/300)+20줄 묶음 삭제, room.ts:856-857,863-865 키 삭제(128개씩)·방 수명 3시간(shared/game/room.ts:20)·deleteAll(worker/room.ts:323,623)·테스트 리셋 삭제(:533-535); chatReplay.test.ts:183-240 | closed |
| T-07-39 | Tampering | 무차별 전송 재등장 | medium | mitigate | test/unit/chatStaticGuard.test.ts:122-152·154-165(ws.send 1곳·chat·typing 생성 줄은 deliver·지운 식별자 0) 통과 확인 | closed |
| T-07-40 | Information Disclosure | 시민 편 DOM 의 마피아 채널 문구·줄 | high | mitigate | ChatPanel.tsx:67-72 + src/screens/DayScene.tsx:164 chatOn = panelMode 와 view.me.chat 일치 때만; nightChat.test.tsx:179-196 시민 편 DOM 0건, scripts/e2e/flows.mjs:947-953 E2E 시민 갈래 "마피아 채팅"·"마피아끼리만"·data-ch mafia 0 단언 | closed |
| T-07-41 | Elevation of Privilege | 산 사람 화면의 유령 입력 | medium | mitigate | DayScene.tsx:164 `view.me.chat === panelMode` 일 때만 패널; shared/game/view.ts:148-149 me.chat 은 서버 channelOf 값; nightChat.test.tsx:211-226 어긋남 시험 | closed |
| T-07-42 | Tampering | smoke·bots·perf-run 의 대상 주소 | high | mitigate | smoke.mjs:139·bots.mjs:63·perf-run.mjs:603 exitIfV1(요청 전); scripts/deploy-target.test.mjs "정적 검사" :162-175 통과(33건) | closed |
| T-07-43 | Denial of Service | --chat·chatload 부하 | low | accept | 수용(AR-07-03). 개발자가 자기 방에만 돌리는 도구이고 서버 D5·연결당 20/초 한도가 그대로 막음(worker/room.ts:58-59,194; bots.mjs 는 --chat 1초 이상으로 제한, :30) | closed |
| T-07-44 | Information Disclosure | 스크립트 출력 | low | mitigate | bots.mjs 출력은 닉네임·이유 코드(:100)·횟수뿐, smoke.mjs 실패문은 닉네임만(토큰·본문 출력 없음, :207,226,712), perf-run.mjs 토큰 미출력 | closed |
| T-07-45 | Tampering | uat-* 대상 주소 | high | mitigate | uat-day.mjs:31·uat-night.mjs:38·uat-vote.mjs:35·uat-test-bots.mjs:36·uat-test-room.mjs:33 exitIfV1; deploy-target.test.mjs 통과 | closed |
| T-07-46 | Information Disclosure | 알약 표시 | high | mitigate | useChat.ts:223-228 typingSeats = 서버가 보낸 좌석(끊긴 사람 제외)+내 좌석; useChat.test.tsx:379-430 화면에서 만든 다른 좌석 알약 없음 | closed |
| T-07-47 | Denial of Service | typing 송신 빈도 | low | mitigate | chatUi.ts:34,36 TYPING_IDLE_OFF_MS=4000·TYPING_REFRESH_MS=2000, useChat.ts:101-135 켜짐 1회+갱신; 서버 1.5초(chatRules.ts:19,83); useChat.test.tsx:248-375 | closed |
| T-07-48 | Tampering | IME 중복 제출 | medium | mitigate | ChatPanel.tsx:161,270 form onSubmit 한 길·:153 300ms 같은 문장 무시; 서버 같은 문장 3초 거절(chatRules.ts:62); scripts/e2e/flows.mjs:686-741 chat-ime(CDP IME) 배포본 10/10 통과(07-21-SUMMARY) | closed |
| T-07-49 | Denial of Service | 키보드가 입력줄을 가림(사용 불가) | low | mitigate | src/net/useKeyboardLift.ts 포커스 게이트 lift·DayScene.tsx:165; keyboardLift.test.tsx; E2E chat-keyboard(flows.mjs:744+) 배포본 통과. 주의: iPhone 실기기 확인은 사용자 대기(07-DEVICE-CHECKS.md, 합격 아님) — 코드 완화는 있음 | closed |
| T-07-50 | Tampering | E2E·gallery 대상 | high | mitigate | scripts/e2e/run.mjs:74 resolveTarget→lib.mjs:174-188 assertNotV1(우회 인자 없음)·gallery.mjs:9 exitIfV1; deploy-target.test.mjs·lib.test.mjs(233건) 통과 | closed |
| T-07-51 | Repudiation | 판정 기준 완화 | low | mitigate | test/unit/e2eContract.test.ts:135-166 E2E 사본 상수(LOG_H_SHORT/TALL/KB·logHeightFor)와 src/game/chatUi.ts 일치 시험 통과 | closed |
| T-07-52 | Tampering | 페이즈 끝 배포(v1 덮어쓰기) | high | mitigate | package.json:15 deploy 체인(check-account→vite build→check-deploy-target→deploy.mjs), scripts/deploy.mjs:16-29 고정 인자·추가 인자 거부, wrangler.jsonc name minifia-v2·preview_urls false; 07-21-SUMMARY 에 "Uploaded minifia-v2" 확인; deploy-target.test.mjs 통과 | closed |
| T-07-53 | Repudiation | 기기 확인·이월 판정 근거 | low | mitigate | .planning/phases/07-free-chat/07-DEVICE-CHECKS.md 가 자동 결과·"미확인 — 사용자 확인 대기"·"미확인 — 9페이즈 이월" 행을 그대로 남김(:52-93, 합격으로 세지 않는다고 명시 :60) | closed |
| T-07-54 | Information Disclosure | 커밋 내용 | low | mitigate | `git log 1b4f675..HEAD --name-only` 133커밋 중 milestone.lock·state.json·Claude outputs·indoor-draft 포함 커밋 0건 | closed |
| T-07-55 | Spoofing | push 자격 증명 | medium | mitigate | git remote origin = git@github.com:dhkim1522/minifia.git(SSH), core.sshCommand = 개인 키 id_ed25519_personal(~/.gitconfig-personal), credential 설정에 gh setup-git 흔적 없음(시스템 Xcode gitconfig 의 osxkeychain 뿐) | closed |
| T-07-SC | Tampering | npm installs (22개 계획 전부) | high | mitigate | `git diff --stat 1b4f675..HEAD -- package.json package-lock.json` 출력 없음(1b4f675 = 첫 docs(07-01) 커밋 8024650 의 부모, 이후 133커밋), 작업 트리에도 package*.json 변경 없음 | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-07-01 | T-07-09 | 주장 기록은 원래 공개 정보였고 이 계획(07-04)은 표시를 없애기만 한다. 투표 기록 규칙(개인 여부 표 없음, 후보 선택은 공개 뒤 줄만)은 그대로다. | 계획 단계 위협 모델 | 2026-11-02 |
| AR-07-02 | T-07-11 | visibleLines 는 표시 흐름 선택일 뿐 보안 경계가 아니다. 받을 권리 없는 줄은 서버가 보내지 않는다(07-11·07-14 누설 검사가 보증). 저장소가 줄을 만들어 내지 않음은 시험으로 고정(chatStore.test.ts:157). | 계획 단계 위협 모델 | 2026-11-02 |
| AR-07-03 | T-07-43 | --chat·chatload 부하는 개발자가 자기 방에만 돌리는 도구이고, 서버 D5(600ms·5초 5줄·같은 문장 3초)와 연결당 20/초 한도가 그대로 막는다. v1.0 주소는 exitIfV1 이 거부한다. | 계획 단계 위협 모델 | 2026-11-02 |

*Accepted risks do not resurface in future audit runs.*

---

## 참고 관찰 (위협 아님, non-blocking)

1. unregistered_flag 없음: 22개 SUMMARY 의 `## Threat Flags` 는 모두 "없음/None"이거나 계획 위협에 매핑된다. 단 07-08-SUMMARY.md 에는 `## Threat Flags` 절 자체가 없다(문서 누락, 코드 갭 아님).
2. D5 도배 기록(chatRates)·입력 중 중계 기록(typingRelays)은 인메모리라 DO 하이버네이션·퇴거 뒤 비워진다. 코드 주석(worker/room.ts:79,85)이 "수용"으로 적었으나 위협 표에는 항목이 없다. 영향은 제한이 한 번 느슨해지는 것뿐이고 프레임 1024B·연결당 20/초 한도는 따로 유지된다.
3. T-07-29/T-07-44(로그·출력에 본문·토큰 없음)는 현재 코드에서 성립하지만 이를 고정하는 자동 시험이 없다. chatStaticGuard.test.ts 에 worker/room.ts 의 console 호출 인자 검사를 더하면 회귀를 막는다.
4. T-07-49 의 iPhone 16 Pro 실기기 확인은 사용자 대기 상태다(07-DEVICE-CHECKS.md 표 C 4항 "대기"). 합격으로 세지 않는다고 문서에 명시되어 있다. 코드·E2E 완화는 있다.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-02 | 56 | 56 | 0 | gsd-security-auditor (sonnet) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-02
