import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { localMediaPlugin } from "./dev/localMedia";

// base relativo: o build abre em qualquer caminho, inclusive com espaços.
export default defineConfig({
  base: "./",
  plugins: [localMediaPlugin(), react()],
  server: { port: 5185, strictPort: true },
  preview: { port: 5185, strictPort: true },
  test: { include: ["tests/**/*.test.ts"], environment: "node" },
});
