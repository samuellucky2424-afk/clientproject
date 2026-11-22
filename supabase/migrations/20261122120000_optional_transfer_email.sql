alter table public.prank_transfers drop constraint prank_transfers_state_check,
 add constraint prank_transfers_state_check check(state in ('pending','queued','sent','failed','review','completed'));

create or replace function public.prank_confirm_transfer(p_user uuid,p_id uuid,p_payload jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
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
  if t.email <> '' then
   insert into public.prank_email_outbox(transfer_id,payload) values(t.id,p_payload);
  end if;
  update public.prank_transfers set state=case when t.email = '' then 'completed' else 'queued' end,confirmed_at=now() where id=t.id;
 end if;
 return (select to_jsonb(x) from public.prank_transfers x where id=t.id);
end $$;
