---
phase: 10-character-motion-costume
plan: "07"
subsystem: lobby-ui
tags: [dress, outfit, lobby, float-action, sheet, e2e, a11y]
status: complete
requirements: [AVTR-04]
requires:
  - phase: 10-02
    provides: "{t:dress,look} 규칙, players[].look 방송, 서버 250ms 간격·조용한 거절"
  - phase: 10-04
    provides: "view.players[].look → applyOutfit, window.__mfLooks 훅"
  - phase: 10-05
    provides: "avatar.mjs makeAvatarFlows, AVATAR_MARKERS, 떠 있는 버튼 숨김 규칙"
provides:
  - "로비 오른쪽 아래 hanger 떠 있는 버튼 → 패널을 덮는 한 줄 카드 띠 시트(카드 9장) → {t:dress,look} 한 번"
  - "useDress: 즉시 미리 보기(stageView) · 서버 값 맞춤 · 1200ms 조용한 되돌림 · 260ms 전송 간격(마지막 선택만)"
  - "public/outfits 승인 사본 9장, outfitCardSrc, ASSET_VERSION i4, /outfits/* 1일 캐시"
  - "E2E avatar-dress 와 dressChecks(DB1·DS1~DS6), AVATAR_MARKERS 의상 표식 3개"
affects: [10-08, 10-09]
tech-stack:
  added: []
  patterns: ["미리 보기는 WorldStage 에 넘기는 view 사본의 내 좌석 look 만 바꿔 처리(런타임·WorldStage 변경 없음)", "단일 버튼 묶음은 FloatActions single(두 칸 자리 안 잡음)"]
key-files:
  created:
    - src/components/v2/DressSheet.tsx
    - src/game/dressText.ts
    - src/net/useDress.ts
    - public/outfits/outfit-{coat,police,doctor,mafia,detective,reporter,elder,hood,noir}.png
    - test/client/dressSheet.test.tsx
    - test/client/useDress.test.tsx
  modified:
    - src/components/v2/FloatAction.tsx
    - src/components/v2/V2Icon.tsx
    - src/net/assets.ts
    - src/screens/Lobby.tsx
    - src/styles/v2.css
    - public/_headers
    - scripts/e2e/lib.mjs
    - scripts/e2e/lib.test.mjs
    - scripts/e2e/avatar.mjs
    - scripts/e2e/flows.mjs
    - test/unit/assets.test.ts
    - test/unit/e2eContract.test.ts
decisions:
  - "미리 보기·되돌림·전송 간격은 useDress 훅이 쥐고 거절 알림·토스트는 만들지 않는다(L30) — 되돌림은 화면이 서버 값으로 조용히 맞춰지는 것"
  - "Lobby 가 game.css 를 가져와 .mf-float 규칙을 공유한다(규칙 파일 이동 없음). 버튼 하나뿐인 묶음은 data-float-single 로 min-height 를 푼다"
  - "카드 그림은 1번 인물 한 장씩 9장(O-3). 색은 gray-100·night 토큰만, 새 토큰·hex 없음"
metrics:
  tasks: 3
  tasks_completed: 3
actuals:
  tokens: 22000
  tasks: 3
  commits: 6
plan_head_before: 96161cea3a2cc2072ff2a25073de8407d7777bd4
plan_head_after: 9e54394845425addd99073b4012598549c394696
---

# Phase 10 Plan 07: 로비 꾸미기 화면 Summary

로비에서 hanger 버튼 → 패널을 정확히 덮는 카드 띠 시트 → 카드 하나로 `{t:"dress",look}` 만 서버로 가고, 내 캐릭터는 즉시 갈아입으며 다른 폰도 서버 state 로 갈아입고 게임이 시작돼도 같은 look 이 유지된다. E2E avatar-dress 가 폰 2종에서 통과했다.

## 한 일

- **Task 1 (트레이서)**: V2Icon hanger(승인 bundle.js 데이터), FloatAction kind `dress`, `dressText.ts`(순서·이름·고정 문구), `DressSheet`(카드 72×112·그림 64×80·선택 테두리 2px+체크 12, 제목 글자 없음), `outfitCardSrc`·ASSET_VERSION `i4`, `public/outfits` 승인 사본 9장과 `_headers` 규칙, Lobby 연결.
- **Task 2**: `useDress`(미리 보기 `stageView`, 서버 값과 같아지면 종료, 1200ms 안에 안 같아지면 되돌림, 마지막 전송 뒤 260ms 안 선택은 마지막 것만 그 시각에, 끊기면 접힘), DressSheet 열 때 현재 카드 가운데 맞춤·초점, 좌우 화살표·Esc, `disabled`(aria-disabled), 닫으면 꾸미기 버튼으로 초점 복귀, 버튼 누르면 입력칸 blur.
- **Task 3**: `dressChecks`(DB1·DS1~DS6)와 AVATAR_MARKERS 의상 표식, E2E `avatar-dress`(AD1~AD6), FLOWS 등록.

## 검증

