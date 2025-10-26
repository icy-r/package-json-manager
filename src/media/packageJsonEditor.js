// Get VS Code API
const vscode = acquireVsCodeApi();

// Store the current package.json data
let packageJson = null;

// Initialize the UI once the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM loaded, requesting package.json data');
  
  // Show loading state
  showLoadingState();
  
  // Request the initial package.json data
  vscode.postMessage({ command: 'getPackageJson' });
  
  // Set up tab navigation
  setupTabs();
  
  // Set up event listeners for UI interactions
  setupEventListeners();
});

// Handle messages from the extension
window.addEventListener('message', event => {
  const message = event.data;
  
  console.log('Received message from extension:', message.command);
  
  switch (message.command) {
    case 'packageJson':
      // Update the UI with the received package.json data
      console.log('Received package.json data:', message.packageJson);
      packageJson = message.packageJson;
      hideLoadingState();
      updateUI(packageJson);
      break;
      
    case 'error':
      // Display error message
      console.error('Received error from extension:', message.error);
      hideLoadingState();
      showError(message.error);
      break;
      
    case 'searchResults':
      // Update search results in add dependency modal
      updateSearchResults(message.results);
      break;
      
    case 'scriptExecuted':
      // Show notification that script was executed
      showNotification(`Script "${message.script}" is running in terminal`);
      break;
  }
});

// Set up tab navigation
function setupTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      // Remove active class from all tabs
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));
      
      // Add active class to clicked tab
      btn.classList.add('active');
      const tabId = btn.getAttribute('data-tab');
      document.getElementById(tabId).classList.add('active');
    });
  });
  
  // Set up subtabs in dependencies tab
  const subtabBtns = document.querySelectorAll('.subtab-btn');
  const subtabContents = document.querySelectorAll('.subtab-content');
  
  subtabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      // Remove active class from all subtabs
      subtabBtns.forEach(b => b.classList.remove('active'));
      subtabContents.forEach(c => c.classList.remove('active'));
      
      // Add active class to clicked subtab
      btn.classList.add('active');
      const subtabId = btn.getAttribute('data-subtab');
      document.getElementById(subtabId).classList.add('active');
    });
  });
}

// Set up event listeners
function setupEventListeners() {
  // Toggle view button
  document.getElementById('btn-toggle-view').addEventListener('click', () => {
    vscode.postMessage({ command: 'toggleView' });
  });
  
  // Form inputs in Package Info tab
  const packageInfoInputs = document.querySelectorAll('#package-info input, #package-info textarea');
  packageInfoInputs.forEach(input => {
    input.addEventListener('change', () => {
      updatePackageJsonFromForm();
    });
  });
  
  // Add dependency button
  document.getElementById('btn-add-dependency').addEventListener('click', () => {
    showAddDependencyModal();
  });
  
  // Show dependency graph button
  document.getElementById('btn-show-graph').addEventListener('click', () => {
    vscode.postMessage({ command: 'showDependencyGraph' });
  });
  
  // Add script button
  document.getElementById('btn-add-script').addEventListener('click', () => {
    showAddScriptModal();
  });
  
  // Search dependencies
  document.getElementById('search-dependencies').addEventListener('input', (e) => {
    filterDependencies(e.target.value, 'dependencies');
  });
  
  // Search dev dependencies
  document.getElementById('search-dev-dependencies').addEventListener('input', (e) => {
    filterDependencies(e.target.value, 'devDependencies');
  });
  
  // Search scripts
  document.getElementById('search-scripts').addEventListener('input', (e) => {
    filterScripts(e.target.value);
  });
  
  // Modal close button
  document.getElementById('modal-close').addEventListener('click', () => {
    closeModal();
  });
}

// Update UI with package.json data
function updateUI(data) {
  // Update package info tab
  document.getElementById('package-name').value = data.name || '';
  document.getElementById('package-version').value = data.version || '';
  document.getElementById('package-description').value = data.description || '';
  document.getElementById('package-author').value = typeof data.author === 'string' ? data.author : (data.author?.name || '');
  document.getElementById('package-license').value = data.license || '';
  document.getElementById('package-keywords').value = Array.isArray(data.keywords) ? data.keywords.join(', ') : '';
  
  // Update dependencies tab
  updateDependenciesList('dependencies', data.dependencies || {});
  updateDependenciesList('devDependencies', data.devDependencies || {});
  
  // Update scripts tab
  updateScriptsList(data.scripts || {});
}

