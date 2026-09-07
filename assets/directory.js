const PAGE_SIZE = 36;
const CACHE = new Map();
const DATA_FILES = new Set(['data/index.json', 'data/manga.json', 'data/filming.json', 'data/train.json', 'data/museums.json']);
const COPY = {
  en: {
    pickCity: 'Pick a city',
    allCities: 'All cities',
    shownIn: (shown, total, place) => `${shown} shown · ${total} in ${place}`,
    shownAll: (shown, total) => `${shown} shown · ${total} matches`,
    emptySeichi: 'No spots match this search.',
    emptyMuseums: 'No museums match this search.',
    prev: 'Previous',
    next: 'Next',
    page: (n, of) => `Page ${n} of ${of}`,
    rail: 'Rail',
    spot: 'Spot',
    museum: 'Museum',
    gallery: 'Gallery',
  },
  ja: {
    pickCity: '都市を選ぶ',
    allCities: 'すべて',
    shownIn: (shown, total, place) => `${place}：${total}件中 ${shown}件`,
    shownAll: (shown, total) => `${total}件中 ${shown}件`,
    emptySeichi: '該当するスポットがありません。',
    emptyMuseums: '該当する館がありません。',
    prev: '前へ',
    next: '次へ',
    page: (n, of) => `${n} / ${of} ページ`,
    rail: '鉄道',
    spot: 'スポット',
    museum: '美術館',
    gallery: 'ギャラリー',
  },
};

function rootPath() {
  const raw = document.documentElement.dataset.root || '.';
  if (raw === '.' || raw === '..' || raw === '../..') return raw;
  return '.';
}

function kindFromPage() {
  const kind = document.documentElement.dataset.kind || 'manga';
  if (kind === 'hub' || kind === 'manga') return 'manga';
  if (kind === 'filming' || kind === 'train') return kind;
  return 'manga';
}

function joinRoot(file) {
  if (!DATA_FILES.has(file)) throw new Error('blocked');
  return `${rootPath().replace(/\/$/, '')}/${file}`;
}

function currentLang() {
  return document.documentElement.dataset.lang === 'ja' ? 'ja' : 'en';
}

function t() {
  return COPY[currentLang()];
}

function applyLang(lang) {
  const next = lang === 'ja' ? 'ja' : 'en';
  document.documentElement.lang = next;
  document.documentElement.dataset.lang = next;
  try {
    localStorage.setItem('wrte-lang', next);
  } catch {
    /* ignore */
  }
  document.querySelectorAll('[data-en][data-ja]').forEach((el) => {
    el.textContent = el.getAttribute(`data-${next}`) || el.getAttribute('data-en');
  });
  document.querySelectorAll('[data-ph-en]').forEach((el) => {
    el.setAttribute('placeholder', el.getAttribute(next === 'ja' ? 'data-ph-ja' : 'data-ph-en') || '');
  });
  document.querySelectorAll('[data-set-lang]').forEach((btn) => {
    btn.classList.toggle('is-current', btn.dataset.setLang === next);
  });
  window.dispatchEvent(new Event('wrte-lang'));
}

function wireLang() {
  let saved = 'en';
  try {
    saved = localStorage.getItem('wrte-lang') === 'ja' ? 'ja' : 'en';
  } catch {
    saved = 'en';
  }
  applyLang(saved);
  document.querySelector('.lang')?.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-set-lang]');
    if (!btn) return;
    applyLang(btn.dataset.setLang);
  });
}

function safeHttpsUrl(raw) {
  if (typeof raw !== 'string') return '';
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== 'https:') return '';
    return u.href;
  } catch {
    return '';
  }
}

async function loadJson(file) {
  if (CACHE.has(file)) return CACHE.get(file);
  const res = await fetch(joinRoot(file), { credentials: 'omit', cache: 'no-store' });
  if (!res.ok) throw new Error(`Could not load ${file}`);
  const data = await res.json();
  CACHE.set(file, data);
  return data;
}

