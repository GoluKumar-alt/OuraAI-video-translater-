import React, { useState, useRef, useEffect } from "react";
import { 
  Upload, 
  Languages, 
  Video, 
  Play, 
  Pause, 
  RotateCcw, 
  Volume2, 
  Download,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Globe,
  Mic
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const LANGUAGES = [
  { code: 'hi', name: 'Hindi' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'it', name: 'Italian' },
  { code: 'ru', name: 'Russian' },
  { code: 'zh', name: 'Chinese' }
];

export default function App() {
  const [file, setFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [ytUrl, setYtUrl] = useState<string>("");
  const [isFetchingYt, setIsFetchingYt] = useState(false);
  const [audioBase64, setAudioBase64] = useState<string>("");
  const [targetLang, setTargetLang] = useState(LANGUAGES[0]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("");
  const [result, setResult] = useState<{
    videoUrl: string;
    transcript: string;
    translation: string;
    audioUrl: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setVideoUrl(URL.createObjectURL(selectedFile));
      setYtUrl("");
      setAudioBase64("");
      setResult(null);
      setError(null);
    }
  };

  const handleYoutubeFetch = async () => {
    if (!ytUrl) return;
    
    setIsFetchingYt(true);
    setError(null);
    setStatus("Fetching YouTube video...");
    
    try {
      const res = await fetch("/api/youtube", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: ytUrl }),
      });
      
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || "Failed to fetch YouTube video");
      
      setVideoUrl(data.videoUrl);
      setAudioBase64(data.audioBase64);
      setFile(null);
      setResult(null);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to fetch YouTube video");
    } finally {
      setIsFetchingYt(false);
    }
  };

  const processVideo = async () => {
    if (!file && !videoUrl) return;
    
    setIsProcessing(true);
    setProgress(10);
    setError(null);

    try {
      let currentAudioBase64 = audioBase64;

      if (!currentAudioBase64) {
        setStatus("Extracting audio from video...");
        const formData = new FormData();
        if (file) {
          formData.append("video", file);
        } else {
          throw new Error("No video source found");
        }

        // 1. Extract Audio
        const extractRes = await fetch("/api/extract-audio", {
          method: "POST",
          body: formData,
        });
        
        if (!extractRes.ok) throw new Error("Failed to extract audio");
        const data = await extractRes.json();
        currentAudioBase64 = data.audioBase64;
      }
      
      setProgress(40);
      setStatus("Translating and Dubbing...");

      // 2. AI Process (Translate)
      const processRes = await fetch("/api/ai-process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          audioBase64: currentAudioBase64, 
          targetLangName: targetLang.name 
        }),
      });

      if (!processRes.ok) throw new Error("AI Translation failed");
      const { transcript, translation } = await processRes.json();

      setProgress(70);
      setStatus("Generating AI Voice...");

      // 3. AI TTS
      const ttsRes = await fetch("/api/ai-tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          text: translation, 
          targetLangName: targetLang.name 
        }),
      });

      if (!ttsRes.ok) throw new Error("Voice generation failed");
      const { ttsBase64 } = await ttsRes.json();

      setProgress(100);
      setStatus("Complete!");

      setResult({
        videoUrl: videoUrl,
        transcript,
        translation,
        audioUrl: `data:audio/mp3;base64,${ttsBase64}`
      });
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected error occurred");
    } finally {
      setIsProcessing(false);
    }
  };

  const togglePlay = () => {
    if (videoRef.current && audioRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        audioRef.current.pause();
      } else {
        videoRef.current.play();
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const syncMedia = () => {
    if (videoRef.current && audioRef.current) {
      audioRef.current.currentTime = videoRef.current.currentTime;
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-orange-500/30">
      {/* Header */}
      <header className="border-b border-white/5 bg-black/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-rose-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20">
              <Globe className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
              OuraAI <span className="text-orange-500">Translator</span>
            </span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-white/60">
            <a href="#" className="hover:text-white transition-colors">How it works</a>
            <a href="#" className="hover:text-white transition-colors">Pricing</a>
            <a href="#" className="hover:text-white transition-colors">API</a>
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          
          {/* Left Column: Controls */}
          <div className="lg:col-span-5 space-y-8">
            <section className="space-y-6">
              <div className="space-y-2">
                <h2 className="text-3xl font-bold tracking-tight">Translate your content</h2>
                <p className="text-white/40">Upload a video and let AI handle the translation and dubbing.</p>
              </div>

              {/* Upload Area */}
              <div className="space-y-4">
                <div 
                  className={`relative group border-2 border-dashed rounded-3xl p-8 transition-all duration-300 ${
                    file ? 'border-orange-500/50 bg-orange-500/5' : 'border-white/10 hover:border-white/20 bg-white/5'
                  }`}
                >
                  <input 
                    type="file" 
                    accept="video/*" 
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="flex flex-col items-center text-center gap-4">
                    <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110 ${
                      file ? 'bg-orange-500 text-white' : 'bg-white/5 text-white/40'
                    }`}>
                      {file ? <CheckCircle2 className="w-8 h-8" /> : <Upload className="w-8 h-8" />}
                    </div>
                    <div>
                      <p className="font-semibold">{file ? file.name : "Choose a video file"}</p>
                      <p className="text-sm text-white/40 mt-1">MP4, MOV or WebM (Max 50MB)</p>
                    </div>
                  </div>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-white/5"></span>
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-[#0a0a0a] px-2 text-white/20 font-bold tracking-widest">OR</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                    <input 
                      type="text"
                      placeholder="Paste YouTube URL..."
                      value={ytUrl}
                      onChange={(e) => setYtUrl(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-3 pl-11 pr-4 text-sm focus:outline-none focus:border-orange-500/50 transition-colors"
                    />
                  </div>
                  <button
                    onClick={handleYoutubeFetch}
                    disabled={!ytUrl || isFetchingYt}
                    className="px-6 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isFetchingYt ? <Loader2 className="w-4 h-4 animate-spin" /> : "Fetch"}
                  </button>
                </div>
              </div>

              {/* Language Selection */}
              <div className="space-y-4">
                <label className="text-sm font-medium text-white/60 flex items-center gap-2">
                  <Languages className="w-4 h-4" /> Target Language
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => setTargetLang(lang)}
                      className={`px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                        targetLang.code === lang.code 
                          ? 'bg-white text-black shadow-lg' 
                          : 'bg-white/5 text-white/60 hover:bg-white/10'
                      }`}
                    >
                      {lang.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Button */}
              <button
                disabled={!file || isProcessing}
                onClick={processVideo}
                className={`w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all ${
                  !file || isProcessing
                    ? 'bg-white/5 text-white/20 cursor-not-allowed'
                    : 'bg-gradient-to-r from-orange-500 to-rose-600 text-white shadow-xl shadow-orange-500/20 hover:scale-[1.02] active:scale-[0.98]'
                }`}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Mic className="w-5 h-5" />
                    Start Translation
                  </>
                )}
              </button>

              {/* Error Display */}
              <AnimatePresence>
                {error && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-start gap-3 text-rose-400 text-sm"
                  >
                    <AlertCircle className="w-5 h-5 shrink-0" />
                    <p>{error}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>
          </div>

          {/* Right Column: Preview */}
          <div className="lg:col-span-7">
            <div className="sticky top-32">
              <div className="relative aspect-video bg-black rounded-[2rem] overflow-hidden border border-white/10 shadow-2xl group">
                {videoUrl ? (
                  <>
                    <video 
                      ref={videoRef}
                      src={videoUrl} 
                      className="w-full h-full object-contain"
                      onTimeUpdate={syncMedia}
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                      muted={!!result}
                    />
                    {result && (
                      <audio ref={audioRef} src={result.audioUrl} className="hidden" />
                    )}
                    
                    {/* Video Controls Overlay */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-6">
                      <button 
                        onClick={togglePlay}
                        className="w-16 h-16 bg-white text-black rounded-full flex items-center justify-center hover:scale-110 transition-transform"
                      >
                        {isPlaying ? <Pause className="w-8 h-8" /> : <Play className="w-8 h-8 ml-1" />}
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-white/20 gap-4">
                    <Video className="w-16 h-16" />
                    <p className="font-medium">Video Preview</p>
                  </div>
                )}

                {/* Progress Overlay */}
                <AnimatePresence>
                  {isProcessing && (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-12 text-center"
                    >
                      <div className="w-full max-w-xs space-y-6">
                        <div className="relative w-24 h-24 mx-auto">
                          <div className="absolute inset-0 border-4 border-white/10 rounded-full"></div>
                          <svg className="w-24 h-24 -rotate-90">
                            <circle
                              cx="48"
                              cy="48"
                              r="44"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="8"
                              strokeDasharray={276}
                              strokeDashoffset={276 - (276 * progress) / 100}
                              className="text-orange-500 transition-all duration-500"
                            />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center font-bold text-xl">
                            {progress}%
                          </div>
                        </div>
                        <div className="space-y-2">
                          <p className="font-bold text-xl">{status}</p>
                          <p className="text-white/40 text-sm">This may take a minute depending on video length</p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Results Display */}
              <AnimatePresence>
                {result && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4"
                  >
                    <div className="p-6 bg-white/5 rounded-3xl border border-white/10 space-y-3">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-white/40">Original Transcript</h3>
                      <p className="text-sm leading-relaxed text-white/80 line-clamp-4">{result.transcript}</p>
                    </div>
                    <div className="p-6 bg-orange-500/10 rounded-3xl border border-orange-500/20 space-y-3">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-orange-500/60">AI Translation ({targetLang.name})</h3>
                      <p className="text-sm leading-relaxed text-white line-clamp-4">{result.translation}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 py-12 mt-12">
        <div className="max-w-7xl mx-auto px-6 text-center text-white/20 text-sm">
          <p>© 2024 OuraAI. Powered by Gemini 1.5 Flash.</p>
        </div>
      </footer>
    </div>
  );
}
