---
phase: "1"
slug: "walking-skeleton"
status: verified
# threats_open = 차단 기준(block_on: high) 이상의 열린 위협 수
threats_open: 0
asvs_level: 1
created: "2026-10-30"
---

# 1페이즈 (걷는 뼈대) — 보안

> 페이즈별 보안 계약: 위협 등록부, 수용한 위험, 감사 기록.
> 검증 기준: ASVS L1(완화가 코드에 존재하는지 확인), `block_on: high`. 2026-10-30 현재 코드 기준이다. 뒤 페이즈가 바꾼 완화는 현재의 동등한 통제를 근거로 센다(결정 0002 → 0021 → 0036, 누출 테스트 `test/unit/view.test.ts`·`test/worker/leak.test.ts`).

---

## 신뢰 경계

| 경계 | 설명 | 지나는 데이터 |
|------|------|---------------|
| npm 레지스트리 → 개발 PC | 외부 패키지 코드가 설치·빌드 때 실행된다 | 패키지 코드 (공급망) |
| 개발 PC → Cloudflare 계정 | 배포가 어느 계정으로 가는지 결정된다 | 배포 자격 증명 |
| 저장소 → GitHub(개인 원격) | 커밋되는 파일에 비밀값이 섞이면 밖으로 나간다 | 소스·인계 문서 |
| 브라우저 → Worker HTTP (`/api/rooms`·미리보기·참가) | 익명 인터넷 입력, 4자리 코드만 알면 누구나 부른다 | 닉네임, 방 코드, 미리보기 응답 |
| 브라우저 → Room DO WebSocket | 익명 소켓, `hello` 토큰이 유일한 신원 증명 | 토큰(hello 본문), 클라이언트 메시지 |
| Room DO 내부 상태 → 각 브라우저 | 플레이어마다 다른 뷰가 나가는 경계(프로젝트 핵심 불변식) | RoomView, 역할, 동료, 토큰, 내부 id |
| 서버 난수·서버 시계 → 역할 배정·단계 전환 | 예측되거나 클라이언트가 움직일 수 있으면 판이 깨진다 | 난수, 마감 시각 |
| 사용자 닉네임 → 서버·다른 플레이어 화면 | 유일한 공개 식별자이고 모든 참가자 화면에 그려진다 | 닉네임 문자열 |
| 브라우저 localStorage ↔ 앱 ↔ 주소창·공유 시트 | 토큰이 저장되는 유일한 장소, 밖으로 나가는 링크 | 토큰, 방 코드, 공유 링크 |
| 서버 view → 역할 카드·단계 화면·이미지 요청 | 화면 구조·요청 패턴으로 역할이 드러나면 안 된다 | me.role, me.allies |
| 스모크·배포 정적 파일 → 공개 배포본·메신저 스크랩 | 실제 서비스에 방이 만들어지고 OG·그림이 캐시된다 | 방 코드, 정적 파일 |
| 주소 쿼리 `?sheetdebug=1` → 클라이언트 계측 | 누구나 플래그 링크를 보낼 수 있다 | 시트 기하 값 |
| 브라우저 뷰포트·프레임 스케줄러 → 시트 위치·열림 상태 | 프레임이 없거나 툴바가 가리면 시트를 못 쓸 수 있다 | 레이아웃 값 |

---

## 위협 등록부

계획 19개(01-01 ~ 01-19)의 `<threat_model>` 을 합쳐 중복 ID(`T-01-SC` 는 계획마다 반복)를 하나로 줄였다. 총 68개: mitigate 57, accept 11. 상태 `closed` 는 현재 코드·테스트에서 완화(또는 문서화된 수용)를 확인했다는 뜻이다.

