// State management
let updateInterval = null;
let currentSessionData = null;

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
  await initializePopup();
});

// Initialize all popup components
async function initializePopup() {
  try {
    // Update datetime
    updateDateTime();
    setInterval(updateDateTime, 1000);
    
    // Load initial data
    await updateCurrentSession();
    await loadTodayStats();
    
    // Setup event listeners
    setupEventListeners();
    
    // Start session update interval
    updateInterval = setInterval(updateCurrentSession, 1000);
    
  } catch (error) {
    console.error('Error initializing popup:', error);
    showError('Failed to initialize');
  }
}

// Setup all event listeners
// Setup all event listeners
function setupEventListeners() {
  // Quick add limit form
  const addLimitBtn = document.getElementById('addLimitBtn');
  const quickDomain = document.getElementById('quickDomain');
  const quickLimit = document.getElementById('quickLimit');
  
  if (addLimitBtn) {
    addLimitBtn.addEventListener('click', handleAddLimit);
  }
  
  // Enter key support
  if (quickDomain) {
    quickDomain.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        quickLimit.focus();
      }
    });
  }
  
  if (quickLimit) {
    quickLimit.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddLimit();
      }
    });
  }
  
  // Navigation buttons - CORRECTED IDs
  const settingsBtn = document.getElementById('settingsBtn');
  const reportBtn = document.getElementById('reportBtn');
  
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      chrome.runtime.openOptionsPage();
    });
  }
  
  if (reportBtn) {
    reportBtn.addEventListener('click', () => {
      chrome.tabs.create({ url: chrome.runtime.getURL('report/report.html') });
    });
  }
  
  // Keyboard shortcuts
  document.addEventListener('keydown', handleKeyboardShortcuts);
}

// Handle keyboard shortcuts
function handleKeyboardShortcuts(e) {
  // Alt + S for settings
  if (e.altKey && e.key === 's') {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  }
  
  // Alt + R for report
  if (e.altKey && e.key === 'r') {
    e.preventDefault();
    chrome.tabs.create({ url: chrome.runtime.getURL('report/report.html') });
  }
}

// Update date and time display
function updateDateTime() {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric' 
  });
  const timeStr = now.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit',
    hour12: true 
  });
  
  document.getElementById('currentDateTime').textContent = `${dateStr} • ${timeStr}`;
}

