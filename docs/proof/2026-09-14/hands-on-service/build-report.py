from pathlib import Path
import json,hashlib
from reportlab.platypus import SimpleDocTemplate,Paragraph,Spacer,Table,TableStyle,Image,PageBreak
from reportlab.lib.styles import getSampleStyleSheet,ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
p=Path(__file__).resolve().parent
checks=json.loads((p/'api-checks.json').read_text())
manifest=json.loads((p/'source-manifest.json').read_text())
assert len(checks['checks'])==21 and all(x['passed'] for x in checks['checks'])
styles=getSampleStyleSheet()
styles.add(ParagraphStyle(name='TitleX',fontName='Helvetica-Bold',fontSize=27,leading=32,textColor=colors.HexColor('#102A43'),spaceAfter=15))
styles.add(ParagraphStyle(name='BodyX',fontName='Helvetica',fontSize=10.4,leading=15,spaceAfter=9,textColor=colors.HexColor('#243B53')))
styles.add(ParagraphStyle(name='SmallX',parent=styles['BodyX'],fontSize=8.5,leading=12))
styles.add(ParagraphStyle(name='HeadX',parent=styles['Heading2'],fontSize=15,leading=19,textColor=colors.HexColor('#102A43'),spaceBefore=12,spaceAfter=9))
def para(s,style='BodyX'):return Paragraph(s,styles[style])
story=[]
def h(s):story.append(para(s,'HeadX'))
def b(s):story.append(para(s))
def shot(name,caption):
 story.append(Image(str(p/name),width=490,height=275.625));story.append(para(caption,'SmallX'));story.append(Spacer(1,12))
def footer(canvas,doc):
 canvas.setStrokeColor(colors.HexColor('#CBD5E1'));canvas.line(42,36,553,36);canvas.setFont('Helvetica',8);canvas.setFillColor(colors.HexColor('#52677B'));canvas.drawString(42,23,'80/20 Launch Audit | Owned-system service sample | 14 September 2026');canvas.drawRightString(553,23,str(doc.page))
