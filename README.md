# TimeUP - Website Time Tracker

A privacy-focused Chrome extension that tracks and analyzes your time spent on websites. Built using Manifest V3, TimeUP provides insightful analytics with full local control over your data.

## Overview

TimeUP is a lightweight, privacy-first time tracking tool for Chrome. It monitors active tabs, detects idle periods, visualizes usage trends, and lets users set per-site time limits. All data is stored locally—no cloud, no tracking.

## Features

### Core Capabilities

- Automatic time tracking by active tab and domain
- Intelligent idle detection:
  - 60 seconds default idle
  - 5 minutes extended idle
  - 30 minutes for media playback
- Live session dashboard with real-time updates
- Analytics reports: daily, weekly, monthly, all-time
- Per-domain time limits with alerts
- Import/export data in JSON format

### Technical Highlights

- Throttled operations for performance
- Lazy content script injection
- Media-aware tracking
- Window focus tracking
- Incremental data saves every 5 seconds
- Multi-tab domain management

## Installation

### Users

1. Visit the Chrome Web Store (link pending)
2. Click "Add to Chrome"
3. Pin the extension for quick access

### Developers

```bash
git clone https://github.com/yourusername/timeup.git
cd timeup
```

1. Go to `chrome://extensions/`
2. Enable Developer Mode
3. Click "Load unpacked"
4. Select the `TimeUP/` directory

## Project Structure

```
TimeUP/
├── manifest.json         
├── background.js         
├── content.js            
├── popup/
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── options/
│   ├── options.html
│   ├── options.js
│   └── options.css
├── report/
│   ├── report.html
│   └── report.js
├── icons/
├── libs/
│   └── chart.min.js
└── styles/
    ├── tailwind.min.css
    └── minimal.css
```

## Architecture

### Components

- **Service Worker (`background.js`)**
  - Manages sessions and tab events
  - Implements idle logic and persistence

- **Content Script (`content.js`)**
  - Tracks user activity and media events

- **UI Interfaces**
  - Popup: session stats
  - Options: settings and limits
  - Report: usage analytics

### Data Flow

User Activity → Content Script → Service Worker → Chrome Storage → UI

### Storage Schema

```json
{
  "domains": {
    "example.com": {
      "dailyTime": { "YYYY-MM-DD": seconds },
      "weeklyTime": { "weekStart": seconds },
      "totalTime": seconds,
      "limits": { "daily": seconds, "weekly": seconds }
    }
  },
  "settings": {
    "notificationsEnabled": true,
    "idleDetectionEnabled": true,
    "idleThreshold": 60
  },
  "productiveSites": ["github.com", "stackoverflow.com"]
}
```

## Technologies Used

- JavaScript (ES6+), HTML5, CSS3
- Tailwind CSS
- Chart.js
- Chrome APIs: tabs, storage, alarms, notifications, idle, scripting, runtime, windows

## Privacy and Security

- No external API calls or analytics
- Local storage only
- Domain names stored, not full URLs
- Minimal permissions
- Export/import options for full data control

## Performance

- Memory: <10MB
- CPU: <1%
- Storage: ~500 bytes/domain (7-day history)
- Save interval: 5 seconds

## Development Setup

### Requirements

- Chrome v88+
- Git
- Text editor with JavaScript support

### Workflow

1. Edit source files
2. Reload from `chrome://extensions/`
3. Verify functionality in browser

### Testing Checklist

- Tab switching
- Idle/media detection
- Data persistence
- Import/export
- Multi-tab and multi-window tracking

## Browser Support

- Supported: Chrome 88+ (Manifest V3)
- Not yet supported: Firefox, Safari, Edge

## Contribution Guidelines

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit with clear messages
4. Push and open a Pull Request

### Code Standards

- Use ES6+ features
- Maintain consistent style
- Add JSDoc for complex logic
- Pass ESLint checks

## Roadmap

- Website categorization
- Time-based blocking
- Productivity scoring
- Cloud sync (encrypted)
- Third-party API integration
- Mobile companion app

## Acknowledgments

- Chart.js for visualizations
- Tailwind CSS for UI design
- Chrome extension developer community
- All contributors and testers

## Author

Aditya Nanda
[LinkedIn](https://linkedin.com/in/aditya-nanda-8b0325252)
[Email](mailto:a.nanda@iitg.ac.in)

## License

Maintained by Author
