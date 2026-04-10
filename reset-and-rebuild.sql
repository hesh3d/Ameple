-- ╔══════════════════════════════════════════════════════════════╗
-- ║           Ameple Platform — DATABASE REFERENCE               ║
-- ║         كيف يعمل الموقع مع قاعدة البيانات                   ║
-- ╚══════════════════════════════════════════════════════════════╝
--
-- ┌─────────────────────────────────────────────────────────────┐
-- │  كيف يعمل الموقع مع Supabase                               │
-- ├─────────────────────────────────────────────────────────────┤
-- │                                                             │
-- │  1. التسجيل / الدخول (auth.js)                             │
-- │     ┌──────────┐     ┌─────────────┐     ┌──────────────┐  │
-- │     │  User    │────▶│ Supabase    │────▶│ trigger:     │  │
-- │     │ يسجّل   │     │ Auth        │     │handle_new_   │  │
-- │     │          │     │ (auth.users)│     │user()        │  │
-- │     └──────────┘     └─────────────┘     └──────┬───────┘  │
-- │                                                  │          │
-- │                                    ┌─────────────▼──────┐  │
-- │                                    │ public.users       │  │
-- │                                    │ public.user_presence│ │
-- │                                    └────────────────────┘  │
-- │                                                             │
-- │     - Email/Password: يكتب بياناته في onboarding.js       │
-- │     - Google / Discord: الاسم والصورة تُجلب تلقائياً       │
-- │                                                             │
-- │  2. الخريطة الكروية (globe.js)                             │
-- │     - يجلب كل اليوزرز من public.users                      │
-- │     - يستخدم حقلي latitude و longitude لتحديد المكان       │
-- │     - يعرض is_online للنقاط المضيئة                        │
-- │                                                             │
-- │  3. طلبات الاتصال (auth.js + chat.js)                      │
-- │     User A ──▶ connections (pending) ──▶ User B            │
-- │     User B يقبل ──▶ status = 'accepted'                    │
-- │     بعدها يقدروا يتراسلوا في messages                      │
-- │                                                             │
-- │  4. الرسائل والـ Realtime (chat.js)                        │
-- │     - كل رسالة مربوطة بـ connection_id                     │
-- │     - Supabase Realtime يبعت الرسائل الجديدة فوراً        │
-- │       بدون ما الصفحة تتحدث                                 │
-- │     - is_read يتحدث لما الطرف الثاني يشوف الرسالة          │
-- │                                                             │
-- │  5. الحضور Online/Offline (auth.js)                        │
-- │     - user_presence.active_tabs يحسب كم تاب مفتوح          │
-- │     - لما active_tabs = 0 ──▶ is_online = false            │
-- │     - Realtime يبث التغيير لباقي اليوزرز فوراً             │
-- │                                                             │
-- │  6. التقييمات (profile.js)                                 │
-- │     - INSERT في ratings ──▶ trigger يحدّث                   │
-- │       average_rating و total_ratings في users تلقائياً     │
-- │                                                             │
-- │  7. الأفاتار (profile.js)                                  │
-- │     - رفع الصورة إلى Storage bucket: avatars               │
-- │       المسار: avatars/{user_id}/{filename}                  │
-- │     - الـ URL المُرجع يُحفظ في users.avatar_url            │
-- │                                                             │
-- └─────────────────────────────────────────────────────────────┘
--
-- ┌─────────────────────────────────────────────────────────────┐
-- │  العلاقات بين الجداول                                      │
-- ├─────────────────────────────────────────────────────────────┤
-- │                                                             │
-- │  auth.users                                                 │
-- │      │  (trigger: on_auth_user_created)                     │
-- │      ▼                                                      │
-- │  public.users ──────────────────────────────────────┐       │
-- │      │                                              │       │
-- │      ├──▶ connections (sender_id / receiver_id)     │       │
-- │      │        │                                     │       │
-- │      │        └──▶ messages (connection_id)         │       │
-- │      │                                              │       │
-- │      ├──▶ ratings (rater_id / rated_id)             │       │
-- │      ├──▶ reports (reporter_id / reported_id)       │       │
-- │      └──▶ user_presence (user_id) ──────────────────┘       │
-- │                                                             │
-- │  كل الجداول عندها ON DELETE CASCADE                        │
-- │  يعني لما يُحذف user تُحذف كل بياناته تلقائياً            │
-- │                                                             │
-- └─────────────────────────────────────────────────────────────┘
--
-- ┌─────────────────────────────────────────────────────────────┐
-- │  ملاحظات مهمة                                              │
-- ├─────────────────────────────────────────────────────────────┤
-- │                                                             │
-- │  ⚠️  قبل تشغيل RESET:                                      │
-- │     روح Dashboard > Storage > avatars > احذف الـ bucket     │
-- │                                                             │
-- │  ⚠️  بعد تشغيل REBUILD:                                    │
-- │     فعّل Google و Discord من:                              │
-- │     Dashboard > Authentication > Providers                  │
-- │                                                             │
-- │  الـ Supabase URL والـ Key موجودين في:                     │
-- │     ameple/js/lib/supabase.js                               │
-- │                                                             │
-- └─────────────────────────────────────────────────────────────┘


