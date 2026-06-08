export interface FocusAnalysisResult {
  isBlurry: boolean;
  blurScore: number; // 0 (sharp) to 100 (out-of-focus)
  analysis: string;
  tipType: "stabilization" | "focus" | "cleanliness" | "lighting" | "depth";
  tipTitle: string;
  tipDescription: string;
  suggestedSharpenAmount: number; // 0 to 100
  suggestedContrastBoost: number; // 0 to 100
  suggestedBrightnessBoost: number; // -50 to 50
  sceneType?: "portrait" | "landscape" | "document" | "food" | "night" | "macro" | "other";
  sceneConfidence?: number; // 0 to 100
  sceneDescription?: string;
  blurBreakdown?: {
    motionBlur: number;       // 0 to 100
    defocus: number;          // 0 to 100 (Focus misalignment / Depth of field issue)
    lensSmudge: number;       // 0 to 100
    noiseGrain: number;       // 0 to 100
  };
}

export interface ImageAdjustments {
  sharpenAmount: number; // 0 to 100
  contrastBoost: number; // 0 to 100
  brightnessBoost: number; // -50 to 50
}
