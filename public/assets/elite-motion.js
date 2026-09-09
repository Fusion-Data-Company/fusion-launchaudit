/* ═══════════════════════════════════════════════════════════════════════════
 * elite-motion.js — the FDC elite kit's motion engine, ported to vanilla.
 *
 * ONE shared rAF scroll pass drives every behaviour. There is no listener per
 * element and there is deliberately NO IntersectionObserver.
 *
 *   An observer only fires when the intersection ratio CHANGES. An element
 *   that skips the viewport entirely — an anchor jump, a restored scroll
 *   position, a fast flick on a phone, scrollTo() — goes from below the fold
 *   to above it with the ratio pinned at zero, never fires, and stays
 *   invisible forever. That left 35 elements blank on a deployed page.
 *
 * The pass instead asks a question that cannot get stuck: is the top of this
 * element above the trigger line yet. Anything scrolled past is revealed.
 * ═════════════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var saveData = navigator.connection && navigator.connection.saveData;

  var reveals = [];   // { el }
  var parallax = [];  // { el, depth }
  var counters = [];  // { el, to, from, dur, dp, prefix, suffix, started, t0 }
  var pins = [];      // { el, stage, plate }
  var rails = [];     // { el }  progress bars
  var queued = false;

  /* ---- collect ---------------------------------------------------------- */
  function collect() {
    reveals = [];
    parallax = [];
    counters = [];
    pins = [];
    rails = [];

    var i, el, list;

    list = document.querySelectorAll(".reveal, .elite-stagger, [data-reveal]");
    for (i = 0; i < list.length; i++) {
      el = list[i];
      if (el.classList.contains("in")) continue;
      reveals.push({ el: el });
    }

    /* Parallax is skipped under 768px on purpose: phones scroll with the
       address bar resizing the viewport, and parallax there reads as jitter,
       not as depth. */
    if (!reduced && window.innerWidth >= 768) {
      list = document.querySelectorAll("[data-parallax]");
      for (i = 0; i < list.length; i++) {
        el = list[i];
        parallax.push({ el: el, depth: parseFloat(el.getAttribute("data-parallax")) || 0.12 });
      }
    }

    list = document.querySelectorAll("[data-count]");
    for (i = 0; i < list.length; i++) {
      el = list[i];
      /* A finished counter is finished. Without this flag a resize — and a
         full-page screenshot IS a resize — re-collects it, restarts it from
         zero, and a figure that had landed reads 0 again for a second. */
      if (el.hasAttribute("data-counted")) continue;
      counters.push({
        el: el,
        to: parseFloat(el.getAttribute("data-count")),
        from: parseFloat(el.getAttribute("data-count-from") || "0"),
        dur: parseFloat(el.getAttribute("data-count-dur") || "1400"),
        dp: parseInt(el.getAttribute("data-count-dp") || "0", 10),
        prefix: el.getAttribute("data-count-prefix") || "",
        suffix: el.getAttribute("data-count-suffix") || "",
        started: false, done: false, t0: 0
      });
    }

    list = document.querySelectorAll(".la-pin");
    for (i = 0; i < list.length; i++) {
      el = list[i];
      pins.push({
        el: el,
        stage: el.querySelector(".la-pin__stage"),
        plate: el.querySelector(".la-pin__plate")
      });
    }

    list = document.querySelectorAll("[data-scroll-progress]");
    for (i = 0; i < list.length; i++) rails.push({ el: list[i] });
  }

  /* ---- the single pass -------------------------------------------------- */
  function pass() {
    queued = false;
    var vh = window.innerHeight || document.documentElement.clientHeight;
    var y = window.scrollY || window.pageYOffset || 0;
    var trigger = vh * 0.86;
    var now = performance.now();
    var i, r, box;

    /* Reveal — once, never back out. */
    for (i = reveals.length - 1; i >= 0; i--) {
      r = reveals[i];
      box = r.el.getBoundingClientRect();
      if (box.top < trigger) {
        r.el.classList.add("in");
        reveals.splice(i, 1);
      }
    }

    /* Parallax — values written straight to the DOM in the same pass. */
    for (i = 0; i < parallax.length; i++) {
      r = parallax[i];
      box = r.el.getBoundingClientRect();
      if (box.bottom < -200 || box.top > vh + 200) continue;
      var centre = box.top + box.height / 2 - vh / 2;
      r.el.style.transform = "translate3d(0," + (-centre * r.depth).toFixed(2) + "px,0)";
    }

    /* Counter — with the hidden-tab guard. A background tab never composites,
       so rAF never fires and the number would sit at 0. A money surface
       reading "0 issues found" beside a report listing twelve is not blank,
       it is confidently wrong. So a counter that was reached while hidden is
       snapped to its final value the moment the tab is shown. */
    for (i = counters.length - 1; i >= 0; i--) {
      r = counters[i];
      box = r.el.getBoundingClientRect();
      if (!r.started) {
        if (box.top > trigger) continue;
        if (reduced || document.hidden) { finishCount(r); counters.splice(i, 1); continue; }
        r.started = true; r.t0 = now;
      }
      if (document.hidden) { finishCount(r); counters.splice(i, 1); continue; }
      var p = Math.min(1, (now - r.t0) / r.dur);
      var eased = 1 - Math.pow(1 - p, 3);
      writeCount(r, r.from + (r.to - r.from) * eased);
      if (p >= 1) { r.el.setAttribute("data-counted", ""); counters.splice(i, 1); }
    }

    /* Pinned — the pin track's HEIGHT is the pin duration. Use once a page. */
    for (i = 0; i < pins.length; i++) {
      r = pins[i];
      box = r.el.getBoundingClientRect();
      var span = r.el.offsetHeight - vh;
      var prog = span > 0 ? Math.min(1, Math.max(0, -box.top / span)) : 0;
      r.el.style.setProperty("--pin", prog.toFixed(4));
      if (r.plate && !reduced) {
        r.plate.style.transform = "scale(" + (1.08 - prog * 0.08).toFixed(4) + ") translate3d(0," + (prog * -26).toFixed(2) + "px,0)";
      }
    }

    /* Scroll rail. */
    if (rails.length) {
      var doc = document.documentElement;
      var max = doc.scrollHeight - vh;
      var pct = max > 0 ? (y / max) : 0;
      for (i = 0; i < rails.length; i++) rails[i].el.style.transform = "scaleX(" + pct.toFixed(4) + ")";
    }

    if (counters.length || parallax.length || pins.length) schedule();
  }

  function writeCount(r, v) {
    var n = r.dp > 0 ? v.toFixed(r.dp) : Math.round(v).toString();
    if (r.dp === 0 && r.to >= 1000) n = Number(n).toLocaleString("en-US");
    r.el.textContent = r.prefix + n + r.suffix;
  }
  function finishCount(r) { writeCount(r, r.to); r.el.setAttribute("data-counted", ""); }

  function schedule() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(pass);
  }

  /* ---- wiring ----------------------------------------------------------- */
  function start() {
    collect();
    /* Under reduced motion the rule is REMOVE, not shorten: reveal
       everything immediately rather than landing a 14px teleport. */
    if (reduced) {
      for (var i = 0; i < reveals.length; i++) reveals[i].el.classList.add("in");
      reveals = [];
    }
    schedule();
  }

  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", function () { collect(); schedule(); }, { passive: true });
  /* A tab shown again re-runs the pass, which is where a counter that was
     reached while hidden gets snapped to its real value. */
  document.addEventListener("visibilitychange", schedule);

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();

  /* Content injected later (the free-scan result, a monitor refresh) calls
     this to enrol its new nodes in the same pass. */
  window.eliteMotionRefresh = function () { collect(); schedule(); };

  /* ---- HeroVideo: never mount at all on saveData or reduced motion ------- */
  if (reduced || saveData) {
    var vids = document.querySelectorAll("video[data-elite-hero]");
    for (var v = 0; v < vids.length; v++) {
      var vid = vids[v];
      try { vid.pause(); } catch (e) {}
      vid.removeAttribute("autoplay");
      vid.preload = "none";
      /* The poster is the degraded path and it is good enough to be the real
         one — a contractor on a metered phone gets the plate. */
      var poster = vid.getAttribute("poster");
      if (poster) {
        var img = document.createElement("img");
        img.src = poster; img.alt = vid.getAttribute("data-alt") || "";
        img.style.cssText = "display:block;width:100%;height:auto;";
        vid.parentNode.replaceChild(img, vid);
      }
    }
  }
})();

