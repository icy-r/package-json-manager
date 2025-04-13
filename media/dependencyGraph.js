// Get VS Code API
const vscode = acquireVsCodeApi();

// Initialize the graph when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Set up event listeners
  setupEventListeners();

  // Initialize the graph visualization
  initializeGraph(graphData);
});

// Handle messages from the extension
window.addEventListener('message', event => {
  const message = event.data;

  switch (message.command) {
    case 'packageDetails':
      // Show package details panel
      showPackageDetails(message.packageName, message.details);
      break;
  }
});

// Set up event listeners
function setupEventListeners() {
  // Refresh button
  document.getElementById('btn-refresh').addEventListener('click', () => {
    vscode.postMessage({ command: 'refresh' });
  });

  // Dependency type filter
  document.getElementById('dependency-type').addEventListener('change', (e) => {
    filterDependenciesByType(e.target.value);
  });

  // Search input
  document.getElementById('search-input').addEventListener('input', (e) => {
    searchPackages(e.target.value);
  });

  // Package info close button
  document.getElementById('package-info-close').addEventListener('click', () => {
    hidePackageInfo();
  });
}

// Initialize D3.js graph visualization
function initializeGraph(data) {
  try {
    console.log('Initializing graph with data:', data);

    // Check if data is valid
    if (!data || !data.nodes || !data.links) {
      console.error('Invalid graph data:', data);
      document.querySelector('.graph-loading').textContent = 'Error: Invalid graph data';
      return;
    }

    // Hide loading indicator
    document.querySelector('.graph-loading').classList.add('hidden');

    // Create an SVG element for the graph
    const graphContainer = document.getElementById('graph-container');
    const svg = d3.select(graphContainer)
      .append('svg')
      .attr('class', 'graph')
      .attr('width', '100%')
      .attr('height', '100%');

    // Create a container group for the graph
    const g = svg.append('g');

    // Add zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.1, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Add a defs section for markers
    const defs = svg.append('defs');

    // Add arrow marker for links
    defs.append('marker')
      .attr('id', 'arrowhead')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 20)
      .attr('refY', 0)
      .attr('orient', 'auto')
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', 'var(--vscode-editor-foreground)');

  // Create a force simulation for the graph layout
  const simulation = d3.forceSimulation(data.nodes)
    .force('link', d3.forceLink(data.links).id(d => d.id).distance(100))
    .force('charge', d3.forceManyBody().strength(-300))
    .force('center', d3.forceCenter(graphContainer.offsetWidth / 2, graphContainer.offsetHeight / 2))
    .force('collide', d3.forceCollide().radius(50));

  console.log('Force simulation created with nodes:', data.nodes.length, 'links:', data.links.length);

  // Create links (edges)
  const links = g.append('g')
    .selectAll('line')
    .data(data.links)
    .enter()
    .append('line')
    .attr('class', d => `link ${d.type || ''}`)
    .attr('marker-end', 'url(#arrowhead)');

  // Create nodes
  const nodes = g.append('g')
    .selectAll('.node')
    .data(data.nodes)
    .enter()
    .append('g')
    .attr('class', d => `node ${d.type || ''}`)
    .call(d3.drag()
      .on('start', dragstarted)
      .on('drag', dragged)
      .on('end', dragended))
    .on('click', nodeClicked);

  // Add circles to nodes
  nodes.append('circle')
    .attr('r', d => d.type === 'root' ? 25 : 15);

  // Add labels to nodes
  nodes.append('text')
    .attr('class', 'node-label')
    .text(d => d.name);

  // Add controls for zoom
  const controls = d3.select(graphContainer)
    .append('div')
    .attr('class', 'controls');

  const zoomControl = controls.append('div')
    .attr('class', 'zoom-control');

  zoomControl.append('button')
    .text('+')
    .on('click', () => {
      svg.transition().duration(500).call(zoom.scaleBy, 1.5);
    });

  zoomControl.append('button')
    .text('-')
    .on('click', () => {
      svg.transition().duration(500).call(zoom.scaleBy, 0.75);
    });

  zoomControl.append('button')
    .text('Reset')
    .on('click', () => {
      svg.transition().duration(500).call(zoom.transform, d3.zoomIdentity);
    });

  // Update the positions on each tick of the simulation
  simulation.on('tick', () => {
    links
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x)
      .attr('y2', d => d.target.y);

    nodes
      .attr('transform', d => `translate(${d.x}, ${d.y})`);
  });

  // Add a slight initial zoom out to show the whole graph
  svg.transition().duration(750).call(
    zoom.transform,
    d3.zoomIdentity.translate(graphContainer.offsetWidth / 2, graphContainer.offsetHeight / 2).scale(0.8)
  );

  // Drag functions for nodes
  function dragstarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }

  function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
  }

  function dragended(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    // Keep the node fixed at its new position
    // d.fx = null;
    // d.fy = null;
  }

  // Handle node click events
  function nodeClicked(event, d) {
    // Don't follow click if it's the end of a drag
    if (event.defaultPrevented) return;

    // Highlight node and connected links
    highlightNode(d);

    // Show package details
    if (d.type !== 'root') {
      requestPackageDetails(d.name);
    }
  }

  // Highlight a node and its connections
  function highlightNode(node) {
    // First reset all highlights
    nodes.classed('highlighted', false);
    links.classed('highlighted', false);

    // Highlight the selected node
    nodes.filter(d => d.id === node.id).classed('highlighted', true);

    // Highlight direct links to/from this node
    links.filter(d => d.source.id === node.id || d.target.id === node.id)
      .classed('highlighted', true);

    // Highlight connected nodes
    nodes.filter(d => {
      return data.links.some(link =>
        (link.source.id === node.id && link.target.id === d.id) ||
        (link.target.id === node.id && link.source.id === d.id)
      );
    }).classed('highlighted', true);
  }

  } catch (error) {
    console.error('Error initializing graph:', error);
    document.querySelector('.graph-loading').classList.remove('hidden');
    document.querySelector('.graph-loading').innerHTML = `<p>Error initializing graph: ${error.message}</p>`;
  }
}

