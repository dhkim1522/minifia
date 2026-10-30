# Halo

캐릭터 그림 윤곽을 따라 번지는 강조 빛이다. 발밑 원 · 이름표 반전 · 머리 위 배지를 모두 대신한다(결정 0030 · 0037). 번들의 `Figure` `halo` prop 과 같고, 앱 원천은 `src/styles/daytable.css`(`--mf-halo-white` · `--mf-halo-amber` · `--mf-halo-crimson`).

- 값: 안쪽 `drop-shadow(0 0 2px 색 95%)` + 바깥 `drop-shadow(0 0 9px 색 75%)`(진홍은 70%). 값은 애니메이션하지 않고 `transition: filter 180ms` 뿐.
- 흰 `gray-50`: 직업 주장 차례, 내가 밤 · 후보 선택에서 고른 대상(밤에는 머리 위 표적 배지를 더한다).
- 앰버 `amber-400`: 공개 중 방금 표가 닿은 대상, 최다 득표 후보, 변론 후보.
- 진홍 `crimson-400`: 마피아 본인 화면의 동료(마름모와 함께), 관전자 화면의 모든 마피아.
- 흰이 진홍보다 앞선다. 한 화면 최대 3개(`HALO_MAX_SIMULTANEOUS`). 끊긴 사람은 흑백을 먼저 적용하고 후광을 붙인다. 내 자리는 후광 없이 이름표 테두리.
