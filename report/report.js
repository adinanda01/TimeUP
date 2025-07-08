document.addEventListener('DOMContentLoaded', () => {
  chrome.storage.local.get(null, data => {
    const entries = Object.entries(data);
    const weeklyData = entries.map(([domain, info]) => ({
      domain,
      seconds: info.totalTimeThisWeek || 0
    })).filter(e => e.seconds > 0);

    weeklyData.sort((a, b) => b.seconds - a.seconds);

    const labels = weeklyData.map(e => e.domain);
    const values = weeklyData.map(e => Math.floor(e.seconds / 60));

    const ctx = document.getElementById('usageChart').getContext('2d');
    new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'Minutes Spent',
          data: values,
          backgroundColor: 'rgba(59, 130, 246, 0.5)',
          borderColor: 'rgba(59, 130, 246, 1)',
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: {
            label: ctx => `${ctx.parsed.y} min`
          }}
        },
        scales: {
          y: { beginAtZero: true, title: { display: true, text: 'Minutes' } }
        }
      }
    });

    showSuggestions(weeklyData);
  });
});

function showSuggestions(data) {
  const suggestionList = document.getElementById('suggestionList');
  const top = data[0];
  const totalMinutes = data.reduce((acc, d) => acc + d.seconds, 0) / 60;

  const suggestions = [];

  if (top && top.seconds / 60 > 180) {
    suggestions.push(`You spent over 3 hours this week on <strong>${top.domain}</strong>. Consider setting a weekly limit.`);
  }

  if (totalMinutes > 1200) {
    suggestions.push("You’ve spent over 20 hours online this week. Try scheduling short breaks or use site blockers.");
  }

  if (data.length >= 5 && data[4].seconds / 60 < 10) {
    suggestions.push("Focus seems fragmented. Consider reducing time on low-value sites.");
  }

  if (suggestions.length === 0) {
    suggestions.push("Your usage is well-balanced. Keep it up!");
  }

  suggestionList.innerHTML = suggestions.map(s => `<li>${s}</li>`).join('');
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const hrs = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return hrs > 0 ? `${hrs}h ${remainingMins}m` : `${mins} min`;
}

