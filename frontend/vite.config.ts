import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// base relativo: o build abre em qualquer caminho, inclusive com espaços.
export default defineConfig({
  base: "./",
  plugins: [react()],
  server: { port: 5184, strictPort: true },
  preview: { port: 5184, strictPort: true },
  test: { include: ["tests/**/*.test.ts"], environment: "node" },
});
