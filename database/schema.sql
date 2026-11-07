-- Only service_role may write balances or call financial functions.
-- Currency amounts are integer minor units; wallet currency is USD.
create table public.prank_wallets (
 user_id uuid primary key references auth.users(id), balance_cents bigint not null default 0 check(balance_cents>=0), created_at timestamptz not null default now()
);
create table public.prank_deposits (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id), tx_ref text not null unique,
 ngn_kobo bigint not null check(ngn_kobo>0), usd_cents bigint not null check(usd_cents>0), fx_rate numeric not null check(fx_rate>0), fx_timestamp timestamptz not null,
 state text not null default 'quoted' check(state in ('quoted','pending','credited')), checkout_url text, provider_id text unique,
 expires_at timestamptz not null, created_at timestamptz not null default now(), credited_at timestamptz,
 request_key uuid not null, unique(user_id,request_key)
);
create table public.prank_transfers (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id), request_key uuid not null,
 platform text not null check(platform in ('Binance','Coinbase','Trust Wallet','Bybit')), coin text not null,
 amount numeric not null check(amount>0), network text not null, address text not null, email text not null,
 usd_cents bigint not null check(usd_cents>0), fee_cents bigint not null check(fee_cents>0 and fee_cents=round(usd_cents::numeric/100)), usd_rate numeric not null check(usd_rate>0), price_timestamp timestamptz not null,
 state text not null default 'pending' check(state in ('pending','queued','sent','failed','review')), expires_at timestamptz not null,
 created_at timestamptz not null default now(), confirmed_at timestamptz, unique(user_id,request_key)
);
create table public.prank_ledger (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id), delta_cents bigint not null check(delta_cents<>0),
 kind text not null check(kind in ('deposit','transfer_fee','fee_refund')), reference_id uuid not null, created_at timestamptz not null default now(), unique(kind,reference_id)
);
create table public.prank_email_outbox (
 transfer_id uuid primary key references public.prank_transfers(id), payload jsonb not null,
 state text not null default 'pending' check(state in ('pending','processing','sent','failed','review')), attempts integer not null default 0,
 first_attempt_at timestamptz, next_attempt_at timestamptz not null default now(), lease_id uuid, locked_until timestamptz, provider_id text, last_error text
);
create table public.prank_rate_limits (key text primary key, window_start timestamptz not null, hits integer not null);
create index prank_deposits_user on public.prank_deposits(user_id,created_at desc);
create index prank_transfers_user on public.prank_transfers(user_id,created_at desc);
create index prank_ledger_user on public.prank_ledger(user_id,created_at desc);
create index prank_outbox_due on public.prank_email_outbox(next_attempt_at) where state in ('pending','processing');

