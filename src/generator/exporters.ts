/**
 * Comprehensive Game Engine Export System (Unity, Unreal, Blender, Godot).
 * Produces rigged GLB models with embedded animations, OBJ wavefront files,
 * Unity C# controller scripts, and scientific anatomical biomechanics dossiers.
 */

import * as THREE from 'three';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { CreatureDNA } from './dna';
import { RiggedCreature } from './rigging';
import { ProceduralAnimationEngine } from './proceduralAnimation';

export interface ExportProgress {
  status: 'idle' | 'generating' | 'done' | 'error';
  message: string;
}

// Download blob helper
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/**
 * Exports rigged creature as binary GLTF (.glb) with embedded procedural animation clips.
 */
export async function exportToGLTF(
  rig: RiggedCreature,
  dna: CreatureDNA,
  animEngine: ProceduralAnimationEngine
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const exporter = new GLTFExporter();

    // Generate animation clips
    const clips = animEngine.generateExportableClips(rig, dna);

    // Create a export scene root containing the skinned mesh and bones
    const exportScene = new THREE.Scene();
    exportScene.name = dna.scientificName.replace(/\s+/g, '_');
    exportScene.add(rig.skinnedMesh);

    const options = {
      binary: true,
      animations: clips,
      onlyVisible: true,
      truncateDrawRange: true,
      embedImages: true
    };

    exporter.parse(
      exportScene,
      (result) => {
        if (result instanceof ArrayBuffer) {
          const blob = new Blob([result], { type: 'model/gltf-binary' });
          resolve(blob);
        } else {
          const jsonString = JSON.stringify(result, null, 2);
          const blob = new Blob([jsonString], { type: 'application/json' });
          resolve(blob);
        }
      },
      (error) => {
        reject(error);
      },
      options
    );
  });
}

/**
 * Exports mesh to standard Wavefront OBJ format.
 */
export function exportToOBJ(geometry: THREE.BufferGeometry, dna: CreatureDNA): Blob {
  const posAttr = geometry.getAttribute('position');
  const normAttr = geometry.getAttribute('normal');
  const uvAttr = geometry.getAttribute('uv');

  let obj = `# Anatoma3D Procedural Creature Specimen\n`;
  obj += `# Scientific Name: ${dna.scientificName}\n`;
  obj += `# Taxonomic Class: ${dna.taxonomicClass}\n`;
  obj += `# Seed: ${dna.seed}\n\n`;

  // Vertices
  for (let i = 0; i < posAttr.count; i++) {
    obj += `v ${posAttr.getX(i).toFixed(5)} ${posAttr.getY(i).toFixed(5)} ${posAttr.getZ(i).toFixed(5)}\n`;
  }

  // Normals
  if (normAttr) {
    for (let i = 0; i < normAttr.count; i++) {
      obj += `vn ${normAttr.getX(i).toFixed(5)} ${normAttr.getY(i).toFixed(5)} ${normAttr.getZ(i).toFixed(5)}\n`;
    }
  }

  // UVs
  if (uvAttr) {
    for (let i = 0; i < uvAttr.count; i++) {
      obj += `vt ${uvAttr.getX(i).toFixed(5)} ${uvAttr.getY(i).toFixed(5)}\n`;
    }
  }

  // Faces
  obj += `s 1\n`;
  for (let i = 0; i < posAttr.count; i += 3) {
    const v1 = i + 1;
    const v2 = i + 2;
    const v3 = i + 3;
    obj += `f ${v1}/${v1}/${v1} ${v2}/${v2}/${v2} ${v3}/${v3}/${v3}\n`;
  }

  return new Blob([obj], { type: 'text/plain' });
}

/**
 * Generates custom Unity C# controller script tailored for this specimen.
 */
