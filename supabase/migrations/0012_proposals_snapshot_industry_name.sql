-- Industries become deletable from the rate-card builder, and the proposal
-- document shows the industry under the client name. Snapshot it like the
-- tier name and services, so deleting an industry can't strip the label off a
-- proposal already sent. Nullable: the industry is optional on a proposal.
alter table public.proposals add column industry_name text;
