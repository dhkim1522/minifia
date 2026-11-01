---
phase: 06-world-skeleton
reviewed: 2026-11-01T00:00:00Z
depth: standard
files_reviewed: 41
files_reviewed_list:
  - worker/room.ts
  - shared/game/world.ts
  - shared/game/map.ts
  - shared/schemas.ts
  - shared/protocol.ts
  - shared/nickname.ts
  - shared/version.ts
  - scripts/deploy-target.mjs
  - scripts/check-deploy-target.mjs
  - scripts/bots.mjs
  - scripts/smoke.mjs
  - scripts/uat-test-room.mjs
  - scripts/perf-run.mjs
  - scripts/e2e/lib.mjs
  - wrangler.jsonc
  - package.json
  - vite.config.ts
  - src/world/runtime.ts
  - src/world/status.ts
  - src/world/threeRenderer.ts
  - src/world/renderer.ts
  - src/world/store.ts
  - src/world/input.ts
  - src/world/testHooks.ts
  - src/world/camera.ts
  - src/world/threeCamera.ts
  - src/world/character.ts
  - src/world/maps/bar.ts
  - src/screens/Lobby.tsx
  - src/screens/RoomScreen.tsx
  - src/screens/Home.tsx
  - src/screens/JoinByLink.tsx
  - src/net/useRoomConnection.ts
  - src/net/roomDiff.ts
  - src/net/copy.ts
  - src/components/WorldStage.tsx
  - src/components/MapStatusCard.tsx
  - src/components/v2/TopToast.tsx
  - src/components/v2/HeadStack.tsx
  - src/debug/perfProbe.ts
  - src/debug/perf/perfScene.ts
findings:
  critical: 1
  warning: 5
  info: 6
  total: 12
status: issues_found
---

# Phase 6: Code Review Report

**Reviewed:** 2026-11-01
**Depth:** standard
**Files Reviewed:** 41 (요청 범위 138개 중 고위험 영역 우선. 테스트·문서·나머지 E2E/UAT 스크립트·`shared/game/bots.ts`·스타일은 훑지 않았다)

## Summary

서버 권위 구조는 대체로 견고하다. `worker/room.ts` 의 move 경로는 신원을 소켓 첨부 `playerId` 에서만 얻고, 스키마가 `strictObject` + 정수 + 범위로 입력을 막으며, `requestMove` 가 150ms 간격·경로·맵 보정을 서버에서 처리한다. world 프레임은 `emitWorld` 한 곳으로만 나가고 로비 단계에서만 전송되며, 프레임에는 seat 만 실린다(playerId·토큰·역할 없음). 저장 키 분리, 디바운스, 방 삭제 시 타이머 해제도 맞다. 렌더러 해제·`recreate` 도 대체로 올바르다.

확인한 문제 중 가장 무거운 것은 **v1.0 호스트 차단(`assertNotV1`)이 FQDN 끝 점(`minifia.dhplay.workers.dev.`)으로 우회된다**는 점이다. "v1 을 절대 대상으로 삼지 않는다"는 이번 페이즈의 핵심 불변식이 모든 검사·UAT 스크립트에서 깨진다. 그 밖에 런타임 프레임 루프의 예외 내성 부재, 숨은 탭에서 소실 상태가 영구 실패로 굳는 문제, 닉네임 스키마 상한과 8 자소 규칙의 불일치, 클라이언트·서버 150ms 간격 경계로 인한 거짓 "연결 불안정" 알림, `npm run deploy -- <인자>` 로 배포 이름 가드가 비켜 가는 경로가 있다.

## Critical Issues

### CR-01: `assertNotV1` 이 끝 점이 붙은 호스트로 우회되어 v1.0 에 요청이 나간다

**File:** `scripts/deploy-target.mjs:26-32` (사용처: `scripts/bots.mjs:44`, `scripts/smoke.mjs:132`, `scripts/uat-*.mjs`, `scripts/gallery.mjs:9`, `scripts/perf-run.mjs:316`, `scripts/e2e/lib.mjs:183`)
**Issue:** `u.hostname.toLowerCase() === V1_HOST` 는 정확 일치만 본다. WHATWG URL 은 끝 점을 지우지 않는다. 직접 확인했다.

```
new URL("https://minifia.dhplay.workers.dev.").hostname
// -> "minifia.dhplay.workers.dev."   (=== V1_HOST 는 false)
```

