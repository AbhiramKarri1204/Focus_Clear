import { useState, useRef, useEffect, MouseEvent, TouchEvent, DragEvent, ChangeEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Camera, Upload, Download, Sparkles, 
  AlertCircle, CheckCircle2, Image as ImageIcon, 
  Sliders, Gauge, Eye, RefreshCw, Grid, Split, 
  AlertTriangle, Sun, Zap, Info, ShieldAlert, Sparkle, ShieldCheck,
  User, Mountain, FileText, Utensils, Moon
} from "lucide-react";
import { FocusAnalysisResult, ImageAdjustments } from "../types";
import { resizeImageToMax, applyEnhancements } from "../utils/imageProcessor";

export default function FocusCheckFix() {
  // Image states
  const [originalSrc, setOriginalSrc] = useState<string | null>(null);
  const [originalImageObj, setOriginalImageObj] = useState<HTMLImageElement | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [fileSize, setFileSize] = useState<string>("");

  // Canvases for fast client-side rendering
  const [sourceCanvas, setSourceCanvas] = useState<HTMLCanvasElement | null>(null);
  const targetCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Interaction states
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // AI results
  const [analysisResult, setAnalysisResult] = useState<FocusAnalysisResult | null>(null);
  const [activeSceneOverride, setActiveSceneOverride] = useState<"portrait" | "landscape" | "document" | "food" | "night" | "macro" | "other" | null>(null);
  const [adjustments, setAdjustments] = useState<ImageAdjustments>({
    sharpenAmount: 40,
    contrastBoost: 10,
    brightnessBoost: 0,
  });

  // Slider controls UI (permanently locked to grid view)
  const comparisonMode = "grid";
  const [sliderPosition, setSliderPosition] = useState(0.5); 
  const [isDraggingSlider, setIsDraggingSlider] = useState(false);
  const [showOriginalInToggle, setShowOriginalInToggle] = useState(false);

  // Hidden references for download processing
  const [isExporting, setIsExporting] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Analysis messaging animation cycle
  useEffect(() => {
    if (!isAnalyzing) return;
    const stages = [
      "Uploading and decoding image metadata...",
      "Analyzing spatial frequency of pixel groupings...",
      "Consulting Gemini Focus Intelligence model...",
      "Evaluating edge-gradient transitions for motion vectors...",
      "Calculating optimal restorative deconvolution parameters...",
      "Synthesizing focus restoration configurations...",
    ];
    let idx = 0;
    setAnalysisProgress(stages[0]);

    const interval = setInterval(() => {
      if (idx < stages.length - 1) {
        idx++;
        setAnalysisProgress(stages[idx]);
      }
    }, 2800);

    return () => clearInterval(interval);
  }, [isAnalyzing]);

  // Redraw the enhanced canvas whenever adjustments, source canvas, or detected scene changes
  useEffect(() => {
    if (sourceCanvas && targetCanvasRef.current) {
      applyEnhancements(
        sourceCanvas, 
        targetCanvasRef.current, 
        adjustments, 
        activeSceneOverride || analysisResult?.sceneType
      );
    }
  }, [adjustments, originalImageObj, analysisResult?.sceneType, activeSceneOverride, comparisonMode, showOriginalInToggle, sourceCanvas]);

  // Handle image drag and drop events
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = () => {
    setIsDraggingOver(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      processSelectedFile(files[0]);
    }
  };

  const handleFileSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processSelectedFile(files[0]);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  // Main file processor
  const processSelectedFile = (file: File) => {
    if (!file.type.startsWith("image/")) {
      setErrorMsg("Please select a valid image file (PNG, JPG, or WEBP).");
      return;
    }

    setErrorMsg(null);
    setFileName(file.name);
    setFileSize(formatBytes(file.size));
    
    // Clear previous results
    setAnalysisResult(null);
    setActiveSceneOverride(null);

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setOriginalSrc(dataUrl);

      const img = new Image();
      img.onload = async () => {
        setOriginalImageObj(img);
        
        // Resize image to max 1000px for fluent interactive layout rendering
        const scaledCanvas = await resizeImageToMax(img, 1000);
        setSourceCanvas(scaledCanvas);

        // Initialize adjustments to default initially
        setAdjustments({
          sharpenAmount: 30,
          contrastBoost: 10,
          brightnessBoost: 5,
        });

        // Trigger AI analysis
        analyzeWithAI(dataUrl);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  // Submit base64 photo descriptor to the back-end
  const analyzeWithAI = async (base64Payload: string) => {
    setIsAnalyzing(true);
    setErrorMsg(null);

    try {
      const response = await fetch("/api/analyze-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64Payload }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Analysis failed on the server.");
      }

      const report: FocusAnalysisResult = await response.json();
      setAnalysisResult(report);

      // Instantly auto-apply AI's customized parameters!
      setAdjustments({
        sharpenAmount: report.suggestedSharpenAmount,
        contrastBoost: report.suggestedContrastBoost,
        brightnessBoost: report.suggestedBrightnessBoost,
      });

    } catch (e: any) {
      console.error(e);
      setErrorMsg(e.message || "Could not analyze the photo. Checking file size and backend connection is recommended.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Before / After Slider interaction calculations (obsolete in Grid Mode)
  const calculateSliderPosition = (clientX: number) => {};

  const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {};

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {};

  const handleMouseUpOrLeave = () => {};

  // Mobile Touch Support for Before / After Slider (obsolete in Grid Mode)
  const handleTouchStart = (e: TouchEvent<HTMLDivElement>) => {};

  const handleTouchMove = (e: TouchEvent<HTMLDivElement>) => {};

  // Reset parameters back to AI-computed recommendations
  const restoreAIRecommendations = () => {
    if (!analysisResult) return;
    setAdjustments({
      sharpenAmount: analysisResult.suggestedSharpenAmount,
      contrastBoost: analysisResult.suggestedContrastBoost,
      brightnessBoost: analysisResult.suggestedBrightnessBoost,
    });
  };

  // Perform full-resolution unblurring/sharpening and download
  const handleHighResDownload = async () => {
    if (!originalImageObj) return;
    setIsExporting(true);

    try {
      // 1. Create offline canvases at full native resolution
      const fullSourceCanvas = document.createElement("canvas");
      const fullTargetCanvas = document.createElement("canvas");

      fullSourceCanvas.width = originalImageObj.naturalWidth;
      fullSourceCanvas.height = originalImageObj.naturalHeight;

      const fCtx = fullSourceCanvas.getContext("2d");
      if (fCtx) {
        fCtx.drawImage(originalImageObj, 0, 0);
      }

      // 2. Perform pixel computation on the high-res image
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          applyEnhancements(
            fullSourceCanvas,
            fullTargetCanvas,
            adjustments,
            activeSceneOverride || analysisResult?.sceneType
          );
          resolve();
        }, 100);
      });

      // 3. Initiate browser download
      const cleanFileName = fileName.replace(/\.[^/.]+$/, "") + "_sharpened.png";
      const dataUrl = fullTargetCanvas.toDataURL("image/png");

      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = cleanFileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

    } catch (err) {
      console.error("High-Res export failure:", err);
      // Fallback: download preview size
      if (targetCanvasRef.current) {
        const link = document.createElement("a");
        link.href = targetCanvasRef.current.toDataURL("image/png");
        link.download = "sharpened_preview.png";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } finally {
      setIsExporting(false);
    }
  };

  // Clear current project
  const handleClear = () => {
    setOriginalSrc(null);
    setOriginalImageObj(null);
    setFileName("");
    setFileSize("");
    setAnalysisResult(null);
    setActiveSceneOverride(null);
    setErrorMsg(null);
    setSourceCanvas(null);
    targetCanvasRef.current = null;
  };

  // Define tip category color schema for Sophisticated Dark theme
  const getTipStyles = (type: string) => {
    switch (type) {
      case "stabilization":
        return {
          bg: "bg-[#0A0A0A] text-zinc-300 border-zinc-850",
          badge: "bg-amber-500/10 text-amber-400 border-amber-500/30",
          icon: <ShieldAlert className="w-5 h-5 text-amber-400" />,
        };
      case "lighting":
        return {
          bg: "bg-[#0A0A0A] text-zinc-300 border-zinc-850",
          badge: "bg-violet-500/10 text-violet-400 border-violet-500/30",
          icon: <Sun className="w-5 h-5 text-violet-400" />,
        };
      case "cleanliness":
        return {
          bg: "bg-[#0A0A0A] text-zinc-300 border-zinc-850",
          badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
          icon: <Sparkle className="w-5 h-5 text-emerald-400" />,
        };
      case "focus":
        return {
          bg: "bg-[#0A0A0A] text-zinc-300 border-zinc-850",
          badge: "bg-[#D4AF37]/15 text-[#D4AF37] border-[#D4AF37]/30",
          icon: <Gauge className="w-5 h-5 text-[#D4AF37]" />,
        };
      case "depth":
      default:
        return {
          bg: "bg-[#0A0A0A] text-zinc-300 border-zinc-850",
          badge: "bg-zinc-500/10 text-zinc-400 border-zinc-750",
          icon: <Info className="w-5 h-5 text-zinc-400" />,
        };
    }
  };

  const activeTipTheme = analysisResult ? getTipStyles(analysisResult.tipType) : getTipStyles("default");

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-8 md:py-12">
      {/* Dynamic Header */}
      <div className="flex flex-col items-center justify-center text-center mb-10 md:mb-12">
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2.5 px-4.5 py-1.5 rounded-full bg-zinc-900/60 border border-zinc-800 text-zinc-400 text-[10px] uppercase font-semibold tracking-widest mb-4"
        >
          <Camera className="w-3.5 h-3.5 text-[#D4AF37] animate-pulse" />
          Intellectual Optics Diagnostic Suite
        </motion.div>
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-[#D4AF37] font-serif leading-none">
          Focus <span className="italic font-light text-zinc-100">Clear</span>
        </h1>
        <p className="text-zinc-400 mt-3 max-w-xl text-sm md:text-md uppercase tracking-widest text-[9px] md:text-[10px]">
          Advanced Phase-Contrast AI Image Restoration
        </p>
      </div>

      <AnimatePresence mode="wait">
        {!originalSrc ? (
          /* DRAG & DROP SELECTION PORT */
          <motion.div
            key="selector"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.4 }}
            className="w-full"
          >
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={triggerFileSelect}
              className={`w-full py-20 px-6 md:py-28 md:px-12 border-2 border-dashed rounded-3xl cursor-pointer transition-all duration-300 flex flex-col items-center justify-center text-center bg-[#0A0A0A] ${
                isDraggingOver
                  ? "border-[#D4AF37] bg-[#D4AF37]/5 shadow-[0_0_20px_rgba(212,175,55,0.1)] scale-[0.99]"
                  : "border-zinc-800 hover:border-zinc-700 hover:bg-[#121212] shadow-sm"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              
              <div className="w-16 h-16 rounded-2xl bg-zinc-900 text-[#D4AF37] flex items-center justify-center mb-6 border border-zinc-800 shadow-sm">
                <Upload className="w-7 h-7" />
              </div>
              
              <h3 className="text-2xl font-semibold text-zinc-100 font-serif tracking-tight">
                Drag &amp; drop candidate photograph
              </h3>
              <p className="text-zinc-500 text-sm mt-3 max-w-md font-sans">
                Or <span className="text-[#D4AF37] font-semibold underline decoration-1 underline-offset-4">browse system files</span>. Supports high-resolution raw portraits, landscapes, or close-ups.
              </p>

              <div className="flex flex-wrap gap-4 items-center justify-center mt-9 text-[10px] text-zinc-600 font-mono tracking-widest">
                <span className="px-3 py-1 rounded bg-zinc-900 border border-zinc-800">RAW CLARITY UNTOUCHED</span>
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-800"></span>
                <span className="px-3 py-1 rounded bg-zinc-900 border border-zinc-800">UP TO 50MB</span>
              </div>
            </div>
            
            {errorMsg && (
              <div className="mt-4 p-4.5 rounded-2xl bg-red-950/20 border border-red-900/50 text-red-300 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                <div className="text-sm font-sans">
                  <span className="font-semibold text-red-400">Restoration Error:</span> {errorMsg}
                </div>
              </div>
            )}
          </motion.div>
        ) : (
          /* WORKSPACE INTERFACES */
          <motion.div
            key="workspace"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-10"
          >
            {/* LEFT COLUMN: PREVIEWS & BEFORE/AFTER */}
            <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-6">
              <div className="flex flex-wrap items-center justify-between gap-4 py-2">
                <div className="flex items-center gap-3">
                  <span className="px-3.5 py-1.5 bg-zinc-950 border border-zinc-800 text-zinc-300 rounded-lg text-[10px] font-bold font-mono tracking-widest uppercase">
                    {fileName.length > 25 ? `${fileName.slice(0, 22)}...` : fileName}
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono tracking-widest uppercase">
                    ({fileSize})
                  </span>
                </div>
              </div>

              {/* Main Preview Screen */}
              <div className="relative w-full aspect-video md:aspect-[4/3] bg-zinc-950 rounded-3xl overflow-hidden shadow-2xl border border-zinc-850">
                <AnimatePresence>
                  {isAnalyzing && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-[#0A0A0A]/95 z-20 flex flex-col items-center justify-center p-6 text-center backdrop-blur-md"
                    >
                      {/* Laser scanner animation (Gold hue) */}
                      <div className="absolute w-full h-0.5 bg-[#D4AF37]/80 top-0 left-0 shadow-[0_0_15px_#D4AF37] animate-[bounce_3.5s_infinite]" />
                      
                      <div className="relative w-24 h-24 mb-6 flex items-center justify-center">
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                          className="absolute inset-0 rounded-full border-4 border-[#D4AF37]/10 border-t-[#D4AF37]"
                        />
                        <Camera className="w-9 h-9 text-[#D4AF37]" />
                      </div>
                      
                      <h4 className="text-xl font-bold text-zinc-100 font-serif tracking-wide">
                        AI Optics Analysis Active
                      </h4>
                      <p className="text-[#D4AF37] font-mono text-[10px] uppercase font-bold tracking-widest mt-2 h-6 max-w-sm">
                        {analysisProgress}
                      </p>
                      <p className="text-zinc-500 text-xs mt-6 max-w-xs leading-relaxed">
                        Calculating spatial frequency response and blur entropy vectors.
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* VISUALIZATION PORTS */}
                <div 
                  ref={containerRef}
                  className="w-full h-full select-none transition-all duration-300 flex flex-row p-1 gap-1 bg-zinc-900"
                >
                  {originalSrc && (
                    <>
                      {/* 1. ORIGINAL IMAGE FRAME / LEFT SPLIT LAYER */}
                      <div className="w-1/2 h-full relative bg-zinc-950 p-2 border border-zinc-850 flex items-center justify-center overflow-hidden">
                        <img 
                          src={originalSrc}
                          alt="Original"
                          referrerPolicy="no-referrer"
                          className="max-w-full max-h-full object-contain pointer-events-none"
                        />

                        <div className="absolute bottom-4 left-4 bg-black/70 backdrop-blur-md text-zinc-300 border border-white/10 text-[9px] tracking-widest uppercase px-3 py-1.5 font-mono">
                          Original Blurry
                        </div>
                      </div>

                      {/* 2. ENHANCED CANVAS FRAME / RIGHT SPLIT LAYER */}
                      <div className="w-1/2 h-full relative bg-zinc-950 p-2 border border-zinc-850 flex items-center justify-center overflow-hidden">
                        <canvas 
                          ref={targetCanvasRef}
                          className="max-w-full max-h-full object-contain pointer-events-none"
                        />

                        <div className="absolute bottom-4 right-4 bg-black/70 backdrop-blur-md text-[#D4AF37] border border-[#D4AF37]/30 text-[9px] tracking-widest uppercase px-3 py-1.5 font-mono">
                          AI Sharpened
                        </div>
                      </div>
                    </>
                  )}
                </div>
                </div>

              {/* Utility Clear / Reset Control Strip */}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleClear}
                  className="px-5 py-2.5 border border-zinc-800 hover:border-zinc-750 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 transition-colors rounded-xl text-[9px] font-bold font-mono uppercase tracking-widest"
                >
                  Upload Different Photo
                </button>
                
                {analysisResult && (
                  <button
                    type="button"
                    onClick={restoreAIRecommendations}
                    className="flex items-center gap-1.5 text-[9px] text-[#D4AF37] hover:text-[#f8ebd4] transition-colors font-bold font-mono uppercase tracking-widest"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Reset to AI Optimized Settings
                  </button>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN: AI ANALYSIS & ADJUSTMENTS COLUMN */}
            <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-6">
              
              {/* AI Diagnostics Card */}
              <div className="rounded-3xl border border-zinc-850 bg-[#0A0A0A] p-6 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-base font-semibold text-[#D4AF37] font-serif flex items-center gap-2 tracking-wide">
                    <Gauge className="w-4 h-4 text-[#D4AF37] animate-pulse" />
                    Optics Report
                  </h2>
                  <span className="text-[9px] px-2.5 py-0.5 rounded-md bg-[#D4AF37]/10 border border-[#D4AF37]/35 text-[#D4AF37] font-bold font-mono uppercase tracking-wider">
                    Gemini Intelligence
                  </span>
                </div>

                {isAnalyzing ? (
                  <div className="py-6 flex flex-col items-center justify-center text-center">
                    <p className="text-xs text-zinc-500 font-mono italic animate-pulse">Running diagnostics...</p>
                  </div>
                ) : analysisResult ? (
                  <div className="flex flex-col gap-4">
                    {/* Status Alert */}
                    <div className={`p-4 rounded-xl flex items-start gap-3 border ${
                      analysisResult.isBlurry 
                        ? "bg-amber-950/20 border-amber-900/50 text-amber-200" 
                        : "bg-emerald-950/20 border-emerald-900/50 text-emerald-200"
                    }`}>
                      {analysisResult.isBlurry ? (
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div className="font-bold text-xs uppercase tracking-wider">
                          {analysisResult.isBlurry ? "Blur Artifacts Detected!" : "Sharp Focus Verified!"}
                        </div>
                        <div className="text-[11px] mt-1 leading-relaxed opacity-85">
                          {analysisResult.isBlurry 
                            ? `Focus drift of ${analysisResult.blurScore}% calculated. Restorative algorithms initialized.`
                            : `Outstanding edge response verified (Blur Score: ${analysisResult.blurScore}%).`
                          }
                        </div>
                      </div>
                    </div>

                    {/* Radial/Bar Blur Score representation */}
                    <div>
                      <div className="flex justify-between items-center text-[10px] text-zinc-500 font-mono mb-1.5 label select-none tracking-widest uppercase">
                        <span>BLUR INDEX / FREQUENCY ATTENUATION</span>
                        <span className={`font-bold ${analysisResult.isBlurry ? "text-[#D4AF37]" : "text-emerald-400"}`}>
                          {analysisResult.blurScore}%
                        </span>
                      </div>
                      <div className="w-full h-2 bg-zinc-900 rounded-full overflow-hidden border border-zinc-800">
                        <div 
                          className={`h-full rounded-full transition-all duration-1000 ${
                            analysisResult.isBlurry ? "bg-[#D4AF37]" : "bg-emerald-500"
                          }`}
                          style={{ width: `${analysisResult.blurScore}%` }}
                        />
                      </div>
                    </div>

                    {/* Paragraph description */}
                    <div className="text-xs text-zinc-305 leading-relaxed border-t border-zinc-850 pt-4 font-normal">
                      <span className="font-bold text-[#D4AF37] uppercase block tracking-widest text-[9px] mb-1.5">Focus Analysis Audit:</span>
                      <p className="font-sans text-zinc-300 leading-relaxed">{analysisResult.analysis}</p>
                    </div>
                  </div>
                ) : (
                  <div className="py-8 flex flex-col items-center justify-center text-center">
                    <ImageIcon className="w-7 h-7 text-zinc-700 mb-3" />
                    <p className="text-xs text-zinc-500">
                      Upload a photo to analyze spatial sharpness parameters.
                    </p>
                  </div>
                )}
              </div>

              {/* Blur Source Breakdown Section */}
              {analysisResult && (
                <div className="rounded-3xl border border-zinc-850 bg-[#0A0A0A] p-6 shadow-xl">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-semibold text-[#D4AF37] font-serif flex items-center gap-2 tracking-wide">
                      <AlertTriangle className="w-4 h-4 text-[#D4AF37]" />
                      Blur Source Breakdown
                    </h2>
                    <span className="text-[9px] px-2.5 py-0.5 rounded bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[#D4AF37] font-bold font-mono tracking-wider">
                      DIAGNOSTIC
                    </span>
                  </div>

                  <p className="text-[11px] text-zinc-400 leading-relaxed mb-4">
                    The spatial analysis engine calculated the following optical degradation factors contributing to clarity loss:
                  </p>

                  {(() => {
                    const breakdown = {
                      motionBlur: analysisResult.blurBreakdown?.motionBlur ?? (analysisResult.tipType === "stabilization" ? 60 : 15),
                      defocus: analysisResult.blurBreakdown?.defocus ?? (analysisResult.tipType === "focus" || analysisResult.tipType === "depth" ? 65 : 20),
                      lensSmudge: analysisResult.blurBreakdown?.lensSmudge ?? (analysisResult.tipType === "cleanliness" ? 55 : 10),
                      noiseGrain: analysisResult.blurBreakdown?.noiseGrain ?? (analysisResult.tipType === "lighting" ? 45 : 15),
                    };

                    // Protect/Normalize in case they don't fully add to 100% or are zero
                    const sum = breakdown.motionBlur + breakdown.defocus + breakdown.lensSmudge + breakdown.noiseGrain;
                    const normalized = sum > 0 ? {
                      motionBlur: Math.round((breakdown.motionBlur / sum) * 100),
                      defocus: Math.round((breakdown.defocus / sum) * 100),
                      lensSmudge: Math.round((breakdown.lensSmudge / sum) * 100),
                      noiseGrain: Math.round((breakdown.noiseGrain / sum) * 100),
                    } : { motionBlur: 25, defocus: 25, lensSmudge: 25, noiseGrain: 25 };

                    return (
                      <div className="flex flex-col gap-4">
                        {/* Motion Blur */}
                        <div>
                          <div className="flex justify-between items-center text-[10px] text-zinc-400 font-mono mb-1 select-none">
                            <span>CAMERA SHAKE / MOTION VECTOR</span>
                            <span className="font-bold text-zinc-200">{normalized.motionBlur}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-zinc-950 rounded-full overflow-hidden border border-zinc-900">
                            <div 
                              className="h-full rounded-full bg-amber-500 transition-all duration-1000"
                              style={{ width: `${normalized.motionBlur}%` }}
                            />
                          </div>
                        </div>

                        {/* Defocus */}
                        <div>
                          <div className="flex justify-between items-center text-[10px] text-zinc-400 font-mono mb-1 select-none">
                            <span>AUTOFOCUS MISSED / DEPTH-OF-FIELD</span>
                            <span className="font-bold text-zinc-200">{normalized.defocus}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-zinc-950 rounded-full overflow-hidden border border-zinc-900">
                            <div 
                              className="h-full rounded-full bg-[#D4AF37] transition-all duration-1000"
                              style={{ width: `${normalized.defocus}%` }}
                            />
                          </div>
                        </div>

                        {/* Lens Smudge */}
                        <div>
                          <div className="flex justify-between items-center text-[10px] text-zinc-400 font-mono mb-1 select-none">
                            <span>LENS HALO / RESIDUE SURFACE</span>
                            <span className="font-bold text-zinc-200">{normalized.lensSmudge}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-zinc-950 rounded-full overflow-hidden border border-zinc-900">
                            <div 
                              className="h-full rounded-full bg-cyan-500 transition-all duration-1000"
                              style={{ width: `${normalized.lensSmudge}%` }}
                            />
                          </div>
                        </div>

                        {/* Noise & Sensor Grain */}
                        <div>
                          <div className="flex justify-between items-center text-[10px] text-zinc-400 font-mono mb-1 select-none">
                            <span>ISO HEAT SENSOR NOISE / GRAIN</span>
                            <span className="font-bold text-zinc-200">{normalized.noiseGrain}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-zinc-950 rounded-full overflow-hidden border border-zinc-900">
                            <div 
                              className="h-full rounded-full bg-violet-500 transition-all duration-1000"
                              style={{ width: `${normalized.noiseGrain}%` }}
                            />
                          </div>
                        </div>

                        {/* Interpretation summary box */}
                        <div className="mt-2 pt-3.5 border-t border-zinc-850 text-[11px] text-zinc-400 leading-relaxed font-sans">
                          <span className="font-bold font-mono text-[#D4AF37] text-[9px] uppercase tracking-wider block mb-1">Optics Diagnostics Interpretation:</span>
                          {normalized.motionBlur >= 40 && (
                            <p>Critical directional motion vectors detected. The unblur engine prioritizes anisotropic deconvolution filters to cancel camera tremor.</p>
                          )}
                          {normalized.defocus >= 40 && (
                            <p>Heavy defocus degradation. Perceptual depth optimization boosts midtone boundary contrast to reconstruct a clean focal planes.</p>
                          )}
                          {normalized.lensSmudge >= 40 && (
                            <p>Significant halo bloom and contrast loss found (lens fingerprint or smudge residue). High-pass filter thresholds elevated to rebuild sharp boundary details.</p>
                          )}
                          {normalized.noiseGrain >= 40 && (
                            <p>High sensor thermal noise in dark coordinates. Adaptive unblur gating dampens sharpening in flat gradient regions to protect shadows from extra noise gain.</p>
                          )}
                          {normalized.motionBlur < 40 && normalized.defocus < 40 && normalized.lensSmudge < 40 && normalized.noiseGrain < 40 && (
                            <p>Uniform frequency scatter registered. General restoration profiles are active, focusing fine unsharp masks onto main subject outline boundaries.</p>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* AI Scene Adaptive Controller Panel */}
              {analysisResult && (
                <div className="rounded-3xl border border-zinc-850 bg-[#0A0A0A] p-6 shadow-xl">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-base font-semibold text-[#D4AF37] font-serif flex items-center gap-2 tracking-wide">
                      <Sparkles className="w-4 h-4 text-[#D4AF37]" />
                      AI Scene-Aware Engine
                    </h2>
                    
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {activeSceneOverride ? "MANUAL OVERRIDE" : `DETECTION CONFIDENCE: ${analysisResult.sceneConfidence || 95}%`}
                    </span>
                  </div>

                  <p className="text-[11px] text-zinc-400 leading-relaxed mb-4">
                    {activeSceneOverride 
                      ? "You've manually forced this processing profile. The unblur filter is fully customized for this subject."
                      : (analysisResult.sceneDescription || `The AI identified a ${analysisResult.sceneType || "photo"} and is applying optimized frequency response parameters.`)
                    }
                  </p>

                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {[
                      { id: "portrait", label: "Portrait", icon: <User className="w-3.5 h-3.5" />, desc: "Preserves skin, sharpens eyes." },
                      { id: "landscape", label: "Landscape", icon: <Mountain className="w-3.5 h-3.5" />, desc: "Boosts skyline blues & foliage." },
                      { id: "document", label: "Document", icon: <FileText className="w-3.5 h-3.5" />, desc: "Inks text, whitens page." },
                      { id: "food", label: "Food", icon: <Utensils className="w-3.5 h-3.5" />, desc: "Vibrant warmth & organic tones." },
                      { id: "night", label: "Night Scene", icon: <Moon className="w-3.5 h-3.5" />, desc: "Noise gating in dark shadows." },
                      { id: "macro", label: "Macro Closeup", icon: <Sparkle className="w-3.5 h-3.5" />, desc: "Micro-contrast on focus points." }
                    ].map((item) => {
                      const isSelected = activeSceneOverride 
                        ? activeSceneOverride === item.id 
                        : (!activeSceneOverride && (analysisResult.sceneType === item.id || (item.id === "landscape" && analysisResult.sceneType === "landscape") || (item.id === "portrait" && analysisResult.sceneType === "portrait")));
                      
                      const isAIDetected = analysisResult.sceneType === item.id;

                      return (
                        <button
                          key={item.id}
                          onClick={() => setActiveSceneOverride(item.id as any)}
                          className={`p-3 rounded-xl border text-left transition-all relative flex flex-col justify-between h-20 ${
                            isSelected 
                              ? "bg-[#D4AF37]/10 border-[#D4AF37] shadow-[0_0_12px_rgba(212,175,55,0.15)] text-white" 
                              : "bg-[#070707] border-zinc-900 text-zinc-400 hover:border-zinc-800 hover:bg-[#0E0E0E]"
                          }`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className={`p-1 rounded-md ${isSelected ? "text-[#D4AF37]" : "text-zinc-500"}`}>
                              {item.icon}
                            </span>
                            
                            {isAIDetected && (
                              <span className="text-[7px] font-mono tracking-widest text-[#D4AF37] border border-[#D4AF37]/30 bg-[#D4AF37]/10 px-1 py-0.5 rounded uppercase">
                                AI Detected
                              </span>
                            )}
                          </div>
                          
                          <div>
                            <span className="text-[10px] font-mono font-bold tracking-wider uppercase block mt-1.5 font-sans">
                              {item.label}
                            </span>
                            <span className="text-[8px] text-zinc-500 line-clamp-1 mt-0.5 block">
                              {item.desc}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {activeSceneOverride && (
                    <button
                      onClick={() => setActiveSceneOverride(null)}
                      className="w-full mt-3 py-1.5 px-3 bg-zinc-900 hover:bg-zinc-850 hover:text-white border border-zinc-800 text-zinc-500 rounded-lg text-[9px] font-bold font-mono tracking-widest uppercase transition-colors"
                    >
                      Reset to AI Auto-Detection Profile
                    </button>
                  )}
                </div>
              )}

              {/* Adjustments & Sliders Panel */}
              <div className="rounded-3xl border border-zinc-850 bg-[#0A0A0A] p-6 shadow-xl">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-base font-semibold text-[#D4AF37] font-serif flex items-center gap-2 tracking-wide">
                    <Sliders className="w-4 h-4 text-[#D4AF37]" />
                    Restoration Deck
                  </h2>
                  
                  {analysisResult && (
                    <span className="inline-flex items-center gap-1.5 text-[10px] text-[#D4AF37] bg-[#D4AF37]/10 px-2 py-0.5 rounded-lg border border-[#D4AF37]/30 font-semibold font-mono">
                      <Sparkles className="w-3 h-3 text-[#D4AF37] animate-spin" />
                      AUTO-TUNING ACTIVE
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-5">
                  {/* SLIDER A: SHARPNESS */}
                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1.5">
                      <span className="text-zinc-300 flex items-center gap-1">Focus Correction</span>
                      <span className="text-zinc-500 font-mono">{adjustments.sharpenAmount}%</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <input 
                        type="range"
                        min="0"
                        max="100"
                        value={adjustments.sharpenAmount}
                        onChange={(e) => setAdjustments({ ...adjustments, sharpenAmount: parseInt(e.target.value) })}
                        className="w-full accent-[#D4AF37] h-1 bg-zinc-900 rounded-lg appearance-none cursor-pointer border border-zinc-850"
                      />
                    </div>
                    <span className="text-[10px] text-zinc-500 mt-1 block">
                      Deconvolution kernel strength to extract edge details
                    </span>
                  </div>

                  {/* SLIDER B: CONTRAST */}
                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1.5">
                      <span className="text-zinc-300">Contrast Boost</span>
                      <span className="text-zinc-500 font-mono">+{adjustments.contrastBoost}%</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <input 
                        type="range"
                        min="0"
                        max="100"
                        value={adjustments.contrastBoost}
                        onChange={(e) => setAdjustments({ ...adjustments, contrastBoost: parseInt(e.target.value) })}
                        className="w-full accent-[#D4AF37] h-1 bg-zinc-900 rounded-lg appearance-none cursor-pointer border border-zinc-850"
                      />
                    </div>
                    <span className="text-[10px] text-zinc-500 mt-1 block">
                      Enhance midtone depth to reinforce visual definition
                    </span>
                  </div>

                  {/* SLIDER C: BRIGHTNESS */}
                  <div>
                    <div className="flex justify-between text-xs font-semibold mb-1.5">
                      <span className="text-zinc-300">Exposure Tuning</span>
                      <span className="text-zinc-500 font-mono">
                        {adjustments.brightnessBoost > 0 ? `+${adjustments.brightnessBoost}` : adjustments.brightnessBoost}%
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <input 
                        type="range"
                        min="-50"
                        max="50"
                        value={adjustments.brightnessBoost}
                        onChange={(e) => setAdjustments({ ...adjustments, brightnessBoost: parseInt(e.target.value) })}
                        className="w-full accent-[#D4AF37] h-1 bg-zinc-900 rounded-lg appearance-none cursor-pointer border border-zinc-850"
                      />
                    </div>
                    <span className="text-[10px] text-zinc-500 mt-1 block">
                      Correct shadows/exposure to improve focus readability
                    </span>
                  </div>
                </div>

                {/* Main Download Button */}
                <button
                  type="button"
                  disabled={isExporting}
                  onClick={handleHighResDownload}
                  className="w-full mt-6 py-4 px-8 bg-[#D4AF37] hover:bg-[#c2982c] text-black font-semibold text-sm uppercase tracking-widest disabled:opacity-50 transition-all flex items-center justify-center gap-2 select-none"
                >
                  {isExporting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Computing Native Resolvers...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Export Ultra-HD
                    </>
                  )}
                </button>
                <div className="text-center mt-2.5">
                  <span className="text-[10px] text-zinc-500 font-mono block tracking-widest">
                    NATIVE HIGH-RES OUTPUT PRESERVED
                  </span>
                </div>
              </div>

              {/* Dynamic Clinic Tip Box */}
              {analysisResult && (
                <div className={`rounded-3xl border p-6 shadow-xl ${activeTipTheme.bg} border-zinc-850`}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`p-1.5 rounded-xl border ${activeTipTheme.badge}`}>
                      {activeTipTheme.icon}
                    </div>
                    <h3 className="text-sm font-semibold font-serif tracking-wide text-zinc-200">
                      Photography Guideline
                    </h3>
                  </div>

                  <h5 className="text-[10px] uppercase tracking-wider font-bold font-mono text-[#D4AF37] block mt-4 mb-2">
                    Avoid: {analysisResult.tipTitle}
                  </h5>
                  
                  <p className="serif italic text-base leading-snug text-zinc-300">
                    "{analysisResult.tipDescription}"
                  </p>
                </div>
              )}

            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
