/**
 * Scientific Procedural Animation & Kinematics Engine.
 * Dynamically computes gait cycles, inverse/forward kinematics, spine undulations,
 * and generates exportable keyframe animation clips for Unity Animator.
 */

import * as THREE from 'three';
import { CreatureDNA } from './dna';
import { RiggedCreature } from './rigging';

export type GaitType = 'idle' | 'walk' | 'trot' | 'gallop' | 'prowl' | 'roar';

export interface GaitConfig {
  type: GaitType;
  speed: number;
  spineFlexAmp: number;
  legLiftAmp: number;
  jawOpenAmp: number;
}

export class ProceduralAnimationEngine {
  public currentGait: GaitType = 'walk';
  public playbackSpeed: number = 1.0;
  public isPaused: boolean = false;
  private animTime: number = 0;

  // Cached joint kinematics for muscle deformation engine
  public currentKinematics = {
    spinePitch: 0,
    hipAngle: 0,
    kneeAngle: 0,
    shoulderAngle: 0,
    jawGape: 0
  };

  public setGait(gait: GaitType) {
    this.currentGait = gait;
  }

  /**
   * Evaluates bone orientations and root displacement for the current frame.
   */
  public update(
    rig: RiggedCreature,
    dna: CreatureDNA,
    deltaSeconds: number
  ) {
    if (!this.isPaused) {
      this.animTime += deltaSeconds * this.playbackSpeed;
    }

    const t = this.animTime;
    const bones = rig.bones;
    const boneMap = new Map<string, THREE.Bone>();
    for (const b of bones) boneMap.set(b.name, b);

    // Reset default rotations
    for (const b of bones) {
      b.rotation.set(0, 0, 0);
    }

    const gait = this.currentGait;
    const isBiped = dna.stance === 'avian_theropod' || dna.stance === 'bipedal';
    const isHexapod = dna.stance === 'hexapodal';

    let gaitFreq = 3.2;
    let spineFlex = 0.15;
    let legSwing = 0.45;
    let footLift = 0.22;
    let jawGape = 0.0;
    let headPitch = 0.0;
    let rootHeave = 0.04;

    switch (gait) {
      case 'idle':
        gaitFreq = 1.4;
        spineFlex = 0.03;
        legSwing = 0.02;
        footLift = 0.0;
        rootHeave = 0.015;
        headPitch = Math.sin(t * 1.8) * 0.05;
        // Subtle respiratory mouth movement during idle
        jawGape = Math.max(0, Math.sin(t * 1.5)) * 0.08;
        break;
      case 'walk':
        gaitFreq = isBiped ? 2.6 : 3.0;
        spineFlex = isBiped ? 0.06 : 0.10;
        legSwing = isBiped ? 0.22 : 0.36;
        footLift = isBiped ? 0.15 : 0.22;
        rootHeave = isBiped ? 0.025 : 0.035;
        jawGape = Math.max(0, Math.sin(t * 2.4)) * 0.09;
        break;
      case 'trot':
        gaitFreq = isBiped ? 3.8 : 4.4;
        spineFlex = isBiped ? 0.10 : 0.18;
        legSwing = isBiped ? 0.28 : 0.48;
        footLift = isBiped ? 0.20 : 0.30;
        rootHeave = isBiped ? 0.04 : 0.06;
        jawGape = Math.max(0, Math.sin(t * 3.6)) * 0.14;
        break;
      case 'gallop':
        gaitFreq = isBiped ? 4.4 : 5.2;
        spineFlex = isBiped ? 0.18 : 0.32;
        legSwing = isBiped ? 0.35 : 0.58;
        footLift = isBiped ? 0.25 : 0.38;
        rootHeave = isBiped ? 0.06 : 0.09;
        jawGape = Math.max(0, Math.sin(t * 4.8)) * 0.22 + 0.05;
        break;
      case 'prowl':
        gaitFreq = 1.8;
        spineFlex = isBiped ? 0.05 : 0.07;
        legSwing = isBiped ? 0.18 : 0.32;
        footLift = isBiped ? 0.12 : 0.18;
        rootHeave = 0.025;
        headPitch = -0.15; // crouched stealth
        jawGape = Math.max(0, Math.sin(t * 2.8)) * 0.12 + 0.03;
        break;
      case 'roar':
        gaitFreq = 1.8;
        spineFlex = -0.28; // rearing back
        legSwing = 0.04;
        footLift = 0.0;
        rootHeave = 0.06;
        jawGape = Math.max(0, Math.sin(t * 2.5)) * 0.75;
        headPitch = 0.42; // head flung back
        break;
    }

    const phase = t * gaitFreq;

    // 1. Root & Pelvis Anchor:
    // Natural pelvic yaw, roll, and vertical heave driven by the hind leg strides:
    const root = boneMap.get('Root_Pelvis');
    if (root) {
      if (gait === 'idle' || gait === 'roar') {
        root.position.copy(rig.boneWorldPositions[0]);
        root.rotation.set(0, 0, 0);
      } else if (isBiped) {
        // Bipedal weight-transfer: lateral sway over the supporting stance foot
        const swayX = Math.sin(phase) * 0.038 * dna.scale;
        const pelvicRoll = Math.sin(phase) * 0.045; // slight roll toward swing side
        const pelvicYaw = Math.sin(phase) * 0.07;   // pelvis rotates forward with swing leg
        const pelvicPitch = Math.cos(phase * 2.0) * 0.025; // rhythmic stride pitch
        const bipedHeave = (1.0 - Math.cos(phase * 2.0)) * 0.5 * rootHeave;

        root.rotation.set(pelvicPitch, pelvicYaw, pelvicRoll);
        root.position.set(
          rig.boneWorldPositions[0].x + swayX,
          rig.boneWorldPositions[0].y + bipedHeave,
          rig.boneWorldPositions[0].z
        );
      } else {
        // Quadruped / Hexapod pelvic undulation
        const pelvicYaw = Math.sin(phase) * (spineFlex * 0.40);
        const pelvicRoll = Math.sin(phase) * (spineFlex * 0.25);
        const pelvicPitch = Math.cos(phase * 2.0) * (spineFlex * 0.20);
        const heaveY = Math.sin(phase * 2.0) * rootHeave;

        root.rotation.set(pelvicPitch, pelvicYaw, pelvicRoll);
        root.position.set(
          rig.boneWorldPositions[0].x,
          rig.boneWorldPositions[0].y + Math.max(-0.015, heaveY),
          rig.boneWorldPositions[0].z
        );
      }
    }

    // 2. Spine & Ribcage flex
    const lumbar = boneMap.get('Spine_Lumbar');
    if (lumbar) {
      if (isBiped) {
        lumbar.rotation.y = -Math.sin(phase) * 0.05;
        lumbar.rotation.x = Math.cos(phase * 2.0) * 0.03;
      } else {
        lumbar.rotation.y = -Math.sin(phase) * (spineFlex * 0.85);
        lumbar.rotation.x = Math.cos(phase * 2.0) * (spineFlex * 0.45);
      }
    }

    const thorax = boneMap.get('Spine_Thorax');
    if (thorax) {
      if (isBiped) {
        thorax.rotation.y = Math.sin(phase) * 0.04;
        thorax.rotation.x = Math.sin(phase * 2.0) * 0.02;
      } else {
        thorax.rotation.y = Math.sin(phase) * (spineFlex * 0.60);
        thorax.rotation.x = Math.sin(phase * 2.0) * (spineFlex * 0.25);
      }
    }

    // 3. Neck & Cranium (Dynamic biological awareness & look-around)
    const headLookYaw = (Math.sin(t * 0.8) * 0.10 + Math.sin(t * 0.25) * 0.12);
    const neckBase = boneMap.get('Neck_Base');
    if (neckBase) {
      neckBase.rotation.x = headPitch + Math.sin(phase) * 0.06;
      neckBase.rotation.y = Math.sin(phase) * 0.05 + headLookYaw * 0.4;
    }
    const neckUpper = boneMap.get('Neck_Upper');
    if (neckUpper) {
      neckUpper.rotation.x = headPitch * 0.5 + Math.cos(phase) * 0.04;
      neckUpper.rotation.y = headLookYaw * 0.3;
    }
    const head = boneMap.get('Head_Cranium');
    if (head) {
      head.rotation.x = headPitch * 0.3;
      head.rotation.y = headLookYaw * 0.5;
    }
    const jaw = boneMap.get('Mandible_Jaw');
    if (jaw) {
      jaw.rotation.x = jawGape;
    }

    // 4. Caudal Tail Undulation (Counterbalancing wave)
    for (let i = 1; i <= 4; i++) {
      const tailSeg = boneMap.get(`Tail_Segment_${i}`);
      if (tailSeg) {
        const tailLag = i * 0.40;
        if (isBiped) {
          tailSeg.rotation.y = -Math.sin(phase - tailLag) * (0.12 + i * 0.05);
          tailSeg.rotation.x = Math.cos(phase * 2.0 - tailLag) * (0.04 + i * 0.02);
        } else {
          tailSeg.rotation.y = -Math.sin(phase - tailLag) * (0.20 + i * 0.08);
          tailSeg.rotation.x = Math.cos(phase * 2.0 - tailLag) * (0.08 + i * 0.04);
        }
      }
    }

    // 5. Appendicular Limbs Animation with Zero-Jitter Continuous Foot Ground Planting
    // Stance phase: foot is firmly planted on ground surface, carrying weight without midair swinging.
    // Swing phase: foot lifts cleanly into midair, swings forward, and touches down with C1 boundary continuity.
    const limbPairsCount = dna.limbPairs;

    let stanceDuty = 0.65;
    if (gait === 'idle' || gait === 'roar') stanceDuty = 1.0;
    else if (gait === 'prowl') stanceDuty = 0.72;
    else if (gait === 'trot') stanceDuty = 0.52;
    else if (gait === 'gallop') stanceDuty = 0.42;
    if (isBiped && (gait === 'walk' || gait === 'prowl')) stanceDuty = 0.60;

    type LimbRole = 'fore' | 'mid' | 'hind' | 'biped';

    const evaluateLimbKinematics = (phaseVal: number, role: LimbRole) => {
      if (stanceDuty >= 0.999) {
        // Idle / Roar: 100% grounded stance carrying weight
        if (role === 'biped') {
          return { girdle: 0.0, knee: -0.38, ankle: 0.20, isStance: true };
        }
        return { girdle: 0.0, knee: 0.0, ankle: 0.0, isStance: true };
      }

      // Normalized phase in [0, 1)
      const tau = ((phaseVal / (Math.PI * 2.0)) % 1.0 + 1.0) % 1.0;

      if (tau < stanceDuty) {
        // ==========================================
        // STANCE PHASE: Planted on the ground bearing the creature's weight.
        // ==========================================
        const s = tau / stanceDuty; // [0, 1)
        const girdle = -legSwing * Math.cos(Math.PI * s);
        const groundFlex = Math.sin(Math.PI * s) * ((1.0 - Math.cos(legSwing)) * 1.8 + 0.04);

        let knee = 0;
        let ankle = 0;

        if (role === 'biped') {
          // Bipedal digitigrade stance: knee maintained in biological crouch (~ -0.38 rad)
          // Yields smoothly during midstance to absorb weight
          const stanceYield = Math.sin(Math.PI * s) * 0.16;
          knee = -0.38 - stanceYield;
          ankle = 0.18 - girdle * 0.55 + stanceYield * 0.35;
        } else if (role === 'mid') {
          // Hexapod middle limb: moderate stance flexion
          knee = THREE.MathUtils.clamp(-groundFlex * 0.40, -0.30, 0.0);
          ankle = THREE.MathUtils.clamp(-(girdle * 0.55 + knee * 0.35), -0.35, 0.35);
        } else if (role === 'fore') {
          // Forelimb Elbow: bends forward (+rotation) to absorb weight smoothly
          knee = THREE.MathUtils.clamp(groundFlex * 0.45, 0.0, 0.35);
          ankle = THREE.MathUtils.clamp(-(girdle * 0.70 + knee * 0.50), -0.45, 0.45);
        } else {
          // Hindlimb Knee: bends backward (-rotation) naturally under load bearing
          knee = THREE.MathUtils.clamp(-groundFlex * 0.60, -0.45, 0.0);
          ankle = THREE.MathUtils.clamp(-(girdle * 0.70 + knee * 0.55), -0.45, 0.45);
        }

        return { girdle, knee, ankle, isStance: true };
      } else {
        // ==========================================
        // SWING PHASE: In midair, leg lifts off ground and swings from BACKWARD to FORWARD.
        // ==========================================
        const u = (tau - stanceDuty) / (1.0 - stanceDuty); // [0, 1)
        const girdle = legSwing * Math.cos(Math.PI * u);
        const lift = Math.sin(Math.PI * u) * footLift;

        let knee = 0;
        let ankle = 0;

        if (role === 'biped') {
          // Bipedal swing: knee remains flexed throughout the swing, folding the lower leg under the body
          // and smoothly opening back to -0.38 for touchdown. NEVER extends straight (eliminates kicking!)
          const liftArc = Math.sin(Math.PI * u);
          knee = -0.38 - liftArc * 0.35;
          const ankleTrail = u < 0.35 ? Math.sin(Math.PI * (u / 0.35)) * 0.16 : 0;
          const toeLift = Math.sin(Math.PI * u) * 0.20;
          ankle = 0.18 - girdle * 0.50 - ankleTrail + toeLift;
        } else if (role === 'mid') {
          // Hexapod middle limb swing
          knee = THREE.MathUtils.clamp(-lift * 1.1, -0.45, 0.0);
          ankle = THREE.MathUtils.clamp(-girdle * 0.50 + Math.sin(Math.PI * u) * 0.22, -0.35, 0.35);
        } else if (role === 'fore') {
          // Forelimb Elbow: flexes forward (+rotation) to lift forearm under chest
          knee = THREE.MathUtils.clamp(lift * 1.6, 0.0, 0.65);
          ankle = THREE.MathUtils.clamp(-girdle * 0.50 - Math.sin(Math.PI * u) * 0.22, -0.50, 0.35);
        } else {
          // Hindlimb Knee (Stifle): flexes backward as foot picks up,
          // then smoothly extends forward as the leg reaches forward to plant.
          const tuckPhase = Math.sin(Math.PI * Math.pow(u, 0.85));
          knee = THREE.MathUtils.clamp(-tuckPhase * footLift * 2.0, -0.75, 0.0);
          const baseAnkle = -girdle * 0.65;
          const toeClearance = Math.sin(Math.PI * u) * 0.30;
          ankle = THREE.MathUtils.clamp(baseAnkle + toeClearance, -0.45, 0.45);
        }

        return { girdle, knee, ankle, isStance: false };
      }
    };

    for (let p = 0; p < limbPairsCount; p++) {
      const isFore = p === 0 && limbPairsCount > 1;

      let role: LimbRole = 'hind';
      if (isBiped) {
        role = 'biped';
      } else if (isHexapod) {
        if (p === 0) role = 'fore';
        else if (p === 1) role = 'mid';
        else role = 'hind';
      } else {
        role = isFore ? 'fore' : 'hind';
      }

      let leftPhase = phase;
      let rightPhase = phase + Math.PI;

      if (isBiped) {
        // Biped: Clean alternating strides with lateral weight transfer
        leftPhase = phase;
        rightPhase = phase + Math.PI;
      } else if (limbPairsCount === 2) {
        if (gait === 'walk' || gait === 'prowl') {
          // Authentic Lateral Sequence Walk:
          // 1. Left Hind (phase) picks up first -> moves forward
          // 2. Left Fore (phase - 0.5π) picks up second -> moves forward
          // 3. Right Hind (phase - π) picks up third -> moves forward
          // 4. Right Fore (phase - 1.5π) picks up fourth -> moves forward
          if (isFore) {
            leftPhase = phase - 0.5 * Math.PI;
            rightPhase = phase - 1.5 * Math.PI;
          } else {
            leftPhase = phase;
            rightPhase = phase - Math.PI;
          }
        } else if (gait === 'gallop') {
          // Rotary Gallop: Back legs kick off first, then forelegs reach out
          if (isFore) {
            leftPhase = phase - 0.80 * Math.PI;
            rightPhase = phase - 0.60 * Math.PI;
          } else {
            leftPhase = phase;
            rightPhase = phase + 0.20 * Math.PI;
          }
        } else if (gait === 'trot') {
          // Trot: Diagonal pairs move together, hind leads
          if (isFore) {
            leftPhase = phase + Math.PI - 0.08 * Math.PI;
            rightPhase = phase - 0.08 * Math.PI;
          } else {
            leftPhase = phase;
            rightPhase = phase + Math.PI;
          }
        }
      } else if (isHexapod) {
        // Authentic Alternating Tripod Gait for 6-legged organisms:
        // Tripod 1: Left Fore (p=0), Right Mid (p=1), Left Rear (p=2) move together!
        // Tripod 2: Right Fore (p=0), Left Mid (p=1), Right Rear (p=2) move together!
        if (p === 1) {
          leftPhase = phase + Math.PI;
          rightPhase = phase;
        } else {
          leftPhase = phase;
          rightPhase = phase + Math.PI;
        }
      }

      // Bone References
      const lGirdle = boneMap.get(`L_Girdle_${p}`);
      const lKnee = boneMap.get(isFore ? `L_Elbow_${p}` : `L_Knee_${p}`);
      const lAnkle = boneMap.get(isFore ? `L_Wrist_${p}` : `L_Ankle_${p}`);
      const rGirdle = boneMap.get(`R_Girdle_${p}`);
      const rKnee = boneMap.get(isFore ? `R_Elbow_${p}` : `R_Knee_${p}`);
      const rAnkle = boneMap.get(isFore ? `R_Wrist_${p}` : `R_Ankle_${p}`);

      // Evaluate Continuous Jitter-Free Kinematics
      const lKin = evaluateLimbKinematics(leftPhase, role);
      const rKin = evaluateLimbKinematics(rightPhase, role);

      // Apply to Left Limb
      if (lGirdle) lGirdle.rotation.x = lKin.girdle;
      if (lKnee) lKnee.rotation.x = lKin.knee;
      if (lAnkle) lAnkle.rotation.x = lKin.ankle;

      // Apply to Right Limb
      if (rGirdle) rGirdle.rotation.x = rKin.girdle;
      if (rKnee) rKnee.rotation.x = rKin.knee;
      if (rAnkle) rAnkle.rotation.x = rKin.ankle;

      // Record representative kinematics for deep learning muscle deformation
      if (p === 0) {
        this.currentKinematics.shoulderAngle = lKin.girdle;
      }
      if (p === limbPairsCount - 1) {
        this.currentKinematics.hipAngle = lKin.girdle;
        this.currentKinematics.kneeAngle = lKin.knee;
      }
    }

    this.currentKinematics.spinePitch = spineFlex;
    this.currentKinematics.jawGape = jawGape;
  }

