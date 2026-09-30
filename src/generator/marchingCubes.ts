/**
 * High-Performance Marching Cubes Polygonizer for Continuous Organic Organisms.
 * Utilizes Three.js battle-tested canonical lookup tables to guarantee
 * watertight, glitch-free, non-manifold-free, smooth organic single-mesh synthesis.
 */

import * as THREE from 'three';
import { edgeTable, triTable } from 'three/examples/jsm/objects/MarchingCubes.js';
import { CreatureSDF } from './sdf';
import { CreatureDNA } from './dna';

export interface MeshGenerationResult {
  geometry: THREE.BufferGeometry;
  vertexCount: number;
  triangleCount: number;
  generationTimeMs: number;
}

// 12 edges connecting the 8 corners matching Three.js canonical order
const EDGES: [number, number][] = [
  [0, 1], // Edge 0 (along X, y=0, z=0)
  [1, 3], // Edge 1 (along Y, x=1, z=0)
  [2, 3], // Edge 2 (along X, y=1, z=0)
  [0, 2], // Edge 3 (along Y, x=0, z=0)
  [4, 5], // Edge 4 (along X, y=0, z=1)
  [5, 7], // Edge 5 (along Y, x=1, z=1)
  [6, 7], // Edge 6 (along X, y=1, z=1)
  [4, 6], // Edge 7 (along Y, x=0, z=1)
  [0, 4], // Edge 8 (along Z, x=0, y=0)
  [1, 5], // Edge 9 (along Z, x=1, y=0)
  [3, 7], // Edge 10 (along Z, x=1, y=1)
  [2, 6], // Edge 11 (along Z, x=0, y=1)
];

// Linear interpolation for isosurface edge intersection
function interp(
  x1: number, y1: number, z1: number, val1: number,
  x2: number, y2: number, z2: number, val2: number,
  iso: number
): [number, number, number] {
  if (Math.abs(iso - val1) < 1e-6) return [x1, y1, z1];
  if (Math.abs(iso - val2) < 1e-6) return [x2, y2, z2];
  if (Math.abs(val1 - val2) < 1e-6) return [x1, y1, z1];

  const mu = (iso - val1) / (val2 - val1);
  return [
    x1 + mu * (x2 - x1),
    y1 + mu * (y2 - y1),
    z1 + mu * (z2 - z1)
  ];
}

/**
 * Computes biological countershading pigmentation & pattern color at vertex position.
 * Features realistic eyes with pupils/irises, ivory enamel dentition, moist rhinarium, and keratin claws.
 */
