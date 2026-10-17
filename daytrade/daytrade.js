(function () {
  'use strict';

  function tick(cents) {
    if (cents < 1000) return 1;
    if (cents < 5000) return 5;
    if (cents < 10000) return 10;
    if (cents < 50000) return 50;
    if (cents < 100000) return 100;
    return 500;
  }

  function calculateDayTrade(input) {
    const { entryPrice, lots, discount, minimumFee, direction, dayTrade } = input;
    const cents = Math.round(entryPrice * 100);
    if (!Number.isFinite(entryPrice) || entryPrice < .01 || entryPrice > 10000 || Math.abs(entryPrice * 100 - cents) > 1e-7 || cents % tick(cents) !== 0) {
      throw new RangeError('進場股價須為 0.01–10,000 元且符合股票升降單位');
    }
    if (!Number.isInteger(lots) || lots < 1 || lots > 1000) throw new RangeError('交易張數須為 1–1,000 的整數');
    if (!Number.isFinite(discount) || discount < 0 || discount > 10) throw new RangeError('券商折數須介於 0–10 折');
    if (!Number.isInteger(minimumFee) || minimumFee < 0 || minimumFee > 1000) throw new RangeError('每筆最低手續費須為 0–1,000 元整數');
    if (direction !== 'long' && direction !== 'short') throw new RangeError('請選擇做多或做空');
    if (typeof dayTrade !== 'boolean') throw new RangeError('請確認是否適用現股當沖稅率');

    const prices = [cents];
    let lower = cents, upper = cents;
    for (let i = 0; i < 10; i++) {
      lower -= tick(lower - 1);
      upper += tick(upper);
      if (lower >= 1) prices.unshift(lower);
      if (upper <= 1000000) prices.push(upper);
    }
    const shares = lots * 1000;
    const entryAmount = cents * shares / 100;
    const fee = amount => Math.max(minimumFee, Math.round(amount * .001425 * discount / 10));
    return prices.map(price => {
      const exitAmount = price * shares / 100;
      const buyAmount = direction === 'long' ? entryAmount : exitAmount;
      const sellAmount = direction === 'long' ? exitAmount : entryAmount;
      const fees = fee(buyAmount) + fee(sellAmount);
      const tax = Math.round(sellAmount * (dayTrade ? .0015 : .003));
      const profit = sellAmount - buyAmount - fees - tax;
      return { exitPrice: price / 100, profit, returnRate: profit / entryAmount * 100, fees, tax };
    });
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { calculateDayTrade };
  if (typeof document === 'undefined') return;

  const form = document.getElementById('trade-form');
  const results = document.getElementById('trade-results');
  const error = document.getElementById('trade-error');
  const rowsElement = document.getElementById('trade-rows');
  const toggleBtn = document.getElementById('trade-toggle-rows');
  const caption = document.getElementById('trade-caption') || (results && results.querySelector ? results.querySelector('caption') : null);
  const summary = document.getElementById('trade-summary');
  const money = new Intl.NumberFormat('zh-TW', { style: 'currency', currency: 'TWD', maximumFractionDigits: 0 });
  const priceFormat = new Intl.NumberFormat('zh-TW', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  let currentInput = null;
  let currentAllRows = null;
  let isExpanded = false;

  function renderTable() {
    if (!currentAllRows || !currentInput || !rowsElement) return;
    const entryIndex = currentAllRows.findIndex(row => row.exitPrice === currentInput.entryPrice);
    if (entryIndex === -1) return;

    const maxLower = entryIndex;
    const maxUpper = currentAllRows.length - 1 - entryIndex;
    const collapsedLower = Math.min(5, maxLower);
    const collapsedUpper = Math.min(5, maxUpper);

    const start = isExpanded ? 0 : entryIndex - collapsedLower;
    const end = isExpanded ? currentAllRows.length : entryIndex + collapsedUpper + 1;
    const visibleRows = currentAllRows.slice(start, end);

    const visibleLower = entryIndex - start;
    const visibleUpper = end - 1 - entryIndex;

    if (caption) {
      if (visibleLower === visibleUpper) {
        caption.textContent = `依股票合法升降單位列出進場價上下各 ${visibleLower} 檔`;
      } else {
        caption.textContent = `依股票合法升降單位列出進場價前 ${visibleLower} 檔、後 ${visibleUpper} 檔（最多各 ${isExpanded ? 10 : 5} 檔）`;
      }
    }

    if (toggleBtn) {
      const canExpand = maxLower > 5 || maxUpper > 5;
      toggleBtn.hidden = !canExpand;
      if (typeof toggleBtn.setAttribute === 'function') {
        toggleBtn.setAttribute('aria-expanded', String(isExpanded));
      }
      toggleBtn.textContent = isExpanded ? '收合為各 5 檔' : '展開前後各 10 檔';
    }

    const nearest = visibleRows.reduce((best, row) => Math.abs(row.profit) < Math.abs(best.profit) ? row : best);

    rowsElement.replaceChildren();
    for (const row of visibleRows) {
      const tr = document.createElement('tr');
      const classes = [];
      if (row.exitPrice === currentInput.entryPrice) classes.push('is-entry');
      if (row === nearest) classes.push('is-nearest');
      if (classes.length) tr.className = classes.join(' ');

      const values = [
        priceFormat.format(row.exitPrice),
        money.format(row.profit),
        `${row.returnRate.toFixed(2)}%`,
        money.format(row.fees),
        money.format(row.tax)
      ];
      values.forEach((value, index) => {
        const cell = document.createElement(index === 0 ? 'th' : 'td');
        if (index === 0) cell.scope = 'row';
        cell.textContent = value;
        if (index === 1) cell.className = row.profit < 0 ? 'is-loss' : 'is-gain';
        tr.appendChild(cell);
      });
      rowsElement.appendChild(tr);
    }
  }

  function executeCalculation() {
    if (!form || !results || !error) return;
    results.hidden = true;
    try {
      const fields = form.elements;
      for (const name of ['entryPrice', 'lots', 'discount', 'minimumFee']) {
        if (!fields[name] || String(fields[name].value).trim() === '' || fields[name].validity?.badInput) {
          throw new RangeError('請完整輸入有效數字');
        }
      }
      const input = {
        entryPrice: Number(fields.entryPrice.value),
        lots: Number(fields.lots.value),
        discount: Number(fields.discount.value),
        minimumFee: Number(fields.minimumFee.value),
        direction: fields.direction.value,
        dayTrade: Boolean(fields.dayTrade.checked)
      };
      const rows = calculateDayTrade(input);
      currentInput = input;
      currentAllRows = rows;
      isExpanded = false;
      renderTable();
      if (summary) {
        summary.textContent = `${input.direction === 'long' ? '做多' : '做空'} · ${input.lots} 張 · 進場 ${priceFormat.format(input.entryPrice)} 元 · 賣出稅率 ${input.dayTrade ? '0.15%' : '0.3%'}`;
      }
      error.hidden = true;
      results.hidden = false;
    } catch (cause) {
      currentInput = null;
      currentAllRows = null;
      if (rowsElement) rowsElement.replaceChildren();
      error.textContent = cause instanceof RangeError ? cause.message : '試算失敗，請重新整理頁面。';
      error.hidden = false;
      results.hidden = true;
    }
  }

  if (form) {
    form.addEventListener('input', executeCalculation);
    form.addEventListener('change', executeCalculation);
    form.addEventListener('submit', event => {
      if (event && typeof event.preventDefault === 'function') event.preventDefault();
      executeCalculation();
    });
    form.addEventListener('keydown', event => {
      if (event && event.key === 'Enter') {
        if (typeof event.preventDefault === 'function') event.preventDefault();
        executeCalculation();
      }
    });
  }

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      if (!currentAllRows) return;
      isExpanded = !isExpanded;
      renderTable();
    });
  }

  executeCalculation();
}());