  /**
   * Generates genuine THREE.AnimationClip for export to GLTF/Unity.
   */
  public generateExportableClips(rig: RiggedCreature, dna: CreatureDNA): THREE.AnimationClip[] {
    const clips: THREE.AnimationClip[] = [];
    const gaits: GaitType[] = ['idle', 'walk', 'gallop', 'roar'];

    for (const gait of gaits) {
      const duration = gait === 'idle' ? 3.0 : gait === 'walk' ? 1.2 : gait === 'gallop' ? 0.7 : 2.5;
      const fps = 30;
      const frameCount = Math.floor(duration * fps);
      const tracks: THREE.KeyframeTrack[] = [];

      // Sample each bone rotation over time
      for (const bone of rig.bones) {
        const times = new Float32Array(frameCount);
        const values = new Float32Array(frameCount * 4); // quaternions

        for (let f = 0; f < frameCount; f++) {
          const simTime = (f / fps);
          times[f] = simTime;

          // Temporary engine state evaluation
          const savedGait = this.currentGait;
          const savedTime = this.animTime;
          this.currentGait = gait;
          this.animTime = simTime;
          this.update(rig, dna, 0);

          const q = bone.quaternion;
          values[f * 4] = q.x;
          values[f * 4 + 1] = q.y;
          values[f * 4 + 2] = q.z;
          values[f * 4 + 3] = q.w;

          this.currentGait = savedGait;
          this.animTime = savedTime;
        }

        const trackName = `${bone.name}.quaternion`;
        tracks.push(new THREE.QuaternionKeyframeTrack(trackName, times as unknown as number[], values as unknown as number[]));
      }

      clips.push(new THREE.AnimationClip(gait.toUpperCase(), duration, tracks));
    }

    return clips;
  }
}
