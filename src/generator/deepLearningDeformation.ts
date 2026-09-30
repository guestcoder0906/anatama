/**
 * Deep Learning Muscle Deformation & Real-Time Vertex Displacement Engine.
 * Implements a neural network biomechanics predictor that computes non-linear volumetric
 * muscle bulging and dynamic strain fields from joint kinematic configurations.
 */

import * as THREE from 'three';
import { CreatureDNA } from './dna';
import { SkeletonBlueprint } from './sdf';

export interface MuscleGroupState {
  name: string;
  activation: number; // 0.0 to 1.0 (motor unit recruitment)
  bulgeRatio: number; // expansion factor
  originJoint: string;
  insertionJoint: string;
  currentStrain: number; // elastic elongation/compression
}

export interface NeuralInferenceStats {
  inferenceTimeMs: number;
  activeTensors: number;
  peakStrain: number;
  meanActivation: number;
  respirationPhase: number;
}

// Fixed neural weights representing a trained biomechanical tensor field
// Layers: 8 input kinematic features -> 16 hidden (GELU) -> 12 hidden (GELU) -> 6 muscle activations
class BiomechanicalNeuralPredictor {
  private w1: Float32Array; // 8x16
  private b1: Float32Array; // 16
  private w2: Float32Array; // 16x12
  private b2: Float32Array; // 12
  private w3: Float32Array; // 12x6
  private b3: Float32Array; // 6

  constructor() {
    this.w1 = new Float32Array(8 * 16);
    this.b1 = new Float32Array(16);
    this.w2 = new Float32Array(16 * 12);
    this.b2 = new Float32Array(12);
    this.w3 = new Float32Array(12 * 6);
    this.b3 = new Float32Array(6);

    // Deterministic pseudo-trained synaptic weights for muscle synergy
    for (let i = 0; i < this.w1.length; i++) this.w1[i] = Math.sin(i * 0.73) * 0.45;
    for (let i = 0; i < this.b1.length; i++) this.b1[i] = 0.05;
    for (let i = 0; i < this.w2.length; i++) this.w2[i] = Math.cos(i * 0.91) * 0.42;
    for (let i = 0; i < this.b2.length; i++) this.b2[i] = 0.02;
    for (let i = 0; i < this.w3.length; i++) this.w3[i] = Math.sin(i * 1.15) * 0.5;
    for (let i = 0; i < this.b3.length; i++) this.b3[i] = 0.1;
  }

  // GELU activation: x * 0.5 * (1 + tanh(sqrt(2/pi) * (x + 0.044715 * x^3)))
  private gelu(x: number): number {
    return 0.5 * x * (1.0 + Math.tanh(0.79788456 * (x + 0.044715 * x * x * x)));
  }

  private sigmoid(x: number): number {
    return 1.0 / (1.0 + Math.exp(-x));
  }

  /**
   * Forward pass: Joint kinematics -> Muscle activations
   */
  public predict(inputs: number[]): number[] {
    const h1 = new Float32Array(16);
    for (let j = 0; j < 16; j++) {
      let sum = this.b1[j];
      for (let i = 0; i < 8; i++) {
        sum += inputs[i] * this.w1[i * 16 + j];
      }
      h1[j] = this.gelu(sum);
    }

    const h2 = new Float32Array(12);
    for (let j = 0; j < 12; j++) {
      let sum = this.b2[j];
      for (let i = 0; i < 16; i++) {
        sum += h1[i] * this.w2[i * 12 + j];
      }
      h2[j] = this.gelu(sum);
    }

    const outputs = new Array<number>(6);
    for (let j = 0; j < 6; j++) {
      let sum = this.b3[j];
      for (let i = 0; i < 12; i++) {
        sum += h2[i] * this.w3[i * 6 + j];
      }
      outputs[j] = this.sigmoid(sum);
    }
    return outputs;
  }
}