// Update dependencies list in UI
function updateDependenciesList(type, dependencies) {
  const listElement = type === 'dependencies' 
    ? document.getElementById('dependencies-list') 
    : document.getElementById('dev-dependencies-list');
  
  // Clear the list
  listElement.innerHTML = '';
  
  // Check if there are dependencies
  const dependencyEntries = Object.entries(dependencies);
  if (dependencyEntries.length === 0) {
    listElement.innerHTML = '<div class="empty-state">No dependencies found.</div>';
    return;
  }
  
  // Add each dependency to the list
  dependencyEntries.forEach(([name, version]) => {
    const dependencyItem = document.createElement('div');
    dependencyItem.className = 'dependency-item';
    dependencyItem.innerHTML = `
      <div class="dependency-info">
        <div class="dependency-name">${escapeHtml(name)}</div>
        <div class="dependency-version">${escapeHtml(version)}</div>
      </div>
      <div class="dependency-actions">
        <button class="btn-edit" data-name="${escapeHtml(name)}" data-version="${escapeHtml(version)}" data-type="${type}">Edit</button>
        <button class="btn-delete btn-danger" data-name="${escapeHtml(name)}" data-type="${type}">Remove</button>
      </div>
    `;
    
    listElement.appendChild(dependencyItem);
    
    // Add event listeners for edit and delete buttons
    dependencyItem.querySelector('.btn-edit').addEventListener('click', (e) => {
      const name = e.target.getAttribute('data-name');
      const version = e.target.getAttribute('data-version');
      const type = e.target.getAttribute('data-type');
      showEditDependencyModal(name, version, type);
    });
    
    dependencyItem.querySelector('.btn-delete').addEventListener('click', (e) => {
      const name = e.target.getAttribute('data-name');
      const type = e.target.getAttribute('data-type');
      showDeleteDependencyConfirmation(name, type);
    });
  });
}

// Update scripts list in UI
function updateScriptsList(scripts) {
  const listElement = document.getElementById('scripts-list');
  
  // Clear the list
  listElement.innerHTML = '';
  
  // Check if there are scripts
  const scriptEntries = Object.entries(scripts);
  if (scriptEntries.length === 0) {
    listElement.innerHTML = '<div class="empty-state">No scripts found.</div>';
    return;
  }
  
  // Add each script to the list
  scriptEntries.forEach(([name, command]) => {
    const scriptItem = document.createElement('div');
    scriptItem.className = 'script-item';
    scriptItem.innerHTML = `
      <div class="script-info">
        <div class="script-name">${escapeHtml(name)}</div>
        <div class="script-command">${escapeHtml(command)}</div>
      </div>
      <div class="script-actions">
        <button class="btn-run" data-name="${escapeHtml(name)}">Run</button>
        <button class="btn-edit" data-name="${escapeHtml(name)}" data-command="${escapeHtml(command)}">Edit</button>
        <button class="btn-delete btn-danger" data-name="${escapeHtml(name)}">Remove</button>
      </div>
    `;
    
    listElement.appendChild(scriptItem);
    
    // Add event listeners for run, edit, and delete buttons
    scriptItem.querySelector('.btn-run').addEventListener('click', (e) => {
      const name = e.target.getAttribute('data-name');
      executeScript(name);
    });
    
    scriptItem.querySelector('.btn-edit').addEventListener('click', (e) => {
      const name = e.target.getAttribute('data-name');
      const command = e.target.getAttribute('data-command');
      showEditScriptModal(name, command);
    });
    
    scriptItem.querySelector('.btn-delete').addEventListener('click', (e) => {
      const name = e.target.getAttribute('data-name');
      showDeleteScriptConfirmation(name);
    });
  });
}

// Filter dependencies based on search query
function filterDependencies(query, type) {
  const items = document.querySelectorAll(`#${type === 'dependencies' ? 'dependencies-list' : 'dev-dependencies-list'} .dependency-item`);
  const lowerQuery = query.toLowerCase();
  
  items.forEach(item => {
    const name = item.querySelector('.dependency-name').textContent.toLowerCase();
    if (name.includes(lowerQuery)) {
      item.style.display = '';
    } else {
      item.style.display = 'none';
    }
  });
}

