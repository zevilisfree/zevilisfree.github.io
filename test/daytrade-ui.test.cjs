const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// 1. 靜態 HTML 結構與根入口導向驗證
const indexHtml = fs.readFileSync('index.html', 'utf8');
assert.match(indexHtml, /<meta http-equiv="refresh" content="0; url=daytrade\/">/, '根入口保留單一原生 meta refresh 相對導向');
assert.doesNotMatch(indexHtml, /<script>|location\.replace/, '根入口移除重複 JS redirect');
assert.match(indexHtml, /<a href="daytrade\/">/, '根入口保留可點擊的備援連結');

const daytradeHtml = fs.readFileSync('daytrade/index.html', 'utf8');
assert.doesNotMatch(daytradeHtml, /<button[^>]*type="submit"/, '當沖頁已移除計算損益 submit 按鈕');
assert.doesNotMatch(daytradeHtml, /計算損益/, '當沖頁已移除計算損益按鈕文字');
assert.doesNotMatch(daytradeHtml, /class="tool-switch"/, '當沖頁已移除其他工具互連區塊');
assert.doesNotMatch(daytradeHtml, /設定進場價格與交易成本/, '當沖頁已移除首屏冗長導言');
assert.match(daytradeHtml, /<h1[^>]*>台股當沖損益計算機<\/h1>/, '當沖頁保留語意主標題');

const dcaHtml = fs.readFileSync('dca/index.html', 'utf8');
assert.doesNotMatch(dcaHtml, /class="tool-switch"/, 'DCA 頁已移除其他工具互連區塊');
assert.doesNotMatch(dcaHtml, /設定投入方式與報酬假設/, 'DCA 頁已移除首屏冗長導言');
assert.match(dcaHtml, /<h1[^>]*>定期定額風險與獲利評估<\/h1>/, 'DCA 頁保留語意主標題');

// 2. 當沖計算機 UI 互動與自動計算測試
function node(value = '') {
  return {
    value, validity: { badInput: false }, hidden: false, className: '', children: [], attributes: {},
    addEventListener(type, handler) { this[type] = handler; },
    setAttribute(name, val) { this.attributes[name] = String(val); },
    getAttribute(name) { return this.attributes[name]; },
    replaceChildren() { this.children = []; },
    appendChild(child) { this.children.push(child); }
  };
}
const elements = Object.fromEntries(['entryPrice', 'lots', 'discount', 'minimumFee', 'direction'].map((name, index) => [name, node(['100', '1', '2.8', '20', 'long'][index])]));
elements.dayTrade = { checked: true };
const form = Object.assign(node(), { elements });
const results = node(), error = node(), rows = node(), summary = node(), toggle = node(), caption = node();
const nodes = {
  'trade-form': form,
  'trade-results': results,
  'trade-error': error,
  'trade-rows': rows,
  'trade-summary': summary,
  'trade-toggle-rows': toggle,
  'trade-caption': caption
};
vm.runInNewContext(fs.readFileSync('daytrade/daytrade.js', 'utf8'), {
  document: { getElementById: id => nodes[id], createElement: () => node() }, Intl
});

// 預設載入即自動試算，顯示前後各 5 檔
assert.equal(results.hidden, false, '預設載入即顯示試算結果');
assert.equal(rows.children.length, 11, '預設顯示進場價加前後各 5 檔（共 11 列）');
assert.match(summary.textContent, /做多.*0.15%/);
assert.match(caption.textContent, /5 檔/);
assert.equal(toggle.attributes['aria-expanded'], 'false');
assert.equal(toggle.textContent, '展開前後各 10 檔');
assert.equal(toggle.hidden, false);
const entryRow = rows.children.find(row => row.className.includes('is-entry'));
assert.ok(entryRow, '進場價列有 is-entry');
assert.equal(entryRow.children[1].textContent, '-$230');
const nearestRow = rows.children.find(row => row.className.includes('is-nearest'));
assert.ok(nearestRow, '可見列中有最近損益兩平標記');

// 展開至前後各 10 檔
toggle.click();
assert.equal(rows.children.length, 21, '展開後顯示前後各 10 檔加進場價（共 21 列）');
assert.match(caption.textContent, /10 檔/);
assert.equal(toggle.attributes['aria-expanded'], 'true');
assert.equal(toggle.textContent, '收合為各 5 檔');
assert.ok(rows.children.find(row => row.className.includes('is-nearest')), '展開後可見列仍有最近損益兩平標記');

