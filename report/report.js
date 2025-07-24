// State
let domains = {};
let productiveSites = [];
let chartInstances = {};

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Report page loading...');
  
  // Check if Chart.js is loaded
  if (typeof Chart === 'undefined') {
    showError('Chart library not loaded. Please check your installation.');
    return;
  }
  
  await loadData();
  setupEventListeners();
  generateReport('week');
});

// Show error message
function showError(message) {
  document.body.innerHTML = `
    <div class="max-w-4xl mx-auto p-6 text-center">
      <div class="bg-red-50 border border-red-200 rounded-lg p-6">
        <h2 class="text-xl font-semibold text-red-800 mb-2">Error</h2>
        <p class="text-red-600">${message}</p>
        <button onclick="location.reload()" class="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
          Reload Page
        </button>
      </div>
    </div>
  `;
}

// Load data
async function loadData() {
  try {
    const data = await chrome.storage.local.get(['domains', 'productiveSites']);
    domains = data.domains || {};
    productiveSites = data.productiveSites || [];
    console.log('Loaded domains:', Object.keys(domains).length);
    console.log('Loaded productive sites:', productiveSites);
  } catch (error) {
    console.error('Error loading data:', error);
    showError('Failed to load data from storage');
  }
}

// Setup event listeners
function setupEventListeners() {
  // Report controls
  document.getElementById('reportRange')?.addEventListener('change', (e) => {
    generateReport(e.target.value);
  });
  
  document.getElementById('refreshReport')?.addEventListener('click', async () => {
    const btn = document.getElementById('refreshReport');
    btn.disabled = true;
    btn.textContent = '⏳ Loading...';
    
    await loadData();
    const range = document.getElementById('reportRange').value;
    generateReport(range);
    
    btn.disabled = false;
    btn.textContent = '🔄 Refresh';
  });

  // Productive sites management
  document.getElementById('manageProductiveSites')?.addEventListener('click', () => {
    showProductiveSitesModal();
  });

  document.getElementById('closeModal')?.addEventListener('click', () => {
    hideProductiveSitesModal();
  });

  document.getElementById('addSiteBtn')?.addEventListener('click', () => {
    addProductiveSite();
  });

  document.getElementById('newSiteInput')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addProductiveSite();
    }
  });

  // Modal backdrop click
  document.getElementById('productiveSitesModal')?.addEventListener('click', (e) => {
    if (e.target.id === 'productiveSitesModal') {
      hideProductiveSitesModal();
    }
  });
  
  // ESC key to close modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hideProductiveSitesModal();
    }
  });
}

// Domain validation
function isValidDomain(domain) {
  const domainRegex = /^(?!-)(?:[a-zA-Z0-9-]{1,63}(?<!-)\.)*[a-zA-Z]{2,}$/;
  const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
  return domainRegex.test(domain) || ipRegex.test(domain);
}

// Clean domain
function cleanDomain(domain) {
  return domain
    .toLowerCase()
    .trim()
    .replace(/^(https?:\/\/)?(www\.)?/, '')
    .replace(/\/.*$/, '')
    .replace(/:\d+$/, '');
}

// Productive Sites Management
function showProductiveSitesModal() {
  updateProductiveSitesList();
  const modal = document.getElementById('productiveSitesModal');
  modal.classList.remove('hidden');
  modal.classList.add('flex');
  document.getElementById('newSiteInput').focus();
}

function hideProductiveSitesModal() {
  const modal = document.getElementById('productiveSitesModal');
  modal.classList.add('hidden');
  modal.classList.remove('flex');
  document.getElementById('newSiteInput').value = '';
}

function updateProductiveSitesList() {
  const list = document.getElementById('productiveSitesList');
  list.innerHTML = '';

  if (productiveSites.length === 0) {
    list.innerHTML = '<li class="px-3 py-2 text-gray-500 text-sm">No productive sites defined</li>';
    return;
  }

  productiveSites.forEach((site, index) => {
    const item = document.createElement('li');
    item.className = 'flex justify-between items-center px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 mb-1';
    item.innerHTML = `
      <span class="font-medium text-gray-900">${site}</span>
      <button class="px-2 py-1 bg-red-500 text-white rounded text-xs hover:bg-red-600" 
        onclick="removeProductiveSite(${index})">Remove</button>
    `;
    list.appendChild(item);
  });
}