// Filter scripts based on search query
function filterScripts(query) {
  const items = document.querySelectorAll('#scripts-list .script-item');
  const lowerQuery = query.toLowerCase();
  
  items.forEach(item => {
    const name = item.querySelector('.script-name').textContent.toLowerCase();
    const command = item.querySelector('.script-command').textContent.toLowerCase();
    if (name.includes(lowerQuery) || command.includes(lowerQuery)) {
      item.style.display = '';
    } else {
      item.style.display = 'none';
    }
  });
}

// Show add dependency modal
function showAddDependencyModal() {
  const modalOverlay = document.getElementById('modal-overlay');
  const modalTitle = document.getElementById('modal-title');
  const modalContent = document.getElementById('modal-content');
  
  modalTitle.textContent = 'Add Dependency';
  
  modalContent.innerHTML = `
    <div class="form-group">
      <label for="dep-search">Search NPM Packages</label>
      <input type="text" id="dep-search" placeholder="Type to search...">
    </div>
    <div id="search-results" class="search-results"></div>
    <div class="form-group">
      <label for="dep-name">Package Name</label>
      <input type="text" id="dep-name" placeholder="e.g. react">
    </div>
    <div class="form-group">
      <label for="dep-version">Version</label>
      <input type="text" id="dep-version" placeholder="e.g. ^17.0.0">
    </div>
    <div class="form-group">
      <label for="dep-type">Dependency Type</label>
      <select id="dep-type">
        <option value="dependencies">Regular Dependency</option>
        <option value="devDependencies">Dev Dependency</option>
      </select>
    </div>
    <div class="form-actions">
      <button id="btn-add-dependency-confirm" class="btn-primary">Add</button>
      <button id="btn-add-dependency-cancel" class="btn-secondary">Cancel</button>
    </div>
  `;
  
  // Show the modal
  modalOverlay.classList.remove('hidden');
  
  // Set up event listeners
  document.getElementById('dep-search').addEventListener('input', (e) => {
    const query = e.target.value;
    if (query.length >= 2) {
      searchNpmPackages(query);
    }
  });
  
  document.getElementById('btn-add-dependency-confirm').addEventListener('click', () => {
    const name = document.getElementById('dep-name').value;
    const version = document.getElementById('dep-version').value;
    const type = document.getElementById('dep-type').value;
    
    if (name && version) {
      addDependency(name, version, type);
      closeModal();
    } else {
      showError('Please provide both package name and version');
    }
  });
  
  document.getElementById('btn-add-dependency-cancel').addEventListener('click', () => {
    closeModal();
  });
}

// Show edit dependency modal
function showEditDependencyModal(name, version, type) {
  const modalOverlay = document.getElementById('modal-overlay');
  const modalTitle = document.getElementById('modal-title');
  const modalContent = document.getElementById('modal-content');
  
  modalTitle.textContent = 'Edit Dependency';
  
  modalContent.innerHTML = `
    <div class="form-group">
      <label for="edit-dep-name">Package Name</label>
      <input type="text" id="edit-dep-name" value="${escapeHtml(name)}" readonly>
    </div>
    <div class="form-group">
      <label for="edit-dep-version">Version</label>
      <input type="text" id="edit-dep-version" value="${escapeHtml(version)}">
    </div>
    <div class="form-group">
      <label for="edit-dep-type">Dependency Type</label>
      <select id="edit-dep-type">
        <option value="dependencies" ${type === 'dependencies' ? 'selected' : ''}>Regular Dependency</option>
        <option value="devDependencies" ${type === 'devDependencies' ? 'selected' : ''}>Dev Dependency</option>
      </select>
    </div>
    <div class="form-actions">
      <button id="btn-edit-dependency-confirm" class="btn-primary">Update</button>
      <button id="btn-edit-dependency-cancel" class="btn-secondary">Cancel</button>
    </div>
  `;
  
  // Show the modal
  modalOverlay.classList.remove('hidden');
  
  // Set up event listeners
  document.getElementById('btn-edit-dependency-confirm').addEventListener('click', () => {
    const newVersion = document.getElementById('edit-dep-version').value;
    const newType = document.getElementById('edit-dep-type').value;
    
    if (newVersion) {
      editDependency(name, newVersion, type, newType);
      closeModal();
    } else {
      showError('Please provide version');
    }
  });
  
  document.getElementById('btn-edit-dependency-cancel').addEventListener('click', () => {
    closeModal();
  });
}

