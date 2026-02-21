(function () {
  const vscode = acquireVsCodeApi();
  let data = null;
  let activeTab = 'overview';
  let depFilter = 'all';
  let searchDebounce = null;
  let isSearching = false;

  function init() {
    vscode.postMessage({ type: 'ready' });
  }

  window.addEventListener('message', event => {
    const msg = event.data;
    switch (msg.type) {
      case 'update':
        try {
          data = JSON.parse(msg.content);
          render();
        } catch {
          showToast('Invalid JSON in package.json', 'error');
        }
        break;
      case 'searchResults':
        isSearching = false;
        renderSearchResults(msg.results);
        break;
      case 'packageDetails':
        renderDetailPanel(msg.details);
        break;
      case 'error':
        isSearching = false;
        showToast(msg.message, 'error');
        break;
    }
  });

  function render() {
    if (!data) { return; }
    const depCount = Object.keys(data.dependencies || {}).length + Object.keys(data.devDependencies || {}).length;
    const scriptCount = Object.keys(data.scripts || {}).length;

    document.getElementById('root').innerHTML = `
      <div class="editor-header">
        <span class="pkg-name">${esc(data.name || 'Untitled')}</span>
        <span class="pkg-version">${esc(data.version || '0.0.0')}</span>
      </div>
      <div class="tabs">
        ${tab('overview', 'Overview')}
        ${tab('dependencies', 'Dependencies', depCount)}
        ${tab('scripts', 'Scripts', scriptCount)}
      </div>
      <div id="tab-overview" class="tab-content ${activeTab === 'overview' ? 'active' : ''}">${renderOverview()}</div>
      <div id="tab-dependencies" class="tab-content ${activeTab === 'dependencies' ? 'active' : ''}">${renderDependencies()}</div>
      <div id="tab-scripts" class="tab-content ${activeTab === 'scripts' ? 'active' : ''}">${renderScripts()}</div>
      <div id="detail-overlay" class="detail-overlay"></div>
      <div id="detail-panel" class="detail-panel"></div>
    `;
    bindAll();
  }

  function tab(id, label, count) {
    const cls = activeTab === id ? 'active' : '';
    const badge = count !== undefined ? `<span class="tab-count">${count}</span>` : '';
    return `<button class="tab ${cls}" data-tab="${id}">${label}${badge}</button>`;
  }

  // ── Overview Tab ──
  function renderOverview() {
    const authorVal = typeof data.author === 'object' ? (data.author?.name || '') : (data.author || '');
    const keywords = Array.isArray(data.keywords) ? data.keywords : [];

    return `
      <div class="form-grid">
        ${field('name', 'Name', data.name)}
        ${field('version', 'Version', data.version)}
        <div class="form-group full-width">
          <label>Description</label>
          <textarea data-field="description" rows="2">${esc(data.description || '')}</textarea>
        </div>
        ${field('author', 'Author', authorVal)}
        ${field('license', 'License', data.license)}
        ${field('homepage', 'Homepage', data.homepage)}
        ${field('main', 'Entry Point', data.main)}
        <div class="form-group full-width">
          <label>Keywords</label>
          <div class="keywords-container" id="keywords-container">
            ${keywords.map(k => `<span class="keyword-tag">${esc(k)}<button class="remove-keyword" data-keyword="${attr(k)}">×</button></span>`).join('')}
            <input type="text" class="keywords-input" id="keyword-input" placeholder="${keywords.length ? '' : 'Type and press Enter to add...'}" />
          </div>
        </div>
      </div>`;
  }

  function field(key, label, value) {
    return `<div class="form-group"><label>${label}</label><input type="text" data-field="${key}" value="${attr(value || '')}"></div>`;
  }

  // ── Dependencies Tab ──
  function renderDependencies() {
    const deps = Object.entries(data.dependencies || {}).map(([n, v]) => ({ name: n, version: v, type: 'dep' }));
    const devDeps = Object.entries(data.devDependencies || {}).map(([n, v]) => ({ name: n, version: v, type: 'dev' }));
    let list = depFilter === 'regular' ? deps : depFilter === 'dev' ? devDeps : [...deps, ...devDeps];
    list.sort((a, b) => a.name.localeCompare(b.name));

    const total = deps.length + devDeps.length;

    const items = list.length === 0
      ? `<div class="empty-state"><div class="empty-icon">📦</div><div class="empty-text">No dependencies found</div><div class="empty-hint">Search npm below to add packages</div></div>`
      : list.map(d => `
        <div class="dep-item">
          <span class="dep-name" data-name="${attr(d.name)}">${esc(d.name)}</span>
          <div class="dep-version"><input value="${attr(d.version)}" data-dep-name="${attr(d.name)}" data-dep-type="${d.type}"></div>
          <span class="dep-type-badge ${d.type}">${d.type === 'dep' ? 'prod' : 'dev'}</span>
          <div class="dep-actions">
            <button class="btn btn-ghost btn-sm btn-icon move-dep" data-name="${attr(d.name)}" data-to-dev="${d.type === 'dep'}" title="Move to ${d.type === 'dep' ? 'dev' : 'prod'}">↔</button>
            <button class="btn btn-danger btn-sm btn-icon remove-dep" data-name="${attr(d.name)}" title="Remove">×</button>
          </div>
        </div>`).join('');

    return `
      <div class="dep-toolbar">
        <select id="dep-filter">
          <option value="all" ${depFilter === 'all' ? 'selected' : ''}>All</option>
          <option value="regular" ${depFilter === 'regular' ? 'selected' : ''}>Production</option>
          <option value="dev" ${depFilter === 'dev' ? 'selected' : ''}>Development</option>
        </select>
        <span class="dep-count">${total} package${total !== 1 ? 's' : ''}</span>
      </div>
      <div class="dep-list">${items}</div>
      <div class="search-section">
        <h4>Add Package</h4>
        <div class="search-input-wrapper">
          <span class="search-icon">⌕</span>
          <input type="text" id="npm-search" placeholder="Search npm registry..." autocomplete="off">
        </div>
        <div id="search-results" class="search-results"></div>
      </div>`;
  }

  // ── Scripts Tab ──
  function renderScripts() {
    const scripts = Object.entries(data.scripts || {});

    const items = scripts.length === 0
      ? `<div class="empty-state"><div class="empty-icon">⚡</div><div class="empty-text">No scripts defined</div><div class="empty-hint">Add a script using the form above</div></div>`
      : scripts.map(([name, cmd]) => `
        <div class="script-item">
          <span class="script-name">${esc(name)}</span>
          <span class="script-command" title="${attr(cmd)}">${esc(cmd)}</span>
          <div class="script-actions">
            <button class="btn btn-primary btn-sm run-script" data-name="${attr(name)}" title="Run script">▶ Run</button>
            <button class="btn btn-ghost btn-sm btn-icon edit-script" data-name="${attr(name)}" data-command="${attr(cmd)}" title="Edit">✎</button>
            <button class="btn btn-danger btn-sm btn-icon delete-script" data-name="${attr(name)}" title="Delete">×</button>
          </div>
        </div>`).join('');

    return `
      <div class="script-add-form">
        <div class="form-group">
          <label>Script Name</label>
          <input type="text" id="new-script-name" placeholder="e.g. build">
        </div>
        <div class="form-group">
          <label>Command</label>
          <input type="text" id="new-script-cmd" placeholder="e.g. tsc && webpack">
        </div>
        <button class="btn btn-primary" id="add-script-btn">Add</button>
      </div>
      <div class="script-list">${items}</div>`;
  }

  // ── Search Results ──
  function renderSearchResults(results) {
    const container = document.getElementById('search-results');
    if (!container) { return; }

    if (!results || results.length === 0) {
      container.innerHTML = '<div class="empty-state" style="padding:16px"><div class="empty-text">No packages found</div></div>';
      return;
    }

    container.innerHTML = results.map(r => `
      <div class="search-result-item">
        <div class="search-result-info">
          <div class="name">${esc(r.name)} <span class="version">${esc(r.version)}</span></div>
          <div class="desc">${esc(r.description || '')}</div>
        </div>
        <div class="search-result-actions">
          <button class="btn btn-primary btn-sm add-dep" data-name="${attr(r.name)}" data-version="^${attr(r.version)}" data-dev="false">+ prod</button>
          <button class="btn btn-secondary btn-sm add-dep" data-name="${attr(r.name)}" data-version="^${attr(r.version)}" data-dev="true">+ dev</button>
        </div>
      </div>`).join('');

    container.querySelectorAll('.add-dep').forEach(btn => {
      btn.addEventListener('click', () => {
        vscode.postMessage({ type: 'addDependency', name: btn.dataset.name, version: btn.dataset.version, isDev: btn.dataset.dev === 'true' });
        showToast(`Added ${btn.dataset.name}`, 'success');
      });
    });
  }

  // ── Detail Panel ──
  function renderDetailPanel(details) {
    const panel = document.getElementById('detail-panel');
    const overlay = document.getElementById('detail-overlay');
    if (!panel || !overlay) { return; }

    const depCount = Object.keys(details.dependencies || {}).length;
    const devDepCount = Object.keys(details.devDependencies || {}).length;
    const authorStr = typeof details.author === 'object' ? details.author?.name || 'Unknown' : (details.author || 'Unknown');

    panel.innerHTML = `
      <div class="detail-header">
        <h3>${esc(details.name)}</h3>
        <button class="detail-close" id="close-detail">×</button>
      </div>
      <div class="detail-section"><div class="detail-label">Version</div><div class="detail-value" style="font-family:var(--mono-font)">${esc(details.version)}</div></div>
      <div class="detail-section"><div class="detail-label">Description</div><div class="detail-value">${esc(details.description || 'No description')}</div></div>
      <div class="detail-section"><div class="detail-label">Author</div><div class="detail-value">${esc(authorStr)}</div></div>
      <div class="detail-section"><div class="detail-label">License</div><div class="detail-value">${esc(details.license || 'Not specified')}</div></div>
      ${details.homepage ? `<div class="detail-section"><div class="detail-label">Homepage</div><div class="detail-value"><a href="${attr(details.homepage)}">${esc(details.homepage)}</a></div></div>` : ''}
      ${details.repository?.url ? `<div class="detail-section"><div class="detail-label">Repository</div><div class="detail-value"><a href="${attr(cleanRepoUrl(details.repository.url))}">${esc(cleanRepoUrl(details.repository.url))}</a></div></div>` : ''}
      <div class="detail-section">
        <div class="detail-label">Dependencies</div>
        <div class="detail-value">
          <span class="detail-deps-count">${depCount} prod</span>
          <span class="detail-deps-count">${devDepCount} dev</span>
        </div>
      </div>
      <div class="detail-section"><div class="detail-label">Source</div><div class="detail-value"><span class="detail-source ${details.source}">${details.source}</span></div></div>
    `;

    panel.classList.add('open');
    overlay.classList.add('open');

    const close = () => { panel.classList.remove('open'); overlay.classList.remove('open'); };
    document.getElementById('close-detail').addEventListener('click', close);
    overlay.addEventListener('click', close);
  }

  function cleanRepoUrl(url) {
    return (url || '').replace(/^git\+/, '').replace(/\.git$/, '');
  }

  // ── Event Binding ──
  function bindAll() {
    // Tabs
    document.querySelectorAll('.tab').forEach(t => {
      t.addEventListener('click', () => { activeTab = t.dataset.tab; render(); });
    });

    // Overview fields
    document.querySelectorAll('[data-field]').forEach(input => {
      if (input.classList.contains('keywords-input')) { return; }
      input.addEventListener('change', () => {
        vscode.postMessage({ type: 'updateField', field: input.dataset.field, value: input.value });
      });
    });

    // Keywords
    const kwInput = document.getElementById('keyword-input');
    if (kwInput) {
      kwInput.addEventListener('keydown', e => {
        if (e.key === 'Enter' && kwInput.value.trim()) {
          e.preventDefault();
          const kw = kwInput.value.trim();
          const current = Array.isArray(data.keywords) ? [...data.keywords] : [];
          if (!current.includes(kw)) {
            current.push(kw);
            vscode.postMessage({ type: 'updateField', field: 'keywords', value: current });
          }
          kwInput.value = '';
        }
        if (e.key === 'Backspace' && !kwInput.value) {
          const current = Array.isArray(data.keywords) ? [...data.keywords] : [];
          if (current.length) {
            current.pop();
            vscode.postMessage({ type: 'updateField', field: 'keywords', value: current });
          }
        }
      });
    }

    document.querySelectorAll('.remove-keyword').forEach(btn => {
      btn.addEventListener('click', () => {
        const kw = btn.dataset.keyword;
        const current = (data.keywords || []).filter(k => k !== kw);
        vscode.postMessage({ type: 'updateField', field: 'keywords', value: current });
      });
    });

    const kwContainer = document.getElementById('keywords-container');
    if (kwContainer) {
      kwContainer.addEventListener('click', () => kwInput?.focus());
    }

    // Dep filter
    const filterEl = document.getElementById('dep-filter');
    if (filterEl) {
      filterEl.addEventListener('change', () => { depFilter = filterEl.value; render(); });
    }

    // npm search
    const searchEl = document.getElementById('npm-search');
    if (searchEl) {
      searchEl.addEventListener('input', () => {
        clearTimeout(searchDebounce);
        const q = searchEl.value.trim();
        if (!q) { document.getElementById('search-results').innerHTML = ''; return; }
        searchDebounce = setTimeout(() => {
          isSearching = true;
          document.getElementById('search-results').innerHTML = '<div class="search-loading"><div class="spinner"></div>Searching...</div>';
          vscode.postMessage({ type: 'searchNpm', query: q });
        }, 350);
      });
    }

    // Dep actions
    document.querySelectorAll('.remove-dep').forEach(btn => {
      btn.addEventListener('click', () => vscode.postMessage({ type: 'removeDependency', name: btn.dataset.name }));
    });

    document.querySelectorAll('.move-dep').forEach(btn => {
      btn.addEventListener('click', () => vscode.postMessage({ type: 'moveDependency', name: btn.dataset.name, toDev: btn.dataset.toDev === 'true' }));
    });

    document.querySelectorAll('.dep-version input').forEach(input => {
      input.addEventListener('change', () => {
        const isDev = input.dataset.depType === 'dev';
        vscode.postMessage({ type: 'addDependency', name: input.dataset.depName, version: input.value, isDev });
      });
    });

    document.querySelectorAll('.dep-name').forEach(el => {
      el.addEventListener('click', () => vscode.postMessage({ type: 'getPackageDetails', name: el.dataset.name }));
    });

    // Script actions
    document.querySelectorAll('.run-script').forEach(btn => {
      btn.addEventListener('click', () => {
        vscode.postMessage({ type: 'runScript', name: btn.dataset.name });
        showToast(`Running: npm run ${btn.dataset.name}`, 'success');
      });
    });

    document.querySelectorAll('.delete-script').forEach(btn => {
      btn.addEventListener('click', () => vscode.postMessage({ type: 'removeScript', name: btn.dataset.name }));
    });

    document.querySelectorAll('.edit-script').forEach(btn => {
      btn.addEventListener('click', () => {
        const newCmd = prompt('Edit command:', btn.dataset.command);
        if (newCmd !== null && newCmd !== btn.dataset.command) {
          vscode.postMessage({ type: 'editScript', name: btn.dataset.name, command: newCmd });
        }
      });
    });

    const addBtn = document.getElementById('add-script-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        const nameEl = document.getElementById('new-script-name');
        const cmdEl = document.getElementById('new-script-cmd');
        if (nameEl.value.trim() && cmdEl.value.trim()) {
          vscode.postMessage({ type: 'addScript', name: nameEl.value.trim(), command: cmdEl.value.trim() });
          nameEl.value = '';
          cmdEl.value = '';
        }
      });
    }

    // Add dep from search
    document.querySelectorAll('.add-dep').forEach(btn => {
      btn.addEventListener('click', () => {
        vscode.postMessage({ type: 'addDependency', name: btn.dataset.name, version: btn.dataset.version, isDev: btn.dataset.dev === 'true' });
        showToast(`Added ${btn.dataset.name}`, 'success');
      });
    });
  }

  // ── Toast Notifications ──
  function showToast(message, type) {
    const existing = document.querySelectorAll('.toast');
    existing.forEach(t => t.remove());
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
  }

  // ── Helpers ──
  function esc(str) {
    if (typeof str !== 'string') { return ''; }
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function attr(str) {
    if (typeof str !== 'string') { return ''; }
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  init();
})();
