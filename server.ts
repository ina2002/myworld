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
const dbPath = path.resolve("scrapbook.db");
console.log("Using database at:", dbPath);
try {
  fs.accessSync(path.dirname(dbPath), fs.constants.W_OK);
  console.log("Database directory is writable");
} catch (e) {
  console.error("Database directory is NOT writable:", e);
}
const db = new Database(dbPath);
db.exec(`
  CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    type TEXT,
    content TEXT,
    title TEXT,
    rating INTEGER,
    tags TEXT,
    x REAL,
    y REAL,
    rotation REAL,
    scale REAL,
    width REAL,
    variant TEXT,
    file_path TEXT,
    clip_path TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Migration for existing databases
const migrate = (column: string, type: string) => {
  try {
    db.prepare(`ALTER TABLE items ADD COLUMN ${column} ${type}`).run();
    console.log(`Migration: Added column ${column}`);
  } catch (e: any) {
    if (e.message.includes("duplicate column name")) {
      // Column already exists, ignore
    } else {
      console.error(`Migration error for ${column}:`, e);
    }
  }
};

migrate("width", "REAL");
migrate("variant", "TEXT");
migrate("clip_path", "TEXT");

// Debug: Log columns
const columns = db.prepare("PRAGMA table_info(items)").all();
console.log("Current table columns:", columns.map((c: any) => c.name).join(", "));

const count = db.prepare("SELECT COUNT(*) as count FROM items").get() as { count: number };
console.log("Total items in database:", count.count);

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
  try {
    console.log("Saving item:", req.body.id, req.body.type);
    const { id, type, content, title, rating, tags, x, y, rotation, scale, width, variant, file_path, clip_path } = req.body;
    const stmt = db.prepare(`
      INSERT OR REPLACE INTO items (id, type, content, title, rating, tags, x, y, rotation, scale, width, variant, file_path, clip_path)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      id, 
      type || null, 
      content || null, 
      title || null, 
      rating || null, 
      JSON.stringify(tags || []), 
      x ?? 0, 
      y ?? 0, 
      rotation ?? 0, 
      scale ?? 1, 
      width ?? null, 
      variant || null, 
      file_path || null, 
      clip_path || null
    );
    res.json({ success: true });
  } catch (error) {
    console.error("Error saving item:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Internal Server Error" });
  }
});

app.delete("/api/items/:id", (req, res) => {
  try {
    db.prepare("DELETE FROM items WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting item:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.post("/api/upload", upload.single("file"), (req, res) => {
  try {
    if (!req.file) return res.status(400).send("No file uploaded.");
    res.json({ file_path: `/uploads/${req.file.filename}` });
  } catch (error) {
    console.error("Error uploading file:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
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
