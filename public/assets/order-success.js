/* /order/success — polls /api/order-status for the paid audit (external for CSP script-src 'self') */
(function(){
  var sid=new URLSearchParams(window.location.search).get('session_id')||'';
  var grade=document.getElementById('grade'), report=document.getElementById('report'), meta=document.getElementById('meta');
  var stGraded=document.getElementById('st-graded'), stReport=document.getElementById('st-report');
  function lhv(v){return v==null?'n/a':v+'/100';}
  function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  var sevColor={critical:'#f0696a',high:'#f0696a',medium:'#e0b23c',low:'#9aa0b4'};
  if(!/^cs_[A-Za-z0-9_]{8,200}$/.test(sid)){ grade.innerHTML='<div class="loading err">Missing or invalid session id. If you just paid, check the link in your Stripe receipt or contact us.</div>'; return; }

  function renderGrade(g){
    var items=(g.findings||[]).map(function(f){return '<li class="gf"><span class="gf-sev" style="color:'+sevColor[f.severity]+'">'+esc(f.severity)+'</span><span class="gf-txt"><b>'+esc(f.title)+'</b><span>'+esc(f.detail)+'</span></span></li>';}).join('');
    var pages=g.pages_scanned||1;
    grade.innerHTML='<div class="grade-card"><div class="grade-score band-'+esc(g.band)+'"><span class="gs-num">'+g.score+'</span><span class="gs-den">/ 100</span><span class="gs-cap">readiness</span></div>'
      +'<div class="grade-body"><p class="grade-sum">'+esc(g.summary)+'</p>'
      +(items?'<ul class="grade-list">'+items+'</ul>':'<p class="grade-clean">No URL-level issues found. Nice.</p>')
      +(g.lighthouse?'<p class="muted" style="margin-top:12px"><b>Lighthouse (mobile):</b> performance '+lhv(g.lighthouse.performance)+' · accessibility '+lhv(g.lighthouse.accessibility)+' · best practices '+lhv(g.lighthouse.best_practices)+' · SEO '+lhv(g.lighthouse.seo)+(g.lighthouse.lcp_ms!=null?' · LCP '+(Math.round(g.lighthouse.lcp_ms/100)/10)+'s':'')+(g.lighthouse.cls!=null?' · CLS '+Number(g.lighthouse.cls).toFixed(2):'')+'</p>':'')
      +'<p class="muted" style="margin-top:14px">'+(g.kind==='deep'?'Site-wide URL-only audit: '+pages+' page'+(pages===1?'':'s')+' scanned, '+(g.checks_run||0)+' check groups run, '+(g.passed||0)+' passed. No browser, no login, no code. Broken access control, admin/RBAC, write-authz and authenticated flows need the deep audit, which is free in your own agent.':'URL-only surface scan: '+(g.passed||0)+' checks passed. Broken access control, admin/RBAC, write-authz and authenticated flows need the deep audit, which is free in your own agent.')+'</p></div></div>';
  }

  function tierName(t){return t==='pro'?'Pro':t==='single'?'Single Run':'Deep Audit';}

  var tries=0, delay=3000;
  async function poll(){
    tries++;
    try{
      var r=await fetch('/api/order-status?session_id='+encodeURIComponent(sid),{cache:'no-store'});
      var d=await r.json();
      if(!d||!d.ok){ grade.innerHTML='<div class="loading err">'+esc((d&&d.error)||'Could not load your order.')+'</div>'; return; }
      if(d.status==='pending'){
        if(tries<40){ setTimeout(poll, delay); return; }
        grade.innerHTML='<div class="loading">Your payment went through, but the order has not synced yet. Keep this link and reload it in a few minutes. If it is still empty after an hour, use the contact form with your Stripe receipt number.</div>';
        return;
      }
      meta.textContent='Order for '+d.target_url+' · '+tierName(d.tier)+' · order link: '+window.location.href;
      if(d.status==='blocked'){
        stGraded.className='now'; if(stReport)stReport.hidden=true;
        grade.innerHTML='<div class="loading err">We could not audit '+esc(d.target_url)+'. '+esc(d.blocked||d.grade_error||'The site did not answer as a normal page.')+'<br><br>That is a refund, not a report. '+(d.refunded?'Your payment has been refunded in full; allow up to 5 business days for it to show on your card.':'Per the <a href="/refunds" style="color:inherit">refund policy</a> this run is refunded in full. If it has not shown on your card within 5 business days, reply to your Stripe receipt or use the contact form with this order link.')+'</div>';
        report.hidden=false;
        report.innerHTML='<p class="muted" style="margin:0">Common causes: a bot wall or challenge page, a login wall on the home page, or the site being down. Once the public pages answer normally, order again and it will run.</p>';
        return;
      }
      if(d.status==='refunded'||d.status==='disputed'){
        stGraded.className=''; if(stReport)stReport.hidden=true;
        grade.innerHTML='<div class="loading">This order was '+esc(d.status)+'. The report is no longer available on this link.</div>';
        return;
      }
      if(d.grade){ stGraded.className='done'; if(stReport)stReport.className='done'; renderGrade(d.grade); }
      else if(d.grade_error){ stGraded.className='now'; grade.innerHTML='<div class="loading err">The scan could not finish for '+esc(d.target_url)+' ('+esc(d.grade_error)+'). Reload in a few minutes; if it still fails, use the contact form with this order link and it is refunded.</div>'; }
      else { stGraded.className='now'; grade.innerHTML='<div class="loading">Running your site audit (30 to 60 seconds)...</div>'; if(tries<40) setTimeout(poll, delay); }
      if(d.tier==='single'){
        report.hidden=false;
        report.innerHTML=d.grade?'<p class="grade-sum" style="margin:0 0 6px">Single Run complete.</p><p class="muted" style="margin:0">This page is your deliverable and the link keeps working. Want the deep audit in a real browser (authz, admin/RBAC, a11y, perf) with an evidence report? It is free in <a href="/#connect">your own agent</a>, or <a href="/#contact">ask for a quote</a> and we do it by hand.</p>':'<p class="muted" style="margin:0">Your grade will appear above as soon as the scan finishes.</p>';
      } else if(d.status==='delivered' && d.report_url){
        if(stReport){stReport.hidden=false;stReport.className='done';}
        report.hidden=false;
        report.innerHTML='<p class="grade-sum">Your full evidence report is ready.</p><a class="btn" href="'+esc(d.report_url)+'" target="_blank" rel="noopener">Open report</a>';
      } else {
        if(stReport){stReport.hidden=false;stReport.className=d.grade?'now':'';}
        report.hidden=false;
        report.innerHTML='<p class="grade-sum" style="margin:0 0 6px">Deep audit: done by hand.</p><p class="muted" style="margin:0">We will contact you at the order email to confirm scope and, for Pro, a test login. Your URL audit above is available now. Questions: rob@fusiondataco.com.</p>';
      }
    }catch(err){ if(tries<40) setTimeout(poll, delay); else grade.innerHTML='<div class="loading err">Could not load your order. Reload to try again.</div>'; }
  }
  poll();
})();
