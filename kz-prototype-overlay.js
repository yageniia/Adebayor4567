(function () {
  const actions = [
    ['[data-order-settings-v2-close]', 'settings-close'],
    ['[data-discovery-close]', 'discovery-close'],
    ['[data-order-settings-v2-b-point]', 'b-point'],
    ['[data-order-settings-v2-destinations]', 'destinations'],
    ['[data-order-settings-v2-home]', 'home'],
    ['[data-order-settings-v2-regions]', 'regions'],
    ['[data-discovery-search]', 'search'],
    ['[data-address-search-back]', 'search-back'],
    ['[data-reposition-screen-back]', 'reposition-back'],
  ];

  const overrideCss = `
    html, body {
      width: 100% !important;
      height: 100% !important;
      min-width: 0 !important;
      min-height: 0 !important;
      margin: 0 !important;
      overflow: hidden !important;
      background: transparent !important;
    }
    .component-preview,
    .component-preview__canvas {
      width: 375px !important;
      height: 812px !important;
      min-width: 0 !important;
      min-height: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
      display: block !important;
      background: transparent !important;
    }
    .component-preview__title,
    .order-settings-v2-preview__version-control,
    [data-component-nav],
    [data-component-nav-scrim] {
      display: none !important;
    }
    .device-frame,
    .device-frame--iphone-375x812 {
      width: 375px !important;
      height: 812px !important;
      min-width: 375px !important;
      min-height: 812px !important;
      margin: 0 !important;
      border: 0 !important;
      border-radius: 0 !important;
      box-shadow: none !important;
      overflow: hidden !important;
      background: transparent !important;
    }
    .order-settings-flow,
    .main-screen {
      background: transparent !important;
    }
    .main-screen__map,
    .discovery-screen__map,
    .address-search__map,
    .reposition-screen__map,
    .arrival-route-screen__map,
    .arrival-route-screen__map-base {
      opacity: 0 !important;
      background: transparent !important;
      pointer-events: none !important;
    }
  `;

  function forceKz(doc) {
    const select = doc.querySelector('[data-order-settings-v2-version-control]');
    if (!select) return;
    select.value = 'kz-astana';
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function localizeMoscow(doc) {
    const replacements = new Map([
      ['150 ₸', '150 ₽'],
      ['+5000 ₸', '+5000 ₽'],
      ['ул. Сарайшык, 7/1', 'ул. Большая Дмитровка, 9'],
      ['MEGA Silk Way', 'Москва-Сити'],
      ['проспект Кабанбай батыра, 62', 'Пресненская наб., 8'],
      ['Ботанический сад', 'Парк Горького'],
      ['ул. Орынбор, 16', 'ул. Крымский Вал, 9'],
      ['Хан Шатыр', 'Белорусский вокзал'],
      ['проспект Туран, 37', 'пл. Тверская Застава, 7'],
      ['Назарбаев Университет', 'ВДНХ'],
      ['проспект Кабанбай батыра, 53', 'проспект Мира, 119'],
      ['Вокзал Нұрлы жол', 'Курский вокзал'],
      ['ул. Мухамеджана Тынышбаева, 8', 'ул. Земляной Вал, 29'],
      ['Аэропорт NQZ', 'Аэропорт Шереметьево'],
      ['проспект Кабанбай батыра, 119', 'Химки, аэропорт Шереметьево'],
      ['Байтерек', 'Красная площадь'],
      ['бульвар Нуржол, 14', 'Красная площадь, 1'],
      ['Abu Dhabi Plaza', 'Лужники'],
      ['ул. Сыганак, 60/5', 'ул. Лужники, 24'],
    ]);
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node) {
      const trimmed = node.data.trim();
      const replacement = replacements.get(trimmed);
      if (replacement) {
        const leading = node.data.match(/^\s*/)?.[0] || '';
        const trailing = node.data.match(/\s*$/)?.[0] || '';
        node.data = leading + replacement + trailing;
      }
      node = walker.nextNode();
    }
  }

  const sheetMetrics = new WeakMap();

  function sheetHeights(doc) {
    const sheet = doc.querySelector('[data-main-screen-sheet]');
    const scroll = sheet?.querySelector('.bottom-sheet__scroll');
    const stats = sheet?.querySelector('.main-screen__stats');
    const tabbar = doc.querySelector('.main-screen__tabbar');
    if (!sheet || !scroll || !stats) return null;
    const cached = sheetMetrics.get(sheet);
    if (cached) return cached;
    const style = getComputedStyle(scroll);
    const padding =
      (Number.parseFloat(style.paddingTop) || 0) +
      (Number.parseFloat(style.paddingBottom) || 0);
    const gap = Number.parseFloat(style.rowGap) || 0;
    const FrameHTMLElement = doc.defaultView?.HTMLElement;
    const children = [...scroll.children].filter(
      (child) =>
        (!FrameHTMLElement || child instanceof FrameHTMLElement) &&
        child.offsetParent !== null,
    );
    const content = children.reduce(
      (sum, child, index) =>
        sum + child.getBoundingClientRect().height + (index ? gap : 0),
      padding,
    );
    const tabs = tabbar?.getBoundingClientRect().height || 0;
    const metrics = {
      sheet,
      collapsed: Math.ceil(padding + stats.getBoundingClientRect().height + tabs),
      default: Math.ceil(
        Math.max(sheet.getBoundingClientRect().height, content + tabs),
      ),
    };
    sheetMetrics.set(sheet, metrics);
    return metrics;
  }

  function setSheetProgress(doc, progress, dragging) {
    const heights = sheetHeights(doc);
    if (!heights) return;
    const value = Math.max(0, Math.min(1, Number(progress) || 0));
    const height =
      heights.collapsed + (heights.default - heights.collapsed) * value;
    heights.sheet.dataset.bottomSheetSnap = value < 0.5 ? 'collapsed' : 'default';
    heights.sheet.toggleAttribute('data-bottom-sheet-dragging', !!dragging);
    heights.sheet.style.setProperty('--bottom-sheet-height', `${height}px`);
  }

  window.proKzOverlay = {
    create(element, onAction) {
      element.style.width = '100%';
      element.style.height = '100%';
      element.style.overflow = 'hidden';
      element.style.background = 'transparent';

      const iframe = document.createElement('iframe');
      iframe.src = 'kz-prototype.html?v=2';
      iframe.title = 'Интерфейс Яндекс Про — Казахстан';
      iframe.setAttribute('aria-label', iframe.title);
      iframe.style.cssText = [
        'display:block',
        'width:375px',
        'height:812px',
        'border:0',
        'margin:0',
        'background:transparent',
      ].join(';');
      element.append(iframe);

      let currentSheetProgress = 0;
      let currentSheetDragging = false;

      const report = (action) => {
        try { onAction(action); } catch (_) {}
      };

      iframe.addEventListener('load', () => {
        const doc = iframe.contentDocument;
        if (!doc) return;
        const style = doc.createElement('style');
        style.dataset.proExactOverrides = '';
        style.textContent = overrideCss;
        doc.head.append(style);
        forceKz(doc);
        localizeMoscow(doc);
        const localizer = new MutationObserver(() => localizeMoscow(doc));
        localizer.observe(doc.body, {
          childList: true,
          characterData: true,
          subtree: true,
        });
        setSheetProgress(
          doc,
          currentSheetProgress,
          currentSheetDragging,
        );
        iframe.contentWindow?.requestAnimationFrame(() => {
          iframe.contentWindow?.requestAnimationFrame(() => {
            setSheetProgress(
              doc,
              currentSheetProgress,
              currentSheetDragging,
            );
          });
        });
        doc.addEventListener('click', (event) => {
          // iframe nodes belong to the iframe's DOM realm, so checking them
          // against the parent window's Element always returns false.
          const FrameElement = doc.defaultView?.Element;
          const target =
            FrameElement && event.target instanceof FrameElement
              ? event.target
              : null;
          if (!target) return;
          for (const [selector, action] of actions) {
            if (target.closest(selector)) {
              if (action === 'home' || action === 'destinations') {
                event.preventDefault();
                event.stopImmediatePropagation();
              }
              report(action);
              return;
            }
          }
          const quick = target.closest('.discovery-screen__quick-action');
          if (quick) {
            const label = (quick.textContent || '').trim().toLowerCase();
            if (label.includes('есть топливо')) {
              report('category-available-fuel');
            } else if (label.includes('заправ')) report('category-fuel');
            else if (label.includes('мойк')) report('category-wash');
            else if (label.includes('заряд')) report('category-charge');
          }
          if (target.closest('[data-discovery-address]')) report('address');
        }, true);
        report('ready');
      });

      const controller = {
        setInteractive(interactive) {
          const value = interactive ? 'auto' : 'none';
          element.style.pointerEvents = value;
          iframe.style.pointerEvents = value;
        },
        click(selector) {
          iframe.contentDocument?.querySelector(selector)?.click();
        },
        setSheetProgress(progress, dragging) {
          currentSheetProgress = progress;
          currentSheetDragging = !!dragging;
          const doc = iframe.contentDocument;
          if (doc) {
            setSheetProgress(doc, currentSheetProgress, currentSheetDragging);
          }
        },
        dispose() {
          iframe.remove();
          element.replaceChildren();
        },
      };
      controller.setInteractive(false);
      return controller;
    },
  };
})();
