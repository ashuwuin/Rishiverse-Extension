/**
 * Rishiverse-Extension - Popup Controller
 * Manages Dark Theme, Campus Mess Menu, and LMS Attendance Tracker
 */
const API_BASE = 'https://api.rishiverse.rishihood.edu.in/api/v1';
const AES_KEY = 'addencriptionkey';

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const MEAL_CONFIG = [
  {
    key: 'breakfast',
    label: 'Breakfast',
    time: '07:30 - 09:30 AM',
    startMin: 450,
    endMin: 570,
    iconClass: 'meal-icon-breakfast',
    svgIcon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <circle cx="12" cy="12" r="4"/>
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
    </svg>`
  },
  {
    key: 'lunch',
    label: 'Lunch',
    time: '12:00 - 02:30 PM',
    startMin: 720,
    endMin: 870,
    iconClass: 'meal-icon-lunch',
    svgIcon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>
    </svg>`
  },
  {
    key: 'snacks',
    label: 'Snacks',
    time: '04:30 - 06:30 PM',
    startMin: 990,
    endMin: 1110,
    iconClass: 'meal-icon-snacks',
    svgIcon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M17 8h1a4 4 0 1 1 0 8h-1M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/>
      <line x1="6" y1="2" x2="6" y2="4"/><line x1="10" y1="2" x2="10" y2="4"/><line x1="14" y1="2" x2="14" y2="4"/>
    </svg>`
  },
  {
    key: 'dinner',
    label: 'Dinner',
    time: '07:30 - 09:30 PM',
    startMin: 1170,
    endMin: 1290,
    iconClass: 'meal-icon-dinner',
    svgIcon: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      <path d="M12 21a9 9 0 0 0 9-9H3a9 9 0 0 0 9 9ZM7 21h10M19.5 12 22 6"/>
      <path d="M16 3c0 1.5-1.5 2-1.5 3M11 3c0 1.5-1.5 2-1.5 3M6 3c0 1.5-1.5 2-1.5 3"/>
    </svg>`
  }
];

