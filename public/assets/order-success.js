/* /order/success — THE DELIVERABLE.
 *
 * Polls /api/order-status for the paid audit and renders it at the level the
 * buyer paid for: a drawn score gauge, severity chips carrying a colour AND a
 * glow, an elite findings table with tabular-nums, and designed states for
 * every way this can end — still running, blocked, refunded, clean, failed.
 * The polling contract and the API shape are untouched; only the rendering is.
 * (External file, because script-src is 'self'.)
 */
(function(){
  var sid=new URLSearchParams(window.location.search).get('session_id')||'';
  var grade=document.getElementById('grade'), report=document.getElementById('report'), meta=document.getElementById('meta');
  var stGraded=document.getElementById('st-graded'), stReport=document.getElementById('st-report');
  var chipEl=document.getElementById('order-chip');
  function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  function lhv(v){return v==null?'&mdash;':v;}
  var SEV={critical:['chip-crit','Critical','la-row-crit',0],high:['chip-bad','High','la-row-high',1],
           medium:['chip-warn','Medium','la-row-med',2],low:['chip-info','Low','la-row-low',3]};

  function setChip(cls,text){ if(chipEl){ chipEl.className='chip '+cls+' sev-chip'; chipEl.textContent=text; } }
  /* The headline is part of the report. A page that still reads "your Single
     Run is underway" over a refund notice is a second thing gone wrong. */
  function setHead(title, lead){
    var h=document.querySelector('h1'), l=document.querySelector('.lead'), pr=document.getElementById('promise');
    if(h) h.textContent=title;
    if(l) l.innerHTML=lead;
    if(pr && /refund/i.test(lead)) pr.hidden=true;
  }
  function refresh(){ if(window.eliteMotionRefresh) window.eliteMotionRefresh(); }

  function gauge(score,band){ return window.eliteGauge?window.eliteGauge(score,band):''; }

  function counts(list){
    var c={critical:0,high:0,medium:0,low:0};
    (list||[]).forEach(function(f){ if(c[f.severity]!=null) c[f.severity]++; });
    return c;
  }
  function chips(c){
    return ['critical','high','medium','low'].filter(function(k){return c[k]>0;}).map(function(k){
      return '<span class="chip '+SEV[k][0]+' sev-chip">'+c[k]+' '+SEV[k][1]+'</span>';
    }).join('');
  }
  function sevbar(c){
    var t=c.critical+c.high+c.medium+c.low; if(!t) return '';
    function w(n){return (n/t*100).toFixed(1)+'%';}
    return '<div class="la-sevbar" aria-hidden="true"><i class="s-crit" style="width:'+w(c.critical)+'"></i>'
      +'<i class="s-high" style="width:'+w(c.high)+'"></i><i class="s-med" style="width:'+w(c.medium)+'"></i>'
      +'<i class="s-low" style="width:'+w(c.low)+'"></i></div>';
  }
  function table(list){
    var rows=(list||[]).slice().sort(function(a,b){
      return ((SEV[a.severity]||SEV.low)[3])-((SEV[b.severity]||SEV.low)[3]);
    }).map(function(f){
      var m=SEV[f.severity]||SEV.low;
      return '<tr class="'+m[2]+'"><td><span class="chip '+m[0]+' sev-chip">'+m[1]+'</span></td>'
        +'<td class="la-cat">'+esc(f.category||'')+'</td>'
        +'<td class="la-what"><b>'+esc(f.title)+'</b><span>'+esc(f.detail)+'</span></td></tr>';
    }).join('');
    if(!rows) return '';
    return '<div class="elite-table-wrap"><table class="elite-table is-compact">'
      +'<thead><tr><th scope="col">Severity</th><th scope="col">Category</th>'
      +'<th scope="col">What we found, and why it costs you</th></tr></thead>'
      +'<tbody>'+rows+'</tbody></table></div>';
  }

  /* A designed empty state. "No data" tells an operator nothing about whether
     the query is wrong, the filter is wrong, or the work is done. */
  function clean(){
    return '<div class="elite-empty" style="padding:36px 24px;">'
      +'<div class="elite-empty__mark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v5c0 4.4-3 8.3-7 9.5C8 19.3 5 15.4 5 11V6z"/><path d="M9 12l2 2 4-4"/></svg></div>'
      +'<h4 style="font-family:var(--font-display);font-size:20px;margin:0;color:var(--ink)">Nothing to fix at the URL level.</h4>'
      +'<p style="max-width:52ch;margin:0;color:var(--ink-soft);font-size:14.5px;line-height:1.6">Every check this run could answer from outside your app came back clean. That is the honest limit of a URL-only audit: it says nothing yet about broken access control, your admin API, or what your server hands a stranger who asks directly.</p>'
      +'<a class="btn" href="/#connect">Run the deep audit in your own agent &rarr;</a></div>';
  }

  function errBlock(title, body, extra){
    return '<div class="la-error">'
      +'<div class="la-error__mark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16v.5"/></svg></div>'
      +'<h4>'+title+'</h4><p>'+body+'</p>'+(extra||'')+'</div>';
  }

  /* Loading is a skeleton, not a spinner: text skeletons are text-shaped, and
     the last line is short, because a stack of equal bars does not read as
     loading text — it reads as a broken table. */
  function loading(msg){
    return '<div class="card"><div style="display:flex;gap:26px;align-items:center;flex-wrap:wrap">'
      +'<div class="skeleton" style="width:168px;height:168px;border-radius:50%;flex:none"></div>'
      +'<div style="flex:1;min-width:260px;display:grid;gap:11px">'
      +'<div class="skeleton skeleton-line" style="height:15px"></div>'
      +'<div class="skeleton skeleton-line" style="height:12px"></div>'
      +'<div class="skeleton skeleton-line" style="height:12px"></div>'
      +'<div class="skeleton skeleton-line" style="height:12px"></div></div></div>'
      +'<div class="loadbar" style="margin-top:20px"></div>'
      +'<p style="margin:14px 0 0;font-size:13.5px;color:var(--ink-mut)">'+msg+'</p></div>';
  }

  if(!/^cs_[A-Za-z0-9_]{8,200}$/.test(sid)){
    setChip('chip-warn','No order id');
    grade.innerHTML=errBlock('This link has no order on it.',
      'The address is missing the session id Stripe adds after checkout. Open the link in your Stripe receipt, or send us the receipt number and we will find the order.',
      '<a class="btn ghost" href="/#contact">Contact us with your receipt &rarr;</a>');
    refresh(); return;
  }

  function renderGrade(g){
    var c=counts(g.findings);
    var pages=g.pages_scanned||1;
    var note = g.kind==='deep'
      ? 'Site-wide URL-only audit: <span class="tabular">'+pages+'</span> page'+(pages===1?'':'s')+' scanned, <span class="tabular">'+(g.checks_run||0)+'</span> check groups run, <span class="tabular">'+(g.passed||0)+'</span> passed. No browser, no login, no code left your machine. Broken access control, admin/RBAC, write-authz and authenticated flows need the deep audit &mdash; which is free in your own agent.'
      : 'URL-only surface scan: <span class="tabular">'+(g.passed||0)+'</span> checks passed. Broken access control, admin/RBAC, write-authz and authenticated flows need the deep audit &mdash; which is free in your own agent.';
    var lh = g.lighthouse ? '<div class="lh-strip">'
        +'<div class="lh-cell"><div class="v">'+lhv(g.lighthouse.performance)+'</div><div class="k">Performance</div></div>'
        +'<div class="lh-cell"><div class="v">'+lhv(g.lighthouse.accessibility)+'</div><div class="k">Accessibility</div></div>'
        +'<div class="lh-cell"><div class="v">'+lhv(g.lighthouse.best_practices)+'</div><div class="k">Best practices</div></div>'
        +'<div class="lh-cell"><div class="v">'+lhv(g.lighthouse.seo)+'</div><div class="k">SEO</div></div>'
        +(g.lighthouse.lcp_ms!=null?'<div class="lh-cell"><div class="v">'+(Math.round(g.lighthouse.lcp_ms/100)/10)+'s</div><div class="k">LCP</div></div>':'')
        +(g.lighthouse.cls!=null?'<div class="lh-cell"><div class="v">'+Number(g.lighthouse.cls).toFixed(2)+'</div><div class="k">CLS</div></div>':'')
      +'</div>' : '';

    grade.innerHTML='<div class="la-report">'
      +'<div class="la-report__head">'+gauge(g.score,g.band)
        +'<div class="la-report__meta">'
          +'<p class="la-report__url">'+esc(g.url||'')+'</p>'
          +'<p class="la-report__sub">'+esc(g.summary)+'</p>'
          +'<div class="la-report__counts">'+chips(c)+'</div>'+sevbar(c)
        +'</div>'
      +'</div>'
      +(table(g.findings)||clean())
      +'<div style="padding:18px 24px 22px;box-shadow:inset 0 1px 0 var(--elite-rule)">'+lh
      +'<p class="rep-note">'+note+'</p></div></div>';
    refresh();
  }

  function tierName(t){return t==='pro'?'Pro':t==='single'?'Single Run':'Deep Audit';}

  var tries=0, delay=3000;
  async function poll(){
    tries++;
    try{
      var r=await fetch('/api/order-status?session_id='+encodeURIComponent(sid),{cache:'no-store'});
      var d=await r.json();
      if(!d||!d.ok){
        setChip('chip-bad','Not found');
        grade.innerHTML=errBlock('We could not load your order.', esc((d&&d.error)||'The order lookup failed.'),
          '<a class="btn ghost" href="/#contact">Contact us with your receipt &rarr;</a>');
        refresh(); return;
      }
      if(d.status==='pending'){
        setChip('chip-info','Syncing');
        if(tries<40){ grade.innerHTML=loading('Waiting for Stripe to confirm the payment, then the audit starts. This usually takes 30 to 60 seconds.'); refresh(); setTimeout(poll, delay); return; }
        grade.innerHTML=errBlock('Your payment went through; the order has not synced yet.',
          'Keep this link and reload it in a few minutes &mdash; it is permanent. If it is still empty after an hour, send us the Stripe receipt number and we will finish it by hand or refund it.',
          '<a class="btn ghost" href="/#contact">Send us the receipt number &rarr;</a>');
        refresh(); return;
      }
      meta.innerHTML='Order for '+esc(d.target_url)+' &middot; '+tierName(d.tier)+' &middot; order link: '+esc(window.location.href);
      if(d.status==='blocked'){
        setChip('chip-warn',d.refunded?'Refunded':'Refund pending');
        setHead(d.refunded?'We could not audit that site, so we refunded you.':'We could not audit that site. Your refund needs confirmation.',
                'The scanner could not read '+esc(d.target_url)+' as a normal page, and grading what it did get back would have been a report about somebody else&rsquo;s HTML. '+(d.refunded?'The refund has been issued.':'A completed refund has not yet been confirmed.'));
        stGraded.className='now'; if(stReport)stReport.hidden=true;
        grade.innerHTML=errBlock('We could not read '+esc(d.target_url)+', so we will not grade it.',
          esc(d.blocked||d.grade_error||'The site did not answer as a normal page.')+' Grading a bot wall would be a report full of failures about somebody else&rsquo;s HTML. That is a refund, not a report.',
          '<p style="margin:6px 0 0;font-size:13.5px;color:var(--ink-mut);max-width:52ch">'
          +(d.refunded?'Your payment has been refunded in full; allow up to 5 business days for it to show on your card.'
                      :'This run qualifies for a full refund under our <a href="/refunds" style="color:var(--accent-ink)">refund policy</a>, but we have not confirmed it was issued. <a href="/#contact">Contact us with this order link</a> so we can complete it.')+'</p>');
        report.hidden=false;
        report.innerHTML='<p style="margin:0;font-size:13.5px;color:var(--ink-mut);line-height:1.65">Common causes: a bot wall or challenge page, a login wall on the home page, or the site being down. Once the public pages answer normally, order again and it will run. Or run it from your own machine, where there is nothing to block: <a href="/#connect" style="color:var(--accent-ink)">connect your agent</a>.</p>';
        refresh(); return;
      }
      if(d.status==='refunded'||d.status==='disputed'){
        setChip('chip-idle',d.status==='refunded'?'Refunded':'Disputed');
        setHead('This order is closed.','The payment was '+esc(d.status)+', so the report is no longer served on this link.');
        stGraded.className=''; if(stReport)stReport.hidden=true;
        grade.innerHTML=errBlock('This order was '+esc(d.status)+'.','The report is no longer available on this link. The free surface scan and the open-source deep audit are both still yours to run.',
          '<a class="btn ghost" href="/#grade">Run the free scan &rarr;</a>');
        refresh(); return;
      }
      if(d.grade){
        setChip('chip-ok','Report ready');
        setHead('Your report is ready.','Below is everything the site-wide URL audit found on '+esc(d.target_url)+', worst first, with a plain-English line on why each one costs you. Bookmark this link &mdash; it <em>is</em> your report and it keeps working.');
        stGraded.className='done'; if(stReport)stReport.className='done';
        renderGrade(d.grade);
      }
      else if(d.grade_error){
        setChip('chip-bad','Scan failed');
        stGraded.className='now';
        grade.innerHTML=errBlock('The scan could not finish for '+esc(d.target_url)+'.',
          esc(d.grade_error)+' Reload this link in a few minutes; if it still fails, send us the order link and it is refunded in full.',
          '<a class="btn ghost" href="/#contact">Send us this order link &rarr;</a>');
        refresh();
      }
      else {
        setChip('chip-info','Running');
        stGraded.className='now';
        grade.innerHTML=loading('Running your site audit &mdash; up to eight pages, 30 to 60 seconds. This page updates itself; you do not need to reload.');
        refresh();
        if(tries<40) setTimeout(poll, delay);
      }
      if(d.tier==='single'){
        report.hidden=false;
        report.innerHTML=d.grade
          ? '<p style="font-family:var(--font-display);font-size:18px;margin:0 0 6px">Single Run complete.</p><p style="margin:0;font-size:13.5px;color:var(--ink-mut);line-height:1.65">This page is your deliverable and the link keeps working. Want the deep audit in a real browser &mdash; authorization, admin/RBAC, accessibility, performance, with evidence for every check? It is free in <a href="/#connect" style="color:var(--accent-ink)">your own agent</a>, or <a href="/#contact" style="color:var(--accent-ink)">ask for a quote</a> and we do it by hand.</p>'
          : '<p style="margin:0;font-size:13.5px;color:var(--ink-mut)">Your grade will appear above as soon as the scan finishes.</p>';
      } else if(d.status==='delivered' && d.report_url){
        if(stReport){stReport.hidden=false;stReport.className='done';}
        report.hidden=false;
        report.innerHTML='<p style="font-family:var(--font-display);font-size:18px;margin:0 0 12px">Your full evidence report is ready.</p><a class="btn" href="'+esc(d.report_url)+'" target="_blank" rel="noopener">Open report</a>';
      } else {
        if(stReport){stReport.hidden=false;stReport.className=d.grade?'now':'';}
        report.hidden=false;
        report.innerHTML='<p style="font-family:var(--font-display);font-size:18px;margin:0 0 6px">Deep audit: done by hand.</p><p style="margin:0;font-size:13.5px;color:var(--ink-mut);line-height:1.65">We will contact you at the order email to confirm scope and, for Pro, a test login. Your URL audit above is available now. Questions: rob@fusiondataco.com.</p>';
      }
      refresh();
    }catch(err){
      if(tries<40) setTimeout(poll, delay);
      else { setChip('chip-bad','Offline');
        grade.innerHTML=errBlock('We could not reach the order service.','Your order is safe and this link is permanent &mdash; reload the page to try again.',
          '<a class="btn ghost" href="">Reload &rarr;</a>');
        refresh(); }
    }
  }
  grade.innerHTML=loading('Waiting for payment confirmation and running your site audit. This usually takes 30 to 60 seconds.');
  poll();
})();
