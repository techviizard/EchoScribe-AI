import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Loader2 } from "lucide-react";

interface LoadingBannerProps {
  task: "transcribing" | "summarizing";
}

const transcribingMessages = [
  "Initializing Gemini AI Model...",
  "Uploading and processing audio stream...",
  "Analyzing voices and speaker frequencies...",
  "Transcribing spoken audio verbatim...",
  "Differentiating between speakers...",
  "Applying punctuation and context mapping...",
  "Formatting structure (Dialogue/MOM layout)...",
  "Reviewing final text for absolute clarity...",
];

const summarizingMessages = [
  "Reading through the transcript...",
  "Identifying key meeting themes...",
  "Extracting critical decisions and next steps...",
  "Compiling executive summaries...",
  "Formatting summary with clean Markdown structure...",
  "Finalizing executive-level brief...",
];

export default function LoadingBanner({ task }: LoadingBannerProps) {
  const messages = task === "transcribing" ? transcribingMessages : summarizingMessages;
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setMsgIndex((prev) => (prev + 1) % messages.length);
    }, 4000);
    return () => clearInterval(timer);
  }, [messages.length]);

  return (
    <div id="loading-banner-container" className="flex flex-col items-center justify-center p-8 bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl shadow-xl space-y-4">
      <div className="relative">
        <Loader2 id="loading-spinner-icon" className="w-12 h-12 text-indigo-400 animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-3 h-3 bg-indigo-400 rounded-full animate-ping" />
        </div>
      </div>
      
      <div className="text-center max-w-sm">
        <h3 id="loading-title" className="font-display font-semibold text-slate-100 text-lg">
          {task === "transcribing" ? "Transcribing Audio" : "Generating Summary"}
        </h3>
        
        <div className="h-6 mt-2 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.p
              key={msgIndex}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.4 }}
              id="loading-status-text"
              className="font-sans text-xs text-indigo-300 font-medium"
            >
              {messages[msgIndex]}
            </motion.p>
          </AnimatePresence>
        </div>
      </div>
      
      <div id="progress-bar-track" className="w-48 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <motion.div
          id="progress-bar-fill"
          className="h-full bg-indigo-500 rounded-full"
          initial={{ width: "5%" }}
          animate={{ width: "95%" }}
          transition={{ duration: 30, ease: "linear" }}
        />
      </div>
    </div>
  );
}