do $$ declare t text; begin
 foreach t in array array['prank_wallets','prank_deposits','prank_transfers','prank_ledger','prank_email_outbox','prank_rate_limits'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 execute format('grant all on public.%I to service_role',t);
 end loop;
 foreach t in array array['prank_wallets','prank_deposits','prank_transfers','prank_ledger'] loop
 execute format('grant select on public.%I to authenticated',t);
 execute format('create policy own_rows on public.%I for select to authenticated using ((select auth.uid())=user_id)',t);
 end loop;
end $$;

create function public.prank_credit_deposit(p_ref text,p_provider_id text,p_ngn_kobo bigint) returns jsonb language plpgsql security invoker set search_path='' as $$
declare d public.prank_deposits; b bigint;
begin
 select * into d from public.prank_deposits where tx_ref=p_ref for update;
 if not found then raise exception 'Deposit not found'; end if;
 if p_ngn_kobo<>d.ngn_kobo then raise exception 'Payment amount mismatch'; end if;
 if d.state='credited' then
  if d.provider_id<>p_provider_id then raise exception 'Payment ID mismatch'; end if;
 else
  insert into public.prank_wallets(user_id) values(d.user_id) on conflict do nothing;
  update public.prank_wallets set balance_cents=balance_cents+d.usd_cents where user_id=d.user_id;
  insert into public.prank_ledger(user_id,delta_cents,kind,reference_id) values(d.user_id,d.usd_cents,'deposit',d.id);
  update public.prank_deposits set state='credited',provider_id=p_provider_id,credited_at=now() where id=d.id;
 end if;
 select balance_cents into b from public.prank_wallets where user_id=d.user_id;
 return jsonb_build_object('balance',b::numeric/100,'state','credited','id',d.id);
end $$;

create function public.prank_confirm_transfer(p_user uuid,p_id uuid,p_payload jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare t public.prank_transfers; b bigint;
begin
 select * into t from public.prank_transfers where id=p_id and user_id=p_user for update;
 if not found then raise exception 'Preview not found'; end if;
 if t.state='pending' then
  if t.expires_at<now() then raise exception 'Preview expired. Review again.'; end if;
  insert into public.prank_wallets(user_id) values(p_user) on conflict do nothing;
  update public.prank_wallets set balance_cents=balance_cents-t.fee_cents where user_id=p_user and balance_cents>=t.fee_cents returning balance_cents into b;
  if not found then raise exception 'Insufficient balance. Top up from the dashboard.'; end if;
  insert into public.prank_ledger(user_id,delta_cents,kind,reference_id) values(p_user,-t.fee_cents,'transfer_fee',t.id);
  insert into public.prank_email_outbox(transfer_id,payload) values(t.id,p_payload);
  update public.prank_transfers set state='queued',confirmed_at=now() where id=t.id;
 end if;
 return (select to_jsonb(x) from public.prank_transfers x where id=t.id);
end $$;

create function public.prank_claim_email() returns jsonb language plpgsql security invoker set search_path='' as $$
declare j public.prank_email_outbox;
begin
 select * into j from public.prank_email_outbox where (state='pending' and next_attempt_at<=now()) or (state='processing' and locked_until<now()) order by next_attempt_at limit 1 for update skip locked;
 if not found then return null; end if;
 -- Resend retains idempotency keys for 24 hours. Never automatically retry beyond 20h.
 if j.first_attempt_at<now()-interval '20 hours' then
  update public.prank_email_outbox set state='review',last_error='Idempotency window requires manual review' where transfer_id=j.transfer_id;
  update public.prank_transfers set state='review' where id=j.transfer_id;
  return null;
 end if;
 update public.prank_email_outbox set state='processing',attempts=attempts+1,first_attempt_at=coalesce(first_attempt_at,now()),lease_id=gen_random_uuid(),locked_until=now()+interval '2 minutes' where transfer_id=j.transfer_id returning * into j;
 return to_jsonb(j);
end $$;

create function public.prank_finish_email(p_id uuid,p_lease uuid,p_outcome text,p_provider_id text,p_error text) returns void language plpgsql security invoker set search_path='' as $$
declare j public.prank_email_outbox; t public.prank_transfers;
begin
 select * into j from public.prank_email_outbox where transfer_id=p_id and lease_id=p_lease and state='processing' for update;
 if not found then return; end if;
 if p_outcome='sent' then
  update public.prank_email_outbox set state='sent',provider_id=p_provider_id,locked_until=null,last_error=null where transfer_id=p_id;
  update public.prank_transfers set state='sent' where id=p_id;
 elsif p_outcome='failed' and j.attempts=1 then
  -- Refund only an unambiguous rejection on the first attempt. Later errors may follow a previously accepted timeout.
  select * into t from public.prank_transfers where id=p_id for update;
  update public.prank_wallets set balance_cents=balance_cents+t.fee_cents where user_id=t.user_id;
  insert into public.prank_ledger(user_id,delta_cents,kind,reference_id) values(t.user_id,t.fee_cents,'fee_refund',t.id);
  update public.prank_email_outbox set state='failed',last_error=p_error,locked_until=null where transfer_id=p_id;
  update public.prank_transfers set state='failed' where id=p_id;
 else
  update public.prank_email_outbox set state='pending',next_attempt_at=now()+make_interval(secs=>least(3600,30*power(2,least(attempts,6)))::integer),locked_until=null,last_error=p_error where transfer_id=p_id;
 end if;
end $$;

create function public.prank_rate_limit(p_key text,p_limit integer,p_seconds integer) returns boolean language plpgsql security invoker set search_path='' as $$
declare h integer;
begin
 insert into public.prank_rate_limits(key,window_start,hits) values(p_key,now(),1)
 on conflict(key) do update set hits=case when prank_rate_limits.window_start<now()-make_interval(secs=>p_seconds) then 1 else prank_rate_limits.hits+1 end,window_start=case when prank_rate_limits.window_start<now()-make_interval(secs=>p_seconds) then now() else prank_rate_limits.window_start end returning hits into h;
 return h<=p_limit;
end $$;

revoke all on function public.prank_credit_deposit(text,text,bigint),public.prank_confirm_transfer(uuid,uuid,jsonb),public.prank_claim_email(),public.prank_finish_email(uuid,uuid,text,text,text),public.prank_rate_limit(text,integer,integer) from public,anon,authenticated;
grant execute on function public.prank_credit_deposit(text,text,bigint),public.prank_confirm_transfer(uuid,uuid,jsonb),public.prank_claim_email(),public.prank_finish_email(uuid,uuid,text,text,text),public.prank_rate_limit(text,integer,integer) to service_role;
