/**
 * Anatomy & Morphometrics Controls Panel.
 * Fine-grained parameter sliders, scientific archetype selectors, and seed randomization.
 */

import React, { useState } from 'react';
import {
  CreatureDNA,
  LocomotionStance,
  FootPosture,
  SkullArchetype,
  HornType,
  EarType,
  IntegumentType,
  PatternType,
  TailTipStyle,
  ARCHETYPE_PRESETS
} from '../generator/dna';
import {
  Dna, Dices, Layers, Bone, Skull,
  Footprints, Shield, Palette, Sparkles, ChevronDown,
  Scale, Activity, Eye
} from 'lucide-react';
import { BalanceMetrics } from '../generator/physicsBalance';

interface ControlsPanelProps {
  dna: CreatureDNA;
  balanceMetrics: BalanceMetrics | null;
  showPhysicsGizmo: boolean;
  setShowPhysicsGizmo: (show: boolean) => void;
  autoStabilizeEnabled: boolean;
  setAutoStabilizeEnabled: (enabled: boolean) => void;
  onUpdateDNA: (updater: (prev: CreatureDNA) => CreatureDNA) => void;
  onRandomize: () => void;
  onSelectPreset: (presetId: string) => void;
  meshResolution: number;
  setMeshResolution: (res: number) => void;
  onRemesh: () => void;
  isMeshRegenerating: boolean;
}

type AccordionSection = 'physics_balance' | 'archetype' | 'stance' | 'spine' | 'cranium' | 'muscles' | 'integument' | 'marching_cubes';

