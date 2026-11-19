# 0107 재즈 바 중앙 좌석과 달빛 누아르 에셋

[승인된 구도](../../design/v3.0/compact-bar-review/comparison.webp)와 [3D 개선 시안](../../design/v3.0/redesign/imagegen-3d-reference/README.md)을 실제 게임에 적용한다. [390×844 실제 8인 토론 화면](../../design/v3.0/compact-bar-review/runtime-390.png).

- 재즈 바는 9.4×9.4 공간이다. 중앙 스탠드 둘레에 여덟 좌석을 두고, 4인과 8인 모두 같은 정사영 카메라로 대화를 본다. 좌석을 둘러싼 통로는 대기실에서 걸을 수 있다. 서버가 집결 좌표와 이동을 판정한다. 재즈 바 토론의 고정 좌석에선 의심딱지를 상대 좌석에 붙일 수 있다.
- 재즈 바의 목재 바닥, 황동 장식, 피아노와 창을 다듬고 중앙 스탠드의 따뜻한 빛과 차가운 창빛을 사용한다. [목재 텍스처](../../public/maps/noir-oak.webp)는 ImageGen에 맵·재질 시안의 목재 견본을 참조로 주고, 균일한 조명의 수평 결 타일을 생성해 512×512 WebP로 변환했다. 월드의 정점 색상과 조명이 색을 입힌다.
- 동물 12종은 기존 관절을 유지하며 펠트 표면과 코트, 라펠·단추를 다듬는다. 동물 초상, 전신, 의상과 유령 이미지는 실시간에 쓰는 모델에서 다시 렌더링한다. 재즈 바의 카드·배경과 홈·초대 그림도 실제 모델로 제작한다.

로컬 개발 서버를 켠 뒤 `node scripts/render-noir-assets.mjs http://127.0.0.1:5173 --3d-art-refresh`, `node scripts/render-entry-scene.mjs http://127.0.0.1:5173`, `node scripts/make-og.mjs` 순서로 에셋을 다시 만들 수 있다.

## 로컬 검수

- Chrome 320×844·390×844·1280×800에서 4인과 8인의 토론 카메라 투영을 대조했다. 320px 긴 이름과 반대편 캐릭터를 직접 눌러 붙이는 딱지를 확인했다. 착석 중에는 잠시 이름표가 겹칠 수 있다. 390px에서 재즈 바와 광장 4인판을 결과까지 진행했고, 8인 재즈 바의 밤 얼굴 선택도 확인했다.
- 390×844 DPR 1, Windows Chrome/RTX 4060 Ti에서 재즈 바 8인과 딱지 8장을 15초씩 측정했다. 프레임 시간 p95는 이전과 새판 모두 7.1ms였고 드로 콜은 76회에서 49회로 줄었다. 이전판은 정적 빌드, 새판은 Vite 개발 환경이다. 실기기 성능은 검수 대기다.

## 목재 텍스처 생성 프롬프트

> Use case stylized-concept. Create one square game texture for the real-time Three.js floor of a cozy Art Deco jazz bar, using only the lower-left dark walnut sample in the attached board as a reference for grain scale and character. Edge-to-edge, perfectly top-down orthographic, tileable on both axes, walnut wood grain ALBEDO only. Entire tile is one uninterrupted length of wood with straight, finely flowing horizontal medium-warm muted honey brown grain, subtle wood pores and soft natural variations. It will be multiplied by dark warm-wood vertex colors and lit by lamps and blue windows in the game, so use moderately light midtones, subdued contrast (no black or white streaks), and totally even illumination. The game geometry supplies floorboard seams. No plank joints, no vignettes, no shadows, no specular glints, no framing, no objects, no letters. Flat color map, clean texture at 512px.
