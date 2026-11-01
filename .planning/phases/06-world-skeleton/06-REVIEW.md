---
phase: 06-world-skeleton
reviewed: 2026-11-01T09:30:00Z
depth: standard
files_reviewed: 29
files_reviewed_list:
  - docs/architecture.md
  - docs/screen-map.md
  - package.json
  - scripts/deploy-target.mjs
  - scripts/deploy-target.test.mjs
  - scripts/deploy.mjs
  - scripts/e2e/browser.mjs
  - scripts/e2e/flows.mjs
  - scripts/e2e/lib.mjs
  - scripts/e2e/lib.test.mjs
  - shared/nickname.ts
  - shared/schemas.ts
  - src/styles/world.css
  - src/world/input.ts
  - src/world/runtime.ts
  - src/world/status.ts
  - src/world/tagOrder.ts
  - test/client/v2parts.test.tsx
  - test/client/worldStage.test.tsx
  - test/unit/input.test.ts
  - test/unit/nickname.test.ts
  - test/unit/schemas.test.ts
  - test/unit/status.test.ts
  - test/unit/tagOrder.test.ts
  - test/worker/http.test.ts
  - test/worker/join.test.ts
  - test/worker/webSocketClose.test.ts
  - worker/index.ts
  - worker/room.ts
findings:
  critical: 0
  warning: 3
  info: 6
  total: 9
status: issues_found
---

# Phase 6: Code Review Report (수정 이후 재검토)

**Reviewed:** 2026-11-01
**Depth:** standard
**Files Reviewed:** 29 (요청 목록의 소스·테스트·문서 전부. 참고로 읽은 파일은 CLAUDE.md, 06-REVIEW-FIX.md, 06-REVIEW-DISPOSITION.md, shared/version.ts, wrangler.jsonc, src/net/useRoomConnection.ts, src/components/WorldStage.tsx, scripts/check-deploy-target.mjs)
**Status:** issues_found

## Summary

이 문서는 이전 리뷰(27cfbac)의 수정(CR-01, WR-01~05)과 갭 계획 06-22·06-23 이후에 다시 한 재검토다. 기준 diff는 `27cfbac..HEAD`다. 이전 리뷰 본문은 이 문서가 덮어썼다.

**이전 수정 6건은 모두 원래 지적을 닫았다.** 회귀는 찾지 못했다. 아래에 근거를 적는다.

| 이전 ID | 판정 | 확인한 내용 |
|---|---|---|
| CR-01 | 닫힘 | `assertNotV1` 이 호스트 끝 점을 지운 뒤 비교한다. `%2e`, 전각 마침표(U+3002), 여러 끝 점, 대문자, 포트, 사용자 정보 변형이 모두 같은 경로로 걸린다. `resolveTarget` 은 `u.origin` 을 넘기는데 origin 에도 끝 점이 남아 있어 다시 파싱될 때 같은 정규화를 거친다. `judgeDeployTarget` 은 동등 비교라 끝 점 변형이 통과할 수 없다. |
| WR-01 | 닫힘 | `frame()` 의 `finally` 에서 `schedule()` 이 불린다. `drawFrame` 안에 `return` 으로 일부러 루프를 멈추던 경로가 없음을 확인했다. 숨김·`disposed`·`renderer === null` 판정은 `schedule()` 안에 그대로 있어 멈춤 의미가 바뀌지 않았다. 남은 한계: 매 프레임 던지는 지속 오류는 로그 1초 1회뿐 사용자에게 보이는 신호가 없다(리뷰가 제시한 두 안 중 "루프 유지"를 택한 결과이며 결함으로 세지 않는다). |
| WR-02 | 닫힘 (조건 하나) | 숨은 동안 tick 을 보내지 않고 `visible` 이벤트가 `lost`·`recreating` 모두에서 시계를 옮긴다. `shouldRecreate` 는 `prev.status === "lost" && next.status === "recreating"` 만 참이라 재생성이 한 번 더 일어나지 않는다. 조건: `onVisibility` 는 `renderer.isContextLost()` 일 때만 `visible` 을 보낸다. 컨텍스트가 숨은 사이 복구돼 `restored` 이벤트가 오면 `ready` 로 가므로 문제없지만, 복구도 소실도 아닌 어정쩡한 경우에는 옛 `lostAt` 이 남아 첫 tick 에 곧바로 `failed` 가 될 수 있다. 실제 브라우저에서 이 틈이 열리는지는 확인하지 못했다. |
| WR-03 | 닫힘 (부작용은 IN-03) | 스키마 상한 256, `validateNickname` 의 같은 상한, `isNicknameTooBig` 의 `too_big` + `path === ["nickname"]` 판정이 맞물린다. zod 의 문자열 `max` 위반 코드가 `too_big` 이다. |
| WR-04 | 닫힘 (문서 어긋남은 IN-02) | `TAP_MIN_GAP_MS = 150 + 100`. 판정은 서버가 그대로 쥔다. `createTapGate` 는 거절한 탭이 시계를 늘리지 않는 기존 규칙을 유지한다. |
| WR-05 | 닫힘 (새 위험은 WR-01) | `npm run deploy -- <인자>` 의 인자는 스크립트 문자열 맨 끝, 곧 `node scripts/deploy.mjs` 뒤에 붙고 `planDeploy` 가 거부한다. wrangler 에는 argv 를 넘기지 않는다. 단, 이 래퍼의 "직접 실행" 판정에 조용히 건너뛰는 틈이 있다(WR-01). |

