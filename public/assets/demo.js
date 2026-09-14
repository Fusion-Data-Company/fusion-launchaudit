/* /demo: the persisted sample report. Fetches /api/demo (Postgres row first,
 * committed snapshot second) and renders it through the same renderer the paid
 * success page uses. Never triggers a run. External file: script-src 'self'. */
(function(){
  var order=document.getElementById('demo-order'), grade=document.getElementById('grade'), actions=document.getElementById('demo-actions'), meta=document.getElementById('meta'), chip=document.getElementById('demo-chip');
  function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  function refresh(){ if(window.eliteMotionRefresh) window.eliteMotionRefresh(); }
  function when(iso){ try{ var d=new Date(iso); return d.toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})+' at '+d.toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit',timeZoneName:'short'}); }catch(e){ return iso; } }
  function empty(msg){
    grade.innerHTML='<div class="elite-empty" style="padding:36px 24px;"><div class="elite-empty__mark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16v.5"/></svg></div>'
      +'<h4 style="font-family:var(--font-display);font-size:20px;margin:0;color:var(--ink)">The sample report is not published yet.</h4>'
      +'<p style="max-width:52ch;margin:0;color:var(--ink-soft);font-size:14.5px;line-height:1.6">'+esc(msg)+'</p>'
      +'<a class="btn" href="/#grade">Grade your own app free &rarr;</a></div>';
    if(chip){ chip.className='chip chip-warn sev-chip'; chip.textContent='Not published'; }
    refresh();
  }
  order.innerHTML='<div class="skeleton skeleton-line" style="height:14px"></div><div class="skeleton skeleton-line" style="height:12px;margin-top:10px"></div>';
  grade.innerHTML='<div class="card"><div class="skeleton" style="width:168px;height:168px;border-radius:50%"></div></div>';
  fetch('/api/demo',{headers:{'accept':'application/json'}}).then(function(r){return r.json();}).then(function(d){
    if(!d||!d.ok||!d.report||!d.report.grade){ empty((d&&d.error)||'It will appear here as soon as it is generated.'); return; }
    var rep=d.report, g=rep.grade, c=window.auditReportCounts(g.findings);
    order.innerHTML='<div class="sum-grid">'
      +'<div><span class="k">Buyer</span><b>'+esc(rep.buyer&&rep.buyer.name||'Rob Yeager')+'<br><span style="color:var(--ink-mut);font-weight:500">'+esc(rep.buyer&&rep.buyer.company||'Fusion Data Company')+' &middot; '+esc(rep.buyer&&rep.buyer.email||'rob@fusiondataco.com')+'</span></b></div>'
      +'<div><span class="k">Tier</span><b>Single Run &middot; <span class="tabular">$79</span> one-time</b></div>'
      +'<div><span class="k">Site</span><b>'+esc(rep.url)+'</b></div>'
      +'<div><span class="k">Status</span><b><span class="chip chip-ok sev-chip">Delivered</span></b></div>'
      +'<div><span class="k">Generated</span><b>'+esc(when(rep.created_at))+'</b></div>'
      +'<div><span class="k">Result</span><b class="tabular">'+esc(g.score)+'/100 &middot; '+esc(g.findings.length)+' finding'+(g.findings.length===1?'':'s')+' ('+c.critical+' critical, '+c.high+' high)</b></div>'
      +'</div>'
      +'<p class="sum-note">Served from '+(d.source==='snapshot'?'the committed snapshot of the run':'the stored run')+' (id '+esc(rep.id)+'). The real order page also emails this report as a PDF and keeps it at a private hosted link.</p>';
    actions.innerHTML=(rep.pdf_url?'<a class="btn" href="'+esc(rep.pdf_url)+'" target="_blank" rel="noopener">Download the PDF</a>':'')
      +'<a class="btn ghost" href="/#order">Order this for your app &rarr;</a>';
    window.renderAuditReport(grade, g, {});
    meta.innerHTML='Sample order &middot; Single Run &middot; $79 &middot; '+esc(rep.url)+' &middot; report id '+esc(rep.id);
    refresh();
  }).catch(function(){ empty('The report service did not answer. Reload to try again.'); });
})();
