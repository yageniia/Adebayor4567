/* Official Yandex JS API v3 backdrop. Flutter owns the camera, gestures and pins.
 * Both layers use spherical Web Mercator, 256 * 2^zoom logical pixels, no tilt.
 * Never run a second camera animation: it would detach the map from the pins.
 */
(() => {
  let apiPromise;
  let customizationPromise;
  function loadCustomization() {
    // Keep the designer's exported JSON intact. A relative URL also works when
    // the prototype is hosted under a GitHub Pages project path.
    customizationPromise ??= fetch(new URL(
      'map-styles/day-final.json?v=249b3fac8849', document.baseURI,
    )).then(async response => {
      if (!response.ok) throw new Error('Map style unavailable');
      const rules = await response.json();
      if (!Array.isArray(rules)) throw new Error('Invalid map style');
      return rules;
    });
    return customizationPromise;
  }

  function loadApi() {
    if (apiPromise) return apiPromise;
    apiPromise = (async () => {
      const key = window.pinLabMapConfig?.apiKey;
      if (!key) throw new Error('Missing map key');
      if (!window.ymaps3) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://api-maps.yandex.ru/v3/?apikey=' +
            encodeURIComponent(key) + '&lang=ru_RU';
          script.onload = resolve;
          script.onerror = () => reject(new Error('Map API unavailable'));
          document.head.append(script);
        });
      }
      await window.ymaps3.ready;
      const api = window.ymaps3;
      api.import.registerCdn('https://cdn.jsdelivr.net/npm/{package}',
        '@yandex/ymaps3-web-mercator-projection@0.0.5');
      const {WebMercator} = await api.import('@yandex/ymaps3-web-mercator-projection');
      return {api, WebMercator};
    })();
    return apiPromise;
  }

  const style = document.createElement('style');
  style.textContent = `
    .pinlab-yandex-map {width:100%;height:100%;pointer-events:none;}
    .pinlab-yandex-map a, .pinlab-yandex-map button,
    .pinlab-yandex-map [role="button"] {pointer-events:auto;}
    /* On a 393px viewport the SDK's distribution button overlaps its legal
       link. Keep both unmodified controls, arranged in two separate rows. */
    .pinlab-yandex-map .ymaps3--controls_bottom {bottom:24px;}
  `;
  document.head.append(style);

  window.pinLabYandex = {
    create(element, initialJSON, onStatus) {
      element.classList.add('pinlab-yandex-map');
      element.setAttribute('aria-label', 'Яндекс Карты');
      let latest = JSON.parse(initialJSON);
      let map;
      let disposed = false;
      let observer;
      let timeout;
      let status = 'loading';
      const report = next => {
        if (disposed || status === next) return;
        status = next;
        element.dataset.mapStatus = next;
        onStatus(next);
      };
      const mapProps = () => ({
        location: {center: [latest.lng, latest.lat], zoom: latest.zoom, duration: 0},
        camera: {
          azimuth: (((latest.rotation + 180) % 360 + 360) % 360 - 180) * Math.PI / 180,
          tilt: 0, duration: 0,
        },
        theme: latest.dark ? 'dark' : 'light',
      });
      // Keep the official attribution links interactive. The map itself passes
      // gestures to Flutter, where the pin hit targets and camera already live.
      const stopLinkGesture = event => {
        if (event.target.closest('a,button,[role="button"]')) event.stopPropagation();
      };
      element.addEventListener('pointerdown', stopLinkGesture);
      const readyForLayout = new Promise(resolve => {
        const check = () => {
          if (element.isConnected && element.clientWidth && element.clientHeight) {
            // Flutter's platform-view wrapper is also a DOM hit target. Without
            // this, blank map areas swallow drags even when the child is inert.
            const wrapper = element.closest('flt-platform-view');
            if (wrapper) wrapper.style.pointerEvents = 'none';
            observer?.disconnect();
            resolve();
          }
        };
        observer = new ResizeObserver(check);
        observer.observe(element);
        check();
      });
      timeout = setTimeout(() => report('error'), 20000);
      Promise.all([loadApi(), readyForLayout, loadCustomization()])
        .then(([{api, WebMercator}, , customization]) => {
        if (disposed || status === 'error') return;
        map = new api.YMap(element, {
          ...mapProps(), projection: new WebMercator(),
          mode: 'vector',
          behaviors: [], margin: [0, 0, 0, 0], zoomRounding: 'smooth',
          zoomRange: {min: 10, max: 22},
          // Keep the bottom corners free of the laboratory controls.
          copyrightsPosition: 'bottom right', distributionPosition: 'bottom left',
        });
        map.addChild(new api.YMapDefaultSchemeLayer({
          clampMapZoom: false, customization,
        }));
        map.addChild(new api.YMapDefaultFeaturesLayer());
        element.dataset.mapStyle = 'day-final';
        clearTimeout(timeout);
        report('ready');
      }).catch(() => {
        clearTimeout(timeout);
        // API URLs may contain the key: never print raw network errors.
        report('error');
      });
      return {
        update(json) {
          latest = JSON.parse(json);
          if (!disposed && map) map.update(mapProps());
        },
        dispose() {
          disposed = true;
          clearTimeout(timeout);
          observer?.disconnect();
          element.removeEventListener('pointerdown', stopLinkGesture);
          map?.destroy();
          map = null;
        },
      };
    },
  };
})();
