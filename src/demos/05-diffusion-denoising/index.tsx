import { RegistrationMark } from '../../components/RegistrationMark';

export default function DiffusionDenoising() {
  return (
    <div className="container-demo py-8">
      <div className="flex items-center gap-3 mb-2">
        <RegistrationMark />
        <span className="font-mono text-2xs text-text-disabled">05</span>
        <h1 className="section-title">Diffusion Denoising</h1>
      </div>
      <p className="text-text-secondary text-sm mb-8">
        Why does fusion matter behaviorally? Show denoising with and without
        force conditioning.
      </p>
      <div className="card-sunken flex items-center justify-center h-96">
        <span className="font-mono text-sm text-text-disabled">
          Denoising comparison — coming in Phase 4
        </span>
      </div>
    </div>
  );
}
