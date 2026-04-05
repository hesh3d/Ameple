// Orbiit — Auth State Management
// Uses localStorage as primary store, with Supabase hooks when available

(function() {
  // Initialize global state
  window.OrbiitState = window.OrbiitState || {
    currentUser: null,
    users: [],
    filteredUsers: [],
    activeFilters: {},
    connections: [],
    messages: {},
    currentStatus: '💬 Open to chat'
  };

  const AUTH_KEY = 'orbiit_auth';
  const USER_KEY = 'orbiit_user_data';
  const CONNECTIONS_KEY = 'orbiit_connections';
  const MESSAGES_KEY = 'orbiit_messages';
  const ONBOARDING_KEY = 'orbiit_onboarding';

  // --- LocalStorage Helpers ---
  function saveToStorage(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.warn('localStorage save failed:', e);
    }
  }

  function loadFromStorage(key) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.warn('localStorage load failed:', e);
      return null;
    }
  }

  // --- Auth Functions ---
  window.OrbiitAuth = {
    signUp: async function(email, password, userData) {
      // Try Supabase first
      if (window.OrbiitSupabase) {
        try {
          const { data, error } = await window.OrbiitSupabase.auth.signUp({
            email,
            password,
            options: { data: userData }
          });
          if (error) throw error;

          // Insert user profile
          const { error: profileError } = await window.OrbiitSupabase
            .from('users')
            .insert({
              id: data.user.id,
              email,
              ...userData
            });

          if (profileError) console.warn('Profile insert error:', profileError);
          return { user: data.user, error: null };
        } catch (e) {
          console.warn('Supabase signUp failed, using localStorage:', e);
        }
      }

      // LocalStorage fallback
      const userId = 'usr-local-' + Date.now();
      const user = {
        id: userId,
        email,
        ...userData,
        created_at: new Date().toISOString(),
        is_online: true,
        average_rating: 0,
        total_ratings: 0,
        current_status: '💬 Open to chat'
      };

      saveToStorage(AUTH_KEY, { userId, email });
      saveToStorage(USER_KEY, user);
      window.OrbiitState.currentUser = user;

      return { user, error: null };
    },

    signIn: async function(email, password) {
      if (window.OrbiitSupabase) {
        try {
          const { data, error } = await window.OrbiitSupabase.auth.signInWithPassword({
            email,
            password
          });
          if (error) throw error;
          return { user: data.user, error: null };
        } catch (e) {
          console.warn('Supabase signIn failed:', e);
        }
      }

      // LocalStorage fallback
      const auth = loadFromStorage(AUTH_KEY);
      if (auth && auth.email === email) {
        const user = loadFromStorage(USER_KEY);
        window.OrbiitState.currentUser = user;
        return { user, error: null };
      }

      return { user: null, error: { message: 'Invalid credentials' }};
    },

    signOut: async function() {
      if (window.OrbiitSupabase) {
        try {
          await window.OrbiitSupabase.auth.signOut();
        } catch (e) {}
      }
      localStorage.removeItem(AUTH_KEY);
      window.OrbiitState.currentUser = null;
      window.location.href = 'index.html';
    },

    getCurrentUser: function() {
      if (window.OrbiitState.currentUser) return window.OrbiitState.currentUser;
      const user = loadFromStorage(USER_KEY);
      if (user) {
        window.OrbiitState.currentUser = user;
      }
      return user;
    },

    isLoggedIn: function() {
      return !!loadFromStorage(AUTH_KEY);
    },

    updateUser: function(updates) {
      const user = this.getCurrentUser();
      if (!user) return;
      Object.assign(user, updates);
      saveToStorage(USER_KEY, user);
      window.OrbiitState.currentUser = user;
    },

    // --- Onboarding Data ---
    saveOnboardingData: function(data) {
      saveToStorage(ONBOARDING_KEY, data);
    },

    loadOnboardingData: function() {
      return loadFromStorage(ONBOARDING_KEY) || {};
    },

    clearOnboardingData: function() {
      localStorage.removeItem(ONBOARDING_KEY);
    },

    // --- Connections ---
    getConnections: function() {
      return loadFromStorage(CONNECTIONS_KEY) || [];
    },

    saveConnection: function(connection) {
      const connections = this.getConnections();
      connections.push(connection);
      saveToStorage(CONNECTIONS_KEY, connections);
      window.OrbiitState.connections = connections;
    },

    updateConnection: function(connectionId, updates) {
      const connections = this.getConnections();
      const idx = connections.findIndex(c => c.id === connectionId);
      if (idx >= 0) {
        Object.assign(connections[idx], updates);
        saveToStorage(CONNECTIONS_KEY, connections);
        window.OrbiitState.connections = connections;
      }
    },

    // --- Messages ---
    getMessages: function(connectionId) {
      const allMessages = loadFromStorage(MESSAGES_KEY) || {};
      return allMessages[connectionId] || [];
    },

    saveMessage: function(connectionId, message) {
      const allMessages = loadFromStorage(MESSAGES_KEY) || {};
      if (!allMessages[connectionId]) allMessages[connectionId] = [];
      allMessages[connectionId].push(message);
      saveToStorage(MESSAGES_KEY, allMessages);
      window.OrbiitState.messages = allMessages;
    },

    // --- Status ---
    setStatus: function(status) {
      window.OrbiitState.currentStatus = status;
      this.updateUser({ current_status: status });
    }
  };

  // Initialize state on load
  const user = window.OrbiitAuth.getCurrentUser();
  if (user) {
    window.OrbiitState.currentUser = user;
    window.OrbiitState.currentStatus = user.current_status || '💬 Open to chat';
  }
  window.OrbiitState.connections = window.OrbiitAuth.getConnections();
  window.OrbiitState.messages = loadFromStorage(MESSAGES_KEY) || {};
})();
