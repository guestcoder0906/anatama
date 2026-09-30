/**
 * Deep Learning Biomechanics & Neural Muscle Deformation Panel.
 * Visualizes real-time neural tensor activations, volumetric muscle bulge,
 * and coordinates Gemini API evolutionary biomechanics analysis.
 */

import React, { useState } from 'react';
import { CreatureDNA } from '../generator/dna';
import { MuscleDeformationEngine } from '../generator/deepLearningDeformation';
import { analyzeCreatureBiomechanics, BiomechanicsAnalysisResult } from '../generator/geminiBiomechanics';
import {
  Brain, Cpu, Activity, Sparkles, AlertCircle,
  Sliders, ShieldCheck, ChevronRight
} from 'lucide-react';

interface DeepLearningPanelProps {
  dna: CreatureDNA;
  muscleEngine: MuscleDeformationEngine;
  onUpdateDNA: (updater: (prev: CreatureDNA) => CreatureDNA) => void;
}

export const DeepLearningPanel: React.FC<DeepLearningPanelProps> = ({
  dna,
  muscleEngine,
  onUpdateDNA
}) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<BiomechanicsAnalysisResult | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);

  const stats = muscleEngine.currentStats;
  const muscleGroups = muscleEngine.getMuscleGroups();

  const handleRunAIAnalysis = async () => {
    setIsAnalyzing(true);
    setAnalysisError(null);
    try {
      const result = await analyzeCreatureBiomechanics(dna);
      setAnalysisResult(result);
    } catch (err: unknown) {
      setAnalysisError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 p-4 text-slate-200">
      {/* Neural Network Status Header */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 shadow-sm">
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/80">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-100">
              Neural Deformation Inference
            </h3>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Active Inference</span>
          </div>
        </div>

        {/* Real-time Tensor Telemetry Cards */}
        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
          <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/60">
            <div className="text-[10px] text-slate-400 uppercase">Inference Latency</div>
            <div className="text-sm font-semibold text-cyan-400 mt-0.5">{stats.inferenceTimeMs} ms</div>
          </div>
          <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/60">
            <div className="text-[10px] text-slate-400 uppercase">Kinematic Tensors</div>
            <div className="text-sm font-semibold text-slate-200 mt-0.5">{stats.activeTensors} weights</div>
          </div>
          <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/60">
            <div className="text-[10px] text-slate-400 uppercase">Peak Strain (Max)</div>
            <div className="text-sm font-semibold text-amber-400 mt-0.5">
              {(stats.peakStrain * 100).toFixed(1)}%
            </div>
          </div>
          <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/60">
            <div className="text-[10px] text-slate-400 uppercase">Mean Motor Activation</div>
            <div className="text-sm font-semibold text-emerald-400 mt-0.5">
              {(stats.meanActivation * 100).toFixed(1)}%
            </div>
          </div>
        </div>
      </div>

      {/* Live Muscle Activation Gauges */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="w-4 h-4 text-amber-400" />
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-100">
            Volumetric Muscle Bulge Predictor
          </h4>
        </div>

        <div className="flex flex-col gap-2.5">
          {muscleGroups.map((mg) => {
            const pct = Math.round(mg.activation * 100);
            return (
              <div key={mg.name} className="flex flex-col gap-1 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300 font-medium text-[11px]">{mg.name}</span>
                  <div className="flex items-center gap-2 text-[11px] font-mono">
                    <span className="text-slate-400">×{mg.bulgeRatio.toFixed(2)} vol</span>
                    <span className="text-amber-400 w-8 text-right">{pct}%</span>
                  </div>
                </div>
                <div className="w-full bg-slate-950 rounded-full h-1.5 overflow-hidden border border-slate-800/60">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 via-amber-400 to-rose-500 transition-all duration-75"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Vertex Displacement Tuning Sliders */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Sliders className="w-4 h-4 text-cyan-400" />
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-100">
            Displacement Parameters
          </h4>
        </div>

        <div className="flex flex-col gap-3 text-xs">
          <div>
            <div className="flex justify-between text-slate-300 mb-1">
              <span>Neural Bulge Magnitude:</span>
              <span className="font-mono text-cyan-400">{dna.neuralBulgeIntensity.toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min="0.5"
              max="2.2"
              step="0.05"
              value={dna.neuralBulgeIntensity}
              onChange={(e) =>
                onUpdateDNA((prev) => ({
                  ...prev,
                  neuralBulgeIntensity: parseFloat(e.target.value)
                }))
              }
              className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-950 rounded-lg"
            />
          </div>

          <div>
            <div className="flex justify-between text-slate-300 mb-1">
              <span>Respiration Rate (BPM):</span>
              <span className="font-mono text-cyan-400">{Math.round(dna.respirationRate)} BPM</span>
            </div>
            <input
              type="range"
              min="10"
              max="35"
              step="1"
              value={dna.respirationRate}
              onChange={(e) =>
                onUpdateDNA((prev) => ({
                  ...prev,
                  respirationRate: parseFloat(e.target.value)
                }))
              }
              className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-950 rounded-lg"
            />
          </div>

          <div>
            <div className="flex justify-between text-slate-300 mb-1">
              <span>Diaphragmatic Expansion:</span>
              <span className="font-mono text-cyan-400">
                {(dna.respirationAmplitude * 100).toFixed(1)}%
              </span>
            </div>
            <input
              type="range"
              min="0.01"
              max="0.08"
              step="0.005"
              value={dna.respirationAmplitude}
              onChange={(e) =>
                onUpdateDNA((prev) => ({
                  ...prev,
                  respirationAmplitude: parseFloat(e.target.value)
                }))
              }
              className="w-full accent-cyan-400 cursor-pointer h-1.5 bg-slate-950 rounded-lg"
            />
          </div>
        </div>
      </div>

      {/* Gemini AI Biomechanical Analysis Trigger */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3.5 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-100">
              Gemini Biomechanics Inference
            </h4>
          </div>
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed mb-3">
          Evaluates comparative vertebrate morphology, predicts muscle fiber ratios (Type IIb vs Type I),
          locomotion energetics, and calculates optimal deformation parameters.
        </p>

        <button
          onClick={handleRunAIAnalysis}
          disabled={isAnalyzing}
          className="w-full py-2 px-3 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 font-medium text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
        >
          {isAnalyzing ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-cyan-400/20 border-t-cyan-400 rounded-full animate-spin" />
              <span>Analyzing Comparative Biomechanics...</span>
            </>
          ) : (
            <>
              <Cpu className="w-3.5 h-3.5" />
              <span>Run Biomechanical Analysis</span>
            </>
          )}
        </button>

        {analysisError && (
          <div className="mt-2 text-xs text-rose-400 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{analysisError}</span>
          </div>
        )}

        {/* AI Results Dossier */}
        {analysisResult && (
          <div className="mt-3 pt-3 border-t border-slate-800 flex flex-col gap-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-400 text-[11px]">Plausibility Score</span>
              <span className="font-mono text-emerald-400 font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                {analysisResult.anatomicalPlausibilityScore}/100
              </span>
            </div>

            <div className="bg-slate-950/70 p-2.5 rounded-lg border border-slate-800 text-[11px] text-slate-300 leading-relaxed">
              <span className="font-semibold text-cyan-300">Functional Morphometry: </span>
              {analysisResult.scientificSummary}
            </div>

            {/* Muscle Fibers breakdown */}
            <div className="flex flex-col gap-1.5 bg-slate-950/70 p-2.5 rounded-lg border border-slate-800">
              <div className="text-[10px] text-slate-400 uppercase tracking-wide">
                Predicted Muscle Fiber Composition
              </div>
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="text-rose-400">
                  {analysisResult.muscleFiberComposition.fastTwitchPercent}% Fast-Twitch (IIb)
                </span>
                <span className="text-slate-600">/</span>
                <span className="text-sky-400">
                  {analysisResult.muscleFiberComposition.slowTwitchPercent}% Slow-Twitch (I)
                </span>
              </div>
              <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden flex">
                <div
                  className="h-full bg-rose-500"
                  style={{ width: `${analysisResult.muscleFiberComposition.fastTwitchPercent}%` }}
                />
                <div
                  className="h-full bg-sky-500"
                  style={{ width: `${analysisResult.muscleFiberComposition.slowTwitchPercent}%` }}
                />
              </div>
            </div>

            {/* Locomotion & Bite Force stats */}
            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
              <div className="bg-slate-950/70 p-2 rounded-lg border border-slate-800">
                <div className="text-[10px] text-slate-400">Est. Bite Force</div>
                <div className="text-amber-400 font-semibold mt-0.5">
                  {analysisResult.locomotionProfile.estimatedBiteForceNewtons.toLocaleString()} N
                </div>
              </div>
              <div className="bg-slate-950/70 p-2 rounded-lg border border-slate-800">
                <div className="text-[10px] text-slate-400">Cost of Transport</div>
                <div className="text-cyan-400 font-semibold mt-0.5">
                  {analysisResult.locomotionProfile.costOfTransportJ_kg_m} J/kg·m
                </div>
              </div>
            </div>

            <div className="text-[11px] text-slate-400 italic flex items-start gap-1.5">
              <ChevronRight className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0 mt-0.5" />
              <span>{analysisResult.deepLearningTuningAdvice}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