끝 점이 붙은 FQDN 은 DNS·Cloudflare 에서 같은 v1.0 Worker 로 해석된다. 따라서 `node scripts/smoke.mjs https://minifia.dhplay.workers.dev.` 나 `scripts/e2e/run.mjs --url ...dev.` 가 가드를 통과해 v1.0 에 방 생성(POST `/api/rooms`)·소켓 연결을 보낸다. 모든 스크립트가 `exitIfV1(url.origin)` 뒤에 같은 `url.origin` 으로 요청하므로 우회가 곧바로 실제 요청이 된다. `deploy-target.test.mjs` 에도 이 입력이 없어 회귀를 못 잡는다. 주석의 "거부를 푸는 옵션은 없다"가 사실이 아니다.
**Fix:** 정규화 후 비교하고, 가능하면 차단 목록 대신 허용 목록으로 바꾼다.

```js
export function assertNotV1(urlOrOrigin) {
  const u = new URL(String(urlOrOrigin).trim());
  const host = u.hostname.toLowerCase().replace(/\.+$/, ""); // FQDN 끝 점 제거
  if (host === V1_HOST || host === `${V1_NAME}.${WORKERS_SUBDOMAIN}.workers.dev`) {
    throw new Error(`v1.0 주소(${V1_HOST})는 v2 스크립트가 검사·배포하지 않는다(결정 0043)`);
  }
  return u.origin;
}
```

`resolveTarget`(e2e) 처럼 `https` 대상은 `expectedHost` 또는 로컬 호스트만 허용하는 방식이 더 안전하다. `deploy-target.test.mjs` 에 `https://minifia.dhplay.workers.dev.`, `https://MINIFIA.dhplay.workers.dev.:443/x` 케이스를 추가한다. (끝 점이 붙은 `u.origin` 이 요청에 쓰이므로, 반환 origin 도 정규화하면 좋다.)

## Warnings

### WR-01: 프레임 루프에 예외 방어가 없어 한 번의 throw 로 맵이 영구 정지한다

**File:** `src/world/runtime.ts:608-731`
**Issue:** `frame()` 은 맨 앞에서 `rafId = null` 로 두고 맨 끝 `schedule()` 에서만 다음 프레임을 건다. 그 사이의 `createActor`(`kit.create` → 지오메트리 병합), `a.handle.update`, `r.setView`, `r.render()`, `writeTags`(`r.project`) 중 하나라도 던지면 다음 프레임이 예약되지 않는다. 이후 `rafId === null` 이고 `schedule()` 호출자가 없으므로(가시성 복귀 외) 캐릭터·카메라·이름표가 멈추고, 상태기계는 `ready` 그대로라 사용자에게 오류 카드도 뜨지 않는다. 탭 입력은 계속 받아 move 만 서버로 나간다.
**Fix:** 본문을 `try { ... } finally { schedule(); }` 로 감싸거나, catch 에서 `dispatch({ t: "loadError" })`/`failed` 로 알려 카드를 띄운다. 한 프레임 실패가 다음 프레임을 막지 않게 한다.

### WR-02: 숨은 탭에서도 소실 타이머가 돌아 복구 가능한 소실이 영구 `failed` 로 굳는다

**File:** `src/world/runtime.ts:301-307, 347-358`, `src/world/status.ts:60-75`
**Issue:** `status.ts` 는 "숨겨 둔 시간은 세지 않는다"고 설계했지만(`visible` 이벤트가 `lostAt` 을 갱신), `dispatch` 의 1초 `tickTimer` 는 탭이 숨는 동안에도 멈추지 않는다. 컨텍스트가 숨은 상태에서 소실되면(모바일·GPU 리셋) 5초 뒤 `tick` 이 `failed` 로 전이하고, `failed` 는 리듀서에서 어떤 이벤트에도 그대로인 종착 상태다. 사용자가 돌아와도 `visible` 이벤트가 효과가 없고 `[새로 고침]` 카드만 남는다. 3초 시점에는 숨은 채로 `renderer.recreate()` 까지 실행된다.
**Fix:** `onVisibility` 에서 hidden 일 때 `tickTimer` 를 멈추고(또는 tick 핸들러가 `document.visibilityState === "hidden"` 이면 건너뜀), visible 로 돌아오면 `lostAt` 을 `visible` 이벤트의 `at` 으로 갱신한 뒤 타이머를 다시 시작한다. `recreating` 상태도 `visible` 이벤트에서 시계를 늘리는지 리듀서에서 정해 둔다.

### WR-03: 닉네임 스키마 상한 `max(64)` 가 "8 자소" 규칙과 맞지 않아 유효한 닉네임이 400 으로 거부되고 "연결이 불안정해요"로 보인다