// Show delete dependency confirmation dialog
function showDeleteDependencyConfirmation(name, type) {
  const modalOverlay = document.getElementById('modal-overlay');
  const modalTitle = document.getElementById('modal-title');
  const modalContent = document.getElementById('modal-content');
  
  modalTitle.textContent = 'Confirm Deletion';
  
  modalContent.innerHTML = `
    <p>Are you sure you want to remove the package "${escapeHtml(name)}"?</p>
    <div class="form-actions">
      <button id="btn-delete-dependency-confirm" class="btn-danger">Delete</button>
      <button id="btn-delete-dependency-cancel" class="btn-secondary">Cancel</button>
    </div>
  `;
  
  // Show the modal
  modalOverlay.classList.remove('hidden');
  
  // Set up event listeners
  document.getElementById('btn-delete-dependency-confirm').addEventListener('click', () => {
    deleteDependency(name, type);
    closeModal();
  });
  
  document.getElementById('btn-delete-dependency-cancel').addEventListener('click', () => {
    closeModal();
  });
}

// Show add script modal
function showAddScriptModal() {
  const modalOverlay = document.getElementById('modal-overlay');
  const modalTitle = document.getElementById('modal-title');
  const modalContent = document.getElementById('modal-content');
  
  modalTitle.textContent = 'Add Script';
  
  modalContent.innerHTML = `
    <div class="form-group">
      <label for="script-name">Script Name</label>
      <input type="text" id="script-name" placeholder="e.g. start">
    </div>
    <div class="form-group">
      <label for="script-command">Command</label>
      <input type="text" id="script-command" placeholder="e.g. node server.js">
    </div>
    <div class="form-actions">
      <button id="btn-add-script-confirm" class="btn-primary">Add</button>
      <button id="btn-add-script-cancel" class="btn-secondary">Cancel</button>
    </div>
  `;
  
  // Show the modal
  modalOverlay.classList.remove('hidden');
  
  // Set up event listeners
  document.getElementById('btn-add-script-confirm').addEventListener('click', () => {
    const name = document.getElementById('script-name').value;
    const command = document.getElementById('script-command').value;
    
    if (name && command) {
      addScript(name, command);
      closeModal();
    } else {
      showError('Please provide both script name and command');
    }
  });
  
  document.getElementById('btn-add-script-cancel').addEventListener('click', () => {
    closeModal();
  });
}

// Show edit script modal
function showEditScriptModal(name, command) {
  const modalOverlay = document.getElementById('modal-overlay');
  const modalTitle = document.getElementById('modal-title');
  const modalContent = document.getElementById('modal-content');
  
  modalTitle.textContent = 'Edit Script';
  
  modalContent.innerHTML = `
    <div class="form-group">
      <label for="edit-script-name">Script Name</label>
      <input type="text" id="edit-script-name" value="${escapeHtml(name)}" readonly>
    </div>
    <div class="form-group">
      <label for="edit-script-command">Command</label>
      <input type="text" id="edit-script-command" value="${escapeHtml(command)}">
    </div>
    <div class="form-actions">
      <button id="btn-edit-script-confirm" class="btn-primary">Update</button>
      <button id="btn-edit-script-cancel" class="btn-secondary">Cancel</button>
    </div>
  `;
  
  // Show the modal
  modalOverlay.classList.remove('hidden');
  
  // Set up event listeners
  document.getElementById('btn-edit-script-confirm').addEventListener('click', () => {
    const newCommand = document.getElementById('edit-script-command').value;
    
    if (newCommand) {
      editScript(name, newCommand);
      closeModal();
    } else {
      showError('Please provide command');
    }
  });
  
  document.getElementById('btn-edit-script-cancel').addEventListener('click', () => {
    closeModal();
  });
}

// Show delete script confirmation dialog
function showDeleteScriptConfirmation(name) {
  const modalOverlay = document.getElementById('modal-overlay');
  const modalTitle = document.getElementById('modal-title');
  const modalContent = document.getElementById('modal-content');
  
  modalTitle.textContent = 'Confirm Deletion';
  
  modalContent.innerHTML = `
    <p>Are you sure you want to remove the script "${escapeHtml(name)}"?</p>
    <div class="form-actions">
      <button id="btn-delete-script-confirm" class="btn-danger">Delete</button>
      <button id="btn-delete-script-cancel" class="btn-secondary">Cancel</button>
    </div>
  `;
  
  // Show the modal
  modalOverlay.classList.remove('hidden');
  
  // Set up event listeners
  document.getElementById('btn-delete-script-confirm').addEventListener('click', () => {
    deleteScript(name);
    closeModal();
  });
  
  document.getElementById('btn-delete-script-cancel').addEventListener('click', () => {
    closeModal();
  });
}

