import { useState } from "react";
import { go } from "../domain/route";
import { Screen, useClient } from "../ui/parts";
import type { ScenarioId } from "../mocks/scenarios";

interface LabClient {
  resetAll(): void;
  seedLab(s: ScenarioId, t: "selecting" | "processing" | "done"): Promise<string>;
}

const ENTRIES: [string, ScenarioId, "selecting" | "processing" | "done"][] = [
  ["Escolha do jogador, duas pessoas", "limpo", "selecting"],
  ["Processamento em andamento", "limpo", "processing"],
  ["Revisão sem problema encontrado", "limpo", "done"],
  ["Jogador perdido", "perda", "done"],
  ["Duas pessoas muito próximas", "cruzamento", "done"],
  ["Pés fora da imagem", "pes", "done"],
  ["Ninguém encontrado", "longe", "selecting"],
  ["Tempo do vídeo não confiável", "camera-lenta", "selecting"],
  ["Arquivo recusado", "arquivo", "selecting"],
];

/** Entrada guiada da demonstração; os atalhos técnicos ficam sob demanda. */
export function Lab() {
  const client = useClient() as unknown as LabClient;
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState(false);
  const start = async (scenario: ScenarioId, target: "selecting" | "processing" | "done") => {
    if (starting) return;
    setStarting(true); setError(false);
    try { go(`/sessao/${await client.seedLab(scenario, target)}`); }
    catch { setError(true); }
    finally { setStarting(false); }
  };
  return (
    <Screen title="Veja como funciona a análise">
      <p className="lead">Experimente os controles com um vídeo simulado. Não precisa gravar nem enviar um arquivo.</p>
      <div className="demo-start">
        <button type="button" className="btn btn-principal" disabled={starting} onClick={() => void start("limpo", "selecting")}>{starting ? "Abrindo demonstração…" : "Começar demonstração"}</button>
        {error && <p role="alert">Não foi possível abrir o exemplo. Tente começar novamente.</p>}
        <p className="menor">O desenho e o esqueleto são simulados. Não há avaliação da sua técnica nem medidas biomecânicas.</p>
      </div>
      <ol className="demo-steps" aria-label="O que você vai fazer">
        <li><b>Escolha uma pessoa</b><span>Toque em uma das pessoas desenhadas e confirme.</span></li>
        <li><b>Aguarde a preparação</b><span>A revisão abre automaticamente.</span></li>
        <li><b>Explore o movimento</b><span>Reproduza, pause e ligue ou desligue o esqueleto.</span></li>
      </ol>
      <a className="demo-real-link" href="/">Revisar meus vídeos reais</a>
      <p className="menor demo-real-help">Nos seus vídeos, você pode repetir trechos, anotar observações e pedir a estimativa dos pontos do corpo em uma imagem congelada.</p>
      <details className="detalhe demo-scenarios">
        <summary>Outros cenários de teste</summary>
        <div>
          <p className="menor">Atalhos para revisar situações específicas. Para começar, use a demonstração acima.</p>
          <div className="lab-grupo">
            {ENTRIES.map(([label, scenario, target]) => (
              <button key={label} type="button" disabled={starting} onClick={() => void start(scenario, target)}>{label}</button>
            ))}
            <button type="button" onClick={() => { client.resetAll(); go("/"); }}>Histórico vazio</button>
            <button type="button" onClick={() => { client.resetAll(); localStorage.removeItem("quadro.demo.intro"); go("/inicio"); }}>Recomeçar como primeiro uso</button>
          </div>
        </div>
      </details>
    </Screen>
  );
}
