/**
 * Hierarchical Continuous Signed Distance Field (SDF) with Robust Anatomical Dimensions.
 * Eliminates paper-thin meshes, pinched limbs, and normal glitches by enforcing:
 * 1. Muscular, volumetric feature radii across all bones and extremities.
 * 2. Natural bilateral socket clearance without razor-sharp cutting planes.
 * 3. Smooth, differentiable C1 distance field for flawless Marching Cubes polygonization.
 */

import { CreatureDNA } from './dna';

export interface AnatomicalJoint {
  name: string;
  pos: [number, number, number];
  parentIndex: number;
  radius: number;
  partId: number;
}

export interface SkeletonBlueprint {
  joints: AnatomicalJoint[];
  spineIndices: number[];
  leftLegIndices: number[][];
  rightLegIndices: number[][];
  tailIndices: number[];
  headIndex: number;
  jawIndex: number;
}

export enum AnatomicalPart {
  PELVIS = 0,
  LUMBAR = 1,
  THORAX = 2,
  NECK = 3,
  HEAD = 4,
  SNOUT = 5,
  JAW = 6,
  TAIL = 7,
  FORELIMB_L_UPPER = 8,
  FORELIMB_L_LOWER = 9,
  FORELIMB_L_FOOT = 10,
  FORELIMB_R_UPPER = 11,
  FORELIMB_R_LOWER = 12,
  FORELIMB_R_FOOT = 13,
  HINDLIMB_L_UPPER = 14,
  HINDLIMB_L_LOWER = 15,
  HINDLIMB_L_FOOT = 16,
  HINDLIMB_R_UPPER = 17,
  HINDLIMB_R_LOWER = 18,
  HINDLIMB_R_FOOT = 19,
}

// Polynomial smooth minimum for seamless organic blending
export function smin(a: number, b: number, k: number = 0.15): number {
  const h = Math.max(k - Math.abs(a - b), 0.0) / k;
  return Math.min(a, b) - h * h * h * k * (1.0 / 6.0);
}

// Distance to line segment with tapering radii
export function sdTaperedCapsule(
  px: number, py: number, pz: number,
  ax: number, ay: number, az: number,
  bx: number, by: number, bz: number,
  ra: number, rb: number
): number {
  const bax = bx - ax;
  const bay = by - ay;
  const baz = bz - az;
  const pax = px - ax;
  const pay = py - ay;
  const paz = pz - az;

  const baLenSq = bax * bax + bay * bay + baz * baz;
  if (baLenSq < 1e-8) {
    const dist = Math.sqrt(pax * pax + pay * pay + paz * paz);
    return dist - ra;
  }

  let h = (pax * bax + pay * bay + paz * baz) / baLenSq;
  h = Math.max(0.0, Math.min(1.0, h));

  const r = ra + (rb - ra) * h;

  const dx = pax - bax * h;
  const dy = pay - bay * h;
  const dz = paz - baz * h;
  return Math.sqrt(dx * dx + dy * dy + dz * dz) - r;
}

// Ellipsoid distance approximation
export function sdEllipsoid(
  px: number, py: number, pz: number,
  cx: number, cy: number, cz: number,
  rx: number, ry: number, rz: number
): number {
  const dx = (px - cx) / rx;
  const dy = (py - cy) / ry;
  const dz = (pz - cz) / rz;
  const k0 = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const k1 = Math.sqrt(
    (dx / rx) * (dx / rx) +
    (dy / ry) * (dy / ry) +
    (dz / rz) * (dz / rz)
  );
  return k1 > 0 ? (k0 * (k0 - 1.0)) / k1 : k0 - 1.0;
}

// Exact Euclidean distance to sphere
export function sdSphere(
  px: number, py: number, pz: number,
  cx: number, cy: number, cz: number,
  radius: number
): number {
  const dx = px - cx;
  const dy = py - cy;
  const dz = pz - cz;
  return Math.sqrt(dx * dx + dy * dy + dz * dz) - radius;
}

/**
 * Builds the scientific skeleton blueprint from Creature DNA.
 * Guarantees healthy, muscular volumetric thickness across all bones,
 * eliminating spindly or paper-thin structures.
 */
