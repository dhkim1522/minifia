# v2.0 디자인 승인본 (2026-10-31, 결정 0046)

사람용 원본은 클로드 아티팩트이고, 이 폴더는 GSD 에이전트가 읽는 사본이다. 아티팩트를 고치면 여기도 다시 복사한다.

| 무엇 | 원본 아티팩트 | 사본 |
|---|---|---|
| 배경(맵) 2종 × 시간대 5개 | https://claude.ai/artifact/LztT25LDkxJcfnRjiaPTfE | `backgrounds/minifia-bg-concepts.html` (three.js r128, 브라우저로 열면 그대로 돈다) |
| 캐릭터(의상 8·동작 8·4방향·걷기·리그) — **결정 0047 로 대체됨, 참고용** | https://claude.ai/artifact/QPVNH7DN4jQwpMGtHivssc | `characters/*.dc.html`, `characters/canvas.json` (Design 캔버스 원본 소스) |
| 3D 에셋(결정 0047): 배경 2종 × 게임 장면 8, 1번 시안 인물 + 의상 8·동작 8·표정 10, 게임 흐름 | https://claude.ai/artifact/MExvQNQTCwZdJ79XYSLPQk | `3d/mf3d.js`(맵·장면·캐릭터·이동 격자 공용 코드, three r128 전역 `THREE`), `3d/*.dc.html`(캔버스 보드), `3d/canvas.json`. three.min.js 는 cdnjs r128 판과 같아 넣지 않았다. 모자·머리카락·귀·눈썹은 0048 이전 방식 |
| **캐릭터 에셋 원본(결정 0048)**: 1번 시안 인물 5명 + 의상 9종(기본 코트·누아르 정장·마피아·경찰·의사·탐정·기자·어르신·후드), 표정 7, 동작 9. 모자는 머리를 덮고 안의 머리카락은 잘라 낸다 | https://claude.ai/artifact/NP1XfUrYTTqQ5nAB1HKYT5 | `figure/minifia-street.html` (three.js r128, 브라우저로 열면 그대로 돈다) |
| **v2.0 디자인 시스템(승인 2026-10-31)**: 색·글자·3D 공간·단계 조명·지목 연출 규칙 + 게임 겹침 부품 15종(`window.MinifiaV2`), 그림 에셋(맵·의상·직업·얼굴) | https://claude.ai/artifact/L4eeQTUD9rCa9Vmzv6fKpU | `design-system/` — `README.md`(규칙), `tokens.json`·`tokens.css`, `components/bundle.js`·`bundle.css`·`index.d.ts`, 부품별 `README.md`·`preview.html`, `assets/`(Maps·Outfits·Roles·Faces PNG) |
| **v2.0 화면설계서**: 묶음 A(로비·역할·토론·지목·변론·찬반·처형), 묶음 B(밤 마피아·시민·경찰·의사, 암살, 아침, 유언, 유령) | https://claude.ai/artifact/H3gEwciexb83CxEXK76YXs | `screens/` — 보드 `*.dc.html`(화면마다 `var SCREEN` 만 다르다. A 틀은 `Main.dc.html`, B 틀은 `NightMafia.dc.html`), `canvas.json`, 장면 엔진 `blockout.js`(밤 시점·발밑 고리·분필 윤곽·유령 포함)·`bar.js`·`character.js`. 그림은 아티팩트 `/_blob/` 주소라 저장소에서는 `design-system/assets/` 를 본다 |
| **묶음 B 시안(결정 0063)**: 순차 지목·직업 의상 유령(옅은 안개)·유언 중앙 공개(편지) | https://claude.ai/artifact/VtRcJw7vUTUpRBe1J8vTQk | `mockups-b/` — `PickSeq`·`GhostCostume`·`WillCenter` 보드(엔진 파일은 `screens/` 와 같다) |
| **마피아 밤 선택 효과 시안(결정 0065)**: 후보 점선 → 누르는 중 실선·빛 → 고른 뒤 3px 진홍 맥박 테두리 + 몸 윤곽 + 고리 조임(추천 "몸 테두리", 조준선·붉은 조명 2안은 채택하지 않음) | https://claude.ai/artifact/VtRcJw7vUTUpRBe1J8vTQk (보드 C1) | `mockups-b/NightAim.dc.html` (엔진 파일은 `screens/` 와 같다) |
| 지목·변론 배경 5안 블록아웃(결정 0050: 재즈 바·광장 채택) + **득표 표시 숫자 배지(결정 0049 확정)** | https://claude.ai/artifact/1hzgEyAufgnDPVMvPvxdhP | `blockout/` — `blockout.js`(카메라·단계 조명·8명 배치·긴장 연출), 안별 맵 `bar.js` 등, `character.js`(0048 + `setFace` 내보내기), 보드 `*.dc.html`. 득표 표시는 `VoteHand.dc.html`(STYLE `number`). three.min.js 는 cdnjs r128 판과 같아 넣지 않았다 |

## 배경
- A 달빛 응접실: 앞 두 벽을 잘라 낸 넓은 실내. 가운데 크림 대리석 원탁과 의자 8개가 모이는 자리
- B 달빛 시계탑 광장: v1.0 색(남색·달빛·크림 대리석)의 1930년대 마피아 도심. 가운데 대리석 원판이 모이는 자리
- 시간대: 해뜰녘·아침·낮·해질녘·저녁. 가장 밝은 낮도 흐린 보랏빛 회색, 밤은 조명과 안개로 분위기를 내고 캐릭터·모이는 자리는 항상 읽힌다
- 맵은 화면보다 크고 빈 배경이 보이지 않는다. 카메라가 따라가거나 끌어서 둘러본다

## 캐릭터 (결정 0047 로 3D 조립 인물로 바뀜 — 아래는 0046 당시 2D 시안 요약)
- 로우폴리 장난감 느낌의 면 색면, 얼굴은 세트 C 이목구비. 공통 몸체 하나에 머리·옷·소품만 교체
- 의상 8종: 시민·경찰·의사·마피아·탐정·기자·어르신·후드 (꾸미기일 뿐 실제 역할과 무관, 결정 0044-8)
- 동작 8종: 목 긋기·손사래·박수·울기·악수 내밀기·지목·엄지척·어깨 으쓱
- 그림은 앞·옆·뒤 3벌, 왼쪽은 옆 반전. 옆 걷기 4프레임, 앞뒤 걷기 2프레임. 동작은 앞 그림으로만
- 관절: 목·어깨·팔꿈치·손목·골반, 손 6종(기본·주먹·칼손·펼침·가리킴·엄지)
