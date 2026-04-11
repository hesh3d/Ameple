// Ameple — Auth State Management
// Supabase is the single source of truth. No data is persisted to localStorage.
// Only session identity (AUTH_KEY) and ephemeral UI state are kept in localStorage.

(function() {
  // Initialize global state (in-memory only — reset on each page load)
  window.AmepleState = window.AmepleState || {
    currentUser: null,
    users: [],
    filteredUsers: [],
    activeFilters: {},
    connections: [],
    messages: {},
    unreadCounts: {},   // { connectionId: number } — populated from DB on load
    currentStatus: '💬 Open to chat'
  };

  // Only these keys remain in localStorage — everything else lives in Supabase
  const AUTH_KEY       = 'ameple_auth';        // session identity (userId + email)
  const ONBOARDING_KEY = 'ameple_onboarding';  // temporary form state
  const PROFILE_KEY    = 'ameple_profile';     // cached user profile for instant load

  // --- LocalStorage Helpers (cache layer) ---
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

  // --- Helper: wait for Supabase ---
  async function getSupabase() {
    if (window.AmepleSupabase) return window.AmepleSupabase;
    if (window.AmepleSupabaseReady) {
      return await window.AmepleSupabaseReady;
    }
    return null;
  }

  // --- Auth Functions ---
  window.AmepleAuth = {
    // Helper for formatting "Last seen"
    formatTimeAgo: function(dateInput) {
      if (!dateInput) return 'Not joined yet';
      const date = (typeof dateInput === 'string') ? new Date(dateInput) : dateInput;
      const now = new Date();
      const diffInSecs = Math.floor((now - date) / 1000);

      if (diffInSecs < 60) return 'Just now';
      const diffInMins = Math.floor(diffInSecs / 60);
      if (diffInMins < 60) return `Active ${diffInMins}m ago`;
      const diffInHours = Math.floor(diffInMins / 60);
      if (diffInHours < 24) return `Active ${diffInHours}h ago`;
      const diffInDays = Math.floor(diffInHours / 24);
      if (diffInDays < 7) return `Active ${diffInDays}d ago`;
      return `Active on ${date.toLocaleDateString()}`;
    },

    signUp: async function(email, password, userData) {
      const sb = await getSupabase();
      if (!sb) return { user: null, error: { message: 'Supabase not available' } };

      try {
        const { data, error } = await sb.auth.signUp({
          email,
          password,
          options: { data: userData }
        });
        if (error) throw error;

        // Insert full user profile
        const profile = {
          id: data.user.id,
          email,
          first_name: userData.first_name || '',
          last_name: userData.last_name || '',
          date_of_birth: userData.date_of_birth || null,
          age: userData.age || null,
          gender: userData.gender || null,
          country: userData.country || null,
          city: userData.city || null,
          flag: userData.flag || '',
          latitude: userData.latitude || 0,
          longitude: userData.longitude || 0,
          avatar_url: userData.avatar_url || 'assets/default-avatar.svg',
          job_name: userData.job_name || null,
          job_emoji: userData.job_emoji || null,
          job_category: userData.job_category || null,
          job_type: userData.job_type || null,
          current_status: '💬 Open to chat',
          skills: userData.skills || [],
          hobbies: userData.hobbies || [],
          jobs: userData.jobs || [userData.job_name].filter(Boolean),
          languages: userData.languages || [],
          social_links: userData.social_links || {},
          favorite_games: userData.favorite_games || [],
          average_rating: 0,
          total_ratings: 0,
          is_online: true,
          last_seen: new Date().toISOString()
        };

        // Upsert profile (handle_new_user trigger may have created a row)
        const { error: profileError } = await sb
          .from('users')
          .upsert(profile, { onConflict: 'id' });

        if (profileError) console.warn('Profile upsert error:', profileError);

        // Store session identity only
        saveToStorage(AUTH_KEY, { userId: data.user.id, email });
        saveToStorage(PROFILE_KEY, profile);
        window.AmepleState.currentUser = profile;

        return { user: profile, error: null };
      } catch (e) {
        console.error('SignUp error:', e);
        return { user: null, error: e };
      }
    },

    signIn: async function(email, password) {
      const sb = await getSupabase();
      if (!sb) return { user: null, error: { message: 'Supabase not available' } };

      try {
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;

        // Fetch full profile
        const { data: profile, error: profileError } = await sb
          .from('users')
          .select('*')
          .eq('id', data.user.id)
          .single();

        if (profileError) throw profileError;

        // Update online status, and fix coordinates if missing or placed in wrong country
        const statusUpdate = { is_online: true, last_seen: new Date().toISOString() };

        const countryCenter = profile.country && window.AmepleCountryCoords &&
          window.AmepleCountryCoords[profile.country];

        const missingCoords = !profile.latitude || !profile.longitude ||
          (profile.latitude === 0 && profile.longitude === 0);

        // Check if user is placed in a wrong country (>12° from their country center)
        const wrongCountry = countryCenter && !missingCoords &&
          (Math.abs(profile.latitude  - countryCenter.lat) > 12 ||
           Math.abs(profile.longitude - countryCenter.lon) > 12);

        // Check if coords are only country-level precision (within 0.15° of country center)
        const onlyCountryLevel = countryCenter && !missingCoords &&
          Math.abs(profile.latitude  - countryCenter.lat) < 0.15 &&
          Math.abs(profile.longitude - countryCenter.lon) < 0.15;

        if ((missingCoords || wrongCountry || onlyCountryLevel) && profile.country) {
          // Try city geocoding first
          if (profile.city) {
            try {
              const query = encodeURIComponent(profile.city + ', ' + profile.country);
              const res = await fetch(
                'https://nominatim.openstreetmap.org/search?q=' + query + '&format=json&limit=1',
                { headers: { 'Accept-Language': 'en' } }
              );
              const results = await res.json();
              if (results && results.length > 0) {
                const geoLat = parseFloat(results[0].lat);
                const geoLon = parseFloat(results[0].lon);
                // Validate result is within 12° of country center
                const valid = !countryCenter ||
                  (Math.abs(geoLat - countryCenter.lat) <= 12 &&
                   Math.abs(geoLon - countryCenter.lon) <= 12);
                if (valid) {
                  const offset = (Math.random() - 0.5) * 0.04;
                  statusUpdate.latitude  = geoLat + offset;
                  statusUpdate.longitude = geoLon + offset;
                  profile.latitude  = statusUpdate.latitude;
                  profile.longitude = statusUpdate.longitude;
                }
              }
            } catch (e) { /* silent fail */ }
          }
          // Fallback to country center if city geocoding didn't work
          if ((!statusUpdate.latitude) && countryCenter) {
            statusUpdate.latitude  = countryCenter.lat;
            statusUpdate.longitude = countryCenter.lon;
            profile.latitude  = statusUpdate.latitude;
            profile.longitude = statusUpdate.longitude;
          }
        }

        await sb.from('users')
          .update(statusUpdate)
          .eq('id', data.user.id);

        profile.is_online = true;
        profile.last_seen = new Date().toISOString();

        saveToStorage(AUTH_KEY, { userId: data.user.id, email });
        saveToStorage(PROFILE_KEY, profile);
        window.AmepleState.currentUser = profile;

        // Start Presence tracking (handles offline on tab close / network drop)
        setupPresenceChannel(profile.id);

        return { user: profile, error: null };
      } catch (e) {
        console.error('SignIn error:', e);
        return { user: null, error: e };
      }
    },

    signOut: async function() {
      const user = this.getCurrentUser();
      const sb = await getSupabase();

      if (user && sb) {
        try {
          await sb.from('users')
            .update({ is_online: false, last_seen: new Date().toISOString() })
            .eq('id', user.id);
          await sb.auth.signOut();
        } catch (e) {
          console.warn('SignOut error:', e);
        }
      }

      localStorage.removeItem(AUTH_KEY);
      localStorage.removeItem(PROFILE_KEY);
      localStorage.removeItem('ameple_globe_users');
      window.AmepleState.currentUser    = null;
      window.AmepleState.connections    = [];
      window.AmepleState.messages       = {};
      window.AmepleState.unreadCounts   = {};
      window.location.href = 'index.html';
    },

    // Get current user from in-memory state — falls back to localStorage cache
    getCurrentUser: function() {
      if (window.AmepleState.currentUser) return window.AmepleState.currentUser;
      // Restore from cache on fresh page load / refresh (instant, no Supabase call)
      const cached = loadFromStorage(PROFILE_KEY);
      if (cached) {
        window.AmepleState.currentUser = cached;
        return cached;
      }
      return null;
    },

    // Fetch fresh user profile from Supabase
    fetchCurrentUser: async function() {
      const sb = await getSupabase();
      if (!sb) return this.getCurrentUser();

      try {
        const { data: { user: authUser } } = await sb.auth.getUser();
        if (!authUser) return null;

        const { data: profile } = await sb
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .single();

        if (profile) {
          saveToStorage(AUTH_KEY, { userId: profile.id, email: profile.email });
          saveToStorage(PROFILE_KEY, profile);
          window.AmepleState.currentUser = profile;
          return profile;
        }
      } catch (e) {
        console.warn('fetchCurrentUser error:', e);
      }
      return this.getCurrentUser();
    },

    isLoggedIn: function() {
      return !!loadFromStorage(AUTH_KEY);
    },

    // Check Supabase session
    checkSession: async function() {
      const sb = await getSupabase();
      if (!sb) return this.isLoggedIn();
      try {
        const { data: { session } } = await sb.auth.getSession();
        return !!session;
      } catch (e) {
        return this.isLoggedIn();
      }
    },

    updateUser: async function(updates) {
      const user = this.getCurrentUser();
      if (!user) return;

      // Update in-memory state immediately
      Object.assign(user, updates);
      window.AmepleState.currentUser = user;

      // Persist to localStorage cache (skip large base64 avatar data)
      const toCache = Object.assign({}, user);
      if (toCache.avatar_url && toCache.avatar_url.startsWith('data:')) delete toCache.avatar_url;
      saveToStorage(PROFILE_KEY, toCache);

      // Sync to Supabase
      const sb = await getSupabase();
      if (sb && user.id) {
        try {
          const { error } = await sb
            .from('users')
            .update(updates)
            .eq('id', user.id);
          if (error) console.warn('updateUser error:', error);
        } catch (e) {
          console.warn('updateUser sync error:', e);
        }
      }
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

    // --- Connections (Supabase primary, in-memory cache) ---
    getConnections: function() {
      return window.AmepleState.connections || [];
    },

    fetchConnections: async function() {
      const sb = await getSupabase();
      const user = this.getCurrentUser();
      if (!sb || !user) return this.getConnections();

      try {
        // Get connections where user is sender or receiver
        const { data, error } = await sb
          .from('connections')
          .select('*')
          .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
          .order('created_at', { ascending: false });

        if (error) throw error;

        // Collect all "other user" IDs in one shot, then fetch them in a
        // single .in() query instead of one query per connection (N+1 fix).
        const otherIds = data.map(conn =>
          conn.sender_id === user.id ? conn.receiver_id : conn.sender_id
        );

        let usersMap = {};
        if (otherIds.length > 0) {
          const { data: usersData } = await sb
            .from('users')
            .select('*')
            .in('id', otherIds);
          (usersData || []).forEach(u => { usersMap[u.id] = u; });
        }

        const connections = data.map(conn => {
          const otherId = conn.sender_id === user.id ? conn.receiver_id : conn.sender_id;
          return {
            id: conn.id,
            requester_id: conn.sender_id,
            receiver_id: conn.receiver_id,
            receiver: usersMap[otherId] || {},
            status: conn.status,
            message: conn.message,
            created_at: conn.created_at
          };
        });

        window.AmepleState.connections = connections;
        // Refresh unread counts now that we know our connection IDs
        this.fetchUnreadCounts().catch(function() {});
        return connections;
      } catch (e) {
        console.warn('fetchConnections error:', e);
        return this.getConnections();
      }
    },

    // Fetch unread message counts from DB (no localStorage — always fresh)
    fetchUnreadCounts: async function() {
      const sb = await getSupabase();
      const user = this.getCurrentUser();
      if (!sb || !user) return;

      const ids = (window.AmepleState.connections || [])
        .filter(function(c) { return c.status === 'accepted'; })
        .map(function(c) { return c.id; });
      if (!ids.length) { window.AmepleState.unreadCounts = {}; return; }

      try {
        const { data } = await sb
          .from('messages')
          .select('connection_id')
          .in('connection_id', ids)
          .eq('is_read', false)
          .neq('sender_id', user.id);

        const counts = {};
        (data || []).forEach(function(m) {
          counts[m.connection_id] = (counts[m.connection_id] || 0) + 1;
        });
        window.AmepleState.unreadCounts = counts;
        if (window.AmepleSidebarBadge) window.AmepleSidebarBadge.refresh();
      } catch (e) {
        console.warn('fetchUnreadCounts error:', e);
      }
    },

    saveConnection: async function(connection) {
      const sb = await getSupabase();
      const user = this.getCurrentUser();

      // Prevent self-connection
      const otherId = connection.receiver_id || connection.receiver?.id;
      if (!otherId || (user && otherId === user.id)) return;

      if (sb && user) {
        try {
          // Check for existing connection between these two users (either direction)
          const { data: existing } = await sb
            .from('connections')
            .select('id, status, sender_id, receiver_id')
            .or(
              `and(sender_id.eq.${user.id},receiver_id.eq.${otherId}),` +
              `and(sender_id.eq.${otherId},receiver_id.eq.${user.id})`
            )
            .neq('status', 'declined')
            .maybeSingle();

          if (existing) {
            if (existing.status === 'accepted') {
              // Already connected — skip
              return;
            }
            if (existing.status === 'pending' && existing.sender_id === user.id) {
              // Current user already sent a pending request — skip duplicate
              connection.id = existing.id;
              connection.requester_id = user.id;
              const connections = this.getConnections();
              if (!connections.some(c => c.id === existing.id)) {
                connections.push(connection);
                /* connections updated in AmepleState below */
                window.AmepleState.connections = connections;
              }
              return;
            }
            if (existing.status === 'pending' && existing.sender_id === otherId) {
              // The other user already sent us a request — auto-accept instead
              await sb.from('connections').update({ status: 'accepted' }).eq('id', existing.id);
              connection.id = existing.id;
              connection.status = 'accepted';
              connection.requester_id = existing.sender_id;
              const connections = this.getConnections();
              const idx = connections.findIndex(c => c.id === existing.id);
              if (idx >= 0) {
                connections[idx].status = 'accepted';
              } else {
                connections.push(connection);
              }
              window.AmepleState.connections = connections;
              return;
            }
          }

          const { data, error } = await sb
            .from('connections')
            .insert({
              sender_id: user.id,
              receiver_id: otherId,
              status: connection.status || 'pending',
              message: connection.message || null
            })
            .select()
            .single();

          if (error) throw error;

          // Update local with DB-generated id
          connection.id = data.id;
          connection.requester_id = data.sender_id;
        } catch (e) {
          console.warn('saveConnection error:', e);
        }
      }

      // Update in-memory state
      const connections = this.getConnections();
      if (!connections.some(c => c.id === connection.id)) {
        connections.push(connection);
        window.AmepleState.connections = connections;
      }
    },

    updateConnection: async function(connectionId, updates) {
      const sb = await getSupabase();

      if (sb) {
        try {
          const { error } = await sb
            .from('connections')
            .update(updates)
            .eq('id', connectionId);
          if (error) console.warn('updateConnection error:', error);
        } catch (e) {
          console.warn('updateConnection sync error:', e);
        }
      }

      // Update in-memory state
      const connections = this.getConnections();
      const idx = connections.findIndex(c => c.id === connectionId);
      if (idx >= 0) {
        Object.assign(connections[idx], updates);
        window.AmepleState.connections = connections;
      }
    },

    // --- Messages (Supabase primary, in-memory only) ---
    getMessages: function(connectionId) {
      return (window.AmepleState.messages || {})[connectionId] || [];
    },

    fetchMessages: async function(connectionId) {
      const sb = await getSupabase();
      if (!sb) return this.getMessages(connectionId);

      try {
        const { data, error } = await sb
          .from('messages')
          .select('*')
          .eq('connection_id', connectionId)
          .order('created_at', { ascending: true });

        if (error) throw error;

        const allMessages = window.AmepleState.messages || {};
        allMessages[connectionId] = data.map(msg => ({
          id: msg.id,
          connection_id: msg.connection_id,
          sender_id: msg.sender_id,
          content: msg.content,
          type: msg.type || 'text',
          call_type: msg.call_type,
          duration: msg.duration,
          is_read: msg.is_read,
          created_at: msg.created_at
        }));
        window.AmepleState.messages = allMessages;
        return allMessages[connectionId];
      } catch (e) {
        console.warn('fetchMessages error:', e);
        return this.getMessages(connectionId);
      }
    },

    saveMessage: async function(connectionId, message) {
      // Update in-memory state immediately so UI reflects send instantly
      const allMessages = window.AmepleState.messages || {};
      if (!allMessages[connectionId]) allMessages[connectionId] = [];
      allMessages[connectionId].push(message);
      window.AmepleState.messages = allMessages;

      const sb = await getSupabase();

      if (sb) {
        try {
          const { data, error } = await sb
            .from('messages')
            .insert({
              connection_id: connectionId,
              sender_id: message.sender_id,
              content: message.content,
              type: message.type || 'text',
              call_type: message.call_type || null,
              duration: message.duration || null,
              is_read: false
            })
            .select()
            .single();

          if (error) throw error;
          // Update in-memory message with DB-generated id and timestamp
          message.id = data.id;
          message.created_at = data.created_at;
          const idx = allMessages[connectionId].findIndex(m => m === message);
          if (idx >= 0) allMessages[connectionId][idx] = message;
          window.AmepleState.messages = allMessages;
        } catch (e) {
          console.warn('saveMessage error:', e);
        }
      }
    },

    // Mark messages as read
    markMessagesRead: async function(connectionId) {
      const sb = await getSupabase();
      const user = this.getCurrentUser();
      if (!sb || !user) return;

      try {
        await sb
          .from('messages')
          .update({ is_read: true })
          .eq('connection_id', connectionId)
          .neq('sender_id', user.id)
          .eq('is_read', false);
      } catch (e) {
        console.warn('markMessagesRead error:', e);
      }
    },

    // --- Status ---
    setStatus: function(status) {
      window.AmepleState.currentStatus = status;
      this.updateUser({ current_status: status });
    },

    // --- Fetch all users for globe ---
    fetchAllUsers: async function() {
      const sb = await getSupabase();
      if (!sb) return [];

      try {
        const { data, error } = await sb
          .from('users')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
      } catch (e) {
        console.warn('fetchAllUsers error:', e);
        return [];
      }
    }
  };

  // --- OAuth Callback Handler ---
  // Handles redirect back from Google/Discord login
  window.AmepleAuth.handleOAuthCallback = async function() {
    const sb = await getSupabase();
    if (!sb) return false;

    try {
      // Check if there's a session from OAuth redirect
      const { data: { session }, error } = await sb.auth.getSession();
      if (error || !session) return false;

      const authUser = session.user;
      if (!authUser) return false;

      // Check if user profile exists in our users table
      const { data: existingProfile } = await sb
        .from('users')
        .select('id')
        .eq('id', authUser.id)
        .maybeSingle();

      if (existingProfile) {
        // Existing user — fetch full profile and log them in
        const { data: profile } = await sb
          .from('users')
          .select('*')
          .eq('id', authUser.id)
          .single();

        if (profile) {
          // Update online status
          await sb.from('users')
            .update({ is_online: true, last_seen: new Date().toISOString() })
            .eq('id', authUser.id);

          profile.is_online = true;
          saveToStorage(AUTH_KEY, { userId: profile.id, email: profile.email });
          saveToStorage(PROFILE_KEY, profile);
          window.AmepleState.currentUser = profile;

          // Start Presence tracking
          setupPresenceChannel(profile.id);

          // Check if profile is complete (has country and job — set during onboarding)
          const isProfileComplete = profile.country && profile.job_name;
          return {
            status: isProfileComplete ? 'existing' : 'new',
            user: profile
          };
        }
      }

      // New OAuth user — extract info from provider metadata
      const meta = authUser.user_metadata || {};
      const providerName = authUser.app_metadata?.provider || 'oauth';

      // Extract name parts
      let firstName = meta.full_name?.split(' ')[0]
        || meta.name?.split(' ')[0]
        || meta.custom_claims?.global_name?.split(' ')[0]
        || meta.preferred_username
        || '';
      let lastName = meta.full_name?.split(' ').slice(1).join(' ')
        || meta.name?.split(' ').slice(1).join(' ')
        || '';

      const profile = {
        id: authUser.id,
        email: authUser.email || meta.email || '',
        first_name: firstName,
        last_name: lastName,
        avatar_url: meta.avatar_url || meta.picture || 'assets/default-avatar.svg',
        is_online: true,
        last_seen: new Date().toISOString(),
        current_status: '💬 Open to chat',
        average_rating: 0,
        total_ratings: 0,
        skills: [],
        hobbies: [],
        jobs: [],
        languages: [],
        social_links: {},
        favorite_games: []
      };

      // Insert the new profile
      const { error: insertError } = await sb
        .from('users')
        .upsert(profile, { onConflict: 'id' });

      if (insertError) console.warn('OAuth profile insert error:', insertError);

      saveToStorage(AUTH_KEY, { userId: profile.id, email: profile.email });
      saveToStorage(PROFILE_KEY, profile);
      window.AmepleState.currentUser = profile;

      // Start Presence tracking
      setupPresenceChannel(profile.id);

      return { status: 'new', user: profile };
    } catch (e) {
      console.error('OAuth callback error:', e);
      return false;
    }
  };

  // --- Online / Presence Management ---
  const TABS_KEY = 'ameple_active_tabs';
  let _presenceChannel = null;

  // Supabase Presence: tracks user online state via WebSocket heartbeat.
  // When a tab closes / network drops, Supabase removes the user from the
  // presence state automatically — other connected clients receive 'leave'
  // and immediately mark the user offline in the DB.
  async function setupPresenceChannel(userId) {
    const sb = await getSupabase();
    if (!sb || !userId) return;

    // Remove any stale channel (e.g. on re-login)
    if (_presenceChannel) {
      try { sb.removeChannel(_presenceChannel); } catch (e) {}
      _presenceChannel = null;
    }

    _presenceChannel = sb.channel('ameple-presence', {
      config: { presence: { key: userId } }
    });

    _presenceChannel
      .on('presence', { event: 'join' }, ({ key }) => {
        // A user connected (could be us on another tab, or someone else)
        if (key !== userId) {
          sb.from('users')
            .update({ is_online: true })
            .eq('id', key)
            .then(() => {
              window.dispatchEvent(new CustomEvent('ameple:user-online', { detail: { userId: key } }));
            });
        }
      })
      .on('presence', { event: 'leave' }, ({ key }) => {
        // A user's WebSocket disconnected (tab closed, network dropped, etc.)
        const now = new Date().toISOString();
        sb.from('users')
          .update({ is_online: false, last_seen: now })
          .eq('id', key)
          .then(() => {
            window.dispatchEvent(new CustomEvent('ameple:user-offline', {
              detail: { userId: key, last_seen: now }
            }));
          });
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await _presenceChannel.track({
            user_id: userId,
            online_at: new Date().toISOString()
          });
        }
      });

    window.AmeplePresenceChannel = _presenceChannel;
  }

  async function handleTabOpen() {
    let tabsCount = parseInt(localStorage.getItem(TABS_KEY) || '0');
    tabsCount++;
    localStorage.setItem(TABS_KEY, tabsCount.toString());

    // Try in-memory / localStorage cache first for instant access
    let user = window.AmepleAuth.getCurrentUser();

    // If still no user in cache, wait for Supabase session (OAuth / refresh cases)
    if (!user && window.AmepleAuth.isLoggedIn()) {
      try { user = await window.AmepleAuth.fetchCurrentUser(); } catch (e) { /* silent */ }
    }

    if (user) {
      user.is_online = true;
      user.last_seen = new Date().toISOString();

      const sb = await getSupabase();
      if (sb) {
        // Update DB — don't await so the page doesn't stall
        sb.from('users')
          .update({ is_online: true, last_seen: user.last_seen })
          .eq('id', user.id)
          .then(function() {})
          .catch(function() {});

        // Start Presence channel so offline is detected on tab close / network drop
        setupPresenceChannel(user.id);
      }
    }
  }

  function handleTabClose() {
    let tabsCount = parseInt(localStorage.getItem(TABS_KEY) || '0');
    tabsCount = Math.max(0, tabsCount - 1);
    localStorage.setItem(TABS_KEY, tabsCount.toString());

    if (tabsCount === 0) {
      const user = window.AmepleAuth.getCurrentUser();
      if (user) {
        user.is_online = false;
        user.last_seen = new Date().toISOString();

        // Best-effort DB update (may not complete before unload).
        // Supabase Presence will also detect the disconnect and other
        // connected clients will update the DB via the 'leave' event.
        if (window.AmepleSupabase) {
          window.AmepleSupabase
            .from('users')
            .update({ is_online: false, last_seen: user.last_seen })
            .eq('id', user.id);
        }
      }
    }
  }

  // Monitor tab lifecycle
  window.addEventListener('load', handleTabOpen);
  window.addEventListener('beforeunload', handleTabClose);

  // State starts empty — populated by fetchCurrentUser / fetchConnections on page load
  // (Supabase is the single source of truth; no localStorage fallback for data)

  // Auto-restore Supabase session on page load (handles OAuth/refresh cases)
  window.AmepleAuth.initSession = async function() {
    const sb = await getSupabase();
    if (!sb) return;

    try {
      const { data: { session } } = await sb.auth.getSession();
      if (session && !window.AmepleAuth.isLoggedIn()) {
        // We have a Supabase session but no local cache — restore it
        const result = await window.AmepleAuth.handleOAuthCallback();

        // Check if this is a new OAuth user who needs to complete their profile
        const oauthPending = localStorage.getItem('ameple_oauth_pending');
        if (oauthPending) {
          localStorage.removeItem('ameple_oauth_pending');
          if (result && result.status === 'new') {
            // Redirect to onboarding to complete profile (steps 3-13)
            window.location.href = 'index.html?complete_profile=1';
            return;
          }
        }
      }
    } catch (e) {
      console.warn('initSession error:', e);
    }

    // Listen for auth state changes (login, logout, token refresh)
    sb.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        localStorage.removeItem(AUTH_KEY);
        window.AmepleState.currentUser  = null;
        window.AmepleState.connections  = [];
        window.AmepleState.messages     = {};
        window.AmepleState.unreadCounts = {};
      }
    });
  };

  // Run session init after Supabase is ready
  if (window.AmepleSupabaseReady) {
    window.AmepleSupabaseReady.then(() => {
      window.AmepleAuth.initSession();
    });
  }
})();