// Update current session display
// Update current session display
async function updateCurrentSession() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getCurrentSession' });
    const container = document.getElementById('currentSession');
    
    if (response && response.domain && response.seconds !== undefined) {
      currentSessionData = response;
      
      // Only update display time if not idle
      const displayTime = response.isIdle ? 
        `${formatTime(response.seconds)} (Paused)` : 
        formatTime(response.seconds);
      
      const statusClass = response.isIdle ? 'status-idle' : 'status-active';
      const statusText = response.isIdle ? 'Idle - Not Tracking' : 'Active - Tracking';
      const statusIcon = response.isIdle ? '⏸️' : '▶️';
      
      container.innerHTML = `
        <div class="session-info ${response.isIdle ? 'session-idle' : ''}">
          <div class="session-header">
            <div class="session-domain">
              <span class="status-indicator ${statusClass}" title="${statusText}">
                ${statusIcon}
              </span>
              <span class="domain-name" title="${response.domain}">${response.domain}</span>
            </div>
            <div class="session-time ${response.isIdle ? 'time-paused' : ''}">${displayTime}</div>
          </div>
          ${response.mediaPlaying ? '<div class="media-indicator">🎵 Media playing</div>' : ''}
          ${response.isIdle ? '<div class="idle-notice">⏸️ Tracking paused due to inactivity</div>' : ''}
        </div>
      `;
      
      // Stop updating if idle
      if (response.isIdle && updateInterval) {
        clearInterval(updateInterval);
        updateInterval = setInterval(updateCurrentSession, 5000); // Check less frequently when idle
      } else if (!response.isIdle && updateInterval) {
        clearInterval(updateInterval);
        updateInterval = setInterval(updateCurrentSession, 1000); // Update every second when active
      }
    } else {
      currentSessionData = null;
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">⏸️</div>
          <div class="empty-text">No active session</div>
        </div>
      `;
    }
  } catch (error) {
    console.error('Error updating session:', error);
    document.getElementById('currentSession').innerHTML = `
      <div class="error-state">
        <div class="error-icon">⚠️</div>
        <div class="error-text">Error loading session</div>
      </div>
    `;
  }
}

// Load and display today's statistics
async function loadTodayStats() {
  try {
    const today = new Date().toDateString();
    const data = await chrome.storage.local.get(['domains']);
    const domains = data.domains || {};
    
    // Calculate today's data
    const todayData = [];
    let totalSeconds = 0;
    
    for (const [domain, info] of Object.entries(domains)) {
      const todayTime = info.dailyTime?.[today] || 0;
      if (todayTime > 0) {
        todayData.push({ 
          domain, 
          seconds: todayTime, 
          limits: info.limits || { daily: 0, weekly: 0 }
        });
        totalSeconds += todayTime;
      }
    }
    
    // Sort by time spent (descending)
    todayData.sort((a, b) => b.seconds - a.seconds);
    
    // Update total time
    document.getElementById('totalTimeToday').textContent = 
      totalSeconds > 0 ? formatTime(totalSeconds) : '--';
    
    // Update sites list
    const container = document.getElementById('topSitesToday');
    
    if (todayData.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📊</div>
          <div class="empty-text">No activity tracked today</div>
          <div class="empty-subtext">Start browsing to see your stats</div>
        </div>
      `;
      return;
    }
    
    // Display top 5 sites
    container.innerHTML = '';
    const topSites = todayData.slice(0, 5);
    
    topSites.forEach((site) => {
      const percentage = Math.round((site.seconds / totalSeconds) * 100);
      const isOverLimit = site.limits.daily > 0 && site.seconds > site.limits.daily;
      const limitProgress = site.limits.daily > 0 
        ? Math.min(100, Math.round((site.seconds / site.limits.daily) * 100))
        : 0;
      
      const siteElement = document.createElement('div');
      siteElement.className = 'site-item';
      
      siteElement.innerHTML = `
        <div class="site-progress" style="width: ${percentage}%"></div>
        <div class="site-content">
          <div class="site-info">
            <span class="site-domain ${isOverLimit ? 'over-limit' : ''}" title="${site.domain}">
              ${site.domain}
            </span>
            ${isOverLimit ? '<span class="limit-warning" title="Over daily limit">⚠️</span>' : ''}
          </div>
          <div class="site-stats">
            <span class="site-time">${formatTime(site.seconds)}</span>
            <span class="site-percentage">${percentage}%</span>
          </div>
        </div>
        ${site.limits.daily > 0 ? `
          <div class="limit-indicator" title="${formatTime(site.seconds)} / ${formatTime(site.limits.daily)}">
            <div class="limit-bar">
              <div class="limit-progress ${isOverLimit ? 'over-limit' : ''}" style="width: ${limitProgress}%"></div>
            </div>
          </div>
        ` : ''}
      `;
      
      container.appendChild(siteElement);
    });
    
    // Add "view all" link if there are more sites
    if (todayData.length > 5) {
      const viewAllLink = document.createElement('div');
      viewAllLink.className = 'view-all-link';
      viewAllLink.innerHTML = `
        <a href="#" id="viewAllSites">View all ${todayData.length} sites →</a>
      `;
      container.appendChild(viewAllLink);
      
      document.getElementById('viewAllSites').addEventListener('click', (e) => {
        e.preventDefault();
        chrome.tabs.create({ url: chrome.runtime.getURL('report/report.html') });
      });
    }
    
  } catch (error) {
    console.error('Error loading stats:', error);
    document.getElementById('topSitesToday').innerHTML = `
      <div class="error-state">
        <div class="error-icon">⚠️</div>
        <div class="error-text">Error loading stats</div>
      </div>
    `;
  }
}

// Handle adding quick limit
// Validate domain name
function isValidDomain(domain) {
  // Basic domain validation regex
  const domainRegex = /^(?!-)(?:[a-zA-Z0-9-]{1,63}(?<!-)\.)*[a-zA-Z]{2,}$/;
  return domainRegex.test(domain);
}

// Clean and validate domain name
function cleanDomainName(domain) {
  // Remove protocol, www, and trailing parts
  let cleaned = domain
    .toLowerCase()
    .trim()
    .replace(/^(https?:\/\/)?(www\.)?/, '')
    .replace(/\/.*$/, '')
    .replace(/:\d+$/, ''); // Remove port numbers
  
  // If it's an IP address, keep it as is
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipRegex.test(cleaned)) {
    return cleaned;
  }
  
  // Validate domain format
  if (!isValidDomain(cleaned)) {
    throw new Error('Invalid domain format');
  }
  
  return cleaned;
}

