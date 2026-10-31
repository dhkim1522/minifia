# minifia

> 친구들이 각자 폰으로 방에 들어와 5~10분 안에 한 판 끝내는 마피아 게임. `미니피아(minifia)` 는 개발 코드명이며, 정식 이름은 출시 전 상표 확인 후 정한다.

## 세션 시작 시

1. `HANDOFF.md` 를 읽고 현재 상태와 다음 할 일을 파악한다.
2. 작업 범위에 해당하는 `docs/` 문서를 읽는다.

## 문서 지도

원천 문서는 `docs/` 다. 결정이 바뀌면 해당 문서를 고치고, 이 파일에는 문서 위치만 둔다.

- `docs/product.md` — 기획서: 목표, 콘셉트, MVP 규칙, 진행 흐름, 미결정 항목
- `docs/architecture.md` — 기술 스택, 구조, 실시간 통신, 출시 경로
- `docs/decisions/` — 결정 기록 (번호순)
- `docs/screen-map.md` — 폰 폭별 화면 영역과 자동 검사(E2E·에셋) 지도
- `.planning/` — GSD 요구사항·로드맵·진행 상태 (결정 0004). 범위와 진행은 여기를 기준으로 한다
- `design/references/` — 디자인 참고 이미지 보관 위치(선택). 디자인 단계에서 경로를 주면 따른다. 앱 에셋에 넣지 않는다
- v2.0 디자인 아티팩트 — 디자인 시스템 https://claude.ai/artifact/L4eeQTUD9rCa9Vmzv6fKpU (사본 `design/v2.0/design-system/`) · 지목·변론 배경 블록아웃 https://claude.ai/artifact/1hzgEyAufgnDPVMvPvxdhP (사본 `design/v2.0/blockout/`) · 캐릭터 원본 https://claude.ai/artifact/NP1XfUrYTTqQ5nAB1HKYT5 . 지도와 결정은 `design/v2.0/README.md`
- v1.0 디자인 아티팩트(사람용, 결정 0010·0011) — 디자인 시스템 https://claude.ai/artifact/Tp175mmuxLAHycMUtwZJ9Q (이 세션에서만 고친다) · 화면설계서 https://claude.ai/artifact/QtbQYhk7ezy4fV7H98bZJz · 화면 흐름 https://claude.ai/artifact/NzZBqoJD8ut16J2VUwpn64 · 캐릭터 에셋 https://claude.ai/artifact/4dYpe74vxJHSnA4WhFSLTM. 사람용 산출물(시안·화면설계서 등)은 이 세션에서 Design 캔버스로 직접 만든다. GSD 에이전트는 아티팩트를 열 수 없으니 승인본은 `design/` 사본을 쓴다
- `design/` — 승인된 디자인의 저장소 사본. 캐릭터 원본 `design/characters/`(규격 `ASSET_SPEC.md`), 배경 원본 `design/backgrounds/`(A_cute), 토큰 `tokens.json`(앱 `src/styles/tokens.css` 는 `npm run tokens` 로 생성)·화면설계서 v0.2 승인본 PNG `design/screens/`, 디자인 시스템 사본 `design/design-system/`(브랜드 문서·부품 참고 구현). 앱용 그림은 `public/characters/`, `public/backgrounds/`. AI 는 이 사본을 기준으로 화면을 만든다

## 작업 규칙

- 게임 규칙과 판정은 서버(방 Durable Object)가 정한다. 클라이언트는 받은 상태를 보여 주고 행동만 보낸다 (결정 0002).
- 다른 사람의 역할은 서버가 살아 있는 사람에게 보내지 않는다(탈락자 관전만 예외, 결정 0021). 화면에서 숨기는 것으로 대신하지 않는다.
- 기획·계획은 참여 플레이어의 몰입을 기준으로 한다. 각 페이즈는 자기 구간의 이펙트·액션을 기본형으로 함께 만든다 (결정 0006).
- 새 결정은 `docs/decisions/` 에 다음 번호로 파일을 추가한다.
- 작업을 마칠 때마다 `HANDOFF.md` 를 갱신하고 push한다. Mac과 집 Windows PC를 오가며 작업한다.
- 브랜치: v2.0 작업은 `v2`, v1.0 배포본 수정은 `v1`, `main` 은 배포된 버전이다. 버전·산출물은 `v1.0`·`v2.0`, 브랜치는 `v1`·`v2` 로 표기한다 (결정 0043).

<!-- gsd-addons:start -->
## GSD 작업 원칙 (gsd-addons)

> gsd-addons `/gsd-addons:setup` 이 관리하는 구역이다. 고치려면 gsd-addons 저장소를 고친 뒤 다시 실행한다.

- **언어**: GSD 산출물(`.planning/`)과 응답은 한국어로 쓴다. 코드, 명령, 파일 이름, 요구사항 ID 는 원문을 쓴다.
- **작은 MVP**: v1 요구사항은 핵심 사용 흐름을 처음부터 끝까지 잇는 데 필요한 것만 넣는다. 나머지는 v2 나 백로그에 둔다. MVP 이후 기능 추가·변경은 사용자 피드백이나 결정 기록을 근거로 한다.
- **이른 배포**: 1페이즈(걷는 뼈대) 성공 기준에 "실제 환경에 배포되어 다른 기기에서 접속하거나 설치할 수 있다" 를 넣는다. 이후 페이즈 검증은 배포본으로 한다. 정식 출시(정식 이름·상표, 스토어 심사, 공개)는 마지막 별도 마일스톤으로 둔다.
- **디자인 참고 자료**: 디자인이 걸린 단계(spec·discuss·ui-phase·sketch)에서 사용자가 준 참고 이미지·에셋 경로는 해당 페이즈 문서의 "참고 자료" 항목에 그대로 적는다. 대화에 붙여넣은 이미지는 하위 에이전트가 볼 수 없으므로 파일로 저장하고 경로로 받는다. 참고 자료가 없으면 자체 판단으로 진행한다.
- **산출물 두 종류**: AI 가 읽는 작업 지침은 저장소(`.planning/`, `docs/`, `design/`)에 둔다. 사람이 보는 산출물(디자인 시스템, 화면 설계서, 포트폴리오)은 클로드 아티팩트로 만든다. GSD 에이전트는 아티팩트를 읽지 못하므로 아티팩트에서 승인한 내용은 저장소에 사본으로 둔다. 구간별 산출물 지도는 gsd-addons `docs/lifecycle.md`.
- **디자인 먼저**: 기획·로드맵 다음, 화면 구현 전에 디자인 시스템과 MVP 전체 화면 설계를 아티팩트로 만들고 승인받는다. 승인본의 사본(`design/` 의 토큰과 화면 이미지)이 화면 페이즈의 기준이다.
- **화면 페이즈는 UI-SPEC 먼저**: 화면이 있는 페이즈는 `/gsd-plan-phase` 전에 `/gsd-ui-phase` 를 실행한다. GSD 의 UI 자동 감지는 한국어 문구를 놓칠 수 있으므로 감지 결과에 기대지 않는다.
<!-- gsd-addons:end -->
