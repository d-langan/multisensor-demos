import { useState, useEffect } from 'react';
import type {
  EpisodeManifest,
  ForceTorqueData,
  ProprioceptionData,
  ActionsData,
  AnnotationsData,
} from './types';
import { SCHEMA_VERSION } from './types';

const BASE = './data/episode_19';

async function fetchJson<T extends { _meta: { schema_version: number } }>(
  path: string,
): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
  const data = await res.json();
  if (data._meta?.schema_version !== SCHEMA_VERSION) {
    throw new Error(
      `Schema mismatch for ${path}: expected ${SCHEMA_VERSION}, got ${data._meta?.schema_version}`,
    );
  }
  return data as T;
}

export interface EpisodeData {
  manifest: EpisodeManifest;
  forceTorque: ForceTorqueData;
  proprioception: ProprioceptionData;
  actions: ActionsData;
  annotations: AnnotationsData;
}

export function useEpisode(): {
  data: EpisodeData | null;
  loading: boolean;
  error: string | null;
} {
  const [data, setData] = useState<EpisodeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [manifest, forceTorque, proprioception, actions, annotations] =
          await Promise.all([
            fetchJson<EpisodeManifest>(`${BASE}/manifest.json`),
            fetchJson<ForceTorqueData>(`${BASE}/force_torque.json`),
            fetchJson<ProprioceptionData>(`${BASE}/proprioception.json`),
            fetchJson<ActionsData>(`${BASE}/actions.json`),
            fetchJson<AnnotationsData>(`${BASE}/annotations.json`),
          ]);

        if (!cancelled) {
          setData({
            manifest,
            forceTorque,
            proprioception,
            actions,
            annotations,
          });
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
  }, []);

  return { data, loading, error };
}
