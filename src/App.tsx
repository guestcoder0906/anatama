/**
 * Anatoma3D - Procedural Vertebrate & Organism Biomechanics Studio
 * Built with Marching Cubes continuous single mesh polygonization, procedural bone rigging,
 * deep learning muscle deformation prediction, and Unity game engine export.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import {
  CreatureDNA,
  generateRandomDNA,
  ARCHETYPE_PRESETS
} from './generator/dna';
import { CreatureSDF } from './generator/sdf';
import { generateCreatureMesh } from './generator/marchingCubes';
import { buildRiggedSkeleton, RiggedCreature } from './generator/rigging';
import { ProceduralAnimationEngine, GaitType } from './generator/proceduralAnimation';
import { MuscleDeformationEngine } from './generator/deepLearningDeformation';
import { PhysicsBalanceEngine, BalanceMetrics } from './generator/physicsBalance';

import { Viewport3D, ViewportMode, LightingPreset } from './components/Viewport3D';
import { ControlsPanel } from './components/ControlsPanel';
import { AnimationControls } from './components/AnimationControls';
import { DeepLearningPanel } from './components/DeepLearningPanel';
import { ExportModal } from './components/ExportModal';

import {
  Dna, Brain, Download, Dices, Layers,
  ChevronLeft, ChevronRight, Sparkles, Activity
} from 'lucide-react';

export default function App() {
  // 1. Core Generative State
  const [dna, setDna] = useState<CreatureDNA>(() => ARCHETYPE_PRESETS[0].generator());
  const [rig, setRig] = useState<RiggedCreature | null>(null);
  const [meshResolution, setMeshResolution] = useState<number>(70);
  const [isMeshRegenerating, setIsMeshRegenerating] = useState<boolean>(false);

  // 2. Viewport & Rendering State
  const [viewportMode, setViewportMode] = useState<ViewportMode>('textured');
  const [lightingPreset, setLightingPreset] = useState<LightingPreset>('studio_lab');
  const [showSkeletonGizmo, setShowSkeletonGizmo] = useState<boolean>(false);
  const [showGroundGrid, setShowGroundGrid] = useState<boolean>(true);
  const [showPhysicsGizmo, setShowPhysicsGizmo] = useState<boolean>(true);
  const [autoStabilizeEnabled, setAutoStabilizeEnabled] = useState<boolean>(true);
  const [balanceMetrics, setBalanceMetrics] = useState<BalanceMetrics | null>(null);

  // 3. Animation & Locomotion State
  const [currentGait, setCurrentGait] = useState<GaitType>('walk');
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [isPaused, setIsPaused] = useState<boolean>(false);

  // 4. UI Paneling State
  const [activeTab, setActiveTab] = useState<'morphometrics' | 'deep_learning'>('morphometrics');
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);

  // 5. Persistent Engine Instances
  const animEngineRef = useRef<ProceduralAnimationEngine>(new ProceduralAnimationEngine());
  const muscleEngineRef = useRef<MuscleDeformationEngine>(new MuscleDeformationEngine());
  const physicsEngineRef = useRef<PhysicsBalanceEngine>(new PhysicsBalanceEngine());

  // 6. Mesh & Skeleton Generation Pipeline
  const buildOrganismMesh = useCallback((currentDNA: CreatureDNA, resolution: number, allowAutoStabilize: boolean = true) => {
    setIsMeshRegenerating(true);

    // Run polygonization in next tick so loading indicator paints
    setTimeout(() => {
      try {
        let activeDNA = currentDNA;
        let sdf = new CreatureSDF(activeDNA);
        let metrics = physicsEngineRef.current.calculateBalance(activeDNA, sdf.skeleton);

        // Biomechanical realism: if creature is unstable or marginal, automatically auto-balance posture
        if (allowAutoStabilize && autoStabilizeEnabled && (metrics.stabilityStatus !== 'optimal' && metrics.stabilityStatus !== 'stable')) {
          activeDNA = physicsEngineRef.current.autoBalanceDNA(activeDNA, sdf.skeleton);
          sdf = new CreatureSDF(activeDNA);
          metrics = physicsEngineRef.current.calculateBalance(activeDNA, sdf.skeleton);
          setDna(activeDNA);
        }

        setBalanceMetrics(metrics);
        const meshResult = generateCreatureMesh(sdf, resolution);

        const defaultMaterial = new THREE.MeshStandardMaterial({
          vertexColors: true,
          roughness: 1.0 - activeDNA.specularGloss * 0.8,
          metalness: 0.05,
          side: THREE.DoubleSide
        });

        const newRig = buildRiggedSkeleton(
          meshResult.geometry,
          sdf.skeleton,
          activeDNA,
          defaultMaterial
        );

        setRig(newRig);
      } catch (err) {
        console.error('Marching Cubes polygonization error:', err);
      } finally {
        setIsMeshRegenerating(false);
      }
    }, 16);
  }, [autoStabilizeEnabled]);

  // Initial generation
  useEffect(() => {
    buildOrganismMesh(dna, meshResolution);
  }, []);

  // Debounced remeshing when DNA morphometrics change
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const handleUpdateDNA = useCallback((updater: (prev: CreatureDNA) => CreatureDNA) => {
    setDna((prev) => {
      const next = updater(prev);
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        buildOrganismMesh(next, meshResolution);
      }, 120);
      return next;
    });
  }, [buildOrganismMesh, meshResolution]);

  // Seed randomizer
  const handleRandomize = useCallback(() => {
    const newSeed = Math.floor(Math.random() * 1000000);
    const newDNA = generateRandomDNA(newSeed);
    setDna(newDNA);
    buildOrganismMesh(newDNA, meshResolution);
  }, [buildOrganismMesh, meshResolution]);

  // Archetype preset picker
  const handleSelectPreset = useCallback((presetId: string) => {
    const preset = ARCHETYPE_PRESETS.find((p) => p.id === presetId);
    if (preset) {
      const newDNA = preset.generator();
      setDna(newDNA);
      buildOrganismMesh(newDNA, meshResolution);
    }
  }, [buildOrganismMesh, meshResolution]);

  // Manual remesh trigger
  const handleRemesh = useCallback(() => {
    buildOrganismMesh(dna, meshResolution);
  }, [buildOrganismMesh, dna, meshResolution]);

  return (
    <div className="flex flex-col w-screen h-screen bg-[#07090e] text-slate-100 overflow-hidden font-sans antialiased">
      {/* Top Navigation Header */}
      <header className="h-14 bg-slate-950/90 border-b border-slate-800/80 px-4 flex items-center justify-between z-40 backdrop-blur-md">
        {/* Brand & Subtitle */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-400 via-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/25">
            <Dna className="w-4 h-4 text-slate-950" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm tracking-tight text-white">Anatoma3D</span>
              <span className="text-[11px] font-mono text-cyan-400 font-medium">Studio v2.5</span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-400">
              <span>Continuous Marching Cubes Biomechanics</span>
              <span aria-hidden="true">·</span>
              <span>Procedural Rigging</span>
              <span aria-hidden="true">·</span>
              <span>Unity Export</span>
            </div>
          </div>
        </div>

        {/* Center Quick Randomize */}
        <div className="hidden md:flex items-center gap-2">
          <button
            onClick={handleRandomize}
            disabled={isMeshRegenerating}
            className="py-1.5 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-xs font-medium text-slate-200 flex items-center gap-1.5 transition-colors disabled:opacity-50"
          >
            <Dices className="w-3.5 h-3.5 text-cyan-400" />
            <span>Randomize Organism</span>
          </button>
        </div>

        {/* Right Action: Export for Game Engines */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsExportModalOpen(true)}
            className="py-2 px-3.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-semibold text-xs rounded-xl shadow-lg shadow-cyan-500/20 flex items-center gap-2 transition-all active:scale-95"
          >
            <Download className="w-4 h-4 text-slate-950" />
            <span>Export for Unity / 3D</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Body */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Left Sidebar (Controls & Deep Learning) */}
        <aside
          className={`${
            isSidebarOpen ? 'w-88 sm:w-96' : 'w-0'
          } flex-shrink-0 bg-slate-950/95 border-r border-slate-800/80 flex flex-col z-30 transition-all duration-300 overflow-hidden backdrop-blur-md relative`}
        >
          {/* Tab Navigation */}
          <div className="flex border-b border-slate-800 bg-slate-950 px-3 pt-2 gap-1">
            <button
              onClick={() => setActiveTab('morphometrics')}
              className={`flex-1 py-2 px-3 text-xs font-semibold rounded-t-lg transition-colors flex items-center justify-center gap-2 border-b-2 ${
                activeTab === 'morphometrics'
                  ? 'border-cyan-400 text-cyan-400 bg-slate-900/60'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/30'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Morphometrics</span>
            </button>
            <button
              onClick={() => setActiveTab('deep_learning')}
              className={`flex-1 py-2 px-3 text-xs font-semibold rounded-t-lg transition-colors flex items-center justify-center gap-2 border-b-2 ${
                activeTab === 'deep_learning'
                  ? 'border-amber-400 text-amber-400 bg-slate-900/60'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-900/30'
              }`}
            >
              <Brain className="w-3.5 h-3.5" />
              <span>Deep Learning</span>
            </button>
          </div>

          {/* Sidebar Content */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {activeTab === 'morphometrics' ? (
              <ControlsPanel
                dna={dna}
                balanceMetrics={balanceMetrics}
                showPhysicsGizmo={showPhysicsGizmo}
                setShowPhysicsGizmo={setShowPhysicsGizmo}
                autoStabilizeEnabled={autoStabilizeEnabled}
                setAutoStabilizeEnabled={setAutoStabilizeEnabled}
                onUpdateDNA={handleUpdateDNA}
                onRandomize={handleRandomize}
                onSelectPreset={handleSelectPreset}
                meshResolution={meshResolution}
                setMeshResolution={(r) => {
                  setMeshResolution(r);
                  buildOrganismMesh(dna, r);
                }}
                onRemesh={handleRemesh}
                isMeshRegenerating={isMeshRegenerating}
              />
            ) : (
              <DeepLearningPanel
                dna={dna}
                muscleEngine={muscleEngineRef.current}
                onUpdateDNA={handleUpdateDNA}
              />
            )}
          </div>
        </aside>

        {/* Sidebar Toggle Tab Button */}
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className={`absolute top-20 ${
            isSidebarOpen ? 'left-88 sm:left-96' : 'left-0'
          } z-30 bg-slate-900/90 border border-slate-700/80 p-1.5 rounded-r-lg text-slate-400 hover:text-white transition-all duration-300 shadow-md`}
          title={isSidebarOpen ? 'Collapse Sidebar' : 'Expand Sidebar'}
        >
          {isSidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        {/* Center / Right 3D Viewport Area */}
        <main className="flex-1 flex flex-col relative overflow-hidden bg-[#07090e]">
          <div className="flex-1 relative">
            <Viewport3D
              dna={dna}
              rig={rig}
              animEngine={animEngineRef.current}
              muscleEngine={muscleEngineRef.current}
              balanceMetrics={balanceMetrics}
              viewportMode={viewportMode}
              setViewportMode={setViewportMode}
              lightingPreset={lightingPreset}
              setLightingPreset={setLightingPreset}
              showSkeletonGizmo={showSkeletonGizmo}
              setShowSkeletonGizmo={setShowSkeletonGizmo}
              showGroundGrid={showGroundGrid}
              setShowGroundGrid={setShowGroundGrid}
              showPhysicsGizmo={showPhysicsGizmo}
              setShowPhysicsGizmo={setShowPhysicsGizmo}
              isMeshRegenerating={isMeshRegenerating}
            />
          </div>

          {/* Bottom Procedural Animation Controls Bar */}
          <AnimationControls
            animEngine={animEngineRef.current}
            currentGait={currentGait}
            setCurrentGait={setCurrentGait}
            playbackSpeed={playbackSpeed}
            setPlaybackSpeed={setPlaybackSpeed}
            isPaused={isPaused}
            setIsPaused={setIsPaused}
            dna={dna}
          />
        </main>
      </div>

      {/* Game Engine Export Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        dna={dna}
        rig={rig}
        animEngine={animEngineRef.current}
      />
    </div>
  );
}