// Update handleAddLimit function
async function handleAddLimit() {
  const domainInput = document.getElementById('quickDomain');
  const limitInput = document.getElementById('quickLimit');
  const addButton = document.getElementById('addLimitBtn');
  
  const domain = domainInput.value.trim();
  const minutes = parseInt(limitInput.value);
  
  // Clear any previous errors
  domainInput.classList.remove('input-error');
  limitInput.classList.remove('input-error');
  
  // Validation
  if (!domain) {
    showNotification('Please enter a domain', 'error');
    domainInput.classList.add('input-error');
    domainInput.focus();
    return;
  }
  
  if (!minutes || minutes < 1 || minutes > 1440) {
    showNotification('Please enter minutes between 1-1440 (24 hours)', 'error');
    limitInput.classList.add('input-error');
    limitInput.focus();
    return;
  }
  
  // Show loading state
  addButton.disabled = true;
  addButton.textContent = '...';
  
  try {
    // Clean and validate domain
    const cleanDomain = cleanDomainName(domain);
    
    // Check if this domain is currently active
    if (currentSessionData && currentSessionData.domain === cleanDomain) {
      showNotification('Limit applied to current session!', 'info');
    }
    
    // Load existing data
    const data = await chrome.storage.local.get(['domains']);
    const domains = data.domains || {};
    
    // Initialize domain if doesn't exist
    if (!domains[cleanDomain]) {
      domains[cleanDomain] = {
        dailyTime: {},
        weeklyTime: {},
        totalTime: 0,
        limits: { daily: 0, weekly: 0 }
      };
    }
    
    // Set daily limit (convert minutes to seconds)
    domains[cleanDomain].limits.daily = minutes * 60;
    
    // Save to storage
    await chrome.storage.local.set({ domains });
    
    // Clear inputs
    domainInput.value = '';
    limitInput.value = '';
    domainInput.classList.remove('input-error');
    limitInput.classList.remove('input-error');
    
    // Show success notification
    showNotification(`Daily limit set: ${cleanDomain} (${minutes} min)`, 'success');
    
    // Reload stats to reflect changes
    await loadTodayStats();
    
    // Focus back to domain input
    domainInput.focus();
    
  } catch (error) {
    console.error('Error setting limit:', error);
    showNotification(error.message || 'Failed to set limit', 'error');
    domainInput.classList.add('input-error');
  } finally {
    // Reset button state
    addButton.disabled = false;
    addButton.textContent = 'Add';
  }
}

// Clean domain name (remove protocol, www, trailing slash)
function cleanDomainName(domain) {
  return domain
    .toLowerCase()
    .replace(/^(https?:\/\/)?(www\.)?/, '')
    .replace(/\/.*$/, '')
    .trim();
}

// Show notification
function showNotification(message, type = 'info') {
  // Remove any existing notifications
  const existingNotifications = document.querySelectorAll('.notification');
  existingNotifications.forEach(el => el.remove());
  
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  
  // Add icon based on type
  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
  };
  
  notification.innerHTML = `
    <span class="notification-icon">${icons[type] || icons.info}</span>
    <span class="notification-message">${message}</span>
  `;
  
  // Add to body
  document.body.appendChild(notification);
  
  // Animate in
  requestAnimationFrame(() => {
    notification.classList.add('notification-show');
  });
  
  // Auto remove after 3 seconds
  setTimeout(() => {
    notification.classList.add('notification-hide');
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// Format time for display
function formatTime(seconds) {
  if (!seconds || seconds < 0) return '0s';
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  } else if (minutes > 0) {
    return secs > 0 ? `${minutes}m ${secs}s` : `${minutes}m`;
  } else {
    return `${secs}s`;
  }
}

// Show error message in UI
function showError(message) {
  const container = document.getElementById('currentSession');
  container.innerHTML = `
    <div class="error-state">
      <div class="error-icon">❌</div>
      <div class="error-text">${message}</div>
    </div>
  `;
}

// Clean up when popup closes
window.addEventListener('unload', () => {
  if (updateInterval) {
    clearInterval(updateInterval);
  }
});

// Add focus management for better UX
document.addEventListener('DOMContentLoaded', () => {
  // Auto-focus domain input when popup opens
  setTimeout(() => {
    const domainInput = document.getElementById('quickDomain');
    if (domainInput) {
      domainInput.focus();
    }
  }, 100);
});

// Debug logging
if (chrome.runtime.getManifest().version_name?.includes('dev')) {
  console.log('TimeUP popup loaded', {
    version: chrome.runtime.getManifest().version,
    timestamp: new Date().toISOString()
  });
}
