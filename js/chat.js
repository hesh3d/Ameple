// Orbiit — Chat & Connection Logic

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
    loadConversations();
    loadRequests();
    setupSendMessage();
    setupChatInput();
  });

  function setupSidebarAvatar() {
    const user = window.OrbiitAuth.getCurrentUser();
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
    const connections = window.OrbiitAuth.getConnections();
    const accepted = connections.filter(function(c) { return c.status === 'accepted'; });
    const list = document.getElementById('conversation-list');

    if (accepted.length === 0) {
      list.innerHTML = '<div class="chat-empty" style="padding:40px 20px;">'
        + '<div class="chat-empty-icon">🤝</div>'
        + '<div class="chat-empty-text">No conversations yet</div>'
        + '<div class="chat-empty-hint">Connect with people on the globe to start chatting</div>'
        + '</div>';
      return;
    }

    list.innerHTML = accepted.map(function(conn) {
      const user = conn.receiver || {};
      const messages = window.OrbiitAuth.getMessages(conn.id);
      const lastMsg = messages.length ? messages[messages.length - 1] : null;

      return '<div class="conversation-item" data-connection-id="' + conn.id + '">'
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
    const connections = window.OrbiitAuth.getConnections();
    const pending = connections.filter(function(c) { return c.status === 'pending'; });
    const list = document.getElementById('requests-list');
    const badge = document.getElementById('requests-tab-badge');

    if (badge) {
      if (pending.length > 0) {
        badge.style.display = '';
        badge.textContent = pending.length;
      } else {
        badge.style.display = 'none';
      }
    }

    if (pending.length === 0) {
      list.innerHTML = '<div class="chat-empty" style="padding:40px 20px;">'
        + '<div class="chat-empty-icon">🔔</div>'
        + '<div class="chat-empty-text">No pending requests</div>'
        + '</div>';
      return;
    }

    list.innerHTML = pending.map(function(conn) {
      const user = conn.receiver || {};
      return '<div class="request-card">'
        + '<div class="request-card-header">'
        + '<img src="' + (user.avatar_url || 'assets/default-avatar.svg') + '" class="request-card-avatar" alt="">'
        + '<div><div class="request-card-name">' + (user.first_name || '') + ' ' + (user.last_name || '') + '</div>'
        + '<div class="request-card-job">' + (user.job_emoji || '') + ' ' + (user.job_name || '') + '</div></div>'
        + '</div>'
        + (conn.message ? '<div class="request-card-message">"' + conn.message + '"</div>' : '')
        + '<div class="request-card-actions">'
        + '<button class="btn btn-primary btn-sm btn-accept" data-conn-id="' + conn.id + '">Accept</button>'
        + '<button class="btn btn-secondary btn-sm btn-decline" data-conn-id="' + conn.id + '">Decline</button>'
        + '</div></div>';
    }).join('');

    // Accept/Decline handlers
    list.querySelectorAll('.btn-accept').forEach(function(btn) {
      btn.addEventListener('click', function() {
        const connId = this.dataset.connId;
        window.OrbiitAuth.updateConnection(connId, { status: 'accepted' });
        notyf.success('Connection accepted! 🤝');
        loadConversations();
        loadRequests();
      });
    });

    list.querySelectorAll('.btn-decline').forEach(function(btn) {
      btn.addEventListener('click', function() {
        const connId = this.dataset.connId;
        window.OrbiitAuth.updateConnection(connId, { status: 'declined' });
        notyf.error('Request declined');
        loadRequests();
      });
    });
  }

  // --- Open Chat ---
  function openChat(connection) {
    activeConnectionId = connection.id;
    const user = connection.receiver || {};

    // Show chat window
    document.getElementById('chat-empty').style.display = 'none';
    const activeChat = document.getElementById('active-chat');
    activeChat.style.display = 'flex';

    // Header
    document.getElementById('chat-header-avatar').src = user.avatar_url || 'assets/default-avatar.svg';
    document.getElementById('chat-header-name').textContent = (user.first_name || '') + ' ' + (user.last_name || '');
    const statusEl = document.getElementById('chat-header-status');
    statusEl.textContent = user.is_online ? '● Online' : '○ Offline';
    statusEl.className = 'chat-header-status' + (user.is_online ? ' online' : '');

    // Load messages
    renderMessages(connection.id);
  }

  // --- Render Messages ---
  function renderMessages(connectionId) {
    const container = document.getElementById('chat-messages');
    const messages = window.OrbiitAuth.getMessages(connectionId);
    const currentUserId = (window.OrbiitState.currentUser || {}).id || 'local';

    if (messages.length === 0) {
      container.innerHTML = '<div class="chat-empty" style="flex:1;">'
        + '<div class="chat-empty-icon">👋</div>'
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

      html += '<div class="message ' + (isSent ? 'sent' : 'received') + '">'
        + '<div class="message-bubble">' + escapeHtml(msg.content) + '</div>'
        + '<div class="message-meta">'
        + '<span>' + time + '</span>'
        + (isSent ? '<span class="message-check">' + (msg.is_read ? '✓✓' : '✓') + '</span>' : '')
        + '</div></div>';
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

      // Auto-resize
      input.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 120) + 'px';
      });
    }
  }

  function sendMessage() {
    if (!activeConnectionId) return;

    const input = document.getElementById('chat-input');
    const content = input.value.trim();
    if (!content) return;

    const currentUserId = (window.OrbiitState.currentUser || {}).id || 'local';

    const message = {
      id: 'msg-' + Date.now(),
      connection_id: activeConnectionId,
      sender_id: currentUserId,
      content: content,
      is_read: false,
      created_at: new Date().toISOString()
    };

    window.OrbiitAuth.saveMessage(activeConnectionId, message);
    input.value = '';
    input.style.height = 'auto';
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
})();
