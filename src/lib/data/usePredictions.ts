import { useState, useEffect } from 'react';
import type { ModelId, ModelPredictions } from './types';
import { SCHEMA_VERSION } from './types';

const AVAILABLE_MODELS: ModelId[] = ['b1', 'm3', 'm4'];

export function usePredictions(modelId: ModelId): {
  data: ModelPredictions | null;
  loading: boolean;
  error: string | null;
  available: boolean;
} {
  const available = AVAILABLE_MODELS.includes(modelId);
  const [data, setData] = useState<ModelPredictions | null>(null);
  const [loading, setLoading] = useState(available);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!available) return;
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`./data/model_predictions/${modelId}.json`);
        if (!res.ok) throw new Error(`No predictions for ${modelId}`);
        const json = await res.json();
        if (json._meta?.schema_version !== SCHEMA_VERSION) {
          throw new Error(`Schema mismatch for ${modelId} predictions`);
        }
        if (!cancelled) {
          setData(json);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [modelId, available]);

  return { data, loading, error, available };
}

export function getAvailablePredictionModels(): ModelId[] {
  return AVAILABLE_MODELS;
}
