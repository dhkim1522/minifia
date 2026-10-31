# EmoteSheet

동작 목록: 내 캐릭터가 할 동작을 4칸 격자 버튼으로 고른다.

- 동작 9종: 목 긋기 · 나 아니야 · 박수 · 엉엉 · 악수 · 손가락질 · 최고 · 깜짝 · 춤(결정 0048 캐릭터 원본).
- 버튼 높이 `control-input` 48px, `label-strong` 14px, `night-700` 면, `radius-badge`.
- 지목·변론·찬반 단계에서는 움직이지 못하지만 동작은 할 수 있다. 밤에는 쓰지 않는다(`disabled`).
- 쓰는 쪽이 줄 것: `emotes`(id·label), `onPick`. 하단 시트로 띄울 때는 `z-modal`.
