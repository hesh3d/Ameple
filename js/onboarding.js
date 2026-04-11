// Ameple — Onboarding Wizard Logic
// 12-step wizard with validation, transitions, and data collection

(function() {
  const TOTAL_STEPS = 13;
  let currentStep = 1;
  let isTransitioning = false;
  let formData = {};
  let notyf;
  let isOAuthCompleteProfile = false; // True when OAuth user is completing profile

  // --- Initialize ---
  document.addEventListener('DOMContentLoaded', async function() {
    // Load saved data
    formData = window.AmepleAuth.loadOnboardingData();

    const urlParams = new URLSearchParams(window.location.search);
    isOAuthCompleteProfile = urlParams.has('complete_profile');

    // If NOT completing OAuth profile, check if already logged in
    if (!isOAuthCompleteProfile) {
      if (window.AmepleAuth.isLoggedIn()) {
        window.location.href = 'globe.html';
        return;
      }

      // Check Supabase session (in case of OAuth return)
      if (window.AmepleSupabaseReady) {
        try {
          await window.AmepleSupabaseReady;
          const hasSession = await window.AmepleAuth.checkSession();
          if (hasSession) {
            window.location.href = 'globe.html?oauth_callback=1';
            return;
          }
        } catch (e) {}
      }
    }

    // OAuth profile completion mode: pre-fill data and skip to step 3
    if (isOAuthCompleteProfile) {
      if (window.AmepleSupabaseReady) await window.AmepleSupabaseReady;

      const oauthUser = window.AmepleAuth.getCurrentUser();
      if (oauthUser) {
        formData.first_name = oauthUser.first_name || '';
        formData.last_name = oauthUser.last_name || '';
        formData.email = oauthUser.email || '';
        formData.avatar_url = (oauthUser.avatar_url && oauthUser.avatar_url !== 'assets/default-avatar.svg')
          ? oauthUser.avatar_url : '';
      }
      window.AmepleAuth.saveOnboardingData(formData);

      // Jump directly to step 3 (Name) — hide steps 1 & 2
      currentStep = 3;
      for (let i = 1; i < 3; i++) {
        const el = document.getElementById('step-' + i);
        if (el) el.classList.remove('active');
      }
    }

    // Init Notyf in a clearer Top-Center position with cartoonish theme
    notyf = new Notyf({
      duration: 2000,
      position: { x: 'center', y: 'top' },
      dismissible: true,
      types: [
        { 
          type: 'success', 
          background: '#FFFFFF', 
          icon: { className: 'notyf__icon--success', tagName: 'i', text: '✅' } 
        },
        { 
          type: 'error', 
          background: '#FFFFFF', 
          icon: { className: 'notyf__icon--error', tagName: 'i', text: '🛑' } 
        }
      ]
    });

    initStep(currentStep);
    updateProgressBar();
    updateNavButtons();
    setupNavigation();
    initAllSteps();
  });

  // --- Navigation ---
  function setupNavigation() {
    document.getElementById('btn-next').addEventListener('click', nextStep);
    document.getElementById('btn-back').addEventListener('click', prevStep);
  }

  function nextStep() {
    if (isTransitioning) return;
    if (!validateStep(currentStep)) return;
    if (notyf) notyf.dismissAll(); // Clear any persistent errors on success
    
    isTransitioning = true;
    collectStepData(currentStep);
    window.AmepleAuth.saveOnboardingData(formData);

    if (currentStep === TOTAL_STEPS) {
      completeOnboarding();
      // Keep isTransitioning true to prevent overlapping clicks during redirect
      return;
    }

    const oldStep = document.getElementById('step-' + currentStep);
    oldStep.classList.add('exit');

    setTimeout(function() {
      oldStep.classList.remove('active', 'exit');
      currentStep++;
      initStep(currentStep);
      updateProgressBar();
      updateNavButtons();
      isTransitioning = false; // Release lock
    }, 250);
  }

  // Export globally for inline onclick handlers (e.g. Skip link)
  window.nextStep = nextStep;

  function prevStep() {
    if (isTransitioning) return;
    const minStep = isOAuthCompleteProfile ? 3 : 1;
    if (currentStep <= minStep) return;
    
    isTransitioning = true;
    collectStepData(currentStep);

    const oldStep = document.getElementById('step-' + currentStep);
    oldStep.classList.remove('active');
    currentStep--;
    initStep(currentStep);
    updateProgressBar();
    updateNavButtons();
    
    setTimeout(function() {
      isTransitioning = false;
    }, 150); // slight debounce
  }

  function initStep(step) {
    const el = document.getElementById('step-' + step);
    el.classList.add('active');
    el.style.animation = 'none';
    el.offsetHeight; // reflow
    el.style.animation = '';

    // Step-specific init
    if (step === 4) initTripleDatePicker();
    if (step === 5) {
      initCitySelect();      // City FIRST so citySelect exists
      initCountrySelect();   // Country second — its restore logic calls fetchCities
    }
    if (step === 7) initJobSelect();
    if (step === 8) initSkillsGrid();
    if (step === 9) initHobbiesGrid();
    if (step === 10) initGamesGrid();
    if (step === 11) initLanguageSelects();
    if (step === 13) initCompletionStep();
  }

  function updateProgressBar() {
    const fill = document.getElementById('progress-fill');
    fill.style.width = ((currentStep / TOTAL_STEPS) * 100) + '%';
  }

  function updateNavButtons() {
    const backBtn = document.getElementById('btn-back');
    const nextBtn = document.getElementById('btn-next');

    // In OAuth mode, hide back on step 3 (first step); otherwise hide on step 1
    const hideBackOn = isOAuthCompleteProfile ? 3 : 1;
    backBtn.classList.toggle('hidden', currentStep <= hideBackOn);

    if (!isOAuthCompleteProfile && (currentStep === 1 || currentStep === 2)) {
      nextBtn.style.display = 'none'; // Welcome and Auth use their own buttons
    } else if (currentStep === TOTAL_STEPS) {
      nextBtn.style.display = '';
      nextBtn.textContent = 'Enter the World 🌍';
    } else {
      nextBtn.style.display = '';
      nextBtn.textContent = 'Continue →';
    }
  }

  // --- Initialize All Step Content ---
  function initAllSteps() {
    // Restore saved data into form fields
    if (formData.first_name) {
      const fn = document.getElementById('input-firstname');
      if (fn) fn.value = formData.first_name;
    }
    if (formData.last_name) {
      const ln = document.getElementById('input-lastname');
      if (ln) ln.value = formData.last_name;
    }
    if (formData.email) {
      const em = document.getElementById('input-email');
      if (em) em.value = formData.email;
    }

    // Gender pills
    document.querySelectorAll('.gender-pill').forEach(function(pill) {
      pill.addEventListener('click', function() {
        document.querySelectorAll('.gender-pill').forEach(function(p) { p.classList.remove('selected'); });
        this.classList.add('selected');
        formData.gender = this.dataset.value;
      });
      if (formData.gender && pill.dataset.value === formData.gender) {
        pill.classList.add('selected');
      }
    });

    // Welcome "Get Started" button
    const getStartedBtn = document.getElementById('btn-get-started');
    if (getStartedBtn) {
      getStartedBtn.addEventListener('click', function() {
        nextStep();
      });
    }

    // Password toggle SVGs
    const EYE_ON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>';
    const EYE_OFF = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>';

    document.querySelectorAll('.password-toggle').forEach(function(toggle) {
      toggle.addEventListener('click', function() {
        const input = this.previousElementSibling;
        if (input.type === 'password') {
          input.type = 'text';
          this.innerHTML = EYE_OFF;
        } else {
          input.type = 'password';
          this.innerHTML = EYE_ON;
        }
      });
    });

    // --- Auth Step (Step 2) Logic ---
    const authTabs = document.getElementById('auth-tabs');
    const authSubmitBtn = document.getElementById('btn-auth-submit');
    let authMode = 'signup';

    if (authTabs) {
      authTabs.querySelectorAll('.auth-tab').forEach(tab => {
        tab.addEventListener('click', function() {
          authTabs.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
          this.classList.add('active');
          authMode = this.dataset.mode;
          
          const forgotBtn = document.getElementById('btn-forgot-password');
          if (authMode === 'signup') {
            authTabs.classList.remove('login-active');
            authSubmitBtn.textContent = 'Create Account →';
            if(forgotBtn) forgotBtn.classList.add('hidden');
          } else {
            authTabs.classList.add('login-active');
            authSubmitBtn.textContent = 'Login →';
            if(forgotBtn) forgotBtn.classList.remove('hidden');
          }
        });
      });
    }

    if (authSubmitBtn) {
      authSubmitBtn.addEventListener('click', async function() {
        const email = document.getElementById('auth-email').value;
        const pass = document.getElementById('auth-password').value;

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          showError('Please enter a valid email', 'auth-email');
          return;
        }
        if (pass.length < 6) {
          showError('Password must be at least 6 characters', 'auth-password');
          return;
        }

        if (authMode === 'login') {
          // Real Supabase login
          authSubmitBtn.disabled = true;
          authSubmitBtn.textContent = 'Logging in...';

          // Wait for Supabase
          if (window.AmepleSupabaseReady) await window.AmepleSupabaseReady;

          const { user: loginUser, error: loginError } = await window.AmepleAuth.signIn(email, pass);
          if (loginError) {
            notyf.error(loginError.message || 'Login failed');
            authSubmitBtn.disabled = false;
            authSubmitBtn.textContent = 'Login →';
            return;
          }
          notyf.success('Welcome back! ⚡');
          setTimeout(() => {
            window.location.href = 'globe.html';
          }, 800);
        } else {
          formData.email = email;
          formData.password = pass;
          notyf.success('Account created! Let\'s setup your profile.');
          nextStep();
        }
      });
    }

    // Real OAuth: Google & Discord via Supabase
    ['btn-google-auth', 'btn-discord-auth'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.addEventListener('click', async function() {
          const provider = id.includes('google') ? 'google' : 'discord';
          btn.disabled = true;
          btn.style.opacity = '0.6';

          // Wait for Supabase to be ready
          if (window.AmepleSupabaseReady) await window.AmepleSupabaseReady;
          const sb = window.AmepleSupabase;

          if (!sb) {
            notyf.error('Connection error. Please try again.');
            btn.disabled = false;
            btn.style.opacity = '1';
            return;
          }

          try {
            // Set flag BEFORE redirect so we can detect OAuth return
            localStorage.setItem('ameple_oauth_pending', '1');

            const { data, error } = await sb.auth.signInWithOAuth({
              provider: provider,
              options: {
                redirectTo: window.location.origin + window.location.pathname.replace(/[^/]*$/, '') + 'globe.html'
              }
            });

            if (error) throw error;
            // Browser will redirect to provider's login page
          } catch (e) {
            console.error('OAuth error:', e);
            notyf.error(e.message || 'Authentication failed');
            btn.disabled = false;
            btn.style.opacity = '1';
          }
        });
      }
    });

    // Forgot Password Modal
    const forgotLink = document.getElementById('btn-forgot-password');
    const modal = document.getElementById('modal-forgot-password');
    if (forgotLink && modal) {
      forgotLink.onclick = () => modal.classList.add('active');
      modal.querySelector('.modal-close').onclick = () => modal.classList.remove('active');
      modal.onclick = (e) => { if(e.target === modal) modal.classList.remove('active'); };
      
      const recoveryBtn = document.getElementById('btn-send-recovery');
      if (recoveryBtn) {
        recoveryBtn.onclick = () => {
          const email = document.getElementById('forgot-email').value;
          if (!email) { showError('Please enter your email', 'forgot-email'); return; }
          notyf.success('Recovery link sent to ' + email);
          modal.classList.remove('active');
        };
      }
    }

    // Pre-fill photo from OAuth avatar if available
    if (isOAuthCompleteProfile && formData.avatar_url && formData.avatar_url !== 'assets/default-avatar.svg') {
      const preview = document.getElementById('upload-preview');
      const zone = document.getElementById('upload-zone');
      if (preview && zone) {
        preview.src = formData.avatar_url;
        preview.style.display = 'block';
        zone.classList.add('has-image');
      }
    }

    // Photo upload
    const uploadZone = document.getElementById('upload-zone');
    const uploadInput = document.getElementById('upload-input');
    if (uploadZone && uploadInput) {
      uploadZone.addEventListener('click', function() { uploadInput.click(); });
      uploadZone.addEventListener('dragover', function(e) {
        e.preventDefault();
        this.style.borderColor = 'var(--accent)';
        this.style.background = 'var(--accent-light)';
      });
      uploadZone.addEventListener('dragleave', function() {
        this.style.borderColor = '';
        this.style.background = '';
      });
      uploadZone.addEventListener('drop', function(e) {
        e.preventDefault();
        this.style.borderColor = '';
        this.style.background = '';
        if (e.dataTransfer.files.length) handlePhotoUpload(e.dataTransfer.files[0]);
      });
      uploadInput.addEventListener('change', function() {
        if (this.files.length) handlePhotoUpload(this.files[0]);
      });
    }

    // Geolocation button
    const locBtn = document.getElementById('btn-geolocation');
    if (locBtn) {
      locBtn.addEventListener('click', function() {
        if (!navigator.geolocation) {
          notyf.error('Geolocation not supported by your browser');
          return;
        }
        this.textContent = '📍 Detecting...';
        this.disabled = true;

        navigator.geolocation.getCurrentPosition(
          function(pos) {
            // Add ±2km random offset for privacy
            const offset = (Math.random() - 0.5) * 0.04;
            formData.latitude = pos.coords.latitude + offset;
            formData.longitude = pos.coords.longitude + offset;

            // Reverse geocode (simple)
            const confirmation = document.getElementById('location-confirmation');
            if (confirmation) {
              confirmation.style.display = 'flex';
              confirmation.textContent = '📍 Location set (approximate)';
            }
            locBtn.textContent = '📍 Location Set ✓';
            locBtn.disabled = false;
            notyf.success('Location detected!');
          },
          function(err) {
            notyf.error('Could not detect location. Please select your country.');
            locBtn.textContent = '📍 Use My Location';
            locBtn.disabled = false;
          },
          { enableHighAccuracy: false, timeout: 10000 }
        );
      });
    }

    // Social links
    document.querySelectorAll('.social-input').forEach(function(input) {
      input.addEventListener('input', function() {
        if (!formData.social_links) formData.social_links = {};
        formData.social_links[this.dataset.platform] = this.value;
      });
    });

    // Skip links
    document.querySelectorAll('.skip-link').forEach(function(link) {
      link.addEventListener('click', function() {
        nextStep();
      });
    });

    // Emoji cycling logic for Step 6 (Photo)
    const uploadEmojiPlaceholder = document.getElementById('upload-emoji-placeholder');
    if (uploadEmojiPlaceholder) {
      const emojis = ['😊', '😁', '☺️', '😀', '😙'];
      let emojiIdx = 0;
      
      // Pre-render initial emoji
      if (window.AmepleEmoji) {
        uploadEmojiPlaceholder.innerHTML = window.AmepleEmoji.toImg(emojis[0]);
      }

      setInterval(() => {
        // Pop-out (faster)
        uploadEmojiPlaceholder.style.transform = 'scale(0.3) rotate(-20deg)';
        uploadEmojiPlaceholder.style.opacity = '0';
        
        setTimeout(() => {
          emojiIdx = (emojiIdx + 1) % emojis.length;
          const nextEmoji = emojis[emojiIdx];
          
          // Use pre-rendered img to avoid native emoji flash
          if (window.AmepleEmoji) {
            uploadEmojiPlaceholder.innerHTML = window.AmepleEmoji.toImg(nextEmoji);
          } else {
            uploadEmojiPlaceholder.textContent = nextEmoji;
          }
          
          // Pop-in (faster)
          uploadEmojiPlaceholder.style.transform = 'scale(1) rotate(0deg)';
          uploadEmojiPlaceholder.style.opacity = '1';
        }, 180);
      }, 1400);
    }
  }

  // --- Photo Upload Handler ---
  function handlePhotoUpload(file) {
    if (file.size > 5 * 1024 * 1024) {
      notyf.error('Photo must be under 5MB');
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      notyf.error('Please upload JPG, PNG, or WebP');
      return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
      formData.avatar_url = e.target.result;
      const preview = document.getElementById('upload-preview');
      const zone = document.getElementById('upload-zone');
      if (preview) {
        preview.src = e.target.result;
        preview.style.display = 'block';
        zone.classList.add('has-image');
        
        spawnLuxuriousConfetti(zone, '😍');
      }
      notyf.success('Photo uploaded!');
    };
    reader.readAsDataURL(file);
  }

  function spawnLuxuriousConfetti(targetEl, emoji) {
    const rect = targetEl.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const count = 20;

    for (let i = 0; i < count; i++) {
      // Stagger each emoji slightly for a cascading luxurious feel
      const delay = i * 55;

      setTimeout(() => {
        const el = document.createElement('div');
        el.className = 'luxurious-emoji phase-in';
        el.textContent = emoji;

        // Randomize angle, distance, rotation for natural scatter
        const angle = (Math.PI * 2 / count) * i + (Math.random() - 0.5) * 0.8;
        const dist = 120 + Math.random() * 200;
        const tx = (Math.cos(angle) * dist).toFixed(1) + 'px';
        const ty = (Math.sin(angle) * dist - 60).toFixed(1) + 'px';
        const rHalf = ((Math.random() - 0.5) * 30).toFixed(1) + 'deg';
        const rEnd  = ((Math.random() - 0.5) * 60).toFixed(1) + 'deg';
        const size  = (28 + Math.random() * 22).toFixed(0) + 'px';
        const driftDur = (1.4 + Math.random() * 0.8).toFixed(2) + 's';

        el.style.cssText = `
          left: ${centerX}px;
          top: ${centerY}px;
          --tx: ${tx};
          --ty: ${ty};
          --r-half: ${rHalf};
          --r-end: ${rEnd};
          --em-size: ${size};
          --drift-dur: ${driftDur};
        `;

        document.body.appendChild(el);

        // After pop-in completes, switch to drift phase
        const popDuration = 570;
        setTimeout(() => {
          if (!el.parentNode) return;
          el.classList.remove('phase-in');
          el.classList.add('phase-drift');

          const totalLife = parseFloat(driftDur) * 1000 + popDuration + 100;
          setTimeout(() => { if (el.parentNode) el.remove(); }, parseFloat(driftDur) * 1000);
        }, popDuration);

        // Safety cleanup
        setTimeout(() => { if (el.parentNode) el.remove(); }, 4000);
      }, delay);
    }
  }

  // --- Tom Select Initializations ---
  let countrySelect, citySelect, jobSelect, nativeLangSelect, additionalLangSelect;

  function initCitySelect() {
    if (citySelect) return;
    const el = document.getElementById('select-city');
    if (!el || el.tomselect) return;

    citySelect = new TomSelect(el, {
      maxItems: 1,
      maxOptions: 500,
      closeAfterSelect: true,
      placeholder: 'Search city...',
      valueField: 'name',
      labelField: 'name',
      searchField: ['name'],
      options: [],
      onInitialize: function() {
        if (formData.city) {
          this.addOption({ name: formData.city });
          this.setValue(formData.city);
        }
      },
      onItemAdd: function(cityName) {
        const self = this;
        self.close();
        setTimeout(function() {
          self.blur();
          self.setTextboxValue('');
        }, 0);

        // Save city to formData immediately
        formData.city = cityName;
        // Reset coords so completeOnboarding knows to geocode fresh
        formData.latitude = null;
        formData.longitude = null;
      }
    });
  }

  function fetchCities(country) {
    if (!citySelect) return;
    citySelect.clear();
    citySelect.clearOptions();

    const cities = (window.AmepleCities && window.AmepleCities[country]) || [];

    if (cities.length > 0) {
      const options = cities.map(city => ({ name: city }));
      citySelect.addOptions(options);
      citySelect.settings.placeholder = 'Search city...';
    } else {
      // Country not in dataset — allow free typing
      citySelect.settings.placeholder = 'Type your city...';
    }
    citySelect.updatePlaceholder();
  }

  function initCountrySelect() {
    if (countrySelect) return;
    const el = document.getElementById('select-country');
    if (!el || el.tomselect) return;

    const countries = [
      { name: 'Afghanistan', flag: '🇦🇫' }, { name: 'Albania', flag: '🇦🇱' }, { name: 'Algeria', flag: '🇩🇿' }, { name: 'Andorra', flag: '🇦🇩' },
      { name: 'Angola', flag: '🇦🇴' }, { name: 'Antigua and Barbuda', flag: '🇦🇬' }, { name: 'Argentina', flag: '🇦🇷' }, { name: 'Armenia', flag: '🇦🇲' },
      { name: 'Australia', flag: '🇦🇺' }, { name: 'Austria', flag: '🇦🇹' }, { name: 'Azerbaijan', flag: '🇦🇿' }, { name: 'Bahamas', flag: '🇧🇸' },
      { name: 'Bahrain', flag: '🇧🇭' }, { name: 'Bangladesh', flag: '🇧🇩' }, { name: 'Barbados', flag: '🇧🇧' }, { name: 'Belarus', flag: '🇧🇾' },
      { name: 'Belgium', flag: '🇧🇪' }, { name: 'Belize', flag: '🇧🇿' }, { name: 'Benin', flag: '🇧🇯' }, { name: 'Bhutan', flag: '🇧🇹' },
      { name: 'Bolivia', flag: '🇧🇴' }, { name: 'Bosnia and Herzegovina', flag: '🇧🇦' }, { name: 'Botswana', flag: '🇧🇼' }, { name: 'Brazil', flag: '🇧🇷' },
      { name: 'Brunei', flag: '🇧🇳' }, { name: 'Bulgaria', flag: '🇧🇬' }, { name: 'Burkina Faso', flag: '🇧🇫' }, { name: 'Burundi', flag: '🇧🇮' },
      { name: 'Cabo Verde', flag: '🇨🇻' }, { name: 'Cambodia', flag: '🇰🇭' }, { name: 'Cameroon', flag: '🇨🇲' }, { name: 'Canada', flag: '🇨🇦' },
      { name: 'Central African Republic', flag: '🇨🇫' }, { name: 'Chad', flag: '🇹🇩' }, { name: 'Chile', flag: '🇨🇱' }, { name: 'China', flag: '🇨🇳' },
      { name: 'Colombia', flag: '🇨🇴' }, { name: 'Comoros', flag: '🇰🇲' }, { name: 'Congo', flag: '🇨🇬' }, { name: 'Costa Rica', flag: '🇨🇷' },
      { name: 'Croatia', flag: '🇭🇷' }, { name: 'Cuba', flag: '🇨🇺' }, { name: 'Cyprus', flag: '🇨🇾' }, { name: 'Czechia', flag: '🇨🇿' },
      { name: 'Denmark', flag: '🇩🇰' }, { name: 'Djibouti', flag: '🇩🇯' }, { name: 'Dominica', flag: '🇩🇲' }, { name: 'Dominican Republic', flag: '🇩🇴' },
      { name: 'Ecuador', flag: '🇪🇨' }, { name: 'Egypt', flag: '🇪🇬' }, { name: 'El Salvador', flag: '🇸🇻' }, { name: 'Equatorial Guinea', flag: '🇬🇶' },
      { name: 'Eritrea', flag: '🇪🇷' }, { name: 'Estonia', flag: '🇪🇪' }, { name: 'Eswatini', flag: '🇸🇿' }, { name: 'Ethiopia', flag: '🇪🇹' },
      { name: 'Fiji', flag: '🇫🇯' }, { name: 'Finland', flag: '🇫🇮' }, { name: 'France', flag: '🇫🇷' }, { name: 'Gabon', flag: '🇬🇦' },
      { name: 'Gambia', flag: '🇬🇲' }, { name: 'Georgia', flag: '🇬🇪' }, { name: 'Germany', flag: '🇩🇪' }, { name: 'Ghana', flag: '🇬🇭' },
      { name: 'Greece', flag: '🇬🇷' }, { name: 'Grenada', flag: '🇬🇩' }, { name: 'Guatemala', flag: '🇬🇹' }, { name: 'Guinea', flag: '🇬🇳' },
      { name: 'Guinea-Bissau', flag: '🇬🇼' }, { name: 'Guyana', flag: '🇬🇾' }, { name: 'Haiti', flag: '🇭🇹' }, { name: 'Honduras', flag: '🇭🇳' },
      { name: 'Hungary', flag: '🇭🇺' }, { name: 'Iceland', flag: '🇮🇸' }, { name: 'India', flag: '🇮🇳' }, { name: 'Indonesia', flag: '🇮🇩' },
      { name: 'Iran', flag: '🇮🇷' }, { name: 'Iraq', flag: '🇮🇶' }, { name: 'Ireland', flag: '🇮🇪' },
      { name: 'Italy', flag: '🇮🇹' }, { name: 'Jamaica', flag: '🇯🇲' }, { name: 'Japan', flag: '🇯🇵' }, { name: 'Jordan', flag: '🇯🇴' },
      { name: 'Kazakhstan', flag: '🇰🇿' }, { name: 'Kenya', flag: '🇰🇪' }, { name: 'Kiribati', flag: '🇰🇮' }, { name: 'Kuwait', flag: '🇰🇼' },
      { name: 'Kyrgyzstan', flag: '🇰🇬' }, { name: 'Laos', flag: '🇱🇦' }, { name: 'Latvia', flag: '🇱🇻' }, { name: 'Lebanon', flag: '🇱🇧' },
      { name: 'Lesotho', flag: '🇱🇸' }, { name: 'Liberia', flag: '🇱🇷' }, { name: 'Libya', flag: '🇱🇾' }, { name: 'Liechtenstein', flag: '🇱🇮' },
      { name: 'Lithuania', flag: '🇱🇹' }, { name: 'Luxembourg', flag: '🇱🇺' }, { name: 'Madagascar', flag: '🇲🇬' }, { name: 'Malawi', flag: '🇲🇼' },
      { name: 'Malaysia', flag: '🇲🇾' }, { name: 'Maldives', flag: '🇲🇻' }, { name: 'Mali', flag: '🇲🇱' }, { name: 'Malta', flag: '🇲🇹' },
      { name: 'Marshall Islands', flag: '🇲🇭' }, { name: 'Mauritania', flag: '🇲🇷' }, { name: 'Mauritius', flag: '🇲🇺' }, { name: 'Mexico', flag: '🇲🇽' },
      { name: 'Micronesia', flag: '🇫🇲' }, { name: 'Moldova', flag: '🇲🇩' }, { name: 'Monaco', flag: '🇲🇨' }, { name: 'Mongolia', flag: '🇲🇳' },
      { name: 'Montenegro', flag: '🇲🇪' }, { name: 'Morocco', flag: '🇲🇦' }, { name: 'Mozambique', flag: '🇲🇿' }, { name: 'Myanmar', flag: '🇲🇲' },
      { name: 'Namibia', flag: '🇳🇦' }, { name: 'Nauru', flag: '🇳🇷' }, { name: 'Nepal', flag: '🇳🇵' }, { name: 'Netherlands', flag: '🇳🇱' },
      { name: 'New Zealand', flag: '🇳🇿' }, { name: 'Nicaragua', flag: '🇳🇮' }, { name: 'Niger', flag: '🇳🇪' }, { name: 'Nigeria', flag: '🇳🇬' },
      { name: 'North Korea', flag: '🇰🇵' }, { name: 'North Macedonia', flag: '🇲🇰' }, { name: 'Norway', flag: '🇳🇴' }, { name: 'Oman', flag: '🇴🇲' },
      { name: 'Pakistan', flag: '🇵🇰' }, { name: 'Palau', flag: '🇵🇼' }, { name: 'Palestine', flag: '🇵🇸' }, { name: 'Panama', flag: '🇵🇦' },
      { name: 'Papua New Guinea', flag: '🇵🇬' }, { name: 'Paraguay', flag: '🇵🇾' }, { name: 'Peru', flag: '🇵🇪' }, { name: 'Philippines', flag: '🇵🇭' },
      { name: 'Poland', flag: '🇵🇱' }, { name: 'Portugal', flag: '🇵🇹' }, { name: 'Qatar', flag: '🇶🇦' }, { name: 'Romania', flag: '🇷🇴' },
      { name: 'Russia', flag: '🇷🇺' }, { name: 'Rwanda', flag: '🇷🇼' }, { name: 'Saint Kitts and Nevis', flag: '🇰🇳' }, { name: 'Saint Lucia', flag: '🇱🇨' },
      { name: 'Saint Vincent and the Grenadines', flag: '🇻🇨' }, { name: 'Samoa', flag: '🇼🇸' }, { name: 'San Marino', flag: '🇸🇲' }, { name: 'Sao Tome and Principe', flag: '🇸🇹' },
      { name: 'Saudi Arabia', flag: '🇸🇦' }, { name: 'Senegal', flag: '🇸🇳' }, { name: 'Serbia', flag: '🇷🇸' }, { name: 'Seychelles', flag: '🇸🇨' },
      { name: 'Sierra Leone', flag: '🇸🇱' }, { name: 'Singapore', flag: '🇸🇬' }, { name: 'Slovakia', flag: '🇸🇰' }, { name: 'Slovenia', flag: '🇸🇮' },
      { name: 'Solomon Islands', flag: '🇸🇧' }, { name: 'Somalia', flag: '🇸🇴' }, { name: 'South Africa', flag: '🇿🇦' }, { name: 'South Korea', flag: '🇰🇷' },
      { name: 'South Sudan', flag: '🇸🇸' }, { name: 'Spain', flag: '🇪🇸' }, { name: 'Sri Lanka', flag: '🇱🇰' }, { name: 'Sudan', flag: '🇸🇩' },
      { name: 'Suriname', flag: '🇸🇷' }, { name: 'Sweden', flag: '🇸🇪' }, { name: 'Switzerland', flag: '🇨🇭' }, { name: 'Syria', flag: '🇸🇾' },
      { name: 'Taiwan', flag: '🇹🇼' }, { name: 'Tajikistan', flag: '🇹🇯' }, { name: 'Tanzania', flag: '🇹🇿' }, { name: 'Thailand', flag: '🇹🇭' },
      { name: 'Timor-Leste', flag: '🇹🇱' }, { name: 'Togo', flag: '🇹🇬' }, { name: 'Tonga', flag: '🇹🇴' }, { name: 'Trinidad and Tobago', flag: '🇹🇹' },
      { name: 'Tunisia', flag: '🇹🇳' }, { name: 'Turkey', flag: '🇹🇷' }, { name: 'Turkmenistan', flag: '🇹🇲' }, { name: 'Tuvalu', flag: '🇹🇻' },
      { name: 'Uganda', flag: '🇺🇬' }, { name: 'Ukraine', flag: '🇺🇦' }, { name: 'United Arab Emirates', flag: '🇦🇪' }, { name: 'United Kingdom', flag: '🇬🇧' },
      { name: 'United States', flag: '🇺🇸' }, { name: 'Uruguay', flag: '🇺🇾' }, { name: 'Uzbekistan', flag: '🇺🇿' }, { name: 'Vanuatu', flag: '🇻🇺' },
      { name: 'Vatican City', flag: '🇻🇦' }, { name: 'Venezuela', flag: '🇻🇪' }, { name: 'Vietnam', flag: '🇻🇳' }, { name: 'Yemen', flag: '🇾🇪' },
      { name: 'Zambia', flag: '🇿🇲' }, { name: 'Zimbabwe', flag: '🇿🇼' }
    ];

    countrySelect = new TomSelect(el, {
      options: countries.map(function(c) {
        return { value: c.name, text: c.flag + ' ' + c.name, flag: c.flag };
      }),
      placeholder: 'Search your country...',
      maxItems: 1,
      maxOptions: 300,
      closeAfterSelect: true,
      render: {
        option: function(data, escape) {
          var flagImg = (window.AmepleEmoji && window.AmepleEmoji.flagToImg)
            ? window.AmepleEmoji.flagToImg((data && data.flag) || data || '')
            : '';
          return '<div class="option">' + flagImg + escape(data.value) + '</div>';
        },
        item: function(data, escape) {
          var flagImg = (window.AmepleEmoji && window.AmepleEmoji.flagToImg)
            ? window.AmepleEmoji.flagToImg((data && data.flag) || data || '')
            : '';
          return '<div>' + flagImg + escape(data.value) + '</div>';
        }
      },
      onInitialize: function() {},
      onDropdownOpen: function(dropdown) {
        if (window.AmepleEmoji) window.AmepleEmoji.parse(dropdown);
      },
      onType: function() {},
      onItemAdd: function() {
        if (window.AmepleEmoji) window.AmepleEmoji.parse(this.control);
        const val = this.getValue();
        if (val) fetchCities(val);

        const self = this;
        self.close();
        setTimeout(function() {
          self.blur();
          self.setTextboxValue('');
        }, 0);
      }
    });

    if (formData.country) {
      countrySelect.setValue(formData.country);
      // Use setTimeout to guarantee citySelect is fully initialized
      // before fetchCities runs (initCitySelect runs after initCountrySelect)
      setTimeout(function() {
        fetchCities(formData.country);
        // Also restore saved city after cities are loaded
        if (formData.city && citySelect) {
          // If not already in options, add it
          if (!citySelect.getOption(formData.city)) {
            citySelect.addOption({ name: formData.city });
          }
          citySelect.setValue(formData.city, true);
        }
      }, 0);
    }
  }

  function initJobSelect() {
    const catTabsEl  = document.getElementById('job-cat-tabs');
    const cardsEl    = document.getElementById('job-cards-grid');
    if (!catTabsEl || catTabsEl._jobInit) return;
    catTabsEl._jobInit = true;

    const jobs = window.AmepleData.jobs;
    const categories = [
      { key: 'Creative',       emoji: '🎨' },
      { key: 'Content',        emoji: '✍️' },
      { key: 'Tech',           emoji: '💻' },
      { key: 'Health',         emoji: '🩺' },
      { key: 'Marketing',      emoji: '📣' },
      { key: 'Finance & Law',  emoji: '⚖️' },
      { key: 'Business & Ops', emoji: '👔' },
      { key: 'Education',      emoji: '📚' },
      { key: 'Engineering',    emoji: '🏗️' },
      { key: 'Hospitality',    emoji: '🍽️' },
      { key: 'Supply Chain',   emoji: '🚚' },
      { key: 'Transport',      emoji: '✈️' },
      { key: 'Sports & Media', emoji: '🏅' }
    ];

    let activeCategory = categories[0].key;

    // Build category tabs
    categories.forEach(function(cat) {
      const btn = document.createElement('button');
      btn.className = 'job-cat-tab' + (cat.key === activeCategory ? ' active' : '');
      btn.type = 'button';
      btn.innerHTML = '<span class="cat-emoji">' + cat.emoji + '</span>' + cat.key;
      btn.addEventListener('click', function() {
        catTabsEl.querySelectorAll('.job-cat-tab').forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
        activeCategory = cat.key;
        renderCards();
      });
      catTabsEl.appendChild(btn);
    });

    function renderCards() {
      // Animate out then in
      cardsEl.style.animation = 'none';
      cardsEl.innerHTML = '';
      void cardsEl.offsetWidth; // reflow
      cardsEl.style.animation = 'gridFadeIn 220ms ease';

      const filtered = jobs.filter(j => j.category === activeCategory);
      
      // Multi-select logic (limit 3) - Shared across all cards in renderCards
      if (!formData.jobs) formData.jobs = [];
      // Support legacy single select if any
      if (typeof formData.job_name === 'string' && formData.jobs.length === 0 && formData.job_name) {
        formData.jobs = [formData.job_name];
      }

      filtered.forEach(function(job) {
        const card = document.createElement('div');
        const isSelected = formData.jobs.includes(job.title);
        card.className = 'job-card' + (isSelected ? ' selected' : '');
        card.innerHTML =
          '<div class="job-card-emoji AmepleEmoji">' + job.emoji + '</div>' +
          '<div class="job-card-title">' + job.title + '</div>';

        card.addEventListener('click', function() {
          const idx = formData.jobs.indexOf(job.title);
          if (idx > -1) {
            formData.jobs.splice(idx, 1);
            card.classList.remove('selected');
          } else {
            if (formData.jobs.length >= 3) {
              showError('You can select up to 3 jobs', 'job-cards-grid');
              return;
            }
            formData.jobs.push(job.title);
            card.classList.add('selected');
          }
          formData.job_name = formData.jobs[0] || ''; // For legacy compatibility
        });

        cardsEl.appendChild(card);
      });

      // KEY FIX: Parse emojis immediately after appending all cards to DOM
      if (window.AmepleEmoji) {
        window.AmepleEmoji.parse(cardsEl);
      }
    }

    // Restore saved values
    if (formData.jobs && formData.jobs.length > 0) {
      const firstJobTitle = formData.jobs[0];
      const savedJob = jobs.find(j => j.title === firstJobTitle);
      if (savedJob) {
        activeCategory = savedJob.category;
        catTabsEl.querySelectorAll('.job-cat-tab').forEach(function(tab, i) {
          tab.classList.toggle('active', categories[i].key === activeCategory);
        });
      }
    } else if (formData.job_name) {
      const savedJob = jobs.find(j => j.title === formData.job_name);
      if (savedJob) {
        activeCategory = savedJob.category;
        catTabsEl.querySelectorAll('.job-cat-tab').forEach(function(tab, i) {
          tab.classList.toggle('active', categories[i].key === activeCategory);
        });
      }
    }

    renderCards();
  }

  function initLanguageSelects() {
    if (nativeLangSelect) return;
    const nativeEl = document.getElementById('select-native-lang');
    const additionalEl = document.getElementById('select-additional-langs');
    if (!nativeEl || nativeEl.tomselect) return;

    const langs = window.AmepleData.languages;
    const langOptions = langs.map(function(l) {
      return { value: l.name, text: l.flag + ' ' + l.name, flag: l.flag };
    });

    var langRender = {
      option: function(data, escape) {
        var flagImg = (window.AmepleEmoji && window.AmepleEmoji.flagToImg)
            ? window.AmepleEmoji.flagToImg((data && data.flag) || data || '') // Fallback for various TomSelect formats
            : '';
        return '<div class="option">' + flagImg + escape(data.value) + '</div>';
      },
      item: function(data, escape) {
        var flagImg = (window.AmepleEmoji && window.AmepleEmoji.flagToImg)
            ? window.AmepleEmoji.flagToImg((data && data.flag) || data || '') // Fallback for various TomSelect formats
            : '';
        return '<div>' + flagImg + escape(data.value) + '</div>';
      }
    };

    nativeLangSelect = new TomSelect(nativeEl, {
      options: langOptions,
      placeholder: 'Select native language...',
      maxItems: 1,
      render: langRender,
      onDropdownOpen: function(dropdown) {
        if (window.AmepleEmoji) window.AmepleEmoji.parse(dropdown);
      },
      onItemAdd: function(value) {
        if (window.AmepleEmoji) window.AmepleEmoji.parse(this.control);
        formData.native_language = value;
        // Bidirectional: If selected as native, remove from additional
        if (additionalLangSelect) {
          additionalLangSelect.removeItem(value);
        }
      }
    });

    additionalLangSelect = new TomSelect(additionalEl, {
      options: langOptions,
      placeholder: 'Select additional...',
      maxItems: 5,
      render: langRender,
      controlInput: null,
      onDropdownOpen: function(dropdown) {
        if (window.AmepleEmoji) window.AmepleEmoji.parse(dropdown);
      },
      onItemAdd: function(value) {
        if (window.AmepleEmoji) window.AmepleEmoji.parse(this.control);
        // Bidirectional: If added to additional, remove from native
        if (nativeLangSelect && nativeLangSelect.getValue() === value) {
          nativeLangSelect.clear();
          formData.native_language = null;
        }
        formData.additional_languages = this.getValue();
        
        // After adding, blur to make it feel like a completed action
        this.blur();
      },
      onItemRemove: function() {
        formData.additional_languages = this.getValue();
        syncLangs();
      }
    });

    // ── Sync: hide native lang in additional, hide additional langs in native ──
    function syncLangs() {
      const native    = nativeLangSelect.getValue();
      const selected  = additionalLangSelect.getValue(); // array

      // Rebuild additional options: exclude current native
      const additionalOpts = langOptions.filter(o => o.value !== native);
      additionalLangSelect.clearOptions();
      additionalLangSelect.addOptions(additionalOpts);

      // Re-add currently selected items (they stay after clearOptions)
      selected.forEach(v => {
        if (v !== native) additionalLangSelect.addItem(v, true /* silent */);
      });

      // Disable already-selected additional langs inside native dropdown
      langOptions.forEach(opt => {
        const blocked = selected.includes(opt.value);
        nativeLangSelect.updateOption(opt.value, { disabled: blocked });
      });
    }

    nativeLangSelect.on('change', syncLangs);
    additionalLangSelect.on('change', () => syncLangs());

    if (formData.native_language) {
      nativeLangSelect.setValue(formData.native_language);
      syncLangs();
    }
    if (formData.additional_languages) {
      formData.additional_languages.forEach(function(l) {
        additionalLangSelect.addItem(l);
      });
    }
  }

  // --- Triple Dropdown Date Picker ---
  let dayTs, monthTs, yearTs;
  function initTripleDatePicker() {
    const dayEl = document.getElementById('dob-day');
    const monthEl = document.getElementById('dob-month');
    const yearEl = document.getElementById('dob-year');
    if (!dayEl || !monthEl || !yearEl || dayEl.tomselect) return;

    // Days 1-31
    let daysHtml = '<option value="">Day</option>';
    for (let i = 1; i <= 31; i++) daysHtml += `<option value="${i}">${i}</option>`;
    dayEl.innerHTML = daysHtml;

    // Months
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    let monthsHtml = '<option value="">Month</option>';
    months.forEach((m, i) => { monthsHtml += `<option value="${i + 1}">${m}</option>`; });
    monthEl.innerHTML = monthsHtml;

    // Years (16+ years old, down to 1950)
    const currentYear = new Date().getFullYear();
    let yearsHtml = '<option value="">Year</option>';
    for (let i = currentYear - 16; i >= 1950; i--) yearsHtml += `<option value="${i}">${i}</option>`;
    yearEl.innerHTML = yearsHtml;

    const tsSettings = {
      controlInput: null,
      hideSelected: true,
      maxOptions: 200 // Show all years down to 1950
    };

    dayTs = new TomSelect(dayEl, tsSettings);
    monthTs = new TomSelect(monthEl, tsSettings);
    yearTs = new TomSelect(yearEl, tsSettings);

    const onDateChange = () => {
      const d = dayTs.getValue();
      const m = monthTs.getValue();
      const y = yearTs.getValue();
      if (d && m && y) {
        const birthday = new Date(y, m - 1, d);
        const age = calculateAge(birthday);
        const ageDisplay = document.getElementById('age-display');
        if (ageDisplay) {
          ageDisplay.style.display = 'block';
          ageDisplay.textContent = 'You are ' + age + ' years old';
        }
        formData.date_of_birth = `${y}-${m.toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
        formData.age = age;
      }
    };

    dayTs.on('change', onDateChange);
    monthTs.on('change', onDateChange);
    yearTs.on('change', onDateChange);

    if (formData.date_of_birth) {
      const parts = formData.date_of_birth.split('-');
      yearTs.setValue(parts[0]);
      monthTs.setValue(parseInt(parts[1]).toString());
      dayTs.setValue(parseInt(parts[2]).toString());
    }
  }

  function calculateAge(birthday) {
    const today = new Date();
    let age = today.getFullYear() - birthday.getFullYear();
    const m = today.getMonth() - birthday.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthday.getDate())) age--;
    return age;
  }

  // --- Skills Grid ---
  let selectedSkills = [];
  const categoryColors = {
    'Thinking': '#6C63FF',
    'Productivity': '#F59E0B',
    'Communication': '#10B981',
    'People': '#EC4899',
    'Creative': '#F97316',
    'Writing': '#8B5CF6',
    'Tech': '#0EA5E9',
    'Data': '#14B8A6',
    'Marketing': '#EF4444',
    'Business': '#6366F1',
    'Self-Development': '#22C55E'
  };

  function initSkillsGrid() {
    let selectedSkills = formData.skills || [];
    const catTabsEl = document.getElementById('skill-cat-tabs');
    const cardsEl   = document.getElementById('skills-cards-grid');
    const counter   = document.getElementById('skills-counter');
    if (!catTabsEl || catTabsEl._skillsInit) return;
    catTabsEl._skillsInit = true;

    const allSkills = window.AmepleData.skills;
    const categories = [
      { key: 'Thinking',      emoji: '🧠' },
      { key: 'Productivity',  emoji: '⚡' },
      { key: 'Communication', emoji: '💬' },
      { key: 'People',        emoji: '👥' },
      { key: 'Creative',      emoji: '🎨' },
      { key: 'Writing',       emoji: '✍️' },
      { key: 'Tech',          emoji: '💻' },
      { key: 'Data',          emoji: '📊' },
      { key: 'Marketing',     emoji: '📣' },
      { key: 'Business',      emoji: '💼' },
      { key: 'Self-Development', emoji: '🌱' }
    ];

    let activeCategory = categories[0].key;

    // Build category tabs
    categories.forEach(function(cat) {
      const btn = document.createElement('button');
      btn.className = 'job-cat-tab' + (cat.key === activeCategory ? ' active' : '');
      btn.type = 'button';
      btn.innerHTML = '<span class="cat-emoji">' + cat.emoji + '</span>' + cat.key;
      btn.addEventListener('click', function() {
        catTabsEl.querySelectorAll('.job-cat-tab').forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
        activeCategory = cat.key;
        renderCards();
      });
      catTabsEl.appendChild(btn);
    });

    function renderCards() {
      cardsEl.style.animation = 'none';
      cardsEl.innerHTML = '';
      void cardsEl.offsetWidth; // reflow
      cardsEl.style.animation = 'gridFadeIn 220ms ease';

      const filtered = allSkills.filter(s => s.category === activeCategory);
      filtered.forEach(function(skill) {
        const card = document.createElement('div');
        const isSelected = selectedSkills.includes(skill.name);
        card.className = 'job-card' + (isSelected ? ' selected' : '');
        card.innerHTML =
          '<div class="job-card-emoji AmepleEmoji">' + (skill.emoji || '✨') + '</div>' +
          '<div class="job-card-title">' + skill.name + '</div>';

        card.addEventListener('click', function() {
          if (selectedSkills.includes(skill.name)) {
            selectedSkills = selectedSkills.filter(s => s !== skill.name);
            card.classList.remove('selected');
          } else {
            selectedSkills.push(skill.name);
            card.classList.add('selected');
          }
          formData.skills = selectedSkills;
        });

        cardsEl.appendChild(card);
      });

      if (window.AmepleEmoji) window.AmepleEmoji.parse(cardsEl);
    }

    renderCards();
  }

  function initGamesGrid() {
    let selectedGames = formData.favorite_games || [];
    const cardsEl = document.getElementById('games-cards-grid');
    if (!cardsEl || cardsEl._gamesInit) return;
    cardsEl._gamesInit = true;

    const allGames = window.AmepleData.games;

    function renderCards() {
      cardsEl.style.animation = 'none';
      cardsEl.innerHTML = '';
      void cardsEl.offsetWidth; // reflow
      cardsEl.style.animation = 'gridFadeIn 220ms ease';

      allGames.forEach(function(game) {
        const card = document.createElement('div');
        const isSelected = selectedGames.includes(game.name);
        card.className = 'job-card' + (isSelected ? ' selected' : '');
        card.innerHTML =
          '<div class="job-card-visual" style="color: ' + (game.color || 'inherit') + ';">' +
            `<iconify-icon icon="${game.iconify}" style="font-size: 32px; width: 100%; display: flex; justify-content: center;"></iconify-icon>` +
          '</div>' +
          '<div class="job-card-title">' + game.name + '</div>';

        card.addEventListener('click', function() {
          if (selectedGames.includes(game.name)) {
            selectedGames = selectedGames.filter(g => g !== game.name);
            card.classList.remove('selected');
          } else {
            selectedGames.push(game.name);
            card.classList.add('selected');
          }
          formData.favorite_games = selectedGames;
        });

        cardsEl.appendChild(card);
      });

      if (window.AmepleEmoji) window.AmepleEmoji.parse(cardsEl);
    }

    renderCards();
  }

  function initHobbiesGrid() {
    let selectedHobbies = formData.hobbies || [];
    const catTabsEl = document.getElementById('hobbies-tabs');
    const cardsEl   = document.getElementById('hobbies-cards-grid');
    if (!catTabsEl || catTabsEl._hobbiesInit) return;
    catTabsEl._hobbiesInit = true;

    const allHobbies = window.AmepleData.hobbies;
    const categories = [
      { key: 'Sports',            emoji: '🏃' },
      { key: 'Art & Creativity',  emoji: '🎨' },
      { key: 'Entertainment',     emoji: '🍿' },
      { key: 'Food & Drink',      emoji: '🍳' },
      { key: 'Technology',        emoji: '💻' },
      { key: 'Nature & Outdoors', emoji: '🌲' },
      { key: 'Self-Development',  emoji: '📚' },
      { key: 'Collecting',        emoji: '🏺' }
    ];

    let activeCategory = categories[0].key;

    // Build category tabs
    categories.forEach(function(cat) {
      const btn = document.createElement('button');
      btn.className = 'job-cat-tab' + (cat.key === activeCategory ? ' active' : '');
      btn.type = 'button';
      btn.innerHTML = '<span class="cat-emoji">' + cat.emoji + '</span>' + cat.key;
      btn.addEventListener('click', function() {
        catTabsEl.querySelectorAll('.job-cat-tab').forEach(t => t.classList.remove('active'));
        btn.classList.add('active');
        activeCategory = cat.key;
        renderCards();
      });
      catTabsEl.appendChild(btn);
    });

    function renderCards() {
      cardsEl.style.animation = 'none';
      cardsEl.innerHTML = '';
      void cardsEl.offsetWidth; // reflow
      cardsEl.style.animation = 'gridFadeIn 220ms ease';

      const filtered = allHobbies.filter(h => h.category === activeCategory);
      filtered.forEach(function(hobby) {
        const card = document.createElement('div');
        const isSelected = selectedHobbies.includes(hobby.name);
        card.className = 'job-card' + (isSelected ? ' selected' : '');
        card.innerHTML =
          '<div class="job-card-emoji AmepleEmoji">' + (hobby.emoji || '✨') + '</div>' +
          '<div class="job-card-title">' + hobby.name + '</div>';

        card.addEventListener('click', function() {
          if (selectedHobbies.includes(hobby.name)) {
            selectedHobbies = selectedHobbies.filter(h => h !== hobby.name);
            card.classList.remove('selected');
          } else {
            selectedHobbies.push(hobby.name);
            card.classList.add('selected');
          }
          formData.hobbies = selectedHobbies;
        });

        cardsEl.appendChild(card);
      });

      if (window.AmepleEmoji) window.AmepleEmoji.parse(cardsEl);
    }

    renderCards();
  }

  // --- Completion Step ---
  function initCompletionStep() {
    // Render preview card
    const previewName = document.getElementById('preview-name');
    const previewAvatar = document.getElementById('preview-avatar');
    const previewJob = document.getElementById('preview-job');
    const previewSkills = document.getElementById('preview-skills');

    if (previewName) previewName.textContent = (formData.first_name || '') + ' ' + (formData.last_name || '');
    if (previewAvatar) previewAvatar.src = formData.avatar_url || 'assets/default-avatar.svg';
    if (previewJob) {
      if (formData.jobs && formData.jobs.length > 0) {
        previewJob.innerHTML = formData.jobs.map(function(title) {
          const job = window.AmepleData.jobs.find(function(j) { return j.title === title; });
          return (job ? job.emoji + ' ' : '') + title;
        }).join('<br>');
      } else {
        const job = window.AmepleData.jobs.find(function(j) { return j.title === formData.job_name; });
        previewJob.textContent = (job ? job.emoji + ' ' : '') + (formData.job_name || 'Not specified');
      }
    }
    if (previewSkills && formData.skills) {
      previewSkills.innerHTML = formData.skills.slice(0, 4).map(function(s) {
        return '<span class="preview-chip">' + s + '</span>';
      }).join('');
    }

    // Update title with name
    const completionTitle = document.getElementById('completion-title');
    if (completionTitle) {
      completionTitle.textContent = "🎉 You're all set, " + (formData.first_name || '') + '!';
    }

    // Confetti!
    if (typeof confetti === 'function') {
      setTimeout(function() {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#2563EB', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6']
        });
      }, 300);
    }
  }

  // --- Cartoonish Feedback Helper ---
  function shake(id) {
    // 1. Shake the Input
    const el = document.getElementById(id);
    if (el) {
      const target = el.tomselect ? el.tomselect.wrapper : el;
      target.classList.add('shake');
      setTimeout(() => target.classList.remove('shake'), 400);
      if (el.focus && !el.tomselect) el.focus();
    }

    // 2. Shake any existing toasts to signify "Spam"
    const activeToasts = document.querySelectorAll('.notyf__toast');
    if (activeToasts.length > 0) {
      activeToasts.forEach(t => {
        t.style.animation = 'none';
        t.offsetHeight;
        t.style.animation = 'input-shake 0.4s ease-in-out';
      });
    }
  }

  // Helper to show error without spamming
  function showError(msg, targetId) {
    const existing = document.querySelectorAll('.ameple-toast.error');
    if (existing.length > 0) {
      // If toast exists, just shake it
      shake(targetId);
    } else {
      // Show new toast (already clears previous if any)
      notyf.error(msg);
      if (targetId) shake(targetId);
    }
  }

  // --- Validation ---
  function validateStep(step) {
    // Clear old errors before new check
    // notyf.dismissAll(); // Removed to allow "existing toast" shake logic
    
    switch(step) {
      case 1: return true;

      case 2: // Auth Step
        return true; // Handled by btn-auth-submit listener

      case 3: // Name Step
        const fn = document.getElementById('input-firstname');
        const ln = document.getElementById('input-lastname');
        if (!fn.value.trim()) { showError('Please enter your first name', 'input-firstname'); return false; }
        if (!ln.value.trim()) { showError('Please enter your last name', 'input-lastname'); return false; }
        return true;

      case 4:
        if (!formData.date_of_birth) { showError('Select your birth date', 'input-dob'); return false; }
        if (!formData.gender) { notyf.error('Please select your gender'); return false; }
        return true;

      case 5:
        if (!countrySelect || !countrySelect.getValue()) { showError('Select your country', 'select-country'); return false; }
        return true;

      case 6: return true;

      case 7:
        if ((!formData.jobs || formData.jobs.length < 1) && !formData.job_name) { 
          showError('Please select at least one job', 'job-cards-grid'); 
          return false; 
        }
        return true;

      case 8:
        return true;

      case 9:
        if (!formData.hobbies || formData.hobbies.length < 1) { showError('Pick at least 1 hobby', 'hobbies-tabs'); return false; }
        return true;

      case 10: return true;
      case 11:
        if (!nativeLangSelect || !nativeLangSelect.getValue()) { showError('Native language required', 'select-native-lang'); return false; }
        return true;

      case 12: 
        notyf.dismissAll();
        return true;
      case 13: 
        notyf.dismissAll();
        return true;
      default: 
        notyf.dismissAll();
        return true;
    }
  }

  // --- Data Collection ---
  function collectStepData(step) {
    switch(step) {
      case 2: // Auth - Already handled in listeners
        break;
      case 3: // Name
        formData.first_name = document.getElementById('input-firstname').value.trim();
        formData.last_name = document.getElementById('input-lastname').value.trim();
        break;
      case 5:
        if (countrySelect) {
          formData.country = countrySelect.getValue();
          // Save city value too (in case user went back and re-selected)
          if (citySelect && citySelect.getValue()) {
            formData.city = citySelect.getValue();
            formData.latitude = null;
            formData.longitude = null;
          }
          // Use full countries list from initCountrySelect
          var allCountries = [
            { name: 'Afghanistan', flag: '🇦🇫' }, { name: 'Albania', flag: '🇦🇱' }, { name: 'Algeria', flag: '🇩🇿' },
            { name: 'Argentina', flag: '🇦🇷' }, { name: 'Australia', flag: '🇦🇺' }, { name: 'Austria', flag: '🇦🇹' },
            { name: 'Bahrain', flag: '🇧🇭' }, { name: 'Bangladesh', flag: '🇧🇩' }, { name: 'Belgium', flag: '🇧🇪' },
            { name: 'Brazil', flag: '🇧🇷' }, { name: 'Canada', flag: '🇨🇦' }, { name: 'China', flag: '🇨🇳' },
            { name: 'Colombia', flag: '🇨🇴' }, { name: 'Denmark', flag: '🇩🇰' }, { name: 'Egypt', flag: '🇪🇬' },
            { name: 'Finland', flag: '🇫🇮' }, { name: 'France', flag: '🇫🇷' }, { name: 'Germany', flag: '🇩🇪' },
            { name: 'Greece', flag: '🇬🇷' }, { name: 'India', flag: '🇮🇳' }, { name: 'Indonesia', flag: '🇮🇩' },
            { name: 'Iraq', flag: '🇮🇶' }, { name: 'Ireland', flag: '🇮🇪' }, { name: 'Italy', flag: '🇮🇹' },
            { name: 'Japan', flag: '🇯🇵' }, { name: 'Jordan', flag: '🇯🇴' }, { name: 'Kuwait', flag: '🇰🇼' },
            { name: 'Lebanon', flag: '🇱🇧' }, { name: 'Libya', flag: '🇱🇾' }, { name: 'Malaysia', flag: '🇲🇾' },
            { name: 'Mexico', flag: '🇲🇽' }, { name: 'Morocco', flag: '🇲🇦' }, { name: 'Netherlands', flag: '🇳🇱' },
            { name: 'New Zealand', flag: '🇳🇿' }, { name: 'Nigeria', flag: '🇳🇬' }, { name: 'Norway', flag: '🇳🇴' },
            { name: 'Oman', flag: '🇴🇲' }, { name: 'Pakistan', flag: '🇵🇰' }, { name: 'Palestine', flag: '🇵🇸' },
            { name: 'Philippines', flag: '🇵🇭' }, { name: 'Poland', flag: '🇵🇱' }, { name: 'Portugal', flag: '🇵🇹' },
            { name: 'Qatar', flag: '🇶🇦' }, { name: 'Russia', flag: '🇷🇺' }, { name: 'Saudi Arabia', flag: '🇸🇦' },
            { name: 'South Korea', flag: '🇰🇷' }, { name: 'Spain', flag: '🇪🇸' }, { name: 'Sudan', flag: '🇸🇩' },
            { name: 'Sweden', flag: '🇸🇪' }, { name: 'Switzerland', flag: '🇨🇭' }, { name: 'Syria', flag: '🇸🇾' },
            { name: 'Thailand', flag: '🇹🇭' }, { name: 'Tunisia', flag: '🇹🇳' }, { name: 'Turkey', flag: '🇹🇷' },
            { name: 'UAE', flag: '🇦🇪' }, { name: 'Ukraine', flag: '🇺🇦' }, { name: 'United Kingdom', flag: '🇬🇧' },
            { name: 'United States', flag: '🇺🇸' }, { name: 'Yemen', flag: '🇾🇪' }
          ];
          var match = allCountries.find(function(c) { return c.name === formData.country; });
          if (match) formData.flag = match.flag;
        }
        break;
      case 7:
        if (formData.job_name) {
          const job = window.AmepleData.jobs.find(function(j) { return j.title === formData.job_name; });
          if (job) {
            formData.job_emoji = job.emoji;
            formData.job_category = job.category;
            formData.job_type = job.type;
          }
        }
        break;
      case 10:
        // Games are kept in formData.favorite_games
        break;
      case 11:
        if (nativeLangSelect) {
          formData.native_language = nativeLangSelect.getValue();
        }
        if (additionalLangSelect) {
          var val = additionalLangSelect.getValue();
          // Tom Select returns array for multi-select, string for single
          if (Array.isArray(val)) {
            formData.additional_languages = val.filter(Boolean);
          } else {
            formData.additional_languages = val ? val.split(',').filter(Boolean) : [];
          }
        }
        // Build languages array
        formData.languages = [];
        if (formData.native_language) {
          const lang = window.AmepleData.languages.find(function(l) { return l.name === formData.native_language; });
          formData.languages.push({ name: formData.native_language, flag: lang ? lang.flag : '', native: true });
        }
        if (formData.additional_languages) {
          formData.additional_languages.forEach(function(name) {
            const lang = window.AmepleData.languages.find(function(l) { return l.name === name; });
            formData.languages.push({ name: name, flag: lang ? lang.flag : '', native: false });
          });
        }
        break;
    }
  }

  // --- Geocode city synchronously (used in completeOnboarding) ---
  async function geocodeCityCoords(city, country) {
    if (!city || !country) return null;
    try {
      const query = encodeURIComponent(city + ', ' + country);
      const res = await fetch(
        'https://nominatim.openstreetmap.org/search?q=' + query + '&format=json&limit=1',
        { headers: { 'Accept-Language': 'en' } }
      );
      const results = await res.json();
      if (results && results.length > 0) {
        const geoLat = parseFloat(results[0].lat);
        const geoLon = parseFloat(results[0].lon);
        // Validate: must be within 12 degrees of country center
        const countryCenter = window.AmepleCountryCoords && window.AmepleCountryCoords[country];
        if (countryCenter) {
          const tooFar = Math.abs(geoLat - countryCenter.lat) > 12 ||
                         Math.abs(geoLon - countryCenter.lon) > 12;
          if (tooFar) return null;
        }
        const offset = (Math.random() - 0.5) * 0.04;
        return { lat: geoLat + offset, lon: geoLon + offset };
      }
    } catch (e) { /* silent fail */ }
    return null;
  }

  // --- Complete Onboarding ---
  async function completeOnboarding() {
    collectStepData(currentStep);

    // Resolve coordinates: geocode city first (await), then fall back to country center
    if (formData.city && formData.country && (!formData.latitude || !formData.longitude)) {
      const coords = await geocodeCityCoords(formData.city, formData.country);
      if (coords) {
        formData.latitude  = coords.lat;
        formData.longitude = coords.lon;
      }
    }
    // Final fallback: country center
    if ((!formData.latitude || !formData.longitude) && formData.country &&
        window.AmepleCountryCoords && window.AmepleCountryCoords[formData.country]) {
      formData.latitude  = window.AmepleCountryCoords[formData.country].lat;
      formData.longitude = window.AmepleCountryCoords[formData.country].lon;
    }

    // Build user data
    const userData = {
      first_name: formData.first_name,
      last_name: formData.last_name,
      date_of_birth: formData.date_of_birth,
      age: formData.age,
      gender: formData.gender,
      country: formData.country,
      city: formData.city || null,
      flag: formData.flag || '',
      latitude: formData.latitude || 0,
      longitude: formData.longitude || 0,
      avatar_url: formData.avatar_url || 'assets/default-avatar.svg',
      job_name: formData.job_name,
      job_emoji: formData.job_emoji,
      job_category: formData.job_category,
      job_type: formData.job_type,
      jobs: formData.job_name ? [formData.job_name] : [],
      skills: formData.skills || [],
      hobbies: formData.hobbies || [],
      languages: formData.languages || [],
      social_links: formData.social_links || {},
      favorite_games: formData.favorite_games || []
    };

    // Wait for Supabase to be ready
    if (window.AmepleSupabaseReady) {
      await window.AmepleSupabaseReady;
    }

    if (isOAuthCompleteProfile) {
      // OAuth user: already authenticated, just update their profile
      try {
        await window.AmepleAuth.updateUser(userData);
      } catch (e) {
        notyf.error('Failed to save profile. Please try again.');
        isTransitioning = false;
        return;
      }
    } else {
      // Email/password user: sign up (creates auth user + inserts profile)
      const { user, error } = await window.AmepleAuth.signUp(
        formData.email,
        formData.password,
        userData
      );

      if (error) {
        notyf.error(error.message || 'Sign up failed');
        isTransitioning = false;
        return;
      }
    }

    // Clear onboarding data
    window.AmepleAuth.clearOnboardingData();

    // Redirect using Epic Animation
    notyf.success('Welcome to Ameple!');
    triggerEpicEntry();
    setTimeout(function() {
      // Find the overlay and add exit-mode class
      const overlay = document.querySelector('.epic-entry-overlay');
      if(overlay) overlay.classList.add('exit-mode');
      
      // Wait for exit animation to finish before redirecting
      setTimeout(function() {
        window.location.href = 'globe.html';
      }, 800);
    }, 2800);
  }

  function triggerEpicEntry() {
    // Hide completion card gently
    const card = document.querySelector('.onboarding-card');
    if (card) {
      card.style.transition = 'all 0.4s cubic-bezier(0.55, 0.085, 0.68, 0.53)';
      card.style.transform = 'scale(0.8) translateY(20px)';
      card.style.opacity = '0';
    }

    // 1. Create overlay portal
    const overlay = document.createElement('div');
    overlay.className = 'epic-entry-overlay';
    document.body.appendChild(overlay);

    // 3. Fire explosion of user profiles!
    const names = ['Sarah M.', 'Alex D.', 'Mohamed K.', 'Elena R.', 'Omar S.', 'Lisa W.', 'David B.'];
    const avatars = [
      'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah&backgroundColor=b6e3f4',
      'https://api.dicebear.com/7.x/avataaars/svg?seed=Alex&backgroundColor=c0aede',
      'https://api.dicebear.com/7.x/avataaars/svg?seed=Mohamed&backgroundColor=ffdfbf',
      'https://api.dicebear.com/7.x/avataaars/svg?seed=Elena&backgroundColor=d1d4f9',
      'https://api.dicebear.com/7.x/avataaars/svg?seed=Omar&backgroundColor=b6e3f4'
    ];
    
    for(let i=0; i<30; i++) {
       const userCard = document.createElement('div');
       userCard.className = 'epic-profile-card';
       
       const img = document.createElement('img');
       img.src = avatars[i % avatars.length];
       
       const name = document.createElement('span');
       name.textContent = names[i % names.length];
       
       userCard.appendChild(img);
       userCard.appendChild(name);
       
       // Start from center
       userCard.style.left = (50 + (Math.random() - 0.5) * 10) + '%';
       userCard.style.top = (50 + (Math.random() - 0.5) * 10) + '%';
       
       // Calculate random trajectory out of the center
       const angle = Math.random() * Math.PI * 2;
       const distance = 400 + Math.random() * 800; // far away
       const tx = Math.cos(angle) * distance; 
       const ty = Math.sin(angle) * distance;
       
       const r = (Math.random() - 0.5) * 180; // slight rotation
       const s = 0.5 + Math.random() * 1; // Different scaler
       
       userCard.style.setProperty('--tx', tx + 'px');
       userCard.style.setProperty('--ty', ty + 'px');
       userCard.style.setProperty('--r', r + 'deg');
       userCard.style.setProperty('--s', s);
       
       // Stagger the animation start times slightly
       userCard.style.animationDelay = (Math.random() * 0.4) + 's';
       
       overlay.appendChild(userCard);
    }
    
    // 2. Create Welcome Text (after profiles so it stays on top)
    const text = document.createElement('h1');
    text.className = 'epic-welcome-text';
    text.innerHTML = `Welcome to Ameple! 🌍`;
    overlay.appendChild(text);
    
    if (window.AmepleEmoji) window.AmepleEmoji.parse(overlay);
  }
})();
