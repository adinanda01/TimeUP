document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(null, data => {
    const container = document.getElementById('siteSettings');
    Object.entries(data).forEach(([domain, info]) => {
      const div = document.createElement('div');
      div.className = 'bg-white p-4 rounded shadow';

      const currentLimit = info.dailyLimit ? `${Math.floor(info.dailyLimit / 60)} min` : 'Not Set';

      div.innerHTML = `
        <div class="flex justify-between items-center mb-2">
          <span class="font-semibold">${domain}</span>
          <span class="text-sm text-gray-500">Today: ${formatTime(info.totalTimeToday || 0)}</span>
        </div>
        <div class="flex items-center gap-2">
          <input type="number" placeholder="Limit (min)" class="border rounded px-2 py-1 w-24" id="limit-${domain}" value="${info.dailyLimit ? info.dailyLimit / 60 : ''}">
          <button class="bg-green-600 text-white px-2 py-1 rounded text-sm hover:bg-green-700" onclick="saveLimit('${domain}')">💾 Save</button>
        </div>
      `;
      container.appendChild(div);
    });
  });

  document.getElementById('resetStats').addEventListener('click', () => {
    chrome.storage.local.get(null, data => {
      const resetData = {};
      for (const domain in data) {
        resetData[domain] = {
          ...data[domain],
          totalTimeToday: 0,
          totalTimeThisWeek: 0
        };
      }
      chrome.storage.local.set(resetData, () => {
        alert('All stats reset!');
        location.reload();
      });
    });
  });

  document.getElementById('exportData').addEventListener('click', () => {
    chrome.storage.local.get(null, data => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `timeup-export-${new Date().toISOString().slice(0,10)}.json`;
      a.click();
    });
  });
});

function saveLimit(domain) {
  const input = document.getElementById(`limit-${domain}`);
  const minutes = parseInt(input.value);
  if (isNaN(minutes)) return;

  chrome.storage.local.get([domain], data => {
    const siteData = data[domain] || {};
    siteData.dailyLimit = minutes * 60;
    chrome.storage.local.set({ [domain]: siteData }, () => {
      alert(`Updated limit for ${domain}`);
    });
  });
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const hrs = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return hrs > 0 ? `${hrs}h ${remainingMins}m` : `${mins} min`;
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const hrs = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return hrs > 0 ? `${hrs}h ${remainingMins}m` : `${mins} min`;
}
