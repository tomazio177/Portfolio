/* ==========================================================================
   Projetos a partir da GitHub REST API
   --------------------------------------------------------------------------
   Sem backend, sem dependências, sem token. Usa apenas a API pública
   (60 pedidos/hora por IP) e a Fetch API.

   Vai buscar os repositórios públicos, fica só com os que têm o tópico
   definido em TOPIC, e constrói os cards dentro de [data-projects-list],
   com o mesmo desenho dos cards do design.
   ========================================================================== */
(function () {
  'use strict';

  /* ========================================================================
     CONFIGURAÇÃO — o teu username do GitHub vai aqui
     ======================================================================== */
  var GITHUB_USERNAME = 'tomazio177';
  var TOPIC           = 'portfolio';  // só aparecem repos com este tópico
  /* ======================================================================== */

  var PER_PAGE   = 100;   // máximo permitido pela API
  var MAX_PAGES  = 3;     // até 300 repositórios
  var CACHE_MIN  = 10;    // minutos de cache em sessionStorage
  var API        = 'https://api.github.com';

  /* capas reais (opcional): nome do repositório no GitHub → imagem.
     Uma captura do projeto em assets/covers/, idealmente 1600px de largura
     em .webp ou .jpg. Os repositórios sem entrada usam um objeto do design. */
  var COVERS = {
    // 'IA-Cliper': 'assets/covers/ia-cliper.webp'
  };

  /* imagens do design usadas em rotação como capa dos cards sem COVERS */
  var OBJECTS = [
    'assets/obj-dice.webp',
    'assets/obj-flower.webp',
    'assets/obj-strawberry.webp',
    'assets/obj-rose.webp',
    'assets/obj-figure.webp',
    'assets/obj-candy.webp',
    'assets/obj-globe.webp'
  ];

  /* cores oficiais do GitHub para o pontinho da linguagem */
  var LANG_COLORS = {
    JavaScript: '#f1e05a', TypeScript: '#3178c6', HTML: '#e34c26', CSS: '#563d7c',
    Python: '#3572A5', Java: '#b07219', 'C#': '#178600', 'C++': '#f34b7d', C: '#555555',
    PHP: '#4F5D95', Ruby: '#701516', Go: '#00ADD8', Rust: '#dea584', Swift: '#F05138',
    Kotlin: '#A97BFF', Dart: '#00B4AB', Shell: '#89e051', Vue: '#41b883', SCSS: '#c6538c',
    Jupyter: '#DA5B0B', Lua: '#000080', 'Objective-C': '#438eff', R: '#198CE7', Zig: '#ec915c'
  };

  var list     = document.querySelector('[data-projects-list]');
  var skeleton = document.querySelector('[data-projects-skeleton]');
  var state   = document.querySelector('[data-projects-state]');
  var msg     = document.querySelector('[data-projects-msg]');
  var retryEl = document.querySelector('[data-projects-retry]');

  if (!list || !state || !msg) return;

  /* ------------------------------------------------------------------------
     Estados
     ------------------------------------------------------------------------ */
  function setState(kind, text, showRetry) {
    if (skeleton) skeleton.hidden = kind !== 'loading';
    state.hidden = kind === 'done';
    state.className = 'projects-state' + (kind === 'done' ? '' : ' projects-state--' + kind);
    state.setAttribute('aria-live', 'polite');
    msg.textContent = text || '';
    if (retryEl) retryEl.hidden = !showRetry;
  }

  /* ------------------------------------------------------------------------
     Helpers
     ------------------------------------------------------------------------ */
  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    /* textContent (nunca innerHTML): o que vem da API é tratado como texto,
       por isso não há forma de injetar HTML através do nome ou da descrição */
    if (text != null) node.textContent = text;
    return node;
  }

  function pad(n) { return n < 10 ? '0' + n : String(n); }

  function formatDate(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return 'sem data';
    try {
      return d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' })
              .replace(/\./g, '');
    } catch (err) {
      return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    }
  }

  /* Demo: usa o campo "homepage" do repo; se estiver vazio mas o GitHub Pages
     estiver ligado, constrói o URL padrão das Pages. */
  function demoUrl(repo) {
    var home = (repo.homepage || '').trim();
    if (/^https?:\/\//i.test(home)) return home;

    if (repo.has_pages) {
      var owner = (repo.owner && repo.owner.login) || GITHUB_USERNAME;
      if (repo.name.toLowerCase() === (owner + '.github.io').toLowerCase()) {
        return 'https://' + owner + '.github.io/';
      }
      return 'https://' + owner + '.github.io/' + repo.name + '/';
    }
    return null;
  }

  /* ------------------------------------------------------------------------
     Cache (sessionStorage) — poupa pedidos ao limite de 60/hora
     ------------------------------------------------------------------------ */
  var CACHE_KEY = 'gh-projects:' + GITHUB_USERNAME + ':' + TOPIC;

  function readCache() {
    try {
      var raw = sessionStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (Date.now() - parsed.t > CACHE_MIN * 60 * 1000) return null;
      return parsed.data;
    } catch (err) { return null; }
  }

  function writeCache(data) {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), data: data }));
    } catch (err) { /* modo privado / quota cheia: seguimos sem cache */ }
  }

  /* ------------------------------------------------------------------------
     Pedido à API (com paginação)
     ------------------------------------------------------------------------ */
  function fetchPage(page) {
    var url = API + '/users/' + encodeURIComponent(GITHUB_USERNAME) +
              '/repos?per_page=' + PER_PAGE + '&page=' + page + '&sort=updated&type=owner';

    return fetch(url, { headers: { Accept: 'application/vnd.github+json' } }).then(function (res) {
      if (res.status === 404) throw new Error('NO_USER');
      if (res.status === 403 || res.status === 429) {
        var left = res.headers.get('X-RateLimit-Remaining');
        throw new Error(left === '0' ? 'RATE_LIMIT' : 'FORBIDDEN');
      }
      if (!res.ok) throw new Error('HTTP_' + res.status);
      return res.json();
    });
  }

  function fetchAllRepos() {
    var all = [];
    function next(page) {
      return fetchPage(page).then(function (batch) {
        if (!Array.isArray(batch)) throw new Error('BAD_PAYLOAD');
        all = all.concat(batch);
        if (batch.length === PER_PAGE && page < MAX_PAGES) return next(page + 1);
        return all;
      });
    }
    return next(1);
  }

  /* ------------------------------------------------------------------------
     Construção de um card — mesma estrutura visual dos cards do design
     ------------------------------------------------------------------------ */
  function buildMedia(repo, i) {
    var media = el('div', 'card-media');
    media.setAttribute('data-card-media', '');

    var img = el('img');
    var cover = COVERS[repo.name];
    if (cover) {
      media.classList.add('card-media--cover');
      img.src = cover;
      img.alt = 'Captura do projeto ' + repo.name;
    } else {
      img.src = OBJECTS[i % OBJECTS.length];
      img.alt = '';
    }
    img.loading = 'lazy';

    /* legenda: os outros tópicos do repo, senão a linguagem */
    var others = (repo.topics || []).filter(function (t) { return t !== TOPIC; });
    var caption = others.length ? others.slice(0, 3).join(' · ')
                : repo.language ? repo.language
                : 'Repositório';
    var note = el('span', 'card-media-note', caption);

    media.appendChild(img);
    media.appendChild(note);
    return media;
  }

  function buildCard(repo, i) {
    var card = el('article', 'card');
    card.setAttribute('data-card', '');

    var lang = repo.language || 'Sem linguagem';
    var year = new Date(repo.updated_at).getFullYear() || '';

    /* a cor da linguagem tinge a capa do card (ver --lang-color no CSS) */
    if (repo.language && LANG_COLORS[repo.language]) {
      card.style.setProperty('--lang-color', LANG_COLORS[repo.language]);
    }

    /* link principal: capa + título, tal como no design */
    var link = el('a', 'card-link');
    link.href = repo.html_url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.setAttribute('data-card-link', '');
    link.setAttribute('aria-label', 'Abrir ' + repo.name + ' no GitHub');

    link.appendChild(buildMedia(repo, i));

    var meta  = el('div', 'card-meta');
    var title = el('span', 'card-title', repo.name);
    title.setAttribute('data-card-title', '');
    meta.appendChild(title);
    meta.appendChild(el('span', 'card-index', String(year)));
    link.appendChild(meta);
    card.appendChild(link);

    /* descrição — repos sem description mostram um texto neutro */
    var desc = repo.description && repo.description.trim();
    card.appendChild(el('p', 'card-desc' + (desc ? '' : ' card-desc--empty'),
      desc || 'Este repositório ainda não tem descrição.'));

    /* métricas */
    var stats = el('ul', 'card-stats');

    var liLang = el('li');
    liLang.appendChild(el('span', 'card-lang-dot'));
    liLang.appendChild(el('span', null, lang));
    stats.appendChild(liLang);

    stats.appendChild(el('li', null, '★ ' + (repo.stargazers_count || 0) +
      (repo.stargazers_count === 1 ? ' estrela' : ' estrelas')));
    stats.appendChild(el('li', null, 'Atualizado ' + formatDate(repo.updated_at)));
    card.appendChild(stats);

    /* ações */
    var actions = el('div', 'card-actions');

    var gh = el('a', 'btn', 'GitHub');
    gh.href = repo.html_url;
    gh.target = '_blank';
    gh.rel = 'noopener noreferrer';
    actions.appendChild(gh);

    var demo = demoUrl(repo);
    if (demo) {
      var d = el('a', 'btn', 'Demo');
      d.href = demo;
      d.target = '_blank';
      d.rel = 'noopener noreferrer';
      actions.appendChild(d);
    }

    card.appendChild(actions);
    return card;
  }

  /* ------------------------------------------------------------------------
     Render
     ------------------------------------------------------------------------ */
  function render(repos) {
    list.textContent = '';

    if (!repos.length) {
      setState('empty',
        'Ainda não há repositórios públicos com o tópico "' + TOPIC + '". ' +
        'Adiciona o tópico no GitHub e eles aparecem aqui.', false);
      return;
    }

    var frag = document.createDocumentFragment();
    repos.forEach(function (repo, i) { frag.appendChild(buildCard(repo, i)); });
    list.appendChild(frag);

    setState('done', '', false);

    /* js/main.js liga hover, revelações e cursor aos cards novos */
    document.dispatchEvent(new CustomEvent('projects:rendered', {
      detail: { container: list, count: repos.length }
    }));
  }

  function messageFor(code) {
    switch (code) {
      case 'CONFIG':
        return 'Falta configurar o username do GitHub em js/github-projects.js (constante GITHUB_USERNAME).';
      case 'NO_USER':
        return 'O utilizador "' + GITHUB_USERNAME + '" não existe no GitHub. Confirma o username em js/github-projects.js.';
      case 'RATE_LIMIT':
        return 'Limite de pedidos da API pública do GitHub atingido (60 por hora). Tenta daqui a pouco.';
      case 'NO_TOPICS':
        return 'A API não devolveu tópicos para nenhum repositório. Confirma que os repos têm o tópico "' + TOPIC + '".';
      default:
        return 'Não foi possível carregar os projetos do GitHub. Verifica a ligação à internet e tenta de novo.';
    }
  }

  /* ------------------------------------------------------------------------
     Arranque
     ------------------------------------------------------------------------ */
  function load(useCache) {
    if (!GITHUB_USERNAME || GITHUB_USERNAME === 'USERNAME') {
      setState('error', messageFor('CONFIG'), false);
      return;
    }

    if (useCache) {
      var cached = readCache();
      if (cached) { render(cached); return; }
    }

    setState('loading', 'A carregar projetos do GitHub', false);

    fetchAllRepos()
      .then(function (repos) {
        var picked = repos.filter(function (r) {
          return Array.isArray(r.topics) && r.topics.indexOf(TOPIC) !== -1;
        });

        picked.sort(function (a, b) {
          return new Date(b.updated_at) - new Date(a.updated_at);
        });

        /* só guardamos o que os cards usam — o payload da API é enorme */
        var slim = picked.map(function (r) {
          return {
            name: r.name, full_name: r.full_name, html_url: r.html_url,
            description: r.description, language: r.language,
            stargazers_count: r.stargazers_count, updated_at: r.updated_at,
            homepage: r.homepage, has_pages: r.has_pages, topics: r.topics,
            owner: { login: r.owner && r.owner.login }
          };
        });

        writeCache(slim);
        render(slim);
      })
      .catch(function (err) {
        var code = (err && err.message) || 'UNKNOWN';
        setState('error', messageFor(code), true);
        if (window.console) console.error('[github-projects]', err);
      });
  }

  if (retryEl) {
    retryEl.addEventListener('click', function () {
      try { sessionStorage.removeItem(CACHE_KEY); } catch (e) {}
      load(false);
    });
  }

  load(true);
})();
