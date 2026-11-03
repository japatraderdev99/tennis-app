import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/archivo/wdth.css";
import "@fontsource-variable/atkinson-hyperlegible-next/wght.css";
import "./styles/app.css";
import { App } from "./App";
import { createMockClient } from "./mocks/mockClient";
import { ClientProvider } from "./ui/parts";

// Cliente de demonstração. Integração real também exige adapter de mídia e mapa de PTS.
const fast = new URLSearchParams(window.location.search).get("velocidade") === "rapida";
const client = createMockClient({ speed: fast ? 0.08 : 1 });

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ClientProvider value={client}>
      <App />
    </ClientProvider>
  </StrictMode>,
);