**File:** `shared/schemas.ts:6`, 관련 `shared/nickname.ts:13`, `src/net/copy.ts:41-45`
**Issue:** 결정 0052-1 로 닉네임 한도가 8 자소(grapheme)가 되었는데 HTTP 본문 스키마는 UTF-16 길이 64 다. ZWJ 가족 이모지(U+1F468 U+200D U+1F469 U+200D U+1F467 U+200D U+1F466) 는 11 단위이고 8 개면 88 단위(직접 확인: 길이 88, 자소 8)다. `validateNickname` 은 이를 유효로 판정하지만(`\p{S}` 가시 문자, ZWJ 허용) 서버 스키마 단계에서 `BAD_REQUEST` 400 으로 거부된다. 클라이언트 `messageForApiError` 는 `BAD_REQUEST` 를 `NETWORK_TEXT`("연결이 불안정해요")로 접어, 사용자가 원인을 알 수 없다.
**Fix:** 스키마 상한을 자소 기준 최악값에 맞춰 넉넉히 올린다(예: 128 이상). 길이 판정은 `validateNickname` 이 하게 둔다.

```ts
const nickname = z.string().max(256); // 길이 판정은 validateNickname(8 자소)이 한다
```

### WR-04: 클라이언트 탭 간격과 서버 `MOVE_MIN_GAP_MS` 가 같은 150ms 라 지터에 서버가 조용히 버리고, 클라이언트는 거짓 "연결 불안정" 알림을 띄운다

**File:** `src/world/input.ts:11`, `shared/game/world.ts:18,141`, `src/world/runtime.ts:777-786`, `worker/room.ts:864-882`
**Issue:** `TAP_MIN_GAP_MS`(클라이언트 `Date.now()` 간격)와 `MOVE_MIN_GAP_MS`(서버 도착 시각 간격)가 둘 다 150 이다. 네트워크 지터나 서버 처리 지연(`await advance(...)`)으로 도착 간격이 150ms 미만이 되면 서버는 `TOO_SOON` 을 조용히 버린다(오류 프레임 없음). 클라이언트는 링을 띄우고 `notifyMoveSent` 로 1.5초 타이머를 걸어 두었다가, 응답이 없으면 링을 지우고 `NETWORK_TEXT` 알림을 띄운다. 연결은 정상인데 빠르게 연타하면 거짓 오류 알림이 뜬다.
**Fix:** 클라이언트 간격을 서버 간격보다 확실히 크게 둔다(예: 클라이언트 200ms, 서버 150ms 유지 또는 서버를 120ms 로). 또는 서버가 `TOO_SOON` 일 때 현재 구간(`move` 프레임)을 해당 소켓에 다시 보내 ack 로 삼는다.

### WR-05: `npm run deploy -- <인자>` 로 배포 이름 가드가 우회될 수 있다

**File:** `package.json:15`, `scripts/check-deploy-target.mjs`
**Issue:** `deploy` 스크립트는 `... && node scripts/check-deploy-target.mjs && wrangler deploy` 이고 npm 은 `--` 뒤 인자를 **스크립트 문자열의 끝**(= `wrangler deploy`)에 붙인다. `npm run deploy -- --name minifia` 는 가드가 통과한 뒤 wrangler 에 `--name minifia` 를 넘겨 v1.0 Worker 를 덮어쓸 수 있다. 가드는 `dist/worker/wrangler.json` 의 name 만 보고 wrangler 실제 인자는 보지 않는다. 직접 `npx wrangler deploy` 도 가드 밖이다. 사람이 의도해야 하는 경로지만, "v1 을 절대 배포하지 않는다"가 이 페이즈의 불변식이고 CR-01 과 같은 계열이다.
**Fix:** 배포를 인자를 받지 않는 래퍼(`scripts/deploy.mjs`)로 옮겨 `spawnSync("wrangler", ["deploy", "--config", "dist/worker/wrangler.json"])` 처럼 고정 인자로 실행하고, 래퍼가 `process.argv.slice(2)` 가 비어 있지 않으면 거부한다. 최소한 `check-deploy-target.mjs` 에서 `npm_config_argv`/`process.env.npm_lifecycle_script` 의 추가 인자를 거부하는 방법도 있다.

## Info

### IN-01: `check-deploy-target.mjs` 헤더 주석이 실제 동작과 다르다

