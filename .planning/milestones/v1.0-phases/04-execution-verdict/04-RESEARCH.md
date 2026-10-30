# Phase 4: 처형과 승패 - Research

**Researched:** 2026-10-26
**Domain:** 서버 권위 턴제 게임 상태기계 확장(Cloudflare Durable Object, 순수 TypeScript 규칙 모듈) — 투표 집계·단계 분기·승패 판정·판 종료 와이어
**Confidence:** HIGH (대상이 전부 이 저장소의 코드라 직접 읽었다. 외부 라이브러리 추가 없음)
**범위:** 서버 + `shared/` 로직 + 이를 건드리는 테스트·스크립트. 화면(UI-SPEC·시안)은 제외한다. 단, 새 `PhaseId` 가 타입 오류로 강제하는 최소 화면 쪽 수정 지점은 "강제 수정 목록"에 적었다.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

## Implementation Decisions (모두 확정, 사용자 승인: 2026-10-26)

### 투표 규칙 (결정 0034)
- **D-01** 단계 순서와 시간: `낮 토론 → 처형 여부 투표(10초) → 후보 선택 투표(15초) → 최후 변론(10초) → 처형(5초) → (승패 판정) → 밤`. 시간은 `shared/game/phases.ts` 한 곳에 둔다. 합계 40초(기존 55초).
- **D-02** 처형 여부 투표: 생존자 전원이 `찬성` / `반대` 중 하나를 고른다(질문: 오늘 처형을 할까요?). 던진 표 중 `찬성`이 과반(절반 초과)일 때만 후보 선택으로 간다. 같거나 적으면 바로 밤으로 간다. **찬성·반대 선택 버튼은 하단 패널에 나오고, 찬성 수와 반대 수가 실시간으로 바로 보이며, 마감 전까지 번복할 수 있다**(마지막 선택이 유효). **누가 찬성/반대를 골랐는지는 아무도 알 수 없다**: 이름표·캐릭터 아래에 찬성/반대 표시를 쓰지 않고, 서버는 개인별 선택을 다른 사람에게 보내지 않으며 집계 수만 보낸다(본인은 자기 선택만 본다). 마감 뒤에도 개인별 공개는 없다.
- **D-03** 후보 선택 투표: 생존자 전원이 후보 한 명을 고른다. **자기 자신은 고를 수 없다**(화면에서 막고 서버도 무효). 던진 표 중 **최다 득표자**가 후보. 동률이면 처형 없이 밤으로 간다.
- **D-04** **기권 버튼은 없다.** 기권은 시간 초과·네트워크 지연으로 마감까지 선택을 못 보낸 경우에만 생기며 **무효표**다(표로 세지 않고, 과반 계산의 분모에도 넣지 않는다). 던진 표가 0이면 처형하지 않는다.
- **D-05** 연결이 끊긴 사람은 서버 타이머대로 진행하고 마감까지 못 보낸 표는 무효(CONN-02). 생존자 수에서 빼지 않는다(어뷰징 방지). 후보가 끊기면 변론은 비어 있고 다른 사람은 이모티콘만 보낼 수 있다.
- **D-06** 후보를 직접 처형하는 단계는 **변론 뒤 바로 처형**이다(찬반 없음). 처형 5초에 후보가 탈락하고 결과가 모든 화면에 발표된다. 따라서 "후보가 살아남는" 경로는 없다(여부·후보 선택에서 이미 걸러짐).
- **D-07** 투표 공개: 후보 선택 투표만 개인별 공개(누가 누구를 골랐는지, D-20)한다. 진행 중에는 내 선택만 보인다. 공개는 **후보 선택 뒤 별도 4초 구간**(D-21)이며 여부 투표에는 공개 구간이 없다(익명, D-02). (※ 옛 문장 "다음 단계 시작 직후 2~3초"는 폐기)
- **D-08** 투표 기록은 **유저 기록 카드에 날짜별로 누적**한다(후보 선택 내역만 개인별로 쌓고, 여부 투표는 날짜별 찬성·반대 집계 수만 남긴다). 공개 정보라 서버가 모두에게 보낸다. 3.1 에서 미룬 항목을 여기서 한다.

### 처형 직후 공개·승패
- **D-09** 처형된 사람의 직업은 **판이 끝날 때까지 비공개**다. 밤 탈락자와 같다. 생존자 화면에 `roles/*` 그림이나 직업 문구를 남에게 쓰지 않는다. 탈락자는 관전자가 되어 모두의 직업을 본다(결정 0021).
- **D-10** 처형 5초 직후와 아침 발표 직후 **즉시 승패를 판정**한다. 조건이 되면 새 밤으로 가지 않고 판을 끝낸다. 밤 결과로 끝나는 경우 아침 발표(5초)를 보여 준 뒤 종료해 암살 연출이 끊기지 않게 한다. 승패 조건은 END-01 그대로.
- **D-11** 처형 문구: 아침(결정 0019 D-18)처럼 서버가 여러 문구 중 무작위로 골라 모든 폰에 같은 문구를 보낸다(같은 판에서 연속 반복 없음, 이름 뒤에 항상 "님이"). 수신자는 전원. **확정 문구 4개**: ① {이름}님이 더는 함께할 수 없게 되었습니다 ② {이름}님이 형장의 이슬이 되었습니다 ③ {이름}님이 잔혹하게 처형되었습니다 ④ {이름}님이 처형대에 올랐습니다. 사용자 지시: 기존 암살(아침) 묶음의 "이슬이 되어 사라졌습니다"는 처형 문구로 옮기므로 **아침 묶음에서 제거**한다(`src/game/eliminationText.ts` 와 관련 테스트 `eliminationText.test.ts`, `morning.test.tsx`, `phaseScreens.test.tsx`, 디자인 사본 `night-v1/SPEC.md` 갱신). "조용히 눈을 감았습니다"는 **아침 묶음에만** 둔다(사용자 확정, 처형 묶음에서 제외).

### 메시지 (COMM-03, 결정 0034)
- **D-12** 여부·후보 선택 단계에서 생존자는 빠른 메시지와 이모티콘을 보낸다(기존 찬반 중 규칙을 두 투표로 옮김). 2초 1회 제한은 그대로.
- **D-13** 최후 변론 중에는 후보만 변론 메시지를 보낸다. **확정 템플릿 6개, 한 번에 하나씩**(10초): ① 저 아니에요 ② 저는 시민이에요 ③ [○○] 의심해 주세요 ④ [○○] 믿어 주세요 ⑤ 제가 [직업]입니다 ⑥ 한 번만 믿어 주세요. 서버는 템플릿 ID 와 고른 값만 받는다(COMM-04). 나머지 생존자는 이모티콘만. 처형 중에는 아무도 보내지 못한다.

### 장면 구성·연출 (사용자 지시 원문 요약)
- **D-14** 투표 두 단계는 **낮 테이블을 유지**한다(캐릭터를 탭해 고르는 방식). 낮 토론이 끝나 여부 투표로 넘어갈 때 **해질녘 배경 `verdictDusk` 로 전환**한다.
- **D-15** 최후 변론·처형은 **후보 캐릭터가 테이블 가운데로 이동**하고 **스포트라이트**를 받는다. 이때 다른 배경과 캐릭터는 **흐려지면서 어두워져 대비를 강조**한다. 어두운 정도는 **어두움은 퍼센트 한 값으로 모든 단계에 똑같이 적용**한다(사용자 확정: 배경이 이미 해질녘 그림이고 퍼센트로 덮으므로 시간대별로 나눌 필요 없음). 변론·처형은 해질녘 배경에서만 쓰이므로 낮·아침에 적용되는 경우는 없다. 시작값은 나머지 45% 어둡게 + 약한 흐림 3px이며, 폰에서 보고 글씨 가독성(E2E H1)이 통과하는 범위에서 수치만 조정한다.
- **D-16** 처형 5초도 후보가 가운데에 있는 채로 이어진다(변론 → 처형 사이에 이동 연출 없음). 처형 시 후보는 유령으로 바뀌고 이름표는 탈락 표시로 바뀐다.

### 투표 선택 표시와 공개 연출 (사용자 확정 2026-10-26)
- **D-19** 투표 중(여부·후보 선택) 내가 고른 대상은 **캐릭터 윤곽 흰 후광(결정 0030) + 하단 확정 문구**("○○님에게 투표했어요")로 보인다. 발밑 링·원 테두리·머리 위 배지는 결정 0030 으로 이미 없앴으므로 쓰지 않는다. 마감 전에는 다른 캐릭터를 탭하면 바뀐다. 남의 선택은 보이지 않는다.
- **D-20** 마감 뒤 공개는 **화살표 + 표수 배지를 한 명씩 차례로** 보여 준다: 투표자 캐릭터에서 고른 대상으로 화살표가 하나씩 뻗고, 닿을 때마다 대상 위 표수가 하나씩 오른다. **첫 순서는 무작위**("사랑의 작대기"처럼 긴장감을 주는 연출). 모든 폰에 같은 순서로 보이도록 **순서는 서버가 정해 결과와 함께 보낸다**. 무효표(기권)는 화살표가 없다. 여부 투표(찬성/반대)는 **익명**이라 이 화살표 공개를 하지 않는다(D-02). 화살표 공개는 후보 선택 투표에만 쓴다.
- **D-21** 공개는 **후보 선택 투표 뒤 별도 공개 구간 4초**를 둔다(여부 투표는 개인별 공개가 없어 공개 구간이 없다). 인원수 × 약 0.5초(8명 약 4초)로 연출 길이를 맞추고 4초를 넘기지 않는다. 변론·선택 시간은 줄이지 않는다. 여부 투표 결과가 반대·동률이면 바로 밤으로, 후보 선택이 동률이면 공개 뒤 밤으로 간다. 따라서 한 판의 처형 구간은 최대 약 44초(여부 10, 후보 15+4, 변론 10, 처형 5)다.
- **D-22** 화살표·표수 배지는 **코드(SVG)로 만든다.** (사용자가 에셋 적용 요청을 취소했다.) 나중에 그림으로 바꿀 일이 생기면 `src/net/assets.ts` 슬롯 방식(결정 0026)을 쓴다.

### 처형 투표 인트로 카드 (사용자 확정 2026-10-26)
- **D-23** 여부 투표가 시작될 때 메인 화면에 **"처형 투표" 카드**가 위에서 아래로 떨어져 중앙에 자리 잡았다가 사라진다. 하단 패널에만 안내가 나오면 심심하다는 이유로, 적색 계열을 써서 밋밋하지 않게 만든다(진홍 토큰 `crimson-*` 사용, 테두리·그림자·글자에 무게감).
- **D-24** 카드는 **코드(SVG/CSS)로 새로 만든다**(그림 에셋 요청 없음). 아침 카드(`MorningCard`)와 같은 층 규칙을 쓰고 탭은 통과시킨다. 길이는 약 1.6초(낙하 → 중앙 정지 → 사라짐)이며 투표 10초는 카드와 동시에 열려 시간을 깎지 않는다. 모션 줄이기 설정(`prefers-reduced-motion`)에서는 낙하 없이 페이드만 한다. 후보 선택·변론·처형에도 비슷한 인트로를 둘지는 이번 범위가 아니다(사용자가 정하면 추가).

### 결과 화면·판 종료
- **D-17** 결과 화면: 승리 팀 배너 + 테이블 위 캐릭터가 한꺼번에 **실제 직업 카드로 공개** + 아래에 **판 요약**(밤별 암살 결과, 낮별 처형 여부·후보, 한 줄씩). 요약은 서버가 판 종료 때만 전체에 보낸다(비공개 정보가 판 중에 새지 않게). 전수 누출 테스트 필수.
- **D-18** 끝난 뒤: `[처음으로]` 로 홈에 돌아가 새 방을 만든다(END-02). 같은 사람들로 바로 다시 하기는 v2(REMATCH-01). 끝난 방의 정리 시점은 계획 재량(Durable Object 알람).

### 계획 단계 확정 사항 (2026-10-26, 리서치 열린 질문에 대한 결정)
- **D-25** 단계 흐름: `discussion(90s) → execVote(10s) → [찬성 과반이면] candidateVote(15s) → candidateVoteReveal(4s) → [최다 득표자 있으면] defense(10s) → execution(5s) → ended | night`. 여부 투표 과반 아님·후보 동률이면 바로(후보 동률은 공개 뒤) 밤으로. 여부 투표용 `execVoteReveal` 단계는 두지 않는다.
- **D-26** 서버 웨이브만 따로 배포하지 않는다. 새 단계를 클라이언트가 모르면 판이 멈추므로, 화면 폴백 또는 화면 웨이브와 한 단위로 묶어 배포한다. 이번 계획은 서버·공유 로직 웨이브까지이며 배포는 하지 않는다(화면 UI-SPEC 후 이어서).
- **D-27** 종료 요약에는 밤별 암살 결과와 함께 "의사가 지켰다"는 사실도 보인다(판이 끝나 모든 정보가 공개되므로). 판 중에는 어떤 뷰에도 싣지 않는다.
- **D-28** 종료 방 정리는 30분 뒤(재량 제안 채택). 투표 조기 종료(전원이 일찍 고르면 바로 넘김)는 하지 않는다. 0표여도 정해진 시간을 거친다. `REQUIREMENTS.md` CONN-02 문구의 옛 표현("찬반이면 기권", "2일차부터 어제 주장")을 결정 0034·0023(무효표, 이월 없음)에 맞게 고친다.

