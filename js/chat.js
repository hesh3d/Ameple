// Ameple — Chat & Connection Logic

(function() {
  let notyf;
  let activeConnectionId = null;

  document.addEventListener('DOMContentLoaded', function() {
    notyf = new Notyf({
      duration: 3000,
      position: { x: 'right', y: 'top' }
    });

    setupSidebarAvatar();
    setupTabs();
    setupSendMessage();
    setupChatInput();
    setupEmojiPicker();
    setupCalling();

    // Load from cache first, then refresh from Supabase
    loadConversations();
    loadRequests();
    refreshFromSupabase();
  });

  async function refreshFromSupabase() {
    // Wait for Supabase client to be ready first
    const sb = await window.AmepleSupabaseReady;
    if (!sb) return;

    // Start realtime subscriptions IMMEDIATELY (before fetching connections).
    // This ensures no incoming messages are missed while the UI is loading.
    setupRealtimeSubscriptions();

    // Fetch connections independently — UI updates once ready
    try {
      await window.AmepleAuth.fetchConnections();
      loadConversations();
      loadRequests();
    } catch (e) {
      console.warn('Failed to refresh from Supabase:', e);
    }
  }

  // --- Browser push notification helper ---
  function showBrowserNotification(title, body, icon) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    if (document.visibilityState === 'visible') return;
    try {
      new Notification(title, { body: body, icon: icon || 'assets/logo.svg' });
    } catch (e) { /* silent */ }
  }

  // --- Realtime: listen for messages, requests, profile & presence changes ---
  let realtimeChannel = null;

  // Track unread message counts per connection (resets when chat is opened)
  const unreadCounts = {};

  async function setupRealtimeSubscriptions() {
    // Use the ready-promise so we never run with a null client
    const sb = window.AmepleSupabase || await window.AmepleSupabaseReady;
    if (!sb) return;

    // Clean up existing subscription
    if (realtimeChannel) {
      try { sb.removeChannel(realtimeChannel); } catch (e) {}
      realtimeChannel = null;
    }

    const user = window.AmepleAuth.getCurrentUser();
    if (!user) return;

    realtimeChannel = sb
      .channel('chat-realtime')

      // ── 1. New incoming messages ──────────────────────────────────────────
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages'
      }, (payload) => {
        const msg = payload.new;
        // Ignore our own messages (already in cache from optimistic update)
        if (msg.sender_id === user.id) return;

        // Add to in-memory state, avoiding duplicates
        if (!window.AmepleState.messages) window.AmepleState.messages = {};
        if (!window.AmepleState.messages[msg.connection_id]) window.AmepleState.messages[msg.connection_id] = [];
        if (!window.AmepleState.messages[msg.connection_id].some(m => m.id === msg.id)) {
          window.AmepleState.messages[msg.connection_id].push(msg);
        }

        if (msg.connection_id === activeConnectionId) {
          // Active chat: render immediately and mark as read
          renderMessages(msg.connection_id);
          window.AmepleAuth.markMessagesRead(msg.connection_id);
        } else {
          // Background chat: increment unread badge and show toast
          unreadCounts[msg.connection_id] = (unreadCounts[msg.connection_id] || 0) + 1;
          const connections = window.AmepleAuth.getConnections();
          const conn = connections.find(c => c.id === msg.connection_id);
          if (conn && conn.receiver) {
            const name = ((conn.receiver.first_name || '') + ' ' + (conn.receiver.last_name || '')).trim();
            notyf.success('💬 ' + name + ': ' + msg.content.slice(0, 60));
            // Browser push notification when tab is in background
            showBrowserNotification(name, msg.content.slice(0, 100), conn.receiver.avatar_url);
          }
        }
        loadConversations();
        if (window.AmepleSidebarBadge) window.AmepleSidebarBadge.refresh();
      })

      // ── 2. New connection request arriving (I am the receiver) ────────────
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'connections',
        filter: `receiver_id=eq.${user.id}`
      }, async (payload) => {
        const conn = payload.new;
        // Fetch sender profile
        const { data: sender } = await sb
          .from('users')
          .select('*')
          .eq('id', conn.sender_id)
          .single();

        const newConn = {
          id: conn.id,
          requester_id: conn.sender_id,
          receiver_id: conn.receiver_id,
          receiver: sender || {},
          status: conn.status,
          message: conn.message,
          created_at: conn.created_at
        };

        const connections = window.AmepleAuth.getConnections();
        if (!connections.some(c => c.id === conn.id)) {
          connections.unshift(newConn);
          window.AmepleState.connections = connections;
        }

        loadRequests();
        const senderName = sender
          ? ((sender.first_name || '') + ' ' + (sender.last_name || '')).trim()
          : 'Someone';
        notyf.success('👋 ' + senderName + ' sent you a connection request!');
        showBrowserNotification('New connection request', senderName + ' wants to connect with you', sender && sender.avatar_url);
        if (window.AmepleSidebarBadge) window.AmepleSidebarBadge.refresh();
      })

      // ── 3. Connection status updated (accepted / declined) ────────────────
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'connections'
      }, (payload) => {
        const conn = payload.new;
        // Notify if someone accepted OUR request
        if (conn.sender_id === user.id && conn.status === 'accepted') {
          const connections = window.AmepleAuth.getConnections();
          const existing = connections.find(c => c.id === conn.id);
          const name = existing && existing.receiver
            ? ((existing.receiver.first_name || '') + ' ' + (existing.receiver.last_name || '')).trim()
            : 'Someone';
          notyf.success('🤝 ' + name + ' accepted your request!');
        }
        window.AmepleAuth.fetchConnections().then(() => {
          loadConversations();
          loadRequests();
        });
      })

      // ── 4. User profile updated (name, avatar, status, online flag) ───────
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'users'
      }, (payload) => {
        const updated = payload.new;
        applyUserUpdate(updated);
      })

      .subscribe();

    // ── 5. Real-time online / offline from Presence (auth.js) ─────────────
    window.addEventListener('ameple:user-online', (e) => {
      updateUserOnlineStatusUI(e.detail.userId, true, null);
    });
    window.addEventListener('ameple:user-offline', (e) => {
      updateUserOnlineStatusUI(e.detail.userId, false, e.detail.last_seen);
    });
  }

  // Apply a user-table UPDATE to all cached connections + active chat header
  function applyUserUpdate(updated) {
    const connections = window.AmepleAuth.getConnections();
    let changed = false;
    connections.forEach(conn => {
      if (conn.receiver && conn.receiver.id === updated.id) {
        Object.assign(conn.receiver, updated);
        changed = true;
      }
    });
    if (!changed) return;

    window.AmepleState.connections = connections;
    loadConversations();

    // Update active chat header if needed
    if (activeConnectionId) {
      const activeConn = connections.find(c => c.id === activeConnectionId);
      if (activeConn && activeConn.receiver && activeConn.receiver.id === updated.id) {
        const nameEl = document.getElementById('chat-header-name');
        const avatarEl = document.getElementById('chat-header-avatar');
        const statusEl = document.getElementById('chat-header-status');
        if (nameEl) nameEl.textContent = (updated.first_name || '') + ' ' + (updated.last_name || '');
        if (avatarEl && updated.avatar_url) avatarEl.src = updated.avatar_url;
        if (statusEl) {
          statusEl.textContent = updated.is_online
            ? '● Online'
            : '🕒 ' + window.AmepleAuth.formatTimeAgo(updated.last_seen);
          statusEl.className = 'chat-header-status' + (updated.is_online ? ' online' : '');
        }
      }
    }
  }

  // Update just the online/offline indicator without a full DB fetch
  function updateUserOnlineStatusUI(userId, isOnline, lastSeen) {
    const connections = window.AmepleAuth.getConnections();
    let changed = false;
    connections.forEach(conn => {
      if (conn.receiver && conn.receiver.id === userId) {
        conn.receiver.is_online = isOnline;
        if (!isOnline && lastSeen) conn.receiver.last_seen = lastSeen;
        changed = true;
      }
    });
    if (!changed) return;

    window.AmepleState.connections = connections;
    loadConversations();

    // Update active chat status bar
    if (activeConnectionId) {
      const activeConn = connections.find(c => c.id === activeConnectionId);
      if (activeConn && activeConn.receiver && activeConn.receiver.id === userId) {
        const statusEl = document.getElementById('chat-header-status');
        if (statusEl) {
          statusEl.textContent = isOnline
            ? '● Online'
            : '🕒 ' + window.AmepleAuth.formatTimeAgo(lastSeen || new Date().toISOString());
          statusEl.className = 'chat-header-status' + (isOnline ? ' online' : '');
        }
      }
    }
  }

  function setupSidebarAvatar() {
    const user = window.AmepleAuth.getCurrentUser();
    const avatar = document.getElementById('sidebar-user-avatar');
    if (avatar && user && user.avatar_url) avatar.src = user.avatar_url;
  }

  // --- Tabs ---
  function setupTabs() {
    document.querySelectorAll('.chat-tab').forEach(function(tab) {
      tab.addEventListener('click', function() {
        document.querySelectorAll('.chat-tab').forEach(function(t) { t.classList.remove('active'); });
        this.classList.add('active');

        const tabName = this.dataset.tab;
        document.getElementById('conversation-list').style.display = tabName === 'chats' ? '' : 'none';
        document.getElementById('requests-list').style.display = tabName === 'requests' ? '' : 'none';
      });
    });
  }

  // --- Load Conversations ---
  function loadConversations() {
    const connections = window.AmepleAuth.getConnections();

    // Deduplicate: keep only one conversation per other user (the most recent one)
    const seenUserIds = {};
    const accepted = connections
      .filter(function(c) { return c.status === 'accepted'; })
      .filter(function(c) {
        const otherId = (c.receiver || {}).id;
        if (!otherId || seenUserIds[otherId]) return false;
        seenUserIds[otherId] = true;
        return true;
      });

    const list = document.getElementById('conversation-list');

    if (accepted.length === 0) {
      list.innerHTML = '<div class="chat-empty" style="padding:40px 20px;">'
        + '<div class="chat-empty-icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 11l4-4a3 3 0 0 1 4.24 0l1.42 1.42a3 3 0 0 1 0 4.24l-4 4"></path><path d="M13 13l-4 4a3 3 0 0 1-4.24 0L3.34 15.6a3 3 0 0 1 0-4.24l4-4"></path><path d="M15 9l-6 6"></path></svg></div>'
        + '<div class="chat-empty-text">No conversations yet</div>'
        + '<div class="chat-empty-hint">Connect with people on the globe to start chatting</div>'
        + '</div>';
      return;
    }

    const currentUserId = ((window.AmepleAuth.getCurrentUser && window.AmepleAuth.getCurrentUser()) || {}).id;

    list.innerHTML = accepted.map(function(conn) {
      const user = conn.receiver || {};
      const messages = window.AmepleAuth.getMessages(conn.id);
      const lastMsg = messages.length ? messages[messages.length - 1] : null;

      // Unread count: in-memory tracker + cached unread messages from DB
      const cachedUnread = messages.filter(function(m) {
        return !m.is_read && m.sender_id !== currentUserId;
      }).length;
      const liveUnread = unreadCounts[conn.id] || 0;
      const totalUnread = Math.max(cachedUnread, liveUnread);

      return '<div class="conversation-item' + (totalUnread > 0 ? ' unread' : '') + '" data-connection-id="' + conn.id + '">'
        + '<div class="conversation-avatar">'
        + '<img src="' + (user.avatar_url || 'assets/default-avatar.svg') + '" alt="' + (user.first_name || '') + '">'
        + (user.is_online ? '<div class="online-dot"></div>' : '')
        + '</div>'
        + '<div class="conversation-info">'
        + '<div class="conversation-name">' + (user.first_name || '') + ' ' + (user.last_name || '') + '</div>'
        + '<div class="conversation-preview">' + (lastMsg ? lastMsg.content : conn.message || 'No messages yet') + '</div>'
        + '</div>'
        + '<div class="conversation-meta">'
        + '<span class="conversation-time">' + formatTime(lastMsg ? lastMsg.created_at : conn.created_at) + '</span>'
        + (totalUnread > 0 ? '<span class="conversation-unread-badge">' + totalUnread + '</span>' : '')
        + '</div></div>';
    }).join('');

    list.querySelectorAll('.conversation-item').forEach(function(item) {
      item.addEventListener('click', function() {
        const connId = this.dataset.connectionId;
        const conn = connections.find(function(c) { return c.id === connId; });
        if (conn) openChat(conn);

        list.querySelectorAll('.conversation-item').forEach(function(i) { i.classList.remove('active'); });
        this.classList.add('active');
      });
    });
  }

  // --- Load Requests ---
  function loadRequests() {
    const connections = window.AmepleAuth.getConnections();
    const currentUserId = ((window.AmepleAuth.getCurrentUser && window.AmepleAuth.getCurrentUser()) || window.AmepleState.currentUser || {}).id || 'local';
    const list = document.getElementById('requests-list');
    const badge = document.getElementById('requests-tab-badge');

    // Deduplicate by other user id — if the same person appears in both sent & received
    // (mutual request race condition), show only the received one (so we can accept it)
    const seenReqUserIds = {};
    const received = connections.filter(function(c) {
      if (c.status !== 'pending' || c.requester_id === currentUserId) return false;
      const otherId = (c.receiver || {}).id || c.requester_id;
      if (seenReqUserIds[otherId]) return false;
      seenReqUserIds[otherId] = true;
      return true;
    });
    const sent = connections.filter(function(c) {
      if (c.status !== 'pending' || c.requester_id !== currentUserId) return false;
      const otherId = (c.receiver || {}).id || c.receiver_id;
      // Don't show as "sent" if we already show it as "received"
      if (seenReqUserIds[otherId]) return false;
      return true;
    });

    // Badge shows only incoming requests
    if (badge) {
      if (received.length > 0) {
        badge.style.display = '';
        badge.textContent = received.length;
      } else {
        badge.style.display = 'none';
      }
    }

    if (received.length === 0 && sent.length === 0) {
      list.innerHTML = '<div class="chat-empty" style="padding:40px 20px;">'
        + '<div class="chat-empty-icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg></div>'
        + '<div class="chat-empty-text">No pending requests</div>'
        + '</div>';
      return;
    }

    function buildCard(conn, isSent) {
      const user = conn.receiver || {};
      const userId = user.id || '';
      return '<div class="request-card">'
        + '<div class="request-card-header">'
        + '<img src="' + (user.avatar_url || 'assets/default-avatar.svg') + '" class="request-card-avatar request-card-avatar-clickable" data-user-id="' + userId + '" alt="">'
        + '<div style="flex:1;">'
        + '<div class="request-card-name">' + (user.first_name || '') + ' ' + (user.last_name || '') + '</div>'
        + '<div class="request-card-job">' + (user.job_emoji || '') + ' ' + (user.job_name || '') + '</div>'
        + '</div>'
        + '<button class="btn-view-request-profile" data-user-id="' + userId + '" title="View profile">'
        + '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>'
        + '</button>'
        + '</div>'
        + (conn.message ? '<div class="request-card-message">"' + conn.message + '"</div>' : '')
        + '<div class="request-card-actions">'
        + (isSent
          ? '<span class="request-pending-label">Pending...</span>'
            + '<button class="btn btn-secondary btn-sm btn-cancel" data-conn-id="' + conn.id + '">Cancel</button>'
          : '<button class="btn btn-primary btn-sm btn-accept" data-conn-id="' + conn.id + '">Accept</button>'
            + '<button class="btn btn-secondary btn-sm btn-decline" data-conn-id="' + conn.id + '">Decline</button>')
        + '</div></div>';
    }

    let html = '';

    if (received.length > 0) {
      html += '<div class="requests-section-label">Received</div>';
      html += received.map(function(conn) { return buildCard(conn, false); }).join('');
    }

    if (sent.length > 0) {
      html += '<div class="requests-section-label">Sent</div>';
      html += sent.map(function(conn) { return buildCard(conn, true); }).join('');
    }

    list.innerHTML = html;

    // View profile buttons (icon + avatar click)
    list.querySelectorAll('.btn-view-request-profile, .request-card-avatar-clickable').forEach(function(el) {
      el.addEventListener('click', function() {
        const userId = this.dataset.userId;
        const allConns = window.AmepleAuth.getConnections();
        const conn = allConns.find(function(c) { return (c.receiver || {}).id === userId; });
        if (conn && conn.receiver) openRequestProfilePanel(conn.receiver, conn);
      });
    });

    list.querySelectorAll('.btn-accept').forEach(function(btn) {
      btn.addEventListener('click', function() {
        window.AmepleAuth.updateConnection(this.dataset.connId, { status: 'accepted' });
        notyf.success('Connection accepted! 🤝');
        closeRequestProfilePanel();
        loadConversations();
        loadRequests();
      });
    });

    list.querySelectorAll('.btn-decline').forEach(function(btn) {
      btn.addEventListener('click', function() {
        window.AmepleAuth.updateConnection(this.dataset.connId, { status: 'declined' });
        notyf.error('Request declined');
        closeRequestProfilePanel();
        loadRequests();
      });
    });

    list.querySelectorAll('.btn-cancel').forEach(function(btn) {
      btn.addEventListener('click', function() {
        window.AmepleAuth.updateConnection(this.dataset.connId, { status: 'declined' });
        notyf.success('Request cancelled');
        closeRequestProfilePanel();
        loadRequests();
      });
    });
  }

  // --- Request Profile Panel ---
  function openRequestProfilePanel(user, conn) {
    const panel = document.getElementById('right-panel');
    const body  = document.getElementById('right-panel-body');
    const title = document.getElementById('right-panel-title');
    if (!panel || !body || !user) return;

    title.textContent = 'Profile';

    const isSent = conn && conn.requester_id === ((window.AmepleAuth.getCurrentUser && window.AmepleAuth.getCurrentUser()) || window.AmepleState.currentUser || {}).id;

    body.innerHTML = renderProfileCard(user)
      + '<div class="request-profile-actions" style="padding:16px 20px; display:flex; gap:10px; border-top:2px solid #1A1A2E; flex-wrap:wrap;">'
      + (user.latitude && user.longitude
          ? '<a href="globe.html?userId=' + (user.id || '') + '" class="btn btn-secondary btn-sm" style="display:flex;align-items:center;gap:6px;text-decoration:none;">'
            + '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>'
            + 'View on Globe</a>'
          : '')
      + (conn
          ? (isSent
              ? '<button class="btn btn-secondary btn-sm btn-cancel" data-conn-id="' + conn.id + '" style="flex:1;">Cancel Request</button>'
              : '<button class="btn btn-primary btn-sm btn-panel-accept" data-conn-id="' + conn.id + '" style="flex:1;">Accept</button>'
                + '<button class="btn btn-secondary btn-sm btn-panel-decline" data-conn-id="' + conn.id + '" style="flex:1;">Decline</button>')
          : '')
      + '</div>';

    // Wire panel buttons
    const panelAccept = body.querySelector('.btn-panel-accept');
    if (panelAccept) {
      panelAccept.addEventListener('click', function() {
        window.AmepleAuth.updateConnection(this.dataset.connId, { status: 'accepted' });
        notyf.success('Connection accepted! 🤝');
        closeRequestProfilePanel();
        loadConversations();
        loadRequests();
      });
    }

    const panelDecline = body.querySelector('.btn-panel-decline');
    if (panelDecline) {
      panelDecline.addEventListener('click', function() {
        window.AmepleAuth.updateConnection(this.dataset.connId, { status: 'declined' });
        notyf.error('Request declined');
        closeRequestProfilePanel();
        loadRequests();
      });
    }

    const panelCancel = body.querySelector('.btn-cancel');
    if (panelCancel) {
      panelCancel.addEventListener('click', function() {
        window.AmepleAuth.updateConnection(this.dataset.connId, { status: 'declined' });
        notyf.success('Request cancelled');
        closeRequestProfilePanel();
        loadRequests();
      });
    }

    panel.classList.add('open');
  }

  function closeRequestProfilePanel() {
    const panel = document.getElementById('right-panel');
    if (panel) panel.classList.remove('open');
  }

  // --- Open Chat ---
  async function openChat(connection) {
    activeConnectionId = connection.id;

    // Clear live counter
    unreadCounts[connection.id] = 0;

    // Mark as read in AmepleState IMMEDIATELY — before loadConversations() runs,
    // so the unread badge disappears right away without waiting for the DB round-trip.
    const _curUserId = (window.AmepleAuth.getCurrentUser() || {}).id;
    if (_curUserId && window.AmepleState.messages && window.AmepleState.messages[connection.id]) {
      window.AmepleState.messages[connection.id].forEach(function(m) {
        if (!m.is_read && m.sender_id !== _curUserId) m.is_read = true;
      });
    }

    loadConversations();
    if (window.AmepleSidebarBadge) window.AmepleSidebarBadge.refresh();
    const user = connection.receiver || {};

    // Show chat window
    document.getElementById('chat-empty').style.display = 'none';
    const activeChat = document.getElementById('active-chat');
    activeChat.style.display = 'flex';

    // Header
    document.getElementById('chat-header-avatar').src = user.avatar_url || 'assets/default-avatar.svg';
    document.getElementById('chat-header-name').textContent = (user.first_name || '') + ' ' + (user.last_name || '');
    const statusEl = document.getElementById('chat-header-status');
    const lastSeenText = window.AmepleAuth.formatTimeAgo(user.last_seen);
    statusEl.textContent = user.is_online ? '● Online' : '🕒 ' + lastSeenText;
    statusEl.className = 'chat-header-status' + (user.is_online ? ' online' : '');

    currentCallUser = user; // Store for profile view

    // Wire up header buttons
    const profileBtn = document.getElementById('btn-view-profile');
    if (profileBtn) {
      profileBtn.onclick = () => openProfileModal(user);
    }

    const audioBtn = document.querySelector('[title="Audio Call"]');
    if (audioBtn) audioBtn.onclick = () => startCall('audio');

    const videoBtn = document.querySelector('[title="Video Call"]');
    if (videoBtn) videoBtn.onclick = () => startCall('video');

    // Load messages from cache first
    renderMessages(connection.id);

    // Then fetch fresh messages from Supabase
    try {
      await window.AmepleAuth.fetchMessages(connection.id);
      renderMessages(connection.id);
      // Mark messages as read
      window.AmepleAuth.markMessagesRead(connection.id);
      if (window.AmepleSidebarBadge) window.AmepleSidebarBadge.refresh();
    } catch (e) {
      console.warn('Failed to fetch messages:', e);
    }
  }

  // --- Render Messages ---
  function renderMessages(connectionId) {
    const container = document.getElementById('chat-messages');
    const messages = window.AmepleAuth.getMessages(connectionId);
    const currentUserId = (window.AmepleState.currentUser || {}).id || 'local';

    if (messages.length === 0) {
      container.innerHTML = '<div class="chat-empty" style="flex:1;">'
        + '<div class="chat-empty-icon"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#2563EB" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg></div>'
        + '<div class="chat-empty-text">Start the conversation</div>'
        + '<div class="chat-empty-hint">Say something nice!</div></div>';
      return;
    }

    let html = '';
    let lastDate = '';

    messages.forEach(function(msg) {
      const msgDate = new Date(msg.created_at).toLocaleDateString();
      if (msgDate !== lastDate) {
        html += '<div class="chat-date-separator"><span>' + msgDate + '</span></div>';
        lastDate = msgDate;
      }

      const isSent = msg.sender_id === currentUserId;
      const time = new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      if (msg.type === 'call') {
        // Special render for Call Logs
        const isMissed = !msg.duration || msg.duration === '00:00';
        const callIcon = msg.call_type === 'video' 
          ? `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="3" ry="3"></rect></svg>`
          : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>`;

        html += '<div class="chat-call-log ' + (isSent ? 'sent' : 'received') + (isMissed ? ' missed' : '') + '">'
          + '<div class="call-log-icon">' + callIcon + '</div>'
          + '<div class="call-log-info">'
          + '<div class="call-log-title">' + (isMissed ? 'Missed ' : '') + (msg.call_type === 'video' ? 'Video' : 'Voice') + ' Call</div>'
          + '<div class="call-log-meta">' + (isMissed ? 'No answer' : 'Duration: ' + msg.duration) + ' · ' + time + '</div>'
          + '</div></div>';
      } else {
        html += '<div class="message ' + (isSent ? 'sent' : 'received') + '">'
          + '<div class="message-bubble">' + escapeHtml(msg.content) + '</div>'
          + '<div class="message-meta">'
          + '<span>' + time + '</span>'
          + (isSent ? '<span class="message-check">' + (msg.is_read ? '✓✓' : '✓') + '</span>' : '')
          + '</div></div>';
      }
    });

    container.innerHTML = html;
    container.scrollTop = container.scrollHeight;
  }

  // --- Send Message ---
  function setupSendMessage() {
    const sendBtn = document.getElementById('btn-send-message');
    if (sendBtn) {
      sendBtn.addEventListener('click', sendMessage);
    }
  }

  function setupChatInput() {
    const input = document.getElementById('chat-input');
    if (input) {
      input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendMessage();
        }
      });

      // Update counter on input
      input.addEventListener('input', function() {
        const text = getChatInputText(input).trim();
        const counter = document.getElementById('char-counter');
        if (counter) {
          counter.textContent = text.length + ' / 500';
          if (text.length > 500) counter.classList.add('limit-reached');
          else counter.classList.remove('limit-reached');
        }
      });

      // Handle paste: enforce plain text but convert native emojis to Apple emojis instantly
      input.addEventListener('paste', function(e) {
        e.preventDefault();
        const text = (e.originalEvent || e).clipboardData.getData('text/plain');
        if (text) {
          const safeText = text.replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, '<br>');
          const finalHtml = window.AmepleEmoji ? window.AmepleEmoji.replaceInHTML(safeText) : safeText;
          document.execCommand('insertHTML', false, finalHtml);
        }
      });
    }
  }

  function setupEmojiPicker() {
    const btn = document.getElementById('btn-toggle-emoji');
    const container = document.getElementById('emoji-picker-container');
    const input = document.getElementById('chat-input');

    if (!btn || !container || !input || !window.EmojiMart) return;

    const pickerOptions = {
      set: 'apple', // Guarantee iOS Apple emojis
      theme: 'light',
      previewPosition: 'none',
      skinTonePosition: 'none',
      onEmojiSelect: function(emoji) {
        if (!window.AmepleEmoji) return;
        
        const imgHtml = window.AmepleEmoji.toImg(emoji.native);
        input.focus();
        document.execCommand('insertHTML', false, imgHtml);
      }
    };
    
    // Initialize EmojiMart picker
    const picker = new EmojiMart.Picker(pickerOptions);
    container.appendChild(picker);

    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      container.classList.toggle('open');
    });

    document.addEventListener('click', function(e) {
      if (!container.contains(e.target) && e.target !== btn) {
        container.classList.remove('open');
      }
    });
  }

  function getChatInputText(el) {
    let text = '';
    for (let node of el.childNodes) {
      if (node.nodeType === Node.TEXT_NODE) text += node.textContent;
      else if (node.tagName === 'IMG' && node.classList.contains('apple-emoji')) text += node.alt;
      else if (node.tagName === 'BR') text += '\n';
      else if (node.tagName === 'DIV' || node.tagName === 'P') text += '\n' + getChatInputText(node);
      else if (node.nodeType === Node.ELEMENT_NODE) text += getChatInputText(node);
    }
    return text;
  }

  async function sendMessage() {
    if (!activeConnectionId) return;

    const input = document.getElementById('chat-input');
    const content = getChatInputText(input).trim();
    if (!content) return;

    if (content.length > 500) {
      notyf.error('Your message is too long');
      return;
    }

    const currentUserId = (window.AmepleState.currentUser || {}).id || 'local';

    const message = {
      id: 'msg-' + Date.now(),
      connection_id: activeConnectionId,
      sender_id: currentUserId,
      content: content,
      is_read: false,
      created_at: new Date().toISOString()
    };

    input.innerHTML = '';

    // Reset counter
    const counter = document.getElementById('char-counter');
    if (counter) {
      counter.textContent = '0 / 500';
      counter.classList.remove('limit-reached');
    }

    input.focus();

    await window.AmepleAuth.saveMessage(activeConnectionId, message);
    renderMessages(activeConnectionId);
    loadConversations(); // Update preview
  }

  // --- Helpers ---
  function formatTime(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now - d;

    if (diff < 60000) return 'now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h';
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // --- Calling System (Neobrutalist Lux Logic) ---
  let callTimerInterval = null;
  let callStartTime = null;
  let currentCallUser = null;

  function setupCalling() {
    // Call overlay controls
    const hangupBtn = document.getElementById('btn-call-hangup');
    if (hangupBtn) hangupBtn.onclick = endCall;

    const micBtn = document.getElementById('btn-call-mic');
    if (micBtn) {
      micBtn.onclick = function() {
        this.classList.toggle('muted');
        notyf.success(this.classList.contains('muted') ? 'Microphone Muted' : 'Microphone Unmuted');
      };
    }

    const vidBtn = document.getElementById('btn-call-video');
    if (vidBtn) {
      vidBtn.onclick = toggleVideoCall;
    }

    const volumeBtn = document.getElementById('btn-call-volume');
    if (volumeBtn) {
      volumeBtn.onclick = function() {
        this.classList.toggle('muted');
        notyf.success(this.classList.contains('muted') ? 'Sound Muted' : 'Sound Restored');
      };
    }

    // Profile Panel Close
    const closeProfileBtn = document.getElementById('btn-close-right');
    if (closeProfileBtn) {
      closeProfileBtn.onclick = () => {
        document.getElementById('right-panel').classList.remove('open');
      };
    }

    // PiP Resizing
    const pip = document.getElementById('calling-local-view');
    if (pip) {
      pip.onclick = function() {
        this.classList.toggle('expanded');
      };
    }
  }

  let localStream = null;

  async function toggleVideoCall() {
    const btn = document.getElementById('btn-call-video');
    const overlay = document.getElementById('calling-local-view');
    const videoEl = document.getElementById('local-video-feed');
    const placeholder = document.getElementById('local-video-placeholder');

    if (!btn || !overlay || !videoEl || !placeholder) return;

    if (btn.classList.contains('active')) {
      // Turn OFF
      btn.classList.remove('active');
      overlay.style.display = 'none';
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
      }
      videoEl.srcObject = null;
      notyf.success('Video Camera Off');
    } else {
      // Turn ON
      btn.classList.add('active');
      overlay.style.display = 'flex';
      placeholder.style.display = 'flex';

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        localStream = stream;
        videoEl.srcObject = stream;
        placeholder.style.display = 'none';
        notyf.success('Video Camera On');
      } catch (err) {
        console.error('Camera Error:', err);
        btn.classList.remove('active');
        overlay.style.display = 'none';
        notyf.error('Camera access denied or NOT found 🚫');
      }
    }
  }

  function startCall(type) {
    if (!activeConnectionId) {
      notyf.error('Select a conversation to call');
      return;
    }

    const connections = window.AmepleAuth.getConnections();
    const conn = connections.find(c => c.id === activeConnectionId);
    if (!conn) return;

    currentCallUser = conn.receiver;
    const overlay = document.getElementById('calling-overlay');
    const avatar = document.getElementById('calling-avatar');
    const name = document.getElementById('calling-user-name');
    const localView = document.getElementById('calling-local-view');
    const vidBtn = document.getElementById('btn-call-video');
    const micBtn = document.getElementById('btn-call-mic');
    const volumeBtn = document.getElementById('btn-call-volume');

    if (!overlay || !currentCallUser) return;

    // Reset UI
    if (micBtn) micBtn.classList.remove('muted'); // Default to GREEN
    if (volumeBtn) volumeBtn.classList.remove('muted'); // Default to GREEN
    if (vidBtn) vidBtn.classList.remove('active'); // Default to RED
    overlay.classList.add('active');
    avatar.src = currentCallUser.avatar_url || 'assets/default-avatar.svg';
    avatar.classList.add('ringing');
    name.textContent = currentCallUser.first_name + ' ' + currentCallUser.last_name;
    status.textContent = 'CALLING...';
    status.style.color = '#1A1A2E';
    timer.textContent = 'ESTABLISHING...';
    
    if (type === 'video') {
       toggleVideoCall(); // Auto-start camera for video call
    } else {
       const vidBtn = document.getElementById('btn-call-video');
       if (vidBtn) vidBtn.classList.remove('active');
       localView.style.display = 'none';
    }

    // Simulation delay
    const callType = type;
    setTimeout(() => {
      if (!overlay.classList.contains('active')) {
        // Cancelled before pickup -> Missed Call
        logCall(callType, '00:00');
        return;
      }
      
      status.textContent = '● CONNECTED';
      status.style.color = '#22C55E';
      avatar.classList.remove('ringing');
      
      callStartTime = Date.now();
      callTimerInterval = setInterval(updateCallTimer, 1000);
      notyf.success('Call connected! 👋');
    }, 4500); // Made longer to simulate "waiting for answer"
  }

  function openProfileModal(user) {
    const panel = document.getElementById('right-panel');
    const body = document.getElementById('right-panel-body');
    const title = document.getElementById('right-panel-title');

    if (!panel || !body || !user) return;

    title.textContent = 'Profile';
    body.innerHTML = renderProfileCard(user);
    panel.classList.add('open');
  }

  function renderProfileCard(user) {
    const statusClass = user.is_online ? 'online' : 'offline';
    const lastSeenText = window.AmepleAuth.formatTimeAgo(user.last_seen);
    const statusText = user.is_online ? '● Online' : '🕒 ' + lastSeenText;

    function emojiImg(emoji) {
      if (!emoji) return '';
      return window.AmepleEmoji ? window.AmepleEmoji.toImg(emoji) : emoji;
    }

    function flagImg(flagEmoji) {
      return emojiImg(flagEmoji);
    }

    let skillsHtml = '';
    if (user.skills && user.skills.length) {
      skillsHtml = user.skills.map(s => {
        let sEmoji = '';
        if (window.AmepleData && window.AmepleData.skills) {
          const item = window.AmepleData.skills.find(x => x.name === s);
          if (item) sEmoji = item.emoji + ' ';
        }
        return `<span class="profile-card-skill">${sEmoji}${s}</span>`;
      }).join('');
    }

    let hobbiesHtml = '';
    if (user.hobbies && user.hobbies.length) {
      hobbiesHtml = user.hobbies.map(h => {
        let hEmoji = '';
        if (window.AmepleData && window.AmepleData.hobbies) {
          const item = window.AmepleData.hobbies.find(x => x.name === h);
          if (item) hEmoji = item.emoji + ' ';
        }
        return `<span class="profile-card-hobby">${hEmoji}${h}</span>`;
      }).join(' · ');
    }

    let jobsHtml = '';
    if (user.jobs && user.jobs.length) {
      jobsHtml = user.jobs.map(j => {
        let jEmoji = '';
        if (window.AmepleData && window.AmepleData.jobs) {
          const item = window.AmepleData.jobs.find(x => x.title === j);
          if (item) jEmoji = item.emoji + ' ';
        }
        return `<div class="profile-card-job">${jEmoji}${j}</div>`;
      }).join('');
    } else {
      jobsHtml = `<div class="profile-card-job">${emojiImg(user.job_emoji || '')} ${user.job_name || ''}</div>`;
    }

    let langsHtml = '';
    if (user.languages && user.languages.length) {
      langsHtml = user.languages.map(l => {
        return `<div class="profile-card-language">${flagImg(l.flag || '')} ${l.name}${l.native ? ' <span class="native-badge">Native</span>' : ''}</div>`;
      }).join('');
    }

    const SOCIAL_SVGS = {
      instagram: `<svg viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" /></svg>`,
      linkedin: `<svg viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" /></svg>`,
      twitter: `<svg viewBox="0 0 24 24"><path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932 6.064-6.932zm-1.292 19.49h2.039L6.486 3.24H4.298l13.311 17.403z" /></svg>`,
      youtube: `<svg viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" /></svg>`,
      tiktok: `<svg viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" /></svg>`,
      facebook: `<svg viewBox="0 0 24 24"><path d="M22.675 0h-21.35c-.732 0-1.325.593-1.325 1.325v21.351c0 .731.593 1.324 1.325 1.324h11.495v-9.294h-3.128v-3.622h3.128v-2.671c0-3.1 1.893-4.788 4.659-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.795.715-1.795 1.763v2.313h3.587l-.467 3.622h-3.12v9.293h6.116c.73 0 1.323-.593 1.323-1.324v-21.35c0-.732-.593-1.325-1.325-1.325z" /></svg>`,
      discord: `<svg viewBox="0 0 24 24"><path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028 14.09 14.09 0 001.226-1.994.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01 10.165 10.165 0 00.372.292.077.077 0 01-.006.128 12.81 12.81 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.419 0 1.334-.956 2.419-2.157 2.419zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.419 0 1.334-.946 2.419-2.157 2.419z" /></svg>`,
      snapchat: `<svg viewBox="0 0 24 24"><path d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c-.012.18-.022.345-.03.51.075.045.203.09.401.09.3-.016.659-.12 1.033-.301.165-.088.344-.104.464-.104.182 0 .359.029.509.09.45.149.734.479.734.838.015.449-.39.839-1.213 1.168-.089.029-.209.075-.344.119-.45.135-1.139.36-1.333.81-.09.224-.061.524.12.868l.015.015c.06.136 1.526 3.475 4.791 4.014.255.044.435.27.42.509 0 .075-.015.149-.045.225-.24.569-1.273.988-3.146 1.271-.059.091-.12.375-.164.57-.029.179-.074.36-.134.553-.076.271-.27.405-.555.405h-.03c-.135 0-.313-.031-.538-.074-.36-.075-.765-.135-1.273-.135-.3 0-.599.015-.913.074-.6.104-1.123.464-1.723.884-.853.599-1.826 1.288-3.294 1.288-.06 0-.119-.015-.18-.015h-.149c-1.468 0-2.427-.675-3.279-1.288-.599-.42-1.107-.779-1.707-.884-.314-.045-.629-.074-.928-.074-.54 0-.958.089-1.272.149-.211.043-.391.074-.54.074-.374 0-.523-.224-.583-.42-.061-.192-.09-.389-.135-.567-.046-.181-.105-.494-.166-.57-1.918-.222-2.95-.642-3.189-1.226-.031-.063-.052-.15-.055-.225-.015-.243.165-.465.42-.509 3.264-.54 4.73-3.879 4.791-4.02l.016-.029c.18-.345.224-.645.119-.869-.195-.434-.884-.658-1.332-.809-.121-.029-.24-.074-.346-.119-1.107-.435-1.257-.93-1.197-1.273.09-.479.674-.793 1.168-.793.146 0 .27.029.383.074.42.194.789.3 1.104.3.234 0 .384-.06.465-.105l-.046-.569c-.098-1.626-.225-3.651.307-4.837C7.392 1.077 10.739.807 11.727.807l.419-.015h.06z" /></svg>`,
      whatsapp: `<svg viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.246 2.248 3.484 5.232 3.484 8.412-.003 6.557-5.338 11.892-11.893 11.892-1.997-.001-3.951-.5-5.688-1.448l-6.309 1.656zm6.29-4.143c1.554.912 3.445 1.396 5.362 1.397 5.4 0 9.794-4.393 9.797-9.794.001-2.617-1.02-5.078-2.871-6.931-1.85-1.853-4.312-2.874-6.929-2.875-5.403 0-9.798 4.395-9.8 9.798-.001 2.046.64 4.036 1.855 5.717l-.966 3.528 3.618-.949zm12.317-6.947c-.368-.184-2.174-1.073-2.511-1.196-.337-.123-.583-.184-.829.184s-.951 1.196-1.166 1.441-.43.276-.797.092c-.368-.184-1.554-.573-2.96-1.828-1.094-.976-1.833-2.182-2.047-2.55-.215-.368-.023-.567.161-.75.166-.165.368-.43.552-.644.184-.215.245-.368.368-.613.123-.245.061-.46-.031-.644s-.828-1.993-1.135-2.729c-.3-.718-.606-.613-.829-.624l-.705-.012c-.245 0-.644.092-.982.46-.337.368-1.288 1.258-1.288 3.066s1.319 3.557 1.503 3.802c.184.245 2.596 3.964 6.289 5.554.879.378 1.564.604 2.1.777.883.281 1.687.241 2.322.146.708-.106 2.174-.889 2.481-1.748.307-.859.307-1.595.215-1.748-.093-.153-.338-.245-.706-.429z" /></svg>`
    };

    let socialsHtml = '';
    if (user.social_links) {
      Object.keys(user.social_links).forEach(function(platform) {
        if (user.social_links[platform]) {
          socialsHtml += `<a href="${user.social_links[platform]}" target="_blank" class="social-icon" title="${platform}">${SOCIAL_SVGS[platform] || emojiImg('🔗')}</a>`;
        }
      });
    }

    // Rating stars as SVG emojis
    const starCount = Math.round(user.average_rating || 0);
    const starsHtml = Array(starCount).fill(emojiImg('⭐')).join('');

    return `
      <div class="profile-card-content">
        <img src="${user.avatar_url || 'assets/default-avatar.svg'}" class="profile-card-avatar" onerror="this.src='assets/default-avatar.svg'">
        <div class="profile-card-name">${user.first_name || ''} ${user.last_name || ''} ${flagImg(user.flag || '')}</div>
        <div class="profile-card-status ${statusClass}">${statusText}</div>

        <div class="profile-card-section">
          <div class="profile-card-section-label">${emojiImg('💼')} Work</div>
          <div class="profile-card-jobs-list">${jobsHtml}</div>
        </div>

        <div class="profile-card-section">
          <div class="profile-card-section-label">${emojiImg('👤')} About</div>
          <div class="profile-card-info">Age: ${user.age || '?'} · ${user.gender || ''}</div>
          <div class="profile-card-bio" style="margin-top:10px; font-size:14px; color:#1A1A2E; font-weight:600; line-height:1.5;">${user.current_status || 'No status provided.'}</div>
        </div>

        ${skillsHtml ? `
        <div class="profile-card-section">
          <div class="profile-card-section-label">${emojiImg('🎯')} Skills</div>
          <div class="profile-card-skills">${skillsHtml}</div>
        </div>` : ''}

        ${hobbiesHtml ? `
        <div class="profile-card-section">
          <div class="profile-card-section-label">${emojiImg('🎨')} Hobbies</div>
          <div class="profile-card-hobbies">${hobbiesHtml}</div>
        </div>` : ''}

        ${langsHtml ? `
        <div class="profile-card-section">
          <div class="profile-card-section-label">${emojiImg('🌐')} Languages</div>
          <div class="profile-card-languages">${langsHtml}</div>
        </div>` : ''}

        <div class="profile-card-section">
          <div class="profile-card-section-label">${emojiImg('⭐')} Rating</div>
          <div class="profile-card-rating">
            <span class="rating-stars">${starsHtml}</span>
            <span>${(user.average_rating || 0).toFixed(1)}</span>
            <span class="rating-count">· ${(user.total_ratings || 0)} ratings</span>
          </div>
        </div>

        ${socialsHtml ? `
        <div class="profile-card-section">
          <div class="profile-card-section-label">${emojiImg('📱')} Social</div>
          <div class="profile-card-socials">${socialsHtml}</div>
        </div>` : ''}
      </div>
    `;
  }

  function endCall() {
    const overlay = document.getElementById('calling-overlay');
    if (!overlay || !overlay.classList.contains('active')) return;

    overlay.classList.remove('active');

    // Stop camera
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      localStream = null;
    }
    const btn = document.getElementById('btn-call-video');
    if (btn) btn.classList.remove('active');

    // Log the call
    const timer = document.getElementById('calling-timer');
    const finalDuration = (timer && timer.textContent !== 'ESTABLISHING...') ? timer.textContent : '00:00';
    const callType = document.getElementById('calling-local-view').style.display === 'flex' ? 'video' : 'voice';
    
    logCall(callType, finalDuration);

    clearInterval(callTimerInterval);
    callTimerInterval = null;
    callStartTime = null;

    notyf.error('Call Ended');
  }

  function logCall(type, duration) {
    if (!activeConnectionId) return;

    const currentUserId = (window.AmepleState.currentUser || {}).id || 'local';
    const message = {
      id: 'msg-call-' + Date.now(),
      connection_id: activeConnectionId,
      sender_id: currentUserId,
      type: 'call',
      call_type: type,
      duration: duration,
      content: type.toUpperCase() + ' CALL',
      is_read: true,
      created_at: new Date().toISOString()
    };

    window.AmepleAuth.saveMessage(activeConnectionId, message);
    renderMessages(activeConnectionId);
    loadConversations();
  }

  function updateCallTimer() {
    const timer = document.getElementById('calling-timer');
    if (!timer || !callStartTime) return;

    const diff = Math.floor((Date.now() - callStartTime) / 1000);
    const m = Math.floor(diff / 60);
    const s = diff % 60;
    timer.textContent = (m < 10 ? '0' + m : m) + ':' + (s < 10 ? '0' + s : s);
  }
})();