story.append(para('Hands-on authorization review','TitleX'))
b('<b>RentDesk isolated application code + Fusion storefront public boundary</b><br/>Deep Audit / Pro service sample. Performed 14 September 2026.')
h('Result')
b('No authorization bypass was confirmed in the scoped checks. Twenty-one isolated API assertions passed, including four real bcrypt sign-ins. Five browser-operated screenshots corroborate selected results. Three live storefront API requests were refused with HTTP 401, and the admin entry opened a sign-in gate.')
b('<b>This is a bounded result, not a production security clearance.</b> RentDesk authorization code ran unchanged against an isolated database through an explicit framework adapter. The deployed Next request pipeline, real customer identities, external report email, walkthrough and later re-audit were not exercised.')
h('What was exercised')
rows=[['Area','Observed result'],['Access control','Anonymous receipt and write requests refused.'],['Two-identity IDOR','A/B own receipts readable; reciprocal foreign IDs returned 404.'],['Write authorization','Owner and granted manager writes persisted; cross-account and ungranted writes refused.'],['RBAC / privilege','Viewer writes, manager owner operations and owner-role invitation refused.'],['Data export','Owner export excluded foreign rows; viewer export returned 403.'],['Live admin boundary','Admin/CRM reads and empty admin POST returned 401.']]
t=Table([[para(c,'SmallX') for c in row] for row in rows],colWidths=[125,365]);t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,0),colors.HexColor('#E7F0F7')),('VALIGN',(0,0),(-1,-1),'TOP'),('BOTTOMPADDING',(0,0),(-1,-1),8),('TOPPADDING',(0,0),(-1,-1),8),('LINEBELOW',(0,0),(-1,-1),.4,colors.HexColor('#CBD5E1'))]));story.append(t)
h('Scope and isolation')
b('Owned source: RentDesk revision <b>'+manifest['commit'][:12]+'</b>. Synthetic accounts A and B, plus viewer and restricted manager roles, used .invalid email addresses and real application-created session cookies. Only isolated records were changed. No production sign-in, provider call, customer data, charge or outbound email was used.')
story.append(PageBreak())
h('Findings and interpretation')
b('<b>F01 - Tenant isolation held for the sampled read and write paths.</b> Owner A read receipt 101 and Owner B read receipt 201. Swapping the IDs returned 404 in both directions. Cross-account building mutations returned a refusal. The persisted state still contained the original foreign-account and restricted-building labels. Evidence: api-checks.json and screenshots 01, 02 and 05.')
b('<b>F02 - Role and property grants were enforced server-side.</b> The viewer was refused a write; the restricted manager could change building 101 but not building 102, and could not rename the account. An owner could not invite another owner through the manager/viewer invitation action. These calls used the actual RentDesk actions and getViewer database/session resolution. Evidence: api-checks.json and screenshots 03 and 04.')
b('<b>F03 - Live anonymous admin access was refused.</b> GET /api/admin/stats, GET /api/crm/contacts and POST /api/admin/blog-posts with an empty JSON body each returned 401. The browser entry /admin redirected to fusiondataco.app/admin and showed a sign-in gate. No authenticated admin authorization claim is made. Evidence: live-storefront-api.json and screenshot 06.')
b('<b>Additional correct behavior:</b> the first fixture used an active plan without a subscription expiry, and the app refused writes. The fixture was corrected to a current trial before the authorization matrix. This was an entitlement guard working correctly, not an application defect.')
b('<b>F04 - Public sign-in displays a development-mode label.</b> Screenshot 06 shows the Clerk form at fusiondataco.app/admin labelled Development mode. This is a directly observed deployment/configuration concern, not proof of an authorization bypass. Verify the intended production Clerk instance and configuration.')
h('Prioritized follow-up plan')
b('<b>P1 - Verify identity deployment and the real Next request boundary.</b> Resolve or explain the public Clerk Development mode label, then repeat the two-identity matrix on an isolated deployment using native pages and Server Action transport. Include cross-origin requests, middleware redirects and session expiry/revocation. Exit condition: the same tenant/role outcomes hold without the cookie/cache/navigation adapter. No code fix is prescribed without a reproduced failure.')
b('<b>P1 - Extend the object coverage.</b> Test lease, tenant, rent, note and receipt mutation paths with the same two identities and a restricted manager. Exit condition: reciprocal foreign IDs and denied buildings remain inaccessible and unchanged. The current sample proves only the named paths, not every resource.')
b('<b>P2 - Complete the service-specific steps with authentic records.</b> Retain buyer-confirmed scope, actual check evidence and the prioritized plan; record the real accepted report delivery. For Pro, perform the 30 minute walkthrough and re-audit after changes. Neither a file hash nor this sample stands in for a call, email receipt or customer service completion.')
story.append(PageBreak())
h('Browser evidence: access and role refusal')
shot('01-owner-a-cross-account-read.png','01. Owner A, signed in through the real RentDesk action, attempts the other account receipt. The actual receipt handler returns 404.')
shot('03-viewer-write-refusal.png','03. Viewer identity calls the actual building-write action. The error is the application action result; the adapter HTTP 200 is not a successful write.')
story.append(PageBreak())
h('Live boundary and reproducibility')
shot('06-live-admin-entry.png','06. Browser entry from fusiondataco.com/admin reaches the Fusion sign-in gate. No production credentials were entered.')
b('<b>Reproduce the isolated run:</b> start isolated-rentdesk.cjs from this evidence directory with existing Audit and RentDesk dependencies, then run check-api.py and check-browser.py. The adapter binds only 127.0.0.1:4318. Stop it after use. It mints only synthetic sessions against PGlite.')
b('<b>Transport substitutions:</b> PGlite replaces Neon; a request-local cookie/header bridge replaces Next request context; redirect becomes an evidence response; cache revalidation is a no-op. Outbound fetch and mail are forbidden. Authentication, bcrypt, HMAC, session database lookup, role/property guards and selected action/route code are the real application source.')
b('<b>Evidence index:</b> api-checks.json (21 assertions and observed results), isolated-http.jsonl (request/results, no passwords or cookies), browser-operations.json (actual browser operations), live-storefront-api.json (three live denials), source-manifest.json (revision and SHA-256 of tested files), screenshots 01-06. The machine-readable evidence belongs with this report.')
b('<b>Residual limits:</b> no claim of full deployment penetration testing, SSO/Clerk coverage, CSRF coverage, session-revocation coverage, a customer sale, accepted external email, completed call or completed re-audit. There were no confirmed vulnerabilities to retest. The listed follow-ups are coverage work, not invented defects.')
SimpleDocTemplate(str(p/'hands-on-authorization-sample.pdf'),pagesize=(595.28,841.89),leftMargin=42,rightMargin=42,topMargin=42,bottomMargin=48).build(story,onFirstPage=footer,onLaterPages=footer)
(p/'README.md').write_text('''# Hands-on authorization service sample\n\nPerformed 14 September 2026. This is authentic browser/API evidence against owned source and an owned public entry point, with explicit isolation boundaries. It is not a customer fulfillment or blanket production clearance.\n\nStart with **hands-on-authorization-sample.pdf**. It contains the scoped findings, interpretation, prioritized follow-up plan, screenshots and residual requirements.\n\n## Evidence\n\n- `api-checks.json`: 21 passing assertions on unchanged RentDesk auth/session/actions/receipt/export code, through an isolated request adapter and PGlite.\n- `browser-operations.json` and screenshots 01-05: real browser sign-in and authorization operations against that adapter.\n- `live-storefront-api.json`: three anonymous live requests refused with 401. Screenshot 06: admin entry reaches the sign-in gate.\n- `source-manifest.json`: exact source revision/hashes and transport substitutions.\n- `isolated-http.jsonl`: raw observed isolated responses, including the initial fixture entitlement refusal. No cookies/passwords logged.\n\nNo authorization vulnerability was confirmed in the sampled paths. The public Fusion sign-in form visibly showed Development mode; verify its production Clerk configuration. Do not describe the framework adapter as the deployed Next application. Native Next transport, other object mutations, session revocation/expiry and SSO remain untested.\n\n## Reproduction\n\nWith existing dependencies, run `node isolated-rentdesk.cjs`, then `python3 check-api.py` and `python3 check-browser.py`. The adapter runs only at 127.0.0.1:4318, creates synthetic .invalid identities and isolated records, and prohibits outbound mail/fetch. The current trial fixture deliberately allows authorized writes.\n\nThe first exploratory run used an active plan without subscription expiry; write refusal was correct. The fixture was then corrected. Raw logs retain both observations; final assertions correspond to the corrected current-trial fixture.\n\n## Unclaimed service obligations\n\nThis sample does not claim real customer scope acceptance, a provider email receipt, a completed 30 minute call, or a completed Pro re-audit. It does not update the paid-order ledger or claim full Deep/Pro launch clearance. Parent review is required before exposing the sample through the existing public demo.\n''')
print(p/'hands-on-authorization-sample.pdf')
