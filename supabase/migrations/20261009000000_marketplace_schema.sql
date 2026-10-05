-- Projeto 7 — Marketplace de serviços
-- Schema isolado `marketplace` (projeto Supabase compartilhado com outras demos; ver PLANO.md do portfólio).
-- Máquina de estados da contratação, conversa restrita aos participantes e avaliação só após conclusão.

create schema if not exists marketplace;

create type marketplace.user_role as enum ('usuario', 'moderador');
create type marketplace.price_unit as enum ('hora', 'projeto', 'visita', 'mes');
create type marketplace.service_status as enum ('ativo', 'pausado', 'removido');
create type marketplace.request_status as enum (
  'aberta', 'proposta_enviada', 'contratada', 'aguardando_confirmacao', 'concluida', 'recusada', 'cancelada');
create type marketplace.proposal_status as enum ('enviada', 'aceita', 'recusada', 'substituida');
create type marketplace.report_target as enum ('servico', 'usuario', 'avaliacao', 'conversa');
create type marketplace.report_status as enum ('aberta', 'resolvida', 'descartada');

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------

create table marketplace.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  full_name     text not null check (char_length(full_name) between 2 and 100),
  bio           text check (char_length(bio) <= 500),
  city          text check (char_length(city) <= 80),
  is_provider   boolean not null default false,
  role          marketplace.user_role not null default 'usuario',
  suspended_at  timestamptz,
  suspension_reason text,
  created_at    timestamptz not null default now()
);

-- Remove acentos e põe em minúsculas (a busca ignora acentos; o app aplica a mesma regra ao termo buscado).
create or replace function marketplace.fold(p text)
returns text language sql immutable parallel safe set search_path = '' as $$
  select translate(lower(coalesce(p, '')), 'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn')
$$;

create table marketplace.categories (
  id    uuid primary key default gen_random_uuid(),
  slug  text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  name  text not null unique
);

create table marketplace.services (
  id                uuid primary key default gen_random_uuid(),
  provider_id       uuid not null references marketplace.profiles (id) on delete cascade,
  category_id       uuid not null references marketplace.categories (id),
  title             text not null check (char_length(title) between 5 and 100),
  description       text not null check (char_length(description) between 20 and 3000),
  price_from_cents  bigint check (price_from_cents is null or price_from_cents between 0 and 100000000),
  price_unit        marketplace.price_unit not null default 'projeto',
  city              text check (char_length(city) <= 80),
  remote            boolean not null default false,
  status            marketplace.service_status not null default 'ativo',
  rating_avg        numeric(3, 2),
  rating_count      int not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  search            tsvector generated always as (
    setweight(to_tsvector('portuguese', marketplace.fold(title)), 'A') ||
    setweight(to_tsvector('portuguese', marketplace.fold(description)), 'B') ||
    setweight(to_tsvector('portuguese', marketplace.fold(city)), 'C')
  ) stored,
  check (remote or city is not null)
);
create index on marketplace.services using gin (search);
create index on marketplace.services (category_id, status);
create index on marketplace.services (provider_id);

create table marketplace.requests (
  id                uuid primary key default gen_random_uuid(),
  service_id        uuid not null references marketplace.services (id) on delete cascade,
  client_id         uuid not null references marketplace.profiles (id) on delete cascade,
  provider_id       uuid not null references marketplace.profiles (id) on delete cascade,
  description       text not null check (char_length(description) between 10 and 2000),
  desired_date      date,
  status            marketplace.request_status not null default 'aberta',
  agreed_price_cents bigint,
  status_reason     text check (char_length(status_reason) <= 300),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (client_id <> provider_id)
);
create index on marketplace.requests (client_id, updated_at desc);
create index on marketplace.requests (provider_id, updated_at desc);