### Claude's Discretion
- 투표 공개 연출 세부(화살표/선/표 수 배지), 스포트라이트 반경·페이드 시간, 시간대별 어두움 수치.
- 처형 문구 8개 안팎의 실제 표현.
- 와이어 계약·단계 ID(`execVote`, `candidateVote`, `defense`, `execution`, `ended` 등) 이름과 `ON_ENTER` 훅 구성.

### Deferred Ideas (OUT OF SCOPE)
- 같은 사람들로 바로 다시 하기(REMATCH-01, v2), 방장 직업 구성 조정(ROLEX-01, v2).
- 투표·처형·승리 효과음·배경음(5페이즈), 캐릭터 애니메이션(5페이즈).
- 큰 폰 세로 가운데·층 분리 에셋(데스크톱 몫, HANDOFF).

(작업 순서 메모: 새 시안 → `/gsd-ui-phase 4` → `/gsd-plan-phase 4`. 서버 규칙·테스트는 시안과 독립이라 시안 승인 전에 먼저 계획·진행할 수 있다. — 이 연구는 그 "서버 규칙" 부분이다.)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| VOTE-01 | 처형 여부 투표 10초, 던진 표 중 찬성 과반이면 후보 선택, 아니면 밤. 익명·실시간 집계·번복 가능. 기권 버튼 없음, 못 보낸 표는 무효 | `execVote` 단계 + `castExecVote`(마지막 선택 유효) + `resolveExecVote`(마감 훅, 분모 = 던진 표) + 전원 방송 `day.execTally{yes,no}` + 본인 전용 `me.voteAgree`. "투표 규칙표"·"집계 수 방송 누출 분석"·Pitfall 1~4·7 |
| VOTE-02 | 후보 선택 15초, 자기 제외, 최다 득표자, 동률이면 밤. 마감 뒤 서버가 정한 무작위 순서로 개인별 공개 | `candidateVote` + `castCandidateVote`(자기 선택 BAD_MESSAGE) + `candidateVoteReveal`(4초) 진입 훅 `tallyCandidateVote`·셔플. `votes[]` 배열 순서 = 공개 순서 |
| VOTE-03 | 최후 변론 10초, 후보만 변론 메시지 | `defense` + 변론 템플릿 6종(`when:"defense"`) + `say` 후보 전용 검사 + 비후보 이모티콘만 |
| VOTE-04 | 처형 5초에 후보 탈락·발표, 직업 비공개, 투표 내역이 유저 기록 카드에 날짜별 누적 | `enterExecution`(탈락 + 문구 추첨) + `day.voteLog`(여부는 집계 수만, 후보 선택만 개인별) + `day.execution` |
| COMM-03 | 변론 중 후보만 변론 메시지, 나머지는 이모티콘만 | chat.ts 단계 집합 확장 + `when` 판정 일반화 |
| CONN-02 | 끊긴 사람이 있어도 서버 타이머대로 진행, 못 보낸 표는 무효 | tick 은 연결을 보지 않는다. 집계 분모 = 던진 표, 승패 분모 = 생존자(연결 무관). REQUIREMENTS CONN-02 문구 갱신 작업 포함(D-28) |
| END-01 | 처형·밤 결과마다 승패 판정 | `win.ts` `checkWinner` + `ON_DEADLINE.execution`/`.morning` 분기(`next:"ended"`) |
| END-02 | 결과 화면에 승리 팀·모든 역할, 처음 화면으로 돌아가 새 방 | `ended` + `RoomView.result`(전원, 판 종료 때만) + 종료 방 30분 정리(D-28). "처음으로"는 기존 `onExit("left")` 재사용 |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

`/Users/dhkim1522/personal/minifia/CLAUDE.md` 와 상위 지침에서 이 페이즈에 걸리는 지시:

- **서버가 규칙·판정, 클라이언트는 받은 상태를 보여 주고 행동만 보낸다**(결정 0002). 다른 사람의 역할은 서버가 클라이언트로 보내지 않는다 — 화면에서 숨기는 것으로 대신하지 않는다. (여부 투표의 익명도 같은 원칙이다: 서버가 개인별 선택을 보내지 않는다.)
- 기획·계획은 참여 플레이어의 **몰입**을 기준으로, 각 페이즈는 자기 구간의 이펙트·액션 기본형을 함께 만든다(결정 0006).
- 새 결정은 `docs/decisions/` 에 **다음 번호**(현재 최신 0035 → **0036**)로 추가한다. 와이어 변경은 새 결정 기록에 적는다(0034-7).
- 작업을 마칠 때마다 `HANDOFF.md` 갱신 + push. **`HANDOFF.md` 는 6KB 이하**(`test/unit/handoff.test.ts`).
- GSD 산출물·응답은 **한국어**, 코드·명령·파일 이름·요구사항 ID 는 원문.
- **작은 MVP**, **이른 배포**(단, 이번 서버 웨이브는 D-26 으로 배포하지 않는다), **화면 페이즈는 UI-SPEC 먼저**.
- 정적 그림을 바꾸면 `ASSET_VERSION` 을 올린다 — 이 페이즈 서버 작업은 그림을 바꾸지 않으므로 올리지 않는다(인트로 카드·화살표는 코드 SVG/CSS, D-22·D-24).
- `config.json`: `tdd_mode: true`, `nyquist_validation: true`, `security_enforcement: true`(ASVS L1) → Validation Architecture·Security Domain 포함.

## Summary

이 페이즈의 서버 작업은 **새 라이브러리가 필요 없다.** 기존 틀(단계 표 `PHASE_DEFS` + 진입 훅 `ON_ENTER` + 마감 훅 `ON_DEADLINE` + 순수 규칙 모듈 + 허용 목록 리터럴 뷰)에 **6개 단계**(`execVote`, `candidateVote`, `candidateVoteReveal`, `defense`, `execution`, `ended`; 8 → 14개)를 더하고 집계·판정·승패 모듈을 새로 만드는 일이다. 단계 흐름은 D-25 로 확정됐다: `discussion → execVote → [과반] candidateVote → candidateVoteReveal → [후보] defense → execution → ended | night`. 여부 투표용 공개 구간(`execVoteReveal`)은 없다. 처형 구간은 최대 약 44초(10 + 15 + 4 + 10 + 5)다.

**여부 투표와 후보 선택 투표는 비공개 규칙이 정반대다. 이것이 이번 연구의 핵심 설계 축이다.**

| | 여부 투표 (`execVote`) | 후보 선택 (`candidateVote`) |
|---|---|---|
| 진행 중 | 찬성/반대 **집계 수를 전원에게 실시간 방송**. 개인 선택은 본인 프레임에만 | 아무것도 방송하지 않음. 내 선택만 **본인에게만** 전송 |
| 번복 | 마감 전까지 가능(마지막 선택 유효). 같은 값 재전송은 불변 | 마감 전까지 가능(D-19) |
| 마감 뒤 | 개인별 공개 **없음**(익명 유지). 기록은 날짜별 `{yes,no,passed}` 집계 수만 | 개인별 공개: `votes[{seat,target}]` 를 서버가 셔플한 순서로 4초 공개 구간에서 전원에게 |
| 집계 시점 | `execVote` **마감 훅**(`ON_DEADLINE`) — 난수 불필요 | `candidateVoteReveal` **진입 훅**(`ON_ENTER`) — 셔플에 `randInt` 필요 |
| 서버에 남는 개인 표 | 집계 직후 **즉시 삭제**(Pitfall 22) | 공개 기록(`voteLog.cand.votes`)으로 남음 |

**구조상 새로 필요한 것은 두 가지**다. (1) **단계 분기**: 지금 `tick` 은 `PHASE_DEFS[phase].next` 한 줄뿐이라 "여부 투표 반대 → 밤", "후보 없음 → 밤", "처형/아침 뒤 승패 → ended" 같은 조건 분기를 못 한다. `ON_DEADLINE` 반환에 선택 필드 `next?: PhaseId` 를 더하는 것이 가장 작은 변경이다(표의 `next` 는 "기본 다음 단계"). (2) **판 종료 단계 `ended`**: `durationMs: null`, `next: null`. 방 정리는 `nextWakeAt` 이 이미 `expiresAt` 을 알람으로 쓰므로, 종료 진입 때 `expiresAt` 을 진입 시각 + 30분(D-28)으로 앞당기기만 하면 된다. 이를 위해 `ON_ENTER` 훅에 진입 시각 `at` 을 세 번째 인자로 더한다.

**가장 큰 위험은 두 곳**이다. 첫째, **누출**: 실시간 집계 방송은 "누가 어느 쪽인지"를 새지 않게 설계해야 한다(아래 "집계 수 방송 누출 분석" — 프레임 내용, 타이밍, 구조적 추론 채널, 차분(indistinguishability) 테스트). 후보 선택 진행 중 표는 본인에게만, 처형자 직업은 `ended` 전까지 생존자에게 비공개, `result`·판 요약은 `ended` 프레임에서만. 둘째, **연쇄 수정 범위**: 타입이 강제하는 곳(`PHASE_SCENE`, `TEST_PHASE_LABEL`, `PHASE_ANNOUNCE`, `QUICK_TEMPLATES`/`TEMPLATE_CHIP`)과 타입이 못 잡는 곳(`DAY_PHASES`, `renderPhase` 의 `default → 연결 중…`, `webSocketMessage`/`actAsBot` switch, 봇 계획, 스모크·UAT 전이 표, `EXPECTED_SCENE`). D-26: 서버 웨이브는 단독 배포하지 않는다.

**클라이언트 전용 항목은 서버 영향이 없다.** D-23·D-24 의 "처형 투표" 인트로 카드(1.6초, 코드 SVG/CSS)는 서버 단계·훅·와이어·시간을 **바꾸지 않는다**: 새 `PhaseId` 도 없고(인트로 단계를 두지 않는다), 투표 10초는 카드와 동시에 열린다(`execVote` 의 `phaseEndsAt` 은 그대로). 필요한 것은 화면 웨이브의 `PHASE_INTRO`(`src/game/scenes.ts`) 행 추가와 `usePhaseArrival` 활용뿐이다. 후보 선택 화살표·표수 배지(D-22)와 스포트라이트도 서버 입장에서는 `votes[]`(순서 포함)·`day.candidate` 를 주면 끝이다.

**Primary recommendation:** `ON_DEADLINE` 에 `next?` 를 더해 분기를 표현하고, 여부 투표는 마감 훅에서 **집계 후 개인 표를 지워** 익명을 구조적으로 보장하며, 후보 선택은 `candidateVoteReveal` 진입 훅에서 집계·셔플한다. 진행 중 여부 투표는 "수락된 변경마다 전원에게 state 방송(집계 수 + 각자 me.voteAgree)"하고, 누출은 **차분 테스트**(투표자 배치만 다른 두 상태의 제3자 뷰가 동일)로 고정한다. 와이어는 결정 0036 한 문서에 몰고, TDD 로 규칙(단위) → 누출(전수·차분) → 소켓(워커) 순서로 간다.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| 투표 수신·검증(생존·단계·자기 선택 금지) | API / Backend (방 DO + `shared/game` 순수 규칙) | — | 신원은 소켓 첨부 playerId 뿐, 메시지에서 seat 를 읽지 않는다(결정 0002) |
| 여부 투표 실시간 집계 수 계산·방송 | API / Backend | — | 집계는 서버가 만든 파생 값(`yes`,`no`). 개인 표는 서버에만 있다 |
| 집계(과반·최다·동률)·후보 확정·처형 | API / Backend | — | 서버가 규칙을 정한다 |
| 후보 선택 공개 순서(무작위) 결정 | API / Backend | — | 모든 폰이 같은 순서를 보려면 서버가 정한다(D-20). 난수는 `randInt` 인자로만 |
| 승패 판정 | API / Backend | — | 역할을 읽는 유일한 층. 반환은 팀 문자열 하나뿐 |
| 단계 시간·분기·종료 방 정리 | API / Backend (tick + DO 알람) | — | 마감은 서버 시각, 알람 하나가 단계 마감·만료·봇을 함께 다룬다 |
| 뷰 마스킹 | API / Backend (`buildView` 허용 목록) | — | 허용 목록 리터럴이 누출을 구조적으로 막는다 |
| "처형 투표" 인트로 카드(D-23·24)·화살표·스포트라이트·결과 카드 | Browser / Client | — | **서버 영향 없음, 이 연구 범위 밖** |
| 유저 기록 카드의 투표 내역 | Browser / Client | API(`day.voteLog` 공급) | 서버가 공개 로그를 모두에게 같게 보내고 화면이 사람별로 거른다(`claimLog` 선례). 여부는 날짜별 집계 수만 |
| "처음으로" | Browser / Client | — | `onExit("left")` → `clearSession` + `goHome` |

## Standard Stack

