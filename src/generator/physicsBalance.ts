/**
 * Advanced Physics-Based Creature Weight Distribution & Biomechanical Balance Engine.
 * Evaluates segmental mass properties, center of mass (CoM), base of support (BoS),
 * static stability margins, zero moment point (ZMP) dynamic stability, and
 * provides automatic posture counter-balancing so procedural organisms stand and move realistically.
 */

import * as THREE from 'three';
import { CreatureDNA } from './dna';
import { SkeletonBlueprint, buildSkeletonBlueprint } from './sdf';

export interface SegmentMass {
  name: string;
  massKg: number;
  com: [number, number, number];
  partType: 'cranial' | 'torso' | 'caudal' | 'limb';
}

export interface FootContact {
  name: string;
  pos: [number, number, number]; // [x, y, z] on ground
  contactRadius: number;
  weightLoadKg: number;
  weightPercent: number;
  grfNewtons: number; // Ground Reaction Force
}

export type StabilityStatus = 'optimal' | 'stable' | 'marginal' | 'unstable';

export interface BalanceMetrics {
  totalMassKg: number;
  centerOfMass: [number, number, number]; // [x, y, z]
  groundCoM: [number, number]; // [x, z] projected on ground plane
  baseOfSupportPolygon: [number, number][]; // 2D convex hull coordinates [x, z]
  footContacts: FootContact[];
  stabilityMarginMeters: number; // positive = inside support polygon, negative = tipping
  stabilityStatus: StabilityStatus;
  dynamicZmpStabilityPercent: number; // 0 - 100%
  foreAftDistribution: { forePercent: number; hindPercent: number };
  lateralDistribution: { leftPercent: number; rightPercent: number };
  massBreakdown: {
    cranialKg: number;
    torsoKg: number;
    caudalKg: number;
    limbsKg: number;
  };
  recommendedPostureAdjustment: {
    tailPitchOffset: number;
    spineArchOffset: number;
    hipOffsetZ: number;
    stanceWidthFactor: number;
  };
}

// 2D Convex Hull algorithm (Monotone Chain) for Ground Base of Support Polygon
function compute2DConvexHull(points: [number, number][]): [number, number][] {
  if (points.length <= 2) return points;

  const pts = [...points].sort((a, b) => (a[0] === b[0] ? a[1] - b[1] : a[0] - b[0]));

  const cross = (o: [number, number], a: [number, number], b: [number, number]) => {
    return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  };

  const lower: [number, number][] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper: [number, number][] = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }

  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

// Signed distance from point to polygon (positive if inside, negative if outside)
function pointToPolygonDistance(pt: [number, number], poly: [number, number][]): number {
  if (poly.length === 0) return -1;
  if (poly.length === 1) {
    const dx = pt[0] - poly[0][0];
    const dz = pt[1] - poly[0][1];
    return -Math.sqrt(dx * dx + dz * dz);
  }

  // Check if inside polygon using ray-casting
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], zi = poly[i][1];
    const xj = poly[j][0], zj = poly[j][1];
    const intersect = ((zi > pt[1]) !== (zj > pt[1])) &&
      (pt[0] < ((xj - xi) * (pt[1] - zi)) / (zj - zi) + xi);
    if (intersect) inside = !inside;
  }

  // Calculate minimum Euclidean distance to polygon edges
  let minEdgeDist = 1e9;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const x1 = poly[j][0], z1 = poly[j][1];
    const x2 = poly[i][0], z2 = poly[i][1];
    const dx = x2 - x1;
    const dz = z2 - z1;
    const lenSq = dx * dx + dz * dz;

    let dist = 0;
    if (lenSq < 1e-8) {
      dist = Math.sqrt((pt[0] - x1) * (pt[0] - x1) + (pt[1] - z1) * (pt[1] - z1));
    } else {
      let t = ((pt[0] - x1) * dx + (pt[1] - z1) * dz) / lenSq;
      t = Math.max(0, Math.min(1, t));
      const projX = x1 + t * dx;
      const projZ = z1 + t * dz;
      dist = Math.sqrt((pt[0] - projX) * (pt[0] - projX) + (pt[1] - projZ) * (pt[1] - projZ));
    }
    if (dist < minEdgeDist) minEdgeDist = dist;
  }

  return inside ? minEdgeDist : -minEdgeDist;
}

