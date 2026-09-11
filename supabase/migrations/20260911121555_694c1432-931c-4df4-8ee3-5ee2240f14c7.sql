select cron.schedule(
  'reporting-extract-nightly',
  '45 6 * * *',
  $$
  select net.http_post(
    url:='https://project--554c2bdf-99c5-41e7-b90a-256ba7f9215b.lovable.app/api/public/hooks/reporting-extract',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer 85822b7016c4400902eaa786db84c598954d5a91df474e0a"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);