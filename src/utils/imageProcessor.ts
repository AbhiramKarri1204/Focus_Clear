import { ImageAdjustments } from "../types";

/**
 * Highly optimized image resizer to scale an image down while preserving aspect ratio.
 */
export function resizeImageToMax(img: HTMLImageElement, maxDim: number): Promise<HTMLCanvasElement> {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    let w = img.naturalWidth;
    let h = img.naturalHeight;

    if (w > maxDim || h > maxDim) {
      if (w > h) {
        h = Math.round((h * maxDim) / w);
        w = maxDim;
      } else {
        w = Math.round((w * maxDim) / h);
        h = maxDim;
      }
    }

    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.drawImage(img, 0, 0, w, h);
    }
    resolve(canvas);
  });
}

/**
 * Apply 3x3 custom focus-sharpening convolution, brightness, contrast, and scene-aware tailored enhancements.
 */
export function applyEnhancements(
  sourceCanvas: HTMLCanvasElement,
  targetCanvas: HTMLCanvasElement,
  adjustments: ImageAdjustments,
  sceneType?: "portrait" | "landscape" | "document" | "food" | "night" | "macro" | "other"
) {
  const width = sourceCanvas.width;
  const height = sourceCanvas.height;

  // Sync target dimensions
  targetCanvas.width = width;
  targetCanvas.height = height;

  const sourceCtx = sourceCanvas.getContext("2d");
  const targetCtx = targetCanvas.getContext("2d");

  if (!sourceCtx || !targetCtx) return;

  const srcImgData = sourceCtx.getImageData(0, 0, width, height);
  const srcPixels = srcImgData.data;

  const dstImgData = targetCtx.createImageData(width, height);
  const dstPixels = dstImgData.data;

  // Base sharpen intensity
  const s = adjustments.sharpenAmount / 120; // Scale sharpen up to ~0.83 max magnitude

  // Contrast and brightness configuration
  let contrastFactor = 1 + adjustments.contrastBoost / 100;
  let brightnessOffset = adjustments.brightnessBoost * 1.5;

  // Custom adjustments based on scene style
  if (sceneType === "document") {
    // Documents benefit from extremely high contrast to make text razor-sharp
    contrastFactor *= 1.25;
  } else if (sceneType === "food") {
    // Food looks richer with a slightly elevated warmth/vibrancy contrast baseline
    contrastFactor *= 1.05;
  } else if (sceneType === "landscape") {
    // Landscapes look crisper with extra structure
    contrastFactor *= 1.1;
  }

  // Single-pass pixel loop combining Convolution + Contrast + Brightness + Scene-Aware Kernels
  for (let y = 0; y < height; y++) {
    const yOff = y * width;
    const prevY = y > 0 ? y - 1 : 0;
    const nextY = y < height - 1 ? y + 1 : height - 1;

    const prevYOff = prevY * width;
    const nextYOff = nextY * width;

    for (let x = 0; x < width; x++) {
      const idx = (yOff + x) * 4;
      const leftX = x > 0 ? x - 1 : 0;
      const rightX = x < width - 1 ? x + 1 : width - 1;

      // Extract raw color values of 4-neighborhood + center pixel
      const rC = srcPixels[idx];
      const rT = srcPixels[(prevYOff + x) * 4];
      const rB = srcPixels[(nextYOff + x) * 4];
      const rL = srcPixels[(yOff + leftX) * 4];
      const rR = srcPixels[(yOff + rightX) * 4];

      const gC = srcPixels[idx + 1];
      const gT = srcPixels[(prevYOff + x) * 4 + 1];
      const gB = srcPixels[(nextYOff + x) * 4 + 1];
      const gL = srcPixels[(yOff + leftX) * 4 + 1];
      const gR = srcPixels[(yOff + rightX) * 4 + 1];

      const bC = srcPixels[idx + 2];
      const bT = srcPixels[(prevYOff + x) * 4 + 2];
      const bB = srcPixels[(nextYOff + x) * 4 + 2];
      const bL = srcPixels[(yOff + leftX) * 4 + 2];
      const bR = srcPixels[(yOff + rightX) * 4 + 2];

      // ====== 1. SCENE-AWARE REVOLUTIONARY KERNEL DAMPING / BOOSTING ======
      let sLocal = s;

      if (sceneType === "portrait") {
        // Detect skin tone pixels: r > 95, g > 40, b > 20, difference checks
        const isSkin = rC > 95 && gC > 40 && bC > 20 && (rC - gC) > 15 && rC > bC;
        // Check local high-frequency activity
        const edgeSum = Math.abs(rC - rL) + Math.abs(rC - rR) + Math.abs(rC - rT) + Math.abs(rC - rB);
        
        if (isSkin && edgeSum < 30) {
          // Soft-skin protection: damp deconvolution strength to 15% on human skin to avoid ugly coarse noise
          sLocal = s * 0.15;
        } else if (edgeSum > 60) {
          // Focus boost for eyes, clothing threads, eyelashes, hair details
          sLocal = s * 1.15;
        }
      } else if (sceneType === "night") {
        // Night scenes suffer from severe digital sensor noise in shadows.
        // Deep shadow-gating: calculate average luminance
        const lum = 0.299 * rC + 0.587 * gC + 0.114 * bC;
        if (lum < 55) {
          // Smoothly scale down sharpening to zero as we descend into dark sky or shadow blocks
          sLocal = s * (lum / 55) * 0.5;
        }
      } else if (sceneType === "document") {
        // Text is thin and needs strong local impulse response
        sLocal = s * 1.35;
      }

      // Compute convolution weights dynamically for the current pixel
      const cCenter = 1 + 4 * sLocal;
      const cEdge = -sLocal;

      // Compute convolution outputs
      let convR = rC * cCenter + (rT + rB + rL + rR) * cEdge;
      let convG = gC * cCenter + (gT + gB + gL + gR) * cEdge;
      let convB = bC * cCenter + (bT + bB + bL + bR) * cEdge;

      // Apply brightness boost
      convR += brightnessOffset;
      convG += brightnessOffset;
      convB += brightnessOffset;

      // Apply contrast curve (centered at mid-grey 128)
      convR = (convR - 128) * contrastFactor + 128;
      convG = (convG - 128) * contrastFactor + 128;
      convB = (convB - 128) * contrastFactor + 128;

      // ====== 2. SCENE-AWARE TARGETED CHROMATIC TREATMENTS ======
      if (sceneType === "food") {
        // Warm/delicious saturation boost (elevate organic tones, keep blues crisp)
        const avg = (convR + convG + convB) / 3;
        convR = avg + (convR - avg) * 1.18; // Boost red delicious
        convG = avg + (convG - avg) * 1.12; // Boost fresh leaf greens
        convB = avg + (convB - avg) * 0.95; // Slightly attenuate blue to warm up food plates
      } else if (sceneType === "landscape") {
        // Skyline foliage and atmosphere separation:
        // Enhance green saturation where green is dominant (vegetation)
        if (convG > convR && convG > convB) {
          const avg = (convR + convG + convB) / 3;
          convG = avg + (convG - avg) * 1.15;
        }
        // Enhance blue saturation where blue is dominant (lakes, skies)
        if (convB > convR && convB > convG) {
          const avg = (convR + convG + convB) / 3;
          convB = avg + (convB - avg) * 1.15;
        }
      } else if (sceneType === "document") {
        // Ink blackening / White paper bleaching curve for extreme contrast readability
        const lum = 0.299 * convR + 0.587 * convG + 0.114 * convB;
        if (lum < 110) {
          // Pull dark ink/pencil markings closer to pitch black
          const factor = 0.75;
          convR *= factor;
          convG *= factor;
          convB *= factor;
        } else if (lum > 145) {
          // Push white/grey papers closer to pristine background white
          const factor = 1.15;
          convR = Math.min(255, convR * factor);
          convG = Math.min(255, convG * factor);
          convB = Math.min(255, convB * factor);
        }
      }

      // Clamp color outputs between 0 and 255 and write back
      dstPixels[idx] = convR < 0 ? 0 : convR > 255 ? 255 : convR;
      dstPixels[idx + 1] = convG < 0 ? 0 : convG > 255 ? 255 : convG;
      dstPixels[idx + 2] = convB < 0 ? 0 : convB > 255 ? 255 : convB;
      dstPixels[idx + 3] = srcPixels[idx + 3]; // Preserve alpha
    }
  }

  targetCtx.putImageData(dstImgData, 0, 0);
}