**File:** `scripts/check-deploy-target.mjs:3-5, 13`
**Issue:** 주석은 ".wrangler/deploy/config.json 이 가리키는 dist/worker/wrangler.json" 을 검사한다고 쓰지만 코드는 `dist/worker/wrangler.json` 경로를 고정으로 읽고 redirect 파일은 읽지 않는다. redirect 가 다른 곳을 가리키는 낡은 상태면 검사한 파일과 실제 배포 파일이 다를 수 있다.
**Fix:** `.wrangler/deploy/config.json` 의 `configPath` 를 읽어 그 경로의 name 을 검사하거나, 주석을 실제 동작에 맞춘다.

### IN-02: 방 삭제 경로에서 `this.room = null`/`dropWorld()` 가 `await deleteAll()` 뒤에 있다

**File:** `worker/room.ts:309-314, 687-691`
**Issue:** `deleteAlarm()`/`deleteAll()` 을 기다리는 동안 `this.room` 이 아직 살아 있다. 이 사이에 위치 저장 타이머가 돌면 `flushWorld` 의 `!this.room` 가드를 통과해 `world` 키를 다시 써서, 지운 저장소에 고아 `world` 키가 남을 수 있다(무해하지만 `deleteAll` 의도에 어긋남). 입력 게이트가 타이머를 막는지는 보장되지 않는다.
**Fix:** `this.room = null; this.dropWorld();` 를 `await` 앞으로 옮기고 그다음 저장소를 지운다.

### IN-03: 알람 실패 시 1초 재시도에 상한·백오프가 없다

**File:** `worker/room.ts:735-739`
**Issue:** 지속적으로 던지는 상태(저장소 오류, 손상된 방 상태)에서는 방 만료까지 매초 알람이 돌며 로그가 쌓이고, `advance` 자체가 던지면 만료 정리도 되지 않는다.
**Fix:** 연속 실패 횟수를 세어 지수 백오프(최대 30초)와 상한 후 포기를 둔다.

### IN-04: `WorldStore.reset()` 이 제품 코드에서 호출되지 않는다

**File:** `src/world/store.ts:48-56`, `src/screens/RoomScreen.tsx:128-136`
**Issue:** 주석은 "연결을 닫을 때 비운다"인데 호출처가 없다(`src` 전체 검색). 재접속 시 이전 구간·`ready` 가 snap 이 올 때까지 남는다. epoch 규칙으로 틀린 위치를 그리지는 않지만, 죽은 API 이거나 호출이 빠졌다.
**Fix:** `status` 가 `reconnecting` 으로 바뀔 때 호출하거나, 쓰지 않는다면 제거하고 주석을 고친다.

### IN-05: `build()` 가 중간에 던지면 만든 WebGL 컨텍스트와 캔버스를 정리하지 않는다

**File:** `src/world/threeRenderer.ts:63-102`
**Issue:** `makeGl` 성공 뒤 `buildBarScene`·`configureGl` 이 던지면 `gl`·`canvas` 가 해제되지 않은 채 reject 된다. `[다시 시도]` 마다 컨텍스트가 쌓이면 브라우저 컨텍스트 상한(약 16개)에서 이전 컨텍스트가 소실된다. 확률은 낮다.
**Fix:** `makeGl` 이후를 `try/catch` 로 감싸 `releaseGl(gl); canvas.remove();` 후 다시 던진다.

### IN-06: 소소한 방어·일관성

**File:** `src/debug/perfProbe.ts:26-37`, `src/screens/Lobby.tsx:123-135, 208`, `src/world/runtime.ts:514`
**Issue:** (a) `initPerfDebug` 는 `?perf=1` 이면 동기로 `true` 를 돌려 `App` 렌더를 건너뛰는데, 지연 로드가 실패하면 빈 화면이 남는다("앱 시작을 막지 않는다"는 주석과 다름). (b) `pressStart` 는 `send` 가 `false`(미전송)여도 `setLocked(true)` 로 2초간 버튼을 잠근다. 내보내기 확인(`onConfirm`)도 반환값을 보지 않는다. (c) `updateRing` 의 ack 판정 `s.t0 >= sentAt - 1000` 은 직전 탭의 늦게 온 구간을 이번 탭의 응답으로 오인할 수 있다(링이 이전 목적지로 미끄러짐).
**Fix:** (a) 로드 실패 시 `App` 을 렌더하도록 폴백. (b) `send(...) === false` 이면 잠그지 않고 알림. (c) ack 에 클라이언트 요청 번호를 쓰거나 슬랙을 줄인다.

---

_Reviewed: 2026-11-01_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
