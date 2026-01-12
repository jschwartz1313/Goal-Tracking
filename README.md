# Daily Habit Tracker

A comprehensive web-based application for tracking daily habits, goals, and personal metrics. Built with vanilla JavaScript, HTML, and CSS - no frameworks or dependencies required.

![Daily Habit Tracker](https://img.shields.io/badge/version-1.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)

## 🌟 Features

### 📊 Daily Metrics Tracking
- **Rate your day on a 1-10 scale** for multiple metrics
- **Visual color-coded sliders** (red → yellow → green) for intuitive rating
- **Pre-configured metrics** across multiple categories:
  - **Health**: Sleep Quality, Diet Quality, Exercise
  - **Productivity**: Focus/Concentration, Overall Productivity
  - **Mental Wellbeing**: Mood, Stress Level
  - **Social**: Social Connection
- **Customizable metrics** - add or remove any metric you want

### ✅ Daily Goals Management
- **Add specific goals** for each day
- **Three completion states**:
  - 🔴 **Incomplete** - Not started yet
  - 🟡 **Partial** - In progress
  - 🟢 **Complete** - Fully achieved
- **Click to cycle** through completion states
- **Visual feedback** with colored borders and strikethrough for completed goals
- **Per-day goal tracking** - different goals for different days

### 📝 Daily Notes
- **Free-form text area** to capture thoughts, reflections, or context about your day
- **Saved automatically** when you navigate away
- **Appears in history** for future reference

### 📈 Statistics Dashboard
- **Today's Average** - Your current day's performance across all metrics
- **7-Day Average** - Rolling weekly average to track trends
- **Total Days Tracked** - Your commitment streak

### 🕒 Complete History
- **View all past entries** organized by date
- **See all metrics, goals, and notes** for each day
- **Average scores** calculated per day
- **Goal status indicators** with emoji (🔴🟡🟢)
- **Chronological order** (most recent first)

### 🎨 Modern UI/UX
- **Responsive design** - works on desktop, tablet, and mobile
- **Beautiful gradient theme** (purple/blue)
- **Smooth animations and transitions**
- **Intuitive navigation** with three main sections
- **Clean, distraction-free interface**

### 💾 Data Persistence
- **All data stored locally** in your browser (localStorage)
- **No server required** - works completely offline
- **Privacy-first** - your data never leaves your device
- **Instant loading** - no network delays

## 🚀 Getting Started

### Option 1: GitHub Pages (Recommended)

1. **Fork or clone this repository**
   ```bash
   git clone https://github.com/jschwartz1313/Goal-Tracking.git
   ```

2. **Enable GitHub Pages**
   - Go to your repository on GitHub
   - Click **Settings** → **Pages**
   - Under "Source", select **main** branch and **/ (root)** folder
   - Click **Save**

3. **Access your site**
   - Your site will be live at: `https://[your-username].github.io/Goal-Tracking/`
   - It may take 1-2 minutes to deploy

### Option 2: Local Development

1. **Clone the repository**
   ```bash
   git clone https://github.com/jschwartz1313/Goal-Tracking.git
   cd Goal-Tracking
   ```

2. **Open with a local server**
   - **Using Python**:
     ```bash
     python -m http.server 8000
     ```
   - **Using Node.js**:
     ```bash
     npx http-server
     ```
   - **Using VS Code Live Server**:
     - Install the "Live Server" extension
     - Right-click on `index.html` → "Open with Live Server"

3. **Open in browser**
   - Navigate to `http://localhost:8000` (or the port shown by your server)

### Option 3: Direct File Access

Simply open `index.html` directly in any modern web browser. Double-click the file or drag it into your browser window.

> **Note**: Some browsers may restrict localStorage access when opening files directly. Using a local server (Option 2) is recommended for full functionality.

## 📱 Usage Guide

### Today Tab

**Track Your Metrics**
1. Use the sliders to rate each metric from 1 (Poor) to 10 (Excellent)
2. Scores are saved automatically as you adjust them
3. Watch your daily average update in real-time

**Add Daily Goals**
1. Type your goal in the input field
2. Click "Add Goal" or press Enter
3. Click the status button to cycle through: Incomplete → Partial → Complete

**Add Notes**
1. Scroll to the "Daily Notes" section
2. Type any thoughts, reflections, or context
3. Notes save automatically when you navigate away

### History Tab

- View all your past entries chronologically
- See metrics scores, goals (with status), and notes for each day
- Review your progress over time

### Manage Metrics Tab

**Add Custom Metrics**
1. Enter a metric name (e.g., "Water Intake")
2. Select a category
3. Click "Add Metric"

**Delete Metrics**
- Click "Delete" next to any metric
- Confirms before deletion
- Removes from all historical data

## 🛠️ Technical Details

### Technology Stack
- **HTML5** - Semantic markup
- **CSS3** - Modern styling with flexbox/grid
- **Vanilla JavaScript** - No frameworks or libraries
- **localStorage API** - Client-side data persistence

### Browser Compatibility
- Chrome/Edge (recommended)
- Firefox
- Safari
- Opera
- Any modern browser with ES6+ support

### Data Structure

**Metrics Storage**
```javascript
{
  "habitMetrics": [
    { "id": 1, "name": "Sleep Quality", "category": "Health" },
    // ... more metrics
  ]
}
```

**History Storage**
```javascript
{
  "habitHistory": {
    "2026-01-12": {
      "1": 8,  // metricId: score
      "2": 7,
      "notes": "Had a great day!"
    }
  }
}
```

**Goals Storage**
```javascript
{
  "dailyGoals": {
    "2026-01-12": [
      {
        "id": 1736697600000,
        "text": "Finish project",
        "status": "complete"
      }
    ]
  }
}
```

## 🎯 Use Cases

- **Personal Development** - Track habits and self-improvement metrics
- **Health & Wellness** - Monitor sleep, diet, exercise, and mood
- **Productivity** - Measure focus, output, and goal completion
- **Mental Health** - Track mood, stress, and emotional wellbeing
- **Journaling** - Combine quantitative metrics with qualitative notes
- **Goal Setting** - Set and track daily objectives with completion states

## 🔒 Privacy & Security

- **100% Client-Side** - No data is ever sent to any server
- **No Tracking** - No analytics, cookies, or third-party scripts
- **No Account Required** - No sign-up, login, or personal information needed
- **Local Storage Only** - Data stays in your browser on your device
- **Open Source** - Inspect the code yourself - it's all in one HTML file

## 💡 Tips & Best Practices

1. **Be Consistent** - Track daily for the most accurate trends
2. **Be Honest** - Rate yourself truthfully for meaningful insights
3. **Review Weekly** - Use the 7-day average to spot patterns
4. **Customize Metrics** - Add metrics that matter to YOU
5. **Use Goals Wisely** - Set achievable, specific daily goals
6. **Add Context** - Use notes to explain outliers or special circumstances
7. **Backup Your Data** - Export your localStorage occasionally (use browser dev tools)

## 🚧 Known Limitations

- **No Data Export** - Currently no built-in export feature (future enhancement)
- **Browser-Specific** - Data doesn't sync across browsers or devices
- **Local Storage Limits** - ~5-10MB storage limit (sufficient for years of data)
- **No Reminders** - No notification system to prompt daily tracking

## 🛣️ Roadmap

Potential future enhancements:
- [ ] Data export/import (JSON, CSV)
- [ ] Charts and visualizations
- [ ] Goal templates
- [ ] Reminder notifications
- [ ] Dark mode toggle
- [ ] Multiple user profiles
- [ ] Cloud sync option
- [ ] Mobile app (PWA)

## 🤝 Contributing

Contributions are welcome! Feel free to:
- Report bugs via GitHub Issues
- Suggest features
- Submit pull requests
- Improve documentation

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 👤 Author

Created by [jschwartz1313](https://github.com/jschwartz1313)

## 🙏 Acknowledgments

Built with assistance from Claude (Anthropic) - AI pair programming at its finest!

---

**⭐ If you find this useful, consider giving it a star on GitHub!**

## 📞 Support

Having issues? Check the following:
- Ensure JavaScript is enabled in your browser
- Try clearing your browser cache
- Check browser console for errors (F12)
- Verify you're using a modern browser
- For local server issues, ensure the port isn't already in use

For bugs or feature requests, please [open an issue](https://github.com/jschwartz1313/Goal-Tracking/issues) on GitHub.
