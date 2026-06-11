import { spawn } from "node:child_process";
import { once } from "node:events";

const child = spawn("npx", ["electron", "."], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    ELECTRON_ENABLE_LOGGING: "1"
  },
  stdio: "inherit"
});

setTimeout(() => {
  child.kill();
}, 10000);

await once(child, "exit");
