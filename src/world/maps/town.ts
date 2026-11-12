// 마을 장면 자리(20-04 RED): GREEN 에서 방·집·간판을 만든다.
import type { Budget } from "../renderer";
import { buildPlazaScene } from "./plaza";
import type { MapScene } from "./types";

export function buildTownScene(budget: Budget): MapScene {
  return buildPlazaScene(budget);
}
