/**
 * Anatoma3D High-Fidelity 3D Viewport.
 * Features WebGL PBR rendering, dynamic OrbitControls, real-time vertex displacement loop,
 * anatomical X-Ray skeleton overlay, muscle strain heatmaps, and lighting presets.
 */

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CreatureDNA } from '../generator/dna';
import { RiggedCreature } from '../generator/rigging';
import { ProceduralAnimationEngine } from '../generator/proceduralAnimation';
import { MuscleDeformationEngine } from '../generator/deepLearningDeformation';
import {
  Camera, Eye, Layers, Sun, Moon,
  Maximize2, RotateCcw, Activity, Scale, Bone, ChevronLeft, ChevronRight
} from 'lucide-react';
import { BalanceMetrics, PhysicsBalanceVisualizer } from '../generator/physicsBalance';

export type ViewportMode = 'textured' | 'muscle_strain' | 'anatomical_parts' | 'weight_paint' | 'xray_skeleton' | 'wireframe';
export type LightingPreset = 'studio_lab' | 'natural_sun' | 'dark_abyss';

interface Viewport3DProps {
  dna: CreatureDNA;
  rig: RiggedCreature | null;
  animEngine: ProceduralAnimationEngine;
  muscleEngine: MuscleDeformationEngine;
  balanceMetrics: BalanceMetrics | null;
  viewportMode: ViewportMode;
  setViewportMode: (m: ViewportMode) => void;
  lightingPreset: LightingPreset;
  setLightingPreset: (l: LightingPreset) => void;
  showSkeletonGizmo: boolean;
  setShowSkeletonGizmo: (show: boolean) => void;
  showGroundGrid: boolean;
  setShowGroundGrid: (show: boolean) => void;
  showPhysicsGizmo: boolean;
  setShowPhysicsGizmo: (show: boolean) => void;
  isMeshRegenerating: boolean;
}