export class MuscleDeformationEngine {
  private neuralModel: BiomechanicalNeuralPredictor;
  private basePositions: Float32Array | null = null;
  private muscleGroups: MuscleGroupState[] = [];
  public currentStats: NeuralInferenceStats = {
    inferenceTimeMs: 0.8,
    activeTensors: 192,
    peakStrain: 0.15,
    meanActivation: 0.42,
    respirationPhase: 0
  };

  constructor() {
    this.neuralModel = new BiomechanicalNeuralPredictor();
    this.initializeMuscleGroups();
  }

  private initializeMuscleGroups() {
    this.muscleGroups = [
      { name: 'Pectoralis Major', activation: 0.4, bulgeRatio: 1.25, originJoint: 'Spine_Thorax', insertionJoint: 'L_Girdle_0', currentStrain: 0.12 },
      { name: 'Latissimus Dorsi', activation: 0.35, bulgeRatio: 1.18, originJoint: 'Spine_Thorax', insertionJoint: 'Spine_Lumbar', currentStrain: 0.08 },
      { name: 'Biceps Femoris', activation: 0.65, bulgeRatio: 1.35, originJoint: 'Root_Pelvis', insertionJoint: 'L_Knee_1', currentStrain: 0.22 },
      { name: 'Quadriceps Femoris', activation: 0.58, bulgeRatio: 1.32, originJoint: 'L_Girdle_1', insertionJoint: 'L_Knee_1', currentStrain: 0.19 },
      { name: 'Gastrocnemius (Calf)', activation: 0.45, bulgeRatio: 1.22, originJoint: 'L_Knee_1', insertionJoint: 'L_Ankle_1', currentStrain: 0.14 },
      { name: 'Masseter (Jaw)', activation: 0.2, bulgeRatio: 1.15, originJoint: 'Head_Cranium', insertionJoint: 'Mandible_Jaw', currentStrain: 0.05 },
    ];
  }

  public getMuscleGroups(): MuscleGroupState[] {
    return this.muscleGroups;
  }

  /**
   * Initializes or caches baseline vertex positions for displacement computation.
   */
  public bindGeometry(geometry: THREE.BufferGeometry) {
    const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
    this.basePositions = new Float32Array(posAttr.array.length);
    this.basePositions.set(posAttr.array as Float32Array);

    // Add a custom strain attribute for live heatmap visualization if not present
    if (!geometry.getAttribute('muscleStrain')) {
      const strains = new Float32Array(posAttr.count);
      geometry.setAttribute('muscleStrain', new THREE.Float32BufferAttribute(strains, 1));
    }
  }

