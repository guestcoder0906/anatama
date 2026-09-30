/**
 * Game Engine Export Modal (Unity, Unreal Engine, Blender, Godot).
 * Facilitates one-click downloading of Rigged GLB, Unity C# script, OBJ mesh, and JSON dossier.
 */

import React, { useState } from 'react';
import { CreatureDNA } from '../generator/dna';
import { RiggedCreature } from '../generator/rigging';
import { ProceduralAnimationEngine } from '../generator/proceduralAnimation';
import {
  exportToGLTF,
  exportToOBJ,
  generateUnityControllerScript,
  generateScientificDossier,
  downloadBlob
} from '../generator/exporters';
import {
  X, Download, Box, FileCode, FileText,
  Check, Copy, Sparkles, AlertCircle
} from 'lucide-react';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  dna: CreatureDNA;
  rig: RiggedCreature | null;
  animEngine: ProceduralAnimationEngine;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  dna,
  rig,
  animEngine
}) => {
  const [isExportingGLB, setIsExportingGLB] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  if (!isOpen) return null;

  const baseFilename = dna.scientificName.replace(/\s+/g, '_').toLowerCase();

  // Export GLTF / GLB (Rigged + Animated)
  const handleExportGLB = async () => {
    if (!rig) return;
    setIsExportingGLB(true);
    setExportError(null);
    try {
      const blob = await exportToGLTF(rig, dna, animEngine);
      downloadBlob(blob, `${baseFilename}_rigged_animated.glb`);
    } catch (err: unknown) {
      setExportError(err instanceof Error ? err.message : 'GLB export failed');
    } finally {
      setIsExportingGLB(false);
    }
  };

  // Export OBJ
  const handleExportOBJ = () => {
    if (!rig) return;
    const blob = exportToOBJ(rig.skinnedMesh.geometry, dna);
    downloadBlob(blob, `${baseFilename}_mesh.obj`);
  };

  // Export Unity C# Script
  const handleExportUnityScript = () => {
    if (!rig) return;
    const script = generateUnityControllerScript(dna, rig.boneNames);
    const blob = new Blob([script], { type: 'text/plain' });
    downloadBlob(blob, 'ProceduralCreatureController.cs');
  };

  // Copy C# script to clipboard
  const handleCopyUnityScript = () => {
    if (!rig) return;
    const script = generateUnityControllerScript(dna, rig.boneNames);
    navigator.clipboard.writeText(script);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  // Export JSON Specimen Dossier
  const handleExportJSON = () => {
    const jsonStr = generateScientificDossier(dna);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    downloadBlob(blob, `${baseFilename}_dossier.json`);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div>
            <h2 className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <Box className="w-5 h-5 text-cyan-400" />
              Game Engine Model & Rig Export
            </h2>
            <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
              <span>{dna.scientificName}</span>
              <span aria-hidden="true">·</span>
              <span className="text-cyan-400 font-mono">Unity / Unreal / Blender / Godot</span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex flex-col gap-5 text-slate-300 text-xs">
          {exportError && (
            <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{exportError}</span>
            </div>
          )}

          {/* Primary Export Option: Rigged & Animated GLB */}
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800 flex flex-col gap-3">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-semibold text-slate-100 flex items-center gap-2">
                  <span>Rigged & Animated GLTF / GLB</span>
                  <span className="text-[10px] font-mono text-cyan-400 bg-cyan-950/80 border border-cyan-800/60 px-2 py-0.5 rounded-full">
                    Recommended for Unity
                  </span>
                </div>
                <p className="text-slate-400 mt-1 leading-relaxed">
                  Watertight Marching Cubes continuous single mesh, full skeletal bone hierarchy ({rig?.bones.length} bones),
                  4-bone linear blend skin weights, and 4 baked procedural animation clips (IDLE, WALK, GALLOP, ROAR).
                </p>
              </div>
            </div>

            <button
              onClick={handleExportGLB}
              disabled={isExportingGLB || !rig}
              className="py-2.5 px-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-semibold text-xs rounded-xl shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
            >
              {isExportingGLB ? (
                <>
                  <div className="w-4 h-4 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" />
                  <span>Packaging Rig & Animations...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Download Rigged GLB Model (.glb)</span>
                </>
              )}
            </button>
          </div>

          {/* Secondary Exports Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Unity C# Script */}
            <div className="p-3.5 rounded-xl bg-slate-950/50 border border-slate-800 flex flex-col justify-between gap-2.5">
              <div>
                <div className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <FileCode className="w-4 h-4 text-emerald-400" />
                  <span>Unity C# Script</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Custom MonoBehavior controller with real-time breathing & procedural bone sway.
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleExportUnityScript}
                  className="flex-1 py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors"
                >
                  .cs File
                </button>
                <button
                  onClick={handleCopyUnityScript}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
                  title="Copy code to clipboard"
                >
                  {copiedScript ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Wavefront OBJ */}
            <div className="p-3.5 rounded-xl bg-slate-950/50 border border-slate-800 flex flex-col justify-between gap-2.5">
              <div>
                <div className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <Box className="w-4 h-4 text-sky-400" />
                  <span>Wavefront OBJ</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Continuous single mesh geometry with normals and cylindrical UV coordinates.
                </p>
              </div>
              <button
                onClick={handleExportOBJ}
                className="w-full py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors"
              >
                Download OBJ
              </button>
            </div>

            {/* Scientific JSON Specimen Dossier */}
            <div className="p-3.5 rounded-xl bg-slate-950/50 border border-slate-800 flex flex-col justify-between gap-2.5">
              <div>
                <div className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-purple-400" />
                  <span>Scientific Dossier</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Morphometrics, taxonomic class, estimated mass, bite force & gait metrics.
                </p>
              </div>
              <button
                onClick={handleExportJSON}
                className="w-full py-1.5 px-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors"
              >
                Download JSON
              </button>
            </div>
          </div>

          {/* Quick Unity Integration Guide */}
          <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/80 flex flex-col gap-2">
            <div className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>Unity Engine Integration Guide (3 Easy Steps)</span>
            </div>
            <ol className="list-decimal list-inside text-[11px] text-slate-400 space-y-1.5 leading-relaxed">
              <li>
                <strong className="text-slate-300">Drag GLB into Unity:</strong> Drag the downloaded <code className="text-cyan-300">.glb</code> file into your Unity Project's Assets folder.
              </li>
              <li>
                <strong className="text-slate-300">Configure Rig:</strong> Select the imported asset, go to the <strong className="text-slate-300">Rig tab</strong> in the Inspector, choose <code className="text-cyan-300">Generic</code> (or Humanoid for bipedal), and click Apply.
              </li>
              <li>
                <strong className="text-slate-300">Attach Controller:</strong> Drag the model into your scene and attach <code className="text-cyan-300">ProceduralCreatureController.cs</code> to drive procedural kinematics, breathing, and animation clips.
              </li>
            </ol>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-800 flex justify-end bg-slate-950/40">
          <button
            onClick={onClose}
            className="py-1.5 px-4 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
