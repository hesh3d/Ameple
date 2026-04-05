// Orbiit — Onboarding Wizard Logic
// 12-step wizard with validation, transitions, and data collection

(function() {
  const TOTAL_STEPS = 12;
  let currentStep = 1;
  let formData = {};
  let notyf;

  // --- Initialize ---
  document.addEventListener('DOMContentLoaded', function() {
    // Load saved data
    formData = window.OrbiitAuth.loadOnboardingData();

    // Check if already completed onboarding
    if (window.OrbiitAuth.isLoggedIn()) {
      window.location.href = 'globe.html';
      return;
    }

    // Init Notyf
    notyf = new Notyf({
      duration: 3000,
      position: { x: 'right', y: 'top' },
      types: [
        { type: 'success', background: '#10B981' },
        { type: 'error', background: '#EF4444' }
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
    if (!validateStep(currentStep)) return;
    collectStepData(currentStep);
    window.OrbiitAuth.saveOnboardingData(formData);

    if (currentStep === TOTAL_STEPS) {
      completeOnboarding();
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
    }, 250);
  }

  function prevStep() {
    if (currentStep <= 1) return;
    collectStepData(currentStep);

    const oldStep = document.getElementById('step-' + currentStep);
    oldStep.classList.remove('active');
    currentStep--;
    initStep(currentStep);
    updateProgressBar();
    updateNavButtons();
  }

  function initStep(step) {
    const el = document.getElementById('step-' + step);
    el.classList.add('active');
    el.style.animation = 'none';
    el.offsetHeight; // reflow
    el.style.animation = '';

    // Step-specific init
    if (step === 4) initDatePicker();
    if (step === 5) initCountrySelect();
    if (step === 7) initJobSelect();
    if (step === 8) initSkillsGrid();
    if (step === 9) initHobbiesGrid();
    if (step === 10) initLanguageSelects();
    if (step === 12) initCompletionStep();
  }

  function updateProgressBar() {
    const fill = document.getElementById('progress-fill');
    fill.style.width = ((currentStep / TOTAL_STEPS) * 100) + '%';
  }

  function updateNavButtons() {
    const backBtn = document.getElementById('btn-back');
    const nextBtn = document.getElementById('btn-next');

    backBtn.classList.toggle('hidden', currentStep === 1);

    if (currentStep === 1) {
      nextBtn.style.display = 'none'; // Welcome uses its own button
    } else if (currentStep === TOTAL_STEPS) {
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

    // Password toggle
    document.querySelectorAll('.password-toggle').forEach(function(toggle) {
      toggle.addEventListener('click', function() {
        const input = this.previousElementSibling;
        if (input.type === 'password') {
          input.type = 'text';
          this.textContent = '🙈';
        } else {
          input.type = 'password';
          this.textContent = '👁️';
        }
      });
    });

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
      }
      notyf.success('Photo uploaded!');
    };
    reader.readAsDataURL(file);
  }

  // --- Tom Select Initializations ---
  let countrySelect, jobSelect, nativeLangSelect, additionalLangSelect;

  function initCountrySelect() {
    if (countrySelect) return;
    const el = document.getElementById('select-country');
    if (!el || el.tomselect) return;

    const countries = [
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

    countrySelect = new TomSelect(el, {
      options: countries.map(function(c) {
        return { value: c.name, text: c.flag + ' ' + c.name, flag: c.flag };
      }),
      placeholder: 'Search your country...',
      maxItems: 1,
      render: {
        option: function(data, escape) {
          // Use flagToImg() for 100% reliable colored flag images on all platforms (inc. Windows)
          var flagImg = (window.OrbiitEmoji && window.OrbiitEmoji.flagToImg)
            ? window.OrbiitEmoji.flagToImg((data && data.flag) || data || '') // Fallback for various TomSelect formats
            : '';
          return '<div class="option">' + flagImg + escape(data.value) + '</div>';
        },
        item: function(data, escape) {
          var flagImg = (window.OrbiitEmoji && window.OrbiitEmoji.flagToImg)
            ? window.OrbiitEmoji.flagToImg((data && data.flag) || data || '') // Fallback for various TomSelect formats
            : '';
          return '<div>' + flagImg + escape(data.value) + '</div>';
        }
      },
      onInitialize: function() {
      },
      onDropdownOpen: function(dropdown) {
        if (window.OrbiitEmoji) window.OrbiitEmoji.parse(dropdown);
        // Parse emojis inside dropdown as soon as it opens
      },
      onType: function() {
        var self = this;
        setTimeout(function() {
        }, 50);
      },
      onItemAdd: function() {
        if (window.OrbiitEmoji) window.OrbiitEmoji.parse(this.control);
      }
    });

    if (formData.country) countrySelect.setValue(formData.country);
  }

  function initJobSelect() {
    if (jobSelect) return;
    const el = document.getElementById('select-job');
    if (!el || el.tomselect) return;

    const jobs = window.OrbiitData.jobs;
    jobSelect = new TomSelect(el, {
      options: jobs.map(function(j) {
        return {
          value: j.title,
          text: j.emoji + ' ' + j.title + ' — ' + j.category + ' · ' + j.type,
          category: j.category
        };
      }),
      placeholder: 'Search your job...',
      maxItems: 1,
      optgroups: window.OrbiitData.jobCategories.map(function(c) {
        return { value: c, label: c };
      }),
      optgroupField: 'category',
      render: {
        option: function(data, escape) {
          return '<div class="option">' + data.text + '</div>';
        },
        item: function(data, escape) {
          return '<div>' + data.text + '</div>';
        }
      },
      onDropdownOpen: function(dropdown) {
        if (window.OrbiitEmoji) window.OrbiitEmoji.parse(dropdown);
      },
      onType: function() {
        var self = this;
        setTimeout(function() {
        }, 50);
      },
      onItemAdd: function() {
        if (window.OrbiitEmoji) window.OrbiitEmoji.parse(this.control);
      }
    });

    if (formData.job_name) jobSelect.setValue(formData.job_name);
  }

  function initLanguageSelects() {
    if (nativeLangSelect) return;
    const nativeEl = document.getElementById('select-native-lang');
    const additionalEl = document.getElementById('select-additional-langs');
    if (!nativeEl || nativeEl.tomselect) return;

    const langs = window.OrbiitData.languages;
    const langOptions = langs.map(function(l) {
      return { value: l.name, text: l.flag + ' ' + l.name, flag: l.flag };
    });

    var langRender = {
      option: function(data, escape) {
        var flagImg = (window.OrbiitEmoji && window.OrbiitEmoji.flagToImg)
            ? window.OrbiitEmoji.flagToImg((data && data.flag) || data || '') // Fallback for various TomSelect formats
            : '';
        return '<div class="option">' + flagImg + escape(data.value) + '</div>';
      },
      item: function(data, escape) {
        var flagImg = (window.OrbiitEmoji && window.OrbiitEmoji.flagToImg)
            ? window.OrbiitEmoji.flagToImg((data && data.flag) || data || '') // Fallback for various TomSelect formats
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
        if (window.OrbiitEmoji) window.OrbiitEmoji.parse(dropdown);
      },
      onType: function() {
        var self = this;
        setTimeout(function() {
        }, 50);
      },
      onItemAdd: function() {
        if (window.OrbiitEmoji) window.OrbiitEmoji.parse(this.control);
      }
    });

    additionalLangSelect = new TomSelect(additionalEl, {
      options: langOptions,
      placeholder: 'Select additional languages...',
      maxItems: 10,
      render: langRender,
      onDropdownOpen: function(dropdown) {
        if (window.OrbiitEmoji) window.OrbiitEmoji.parse(dropdown);
      },
      onType: function() {
        var self = this;
        setTimeout(function() {
        }, 50);
      },
      onItemAdd: function() {
        if (window.OrbiitEmoji) window.OrbiitEmoji.parse(this.control);
      }
    });

    if (formData.native_language) nativeLangSelect.setValue(formData.native_language);
    if (formData.additional_languages) {
      formData.additional_languages.forEach(function(l) {
        additionalLangSelect.addItem(l);
      });
    }
  }

  // --- Flatpickr ---
  let dobPicker;
  function initDatePicker() {
    if (dobPicker) return;
    const el = document.getElementById('input-dob');
    if (!el) return;

    dobPicker = flatpickr(el, {
      dateFormat: 'Y-m-d',
      maxDate: new Date(new Date().setFullYear(new Date().getFullYear() - 16)),
      defaultDate: formData.date_of_birth || null,
      onChange: function(selectedDates) {
        if (selectedDates[0]) {
          const age = calculateAge(selectedDates[0]);
          const ageDisplay = document.getElementById('age-display');
          if (ageDisplay) {
            ageDisplay.style.display = 'block';
            ageDisplay.textContent = '🎂 You are ' + age + ' years old';
          }
          formData.date_of_birth = selectedDates[0].toISOString().split('T')[0];
          formData.age = age;
        }
      }
    });
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
  function initSkillsGrid() {
    selectedSkills = formData.skills || [];
    const grid = document.getElementById('skills-grid');
    const tabs = document.getElementById('skills-tabs');
    const search = document.getElementById('skills-search');
    const counter = document.getElementById('skills-counter');
    if (!grid) return;

    const categories = window.OrbiitData.skillCategories;
    const skills = window.OrbiitData.skills;

    // Render tabs
    if (tabs && !tabs.dataset.initialized) {
      tabs.dataset.initialized = 'true';
      let tabsHtml = '<button class="category-tab active" data-cat="all">All</button>';
      categories.forEach(function(cat) {
        const emoji = skills.find(function(s) { return s.category === cat; }).emoji;
        tabsHtml += '<button class="category-tab" data-cat="' + cat + '">' + emoji + ' ' + cat + '</button>';
      });
      tabs.innerHTML = tabsHtml;

      tabs.addEventListener('click', function(e) {
        if (!e.target.classList.contains('category-tab')) return;
        tabs.querySelectorAll('.category-tab').forEach(function(t) { t.classList.remove('active'); });
        e.target.classList.add('active');
        renderSkills(e.target.dataset.cat, search ? search.value : '');
      });
    }

    // Search
    if (search && !search.dataset.initialized) {
      search.dataset.initialized = 'true';
      search.addEventListener('input', function() {
        const activeCat = tabs.querySelector('.category-tab.active').dataset.cat;
        renderSkills(activeCat, this.value);
      });
    }

    renderSkills('all', '');

    function renderSkills(category, query) {
      let filtered = skills;
      if (category !== 'all') filtered = filtered.filter(function(s) { return s.category === category; });
      if (query) {
        const q = query.toLowerCase();
        filtered = filtered.filter(function(s) { return s.name.toLowerCase().includes(q); });
      }

      grid.innerHTML = filtered.map(function(skill) {
        const isSelected = selectedSkills.includes(skill.name);
        return '<div class="chip' + (isSelected ? ' selected' : '') + '" data-skill="' + skill.name + '">'
          + skill.emoji + ' ' + skill.name + '</div>';
      }).join('');

      grid.querySelectorAll('.chip').forEach(function(chip) {
        chip.addEventListener('click', function() {
          const name = this.dataset.skill;
          if (selectedSkills.includes(name)) {
            selectedSkills = selectedSkills.filter(function(s) { return s !== name; });
            this.classList.remove('selected');
          } else if (selectedSkills.length < 10) {
            selectedSkills.push(name);
            this.classList.add('selected');
          } else {
            notyf.error('Maximum 10 skills allowed');
          }
          formData.skills = selectedSkills;
          if (counter) counter.innerHTML = '<span class="count">' + selectedSkills.length + '</span> / 10 selected (min 3)';
        });
      });

      if (counter) counter.innerHTML = '<span class="count">' + selectedSkills.length + '</span> / 10 selected (min 3)';
    }
  }

  // --- Hobbies Grid ---
  let selectedHobbies = [];
  function initHobbiesGrid() {
    selectedHobbies = formData.hobbies || [];
    const grid = document.getElementById('hobbies-grid');
    const tabs = document.getElementById('hobbies-tabs');
    const counter = document.getElementById('hobbies-counter');
    if (!grid) return;

    const categories = window.OrbiitData.hobbyCategories;
    const hobbies = window.OrbiitData.hobbies;

    if (tabs && !tabs.dataset.initialized) {
      tabs.dataset.initialized = 'true';
      let tabsHtml = '<button class="category-tab active" data-cat="all">All</button>';
      categories.forEach(function(cat) {
        const emoji = hobbies.find(function(h) { return h.category === cat; }).emoji;
        tabsHtml += '<button class="category-tab" data-cat="' + cat + '">' + emoji + ' ' + cat + '</button>';
      });
      tabs.innerHTML = tabsHtml;

      tabs.addEventListener('click', function(e) {
        if (!e.target.classList.contains('category-tab')) return;
        tabs.querySelectorAll('.category-tab').forEach(function(t) { t.classList.remove('active'); });
        e.target.classList.add('active');
        renderHobbies(e.target.dataset.cat);
      });
    }

    renderHobbies('all');

    function renderHobbies(category) {
      let filtered = hobbies;
      if (category !== 'all') filtered = filtered.filter(function(h) { return h.category === category; });

      grid.innerHTML = filtered.map(function(hobby) {
        const key = hobby.emoji + ' ' + hobby.name;
        const isSelected = selectedHobbies.includes(key);
        return '<div class="hobby-card' + (isSelected ? ' selected' : '') + '" data-hobby="' + key + '">'
          + '<span class="hobby-emoji">' + hobby.emoji + '</span>'
          + '<span class="hobby-name">' + hobby.name + '</span>'
          + '</div>';
      }).join('');

      grid.querySelectorAll('.hobby-card').forEach(function(card) {
        card.addEventListener('click', function() {
          const name = this.dataset.hobby;
          if (selectedHobbies.includes(name)) {
            selectedHobbies = selectedHobbies.filter(function(h) { return h !== name; });
            this.classList.remove('selected');
          } else if (selectedHobbies.length < 8) {
            selectedHobbies.push(name);
            this.classList.add('selected');
          } else {
            notyf.error('Maximum 8 hobbies allowed');
          }
          formData.hobbies = selectedHobbies;
          if (counter) counter.innerHTML = '<span class="count">' + selectedHobbies.length + '</span> / 8 selected (min 1)';
        });
      });

      if (counter) counter.innerHTML = '<span class="count">' + selectedHobbies.length + '</span> / 8 selected (min 1)';
    }
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
      const job = window.OrbiitData.jobs.find(function(j) { return j.title === formData.job_name; });
      previewJob.textContent = (job ? job.emoji + ' ' : '') + (formData.job_name || 'Not specified');
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

  // --- Validation ---
  function validateStep(step) {
    switch(step) {
      case 1: return true;

      case 2:
        const fn = document.getElementById('input-firstname').value.trim();
        const ln = document.getElementById('input-lastname').value.trim();
        if (!fn) { notyf.error('Please enter your first name'); return false; }
        if (!ln) { notyf.error('Please enter your last name'); return false; }
        if (/[0-9<>{}[\]\\\/]/.test(fn)) { notyf.error('First name contains invalid characters'); return false; }
        if (/[0-9<>{}[\]\\\/]/.test(ln)) { notyf.error('Last name contains invalid characters'); return false; }
        return true;

      case 3:
        const email = document.getElementById('input-email').value.trim();
        const pass = document.getElementById('input-password').value;
        const confirm = document.getElementById('input-password-confirm').value;
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { notyf.error('Please enter a valid email'); return false; }
        if (pass.length < 6) { notyf.error('Password must be at least 6 characters'); return false; }
        if (pass !== confirm) { notyf.error('Passwords do not match'); return false; }
        return true;

      case 4:
        if (!formData.date_of_birth) { notyf.error('Please select your date of birth'); return false; }
        if (!formData.gender) { notyf.error('Please select your gender'); return false; }
        return true;

      case 5:
        if (!countrySelect || !countrySelect.getValue()) { notyf.error('Please select your country'); return false; }
        return true;

      case 6: return true; // Photo is optional

      case 7:
        if (!jobSelect || !jobSelect.getValue()) { notyf.error('Please select your job'); return false; }
        return true;

      case 8:
        if (!selectedSkills || selectedSkills.length < 3) { notyf.error('Please select at least 3 skills'); return false; }
        return true;

      case 9:
        if (!selectedHobbies || selectedHobbies.length < 1) { notyf.error('Please select at least 1 hobby'); return false; }
        return true;

      case 10:
        if (!nativeLangSelect || !nativeLangSelect.getValue()) { notyf.error('Please select your native language'); return false; }
        return true;

      case 11: return true; // Social links optional
      case 12: return true;
      default: return true;
    }
  }

  // --- Data Collection ---
  function collectStepData(step) {
    switch(step) {
      case 2:
        formData.first_name = document.getElementById('input-firstname').value.trim();
        formData.last_name = document.getElementById('input-lastname').value.trim();
        break;
      case 3:
        formData.email = document.getElementById('input-email').value.trim();
        formData.password = document.getElementById('input-password').value;
        break;
      case 5:
        if (countrySelect) {
          formData.country = countrySelect.getValue();
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
        if (jobSelect) {
          formData.job_name = jobSelect.getValue();
          const job = window.OrbiitData.jobs.find(function(j) { return j.title === formData.job_name; });
          if (job) {
            formData.job_emoji = job.emoji;
            formData.job_category = job.category;
            formData.job_type = job.type;
          }
        }
        break;
      case 10:
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
          const lang = window.OrbiitData.languages.find(function(l) { return l.name === formData.native_language; });
          formData.languages.push({ name: formData.native_language, flag: lang ? lang.flag : '', native: true });
        }
        if (formData.additional_languages) {
          formData.additional_languages.forEach(function(name) {
            const lang = window.OrbiitData.languages.find(function(l) { return l.name === name; });
            formData.languages.push({ name: name, flag: lang ? lang.flag : '', native: false });
          });
        }
        break;
    }
  }

  // --- Complete Onboarding ---
  async function completeOnboarding() {
    collectStepData(currentStep);

    // Build user data
    const userData = {
      first_name: formData.first_name,
      last_name: formData.last_name,
      date_of_birth: formData.date_of_birth,
      age: formData.age,
      gender: formData.gender,
      country: formData.country,
      flag: formData.flag || '',
      latitude: formData.latitude || 0,
      longitude: formData.longitude || 0,
      avatar_url: formData.avatar_url || 'assets/default-avatar.svg',
      current_job: formData.job_name,
      job_name: formData.job_name,
      job_emoji: formData.job_emoji,
      job_category: formData.job_category,
      job_type: formData.job_type,
      skills: formData.skills || [],
      hobbies: formData.hobbies || [],
      languages: formData.languages || [],
      social_links: formData.social_links || {}
    };

    // Sign up
    const { user, error } = await window.OrbiitAuth.signUp(
      formData.email,
      formData.password,
      userData
    );

    if (error) {
      notyf.error(error.message || 'Sign up failed');
      return;
    }

    // Clear onboarding data
    window.OrbiitAuth.clearOnboardingData();

    // Redirect to globe
    notyf.success('Welcome to Orbiit!');
    setTimeout(function() {
      window.location.href = 'globe.html';
    }, 1500);
  }
})();
