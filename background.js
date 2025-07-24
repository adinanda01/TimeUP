// State management
let activeTabId = null;
let activeDomain = null;
let sessionStartTime = null;
let lastSaveTime = null;
let isIdle = false;
let idleStartTime = null;
let lastActivityTime = null;
let mediaPlaying = false;
let windowFocused = true;
// Track which tabs have content script injected
const injectedTabs = new Set();
let lastContentScriptResponse = null;

// Configuration
// Configuration
const IDLE_THRESHOLD = 60; // 1 minute for initial idle detection
const EXTENDED_IDLE_THRESHOLD = 300; // 5 minutes for extended idle
const MEDIA_IDLE_THRESHOLD = 1800; // 30 minutes for media playback
const SAVE_INTERVAL = 5; // save every 5 seconds (changed from 1)
const NOTIFICATION_COOLDOWN = 3600000; // 1 hour in ms
const ACTIVITY_CHECK_INTERVAL = 5000; // Check activity every 5 seconds (changed from 1000)
const CONTENT_SCRIPT_TIMEOUT = 500; // 500ms timeout for content script response

// Track notification times to prevent spam
const notificationTimes = new Map();

// Activity tracking
let activityCheckTimer = null;
let saveTimer = null;

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  initializeStorage();
  setupAlarms();
  setupIdleDetection();
  startSaveTimer();
  setupWindowFocusTracking();
});

// Track window focus
function setupWindowFocusTracking() {
  chrome.windows.onFocusChanged.addListener((windowId) => {
    windowFocused = windowId !== chrome.windows.WINDOW_ID_NONE;
    console.log('Window focus changed:', windowFocused);
    
    if (!windowFocused && activeDomain && !isIdle) {
      // Window lost focus - start idle timer
      console.log('Window lost focus - may go idle soon');
    } else if (windowFocused && isIdle) {
      // Window regained focus
      checkIfShouldResumeFromIdle();
    }
  });
}

// Initialize storage structure
async function initializeStorage() {
  const data = await chrome.storage.local.get(['settings', 'domains']);
  if (!data.settings) {
    await chrome.storage.local.set({
      settings: {
        notificationsEnabled: true,
        idleDetectionEnabled: true,
        idleThreshold: IDLE_THRESHOLD,
        mediaIdleThreshold: MEDIA_IDLE_THRESHOLD
      }
    });
  }
  if (!data.domains) {
    await chrome.storage.local.set({ domains: {} });
  }
}

// Start save timer
function startSaveTimer() {
  if (saveTimer) {
    clearInterval(saveTimer);
  }
  
  saveTimer = setInterval(async () => {
    await saveCurrentSession();
  }, SAVE_INTERVAL * 1000);
}

// Setup alarms for periodic tasks
function setupAlarms() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  
  chrome.alarms.create('dailyReset', {
    when: midnight.getTime(),
    periodInMinutes: 1440
  });
  
  const daysUntilMonday = (8 - now.getDay()) % 7 || 7;
  const nextMonday = new Date(now);
  nextMonday.setDate(now.getDate() + daysUntilMonday);
  nextMonday.setHours(0, 0, 0, 0);
  
  chrome.alarms.create('weeklyReset', {
    when: nextMonday.getTime(),
    periodInMinutes: 10080
  });
}

// Setup idle detection using chrome.idle API
function setupIdleDetection() {
  // Set detection interval to 1 minute
  chrome.idle.setDetectionInterval(60);
  
  chrome.idle.onStateChanged.addListener((newState) => {
    console.log('Chrome idle state changed:', newState);
    
    if (newState === 'idle' || newState === 'locked') {
      // System is idle or locked
      handleSystemIdle();
    } else if (newState === 'active') {
      // System is active again
      checkIfShouldResumeFromIdle();
    }
  });
}

// Handle system idle
function handleSystemIdle() {
  if (!isIdle && activeDomain && sessionStartTime) {
    console.log('System idle detected, pausing session for:', activeDomain);
    handleIdleState();
  }
}

// Check if we should resume from idle
async function checkIfShouldResumeFromIdle() {
  if (isIdle && activeTabId) {
    try {
      // Check if the tab is still active and get fresh activity data
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs.length > 0 && tabs[0].id === activeTabId) {
        // Tab is still active, check for recent activity
        const response = await sendMessageWithTimeout(activeTabId, { action: 'checkActivity' }, CONTENT_SCRIPT_TIMEOUT);
        
        if (response && response.lastActivity) {
          const timeSinceActivity = Date.now() - response.lastActivity;
          if (timeSinceActivity < IDLE_THRESHOLD * 1000) {
            // Recent activity detected
            handleActiveState();
          }
        }
      }
    } catch (error) {
      console.log('Error checking activity on resume:', error);
    }
  }
}

