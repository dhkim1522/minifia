# 미니피아 배경 에셋 규격

## 구성
- 장면 4종: lobby(입장·대기·배정), night(밤), day(아침·낮), verdict(투표·변론·처형)
- 화면 구도 2종: game(지평선 높이 0.34, 테이블이 광장 위에 놓임), entry(지평선 0.58, 큰 달과 양옆 집, 입장 화면)
- 그림체 2종: A_cute(둥글고 귀여운 면 색), B_system(디자인 시스템 설명에 가까운 차분한 층 표현)
- 파일 이름: bg_<구도>_<장면>.png (예: bg_game_night.png), 원본 SVG 같이 제공

## 크기와 사용
- 1080×2340 PNG, 불투명. 가로:세로 약 9:19.5
- 앱에서는 background-size: cover, 위치는 가운데 위쪽 기준
- 글자는 장면 위에 바로 올리지 않고 단계 바·시트·버튼처럼 바탕 있는 부품에 올려요
- 장면은 장식이라 aria-hidden, 움직임 없음. 전환은 0.8초 교차 페이드

## 색 (디자인 시스템 토큰만 사용)
- 하늘: night-950/night-900 → sky-moonlit(lobby), sky-night(night·verdict), dawn → morning(day)
- 달 moon #dde3f0, 달무리 moon-halo, 별 star, 안개 fog, 먼 마을 town-far, 가까운 집 town-near, 바닥 ground
- 낮은 town-far-day, town-near-day, ground-day
- 보라·분홍·주황, 따뜻한 창문 불빛, 진홍은 쓰지 않아요. 창문은 불 꺼진 유리에 달빛 반사만 있어요

## 안전 영역
- game: 위쪽 20%(단계 바)는 하늘만, 가운데 아래 55%는 광장 바닥으로 비워서 테이블을 올려요
- entry: 아래쪽 40%는 광장 바닥으로 비워서 제목과 입력칸을 올려요

## 장면별 차이
- lobby: 달 쪽 하늘이 밝은 기본 밤
- night: 구름에 가린 작은 달, 박쥐, 짙은 안개
- day: 달 없음, 회청빛 하늘, 지평선 쪽 흐린 빛
- verdict: 흐린 달, 위에서 떨어지는 조명 기둥과 바닥 조명 타원
