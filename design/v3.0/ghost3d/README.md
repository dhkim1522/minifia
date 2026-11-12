# 3D 유령 에셋 (결정 0084)

원본 아티팩트: https://claude.ai/artifact/M1ahg3iLWZz7Hm8BjaCwdC (Design 캔버스)

- `ghost3d.js` — three r128 전역 `THREE` 로 만드는 유령(`MFGhost.build()`). 앱 사본은 `src/world/ghost3d.ts` 이고 숫자·색이 같다.
- 높이 2.45(후광 꼭대기까지)·폭 약 1.86·발밑 y=0·앞 +z. 전부 불투명, 직업 단서 없음. 모양은 기존 2D 유령(`public/characters/ghost/`)을 그대로 입체화했다: 연한 라벤더 흰색 몸, 네 갈래 아랫단, X 눈, 동그란 입, 분홍 볼, 몸 옆 둥근 팔, 금빛 후광.
- `Main.dc.html` 은 캔버스 보드 소스다(three·mf3d 는 아티팩트 에셋이라 저장소 사본에는 없다. `design/v2.0/3d/mf3d.js` 와 cdnjs three r128).
