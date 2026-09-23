# Portfólio

Site estático (HTML + CSS + JS, sem build) construído a partir do design
original (`Portfolio.dc.html`). Publicado em **https://tomazio177.github.io/**.

## Correr localmente

Qualquer servidor estático serve. Com Python:

```bash
python -m http.server 5173
```

Depois abre <http://localhost:5173>.

## Estrutura

```
index.html          página única (herói, sobre, projetos, competências, percurso, contacto)
404.html            página de erro ("Perdeste-te no espaço")
css/styles.css      todo o estilo, incluindo responsivo e reduced-motion
js/main.js          loader, cursor, parallax, scroll suave, revelações
js/github-projects.js  vai buscar os repos à GitHub REST API e cria os cards
assets/             objetos cromados em WebP, og-image.jpg, favicon
assets/originais/   imagens tal como vieram (só local, fora do git)
tools/cutout.js     tira o fundo a uma foto nova e exporta WebP
robots.txt, sitemap.xml, _config.yml   para o Google e o GitHub Pages
handoff/            bundle original do design (só local, fora do git)
```

## O que editar

| O quê | Onde |
| --- | --- |
| Headline do herói | `index.html`, `.headline p` |
| Texto do Sobre | `index.html`, `[data-bio]` |
| Projetos | vêm do GitHub — ver secção abaixo |
| Competências | `index.html`, secção `#competencias` (um `<li>` por item; a nota pequena vai em `.skill-note`) |
| Percurso | `index.html`, secção `#percurso` (um `.timeline-item` por entrada, do mais recente para o mais antigo) |
| CV em PDF | pôr o ficheiro em `assets/cv-tomas-santos.pdf` e descomentar o botão no fim de `#percurso` |
| Imagens originais (tal como vieram) | `assets/originais/` — as versões recortadas usadas no site são os `assets/obj-*.webp` |
| Objetos cromados novos (fotos) | recortar com `node tools/cutout.js <foto.jpg> assets/obj-nome.webp <tamanho-max> [tolerância]`; tira o fundo liso a partir das margens e exporta WebP com transparência |
| Email e redes sociais | `index.html`, secção `#contact` |
| Cores e espaçamentos | `css/styles.css`, bloco `:root` |

## Projetos automáticos a partir do GitHub

Os cards da secção **Projetos** não estão no HTML — são construídos em runtime por
`js/github-projects.js` a partir da API pública do GitHub. Não há backend, não
há token, não há dependências.

### 1. Username

Está em `js/github-projects.js`, **linha 17**:

```js
var GITHUB_USERNAME = 'tomazio177';
var TOPIC           = 'portfolio';  // o tópico que filtra os repos
```

É o único sítio onde o username aparece.

### 2. Marca os repos que queres mostrar

No GitHub, em cada repositório que queiras no portefólio:

1. Abre a página do repositório.
2. Clica no ⚙️ ao lado de **About** (canto superior direito).
3. No campo **Topics**, escreve `portfolio` e carrega Enter.
4. **Save changes**.

A partir daí o repo aparece no site sozinho. Repos sem o tópico ficam de fora.
Só isso — não é preciso tocar no código quando crias um projeto novo.

### O que cada card mostra

Nome do repositório, descrição, linguagem principal (com o pontinho colorido
do GitHub), estrelas, data da última atualização, botão **GitHub** e — quando
existe — botão **Demo**.

O Demo usa o campo `homepage` do repositório; se estiver vazio mas o GitHub
Pages estiver ativo, o URL das Pages é construído automaticamente
(`https://<user>.github.io/<repo>/`).

### Detalhes

- **Ordem:** do mais recentemente atualizado para o mais antigo.
- **Limites:** a API pública permite 60 pedidos/hora por IP. Há cache de 10
  minutos em `sessionStorage` para não gastar pedidos em cada refresh.
- **Sem descrição / sem linguagem:** o card mostra "Este repositório ainda não
  tem descrição." e "Sem linguagem" em vez de campos vazios.
