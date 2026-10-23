# Walking Skeleton — minifia

**Phase:** 1
**Generated:** 2026-10-21

## Capability Proven End-to-End

> 방장이 배포된 주소(`https://{Worker 이름}.{개인 계정 서브도메인}.workers.dev`)에서 닉네임을 넣고 [방 만들기]를 누르면, Worker 가 4자리 코드를 만들고 방 Durable Object 가 방을 저장한 뒤, 브라우저가 WebSocket `hello{token}` 으로 붙어 서버가 보낸 대기실 상태(코드·자기 이름)를 화면에 그린다.

이 한 줄이 1페이즈 트레이서(01-02 Task 1)다. 나머지 계획은 이 길을 넓힌다: 참가(링크·코드) → 대기실 2.5D 테이블 → 시작 → 역할 배정(약 3초) → 역할 확인(15초) → "낮이 되었습니다".

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| 클라이언트 | React 19.3.1 + Vite 8.3.5 단일 페이지 앱. 라우터 라이브러리 없음(`/`, `/r/:code` 두 경로를 `location.pathname` 으로 분기) | 결정 0001(웹앱 먼저). 화면 전환은 서버 단계(`view.phase`)가 정하므로 URL 은 두 개뿐 |
| 실시간 서버 | Cloudflare Worker 1개 + `Room` Durable Object(방 하나 = DO 하나, 이름 = 4자리 코드, `env.ROOM.getByName(code)`) | 결정 0002. 규칙·판정·타이머는 DO 안에서만 |
| WebSocket | Hibernation API(`ctx.acceptWebSocket`, `serializeAttachment({playerId, connId})`, `getWebSockets()`) | 대기 중 비용 절감, 깨어날 때 첨부로 연결↔플레이어 복구 |
| 데이터 | DO storage KV API(SQLite 백엔드) 한 키 `"room"` 에 `RoomState` 전체 스냅샷. 변경마다 `put` 후 방송. 방 만료 3시간(`ROOM_TTL_MS`), 시작 때 갱신, 만료 시 `deleteAll()` | 인메모리는 하이버네이션·배포 때 사라진다. 한 방 상태는 수 KB |
| 신원(인증 없음) | 계정·로그인 없음. 참가할 때 서버가 256bit 플레이어 토큰(base64url 43자)을 발급 → 브라우저 localStorage 한 칸 `minifia:session`(`{code, token}`, 다른 방에 들어가면 덮어씀 — 2026-10-23 재계획) 에 보관 → WebSocket 첫 메시지 `hello{token}` 로만 전달(URL·공유 링크에 넣지 않음) | CONN-01 재접속, 토큰이 로그·공유로 새지 않게 |
| 프로토콜 | `shared/protocol.ts` 한 곳(zod 스키마는 서버만 값으로 import, 클라이언트는 `import type`). 서버→클라이언트는 연결마다 `buildView(state, playerId, now)` 로 만든 **플레이어별 전체 스냅샷** `RoomView`(델타 없음). 공개 식별자는 `seat`(0~7) | ROLE-02: 남의 역할은 타입에서부터 공개 뷰에 자리가 없다. 재접속 = 스냅샷 한 번 받기 |
| 타이머 | 서버 마감 시각 `phaseEndsAt`(epoch ms) + 단계 표 `PHASE_DEFS` + 순수 `tick(state, now)` + DO 알람 하나를 `nextWakeAt = min(phaseEndsAt, expiresAt)` 로 다중화. 클라이언트는 `ping/pong` 시계 오프셋으로 남은 시간만 그린다 | GAME-01. DO 알람은 하나뿐이고 at-least-once 라 멱등 `tick` 이 필요 |
| 배포 | `@cloudflare/vite-plugin` 1.64.0 으로 `vite build` → `dist/client` + `dist/worker/wrangler.json`, `wrangler deploy`(4.151.3)가 같은 주소에 정적 에셋+Worker 를 올린다. `compatibility_date` `2026-10-12` 고정. Worker 이름·DO 선언 방식은 01-01 Task 1 결정(`docs/decisions/0009-...`) | DEPLOY-01. 이름은 주소이고, `exports` 선언은 되돌릴 수 없다 |
| 화면 | 일반 웹 화면 + CSS 2.5D(원근 타원 테이블, 그림자·조명 레이어, 앞뒤 겹침). 3D 라이브러리 없음. 테이블·자리·인물은 상태를 받아 그리기만 하는 부품(`Table`/`Figure`) | 결정 0008, D-22~D-24. 5페이즈에서 `Figure` 내부만 프레임 PNG 로 교체 |
| 디렉토리 | `src/`(React: `net/`, `screens/`, `components/`, `styles/`, `game/`) · `worker/`(진입점 + `Room` DO + 난수) · `shared/`(프로토콜·순수 게임 코어, DOM·workerd 전용 API 금지) · `test/{unit,client,worker,helpers}` · `scripts/smoke.mjs` | 순수 코어는 Node 에서 TDD, DO 는 얇은 어댑터 |
| 테스트 | vitest 4.1.12 projects: `unit`(node) / `client`(happy-dom + Testing Library) / `worker`(`@cloudflare/vitest-plugin` 1.4.6, workerd). 배포본 검증은 OS 무관 Node 스크립트 `scripts/smoke.mjs` | Mac·집 Windows 모두에서 같은 명령 |