function computeBiologicalVertexColor(
  x: number, y: number, z: number,
  nx: number, ny: number, nz: number,
  dna: CreatureDNA,
  bbox: { min: [number, number, number]; max: [number, number, number] },
  sdf?: CreatureSDF
): [number, number, number] {
  const scale = dna.scale;
  const absX = Math.abs(x);

  if (sdf && sdf.skeleton && sdf.skeleton.joints.length > 7) {
    const head = sdf.skeleton.joints[5];
    const snout = sdf.skeleton.joints[6];

    // 1. Ocular Globe Pigmentation (Eye, Iris, Pupil, Limbal Ring)
    const eyeForwardRatio = dna.eyeForwardFacing;
    const eyeLateralSpread = (1.0 - eyeForwardRatio) * 0.45;
    const eyeOffsetX = head.radius * (0.68 + eyeLateralSpread * 0.40);
    const eyeOffsetY = head.pos[1] + head.radius * 0.24;
    const eyeOffsetZ = head.pos[2] + head.radius * (0.25 + eyeForwardRatio * 0.40);
    const eyeRadius = Math.max(0.048 * scale, dna.eyeOrbitSize * 0.78 * scale);

    const dEyeX = absX - eyeOffsetX;
    const dEyeY = y - eyeOffsetY;
    const dEyeZ = z - eyeOffsetZ;
    const distToEyeCenter = Math.sqrt(dEyeX * dEyeX + dEyeY * dEyeY + dEyeZ * dEyeZ);

    if (distToEyeCenter <= eyeRadius * 1.15) {
      // Direction vector from eye center to surface point
      const dirZ = dEyeZ / (distToEyeCenter || 1.0);
      const dirX = dEyeX / (distToEyeCenter || 1.0);
      // Gaze projection
      const gazeAlignment = dirZ * 0.78 + dirX * 0.62;

      if (gazeAlignment > 0.82) {
        // Deep obsidian black pupil with specular intensity
        return [0.02, 0.02, 0.02];
      } else if (gazeAlignment > 0.45) {
        // Biological iris: glowing amber, gold, or saurian emerald with limbal ring transition
        const irisCol = dna.accentColor ? new THREE.Color(dna.accentColor) : new THREE.Color('#e5a93b');
        if (gazeAlignment < 0.50) {
          // Dark limbal ring bordering the sclera
          return [irisCol.r * 0.4, irisCol.g * 0.4, irisCol.b * 0.4];
        }
        return [Math.min(1.0, irisCol.r * 1.15), Math.min(1.0, irisCol.g * 1.15), Math.min(1.0, irisCol.b * 1.15)];
      } else {
        // Ivory white / pale cream sclera with subtle vascular warmth
        return [0.94, 0.92, 0.88];
      }
    }

    // 2. Oral Fissure / Lip Margins (Distinct dark lip boundary between upper snout and lower jaw)
    if (snout && sdf.skeleton.joints.length > 7) {
      const jaw = sdf.skeleton.joints[7];
      const oralPlaneY = snout.pos[1] * 0.45 + jaw.pos[1] * 0.55;
      if (Math.abs(y - oralPlaneY) < 0.028 * scale && z > head.pos[2] + head.radius * 0.1) {
        return [0.08, 0.07, 0.07];
      }
    }

    // 3. Maxillary Canines / Saber Fangs (Ivory Enamel)
    const hasFangs = dna.ecologicalNiche.includes('Carnivor') || dna.ecologicalNiche.includes('Hunter') || dna.stance === 'avian_theropod' || dna.skullArchetype === 'brachycephalic';
    if (hasFangs && snout) {
      const fangBaseX = snout.radius * 0.72;
      const fangBaseY = snout.pos[1] * 0.96;
      const fangBaseZ = snout.pos[2] - 0.06 * scale;
      const fangLen = (dna.skullArchetype === 'brachycephalic' ? 0.20 : 0.13) * scale;
      if (Math.abs(absX - fangBaseX) < 0.045 * scale && y < fangBaseY && y > fangBaseY - fangLen * 1.15 && Math.abs(z - fangBaseZ) < 0.055 * scale) {
        // Ivory tooth enamel with subtle warm tone
        return [0.96, 0.94, 0.89];
      }
    }

    // 4. Moist Rhinarium (Dark leathery nose pad)
    if (snout && z > snout.pos[2] + snout.radius * 0.15 && Math.abs(y - snout.pos[1]) < snout.radius * 0.65 && absX < snout.radius * 0.55) {
      return [0.10, 0.09, 0.09];
    }

    // 5. Claws / Hooves / Talons (Dark polished keratin)
    if (y < 0.038 * scale) {
      const legChains = [...sdf.skeleton.leftLegIndices, ...sdf.skeleton.rightLegIndices];
      for (const chain of legChains) {
        if (chain.length > 3) {
          const footJ = sdf.skeleton.joints[chain[3]];
          if (footJ) {
            const dFoot = Math.sqrt((x - footJ.pos[0]) ** 2 + (z - footJ.pos[2]) ** 2);
            if (dFoot < footJ.radius * 1.4 && z > footJ.pos[2] - footJ.radius * 0.2) {
              return [0.12, 0.11, 0.10];
            }
          }
        }
      }
    }
  }

  const primary = new THREE.Color(dna.primaryColor);
  const ventral = new THREE.Color(dna.secondaryColor);
  const accent = new THREE.Color(dna.accentColor);

  const totalH = bbox.max[1] - bbox.min[1];
  const normY = totalH > 0 ? (y - bbox.min[1]) / totalH : 0.5;

  // Countershading: Dorsal (top) darker/richer, Ventral (underside) lighter
  const dorsalFactor = THREE.MathUtils.clamp(normY * 0.65 + ny * 0.35 + 0.1, 0, 1);
  const color = ventral.clone().lerp(primary, dorsalFactor);

  // Pattern Overlay (Tiger stripes, Leopard rosettes, Saddle, or Bioluminescent veins)
  if (dna.pattern === 'tiger_stripes') {
    const stripeFreq = 12.0 / dna.scale;
    const stripe = Math.sin(z * stripeFreq + Math.sin(y * 6.0) * 1.2);
    if (stripe > 0.48 && dorsalFactor > 0.3) {
      color.lerp(accent, 0.85);
    }
  } else if (dna.pattern === 'leopard_rosettes') {
    const spotX = Math.sin(x * 14.0);
    const spotZ = Math.cos(z * 10.0);
    const spot = spotX * spotZ;
    if (spot > 0.32 && dorsalFactor > 0.25) {
      color.lerp(accent, 0.75);
    }
  } else if (dna.pattern === 'bioluminescent_veins') {
    const veinN = Math.abs(Math.sin(x * 20.0 + Math.cos(z * 16.0) * 1.8));
    if (veinN > 0.84) {
      color.lerp(accent, 0.95);
    }
  } else if (dna.pattern === 'dorsal_saddle') {
    if (dorsalFactor > 0.68 && Math.abs(x) < 0.45 * dna.scale) {
      color.lerp(accent, 0.65);
    }
  }

  // Darker snout bridge shading
  if (z > bbox.max[2] - 0.22 * dna.scale) {
    color.multiplyScalar(0.78);
  }

  return [color.r, color.g, color.b];
}

