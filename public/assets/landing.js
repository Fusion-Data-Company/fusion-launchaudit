/* 80/20 Launch Audit landing — tabs, copy buttons, hero reveal (external for CSP script-src 'self') */
(function(){
  // ---- Tabs ----
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.tab[role="tab"]'));
  function selectTab(tab){
    tabs.forEach(function(t){
      var on = t === tab;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
      var panel = document.getElementById(t.getAttribute('aria-controls'));
      if(panel){ panel.hidden = !on; }
    });
  }
  tabs.forEach(function(tab, i){
    tab.addEventListener('click', function(){ selectTab(tab); });
    tab.addEventListener('keydown', function(e){
      var idx = i;
      if(e.key === 'ArrowRight' || e.key === 'ArrowDown'){ idx = (i+1) % tabs.length; }
      else if(e.key === 'ArrowLeft' || e.key === 'ArrowUp'){ idx = (i-1+tabs.length) % tabs.length; }
      else { return; }
      e.preventDefault();
      tabs[idx].focus();
      selectTab(tabs[idx]);
    });
  });

  // ---- Copy buttons ----
  function flip(btn){
    var label = btn.querySelector('.cb-label');
    var prev = label ? label.textContent : '';
    btn.classList.add('copied');
    if(label){ label.textContent = 'Copied ✓'; }
    setTimeout(function(){
      btn.classList.remove('copied');
      if(label){ label.textContent = prev || 'Copy'; }
    }, 1500);
  }
  document.querySelectorAll('.copy-btn[data-copy]').forEach(function(btn){
    btn.addEventListener('click', function(){
      var target = document.getElementById(btn.getAttribute('data-copy'));
      if(!target) return;
      var text = target.innerText.replace(/ /g, ' ').trim();
      function done(){ flip(btn); }
      function fallback(){
        try{
          var ta = document.createElement('textarea');
          ta.value = text;
          ta.style.position = 'fixed';
          ta.style.opacity = '0';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          done();
        }catch(err){ /* no-op */ }
      }
      if(navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(text).then(done, fallback);
      } else {
        fallback();
      }
    });
  });
})();

/* hero reveal removed — hero content is always visible (framed product demo) */


(function(){
  // ---- The sample report's gauge. Drawn from the real numbers printed in
  //      the markup beside it, never from a placeholder. ----
  var host=document.getElementById('sample-gauge');
  if(host && window.eliteGauge){ host.innerHTML=window.eliteGauge(65,'yellow'); }
})();