| Threat ID | Category | Component | Severity | Disposition | Mitigation (근거) | Status |
|-----------|----------|-----------|----------|-------------|-------------------|--------|
| T-01-01 | Spoofing | wrangler.jsonc / 배포 계정 | high | mitigate | `wrangler.jsonc` 에 `account_id` 없음(`git grep account_id` 0건, `git log -S account_id -- wrangler.jsonc` 0건). 로그인 계정 확인은 01-02-SUMMARY:151, 01-14-SUMMARY:62 (`npx wrangler whoami` 개인 계정) | closed |
| T-01-02 | Information Disclosure | .gitignore | medium | mitigate | `.gitignore` 에 `.env`, `.env.*`, `.dev.vars`, `.wrangler/`, `dist/`, `worker-configuration.d.ts`. 추적 중인 해당 파일 0건(`git ls-files`) | closed |
| T-01-03 | Information Disclosure | view.ts buildView / room.ts 방송 | high | mitigate | `shared/game/view.ts:131-139` PublicPlayer 는 `{seat,nickname,connected,isHost,alive}` 객체 리터럴(`alive` 는 공개 정보로 뒤 페이즈가 추가). `shared/protocol.ts:250-256` 에 토큰·id 자리 없음. `test/worker/http.test.ts:103` 프레임에 토큰 없음, `test/unit/view.test.ts:636` 다섯 키 고정 | closed |
| T-01-04 | Information Disclosure | 토큰 전달 경로 | medium | mitigate | 토큰은 `hello` 본문으로만(`src/net/useRoomConnection.ts:182`), WS 주소 고정(`roomSocketUrl` :53, `worker/index.ts:25` WS_PATH). 로그는 `worker/room.ts:691` 의 오류 이름뿐. `scripts/smoke.mjs` 는 토큰 값을 출력하지 않음(`:215` 원문 검사). `test/unit/roomSocketUrl.test.ts` | closed |
| T-01-05 | Denial of Service | Room.webSocketMessage | medium | mitigate | `worker/room.ts:161-164` 비문자열·1024바이트 초과 시 1009 닫힘, `:168-177` JSON·`ClientMessageSchema` 실패는 `BAD_MESSAGE` 만 응답. `shared/protocol.ts:17` MAX_FRAME_BYTES. `test/worker/http.test.ts:156,174` | closed |
| T-01-06 | Tampering | POST /api/rooms 코드 충돌 | medium | mitigate | `worker/room.ts:103-104` 살아 있는 방이면 `CODE_TAKEN`(덮어쓰기 없음), `worker/allocate.ts:6,24-30` 최대 8번 재시도. `test/worker/allocate.test.ts:11,27`, `http.test.ts:67` | closed |
| T-01-07 | Denial of Service | 버려진 방 DO | low | mitigate | 생성 때 알람(`room.ts:120` reschedule → `nextWakeAt`), 만료 시 소켓 닫고 `deleteAll`(`:640-651`). 만료는 아무도 접속 안 하면 10분(`shared/game/room.ts:25,159`, WR-05), 접속하면 3시간. `test/worker/alarm.test.ts:101,159,171` | closed |
| T-01-08 | Tampering | HTTP 본문 | medium | mitigate | `worker/index.ts:30-41` content-length·실제 바이트 모두 1024 상한, JSON 파싱, `:46`·`:79` zod 스키마(`shared/schemas.ts:6-9`) 실패 시 400. `test/worker/http.test.ts:75-91`, `join.test.ts:100` | closed |
| T-01-09 | Denial of Service | hello 없이 열어 둔 익명 소켓 | low | accept | 수용 위험 AR-01 (아래 로그). 하이버네이션 API 사용(`worker/room.ts:155`) | closed |
| T-01-10 | Tampering | roles.ts assignRoles | high | mitigate | `shared/game/roles.ts:38-67` 섞기는 주입된 `randInt` 로만, 반환값 범위 검사(`:54-56`) 위반 시 RangeError. `shared/` 에 `Math.random`·`Date.now` 사용 0건(grep). 서버는 `worker/random.ts:4-16` `cryptoRandInt`(거부 샘플링). `test/unit/roles.test.ts:65,79` | closed |
| T-01-11 | Spoofing | shared/nickname.ts | medium | mitigate | `shared/nickname.ts:35-37` NFC·공백 정리, `:18,47-49` 제어·줄구분·서식(Cf) 문자 거부(ZWJ 만 예외), `:43-45` NFKC+소문자 키. `test/unit/nickname.test.ts:58-82,157-166` | closed |
| T-01-12 | Information Disclosure | src/net/share.ts | medium | mitigate | `src/net/share.ts:8-12,20-22,43` 공유 데이터는 title·text·url 만, url 은 `buildRoomLink(origin, code)`. `test/unit/share.test.ts:20,69-78`, `test/client/sheet.test.tsx:253,267-272` | closed |
| T-01-13 | Elevation of Privilege | checkStart / kickPlayer | high | mitigate | `shared/game/room.ts:250,273` 판정자는 `actorId` 와 `hostId` 비교뿐, 입력에 클라이언트 값 없음. `test/unit/gameRoom.test.ts:336,398` NOT_HOST | closed |
| T-01-14 | Tampering | 시작 조건(연결 상태) | high | mitigate | `shared/game/room.ts:262-277` `connectedCount` 를 서버 상태로 재계산. `test/unit/gameRoom.test.ts:390` 연결 3+끊김 5 거절, `test/worker/start.test.ts:34` | closed |
| T-01-15 | Information Disclosure | buildPreview | high | mitigate | `shared/game/view.ts:112-125` `{seat,nickname}` 객체 리터럴, 대기실에서만 채움. `test/unit/preview.test.ts:58-66` 모든 단계에서 토큰·id·역할·connected 문자열 부재, `test/worker/preview.test.ts:28`. 닉네임 열거는 AR-05 로 수용 | closed |
| T-01-16 | Denial of Service | joinRoom 정원 | medium | mitigate | `shared/game/room.ts:194` `MAX_PLAYERS`(끊긴 사람 포함) 초과 시 `ROOM_FULL`. `test/worker/join.test.ts:46`, `test/unit/gameRoom.test.ts:171` | closed |
| T-01-17 | Tampering | Home·TextField 닉네임 렌더 | medium | mitigate | `src` 에 `dangerouslySetInnerHTML`·`innerHTML` 0건(grep), React 텍스트·value 로만 렌더. 서버도 `validateNickname`(`shared/game/room.ts:195`). `test/client/screens.test.tsx:188-189` | closed |
| T-01-18 | Information Disclosure | 오류 문구 | low | mitigate | `src/net/copy.ts:24-47` 닫힌 코드 집합만 문구로 바꾸고 나머지는 "연결이 불안정해요". `src/net/api.ts:6-26` 알 수 없는 응답은 NETWORK. `test/unit/copy.test.ts:30` | closed |
| T-01-19 | Information Disclosure | 토큰 노출(주소·공유·로그) | high | mitigate | 토큰은 `src/net/session.ts`(localStorage)와 hello 본문뿐. `src/App.tsx:51,66,105` 경로는 `/r/{코드}` 만 사용. `test/client/joinByLink.test.tsx:115-117` pathname·search 에 토큰 없음. 클라이언트 `console` 출력은 `src/debug`(기하 값)뿐 | closed |
| T-01-20 | Tampering | 저장된 입장 정보 | low | mitigate | `src/net/session.ts:70-82` 코드 4자리·토큰 길이 16~128 검사, 이상하면 null. `test/unit/session.test.ts:69-85`. 위조 토큰은 서버가 4003 으로 거부(`worker/room.ts:707-711`) | closed |
| T-01-21 | Denial of Service | S-02 미리보기 폴링 | low | mitigate | `src/screens/JoinByLink.tsx:26,81-143` 10초 setTimeout 사슬, visible 일 때만, 404·시작됨이면 중단(`:117-125`), 언마운트 시 해제 | closed |
| T-01-22 | Spoofing | 다른 사람 닉네임 사칭 | low | accept | 수용 위험 AR-02. 방 안 유일성은 서버가 강제(`shared/game/room.ts:197` NICKNAME_TAKEN) | closed |
| T-01-23 | Information Disclosure | view.ts buildView | critical | mitigate | `shared/game/view.ts:142-153` `me.role` 은 `revealsOwnRole` 단계의 본인에게만, `me.allies` 는 마피아에게만. 탈락자만 `spectate`(`:226-244`, 결정 0021), `result` 는 ended 에만(`:217`). `test/unit/view.test.ts:636` 4~8명 × 열네 단계 × 전원 × 시드 3 전수 검사(role·allies 는 `me.` 아래만), 통과 | closed |
| T-01-24 | Tampering | shared/game/tick.ts | high | mitigate | `shared/game/tick.ts:69` `now` 는 인자만, `shared/` 에 `Date.now`·`Math.random` 호출 0건(grep). `worker/room.ts` 만 서버 `Date.now()` 를 넘김. 클라이언트 메시지로 시각·단계를 바꾸는 길 없음(`shared/schemas.ts:12-42`, ping 의 `c` 는 되돌려 줄 뿐 `worker/room.ts:187-189`). 단, 테스트 방 전용 `testSkip`(결정 0022)은 `testMode`+방장 검사(`shared/game/testTools.ts:30-34`)로 막히고 자기 방에만 영향 (참고 메모 3 참조) | closed |
| T-01-25 | Tampering | startGame / assignRoles | high | mitigate | `shared/game/room.ts:293-295` 배정 입력은 seat 오름차순 id, 난수는 인자 `randInt`(DO 는 `cryptoRandInt`, `worker/room.ts:322`). `test/unit/gameRoom.test.ts:542` randInt 스파이로 주입 경로만 쓰임 확인 | closed |
| T-01-26 | Information Disclosure | RoleCard 뒷면 DOM·이미지 요청 | high | mitigate | `test/client/roleCard.test.tsx:14-21,33-39` 세 경우 뒷면 innerHTML 동일·`img`·역할 문자열 부재. 프리로드는 4종 전부(`src/net/assets.ts:88-92` `ROLE_IDS.map`, `test/unit/assets.test.ts:138`) | closed |
| T-01-27 | Information Disclosure | 화면 캡처·어깨너머 | low | accept | 수용 위험 AR-03. 다시 누르면 가려짐: `test/client/phaseScreens.test.tsx:161` | closed |
| T-01-28 | Spoofing | hello 토큰 | high | mitigate | `worker/random.ts:19-25` 32바이트(256bit) `crypto.getRandomValues` base64url. `worker/room.ts:707-711` 없는 토큰은 4003 `invalid_token`. 토큰 길이 스키마 `shared/schemas.ts:12`. `test/worker/reconnect.test.ts:92`, `random.test.ts:28` | closed |
| T-01-29 | Denial of Service | webSocketMessage | medium | mitigate | `worker/room.ts:52-56,241-256` 연결당 1초 20개 속도 제한(`RATE_LIMITED`) + 1024바이트 프레임 상한. `test/worker/reconnect.test.ts:101` | closed |
| T-01-30 | Elevation of Privilege | start·kick 처리기 | high | mitigate | `worker/room.ts:298-332` 판정자는 소켓 첨부의 `playerId`(hello 때 서버가 붙인 값, `:725-726`), 메시지의 신원 값은 스키마에 없음(`shared/schemas.ts:14-16`). `test/worker/start.test.ts:44`, `join.test.ts:182` NOT_HOST | closed |
| T-01-31 | Tampering | 시작 조건 우회(연결 상태 조작) | high | mitigate | `connected` 는 서버가 hello·소켓 닫힘으로만 바꿈(`shared/game/room.ts:363-381`, `worker/room.ts:76-90` 깨어날 때 재계산), `checkStart` 가 서버 상태로 재계산. `test/worker/start.test.ts:34`, `reconnect.test.ts:71` | closed |
| T-01-32 | Information Disclosure | 방송(buildView)·미리보기 | critical | mitigate | `worker/room.ts:751-760` 연결 첨부 `playerId` 별 `buildView`, `index.ts:68-73` 미리보기 허용 목록 + `no-store`(`:16`). `test/worker/leak.test.ts:92,473` 6명 한 판의 실제 프레임·HTTP 응답 전수 검사(처형·종료까지, 결정 0036), 통과. `scripts/smoke.mjs:685-690` 배포본 검사 | closed |
| T-01-33 | Denial of Service | alarm() | medium | mitigate | `worker/room.ts:684-693` try/catch 후 1초 뒤 재설정, `advance`/`tick` 은 멱등(`test/unit/tick.test.ts:231`). `test/worker/alarm.test.ts:126` | closed |
| T-01-34 | Spoofing | 같은 토큰의 기기 교체 | low | accept | 수용 위험 AR-04. 의도된 동작: `worker/room.ts:715-724` 4001 `replaced`, `test/worker/reconnect.test.ts:32` | closed |
| T-01-35 | Information Disclosure | 미리보기로 닉네임 열거 | low | accept | 수용 위험 AR-05. 응답 범위 한정: `view.ts:113-116`(대기실 밖은 빈 배열), `index.ts:16` no-store | closed |
| T-01-36 | Tampering | 닉네임 렌더(이름표·토스트·title) | medium | mitigate | React 텍스트·title 로만 렌더(`innerHTML` 계열 0건). `test/client/lobby.test.tsx:42-53` `<b>영희</b>` 가 텍스트이고 `b` 요소 없음 | closed |
| T-01-37 | Elevation of Privilege | [게임 시작] 버튼 활성 | low | mitigate | 서버가 `startGame`→`checkStart` 로 재검증(`worker/room.ts:322`), 거절 시 error + 최신 state 재전송(`:323-328`). `test/worker/start.test.ts:34,44` | closed |
| T-01-38 | Information Disclosure | Table 입력 | medium | mitigate | 현재 이름 `DayTableSeat`(`src/components/DayTable.tsx:39`) 에 역할 필드 없음, `test/client/dayTable.test.tsx:201` `@ts-expect-error` 타입 테스트. 동료 표시는 `me.allies` 에서만(`src/screens/Lobby.tsx:98`, `DayScene.tsx:159`, `src/game/roleText.ts:47`), 배정 화면은 `me.role`·`me.allies` 를 읽지 않음(`Assigning.tsx:9`) | closed |
| T-01-39 | Information Disclosure | 소켓 주소 | high | mitigate | `src/net/useRoomConnection.ts:53-56` 주소는 코드만. `test/client/useRoomConnection.test.tsx:97-103` url 에 토큰 없음·hello 본문에 토큰, `test/unit/roomSocketUrl.test.ts:5` | closed |
| T-01-40 | Denial of Service | 재연결 폭주 | medium | mitigate | `src/net/linkReducer.ts:131-134` `min(5000, 500·2^n)` + 지터, 숨김 중 예약 안 함(`useRoomConnection.ts:160-168`), 30초 포기(`linkReducer.ts:35`), 방 소멸 확인(`useRoomConnection.ts` `checkRoomOnce`). 서버 `RATE_LIMITED` 병행. `test/client/useRoomConnection.test.tsx:207,229,294,343` | closed |
| T-01-41 | Spoofing | 다른 창·다른 기기의 같은 토큰 | low | accept | 수용 위험 AR-06. 동작은 T-01-34 와 같다(`worker/room.ts:715-724`) | closed |
| T-01-42 | Information Disclosure | ShareSheet·share.ts | high | mitigate | `src/components/ShareSheet.tsx:29,55,59` url 은 `buildRoomLink(origin, code)` 하나. `test/client/sheet.test.tsx:253,267-272` 링크 값·share 인자(title·text·url 만), `test/unit/share.test.ts:20,74` | closed |
| T-01-43 | Elevation of Privilege | 내보내기 버튼 | low | mitigate | 버튼 노출은 표시용(`src/screens/Lobby.tsx:101` `pressable`), 판정은 서버 `kickPlayer`(`shared/game/room.ts:245-259` actorId·연결 상태). `test/worker/join.test.ts:182,194` | closed |
| T-01-44 | Information Disclosure | Assigning·[내 역할] 버튼·Day 마크업 | high | mitigate | `test/client/phaseScreens.test.tsx:280-288,306` 역할이 달라도 assigning 화면·[역할 카드] 버튼 innerHTML 동일, 프리로드 4종 전부(`assets.ts:88-92`) | closed |
| T-01-45 | Information Disclosure | MyRoleSheet 뒷면 상태 | medium | mitigate | 후속 컴포넌트 `RoleCardSheet`: `showBack` 이면 글자·그림 미렌더(`src/components/RoleCardSheet.tsx:90-93`). `test/client/roleCardSheet.test.tsx:274-283` 4개 역할 모두 직업 글자·`img`·역할 id 문자열 부재 | closed |
| T-01-46 | Tampering | 클라이언트 쪽 단계 진행 | low | mitigate | 화면은 `view.phase` 만 따름. `test/client/phaseScreens.test.tsx:233` 타이머 0 이후에도 서버 day 전까지 역할 확인 유지 | closed |
| T-01-47 | Spoofing | 배포 계정(wrangler 로그인) | high | mitigate | `wrangler.jsonc` 에 `account_id` 없음(T-01-01). 배포 전 `whoami` 개인 계정 확인 기록: 01-14-SUMMARY:62("두 번 모두"). `scripts/prod-url.txt` = `https://minifia.dhplay.workers.dev` | closed |
| T-01-48 | Denial of Service | 스모크가 배포본에 만드는 방 | low | accept | 수용 위험 AR-07. TTL 알람 확인: `worker/room.ts:637-652` | closed |
| T-01-49 | Information Disclosure | 스모크 출력 | low | mitigate | `scripts/smoke.mjs` 의 모든 `console.log` 는 코드·버전·편차·응답 코드만(`:217,954`), 토큰은 변수에만 두고 출력하지 않음. 토큰 문자열이 프레임·HTTP 응답에 있는지 검사(`:215,685-690`) | closed |
| T-01-50 | Information Disclosure | HANDOFF.md / README.md | medium | mitigate | 감사 시점에 `HANDOFF.md`·`README.md` 에서 토큰 모양(40자+ base64url)·32자 hex 문자열 0건. 추적 파일 전체의 키·비밀 패턴 검색에서 실제 비밀값 없음(테스트 더미 값 `token-secret-…` 뿐). E2E 스크립트는 출력에서 토큰을 가림(`scripts/e2e/lib.mjs:259-261`) | closed |
| T-01-51 | Spoofing | git push 원격·자격 증명 | medium | mitigate | `git remote -v`: `git@github.com:dhkim1522/minifia.git`(개인 원격, SSH). 저장소 로컬 설정에 자격 증명 도우미 없음. 01-14-SUMMARY:72,78 원격 확인 후 push | closed |
| T-01-52 | Tampering | 캐시 헤더로 낡은 그림이 남음 | low | accept | 수용 위험 AR-08. `public/_headers` 에 규칙과 `?v=` 우회 방법 기록 | closed |
| T-01-53 | Spoofing | nickname.ts nicknameKey | high | mitigate | `shared/nickname.ts:26,43-45` 키에서 채움 문자·ZWJ·변형 선택자·`\p{M}` 제거 후 NFKC 재적용. `test/unit/nickname.test.ts:86-110`, `test/unit/gameRoom.test.ts:201-213`, `test/worker/join.test.ts:63-76` (HTTP 409) | closed |
| T-01-54 | Spoofing | validateNickname | medium | mitigate | `shared/nickname.ts:23,47-49,56-59` 채움 문자는 위치 무관 `INVALID_CHARS`, 키가 비면 `INVALID_CHARS`. `test/unit/nickname.test.ts:113-129`, `join.test.ts:77` (HTTP 400) | closed |
| T-01-55 | Tampering | POST /join → Room DO → joinRoom | high | mitigate | 서버는 클라이언트 검사 결과를 쓰지 않고 `joinRoom` 에서 `validateNickname` 의 key 로만 판정(`shared/game/room.ts:195-197`), API 직접 호출 경로(`worker/index.ts:75-97`). `test/worker/join.test.ts:56-93` 409 NICKNAME_TAKEN·400 NICKNAME_INVALID | closed |
| T-01-56 | Denial of Service | 정상 닉네임(한글·이모지) 참가 | low | mitigate | 회귀 테스트: `test/unit/nickname.test.ts:14-50,130-155`(한글·NFD·가족 이모지·하트·무지개 깃발·5자), 통과 | closed |
| T-01-57 | Spoofing | 재배포 전 방의 저장된 nicknameKey | low | accept | 수용 위험 AR-09. 방 수명 `ROOM_TTL_MS` 3시간 확인(`shared/game/room.ts:23`) | closed |
| T-01-58 | Denial of Service | Sheet.tsx 진입 상태 | medium | mitigate | `src/components/Sheet.tsx:17,107-109` `ENTER_FALLBACK_MS = 60` 시간 폴백, 언마운트·닫기 때 예약 취소(`:92-97`). `test/client/sheet.test.tsx:451` 프레임 미실행 + 60ms | closed |
| T-01-59 | Information Disclosure | MyRoleSheet 진입 전 프레임 | low | accept | 수용 위험 AR-10. 서버는 남의 역할을 보내지 않음(결정 0002·0021, T-01-23) | closed |
| T-01-60 | Denial of Service | ds.css 입력 라벨·힌트·꺼진 버튼 | low | mitigate | `test/client/entryContrast.test.tsx:96-139` 토큰 색에서 WCAG 대비를 계산해 라벨 12:1·힌트 7:1·꺼진 버튼 4.5:1 고정, 통과 | closed |
| T-01-61 | Tampering | 승인된 디자인 계약과 코드의 불일치 | low | mitigate | UI-SPEC R19 기록(`01-UI-SPEC.md:414`), `node scripts/gen-tokens.mjs --check` 종료 코드 0 (토큰 불변) | closed |
| T-01-62 | Information Disclosure | sheetDebug.ts 기록·패널·콘솔 | medium | mitigate | `src/debug/sheetDebug.ts` 에 시트 글자·img src·주소·토큰을 읽는 코드 없음(`textContent` 는 패널에 쓰기만, `:350,429,548,555`). `test/client/sheetDebug.test.tsx:418` 시트 안 글자·그림 주소가 기록·패널에 없음 | closed |
| T-01-63 | Tampering | 플래그 링크(`?sheetdebug=1`) | low | accept | 수용 위험 AR-11. 공유 링크는 쿼리를 붙이지 않음(`src/net/share.ts:20-22`, `test/unit/share.test.ts:74`) | closed |
| T-01-64 | Denial of Service | 계측 프레임 반복·타이머·리스너 | low | mitigate | `src/debug/sheetDebug.ts:7,458-464,518,539` `TRACE_MS = 1000`, 종료 때 타이머·프레임·리스너 정리, `import()` 지연 로드(`sheetProbe.ts:82`). `test/client/sheetDebug.test.tsx:84,387` | closed |
| T-01-65 | Denial of Service | sheet.css 분기 A(lvh) | medium | mitigate | 01-19 가 대체됨(01-19-SUMMARY): 취약 형태(큰 뷰포트 높이 lvh)가 적용되지 않았다. `src/styles/*.css` 에 `lvh`/`svh` 0건, 시트는 `max-height: 80dvh`, `padding-bottom` 에 안전 영역 유지(`sheet.css:28-29`). 원인은 포커스 자동 스크롤로 확정되어 `overflow: clip`(`sheet.css:14`)으로 고쳤고 사용자 폰에서 확인 | closed |
| T-01-66 | Denial of Service | 분기 D 스크롤 잠금 | low | mitigate | 스크롤 잠금을 도입하지 않았다(`:root:has(.mf-dialog[open])` 0건). 네이티브 `<dialog>` `showModal`/닫힘만 사용(`Sheet.tsx`)이라 잠금이 남을 수 없다 | closed |
| T-01-67 | Tampering | Task 3 배포·push | high | mitigate | 01-19 Task 3 은 실행되지 않았다(01-19-SUMMARY "대체됨"). 계획의 게이트(`01-19-PLAN.md:300,337`: blocking-human, `whoami` 확인, 개인 원격만)는 존재하고, 실제 배포·push 의 동등 통제는 T-01-47·T-01-51 로 확인 | closed |
| T-01-SC | Tampering | npm installs | high | mitigate | `package.json` 의존성 전부 정확 버전(`^`·`~` 0건), `package-lock.json` 추적 중(integrity 해시 포함). 01-01 Task 2 사용자 합법성 확인(01-01-SUMMARY:143). `sharp` 추가 건은 아래 "미등록 플래그" 2번 참조 | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — 차단 기준 이상의 열린 위협만 `threats_open` 에 센다*
*Disposition: mitigate (구현 필요) · accept (문서화된 위험) · transfer (제3자)*

