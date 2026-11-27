import {
  Box3, BufferGeometry, Color, DynamicDrawUsage, Float32BufferAttribute, Matrix4, Points, ShaderMaterial,
  type Mesh, type MeshStandardMaterial, type Object3D,
} from "three";
import { EXECUTION_COLLAPSE_MS } from "../game/dayView";

const PARTICLES = 148;
const EDGE = 0.08;
const COLORS = [new Color("#b2bdd0"), new Color("#c9b58b"), new Color("#8499aa")];

function dustMaterial(source: MeshStandardMaterial, cut: { value: number }): MeshStandardMaterial {
  const material = source.clone();
  material.customProgramCacheKey = () => `${source.customProgramCacheKey()}|execution-dust`;
  material.onBeforeCompile = (shader, renderer) => {
    source.onBeforeCompile(shader, renderer);
    shader.uniforms.dustCut = cut;
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 dustWorld;")
      .replace("#include <project_vertex>", "#include <project_vertex>\ndustWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec3 dustWorld;\nuniform float dustCut;")
      .replace("#include <color_fragment>", `#include <color_fragment>
        vec3 cell = floor(dustWorld * 112.0);
        float fleck = fract(sin(dot(cell, vec3(34.17, 78.23, 37.71))) * 43758.5453);
        float below = dustCut - dustWorld.y + 0.07 * (fleck - 0.5);
        if (below < 0.0) discard;
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.45, 0.49, 0.54), 0.42 * (1.0 - smoothstep(0.0, 0.075, below)));
      `);
  };
  return material;
}

/** 빈 좌석이 남기 전까지 같은 한 묶음으로 입자를 내리고 흩뜨린다. */
export function createExecutionDust(root: Object3D, meshes: readonly Mesh[], source: MeshStandardMaterial) {
  root.updateWorldMatrix(true, true);
  const toRoot = root.matrixWorld.clone().invert();
  const transform = new Matrix4();
  const bounds = new Box3();
  const jointBounds = new Box3();
  for (const mesh of meshes) {
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    jointBounds.copy(mesh.geometry.boundingBox!).applyMatrix4(transform.multiplyMatrices(toRoot, mesh.matrixWorld));
    bounds.union(jointBounds);
  }
  const minY = bounds.min.y - EDGE;
  const maxY = bounds.max.y + EDGE;
  const height = maxY - minY;
  const xCenter = (bounds.min.x + bounds.max.x) * 0.5;
  const zCenter = (bounds.min.z + bounds.max.z) * 0.5;
  const xRadius = (bounds.max.x - bounds.min.x) * 0.5;
  const zRadius = (bounds.max.z - bounds.min.z) * 0.5;
  const cut = { value: 1000 };
  const material = dustMaterial(source, cut);
  const geometry = new BufferGeometry();
  const position = new Float32BufferAttribute(new Float32Array(PARTICLES * 3), 3).setUsage(DynamicDrawUsage);
  const opacity = new Float32BufferAttribute(new Float32Array(PARTICLES), 1).setUsage(DynamicDrawUsage);
  const color = new Float32BufferAttribute(new Float32Array(PARTICLES * 3), 3);
  const size = new Float32BufferAttribute(new Float32Array(PARTICLES), 1);
  geometry.setAttribute("position", position);
  geometry.setAttribute("dustOpacity", opacity);
  geometry.setAttribute("dustColor", color);
  geometry.setAttribute("dustSize", size);
  const flecks = new ShaderMaterial({
    transparent: true, depthWrite: false,
    vertexShader: `
      attribute float dustOpacity;
      attribute vec3 dustColor;
      attribute float dustSize;
      varying float vOpacity;
      varying vec3 vColor;
      void main() {
        vec4 view = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * view;
        gl_PointSize = clamp(dustSize * 19.0 / max(1.0, -view.z), 1.0, 5.0);
        vOpacity = dustOpacity;
        vColor = dustColor;
      }
    `,
    fragmentShader: `
      varying float vOpacity;
      varying vec3 vColor;
      void main() {
        float radius = length(gl_PointCoord - 0.5);
        float alpha = vOpacity * (1.0 - smoothstep(0.20, 0.49, radius));
        if (alpha < 0.025) discard;
        gl_FragColor = vec4(vColor, alpha);
        #include <colorspace_fragment>
      }
    `,
  });
  const points = new Points(geometry, flecks);
  points.name = "execution-dust";
  points.frustumCulled = false;
  points.visible = false;
  root.add(points);
  // 똑같은 시각에 합류한 화면에는 입자 위치도 같다.
  let seed = 0xa91db76e;
  const sample = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const particles = Array.from({ length: PARTICLES }, (_, i) => {
    const angle = sample() * Math.PI * 2;
    const born = (i + sample()) / PARTICLES;
    const radius = 0.3 + 0.65 * sample();
    const tone = COLORS[i % 5 === 0 ? 1 : i % 3 === 0 ? 2 : 0]!;
    color.setXYZ(i, tone.r, tone.g, tone.b);
    size.setX(i, 0.45 + sample() * 0.65);
    return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius, born, life: 420 + 250 * sample() };
  });
  return {
    material,
    update(elapsedMs: number) {
      const progress = Math.min(elapsedMs / EXECUTION_COLLAPSE_MS, 1);
      cut.value = root.position.y + (maxY - height * progress) * root.scale.y;
      let visible = false;
      for (let i = 0; i < particles.length; i++) {
        const { x, z, born, life } = particles[i]!;
        const age = (elapsedMs - born * EXECUTION_COLLAPSE_MS) / life;
        if (age < 0 || age >= 1) {
          opacity.setX(i, 0);
          continue;
        }
        visible = true;
        const drift = age * 0.34;
        position.setXYZ(i,
          xCenter + (xRadius + drift) * x,
          Math.max(minY - 0.06, maxY - height * born - 0.72 * age * age),
          zCenter + (zRadius + drift) * z,
        );
        opacity.setX(i, Math.min(1, age * 8) * (1 - age) * 0.83);
      }
      points.visible = visible;
      position.needsUpdate = opacity.needsUpdate = visible;
    },
    dispose() {
      root.remove(points);
      geometry.dispose();
      flecks.dispose();
      material.dispose();
    },
  };
}
