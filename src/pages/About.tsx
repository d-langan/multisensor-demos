import { RegistrationMark } from '../components/RegistrationMark';

const PAPERS = [
  { anchor: 'Chi et al. 2023', arxiv: '2303.04137', venue: 'RSS', note: 'Diffusion Policy' },
  { anchor: 'Kang et al. 2025', arxiv: '2503.03998', venue: 'RA-L', note: 'F/T fusion baselines (B1–B5)' },
  { anchor: 'Lei et al. 2026', arxiv: '2604.01414', venue: '', note: 'Contact-gated CFG (M1)' },
  { anchor: 'He et al. 2025', arxiv: '2411.15753', venue: 'RA-L', note: 'FoAR (M3)' },
  { anchor: 'Li et al. 2025', arxiv: '2602.05513', venue: '', note: 'DECO (M2)' },
  { anchor: 'Ghosh et al. 2024', arxiv: '2405.12213', venue: 'RSS', note: 'Octo (M4)' },
  { anchor: 'Peebles & Xie 2023', arxiv: '2212.09748', venue: 'ICCV', note: 'DiT / adaLN-Zero' },
  { anchor: 'Vaswani et al. 2017', arxiv: '', venue: 'NeurIPS', note: 'Attention is All You Need' },
  { anchor: 'Zhou et al. 2019', arxiv: '1812.07035', venue: 'CVPR', note: '6D continuous rotation' },
  { anchor: 'Liu et al. 2025', arxiv: '2502.17432', venue: 'RSS', note: 'FACTR curriculum' },
  { anchor: 'Zhang et al. 2024', arxiv: '2410.01220', venue: '', note: 'L1 vs diffusion at <50 demos' },
  { anchor: 'Diaz et al. 2024', arxiv: '2410.14968', venue: '', note: 'AugInsert framework' },
  { anchor: 'Vig 2019', arxiv: '1906.05714', venue: 'ACL', note: 'BertViz attention head view' },
  { anchor: 'Abnar & Zuidema 2020', arxiv: '2005.00928', venue: 'ACL', note: 'Attention rollout' },
];

export default function About() {
  return (
    <div className="container-demo py-12 max-w-3xl">
      <div className="flex items-center gap-3 mb-6">
        <RegistrationMark size={24} />
        <h1 className="section-title">About This Site</h1>
      </div>

      <div className="space-y-6 text-text-secondary text-sm leading-relaxed">
        <p>
          This site visualizes 10 force-aware imitation learning architectures
          from a UMN MS capstone on aerospace aluminum grinding with a KUKA KR
          500. The comparison holds <em>signal content</em> fixed and varies only
          the <em>fusion strategy</em>, making it a controlled study of how
          multi-sensor inputs should be combined in modern learning policies.
        </p>

        <p>
          Thirteen demos walk through a pedagogical ladder: raw signals →
          encoders → fusion mechanisms → Kang's four-variant comparison →
          FoAR / Octo / DECO → behavioral consequences → a design-space map.
          Each demo answers one question about how multi-modal robotics
          perception works — made legible by <em>what attends to what</em>.
        </p>

        <p className="font-mono text-2xs text-text-disabled">
          Note on conventions: the Force Integration Ladder follows Kang et
          al.'s reported architecture and success rates (4-element force,
          0.39/0.48/0.57/0.96); the rest of the site uses this capstone's own
          6-DoF F/T implementation (B1–B5, M1–M5). Attention heatmaps are real
          extracted weights where available (FoAR Force Transformer, B4
          cross-attention) and clearly-labelled pedagogical synthetics
          otherwise.
        </p>

        <h2 className="section-title text-lg mt-8">Hardware</h2>
        <ul className="font-mono text-2xs space-y-1 text-text-secondary">
          <li>KUKA KR 500 R2830 F, KR C4 / KSS, RSI at 250 Hz</li>
          <li>ATI SI-1500-240 six-axis F/T sensor, 1 kHz → 30 Hz for policy I/O</li>
          <li>Orbbec Femto Mega i RGB-D, 30 Hz, 224×224 after resize</li>
          <li>TCP: 9D = 3D position + 6D continuous rotation (Zhou et al. 2019)</li>
        </ul>

        <h2 className="section-title text-lg mt-8">Paper References</h2>
        <div className="overflow-x-auto">
          <table className="w-full font-mono text-2xs">
            <thead>
              <tr className="text-text-tertiary text-left">
                <th className="py-2 pr-4">Citation</th>
                <th className="py-2 pr-4">Venue</th>
                <th className="py-2 pr-4">Note</th>
                <th className="py-2">arXiv</th>
              </tr>
            </thead>
            <tbody className="text-text-secondary">
              {PAPERS.map((p) => (
                <tr key={p.anchor} className="border-t border-border-subtle">
                  <td className="py-1.5 pr-4">{p.anchor}</td>
                  <td className="py-1.5 pr-4">{p.venue || '—'}</td>
                  <td className="py-1.5 pr-4">{p.note}</td>
                  <td className="py-1.5">
                    {p.arxiv ? (
                      <a
                        href={`https://arxiv.org/abs/${p.arxiv}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-accent hover:underline"
                      >
                        {p.arxiv}
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="section-title text-lg mt-8">Credits</h2>
        <p>
          Built by Danny Langan for the RPM Lab group at the University of
          Minnesota. Data from the force-aware grinding capstone using LeRobot
          v3.0. All demos use baked evaluation data — no backend or live
          inference.
        </p>
      </div>
    </div>
  );
}