---

## 수용한 위험 로그

계획 단계에서 근거가 문서화된 위험이다. 감사 시 현재 코드가 근거와 어긋나지 않는지 확인했다.

| Risk ID | Threat Ref | 근거 (계획 원문) | 수용 주체 | 날짜 |
|---------|------------|------------------|-----------|------|
| AR-01 | T-01-09 | 토큰 없이는 상태를 받지 못하고, DO 하이버네이션으로 대기 비용이 낮다. 친구용 MVP 규모에서 수용, 문제가 보이면 4페이즈 연결 보강에서 정리 (01-02) | 프로젝트 소유자 (계획 01-02 승인) | 2026-10-30 기록 |
| AR-02 | T-01-22 | 닉네임은 방 안에서만 유일(서버 NICKNAME_TAKEN), 친구 게임 MVP 에서 계정 없음이 전제(Out of Scope: 계정·로그인) (01-06) | 프로젝트 소유자 (계획 01-06 승인) | 2026-10-30 기록 |
| AR-03 | T-01-27 | 앞면을 본 뒤의 캡처는 막을 수 없다(UI-SPEC 수용). "카드를 다시 누르면 가려져요" 로 가릴 수 있게 함 (01-08). 결정 0018 이 어깨너머·캡처를 플레이어 매너로 규정 | 프로젝트 소유자 (계획 01-08 승인) | 2026-10-30 기록 |
| AR-04 | T-01-34 | 토큰은 그 폰 localStorage 에만 있고 공유되지 않는다. 새 기기가 이전 소켓을 4001 로 대신하는 것은 의도된 재접속 동작 (01-09) | 프로젝트 소유자 (계획 01-09 승인) | 2026-10-30 기록 |
| AR-05 | T-01-35 (및 T-01-15 의 닉네임 열거 부분) | 4자리 코드 열거로 대기실 닉네임을 볼 수 있음(역할·토큰 없음, 시작 뒤 빈 배열, no-store). Workers Rate Limiting 은 정식 출시(LAUNCH)로 미룸 (01-09, 01-04). 참고: `REQUIREMENTS.md` LAUNCH-01~06 에 속도 제한 항목은 아직 없다 | 프로젝트 소유자 (계획 01-09 승인) | 2026-10-30 기록 |
| AR-06 | T-01-41 | 서버가 새 hello 로 이전 소켓을 4001 로 대신함(의도된 재접속), 화면은 [다시 연결]/[처음으로] 를 준다 (01-11) | 프로젝트 소유자 (계획 01-11 승인) | 2026-10-30 기록 |
| AR-07 | T-01-48 | 방은 3시간 TTL 알람으로 지워진다 (01-14). 현재는 접속자가 없으면 10분 | 프로젝트 소유자 (계획 01-14 승인) | 2026-10-30 기록 |
| AR-08 | T-01-52 | 그림 파일명이 해시가 아니라 교체 때 최대 1일 지연. 교체가 급하면 파일명을 바꾼다 (01-14). 현재는 주소 끝 `?v=` 값(`ASSET_VERSION`)으로 우회 | 프로젝트 소유자 (계획 01-14 승인) | 2026-10-30 기록 |
| AR-09 | T-01-57 | 옛 규칙으로 만든 키는 방 만료(ROOM_TTL_MS 3시간)와 함께 사라진다. 재배포는 이 계획 범위 밖이고 재배포 직후 그 방들 안에서만 이론상 우회가 남는다 (01-15) | 프로젝트 소유자 (계획 01-15 승인) | 2026-10-30 기록 |
| AR-10 | T-01-59 | 진입 전에도 시트 내용은 DOM 에 있지만 화면 밖이고 dialog 는 overflow 가 숨긴다. 본인 역할만 담고 서버가 남의 역할을 보내지 않으므로(결정 0002) 변경 전과 노출 범위가 같다 (01-16) | 프로젝트 소유자 (계획 01-16 승인) | 2026-10-30 기록 |
| AR-11 | T-01-63 | 받은 사람 탭에 개발용 패널이 보이는 것뿐이다. 패널은 pointer-events none, 역할 정보가 없으며, 탭을 닫거나 `?sheetdebug=0` 이면 꺼진다. 공유 링크는 쿼리를 붙이지 않는다 (01-18) | 프로젝트 소유자 (계획 01-18 승인) | 2026-10-30 기록 |

