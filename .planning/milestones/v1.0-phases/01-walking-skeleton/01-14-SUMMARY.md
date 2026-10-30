---
phase: 01-walking-skeleton
plan: 14
subsystem: deploy-verification
tags: [smoke, deploy, og-image, cache-headers, handoff, cloudflare]
status: complete

requires:
  - phase: 01-walking-skeleton
    provides: "01-02 첫 배포와 scripts/prod-url.txt, 01-09 서버 방·시작·누출 규칙, 01-13 역할 확인·낮 화면"
provides:
  - "scripts/smoke.mjs full 단계(--players, --previous-version): 다인원 한 판·시작 조건·누출 전수·마감 일치·전환 편차·재접속·에셋"
  - "임시 OG 이미지 생성기와 public/og.png, OG 메타, public/_headers 캐시 규칙"
  - "npm run typecheck 앞의 tokens:check, tokens.css LF 고정"
  - "배포본 5명·8명 한 판 검증(성공 기준 1·3·4·5), HANDOFF·README·SKELETON 갱신과 개인 원격 push"
affects: [1페이즈 verify-work(실기기 UAT), 2페이즈 낮 토론, 정식 출시 마일스톤(OG 이미지·주소 교체)]

actuals:
  tokens: 26000
  tasks: 3
  commits: 3
plan_head_before: 938fa1cc3a93f094afd66460808f82d9387d1a0d
plan_head_after: 10bbca1e98d786ea63c830b9a429d2aa4258d04a

tech-stack:
  added: []
  patterns:
    - "배포본 스모크는 Node 내장 fetch·WebSocket·performance 만 쓰고 셸을 부르지 않는다(Windows 동일)"
    - "누출 검사는 클라이언트별 프레임·HTTP 응답 원문에 다른 사람의 토큰이 있는지와 role·allies 키 경로를 깊이 훑어 확인"
    - "OG 이미지는 패키지 없이 node:zlib 로 PNG 를 직접 인코딩(결정적 출력)"

key-files:
  created:
    - scripts/make-og.mjs
    - public/og.png
    - public/_headers
  modified:
    - scripts/smoke.mjs
    - index.html
    - package.json
    - .gitattributes
    - HANDOFF.md
    - README.md
    - .planning/phases/01-walking-skeleton/SKELETON.md

key-decisions:
  - "같은 이름 409 검사는 마지막 한 자리가 남았을 때 한다 — 가득 찬 방은 이름보다 ROOM_FULL 이 먼저라 8명에서 NICKNAME_TAKEN 을 볼 수 없다"
  - "full 단계의 전체 제한은 120초(create 는 30초) — 배정 3초 + 역할 확인 15초가 들어간다"

requirements-completed: [DEPLOY-01, ROOM-01, ROOM-02, ROOM-03, CONN-01, GAME-01, ROLE-01, ROLE-02]
---

# Phase 1 Plan 14: 배포본 full 스모크·OG·캐시·인계 Summary

**배포 주소는 그대로인 채 새 버전을 올리고, 배포본에서 5명·8명이 연결자 4명 조건으로 시작해 각자 자기 역할만 받고 0.1초 안팎 편차로 낮까지 가는 것을 자동 스모크로 확인했다. 임시 OG 이미지·그림 캐시 규칙·토큰 검사를 넣고 HANDOFF 를 개인 원격에 push 했다.**

## 결과 요약

| 항목 | 값 |
| --- | --- |
| 배포 주소 | https://minifia.dhplay.workers.dev (scripts/prod-url.txt 와 같음, 커밋 이력 한 줄) |
| 배포 계정 | `npx wrangler whoami` 로 개인 계정(dhkim1522@naver.com) 확인 후 배포, 두 번 모두 |
| OLD 버전 | `2026-10-22T02:09:51Z+9625cab` |
| Task 1 배포 버전 | `2026-10-23T07:56:55Z+21a41e7` |
| Task 2 배포 버전(최종) | `2026-10-23T07:59:34Z+59caa32` |
| Task 1 스모크 | `SMOKE OK full code=1142 players=5 spread=50ms` · `code=8779 players=8 spread=70ms` |
| Task 2 스모크(최종 배포본) | `SMOKE OK full code=9473 players=5 spread=80ms` · `code=6679 players=8 spread=63ms` |
| `--players 3` | 사용법 출력, exit 2 |
| `@` 주소 응답(가정 A10) | **307** (리다이렉트를 따르지 않고 확인). `%40` 주소는 200 image/png, Cache-Control `public, max-age=86400` |
| `/og.png` | 200 image/png, `public, max-age=3600` |
| 로컬 검증 | 테스트 40파일 588개 통과, `npm run typecheck`(tokens:check 포함) 통과, `npm run build` 후 `dist/client` 에 `_headers`·`og.png` |
| push | `git push origin main`(938fa1c..10bbca1), `git rev-parse HEAD` = `origin/main` |

## 한 일

