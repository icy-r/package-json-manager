(function () {
  const vscode = acquireVsCodeApi();
  let simulation = null;
  let graphData = null;
  let searchTerm = '';

  function init() {
    vscode.postMessage({ type: 'ready' });
    setupControls();
  }

  function setupControls() {
    const searchInput = document.getElementById('search');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        searchTerm = searchInput.value.toLowerCase();
        updateHighlights();
      });
    }

    const filterSelect = document.getElementById('filter');
    if (filterSelect) {
      filterSelect.addEventListener('change', () => {
        vscode.postMessage({ type: 'filterChanged', filter: filterSelect.value });
      });
    }
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
      showNoModulesMessage('No dependencies found. Run npm install to generate the dependency graph.');
      return;
    }

    const width = container.clientWidth;
    const height = container.clientHeight;

    svg.attr('viewBox', [0, 0, width, height]);

    const g = svg.append('g');

    svg.call(d3.zoom()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => g.attr('transform', event.transform)));

    svg.append('defs').append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '-0 -5 10 10')
      .attr('refX', 20)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .append('path')
      .attr('d', 'M 0,-5 L 10,0 L 0,5')
      .attr('class', 'link-arrow');

    const link = g.append('g')
      .selectAll('line')
      .data(data.links)
      .join('line')
      .attr('class', 'link')
      .attr('marker-end', 'url(#arrowhead)');

    const node = g.append('g')
      .selectAll('g')
      .data(data.nodes)
      .join('g')
      .attr('class', d => `node ${d.type}`)
      .call(d3.drag()
        .on('start', dragStarted)
        .on('drag', dragged)
        .on('end', dragEnded));

    const nodeRadius = d => d.type === 'root' ? 14 : d.type === 'nestedDependency' ? 6 : 8;

    node.append('circle')
      .attr('r', nodeRadius)
      .on('click', (event, d) => {
        vscode.postMessage({ type: 'getPackageDetails', name: d.name });
      });

    node.append('text')
      .attr('dx', d => nodeRadius(d) + 4)
      .attr('dy', 3)
      .text(d => d.name.length > 20 ? d.name.slice(0, 18) + '…' : d.name);

    simulation = d3.forceSimulation(data.nodes)
      .force('link', d3.forceLink(data.links).id(d => d.id).distance(80))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(d => nodeRadius(d) + 10))
      .on('tick', () => {
        link
          .attr('x1', d => d.source.x)
          .attr('y1', d => d.source.y)
          .attr('x2', d => d.target.x)
          .attr('y2', d => d.target.y);
        node.attr('transform', d => `translate(${d.x},${d.y})`);
      });

    addLegend();
  }

  function addLegend() {
    const existing = document.querySelector('.legend');
    if (existing) { existing.remove(); }

    const legend = document.createElement('div');
    legend.className = 'legend';
    const types = [
      { label: 'Root', color: '#e74c3c' },
      { label: 'Dependency', color: '#3498db' },
      { label: 'Dev', color: '#2ecc71' },
      { label: 'Nested', color: '#9b59b6' },
      { label: 'Peer', color: '#f39c12' }
    ];
    legend.innerHTML = types.map(t =>
      `<span class="legend-item"><span class="legend-dot" style="background:${t.color}"></span>${t.label}</span>`
    ).join('');
    document.body.appendChild(legend);
  }

  function updateHighlights() {
    d3.selectAll('.node').classed('highlighted', d => {
      if (!searchTerm) { return false; }
      return d.name.toLowerCase().includes(searchTerm);
    });
  }

  function showDetails(details) {
    const panel = document.getElementById('details-panel');
    if (!panel) { return; }
    const depCount = Object.keys(details.dependencies || {}).length;
    panel.innerHTML = `
      <h3>${escapeHtml(details.name)}</h3>
      <div class="detail-row"><div class="detail-label">Version</div><div class="detail-value">${escapeHtml(details.version)}</div></div>
      <div class="detail-row"><div class="detail-label">Description</div><div class="detail-value">${escapeHtml(details.description || 'N/A')}</div></div>
      <div class="detail-row"><div class="detail-label">License</div><div class="detail-value">${escapeHtml(details.license || 'N/A')}</div></div>
      <div class="detail-row"><div class="detail-label">Dependencies</div><div class="detail-value">${depCount}</div></div>
      <div class="detail-row"><div class="detail-label">Source</div><div class="detail-value">${escapeHtml(details.source)}</div></div>
    `;
    panel.classList.add('visible');
    panel.addEventListener('click', function handler(e) {
      if (e.target === panel) {
        panel.classList.remove('visible');
        panel.removeEventListener('click', handler);
      }
    });
  }

  function showNoModulesMessage(message) {
    const container = document.getElementById('graph-container');
    container.innerHTML = `<div class="no-modules-message">${escapeHtml(message)}</div>`;
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

  function escapeHtml(str) {
    if (typeof str !== 'string') { return ''; }
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  init();
})();
