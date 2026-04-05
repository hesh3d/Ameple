// Orbiit — Profile Page Logic

(function() {
  let notyf;

  document.addEventListener('DOMContentLoaded', function() {
    notyf = new Notyf({
      duration: 3000,
      position: { x: 'right', y: 'top' }
    });

    const user = window.OrbiitAuth.getCurrentUser();
    if (!user) {
      window.location.href = 'index.html';
      return;
    }

    setupSidebarAvatar(user);
    renderProfile(user);
  });

  function setupSidebarAvatar(user) {
    const avatar = document.getElementById('sidebar-user-avatar');
    if (avatar && user.avatar_url) avatar.src = user.avatar_url;
  }

  function renderProfile(user) {
    const container = document.getElementById('profile-container');

    let skillsHtml = '';
    if (user.skills && user.skills.length) {
      skillsHtml = user.skills.map(function(s) {
        return '<span class="profile-card-skill">' + s + '</span>';
      }).join('');
    }

    let hobbiesHtml = '';
    if (user.hobbies && user.hobbies.length) {
      hobbiesHtml = user.hobbies.map(function(h) {
        return '<span class="profile-hobby-item">' + h + '</span>';
      }).join('');
    }

    let langsHtml = '';
    if (user.languages && user.languages.length) {
      langsHtml = user.languages.map(function(l) {
        return '<div class="profile-language-item">'
          + (l.flag || '') + ' ' + l.name
          + (l.native ? ' <span class="native-badge" style="font-size:10px;padding:2px 6px;border-radius:999px;background:var(--accent-light);color:var(--accent);font-weight:600;">Native</span>' : '')
          + '</div>';
      }).join('');
    }

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

    container.innerHTML = ''
      + '<div class="profile-header">'
      + '<img src="' + (user.avatar_url || 'assets/default-avatar.svg') + '" class="profile-header-avatar" alt="Avatar">'
      + '<div class="profile-header-info">'
      + '<h1 class="profile-header-name">' + (user.first_name || '') + ' ' + (user.last_name || '') + ' ' + (user.flag || '') + '</h1>'
      + '<div class="profile-header-job">' + (user.job_emoji || '') + ' ' + (user.job_name || 'Not specified') + '</div>'
      + '<div class="profile-header-meta">'
      + '<span>📍 ' + (user.country || 'Unknown') + '</span>'
      + '<span>🎂 ' + (user.age || '?') + ' years old</span>'
      + '<span>⭐ ' + (user.average_rating || 0).toFixed(1) + ' (' + (user.total_ratings || 0) + ' ratings)</span>'
      + '</div></div>'
      + '<div class="profile-header-actions">'
      + '<button class="btn btn-secondary" id="btn-edit-profile">✏️ Edit Profile</button>'
      + '</div></div>'

      + (skillsHtml ? '<div class="profile-section"><div class="profile-section-title">🎯 Skills</div>'
        + '<div class="profile-skills-grid">' + skillsHtml + '</div></div>' : '')

      + (hobbiesHtml ? '<div class="profile-section"><div class="profile-section-title">🎨 Hobbies</div>'
        + '<div class="profile-hobbies-grid">' + hobbiesHtml + '</div></div>' : '')

      + (langsHtml ? '<div class="profile-section"><div class="profile-section-title">🗣️ Languages</div>'
        + '<div class="profile-languages-list">' + langsHtml + '</div></div>' : '')

      + (socialsHtml ? '<div class="profile-section"><div class="profile-section-title">📱 Social Links</div>'
        + '<div class="profile-social-grid">' + socialsHtml + '</div></div>' : '')

      + '<div class="profile-section"><div class="profile-section-title">📊 Status</div>'
      + '<div style="font-size:15px;">' + (user.current_status || '💬 Open to chat') + '</div></div>';

    // Edit button
    const editBtn = document.getElementById('btn-edit-profile');
    if (editBtn) {
      editBtn.addEventListener('click', function() {
        notyf.success('Edit mode coming in Phase 2!');
      });
    }

    // Parse emojis in dynamically injected profile HTML
    if (window.OrbiitEmoji) window.OrbiitEmoji.parse(container);
  }
})();