function fold(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[·・,./_\-–—'’"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchesQuery(row, q) {
  if (!q) return true;
  const hay = fold(
    [
      row.name,
      row.nameLocal,
      row.work,
      row.setting,
      row.group,
      row.description,
      ...(row.tags || []),
      ...(row.trains || []),
    ]
      .filter(Boolean)
      .join(' '),
  );
  return fold(q)
    .split(' ')
    .filter(Boolean)
    .every((token) => hay.includes(token));
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function padIndex(n) {
  return String(n).padStart(2, '0');
}

function cityLabel(city) {
  if (!city) return '';
  return currentLang() === 'ja' ? city.nameJa || city.name : city.name;
}

function displayName(row) {
  if (currentLang() === 'ja') return row.nameLocal || row.name;
  return row.name;
}

function spotCard(row, i, meta) {
  const local =
    row.nameLocal && row.nameLocal !== row.name
      ? `<p class="spot__local">${escapeHtml(currentLang() === 'ja' ? row.name : row.nameLocal)}</p>`
      : '';
  const work =
    row.work && row.work !== row.name
      ? `<p class="spot__work">${escapeHtml(row.work)}</p>`
      : '';
  const trains = Array.isArray(row.trains) && row.trains.length
    ? `<p class="spot__series">${row.trains.map((series) => `<span>${escapeHtml(series)}</span>`).join('')}</p>`
    : '';
  const desc = row.description ? `<p class="spot__desc">${escapeHtml(row.description)}</p>` : '';
  const photo = safeHttpsUrl(row.photoUrl);
  const media = photo
    ? `<span class="spot__media"><img src="${escapeHtml(photo)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" /></span>`
    : `<span class="spot__media" aria-hidden="true">${padIndex(i + 1)}</span>`;
  const inner = `${media}<span class="spot__copy"><span class="spot__meta"><span>${escapeHtml(meta)}</span><span>${padIndex(i + 1)}</span></span><p class="spot__name">${escapeHtml(displayName(row))}</p>${work}${local}${trains}${desc}</span>`;
  const mapUrl = safeHttpsUrl(row.mapUrl);
  if (mapUrl) {
    return `<li><a class="spot" href="${escapeHtml(mapUrl)}" target="_blank" rel="noopener noreferrer">${inner}</a></li>`;
  }
  return `<li><div class="spot">${inner}</div></li>`;
}

function renderSeichi(rows, kind, citiesById) {
  if (!rows.length) return `<p class="count">${t().emptySeichi}</p>`;
  const usePhotos = kind !== 'manga' && rows.some((row) => safeHttpsUrl(row.photoUrl));
  return `<ul class="spots ${usePhotos ? 'spots--photos' : 'spots--list'}">${rows
    .map((row, i) => {
      const city = citiesById.get(row.cityId);
      const meta = [row.group || (kind === 'train' ? t().rail : t().spot), city ? cityLabel(city) : '']
        .filter(Boolean)
        .join(' · ');
      return spotCard(row, i, meta);
    })
    .join('')}</ul>`;
}

function renderMuseums(rows, citiesById) {
  if (!rows.length) return `<p class="count">${t().emptyMuseums}</p>`;
  const usePhotos = rows.some((row) => safeHttpsUrl(row.photoUrl));
  return `<ul class="spots ${usePhotos ? 'spots--photos' : 'spots--list'}">${rows
    .map((row, i) => {
      const city = citiesById.get(row.cityId);
      const kindLabel = row.kind === 'gallery' ? t().gallery : t().museum;
      const meta = [kindLabel, city ? cityLabel(city) : ''].filter(Boolean).join(' · ');
      return spotCard(row, i, meta);
    })
    .join('')}</ul>`;
}

function revealActiveChip(root) {
  const active = root?.querySelector('.is-on, [class*="--active"]');
  if (!active || typeof active.scrollIntoView !== 'function') return;
  active.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
}

const MAP_NS = 'http://www.w3.org/2000/svg';
const MAP_W = 320;
const MAP_H = 380;
const LAND_RINGS = [
  [[139.8, 41.5], [141.6, 41.4], [143.3, 42.0], [145.8, 43.2], [145.0, 45.4], [141.7, 45.5], [140.3, 44.0], [139.5, 42.6]],
  [[130.9, 34.4], [131.5, 33.9], [133.0, 33.5], [134.3, 33.5], [135.1, 33.4], [136.0, 33.8], [137.0, 34.6], [138.2, 34.6], [138.9, 34.7], [139.8, 35.1], [140.9, 35.7], [141.0, 36.8], [141.0, 38.3], [141.7, 38.9], [141.9, 39.6], [142.2, 40.5], [141.4, 41.4], [140.3, 41.4], [139.8, 40.6], [139.7, 39.7], [139.5, 38.2], [139.0, 37.4], [138.2, 37.1], [136.8, 37.1], [136.0, 36.3], [135.5, 35.6], [134.7, 35.6], [133.2, 35.5], [132.0, 35.4], [130.9, 34.4]],
  [[132.4, 33.0], [133.3, 32.8], [134.3, 33.2], [134.6, 34.2], [133.8, 34.4], [132.6, 34.0], [132.2, 33.4]],
  [[129.7, 33.2], [130.4, 33.8], [131.8, 33.6], [132.0, 32.7], [131.4, 31.4], [130.4, 31.2], [129.8, 31.6], [129.6, 32.6]],
  [[127.6, 26.1], [128.3, 26.2], [128.3, 26.7], [127.7, 26.7]],
];
const MAP_PAD = { x: 64, y: 52 };
const MAP_LABELS = new Set(['sapporo', 'sendai', 'tokyo', 'osaka', 'fukuoka', 'naha', 'kanazawa']);
const LABEL_PREFER = {
  sapporo: [[36, 8]],
  sendai: [[36, -8]],
  kanazawa: [[-48, -16]],
  tokyo: [[48, 4]],
  yokohama: [[46, 22]],
  nagoya: [[36, 30]],
  kyoto: [[-50, -6]],
  osaka: [[4, 52]],
  kobe: [[-48, 28]],
  hiroshima: [[-40, 44]],
  fukuoka: [[-70, 4]],
  naha: [[14, 26]],
};

function project(lat, lng) {
  const x = ((lng - 122.9) / (145.8 - 122.9)) * MAP_W;
  const y = ((45.6 - lat) / (45.6 - 24.2)) * MAP_H;
  return { x, y };
}

function pointInRing(lng, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const hit = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi + 0.0000001) + xi;
    if (hit) inside = !inside;
  }
  return inside;
}

