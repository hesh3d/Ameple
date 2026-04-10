// Ameple — Profile Page Logic

(function() {
  let notyf;
  let currentPickType = ''; // 'skills', 'hobbies', 'languages', 'jobs'
  let selectedItems = [];

  document.addEventListener('DOMContentLoaded', async function() {
    notyf = new Notyf({
      duration: 3000,
      position: { x: 'right', y: 'top' }
    });

    let user = window.AmepleAuth.getCurrentUser();
    if (!user) {
      window.location.href = 'index.html';
      return;
    }

    // Render from cache first
    setupSidebarAvatar(user);
    renderProfile(user);
    initSelectionModal();

    // Then refresh from Supabase
    try {
      const freshUser = await window.AmepleAuth.fetchCurrentUser();
      if (freshUser) {
        user = freshUser;
        // Initialize jobs if it's a string from old version
        if (typeof user.jobs === 'string' || (!user.jobs && user.job_name)) {
          user.jobs = user.job_name ? [user.job_name] : [];
          window.AmepleAuth.updateUser({ jobs: user.jobs });
        } else if (!user.jobs) {
          user.jobs = [];
        }
        setupSidebarAvatar(user);
        renderProfile(user);
      }
    } catch (e) {
      console.warn('Failed to refresh profile from Supabase:', e);
    }

    // Initialize jobs if it's a string from old version (for cached user)
    if (typeof user.jobs === 'string' || (!user.jobs && user.job_name)) {
      user.jobs = user.job_name ? [user.job_name] : [];
      window.AmepleAuth.updateUser({ jobs: user.jobs });
    } else if (!user.jobs) {
      user.jobs = [];
    }
  });

  function setupSidebarAvatar(user) {
    const avatar = document.getElementById('sidebar-user-avatar');
    if (avatar && user.avatar_url) avatar.src = user.avatar_url;
  }

  function renderProfile(user) {
    const container = document.getElementById('profile-container');

    const renderItem = (text, type, index) => {
      let emoji = '';
      if (type === 'jobs' && window.AmepleData.jobs) {
        const item = window.AmepleData.jobs.find(j => j.title === text);
        if (item) emoji = item.emoji + ' ';
      } else if (type === 'skills' && window.AmepleData.skills) {
        const item = window.AmepleData.skills.find(s => s.name === text);
        if (item) emoji = item.emoji + ' ';
      } else if (type === 'hobbies' && window.AmepleData.hobbies) {
        const item = window.AmepleData.hobbies.find(h => h.name === text);
        if (item) emoji = item.emoji + ' ';
      }
      
      return `<span class="profile-card-skill profile-hobby-item">
        ${emoji}${text}
        <div class="remove-btn" data-type="${type}" data-index="${index}">&times;</div>
      </span>`;
    };

    let skillsHtml = (user.skills || []).map((s, i) => renderItem(s, 'skills', i)).join('');
    let hobbiesHtml = (user.hobbies || []).map((h, i) => renderItem(h, 'hobbies', i)).join('');
    let jobsHtml = (user.jobs || []).map((j, i) => renderItem(j, 'jobs', i)).join('');
    
    let langsHtml = (user.languages || []).map((l, i) => {
      return `<div class="profile-language-item">
        ${l.flag || ''} ${l.name}
        ${l.native ? '<span class="native-badge" style="font-size:10px;padding:2px 6px;border-radius:999px;background:var(--accent-light);color:var(--accent);font-weight:600;">Native</span>' : ''}
        <div class="remove-btn" data-type="languages" data-index="${i}">&times;</div>
      </div>`;
    }).join('');

    let socialsHtml = '';
    if (user.social_links) {
      const icons = { instagram: '📷', linkedin: '💼', twitter: '🐦', youtube: '🎬', tiktok: '🎵', facebook: '👤', discord: '💬', snapchat: '👻', whatsapp: '📱' };
      Object.keys(user.social_links).forEach(function(platform) {
        if (user.social_links[platform]) {
          socialsHtml += '<a href="' + user.social_links[platform] + '" target="_blank" class="profile-social-link">'
            + (icons[platform] || '🔗') + ' ' + platform.charAt(0).toUpperCase() + platform.slice(1) + '</a>';
        }
      });
    }

    // Determine header job (primary job)
    const primaryJob = user.jobs && user.jobs.length > 0 ? user.jobs[0] : '';
    let primaryJobEmoji = '';
    if (primaryJob && window.AmepleData.jobs) {
      const jd = window.AmepleData.jobs.find(j => j.title === primaryJob);
      if (jd) primaryJobEmoji = jd.emoji;
    }

    container.innerHTML = `
      <div class="profile-header">
        <div class="profile-avatar-wrap">
          <img src="${user.avatar_url || 'assets/default-avatar.svg'}" class="profile-header-avatar" id="profile-main-avatar" alt="Avatar" title="Click to change photo">
          <div class="avatar-edit-badge"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg></div>
        </div>
        <div class="profile-header-info">
          <h1 class="profile-header-name">${user.first_name || ''} ${user.last_name || ''} ${user.flag || ''}</h1>
          <div class="profile-header-job">
            ${primaryJobEmoji} ${primaryJob || 'Explore Roles below'}
          </div>
          <div class="profile-header-meta">
            <span>📍 ${user.country || 'Unknown'}</span>
            <span>🎂 ${user.age || '?'} years old</span>
            <span>⭐ ${(user.average_rating || 0).toFixed(1)} (${user.total_ratings || 0} ratings)</span>
          </div>
        </div>
        <div class="profile-header-actions">
          <button class="btn btn-secondary" id="btn-edit-profile">✏️ Edit Profile</button>
        </div>
      </div>

      <div class="profile-section">
        <div class="profile-section-title">
          <span>💼 Current Roles / Work</span>
          <button class="section-add-btn" data-type="jobs">+</button>
        </div>
        <div class="profile-skills-grid">${jobsHtml || '<p style="font-size:13px;color:var(--text-3);width:100%;">No roles added yet.</p>'}</div>
      </div>

      <div class="profile-section">
        <div class="profile-section-title">
          <span>🎯 Skills</span>
          <button class="section-add-btn" data-type="skills">+</button>
        </div>
        <div class="profile-skills-grid">${skillsHtml || '<p style="font-size:13px;color:var(--text-3);width:100%;">No skills added yet.</p>'}</div>
      </div>

      <div class="profile-section">
        <div class="profile-section-title">
          <span>🎨 Hobbies</span>
          <button class="section-add-btn" data-type="hobbies">+</button>
        </div>
        <div class="profile-hobbies-grid">${hobbiesHtml || '<p style="font-size:13px;color:var(--text-3);width:100%;">No hobbies added yet.</p>'}</div>
      </div>

      <div class="profile-section">
        <div class="profile-section-title">
          <span>🗣️ Languages</span>
          <button class="section-add-btn" data-type="languages">+</button>
        </div>
        <div class="profile-languages-list">${langsHtml || '<p style="font-size:13px;color:var(--text-3);width:100%;">No languages added yet.</p>'}</div>
      </div>

      ${socialsHtml ? `<div class="profile-section"><div class="profile-section-title">📱 Social Links</div><div class="profile-social-grid">${socialsHtml}</div></div>` : ''}

      <div class="profile-section">
        <div class="profile-section-title">
          <span>📊 Status</span>
          <button class="section-add-btn" data-type="status">+</button>
        </div>
        <div class="profile-status-wrap" style="display:flex; flex-direction:column; gap:8px;">
          <div style="font-size:15px; font-weight:700;">${user.current_status || '💬 Open to chat'}</div>
        </div>
      </div>`;

    attachProfileEvents(container);
  }

  function attachProfileEvents(container) {
    // Edit Profile Modal
    const editModal = document.getElementById('edit-profile-modal');
    const closeBtn = document.getElementById('btn-close-edit');
    const cancelBtn = document.getElementById('btn-cancel-edit');
    const saveBtn = document.getElementById('btn-save-profile');

    const openEditModal = () => {
      const user = window.AmepleAuth.getCurrentUser();
      document.getElementById('edit-first-name').value = user.first_name || '';
      document.getElementById('edit-last-name').value = user.last_name || '';
      document.getElementById('edit-job-title').value = user.job_name || (user.jobs && user.jobs[0] ? user.jobs[0] : '');
      document.getElementById('edit-status').value = user.current_status || '';
      editModal.classList.add('active');
    };

    const closeEditModal = () => editModal.classList.remove('active');

    // Avatar upload
    const avatarInput = document.getElementById('avatar-upload-input');
    
    container.addEventListener('click', function(e) {
      if (e.target.closest('.profile-avatar-wrap')) {
        avatarInput.click();
      } else if (e.target.id === 'btn-edit-profile') {
        openEditModal();
      } else if (e.target.closest('.section-add-btn')) {
        const type = e.target.closest('.section-add-btn').dataset.type;
        openSelectionModal(type);
      } else if (e.target.closest('.remove-btn')) {
        const btn = e.target.closest('.remove-btn');
        removeItem(btn.dataset.type, parseInt(btn.dataset.index));
      }
    });

    avatarInput.onchange = function(e) {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) { notyf.error('Image too large (max 2MB)'); return; }
      const reader = new FileReader();
      reader.onload = function(event) {
        const dataUrl = event.target.result;
        window.AmepleAuth.updateUser({ avatar_url: dataUrl });
        const mainAvatar = document.getElementById('profile-main-avatar');
        if (mainAvatar) mainAvatar.src = dataUrl;
        setupSidebarAvatar(window.AmepleAuth.getCurrentUser());
        notyf.success('Profile picture updated!');
      };
      reader.readAsDataURL(file);
    };

    if (closeBtn) closeBtn.onclick = closeEditModal;
    if (cancelBtn) cancelBtn.onclick = closeEditModal;
    if (saveBtn) {
      saveBtn.onclick = function() {
        const updates = {
          first_name: document.getElementById('edit-first-name').value.trim(),
          last_name: document.getElementById('edit-last-name').value.trim(),
          current_status: document.getElementById('edit-status').value.trim()
        };
        if (!updates.first_name || !updates.last_name) { notyf.error('Please enter your full name'); return; }
        window.AmepleAuth.updateUser(updates);
        notyf.success('Profile updated successfully!');
        closeEditModal();
        renderProfile(window.AmepleAuth.getCurrentUser());
        setupSidebarAvatar(window.AmepleAuth.getCurrentUser());
      };
    }

    if (window.AmepleEmoji) window.AmepleEmoji.parse(container);
  }

  function removeItem(type, index) {
    const user = window.AmepleAuth.getCurrentUser();
    if (!user[type]) return;
    
    const removedItem = user[type].splice(index, 1);
    
    // If we removed the primary job, update the header summary too
    let updates = { [type]: user[type] };
    if (type === 'jobs') {
      updates.job_name = user.jobs[0] || '';
      const jd = window.AmepleData.jobs.find(j => j.title === updates.job_name);
      updates.job_emoji = jd ? jd.emoji : '';
    }

    window.AmepleAuth.updateUser(updates);
    renderProfile(user);
    notyf.success('Item removed');
  }

  function initSelectionModal() {
    const modal = document.getElementById('selection-modal');
    const closeBtn = document.getElementById('btn-close-selection');
    const saveBtn = document.getElementById('btn-save-selection');
    const searchInput = document.getElementById('selection-search');
    const grid = document.getElementById('selection-grid');

    closeBtn.onclick = () => modal.classList.remove('active');
    
    saveBtn.onclick = () => {
      if (!selectedItems.length) { modal.classList.remove('active'); return; }
      const user = window.AmepleAuth.getCurrentUser();
      const currentItems = user[currentPickType] || [];
      
      // Merge unique
      let updated;
      if (currentPickType === 'languages') {
        const currentNames = currentItems.map(l => l.name);
        const newItems = selectedItems.filter(l => !currentNames.includes(l.name));
        updated = [...currentItems, ...newItems];
      } else {
        const newItems = selectedItems.filter(s => !currentItems.includes(s));
        updated = [...currentItems, ...newItems];
      }

      let userUpdates = { [currentPickType]: updated };
      
      // Special handling for single-item types
      if (currentPickType === 'status') {
        const status = selectedItems[0];
        window.AmepleAuth.setStatus(status);
        if (window.AmepleSidebar) window.AmepleSidebar.updateStatusDisplay();
        notyf.success('Status updated!');
        modal.classList.remove('active');
        renderProfile(window.AmepleAuth.getCurrentUser());
        return;
      }
      
      // Special handling for jobs: first one becomes header primary job
      if (currentPickType === 'jobs' && updated.length > 0) {
        userUpdates.job_name = updated[0];
        const jd = window.AmepleData.jobs.find(j => j.title === updated[0]);
        if (jd) {
          userUpdates.job_emoji = jd.emoji;
          userUpdates.job_category = jd.category;
        }
      }

      window.AmepleAuth.updateUser(userUpdates);
      notyf.success('Items added!');
      modal.classList.remove('active');
      renderProfile(window.AmepleAuth.getCurrentUser());
    };

    searchInput.oninput = () => renderSelectionGrid();

    grid.onclick = (e) => {
      const itemEl = e.target.closest('.picker-item');
      if (!itemEl) return;
      
      const val = itemEl.dataset.value;
      const index = selectedItems.findIndex(i => (typeof i === 'string' ? i === val : i.name === val));
      
      if (index >= 0) {
        selectedItems.splice(index, 1);
        itemEl.classList.remove('selected');
      } else {
        if (currentPickType === 'languages') {
          const rawItem = window.AmepleData.languages.find(l => l.name === val);
          selectedItems.push({ ...rawItem, native: false });
        } else if (currentPickType === 'status') {
          selectedItems = [val];
          grid.querySelectorAll('.picker-item').forEach(i => i.classList.remove('selected'));
        } else {
          selectedItems.push(val);
        }
        itemEl.classList.add('selected');
      }
    };
  }

  function openSelectionModal(type) {
    currentPickType = type;
    selectedItems = [];
    document.getElementById('selection-modal-title').textContent = 'Add ' + type.charAt(0).toUpperCase() + type.slice(1);
    document.getElementById('selection-search').value = '';
    document.getElementById('selection-modal').classList.add('active');
    renderSelectionGrid();
  }

  function renderSelectionGrid() {
    const grid = document.getElementById('selection-grid');
    const query = document.getElementById('selection-search').value.toLowerCase();
    const user = window.AmepleAuth.getCurrentUser();
    const existing = user[currentPickType] || [];
    const existingNames = currentPickType === 'languages' ? existing.map(l => l.name) : existing;

    let items = [];
    if (currentPickType === 'skills') items = window.AmepleData.skills;
    if (currentPickType === 'hobbies') items = window.AmepleData.hobbies;
    if (currentPickType === 'languages') items = window.AmepleData.languages;
    if (currentPickType === 'jobs') items = window.AmepleData.jobs;
    if (currentPickType === 'status') {
      items = [
        '☕ Having coffee', '💻 Deep working', '🎮 Gaming', '🍳 Cooking',
        '😴 Taking a break', '📚 Studying', '🏋️ Working out',
        '🎵 Listening to music', '🚶 Out for a walk', '💬 Open to chat'
      ];
    }

    const filtered = items.filter(item => {
      const name = typeof item === 'string' ? item : (item.name || item.title);
      return name.toLowerCase().includes(query) && !existingNames.includes(name);
    });

    if (query || currentPickType === 'languages') {
      grid.innerHTML = filtered.map(item => renderPickerItem(item)).join('');
      grid.style.display = 'grid';
    } else {
      const grouped = {};
      filtered.forEach(item => {
        const cat = item.category || 'Other';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(item);
      });

      grid.innerHTML = Object.keys(grouped).map(cat => {
        return `<div class="picker-group">
          <div class="picker-group-title">${cat}</div>
          <div class="picker-group-items">
            ${grouped[cat].map(item => renderPickerItem(item)).join('')}
          </div>
        </div>`;
      }).join('');
      grid.style.display = 'block';
    }
  }

  function renderPickerItem(item) {
    const name = typeof item === 'string' ? item : (item.name || item.title);
    const emoji = item.emoji || item.flag || '';
    const isSelected = selectedItems.some(i => {
      const iName = typeof i === 'string' ? i : (i.name || i.title);
      return iName === name;
    });

    return `<div class="picker-item ${isSelected ? 'selected' : ''}" data-value="${name}">
      <span>${emoji}</span>
      <span>${name}</span>
    </div>`;
  }

})();