-- ══════════════════════════════════════════════════════════════
-- PART 1: RESET — حذف كل شي
-- ══════════════════════════════════════════════════════════════

-- حذف كل اليوزرز من Auth
DELETE FROM auth.users;

-- إيقاف الـ Realtime قبل حذف الجداول
DO $$ BEGIN ALTER PUBLICATION supabase_realtime DROP TABLE public.messages;      EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime DROP TABLE public.user_presence; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime DROP TABLE public.connections;   EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime DROP TABLE public.users;         EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- حذف الجداول بالترتيب الصحيح (بسبب Foreign Keys)
DROP TABLE IF EXISTS public.reports       CASCADE;
DROP TABLE IF EXISTS public.ratings       CASCADE;
DROP TABLE IF EXISTS public.messages      CASCADE;
DROP TABLE IF EXISTS public.connections   CASCADE;
DROP TABLE IF EXISTS public.user_presence CASCADE;
DROP TABLE IF EXISTS public.users         CASCADE;

-- حذف الـ Functions (والـ Triggers معها تلقائياً)
DROP FUNCTION IF EXISTS public.handle_new_user()    CASCADE;
DROP FUNCTION IF EXISTS public.handle_updated_at()  CASCADE;
DROP FUNCTION IF EXISTS public.update_user_rating() CASCADE;

-- حذف Storage Policies (الـ bucket يُحذف يدوياً من الـ Dashboard)
DO $$ BEGIN DROP POLICY "Users can upload own avatar" ON storage.objects; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY "Anyone can view avatars"     ON storage.objects; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY "Users can update own avatar" ON storage.objects; EXCEPTION WHEN OTHERS THEN NULL; END $$;
DO $$ BEGIN DROP POLICY "Users can delete own avatar" ON storage.objects; EXCEPTION WHEN OTHERS THEN NULL; END $$;


