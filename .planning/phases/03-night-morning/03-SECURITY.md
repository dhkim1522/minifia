---
phase: "03"
slug: "night-morning"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-10-30"
---

# Phase 3 — Security (밤과 아침)

> 페이즈 보안 계약: 위협 등록부, 수용한 위험, 감사 기록. 검증 기준은 ASVS L1(완화 장치가 인용한 파일에 실제로 있는지 확인), `block_on: high`.
> 등록부는 12개 계획(03-01 ~ 03-12)의 `<threat_model>` 을 모아 중복 ID 를 합친 것이다(T-03-SC 는 모든 계획에 같은 문장으로 있어 한 줄). 근거는 2026-10-30 현재 코드 기준이다.
> 이 페이즈의 위험은 새 기술이 아니라 비공개 정보 경계다(결정 0020). 이후 페이즈가 바꾼 부분은 현재의 동등한 통제를 완화 장치로 센다(예: 역할 값 누출은 결정 0021 과 `test/worker/leak.test.ts` 가 지킨다).

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| 방 DO 알람·메시지 → tick | 알람은 늦거나 두 번 올 수 있다(at-least-once). 단계 전이는 서버 시각과 단계 표만으로 정해진다 | 서버 시각, 단계 마감 |
| 서버 view → 방 화면 | 다른 버전 번들이 모르는 단계 이름을 받을 수 있다. 화면은 view 에 있는 값만 그린다 | 단계 ID, view 필드 |
| 서버 상태(역할·선택·기록 전부) → 플레이어별 view | 한 사람에게 갈 값만 리터럴로 만든다. view 는 소켓으로 나가 그 기기에서 무엇이든 읽힐 수 있다 | 역할, 밤 선택, 수사·암살·치료 기록, 관전 정보 (높은 민감도) |
| 클라이언트 소켓 → Room DO | 모든 메시지는 위조될 수 있다. 신원은 hello 때 서버가 붙인 첨부(playerId)뿐 | pick / say / emoji / claim 메시지 |
| Room DO → 소켓들 | 소켓마다 받을 권리가 다르다(행위자·마피아·관전자·그 밖) | state 프레임, 밤 chat·emoji 이벤트 |
| 서버 난수 → 동률·문구 | 예측 가능하면 결과를 노릴 수 있다 | 동률 추첨, 아침 문구 번호 |
| 장면 → 테이블 부품 / 닉네임(사용자 입력) → DOM | 부품은 화면 값만 받는다. 닉네임은 다른 플레이어가 정한 문자열이다 | 닉네임, 관전 전용 직업 그림 입력 |
| chat·emoji 이벤트 프레임 → 화면 상태 | 서버가 보낸 프레임이지만 화면은 허용 키만 필드별로 읽는다 | chat 프레임 |
| 폰 저장소 → 본 개수 | 사용자가 바꿀 수 있는 값이다 | 본 수사 기록 개수 하나 |

---

## Threat Register

검증 방식: 선언된 완화 장치를 인용 파일에서 직접 찾았다(file:line). 관련 테스트는 이번 감사에서 실행했고 통과했다(15개 파일, 579개 테스트: night·tick·chat·view·recordsSeen·schemas·messageText·worker night·leak·alarm·nightScene·seatFloats·morning·nightChat·dayTable).

