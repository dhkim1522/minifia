---
phase: "02"
slug: "day-discussion"
status: verified
# threats_open = workflow.security_block_on(high) 이상인 미해결 위협 수
threats_open: 0
asvs_level: 1
created: "2026-10-30"
---

# Phase 2 — Security (낮 토론)

> 페이즈 보안 계약: 위협 등록부, 수용 위험, 감사 기록. 18개 계획(02-01 ~ 02-18)의 `<threat_model>` 을 합쳐 중복 ID 를 제거했다(T-02-01 ~ T-02-49 + T-02-SC, 총 50개). 검증은 2026-10-30 현재 코드 기준이다. 이후 페이즈(0017-5, 0017-7, 0021, 0023, 0027, 0036)가 플랜의 완화를 대체한 항목은 현재의 등가 통제를 근거로 닫았다.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| 서버 시계 → 단계 전환 | 단계·마감·일차는 DO 서버 시각(`tick(state, now)` 의 인자)으로만 바뀐다. 클라이언트 입력에는 권위가 없다 | 단계, 마감 시각 |
| 클라이언트 WebSocket 프레임 → Room DO | 비신뢰 입력. 크기(1024B) → 연결당 속도(20/초) → zod 스키마(`strictObject`) → 도메인 규칙 → 플레이어 단위 쿨다운 순서로 거른다. 신원은 hello 때 서버가 붙인 소켓 첨부 `playerId` 뿐이다 | claim, say, emoji 메시지 |
| 서버 RoomState → 플레이어별 RoomView / chat 프레임 | 남의 역할과 마감 전 남의 선택이 새면 안 된다. 허용 목록 리터럴로만 만든다 (결정 0002·0021) | 역할, 주장, 채팅 줄 |
| DO storage(옛 모양) → 새 코드 | 깨어날 때 `normalizeStoredRoom` 으로 정규화한다 | 저장된 방 상태 |
| 서버 프레임 → 클라이언트 렌더 | 허용 키만 필드별로 복사하고, 문장은 템플릿 ID 로 화면이 만들며, React 텍스트로만 그린다 | 닉네임, chat 줄 |
| 브라우저 → POST /api/rooms, /join | 닉네임은 비신뢰 입력. 서버가 공용 `validateNickname` 으로 다시 검사한다 | 닉네임 |
| 개발 PC → Cloudflare / GitHub | 개인 계정(dhplay)과 개인 SSH 원격만 쓴다 | 배포, push |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation (현재 코드 증거) | Status |
|-----------|----------|-----------|----------|-------------|-----------------------------|--------|
| T-02-01 | Tampering | shared/game/tick.ts | high | mitigate | `tick(state, now, randInt)` 가 시각을 인자로만 받는다. `shared/` 안에 `Date.now`/`new Date` 호출 0건. `ClientMessage` 스키마에 단계·마감 필드 없음. 진입 훅은 `ON_ENTER` 표로 tick 루프 안에서만. 예외: 옛 저장 방 정규화가 `enterClaim` 을 직접 부르지만 서버 시각만 쓰고 클라이언트가 닿을 수 없다 | closed |
| T-02-02 | Information Disclosure | DayView.roles / rolesInPlay | low | accept | 이번 판 구성은 인원에서 정해지는 공개 정보(D-07). 실제 배정은 싣지 않음. AR-02-01 | closed |
| T-02-03 | Information Disclosure | view 전수 누출 검사 | high | mitigate | `test/unit/view.test.ts` (4~8명 × 14단계 × 전원 × 시드 3, 14단계 허용 키 전수) | closed |
| T-02-04 | Information Disclosure | claim 마감 전 선택 (대체: 0023·0027) | high | mitigate | 마감 전 선택은 서버 전용 `claimPick`, 차례가 끝날 때만 `claimLog` 로 공개 (`shared/game/claim.ts`). `buildDay` 는 `claimPick` 을 싣지 않음. `view.test.ts`, `test/worker/day.test.ts` | closed |
| T-02-05 | Tampering | selectClaim | medium | mitigate | 단계 → 방 소속 → 생존 → 차례 → `claimOptions` 순서 고정. `test/unit/claim.test.ts` | closed |
| T-02-06 | Information Disclosure | selectClaim 판정 경로로 역할 추론 | high | mitigate | `claim.ts`·`discussion.ts`·`tick.ts` 에 `.role` 참조 0건. `claim.test.ts`(판정은 실제 역할과 무관) | closed |
| T-02-07 | Tampering | chat say (자유 텍스트 주입) | high | mitigate | line 을 필드별 리터럴로 만든다 (`shared/game/chat.ts`). `say` 스키마는 `strictObject`. `day.test.ts`(text 키 거부) | closed |
| T-02-08 | Spoofing | chat say/emote | high | mitigate | 보낸 사람은 `actorId` 로 서버 상태에서 찾음. 와이어에 보낸 사람 필드 없음. `day.test.ts`(frame.seat = 보낸 소켓 자리) | closed |
| T-02-09 | Denial of Service | messages 보관 (대체: 0017-7) | medium | mitigate | 플레이어 단위 쿨다운 1800ms, 연결당 20/초 (`worker/room.ts`). 메시지를 저장하지 않음. `day.test.ts` | closed |
| T-02-10 | Elevation of Privilege | extend/skip (대체: 0017-5) | high | mitigate | extend/skip 제거, 참조 0건. `day.test.ts`(방장·손님 모두 BAD_MESSAGE) | closed |
| T-02-11 | Tampering | say 대상·직업 값 | medium | mitigate | 템플릿 고유 속성, 대상 정수·앉은 seat·본인 아님·생존, 직업은 `rolesInPlay` 안. `test/unit/chat.test.ts` | closed |
| T-02-12 | Information Disclosure | view claim 단계 | critical | mitigate | `buildDay` 허용 목록 리터럴, `claimDone`/`claims` 키 없음. `view.test.ts`, `scripts/smoke.mjs` 서버 전용 키 금지 목록 | closed |
| T-02-13 | Information Disclosure | buildView role 값 | critical | mitigate | `role` 은 `me.role` 에만, 관전은 결정 0021 로 탈락자 한정. `view.test.ts`, `test/worker/leak.test.ts`(실제 프레임 전수) | closed |
| T-02-14 | Denial of Service | 저장된 옛 방 | medium | mitigate | `normalizeStoredRoom` 정규화, 읽는 쪽 기본값. `day.test.ts`, `view.test.ts` | closed |
| T-02-15 | Tampering | shared/schemas.ts | high | mitigate | claim·say·emoji 는 `z.strictObject` + enum·정수 범위. `day.test.ts` | closed |
| T-02-16 | Spoofing | worker/room.ts 핸들러 | high | mitigate | 모든 핸들러가 소켓 첨부 `playerId` 만 사용, 와이어에 보낸 사람 필드 없음 | closed |
| T-02-17 | Information Disclosure | claim 단계 프레임 | critical | mitigate | `day.test.ts`(프레임 경로 훑기), `leak.test.ts` | closed |
| T-02-18 | Denial of Service | 알람·도배 | medium | mitigate | extend/skip 제거로 reschedule 없음. 이모티콘은 방송 없이 이벤트만. 쿨다운 + 연결당 한도 (`test/worker/reconnect.test.ts`, `day.test.ts`) | closed |
| T-02-19 | Tampering | 단계 경계 경합 | medium | mitigate | 모든 메시지 처리 전 `advance(Date.now())`. 마감 뒤 claim·say 는 WRONG_PHASE (`day.test.ts`) | closed |
| T-02-20 | Elevation of Privilege | extend·skip (대체: 0017-5) | high | mitigate | T-02-10 과 같다 | closed |
| T-02-21 | Tampering | messageText / 렌더 | medium | mitigate | 서버는 템플릿 ID 만, 문장은 `src/game/messageText.ts`. `src/` 에 `dangerouslySetInnerHTML`/`innerHTML` 등 0건 | closed |
| T-02-22 | Denial of Service | useRoomConnection 이벤트 | low | mitigate | 이벤트를 상태로 쌓지 않고 ref Set 으로 전달 (`src/net/useRoomConnection.ts`) | closed |
| T-02-23 | Information Disclosure | DayTable 입력 | high | mitigate | `DayTableSeat` 에 role 키 없음(타입 테스트 `test/client/dayTable.test.tsx`). 직업 그림은 탈락 viewer 의 `view.spectate` 가 있을 때만 (결정 0021) | closed |
| T-02-24 | Tampering | 닉네임·말풍선 렌더 | medium | mitigate | React 텍스트와 `title` 로만. `dayTable.test.tsx`(`<img src=x>` 닉네임이 요소가 되지 않음) | closed |
| T-02-25 | Information Disclosure | ClaimPanel 마크업 | high | mitigate | 칩 목록은 `view.day.roles` + "none". `test/client/claimPanel.test.tsx`(마피아·시민 패널 HTML 동일) | closed |
| T-02-26 | Tampering | 낙관적 선택 | low | mitigate | 새 서버 view 가 오면 낙관 선택을 버림 (`src/net/useViewChoice.ts`) | closed |
| T-02-27 | Tampering | QuickMessageSheet payload | medium | mitigate | 입력칸 없음, payload 는 타입 리터럴, 최종 방어는 서버 strict 스키마 | closed |
| T-02-28 | Information Disclosure | 대상 후보 목록 | low | accept | `view.players` 의 닉네임·seat 만. AR-02-02 | closed |
| T-02-29 | Elevation of Privilege | 방장 줄 (대체: 0017-5) | high | transfer | 권한 판정은 서버. 현재는 방장 줄·메시지 자체가 없고 서버 스키마가 거부 | closed |
| T-02-30 | Denial of Service | 연타 | low | mitigate | 보낸 뒤 2초 잠금, RATE_LIMITED 수신 시 재잠금 (`src/net/useSendLock.ts`) | closed |
| T-02-31 | Tampering | 로그·말풍선 렌더 | medium | mitigate | `messageText` 문자열 + React 텍스트. `test/client/discussion.test.tsx` | closed |
| T-02-32 | Information Disclosure | 배포본 claim 프레임 | critical | mitigate | 스모크가 모든 프레임에서 허용 경로·서버 전용 키·토큰을 훑는다. 02-11·02-18 배포본 실행 기록 | closed |
| T-02-33 | Spoofing | 배포 계정 | high | mitigate | 절차 통제: 배포 전 `wrangler whoami` 개인 계정 확인(02-11, 02-18 SUMMARY). 감사 메모 2 | closed |
| T-02-34 | Tampering | git push | medium | mitigate | 원격은 개인 SSH 하나, 전역 git 설정에 credential 재정의 없음 | closed |
| T-02-35 | Information Disclosure | chat 프레임 | high | mitigate | chat 프레임 키 집합 고정 (`day.test.ts`), 스모크 키 허용 집합 | closed |
| T-02-36 | Spoofing | handleSay 보낸 사람 | high | mitigate | 소켓 첨부 `playerId` 로 서버 상태에서 찾음. `day.test.ts` | closed |
| T-02-37 | Denial of Service | 전송 한도 2000 → 1800ms | medium | mitigate | 플레이어 단위 영속 `lastSendAt`, 연결당 20/초 유지 | closed |
| T-02-38 | Information Disclosure | DO 저장소의 옛 messages | low | mitigate | `normalizeStoredRoom` 이 옛 `messages` 키 제거. `day.test.ts` | closed |
| T-02-39 | Tampering | 닉네임 길이 우회 | low | mitigate | 서버 `validateNickname`(5 그래핌) → 400. `test/worker/join.test.ts` | closed |
| T-02-40 | Information Disclosure | DayTable 입력 | medium | mitigate | T-02-23 과 같다 | closed |
| T-02-41 | Tampering | 닉네임 렌더 (XSS) | medium | mitigate | `dayTable.test.tsx` | closed |
| T-02-42 | Elevation of Privilege | 단계 마감 조작 경로 | medium | mitigate | extend·skip 은 스키마에 없어 BAD_MESSAGE. `day.test.ts`(단계·마감·알람 불변) | closed |
| T-02-43 | Tampering | 옛 클라이언트 와이어 표류 | low | mitigate | 옛 탭의 extend·skip 은 오류만 받음, 옛 `extendUsed` 는 화면이 무시 | closed |
| T-02-44 | Information Disclosure | 이름표 아랫줄 (대체: 0023) | medium | mitigate | 이름표는 이름 한 줄, 남의 주장은 채팅에서만. 완료 표시 키·`claims` 가 view 에 없음 | closed |
| T-02-45 | Tampering | chat 프레임 → 채팅 줄 | medium | mitigate | `toChatLine` 허용 키만 복사, 모르는 template 버림 (`src/net/seatFloats.ts`). `test/client/seatFloats.test.tsx` | closed |
| T-02-46 | Information Disclosure | 채팅 내역 모달 | low | mitigate | 이 폰이 받은 줄(props)만 그림, 서버 요청 없음 (결정 0017-7) | closed |
| T-02-47 | Tampering | 모달·로그 렌더 (XSS) | medium | mitigate | `discussion.test.tsx`, `MessageLog.tsx` | closed |
| T-02-48 | Information Disclosure | 배포본 chat·state 프레임 | high | mitigate | 스모크: `messages`·`extendUsed` 키 부재, chat 허용 키, `id`/`role`/`token` 부재. 02-18 5명·8명 통과 | closed |
| T-02-49 | Spoofing | 배포 계정 | medium | mitigate | 배포 직전 `wrangler whoami` 개인 계정 확인(02-18), push 는 개인 SSH | closed |
| T-02-SC | Tampering | npm installs | high | mitigate | 페이즈 2 커밋 범위에서 `package.json`·`package-lock.json` 변경 0건 | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — workflow.security_block_on(high) 이상인 미해결 위협만 `threats_open` 에 센다*
*Disposition: mitigate (구현 필요) · accept (문서화된 위험) · transfer (제3자)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-02-01 | T-02-02 | 이번 판 직업 구성(`day.roles`, `rolesInPlay`)은 인원에서 정해지는 공개 정보다(사용자 결정 D-07). 실제 역할 배정은 싣지 않는다 | 사용자 (D-07) / 02-01-PLAN | 2026-10-24 |
| AR-02-02 | T-02-28 | 대상 후보 목록은 공개 정보(`view.players` 의 닉네임·seat)만 쓰고 역할과 무관하다 | 02-10-PLAN | 2026-10-24 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-30 | 50 | 50 | 0 | gsd-security-auditor |

### 감사 메모 (차단 아님)

1. **대체된 완화.** T-02-04, 09, 10, 18, 20, 29, 42, 44 는 플랜 문구와 다른 현재 구현(연장·넘기기 제거, 채팅 비저장, 순차 주장)이 같은 위협을 더 강하게 막는다. 플랜 문서의 파일명(예: `Table.tsx`, `DiscussionControls` 방장 줄)은 낡았다.
2. **절차 통제.** T-02-33, 34, 49 는 배포 전 계정 확인 같은 절차라 코드 증거가 없고 실행 기록과 git 상태로 확인했다. `npm run deploy` 에 `whoami` 가드가 없다. 선택 권고: 배포 스크립트에 계정 확인을 넣는다.
3. **T-02-01 경미한 예외.** `normalizeStoredRoom` 이 `enterClaim` 을 직접 호출한다. 서버 부팅 시 옛 방 보정이고 클라이언트가 닿을 수 없다.
4. **비등록 플래그.** 없음.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-30