export const ControlsPanel: React.FC<ControlsPanelProps> = ({
  dna,
  balanceMetrics,
  showPhysicsGizmo,
  setShowPhysicsGizmo,
  autoStabilizeEnabled,
  setAutoStabilizeEnabled,
  onUpdateDNA,
  onRandomize,
  onSelectPreset,
  meshResolution,
  setMeshResolution,
  onRemesh,
  isMeshRegenerating
}) => {
  const [openSections, setOpenSections] = useState<Record<AccordionSection, boolean>>({
    physics_balance: true,
    archetype: false,
    stance: true,
    spine: false,
    cranium: false,
    muscles: false,
    integument: false,
    marching_cubes: false,
  });

  const toggleSection = (s: AccordionSection) => {
    setOpenSections((prev) => ({ ...prev, [s]: !prev[s] }));
  };

  const update = <K extends keyof CreatureDNA>(key: K, val: CreatureDNA[K]) => {
    onUpdateDNA((prev) => ({ ...prev, [key]: val }));
  };

  return (
    <div className="flex flex-col gap-3 p-4 text-slate-200">
      {/* Randomize Action Header */}
      <div className="flex items-center gap-2">
        <button
          onClick={onRandomize}
          disabled={isMeshRegenerating}
          className="flex-1 py-2.5 px-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-semibold text-xs rounded-xl shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
        >
          <Dices className="w-4 h-4 text-slate-950" />
          <span>Generate Random Creature</span>
        </button>

        <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-3 py-2 rounded-xl text-xs font-mono text-slate-300">
          <span className="text-[10px] text-slate-400">#</span>
          <span>{dna.seed}</span>
        </div>
      </div>

      {/* Accordion 0: Realistic Physics Weight Distribution & Balance Checker */}
      {balanceMetrics && (
        <div className="border border-amber-500/30 rounded-xl bg-slate-900/80 overflow-hidden shadow-lg shadow-amber-950/20">
          <button
            onClick={() => toggleSection('physics_balance')}
            className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-200 hover:bg-slate-800/40 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-amber-400" />
              <span>Physics Balance & Weight</span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                  balanceMetrics.stabilityStatus === 'optimal'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                    : balanceMetrics.stabilityStatus === 'stable'
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                    : balanceMetrics.stabilityStatus === 'marginal'
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/40'
                }`}
              >
                {balanceMetrics.stabilityStatus.toUpperCase()}
              </span>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform ${
                  openSections.physics_balance ? 'rotate-180' : ''
                }`}
              />
            </div>
          </button>

          {openSections.physics_balance && (
            <div className="p-3 pt-2 border-t border-slate-800/70 flex flex-col gap-3 text-xs">
              {/* Telemetry Metrics Grid */}
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800/80">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider">Total Mass</div>
                  <div className="text-base font-bold font-mono text-cyan-400">
                    {balanceMetrics.totalMassKg.toLocaleString()} <span className="text-xs text-slate-400 font-sans">kg</span>
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {(balanceMetrics.totalMassKg * 2.20462).toFixed(0)} lbs
                  </div>
                </div>

                <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800/80">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider">Stability Margin</div>
                  <div className="text-base font-bold font-mono text-amber-400">
                    {balanceMetrics.stabilityMarginMeters > 0 ? '+' : ''}
                    {(balanceMetrics.stabilityMarginMeters * 100).toFixed(1)} <span className="text-xs text-slate-400 font-sans">cm</span>
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Dynamic ZMP: {balanceMetrics.dynamicZmpStabilityPercent}%
                  </div>
                </div>
              </div>

              {/* Fore vs Hind Weight Distribution Bar */}
              <div>
                <div className="flex justify-between text-[11px] text-slate-300 mb-1">
                  <span>Fore/Hind Load Balance:</span>
                  <span className="font-mono text-slate-200">
                    <span className="text-cyan-400 font-semibold">{balanceMetrics.foreAftDistribution.forePercent}%</span> Fore /{' '}
                    <span className="text-indigo-400 font-semibold">{balanceMetrics.foreAftDistribution.hindPercent}%</span> Hind
                  </span>
                </div>
                <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden flex border border-slate-800">
                  <div
                    className="h-full bg-cyan-500 transition-all duration-300"
                    style={{ width: `${balanceMetrics.foreAftDistribution.forePercent}%` }}
                  />
                  <div
                    className="h-full bg-indigo-500 transition-all duration-300"
                    style={{ width: `${balanceMetrics.foreAftDistribution.hindPercent}%` }}
                  />
                </div>
              </div>

              {/* Center of Mass Coordinates */}
              <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/60 flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Center of Mass (X,Y,Z):</span>
                <span className="font-mono text-amber-300">
                  [{balanceMetrics.centerOfMass[0].toFixed(2)}, {balanceMetrics.centerOfMass[1].toFixed(2)}, {balanceMetrics.centerOfMass[2].toFixed(2)}]
                </span>
              </div>

              {/* Ground Contacts Foot Pressure Grid */}
              <div>
                <div className="text-[11px] text-slate-300 mb-1 flex items-center justify-between">
                  <span>Foot Reaction Force (GRF):</span>
                  <span className="text-[10px] text-slate-400">{balanceMetrics.footContacts.length} Contact Points</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {balanceMetrics.footContacts.map((fc, idx) => (
                    <div
                      key={idx}
                      className="p-1.5 rounded-md bg-slate-950/70 border border-slate-800 text-[10px] flex items-center justify-between"
                    >
                      <span className="text-slate-400 truncate max-w-[90px]">{fc.name}</span>
                      <span className="font-mono text-cyan-300 font-medium">
                        {fc.weightLoadKg.toFixed(0)} kg ({fc.weightPercent}%)
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dynamic Posture Auto-Balancing Active Status */}
              <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-2.5 text-xs text-emerald-300">
                <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                <div className="flex flex-col">
                  <span className="font-semibold text-emerald-200">Autonomous Biomechanical Balance</span>
                  <span className="text-[10px] text-emerald-400/80">Creature posture automatically stabilizes into physical equilibrium.</span>
                </div>
              </div>

              {/* Auto-Stabilize Equilibrium Mode Toggle */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[11px]">
                <div className="flex flex-col">
                  <span className="text-slate-200 font-medium">Auto-Stabilize Equilibrium:</span>
                  <span className="text-[10px] text-slate-400">Strengthen legs & counter-balance if unstable</span>
                </div>
                <button
                  onClick={() => setAutoStabilizeEnabled(!autoStabilizeEnabled)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    autoStabilizeEnabled
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {autoStabilizeEnabled ? 'Enforced' : 'Manual'}
                </button>
              </div>

              {/* Toggle 3D Physics Center of Mass Gizmo */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-800/60 text-[11px]">
                <span className="text-slate-400">Show 3D Center of Mass Gizmo:</span>
                <button
                  onClick={() => setShowPhysicsGizmo(!showPhysicsGizmo)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    showPhysicsGizmo
                      ? 'bg-amber-400/20 text-amber-400 border border-amber-400/40'
                      : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {showPhysicsGizmo ? 'Visible' : 'Hidden'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Accordion 1: Archetype Presets */}
      <div className="border border-slate-800 rounded-xl bg-slate-900/60 overflow-hidden">
        <button
          onClick={() => toggleSection('archetype')}
          className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-200 hover:bg-slate-800/40 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span>Evolutionary Archetypes</span>
          </div>
          <ChevronDown
            className={`w-4 h-4 text-slate-400 transition-transform ${
              openSections.archetype ? 'rotate-180' : ''
            }`}
          />
        </button>

        {openSections.archetype && (
          <div className="p-3 pt-0 border-t border-slate-800/60 grid grid-cols-2 gap-2 mt-2">
            {ARCHETYPE_PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => onSelectPreset(p.id)}
                className="p-2.5 rounded-lg bg-slate-950/70 border border-slate-800/80 hover:border-cyan-500/50 hover:bg-slate-900 text-left transition-all group"
              >
                <div className="text-xs font-medium text-slate-200 group-hover:text-cyan-400 transition-colors">
                  {p.name.split(' (')[0]}
                </div>
                <div className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                  {p.description}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Accordion 2: Stance & Body Plan */}
      <div className="border border-slate-800 rounded-xl bg-slate-900/60 overflow-hidden">
        <button
          onClick={() => toggleSection('stance')}
          className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-200 hover:bg-slate-800/40 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Footprints className="w-4 h-4 text-emerald-400" />
            <span>Stance & Locomotion Plan</span>
          </div>
          <ChevronDown
            className={`w-4 h-4 text-slate-400 transition-transform ${
              openSections.stance ? 'rotate-180' : ''
            }`}
          />
        </button>

        {openSections.stance && (
          <div className="p-3 pt-2 border-t border-slate-800/60 flex flex-col gap-3 text-xs">
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Locomotion Stance:</label>
              <div className="grid grid-cols-2 gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
                {(['quadrupedal', 'avian_theropod', 'bipedal', 'hexapodal'] as LocomotionStance[]).map((st) => (
                  <button
                    key={st}
                    onClick={() => {
                      update('stance', st);
                      update('limbPairs', st === 'avian_theropod' || st === 'bipedal' ? 1 : st === 'hexapodal' ? 3 : 2);
                    }}
                    className={`py-1.5 px-2 rounded text-[11px] font-medium capitalize transition-colors ${
                      dna.stance === st
                        ? 'bg-slate-800 text-cyan-400 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {st.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Foot Posture:</label>
              <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                {(['digitigrade', 'plantigrade', 'unguligrade'] as FootPosture[]).map((fp) => (
                  <button
                    key={fp}
                    onClick={() => update('footPosture', fp)}
                    className={`py-1 px-1.5 rounded text-[10px] font-medium capitalize transition-colors ${
                      dna.footPosture === fp
                        ? 'bg-slate-800 text-emerald-400 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {fp}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>Organism Scale:</span>
                <span className="font-mono text-cyan-400">{dna.scale.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min="0.8"
                max="2.0"
                step="0.05"
                value={dna.scale}
                onChange={(e) => update('scale', parseFloat(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-950 rounded-lg"
              />
            </div>
          </div>
        )}
      </div>

      {/* Accordion 3: Vertebral Column & Spine */}
      <div className="border border-slate-800 rounded-xl bg-slate-900/60 overflow-hidden">
        <button
          onClick={() => toggleSection('spine')}
          className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-200 hover:bg-slate-800/40 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Bone className="w-4 h-4 text-sky-400" />
            <span>Vertebral Column & Spine</span>
          </div>
          <ChevronDown
            className={`w-4 h-4 text-slate-400 transition-transform ${
              openSections.spine ? 'rotate-180' : ''
            }`}
          />
        </button>

        {openSections.spine && (
          <div className="p-3 pt-2 border-t border-slate-800/60 flex flex-col gap-3 text-xs">
            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>Spine Length:</span>
                <span className="font-mono text-cyan-400">{dna.spineLength.toFixed(2)} m</span>
              </div>
              <input
                type="range"
                min="1.4"
                max="3.0"
                step="0.05"
                value={dna.spineLength}
                onChange={(e) => update('spineLength', parseFloat(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-950 rounded-lg"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>Thoracic Ribcage Width:</span>
                <span className="font-mono text-cyan-400">{dna.thoracicWidth.toFixed(2)} m</span>
              </div>
              <input
                type="range"
                min="0.52"
                max="0.85"
                step="0.02"
                value={dna.thoracicWidth}
                onChange={(e) => update('thoracicWidth', parseFloat(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-950 rounded-lg"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>Thoracic Depth / Chest:</span>
                <span className="font-mono text-cyan-400">{dna.thoracicDepth.toFixed(2)} m</span>
              </div>
              <input
                type="range"
                min="0.50"
                max="0.82"
                step="0.02"
                value={dna.thoracicDepth}
                onChange={(e) => update('thoracicDepth', parseFloat(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-950 rounded-lg"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>Pelvis / Hip Width:</span>
                <span className="font-mono text-cyan-400">{dna.pelvisWidth.toFixed(2)} m</span>
              </div>
              <input
                type="range"
                min="0.50"
                max="0.82"
                step="0.02"
                value={dna.pelvisWidth}
                onChange={(e) => update('pelvisWidth', parseFloat(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-950 rounded-lg"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>Caudal Tail Length:</span>
                <span className="font-mono text-cyan-400">{dna.tailLength.toFixed(2)} m</span>
              </div>
              <input
                type="range"
                min="0.4"
                max="2.6"
                step="0.05"
                value={dna.tailLength}
                onChange={(e) => update('tailLength', parseFloat(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-950 rounded-lg"
              />
            </div>

            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Tail Tip Extremity:</label>
              <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                {(['none', 'tuft', 'fin', 'spade', 'club'] as TailTipStyle[]).map((tt) => (
                  <button
                    key={tt}
                    onClick={() => update('tailTipStyle', tt)}
                    className={`py-1 px-1 rounded text-[10px] font-medium capitalize transition-colors ${
                      dna.tailTipStyle === tt
                        ? 'bg-slate-800 text-sky-400 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {tt}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Accordion 4: Cranium & Facial Morphology */}
      <div className="border border-slate-800 rounded-xl bg-slate-900/60 overflow-hidden">
        <button
          onClick={() => toggleSection('cranium')}
          className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-200 hover:bg-slate-800/40 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Skull className="w-4 h-4 text-amber-400" />
            <span>Cranium & Facial Morphology</span>
          </div>
          <ChevronDown
            className={`w-4 h-4 text-slate-400 transition-transform ${
              openSections.cranium ? 'rotate-180' : ''
            }`}
          />
        </button>

        {openSections.cranium && (
          <div className="p-3 pt-2 border-t border-slate-800/60 flex flex-col gap-3 text-xs">
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Skull Archetype:</label>
              <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                {(['dolichocephalic', 'mesocephalic', 'brachycephalic', 'theropod', 'ceratopsian'] as SkullArchetype[]).map((sk) => (
                  <button
                    key={sk}
                    onClick={() => update('skullArchetype', sk)}
                    className={`py-1 px-1.5 rounded text-[10px] font-medium capitalize transition-colors ${
                      dna.skullArchetype === sk
                        ? 'bg-slate-800 text-amber-400 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {sk}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>Cranial Skull Size:</span>
                <span className="font-mono text-amber-400">{dna.skullSize.toFixed(2)} m</span>
              </div>
              <input
                type="range"
                min="0.32"
                max="0.75"
                step="0.01"
                value={dna.skullSize}
                onChange={(e) => update('skullSize', parseFloat(e.target.value))}
                className="w-full accent-amber-400 cursor-pointer h-1.5 bg-slate-950 rounded-lg"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>Snout Length:</span>
                <span className="font-mono text-amber-400">{dna.snoutLength.toFixed(2)} m</span>
              </div>
              <input
                type="range"
                min="0.25"
                max="0.85"
                step="0.02"
                value={dna.snoutLength}
                onChange={(e) => update('snoutLength', parseFloat(e.target.value))}
                className="w-full accent-amber-400 cursor-pointer h-1.5 bg-slate-950 rounded-lg"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>Mandible Depth:</span>
                <span className="font-mono text-amber-400">{dna.mandibleDepth.toFixed(2)} m</span>
              </div>
              <input
                type="range"
                min="0.12"
                max="0.40"
                step="0.01"
                value={dna.mandibleDepth}
                onChange={(e) => update('mandibleDepth', parseFloat(e.target.value))}
                className="w-full accent-amber-400 cursor-pointer h-1.5 bg-slate-950 rounded-lg"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>Eye Orbit Magnitude:</span>
                <span className="font-mono text-amber-400">{(dna.eyeOrbitSize * 100).toFixed(0)} mm</span>
              </div>
              <input
                type="range"
                min="0.06"
                max="0.18"
                step="0.005"
                value={dna.eyeOrbitSize}
                onChange={(e) => update('eyeOrbitSize', parseFloat(e.target.value))}
                className="w-full accent-amber-400 cursor-pointer h-1.5 bg-slate-950 rounded-lg"
              />
            </div>

            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Cranial Horns:</label>
              <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                {(['none', 'bovid_swept', 'ceratopsian_brow', 'rhino_nasal'] as HornType[]).map((h) => (
                  <button
                    key={h}
                    onClick={() => {
                      update('hornType', h);
                      if (h !== 'none' && dna.hornScale < 0.1) update('hornScale', 0.4);
                    }}
                    className={`py-1 px-1 rounded text-[10px] font-medium capitalize transition-colors ${
                      dna.hornType === h
                        ? 'bg-slate-800 text-amber-400 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {h.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {dna.hornType !== 'none' && (
              <div>
                <div className="flex justify-between text-slate-300 mb-1">
                  <span>Horn Magnitude:</span>
                  <span className="font-mono text-amber-400">{dna.hornScale.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min="0.15"
                  max="0.8"
                  step="0.05"
                  value={dna.hornScale}
                  onChange={(e) => update('hornScale', parseFloat(e.target.value))}
                  className="w-full accent-amber-400 cursor-pointer h-1.5 bg-slate-950 rounded-lg"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Accordion 5: Musculature & Hypertrophy */}
      <div className="border border-slate-800 rounded-xl bg-slate-900/60 overflow-hidden">
        <button
          onClick={() => toggleSection('muscles')}
          className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-200 hover:bg-slate-800/40 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-rose-400" />
            <span>Musculature & Soft Tissue</span>
          </div>
          <ChevronDown
            className={`w-4 h-4 text-slate-400 transition-transform ${
              openSections.muscles ? 'rotate-180' : ''
            }`}
          />
        </button>

        {openSections.muscles && (
          <div className="p-3 pt-2 border-t border-slate-800/60 flex flex-col gap-3 text-xs">
            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>Muscle Mass Index (Hypertrophy):</span>
                <span className="font-mono text-rose-400">{dna.muscleMassIndex.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.65"
                max="1.75"
                step="0.05"
                value={dna.muscleMassIndex}
                onChange={(e) => update('muscleMassIndex', parseFloat(e.target.value))}
                className="w-full accent-rose-400 cursor-pointer h-1.5 bg-slate-950 rounded-lg"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>Dorsal Muscular Crest / Hump:</span>
                <span className="font-mono text-rose-400">{dna.dorsalCrestAdipose.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="0.45"
                step="0.02"
                value={dna.dorsalCrestAdipose}
                onChange={(e) => update('dorsalCrestAdipose', parseFloat(e.target.value))}
                className="w-full accent-rose-400 cursor-pointer h-1.5 bg-slate-950 rounded-lg"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>Dermal Hide Volume:</span>
                <span className="font-mono text-rose-400">{dna.dermalThickness.toFixed(3)}</span>
              </div>
              <input
                type="range"
                min="0.0"
                max="0.02"
                step="0.002"
                value={dna.dermalThickness}
                onChange={(e) => update('dermalThickness', parseFloat(e.target.value))}
                className="w-full accent-rose-400 cursor-pointer h-1.5 bg-slate-950 rounded-lg"
              />
            </div>
          </div>
        )}
      </div>

      {/* Accordion 6: Pigmentation & Integument */}
      <div className="border border-slate-800 rounded-xl bg-slate-900/60 overflow-hidden">
        <button
          onClick={() => toggleSection('integument')}
          className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-200 hover:bg-slate-800/40 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-purple-400" />
            <span>Pigmentation & Integument</span>
          </div>
          <ChevronDown
            className={`w-4 h-4 text-slate-400 transition-transform ${
              openSections.integument ? 'rotate-180' : ''
            }`}
          />
        </button>

        {openSections.integument && (
          <div className="p-3 pt-2 border-t border-slate-800/60 flex flex-col gap-3 text-xs">
            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Integument Type:</label>
              <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                {(['smooth_hide', 'reptilian_scales', 'fur_texture', 'chitin_armor', 'dermal_scutes'] as IntegumentType[]).map((it) => (
                  <button
                    key={it}
                    onClick={() => update('integument', it)}
                    className={`py-1 px-1.5 rounded text-[10px] font-medium capitalize transition-colors ${
                      dna.integument === it
                        ? 'bg-slate-800 text-purple-400 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {it.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[11px] text-slate-400 block mb-1">Pattern Distribution:</label>
              <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                {(['countershade_clean', 'tiger_stripes', 'leopard_rosettes', 'dorsal_saddle', 'bioluminescent_veins'] as PatternType[]).map((pt) => (
                  <button
                    key={pt}
                    onClick={() => update('pattern', pt)}
                    className={`py-1 px-1.5 rounded text-[10px] font-medium capitalize transition-colors ${
                      dna.pattern === pt
                        ? 'bg-slate-800 text-purple-400 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {pt.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Color swatches */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Dorsal Base</label>
                <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-lg border border-slate-800">
                  <input
                    type="color"
                    value={dna.primaryColor}
                    onChange={(e) => update('primaryColor', e.target.value)}
                    className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent"
                  />
                  <span className="font-mono text-[10px] text-slate-300 uppercase">
                    {dna.primaryColor.slice(1)}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Ventral Under</label>
                <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-lg border border-slate-800">
                  <input
                    type="color"
                    value={dna.secondaryColor}
                    onChange={(e) => update('secondaryColor', e.target.value)}
                    className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent"
                  />
                  <span className="font-mono text-[10px] text-slate-300 uppercase">
                    {dna.secondaryColor.slice(1)}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1">Pattern Accent</label>
                <div className="flex items-center gap-1.5 bg-slate-950 p-1.5 rounded-lg border border-slate-800">
                  <input
                    type="color"
                    value={dna.accentColor}
                    onChange={(e) => update('accentColor', e.target.value)}
                    className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent"
                  />
                  <span className="font-mono text-[10px] text-slate-300 uppercase">
                    {dna.accentColor.slice(1)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Accordion 7: Marching Cubes Resolution */}
      <div className="border border-slate-800 rounded-xl bg-slate-900/60 overflow-hidden">
        <button
          onClick={() => toggleSection('marching_cubes')}
          className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-200 hover:bg-slate-800/40 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-400" />
            <span>Marching Cubes Isosurface Grid</span>
          </div>
          <ChevronDown
            className={`w-4 h-4 text-slate-400 transition-transform ${
              openSections.marching_cubes ? 'rotate-180' : ''
            }`}
          />
        </button>

        {openSections.marching_cubes && (
          <div className="p-3 pt-2 border-t border-slate-800/60 flex flex-col gap-3 text-xs">
            <div className="flex justify-between text-slate-300">
              <span>Grid Voxel Resolution:</span>
              <span className="font-mono text-emerald-400">{meshResolution}³</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
              {[
                { r: 60, label: 'Fast (60³)' },
                { r: 70, label: 'Balanced (70³)' },
                { r: 80, label: 'High-Res (80³)' }
              ].map((opt) => (
                <button
                  key={opt.r}
                  onClick={() => setMeshResolution(opt.r)}
                  className={`py-1 text-[11px] font-medium rounded transition-colors ${
                    meshResolution === opt.r
                      ? 'bg-slate-800 text-emerald-400 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <button
              onClick={onRemesh}
              disabled={isMeshRegenerating}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs rounded-lg border border-slate-700 transition-colors disabled:opacity-50"
            >
              Re-evaluate Marching Cubes Mesh
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