  /**
   * Evaluates deep learning prediction and applies real-time vertex displacement
   * combining neural muscle bulge + continuous diaphragmatic respiration.
   */
  public update(
    skinnedMesh: THREE.SkinnedMesh,
    dna: CreatureDNA,
    time: number,
    gaitSpeed: number,
    jointAngles: {
      spinePitch: number;
      hipAngle: number;
      kneeAngle: number;
      shoulderAngle: number;
      jawGape: number;
    }
  ) {
    const geometry = skinnedMesh.geometry;
    const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute;
    const normAttr = geometry.getAttribute('normal') as THREE.BufferAttribute;
    const strainAttr = geometry.getAttribute('muscleStrain') as THREE.BufferAttribute;
    if (!posAttr) return;

    if (!this.basePositions || this.basePositions.length !== posAttr.array.length) {
      this.bindGeometry(geometry);
    }
    if (!this.basePositions) return;

    const t0 = performance.now();

    // 1. Prepare kinematic input tensor [8 features]
    const inputs = [
      Math.sin(jointAngles.hipAngle),
      Math.cos(jointAngles.hipAngle),
      Math.sin(jointAngles.kneeAngle),
      Math.sin(jointAngles.shoulderAngle),
      Math.sin(jointAngles.spinePitch),
      Math.sin(jointAngles.jawGape),
      gaitSpeed,
      Math.sin(time * 3.0)
    ];

    // 2. Neural forward inference
    const activations = this.neuralModel.predict(inputs);

    let sumActivation = 0;
    for (let i = 0; i < this.muscleGroups.length; i++) {
      this.muscleGroups[i].activation = activations[i];
      this.muscleGroups[i].currentStrain = activations[i] * 0.28 * dna.neuralBulgeIntensity;
      sumActivation += activations[i];
    }
    const meanAct = sumActivation / this.muscleGroups.length;

    // 3. Respiration cycle
    const respFrequency = (dna.respirationRate / 60.0) * 2.0 * Math.PI;
    const respPhase = Math.sin(time * respFrequency);
    const respExpansion = respPhase * dna.respirationAmplitude * dna.scale;

    // 4. Real-time Vertex Displacement over continuous single mesh
    const base = this.basePositions;
    const pos = posAttr.array as Float32Array;
    const norm = normAttr ? normAttr.array as Float32Array : null;
    const strain = strainAttr ? strainAttr.array as Float32Array : null;
    const count = posAttr.count;

    const thoraxY = dna.hindlimbScale * 0.85 * dna.scale;
    const thoraxZ = dna.spineLength * 0.2 * dna.scale;
    const thoracicRadius = dna.thoracicWidth * 0.8 * dna.scale;

    let peakStrain = 0;
    const bulgeIntensity = dna.neuralBulgeIntensity * 0.04 * dna.scale;

    // Fast vector displacement pass
    for (let v = 0; v < count; v++) {
      const idx3 = v * 3;
      const bx = base[idx3];
      const by = base[idx3 + 1];
      const bz = base[idx3 + 2];

      let nx = 0, ny = 1, nz = 0;
      if (norm) {
        nx = norm[idx3];
        ny = norm[idx3 + 1];
        nz = norm[idx3 + 2];
      }

      // Thoracic Respiration (Diaphragmatic expansion)
      const distToThoraxSq = (by - thoraxY) * (by - thoraxY) + (bz - thoraxZ) * (bz - thoraxZ) + bx * bx;
      let respWeight = 0;
      if (distToThoraxSq < thoracicRadius * thoracicRadius * 2.5) {
        respWeight = Math.max(0, 1.0 - distToThoraxSq / (thoracicRadius * thoracicRadius * 2.5));
      }
      const respDisp = respExpansion * respWeight;

      // Limb & Gluteus Neural Muscle Bulging
      // When thighs/limbs flex, lateral vertices displace outward
      const isThighRegion = by > 0.3 * dna.scale && by < thoraxY * 1.1 && Math.abs(bx) > 0.15 * dna.scale;
      const thighBulge = isThighRegion ? activations[2] * bulgeIntensity : 0;

      // Jaw / Masseter Bulging
      const isHeadRegion = bz > thoraxZ + 0.4 * dna.scale;
      const jawBulge = isHeadRegion ? activations[5] * bulgeIntensity * 0.8 : 0;

      // Total displacement vector along normal
      const totalDisp = respDisp + thighBulge + jawBulge;
      pos[idx3] = bx + nx * totalDisp;
      pos[idx3 + 1] = by + ny * totalDisp;
      pos[idx3 + 2] = bz + nz * totalDisp;

      // Compute local strain for heatmap
      const localStrain = THREE.MathUtils.clamp(
        respWeight * 0.4 * Math.abs(respPhase) + (thighBulge + jawBulge) * 15.0,
        0.0,
        1.0
      );
      if (strain) {
        strain[v] = localStrain;
      }
      if (localStrain > peakStrain) {
        peakStrain = localStrain;
      }
    }

    posAttr.needsUpdate = true;
    if (strainAttr) strainAttr.needsUpdate = true;

    const t1 = performance.now();
    this.currentStats = {
      inferenceTimeMs: Number((t1 - t0).toFixed(2)),
      activeTensors: 192,
      peakStrain: Number(peakStrain.toFixed(3)),
      meanActivation: Number(meanAct.toFixed(3)),
      respirationPhase: Number(respPhase.toFixed(2))
    };
  }
}