document.addEventListener('DOMContentLoaded', () => {
  // ========================================================
  // 1. 3-TAB NAVIGATION
  // ========================================================
  const tabBtnTheme = document.getElementById('tab-btn-theme');
  const tabBtnMenu = document.getElementById('tab-btn-menu');
  const tabBtnAttendance = document.getElementById('tab-btn-attendance');

  const tabTheme = document.getElementById('tab-theme');
  const tabMenu = document.getElementById('tab-menu');
  const tabAttendance = document.getElementById('tab-attendance');

  function switchTab(tabId, saveToStorage = true) {
    [tabBtnTheme, tabBtnMenu, tabBtnAttendance].forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-selected', 'false');
    });
    [tabTheme, tabMenu, tabAttendance].forEach(p => p.classList.remove('active'));

    if (tabId === 'tab-menu') {
      tabBtnMenu.classList.add('active');
      tabBtnMenu.setAttribute('aria-selected', 'true');
      tabMenu.classList.add('active');
      const isOfficial = Boolean(currentMenuSource && currentMenuSource.startsWith('rishiverse'));
      if (!currentMenuData || !isOfficial) initMessMenu();
    } else if (tabId === 'tab-attendance') {
      tabBtnAttendance.classList.add('active');
      tabBtnAttendance.setAttribute('aria-selected', 'true');
      tabAttendance.classList.add('active');
      initAttendance();
    } else {
      tabBtnTheme.classList.add('active');
      tabBtnTheme.setAttribute('aria-selected', 'true');
      tabTheme.classList.add('active');
    }

    if (saveToStorage) {
      try {
        chrome.storage.local.set({ activeTab: tabId });
      } catch (e) {}
    }
  }

  tabBtnTheme.addEventListener('click', () => switchTab('tab-theme', true));
  tabBtnMenu.addEventListener('click', () => switchTab('tab-menu', true));
  tabBtnAttendance.addEventListener('click', () => switchTab('tab-attendance', true));

  chrome.storage.local.get(['activeTab'], (res) => {
    switchTab(res.activeTab || 'tab-theme');
  });

  // ========================================================
  // 2. THEME CONTROLLER
  // ========================================================
  const darkToggle = document.getElementById('dark-toggle');
  const statusText = document.getElementById('status-text');
  const btnMidnight = document.getElementById('btn-midnight');
  const btnOled = document.getElementById('btn-oled');
  const quickTogglePref = document.getElementById('quick-toggle-pref');
  const systemThemePref = document.getElementById('system-theme-pref');

  chrome.storage.local.get(
    {
      darkMode: true,
      themeStyle: 'midnight',
      showQuickToggle: true,
      useSystemTheme: false
    },
    (items) => {
      darkToggle.checked = items.darkMode;
      updateStatusDisplay(items.darkMode);
      setActiveStyleButton(items.themeStyle || 'midnight');
      quickTogglePref.checked = items.showQuickToggle;
      systemThemePref.checked = items.useSystemTheme;

      if (items.useSystemTheme) {
        darkToggle.disabled = true;
        statusText.textContent = 'Auto (System)';
        statusText.classList.remove('disabled');
      }
    }
  );

  darkToggle.addEventListener('change', () => {
    try {
      const isDark = darkToggle.checked;
      updateStatusDisplay(isDark);
      chrome.storage.local.set({ darkMode: isDark });
    } catch (e) {
      console.warn('[Rishiverse] Dark mode toggle error:', e);
    }
  });

  btnMidnight.addEventListener('click', () => {
    try {
      setActiveStyleButton('midnight');
      chrome.storage.local.set({ themeStyle: 'midnight' });
    } catch (e) {
      console.warn('[Rishiverse] Midnight button error:', e);
    }
  });

  btnOled.addEventListener('click', () => {
    try {
      setActiveStyleButton('oled');
      chrome.storage.local.set({ themeStyle: 'oled' });
    } catch (e) {
      console.warn('[Rishiverse] OLED button error:', e);
    }
  });

  quickTogglePref.addEventListener('change', () => {
    try {
      chrome.storage.local.set({ showQuickToggle: quickTogglePref.checked });
    } catch (e) {
      console.warn('[Rishiverse] Quick toggle pref error:', e);
    }
  });

  systemThemePref.addEventListener('change', () => {
    try {
      const useSystem = systemThemePref.checked;
      darkToggle.disabled = useSystem;
      if (useSystem) {
        statusText.textContent = 'Auto (System)';
        statusText.classList.remove('disabled');
      } else {
        updateStatusDisplay(darkToggle.checked);
      }
      chrome.storage.local.set({ useSystemTheme: useSystem });
    } catch (e) {
      console.warn('[Rishiverse] System theme pref error:', e);
    }
  });

  function updateStatusDisplay(isDark) {
    if (isDark) {
      statusText.textContent = 'Enabled';
      statusText.classList.remove('disabled');
    } else {
      statusText.textContent = 'Disabled';
      statusText.classList.add('disabled');
    }
  }

  function setActiveStyleButton(style) {
    if (style === 'oled') {
      btnOled.classList.add('active');
      btnMidnight.classList.remove('active');
    } else {
      btnMidnight.classList.add('active');
      btnOled.classList.remove('active');
    }
  }

  // ========================================================
  // 3. MESS MENU CONTROLLER
  // ========================================================
  const menuDayTitle = document.getElementById('menu-day-title');
  const menuDateBadge = document.getElementById('menu-date-badge');
  const menuSyncStatus = document.getElementById('menu-sync-status');
  const btnGotoToday = document.getElementById('btn-goto-today');
  const btnRefreshMenu = document.getElementById('btn-refresh-menu');
  const dayChips = document.querySelectorAll('.day-chip');
  const mealsContainer = document.getElementById('meals-container');

  let currentMenuData = null;
  let currentMenuSource = null;
  let currentMenuLastFetched = null;
  let selectedDay = 'Monday';
  let todayDayName = 'Monday';

  function isSecondaryItem(item) {
    if (!item) return false;
    const name = item.toLowerCase();
    const commonItems = new Set([
      "hot milk", "cold milk", "tea", "coffee powder", "cold coffee", 
      "bread", "butter", "jam", "bread/butter/jam", "green salad", 
      "tossed salad", "cucumber salad", "onion lachha", "laccha pyaaz", 
      "chana sprout salad", "moong sprout salad", "cucumber-carrot salad", 
      "ketchup", "chutney", "green chutney", "pickle", "curd", 
      "sambar", "rasam", "chapati", "rice", "plain rice", 
      "steamed rice", "jeera rice", "ghee rice", "dum pulao sada"
    ]);

    const commonKeywords = [
      "milk", "tea", "bread", "chapati", "rice", 
      "salad", "chutney", "ketchup", "rasam", "sambar"
    ];

    if (commonItems.has(name)) return true;
    return commonKeywords.some(keyword => name.includes(keyword));
  }

  function getMostRecentMondayTimestamp() {
    const now = new Date();
    const day = now.getDay();
    const daysSinceMonday = (day + 6) % 7;
    const recentMonday = new Date(now);
    recentMonday.setDate(now.getDate() - daysSinceMonday);
    recentMonday.setHours(0, 0, 0, 0);
    return recentMonday.getTime();
  }

  function formatLocalYMD(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function getWeekDateMap() {
    const now = new Date();
    const currentDayIndex = (now.getDay() + 6) % 7; // Mon = 0, Sun = 6
    const monday = new Date(now);
    monday.setDate(now.getDate() - currentDayIndex);
    monday.setHours(0, 0, 0, 0);

    const map = {};
    WEEKDAYS.forEach((dayName, idx) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + idx);
      map[dayName] = formatLocalYMD(d);
    });
    return map;
  }

  function parseRishiverseMenuPayload(payload) {
    const timings = payload?.timings || {};
    const todaysmenu = Array.isArray(payload?.todaysmenu) ? payload.todaysmenu : [];

    const meals = {
      breakfast: [],
      lunch: [],
      snacks: [],
      dinner: []
    };

    todaysmenu.forEach(item => {
      const rawType = (item.mealType || item.type || '').toUpperCase();
      let key = null;
      if (rawType.includes('BREAKFAST')) key = 'breakfast';
      else if (rawType.includes('LUNCH')) key = 'lunch';
      else if (rawType.includes('SNACK')) key = 'snacks';
      else if (rawType.includes('DINNER')) key = 'dinner';

      if (key && meals[key]) {
        const text = item.menuItems || item.meal || item.name || '';
        if (text) {
          const dishes = text.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean);
          dishes.forEach(d => {
            if (!meals[key].includes(d)) {
              meals[key].push(d);
            }
          });
        }
      }
    });

    return { meals, timings };
  }

  async function fetchRishiverseMenuDay(token, dateStr) {
    const res = await fetch(`${API_BASE}/mess?date=${dateStr}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    return parseRishiverseMenuPayload(json?.data || json);
  }

  function parsePersistMessMenu(menuMap) {
    if (!menuMap || typeof menuMap !== 'object') return null;
    const weekMap = getWeekDateMap();
    const weeklyMenu = {};
    let totalItems = 0;

    WEEKDAYS.forEach(dayName => {
      const dateStr = weekMap[dayName];
      const dayRaw = menuMap[dateStr] || menuMap[dayName] || menuMap[dayName.toLowerCase()];
      const dayMeals = { breakfast: [], lunch: [], snacks: [], dinner: [] };

      if (dayRaw) {
        if (Array.isArray(dayRaw)) {
          dayRaw.forEach(item => {
            const rawType = (item.mealType || item.type || '').toUpperCase();
            let k = null;
            if (rawType.includes('BREAKFAST')) k = 'breakfast';
            else if (rawType.includes('LUNCH')) k = 'lunch';
            else if (rawType.includes('SNACK')) k = 'snacks';
            else if (rawType.includes('DINNER')) k = 'dinner';
            if (k) {
              const text = item.menuItems || item.meal || item.name || '';
              if (text) {
                text.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean).forEach(d => {
                  if (d !== 'Menu will be updated soon' && !dayMeals[k].includes(d)) {
                    dayMeals[k].push(d);
                  }
                });
              }
            }
          });
        } else if (typeof dayRaw === 'object') {
          Object.entries(dayRaw).forEach(([mKey, mVal]) => {
            const upper = mKey.toUpperCase();
            let k = null;
            if (upper.includes('BREAKFAST')) k = 'breakfast';
            else if (upper.includes('LUNCH')) k = 'lunch';
            else if (upper.includes('SNACK')) k = 'snacks';
            else if (upper.includes('DINNER')) k = 'dinner';
            if (k) {
              let items = [];
              if (Array.isArray(mVal)) items = mVal;
              else if (Array.isArray(mVal?.meals)) items = mVal.meals;
              else if (typeof mVal?.menuItems === 'string') items = mVal.menuItems.split(/[,;\n]+/);
              else if (typeof mVal === 'string') items = mVal.split(/[,;\n]+/);
              items.forEach(rawItem => {
                let text = '';
                if (typeof rawItem === 'string') {
                  text = rawItem;
                } else if (rawItem && typeof rawItem === 'object') {
                  text = rawItem.meal || rawItem.menuItems || rawItem.name || rawItem.item || '';
                }
                if (text) {
                  text.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean).forEach(d => {
                    if (d !== 'Menu will be updated soon' && !dayMeals[k].includes(d)) {
                      dayMeals[k].push(d);
                    }
                  });
                }
              });
            }
          });
        }
      }
      weeklyMenu[dayName] = dayMeals;
      totalItems += Object.values(dayMeals).reduce((s, a) => s + a.length, 0);
    });

    if (totalItems > 0) {
      return { weeklyMenu, totalItems, timestamp: Date.now() };
    }
    return null;
  }

  async function fetchRishiverseWeeklyMenu(token) {
    const weekMap = getWeekDateMap();
    const weeklyMenu = {};
    const timingsByDay = {};
    let successfulDayCount = 0;

    const promises = WEEKDAYS.map(async (dayName) => {
      const dateStr = weekMap[dayName];
      try {
        const { meals, timings } = await fetchRishiverseMenuDay(token, dateStr);
        weeklyMenu[dayName] = meals;
        timingsByDay[dayName] = timings;
        successfulDayCount++;
      } catch (e) {
        weeklyMenu[dayName] = { breakfast: [], lunch: [], snacks: [], dinner: [] };
      }
    });

    await Promise.allSettled(promises);

    const totalItems = Object.values(weeklyMenu).reduce((sum, day) => {
      return sum + Object.values(day).reduce((mSum, arr) => mSum + arr.length, 0);
    }, 0);

    return {
      weeklyMenu,
      timingsByDay,
      totalItems,
      successfulDayCount,
      timestamp: Date.now()
    };
  }

  function isCacheExpired(lastFetched) {
    if (!lastFetched || typeof lastFetched !== 'number') return true;
    if (Date.now() - lastFetched > 7 * 24 * 60 * 60 * 1000) return true;
    return lastFetched < getMostRecentMondayTimestamp();
  }

  async function loadBundledFallback() {
    try {
      const res = await fetch(chrome.runtime.getURL('menu.json'));
      return await res.json();
    } catch (e) {
      return null;
    }
  }

  async function loadMenuData(forceRefresh = false) {
    let cached = null;
    try {
      cached = await chrome.storage.local.get(['mess_menu_data', 'mess_menu_last_fetched', 'mess_menu_source', 'rishiverse_token', 'rishiverse_refresh_token']);
    } catch (e) {}

    const hasCachedData = cached && cached.mess_menu_data && typeof cached.mess_menu_data === 'object';
    const isOfficialSource = Boolean(cached?.mess_menu_source && cached.mess_menu_source.startsWith('rishiverse'));
    const needsRefresh = forceRefresh || !hasCachedData || !isOfficialSource || isCacheExpired(cached.mess_menu_last_fetched);

    if (hasCachedData && isOfficialSource) {
      currentMenuData = cached.mess_menu_data;
      currentMenuSource = cached.mess_menu_source;
      currentMenuLastFetched = cached.mess_menu_last_fetched;
      renderSelectedDayMenu();
      updateMenuStatusDisplay(cached.mess_menu_last_fetched, cached.mess_menu_source);
    }

    if (needsRefresh) {
      btnRefreshMenu?.classList.add('spinning');
      if (menuSyncStatus) menuSyncStatus.textContent = 'Syncing from Rishiverse...';

      let fetchedData = null;
      let fetchedSource = null;
      let fetchedTimings = {};

      // TIER 1: Check if open Rishiverse tab has token, Redux persist menu, or live DOM
      let token = cached?.rishiverse_token;
      try {
        const tabs = await chrome.tabs.query({ url: ['https://rishiverse.rishihood.edu.in/*', '*://*.rishihood.edu.in/*'] });
        if (tabs && tabs.length > 0) {
          const execRes = await chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: extractTabInfo
          });
          const tabInfo = execRes?.[0]?.result;

          if (tabInfo?.rawToken) {
            const dec = decryptTokenString(tabInfo.rawToken);
            if (dec) {
              token = dec;
              chrome.storage.local.set({ rishiverse_token: token });
            }
          }

          if (tabInfo?.persistMenu) {
            const pRes = parsePersistMessMenu(tabInfo.persistMenu);
            if (pRes && pRes.weeklyMenu) {
              fetchedData = pRes.weeklyMenu;
              fetchedSource = 'rishiverse_persist';
            }
          }

          if (!fetchedData && tabInfo?.domMenu) {
            const base = (cached && cached.mess_menu_data && isOfficialSource) ? cached.mess_menu_data : {};
            base[tabInfo.domMenu.dayName] = tabInfo.domMenu.dayMeals;
            fetchedData = base;
            fetchedSource = 'rishiverse_dom';
          }
        }
      } catch (e) {}

      // TIER 2: Official Rishiverse API using active student token
      if (token && (!fetchedData || forceRefresh)) {
        try {
          const apiResult = await fetchRishiverseWeeklyMenu(token);
          if (apiResult && (apiResult.totalItems > 0 || apiResult.successfulDayCount > 0)) {
            fetchedData = apiResult.weeklyMenu;
            fetchedTimings = apiResult.timingsByDay || {};
            fetchedSource = 'rishiverse_api';
          }
        } catch (apiErr) {
          console.warn('[Rishiverse] Official API menu fetch failed:', apiErr);
        }
      }

      // TIER 3: If API didn't return data, try messaging active tab for menu
      if (!fetchedData) {
        try {
          const tabs = await chrome.tabs.query({ url: ['https://rishiverse.rishihood.edu.in/*', '*://*.rishihood.edu.in/*'] });
          if (tabs && tabs.length > 0) {
            const tabResp = await chrome.tabs.sendMessage(tabs[0].id, { action: 'GET_TAB_MENU' });
            if (tabResp && tabResp.success && tabResp.data) {
              fetchedData = tabResp.data;
              fetchedSource = tabResp.source || 'rishiverse_dom';
            }
          }
        } catch (e) {}
      }

      // Save official Rishiverse data to chrome.storage.local
      if (fetchedData && fetchedSource) {
        const now = Date.now();
        currentMenuData = fetchedData;
        currentMenuSource = fetchedSource;
        currentMenuLastFetched = now;

        await chrome.storage.local.set({
          mess_menu_data: fetchedData,
          mess_menu_timings: fetchedTimings,
          mess_menu_last_fetched: now,
          mess_menu_source: fetchedSource,
          ...(token ? { rishiverse_token: token } : {})
        });

        renderSelectedDayMenu();
        updateMenuStatusDisplay(now, fetchedSource);
      } else if (!hasCachedData) {
        // TIER 4: Offline bundled JSON (only if no cache exists at all)
        const fallback = await loadBundledFallback();
        currentMenuData = fallback || {};
        currentMenuSource = 'bundled_fallback';
        currentMenuLastFetched = Date.now();
        renderSelectedDayMenu();
        if (menuSyncStatus) menuSyncStatus.textContent = 'Weekly Menu (Offline fallback)';
      }

      btnRefreshMenu?.classList.remove('spinning');
    }
  }

  function updateMenuStatusDisplay(lastFetchedTimestamp, source = '') {
    if (!menuSyncStatus) return;
    if (!lastFetchedTimestamp) {
      menuSyncStatus.textContent = 'Weekly Menu • Refreshes Mondays';
      return;
    }
    const date = new Date(lastFetchedTimestamp);
    const formatted = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (source && source.includes('rishiverse')) {
      menuSyncStatus.textContent = `Official Rishiverse Menu • Synced ${formatted}`;
    } else {
      menuSyncStatus.textContent = `Synced ${formatted} • Auto-refreshes Mondays`;
    }
  }

  function formatShortDate(dateObj) {
    const weekdayShort = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
    const dayNum = dateObj.getDate();
    const monthShort = dateObj.toLocaleDateString('en-US', { month: 'short' });
    return `${weekdayShort}, ${dayNum} ${monthShort}`;
  }

  function getDateForWeekday(targetDayName) {
    const now = new Date();
    const currentDayIndex = (now.getDay() + 6) % 7;
    const targetDayIndex = WEEKDAYS.indexOf(targetDayName);
    if (targetDayIndex === -1) return now;

    const diffDays = targetDayIndex - currentDayIndex;
    const result = new Date(now);
    result.setDate(now.getDate() + diffDays);
    return result;
  }

  function calculateMealLiveStatus(mealConfig, currentMin, isToday) {
    if (!isToday) return { isServing: false, isNext: false };
    if (currentMin >= mealConfig.startMin && currentMin <= mealConfig.endMin) {
      return { isServing: true, isNext: false };
    }
    if (currentMin < mealConfig.startMin) {
      return { isServing: false, isNext: true };
    }
    return { isServing: false, isNext: false };
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderSelectedDayMenu() {
    if (!mealsContainer) return;

    const now = new Date();
    const currentDayIndex = (now.getDay() + 6) % 7;
    todayDayName = WEEKDAYS[currentDayIndex];
    const isViewingToday = selectedDay === todayDayName;

    if (menuDayTitle) {
      menuDayTitle.textContent = isViewingToday ? 'Today' : selectedDay;
    }
    const targetDate = getDateForWeekday(selectedDay);
    if (menuDateBadge) {
      menuDateBadge.textContent = formatShortDate(targetDate);
    }

    if (btnGotoToday) {
      btnGotoToday.style.display = isViewingToday ? 'none' : 'inline-flex';
    }

    dayChips.forEach(btn => {
      const day = btn.getAttribute('data-day');
      btn.classList.toggle('active', day === selectedDay);
      btn.classList.toggle('is-today', day === todayDayName);
    });

    if (!currentMenuData || !currentMenuData[selectedDay]) {
      mealsContainer.innerHTML = `
        <div class="mess-empty-state">
          <p>No menu data available for ${selectedDay}.</p>
        </div>
      `;
      return;
    }

    const dayMenu = currentMenuData[selectedDay];
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    let nextMealFound = false;
    let cardsHtml = '';

    MEAL_CONFIG.forEach((meal, index) => {
      const mealItems = dayMenu[meal.key] || [];
      const specials = mealItems.filter(item => !isSecondaryItem(item));
      const staples = mealItems.filter(item => isSecondaryItem(item));

      const { isServing, isNext } = calculateMealLiveStatus(meal, currentMinutes, isViewingToday);

      let shouldExpand = false;
      let statusBadgeHtml = '';

      if (isViewingToday) {
        if (isServing) {
          shouldExpand = true;
          statusBadgeHtml = `<span class="meal-status-badge badge-serving">● Serving Now</span>`;
        } else if (isNext && !nextMealFound) {
          shouldExpand = true;
          nextMealFound = true;
          statusBadgeHtml = `<span class="meal-status-badge badge-next">Next Up</span>`;
        }
      } else {
        if (index === 0) shouldExpand = true;
      }

      const specialsChips = specials.length > 0
        ? specials.map(dish => `
            <span class="item-chip special-chip" title="Special item">
              <span class="chip-dot"></span>
              ${escapeHtml(dish)}
            </span>
          `).join('')
        : (staples.length === 0 ? '<span class="item-chip staple-chip">Menu will be updated soon</span>' : '<span class="item-chip staple-chip">Standard items</span>');

      const staplesChips = staples.length > 0
        ? staples.map(dish => `
            <span class="item-chip staple-chip" title="Daily staple">
              ${escapeHtml(dish)}
            </span>
          `).join('')
        : '';

      cardsHtml += `
        <details class="meal-card ${isServing ? 'is-active-meal' : ''}" data-meal="${meal.key}" ${shouldExpand ? 'open' : ''}>
          <summary class="meal-card-header">
            <div class="meal-header-left">
              <div class="meal-icon-wrapper ${meal.iconClass}">
                ${meal.svgIcon}
              </div>
              <div class="meal-info">
                <div class="meal-title-row">
                  <span class="meal-title">${meal.label}</span>
                  ${statusBadgeHtml}
                </div>
                <span class="meal-time">${meal.time}</span>
              </div>
            </div>
            <span class="meal-toggle-btn" aria-hidden="true">
              <svg class="chevron-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </span>
          </summary>

          <div class="meal-card-body">
            <div class="meal-items-section specials-section">
              <div class="section-label">
                <span>✨ Main & Specials</span>
                <span class="item-count-badge">${specials.length}</span>
              </div>
              <div class="items-chip-grid">
                ${specialsChips}
              </div>
            </div>

            ${staples.length > 0 ? `
              <div class="meal-items-section staples-section">
                <div class="section-label">
                  <span>Daily Staples</span>
                  <span class="item-count-badge">${staples.length}</span>
                </div>
                <div class="items-chip-grid">
                  ${staplesChips}
                </div>
              </div>
            ` : ''}
          </div>
        </details>
      `;
    });

    mealsContainer.innerHTML = cardsHtml;
  }

  dayChips.forEach(btn => {
    btn.addEventListener('click', () => {
      selectedDay = btn.getAttribute('data-day');
      renderSelectedDayMenu();
    });
  });

  btnGotoToday?.addEventListener('click', () => {
    selectedDay = todayDayName;
    renderSelectedDayMenu();
  });

  btnRefreshMenu?.addEventListener('click', () => {
    loadMenuData(true);
  });

  function initMessMenu() {
    const now = new Date();
    const currentDayIndex = (now.getDay() + 6) % 7;
    todayDayName = WEEKDAYS[currentDayIndex];
    selectedDay = todayDayName;
    loadMenuData(false);
  }

  // ========================================================
  // 4. LMS ATTENDANCE CONTROLLER
  // ========================================================
  const attOverallBadge = document.getElementById('att-overall-badge');
  const attSyncStatus = document.getElementById('att-sync-status');
  const btnSyncAttendance = document.getElementById('btn-sync-attendance');
  const attTargetPills = document.querySelectorAll('.att-target-pill');
  const attOverallCard = document.getElementById('att-overall-card');
  const overallRingFill = document.getElementById('overall-ring-fill');
  const overallPctText = document.getElementById('overall-pct-text');
  const overallClassesText = document.getElementById('overall-classes-text');
  const overallStatusPill = document.getElementById('overall-status-pill');
  const attCoursesContainer = document.getElementById('att-courses-container');

  let currentTarget = 0.75;
  let cachedAttendanceData = null;

  function decryptTokenString(raw) {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.v === 1 && parsed?.data) {
        const cryptoObj = typeof CryptoJS !== 'undefined' ? CryptoJS : (window.CryptoJS || globalThis.CryptoJS);
        if (cryptoObj && cryptoObj.AES) {
          const bytes = cryptoObj.AES.decrypt(parsed.data, AES_KEY);
          const decrypted = bytes.toString(cryptoObj.enc.Utf8);
          if (decrypted) return decrypted;
        }
      }
      return typeof parsed === 'string' ? parsed : raw;
    } catch (e) {
      return raw;
    }
  }

  function calculateCourseStats(course, target) {
    const held = Math.max(0, Number(course.totalLectures) || 0);
    const present = Math.max(0, Number(course.presentLectures) || 0);
    const excused = Math.max(0, Number(course.excusedLectures) || 0);

    // In Rishiverse LMS, official attended lectures = present + excused
    let attended = present + excused;
    if (attended === 0 && Number(course.attendedLectures) > 0) {
      attended = Number(course.attendedLectures);
    }
    if (held > 0) {
      attended = Math.min(held, Math.max(0, attended));
    }
    const absent = Math.max(0, held - attended);

    const pct = held > 0 ? (attended / held) : null;
    const pctInt = pct !== null ? Math.round(pct * 100) : 0;
    const pctFormatted = pct !== null ? `${(pct * 100).toFixed(1)}%` : '—';

    const EPS = 1e-9;
    const meetsTarget = pct !== null && (pct >= target - EPS);

    // Skips affordable: floor(attended / target) - held
    let skips = 0;
    if (held > 0 && meetsTarget && target > 0) {
      skips = Math.max(0, Math.floor(attended / target + EPS) - held);
    }

    // Classes to recover consecutively: ceil((target * held - attended) / (1 - target))
    let recover = 0;
    if (held > 0 && !meetsTarget && target < 1) {
      const deficit = target * held - attended;
      if (deficit > EPS) {
        recover = Math.ceil(deficit / (1 - target) - EPS);
      }
    }

    return {
      held,
      present,
      excused,
      absent,
      attended,
      pct,
      pctInt,
      pctFormatted,
      meetsTarget,
      skips,
      recover
    };
  }

  function renderAttendanceUI(data) {
    if (!data || !Array.isArray(data.byCourse) || data.byCourse.length === 0) {
      attOverallCard.style.display = 'none';
      renderEmptyState('No attendance courses found on your profile.');
      return;
    }

    const courses = data.byCourse;
    const targetPctInt = Math.round(currentTarget * 100);

    // 1. Calculate overall aggregate metrics
    let totalHeld = 0;
    let totalAttended = 0;
    let totalPresent = 0;
    let totalExcused = 0;
    let atRiskCount = 0;
    let activeCourseCount = 0;

    const courseStatsList = courses.map(c => {
      const stats = calculateCourseStats(c, currentTarget);
      totalHeld += stats.held;
      totalAttended += stats.attended;
      totalPresent += stats.present;
      totalExcused += stats.excused;
      if (stats.held > 0) {
        activeCourseCount++;
        if (!stats.meetsTarget) atRiskCount++;
      }
      return { course: c, stats };
    });

    const overallPct = totalHeld > 0 ? (totalAttended / totalHeld) : null;
    const overallPctFormatted = overallPct !== null ? `${(overallPct * 100).toFixed(1)}%` : '--%';
    const overallPctInt = overallPct !== null ? Math.round(overallPct * 100) : 0;
    const overallSafe = overallPct !== null && (overallPct >= currentTarget - 1e-9);

    // 2. Render Overall Summary Card
    attOverallCard.style.display = 'flex';
    attOverallBadge.textContent = overallPct !== null ? overallPctFormatted : '--%';
    attOverallBadge.className = `att-overall-badge ${overallSafe ? '' : 'low'}`;

    overallPctText.textContent = overallPct !== null ? `${overallPctInt}%` : '--%';
    overallClassesText.textContent = `${totalAttended} / ${totalHeld} attended`;

    const circumference = 2 * Math.PI * 28;
    overallRingFill.style.strokeDasharray = `${circumference} ${circumference}`;
    const offset = circumference - (overallPctInt / 100) * circumference;
    overallRingFill.style.strokeDashoffset = offset;
    overallRingFill.style.stroke = overallSafe ? '#22c55e' : '#ef4444';

    if (totalHeld === 0) {
      overallStatusPill.textContent = 'No classes held yet';
      overallStatusPill.className = 'overall-status-pill';
    } else if (atRiskCount === 0) {
      overallStatusPill.textContent = `✓ All ${activeCourseCount} courses on track (≥ ${targetPctInt}%)`;
      overallStatusPill.className = 'overall-status-pill safe';
    } else {
      overallStatusPill.textContent = `⚠️ ${atRiskCount} ${atRiskCount === 1 ? 'course' : 'courses'} below ${targetPctInt}% target`;
      overallStatusPill.className = 'overall-status-pill danger';
    }

    // 3. Render Course Cards
    let coursesHtml = '';
    courseStatsList.forEach(({ course: c, stats }) => {
      const name = c.courseName || 'Course';
      const code = c.courseCode || '';
      const section = c.section?.name || '';
      const { held, present, excused, absent, attended, pctInt, pctFormatted, meetsTarget, skips, recover } = stats;

      let verdictHtml = '';
      if (held === 0) {
        verdictHtml = `<span class="verdict-tag verdict-neutral">No classes held yet</span>`;
      } else if (meetsTarget) {
        if (skips === 0) {
          verdictHtml = `<span class="verdict-tag verdict-safe">On track (0 skips available — right at ${targetPctInt}% threshold)</span>`;
        } else {
          verdictHtml = `<span class="verdict-tag verdict-safe">Can skip <strong>${skips}</strong> ${skips === 1 ? 'class' : 'classes'} and stay above ${targetPctInt}%</span>`;
        }
      } else {
        verdictHtml = `<span class="verdict-tag verdict-danger">Attend next <strong>${recover}</strong> ${recover === 1 ? 'class' : 'classes'} in a row to reach ${targetPctInt}%</span>`;
      }

      coursesHtml += `
        <div class="att-course-card">
          <div class="course-card-top">
            <div class="course-titles">
              <span class="course-name">${escapeHtml(name)}</span>
              <div class="course-meta-tags">
                ${code ? `<span class="course-code-tag">${escapeHtml(code)}</span>` : ''}
                ${section ? `<span class="course-sec-tag">${escapeHtml(section)}</span>` : ''}
              </div>
            </div>
            <span class="course-pct-badge ${held > 0 ? (meetsTarget ? 'safe' : 'danger') : ''}">
              ${pctFormatted}
            </span>
          </div>

          ${held > 0 ? `
            <div class="course-progress-track">
              <div class="course-progress-fill ${meetsTarget ? 'safe' : 'danger'}" style="width: ${Math.min(100, Math.max(0, pctInt))}%;"></div>
              <div class="course-target-marker" style="left: ${targetPctInt}%;" title="Target: ${targetPctInt}%"></div>
            </div>
          ` : ''}

          <div class="course-stats-row">
            <span class="course-classes-held">
              Classes: <strong>${attended} / ${held}</strong>
            </span>
            <div class="course-pills-wrap">
              <span class="stat-chip chip-present" title="Physically Present">P: ${present}</span>
              ${excused > 0 ? `<span class="stat-chip chip-excused" title="Excused / Approved Leave">E: ${excused}</span>` : ''}
              ${absent > 0 ? `<span class="stat-chip chip-absent" title="Absent / Missed">A: ${absent}</span>` : ''}
            </div>
          </div>

          <div class="course-verdict-bar">
            ${verdictHtml}
          </div>
        </div>
      `;
    });

    attCoursesContainer.innerHTML = coursesHtml;

    if (data.timestamp) {
      const date = new Date(data.timestamp);
      attSyncStatus.textContent = `Synced ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
  }

  function renderEmptyState(msg = 'Please log into Rishiverse to sync your attendance.') {
    attCoursesContainer.innerHTML = `
      <div class="att-empty-state">
        <p>${escapeHtml(msg)}</p>
        <button type="button" id="btn-open-lms" class="att-open-link">
          Open Rishiverse LMS Attendance ↗
        </button>
      </div>
    `;
    document.getElementById('btn-open-lms')?.addEventListener('click', async () => {
      try {
        const allTabs = await chrome.tabs.query({});
        const rTab = allTabs.find(t => t.url && t.url.includes('rishihood.edu.in'));
        if (rTab && rTab.id) {
          await chrome.tabs.update(rTab.id, { active: true, url: 'https://rishiverse.rishihood.edu.in/lms/attendance' });
          if (rTab.windowId) await chrome.windows.update(rTab.windowId, { focused: true });
        } else {
          await chrome.tabs.create({ url: 'https://rishiverse.rishihood.edu.in/lms/attendance' });
        }
      } catch (e) {
        chrome.tabs.create({ url: 'https://rishiverse.rishihood.edu.in/lms/attendance' });
      }
    });
  }

  attTargetPills.forEach(pill => {
    pill.addEventListener('click', () => {
      attTargetPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentTarget = parseFloat(pill.getAttribute('data-target')) || 0.75;
      chrome.storage.local.set({ att_target: currentTarget });
      if (cachedAttendanceData) {
        renderAttendanceUI(cachedAttendanceData);
      }
    });
  });

  // Script executed inside the tab to extract attendance or credentials
  function extractTabInfo() {
    const result = {
      rawToken: null,
      rawRefreshToken: null,
      persistCourses: null,
      persistMenu: null,
      domCourses: null,
      domMenu: null
    };

    // 1. Raw access and refresh tokens
    try {
      result.rawToken = localStorage.getItem('rw_access_token') || sessionStorage.getItem('rw_access_token');
      result.rawRefreshToken = localStorage.getItem('rw_refresh_token') || sessionStorage.getItem('rw_refresh_token');
    } catch (e) {}

    // 2. Check Redux persist:root (contains exact Redux store objects)
    try {
      const root = localStorage.getItem('persist:root');
      if (root) {
        const parsed = JSON.parse(root);
        if (parsed.student) {
          const s = JSON.parse(parsed.student);
          if (s.attendanceSummary?.byCourse?.length > 0) {
            result.persistCourses = s.attendanceSummary.byCourse;
          }
        }
        if (parsed.mess) {
          const m = typeof parsed.mess === 'string' ? JSON.parse(parsed.mess) : parsed.mess;
          const mData = m?.menu || m?.todaysMenu || m?.messMenu || m?.weeklyMenu || m?.data;
          if (mData) result.persistMenu = mData;
        }
      }
    } catch (e) {}

    // 3. Fallback: Precision DOM extraction if on /lms/attendance
    try {
      const cards = document.querySelectorAll('a[href*="/lms/attendance/"]');
      if (cards && cards.length > 0) {
        const list = [];
        cards.forEach(c => {
          const titleEl = c.querySelector('h3');
          const title = titleEl ? titleEl.textContent.trim() : 'Course';

          // Target ONLY the ratio text inside the progress ring (e.g. "18/20")
          const circleSpan = c.querySelector('.relative span.absolute, [class*="text-gray-900"][class*="text-xs"]');
          let held = 0;
          let attended = 0;
          if (circleSpan) {
            const m = circleSpan.textContent.trim().match(/^(\d+)\s*\/\s*(\d+)$/);
            if (m) {
              attended = parseInt(m[1], 10);
              held = parseInt(m[2], 10);
            }
          }

          // Course code and section tags
          const badgeTexts = Array.from(c.querySelectorAll('span'))
            .filter(s => {
              const cls = s.className || '';
              return (cls.includes('bg-gray-100') || cls.includes('rounded-[16px]')) && !s.textContent.includes(':');
            })
            .map(s => s.textContent.trim())
            .filter(Boolean);

          // Percentages for Present and Excused
          const allSpans = Array.from(c.querySelectorAll('span'));
          const pSpan = allSpans.find(s => s.textContent.trim().startsWith('Present:'));
          const eSpan = allSpans.find(s => s.textContent.trim().startsWith('Excused:'));
          const pMatch = pSpan ? pSpan.textContent.match(/Present:\s*(\d+)%/i) : null;
          const eMatch = eSpan ? eSpan.textContent.match(/Excused:\s*(\d+)%/i) : null;

          const pPct = pMatch ? parseInt(pMatch[1], 10) : 0;
          const ePct = eMatch ? parseInt(eMatch[1], 10) : 0;

          const present = held > 0 ? Math.round((pPct / 100) * held) : attended;
          const excused = held > 0 ? Math.round((ePct / 100) * held) : 0;

          if (held > 0 || attended > 0) {
            list.push({
              courseName: title,
              courseCode: badgeTexts[1] || badgeTexts[0] || '',
              section: badgeTexts[0] ? { name: badgeTexts[0] } : null,
              totalLectures: held,
              attendedLectures: attended,
              presentLectures: present,
              excusedLectures: excused
            });
          }
        });
        if (list.length > 0) result.domCourses = list;
      }
    } catch (e) {}

    // 4. Live Mess Menu extraction if on /mess-menu
    try {
      if (window.location.pathname.includes('/mess-menu')) {
        const h2Elements = document.querySelectorAll('h2');
        if (h2Elements && h2Elements.length > 0) {
          const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
          let dayName = null;
          const bodyText = document.body.innerText || '';
          for (const d of days) {
            if (bodyText.includes(d)) {
              dayName = d;
              break;
            }
          }
          if (!dayName) {
            const todayIndex = (new Date().getDay() + 6) % 7;
            dayName = days[todayIndex];
          }

          const dayMeals = { breakfast: [], lunch: [], snacks: [], dinner: [] };
          h2Elements.forEach(h2 => {
            const h2Text = (h2.textContent || '').trim().toUpperCase();
            let key = null;
            if (h2Text.includes('BREAKFAST')) key = 'breakfast';
            else if (h2Text.includes('LUNCH')) key = 'lunch';
            else if (h2Text.includes('SNACK')) key = 'snacks';
            else if (h2Text.includes('DINNER')) key = 'dinner';
            if (!key) return;

            const card = h2.closest('form') || h2.closest('.rounded-2xl') || h2.closest('.rounded-xl') || h2.closest('.rounded-lg') || h2.closest('div.border') || h2.closest('div.shadow') || h2.parentElement?.parentElement;
            if (!card) return;

            const items = card.querySelectorAll('ul li, li');
            items.forEach(li => {
              const dish = (li.textContent || '').trim();
              if (dish && !dish.includes('Menu will be updated soon') && !dish.startsWith('+ Add Item')) {
                dish.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean).forEach(d => {
                  if (!dayMeals[key].includes(d)) dayMeals[key].push(d);
                });
              }
            });
          });

          if (Object.values(dayMeals).some(arr => arr.length > 0)) {
            result.domMenu = { dayName, dayMeals };
          }
        }
      }
    } catch (e) {}

    return result;
  }

  async function fetchAttendanceViaApi(token, refreshToken = null) {
    let currentToken = token;

    async function makeRequest(endpoint) {
      let res = await fetch(`${API_BASE}${endpoint}`, {
        headers: {
          'Authorization': `Bearer ${currentToken}`,
          'Content-Type': 'application/json'
        }
      });

      // If 401 Unauthorized and refresh token available, attempt refresh once
      if (res.status === 401 && refreshToken) {
        try {
          const refRes = await fetch(`${API_BASE}/auth/refresh-session`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken })
          });
          if (refRes.ok) {
            const refData = await refRes.json();
            const newToken = refData?.data?.accessToken || refData?.accessToken;
            if (newToken) {
              currentToken = newToken;
              chrome.storage.local.set({ rishiverse_token: newToken });
              res = await fetch(`${API_BASE}${endpoint}`, {
                headers: {
                  'Authorization': `Bearer ${currentToken}`,
                  'Content-Type': 'application/json'
                }
              });
            }
          }
        } catch (e) {}
      }
      return res;
    }

    const semRes = await makeRequest('/students/self/academics/semesters');
    if (!semRes.ok) throw new Error(`Semesters HTTP ${semRes.status}`);
    const semData = await semRes.json();

    let semList = [];
    if (Array.isArray(semData?.data?.semesters)) semList = semData.data.semesters;
    else if (Array.isArray(semData?.semesters)) semList = semData.semesters;
    else if (Array.isArray(semData?.data)) semList = semData.data;
    else if (Array.isArray(semData)) semList = semData;
    if (!semList.length) semList = [{ number: 1 }];

    const numbers = semList.map(s => typeof s === 'number' ? s : s?.number).filter(n => typeof n === 'number' && !isNaN(n));
    const currentSem = numbers.length > 0 ? Math.max(...numbers) : 1;

    const attRes = await makeRequest(`/students/self/${currentSem}/attendance/summary`);
    if (!attRes.ok) throw new Error(`Attendance HTTP ${attRes.status}`);
    const attData = await attRes.json();

    const byCourse = attData?.data?.byCourse || attData?.byCourse || (Array.isArray(attData?.data) ? attData.data : []);

    return {
      semesterNumber: currentSem,
      semesters: numbers.length > 0 ? numbers : [1],
      byCourse,
      timestamp: Date.now()
    };
  }

  async function syncAttendance() {
    btnSyncAttendance?.classList.add('spinning');
    attSyncStatus.textContent = 'Syncing...';

    try {
      let resultData = null;

      // STEP 1: Query any open Rishiverse tab with multi-pattern fallback
      let tabs = [];
      try {
        tabs = await chrome.tabs.query({ url: ['https://rishiverse.rishihood.edu.in/*', '*://*.rishihood.edu.in/*'] });
      } catch (e) {
        tabs = [];
      }
      if (!tabs || tabs.length === 0) {
        try {
          const allTabs = await chrome.tabs.query({});
          tabs = (allTabs || []).filter(t => t.url && t.url.includes('rishihood.edu.in'));
        } catch (e) {}
      }

      if (tabs && tabs.length > 0) {
        for (const tab of tabs) {
          try {
            const execResult = await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: extractTabInfo
            });

            const res = execResult?.[0]?.result;
            if (res) {
              // PRIORITY 1: Authenticated API Fetch (Authoritative Database Record)
              if (res.rawToken) {
                const decToken = decryptTokenString(res.rawToken);
                const decRefreshToken = decryptTokenString(res.rawRefreshToken);
                if (decToken) {
                  chrome.storage.local.set({ rishiverse_token: decToken });
                  if (decRefreshToken) chrome.storage.local.set({ rishiverse_refresh_token: decRefreshToken });
                  try {
                    const apiData = await fetchAttendanceViaApi(decToken, decRefreshToken);
                    if (apiData && Array.isArray(apiData.byCourse) && apiData.byCourse.length > 0) {
                      resultData = apiData;
                      break;
                    }
                  } catch (apiErr) {
                    console.warn('[Rishiverse] API fetch failed, falling back to cache:', apiErr);
                  }
                }
              }

              // PRIORITY 2: Redux Persist Cache (Direct Structured State)
              if (!resultData && res.persistCourses && res.persistCourses.length > 0) {
                resultData = { byCourse: res.persistCourses, timestamp: Date.now(), source: 'persist' };
                break;
              }

              // PRIORITY 3: Targeted DOM Extraction (Emergency Fallback)
              if (!resultData && res.domCourses && res.domCourses.length > 0) {
                resultData = { byCourse: res.domCourses, timestamp: Date.now(), source: 'dom' };
                break;
              }
            }
          } catch (e) {
            console.warn('[Rishiverse] executeScript error:', e);
          }
        }
      }

      // STEP 2: If no active tab extraction, check cached token in storage
      if (!resultData) {
        const stored = await chrome.storage.local.get(['rishiverse_token', 'rishiverse_refresh_token']);
        if (stored.rishiverse_token) {
          resultData = await fetchAttendanceViaApi(stored.rishiverse_token, stored.rishiverse_refresh_token);
        }
      }

      // STEP 3: Handle outcome
      if (resultData && Array.isArray(resultData.byCourse) && resultData.byCourse.length > 0) {
        cachedAttendanceData = resultData;
        await chrome.storage.local.set({
          rishiverse_attendance: resultData,
          rishiverse_attendance_timestamp: Date.now()
        });
        renderAttendanceUI(cachedAttendanceData);
      } else {
        attSyncStatus.textContent = 'Not connected';
        if (!cachedAttendanceData) {
          renderEmptyState('Please open Rishiverse in a tab and log in so the extension can read your courses.');
        }
      }
    } catch (err) {
      console.warn('[Rishiverse] Sync failed:', err);
      attSyncStatus.textContent = 'Sync error';
      if (!cachedAttendanceData) {
        renderEmptyState(`Sync failed: ${err.message || 'Please check your connection and log in.'}`);
      }
    } finally {
      btnSyncAttendance?.classList.remove('spinning');
    }
  }

  btnSyncAttendance?.addEventListener('click', syncAttendance);

  function initAttendance() {
    chrome.storage.local.get(['rishiverse_attendance', 'att_target', 'rishiverse_attendance_timestamp'], (res) => {
      if (res.att_target) {
        currentTarget = res.att_target;
        attTargetPills.forEach(p => {
          p.classList.toggle('active', parseFloat(p.getAttribute('data-target')) === currentTarget);
        });
      }

      if (res.rishiverse_attendance_timestamp && attSyncStatus) {
        const d = new Date(res.rishiverse_attendance_timestamp);
        attSyncStatus.textContent = `Synced ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      }

      if (res.rishiverse_attendance && res.rishiverse_attendance.byCourse) {
        cachedAttendanceData = res.rishiverse_attendance;
        renderAttendanceUI(cachedAttendanceData);
      } else {
        syncAttendance();
      }
    });
  }

  // ========================================================
  // 5. BIDIRECTIONAL TWO-WAY LIVE STORAGE SYNCHRONIZATION
  // ========================================================
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
      if (changes.darkMode !== undefined) {
        darkToggle.checked = changes.darkMode.newValue;
        updateStatusDisplay(changes.darkMode.newValue);
      }
      if (changes.themeStyle !== undefined) {
        setActiveStyleButton(changes.themeStyle.newValue);
      }
      if (changes.showQuickToggle !== undefined) {
        quickTogglePref.checked = changes.showQuickToggle.newValue;
      }
      if (changes.useSystemTheme !== undefined) {
        systemThemePref.checked = changes.useSystemTheme.newValue;
        darkToggle.disabled = changes.useSystemTheme.newValue;
        if (changes.useSystemTheme.newValue) {
          statusText.textContent = 'Auto (System)';
          statusText.classList.remove('disabled');
        } else {
          updateStatusDisplay(darkToggle.checked);
        }
      }
      if (changes.activeTab !== undefined) {
        switchTab(changes.activeTab.newValue, false);
      }
      if (changes.mess_menu_data !== undefined || changes.mess_menu_source !== undefined || changes.mess_menu_last_fetched !== undefined) {
        chrome.storage.local.get(['mess_menu_data', 'mess_menu_last_fetched', 'mess_menu_source'], (res) => {
          if (res.mess_menu_data) {
            currentMenuData = res.mess_menu_data;
            currentMenuSource = res.mess_menu_source || null;
            currentMenuLastFetched = res.mess_menu_last_fetched || null;
            renderSelectedDayMenu();
            updateMenuStatusDisplay(currentMenuLastFetched, currentMenuSource);
          }
        });
      }
      if (changes.att_target !== undefined) {
        currentTarget = parseFloat(changes.att_target.newValue) || 0.75;
        attTargetPills.forEach(p => {
          const val = parseFloat(p.getAttribute('data-target')) || 0.75;
          p.classList.toggle('active', Math.abs(val - currentTarget) < 0.001);
        });
        if (cachedAttendanceData) {
          renderAttendanceUI(cachedAttendanceData);
        }
      }
      if (changes.rishiverse_attendance !== undefined) {
        cachedAttendanceData = changes.rishiverse_attendance.newValue;
        if (cachedAttendanceData && cachedAttendanceData.byCourse) {
          renderAttendanceUI(cachedAttendanceData);
        }
      }
      if (changes.rishiverse_attendance_timestamp !== undefined && attSyncStatus) {
        const d = new Date(changes.rishiverse_attendance_timestamp.newValue);
        attSyncStatus.textContent = `Synced ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      }
    }
  });
});