### Core (모두 이미 설치됨 — 새 의존성 없음)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| TypeScript | 7.0.2 | 타입·exhaustive 검사 | `package.json` devDependencies [VERIFIED: package.json] |
| zod | 4.6.7 | 서버 입력 검증(`ClientMessageSchema`) | 기존 `strictObject` 패턴. `shared/schemas.ts` 는 워커만 import [VERIFIED: shared/schemas.ts:1-36] |
| vitest | 4.1.12 | 단위/클라이언트/워커 3개 프로젝트 | [VERIFIED: vitest.config.ts] |
| @cloudflare/vitest-plugin | 1.4.6 | 워커 통합 테스트(workerd) | 기존 `test/worker/*` |
| wrangler | 4.151.3 | 로컬/배포 | `npm run deploy`(이번 웨이브는 배포하지 않는다, D-26) |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| playwright-core | 1.64.1 | E2E(화면) | 화면 웨이브에서만 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `ON_DEADLINE` 에 `next?` | `PHASE_DEFS.next` 를 함수로 | 표는 "데이터만 둔다"는 원칙(`phases.ts` 머리 주석)을 깬다 |
| 여부 투표를 마감 훅에서 집계 | 별도 공개 구간 진입 훅에서 집계 | 여부 투표는 개인별 공개가 없고(D-02) 공개 구간이 없다(D-25). 셔플이 필요 없어 `ON_DEADLINE`(난수 없음)으로 충분하다 |
| 후보 선택은 공개 구간 진입 훅에서 집계·셔플 | 투표 마감 훅에서 | 셔플에 `randInt` 필요 — `ON_DEADLINE` 시그니처에 난수가 없다. 진입 훅은 `enterMorning` 과 같은 `(state, randInt)` |
| `votes[]` 배열 순서 = 공개 순서 | 별도 `order[]` | 한 배열이면 어긋남이 없다 |
| 집계 수 방송을 변경마다 즉시 | 일정 간격으로 합쳐 방송(coalescing) | 즉시가 단순하고 "실시간"(D-02)에 맞는다. 연결당 20msg/s 한도가 증폭을 제한한다(Pitfall 23) |

**Installation:** 없음.

**Version verification:** 위 버전은 `package.json` 의 고정 버전이며 이번 세션에서 `npx vitest run`(unit 795 / worker 139 / client 955 통과), `npx tsc -p tsconfig.app.json|tsconfig.worker.json --noEmit` 무오류로 동작을 확인했다 [VERIFIED: 실행 결과]. 새 패키지가 없어 레지스트리 조회는 하지 않았다.

## Package Legitimacy Audit

이 페이즈는 **외부 패키지를 설치하지 않는다.** `gsd_run query package-legitimacy check` 대상 없음.

| Package | Registry | Age | Downloads | Source Repo | Verdict | Disposition |
|---------|----------|-----|-----------|-------------|---------|-------------|
| (없음) | — | — | — | — | — | — |

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### 단계 흐름 (데이터 흐름 다이어그램, D-25)

```
 discussion(90s)
      │ tick: deadline
      ▼
 execVote(10s)  ON_ENTER: enterExecVote (옛 투표·verdict·execution 청소)
      │  ◄── 클라 {t:"execVote", agree}  (생존자만, 마감 전 번복 가능, 마지막 값 유효)
      │  └─► 수락·값 변경마다: 전원에게 state 방송 (day.execTally{yes,no} + 각자 me.voteAgree)
      │ ON_DEADLINE: resolveExecVote
      │   - 던진 표만 집계, voteLog 에 {n, exec:{yes,no,passed}}, verdict.passed 기록
      │   - 개인 표(Player.execVote) 즉시 삭제  ← 익명 보장
      │   - passed ? 기본 next(candidateVote) : next="night"
      ├──── 반대/동률/0표 ───────────────────────────────────────────────┐
      ▼                                                                    │
 candidateVote(15s)  ◄── 클라 {t:"candidateVote", target} (자기 제외, 번복 가능)
      │  └─► 수락마다: 투표자 본인에게만 state (me.voteTarget)  — 방송 없음
      ▼
 candidateVoteReveal(4s)  ON_ENTER: 최다 득표 집계 + randInt 셔플 → voteLog.cand{votes[],candidate?}
      │  모두에게 votes[](공개 순서)·candidate
      │ ON_DEADLINE: candidate ? 기본 next(defense) : next="night" ───────┤
      ▼                                                                    │
 defense(10s)  ← 후보만 say(변론 템플릿), 나머지는 emoji 만                │
      ▼                                                                    │
 execution(5s)  ON_ENTER: 후보 alive=false + 처형 문구 추첨(randInt)       │
      │ ON_DEADLINE: checkWinner ? next="ended" : 기본 next(night)         │
      ├── 승패 ──► ended(마감 없음)  ON_ENTER: winner 기록·expiresAt = 진입+30분
      ▼                                                                    ▼
 night(30s) ──► morning(5s) ─ ON_DEADLINE: checkWinner ? "ended" : 기본 next(dayAnnounce)
```

### 단계 표 (제안 — 이름은 CONTEXT 가 재량으로 열어 둔 부분)

| PhaseId | durationMs | 기본 next | revealsOwnRole | ON_ENTER | ON_DEADLINE(분기) |
|---------|-----------|-----------|----------------|----------|-------------------|
| `discussion` (변경) | 90_000 | `execVote` (지금 `night`) | true | — | — |
| `execVote` | 10_000 | `candidateVote` | true | `enterExecVote`(청소) | `resolveExecVote`: `passed ? 기본 : "night"` |
| `candidateVote` | 15_000 | `candidateVoteReveal` | true | — | — |
| `candidateVoteReveal` | 4_000 | `defense` | true | `enterCandidateVoteReveal`(집계·셔플·로그) | `candidate ? 기본 : "night"` |
| `defense` | 10_000 | `execution` | true | — | — |
| `execution` | 5_000 | `night` | true | `enterExecution`(탈락·문구) | `checkWinner() ? "ended" : 기본` |
| `ended` | null | null | true | `enterEnded`(winner·`expiresAt` 단축) | — |
| `morning` (변경) | 5_000 | `dayAnnounce` | true | (기존 `enterMorning`) | `checkWinner() ? "ended" : 기본` |

기존 `PHASE_DEFS` 인용(수정 대상) [VERIFIED: shared/game/phases.ts:28-37]:
```
  discussion: Object.freeze({ durationMs: DISCUSSION_MS, next: "night", revealsOwnRole: true }), // 4페이즈가 이 사이에 투표·처형을 끼운다
  night: Object.freeze({ durationMs: NIGHT_MS, next: "morning", revealsOwnRole: true }),
  morning: Object.freeze({ durationMs: MORNING_MS, next: "dayAnnounce", revealsOwnRole: true }),
```
기존 `ON_ENTER`/`ON_DEADLINE` 인용(수정 대상) [VERIFIED: shared/game/tick.ts:31-41]:
```
const ON_ENTER: Partial<Record<PhaseId, (s: RoomState, randInt: RandInt) => RoomState>> = {
  dayAnnounce: enterDayAnnounce,
  claim: enterClaim,
  night: enterNight,
  morning: enterMorning,
};
...
const ON_DEADLINE: Partial<Record<PhaseId, (s: RoomState) => { state: RoomState; stay: boolean }>> = {
  claim: resolveClaimTurn,
};
```
`PhaseId` 인용(수정 대상) [VERIFIED: shared/protocol.ts:22-24]:
```
export type PhaseId =
  | "lobby" | "assigning" | "roleReveal" | "dayAnnounce" | "claim" | "discussion"
  | "night" | "morning";
```
시간 상수는 `phases.ts` 에 `EXEC_VOTE_MS = 10_000`, `CANDIDATE_VOTE_MS = 15_000`, `CANDIDATE_REVEAL_MS = 4_000`, `DEFENSE_MS = 10_000`, `EXECUTION_MS = 5_000` (D-01·D-21, "한 곳"). 공개 구간은 인원수와 무관하게 **고정 4초**다(연출을 4초 안으로 맞추는 일은 화면의 몫). 투표 단계는 모두가 일찍 던져도 조기 종료하지 않고(D-28), 0표여도 정해진 시간을 거친다. **어떤 투표 행동도 `phaseEndsAt` 을 바꾸지 않는다**(`selectClaim` 과 다르다) — 마감 이동은 투표 타이밍을 흘린다.

### 서버 상태 필드 (제안, 모두 optional — 옛 저장 방도 읽힌다)

`RoomState`/`Player` 의 현재 모양 [VERIFIED: shared/game/room.ts:16-92] 의 줄 형태(`nightPick?: number;`, `morning?: MorningView;`, `lastPhrase?: number;`)를 따른다:

| 위치 | 필드 | 의미 | 정리 시점 |
|------|------|------|-----------|
| `Player` | `execVote?: boolean` | 이번 낮 여부 투표(찬성 true). 서버 전용. 마지막 선택이 유효 | **`resolveExecVote`(마감 훅)가 집계 직후 키째 지움** + `enterExecVote` 가 한 번 더 지움 |
| `Player` | `candidateVote?: number` | 이번 낮 후보 선택(seat). 서버 전용 | `enterExecVote` 가 키째 지움 |
| `RoomState` | `verdict?: { passed: boolean; candidate?: number }` | 집계 결과(분기 근거). 서버 전용 | `enterExecVote` 가 지움 |
| `RoomState` | `voteLog?: VoteLogEntry[]` | 일차별 공개 투표 기록(D-08). 판 내내 쌓임 | 판 종료/`testReset` |
| `RoomState` | `execution?: { seat: number; phrase: number }` | 처형 발표 | `enterExecVote` 가 지움 |
| `RoomState` | `lastExecPhrase?: number` | 연속 반복 방지(아침 `lastPhrase` 와 **따로**) | 판 내내 |
| `RoomState` | `nightLog?: NightLogEntry[]` | 밤별 지목·사망(판 요약 재료). **서버 전용·종료 전 비공개** | 판 종료 |
| `RoomState` | `winner?: "citizen" \| "mafia"` | `enterEnded` 가 기록 | — |

`resetToLobby` 는 허용 목록 리터럴로 방을 다시 만들므로 위 필드가 자동으로 빠진다 [VERIFIED: shared/game/testTools.ts:63-94, "상태를 펼쳐 복사하지 않아 ... 앞으로 늘어날 게임 필드도 자동으로 빠진다"]. 테스트로 확인만 하면 된다.

### 와이어 계약 (제안, `shared/protocol.ts` 에 한 번에 — 결정 0036 으로 기록)

```ts
// PhaseId += 여섯
//   "execVote" | "candidateVote" | "candidateVoteReveal" | "defense" | "execution" | "ended"

// ClientMessage += 둘 (strictObject; 행동 종류는 단계가 정한다)
//   { t: "execVote"; agree: boolean }
//   { t: "candidateVote"; target: number }

// TEMPLATE_IDS += 변론 여섯 (D-13). 기존 innocent 와 문구가 같아도 id 를 따로 둔다(when 이 한 값이라 판정이 단순)
//   "defNotMe"(저 아니에요) "defCitizen"(저는 시민이에요) "defSuspect"([○○] 의심해 주세요, target)
//   "defTrust"([○○] 믿어 주세요, target) "defRole"(제가 [직업]입니다, claimedRole) "defPlead"(한 번만 믿어 주세요)

export const EXECUTION_PHRASE_COUNT = 4;   // D-11
// MORNING_PHRASE_COUNT 8 → 7 (D-11: "이슬이 되어 사라졌습니다" 제거)

export interface CandidateVoteLine { seat: number; target: number }   // 던진 표만. 무효표는 줄이 없다
export interface VoteLogEntry {
  n: number;                                                          // 일차
  exec: { yes: number; no: number; passed: boolean };                 // 집계 수만 — 개인별 줄 없음(익명, D-02·D-08)
  cand?: { votes: CandidateVoteLine[]; candidate?: number };          // 여부 통과 때만. votes 배열 순서 = 서버가 정한 공개 순서(D-20). candidate 없음 = 동률·0표
}
export interface ExecutionView { seat: number; phrase: number }       // 1..EXECUTION_PHRASE_COUNT
export interface SummaryRow {
  n: number;
  night?: { target?: number; died: boolean };                         // D-27: died=false(지목했으나 안 죽음) = 의사가 지킴. 종료 뒤에만
  exec?: { yes: number; no: number; passed: boolean; candidate?: number };
}
export interface GameResult {
  winner: "citizenWin" | "mafiaWin";   // 'mafia'/'citizen' 은 누출 검사의 ROLE_WORDS 라 쓰지 않는다(Pitfall 10)
  seats: SpectateSeat[];               // {seat, job} 전원 — 키 이름 job (role 금지)
  summary: SummaryRow[];
}
// MyInfo += voteAgree?: boolean (execVote 단계, 본인), voteTarget?: number (candidateVote 단계, 본인)
// DayView += voteLog: VoteLogEntry[] (낮 단계마다 항상, claimLog 선례),
//            execTally?: { yes: number; no: number } (execVote 단계에서만, 전원에게 같은 값),
//            candidate?: number (candidateVoteReveal·defense·execution), execution?: ExecutionView (execution 단계에서만)
// RoomView += result?: GameResult (ended 단계에서만, 전원)
```
`ClientMessage` 의 현재 모양 [VERIFIED: shared/protocol.ts:164-179] 일부 — 새 줄을 이 목록에 더한다:
```
  | { t: "pick"; target: number } // 밤 행동 — 행동 종류는 보내지 않는다(서버 저장 역할이 정한다)
```
`TEMPLATE_IDS` 의 현재 모양 [VERIFIED: shared/protocol.ts:73-77]:
```
export const TEMPLATE_IDS = [
  "suspect", "trust", "claimed", "innocent", "vote",
  "nightTarget", "nightAgree", "nightOther",
  "claimRole", "claimNone",
] as const;
```
(`z.enum(TEMPLATE_IDS)` 가 `say` 스키마에 이미 걸려 있어 새 ID 는 스키마 변경 없이 통과한다 [VERIFIED: shared/schemas.ts:21-26].)

