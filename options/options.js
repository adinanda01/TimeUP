// State
let domains = {};
let settings = {};
let isSaving = false; // Prevent multiple saves

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  await loadData();
  setupEventListeners();
  setupTabs();
  renderLimits();
  renderStats();
});

// Load data
async function loadData() {
  const data = await chrome.storage.local.get(['domains', 'settings']);
  domains = data.domains || {};
  settings = data.settings || {
    notificationsEnabled: true,
    idleDetectionEnabled: true,
    idleThreshold: 60 // Changed to match background.js
  };

  // Update UI with settings
  document.getElementById('notificationsEnabled').checked = settings.notificationsEnabled;
  document.getElementById('idleDetectionEnabled').checked = settings.idleDetectionEnabled;
  document.getElementById('idleThreshold').value = settings.idleThreshold;
}

// Domain validation
function isValidDomain(domain) {
  const domainRegex = /^(?!-)(?:[a-zA-Z0-9-]{1,63}(?<!-)\.)*[a-zA-Z]{2,}$/;
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
  return domainRegex.test(domain) || ipRegex.test(domain);
}

// Clean domain name
function cleanDomainName(domain) {
  let cleaned = domain
    .toLowerCase()
    .trim()
    .replace(/^(https?:\/\/)?(www\.)?/, '')
    .replace(/\/.*$/, '')
    .replace(/:\d+$/, '');
  
  if (!isValidDomain(cleaned)) {
    throw new Error('Invalid domain format');
  }
  
  return cleaned;
}

// Setup event listeners
function setupEventListeners() {
  // Tab buttons
  document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', () => switchTab(button.dataset.tab));
  });

  // General settings
  document.getElementById('saveSettings').addEventListener('click', saveGeneralSettings);

  // Data management
  document.getElementById('resetDaily').addEventListener('click', () => resetData('daily'));
  document.getElementById('resetWeekly').addEventListener('click', () => resetData('weekly'));
  document.getElementById('resetAll').addEventListener('click', () => resetData('all'));
  document.getElementById('exportData').addEventListener('click', exportData);
  document.getElementById('importData').addEventListener('change', importData);
  document.getElementById('importButton').addEventListener('click', () => {
    document.getElementById('importData').click();
  });

  // Limit modal
  document.getElementById('addNewLimit').addEventListener('click', showLimitModal);
  document.getElementById('modalCancel').addEventListener('click', hideLimitModal);
  document.getElementById('modalSave').addEventListener('click', saveNewLimit);
  
  // Enter key support in modal
  document.getElementById('modalDomain').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      document.getElementById('modalDailyLimit').focus();
    }
  });

  // Close modal on background click
  document.getElementById('limitModal').addEventListener('click', (e) => {
    if (e.target.id === 'limitModal') hideLimitModal();
  });
}

// Tab switching
function setupTabs() {
  const savedTab = localStorage.getItem('activeTab') || 'limits';
  switchTab(savedTab);
}

function switchTab(tabName) {
  // Update buttons
  document.querySelectorAll('.tab-button').forEach(button => {
    button.classList.toggle('active', button.dataset.tab === tabName);
  });

  // Update content
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.toggle('hidden', !content.id.startsWith(tabName));
  });

  localStorage.setItem('activeTab', tabName);
  
  // Refresh stats when switching to any tab
  renderStats();
}

