const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const shell = fs.readFileSync('js/site-shell.js', 'utf8');
const contentPages = ['daytrade/index.html', 'dca/index.html', 'macro/index.html', 'macro/index1.html', 'macro/index2.html', 'macro/index3.html', 'macro/index4.html', 'macro/index5.html'];

function renderShell(file, hover = true) {
  const slots = Object.fromEntries(['header-slot', 'footer-slot', 'scroll-top-slot'].map(id => [id, { replaceWith(node) { this.result = node; } }]));
  const document = {
    getElementById: id => slots[id],
    createElement: tag => {
      const node = {
        tag, children: [], attributes: {}, events: {}, className: '',
        setAttribute(name, value) { this.attributes[name] = value; },
        getAttribute(name) { return this.attributes[name]; },
        addEventListener(name, callback) { this.events[name] = callback; },
        append(...children) { this.children.push(...children); }
      };
      node.classList = {
        toggle(name, on) { node.className = `${node.className.replace(` ${name}`, '')}${on ? ` ${name}` : ''}`; },
        remove(name) { node.className = node.className.replace(` ${name}`, ''); }
      };
      return node;
    }
  };
  const content = document.createElement('div');
  content.prepend = node => content.children.unshift(node);
  document.querySelector = selector => selector === '.container-fluid' ? content : null;
  vm.runInNewContext(shell, { document, window: { location: { pathname: `/repo/${file}` }, matchMedia: () => ({ matches: hover }) }, Date });
  const descendants = node => [node, ...node.children.flatMap(descendants)];
  return {
    header: descendants(slots['header-slot'].result),
    content: descendants(content),
    footer: descendants(slots['footer-slot'].result),
    top: descendants(slots['scroll-top-slot'].result)
  };
}

for (const file of contentPages) {
  const html = fs.readFileSync(file, 'utf8');
  assert.match(html, /<html lang="zh-TW">/, file);
  assert.match(html, /css\/site\.css/, file);
  assert.doesNotMatch(html, /id="sidebar-slot"|id="sidebarToggleTop"|UA-158972391-1|googletagmanager/, file);
  for (const id of ['header-slot', 'footer-slot', 'scroll-top-slot']) {
    assert.equal(html.split(`id="${id}"`).length - 1, 1, `${file}: ${id}`);
  }
  assert.match(html, /<script src="\.\.\/js\/site-shell\.js"><\/script>/, file);
  for (const [, href] of html.matchAll(/href="(?!https?:\/\/)([^"]+\.html)"/g)) {
    assert.ok(fs.existsSync(path.resolve(path.dirname(file), href)), `${file}: broken local link ${href}`);
  }
  for (const [, target, anchor] of html.matchAll(/href="(?!https?:\/\/)([^"]+\.html)#([^"]+)"/g)) {
    const resolved = path.resolve(path.dirname(file), target);
    assert.ok(fs.existsSync(resolved), `${file}: broken local link ${target}`);
    assert.ok(fs.readFileSync(resolved, 'utf8').includes(`id="${anchor}"`), `${file}: broken anchor ${target}#${anchor}`);
  }
  const { header, content, footer, top } = renderShell(file);
  const brand = header.find(node => node.className === 'site-brand');
  assert.equal(brand.href, '../daytrade/', file);
  const nav = header.find(node => node.tag === 'nav');
  assert.equal(nav.id, 'site-navigation', file);
  const navLinks = nav.children.filter(node => node.tag === 'a');
  assert.deepEqual(navLinks.map(node => node.textContent), ['台股當沖計算', '定期定額試算', '總經資料'], file);
  assert.deepEqual(navLinks.map(node => node.href), ['../daytrade/', '../dca/', '../macro/'], file);
  assert.deepEqual(
    navLinks.filter(node => node.attributes['aria-current'] === 'page').map(node => node.href),
    ['daytrade/index.html', 'dca/index.html', 'macro/index.html'].includes(file) ? [`../${file.split('/')[0]}/`] : [],
    file
  );
  if (['macro/index1.html', 'macro/index2.html', 'macro/index3.html', 'macro/index4.html', 'macro/index5.html'].includes(file)) {
    const macroNav = navLinks.find(node => node.href === '../macro/');
    assert.match(macroNav.className, /is-current-section|is-current/, file);
  }
  assert.equal(brand.attributes['aria-current'] === 'page', file === 'daytrade/index.html', file);
  assert.equal(footer.filter(node => node.tag === 'footer').length, 1, file);
  assert.equal(top.filter(node => node.href === '#page-top').length, 1, file);
  const journey = content.filter(node => node.className === 'phase-journey');
  assert.equal(journey.length, ['macro/index.html', 'macro/index1.html', 'macro/index2.html', 'macro/index3.html', 'macro/index4.html'].includes(file) ? 1 : 0, file);
  for (const [frame] of html.matchAll(/<iframe\b[^>]*>/g)) {
    assert.match(frame, /title="FRED (?:圖表|互動圖)：[^\"]+"/, file);
    assert.match(frame, /referrerpolicy="no-referrer"/, file);
  }
}

