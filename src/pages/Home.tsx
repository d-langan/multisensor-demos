import { Link } from 'react-router-dom';
import { DEMOS } from '../lib/demoRegistry';
import { MODALITY_HEX } from '../lib/viz/colors';
import { RegistrationMark } from '../components/RegistrationMark';

const PRIORITY_STYLE = {
  P0: 'text-accent',
  P1: 'text-text-secondary',
  P2: 'text-text-tertiary',
} as const;

const PRIORITY_BG: Record<string, string> = {
  P0: 'rgba(255, 90, 31, 0.15)',
  P1: 'rgba(251, 146, 60, 0.15)',
  P2: 'rgba(108, 112, 121, 0.15)',
};

export default function Home() {
  return (
    <div className="container-demo py-12">
      <div className="flex items-start gap-4 mb-2">
        <RegistrationMark size={32} />
        <div>
          <h1 className="demo-hero text-text-primary">
            Multi-Sensor
            <br />
            Learning Models
          </h1>
        </div>
      </div>
      <p className="text-text-secondary text-lg mb-12 max-w-2xl">
        How do force, vision, and proprioception get encoded and fused in modern
        imitation learning policies? Seven interactive demos walk through the
        architecture ladder from raw signals to deployment behavior.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {DEMOS.map((demo) => (
          <Link
            key={demo.id}
            to={demo.route}
            className="card group relative overflow-hidden no-underline hover:border-border-strong transition-colors"
          >
            <div
              className="absolute top-0 left-0 w-1 h-full"
              style={{ backgroundColor: MODALITY_HEX[demo.accentModality] }}
            />
            <div className="pl-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-mono text-2xs text-text-disabled">
                  {demo.number}
                </span>
                <span
                  className={`font-mono text-2xs px-1.5 py-0.5 rounded ${PRIORITY_STYLE[demo.priority]}`}
                  style={{ backgroundColor: PRIORITY_BG[demo.priority] }}
                >
                  {demo.priority}
                </span>
                <span className="font-mono text-2xs text-text-disabled ml-auto">
                  {demo.talkMinutes}
                </span>
              </div>
              <h3 className="text-lg font-semibold text-text-primary group-hover:text-accent transition-colors mb-1">
                {demo.title}
              </h3>
              <p className="text-sm text-text-secondary leading-relaxed">
                {demo.question}
              </p>
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-16 card-sunken">
        <h2 className="section-title mb-4">The Comparison Ladder</h2>
        <div className="overflow-x-auto">
          <table className="w-full font-mono text-2xs">
            <thead>
              <tr className="text-text-tertiary text-left">
                <th className="py-2 pr-4">ID</th>
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Force Integration</th>
                <th className="py-2 pr-4">Backbone</th>
              </tr>
            </thead>
            <tbody className="text-text-secondary">
              <tr className="border-t border-border-subtle">
                <td className="py-1.5 pr-4">B1</td>
                <td className="pr-4">DP-B</td>
                <td className="pr-4 text-text-disabled">None (vision only)</td>
                <td className="pr-4">ResNet-18 + SS + UNet1D</td>
              </tr>
              <tr className="border-t border-border-subtle">
                <td className="py-1.5 pr-4">B2</td>
                <td className="pr-4">DP-LF</td>
                <td className="pr-4">Flat F/T concat (15D)</td>
                <td className="pr-4">Same as B1</td>
              </tr>
              <tr className="border-t border-border-subtle">
                <td className="py-1.5 pr-4">B3</td>
                <td className="pr-4">DP-PF</td>
                <td className="pr-4">Linear proj 6→64</td>
                <td className="pr-4">Same + ForceProjection</td>
              </tr>
              <tr className="border-t border-border-subtle">
                <td className="py-1.5 pr-4">B4</td>
                <td className="pr-4">DP-CA</td>
                <td className="pr-4" style={{ color: MODALITY_HEX.force }}>
                  Cross-attention (F/T Q → img KV)
                </td>
                <td className="pr-4">ResNet-18 spatial + VisionForceCA</td>
              </tr>
              <tr className="border-t border-border-subtle">
                <td className="py-1.5 pr-4">B5</td>
                <td className="pr-4">DP-CA+N</td>
                <td className="pr-4" style={{ color: MODALITY_HEX.force }}>
                  B4 + surface normals
                </td>
                <td className="pr-4">B4 + normals ResNet-18</td>
              </tr>
              <tr className="border-t border-border-strong">
                <td className="py-1.5 pr-4">M1</td>
                <td className="pr-4">ACT+CFG</td>
                <td className="pr-4" style={{ color: MODALITY_HEX.force }}>
                  Contact-gated CFG
                </td>
                <td className="pr-4">CVAE (ACT) + scale predictor</td>
              </tr>
              <tr className="border-t border-border-subtle">
                <td className="py-1.5 pr-4">M2</td>
                <td className="pr-4">DECO</td>
                <td className="pr-4" style={{ color: MODALITY_HEX.force }}>
                  adaLN-Zero + joint self-attn + adapter
                </td>
                <td className="pr-4">MMDiT + Flow Matching</td>
              </tr>
              <tr className="border-t border-border-subtle">
                <td className="py-1.5 pr-4">M3</td>
                <td className="pr-4">FoAR</td>
                <td className="pr-4" style={{ color: MODALITY_HEX.force }}>
                  Force Transformer + contact gate
                </td>
                <td className="pr-4">UNet1D + DP3</td>
              </tr>
              <tr className="border-t border-border-subtle">
                <td className="py-1.5 pr-4">M4</td>
                <td className="pr-4">Octo</td>
                <td className="pr-4" style={{ color: MODALITY_HEX.force }}>
                  256-bin quantized tokens
                </td>
                <td className="pr-4">93M pretrained + L1 head</td>
              </tr>
              <tr className="border-t border-border-subtle">
                <td className="py-1.5 pr-4 text-text-disabled">M5</td>
                <td className="pr-4 text-text-disabled">Custom MMDiT</td>
                <td className="pr-4 text-text-disabled">TBD</td>
                <td className="pr-4 text-text-disabled">—</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