| Threat ID | Category | Component | Severity | Disposition | Mitigation (현재 코드 근거) | Status |
|-----------|----------|-----------|----------|-------------|------------------------------|--------|
| T-03-01 | Tampering | tick 따라잡기(늦은 알람이 여러 단계를 건넘) | medium | mitigate | `shared/game/tick.ts:69-99` — 새 마감 = `deadline + duration`(now 아님, :92·:98), 진입 훅은 루프 안에서만(:94-95). 테스트 `test/unit/tick.test.ts:183,194,231,295`(따라잡기·두 번 호출 동일) | closed |
| T-03-02 | Denial of Service | 알람 핸들러의 난수 누락 | medium | mitigate | `worker/room.ts:410,654,322,548` 가 `cryptoRandInt` 를 tick/startGame/skipPhase 에 넘김. 난수 없으면 `shared/game/tick.ts:36-38` `NO_RANDOM` 이 즉시 throw. 테스트 `test/unit/night.test.ts:122` | closed |
| T-03-03 | Denial of Service | 모르는 단계 view 를 받은 옛·새 번들 화면 | low | mitigate | `src/screens/RoomScreen.tsx:234`(`PHASE_ANNOUNCE[view.phase]?.(view) ?? ""`)·`:278-284`(`connecting()` '연결 중…') 폴백. 테스트 `test/client/phaseScreens.test.tsx:469` | closed |
| T-03-04 | Information Disclosure | DayTableSeat 입력 | high | mitigate | 입력의 직업 값은 관전 전용 `roleArt` 하나(`src/components/DayTable.tsx:63`)이고 `src/screens/DayScene.tsx:133,196` 에서 `meDead && view.spectate` 일 때만 만든다. 진홍·직업 그림은 장면이 넘길 때만 그려진다. 테스트 `test/client/nightScene.test.tsx:344,479,499` (살아 있는 화면 HTML 에 관전 클래스·직업 그림 0) | closed |
| T-03-05 | Tampering | 닉네임 → aria-label·이름표 | medium | mitigate | `src`·`shared`·`worker` 전체에서 `dangerouslySetInnerHTML`/`innerHTML`/`eval` 0건(grep). 이름표·aria-label 은 React 텍스트·속성(`src/components/DayTable.tsx:196,396`). 테스트 `test/client/dayTable.test.tsx:194`('<img src=x>' 는 글자로만) | closed |
| T-03-06 | Elevation of Privilege | pickTarget(시민·탈락자의 행동) | high | mitigate | `shared/game/night.ts:24-29` — night 아니면 WRONG_PHASE, 방에 없음·탈락·마피아/경찰/의사 아님은 BAD_MESSAGE. 행동 종류는 저장 역할이 정함(스키마에 종류 키 없음 `shared/schemas.ts:29`). 거부는 보낸 소켓에만 `sendRejection`(`worker/room.ts:398`). 테스트 `test/unit/night.test.ts:176-260`, `test/worker/night.test.ts:111,369` | closed |
| T-03-07 | Tampering | 마피아의 자신·동료 지목, 저장된 무효 지목 | medium | mitigate | 검증 `shared/game/night.ts:33`(마피아→마피아 BAD_MESSAGE) + 판정 재검증 `:98-99`(탈락자·마피아 표 제외). 테스트 `test/unit/night.test.ts:233,416` | closed |
| T-03-08 | Tampering | 동률·문구 추첨 난수 | medium | mitigate | 난수는 `randInt` 인자로만(`night.ts:86-89,107,144`), 운영은 `worker/random.ts:4-17` `cryptoRandInt`(거부 샘플링, `crypto.getRandomValues`). `night.ts` 코드에 `Math.random`·`Date.now`·`crypto.` 사용 없음(grep: 주석 한 줄에 단어만 있음) | closed |
| T-03-09 | Denial of Service | randInt(0) RangeError 로 알람 재시도 반복 | medium | mitigate | `night.ts:107`(동률 2 이상일 때만 호출)·`:143-144`(후보 문구 ≥ 6개). `worker/random.ts:6` 은 n≤0 을 RangeError 로 막음. 테스트 `test/unit/night.test.ts:541`('어떤 경로에서도 인자 0 호출이 없다') | closed |
| T-03-10 | Information Disclosure | 아침 결과에 직업·구출 여부 | high | mitigate | `shared/game/night.ts:170` morning 은 `{}` 또는 `{eliminated, phrase}` 뿐(의사 구출과 지목 없음 동일), `shared/game/view.ts:95-104` 필드별 복사. 화면 `src/game/eliminationText.ts:42,58` 두 경우 같은 MORNING_SAFE. 테스트 `test/unit/night.test.ts:627,438`, `test/unit/eliminationText.test.ts:83-94` | closed |
| T-03-11 | Information Disclosure | 밤 메시지 보낸 사람 규칙 | high | mitigate | `shared/game/chat.ts:74` — 밤에 마피아가 아니면 WRONG_PHASE(`senderOf`, :70-76), say·emote 둘 다 이 함수 통과. 테스트 `test/worker/night.test.ts:192,212`, `test/unit/chat.test.ts` | closed |
| T-03-12 | Elevation of Privilege | 탈락자의 say·emote·claim | medium | mitigate | `shared/game/chat.ts:73`, `shared/game/claim.ts:69`, `shared/game/night.ts:26` — 탈락자 BAD_MESSAGE, 거부 경로에서 상태 반환 없음. 테스트 `test/worker/night.test.ts:369,388` | closed |
| T-03-13 | Tampering | 때가 다른 템플릿(낮 문구를 밤에 등) | low | mitigate | `shared/game/chat.ts:103-104` `when !== whenOf(state.phase)` → BAD_MESSAGE. `shared/schemas.ts:24-30` say 는 strictObject. 테스트 `test/worker/night.test.ts:212` | closed |
| T-03-14 | Information Disclosure | me.allyPicks | high | mitigate | `shared/game/view.ts:185-191` — 밤·생존 마피아일 때만 키 생성, 대상 seat 집합(누가 골랐는지 없음). 테스트 `test/unit/view.test.ts:938,947,955,965,976` | closed |
| T-03-15 | Information Disclosure | me.records(남의 역할 한 비트) | high | mitigate | `shared/game/view.ts:195-201` — 본인 역할의 일지 하나만(경찰 `{n,target,isMafia}`). 계획 후 결정 0026-7 이 마피아·의사 일지를 더했으나 각자 본인 일지뿐이며 직업 이름은 어느 줄에도 없다(동등한 통제). 시민 키 없음. 테스트 `test/unit/view.test.ts:993,1034,1047,1079,1124`, `test/worker/leak.test.ts:354-367,415,438-446` | closed |
| T-03-16 | Information Disclosure | 서버 전용 필드·역할 값 경로 | high | mitigate | `shared/game/view.ts:127-246` 모든 항목 허용 목록 리터럴. 전수 검사 `test/unit/view.test.ts:158-182,262-291,635,1124,1309,1331`(최상위 키 허용 목록, 서버 전용 키 금지, 역할 값 허용 경로), `test/worker/leak.test.ts:85` | closed |
| T-03-17 | Information Disclosure | 본인 선택(me.pick) | medium | mitigate | `shared/game/view.ts:170-172` — 밤·생존 본인만. 테스트 `test/unit/view.test.ts:895,976,1295` | closed |
| T-03-18 | Tampering | chat 프레임 → 로그(XSS·잘못된 값) | medium | mitigate | `src/net/seatFloats.ts:120-128` `toChatLine` 허용 키 복사·모르는 template 버림. 문장은 `src/components/MessageLog.tsx:55` `messageText` 로 만든 React 텍스트. 테스트 `test/client/seatFloats.test.tsx:209-237` | closed |
| T-03-19 | Information Disclosure | 낮 줄·밤 줄 섞임, 밤이 끝나도 남는 마피아 줄 | medium | mitigate | `src/net/seatFloats.ts:26-30,131-151` — 열쇠 `${일차}:${단계}` 가 바뀌면 줄 비움. 서버 쪽 범위 제한은 T-03-21. 테스트 `test/client/seatFloats.test.tsx:277,288,297,305` | closed |
| T-03-20 | Information Disclosure | pick 뒤 state 전송 범위 | high | mitigate | `worker/room.ts:436` `sendViewTo(pickRecipientIds(...))` — 전원 방송 아님, 수신자는 `shared/game/night.ts:189-197`(행위자 쪽 + 탈락자). 테스트 `test/worker/night.test.ts:83,175,327`, `test/unit/night.test.ts:310-346` | closed |
| T-03-21 | Information Disclosure | 밤 chat·emoji 방송 범위 | high | mitigate | `worker/room.ts:361,385` `broadcastEventTo(..., nightChatRecipientIds(this.room))`, 수신자 `shared/game/night.ts:203-205`(탈락자·마피아). 테스트 `test/worker/night.test.ts:192,348` | closed |
| T-03-22 | Spoofing | 메시지의 신원·행동 종류 | high | mitigate | 신원은 `handlePick` 의 소켓 첨부 `att.playerId`(`worker/room.ts:417-423`), 행동 종류는 저장 역할(`night.ts:27`). `shared/schemas.ts:29` pick 은 strictObject `{t,target}` 라 seat·역할 키는 BAD_MESSAGE(`worker/room.ts:173-177`). 테스트 `test/worker/night.test.ts:111`, `test/unit/schemas.test.ts` | closed |
| T-03-23 | Tampering | 마감 직후 pick 끼워넣기 | medium | mitigate | `worker/room.ts:181` 모든 메시지 처리 앞 `await this.advance(Date.now())`, 이후 `night.ts:24` WRONG_PHASE. 테스트 `test/worker/night.test.ts:398` | closed |
| T-03-24 | Tampering | 알 수 없는 키·범위 밖 값 | medium | mitigate | `shared/schemas.ts:29` `z.strictObject({ t, target: z.number().int().min(0).max(7) })`; 서버 규칙 `night.ts:30-31`. 테스트 `test/worker/night.test.ts:111` | closed |
| T-03-25 | Denial of Service | pick 폭주 | low | accept | 수용 근거(03-07 계획): 연결당 1초 20개 속도 제한 기존, 같은 값 재선택은 저장·전송 없음 → 추가 비용 없음. 기존 제한이 실제로 있음: `worker/room.ts:53-54,160`, 무전송 `worker/room.ts:433`. 아래 Accepted Risks Log AR-03-01 | closed |
| T-03-26 | Information Disclosure | 장면이 남의 역할을 추측해 그림 | high | mitigate | `src/screens/DayScene.tsx:130-134,194-196` — 실제 직업 줄·관전 배지·마피아 링은 `meDead && view.spectate` 한 곳에서만. 테스트 `test/client/nightScene.test.tsx:220,344,479,499` (살아 있는 화면 DOM 에 관전 클래스·직업 그림·마피아/시민 하단 역할 이름 없음) | closed |
| T-03-27 | Tampering | 낙관적 선택이 서버와 어긋남 | low | mitigate | `src/screens/DayScene.tsx:128-153` `pending.view === view` 일 때만 낙관값, 새 view 가 오면 `view.me.pick` 을 따름. 거부 시 서버가 state 재전송(`worker/room.ts:398` `sendRejection`). 테스트 `test/client/nightScene.test.tsx:137,159` | closed |
| T-03-28 | Information Disclosure | 한 판 전체 프레임(밤 행동·채팅·관전·기록) | high | mitigate | `test/worker/leak.test.ts:91-470`(6명 두 밤 전수: 살아 있는 소켓 spectate 0 `:340-352`, records 역할 본인만 `:354-367,415`, allyPicks `:368`, 낮 seq 연속·밤 seq `:312-313,387-390`, 역할 값 허용 경로 `:85`) — 위 view/수신자 통제와 함께 통과 | closed |
| T-03-29 | Repudiation | 계약·규칙 기록 누락 | low | mitigate | `docs/decisions/0020-night-morning-contract.md` 가 와이어 계약·판정 규칙표·되돌리기 비용을 기록 | closed |
| T-03-30 | Information Disclosure | 아침 카드·안내 | medium | mitigate | `src/game/eliminationText.ts:55-59` 입력은 `MorningView`(탈락 seat·번호)와 닉네임 조회뿐, 직업 글자 없음. 의사 구출과 지목 없음이 같은 `MORNING_SAFE`(:42). 테스트 `test/unit/eliminationText.test.ts:83-94` | closed |
| T-03-31 | Denial of Service | 범위 밖 문구 번호 | low | mitigate | `src/game/eliminationText.ts:23-27`(번호가 1..7 정수 아니면 첫 문구), `:55-59`(닉네임 못 찾으면 무사 문구) — 예외 경로 없음. 테스트 `test/unit/eliminationText.test.ts` | closed |
| T-03-32 | Information Disclosure | 폰 저장소의 수사 기록 | medium | mitigate | `src/net/recordsSeen.ts:49-58` 키 `minifia:records:{코드}` 에 개수(`String(count)`) 하나만 저장, 기록 내용·토큰 저장 없음. 테스트 `test/unit/recordsSeen.test.ts:7-55` | closed |
| T-03-33 | Tampering | 저장된 본 개수 위조 | low | mitigate | `src/net/recordsSeen.ts:32-36` `parseCount` — 0 이상 정수 문자열 아니면 0, `:61-63` `unseenCount` 는 음수가 되지 않음. 서버 값에 영향 없음. 테스트 `test/unit/recordsSeen.test.ts:22-36,58` | closed |
| T-03-34 | Information Disclosure | 받는 사람 계산(밤 행동 state·밤 채팅) | high | mitigate | `shared/game/night.ts:189-205` — `pickRecipientIds`(행위자 쪽 + 탈락자)·`nightChatRecipientIds`(탈락자 + 마피아) 모두 살아 있는 비행위자·비마피아를 넣지 않음. 테스트 `test/unit/night.test.ts:310-385` | closed |
| T-03-35 | Information Disclosure | [수사 기록] 버튼 존재가 경찰임을 드러냄(옆에서 보기) | low | accept | 수용 근거(03-11 계획): 결정 0018 — 엿보기·캡처는 플레이어 매너, 서버는 남의 역할을 보내지 않는다. 결정 문서 `docs/decisions/0018-online-first-offline-capable.md` 존재. 아래 AR-03-02 | closed |
| T-03-36 | Elevation of Privilege | 잘못된 Cloudflare 계정으로 배포 | high | mitigate | 코드로 강제되는 통제가 아니라 배포 직전 절차(`npx wrangler whoami` 확인). 실행 기록: `03-12-SUMMARY.md:70`(= `dhkim1522@naver.com` 확인 후 배포, Version `b4f4fc9e-…`). 배포 주소는 개인 workers.dev(`https://minifia.dhplay.workers.dev`). 이후 재배포에서도 같은 절차가 필요함(비차단 메모 참고) | closed |
| T-03-37 | Information Disclosure | spectate(모든 실제 직업·밤 행동) | high | mitigate | `shared/game/view.ts:226-244` — `def.revealsOwnRole && !isAlive(me)` 일 때만 키 생성, picks 는 밤에만. 테스트 `test/unit/view.test.ts:1219-1241,1309`, `test/worker/leak.test.ts:340-352,675`, `test/worker/night.test.ts:315,327` | closed |
| T-03-38 | Information Disclosure | 스크립트 출력의 토큰 | medium | mitigate | `scripts/uat-night.mjs` 의 `console.log`(:107,136,140,153,225,233,307-309,314)에 token 출력 없음, `scripts/smoke.mjs`·`scripts/bots.mjs` 도 token 을 찍지 않음(grep `console.*token` 0건). 오히려 프레임에 토큰이 없음을 검사(`uat-night.mjs:301-302`, `smoke.mjs:215,685-690`) | closed |
| T-03-39 | Information Disclosure | 배포본의 밤·관전 경계 | high | mitigate | `scripts/uat-night.mjs:209-222,264,298,302`(비마피아 밤 chat·emoji 0, 살아 있는 클라이언트 spectate·job 키 0, records 역할별), `scripts/smoke.mjs:616-631,881-887`(night 뷰·spectate 는 탈락 뒤 프레임에만), `scripts/bots.mjs`. 배포본 실행 기록은 `03-12-SUMMARY.md:60,95-` | closed |
| T-03-SC | Tampering | npm installs | high | mitigate | 새 패키지 없음: `git diff f9c8781^..68d3a6d -- package.json package-lock.json`(03 계획 첫·마지막 커밋 범위) 변경 0. 현재 `package.json` 의존성은 react·react-dom·zod 뿐(고정 버전) | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on (high) count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