(function(){
  // ---- Free instant grader — ELITE report: a real score gauge, severity
  //      chips carrying a colour AND a glow, a findings table with
  //      tabular-nums, paste-ready fixes, designed empty / blocked / error
  //      states, and an email unlock for the locked remainder. ----
  var form=document.getElementById('grade-form'); if(!form) return;
  var out=document.getElementById('grade-result'), btn=document.getElementById('grade-btn');
  function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  var CAT_ORDER=['Supabase / RLS','Firebase','Secrets','Access control','Auth hardening','Debug leak','CORS','Cookies','TLS','Security headers','SEO','Content'];
  var SEV={critical:['chip-crit','Critical','la-row-crit',0],high:['chip-bad','High','la-row-high',1],medium:['chip-warn','Medium','la-row-med',2],low:['chip-info','Low','la-row-low',3]};
  var current={scanId:null, origin:null};

  function copySvg(){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>';}

  function sortFindings(list){
    return list.slice().sort(function(a,b){
      var sa=(SEV[a.severity]||SEV.low)[3], sb=(SEV[b.severity]||SEV.low)[3];
      if(sa!==sb) return sa-sb;
      var ca=CAT_ORDER.indexOf(a.category), cb=CAT_ORDER.indexOf(b.category);
      return (ca<0?99:ca)-(cb<0?99:cb);
    });
  }

  function row(f,i){
    var m=SEV[f.severity]||SEV.low;
    var fixId='fx'+i;
    var fixCell=f.fix
      ? '<button type="button" class="fix-copy btn-flag" data-fix="'+esc(f.fix)+'" aria-describedby="'+fixId+'">'+copySvg()+'<span class="fc-label">Copy fix</span></button>'
      : '<span class="la-cat">&mdash;</span>';
    var detail='<tr class="'+m[2]+'">'
      +'<td><span class="chip '+m[0]+' sev-chip">'+m[1]+'</span></td>'
      +'<td class="la-cat">'+esc(f.category||'')+'</td>'
      +'<td class="la-what"><b>'+esc(f.title)+'</b><span>'+esc(f.detail)+'</span></td>'
      +'<td class="num">'+fixCell+'</td></tr>';
    var fixRow=f.fix
      ? '<tr class="la-fixrow"><td colspan="4"><details id="'+fixId+'"><summary>Show the paste-ready fix for Claude Code or Cursor</summary><pre class="fix-body">'+esc(f.fix)+'</pre></details></td></tr>'
      : '';
    return detail+fixRow;
  }

  function table(list){
    if(!list.length) return '';
    return '<div class="elite-table-wrap"><table class="elite-table is-compact">'
      +'<thead><tr><th scope="col">Severity</th><th scope="col">Category</th>'
      +'<th scope="col">What we found, and why it costs you</th><th scope="col" class="num">Fix</th></tr></thead>'
      +'<tbody>'+sortFindings(list).map(row).join('')+'</tbody></table></div>';
  }

  function chips(counts){
    if(!counts) return '';
    return ['critical','high','medium','low'].filter(function(k){return counts[k]>0;}).map(function(k){
      var m=SEV[k];
      return '<span class="chip '+m[0]+' sev-chip">'+counts[k]+' '+m[1]+'</span>';
    }).join('');
  }

  function sevbar(counts){
    if(!counts) return '';
    var t=(counts.critical||0)+(counts.high||0)+(counts.medium||0)+(counts.low||0);
    if(!t) return '';
    function w(n){return ((n||0)/t*100).toFixed(1)+'%';}
    return '<div class="la-sevbar" aria-hidden="true">'
      +'<i class="s-crit" style="width:'+w(counts.critical)+'"></i>'
      +'<i class="s-high" style="width:'+w(counts.high)+'"></i>'
      +'<i class="s-med" style="width:'+w(counts.medium)+'"></i>'
      +'<i class="s-low" style="width:'+w(counts.low)+'"></i></div>';
  }

  function lockedBlock(d){
    if(!d.locked || !d.locked.count || !d.scan_id) return '';
    return '<div class="rep-locked" id="rep-locked"><div class="lk-blur"></div>'
      +'<h4>'+d.locked.count+' more finding'+(d.locked.count===1?'':'s')+' locked</h4>'
      +'<p>Including '+esc((d.locked.categories||[]).slice(0,4).join(', ')||'more checks')+'. Unlock the full report &mdash; every finding with its paste-ready fix &mdash; free. We will email you the report link.</p>'
      +'<div class="la-report__counts" style="justify-content:center;margin:14px 0 4px;">'+chips(d.locked.by_severity||{})+'</div>'
      +'<form class="unlock-form" id="unlock-form"><input type="email" id="unlock-email" placeholder="you@email.com" aria-label="Email to unlock" required />'
      +'<button class="btn btn-primary" type="submit" id="unlock-btn">Unlock full report &rarr;</button></form>'
      +'<label class="unlock-mon"><input type="checkbox" id="unlock-monitor" checked /> Also watch this URL weekly and email me if the score drops</label>'
      +'<div id="unlock-err" class="unlock-err" hidden></div></div>';
  }

  /* A designed empty state. The words "No data" are never acceptable: they
     tell an operator nothing about whether the query is wrong, the filter is
     wrong, or the work is done. This one says which, and gives a next step. */
  function cleanState(){
    return '<div class="elite-empty">'
      +'<div class="elite-empty__mark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v5c0 4.4-3 8.3-7 9.5C8 19.3 5 15.4 5 11V6z"/><path d="M9 12l2 2 4-4"/></svg></div>'
      +'<h4>Nothing showing on the surface.</h4>'
      +'<p>Every check that can be answered from outside your app came back clean. That is worth something &mdash; and it is also the limit of what one HTTP conversation can prove. It says nothing yet about broken access control, your admin API, or what your server hands a stranger who asks directly.</p>'
      +'<a class="btn btn-primary" href="#connect">Run the deep audit in your own agent &rarr;</a></div>';
  }

  function blockedState(d){
    return '<div class="la-error">'
      +'<div class="la-error__mark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16v.5"/></svg></div>'
      +'<h4>We could not read your site, so we will not grade it.</h4>'
      +'<p>'+esc(d.summary||'The response we got back was a bot challenge or an error page, not your app. Grading that would be a report full of failures about somebody else\'s HTML.')+'</p>'
      +'<a class="btn btn-ghost" href="#connect">Run it locally instead &mdash; from your own machine there is nothing to block &rarr;</a></div>';
  }

  function errState(msg){
    return '<div class="la-error">'
      +'<div class="la-error__mark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16v.5"/></svg></div>'
      +'<h4>The scan did not run.</h4><p>'+esc(msg)+'</p>'
      +'<a class="btn btn-ghost" href="#connect">Run it locally instead &rarr;</a></div>';
  }

  function loadingState(){
    return '<div class="la-report"><div class="la-report__head">'
      +'<div class="skeleton" style="width:168px;height:168px;border-radius:50%;flex:none"></div>'
      +'<div class="la-report__meta" style="display:grid;gap:10px">'
      +'<div class="skeleton skeleton-line" style="height:16px"></div>'
      +'<div class="skeleton skeleton-line" style="height:12px"></div>'
      +'<div class="skeleton skeleton-line" style="height:12px"></div></div></div>'
      +'<p class="grade-loading">Running the surface scan and the vibe-coder checks&hellip; up to 15 seconds.</p></div>';
  }

  function render(d){
    if(d.band==='blocked' || d.blocked){ out.innerHTML=blockedState(d); return; }
    var hasAny=(d.findings&&d.findings.length)||(d.locked&&d.locked.count);
    var body=hasAny ? table(d.findings||[])+lockedBlock(d) : cleanState();
    out.innerHTML='<div class="la-report">'
      +'<div class="la-report__head">'
        +(window.eliteGauge?window.eliteGauge(d.score,d.band):'')
        +'<div class="la-report__meta">'
          +'<p class="la-report__url">'+esc(current.origin||'')+'</p>'
          +'<p class="la-report__sub">'+esc(d.summary)+'</p>'
          +'<div class="la-report__counts">'+chips(d.counts)+'</div>'
          +sevbar(d.counts)
        +'</div>'
      +'</div>'
      +body
      +'<div class="rep-actions"><a class="btn btn-primary" href="#connect">Run the deep audit &mdash; free in your agent &rarr;</a>'
      +(current.origin?'<a class="btn btn-ghost" href="/monitor?url='+encodeURIComponent(current.origin)+'">Track this URL over time &rarr;</a>':'')+'</div>'
      +'<p class="rep-note">'+esc(d.note||'')+'</p></div>';
    wireCopy(); wireUnlock(d);
    if(window.eliteMotionRefresh) window.eliteMotionRefresh();
  }

  function wireCopy(){
    out.querySelectorAll('.fix-copy').forEach(function(b){
      b.addEventListener('click', function(e){
        e.preventDefault();
        var text=b.getAttribute('data-fix')||'';
        var lbl=b.querySelector('.fc-label');
        function ok(){ b.classList.add('copied'); if(lbl) lbl.textContent='Copied ✓'; setTimeout(function(){b.classList.remove('copied'); if(lbl) lbl.textContent='Copy fix';},1500); }
        if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(text).then(ok,ok); } else { ok(); }
      });
    });
  }

  function wireUnlock(d){
    var uf=document.getElementById('unlock-form'); if(!uf) return;
    var ubtn=document.getElementById('unlock-btn'), uerr=document.getElementById('unlock-err');
    uf.addEventListener('submit', async function(e){
      e.preventDefault();
      var email=(document.getElementById('unlock-email').value||'').trim();
      var mon=!!(document.getElementById('unlock-monitor')||{}).checked;
      if(!email){ return; }
      var pv=ubtn.textContent; ubtn.disabled=true; ubtn.textContent='Unlocking…'; uerr.hidden=true;
      try{
        var r=await fetch('/api/waitlist',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:email,scan_id:current.scanId,monitor:mon})});
        var res=await r.json();
        if(res&&res.ok){ render({score:res.score!=null?res.score:d.score, band:res.band||d.band, summary:d.summary, note:d.note, counts:res.counts||d.counts, findings:res.findings||[], locked:null, scan_id:null}); }
        else { uerr.hidden=false; uerr.textContent=(res&&res.error)||'Could not unlock — try again.'; ubtn.disabled=false; ubtn.textContent=pv; }
      }catch(err){ uerr.hidden=false; uerr.textContent='Could not unlock — try again.'; ubtn.disabled=false; ubtn.textContent=pv; }
    });
  }

  form.addEventListener('submit', async function(e){
    e.preventDefault();
    var url=(document.getElementById('grade-url').value||'').trim(); if(!url) return;
    var ok=document.getElementById('grade-authorized');
    if(ok && !ok.checked){ out.hidden=false; out.innerHTML=errState('Tick the box to confirm you own this site or are authorised to test it.'); return; }
    var prev=btn.textContent; btn.disabled=true; btn.textContent='Scanning…';
    out.hidden=false; out.innerHTML=loadingState();
    try{
      var r=await fetch('/api/grade',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url:url})});
      var d=await r.json();
      if(d && d.ok){ current.scanId=d.scan_id||null; current.origin=d.url||url; render(d); }
      else { out.innerHTML=errState((d&&d.error)||'The scan failed. Check the URL and try again.'); }
    }catch(err){ out.innerHTML=errState('The scan failed to reach us. Check the URL and try again.'); }
    btn.disabled=false; btn.textContent=prev;
  });
})();