create table marketplace.proposals (
  id              uuid primary key default gen_random_uuid(),
  request_id      uuid not null references marketplace.requests (id) on delete cascade,
  provider_id     uuid not null references marketplace.profiles (id) on delete cascade,
  price_cents     bigint not null check (price_cents between 0 and 100000000),
  estimated_days  int check (estimated_days between 1 and 365),
  message         text not null check (char_length(message) between 5 and 2000),
  status          marketplace.proposal_status not null default 'enviada',
  created_at      timestamptz not null default now()
);
create index on marketplace.proposals (request_id, created_at desc);
-- No máximo uma proposta "enviada" por solicitação.
create unique index proposals_one_pending on marketplace.proposals (request_id) where status = 'enviada';

create table marketplace.messages (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references marketplace.requests (id) on delete cascade,
  sender_id   uuid not null references marketplace.profiles (id) on delete cascade,
  body        text not null check (char_length(body) between 1 and 2000),
  created_at  timestamptz not null default now()
);
create index on marketplace.messages (request_id, created_at);

create table marketplace.reviews (
  id           uuid primary key default gen_random_uuid(),
  request_id   uuid not null unique references marketplace.requests (id) on delete cascade,
  service_id   uuid not null references marketplace.services (id) on delete cascade,
  reviewer_id  uuid not null references marketplace.profiles (id) on delete cascade,
  provider_id  uuid not null references marketplace.profiles (id) on delete cascade,
  rating       int not null check (rating between 1 and 5),
  comment      text check (char_length(comment) <= 1000),
  hidden_at    timestamptz,
  hidden_reason text,
  created_at   timestamptz not null default now()
);
create index on marketplace.reviews (service_id, created_at desc);

create table marketplace.reports (
  id           uuid primary key default gen_random_uuid(),
  reporter_id  uuid not null references marketplace.profiles (id) on delete cascade,
  target_type  marketplace.report_target not null,
  target_id    uuid not null,
  reason       text not null check (reason in ('fraude', 'ofensivo', 'spam', 'informacao_falsa', 'outro')),
  details      text check (char_length(details) <= 1000),
  status       marketplace.report_status not null default 'aberta',
  resolution   text check (char_length(resolution) <= 500),
  resolved_by  uuid references marketplace.profiles (id) on delete set null,
  resolved_at  timestamptz,
  created_at   timestamptz not null default now()
);
create index on marketplace.reports (status, created_at);
create unique index reports_one_open_per_reporter on marketplace.reports (reporter_id, target_type, target_id) where status = 'aberta';

create table marketplace.moderation_log (
  id            bigint generated always as identity primary key,
  moderator_id  uuid references marketplace.profiles (id) on delete set null,
  action        text not null,
  target_type   marketplace.report_target not null,
  target_id     uuid not null,
  reason        text,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Auxiliares
-- ---------------------------------------------------------------------------

create or replace function marketplace.is_moderator()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from marketplace.profiles where id = auth.uid() and role = 'moderador' and suspended_at is null)
$$;

-- Usuário deste app e não suspenso.
create or replace function marketplace.is_active_user()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from marketplace.profiles where id = auth.uid() and suspended_at is null)
$$;

create or replace function marketplace.is_participant(p_request uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from marketplace.requests where id = p_request and auth.uid() in (client_id, provider_id))
$$;

-- Moderador só acessa uma conversa com denúncia aberta sobre ela.
create or replace function marketplace.conversation_reported(p_request uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from marketplace.reports where target_type = 'conversa' and target_id = p_request and status = 'aberta')
$$;

create or replace function marketplace.require_active()
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not exists (select 1 from marketplace.profiles where id = auth.uid()) then
    raise exception 'NAO_AUTENTICADO' using errcode = '28000';
  end if;
  if not marketplace.is_active_user() then
    raise exception 'USUARIO_SUSPENSO' using errcode = '42501';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Máquina de estados (únicas formas de alterar solicitações e propostas)
-- ---------------------------------------------------------------------------