// Close modal
function closeModal() {
  const modalOverlay = document.getElementById('modal-overlay');
  modalOverlay.classList.add('hidden');
}

// Update package.json from form input
function updatePackageJsonFromForm() {
  if (!packageJson) return;
  
  // Update basic info
  packageJson.name = document.getElementById('package-name').value;
  packageJson.version = document.getElementById('package-version').value;
  packageJson.description = document.getElementById('package-description').value;
  packageJson.author = document.getElementById('package-author').value;
  packageJson.license = document.getElementById('package-license').value;
  
  // Update keywords
  const keywordsText = document.getElementById('package-keywords').value;
  packageJson.keywords = keywordsText ? keywordsText.split(',').map(k => k.trim()) : [];
  
  // Send the updated package.json to the extension
  vscode.postMessage({
    command: 'updatePackageJson',
    packageJson
  });
}

// Add a new dependency
function addDependency(name, version, type) {
  if (!packageJson) return;
  
  // Initialize the dependency section if it doesn't exist
  if (!packageJson[type]) {
    packageJson[type] = {};
  }
  
  // Add the dependency
  packageJson[type][name] = version;
  
  // Send the updated package.json to the extension
  vscode.postMessage({
    command: 'updatePackageJson',
    packageJson
  });
  
  // Update the UI
  updateDependenciesList(type, packageJson[type]);
}

// Edit an existing dependency
function editDependency(name, newVersion, oldType, newType) {
  if (!packageJson) return;
  
  // Remove from old type if type is changing
  if (oldType !== newType) {
    if (packageJson[oldType] && packageJson[oldType][name]) {
      delete packageJson[oldType][name];
    }
    
    // Initialize the new type section if needed
    if (!packageJson[newType]) {
      packageJson[newType] = {};
    }
  }
  
  // Add to new type with new version
  packageJson[newType][name] = newVersion;
  
  // Send the updated package.json to the extension
  vscode.postMessage({
    command: 'updatePackageJson',
    packageJson
  });
  
  // Update the UI
  updateDependenciesList(oldType, packageJson[oldType] || {});
  if (oldType !== newType) {
    updateDependenciesList(newType, packageJson[newType] || {});
  }
}

// Delete a dependency
function deleteDependency(name, type) {
  if (!packageJson || !packageJson[type]) return;
  
  // Remove the dependency
  delete packageJson[type][name];
  
  // Send the updated package.json to the extension
  vscode.postMessage({
    command: 'updatePackageJson',
    packageJson
  });
  
  // Update the UI
  updateDependenciesList(type, packageJson[type]);
}

// Add a new script
function addScript(name, command) {
  if (!packageJson) return;
  
  // Initialize the scripts section if it doesn't exist
  if (!packageJson.scripts) {
    packageJson.scripts = {};
  }
  
  // Add the script
  packageJson.scripts[name] = command;
  
  // Send the updated package.json to the extension
  vscode.postMessage({
    command: 'updatePackageJson',
    packageJson
  });
  
  // Update the UI
  updateScriptsList(packageJson.scripts);
}

// Edit an existing script
function editScript(name, newCommand) {
  if (!packageJson || !packageJson.scripts) return;
  
  // Update the script
  packageJson.scripts[name] = newCommand;
  
  // Send the updated package.json to the extension
  vscode.postMessage({
    command: 'updatePackageJson',
    packageJson
  });
  
  // Update the UI
  updateScriptsList(packageJson.scripts);
}

// Delete a script
function deleteScript(name) {
  if (!packageJson || !packageJson.scripts) return;
  
  // Remove the script
  delete packageJson.scripts[name];
  
  // Send the updated package.json to the extension
  vscode.postMessage({
    command: 'updatePackageJson',
    packageJson
  });
  
  // Update the UI
  updateScriptsList(packageJson.scripts);
}

// Execute a script
function executeScript(scriptName) {
  vscode.postMessage({
    command: 'executeScript',
    script: scriptName
  });
}

// Search for packages in npm registry
function searchNpmPackages(query) {
  vscode.postMessage({
    command: 'searchNpmPackage',
    query
  });
  
  // Show loading state
  document.getElementById('search-results').innerHTML = '<div class="loading">Searching for packages...</div>';
  
  // Add a small delay to avoid too many requests
  clearTimeout(window.searchTimeout);
  window.searchTimeout = setTimeout(() => {
    // This is just to show the loading state for at least 300ms for UX
  }, 300);
}

