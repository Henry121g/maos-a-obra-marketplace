// Regras de apresentação do marketplace (puras, testáveis).

export type RequestStatus = "aberta" | "proposta_enviada" | "contratada" | "aguardando_confirmacao" | "concluida" | "recusada" | "cancelada";

export const STATUS_LABEL: Record<RequestStatus, string> = {
  aberta: "Aguardando proposta",
  proposta_enviada: "Proposta enviada",
  contratada: "Contratada",
  aguardando_confirmacao: "Aguardando confirmação do contratante",
  concluida: "Concluída",
  recusada: "Recusada pelo prestador",
  cancelada: "Cancelada",
};

export const PRICE_UNIT_LABEL: Record<string, string> = { hora: "por hora", projeto: "por projeto", visita: "por visita", mes: "por mês" };

export type Action = "enviar_proposta" | "recusar" | "aceitar" | "cancelar" | "marcar_feito" | "confirmar" | "avaliar";

/** Ações disponíveis para cada papel em cada estado (espelha as funções do banco). */
export function availableActions(status: RequestStatus, role: "contratante" | "prestador", reviewed: boolean): Action[] {
  const a: Action[] = [];
  if (role === "prestador") {
    if (status === "aberta" || status === "proposta_enviada") a.push("enviar_proposta", "recusar");
    if (status === "contratada") a.push("marcar_feito");
  } else {
    if (status === "proposta_enviada") a.push("aceitar");
    if (status === "aguardando_confirmacao") a.push("confirmar");
    if (status === "concluida" && !reviewed) a.push("avaliar");
  }
  if (["aberta", "proposta_enviada", "contratada", "aguardando_confirmacao"].includes(status)) a.push("cancelar");
  return a;
}

/** Linha do tempo para exibir o progresso (estados finais negativos encerram a trilha). */
export const TIMELINE: RequestStatus[] = ["aberta", "proposta_enviada", "contratada", "aguardando_confirmacao", "concluida"];

export function timelineIndex(status: RequestStatus): number {
  return TIMELINE.indexOf(status);
}

/** Mesmo critério do banco (marketplace.fold): minúsculas e sem acentos. */
export function fold(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export interface SearchFilters {
  q: string;
  categoria: string;
  cidade: string;
  remoto: boolean;
  precoMax: number | null; // centavos
  notaMin: number | null;
  ordem: "recentes" | "preco" | "nota";
  pagina: number;
}

export function parseSearch(sp: Record<string, string | string[] | undefined>): SearchFilters {
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).trim() : "");
  const preco = Number(str("preco_max").replace(",", "."));
  const nota = Number(str("nota_min"));
  const pagina = Number(str("pagina") || 1);
  const ordem = str("ordem");
  return {
    q: str("q").slice(0, 80),
    categoria: /^[a-z0-9-]{2,40}$/.test(str("categoria")) ? str("categoria") : "",
    cidade: str("cidade").slice(0, 80),
    remoto: str("remoto") === "1",
    precoMax: Number.isFinite(preco) && preco > 0 ? Math.round(preco * 100) : null,
    notaMin: Number.isInteger(nota) && nota >= 1 && nota <= 5 ? nota : null,
    ordem: (["preco", "nota"] as const).includes(ordem as never) ? (ordem as SearchFilters["ordem"]) : "recentes",
    pagina: Number.isInteger(pagina) && pagina > 0 && pagina < 1000 ? pagina : 1,
  };
}
