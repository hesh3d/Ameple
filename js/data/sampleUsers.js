// Orbiit — Sample Users Data
// Namespace: window.OrbiitData.sampleUsers

(function() {
  window.OrbiitData = window.OrbiitData || {};

  window.OrbiitData.sampleUsers = [
    // === ARAB COUNTRIES (18) ===
    {
      id: 'usr-jo-001', first_name: 'Omar', last_name: 'Haddad',
      country: 'Jordan', flag: '🇯🇴', latitude: 31.9454, longitude: 35.9284,
      avatar_url: 'https://i.pravatar.cc/150?img=11',
      job_name: 'Full Stack Developer', job_emoji: '💻', job_category: 'Tech', job_type: 'Full-time',
      skills: ['Coding & Programming', 'Systems Integration', 'Problem Solving', 'Task Automation'],
      hobbies: ['🎮 Video Games', '☕ Coffee Making', '🏃 Running'],
      languages: [{ name: 'Arabic', flag: '🇸🇦', native: true }, { name: 'English', flag: '🇬🇧', native: false }],
      age: 26, gender: 'Male', is_online: true, last_seen: null,
      average_rating: 4.9, total_ratings: 31, current_status: '💻 Deep working',
      social_links: { linkedin: 'https://linkedin.com/in/omarhaddad', instagram: 'https://instagram.com/omar.dev' }
    },
    {
      id: 'usr-eg-001', first_name: 'Nour', last_name: 'El-Sayed',
      country: 'Egypt', flag: '🇪🇬', latitude: 30.0444, longitude: 31.2357,
      avatar_url: 'https://i.pravatar.cc/150?img=32',
      job_name: 'Graphic Designer', job_emoji: '🎨', job_category: 'Creative', job_type: 'Freelance',
      skills: ['Visual Design', 'Creative Direction', 'Color Grading', 'Photography'],
      hobbies: ['🎨 Drawing/Painting', '📷 Photography', '✈️ Traveling'],
      languages: [{ name: 'Arabic', flag: '🇸🇦', native: true }, { name: 'English', flag: '🇬🇧', native: false }, { name: 'French', flag: '🇫🇷', native: false }],
      age: 24, gender: 'Female', is_online: true, last_seen: null,
      average_rating: 4.7, total_ratings: 18, current_status: '🎵 Listening to music',
      social_links: { instagram: 'https://instagram.com/nour.designs', linkedin: 'https://linkedin.com/in/nourelsayed' }
    },
    {
      id: 'usr-sa-001', first_name: 'Ahmad', last_name: 'Al-Rashidi',
      country: 'Saudi Arabia', flag: '🇸🇦', latitude: 24.7136, longitude: 46.6753,
      avatar_url: 'https://i.pravatar.cc/150?img=3',
      job_name: 'Video Editor', job_emoji: '✂️', job_category: 'Creative', job_type: 'Freelance',
      skills: ['Video Editing', 'Color Grading', 'Storytelling', 'Motion Design'],
      hobbies: ['🎬 Filmmaking', '📷 Photography', '🎵 Vinyl Records'],
      languages: [{ name: 'Arabic', flag: '🇸🇦', native: true }, { name: 'English', flag: '🇬🇧', native: false }],
      age: 27, gender: 'Male', is_online: true, last_seen: null,
      average_rating: 4.8, total_ratings: 24, current_status: '💻 Deep working',
      social_links: { instagram: 'https://instagram.com/ahmad.edits', linkedin: 'https://linkedin.com/in/ahmadrashidi' }
    },
    {
      id: 'usr-ae-001', first_name: 'Fatima', last_name: 'Al-Mansoori',
      country: 'UAE', flag: '🇦🇪', latitude: 25.2048, longitude: 55.2708,
      avatar_url: 'https://i.pravatar.cc/150?img=44',
      job_name: 'Marketing Manager', job_emoji: '📣', job_category: 'Marketing', job_type: 'Full-time',
      skills: ['Digital Marketing', 'SEO', 'Personal Branding', 'Building Marketing Funnels'],
      hobbies: ['✈️ Traveling', '📚 Reading', '🧘 Yoga'],
      languages: [{ name: 'Arabic', flag: '🇸🇦', native: true }, { name: 'English', flag: '🇬🇧', native: false }, { name: 'French', flag: '🇫🇷', native: false }],
      age: 29, gender: 'Female', is_online: false, last_seen: '2026-04-04T14:30:00Z',
      average_rating: 4.6, total_ratings: 15, current_status: '📚 Studying',
      social_links: { linkedin: 'https://linkedin.com/in/fatimaalmansoori' }
    },
    {
      id: 'usr-ma-001', first_name: 'Yassine', last_name: 'Benali',
      country: 'Morocco', flag: '🇲🇦', latitude: 33.9716, longitude: -6.8498,
      avatar_url: 'https://i.pravatar.cc/150?img=12',
      job_name: 'UI/UX Designer', job_emoji: '🖌️', job_category: 'Creative', job_type: 'Freelance',
      skills: ['UX Design', 'Visual Design', 'Creative Thinking', 'Rapid Prototyping'],
      hobbies: ['⚽ Football/Soccer', '🎸 Playing Music', '☕ Coffee Making'],
      languages: [{ name: 'Arabic', flag: '🇸🇦', native: true }, { name: 'French', flag: '🇫🇷', native: false }, { name: 'English', flag: '🇬🇧', native: false }],
      age: 25, gender: 'Male', is_online: true, last_seen: null,
      average_rating: 4.5, total_ratings: 12, current_status: '☕ Having coffee',
      social_links: { instagram: 'https://instagram.com/yassine.ux' }
    },
    {
      id: 'usr-iq-001', first_name: 'Zainab', last_name: 'Al-Zubaidi',
      country: 'Iraq', flag: '🇮🇶', latitude: 33.3152, longitude: 44.3661,
      avatar_url: 'https://i.pravatar.cc/150?img=45',
      job_name: 'Pharmacist', job_emoji: '💊', job_category: 'Health', job_type: 'Full-time',
      skills: ['Research & Information Extraction', 'Data Analysis', 'Clear Written Communication'],
      hobbies: ['📚 Reading', '🧘 Meditation', '🍳 Cooking'],
      languages: [{ name: 'Arabic', flag: '🇸🇦', native: true }, { name: 'English', flag: '🇬🇧', native: false }],
      age: 30, gender: 'Female', is_online: false, last_seen: '2026-04-04T10:00:00Z',
      average_rating: 4.9, total_ratings: 8, current_status: '😴 Taking a break',
      social_links: {}
    },
    {
      id: 'usr-tn-001', first_name: 'Amine', last_name: 'Trabelsi',
      country: 'Tunisia', flag: '🇹🇳', latitude: 36.8065, longitude: 10.1815,
      avatar_url: 'https://i.pravatar.cc/150?img=14',
      job_name: 'Data Scientist', job_emoji: '📊', job_category: 'Tech', job_type: 'Full-time',
      skills: ['Data Analysis', 'Data Visualization', 'Coding & Programming', 'Interpreting Numbers'],
      hobbies: ['♟️ Chess', '🏃 Running', '📖 Reading Non-Fiction'],
      languages: [{ name: 'Arabic', flag: '🇸🇦', native: true }, { name: 'French', flag: '🇫🇷', native: false }, { name: 'English', flag: '🇬🇧', native: false }],
      age: 28, gender: 'Male', is_online: true, last_seen: null,
      average_rating: 4.4, total_ratings: 10, current_status: '💻 Deep working',
      social_links: { linkedin: 'https://linkedin.com/in/aminetrabelsi' }
    },
    {
      id: 'usr-lb-001', first_name: 'Lara', last_name: 'Khoury',
      country: 'Lebanon', flag: '🇱🇧', latitude: 33.8938, longitude: 35.5018,
      avatar_url: 'https://i.pravatar.cc/150?img=47',
      job_name: 'Content Writer', job_emoji: '✍️', job_category: 'Content', job_type: 'Freelance',
      skills: ['Storytelling', 'Content Writing', 'Copywriting', 'Editing & Proofreading'],
      hobbies: ['✍️ Creative Writing', '📷 Photography', '🍳 Cooking'],
      languages: [{ name: 'Arabic', flag: '🇸🇦', native: true }, { name: 'English', flag: '🇬🇧', native: false }, { name: 'French', flag: '🇫🇷', native: false }],
      age: 26, gender: 'Female', is_online: true, last_seen: null,
      average_rating: 4.8, total_ratings: 22, current_status: '💬 Open to chat',
      social_links: { instagram: 'https://instagram.com/lara.writes', twitter: 'https://x.com/larakhoury' }
    },
    {
      id: 'usr-ps-001', first_name: 'Khalil', last_name: 'Nassar',
      country: 'Palestine', flag: '🇵🇸', latitude: 31.9038, longitude: 35.2034,
      avatar_url: 'https://i.pravatar.cc/150?img=15',
      job_name: 'Mobile App Developer', job_emoji: '📲', job_category: 'Tech', job_type: 'Freelance',
      skills: ['Coding & Programming', 'Database Design', 'Quality Assurance', 'Task Automation'],
      hobbies: ['💻 Programming', '🎮 Gaming', '⚽ Football/Soccer'],
      languages: [{ name: 'Arabic', flag: '🇸🇦', native: true }, { name: 'English', flag: '🇬🇧', native: false }],
      age: 24, gender: 'Male', is_online: true, last_seen: null,
      average_rating: 4.7, total_ratings: 14, current_status: '🎮 Gaming',
      social_links: { linkedin: 'https://linkedin.com/in/khalilnassar' }
    },
    {
      id: 'usr-kw-001', first_name: 'Dana', last_name: 'Al-Sabah',
      country: 'Kuwait', flag: '🇰🇼', latitude: 29.3759, longitude: 47.9774,
      avatar_url: 'https://i.pravatar.cc/150?img=48',
      job_name: 'Brand Strategist', job_emoji: '🏷️', job_category: 'Marketing', job_type: 'Full-time',
      skills: ['Personal Branding', 'Strategic Thinking', 'Persuasion', 'Creative Direction'],
      hobbies: ['✈️ Traveling', '🍽️ Restaurant Hopping', '📸 Photography'],
      languages: [{ name: 'Arabic', flag: '🇸🇦', native: true }, { name: 'English', flag: '🇬🇧', native: false }],
      age: 31, gender: 'Female', is_online: false, last_seen: '2026-04-04T12:00:00Z',
      average_rating: 4.3, total_ratings: 9, current_status: '🍳 Cooking',
      social_links: { instagram: 'https://instagram.com/dana.brand' }
    },
    {
      id: 'usr-qa-001', first_name: 'Mohammed', last_name: 'Al-Thani',
      country: 'Qatar', flag: '🇶🇦', latitude: 25.2854, longitude: 51.531,
      avatar_url: 'https://i.pravatar.cc/150?img=17',
      job_name: 'Investment Manager', job_emoji: '💹', job_category: 'Finance & Law', job_type: 'Full-time',
      skills: ['Financial Planning', 'Risk Management', 'Data Analysis', 'Strategic Thinking'],
      hobbies: ['📈 Investing/Trading', '⛳ Golf', '📖 Reading Non-Fiction'],
      languages: [{ name: 'Arabic', flag: '🇸🇦', native: true }, { name: 'English', flag: '🇬🇧', native: false }],
      age: 35, gender: 'Male', is_online: true, last_seen: null,
      average_rating: 4.6, total_ratings: 11, current_status: '💻 Deep working',
      social_links: { linkedin: 'https://linkedin.com/in/mohammedalthani' }
    },
    {
      id: 'usr-bh-001', first_name: 'Sara', last_name: 'Al-Khalifa',
      country: 'Bahrain', flag: '🇧🇭', latitude: 26.0667, longitude: 50.5577,
      avatar_url: 'https://i.pravatar.cc/150?img=49',
      job_name: 'HR Manager', job_emoji: '👔', job_category: 'Business & Ops', job_type: 'Full-time',
      skills: ['Leadership', 'Coaching & Mentoring', 'Emotional Intelligence', 'Conflict Resolution'],
      hobbies: ['📚 Reading', '🧘 Yoga', '🍳 Cooking'],
      languages: [{ name: 'Arabic', flag: '🇸🇦', native: true }, { name: 'English', flag: '🇬🇧', native: false }],
      age: 33, gender: 'Female', is_online: false, last_seen: '2026-04-04T16:00:00Z',
      average_rating: 4.5, total_ratings: 7, current_status: '🏋️ Working out',
      social_links: { linkedin: 'https://linkedin.com/in/saraalkhalifa' }
    },
    {
      id: 'usr-om-001', first_name: 'Said', last_name: 'Al-Busaidi',
      country: 'Oman', flag: '🇴🇲', latitude: 23.588, longitude: 58.3829,
      avatar_url: 'https://i.pravatar.cc/150?img=18',
      job_name: 'Civil Engineer', job_emoji: '🏗️', job_category: 'Engineering', job_type: 'Full-time',
      skills: ['Project Management', 'Estimating Time & Resources', 'Documentation & Organization'],
      hobbies: ['🥾 Hiking', '📷 Photography', '⛺ Camping'],
      languages: [{ name: 'Arabic', flag: '🇸🇦', native: true }, { name: 'English', flag: '🇬🇧', native: false }],
      age: 29, gender: 'Male', is_online: true, last_seen: null,
      average_rating: 4.4, total_ratings: 6, current_status: '☕ Having coffee',
      social_links: {}
    },
    {
      id: 'usr-ly-001', first_name: 'Aisha', last_name: 'Belhaj',
      country: 'Libya', flag: '🇱🇾', latitude: 32.8872, longitude: 13.1802,
      avatar_url: 'https://i.pravatar.cc/150?img=41',
      job_name: 'Teacher', job_emoji: '📚', job_category: 'Education', job_type: 'Full-time',
      skills: ['Teaching & Knowledge Transfer', 'Simplifying Complex Ideas', 'Patience & Long-term Persistence'],
      hobbies: ['📚 Reading', '✍️ Creative Writing', '🎤 Singing'],
      languages: [{ name: 'Arabic', flag: '🇸🇦', native: true }, { name: 'English', flag: '🇬🇧', native: false }],
      age: 28, gender: 'Female', is_online: false, last_seen: '2026-04-03T20:00:00Z',
      average_rating: 4.7, total_ratings: 5, current_status: '📚 Studying',
      social_links: {}
    },
    {
      id: 'usr-sd-001', first_name: 'Hassan', last_name: 'Osman',
      country: 'Sudan', flag: '🇸🇩', latitude: 15.5007, longitude: 32.5599,
      avatar_url: 'https://i.pravatar.cc/150?img=51',
      job_name: 'Journalist', job_emoji: '📰', job_category: 'Content', job_type: 'Full-time',
      skills: ['Storytelling', 'Content Writing', 'Research & Information Extraction', 'Public Speaking'],
      hobbies: ['⚽ Football/Soccer', '📺 Watching Sports', '✈️ Traveling'],
      languages: [{ name: 'Arabic', flag: '🇸🇦', native: true }, { name: 'English', flag: '🇬🇧', native: false }],
      age: 32, gender: 'Male', is_online: true, last_seen: null,
      average_rating: 4.2, total_ratings: 4, current_status: '💬 Open to chat',
      social_links: { twitter: 'https://x.com/hassanosman' }
    },
    {
      id: 'usr-dz-001', first_name: 'Amina', last_name: 'Boudiaf',
      country: 'Algeria', flag: '🇩🇿', latitude: 36.7538, longitude: 3.0588,
      avatar_url: 'https://i.pravatar.cc/150?img=43',
      job_name: 'Psychotherapist', job_emoji: '🧠', job_category: 'Health', job_type: 'Full-time',
      skills: ['Emotional Intelligence', 'Active Listening', 'Empathy', 'Coaching & Mentoring'],
      hobbies: ['🧠 Psychology', '📖 Reading Non-Fiction', '🧘 Meditation'],
      languages: [{ name: 'Arabic', flag: '🇸🇦', native: true }, { name: 'French', flag: '🇫🇷', native: false }, { name: 'English', flag: '🇬🇧', native: false }],
      age: 34, gender: 'Female', is_online: true, last_seen: null,
      average_rating: 4.9, total_ratings: 19, current_status: '💬 Open to chat',
      social_links: { linkedin: 'https://linkedin.com/in/aminaboudiaf' }
    },
    {
      id: 'usr-ye-001', first_name: 'Ali', last_name: 'Al-Hamdi',
      country: 'Yemen', flag: '🇾🇪', latitude: 15.3694, longitude: 44.191,
      avatar_url: 'https://i.pravatar.cc/150?img=52',
      job_name: 'Photographer', job_emoji: '📷', job_category: 'Creative', job_type: 'Freelance',
      skills: ['Photography', 'Visual Design', 'Storytelling', 'Creative Direction'],
      hobbies: ['📷 Photography', '🥾 Hiking', '🔭 Stargazing'],
      languages: [{ name: 'Arabic', flag: '🇸🇦', native: true }, { name: 'English', flag: '🇬🇧', native: false }],
      age: 25, gender: 'Male', is_online: false, last_seen: '2026-04-04T08:00:00Z',
      average_rating: 4.6, total_ratings: 13, current_status: '🚶 Out for a walk',
      social_links: { instagram: 'https://instagram.com/ali.lens' }
    },
    {
      id: 'usr-sy-001', first_name: 'Rania', last_name: 'Darwish',
      country: 'Syria', flag: '🇸🇾', latitude: 33.5138, longitude: 36.2765,
      avatar_url: 'https://i.pravatar.cc/150?img=46',
      job_name: 'Translator', job_emoji: '🌐', job_category: 'Content', job_type: 'Freelance',
      skills: ['Translation', 'Clear Written Communication', 'Content Writing', 'Editing & Proofreading'],
      hobbies: ['🗣️ Learning Languages', '📜 Poetry', '☕ Coffee Making'],
      languages: [{ name: 'Arabic', flag: '🇸🇦', native: true }, { name: 'English', flag: '🇬🇧', native: false }, { name: 'Turkish', flag: '🇹🇷', native: false }],
      age: 27, gender: 'Female', is_online: true, last_seen: null,
      average_rating: 4.8, total_ratings: 16, current_status: '☕ Having coffee',
      social_links: { linkedin: 'https://linkedin.com/in/raniadarwish' }
    },

    // === GLOBAL USERS (10) ===
    {
      id: 'usr-us-001', first_name: 'Jake', last_name: 'Morrison',
      country: 'United States', flag: '🇺🇸', latitude: 37.7749, longitude: -122.4194,
      avatar_url: 'https://i.pravatar.cc/150?img=53',
      job_name: 'AI Engineer', job_emoji: '🤖', job_category: 'Tech', job_type: 'Full-time',
      skills: ['Coding & Programming', 'Systems Integration', 'Data Analysis', 'Task Automation'],
      hobbies: ['🤖 Artificial Intelligence', '🏄 Surfing', '☕ Coffee Making'],
      languages: [{ name: 'English', flag: '🇬🇧', native: true }],
      age: 30, gender: 'Male', is_online: true, last_seen: null,
      average_rating: 4.7, total_ratings: 28, current_status: '💻 Deep working',
      social_links: { linkedin: 'https://linkedin.com/in/jakemorrison', twitter: 'https://x.com/jake_ai' }
    },
    {
      id: 'usr-gb-001', first_name: 'Emma', last_name: 'Clarke',
      country: 'United Kingdom', flag: '🇬🇧', latitude: 51.5074, longitude: -0.1278,
      avatar_url: 'https://i.pravatar.cc/150?img=5',
      job_name: 'Product Manager', job_emoji: '📦', job_category: 'Marketing', job_type: 'Full-time',
      skills: ['Project Management', 'Strategic Thinking', 'Requirements Gathering', 'User Behavior Understanding'],
      hobbies: ['📚 Reading', '🎭 Comics/Manga', '🏃 Running'],
      languages: [{ name: 'English', flag: '🇬🇧', native: true }, { name: 'Spanish', flag: '🇪🇸', native: false }],
      age: 28, gender: 'Female', is_online: true, last_seen: null,
      average_rating: 4.5, total_ratings: 20, current_status: '💬 Open to chat',
      social_links: { linkedin: 'https://linkedin.com/in/emmaclarke' }
    },
    {
      id: 'usr-de-001', first_name: 'Lukas', last_name: 'Schneider',
      country: 'Germany', flag: '🇩🇪', latitude: 52.52, longitude: 13.405,
      avatar_url: 'https://i.pravatar.cc/150?img=54',
      job_name: 'DevOps Engineer', job_emoji: '🔧', job_category: 'Tech', job_type: 'Full-time',
      skills: ['Systems Integration', 'Task Automation', 'Securing Systems & Data', 'Database Design'],
      hobbies: ['🚴 Cycling', '🖥️ Building PCs', '🎲 Board Games'],
      languages: [{ name: 'German', flag: '🇩🇪', native: true }, { name: 'English', flag: '🇬🇧', native: false }],
      age: 32, gender: 'Male', is_online: false, last_seen: '2026-04-04T15:00:00Z',
      average_rating: 4.6, total_ratings: 15, current_status: '🏋️ Working out',
      social_links: { linkedin: 'https://linkedin.com/in/lukasschneider' }
    },
    {
      id: 'usr-jp-001', first_name: 'Yuki', last_name: 'Tanaka',
      country: 'Japan', flag: '🇯🇵', latitude: 35.6762, longitude: 139.6503,
      avatar_url: 'https://i.pravatar.cc/150?img=25',
      job_name: 'Game Developer', job_emoji: '🎮', job_category: 'Tech', job_type: 'Full-time',
      skills: ['Coding & Programming', 'Creative Thinking', 'Visual Design', 'Problem Solving'],
      hobbies: ['🎮 Video Games', '🎬 Filmmaking', '📖 Comics/Manga'],
      languages: [{ name: 'Japanese', flag: '🇯🇵', native: true }, { name: 'English', flag: '🇬🇧', native: false }],
      age: 27, gender: 'Male', is_online: true, last_seen: null,
      average_rating: 4.8, total_ratings: 22, current_status: '🎮 Gaming',
      social_links: { twitter: 'https://x.com/yukitanaka' }
    },
    {
      id: 'usr-br-001', first_name: 'Camila', last_name: 'Santos',
      country: 'Brazil', flag: '🇧🇷', latitude: -23.5505, longitude: -46.6333,
      avatar_url: 'https://i.pravatar.cc/150?img=26',
      job_name: 'Social Media Creator', job_emoji: '📱', job_category: 'Content', job_type: 'Freelance',
      skills: ['Content Writing', 'Personal Branding', 'Photography', 'Video Editing'],
      hobbies: ['💃 Dancing', '📱 Content Creation', '🏖️ Surfing'],
      languages: [{ name: 'Portuguese', flag: '🇵🇹', native: true }, { name: 'English', flag: '🇬🇧', native: false }, { name: 'Spanish', flag: '🇪🇸', native: false }],
      age: 25, gender: 'Female', is_online: true, last_seen: null,
      average_rating: 4.4, total_ratings: 17, current_status: '🎵 Listening to music',
      social_links: { instagram: 'https://instagram.com/camilasantos', tiktok: 'https://tiktok.com/@camilasantos' }
    },
    {
      id: 'usr-in-001', first_name: 'Arjun', last_name: 'Patel',
      country: 'India', flag: '🇮🇳', latitude: 19.076, longitude: 72.8777,
      avatar_url: 'https://i.pravatar.cc/150?img=56',
      job_name: 'Back-End Developer', job_emoji: '⚙️', job_category: 'Tech', job_type: 'Full-time',
      skills: ['Coding & Programming', 'Database Design', 'Systems Integration', 'Quality Assurance'],
      hobbies: ['🏏 Cricket', '♟️ Chess', '📖 Reading Non-Fiction'],
      languages: [{ name: 'Hindi', flag: '🇮🇳', native: true }, { name: 'English', flag: '🇬🇧', native: false }],
      age: 26, gender: 'Male', is_online: false, last_seen: '2026-04-04T11:00:00Z',
      average_rating: 4.5, total_ratings: 12, current_status: '📚 Studying',
      social_links: { linkedin: 'https://linkedin.com/in/arjunpatel' }
    },
    {
      id: 'usr-ng-001', first_name: 'Chioma', last_name: 'Okafor',
      country: 'Nigeria', flag: '🇳🇬', latitude: 6.5244, longitude: 3.3792,
      avatar_url: 'https://i.pravatar.cc/150?img=38',
      job_name: 'Event Planner', job_emoji: '🎉', job_category: 'Hospitality', job_type: 'Freelance',
      skills: ['Project Management', 'Negotiation', 'Community Building', 'Networking & Relationship Building'],
      hobbies: ['💃 Dancing', '🍳 Cooking', '✈️ Traveling'],
      languages: [{ name: 'English', flag: '🇬🇧', native: true }, { name: 'French', flag: '🇫🇷', native: false }],
      age: 29, gender: 'Female', is_online: true, last_seen: null,
      average_rating: 4.7, total_ratings: 21, current_status: '💬 Open to chat',
      social_links: { instagram: 'https://instagram.com/chioma.events' }
    },
    {
      id: 'usr-au-001', first_name: 'Liam', last_name: 'O\'Brien',
      country: 'Australia', flag: '🇦🇺', latitude: -33.8688, longitude: 151.2093,
      avatar_url: 'https://i.pravatar.cc/150?img=57',
      job_name: 'Music Producer', job_emoji: '🎵', job_category: 'Sports & Media', job_type: 'Freelance',
      skills: ['Sound Design', 'Creative Direction', 'Podcast & Audio Production', 'Storytelling'],
      hobbies: ['🎸 Playing Music', '🏄 Surfing', '🔭 Stargazing'],
      languages: [{ name: 'English', flag: '🇬🇧', native: true }],
      age: 31, gender: 'Male', is_online: false, last_seen: '2026-04-04T09:00:00Z',
      average_rating: 4.3, total_ratings: 10, current_status: '🎵 Listening to music',
      social_links: { instagram: 'https://instagram.com/liam.beats', youtube: 'https://youtube.com/@liamobrien' }
    },
    {
      id: 'usr-ca-001', first_name: 'Sophie', last_name: 'Tremblay',
      country: 'Canada', flag: '🇨🇦', latitude: 45.5017, longitude: -73.5673,
      avatar_url: 'https://i.pravatar.cc/150?img=36',
      job_name: 'UX Researcher', job_emoji: '🔍', job_category: 'Creative', job_type: 'Full-time',
      skills: ['UX Design', 'Research & Information Extraction', 'User Behavior Understanding', 'Asking the Right Questions'],
      hobbies: ['⛷️ Skiing', '📚 Reading', '🧩 Solving Puzzles'],
      languages: [{ name: 'French', flag: '🇫🇷', native: true }, { name: 'English', flag: '🇬🇧', native: false }],
      age: 27, gender: 'Female', is_online: true, last_seen: null,
      average_rating: 4.6, total_ratings: 14, current_status: '💻 Deep working',
      social_links: { linkedin: 'https://linkedin.com/in/sophietremblay' }
    },
    {
      id: 'usr-fr-001', first_name: 'Thomas', last_name: 'Dupont',
      country: 'France', flag: '🇫🇷', latitude: 48.8566, longitude: 2.3522,
      avatar_url: 'https://i.pravatar.cc/150?img=59',
      job_name: 'Architect', job_emoji: '🏛️', job_category: 'Engineering', job_type: 'Full-time',
      skills: ['Visual Design', 'Creative Thinking', 'Project Management', 'Rapid Prototyping'],
      hobbies: ['📷 Photography', '🚴 Cycling', '🍷 Wine Tasting'],
      languages: [{ name: 'French', flag: '🇫🇷', native: true }, { name: 'English', flag: '🇬🇧', native: false }, { name: 'Italian', flag: '🇮🇹', native: false }],
      age: 34, gender: 'Male', is_online: true, last_seen: null,
      average_rating: 4.5, total_ratings: 8, current_status: '☕ Having coffee',
      social_links: { linkedin: 'https://linkedin.com/in/thomasdupont' }
    }
  ];
})();
