(function () {
  const vscode = acquireVsCodeApi();
  let currentData = null;
  let currentTab = 'overview';
  let depFilter = 'all';
  let searchTimeout = null;

  function init() {
    vscode.postMessage({ type: 'ready' });
  }

  window.addEventListener('message', event => {
    const msg = event.data;
    switch (msg.type) {
      case 'update':
        try {
          currentData = JSON.parse(msg.content);
          render();
        } catch {
          showError('Invalid JSON in package.json');
        }
        break;
      case 'searchResults':
        renderSearchResults(msg.results);
        break;
      case 'packageDetails':
        renderDetailPanel(msg.details);
        break;
      case 'error':
        showError(msg.message);
        break;
    }
  });

  function render() {
    if (!currentData) { return; }
    const root = document.getElementById('root');
    root.innerHTML = `
      <div class="tabs">
        <button class="tab ${currentTab === 'overview' ? 'active' : ''}" data-tab="overview">Overview</button>
        <button class="tab ${currentTab === 'dependencies' ? 'active' : ''}" data-tab="dependencies">Dependencies</button>
        <button class="tab ${currentTab === 'scripts' ? 'active' : ''}" data-tab="scripts">Scripts</button>
      </div>
      <div id="tab-overview" class="tab-content ${currentTab === 'overview' ? 'active' : ''}">${renderOverview()}</div>
      <div id="tab-dependencies" class="tab-content ${currentTab === 'dependencies' ? 'active' : ''}">${renderDependencies()}</div>
      <div id="tab-scripts" class="tab-content ${currentTab === 'scripts' ? 'active' : ''}">${renderScripts()}</div>
      <div id="detail-panel" class="detail-panel"></div>
    `;
    bindEvents();
  }

  function renderOverview() {
    const fields = [
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'version', label: 'Version', type: 'text' },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'author', label: 'Author', type: 'text' },
      { key: 'license', label: 'License', type: 'text' },
      { key: 'homepage', label: 'Homepage', type: 'text' },
      { key: 'main', label: 'Main', type: 'text' },
      { key: 'keywords', label: 'Keywords (comma-separated)', type: 'text' }
    ];

    return fields.map(f => {
      let val = currentData[f.key] ?? '';
      if (f.key === 'keywords' && Array.isArray(val)) { val = val.join(', '); }
      if (f.key === 'author' && typeof val === 'object') { val = val.name || ''; }
      const input = f.type === 'textarea'
        ? `<textarea data-field="${f.key}">${escapeHtml(val)}</textarea>`
        : `<input type="text" data-field="${f.key}" value="${escapeAttr(val)}">`;
      return `<div class="form-group"><label>${f.label}</label>${input}</div>`;
    }).join('');
  }

  function renderDependencies() {
    const deps = Object.entries(currentData.dependencies || {}).map(([n, v]) => ({ name: n, version: v, type: 'dep' }));
    const devDeps = Object.entries(currentData.devDependencies || {}).map(([n, v]) => ({ name: n, version: v, type: 'devDep' }));
    let allDeps = [...deps, ...devDeps];

    if (depFilter === 'regular') { allDeps = deps; }
    else if (depFilter === 'dev') { allDeps = devDeps; }

    const rows = allDeps.length === 0
      ? '<tr><td colspan="4" class="empty-state">No dependencies found</td></tr>'
      : allDeps.map(d => `
        <tr>
          <td><span class="dep-name" data-name="${escapeAttr(d.name)}">${escapeHtml(d.name)}</span></td>
          <td><input class="version-input" data-name="${escapeAttr(d.name)}" value="${escapeAttr(d.version)}" style="width:120px;padding:2px 4px;background:var(--input-bg);color:var(--input-fg);border:1px solid var(--input-border);"></td>
          <td><span class="badge">${d.type === 'dep' ? 'dep' : 'dev'}</span></td>
          <td>
            <button class="btn btn-small btn-secondary move-dep" data-name="${escapeAttr(d.name)}" data-to-dev="${d.type === 'dep' ? 'true' : 'false'}">${d.type === 'dep' ? '→ dev' : '→ dep'}</button>
            <button class="btn btn-small btn-danger remove-dep" data-name="${escapeAttr(d.name)}">Remove</button>
          </td>
        </tr>`).join('');

    return `
      <div class="dep-filter">
        <select id="dep-type-filter">
          <option value="all" ${depFilter === 'all' ? 'selected' : ''}>All</option>
          <option value="regular" ${depFilter === 'regular' ? 'selected' : ''}>Dependencies</option>
          <option value="dev" ${depFilter === 'dev' ? 'selected' : ''}>Dev Dependencies</option>
        </select>
      </div>
      <table class="dep-table">
        <thead><tr><th>Package</th><th>Version</th><th>Type</th><th>Actions</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="search-section">
        <h4>Add Dependency</h4>
        <input type="text" id="npm-search" placeholder="Search npm packages...">
        <div id="search-results" class="search-results"></div>
      </div>`;
  }

  function renderScripts() {
    const scripts = Object.entries(currentData.scripts || {});
    const items = scripts.length === 0
      ? '<div class="empty-state">No scripts defined</div>'
      : scripts.map(([name, cmd]) => `
        <div class="script-item">
          <span class="script-name">${escapeHtml(name)}</span>
          <span class="script-command">${escapeHtml(cmd)}</span>
          <div class="script-actions">
            <button class="btn btn-small btn-primary run-script" data-name="${escapeAttr(name)}">Run</button>
            <button class="btn btn-small btn-secondary edit-script" data-name="${escapeAttr(name)}" data-command="${escapeAttr(cmd)}">Edit</button>
            <button class="btn btn-small btn-danger delete-script" data-name="${escapeAttr(name)}">Delete</button>
          </div>
        </div>`).join('');

    return `
      <div class="add-form" id="add-script-form">
        <div class="form-group"><label>Name</label><input type="text" id="new-script-name" placeholder="script-name"></div>
        <div class="form-group"><label>Command</label><input type="text" id="new-script-cmd" placeholder="echo hello"></div>
        <button class="btn btn-primary" id="add-script-btn">Add Script</button>
      </div>
      ${items}`;
  }

  function renderSearchResults(results) {
    const container = document.getElementById('search-results');
    if (!container) { return; }
    if (results.length === 0) {
      container.innerHTML = '<div class="empty-state">No packages found</div>';
      return;
    }
    container.innerHTML = results.map(r => `
      <div class="search-result-item">
        <div class="search-result-info">
          <div class="name">${escapeHtml(r.name)} <span class="badge">${escapeHtml(r.version)}</span></div>
          <div class="desc">${escapeHtml(r.description || '')}</div>
        </div>
        <div class="search-result-actions">
          <button class="btn btn-small btn-primary add-dep" data-name="${escapeAttr(r.name)}" data-version="^${escapeAttr(r.version)}" data-dev="false">+ dep</button>
          <button class="btn btn-small btn-secondary add-dep" data-name="${escapeAttr(r.name)}" data-version="^${escapeAttr(r.version)}" data-dev="true">+ dev</button>
        </div>
      </div>`).join('');
    bindSearchResultEvents();
  }

  function renderDetailPanel(details) {
    const panel = document.getElementById('detail-panel');
    if (!panel) { return; }
    const depCount = Object.keys(details.dependencies || {}).length;
    panel.innerHTML = `
      <button class="close-btn" id="close-detail">×</button>
      <h3>${escapeHtml(details.name)}</h3>
      <div class="detail-row"><div class="detail-label">Version</div><div class="detail-value">${escapeHtml(details.version)}</div></div>
      <div class="detail-row"><div class="detail-label">Description</div><div class="detail-value">${escapeHtml(details.description || 'N/A')}</div></div>
      <div class="detail-row"><div class="detail-label">License</div><div class="detail-value">${escapeHtml(details.license || 'N/A')}</div></div>
      <div class="detail-row"><div class="detail-label">Homepage</div><div class="detail-value">${details.homepage ? `<a href="${escapeAttr(details.homepage)}">${escapeHtml(details.homepage)}</a>` : 'N/A'}</div></div>
      <div class="detail-row"><div class="detail-label">Dependencies</div><div class="detail-value">${depCount}</div></div>
      <div class="detail-row"><div class="detail-label">Source</div><div class="detail-value"><span class="badge">${escapeHtml(details.source)}</span></div></div>
    `;
    panel.classList.add('open');
    document.getElementById('close-detail').addEventListener('click', () => panel.classList.remove('open'));
  }

  function bindEvents() {
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        currentTab = tab.dataset.tab;
        render();
      });
    });

    document.querySelectorAll('[data-field]').forEach(input => {
      input.addEventListener('change', () => {
        let value = input.value;
        if (input.dataset.field === 'keywords') {
          value = input.value.split(',').map(k => k.trim()).filter(Boolean);
        }
        vscode.postMessage({ type: 'updateField', field: input.dataset.field, value });
      });
    });

    const filterSelect = document.getElementById('dep-type-filter');
    if (filterSelect) {
      filterSelect.addEventListener('change', () => {
        depFilter = filterSelect.value;
        render();
      });
    }

    const searchInput = document.getElementById('npm-search');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          if (searchInput.value.trim()) {
            vscode.postMessage({ type: 'searchNpm', query: searchInput.value.trim() });
          }
        }, 300);
      });
    }

    document.querySelectorAll('.remove-dep').forEach(btn => {
      btn.addEventListener('click', () => {
        vscode.postMessage({ type: 'removeDependency', name: btn.dataset.name });
      });
    });

    document.querySelectorAll('.move-dep').forEach(btn => {
      btn.addEventListener('click', () => {
        vscode.postMessage({ type: 'moveDependency', name: btn.dataset.name, toDev: btn.dataset.toDev === 'true' });
      });
    });

    document.querySelectorAll('.version-input').forEach(input => {
      input.addEventListener('change', () => {
        const name = input.dataset.name;
        const deps = currentData.dependencies || {};
        const isDev = !(name in deps);
        vscode.postMessage({ type: 'addDependency', name, version: input.value, isDev });
      });
    });

    document.querySelectorAll('.dep-name').forEach(el => {
      el.style.cursor = 'pointer';
      el.addEventListener('click', () => {
        vscode.postMessage({ type: 'getPackageDetails', name: el.dataset.name });
      });
    });

    document.querySelectorAll('.run-script').forEach(btn => {
      btn.addEventListener('click', () => {
        vscode.postMessage({ type: 'runScript', name: btn.dataset.name });
      });
    });

    document.querySelectorAll('.delete-script').forEach(btn => {
      btn.addEventListener('click', () => {
        vscode.postMessage({ type: 'removeScript', name: btn.dataset.name });
      });
    });

    document.querySelectorAll('.edit-script').forEach(btn => {
      btn.addEventListener('click', () => {
        const name = btn.dataset.name;
        const cmd = btn.dataset.command;
        const newCmd = prompt('Edit command:', cmd);
        if (newCmd !== null && newCmd !== cmd) {
          vscode.postMessage({ type: 'editScript', name, command: newCmd });
        }
      });
    });

    const addScriptBtn = document.getElementById('add-script-btn');
    if (addScriptBtn) {
      addScriptBtn.addEventListener('click', () => {
        const nameInput = document.getElementById('new-script-name');
        const cmdInput = document.getElementById('new-script-cmd');
        if (nameInput.value.trim() && cmdInput.value.trim()) {
          vscode.postMessage({ type: 'addScript', name: nameInput.value.trim(), command: cmdInput.value.trim() });
          nameInput.value = '';
          cmdInput.value = '';
        }
      });
    }

    bindSearchResultEvents();
  }

  function bindSearchResultEvents() {
    document.querySelectorAll('.add-dep').forEach(btn => {
      btn.addEventListener('click', () => {
        vscode.postMessage({
          type: 'addDependency',
          name: btn.dataset.name,
          version: btn.dataset.version,
          isDev: btn.dataset.dev === 'true'
        });
      });
    });
  }

  function showError(message) {
    const root = document.getElementById('root');
    const existing = root.querySelector('.error-message');
    if (existing) { existing.remove(); }
    const div = document.createElement('div');
    div.className = 'error-message';
    div.textContent = message;
    root.prepend(div);
    setTimeout(() => div.remove(), 5000);
  }

  function escapeHtml(str) {
    if (typeof str !== 'string') { return ''; }
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function escapeAttr(str) {
    if (typeof str !== 'string') { return ''; }
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  init();
})();