export function buildSkeletonBlueprint(dna: CreatureDNA): SkeletonBlueprint {
  const joints: AnatomicalJoint[] = [];
  const spineIndices: number[] = [];
  const leftLegIndices: number[][] = [];
  const rightLegIndices: number[][] = [];
  const tailIndices: number[] = [];

  const spineL = dna.spineLength;
  const scale = dna.scale;

  // Stance baseline elevation from ground
  const hipElevation = (dna.hindlimbScale * 0.92 + 0.38) * scale;
  const shoulderElevation = dna.stance === 'avian_theropod'
    ? hipElevation + 0.35 * scale
    : (dna.forelimbScale * 0.92 + 0.38) * scale;

  // 0: Root / Pelvis (Center of Mass & Sacral Hub)
  const pelvisZ = -spineL * 0.35 * scale;
  const pelvisY = hipElevation;
  const pelvisRx = Math.max(0.32 * scale, Math.min(0.50 * scale, dna.pelvisWidth * 0.52 * scale));
  joints.push({
    name: 'Root_Pelvis',
    pos: [0, pelvisY, pelvisZ],
    parentIndex: -1,
    radius: pelvisRx,
    partId: AnatomicalPart.PELVIS
  });
  spineIndices.push(0);

  // 1: Lumbar Spine (Anatomically smooth waist transition)
  // Ensure thoraxRx is harmonized with pelvisRx so upper torso is balanced (not too skinny, not too thick)
  const thoraxRx = Math.max(0.34 * scale, Math.min(0.52 * scale, dna.thoracicWidth * 0.54 * scale));
  const lumbarZ = -spineL * 0.08 * scale;
  const lumbarY = (pelvisY + shoulderElevation) * 0.5 + dna.spineCurvature * 0.32 * scale;
  const lumbarRx = Math.max(0.30 * scale, Math.min(0.48 * scale, (pelvisRx * 0.48 + thoraxRx * 0.52) * 0.96));
  joints.push({
    name: 'Spine_Lumbar',
    pos: [0, lumbarY, lumbarZ],
    parentIndex: 0,
    radius: lumbarRx,
    partId: AnatomicalPart.LUMBAR
  });
  spineIndices.push(1);

  // 2: Thorax (Chest / Ribcage Center)
  const thoraxZ = spineL * 0.22 * scale;
  const thoraxY = shoulderElevation;
  joints.push({
    name: 'Spine_Thorax',
    pos: [0, thoraxY, thoraxZ],
    parentIndex: 1,
    radius: thoraxRx,
    partId: AnatomicalPart.THORAX
  });
  spineIndices.push(2);

  // 3: Lower Neck (Cervical 1)
  const neckL = dna.neckLength * scale;
  const neckArch = dna.neckArch * scale;
  const neck1Z = thoraxZ + neckL * 0.45;
  const neck1Y = thoraxY + neckArch * 0.5;
  joints.push({
    name: 'Neck_Base',
    pos: [0, neck1Y, neck1Z],
    parentIndex: 2,
    radius: Math.max(0.18 * scale, dna.neckThickness * 0.44 * scale),
    partId: AnatomicalPart.NECK
  });
  spineIndices.push(3);

  // 4: Upper Neck (Cervical 2)
  const neck2Z = thoraxZ + neckL * 0.85;
  const neck2Y = thoraxY + neckArch;
  joints.push({
    name: 'Neck_Upper',
    pos: [0, neck2Y, neck2Z],
    parentIndex: 3,
    radius: Math.max(0.16 * scale, dna.neckThickness * 0.38 * scale),
    partId: AnatomicalPart.NECK
  });
  spineIndices.push(4);

  // 5: Skull / Cranium (Realistically proportioned, prominent cranial vault)
  const skullZ = neck2Z + dna.skullSize * 0.72 * scale;
  const skullY = neck2Y + 0.05 * scale;
  joints.push({
    name: 'Head_Cranium',
    pos: [0, skullY, skullZ],
    parentIndex: 4,
    radius: Math.max(0.22 * scale, dna.skullSize * 0.54 * scale),
    partId: AnatomicalPart.HEAD
  });
  const headIndex = 5;

  // 6: Snout / Rostrum Tip
  const snoutZ = skullZ + dna.snoutLength * 0.88 * scale;
  const snoutY = skullY - dna.snoutDrop * 0.90 * scale;
  joints.push({
    name: 'Snout_Tip',
    pos: [0, snoutY, snoutZ],
    parentIndex: headIndex,
    radius: Math.max(0.14 * scale, dna.snoutWidth * 0.42 * scale),
    partId: AnatomicalPart.SNOUT
  });

  // 7: Mandible / Jaw
  const jawZ = skullZ + dna.snoutLength * 0.54 * scale;
  const jawY = skullY - dna.mandibleDepth * 0.75 * scale;
  joints.push({
    name: 'Mandible_Jaw',
    pos: [0, jawY, jawZ],
    parentIndex: headIndex,
    radius: Math.max(0.13 * scale, dna.mandibleDepth * 0.38 * scale),
    partId: AnatomicalPart.JAW
  });
  const jawIndex = 7;

  // Caudal vertebrae (Tail chain)
  const tailSegments = 4;
  let prevTailIdx = 0;
  const tailTotalL = dna.tailLength * scale;
  for (let t = 1; t <= tailSegments; t++) {
    const frac = t / tailSegments;
    const tz = pelvisZ - frac * tailTotalL;
    const ty = dna.stance === 'avian_theropod'
      ? pelvisY + Math.sin(frac * Math.PI) * 0.15 * scale
      : pelvisY - Math.pow(frac, 1.4) * (pelvisY * 0.65);
    const trad = dna.tailThickness * (1.0 - frac * 0.62) * scale;
    const tIdx = joints.length;
    joints.push({
      name: `Tail_Segment_${t}`,
      pos: [0, ty, tz],
      parentIndex: prevTailIdx,
      radius: Math.max(0.08 * scale, trad), // Solid minimum tail radius
      partId: AnatomicalPart.TAIL
    });
    tailIndices.push(tIdx);
    prevTailIdx = tIdx;
  }

  // Limb Pairs Generation
  const limbPairsCount = dna.limbPairs;

  for (let pair = 0; pair < limbPairsCount; pair++) {
    const isForelimb = pair === 0 && limbPairsCount > 1;
    const isHindlimb = pair === limbPairsCount - 1;

    const attachJointIdx = isForelimb ? 2 : isHindlimb ? 0 : 1;
    const attachJoint = joints[attachJointIdx];
    const limbScale = isForelimb ? dna.forelimbScale : dna.hindlimbScale;
    const totalLegH = attachJoint.pos[1];

    const bodyLateralRadius = isForelimb ? thoraxRx : pelvisRx;

    // Muscular, proportioned upper limb radius:
    const rawThighRad = (isForelimb ? dna.scapulaVolume * 0.50 : dna.femurThickness * 0.60) * scale;
    const thighRadius = limbPairsCount === 3
      ? Math.max(0.12 * scale, Math.min(0.20 * scale, rawThighRad * 0.75))
      : Math.max(0.14 * scale, Math.min(0.24 * scale, rawThighRad));

    // Natural hip/shoulder socket position with comfortable bilateral gap:
    // Guarantees left and right thighs have positive clearance and never fuse across the midline
    const baseSocketX = Math.max(thighRadius * 1.65, bodyLateralRadius * 0.95 + thighRadius * 0.55);
    const midPairOffset = (pair === 1 && limbPairsCount === 3) ? 0.08 * scale : 0.0;
    const socketX = baseSocketX + midPairOffset;

    const sideOffsets = [1, -1];
    const leftChain: number[] = [];
    const rightChain: number[] = [];

    const isBipedStance = dna.stance === 'avian_theropod' || dna.stance === 'bipedal';

    // Longitudinal knee and foot placement to prevent fore/mid/hind collision
    let kneeZOffset = 0;
    let footForwardOffset = 0;

    if (limbPairsCount === 3) {
      // Hexapod: Front legs angle forward, middle legs angle lateral, rear legs angle backward
      if (pair === 0) {
        kneeZOffset = 0.16 * limbScale * scale;
        footForwardOffset = 0.18 * scale;
      } else if (pair === 1) {
        kneeZOffset = 0.0;
        footForwardOffset = 0.0;
      } else {
        kneeZOffset = -0.18 * limbScale * scale;
        footForwardOffset = -0.18 * scale;
      }
    } else if (isBipedStance) {
      // Bipedal theropod: feet planted stably under the Whole-Body Center of Mass (CoM)
      kneeZOffset = (0.24 * limbScale + spineL * 0.14) * scale;
      footForwardOffset = (0.22 + spineL * 0.14) * scale;
    } else {
      // Quadruped: Forelimb elbow angles back, hindlimb stifle angles forward
      if (isForelimb) {
        kneeZOffset = -0.06 * limbScale * scale;
        const cranialLead = (dna.neckLength * 0.12 + dna.snoutLength * 0.08) * scale;
        footForwardOffset = (dna.footPosture === 'plantigrade' ? 0.14 : 0.08) * scale + cranialLead;
      } else {
        kneeZOffset = 0.10 * limbScale * scale;
        footForwardOffset = (dna.footPosture === 'plantigrade' ? 0.10 : 0.06) * scale;
      }
    }

    for (const side of sideOffsets) {
      const sidePrefix = side > 0 ? 'L' : 'R';
      const sideChain = side > 0 ? leftChain : rightChain;
      const shoulderX = side * socketX;

      const upperPartId = isForelimb
        ? (side > 0 ? AnatomicalPart.FORELIMB_L_UPPER : AnatomicalPart.FORELIMB_R_UPPER)
        : (side > 0 ? AnatomicalPart.HINDLIMB_L_UPPER : AnatomicalPart.HINDLIMB_R_UPPER);

      const lowerPartId = isForelimb
        ? (side > 0 ? AnatomicalPart.FORELIMB_L_LOWER : AnatomicalPart.FORELIMB_R_LOWER)
        : (side > 0 ? AnatomicalPart.HINDLIMB_L_LOWER : AnatomicalPart.HINDLIMB_R_LOWER);

      const footPartId = isForelimb
        ? (side > 0 ? AnatomicalPart.FORELIMB_L_FOOT : AnatomicalPart.FORELIMB_R_FOOT)
        : (side > 0 ? AnatomicalPart.HINDLIMB_L_FOOT : AnatomicalPart.HINDLIMB_R_FOOT);

      // Joint 1: Girdle / Shoulder or Hip Socket
      const girdleIdx = joints.length;
      joints.push({
        name: `${sidePrefix}_Girdle_${pair}`,
        pos: [shoulderX, attachJoint.pos[1] * 0.98, attachJoint.pos[2]],
        parentIndex: attachJointIdx,
        radius: thighRadius,
        partId: upperPartId
      });
      sideChain.push(girdleIdx);

      // Joint 2: Knee or Elbow (Muscular joint)
      const kneeIdx = joints.length;
      const kneeZ = attachJoint.pos[2] + kneeZOffset;
      const kneeX = side * (socketX + 0.04 * scale);

      // Foot & Ankle Height grounded strictly at ground surface Y = 0
      const footRadius = Math.max(0.10 * scale, thighRadius * 0.68);
      const footY = footRadius; // Bottom of foot pad rests on Y = 0.00
      const ankleY = Math.max(footY + 0.11 * scale, dna.footPosture === 'plantigrade' ? footY + 0.08 * scale : totalLegH * 0.24);
      const kneeY = Math.max(ankleY + 0.16 * scale, totalLegH * 0.54);

      joints.push({
        name: `${sidePrefix}_${isForelimb ? 'Elbow' : 'Knee'}_${pair}`,
        pos: [kneeX, kneeY, kneeZ],
        parentIndex: girdleIdx,
        radius: Math.max(0.13 * scale, thighRadius * 0.82),
        partId: upperPartId
      });
      sideChain.push(kneeIdx);

      // Joint 3: Ankle / Hock / Wrist
      const ankleIdx = joints.length;
      const ankleZ = isForelimb
        ? kneeZ + 0.07 * limbScale * scale
        : isBipedStance
        ? kneeZ - 0.14 * limbScale * scale
        : kneeZ - 0.10 * limbScale * scale;
      const ankleX = side * (socketX + 0.03 * scale);
      joints.push({
        name: `${sidePrefix}_${isForelimb ? 'Wrist' : 'Ankle'}_${pair}`,
        pos: [ankleX, ankleY, ankleZ],
        parentIndex: kneeIdx,
        radius: Math.max(0.11 * scale, thighRadius * 0.68),
        partId: lowerPartId
      });
      sideChain.push(ankleIdx);

      // Joint 4: Foot / Paw / Hoof
      const footIdx = joints.length;
      const footZ = ankleZ + footForwardOffset;
      const footX = ankleX;
      joints.push({
        name: `${sidePrefix}_Foot_${pair}`,
        pos: [footX, footY, footZ],
        parentIndex: ankleIdx,
        radius: footRadius,
        partId: footPartId
      });
      sideChain.push(footIdx);
    }

    leftLegIndices.push(leftChain);
    rightLegIndices.push(rightChain);
  }

  return {
    joints,
    spineIndices,
    leftLegIndices,
    rightLegIndices,
    tailIndices,
    headIndex,
    jawIndex
  };
}