-- ══════════════════════════════════════════════════════════════
-- PART 2: REBUILD — بناء كل شي من الصفر
-- ══════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ──────────────────────────────────────────────────────────────
-- USERS — بروفايل كل مستخدم
-- الحقول الجغرافية (latitude/longitude) تُستخدم في الكرة الأرضية
-- ──────────────────────────────────────────────────────────────
CREATE TABLE public.users (
  id             UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  email          TEXT         UNIQUE NOT NULL,
  first_name     TEXT         NOT NULL DEFAULT '',
  last_name      TEXT         NOT NULL DEFAULT '',
  date_of_birth  DATE,
  age            INTEGER,
  gender         TEXT         CHECK (gender IN ('Male', 'Female', 'Other')),
  country        TEXT,
  city           TEXT,
  flag           TEXT,                                    -- علم الدولة (emoji)
  latitude       DOUBLE PRECISION DEFAULT 0,             -- للخريطة
  longitude      DOUBLE PRECISION DEFAULT 0,             -- للخريطة
  avatar_url     TEXT         DEFAULT 'assets/default-avatar.svg',
  job_name       TEXT,
  job_emoji      TEXT,
  job_category   TEXT,
  job_type       TEXT,
  current_status TEXT         DEFAULT '💬 Open to chat',
  skills         TEXT[]       DEFAULT '{}',
  hobbies        TEXT[]       DEFAULT '{}',
  jobs           TEXT[]       DEFAULT '{}',
  languages      JSONB        DEFAULT '[]',
  social_links   JSONB        DEFAULT '{}',
  favorite_games TEXT[]       DEFAULT '{}',
  average_rating NUMERIC(3,2) DEFAULT 0,                 -- يتحدث تلقائياً عبر trigger
  total_ratings  INTEGER      DEFAULT 0,                 -- يتحدث تلقائياً عبر trigger
  is_online      BOOLEAN      DEFAULT false,
  last_seen      TIMESTAMPTZ  DEFAULT now(),
  created_at     TIMESTAMPTZ  DEFAULT now(),
  updated_at     TIMESTAMPTZ  DEFAULT now()              -- يتحدث تلقائياً عبر trigger
);

CREATE INDEX idx_users_location ON public.users (latitude, longitude); -- سرعة استعلام الخريطة
CREATE INDEX idx_users_online   ON public.users (is_online);
CREATE INDEX idx_users_country  ON public.users (country);


-- ──────────────────────────────────────────────────────────────
-- CONNECTIONS — طلبات الاتصال بين المستخدمين
-- pending → accepted/declined/blocked
-- ──────────────────────────────────────────────────────────────
CREATE TABLE public.connections (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'accepted', 'declined', 'blocked')),
  message     TEXT,                                      -- رسالة الطلب الاختيارية
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (sender_id, receiver_id)                        -- منع إرسال طلب مكرر
);

CREATE INDEX idx_connections_sender   ON public.connections (sender_id);
CREATE INDEX idx_connections_receiver ON public.connections (receiver_id);
CREATE INDEX idx_connections_status   ON public.connections (status);


