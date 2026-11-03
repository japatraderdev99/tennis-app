import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { localMediaPlugin } from "./dev/localMedia";
import { localPosePlugin } from "./dev/localPose";

// base relativo: o build abre em qualquer caminho, inclusive com espaços.
export default defineConfig({
  base: "./",
  plugins: [localMediaPlugin(), localPosePlugin(), react()],
  server: { port: 5185, strictPort: true },
  preview: { port: 5185, strictPort: true },
  test: { include: ["tests/**/*.test.ts"], environment: "node" },
});