집계: 총 41건(T-03-01 ~ T-03-40 + T-03-SC). mitigate 39건, accept 2건, transfer 0건. 닫힘 41, 열림 0.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-03-01 | T-03-25 | pick 폭주(DoS, low): 연결당 1초 20개 속도 제한(`overRateLimit`)이 이미 있고, 같은 값 재선택은 저장·전송이 없어 추가 비용이 없다. 한도 안의 변경 연타는 밤 행동자 쪽 소수에게만 state 가 간다. | 03-07 계획(승인된 계획의 수용 처분), 이번 감사에서 근거 코드 확인 | 2026-10-30 |
| AR-03-02 | T-03-35 | [수사 기록] 버튼 존재로 경찰임이 옆 사람 화면에 보일 수 있음(low): 결정 0018 — 엿보기·캡처는 온라인 게임의 플레이어 매너로 둔다. 서버는 남의 역할을 보내지 않는다(결정 0002·0021). | 03-11 계획(승인된 계획의 수용 처분), 결정 0018 | 2026-10-30 |

*Accepted risks do not resurface in future audit runs.*

---

## 비차단 메모 (위협 상태를 바꾸지 않음)

- **T-03-36 은 절차 통제다.** 코드가 계정을 강제하지 않는다(`package.json` 의 `deploy` 는 `vite build && wrangler deploy`, `wrangler.jsonc` 에 `account_id` 없음). 이 페이즈의 배포 때는 확인 기록이 있어 닫았다. 이후 배포마다 `npx wrangler whoami` 로 `dhkim1522@naver.com` 을 확인하는 습관이 필요하다. 코드로 막고 싶으면 `deploy` 앞에 계정 확인 단계를 두거나 `wrangler.jsonc` 에 `account_id` 를 고정하는 방법이 있다(선택).
- **계획 이후 바뀐 부분의 현재 동등 통제**: T-03-04 는 입력에 관전 전용 `roleArt` 가 생겼고(03.1-10), T-03-15 는 일지가 마피아·의사로 넓어졌다(결정 0026-7). 둘 다 계획 문장 그대로는 아니지만 "받을 사람의 서버 값이 있을 때만" 이라는 의도는 코드와 테스트로 지켜진다.
- `night.ts` 의 `crypto` 단어는 주석(:2 `cryptoRandInt`)에만 있다.

## Unregistered Flags

없음. 12개 SUMMARY 의 `## Threat Flags` 는 모두 "없음"이며 언급된 위협 ID 는 모두 등록부에 있다. 이번 감사에서 별도로 찾은 등록되지 않은 공격면도 없다.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-30 | 41 | 41 | 0 | gsd-security-auditor |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-30
