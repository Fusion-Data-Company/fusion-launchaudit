/* /order/success — polls /api/order-status for the paid audit (external for CSP script-src 'self') */
(function(){
  var sid=new URLSearchParams(window.location.search).get('session_id')||'';
  var grade=document.getElementById('grade'), report=document.getElementById('report'), meta=document.getElementById('meta');
  var stGraded=document.getElementById('st-graded'), stReport=document.getElementById('st-report');
  function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  var sevColor={critical:'#f0696a',high:'#f0696a',medium:'#e0b23c',low:'#9aa0b4'};
  if(!/^cs_[A-Za-z0-9_]{8,200}$/.test(sid)){ grade.innerHTML='<div class="loading err">Missing or invalid session id. If you just paid, check the link in your Stripe receipt or contact us.</div>'; return; }

  function renderGrade(g){
    var items=(g.findings||[]).map(function(f){return '<li class="gf"><span class="gf-sev" style="color:'+sevColor[f.severity]+'">'+esc(f.severity)+'</span><span class="gf-txt"><b>'+esc(f.title)+'</b><span>'+esc(f.detail)+'</span></span></li>';}).join('');
    grade.innerHTML='<div class="grade-card"><div class="grade-score band-'+esc(g.band)+'"><span class="gs-num">'+g.score+'</span><span class="gs-den">/ 100</span><span class="gs-cap">surface grade</span></div>'
      +'<div class="grade-body"><p class="grade-sum">'+esc(g.summary)+'</p>'
      +(items?'<ul class="grade-list">'+items+'</ul>':'<p class="grade-clean">No surface issues found — nice.</p>')
      +'<p class="muted" style="margin-top:14px">This is the instant, URL-only surface scan (' + (g.passed||0) + ' checks passed). It is a subset of the full audit — the deep checks (broken access control, admin/RBAC, write-authz, a11y, performance) are what the emailed report covers.</p></div></div>';
  }

  var tries=0, delay=3000;
  async function poll(){
    tries++;
    try{
      var r=await fetch('/api/order-status?session_id='+encodeURIComponent(sid),{cache:'no-store'});
      var d=await r.json();
      if(!d||!d.ok){ grade.innerHTML='<div class="loading err">'+esc((d&&d.error)||'Could not load your order.')+'</div>'; return; }
      if(d.status==='pending'){
        if(tries<40){ setTimeout(poll, delay); return; }
        grade.innerHTML='<div class="loading">Your payment went through, but confirmation is still syncing. Your grade and report will arrive by email — no action needed. You can also reload this page later.</div>';
        return;
      }
      meta.textContent='Order for '+d.target_url+' · '+(d.tier==='pro'?'Pro':d.tier==='single'?'Single Run':'Standard')+' tier';
      if(d.tier==='single'){var pr=document.getElementById('promise');if(pr)pr.textContent='Single Run: your instant grade below is the deliverable. Upgrade to a deep audit any time from the order page.';if(stReport)stReport.hidden=true;}
      if(d.grade){ stGraded.className='done'; renderGrade(d.grade); }
      else if(d.grade_error){ stGraded.className='now'; grade.innerHTML='<div class="loading">The instant scan could not reach '+esc(d.target_url)+' ('+esc(d.grade_error)+'). We will grade it manually as part of your report.</div>'; }
      else { stGraded.className='now'; grade.innerHTML='<div class="loading">Running your instant surface grade…</div>'; if(tries<40) setTimeout(poll, delay); }
      if(d.tier==='single'){
        report.hidden=false;
        report.innerHTML=d.grade?'<p class="grade-sum" style="margin:0 0 6px">Single Run complete.</p><p class="muted" style="margin:0">This grade is your deliverable. Want the deep audit in a real browser (authz, admin/RBAC, a11y, perf) with an evidence report? <a href="/#order">Order a Hosted Deep Audit</a>.</p>':'<p class="muted" style="margin:0">Your grade will appear above as soon as the scan finishes.</p>';
      } else if(d.status==='delivered' && d.report_url){
        stReport.className='done';
        report.hidden=false;
        report.innerHTML='<p class="grade-sum">Your full evidence report is ready.</p><a class="btn" href="'+esc(d.report_url)+'" target="_blank" rel="noopener">Open report →</a>';
      } else {
        stReport.className=d.grade?'now':'';
        report.hidden=false;
        report.innerHTML='<p class="grade-sum" style="margin:0 0 6px">Deep audit: queued for our team.</p><p class="muted" style="margin:0">Your full evidence report will be emailed within 2 business days. Nothing else to do — if you ordered Pro and want authenticated checks, reply to your receipt email with a test login.</p>';
      }
    }catch(err){ if(tries<40) setTimeout(poll, delay); else grade.innerHTML='<div class="loading err">Could not load your order — reload to try again.</div>'; }
  }
  poll();
})();
