import { DataTexture, LinearFilter, LinearMipmapLinearFilter, MeshStandardMaterial, RedFormat, RepeatWrapping } from "three";

/** 부품의 마감은 각 관절의 병합 메시 안에서 정점 속성으로 전달한다. */
export const FINISH = { smooth: 0, felt: 1, cloth: 2, brass: 3 } as const;
export type Finish = (typeof FINISH)[keyof typeof FINISH];

function feltGrain(): DataTexture {
  const size = 64;
  const values = new Uint8Array(size * size);
  let seed = 0x35ac45e1;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      const fibers = Math.cos((x + y) * Math.PI / 4) * Math.cos((x - y) * Math.PI / 4);
      const fleck = (seed & 255) - 128;
      values[y * size + x] = Math.round(128 + 38 * fibers + 0.64 * fleck);
    }
  }
  const texture = new DataTexture(values, size, size, RedFormat);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

const grain = feltGrain();

/** 무광 펠트, 직조 코트와 작은 금속 장식이 같은 조명과 draw call을 공유한다. */
export const animalMaterial = new MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
animalMaterial.onBeforeCompile = (shader) => {
  shader.uniforms.animalGrain = { value: grain };
  shader.vertexShader = shader.vertexShader
    .replace("#include <common>", `#include <common>
      attribute float animalFinish;
      attribute vec2 animalUv;
      varying float vAnimalFinish;
      varying vec2 vAnimalUv;`)
    .replace("#include <begin_vertex>", `#include <begin_vertex>
      vAnimalFinish = animalFinish;
      vAnimalUv = animalUv;`);
  shader.fragmentShader = shader.fragmentShader
    .replace("#include <common>", `#include <common>
      uniform sampler2D animalGrain;
      varying float vAnimalFinish;
      varying vec2 vAnimalUv;`)
    .replace("#include <color_fragment>", `#include <color_fragment>
      float felt = step(0.5, vAnimalFinish) - step(1.5, vAnimalFinish);
      float cloth = step(1.5, vAnimalFinish) - step(2.5, vAnimalFinish);
      float brass = step(2.5, vAnimalFinish);
      float grain = texture2D(animalGrain, vAnimalUv).r - 0.50;
      diffuseColor.rgb *= 1.0 + grain * (0.24 * felt + 0.46 * cloth);`)
    .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>
      roughnessFactor = clamp(0.41 + 0.39 * felt + 0.45 * cloth - 0.08 * brass + grain * 0.12 * (felt + cloth), 0.22, 1.0);`)
    .replace("#include <metalnessmap_fragment>", `#include <metalnessmap_fragment>
      metalnessFactor = 0.34 * brass;`);
};
