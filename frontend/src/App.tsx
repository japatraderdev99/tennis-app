import { useEffect, useState } from "react";
import { go, parseHash, viewForSession, type Route } from "./domain/route";
import { Guide, Home, Intro, introSeen, Limits, PickVideo, RejectedView, UploadView } from "./screens/Basics";
import { Lab } from "./screens/Lab";
import { Review } from "./screens/Review";
import { SelectPlayer } from "./screens/SelectPlayer";
import { Cancelled, DeletionView, Failed, Processing } from "./screens/Status";
import { Screen, useClient } from "./ui/parts";
import type { Session } from "./api/types";

function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(window.location.hash));
  useEffect(() => {
    const onChange = () => { setRoute(parseHash(window.location.hash)); window.scrollTo(0, 0); };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

function SessionRoute({ id, mode }: { id: string; mode: "auto" | "reselect" | "review-only" }) {
  const client = useClient();
  const [session, setSession] = useState<Session | null | undefined>();
  const refresh = () => { void client.getSession(id).then(setSession); };

  // A exclusão pode começar em qualquer tela e precisa continuar sendo acompanhada.
  const deleting = session?.deletion === "access_blocked" || session?.deletion === "removing_files";
  const settled = session?.deletion === "deleted" || (session?.deletion === "none" && session.run?.state === "succeeded");
  useEffect(() => {
    refresh();
    if (!deleting && (settled || mode !== "auto")) return;
    const timer = window.setInterval(refresh, 250);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, mode, settled, deleting]);

  if (session === undefined) return <Screen title="Abrindo"><p role="status">Carregando.</p></Screen>;
  if (session === null) {
    return (
      <Screen title="Vídeo não encontrado">
        <p className="lead">Este vídeo pode ter sido excluído.</p>
        <div className="acoes"><button type="button" className="btn btn-principal" onClick={() => go("/")}>Ir para Seus saques</button></div>
      </Screen>
    );
  }
  if (session.deletion !== "none") return <DeletionView session={session} />;
  if (mode === "review-only") return <Review session={session} refresh={refresh} />;
  if (mode === "reselect") return <SelectPlayer session={session} again refresh={refresh} />;

  switch (viewForSession(session)) {
    case "deletion": return <DeletionView session={session} />;
    case "upload": return <UploadView session={session} refresh={refresh} />;
    case "rejected": return <RejectedView session={session} />;
    case "select": return <SelectPlayer session={session} refresh={refresh} />;
    case "processing": return <Processing session={session} refresh={refresh} />;
    case "failed": return <Failed session={session} refresh={refresh} />;
    case "cancelled": return <Cancelled session={session} refresh={refresh} />;
    case "replay": return <Review session={session} refresh={refresh} />;
  }
}

export function App() {
  const route = useRoute();
  const client = useClient();
  const body = () => {
    switch (route.name) {
      case "intro": return <Intro />;
      case "home": return introSeen() ? <Home /> : <Intro />;
      case "guide": return <Guide />;
      case "pick": return <PickVideo />;
      case "limits": return <Limits />;
      case "lab": return <Lab />;
      case "session": return <SessionRoute key={route.id} id={route.id} mode="auto" />;
      case "reselect": return <SessionRoute key={`${route.id}-r`} id={route.id} mode="reselect" />;
      case "review-only": return <SessionRoute key={`${route.id}-v`} id={route.id} mode="review-only" />;
    }
  };
  return (
    <div className="app">
      {client.isDemo && <div className="aviso-demo" role="note">Demonstração: vídeos e dados simulados</div>}
      {body()}
    </div>
  );
}
