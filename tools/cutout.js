// Recorta um objeto fotografado sobre fundo liso e exporta WebP com transparência.
// Uso: node tools/cutout.js <entrada.jpg> <saida.webp> <tamanho-max> [tolerancia] [x,y ...]
// Os x,y opcionais (em píxeis da imagem original) são buracos de fundo fechados
// pelo objeto (ex.: o interior do anel de Saturno), que as margens não alcançam.
// O fundo é detetado pelas margens e removido por "flood fill" a partir delas,
// para os reflexos do cromado com a mesma cor do fundo não ficarem furados.
const { execFileSync } = require('child_process');

const [input, output, maxSide = '600', tolArg = '24', ...holeArgs] = process.argv.slice(2);
const T1 = Number(tolArg);   // até aqui é fundo
const T2 = T1 + 70;          // a partir daqui é objeto; entre os dois, borda suave

const probe = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0',
  '-show_entries', 'stream=width,height', '-of', 'csv=p=0', input]).toString().trim();
const [W, H] = probe.split(',').map(Number);
const rgb = execFileSync('ffmpeg', ['-v', 'error', '-i', input, '-f', 'rawvideo',
  '-pix_fmt', 'rgb24', '-'], { maxBuffer: 1 << 28 });

// sementes: as margens da imagem
const border = [];
for (let x = 0; x < W; x++) border.push(x, x + (H - 1) * W);
for (let y = 0; y < H; y++) border.push(y * W, y * W + W - 1);
// cor do fundo: mediana de um anel 6px para dentro (há imagens com moldura fina)
const ring = [], k = 6;
for (let x = k; x < W - k; x++) ring.push(k * W + x, (H - 1 - k) * W + x);
for (let y = k; y < H - k; y++) ring.push(y * W + k, y * W + W - 1 - k);
const med = (c) => { const v = ring.map(i => rgb[i * 3 + c]).sort((a, b) => a - b); return v[v.length >> 1]; };
const B = [med(0), med(1), med(2)];
const dist = (i) => Math.hypot(rgb[i * 3] - B[0], rgb[i * 3 + 1] - B[1], rgb[i * 3 + 2] - B[2]);

// flood fill a partir das margens
const bg = new Uint8Array(W * H);
const holes = holeArgs.map(a => a.split(',').map(Number)).map(([x, y]) => y * W + x);
holes.forEach(i => { if (dist(i) >= T1) console.warn('aviso: o ponto ' + (i % W) + ',' + ((i / W) | 0) + ' não parece fundo (distância ' + dist(i).toFixed(0) + ')'); });
const stack = border.filter(i => dist(i) < T1).concat(holes.filter(i => dist(i) < T1));
stack.forEach(i => { bg[i] = 1; });
while (stack.length) {
  const i = stack.pop(), x = i % W, y = (i / W) | 0;
  for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
    if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
    const n = ny * W + nx;
    if (!bg[n] && dist(n) < T1) { bg[n] = 1; stack.push(n); }
  }
}

// alfa: 0 no fundo; rampa suave nos 2px de objeto que tocam o fundo
const out = Buffer.alloc(W * H * 4);
const nearBg = (x, y) => {
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const nx = x + dx, ny = y + dy;
    if (nx >= 0 && ny >= 0 && nx < W && ny < H && bg[ny * W + nx]) return true;
  }
  return false;
};
let minX = W, minY = H, maxX = 0, maxY = 0;
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const i = y * W + x;
  let a = 0;
  if (!bg[i]) a = nearBg(x, y) ? Math.min(1, Math.max(0, (dist(i) - T1) / (T2 - T1))) : 1;
  for (let c = 0; c < 3; c++) {
    // tira a cor do fundo antigo das bordas semitransparentes (sem halo)
    const p = rgb[i * 3 + c];
    out[i * 4 + c] = a > 0 ? Math.max(0, Math.min(255, Math.round((p - (1 - a) * B[c]) / a))) : 0;
  }
  out[i * 4 + 3] = Math.round(a * 255);
  if (a > 0.05) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
}

// recorta à volta do objeto, com uma pequena margem, e reduz
const pad = Math.round(Math.max(maxX - minX, maxY - minY) * 0.03);
const cx = Math.max(0, minX - pad), cy = Math.max(0, minY - pad);
const cw = Math.min(W - cx, maxX - minX + 1 + pad * 2), ch = Math.min(H - cy, maxY - minY + 1 + pad * 2);
const m = Number(maxSide);
const scale = `scale='if(gt(iw,ih),min(${m},iw),-2)':'if(gt(iw,ih),-2,min(${m},ih))':flags=lanczos`;
execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-i', '-',
  '-vf', `crop=${cw}:${ch}:${cx}:${cy},${scale}`, '-c:v', 'libwebp', '-lossless', '0', '-q:v', '86',
  '-pix_fmt', 'yuva420p', output], { input: out });
console.log(`${output}: fundo rgb(${B}) · recorte ${cw}x${ch}`);
