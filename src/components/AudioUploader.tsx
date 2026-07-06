import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { Upload, FileAudio, X, Play, Music, Volume2 } from "lucide-react";
import { AudioMetadata } from "../types";

interface AudioUploaderProps {
  onFileSelected: (file: File, metadata: AudioMetadata) => void;
  onClear: () => void;
  disabled?: boolean;
}

export default function AudioUploader({ onFileSelected, onClear, disabled }: AudioUploaderProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileMetadata, setFileMetadata] = useState<AudioMetadata | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const supportedFormats = [
    ".mp3",
    ".wav",
    ".m4a",
    ".webm",
    ".ogg",
    ".aac",
    ".flac",
    "audio/mpeg",
    "audio/wav",
    "audio/x-wav",
    "audio/mp4",
    "audio/x-m4a",
    "audio/webm",
    "audio/ogg",
    "audio/aac",
    "audio/flac",
  ];

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const validateAndProcessFile = (file: File) => {
    setError(null);

    // Validate MIME type or file extension
    const fileExtension = "." + file.name.split(".").pop()?.toLowerCase();
    const isSupported =
      supportedFormats.includes(file.type.toLowerCase()) ||
      supportedFormats.includes(fileExtension);

    if (!isSupported && file.type !== "") {
      setError(
        `Unsupported format (${fileExtension || "Unknown"}). Please upload a standard audio file (MP3, WAV, M4A, WebM, OGG, AAC, or FLAC).`
      );
      return;
    }

    // Limit size to ~35MB to fit in body limits (Vite server limit)
    const maxSizeBytes = 35 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      setError("File is too large (maximum size is 35 MB). Please compress or trim your audio.");
      return;
    }

    setSelectedFile(file);
    
    const metadata: AudioMetadata = {
      name: file.name,
      size: file.size,
      type: file.type || `audio/${file.name.split(".").pop() || "unknown"}`,
    };
    
    setFileMetadata(metadata);

    const url = URL.createObjectURL(file);
    setAudioPreviewUrl(url);

    onFileSelected(file, metadata);
  };

  const handleDrag = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndProcessFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      validateAndProcessFile(e.target.files[0]);
    }
  };

  const triggerFileInput = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const removeFile = () => {
    setSelectedFile(null);
    setFileMetadata(null);
    if (audioPreviewUrl) {
      URL.revokeObjectURL(audioPreviewUrl);
      setAudioPreviewUrl(null);
    }
    setError(null);
    onClear();
  };

  return (
    <div id="audio-uploader-module" className="w-full flex flex-col space-y-4">
      {error && (
        <div id="upload-error-box" className="p-4 bg-red-500/10 border border-red-500/20 text-red-200 rounded-xl text-sm font-medium font-sans flex items-start gap-3">
          <X className="w-5 h-5 text-red-400 shrink-0 mt-0.5 cursor-pointer" onClick={() => setError(null)} />
          <p className="leading-relaxed">{error}</p>
        </div>
      )}

      {!selectedFile ? (
        <div
          id="dropzone-area"
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={triggerFileInput}
          className={`flex flex-col items-center justify-center border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer transition-all ${
            isDragActive
              ? "border-indigo-500 bg-indigo-500/10 scale-[0.99]"
              : "border-white/10 hover:border-indigo-500/40 bg-white/5"
          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            onChange={handleFileChange}
            disabled={disabled}
            className="hidden"
          />

          <div className="w-14 h-14 bg-indigo-500/10 border border-indigo-500/20 rounded-full flex items-center justify-center text-indigo-400 mb-4 ring-8 ring-indigo-500/5">
            <Upload className="w-6 h-6 animate-pulse" />
          </div>

          <p id="drag-prompt-text" className="text-sm font-medium text-slate-200 font-sans">
            Drag & drop your audio file here, or{" "}
            <span className="text-indigo-400 underline font-semibold decoration-indigo-400 hover:decoration-indigo-300">
              browse files
            </span>
          </p>
          <p id="format-supports-text" className="text-xs text-slate-400 mt-2 font-medium font-sans">
            Supports MP3, WAV, M4A, WebM, OGG, AAC, and FLAC (Up to 35MB)
          </p>
        </div>
      ) : (
        <div id="upload-preview-container" className="p-5 bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center justify-center text-indigo-400">
                <FileAudio className="w-5 h-5" />
              </div>
              <div className="max-w-[200px] sm:max-w-xs md:max-w-md">
                <h4 id="file-name-heading" className="text-sm font-semibold text-slate-100 font-sans truncate" title={fileMetadata?.name}>
                  {fileMetadata?.name}
                </h4>
                <p id="file-size-text" className="text-xs text-slate-400 font-mono font-medium">
                  {fileMetadata ? formatSize(fileMetadata.size) : ""} &bull; {fileMetadata?.type.split("/")[1]?.toUpperCase() || "AUDIO"}
                </p>
              </div>
            </div>

            <button
              id="remove-file-btn"
              onClick={removeFile}
              disabled={disabled}
              className="p-1.5 bg-white/5 border border-white/10 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 rounded-xl transition-all text-slate-400"
              title="Remove File"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {audioPreviewUrl && (
            <div id="file-preview-player" className="p-3.5 bg-black/20 border border-white/5 rounded-2xl space-y-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-400 font-semibold font-sans">
                <Volume2 className="w-4 h-4 text-indigo-400" />
                Listen to Uploaded File
              </div>
              <audio id="uploader-audio-element" src={audioPreviewUrl} controls className="w-full h-9 brightness-90 invert grayscale" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