// Render limits
function renderLimits() {
  const container = document.getElementById('limitsContainer');
  container.innerHTML = '';

  const sortedDomains = Object.entries(domains).sort((a, b) => {
    const aTime = Object.values(a[1].dailyTime || {}).reduce((sum, time) => sum + time, 0);
    const bTime = Object.values(b[1].dailyTime || {}).reduce((sum, time) => sum + time, 0);
    return bTime - aTime;
  });

  if (sortedDomains.length === 0) {
    container.innerHTML = '<p class="text-gray-500 text-center py-8">No websites tracked yet</p>';
    return;
  }

  sortedDomains.forEach(([domain, data]) => {
    const today = new Date().toDateString();
    const todayTime = data.dailyTime?.[today] || 0;
    const weekStart = getWeekStart();
    const weekTime = data.weeklyTime?.[weekStart] || 0;

    const card = document.createElement('div');
    card.className = 'bg-gray-50 rounded-lg p-4';
    card.dataset.domain = domain;

    card.innerHTML = `
      <div class="flex justify-between items-start mb-3">
        <div>
          <h3 class="font-medium text-lg">${domain}</h3>
          <div class="text-sm text-gray-600 mt-1">
            Today: ${formatTime(todayTime)} | This week: ${formatTime(weekTime)}
          </div>
          ${(data.limits?.daily && todayTime > data.limits.daily) ? 
            '<span class="text-xs text-red-600">⚠️ Daily limit exceeded</span>' : ''}
        </div>
        <button class="remove-domain text-red-500 hover:text-red-700" data-domain="${domain}" title="Remove domain">
          🗑️
        </button>
      </div>
      
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-sm text-gray-600">Daily Limit</label>
          <div class="flex items-center gap-2">
            <input type="number" 
                   class="daily-limit-input flex-1 px-2 py-1 border rounded text-sm"
                   data-domain="${domain}"
                   value="${data.limits?.daily ? data.limits.daily / 60 : ''}"
                   placeholder="No limit"
                   min="0"
                   max="1440">
            <span class="text-sm text-gray-500">min</span>
          </div>
        </div>
        <div>
          <label class="text-sm text-gray-600">Weekly Limit</label>
          <div class="flex items-center gap-2">
            <input type="number" 
                   class="weekly-limit-input flex-1 px-2 py-1 border rounded text-sm"
                   data-domain="${domain}"
                   value="${data.limits?.weekly ? data.limits.weekly / 60 : ''}"
                   placeholder="No limit"
                   min="0"
                   max="10080">
            <span class="text-sm text-gray-500">min</span>
          </div>
        </div>
      </div>
      
      <button class="save-limits mt-3 w-full px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
              data-domain="${domain}">
        Update Limits
      </button>
    `;

    container.appendChild(card);
  });

  // Add event listeners to dynamic elements
  container.querySelectorAll('.remove-domain').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const domain = e.target.dataset.domain;
      removeDomain(domain);
    });
  });

  container.querySelectorAll('.save-limits').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      if (isSaving) return;
      const domain = e.target.dataset.domain;
      await saveDomainLimits(domain, e.target);
    });
  });
  
  // Add input validation
  container.querySelectorAll('input[type="number"]').forEach(input => {
    input.addEventListener('input', (e) => {
      const value = parseInt(e.target.value);
      const max = parseInt(e.target.max);
      const min = parseInt(e.target.min);
      
      if (value > max) e.target.value = max;
      if (value < min && e.target.value !== '') e.target.value = min;
    });
  });
}

// Save domain limits with loading state
async function saveDomainLimits(domain, buttonElement) {
  if (isSaving) return;
  isSaving = true;
  
  const originalText = buttonElement.textContent;
  buttonElement.textContent = 'Saving...';
  buttonElement.disabled = true;
  
  try {
    const dailyInput = document.querySelector(`.daily-limit-input[data-domain="${domain}"]`);
    const weeklyInput = document.querySelector(`.weekly-limit-input[data-domain="${domain}"]`);

    const dailyMinutes = parseInt(dailyInput.value) || 0;
    const weeklyMinutes = parseInt(weeklyInput.value) || 0;
    
    // Validate
    if (dailyMinutes < 0 || dailyMinutes > 1440) {
      throw new Error('Daily limit must be between 0-1440 minutes');
    }
    
    if (weeklyMinutes < 0 || weeklyMinutes > 10080) {
      throw new Error('Weekly limit must be between 0-10080 minutes');
    }
    
    if (weeklyMinutes > 0 && dailyMinutes > 0 && weeklyMinutes < dailyMinutes) {
      throw new Error('Weekly limit cannot be less than daily limit');
    }

    domains[domain].limits = {
      daily: dailyMinutes * 60,
      weekly: weeklyMinutes * 60
    };

    await chrome.storage.local.set({ domains });
    showNotification('Limits updated successfully!', 'success');
    
       // Force sync with background
    await chrome.runtime.sendMessage({ action: 'forceSync' });
    
  } catch (error) {
    showNotification(error.message || 'Failed to save limits', 'error');
  } finally {
    buttonElement.textContent = originalText;
    buttonElement.disabled = false;
    isSaving = false;
  }
}

