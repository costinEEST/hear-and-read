export interface Segment {
  text: string;
  start: number;
  end: number;
}
export interface Document {
  title: string;
  text: string;
  language?: string;
  audioUrl: string;
  duration: number;
  segments: Segment[];
  timingSource: "publisher" | "estimated";
  sourceUrl: string;
  pronunciationUrl?: string;
  notice?: string;
  source?: Record<string, string>;
}

export class InputError extends Error {}
export class UpstreamError extends Error {
  constructor(public status: number) {
    super(`Source returned HTTP ${status}`);
  }
}
