// Global variables
let svg;
let simulation;
let nodes = [];
let links = [];
let nodeElements;
let linkElements;
let selectedNode = null;

// Initialize graph visualization once DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  initGraph();
  setupEventListeners();

  // Initialize with data from VSCode
  if (typeof graphData !== "undefined") {
    updateGraph(graphData);
  }
});

// Set up VSCode webview communication
const vscode = acquireVsCodeApi();

// Handle messages from the extension
window.addEventListener("message", (event) => {
  const message = event.data;

  switch (message.command) {
    case "packageDetails":
      showPackageInfo(message.details, message.packageName);
      break;

    case "updateGraph":
      updateGraph(message.data);
      break;
  }
});

// Initialize the SVG and force simulation
function initGraph() {
  const width = window.innerWidth;
  const height = window.innerHeight - 100; // Account for header

  // Create SVG container
  svg = d3
    .select("#graph-container")
    .append("svg")
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", [0, 0, width, height])
    .call(
      d3.zoom().on("zoom", (event) => {
        container.attr("transform", event.transform);
      })
    );

  // Add defs for arrow markers
  const defs = svg.append("defs");

  // Add arrow marker for dependencies
  defs
    .append("marker")
    .attr("id", "arrow-dependency")
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", 20)
    .attr("markerWidth", 6)
    .attr("markerHeight", 6)
    .attr("orient", "auto")
    .append("path")
    .attr("d", "M0,-5L10,0L0,5")
    .attr("fill", "#4CAF50");

  // Add arrow marker for devDependencies
  defs
    .append("marker")
    .attr("id", "arrow-devDependency")
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", 20)
    .attr("markerWidth", 6)
    .attr("markerHeight", 6)
    .attr("orient", "auto")
    .append("path")
    .attr("d", "M0,-5L10,0L0,5")
    .attr("fill", "#2196F3");

  // Add arrow marker for nested dependencies
  defs
    .append("marker")
    .attr("id", "arrow-nestedDependency")
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", 20)
    .attr("markerWidth", 6)
    .attr("markerHeight", 6)
    .attr("orient", "auto")
    .append("path")
    .attr("d", "M0,-5L10,0L0,5")
    .attr("fill", "#9E9E9E");

  // Create a container group for the graph
  const container = svg.append("g");

  // Create groups for graph elements
  container.append("g").attr("class", "links");

  container.append("g").attr("class", "nodes");

  // Create force simulation
  simulation = d3
    .forceSimulation()
    .force(
      "link",
      d3
        .forceLink()
        .id((d) => d.id)
        .distance(100)
    )
    .force("charge", d3.forceManyBody().strength(-300))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collision", d3.forceCollide().radius(40))
    .on("tick", ticked);
}

// Set up event listeners
function setupEventListeners() {
  // Refresh button
  document.getElementById("btn-refresh").addEventListener("click", () => {
    vscode.postMessage({
      command: "refresh",
    });
  });

  // Filter dropdown
  document.getElementById("dependency-type").addEventListener("change", (e) => {
    filterDependencies(e.target.value);
  });

  // Search input
  document.getElementById("search-input").addEventListener("input", (e) => {
    searchNodes(e.target.value);
  });

  // Package info close button
  document
    .getElementById("package-info-close")
    .addEventListener("click", () => {
      hidePackageInfo();
    });

  // Handle window resize
  window.addEventListener("resize", () => {
    resizeGraph();
  });
}

