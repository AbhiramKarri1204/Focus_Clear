import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Increase payload sizes so the server can handle high-res photo uploads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

let aiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY is missing in environment variables. Please check Settings > Secrets.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// REST API for Photo Focus Analysis
app.post("/api/analyze-image", async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ error: "No image payload provided" });
    }

    // Parse data URI to extract base64 payload and MIME type
    const match = image.match(/^data:([^;]+);base64,(.+)$/);
    let mimeType = "image/jpeg";
    let base64Data = image;

    if (match) {
      mimeType = match[1];
      base64Data = match[2];
    }

    // Lazy load the Gemini SDK
    const ai = getGeminiClient();

    const imagePart = {
      inlineData: {
        mimeType: mimeType,
        data: base64Data,
      },
    };

    const textPart = {
      text: "Assess if this photograph is blurry or out of focus. Analyze why it is blurry (e.g. motion shake, low-light blur, autofocus failure, dust/dirt on lens, depth of field issues) or confirm if it is sharp. Calculate a blur score on a scale of 0 to 100, where 100 is completely out of focus/blurry, and 0 is perfectly sharp and high-fidelity. Suggest exact optimal corrective parameters (Sharpening strength, Contrast boost, and Brightness adjustment) that can be applied to improve clarity. Then, generate an actionable, real-life photography tip to prevent this focus issue next time. ALSO: Identify the scene type (e.g., 'portrait', 'landscape', 'document', 'food', 'night', 'macro', or 'other'). Estimate scene confidence from 0 to 100 and describe how a custom, tailored sharpening strategy can optimize the result for this specific type of scene. Provide a breakdown of estimated blur/degradation sources in percentage (motionBlur, defocus/depth-of-field, lensSmudge, and noiseGrain) which must sum to 100%.",
    };

    // Use gemini-3.5-flash as specified in the guidelines for general task/image analysis
    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [imagePart, textPart],
      config: {
        systemInstruction: "You are an expert digital photography consultant and senior photo-retouching engineer. Analyze image focus precision and scene category with pixel-level exactness, and provide professional suggestions in structured JSON format.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isBlurry: {
              type: Type.BOOLEAN,
              description: "True if the photo suffers from visible blur, camera shake, or poor focus.",
            },
            blurScore: {
              type: Type.INTEGER,
              description: "Focus error rating. 0 means critically sharp, 100 is completely out-of-focus.",
            },
            analysis: {
              type: Type.STRING,
              description: "Detailed, professional analysis of the image's clarity and why any focus loss occurred.",
            },
            tipType: {
              type: Type.STRING,
              description: "Category of tip: 'stabilization' (for motion shake), 'focus' (for missed autofocus), 'cleanliness' (for lens dirt/smudge), 'lighting' (for slow shutter speeds), or 'depth' (for micro focus ranges).",
            },
            tipTitle: {
              type: Type.STRING,
              description: "A professional, extremely catchy, short label for how to avoid this issue.",
            },
            tipDescription: {
              type: Type.STRING,
              description: "Practical advice on stance, mechanics, camera settings, or preparations to eliminate this focus problem.",
            },
            suggestedSharpenAmount: {
              type: Type.INTEGER,
              description: "The ideal unblurring / sharpening strength from 0 (none) to 100 (maximum correction). Use high values (60-90) if blurry, lower (10-30) if already sharp.",
            },
            suggestedContrastBoost: {
              type: Type.INTEGER,
              description: "Contrast correction boost from 0 (none) to 100. Blur often reduces perceptual contrast.",
            },
            suggestedBrightnessBoost: {
              type: Type.INTEGER,
              description: "Brightness tuning from -50 (darken) to 50 (brighten). Positive values help reveal blurred details.",
            },
            sceneType: {
              type: Type.STRING,
              description: "The detected scene category: 'portrait', 'landscape', 'document', 'food', 'night', 'macro', or 'other'.",
            },
            sceneConfidence: {
              type: Type.INTEGER,
              description: "Confidence rating of scene detection from 0 to 100.",
            },
            sceneDescription: {
              type: Type.STRING,
              description: "Professional description of how the unblur engine customizes processing specifically for this scene type (e.g. skin detail optimization for portraits, edge-response matching for documents).",
            },
            blurBreakdown: {
              type: Type.OBJECT,
              description: "Estimated percentage breakdown of degradation sources summing to 100%.",
              properties: {
                motionBlur: { type: Type.INTEGER, description: "Percentage of blur caused by hand tremor, subject motion, or shutter speed issues (0 to 100)." },
                defocus: { type: Type.INTEGER, description: "Percentage of blur caused by lens focus drift, missed target, or narrow depth of field defocus (0 to 100)." },
                lensSmudge: { type: Type.INTEGER, description: "Percentage of blur or contrast loss caused by dirty glass, fingerprints, or camera oil residue (0 to 100)." },
                noiseGrain: { type: Type.INTEGER, description: "Percentage of quality degradation from sensor heat noise, ambient shadows grain, or high-ISO pixel flutter (0 to 100)." }
              },
              required: ["motionBlur", "defocus", "lensSmudge", "noiseGrain"]
            }
          },
          required: [
            "isBlurry",
            "blurScore",
            "analysis",
            "tipType",
            "tipTitle",
            "tipDescription",
            "suggestedSharpenAmount",
            "suggestedContrastBoost",
            "suggestedBrightnessBoost",
            "sceneType",
            "sceneConfidence",
            "sceneDescription",
            "blurBreakdown"
          ],
        },
      },
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("Empty analysis generated by Gemini.");
    }

    const data = JSON.parse(resultText.trim());
    return res.json(data);
  } catch (error: any) {
    console.error("Analysis API failed:", error);
    return res.status(500).json({
      error: error.message || "An unexpected error occurred during image focus analysis.",
    });
  }
});

// Vite & Static file serving setup
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in development mode with Vite HMR integration...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in production mode...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Focus Clear server successfully running at http://localhost:${PORT}`);
  });
}

startServer();
