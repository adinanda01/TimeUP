document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(null, data => {
    const entries = Object.entries(data || {});
    const todayTotals = entries.map(([domain, val]) => ({
      domain,
      seconds: val?.totalTimeToday || 0
    }));

    todayTotals.sort((a, b) => b.seconds - a.seconds);

    let totalTime = 0;
    const topSites = todayTotals.slice(0, 5);
    const list = document.getElementById('siteList');
    list.innerHTML = ''; // 🧼 Clear any old list items

    topSites.forEach(site => {
      totalTime += site.seconds;
      const li = document.createElement('li');
      li.innerHTML = `<strong>${site.domain}</strong>: ${formatTime(site.seconds)}`;
      list.appendChild(li);
    });

    document.getElementById('totalTimeValue').textContent = formatTime(totalTime);
  });

  // ➕ Add Limit Button Logic
  document.getElementById('addLimitBtn').addEventListener('click', () => {
    const domain = document.getElementById('domainInput').value.trim();
    const minutes = parseInt(document.getElementById('limitInput').value);

    if (!domain || isNaN(minutes)) {
      alert('Please enter a valid domain and limit');
      return;
    }

    chrome.storage.local.get([domain], data => {
      const siteData = data[domain] || {
        totalTimeToday: 0,
        totalTimeThisWeek: 0
      };

      siteData.dailyLimit = minutes * 60;

      chrome.storage.local.set({ [domain]: siteData }, () => {
        alert(`Limit set for ${domain}`);
        document.getElementById('domainInput').value = '';
        document.getElementById('limitInput').value = '';
      });
    });
  });
});

// 🕒 Time Formatter Utility
function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const hrs = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return hrs > 0 ? `${hrs}h ${remainingMins}m` : `${mins} min`;
}
