-- Apply after database/features.sql. Existing receipts retain the original 1% fee.
alter table public.prank_features add column fee_percent numeric(5,2) not null default 1 check (fee_percent between 0.01 and 100);
alter table public.prank_transfers add column fee_percent numeric(5,2) not null default 1 check (fee_percent between 0.01 and 100);
alter table public.prank_transfers drop constraint prank_transfers_check;
alter table public.prank_transfers add constraint prank_transfers_fee_matches_percent check (fee_cents > 0 and fee_cents = round(usd_cents::numeric * fee_percent / 100));
