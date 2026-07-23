import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
const root = new URL("../dist/", import.meta.url).pathname;
const port = Number(process.env.PORT || 4173);
const types = { ".html":"text/html", ".js":"text/javascript", ".css":"text/css", ".svg":"image/svg+xml", ".webp":"image/webp", ".jpg":"image/jpeg", ".png":"image/png", ".json":"application/json" };
createServer(async (req,res)=>{try{const p=decodeURIComponent(new URL(req.url,`http://${req.headers.host}`).pathname);let f=normalize(join(root,p==="/"?"index.html":p.replace(/^\//,"")));if(!f.startsWith(normalize(root)))throw 0;const i=await stat(f);if(!i.isFile())throw 0;res.writeHead(200,{"Content-Type":types[extname(f)]||"application/octet-stream"});res.end(await readFile(f));}catch{res.writeHead(404);res.end("Not found");}}).listen(port,()=>console.log(`Preview at http://localhost:${port}`));
