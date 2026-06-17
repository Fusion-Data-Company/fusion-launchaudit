/* LaunchAudit landing — tabs, copy buttons, hero reveal (external for CSP script-src 'self') */
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