(function(){
  // ---- Contact / submission form ----
  var f=document.getElementById('contact-form'); if(!f) return;
  var out=document.getElementById('cf-result'), btn=document.getElementById('cf-btn');
  f.addEventListener('submit', async function(e){
    e.preventDefault();
    var email=(document.getElementById('cf-email').value||'').trim();
    var message=(document.getElementById('cf-message').value||'').trim();
    if(!email||!message){ out.hidden=false; out.className='cf-result err'; out.textContent='Add your email and a message.'; return; }
    var prev=btn.textContent; btn.disabled=true; btn.textContent='Sending…';
    try{
      var r=await fetch('/api/contact',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({
        name:(document.getElementById('cf-name').value||'').trim(), email:email,
        type:document.getElementById('cf-type').value, message:message })});
      var d=await r.json();
      out.hidden=false;
      if(d && d.ok){ out.className='cf-result ok'; out.textContent='Got it — thanks. We\'ll be in touch.'; f.reset(); }
      else { out.className='cf-result err'; out.textContent=(d&&d.error)||'Could not send — try again.'; }
    }catch(err){ out.hidden=false; out.className='cf-result err'; out.textContent='Could not send — try again.'; }
    btn.disabled=false; btn.textContent=prev;
  });
})();


(function(){
  // ---- Hosted audit order (Stripe Checkout) ----
  var f=document.getElementById('order-form'); if(!f) return;
  var out=document.getElementById('order-result'), btn=document.getElementById('order-btn');
  var tiers=Array.prototype.slice.call(f.querySelectorAll('.tier'));
  function syncTiers(){ tiers.forEach(function(t){ var r=t.querySelector('input[type=radio]'); t.classList.toggle('selected', !!(r&&r.checked)); }); }
  tiers.forEach(function(t){ var r=t.querySelector('input[type=radio]'); if(r){ r.addEventListener('change', syncTiers); } });
  syncTiers();
  f.addEventListener('submit', async function(e){
    e.preventDefault();
    var url=(document.getElementById('order-url').value||'').trim();
    var email=(document.getElementById('order-email').value||'').trim();
    var tierEl=f.querySelector('input[name=tier]:checked'); var tier=tierEl?tierEl.value:'single';
    var authorized=!!(document.getElementById('order-authorized')||{}).checked;
    if(!url||!email){ out.hidden=false; out.className='cf-result err'; out.textContent='Add the app URL and a contact email for the order.'; return; }
    if(!authorized){ out.hidden=false; out.className='cf-result err'; out.textContent='Tick the box to confirm you own this site or are authorised to test it.'; return; }
    var prev=btn.textContent; btn.disabled=true; btn.textContent='Starting checkout…';
    try{
      var r=await fetch('/api/checkout',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url:url,email:email,tier:tier,authorized:authorized})});
      var d=await r.json();
      if(d && d.ok && d.url){ window.location.href=d.url; return; }
      out.hidden=false; out.className='cf-result err'; out.textContent=(d&&d.error)||'Could not start checkout — try again.';
    }catch(err){ out.hidden=false; out.className='cf-result err'; out.textContent='Could not start checkout — try again.'; }
    btn.disabled=false; btn.textContent=prev;
  });
})();
