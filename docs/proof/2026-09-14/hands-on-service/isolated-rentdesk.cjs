// Reproducible service evidence adapter, NOT the deployed Next application.
// Runs unchanged RentDesk auth/session/actions/receipt route against PGlite.
// Framework cookie/cache/navigation adapters are explicit; no provider calls.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {createRequire}=require('node:module'),{AsyncLocalStorage}=require('node:async_hooks');
const {createHash}=require('node:crypto'),{execFileSync}=require('node:child_process');
const esbuild=require('esbuild');
const rent='/Users/robertyeager/fdc-work/rentdesk',out=__dirname,req=createRequire(rent+'/package.json');
const {PGlite}=req('@electric-sql/pglite'),{drizzle}=req('drizzle-orm/pglite');
const {getTableConfig,PgDialect}=req('drizzle-orm/pg-core');
const temp=path.join(out,'.runtime');fs.mkdirSync(temp,{recursive:true});
const file=(name,body)=>{const p=path.join(temp,name);fs.writeFileSync(p,body);return p};
const dbShim=file('db.ts',`export const db=globalThis.__auditDb;export * from '${rent}/db/schema';`);
const headers=file('headers.ts',`export async function cookies(){return globalThis.__auditContext.getStore().jar}export async function headers(){return new Headers(globalThis.__auditContext.getStore().headers)}`);
const navigation=file('navigation.ts',`export function redirect(location){throw Object.assign(new Error('framework redirect'),{location})}`);
const cache=file('cache.ts',`export function revalidatePath(){}`);
const mail=file('mail.ts',`export function mailConfigured(){return false}export async function sendMail(){throw new Error('OUTBOUND FORBIDDEN')}`);
const entry=file('entry.ts',`export * as actions from '${rent}/app/actions';export * as auth from '${rent}/lib/auth';export * as session from '${rent}/lib/session';export * as schema from '${rent}/db/schema';export {GET as receipt} from '${rent}/app/api/receipts/[id]/route';export {GET as accountExport} from '${rent}/app/api/account/export/route';`);
(async()=>{
 const pg=new PGlite();await pg.waitReady;global.__auditDb=drizzle(pg);global.__auditContext=new AsyncLocalStorage();
 const forbidden=()=>{throw new Error('OUTBOUND NETWORK FORBIDDEN IN ISOLATED ADAPTER')};global.fetch=forbidden;
 delete process.env.DATABASE_URL;delete process.env.SMTP_URL;process.env.NODE_ENV='development';process.env.SESSION_SECRET='isolated-hands-on-fixture-secret-not-production';
 await esbuild.build({entryPoints:[entry],outfile:path.join(temp,'app.cjs'),bundle:true,platform:'node',format:'cjs',logLevel:'silent',absWorkingDir:rent,tsconfig:rent+'/tsconfig.json',plugins:[{name:'isolated-boundaries',setup(build){build.onResolve({filter:/.*/},args=>{
  const aliases={'@/db':dbShim,'next/headers':headers,'next/navigation':navigation,'next/cache':cache,'@/lib/mail':mail};if(aliases[args.path])return {path:aliases[args.path]};
  if(!args.path.startsWith('.')&&!args.path.startsWith('/')&&!args.path.startsWith('@/')){if(args.path.startsWith('node:'))return {path:args.path,external:true};return {path:req.resolve(args.path),external:true}}
 })}}]});
 const app=require(path.join(temp,'app.cjs')),dialect=new PgDialect();
 for(const table of Object.values(app.schema)){
  let cfg;try{cfg=getTableConfig(table)}catch{continue}if(!cfg?.columns)continue;
  const cols=cfg.columns.map(c=>{let type=c.getSQLType();let d='';if(c.default!==undefined){if(c.default&&typeof c.default==='object')d=' DEFAULT '+dialect.sqlToQuery(c.default).sql;else if(typeof c.default==='string')d=" DEFAULT '"+c.default.replaceAll("'","''")+"'";else d=' DEFAULT '+String(c.default)}return '"'+c.name+'" '+type+d+(c.primary?' PRIMARY KEY':'')});
  await pg.exec('CREATE TABLE IF NOT EXISTS "'+cfg.name+'" ('+cols.join(',')+')');
 }
 const pw='Isolated-check-2026';const hash=await app.session.hashPassword(pw);
 await global.__auditDb.insert(app.schema.accounts).values([{id:1,name:'ISOLATED Account A',plan:'trial'},{id:2,name:'ISOLATED Account B',plan:'trial'}]);
 await global.__auditDb.insert(app.schema.users).values([{id:1,accountId:1,email:'owner-a@example.invalid',passwordHash:hash,name:'Owner A',role:'owner'},{id:2,accountId:2,email:'owner-b@example.invalid',passwordHash:hash,name:'Owner B',role:'owner'},{id:3,accountId:1,email:'viewer-a@example.invalid',passwordHash:hash,name:'Viewer A',role:'viewer'},{id:4,accountId:1,email:'manager-a@example.invalid',passwordHash:hash,name:'Manager A',role:'manager'}]);
 await global.__auditDb.insert(app.schema.buildings).values([{id:101,accountId:1,address:'Fixture A',label:'A original'},{id:102,accountId:1,address:'Fixture A restricted',label:'restricted original'},{id:201,accountId:2,address:'Fixture B',label:'B original'}]);
 await global.__auditDb.insert(app.schema.propertyAccess).values({userId:4,buildingId:101});
 await global.__auditDb.insert(app.schema.receipts).values([{id:101,accountId:1,imageData:'data:text/plain;base64,'+Buffer.from('ISOLATED RECEIPT ACCOUNT A').toString('base64'),mime:'text/plain'},{id:201,accountId:2,imageData:'data:text/plain;base64,'+Buffer.from('ISOLATED RECEIPT ACCOUNT B').toString('base64'),mime:'text/plain'}]);
 const sourceFiles=['app/actions.ts','lib/auth.ts','lib/session.ts','lib/property-scope.ts','lib/account-export.ts','app/api/receipts/[id]/route.ts','db/schema.ts'];
 fs.writeFileSync(path.join(out,'source-manifest.json'),JSON.stringify({at:new Date().toISOString(),commit:execFileSync('git',['rev-parse','HEAD'],{cwd:rent,encoding:'utf8'}).trim(),files:Object.fromEntries(sourceFiles.map(f=>[f,createHash('sha256').update(fs.readFileSync(path.join(rent,f))).digest('hex')])),boundaries:['PGlite instead of Neon','Next cookies/headers request adapter','redirect becomes HTTP evidence response','revalidatePath no-op','mail/network forbidden'],identities:['Owner A account1','Owner B account2','Viewer A account1','Manager A account1 building101 only']},null,2));
 const html=`<!doctype html><title>RentDesk isolated hands-on evidence</title><style>body{font:16px system-ui;max-width:1050px;margin:40px auto;background:#101726;color:#edf5ff}button,select,input{font:inherit;padding:10px;margin:6px}pre{white-space:pre-wrap;background:#1a2840;padding:20px}h1{font-size:28px}</style><h1>RentDesk: isolated authorization evidence</h1><p>Actual application auth, session, actions and receipt code. Isolated test records. Framework adapter, not deployed Next UI.</p><form id=login><select name=email><option>owner-a@example.invalid</option><option>owner-b@example.invalid</option><option>viewer-a@example.invalid</option><option>manager-a@example.invalid</option></select><input name=password type=password value="${pw}"><button>Sign in through actual RentDesk action</button></form><button onclick="run('/viewer')">Current identity</button><button onclick="run('/receipt/101')">Read account A receipt</button><button onclick="run('/receipt/201')">Read account B receipt</button><button onclick="run('/action',{action:'updateBuilding',args:[101,{label:'A verified write'}]})">Write building A</button><button onclick="run('/action',{action:'updateBuilding',args:[201,{label:'Cross-account attempt'}]})">Attempt write building B</button><button onclick="run('/action',{action:'renameAccount',args:['Privilege attempt']})">Owner-only rename</button><button onclick="run('/state')">Verify persisted state</button><pre id=result>Ready. No production database or providers connected.</pre><script>async function run(url,data){const r=await fetch(url,data?{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)}:{});document.querySelector('#result').textContent=r.status+' '+await r.text()}document.querySelector('#login').onsubmit=async e=>{e.preventDefault();run('/signin',Object.fromEntries(new FormData(e.target)))}</script>`;
 const server=http.createServer(async(request,response)=>{
  const jarMap=new Map((request.headers.cookie||'').split(';').filter(Boolean).map(x=>x.trim().split('=')));
  const context={headers:request.headers,jar:{get:name=>jarMap.has(name)?{value:jarMap.get(name)}:undefined,set:(name,value)=>{jarMap.set(name,value);response.setHeader('Set-Cookie',name+'='+value+'; HttpOnly; SameSite=Lax; Path=/')},delete:name=>{jarMap.delete(name);response.setHeader('Set-Cookie',name+'=; Max-Age=0; Path=/')}}};
  await global.__auditContext.run(context,async()=>{let status=200,result;try{
   if(request.url==='/'){response.setHeader('Content-Type','text/html');response.end(html);return}
   let body='';for await(const chunk of request)body+=chunk;const data=body?JSON.parse(body):{};
   if(request.url==='/signin'){const form=new FormData();form.set('email',data.email);form.set('password',data.password);try{result=await app.actions.signIn(null,form)}catch(e){if(!e.location)throw e;result={redirect:e.location}}}
   else if(request.url==='/viewer'){const v=await app.session.getViewer();result=v?{userId:v.userId,accountId:v.accountId,role:v.role,buildingIds:v.buildingIds}:null;status=v?200:401}
   else if(request.url.startsWith('/receipt/')){const r=await app.receipt(new Request('http://127.0.0.1'+request.url),{params:Promise.resolve({id:request.url.split('/').pop()})});status=r.status;result={body:await r.text(),cache:r.headers.get('cache-control')}}
   else if(request.url==='/export'){const r=await app.accountExport();status=r.status;result=await r.json()}
   else if(request.url==='/action'){if(!['updateBuilding','renameAccount','inviteUser'].includes(data.action))throw new Error('Action outside scoped adapter');if(data.action==='inviteUser'){const form=new FormData();Object.entries(data.form).forEach(([k,v])=>form.set(k,v));result=await app.actions.inviteUser(null,form)}else result=await app.actions[data.action](...data.args)}
   else if(request.url==='/state'){result=(await pg.query('select id,account_id,label from buildings order by id')).rows}
   else{status=404;result={error:'Adapter route not found'}}
  }catch(e){status=e.location?401:500;result=e.location?{redirect:e.location}:{error:e.message}}
  const log={at:new Date().toISOString(),method:request.method,path:request.url,status,result};fs.appendFileSync(path.join(out,'isolated-http.jsonl'),JSON.stringify(log)+'\n');response.statusCode=status;response.setHeader('Content-Type','application/json');response.end(JSON.stringify(result,null,2));});
 });server.listen(4318,'127.0.0.1',()=>console.log('READY http://127.0.0.1:4318 - isolated actual RentDesk authorization code'));
})().catch(e=>{console.error(e);process.exitCode=1});
