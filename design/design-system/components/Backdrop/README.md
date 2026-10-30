# Backdrop

모든 화면 뒤에 까는 배경 장면이다. 커튼 걷힌 창 너머로 마을이 보이는 방 안(실내 V2, 결정 0029~0033)을 그린 WebP 그림을 쓴다. 앱용은 `public/backgrounds/bg_<구도>_<장면>.webp`, 단계 → 장면 표는 앱 `src/game/scenes.ts`(`PHASE_SCENE`).

- 그림은 세로 폰 비율. `background-size: cover`, 기준은 가운데 위쪽.
- 게임 구도 그림은 명도 0.8 로 구워 두었다(헤더 글씨 4.5:1). 헤더 글씨 뒤에는 남색 45%·흐림 8px 번짐을 따로 둔다.
- **구도** `layout`: `game`(기본) · `entry`(입장 화면, `lobby` 장면에만 있다).
- 장면 위에 올리는 `Table` 은 `bare` 로 자기 바탕을 지운다.
- 글자는 장면 위에 바로 올리지 않는다. 단계 시작 문구만 예외(`shadow-text`).
- 장식이라 화면 읽기 도구에 숨긴다(`aria-hidden`). 장면이 바뀌면 0.8초 교차 페이드, 해·달은 그림에 그려진 그대로 둔다.

| `variant` | 쓰는 단계 | 분위기 층 |
|---|---|---|
| `lobby` | 입장, 대기실, 역할 배정, 역할 확인 | — |
| `day` | 낮 시작, 직업 주장, 토론 | — |
| `dusk` | 처형 여부, 후보 선택, 공개, 최후 변론, 처형 | 변론 · 처형 원뿔 빛(`cone-light`) |
| `night` | 밤, 게임 종료 | 밤 비네팅 |
| `morning` | 아침 결과 | 아침 밝아짐 |

`verdictDusk`(조명이 구워진 해질녘)는 등록만 남아 있고 어떤 단계도 쓰지 않는다.

| prop | 값 |
|---|---|
| `variant` | `lobby` · `day` · `dusk` · `night` · `morning` |
| `layout` | `game` · `entry` |
| `position` | 그림 기준 위치. 기본 `center top` |
| `children` | 장면 위에 올릴 화면 내용 |
