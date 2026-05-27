import { useState } from 'react';
import { RegistrationMark } from '../../components/RegistrationMark';
import { ArchDiagram } from '../../components/ArchDiagram';
import { PaperRef } from '../../components/PaperRef';
import type { ArchDiagramDef, DiagramBlock } from '../../lib/data/types';

import b1 from './diagrams/b1.json';
import b2 from './diagrams/b2.json';
import b3 from './diagrams/b3.json';
import b4 from './diagrams/b4.json';
import b5 from './diagrams/b5.json';
import m1 from './diagrams/m1.json';
import m2 from './diagrams/m2.json';
import m3 from './diagrams/m3.json';
import m4 from './diagrams/m4.json';

const DIAGRAMS: Record<string, ArchDiagramDef> = {
  b1: b1 as unknown as ArchDiagramDef,
  b2: b2 as unknown as ArchDiagramDef,
  b3: b3 as unknown as ArchDiagramDef,
  b4: b4 as unknown as ArchDiagramDef,
  b5: b5 as unknown as ArchDiagramDef,
  m1: m1 as unknown as ArchDiagramDef,
  m2: m2 as unknown as ArchDiagramDef,
  m3: m3 as unknown as ArchDiagramDef,
  m4: m4 as unknown as ArchDiagramDef,
};

const MODEL_OPTIONS: { id: string; label: string; disabled?: boolean }[] = [
  { id: 'b1', label: 'B1 — DP-B (vision only)' },
  { id: 'b2', label: 'B2 — DP-LF (flat concat)' },
  { id: 'b3', label: 'B3 — DP-PF (projected)' },
  { id: 'b4', label: 'B4 — DP-CA (cross-attn)' },
  { id: 'b5', label: 'B5 — DP-CA+N (normals)' },
  { id: 'm1', label: 'M1 — ACT+CFG' },
  { id: 'm2', label: 'M2 — DECO (MMDiT)' },
  { id: 'm3', label: 'M3 — FoAR' },
  { id: 'm4', label: 'M4 — Octo' },
  { id: 'm5', label: 'M5 — Custom MMDiT (TBD)', disabled: true },
];

const PRESETS: { label: string; a: string; b: string }[] = [
  { label: 'B1 vs B4', a: 'b1', b: 'b4' },
  { label: 'B4 vs M3', a: 'b4', b: 'm3' },
  { label: 'M3 vs M4', a: 'm3', b: 'm4' },
  { label: 'B4 vs DECO', a: 'b4', b: 'm2' },
  { label: 'B1 vs M1', a: 'b1', b: 'm1' },
];