-- ──────────────────────────────────────────────────────────────
-- MESSAGES — رسائل الشات
-- مربوطة بـ connection مقبول (accepted)
-- تدعم: نص، مكالمة، صورة، رسالة نظام
-- ──────────────────────────────────────────────────────────────
CREATE TABLE public.messages (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  connection_id UUID NOT NULL REFERENCES public.connections(id) ON DELETE CASCADE,
  sender_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content       TEXT NOT NULL,
  type          TEXT NOT NULL DEFAULT 'text'
                CHECK (type IN ('text', 'call', 'image', 'system')),
  call_type     TEXT CHECK (call_type IN ('audio', 'video')), -- فقط لو type = 'call'
  duration      TEXT,                                         -- مدة المكالمة
  is_read       BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_messages_connection ON public.messages (connection_id, created_at);
CREATE INDEX idx_messages_sender     ON public.messages (sender_id);
CREATE INDEX idx_messages_unread     ON public.messages (connection_id, is_read)
  WHERE is_read = false;                                      -- index جزئي للأداء


-- ──────────────────────────────────────────────────────────────
-- RATINGS — تقييم المستخدمين (1-5 نجوم)
-- كل مستخدم يقيّم آخر مرة واحدة فقط
-- trigger يحدّث average_rating في users تلقائياً
-- ──────────────────────────────────────────────────────────────
CREATE TABLE public.ratings (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rater_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  rated_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  rating     INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (rater_id, rated_id)
);

CREATE INDEX idx_ratings_rated ON public.ratings (rated_id);


-- ──────────────────────────────────────────────────────────────
-- USER PRESENCE — حالة الاتصال الآني
-- active_tabs يتتبع عدد التبويبات المفتوحة
-- لما active_tabs = 0 → is_online = false
-- ──────────────────────────────────────────────────────────────
CREATE TABLE public.user_presence (
  user_id     UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  is_online   BOOLEAN DEFAULT false,
  last_seen   TIMESTAMPTZ DEFAULT now(),
  active_tabs INTEGER DEFAULT 0
);


-- ──────────────────────────────────────────────────────────────
-- REPORTS — بلاغات المستخدمين
-- ──────────────────────────────────────────────────────────────
CREATE TABLE public.reports (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reported_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reason      TEXT NOT NULL,
  details     TEXT,
  status      TEXT DEFAULT 'pending'
              CHECK (status IN ('pending', 'reviewed', 'resolved')),
  created_at  TIMESTAMPTZ DEFAULT now()
);


-- ──────────────────────────────────────────────────────────────
-- TRIGGER: تحديث updated_at تلقائياً
-- يشتغل على: users, connections
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_users_updated
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER on_connections_updated
  BEFORE UPDATE ON public.connections
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ──────────────────────────────────────────────────────────────
-- TRIGGER: تحديث average_rating في users تلقائياً
-- يشتغل كل ما يُضاف أو يُعدّل تقييم
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_user_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.users
  SET
    average_rating = (
      SELECT COALESCE(AVG(rating), 0) FROM public.ratings WHERE rated_id = NEW.rated_id
    ),
    total_ratings = (
      SELECT COUNT(*) FROM public.ratings WHERE rated_id = NEW.rated_id
    )
  WHERE id = NEW.rated_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_rating_insert
  AFTER INSERT OR UPDATE ON public.ratings
  FOR EACH ROW EXECUTE FUNCTION public.update_user_rating();


-- ──────────────────────────────────────────────────────────────
-- TRIGGER: إنشاء بروفايل تلقائي بعد التسجيل
--
-- يشتغل على auth.users عند كل تسجيل جديد سواء:
--   - Email/Password: يُنشئ سجل فارغ، اليوزر يكمله في onboarding
--   - Google OAuth:   يجلب الاسم من (name/given_name) والصورة من (picture)
--   - Discord OAuth:  يجلب الاسم من (full_name/username) والصورة من (avatar_url)
--
-- ينشئ أيضاً سجل في user_presence
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  _first_name TEXT;
  _last_name  TEXT;
  _avatar     TEXT;
  _full_name  TEXT;
BEGIN
  _first_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'first_name', ''),
    split_part(COALESCE(
      NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
      NULLIF(NEW.raw_user_meta_data->>'name', ''),
      ''
    ), ' ', 1),
    NULLIF(NEW.raw_user_meta_data->>'preferred_username', ''),
    ''
  );

  _full_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'name', ''),
    ''
  );

  _last_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'last_name', ''),
    CASE WHEN _full_name LIKE '% %'
      THEN substring(_full_name FROM position(' ' IN _full_name) + 1)
      ELSE ''
    END,
    ''
  );

  -- Discord → avatar_url | Google → picture
  _avatar := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'avatar_url', ''),
    NULLIF(NEW.raw_user_meta_data->>'picture', ''),
    'assets/default-avatar.svg'
  );

  INSERT INTO public.users (id, email, first_name, last_name, avatar_url, is_online, last_seen)
  VALUES (NEW.id, COALESCE(NEW.email, ''), _first_name, _last_name, _avatar, true, now())
  ON CONFLICT (id) DO UPDATE SET
    first_name = CASE WHEN public.users.first_name = '' OR public.users.first_name IS NULL
                      THEN EXCLUDED.first_name ELSE public.users.first_name END,
    last_name  = CASE WHEN public.users.last_name  = '' OR public.users.last_name  IS NULL
                      THEN EXCLUDED.last_name  ELSE public.users.last_name  END,
    avatar_url = CASE WHEN public.users.avatar_url = 'assets/default-avatar.svg' OR public.users.avatar_url IS NULL
                      THEN EXCLUDED.avatar_url ELSE public.users.avatar_url END,
    is_online  = true,
    last_seen  = now();

  INSERT INTO public.user_presence (user_id, is_online, last_seen)
  VALUES (NEW.id, true, now())
  ON CONFLICT (user_id) DO UPDATE SET is_online = true, last_seen = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ──────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY (RLS)