// Procedural biological micro-surface bump texture for organic skin pores and reptilian/mammalian scales
function createProceduralSkinBumpTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const imgData = ctx.createImageData(512, 512);
    const data = imgData.data;
    for (let y = 0; y < 512; y++) {
      for (let x = 0; x < 512; x++) {
        const idx = (y * 512 + x) * 4;
        // Multi-scale cellular noise for natural epidermal keratin and fine pores
        const cx = (x % 32) - 16;
        const cy = (y % 32) - 16;
        const cellDist = Math.sqrt(cx * cx + cy * cy) / 16.0;
        const cellBump = Math.max(0, 1.0 - cellDist * cellDist) * 35;

        const f1 = Math.sin(x * 0.12) * Math.cos(y * 0.12) * 25;
        const f2 = Math.sin(x * 0.35 + y * 0.25) * 15;
        const pore = Math.sin(x * 1.5) * Math.cos(y * 1.5) * 8;

        const val = Math.min(255, Math.max(0, Math.floor(128 + cellBump + f1 + f2 + pore)));
        data[idx] = val;
        data[idx + 1] = val;
        data[idx + 2] = val;
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(imgData, 0, 0);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(18, 18);
  return texture;
}

export const Viewport3D: React.FC<Viewport3DProps> = ({
  dna,
  rig,
  animEngine,
  muscleEngine,
  balanceMetrics,
  viewportMode,
  setViewportMode,
  lightingPreset,
  setLightingPreset,
  showSkeletonGizmo,
  setShowSkeletonGizmo,
  showGroundGrid,
  setShowGroundGrid,
  showPhysicsGizmo,
  setShowPhysicsGizmo,
  isMeshRegenerating
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const skeletonHelperRef = useRef<THREE.SkeletonHelper | null>(null);
  const physicsVisualizerRef = useRef<PhysicsBalanceVisualizer | null>(null);
  const animFrameIdRef = useRef<number | null>(null);
  const groundGridRef = useRef<THREE.GridHelper | null>(null);
  const lightsGroupRef = useRef<THREE.Group | null>(null);

  // Cached materials for instantaneous mode switching
  const materialsRef = useRef<{
    pbr: THREE.MeshStandardMaterial;
    wireframe: THREE.MeshStandardMaterial;
    xray: THREE.MeshStandardMaterial;
  } | null>(null);

  const [fps, setFps] = useState<number>(60);
  const [selectedBoneIndex, setSelectedBoneIndex] = useState<number>(0);

  // Auto-select a prominent limb bone when a new rig is bound
  useEffect(() => {
    if (rig && rig.boneNames.length > 0) {
      const limbIdx = rig.boneNames.findIndex(n => n.includes('Knee') || n.includes('Elbow'));
      if (limbIdx >= 0) {
        setSelectedBoneIndex(limbIdx);
      } else {
        setSelectedBoneIndex(0);
      }
    }
  }, [rig]);

  // Initialize Three.js scene once
  useEffect(() => {
    if (!mountRef.current) return;

    const width = mountRef.current.clientWidth;
    const height = mountRef.current.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0e1117);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(3.5, 2.0, 4.0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI * 0.52; // slightly above ground
    controls.minDistance = 1.2;
    controls.maxDistance = 18.0;
    controls.target.set(0, 0.9, 0);
    controlsRef.current = controls;

    // Ground Grid & subtle shadow receiver
    const grid = new THREE.GridHelper(20, 40, 0x334155, 0x1e293b);
    grid.position.y = 0;
    scene.add(grid);
    groundGridRef.current = grid;

    const shadowPlaneGeo = new THREE.PlaneGeometry(24, 24);
    const shadowPlaneMat = new THREE.ShadowMaterial({ opacity: 0.35 });
    const shadowPlane = new THREE.Mesh(shadowPlaneGeo, shadowPlaneMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.y = -0.005;
    shadowPlane.receiveShadow = true;
    scene.add(shadowPlane);

    // Lighting group
    const lightsGroup = new THREE.Group();
    scene.add(lightsGroup);
    lightsGroupRef.current = lightsGroup;

    // Default Materials with procedural organic micro-bump texturing
    const skinBumpTexture = createProceduralSkinBumpTexture();
    materialsRef.current = {
      pbr: new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.45,
        metalness: 0.04,
        bumpMap: skinBumpTexture,
        bumpScale: 0.024,
        side: THREE.DoubleSide
      }),
      wireframe: new THREE.MeshStandardMaterial({
        color: 0x00f0ff,
        wireframe: true
      }),
      xray: new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.35,
        wireframe: false,
        roughness: 0.2
      })
    };

    // Initialize Physics Balance Visualizer (CoM, Gravity line, Support Polygon)
    const physViz = new PhysicsBalanceVisualizer();
    physViz.setVisible(showPhysicsGizmo);
    scene.add(physViz.group);
    physicsVisualizerRef.current = physViz;

    // Resize handler
    const handleResize = () => {
      if (!mountRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      renderer.dispose();
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Update Lighting according to preset
  useEffect(() => {
    const lights = lightsGroupRef.current;
    if (!lights) return;

    // Clear existing lights
    while (lights.children.length > 0) {
      lights.remove(lights.children[0]);
    }

    if (lightingPreset === 'studio_lab') {
      const hemi = new THREE.HemisphereLight(0xffffff, 0x1f2937, 0.7);
      lights.add(hemi);

      const keyLight = new THREE.DirectionalLight(0xf8fafc, 2.2);
      keyLight.position.set(4, 6, 4);
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.width = 2048;
      keyLight.shadow.mapSize.height = 2048;
      keyLight.shadow.bias = -0.0005;
      lights.add(keyLight);

      const fillLight = new THREE.DirectionalLight(0x93c5fd, 0.9);
      fillLight.position.set(-4, 3, -3);
      lights.add(fillLight);

      const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.4);
      rimLight.position.set(0, 4, -5);
      lights.add(rimLight);
    } else if (lightingPreset === 'natural_sun') {
      const hemi = new THREE.HemisphereLight(0xdbeafe, 0x475569, 0.6);
      lights.add(hemi);

      const sun = new THREE.DirectionalLight(0xffedd5, 2.8);
      sun.position.set(6, 8, 3);
      sun.castShadow = true;
      sun.shadow.mapSize.width = 2048;
      sun.shadow.mapSize.height = 2048;
      lights.add(sun);

      const bounce = new THREE.DirectionalLight(0xa3e635, 0.4);
      bounce.position.set(-3, 1, 2);
      lights.add(bounce);
    } else {
      // Dark Abyss
      const hemi = new THREE.HemisphereLight(0x0f172a, 0x020617, 0.3);
      lights.add(hemi);

      const neonCyan = new THREE.PointLight(0x00f0ff, 4.5, 12);
      neonCyan.position.set(2.5, 3.0, 2.5);
      lights.add(neonCyan);

      const neonMagenta = new THREE.PointLight(0xf43f5e, 3.5, 12);
      neonMagenta.position.set(-2.5, 2.0, -2.5);
      lights.add(neonMagenta);
    }
  }, [lightingPreset]);

  // Bind new Rigged Creature to Scene
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !rig) return;

    // Remove old SkinnedMesh if present
    const existingMesh = scene.getObjectByName('RiggedCreature');
    if (existingMesh) scene.remove(existingMesh);

    if (skeletonHelperRef.current) {
      scene.remove(skeletonHelperRef.current);
      skeletonHelperRef.current = null;
    }

    rig.skinnedMesh.name = 'RiggedCreature';
    rig.skinnedMesh.castShadow = true;
    rig.skinnedMesh.receiveShadow = true;

    // Center camera on the creature's height
    const box = new THREE.Box3().setFromObject(rig.skinnedMesh);
    const center = box.getCenter(new THREE.Vector3());
    if (controlsRef.current) {
      controlsRef.current.target.set(center.x, Math.max(0.4, center.y), center.z);
    }

    scene.add(rig.skinnedMesh);

    // Create Skeleton Helper for anatomical bone visualization
    const helper = new THREE.SkeletonHelper(rig.bones[0]);
    helper.visible = showSkeletonGizmo || viewportMode === 'xray_skeleton';
    scene.add(helper);
    skeletonHelperRef.current = helper;

    // Cache original colors for instant mode switching
    const colAttr = rig.skinnedMesh.geometry.getAttribute('color') as THREE.BufferAttribute;
    if (colAttr && !rig.skinnedMesh.geometry.userData.originalColors) {
      rig.skinnedMesh.geometry.userData.originalColors = new Float32Array(colAttr.array);
    }

    // Bind geometry to muscle deformation engine
    muscleEngine.bindGeometry(rig.skinnedMesh.geometry);
  }, [rig]);

  // Toggle Skeleton Helper visibility
  useEffect(() => {
    if (skeletonHelperRef.current) {
      skeletonHelperRef.current.visible = showSkeletonGizmo || viewportMode === 'xray_skeleton';
    }
  }, [showSkeletonGizmo, viewportMode]);

  // Toggle Ground Grid visibility
  useEffect(() => {
    if (groundGridRef.current) {
      groundGridRef.current.visible = showGroundGrid;
    }
  }, [showGroundGrid]);

  // Update Physics Balance Gizmo when balance metrics or toggle changes
  useEffect(() => {
    if (physicsVisualizerRef.current) {
      physicsVisualizerRef.current.setVisible(showPhysicsGizmo);
      if (balanceMetrics) {
        physicsVisualizerRef.current.update(balanceMetrics);
      }
    }
  }, [balanceMetrics, showPhysicsGizmo]);

  // Update material based on ViewportMode
  useEffect(() => {
    if (!rig || !materialsRef.current) return;
    const mesh = rig.skinnedMesh;

    if (viewportMode === 'wireframe') {
      mesh.material = materialsRef.current.wireframe;
    } else if (viewportMode === 'xray_skeleton') {
      mesh.material = materialsRef.current.xray;
    } else {
      // textured or muscle_strain
      materialsRef.current.pbr.roughness = 1.0 - dna.specularGloss * 0.8;
      materialsRef.current.pbr.vertexColors = true;
      mesh.material = materialsRef.current.pbr;
    }
  }, [viewportMode, rig, dna.specularGloss]);

  // Main Render & Procedural Kinematics Loop
  useEffect(() => {
    let lastTime = performance.now();
    let frameCount = 0;
    let lastFpsUpdate = lastTime;

    const animate = (now: number) => {
      animFrameIdRef.current = requestAnimationFrame(animate);

      const delta = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      frameCount++;
      if (now - lastFpsUpdate > 500) {
        setFps(Math.round((frameCount * 1000) / (now - lastFpsUpdate)));
        frameCount = 0;
        lastFpsUpdate = now;
      }

      if (controlsRef.current) {
        controlsRef.current.update();
      }

      // Update Procedural Rigging Kinematics & Locomotion
      if (rig) {
        animEngine.update(rig, dna, delta);

        // Update Real-Time Vertex Displacement & Neural Muscle Deformation
        muscleEngine.update(
          rig.skinnedMesh,
          dna,
          now * 0.001,
          animEngine.playbackSpeed,
          animEngine.currentKinematics
        );

        if (skeletonHelperRef.current && skeletonHelperRef.current.visible) {
          skeletonHelperRef.current.updateMatrixWorld(true);
        }

        // Dynamic Vertex Coloring (Strain Heatmap vs Anatomical Parts vs PBR Texture)
        const geom = rig.skinnedMesh.geometry;
        const colorAttr = geom.getAttribute('color') as THREE.BufferAttribute;

        if (colorAttr) {
          if (viewportMode === 'muscle_strain') {
            const strainAttr = geom.getAttribute('muscleStrain') as THREE.BufferAttribute;
            if (strainAttr) {
              const strainArr = strainAttr.array as Float32Array;
              const colorArr = colorAttr.array as Float32Array;
              const count = strainAttr.count;

              const cRelaxed = new THREE.Color(0x1e3a8a); // deep blue
              const cMild = new THREE.Color(0x10b981);    // emerald green
              const cHigh = new THREE.Color(0xf59e0b);    // amber
              const cPeak = new THREE.Color(0xef4444);    // bright red
              const tempCol = new THREE.Color();

              for (let i = 0; i < count; i++) {
                const s = strainArr[i];
                if (s < 0.33) {
                  tempCol.copy(cRelaxed).lerp(cMild, s / 0.33);
                } else if (s < 0.66) {
                  tempCol.copy(cMild).lerp(cHigh, (s - 0.33) / 0.33);
                } else {
                  tempCol.copy(cHigh).lerp(cPeak, (s - 0.66) / 0.34);
                }

                colorArr[i * 3] = tempCol.r;
                colorArr[i * 3 + 1] = tempCol.g;
                colorArr[i * 3 + 2] = tempCol.b;
              }
              colorAttr.needsUpdate = true;
            }
          } else if (viewportMode === 'anatomical_parts') {
            const partAttr = geom.getAttribute('partId') as THREE.BufferAttribute;
            if (partAttr) {
              const PART_PALETTE: [number, number, number][] = [
                [0.23, 0.51, 0.96], // 0: Pelvis
                [0.02, 0.71, 0.83], // 1: Lumbar
                [0.01, 0.52, 0.78], // 2: Thorax
                [0.06, 0.72, 0.51], // 3: Neck
                [0.92, 0.70, 0.03], // 4: Head
                [0.98, 0.45, 0.09], // 5: Snout
                [0.92, 0.35, 0.05], // 6: Jaw
                [0.39, 0.40, 0.95], // 7: Tail
                [0.08, 0.72, 0.65], // 8: Fore L Upper
                [0.05, 0.58, 0.53], // 9: Fore L Lower
                [0.02, 0.40, 0.38], // 10: Fore L Foot
                [0.18, 0.83, 0.75], // 11: Fore R Upper
                [0.08, 0.72, 0.65], // 12: Fore R Lower
                [0.07, 0.37, 0.35], // 13: Fore R Foot
                [0.93, 0.28, 0.60], // 14: Hind L Upper
                [0.86, 0.15, 0.47], // 15: Hind L Lower
                [0.51, 0.09, 0.26], // 16: Hind L Foot
                [0.66, 0.33, 0.97], // 17: Hind R Upper
                [0.58, 0.20, 0.92], // 18: Hind R Lower
                [0.35, 0.11, 0.53], // 19: Hind R Foot
              ];
              const partArr = partAttr.array as Float32Array;
              const colorArr = colorAttr.array as Float32Array;
              const count = partAttr.count;

              for (let i = 0; i < count; i++) {
                const pid = Math.floor(partArr[i]) % PART_PALETTE.length;
                const rgb = PART_PALETTE[pid] || [0.5, 0.5, 0.5];
                colorArr[i * 3] = rgb[0];
                colorArr[i * 3 + 1] = rgb[1];
                colorArr[i * 3 + 2] = rgb[2];
              }
              colorAttr.needsUpdate = true;
            }
          } else if (viewportMode === 'weight_paint') {
            const skinIndexAttr = geom.getAttribute('skinIndex') as THREE.BufferAttribute;
            const skinWeightAttr = geom.getAttribute('skinWeight') as THREE.BufferAttribute;
            if (skinIndexAttr && skinWeightAttr) {
              const sIdx = skinIndexAttr.array;
              const sW = skinWeightAttr.array;
              const colorArr = colorAttr.array as Float32Array;
              const count = skinIndexAttr.count;

              for (let i = 0; i < count; i++) {
                let w = 0.0;
                const base = i * 4;
                if (sIdx[base] === selectedBoneIndex) w = sW[base];
                else if (sIdx[base + 1] === selectedBoneIndex) w = sW[base + 1];
                else if (sIdx[base + 2] === selectedBoneIndex) w = sW[base + 2];
                else if (sIdx[base + 3] === selectedBoneIndex) w = sW[base + 3];

                // Standard 3D Rainbow Weight Paint Heatmap:
                // 0.0: Deep Navy Blue
                // 0.25: Cyan
                // 0.50: Green
                // 0.75: Yellow
                // 1.0: Bright Red
                let r = 0.06, g = 0.12, b = 0.38;
                if (w > 0.001) {
                  if (w < 0.25) {
                    const t = w / 0.25;
                    r = 0.06 * (1 - t) + 0.0 * t;
                    g = 0.12 * (1 - t) + 0.82 * t;
                    b = 0.38 * (1 - t) + 0.95 * t;
                  } else if (w < 0.50) {
                    const t = (w - 0.25) / 0.25;
                    r = 0.0 * (1 - t) + 0.1 * t;
                    g = 0.82 * (1 - t) + 0.95 * t;
                    b = 0.95 * (1 - t) + 0.15 * t;
                  } else if (w < 0.75) {
                    const t = (w - 0.50) / 0.25;
                    r = 0.1 * (1 - t) + 0.98 * t;
                    g = 0.95 * (1 - t) + 0.85 * t;
                    b = 0.15 * (1 - t) + 0.02 * t;
                  } else {
                    const t = (w - 0.75) / 0.25;
                    r = 0.98 * (1 - t) + 1.0 * t;
                    g = 0.85 * (1 - t) + 0.05 * t;
                    b = 0.02 * (1 - t) + 0.0 * t;
                  }
                }
                colorArr[i * 3] = r;
                colorArr[i * 3 + 1] = g;
                colorArr[i * 3 + 2] = b;
              }
              colorAttr.needsUpdate = true;
            }
          } else if (viewportMode === 'textured' && geom.userData.originalColors) {
            const orig = geom.userData.originalColors as Float32Array;
            const colorArr = colorAttr.array as Float32Array;
            // Only copy once if needed
            if (colorArr[0] !== orig[0] || colorArr[1] !== orig[1]) {
              colorArr.set(orig);
              colorAttr.needsUpdate = true;
            }
          }
        }
      }

      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };

    animFrameIdRef.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
    };
  }, [rig, dna, viewportMode, selectedBoneIndex]);

  // Camera preset view jumps
  const setCameraView = (type: 'front' | 'side' | 'top' | 'isometric') => {
    if (!cameraRef.current || !controlsRef.current || !rig) return;
    const target = controlsRef.current.target;
    const dist = 4.2 * dna.scale;

    if (type === 'front') {
      cameraRef.current.position.set(target.x, target.y + 0.2, target.z + dist);
    } else if (type === 'side') {
      cameraRef.current.position.set(target.x + dist, target.y + 0.2, target.z);
    } else if (type === 'top') {
      cameraRef.current.position.set(target.x, target.y + dist * 1.3, target.z + 0.01);
    } else {
      cameraRef.current.position.set(target.x + dist * 0.7, target.y + dist * 0.5, target.z + dist * 0.7);
    }
    controlsRef.current.update();
  };

  return (
    <div className="relative w-full h-full bg-[#0a0d14] overflow-hidden select-none">
      {/* 3D WebGL Canvas */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Loading Overlay */}
      {isMeshRegenerating && (
        <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm flex flex-col items-center justify-center gap-3 z-30 transition-opacity">
          <div className="w-10 h-10 border-3 border-cyan-500/20 border-t-cyan-400 rounded-full animate-spin" />
          <p className="text-sm font-medium text-slate-200 tracking-wide">
            Evaluating Marching Cubes Isosurface...
          </p>
          <span className="text-xs text-slate-400 font-mono">
            Polygonizing continuous SDF & binding 4-weight bone weights
          </span>
        </div>
      )}

      {/* Top Header Floating Status (Scientific Identity) */}
      <div className="absolute top-4 left-4 z-20 flex items-center gap-3 bg-slate-900/85 backdrop-blur-md border border-slate-800/80 px-3.5 py-2 rounded-xl shadow-lg">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-100 italic font-serif">
              {dna.scientificName}
            </span>
            <span className="text-xs text-cyan-400 font-medium font-sans">
              ("{dna.vernacularName}")
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5">
            <span>{dna.taxonomicClass}</span>
            <span aria-hidden="true">·</span>
            <span className="uppercase text-slate-300 font-mono text-[10px]">{dna.stance}</span>
            <span aria-hidden="true">·</span>
            <span>Seed #{dna.seed}</span>
          </div>
        </div>
      </div>

      {/* Top Right Viewport Controls */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-1.5 bg-slate-900/85 backdrop-blur-md border border-slate-800/80 p-1.5 rounded-xl shadow-lg">
        {/* Render Mode Tabs */}
        <div className="flex items-center gap-1 bg-slate-950/80 p-0.5 rounded-lg border border-slate-800/60">
          <button
            onClick={() => setViewportMode('textured')}
            title="Textured PBR Organism"
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
              viewportMode === 'textured'
                ? 'bg-slate-800 text-cyan-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            PBR Texture
          </button>
          <button
            onClick={() => setViewportMode('muscle_strain')}
            title="Real-Time Muscle Strain & Neural Deformation Heatmap"
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1 ${
              viewportMode === 'muscle_strain'
                ? 'bg-slate-800 text-amber-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            Strain Heatmap
          </button>
          <button
            onClick={() => setViewportMode('anatomical_parts')}
            title="Anatomical Part ID Hierarchy & Limb Isolation"
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1 ${
              viewportMode === 'anatomical_parts'
                ? 'bg-slate-800 text-purple-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            Part Hierarchy
          </button>
          <button
            onClick={() => {
              setViewportMode('weight_paint');
              setShowSkeletonGizmo(true);
            }}
            title="Interactive Bone Weight Paint Heatmap"
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1 ${
              viewportMode === 'weight_paint'
                ? 'bg-slate-800 text-rose-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Bone className="w-3.5 h-3.5" />
            Weight Paint
          </button>
          <button
            onClick={() => setViewportMode('xray_skeleton')}
            title="Anatomical X-Ray Skeletal Hierarchy"
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
              viewportMode === 'xray_skeleton'
                ? 'bg-slate-800 text-sky-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Skeleton X-Ray
          </button>
          <button
            onClick={() => setViewportMode('wireframe')}
            title="Continuous Marching Cubes Manifold Topology"
            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
              viewportMode === 'wireframe'
                ? 'bg-slate-800 text-emerald-400 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Topology
          </button>
        </div>

        {/* Lighting Selector */}
        <div className="h-5 w-[1px] bg-slate-800 mx-1" />
        <button
          onClick={() =>
            setLightingPreset(
              lightingPreset === 'studio_lab'
                ? 'natural_sun'
                : lightingPreset === 'natural_sun'
                ? 'dark_abyss'
                : 'studio_lab'
            )
          }
          className="p-1.5 text-slate-400 hover:text-slate-100 rounded-lg hover:bg-slate-800 transition-colors"
          title={`Lighting: ${lightingPreset}`}
        >
          {lightingPreset === 'studio_lab' ? (
            <Layers className="w-4 h-4 text-cyan-400" />
          ) : lightingPreset === 'natural_sun' ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-indigo-400" />
          )}
        </button>

        {/* Physics Balance & Center of Mass Gizmo toggle */}
        <button
          onClick={() => setShowPhysicsGizmo(!showPhysicsGizmo)}
          className={`p-1.5 rounded-lg transition-colors flex items-center gap-1 ${
            showPhysicsGizmo
              ? 'text-amber-400 bg-slate-800'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
          title="Toggle Physics Center of Mass & Ground Support Base"
        >
          <Scale className="w-4 h-4" />
        </button>

        {/* Skeleton Gizmo toggle */}
        <button
          onClick={() => setShowSkeletonGizmo(!showSkeletonGizmo)}
          className={`p-1.5 rounded-lg transition-colors ${
            showSkeletonGizmo
              ? 'text-cyan-400 bg-slate-800'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
          title="Toggle Skeletal Joint Gizmo"
        >
          <Eye className="w-4 h-4" />
        </button>

        {/* Ground grid toggle */}
        <button
          onClick={() => setShowGroundGrid(!showGroundGrid)}
          className={`p-1.5 rounded-lg transition-colors ${
            showGroundGrid
              ? 'text-cyan-400 bg-slate-800'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
          }`}
          title="Toggle Ground Grid"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* Floating Weight Paint Inspector Panel */}
      {viewportMode === 'weight_paint' && rig && (
        <div className="absolute top-18 left-1/2 -translate-x-1/2 z-20 bg-slate-900/95 backdrop-blur-md border border-slate-800/90 px-4 py-2 rounded-2xl shadow-2xl flex flex-wrap items-center justify-center gap-3 max-w-[95vw]">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
            <span className="text-xs font-semibold text-slate-200">Bone Authority:</span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setSelectedBoneIndex((prev) => (prev > 0 ? prev - 1 : rig.boneNames.length - 1))}
              className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-100 transition-colors"
              title="Previous Bone"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <select
              value={selectedBoneIndex}
              onChange={(e) => setSelectedBoneIndex(Number(e.target.value))}
              className="bg-slate-950 border border-slate-700 text-xs font-mono text-cyan-400 rounded-lg px-2.5 py-1 focus:outline-none focus:border-cyan-500 max-w-[210px]"
            >
              {rig.boneNames.map((name, idx) => (
                <option key={name} value={idx}>
                  {idx}: {name}
                </option>
              ))}
            </select>

            <button
              onClick={() => setSelectedBoneIndex((prev) => (prev < rig.boneNames.length - 1 ? prev + 1 : 0))}
              className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-slate-100 transition-colors"
              title="Next Bone"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Limb Bone Filters */}
          <div className="hidden lg:flex items-center gap-1 bg-slate-950/70 p-0.5 rounded-lg border border-slate-800/80">
            {rig.boneNames.map((name, idx) => {
              if (
                name.includes('Knee') ||
                name.includes('Elbow') ||
                name.includes('Girdle') ||
                name.includes('Foot')
              ) {
                const short = name
                  .replace('Root_', '')
                  .replace('Spine_', '')
                  .replace('_Segment_', '_');
                return (
                  <button
                    key={name}
                    onClick={() => setSelectedBoneIndex(idx)}
                    className={`px-1.5 py-0.5 text-[10px] font-mono rounded ${
                      selectedBoneIndex === idx
                        ? 'bg-rose-500/25 text-rose-300 border border-rose-500/40'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {short}
                  </button>
                );
              }
              return null;
            })}
          </div>

          {/* Heatmap Spectrum Legend */}
          <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
            <span>0.0</span>
            <div className="w-20 h-2 rounded-full bg-gradient-to-r from-blue-700 via-emerald-400 to-rose-500 border border-slate-700/60" />
            <span className="text-rose-400 font-semibold">1.0</span>
          </div>
        </div>
      )}

      {/* Floating Bottom Left Camera Angle Shortcuts */}
      <div className="absolute bottom-4 left-4 z-20 flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-md border border-slate-800/70 p-1 rounded-xl shadow-lg">
        <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 px-2 flex items-center gap-1">
          <Camera className="w-3 h-3 text-slate-400" /> Cam:
        </span>
        <button
          onClick={() => setCameraView('isometric')}
          className="px-2 py-1 text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors"
        >
          Iso
        </button>
        <button
          onClick={() => setCameraView('lateral' as unknown as 'side')}
          className="px-2 py-1 text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors"
        >
          Side
        </button>
        <button
          onClick={() => setCameraView('front')}
          className="px-2 py-1 text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors"
        >
          Front
        </button>
        <button
          onClick={() => setCameraView('top')}
          className="px-2 py-1 text-xs text-slate-300 hover:text-white hover:bg-slate-800 rounded transition-colors"
        >
          Top
        </button>
        <button
          onClick={() => setCameraView('isometric')}
          className="p-1 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded transition-colors"
          title="Reset View"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Bottom Right Live Telemetry & FPS */}
      <div className="absolute bottom-4 right-4 z-20 flex items-center gap-3 bg-slate-900/80 backdrop-blur-md border border-slate-800/70 px-3 py-1.5 rounded-xl shadow-lg text-[11px] font-mono text-slate-400">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-slate-300">{fps} FPS</span>
        </div>
        <span aria-hidden="true" className="text-slate-700">|</span>
        <span>
          {rig ? `${rig.skinnedMesh.geometry.getAttribute('position').count.toLocaleString()} Verts` : '0 Verts'}
        </span>
        <span aria-hidden="true" className="text-slate-700">|</span>
        <span className="text-cyan-400">
          {rig ? `${rig.bones.length} Rigged Bones` : '0 Bones'}
        </span>
      </div>
    </div>
  );
};