const sequence = ['macro/index.html', 'macro/index1.html', 'macro/index2.html', 'macro/index3.html', 'macro/index4.html'];
const localSequence = sequence.map(file => path.basename(file));
for (const [index, file] of sequence.entries()) {
  const content = renderShell(file).content;
  const steps = content.filter(node => node.className === 'phase-step');
  assert.deepEqual(steps.map(node => node.href), localSequence, file);
  assert.deepEqual(steps.filter(node => node.attributes['aria-current'] === 'page').map(node => node.href), [path.basename(file)], file);
  const pager = content.filter(node => node.className.startsWith('phase-pager-link'));
  assert.deepEqual(pager.map(node => node.href), index === 0 ? ['index1.html'] : [localSequence[index - 1], localSequence[index + 1] || 'index1.html'], file);
  if (file === 'macro/index4.html') assert.match(pager.at(-1).textContent, /下一輪 · 復甦期/);
  assert.ok(content.some(node => node.href === 'index5.html'), `${file}: reference link`);
}
const reference = renderShell('macro/index5.html').content;
assert.equal(reference.filter(node => node.className === 'phase-reference').length, 1);
assert.ok(reference.some(node => node.href === 'index.html'));

for (const module of ['daytrade', 'dca', 'macro']) {
  const { header } = renderShell(`${module}/`);
  const current = header.filter(node => node.attributes['aria-current'] === 'page');
  assert.ok(current.some(node => node.href === `../${module}/`), `${module}/: directory entry navigation`);
}

const { header } = renderShell('daytrade/index.html');
const headerNode = header.find(node => node.tag === 'header');
const toggle = header.find(node => node.className === 'site-menu-toggle');
const nav = header.find(node => node.tag === 'nav');
toggle.events.click();
assert.equal(toggle.attributes['aria-expanded'], 'true');
assert.match(nav.className, /is-open/);
toggle.events.click();
assert.equal(toggle.attributes['aria-expanded'], 'false');
assert.doesNotMatch(nav.className, /is-open/);
toggle.events.click();
assert.match(nav.className, /is-open/);
nav.children[0].events.click();
assert.equal(toggle.attributes['aria-expanded'], 'false');
assert.doesNotMatch(nav.className, /is-open/);

toggle.events.click();
assert.match(nav.className, /is-open/);
headerNode.events.keydown({ key: 'Escape' });
assert.equal(toggle.attributes['aria-expanded'], 'false');
assert.doesNotMatch(nav.className, /is-open/);

const css = fs.readFileSync('css/site.css', 'utf8');
assert.match(css, /\.site-nav-link/);
assert.throws(() => vm.runInNewContext(shell, {
  document: { getElementById: () => null }, window: { location: { pathname: '/' } }
}), /共用版型缺少插入點/);

const indexHtml = fs.readFileSync('index.html', 'utf8');
assert.match(indexHtml, /<meta http-equiv="refresh" content="0; url=daytrade\/">/);
assert.doesNotMatch(indexHtml, /<script>|location\.replace/);
assert.match(indexHtml, /<a href="daytrade\/">/);
assert.doesNotMatch(indexHtml, /class="cycle-art"|class="home-hero-panel"|class="topic-macro"/);
assert.doesNotMatch(indexHtml, /class="stage-grid"|class="hero-tools-grid"|class="home-tools-hero"/);

