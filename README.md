# Mãos à Obra — marketplace de serviços

> Projeto de portfólio com **dados fictícios**, desenvolvido com assistência de IA (Claude Code).
> Nenhum serviço, prestador ou contratação é real. **Não há pagamentos**: valores de propostas são
> apenas registrados e isso é indicado na interface.

**Demonstração:** [maos-a-obra-marketplace.vercel.app](https://maos-a-obra-marketplace.vercel.app) (contas de demonstração em configuração) · **CI:** ver aba Actions

<!-- Screenshots reais serão adicionadas após o deploy. -->

## O problema

Contratantes e prestadores autônomos costumam se encontrar por indicação e negociar em mensagens
soltas: não fica registrado o que foi combinado, avaliações não provam que o serviço aconteceu e não há
como denunciar abusos.

**Público:** contratantes, prestadores autônomos e a equipe de moderação.

## Funcionalidades

- Perfis de **contratante** e **prestador** (a mesma conta pode ser os dois).
- **Cadastro de serviços** com categoria, cidade ou atendimento remoto e preço de referência.
- **Busca** em português (ignora acentos e plural/singular), **filtros** (categoria, cidade, remoto,
  preço máximo, nota mínima), ordenação e **paginação**.
- **Solicitação → proposta → contratação → conclusão**, com linha do tempo e ações por papel.
- **Mensagens** entre os dois participantes de cada solicitação.
- **Avaliações** (1–5) só depois da conclusão **confirmada pelo contratante**.
- **Denúncias** de serviço, usuário, avaliação ou conversa e **painel de moderação** (remover serviço,
  ocultar avaliação, suspender usuário).

### Contas de demonstração (senha `demo12345`, dados redefinidos diariamente)
- Contratante: `contratante@market.demo.test`
- Prestador: `prestador@market.demo.test`

Não há conta pública de moderação (é um papel administrativo). O funcionamento está coberto pelos
testes e descrito abaixo.

## Decisões técnicas

### 1. Máquina de estados no banco
```
aberta → proposta_enviada → contratada → aguardando_confirmacao → concluida
   └──────────┴──────────────┴────────────────┴──→ cancelada (motivo obrigatório após contratada)
   └──────────┴→ recusada (pelo prestador)
```
A tabela de solicitações **não é editável** pelos usuários. Cada transição é uma função
(`send_proposal`, `accept_proposal`, `mark_done`, `confirm_done`…) que bloqueia a linha
(`FOR UPDATE`), confere **quem** está agindo e **de qual estado** parte. Uma nova proposta substitui a
anterior; um índice único parcial garante no máximo uma proposta pendente.

A interface usa a mesma tabela de ações por papel e estado (`availableActions`, testada) apenas para
decidir **o que mostrar** — a decisão real é do banco.

### 2. Conversa restrita aos participantes
RLS em `messages`: só contratante e prestador da solicitação leem e escrevem, e ninguém envia em nome de
outro. Moderadores **não** leem conversas em geral; só conseguem ler uma conversa enquanto existir uma
**denúncia aberta** sobre ela (e apenas participantes podem denunciá-la). Resolveu a denúncia, o acesso
acaba. Isso equilibra privacidade e segurança.

### 3. Avaliações que provam a contratação
`create_review` exige: solicitação `concluida` (o contratante confirmou), autor = contratante e uma
avaliação por solicitação (índice único). Inserção direta na tabela é proibida. A média do serviço é
mantida por trigger e **avaliações ocultadas pela moderação saem da média**.

### 4. Busca em português
Coluna `tsvector` gerada (título, descrição e cidade com pesos) com dicionário `portuguese` e índice GIN.
Acentos são removidos por uma função imutável (`marketplace.fold`) no índice e no termo buscado —
“eletrica” encontra “elétrica”. *Aprendizado registrado pelos testes:* o radical do dicionário não junta
“pintar” e “pintura”, então o teste verifica o que ele de fato cobre (plural/singular, acentos).

### 5. Suspensão efetiva
Usuário suspenso não cria serviços, solicitações, propostas nem mensagens (funções e RLS checam), e
seus serviços somem da busca pública. O dono de um serviço removido pela moderação não consegue
reativá-lo.

### 6. Infraestrutura compartilhada
Schema `marketplace` no mesmo projeto Supabase das outras demos; contas de outros apps do portfólio não
têm perfil aqui (testado). O papel de moderador nunca vem do cadastro.

## Arquitetura

```
Next.js 16 (Server Components + Server Actions com Zod)
  └─► Supabase Postgres (schema marketplace)
        ├─ funções de transição (security definer, search_path vazio, FOR UPDATE)
        ├─ RLS: perfis/serviços públicos, solicitações/mensagens só para participantes
        ├─ busca full-text (tsvector gerado + GIN) e média de avaliações por trigger
        └─ denúncias e log de moderação
```

**Tecnologias:** Next.js 16 · React 19 · TypeScript · Tailwind CSS 4 · Supabase (Postgres, Auth, RLS,
full-text search) · Zod · Sentry · Vitest · PGlite · GitHub Actions · Vercel.

## Como executar

```bash
pnpm install
cp .env.example .env.local
```
1. Supabase → **Exposed schemas**: adicione `marketplace`; aplique `supabase/migrations/`.
2. `pnpm seed:demo` cria contas, serviços e contratações fictícias.
3. Para ter um moderador local: `update marketplace.profiles set role = 'moderador' where id = '<seu id>';`
4. `pnpm dev` → http://localhost:3000

## Testes

```bash
pnpm test     # regras de apresentação + 25 testes de banco (estados, mensagens, avaliações, moderação, busca)
pnpm lint && pnpm typecheck && pnpm build
```

## Limitações

- Sem pagamento ou escrow (fora do escopo, sinalizado na interface).
- Mensagens não chegam em tempo real (atualizam ao enviar/recarregar).
- Busca sem ranqueamento por relevância (ordena por recentes, preço ou nota).
- Sem upload de fotos de portfólio.

## Melhorias futuras

Mensagens em tempo real (Supabase Realtime) · ranqueamento `ts_rank` · fotos de trabalhos · notificações
por e-mail a cada mudança de estado · pagamento com escrow.

## Guia de estudo

[docs/guia-de-estudo.md](docs/guia-de-estudo.md)

## Transparência sobre o uso de IA

Código, testes e documentação produzidos com assistência do Claude Code (Anthropic), sob minha direção e
revisão.
