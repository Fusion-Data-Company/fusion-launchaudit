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
    var dots=history.map(function(p,i){return '<circle cx="'+xs(i).toFixed(1)+'" cy="'+ys(p.score).toFixed(1)+'" r="3" fill="'+({green:'#4ECB8A',yellow:'#E8B14A',red:'#FF6472'}[bandOf(p.score)])+'"><title>'+p.score+' · '+esc(when(p.created_at))+'</title></circle>';}).join('');
    return '<svg class="spark" width="'+w+'" height="'+h+'" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="Score history">'
      +'<polyline points="'+pts+'" fill="none" stroke="'+({green:'#4ECB8A',yellow:'#E8B14A',red:'#FF6472'}[bandOf(last.score)])+'" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>'+dots+'</svg>';
  }

  var SEV={critical:['chip-crit','Critical','la-row-crit',0],high:['chip-bad','High','la-row-high',1],
           medium:['chip-warn','Medium','la-row-med',2],low:['chip-info','Low','la-row-low',3]};

  /* Status is a colour AND a glow, never raw text in a cell — a chip separates
     on bloom as well as hue, which is what keeps it legible screenshotted into
     Slack or read by somebody with a red/green deficiency. */
  function findingsTable(list){
    if(!list||!list.length) return emptyFindings();
    var rows=list.slice().sort(function(a,b){
      return ((SEV[a.severity]||SEV.low)[3])-((SEV[b.severity]||SEV.low)[3]);
    }).map(function(f,i){
      var m=SEV[f.severity]||SEV.low;
      var fix=f.fix?'<div class="m-fixcell"><details><summary>Agent-ready fix</summary><pre class="fix-body">'+esc(f.fix)+'</pre></details></div>':'';
      var btn=f.fix?'<button type="button" class="fix-copy" data-fix="'+esc(f.fix)+'">Copy</button>':'<span class="muted">&mdash;</span>';
      return '<tr class="'+m[2]+'"><td><span class="chip '+m[0]+' sev-chip">'+m[1]+'</span></td>'
        +'<td class="la-cat">'+esc(f.category||'')+'</td>'
        +'<td class="la-what"><b>'+esc(f.title)+'</b><span>'+esc(f.detail)+'</span>'+fix+'</td>'
        +'<td class="num">'+btn+'</td></tr>';
    }).join('');
    return '<div class="elite-table-wrap"><table class="elite-table is-compact">'
      +'<thead><tr><th scope="col">Severity</th><th scope="col">Category</th>'
      +'<th scope="col">What we found, and why it costs you</th><th scope="col" class="num">Fix</th></tr></thead>'
      +'<tbody>'+rows+'</tbody></table></div>';
  }

  /* A designed empty state, with a real next action. The words "No data" tell
     an operator nothing about whether the query is wrong, the filter is wrong,
     or the work is done. */
  function emptyFindings(){
    return '<div class="elite-empty">'
      +'<div class="elite-empty__mark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v5c0 4.4-3 8.3-7 9.5C8 19.3 5 15.4 5 11V6z"/><path d="M9 12l2 2 4-4"/></svg></div>'
      +'<h4>Clean on the last scan.</h4>'
      +'<p>Nothing the surface scan can see is currently broken on this URL. We will keep looking every Monday and tell you the moment that changes.</p>'
      +'<a class="btn btn-ghost" href="/#connect">Run the deep audit in your agent &rarr;</a></div>';
  }

  function stateEmpty(origin){
    return '<div class="panel"><div class="elite-empty">'
      +'<div class="elite-empty__mark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l3-7 4 14 3-7h4"/></svg></div>'
      +'<h4>No scans yet for '+esc(origin)+'.</h4>'
      +'<p>This URL has never been graded, so there is no history to draw. Enrol it below and the first scan runs immediately &mdash; the trend line starts building from Monday.</p>'
      +'</div></div>';
  }

  function stateError(msg){
    return '<div class="la-error">'
      +'<div class="la-error__mark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16v.5"/></svg></div>'
      +'<h4>We could not load that history.</h4><p>'+esc(msg)+'</p>'
      +'<a class="btn btn-ghost" href="/#grade">Run a fresh free scan instead &rarr;</a></div>';
  }

  function stateLoading(){
    return '<div class="panel"><div style="display:flex;gap:24px;align-items:center;flex-wrap:wrap">'
      +'<div class="skeleton" style="width:140px;height:140px;border-radius:50%;flex:none"></div>'
      +'<div style="flex:1;min-width:240px;display:grid;gap:10px">'
      +'<div class="skeleton skeleton-line" style="height:14px"></div>'
      +'<div class="skeleton skeleton-line" style="height:11px"></div>'
      +'<div class="skeleton skeleton-line" style="height:11px"></div></div></div>'
      +'<div class="loadbar" style="margin-top:18px"></div></div>';
  }

  function deltaChip(diff){
    if(!diff) return '';
    var d=diff.score_delta, cls=d>0?'up':d<0?'down':'flat', sign=d>0?'+':'';
    return '<span class="delta '+cls+'">'+sign+d+' since last scan</span>';
  }

  function render(data){
    var origin=data.origin;
    if(!data.latest){
      out.innerHTML=stateEmpty(origin)+enrollPanel(data,origin);
      wire(data,origin); return;
    }
    var L=data.latest, band=bandOf(L.score);
    var findings=(L.findings||[]);
    var wl=data.monitor||{};
    var mast=(wl.agency_name||wl.logo_url)?('<div style="display:none"></div>'):'';
    // white-label masthead (print only)
    var wlm=document.getElementById('wl-mast');
    wlm.innerHTML=(wl.logo_url?'<img src="'+esc(wl.logo_url)+'" alt="" />':'')+'<span class="wl-name">'+esc(wl.agency_name||'Launch Audit Report')+'</span><span class="wl-sub">'+esc(origin)+'<br/>'+esc(when(L.created_at))+'</span>';

    var c={critical:0,high:0,medium:0,low:0};
    findings.forEach(function(f){ if(c[f.severity]!=null) c[f.severity]++; });
    var runs=(data.history||[]).length;
    out.innerHTML=''
      +'<div class="panel band-'+band+'"><div class="head-row">'
        +(window.eliteGauge?window.eliteGauge(L.score,band,{small:true}):'<div class="bigscore">'+esc(L.score)+'<small>/100</small></div>')
        +'<div class="head-meta"><div class="u">'+esc(origin)+'</div><div class="when">Last scan '+esc(when(L.created_at))+' '+deltaChip(data.diff)+'</div>'+sparkline(data.history)+'</div>'
        +'<button class="btn btn-ghost no-print" id="pdf-btn">Export white-label PDF</button>'
      +'</div>'
      +'<div class="mstat">'
        +'<div class="c"><div class="v" data-count="'+runs+'">0</div><div class="k">scans on record</div></div>'
        +'<div class="c"><div class="v" data-count="'+findings.length+'">0</div><div class="k">open findings</div></div>'
        +'<div class="c"><div class="v" data-count="'+(c.critical+c.high)+'">0</div><div class="k">critical or high</div></div>'
        +'<div class="c"><div class="v" data-count="'+((data.diff&&data.diff.fixed_findings)?data.diff.fixed_findings.length:0)+'">0</div><div class="k">fixed since last scan</div></div>'
      +'</div></div>'
      +(data.diff&&(data.diff.new_findings.length||data.diff.fixed_findings.length)?
        '<div class="panel"><h2>What changed since last week</h2><div class="diff-cols">'
        +'<div class="diff-col"><h3>New ('+data.diff.new_findings.length+')</h3>'+(data.diff.new_findings.length?data.diff.new_findings.map(function(f){return '<div class="diff-item new">['+esc(f.severity)+'] '+esc(f.title)+'</div>';}).join(''):'<div class="muted">None</div>')+'</div>'
        +'<div class="diff-col"><h3>Fixed ('+data.diff.fixed_findings.length+')</h3>'+(data.diff.fixed_findings.length?data.diff.fixed_findings.map(function(f){return '<div class="diff-item fixed">'+esc(f.title)+'</div>';}).join(''):'<div class="muted">None</div>')+'</div>'
        +'</div></div>':'')
      +'<div class="panel"><h2>Current findings ('+findings.length+')</h2>'+findingsTable(findings)+'</div>'
      +enrollPanel(data,origin);
    wire(data,origin);
    if(window.eliteMotionRefresh) window.eliteMotionRefresh();
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
    out.innerHTML=stateLoading();
    try{
      var r=await fetch('/api/monitor?url='+encodeURIComponent(url));
      var d=await r.json();
      if(d&&d.ok){ input.value=d.origin; try{history.replaceState(null,'','/monitor?url='+encodeURIComponent(d.origin));}catch(e){} render(d); }
      else { out.innerHTML=stateError((d&&d.error)||'The monitoring lookup did not return a result for that URL.'); }
    }catch(err){ out.innerHTML=stateError('We could not reach the monitoring service. Check the URL and try again.'); }
  }

  form.addEventListener('submit',function(e){e.preventDefault();var u=(input.value||'').trim();if(u) load(u);});
  var pre=new URLSearchParams(location.search).get('url');
  if(pre){ input.value=pre; load(pre); }
})();
