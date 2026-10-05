# Projeto 7 — Marketplace de serviços

## Problema
Quem precisa de um serviço (reforma, aulas, design, manutenção) e quem o oferece costumam se encontrar
por indicação e negociar por mensagens soltas: não há histórico do combinado, as avaliações não provam
que o serviço aconteceu e não há como denunciar abusos.

## Público
Contratantes e prestadores autônomos; moderadores da plataforma.

## Funcionalidades
- Perfis de **contratante** e **prestador** (a mesma conta pode ser os dois).
- Cadastro de serviços (categoria, cidade/remoto, preço “a partir de”, unidade).
- **Busca** por texto (português, sem acento), filtros (categoria, cidade, remoto, preço máximo,
  nota mínima), ordenação e **paginação**.
- **Solicitação → proposta → contratação → conclusão**, com estados explícitos.
- **Mensagens** entre os participantes de cada solicitação.
- **Avaliações** (1–5) vinculadas a uma contratação **concluída**.
- **Denúncias** de serviço, usuário, avaliação ou conversa, e painel de **moderação**.

## Estados da solicitação
```
aberta ──(prestador envia proposta)──► proposta_enviada ──(contratante aceita)──► contratada
  │                                        │  ▲ (nova proposta substitui a anterior)      │
  │ (prestador recusa / contratante cancela)│                                              │ (prestador marca como feito)
  ▼                                        ▼                                              ▼
recusada / cancelada                    cancelada                           aguardando_confirmacao
                                                                                          │ (contratante confirma)
                                                                                          ▼
                                                                                     concluida ──► avaliação (uma)
```
Cancelar após contratada é permitido a ambos, com motivo. **Pagamentos não fazem parte do escopo**: o
valor da proposta é apenas registrado (rotulado na interface como “sem pagamento pela plataforma”).

## Regras críticas
- Conversa: só contratante e prestador da solicitação leem e escrevem (RLS). Moderador só lê uma
  conversa se houver **denúncia aberta** sobre ela.
- Avaliação: só o contratante, só com solicitação `concluida`, uma por solicitação (índice único).
- Transições de estado só pelas funções do banco, que validam ator e estado atual (tabela não é
  editável diretamente).
- Usuário suspenso não cria serviços, solicitações, propostas nem mensagens.
- Média e contagem de avaliações do serviço mantidas por trigger (avaliações ocultadas saem da média).

## Critérios de aceite
1. Busca com filtros e paginação retorna apenas serviços ativos de prestadores não suspensos.
2. Fluxo completo de estados funciona e transições inválidas são recusadas com mensagem clara.
3. Terceiros não leem mensagens; moderador só lê com denúncia aberta.
4. Avaliação recusada antes da conclusão, por quem não é o contratante, ou em duplicidade.
5. Denúncia registrada; moderador oculta avaliação, remove serviço, suspende usuário e resolve a denúncia.
6. Interface acessível e responsiva com estados de carregamento, erro, sucesso e vazio.
