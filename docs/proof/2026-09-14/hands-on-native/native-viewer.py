import json,subprocess,pathlib
p=pathlib.Path('/Volumes/FUSION OS/.fusion-cache/estate-offload-20260914/launchaudit-recovery-current/docs/proof/2026-09-14/hands-on-native')
B='/Users/robertyeager/.codex/skills/gstack/browse/dist/browse';wait=['js','new Promise(r=>setTimeout(r,1500))']
def run(user,extra,name):
 s=[['goto','http://127.0.0.1:4319/login'],['fill','input[type=email]',user],['fill','input[type=password]','Native-proof-2026'],['click','button[type=submit]'],wait,['click','button:text-is("Skip")']]+extra
 r=subprocess.run([B,'chain'],input=json.dumps(s),capture_output=True,text=True);print(r.stdout,r.stderr);(p/name).write_text(r.stdout+r.stderr)
run('native-viewer@example.invalid', [['js',"window.results=null;Promise.all([fetch('/settings',{method:'POST',headers:{'Next-Action':'40fa8bd2d02b16fbe96155554d8ed8e157ca8e613b','Content-Type':'text/plain'},body:JSON.stringify(['FORBIDDEN VIEWER CHANGE'])}),fetch('/api/account/export')].map(async r=>{r=await r;return {status:r.status,body:(await r.text()).slice(0,500)}})).then(r=>window.results=r);'started'"],wait,['js','JSON.stringify(window.results)']], 'native-viewer-denial.log')
