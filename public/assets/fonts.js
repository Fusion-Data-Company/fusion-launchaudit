/* Loads the Google Fonts stylesheet without blocking first paint. CSP forbids
 * inline onload handlers, so the swap happens here: system fonts render at
 * once (display=swap), the web fonts arrive a moment later. */
(function(){
  var l=document.createElement('link'); l.rel='stylesheet';
  l.href=document.documentElement.getAttribute('data-fonts')||'';
  if(l.href) document.head.appendChild(l);
})();
