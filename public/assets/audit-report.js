/* Shared report renderer for /order/success and /demo.
 * window.renderAuditReport(container, grade, opts) draws the same report the
 * buyer paid for: the score gauge, severity chips with colour AND glow, the
 * findings table with tabular-nums and paste-ready fixes, the Lighthouse strip,
 * and a designed empty state. External file because script-src is 'self'. */
(function(){
  function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  function lhv(v){return v==null?'&mdash;':v;}
  var SEV={critical:['chip-crit','Critical','la-row-crit',0],high:['chip-bad','High','la-row-high',1],
           medium:['chip-warn','Medium','la-row-med',2],low:['chip-info','Low','la-row-low',3]};
  function copySvg(){return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/></svg>';}

  function counts(list){ var c={critical:0,high:0,medium:0,low:0}; (list||[]).forEach(function(f){ if(c[f.severity]!=null) c[f.severity]++; }); return c; }
  function chips(c){ return ['critical','high','medium','low'].filter(function(k){return c[k]>0;}).map(function(k){ return '<span class="chip '+SEV[k][0]+' sev-chip">'+c[k]+' '+SEV[k][1]+'</span>'; }).join(''); }
  function sevbar(c){
    var t=c.critical+c.high+c.medium+c.low; if(!t) return '';
    function w(n){return (n/t*100).toFixed(1)+'%';}
    return '<div class="la-sevbar" aria-hidden="true"><i class="s-crit" style="width:'+w(c.critical)+'"></i><i class="s-high" style="width:'+w(c.high)+'"></i><i class="s-med" style="width:'+w(c.medium)+'"></i><i class="s-low" style="width:'+w(c.low)+'"></i></div>';
  }
  function table(list,state,all){
    state=state||{};all=all||list;
    var rows=(list||[]).slice().sort(function(a,b){ return ((SEV[a.severity]||SEV.low)[3])-((SEV[b.severity]||SEV.low)[3]); }).map(function(f,i){
      var m=SEV[f.severity]||SEV.low, index=all.indexOf(f), fixId='rfx'+index;
      var fixCell=f.fix ? '<button type="button" class="fix-copy btn-flag" data-fix="'+esc(f.fix)+'" aria-describedby="'+fixId+'">'+copySvg()+'<span class="fc-label">Copy fix</span></button>' : '<span class="la-cat">&mdash;</span>';
      var detail='<tr class="'+m[2]+'"><td><span class="chip '+m[0]+' sev-chip">'+m[1]+'</span></td>'
        +'<td class="la-cat">'+esc(f.category||'')+'</td>'
        +'<td class="la-what"><b>'+esc(f.title)+'</b><span>'+esc(f.detail)+'</span></td>'
        +'<td class="num">'+fixCell+'</td></tr>';
      var status=window.AuditReportTools ? '<label class="la-work-status">Repair status for '+esc(f.title)+'<select data-issue="'+index+'">'+window.AuditReportTools.states.map(function(s){return '<option'+((state[window.AuditReportTools.identity(f)]||'Open')===s?' selected':'')+'>'+s+'</option>';}).join('')+'</select></label>':'';
      var fixRow='<tr class="la-fixrow"><td colspan="4">'+status+(f.fix?'<details id="'+fixId+'"><summary>Show the suggested repair for your coding agent</summary><pre class="fix-body">'+esc(f.fix)+'</pre></details>':'')+'</td></tr>';
      return detail+fixRow;
    }).join('');
    if(!rows) return '';
    return '<div class="elite-table-wrap"><table class="elite-table is-compact"><thead><tr><th scope="col">Severity</th><th scope="col">Category</th><th scope="col">What we found, and why it costs you</th><th scope="col" class="num">Fix</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
  }
  function clean(){
    return '<div class="elite-empty" style="padding:36px 24px;">'
      +'<div class="elite-empty__mark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v5c0 4.4-3 8.3-7 9.5C8 19.3 5 15.4 5 11V6z"/><path d="M9 12l2 2 4-4"/></svg></div>'
      +'<h4 style="font-family:var(--font-display);font-size:20px;margin:0;color:var(--ink)">Nothing to fix at the URL level.</h4>'
      +'<p style="max-width:52ch;margin:0;color:var(--ink-soft);font-size:14.5px;line-height:1.6">Every check this run could answer from outside the app came back clean. That is the honest limit of a URL-only audit: it says nothing yet about broken access control, your admin API, or what your server hands a stranger who asks directly.</p>'
      +'<a class="btn" href="/#connect">Run the deep audit in your own agent &rarr;</a></div>';
  }
  function lighthouse(g){
    if(!g.lighthouse) return '';
    var l=g.lighthouse;
    return '<div class="lh-strip">'
      +'<div class="lh-cell"><div class="v">'+lhv(l.performance)+'</div><div class="k">Performance</div></div>'
      +'<div class="lh-cell"><div class="v">'+lhv(l.accessibility)+'</div><div class="k">Accessibility</div></div>'
      +'<div class="lh-cell"><div class="v">'+lhv(l.best_practices)+'</div><div class="k">Best practices</div></div>'
      +'<div class="lh-cell"><div class="v">'+lhv(l.seo)+'</div><div class="k">SEO</div></div>'
      +(l.lcp_ms!=null?'<div class="lh-cell"><div class="v">'+(Math.round(l.lcp_ms/100)/10)+'s</div><div class="k">LCP</div></div>':'')
      +(l.cls!=null?'<div class="lh-cell"><div class="v">'+Number(l.cls).toFixed(2)+'</div><div class="k">CLS</div></div>':'')
      +'</div>';
  }
  function wireCopy(root){
    root.querySelectorAll('.fix-copy').forEach(function(b){
      b.addEventListener('click', function(e){
        e.preventDefault();
        var text=b.getAttribute('data-fix')||'', lbl=b.querySelector('.fc-label');
        function ok(){ b.classList.add('copied'); if(lbl) lbl.textContent='Copied'; setTimeout(function(){b.classList.remove('copied'); if(lbl) lbl.textContent='Copy fix';},1500); }
        function failed(){
          if(lbl)lbl.textContent='Select text below';
          var id=b.getAttribute('aria-describedby'),detail=id&&root.querySelector('#'+id);
          if(detail)detail.open=true;
        }
        if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(text).then(ok,failed); } else { failed(); }
      });
    });
  }

  function workspace(container,g,opts){
    var T=window.AuditReportTools, host=container.querySelector('[data-audit-workspace]'), findings=container.querySelector('[data-audit-findings]');
    if(!T||!host||!findings)return;
    var snap=T.snapshot(g,opts),state=Object.create(null),edited=false,key=null,canStore=true;
    host.className='la-workspace';
    host.innerHTML='<h3>Your repair workspace</h3><p>Find the issue, track the repair, and hand your developer the evidence. Status stays in this browser for this report; marking an item ready does not verify a fix.</p>'
      +'<div class="la-workspace-controls"><label>Search findings<input type="search" data-search placeholder="Search issues, categories or evidence"></label>'
      +'<label>Severity<select data-severity><option value="">All severities</option><option>critical</option><option>high</option><option>medium</option><option>low</option></select></label>'
      +'<label>Repair status<select data-status><option value="">All statuses</option>'+T.states.map(function(s){return '<option>'+s+'</option>';}).join('')+'</select></label></div>'
      +'<div class="la-workspace-actions"><button class="btn" type="button" data-export="brief">Download repair brief</button>'
      +'<button class="btn ghost" type="button" data-export="csv">Export issue CSV</button><button class="btn ghost" type="button" data-export="json">Save report JSON</button>'
      +'<label class="btn ghost la-import">Compare earlier report<input type="file" data-baseline accept=".json,application/json" aria-label="Compare earlier report JSON"></label>'
      +'<button class="la-workspace-reset" type="button" data-reset>Reset repair statuses</button></div>'
      +'<p class="la-work-notice" role="status" aria-live="polite"></p><div class="la-comparison" aria-live="polite"></div>';
    var notice=host.querySelector('.la-work-notice'),compareBox=host.querySelector('.la-comparison');
    function say(message){notice.textContent=message;}
    function save(){
      if(!key)return;
      try{
        var packed=g.findings.map(function(f,i){return {index:i,status:state[T.identity(f)]||'Open'};}).filter(function(x){return x.status!=='Open';});
        if(packed.length)localStorage.setItem(key,JSON.stringify(packed));else localStorage.removeItem(key);
      }catch(e){canStore=false;say('Browser storage is unavailable. Status changes last for this visit only; export the issue CSV to keep them.');}
    }
    function draw(){
      var q=host.querySelector('[data-search]').value.toLowerCase(),sev=host.querySelector('[data-severity]').value,st=host.querySelector('[data-status]').value;
      var list=(g.findings||[]).filter(function(f){return (!sev||f.severity===sev)&&(!st||(state[T.identity(f)]||'Open')===st)&&(!q||[f.title,f.category,f.detail,f.fix].join(' ').toLowerCase().includes(q));});
      findings.innerHTML=list.length?table(list,state,g.findings):g.findings.length?'<p class="la-workspace-empty">No findings match these filters. Change the filters to see the remaining issues.</p>':clean();
      wireCopy(findings);
      findings.querySelectorAll('[data-issue]').forEach(function(select){select.addEventListener('change',function(){
        state[T.identity(g.findings[Number(select.dataset.issue)])]=select.value;edited=true;save();
        if(canStore)say(key?'Repair status saved in this browser. Re-scan to verify the change.':'Repair status updated; browser storage is initializing.');
        if(host.querySelector('[data-status]').value)draw();
      });});
      host.querySelector('[data-search]').setAttribute('aria-description',list.length+' of '+g.findings.length+' findings shown');
    }
    host.querySelector('[data-search]').addEventListener('input',draw);
    host.querySelectorAll('[data-severity],[data-status]').forEach(function(el){el.addEventListener('change',draw);});
    host.querySelector('[data-reset]').addEventListener('click',function(){state=Object.create(null);edited=true;save();draw();if(canStore)say('Manual repair statuses reset. Audit findings are unchanged.');});
    host.querySelectorAll('[data-export]').forEach(function(b){b.addEventListener('click',function(){
      var kind=b.dataset.export,content=kind==='brief'?T.brief(snap,state):kind==='csv'?T.csv(snap,state):JSON.stringify(snap,null,2);
      var blob=new Blob([content],{type:kind==='csv'?'text/csv;charset=utf-8':kind==='json'?'application/json':'text/markdown;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
      a.href=url;a.download='8020-'+(kind==='brief'?'repair-brief.md':kind==='csv'?'issues.csv':'report.json');document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(url);},1000);
      say('Export prepared from all '+snap.findings.length+' findings in this report, including hidden filter results. Review sensitive site details before sharing.');
    });});
    var importVersion=0;
    host.querySelector('[data-baseline]').addEventListener('change',async function(e){
      var file=e.target.files[0],version=++importVersion;e.target.value='';compareBox.innerHTML='';if(!file)return;
      try{
        if(file.size>2000000)throw new Error('Choose an 80/20 report JSON file smaller than 2 MB.');
        var previous=T.parse(await file.text());if(version!==importVersion)return;var delta=T.compare(previous,snap);
        function items(title,list){return list.length?'<h4>'+title+' ('+list.length+')</h4><ul>'+list.map(function(f){return '<li>'+esc(f.title)+' — '+esc(f.category)+'</li>';}).join('')+'</ul>':'';}
        compareBox.innerHTML='<h4>Compared with '+esc(file.name)+'</h4><p>Score change: '+(delta.score_delta>0?'+':'')+delta.score_delta+'. '+delta.unchanged+' observations unchanged. No longer observed means absent from this run; it does not establish that a repair is verified. Matching counts do not guarantee identical page coverage.</p>'
          +items('Newly observed',delta.added)+items('No longer observed',delta.no_longer_observed)
          +(delta.severity_changes.length?'<h4>Severity changes</h4><ul>'+delta.severity_changes.map(function(x){return '<li>'+esc(x.after.title)+': '+esc(x.before.severity)+' → '+esc(x.after.severity)+'</li>';}).join('')+'</ul>':'');
        say('Comparison ready. The selected file stayed in this browser; nothing was uploaded.');
      }catch(err){if(version===importVersion)say(err.message||'Could not compare that report.');}
    });
    draw();
    try{T.storageKey(snap).then(function(k){
      key=k;
      if(edited){save();return;}
      try{
        var saved=JSON.parse(localStorage.getItem(key)||'[]');
        if(Array.isArray(saved))saved.forEach(function(x){if(x&&Number.isInteger(x.index)&&g.findings[x.index]&&T.states.includes(x.status))state[T.identity(g.findings[x.index])]=x.status;});
        draw();
      }catch(e){canStore=false;say('Browser storage is unavailable. Export the issue CSV to keep your repair statuses.');}
    }).catch(function(){canStore=false;say('Browser storage is unavailable. Export the issue CSV to keep your repair statuses.');});}catch(e){canStore=false;say('Browser storage is unavailable. Export the issue CSV to keep your repair statuses.');}
  }

  window.renderAuditReport=function(container, g, opts){
    opts=opts||{};
    var c=counts(g.findings), pages=g.pages_scanned||1;
    var note = g.kind==='deep'
      ? 'Site-wide URL-only audit: <span class="tabular">'+pages+'</span> page'+(pages===1?'':'s')+' scanned, <span class="tabular">'+(g.checks_run||0)+'</span> check groups run, <span class="tabular">'+(g.passed||0)+'</span> passed. No browser, no login, no code left the buyer\'s machine. Broken access control, admin/RBAC, write-authz and authenticated flows need the deep audit: free in your own agent, or hands-on in the Deep Audit and Pro tiers.'
      : 'URL-only surface scan: <span class="tabular">'+(g.passed||0)+'</span> checks passed.';
    container.innerHTML='<div class="la-report">'
      +'<div class="la-report__head">'+(window.eliteGauge?window.eliteGauge(g.score,g.band):'')
        +'<div class="la-report__meta">'
          +'<p class="la-report__url">'+esc(g.url||'')+'</p>'
          +'<p class="la-report__sub">'+esc(g.summary)+'</p>'
          +'<div class="la-report__counts">'+chips(c)+'</div>'+sevbar(c)
        +'</div>'
      +'</div>'
      +'<div data-audit-workspace></div><div data-audit-findings>'+(table(g.findings)||clean())+'</div>'
      +'<div style="padding:18px 24px 22px;box-shadow:inset 0 1px 0 var(--elite-rule)">'+lighthouse(g)
      +'<p class="rep-note">'+note+'</p></div></div>';
    wireCopy(container);
    workspace(container,g,opts);
    if(window.eliteMotionRefresh) window.eliteMotionRefresh();
  };
  window.auditReportCounts=counts;
})();