function svgEl(name, attrs) {
  const node = document.createElementNS(MAP_NS, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  return node;
}

function boxesOverlap(a, b, gap = 16) {
  return a.x < b.x + b.w + gap && a.x + a.w + gap > b.x && a.y < b.y + b.h + gap && a.y + a.h + gap > b.y;
}

function labelBox(p, slot, width) {
  return {
    x: p.x + slot[0] - width / 2,
    y: p.y + slot[1] - 18,
    w: width,
    h: 18,
  };
}

function candidateSlots(id) {
  const out = [...(LABEL_PREFER[id] || [])];
  for (const radius of [22, 34, 46, 60, 76]) {
    for (let angle = 0; angle < 360; angle += 24) {
      const rad = (angle * Math.PI) / 180;
      out.push([Math.round(Math.cos(rad) * radius), Math.round(Math.sin(rad) * radius)]);
    }
  }
  return out;
}

function pickLabelSlot(p, width, taken, id) {
  for (const slot of candidateSlots(id)) {
    const box = labelBox(p, slot, width);
    if (!taken.some((other) => boxesOverlap(other, box))) return { slot, box };
  }
  const slot = (LABEL_PREFER[id] && LABEL_PREFER[id][0]) || [0, -20];
  return { slot, box: labelBox(p, slot, width) };
}

function paintJapanMap(root, cities, selectedId, onPick) {
  if (!root) return;
  root.replaceChildren();
  const stage = document.createElement('div');
  stage.className = 'japan-map__stage';
  const svg = svgEl('svg', {
    class: 'japan-map__svg',
    viewBox: `${-MAP_PAD.x} ${-MAP_PAD.y} ${MAP_W + MAP_PAD.x * 2} ${MAP_H + MAP_PAD.y * 2}`,
    role: 'img',
  });
  const dots = svgEl('g', { class: 'japan-map__dots' });
  for (let gx = 124; gx <= 146; gx += 0.55) {
    for (let gy = 25.2; gy <= 45.5; gy += 0.42) {
      if (!LAND_RINGS.some((ring) => pointInRing(gx, gy, ring))) continue;
      const p = project(gy, gx);
      dots.appendChild(svgEl('circle', { cx: p.x.toFixed(1), cy: p.y.toFixed(1), r: 1.15 }));
    }
  }
  svg.appendChild(dots);
  const pins = svgEl('g', { class: 'japan-map__pins' });
  const placed = [];
  const mappable = cities
    .filter((city) => Number.isFinite(city.lat) && Number.isFinite(city.lng))
    .slice()
    .sort((a, b) => b.lat - a.lat || a.lng - b.lng);
  const slots = new Map();
  function assignSlot(city) {
    if (slots.has(city.id)) return;
    const p = project(city.lat, city.lng);
    const label = cityLabel(city);
    const width = Math.max(56, label.length * 9.2 + 26);
    const picked = pickLabelSlot(p, width, placed, city.id);
    placed.push(picked.box);
    slots.set(city.id, { ...picked, label, width, p });
  }
  for (const city of mappable) {
    if (MAP_LABELS.has(city.id) || city.id === selectedId) assignSlot(city);
  }
  for (const city of mappable) {
    const p = project(city.lat, city.lng);
    const showLabel = MAP_LABELS.has(city.id) || city.id === selectedId;
    const g = svgEl('g', {
      class: `japan-map__pin${city.id === selectedId ? ' is-on' : ''}${showLabel ? ' has-label' : ''}`,
      transform: `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`,
      'data-city-id': city.id,
    });
    g.appendChild(svgEl('circle', { class: 'japan-map__anchor', r: city.id === selectedId ? 5 : 3.2 }));
    if (showLabel) {
      const { slot, label, width } = slots.get(city.id);
      g.appendChild(svgEl('line', {
        class: 'japan-map__stem',
        x1: 0,
        y1: 0,
        x2: slot[0].toFixed(1),
        y2: (slot[1] - 2).toFixed(1),
      }));
      g.appendChild(svgEl('rect', {
        class: 'japan-map__pill',
        x: (slot[0] - width / 2).toFixed(1),
        y: (slot[1] - 18).toFixed(1),
        width: width.toFixed(1),
        height: 18,
        rx: 9,
      }));
      const text = svgEl('text', {
        class: 'japan-map__text',
        x: slot[0].toFixed(1),
        y: (slot[1] - 5).toFixed(1),
        'text-anchor': 'middle',
      });
      text.textContent = label;
      g.appendChild(text);
    }
    g.addEventListener('pointerenter', () => g.classList.add('is-hot'));
    g.addEventListener('pointerleave', () => g.classList.remove('is-hot'));
    g.addEventListener('click', () => onPick(city.id));
    pins.appendChild(g);
  }
  svg.appendChild(pins);
  const card = document.createElement('aside');
  card.className = 'japan-map__card';
  const selected = cities.find((c) => c.id === selectedId);
  card.innerHTML = selected
    ? `<p class="japan-map__kicker">${escapeHtml(t().pickCity)}</p><p class="japan-map__city">${escapeHtml(cityLabel(selected))}</p>`
    : `<p class="japan-map__kicker">${escapeHtml(t().pickCity)}</p><p class="japan-map__city">${escapeHtml(t().allCities)}</p>`;
  stage.appendChild(svg);
  stage.appendChild(card);
  root.appendChild(stage);
}

function wireChrome() {
  const onScroll = () => {
    document.documentElement.classList.toggle('is-scrolled', window.scrollY > 8);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

function collectRows(catalog, cityId, query, extraFilter) {
  const q = query.trim();
  const ids = q || cityId === 'all' ? Object.keys(catalog) : [cityId];
  const rows = [];
  for (const id of ids) {
    for (const row of catalog[id] || []) {
      if (extraFilter && !extraFilter(row)) continue;
      if (!matchesQuery(row, q)) continue;
      rows.push({ ...row, cityId: row.cityId || id });
    }
  }
  return rows;
}

function pagerHtml(page, pageCount) {
  if (pageCount <= 1) return '';
  return `<button type="button" data-dir="-1"${page <= 0 ? ' disabled' : ''}>${t().prev}</button><span>${t().page(page + 1, pageCount)}</span><button type="button" data-dir="1"${page >= pageCount - 1 ? ' disabled' : ''}>${t().next}</button>`;
}

async function bootSeichi() {
  const kind = kindFromPage();
  const citySelect = document.getElementById('city');
  const search = document.getElementById('search');
  const results = document.getElementById('results');
  const count = document.getElementById('count');
  const pager = document.getElementById('pager');
  const index = await loadJson('data/index.json');
  const catalog = await loadJson(`data/${kind}.json`);
  const citiesById = new Map(index.japanCities.map((city) => [city.id, city]));
  const allBtn = document.createElement('button');
  allBtn.type = 'button';
  allBtn.className = 'seichi-dir__city';
  allBtn.dataset.cityId = 'all';
  citySelect.appendChild(allBtn);
  for (const city of index.japanCities) {
    const option = document.createElement('button');
    option.type = 'button';
    option.className = 'seichi-dir__city';
    option.dataset.cityId = city.id;
    citySelect.appendChild(option);
  }
  const hash = location.hash.replace('#', '');
  let cityId = citiesById.has(hash) ? hash : 'all';
  let query = '';
  let page = 0;
  const mapRoot = document.getElementById('japan-map');

  function paintCityLabels() {
    citySelect.querySelectorAll('[data-city-id]').forEach((chip) => {
      const id = chip.dataset.cityId;
      if (id === 'all') {
        chip.textContent = t().allCities;
      } else {
        chip.textContent = cityLabel(citiesById.get(id));
      }
      chip.classList.toggle('seichi-dir__city--active', id === cityId);
      chip.classList.toggle('is-on', id === cityId);
    });
  }

  function render() {
    const rows = collectRows(catalog, cityId, query);
    const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    page = Math.min(page, pageCount - 1);
    const slice = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    const place = cityId === 'all' ? t().allCities : cityLabel(citiesById.get(cityId));
    count.textContent = cityId === 'all' || query
      ? t().shownAll(slice.length, rows.length)
      : t().shownIn(slice.length, rows.length, place);
    results.innerHTML = renderSeichi(slice, kind, citiesById);
    pager.innerHTML = pagerHtml(page, pageCount);
    paintCityLabels();
    revealActiveChip(citySelect);
    paintJapanMap(mapRoot, index.japanCities, cityId === 'all' ? '' : cityId, (id) => {
      cityId = id;
      query = '';
      search.value = '';
      page = 0;
      history.replaceState(null, '', `#${id}`);
      render();
    });
  }

  citySelect.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-city-id]');
    if (!chip) return;
    cityId = chip.dataset.cityId;
    page = 0;
    history.replaceState(null, '', cityId === 'all' ? location.pathname : `#${cityId}`);
    render();
  });
  search.addEventListener('input', () => {
    query = search.value;
    if (query.trim()) cityId = 'all';
    page = 0;
    render();
  });
  pager.addEventListener('click', (event) => {
    const dir = Number(event.target.dataset.dir || 0);
    if (!dir) return;
    page += dir;
    render();
  });
  window.addEventListener('wrte-lang', render);
  render();
}

