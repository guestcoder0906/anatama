/**
 * Procedural Rigging & Scientific Vertebrate Bone Skinning System.
 * Computes anatomical branch-isolated skin weights (4 influences per vertex)
 * with zero cross-limb bleeding and smooth bone-shaft projection heat diffusion.
 */

import * as THREE from 'three';
import { SkeletonBlueprint, AnatomicalPart } from './sdf';
import { CreatureDNA } from './dna';

export interface RiggedCreature {
  skinnedMesh: THREE.SkinnedMesh;
  skeleton: THREE.Skeleton;
  bones: THREE.Bone[];
  boneNames: string[];
  boneWorldPositions: THREE.Vector3[];
}

/**
 * Segment-directed distance accounting for perpendicular bone radius
 * and longitudinal joint falloff. Eliminates artificial cross-segment bleed.
 */
function computeBoneSegmentDistance(
  p: THREE.Vector3,
  a: THREE.Vector3,
  b: THREE.Vector3
): { dist: number; perpDist: number; u: number } {
  const abX = b.x - a.x;
  const abY = b.y - a.y;
  const abZ = b.z - a.z;
  const abLenSq = abX * abX + abY * abY + abZ * abZ;

  if (abLenSq < 1e-7) {
    const d = p.distanceTo(a);
    return { dist: d, perpDist: d, u: 0.5 };
  }

  const abLen = Math.sqrt(abLenSq);
  const invLen = 1.0 / abLen;
  const dirX = abX * invLen;
  const dirY = abY * invLen;
  const dirZ = abZ * invLen;

  const apX = p.x - a.x;
  const apY = p.y - a.y;
  const apZ = p.z - a.z;

  // Longitudinal coordinate along the bone shaft (s = 0 at joint A, s = abLen at joint B)
  const s = apX * dirX + apY * dirY + apZ * dirZ;
  const u = s * invLen;

  // Perpendicular distance to the bone shaft axis
  const perpX = apX - dirX * s;
  const perpY = apY - dirY * s;
  const perpZ = apZ - dirZ * s;
  const perpDist = Math.sqrt(perpX * perpX + perpY * perpY + perpZ * perpZ);

  // Longitudinal overshoot penalty when outside [0, 1]
  let longOvershoot = 0;
  if (u < 0) {
    longOvershoot = -s;
  } else if (u > 1.0) {
    longOvershoot = s - abLen;
  }

  // Effective distance: within the segment (0 <= u <= 1), dist is purely perpDist.
  // Beyond joints, distance scales smoothly with overshoot * 2.8, cleanly localizing weights to each bone shaft!
  const effDist = longOvershoot === 0
    ? perpDist
    : Math.sqrt(perpDist * perpDist + (longOvershoot * 2.8) * (longOvershoot * 2.8));

  return { dist: effDist, perpDist, u };
}

/**
 * Anatomical part affinity lookup matrix.
 * Enforces strict scientific isolation: zero cross-bleed between limbs, tail, and torso,
 * while allowing smooth, natural socket blending at the girdle articulations.
 */
