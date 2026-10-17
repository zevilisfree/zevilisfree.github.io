const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { calculateProjection } = require('../dca/dca.js');

function element(value = '') {
  return {
    value, hidden: false, validity: { badInput: false }, children: [],
    addEventListener(event, callback) { this[event] = callback; },
    replaceChildren() { this.children = []; },
    appendChild(child) { this.children.push(child); },
    setAttribute() {}
  };
}

const config = {
  initialAmount: ['500000', '0', '5000000'], monthlyAmount: ['10000', '0', '100000'],
  annualReturn: ['15', '0', '30'], annualVolatility: ['15', '0', '50'],
  investmentYears: ['15', '1', '40']
};
const nodes = Object.fromEntries(['chart', 'error', 'yearlyData', 'principalResult', 'expectedResult',
  'upperResult', 'lowerResult'].map(id => [id, element()]));
for (const [name, [value, min, max]] of Object.entries(config)) {
  nodes[name] = Object.assign(element(value), { min, max });
  nodes[`${name}Manual`] = element(value);
}
const results = element();
let pending;
const flush = () => { const callback = pending; pending = null; callback(); };
const document = {
  getElementById(id) { return nodes[id]; },
  querySelector(selector) { assert.equal(selector, '.results'); return results; },
  createElement: () => element(), createElementNS: () => element()
};
vm.runInNewContext(fs.readFileSync('dca/dca.js', 'utf8'), {
  document, Intl, setTimeout(callback) { pending = callback; return 1; }, clearTimeout() { pending = null; }
});

assert.equal(results.hidden, false);
nodes.initialAmountManual.value = '10000000';
nodes.initialAmountManual.input();
assert.equal(results.hidden, true);
flush();
assert.equal(nodes.initialAmount.value, '5000000');
assert.equal(nodes.initialAmountManual.value, '10000000');
assert.match(nodes.principalResult.textContent, /11,800,000/);

nodes.annualReturnManual.value = '7.25';
nodes.annualReturnManual.input();
flush();
assert.equal(nodes.annualReturnManual.value, '7.25');
assert.equal(nodes.expectedResult.textContent, new Intl.NumberFormat('zh-TW', {
  style: 'currency', currency: 'TWD', maximumFractionDigits: 0
}).format(calculateProjection({ initialAmount: 10000000, monthlyAmount: 10000,
  annualReturn: 7.25, annualVolatility: 15, investmentYears: 15 }).at(-1).expected));
assert.equal(results.hidden, false);

nodes.monthlyAmountManual.value = '';
nodes.monthlyAmountManual.input();
flush();
assert.equal(results.hidden, true);
assert.equal(nodes.error.hidden, false);

nodes.monthlyAmount.value = '25000';
nodes.monthlyAmount.input();
flush();
assert.equal(nodes.monthlyAmountManual.value, '25000');
assert.equal(results.hidden, false);
assert.equal(nodes.error.hidden, true);

nodes.initialAmountManual.value = '1000000001';
nodes.initialAmountManual.input();
flush();
assert.equal(results.hidden, true);
nodes.initialAmount.value = '500000';
nodes.initialAmount.input();
flush();
assert.equal(nodes.initialAmountManual.value, '500000');
assert.equal(results.hidden, false);

console.log('DCA 雙向輸入與錯誤恢復檢查通過');