// Update the graph with new data
function updateGraph(data) {
  // Clear existing graph elements
  d3.select(".nodes").selectAll("*").remove();
  d3.select(".links").selectAll("*").remove();

  // Update data
  nodes = data.nodes;
  links = data.links;

  // Create links
  linkElements = d3
    .select(".links")
    .selectAll("line")
    .data(links)
    .enter()
    .append("line")
    .attr("class", (d) => `link ${d.type}`)
    .attr("stroke", (d) => getLinkColor(d.type))
    .attr("stroke-width", 2)
    .attr("marker-end", (d) => `url(#arrow-${d.type})`);

  // Create nodes
  const nodeGroups = d3
    .select(".nodes")
    .selectAll("g")
    .data(nodes)
    .enter()
    .append("g")
    .attr("class", (d) => `node ${d.type}`)
    .call(
      d3
        .drag()
        .on("start", dragStarted)
        .on("drag", dragged)
        .on("end", dragEnded)
    )
    .on("click", nodeClicked);

  // Node circles
  nodeGroups
    .append("circle")
    .attr("r", (d) => (d.type === "root" ? 30 : 20))
    .attr("fill", (d) => getNodeColor(d.type));

  // Node labels
  nodeGroups
    .append("text")
    .attr("dy", ".35em")
    .attr("text-anchor", "middle")
    .attr("font-size", "10px")
    .attr("fill", "#fff")
    .text((d) => shortenText(d.name, 18));

  // Update node elements reference
  nodeElements = nodeGroups;

  // Update simulation
  simulation.nodes(nodes);
  simulation.force("link").links(links);
  simulation.alpha(1).restart();

  // Remove loading message
  document.querySelector(".graph-loading").style.display = "none";
}

// Ticker function for updating positions on each simulation tick
function ticked() {
  if (!linkElements || !nodeElements) return;

  linkElements
    .attr("x1", (d) => d.source.x)
    .attr("y1", (d) => d.source.y)
    .attr("x2", (d) => d.target.x)
    .attr("y2", (d) => d.target.y);

  nodeElements.attr("transform", (d) => `translate(${d.x}, ${d.y})`);
}

// Handle node drag events
function dragStarted(event, d) {
  if (!event.active) simulation.alphaTarget(0.3).restart();
  d.fx = d.x;
  d.fy = d.y;
}

function dragged(event, d) {
  d.fx = event.x;
  d.fy = event.y;
}

function dragEnded(event, d) {
  if (!event.active) simulation.alphaTarget(0);
  d.fx = null;
  d.fy = null;
}

// Handle node click to show package details
function nodeClicked(event, d) {
  event.stopPropagation();

  // Clear previous selection
  if (selectedNode) {
    d3.select(selectedNode)
      .select("circle")
      .attr("stroke", null)
      .attr("stroke-width", 0);
  }

  // Highlight selected node
  selectedNode = this;
  d3.select(this)
    .select("circle")
    .attr("stroke", "#FFD700")
    .attr("stroke-width", 3);

  // Show package info panel with loading indicator
  showPackageInfoLoading(d.name);

  // Request package details from extension
  vscode.postMessage({
    command: "getPackageDetails",
    packageName: d.name,
  });
}

// Show package info panel with loading state
function showPackageInfoLoading(packageName) {
  const infoPanel = document.getElementById("package-info");
  const nameElement = document.getElementById("package-info-name");
  const contentElement = document.getElementById("package-info-content");

  nameElement.textContent = packageName;
  contentElement.innerHTML =
    '<div class="loading">Loading package information...</div>';

  infoPanel.classList.remove("hidden");
}

// Show package info panel with data
function showPackageInfo(details, packageName) {
  const contentElement = document.getElementById("package-info-content");

  let html = `
    <div class="package-detail">
      <span class="detail-label">Version:</span>
      <span class="detail-value">${details.version || "Unknown"}</span>
    </div>
    <div class="package-detail">
      <span class="detail-label">Description:</span>
      <span class="detail-value">${
        details.description || "No description available"
      }</span>
    </div>
  `;

  if (details.author) {
    html += `
      <div class="package-detail">
        <span class="detail-label">Author:</span>
        <span class="detail-value">${details.author}</span>
      </div>
    `;
  }

  if (details.license) {
    html += `
      <div class="package-detail">
        <span class="detail-label">License:</span>
        <span class="detail-value">${details.license}</span>
      </div>
    `;
  }

  if (details.dependencies !== undefined) {
    html += `
      <div class="package-detail">
        <span class="detail-label">Dependencies:</span>
        <span class="detail-value">${details.dependencies}</span>
      </div>
    `;
  }

  if (details.maintainers) {
    html += `
      <div class="package-detail">
        <span class="detail-label">Maintainers:</span>
        <span class="detail-value">${details.maintainers}</span>
      </div>
    `;
  }

  if (details.homepage) {
    html += `
      <div class="package-detail">
        <span class="detail-label">Homepage:</span>
        <span class="detail-value">
          <a href="${details.homepage}" target="_blank">${details.homepage}</a>
        </span>
      </div>
    `;
  }

  if (details.repository) {
    html += `
      <div class="package-detail">
        <span class="detail-label">Repository:</span>
        <span class="detail-value">
          <a href="${details.repository}" target="_blank">${details.repository}</a>
        </span>
      </div>
    `;
  }

  // Add data source info
  html += `
    <div class="package-detail source-info">
      <span class="detail-label">Source:</span>
      <span class="detail-value">${
        details.source === "local"
          ? "Local node_modules"
          : details.source === "npm"
          ? "npm Registry"
          : "Error fetching data"
      }</span>
    </div>
  `;

  contentElement.innerHTML = html;
}