**의도적으로 없는 키:** `day.voteLog[].exec.votes`, `players[].voted`, "N명 투표함" 류 진행 요약, `execVote` 개인 줄 — 어떤 뷰에도 여부 투표의 개인별 정보가 실리지 않는다(허용 목록 리터럴이라 서버 전용 `Player.execVote` 는 자동으로 빠진다).

### 권장 모듈 구성

```
shared/game/
├── vote.ts        # castExecVote / castCandidateVote / resolveExecVote / tallyCandidateVote / execTallyOf (순수, night.ts 모양)
├── win.ts         # checkWinner(state): "citizen"|"mafia"|null   (역할을 읽지만 팀 문자열만 반환)
├── execution.ts   # enterExecVote / enterCandidateVoteReveal / enterExecution / route* (마감 분기) / enterEnded / buildSummary
├── phases.ts      # +상수·행 (데이터만)
├── tick.ts        # ON_ENTER/ON_DEADLINE 행 추가 + next? 분기 + 진입 훅 3번째 인자 at
├── chat.ts        # 변론 템플릿·단계 집합·when 판정 일반화
├── night.ts       # ResolvedNight 에 target 추가(nightLog 용) — 난수 호출 순서는 그대로
├── bots.ts        # 투표·변론 봇 계획
└── view.ts        # DAY_PHASES 확장, me.voteAgree/voteTarget, day.execTally/voteLog/candidate/execution, result
```

### Pattern 1: 마감 분기 (tick)

**What:** 훅이 `next` 를 돌려주면 그 단계로, 없으면 표의 기본 `next` 로 간다. 새 마감은 지금처럼 `이전 마감 + 다음 단계 길이`.
**When to use:** `execVote`, `candidateVoteReveal`, `execution`, `morning` 의 마감.
**Example:**
```ts
// Source: 기존 shared/game/tick.ts 루프 구조 위에 얹는 제안 [VERIFIED: tick.ts:43-75 를 읽고 쓴 변경안]
type DeadlineResult = { state: RoomState; stay: boolean; next?: PhaseId };
const ON_DEADLINE: Partial<Record<PhaseId, (s: RoomState) => DeadlineResult>> = {
  claim: resolveClaimTurn,
  execVote: resolveExecVote,                 // 집계 + 개인 표 삭제 + passed ? 기본 : next "night"
  candidateVoteReveal: routeAfterCandidateVote,
  execution: routeAfterExecution,            // checkWinner → next: "ended"
  morning: routeAfterMorning,                // checkWinner → next: "ended"
};
// 루프 안: const resolved = onDeadline?.(current); ... closing = resolved.state;
//          const next = resolved?.next ?? PHASE_DEFS[closing.phase].next;
//          hook(entered, randInt, deadline)   // at = 진입 시각(= 이전 마감)
```
`stay` 의 기존 분기(`resolved.stay && turnMs !== null`)는 그대로 둔다. 새 훅은 `stay: false`.

### Pattern 2: 후보 선택 집계는 공개 구간 진입 훅에서, 한 번에

**What:** `enterMorning` 이 `resolveNight` 결과를 한 번의 새 상태로 적용하는 것과 같다. 던진 표만 모아 → seat 오름차순으로 정렬(시드 재현성) → Fisher–Yates 셔플 → `voteLog.cand` 에 기록 → `verdict.candidate` 기록.
**난수 호출 순서 계약(night.ts 선례처럼 주석+테스트로 고정):** 투표자 수 n ≥ 2 일 때 `i = n-1 … 1` 에 `randInt(i+1)`. n ≤ 1 이면 호출하지 않는다. `randInt(0)` 금지(`cryptoRandInt(0)` 은 RangeError). 동률 처리에는 난수를 쓰지 않는다.
```ts
// Source: shared/game/roles.ts:51-58 의 Fisher–Yates 와 같은 모양 [VERIFIED: roles.ts:51-58]
function shuffled<T>(items: readonly T[], randInt: RandInt): T[] {
  const a = [...items];
  for (let i = a.length - 1; i >= 1; i -= 1) {
    const j = randInt(i + 1);
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}
```
여부 투표 집계(`resolveExecVote`)는 난수가 필요 없고 개인별 공개가 없으므로 셔플하지 않는다.

### Pattern 3: 투표 수신 — `pickTarget` 과 같은 검사 순서·같은 값 재선택은 입력 그대로

`pickTarget` 의 계약 [VERIFIED: shared/game/night.ts:14-39]: 단계(틀리면 `WRONG_PHASE`) → 행위자(방에 있고 생존, 아니면 `BAD_MESSAGE`) → 대상(정수·앉은 생존자) → 같은 값이면 입력 상태 그대로 `ok` → 그 사람 필드만 바꾼 새 상태. `castExecVote` 는 대상 검사 없이 `agree: boolean` 만, `castCandidateVote` 는 대상 검사에 **`target === actor.seat` → `BAD_MESSAGE`** 를 더한다.

**방 DO 쪽 — 두 투표의 수신자가 다르다:**

| 메시지 | 수락(값이 바뀜) 뒤 | 같은 값 재전송 | 거부 |
|--------|-------------------|----------------|------|
| `execVote` | 저장 후 **`persistAndBroadcast()`** — 모든 소켓이 각자 view 를 받음(집계 수가 바뀌었으므로). 서버 봇도 같은 `applyExecVote` | 저장·전송 없음(`result.state === this.room`) | `sendRejection`(그 소켓에만 error + 최신 state) |
| `candidateVote` | 저장 후 **`sendViewTo([voterId])`** (`applyPick` 선례 [VERIFIED: worker/room.ts:413-422]) — 방송 없음 | 저장·전송 없음 | `sendRejection` |

(`applyPick` 의 "받는 사람에게만" 규칙은 `execVote` 에는 적용하지 않는다: 집계 수가 실시간 공개 정보이고(D-02), 개인 선택은 view 허용 목록이 이미 본인 프레임으로만 제한한다. 근거와 누출 분석은 다음 절.)

### Pattern 4: 허용 목록 뷰 확장

`buildDay`·`buildView` 는 객체 리터럴/필드별 복사만 쓴다 [VERIFIED: shared/game/view.ts:42-63, 98-143]. 새 필드도 **조건을 채울 때만 키를 만든다**(undefined 로 남기지 않는다). `DAY_PHASES` 집합에 새 단계를 **반드시** 넣는다 [VERIFIED: shared/game/view.ts:28-34]:
```
const DAY_PHASES: ReadonlySet<PhaseId> = new Set([
  "dayAnnounce",
  "claim",
  "discussion",
  "night",
  "morning",
]);
```
빠뜨리면 `view.day` 가 통째로 없어져 화면이 `day.n` 을 못 읽는다(타입은 잡지 못한다). `ended` 에 `day` 를 둘지는 UI-SPEC 이 정하되 **의도적으로** 결정한다.

### Anti-Patterns to Avoid

- **후보 선택 투표 직후 전원 방송 / 여부 투표에 `players[]` 표시를 추가**: 후보 선택은 `sendViewTo([voter])` 만. 여부 투표는 방송하되 **집계 수 외에 어떤 파생 값(투표함 표시, 남은 인원, 마지막 투표 시각)도 싣지 않는다.**
- **여부 투표 개인 표를 마감 뒤에도 보관**: `resolveExecVote` 가 집계 직후 `execVote` 키를 지운다. 남겨 두면 이후 어떤 코드 변경(예: 요약 확장)이 한 줄로 익명을 깬다.
- **여부 투표 `voteLog.exec` 에 `votes[]` 를 넣기**: D-08 은 집계 수만. 타입 수준에서 불가능하게 둔다(`{yes,no,passed}`).
- **투표 때 `phaseEndsAt` 을 당기기**(`selectClaim` 모방): 타이밍 누출 + D-28(조기 종료 없음) 위반.
- **`PHASE_DEFS.next` 를 조건부 함수로**: 표는 데이터만 둔다.
- **승패 확인을 `enterMorning`/`enterExecution` 안에서**: D-10 은 "아침 발표 5초를 보여 준 **뒤** 종료"다. 마감 훅에서 분기한다.
- **`ended` 에 `durationMs` 를 주고 `next: null`**: `tick` 은 `next === null` 에서 `break` 하는데 `phaseEndsAt` 이 과거로 남아 알람이 즉시 재발화한다. `ended` 는 `durationMs: null`.
- **`result` 를 별도 메시지로**: 상태 프레임의 허용 목록 필드 하나로 둬야 누출 전수 검사가 한 곳을 본다.
- **인트로 카드용 서버 단계/지연 추가**(D-23·24): 클라이언트 전용이다. 서버 시간표에 1.6초를 넣지 않는다.

## 집계 수 방송 누출 분석 (여부 투표, D-02)

**설계:** `execVote` 중 값이 바뀌는 수락마다 모든 소켓에 `state` 를 보낸다. 각 프레임은 `buildView(state, viewerId)` 의 결과이므로 (1) 모든 viewer 에게 같은 `day.execTally{yes,no}`, (2) 그 viewer 본인의 `me.voteAgree` 만 다르다. 이 설계가 새는지 채널별로 점검한다.

| # | 채널 | 새는가 | 근거/대응 |
|---|------|--------|-----------|
| 1 | 프레임 내용 — 개인별 값 | 아니오 | `Player.execVote` 는 서버 전용이고 `buildView` 는 허용 목록이라 `me.voteAgree`(본인) 외에 실리지 않는다. `players[]` 키는 다섯 개로 고정(`alive`·`connected`·`isHost`·`nickname`·`seat`)이며 테스트가 이미 검사한다 [VERIFIED: test/worker/leak.test.ts:239-241] |
| 2 | 프레임 내용 — 탈락 관전자 | 아니오 | 관전자는 `spectate.seats[{seat,job}]` 만 더 받는다. 투표 개인 정보는 `spectate` 에 넣지 않는다(A7) |
| 3 | 타이밍 — "방금 누가 던졌다" | 집계 변화는 보이나 **누가**는 안 보인다 | 프레임이 모든 소켓에 같은 순서·같은 내용으로 가고(`broadcast` 의 소켓 순회), 발신자에게만 보이는 차이는 `me.voteAgree` 뿐이다. 발신자 식별에 쓰일 별도 프레임(error 포함)은 **거부 때만** 발신자에게 간다 |
| 4 | 같은 값 재전송 | 아니오 | 상태 불변 → 저장·전송 없음. 방송이 안 나가므로 "누가 재전송했다"가 보이지 않고, 발신자도 응답 프레임이 없다(`applyPick` 선례). 클라이언트는 낙관적 표시 후 서버 state 로 맞춘다 |
| 5 | 번복(찬성↔반대) | 집계가 `yes-1,no+1` 로 움직이는 것은 보인다 | 누군가 바꿨다는 사실은 집계 공개의 필연. 누구인지는 모른다 |
| 6 | 최초 투표 vs 번복 구분 | 합계 증가 여부로 구분됨(필연) | 집계 공개의 필연. 허용(D-02 사용자 확정) |
| 7 | 마감 시각 이동 | 아니오 | 투표는 `phaseEndsAt` 을 바꾸지 않는다 |
| 8 | 마감 뒤 | 아니오 | 개인 표는 `resolveExecVote` 에서 삭제. `voteLog.exec` 는 `{yes,no,passed}` 만. `execTally` 는 `execVote` 단계에서만 실림 |
| 9 | 영속 저장·테스트 도구 | 아니오 | 마감 뒤 저장소에 개인 표가 없다. `testSkip` 이 `execVote` 를 당겨도 같은 마감 훅을 탄다 |
| 10 | 소규모에서의 산술 추론 | **필연적 잔존** | 4인 방에서 3명이 던졌고 집계가 `찬성 3` 이면 모두가 안다. 본인 표를 아는 사람이 "나 빼고 N명 중 찬성 k" 를 계산하는 것도 집계 공개의 필연. 서버가 막을 수 없다 — 결정 0036 의 "알려진 한계"로 기록 |
| 11 | 사회적 채널(동시에 보낸 이모티콘·빠른 메시지) | 서버 밖 | 쿨다운 합산 규칙 그대로. 결정 0018(매너)과 같은 범주 |
| 12 | 증폭(번복 연타로 프레임 폭주) | DoS 성격 | 연결당 20msg/s(`RATE_MAX_MESSAGES`) 한도가 있고 같은 값은 무전송. 최악 20 × N 프레임/s. 수용(A8) |

