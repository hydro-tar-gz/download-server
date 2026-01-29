import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { readdir, stat } from "fs/promises";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT ? Number(process.env.PORT) : 3000;

const downloadDir = process.env.DOWNLOAD_DIR
  ? path.resolve(process.env.DOWNLOAD_DIR)
  : path.resolve(process.cwd(), "downloads");

const publicDir = path.resolve(process.cwd(), "public");

const toPosixPath = (value: string) => value.split(path.sep).join("/");

const encodePath = (value: string) =>
  toPosixPath(value)
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");

const resolveRequestedPath = (relPath: string | undefined) => {
  if (!relPath) {
    return { absolute: downloadDir, relative: "" };
  }

  const normalized = relPath.replace(/\\/g, "/").replace(/^\/+/, "");
  const absolute = path.resolve(downloadDir, normalized);
  const downloadRoot = path.resolve(downloadDir);

  if (
    absolute !== downloadRoot &&
    !absolute.startsWith(downloadRoot + path.sep)
  ) {
    throw new Error("Invalid path");
  }

  return { absolute, relative: normalized };
};

app.get("/api/files", async (req, res) => {
  try {
    const { absolute, relative } = resolveRequestedPath(
      typeof req.query.path === "string" ? req.query.path : undefined
    );
    const entries = await readdir(absolute, { withFileTypes: true });
    const files = await Promise.all(
      entries
        .filter((entry) => entry.isFile() || entry.isDirectory())
        .map(async (entry) => {
          const fullPath = path.join(absolute, entry.name);
          const info = await stat(fullPath);
          const nextRelative = relative
            ? path.posix.join(relative, entry.name)
            : entry.name;
          const type = entry.isDirectory() ? "dir" : "file";
          return {
            name: entry.name,
            type,
            size: entry.isDirectory() ? null : info.size,
            modifiedAt: info.mtime.toISOString(),
            path: nextRelative,
            href: entry.isDirectory()
              ? `/?path=${encodeURIComponent(nextRelative)}`
              : `/downloads/${encodePath(nextRelative)}`
          };
        })
    );

    files.sort((a, b) => {
      if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    res.json({
      directory: downloadDir,
      path: relative,
      count: files.length,
      files
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to read download directory",
      details: error instanceof Error ? error.message : "Unknown error"
    });
  }
});

app.use("/downloads", express.static(downloadDir));
app.use(express.static(publicDir));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.listen(port, () => {
  console.log(`download-server running on http://localhost:${port}`);
  console.log(`serving downloads from ${downloadDir}`);
});
