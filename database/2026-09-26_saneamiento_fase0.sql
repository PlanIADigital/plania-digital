-- ============================================================
--  PlanIA Digital — Saneamiento Fase 0 (seguridad de base de datos)
--  Aplicado directamente en Supabase el 26 sep 2026.
--  Este archivo es el REGISTRO de lo aplicado, para poder
--  reconstruirlo o auditarlo. No volver a correrlo sin revisar.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Cambio de CCT: fecha del último cambio + historial
-- ------------------------------------------------------------
alter table public.users
  add column if not exists cct_cambiado_en timestamptz;

create table if not exists public.historial_cambios_cct (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  campo text not null check (campo in ('cct_primary', 'cct_secondary')),
  cct_anterior text,
  cct_nuevo text,
  cambiado_en timestamptz not null default now()
);
alter table public.historial_cambios_cct enable row level security;
-- Sin políticas: cerrada al navegador; solo servidor y panel de Supabase.

-- ------------------------------------------------------------
-- 2) PORTERO de la tabla users
--    Bloquea desde el NAVEGADOR (roles anon/authenticated) cambios a
--    columnas sensibles. El servidor (service_role) y el panel de
--    Supabase pasan libres. CCT: primera vez libre (onboarding);
--    después, 30 días entre cambios y clave validada en el catálogo.
-- ------------------------------------------------------------
create or replace function public.proteger_columnas_users()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  quien text := coalesce(
    nullif(current_setting('request.jwt.claims', true), '')::json ->> 'role',
    ''
  );
begin
  if quien not in ('authenticated', 'anon') then
    return new;
  end if;

  if new.id                 is distinct from old.id
  or new.auth_uid           is distinct from old.auth_uid
  or new.email              is distinct from old.email
  or new.role               is distinct from old.role
  or new.is_super_admin     is distinct from old.is_super_admin
  or new.membership_status  is distinct from old.membership_status
  or new.fecha_pago         is distinct from old.fecha_pago
  or new.es_fundadora       is distinct from old.es_fundadora
  or new.trial_ends_at      is distinct from old.trial_ends_at
  or new.membership_ends_at is distinct from old.membership_ends_at
  or new.cancelled_at       is distinct from old.cancelled_at
  or new.created_at         is distinct from old.created_at
  or new.cct_cambiado_en    is distinct from old.cct_cambiado_en
  then
    raise exception 'No autorizado: este dato solo puede modificarse desde el servidor.'
      using errcode = '42501';
  end if;

  if new.cct_primary is distinct from old.cct_primary and old.cct_primary is not null then
    if old.cct_cambiado_en is not null and old.cct_cambiado_en > now() - interval '30 days' then
      raise exception 'Ya cambiaste tu CCT recientemente. Podrás cambiarlo de nuevo 30 días después de tu último cambio; si lo necesitas antes, escríbenos a soporte.'
        using errcode = '42501';
    end if;
    if new.cct_primary is null
       or not exists (select 1 from cct_catalogo_oficial where upper(cv_cct) = upper(new.cct_primary)) then
      raise exception 'La clave de CCT no existe en el catálogo oficial.'
        using errcode = '22023';
    end if;
    new.cct_cambiado_en := now();
    insert into historial_cambios_cct (user_id, campo, cct_anterior, cct_nuevo)
      values (old.id, 'cct_primary', old.cct_primary, new.cct_primary);
  end if;

  if new.cct_secondary is distinct from old.cct_secondary and old.cct_secondary is not null then
    if new.cct_secondary is not null then
      if old.cct_cambiado_en is not null and old.cct_cambiado_en > now() - interval '30 days' then
        raise exception 'Ya cambiaste tu CCT recientemente. Podrás cambiarlo de nuevo 30 días después de tu último cambio; si lo necesitas antes, escríbenos a soporte.'
          using errcode = '42501';
      end if;
      if not exists (select 1 from cct_catalogo_oficial where upper(cv_cct) = upper(new.cct_secondary)) then
        raise exception 'La clave de CCT no existe en el catálogo oficial.'
          using errcode = '22023';
      end if;
      new.cct_cambiado_en := now();
    end if;
    insert into historial_cambios_cct (user_id, campo, cct_anterior, cct_nuevo)
      values (old.id, 'cct_secondary', old.cct_secondary, new.cct_secondary);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_proteger_columnas_users on public.users;
create trigger trg_proteger_columnas_users
  before update on public.users
  for each row execute function public.proteger_columnas_users();

-- Freno de emergencia (desactiva el portero sin perder nada):
-- drop trigger if exists trg_proteger_columnas_users on public.users;

-- ------------------------------------------------------------
-- 3) Políticas demasiado abiertas que se retiraron
-- ------------------------------------------------------------
drop policy if exists "founder_select_all"  on public.interaction_logs;
drop policy if exists "service_role_insert" on public.interaction_logs;
drop policy if exists "cct_valores_comunitarios: insert para autenticados" on public.cct_valores_comunitarios;

-- ------------------------------------------------------------
-- 4) Limpieza única de textos crudos (ya no se guardan desde el código)
-- ------------------------------------------------------------
update public.users set diagnostico_texto = null where diagnostico_texto is not null;
update public.programa_analitico set contenido_extraido = null where contenido_extraido is not null;