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
  function table(list){
    var rows=(list||[]).slice().sort(function(a,b){ return ((SEV[a.severity]||SEV.low)[3])-((SEV[b.severity]||SEV.low)[3]); }).map(function(f,i){
      var m=SEV[f.severity]||SEV.low, fixId='rfx'+i;
      var fixCell=f.fix ? '<button type="button" class="fix-copy btn-flag" data-fix="'+esc(f.fix)+'" aria-describedby="'+fixId+'">'+copySvg()+'<span class="fc-label">Copy fix</span></button>' : '<span class="la-cat">&mdash;</span>';
      var detail='<tr class="'+m[2]+'"><td><span class="chip '+m[0]+' sev-chip">'+m[1]+'</span></td>'
        +'<td class="la-cat">'+esc(f.category||'')+'</td>'
        +'<td class="la-what"><b>'+esc(f.title)+'</b><span>'+esc(f.detail)+'</span></td>'
        +'<td class="num">'+fixCell+'</td></tr>';
      var fixRow=f.fix ? '<tr class="la-fixrow"><td colspan="4"><details id="'+fixId+'"><summary>Show the paste-ready fix for Claude Code or Cursor</summary><pre class="fix-body">'+esc(f.fix)+'</pre></details></td></tr>' : '';
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
        if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(text).then(ok,ok); } else { ok(); }
      });
    });
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
      +(table(g.findings)||clean())
      +'<div style="padding:18px 24px 22px;box-shadow:inset 0 1px 0 var(--elite-rule)">'+lighthouse(g)
      +'<p class="rep-note">'+note+'</p></div></div>';
    wireCopy(container);
    if(window.eliteMotionRefresh) window.eliteMotionRefresh();
  };
  window.auditReportCounts=counts;
})();
