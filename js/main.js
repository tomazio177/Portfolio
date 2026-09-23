/* ==========================================================================
   Portfólio — comportamento
   Porte direto da lógica do design original (Portfolio.dc.html),
   com guardas para touch e prefers-reduced-motion.
   ========================================================================== */
(function () {
  'use strict';

  var q  = function (s) { return document.querySelector(s); };
  var qa = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var coarse       = window.matchMedia('(hover: none), (pointer: coarse)').matches;
  /* efeitos que dependem de um ponteiro fino (cursor, parallax, tilt, scroll suave) */
  var rich = !reduceMotion && !coarse;

  var loader  = q('[data-loader]');
  var bar     = q('[data-bar]');
  var count   = q('[data-count]');
  var lis     = qa('[data-li]');
  var objs    = qa('[data-obj]');
  var reveals = qa('[data-reveal]');
  var cursor  = q('[data-cursor]');
  var dot     = q('[data-dot]');
  var track   = q('[data-track]');
  var thumb   = q('[data-thumb]');

  /* já viu o loader nesta sessão? então entra direto no site */
  var skipLoader = document.documentElement.classList.contains('loader-skip');

  var yearEl = q('[data-year]');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ------------------------------------------------------------------------
     Loader: entrada escalonada dos objetos + contador
     ------------------------------------------------------------------------ */
  if (!skipLoader) lis.forEach(function (el, i) {
    setTimeout(function () {
      el.style.opacity = '1';
      el.style.transform = 'translateY(0) scale(1)';
    }, 220 + i * 260);
  });

  var srcs = ['assets/obj-dice.webp', 'assets/obj-figure.webp', 'assets/obj-rose.webp', 'assets/obj-flower.webp'];
  var loadedCount = 0;
  srcs.forEach(function (s) {
    var im = new Image();
    im.onload = im.onerror = function () { loadedCount++; };
    im.src = s;
  });

  var revealed = false;

  function reveal() {
    if (revealed) return;
    revealed = true;
    try { sessionStorage.setItem('loader-visto', '1'); } catch (err) { /* modo privado */ }

    if (count) count.textContent = '100';
    if (bar) bar.style.width = '100%';

    lis.forEach(function (el, i) {
      setTimeout(function () {
        el.style.transform = 'translateY(-30px) scale(1.06)';
        el.style.opacity = '0';
      }, i * 90);
    });

    setTimeout(function () {
      if (loader) {
        loader.style.opacity = '0';
        loader.style.visibility = 'hidden';
      }
      objs.forEach(function (el, i) {
        setTimeout(function () { el.style.opacity = '1'; }, i * 160);
      });
      reveals.forEach(function (el) {
        el.style.opacity = '1';
        el.style.transform = 'translateY(0)';
        el.classList.add('is-in');
      });
      if (rich) {
        if (cursor) cursor.style.opacity = '1';
        if (dot) dot.style.opacity = '1';
      }
    }, reduceMotion || skipLoader ? 0 : 620);
  }

  var start = performance.now();
  var minMs = reduceMotion ? 400 : 2600;
  var shown = 0;

  function tickProgress() {
    var t = (performance.now() - start) / minMs;
    var target = Math.min(1, Math.min(t, 0.25 + 0.75 * (loadedCount / srcs.length))) * 100;
    shown += (target - shown) * 0.06;
    var v = Math.min(100, Math.round(shown));
    if (count) count.textContent = String(v);
    if (bar) bar.style.width = v + '%';
    if (v >= 100) { reveal(); return; }
    requestAnimationFrame(tickProgress);
  }
  if (skipLoader) {
    reveal();
  } else {
    requestAnimationFrame(tickProgress);
    /* rede de segurança: se o rAF não disparar (separador em segundo plano) */
    setTimeout(reveal, reduceMotion ? 900 : 4200);
  }

  /* ------------------------------------------------------------------------
     Cursor personalizado
     ------------------------------------------------------------------------ */
  var mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  var ring  = { x: mouse.x, y: mouse.y };
  var soft  = { x: 0, y: 0 };

  if (rich) {
    window.addEventListener('mousemove', function (e) {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    }, { passive: true });

    bindCursorHover(document);
  }

  /* liga o crescimento do anel a todos os <a>/<button> ainda não ligados —
     chamada outra vez sempre que entram cards novos no DOM */
  function bindCursorHover(scope) {
    if (!rich) return;
    Array.prototype.slice.call(scope.querySelectorAll('a, button')).forEach(function (el) {
      if (el.dataset.cursorBound) return;
      el.dataset.cursorBound = '1';
      el.addEventListener('mouseenter', function () { if (cursor) cursor.classList.add('is-hover'); });
      el.addEventListener('mouseleave', function () { if (cursor) cursor.classList.remove('is-hover'); });
    });
  }

  /* ------------------------------------------------------------------------
     Nav: fundo translucido assim que a pagina descola do topo.
     Feedback de estado — mantem os links legiveis por cima do conteudo.
     ------------------------------------------------------------------------ */
  var stuckEls = qa('.nav, .brand');
  var sentinel = q('[data-nav-sentinel]');
  if (stuckEls.length && sentinel && 'IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      stuckEls.forEach(function (el) {
        el.classList.toggle('is-stuck', !entries[0].isIntersecting);
      });
    }).observe(sentinel);
  }

  /* ------------------------------------------------------------------------
     Botoes magneticos: o botao inclina-se na direcao do ponteiro.
     Feedback — diz que o alvo esta vivo antes do clique.
     Escreve direto em `translate` (propriedade de compositor), sem estado.
     ------------------------------------------------------------------------ */
  function bindMagnetic(scope) {
    if (!rich) return;
    Array.prototype.slice.call(scope.querySelectorAll('.btn')).forEach(function (el) {
      if (el.dataset.magnetBound) return;
      el.dataset.magnetBound = '1';
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        var dx = (e.clientX - (r.left + r.width / 2)) / r.width;
        var dy = (e.clientY - (r.top + r.height / 2)) / r.height;
        el.style.translate = (dx * 10).toFixed(2) + 'px ' + (dy * 6).toFixed(2) + 'px';
      });
      el.addEventListener('pointerleave', function () { el.style.translate = ''; });
      el.addEventListener('blur', function () { el.style.translate = ''; });
    });
  }
  bindMagnetic(document);

  /* ------------------------------------------------------------------------
     "hello" reage ao rato: inclina e brilha
     ------------------------------------------------------------------------ */
  var hello = q('.hello');
  var helloImg = hello && hello.querySelector('img');
  var ht = { x: 0, y: 0 }, hc = { x: 0, y: 0 }, hs = 1, hsT = 1;

  if (hello && rich) {
    hello.style.pointerEvents = 'auto';
    hello.addEventListener('mouseenter', function () { hsT = 1.05; });
    hello.addEventListener('mouseleave', function () { hsT = 1; ht.x = 0; ht.y = 0; });
    hello.addEventListener('mousemove', function (e) {
      var r = hello.getBoundingClientRect();
      ht.x = ((e.clientX - r.left) / r.width - 0.5) * 2;
      ht.y = ((e.clientY - r.top) / r.height - 0.5) * 2;
    });
  }

  /* ------------------------------------------------------------------------
     Scroll suave: intercepta a roda e anima o scrollTop do container real
     ------------------------------------------------------------------------ */
  var scroller = q('[data-scroll]');
  var scrollEl = document.scrollingElement || document.documentElement;
  /* ease: 0.025 é o valor do design (roda do rato, bem lento);
     as âncoras usam um valor mais rápido para não demorarem segundos a chegar */
  var sc = { target: 0, current: 0, max: 1, animating: false, ease: 0.025 };

  function maxOf() { return Math.max(1, scrollEl.scrollHeight - scrollEl.clientHeight); }

  function measure() {
    sc.max = maxOf();
    if (thumb && track) {
      var ratio = scrollEl.clientHeight / Math.max(1, scrollEl.scrollHeight);
      thumb.style.height = Math.max(56, ratio * track.clientHeight) + 'px';
    }
  }
  measure();
  setTimeout(measure, 700);
  window.addEventListener('resize', measure);
  if (window.ResizeObserver && scroller) new ResizeObserver(measure).observe(scroller);

  sc.target = sc.current = scrollEl.scrollTop || 0;

  if (rich) {
    var onWheel = function (e) {
      if (e.ctrlKey) return;
      sc.max = maxOf();
      var raw = e.deltaMode === 1 ? e.deltaY * 18
              : e.deltaMode === 2 ? e.deltaY * window.innerHeight
              : e.deltaY;
      var delta = raw * 0.3;
      var next = Math.min(sc.max, Math.max(0, sc.target + delta));
      if ((next > 0 && next < sc.max) || next !== sc.target) e.preventDefault();
      sc.target = next;
      sc.ease = 0.025;
      sc.animating = true;
    };
    window.addEventListener('wheel', onWheel, { passive: false });

    /* teclado / arrasto nativo: mantém o alvo em sincronia */
    window.addEventListener('scroll', function () {
      if (!sc.animating) { sc.target = sc.current = scrollEl.scrollTop; }
    }, true);
  }

  /* âncoras internas passam pelo mesmo sistema, para não haver saltos */
  function bindAnchors(scope) {
    Array.prototype.slice.call(scope.querySelectorAll('a[href^="#"]')).forEach(function (a) {
    if (a.dataset.anchorBound) return;
    a.dataset.anchorBound = '1';
    a.addEventListener('click', function (e) {
      var href = a.getAttribute('href');
      if (!href || href === '#') { e.preventDefault(); return; }
      var el = document.getElementById(href.slice(1));
      if (!el) return;
      e.preventDefault();
      var top = el === document.body ? 0 : el.getBoundingClientRect().top + scrollEl.scrollTop;
      if (rich) {
        sc.max = maxOf();
        sc.target = Math.min(sc.max, Math.max(0, top));
        sc.ease = 0.075;
        sc.animating = true;
      } else {
        window.scrollTo({ top: top, behavior: reduceMotion ? 'auto' : 'smooth' });
      }
      if (history.replaceState) history.replaceState(null, '', href);
    });
    });
  }
  bindAnchors(document);

  /* ------------------------------------------------------------------------
     Bio: as palavras acendem-se com o scroll
     ------------------------------------------------------------------------ */
  var bio = q('[data-bio]');
  var bioWords = [];
  if (bio) {
    var words = bio.textContent.trim().split(/\s+/);
    bio.textContent = '';
    words.forEach(function (w, i) {
      var sp = document.createElement('span');
      sp.textContent = w;
      bio.appendChild(sp);
      if (i < words.length - 1) bio.appendChild(document.createTextNode(' '));
      bioWords.push(sp);
    });
  }

  function updateBio() {
    if (!bio || !bioWords.length) return;
    var r = bio.getBoundingClientRect();
    var startAt = window.innerHeight * 0.85;
    var endAt = window.innerHeight * 0.18;
    var p = Math.min(1, Math.max(0, (startAt - r.top) / Math.max(1, startAt - endAt)));
    var lit = p * bioWords.length * 1.06;
    bioWords.forEach(function (sp, i) { sp.classList.toggle('is-lit', i < lit); });
    updateLights();
  }

  /* percurso: cada linha acende quando chega a 70% da altura do ecrã */
  var lights = qa('[data-light]');
  function updateLights() {
    var line = window.innerHeight * 0.7;
    lights.forEach(function (el) {
      el.classList.toggle('is-dim', el.getBoundingClientRect().top > line);
    });
  }

  /* ------------------------------------------------------------------------
     Cards: hover + entrada no scroll
     ------------------------------------------------------------------------ */
  function bindCards(scope) {
    Array.prototype.slice.call(scope.querySelectorAll('[data-card]')).forEach(function (cardEl) {
      if (cardEl.dataset.cardBound) return;
      cardEl.dataset.cardBound = '1';
      /* o alvo do hover é o link principal, para os botões não dispararem o efeito */
      var target = cardEl.querySelector('[data-card-link]') || cardEl;
      target.addEventListener('mouseenter', function () { cardEl.classList.add('is-hot'); });
      target.addEventListener('mouseleave', function () { cardEl.classList.remove('is-hot'); });
      target.addEventListener('focusin',  function () { cardEl.classList.add('is-hot'); });
      target.addEventListener('focusout', function () { cardEl.classList.remove('is-hot'); });
    });
  }

  var io = 'IntersectionObserver' in window
    ? new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          show(e.target);
        });
      }, { threshold: 0.15 })
    : null;

  function show(el) {
    el.style.opacity = '1';
    el.style.transform = 'translateY(0)';
    el.classList.add('is-in');
    el.dataset.revealed = '1';
    if (io) io.unobserve(el);
  }

  function bindReveals(scope) {
    Array.prototype.slice.call(scope.querySelectorAll('[data-w-reveal], [data-card]')).forEach(function (el) {
      if (el.dataset.revealBound) return;
      el.dataset.revealBound = '1';
      if (io) io.observe(el);
      else show(el);
    });
    /* rede de segurança: o IntersectionObserver não entrega callbacks enquanto
       a página está escondida (separador em segundo plano). Sem isto, um card
       que já esteja no viewport podia ficar invisível para sempre. Só revela o
       que está à vista — o resto continua a animar com o scroll. */
    sweepVisible();
  }

  function sweepVisible() {
    Array.prototype.slice.call(document.querySelectorAll('[data-w-reveal], [data-card]')).forEach(function (el) {
      if (el.dataset.revealed) return;
      if (el.getBoundingClientRect().top < window.innerHeight * 1.1) show(el);
    });
  }

  setTimeout(sweepVisible, 1500);
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) setTimeout(sweepVisible, 100);
  });

  bindCards(document);
  bindReveals(document);

  /* js/github-projects.js dispara este evento depois de injetar os cards;
     aqui voltamos a ligar hover, revelações, cursor e âncoras aos elementos novos */
  document.addEventListener('projects:rendered', function (e) {
    var scope = (e.detail && e.detail.container) || document;
    bindCards(scope);
    bindReveals(scope);
    bindCursorHover(scope);
    bindAnchors(scope);
    bindMagnetic(scope);
    measure();
  });

  /* ------------------------------------------------------------------------
     Loop de animação
     ------------------------------------------------------------------------ */
  if (rich) {
    var loop = function () {
      if (sc.animating) {
        sc.current += (sc.target - sc.current) * sc.ease;
        if (Math.abs(sc.target - sc.current) < 0.4) { sc.current = sc.target; sc.animating = false; sc.ease = 0.025; }
        scrollEl.scrollTop = sc.current;
      } else {
        sc.current = sc.target = scrollEl.scrollTop;
      }

      updateBio();

      if (track && thumb) {
        var p = Math.min(1, Math.max(0, sc.current / sc.max));
        thumb.style.transform = 'translateY(' + (p * (track.clientHeight - thumb.offsetHeight)) + 'px)';
        track.style.opacity = sc.max > 40 ? '1' : '0';
      }

      if (hello) {
        hc.x += (ht.x - hc.x) * 0.06;
        hc.y += (ht.y - hc.y) * 0.06;
        hs += (hsT - hs) * 0.07;
        hello.style.perspective = '900px';
        hello.style.transform = 'translateY(0) rotateY(' + (hc.x * 13) + 'deg) rotateX(' + (-hc.y * 9) + 'deg) scale(' + hs + ')';
        if (helloImg) {
          helloImg.style.filter = 'drop-shadow(0 14px 40px rgba(255,255,255,' + (0.12 + Math.abs(hc.x) * 0.2) + ')) brightness(' + (1 + (hs - 1) * 2.2) + ')';
        }
      }

      ring.x += (mouse.x - ring.x) * 0.055;
      ring.y += (mouse.y - ring.y) * 0.055;
      if (cursor) cursor.style.transform = 'translate3d(' + ring.x + 'px,' + ring.y + 'px,0)';
      if (dot) dot.style.transform = 'translate3d(' + mouse.x + 'px,' + mouse.y + 'px,0)';

      var tx = mouse.x - window.innerWidth / 2;
      var ty = mouse.y - window.innerHeight / 2;
      soft.x += (tx - soft.x) * 0.035;
      soft.y += (ty - soft.y) * 0.035;

      var t = performance.now() / 1000;
      objs.forEach(function (el, i) {
        var d = parseFloat(el.dataset.depth || '0.08') * 3.2;
        var s = el._s || (el._s = { x: 0, y: 0 });
        /* cada objeto persegue o ponteiro ao seu ritmo → movimento em camadas */
        var ease = [0.012, 0.041, 0.023, 0.031][i % 4];
        s.x += (-soft.x * d - s.x) * ease;
        s.y += (-soft.y * d - s.y) * ease;
        /* deriva de Lissajous: frequências x/y incomensuráveis → nunca repete o percurso */
        var fx = [0.037, 0.094, 0.058, 0.071][i % 4], fy = [0.083, 0.029, 0.067, 0.041][i % 4];
        var ax = [12, 7, 10, 14][i % 4], ay = [6, 13, 11, 8][i % 4];
        var dx = Math.sin(t * fx * Math.PI * 2 + i * 1.7) * ax + Math.sin(t * fx * 2.7 + i) * (ax * 0.28);
        var dy = Math.cos(t * fy * Math.PI * 2 + i * 2.3) * ay + Math.sin(t * fy * 3.3 + i) * (ay * 0.32);
        var rot = (s.x / window.innerWidth) * 14 + Math.sin(t * 0.11 + i * 1.4) * 5;
        var scl = 1 + (Math.abs(s.x) + Math.abs(s.y)) / 9000 + Math.sin(t * 0.09 + i) * 0.02;
        el.style.transform = 'translate3d(' + (s.x + dx) + 'px,' + (s.y + dy) + 'px,0) rotate(' + rot + 'deg) scale(' + scl + ')';
      });

      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  } else {
    /* touch / movimento reduzido: sem rAF contínuo, só a bio a acompanhar o scroll */
    var queued = false;
    var onScroll = function () {
      if (queued) return;
      queued = true;
      requestAnimationFrame(function () { queued = false; updateBio(); });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    updateBio();
  }
})();