async function addProductiveSite() {
  const input = document.getElementById('newSiteInput');
  const btn = document.getElementById('addSiteBtn');
  const site = input.value.trim();
  
  if (!site) {
    alert('Please enter a valid site URL');
    return;
  }

  // Clean and validate
  const cleanSite = cleanDomain(site);
  
  if (!isValidDomain(cleanSite)) {
    alert('Please enter a valid domain (e.g., github.com)');
    return;
  }
  
  if (productiveSites.includes(cleanSite)) {
    alert('This site is already in your productive sites list');
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Adding...';
  
  try {
    productiveSites.push(cleanSite);
    await chrome.storage.local.set({ productiveSites });
    
    input.value = '';
    updateProductiveSitesList();
    
    // Refresh the report to show updated data
    const range = document.getElementById('reportRange').value;
    generateReport(range);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Add';
  }
}

async function removeProductiveSite(index) {
  if (!confirm('Remove this site from productive list?')) return;
  
  productiveSites.splice(index, 1);
  await chrome.storage.local.set({ productiveSites });
  updateProductiveSitesList();
  
  // Refresh the report
  const range = document.getElementById('reportRange').value;
  generateReport(range);
}

// Generate report based on range
function generateReport(range) {
  console.log('Generating report for range:', range);
  
  try {
    const data = processDataForRange(range);
    
    if (data.length === 0) {
      showNoDataMessage();
      return;
    }
    
    updateStats(data);
    updateProductiveSummary(data);
    updateCharts(data);
    updateTable(data);
    generateInsights(data);
  } catch (error) {
    console.error('Error generating report:', error);
    showError('Failed to generate report. Please try refreshing.');
  }
}

// Process data for selected range - FIXED
function processDataForRange(range) {
  const now = new Date();
  const processed = [];
  
  console.log('Processing data for range:', range);
  
  for (const [domain, info] of Object.entries(domains)) {
    let timeSpent = 0;
    
    if (range === 'today') {
      const today = now.toDateString();
      timeSpent = info.dailyTime?.[today] || 0;
    } else if (range === 'week') {
      // Use weekly data if available
      const weekStart = getWeekStart();
      if (info.weeklyTime?.[weekStart] !== undefined) {
        timeSpent = info.weeklyTime[weekStart];
      } else {
        // Fallback: sum up daily data for current week
        for (let i = 0; i < 7; i++) {
          const date = new Date(weekStart);
          date.setDate(date.getDate() + i);
          if (date > now) break; // Don't count future dates
          
          const dateStr = date.toDateString();
          timeSpent += info.dailyTime?.[dateStr] || 0;
        }
      }
    } else if (range === 'month') {
      // Sum up last 30 days
      if (info.dailyTime) {
        for (let i = 0; i < 30; i++) {
          const date = new Date(now);
          date.setDate(date.getDate() - i);
          const dateStr = date.toDateString();
          timeSpent += info.dailyTime[dateStr] || 0;
        }
      }
    } else if (range === 'all') {
      // Calculate total from all daily data (more accurate)
      if (info.dailyTime) {
        timeSpent = Object.values(info.dailyTime).reduce((sum, time) => sum + time, 0);
      }
      // Only use totalTime if no daily data
      if (timeSpent === 0 && info.totalTime) {
        timeSpent = info.totalTime;
      }
    }
    
    if (timeSpent > 0) {
      const isProductive = isProductiveSite(domain);
      
      processed.push({
        domain,
        timeSpent,
        limits: info.limits || { daily: 0, weekly: 0 },
        dailyTime: info.dailyTime || {},
        weeklyTime: info.weeklyTime || {},
        isProductive
      });
    }
  }
  
  // Sort by time spent
  processed.sort((a, b) => b.timeSpent - a.timeSpent);
  
    console.log('Processed data:', processed.length, 'domains');
  return processed;
}

// Check if a domain is productive
function isProductiveSite(domain) {
  return productiveSites.some(site => {
    // Exact match or subdomain match
    return domain === site || domain.endsWith('.' + site);
  });
}

// Update stats cards
function updateStats(data) {
  const totalTime = data.reduce((sum, item) => sum + item.timeSpent, 0);
  const sitesCount = data.length;
  const topSite = data[0]?.domain || 'None';
  
  // Calculate daily average
  const range = document.getElementById('reportRange').value;
  let days = 1;
  
  if (range === 'week') {
    days = 7;
  } else if (range === 'month') {
    days = 30;
  } else if (range === 'all') {
    // Calculate days since first entry
    let firstDate = new Date();
    let hasData = false;
    
    data.forEach(item => {
      Object.keys(item.dailyTime).forEach(dateStr => {
        hasData = true;
        const date = new Date(dateStr);
        if (date < firstDate) firstDate = date;
      });
    });
    
    if (hasData) {
      days = Math.max(1, Math.ceil((new Date() - firstDate) / (1000 * 60 * 60 * 24)));
    } else {
      days = 1;
    }
  }
  
  const dailyAvg = Math.floor(totalTime / days);
  
  document.getElementById('totalTime').textContent = formatTime(totalTime);
  document.getElementById('sitesCount').textContent = sitesCount;
  document.getElementById('topSite').textContent = topSite;
  document.getElementById('dailyAvg').textContent = formatTime(dailyAvg);
}

// Show no data message
function showNoDataMessage() {
  document.getElementById('totalTime').textContent = '0m';
  document.getElementById('sitesCount').textContent = '0';
  document.getElementById('topSite').textContent = 'None';
  document.getElementById('dailyAvg').textContent = '0m';
  
  // Hide productive summary
  document.getElementById('productiveSummary').classList.add('hidden');
  
  // Clear charts properly
  if (chartInstances.pie) {
    chartInstances.pie.destroy();
    delete chartInstances.pie;
  }
  if (chartInstances.line) {
    chartInstances.line.destroy();
    delete chartInstances.line;
  }
  
  // Clear canvas elements
  const pieCanvas = document.getElementById('pieChart');
  const lineCanvas = document.getElementById('lineChart');
  const pieCtx = pieCanvas.getContext('2d');
  const lineCtx = lineCanvas.getContext('2d');
  pieCtx.clearRect(0, 0, pieCanvas.width, pieCanvas.height);
  lineCtx.clearRect(0, 0, lineCanvas.width, lineCanvas.height);
  
  // Show message in table
  document.getElementById('detailsTable').innerHTML = `
    <tr>
      <td colspan="6" class="text-center py-8 text-gray-500">
        No data available for the selected period
      </td>
    </tr>
  `;
  
  // Show default insight
  document.getElementById('insights').innerHTML = `
    <div class="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-lg flex items-start gap-3">
      <span class="text-2xl flex-shrink-0">ℹ️</span>
      <p class="text-sm text-gray-700 leading-relaxed">Start browsing to see your usage statistics here.</p>
    </div>
  `;
}

// Update productive summary
function updateProductiveSummary(data) {
  const productiveData = data.filter(item => item.isProductive);
  const productiveTime = productiveData.reduce((sum, item) => sum + item.timeSpent, 0);
  const totalTime = data.reduce((sum, item) => sum + item.timeSpent, 0);
  
  const summaryDiv = document.getElementById('productiveSummary');
  
  if (productiveTime > 0 || productiveSites.length > 0) {
    summaryDiv.classList.remove('hidden');
    const percentage = totalTime > 0 ? ((productiveTime / totalTime) * 100).toFixed(1) : '0';
    
    document.getElementById('productiveTime').textContent = formatTime(productiveTime);
    document.getElementById('productivePercentage').textContent = percentage + '%';
  } else {
    summaryDiv.classList.add('hidden');
  }
}

// Update charts - FIXED
function updateCharts(data) {
  // Destroy existing charts properly
  if (chartInstances.pie) {
    chartInstances.pie.destroy();
    delete chartInstances.pie;
  }
  if (chartInstances.line) {
    chartInstances.line.destroy();
    delete chartInstances.line;
  }
  
  try {
    // Create pie chart - top 10 sites
    const pieData = data.slice(0, 10);
    const pieCtx = document.getElementById('pieChart').getContext('2d');
    
    // Generate colors
    const colors = pieData.map((item, index) => {
      if (item.isProductive) {
        return `hsl(142, 71%, ${45 + (index * 5)}%)`; // Greens
      }
      return `hsl(217, 91%, ${50 + (index * 5)}%)`; // Blues
    });
    
    chartInstances.pie = new Chart(pieCtx, {
      type: 'doughnut',
      data: {
        labels: pieData.map(d => d.domain),
        datasets: [{
          data: pieData.map(d => Math.round(d.timeSpent / 60)),
          backgroundColor: colors,
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 10,
              font: { size: 11 },
              generateLabels: function(chart) {
                const data = chart.data;
                return data.labels.map((label, i) => {
                  const value = data.datasets[0].data[i];
                  const isProductive = pieData[i].isProductive;
                  return {
                    text: (label.length > 25 ? label.substring(0, 25) + '...' : label) + 
                          (isProductive ? ' 🎯' : ''),
                    fillStyle: data.datasets[0].backgroundColor[i],
                    hidden: false,
                    index: i
                  };
                });
              }
            }
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const label = context.label || '';
                const value = context.parsed || 0;
                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : 0;
                const isProductive = pieData[context.dataIndex].isProductive;
                return `${label}: ${value}m (${percentage}%)${isProductive ? ' 🎯' : ''}`;
              }
            }
          }
        }
      }
    });
    
    // Create line chart
    const lineData = getDailyTrendData(data);
    const lineCtx = document.getElementById('lineChart').getContext('2d');
    
    chartInstances.line = new Chart(lineCtx, {
      type: 'line',
      data: {
        labels: lineData.labels,
        datasets: [{
          label: 'Total Time (minutes)',
          data: lineData.total,
          borderColor: '#3b82f6',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.4,
          fill: true
        }, {
          label: 'Productive Time (minutes)',
          data: lineData.productive,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          tension: 0.4,
          fill: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: { 
            display: true,
            position: 'top'
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Minutes'
            },
            ticks: {
              callback: function(value) {
                return value + 'm';
              }
            }
          },
          x: {
            grid: {
              display: false
            }
          }
        }
      }
    });
  } catch (error) {
    console.error('Error creating charts:', error);
  }
}