**새 코드 판정.**

- `rankTags`/`writeTags`: 순위(내 이름표 맨 위, 나머지 발 y, 동점 seat)와 겹침 판정(면적이 있어야 겹침, 변만 닿으면 아님)은 맞다. 사각형 계산이 런타임의 `translate(x, bottom) translate(-50%, -100%)` 와 일치한다. 사슬 겹침(A-B, B-C)에서도 맨 앞은 가장 위 하나뿐이다. 남은 문제는 DOM 쪽 캐시 정합(WR-03)과 판정 기준이 e2e 와 미세하게 다른 점(IN-01), 폭 캐시와 불투명도 처리(IN-04)다.
- `dropSockets` 의 합성 close: 앱 쪽 `useRoomConnection` 이 `socketRef.current !== ws` 로 낡은 소켓의 close 를 무시하므로, 합성 close 뒤 실제 close 가 열 초 늦게 와도 새 연결을 덮지 않는다. 문제 없다.
- `deployObservedOf`/`deployHoldChecks`: 로직 자체는 테스트와 일치한다. 다만 신호가 없을 때의 DH0 행이 통과로 집계된다(WR-02).
- `webSocketClose` 맞받아치기: 예약 코드 제외, `try/finally`, 던짐 삼킴 모두 맞다. 효과 검증이 남아 있다(IN-05).

## Warnings

### WR-01: `deploy.mjs` 의 "직접 실행" 판정이 조용히 건너뛰어 배포가 안 됐는데 성공으로 끝날 수 있다

**File:** `scripts/deploy.mjs:30`
**Issue:** `if (process.argv[1] === fileURLToPath(import.meta.url))` 은 Node 가 `import.meta.url` 을 심볼릭 링크를 푼 실제 경로로, `process.argv[1]` 을 풀지 않은 경로로 주는 환경(저장소 경로 어딘가가 심볼릭 링크일 때, Windows 의 드라이브 문자 대소문자 차이)에서 거짓이 된다. 사용자가 집 Windows PC 와 Mac 을 오가므로 가능성이 있다. 이때 `planDeploy` 거부도 `wrangler deploy` 도 실행되지 않고 종료 상태 0 으로 끝난다. 그러면 `npm run deploy` 가 "성공"으로 보이는데 아무것도 배포되지 않는다. 같은 현상을 임시 스크립트로 재현했다: 심볼릭 링크를 거치면 판정이 거짓, 직접 실행하면 참이었다. 같은 패턴이 `scripts/check-account.mjs`, `scripts/check-deploy-target.mjs` 에도 있어, 링크 경로에서는 계정 확인과 산출물 확인도 함께 건너뛴다(이쪽은 이전부터 있던 패턴이다). 래퍼는 안전장치이므로 실패해야 할 때 소리 없이 성공하면 안 된다. (이 항목은 정적 분석과 임시 스크립트 재현으로 확인했다. 배포 스크립트 자체는 실행하지 않았다.)
**Fix:** 판정을 실제 경로끼리 비교하거나, 가져오기용 모듈과 실행용 파일을 나눠 실행 파일은 판정 없이 항상 `main` 을 돌게 한다.
```js
import { realpathSync } from "node:fs";
import { pathToFileURL } from "node:url";

const isMain = (() => {
  try {
    return pathToFileURL(realpathSync(process.argv[1])).href === import.meta.url;
  } catch {
    return false;
  }
})();
```
또는 `planDeploy` 를 `scripts/deploy-plan.mjs` 로 옮겨 테스트가 그것만 가져오게 하고, `scripts/deploy.mjs` 는 가드 없이 항상 실행한다.

