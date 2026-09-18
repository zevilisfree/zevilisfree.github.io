(function () {
  'use strict';

  const limits = {
    initialAmount: [0, 1000000000], monthlyAmount: [0, 100000000],
    annualReturn: [0, 30], annualVolatility: [0, 50], investmentYears: [1, 40]
  };
  const labels = {
    initialAmount: '初始投入金額', monthlyAmount: '每月底投入金額',
    annualReturn: '預期年化報酬率', annualVolatility: '年化波動率', investmentYears: '投入年數'
  };
  const simulations = 5000;

  function calculateProjection(input) {
    for (const [name, [minimum, maximum]] of Object.entries(limits)) {
      if (!Number.isFinite(input[name]) || input[name] < minimum || input[name] > maximum) {
        throw new RangeError(`${labels[name]}須介於 ${minimum.toLocaleString('zh-TW')} 與 ${maximum.toLocaleString('zh-TW')} 之間`);
      }
    }
    if (!Number.isInteger(input.initialAmount) || !Number.isInteger(input.monthlyAmount)) {
      throw new RangeError('投入金額必須是整數元');
    }
    if (!Number.isInteger(input.investmentYears)) throw new RangeError('投入年數必須是整數');

    const { initialAmount, monthlyAmount, investmentYears } = input;
    const monthlyMean = Math.pow(1 + input.annualReturn / 100, 1 / 12);
    const monthlyVolatility = input.annualVolatility / 100 / Math.sqrt(12);
    const annualValues = Array.from({ length: investmentYears + 1 }, () => []);
    let randomState = 0x6d2b79f5;
    let spareNormal = null;

    function uniform() {
      randomState ^= randomState << 13;
      randomState ^= randomState >>> 17;
      randomState ^= randomState << 5;
      return (randomState >>> 0) / 4294967296;
    }
    function normal() {
      if (spareNormal !== null) {
        const result = spareNormal;
        spareNormal = null;
        return result;
      }
      const radius = Math.sqrt(-2 * Math.log(1 - uniform()));
      const angle = 2 * Math.PI * uniform();
      spareNormal = radius * Math.sin(angle);
      return radius * Math.cos(angle);
    }

    for (let simulation = 0; simulation < simulations; simulation++) {
      let balance = initialAmount;
      annualValues[0].push(balance);
      for (let month = 1; month <= investmentYears * 12; month++) {
        const factor = monthlyVolatility === 0 ? monthlyMean :
          Math.exp(Math.log(monthlyMean) - monthlyVolatility ** 2 / 2 + monthlyVolatility * normal());
        balance = balance * factor + monthlyAmount;
        if (month % 12 === 0) annualValues[month / 12].push(balance);
      }
    }

    const percentile = (sorted, share) => {
      const index = (sorted.length - 1) * share;
      const low = Math.floor(index);
      return sorted[low] + (sorted[Math.ceil(index)] - sorted[low]) * (index - low);
    };
    const rows = [];
    let expected = initialAmount;
    for (let year = 0; year <= investmentYears; year++) {
      if (year > 0) for (let month = 0; month < 12; month++) expected = expected * monthlyMean + monthlyAmount;
      const sorted = annualValues[year].sort((a, b) => a - b);
      rows.push({
        year, principal: initialAmount + year * 12 * monthlyAmount, expected,
        p025: percentile(sorted, .025), p16: percentile(sorted, .16),
        p84: percentile(sorted, .84), p975: percentile(sorted, .975)
      });
    }
    if (rows.some(row => Object.values(row).some(value => !Number.isFinite(value)))) {
      throw new RangeError('試算金額超出可計算範圍');
    }
    return rows;
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { calculateProjection };
  if (typeof document === 'undefined') return;

  const names = Object.keys(limits);
  const inputs = Object.fromEntries(names.map(name => [name, document.getElementById(name)]));
  const manualInputs = Object.fromEntries(names.map(name => [name, document.getElementById(`${name}Manual`)]));
  const currency = new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 });
  const compact = new Intl.NumberFormat('zh-TW', { notation: 'compact', maximumFractionDigits: 1 });
  const svgNamespace = 'http://www.w3.org/2000/svg';
  const chart = document.getElementById('chart');
  const results = document.querySelector('.results');
  let timer;

  function svgElement(tag, attributes, value) {
    const element = document.createElementNS(svgNamespace, tag);
    for (const [name, attribute] of Object.entries(attributes)) element.setAttribute(name, String(attribute));
    if (value !== undefined) element.textContent = value;
    chart.appendChild(element);
  }

  function drawChart(rows) {
    chart.replaceChildren();
    const left = 78, top = 18, width = 790, height = 278;
    const maximum = Math.max(1, ...rows.map(row => row.p975)) * 1.08;
    const x = year => left + year / (rows.length - 1) * width;
    const y = amount => top + height * (1 - amount / maximum);
    for (let tick = 0; tick <= 4; tick++) {
      const amount = maximum * tick / 4;
      const position = y(amount);
      svgElement('line', { x1: left, y1: position, x2: left + width, y2: position, stroke: '#e1e7ef' });
      svgElement('text', { x: left - 9, y: position + 4, 'text-anchor': 'end', fill: '#526177', 'font-size': 12 }, compact.format(amount));
    }
    const step = Math.max(1, Math.ceil((rows.length - 1) / 8));
    for (let year = 0; year < rows.length; year += step) {
      svgElement('text', { x: x(year), y: 324, 'text-anchor': 'middle', fill: '#526177', 'font-size': 12 }, String(year));
    }
    if ((rows.length - 1) % step !== 0) svgElement('text', { x: x(rows.length - 1), y: 324, 'text-anchor': 'middle', fill: '#526177', 'font-size': 12 }, String(rows.length - 1));
    const lines = [
      ['p975', '#12a268', 1.7], ['p84', '#65b98b', 1.7],
      ['expected', '#2866ba', 3], ['p16', '#d59519', 1.7],
      ['p025', '#d34a4a', 1.7], ['principal', '#8995a7', 1.7]
    ];
    for (const [key, color, strokeWidth] of lines) {
      const points = rows.map(row => `${x(row.year).toFixed(2)},${y(row[key]).toFixed(2)}`).join(' ');
      svgElement('polyline', { points, fill: 'none', stroke: color, 'stroke-width': strokeWidth, 'stroke-linejoin': 'round' });
    }
  }

  function render() {
    const error = document.getElementById('error');
    try {
      for (const name of names) {
        if (manualInputs[name].value === '' || manualInputs[name].validity.badInput) {
          throw new RangeError('請輸入有效的數字');
        }
      }
      const input = Object.fromEntries(names.map(name => [name, Number(manualInputs[name].value)]));
      const rows = calculateProjection(input);
      error.hidden = true;
      results.hidden = false;
      const final = rows.at(-1);
      for (const [id, key] of Object.entries({ principalResult: 'principal', expectedResult: 'expected', upperResult: 'p975', lowerResult: 'p025' })) {
        document.getElementById(id).textContent = currency.format(final[key]);
      }
      drawChart(rows);
      const body = document.getElementById('yearlyData');
      body.replaceChildren();
      for (const row of rows) {
        const line = document.createElement('tr');
        for (const key of ['year', 'principal', 'expected', 'p025', 'p16', 'p84', 'p975']) {
          const cell = document.createElement(key === 'year' ? 'th' : 'td');
          if (key === 'year') cell.scope = 'row';
          cell.textContent = key === 'year' ? String(row.year) : currency.format(row[key]);
          line.appendChild(cell);
        }
        body.appendChild(line);
      }
    } catch (cause) {
      error.textContent = cause instanceof RangeError ? cause.message : '試算失敗，請重新整理頁面。';
      error.hidden = false;
      results.hidden = true;
    }
  }

  function scheduleRender() {
    results.hidden = true;
    clearTimeout(timer);
    timer = setTimeout(render, 120);
  }
  for (const name of names) {
    inputs[name].addEventListener('input', () => {
      manualInputs[name].value = inputs[name].value;
      scheduleRender();
    });
    manualInputs[name].addEventListener('input', () => {
      if (manualInputs[name].value !== '' && !manualInputs[name].validity.badInput) {
        const value = Number(manualInputs[name].value);
        if (Number.isFinite(value)) inputs[name].value = String(Math.max(Number(inputs[name].min), Math.min(Number(inputs[name].max), value)));
      }
      scheduleRender();
    });
  }
  render();
}());