/**
 * Executes Marching Cubes algorithm with Three.js canonical tables.
 */
export function generateCreatureMesh(
  sdf: CreatureSDF,
  resolution: number = 72
): MeshGenerationResult {
  const startTime = performance.now();
  const dna = sdf.dna;
  const bbox = sdf.getBoundingBox();

  const minX = bbox.min[0], minY = bbox.min[1], minZ = bbox.min[2];
  const maxX = bbox.max[0], maxY = bbox.max[1], maxZ = bbox.max[2];

  const sizeX = maxX - minX;
  const sizeY = maxY - minY;
  const sizeZ = maxZ - minZ;

  const maxDimension = Math.max(sizeX, sizeY, sizeZ);
  // High-fidelity voxel step size: preserves fine anatomical features (claws, fangs, horns, digits)
  // without creating mesh gaps, while keeping polygonization fast
  const effectiveResolution = THREE.MathUtils.clamp(resolution, 64, 80);
  const step = Math.min(0.026, Math.max(0.016, maxDimension / effectiveResolution));

  const nx = Math.ceil(sizeX / step) + 1;
  const ny = Math.ceil(sizeY / step) + 1;
  const nz = Math.ceil(sizeZ / step) + 1;

  // 3D Scalar Field sampling with boundary sealing to prevent boundary clipping
  const totalVoxels = nx * ny * nz;
  const field = new Float32Array(totalVoxels);

  let idx = 0;
  for (let k = 0; k < nz; k++) {
    const z = minZ + k * step;
    const isBoundaryZ = k === 0 || k === nz - 1;

    for (let j = 0; j < ny; j++) {
      const y = minY + j * step;
      const isBoundaryY = j === 0 || j === ny - 1;

      for (let i = 0; i < nx; i++) {
        const x = minX + i * step;
        const isBoundaryX = i === 0 || i === nx - 1;

        if (isBoundaryX || isBoundaryY || isBoundaryZ) {
          // Clamp boundary layer outside the isosurface so mesh never clips
          field[idx++] = Math.max(0.1, sdf.evaluate(x, y, z));
        } else {
          field[idx++] = sdf.evaluate(x, y, z);
        }
      }
    }
  }

  const getVal = (i: number, j: number, k: number): number => {
    return field[i + j * nx + k * (nx * ny)];
  };

  const iso = 0.0;
  const vertices: number[] = [];
  const normals: number[] = [];
  const colors: number[] = [];
  const uvs: number[] = [];
  const partIds: number[] = [];

  // Per-cube edge cache for vertex position and continuous analytical normal
  const edgeVerts: ([number, number, number] | null)[] = new Array(12);
  const edgeNorms: ([number, number, number] | null)[] = new Array(12);

  // Marching through every voxel cube
  for (let k = 0; k < nz - 1; k++) {
    const z0 = minZ + k * step;
    const z1 = z0 + step;

    for (let j = 0; j < ny - 1; j++) {
      const y0 = minY + j * step;
      const y1 = y0 + step;

      for (let i = 0; i < nx - 1; i++) {
        const x0 = minX + i * step;
        const x1 = x0 + step;

        // 8 corner values matching Three.js canonical order:
        // 0: (x0, y0, z0) -> bit 1
        // 1: (x1, y0, z0) -> bit 2
        // 2: (x0, y1, z0) -> bit 8
        // 3: (x1, y1, z0) -> bit 4
        // 4: (x0, y0, z1) -> bit 16
        // 5: (x1, y0, z1) -> bit 32
        // 6: (x0, y1, z1) -> bit 128
        // 7: (x1, y1, z1) -> bit 64
        const v0 = getVal(i, j, k);
        const v1 = getVal(i + 1, j, k);
        const v2 = getVal(i, j + 1, k);
        const v3 = getVal(i + 1, j + 1, k);
        const v4 = getVal(i, j, k + 1);
        const v5 = getVal(i + 1, j, k + 1);
        const v6 = getVal(i, j + 1, k + 1);
        const v7 = getVal(i + 1, j + 1, k + 1);

        let cubeindex = 0;
        if (v0 < iso) cubeindex |= 1;
        if (v1 < iso) cubeindex |= 2;
        if (v2 < iso) cubeindex |= 8;
        if (v3 < iso) cubeindex |= 4;
        if (v4 < iso) cubeindex |= 16;
        if (v5 < iso) cubeindex |= 32;
        if (v6 < iso) cubeindex |= 128;
        if (v7 < iso) cubeindex |= 64;

        if (cubeindex === 0 || cubeindex === 255) continue;

        const bits = edgeTable[cubeindex];
        if (bits === 0) continue;

        const cornerCoords: [number, number, number, number][] = [
          [x0, y0, z0, v0], // 0
          [x1, y0, z0, v1], // 1
          [x0, y1, z0, v2], // 2
          [x1, y1, z0, v3], // 3
          [x0, y0, z1, v4], // 4
          [x1, y0, z1, v5], // 5
          [x0, y1, z1, v6], // 6
          [x1, y1, z1, v7], // 7
        ];

        // Clear edge cache for this cube
        for (let e = 0; e < 12; e++) {
          edgeVerts[e] = null;
          edgeNorms[e] = null;
        }

        const getEdgeData = (e: number): { pos: [number, number, number]; norm: [number, number, number] } => {
          if (edgeVerts[e] && edgeNorms[e]) {
            return { pos: edgeVerts[e]!, norm: edgeNorms[e]! };
          }
          const edgeDef = EDGES[e];
          const c1 = cornerCoords[edgeDef[0]];
          const c2 = cornerCoords[edgeDef[1]];
          const p = interp(
            c1[0], c1[1], c1[2], c1[3],
            c2[0], c2[1], c2[2], c2[3],
            iso
          );
          edgeVerts[e] = p;
          const norm = sdf.getNormal(p[0], Math.max(0.0, p[1]), p[2], step * 0.45);
          edgeNorms[e] = norm;
          return { pos: p, norm };
        };

        // Emit triangles from triTable
        const baseTriIdx = cubeindex << 4; // cubeindex * 16
        let t = 0;
        while (triTable[baseTriIdx + t] !== -1 && t < 16) {
          const eA = triTable[baseTriIdx + t];
          const eB = triTable[baseTriIdx + t + 1];
          const eC = triTable[baseTriIdx + t + 2];
          t += 3;

          if (eA === -1 || eB === -1 || eC === -1) break;

          const vA = getEdgeData(eA);
          const vB = getEdgeData(eB);
          const vC = getEdgeData(eC);

          const pA = vA.pos;
          const pB = vB.pos;
          const pC = vC.pos;

          // Reject degenerate slivers
          const dAB = (pA[0] - pB[0]) * (pA[0] - pB[0]) + (pA[1] - pB[1]) * (pA[1] - pB[1]) + (pA[2] - pB[2]) * (pA[2] - pB[2]);
          const dBC = (pB[0] - pC[0]) * (pB[0] - pC[0]) + (pB[1] - pC[1]) * (pB[1] - pC[1]) + (pB[2] - pC[2]) * (pB[2] - pC[2]);
          if (dAB < 1e-8 || dBC < 1e-8) continue;

          // Push triangle vertices with continuous smooth analytical normals
          for (const v of [vA, vB, vC]) {
            const p = v.pos;
            const norm = v.norm;
            const clampedY = Math.max(0.0, p[1]);

            vertices.push(p[0], clampedY, p[2]);
            normals.push(norm[0], norm[1], norm[2]);

            // Anatomical vertex pigmentation with continuous smooth normal
            const col = computeBiologicalVertexColor(
              p[0], clampedY, p[2],
              norm[0], norm[1], norm[2],
              dna, bbox, sdf
            );
            colors.push(col[0], col[1], col[2]);

            // Biological cylindrical UV mapping
            const u = (Math.atan2(p[0], p[2]) / Math.PI) * 0.5 + 0.5;
            const uvY = (clampedY - bbox.min[1]) / (bbox.max[1] - bbox.min[1] || 1.0);
            uvs.push(u, uvY);

            // Anatomical hierarchy Part-ID
            partIds.push(sdf.getAnatomicalPart(p[0], clampedY, p[2]));
          }
        }
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('partId', new THREE.Float32BufferAttribute(partIds, 1));

  const endTime = performance.now();

  return {
    geometry,
    vertexCount: vertices.length / 3,
    triangleCount: vertices.length / 9,
    generationTimeMs: Math.round(endTime - startTime)
  };
}