- **Estados:** loading, lista vazia, e erro (com botão "Tentar novamente").
  O erro distingue username errado, limite de pedidos e falha de rede.
- **Segurança:** todo o conteúdo da API entra no DOM via `textContent`, nunca
  `innerHTML` — não há forma de injetar HTML pelo nome ou descrição de um repo.
- **Capas:** por omissão rodam as 5 imagens de objetos do design. Para dar a
  um projeto uma captura real, põe a imagem em `assets/covers/` (idealmente
  1600px de largura, `.webp` ou `.jpg`) e acrescenta-a ao mapa `COVERS` no
  topo de `js/github-projects.js`, com o nome exato do repositório:
  `'IA-Cliper': 'assets/covers/ia-cliper.webp'`. A captura ocupa a moldura
  toda.

## Publicar

O site está preparado para o GitHub Pages em **https://tomazio177.github.io/**
(repositório `tomazio177.github.io`, ramo `main`). Não há build: cada push
publica sozinho ao fim de um minuto ou dois.

- `_config.yml` deixa o README e a pasta `tools/` fora do site publicado.
- `.gitignore` deixa fora do repositório o `handoff/` (tem a fonte paga) e
  os `assets/originais/`, que ficam só neste computador.
- O endereço aparece em `index.html` (canonical, og:url, og:image, JSON-LD),
  `robots.txt` e `sitemap.xml`. Se um dia mudar (ex.: domínio próprio),
  troca-se nesses sítios.

Primeira publicação (só uma vez):

1. Em <https://github.com/new> criar o repositório `tomazio177.github.io`,
   **Public**, sem README, `.gitignore` nem licença.
2. Na pasta do projeto: `git push -u origin main` (o Windows pede o login do
   GitHub na primeira vez).
3. Se ao fim de dois minutos o site não abrir: no repositório, **Settings →
   Pages → Build and deployment**, origem **Deploy from a branch**, ramo
   `main`, pasta `/ (root)`.

Para atualizar o site depois de mudar alguma coisa:

```bash
git add -A
git commit -m "Descrição da alteração"
git push
```

## Notas de implementação

- **Fidelidade ao design.** Medidas, cores, tipografia e curvas de animação
  saíram 1:1 do ficheiro do handoff. Em ecrãs com mais de 950px de altura o
  herói é idêntico ao original (palco de 1481×839, headline a 93px).
- **Ecrãs mais baixos.** O design tinha o palco do herói com `height:839px`
  fixo, o que empurrava a headline para fora do viewport em portáteis. Abaixo
  de 950px de altura o palco acompanha o viewport (`css/styles.css`, media
  query `max-height: 950px`).
- **Mobile.** O design só cobria desktop. Abaixo de 720px a headline entra no
  fluxo por baixo do "hello", os cards passam a coluna única, e o cursor
  personalizado e a barra de scroll são desligados.
- **Acessibilidade.** `prefers-reduced-motion` desliga parallax, cursor e
  scroll suave. Há um skip link e um `<noscript>` que revela tudo caso o JS
  falhe.
- **Cards do GitHub.** Os 6 cards estáticos do design foram substituídos pela
  lista dinâmica. A estrutura visual (capa 5:4 / 4:3 alternada, ziguezague
  esquerda-direita, título + índice em mono) é a mesma; o que entrou de novo
  foi a descrição, a linha de métricas e os botões, todos na tipografia que já
  existia.
- **Peso das imagens.** Os PNGs do design (~4,8 MB, só o `hello.png` tinha
  2,1 MB) foram convertidos para WebP com transparência: as imagens da página
  somam agora ~0,6 MB. Os PNG originais estão em `assets/originais/design/`.
- **Fonte.** A PP Neue Montreal (paga) foi trocada pela **Geist** (Google
  Fonts, licença SIL OFL), com o mesmo desenho grotesco.
- **Loader** só na primeira visita de cada sessão (`sessionStorage`); um
  script no `<head>` esconde-o antes de a página ser desenhada.
