# 작업 인계

> 두 PC·다음 세션이 이어 가는 데 필요한 최소 정보만 적는다. **해결된 항목은 지운다**(기록은 결정 기록·SUMMARY·git 에 있다). 6KB 이하(`test/unit/handoff.test.ts`). 환경 설정은 `docs/setup.md`.

## 지금 상태

- **v3.0 구현 중(브랜치 `v3`)**: 13~18.1·21 까지 배포(결정 0072~0088, 배포 version `2026-11-15T13:03:01Z+e3cb26fa`, minifia-v3). **22 정리 완료(2026-11-16, 미배포)**: 판 종류 하나(확장판·마을·심부름·등불·옛 튜토리얼·시상 제거), 낮 순서 토론 → 찬반(집계 수만, 던진 표 과반) → 순차 지목(기록 없음) → 유언 10초 → 처형 6.6초, 유령 75%·이동 방향(결정 0089, 구현 선택은 0090). 기획서·구조·화면 지도(22 절)는 새 흐름으로 고쳤다.
- **방향(결정 0089)**: 첫날만 장르+키워드 문제(마피아는 `???`)는 23, 둘째 날부터 의심 포스트잇·새 튜토리얼은 24. 배포·폰 6종 전체 회귀는 24 끝에 한 번(0089-25).
- **v2.0 완료 처리(2026-11-07)**: 태그 `v2.0`, 문서는 `.planning/milestones/v2.0-*`. 열린 감사 항목 26개는 STATE.md 미룬 항목. main 은 v1.0 그대로, v3.0 실테스트 통과 뒤 반영.
- **캐릭터(결정 0047·0048)**: 원본 https://claude.ai/artifact/NP1XfUrYTTqQ5nAB1HKYT5 (사본 `design/v2.0/figure/`, 모듈 `design/v2.0/blockout/character.js`). `3d/mf3d.js` 는 옛 방식이라 안 쓴다.
- **시안**: 사본은 `design/v3.0/`(유령 `ghost3d/` 등). 18.1 헤더 시안 https://claude.ai/artifact/8598QRUVpJ1DaEnrqrtb48 .
- **맵(결정 0050)**: 재즈 바 + 시계탑 광장(`PLAYABLE_MAPS`, 방장이 고름). 블록아웃 https://claude.ai/artifact/1hzgEyAufgnDPVMvPvxdhP (사본 `design/v2.0/blockout/`).
- **브랜치**: 지금은 **`v3`**. `v2` 는 v2.0 그대로, `v1` 은 v1.0 배포본 수정 전용, `main` 은 배포된 v1.0. 다른 PC 는 `git fetch` 후 `git switch v3`.
- 배포: v3 https://minifia-v3.dhplay.workers.dev (Worker `minifia-v3`, `scripts/deploy-target.mjs`), v2 https://minifia-v2.dhplay.workers.dev (비교용), v1.0 `https://minifia.dhplay.workers.dev`. `npm run deploy` 가 계정·배포 대상 가드를 거친다(가드는 우회하지 않는다).
- 도구 메모: 버전은 `/api/health`. `npm run e2e` 는 인자가 없으면 배포본을 검사한다(로컬은 `npm run dev` 후 `-- --url http://localhost:5173 --only 흐름1,흐름2`). 전체 로컬 회귀는 묶음으로 나눠 돌린다(폰 6종 흐름을 한 묶음에 많이 몰면 부하 간헐이 나온다). 워커 시험(`--project worker`)도 부하 간헐이 있어 실패 파일은 단독 재실행으로 가린다. `backdrop-filter` 는 비접두 한 번만.
- 커밋 제외: `design/backgrounds/indoor-draft/`, `Claude outputs/`, `.planning/milestone.lock`, `.planning/state.json`.

## 확인 대기 (사용자 답·확인이 필요한 것)

- **v3.0 결정은 끝났다(2026-11-07)**: 세부는 `docs/playtest-v2.0-feedback.md`. 다시 묻지 않는다. 새 결정은 추천안으로 진행하고 기록한다. 시안은 캔버스 2~3개 + 추천안 바로 구현.
- **실테스트는 v3.0 전체를 한 번에**(팀·실기기, v2.0 실기기 칸도 그때). 단계별 팀 테스트는 없다.
- 결정 0071~0090 과 각 페이즈 UI-SPEC "기본값 기록"은 사용자가 돌아와 검토하고 한 줄씩 바꿀 수 있다. 0090-8: 유언 10초에 몸동작도 막았다(살리려면 audience 분기 필요).
- **22 눈 확인(실기기, 실테스트 때)**: 유령 75% 크기·방향, 유언 시트와 키보드, 처형 6.6초 연출. 알려진 한계 셋(진행 지장 없음): 360×560 찬반 투표자 스테이지 부족, 처형자 키보드 열림 시 자기 캐릭터 안 보임, 유령 이름표와 머리 사이 틈.
- **18.1·18 눈 확인**: 헤더 시간대 글자·내 캐릭터 움직임(0085)·늘어나는 기록 창과 키보드·결과판·처형 큰 글(0083), 광장·바의 아침·낮·저녁 조명(약하면 바 창 빛).
- 레포 재생성은 하지 않는다(사용자 결정). 위생 grep 은 계속.
- **Cloudflare 무료 한도**: DO 하루 쓰기 10만 행을 넘으면 방 만들기가 500(`1101`), 한국 09시 초기화. 대책은 결정 0076. 큰 회귀는 로컬로 돌린다.
- **알려진 한계**: `perfbudget` B2·M1 은 13페이즈 전부터 지속, 8자 이름 봇 8명판은 이름표가 겹칠 수 있다. 360×560·390×664 의 좁은 칸 사정, E2E 간헐 실패(원인 미확정), 꺼진 정치 장치 흐름 여섯은 새 순서로 안 고침(켤 때 고친다).

## 다음 할 일

1. **23페이즈 첫날 키워드 문제와 D1 판 기록** — discuss(0089 "정하지 않은 것") → UI-SPEC·시안(키워드 카드) → 계획·실행. 키워드 목록은 Claude 초안 + 사용자 검토. 이어 24(의심 포스트잇·새 튜토리얼).
2. **24 끝**: 폰 6종 전체 회귀 → 개인 계정 확인(`wrangler whoami`) → minifia-v3 배포·smoke → v3.0 실테스트(17 UAT Test 3 폰 2대, v2.0 실기기 칸 `.planning/milestones/v2.0-phases/12-sound-polish/12-TEAM-TEST.md` 포함). 통과하면 main 반영.
