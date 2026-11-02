import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/archivo/wdth.css";
import "@fontsource-variable/atkinson-hyperlegible-next/wght.css";
import "./styles/app.css";
import { App } from "./App";
import { createMockClient } from "./mocks/mockClient";
import { ClientProvider } from "./ui/parts";

// Ponto único de troca: a integração real substitui esta linha por um cliente HTTP.
const fast = new URLSearchParams(window.location.search).get("velocidade") === "rapida";
const client = createMockClient({ speed: fast ? 0.08 : 1 });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ClientProvider value={client}>
      <App />
    </ClientProvider>
  </StrictMode>,
);