/* ═══════════════════════════════════════════════════════════════════════════
 * The score gauge. Drawn, not faked: a real arc whose stroke-dashoffset is
 * the score, with the band colour and the tick ring the kit's trim reads.
 * ═════════════════════════════════════════════════════════════════════════ */
window.eliteGauge = function (score, band, opts) {
  opts = opts || {};
  var R = 74, C = 2 * Math.PI * R;
  var s = Math.max(0, Math.min(100, Number(score) || 0));
  var cls = band === "green" ? "is-green" : band === "yellow" ? "is-yellow" : band === "blocked" ? "is-blocked" : "is-red";
  var label = band === "blocked" ? "Blocked" : band === "green" ? "Launch ready" : band === "yellow" ? "Needs work" : "Not ready";
  var ticks = "";
  for (var t = 0; t < 40; t++) {
    var a = (t / 40) * Math.PI * 2;
    var r1 = R + 12, r2 = R + (t % 5 === 0 ? 18 : 15);
    ticks += '<line x1="' + (90 + Math.cos(a) * r1).toFixed(2) + '" y1="' + (90 + Math.sin(a) * r1).toFixed(2) +
             '" x2="' + (90 + Math.cos(a) * r2).toFixed(2) + '" y2="' + (90 + Math.sin(a) * r2).toFixed(2) + '"/>';
  }
  return '<div class="la-gauge ' + cls + (opts.small ? " is-sm" : "") + '" role="img" aria-label="Readiness score ' + s + ' out of 100, ' + label + '">' +
    '<svg viewBox="0 0 180 180" aria-hidden="true">' +
      '<g class="la-gauge__ticks">' + ticks + '</g>' +
      '<circle class="la-gauge__track" cx="90" cy="90" r="' + R + '"/>' +
      '<circle class="la-gauge__arc" cx="90" cy="90" r="' + R + '" stroke-dasharray="' + C.toFixed(2) + '" stroke-dashoffset="' + (C * (1 - s / 100)).toFixed(2) + '"/>' +
    '</svg>' +
    '<div class="la-gauge__face">' +
      '<div class="la-gauge__num">' + (band === "blocked" ? "&mdash;" : s) + '</div>' +
      '<div class="la-gauge__den">' + (band === "blocked" ? "NO READ" : "/ 100") + '</div>' +
      '<div class="la-gauge__band">' + label + '</div>' +
    '</div>' +
  '</div>';
};
