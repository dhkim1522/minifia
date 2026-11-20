import { afterEach, beforeEach, expect, it } from "vitest";
import { phaseDurationOf } from "../../shared/game/discussion";
import { FIRST_ANSWER_TURN_MS, PHASE_INTRO_MS, PHASE_INTRO_SWITCH, phaseIntroActive } from "../../shared/game/phases";
import { skipPhase } from "../../shared/game/testTools";
import { tick } from "../../shared/game/tick";
import { buildView } from "../../shared/game/view";
import { openKeyword } from "../helpers/keyword";
import { startedAt } from "../helpers/voteState";
import { seededRandInt } from "../helpers/seededRandom";

let restoreKeyword: () => void;
beforeEach(() => {
  PHASE_INTRO_SWITCH.on = true;
  restoreKeyword = openKeyword();
});
afterEach(() => {
  PHASE_INTRO_SWITCH.on = false;
  restoreKeyword();
});

const random = seededRandInt(23);

it("역할, 라이어, 첫 답안 발표, 토론에서 서버 열림부터 원래 시간을 모두 제공한다", () => {
  const assigning = startedAt(4, 23, "assigning");
  const role = tick(assigning, assigning.phaseEndsAt!, random);
  const keyword = tick(role, role.phaseEndsAt!, random);
  const presentation = tick(keyword, keyword.phaseEndsAt!, random);
  expect([role.phase, keyword.phase, presentation.phase]).toEqual(["roleReveal", "keyword", "dayAnnounce"]);
  for (const [prior, next] of [[assigning, role], [role, keyword], [keyword, presentation]] as const) {
    expect(next.phaseStartsAt).toBe(prior.phaseEndsAt! + PHASE_INTRO_MS);
    expect(next.phaseEndsAt).toBe(next.phaseStartsAt! + phaseDurationOf(next)!);
    expect(phaseIntroActive(next.phaseStartsAt, next.phaseStartsAt! - 1)).toBe(true);
    expect(phaseIntroActive(next.phaseStartsAt, next.phaseStartsAt!)).toBe(false);
  }

  const second = tick(presentation, presentation.phaseEndsAt!, random);
  expect(second.keywordPresentationIndex).toBe(1);
  expect(second.phaseStartsAt).toBeUndefined();
  expect(second.phaseEndsAt).toBe(presentation.phaseEndsAt! + FIRST_ANSWER_TURN_MS);
  const discussion = tick(presentation, presentation.phaseEndsAt! + FIRST_ANSWER_TURN_MS * 3, random);
  expect(discussion.phase).toBe("discussion");
  expect(discussion.phaseStartsAt).toBe(presentation.phaseEndsAt! + FIRST_ANSWER_TURN_MS * 3 + PHASE_INTRO_MS);
  expect(discussion.phaseEndsAt).toBe(discussion.phaseStartsAt! + phaseDurationOf(discussion)!);
});

it("조기 테스트 넘김과 늦은 알람도 새 단계의 서버 열림을 한 번 정한다", () => {
  const role = { ...startedAt(4, 23, "roleReveal"), testMode: true as const };
  const now = role.phaseStartsAt! - 50;
  const skipped = skipPhase(role, role.hostId, now, random);
  expect(skipped.ok).toBe(true);
  if (!skipped.ok) return;
  expect(skipped.state.phase).toBe("keyword");
  const startsAt = now + PHASE_INTRO_MS;
  const view = buildView(skipped.state, role.hostId, now);
  const rejoined = buildView(skipped.state, role.hostId, startsAt + 5);
  expect(view.phaseStartsAt).toBe(startsAt);
  expect(rejoined.phaseStartsAt).toBe(startsAt);
  expect(phaseIntroActive(rejoined.phaseStartsAt, rejoined.serverNow)).toBe(false);
  expect(tick(skipped.state, startsAt, random)).toBe(skipped.state);
});

it("전용 공개 연출과 기존 저장 형식에 새 단계 안내 시간을 겹치지 않는다", () => {
  const verdict = startedAt(4, 23, "verdict");
  const answerReveal = tick(verdict, verdict.phaseEndsAt!, random);
  expect(answerReveal.phase).toBe("answerReveal");
  expect(answerReveal.phaseStartsAt).toBeUndefined();
  expect(answerReveal.phaseEndsAt).toBe(verdict.phaseEndsAt! + phaseDurationOf(answerReveal)!);
  const night = tick(answerReveal, answerReveal.phaseEndsAt!, random);
  expect(night.phase).toBe("night");
  expect(night.phaseStartsAt).toBe(answerReveal.phaseEndsAt! + PHASE_INTRO_MS);
  const morning = tick(night, night.phaseEndsAt!, random);
  expect(morning.phase).toBe("morning");
  expect(morning.phaseStartsAt).toBeUndefined();
  expect(phaseIntroActive(undefined, 0)).toBe(false);
});