export class PhysicsBalanceEngine {
  /**
   * Performs rigorous volumetric mass, inertia, and equilibrium stability calculations.
   */
  public calculateBalance(dna: CreatureDNA, skeleton: SkeletonBlueprint): BalanceMetrics {
    const joints = skeleton.joints;
    const segments: SegmentMass[] = [];
    const scale = dna.scale;

    // Tissue densities in kg/m^3
    const DENSITY_VISCERA = 1030; // Soft tissue / torso
    const DENSITY_MUSCLE = 1060;  // Appendicular muscle
    const DENSITY_BONE = 1350;    // Cranial / horns / skeletal core

    // 1. Pelvic Segment
    const pelvis = joints[0];
    const pelvisVol = (4 / 3) * Math.PI * pelvis.radius * (dna.thoracicDepth * 0.44 * scale) * (dna.spineLength * 0.24 * scale);
    segments.push({
      name: 'Pelvis',
      massKg: pelvisVol * DENSITY_VISCERA,
      com: [pelvis.pos[0], pelvis.pos[1], pelvis.pos[2]],
      partType: 'torso'
    });

    // 2. Thorax Segment (Heart, lungs, scapular complex)
    const thorax = joints[2];
    const humpBoost = dna.dorsalCrestAdipose * 0.35 * scale;
    const thoraxVol = (4 / 3) * Math.PI * thorax.radius * (dna.thoracicDepth * 0.52 * scale + humpBoost) * (dna.spineLength * 0.28 * scale);
    segments.push({
      name: 'Thorax',
      massKg: thoraxVol * DENSITY_VISCERA * 0.88, // lung aerated cavity reduction
      com: [thorax.pos[0], thorax.pos[1] + humpBoost * 0.25, thorax.pos[2]],
      partType: 'torso'
    });

    // 3. Lumbar Spine Bridge
    const lumbar = joints[1];
    const lumbarVol = Math.PI * Math.pow(lumbar.radius, 2) * (dna.lumbarLength * scale);
    segments.push({
      name: 'Lumbar',
      massKg: lumbarVol * DENSITY_VISCERA,
      com: [lumbar.pos[0], lumbar.pos[1], lumbar.pos[2]],
      partType: 'torso'
    });

    // 4. Cervical Neck Segments
    const neck1 = joints[3];
    const neck2 = joints[4];
    const neckVol = Math.PI * Math.pow((neck1.radius + neck2.radius) * 0.5, 2) * (dna.neckLength * scale);
    segments.push({
      name: 'Cervical_Neck',
      massKg: neckVol * DENSITY_MUSCLE,
      com: [(neck1.pos[0] + neck2.pos[0]) * 0.5, (neck1.pos[1] + neck2.pos[1]) * 0.5, (neck1.pos[2] + neck2.pos[2]) * 0.5],
      partType: 'cranial'
    });

    // 5. Skull, Snout & Mandibles
    // Anatomical bulk density accounts for pneumatized sinuses, nasal passages, and braincase (~680 kg/m³)
    const DENSITY_CRANIAL = 680;
    const head = joints[5];
    const snout = joints[6];
    const jaw = joints[7];
    let skullMass = (4 / 3) * Math.PI * Math.pow(head.radius, 3) * DENSITY_CRANIAL * 0.75;
    skullMass += Math.PI * Math.pow(snout.radius, 2) * (dna.snoutLength * scale * 0.65) * DENSITY_CRANIAL;
    skullMass += Math.PI * Math.pow(jaw.radius, 2) * (dna.snoutLength * 0.45 * scale) * DENSITY_CRANIAL;

    // Horn / Antler ballast mass (keratin density ~950 kg/m³)
    if (dna.hornType !== 'none') {
      skullMass += Math.PI * Math.pow(0.06 * scale, 2) * (dna.hornScale * scale) * 950 * 2.0;
    }

    segments.push({
      name: 'Cranium_Head',
      massKg: skullMass,
      com: [head.pos[0], head.pos[1] - 0.04 * scale, head.pos[2] + dna.snoutLength * 0.20 * scale],
      partType: 'cranial'
    });

    // 6. Caudal Tail Counterweight
    let tailTotalMass = 0;
    let tailWeightedComZ = 0;
    let tailWeightedComY = 0;
    for (let t = 0; t < skeleton.tailIndices.length; t++) {
      const tj = joints[skeleton.tailIndices[t]];
      const tVol = Math.PI * Math.pow(tj.radius, 2) * ((dna.tailLength * scale) / skeleton.tailIndices.length);
      const tMass = tVol * DENSITY_MUSCLE;
      tailTotalMass += tMass;
      tailWeightedComZ += tMass * tj.pos[2];
      tailWeightedComY += tMass * tj.pos[1];
    }
    // Tail club/tuft mass
    if (dna.tailTipStyle === 'club' && skeleton.tailIndices.length > 0) {
      const clubMass = (4 / 3) * Math.PI * Math.pow(0.16 * scale, 3) * 1100;
      const lastTj = joints[skeleton.tailIndices[skeleton.tailIndices.length - 1]];
      tailTotalMass += clubMass;
      tailWeightedComZ += clubMass * lastTj.pos[2];
      tailWeightedComY += clubMass * lastTj.pos[1];
    }
    if (tailTotalMass > 0) {
      segments.push({
        name: 'Caudal_Tail',
        massKg: tailTotalMass,
        com: [0, tailWeightedComY / tailTotalMass, tailWeightedComZ / tailTotalMass],
        partType: 'caudal'
      });
    }

    // 7. Appendicular Limbs Mass (Forelimbs, Hindlimbs)
    const legChains = [...skeleton.leftLegIndices, ...skeleton.rightLegIndices];
    for (let i = 0; i < legChains.length; i++) {
      const chain = legChains[i];
      const gJ = joints[chain[0]];
      const kJ = joints[chain[1]];
      const aJ = joints[chain[2]];
      const fJ = joints[chain[3]];

      // Thigh / Upper Arm
      const upperLen = Math.hypot(kJ.pos[0] - gJ.pos[0], kJ.pos[1] - gJ.pos[1], kJ.pos[2] - gJ.pos[2]);
      const upperVol = Math.PI * Math.pow((gJ.radius + kJ.radius) * 0.5, 2) * upperLen;
      const upperMass = upperVol * DENSITY_MUSCLE;

      // Shank / Forearm
      const lowerLen = Math.hypot(aJ.pos[0] - kJ.pos[0], aJ.pos[1] - kJ.pos[1], aJ.pos[2] - kJ.pos[2]);
      const lowerVol = Math.PI * Math.pow((kJ.radius + aJ.radius) * 0.5, 2) * lowerLen;
      const lowerMass = lowerVol * DENSITY_MUSCLE;

      // Foot / Paw
      const footLen = Math.hypot(fJ.pos[0] - aJ.pos[0], fJ.pos[1] - aJ.pos[1], fJ.pos[2] - aJ.pos[2]);
      const footVol = Math.PI * Math.pow(fJ.radius, 2) * footLen;
      const footMass = footVol * DENSITY_BONE;

      const legMass = upperMass + lowerMass + footMass;
      const legCom: [number, number, number] = [
        (gJ.pos[0] * upperMass + kJ.pos[0] * lowerMass + fJ.pos[0] * footMass) / legMass,
        (gJ.pos[1] * upperMass + kJ.pos[1] * lowerMass + fJ.pos[1] * footMass) / legMass,
        (gJ.pos[2] * upperMass + kJ.pos[2] * lowerMass + fJ.pos[2] * footMass) / legMass
      ];

      segments.push({
        name: `Limb_${i}`,
        massKg: legMass,
        com: legCom,
        partType: 'limb'
      });
    }

    // Calculate Total Mass and Whole-Body Center of Mass (CoM)
    let totalMass = 0;
    let sumMX = 0;
    let sumMY = 0;
    let sumMZ = 0;

    let cranialKg = 0;
    let torsoKg = 0;
    let caudalKg = 0;
    let limbsKg = 0;

    for (const seg of segments) {
      totalMass += seg.massKg;
      sumMX += seg.massKg * seg.com[0];
      sumMY += seg.massKg * seg.com[1];
      sumMZ += seg.massKg * seg.com[2];

      if (seg.partType === 'cranial') cranialKg += seg.massKg;
      else if (seg.partType === 'torso') torsoKg += seg.massKg;
      else if (seg.partType === 'caudal') caudalKg += seg.massKg;
      else if (seg.partType === 'limb') limbsKg += seg.massKg;
    }

    const comX = totalMass > 0 ? sumMX / totalMass : 0;
    const comY = totalMass > 0 ? sumMY / totalMass : 0.6;
    const comZ = totalMass > 0 ? sumMZ / totalMass : 0;

    // Collect Foot Contacts on the Ground
    const footContacts: FootContact[] = [];
    const polygonPoints: [number, number][] = [];
    const isBiped = skeleton.leftLegIndices.length === 1;

    // Left limbs feet:
    for (let p = 0; p < skeleton.leftLegIndices.length; p++) {
      const fIdx = skeleton.leftLegIndices[p][3];
      const fJ = joints[fIdx];
      const isForelimb = p === 0 && skeleton.leftLegIndices.length > 1;
      const footName = `Left ${isForelimb ? 'Fore' : 'Hind'} Foot`;

      // Anatomical foot support patch (radiating digits forward, plantar pad, heel/hock backward)
      const padSide = fJ.radius * 1.25;
      const padFront = fJ.radius * (isBiped ? 2.2 : 1.6);
      const padBack = fJ.radius * (isBiped ? 1.1 : 0.9);

      polygonPoints.push([fJ.pos[0] + padSide, fJ.pos[2] + padFront]);
      polygonPoints.push([fJ.pos[0] - padSide, fJ.pos[2] + padFront]);
      polygonPoints.push([fJ.pos[0] + padSide, fJ.pos[2] - padBack]);
      polygonPoints.push([fJ.pos[0] - padSide, fJ.pos[2] - padBack]);

      footContacts.push({
        name: footName,
        pos: [fJ.pos[0], 0, fJ.pos[2]],
        contactRadius: (padSide + padFront) * 0.5,
        weightLoadKg: 0,
        weightPercent: 0,
        grfNewtons: 0
      });
    }

    // Right limbs feet:
    for (let p = 0; p < skeleton.rightLegIndices.length; p++) {
      const fIdx = skeleton.rightLegIndices[p][3];
      const fJ = joints[fIdx];
      const isForelimb = p === 0 && skeleton.rightLegIndices.length > 1;
      const footName = `Right ${isForelimb ? 'Fore' : 'Hind'} Foot`;

      const padSide = fJ.radius * 1.25;
      const padFront = fJ.radius * (isBiped ? 2.2 : 1.6);
      const padBack = fJ.radius * (isBiped ? 1.1 : 0.9);

      polygonPoints.push([fJ.pos[0] + padSide, fJ.pos[2] + padFront]);
      polygonPoints.push([fJ.pos[0] - padSide, fJ.pos[2] + padFront]);
      polygonPoints.push([fJ.pos[0] + padSide, fJ.pos[2] - padBack]);
      polygonPoints.push([fJ.pos[0] - padSide, fJ.pos[2] - padBack]);

      footContacts.push({
        name: footName,
        pos: [fJ.pos[0], 0, fJ.pos[2]],
        contactRadius: (padSide + padFront) * 0.5,
        weightLoadKg: 0,
        weightPercent: 0,
        grfNewtons: 0
      });
    }

    // Compute Base of Support (BoS) Convex Hull Polygon
    const baseOfSupportPolygon = compute2DConvexHull(polygonPoints);

    // Calculate Static Stability Margin (Meters)
    const groundCoM: [number, number] = [comX, comZ];
    const stabilityMarginMeters = pointToPolygonDistance(groundCoM, baseOfSupportPolygon);

    // Determine Stability Status: positive margin means ground projected CoM is safely inside BoS
    let stabilityStatus: StabilityStatus = 'optimal';
    if (stabilityMarginMeters >= 0.06 * scale) {
      stabilityStatus = 'optimal';
    } else if (stabilityMarginMeters >= 0.00) {
      stabilityStatus = 'stable';
    } else if (stabilityMarginMeters >= -0.04 * scale) {
      stabilityStatus = 'marginal';
    } else {
      stabilityStatus = 'unstable';
    }

    // Dynamic ZMP Stability Index (0 - 100%)
    const zmpScore = THREE.MathUtils.clamp(
      Math.round(((stabilityMarginMeters + 0.1 * scale) / (0.35 * scale)) * 100),
      0,
      100
    );

    // Weight distribution across feet based on inverse distance to projected CoM
    let invDistSum = 0;
    const invDists: number[] = [];
    for (const fc of footContacts) {
      const dist = Math.hypot(fc.pos[0] - comX, fc.pos[2] - comZ);
      const invD = 1.0 / Math.max(0.1, dist);
      invDists.push(invD);
      invDistSum += invD;
    }

    let foreKg = 0;
    let hindKg = 0;
    let leftKg = 0;
    let rightKg = 0;

    for (let i = 0; i < footContacts.length; i++) {
      const frac = invDistSum > 0 ? invDists[i] / invDistSum : 1 / footContacts.length;
      const load = totalMass * frac;
      footContacts[i].weightLoadKg = Math.round(load * 10) / 10;
      footContacts[i].weightPercent = Math.round(frac * 1000) / 10;
      footContacts[i].grfNewtons = Math.round(load * 9.81);

      if (footContacts[i].name.includes('Fore')) foreKg += load;
      else hindKg += load;

      if (footContacts[i].pos[0] > 0) leftKg += load;
      else rightKg += load;
    }

    const forePercent = totalMass > 0 ? Math.round((foreKg / totalMass) * 100) : 50;
    const hindPercent = 100 - forePercent;
    const leftPercent = totalMass > 0 ? Math.round((leftKg / totalMass) * 100) : 50;
    const rightPercent = 100 - leftPercent;

    // Recommended Posture Auto-Balancing Corrections
    // If CoM is too forward (cranial overhang), tilt tail down or lengthen tail
    const targetZ = baseOfSupportPolygon.reduce((acc, p) => acc + p[1], 0) / (baseOfSupportPolygon.length || 1);
    const zError = comZ - targetZ;

    const tailPitchOffset = THREE.MathUtils.clamp(-zError * 1.5, -0.4, 0.4);
    const spineArchOffset = THREE.MathUtils.clamp(zError * 0.8, -0.2, 0.2);
    const hipOffsetZ = THREE.MathUtils.clamp(-zError * 0.5, -0.15, 0.15);
    const stanceWidthFactor = stabilityMarginMeters < 0.05 ? 1.15 : 1.0;

    return {
      totalMassKg: Math.round(totalMass),
      centerOfMass: [Math.round(comX * 1000) / 1000, Math.round(comY * 1000) / 1000, Math.round(comZ * 1000) / 1000],
      groundCoM: [Math.round(comX * 1000) / 1000, Math.round(comZ * 1000) / 1000],
      baseOfSupportPolygon,
      footContacts,
      stabilityMarginMeters: Math.round(stabilityMarginMeters * 1000) / 1000,
      stabilityStatus,
      dynamicZmpStabilityPercent: zmpScore,
      foreAftDistribution: { forePercent, hindPercent },
      lateralDistribution: { leftPercent, rightPercent },
      massBreakdown: {
        cranialKg: Math.round(cranialKg),
        torsoKg: Math.round(torsoKg),
        caudalKg: Math.round(caudalKg),
        limbsKg: Math.round(limbsKg)
      },
      recommendedPostureAdjustment: {
        tailPitchOffset,
        spineArchOffset,
        hipOffsetZ,
        stanceWidthFactor
      }
    };
  }