### WR-02: 배포 신호가 없을 때의 `DH0` 행이 "통과"로 집계되어 초록으로 끝난다

**File:** `scripts/e2e/lib.mjs:2125-2134` (소비하는 쪽 `scripts/e2e/flows.mjs:1202`, `scripts/e2e/lib.mjs:282-295`)
**Issue:** 주석과 테스트 이름은 "통과로 세지 않음", "배포 없이 조용히 지나간 창이 초록이 되지 않게" 라고 한다. 하지만 행은 `{ ok: true, info: true }` 이고 `formatTables` 는 `r.ok` 로 통과를 센다. 결과 표에는 "통과"로 찍히고 요약의 통과/전체에도 들어가며 `exitCodeOf` 는 0 을 돌려준다. 수정 전에는 띠가 안 뜨면 RC6 이 실패했으므로, 배포 없이 배포 주소에 돌리면 예전에는 빨강이던 것이 이제는 초록이다. CONN-04·MAP-05 의 "배포 직후" 검증이 아직 이뤄지지 않았다는 사실이 표 숫자에서 사라진다. `info` 필드는 `recOne` 에서 `keep`(내용 유지) 용도로만 쓰이고 집계에는 영향이 없다.
**Fix:** 미확인 행을 통과 집계에서 빼거나, 이 흐름에서는 종료 코드에 반영한다. 최소한 표에 "통과" 대신 "미확인"으로 찍는다.
```js
// formatTables: info 행은 통과/전체에 넣지 않고 따로 센다
const key = `${r.scenario.split("/")[0]} | ${r.size}`;
if (r.info) { g.info = (g.info ?? 0) + 1; continue; }
```
`line()` 도 `r.info` 이면 결과 칸을 "참고" 로 찍게 한다. 배포 주소 모드에서 DH0 만 있으면 `exitCodeOf` 가 별도 코드(예: 3, 미확인)를 돌려주는 방법도 있다.

### WR-03: 액터를 다시 만들 때 `data-front` 캐시(`tagFront`)가 DOM 속성과 어긋난다

**File:** `src/world/runtime.ts:482` (`tagFront: false`), `src/world/runtime.ts:806-810`
**Issue:** `Actor.tagFront` 는 "래퍼에 `data-front` 가 붙어 있나"를 기억하는 캐시다. 그런데 `createActor` 는 항상 `false` 로 시작한다. 같은 seat 의 이름표 DOM 은 React 가 `key={p.seat}` 로 재사용하므로, 맨 앞이던 사람이 나가 액터가 지워진 직후(퇴장 연출 180ms 안, 또는 테스트 방의 봇 수를 빠르게 줄였다 늘릴 때) 같은 seat 에 새 액터가 생기면 DOM 에는 `data-front="true"` 가 남아 있다. 새 액터의 계산 결과가 `front === false` 이면 `a.tagFront !== front` 가 거짓이라 속성을 지우지 않는다. 결과는 겹치지 않은 이름표가 맨 앞 면(92%)으로 남는 것이다. `tagStyle`·`tagAlpha`·`tagZ` 는 빈 문자열로 시작해 첫 프레임에 반드시 쓰지만 `tagFront` 만 그렇지 않아서, 이전 캐시들과 비대칭이다. 확률은 낮고 영향은 외형이지만, e2e 의 NT3 ④("겹치지 않으면 알파 ≤ 0.85")가 이 상태를 실패로 잡는다.
**Fix:** 모르는 상태를 뜻하는 값으로 시작해 첫 프레임에 DOM 과 맞추게 한다.
```ts
// Actor
tagFront: boolean | null; // null = DOM 과 맞춘 적 없음
// createActor
tagFront: null,
// writeTags: 비교는 그대로(null !== false 이므로 첫 프레임에 속성을 맞춘다)
if (a.tagFront !== front) {
  a.tagFront = front;
  if (front) a.tag.setAttribute("data-front", "true");
  else a.tag.removeAttribute("data-front");
}
```