// Filter dependencies by type (all, dependencies, devDependencies)
function filterDependenciesByType(type) {
  const nodes = d3.selectAll('.node');
  const links = d3.selectAll('.link');

  if (type === 'all') {
    // Show all nodes and links
    nodes.style('display', null);
    links.style('display', null);
  } else {
    // Hide nodes and links that don't match the type
    nodes.style('display', d => d.type === 'root' || d.type === type ? null : 'none');
    links.style('display', d => d.type === type ? null : 'none');
  }
}

// Search for packages by name
function searchPackages(query) {
  if (!query) {
    // If query is empty, show all nodes
    d3.selectAll('.node').style('display', null);
    d3.selectAll('.link').style('display', null);
    return;
  }

  const lowerQuery = query.toLowerCase();
  const matchingNodes = [];

  // Find matching nodes
  d3.selectAll('.node').each(function(d) {
    const match = d.name.toLowerCase().includes(lowerQuery);
    d3.select(this).style('display', match ? null : 'none');
    if (match) {
      matchingNodes.push(d.id);
    }
  });

  // Show links connected to matching nodes
  d3.selectAll('.link').style('display', function(d) {
    return matchingNodes.includes(d.source.id) || matchingNodes.includes(d.target.id)
      ? null
      : 'none';
  });
}

// Request package details from the extension
function requestPackageDetails(packageName) {
  vscode.postMessage({
    command: 'getPackageDetails',
    packageName
  });
}

// Show package details in the panel
function showPackageDetails(packageName, details) {
  const packageInfo = document.getElementById('package-info');
  const packageInfoName = document.getElementById('package-info-name');
  const packageInfoContent = document.getElementById('package-info-content');

  // Set the package name
  packageInfoName.textContent = packageName;

  // Populate the content
  packageInfoContent.innerHTML = `
    <dl>
      <dt>Description</dt>
      <dd>${details.description || 'No description available'}</dd>

      <dt>Current Version</dt>
      <dd>${details.version || 'Unknown'}</dd>

      <dt>Available Versions</dt>
      <dd>${details.versions ? details.versions.join(', ') : 'Unknown'}</dd>

      <dt>Author</dt>
      <dd>${details.author || 'Unknown'}</dd>

      <dt>License</dt>
      <dd>${details.license || 'Unknown'}</dd>

      <dt>Homepage</dt>
      <dd>${details.homepage || 'Not specified'}</dd>

      <dt>Repository</dt>
      <dd>${details.repository || 'Not specified'}</dd>
    </dl>
  `;

  // Show the panel
  packageInfo.classList.remove('hidden');
}

// Hide package info panel
function hidePackageInfo() {
  document.getElementById('package-info').classList.add('hidden');
}