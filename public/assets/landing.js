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

(function(){
  // ---- Hero cinematic reveal: play once, freeze last frame, fade in the card ----
  var hero = document.getElementById('top-hero');
  if(!hero) return;
  var video = hero.querySelector('.hero-video');
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduced || !video){ hero.classList.add('is-revealed'); return; }
  hero.classList.add('js-cinematic');           // hides the card until reveal
  var done = false;
  function reveal(){ if(done) return; done = true; hero.classList.add('is-revealed'); }
  video.addEventListener('ended', reveal);      // primary: when the clip finishes
  video.addEventListener('error', reveal);      // CDN/url failure -> show card now
  setTimeout(reveal, 8500);                      // safety: never leave the card hidden
})();


(function(){
  // ---- Free instant grader ----
  var form=document.getElementById('grade-form'); if(!form) return;
  var out=document.getElementById('grade-result'), btn=document.getElementById('grade-btn');
  function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  var sevColor={critical:'#f0696a',high:'#f0696a',medium:'#e0b23c',low:'#9aa0b4'};
  function render(d){
    var items=(d.findings||[]).map(function(f){return '<li class="gf"><span class="gf-sev" style="color:'+sevColor[f.severity]+'">'+esc(f.severity)+'</span><span class="gf-txt"><b>'+esc(f.title)+'</b><span>'+esc(f.detail)+'</span></span></li>';}).join('');
    out.innerHTML='<div class="grade-card"><div class="grade-score band-'+esc(d.band)+'"><span class="gs-num">'+d.score+'</span><span class="gs-den">/ 100</span><span class="gs-cap">readiness</span></div>'
      +'<div class="grade-body"><p class="grade-sum">'+esc(d.summary)+'</p>'
      +(items?'<ul class="grade-list">'+items+'</ul>':'<p class="grade-clean">No surface issues found — nice.</p>')
      +'<p class="grade-note">'+esc(d.note)+'</p>'
      +'<a class="btn btn-primary" href="#connect">Run the deep audit — free →</a></div></div>';
  }
  form.addEventListener('submit', async function(e){
    e.preventDefault();
    var url=(document.getElementById('grade-url').value||'').trim(); if(!url) return;
    var prev=btn.textContent; btn.disabled=true; btn.textContent='Scanning…';
    out.hidden=false; out.innerHTML='<div class="grade-loading">Running the surface scan… (10s)</div>';
    try{
      var r=await fetch('/api/grade',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url:url})});
      var d=await r.json();
      if(d && d.ok){ render(d); } else { out.innerHTML='<div class="grade-err">'+esc((d&&d.error)||'Scan failed — try again.')+'</div>'; }
    }catch(err){ out.innerHTML='<div class="grade-err">Scan failed — check the URL and try again.</div>'; }
    btn.disabled=false; btn.textContent=prev;
  });
})();