// Send message with timeout
function sendMessageWithTimeout(tabId, message, timeout) {
  return new Promise((resolve) => {
    let timeoutId;
    
    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
    
    timeoutId = setTimeout(() => {
      console.log('Content script response timeout');
      resolve(null);
    }, timeout);
    
    chrome.tabs.sendMessage(tabId, message, (response) => {
      cleanup();
      if (chrome.runtime.lastError) {
        console.log('Content script error:', chrome.runtime.lastError.message);
        resolve(null);
      } else {
        resolve(response);
      }
    });
  });
}

// Handle idle state
function handleIdleState() {
  if (!isIdle && activeDomain && sessionStartTime) {
    console.log('Going idle, pausing session for:', activeDomain);
    saveCurrentSession();
    isIdle = true;
    idleStartTime = Date.now();
  }
}

// Handle active state
function handleActiveState() {
  if (isIdle) {
    console.log('Resuming from idle');
    isIdle = false;
    
    if (activeDomain && sessionStartTime && idleStartTime) {
      const idleDuration = Date.now() - idleStartTime;
      console.log(`Was idle for ${Math.round(idleDuration / 1000)}s`);
      
      // Update timing
      lastSaveTime = Date.now();
      lastActivityTime = Date.now();
    }
    
    idleStartTime = null;
  }
}

// Tab event listeners
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  await saveCurrentSession();
  const tab = await chrome.tabs.get(activeInfo.tabId);
  startNewSession(tab);
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Clear injection tracking on navigation
  if (changeInfo.status === 'loading' && changeInfo.url) {
    injectedTabs.delete(tabId);
  }
  
  if (tab.active && changeInfo.status === 'complete') {
    await saveCurrentSession();
    startNewSession(tab);
  }
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  if (tabId === activeTabId) {
    await saveCurrentSession();
    clearSession();
  }
  // Clean up injection tracking
  injectedTabs.delete(tabId);
});

// Start new session
function startNewSession(tab) {
  if (!tab || !tab.url) {
    clearSession();
    return;
  }
  
  try {
    const url = new URL(tab.url);
    if (url.protocol === 'chrome:' || url.protocol === 'chrome-extension:' || 
        url.protocol === 'edge:' || url.protocol === 'about:') {
      clearSession();
      return;
    }
    
    clearSession();
    
    activeDomain = url.hostname;
    activeTabId = tab.id;
    sessionStartTime = Date.now();
    lastSaveTime = Date.now();
    lastActivityTime = Date.now();
    isIdle = false;
    idleStartTime = null;
    mediaPlaying = false;
    lastContentScriptResponse = Date.now();
    
    console.log('Started session for:', activeDomain);
    
    startActivityMonitoring();
    injectContentScript(tab.id);
    
  } catch (e) {
    console.error('Invalid URL:', e);
    clearSession();
  }
}

// Inject content script
// Inject content script
async function injectContentScript(tabId) {
  try {
    // Check if already injected
    if (injectedTabs.has(tabId)) {
      console.log('Content script already injected for tab:', tabId);
      return;
    }
    
    // Try to inject
    await chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content.js']
    });
    
    // Mark as injected
    injectedTabs.add(tabId);
    console.log('Content script injected for tab:', tabId);
    
  } catch (error) {
    // Content script might not be injectable (chrome:// pages, etc.)
    console.log('Content script injection skipped:', error.message);
  }
}

