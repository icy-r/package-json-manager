(function () {
  const vscode = acquireVsCodeApi();
  let data = null;
  let activeTab = 'overview';
  let depFilter = 'all';
  let searchDebounce = null;
  let editingScript = null;
  let searchMode = 'local'; // 'local' = filter installed, 'npm' = search registry
  let npmResults = null;
  let localSearchTerm = '';

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
        npmResults = msg.results;
        renderNpmResults();
        break;
      case 'packageDetails':
        renderDetailPanel(msg.details);
        break;
      case 'error':
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
    const repoUrl = typeof data.repository === 'object' ? (data.repository?.url || '') : (data.repository || '');
    const bugsUrl = typeof data.bugs === 'object' ? (data.bugs?.url || '') : (data.bugs || '');
    const enginesNode = typeof data.engines === 'object' ? (data.engines?.node || '') : '';
    const enginesVscode = typeof data.engines === 'object' ? (data.engines?.vscode || '') : '';

    return `
      <div class="section-label">Identity</div>
      <div class="form-grid">
        ${field('name', 'Name', data.name)}
        ${field('version', 'Version', data.version)}
        ${field('displayName', 'Display Name', data.displayName)}
        ${field('publisher', 'Publisher', data.publisher)}
        <div class="form-group full-width">
          <label>Description</label>
          <textarea data-field="description" rows="2">${esc(data.description || '')}</textarea>
        </div>
      </div>

      <div class="section-label">People & Links</div>
      <div class="form-grid">
        ${field('author', 'Author', authorVal)}
        ${field('license', 'License', data.license)}
        ${field('homepage', 'Homepage', data.homepage)}
        <div class="form-group">
          <label>Repository URL</label>
          <input type="text" data-field="repository" data-complex="true" value="${attr(repoUrl)}">
        </div>
        <div class="form-group full-width">
          <label>Bug Tracker URL</label>
          <input type="text" data-field="bugs" data-complex="true" value="${attr(bugsUrl)}">
        </div>
      </div>

      <div class="section-label">Entry Points & Engines</div>
      <div class="form-grid">
        ${field('main', 'Main', data.main)}
        ${field('module', 'Module', data.module)}
        ${field('types', 'Types', data.types || data.typings)}
        ${field('browser', 'Browser', data.browser)}
        <div class="form-group">
          <label>Node Engine</label>
          <input type="text" data-field="engines.node" data-engine="true" value="${attr(enginesNode)}">
        </div>
        <div class="form-group">
          <label>VS Code Engine</label>
          <input type="text" data-field="engines.vscode" data-engine="true" value="${attr(enginesVscode)}">
        </div>
        ${field('packageManager', 'Package Manager', data.packageManager)}
        ${field('type', 'Module Type', data.type)}
      </div>

      <div class="section-label">Metadata</div>
      <div class="form-grid">
        <div class="form-group full-width">
          <label>Keywords</label>
          <div class="keywords-container" id="keywords-container">
            ${keywords.map(k => `<span class="keyword-tag">${esc(k)}<button class="remove-keyword" data-keyword="${attr(k)}">×</button></span>`).join('')}
            <input type="text" class="keywords-input" id="keyword-input" placeholder="${keywords.length ? '' : 'Type and press Enter to add...'}" />
          </div>
        </div>
        ${field('private', 'Private', data.private !== undefined ? String(data.private) : '')}
        ${field('sideEffects', 'Side Effects', data.sideEffects !== undefined ? String(data.sideEffects) : '')}
      </div>

      <div class="form-group full-width add-field-section">
        <details>
          <summary class="add-field-toggle">Add custom field</summary>
          <div class="add-field-form">
            <div class="form-group"><label>Field Name</label><input type="text" id="custom-field-name" placeholder="e.g. funding"></div>
            <div class="form-group"><label>Value</label><input type="text" id="custom-field-value" placeholder="Value"></div>
            <button class="btn btn-primary btn-sm" id="add-custom-field">Add Field</button>
          </div>
        </details>
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

    if (localSearchTerm && searchMode === 'local') {
      list = list.filter(d => d.name.toLowerCase().includes(localSearchTerm.toLowerCase()));
    }

    const total = deps.length + devDeps.length;

    const items = list.length === 0
      ? `<div class="empty-state"><div class="empty-icon">📦</div><div class="empty-text">${localSearchTerm ? 'No matching packages' : 'No dependencies found'}</div><div class="empty-hint">${localSearchTerm ? 'Try a different search or add from npm' : 'Switch to npm search to add packages'}</div></div>`
      : list.map(d => `
        <div class="dep-item">
          <span class="dep-name" data-name="${attr(d.name)}">${highlightMatch(d.name, localSearchTerm)}</span>
          <div class="dep-version"><input value="${attr(d.version)}" data-dep-name="${attr(d.name)}" data-dep-type="${d.type}"></div>
          <span class="dep-type-badge ${d.type}">${d.type === 'dep' ? 'prod' : 'dev'}</span>
          <div class="dep-actions">
            <button class="btn btn-ghost btn-sm btn-icon move-dep" data-name="${attr(d.name)}" data-to-dev="${d.type === 'dep'}" title="Move to ${d.type === 'dep' ? 'dev' : 'prod'}">↔</button>
            <button class="btn btn-danger btn-sm btn-icon remove-dep" data-name="${attr(d.name)}" title="Remove">×</button>
          </div>
        </div>`).join('');

    const isNpmMode = searchMode === 'npm';

    return `
      <div class="dep-search-bar">
        <div class="search-input-wrapper">
          <span class="search-icon">⌕</span>
          <input type="text" id="dep-search" placeholder="${isNpmMode ? 'Search npm registry...' : 'Filter installed packages...'}" autocomplete="off" value="${attr(isNpmMode ? '' : localSearchTerm)}">
          ${(localSearchTerm || isNpmMode) ? '<button class="search-clear" id="search-clear">×</button>' : ''}
        </div>
        <div class="search-mode-toggle">
          <button class="btn ${isNpmMode ? 'btn-secondary' : 'btn-primary'} btn-sm" id="mode-local" title="Filter installed packages">Installed</button>
          <button class="btn ${isNpmMode ? 'btn-primary' : 'btn-secondary'} btn-sm" id="mode-npm" title="Search npm registry">+ npm</button>
        </div>
      </div>
      ${isNpmMode ? '<div id="npm-results-container" class="npm-results-container"></div>' : ''}
      <div class="dep-toolbar">
        <select id="dep-filter">
          <option value="all" ${depFilter === 'all' ? 'selected' : ''}>All</option>
          <option value="regular" ${depFilter === 'regular' ? 'selected' : ''}>Production</option>
          <option value="dev" ${depFilter === 'dev' ? 'selected' : ''}>Development</option>
        </select>
        <span class="dep-count">${list.length}${localSearchTerm ? ` of ${total}` : ''} package${total !== 1 ? 's' : ''}</span>
      </div>
      <div class="dep-list">${items}</div>`;
  }

  function highlightMatch(text, term) {
    if (!term) { return esc(text); }
    const idx = text.toLowerCase().indexOf(term.toLowerCase());
    if (idx === -1) { return esc(text); }
    return esc(text.slice(0, idx)) + '<mark>' + esc(text.slice(idx, idx + term.length)) + '</mark>' + esc(text.slice(idx + term.length));
  }

  function renderNpmResults() {
    const container = document.getElementById('npm-results-container');
    if (!container) { return; }

    if (!npmResults) {
      container.innerHTML = '';
      return;
    }

    if (npmResults.length === 0) {
      container.innerHTML = '<div class="npm-results"><div class="empty-state" style="padding:16px"><div class="empty-text">No packages found</div></div></div>';
      return;
    }

    const existingDeps = new Set([
      ...Object.keys(data.dependencies || {}),
      ...Object.keys(data.devDependencies || {})
    ]);

    container.innerHTML = `
      <div class="npm-results">
        <div class="npm-results-header">
          <span>${npmResults.length} results</span>
          <button class="btn btn-ghost btn-sm" id="close-npm-results">Dismiss</button>
        </div>
        ${npmResults.map(r => {
          const isInstalled = existingDeps.has(r.name);
          return `
            <div class="npm-result-item ${isInstalled ? 'installed' : ''}">
              <div class="npm-result-info">
                <div class="npm-result-name">
                  ${esc(r.name)}
                  <span class="npm-result-version">${esc(r.version)}</span>
                  ${isInstalled ? '<span class="installed-badge">installed</span>' : ''}
                </div>
                <div class="npm-result-desc">${esc(r.description || '')}</div>
              </div>
              ${isInstalled ? '' : `
                <div class="npm-result-actions">
                  <button class="btn btn-primary btn-sm add-npm-dep" data-name="${attr(r.name)}" data-version="^${attr(r.version)}" data-dev="false">+ prod</button>
                  <button class="btn btn-secondary btn-sm add-npm-dep" data-name="${attr(r.name)}" data-version="^${attr(r.version)}" data-dev="true">+ dev</button>
                </div>
              `}
            </div>`;
        }).join('')}
      </div>`;

    container.querySelectorAll('.add-npm-dep').forEach(btn => {
      btn.addEventListener('click', () => {
        vscode.postMessage({ type: 'addDependency', name: btn.dataset.name, version: btn.dataset.version, isDev: btn.dataset.dev === 'true' });
        showToast(`Added ${btn.dataset.name}`, 'success');
      });
    });

    document.getElementById('close-npm-results')?.addEventListener('click', () => {
      npmResults = null;
      container.innerHTML = '';
    });
  }

  // ── Scripts Tab ──
  function renderScripts() {
    const scripts = Object.entries(data.scripts || {});

    const items = scripts.length === 0
      ? `<div class="empty-state"><div class="empty-icon">⚡</div><div class="empty-text">No scripts defined</div><div class="empty-hint">Add a script using the form above</div></div>`
      : scripts.map(([name, cmd]) => {
        const isEditing = editingScript === name;
        if (isEditing) {
          return `
            <div class="script-item script-editing">
              <span class="script-name">${esc(name)}</span>
              <input type="text" class="script-edit-input" id="edit-script-input" value="${attr(cmd)}" data-name="${attr(name)}">
              <div class="script-actions" style="opacity:1">
                <button class="btn btn-primary btn-sm save-script-edit" data-name="${attr(name)}">Save</button>
                <button class="btn btn-ghost btn-sm cancel-script-edit">Cancel</button>
              </div>
            </div>`;
        }
        return `
          <div class="script-item">
            <span class="script-name">${esc(name)}</span>
            <span class="script-command" title="${attr(cmd)}">${esc(cmd)}</span>
            <div class="script-actions">
              <button class="btn btn-primary btn-sm run-script" data-name="${attr(name)}" title="Run script">▶ Run</button>
              <button class="btn btn-ghost btn-sm btn-icon edit-script" data-name="${attr(name)}" title="Edit">✎</button>
              <button class="btn btn-danger btn-sm btn-icon delete-script" data-name="${attr(name)}" title="Delete">×</button>
            </div>
          </div>`;
      }).join('');

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
        const fieldName = input.dataset.field;
        const isComplex = input.dataset.complex === 'true';
        const isEngine = input.dataset.engine === 'true';

        if (isComplex) {
          if (fieldName === 'repository') {
            vscode.postMessage({ type: 'updateField', field: 'repository', value: { type: 'git', url: input.value } });
          } else if (fieldName === 'bugs') {
            vscode.postMessage({ type: 'updateField', field: 'bugs', value: { url: input.value } });
          }
        } else if (isEngine) {
          const engineKey = fieldName.split('.')[1];
          const engines = { ...(data.engines || {}), [engineKey]: input.value };
          if (!input.value) { delete engines[engineKey]; }
          vscode.postMessage({ type: 'updateField', field: 'engines', value: Object.keys(engines).length ? engines : undefined });
        } else if (fieldName === 'private' || fieldName === 'sideEffects') {
          const val = input.value.toLowerCase();
          if (val === 'true') { vscode.postMessage({ type: 'updateField', field: fieldName, value: true }); }
          else if (val === 'false') { vscode.postMessage({ type: 'updateField', field: fieldName, value: false }); }
          else if (val === '') { vscode.postMessage({ type: 'updateField', field: fieldName, value: undefined }); }
          else { vscode.postMessage({ type: 'updateField', field: fieldName, value: input.value }); }
        } else {
          vscode.postMessage({ type: 'updateField', field: fieldName, value: input.value || undefined });
        }
      });
    });

    // Custom field
    const addFieldBtn = document.getElementById('add-custom-field');
    if (addFieldBtn) {
      addFieldBtn.addEventListener('click', () => {
        const nameEl = document.getElementById('custom-field-name');
        const valueEl = document.getElementById('custom-field-value');
        if (nameEl.value.trim()) {
          vscode.postMessage({ type: 'updateField', field: nameEl.value.trim(), value: valueEl.value });
          showToast(`Added field: ${nameEl.value.trim()}`, 'success');
          nameEl.value = '';
          valueEl.value = '';
        }
      });
    }

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

    // Search mode toggle
    document.getElementById('mode-local')?.addEventListener('click', () => {
      searchMode = 'local';
      npmResults = null;
      render();
    });

    document.getElementById('mode-npm')?.addEventListener('click', () => {
      searchMode = 'npm';
      localSearchTerm = '';
      render();
      document.getElementById('dep-search')?.focus();
    });

    document.getElementById('search-clear')?.addEventListener('click', () => {
      localSearchTerm = '';
      npmResults = null;
      if (searchMode === 'npm') { searchMode = 'local'; }
      render();
    });

    // Dep search
    const depSearch = document.getElementById('dep-search');
    if (depSearch) {
      depSearch.addEventListener('input', () => {
        clearTimeout(searchDebounce);
        const q = depSearch.value.trim();

        if (searchMode === 'local') {
          localSearchTerm = q;
          render();
          const el = document.getElementById('dep-search');
          if (el) { el.focus(); el.setSelectionRange(q.length, q.length); }
        } else {
          if (!q || q.length < 2) { npmResults = null; renderNpmResults(); return; }
          searchDebounce = setTimeout(() => {
            const container = document.getElementById('npm-results-container');
            if (container) {
              container.innerHTML = '<div class="npm-results"><div class="search-loading"><div class="spinner"></div>Searching npm...</div></div>';
            }
            vscode.postMessage({ type: 'searchNpm', query: q });
          }, 400);
        }
      });

      depSearch.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
          depSearch.value = '';
          localSearchTerm = '';
          npmResults = null;
          if (searchMode === 'npm') { searchMode = 'local'; }
          render();
        }
      });
    }

    // Dep filter
    const filterEl = document.getElementById('dep-filter');
    if (filterEl) {
      filterEl.addEventListener('change', () => { depFilter = filterEl.value; render(); });
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
        editingScript = btn.dataset.name;
        render();
        const editInput = document.getElementById('edit-script-input');
        if (editInput) { editInput.focus(); editInput.setSelectionRange(editInput.value.length, editInput.value.length); }
      });
    });

    document.querySelectorAll('.save-script-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        const input = document.getElementById('edit-script-input');
        if (input && input.value.trim()) {
          vscode.postMessage({ type: 'editScript', name: btn.dataset.name, command: input.value.trim() });
        }
        editingScript = null;
      });
    });

    document.querySelectorAll('.cancel-script-edit').forEach(btn => {
      btn.addEventListener('click', () => { editingScript = null; render(); });
    });

    const editInput = document.getElementById('edit-script-input');
    if (editInput) {
      editInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          if (editInput.value.trim()) {
            vscode.postMessage({ type: 'editScript', name: editInput.dataset.name, command: editInput.value.trim() });
          }
          editingScript = null;
        }
        if (e.key === 'Escape') { editingScript = null; render(); }
      });
    }

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