## Info

### IN-01: 런타임의 겹침 판정과 e2e NT3 의 판정 기준이 달라 경계에서 거짓 실패가 날 수 있다

**File:** `src/world/tagOrder.ts:31-32`, `scripts/e2e/lib.mjs:1851-1882`
**Issue:** 런타임은 높이 `NAMETAG_H = 24` 와 `offsetWidth`(정수로 반올림)로 엄격한 `<` 비교를 한다. e2e 는 실제 `getBoundingClientRect`(높이는 약 23.6 = 패딩 4 + 줄 높이 19.6)로 0.5px 여유(`OVERLAP_EPS`)를 두고 판정한다. 세로 간격이 약 23.1~24px 이고 가로로 겹치는 두 이름표는 런타임이 "겹침 → 맨 앞 짙은 면"이라 하고 e2e 는 "안 겹침 → 알파 ≤ 0.85 여야 함"이라 해서 ④ 가 실패한다. 봇이 돌아다니는 8명 로비(`flows.mjs:355`)에서 드물게 걸릴 수 있다.
**Fix:** e2e 쪽 ④ 는 경계 근처(양쪽 판정이 갈릴 수 있는 1px 띠)를 판정에서 빼거나, 런타임이 실측 높이를 `rankTags` 의 `h` 인자로 넘기게 한다(`rankTags` 는 이미 `h` 를 받는다).

### IN-02: UI-SPEC 의 탭 간격 문장이 구현(250ms)과 어긋난다

**File:** `.planning/phases/06-world-skeleton/06-UI-SPEC.md:362`
**Issue:** "탭 간격이 150ms 보다 짧으면 뒤 탭은 무시한다"로 남아 있다. WR-04 수정으로 클라이언트 간격은 250ms 이고 150ms 는 서버 값이다. 다음 페이즈의 계획자·검사자가 이 문장을 기준으로 150 을 다시 넣을 수 있다. `docs/screen-map.md` 에는 탭 간격 수치가 없어 영향이 없다.
**Fix:** 문장을 "클라이언트 250ms(서버 150ms + 여유 100ms), 서버가 150ms 안의 이동을 조용히 버린다"로 고친다.

### IN-03: 닉네임 상한 256 이 결합 문자 남용 여지를 넓히고, 본문 크기 상한과의 경계가 일관되지 않다

**File:** `shared/nickname.ts:14`, `shared/protocol.ts:18` (`MAX_BODY_BYTES = 1024`), `worker/index.ts:44-48`
**Issue:** (1) 규칙이 자소 8 개 + UTF-16 256 이라서, 자소 하나에 결합 문자(`\p{M}`)를 수십 개 얹은 이름이 통과한다. 이전 상한 64 에서도 가능했지만 네 배로 넓어졌다. 이름은 모든 참가자 화면에 퍼진다. 이름표의 이름 칸은 가로 말줄임이지만 이름이 다른 화면(결과 카드, 일지, 시트 등)에서 세로로 넘칠 수 있는지는 확인하지 못했다. (2) `readJsonBody` 의 1024바이트 상한이 스키마보다 먼저 걸리므로, 한글 약 341자부터는 `NICKNAME_INVALID` 가 아니라 `BAD_REQUEST` 가 나온다(257~340자는 `NICKNAME_INVALID`). WR-03 의 목적("이름 칸 아래에 맞는 문구")이 직접 호출에서만 일부 어긋난다. 클라이언트는 `validateNickname` 으로 먼저 거르므로 일반 사용자는 영향이 없다.
**Fix:** 상한을 자소 8 개 최악값(88)에 여유를 둔 128 정도로 낮추고(테스트가 이미 128 이상만 요구한다), 이름 하나가 가질 결합 문자 수(예: 자소당 8)를 `validateNickname` 에서 제한한다.

### IN-04: 이름표 폭 캐시가 0 을 고정하고, `rankTags` 가 불투명도를 모른다

