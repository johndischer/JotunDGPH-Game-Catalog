import { spawn } from "node:child_process";
import "./build.mjs";
const child = spawn(process.execPath, [new URL("./serve-dist.mjs", import.meta.url).pathname], { stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 0));
