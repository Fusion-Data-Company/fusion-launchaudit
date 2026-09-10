/** Durable submission ledger: a failed CRM request remains eligible for replay. */
type SQL = (text: string, params?: unknown[]) => Promise<any[]>;
export async function deliverSubmissions(sql: SQL, onlyId?: string) {
  await sql(`CREATE TABLE IF NOT EXISTS submission_crm_receipts (submission_id text PRIMARY KEY, delivered_at timestamptz NOT NULL DEFAULT now())`);
  const key = process.env.RONIN_API_KEY?.trim();
  if (!key) return { delivered: 0, pendingConfiguration: true };
  const rows = await sql(`SELECT s.* FROM submissions s LEFT JOIN submission_crm_receipts r ON r.submission_id=s.id WHERE r.submission_id IS NULL AND ($1::text IS NULL OR s.id=$1) ORDER BY s.created_at LIMIT 20`, [onlyId ?? null]);
  let delivered = 0;
  for (const row of rows) {
    try {
      const response = await fetch('https://fusiondataco.app/api/ronin/website-leads', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-ronin-key': key },
        body: JSON.stringify({sourceRecordKey:`launch-audit:submission:${row.id}`, company:row.name || row.email, contact:row.name || row.email, email:row.email, source:'launch-audit', notes:`80/20 ${row.type || 'question'} enquiry\n${row.message}`}),
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) continue;
      await sql(`INSERT INTO submission_crm_receipts (submission_id) VALUES ($1) ON CONFLICT DO NOTHING`,[row.id]);
      delivered++;
    } catch { /* Source submission persists; the scheduled replay retries it. */ }
  }
  return {delivered, examined:rows.length, pendingConfiguration:false};
}

export async function deliverScanLeads(sql: SQL, onlyId?: string) {
  await sql(`CREATE TABLE IF NOT EXISTS submission_crm_receipts (submission_id text PRIMARY KEY, delivered_at timestamptz NOT NULL DEFAULT now())`);
  const key=process.env.RONIN_API_KEY?.trim(); if(!key)return {delivered:0,pendingConfiguration:true};
  const exists=await sql("SELECT to_regclass('scan_leads') AS present");if(!exists[0]?.present)return {delivered:0,examined:0};
  const rows=await sql(`SELECT s.* FROM scan_leads s LEFT JOIN submission_crm_receipts r ON r.submission_id=s.id WHERE r.submission_id IS NULL AND ($1::text IS NULL OR s.id=$1) ORDER BY s.created_at LIMIT 20`,[onlyId??null]);
  let delivered=0;
  for(const row of rows){try{
    const response=await fetch('https://fusiondataco.app/api/ronin/website-leads',{method:'POST',headers:{'Content-Type':'application/json','x-ronin-key':key},body:JSON.stringify({sourceRecordKey:`launch-audit:scan:${row.id}`,company:row.email, email:row.email,source:'launch-audit',notes:`Free audit report request. Website: ${row.origin||'not supplied'}. Scan: ${row.scan_id||'not supplied'}.`}),signal:AbortSignal.timeout(5000)});
    if(!response.ok)continue;
    await sql(`INSERT INTO submission_crm_receipts (submission_id) VALUES ($1) ON CONFLICT DO NOTHING`,[row.id]);delivered++;
  }catch{}}
  return {delivered,examined:rows.length};
}
