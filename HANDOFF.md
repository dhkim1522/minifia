# 작업 인계

> 두 PC·다음 세션이 이어 가는 데 필요한 최소 정보만 적는다. **해결된 항목은 지운다**(기록은 결정 기록·SUMMARY·git 에 있다). 6KB 이하(`test/unit/handoff.test.ts`). 환경 설정은 `docs/setup.md`.

## 지금 상태

- **v3.0 개발 완료·배포됨(브랜치 `v3`, 13~15페이즈, 결정 0072~0074)**: 13 기본판 낮 흐름, 14 사회자 자막 띠·빛남·도구 이름표(0073), 15 낮 심부름·목격 기록·밤 선택 통일·아침 흔적(0074). 배포 version `2026-11-07T09:14:56Z+f882224e`(minifia-v3). RULESET 새 스위치 없음. 요구사항 22개 완료·로드맵 13~15(`.planning/`), 범위·순서 결정 0071.
- **v2.0 완료 처리(2026-11-07)**: 태그 `v2.0`, 문서는 `.planning/milestones/v2.0-*`(페이즈 문서 `v2.0-phases/`). 열린 감사 항목 26개는 STATE.md 미룬 항목. main 은 v1.0 그대로, v3.0 실테스트 통과 뒤 반영.
- **캐릭터(결정 0047·0048)**: 원본 https://claude.ai/artifact/NP1XfUrYTTqQ5nAB1HKYT5 (사본 `design/v2.0/figure/`, 모듈 `design/v2.0/blockout/character.js`). `3d/mf3d.js` 는 옛 방식이라 안 쓴다.
- **v3.0 시안**: 15페이즈 심부름·목격·흔적 캔버스 https://claude.ai/artifact/X9XPJtc6mm3UdihPA6fNYD (원본 `design/v3.0/errand/ErrandTrace.html`).
- **맵(결정 0050)**: 재즈 바 + 시계탑 광장(`PLAYABLE_MAPS`). 블록아웃 https://claude.ai/artifact/1hzgEyAufgnDPVMvPvxdhP (사본 `design/v2.0/blockout/`).
- **브랜치**: 지금은 **`v3`**. `v2` 는 v2.0 그대로, `v1` 은 v1.0 배포본 수정 전용, `main` 은 배포된 v1.0. 다른 PC 는 `git fetch` 후 `git switch v3`.
- 배포: v3 https://minifia-v3.dhplay.workers.dev (Worker `minifia-v3`, `scripts/deploy-target.mjs`), v2 https://minifia-v2.dhplay.workers.dev (비교용, 변화 없음), v1.0 `https://minifia.dhplay.workers.dev`(변화 없음). `npm run deploy` 가 계정·배포 대상 가드를 거친다(가드는 우회하지 않는다).
- 도구 메모: 버전은 `/api/health`. `npm run e2e` 는 인자가 없으면 배포본을 검사한다(로컬은 `npm run dev` 후 `-- --url http://localhost:5173 --only 흐름1,흐름2`). 전체 로컬 회귀는 약 21분(제한 27분). `backdrop-filter` 는 비접두 한 번만.
- 2026-11-02 원격 이력 재작성: 다른 PC 의 옛 clone 은 새로 clone.
- 커밋 제외: `design/backgrounds/indoor-draft/`, `Claude outputs/`, `.planning/milestone.lock`, `.planning/state.json`.

## 확인 대기 (사용자 답·확인이 필요한 것)

- **v3.0 결정은 끝났다(2026-11-07)**: 팀 모의 플레이 피드백과 세부 결정이 `docs/playtest-v2.0-feedback.md` 에 있다. 다시 묻지 않는다. 새로 생기는 결정은 추천안으로 진행하고 기록한다. 시안은 캔버스 2~3개 + 추천안 바로 구현.
- **실테스트는 v3.0 전체를 한 번에**(팀·실기기, v2.0 실기기 칸도 그때). 단계별 팀 테스트는 없다.
- 결정 0071~0074 와 위임 기본값 표 셋(13·14·15페이즈 각 `*-UI-SPEC.md` "기본값 기록", 15는 0074-7)은 사용자가 돌아와 검토하고 한 줄씩 바꿀 수 있다.
- 레포 재생성은 하지 않는다(사용자 결정). 위생 grep 은 계속.
- **Cloudflare 무료 한도(2026-11-07 발생)**: Durable Objects 하루 쓰기 한도를 넘으면 모든 배포본(v1·v2·v3)에서 방 만들기가 500(`error code: 1101`)이 된다. UTC 0시(한국 09시)에 초기화된다. 배포본 E2E·smoke 를 많이 돌린 날 생긴다 — 큰 회귀는 로컬로 돌린다. 결정 0075 배포(`8755d64b`)의 배포본 확인은 초기화 뒤에 한다(로컬 확인은 끝).
- **알려진 한계**: `perfbudget` B2 점광원 4>3·M1 geometries 35>25 는 13페이즈 전부터 지속(nightload 평균 59.9fps·끊김 3 은 합격). 배포본 smoke 는 망 지연 간헐 실패(15-10 에서 `.msg` 읽기 한 번, 원인 미확정·재실행 통과). 8자 이름 봇 8명판은 이름표가 겹칠 수 있다. 0073: 360×560 은 띠 때문에 위쪽이 비좁고 [유언]·[보내기] 간격 16→8(실기기 확인), 마지막 5초 숫자 crimson-300. **0074**: 마피아 얼굴 칸의 선택 수 배지가 밤 겉보기 같음의 유일한 예외, 장소 아이콘 16개는 임시 선 그림, 기록 카드가 열려 있으면 이름표가 가려질 수 있음, 마피아 밤 채팅 화면 없음(서버 채널은 유지, 되돌리는 곳은 `GamePanel` 밤 분기).

## 다음 할 일

1. **v3.0 전체 실테스트 한 번**(사람이 2~3명이면 방장이 대기실 [봇] 버튼으로 빈자리를 채운다, 결정 0075) — (팀·실기기, v2.0 실기기 칸 `.planning/milestones/v2.0-phases/12-sound-polish/12-TEAM-TEST.md` 포함). 볼 것: 심부름 40초 체감(`ERRAND_MS`)·근처 반경 3.0·처리 반경 1.2·기록 줄(상한 6)·흔적 구간 3초 — 모두 `shared/game/phases.ts` 한 곳 값, 투표 15초, 8명 동시 가리키기 성능, 투표 이름표 손가락 누르기. 결과로 값·위임 기본값을 고치고, 통과하면 main 에 반영.
2. 정통 판(장치 켜기)은 `RULESET` 값만 바꾸면 된다. 마피아의 심부름 방해·시상에 목격 반영은 Future(0074).
3. three `0.186.1` 고정, 성능 확인 폰은 iPhone 16 Pro + 크롬 CPU 4배 스로틀(결정 0055). 이력서용 포트폴리오는 v3.0 뒤(`docs/portfolio-request.md`).