**차분(indistinguishability) 테스트 — 이 설계의 핵심 검증:** 두 방 상태 S1·S2 가 "여부 투표 개인 배치만 다르고 집계(`yes`,`no`)·그 외 모든 것이 같다"면, 제3자 viewer O(본인 표가 두 상태에서 같은 사람, 생존자와 탈락 관전자 둘 다)에 대해 `buildView(S1,O)` 와 `buildView(S2,O)` 가 **깊은 동일**해야 한다. 4~8명 × 시드 전수로 `test/unit/view.test.ts` 에 넣는다. 소켓 단위로는 투표자 A 가 던졌을 때와 B 가 던졌을 때 관찰자 O 가 받은 프레임이 `serverNow` 를 제외하고 동일함을 `test/worker/vote.test.ts` 에서 단언한다.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| 셔플 | 새 난수 로직·`Math.random` | `roles.ts` 와 같은 Fisher–Yates + 인자 `randInt` | 서버는 `cryptoRandInt` 주입, 테스트는 `seededRandInt`. 전역 난수 금지 |
| 입력 검증 | 수동 `typeof` 나열 | `ClientMessageSchema` 에 `z.strictObject` 변형 추가 | 덧붙은 키 거부(T-02-15 선례) |
| 생존 판정 | `p.alive === true` | `isAlive(p)` (`alive !== false`) | 옛 상태에서 `alive` 가 없으면 생존 [VERIFIED: shared/game/alive.ts:4-6] |
| 쿨다운·단계 허용 | 새 쿨다운 | `chat.ts` 의 `lastSendAt`·`SERVER_MIN_SEND_GAP_MS`·`senderOf` | 합산 한도가 우회되지 않게 |
| 알람·만료 | 종료 방 전용 타이머 | `nextWakeAt` 이 `expiresAt` 을 이미 본다 [VERIFIED: tick.ts:78-80] | `expiresAt` 만 앞당기면 해결 |
| 단계 넘기기(테스트 방) | 새 도구 | `skipPhase`(마감을 now 로 당겨 `tick`) | 분기 훅이 그대로 돈다 |
| 문구 추첨 | 새 추첨 방식 | `resolveNight` 의 "직전 번호를 뺀 오름차순 후보에서 `randInt`" [VERIFIED: night.ts:138-140] | 연속 반복 없음이 검증된 패턴 |
| 집계 수 방송용 새 채널 | 별도 이벤트 프레임 | 기존 `state` 프레임(`broadcast`) 의 `day.execTally` | 재접속·순서 어긋남 없이 복원되고 누출 전수 검사가 한 곳을 본다 |

**Key insight:** 이 페이즈의 거의 모든 문제는 3페이즈(밤)에서 풀린 문제의 변형이다(숨은 선택 수집 → 한 번에 판정 → 공개). 새 요소는 "익명 집계 방송" 하나뿐이며, 이것도 새 채널 없이 기존 state 프레임에 파생 값 하나를 얹는 것으로 끝낸다.

## 투표 규칙표 (구현·테스트의 단일 기준)

| 상황 | 결과 | 근거 |
|------|------|------|
| 여부: 던진 표 0 | 통과 아님 → 밤 | D-04 |
| 여부: `찬성 × 2 > 던진 표` | 통과 → 후보 선택 | D-02 (과반 = 절반 **초과**) |
| 여부: 찬성 = 반대(동률) / 찬성 < 반대 | 통과 아님 → 밤 | D-02 "같거나 적으면" |
| 여부: 던진 표 1(찬성) | 통과 (1×2 > 1) | D-02·D-04의 귀결 — Pitfall 3 |
| 여부: 마감 전 번복 | 마지막 선택만 유효, 집계 수는 즉시 바뀌어 전원에게 방송 | D-02 |
| 여부: 같은 값 재전송 | 상태 불변, 저장·전송 없음 | `pickTarget` 선례 |
| 여부: 마감 뒤 도착 | `WRONG_PHASE`, 보낸 소켓에만 error + 최신 state | `advance(now)` 선행 tick |
| 후보: 던진 표 0 | 후보 없음 → 밤 (공개 구간은 거침) | D-04·D-28 |
| 후보: 최다 득표자 1명 | 그 사람이 후보 | D-03 |
| 후보: 최다 득표 동률 | 후보 없음 → 공개 뒤 밤 (무작위 결정 **하지 않는다**) | D-03·D-25 |
| 후보: 자기 자신 선택 | `BAD_MESSAGE`, 상태 불변 | D-03 |
| 후보: 탈락자/없는 seat/비정수 | `BAD_MESSAGE` | `pickTarget` 선례 |
| 투표자가 탈락자 | `BAD_MESSAGE` | `pickTarget` 선례 |
| 틀린 단계(마감 뒤 포함) | `WRONG_PHASE` | 위 |
| 투표 후 연결 끊김 | 던진 표는 **유효** | D-05 는 "마감까지 못 보낸 표"만 무효 |
| 생존자 수(승패 계산) | 연결 여부와 무관하게 센다 | D-05 |

## Common Pitfalls

### Pitfall 1: 과반 분모를 생존자 수로 계산
**What goes wrong:** 4명 중 2명만 던졌는데 `찬성 2 > 4/2` 로 계산하면 통과가 안 되어 D-04 와 어긋난다.
**How to avoid:** 분모는 던진 표(`yes + no`). 테스트: (생존 5, 던진 2, 찬성 2) → 통과 / (생존 5, 던진 4, 찬성 2) → 통과 아님.

### Pitfall 2: 미투표자를 반대로 취급
**What goes wrong:** `execVote !== true` 를 반대로 센다 → 무효표가 반대표가 된다.
**How to avoid:** `undefined` 는 어느 쪽에도 세지 않는다. `=== true`/`=== false` 를 따로 센다. 실시간 `execTally` 도 같은 함수(`execTallyOf`)를 쓴다 — **실시간 집계와 마감 집계가 다른 코드면 화면에 보이던 수와 결과가 어긋난다.**

### Pitfall 3: 1표 통과/1표 처형 — 잠금 결정의 귀결
**What goes wrong:** 다른 모든 생존자가 연결이 끊기거나 늦으면 단 한 명의 찬성(여부)·한 명의 선택(후보)으로 처형이 확정된다. 버그가 아니라 D-02~D-04 의 귀결이다.
**How to avoid:** 테스트로 **의도된 동작으로 고정**한다. 정족수를 원하면 `resolveExecVote`/`tallyCandidateVote` 한 곳과 이 표만 고친다(결정 0036 에 "바뀔 수 있는 기본값"으로 적는다).

### Pitfall 4: 후보 동률 처리를 밤 지목처럼 무작위로
`resolveNight` 를 복사하면 동률에서 `randInt` 로 하나를 고른다. 후보 선택은 동률이면 **처형 없음**(D-03). `tallyCandidateVote` 는 `leaders.length === 1` 일 때만 후보, 난수 없음(셔플 제외).

### Pitfall 5: 자기 선택 검사 누락/순서
서버가 방어선이다(`night.ts` 마피아 동료 선택 주석 선례). `target === actor.seat` → `BAD_MESSAGE`. 유닛 + 소켓 테스트 둘 다.

### Pitfall 6: 마감 경계 레이스 — 늦은/중복 투표
`webSocketMessage` 가 `await this.advance(Date.now())` 로 먼저 `tick` 을 돌린다 [VERIFIED: worker/room.ts:179-180 "모든 진입점은 먼저 만료 확인과 tick 을 거친다"]. 마감 이후 도착은 단계가 이미 바뀌어 `WRONG_PHASE`. 여부 투표는 마감 훅이 집계하므로 **마감 직후 도착한 번복은 집계에 들어가지 않는다**(순서 보장). 소켓 테스트: `forceDue` 로 마감을 과거로 당긴 뒤 투표 → `WRONG_PHASE` + 최신 state, 집계는 직전 값 그대로.

### Pitfall 7: 두 투표의 수신자를 섞음
**What goes wrong:** (a) `execVote` 를 `sendViewTo([voter])` 로 보내면 다른 사람의 "실시간 집계"가 갱신되지 않아 D-02 위반. (b) `candidateVote` 를 `broadcast` 로 보내면 후보 선택 타이밍이 흘러 D-19("남의 선택은 보이지 않는다")가 깨진다.
**How to avoid:** Pattern 3 의 표대로 두 `apply*` 본체를 분리하고, 소켓 테스트에서 `execVote` 는 "모든 소켓 프레임 수 +1", `candidateVote` 는 "투표자 외 프레임 수 불변"을 각각 단언한다.

### Pitfall 8: `DAY_PHASES` 누락 → 새 단계에서 `view.day` 소멸
위 Pattern 4. 타입이 못 잡는다. 유닛 테스트: 모든 새 단계에서 `view.day !== undefined`(`ended` 는 의도대로).

### Pitfall 9: 처형 발표와 직업 노출
`ExecutionView` 는 `{seat, phrase}` 만. 누출 테스트: `execution` 이후 `ended` 전까지 **살아 있는 소켓**의 모든 프레임에서 직업 문자열이 허용 경로(`me.role`, `day.roles[]`, `day.claimLog[].claim`) 밖에 없음. 탈락한 처형자 본인 소켓은 `execution` 진입 프레임부터 `spectate`(결정 0021)로 직업을 받는다 — 정상.

### Pitfall 10: `ended` 이후 직업 공개가 `ROLE_WORDS` 검사와 충돌
`test/worker/leak.test.ts` 는 역할 단어가 허용 경로 밖에 나오면 실패한다 [VERIFIED: leak.test.ts:59-61, 355-359]:
```
const ROLE_WORDS = new Set(["mafia", "police", "doctor", "citizen", "none"]);
const ROLE_PATHS_ALIVE = [".view.me.role", ".view.day.roles[]", ".view.day.claimLog[].claim"];
```
`result.seats[].job` 은 **`ended` 프레임에 한해** 살아 있는 소켓에도 허용해야 한다. (a) `winner` 값을 `"citizenWin"|"mafiaWin"` 로 정하고, (b) 누출 테스트의 허용 경로를 phase 별로 확장하되 **`ended` 이전 프레임은 기존 집합 그대로** 유지한다. `FORBIDDEN_KEYS`(`id` 등)와 "`role` 키는 `view.me.role` 에만" 불변식 때문에 키 이름은 `job`·`winner`·`summary` [VERIFIED: leak.test.ts:27, 231].

### Pitfall 11: 아침 문구 번호 이동 + 하드코딩된 8
`MORNING_PHRASE_COUNT` 를 8→7 로 줄이고 `ELIMINATION_TAILS` 의 첫 항목을 빼면 번호 1..7 이 한 칸씩 당겨진다. 단위 테스트는 대부분 `MORNING_PHRASE_COUNT` 로 파라미터화돼 있지만 **`test/worker/leak.test.ts` 405행은 `<= 8` 을 하드코딩**했고 `morning.test.tsx`·`phaseScreens.test.tsx` 는 "이슬이" 를 직접 단언한다. 아침 묶음 축소는 **하나의 원자 작업**(protocol 상수 + `eliminationText.ts` + 테스트 4개 + `night-v1/SPEC.md`)으로 묶는다. 열린 방의 옛 번들과의 번호 어긋남은 최대 3시간·무해(`eliminationTitle` 은 범위 밖 번호를 첫 문구로 대체 [VERIFIED: src/game/eliminationText.ts:19-24]). 현재 값 [VERIFIED: src/game/eliminationText.ts:8-17]:
```
export const ELIMINATION_TAILS = [
  "이슬이 되어 사라졌습니다",
  "조용히 눈을 감았습니다",
  ...
```
처형 문구는 아침과 같은 구조(꼬리 문장 배열) `EXECUTION_TAILS`: "더는 함께할 수 없게 되었습니다", "형장의 이슬이 되었습니다", "잔혹하게 처형되었습니다", "처형대에 올랐습니다". 길이 = `EXECUTION_PHRASE_COUNT` 를 단위 테스트가 단언(`eliminationText.test.ts` 선례).

### Pitfall 12: `stateAt()` 류 테스트 헬퍼가 새 단계에 못 닿는다
`view.test.ts` 등의 `stateAt(phase)` 는 `startGame` 후 `tick` 으로 마감을 따라간다 [VERIFIED: test/unit/view.test.ts:30-41]. 투표가 없으면 `execVote` 마감에서 바로 `night` 로 가므로 `candidateVote`·`candidateVoteReveal`·`defense`·`execution` 에 **도달할 수 없다**. `PHASES` 목록(`view.test.ts` 18-27행, `scenes.test.ts` 34행 `Object.keys(PHASE_DEFS)`)도 단계 수에 의존한다.
**How to avoid:** 투표를 주입하는 도우미 `stateWithVerdict(n, seed, phase, { passed, candidate })`를 새 파일에서 만든다. 4~8명 × 3시드 전수 루프는 새 단계 포함으로 PHASES 를 확장한다.

### Pitfall 13: 기존 테스트가 "discussion → night" 직결을 단언
`tick.test.ts`(단계 수 `8:`→`14:`, 69·120행, 141~169행 마감 시각 연쇄 `T + 159_000` 등: 이제 discussion → `execVote`(+10s) → night), `test/worker/alarm.test.ts`(steps 표), `testTools.test.ts`(`PHASE_DEFS[phase].next!` 로 한 단계 넘기기 — 분기 단계에서 기대 `next` 가 달라진다: `execVote`·`candidateVoteReveal`·`execution`·`morning` 은 통과/미통과 케이스로 나눠 단언), `smoke.mjs`(`discussion: ["night"]`, 640~642행), `uat-test-room.mjs`(179행)가 깨진다. 계획에 **"기존 단언 갱신" 작업을 명시**한다(회귀가 아니라 의도된 변경).

