import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  FileAudio, 
  Mic, 
  ChevronRight, 
  Settings, 
  AlertCircle, 
  Sparkles, 
  FileText, 
  ArrowRight,
  Info,
  History,
  Trash2
} from "lucide-react";
import AudioUploader from "./components/AudioUploader";
import AudioRecorder from "./components/AudioRecorder";
import LoadingBanner from "./components/LoadingBanner";
import TranscriptionDisplay from "./components/TranscriptionDisplay";
import { TranscriptStyle, AudioMetadata } from "./types";

export default function App() {
  // Global States
  const [inputMode, setInputMode] = useState<"upload" | "record">("upload");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [mimeType, setMimeType] = useState<string | null>(null);
  const [style, setStyle] = useState<TranscriptStyle>("dialogue");
  const [audioMetadata, setAudioMetadata] = useState<AudioMetadata | null>(null);

  // Processing States
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  // Result States
  const [transcript, setTranscript] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  // History state saved in LocalStorage for persistence!
  const [historyList, setHistoryList] = useState<{
    id: string;
    timestamp: string;
    name: string;
    style: TranscriptStyle;
    transcript: string;
    summary: string | null;
  }[]>([]);

  // Load history on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("transcriber_history");
      if (stored) {
        setHistoryList(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load local history", e);
    }
  }, []);

  const saveToHistory = (newTranscript: string, finalSummary: string | null) => {
    try {
      const newItem = {
        id: Date.now().toString(),
        timestamp: new Date().toLocaleString(),
        name: audioMetadata?.name || (inputMode === "record" ? `Voice Record ${new Date().toLocaleTimeString()}` : "Uploaded Audio"),
        style: style,
        transcript: newTranscript,
        summary: finalSummary
      };
      const updated = [newItem, ...historyList].slice(0, 5); // Keep last 5 entries
      setHistoryList(updated);
      localStorage.setItem("transcriber_history", JSON.stringify(updated));
    } catch (e) {
      console.error("Failed to save to local history", e);
    }
  };

  const loadHistoryItem = (item: any) => {
    setTranscript(item.transcript);
    setSummary(item.summary);
    setStyle(item.style);
    setError(null);
    setSummaryError(null);
  };

  const clearHistory = () => {
    setHistoryList([]);
    localStorage.removeItem("transcriber_history");
  };

  const handleFileSelected = (file: File, metadata: AudioMetadata) => {
    setAudioBlob(file);
    setMimeType(metadata.type);
    setAudioMetadata(metadata);
    setError(null);
  };

  const handleRecordComplete = (blob: Blob, recordedMimeType: string) => {
    setAudioBlob(blob);
    setMimeType(recordedMimeType);
    setAudioMetadata({
      name: `Voice Record ${new Date().toLocaleTimeString()}`,
      size: blob.size,
      type: recordedMimeType,
    });
    setError(null);
  };

  const handleClearAudio = () => {
    setAudioBlob(null);
    setMimeType(null);
    setAudioMetadata(null);
    setError(null);
  };

  // Helper to convert audio blob to base64 encoding
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = (reader.result as string).split(",")[1];
        resolve(base64String);
      };
      reader.onerror = () => reject(new Error("Failed to parse audio stream."));
      reader.readAsDataURL(blob);
    });
  };

  const handleTranscribe = async () => {
    if (!audioBlob || !mimeType) {
      setError("Please upload a file or record audio first.");
      return;
    }

    setIsTranscribing(true);
    setTranscript(null);
    setSummary(null);
    setError(null);

    try {
      const base64Audio = await blobToBase64(audioBlob);
      const response = await fetch("/api/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audioData: base64Audio,
          mimeType: mimeType,
          style: style,
        }),
      });

      const contentType = response.headers.get("content-type") || "";
      if (!response.ok) {
        if (contentType.includes("application/json")) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Server returned error status ${response.status}`);
        } else {
          const textError = await response.text();
          const preview = textError.slice(0, 150) + (textError.length > 150 ? "..." : "");
          throw new Error(`Server returned error status ${response.status}: ${preview || response.statusText}`);
        }
      }

      if (!contentType.includes("application/json")) {
        throw new Error("Invalid server response format. Expected JSON.");
      }

      const data = await response.json();
      setTranscript(data.transcript);
      saveToHistory(data.transcript, null);
    } catch (err: any) {
      console.error("Transcribe process failed:", err);
      setError(err.message || "Failed to process audio transcription. Please ensure the backend is connected and try again.");
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleGenerateSummary = async () => {
    if (!transcript) return;

    setIsSummarizing(true);
    setSummaryError(null);

    try {
      const response = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });

      const contentType = response.headers.get("content-type") || "";
      if (!response.ok) {
        if (contentType.includes("application/json")) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Server returned error status ${response.status}`);
        } else {
          const textError = await response.text();
          const preview = textError.slice(0, 150) + (textError.length > 150 ? "..." : "");
          throw new Error(`Server returned error status ${response.status}: ${preview || response.statusText}`);
        }
      }

      if (!contentType.includes("application/json")) {
        throw new Error("Invalid server response format. Expected JSON.");
      }

      const data = await response.json();
      setSummary(data.summary);
      
      // Update the item in history with its summary
      if (historyList.length > 0) {
        const updated = [...historyList];
        updated[0].summary = data.summary;
        setHistoryList(updated);
        localStorage.setItem("transcriber_history", JSON.stringify(updated));
      }
    } catch (err: any) {
      console.error("Summarization process failed:", err);
      setSummaryError(err.message || "Failed to generate AI summary.");
    } finally {
      setIsSummarizing(false);
    }
  };

  return (
    <div id="app-root-container" className="min-h-screen bg-[#0f172a] text-slate-100 font-sans antialiased pb-12 relative overflow-hidden">
      {/* Animated Mesh Background */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-600/30 blur-[120px] animate-pulse" style={{ animationDuration: "12s" }}></div>
        <div className="absolute bottom-[-5%] right-[-5%] w-[40%] h-[40%] rounded-full bg-emerald-500/20 blur-[100px] animate-pulse" style={{ animationDuration: "16s" }}></div>
        <div className="absolute top-[30%] right-[10%] w-[30%] h-[30%] rounded-full bg-purple-600/20 blur-[120px] animate-pulse" style={{ animationDuration: "14s" }}></div>
      </div>

      {/* Header Bar */}
      <header id="app-header-bar" className="bg-white/5 backdrop-blur-xl border-b border-white/10 sticky top-0 z-20 relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
              <FileText className="w-5.5 h-5.5" />
            </div>
            <div>
              <h1 id="app-logo-text" className="font-display font-bold text-white tracking-tight text-base sm:text-lg">
                EchoScribe<span className="text-indigo-400">AI</span>
              </h1>
              <p className="text-[10px] sm:text-xs text-slate-400 font-medium tracking-wide">
                POWERED BY GEMINI 3.5 FLASH
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold font-mono bg-black/40 border border-white/5 rounded-lg px-2.5 py-1">
            <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
            SECURE ENGINE
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main id="app-main-content" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT PANEL: Inputs & Configurations (lg:col-span-5) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Input Selection Card */}
            <section id="input-selector-section" className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl shadow-xl p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h3 className="font-display font-semibold text-slate-100 text-sm flex items-center gap-2">
                  <FileAudio className="w-4.5 h-4.5 text-indigo-400" />
                  1. Choose Audio Input
                </h3>
                
                {/* Input Toggle */}
                <div id="mode-toggle-pill" className="flex bg-black/40 p-1 rounded-xl text-xs border border-white/5">
                  <button
                    id="mode-upload-btn"
                    onClick={() => { setInputMode("upload"); handleClearAudio(); }}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                      inputMode === "upload" 
                        ? "bg-indigo-500/30 text-indigo-200 border border-indigo-500/30" 
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Upload File
                  </button>
                  <button
                    id="mode-record-btn"
                    onClick={() => { setInputMode("record"); handleClearAudio(); }}
                    className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                      inputMode === "record" 
                        ? "bg-indigo-500/30 text-indigo-200 border border-indigo-500/30" 
                        : "text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    Record Mic
                  </button>
                </div>
              </div>

              {/* Upload Module vs Record Module */}
              <div id="active-input-module">
                {inputMode === "upload" ? (
                  <AudioUploader
                    onFileSelected={handleFileSelected}
                    onClear={handleClearAudio}
                    disabled={isTranscribing}
                  />
                ) : (
                  <AudioRecorder
                    onRecordComplete={handleRecordComplete}
                    onClear={handleClearAudio}
                    disabled={isTranscribing}
                  />
                )}
              </div>
            </section>

            {/* Styling Config Card */}
            <section id="formatting-config-section" className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl shadow-xl p-6 space-y-4">
              <h3 className="font-display font-semibold text-slate-100 text-sm flex items-center gap-2">
                <Settings className="w-4.5 h-4.5 text-indigo-400" />
                2. Transcription Formatting Style
              </h3>

              <div id="formatting-options-grid" className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Dialogue Format */}
                <button
                  id="style-dialogue-btn"
                  onClick={() => setStyle("dialogue")}
                  disabled={isTranscribing}
                  className={`flex flex-col text-left p-4 rounded-2xl border transition-all cursor-pointer ${
                    style === "dialogue"
                      ? "border-indigo-500 bg-indigo-500/10 ring-1 ring-indigo-500/30"
                      : "border-white/10 hover:border-indigo-500/30 bg-white/5"
                  }`}
                >
                  <span className="text-xs font-bold text-slate-100 font-sans">Dialogue Script</span>
                  <span className="text-[11px] text-slate-400 font-medium font-sans mt-2.5 leading-relaxed">
                    Precise conversation with labeled speaker tags. Ideal for interviews, discussions, and podcasts.
                  </span>
                </button>

                {/* MOM Format */}
                <button
                  id="style-mom-btn"
                  onClick={() => setStyle("mom")}
                  disabled={isTranscribing}
                  className={`flex flex-col text-left p-4 rounded-2xl border transition-all cursor-pointer ${
                    style === "mom"
                      ? "border-indigo-500 bg-indigo-500/10 ring-1 ring-indigo-500/30"
                      : "border-white/10 hover:border-indigo-500/30 bg-white/5"
                  }`}
                >
                  <span className="text-xs font-bold text-slate-100 font-sans">Minutes of Meeting (MOM)</span>
                  <span className="text-[11px] text-slate-400 font-medium font-sans mt-2.5 leading-relaxed">
                    Formal breakdown of Objectives, Topics, Decisions, and Action items. Ideal for workshops and meetings.
                  </span>
                </button>
              </div>
            </section>

            {/* Transcription Trigger Button */}
            <button
              id="transcribe-submit-btn"
              onClick={handleTranscribe}
              disabled={isTranscribing || !audioBlob}
              className="w-full py-4 bg-indigo-500 hover:bg-indigo-400 text-white rounded-2xl font-bold font-sans text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-500/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Get Transcript
              <ChevronRight className="w-4 h-4" />
            </button>

            {/* Error Display */}
            {error && (
              <div id="general-error-banner" className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-200 text-xs font-semibold">
                <AlertCircle className="w-4.5 h-4.5 text-red-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-sans leading-relaxed">{error}</p>
                  <p className="font-sans text-[11px] font-medium text-amber-400/95">
                    Pro-tip: If you see API key errors, please configure your key inside the **Settings &gt; Secrets** panel in AI Studio.
                  </p>
                </div>
              </div>
            )}

            {/* History logs sidebar list */}
            {historyList.length > 0 && (
              <section id="history-logs-section" className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl shadow-xl p-6 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-display font-semibold text-slate-300 text-xs flex items-center gap-1.5 uppercase tracking-wider">
                    <History className="w-4 h-4 text-indigo-400" />
                    Recent Transcripts
                  </h3>
                  <button 
                    id="clear-history-btn"
                    onClick={clearHistory}
                    className="text-[10px] text-slate-400 hover:text-red-400 font-bold font-sans flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    Clear History
                  </button>
                </div>
                <div className="space-y-2">
                  {historyList.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => loadHistoryItem(item)}
                      className="w-full text-left p-3 bg-white/5 hover:bg-white/10 border border-white/5 rounded-2xl transition-all flex items-center justify-between group cursor-pointer"
                    >
                      <div className="truncate pr-2">
                        <p className="text-xs font-semibold text-slate-200 truncate group-hover:text-white font-sans">
                          {item.name}
                        </p>
                        <p className="text-[10px] text-slate-400 font-sans mt-0.5 font-medium">
                          {item.timestamp} &bull; {item.style === "mom" ? "MOM Style" : "Dialogue"}
                        </p>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-200 transition-all shrink-0" />
                    </button>
                  ))}
                </div>
              </section>
            )}

          </div>

          {/* RIGHT PANEL: Outputs & Visualizations (lg:col-span-7) */}
          <div className="lg:col-span-7">
            <AnimatePresence mode="wait">
              
              {/* State 1: Is Transcribing (Loading) */}
              {isTranscribing && (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.3 }}
                >
                  <LoadingBanner task="transcribing" />
                </motion.div>
              )}

              {/* State 2: Has Transcript (Display output) */}
              {!isTranscribing && transcript && (
                <motion.div
                  key="results"
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -15 }}
                  transition={{ duration: 0.4 }}
                >
                  <TranscriptionDisplay
                    transcript={transcript}
                    style={style}
                    summary={summary}
                    isSummarizing={isSummarizing}
                    onGenerateSummary={handleGenerateSummary}
                    summaryError={summaryError}
                  />
                </motion.div>
              )}

              {/* State 3: Empty State / Pre-transcription */}
              {!isTranscribing && !transcript && (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  id="empty-output-card"
                  className="bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl shadow-xl p-12 text-center flex flex-col items-center justify-center space-y-5"
                >
                  <div className="w-16 h-16 bg-indigo-500/10 border border-indigo-500/20 rounded-full flex items-center justify-center text-indigo-400 ring-8 ring-indigo-500/5">
                    <FileText className="w-7 h-7" />
                  </div>
                  
                  <div className="max-w-md">
                    <h3 className="font-display font-semibold text-slate-100 text-base">
                      No Transcript Generated Yet
                    </h3>
                    <p className="text-sm text-slate-400 font-medium font-sans mt-2 leading-relaxed">
                      Please upload an audio file or record some audio on the left column, choose your desired format style, and click **Get Transcript** to start.
                    </p>
                  </div>

                  <div className="space-y-3 max-w-sm">
                    <div className="p-4 bg-indigo-500/5 border border-indigo-500/10 rounded-2xl text-left flex gap-3 text-xs text-slate-400 leading-relaxed font-sans">
                      <Info className="w-4.5 h-4.5 text-indigo-400 shrink-0 mt-0.5" />
                      <p className="font-medium">
                        Gemini 3.5 Flash will automatically transcribe, clean up audio noise, recognize speech structures, and format dialogues or full meeting minutes.
                      </p>
                    </div>
                    <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl text-left flex gap-3 text-xs text-slate-400 leading-relaxed font-sans">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0 mt-1" />
                      <p className="font-medium">
                        <strong className="text-emerald-400">Pro-Tip for Live Meetings:</strong> Use the <strong className="text-slate-200">System / Meeting</strong> option in the Recorder to capture audio in the background while you focus on your meeting.
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

            </AnimatePresence>
          </div>

        </div>
      </main>
    </div>
  );
}
