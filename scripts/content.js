/**
 * Rishiverse-Extension - Content Script
 * Injected into https://rishiverse.rishihood.edu.in/*
 * Features:
 *  - Dark Theme engine (Midnight Charcoal & OLED Black) with hotkey Alt+Shift+D
 *  - In-Page Floating Companion Widget (FAB + Popup Modal with Menu, Attendance & Theme)
 *  - Campus Mess Menu with 7-day selector & live meal detection
 *  - LMS Attendance Tracker with verified math, target margins, and live sync
 */

(function () {
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

  let currentSettings = {
    darkMode: true,
    themeStyle: 'midnight',
    showQuickToggle: true,
    useSystemTheme: false
  };

  // ========================================================
  // 1. THEME APPLICATION & SYNC
  // ========================================================
  function applyTheme(settings) {
    const root = document.documentElement;
    let isDark = settings.darkMode;

    if (settings.useSystemTheme) {
      isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    if (isDark) {
      root.classList.add('dark');
      root.setAttribute('data-rishiverse-dark', 'true');
      root.setAttribute('data-theme-style', settings.themeStyle || 'midnight');
    } else {
      root.classList.remove('dark');
      root.removeAttribute('data-rishiverse-dark');
      root.removeAttribute('data-theme-style');
    }

    if (!settings.showQuickToggle) {
      root.setAttribute('data-hide-quick-toggle', 'true');
    } else {
      root.removeAttribute('data-hide-quick-toggle');
    }

    updateWidgetThemeState(settings);
  }

  // Pre-apply cached dark mode and style before DOM loads to prevent flash
  try {
    const cachedState = localStorage.getItem('rishiverse_ext_dark');
    const cachedStyle = localStorage.getItem('rishiverse_ext_style') || 'midnight';
    if (cachedState === null || cachedState === 'true') {
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-rishiverse-dark', 'true');
      document.documentElement.setAttribute('data-theme-style', cachedStyle);
    }
  } catch (e) {}

  function isExtensionContextValid() {
    return Boolean(typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id);
  }

  function safeStorageSet(data, callback) {
    try {
      if (isExtensionContextValid() && chrome.storage && chrome.storage.local) {
        chrome.storage.local.set(data, () => {
          if (chrome.runtime?.lastError) {
            // Silently suppress invalidated context errors
          }
          if (typeof callback === 'function') callback();
        });
      }
    } catch (e) {
      // Prevent unhandled exceptions from broken context
    }
  }

  if (isExtensionContextValid() && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(
      {
        darkMode: true,
        themeStyle: 'midnight',
        showQuickToggle: true,
        useSystemTheme: false
      },
      (items) => {
        currentSettings = items;
        try {
          localStorage.setItem('rishiverse_ext_dark', items.darkMode);
          localStorage.setItem('rishiverse_ext_style', items.themeStyle || 'midnight');
        } catch (e) {}
        applyTheme(currentSettings);
      }
    );
  } else {
    try {
      const cachedDark = localStorage.getItem('rishiverse_ext_dark');
      const cachedStyle = localStorage.getItem('rishiverse_ext_style');
      if (cachedDark !== null) currentSettings.darkMode = cachedDark === 'true';
      if (cachedStyle) currentSettings.themeStyle = cachedStyle;
    } catch (e) {}
    applyTheme(currentSettings);
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
      let themeChanged = false;
      if (changes.darkMode !== undefined) {
        currentSettings.darkMode = changes.darkMode.newValue;
        themeChanged = true;
      }
      if (changes.themeStyle !== undefined) {
        currentSettings.themeStyle = changes.themeStyle.newValue;
        themeChanged = true;
      }
      if (changes.showQuickToggle !== undefined) {
        currentSettings.showQuickToggle = changes.showQuickToggle.newValue;
        themeChanged = true;
      }
      if (changes.useSystemTheme !== undefined) {
        currentSettings.useSystemTheme = changes.useSystemTheme.newValue;
        themeChanged = true;
      }

      if (themeChanged) {
        try {
          localStorage.setItem('rishiverse_ext_dark', currentSettings.darkMode);
        } catch (e) {}
        applyTheme(currentSettings);
        if (shadowRoot) updateWidgetThemeState(currentSettings);
      }

      if (changes.activeTab !== undefined && shadowRoot) {
        switchWidgetTab(changes.activeTab.newValue, false);
      }

      if ((changes.mess_menu_data !== undefined || changes.mess_menu_source !== undefined || changes.mess_menu_last_fetched !== undefined) && shadowRoot) {
        if (changes.mess_menu_data !== undefined) cachedMenuData = changes.mess_menu_data.newValue;
        if (changes.mess_menu_source !== undefined) cachedMenuSource = changes.mess_menu_source.newValue;
        if (changes.mess_menu_last_fetched !== undefined) cachedMenuLastFetched = changes.mess_menu_last_fetched.newValue;
        renderWidgetMenu();
        updateWidgetMenuStatus(cachedMenuLastFetched, cachedMenuSource);
      }

      if ((changes.rishiverse_attendance !== undefined || changes.att_target !== undefined || changes.rishiverse_attendance_timestamp !== undefined) && shadowRoot) {
        chrome.storage.local.get(['rishiverse_attendance', 'att_target', 'rishiverse_attendance_timestamp'], (res) => {
          if (res.att_target !== undefined) {
            currentAttendanceTarget = res.att_target;
            updateWidgetTargetPills();
          }
          if (res.rishiverse_attendance) {
            cachedAttendanceData = res.rishiverse_attendance;
            renderWidgetAttendance(cachedAttendanceData);
          }
          if (res.rishiverse_attendance_timestamp) {
            const syncStatus = shadowRoot.getElementById('rv-att-sync-status');
            if (syncStatus) {
              const d = new Date(res.rishiverse_attendance_timestamp);
              syncStatus.textContent = `Synced ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
            }
          }
        });
      }
    }
  });

  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      if (currentSettings.useSystemTheme) {
        applyTheme(currentSettings);
      }
    });
  }

  // Persistent MutationObserver ensures React hydration doesn't strip the .dark class
  const themeObserver = new MutationObserver(() => {
    let isDark = currentSettings.darkMode;
    if (currentSettings.useSystemTheme && window.matchMedia) {
      isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    const root = document.documentElement;
    if (isDark && !root.classList.contains('dark')) {
      root.classList.add('dark');
      root.setAttribute('data-rishiverse-dark', 'true');
    }
  });

  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class', 'data-rishiverse-dark']
  });

  // Global Alt+Shift+D keyboard shortcut
  window.addEventListener('keydown', (e) => {
    if (e.altKey && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
      e.preventDefault();
      const nextState = !currentSettings.darkMode;
      currentSettings.darkMode = nextState;
      currentSettings.useSystemTheme = false;
      chrome.storage.local.set({ darkMode: nextState, useSystemTheme: false });
      applyTheme(currentSettings);
    }
  });

  // ========================================================
  // 2. IN-PAGE COMPANION WIDGET (SHADOW DOM ENCAPSULATION)
  // ========================================================
  let shadowRoot = null;
  let isWidgetOpen = false;
  let activeTabId = 'tab-menu';
  let cachedMenuData = null;
  let cachedMenuSource = null;
  let cachedMenuLastFetched = null;
  const _initDate = new Date();
  const _initDayIndex = (_initDate.getDay() + 6) % 7;
  let todayDayName = WEEKDAYS[_initDayIndex];
  let selectedMenuDay = todayDayName;
  let cachedAttendanceData = null;
  let currentAttendanceTarget = 0.75;

  const WIDGET_CSS = `
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
    }

    .rv-widget-host {
      position: fixed;
      bottom: 0;
      right: 0;
      z-index: 2147483647;
      pointer-events: none;
    }

    /* Floating Action Button (FAB) */
    .rv-fab {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      border: 1px solid rgba(255, 255, 255, 0.18);
      background: linear-gradient(135deg, #c45a10, #e0762a);
      color: #ffffff;
      box-shadow: 0 6px 20px rgba(196, 90, 16, 0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      pointer-events: auto;
      transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
      outline: none;
      z-index: 2147483647;
    }

    .rv-fab:hover {
      transform: scale(1.08);
      box-shadow: 0 8px 24px rgba(196, 90, 16, 0.6);
    }

    .rv-fab:active {
      transform: scale(0.95);
    }

    .rv-fab.open {
      background: #1f2430;
      border-color: #3b4356;
      color: #f3f4f6;
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.5);
    }

    .rv-fab svg {
      width: 22px;
      height: 22px;
      transition: transform 0.25s ease;
    }

    /* In-Page Popup Card */
    .rv-card {
      position: fixed;
      bottom: 82px;
      right: 24px;
      width: 380px;
      max-width: calc(100vw - 32px);
      height: 580px;
      max-height: calc(100vh - 100px);
      background: #0f1117;
      color: #f3f4f6;
      border: 1px solid #282d3d;
      border-radius: 16px;
      box-shadow: 0 16px 48px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(255, 255, 255, 0.06);
      display: flex;
      flex-direction: column;
      overflow: hidden;
      pointer-events: auto;
      user-select: none;
      opacity: 0;
      transform: translateY(12px) scale(0.96);
      visibility: hidden;
      transition: opacity 0.22s cubic-bezier(0.4, 0, 0.2, 1), transform 0.22s cubic-bezier(0.4, 0, 0.2, 1), visibility 0.22s;
      z-index: 2147483646;
    }

    .rv-card.open {
      opacity: 1;
      transform: translateY(0) scale(1);
      visibility: visible;
    }

    .rv-card.oled {
      background: #000000;
      border-color: #1f2430;
    }

    /* Header & Navigation */
    .rv-header {
      background: #141722;
      border-bottom: 1px solid #282d3d;
      padding: 12px 14px 10px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .rv-card.oled .rv-header {
      background: #07080a;
      border-color: #1a1e28;
    }

    .rv-brand-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .rv-brand-left {
      display: flex;
      align-items: center;
      gap: 9px;
    }

    .rv-logo-badge {
      width: 30px;
      height: 30px;
      background: linear-gradient(135deg, #c45a10, #e0762a);
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #ffffff;
      box-shadow: 0 3px 8px rgba(196, 90, 16, 0.35);
    }

    .rv-brand-titles {
      display: flex;
      flex-direction: column;
    }

    .rv-brand-main {
      font-size: 13.5px;
      font-weight: 700;
      color: #ffffff;
      letter-spacing: -0.2px;
    }

    .rv-brand-sub {
      font-size: 10px;
      color: #9ca3af;
    }

    .rv-close-btn {
      background: transparent;
      border: none;
      color: #9ca3af;
      cursor: pointer;
      width: 28px;
      height: 28px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s;
    }

    .rv-close-btn:hover {
      background: #252b3a;
      color: #ffffff;
    }

    /* 3-Tab Selector Pills */
    .rv-tab-pills {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      background: #181b24;
      padding: 3px;
      border-radius: 10px;
      border: 1px solid #282d3d;
      gap: 3px;
    }

    .rv-card.oled .rv-tab-pills {
      background: #0d0f14;
      border-color: #1f2430;
    }

    .rv-tab-btn {
      background: transparent;
      border: none;
      color: #9ca3af;
      padding: 6px 4px;
      border-radius: 7px;
      font-size: 11.5px;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      outline: none;
    }

    .rv-tab-btn:hover {
      color: #f3f4f6;
    }

    .rv-tab-btn.active {
      background: #252b3a;
      color: #ffffff;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
      border: 1px solid #363e52;
    }

    .rv-tab-btn.active svg {
      color: #c45a10;
    }

    /* Content Area & Scrollbar */
    .rv-content-area {
      flex: 1;
      overflow-y: auto;
      padding: 13px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .rv-content-area::-webkit-scrollbar {
      width: 5px;
    }

    .rv-content-area::-webkit-scrollbar-thumb {
      background: #282d3d;
      border-radius: 3px;
    }

    .rv-tab-pane {
      display: none;
      flex-direction: column;
      gap: 12px;
    }

    .rv-tab-pane.active {
      display: flex;
    }

    /* Card Component */
    .rv-subcard {
      background: #181b24;
      border: 1px solid #282d3d;
      border-radius: 12px;
      padding: 12px 14px;
    }

    .rv-card.oled .rv-subcard {
      background: #0b0c10;
      border-color: #1e222e;
    }

    /* ========================================================
       TAB 1: MESS MENU STYLES
       ======================================================== */
    .rv-menu-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }

    .rv-menu-day-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .rv-menu-day-title {
      font-size: 15px;
      font-weight: 700;
      color: #ffffff;
    }

    .rv-menu-date-badge {
      font-size: 11px;
      font-weight: 500;
      background: #252b3a;
      color: #9ca3af;
      padding: 2px 7px;
      border-radius: 6px;
      border: 1px solid #363e52;
    }

    .rv-menu-sync-status {
      font-size: 10px;
      color: #9ca3af;
    }

    .rv-menu-actions {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .rv-action-btn {
      background: #181b24;
      border: 1px solid #282d3d;
      color: #d1d5db;
      padding: 5px 9px;
      border-radius: 7px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      transition: all 0.15s;
    }

    .rv-action-btn:hover {
      background: #252b3a;
      color: #ffffff;
      border-color: #3b4356;
    }

    .rv-action-btn.today-btn {
      background: rgba(196, 90, 16, 0.15);
      border-color: rgba(196, 90, 16, 0.4);
      color: #f97316;
    }

    .rv-action-btn.today-btn:hover {
      background: rgba(196, 90, 16, 0.25);
    }

    .rv-day-selector {
      display: flex;
      gap: 4px;
      overflow-x: auto;
      padding-bottom: 2px;
    }

    .rv-day-selector::-webkit-scrollbar {
      height: 3px;
    }

    .rv-day-chip {
      background: #181b24;
      border: 1px solid #282d3d;
      color: #9ca3af;
      padding: 6px 9px;
      border-radius: 8px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      flex: 1;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 3px;
      transition: all 0.15s;
    }

    .rv-day-chip:hover {
      background: #252b3a;
      color: #e5e7eb;
    }

    .rv-day-chip.active {
      background: #c45a10;
      color: #ffffff;
      border-color: #c45a10;
      box-shadow: 0 2px 8px rgba(196, 90, 16, 0.35);
    }

    .rv-day-chip.is-today .rv-today-dot {
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: #10b981;
    }

    .rv-day-chip.active.is-today .rv-today-dot {
      background: #ffffff;
    }

    .rv-meals-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .rv-meal-card {
      background: #181b24;
      border: 1px solid #282d3d;
      border-radius: 12px;
      overflow: hidden;
      transition: border-color 0.2s;
    }

    .rv-card.oled .rv-meal-card {
      background: #0b0c10;
      border-color: #1e222e;
    }

    .rv-meal-card.is-active-meal {
      border-color: #c45a10;
      box-shadow: 0 0 0 1px rgba(196, 90, 16, 0.2);
    }

    .rv-meal-summary {
      list-style: none;
      padding: 10px 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: pointer;
    }

    .rv-meal-summary::-webkit-details-marker {
      display: none;
    }

    .rv-meal-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .rv-meal-icon {
      width: 30px;
      height: 30px;
      border-radius: 8px;
      background: #252b3a;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #d1d5db;
    }

    .rv-meal-icon svg {
      width: 15px;
      height: 15px;
    }

    .rv-meal-icon-breakfast { background: rgba(251, 191, 36, 0.15); color: #fbbf24; }
    .rv-meal-icon-lunch { background: rgba(34, 197, 94, 0.15); color: #22c55e; }
    .rv-meal-icon-snacks { background: rgba(168, 85, 247, 0.15); color: #a855f7; }
    .rv-meal-icon-dinner { background: rgba(59, 130, 246, 0.15); color: #3b82f6; }

    .rv-meal-title-row {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .rv-meal-title {
      font-size: 13px;
      font-weight: 600;
      color: #ffffff;
    }

    .rv-meal-time {
      font-size: 10.5px;
      color: #9ca3af;
    }

    .rv-meal-badge {
      font-size: 9.5px;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: 4px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    .rv-badge-serving {
      background: rgba(34, 197, 94, 0.2);
      color: #22c55e;
      border: 1px solid rgba(34, 197, 94, 0.3);
    }

    .rv-badge-next {
      background: rgba(196, 90, 16, 0.2);
      color: #f97316;
      border: 1px solid rgba(196, 90, 16, 0.3);
    }

    .rv-chevron {
      color: #6b7280;
      transition: transform 0.2s ease;
    }

    .rv-meal-card[open] .rv-chevron {
      transform: rotate(180deg);
    }

    .rv-meal-body {
      padding: 8px 12px 12px;
      border-top: 1px solid #232838;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .rv-section-head {
      font-size: 10.5px;
      font-weight: 600;
      color: #9ca3af;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .rv-chips-wrap {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
    }

    .rv-dish-chip {
      font-size: 11px;
      padding: 3px 8px;
      border-radius: 6px;
      background: #252b3a;
      color: #e5e7eb;
      border: 1px solid #363e52;
    }

    .rv-special-chip {
      background: rgba(196, 90, 16, 0.15);
      border-color: rgba(196, 90, 16, 0.35);
      color: #ffedd5;
      font-weight: 500;
    }

    .rv-staple-chip {
      background: #1f2430;
      color: #9ca3af;
      border-color: #2b3244;
      font-size: 10.5px;
    }

    /* ========================================================
       TAB 2: LMS ATTENDANCE STYLES
       ======================================================== */
    .rv-att-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .rv-att-title-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .rv-att-title {
      font-size: 15px;
      font-weight: 700;
      color: #ffffff;
    }

    .rv-att-overall-badge {
      font-size: 11.5px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 6px;
      background: rgba(34, 197, 94, 0.15);
      color: #22c55e;
      border: 1px solid rgba(34, 197, 94, 0.3);
    }

    .rv-att-overall-badge.low {
      background: rgba(239, 68, 68, 0.15);
      color: #ef4444;
      border-color: rgba(239, 68, 68, 0.3);
    }

    .rv-target-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background: #181b24;
      border: 1px solid #282d3d;
      border-radius: 10px;
      padding: 6px 10px;
    }

    .rv-card.oled .rv-target-bar {
      background: #0b0c10;
      border-color: #1e222e;
    }

    .rv-target-label {
      font-size: 11.5px;
      font-weight: 600;
      color: #9ca3af;
    }

    .rv-target-pills {
      display: flex;
      gap: 4px;
    }

    .rv-target-pill {
      background: #252b3a;
      border: 1px solid #363e52;
      color: #9ca3af;
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s;
    }

    .rv-target-pill:hover {
      color: #ffffff;
      border-color: #4b5563;
    }

    .rv-target-pill.active {
      background: #c45a10;
      color: #ffffff;
      border-color: #c45a10;
    }

    .rv-att-overall-card {
      display: flex;
      align-items: center;
      gap: 14px;
      background: #181b24;
      border: 1px solid #282d3d;
      border-radius: 12px;
      padding: 12px 14px;
    }

    .rv-card.oled .rv-att-overall-card {
      background: #0b0c10;
      border-color: #1e222e;
    }

    .rv-ring-wrap {
      position: relative;
      width: 58px;
      height: 58px;
      flex-shrink: 0;
    }

    .rv-progress-ring {
      width: 58px;
      height: 58px;
      transform: rotate(-90deg);
    }

    .rv-ring-bg {
      fill: none;
      stroke: #252b3a;
      stroke-width: 5;
    }

    .rv-ring-fill {
      fill: none;
      stroke: #22c55e;
      stroke-width: 5;
      stroke-linecap: round;
      transition: stroke-dashoffset 0.4s ease, stroke 0.3s;
    }

    .rv-ring-text {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 700;
      color: #ffffff;
    }

    .rv-overall-info {
      display: flex;
      flex-direction: column;
      gap: 4px;
      flex: 1;
    }

    .rv-overall-line {
      font-size: 12px;
      color: #9ca3af;
    }

    .rv-overall-line strong {
      color: #ffffff;
    }

    .rv-overall-status {
      font-size: 11px;
      font-weight: 600;
      padding: 2px 7px;
      border-radius: 5px;
      display: inline-block;
      width: fit-content;
    }

    .rv-overall-status.safe {
      background: rgba(34, 197, 94, 0.15);
      color: #22c55e;
      border: 1px solid rgba(34, 197, 94, 0.3);
    }

    .rv-overall-status.danger {
      background: rgba(239, 68, 68, 0.15);
      color: #ef4444;
      border: 1px solid rgba(239, 68, 68, 0.3);
    }

    .rv-courses-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .rv-course-card {
      background: #181b24;
      border: 1px solid #282d3d;
      border-radius: 12px;
      padding: 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .rv-card.oled .rv-course-card {
      background: #0b0c10;
      border-color: #1e222e;
    }

    .rv-course-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 8px;
    }

    .rv-course-name {
      font-size: 12.5px;
      font-weight: 600;
      color: #ffffff;
      line-height: 1.35;
    }

    .rv-course-tags {
      display: flex;
      gap: 4px;
      margin-top: 3px;
    }

    .rv-tag-code {
      font-size: 9.5px;
      background: #252b3a;
      color: #9ca3af;
      padding: 1px 5px;
      border-radius: 4px;
    }

    .rv-course-pct {
      font-size: 12.5px;
      font-weight: 700;
      padding: 2px 7px;
      border-radius: 6px;
      white-space: nowrap;
    }

    .rv-course-pct.safe {
      background: rgba(34, 197, 94, 0.15);
      color: #22c55e;
    }

    .rv-course-pct.danger {
      background: rgba(239, 68, 68, 0.15);
      color: #ef4444;
    }

    .rv-track-bar {
      position: relative;
      height: 7px;
      background: #252b3a;
      border-radius: 4px;
      overflow: visible;
    }

    .rv-track-fill {
      height: 100%;
      border-radius: 4px;
      transition: width 0.3s ease;
    }

    .rv-track-fill.safe { background: #22c55e; }
    .rv-track-fill.danger { background: #ef4444; }

    .rv-target-marker {
      position: absolute;
      top: -3px;
      bottom: -3px;
      width: 2px;
      background: #fbbf24;
      border-radius: 1px;
      z-index: 2;
    }

    .rv-course-stats-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 11px;
      color: #9ca3af;
    }

    .rv-stats-pills {
      display: flex;
      gap: 4px;
    }

    .rv-mini-pill {
      font-size: 10px;
      font-weight: 600;
      padding: 1px 5px;
      border-radius: 4px;
    }

    .rv-pill-p { background: rgba(34, 197, 94, 0.15); color: #22c55e; }
    .rv-pill-e { background: rgba(59, 130, 246, 0.15); color: #3b82f6; }
    .rv-pill-a { background: rgba(239, 68, 68, 0.15); color: #ef4444; }

    .rv-verdict-bar {
      padding-top: 4px;
      border-top: 1px solid #232838;
      font-size: 11px;
      line-height: 1.4;
    }

    .rv-verdict-safe { color: #22c55e; }
    .rv-verdict-danger { color: #f87171; }
    .rv-verdict-neutral { color: #9ca3af; }

    /* ========================================================
       TAB 3: THEME CONTROLS STYLES
       ======================================================== */
    .rv-switch-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .rv-switch-left {
      display: flex;
      flex-direction: column;
    }

    .rv-switch-label {
      font-size: 13px;
      font-weight: 600;
      color: #ffffff;
    }

    .rv-switch-sub {
      font-size: 11px;
      color: #10b981;
      font-weight: 500;
    }

    .rv-switch-sub.disabled {
      color: #9ca3af;
    }

    .rv-toggle {
      position: relative;
      display: inline-block;
      width: 44px;
      height: 24px;
      cursor: pointer;
    }

    .rv-toggle input {
      opacity: 0;
      width: 0;
      height: 0;
    }

    .rv-slider {
      position: absolute;
      inset: 0;
      background-color: #2e3547;
      border-radius: 24px;
      transition: 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .rv-slider:before {
      position: absolute;
      content: "";
      height: 18px;
      width: 18px;
      left: 3px;
      bottom: 3px;
      background-color: white;
      border-radius: 50%;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
      transition: 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .rv-toggle input:checked + .rv-slider {
      background-color: #c45a10;
    }

    .rv-toggle input:checked + .rv-slider:before {
      transform: translateX(20px);
    }

    .rv-section-title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: #9ca3af;
    }

    .rv-palettes-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }

    .rv-palette-btn {
      background: #181b24;
      border: 1px solid #282d3d;
      color: #d1d5db;
      padding: 8px 10px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }

    .rv-card.oled .rv-palette-btn {
      background: #0b0c10;
      border-color: #1e222e;
    }

    .rv-palette-btn.active {
      border-color: #c45a10;
      background: #252b3a;
      color: #ffffff;
    }

    .rv-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }

    .rv-dot-midnight { background: #1f2430; border: 1px solid #3b4356; }
    .rv-dot-oled { background: #000000; border: 1px solid #ffffff; }

    .rv-pref-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 12px;
      color: #d1d5db;
      cursor: pointer;
    }

    .rv-pref-row input[type="checkbox"] {
      accent-color: #c45a10;
      cursor: pointer;
    }

    .rv-shortcut-box {
      background: rgba(196, 90, 16, 0.1);
      border: 1px solid rgba(196, 90, 16, 0.25);
      border-radius: 8px;
      padding: 8px 10px;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 11px;
      color: #fbd38d;
    }

    .rv-shortcut-box kbd {
      background: #252b3a;
      border: 1px solid #363e52;
      border-radius: 4px;
      padding: 1px 5px;
      color: #ffffff;
      font-family: inherit;
    }

    /* Spinning helper */
    @keyframes rvSpin {
      100% { transform: rotate(360deg); }
    }

    .spinning svg,
    .spinning {
      animation: rvSpin 0.8s linear infinite;
    }

    .rv-empty-state {
      text-align: center;
      padding: 24px 14px;
      color: #9ca3af;
      font-size: 12px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
    }

    .rv-link-btn {
      background: #252b3a;
      border: 1px solid #363e52;
      color: #ffffff;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 11.5px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      transition: all 0.15s;
    }

    .rv-link-btn:hover {
      background: #363e52;
    }
  `;

  function initInPageWidget() {
    if (document.getElementById('rishiverse-companion-root')) return;

    const host = document.createElement('div');
    host.id = 'rishiverse-companion-root';
    document.body.appendChild(host);

    shadowRoot = host.attachShadow({ mode: 'open' });

    // Inject styles
    const styleEl = document.createElement('style');
    styleEl.textContent = WIDGET_CSS;
    shadowRoot.appendChild(styleEl);

    // Root wrapper
    const wrap = document.createElement('div');
    wrap.className = 'rv-widget-host';
    wrap.innerHTML = `
      <!-- Floating Action Button -->
      <button type="button" class="rv-fab" id="rv-fab" title="Rishiverse-Extension (Menu, Attendance & Theme)" aria-label="Rishiverse-Extension">
        <svg id="rv-fab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="4"/>
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
        </svg>
      </button>

      <!-- Popup Modal Card -->
      <div class="rv-card" id="rv-card">
        <!-- Header -->
        <header class="rv-header">
          <div class="rv-brand-row">
            <div class="rv-brand-left">
              <div class="rv-logo-badge">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
                </svg>
              </div>
              <div class="rv-brand-titles">
                <span class="rv-brand-main">Rishiverse</span>
                <span class="rv-brand-sub">Campus Companion</span>
              </div>
            </div>
            <button type="button" class="rv-close-btn" id="rv-close-btn" title="Close" aria-label="Close">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <!-- 3-Tab Selector Pills -->
          <nav class="rv-tab-pills" role="tablist">
            <button type="button" class="rv-tab-btn active" id="rv-tab-btn-menu" data-tab="tab-menu" role="tab" aria-selected="true">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M18 2v6a3 3 0 0 1-3 3 3 3 0 0 1-3-3V2M15 11v11M5 2v8a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V2M7 12v10"/>
              </svg>
              <span>Menu</span>
            </button>

            <button type="button" class="rv-tab-btn" id="rv-tab-btn-attendance" data-tab="tab-attendance" role="tab" aria-selected="false">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
                <path d="m9 16 2 2 4-4"/>
              </svg>
              <span>Attendance</span>
            </button>

            <button type="button" class="rv-tab-btn" id="rv-tab-btn-theme" data-tab="tab-theme" role="tab" aria-selected="false">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>
              </svg>
              <span>Theme</span>
            </button>
          </nav>
        </header>

        <!-- Scrollable Content Area -->
        <div class="rv-content-area">
          <!-- TAB 1: MENU PANE -->
          <div class="rv-tab-pane active" id="rv-pane-menu" role="tabpanel">
            <div class="rv-menu-header">
              <div class="rv-menu-day-row">
                <span id="rv-menu-title" class="rv-menu-day-title">Today</span>
                <span id="rv-menu-date" class="rv-menu-date-badge">Loading...</span>
              </div>
              <div class="rv-menu-actions">
                <button type="button" id="rv-btn-today" class="rv-action-btn today-btn" style="display: none;">Today</button>
                <button type="button" id="rv-btn-refresh-menu" class="rv-action-btn" title="Refresh menu">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                    <path d="M3 3v5h5"/>
                    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
                    <path d="M21 21v-5h-5"/>
                  </svg>
                </button>
              </div>
            </div>
            <span id="rv-menu-sync-status" class="rv-menu-sync-status">Weekly Menu • Refreshes Mondays</span>

            <!-- 7-Day Chips -->
            <div class="rv-day-selector" id="rv-day-selector">
              <button type="button" class="rv-day-chip" data-day="Monday"><span>Mon</span><span class="rv-today-dot"></span></button>
              <button type="button" class="rv-day-chip" data-day="Tuesday"><span>Tue</span><span class="rv-today-dot"></span></button>
              <button type="button" class="rv-day-chip" data-day="Wednesday"><span>Wed</span><span class="rv-today-dot"></span></button>
              <button type="button" class="rv-day-chip" data-day="Thursday"><span>Thu</span><span class="rv-today-dot"></span></button>
              <button type="button" class="rv-day-chip" data-day="Friday"><span>Fri</span><span class="rv-today-dot"></span></button>
              <button type="button" class="rv-day-chip" data-day="Saturday"><span>Sat</span><span class="rv-today-dot"></span></button>
              <button type="button" class="rv-day-chip" data-day="Sunday"><span>Sun</span><span class="rv-today-dot"></span></button>
            </div>

            <!-- Meals Accordion -->
            <div class="rv-meals-list" id="rv-meals-list">
              <div class="rv-empty-state"><p>Loading Campus Mess Menu...</p></div>
            </div>
          </div>

          <!-- TAB 2: ATTENDANCE PANE -->
          <div class="rv-tab-pane" id="rv-pane-attendance" role="tabpanel">
            <div class="rv-att-header">
              <div class="rv-att-title-row">
                <span class="rv-att-title">LMS Attendance</span>
                <span id="rv-att-badge" class="rv-att-overall-badge">--%</span>
              </div>
              <button type="button" id="rv-btn-sync-att" class="rv-action-btn" title="Sync attendance">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                  <path d="M3 3v5h5"/>
                  <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
                  <path d="M21 21v-5h-5"/>
                </svg>
                <span>Sync</span>
              </button>
            </div>
            <span id="rv-att-sync-status" class="rv-menu-sync-status">Last Synced: Checking...</span>

            <!-- Target Selector -->
            <div class="rv-target-bar">
              <span class="rv-target-label">Target:</span>
              <div class="rv-target-pills" id="rv-target-pills">
                <button type="button" class="rv-target-pill active" data-target="0.75">75%</button>
                <button type="button" class="rv-target-pill" data-target="0.80">80%</button>
                <button type="button" class="rv-target-pill" data-target="0.85">85%</button>
                <button type="button" class="rv-target-pill" data-target="0.90">90%</button>
              </div>
            </div>

            <!-- Overall Summary Card -->
            <div class="rv-att-overall-card" id="rv-overall-card" style="display: none;">
              <div class="rv-ring-wrap">
                <svg class="rv-progress-ring" viewBox="0 0 64 64">
                  <circle cx="32" cy="32" r="28" class="rv-ring-bg"></circle>
                  <circle cx="32" cy="32" r="28" class="rv-ring-fill" id="rv-ring-fill"></circle>
                </svg>
                <div class="rv-ring-text" id="rv-ring-pct">--%</div>
              </div>
              <div class="rv-overall-info">
                <span class="rv-overall-line" id="rv-overall-classes">Classes: <strong>-- / --</strong></span>
                <span class="rv-overall-status" id="rv-overall-status">Calculating...</span>
              </div>
            </div>

            <!-- Course Cards List -->
            <div class="rv-courses-list" id="rv-courses-list">
              <div class="rv-empty-state">
                <p>Click <strong>Sync</strong> to view your LMS Attendance.</p>
                <a href="/lms/attendance" class="rv-link-btn">Go to LMS Attendance ↗</a>
              </div>
            </div>
          </div>

          <!-- TAB 3: THEME PANE -->
          <div class="rv-tab-pane" id="rv-pane-theme" role="tabpanel">
            <!-- Master Dark Toggle Card -->
            <div class="rv-subcard">
              <div class="rv-switch-row">
                <div class="rv-switch-left">
                  <span class="rv-switch-label">Dark Theme</span>
                  <span class="rv-switch-sub" id="rv-theme-status-text">Enabled</span>
                </div>
                <label class="rv-toggle">
                  <input type="checkbox" id="rv-dark-toggle" checked>
                  <span class="rv-slider"></span>
                </label>
              </div>
            </div>

            <!-- Palette Selector -->
            <div class="rv-subcard" style="display: flex; flex-direction: column; gap: 8px;">
              <span class="rv-section-title">Dark Palette</span>
              <div class="rv-palettes-grid">
                <button type="button" class="rv-palette-btn active" id="rv-btn-midnight" data-style="midnight">
                  <span class="rv-dot rv-dot-midnight"></span>
                  <span>Midnight</span>
                </button>
                <button type="button" class="rv-palette-btn" id="rv-btn-oled" data-style="oled">
                  <span class="rv-dot rv-dot-oled"></span>
                  <span>OLED Black</span>
                </button>
              </div>
            </div>

            <!-- Preferences -->
            <div class="rv-subcard" style="display: flex; flex-direction: column; gap: 10px;">
              <span class="rv-section-title">Preferences</span>
              <label class="rv-pref-row">
                <span>In-page floating quick toggle</span>
                <input type="checkbox" id="rv-pref-toggle" checked>
              </label>
              <label class="rv-pref-row">
                <span>Follow system theme</span>
                <input type="checkbox" id="rv-pref-system">
              </label>
            </div>

            <div class="rv-shortcut-box">
              <span>⌨️</span>
              <span>Press <kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>D</kbd> to toggle dark mode anytime</span>
            </div>
          </div>
        </div>
      </div>
    `;

    shadowRoot.appendChild(wrap);

    // Bind event listeners
    bindWidgetEvents();

    // Initial data hydration
    chrome.storage.local.get(
      ['activeTab', 'att_target', 'mess_menu_data', 'mess_menu_last_fetched', 'mess_menu_source', 'rishiverse_attendance', 'rishiverse_attendance_timestamp'],
      (res) => {
        if (res.activeTab) switchWidgetTab(res.activeTab, false);
        if (res.att_target) {
          currentAttendanceTarget = res.att_target;
          updateWidgetTargetPills();
        }
        cachedMenuSource = res.mess_menu_source || null;
        cachedMenuLastFetched = res.mess_menu_last_fetched || null;

        const isOfficialMenu = Boolean(cachedMenuSource && cachedMenuSource.startsWith('rishiverse'));

        if (res.mess_menu_data && isOfficialMenu && !isMenuCacheExpired(res.mess_menu_last_fetched)) {
          cachedMenuData = res.mess_menu_data;
          renderWidgetMenu();
          updateWidgetMenuStatus(cachedMenuLastFetched, cachedMenuSource);
        } else {
          // If no cache or if cache is from old Newton/github/outdated, force fetch official Rishiverse menu!
          loadMenuDataWidget(!isOfficialMenu);
        }

        if (res.rishiverse_attendance) {
          cachedAttendanceData = res.rishiverse_attendance;
          renderWidgetAttendance(cachedAttendanceData);
          if (res.rishiverse_attendance_timestamp) {
            const syncStatus = shadowRoot.getElementById('rv-att-sync-status');
            if (syncStatus) {
              const d = new Date(res.rishiverse_attendance_timestamp);
              syncStatus.textContent = `Synced ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
            }
          }
        } else {
          // Attempt silent auto-hydration if logged in
          inPageSyncAttendance(true);
        }
      }
    );

    updateWidgetThemeState(currentSettings);
  }

  function bindWidgetEvents() {
    if (!shadowRoot) return;

    const fabBtn = shadowRoot.getElementById('rv-fab');
    const closeBtn = shadowRoot.getElementById('rv-close-btn');

    fabBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleWidgetModal();
    });

    closeBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      closeWidgetModal();
    });

    // Close on click outside
    window.addEventListener('click', (e) => {
      if (!isWidgetOpen) return;
      const host = document.getElementById('rishiverse-companion-root');
      if (host && host.contains(e.target)) return;
      if (e.composedPath && e.composedPath().some(el => el === host)) return;
      closeWidgetModal();
    });

    // Close on Escape
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && isWidgetOpen) {
        closeWidgetModal();
      }
    });

    // Tab Navigation
    const tabBtns = shadowRoot.querySelectorAll('.rv-tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const tabId = btn.getAttribute('data-tab');
        switchWidgetTab(tabId, true);
      });
    });

    // Menu Controls
    const dayChips = shadowRoot.querySelectorAll('.rv-day-chip');
    dayChips.forEach(chip => {
      chip.addEventListener('click', () => {
        selectedMenuDay = chip.getAttribute('data-day');
        renderWidgetMenu();
      });
    });

    shadowRoot.getElementById('rv-btn-today')?.addEventListener('click', () => {
      selectedMenuDay = todayDayName;
      renderWidgetMenu();
    });

    shadowRoot.getElementById('rv-btn-refresh-menu')?.addEventListener('click', () => {
      loadMenuDataWidget(true);
    });

    // Attendance Controls
    const targetPills = shadowRoot.querySelectorAll('.rv-target-pill');
    targetPills.forEach(pill => {
      pill.addEventListener('click', () => {
        targetPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        currentAttendanceTarget = parseFloat(pill.getAttribute('data-target')) || 0.75;
        chrome.storage.local.set({ att_target: currentAttendanceTarget });
        if (cachedAttendanceData) {
          renderWidgetAttendance(cachedAttendanceData);
        }
      });
    });

    shadowRoot.getElementById('rv-btn-sync-att')?.addEventListener('click', () => {
      inPageSyncAttendance(false);
    });

    // Theme Controls
    const darkToggle = shadowRoot.getElementById('rv-dark-toggle');
    const btnMidnight = shadowRoot.getElementById('rv-btn-midnight');
    const btnOled = shadowRoot.getElementById('rv-btn-oled');
    const prefToggle = shadowRoot.getElementById('rv-pref-toggle');
    const prefSystem = shadowRoot.getElementById('rv-pref-system');

    darkToggle?.addEventListener('change', () => {
      try {
        const isDark = darkToggle.checked;
        currentSettings.darkMode = isDark;
        try {
          localStorage.setItem('rishiverse_ext_dark', isDark);
        } catch (e) {}
        safeStorageSet({ darkMode: isDark });
        applyTheme(currentSettings);
      } catch (err) {
        console.warn('[Rishiverse] Failed to toggle dark mode:', err);
      }
    });

    btnMidnight?.addEventListener('click', () => {
      try {
        currentSettings.themeStyle = 'midnight';
        try {
          localStorage.setItem('rishiverse_ext_style', 'midnight');
        } catch (e) {}
        safeStorageSet({ themeStyle: 'midnight' });
        applyTheme(currentSettings);
      } catch (err) {
        console.warn('[Rishiverse] Failed to set Midnight style:', err);
      }
    });

    btnOled?.addEventListener('click', () => {
      try {
        currentSettings.themeStyle = 'oled';
        try {
          localStorage.setItem('rishiverse_ext_style', 'oled');
        } catch (e) {}
        safeStorageSet({ themeStyle: 'oled' });
        applyTheme(currentSettings);
      } catch (err) {
        console.warn('[Rishiverse] Failed to set OLED style:', err);
      }
    });

    prefToggle?.addEventListener('change', () => {
      try {
        currentSettings.showQuickToggle = prefToggle.checked;
        safeStorageSet({ showQuickToggle: prefToggle.checked });
        applyTheme(currentSettings);
      } catch (err) {
        console.warn('[Rishiverse] Failed to set quick toggle preference:', err);
      }
    });

    prefSystem?.addEventListener('change', () => {
      try {
        currentSettings.useSystemTheme = prefSystem.checked;
        safeStorageSet({ useSystemTheme: prefSystem.checked });
        applyTheme(currentSettings);
      } catch (err) {
        console.warn('[Rishiverse] Failed to set system theme preference:', err);
      }
    });
  }

  function toggleWidgetModal() {
    if (isWidgetOpen) {
      closeWidgetModal();
    } else {
      openWidgetModal();
    }
  }

  function openWidgetModal() {
    if (!shadowRoot) return;
    isWidgetOpen = true;
    const cardEl = shadowRoot.getElementById('rv-card');
    const fabBtn = shadowRoot.getElementById('rv-fab');
    cardEl?.classList.add('open');
    fabBtn?.classList.add('open');
    updateFabIcon(true);

    const now = new Date();
    const currentDayIndex = (now.getDay() + 6) % 7;
    todayDayName = WEEKDAYS[currentDayIndex];
    selectedMenuDay = todayDayName;

    const isOfficialMenu = Boolean(cachedMenuSource && cachedMenuSource.startsWith('rishiverse'));
    if (activeTabId === 'tab-menu') {
      if (!cachedMenuData || !isOfficialMenu) {
        loadMenuDataWidget(!isOfficialMenu);
      } else {
        renderWidgetMenu();
      }
    } else if (activeTabId === 'tab-attendance') {
      if (!cachedAttendanceData) {
        inPageSyncAttendance(true);
      } else {
        renderWidgetAttendance(cachedAttendanceData);
      }
    }
  }

  function closeWidgetModal() {
    if (!shadowRoot) return;
    isWidgetOpen = false;
    const cardEl = shadowRoot.getElementById('rv-card');
    const fabBtn = shadowRoot.getElementById('rv-fab');
    cardEl?.classList.remove('open');
    fabBtn?.classList.remove('open');
    updateFabIcon(false);
  }

  function updateFabIcon(isOpen) {
    if (!shadowRoot) return;
    const fabIcon = shadowRoot.getElementById('rv-fab-icon');
    if (!fabIcon) return;
    if (isOpen) {
      fabIcon.innerHTML = `<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>`;
      fabIcon.setAttribute('stroke-width', '2.5');
    } else {
      fabIcon.setAttribute('stroke-width', '2');
      if (currentSettings.darkMode) {
        fabIcon.innerHTML = `<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>`;
      } else {
        fabIcon.innerHTML = `<path d="M12 3a6 6 0 0 0 9 9 9 0 1 1-9-9Z"/>`;
      }
    }
  }

  function updateWidgetTargetPills() {
    if (!shadowRoot) return;
    const targetPills = shadowRoot.querySelectorAll('.rv-target-pill');
    targetPills.forEach(pill => {
      const val = parseFloat(pill.getAttribute('data-target')) || 0.75;
      pill.classList.toggle('active', Math.abs(val - currentAttendanceTarget) < 0.001);
    });
  }

  function switchWidgetTab(tabId, saveToStorage = true) {
    if (!shadowRoot) return;
    activeTabId = tabId || 'tab-menu';

    const tabBtns = shadowRoot.querySelectorAll('.rv-tab-btn');
    const panes = {
      'tab-menu': shadowRoot.getElementById('rv-pane-menu'),
      'tab-attendance': shadowRoot.getElementById('rv-pane-attendance'),
      'tab-theme': shadowRoot.getElementById('rv-pane-theme')
    };

    tabBtns.forEach(btn => {
      const isTarget = btn.getAttribute('data-tab') === activeTabId;
      btn.classList.toggle('active', isTarget);
      btn.setAttribute('aria-selected', isTarget ? 'true' : 'false');
    });

    Object.entries(panes).forEach(([id, pane]) => {
      if (pane) {
        pane.classList.toggle('active', id === activeTabId);
      }
    });

    const isOfficialMenu = Boolean(cachedMenuSource && cachedMenuSource.startsWith('rishiverse'));
    if (activeTabId === 'tab-menu') {
      const now = new Date();
      const currentDayIndex = (now.getDay() + 6) % 7;
      todayDayName = WEEKDAYS[currentDayIndex];
      selectedMenuDay = todayDayName;
      if (!cachedMenuData || !isOfficialMenu) {
        loadMenuDataWidget(!isOfficialMenu);
      } else {
        renderWidgetMenu();
      }
    } else if (activeTabId === 'tab-attendance' && !cachedAttendanceData) {
      inPageSyncAttendance(true);
    }

    if (saveToStorage) {
      try {
        chrome.storage.local.set({ activeTab: activeTabId });
      } catch (e) {}
    }
  }

  function updateWidgetThemeState(settings) {
    if (!shadowRoot) return;
    const card = shadowRoot.getElementById('rv-card');
    const darkToggle = shadowRoot.getElementById('rv-dark-toggle');
    const statusText = shadowRoot.getElementById('rv-theme-status-text');
    const btnMidnight = shadowRoot.getElementById('rv-btn-midnight');
    const btnOled = shadowRoot.getElementById('rv-btn-oled');
    const prefToggle = shadowRoot.getElementById('rv-pref-toggle');
    const prefSystem = shadowRoot.getElementById('rv-pref-system');

    let isDark = settings.darkMode;
    if (settings.useSystemTheme && window.matchMedia) {
      isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    }

    if (card) {
      card.classList.toggle('oled', (settings.themeStyle === 'oled') && isDark);
    }

    if (darkToggle) darkToggle.checked = isDark;
    if (prefToggle) prefToggle.checked = settings.showQuickToggle;
    if (prefSystem) prefSystem.checked = settings.useSystemTheme;

    if (btnMidnight && btnOled) {
      btnMidnight.classList.toggle('active', settings.themeStyle !== 'oled');
      btnOled.classList.toggle('active', settings.themeStyle === 'oled');
    }

    if (statusText) {
      if (settings.useSystemTheme) {
        statusText.textContent = 'Auto (System)';
        statusText.classList.remove('disabled');
      } else if (isDark) {
        statusText.textContent = 'Enabled';
        statusText.classList.remove('disabled');
      } else {
        statusText.textContent = 'Disabled';
        statusText.classList.add('disabled');
      }
    }

    if (!isWidgetOpen) {
      updateFabIcon(false);
    }
  }

  // ========================================================
  // 3. CAMPUS MESS MENU IN-PAGE CONTROLLER
  // ========================================================
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
    const commonKeywords = ["milk", "tea", "bread", "chapati", "rice", "salad", "chutney", "ketchup", "rasam", "sambar"];
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

  function isMenuCacheExpired(lastFetched) {
    if (!lastFetched || typeof lastFetched !== 'number') return true;
    if (Date.now() - lastFetched > 7 * 24 * 60 * 60 * 1000) return true;
    return lastFetched < getMostRecentMondayTimestamp();
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

  function extractPersistMessMenu() {
    try {
      const rawPersist = localStorage.getItem('persist:root');
      if (!rawPersist) return null;
      const root = JSON.parse(rawPersist);
      if (!root || !root.mess) return null;

      const messSlice = typeof root.mess === 'string' ? JSON.parse(root.mess) : root.mess;
      if (!messSlice) return null;

      const menuMap = messSlice.menu || messSlice.todaysMenu || messSlice.messMenu || messSlice.weeklyMenu || messSlice.data;
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
        return {
          weeklyMenu,
          totalItems,
          timestamp: Date.now()
        };
      }
    } catch (e) {
      console.warn('[Rishiverse] extractPersistMessMenu error:', e);
    }
    return null;
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

  function scrapeMenuFromDom() {
    if (!window.location.pathname.includes('/mess-menu')) return null;

    try {
      const h2Elements = document.querySelectorAll('h2');
      if (!h2Elements || h2Elements.length === 0) return null;

      let dayName = null;
      const textAll = document.body.innerText || '';
      for (const d of WEEKDAYS) {
        if (textAll.includes(d)) {
          dayName = d;
          break;
        }
      }
      if (!dayName) {
        const todayIndex = (new Date().getDay() + 6) % 7;
        dayName = WEEKDAYS[todayIndex];
      }

      const dayMeals = {
        breakfast: [],
        lunch: [],
        snacks: [],
        dinner: []
      };

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

        const listItems = card.querySelectorAll('ul li, li');
        listItems.forEach(li => {
          const dish = (li.textContent || '').trim();
          if (dish && !dish.includes('Menu will be updated soon') && !dish.startsWith('+ Add Item')) {
            dish.split(/[,;\n]+/).map(s => s.trim()).filter(Boolean).forEach(d => {
              if (!dayMeals[key].includes(d)) {
                dayMeals[key].push(d);
              }
            });
          }
        });
      });

      const hasItems = Object.values(dayMeals).some(arr => arr.length > 0);
      if (hasItems) {
        return { dayName, dayMeals };
      }
    } catch (e) {
      console.warn('[Rishiverse] scrapeMenuFromDom error:', e);
    }
    return null;
  }

  function updateWidgetMenuStatus(lastFetched, source) {
    if (!shadowRoot) return;
    const syncStatus = shadowRoot.getElementById('rv-menu-sync-status');
    if (!syncStatus) return;
    if (!lastFetched) {
      syncStatus.textContent = 'Weekly Menu';
      return;
    }
    const d = new Date(lastFetched);
    const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const isOfficial = Boolean(source && source.startsWith('rishiverse'));
    const sourceLabel = isOfficial ? 'Official Rishiverse' : 'Weekly Menu';
    syncStatus.textContent = `${sourceLabel} • ${dateStr}`;
  }

  async function loadMenuDataWidget(forceRefresh = false) {
    if (!shadowRoot) return;
    const refreshBtn = shadowRoot.getElementById('rv-btn-refresh-menu');
    const syncStatus = shadowRoot.getElementById('rv-menu-sync-status');

    let cached = null;
    try {
      cached = await chrome.storage.local.get(['mess_menu_data', 'mess_menu_last_fetched', 'mess_menu_source', 'rishiverse_token']);
    } catch (e) {}

    const hasCached = cached && cached.mess_menu_data && typeof cached.mess_menu_data === 'object';
    const isOfficialSource = Boolean(cached?.mess_menu_source && cached.mess_menu_source.startsWith('rishiverse'));
    const needsFetch = forceRefresh || !hasCached || !isOfficialSource || isMenuCacheExpired(cached.mess_menu_last_fetched);

    if (hasCached && isOfficialSource) {
      cachedMenuData = cached.mess_menu_data;
      cachedMenuSource = cached.mess_menu_source;
      cachedMenuLastFetched = cached.mess_menu_last_fetched;
      renderWidgetMenu();
      updateWidgetMenuStatus(cachedMenuLastFetched, cachedMenuSource);
    }

    if (needsFetch) {
      refreshBtn?.classList.add('spinning');
      if (syncStatus) syncStatus.textContent = 'Syncing from Rishiverse...';

      try {
        let fetchedData = null;
        let fetchedTimings = {};
        let fetchedSource = null;

        // TIER 0: Instant extraction from Redux persist:root if available
        const persistMenu = extractPersistMessMenu();
        if (persistMenu && persistMenu.weeklyMenu) {
          fetchedData = persistMenu.weeklyMenu;
          fetchedSource = 'rishiverse_persist';
        }

        // TIER 1: Official Rishiverse API using active student token
        const token = extractDecryptedToken() || cached?.rishiverse_token;
        if (token && (!fetchedData || forceRefresh)) {
          try {
            const apiResult = await fetchRishiverseWeeklyMenu(token);
            if (apiResult && (apiResult.totalItems > 0 || apiResult.successfulDayCount > 0)) {
              fetchedData = apiResult.weeklyMenu;
              fetchedTimings = apiResult.timingsByDay || {};
              fetchedSource = 'rishiverse_api';
            }
          } catch (apiErr) {
            console.warn('[Rishiverse] API mess menu fetch failed:', apiErr);
          }
        }

        // TIER 2: Live DOM Scraping if on /mess-menu
        if (!fetchedData || forceRefresh) {
          const domResult = scrapeMenuFromDom();
          if (domResult) {
            const base = (cached && cached.mess_menu_data && isOfficialSource) ? cached.mess_menu_data : (fetchedData || {});
            base[domResult.dayName] = domResult.dayMeals;
            fetchedData = base;
            fetchedSource = 'rishiverse_dom';
          }
        }

        // Save official Rishiverse data to chrome.storage.local
        if (fetchedData && fetchedSource) {
          const now = Date.now();
          cachedMenuData = fetchedData;
          cachedMenuSource = fetchedSource;
          cachedMenuLastFetched = now;

          await chrome.storage.local.set({
            mess_menu_data: fetchedData,
            mess_menu_timings: fetchedTimings,
            mess_menu_last_fetched: now,
            mess_menu_source: fetchedSource,
            ...(token ? { rishiverse_token: token } : {})
          });

          renderWidgetMenu();
          updateWidgetMenuStatus(now, fetchedSource);
        } else if (!hasCached) {
          // TIER 3: Bundled Offline Fallback (only if no cache exists at all)
          fetchedData = await loadFallbackMenu();
          if (fetchedData) {
            cachedMenuData = fetchedData;
            cachedMenuSource = 'bundled_fallback';
            cachedMenuLastFetched = Date.now();
            renderWidgetMenu();
            updateWidgetMenuStatus(cachedMenuLastFetched, cachedMenuSource);
          }
        }
      } catch (err) {
        console.warn('[Rishiverse] Menu loading error:', err);
      } finally {
        refreshBtn?.classList.remove('spinning');
      }
    }
  }

  async function loadFallbackMenu() {
    try {
      const res = await fetch(chrome.runtime.getURL('menu.json'));
      const fallback = await res.json();
      return fallback;
    } catch (e) {
      return null;
    }
  }

  function renderWidgetMenu() {
    if (!shadowRoot) return;
    const titleEl = shadowRoot.getElementById('rv-menu-title');
    const dateEl = shadowRoot.getElementById('rv-menu-date');
    const todayBtn = shadowRoot.getElementById('rv-btn-today');
    const mealsList = shadowRoot.getElementById('rv-meals-list');
    const dayChips = shadowRoot.querySelectorAll('.rv-day-chip');

    const now = new Date();
    const currentDayIndex = (now.getDay() + 6) % 7;
    todayDayName = WEEKDAYS[currentDayIndex];
    if (!selectedMenuDay) selectedMenuDay = todayDayName;

    const isViewingToday = selectedMenuDay === todayDayName;

    if (titleEl) titleEl.textContent = isViewingToday ? 'Today' : selectedMenuDay;
    if (dateEl) dateEl.textContent = formatShortDate(getDateForWeekday(selectedMenuDay));
    if (todayBtn) todayBtn.style.display = isViewingToday ? 'none' : 'inline-flex';

    dayChips.forEach(chip => {
      const day = chip.getAttribute('data-day');
      chip.classList.toggle('active', day === selectedMenuDay);
      chip.classList.toggle('is-today', day === todayDayName);
      const chipDate = getDateForWeekday(day);
      chip.title = `${day} (${formatShortDate(chipDate)})`;
    });

    updateWidgetMenuStatus(cachedMenuLastFetched, cachedMenuSource);

    if (!cachedMenuData || !cachedMenuData[selectedMenuDay]) {
      if (mealsList) mealsList.innerHTML = `<div class="rv-empty-state"><p>No menu data for ${selectedMenuDay}.</p></div>`;
      return;
    }

    const dayMenu = cachedMenuData[selectedMenuDay];
    const currentMin = now.getHours() * 60 + now.getMinutes();
    let nextMealFound = false;
    let cardsHtml = '';

    MEAL_CONFIG.forEach((meal, idx) => {
      const mealItems = dayMenu[meal.key] || [];
      const specials = mealItems.filter(item => !isSecondaryItem(item));
      const staples = mealItems.filter(item => isSecondaryItem(item));

      const { isServing, isNext } = calculateMealLiveStatus(meal, currentMin, isViewingToday);
      let shouldExpand = false;
      let badgeHtml = '';

      if (isViewingToday) {
        if (isServing) {
          shouldExpand = true;
          badgeHtml = `<span class="rv-meal-badge rv-badge-serving">● Serving Now</span>`;
        } else if (isNext && !nextMealFound) {
          shouldExpand = true;
          nextMealFound = true;
          badgeHtml = `<span class="rv-meal-badge rv-badge-next">Next Up</span>`;
        }
      } else if (idx === 0) {
        shouldExpand = true;
      }

      const specialsChips = specials.length > 0
        ? specials.map(d => `<span class="rv-dish-chip rv-special-chip">✨ ${escapeHtml(d)}</span>`).join('')
        : (staples.length === 0 ? '<span class="rv-dish-chip rv-staple-chip">Menu will be updated soon</span>' : '<span class="rv-dish-chip rv-staple-chip">Standard items</span>');

      const staplesChips = staples.length > 0
        ? staples.map(d => `<span class="rv-dish-chip rv-staple-chip">${escapeHtml(d)}</span>`).join('')
        : '';

      cardsHtml += `
        <details class="rv-meal-card ${isServing ? 'is-active-meal' : ''}" ${shouldExpand ? 'open' : ''}>
          <summary class="rv-meal-summary">
            <div class="rv-meal-left">
              <div class="rv-meal-icon ${meal.iconClass}">
                ${meal.svgIcon}
              </div>
              <div>
                <div class="rv-meal-title-row">
                  <span class="rv-meal-title">${meal.label}</span>
                  ${badgeHtml}
                </div>
                <span class="rv-meal-time">${meal.time}</span>
              </div>
            </div>
            <svg class="rv-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </summary>
          <div class="rv-meal-body">
            <div class="rv-section-head">
              <span>Main & Specials</span>
              <span>${specials.length}</span>
            </div>
            <div class="rv-chips-wrap">
              ${specialsChips}
            </div>
            ${staples.length > 0 ? `
              <div class="rv-section-head" style="margin-top: 4px;">
                <span>Daily Staples</span>
                <span>${staples.length}</span>
              </div>
              <div class="rv-chips-wrap">
                ${staplesChips}
              </div>
            ` : ''}
          </div>
        </details>
      `;
    });

    if (mealsList) mealsList.innerHTML = cardsHtml;
  }

  // ========================================================
  // 4. LMS ATTENDANCE IN-PAGE CONTROLLER & CALCULATIONS
  // ========================================================
  function calculateCourseStats(course, target) {
    const held = Math.max(0, Number(course.totalLectures) || 0);
    const present = Math.max(0, Number(course.presentLectures) || 0);
    const excused = Math.max(0, Number(course.excusedLectures) || 0);

    // Official Rishiverse formula: attended = present + excused
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

    let skips = 0;
    if (held > 0 && meetsTarget && target > 0) {
      skips = Math.max(0, Math.floor(attended / target + EPS) - held);
    }

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

  function renderWidgetAttendance(data) {
    if (!shadowRoot) return;

    const overallBadge = shadowRoot.getElementById('rv-att-badge');
    const syncStatus = shadowRoot.getElementById('rv-att-sync-status');
    const targetPills = shadowRoot.querySelectorAll('.rv-target-pill');
    const overallCard = shadowRoot.getElementById('rv-overall-card');
    const ringFill = shadowRoot.getElementById('rv-ring-fill');
    const ringPct = shadowRoot.getElementById('rv-ring-pct');
    const overallClasses = shadowRoot.getElementById('rv-overall-classes');
    const overallStatus = shadowRoot.getElementById('rv-overall-status');
    const coursesList = shadowRoot.getElementById('rv-courses-list');

    targetPills.forEach(p => {
      p.classList.toggle('active', parseFloat(p.getAttribute('data-target')) === currentAttendanceTarget);
    });

    if (!data || !Array.isArray(data.byCourse) || data.byCourse.length === 0) {
      if (overallCard) overallCard.style.display = 'none';
      if (coursesList) {
        coursesList.innerHTML = `
          <div class="rv-empty-state">
            <p>No attendance courses found on your profile.</p>
            <a href="/lms/attendance" class="rv-link-btn">Open LMS Attendance ↗</a>
          </div>
        `;
      }
      return;
    }

    const courses = data.byCourse;
    const targetPctInt = Math.round(currentAttendanceTarget * 100);

    let totalHeld = 0;
    let totalAttended = 0;
    let atRiskCount = 0;
    let activeCourseCount = 0;

    const statsList = courses.map(c => {
      const stats = calculateCourseStats(c, currentAttendanceTarget);
      totalHeld += stats.held;
      totalAttended += stats.attended;
      if (stats.held > 0) {
        activeCourseCount++;
        if (!stats.meetsTarget) atRiskCount++;
      }
      return { course: c, stats };
    });

    const overallPct = totalHeld > 0 ? (totalAttended / totalHeld) : null;
    const overallPctFormatted = overallPct !== null ? `${(overallPct * 100).toFixed(1)}%` : '--%';
    const overallPctInt = overallPct !== null ? Math.round(overallPct * 100) : 0;
    const isOverallSafe = overallPct !== null && (overallPct >= currentAttendanceTarget - 1e-9);

    if (overallCard) overallCard.style.display = 'flex';
    if (overallBadge) {
      overallBadge.textContent = overallPct !== null ? overallPctFormatted : '--%';
      overallBadge.className = `rv-att-overall-badge ${isOverallSafe ? '' : 'low'}`;
    }

    if (ringPct) ringPct.textContent = overallPct !== null ? `${overallPctInt}%` : '--%';
    if (overallClasses) overallClasses.innerHTML = `Classes: <strong>${totalAttended} / ${totalHeld}</strong>`;

    if (ringFill) {
      const circumference = 2 * Math.PI * 28;
      ringFill.style.strokeDasharray = `${circumference} ${circumference}`;
      const offset = circumference - (overallPctInt / 100) * circumference;
      ringFill.style.strokeDashoffset = offset;
      ringFill.style.stroke = isOverallSafe ? '#22c55e' : '#ef4444';
    }

    if (overallStatus) {
      if (totalHeld === 0) {
        overallStatus.textContent = 'No classes held yet';
        overallStatus.className = 'rv-overall-status';
      } else if (atRiskCount === 0) {
        overallStatus.textContent = `✓ All ${activeCourseCount} courses on track (≥ ${targetPctInt}%)`;
        overallStatus.className = 'rv-overall-status safe';
      } else {
        overallStatus.textContent = `⚠️ ${atRiskCount} ${atRiskCount === 1 ? 'course' : 'courses'} below ${targetPctInt}% target`;
        overallStatus.className = 'rv-overall-status danger';
      }
    }

    let html = '';
    statsList.forEach(({ course: c, stats }) => {
      const name = c.courseName || 'Course';
      const code = c.courseCode || '';
      const section = c.section?.name || '';
      const { held, present, excused, absent, attended, pctInt, pctFormatted, meetsTarget, skips, recover } = stats;

      let verdictText = '';
      if (held === 0) {
        verdictText = `<span class="rv-verdict-neutral">No classes held yet</span>`;
      } else if (meetsTarget) {
        if (skips === 0) {
          verdictText = `<span class="rv-verdict-safe">On track (0 skips left — right at ${targetPctInt}% threshold)</span>`;
        } else {
          verdictText = `<span class="rv-verdict-safe">Can skip <strong>${skips}</strong> ${skips === 1 ? 'class' : 'classes'} and stay above ${targetPctInt}%</span>`;
        }
      } else {
        verdictText = `<span class="rv-verdict-danger">Attend next <strong>${recover}</strong> ${recover === 1 ? 'class' : 'classes'} in a row to reach ${targetPctInt}%</span>`;
      }

      html += `
        <div class="rv-course-card">
          <div class="rv-course-top">
            <div>
              <span class="rv-course-name">${escapeHtml(name)}</span>
              <div class="rv-course-tags">
                ${code ? `<span class="rv-tag-code">${escapeHtml(code)}</span>` : ''}
                ${section ? `<span class="rv-tag-code">${escapeHtml(section)}</span>` : ''}
              </div>
            </div>
            <span class="rv-course-pct ${held > 0 ? (meetsTarget ? 'safe' : 'danger') : ''}">${pctFormatted}</span>
          </div>

          ${held > 0 ? `
            <div class="rv-track-bar">
              <div class="rv-track-fill ${meetsTarget ? 'safe' : 'danger'}" style="width: ${Math.min(100, Math.max(0, pctInt))}%;"></div>
              <div class="rv-target-marker" style="left: ${targetPctInt}%;" title="Target: ${targetPctInt}%"></div>
            </div>
          ` : ''}

          <div class="rv-course-stats-row">
            <span>Classes: <strong>${attended} / ${held}</strong></span>
            <div class="rv-stats-pills">
              <span class="rv-mini-pill rv-pill-p" title="Present">P: ${present}</span>
              ${excused > 0 ? `<span class="rv-mini-pill rv-pill-e" title="Excused">E: ${excused}</span>` : ''}
              ${absent > 0 ? `<span class="rv-mini-pill rv-pill-a" title="Absent">A: ${absent}</span>` : ''}
            </div>
          </div>

          <div class="rv-verdict-bar">
            ${verdictText}
          </div>
        </div>
      `;
    });

    if (coursesList) coursesList.innerHTML = html;

    if (data.timestamp && syncStatus) {
      const d = new Date(data.timestamp);
      syncStatus.textContent = `Synced ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
  }

  // ========================================================
  // 5. DIRECT DATA EXTRACTION & ATTENDANCE SYNC
  // ========================================================
  function extractDecryptedToken() {
    try {
      const raw = localStorage.getItem('rw_access_token');
      if (!raw) return null;
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
      return localStorage.getItem('rw_access_token') || null;
    }
  }

  function scrapeAttendanceFromDom() {
    if (!window.location.pathname.includes('/lms/attendance')) return null;
    try {
      const cardLinks = document.querySelectorAll('a[href*="/lms/attendance/"]');
      if (!cardLinks || cardLinks.length === 0) return null;

      const courses = [];
      cardLinks.forEach(card => {
        const titleEl = card.querySelector('h3');
        const title = titleEl ? titleEl.textContent.trim() : 'Course';

        const circleSpan = card.querySelector('.relative span.absolute, [class*="text-gray-900"][class*="text-xs"]');
        let held = 0;
        let attended = 0;
        if (circleSpan) {
          const m = circleSpan.textContent.trim().match(/^(\d+)\s*\/\s*(\d+)$/);
          if (m) {
            attended = parseInt(m[1], 10);
            held = parseInt(m[2], 10);
          }
        }

        const badgeTexts = Array.from(card.querySelectorAll('span'))
          .filter(s => {
            const cls = s.className || '';
            return (cls.includes('bg-gray-100') || cls.includes('rounded-[16px]')) && !s.textContent.includes(':');
          })
          .map(s => s.textContent.trim())
          .filter(Boolean);

        const allSpans = Array.from(card.querySelectorAll('span'));
        const pSpan = allSpans.find(s => s.textContent.trim().startsWith('Present:'));
        const eSpan = allSpans.find(s => s.textContent.trim().startsWith('Excused:'));
        const pMatch = pSpan ? pSpan.textContent.match(/Present:\s*(\d+)%/i) : null;
        const eMatch = eSpan ? eSpan.textContent.match(/Excused:\s*(\d+)%/i) : null;

        const pPct = pMatch ? parseInt(pMatch[1], 10) : 0;
        const ePct = eMatch ? parseInt(eMatch[1], 10) : 0;

        const present = held > 0 ? Math.round((pPct / 100) * held) : attended;
        const excused = held > 0 ? Math.round((ePct / 100) * held) : 0;

        if (held > 0 || attended > 0) {
          courses.push({
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

      if (courses.length > 0) {
        return {
          semesterNumber: 1,
          semesters: [1],
          byCourse: courses,
          timestamp: Date.now(),
          source: 'dom_scrape'
        };
      }
    } catch (e) {}
    return null;
  }

  async function fetchAttendanceViaApiDirect(token) {
    const semRes = await fetch(`${API_BASE}/students/self/academics/semesters`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!semRes.ok) throw new Error(`Semesters HTTP ${semRes.status}`);
    const semData = await semRes.json();
    const semesters = semData?.data?.semesters || semData?.semesters || [{ number: 1 }];
    const numbers = semesters.map(s => typeof s === 'number' ? s : s?.number).filter(n => typeof n === 'number' && !isNaN(n));
    const currentSem = numbers.length > 0 ? Math.max(...numbers) : 1;

    const attRes = await fetch(`${API_BASE}/students/self/${currentSem}/attendance/summary`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!attRes.ok) throw new Error(`Attendance HTTP ${attRes.status}`);
    const attData = await attRes.json();
    const byCourse = attData?.data?.byCourse || attData?.byCourse || [];

    return {
      semesterNumber: currentSem,
      semesters: numbers.length > 0 ? numbers : [1],
      byCourse,
      timestamp: Date.now()
    };
  }

  async function inPageSyncAttendance(silent = false) {
    if (!shadowRoot) return;
    const syncBtn = shadowRoot.getElementById('rv-btn-sync-att');
    const syncStatus = shadowRoot.getElementById('rv-att-sync-status');

    if (!silent) {
      syncBtn?.classList.add('spinning');
      if (syncStatus) syncStatus.textContent = 'Syncing...';
    }

    try {
      let result = scrapeAttendanceFromDom();

      // Check Redux Persist cache
      if (!result) {
        try {
          const rawPersist = localStorage.getItem('persist:root');
          if (rawPersist) {
            const parsed = JSON.parse(rawPersist);
            if (parsed.student) {
              const studentObj = JSON.parse(parsed.student);
              if (studentObj.attendanceSummary?.byCourse?.length > 0) {
                result = {
                  semesterNumber: studentObj.attendanceSummary.semesterNumber || 1,
                  byCourse: studentObj.attendanceSummary.byCourse,
                  timestamp: Date.now(),
                  source: 'persist'
                };
              }
            }
          }
        } catch (e) {}
      }

      // API fetch with token
      if (!result) {
        const token = extractDecryptedToken();
        if (token) {
          result = await fetchAttendanceViaApiDirect(token);
          chrome.storage.local.set({ rishiverse_token: token });
        }
      }

      if (result && Array.isArray(result.byCourse) && result.byCourse.length > 0) {
        cachedAttendanceData = result;
        chrome.storage.local.set({
          rishiverse_attendance: result,
          rishiverse_attendance_timestamp: Date.now()
        });
        renderWidgetAttendance(cachedAttendanceData);
      } else if (!silent) {
        if (syncStatus) syncStatus.textContent = 'Not connected';
        if (!cachedAttendanceData) {
          const coursesList = shadowRoot.getElementById('rv-courses-list');
          if (coursesList) {
            coursesList.innerHTML = `
              <div class="rv-empty-state">
                <p>Please log in or visit LMS Attendance to sync your courses.</p>
                <a href="/lms/attendance" class="rv-link-btn">Go to LMS Attendance ↗</a>
              </div>
            `;
          }
        }
      }
    } catch (err) {
      if (!silent && syncStatus) syncStatus.textContent = 'Sync error';
    } finally {
      if (!silent) syncBtn?.classList.remove('spinning');
    }
  }

  // Auto-scrape when navigating within LMS attendance or Mess Menu
  let lastScrapedTime = 0;
  function triggerAutoScrape() {
    const now = Date.now();
    if (now - lastScrapedTime < 2000) return;

    if (window.location.pathname.includes('/lms/attendance')) {
      const data = scrapeAttendanceFromDom();
      if (data) {
        lastScrapedTime = now;
        cachedAttendanceData = data;
        chrome.storage.local.set({
          rishiverse_attendance: data,
          rishiverse_attendance_timestamp: now
        });
        if (shadowRoot) renderWidgetAttendance(data);
      }
    } else if (window.location.pathname.includes('/mess-menu')) {
      const menuData = scrapeMenuFromDom();
      if (menuData) {
        lastScrapedTime = now;
      }
    }
  }

  if (window.location.pathname.includes('/lms/attendance') || window.location.pathname.includes('/mess-menu')) {
    setTimeout(triggerAutoScrape, 800);
    setTimeout(triggerAutoScrape, 2000);
  }

  const attDomObserver = new MutationObserver(() => {
    if (window.location.pathname.includes('/lms/attendance') || window.location.pathname.includes('/mess-menu')) {
      triggerAutoScrape();
    }
  });

  if (document.body) {
    attDomObserver.observe(document.body, { childList: true, subtree: true });
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      attDomObserver.observe(document.body, { childList: true, subtree: true });
    });
  }

  window.addEventListener('popstate', triggerAutoScrape);

  // Handle messages from the Chrome Toolbar popup
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'GET_TAB_ATTENDANCE' || msg.action === 'SYNC_ATTENDANCE') {
      const domData = scrapeAttendanceFromDom();
      if (domData) {
        sendResponse({ success: true, data: domData });
        return true;
      }

      const token = extractDecryptedToken();
      if (!token) {
        sendResponse({ success: false, error: 'NO_TOKEN' });
        return true;
      }

      fetchAttendanceViaApiDirect(token)
        .then(result => {
          chrome.storage.local.set({
            rishiverse_attendance: result,
            rishiverse_attendance_timestamp: Date.now(),
            rishiverse_token: token
          });
          sendResponse({ success: true, data: result });
        })
        .catch(err => {
          sendResponse({ success: false, error: err.message });
        });

      return true;
    } else if (msg.action === 'GET_TAB_MENU' || msg.action === 'SYNC_MENU') {
      const persistRes = extractPersistMessMenu();
      if (persistRes && persistRes.weeklyMenu) {
        chrome.storage.local.set({
          mess_menu_data: persistRes.weeklyMenu,
          mess_menu_last_fetched: persistRes.timestamp,
          mess_menu_source: 'rishiverse_persist'
        });
        sendResponse({ success: true, data: persistRes.weeklyMenu, source: 'rishiverse_persist' });
        return true;
      }

      const token = extractDecryptedToken();
      if (token) {
        fetchRishiverseWeeklyMenu(token)
          .then(result => {
            if (result && (result.totalItems > 0 || result.successfulDayCount > 0)) {
              chrome.storage.local.set({
                mess_menu_data: result.weeklyMenu,
                mess_menu_timings: result.timingsByDay,
                mess_menu_last_fetched: result.timestamp,
                mess_menu_source: 'rishiverse_api',
                rishiverse_token: token
              });
              sendResponse({ success: true, data: result.weeklyMenu, timings: result.timingsByDay, source: 'rishiverse_api' });
            } else {
              const domMenu = scrapeMenuFromDom();
              if (domMenu) {
                chrome.storage.local.get(['mess_menu_data'], (res) => {
                  const updated = res.mess_menu_data || {};
                  updated[domMenu.dayName] = domMenu.dayMeals;
                  chrome.storage.local.set({
                    mess_menu_data: updated,
                    mess_menu_last_fetched: Date.now(),
                    mess_menu_source: 'rishiverse_dom'
                  });
                });
                sendResponse({ success: true, data: domMenu, source: 'rishiverse_dom' });
              } else {
                sendResponse({ success: false, error: 'NO_ITEMS' });
              }
            }
          })
          .catch(err => {
            const domMenu = scrapeMenuFromDom();
            if (domMenu) {
              chrome.storage.local.get(['mess_menu_data'], (res) => {
                const updated = res.mess_menu_data || {};
                updated[domMenu.dayName] = domMenu.dayMeals;
                chrome.storage.local.set({
                  mess_menu_data: updated,
                  mess_menu_last_fetched: Date.now(),
                  mess_menu_source: 'rishiverse_dom'
                });
              });
              sendResponse({ success: true, data: domMenu, source: 'rishiverse_dom' });
            } else {
              sendResponse({ success: false, error: err.message });
            }
          });
        return true;
      } else {
        const domMenu = scrapeMenuFromDom();
        if (domMenu) {
          chrome.storage.local.get(['mess_menu_data'], (res) => {
            const updated = res.mess_menu_data || {};
            updated[domMenu.dayName] = domMenu.dayMeals;
            chrome.storage.local.set({
              mess_menu_data: updated,
              mess_menu_last_fetched: Date.now(),
              mess_menu_source: 'rishiverse_dom'
            });
          });
          sendResponse({ success: true, data: domMenu, source: 'rishiverse_dom' });
          return true;
        }
        sendResponse({ success: false, error: 'NO_TOKEN' });
        return true;
      }
    }
  });

  // Initialize the In-Page Companion Widget
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initInPageWidget);
  } else {
    initInPageWidget();
  }
})();
