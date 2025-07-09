
# TimeUP – Chrome Extension

**TimeUP** is a minimal, productivity-focused Chrome extension that tracks the amount of time you spend on different websites and helps you manage your online habits.

Think of it as your personal "screen time" tool for the web. No more mindless browsing – TimeUP helps you stay focused and intentional online.

## Features

- Real-time tracking of time spent on each website
- Set time limits for specific websites with alerts
- Weekly usage reports with charts and summaries
- Simple admin panel to manage limits and settings
- Smart productivity suggestions based on browsing patterns
- Clean, distraction-free UI (Tailwind CSS)

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
│   ├── report.js
│   └── report.css
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── utils/
│   └── timeUtils.js
└── styles/
    └── tailwind.css
```

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/adinanda01/TimeUP.git
cd TimeUP
```

### 2. Load Extension into Chrome

1. Open `chrome://extensions/` in your browser
2. Enable Developer Mode (top right)
3. Click Load Unpacked
4. Select the `TimeUP/` folder

## Technologies Used

- Chrome Extension APIs (Manifest v3)
- Tailwind CSS for styling
- Chart.js for data visualisation (reports)
- Vanilla JavaScript (React optional in future versions)
- Optional MERN Stack planned for Phase 2

## Roadmap

- Basic time tracking
- Time limit alerts
- Weekly reports
- Cloud sync with MongoDB (MERN)
- Authentication with Google login
- Full analytics dashboard

## License

MIT License

## Contributing

Contributions are welcome. Feel free to fork this repo, open issues, or submit pull requests to improve TimeUP.

## Author

Aditya Nanda
GitHub: [https://github.com/adinanda01]
Email : a.nanda@iitg.ac.in