function getBonePartAffinity(bonePartId: number, vertPartId: number, boneName: string): number {
  if (vertPartId < 0) return 1.0;

  // 1. Caudal Tail (AnatomicalPart.TAIL = 7)
  if (vertPartId === AnatomicalPart.TAIL) {
    if (boneName.startsWith('Tail_Segment_')) return 1.0;
    if (boneName === 'Root_Pelvis') return 0.40; // base of tail connects into pelvis
    if (boneName === 'Spine_Lumbar') return 0.15;
    return 0.0; // Limbs, Head, Thorax STRICTLY ZERO
  }

  // 2. Left Forelimb (8 = Upper, 9 = Lower, 10 = Foot)
  if (vertPartId >= AnatomicalPart.FORELIMB_L_UPPER && vertPartId <= AnatomicalPart.FORELIMB_L_FOOT) {
    if (bonePartId >= AnatomicalPart.FORELIMB_L_UPPER && bonePartId <= AnatomicalPart.FORELIMB_L_FOOT) {
      return 1.0;
    }
    if (boneName === 'Spine_Thorax') return 0.25; // shoulder socket crease
    return 0.0; // All other bones (Tail, Pelvis, Right limb, Hindlimbs) STRICTLY ZERO
  }

  // 3. Right Forelimb (11 = Upper, 12 = Lower, 13 = Foot)
  if (vertPartId >= AnatomicalPart.FORELIMB_R_UPPER && vertPartId <= AnatomicalPart.FORELIMB_R_FOOT) {
    if (bonePartId >= AnatomicalPart.FORELIMB_R_UPPER && bonePartId <= AnatomicalPart.FORELIMB_R_FOOT) {
      return 1.0;
    }
    if (boneName === 'Spine_Thorax') return 0.25; // shoulder socket crease
    return 0.0;
  }

  // 4. Left Hindlimb (14 = Upper, 15 = Lower, 16 = Foot)
  if (vertPartId >= AnatomicalPart.HINDLIMB_L_UPPER && vertPartId <= AnatomicalPart.HINDLIMB_L_FOOT) {
    if (bonePartId >= AnatomicalPart.HINDLIMB_L_UPPER && bonePartId <= AnatomicalPart.HINDLIMB_L_FOOT) {
      return 1.0;
    }
    if (boneName === 'Root_Pelvis') return 0.25; // hip acetabulum socket crease
    return 0.0; // Tail, Lumbar, Forelimbs, Right legs STRICTLY ZERO
  }

  // 5. Right Hindlimb (17 = Upper, 18 = Lower, 19 = Foot)
  if (vertPartId >= AnatomicalPart.HINDLIMB_R_UPPER && vertPartId <= AnatomicalPart.HINDLIMB_R_FOOT) {
    if (bonePartId >= AnatomicalPart.HINDLIMB_R_UPPER && bonePartId <= AnatomicalPart.HINDLIMB_R_FOOT) {
      return 1.0;
    }
    if (boneName === 'Root_Pelvis') return 0.25; // hip socket crease
    return 0.0;
  }

  // 6. Axial Trunk (0 = Pelvis, 1 = Lumbar, 2 = Thorax)
  if (vertPartId >= AnatomicalPart.PELVIS && vertPartId <= AnatomicalPart.THORAX) {
    // Distal limb bones NEVER touch the torso
    if (boneName.includes('Knee') || boneName.includes('Ankle') || boneName.includes('Elbow') || boneName.includes('Wrist') || boneName.includes('Foot')) {
      return 0.0;
    }
    // Tail bones beyond segment 1 NEVER touch torso
    if (boneName.startsWith('Tail_Segment_') && !boneName.includes('_1')) return 0.0;

    // Organic socket crease blending
    if (boneName.includes('Girdle')) return 0.20;
    if (boneName.includes('Tail_Segment_1')) return vertPartId === AnatomicalPart.PELVIS ? 0.35 : 0.0;
    return 1.0;
  }

  // 7. Cranial & Cervical (3 = Neck, 4 = Head, 5 = Snout, 6 = Jaw)
  if (vertPartId >= AnatomicalPart.NECK && vertPartId <= AnatomicalPart.JAW) {
    if (boneName.includes('Girdle') || boneName.includes('Elbow') || boneName.includes('Knee') || boneName.includes('Foot') || boneName.includes('Tail') || boneName.includes('Pelvis')) {
      return 0.0;
    }
    if (boneName === 'Spine_Thorax') {
      return vertPartId === AnatomicalPart.NECK ? 0.35 : 0.0; // neck socket connection
    }

    // Articulated Mandible Isolation:
    // Mandible_Jaw bone strictly moves Jaw vertices (never dragging the maxilla or cranium)
    if (boneName === 'Mandible_Jaw') {
      return vertPartId === AnatomicalPart.JAW ? 1.0 : 0.0;
    }
    if (vertPartId === AnatomicalPart.JAW) {
      // Lower jaw vertices: primarily bound to Mandible_Jaw, with subtle TMJ socket anchor
      if (boneName === 'Head_Cranium') return 0.15;
      return 0.0;
    }

    return 1.0;
  }

  return 1.0;
}

/**
 * Procedurally rigs a geometry with the skeletal blueprint.
 * Employs bone-directed forward segment heat diffusion with 4-influence skin normalization.
 */
