// Ameple — Shared Sidebar Logic
// Handles sidebar navigation, user status popover, and avatar syncing

(function() {
  document.addEventListener('DOMContentLoaded', function() {
    initSidebar();
    setupSidebarAvatar();
    initStatusDropdown();
    initCollapsibleSidebar();
    updateStatusDisplay();
    requestNotificationPermission();
    refreshChatNavBadge();
  });

  // ── Start realtime subscription ASAP — don't wait for DOMContentLoaded.
  // This way the WebSocket handshake begins in parallel with page rendering,
  // so by the time the user does anything the connection is already live.
  if (!window.location.pathname.endsWith('chat.html')) {
    if (window.AmepleSupabaseReady) {
      window.AmepleSupabaseReady.then(function() {
        setupGlobalNotificationListener();
      });
    }
  }

  // --- Browser Notification Permission ---
  function requestNotificationPermission() {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }

  // --- Show a browser push notification ---
  function showBrowserNotification(title, body, icon) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    if (document.visibilityState === 'visible') return; // already looking at the page
    try {
      new Notification(title, {
        body: body,
        icon: icon || 'assets/logo.svg'
      });
    } catch (e) { /* silent */ }
  }

  // --- Calculate total unread count from localStorage ---
  function calcTotalUnread() {
    const user = window.AmepleAuth && window.AmepleAuth.getCurrentUser();
    if (!user) return 0;

    // Unread messages
    let msgCount = 0;
    try {
      const allMessages = JSON.parse(localStorage.getItem('ameple_messages') || '{}');
      Object.values(allMessages).forEach(function(msgs) {
        msgs.forEach(function(m) {
          if (!m.is_read && m.sender_id !== user.id) msgCount++;
        });
      });
    } catch (e) { /* silent */ }

    // Pending incoming connection requests
    let reqCount = 0;
    try {
      const connections = JSON.parse(localStorage.getItem('ameple_connections') || '[]');
      connections.forEach(function(c) {
        if (c.status === 'pending' && c.requester_id !== user.id) reqCount++;
      });
    } catch (e) { /* silent */ }

    return msgCount + reqCount;
  }

  // --- Update the red badge on the Messages nav item ---
  function refreshChatNavBadge() {
    const badge = document.getElementById('chat-nav-badge');
    if (!badge) return;
    const count = calcTotalUnread();
    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.style.display = '';
    } else {
      badge.style.display = 'none';
    }
  }

  // Expose so chat.js can call it after marking messages read
  window.AmepleSidebarBadge = { refresh: refreshChatNavBadge };

  // --- Global realtime listener (used on non-chat pages) ---
  let _globalNotifChannel = null;

  async function setupGlobalNotificationListener() {
    const sb = window.AmepleSupabase || (window.AmepleSupabaseReady && await window.AmepleSupabaseReady);
    if (!sb) return;

    const user = window.AmepleAuth && window.AmepleAuth.getCurrentUser();
    if (!user) return;

    if (_globalNotifChannel) {
      try { sb.removeChannel(_globalNotifChannel); } catch (e) {}
    }

    // Fetch connections upfront so sender names are available when first notification arrives
    if (window.AmepleAuth.fetchConnections) {
      window.AmepleAuth.fetchConnections().catch(function() {});
    }

    _globalNotifChannel = sb
      .channel('sidebar-notif')

      // New incoming message
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages'
      }, function(payload) {
        const msg = payload.new;
        if (msg.sender_id === user.id) return;

        // Only handle messages that belong to MY connections
        const connections = window.AmepleAuth.getConnections();
        const conn = connections.find(function(c) { return c.id === msg.connection_id; });
        if (!conn) return; // not my conversation — ignore

        // Cache the message so badge count is accurate
        try {
          const allMessages = JSON.parse(localStorage.getItem('ameple_messages') || '{}');
          if (!allMessages[msg.connection_id]) allMessages[msg.connection_id] = [];
          if (!allMessages[msg.connection_id].some(function(m) { return m.id === msg.id; })) {
            allMessages[msg.connection_id].push(msg);
            localStorage.setItem('ameple_messages', JSON.stringify(allMessages));
          }
        } catch (e) { /* silent */ }

        refreshChatNavBadge();

        // In-app toast + browser notification
        const senderName = conn.receiver
          ? ((conn.receiver.first_name || '') + ' ' + (conn.receiver.last_name || '')).trim()
          : 'New message';
        const avatar = (conn.receiver && conn.receiver.avatar_url) || 'assets/logo.svg';
        if (window.notyf) window.notyf.success('💬 ' + senderName + ': ' + msg.content.slice(0, 60));
        showBrowserNotification(senderName, msg.content.slice(0, 100), avatar);
      })

      // New connection request
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'connections',
        filter: 'receiver_id=eq.' + user.id
      }, async function(payload) {
        const conn = payload.new;

        // Fetch sender name for notification
        let senderName = 'Someone';
        let senderAvatar = 'assets/logo.svg';
        try {
          const { data: sender } = await sb.from('users').select('first_name,last_name,avatar_url').eq('id', conn.sender_id).single();
          if (sender) {
            senderName = ((sender.first_name || '') + ' ' + (sender.last_name || '')).trim() || senderName;
            senderAvatar = sender.avatar_url || senderAvatar;
          }
        } catch (e) { /* silent */ }

        // Cache request so badge reflects it
        try {
          const connections = JSON.parse(localStorage.getItem('ameple_connections') || '[]');
          if (!connections.some(function(c) { return c.id === conn.id; })) {
            connections.unshift({
              id: conn.id,
              requester_id: conn.sender_id,
              receiver_id: conn.receiver_id,
              receiver: { id: conn.sender_id, first_name: senderName.split(' ')[0], last_name: senderName.split(' ').slice(1).join(' '), avatar_url: senderAvatar },
              status: 'pending',
              message: conn.message,
              created_at: conn.created_at
            });
            localStorage.setItem('ameple_connections', JSON.stringify(connections));
          }
        } catch (e) { /* silent */ }

        refreshChatNavBadge();
        if (window.notyf) window.notyf.success('👋 ' + senderName + ' sent you a connection request!');
        showBrowserNotification('New connection request', senderName + ' wants to connect with you', senderAvatar);
      })

      .subscribe();
  }

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
