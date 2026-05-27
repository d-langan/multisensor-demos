export type ModelId =
  | 'b1'
  | 'b2'
  | 'b3'
  | 'b4'
  | 'b5'
  | 'm1'
  | 'm2'
  | 'm3'
  | 'm4'
  | 'm5';

export type FusionKind =
  | 'concat'
  | 'projected_concat'
  | 'cross_attention'
  | 'contact_gated'
  | 'mmdit_joint'
  | 'adaLN_zero'
  | 'film'
  | 'cfg'
  | null;

export interface DataMeta {
  generated_from: string;
  extraction_script: string;
  extracted_at: string;
  git_sha: string;
  schema_version: number;
}

export interface EpisodeManifest {
  _meta: DataMeta;
  fps_video: number;
  fps_numeric: number;
  n_frames: number;
  duration_s: number;
  episode_index: number;
  dataset: string;
}

export interface ForceTorqueData {
  _meta: DataMeta;
  t: number[];
  fx: number[];
  fy: number[];
  fz: number[];
  tx: number[];
  ty: number[];
  tz: number[];
}

export interface ProprioceptionData {
  _meta: DataMeta;
  t: number[];
  px: number[];
  py: number[];
  pz: number[];
  rot6d: number[][];
}

export interface ActionsData {
  _meta: DataMeta;
  t: number[];
  dx: number[];
  dy: number[];
  dz: number[];
  droll: number[];
  dpitch: number[];
  dyaw: number[];
  fz: number[];
}

export interface Phase {
  label: 'approach' | 'contact' | 'retract';
  t_start: number;
  t_end: number;
}

export interface AnnotationsData {
  _meta: DataMeta;
  phases: Phase[];
  contact_threshold_N: number;
  fz_setpoint_N: number;
}

export interface PredictionFrame {
  t: number;
  predicted_chunk: number[][];
  executed: number[];
}

export interface ModelPredictions {
  _meta: DataMeta;
  model: ModelId;
  predictions: PredictionFrame[];
}

export interface AttentionFrame {
  t: number;
  phase: string;
  weights: number[][];
}

export interface AttentionData {
  _meta: DataMeta;
  model: ModelId;
  module: string;
  t_samples: number[];
  attention: AttentionFrame[];
}

export interface FeatureMapData {
  _meta: DataMeta;
  frame_idx: number;
  image: string;
  layer1_grid_png: string;
  layer4_tokens: number[][];
}

export type BlockKind =
  | 'obs'
  | 'encoder'
  | 'fusion'
  | 'cond'
  | 'backbone'
  | 'output';

export interface DiagramBlock {
  id: string;
  kind: BlockKind;
  label: string;
  shape: string;
  color?: string;
  tag?: string;
  fusion_kind?: FusionKind;
  paper?: string;
  code?: string;
  x?: number;
  y?: number;
}

export interface DiagramEdge {
  from: string;
  to: string;
  label?: string;
}

export interface ArchDiagramDef {
  model: ModelId;
  title: string;
  params: string;
  paper?: string;
  ft_encoder: string;
  fusion_mechanism: string;
  blocks: DiagramBlock[];
  edges: DiagramEdge[];
}

export type EncoderName =
  | 'resnet18_spatialsoftmax'
  | 'resnet18_spatial'
  | 'octo_smallstem16'
  | 'mlp_3layer_30step'
  | 'linear_projection'
  | 'cross_channel_proj_512'
  | 'force_transformer'
  | 'lowdim_tokenizer_256bin'
  | 'flat_concat'
  | 'mlp_proprio_64'
  | 'lowdim_tokenizer_proprio';

export type FusionStrategy =
  | 'concat'
  | 'projected_concat'
  | 'film'
  | 'cross_attention'
  | 'mmdit_joint'
  | 'contact_gated'
  | 'adaLN_zero'
  | 'classifier_free_guidance';

export interface TokenStream {
  label: string;
  shape: [number, number];
  data?: number[][];
}

export const SCHEMA_VERSION = 1;
