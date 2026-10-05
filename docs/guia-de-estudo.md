# Guia de estudo — Mãos à Obra

## Pitch de 30 segundos
“É um marketplace de serviços em que a contratação segue uma máquina de estados no banco: proposta,
contratação, conclusão confirmada e só então avaliação. As conversas são visíveis apenas para os dois
participantes — a moderação só acessa quando há denúncia aberta — e há busca em português com filtros.”

## Onde está cada coisa
| Assunto | Arquivo |
|---|---|
| Estados, RLS, busca, moderação | `supabase/migrations/20261009000000_marketplace_schema.sql` |
| Ações por papel e estado (interface) | `src/lib/market.ts` |
| Tela da solicitação | `src/app/solicitacoes/[id]/` |
| Busca e filtros | `src/app/servicos/page.tsx` |
| Moderação | `src/app/moderacao/` |
| Testes | `tests/db/marketplace.test.ts` |

## Perguntas prováveis

**“Como você impede avaliação falsa?”** Avaliação só por função, que exige `concluida` (confirmada pelo
contratante), autor = contratante e índice único por solicitação. Mostre os testes de cada recusa.

**“Por que a confirmação é do contratante?”** Se o prestador pudesse concluir sozinho, poderia liberar a
própria avaliação. Por isso existe `aguardando_confirmacao`.

**“Como protege as mensagens e ainda permite moderação?”** RLS por participante; moderador só com
denúncia aberta sobre a conversa. Discuta o trade-off de privacidade.

**“Por que não usar UPDATE direto no status?”** Validação de ator e estado precisa ser atômica e não
pode ser contornada pelo cliente (a API do Supabase é acessível do navegador).

**“Como funciona a busca?”** `tsvector` gerado com pesos, dicionário português, acentos normalizados e
índice GIN. Conte o que o teste revelou sobre os radicais (“pintar” ≠ “pintura”).

## Exercícios
1. Adicione ranqueamento por relevância com `ts_rank` e um teste de ordenação.
2. Torne as mensagens em tempo real com Supabase Realtime (canal privado por solicitação).
3. Permita que o prestador responda publicamente a uma avaliação.