// Get daily trend data - FIXED
function getDailyTrendData(data) {
  const range = document.getElementById('reportRange').value;
  const dailyTotals = {};
  const dailyProductive = {};
  
  // Aggregate daily totals
  data.forEach(item => {
    Object.entries(item.dailyTime).forEach(([date, time]) => {
      dailyTotals[date] = (dailyTotals[date] || 0) + time;
      if (item.isProductive) {
        dailyProductive[date] = (dailyProductive[date] || 0) + time;
      }
    });
  });
  
  // Determine date range
  let startDate = new Date();
  let endDate = new Date();
  
  if (range === 'today') {
    // Just today
  } else if (range === 'week') {
    startDate = new Date(getWeekStart());
  } else if (range === 'month') {
    startDate.setDate(startDate.getDate() - 29);
  } else {
    // Show last 14 days for 'all'
    startDate.setDate(startDate.getDate() - 13);
  }
  
  const labels = [];
  const totalValues = [];
  const productiveValues = [];
  
  // Generate data points
  const current = new Date(startDate);
  while (current <= endDate) {
    const dateStr = current.toDateString();
    const shortDate = current.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    
    labels.push(shortDate);
    totalValues.push(Math.round((dailyTotals[dateStr] || 0) / 60));
    productiveValues.push(Math.round((dailyProductive[dateStr] || 0) / 60));
    
    current.setDate(current.getDate() + 1);
  }
  
  return { 
    labels, 
    total: totalValues, 
    productive: productiveValues 
  };
}