// 收合回各 5 檔
toggle.click();
assert.equal(rows.children.length, 11, '收合後恢復各 5 檔（11 列）');
assert.match(caption.textContent, /5 檔/);
assert.equal(toggle.attributes['aria-expanded'], 'false');
assert.equal(toggle.textContent, '展開前後各 10 檔');

// 無效輸入立即隱藏舊結果並顯示欄位提示（自動觸發，不需 submit 按鈕）
toggle.click(); // 先展開為 10 檔
assert.equal(rows.children.length, 21);
elements.entryPrice.value = '50.03';
form.input();
assert.equal(results.hidden, true, '無效輸入立即自動隱藏舊結果');
assert.equal(error.hidden, false, '無效輸入立即顯示欄位提示');
assert.match(error.textContent, /升降單位/);
assert.equal(rows.children.length, 0, '無效輸入清空舊結果列');

// 更正後自動恢復計算，且重置回各 5 檔
elements.entryPrice.value = '100';
elements.direction.value = 'short';
elements.dayTrade.checked = false;
form.change();
assert.equal(error.hidden, true, '更正後自動隱藏錯誤提示');
assert.equal(results.hidden, false, '更正後自動恢復並呈現結果');
assert.equal(rows.children.length, 11, '重新計算後回到各 5 檔');
assert.equal(toggle.attributes['aria-expanded'], 'false', '檔位展開狀態重設為 false');
assert.match(summary.textContent, /做空.*0.3%/);
assert.equal(rows.children.find(row => row.className.includes('is-entry')).children[4].textContent, '$300');

// 展開為 10 檔後，修改參數自動重算並重設回各 5 檔
toggle.click();
assert.equal(rows.children.length, 21, '切換展開至 21 列');
assert.equal(toggle.attributes['aria-expanded'], 'true');
elements.lots.value = '2';
form.input();
assert.equal(results.hidden, false, '修改張數自動重新計算');
assert.equal(rows.children.length, 11, '修改張數後自動重置為各 5 檔');
assert.equal(toggle.attributes['aria-expanded'], 'false', '展開按鈕狀態重置為 false');
assert.match(summary.textContent, /2 張/);

// 暫時空白立即隱藏舊結果，更正後自動恢復
elements.lots.value = '';
form.input();
assert.equal(results.hidden, true, '輸入暫時空白時立即隱藏舊結果');
assert.equal(error.hidden, false);
assert.match(error.textContent, /有效數字/);
assert.equal(rows.children.length, 0, '錯誤輸入清空舊結果列');

elements.lots.value = '1';
form.input();
assert.equal(results.hidden, false, '更正合法張數後立即自動恢復');
assert.equal(error.hidden, true);
assert.equal(rows.children.length, 11);

// 按 Enter 不得重新載入頁面（preventDefault 驗證）
let submitPrevented = false;
form.submit({ preventDefault() { submitPrevented = true; } });
assert.equal(submitPrevented, true, '表單 submit 事件呼叫 preventDefault 防止頁面重新載入');
assert.equal(results.hidden, false);

let enterPrevented = false;
form.keydown({ key: 'Enter', preventDefault() { enterPrevented = true; } });
assert.equal(enterPrevented, true, '按 Enter 鍵呼叫 preventDefault 防止重新載入');
assert.equal(results.hidden, false);

let otherKeyPrevented = false;
form.keydown({ key: 'Tab', preventDefault() { otherKeyPrevented = true; } });
assert.equal(otherKeyPrevented, false, '其他按鍵不攔截預設行為');

// 價格下界邊界處理（0.01 元進場價）
elements.entryPrice.value = '0.01';
elements.direction.value = 'long';
elements.dayTrade.checked = true;
form.input();
assert.equal(results.hidden, false);
assert.equal(rows.children.length, 6, '0.01 元進場價下方無合法價位，未展開時共 6 列（進場 + 後 5 檔）');
assert.equal(toggle.attributes['aria-expanded'], 'false');
assert.ok(rows.children.find(row => row.className.includes('is-nearest')), '邊界條件下可見列仍有最近損益兩平標記');

toggle.click();
assert.equal(rows.children.length, 11, '0.01 元展開時共 11 列（進場 + 後 10 檔）');
assert.equal(toggle.attributes['aria-expanded'], 'true');

elements.direction.value = 'short';
form.change();
assert.equal(rows.children.length, 6, '邊界條件下參數變更自動重置為未展開 6 列');
assert.equal(toggle.attributes['aria-expanded'], 'false');

console.log('當沖自動計算、無效與更正、檔位重置、Enter 防重載與根入口導向檢查通過');
