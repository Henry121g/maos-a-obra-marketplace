import { describe, expect, it } from "vitest";
import { availableActions, fold, parseSearch } from "./market";

describe("ações por estado e papel (espelha o banco)", () => {
  it("prestador propõe ou recusa enquanto não contratado; marca feito só depois", () => {
    expect(availableActions("aberta", "prestador", false)).toEqual(["enviar_proposta", "recusar", "cancelar"]);
    expect(availableActions("contratada", "prestador", false)).toEqual(["marcar_feito", "cancelar"]);
    expect(availableActions("aguardando_confirmacao", "prestador", false)).toEqual(["cancelar"]);
  });

  it("contratante aceita proposta, confirma conclusão e só então avalia (uma vez)", () => {
    expect(availableActions("aberta", "contratante", false)).toEqual(["cancelar"]);
    expect(availableActions("proposta_enviada", "contratante", false)).toEqual(["aceitar", "cancelar"]);
    expect(availableActions("aguardando_confirmacao", "contratante", false)).toEqual(["confirmar", "cancelar"]);
    expect(availableActions("concluida", "contratante", false)).toEqual(["avaliar"]);
    expect(availableActions("concluida", "contratante", true)).toEqual([]);
  });

  it("estados finais não têm ações", () => {
    expect(availableActions("cancelada", "contratante", false)).toEqual([]);
    expect(availableActions("recusada", "prestador", false)).toEqual([]);
  });
});

describe("busca", () => {
  it("normaliza acentos como o banco", () => {
    expect(fold("Instalação ELÉTRICA")).toBe("instalacao eletrica");
  });

  it("lê filtros com valores seguros e preço em centavos", () => {
    expect(parseSearch({ q: " pintura ", preco_max: "150,50", nota_min: "4", remoto: "1", ordem: "preco", pagina: "2" })).toEqual({
      q: "pintura",
      categoria: "",
      cidade: "",
      remoto: true,
      precoMax: 15050,
      notaMin: 4,
      ordem: "preco",
      pagina: 2,
    });
    expect(parseSearch({ categoria: "' or 1=1", nota_min: "9", ordem: "drop", pagina: "-1" })).toMatchObject({
      categoria: "",
      notaMin: null,
      ordem: "recentes",
      pagina: 1,
    });
  });
});
