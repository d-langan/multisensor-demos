import { RegistrationMark } from '../../components/RegistrationMark';

export default function FusionPlayground() {
  return (
    <div className="container-demo py-8">
      <div className="flex items-center gap-3 mb-2">
        <RegistrationMark />
        <span className="font-mono text-2xs text-text-disabled">03</span>
        <h1 className="section-title">Fusion Mechanism Playground</h1>
      </div>
      <p className="text-text-secondary text-sm mb-8">
        Same inputs, different ways of combining them.
      </p>
      <div className="card-sunken flex items-center justify-center h-96">
        <span className="font-mono text-sm text-text-disabled">
          Fusion animator — coming in Phase 3
        </span>
      </div>
    </div>
  );
}