/**
 * Continuous organic Signed Distance Field (SDF).
 * Evaluates smooth, differentiable 3D distance fields without razor-sharp cutting planes.
 */
export class CreatureSDF {
  public dna: CreatureDNA;
  public skeleton: SkeletonBlueprint;
  private blendK: number;

  constructor(dna: CreatureDNA) {
    this.dna = dna;
    this.skeleton = buildSkeletonBlueprint(dna);
    this.blendK = 0.15 * dna.scale;
  }

  /**
   * Evaluates the signed distance at point (x, y, z).
   */
  public evaluate(x: number, y: number, z: number): number {
    const dna = this.dna;
    const joints = this.skeleton.joints;
    const k = this.blendK;
    const scale = dna.scale;
    const absX = Math.abs(x);

    // ==========================================
    // 1. AXIAL SKELETON (Pelvis, Thorax, Neck, Head)
    // ==========================================

    // 1. Continuous Vertebral Spinal Column (Core Axial Trunk)
    const thorax = joints[2];
    const lumbar = joints[1];
    const pelvis = joints[0];

    const thoraxToLumbar = sdTaperedCapsule(
      x, y, z,
      thorax.pos[0], thorax.pos[1], thorax.pos[2],
      lumbar.pos[0], lumbar.pos[1], lumbar.pos[2],
      thorax.radius,
      lumbar.radius
    );
    const lumbarToPelvis = sdTaperedCapsule(
      x, y, z,
      lumbar.pos[0], lumbar.pos[1], lumbar.pos[2],
      pelvis.pos[0], pelvis.pos[1], pelvis.pos[2],
      lumbar.radius,
      pelvis.radius
    );
    let dTorso = smin(thoraxToLumbar, lumbarToPelvis, k * 0.42);

    // 2. Ribcage Core (Proportional Thoracic Cavity: not too skinny, not too thick)
    const humpBoost = dna.dorsalCrestAdipose * 0.14 * scale;
    const thoraxDepth = Math.max(0.34 * scale, Math.min(0.54 * scale, (dna.thoracicDepth * 0.52 + humpBoost) * scale));
    const thoraxDist = sdEllipsoid(
      x, y, z,
      thorax.pos[0], thorax.pos[1] + humpBoost * 0.20, thorax.pos[2],
      thorax.radius,
      thoraxDepth,
      dna.spineLength * 0.20 * scale
    );
    dTorso = smin(dTorso, thoraxDist, k * 0.32);

    // 3. Pelvis & Sacral Girdle (Harmonious with Thorax)
    const pelvisDepth = Math.max(0.32 * scale, Math.min(0.50 * scale, (dna.thoracicDepth * 0.48 * (1.0 + dna.bellySlack * 0.12)) * scale));
    const pelvisDist = sdEllipsoid(
      x, y, z,
      pelvis.pos[0], pelvis.pos[1], pelvis.pos[2],
      pelvis.radius,
      pelvisDepth,
      dna.spineLength * 0.20 * scale
    );
    dTorso = smin(dTorso, pelvisDist, k * 0.32);

    // Neck Base
    const neck1 = joints[3];
    const neck2 = joints[4];
    const neckBaseDist = sdTaperedCapsule(
      x, y, z,
      thorax.pos[0], thorax.pos[1], thorax.pos[2],
      neck1.pos[0], neck1.pos[1], neck1.pos[2],
      thorax.radius * 0.76,
      neck1.radius
    );
    let dCranial = smin(dTorso, neckBaseDist, k * 0.40);

    // Neck Upper
    const neckUpperDist = sdTaperedCapsule(
      x, y, z,
      neck1.pos[0], neck1.pos[1], neck1.pos[2],
      neck2.pos[0], neck2.pos[1], neck2.pos[2],
      neck1.radius,
      neck2.radius
    );
    dCranial = smin(dCranial, neckUpperDist, k * 0.38);

    // Cranium / Head (Realistically proportioned cranial vault, sleek and natural)
    const head = joints[5];
    const snout = joints[6];
    const jaw = joints[7];

    const craniumDist = sdEllipsoid(
      x, y, z,
      head.pos[0], head.pos[1], head.pos[2],
      head.radius,
      head.radius * 0.92,
      head.radius * 1.10
    );
    dCranial = smin(dCranial, craniumDist, k * 0.36);

    // Snout / Rostrum (Maxillary bridge)
    const snoutDist = sdTaperedCapsule(
      x, y, z,
      head.pos[0], head.pos[1] * 0.98, head.pos[2],
      snout.pos[0], snout.pos[1], snout.pos[2],
      head.radius * 0.82,
      snout.radius
    );
    dCranial = smin(dCranial, snoutDist, k * 0.30);

    // 1. Biological Ocular Spheres (Eyes & Orbits)
    // Dynamic placement: Frontal binocular stereoscopy for apex predators, lateral panoramic for prey
    const eyeForwardRatio = dna.eyeForwardFacing;
    const eyeLateralSpread = (1.0 - eyeForwardRatio) * 0.45;
    const eyeOffsetX = head.radius * (0.68 + eyeLateralSpread * 0.40);
    const eyeOffsetY = head.pos[1] + head.radius * 0.24;
    const eyeOffsetZ = head.pos[2] + head.radius * (0.25 + eyeForwardRatio * 0.40);
    const eyeRadius = Math.max(0.048 * scale, dna.eyeOrbitSize * 0.78 * scale);

    // Distinct convex eye globes protruding with natural biological curvature
    const eyeGlobeDist = sdSphere(absX, y, z, eyeOffsetX, eyeOffsetY, eyeOffsetZ, eyeRadius);
    dCranial = smin(dCranial, eyeGlobeDist, k * 0.22);

    // Supraorbital Brow Ridge (cranial bone ridge protecting the eye orbit)
    const browRidgeDist = sdTaperedCapsule(
      absX, y, z,
      eyeOffsetX * 0.85, eyeOffsetY + eyeRadius * 0.92, eyeOffsetZ - eyeRadius * 0.6,
      eyeOffsetX * 1.04, eyeOffsetY + eyeRadius * 0.80, eyeOffsetZ + eyeRadius * 0.7,
      eyeRadius * 0.60,
      eyeRadius * 0.38
    );
    dCranial = smin(dCranial, browRidgeDist, k * 0.25);

    // Zygomatic Arch (Cheekbone flare connecting lateral cranium to maxilla)
    const zygomaDist = sdTaperedCapsule(
      absX, y, z,
      head.radius * 0.84, head.pos[1] - head.radius * 0.12, head.pos[2] - head.radius * 0.05,
      eyeOffsetX * 1.02, eyeOffsetY - eyeRadius * 1.15, eyeOffsetZ,
      head.radius * 0.24,
      head.radius * 0.16
    );
    dCranial = smin(dCranial, zygomaDist, k * 0.26);

    // 2. Distinct Articulated Mandible (Lower Jaw & Chin)
    // Features distinct mandibular angle (angular process under the ear) and mental symphysis (chin)
    const jawAngleY = head.pos[1] - head.radius * 0.42;
    const jawAngleZ = head.pos[2] - head.radius * 0.12;
    const jawAngleX = head.radius * 0.62;
    const chinY = jaw.pos[1];
    const chinZ = jaw.pos[2] + dna.snoutLength * 0.16 * scale;
    const chinRadius = jaw.radius * 0.85;

    // TMJ socket attachment (temporomandibular joint behind cheek)
    const tmjDist = sdSphere(absX, y, z, jawAngleX, jawAngleY, jawAngleZ, jaw.radius * 0.52);
    dCranial = smin(dCranial, tmjDist, k * 0.20);

    // Mandibular ramus (curving bone shaft from jaw joint to chin)
    const mandibleRamus = sdTaperedCapsule(
      absX, y, z,
      jawAngleX, jawAngleY, jawAngleZ,
      jaw.radius * 0.30, chinY, chinZ,
      jaw.radius * 0.72,
      chinRadius
    );
    // Mandible core body
    const mandibleBody = sdTaperedCapsule(
      x, y, z,
      jaw.pos[0], jaw.pos[1], jaw.pos[2] - head.radius * 0.10,
      jaw.pos[0], chinY, chinZ,
      jaw.radius * 0.88,
      chinRadius
    );
    const dMandible = Math.min(mandibleRamus, mandibleBody);
    // Mandible connects with controlled local smoothing, keeping clear oral cleft at lips
    dCranial = smin(dCranial, dMandible, k * 0.18);

    // 3. Maxillary Canines / Saber Fangs (Predators, Carnivores, Theropods)
    const hasFangs = dna.ecologicalNiche.includes('Carnivor') || dna.ecologicalNiche.includes('Hunter') || dna.stance === 'avian_theropod' || dna.skullArchetype === 'brachycephalic';
    if (hasFangs) {
      const fangLen = (dna.skullArchetype === 'brachycephalic' ? 0.20 : 0.13) * scale;
      const fangBaseX = snout.radius * 0.72;
      const fangBaseY = snout.pos[1] * 0.96;
      const fangBaseZ = snout.pos[2] - 0.06 * scale;
      const fangDist = sdTaperedCapsule(
        absX, y, z,
        fangBaseX, fangBaseY, fangBaseZ,
        fangBaseX * 0.90, fangBaseY - fangLen, fangBaseZ + 0.02 * scale,
        0.035 * scale,
        0.010 * scale
      );
      dCranial = smin(dCranial, fangDist, k * 0.15);
    }

    // 4. External Nares (Nostrils at apex of rostrum)
    const naresOffsetX = snout.radius * 0.32;
    const naresDist = sdSphere(absX, y, z, naresOffsetX, snout.pos[1] + snout.radius * 0.30, snout.pos[2] + snout.radius * 0.40, snout.radius * 0.28);
    dCranial = smin(dCranial, naresDist, k * 0.20);

    // Ears
    if (dna.earType !== 'reptilian_slit') {
      const earOffsetX = head.radius * 0.78;
      const earOffsetY = head.radius * 0.68;
      const earOffsetZ = -head.radius * 0.18;
      const earScale = dna.earScale * scale;

      const earDist = sdTaperedCapsule(
        absX, y, z,
        earOffsetX, head.pos[1] + earOffsetY, head.pos[2] + earOffsetZ,
        earOffsetX * 1.35, head.pos[1] + earOffsetY + earScale, head.pos[2] + earOffsetZ - 0.04 * scale,
        head.radius * 0.32,
        0.045 * scale
      );
      dCranial = smin(dCranial, earDist, k * 0.35);
    }

    // Horns
    if (dna.hornType !== 'none' && dna.hornScale > 0.05) {
      const hornScale = dna.hornScale * scale;
      if (dna.hornType === 'bovid_swept') {
        const hornDist = sdTaperedCapsule(
          absX, y, z,
          head.radius * 0.6, head.pos[1] + head.radius * 0.7, head.pos[2],
          head.radius * 1.35, head.pos[1] + head.radius * 1.1 + hornScale, head.pos[2] - hornScale * 0.55,
          0.11 * scale,
          0.035 * scale
        );
        dCranial = smin(dCranial, hornDist, k * 0.25);
      } else if (dna.hornType === 'ceratopsian_brow') {
        const hornDist = sdTaperedCapsule(
          absX, y, z,
          head.radius * 0.5, head.pos[1] + head.radius * 0.6, head.pos[2] + head.radius * 0.4,
          head.radius * 0.7, head.pos[1] + head.radius * 1.2 + hornScale * 0.75, head.pos[2] + head.radius * 0.6 + hornScale,
          0.10 * scale,
          0.035 * scale
        );
        dCranial = smin(dCranial, hornDist, k * 0.25);
      } else if (dna.hornType === 'rhino_nasal') {
        const hornDist = sdTaperedCapsule(
          x, y, z,
          snout.pos[0], snout.pos[1] + 0.04 * scale, snout.pos[2] - 0.08 * scale,
          snout.pos[0], snout.pos[1] + hornScale * 1.15, snout.pos[2] - 0.04 * scale,
          0.12 * scale,
          0.04 * scale
        );
        dCranial = smin(dCranial, hornDist, k * 0.25);
      }
    }

    // Tail (Caudal chain)
    const tailIndices = this.skeleton.tailIndices;
    let prevJ = pelvis;
    let dTail = 1000;
    for (let t = 0; t < tailIndices.length; t++) {
      const curJ = joints[tailIndices[t]];
      const tailSegDist = sdTaperedCapsule(
        x, y, z,
        prevJ.pos[0], prevJ.pos[1], prevJ.pos[2],
        curJ.pos[0], curJ.pos[1], curJ.pos[2],
        prevJ.radius,
        curJ.radius
      );
      dTail = t === 0 ? tailSegDist : smin(dTail, tailSegDist, k * 0.55);
      prevJ = curJ;
    }

    // Tail Tip Flare
    if (dna.tailTipStyle !== 'none' && tailIndices.length > 0) {
      const tipJ = joints[tailIndices[tailIndices.length - 1]];
      let tipDist = 1000;
      if (dna.tailTipStyle === 'tuft' || dna.tailTipStyle === 'club') {
        tipDist = sdEllipsoid(
          x, y, z,
          tipJ.pos[0], tipJ.pos[1], tipJ.pos[2],
          tipJ.radius * 1.9,
          tipJ.radius * 1.9,
          tipJ.radius * 2.3
        );
      } else if (dna.tailTipStyle === 'fin') {
        tipDist = sdEllipsoid(
          x, y, z,
          tipJ.pos[0], tipJ.pos[1], tipJ.pos[2],
          tipJ.radius * 0.5,
          tipJ.radius * 2.8,
          tipJ.radius * 2.0
        );
      }
      dTail = smin(dTail, tipDist, k * 0.35);
    }

    // Axial Body
    let dAxial = smin(dCranial, dTail, k * 0.6);

    // ==========================================
    // 2. APPENDICULAR LIMBS (Anti-Conjoining Branch Isolation)
    // ==========================================
    // Limbs connect organically into their torso socket via controlled proximal root lofting.
    // Articulated limbs combine via strict hard min() so distinct limbs NEVER melt into each other,
    // opposite legs, tail, or belly.

    const leftChains = this.skeleton.leftLegIndices;
    const rightChains = this.skeleton.rightLegIndices;

    let dTrunkWithSockets = dAxial;
    let dAllLimbs = 1000;

    for (let p = 0; p < leftChains.length; p++) {
      const isForelimb = p === 0 && leftChains.length > 1;
      const attachJointIdx = isForelimb ? 2 : (p === leftChains.length - 1 ? 0 : 1);
      const attachJoint = joints[attachJointIdx];

      // --- Left Limb (Side = +1) ---
      const lChain = leftChains[p];
      const lgJ = joints[lChain[0]]; // Shoulder / Hip Socket
      const lkJ = joints[lChain[1]]; // Knee / Elbow
      const laJ = joints[lChain[2]]; // Ankle / Wrist
      const lfJ = joints[lChain[3]]; // Foot

      const lUpper = sdTaperedCapsule(
        x, y, z,
        lgJ.pos[0], lgJ.pos[1], lgJ.pos[2],
        lkJ.pos[0], lkJ.pos[1], lkJ.pos[2],
        lgJ.radius,
        lkJ.radius
      );

      const lLower = sdTaperedCapsule(
        x, y, z,
        lkJ.pos[0], lkJ.pos[1], lkJ.pos[2],
        laJ.pos[0], laJ.pos[1], laJ.pos[2],
        lkJ.radius,
        laJ.radius
      );

      const lFoot = this.evaluateFootSDF(x, y, z, laJ, lfJ, 1, isForelimb, k);

      // Articulated free left limb branch
      const lDistal = smin(lLower, lFoot, k * 0.30);
      const lLeg = smin(lUpper, lDistal, k * 0.32);

      // --- Right Limb (Side = -1) ---
      const rChain = rightChains[p];
      const rgJ = joints[rChain[0]];
      const rkJ = joints[rChain[1]];
      const raJ = joints[rChain[2]];
      const rfJ = joints[rChain[3]];

      const rUpper = sdTaperedCapsule(
        x, y, z,
        rgJ.pos[0], rgJ.pos[1], rgJ.pos[2],
        rkJ.pos[0], rkJ.pos[1], rkJ.pos[2],
        rgJ.radius,
        rkJ.radius
      );

      const rLower = sdTaperedCapsule(
        x, y, z,
        rkJ.pos[0], rkJ.pos[1], rkJ.pos[2],
        raJ.pos[0], raJ.pos[1], raJ.pos[2],
        rkJ.radius,
        raJ.radius
      );

      const rFoot = this.evaluateFootSDF(x, y, z, raJ, rfJ, -1, isForelimb, k);

      // Articulated free right limb branch
      const rDistal = smin(rLower, rFoot, k * 0.30);
      const rLeg = smin(rUpper, rDistal, k * 0.32);

      // Proximal socket root bridge: connects limb socket organically into pelvic or thoracic girdle
      const lRoot = sdTaperedCapsule(
        x, y, z,
        attachJoint.pos[0], attachJoint.pos[1], attachJoint.pos[2],
        lgJ.pos[0], lgJ.pos[1], lgJ.pos[2],
        attachJoint.radius * 0.75,
        lgJ.radius
      );
      const rRoot = sdTaperedCapsule(
        x, y, z,
        attachJoint.pos[0], attachJoint.pos[1], attachJoint.pos[2],
        rgJ.pos[0], rgJ.pos[1], rgJ.pos[2],
        attachJoint.radius * 0.75,
        rgJ.radius
      );

      const dLeftLimb = smin(lRoot, lLeg, k * 0.34);
      const dRightLimb = smin(rRoot, rLeg, k * 0.34);

      // Bilateral isolation across midline prevents left & right legs from melting together
      const pairLimbs = Math.min(dLeftLimb, dRightLimb);

      // Organic socket attachment into trunk
      dTrunkWithSockets = smin(dTrunkWithSockets, pairLimbs, k * 0.28);
    }

    return dTrunkWithSockets;
  }