  /**
   * Automatically optimizes and strengthens creature anatomy when unstable or marginal.
   * Modifies the creature realistically: reinforces weight-bearing legs (femurThickness, scapulaVolume),
   * widens stance support base (pelvisWidth, thoracicWidth), and tunes caudal tail cantilever
   * until maximum physical stability is achieved.
   */
  public autoBalanceDNA(dna: CreatureDNA, skeleton: SkeletonBlueprint): CreatureDNA {
    let modified = { ...dna };
    let currentBlueprint = skeleton;
    let current = this.calculateBalance(modified, currentBlueprint);

    if (current.stabilityStatus === 'optimal' || current.stabilityStatus === 'stable') {
      return dna;
    }

    const isBiped = dna.stance === 'avian_theropod' || dna.stance === 'bipedal';

    for (let pass = 0; pass < 3; pass++) {
      currentBlueprint = buildSkeletonBlueprint(modified);
      current = this.calculateBalance(modified, currentBlueprint);

      if (current.stabilityStatus === 'optimal' || current.stabilityStatus === 'stable') {
        break;
      }

      // 1. Strengthen Limb Girdles for high-load bearing
      modified.femurThickness = Math.min(0.42, modified.femurThickness * 1.18);
      modified.scapulaVolume = Math.min(0.42, modified.scapulaVolume * 1.16);

      // 2. Adjust Stance Base Width to enlarge Base of Support (BoS)
      modified.pelvisWidth = THREE.MathUtils.clamp(modified.pelvisWidth * 1.12, 0.54, 0.88);
      modified.thoracicWidth = THREE.MathUtils.clamp(modified.thoracicWidth * 1.10, 0.56, 0.88);

      // 3. Counterbalance Cranial Overhang via Caudal Cantilever
      const targetZ = current.baseOfSupportPolygon.reduce((acc, p) => acc + p[1], 0) / (current.baseOfSupportPolygon.length || 1);
      const zError = current.centerOfMass[2] - targetZ;

      if (zError > 0 || current.stabilityStatus === 'unstable') {
        // Front-heavy: elongate and thicken tail to act as a physical cantilever counterweight
        const counterweightBoost = 1.18 + Math.min(0.5, Math.abs(zError) * 0.9);
        modified.tailLength = THREE.MathUtils.clamp(modified.tailLength * counterweightBoost, isBiped ? 1.8 : 1.2, 2.8);
        modified.tailThickness = THREE.MathUtils.clamp(modified.tailThickness * 1.20, 0.18, 0.38);
        // Arch spine to draw ribcage and head back over hip axis
        modified.spineCurvature = THREE.MathUtils.clamp(modified.spineCurvature + 0.06, 0.12, 0.38);
      } else if (zError < -0.10) {
        // Rear-heavy
        modified.spineCurvature = THREE.MathUtils.clamp(modified.spineCurvature - 0.05, 0.06, 0.35);
      }

      // 4. Stance scale fine-tuning
      if (isBiped) {
        modified.hindlimbScale = THREE.MathUtils.clamp(modified.hindlimbScale * 1.06, 0.95, 1.45);
      } else {
        const targetScale = Math.max(modified.hindlimbScale, modified.forelimbScale);
        modified.hindlimbScale = THREE.MathUtils.clamp(targetScale, 0.90, 1.30);
        modified.forelimbScale = THREE.MathUtils.clamp(targetScale, 0.90, 1.30);
      }
    }

    return modified;
  }
}

