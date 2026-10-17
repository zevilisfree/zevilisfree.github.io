const assert = require('node:assert/strict');
const { calculateProjection } = require('../dca/dca.js');

const base = { initialAmount: 100000, monthlyAmount: 1000, annualReturn: 0, annualVolatility: 0, investmentYears: 2 };
const flat = calculateProjection(base);
assert.equal(flat.length, 3);
assert.equal(flat[1].principal, 112000);
assert.equal(flat[2].principal, 124000);
for (const row of flat) {
  for (const key of ['expected', 'p025', 'p16', 'p84', 'p975']) assert.equal(row[key], row.principal);
}

const growth = calculateProjection({ ...base, monthlyAmount: 0, annualReturn: 12 });
assert.ok(Math.abs(growth[1].expected - 112000) < 1e-6);
assert.equal(growth[1].p025, growth[1].p975);

const volatile = calculateProjection({ ...base, annualReturn: 8, annualVolatility: 20 });
assert.deepEqual(volatile, calculateProjection({ ...base, annualReturn: 8, annualVolatility: 20 }));
assert.ok(volatile[2].p025 < volatile[2].p16);
assert.ok(volatile[2].p16 < volatile[2].p84);
assert.ok(volatile[2].p84 < volatile[2].p975);
assert.throws(() => calculateProjection({ ...base, annualReturn: Infinity }), RangeError);
assert.throws(() => calculateProjection({ ...base, investmentYears: 1.5 }), RangeError);
const larger = calculateProjection({ ...base, initialAmount: 10000000, monthlyAmount: 200000 });
assert.equal(larger[1].principal, 12400000);
assert.equal(larger[1].expected, larger[1].principal);
assert.equal(calculateProjection({ ...base, initialAmount: 1000000000 })[0].principal, 1000000000);
for (const input of [
  { initialAmount: -1 }, { initialAmount: 1000000001 }, { initialAmount: 1.5 },
  { monthlyAmount: 100000001 }, { monthlyAmount: 2.5 }, { investmentYears: 0 }
]) assert.throws(() => calculateProjection({ ...base, ...input }), RangeError);

console.log('DCA 計算檢查通過');
