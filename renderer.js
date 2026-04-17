// ============================================================
// Wget App - Renderer Process
// Handles UI rendering, user interaction, and IPC communication
// ============================================================

// ----- Icon Map -----
const ICON_MAP = {
  'globe': '\u{1F310}',
  'code': '\u{1F4BB}',
  'film': '\u{1F3AC}',
  'tool': '\u{1F527}',
  'shield': '\u{1F6E1}\uFE0F',
  'message-circle': '\u{1F4AC}',
  'file-text': '\u{1F4C4}',
  'cpu': '\u2699\uFE0F',
  'brain': '\u{1F9E0}'
};

// ----- State -----
let currentCategory = null;
let categories = [];
const softwareData = {};
const installedStatus = {};

// ----- i18n -----
let currentLang = localStorage.getItem('lang') || 'en';
let i18n = {};

async function loadI18n(lang) {
  const response = await fetch(`data/i18n/${lang}.json`);
  i18n = await response.json();
}

function t(key) {
  return i18n[key] || key;
}

// ----- DOM References -----
const sidebarNav = document.getElementById('sidebar-nav');
const categoryTitle = document.getElementById('category-title');
const cardsGrid = document.getElementById('cards-grid');
const searchInput = document.getElementById('search');

// ============================================================
// Initialization
// ============================================================

async function init() {
  await loadI18n(currentLang);
  document.documentElement.lang = currentLang;
  updateToggleButtons();

  try {
    const response = await fetch('data/categories.json');
    categories = await response.json();
    renderSidebar(categories);

    if (categories.length > 0) {
      await selectCategory(categories[0].id);
    }

    setupProgressListener();
    setupSearchHandler();
    setupLangToggle();
  } catch (err) {
    console.error('Failed to initialize app:', err);
    showToast(t('error.loadCategories'), 'error');
  }
}

// ============================================================
// Sidebar Rendering
// ============================================================

function renderSidebar(cats) {
  sidebarNav.innerHTML = '';

  cats.forEach((cat, index) => {
    const btn = document.createElement('button');
    btn.className = 'sidebar-tab';
    if (index === 0) btn.classList.add('active');
    btn.dataset.categoryId = cat.id;

    const iconSpan = document.createElement('span');
    iconSpan.className = 'tab-icon';
    iconSpan.textContent = ICON_MAP[cat.icon] || cat.icon;

    const labelSpan = document.createElement('span');
    labelSpan.className = 'tab-label';
    labelSpan.textContent = currentLang === 'en' ? (cat.name_en || cat.name) : cat.name;

    const countSpan = document.createElement('span');
    countSpan.className = 'tab-count';
    countSpan.textContent = '...';

    btn.appendChild(iconSpan);
    btn.appendChild(labelSpan);
    btn.appendChild(countSpan);

    btn.addEventListener('click', () => selectCategory(cat.id));

    sidebarNav.appendChild(btn);

    // Load count asynchronously
    loadCategoryCount(cat.id, countSpan);
  });
}

async function loadCategoryCount(categoryId, countSpan) {
  try {
    if (!softwareData[categoryId]) {
      const response = await fetch(`data/${categoryId}.json`);
      const data = await response.json();
      softwareData[categoryId] = data;
    }
    countSpan.textContent = softwareData[categoryId].length;
  } catch (err) {
    countSpan.textContent = '0';
  }
}

// ============================================================
// Category Selection
// ============================================================

async function selectCategory(categoryId) {
  currentCategory = categoryId;

  // Update active tab in sidebar
  const tabs = sidebarNav.querySelectorAll('.sidebar-tab');
  tabs.forEach(tab => {
    tab.classList.toggle('active', tab.dataset.categoryId === categoryId);
  });

  // Update header title
  const cat = categories.find(c => c.id === categoryId);
  if (cat) {
    categoryTitle.textContent = currentLang === 'en' ? (cat.name_en || cat.name) : cat.name;
  }

  // Clear search when changing categories
  searchInput.value = '';

  // Load category data if not cached
  if (!softwareData[categoryId]) {
    try {
      const response = await fetch(`data/${categoryId}.json`);
      softwareData[categoryId] = await response.json();
    } catch (err) {
      console.error(`Failed to load category data for ${categoryId}:`, err);
      showToast(t('error.loadData'), 'error');
      softwareData[categoryId] = [];
    }
  }

  // Check installed status via electronAPI
  try {
    if (window.electronAPI && window.electronAPI.checkInstalled) {
      const results = await window.electronAPI.checkInstalled(softwareData[categoryId]);
      if (results && typeof results === 'object') {
        Object.assign(installedStatus, results);
      }
    }
  } catch (err) {
    console.error('Failed to check installed status:', err);
  }

  renderCards();
}

