import { RegistrationMark } from '../../components/RegistrationMark';

export default function EncoderZoo() {
  return (
    <div className="container-demo py-8">
      <div className="flex items-center gap-3 mb-2">
        <RegistrationMark />
        <span className="font-mono text-2xs text-text-disabled">02</span>
        <h1 className="section-title">Encoder Zoo</h1>
      </div>
      <p className="text-text-secondary text-sm mb-8">
        How does each raw signal become a token (or vector)?
      </p>
      <div className="card-sunken flex items-center justify-center h-96">
        <span className="font-mono text-sm text-text-disabled">
          Token inspectors — coming in Phase 3
        </span>
      </div>
    </div>
  );
}
