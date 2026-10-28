# 작업 인계

> 두 PC·다음 세션이 이어 가는 데 필요한 최소 정보만 적는다. **해결된 항목은 지운다**(기록은 결정 기록·SUMMARY·git 에 있다). 6KB 이하(`test/unit/handoff.test.ts`). 새 세션이 매번 읽는다. 환경 설정은 `docs/setup.md`.

## 지금 상태

- 4페이즈 서버 웨이브: 04-08 까지 완료(웨이브 6). 배포 금지(D-26)
- 마지막 작업: 실내 배경 V2(커튼 더 걷힘) + 명도 0.8 구움 + 헤더 글씨 번짐(결정 0033). 명도는 폰에서 적절하다고 확인됨. 버전은 `/api/health`.
- `npm run e2e` 는 인자가 없으면 **배포본**을 검사한다. 로컬은 `npm run dev` 후 `npm run e2e -- --url http://localhost:5173`.
- 배경·유령 그림을 바꾸면 `ASSET_VERSION`(`src/net/assets.ts`)을 올린다(정적 그림 캐시 1일).
- E2E 의 준비 단계 S4 실패(방장이 첫 밤에 탈락)는 무작위다. 배포 직후 첫 실행에서는 가끔 T1·D7(장면 상자가 52px 어긋남)이나 smoke 의 roleReveal 15초 초과도 나오는데 같은 명령을 다시 돌리면 통과한다(원인 미확인, 두 번 관찰).
- 내가 만들지 않은 `design/backgrounds/indoor-draft/`, `Claude outputs/` 는 커밋하지 않았다.

## 확인 대기 (사용자 답·확인이 필요한 것)

1. 폰에서 새 커튼 V2: 대기실 달·방 코드, 창·헤더 겹침, 유령 높이, 방장 배지, 후광·말풍선, 5글자 이름표 가장자리. (명도 조정은 `scripts/make-backdrops.mjs` 의 `GAME_BRIGHTNESS`)
2. 규칙 가정 A1(같은 밤 행동 동시 해결)·A2(마피아가 일부만 골라도 고른 표만 센다) — 결정 0020.
3. 프로젝트 `CLAUDE.md` 한 줄(결정 0021 에 맞춤) 수정 허락. 사용자 소유라 고치지 않는다.

## 다음 할 일

1. 영역 지도·가이드 이미지·에셋 자동 검사를 `docs/` 에 정리(폰 폭 360·390·430별 헤더·창·테이블·패널 영역, 그림이 지키는지 거르는 스크립트). gsd-addons 에 올릴지 결정.
2. 4페이즈: 논의 끝(`.planning/phases/04-execution-verdict/04-CONTEXT.md`, 결정 0034) · 시안 승인됨(`design/screens/execution-v1/`, 원본 Design 캔버스 KpxQ2EN37vQMkApXjv8in5) · 서버·공유 로직 계획 진행(04-RESEARCH·PATTERNS·VALIDATION). 다음: `/gsd-ui-phase 4` → 화면 웨이브 계획 추가 → 실행(서버만 배포 금지, D-26).
3. 큰 폰 세로 가운데 + 층 분리 에셋(투명 PNG·원래 크기 필요).
4. 점검: `/gsd-verify-work 3.1`, 각 페이즈(1·2·3·3.1)의 `/gsd-secure-phase`·`/gsd-validate-phase`·`/gsd-extract-learnings`.
5. 디자인 아티팩트 동기화(디자인 세션): 디자인 시스템·화면 설계서·화면 흐름.