export function buildRiggedSkeleton(
  geometry: THREE.BufferGeometry,
  blueprint: SkeletonBlueprint,
  dna: CreatureDNA,
  material: THREE.Material
): RiggedCreature {
  const joints = blueprint.joints;
  const bones: THREE.Bone[] = [];
  const boneNames: string[] = [];
  const boneWorldPositions: THREE.Vector3[] = [];

  // 1. Create THREE.Bone objects
  for (let i = 0; i < joints.length; i++) {
    const j = joints[i];
    const bone = new THREE.Bone();
    bone.name = j.name;
    bones.push(bone);
    boneNames.push(j.name);
    boneWorldPositions.push(new THREE.Vector3(j.pos[0], j.pos[1], j.pos[2]));
  }

  // 2. Assemble hierarchical parent-child relationships and relative local transforms
  for (let i = 0; i < joints.length; i++) {
    const j = joints[i];
    const bone = bones[i];
    const worldPos = boneWorldPositions[i];

    if (j.parentIndex === -1) {
      // Root bone
      bone.position.copy(worldPos);
    } else {
      const parentBone = bones[j.parentIndex];
      const parentWorldPos = boneWorldPositions[j.parentIndex];
      // Local position is relative to parent
      bone.position.subVectors(worldPos, parentWorldPos);
      parentBone.add(bone);
    }
  }

  // Ensure matrix hierarchy is updated
  bones[0].updateMatrixWorld(true);

  // Identify primary child for each bone to define its physical bone shaft segment
  const primaryChildIndex = new Int32Array(joints.length).fill(-1);
  for (let i = 0; i < joints.length; i++) {
    const p = joints[i].parentIndex;
    if (p >= 0 && primaryChildIndex[p] === -1) {
      primaryChildIndex[p] = i;
    }
  }

  // Compute extended terminal segment endpoints for leaf bones (Tail tip, feet, snout, jaw)
  // Guarantees vertices at extremities (end of tail, claws, snout) project onto a solid bone shaft
  const terminalSegmentEndPositions: (THREE.Vector3 | null)[] = new Array(joints.length).fill(null);
  const scale = dna.scale || 1.0;

  for (let i = 0; i < joints.length; i++) {
    if (primaryChildIndex[i] === -1) {
      const j = joints[i];
      const bPos = boneWorldPositions[i];
      const pIdx = j.parentIndex;
      let dir = new THREE.Vector3(0, 0, 1);

      if (pIdx >= 0) {
        const pPos = boneWorldPositions[pIdx];
        dir.subVectors(bPos, pPos);
        if (dir.lengthSq() > 1e-6) {
          dir.normalize();
        } else {
          dir.set(0, 0, 1);
        }
      }

      let extLength = Math.max(0.18 * scale, j.radius * 2.2);

      // Tail tip flare extension
      if (j.name.startsWith('Tail_Segment_')) {
        extLength = Math.max(0.35 * scale, j.radius * 3.5);
      } else if (j.name.includes('Foot')) {
        // Feet project forward along ground (+Z)
        dir.set(0, 0, 1).normalize();
        extLength = Math.max(0.22 * scale, j.radius * 2.2);
      } else if (j.name.includes('Snout')) {
        extLength = Math.max(0.20 * scale, j.radius * 2.0);
      }

      terminalSegmentEndPositions[i] = new THREE.Vector3().copy(bPos).addScaledVector(dir, extLength);
    }
  }

  // 3. Compute High-Precision Anatomical Skin Weights (4 influences per vertex)
  const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
  const partAttr = geometry.getAttribute('partId') as THREE.BufferAttribute | null;
  const vertexCount = posAttr.count;

  const skinIndices = new Float32Array(vertexCount * 4);
  const skinWeights = new Float32Array(vertexCount * 4);

  const vertPos = new THREE.Vector3();
  const influences: { index: number; weight: number }[] = [];

  for (let v = 0; v < vertexCount; v++) {
    vertPos.fromBufferAttribute(posAttr, v);
    const vertPartId = partAttr ? partAttr.getX(v) : -1;
    influences.length = 0;

    let bestAffinityBoneIdx = -1;
    let bestAffinityDist = Infinity;
    let bestAnyBoneIdx = 0;
    let bestAnyDist = Infinity;

    for (let b = 0; b < joints.length; b++) {
      const j = joints[b];

      // Check anatomical branch compatibility first (zero cross-bleed)
      const affinity = getBonePartAffinity(j.partId, vertPartId, j.name);
      if (affinity <= 0.0) continue;

      const bPos = boneWorldPositions[b];

      // Segment endpoints: Bone joint -> Child joint (or terminal extension)
      const childIdx = primaryChildIndex[b];
      const targetPos = childIdx >= 0 ? boneWorldPositions[childIdx] : (terminalSegmentEndPositions[b] || bPos);

      // Segment-directed distance with longitudinal joint boundaries
      const seg = computeBoneSegmentDistance(vertPos, bPos, targetPos);
      const dist = seg.dist;

      // Track closest bones for absolute fail-safe fallback
      if (dist < bestAnyDist) {
        bestAnyDist = dist;
        bestAnyBoneIdx = b;
      }

      if (dist < bestAffinityDist) {
        bestAffinityDist = dist;
        bestAffinityBoneIdx = b;
      }

      // Radius-normalized distance with anatomical kernel width
      const kernelRadius = Math.max(0.08 * scale, j.radius * 1.5);
      const normDist = dist / kernelRadius;

      // Crisp localized Gaussian falloff with subtle heavy tail:
      // High authority in the bone shaft, clean 50/50 blend at joints, zero cross-segment mush
      const weight = affinity * (Math.exp(-0.5 * normDist * normDist) + 0.03 / (1.0 + normDist * normDist));

      if (weight > 1e-5) {
        influences.push({ index: b, weight });
      }
    }

    // Sort descending by weight
    influences.sort((a, b) => b.weight - a.weight);

    // Keep top 4
    let totalWeight = 0;
    const top4Count = Math.min(4, influences.length);
    for (let i = 0; i < top4Count; i++) {
      totalWeight += influences[i].weight;
    }

    if (totalWeight < 1e-6 || top4Count === 0) {
      // Fail-Safe Fallback: bind 100% to the physically closest compatible bone
      const fallbackIdx = bestAffinityBoneIdx >= 0 ? bestAffinityBoneIdx : bestAnyBoneIdx;
      skinIndices[v * 4] = fallbackIdx;
      skinWeights[v * 4] = 1.0;
      skinIndices[v * 4 + 1] = 0;
      skinWeights[v * 4 + 1] = 0;
      skinIndices[v * 4 + 2] = 0;
      skinWeights[v * 4 + 2] = 0;
      skinIndices[v * 4 + 3] = 0;
      skinWeights[v * 4 + 3] = 0;
    } else {
      for (let i = 0; i < 4; i++) {
        if (i < top4Count) {
          skinIndices[v * 4 + i] = influences[i].index;
          skinWeights[v * 4 + i] = influences[i].weight / totalWeight;
        } else {
          skinIndices[v * 4 + i] = 0;
          skinWeights[v * 4 + i] = 0;
        }
      }
      // Sanity check: ensure valid weight
      if (isNaN(skinWeights[v * 4]) || skinWeights[v * 4] <= 0) {
        const fallbackIdx = bestAffinityBoneIdx >= 0 ? bestAffinityBoneIdx : bestAnyBoneIdx;
        skinIndices[v * 4] = fallbackIdx;
        skinWeights[v * 4] = 1.0;
      }
    }
  }

  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(new Uint16Array(skinIndices), 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeights, 4));

  // 4. Create Skeleton and SkinnedMesh
  const skeleton = new THREE.Skeleton(bones);
  const skinnedMesh = new THREE.SkinnedMesh(geometry, material);

  // Add root bone to skinnedMesh so it transforms within the same scene graph
  skinnedMesh.add(bones[0]);
  skinnedMesh.updateMatrixWorld(true);
  skinnedMesh.bind(skeleton);

  return {
    skinnedMesh,
    skeleton,
    bones,
    boneNames,
    boneWorldPositions
  };
}
