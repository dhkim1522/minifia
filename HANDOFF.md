# 작업 인계

> 두 PC·다음 세션이 이어 가는 데 필요한 최소 정보만 적는다. **해결된 항목은 지운다**(기록은 결정 기록·SUMMARY·git 에 있다). 6KB 이하(`test/unit/handoff.test.ts`). 환경 설정은 `docs/setup.md`.

## 지금 상태

- **v3.0 구현 중(브랜치 `v3`)**: 13~21(18.1 포함) 완료·배포(결정 0072~0088). 배포 version `2026-11-15T13:03:01Z+e3cb26fa`(minifia-v3, smoke full 통과). 21 은 확장판 하루 = 저녁 등불 → 밤 집 찾기 → 아침 현장 → 의심 보드 토론(0088). 20 은 마을 맵(0087, 확장판은 늘 마을). 19 는 방장이 고르는 판 종류(기본 마피아·확장판)와 방장 전용 왼쪽 줄(결정 0086). 유령은 3D(0084), 내 캐릭터 움직임 밀림 수정(0085). 17 튜토리얼(0078·0080, 확장판만).
- **v2.0 완료 처리(2026-11-07)**: 태그 `v2.0`, 문서는 `.planning/milestones/v2.0-*`(페이즈 문서 `v2.0-phases/`). 열린 감사 항목 26개는 STATE.md 미룬 항목. main 은 v1.0 그대로, v3.0 실테스트 통과 뒤 반영.
- **캐릭터(결정 0047·0048)**: 원본 https://claude.ai/artifact/NP1XfUrYTTqQ5nAB1HKYT5 (사본 `design/v2.0/figure/`, 모듈 `design/v2.0/blockout/character.js`). `3d/mf3d.js` 는 옛 방식이라 안 쓴다.
- **v3.0 시안**: 사본은 `design/v3.0/`(17 `first-case/`, 16 `tutorial/`, 19 `host-rail/`, 20 `town-map/`, 유령 `ghost3d/`). 18.1 헤더 시안 https://claude.ai/artifact/8598QRUVpJ1DaEnrqrtb48 .
- **맵(결정 0050·0087)**: 재즈 바 + 시계탑 광장(`PLAYABLE_MAPS`, 기본 마피아에서 고름) + 마을(`town`, 확장판 전용). 블록아웃 https://claude.ai/artifact/1hzgEyAufgnDPVMvPvxdhP (사본 `design/v2.0/blockout/`).
- **브랜치**: 지금은 **`v3`**. `v2` 는 v2.0 그대로, `v1` 은 v1.0 배포본 수정 전용, `main` 은 배포된 v1.0. 다른 PC 는 `git fetch` 후 `git switch v3`.
- 배포: v3 https://minifia-v3.dhplay.workers.dev (Worker `minifia-v3`, `scripts/deploy-target.mjs`), v2 https://minifia-v2.dhplay.workers.dev (비교용, 변화 없음), v1.0 `https://minifia.dhplay.workers.dev`(변화 없음). `npm run deploy` 가 계정·배포 대상 가드를 거친다(가드는 우회하지 않는다).
- 도구 메모: 버전은 `/api/health`. `npm run e2e` 는 인자가 없으면 배포본을 검사한다(로컬은 `npm run dev` 후 `-- --url http://localhost:5173 --only 흐름1,흐름2`). 전체 로컬 회귀는 묶음으로 나눠 약 30분(묶음 하나 10분 이하, 폰 6종 흐름을 한 묶음에 많이 몰면 부하 간헐이 나온다 — 20-10-SUMMARY). `backdrop-filter` 는 비접두 한 번만.
- 커밋 제외: `design/backgrounds/indoor-draft/`, `Claude outputs/`, `.planning/milestone.lock`, `.planning/state.json`.

## 확인 대기 (사용자 답·확인이 필요한 것)

- **방향 전환(결정 0089, 2026-11-16 확정)**: 첫날만 장르+키워드 문제(마피아는 `???`), 둘째 날부터 원래 마피아 + 의심 포스트잇. 판 종류 하나로, 확장판 기능 전부 제거(분필 윤곽은 유지), 튜토리얼 새로, 유령 축소·방향 회전. 등불 재검토는 이것으로 끝났다.
- **v3.0 결정은 끝났다(2026-11-07)**: 팀 모의 플레이 피드백과 세부 결정이 `docs/playtest-v2.0-feedback.md` 에 있다. 다시 묻지 않는다. 새로 생기는 결정은 추천안으로 진행하고 기록한다. 시안은 캔버스 2~3개 + 추천안 바로 구현.
- **실테스트는 v3.0 전체를 한 번에**(팀·실기기, v2.0 실기기 칸도 그때). 단계별 팀 테스트는 없다.
- 결정 0071~0088 과 각 페이즈 UI-SPEC "기본값 기록"·위임 기본값 표는 사용자가 돌아와 검토하고 한 줄씩 바꿀 수 있다.
- 레포 재생성은 하지 않는다(사용자 결정). 위생 grep 은 계속.
- **18.1 고침 눈 확인(실기기, v3.0 실테스트 때)**: 헤더 시간대 글자·3D 유령 크기와 밝기(결정 0084)·내 캐릭터 움직임(0085)·늘어나는 기록 창과 키보드·결과판·처형 큰 글(0083).
- **19 눈 확인(실기기, v3.0 실테스트 때)**: 방장 왼쪽 줄 색·왕관 표식·판 종류 시트·참가자 칩·기본 마피아 한 판(0086).
- **21 눈 확인(실기기, v3.0 실테스트 때)**: 등불 번짐·집 창 밝기·문패·개관 카메라·현장 지점 겹침(표지 47px < 52)·보드 8자 닉네임 잘림·모션 줄이기(결정 0088 "알려진 한계"). **성능 미판정**: Windows PC 끊김 100회 안팎(재즈 바도 88) — Mac 에서 `perf-run --mode nightload --map town` 재측정.
- **18 조명 눈 확인**: 광장·바의 아침·낮·저녁이 장면만으로 느껴지는지 배포본에서 본다(측정 PNG `.planning/phases/18-quick-fixes/perf/light-*.png`). 약하면 다음 손잡이는 바 창 빛.
- **Cloudflare 무료 한도**: DO 하루 쓰기 10만 행을 넘으면 모든 배포본에서 방 만들기가 500(`1101`), 한국 09시 초기화. 대책은 결정 0076. 큰 회귀는 로컬로 돌린다.
- **알려진 한계**: `perfbudget` B2·M1 은 13페이즈 전부터 지속, 8자 이름 봇 8명판은 이름표가 겹칠 수 있다. 360×560·390×664 의 좁은 칸 사정(360×560 방장 줄 접힘 포함), E2E 간헐 실패(원인 미확정), 마피아 밤 채팅 화면 없음 등은 결정 0073·0074·0079·0080·0086 과 각 페이즈 SUMMARY 에 있다.

## 다음 할 일

1. **0089 새 페이즈** — ROADMAP 에 추가 → discuss(0089 "정하지 않은 것") → UI-SPEC·시안(키워드 카드·포스트잇 에셋) → 계획·실행 → 배포. 키워드 목록은 Claude 초안 + 사용자 검토.
2. **v3.0 실테스트**는 질문 카드 판 배포 뒤 한 번에(17 UAT Test 3 폰 2대 포함)(팀·실기기, 사람이 적으면 대기실 [봇]). v2.0 실기기 칸 `.planning/milestones/v2.0-phases/12-sound-polish/12-TEAM-TEST.md` 포함. 통과하면 main 반영.