### Pitfall 14: 서버만 배포하면 `연결 중…` (D-26)
`renderPhase` 의 `switch` 는 `default: return connecting()` 이라 새 단계를 모르는 클라이언트는 `연결 중…` 을 그린다 [VERIFIED: src/screens/RoomScreen.tsx renderPhase 의 switch 와 `default`]. D-26 에 따라 **이번 계획은 서버·공유 로직 웨이브까지이며 배포하지 않는다**(`npm run deploy` 는 수동 [VERIFIED: package.json "deploy": "vite build && wrangler deploy"]). 화면 웨이브가 새 단계 화면(또는 최소 폴백)을 갖춘 뒤 한 단위로 배포한다.

### Pitfall 15: `switch` 가 exhaustive 하지 않아 새 메시지/행동이 조용히 무시됨
`webSocketMessage` 의 `switch (msg.t)` 와 `actAsBot` 의 `switch (act.t)` 에는 `default`/`never` 검사가 없다 [VERIFIED: worker/room.ts:182-222, 435-451]. 새 `ClientMessage` 변형을 스키마에만 더하고 `case` 를 빼면 컴파일은 통과하고 런타임에 무시된다. `ClientMessageSchema satisfies z.ZodType<ClientMessage>` 는 반대 방향만 잡는다.
**How to avoid:** 두 switch 끝에 `default: { const _never: never = msg; return; }` 를 더하고, 소켓 테스트가 새 메시지마다 "수락됨" 케이스를 하나씩 갖는다.

### Pitfall 16: `say` 의 `when` 판정이 이분법
현재 `when !== (state.phase === "night" ? "night" : "day")` [VERIFIED: shared/game/chat.ts:83]. 변론 템플릿을 `when: "defense"` 로 두면 `night → "night"`, `defense → "defense"`, 그 외 `"day"` 로 일반화해야 한다. `QUICK_TEMPLATES` 와 `TEMPLATE_CHIP: Record<TemplateId, string>` 이 새 ID 를 컴파일 시점에 강제하므로 `messageText` 의 `switch`(`default` 없음)와 칩 문구도 함께 고친다. `DEFENSE_TEMPLATE_ORDER` 는 칩 목록이라 UI 웨이브.

### Pitfall 17: 변론은 후보만 — 오류 코드 규칙
`senderOf` [VERIFIED: chat.ts:50-59]:
```
const SAY_PHASES: ReadonlySet<PhaseId> = new Set<PhaseId>(["discussion", "night"]);
const EMOTE_PHASES: ReadonlySet<PhaseId> = new Set<PhaseId>(["claim", "discussion", "night"]);
```
제안: 두 집합에 `execVote`·`candidateVote`·`defense` 를 더한다. `defense` 의 `say` 에서 보낸 사람이 후보가 아니면 `WRONG_PHASE`(밤 비마피아와 같은 규칙, 결정 0020-7), 후보가 아닌 사람의 `emoji` 는 통과. `candidateVoteReveal`·`execution`·`ended` 는 어느 집합에도 넣지 않는다(→ `WRONG_PHASE`, D-13). 변론 템플릿은 `defense` 에서만, 낮 템플릿은 `defense` 에서 `BAD_MESSAGE`. 공개 구간 4초 동안의 메시지는 D-12 가 명시하지 않았다 — 거부가 가장 단순하다(A3).

### Pitfall 18: 방 정리 — 결과 화면 도중 소켓이 닫힘
`advance` 는 `now >= expiresAt` 이면 모든 소켓을 `room_closed`(4003)로 닫고 저장소를 지운다 [VERIFIED: worker/room.ts:542-553]. D-28 의 30분 정리(`expiresAt = min(기존, at + ENDED_ROOM_TTL_MS)`)는 충분히 넉넉하지만, 그 시점에 결과 화면을 보던 사람은 `App.tsx` 의 `room_closed` → 오류 화면으로 간다. 화면 웨이브에서 `ended` 중 `room_closed` 를 홈 복귀로 처리할지 검토한다.

### Pitfall 19: 승패 계산에 역할이 없는 상태
`checkWinner` 는 `mafia === 0` 이면 "시민 승"이므로 **역할 미배정 방**(대기실)에서 부르면 거짓 승리가 난다. 호출은 `execution`·`morning` 마감 훅에서만. 순서: 마피아 0 → 시민 승, 그다음 마피아 ≥ 나머지 생존자 → 마피아 승(END-01).

### Pitfall 20: 봇이 투표하지 않아 테스트 방 한 판이 처형에 닿지 않음
`planFor` 는 `claim`·`discussion`·`night` 만 다룬다 [VERIFIED: shared/game/bots.ts:119-144], `botPlanKey` 도 세 단계만 키를 돌려준다 [VERIFIED: bots.ts:106-110]. 계획: `execVote`·`candidateVote`·`defense` 키 추가, `BotAct` 에 `execVote`/`candidateVote` 변형, `actAsBot` 에 case, `skipPhase` 의 `botsPickNow` 처럼 **투표 단계를 당겨 넘길 때 아직 안 던진 봇이 지금 던지게** 하는 `botsVoteNow`(없으면 `testSkip` 이 항상 무효 처리로 넘어간다). 봇의 여부 투표는 사람과 같은 `applyExecVote`(전원 방송)를 지난다 — 봇 때문에 방송 빈도가 늘 수 있다. 난수 호출은 새 단계 분기 안에서만(기존 시드 테스트 계약 보존). `scripts/bots.mjs`(실제 WS 봇)도 같은 단계에 투표하도록 갱신.

### Pitfall 21: 옛 저장 방과 새 필드
새 필드는 전부 optional 이고 읽는 쪽이 기본값을 쥔다(`voteLog ?? []`). 배포 순간 `discussion`/`night`/`morning` 에 있던 방은 새 분기로 자연스럽게 이어진다(별도 `normalizeStoredRoom` 항목 불필요). `normalizeStoredRoom` 의 "해당 없으면 같은 객체" 동일성 계약은 건드리지 않는다 [VERIFIED: room.ts:283-301 주석].

### Pitfall 22: 개인 여부 표를 마감 뒤에도 서버에 남김
익명 약속(D-02 "마감 뒤에도 개인별 공개는 없다")은 현재 뷰 코드가 아니라 **데이터가 없다는 사실**로 지키는 것이 가장 견고하다. `resolveExecVote` 가 집계 후 모든 플레이어의 `execVote` 를 키째 지우고(`const { execVote: _v, ...kept } = p`), 단위 테스트가 "마감 뒤 어떤 플레이어도 `execVote` 키를 갖지 않는다"를 단언한다. 같은 이유로 판 요약(`buildSummary`)이 `Player` 를 펼쳐 복사하지 않게 한다(허용 목록 리터럴).

### Pitfall 23: 번복 연타에 의한 방송 증폭
`execVote` 수락마다 모든 소켓에 프레임이 간다. 한 클라이언트가 20msg/s 로 찬성↔반대를 뒤집으면 최대 약 20 × N 프레임/s. 연결당 한도(`RATE_MAX_MESSAGES = 20`)가 상한이고 같은 값은 무전송이라 실질 위험은 작다 — 수용하고(A8) 소켓 테스트로 "20번 번복해도 마지막 값이 유효하고 서버가 안정"만 확인한다. 문제가 생기면 번복마다 최소 간격을 두거나 방송을 합치는 것은 `applyExecVote` 한 곳의 변경이다.

## Code Examples

### 집계 (규칙표를 그대로 코드로)
```ts
// 제안 — shared/game/vote.ts. 순수: 시각·전역 난수 없음, 입력 불변.
/** 실시간 집계(view.day.execTally)와 마감 집계(resolveExecVote)가 같은 함수를 쓴다 — 보이던 수와 결과가 어긋나지 않게. */
export function execTallyOf(state: RoomState): { yes: number; no: number } {
  let yes = 0;
  let no = 0;
  for (const p of state.players) {
    if (!isAlive(p) || p.execVote === undefined) continue; // 무효표(못 보냄)는 어느 쪽에도 세지 않는다
    if (p.execVote) yes += 1;
    else no += 1;
  }
  return { yes, no };
}

/** ON_DEADLINE.execVote: 집계 → voteLog 한 줄 → verdict → 개인 표 삭제(익명) → 분기. 난수 없음. */
export function resolveExecVote(state: RoomState): { state: RoomState; stay: boolean; next?: PhaseId } {
  const { yes, no } = execTallyOf(state);
  const passed = yes + no > 0 && yes * 2 > yes + no; // 분모 = 던진 표
  const players = state.players.map((p) => {
    const { execVote: _dropped, ...kept } = p;
    return kept;
  });
  const entry: VoteLogEntry = { n: state.day ?? 1, exec: { yes, no, passed } };
  const next: RoomState = { ...state, players, verdict: { passed }, voteLog: [...(state.voteLog ?? []), entry] };
  return passed ? { state: next, stay: false } : { state: next, stay: false, next: "night" };
}

export function tallyCandidateVote(state: RoomState): { votes: CandidateVoteLine[]; candidate?: number } {
  const votes: CandidateVoteLine[] = [];
  const count = new Map<number, number>();
  for (const p of [...state.players].sort((a, b) => a.seat - b.seat)) {
    if (!isAlive(p) || p.candidateVote === undefined) continue;
    votes.push({ seat: p.seat, target: p.candidateVote });
    count.set(p.candidateVote, (count.get(p.candidateVote) ?? 0) + 1);
  }
  const top = Math.max(0, ...count.values());
  const leaders = [...count].filter(([, c]) => c === top && top > 0).map(([seat]) => seat);
  return leaders.length === 1 ? { votes, candidate: leaders[0] } : { votes }; // 동률이면 후보 없음(난수 없음)
}
```

### 승패 판정
```ts
// 제안 — shared/game/win.ts. night.ts 처럼 역할을 읽되 팀 문자열 하나만 내보낸다.
export type Winner = "citizen" | "mafia";
export function checkWinner(state: RoomState): Winner | null {
  const living = state.players.filter(isAlive);
  const mafia = living.filter((p) => p.role === "mafia").length;
  if (mafia === 0) return "citizen";
  if (mafia >= living.length - mafia) return "mafia"; // END-01
  return null;
}
```
검증할 표: 4명(마피아1)에서 시민1 탈락 → 1 vs 2 계속 / 시민 2 탈락 → 1 vs 1 마피아 승. 6명(마피아2)에서 시민 2 탈락 → 2 vs 2 마피아 승. 마지막 마피아 처형 → 시민 승. 연결이 끊긴 생존자도 센다(D-05).

### 마감 훅 분기 · 종료 진입
```ts
export function routeAfterExecution(s: RoomState): DeadlineResult {
  return checkWinner(s) !== null ? { state: s, stay: false, next: "ended" } : { state: s, stay: false };
}
// routeAfterMorning, routeAfterCandidateVote(후보 없으면 next "night") 도 같은 모양.
export function enterEnded(s: RoomState, _rand: RandInt, at: number): RoomState {
  return { ...s, winner: checkWinner(s) ?? undefined, expiresAt: Math.min(s.expiresAt, at + ENDED_ROOM_TTL_MS) }; // ENDED_ROOM_TTL_MS = 30분(D-28)
}
```
(`winner: undefined` 키 대신 조건부 스프레드로 키를 만들지 않는다 — 실제 구현에서는 `checkWinner` 가 null 일 수 없다.)

### 처형 진입
```ts
export function enterExecution(s: RoomState, randInt: RandInt): RoomState {
  const seat = s.verdict?.candidate;
  if (seat === undefined) return s; // 방어: 도달 불가(후보 없으면 defense 로 오지 않는다)
  const candidates: number[] = [];
  for (let n = 1; n <= EXECUTION_PHRASE_COUNT; n += 1) if (n !== s.lastExecPhrase) candidates.push(n);
  const phrase = candidates[randInt(candidates.length)]!;
  return {
    ...s,
    players: s.players.map((p) => (p.seat === seat ? { ...p, alive: false } : p)),
    execution: { seat, phrase },
    lastExecPhrase: phrase,
  };
}
```

### 뷰: 집계는 전원에게, 내 선택은 내 프레임에만
```ts
// 제안 — view.ts. buildDay: 전원에게 같은 값
if (state.phase === "execVote") day.execTally = execTallyOf(state);
// buildView: 본인에게만 (조건을 채울 때만 키를 만든다)
if (state.phase === "execVote" && isAlive(me) && me.execVote !== undefined) myInfo.voteAgree = me.execVote;
if (state.phase === "candidateVote" && isAlive(me) && me.candidateVote !== undefined) myInfo.voteTarget = me.candidateVote;
```

## 강제 수정 목록 (`PhaseId` 추가가 건드리는 곳)

**타입 오류로 알려 주는 곳** (서버 웨이브가 `typecheck` 를 통과하려면 함께 고쳐야 한다):

