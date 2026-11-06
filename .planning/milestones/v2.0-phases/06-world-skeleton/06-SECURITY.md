---
phase: "06"
slug: "world-skeleton"
status: verified
# threats_open = workflow.security_block_on(high) 이상인 OPEN 위협 수(차단 게이트)
threats_open: 0
asvs_level: 1
created: "2026-11-01"
---

# Phase 06 — Security

> 페이즈 보안 계약: 신뢰 경계, 위협 목록, 수용 위험, 감사 기록.
> 위협 목록은 21개 PLAN.md 의 `<threat_model>` 에서 모았고(계획 시점 작성), SUMMARY.md 의 Threat Flags 에는 새 위협이 없었다.
> 검증 깊이는 ASVS L1(구현 파일 grep 대조)이다. 새 위협 탐색은 범위 밖이다.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| 개발자 PC → Cloudflare 계정(wrangler deploy) | 잘못된 이름·계정이면 운영 v1.0 이 덮인다 | 빌드 산출물·Worker 이름 |
| 검사·측정 스크립트·E2E → 대상 주소 | 자동 트래픽이 v1.0 방·저장소에 닿을 수 있다 | 테스트 요청·토큰 |
| 클라이언트 소켓 → 방 DO(move) | 목적지 두 정수만 받고 신원·단계·간격·경로는 서버가 정한다 | 좌표(정수), 소켓 첨부 playerId |
| 방 DO → 각 소켓(world 프레임) | 로비 연결자에게만, 공개 식별자 seat 와 숫자만 | 위치 구간(게임 중 누설 금지) |
| DO 저장소(world 키) → 복원 | 옛·손상 값이 들어올 수 있다 | 저장된 위치 |
| 서버 프레임 → 클라이언트 화면 상태 | 이전 연결의 늦은 프레임이 섞일 수 있다 | world move·snap |
| 다른 플레이어 닉네임 → DOM | 사용자 문자열이 이름표·알림에 그려진다 | 닉네임(공개) |
| npm 레지스트리 → 번들 | 새 패키지(three) 코드가 클라이언트에 들어간다 | 의존성 코드 |
| 브라우저 GPU 자원 → 앱 화면 | 컨텍스트 소실·과부하 | 렌더 상태 |
| 쿼리 문자열 → 디버그 화면 | 누구나 ?perf=1·?chat-mock=1·?e2e=1 을 열 수 있다 | 로컬 계측 값 |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation (근거) | Status |
|-----------|----------|-----------|----------|-------------|-------------------|--------|
| T-06-01 | Tampering | npm run deploy / dist/worker/wrangler.json | high | mitigate | `package.json` deploy = check-account → vite build → `scripts/check-deploy-target.mjs`(빌드 name·소스 name·prod-url·preview_urls 를 `WORKER_NAME` 과 대조, 어긋나면 exit 1) → deploy.mjs | closed |
| T-06-02 | Tampering | E2E·smoke·bots·uat·gallery 대상 주소 | medium | mitigate | `scripts/deploy-target.mjs:26` assertNotV1·`:37` exitIfV1, smoke·bots·gallery·uat-*·perf-run 이 요청 전에 호출, `scripts/e2e/lib.mjs:183` resolveTarget, `deploy-target.test.mjs:139,162` 정적 검사(v1 문자열·가드 누락) | closed |
| T-06-04 | Tampering | snapToWalkable/routeFx | medium | mitigate | `shared/game/map.ts:145` LIMIT_FX 580·`:213` snapToWalkable(결정적 보정), routeFx 의 lineWalkable 선분 검사 | closed |
| T-06-05 | Denial of Service | findPath 계산 비용 | low | mitigate | `map.ts:9` GRID_SIZE 28(784칸)·`:301` 이진 힙 A*, 앞단 150ms 간격·연결당 20/s | closed |
| T-06-06 | Denial of Service | 컨텍스트 소실 재생성 폭주 | medium | mitigate | `src/world/status.ts:83` shouldRecreate(소실당 1회)·`:27` FAIL_AFTER_MS 5000 → failed 종단 | closed |
| T-06-07 | Information Disclosure | 카메라·상태 모듈 | low | accept | 수용 위험 AR-01 | closed |
| T-06-08 | Tampering | 런타임 three 로드 경로(CDN) | medium | mitigate | three 는 번들 import 만(`src/` 에 CDN·원격 import 없음), E2E G6 "외부 요청" 검사(`scripts/e2e/browser.mjs:89` offOrigin, `lib.mjs:266`) | closed |
| T-06-09 | Tampering | MoveMessageSchema | high | mitigate | `shared/schemas.ts:16` z.strictObject + int ±`MOVE_COORD_LIMIT`(700) | closed |
| T-06-10 | Tampering | requestMove(순간이동·가속) | high | mitigate | `shared/game/world.ts:16` MOVE_V 서버 상수, `:143` 출발점 = 서버 positionAtFx, `:148` routeFx — 클라이언트 값은 목적지뿐 | closed |
| T-06-11 | Tampering | restoreWorld(손상 저장값) | low | mitigate | `world.ts:232` restoreWorld: 모양·범위·막힌 점·v 검사 실패 → 입장 지점, 방에 없는 id 버림 | closed |
| T-06-12 | Spoofing | validateNickname(위장 이름) | medium | mitigate | `shared/nickname.ts:10` 자소 8 상한, 기존 보이지 않는 문자·중복 검사 유지 | closed |
| T-06-13 | Tampering | 닉네임 길이 조작(클라이언트 우회) | low | mitigate | 서버 `shared/game/room.ts:142,195` validateNickname 재검증, `worker/index.ts:54,69` NICKNAME_INVALID | closed |
| T-06-14 | Tampering | 첫 배포(v1 덮어쓰기) | high | mitigate | 가드 체인만 사용(T-06-01), 06-07-SUMMARY 에 minifia-v2 배포·v1 health 기준선 대조 기록 | closed |
| T-06-15 | Information Disclosure | 빌드 상수 WORKER_NAME·version | low | accept | 수용 위험 AR-02 | closed |
| T-06-16 | Information Disclosure | emitWorld/handleHello snap(게임 중 위치 누설) | high | mitigate | `worker/room.ts` emitWorld 의 `phase !== "lobby"` 가드, `:779` snap 도 로비에서만, `test/worker/leak.test.ts:91~112,256,666` start 이후 world 프레임 0·키 허용 목록 | closed |
| T-06-17 | Spoofing | move 의 행위자 | high | mitigate | `room.ts:865` handleMove 는 attachmentOf(ws).playerId 만 사용, 스키마 strictObject 가 seat·id 키 거부 | closed |
| T-06-18 | Denial of Service | move 폭주·경로 계산 | medium | mitigate | `room.ts:57` RATE_MAX_MESSAGES 20, `world.ts:18` MOVE_MIN_GAP_MS 150 조용한 버림, 784칸 A* | closed |
| T-06-19 | Denial of Service | DO 저장 쓰기 한도 | medium | mitigate | `room.ts` markWorldDirty 2초 디바운스(WORLD_FLUSH_MS), 별도 "world" 키, wanderActive 는 사람 연결 중에만 | closed |
| T-06-20 | Elevation of Privilege | 봇 배회 | low | mitigate | `room.ts` runBotWander → applyMove(사람과 같은 단계·간격·경로), 거부 버림 | closed |
| T-06-21 | Tampering | WorldStore(낡은 연결 프레임) | medium | mitigate | `src/world/store.ts:10~37` epoch 규칙(낡은 epoch 폐기, snap 통째 교체, snap 전 새 epoch move 폐기), `useRoomConnection.ts:206` 종료 상태 차단 | closed |
| T-06-22 | Spoofing | parseServerMessage(모르는 프레임) | low | mitigate | `src/net/useRoomConnection.ts:64` 화이트리스트에 world 만 추가, 모르는 t 버림 | closed |
| T-06-23 | Denial of Service | GPU 부하(과열·탭 폐기) | medium | mitigate | `src/world/renderer.ts:32` DRAW_CALL_BUDGET 120·`:18` 강등 사다리·`:93` 자동 강등(1~3단계), 06-19 실기기 확인(06-PERF-RESULTS.md) | closed |
| T-06-24 | Tampering | 원격 에셋 로드 | low | mitigate | 코드 생성 지오메트리·DataTexture, `test/unit/barScene.test.ts:225` URL·로더·fetch 부재 검사, E2E G6 | closed |
| T-06-25 | Denial of Service | 캐릭터 그리기 수 | medium | mitigate | 관절 병합, `test/unit/character.test.ts:36,159` 1인 메시 ≤ 8 | closed |
| T-06-26 | Tampering | NameTag·TopToast(닉네임 XSS) | medium | mitigate | `src/` 에 dangerouslySetInnerHTML·innerHTML 사용 없음, `test/client/v2parts.test.tsx:61,251` `<b>x</b>`·`<i>x</i>` 텍스트 고정 | closed |
| T-06-27 | Information Disclosure | window.__mfWorld 테스트 훅 | low | mitigate | `src/world/testHooks.ts:1,9,47` ?e2e=1(세션 저장)·개발 빌드에서만 설치 | closed |
| T-06-28 | Tampering | 탭 → move(신원·속도 조작) | medium | mitigate | `src/components/WorldStage.tsx:167` `{t:"move", x, z}` 정수만 전송, 최종 판정은 서버(T-06-09·10·17) | closed |
| T-06-29 | Tampering | 이름표·접근성 목록(닉네임 XSS) | medium | mitigate | `WorldStage.tsx:20`·`HeadStack.tsx:7` React 텍스트 노드, aria-label 문자열 속성 | closed |
| T-06-30 | Information Disclosure | ?perf=1·?chat-mock=1 디버그 화면 | low | mitigate | `src/debug/` 에 fetch·WebSocket·sendBeacon 없음, `src/main.tsx:13` 쿼리일 때만 지연 로드 | closed |
| T-06-31 | Tampering | 결과 수집 엔드포인트 | medium | mitigate | 엔드포인트를 만들지 않음 — 결과 카드·perf-run 로컬 JSON 만(06-14-SUMMARY) | closed |
| T-06-32 | Tampering | perf-run 대상(v1 측정) | medium | mitigate | `scripts/perf-run.mjs:316` exitIfV1(target) | closed |
| T-06-33 | Elevation of Privilege | 시작·내보내기 버튼 | medium | mitigate | `shared/game/room.ts:250` kick NOT_HOST·`:272` checkStart 서버 재판정 | closed |
| T-06-34 | Information Disclosure | 방 코드 노출 | low | accept | 수용 위험 AR-03 | closed |
| T-06-35 | Tampering | 삭제가 시작 이후 화면을 깨뜨림(회귀) | low | mitigate | 06-16-SUMMARY: 사용처 grep 뒤 삭제, client 전체·typecheck 통과, 06-17 E2E 게임 흐름 재확인 | closed |
| T-06-36 | Tampering | E2E 대상(v1 운영) | medium | mitigate | `scripts/e2e/lib.mjs:183` resolveTarget 의 assertNotV1(명시 --url 포함, 우회 인자 없음) | closed |
| T-06-37 | Information Disclosure | E2E 결과·로그의 토큰 | low | mitigate | `scripts/e2e/lib.mjs:272` redact(ctx.secrets), `.gitignore:18` scripts/e2e/out/ | closed |
| T-06-38 | Tampering | 페이즈 끝 배포(v1 덮어쓰기) | high | mitigate | 가드 체인(T-06-01) 1회 배포, 06-19-SUMMARY:116,127 출력 `minifia-v2`·v1.0 미접촉, perf-run·E2E 는 exitIfV1·resolveTarget | closed |
| T-06-39 | Repudiation | 성능 판정 근거 | low | mitigate | `06-PERF-RESULTS.md`·`perf/` 원자료와 판정 기록 | closed |
| T-06-40 | Spoofing | git push 원격·자격 증명 | medium | mitigate | 원격 `git@github.com:dhkim1522/minifia.git`(개인 SSH), 전역 gitconfig·gh 자격 설정 변경 없음 | closed |
| T-06-41 | Tampering | deployhold 의 파일 시각 갱신 | low | mitigate | `scripts/e2e/flows.mjs:767` touchWorkerFile 은 utimes 만(내용 불변), `:789` `pair.local` 일 때만, `lib.mjs:1988` isLocalOrigin + `lib.test.mjs:3048` | closed |
| T-06-42 | Denial of Service | 반복 재접속 트래픽 | low | accept | 수용 위험 AR-04 | closed |
| T-06-43 | Tampering | 알림 문구 속 닉네임(XSS) | medium | mitigate | `src/components/v2/TopToast.tsx:21` `{text}` 텍스트 노드, 서버 닉네임 1~8자 검증(T-06-12·13) | closed |
| T-06-44 | Information Disclosure | performance.mark("room-enter") | low | accept | 수용 위험 AR-05 | closed |
| T-06-SC | Tampering | npm installs | high | mitigate | 페이즈 동안 package.json 에 더해진 것은 06-04 의 `three` 0.186.1·`@types/three` 0.186.0 뿐(정확 고정), `test/unit/deps.test.ts:15,21` 판·lockfile 무결성 고정. 다른 20개 계획은 설치 없음 | closed |

