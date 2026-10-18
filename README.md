# 🌙 Rishiverse-Extension (Dark Mode, Campus Mess Menu & LMS Attendance)

A comprehensive Chrome Extension for **Rishiverse ERP** (`https://rishiverse.rishihood.edu.in`) featuring custom **Dark Themes**, an interactive **Live Campus Food Menu**, and a real-time **LMS Attendance Tracker**.

---

## ✨ Features

### 1. 🎨 Rishiverse Dark Mode
- **⚡ Instant Toggle (0ms Reload):** Real-time theme toggling.
- **🎨 Dual Dark Palettes:** Midnight Charcoal & Pure OLED Black (`#000000`).
- **🛡️ Next.js SPA Route Protection:** MutationObserver keeps dark mode active during client-side navigation.
- **👁️ High-Contrast Typography:** Overrides all 42+ hardcoded charcoal/silver text colors on the ERP to crisp, bright white.
- **🔘 In-Page Companion Widget:** Interactive floating action button (FAB) at the bottom-right corner of Rishiverse that opens an in-page companion modal with Menu, Attendance, and Theme tabs.
- **⌨️ Keyboard Shortcut:** <kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>D</kbd>.

### 2. 🍲 Official Campus Food Menu
- **🏛️ Direct Rishiverse Integration:** Fetches live meals directly from the official Rishiverse Mess Menu (`/mess-menu`) and API (`/api/v1/mess?date=YYYY-MM-DD`).
- **📅 7-Day Interactive Selector:** Jump between Monday through Sunday with 1 click.
- **🟢 Live Meal State Detection:** Automatically highlights `● Serving Now` during active meal times and `⏳ Next Up` for upcoming meals.
- **✨ Smart Dish Categorization:** Separates main dishes/specials from daily staples (milk, bread, tea, chapati, rice, etc.).
- **🔄 Auto-Sync & Real-Time DOM Capture:** Automatically extracts fresh menu updates whenever you visit `/mess-menu` or click ↻ sync.
- **📶 Offline Fallback Support:** Bundled `menu.json` ensures you can check meals even without internet connectivity.

### 3. 📊 Live LMS Attendance Tracker
- **🎯 Dynamic Target Selector:** Toggle between 75%, 80%, 85%, and 90% attendance goals.
- **🧮 Smart Skip & Recovery Calculator:**
  - Calculates how many classes you can safely miss (`Safe (+X skips)`) if above target.
  - Calculates how many consecutive classes you must attend (`Need +Y classes`) to climb back if below target.
- **📈 Course-by-Course Breakdown:** Shows exact counts for classes held, attended, present, excused, and absent.
- **🔄 Zero-Friction Sync:** Direct integration with `https://rishiverse.rishihood.edu.in/lms/attendance` via API and session token.

---

## 🍽️ How the Food Menu Gets Fetched & Updated

* **Primary Source (Official Rishiverse API):** Queries `https://api.rishiverse.rishihood.edu.in/api/v1/mess?date=YYYY-MM-DD` for each day of the week using the student's decrypted session token (`rw_access_token`).
* **Live In-Page DOM Extraction:** When navigating to `https://rishiverse.rishihood.edu.in/mess-menu`, the extension automatically detects the rendered meal forms and syncs any newly uploaded dishes directly into the companion widget.
* **Fallback Strategy:** If offline or logged out, uses cached menu data or bundled `menu.json`.
* **Daily / Hourly Detection:** Automatically selects today's day and detects the active meal window (Breakfast: 7:30–9:30 AM, Lunch: 12:00–2:30 PM, Snacks: 4:30–6:30 PM, Dinner: 7:30–9:30 PM), expanding the active meal card.

---

## 📊 How the LMS Attendance Tracker Works

* **Endpoints Used:**
  - `/students/self/academics/semesters`: Identifies active semester number.
  - `/students/self/{semester}/attendance/summary`: Fetches courses, classes held, present, and excused lectures.
* **Math Formulas (from `math.js`):**
  - **Attended Count:** `presentLectures + excusedLectures`
  - **Skips Affordable:** `Math.max(0, Math.floor(attended / target) - total)`
  - **Recovery Classes Needed:** `Math.ceil((target * total - attended) / (1 - target))`
* **Excluded:** Unnecessary missed classes logs (not provided by Rishiverse LMS).

---

## 🚀 How to Install / Reload in Chrome

1. Go to `chrome://extensions/` in your browser.
2. Enable **Developer mode** in the top-right.
3. If already loaded: click the **Reload icon (↻)** on the "Rishiverse-Extension" card.
   If not loaded yet: click **Load unpacked** and select:
   ```
   /Users/ashwinanand/Desktop/Rishiverse-Extension
   ```
4. Click the extension icon in your Chrome toolbar to explore **Theme**, **Menu**, and **Attendance**!
