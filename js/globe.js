// Ameple — Globe Rendering & Interaction Logic
// Globe.gl with NASA Blue Marble texture, user dots, filters, profile panel

(function () {
  let map;
  let markers = [];
  let notyf;
  let allUsers = [];
  let isStatusDropdownOpen = false;
  let currentPanel = null; // 'profile' or 'filters'

  const categoryColors = {
    'Tech': '#3B82F6',
    'Creative': '#10B981',
    'Content': '#8B5CF6',
    'Marketing': '#F59E0B',
    'Business & Ops': '#F97316',
    'Health': '#EF4444',
    'Education': '#8B5CF6',
    'Finance & Law': '#6366F1',
    'Engineering': '#14B8A6',
    'Hospitality': '#EC4899',
    'Supply Chain': '#78716C',
    'Transport': '#0EA5E9',
    'Sports & Media': '#A855F7',
    'Other': '#9CA3AF'
  };

  const predefinedStatuses = [
    '☕ Having coffee', '💻 Deep working', '🎮 Gaming', '🍳 Cooking',
    '😴 Taking a break', '📚 Studying', '🏋️ Working out',
    '🎵 Listening to music', '🚶 Out for a walk', '💬 Open to chat'
  ];

  document.addEventListener('DOMContentLoaded', function () {
    notyf = new Notyf({
      duration: 3000,
      position: { x: 'right', y: 'top' },
      types: [
        { type: 'success', background: '#10B981' },
        { type: 'error', background: '#EF4444' }
      ]
    });

    initGlobe();
    initSearch();
    initFilterToggle();
    renderLegend();

    // Load users from Supabase then update globe
    loadUsers();
  });

  async function loadUsers() {
    // Ensure current user is in memory (handles direct page load / refresh)
    if (!window.AmepleAuth.getCurrentUser() && window.AmepleAuth.isLoggedIn()) {
      try {
        await window.AmepleAuth.fetchCurrentUser();
      } catch (e) { /* silent */ }
    }

    allUsers = [];
    window.AmepleState.users = allUsers;
    window.AmepleState.filteredUsers = allUsers;
    updateUserCount();

    // Fetch real users from Supabase
    try {
      const dbUsers = await window.AmepleAuth.fetchAllUsers();
      if (dbUsers && dbUsers.length > 0) {
        // Only show users who have completed their profile (have location set)
        allUsers = dbUsers.filter(u => u.latitude != null && u.longitude != null && (u.latitude !== 0 || u.longitude !== 0));
      }
    } catch (e) {
      console.warn('Failed to fetch users from DB:', e);
    }

    // Add current user if not already in the list
    const currentUser = window.AmepleAuth.getCurrentUser();
    if (currentUser && currentUser.latitude != null && currentUser.longitude != null && (currentUser.latitude !== 0 || currentUser.longitude !== 0)) {
      const exists = allUsers.some(u => u.id === currentUser.id);
      if (!exists) allUsers.unshift(currentUser);
    }

    window.AmepleState.users = allUsers;
    window.AmepleState.filteredUsers = allUsers;
    updateUserCount();
    updateGlobeAvatars(allUsers);

    // Focus on a specific user if ?userId= param is present
    const focusId = new URLSearchParams(window.location.search).get('userId');
    if (focusId) {
      const target = allUsers.find(u => u.id === focusId);
      if (target && target.latitude != null && target.longitude != null) {
        setTimeout(function() {
          map.flyTo({ center: [target.longitude, target.latitude], zoom: 5, essential: true });
          // Open their profile panel after the fly animation starts
          setTimeout(function() { openProfilePanel(target); }, 800);
        }, 300);
      }
    }

    // Start real-time subscriptions after initial load
    setupGlobeRealtime();
  }

  // --- Real-time Globe Updates ---
  let globeRealtimeChannel = null;

  async function setupGlobeRealtime() {
    const sb = window.AmepleSupabase || await window.AmepleSupabaseReady;
    if (!sb) return;

    if (globeRealtimeChannel) {
      try { sb.removeChannel(globeRealtimeChannel); } catch (e) {}
      globeRealtimeChannel = null;
    }

    globeRealtimeChannel = sb
      .channel('globe-realtime')

      // ── New user joined the platform ──────────────────────────────────────
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'users'
      }, (payload) => {
        const newUser = payload.new;
        // Only add if they have valid coordinates
        if (newUser.latitude == null || newUser.longitude == null ||
            (newUser.latitude === 0 && newUser.longitude === 0)) return;
        // Avoid duplicates
        if (allUsers.some(u => u.id === newUser.id)) return;

        allUsers.push(newUser);
        window.AmepleState.users = allUsers;
        applyCurrentFilters();
      })

      // ── User updated their profile (name, avatar, job, online status) ─────
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'users'
      }, (payload) => {
        const updated = payload.new;
        const idx = allUsers.findIndex(u => u.id === updated.id);
        if (idx >= 0) {
          Object.assign(allUsers[idx], updated);
        } else if (updated.latitude != null && updated.longitude != null &&
                   (updated.latitude !== 0 || updated.longitude !== 0)) {
          // User now has coordinates — add them
          allUsers.push(updated);
        }
        window.AmepleState.users = allUsers;
        applyCurrentFilters();
      })

      .subscribe();

    // ── Presence events from auth.js (instant online/offline) ────────────
    window.addEventListener('ameple:user-online', function(e) {
      const userId = e.detail.userId;
      const user = allUsers.find(u => u.id === userId);
      if (user) {
        user.is_online = true;
        applyCurrentFilters();
      }
    });

    window.addEventListener('ameple:user-offline', function(e) {
      const userId = e.detail.userId;
      const user = allUsers.find(u => u.id === userId);
      if (user) {
        user.is_online = false;
        if (e.detail.last_seen) user.last_seen = e.detail.last_seen;
        applyCurrentFilters();
      }
    });
  }

  // Re-render globe with the currently active filters
  function applyCurrentFilters() {
    const filtered = window.AmepleState.filteredUsers;
    // If there are active filters, keep them; otherwise show all
    if (window.AmepleState.activeFilters && Object.keys(window.AmepleState.activeFilters).length > 0) {
      // Re-apply existing filter logic (keep filtered list in sync with allUsers)
      const ids = new Set(allUsers.map(u => u.id));
      const stillValid = filtered.filter(u => ids.has(u.id));
      // Add any new users that might match (simple: re-filter)
      window.AmepleState.filteredUsers = allUsers; // fallback: show all
    } else {
      window.AmepleState.filteredUsers = allUsers;
    }
    updateUserCount();
    updateGlobeAvatars(window.AmepleState.filteredUsers);
  }

  // --- Init Globe ---
  function initGlobe() {
    const container = document.getElementById('globe-container');
    if (!container) return;

    // Container background is handled in CSS for space-like theme

    // Support for RTL (Arabic, Hebrew) text shaping
    if (maplibregl.getRTLTextPluginStatus() === 'unavailable') {
      maplibregl.setRTLTextPlugin(
        'https://unpkg.com/@mapbox/mapbox-gl-rtl-text@0.2.3/mapbox-gl-rtl-text.min.js',
        null,
        true // Lazy-load
      );
    }

    map = new maplibregl.Map({
      container: 'globe-container',
      attributionControl: false, 
      zoom: 1.6, 
      minZoom: 1.2,
      center: [40, 22],
      pitch: 38, 
      style: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
      projection: {
        type: 'globe' 
      }
    });

    // Set atmosphere for the globe
    map.on('style.load', () => {
      map.setProjection({ type: 'globe' }); // Ensure globe projection is active

      map.setFog({
        'color': 'rgba(10, 12, 24, 0.4)', // Dark space-like fog
        'high-color': 'rgba(30, 58, 138, 0.6)', // Blueish atmosphere
        'horizon-blend': 0.1,
        'space-color': 'rgba(0,0,0,0)', // Transparent space to show CSS background
        'star-intensity': 0.15 // Subtle stars
      });
    });

    map.on('load', function () {
      // Add markers once map is loaded
      updateGlobeAvatars(allUsers);

      // Add Palestine label overlay (CartoDB tiles show "Israel" by default)
      map.addSource('palestine-label-src', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [35.2, 31.9] }, // West Bank
              properties: { name: 'Palestine' }
            },
            {
              type: 'Feature',
              geometry: { type: 'Point', coordinates: [34.47, 31.50] }, // Gaza Strip
              properties: { name: 'Gaza Strip' }
            }
          ]
        }
      });

      map.addLayer({
        id: 'palestine-label',
        type: 'symbol',
        source: 'palestine-label-src',
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 2, 9, 6, 13],
          'text-letter-spacing': 0.1,
          'text-transform': 'uppercase'
        },
        paint: {
          'text-color': '#444',
          'text-halo-color': '#fff',
          'text-halo-width': 1.5
        }
      });
    });

    // Resize
    window.addEventListener('resize', function () {
      map.resize();
    });

    // Completely remove annoying transparent fading for 3D globe occlusion
    map.on('render', function () {
      if (typeof markers === 'undefined' || !markers) return;
      markers.forEach(function (m) {
        const el = m.getElement();
        const op = el.style.opacity;
        // MapLibre natively sets opacity < 1 when markers drop behind the globe horizon
        if (op !== '' && parseFloat(op) < 0.95) {
          el.style.visibility = 'hidden';
        } else {
          el.style.visibility = 'visible';
        }
      });
    });
  }


  // --- Update Globe Avatar Markers (replaces Dots) ---
  function updateGlobeAvatars(users) {
    if (!map) return;
    console.log('[Ameple] Rendering', users.length, 'avatar markers on map');

    // Clear old markers
    markers.forEach(function (m) { m.remove(); });
    markers = [];

    users.forEach(function (d) {
      let el = document.createElement('div');

      el.className = 'ameple-avatar-marker' + (d.is_online ? ' online' : '');

      // Avatar image
      const img = document.createElement('img');
      img.src = d.avatar_url || 'assets/default-avatar.svg';
      img.alt = d.first_name || '';
      img.width = 32;
      img.height = 32;
      // Using .style properties or just classes; update internal styles for cartoon theme
      img.style.cssText = 'width:32px;height:32px;border-radius:10px;object-fit:cover;border:2px solid #1A1A2E;display:block;box-shadow:3px 3px 0px #1A1A2E;';
      img.onerror = function () { this.src = 'assets/default-avatar.svg'; };
      el.appendChild(img);

      // Online dot
      if (d.is_online) {
        const dot = document.createElement('span');
        dot.style.cssText = 'position:absolute;bottom:-1px;right:-1px;width:12px;height:12px;background:#22C55E;border-radius:50%;border:1.5px solid #1A1A2E;z-index:2;';
        el.appendChild(dot);
      }

      // Tooltip
      const lastSeenText = d.is_online ? 'Online' : window.AmepleAuth.formatTimeAgo(d.last_seen);
      const tip = document.createElement('div');
      tip.className = 'avatar-tooltip';
      tip.innerHTML = '<strong>' + (d.first_name || '') + ' ' + (d.last_name || '') + '</strong>'
          + '<span>' + (d.job_name || '') + '</span>'
          + '<span style="font-size:10px; opacity:0.8; margin-top:2px;">' + lastSeenText + '</span>';
      el.appendChild(tip);

      el.addEventListener('click', function (e) { e.stopPropagation(); openProfilePanel(d); });

      const m = new maplibregl.Marker({ element: el })
        .setLngLat([d.longitude, d.latitude])
        .addTo(map);
      markers.push(m);
    });
  }



  // Keep updateGlobeDots as an alias for backward compat with filters/search
  function updateGlobeDots(users) {
    updateGlobeAvatars(users);
  }



  // --- Profile Panel ---
  function openProfilePanel(user) {
    closePanel();
    currentPanel = 'profile';

    const panel = document.getElementById('right-panel');
    const body = document.getElementById('right-panel-body');
    const title = document.getElementById('right-panel-title');

    title.textContent = 'Profile';

    body.innerHTML = renderProfileCard(user);
    panel.classList.add('open');

    const currentUser = window.AmepleAuth.getCurrentUser() || {};
    const helloBtn = body.querySelector('.btn-say-hello');

    // Don't allow connecting with yourself
    if (currentUser.id && user.id === currentUser.id) {
      if (helloBtn) helloBtn.style.display = 'none';
    } else if (helloBtn) {
      // Check existing connection status and adapt button
      const connections = window.AmepleAuth.getConnections();
      const existingConn = connections.find(function(c) {
        return (c.requester_id === currentUser.id && c.receiver_id === user.id) ||
               (c.requester_id === user.id && c.receiver_id === currentUser.id);
      });

      if (existingConn && existingConn.status === 'accepted') {
        helloBtn.textContent = '💬 Open Chat';
        helloBtn.addEventListener('click', function() {
          window.location.href = 'chat.html';
        });
      } else if (existingConn && existingConn.status === 'pending' && existingConn.requester_id === currentUser.id) {
        helloBtn.textContent = '⏳ Request Pending';
        helloBtn.disabled = true;
      } else if (existingConn && existingConn.status === 'pending' && existingConn.receiver_id === currentUser.id) {
        helloBtn.textContent = '✅ Accept Request';
        helloBtn.addEventListener('click', async function() {
          await window.AmepleAuth.updateConnection(existingConn.id, { status: 'accepted' });
          notyf.success('You are now connected with ' + user.first_name + '! 🤝');
          closePanel();
        });
      } else {
        helloBtn.addEventListener('click', function() {
          openIceBreakerModal(user);
        });
      }

      // ── Async Supabase check to refresh button if cache is stale ─────────
      const sbPanel = window.AmepleSupabase;
      if (sbPanel && currentUser.id && user.id) {
        sbPanel.from('connections')
          .select('*')
          .in('sender_id', [currentUser.id, user.id])
          .in('receiver_id', [currentUser.id, user.id])
          .then(function(res) {
            const dbConns = res.data;
            if (!dbConns || !dbConns.length) return;
            const dbConn = dbConns[0];
            const localStatus = existingConn ? existingConn.status : null;
            if (dbConn.status === localStatus) return; // already in sync

            // Panel might be closed by now
            if (!document.body.contains(helloBtn)) return;

            // Remove old listeners by cloning
            const freshBtn = helloBtn.cloneNode(true);
            helloBtn.parentNode.replaceChild(freshBtn, helloBtn);

            freshBtn.disabled = false;
            if (dbConn.status === 'accepted') {
              freshBtn.textContent = '💬 Open Chat';
              freshBtn.addEventListener('click', function() { window.location.href = 'chat.html'; });
            } else if (dbConn.status === 'pending' && dbConn.sender_id === currentUser.id) {
              freshBtn.textContent = '⏳ Request Pending';
              freshBtn.disabled = true;
            } else if (dbConn.status === 'pending' && dbConn.sender_id === user.id) {
              freshBtn.textContent = '✅ Accept Request';
              freshBtn.addEventListener('click', async function() {
                await window.AmepleAuth.updateConnection(dbConn.id, { status: 'accepted' });
                notyf.success('You are now connected with ' + user.first_name + '! 🤝');
                closePanel();
              });
            }
          });
      }
    }

    // Fly to user
    map.flyTo({ center: [user.longitude, user.latitude], zoom: 5, essential: true });
  }

  function renderProfileCard(user) {
    const statusClass = user.is_online ? 'online' : 'offline';
    const lastSeenText = window.AmepleAuth.formatTimeAgo(user.last_seen);
    const statusText = user.is_online ? '● Online' : '🕒 ' + lastSeenText;

    // Helper: convert ANY emoji string to an Apple emoji <img> tag
    function emojiImg(emoji) {
      if (!emoji) return '';
      if (window.AmepleEmoji && window.AmepleEmoji.toImg) {
        return window.AmepleEmoji.toImg(emoji);
      }
      return emoji;
    }

    // Helper: flag emoji → Apple emoji img
    function flagImg(flagEmoji) {
      if (!flagEmoji) return '';
      return emojiImg(flagEmoji);
    }

    let skillsHtml = '';
    if (user.skills && user.skills.length) {
      skillsHtml = user.skills.map(function (s) {
        return '<span class="profile-card-skill">' + s + '</span>';
      }).join('');
    }

    let hobbiesHtml = '';
    if (user.hobbies && user.hobbies.length) {
      hobbiesHtml = user.hobbies.map(function (h) {
        return '<span class="profile-card-hobby">' + emojiImg(h.charAt(0)) + h.slice(1) + '</span>';
      }).join(' · ');
    }

    let langsHtml = '';
    if (user.languages && user.languages.length) {
      langsHtml = user.languages.map(function (l) {
        return '<div class="profile-card-language">'
          + flagImg(l.flag || '') + ' ' + l.name
          + (l.native ? ' <span class="native-badge">Native</span>' : '')
          + '</div>';
      }).join('');
    }

    let socialsHtml = '';
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

    if (user.social_links) {
      Object.keys(user.social_links).forEach(function (platform) {
        if (user.social_links[platform]) {
          socialsHtml += '<a href="' + user.social_links[platform] + '" target="_blank" class="social-icon" title="' + platform + '">'
            + (SOCIAL_SVGS[platform] || emojiImg('🔗')) + '</a>';
        }
      });
    }

    // Rating stars as SVG emojis
    const starCount = Math.round(user.average_rating || 0);
    const starsHtml = Array(starCount).fill(emojiImg('⭐')).join('');

    return '<div class="profile-card-content">'
      + '<img src="' + user.avatar_url + '" class="profile-card-avatar" onerror="this.src=\'assets/default-avatar.svg\'">'

      // Name + country flag (flagImg converts 🇯🇴 → colored SVG, not "JO" text)
      + '<div class="profile-card-name">'
      + user.first_name + ' ' + user.last_name + ' '
      + flagImg(user.flag || '')
      + '</div>'
      + '<div class="profile-card-status ' + statusClass + '">' + statusText + '</div>'

      + '<div class="profile-card-section">'
      + '<div class="profile-card-section-label">' + emojiImg('💼') + ' Work</div>'
      + '<div class="profile-card-job">' + emojiImg(user.job_emoji || '') + ' ' + (user.job_name || '') + '</div>'
      + '<div class="profile-card-job-meta">' + (user.job_category || '') + '</div>'
      + '</div>'

      + '<div class="profile-card-section">'
      + '<div class="profile-card-section-label">' + emojiImg('👤') + ' About</div>'
      + '<div class="profile-card-info">Age: ' + (user.age || '?') + ' · ' + (user.gender || '') + '</div>'
      + '</div>'

      + (skillsHtml ? '<div class="profile-card-section">'
        + '<div class="profile-card-section-label">' + emojiImg('🎯') + ' Skills</div>'
        + '<div class="profile-card-skills">' + skillsHtml + '</div>'
        + '</div>' : '')

      + (hobbiesHtml ? '<div class="profile-card-section">'
        + '<div class="profile-card-section-label">' + emojiImg('🎨') + ' Hobbies</div>'
        + '<div class="profile-card-hobbies">' + hobbiesHtml + '</div>'
        + '</div>' : '')

      + (langsHtml ? '<div class="profile-card-section">'
        + '<div class="profile-card-section-label">' + emojiImg('🗣️') + ' Languages</div>'
        + '<div class="profile-card-languages">' + langsHtml + '</div>'
        + '</div>' : '')

      + '<div class="profile-card-section">'
      + '<div class="profile-card-section-label">' + emojiImg('⭐') + ' Rating</div>'
      + '<div class="profile-card-rating">'
      + '<span class="rating-stars">' + starsHtml + '</span>'
      + '<span>' + (user.average_rating || 0).toFixed(1) + '</span>'
      + '<span class="rating-count">· ' + (user.total_ratings || 0) + ' ratings</span>'
      + '</div></div>'

      + (socialsHtml ? '<div class="profile-card-section">'
        + '<div class="profile-card-section-label">' + emojiImg('📱') + ' Social</div>'
        + '<div class="profile-card-socials">' + socialsHtml + '</div>'
        + '</div>' : '')

      + '<div class="profile-card-hello">'
      + '<button class="btn btn-primary w-full btn-say-hello">' + emojiImg('👋') + ' Say Hello</button>'
      + '</div></div>';
  }


  // --- Filter Panel ---
  function openFilterPanel() {
    closePanel();
    currentPanel = 'filters';

    const panel = document.getElementById('right-panel');
    const body = document.getElementById('right-panel-body');
    const title = document.getElementById('right-panel-title');

    title.textContent = 'Filters';
    body.innerHTML = renderFilterPanel();
    panel.classList.add('open');

    // Parse emojis in filter panel
    if (window.AmepleEmoji) window.AmepleEmoji.parse(body);

    initFilterListeners();
  }

  function renderFilterPanel() {
    const categories = Object.keys(categoryColors);
    let catCheckboxes = categories.map(function (cat) {
      const checked = !window.AmepleState.activeFilters.categories
        || window.AmepleState.activeFilters.categories.includes(cat);
      return '<label class="filter-checkbox">'
        + '<input type="checkbox" data-cat="' + cat + '"' + (checked ? ' checked' : '') + '>'
        + '<span class="legend-dot" style="background:' + categoryColors[cat] + '"></span>'
        + cat + '</label>';
    }).join('');

    return '<div class="filter-section">'
      + '<div class="filter-section-title">🟢 Online Status</div>'
      + '<div class="pill-group">'
      + '<button class="pill filter-online-pill selected" data-val="all">All</button>'
      + '<button class="pill filter-online-pill" data-val="online">Online Only</button>'
      + '</div></div>'

      + '<div class="filter-section">'
      + '<div class="filter-section-title">💼 Work Category</div>'
      + '<div class="filter-checkboxes">' + catCheckboxes + '</div>'
      + '</div>'

      + '<div class="filter-section">'
      + '<div class="filter-section-title">🎂 Age Range</div>'
      + '<div class="filter-range">'
      + '<input type="range" id="filter-age-min" min="16" max="65" value="16">'
      + '<input type="range" id="filter-age-max" min="16" max="65" value="65">'
      + '<div class="filter-range-labels"><span id="age-min-label">16</span><span id="age-max-label">65+</span></div>'
      + '</div></div>'

      + '<div class="filter-section">'
      + '<div class="filter-section-title">👤 Gender</div>'
      + '<div class="pill-group">'
      + '<button class="pill filter-gender-pill selected" data-val="all">All</button>'
      + '<button class="pill filter-gender-pill" data-val="Male">Male</button>'
      + '<button class="pill filter-gender-pill" data-val="Female">Female</button>'
      + '</div></div>'

      + '<div class="filter-actions">'
      + '<button class="btn btn-primary w-full btn-apply-filters" id="btn-apply-filters">Apply Filters</button>'
      + '<span class="filter-clear" id="btn-clear-filters">Clear All</span>'
      + '</div>';
  }

  function initFilterListeners() {
    // Online pills
    document.querySelectorAll('.filter-online-pill').forEach(function (pill) {
      pill.addEventListener('click', function () {
        document.querySelectorAll('.filter-online-pill').forEach(function (p) { p.classList.remove('selected'); });
        this.classList.add('selected');
      });
    });

    // Gender pills
    document.querySelectorAll('.filter-gender-pill').forEach(function (pill) {
      pill.addEventListener('click', function () {
        document.querySelectorAll('.filter-gender-pill').forEach(function (p) { p.classList.remove('selected'); });
        this.classList.add('selected');
      });
    });

    // Age range
    const ageMin = document.getElementById('filter-age-min');
    const ageMax = document.getElementById('filter-age-max');
    if (ageMin) ageMin.addEventListener('input', function () {
      document.getElementById('age-min-label').textContent = this.value;
    });
    if (ageMax) ageMax.addEventListener('input', function () {
      document.getElementById('age-max-label').textContent = this.value == 65 ? '65+' : this.value;
    });

    // Apply
    const applyBtn = document.getElementById('btn-apply-filters');
    if (applyBtn) applyBtn.addEventListener('click', applyFilters);

    // Clear
    const clearBtn = document.getElementById('btn-clear-filters');
    if (clearBtn) clearBtn.addEventListener('click', function () {
      window.AmepleState.activeFilters = {};
      updateGlobeDots(allUsers);
      window.AmepleState.filteredUsers = allUsers;
      updateUserCount();
      closePanel();
      notyf.success('Filters cleared');
    });
  }

  function applyFilters() {
    const filters = {};

    // Online
    const onlinePill = document.querySelector('.filter-online-pill.selected');
    if (onlinePill) filters.online = onlinePill.dataset.val;

    // Categories
    const catCheckboxes = document.querySelectorAll('.filter-checkbox input:checked');
    filters.categories = Array.from(catCheckboxes).map(function (cb) { return cb.dataset.cat; });

    // Age
    const ageMin = document.getElementById('filter-age-min');
    const ageMax = document.getElementById('filter-age-max');
    if (ageMin) filters.ageMin = parseInt(ageMin.value);
    if (ageMax) filters.ageMax = parseInt(ageMax.value);

    // Gender
    const genderPill = document.querySelector('.filter-gender-pill.selected');
    if (genderPill) filters.gender = genderPill.dataset.val;

    window.AmepleState.activeFilters = filters;

    // Apply
    let filtered = allUsers.filter(function (u) {
      if (filters.online === 'online' && !u.is_online) return false;
      if (filters.categories && filters.categories.length && !filters.categories.includes(u.job_category)) return false;
      if (filters.ageMin && u.age < filters.ageMin) return false;
      if (filters.ageMax && filters.ageMax < 65 && u.age > filters.ageMax) return false;
      if (filters.gender && filters.gender !== 'all' && u.gender !== filters.gender) return false;
      return true;
    });

    window.AmepleState.filteredUsers = filtered;
    updateGlobeDots(filtered);
    updateUserCount();
    notyf.success(filtered.length + ' users found');
  }

  // --- Close Panel ---
  function closePanel() {
    const panel = document.getElementById('right-panel');
    if (panel) panel.classList.remove('open');
    currentPanel = null;

    const filterBtn = document.querySelector('.filter-toggle');
    if (filterBtn) filterBtn.classList.remove('active');
  }

  // --- Search ---
  function initSearch() {
    const searchInput = document.getElementById('globe-search-input');
    if (!searchInput) return;

    searchInput.addEventListener('input', function () {
      const query = this.value.toLowerCase().trim();
      if (!query) {
        updateGlobeDots(window.AmepleState.filteredUsers || allUsers);
        updateUserCount();
        return;
      }

      const results = (window.AmepleState.filteredUsers || allUsers).filter(function (u) {
        return (u.first_name + ' ' + u.last_name).toLowerCase().includes(query)
          || (u.job_name || '').toLowerCase().includes(query)
          || (u.country || '').toLowerCase().includes(query)
          || (u.skills || []).some(function (s) { return s.toLowerCase().includes(query); });
      });

      updateGlobeDots(results);
      updateUserCount(results.length);

      // Fly to first result
      if (results.length === 1) {
        map.flyTo({ center: [results[0].longitude, results[0].latitude], zoom: 5, essential: true });
      }
    });
  }

  // --- Filter Toggle ---
  function initFilterToggle() {
    const btn = document.querySelector('.filter-toggle');
    if (!btn) return;

    btn.addEventListener('click', function () {
      if (currentPanel === 'filters') {
        closePanel();
      } else {
        openFilterPanel();
        this.classList.add('active');
      }
    });
  }

  // --- Close button ---
  document.addEventListener('click', function (e) {
    if (e.target.classList.contains('right-panel-close') || e.target.closest('.right-panel-close')) {
      closePanel();
    }
  });

  // Sidebar and Status dropdown logic moved to shared js/sidebar.js

  // --- Legend ---
  function renderLegend() {
    const legend = document.getElementById('globe-legend');
    if (!legend) return;

    const mainCategories = ['Tech', 'Creative', 'Marketing', 'Health', 'Engineering', 'Finance & Law', 'Education'];
    legend.innerHTML = mainCategories.map(function (cat) {
      return '<div class="legend-item">'
        + '<span class="legend-dot" style="background:' + categoryColors[cat] + '"></span>'
        + cat + '</div>';
    }).join('');
  }

  // --- User Count ---
  function updateUserCount(count) {
    const el = document.getElementById('user-count');
    if (!el) return;
    const num = count !== undefined ? count : (window.AmepleState.filteredUsers || allUsers).length;
    el.innerHTML = '<span class="count-num">' + num + '</span> people on the globe';
  }

  // --- Ice Breaker Modal ---
  function openIceBreakerModal(user) {
    const overlay = document.getElementById('icebreaker-modal');
    if (!overlay) return;

    const nameEl = overlay.querySelector('.modal-user-name');
    if (nameEl) nameEl.textContent = user.first_name + ' ' + user.last_name;

    overlay.classList.add('active');

    const textarea = overlay.querySelector('.icebreaker-textarea');
    const counter = overlay.querySelector('.icebreaker-counter');
    const sendBtn = overlay.querySelector('.btn-send-icebreaker');

    if (textarea) {
      textarea.value = '';
      textarea.focus();
      textarea.addEventListener('input', function () {
        if (counter) {
          counter.textContent = this.value.length + '/500';
          if (this.value.length > 500) counter.style.color = '#EF4444';
          else counter.style.color = '#999';
        }
      });

      // Handle chips
      const chips = overlay.querySelectorAll('.icebreaker-chip');
      chips.forEach(chip => {
        chip.onclick = function () {
          textarea.value = this.dataset.msg;
          textarea.focus();
          if (counter) {
            counter.textContent = textarea.value.length + '/500';
            if (textarea.value.length > 500) counter.style.color = '#EF4444';
            else counter.style.color = '#999';
          }
        };
      });
    }

    if (sendBtn) {
      sendBtn.onclick = async function () {
        const msg = textarea ? textarea.value.trim() : '';
        if (!msg) { notyf.error('Please write a message'); return; }
        if (msg.length > 500) { notyf.error('Your message is too long'); return; }

        const currentUser = window.AmepleState.currentUser || {};

        // Prevent self-connection
        if (user.id && currentUser.id && user.id === currentUser.id) {
          notyf.error("You can't connect with yourself!");
          return;
        }

        // Check for existing connection — first from cache, then verify with Supabase
        let connections = window.AmepleAuth.getConnections();
        let existingConn = connections.find(function(c) {
          return (c.requester_id === currentUser.id && c.receiver_id === user.id) ||
                 (c.requester_id === user.id && c.receiver_id === currentUser.id);
        });

        // Fresh check from Supabase to avoid stale-cache duplicates
        const sbCheck = window.AmepleSupabase;
        if (sbCheck && currentUser.id && user.id) {
          try {
            const { data: dbConns } = await sbCheck
              .from('connections')
              .select('*')
              .in('sender_id', [currentUser.id, user.id])
              .in('receiver_id', [currentUser.id, user.id]);

            if (dbConns && dbConns.length > 0) {
              const dbConn = dbConns[0];
              // Merge into cache if missing
              if (!existingConn) {
                const receiverId = dbConn.sender_id === currentUser.id ? dbConn.receiver_id : dbConn.sender_id;
                existingConn = {
                  id: dbConn.id,
                  requester_id: dbConn.sender_id,
                  receiver_id: dbConn.receiver_id,
                  receiver: user,
                  status: dbConn.status
                };
              } else {
                existingConn.status = dbConn.status;
                existingConn.id = dbConn.id;
                existingConn.requester_id = dbConn.sender_id;
                existingConn.receiver_id = dbConn.receiver_id;
              }
            }
          } catch (e) { /* fall through with cache */ }
        }

        if (existingConn) {
          if (existingConn.status === 'accepted') {
            // ── Send directly into the existing conversation ──────────────
            sendBtn.disabled = true;
            sendBtn.textContent = 'Sending...';
            try {
              await window.AmepleAuth.saveMessage(existingConn.id, {
                id: 'msg-' + Date.now(),
                connection_id: existingConn.id,
                sender_id: currentUser.id,
                content: msg,
                type: 'text',
                is_read: false,
                created_at: new Date().toISOString()
              });
              overlay.classList.remove('active');
              notyf.success('Message sent to ' + user.first_name + '! 💬');
              closePanel();
            } catch (e) {
              notyf.error('Failed to send. Please try again.');
              sendBtn.disabled = false;
              sendBtn.textContent = 'Send';
            }
            return;
          }
          if (existingConn.status === 'pending' && existingConn.requester_id === currentUser.id) {
            notyf.error('You already sent a request to ' + user.first_name + '!');
            overlay.classList.remove('active');
            return;
          }
          if (existingConn.status === 'pending' && existingConn.receiver_id === currentUser.id) {
            // They already sent us a request — auto-accept
            await window.AmepleAuth.updateConnection(existingConn.id, { status: 'accepted' });
            overlay.classList.remove('active');
            notyf.success('You are now connected with ' + user.first_name + '! 🤝');
            closePanel();
            return;
          }
        }

        sendBtn.disabled = true;
        sendBtn.textContent = 'Sending...';

        // Save connection request to Supabase
        const connection = {
          id: 'conn-' + Date.now(),
          requester_id: currentUser.id || 'local',
          receiver_id: user.id,
          receiver: user,
          status: 'pending',
          message: msg,
          created_at: new Date().toISOString()
        };
        await window.AmepleAuth.saveConnection(connection);

        overlay.classList.remove('active');
        notyf.success('Message sent to ' + user.first_name + '! 👋');
        closePanel();
        sendBtn.disabled = false;
        sendBtn.textContent = 'Send';
      };
    }

    // Close modal
    const closeBtn = overlay.querySelector('.modal-close');
    if (closeBtn) {
      closeBtn.onclick = function () { overlay.classList.remove('active'); };
    }
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) overlay.classList.remove('active');
    });
  }
})();