| 파일 | 내용 | 비고 |
|------|------|------|
| `shared/game/phases.ts` `PHASE_DEFS` | `Record<PhaseId, PhaseDef>` 행 6개 | |
| `src/game/scenes.ts` `PHASE_SCENE` | `Record<PhaseId, SceneId>` 행 6개 | 제안: `execVote`~`execution` → `verdictDusk`(D-14). `ended` 는 UI-SPEC 이 정한다 — 서버 웨이브에서는 임시값 [VERIFIED: scenes.ts:35-44] |
| `src/components/TestTools.tsx` `TEST_PHASE_LABEL` | `Record<PhaseId, string>` | 아랫줄 라벨 [VERIFIED: TestTools.tsx:19-28] |
| `src/screens/RoomScreen.tsx` `PHASE_ANNOUNCE` | `Record<PhaseId, (view)=>string>` | aria-live 문구 [VERIFIED: RoomScreen.tsx:33-42] |
| `shared/game/chat.ts` `QUICK_TEMPLATES` · `src/game/messageText.ts` `TEMPLATE_CHIP` | `Record<TemplateId, …>` | 변론 템플릿 6행 |
| `test/client/phaseScreens.test.tsx:371` | `Record<PhaseId, true>` | 라벨 키 집합 검사 |

**타입 오류로 알려 주지 않는 곳** (테스트·리뷰로 잡아야 한다):

| 파일 | 내용 |
|------|------|
| `shared/game/view.ts` `DAY_PHASES` | Pitfall 8 |
| `src/screens/RoomScreen.tsx` `renderPhase`·`sceneKey` | Pitfall 14 (D-26: 화면 웨이브와 한 단위) |
| `worker/room.ts` `webSocketMessage`·`actAsBot` switch | Pitfall 15 |
| `src/net/seatFloats.ts` `CHAT_PHASES`·`FLOAT_PHASES` | 투표·변론 단계의 chat/emoji 이벤트(D-12·D-13). 화면 웨이브 |
| `scripts/e2e/lib.mjs` `EXPECTED_SCENE` | `test/unit/scenes.test.ts` 가 `PHASE_SCENE` 과 같음을 단언 [VERIFIED: scenes.test.ts:84-91] — 함께 고친다 |
| `scripts/smoke.mjs` `PHASE_NEXT`(39-48행)·시퀀스 단언(640-642행) | 분기 반영 |
| `scripts/uat-test-room.mjs:179` `PHASE_NEXT` | 동일 |
| `scripts/bots.mjs` | 실제 WS 봇이 투표하도록 |
| `test/unit/scenes.test.ts` "dusk·verdictDusk 는 어떤 단계도 가리키지 않는다" | 의도적으로 뒤집힌다 |
| `src/game/scenes.ts` `PHASE_INTRO` + `test/unit/scenes.test.ts` "두 행뿐" | **화면 웨이브**: D-23·24 인트로 카드 행 추가. 서버 영향 없음 |

`ASSET_VERSION` 은 정적 그림이 바뀔 때만 올린다 — 서버 웨이브·SVG/CSS 연출(화살표·인트로 카드)은 해당 없음. `bg_game_verdict_dusk.webp` 는 이미 존재한다 [VERIFIED: `ls public/backgrounds`].

## 판 요약(summary)과 서버 전용 기록

- `voteLog`(공개)가 낮별 처형 여부·후보의 원천이다. 여부는 `{yes,no,passed}`, 후보는 `cand.candidate`.
- **밤별 암살 결과**: `resolveNight` 가 지금 `eliminated` 만 돌려주고 최종 지목 `target` 은 내보내지 않으므로 `ResolvedNight` 에 `target?: number` 를 더해 `enterMorning` 이 `nightLog`(서버 전용)에 `{ n, target?, died }` 를 쌓게 한다. **난수 호출 순서 계약은 건드리지 않는다**(동률 한 번, 문구 한 번) [VERIFIED: night.ts:81].
- D-27: 종료 요약에는 "의사가 지켰다"(`target` 있음 + `died:false`)도 보인다. `nightLog` 는 **판 종료 전에는 어떤 뷰에도 실리지 않는다**(게임 중에는 의사 구출이 지목 없음과 구별되지 않아야 한다, 결정 0020-3). `buildSummary(state)` 는 `ended` 단계에서만 불리고 `RoomView.result.summary` 로만 나간다.
- 일차 정렬: 같은 `n` 의 낮 투표 → 그날 밤 결과 순으로 한 줄(`SummaryRow`). 아침에 종료되는 판의 마지막 날은 `exec` 없는 줄일 수 있다.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| 후보 선택 20초 → 변론 20초 → 찬반 10초 → 처형 5초 | 여부(10, 익명·실시간 집계) → 후보(15+4 공개) → 변론 10 → 처형 5, 변론 뒤 찬반 없음 | 결정 0034 + D-02/D-21/D-25 | 요구사항·ROADMAP·product.md 갱신됨. **CONN-02 문장만 옛 표현** → D-28 이 고치라고 확정(계획에 문서 작업 포함) |
| `discussion → night` 임시 직결(결정 0016-2/0020-1) | `discussion → execVote …` | 이 페이즈 | `phases.ts` 주석 해소 |
| "4페이즈 전에는 승패가 없어 판이 끝나지 않는 것이 의도"(결정 0020-10) | 처형·아침 직후 승패 판정 | 이 페이즈 | "시민이 다 죽어도 계속 돈다"류 단언이 있다면 의도된 변경으로 갱신 |
| 투표 공개 "마감 시 한꺼번에"(product.md 옛 문구) / D-07 옛 "2~3초" | 후보 선택만 별도 4초 구간에서 개인별 공개, 여부는 익명(D-07 개정) | D-02/D-07/D-21 | 옛 충돌(A2)은 해소됨 |
| 진행 중 선택은 항상 본인에게만(밤 `pick`, 후보 선택) | 여부 투표만 집계 수 전원 방송 | D-02 | 새 수신자 규칙 — 누출 분석·차분 테스트 필요 |

**Deprecated/outdated:**
- 옛 화면설계서 보드 07·08·10: 옛 순서·기권 버튼 기준, 레이아웃 참고용만.
- `claimReveal` 같은 옛 단계 이름은 `normalizeStoredRoom` 한 곳에만 남아 있다 — 새 단계에 같은 문자열을 재사용하지 않는다.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A3 | `candidateVoteReveal` 과 처형 중에는 메시지·이모티콘을 모두 거부한다 | Pitfall 17 | D-12 는 "여부·후보 선택 단계"만, D-13 은 "처형 중 아무도 못 보냄"만 명시. 공개 구간에 이모티콘을 허용하려면 `EMOTE_PHASES` 에 한 단계를 더하면 된다(쉬운 변경) |
| A7 | 진행 중 후보 선택은 탈락 관전자에게도 보내지 않고, 여부 투표의 개인 선택은 관전자에게도 없다(집계 수는 전원) | Pattern 3·누출 분석 | 관전자에게 보여 주려면 수신자·`spectate` 필드 추가. 여부는 D-02("아무도 알 수 없다")상 불가 |
| A8 | `execVote` 번복마다 즉시 전원 방송(합치기·최소 간격 없음). 연결당 20msg/s 한도와 무전송 규칙으로 충분하다 | Pitfall 23 | 증폭이 문제면 `applyExecVote` 한 곳에서 간격을 둔다 |
| A9 | 단계·메시지·필드 이름(`execVote`, `candidateVote`, `candidateVoteReveal`, `voteAgree`, `voteTarget`, `execTally`, `result`, `ended` 등)은 CONTEXT 재량 영역에서 내가 제안한 것이다 | 와이어 | 이름은 바꿔도 구조는 그대로. 결정 0036 에서 한 번에 확정 |
| A10 | 한 낮에 `voteLog` 는 한 줄이고 후보 선택이 없으면 `cand` 키가 없다 | 와이어 | 화면이 읽는 모양 — UI-SPEC 단계에서 필요하면 평탄화 |
| A11 | 변론 템플릿 ID 를 `def*` 6개 신설(기존 `innocent` 재사용 안 함) | 와이어 | `when` 을 집합으로 바꾸면 재사용 가능하나 `QUICK_TEMPLATES` 타입이 바뀐다 |
| A12 | 여부 투표 개인 표는 마감 훅에서 즉시 삭제하고 그 뒤 어디에도 남기지 않는다(요약·로그 포함) | Pitfall 22 | 사용자가 종료 뒤 개인별 공개를 원하면(D-02 는 "마감 뒤에도 개인별 공개는 없다") 별도 결정 필요 |
| A13 | 여부 투표 진행 중 집계 수는 탈락 관전자에게도 같은 값으로 보낸다 | 누출 분석 #2 | 관전자에게 숨기려면 `execTally` 를 생존자 view 에만 둔다(쉬운 변경) |

(이전 판의 A1·A2·A4·A5·A6 은 D-25~D-28 로 확정되어 삭제했다.)

## Open Questions (RESOLVED)

CONTEXT 의 D-25~D-28 로 이전 열린 질문 1~5 는 해결됐다:

1. ~~D-07 vs D-21 충돌~~ **해결(D-07 개정, D-21, D-25)**: 후보 선택만 별도 4초 구간. 여부 투표는 공개 구간 없음(익명).
2. ~~서버 웨이브 배포 시점~~ **해결(D-26)**: 이번 계획은 서버·공유 로직까지, 배포 안 함. 화면 웨이브와 한 단위.
3. ~~종료 요약의 비공개 밤 정보 공개 범위~~ **해결(D-27)**: "의사가 지켰다"까지 종료 뒤 공개. 판 중에는 비공개.
4. ~~종료 방 TTL~~ **해결(D-28)**: 30분.
5. ~~조기 종료 없음·0표 공개 구간~~ **해결(D-28)**: 조기 종료 없음, 0표여도 정해진 시간. (여부 투표엔 공개 구간 자체가 없다.)
6. ~~CONN-02 문구 갱신~~ **해결(D-28)**: 계획에 REQUIREMENTS.md 문서 작업 하나를 넣는다("마감까지 못 보낸 투표는 무효표(던진 표에서 제외), 밤 행동은 행동 없음, 직업 공개는 말 안 함").

