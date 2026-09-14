/* /order/success: THE DELIVERABLE.
 *
 * Polls /api/order-status for the paid audit and renders it at the level the
 * buyer paid for. Confirms the tier, the price and what happens next; collects
 * the site URL when the buyer paid before naming it (pay-first checkout);
 * shows the PDF download and the hosted link the moment they exist; and has a
 * designed state for every way this can end: still running, waiting for a URL,
 * blocked, refunded, clean, failed. External file because script-src is 'self'.
 */
(function(){
  var sid=new URLSearchParams(window.location.search).get('session_id')||'';
  var grade=document.getElementById('grade'), report=document.getElementById('report'), meta=document.getElementById('meta');
  var stGraded=document.getElementById('st-graded'), stReport=document.getElementById('st-report');
  var chipEl=document.getElementById('order-chip'), summary=document.getElementById('order-summary'), urlCard=document.getElementById('url-card');
  var actions=document.getElementById('report-actions');
  function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}
  function setChip(cls,text){ if(chipEl){ chipEl.className='chip '+cls+' sev-chip'; chipEl.textContent=text; } }
  function setHead(title, lead){
    var h=document.querySelector('h1'), l=document.querySelector('.lead'), pr=document.getElementById('promise');
    if(h) h.textContent=title;
    if(l) l.innerHTML=lead;
    if(pr && /refund/i.test(lead)) pr.hidden=true;
  }
  function refresh(){ if(window.eliteMotionRefresh) window.eliteMotionRefresh(); }
  function errBlock(title, body, extra){
    return '<div class="la-error"><div class="la-error__mark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16v.5"/></svg></div>'
      +'<h4>'+title+'</h4><p>'+body+'</p>'+(extra||'')+'</div>';
  }
  function loading(msg){
    return '<div class="card"><div style="display:flex;gap:26px;align-items:center;flex-wrap:wrap">'
      +'<div class="skeleton" style="width:168px;height:168px;border-radius:50%;flex:none"></div>'
      +'<div style="flex:1;min-width:260px;display:grid;gap:11px"><div class="skeleton skeleton-line" style="height:15px"></div><div class="skeleton skeleton-line" style="height:12px"></div><div class="skeleton skeleton-line" style="height:12px"></div><div class="skeleton skeleton-line" style="height:12px"></div></div></div>'
      +'<div class="loadbar" style="margin-top:20px"></div>'
      +'<p style="margin:14px 0 0;font-size:13.5px;color:var(--ink-mut)">'+msg+'</p></div>';
  }

  if(!/^cs_[A-Za-z0-9_]{8,200}$/.test(sid)){
    setChip('chip-warn','No order id');
    grade.classList.add('in'); // Terminal error must not wait for scroll-triggered reveal.
    grade.innerHTML=errBlock('This link has no order on it.',
      'The address is missing the session id Stripe adds after checkout. Open the link in your Stripe receipt, or send us the receipt number and we will find the order.',
      '<a class="btn ghost" href="/#contact">Contact us with your receipt &rarr;</a>');
    refresh(); return;
  }

  /* Order summary: tier, price, site, where the email goes, what happens next. */
  function renderSummary(d){
    if(!summary) return;
    var emailLine = d.email_hint ? 'PDF copy emailed to <b>'+esc(d.email_hint)+'</b>' : 'PDF copy emailed to the address on your receipt';
    var emailState = d.email_delivery
      ? (d.email_delivery.status==='sent' ? '<span class="chip chip-ok sev-chip">Email sent</span>'
        : d.email_delivery.status==='skipped' ? '<span class="chip chip-idle sev-chip" title="'+esc(d.email_delivery.detail||'')+'">Email pending: PDF below is your copy</span>'
        : '<span class="chip chip-warn sev-chip" title="'+esc(d.email_delivery.detail||'')+'">Email failed, PDF below</span>')
      : '';
    summary.hidden=false;
    summary.innerHTML='<div class="sum-grid">'
      +'<div><span class="k">Tier</span><b>'+esc(d.tier_label)+(d.hands_on?' <span class="chip chip-info sev-chip" style="margin-left:6px">Hands-on included</span>':'')+'</b></div>'
      +'<div><span class="k">Paid</span><b class="tabular">'+esc(d.amount_display)+'</b></div>'
      +'<div><span class="k">Site</span><b>'+(d.target_url?esc(d.target_url):'<em>not named yet</em>')+'</b></div>'
      +'<div><span class="k">Delivery</span><b>On this page, as a PDF, at a hosted link. '+emailLine+'.</b> '+emailState+'</div>'
      +'</div>'
      +'<p class="sum-includes"><b>Included:</b> '+esc(d.includes)+'</p>'
      +'<p class="sum-next"><b>What happens next:</b> '+esc(d.next)+'</p>';
  }

  function renderActions(d){
    if(!actions) return;
    if(!d.report_url && !d.report_pdf_url){ actions.hidden=true; return; }
    actions.hidden=false;
    actions.innerHTML=(d.report_pdf_url?'<a class="btn" href="'+esc(d.report_pdf_url)+'" target="_blank" rel="noopener">Download the PDF</a>':'')
      +(d.report_url && d.report_url!==d.report_pdf_url?'<a class="btn ghost" href="'+esc(d.report_url)+'" target="_blank" rel="noopener">Open the hosted copy</a>':'')
      +'<button type="button" class="btn ghost" id="copy-link">Copy this page link</button>';
    var cl=document.getElementById('copy-link');
    if(cl) cl.addEventListener('click', function(){ var t=window.location.href; function ok(){cl.textContent='Link copied'; setTimeout(function(){cl.textContent='Copy this page link';},1500);} if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(t).then(ok,ok);} else ok(); });
  }

  /* Pay-first checkout: the buyer names the site here, once. */
  function renderUrlForm(d){
    if(!urlCard) return;
    urlCard.hidden=false;
    urlCard.innerHTML='<h3>One thing left: which site should we audit?</h3>'
      +'<p>Your payment for the <b>'+esc(d.tier_label)+'</b> ('+esc(d.amount_display)+') is confirmed. Enter the public URL of the app and the audit starts the moment you submit.</p>'
      +'<form id="url-form" novalidate><input id="url-input" type="url" inputmode="url" autocomplete="url" placeholder="https://your-app.com" aria-label="App URL to audit" required />'
      +'<label class="consent" for="url-authorized"><input type="checkbox" id="url-authorized" /><span>I own this site or I am authorised to test it. I have read the <a href="/terms">terms</a> and the <a href="/refunds">refund policy</a>.</span></label>'
      +'<button class="btn" type="submit" id="url-btn">Start the audit &rarr;</button><div id="url-err" class="cf-result err" hidden></div></form>';
    var f=document.getElementById('url-form'), btn=document.getElementById('url-btn'), err=document.getElementById('url-err');
    f.addEventListener('submit', async function(e){
      e.preventDefault();
      var url=(document.getElementById('url-input').value||'').trim();
      var ok=!!(document.getElementById('url-authorized')||{}).checked;
      err.hidden=true;
      if(!url){ err.hidden=false; err.textContent='Enter the URL of the app to audit.'; return; }
      if(!ok){ err.hidden=false; err.textContent='Tick the box to confirm you own this site or are authorised to test it.'; return; }
      var prev=btn.textContent; btn.disabled=true; btn.textContent='Starting...';
      try{
        var r=await fetch('/api/order-url',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({session_id:sid,url:url,authorized:true})});
        var res=await r.json();
        if(res&&res.ok){ urlCard.hidden=true; tries=0; poll(); return; }
        err.hidden=false; err.textContent=(res&&res.error)||'Could not save the URL. Try again.';
      }catch(ex){ err.hidden=false; err.textContent='Could not reach the order service. Try again.'; }
      btn.disabled=false; btn.textContent=prev;
    });
  }

  var tries=0, delay=3000;
  async function poll(){
    tries++;
    try{
      var r=await fetch('/api/order-status?session_id='+encodeURIComponent(sid),{cache:'no-store'});
      // Retry service failures without stranding a buyer on an error page.
      if(r.status>=500 || r.status===429) throw new Error('Order service temporarily unavailable');
      var d=await r.json();
      if(!d||!d.ok){
        setChip('chip-bad','Not found');
        grade.innerHTML=errBlock('We could not load your order.', esc((d&&d.error)||'The order lookup failed.'), '<a class="btn ghost" href="/#contact">Contact us with your receipt &rarr;</a>');
        refresh(); return;
      }
      if(d.status==='pending'){
        setChip('chip-info','Syncing');
        if(tries<40){ grade.innerHTML=loading('Waiting for Stripe to confirm the payment, then the audit starts. This usually takes 30 to 60 seconds.'); refresh(); setTimeout(poll, delay); return; }
        grade.innerHTML=errBlock('We have not confirmed your order yet.',
          'Keep this link and reload it in a few minutes; it is permanent. If it is still empty after an hour, send us the Stripe receipt number and we will finish it by hand or refund it.',
          '<a class="btn ghost" href="/#contact">Send us the receipt number &rarr;</a>');
        refresh(); return;
      }
      var paidStep=document.getElementById('st-paid');
      if(paidStep){
        var paymentConfirmed=['awaiting_url','queued','graded','delivered','blocked'].indexOf(d.status)!==-1;
        paidStep.className=paymentConfirmed?'done':'';
        paidStep.innerHTML=paymentConfirmed?'<b>Paid</b>Payment confirmed.':'<b>Payment</b>'+esc(d.status==='payment_failed'?'Payment failed.':d.status==='refunded'?'Refunded.':d.status==='disputed'?'Disputed.':'Checking status.');
      }
      if(d.status==='payment_failed'){
        setChip('chip-bad','Payment failed');
        setHead('Your payment did not complete.','This order cannot run because payment failed. Check your payment method before trying again.');
        stGraded.className=''; if(stReport)stReport.hidden=true;
        report.hidden=true;
        if(summary) summary.hidden=true;
        if(actions) actions.hidden=true;
        if(urlCard) urlCard.hidden=true;
        grade.innerHTML=errBlock('No report is available for this order.',
          'You can return to checkout to try another payment method. If your bank shows a completed charge, contact us with this order link before paying again.',
          '<a class="btn" href="/#order">Return to checkout &rarr;</a> <a class="btn ghost" href="/#contact">Contact support &rarr;</a>');
        refresh(); return;
      }
      renderSummary(d);
      renderActions(d);
      meta.innerHTML='Order for '+(d.target_url?esc(d.target_url):'a site you have not named yet')+' &middot; '+esc(d.tier_label)+' &middot; '+esc(d.amount_display)+' &middot; order link: '+esc(window.location.href);

      if(d.status==='awaiting_url'){
        setChip('chip-info','Needs your URL');
        setHead('Paid. Tell us which site to audit.','Your '+esc(d.tier_label)+' is paid for. Name the site below and the audit starts immediately; the report lands on this page and in your inbox.');
        stGraded.className=''; renderUrlForm(d);
        grade.innerHTML=''; refresh(); return;
      }
      if(urlCard) urlCard.hidden=true;

      if(d.status==='blocked'){
        setChip('chip-warn',d.refunded?'Refunded':'Refund pending');
        setHead(d.refunded?'We could not audit that site, so we refunded you.':'We could not audit that site. Your refund needs confirmation.',
                'The scanner could not read '+esc(d.target_url)+' as a normal page, and grading what it did get back would have been a report about somebody else&rsquo;s HTML. '+(d.refunded?'The refund has been issued.':'A completed refund has not yet been confirmed.'));
        stGraded.className='now'; if(stReport)stReport.hidden=true;
        grade.innerHTML=errBlock('We could not read '+esc(d.target_url)+', so we will not grade it.',
          esc(d.blocked||d.grade_error||'The site did not answer as a normal page.')+' Grading a bot wall would be a report full of failures about somebody else&rsquo;s HTML. That is a refund, not a report.',
          '<p style="margin:6px 0 0;font-size:13.5px;color:var(--ink-mut);max-width:52ch">'
          +(d.refunded?'Your payment has been refunded in full; allow up to 5 business days for it to show on your card.'
                      :'This run qualifies for a full refund under our <a href="/refunds" style="color:var(--accent-ink)">refund policy</a>, but we have not confirmed it was issued. <a href="/#contact">Contact us with this order link</a> so we can complete it.')+'</p>');
        report.hidden=false;
        report.innerHTML='<p style="margin:0;font-size:13.5px;color:var(--ink-mut);line-height:1.65">Common causes: a bot wall or challenge page, a login wall on the home page, or the site being down. Once the public pages answer normally, order again and it will run. Or run it from your own machine, where there is nothing to block: <a href="/#connect" style="color:var(--accent-ink)">connect your agent</a>.</p>';
        refresh(); return;
      }
      if(d.status==='refunded'||d.status==='disputed'){
        setChip('chip-idle',d.status==='refunded'?'Refunded':'Disputed');
        setHead('This order is closed.','The payment was '+esc(d.status)+', so the report is no longer served on this link.');
        stGraded.className=''; if(stReport)stReport.hidden=true;
        grade.innerHTML=errBlock('This order was '+esc(d.status)+'.','The report is no longer available on this link. The free surface scan and the open-source deep audit are both still yours to run.', '<a class="btn ghost" href="/#grade">Run the free scan &rarr;</a>');
        refresh(); return;
      }
      if(d.grade){
        setChip('chip-ok','Report ready');
        setHead('Your report is ready.','Below is everything the site-wide URL audit found on '+esc(d.target_url)+', worst first, with a plain-English line on why each one costs you. The PDF is on its way to your inbox and stays at the links below; this page keeps working too.');
        stGraded.className='done'; if(stReport)stReport.className='done';
        window.renderAuditReport(grade, d.grade, {});
        report.hidden=false;
        report.innerHTML=d.hands_on
          ? '<p style="font-family:var(--font-display);font-size:18px;margin:0 0 6px">Automated report delivered. The hands-on part is next.</p><p style="margin:0;font-size:13.5px;color:var(--ink-mut);line-height:1.65">'+esc(d.next)+' Reply to the report email with anything we should know first (staging URL, test login for Pro, areas you care most about).</p>'
          : '<p style="font-family:var(--font-display);font-size:18px;margin:0 0 6px">Single Run complete.</p><p style="margin:0;font-size:13.5px;color:var(--ink-mut);line-height:1.65">Want the deep audit in a real browser, with broken access control, admin/RBAC, accessibility and performance and evidence for every check? It is free in <a href="/#connect" style="color:var(--accent-ink)">your own agent</a>, or order the <a href="/#order" style="color:var(--accent-ink)">Deep Audit</a> and we do it by hand.</p>';
      }
      else if(d.grade_error){
        var retrying=d.status==='queued' && tries<40;
        setChip(retrying?'chip-info':'chip-bad',retrying?'Retrying':'Scan delayed');
        stGraded.className='now';
        grade.innerHTML=errBlock('The scan could not finish for '+esc(d.target_url)+'.',
          esc(d.grade_error)+(retrying?' We will retry automatically; keep this order link.':' Keep this order link and reload in a few minutes. If it still fails, contact us so we can finish the report or arrange a refund under our refund policy.'),
          '<a class="btn ghost" href="/#contact">Send us this order link &rarr;</a>');
        refresh();
        if(retrying) setTimeout(poll, delay);
      }
      else {
        setChip('chip-info','Running');
        stGraded.className='now';
        grade.innerHTML=loading('Running your site audit: up to eight pages, 30 to 60 seconds. This page updates itself; you do not need to reload.');
        refresh();
        if(tries<40) setTimeout(poll, delay);
      }
      refresh();
    }catch(err){
      if(tries<40) setTimeout(poll, delay);
      else { setChip('chip-bad','Offline');
        grade.innerHTML=errBlock('We could not reach the order service.','Your order is safe and this link is permanent; reload the page to try again.', '<a class="btn ghost" href="">Reload &rarr;</a>');
        refresh(); }
    }
  }
  grade.innerHTML=loading('Waiting for payment confirmation and running your site audit. This usually takes 30 to 60 seconds.');
  poll();
})();
