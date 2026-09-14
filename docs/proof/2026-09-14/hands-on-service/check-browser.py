import subprocess,time,pathlib,json
out=pathlib.Path(__file__).resolve().parent
B='/Users/robertyeager/.codex/skills/gstack/browse/dist/browse'
log=[]
def run(*args):
 r=subprocess.run([B,*args],text=True,capture_output=True,check=True);log.append({'command':list(args),'output':r.stdout});return r.stdout
def click(text):run('click','button:has-text("'+text+'")');time.sleep(.4)
def login(who):run('select','select[name=email]',who+'@example.invalid');click('Sign in through actual RentDesk action')
def shot(name):run('screenshot','--viewport',str(out/name));log.append({'result':run('js','document.querySelector("#result").textContent')})
run('goto','http://127.0.0.1:4318');run('snapshot','-i')
login('owner-a');click('Read account B receipt');shot('01-owner-a-cross-account-read.png')
login('owner-b');click('Read account A receipt');shot('02-owner-b-cross-account-read.png')
login('viewer-a');click('Write building A');shot('03-viewer-write-refusal.png')
login('manager-a');click('Owner-only rename');shot('04-manager-owner-action-refusal.png')
login('owner-a');click('Write building A');click('Verify persisted state');shot('05-owned-write-persisted.png')
(out/'browser-operations.json').write_text(json.dumps(log,indent=2))
print('Five browser-operated evidence screenshots saved.')