-- كل جدول محمي: كل مستخدم يشوف ويعدّل بياناته فقط
-- ──────────────────────────────────────────────────────────────
ALTER TABLE public.users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connections   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ratings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports       ENABLE ROW LEVEL SECURITY;

-- USERS: الكل يشوف، كل واحد يعدّل بروفايله فقط
CREATE POLICY "Users are viewable by everyone" ON public.users FOR SELECT USING (true);
CREATE POLICY "Users can update own profile"   ON public.users FOR UPDATE USING (auth.uid() = id);

-- CONNECTIONS: يشوف ويعدّل connections اللي هو طرف فيها فقط
CREATE POLICY "Users can view own connections"
  ON public.connections FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can send connection requests"
  ON public.connections FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can update own connections"
  ON public.connections FOR UPDATE
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can delete own connections"
  ON public.connections FOR DELETE
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- MESSAGES: يشوف ويرسل في connections اللي هو طرف فيها
CREATE POLICY "Users can view messages in own connections"
  ON public.messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.connections
      WHERE connections.id = messages.connection_id
        AND (connections.sender_id = auth.uid() OR connections.receiver_id = auth.uid())
    )
  );

CREATE POLICY "Users can send messages in own connections"
  ON public.messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.connections
      WHERE connections.id = connection_id
        AND connections.status = 'accepted'
        AND (connections.sender_id = auth.uid() OR connections.receiver_id = auth.uid())
    )
  );

CREATE POLICY "Users can update messages in own connections"
  ON public.messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.connections
      WHERE connections.id = messages.connection_id
        AND (connections.sender_id = auth.uid() OR connections.receiver_id = auth.uid())
    )
  );

-- RATINGS: الكل يشوف، كل واحد يقيّم غيره مرة واحدة
CREATE POLICY "Anyone can view ratings"  ON public.ratings FOR SELECT USING (true);
CREATE POLICY "Users can rate others"    ON public.ratings FOR INSERT WITH CHECK (auth.uid() = rater_id AND auth.uid() != rated_id);
CREATE POLICY "Users can update own ratings" ON public.ratings FOR UPDATE USING (auth.uid() = rater_id);

-- USER PRESENCE: الكل يشوف، كل واحد يعدّل حضوره فقط
CREATE POLICY "Presence is viewable by everyone" ON public.user_presence FOR SELECT USING (true);
CREATE POLICY "Users can update own presence"    ON public.user_presence FOR UPDATE USING (auth.uid() = user_id);

-- REPORTS: كل واحد يرفع ويشوف بلاغاته فقط
CREATE POLICY "Users can create reports"   ON public.reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Users can view own reports" ON public.reports FOR SELECT USING (auth.uid() = reporter_id);


-- ──────────────────────────────────────────────────────────────
-- REALTIME
-- messages, user_presence, connections, users تُبث مباشرة للمتصلين
-- ──────────────────────────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_presence;
ALTER PUBLICATION supabase_realtime ADD TABLE public.connections;
ALTER PUBLICATION supabase_realtime ADD TABLE public.users;


-- ──────────────────────────────────────────────────────────────
-- STORAGE BUCKET: avatars
-- مسار الصورة: avatars/{user_id}/{filename}
-- كل مستخدم يرفع في مجلده فقط، الكل يشوف
-- ──────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Anyone can view avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "Users can update own avatar"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete own avatar"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);


-- ══════════════════════════════════════════════════════════════
-- ✅ تم! قاعدة البيانات جاهزة
-- ══════════════════════════════════════════════════════════════