export function generateUnityControllerScript(dna: CreatureDNA, boneNames: string[]): string {
  const safeClassName = dna.scientificName.replace(/[^a-zA-Z0-9]/g, '') + 'Controller';

  return `// ==============================================================================
// Anatoma3D Generated Unity Procedural Biomechanics Controller
// Specimen: ${dna.scientificName} ("${dna.vernacularName}")
// Class: ${dna.taxonomicClass}
// Stance: ${dna.stance.toUpperCase()} | Muscle Mass Index: ${dna.muscleMassIndex}
// ==============================================================================

using System.Collections;
using System.Collections.Generic;
using UnityEngine;

[RequireComponent(typeof(Animator))]
public class ${safeClassName} : MonoBehaviour
{
    [Header("Organism Biomechanics Profile")]
    [Tooltip("Scientific Name of the procedural organism")]
    public string scientificName = "${dna.scientificName}";
    public string taxonomicClass = "${dna.taxonomicClass}";
    public float bodyScale = ${dna.scale.toFixed(2)}f;

    [Header("Locomotion & Gait Dynamics")]
    [Range(0.2f, 3.0f)] public float walkSpeedMultiplier = 1.0f;
    [Range(0.0f, 1.0f)] public float gaitBlend = 0.5f; // 0 = Walk, 1 = Gallop
    public bool enableProceduralSpineFlex = true;

    [Header("Deep Learning Respiration & Muscle Displacement")]
    [Range(10f, 40f)] public float respirationRateBPM = ${dna.respirationRate.toFixed(1)}f;
    [Range(0.0f, 0.1f)] public float ribcageExpansionAmplitude = ${dna.respirationAmplitude.toFixed(3)}f;
    public bool enableMuscleBulge = true;

    private Animator animator;
    private Transform rootPelvis;
    private Transform spineThorax;
    private Transform headCranium;
    private Transform mandibleJaw;
    private List<Transform> tailSegments = new List<Transform>();

    private float respirationTimer = 0f;

    void Start()
    {
        animator = GetComponent<Animator>();
        BindSkeletalHierarchy();
    }

    void BindSkeletalHierarchy()
    {
        // Auto-link bones exported from Anatoma3D
        rootPelvis = FindChildRecursive(transform, "Root_Pelvis");
        spineThorax = FindChildRecursive(transform, "Spine_Thorax");
        headCranium = FindChildRecursive(transform, "Head_Cranium");
        mandibleJaw = FindChildRecursive(transform, "Mandible_Jaw");

        for (int i = 1; i <= 4; i++)
        {
            Transform tail = FindChildRecursive(transform, "Tail_Segment_" + i);
            if (tail != null) tailSegments.Add(tail);
        }

        Debug.Log($"[${safeClassName}] Successfully bound skeletal hierarchy. Total bones mapped: ${boneNames.length}");
    }

    void LateUpdate()
    {
        // Real-time Respiration Vertex / Joint Flex
        respirationTimer += Time.deltaTime * (respirationRateBPM / 60.0f) * Mathf.PI * 2.0f;
        float respCycle = Mathf.Sin(respirationTimer);

        if (spineThorax != null && enableProceduralSpineFlex)
        {
            // Dynamic thoracic volume pulsation
            float ribcageScale = 1.0f + respCycle * ribcageExpansionAmplitude;
            spineThorax.localScale = new Vector3(ribcageScale, ribcageScale, 1.0f);
        }

        // Procedural tail counterbalancing
        if (tailSegments.Count > 0)
        {
            float spineSway = Mathf.Sin(Time.time * 3.0f * walkSpeedMultiplier);
            for (int i = 0; i < tailSegments.Count; i++)
            {
                float lag = (i + 1) * 0.4f;
                tailSegments[i].localRotation *= Quaternion.Euler(0, Mathf.Sin(Time.time * 3f - lag) * 4f, 0);
            }
        }
    }

    private Transform FindChildRecursive(Transform parent, string targetName)
    {
        if (parent.name == targetName) return parent;
        foreach (Transform child in parent)
        {
            Transform result = FindChildRecursive(child, targetName);
            if (result != null) return result;
        }
        return null;
    }
}
`;
}

/**
 * Generates scientific anatomical dossier in Markdown / JSON.
 */
export function generateScientificDossier(dna: CreatureDNA): string {
  const estimatedMassKg = Math.round(Math.pow(dna.scale, 3) * (dna.muscleMassIndex * 140));
  const estimatedBiteForceN = Math.round(dna.mandibleDepth * dna.muscleMassIndex * 3200);
  const estimatedTopSpeedKmh = Math.round((dna.hindlimbScale / dna.scale) * 38 * (dna.stance === 'avian_theropod' ? 1.3 : 1.1));

  return JSON.stringify({
    specimen: {
      scientific_name: dna.scientificName,
      vernacular_name: dna.vernacularName,
      taxonomic_class: dna.taxonomicClass,
      ecological_niche: dna.ecologicalNiche,
      seed: dna.seed,
    },
    biomechanics: {
      locomotion_stance: dna.stance,
      foot_posture: dna.footPosture,
      estimated_mass_kg: estimatedMassKg,
      estimated_bite_force_newtons: estimatedBiteForceN,
      estimated_top_speed_kmh: estimatedTopSpeedKmh,
      respiration_rate_bpm: Math.round(dna.respirationRate),
      muscle_mass_index: Number(dna.muscleMassIndex.toFixed(2)),
    },
    morphometrics: {
      scale_factor: Number(dna.scale.toFixed(2)),
      spine_length_meters: Number((dna.spineLength * dna.scale).toFixed(2)),
      thoracic_width_meters: Number((dna.thoracicWidth * dna.scale).toFixed(2)),
      skull_archetype: dna.skullArchetype,
      snout_length_meters: Number((dna.snoutLength * dna.scale).toFixed(2)),
      cranial_horns: dna.hornType,
      tail_style: dna.tailTipStyle,
      limb_pairs: dna.limbPairs,
      integument_type: dna.integument,
      dermal_pigmentation_pattern: dna.pattern,
    },
    engine_compatibility: {
      target_engines: ["Unity 2021.3+", "Unity 2022.3+", "Unity 6", "Unreal Engine 5", "Godot 4", "Blender 4"],
      rig_type: "Humanoid/Generic SkinnedMesh with 4-weight Linear Blend Skinning",
      vertex_displacement_support: "Diaphragmatic Respiration & Neural Muscle Bulge Tensors"
    }
  }, null, 2);
}
