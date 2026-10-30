# Journal

[역할 카드] 시트의 활동 기록 탭에 쌓이는 역할별 일지다(결정 0026, 원천 `src/components/RoleCardSheet.tsx` · `src/components/Journal.tsx` · `src/game/journalText.ts`).

- 헤더의 [역할 카드](`MyRoleButton` 의 후속)로 어느 단계에서든 연다. 탭 두 개: 내 역할 · 활동 기록. 새 기록이 있으면 버튼에 앰버 점.
- 경찰 **수사일지**: 남색 종이 `journal-police-bg/head/edge`, 머리 글자 `journal-police-ink`. 밤마다 조사한 사람과 결과.
- 마피아 **암살일지**: 검붉은 장부 `journal-mafia-*`. 지목한 사람과 결과(진홍 예약 3번).
- 의사 **치료일지**: 어두운 녹색 차트 `journal-doctor-*`, `보호` 글자 `journal-doctor-ink`.
- 시민은 일지 대신 안내 한 줄. 일지 내용은 서버가 본인에게만 보낸다(`me.records`).
