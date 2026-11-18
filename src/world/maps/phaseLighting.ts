import { Color, MathUtils } from "three";
import type { LightingPhase } from "../renderer";
import type { PhaseTune } from "./bar";

interface Accent {
  beam: number;
  cone: number;
}

const LEVELS = ["hemi", "moon", "exposure", "stage", "pendant", "self", "beam", "cone"] as const;
type LightFrame = Pick<PhaseTune, Exclude<(typeof LEVELS)[number], keyof Accent> | "emissive" | "glow" | "fog"> & Accent & {
  sky: [Color, Color, Color];
  moonColor: Color;
};

function frameFor(tune: PhaseTune, accent?: Partial<Accent>): LightFrame {
  const { moonColor, sky, albedo: _albedo, ...values } = tune;
  return {
    ...values,
    sky: [new Color(sky[0]), new Color(sky[1]), new Color(sky[2])],
    moonColor: new Color(moonColor),
    beam: accent?.beam ?? 0,
    cone: accent?.cone ?? 0,
  };
}

function copyFrame(from: LightFrame): LightFrame {
  return {
    ...from,
    sky: [from.sky[0].clone(), from.sky[1].clone(), from.sky[2].clone()],
    moonColor: from.moonColor.clone(),
    emissive: { ...from.emissive },
    glow: { ...from.glow },
    fog: { ...from.fog },
  };
}

/** The fade reuses one output frame. Retargeting begins at the values currently on screen. */
export function phaseLighting(tunes: Readonly<Record<LightingPhase, PhaseTune>>, accents: Partial<Record<LightingPhase, Partial<Accent>>> = {}) {
  let current = frameFor(tunes.talk, accents.talk);
  let fade: { from: LightFrame; to: LightFrame; elapsed: number; duration: number } | null = null;

  return {
    get current(): LightFrame { return current; },
    set(phase: LightingPhase, seconds: number): void {
      const to = frameFor(tunes[phase], accents[phase]);
      if (seconds > 0) {
        fade = { from: current, to, elapsed: 0, duration: seconds };
        current = copyFrame(current);
      } else {
        fade = null;
        current = to;
      }
    },
    advance(dt: number): boolean {
      if (fade === null || dt <= 0) return false;
      fade.elapsed += dt;
      const { from, to, elapsed, duration } = fade;
      if (elapsed >= duration) {
        current = to;
        fade = null;
        return true;
      }
      const progress = elapsed / duration;
      const k = progress * progress * (3 - 2 * progress);
      const lerp = MathUtils.lerp;
      for (const key of LEVELS) current[key] = lerp(from[key], to[key], k);
      for (let i = 0; i < current.sky.length; i++) current.sky[i]!.lerpColors(from.sky[i]!, to.sky[i]!, k);
      current.moonColor.lerpColors(from.moonColor, to.moonColor, k);
      current.emissive.room = lerp(from.emissive.room, to.emissive.room, k);
      current.emissive.vote = lerp(from.emissive.vote, to.emissive.vote, k);
      current.glow.room = lerp(from.glow.room, to.glow.room, k);
      current.glow.vote = lerp(from.glow.vote, to.glow.vote, k);
      current.fog.near = lerp(from.fog.near, to.fog.near, k);
      current.fog.far = lerp(from.fog.far, to.fog.far, k);
      return true;
    },
  };
}
