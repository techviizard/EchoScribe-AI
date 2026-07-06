import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Increase request payload size limit for base64 audio handling
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Lazy initializer for GoogleGenAI
let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is required. Please add your key in the Secrets panel.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// Robust retry wrapper with exponential backoff for transient API errors (e.g., 503, 429)
async function retryWithBackoff<T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const errorStr = JSON.stringify(error) || "";
    const errorMessage = error?.message || "";
    const status = error?.status || error?.code || 0;
    
    // Identify common transient API conditions
    const isTransient = 
      status === 503 || 
      status === 429 ||
      errorMessage.includes("503") || 
      errorMessage.includes("UNAVAILABLE") || 
      errorMessage.includes("high demand") || 
      errorMessage.includes("temporary") ||
      errorMessage.includes("ResourceExhausted") ||
      errorStr.includes("503") ||
      errorStr.includes("UNAVAILABLE") ||
      errorStr.includes("ResourceExhausted");

    if (retries > 0 && isTransient) {
      console.warn(`[GEMINI RETRY] Transient error encountered (Status: ${status}). Message: "${errorMessage}". Retrying in ${delay}ms... (${retries} attempts left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryWithBackoff(fn, retries - 1, delay * 1.5);
    }
    throw error;
  }
}

// Multi-tier fallback content generator to handle localized high demand on specific model types
async function generateWithFallback(ai: any, contents: any[]): Promise<any> {
  const tryModel = async (modelName: string): Promise<any> => {
    return await retryWithBackoff(() => {
      return ai.models.generateContent({
        model: modelName,
        contents: contents
      });
    }, 2, 2000); // 2 retries per model, starting with 2 seconds delay
  };

  try {
    console.log("[GEMINI ENGINE] Attempting transcription/summarization with primary model: gemini-3.5-flash...");
    return await tryModel("gemini-3.5-flash");
  } catch (error: any) {
    console.warn(`[GEMINI FALLBACK] Primary model gemini-3.5-flash failed or experienced high demand. Trying fallback gemini-3.1-flash-lite. Error: ${error.message || error}`);
    try {
      return await tryModel("gemini-3.1-flash-lite");
    } catch (fallbackError: any) {
      console.warn(`[GEMINI FALLBACK 2] gemini-3.1-flash-lite fallback failed too. Trying high-capacity gemini-3.1-pro-preview... Error: ${fallbackError.message || fallbackError}`);
      try {
        return await tryModel("gemini-3.1-pro-preview");
      } catch (proError: any) {
        console.error(`[GEMINI CRITICAL] All model tiers failed.`);
        throw proError;
      }
    }
  }
}

// API Health Check
app.get("/api/health", (req, res) => {
  res.json({ status: "healthy", keyConfigured: !!process.env.GEMINI_API_KEY });
});

// API endpoint to transcribe audio
app.post("/api/transcribe", async (req: express.Request, res: express.Response) => {
  try {
    const { audioData, mimeType, style } = req.body;
    if (!audioData) {
      return res.status(400).json({ error: "No audio data provided." });
    }
    if (!mimeType) {
      return res.status(400).json({ error: "Missing audio mimeType." });
    }

    const ai = getAiClient();

    let stylePrompt = "";
    if (style === "mom") {
      stylePrompt = `
You are an expert meeting recorder and Minutes of Meeting (MOM) compiler.
Listen to the audio carefully and transform it into a formal, structured Minutes of Meeting document.
Include the following sections:
1. **Meeting Title & Subject** (deduced from the conversation, otherwise provide a suitable title)
2. **Key Attendees & Speakers** (if identifiable, otherwise list roles/voices)
3. **Executive Summary** (a brief, 2-3 sentence overview of the meeting)
4. **Detailed Discussion Highlights** (structured bullet points of the topics discussed)
5. **Decisions Made** (clear, numbered list of decisions agreed upon)
6. **Action Items & Next Steps** (with assigned owners and tasks if mentioned, otherwise general next steps)

Structure the output with professional Markdown, using lists, tables where relevant, bold keywords, and clean visual dividers.
`;
    } else {
      stylePrompt = `
You are an expert conversational audio transcriber.
Listen to the audio carefully and provide a precise, word-for-word dialogue script of the conversation.
Follow these guidelines:
1. **Speaker Identification**: Clearly label each speaker (e.g., "Speaker 1:", "Speaker 2:" or use actual names if they are spoken or introduced).
2. **Conversational Flow**: Transcribe the words accurately while maintaining a readable, natural conversational flow. Keep emotional cues (e.g., [laughs], [sighs], [cross-talk]) only if highly relevant to context.
3. **Formatting**: Use clean paragraphs for each speaker turn. Leave a blank line between different speakers.
4. **Structure**: Add a short introductory note summarizing who is speaking and what the conversation is about, then write the dialogue script.

Structure the script in modern Markdown.
`;
    }

    const response = await generateWithFallback(ai, [
      {
        inlineData: {
          data: audioData,
          mimeType: mimeType
        }
      },
      {
        text: `Please transcribe the attached audio recording following these guidelines:\n${stylePrompt}\n\nEnsure that the output is highly readable, beautifully structured in Markdown, and contains only the final transcript/MOM itself (do not include introductory meta-chatter like 'Sure, here is the transcript...').`
      }
    ]);

    const transcript = response.text || "No transcript could be generated.";
    res.json({ transcript });
  } catch (error: any) {
    console.error("Transcription endpoint error:", error);
    res.status(500).json({ error: error.message || "An error occurred during audio transcription." });
  }
});

// API endpoint to summarize transcript
app.post("/api/summarize", async (req: express.Request, res: express.Response) => {
  try {
    const { transcript } = req.body;
    if (!transcript) {
      return res.status(400).json({ error: "Missing transcript text to summarize." });
    }

    const ai = getAiClient();

    const response = await generateWithFallback(ai, [
      {
        text: `You are an expert executive summarization assistant.
Please read the transcript provided below and compile a polished, executive-level summary.
Your summary should include:
1. **Executive Overview**: A 2-3 sentence high-level summary of the entire session.
2. **Core Themes & Topics**: Key themes discussed, with bullet points detailing each.
3. **Decisions & Commitments**: Specific agreements or conclusions reached.
4. **Action Items**: Concrete deliverables, owners, and immediate next steps.

Transcript/MOM to summarize:
---
${transcript}
---

Format the output beautifully in clean, professional Markdown.`
      }
    ]);

    const summary = response.text || "No summary could be generated.";
    res.json({ summary });
  } catch (error: any) {
    console.error("Summarization endpoint error:", error);
    res.status(500).json({ error: error.message || "An error occurred during summarization." });
  }
});

// Setup Vite middleware in Development Mode, otherwise serve static production files
async function setupVite() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

setupVite().catch((err) => {
  console.error("Error starting Vite server:", err);
});