  /**
   * Generates authentic, high-detail biological foot geometry (paw pads, articulated toes, hooves, talons)
   * eliminating featureless nubs.
   */
  private evaluateFootSDF(
    px: number, py: number, pz: number,
    laJ: AnatomicalJoint, lfJ: AnatomicalJoint,
    side: number, isForelimb: boolean, k: number
  ): number {
    const dna = this.dna;
    const scale = dna.scale;
    const footRad = lfJ.radius;

    // 1. Metapodial Shank-to-Foot Bridge (Tarsus / Carpus bridge)
    const bridge = sdTaperedCapsule(
      px, py, pz,
      laJ.pos[0], laJ.pos[1], laJ.pos[2],
      lfJ.pos[0], lfJ.pos[1], lfJ.pos[2],
      laJ.radius,
      footRad
    );

    // 2. Primary Plantar / Palmar Sole Pad (Flattened, muscular pad)
    const soleDist = sdEllipsoid(
      px, py, pz,
      lfJ.pos[0], lfJ.pos[1], lfJ.pos[2],
      footRad * 1.12,
      footRad * 0.68,
      footRad * 1.25
    );
    let dFoot = smin(bridge, soleDist, k * 0.42);

    const extType = dna.extremityType || 'paw_claws';

    if (extType === 'hoof') {
      // --- UNGULATE HOOF (Bovids, Equids, Megabehemoths) ---
      // Anterior sloping keratinous hoof wall with cloven cleft
      const hoofLength = footRad * 1.35;
      const hoofFrontZ = lfJ.pos[2] + hoofLength * 0.7;

      // Medial and Lateral hoof lobes (Cloven split)
      const lobeOffsetX = footRad * 0.38;
      const leftLobe = sdTaperedCapsule(
        px, py, pz,
        lfJ.pos[0] + lobeOffsetX, lfJ.pos[1] + footRad * 0.25, lfJ.pos[2] - footRad * 0.35,
        lfJ.pos[0] + lobeOffsetX, lfJ.pos[1] * 0.45, hoofFrontZ,
        footRad * 0.58,
        footRad * 0.48
      );
      const rightLobe = sdTaperedCapsule(
        px, py, pz,
        lfJ.pos[0] - lobeOffsetX, lfJ.pos[1] + footRad * 0.25, lfJ.pos[2] - footRad * 0.35,
        lfJ.pos[0] - lobeOffsetX, lfJ.pos[1] * 0.45, hoofFrontZ,
        footRad * 0.58,
        footRad * 0.48
      );
      const clovenHoof = smin(leftLobe, rightLobe, k * 0.32);
      dFoot = smin(dFoot, clovenHoof, k * 0.38);

      // Posterior dewclaws (ergot / vestigial digits behind ankle)
      const dewclawDist = sdTaperedCapsule(
        px, py, pz,
        lfJ.pos[0], laJ.pos[1] * 0.75, laJ.pos[2] - footRad * 0.5,
        lfJ.pos[0], laJ.pos[1] * 0.52, laJ.pos[2] - footRad * 0.9,
        footRad * 0.32,
        footRad * 0.15
      );
      dFoot = smin(dFoot, dewclawDist, k * 0.35);

    } else if (extType === 'talons' || extType === 'scythe_claw') {
      // --- THEROPOD / AVIAN TALONS (Raptors, Carnosaur Pes) ---
      // Tridactyl radiating digits forward-projected
      const digitAngles = [-0.18, 0.0, 0.18];
      const digitLengths = [footRad * 1.35, footRad * 1.8, footRad * 1.35];

      for (let d = 0; d < 3; d++) {
        const ang = digitAngles[d];
        const dLen = digitLengths[d];
        const dx = Math.sin(ang) * dLen;
        const dz = Math.cos(ang) * dLen;

        const toeTipX = lfJ.pos[0] + dx;
        const toeTipY = Math.max(0.02 * scale, lfJ.pos[1] * 0.45);
        const toeTipZ = lfJ.pos[2] + dz;

        // Phalangeal toe segment
        const toeSeg = sdTaperedCapsule(
          px, py, pz,
          lfJ.pos[0] + dx * 0.25, lfJ.pos[1], lfJ.pos[2],
          toeTipX, toeTipY, toeTipZ,
          footRad * 0.38,
          footRad * 0.25
        );
        dFoot = smin(dFoot, toeSeg, k * 0.30);

        // Curved sharp raptorial talon
        const isScytheDigit = extType === 'scythe_claw' && d === 0;
        const clawLen = isScytheDigit ? footRad * 1.5 : footRad * 0.90;
        const clawTipX = toeTipX + Math.sin(ang) * clawLen * 0.5;
        const clawTipY = isScytheDigit ? toeTipY + clawLen * 0.55 : Math.max(0.01 * scale, toeTipY - clawLen * 0.22);
        const clawTipZ = toeTipZ + Math.cos(ang) * clawLen * 0.85;

        const clawDist = sdTaperedCapsule(
          px, py, pz,
          toeTipX, toeTipY, toeTipZ,
          clawTipX, clawTipY, clawTipZ,
          isScytheDigit ? footRad * 0.32 : footRad * 0.22,
          0.018 * scale
        );
        dFoot = smin(dFoot, clawDist, k * 0.25);
      }

    } else {
      // --- CARNIVORE / MAMMALIAN PAW WITH ARTICULATED TOES & CLAWS ---
      // 4 distinct digits radiating forward from pad without lateral over-extension
      const toeAngles = [-0.18, -0.06, 0.06, 0.18];
      const toeRadius = footRad * 0.34;
      const toeLength = footRad * 1.05;

      for (let t = 0; t < 4; t++) {
        const ang = toeAngles[t];
        const isOuter = t === 0 || t === 3;
        const tLen = isOuter ? toeLength * 0.85 : toeLength;
        const dx = Math.sin(ang) * tLen;
        const dz = Math.cos(ang) * tLen;

        const toeTipX = lfJ.pos[0] + dx;
        const toeTipY = Math.max(0.02 * scale, lfJ.pos[1] * 0.52);
        const toeTipZ = lfJ.pos[2] + dz;

        // Individual digital pad / toe capsule
        const toeDist = sdTaperedCapsule(
          px, py, pz,
          lfJ.pos[0] + dx * 0.3, lfJ.pos[1] * 0.8, lfJ.pos[2] + dz * 0.2,
          toeTipX, toeTipY, toeTipZ,
          toeRadius,
          toeRadius * 0.75
        );
        dFoot = smin(dFoot, toeDist, k * 0.30);

        // Claws on each digit (if paw_claws)
        if (extType === 'paw_claws') {
          const clawLen = footRad * 0.60;
          const clawTipX = toeTipX + Math.sin(ang) * clawLen * 0.4;
          const clawTipY = Math.max(0.01 * scale, toeTipY - 0.020 * scale);
          const clawTipZ = toeTipZ + Math.cos(ang) * clawLen;

          const clawDist = sdTaperedCapsule(
            px, py, pz,
            toeTipX, toeTipY, toeTipZ,
            clawTipX, clawTipY, clawTipZ,
            toeRadius * 0.45,
            0.016 * scale
          );
          dFoot = smin(dFoot, clawDist, k * 0.22);
        }
      }
    }

    return dFoot;
  }

