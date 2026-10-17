const assert = require('node:assert/strict');
const { calculateDayTrade } = require('../daytrade/daytrade.js');

const base = { entryPrice: 100, lots: 1, discount: 2.8, minimumFee: 20, direction: 'long', dayTrade: true };
const calculate = changes => calculateDayTrade({ ...base, ...changes });
const at = (rows, price) => rows.find(row => row.exitPrice === price);

const long = calculate({});
assert.equal(long.length, 21);
assert.deepEqual((({ returnRate, ...row }) => row)(at(long, 100)), { exitPrice: 100, profit: -230, fees: 80, tax: 150 });
assert.equal(at(long, 100).returnRate.toFixed(2), '-0.23');
assert.equal(at(long, 100.5).profit, 269);
assert.equal(at(calculate({ direction: 'short' }), 100).profit, -230);
assert.equal(at(calculate({ direction: 'short' }), 99.5).profit, 270);
assert.equal(at(calculate({ dayTrade: false }), 100).tax, 300);
assert.equal(at(calculate({ entryPrice: 10, discount: 0 }), 10).fees, 40);
assert.equal(at(calculate({ entryPrice: 10, discount: 0, minimumFee: 0 }), 10).fees, 0);
assert.deepEqual(calculate({ entryPrice: 49.95 }).map(row => row.exitPrice).slice(9, 13), [49.9, 49.95, 50, 50.1]);
assert.deepEqual(calculate({ entryPrice: 100 }).map(row => row.exitPrice).slice(9, 13), [99.9, 100, 100.5, 101]);
for (const changes of [
  { entryPrice: 50.03 }, { entryPrice: 0 }, { entryPrice: 10000.01 }, { entryPrice: NaN },
  { lots: 1.5 }, { lots: 0 }, { discount: -1 }, { minimumFee: 1.5 },
  { direction: 'other' }, { dayTrade: 'yes' }
]) assert.throws(() => calculate(changes), RangeError);
console.log('當沖損益與股票升降單位檢查通過');