const dcaHtml = fs.readFileSync('dca/index.html', 'utf8');
assert.doesNotMatch(dcaHtml, /class="tool-switch"/);
assert.doesNotMatch(dcaHtml, /設定投入方式與報酬假設/);
const daytradeHtml = fs.readFileSync('daytrade/index.html', 'utf8');
assert.doesNotMatch(daytradeHtml, /class="tool-switch"/);
assert.doesNotMatch(daytradeHtml, /設定進場價格與交易成本/);
assert.doesNotMatch(daytradeHtml, /<button[^>]*type="submit"/);
assert.doesNotMatch(daytradeHtml, /計算損益/);
const overview = fs.readFileSync('macro/index.html', 'utf8');
assert.match(overview, /<h1[^>]*>景氣循環概覽<\/h1>/);
assert.match(overview, /景氣擴張以「生產力」及「通膨」為主軸輪替循環/);
assert.equal((overview.match(/<iframe\b/g) || []).length, 3);
for (const id of ['p6lL', 'p82n', 'pq3r']) assert.match(overview, new RegExp(`graph-landing\\.php\\?g=${id}(?:&|\")`));
for (const [file, title] of Object.entries({
  'macro/index1.html': '復甦期',
  'macro/index2.html': '成長期',
  'macro/index3.html': '榮景期',
  'macro/index4.html': '衰退期'
})) {
  assert.match(fs.readFileSync(file, 'utf8'), new RegExp(title), `${file}: original stage content`);
}
const indicators = fs.readFileSync('macro/index5.html', 'utf8');
assert.match(indicators, /美國投資人情緒指數\(AAII Sentiment Survey\)/);
assert.match(indicators, /AAII Sentiment Survey/);
assert.match(indicators, /https:\/\/www\.aaii\.com\/sentimentsurvey/);
assert.match(indicators, /https:\/\/www\.cnn\.com\/markets\/fear-and-greed/);
assert.doesNotMatch(indicators, /quandl\.com|money\.cnn\.com|sentimentsurvey\/sent_results/);
const boom = fs.readFileSync('macro/index3.html', 'utf8');
assert.match(boom, /展望2020/);
assert.match(boom, /2019–2020 歷史筆記/);
assert.equal((boom.match(/graph-landing\.php\?g=poSH(?:&|")/g) || []).length, 1);
assert.doesNotMatch(overview, /macromicro\.me\/charts\/406\/us-buffet-index-gspc/);
assert.doesNotMatch(fs.readFileSync('macro/index2.html', 'utf8'), /macromicro\.me\/charts\/14802\//);
const chartInventory = {
  'macro/index1.html': 'nHfv,pq5A,nIkW,pq6I,pq6S,BivG,nHUT,nHW0,nI0C,Biuf,pu9M,nF9n,pm90',
  'macro/index2.html': 'pq3r,nYxZ,nYy5,prnj,nYFu,nYFM,nYFV,nYRo,pmoz,pmtf',
  'macro/index3.html': 'nt5X,oUaT,oIk0,oP3o,qegH,puCX,pub5,oPDq,puD4,puD8,oGZA,poSH,puCo,pu9M,tJIn',
  'macro/index4.html': 'pq3r,puGu,oZAp,pv4M,pv5u,pv7d,pxTa,pxUr',
  'macro/index5.html': 'qnfb,qegs,qegC,oP3o,qegH,qegL,BixX'
};
for (const [file, ids] of Object.entries(chartInventory)) {
  const html = fs.readFileSync(file, 'utf8');
  for (const id of ids.split(',')) assert.match(html, new RegExp(`graph-landing\\.php\\?g=${id}(?:&|\")`), `${file}: chart ${id}`);
}
const calculator = fs.readFileSync('dca/index.html', 'utf8');
assert.doesNotMatch(calculator, /<script[^>]+https?:\/\//);
assert.match(calculator, /<script src="dca\.js" defer><\/script>/);
for (const id of ['initialAmount', 'monthlyAmount', 'annualReturn', 'annualVolatility', 'investmentYears']) {
  assert.match(calculator, new RegExp(`<label for="${id}Manual">`));
  assert.match(calculator, new RegExp(`<input id="${id}Manual" type="number"`));
  assert.match(calculator, new RegExp(`<input id="${id}" type="range"`));
}
const dayTrade = fs.readFileSync('daytrade/index.html', 'utf8');
assert.match(dayTrade, /<script src="daytrade\.js" defer><\/script>/);
assert.doesNotMatch(dayTrade, /<script[^>]+https?:\/\//);
for (const file of ['index.html', ...contentPages]) {
  const html = fs.readFileSync(file, 'utf8');
  for (const [, url] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
    if (/^(?:https?:|#|data:|mailto:)/.test(url) || !url) continue;
    const [target, anchor] = url.split('#');
    const resolved = path.resolve(path.dirname(file), target);
    assert.ok(fs.existsSync(resolved), `${file}: broken local resource ${url}`);
    const resource = fs.statSync(resolved).isDirectory() ? path.join(resolved, 'index.html') : resolved;
    assert.ok(fs.existsSync(resource), `${file}: missing directory entry ${url}`);
    if (anchor) assert.ok(fs.readFileSync(resource, 'utf8').includes(`id="${anchor}"`), `${file}: broken anchor ${url}`);
  }
}
console.log('頂部導覽與靜態頁面檢查通過');