- `npx vitest run test/client/dressSheet.test.tsx test/client/useDress.test.tsx test/client/lobby.test.tsx test/client/icon.test.tsx test/unit/assets.test.ts test/unit/e2eContract.test.ts` 통과(마지막 5파일 166개 + icon), `roomScreen·app·worldStage·screens` 4파일 310개 통과
- `node --test scripts/e2e/lib.test.mjs` : 248 통과 / 실패 0
- `npm run typecheck` 오류 없음
- `npm run e2e -- --url http://localhost:5290 --only avatar-dress --sizes 360x560,390x844` (로컬 개발 서버, 끝낸 뒤 껐다): **390x844 통과 32 / 실패 0, 360x560 통과 32 / 실패 0** (방장·손님 버튼·시트·카드 기하 DB1·DS1~DS6, 손님 mafia 가 손님 화면 500ms·방장 화면 1500ms 안에 반영, 방장 noir 까지 두 페이지 `__mfLooks` 일치, 닫기 뒤 초점 복귀, 게임 시작 뒤 낮 토론에서 같은 look 유지·꾸미기 버튼과 시트 없음).
- 지시에 따라 웨이브 게이트(build·전체 vitest·ui.safety-gate·schema-drift)와 6종 전체 E2E 는 돌리지 않았다.

## Deviations from Plan

**1. [Rule 3 - Blocking] 단일 버튼 묶음 자리**
- **Found during:** Task 1
- **Issue:** `.mf-float` 는 버튼 두 칸(104) 자리를 잡아 버튼 하나면 위 칸에 붙어 아랫변이 패널 윗변 − 8 에 오지 않는다.
- **Fix:** `FloatActions single` → `data-float-single`, v2.css 에 `min-height: 0`. GameMap 은 `single` 을 쓰지 않아 그대로.
- **Files:** FloatAction.tsx, v2.css · **Commit:** 93e79b58

**2. 구현 선택 (편차 아님)**: `.mf-float` 규칙 공유는 Lobby 가 game.css 를 가져오는 쪽으로 골랐다. 로비 통합 시험은 계획이 lobby.test.tsx 에 두라던 것을 dressSheet.test.tsx 에 함께 두었다(lobby.test.tsx 는 변경 없음).

**3. dressChecks 입력**: 계획 입력에 `panel`·`nameFont` 를 더했고(DB1·DS1·DS6 에 필요), 닫힌 때의 버튼 사각형과 열린 시트를 한 번에 넘긴다. flows.mjs 의 도우미 `resetAndLeave` 를 makeAvatarFlows helpers 에 더했다(AD6 뒤 정리).

**4. commits 측정**: `rev-list` 로 12 가 잡히지만 병렬 실행 중인 10-06 커밋 6개가 같은 가지에 섞인 것이다. 이 계획의 커밋은 6개(RED 3 + GREEN 3)다.

## Known Stubs

없음.

## 이월 메모

- 셀렉터: `[data-float="dress"]`(접근성 "꾸미기") · `[data-dress-sheet]` · 카드 `button[data-outfit="{id}"]`(aria-pressed·aria-label "이름, 선택됨") · 닫기 `button[aria-label="닫기"]` · 이름 `.mv-dress-card__name`. 훅은 `window.__mfLooks` 만 읽는다.
- avatar.mjs 도우미: `readDressUi(page)`·`readLooks(page)`(모듈), `makeAvatarFlows` 반환 `{ avatarEmoteFlow, avatarDressFlow }`; helpers 에 `resetAndLeave` 추가됨. 10-08(avatar-phases)은 같은 객체·파일에 더할 것(lib.test.mjs extraSizes 계약 목록에 avatar-dress 포함).
- 새 값: `outfitCardSrc(id)` = `/outfits/outfit-{id}.png?v=i4`, ASSET_VERSION `i4`. `public/outfits/outfit-*.png` 9개가 실제 파일과 맞음(10-06 manifest 패턴과 일치, assets.test 가 9개를 고정).
- 상수: `DRESS_SEND_GAP_MS`=260, `DRESS_REVERT_MS`=1200(useDress.ts). 선택이 서버 값과 같으면 보내지 않고, 끊기면 미리 보기·대기 전송을 접는다.
- 로비 전용: 게임 단계에는 버튼·시트가 없다(E2E AD6). 방장 [맵 | 의상] 탭은 11페이즈(O-9). 다시 하기 뒤 look 유지는 10-02 가 보장.
- `.mf-float[data-float-single]` 와 `body:has([data-emote-tray]) .mf-float` 가 함께 걸려 동작 판이 열리면 꾸미기 버튼도 숨는다(의도).
- 카드 4.4장 보임은 폭 360 기준 4장 + 28px 걸침(스펙 4.1장과 약간 다름, DS3 은 4장 이상 + 8px 이상 걸침으로 검사).

## Self-Check: PASSED

- 생성 파일 DressSheet.tsx·dressText.ts·useDress.ts·dressSheet.test.tsx·useDress.test.tsx 와 public/outfits 9장 존재 확인.
- 커밋 1e47535b·93e79b58·82ef3b0d·2f898b29·a7f1b904·9e543948 이 HEAD 의 조상임을 확인.