// ============================================================
// Card Rendering
// ============================================================

function renderCards() {
  cardsGrid.innerHTML = '';

  const data = softwareData[currentCategory] || [];
  const searchTerm = searchInput.value.trim().toLowerCase();

  const filtered = searchTerm
    ? data.filter(sw => sw.name.toLowerCase().includes(searchTerm))
    : data;

  if (filtered.length === 0) {
    const emptyDiv = document.createElement('div');
    emptyDiv.className = 'empty-state';
    emptyDiv.innerHTML = `
      <div class="empty-state-icon">\u{1F50D}</div>
      <div class="empty-state-title">${t('empty.title')}</div>
      <div class="empty-state-description">${searchTerm ? t('empty.search') + ' "' + escapeHtml(searchTerm) + '"' : t('empty.description')}.</div>
    `;
    cardsGrid.appendChild(emptyDiv);
    return;
  }

  filtered.forEach(sw => {
    const isInstalled = installedStatus[sw.id] === true;

    const card = document.createElement('div');
    card.className = 'card';
    card.dataset.id = sw.id;
    card.dataset.name = sw.name;

    if (isInstalled) {
      card.classList.add('installed');
    }

    // Card header
    const header = document.createElement('div');
    header.className = 'card-header';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'card-name';
    nameSpan.textContent = sw.name;
    header.appendChild(nameSpan);

    if (isInstalled) {
      const badge = document.createElement('span');
      badge.className = 'installed-badge';
      header.appendChild(badge);
    }

    // Description
    const desc = document.createElement('p');
    desc.className = 'card-description';
    desc.textContent = currentLang === 'en' ? (sw.description_en || sw.description) : sw.description;

    // Footer
    const footer = document.createElement('div');
    footer.className = 'card-footer';

    const sizeSpan = document.createElement('span');
    sizeSpan.className = 'card-size';
    sizeSpan.textContent = sw.size || '';
    footer.appendChild(sizeSpan);

    const progressText = document.createElement('span');
    progressText.className = 'progress-text';
    progressText.style.display = 'none';
    footer.appendChild(progressText);

    // Progress bar
    const progressContainer = document.createElement('div');
    progressContainer.className = 'progress-bar-container';

    const progressBar = document.createElement('div');
    progressBar.className = 'progress-bar';
    progressContainer.appendChild(progressBar);

    // Assemble card
    card.appendChild(header);
    card.appendChild(desc);
    card.appendChild(footer);
    card.appendChild(progressContainer);

    // Click handler
    card.addEventListener('click', () => handleDownload(sw, card));

    cardsGrid.appendChild(card);
  });
}

// ============================================================
// Download Handler
// ============================================================

async function handleDownload(software, card) {
  // If already downloading, ignore
  if (card.classList.contains('downloading')) {
    return;
  }

  // If already installed, show toast and return
  if (installedStatus[software.id] === true) {
    showToast(t('toast.alreadyInstalled'), 'warning');
    return;
  }

  // Start downloading state
  card.classList.add('downloading');
  card.classList.remove('error');

  // Show indeterminate progress bar
  const progressBar = card.querySelector('.progress-bar');
  const progressText = card.querySelector('.progress-text');
  if (progressBar) {
    progressBar.classList.add('indeterminate');
    progressBar.style.width = '';
  }
  if (progressText) {
    progressText.style.display = '';
    progressText.textContent = t('toast.downloading');
  }

  try {
    if (window.electronAPI && window.electronAPI.downloadSoftware) {
      await window.electronAPI.downloadSoftware(software);
      showToast(t('toast.downloadComplete'), 'success');

      // Mark progress as complete
      if (progressBar) {
        progressBar.classList.remove('indeterminate');
        progressBar.classList.add('complete');
      }
    } else {
      throw new Error('electronAPI not available');
    }
  } catch (err) {
    console.error('Download failed:', err);
    card.classList.add('error');
    showToast(`${t('toast.error')}${err.message || 'Download failed'}`, 'error');

    // Reset progress bar on error
    if (progressBar) {
      progressBar.classList.remove('indeterminate');
      progressBar.style.width = '0%';
    }
    if (progressText) {
      progressText.style.display = 'none';
    }
  } finally {
    card.classList.remove('downloading');
  }
}