// Remove domain
async function removeDomain(domain) {
  if (!confirm(`Remove ${domain} and all its data?`)) return;

  delete domains[domain];
  await chrome.storage.local.set({ domains });
  renderLimits();
  renderStats();
  showNotification('Domain removed', 'success');
}

// Render stats
async function renderStats() {
  const container = document.getElementById('statsContainer');

  const today = new Date().toDateString();
  const weekStart = getWeekStart();

  let todayTotal = 0;
  let weekTotal = 0;
  let domainCount = Object.keys(domains).length;

  for (const data of Object.values(domains)) {
    todayTotal += data.dailyTime?.[today] || 0;
    weekTotal += data.weeklyTime?.[weekStart] || 0;
  }

  container.innerHTML = `
    <div class="text-center p-4 bg-blue-50 rounded-lg">
      <div class="text-2xl font-bold text-blue-600">${formatTime(todayTotal)}</div>
      <div class="text-sm text-gray-600">Today</div>
    </div>
    <div class="text-center p-4 bg-purple-50 rounded-lg">
      <div class="text-2xl font-bold text-purple-600">${formatTime(weekTotal)}</div>
      <div class="text-sm text-gray-600">This Week</div>
    </div>
    <div class="text-center p-4 bg-green-50 rounded-lg">
      <div class="text-2xl font-bold text-green-600">${domainCount}</div>
      <div class="text-sm text-gray-600">Domains</div>
    </div>
  `;
}

