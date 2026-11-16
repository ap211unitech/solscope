import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const sourceFile = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@solscope/config": sourceFile("./src/config.ts"),
      "@solscope/rpc": sourceFile("./src/rpc.ts"),
      "@solscope/schemas": sourceFile("./src/schemas.ts"),
      "@solscope/tools": sourceFile("./src/tools/index.ts"),
      "@solscope/helpers": sourceFile("./src/helpers/index.ts"),
      "@solscope/types": sourceFile("./src/types/index.ts"),
    },
  },
  test: {
    include: ["test/**/*.test.ts"],
    setupFiles: ["./test/setup.mjs"],
  },
});
