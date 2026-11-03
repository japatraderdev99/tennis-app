import { useState } from "react";
import type { DeletionState, Session } from "../api/types";
import { STAGE_COPY, STAGE_ORDER } from "../domain/copy";
import { go } from "../domain/route";
import { Screen, useClient } from "../ui/parts";

export function Processing({ session, refresh }: { session: Session; refresh: () => void }) {
  const client = useClient();
  const stage = session.run?.stage ?? "queued";
  const current = STAGE_ORDER.indexOf(stage);
  return (
    <Screen title="Processando o vídeo">
      <p className="demo-cue"><b>Aguarde: a revisão abrirá automaticamente.</b>{client.isDemo && " Esta preparação é simulada."}</p>
      <p style={{ marginBottom: 20 }}>Isto mostra só o andamento. Não diz nada sobre a qualidade do vídeo nem do seu saque.</p>
      <ol className="lateral etapas" aria-live="polite">
        {STAGE_ORDER.map((s, i) => {
          const estado = i < current ? "feito" : i === current ? "agora" : "pendente";
          return (
            <li key={s} data-estado={estado}>
              {STAGE_COPY[s]}
              <span className="etapa-estado">{estado === "feito" ? "Concluído" : estado === "agora" ? "Em andamento" : "A seguir"}</span>
            </li>
          );
        })}
      </ol>
      <p>Pode sair desta tela. O processamento continua e o vídeo aparece em Seus saques.</p>
      <div className="acoes">
        <button type="button" className="btn btn-secundario" onClick={() => go("/")}>Ir para Seus saques</button>
        <button type="button" className="btn-texto" onClick={async () => { await client.cancelRun(session.session_id); refresh(); }}>Cancelar análise</button>
      </div>
    </Screen>
  );
}

export function Failed({ session, refresh }: { session: Session; refresh: () => void }) {
  const client = useClient();
  const retryable = session.run?.error?.retryable ?? false;
  return (
    <Screen title="O processamento falhou" back={{ label: "Seus saques", onClick: () => go("/") }}>
      <p className="lead">Não conseguimos concluir o processamento. Isso não é uma avaliação do seu saque.</p>
      <p style={{ marginBottom: 16 }}>O vídeo continua guardado{retryable ? " e você pode tentar de novo." : "."}</p>
      <details className="detalhe detalhes">
        <summary>Detalhes técnicos</summary>
        <div><p>Código do erro: {session.run?.error?.code ?? "indisponível"}</p></div>
      </details>
      <div className="acoes">
        {retryable && <button type="button" className="btn btn-principal" onClick={async () => { await client.retry(session.session_id); refresh(); }}>Tentar de novo</button>}
        <button type="button" className="btn btn-secundario" onClick={() => go(`/sessao/${session.session_id}/rever`)}>Rever o vídeo sem esqueleto</button>
        <DeleteButton session={session} refresh={refresh} />
      </div>
    </Screen>
  );
}

export function Cancelled({ session, refresh }: { session: Session; refresh: () => void }) {
  const client = useClient();
  return (
    <Screen title="Análise cancelada" back={{ label: "Seus saques", onClick: () => go("/") }}>
      <p className="lead">O vídeo continua guardado. Você pode analisar de novo ou excluir.</p>
      <div className="acoes">
        <button type="button" className="btn btn-principal" onClick={async () => { await client.retry(session.session_id); refresh(); }}>Analisar de novo</button>
        <button type="button" className="btn btn-secundario" onClick={() => go(`/sessao/${session.session_id}/rever`)}>Rever o vídeo sem esqueleto</button>
        <DeleteButton session={session} refresh={refresh} />
      </div>
    </Screen>
  );
}

export function DeleteButton({ session, refresh }: { session: Session; refresh: () => void }) {
  const client = useClient();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn-texto" onClick={() => setOpen(true)}>Excluir vídeo e dados</button>
      {open && (
        <dialog
          className="dialogo" aria-labelledby="excluir-titulo"
          ref={(el) => { if (el && !el.open) el.showModal(); }}
          onCancel={() => setOpen(false)}
        >
          <h2 id="excluir-titulo">Excluir este vídeo e os dados?</h2>
          <p>Isto não pode ser desfeito. Serão excluídos:</p>
          <ul>
            <li>o vídeo enviado;</li>
            <li>o esqueleto e o relatório;</li>
            <li>os links temporários de acesso.</li>
          </ul>
          <p>O vídeo que está na galeria do seu celular não muda.</p>
          <button type="button" className="btn btn-principal" onClick={async () => { await client.deleteSession(session.session_id); setOpen(false); refresh(); }}>Excluir vídeo e dados</button>
          <button type="button" className="btn-texto" onClick={() => setOpen(false)}>Manter</button>
        </dialog>
      )}
    </>
  );
}

const DELETE_STEPS: { state: DeletionState; label: string }[] = [
  { state: "access_blocked", label: "Acesso bloqueado" },
  { state: "removing_files", label: "Removendo arquivos e links" },
  { state: "deleted", label: "Vídeo e dados excluídos" },
];

export function DeletionView({ session }: { session: Session }) {
  const done = session.deletion === "deleted";
  const current = DELETE_STEPS.findIndex((s) => s.state === session.deletion);
  return (
    <Screen title={done ? "Vídeo e dados excluídos" : "Excluindo vídeo e dados"}>
      <ol className="lateral etapas" aria-live="polite">
        {DELETE_STEPS.map((s, i) => {
          const estado = i < current || done ? "feito" : i === current ? "agora" : "pendente";
          return (
            <li key={s.state} data-estado={estado}>
              {s.label}
              <span className="etapa-estado">{estado === "feito" ? "Concluído" : estado === "agora" ? "Em andamento" : "A seguir"}</span>
            </li>
          );
        })}
      </ol>
      <p className="menor">Cópias de segurança: o prazo de remoção ainda será definido antes do piloto. Nesta demonstração não há cópias.</p>
      <div className="acoes">
        <button type="button" className="btn btn-principal" onClick={() => go("/")}>Ir para Seus saques</button>
      </div>
    </Screen>
  );
}
