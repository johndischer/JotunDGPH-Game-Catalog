import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = new URL("../", import.meta.url).pathname;
const port = Number(process.env.PORT || 4173);
const types = { ".html":"text/html", ".js":"text/javascript", ".css":"text/css", ".svg":"image/svg+xml", ".webp":"image/webp", ".jpg":"image/jpeg", ".png":"image/png", ".json":"application/json" };

createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
    let relative = pathname === "/" ? "index.html" : pathname.replace(/^\//, "");
    if (relative.startsWith("covers/") || relative === "logo.svg" || relative === "favicon.svg") relative = `public/${relative}`;
    const file = normalize(join(root, relative));
    if (!file.startsWith(normalize(root))) throw new Error("Invalid path");
    const info = await stat(file);
    if (!info.isFile()) throw new Error("Not a file");
    const body = await readFile(file);
    res.writeHead(200, { "Content-Type": types[extname(file)] || "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("Not found");
  }
}).listen(port, () => console.log(`Rental Page running at http://localhost:${port}`));
