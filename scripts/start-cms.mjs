import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL("../", import.meta.url));
const child = spawn(process.execPath, [require.resolve("decap-server")], {
  cwd: root,
  env: {
    ...process.env,
    GIT_REPO_DIRECTORY: root,
    BIND_HOST: "127.0.0.1",
    PORT: "8081",
    ORIGIN: "http://localhost:4321",
    MODE: "fs",
  },
  stdio: "inherit",
});

console.log("另开终端运行 pnpm dev，并使用 http://localhost:4321/admin/ 写作。");
console.log("保存只修改本地文件；提交和推送仍使用 Git 命令。");

child.on("error", (error) => {
  console.error("本地写作代理启动失败：", error.message);
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