*Status: open · closed · open — high 미만(비차단)*
*Severity: critical > high > medium > low — workflow.security_block_on(high) 이상인 open 만 threats_open 에 센다*
*Disposition: mitigate(구현 필요) · accept(기록한 위험) · transfer(제3자)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01 | T-06-07 | 카메라·상태 모듈은 클라이언트 로컬 계산뿐이고 네트워크·저장소를 쓰지 않는다 | 계획 06-03 (threat_model accept) | 2026-11-01 |
| AR-02 | T-06-15 | WORKER_NAME·version 은 공개 주소·/api/health 로 이미 드러나는 값이며 비밀이 없다 | 계획 06-07 (threat_model accept) | 2026-11-01 |
| AR-03 | T-06-34 | 방 코드는 초대용 공개 정보이고 공유 시트에서만 크게 보인다(UI-SPEC) | 계획 06-15 (threat_model accept) | 2026-11-01 |
| AR-04 | T-06-42 | 반복 재접속은 로컬 dev 대상이고 배포본에는 06-19 의 1회만 | 계획 06-18 (threat_model accept) | 2026-11-01 |
| AR-05 | T-06-44 | 표식 이름과 시각만 같은 페이지 안에 남고 밖으로 보내지 않는다 | 계획 06-21 (threat_model accept) | 2026-11-01 |

*수용 위험은 이후 감사에서 다시 올리지 않는다.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-11-01 | 45 | 45 | 0 | gsd-secure-phase (L1 grep 대조, 감사 에이전트 생략: threats_open 0 · 계획 시점 register · ASVS 1) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-11-01
