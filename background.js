let activeTabId = null;
let activeDomain = null;
let lastCheckTime = null;

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('timeTracker', { periodInMinutes: 1 });
});

chrome.tabs.onActivated.addListener(async activeInfo => {
  const tab = await chrome.tabs.get(activeInfo.tabId);
  updateActiveDomain(tab);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.active && changeInfo.status === 'complete') {
    updateActiveDomain(tab);
  }
});

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'timeTracker') {
    trackTime();
  }
});

function updateActiveDomain(tab) {
  try {
    const url = new URL(tab.url);
    activeDomain = url.hostname;
    activeTabId = tab.id;
    lastCheckTime = Date.now();
  } catch (e) {
    activeDomain = null;
  }
}

function trackTime() {
  if (!activeDomain || !lastCheckTime) return;

  const now = Date.now();
  const seconds = Math.floor((now - lastCheckTime) / 1000);
  lastCheckTime = now;

  chrome.storage.local.get([activeDomain], data => {
    const siteData = data[activeDomain] || {
      totalTimeToday: 0,
      totalTimeThisWeek: 0
    };

    siteData.totalTimeToday += seconds;
    siteData.totalTimeThisWeek += seconds;

    chrome.storage.local.set({ [activeDomain]: siteData }, () => {
      checkLimit(activeDomain, siteData);
    });
  });
}

function checkLimit(domain, siteData) {
  const { dailyLimit = 0, weeklyLimit = 0, totalTimeToday, totalTimeThisWeek } = siteData;

  if (dailyLimit > 0 && totalTimeToday > dailyLimit) {
    notifyUser(domain, 'daily');
  }

  if (weeklyLimit > 0 && totalTimeThisWeek > weeklyLimit) {
    notifyUser(domain, 'weekly');
  }
}

function notifyUser(domain, type) {
  const limitText = type === 'daily' ? 'Daily limit exceeded!' : 'Weekly limit exceeded!';
  chrome.notifications.create(`${domain}-${type}`, {
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title: 'TimeUP Alert',
    message: `${domain} - ${limitText}`,
    priority: 2
  });
}

chrome.alarms.create('midnightReset', {
  when: new Date().setHours(24, 0, 0, 0), // midnight
  periodInMinutes: 1440
});

chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'midnightReset') {
    resetDailyStats();
  }
});

function resetDailyStats() {
  chrome.storage.local.get(null, data => {
    const updated = {};
    for (const domain in data) {
      updated[domain] = { ...data[domain], totalTimeToday: 0 };
    }
    chrome.storage.local.set(updated);
  });
}

