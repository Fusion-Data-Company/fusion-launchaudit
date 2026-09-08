/* 80/20 Launch Audit — monitor page: history sparkline, diff, findings, enrolment,
   white-label PDF export. External for CSP script-src 'self'. */
(function(){
  var out=document.getElementById('result');
  var form=document.getElementById('mform');
  var input=document.getElementById('murl');
  function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  function bandOf(s){return s>=75?'green':s>=40?'yellow':'red';}
  function when(iso){try{return new Date(iso).toLocaleString('en-US',{month:'short',day:'numeric',year:'numeric'});}catch(e){return '';}}

  function sparkline(history){
    if(!history||history.length<2) return '<div class="muted">Not enough history yet for a trend — the first weekly re-scan lands in 7 days.</div>';
    var w=Math.max(260,history.length*40),h=64,pad=8;
    var xs=function(i){return pad+i*((w-2*pad)/(history.length-1));};
    var ys=function(v){return h-pad-(v/100)*(h-2*pad);};
    var pts=history.map(function(p,i){return xs(i)+','+ys(p.score);}).join(' ');
    var last=history[history.length-1];
    var dots=history.map(function(p,i){return '<circle cx="'+xs(i).toFixed(1)+'" cy="'+ys(p.score).toFixed(1)+'" r="3" fill="'+({green:'#48c98a',yellow:'#e0b23c',red:'#f0696a'}[bandOf(p.score)])+'"><title>'+p.score+' · '+esc(when(p.created_at))+'</title></circle>';}).join('');
    return '<svg class="spark" width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="Score history">'
      +'<polyline points="'+pts+'" fill="none" stroke="'+({green:'#48c98a',yellow:'#e0b23c',red:'#f0696a'}[bandOf(last.score)])+'" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>'+dots+'</svg>';
  }

  function fixSvg(){return '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6a3.5 3.5 0 0 0-4.6 4.2L4 16.6 7.4 20l6.4-6.4A3.5 3.5 0 0 0 18 9l-2 2-2-2z"/></svg>';}
  function findingCard(f){
    var sev=esc(f.severity);
    var fix=f.fix?('<details class="fcard-fix"><summary>'+fixSvg()+'Agent-ready fix<button type="button" class="fix-copy" data-fix="'+esc(f.fix)+'">Copy</button></summary><pre class="fix-body">'+esc(f.fix)+'</pre></details>'):'';
    return '<div class="fcard sev-'+sev+'"><div class="fcard-head"><span class="fcard-sev">'+sev+'</span><span class="fcard-title">'+esc(f.title)+'</span></div><p class="fcard-detail">'+esc(f.detail)+'</p>'+fix+'</div>';
  }

  function deltaChip(diff){
    if(!diff) return '';
    var d=diff.score_delta, cls=d>0?'up':d<0?'down':'flat', sign=d>0?'+':'';
    return '<span class="delta '+cls+'">'+sign+d+' since last scan</span>';
  }

  function render(data){
    var origin=data.origin;
    if(!data.latest){
      out.innerHTML='<div class="panel"><h2>No scans yet for '+esc(origin)+'</h2><p class="muted">Enrol it below to run the first scan now and start the weekly history.</p></div>'+enrollPanel(data,origin);
      wire(data,origin); return;
    }
    var L=data.latest, band=bandOf(L.score);
    var findings=(L.findings||[]);
    var wl=data.monitor||{};
    var mast=(wl.agency_name||wl.logo_url)?('<div style="display:none"></div>'):'';
    // white-label masthead (print only)
    var wlm=document.getElementById('wl-mast');
    wlm.innerHTML=(wl.logo_url?'<img src="'+esc(wl.logo_url)+'" alt="" />':'')+'<span class="wl-name">'+esc(wl.agency_name||'Launch Audit Report')+'</span><span class="wl-sub">'+esc(origin)+'<br/>'+esc(when(L.created_at))+'</span>';

    out.innerHTML=''
      +'<div class="panel band-'+band+'"><div class="head-row">'
        +'<div class="bigscore">'+esc(L.score)+'<small>/100</small></div>'
        +'<div class="head-meta"><div class="u">'+esc(origin)+'</div><div class="when">Last scan '+esc(when(L.created_at))+' '+deltaChip(data.diff)+'</div>'+sparkline(data.history)+'</div>'
        +'<button class="btn btn-ghost no-print" id="pdf-btn">Export white-label PDF</button>'
      +'</div></div>'
      +(data.diff&&(data.diff.new_findings.length||data.diff.fixed_findings.length)?
        '<div class="panel"><h2>What changed since last week</h2><div class="diff-cols">'
        +'<div class="diff-col"><h3>New ('+data.diff.new_findings.length+')</h3>'+(data.diff.new_findings.length?data.diff.new_findings.map(function(f){return '<div class="diff-item new">['+esc(f.severity)+'] '+esc(f.title)+'</div>';}).join(''):'<div class="muted">None</div>')+'</div>'
        +'<div class="diff-col"><h3>Fixed ('+data.diff.fixed_findings.length+')</h3>'+(data.diff.fixed_findings.length?data.diff.fixed_findings.map(function(f){return '<div class="diff-item fixed">'+esc(f.title)+'</div>';}).join(''):'<div class="muted">None</div>')+'</div>'
        +'</div></div>':'')
      +'<div class="panel"><h2>Current findings ('+findings.length+')</h2>'+(findings.length?findings.map(findingCard).join(''):'<p class="muted">No findings on the last scan.</p>')+'</div>'
      +enrollPanel(data,origin);
    wire(data,origin);
  }

  function enrollPanel(data,origin){
    var m=data.monitor||{};
    var on=m&&m.active;
    return '<div class="panel enroll-panel no-print"><h2>'+(on?'Weekly monitoring is on':'Turn on weekly monitoring')+'</h2>'
      +'<p class="muted" style="margin-top:0">We re-scan every Monday and, when SMTP is configured on the server, email the diff. White-label fields appear on the exported PDF.</p>'
      +'<form class="enroll" id="enroll-form">'
      +'<label>Email for the weekly diff<input type="email" id="e-email" placeholder="you@email.com" value="'+esc(m.email_set?'':'')+'" /></label>'
      +'<label>Frequency<input type="text" value="Weekly (Mondays)" disabled /></label>'
      +'<label>Agency name (PDF header)<input type="text" id="e-agency" maxlength="120" placeholder="Your Agency" value="'+esc(m.agency_name||'')+'" /></label>'
      +'<label>Logo URL (PDF header)<input type="url" id="e-logo" maxlength="500" placeholder="https://…/logo.png" value="'+esc(m.logo_url||'')+'" /></label>'
      +'<div class="enroll-foot"><button class="btn btn-primary" type="submit" id="enroll-btn">'+(on?'Update monitoring':'Start weekly monitoring')+'</button><span id="enroll-msg" class="muted"></span></div>'
      +'</form></div>';
  }

  function wire(data,origin){
    out.querySelectorAll('.fix-copy').forEach(function(b){
      b.addEventListener('click',function(e){e.preventDefault();var t=b.getAttribute('data-fix')||'';function ok(){b.classList.add('copied');b.textContent='Copied ✓';setTimeout(function(){b.classList.remove('copied');b.textContent='Copy';},1500);}if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t).then(ok,ok);}else{ok();}});
    });
    var pdf=document.getElementById('pdf-btn'); if(pdf) pdf.addEventListener('click',function(){window.print();});
    var ef=document.getElementById('enroll-form');
    if(ef) ef.addEventListener('submit',async function(e){
      e.preventDefault();
      var btn=document.getElementById('enroll-btn'),msg=document.getElementById('enroll-msg');
      var body={url:origin,email:(document.getElementById('e-email').value||'').trim()||undefined,agency_name:(document.getElementById('e-agency').value||'').trim()||undefined,logo_url:(document.getElementById('e-logo').value||'').trim()||undefined};
      var pv=btn.textContent;btn.disabled=true;btn.textContent='Saving…';
      try{var r=await fetch('/api/monitor',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});var res=await r.json();
        if(res&&res.ok){msg.textContent='Saved — reloading history…';load(origin);}else{msg.textContent=(res&&res.error)||'Could not save.';btn.disabled=false;btn.textContent=pv;}
      }catch(err){msg.textContent='Could not save — try again.';btn.disabled=false;btn.textContent=pv;}
    });
  }

  async function load(url){
    out.innerHTML='<div class="state">Loading history…</div>';
    try{
      var r=await fetch('/api/monitor?url='+encodeURIComponent(url));
      var d=await r.json();
      if(d&&d.ok){ input.value=d.origin; try{history.replaceState(null,'','/monitor?url='+encodeURIComponent(d.origin));}catch(e){} render(d); }
      else { out.innerHTML='<div class="state err">'+esc((d&&d.error)||'Could not load monitoring for that URL.')+'</div>'; }
    }catch(err){ out.innerHTML='<div class="state err">Could not load — check the URL and try again.</div>'; }
  }

  form.addEventListener('submit',function(e){e.preventDefault();var u=(input.value||'').trim();if(u) load(u);});
  var pre=new URLSearchParams(location.search).get('url');
  if(pre){ input.value=pre; load(pre); }
})();
