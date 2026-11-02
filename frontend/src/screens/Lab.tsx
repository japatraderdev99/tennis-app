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

/** Atalhos para revisão. Não faz parte da experiência testada com praticantes. */
export function Lab() {
  const client = useClient() as unknown as LabClient;
  return (
    <Screen title="Estados para revisão" back={{ label: "Voltar", onClick: () => go("/") }}>
      <p style={{ marginBottom: 16 }}>Atalhos para quem revisa o protótipo. Quem testa como praticante não deve começar por aqui.</p>
      <div className="lab-grupo">
        {ENTRIES.map(([label, scenario, target]) => (
          <button key={label} type="button" onClick={async () => go(`/sessao/${await client.seedLab(scenario, target)}`)}>{label}</button>
        ))}
        <button type="button" onClick={() => { client.resetAll(); go("/"); }}>Histórico vazio</button>
        <button type="button" onClick={() => { client.resetAll(); localStorage.removeItem("quadro.demo.intro"); go("/inicio"); }}>Recomeçar como primeiro uso</button>
      </div>
    </Screen>
  );
}