function DiffPanel({
  diagramA,
  diagramB,
}: {
  diagramA: ArchDiagramDef;
  diagramB: ArchDiagramDef;
}) {
  const idsA = new Set(diagramA.blocks.map((b) => b.id));
  const idsB = new Set(diagramB.blocks.map((b) => b.id));

  const added = diagramB.blocks.filter((b) => !idsA.has(b.id));
  const removed = diagramA.blocks.filter((b) => !idsB.has(b.id));
  const shared = diagramA.blocks.filter((b) => idsB.has(b.id));

  return (
    <div className="card">
      <h3 className="font-mono text-xs text-text-primary mb-3">Differences</h3>
      <div className="space-y-1 font-mono text-2xs">
        {added.map((b) => (
          <div key={b.id} className="text-green-400">
            + {diagramB.model.toUpperCase()} adds: {b.label}
            {b.shape !== '—' && (
              <span className="text-text-tertiary ml-2">{b.shape}</span>
            )}
          </div>
        ))}
        {removed.map((b) => (
          <div key={b.id} className="text-red-400">
            − {diagramB.model.toUpperCase()} removes: {b.label}
          </div>
        ))}
        {added.length === 0 && removed.length === 0 && (
          <div className="text-text-disabled">
            Same block set ({shared.length} blocks)
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ diagram }: { diagram: ArchDiagramDef }) {
  return (
    <div className="card-sunken space-y-1.5 font-mono text-2xs">
      <div className="flex justify-between">
        <span className="text-text-secondary">Params</span>
        <span>{diagram.params}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-text-secondary">F/T Encoder</span>
        <span className="text-right max-w-[200px] truncate">
          {diagram.ft_encoder}
        </span>
      </div>
      <div className="flex justify-between">
        <span className="text-text-secondary">Fusion</span>
        <span className="text-right max-w-[200px] truncate">
          {diagram.fusion_mechanism}
        </span>
      </div>
      {diagram.paper && (
        <div className="flex justify-between">
          <span className="text-text-secondary">Paper</span>
          <span>{diagram.paper}</span>
        </div>
      )}
    </div>
  );
}

export default function ArchitectureDiff() {
  const [modelA, setModelA] = useState<string>('b1');
  const [modelB, setModelB] = useState<string>('b4');
  const [selectedBlock, setSelectedBlock] = useState<DiagramBlock | null>(null);

  const diagA = DIAGRAMS[modelA];
  const diagB = DIAGRAMS[modelB];

  return (
    <div className="container-demo py-8">
      <div className="flex items-center gap-3 mb-2">
        <RegistrationMark />
        <span className="font-mono text-2xs text-text-disabled">04</span>
        <h1 className="section-title">Architecture Diff Viewer</h1>
      </div>
      <p className="text-text-secondary text-sm mb-4">
        Each model is one path through the fusion choices. Select two models to
        compare their data flow side by side.
      </p>
      <div className="flex gap-2 mb-6">
        <PaperRef arxiv="2503.03998">Kang et al. 2025</PaperRef>
        <PaperRef arxiv="2303.04137">Chi et al. 2023</PaperRef>
      </div>

      {/* Preset buttons */}
      <div className="flex flex-wrap gap-2 mb-4">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => {
              setModelA(p.a);
              setModelB(p.b);
              setSelectedBlock(null);
            }}
            className={`font-mono text-2xs px-2 py-1 rounded border transition-colors ${
              modelA === p.a && modelB === p.b
                ? 'border-accent text-accent bg-accent/10'
                : 'border-border-subtle text-text-secondary hover:text-text-primary hover:border-border-strong'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Two side-by-side diagrams */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="font-mono text-2xs text-text-disabled">Model A</span>
            <select
              value={modelA}
              onChange={(e) => {
                setModelA(e.target.value);
                setSelectedBlock(null);
              }}
              className="bg-sunken border border-border-subtle rounded px-2 py-1 font-mono text-xs text-text-primary flex-1"
            >
              {MODEL_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id} disabled={opt.disabled}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          {diagA && (
            <>
              <div className="border border-border-subtle rounded-lg p-2 bg-sunken overflow-x-auto">
                <ArchDiagram
                  diagram={diagA}
                  diffWith={diagB}
                  onBlockClick={setSelectedBlock}
                />
              </div>
              <div className="mt-2">
                <SummaryCard diagram={diagA} />
              </div>
            </>
          )}
        </div>

        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="font-mono text-2xs text-text-disabled">Model B</span>
            <select
              value={modelB}
              onChange={(e) => {
                setModelB(e.target.value);
                setSelectedBlock(null);
              }}
              className="bg-sunken border border-border-subtle rounded px-2 py-1 font-mono text-xs text-text-primary flex-1"
            >
              {MODEL_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id} disabled={opt.disabled}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          {diagB && (
            <>
              <div className="border border-border-subtle rounded-lg p-2 bg-sunken overflow-x-auto">
                <ArchDiagram
                  diagram={diagB}
                  diffWith={diagA}
                  onBlockClick={setSelectedBlock}
                />
              </div>
              <div className="mt-2">
                <SummaryCard diagram={diagB} />
              </div>
            </>
          )}
        </div>
      </div>

      {/* Diff panel */}
      {diagA && diagB && <DiffPanel diagramA={diagA} diagramB={diagB} />}

      {/* Block detail panel */}
      {selectedBlock && (
        <div className="mt-4 card border-accent/30">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-mono text-xs text-accent">
              Block: {selectedBlock.label}
            </h3>
            <button
              onClick={() => setSelectedBlock(null)}
              className="font-mono text-2xs text-text-disabled hover:text-text-secondary"
            >
              ✕
            </button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-mono text-2xs">
            <div>
              <span className="text-text-tertiary block">ID</span>
              <span className="text-text-primary">{selectedBlock.id}</span>
            </div>
            <div>
              <span className="text-text-tertiary block">Kind</span>
              <span className="text-text-primary">{selectedBlock.kind}</span>
            </div>
            <div>
              <span className="text-text-tertiary block">Shape</span>
              <span className="text-text-primary">{selectedBlock.shape}</span>
            </div>
            {selectedBlock.fusion_kind && (
              <div>
                <span className="text-text-tertiary block">Fusion type</span>
                <span className="text-accent">{selectedBlock.fusion_kind}</span>
              </div>
            )}
            {selectedBlock.color && (
              <div>
                <span className="text-text-tertiary block">Modality</span>
                <span style={{ color: `var(--color-${selectedBlock.color})` }}>
                  {selectedBlock.color}
                </span>
              </div>
            )}
          </div>
          {/* Code references based on block type */}
          <div className="mt-3 pt-3 border-t border-border-subtle font-mono text-2xs text-text-disabled">
            {selectedBlock.kind === 'encoder' && selectedBlock.id.includes('resnet') && (
              <span>scripts/shared_encoders.py → RGBEncoder (ResNet-18 + SpatialSoftmax)</span>
            )}
            {selectedBlock.kind === 'encoder' && selectedBlock.id.includes('ft') && (
              <span>scripts/shared_encoders.py → ForceTorqueEncoder (MLP 180→256→128→64)</span>
            )}
            {selectedBlock.kind === 'encoder' && selectedBlock.id.includes('proprio') && (
              <span>scripts/shared_encoders.py → ProprioceptionEncoder (Linear 9→128→64)</span>
            )}
            {selectedBlock.id === 'xattn' && (
              <span>lerobot_policy_b4/modeling_b4.py → VisionForceCA (MultiheadAttention, 4 heads)</span>
            )}
            {selectedBlock.id === 'unet' && (
              <span>ConditionalUnet1D — Chi et al. 2023 (Diffusion Policy)</span>
            )}
            {selectedBlock.id === 'contact_gate' && (
              <span>lerobot_policy_foar/contact_gate.py → FoARContactGate</span>
            )}
            {selectedBlock.id === 'force_xfmr' && (
              <span>lerobot_policy_foar/force_transformer.py → ForceTransformer (2L self-attn)</span>
            )}
            {selectedBlock.id === 'transformer' && (
              <span>Octo-Base pretrained (93M params, Ghosh et al. 2024)</span>
            )}
            {selectedBlock.id === 'dit_blocks' && (
              <span>lerobot_policy_deco/deco_block.py → DECOBlock (8 layers, joint self-attn)</span>
            )}
            {selectedBlock.id === 'cfg_blend' && (
              <span>lerobot_policy_act_contact/modeling_act_contact.py → CFG blending</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
