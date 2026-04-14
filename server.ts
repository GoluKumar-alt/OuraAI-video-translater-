import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import ffprobePath from "ffprobe-static";
import fs from "fs";
import cors from "cors";
import ytdl from "@distube/ytdl-core";
import { GoogleGenAI } from "@google/genai";
import rateLimit from "express-rate-limit";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);
if (ffprobePath) ffmpeg.setFfprobePath(ffprobePath);

async function startServer() {
  const app = express();
  const PORT = 3000;

  let ai: GoogleGenAI | null = null;
  const getAI = () => {
    if (!ai) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("GEMINI_API_KEY is missing");
      ai = new GoogleGenAI({ apiKey });
    }
    return ai;
  };

  app.use(rateLimit({ windowMs: 60 * 1000, max: 20 }));
  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  const uploadsDir = path.join(__dirname, "uploads");
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`)
  });
  const upload = multer({ storage });

  app.get("/api/health", (req, res) => res.json({ status: "ok" }));

  app.post("/api/extract-audio", upload.single("video"), (req, res) => {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });
    const audioPath = req.file.path.replace(path.extname(req.file.path), ".mp3");
    ffmpeg(req.file.path)
      .toFormat("mp3")
      .on("end", () => {
        const audioBase64 = fs.readFileSync(audioPath).toString("base64");
        res.json({ audioBase64 });
      })
      .on("error", (err) => res.status(500).json({ error: err.message }))
      .save(audioPath);
  });

  app.post("/api/youtube", async (req, res) => {
    const { url } = req.body;
    if (!url || !ytdl.validateURL(url)) return res.status(400).json({ error: "Invalid URL" });
    try {
      const info = await ytdl.getInfo(url);
      const videoPath = path.join(uploadsDir, `${info.videoDetails.videoId}.mp4`);
      const audioPath = videoPath.replace(".mp4", ".mp3");
      ytdl(url, { quality: "highest" })
        .pipe(fs.createWriteStream(videoPath))
        .on("finish", () => {
          ffmpeg(videoPath)
            .toFormat("mp3")
            .on("end", () => {
              const audioBase64 = fs.readFileSync(audioPath).toString("base64");
              res.json({ audioBase64, videoUrl: `/uploads/${path.basename(videoPath)}` });
            })
            .save(audioPath);
        });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/ai-process", async (req, res) => {
    const { audioBase64, targetLangName } = req.body;
    try {
      const model = getAI().getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent([
        { inlineData: { mimeType: "audio/mp3", data: audioBase64 } },
        { text: `Transcribe and translate to ${targetLangName}. Return JSON: {transcript, translation}` }
      ]);
      const text = result.response.text();
      const jsonMatch = text.match(/\{.*\}/s);
      res.json(JSON.parse(jsonMatch ? jsonMatch[0] : text));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/ai-tts", async (req, res) => {
    const { text, targetLangName } = req.body;
    try {
      const model = getAI().getGenerativeModel({ model: "gemini-1.5-flash" });
      const result = await model.generateContent([
        { text: `Generate a natural speech audio for this text in ${targetLangName}: "${text}". Return only the audio data as base64.` }
      ]);
      res.json({ ttsBase64: result.response.text().trim() });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.use("/uploads", express.static(uploadsDir));

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => console.log(`Server on http://localhost:${PORT}`));
}

startServer();
