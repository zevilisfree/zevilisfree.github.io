(function () {
  'use strict';

  const macro = [
    { href: 'index.html', label: '景氣循環概覽' },
    { href: 'index1.html', label: '復甦期' },
    { href: 'index2.html', label: '成長期' },
    { href: 'index3.html', label: '榮景期' },
    { href: 'index4.html', label: '衰退期' },
    { href: 'index5.html', label: '關鍵指標' }
  ];
  const navItems = [
    { href: '../daytrade/', label: '台股當沖計算', module: 'daytrade', section: 'tool' },
    { href: '../dca/', label: '定期定額試算', module: 'dca', section: 'tool' },
    { href: '../macro/', label: '總經資料', module: 'macro', section: 'macro' }
  ];
  const slots = ['header-slot', 'footer-slot', 'scroll-top-slot'].map(id => document.getElementById(id));
  if (slots.some(slot => !slot)) throw new Error('共用版型缺少插入點');

  const pathParts = window.location.pathname.split('/');
  const currentPage = pathParts.at(-1) || 'index.html';
  const currentModule = pathParts.at(-2);
  const pageDescriptions = {
    'index.html': '先掌握景氣全貌，再用多組資料交叉閱讀四個階段。',
    'index1.html': '從活動止跌、裁員壓力與需求回溫，辨認復甦是否站穩。',
    'index2.html': '追蹤所得、消費、投資與生產力能否形成較廣的擴張。',
    'index3.html': '檢查需求、投資、通膨與信用條件是否出現不平衡。',
    'index4.html': '辨認收縮是否擴散，以及哪些資料開始支持觸底。',
    'index5.html': '跨階段對照活動、勞動、需求、價格與金融條件；此頁不是第五階段。'
  };

  function element(tag, className, value) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value !== undefined) node.textContent = value;
    return node;
  }

  const header = element('header', 'site-header');
  const brand = element('a', 'site-brand');
  brand.href = '../daytrade/';
  brand.setAttribute('aria-label', 'Z / INSIGHTS，前往台股當沖計算');
  if (currentModule === 'daytrade') brand.setAttribute('aria-current', 'page');
  brand.append(
    element('span', 'site-brand-mark', 'Z'),
    element('span', 'site-brand-name', 'Z / INSIGHTS')
  );
  header.append(brand);

  const toggle = element('button', 'site-menu-toggle', '選單');
  toggle.type = 'button';
  toggle.setAttribute('aria-controls', 'site-navigation');
  toggle.setAttribute('aria-expanded', 'false');
  header.append(toggle);

  const nav = element('nav', 'site-nav');
  nav.id = 'site-navigation';
  nav.setAttribute('aria-label', '主選單');

  const macroPages = macro.map(item => item.href);

  for (const item of navItems) {
    const isCurrentPage = item.module === currentModule && currentPage === 'index.html';
    const isCurrentSection = item.section === 'macro' && currentModule === 'macro' && macroPages.includes(currentPage);
    const classes = ['site-nav-link'];
    if (isCurrentPage) {
      classes.push('is-current');
      classes.push('is-current-page');
    } else if (isCurrentSection) {
      classes.push('is-current');
      classes.push('is-current-section');
    }
    const anchor = element('a', classes.join(' '), item.label);
    anchor.href = item.href;
    anchor.setAttribute('data-section', item.section);
    if (isCurrentPage) {
      anchor.setAttribute('aria-current', 'page');
    } else if (isCurrentSection) {
      anchor.setAttribute('data-section-active', 'true');
    }
    anchor.addEventListener('click', () => {
      nav.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
    });
    nav.append(anchor);
  }

  header.append(nav);
  slots[0].replaceWith(header);

  toggle.addEventListener('click', () => {
    const expanded = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(expanded));
    nav.classList.toggle('is-open', expanded);
  });
  header.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    nav.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    if (typeof toggle.focus === 'function') toggle.focus();
  });

  const pageHeader = document.querySelector('.topbar');
  if (pageHeader) {
    pageHeader.className += ' page-hero';
    const heading = pageHeader.querySelector('h1');
    if (heading) {
      const wrapper = heading.parentNode;
      wrapper.insertBefore(element('span', 'page-kicker', '總體經濟 / MACROECONOMICS'), heading);
      wrapper.append(element('p', 'page-description', pageDescriptions[currentPage] || '探索總體經濟資料。'));
    }
  }

  const sequence = macro.slice(0, 5);
  const stage = currentModule === 'macro' ? sequence.findIndex(page => page.href === currentPage) : -1;
  if (stage !== -1 || (currentModule === 'macro' && currentPage === 'index5.html')) {
    const content = document.querySelector('.container-fluid');
    if (!content) throw new Error('景氣頁面缺少內容容器');
    if (stage === -1) {
      const reference = element('aside', 'phase-reference');
      reference.append(
        element('span', 'phase-journey-label', '跨階段參照 / 關鍵指標'),
        element('p', '', '這些指標可搭配各個景氣階段閱讀，不屬於單一階段。')
      );
      const back = element('a', '', '← 返回景氣循環閱讀路徑');
      back.href = 'index.html';
      reference.append(back);
      content.prepend(reference);
    } else {
      const journey = element('nav', 'phase-journey');
      journey.setAttribute('aria-label', '景氣循環閱讀順序');
      const journeyHeading = element('div', 'phase-journey-heading');
      journeyHeading.append(element('p', 'phase-journey-label', '閱讀路徑 / 景氣循環'));
      const referenceLink = element('a', '', '參照關鍵指標 ↗');
      referenceLink.href = 'index5.html';
      journeyHeading.append(referenceLink);
      journey.append(journeyHeading);

      const steps = element('ol', 'phase-steps');
      sequence.forEach((page, index) => {
        const item = element('li', index === stage ? 'is-current' : '');
        const link = element('a', 'phase-step');
        link.href = page.href;
        if (index === stage) link.setAttribute('aria-current', 'page');
        link.append(
          element('span', 'phase-step-number', String(index).padStart(2, '0')),
          element('strong', '', page.label)
        );
        item.append(link);
        steps.append(item);
      });
      journey.append(steps);
      content.prepend(journey);

      const pager = element('nav', 'phase-pager');
      pager.setAttribute('aria-label', '繼續閱讀景氣循環');
      if (stage > 0) {
        const previous = element('a', 'phase-pager-link', `← 上一站 · ${sequence[stage - 1].label}`);
        previous.href = sequence[stage - 1].href;
        pager.append(previous);
      }
      const nextPage = sequence[stage + 1] || sequence[1];
      const next = element('a', 'phase-pager-link phase-pager-next', `${stage === sequence.length - 1 ? '下一輪' : '下一站'} · ${nextPage.label} →`);
      next.href = nextPage.href;
      pager.append(next);
      content.append(pager);
    }
  }

  const footer = element('footer', 'sticky-footer');
  const footerContainer = element('div', 'container my-auto');
  footerContainer.append(element('div', 'copyright text-center my-auto', `Z / INSIGHTS  ·  投資試算工具與總經資料  ·  © ${new Date().getFullYear()}`));
  footer.append(footerContainer);
  slots[1].replaceWith(footer);

  const topLink = element('a', 'scroll-to-top rounded', '↑');
  topLink.href = '#page-top';
  topLink.setAttribute('aria-label', '回到頁面頂端');
  slots[2].replaceWith(topLink);
}());