**남은 항목(사용자 질문 불필요, 계획 단계에서 처리):**
- 단독 1표 처형(Pitfall 3): 잠금 결정의 귀결. 결정 0036 에 "바뀔 수 있는 기본값"으로 명시하고 테스트로 고정. — RESOLVED: 0036 알려진 한계/바뀔 수 있는 기본값(04-03)
- 소규모에서의 산술 추론(누출 분석 #10): 집계 공개의 필연. 결정 0036 에 "알려진 한계"로 기록. — RESOLVED: 0036 알려진 한계/바뀔 수 있는 기본값(04-03)
- A3·A7·A8·A12·A13: 위 Assumptions Log. 계획 확인 시 한 번에 사용자 확인 가능. — RESOLVED: 0036 알려진 한계/바뀔 수 있는 기본값(04-03)

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | 전부 | ✓ | v26.0.0 (`engines` >=22.12) | — |
| npm | 스크립트 | ✓ | 11.12.1 | — |
| vitest 3개 프로젝트 | 검증 | ✓ | 4.1.12 — unit 795 / worker 139 / client 955 통과(이번 세션 실행) | — |
| tsc (앱·워커) | 타입 검사 | ✓ | 7.0.2 — 두 tsconfig 무오류 | — |
| wrangler / workerd | 워커 통합 테스트 | ✓ | 4.151.3 (워커 프로젝트가 실제로 돌았다) | — |
| 시스템 Chrome | E2E(화면 웨이브) | 미확인 | — | 서버 웨이브는 불필요 |
| 배포본 접근 | 스모크 | 불필요 | — | D-26: 이번 웨이브는 배포하지 않는다 |

**Missing dependencies with no fallback:** 없음.
**주의:** `npm run typecheck` 는 `wrangler types`(생성물 `worker-configuration.d.ts` 갱신)와 `tokens:check` 를 먼저 돌리므로 부수 효과가 있다. 빠른 확인은 `npx tsc -p tsconfig.app.json --noEmit && npx tsc -p tsconfig.worker.json --noEmit`(각 약 1초).

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.12 (3개 프로젝트: `unit` node / `client` happy-dom / `worker` workerd) |
| Config file | `/Users/dhkim1522/personal/minifia/vitest.config.ts` |
| Quick run command | `npx vitest run --project unit` (약 2초) 또는 파일 지정 `npx vitest run test/unit/vote.test.ts` |
| Full suite command | `npm test` (= `vitest run` 3개 프로젝트) + `npx tsc -p tsconfig.app.json --noEmit && npx tsc -p tsconfig.worker.json --noEmit` (전체 게이트는 `npm run typecheck`) |
| Worker only | `npx vitest run --project worker` (약 6초) |
| 시드/난수 | `test/helpers/seededRandom.ts` `seededRandInt(seed)` (mulberry32) — 서버는 `cryptoRandInt` 주입 [VERIFIED: seededRandom.ts, worker/random.ts] |
| 기준선(이번 세션) | unit 795, worker 139, client 955 전부 통과 |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VOTE-01 | 과반=찬성×2>던진 표, 0표·동률·반대 → 밤, 무효표 분모 제외, 1표 통과, **번복 시 마지막 값 유효**, 같은 값 불변, 마감 후 WRONG_PHASE, `execTallyOf` = 마감 집계, **마감 뒤 `execVote` 키 부재(익명)** | unit | `npx vitest run test/unit/vote.test.ts` | ❌ Wave 0 |
| VOTE-01 (방송) | 수락·변경마다 **모든 소켓**이 state 수신(집계 수 갱신), 같은 값은 무전송, 거부는 발신자에게만, 20회 번복 안정 | worker | `npx vitest run --project worker test/worker/vote.test.ts` | ❌ Wave 0 |
| VOTE-02 | 최다 득표=후보, 동률·0표 → 공개 뒤 밤(난수 미사용), 자기 선택 BAD_MESSAGE, 탈락자/범위 밖 BAD_MESSAGE, `votes[]` 셔플(시드 재현·호출 순서·n≤1 무호출), 후보 선택은 **투표자 외 프레임 불변** | unit + worker | `npx vitest run test/unit/vote.test.ts test/unit/execution.test.ts` / `--project worker test/worker/vote.test.ts` | ❌ Wave 0 |
| VOTE-03 | 변론 `say` 는 후보만(비후보 WRONG_PHASE), 변론 템플릿은 defense 에서만·낮 템플릿은 defense 에서 BAD_MESSAGE, 비후보 emoji 통과, 쿨다운 합산 | unit | `npx vitest run test/unit/chat.test.ts` | ✅ 확장 |
| VOTE-04 | `enterExecution`: 후보 alive=false·문구 4종 중 직전 제외·`day.execution` 에 직업 없음, `voteLog` 누적(여부 집계 수만) | unit | `npx vitest run test/unit/execution.test.ts test/unit/view.test.ts` | ❌ Wave 0 / ✅ 확장 |
| COMM-03 | (VOTE-03 과 같은 파일) + 소켓 단위 변론 프레임 수신 범위 | unit + worker | `npx vitest run test/unit/chat.test.ts && npx vitest run --project worker test/worker/vote.test.ts` | ✅ / ❌ Wave 0 |
| CONN-02 | 전원 끊김에도 tick 이 투표 단계를 따라 `night` 까지 진행, 끊긴 투표자의 던진 표는 유효·못 던진 표는 무효, 승패 분모에 끊긴 생존자 포함 | unit | `npx vitest run test/unit/tick.test.ts test/unit/win.test.ts` | ✅ 확장 / ❌ Wave 0 |
| END-01 | `checkWinner` 표(4~8명), `execution`·`morning` 마감에서 `ended` 분기, 아침 5초 후 종료(진입 시 즉시 종료 아님) | unit | `npx vitest run test/unit/win.test.ts test/unit/tick.test.ts` | ❌ Wave 0 / ✅ 확장 |
| END-02 | `ended` 에서 `result` 전원에게, 이전 단계에는 없음, `expiresAt` 단축·알람(30분), 홈 복귀 | unit + worker | `npx vitest run test/unit/view.test.ts && npx vitest run --project worker test/worker/endgame.test.ts` | ✅ 확장 / ❌ Wave 0 |
| 누출(전 요구사항) | **차분 테스트(익명)**, 진행 중 후보 선택은 본인에게만, 마감 뒤 voteLog(여부=집계 수만) 공개, 처형자 직업 `ended` 전 비공개, `result` ended 에만, 서버 전용 키 부재 | unit(4~8명×시드 전수) + worker(실제 프레임) | `npx vitest run test/unit/view.test.ts && npx vitest run --project worker test/worker/leak.test.ts` | ✅ 확장 |

### Sampling Rate
- **Per task commit:** `npx vitest run --project unit` (+ 만진 파일 개별 실행). 와이어/뷰를 만졌으면 두 `tsc --noEmit` 추가.
- **Per wave merge:** `npm test` + 두 tsc.
- **Phase gate:** `npm test` 전부 + `npm run typecheck` 통과 후 `/gsd-verify-work`. 배포본 스모크·UAT·E2E 는 화면 웨이브 후 배포 시점(D-26).

### Wave 0 Gaps (새로 만들 테스트 파일 — TDD: 규칙·누출 먼저)
- [ ] `test/unit/vote.test.ts` — `castExecVote`/`castCandidateVote` 검사 순서·번복, `execTallyOf`, `resolveExecVote`(개인 표 삭제·분기), `tallyCandidateVote`, 셔플·난수 호출 순서
- [ ] `test/unit/win.test.ts` — `checkWinner` 4~8명 경계표, 끊긴 생존자 포함
- [ ] `test/unit/execution.test.ts` — 진입 훅들(`enterExecVote` 청소, `enterCandidateVoteReveal`, `enterExecution`, `enterEnded` winner·TTL), 마감 분기 `route*`, `buildSummary`(D-27 "지켰다" 포함)
- [ ] `test/worker/vote.test.ts` — 소켓: `execVote` 전원 방송 vs `candidateVote` 투표자 전용, 거부 코드별 프레임, 마감 후 `WRONG_PHASE`, 자기 선택 거부, 관찰자 프레임 동일성(A 가 던질 때 vs B 가 던질 때), 변론 수신 범위
- [ ] `test/worker/endgame.test.ts` — 처형으로 종료 / 아침으로 종료(5초 후), `ended` 의 `result`, 종료 방 알람, `testReset` 소거
- [ ] 도우미: 투표 주입 `stateWithVerdict()` (Pitfall 12)
- [ ] **확장(갱신) 대상**: `tick.test.ts`, `chat.test.ts`, `view.test.ts`(PHASES·허용 키 전수·새 단계 `day` 존재·**차분 테스트**), `bots.test.ts`·`test/worker/bots.test.ts`, `testTools.test.ts`(분기 단계 케이스·`botsVoteNow`), `gameRoom.test.ts`, `scenes.test.ts`, `eliminationText.test.ts`, `test/worker/alarm.test.ts`, `test/worker/leak.test.ts`
- [ ] 프레임워크 설치: 없음

**누출 테스트 설계 메모(필수, D-17·D-02):** 기존 `leak.test.ts` 는 6명·두 밤 시나리오다. 처형 경로를 더한 한 판(1일차 여부 통과·후보 선택·변론·처형으로 시민 1명 탈락 → 밤 → 아침 → 2일차 처형으로 마피아 전원 탈락 → `ended`)을 돌려 (1) **여부 투표 개인 정보 부재**: 모든 프레임의 모든 경로에서 `voteAgree` 는 `.view.me.voteAgree` 에만, 같은 프레임 스트림에 `voted`·`votes`(여부)·개인별 `agree` 키 없음, `day.voteLog[].exec` 의 키는 정확히 `["no","passed","yes"]`, (2) 여부 투표 중 다른 소켓의 `execTally` 가 모두 같고 본인 외 `me.voteAgree` 가 없음, (3) 후보 선택 진행 중에는 투표자 외 소켓에 state 가 가지 않음, (4) 공개 구간부터 `day.voteLog[].cand.votes` 가 모든 소켓에 같게 실림, (5) 살아 있는 소켓은 `ended` 직전까지 처형자 직업 문자열을 허용 경로 밖에서 받지 않음, (6) `ended` 프레임에서만 `.view.result.*` 가 존재하고 그때 허용 경로에 `.view.result.seats[].job` 추가, (7) 서버 전용 키 목록(`SERVER_ONLY_KEYS`)에 `execVote`·`candidateVote`·`verdict`·`nightLog`·`winner`·`lastExecPhrase` 를 더해 어떤 프레임에도 없음을 단언한다. 시나리오가 두 종료 경로(처형·아침)를 모두 덮도록 변형 하나를 `endgame.test.ts` 에 둔다.

## Security Domain

### Applicable ASVS Categories (ASVS L1, `security_enforcement: true`)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (변경 없음) | 기존 토큰 hello |
| V3 Session Management | 간접 | 신원은 소켓 첨부 `playerId`. 메시지에서 seat·playerId 를 읽지 않는다 |
| V4 Access Control | **yes** | 투표 권한 = 방에 있는 생존자. 변론 권한 = 후보 본인. 개인 선택은 본인에게만, 종료 전 직업은 받을 권한이 있는 소켓에만, 여부 투표는 개인별 정보를 **누구에게도** 보내지 않음 |
| V5 Input Validation | **yes** | `z.strictObject` — `agree: z.boolean()`, `target: z.number().int().min(0).max(7)`; 의미 검사는 순수 규칙 함수 |
| V6 Cryptography | no (난수) | 후보 선택 공개 순서·문구는 `cryptoRandInt`(워커 주입) |
| V7 Error handling & logging | 간접 | 기존 오류 코드 재사용(`WRONG_PHASE`/`BAD_MESSAGE`/`RATE_LIMITED`). 로그에 토큰·역할·투표 내용 없음 |

### Known Threat Patterns for 이 스택(DO + WebSocket + 허용 목록 뷰)

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| 위조 투표(남의 seat 로 투표) | Spoofing | 메시지에 seat 없음, 소켓 첨부 `playerId` 로만 행위자 결정 |
| 이중/지연 투표, 마감 뒤 투표 | Tampering | `advance` 선행 `tick` + 단계 검사 `WRONG_PHASE`; 마지막 값만 유효 |
| 자기 선택/탈락자·없는 seat 선택 | Tampering | 서버 규칙 함수가 `BAD_MESSAGE` |
| 여부 투표 익명 깨짐(개인 표 노출·추론) | Information Disclosure | 개인 표는 서버 전용 필드, 마감 훅에서 삭제, 뷰에 집계 수만, 차분 테스트, 로그에 집계 수만 |
| 후보 선택 진행 중 타이밍·내용 누출 | Information Disclosure | `sendViewTo([voter])`, 전원 방송 금지, 프레임 수 불변 테스트 |
| 종료 전 직업/요약 누출(처형자 직업, `nightLog`) | Information Disclosure | `result` 는 `ended` 에서만 키 생성; `nightLog`·`verdict`·`winner` 는 `buildView` 가 읽지 않음; `ROLE_WORDS` 경로 검사 유지 |
| 번복 연타 증폭 | Denial of Service | 같은 값 무전송, 연결당 20msg/s |
| 변론 도배·비후보 발언 | Denial of Service / Elevation | 합산 쿨다운(1.8초), 비후보 `say` `WRONG_PHASE`, 자유 텍스트 없음 |
| 알람 폭주(종료 단계 마감 잔존) | Denial of Service | `ended` 는 `durationMs: null`, 알람은 `expiresAt` 하나 |
| 프로토타입 키로 템플릿 표 우회 | Tampering | `Object.hasOwn(QUICK_TEMPLATES, template)` 기존 방어(`chat.ts:80`) |

## Sources

### Primary (HIGH confidence) — 이 저장소의 코드·문서 (이번 세션에 직접 읽음)
- `shared/game/{phases,tick,room,night,claim,chat,view,bots,testTools,roles,alive,discussion}.ts`; `shared/protocol.ts`, `shared/schemas.ts`
- `worker/room.ts`, `worker/random.ts`; `wrangler.jsonc`, `package.json`, `vitest.config.ts`, `tsconfig.*.json`
- `src/game/{eliminationText,scenes,messageText}.ts`; `src/screens/RoomScreen.tsx`; `src/components/{TestTools,UserRecordSheet}.tsx`; `src/net/{seatFloats,phaseArrival,session}.ts`; `src/App.tsx`
- `test/worker/{leak.test,helpers}.ts`; `test/unit/{tick,view,scenes,testTools}.test.ts`; `test/helpers/seededRandom.ts`; `scripts/{smoke,bots}.mjs`, `scripts/e2e/*.mjs`
- `.planning/phases/04-execution-verdict/04-CONTEXT.md`(D-01~D-28, 최신판 재독), `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`(Phase 4), `docs/decisions/{0016,0020,0021,0027,0034}-*.md`, `docs/product.md`, `HANDOFF.md`, `CLAUDE.md`
- 실행 확인: `npx vitest run --project unit|worker|client`, `npx tsc -p tsconfig.app.json|tsconfig.worker.json --noEmit` (모두 통과)

### Secondary (MEDIUM confidence)
- [CITED: https://developers.cloudflare.com/durable-objects/platform/limits/] SQLite 백엔드 DO 는 "Key and value combined cannot exceed 2 MB", DO 당 저장소 10 GB. 이 저장소는 `exports.Room.storage = "sqlite"` 라 `voteLog`·`nightLog` 누적이 한도에 닿을 위험이 없다.

### Tertiary (LOW confidence)
- 없음 (외부 웹 자료에 의존한 주장 없음; 가정은 Assumptions Log 에 모았다)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — 새 의존성 없음, 설치된 버전·테스트 통과를 직접 실행해 확인
- Architecture: HIGH — 모든 훅·표·뷰 코드를 읽었고 제안은 기존 패턴(night/claim)의 복제다. 단 단계·필드 이름은 제안(A9)
- 누출 분석: MEDIUM-HIGH — 채널 열거는 코드 구조에서 도출했으나 실제 소켓 순서 동일성은 구현 후 차분 테스트로 확인해야 한다
- Pitfalls: HIGH — 대부분 현재 코드의 구체 줄에서 도출

**Research date:** 2026-10-26 (CONTEXT D-23~D-28 반영본)
**Valid until:** 코드가 바뀌지 않는 한 유효. 다음 페이즈 작업 전 `git diff 53ead13 -- shared worker src` 로 변경 여부만 확인하면 된다.