// Start activity monitoring
function startActivityMonitoring() {
  if (activityCheckTimer) {
    clearInterval(activityCheckTimer);
  }
  
  activityCheckTimer = setInterval(async () => {
    if (!activeDomain || !sessionStartTime || !activeTabId) return;
    
    try {
      // First check if window is focused
      if (!windowFocused) {
        const timeSinceLastActivity = Date.now() - lastActivityTime;
        if (timeSinceLastActivity > IDLE_THRESHOLD * 1000 && !isIdle) {
          console.log('Window not focused and no activity for', Math.round(timeSinceLastActivity / 1000), 'seconds');
          handleIdleState();
        }
        return;
      }
      
      // Check if tab is still active
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (tabs.length === 0 || tabs[0].id !== activeTabId) {
        // Tab is no longer active
        await saveCurrentSession();
        clearSession();
        return;
      }
      
      // Get activity from content script with timeout
      const response = await sendMessageWithTimeout(activeTabId, { action: 'checkActivity' }, CONTENT_SCRIPT_TIMEOUT);
      
      if (response) {
        lastContentScriptResponse = Date.now();
        const timeSinceActivity = Date.now() - response.lastActivity;
        const threshold = response.mediaPlaying ? MEDIA_IDLE_THRESHOLD : IDLE_THRESHOLD;
        
        mediaPlaying = response.mediaPlaying;
        
                if (response.isVisible && timeSinceActivity < threshold * 1000) {
          // User is active
          lastActivityTime = Date.now();
          if (isIdle) {
            handleActiveState();
          }
        } else if (!response.isVisible || timeSinceActivity > threshold * 1000) {
          // User is inactive
          if (!isIdle) {
            console.log('User inactive for', Math.round(timeSinceActivity / 1000), 'seconds');
            handleIdleState();
          }
        }
      } else {
        // No response from content script
        const timeSinceLastResponse = Date.now() - lastContentScriptResponse;
        const timeSinceLastActivity = Date.now() - lastActivityTime;
        
        // If we haven't heard from content script for a while and no recent activity
        if (timeSinceLastResponse > 30000 && timeSinceLastActivity > IDLE_THRESHOLD * 1000 && !isIdle) {
          console.log('No content script response and no activity for', Math.round(timeSinceLastActivity / 1000), 'seconds');
          handleIdleState();
        }
      }
      
      // Also check system idle state periodically
      chrome.idle.queryState(IDLE_THRESHOLD, (state) => {
        if (state === 'idle' || state === 'locked') {
          if (!isIdle) {
            console.log('System idle state detected:', state);
            handleIdleState();
          }
        }
      });
      
    } catch (error) {
      console.error('Error checking activity:', error);
    }
  }, ACTIVITY_CHECK_INTERVAL);
}

// Clear session
// Clear session
function clearSession() {
  if (activityCheckTimer) {
    clearInterval(activityCheckTimer);
    activityCheckTimer = null;
  }
  
  // Clear injection tracking for current tab
  if (activeTabId) {
    injectedTabs.delete(activeTabId);
  }
  
  activeDomain = null;
  activeTabId = null;
  sessionStartTime = null;
  lastSaveTime = null;
  lastActivityTime = null;
  isIdle = false;
  idleStartTime = null;
  mediaPlaying = false;
  lastContentScriptResponse = null;
}

// Save current session
async function saveCurrentSession() {
  if (!activeDomain || !sessionStartTime || isIdle) {
    return;
  }
  
  const now = Date.now();
  const secondsSinceLastSave = lastSaveTime ? Math.floor((now - lastSaveTime) / 1000) : 0;
  
  if (secondsSinceLastSave < 1) return;
  
  const today = new Date().toDateString();
  const weekStart = getWeekStart();
  
  try {
    const data = await chrome.storage.local.get(['domains']);
    const domains = data.domains || {};
    
    if (!domains[activeDomain]) {
      domains[activeDomain] = {
        dailyTime: {},
        weeklyTime: {},
        totalTime: 0,
        limits: {
          daily: 0,
          weekly: 0
        },
        lastNotification: {}
      };
    }
    
    const domain = domains[activeDomain];
    
    domain.dailyTime[today] = (domain.dailyTime[today] || 0) + secondsSinceLastSave;
    domain.weeklyTime[weekStart] = (domain.weeklyTime[weekStart] || 0) + secondsSinceLastSave;
    domain.totalTime = (domain.totalTime || 0) + secondsSinceLastSave;
    
    await chrome.storage.local.set({ domains });
    await checkLimits(activeDomain, domain);
    
    lastSaveTime = now;
    
    console.log(`Saved ${secondsSinceLastSave}s for ${activeDomain}, total today: ${domain.dailyTime[today]}s`);
  } catch (error) {
    console.error('Error saving session:', error);
  }
}

// Check limits
async function checkLimits(domain, domainData) {
  const settings = await chrome.storage.local.get(['settings']);
  if (!settings.settings?.notificationsEnabled) return;
  
  const today = new Date().toDateString();
  const weekStart = getWeekStart();
  
  const dailyTime = domainData.dailyTime[today] || 0;
  const weeklyTime = domainData.weeklyTime[weekStart] || 0;
  
  const now = Date.now();
  
  if (domainData.limits.daily > 0 && dailyTime > domainData.limits.daily) {
    const lastDaily = notificationTimes.get(`${domain}-daily`) || 0;
    if (now - lastDaily > NOTIFICATION_COOLDOWN) {
      await notifyUser(domain, 'daily', dailyTime, domainData.limits.daily);
      notificationTimes.set(`${domain}-daily`, now);
    }
  }
  
  if (domainData.limits.weekly > 0 && weeklyTime > domainData.limits.weekly) {
    const lastWeekly = notificationTimes.get(`${domain}-weekly`) || 0;
    if (now - lastWeekly > NOTIFICATION_COOLDOWN) {
      await notifyUser(domain, 'weekly', weeklyTime, domainData.limits.weekly);
      notificationTimes.set(`${domain}-weekly`, now);
    }
  }
}