create or replace function marketplace.create_request(p_service uuid, p_description text, p_desired_date date default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_service marketplace.services;
  v_id uuid;
begin
  perform marketplace.require_active();
  select s.* into v_service from marketplace.services s
  join marketplace.profiles p on p.id = s.provider_id
  where s.id = p_service and s.status = 'ativo' and p.suspended_at is null;
  if v_service.id is null then
    raise exception 'SERVICO_INDISPONIVEL' using errcode = 'P0002';
  end if;
  if v_service.provider_id = auth.uid() then
    raise exception 'PROPRIO_SERVICO' using errcode = '22023';
  end if;
  if p_desired_date is not null and p_desired_date < current_date then
    raise exception 'DATA_PASSADA' using errcode = '22023';
  end if;
  insert into marketplace.requests (service_id, client_id, provider_id, description, desired_date)
  values (p_service, auth.uid(), v_service.provider_id, trim(p_description), p_desired_date)
  returning id into v_id;
  return v_id;
end $$;

-- Lê a solicitação com bloqueio e valida que o usuário é o ator esperado.
create or replace function marketplace._lock_request(p_request uuid, p_actor text)
returns marketplace.requests language plpgsql security definer set search_path = '' as $$
declare
  v_req marketplace.requests;
begin
  perform marketplace.require_active();
  select * into v_req from marketplace.requests where id = p_request for update;
  if v_req.id is null or auth.uid() not in (v_req.client_id, v_req.provider_id) then
    raise exception 'SOLICITACAO_INEXISTENTE' using errcode = 'P0002';
  end if;
  if (p_actor = 'prestador' and auth.uid() <> v_req.provider_id) or (p_actor = 'contratante' and auth.uid() <> v_req.client_id) then
    raise exception 'ACAO_NAO_PERMITIDA' using errcode = '42501';
  end if;
  return v_req;
end $$;

create or replace function marketplace._transition_error(p_from marketplace.request_status)
returns void language plpgsql set search_path = '' as $$
begin
  raise exception 'TRANSICAO_INVALIDA' using errcode = 'P0001', detail = p_from::text;
end $$;

create or replace function marketplace.send_proposal(p_request uuid, p_price_cents bigint, p_message text, p_estimated_days int default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_req marketplace.requests := marketplace._lock_request(p_request, 'prestador');
  v_id uuid;
begin
  if v_req.status not in ('aberta', 'proposta_enviada') then
    perform marketplace._transition_error(v_req.status);
  end if;
  update marketplace.proposals set status = 'substituida' where request_id = p_request and status = 'enviada';
  insert into marketplace.proposals (request_id, provider_id, price_cents, estimated_days, message)
  values (p_request, auth.uid(), p_price_cents, p_estimated_days, trim(p_message))
  returning id into v_id;
  update marketplace.requests set status = 'proposta_enviada', updated_at = now() where id = p_request;
  return v_id;
end $$;

create or replace function marketplace.accept_proposal(p_proposal uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_prop marketplace.proposals;
  v_req marketplace.requests;
begin
  select * into v_prop from marketplace.proposals where id = p_proposal;
  if v_prop.id is null then
    raise exception 'PROPOSTA_INEXISTENTE' using errcode = 'P0002';
  end if;
  v_req := marketplace._lock_request(v_prop.request_id, 'contratante');
  if v_req.status <> 'proposta_enviada' or v_prop.status <> 'enviada' then
    raise exception 'PROPOSTA_INVALIDA' using errcode = 'P0001';
  end if;
  update marketplace.proposals set status = 'aceita' where id = p_proposal;
  update marketplace.requests
  set status = 'contratada', agreed_price_cents = v_prop.price_cents, updated_at = now()
  where id = v_req.id;
end $$;

create or replace function marketplace.decline_request(p_request uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_req marketplace.requests := marketplace._lock_request(p_request, 'prestador');
begin
  if v_req.status not in ('aberta', 'proposta_enviada') then
    perform marketplace._transition_error(v_req.status);
  end if;
  update marketplace.proposals set status = 'recusada' where request_id = p_request and status = 'enviada';
  update marketplace.requests set status = 'recusada', status_reason = left(nullif(trim(p_reason), ''), 300), updated_at = now()
  where id = p_request;
end $$;

-- Qualquer participante cancela antes da conclusão; depois de contratada, o motivo é obrigatório.
create or replace function marketplace.cancel_request(p_request uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_req marketplace.requests := marketplace._lock_request(p_request, 'qualquer');
begin
  if v_req.status not in ('aberta', 'proposta_enviada', 'contratada', 'aguardando_confirmacao') then
    perform marketplace._transition_error(v_req.status);
  end if;
  if v_req.status in ('contratada', 'aguardando_confirmacao') and nullif(trim(p_reason), '') is null then
    raise exception 'MOTIVO_OBRIGATORIO' using errcode = '22023';
  end if;
  update marketplace.proposals set status = 'recusada' where request_id = p_request and status = 'enviada';
  update marketplace.requests set status = 'cancelada', status_reason = left(nullif(trim(p_reason), ''), 300), updated_at = now()
  where id = p_request;
end $$;

create or replace function marketplace.mark_done(p_request uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_req marketplace.requests := marketplace._lock_request(p_request, 'prestador');
begin
  if v_req.status <> 'contratada' then
    perform marketplace._transition_error(v_req.status);
  end if;
  update marketplace.requests set status = 'aguardando_confirmacao', updated_at = now() where id = p_request;
end $$;

create or replace function marketplace.confirm_done(p_request uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_req marketplace.requests := marketplace._lock_request(p_request, 'contratante');
begin
  if v_req.status <> 'aguardando_confirmacao' then
    perform marketplace._transition_error(v_req.status);
  end if;
  update marketplace.requests set status = 'concluida', updated_at = now() where id = p_request;
end $$;

-- Avaliação: só o contratante, só após conclusão confirmada, uma por solicitação.
create or replace function marketplace.create_review(p_request uuid, p_rating int, p_comment text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_req marketplace.requests := marketplace._lock_request(p_request, 'contratante');
  v_id uuid;
begin
  if v_req.status <> 'concluida' then
    raise exception 'AVALIACAO_SO_APOS_CONCLUSAO' using errcode = 'P0001';
  end if;
  if exists (select 1 from marketplace.reviews where request_id = p_request) then
    raise exception 'JA_AVALIADO' using errcode = '23505';
  end if;
  insert into marketplace.reviews (request_id, service_id, reviewer_id, provider_id, rating, comment)
  values (p_request, v_req.service_id, auth.uid(), v_req.provider_id, p_rating, nullif(trim(p_comment), ''))
  returning id into v_id;
  return v_id;
end $$;

-- Média de avaliações do serviço (avaliações ocultas pela moderação não contam).
create or replace function marketplace.refresh_rating()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_service uuid := coalesce(new.service_id, old.service_id);
begin
  update marketplace.services s set
    rating_avg = (select round(avg(rating)::numeric, 2) from marketplace.reviews r where r.service_id = v_service and r.hidden_at is null),
    rating_count = (select count(*) from marketplace.reviews r where r.service_id = v_service and r.hidden_at is null)
  where s.id = v_service;
  return null;
end $$;

create trigger reviews_refresh_rating after insert or update of hidden_at or delete on marketplace.reviews
  for each row execute function marketplace.refresh_rating();

-- ---------------------------------------------------------------------------
-- Moderação
-- ---------------------------------------------------------------------------

create or replace function marketplace._require_moderator()
returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not marketplace.is_moderator() then
    raise exception 'SOMENTE_MODERADORES' using errcode = '42501';
  end if;
end $$;

create or replace function marketplace.moderate(p_target_type marketplace.report_target, p_target uuid, p_action text, p_reason text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform marketplace._require_moderator();
  if nullif(trim(p_reason), '') is null then
    raise exception 'MOTIVO_OBRIGATORIO' using errcode = '22023';
  end if;
  if p_target_type = 'servico' and p_action in ('remover', 'restaurar') then
    update marketplace.services set status = case when p_action = 'remover' then 'removido' else 'ativo' end::marketplace.service_status,
      updated_at = now() where id = p_target;
  elsif p_target_type = 'avaliacao' and p_action in ('ocultar', 'restaurar') then
    update marketplace.reviews set hidden_at = case when p_action = 'ocultar' then now() end,
      hidden_reason = case when p_action = 'ocultar' then left(p_reason, 300) end where id = p_target;
  elsif p_target_type = 'usuario' and p_action in ('suspender', 'reativar') then
    if p_target = auth.uid() then
      raise exception 'ACAO_NAO_PERMITIDA' using errcode = '42501';
    end if;
    update marketplace.profiles set suspended_at = case when p_action = 'suspender' then now() end,
      suspension_reason = case when p_action = 'suspender' then left(p_reason, 300) end where id = p_target;
  else
    raise exception 'ACAO_INVALIDA' using errcode = '22023';
  end if;
  if not found then
    raise exception 'ALVO_INEXISTENTE' using errcode = 'P0002';
  end if;
  insert into marketplace.moderation_log (moderator_id, action, target_type, target_id, reason)
  values (auth.uid(), p_action, p_target_type, p_target, left(p_reason, 300));
end $$;

create or replace function marketplace.resolve_report(p_report uuid, p_status marketplace.report_status, p_resolution text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform marketplace._require_moderator();
  if p_status = 'aberta' then
    raise exception 'ACAO_INVALIDA' using errcode = '22023';
  end if;
  update marketplace.reports set status = p_status, resolution = left(nullif(trim(p_resolution), ''), 500),
    resolved_by = auth.uid(), resolved_at = now()
  where id = p_report and status = 'aberta';
  if not found then
    raise exception 'DENUNCIA_INEXISTENTE' using errcode = 'P0002';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Cadastro
-- ---------------------------------------------------------------------------

create or replace function marketplace.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_name text;
begin
  if new.raw_user_meta_data ->> 'app' is distinct from 'marketplace' then
    return new;
  end if;
  v_name := left(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), 100);
  if char_length(v_name) < 2 then v_name := 'Usuário'; end if;
  -- Papel sempre 'usuario': moderadores são definidos pelo service_role.
  insert into marketplace.profiles (id, full_name, is_provider)
  values (new.id, v_name, coalesce((new.raw_user_meta_data ->> 'is_provider')::boolean, false));
  return new;
end $$;

create trigger marketplace_on_auth_user_created
  after insert on auth.users
  for each row execute function marketplace.handle_new_user();

insert into marketplace.categories (slug, name) values
  ('reformas', 'Reformas e reparos'), ('aulas', 'Aulas e reforço'), ('design', 'Design e criação'),
  ('tecnologia', 'Tecnologia'), ('limpeza', 'Limpeza'), ('eventos', 'Eventos'), ('saude-bem-estar', 'Saúde e bem-estar');

-- ---------------------------------------------------------------------------
-- Privilégios e RLS
-- ---------------------------------------------------------------------------

grant usage on schema marketplace to anon, authenticated, service_role;
revoke all on all functions in schema marketplace from public;
revoke all on all tables in schema marketplace from anon, authenticated;

grant select on marketplace.categories to anon, authenticated;
grant select (id, full_name, bio, city, is_provider, created_at, suspended_at) on marketplace.profiles to anon, authenticated;
grant select (role, suspension_reason) on marketplace.profiles to authenticated;
grant update (full_name, bio, city, is_provider) on marketplace.profiles to authenticated;
grant select on marketplace.services to anon, authenticated;
grant insert (provider_id, category_id, title, description, price_from_cents, price_unit, city, remote) on marketplace.services to authenticated;
grant update (category_id, title, description, price_from_cents, price_unit, city, remote, status, updated_at) on marketplace.services to authenticated;
grant select on marketplace.reviews to anon, authenticated;
grant select on marketplace.requests, marketplace.proposals, marketplace.messages, marketplace.reports, marketplace.moderation_log to authenticated;
grant insert (request_id, sender_id, body) on marketplace.messages to authenticated;
grant insert (reporter_id, target_type, target_id, reason, details) on marketplace.reports to authenticated;
grant all on all tables in schema marketplace to service_role;

grant execute on function marketplace.is_moderator(), marketplace.is_active_user(), marketplace.is_participant(uuid),
  marketplace.conversation_reported(uuid), marketplace.fold(text) to anon, authenticated;
grant execute on function marketplace.fold(text) to service_role;
grant execute on function marketplace.create_request(uuid, text, date), marketplace.send_proposal(uuid, bigint, text, int),
  marketplace.accept_proposal(uuid), marketplace.decline_request(uuid, text), marketplace.cancel_request(uuid, text),
  marketplace.mark_done(uuid), marketplace.confirm_done(uuid), marketplace.create_review(uuid, int, text),
  marketplace.moderate(marketplace.report_target, uuid, text, text), marketplace.resolve_report(uuid, marketplace.report_status, text)
  to authenticated;

alter table marketplace.profiles       enable row level security;
alter table marketplace.categories     enable row level security;
alter table marketplace.services       enable row level security;
alter table marketplace.requests       enable row level security;
alter table marketplace.proposals      enable row level security;
alter table marketplace.messages       enable row level security;
alter table marketplace.reviews        enable row level security;
alter table marketplace.reports        enable row level security;
alter table marketplace.moderation_log enable row level security;

create policy "categorias públicas" on marketplace.categories for select using (true);
create policy "perfis públicos" on marketplace.profiles for select using (true);
create policy "edita o próprio perfil" on marketplace.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Serviços: públicos se ativos e o prestador não está suspenso; o dono e moderadores veem todos os seus.
create policy "serviços visíveis" on marketplace.services for select using (
  (status = 'ativo' and exists (select 1 from marketplace.profiles p where p.id = provider_id and p.suspended_at is null))
  or provider_id = auth.uid() or marketplace.is_moderator()
);
create policy "prestador cria" on marketplace.services for insert to authenticated with check (
  provider_id = auth.uid() and marketplace.is_active_user()
  and exists (select 1 from marketplace.profiles where id = auth.uid() and is_provider)
);
-- O dono pausa/edita, mas não "desremove" um serviço removido pela moderação.
create policy "prestador edita" on marketplace.services for update to authenticated
  using (provider_id = auth.uid() and status <> 'removido' and marketplace.is_active_user())
  with check (provider_id = auth.uid() and status in ('ativo', 'pausado'));

create policy "participantes veem a solicitação" on marketplace.requests for select to authenticated
  using (auth.uid() in (client_id, provider_id) or (marketplace.is_moderator() and marketplace.conversation_reported(id)));
create policy "participantes veem propostas" on marketplace.proposals for select to authenticated
  using (marketplace.is_participant(request_id));

-- Mensagens: somente os participantes (moderador só com denúncia aberta sobre a conversa).
create policy "participantes leem mensagens" on marketplace.messages for select to authenticated
  using (marketplace.is_participant(request_id) or (marketplace.is_moderator() and marketplace.conversation_reported(request_id)));
create policy "participantes enviam mensagens" on marketplace.messages for insert to authenticated
  with check (sender_id = auth.uid() and marketplace.is_participant(request_id) and marketplace.is_active_user());

create policy "avaliações visíveis" on marketplace.reviews for select using (hidden_at is null or reviewer_id = auth.uid() or marketplace.is_moderator());

create policy "denunciante e moderadores leem" on marketplace.reports for select to authenticated
  using (reporter_id = auth.uid() or marketplace.is_moderator());
create policy "usuários denunciam" on marketplace.reports for insert to authenticated
  with check (reporter_id = auth.uid() and marketplace.is_active_user()
    and (target_type <> 'conversa' or marketplace.is_participant(target_id)));

create policy "moderadores leem o log" on marketplace.moderation_log for select to authenticated using (marketplace.is_moderator());