// Hide package info panel
function hidePackageInfo() {
  document.getElementById("package-info").classList.add("hidden");

  // Clear node selection
  if (selectedNode) {
    d3.select(selectedNode)
      .select("circle")
      .attr("stroke", null)
      .attr("stroke-width", 0);

    selectedNode = null;
  }
}

// Filter dependencies by type
function filterDependencies(type) {
  if (!linkElements) return;

  if (type === "all") {
    // Show all links and nodes
    linkElements.style("opacity", 1);
    nodeElements.style("opacity", 1);
  } else {
    // Show only links of selected type and their connected nodes
    const relevantLinkIds = new Set();

    // First, identify all relevant links
    linkElements.each(function (d) {
      if (d.type === type) {
        relevantLinkIds.add(`${d.source.id}-${d.target.id}`);
      }
    });

    // Then, filter links and nodes
    linkElements.style("opacity", (d) => (d.type === type ? 1 : 0.1));

    nodeElements.style("opacity", (d) => {
      if (d.type === "root") return 1;

      // Check if this node is connected by a relevant link
      let isConnected = false;
      linkElements.each(function (l) {
        if ((l.source.id === d.id || l.target.id === d.id) && l.type === type) {
          isConnected = true;
        }
      });

      return isConnected ? 1 : 0.3;
    });
  }
}

// Search for nodes by name
function searchNodes(searchText) {
  if (!nodeElements || searchText === "") {
    // Reset all opacities if search is cleared
    nodeElements.style("opacity", 1);
    linkElements.style("opacity", 1);
    return;
  }

  const searchLower = searchText.toLowerCase();

  // Find matching nodes
  const matchingNodes = new Set();
  nodeElements.each((d) => {
    if (d.name.toLowerCase().includes(searchLower)) {
      matchingNodes.add(d.id);
    }
  });

  // Update node visibility
  nodeElements.style("opacity", (d) => (matchingNodes.has(d.id) ? 1 : 0.2));

  // Update link visibility
  linkElements.style("opacity", (d) =>
    matchingNodes.has(d.source.id) && matchingNodes.has(d.target.id) ? 1 : 0.1
  );
}

// Resize the graph on window resize
function resizeGraph() {
  const width = window.innerWidth;
  const height = window.innerHeight - 100;

  svg
    .attr("width", width)
    .attr("height", height)
    .attr("viewBox", [0, 0, width, height]);

  simulation
    .force("center", d3.forceCenter(width / 2, height / 2))
    .alpha(0.3)
    .restart();
}

// Helper functions
function getNodeColor(type) {
  switch (type) {
    case "root":
      return "#FF5722";
    case "dependency":
      return "#4CAF50";
    case "devDependency":
      return "#2196F3";
    case "nestedDependency":
      return "#9E9E9E";
    default:
      return "#9C27B0";
  }
}

function getLinkColor(type) {
  switch (type) {
    case "dependency":
      return "#4CAF50";
    case "devDependency":
      return "#2196F3";
    case "nestedDependency":
      return "#9E9E9E";
    default:
      return "#9C27B0";
  }
}

function shortenText(text, maxLength) {
  if (!text) return "";
  return text.length > maxLength ? text.substr(0, maxLength - 3) + "..." : text;
}
