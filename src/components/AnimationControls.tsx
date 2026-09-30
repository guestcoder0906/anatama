/**
 * Procedural Animation & Kinematics Control Bar.
 * Allows interactive switching of gait cycles, playback speed, and real-time bone kinematic inspection.
 */

import React from 'react';
import { GaitType, ProceduralAnimationEngine } from '../generator/proceduralAnimation';
import { CreatureDNA } from '../generator/dna';
import { Play, Pause, Gauge, Compass } from 'lucide-react';

interface AnimationControlsProps {
  animEngine: ProceduralAnimationEngine;
  currentGait: GaitType;
  setCurrentGait: (gait: GaitType) => void;
  playbackSpeed: number;
  setPlaybackSpeed: (speed: number) => void;
  isPaused: boolean;
  setIsPaused: (paused: boolean) => void;
  dna: CreatureDNA;
}

export const AnimationControls: React.FC<AnimationControlsProps> = ({
  animEngine,
  currentGait,
  setCurrentGait,
  playbackSpeed,
  setPlaybackSpeed,
  isPaused,
  setIsPaused,
  dna
}) => {
  const gaits: { id: GaitType; label: string; desc: string }[] = [
    { id: 'idle', label: 'Idle', desc: 'Respiration & resting posture' },
    { id: 'walk', label: 'Walk', desc: 'Diagonal trot stride' },
    { id: 'trot', label: 'Trot', desc: 'High-frequency steady gait' },
    { id: 'gallop', label: 'Gallop', desc: 'Asymmetrical bounding flex' },
    { id: 'prowl', label: 'Prowl', desc: 'Low-center stealth stalk' },
    { id: 'roar', label: 'Roar', desc: 'Spine rearing & jaw gape' },
  ];

  const handleGaitChange = (gait: GaitType) => {
    setCurrentGait(gait);
    animEngine.setGait(gait);
  };

  const handleSpeedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setPlaybackSpeed(val);
    animEngine.playbackSpeed = val;
  };

  const togglePlayPause = () => {
    const next = !isPaused;
    setIsPaused(next);
    animEngine.isPaused = next;
  };

  return (
    <div className="w-full bg-slate-900/90 border-t border-slate-800/80 px-4 py-2.5 backdrop-blur-md flex flex-wrap items-center justify-between gap-4">
      {/* Play/Pause & Gait Selectors */}
      <div className="flex items-center gap-3">
        <button
          onClick={togglePlayPause}
          className="flex items-center justify-center w-8 h-8 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold transition-transform active:scale-95 shadow-md shadow-cyan-500/20"
          title={isPaused ? 'Resume Animation' : 'Pause Animation'}
        >
          {isPaused ? <Play className="w-4 h-4 fill-current ml-0.5" /> : <Pause className="w-4 h-4 fill-current" />}
        </button>

        {/* Gait Segmented Tabs */}
        <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-lg border border-slate-800/60">
          {gaits.map((g) => (
            <button
              key={g.id}
              onClick={() => handleGaitChange(g.id)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                currentGait === g.id
                  ? 'bg-slate-800 text-cyan-400 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
              title={g.desc}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      {/* Speed Slider */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Gauge className="w-3.5 h-3.5 text-cyan-400" />
          <span>Speed:</span>
          <span className="font-mono text-slate-200 w-8">{playbackSpeed.toFixed(1)}x</span>
        </div>
        <input
          type="range"
          min="0.2"
          max="2.5"
          step="0.1"
          value={playbackSpeed}
          onChange={handleSpeedChange}
          className="w-24 accent-cyan-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
        />
      </div>

      {/* Kinematics Telemetry */}
      <div className="hidden lg:flex items-center gap-4 text-[11px] font-mono text-slate-400">
        <div className="flex items-center gap-1.5">
          <Compass className="w-3.5 h-3.5 text-slate-500" />
          <span>Stance:</span>
          <span className="text-slate-200 capitalize">{dna.stance.replace('_', ' ')}</span>
        </div>
        <span aria-hidden="true" className="text-slate-800">|</span>
        <div>
          <span>Locomotion:</span>
          <span className="text-cyan-400 ml-1">
            {dna.footPosture} ({dna.limbPairs * 2} Limbs)
          </span>
        </div>
      </div>
    </div>
  );
};
