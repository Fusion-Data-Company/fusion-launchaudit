"""Isolated actual-code requests. Synthetic identities only; no provider calls."""
import urllib.request,urllib.error,http.cookiejar,json,pathlib,datetime
out=pathlib.Path(__file__).resolve().parent
results=[]
def client(): return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
def call(c,p,data=None):
 r=urllib.request.Request('http://127.0.0.1:4318'+p,data=json.dumps(data).encode() if data is not None else None,headers={'Content-Type':'application/json'})
 try:
  response=c.open(r);return response.status,json.load(response)
 except urllib.error.HTTPError as e:return e.code,json.load(e)
def check(name,actual,predicate):
 passed=predicate(actual);results.append({'check':name,'passed':passed,'observed':actual})
 (out/'api-checks.json').write_text(json.dumps({'at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':'isolated actual RentDesk application code; no production identities','checks':results},indent=2))
 print(name,'PASS' if passed else 'FAIL')
 if not passed: raise AssertionError((name,actual))
A=client();check('Anonymous receipt refused',call(A,'/receipt/101'),lambda x:x[0]==401)
check('Anonymous write refused',call(A,'/action',{'action':'updateBuilding','args':[101,{'label':'anonymous attempt'}]}),lambda x:x[0]==401)
people={}
for identity in ['owner-a','owner-b','viewer-a','manager-a']:
 c=client();check(identity+' real bcrypt sign-in',call(c,'/signin',{'email':identity+'@example.invalid','password':'Isolated-check-2026'}),lambda x:x[1].get('redirect')=='/dashboard');people[identity]=c
A,B,V,M=[people[x] for x in ['owner-a','owner-b','viewer-a','manager-a']]
check('A own receipt private/no-store',call(A,'/receipt/101'),lambda x:x[0]==200 and x[1]['body']=='ISOLATED RECEIPT ACCOUNT A' and x[1]['cache']=='private, no-store')
check('A cannot read B receipt IDOR',call(A,'/receipt/201'),lambda x:x[0]==404)
check('B own receipt readable',call(B,'/receipt/201'),lambda x:x[0]==200 and x[1]['body']=='ISOLATED RECEIPT ACCOUNT B')
check('B cannot read A receipt IDOR',call(B,'/receipt/101'),lambda x:x[0]==404)
def write(c,id,label):return call(c,'/action',{'action':'updateBuilding','args':[id,{'label':label}]})
check('A own building write accepted',write(A,101,'API verified A write'),lambda x:x[1].get('ok')==True)
check('A cross-account write refused',write(A,201,'IDOR attempt'),lambda x:bool(x[1].get('error')))
check('B cross-account write refused',write(B,101,'IDOR attempt'),lambda x:bool(x[1].get('error')))
check('Viewer write refused',write(V,101,'Viewer attempt'),lambda x:'read-only' in x[1].get('error',''))
check('Manager granted building write accepted',write(M,101,'Manager authorized write'),lambda x:x[1].get('ok')==True)
check('Manager ungranted same-account building refused',write(M,102,'Privilege attempt'),lambda x:bool(x[1].get('error')))
check('Manager owner-only operation refused',call(M,'/action',{'action':'renameAccount','args':['Privilege attempt']}),lambda x:'Only the account owner' in x[1].get('error',''))
check('Viewer owner export refused',call(V,'/export'),lambda x:x[0]==403)
check('Owner cannot invite owner privilege escalation',call(A,'/action',{'action':'inviteUser','form':{'email':'elevated@example.invalid','password':'Isolated-check-2026','role':'owner','name':'Fixture'}}),lambda x:'manager or read-only' in x[1].get('error',''))
check('Foreign/restricted building state unchanged',call(A,'/state'),lambda x:x[1][1]['label']=='restricted original' and x[1][2]['label']=='B original')
check('Owner export excludes foreign account',call(A,'/export'),lambda x:x[0]==200 and all(r['account_id']==1 for r in x[1]['buildings']))