/**
 * Three.js Interactive 3D Visual Gizmo for Physics Balance:
 * Renders Center of Mass Sphere, Gravity Plumb Line, Base of Support Convex Polygon,
 * and Foot Ground Reaction Force (GRF) Vectors.
 */
export class PhysicsBalanceVisualizer {
  public group: THREE.Group;
  private comMesh: THREE.Mesh;
  private gravityLine: THREE.Line;
  private bosLine: THREE.LineLoop;
  private bosFill: THREE.Mesh;
  private footContactMeshes: THREE.Mesh[] = [];

  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'PhysicsBalanceGizmo';

    // 1. Center of Mass Sphere (Dual-core glowing sphere)
    const comGeom = new THREE.SphereGeometry(0.08, 16, 16);
    const comMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      wireframe: true,
      depthTest: false
    });
    this.comMesh = new THREE.Mesh(comGeom, comMat);
    this.comMesh.renderOrder = 999;
    this.group.add(this.comMesh);

    // Inner solid core
    const innerGeom = new THREE.SphereGeometry(0.04, 12, 12);
    const innerMat = new THREE.MeshBasicMaterial({ color: 0xffdd00 });
    const innerMesh = new THREE.Mesh(innerGeom, innerMat);
    this.comMesh.add(innerMesh);

    // 2. Gravity Plumb Line (from CoM down to ground projection)
    const lineGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, -1, 0)
    ]);
    const lineMat = new THREE.LineDashedMaterial({
      color: 0x00f0ff,
      dashSize: 0.05,
      gapSize: 0.03,
      depthTest: false
    });
    this.gravityLine = new THREE.Line(lineGeom, lineMat);
    this.gravityLine.computeLineDistances();
    this.group.add(this.gravityLine);

    // 3. Base of Support (BoS) Outline
    const bosGeom = new THREE.BufferGeometry();
    const bosMat = new THREE.LineBasicMaterial({ color: 0x10b981, linewidth: 2, depthTest: false });
    this.bosLine = new THREE.LineLoop(bosGeom, bosMat);
    this.group.add(this.bosLine);

    // 4. Base of Support Polygon Translucent Fill
    const fillGeom = new THREE.BufferGeometry();
    const fillMat = new THREE.MeshBasicMaterial({
      color: 0x10b981,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    this.bosFill = new THREE.Mesh(fillGeom, fillMat);
    this.bosFill.rotation.x = -Math.PI / 2;
    this.bosFill.position.y = 0.005;
    this.group.add(this.bosFill);
  }

  public update(metrics: BalanceMetrics) {
    const com = metrics.centerOfMass;
    this.comMesh.position.set(com[0], com[1], com[2]);

    // Update gravity line
    const linePositions = new Float32Array([
      com[0], com[1], com[2],
      com[0], 0.01, com[2]
    ]);
    this.gravityLine.geometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
    this.gravityLine.computeLineDistances();

    // Color code based on stability status
    let statusColor = 0x10b981; // Green = stable
    if (metrics.stabilityStatus === 'marginal') statusColor = 0xf59e0b; // Amber
    else if (metrics.stabilityStatus === 'unstable') statusColor = 0xef4444; // Red

    (this.bosLine.material as THREE.LineBasicMaterial).color.setHex(statusColor);
    (this.bosFill.material as THREE.MeshBasicMaterial).color.setHex(statusColor);

    // Update Base of Support Polygon vertices
    const poly = metrics.baseOfSupportPolygon;
    if (poly.length >= 3) {
      const linePts: THREE.Vector3[] = [];
      const shapePts: THREE.Vector2[] = [];

      for (const pt of poly) {
        linePts.push(new THREE.Vector3(pt[0], 0.01, pt[1]));
        shapePts.push(new THREE.Vector2(pt[0], -pt[1]));
      }

      this.bosLine.geometry.setFromPoints(linePts);

      const shape = new THREE.Shape(shapePts);
      this.bosFill.geometry.dispose();
      this.bosFill.geometry = new THREE.ShapeGeometry(shape);
      this.bosFill.visible = true;
      this.bosLine.visible = true;
    } else {
      this.bosFill.visible = false;
      this.bosLine.visible = false;
    }

    // Foot Contacts Visualizer
    while (this.footContactMeshes.length < metrics.footContacts.length) {
      const ringGeom = new THREE.RingGeometry(0.04, 0.08, 16);
      ringGeom.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(ringGeom, ringMat);
      this.group.add(mesh);
      this.footContactMeshes.push(mesh);
    }

    for (let i = 0; i < this.footContactMeshes.length; i++) {
      if (i < metrics.footContacts.length) {
        const fc = metrics.footContacts[i];
        this.footContactMeshes[i].position.set(fc.pos[0], 0.008, fc.pos[2]);
        this.footContactMeshes[i].visible = true;
      } else {
        this.footContactMeshes[i].visible = false;
      }
    }
  }

  public setVisible(visible: boolean) {
    this.group.visible = visible;
  }
}