1. **Task 1 (tracer)** — 스모크 full 단계: 방 만들기 → 미리보기(키는 nickname·seat 뿐) → 참가 → 같은 이름 409 → 연결 3명 start 거절(NOT_ENOUGH_PLAYERS + lobby state 재전송) → 전원 hello → 시작 → roleReveal 중 한 명 재접속(같은 seat·역할) → day → 시작 뒤 참가 409 GAME_STARTED → 낮 미리보기 players []. 단언: 다른 사람의 토큰이 어떤 프레임·응답에도 없음, players 항목 키 집합, role 키는 view.me.role 에만, 마피아에게만 allies(다른 마피아 seat 와 같음), 인원별 역할 수, 단계 순서(건너뜀 없음), roleReveal 마감 일치, day 도착 편차 500ms 미만. 로컬(vite dev)에서 4·5·8명을 먼저 돌려 고친 뒤 배포했다. 커밋 `21a41e7`.
2. **Task 2** — `scripts/make-og.mjs`(node:zlib, night-900 바탕 + gray-50 직선·원 자모 '미니피아', 같은 입력 → 같은 바이트 확인), `public/og.png` 1200×630(눈으로 확인: 가운데 630 안전 영역 안), `index.html` 제목·og:title '미니피아'·og:image 절대 주소·너비 높이·og:url 없음, `public/_headers`, `tokens:check`, `.gitattributes`, 스모크 에셋 검사. 커밋 `59caa32`.
3. **Task 3** — HANDOFF.md 교체(배포 주소, 명령, 윈도우 wrangler 로그인, Worker 이름 = 주소, R18, 한 브라우저 프로필 = 한 사람, 실기기 가정, 다음 할 일), README "개발" 절, SKELETON 체크박스. 토큰 모양 문자열 grep 없음, 원격 주소 확인 후 커밋·push. 커밋 `10bbca1`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] 같은 이름 409 검사가 8명 방에서 ROOM_FULL 로 나옴**
- **Found during:** Task 1, 로컬 8명 스모크
- **Issue:** 계획 순서((3) 전원 참가 뒤 "스모크2" 재참가)로는 8명에서 방이 가득 차 서버가 NICKNAME_TAKEN 대신 ROOM_FULL 을 준다(서버 규칙은 정상)
- **Fix:** 마지막 한 자리가 남은 시점(마지막 참가 직전)에 같은 이름 참가를 시도하도록 순서를 바꿈
- **Files modified:** scripts/smoke.mjs
- **Commit:** 21a41e7

### 관찰(수정 아님)

- **배포 직후 `--previous-version` 검사 실패 1회:** Task 2 배포 직후 곧바로 돌린 스모크가 옛 버전(07:56:55Z+21a41e7)을 읽어 "배포 뒤에도 version 이 같음"으로 실패했다. 몇 초 뒤 `/api/health` 는 새 버전이었고 같은 명령이 통과했다. 배포 직후 잠시 옛 버전이 응답하는 전파 지연이며 스모크 결함이 아니다. HANDOFF 에 "배포 뒤 잠시 기다렸다 돌린다"를 적었다.

서버·화면 코드는 고치지 않았다. 규칙을 서버가 정하고 남의 역할을 클라이언트로 보내지 않는 원칙은 그대로이며 배포본 스모크로 확인했다.

## Known Stubs

없음. `public/og.png` 는 계획대로 **임시** 그림이며(스크립트 머리 주석·HANDOFF 에 정식 교체 경로 기록) 기능 stub 이 아니다.

## Threat Flags

없음. 새 네트워크 엔드포인트·인증 경로 없음(정적 `/og.png` 와 `_headers` 만 추가).

## 실기기 UAT 는 단계 끝 확인으로 남김

이 계획의 human-check 는 `workflow.human_verify_mode = end-of-phase` 에 따라 `/gsd-verify-work 1` 에서 사람이 확인한다. 자동 스모크로 대신할 수 없어 아직 **검증되지 않은** 항목:

1. 360×640 폰에서 링크 참가·대기실 8인·역할 확인·낮 화면이 세로 스크롤 없이 들어가는지, 시민 설명 세 줄 이내(A15)
2. iOS Safari 시트 3종 `<dialog>` 포커스(A12)와 닫은 뒤 버튼으로 포커스 복귀
3. 공유하기·링크 복사 제스처(A14), 카카오톡 링크 미리보기 제목·설명·임시 이미지(A7)
4. 실기기 시계 오프셋 정확도와 폰들이 0.5초 이내로 함께 전환되는 체감(A1)
5. 30초 포기 기준(A17), 화면 잠금 2분 뒤 복귀(좀비 소켓, A3)
6. 배포 중 소켓 끊김과 자동 재접속(A5)
7. srcset 선택(A11 — @2x/@4x 어느 쪽을 받는지)
8. 연결된 사람 기준 시작 조건의 좀비 connected 문제(Open Question 7), 느린 망 첫 대기실 채움, 첫 화면 버전 글자와 OLD 비교

연결된 4명 이상은 "한 브라우저 프로필 = 한 사람" 전제로 폰 4대, 또는 폰 2대 이상 + PC 의 서로 다른 브라우저로 만든다.

## Self-Check: PASSED

- FOUND: scripts/make-og.mjs, public/og.png, public/_headers, scripts/smoke.mjs(SMOKE OK full·--previous-version·--players·NOT_ENOUGH_PLAYERS·/join), HANDOFF.md, README.md
- FOUND commits: 21a41e7, 59caa32, 10bbca1 (HEAD 의 조상)
- 임시 파일(.red-*.json 등) 없음. 미추적 `.planning/milestone.lock`·`.planning/state.json` 은 건드리지 않음