// Send notification
async function notifyUser(domain, type, currentTime, limit) {
  const timeSpent = formatTime(currentTime);
  const limitTime = formatTime(limit);
  
  chrome.notifications.create(`${domain}-${type}-${Date.now()}`, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon128.png'),
    title: 'TimeUP Alert',
    message: `${domain} - ${type === 'daily' ? 'Daily' : 'Weekly'} limit exceeded!\nSpent: ${timeSpent} / Limit: ${limitTime}`,
    priority: 2,
    buttons: [
      { title: 'Snooze 1 hour' },
      { title: 'View Stats' }
    ]
  });
}

// Handle notification button clicks
chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  if (buttonIndex === 0) {
    chrome.notifications.clear(notificationId);
  } else if (buttonIndex === 1) {
    chrome.runtime.openOptionsPage();
  }
});

// Alarm handlers
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'dailyReset') {
    await resetDailyStats();
  } else if (alarm.name === 'weeklyReset') {
    await resetWeeklyStats();
  }
});

// Reset daily stats
async function resetDailyStats() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  
  const data = await chrome.storage.local.get(['domains']);
  const domains = data.domains || {};
  
  for (const domain in domains) {
    const dailyTime = domains[domain].dailyTime || {};
    const dates = Object.keys(dailyTime);
    
    for (const date of dates) {
      const dateObj = new Date(date);
      const daysDiff = Math.floor((Date.now() - dateObj.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysDiff > 7) {
        delete dailyTime[date];
      }
    }
  }
  
  await chrome.storage.local.set({ domains });
  notificationTimes.clear();
}

// Reset weekly stats
async function resetWeeklyStats() {
  const data = await chrome.storage.local.get(['domains']);
  const domains = data.domains || {};
  
  for (const domain in domains) {
    const weeklyTime = domains[domain].weeklyTime || {};
    const weeks = Object.keys(weeklyTime);
    
    for (const week of weeks) {
      const weekDate = new Date(week);
      const weeksDiff = Math.floor((Date.now() - weekDate.getTime()) / (1000 * 60 * 60 * 24 * 7));
      
      if (weeksDiff > 4) {
        delete weeklyTime[week];
      }
    }
  }
  
  await chrome.storage.local.set({ domains });
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

// Message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getCurrentSession') {
    if (activeDomain && sessionStartTime) {
      const now = Date.now();
      const currentSessionSeconds = Math.floor((now - sessionStartTime) / 1000);
      sendResponse({ 
        domain: activeDomain, 
        seconds: currentSessionSeconds,
        startTime: sessionStartTime,
        isIdle: isIdle,
        mediaPlaying: mediaPlaying
      });
    } else {
      sendResponse({ domain: null, seconds: 0, startTime: null, isIdle: false, mediaPlaying: false });
    }
    return true;
  } else if (request.action === 'forceSync') {
    saveCurrentSession().then(() => {
      sendResponse({ success: true });
    });
    return true;
  } else if (request.action === 'updateSettings') {
    // Reload settings when changed in options page
    chrome.storage.local.get(['settings']).then((data) => {
      if (data.settings) {
        // Update the idle threshold if settings exist
        const oldThreshold = IDLE_THRESHOLD;
        IDLE_THRESHOLD = data.settings.idleThreshold || 60;
        
        // Log the change for debugging
        if (oldThreshold !== IDLE_THRESHOLD) {
          console.log(`Idle threshold updated: ${oldThreshold}s → ${IDLE_THRESHOLD}s`);
        }
        
        // You can update other settings here if needed
        // For example:
        // notificationsEnabled = data.settings.notificationsEnabled;
        // idleDetectionEnabled = data.settings.idleDetectionEnabled;
      }
      sendResponse({ success: true });
    });
    return true;
  }
});

// Handle extension startup
chrome.runtime.onStartup.addListener(() => {
  console.log('TimeUP extension started');
  startSaveTimer();
  setupWindowFocusTracking();
});

// Debug logging
console.log('TimeUP background script loaded');
