import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Copy, Check, Download, Sparkles, FileText, File, Clipboard, AlignLeft } from "lucide-react";
import { jsPDF } from "jspdf";
import { TranscriptStyle } from "../types";

interface TranscriptionDisplayProps {
  transcript: string;
  style: TranscriptStyle;
  summary: string | null;
  isSummarizing: boolean;
  onGenerateSummary: () => void;
  summaryError: string | null;
}

export default function TranscriptionDisplay({
  transcript,
  style,
  summary,
  isSummarizing,
  onGenerateSummary,
  summaryError,
}: TranscriptionDisplayProps) {
  const [activeTab, setActiveTab] = useState<"transcript" | "summary">("transcript");
  const [copied, setCopied] = useState(false);

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  const handleDownloadTxt = (text: string, title: string) => {
    const element = document.createElement("a");
    const file = new Blob([text], { type: "text/plain;charset=utf-8" });
    element.href = URL.createObjectURL(file);
    element.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "_")}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleDownloadPdf = (content: string, title: string, subtitle: string) => {
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - 2 * margin;

    // Document Title
    doc.setFont("Helvetica", "bold");
    doc.setFontSize(20);
    doc.setTextColor(17, 24, 39); // Slate-900
    doc.text(title, margin, 25);

    // Metadata Subtitle
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(107, 114, 128); // Slate-500
    doc.text(`Generated on: ${new Date().toLocaleString()}`, margin, 32);
    doc.text(`Format Style: ${subtitle}`, margin, 37);

    // Horizontal separator
    doc.setDrawColor(229, 231, 235); // Slate-200
    doc.setLineWidth(0.4);
    doc.line(margin, 42, pageWidth - margin, 42);

    // Setup body fonts
    doc.setFont("Helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(55, 65, 81); // Slate-700

    const cleanContent = content
      .replace(/&nbsp;/g, " ")
      .replace(/\\n/g, "\n");
    
    const lines = doc.splitTextToSize(cleanContent, contentWidth);
    
    let y = 50;
    const lineHeight = 6.5;

    for (let i = 0; i < lines.length; i++) {
      if (y > pageHeight - margin - 15) {
        doc.addPage();
        
        // Running Header on subsequent pages
        doc.setFont("Helvetica", "oblique");
        doc.setFontSize(8);
        doc.setTextColor(156, 163, 175); // Slate-400
        doc.text(title, margin, 15);
        doc.line(margin, 18, pageWidth - margin, 18);
        
        doc.setFont("Helvetica", "normal");
        doc.setFontSize(11);
        doc.setTextColor(55, 65, 81);
        
        y = 25; // Reset position on new page
      }
      
      const line = lines[i];
      const trimmed = line.trim();

      // Check for headings or bold sections
      const isHeading = trimmed.startsWith("#") || (trimmed.startsWith("**") && trimmed.endsWith("**"));
      
      if (isHeading) {
        doc.setFont("Helvetica", "bold");
        const cleanLine = trimmed.replace(/#/g, "").replace(/\*\*/g, "").trim();
        doc.text(cleanLine, margin, y);
        doc.setFont("Helvetica", "normal");
      } else {
        doc.text(line, margin, y);
      }
      
      y += lineHeight;
    }

    // Dynamic Footer on all pages
    const pageCount = doc.internal.pages.length - 1;
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(156, 163, 175);
      doc.text(
        `Page ${i} of ${pageCount}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: "center" }
      );
    }

    const safeTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, "_");
    doc.save(`${safeTitle}.pdf`);
  };

  const styleLabel = style === "mom" ? "Minutes of Meeting Style" : "Dialogue-wise Style";

  return (
    <div id="transcription-display-container" className="w-full bg-white/5 backdrop-blur-md border border-white/10 rounded-3xl flex flex-col overflow-hidden text-slate-200">
      {/* Tabs and download header */}
      <div id="display-header" className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between border-b border-white/10 p-5 gap-3 bg-black/25">
        <div id="tabs-track" className="flex bg-black/35 p-1 rounded-xl w-fit border border-white/5">
          <button
            id="transcript-tab-btn"
            onClick={() => setActiveTab("transcript")}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
              activeTab === "transcript"
                ? "bg-indigo-500/25 text-indigo-200 border border-indigo-500/20 shadow-xs"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Transcript ({style === "mom" ? "MOM" : "Dialogue"})
          </button>
          <button
            id="summary-tab-btn"
            onClick={() => setActiveTab("summary")}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === "summary"
                ? "bg-indigo-500/25 text-indigo-200 border border-indigo-500/20 shadow-xs"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            AI Summary
          </button>
        </div>

        {/* Action triggers */}
        <div className="flex items-center gap-2">
          <button
            id="copy-text-btn"
            onClick={() => handleCopy(activeTab === "transcript" ? transcript : summary || "")}
            disabled={activeTab === "summary" && !summary}
            className="p-2.5 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 rounded-xl transition-all flex items-center justify-center disabled:opacity-40 cursor-pointer"
            title="Copy to Clipboard"
          >
            {copied ? <Check className="w-4.5 h-4.5 text-emerald-400" /> : <Clipboard className="w-4.5 h-4.5" />}
          </button>

          <button
            id="download-text-btn"
            onClick={() =>
              handleDownloadTxt(
                activeTab === "transcript" ? transcript : summary || "",
                activeTab === "transcript" ? "Transcript" : "Summary"
              )
            }
            disabled={activeTab === "summary" && !summary}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 rounded-xl font-medium font-sans text-xs flex items-center gap-1.5 transition-all disabled:opacity-40 cursor-pointer"
          >
            <FileText className="w-4 h-4 text-indigo-400" />
            Text
          </button>

          <button
            id="download-pdf-btn"
            onClick={() =>
              handleDownloadPdf(
                activeTab === "transcript" ? transcript : summary || "",
                activeTab === "transcript" ? "Audio Transcript" : "Executive Summary",
                activeTab === "transcript" ? styleLabel : "Generated via Gemini AI"
              )
            }
            disabled={activeTab === "summary" && !summary}
            className="px-4 py-2 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl font-bold font-sans text-xs flex items-center gap-1.5 transition-all disabled:opacity-40 shadow-lg shadow-indigo-500/20 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            PDF
          </button>
        </div>
      </div>

      {/* Tab Panels */}
      <div id="tab-panel-body" className="p-6 overflow-y-auto max-h-[500px]">
        {activeTab === "transcript" ? (
          <div className="markdown-body font-sans text-sm selection:bg-white/10">
            <ReactMarkdown>{transcript}</ReactMarkdown>
          </div>
        ) : (
          <div className="space-y-6">
            {!summary && !isSummarizing ? (
              <div id="summarize-prompt-card" className="flex flex-col items-center justify-center py-10 text-center space-y-4 max-w-sm mx-auto">
                <div className="w-14 h-14 bg-indigo-500/10 border border-indigo-500/20 rounded-full flex items-center justify-center text-indigo-400 ring-8 ring-indigo-500/5">
                  <Sparkles className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-slate-100 font-display">Generate Executive Briefing</h4>
                  <p className="text-xs text-slate-400 font-medium font-sans mt-2 leading-relaxed">
                    Analyze the transcript with Gemini AI to generate structured takeaways, major themes, action items, and executive highlights.
                  </p>
                </div>
                <button
                  id="trigger-summary-btn"
                  onClick={onGenerateSummary}
                  className="px-5 py-2.5 bg-indigo-500 hover:bg-indigo-400 text-white rounded-xl font-bold font-sans text-xs flex items-center gap-1.5 shadow-lg shadow-indigo-500/20 transition-all cursor-pointer"
                >
                  <Sparkles className="w-4 h-4 text-white fill-current" />
                  Generate AI Summary
                </button>
              </div>
            ) : isSummarizing ? (
              <div id="summarizing-spinner-box" className="flex flex-col items-center justify-center py-12 space-y-3">
                <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin" />
                <p className="text-xs text-slate-400 font-medium font-mono animate-pulse">Gemini summarizing details...</p>
              </div>
            ) : (
              <div className="markdown-body font-sans text-sm selection:bg-white/10">
                <ReactMarkdown>{summary}</ReactMarkdown>
              </div>
            )}

            {summaryError && (
              <div id="summary-error-box" className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-200 text-xs font-semibold flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
                {summaryError}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
