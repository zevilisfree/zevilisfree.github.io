const assert = require('node:assert/strict');
const fs = require('node:fs');

const css = fs.readFileSync('css/site.css', 'utf8');
const shell = fs.readFileSync('js/site-shell.js', 'utf8');
assert.match(shell, /label:\s*'定期定額試算'/);
assert.match(shell, /label:\s*'台股當沖計算'/);
assert.match(shell, /label:\s*'總經資料'/);
assert.match(css, /\.site-nav-link/);
assert.doesNotMatch(css, /\.hero-tools-grid|\.home-tools-hero|\.tool-switch|\.site-category|\.site-submenu/);
for (const file of [
  'css/sb-admin-2.css', 'css/sb-admin-2.min.css',
  'js/sb-admin-2.js', 'js/sb-admin-2.min.js',
  'vendor/Chart.min.js', 'vendor/bootstrap.bundle.min.js',
  'vendor/jquery.easing.min.js', 'vendor/jquery.min.js'
]) assert.equal(fs.existsSync(file), false, `${file}: legacy asset removed`);
assert.match(css, /#wrapper #content-wrapper\s*\{[^}]*background:\s*var\(--paper\);[^}]*overflow-x:\s*visible;/s,
  '共用頁面背景與溢出規則須蓋過既有版型');
assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(css, /@media \(max-width: 900px\)/);
assert.match(css, /@media \(max-width: 650px\)/);

const contentPages = ['daytrade/index.html', 'dca/index.html', 'macro/index.html', 'macro/index1.html', 'macro/index2.html', 'macro/index3.html', 'macro/index4.html', 'macro/index5.html'];
for (const file of contentPages) {
  const html = fs.readFileSync(file, 'utf8');
  assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1">/, file);
  assert.match(html, /<noscript><nav[^>]*>.*href="\.\.\/daytrade\/".*<\/nav><\/noscript>/s, `${file}: 無 JavaScript 導覽`);
  assert.match(html, /<noscript><nav[^>]*>.*href="\.\.\/dca\/".*<\/nav><\/noscript>/s, `${file}: 無 JavaScript 導覽包含定期定額`);
  assert.match(html, /<noscript><nav[^>]*>.*href="\.\.\/macro\/".*<\/nav><\/noscript>/s, `${file}: 無 JavaScript 導覽包含總經`);
  assert.doesNotMatch(html, /font-awesome\/5\.11\.2|fonts\.googleapis\.com/, `${file}: 不使用的外部字型或圖示樣式`);
}

const indexHtml = fs.readFileSync('index.html', 'utf8');
assert.match(indexHtml, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
assert.match(indexHtml, /<meta http-equiv="refresh" content="0; url=daytrade\/">/);
assert.doesNotMatch(indexHtml, /<script>|location\.replace/);
assert.match(indexHtml, /<a href="daytrade\/">/);
assert.doesNotMatch(indexHtml, /font-awesome\/5\.11\.2|fonts\.googleapis\.com/);

console.log('計算機直接入口與緊湊操作版型檢查通過');
