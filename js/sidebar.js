// Ameple — Shared Sidebar Logic
// Handles sidebar navigation, user status popover, and avatar syncing

(function() {
  document.addEventListener('DOMContentLoaded', function() {
    initSidebar();
    setupSidebarAvatar();
    initStatusDropdown();
    initCollapsibleSidebar(); // Add this
    
    // Check if user status element exists to update it initially
    updateStatusDisplay();
  });

  function initCollapsibleSidebar() {
    const sidebar = document.querySelector('.left-sidebar');
    if (!sidebar || document.getElementById('sidebar-toggle')) return;

    // Check saved state
    const isCollapsed = localStorage.getItem('sidebar_collapsed') === 'true';
    if (isCollapsed) sidebar.classList.add('collapsed');

    // Create toggle button
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'sidebar-toggle';
    toggleBtn.id = 'sidebar-toggle';
    toggleBtn.title = 'Toggle Sidebar';
    toggleBtn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <path d="M15 18l-6-6 6-6"/>
      </svg>
    `;
    
    toggleBtn.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
      sidebar.classList.toggle('collapsed');
      const nowCollapsed = sidebar.classList.contains('collapsed');
      localStorage.setItem('sidebar_collapsed', nowCollapsed);
    });

    sidebar.appendChild(toggleBtn);
  }

  const predefinedStatuses = [
    '☕ Having coffee', '💻 Deep working', '🎮 Gaming', '🍳 Cooking',
    '😴 Taking a break', '📚 Studying', '🏋️ Working out',
    '🎵 Listening to music', '🚶 Out for a walk', '💬 Open to chat'
  ];

  let isStatusDropdownOpen = false;

  function initSidebar() {
    document.querySelectorAll('.sidebar-nav-item').forEach(function(item) {
      item.addEventListener('click', function(e) {
        const href = this.getAttribute('href');
        if (href && href !== '#') return; // Let links navigate

        e.preventDefault();
        document.querySelectorAll('.sidebar-nav-item').forEach(function(i) { i.classList.remove('active'); });
        this.classList.add('active');
      });
    });
  }

  function setupSidebarAvatar() {
    const avatar = document.getElementById('sidebar-user-avatar');
    // We assume AmepleAuth is loaded before sidebar.js
    if (window.AmepleAuth) {
      const user = window.AmepleAuth.getCurrentUser();
      if (avatar && user && user.avatar_url) {
        avatar.src = user.avatar_url;
      }
    }
  }

  function updateStatusDisplay() {
    const userSub = document.querySelector('.sidebar-user .user-sub');
    if (userSub && window.AmepleState && window.AmepleState.currentStatus) {
      userSub.textContent = window.AmepleState.currentStatus;
      if (window.AmepleEmoji) window.AmepleEmoji.parse(userSub);
    }
  }

  function initStatusDropdown() {
    const trigger = document.getElementById('sidebar-user-trigger');
    const dropdown = document.getElementById('status-dropdown');
    if (!trigger || !dropdown) return;

    trigger.addEventListener('click', function(e) {
      e.stopPropagation();
      isStatusDropdownOpen = !isStatusDropdownOpen;
      dropdown.classList.toggle('open', isStatusDropdownOpen);

      if (isStatusDropdownOpen) renderStatusOptions();
    });

    document.addEventListener('click', function() {
      if (isStatusDropdownOpen) {
        isStatusDropdownOpen = false;
        dropdown.classList.remove('open');
      }
    });

    dropdown.addEventListener('click', function(e) { e.stopPropagation(); });
  }

  function renderStatusOptions() {
    const container = document.getElementById('status-options');
    if (!container) return;

    // Default status if state doesn't have one
    const current = (window.AmepleState && window.AmepleState.currentStatus) || '💬 Open to chat';

    container.innerHTML = predefinedStatuses.map(function(status) {
      const isCurrent = status === current;
      return '<div class="status-option' + (isCurrent ? ' current' : '') + '" data-status="' + status + '">'
        + status + '</div>';
    }).join('');

    // Parse emojis in status options
    if (window.AmepleEmoji) window.AmepleEmoji.parse(container);

    container.querySelectorAll('.status-option').forEach(function(opt) {
      opt.addEventListener('click', function() {
        const status = this.dataset.status;
        if (window.AmepleAuth) window.AmepleAuth.setStatus(status);
        if (window.notyf) window.notyf.success('Status updated!');
        isStatusDropdownOpen = false;
        document.getElementById('status-dropdown').classList.remove('open');
        updateStatusDisplay();
      });
    });

    // Custom status save
    const saveBtn = document.getElementById('btn-save-custom-status');
    if (saveBtn) {
      saveBtn.onclick = function() {
        const input = document.getElementById('custom-status-input');
        if (input && input.value.trim()) {
          const status = input.value.trim().substring(0, 50);
          if (window.AmepleAuth) window.AmepleAuth.setStatus(status);
          if (window.notyf) window.notyf.success('Custom status set!');
          isStatusDropdownOpen = false;
          input.value = '';
          document.getElementById('status-dropdown').classList.remove('open');
          updateStatusDisplay();
        }
      };
    }
  }

  window.AmepleSidebar = {
    updateStatusDisplay: updateStatusDisplay
  };
})();
