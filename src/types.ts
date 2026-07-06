export type TranscriptStyle = "dialogue" | "mom";

export interface TranscribeRequest {
  audioData: string; // base64
  mimeType: string;
  style: TranscriptStyle;
}

export interface TranscribeResponse {
  transcript: string;
}

export interface SummarizeResponse {
  summary: string;
}

export interface AudioMetadata {
  name: string;
  size: number;
  type: string;
  duration?: number; // in seconds
}