---

## 감사 메모 (등록부 밖)

차단 대상은 아니다. 계획 단계에 위협 ID 가 없어 "미등록 플래그"로 남긴다.

1. **`public_preview_urls` (01-02-SUMMARY Threat Flags, 미등록)** — `wrangler.jsonc` 에 `workers_dev`·`preview_urls` 가 여전히 없어 둘 다 기본 활성이다(`grep` 0건). 01-02 가 "01-10 재배포 때 판단 권장"이라 했으나 이후 산출물에 결정 기록이 없다. 같은 앱·같은 API 가 버전별 주소로 더 열리는 표면이다. 권고: `preview_urls: false` 로 명시하거나 수용 위험으로 기록. 심각도 low–medium 로 보며 `block_on: high` 라 차단하지 않는다.
2. **`sharp@0.35.5` devDependency (SUMMARY에 없음, 미등록)** — 커밋 `5aaead0`(결정 0013, OG 이미지 재생성)이 Phase 1 중 추가했다. 01-14 의 T-01-SC 문구("새 패키지 없음, OG 이미지는 node:zlib")와 어긋난다. 정확 버전 고정(`package.json`)과 lockfile integrity(`package-lock.json`, `"dev": true`)는 충족했고 결정 0013 에 사용이 적혀 있지만 01-01 Task 2 같은 합법성 확인 기록은 없다. 권고: 결정 0013 에 `sharp` 합법성 확인(공식 `lovell/sharp`)을 한 줄 남기기. 이후 `playwright-core` 추가(2026-10-25)는 Phase 5 범위다.
3. **테스트 방 도구 (결정 0022·0024, 뒤 페이즈)** — `POST /api/rooms` 본문의 `testMode: true` 는 누구나 켤 수 있고(`worker/index.ts:54`, `shared/schemas.ts:8`), 켜진 방의 방장만 `testSkip`·`testRole`·`testBots`·`testBotVote` 를 쓴다(`shared/game/testTools.ts:30-34`, `worker/room.ts:533-539`). 효과는 호출자 자신의 방으로 한정되어 다른 방·다른 사람의 역할 노출은 없다(`test/worker/leak.test.ts:751` 가 손님 프레임에 설정 키가 없음을 확인). T-01-24 의 "시각·단계를 바꾸는 메시지 없음" 문장은 테스트 방에 한해 이 통제로 대체된다.
4. **문서 어긋남** — `01-REVIEW-DISPOSITION.md` 는 CR-01 을 `open` 으로 적고 있으나 01-15 가 코드로 고쳤고 이 감사에서 확인했다(T-01-53·54). 처분표를 갱신해야 한다.
5. **테스트 실행** — 보안 관련 28개 테스트 파일 병렬 실행에서 707/708 통과. 실패 1건은 `test/worker/http.test.ts` 첫 테스트의 5000ms 타임아웃(workerd 콜드 스타트)이고 단독 재실행에서 13/13 통과했다(재현되지 않는 지연).

---

## 보안 감사 기록

| 감사일 | 위협 총수 | Closed | Open | 실행 |
|--------|-----------|--------|------|------|
| 2026-10-30 | 68 | 68 | 0 | gsd-security-auditor |

---

## 승인

- [x] 모든 위협에 disposition (mitigate / accept / transfer) 가 있다
- [x] 수용한 위험이 수용 위험 로그에 문서화되어 있다
- [x] `threats_open: 0` 확인
- [x] 프론트매터 `status: verified`

**승인:** verified 2026-10-30 (ASVS L1, block_on: high)
