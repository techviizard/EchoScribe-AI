import { useState, useRef, useEffect } from "react";
import { Mic, Square, Pause, Play, RotateCcw, AlertCircle, Volume2 } from "lucide-react";

interface AudioRecorderProps {
  onRecordComplete: (blob: Blob, mimeType: string) => void;
  onClear: () => void;
  disabled?: boolean;
}

export default function AudioRecorder({ onRecordComplete, onClear, disabled }: AudioRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [audioSource, setAudioSource] = useState<"mic" | "system">("mic");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopTimer();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const startTimer = () => {
    timerRef.current = setInterval(() => {
      setRecordingTime((prev) => prev + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const startRecording = async () => {
    setError(null);
    setAudioBlob(null);
    setAudioUrl(null);
    audioChunksRef.current = [];

    try {
      let stream: MediaStream;
      
      if (audioSource === "system") {
        if (!navigator.mediaDevices.getDisplayMedia) {
          throw new Error("Your browser does not support capturing system or meeting audio via display sharing. Please use a modern desktop browser (like Chrome, Edge, or Firefox).");
        }
        
        // Capture screen/tab audio
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: { ideal: 16 },
            height: { ideal: 16 },
            frameRate: { ideal: 1 }
          },
          audio: true
        });

        const audioTracks = displayStream.getAudioTracks();
        if (audioTracks.length === 0) {
          // Stop all tracks
          displayStream.getTracks().forEach((track) => track.stop());
          throw new Error("No audio tracks found. When selecting a browser tab or window to share, please check and tick the 'Share audio' checkbox in the browser prompt.");
        }

        stream = displayStream;
      } else {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }

      streamRef.current = stream;

      // Determine best audio mimeType supported by browser
      let mimeType = "audio/webm";
      if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
        mimeType = "audio/webm;codecs=opus";
      } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
        mimeType = "audio/mp4";
      } else if (MediaRecorder.isTypeSupported("audio/ogg")) {
        mimeType = "audio/ogg";
      } else if (MediaRecorder.isTypeSupported("audio/wav")) {
        mimeType = "audio/wav";
      }

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(audioBlob);
        setAudioBlob(audioBlob);
        setAudioUrl(url);
        onRecordComplete(audioBlob, mimeType);
      };

      mediaRecorder.start(200); // chunk size 200ms
      setIsRecording(true);
      setIsPaused(false);
      setRecordingTime(0);
      startTimer();
    } catch (err: any) {
      console.error("Audio recording source setup error:", err);
      const isIframeRestricted = 
        err.name === "SecurityError" || 
        err.message?.includes("display-capture") || 
        err.message?.includes("permissions policy") ||
        err.message?.includes("disallowed by permissions policy");

      if (isIframeRestricted) {
        setError(
          "Browser Security Restriction: Recording system/meeting audio is blocked inside the preview iframe. Please click the 'Open in a new tab' button at the top-right of the preview window to capture live meeting audio."
        );
      } else if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setError(
          audioSource === "system"
            ? "Permission to share screen/tab audio was denied or cancelled."
            : "Microphone access was denied. Please grant permission in your browser settings to record audio."
        );
      } else {
        setError(err.message || "Could not start audio capture. Ensure your devices and browsers support this operation.");
      }
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      if (isPaused) {
        mediaRecorderRef.current.resume();
        startTimer();
        setIsPaused(false);
      } else {
        mediaRecorderRef.current.pause();
        stopTimer();
        setIsPaused(true);
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      stopTimer();
      setIsRecording(false);
      setIsPaused(false);

      // Stop stream tracks
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    }
  };

  const resetRecording = () => {
    stopTimer();
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsRecording(false);
    setIsPaused(false);
    setRecordingTime(0);
    setAudioBlob(null);
    setAudioUrl(null);
    onClear();
  };

  return (
    <div id="audio-recorder-module" className="flex flex-col items-center p-6 bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl w-full">
      <div className="flex flex-col items-center space-y-4 w-full">
        {error && (
          <div id="mic-error-banner" className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-200 text-sm w-full">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <p className="font-sans leading-relaxed font-medium">{error}</p>
          </div>
        )}

        {/* Audio Source Selector */}
        {!isRecording && !audioUrl && (
          <div className="w-full space-y-2">
            <label className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider font-sans block pl-1">
              Select Capture Source
            </label>
            <div className="grid grid-cols-2 gap-2.5 w-full bg-black/35 p-1.5 rounded-2xl border border-white/5">
              <button
                type="button"
                onClick={() => setAudioSource("mic")}
                className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  audioSource === "mic"
                    ? "bg-indigo-500/25 text-indigo-200 border border-indigo-500/25"
                    : "text-slate-400 hover:text-slate-200 border border-transparent"
                }`}
              >
                <Mic className="w-3.5 h-3.5" />
                Microphone
              </button>
              <button
                type="button"
                onClick={() => setAudioSource("system")}
                className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  audioSource === "system"
                    ? "bg-indigo-500/25 text-indigo-200 border border-indigo-500/25"
                    : "text-slate-400 hover:text-slate-200 border border-transparent"
                }`}
              >
                <Volume2 className="w-3.5 h-3.5" />
                System / Meeting
              </button>
            </div>

            {audioSource === "system" && typeof window !== "undefined" && window.self !== window.top && (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-200 text-xs leading-relaxed font-sans mt-2 animate-pulse">
                <p className="font-semibold flex items-center gap-1.5 text-amber-400 mb-0.5">
                  <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                  Iframe Notice (Action Required)
                </p>
                To use the <strong className="text-white">System / Meeting</strong> option, click <strong className="text-white">"Open in a new tab"</strong> at the top right of your screen. Browser security rules block audio capture inside iframe previews.
              </div>
            )}
          </div>
        )}

        {/* Display Visualizer or status */}
        {!audioUrl && (
          <div id="recorder-visualizer-container" className="py-4 flex flex-col items-center justify-center relative w-full">
            {isRecording ? (
              <div className="flex flex-col items-center justify-center space-y-4">
                {/* Wave bar animation simulation */}
                <div className="flex items-end justify-center gap-1.5 h-10">
                  {[...Array(9)].map((_, i) => {
                    const animDelay = `${i * 0.15}s`;
                    const classes = `w-1.5 bg-indigo-400 rounded-full transition-all duration-150 ${
                      isPaused ? "h-2 bg-slate-600" : "animate-bounce"
                    }`;
                    return (
                      <div
                        key={i}
                        className={classes}
                        style={{
                          animationDelay: animDelay,
                          animationDuration: isPaused ? "0s" : "0.9s",
                          height: isPaused ? "8px" : undefined,
                        }}
                      />
                    );
                  })}
                </div>
                <div id="timer-display" className="font-mono text-xl text-slate-100 font-semibold tracking-wider">
                  {formatTime(recordingTime)}
                </div>
                <div id="recording-indicator" className="text-xs text-slate-300 font-medium font-sans flex flex-col items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2.5 h-2.5 rounded-full ${isPaused ? "bg-amber-400" : "bg-emerald-500 animate-pulse"}`} />
                    {isPaused ? "Recording Paused" : "Live Recording Active"}
                  </div>
                  <p className="text-[10px] text-emerald-400 max-w-xs text-center leading-relaxed">
                    {audioSource === "system" 
                      ? "✓ Background Mode Enabled. You can minimize or switch browser tabs; EchoScribeAI will continue capturing meeting audio."
                      : "✓ Recording microphone. You can switch tabs or work in other apps freely on this device."
                    }
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center space-y-3 p-2">
                <div className="w-14 h-14 bg-indigo-500/10 border border-indigo-500/20 rounded-full flex items-center justify-center text-indigo-400 ring-8 ring-indigo-500/5">
                  <Mic className="w-6 h-6 animate-pulse" />
                </div>
                <div className="space-y-1">
                  <p id="mic-ready-text" className="text-sm font-semibold text-slate-200 font-sans">
                    {audioSource === "mic" ? "Ready to record Microphone" : "Ready to capture Meeting / System Audio"}
                  </p>
                  <p className="text-[11px] text-slate-400 font-sans max-w-sm leading-relaxed">
                    {audioSource === "mic" 
                      ? "Capture voice, physical conversations, or device speaker sounds."
                      : "Captures Google Meet, Zoom, MS Teams, or web audio directly from a selected browser tab or screen. Make sure to tick 'Share audio' in the prompt!"
                    }
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Action Controls */}
        <div className="flex items-center justify-center gap-4 w-full">
          {!isRecording && !audioUrl ? (
            <button
              id="start-record-btn"
              onClick={startRecording}
              disabled={disabled}
              className="px-6 py-3 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl font-semibold font-sans flex items-center gap-2 shadow-lg shadow-indigo-500/25 transition-all disabled:opacity-50 cursor-pointer"
            >
              <Mic className="w-5 h-5" />
              {audioSource === "mic" ? "Start Recording" : "Capture System Audio"}
            </button>
          ) : isRecording ? (
            <div className="flex items-center gap-3">
              <button
                id="pause-record-btn"
                onClick={pauseRecording}
                className="w-12 h-12 bg-white/10 hover:bg-white/20 text-slate-300 border border-white/10 rounded-xl flex items-center justify-center transition-all cursor-pointer"
                title={isPaused ? "Resume Recording" : "Pause Recording"}
              >
                {isPaused ? <Play className="w-5 h-5 fill-current" /> : <Pause className="w-5 h-5 fill-current" />}
              </button>
              <button
                id="stop-record-btn"
                onClick={stopRecording}
                className="px-5 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium font-sans flex items-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                <Square className="w-5 h-5 fill-current" />
                Stop and Save
              </button>
            </div>
          ) : null}
        </div>

        {/* Audio Playback Preview & Reset */}
        {audioUrl && (
          <div id="playback-preview-box" className="p-4 bg-black/20 border border-white/5 rounded-2xl w-full flex flex-col space-y-3">
            <div className="flex items-center justify-between">
              <span id="preview-label" className="text-xs font-semibold text-slate-300 font-sans flex items-center gap-1.5">
                <Volume2 className="w-4 h-4 text-indigo-400" />
                Recorded Preview
              </span>
              <button
                id="reset-record-btn"
                onClick={resetRecording}
                disabled={disabled}
                className="text-xs text-slate-400 hover:text-red-400 font-medium font-sans flex items-center gap-1 transition-all cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Record Again
              </button>
            </div>
            <audio id="recording-audio-element" src={audioUrl} controls className="w-full h-9 brightness-90 invert grayscale" />
          </div>
        )}
      </div>
    </div>
  );
}