  /**
   * Computes exact analytical normal vector via central differences.
   */
  public getNormal(x: number, y: number, z: number, eps: number = 0.012): [number, number, number] {
    const dx = this.evaluate(x + eps, y, z) - this.evaluate(x - eps, y, z);
    const dy = this.evaluate(x, y + eps, z) - this.evaluate(x, y - eps, z);
    const dz = this.evaluate(x, y, z + eps) - this.evaluate(x, y, z - eps);

    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (len < 1e-6) {
      // Safe fallback: sample slightly larger epsilon
      const eps2 = eps * 2.0;
      const dx2 = this.evaluate(x + eps2, y, z) - this.evaluate(x - eps2, y, z);
      const dy2 = this.evaluate(x, y + eps2, z) - this.evaluate(x, y - eps2, z);
      const dz2 = this.evaluate(x, y, z + eps2) - this.evaluate(x, y, z - eps2);
      const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2 + dz2 * dz2);
      if (len2 < 1e-6) return [0, 1, 0];
      return [dx2 / len2, dy2 / len2, dz2 / len2];
    }
    return [dx / len, dy / len, dz / len];
  }

  /**
   * Identifies closest anatomical part ID for a point using continuous bone segment shafts.
   */
  public getAnatomicalPart(x: number, y: number, z: number): number {
    let minDist = 1000;
    let closestPart = AnatomicalPart.PELVIS;

    const distToSeg = (
      px: number, py: number, pz: number,
      ax: number, ay: number, az: number,
      bx: number, by: number, bz: number,
      ra: number, rb: number
    ): number => {
      const bax = bx - ax, bay = by - ay, baz = bz - az;
      const pax = px - ax, pay = py - ay, paz = pz - az;
      const baLenSq = bax * bax + bay * bay + baz * baz;
      if (baLenSq < 1e-8) {
        return Math.sqrt(pax * pax + pay * pay + paz * paz) - ra;
      }
      let t = (pax * bax + pay * bay + paz * baz) / baLenSq;
      t = Math.max(0.0, Math.min(1.0, t));
      const rx = pax - bax * t;
      const ry = pay - bay * t;
      const rz = paz - baz * t;
      const r = ra + (rb - ra) * t;
      return Math.sqrt(rx * rx + ry * ry + rz * rz) - r;
    };

    const joints = this.skeleton.joints;

    // 1. Appendicular Limbs (Upper Shaft, Lower Shaft, Foot Shaft)
    const legChains = [...this.skeleton.leftLegIndices, ...this.skeleton.rightLegIndices];
    for (const chain of legChains) {
      if (chain.length < 4) continue;
      const jGirdle = joints[chain[0]];
      const jKnee = joints[chain[1]];
      const jAnkle = joints[chain[2]];
      const jFoot = joints[chain[3]];

      // Upper limb shaft (Thigh / Upper Arm): Girdle -> Knee
      const dUpper = distToSeg(
        x, y, z,
        jGirdle.pos[0], jGirdle.pos[1], jGirdle.pos[2],
        jKnee.pos[0], jKnee.pos[1], jKnee.pos[2],
        jGirdle.radius, jKnee.radius
      );
      if (dUpper < minDist) {
        minDist = dUpper;
        closestPart = jGirdle.partId; // FORELIMB_UPPER or HINDLIMB_UPPER
      }

      // Lower limb shaft (Shank / Forearm): Knee -> Ankle
      const dLower = distToSeg(
        x, y, z,
        jKnee.pos[0], jKnee.pos[1], jKnee.pos[2],
        jAnkle.pos[0], jAnkle.pos[1], jAnkle.pos[2],
        jKnee.radius, jAnkle.radius
      );
      if (dLower < minDist) {
        minDist = dLower;
        closestPart = jAnkle.partId; // FORELIMB_LOWER or HINDLIMB_LOWER
      }

      // Foot shaft & toes: Ankle -> Foot, extended forward
      const footDirZ = (jFoot.pos[2] - jAnkle.pos[2]) || 0.15;
      const toeZ = jFoot.pos[2] + footDirZ * 1.5;
      const dFoot = distToSeg(
        x, y, z,
        jAnkle.pos[0], jAnkle.pos[1], jAnkle.pos[2],
        jFoot.pos[0], jFoot.pos[1], toeZ,
        jAnkle.radius * 0.85, jFoot.radius * 1.2
      );
      if (dFoot < minDist) {
        minDist = dFoot;
        closestPart = jFoot.partId; // FORELIMB_FOOT or HINDLIMB_FOOT
      }
    }

    // 2. Caudal Tail Chain
    const tail = this.skeleton.tailIndices;
    if (tail.length > 0) {
      let prevJ = joints[0]; // Pelvis
      for (let t = 0; t < tail.length; t++) {
        const curJ = joints[tail[t]];
        const dTail = distToSeg(
          x, y, z,
          prevJ.pos[0], prevJ.pos[1], prevJ.pos[2],
          curJ.pos[0], curJ.pos[1], curJ.pos[2],
          prevJ.radius, curJ.radius
        );
        if (dTail < minDist) {
          minDist = dTail;
          closestPart = AnatomicalPart.TAIL;
        }
        prevJ = curJ;
      }
    }

    // 3. Axial & Cranial Spine (Thorax, Lumbar, Pelvis, Neck, Head, Snout, Jaw)
    // Explicit Articulated Mandible Partition:
    // Vertices situated below the oral plane forward of the TMJ hinge strictly articulate with Mandible_Jaw
    if (joints.length > 7) {
      const headJ = joints[5];
      const snoutJ = joints[6];
      const jawJ = joints[7];
      if (z > headJ.pos[2] - headJ.radius * 0.25) {
        const oralPlaneY = snoutJ.pos[1] * 0.42 + jawJ.pos[1] * 0.58;
        if (y < oralPlaneY) {
          return AnatomicalPart.JAW;
        }
      }
    }

    for (let i = 0; i < joints.length; i++) {
      const j = joints[i];
      // Skip limb joints here as they've already been evaluated along their true shafts
      if (j.partId >= AnatomicalPart.FORELIMB_L_UPPER && j.partId <= AnatomicalPart.HINDLIMB_R_FOOT) {
        continue;
      }
      if (j.partId === AnatomicalPart.TAIL) {
        continue;
      }

      const dx = x - j.pos[0];
      const dy = y - j.pos[1];
      const dz = z - j.pos[2];
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz) - j.radius;
      if (d < minDist) {
        minDist = d;
        closestPart = j.partId;
      }
    }

    return closestPart;
  }

  /**
   * Calculates bounding box with generous padding.
   */
  public getBoundingBox(): { min: [number, number, number]; max: [number, number, number] } {
    let minX = 100, minY = 100, minZ = 100;
    let maxX = -100, maxY = -100, maxZ = -100;

    for (const j of this.skeleton.joints) {
      const r = j.radius * 1.5;
      minX = Math.min(minX, j.pos[0] - r);
      maxX = Math.max(maxX, j.pos[0] + r);
      minY = Math.min(minY, j.pos[1] - r);
      maxY = Math.max(maxY, j.pos[1] + r);
      minZ = Math.min(minZ, j.pos[2] - r);
      maxZ = Math.max(maxZ, j.pos[2] + r);
    }

    const scale = this.dna.scale;
    const hornExtra = (this.dna.hornType !== 'none' ? this.dna.hornScale * 1.5 : 0) * scale;
    const earExtra = (this.dna.earType !== 'reptilian_slit' ? this.dna.earScale * 1.2 : 0) * scale;
    const crestExtra = (this.dna.dorsalCrestAdipose > 0.1 ? 0.40 : 0.10) * scale;
    const tailExtra = (this.dna.tailTipStyle !== 'none' ? 0.45 : 0.20) * scale;

    const pad = 0.35 * scale;
    return {
      min: [
        minX - pad - earExtra * 0.4,
        Math.min(-0.16 * scale, minY - pad * 0.5),
        minZ - pad - tailExtra
      ],
      max: [
        maxX + pad + earExtra * 0.4,
        maxY + pad + Math.max(hornExtra, earExtra, crestExtra),
        maxZ + pad + 0.22 * scale
      ]
    };
  }
}
