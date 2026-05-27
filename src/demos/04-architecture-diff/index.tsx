import { RegistrationMark } from '../../components/RegistrationMark';

export default function ArchitectureDiff() {
  return (
    <div className="container-demo py-8">
      <div className="flex items-center gap-3 mb-2">
        <RegistrationMark />
        <span className="font-mono text-2xs text-text-disabled">04</span>
        <h1 className="section-title">Architecture Diff Viewer</h1>
      </div>
      <p className="text-text-secondary text-sm mb-8">
        Each model is one path through these fusion choices. See them side by
        side.
      </p>
      <div className="card-sunken flex items-center justify-center h-96">
        <span className="font-mono text-sm text-text-disabled">
          Architecture diagrams — coming in Phase 3
        </span>
      </div>
    </div>
  );
}