**File:** `src/world/runtime.ts:779`, `src/world/runtime.ts:797`; `src/styles/v2.css:12` (`.mv-tag.is-away { opacity: 0.55 }`)
**Issue:** (1) `a.tagW === null` 일 때만 재므로, 처음 잰 값이 0(레이아웃 전, 가려진 상태)이면 다음 view 변경까지 `NAMETAG_MAX_W`(180) 폭으로 판정한다. 그러면 겹치지 않는 이름표까지 겹침으로 보여 짙은 면이 붙는다. 웹 폰트가 측정 뒤에 도착해 폭이 바뀌는 경우도 view 변경 전까지 낡은 값이다. (2) 끊긴 사람의 이름표(`is-away`)는 `.mv-tag` 자체가 55% 불투명이라, 맨 앞으로 뽑혀도 뒤가 비친다("뒤가 비치지 않게"라는 목적과 어긋남). 등장·퇴장 중 투명한 이름표도 맨 앞 후보에 든다.
**Fix:** `if (a.tagW === null || a.tagW === 0) a.tagW = a.tag.offsetWidth;` 로 0 은 다시 재게 한다. 불투명도가 1 미만인 이름표는 `TagBox` 에서 제외하거나(`front` 후보에서 빼기) `is-away` 일 때 맨 앞 면 규칙을 적용하지 않는다.

### IN-05: `webSocketClose` 맞받아치기의 효과와 대체 경로가 확인되지 않았다

**File:** `worker/room.ts:719-733`
**Issue:** 호출 규칙(예약 코드 1005·1006 제외, 던짐 삼킴, 연결 끊김 처리 후 맞받아치기)은 테스트가 고정한다. 그러나 (1) `wrangler.jsonc` 의 `compatibility_date` 가 2026-10-12 인데, Workers 에 Close 프레임 자동 응답 호환 플래그가 있고 날짜가 지나면 기본값이 켜진다고 알고 있다. 켜져 있다면 이 `ws.close` 는 이미 닫힌 소켓이라 항상 던져 삼켜지는 죽은 코드다. 06-23 이 "배포 없이는 검증 불가"라고 적은 대로 효과는 미확인이며, 플래그 상태는 공식 문서·배포 진단으로 확인이 필요하다(이 검토에서는 확인하지 못했다). (2) 던지는 코드(1004, 1015 등)면 소켓이 그대로 남는다. 대체로 `ws.close(1000, reason)` 한 번 더 시도하는 쪽이 낫다. (3) `handleDisconnect` 의 저장·방송을 기다린 뒤에야 맞받아치므로 저장이 느리면 클라이언트의 Close 응답이 그만큼 늦는다. 정리 순서를 앞당길 수도 있다.
**Fix:** 문서로 플래그 기본값과 날짜를 확인하고, 죽은 코드이면 `compatibility_flags` 를 명시하거나 이 블록을 제거한다. 살아 있다면 `catch` 안에서 `ws.close(1000, "closing")` 로 한 번 더 시도한다.

### IN-06: `deploy.mjs` 의 실행 오류와 `deployHoldFlow` 의 측정 보조 함수에 빈틈이 있다

**File:** `scripts/deploy.mjs:34-35`; `scripts/e2e/flows.mjs:783-797`
**Issue:** (1) `spawnSync` 가 `npx` 를 못 찾으면 `r.error` 가 채워지고 `r.status` 는 `null` 이라 종료 상태 1 로 끝나지만 메시지가 하나도 나오지 않는다. (2) `healthVersion` 의 `fetch` 에 타임아웃이 없다. 배포 중에 응답이 멈추면 관찰 창이 끝나지 않는다(전체 한도 `OVERALL_LIMIT_MS` 가 있어 영구는 아니다). (3) `socketsKeptOf` 는 방 소켓 수가 앞뒤로 같은지 본다. 페이지가 통째로 다시 불러와지면 `__e2eSockets` 가 비워지고 새 소켓이 하나 생겨 수가 같아져, 소켓이 바뀌었는데도 "유지됨"으로 판정된다.
**Fix:** (1) `if (r.error) console.error(r.error.message);` (2) `fetch(url, { signal: AbortSignal.timeout(10_000) })` (3) 페이지의 `performance.timeOrigin` 이나 문서 로드 표식을 `readLinkState` 에 더해 앞뒤가 같은지도 비교한다.

---

_Reviewed: 2026-11-01_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
