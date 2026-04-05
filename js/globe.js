// Orbiit — Globe Rendering & Interaction Logic
// Globe.gl with NASA Blue Marble texture, user dots, filters, profile panel

(function() {
  let globe;
  let notyf;
  let allUsers = [];
  let isStatusDropdownOpen = false;
  let currentPanel = null; // 'profile' or 'filters'

  const categoryColors = {
    'Tech':         '#3B82F6',
    'Creative':     '#10B981',
    'Content':      '#8B5CF6',
    'Marketing':    '#F59E0B',
    'Business & Ops': '#F97316',
    'Health':       '#EF4444',
    'Education':    '#8B5CF6',
    'Finance & Law':'#6366F1',
    'Engineering':  '#14B8A6',
    'Hospitality':  '#EC4899',
    'Supply Chain': '#78716C',
    'Transport':    '#0EA5E9',
    'Sports & Media':'#A855F7',
    'Other':        '#9CA3AF'
  };

  const predefinedStatuses = [
    '☕ Having coffee', '💻 Deep working', '🎮 Gaming', '🍳 Cooking',
    '😴 Taking a break', '📚 Studying', '🏋️ Working out',
    '🎵 Listening to music', '🚶 Out for a walk', '💬 Open to chat'
  ];

  document.addEventListener('DOMContentLoaded', function() {
    notyf = new Notyf({
      duration: 3000,
      position: { x: 'right', y: 'top' },
      types: [
        { type: 'success', background: '#10B981' },
        { type: 'error', background: '#EF4444' }
      ]
    });

    loadUsers();
    initGlobe();
    initSidebar();
    initSearch();
    initFilterToggle();
    initStatusDropdown();
    renderLegend();
    updateUserCount();
    setupSidebarAvatar();
  });

  // --- Load Users ---
  function loadUsers() {
    allUsers = [...(window.OrbiitData.sampleUsers || [])];

    // Add current user if logged in
    const currentUser = window.OrbiitAuth.getCurrentUser();
    if (currentUser && currentUser.latitude && currentUser.longitude) {
      allUsers.push(currentUser);
    }

    window.OrbiitState.users = allUsers;
    window.OrbiitState.filteredUsers = allUsers;
  }

  // --- Init Globe ---
  function initGlobe() {
    const container = document.getElementById('globe-container');
    if (!container) return;

    const area = container.parentElement;

    globe = Globe()
      .globeImageUrl('https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg')
      .bumpImageUrl('https://unpkg.com/three-globe/example/img/earth-topology.png')
      .backgroundImageUrl('https://unpkg.com/three-globe/example/img/night-sky.png')
      .showAtmosphere(true)
      .atmosphereColor('#4B9EFF')
      .atmosphereAltitude(0.15)
      .width(area.clientWidth)
      .height(area.clientHeight)
      (container);

    // User dots
    updateGlobeDots(allUsers);

    // Globe controls
    globe.controls().autoRotate = true;
    globe.controls().autoRotateSpeed = 0.3;
    globe.controls().enableDamping = true;
    globe.controls().dampingFactor = 0.1;

    // Stop auto-rotate on interaction
    container.addEventListener('mousedown', function() {
      globe.controls().autoRotate = false;
    });

    // Resume after idle
    let idleTimer;
    container.addEventListener('mouseup', function() {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(function() {
        globe.controls().autoRotate = true;
      }, 15000);
    });

    // Center on Middle East
    globe.pointOfView({ lat: 24, lng: 39, altitude: 2.5 }, 1000);

    // Resize
    window.addEventListener('resize', function() {
      globe.width(area.clientWidth).height(area.clientHeight);
    });
  }

  // --- Update Globe Dots ---
  function updateGlobeDots(users) {
    if (!globe) return;

    globe
      .pointsData(users)
      .pointLat(function(d) { return d.latitude; })
      .pointLng(function(d) { return d.longitude; })
      .pointColor(function(d) { return categoryColors[d.job_category] || '#9CA3AF'; })
      .pointAltitude(0.01)
      .pointRadius(function(d) { return d.is_online ? 0.4 : 0.25; })
      .pointLabel(function(d) {
        return '<div class="globe-tooltip">'
          + '<img src="' + d.avatar_url + '" class="tooltip-avatar" onerror="this.src=\'assets/default-avatar.svg\'">'
          + '<div class="tooltip-name">' + d.first_name + ' ' + d.last_name + '</div>'
          + '<div class="tooltip-job">' + (d.job_emoji || '') + ' ' + (d.job_name || '') + '</div>'
          + '</div>';
      })
      .onPointClick(function(user) {
        openProfilePanel(user);
      });
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

    // Parse emojis in the newly injected HTML (flags, etc.)

    // Say Hello button
    const helloBtn = body.querySelector('.btn-say-hello');
    if (helloBtn) {
      helloBtn.addEventListener('click', function() {
        openIceBreakerModal(user);
      });
    }

    // Fly to user
    globe.pointOfView({ lat: user.latitude, lng: user.longitude, altitude: 1.5 }, 1000);
  }

  function renderProfileCard(user) {
    const statusClass = user.is_online ? 'online' : 'offline';
    const statusText = user.is_online ? '● Online' : '○ Offline';

    // Helper: convert ANY emoji string to an Apple emoji <img> tag
    function emojiImg(emoji) {
      if (!emoji) return '';
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
      skillsHtml = user.skills.map(function(s) {
        return '<span class="profile-card-skill">' + s + '</span>';
      }).join('');
    }

    let hobbiesHtml = '';
    if (user.hobbies && user.hobbies.length) {
      hobbiesHtml = user.hobbies.map(function(h) {
        return '<span class="profile-card-hobby">' + emojiImg(h.charAt(0)) + h.slice(1) + '</span>';
      }).join(' · ');
    }

    let langsHtml = '';
    if (user.languages && user.languages.length) {
      langsHtml = user.languages.map(function(l) {
        return '<div class="profile-card-language">'
          + flagImg(l.flag || '') + ' ' + l.name
          + (l.native ? ' <span class="native-badge">Native</span>' : '')
          + '</div>';
      }).join('');
    }

    let socialsHtml = '';
    if (user.social_links) {
      const icons = {
        instagram: '📷', linkedin: '💼', twitter: '🐦', facebook: '👤',
        youtube: '🎬', tiktok: '🎵', discord: '💬', snapchat: '👻', whatsapp: '📱'
      };
      Object.keys(user.social_links).forEach(function(platform) {
        if (user.social_links[platform]) {
          socialsHtml += '<a href="' + user.social_links[platform] + '" target="_blank" class="social-icon" title="' + platform + '">'
            + emojiImg(icons[platform] || '🔗') + '</a>';
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
      + '<div class="profile-card-job-meta">' + (user.job_type || '') + ' · ' + (user.job_category || '') + '</div>'
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
    if (window.OrbiitEmoji) window.OrbiitEmoji.parse(body);

    initFilterListeners();
  }

  function renderFilterPanel() {
    const categories = Object.keys(categoryColors);
    let catCheckboxes = categories.map(function(cat) {
      const checked = !window.OrbiitState.activeFilters.categories
        || window.OrbiitState.activeFilters.categories.includes(cat);
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
      + '<button class="btn btn-primary w-full" id="btn-apply-filters">Apply Filters</button>'
      + '<span class="filter-clear" id="btn-clear-filters">Clear All</span>'
      + '</div>';
  }

  function initFilterListeners() {
    // Online pills
    document.querySelectorAll('.filter-online-pill').forEach(function(pill) {
      pill.addEventListener('click', function() {
        document.querySelectorAll('.filter-online-pill').forEach(function(p) { p.classList.remove('selected'); });
        this.classList.add('selected');
      });
    });

    // Gender pills
    document.querySelectorAll('.filter-gender-pill').forEach(function(pill) {
      pill.addEventListener('click', function() {
        document.querySelectorAll('.filter-gender-pill').forEach(function(p) { p.classList.remove('selected'); });
        this.classList.add('selected');
      });
    });

    // Age range
    const ageMin = document.getElementById('filter-age-min');
    const ageMax = document.getElementById('filter-age-max');
    if (ageMin) ageMin.addEventListener('input', function() {
      document.getElementById('age-min-label').textContent = this.value;
    });
    if (ageMax) ageMax.addEventListener('input', function() {
      document.getElementById('age-max-label').textContent = this.value == 65 ? '65+' : this.value;
    });

    // Apply
    const applyBtn = document.getElementById('btn-apply-filters');
    if (applyBtn) applyBtn.addEventListener('click', applyFilters);

    // Clear
    const clearBtn = document.getElementById('btn-clear-filters');
    if (clearBtn) clearBtn.addEventListener('click', function() {
      window.OrbiitState.activeFilters = {};
      updateGlobeDots(allUsers);
      window.OrbiitState.filteredUsers = allUsers;
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
    filters.categories = Array.from(catCheckboxes).map(function(cb) { return cb.dataset.cat; });

    // Age
    const ageMin = document.getElementById('filter-age-min');
    const ageMax = document.getElementById('filter-age-max');
    if (ageMin) filters.ageMin = parseInt(ageMin.value);
    if (ageMax) filters.ageMax = parseInt(ageMax.value);

    // Gender
    const genderPill = document.querySelector('.filter-gender-pill.selected');
    if (genderPill) filters.gender = genderPill.dataset.val;

    window.OrbiitState.activeFilters = filters;

    // Apply
    let filtered = allUsers.filter(function(u) {
      if (filters.online === 'online' && !u.is_online) return false;
      if (filters.categories && filters.categories.length && !filters.categories.includes(u.job_category)) return false;
      if (filters.ageMin && u.age < filters.ageMin) return false;
      if (filters.ageMax && filters.ageMax < 65 && u.age > filters.ageMax) return false;
      if (filters.gender && filters.gender !== 'all' && u.gender !== filters.gender) return false;
      return true;
    });

    window.OrbiitState.filteredUsers = filtered;
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

    searchInput.addEventListener('input', function() {
      const query = this.value.toLowerCase().trim();
      if (!query) {
        updateGlobeDots(window.OrbiitState.filteredUsers || allUsers);
        updateUserCount();
        return;
      }

      const results = (window.OrbiitState.filteredUsers || allUsers).filter(function(u) {
        return (u.first_name + ' ' + u.last_name).toLowerCase().includes(query)
          || (u.job_name || '').toLowerCase().includes(query)
          || (u.country || '').toLowerCase().includes(query)
          || (u.skills || []).some(function(s) { return s.toLowerCase().includes(query); });
      });

      updateGlobeDots(results);
      updateUserCount(results.length);

      // Fly to first result
      if (results.length === 1) {
        globe.pointOfView({ lat: results[0].latitude, lng: results[0].longitude, altitude: 1.5 }, 1000);
      }
    });
  }

  // --- Filter Toggle ---
  function initFilterToggle() {
    const btn = document.querySelector('.filter-toggle');
    if (!btn) return;

    btn.addEventListener('click', function() {
      if (currentPanel === 'filters') {
        closePanel();
      } else {
        openFilterPanel();
        this.classList.add('active');
      }
    });
  }

  // --- Close button ---
  document.addEventListener('click', function(e) {
    if (e.target.classList.contains('right-panel-close') || e.target.closest('.right-panel-close')) {
      closePanel();
    }
  });

  // --- Sidebar ---
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
    const user = window.OrbiitAuth.getCurrentUser();
    if (avatar && user && user.avatar_url) {
      avatar.src = user.avatar_url;
    }
  }

  // --- Status Dropdown ---
  function initStatusDropdown() {
    const trigger = document.getElementById('sidebar-status');
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

    const current = window.OrbiitState.currentStatus;

    container.innerHTML = predefinedStatuses.map(function(status) {
      const isCurrent = status === current;
      return '<div class="status-option' + (isCurrent ? ' current' : '') + '" data-status="' + status + '">'
        + status + '</div>';
    }).join('');

    // Parse emojis in status options
    if (window.OrbiitEmoji) window.OrbiitEmoji.parse(container);

    container.querySelectorAll('.status-option').forEach(function(opt) {
      opt.addEventListener('click', function() {
        const status = this.dataset.status;
        window.OrbiitAuth.setStatus(status);
        notyf.success('Status updated: ' + status);
        isStatusDropdownOpen = false;
        document.getElementById('status-dropdown').classList.remove('open');
      });
    });

    // Custom status save
    const saveBtn = document.getElementById('btn-save-custom-status');
    if (saveBtn) {
      saveBtn.onclick = function() {
        const input = document.getElementById('custom-status-input');
        if (input && input.value.trim()) {
          window.OrbiitAuth.setStatus(input.value.trim().substring(0, 50));
          notyf.success('Custom status set!');
          isStatusDropdownOpen = false;
          document.getElementById('status-dropdown').classList.remove('open');
        }
      };
    }
  }

  // --- Legend ---
  function renderLegend() {
    const legend = document.getElementById('globe-legend');
    if (!legend) return;

    const mainCategories = ['Tech', 'Creative', 'Marketing', 'Health', 'Engineering', 'Finance & Law', 'Education'];
    legend.innerHTML = mainCategories.map(function(cat) {
      return '<div class="legend-item">'
        + '<span class="legend-dot" style="background:' + categoryColors[cat] + '"></span>'
        + cat + '</div>';
    }).join('');
  }

  // --- User Count ---
  function updateUserCount(count) {
    const el = document.getElementById('user-count');
    if (!el) return;
    const num = count !== undefined ? count : (window.OrbiitState.filteredUsers || allUsers).length;
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
      textarea.addEventListener('input', function() {
        if (counter) counter.textContent = this.value.length + '/300';
      });
    }

    if (sendBtn) {
      sendBtn.onclick = function() {
        const msg = textarea ? textarea.value.trim() : '';
        if (!msg) { notyf.error('Please write a message'); return; }

        // Save connection request
        const connection = {
          id: 'conn-' + Date.now(),
          requester_id: (window.OrbiitState.currentUser || {}).id || 'local',
          receiver_id: user.id,
          receiver: user,
          status: 'pending',
          message: msg,
          created_at: new Date().toISOString()
        };
        window.OrbiitAuth.saveConnection(connection);

        overlay.classList.remove('active');
        notyf.success('Message sent to ' + user.first_name + '! 👋');
        closePanel();
      };
    }

    // Close modal
    const closeBtn = overlay.querySelector('.modal-close');
    if (closeBtn) {
      closeBtn.onclick = function() { overlay.classList.remove('active'); };
    }
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) overlay.classList.remove('active');
    });
  }
})();
