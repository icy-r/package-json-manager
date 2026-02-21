(function () {
  const vscode = acquireVsCodeApi();
  let simulation = null;
  let graphData = null;
  let searchTerm = '';
  let currentZoom = null;

  function init() {
    vscode.postMessage({ type: 'ready' });
    setupControls();
    createTooltip();
  }

  function setupControls() {
    const searchInput = document.getElementById('search');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        searchTerm = searchInput.value.toLowerCase().trim();
        updateHighlights();
      });
    }

    const filterSelect = document.getElementById('filter');
    if (filterSelect) {
      filterSelect.addEventListener('change', () => {
        vscode.postMessage({ type: 'filterChanged', filter: filterSelect.value });
      });
    }

    document.getElementById('zoom-in')?.addEventListener('click', () => zoomBy(1.3));
    document.getElementById('zoom-out')?.addEventListener('click', () => zoomBy(0.7));
    document.getElementById('zoom-reset')?.addEventListener('click', zoomReset);
  }

  function createTooltip() {
    if (document.querySelector('.graph-tooltip')) { return; }
    const tt = document.createElement('div');
    tt.className = 'graph-tooltip';
    tt.id = 'tooltip';
    document.getElementById('graph-container').appendChild(tt);
  }

  window.addEventListener('message', event => {
    const msg = event.data;
    switch (msg.type) {
      case 'graphData':
        graphData = msg.graph;
        renderGraph(msg.graph);
        break;
      case 'packageDetails':
        showDetails(msg.details);
        break;
      case 'error':
        showNoModulesMessage(msg.message);
        break;
    }
  });

  function renderGraph(data) {
    const container = document.getElementById('graph-container');
    const svg = d3.select('#graph');
    svg.selectAll('*').remove();

    if (!data.nodes || data.nodes.length <= 1) {
      showNoModulesMessage('No dependencies found. Run npm install to populate the graph.');
      return;
    }

    const width = container.clientWidth;
    const height = container.clientHeight;
    svg.attr('viewBox', [0, 0, width, height]);

    const g = svg.append('g');

    const zoom = d3.zoom()
      .scaleExtent([0.1, 5])
      .on('zoom', event => g.attr('transform', event.transform));

    currentZoom = zoom;
    svg.call(zoom);

    svg.append('defs').append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 20)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 5)
      .attr('markerHeight', 5)
      .append('path')
      .attr('d', 'M 0,-5 L 10,0 L 0,5')
      .attr('class', 'link-arrow');

    const link = g.append('g')
      .selectAll('line')
      .data(data.links)
      .join('line')
      .attr('class', 'link')
      .attr('marker-end', 'url(#arrowhead)');

    const nodeRadius = d => {
      if (d.type === 'root') { return 16; }
      if (d.type === 'nestedDependency') { return 5; }
      return 8;
    };

    const node = g.append('g')
      .selectAll('g')
      .data(data.nodes)
      .join('g')
      .attr('class', d => `node ${d.type}`)
      .call(d3.drag()
        .on('start', dragStarted)
        .on('drag', dragged)
        .on('end', dragEnded));

    node.append('circle')
      .attr('r', nodeRadius)
      .on('click', (event, d) => {
        event.stopPropagation();
        vscode.postMessage({ type: 'getPackageDetails', name: d.name });
      })
      .on('mouseover', (event, d) => showTooltip(event, d))
      .on('mouseout', hideTooltip);

    node.append('text')
      .attr('dx', d => nodeRadius(d) + 4)
      .attr('dy', 3)
      .text(d => {
        const maxLen = d.type === 'nestedDependency' ? 12 : 22;
        return d.name.length > maxLen ? d.name.slice(0, maxLen - 1) + '…' : d.name;
      });

    simulation = d3.forceSimulation(data.nodes)
      .force('link', d3.forceLink(data.links).id(d => d.id).distance(d => {
        const src = typeof d.source === 'object' ? d.source : data.nodes.find(n => n.id === d.source);
        return src?.type === 'root' ? 120 : 70;
      }))
      .force('charge', d3.forceManyBody().strength(d => d.type === 'root' ? -400 : -150))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(d => nodeRadius(d) + 12))
      .force('x', d3.forceX(width / 2).strength(0.03))
      .force('y', d3.forceY(height / 2).strength(0.03))
      .on('tick', () => {
        link
          .attr('x1', d => d.source.x)
          .attr('y1', d => d.source.y)
          .attr('x2', d => d.target.x)
          .attr('y2', d => d.target.y);
        node.attr('transform', d => `translate(${d.x},${d.y})`);
      });

    svg.on('click', () => {
      document.getElementById('details-panel')?.classList.remove('visible');
    });

    addLegend(data);
    addStats(data);
  }

  function addLegend(data) {
    let legend = document.querySelector('.legend');
    if (legend) { legend.remove(); }

    const types = [
      { label: 'Root', color: 'var(--color-root)', type: 'root' },
      { label: 'Dependency', color: 'var(--color-dep)', type: 'dependency' },
      { label: 'Dev', color: 'var(--color-dev)', type: 'devDependency' },
      { label: 'Nested', color: 'var(--color-nested)', type: 'nestedDependency' },
      { label: 'Peer', color: 'var(--color-peer)', type: 'peerDependency' }
    ].filter(t => data.nodes.some(n => n.type === t.type));

    legend = document.createElement('div');
    legend.className = 'legend';
    legend.innerHTML = types.map(t =>
      `<span class="legend-item" data-type="${t.type}"><span class="legend-dot" style="background:${t.color}"></span>${t.label}</span>`
    ).join('');

    const statsBar = document.querySelector('.stats-bar');
    if (statsBar) {
      document.body.insertBefore(legend, statsBar);
    } else {
      document.body.appendChild(legend);
    }
  }

  function addStats(data) {
    let bar = document.querySelector('.stats-bar');
    if (bar) { bar.remove(); }

    bar = document.createElement('div');
    bar.className = 'stats-bar';
    bar.innerHTML = `<span>${data.nodes.length} nodes</span><span>${data.links.length} edges</span>`;
    document.body.appendChild(bar);
  }

  function updateHighlights() {
    if (!graphData) { return; }

    const matchedIds = new Set();
    if (searchTerm) {
      graphData.nodes.forEach(n => {
        if (n.name.toLowerCase().includes(searchTerm)) { matchedIds.add(n.id); }
      });
    }

    const connectedLinks = new Set();
    if (matchedIds.size > 0) {
      graphData.links.forEach((l, i) => {
        const src = typeof l.source === 'object' ? l.source.id : l.source;
        const tgt = typeof l.target === 'object' ? l.target.id : l.target;
        if (matchedIds.has(src) || matchedIds.has(tgt)) { connectedLinks.add(i); }
      });
    }

    d3.selectAll('.node')
      .classed('highlighted', d => matchedIds.has(d.id))
      .classed('dimmed', d => searchTerm && !matchedIds.has(d.id));

    d3.selectAll('.link')
      .classed('highlighted', (d, i) => connectedLinks.has(i))
      .classed('dimmed', (d, i) => searchTerm && !connectedLinks.has(i));
  }

  function showTooltip(event, d) {
    const tt = document.getElementById('tooltip');
    if (!tt) { return; }
    tt.innerHTML = `
      <div class="tt-name">${esc(d.name)}</div>
      <div class="tt-version">${esc(d.version)}</div>
      <div class="tt-type">${d.type.replace(/([A-Z])/g, ' $1').trim()}</div>
    `;
    const rect = document.getElementById('graph-container').getBoundingClientRect();
    tt.style.left = (event.clientX - rect.left + 12) + 'px';
    tt.style.top = (event.clientY - rect.top - 10) + 'px';
    tt.classList.add('visible');
  }

  function hideTooltip() {
    document.getElementById('tooltip')?.classList.remove('visible');
  }

  function showDetails(details) {
    const panel = document.getElementById('details-panel');
    if (!panel) { return; }
    const depCount = Object.keys(details.dependencies || {}).length;
    const repoUrl = details.repository?.url ? details.repository.url.replace(/^git\+/, '').replace(/\.git$/, '') : '';

    panel.innerHTML = `
      <div class="detail-header">
        <h3>${esc(details.name)}</h3>
        <button class="detail-close" id="close-graph-detail">×</button>
      </div>
      <div class="detail-section"><div class="detail-label">Version</div><div class="detail-value" style="font-family:var(--mono-font)">${esc(details.version)}</div></div>
      <div class="detail-section"><div class="detail-label">Description</div><div class="detail-value">${esc(details.description || 'No description')}</div></div>
      <div class="detail-section"><div class="detail-label">License</div><div class="detail-value">${esc(details.license || 'N/A')}</div></div>
      ${details.homepage ? `<div class="detail-section"><div class="detail-label">Homepage</div><div class="detail-value"><a href="${attr(details.homepage)}">${esc(details.homepage)}</a></div></div>` : ''}
      ${repoUrl ? `<div class="detail-section"><div class="detail-label">Repository</div><div class="detail-value"><a href="${attr(repoUrl)}">${esc(repoUrl)}</a></div></div>` : ''}
      <div class="detail-section"><div class="detail-label">Dependencies</div><div class="detail-value">${depCount}</div></div>
    `;
    panel.classList.add('visible');
    document.getElementById('close-graph-detail')?.addEventListener('click', () => panel.classList.remove('visible'));
  }

  function showNoModulesMessage(message) {
    const container = document.getElementById('graph-container');
    container.innerHTML = `
      <div class="no-modules-message">
        <div class="msg-icon">📦</div>
        <div class="msg-text">${esc(message)}</div>
        <div class="msg-hint">Run npm install or pnpm install in your project</div>
      </div>`;
  }

  function zoomBy(factor) {
    if (!currentZoom) { return; }
    const svg = d3.select('#graph');
    svg.transition().duration(300).call(currentZoom.scaleBy, factor);
  }

  function zoomReset() {
    if (!currentZoom) { return; }
    const svg = d3.select('#graph');
    svg.transition().duration(500).call(currentZoom.transform, d3.zoomIdentity);
  }

  function dragStarted(event) {
    if (!event.active) { simulation.alphaTarget(0.3).restart(); }
    event.subject.fx = event.subject.x;
    event.subject.fy = event.subject.y;
  }

  function dragged(event) {
    event.subject.fx = event.x;
    event.subject.fy = event.y;
  }

  function dragEnded(event) {
    if (!event.active) { simulation.alphaTarget(0); }
    event.subject.fx = null;
    event.subject.fy = null;
  }

  function esc(str) {
    if (typeof str !== 'string') { return ''; }
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function attr(str) {
    if (typeof str !== 'string') { return ''; }
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  }

  init();
})();