async function bootMuseums() {
  const regionSelect = document.getElementById('regions');
  const citySelect = document.getElementById('city');
  const kindSelect = document.getElementById('kinds');
  const search = document.getElementById('search');
  const results = document.getElementById('results');
  const count = document.getElementById('count');
  const pager = document.getElementById('pager');
  const index = await loadJson('data/index.json');
  const catalog = await loadJson('data/museums.json');
  const citiesById = new Map(index.museumCities.map((city) => [city.id, city]));
  const regions = [...new Set(index.museumCities.map((c) => c.region))];
  const tokyo = index.museumCities.find((c) => c.id === 'tokyo');
  let region = tokyo?.region || regions[0];
  let cityId = 'all';
  let kind = 'all';
  let query = '';
  let page = 0;

  function citiesInRegion() {
    return index.museumCities.filter((c) => c.region === region);
  }

  function paintRegions() {
    regionSelect.querySelectorAll('[data-region]').forEach((chip) => {
      const sample = index.museumCities.find((c) => c.region === chip.dataset.region);
      chip.textContent = currentLang() === 'ja' ? sample?.regionJa || chip.dataset.region : chip.dataset.region;
      chip.classList.toggle('museum-dir__chip--active', chip.dataset.region === region);
      chip.classList.toggle('is-on', chip.dataset.region === region);
    });
  }

  function paintCities() {
    citySelect.innerHTML = '';
    const all = document.createElement('button');
    all.type = 'button';
    all.className = `museum-dir__city${cityId === 'all' ? ' museum-dir__city--active is-on' : ''}`;
    all.textContent = t().allCities;
    all.dataset.cityId = 'all';
    citySelect.appendChild(all);
    for (const city of citiesInRegion()) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = `museum-dir__city${city.id === cityId ? ' museum-dir__city--active is-on' : ''}`;
      chip.textContent = cityLabel(city);
      chip.dataset.cityId = city.id;
      citySelect.appendChild(chip);
    }
  }

  function catalogForSearch() {
    if (query.trim() || cityId === 'all') {
      const scoped = {};
      for (const city of citiesInRegion()) scoped[city.id] = catalog[city.id] || [];
      return scoped;
    }
    return { [cityId]: catalog[cityId] || [] };
  }

  function render() {
    paintRegions();
    paintCities();
    kindSelect.querySelectorAll('[data-kind]').forEach((chip) => {
      chip.classList.toggle('museum-dir__kind--active', chip.dataset.kind === kind);
      chip.classList.toggle('is-on', chip.dataset.kind === kind);
    });
    const rows = collectRows(catalogForSearch(), cityId, query, (row) => kind === 'all' || row.kind === kind);
    const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
    page = Math.min(page, pageCount - 1);
    const slice = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    const place = cityId === 'all' ? t().allCities : cityLabel(citiesById.get(cityId));
    count.textContent = cityId === 'all' || query
      ? t().shownAll(slice.length, rows.length)
      : t().shownIn(slice.length, rows.length, place);
    results.innerHTML = renderMuseums(slice, citiesById);
    pager.innerHTML = pagerHtml(page, pageCount);
    revealActiveChip(citySelect);
  }

  for (const next of regions) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'museum-dir__chip';
    chip.dataset.region = next;
    regionSelect.appendChild(chip);
  }

  regionSelect.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-region]');
    if (!chip) return;
    region = chip.dataset.region;
    cityId = 'all';
    page = 0;
    render();
  });
  citySelect.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-city-id]');
    if (!chip) return;
    cityId = chip.dataset.cityId;
    page = 0;
    render();
  });
  kindSelect.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-kind]');
    if (!chip) return;
    kind = chip.dataset.kind;
    page = 0;
    render();
  });
  search.addEventListener('input', () => {
    query = search.value;
    if (query.trim()) cityId = 'all';
    page = 0;
    render();
  });
  pager.addEventListener('click', (event) => {
    const dir = Number(event.target.dataset.dir || 0);
    if (!dir) return;
    page += dir;
    render();
  });
  window.addEventListener('wrte-lang', render);
  render();
}

async function bootHomeMap() {
  const mapRoot = document.getElementById('japan-map');
  if (!mapRoot) return;
  const index = await loadJson('data/index.json');
  paintJapanMap(mapRoot, index.japanCities, '', (id) => {
    window.location.href = `${rootPath() === '.' ? '.' : rootPath()}/seichi/manga/#${id}`;
  });
  window.addEventListener('wrte-lang', () => {
    paintJapanMap(mapRoot, index.japanCities, '', (id) => {
      window.location.href = `${rootPath() === '.' ? '.' : rootPath()}/seichi/manga/#${id}`;
    });
  });
}

wireLang();
wireChrome();
const page = document.documentElement.dataset.page;
if (page === 'home') {
  bootHomeMap().catch(() => {});
}
if (page === 'seichi') {
  bootSeichi().catch(() => {
    document.getElementById('results').textContent = 'Could not load this directory.';
  });
}
if (page === 'museums') {
  bootMuseums().catch(() => {
    document.getElementById('results').textContent = 'Could not load this directory.';
  });
}