// Save general settings with validation
async function saveGeneralSettings() {
  const button = document.getElementById('saveSettings');
  const originalText = button.textContent;
  
  button.disabled = true;
  button.textContent = 'Saving...';
  
  try {
    const idleThreshold = parseInt(document.getElementById('idleThreshold').value);
    
    // Validate idle threshold
    if (idleThreshold < 10 || idleThreshold > 300) {
      throw new Error('Idle threshold must be between 10-300 seconds');
    }
    
    settings = {
      notificationsEnabled: document.getElementById('notificationsEnabled').checked,
      idleDetectionEnabled: document.getElementById('idleDetectionEnabled').checked,
      idleThreshold: idleThreshold
    };

    await chrome.storage.local.set({ settings });
    
    // Notify background script to update settings
    await chrome.runtime.sendMessage({ action: 'updateSettings' });
    
    showNotification('Settings saved!', 'success');
  } catch (error) {
    showNotification(error.message || 'Failed to save settings', 'error');
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

// Reset data
async function resetData(type) {
  const confirmMsg = type === 'all'
    ? 'This will delete ALL tracking data. Are you sure?'
    : `Reset ${type} data?`;

  if (!confirm(confirmMsg)) return;

  const today = new Date().toDateString();
  const weekStart = getWeekStart();

  if (type === 'all') {
    domains = {};
  } else {
    for (const domain in domains) {
      if (type === 'daily' && domains[domain].dailyTime) {
        domains[domain].dailyTime[today] = 0;
      } else if (type === 'weekly' && domains[domain].weeklyTime) {
        domains[domain].weeklyTime[weekStart] = 0;
      }
    }
  }

  await chrome.storage.local.set({ domains });
  await loadData();
  renderLimits();
  renderStats();
  showNotification(`${type.charAt(0).toUpperCase() + type.slice(1)} data reset successfully`, 'success');
}

// Export data
async function exportData() {
  const button = document.getElementById('exportData');
  button.disabled = true;
  button.textContent = 'Exporting...';
  
  try {
    const exportObj = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      domains,
      settings
    };

    const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `timeup-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);

    showNotification('Data exported successfully', 'success');
  } finally {
    button.disabled = false;
    button.textContent = 'Export All Data';
  }
}

// Import data with better validation
async function importData(event) {
  const file = event.target.files[0];
  if (!file) return;

  const button = document.getElementById('importButton');
  button.disabled = true;
  button.textContent = 'Importing...';

  try {
    const text = await file.text();
    const data = JSON.parse(text);

    // Validate structure
    if (!data.version || !data.domains || typeof data.domains !== 'object') {
      throw new Error('Invalid file format');
    }
    
    // Validate domains structure
    for (const [domain, domainData] of Object.entries(data.domains)) {
      if (!domainData.dailyTime || !domainData.weeklyTime || 
          typeof domainData.totalTime !== 'number') {
        throw new Error(`Invalid data structure for domain: ${domain}`);
      }
    }

    if (confirm('This will replace all current data. Continue?')) {
      domains = data.domains;
      if (data.settings) settings = data.settings;

      await chrome.storage.local.set({ domains, settings });
      await loadData();
      renderLimits();
      renderStats();

      showNotification('Data imported successfully', 'success');
    }
  } catch (error) {
    showNotification('Failed to import: ' + error.message, 'error');
  } finally {
    button.disabled = false;
    button.textContent = 'Import Data';
    event.target.value = '';
  }
}

// Modal functions
function showLimitModal() {
  document.getElementById('limitModal').classList.remove('hidden');
  document.getElementById('limitModal').classList.add('flex');
  document.getElementById('modalDomain').focus();
}

function hideLimitModal() {
  document.getElementById('limitModal').classList.add('hidden');
  document.getElementById('limitModal').classList.remove('flex');

  // Clear inputs
  document.getElementById('modalDomain').value = '';
  document.getElementById('modalDailyLimit').value = '';
  document.getElementById('modalWeeklyLimit').value = '';
}

async function saveNewLimit() {
  const saveBtn = document.getElementById('modalSave');
  const originalText = saveBtn.textContent;
  
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving...';
  
  try {
    const domainInput = document.getElementById('modalDomain').value.trim();
    const dailyLimit = parseInt(document.getElementById('modalDailyLimit').value) || 0;
    const weeklyLimit = parseInt(document.getElementById('modalWeeklyLimit').value) || 0;

    // Validate domain
    const domain = cleanDomainName(domainInput);

    // Validate limits
    if (dailyLimit < 0 || dailyLimit > 1440) {
      throw new Error('Daily limit must be between 0-1440 minutes');
    }
    
    if (weeklyLimit < 0 || weeklyLimit > 10080) {
      throw new Error('Weekly limit must be between 0-10080 minutes');
    }
    
    if (weeklyLimit > 0 && dailyLimit > 0 && weeklyLimit < dailyLimit) {
      throw new Error('Weekly limit cannot be less than daily limit');
    }

    if (!domains[domain]) {
      domains[domain] = {
        dailyTime: {},
        weeklyTime: {},
        totalTime: 0,
        limits: {}
      };
    }

    domains[domain].limits = {
      daily: dailyLimit * 60,
      weekly: weeklyLimit * 60
    };

    await chrome.storage.local.set({ domains });
    hideLimitModal();
    renderLimits();
    showNotification('Limit added successfully', 'success');
  } catch (error) {
    showNotification(error.message || 'Failed to add limit', 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = originalText;
  }
}

// Utility functions
function getWeekStart(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d.toDateString();
}

function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
}

function showNotification(message, type = 'info') {
  // Remove existing notifications
  document.querySelectorAll('.notification').forEach(n => n.remove());
  
  const notification = document.createElement('div');
  notification.className = `notification fixed top-4 right-4 px-6 py-3 rounded-lg text-white shadow-lg z-50 ${
    type === 'error' ? 'bg-red-500' : type === 'success' ? 'bg-green-500' : 'bg-blue-500'
  }`;
  notification.textContent = message;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transform = 'translateY(-20px)';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}
