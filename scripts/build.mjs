import { cp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(resolve(root, "index.html"), resolve(dist, "index.html"));
await cp(resolve(root, "src"), resolve(dist, "src"), { recursive: true });
await cp(resolve(root, "public"), dist, { recursive: true });

// Keep the original ChatGPT Site path working on Cloudflare and other static hosts.
await mkdir(resolve(dist, "catalog"), { recursive: true });
await cp(resolve(root, "index.html"), resolve(dist, "catalog", "index.html"));

console.log("Built Command Glass catalog in dist/ (root and /catalog/ routes).");
