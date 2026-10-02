import express from "express";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { extractDrugsWithGemini } from "./server/geminiExtraction.ts";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Extraction endpoint
app.post("/api/gemini/extract", async (req, res) => {
  try {
    const { images, pdf, pastedText } = req.body;
    const items = await extractDrugsWithGemini({ images, pdf, pastedText });
    res.json({ success: true, items });
  } catch (error: any) {
    console.error("Gemini Extraction Error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "حدث خطأ أثناء معالجة الملف عبر الذكاء الاصطناعي"
    });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// Production static assets
const distPath = path.resolve(__dirname, "dist");
app.use(express.static(distPath));

app.get("*", (req, res) => {
  res.sendFile(path.resolve(distPath, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
