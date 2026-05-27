import { RegistrationMark } from '../../components/RegistrationMark';

export default function FailureModes() {
  return (
    <div className="container-demo py-8">
      <div className="flex items-center gap-3 mb-2">
        <RegistrationMark />
        <span className="font-mono text-2xs text-text-disabled">07</span>
        <h1 className="section-title">Failure Mode Taxonomy</h1>
      </div>
      <p className="text-text-secondary text-sm mb-8">
        When force-aware models fail, why?
      </p>
      <div className="card-sunken flex items-center justify-center h-96">
        <span className="font-mono text-sm text-text-disabled">
          Failure mode explorer — optional (Phase 6)
        </span>
      </div>
    </div>
  );
}
