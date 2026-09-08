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
  // ---- Free instant grader (elite report: severity stripes, grouped by
  //      category, copy-fix buttons, and an email-unlock for locked findings) ----
  var form=document.getElementById('grade-form'); if(!form) return;
  var out=document.getElementById('grade-result'), btn=document.getElementById('grade-btn');
  function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  var CAT_ORDER=['Supabase / RLS','Firebase','Secrets','Access control','Auth hardening','Debug leak','CORS','Cookies','TLS','Security headers','SEO','Content'];
  var current={scanId:null, origin:null};

  function fixSvg(){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6a3.5 3.5 0 0 0-4.6 4.2L4 16.6 7.4 20l6.4-6.4A3.5 3.5 0 0 0 18 9l-2 2-2-2z"/></svg>';}
  function copySvg(){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>';}

  function findingCard(f){
    var sev=esc(f.severity);
    var fix=f.fix?('<details class="fcard-fix"><summary>'+fixSvg()+'<span class="grow">Agent-ready fix</span>'
      +'<button type="button" class="fix-copy" data-fix="'+esc(f.fix)+'">'+copySvg()+'<span class="fc-label">Copy</span></button></summary>'
      +'<pre class="fix-body">'+esc(f.fix)+'</pre></details>'):'';
    return '<div class="fcard sev-'+sev+'"><div class="fcard-head"><span class="fcard-sev">'+sev+'</span>'
      +'<span class="fcard-title">'+esc(f.title)+'</span></div>'
      +'<p class="fcard-detail">'+esc(f.detail)+'</p>'+fix+'</div>';
  }

  function groupByCat(list){
    var groups={};
    list.forEach(function(f){ (groups[f.category]=groups[f.category]||[]).push(f); });
    var cats=Object.keys(groups).sort(function(a,b){var ia=CAT_ORDER.indexOf(a),ib=CAT_ORDER.indexOf(b);return (ia<0?99:ia)-(ib<0?99:ib);});
    return cats.map(function(c){return '<div class="rep-cat"><h4>'+esc(c)+'</h4>'+groups[c].map(findingCard).join('')+'</div>';}).join('');
  }

  function sevBar(counts,extra){
    if(!counts) return '';
    var order=[['critical','Critical'],['high','High'],['medium','Medium'],['low','Low']];
    var chips=order.filter(function(o){return counts[o[0]]>0;}).map(function(o){
      return '<span class="sevchip"><span class="sd '+o[0]+'"></span>'+counts[o[0]]+' '+o[1]+'</span>';}).join('');
    return '<div class="sevbar '+(extra||'')+'">'+chips+'</div>';
  }

  function lockedBlock(d){
    if(!d.locked || !d.locked.count || !d.scan_id) return '';
    var by=d.locked.by_severity||{};
    return '<div class="rep-locked" id="rep-locked"><div class="lk-blur"></div>'
      +'<h4>'+d.locked.count+' more finding'+(d.locked.count===1?'':'s')+' locked</h4>'
      +'<p>Including '+esc((d.locked.categories||[]).slice(0,4).join(', ')||'more checks')+'. Unlock the full report — every finding with its paste-ready fix — free. We will email you the report link.</p>'
      +sevBar(by,'lk-sev')
      +'<form class="unlock-form" id="unlock-form"><input type="email" id="unlock-email" placeholder="you@email.com" aria-label="Email to unlock" required />'
      +'<button class="btn btn-primary" type="submit" id="unlock-btn">Unlock full report →</button></form>'
      +'<label class="unlock-mon"><input type="checkbox" id="unlock-monitor" checked /> Also watch this URL weekly and email me if the score drops</label>'
      +'<div id="unlock-err" style="position:relative;color:#f0a3a3;font-size:13px;margin-top:10px" hidden></div></div>';
  }

  function render(d){
    var body;
    if(!(d.findings&&d.findings.length) && !(d.locked&&d.locked.count)){
      body='<p class="grade-clean">No surface issues found — nice. The deep audit (broken access control, admin/RBAC, your repo) is the next step.</p>';
    } else {
      body=groupByCat(d.findings||[])+lockedBlock(d);
    }
    out.innerHTML='<div class="rep">'
      +'<div class="rep-top"><div class="rep-score band-'+esc(d.band)+'"><span class="n">'+esc(d.score)+'</span><span class="d">/ 100</span><span class="cap">readiness</span></div>'
      +'<div class="rep-head"><p class="sum">'+esc(d.summary)+'</p>'+sevBar(d.counts)+'</div></div>'
      +body
      +'<div class="rep-actions"><a class="btn btn-primary" href="#connect">Run the deep audit — free in your agent →</a>'
      +(current.origin?'<a class="btn btn-ghost" href="/monitor?url='+encodeURIComponent(current.origin)+'">Track this URL over time →</a>':'')+'</div>'
      +'<p class="rep-note">'+esc(d.note||'')+'</p></div>';
    wireCopy(); wireUnlock(d);
  }

  function wireCopy(){
    out.querySelectorAll('.fix-copy').forEach(function(b){
      b.addEventListener('click', function(e){
        e.preventDefault();
        var text=b.getAttribute('data-fix')||'';
        var lbl=b.querySelector('.fc-label');
        function ok(){ b.classList.add('copied'); if(lbl) lbl.textContent='Copied ✓'; setTimeout(function(){b.classList.remove('copied'); if(lbl) lbl.textContent='Copy';},1500); }
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
    var ok=document.getElementById('grade-authorized'); if(ok && !ok.checked){ out.hidden=false; out.innerHTML='<div class="grade-err">Tick the box to confirm you own this site or are authorised to test it.</div>'; return; }
    var prev=btn.textContent; btn.disabled=true; btn.textContent='Scanning…';
    out.hidden=false; out.innerHTML='<div class="grade-loading">Running the surface scan and the vibe-coder checks… (up to 15s)</div>';
    try{
      var r=await fetch('/api/grade',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url:url})});
      var d=await r.json();
      if(d && d.ok){ current.scanId=d.scan_id||null; current.origin=d.url||null; render(d); }
      else { out.innerHTML='<div class="grade-err">'+esc((d&&d.error)||'Scan failed — try again.')+'</div>'; }
    }catch(err){ out.innerHTML='<div class="grade-err">Scan failed — check the URL and try again.</div>'; }
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