## Stack Touched in Phase 1

- [ ] Project scaffold — package.json(버전 고정), Vite·wrangler·vitest·tsconfig 설정, `npm run typecheck` / `npx vitest run` / `npm run build` (01-01)
- [ ] Routing — Worker `/api/rooms`, `/api/rooms/:code`, `/api/rooms/:code/join`, `/api/rooms/:code/ws`, `/api/health` 와 SPA 폴백 `/r/:code` (01-02, 01-09)
- [ ] Database — DO storage 에 방 쓰기(`createRoom` 의 `put("room")`)와 읽기(생성자 복구) (01-02, 01-09)
- [ ] UI — [방 만들기] 버튼 → API → WebSocket 상태 → 대기실 화면 (01-02; 화면설계서 v0.2 기준 화면은 01-05·01-06·01-10~01-13)
- [ ] Deployment — `wrangler deploy` 로 workers.dev 주소에 배포, `node scripts/smoke.mjs --prod` (01-02, 01-14)

## Out of Scope (Deferred to Later Slices)

- 직업 공개 단계 — 서버 단계 정의에도 넣지 않는다(D-03). 2페이즈
- 낮 토론·빠른 메시지·이모티콘(2), 밤·아침·탈락(3), 투표·최후 변론·찬반·처형·승패·결과(4)
- 캐릭터 프레임 애니메이션(프레임 PNG), 사운드, Screen Wake Lock, 화면 전체 톤 통일(5). 1페이즈는 세트 C 정지 그림(`public/characters/`)과 A_cute 배경(결정 0010·0011·0012)
- PWA 서비스 워커·설치형 앱 — "재배포하면 새 버전이 바로 보인다"(성공 기준 5)와 충돌할 수 있어 넣지 않는다
- 게임 시작 뒤 [나가기], 하트비트 기반 끊김 감지, 방장 자동 이양(v2 CONNX-01), 오래 안 돌아오는 사람 정리(v2 CONNX-02)
- 정식 공유 미리보기 이미지·정식 도메인 — 정식 이름 확정 뒤(v2.0 LAUNCH-01/02). 1페이즈는 임시 `public/og.png`(UI-SPEC E13, 01-14)
- 린터(ESLint) — TypeScript 7 과의 호환 미확인

## Subsequent Slice Plan

이후 페이즈는 같은 틀(단계 표 + `tick` + 플레이어별 뷰 + 테이블 부품)에 한 구간씩 얹는다. 아키텍처 결정은 바꾸지 않는다.

- Phase 2: 낮 — `PHASE_DEFS` 에 직업 공개·낮 토론 단계 추가, 빠른 메시지·이모티콘(서버가 템플릿 ID·값만 검증해 방송)
- Phase 3: 밤과 아침 — 모든 생존자에게 같은 모양의 선택 화면, 밤 행동 집계, 아침 발표, 탈락자 화면
- Phase 4: 처형과 승패 — 투표·최후 변론·찬반·처형, 승패 판정, 결과 화면에서만 전체 역할 공개
- Phase 5: 분위기와 캐릭터 — `Figure` 를 프레임 PNG 캐릭터로 교체, 단계 전환 연출 통일, 안내 문구, Wake Lock
- Phase 6: 친구 플레이테스트 — 배포본으로 한 판, 규칙 수치 조정
