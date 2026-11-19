export const ANIMAL_IDS = [
  "rabbit", "elephant", "crocodile", "penguin", "fox", "pig",
  "lion", "ram", "frog", "parrot", "hedgehog", "bat",
] as const;

export type AnimalId = (typeof ANIMAL_IDS)[number];

export const ANIMALS: Readonly<Record<AnimalId, { name: string; color: string }>> = {
  rabbit: { name: "토끼", color: "#b7a1d8" },
  elephant: { name: "코끼리", color: "#90b6df" },
  crocodile: { name: "악어", color: "#408b7f" },
  penguin: { name: "펭귄", color: "#5f6b86" },
  fox: { name: "여우", color: "#e68e47" },
  pig: { name: "돼지", color: "#efa7bb" },
  lion: { name: "사자", color: "#d6a052" },
  ram: { name: "숫양", color: "#e4d2b6" },
  frog: { name: "개구리", color: "#b3ca5b" },
  parrot: { name: "앵무새", color: "#d35a60" },
  hedgehog: { name: "고슴도치", color: "#a37a61" },
  bat: { name: "박쥐", color: "#746ba9" },
};

/** 동물 값이 없는 구형 데이터에만 쓰는 좌석별 대체 외형. */
export function animalForSeat(seat: number): AnimalId {
  if (!Number.isInteger(seat)) return "rabbit";
  const n = ANIMAL_IDS.length;
  return ANIMAL_IDS[((seat % n) + n) % n]!;
}

export function isAnimalId(value: unknown): value is AnimalId {
  return typeof value === "string" && Object.hasOwn(ANIMALS, value);
}