// Remaining functions stay the same...
// (updateTable, generateInsights, getWeekStart, formatTime)

// Update table
function updateTable(data) {
  const tbody = document.getElementById('detailsTable');
  tbody.innerHTML = '';
  
  if (data.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="px-4 py-8 text-center text-gray-500">No data available</td>
      </tr>
    `;
    return;
  }
  
  data.forEach(item => {
    const row = document.createElement('tr');
    row.className = 'hover:bg-gray-50';
    
    const today = new Date().toDateString();
    const weekStart = getWeekStart();
    const todayTime = item.dailyTime[today] || 0;
    const weekTime = item.weeklyTime[weekStart] || 0;
    
    const dailyStatus = item.limits.daily > 0 && todayTime > item.limits.daily;
    const weeklyStatus = item.limits.weekly > 0 && weekTime > item.limits.weekly;
    
    row.innerHTML = `
      <td class="px-4 py-3">
        <div class="font-medium text-gray-900">${item.domain}</div>
        <div class="text-xs text-gray-500">${formatTime(todayTime)} today</div>
      </td>
      <td class="px-4 py-3 text-right font-medium">${formatTime(item.timeSpent)}</td>
      <td class="px-4 py-3 text-right font-medium">
        ${item.limits.daily ? formatTime(item.limits.daily) : '<span class="text-gray-400">--</span>'}
      </td>
      <td class="px-4 py-3 text-right font-medium">
        ${item.limits.weekly ? formatTime(item.limits.weekly) : '<span class="text-gray-400">--</span>'}
      </td>
            <td class="px-4 py-3 text-center">
        <span class="inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
          item.isProductive 
            ? 'bg-green-100 text-green-800' 
            : 'bg-gray-100 text-gray-800'
        }">
          ${item.isProductive ? '🎯 Productive' : 'Regular'}
        </span>
      </td>
      <td class="px-4 py-3 text-center">
        <span class="inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
          dailyStatus || weeklyStatus 
            ? 'bg-red-100 text-red-800' 
            : 'bg-green-100 text-green-800'
        }">
          ${dailyStatus || weeklyStatus ? 'Over Limit' : 'OK'}
        </span>
      </td>
    `;
    
    tbody.appendChild(row);
  });
}

// Generate insights
function generateInsights(data) {
  const container = document.getElementById('insights');
  const insights = [];
  
  const totalTime = data.reduce((sum, item) => sum + item.timeSpent, 0);
  const totalHours = totalTime / 3600;
  const productiveTime = data.filter(item => item.isProductive).reduce((sum, item) => sum + item.timeSpent, 0);
  
  // Top site analysis
  if (data.length > 0) {
    const topSite = data[0];
    const topPercentage = totalTime > 0 ? (topSite.timeSpent / totalTime * 100).toFixed(1) : 0;
    
    if (topPercentage > 40) {
      insights.push({
        type: 'warning',
        icon: '⚠️',
        text: `${topSite.domain} accounts for ${topPercentage}% of your browsing time. Consider setting stricter limits.`
      });
    }
  }
  
  // Total time analysis
  const range = document.getElementById('reportRange').value;
  if (range === 'today' && totalHours > 6) {
    insights.push({
      type: 'warning',
      icon: '⏰',
      text: `You've spent over ${Math.floor(totalHours)} hours online today. Remember to take regular breaks.`
    });
  } else if (range === 'week' && totalHours > 40) {
    insights.push({
      type: 'info',
      icon: '📊',
      text: `${Math.floor(totalHours)} hours this week online. That's like a full-time job!`
    });
  }
  
  // Productive time analysis
  if (productiveSites.length > 0) {
    if (productiveTime > 0) {
      const productivePercentage = totalTime > 0 ? (productiveTime / totalTime * 100).toFixed(1) : 0;
      if (productivePercentage > 30) {
        insights.push({
          type: 'success',
          icon: '🎯',
          text: `${productivePercentage}% of your time was spent on productive sites. Excellent focus!`
        });
      } else if (productivePercentage > 0) {
        insights.push({
          type: 'info',
          icon: '📈',
          text: `${productivePercentage}% of your time was productive. Room for improvement!`
        });
      }
    } else {
      insights.push({
        type: 'warning',
        icon: '🎯',
        text: 'No time spent on productive sites. Consider visiting some learning or work-related sites.'
      });
    }
  } else {
    insights.push({
      type: 'info',
      icon: '💡',
      text: 'Define your productive sites to get better insights about your focus time.'
    });
  }
  
  // Sites over limit
  const today = new Date().toDateString();
  const overLimitCount = data.filter(item => {
    const todayTime = item.dailyTime[today] || 0;
    return item.limits.daily > 0 && todayTime > item.limits.daily;
  }).length;
  
  if (overLimitCount > 0) {
    insights.push({
      type: 'warning',
      icon: '🚨',
      text: `${overLimitCount} site${overLimitCount > 1 ? 's' : ''} exceeded daily limits today.`
    });
  }
  
  // Add general tips if no specific insights
  if (insights.length === 0) {
    if (totalTime === 0) {
      insights.push({
        type: 'info',
        icon: 'ℹ️',
        text: 'No browsing activity recorded yet. Start browsing to see your usage patterns.'
      });
    } else {
      insights.push({
        type: 'info',
        icon: '💡',
        text: 'Your browsing habits look balanced. Keep monitoring to maintain healthy screen time.'
      });
    }
  }
  
  // Render insights
  container.innerHTML = insights.map(insight => {
    const bgColor = insight.type === 'warning' ? 'bg-yellow-50 border-l-4 border-yellow-400' :
                   insight.type === 'success' ? 'bg-green-50 border-l-4 border-green-400' :
                   'bg-blue-50 border-l-4 border-blue-400';
    
    return `
      <div class="${bgColor} p-4 rounded-lg flex items-start gap-3 animate-fade-in">
        <span class="text-2xl flex-shrink-0">${insight.icon}</span>
        <p class="text-sm text-gray-700 leading-relaxed">${insight.text}</p>
      </div>
    `;
  }).join('');
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
  if (!seconds || seconds < 0) seconds = 0;
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m`;
  } else {
    return `${secs}s`;
  }
}

// Make functions available globally for onclick handlers
window.removeProductiveSite = removeProductiveSite;

// Log for debugging
console.log('Report script loaded');