// ============================================================
// Progress Listener
// ============================================================

function setupProgressListener() {
  if (window.electronAPI && window.electronAPI.onDownloadProgress) {
    window.electronAPI.onDownloadProgress((data) => {
      const { id, progress } = data;
      const card = cardsGrid.querySelector(`.card[data-id="${id}"]`);
      if (!card) return;

      const progressBar = card.querySelector('.progress-bar');
      const progressText = card.querySelector('.progress-text');

      if (progressBar && typeof progress === 'number') {
        progressBar.classList.remove('indeterminate');
        progressBar.style.width = `${Math.round(progress)}%`;
      }

      if (progressText && typeof progress === 'number') {
        progressText.style.display = '';
        progressText.textContent = `${Math.round(progress)}%`;
      }
    });
  }
}

// ============================================================
// Search Handler
// ============================================================

function setupSearchHandler() {
  searchInput.addEventListener('input', () => {
    const searchTerm = searchInput.value.trim().toLowerCase();
    const cards = cardsGrid.querySelectorAll('.card');

    // If renderCards was called (e.g., after category switch), cards reflect current data.
    // For live filtering, hide/show existing cards by name.
    if (cards.length === 0 && searchTerm) {
      // No cards rendered yet, do a full re-render
      renderCards();
      return;
    }

    let visibleCount = 0;

    cards.forEach(card => {
      const name = (card.dataset.name || '').toLowerCase();
      if (!searchTerm || name.includes(searchTerm)) {
        card.style.display = '';
        visibleCount++;
      } else {
        card.style.display = 'none';
      }
    });

    // Handle empty state
    const existingEmpty = cardsGrid.querySelector('.empty-state');
    if (visibleCount === 0 && !existingEmpty) {
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'empty-state';
      emptyDiv.innerHTML = `
        <div class="empty-state-icon">\u{1F50D}</div>
        <div class="empty-state-title">${t('empty.title')}</div>
        <div class="empty-state-description">${t('empty.search')} "${escapeHtml(searchTerm)}".</div>
      `;
      cardsGrid.appendChild(emptyDiv);
    } else if (visibleCount > 0 && existingEmpty) {
      existingEmpty.remove();
    }
  });
}

// ============================================================
// Language Toggle
// ============================================================

function setupLangToggle() {
  document.getElementById('lang-en').addEventListener('click', () => switchLang('en'));
  document.getElementById('lang-it').addEventListener('click', () => switchLang('it'));
}

async function switchLang(lang) {
  if (lang === currentLang) return;
  currentLang = lang;
  localStorage.setItem('lang', lang);
  await loadI18n(lang);
  document.documentElement.lang = lang;
  updateToggleButtons();
  document.getElementById('search').placeholder = t('search.placeholder');
  document.querySelector('.sidebar-title').textContent = t('sidebar.title');
  renderSidebar(categories);
  if (currentCategory) {
    const cat = categories.find(c => c.id === currentCategory);
    if (cat) {
      document.getElementById('category-title').textContent =
        currentLang === 'en' ? (cat.name_en || cat.name) : cat.name;
    }
    renderCards();
  }
}

function updateToggleButtons() {
  document.getElementById('lang-en').classList.toggle('active', currentLang === 'en');
  document.getElementById('lang-it').classList.toggle('active', currentLang === 'it');
}

// ============================================================
// Toast Notifications
// ============================================================

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    if (toast.parentNode) {
      toast.remove();
    }
  }, 4000);
}

// ============================================================
// Utility
// ============================================================

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ============================================================
// Start
// ============================================================

document.addEventListener('DOMContentLoaded', init);
