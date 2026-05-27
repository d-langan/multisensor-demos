import { useState, useEffect } from 'react';
import type { AttentionData, ModelId } from './types';
import { SCHEMA_VERSION } from './types';

const FILE_MAP: Record<string, string> = {
  'b4:VisionForceCA.cross_attn': 'b4_crossattn.json',
  'm3:ForceTransformer.self_attn': 'foar_force_transformer.json',
  'm2:DECOBlock.adapter_xattn': 'deco_xattn.json',
};

export function useAttention(
  modelId: ModelId,
  module: string,
): {
  data: AttentionData | null;
  loading: boolean;
  error: string | null;
} {
  const [data, setData] = useState<AttentionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const key = `${modelId}:${module}`;
    const file = FILE_MAP[key];

    if (!file) {
      setError(`No attention data for ${key}`);
      setLoading(false);
      return;
    }

    async function load() {
      try {
        const res = await fetch(`./data/attention_maps/${file}`);
        if (!res.ok) throw new Error(`Failed to load attention for ${key}`);
        const json = await res.json();
        if (json._meta?.schema_version !== SCHEMA_VERSION) {
          throw new Error(`Schema mismatch for ${key} attention`);
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
  }, [modelId, module]);

  return { data, loading, error };
}
