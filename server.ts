import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import multer from "multer";
import Database from "better-sqlite3";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;
const UPLOADS_DIR = path.resolve("uploads");

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR);
}

// Database setup
const db = new Database("scrapbook.db");
db.exec(`
  CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    type TEXT, -- 'note', 'link', 'sticker', 'pdf'
    content TEXT, -- markdown content or URL
    title TEXT,
    rating INTEGER,
    tags TEXT, -- JSON array
    x REAL,
    y REAL,
    rotation REAL,
    scale REAL,
    file_path TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

app.use(express.json({ limit: '50mb' }));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage });

// API Routes
app.get("/api/items", (req, res) => {
  const items = db.prepare("SELECT * FROM items ORDER BY created_at DESC").all();
  res.json(items.map(item => ({
    ...item,
    tags: JSON.parse(item.tags || "[]")
  })));
});

app.post("/api/items", (req, res) => {
  const { id, type, content, title, rating, tags, x, y, rotation, scale, file_path } = req.body;
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO items (id, type, content, title, rating, tags, x, y, rotation, scale, file_path)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(id, type, content, title, rating, JSON.stringify(tags || []), x, y, rotation, scale, file_path);
  res.json({ success: true });
});

app.delete("/api/items/:id", (req, res) => {
  db.prepare("DELETE FROM items WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

app.post("/api/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).send("No file uploaded.");
  res.json({ file_path: `/uploads/${req.file.filename}` });
});

app.use("/uploads", express.static(UPLOADS_DIR));

// Vite middleware
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve("dist/index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
