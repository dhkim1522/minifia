# 작업 인계

> 두 PC·다음 세션이 이어 가는 데 필요한 최소 정보만 적는다. **해결된 항목은 지운다**(기록은 결정 기록·SUMMARY·git 에 있다). 6KB 이하(`test/unit/handoff.test.ts`). 환경 설정은 `docs/setup.md`.

## 지금 상태

- **v3.0 구현 중(브랜치 `v3`)**: 13~18.1·21 까지 배포(결정 0072~0088, 배포 version `2026-11-15T13:03:01Z+e3cb26fa`, minifia-v3). **22 정리 완료(미배포)**: 판 하나, 낮 순서 토론 → 찬반(집계 수만) → 순차 지목 → 유언 → 처형, 유령 75%(결정 0089·0090). **23 첫날 키워드·D1 판 기록 완료(2026-11-17, 미배포 — 배포 가드가 D1 `database_id` 없으면 막는다)**: 첫날만 `keyword` 13초 → 낮 … 처형 → `answerReveal` → 밤, 개인 단계 전원 완료 시 1.5초 뒤 넘어감, 판 끝 D1 한 줄(결정 0091). 기획서·구조·화면 지도도 고쳤다.
- **방향(결정 0089)**: 둘째 날부터 의심 포스트잇·새 튜토리얼은 24. 배포·폰 6종 전체 회귀는 24 끝에 한 번(0089-25).
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
- 결정 0071~0091 과 각 페이즈 UI-SPEC "기본값 기록"은 사용자가 돌아와 검토하고 한 줄씩 바꿀 수 있다. 0090-8: 유언 10초에 몸동작도 막았다(살리려면 audience 분기 필요).
- **키워드 목록 초안 검토(0089-23)**: `shared/game/keywords.ts` 7장르 306개, 사용자 검토 대기. 3글자 초성 우연 겹침(고양이↔가을이) 등 알려진 한계는 0091-19.
- **22·23 눈 확인(실기기, 실테스트 때)**: 유령 75%·유언 시트·처형 6.6초 / 키워드 카드·키보드 열린 664 이하 폰(카드가 띠·소리 단추를 덮음)·자동 열린 모두의 답 시트(토론 입력을 가림). 22 알려진 한계 셋(0090-17)은 진행에 지장 없음.
- **18.1·18 눈 확인**: 헤더 시간대 글자·내 캐릭터 움직임(0085)·늘어나는 기록 창과 키보드·결과판·처형 큰 글(0083), 광장·바의 아침·낮·저녁 조명(약하면 바 창 빛).
- 레포 재생성은 하지 않는다(사용자 결정). 위생 grep 은 계속.
- **Cloudflare 무료 한도**: DO 하루 쓰기 10만 행을 넘으면 방 만들기가 500(`1101`), 한국 09시 초기화. 대책은 결정 0076. 큰 회귀는 로컬로 돌린다.
- **알려진 한계**: `perfbudget` B2·M1 은 13페이즈 전부터 지속, 8자 이름 봇 8명판은 이름표가 겹칠 수 있다. 360×560·390×664 의 좁은 칸 사정, E2E 간헐 실패(원인 미확정), 꺼진 정치 장치 흐름 여섯은 새 순서로 안 고침(켤 때 고친다).

## 다음 할 일

1. **Codex 작업 방식**은 [AGENTS.md](AGENTS.md)의 역할별 직접 위임. 재디자인 기준은 [B안](design/v3.0/redesign/b-noir.png)이고, 재즈 바 낮·밤 조명부터 8인판 성능과 가독성을 확인한다. **24페이즈**는 24-01~07 구현 기록까지 있으며, 다음 기능 작업은 24-08 튜토리얼 장면이다.
2. **24 끝**: 폰 6종 전체 회귀 → **D1: 개인 계정 확인 → `wrangler d1 create minifia-v3-games --location apac` → `database_id` 손 기입 → `wrangler d1 migrations apply DB --remote` → `npm run games -- --remote` 빈 표 → 배포**(가드가 id 없으면 막는다, 0091-18) → minifia-v3 배포·smoke → v3.0 실테스트(17 UAT Test 3 폰 2대, v2.0 실기기 칸 `.planning/milestones/v2.0-phases/12-sound-polish/12-TEAM-TEST.md` 포함). 통과하면 main 반영.
