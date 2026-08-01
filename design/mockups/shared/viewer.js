/**
 * Manifest-driven mockup viewer shell.
 * Shared by mobile and web HTML mockups.
 * Prefer window.__MOCKUP_MANIFEST__ (from mockup-manifest.js via <script>) —
 * that works from file:// and HTTP. Optional fetch fallback for legacy JSON.
 */
(function (global) {
  'use strict';

  async function loadManifest(url) {
    if (global.__MOCKUP_MANIFEST__ && typeof global.__MOCKUP_MANIFEST__ === 'object') {
      return global.__MOCKUP_MANIFEST__;
    }

    const embedded = typeof document !== 'undefined' && document.getElementById('mockup-manifest');
    if (embedded?.textContent?.trim()) {
      return JSON.parse(embedded.textContent);
    }

    const href = url ?? './mockup-manifest.json';
    let response;
    try {
      response = await fetch(href, { cache: 'no-store' });
    } catch (err) {
      const hint =
        'Load mockup-manifest.js with a <script> tag before boot ' +
        '(works from file://), or open over HTTP.\n' +
        '  <script src="./mockup-manifest.js"></script>\n' +
        '  cd design/mockups && python3 -m http.server 8765';
      throw new Error(`Could not load manifest (no __MOCKUP_MANIFEST__, fetch ${href} failed). ${hint}`, {
        cause: err,
      });
    }
    if (!response.ok) {
      throw new Error(`Could not load ${href} (${response.status} ${response.statusText})`);
    }
    return response.json();
  }

  function screensById(manifest) {
    return Object.fromEntries((manifest.screens ?? []).map((screen) => [screen.screen_id, screen]));
  }

  function buildDomMap(manifest) {
    const map = {};
    for (const screen of manifest.screens ?? []) {
      map[screen.screen_id] = screen.dom_id ?? `s-${screen.screen_id}`;
    }
    return map;
  }

  function initialStateId(screen) {
    const states = Array.isArray(screen?.states) ? screen.states : [];
    if (states.length === 0) return null;
    return (states.find((state) => state.initial) ?? states[0]).state_id;
  }

  function resolveStateId(screen, requestedStateId) {
    const states = Array.isArray(screen?.states) ? screen.states : [];
    if (states.length === 0) return null;
    return states.some((state) => state.state_id === requestedStateId)
      ? requestedStateId
      : initialStateId(screen);
  }

  function getTargetFromUrl(manifest, domMap) {
    const byId = screensById(manifest);
    const fallback = manifest.default_screen;
    if (typeof location === 'undefined') {
      return { screenId: fallback, stateId: resolveStateId(byId[fallback], null) };
    }

    const raw = (location.hash || '').replace(/^#/, '').trim();
    const query = new URLSearchParams(raw);
    let screenId = query.get('screen');
    if (!screenId && raw && !raw.includes('=') && domMap[raw]) screenId = raw;
    if (!screenId || !domMap[screenId]) screenId = fallback;

    return {
      screenId,
      stateId: resolveStateId(byId[screenId], query.get('state')),
    };
  }

  function flattenNavItems(items, depth, parentScreenId, out) {
    for (const item of items ?? []) {
      const hasScreen = Boolean(item.screen_id);
      if (hasScreen) out.push({ item, depth, parentScreenId });
      if (item.items?.length) {
        flattenNavItems(
          item.items,
          hasScreen ? depth + 1 : depth,
          hasScreen ? item.screen_id : parentScreenId,
          out,
        );
      }
    }
  }

  function appendNavLabel(button, label) {
    const dot = document.createElement('span');
    dot.className = 'sel-dot';
    button.appendChild(dot);
    button.appendChild(document.createTextNode(label ?? ''));
  }

  function buildNav(manifest, navRoot, onNavigate, navHandlers) {
    if (!navRoot) return;
    navRoot.replaceChildren();

    for (const section of manifest.navigation ?? []) {
      const block = document.createElement('div');
      block.className = 'sel-section';
      const title = document.createElement('div');
      title.className = 'sel-section-title';
      title.textContent = section.label ?? '';
      block.appendChild(title);

      const flat = [];
      flattenNavItems(section.items, 0, null, flat);
      const group = document.createElement('div');
      group.className = 'sel-group';

      for (const { item, depth, parentScreenId } of flat) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className =
          depth === 0
            ? 'sel-btn nav-btn'
            : `step-btn nav-btn depth-${Math.min(depth, 5)}`;
        button.dataset.screen = item.screen_id;
        button.dataset.navScreen = item.screen_id;
        if (parentScreenId) button.dataset.navParent = parentScreenId;
        appendNavLabel(button, item.label);
        button.addEventListener('click', () => {
          const handler = navHandlers?.[item.screen_id];
          if (handler) handler();
          else onNavigate(item.screen_id);
        });
        group.appendChild(button);
      }

      if (group.childElementCount) block.appendChild(group);
      navRoot.appendChild(block);
    }
  }

  let onStateChangeGlobal = function () {};

  function renderStates(manifest, screenId, activeStateId) {
    const screen = screensById(manifest)[screenId];
    const list = document.getElementById('state-list');
    const titleEl = document.getElementById('state-group-title');
    const empty = document.getElementById('state-empty');
    const panel = document.getElementById('state-panel');
    if (!list || !empty) return;

    list.replaceChildren();
    const states = Array.isArray(screen?.states) ? screen.states : [];
    const hasStates = states.length > 1;

    if (titleEl) {
      titleEl.textContent = hasStates ? (screen.state_label ?? screen.title ?? '') : '';
      titleEl.hidden = !hasStates;
    }
    empty.hidden = hasStates;
    if (panel) panel.hidden = false;
    if (!hasStates) return;

    for (const state of states) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'sel-btn state-btn';
      button.dataset.screen = screenId;
      button.dataset.state = state.state_id;
      if (state.state_id === activeStateId) button.classList.add('active');
      appendNavLabel(button, state.label);
      button.addEventListener('click', () => onStateChangeGlobal(screenId, state.state_id));
      list.appendChild(button);
    }
  }

  function updateNavHighlight(screenId, byId) {
    const screen = byId[screenId];
    const navAnchor = screen?.nav_screen ?? screenId;

    document.querySelectorAll('.nav-btn').forEach((button) => {
      const id = button.dataset.navScreen;
      button.classList.toggle('active', id === screenId);
      button.classList.toggle('parent-active', false);
    });

    const activeButton =
      document.querySelector(`.nav-btn[data-nav-screen="${screenId}"]`) ??
      document.querySelector(`.nav-btn[data-nav-screen="${navAnchor}"]`);
    if (activeButton) activeButton.classList.add('active');

    let parentId = activeButton?.dataset.navParent;
    while (parentId) {
      document
        .querySelector(`.nav-btn[data-nav-screen="${parentId}"]`)
        ?.classList.add('parent-active');
      const parentButton = document.querySelector(`.nav-btn[data-nav-screen="${parentId}"]`);
      parentId = parentButton?.dataset.navParent;
    }
  }

  function updatePanels(manifest, screenId, stateId) {
    const byId = screensById(manifest);
    updateNavHighlight(screenId, byId);
    renderStates(manifest, screenId, resolveStateId(byId[screenId], stateId));
  }

  function updateMeta(manifest, screenId, stateId, options) {
    const screen = screensById(manifest)[screenId];
    if (!screen) return;
    const resolvedStateId = resolveStateId(screen, stateId);
    const state = screen.states?.find((entry) => entry.state_id === resolvedStateId);

    const set = (id, value) => {
      const element = document.getElementById(id);
      if (element) element.textContent = value ?? '—';
    };

    set('meta-title', state?.title ?? screen.title);
    set('meta-id', screen.screen_id);
    set('meta-state', resolvedStateId);
    set('meta-route', screen.route);
    set('meta-kind', screen.kind ?? 'html');
    set(
      'meta-synced',
      manifest.synced_at ? new Date(manifest.synced_at).toLocaleString('es-CL') : '—',
    );

    if (options?.urlElId && screen.url) set(options.urlElId, screen.url);
    if (options?.frameLabelId) {
      const stateSuffix = resolvedStateId ? ` · ${resolvedStateId}` : '';
      set(options.frameLabelId, `${screen.screen_id}${stateSuffix} · ${screen.route}`);
    }
  }

  function init(manifest, options) {
    const domMap = buildDomMap(manifest);
    const byId = screensById(manifest);
    const onNavigate = options.onNavigate;
    if (typeof onNavigate !== 'function') {
      throw new Error('MockupViewer.init: options.onNavigate must be a function');
    }
    onStateChangeGlobal = options.onStateChange ?? ((screenId, stateId) => onNavigate(screenId, stateId));
    buildNav(manifest, options.navRoot, onNavigate, options.navHandlers ?? {});

    return {
      manifest,
      domMap,
      defaultScreen: manifest.default_screen,
      getTargetFromUrl: () => getTargetFromUrl(manifest, domMap),
      getScreenIdFromUrl: () => getTargetFromUrl(manifest, domMap).screenId,
      initialStateForScreen: (screenId) => initialStateId(byId[screenId]),
      resolveStateForScreen: (screenId, stateId) => resolveStateId(byId[screenId], stateId),
      updatePanels: (screenId, stateId) => updatePanels(manifest, screenId, stateId),
      updateMeta: (screenId, stateId) => updateMeta(manifest, screenId, stateId, options.meta ?? {}),
    };
  }

  global.MockupViewer = {
    loadManifest,
    init,
    buildDomMap,
    getTargetFromUrl,
    updatePanels,
    updateMeta,
    buildNav,
  };
})(typeof window !== 'undefined' ? window : globalThis);