// Update search results in UI
function updateSearchResults(results) {
  const resultsElement = document.getElementById('search-results');
  
  if (!results || results.length === 0) {
    resultsElement.innerHTML = '<div class="no-results">No packages found</div>';
    return;
  }
  
  // Clear previous results
  resultsElement.innerHTML = '';
  
  // Create a header with result count
  const resultHeader = document.createElement('div');
  resultHeader.className = 'result-header';
  resultHeader.textContent = `Found ${results.length} package${results.length > 1 ? 's' : ''}`;
  resultsElement.appendChild(resultHeader);
  
  // Create a container for the results
  const resultsContainer = document.createElement('div');
  resultsContainer.className = 'results-container';
  
  // Add each result
  results.forEach(pkg => {
    const resultItem = document.createElement('div');
    resultItem.className = 'search-result-item';
    
    // Format the description to handle potential null values or too long text
    const description = pkg.description 
      ? (pkg.description.length > 100 
          ? pkg.description.substring(0, 100) + '...' 
          : pkg.description)
      : 'No description available';
    
    resultItem.innerHTML = `
      <div class="result-name">${escapeHtml(pkg.name)} <span class="result-version">${escapeHtml(pkg.version)}</span></div>
      <div class="result-description">${escapeHtml(description)}</div>
      <div class="result-meta">
        <span class="result-author">${escapeHtml(pkg.author || '')}</span>
        <span class="result-date">${pkg.date ? new Date(pkg.date).toLocaleDateString() : ''}</span>
      </div>
    `;
    
    // Add event listener to select this package
    resultItem.addEventListener('click', () => {
      document.getElementById('dep-name').value = pkg.name;
      document.getElementById('dep-version').value = `^${pkg.version}`;
      
      // Add a visual feedback when a package is selected
      const selectedPackage = document.createElement('div');
      selectedPackage.className = 'selected-package';
      selectedPackage.innerHTML = `
        <div><strong>${escapeHtml(pkg.name)}@${escapeHtml(pkg.version)}</strong> selected</div>
        <button class="btn-clear-selection">Change</button>
      `;
      
      // Clear the results and show the selected package
      resultsElement.innerHTML = '';
      resultsElement.appendChild(selectedPackage);
      
      // Add event listener to the clear button
      selectedPackage.querySelector('.btn-clear-selection').addEventListener('click', (e) => {
        e.stopPropagation(); // Prevent triggering the parent's click event
        
        // Show the search input again
        document.getElementById('dep-search').value = '';
        resultsElement.innerHTML = '<div class="no-results">Search for packages</div>';
      });
    });
    
    resultsContainer.appendChild(resultItem);
  });
  
  resultsElement.appendChild(resultsContainer);
}

// Show an error message
function showError(message) {
  // In a real implementation, this would show a nice error notification
  console.error(message);
  alert(message);
}

// Show a notification message
function showNotification(message) {
  // In a real implementation, this would show a nice notification
  console.log(message);
}

// Show loading state
function showLoadingState() {
  const app = document.getElementById('app');
  if (!app) return;
  
  // Create loading overlay if it doesn't exist
  let loadingOverlay = document.getElementById('loading-overlay');
  if (!loadingOverlay) {
    loadingOverlay = document.createElement('div');
    loadingOverlay.id = 'loading-overlay';
    loadingOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: var(--vscode-editor-background);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
    `;
    loadingOverlay.innerHTML = `
      <div style="text-align: center;">
        <div style="margin-bottom: 16px; font-size: 16px;">Loading package.json...</div>
        <div class="spinner" style="
          border: 3px solid var(--vscode-editorWidget-border);
          border-top: 3px solid var(--vscode-progressBar-background);
          border-radius: 50%;
          width: 40px;
          height: 40px;
          animation: spin 1s linear infinite;
          margin: 0 auto;
        "></div>
      </div>
    `;
    app.appendChild(loadingOverlay);
    
    // Add spinner animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(style);
  }
  loadingOverlay.style.display = 'flex';
}

// Hide loading state
function hideLoadingState() {
  const loadingOverlay = document.getElementById('loading-overlay');
  if (loadingOverlay) {
    loadingOverlay.style.display = 'none';
  }
}

// HTML escape helper
function escapeHtml(unsafe) {
  return unsafe
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}