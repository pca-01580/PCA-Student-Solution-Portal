# PCA Student Solution Portal (starter)

A starter project for **Physics & Chemistry with Ananda**. It includes a responsive React UI, Supabase authentication, student-ID login, chapter/topic navigation, number/title search, an admin-only JSON import panel, draft/publish status, and sanitized HTML solution display.

## Important: free-tier setup

This project is designed to start on free plans, but service providers can change their limits. A custom domain is optional and is not included in the free-hosting setup.

### 1. Create a Supabase project
1. Open https://supabase.com/ and create a project.
2. Go to **SQL Editor** and run the complete `supabase/schema.sql` file.
3. Go to **Authentication → Providers / Sign In** and keep public sign-ups disabled.
4. In Authentication settings, turn off email confirmation if you use the synthetic student emails described below. These addresses are not real inboxes, so password recovery email will not work. Admin must reset a student's password from the Supabase dashboard. For a production deployment, prefer a verified custom domain or implement a server-side student-ID login flow.
5. Copy the project URL and the publishable/anon key from the project's API settings.

### 2. Configure the frontend
1. Install Node.js LTS from https://nodejs.org/
2. Copy `.env.example` to a new file named `.env`.
3. Fill in:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. In a terminal in this project folder, run:

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. To test the production build:

```bash
npm run build
npm run preview
```

Never put a Supabase `service_role` key in `.env` or any browser code.

### 3. Create the first admin account
Supabase Auth uses email/password internally. The app maps a student ID like `2609001` to a synthetic email like `2609001@students.pca.invalid`. Public sign-up is intentionally not implemented.

1. In **Authentication → Users**, add a user:
   - Email: `2609001@students.pca.invalid`
   - Set a strong password.
   - If Supabase refuses `.invalid` in your project, use a domain you control or another syntactically valid placeholder accepted by your project's Auth settings; keep the same convention in the frontend.
2. Copy the user's UUID.
3. In SQL Editor, run this after replacing the UUID and name:

```sql
insert into public.profiles (user_id, student_id, full_name, class_level, role, active)
values ('PASTE-AUTH-USER-UUID-HERE', '2609001', 'PCA Admin', '9', 'admin', true);
```

The ID must match `2609` plus three digits. The first admin profile unlocks the Admin panel.

### 4. Create student accounts
For each student, in **Authentication → Users**, add a user with email like `2609002@students.pca.invalid` and set a temporary password. Then insert their profile:

```sql
insert into public.profiles (user_id, student_id, full_name, class_level, role, active)
values ('STUDENT-AUTH-USER-UUID', '2609002', 'Student Name', '9', 'student', true);
```

Give each student their ID and a unique password privately. Disable or delete accounts when needed. Never reuse one shared password for all students.

### 5. Add chapters and topics
Log in as the admin. Choose Physics or Chemistry, then use **নতুন অধ্যায়ের নাম** in the chapter sidebar. Open the chapter and add topics with the topic field.

You can also add chapters using SQL:

```sql
insert into public.chapters (class_level, subject, title, sort_order)
values ('9', 'Physics', 'পদার্থের অবস্থা ও চাপ', 1);
```

### 6. Add solutions using the Admin Import panel
1. Open a chapter.
2. Expand **AI-এর তৈরি সমাধান Paste / Import**.
3. Select the chapter.
4. Paste a JSON array in the format below.
5. Prefer **Draft** for new AI-generated content.
6. Import, inspect each solution, and click **Publish** only after checking the question, formulas, units, arithmetic, and final answer.

```json
[
  {
    "question_number": 1,
    "title": "চাপ নির্ণয়",
    "topic_id": null,
    "question_html": "<p>প্রশ্নের লেখা এখানে।</p>",
    "solution_html": "<h3>দেওয়া আছে</h3><p>বল, F = 100 N</p><h3>সূত্র</h3><p>P = F/A</p><h3>সমাধান</h3><p>ধাপে ধাপে হিসাব এখানে।</p><p><b>উত্তর:</b> এখানে উত্তর।</p>"
  }
]
```

- `question_number` must be a positive integer.
- `title` and `solution_html` are required.
- `topic_id` is optional; if supplied, it must be a real topic UUID belonging to the selected chapter.
- The current import panel does not automatically create topics from `topic_title`; create topics first, then use their UUID as `topic_id`.
- Import uses chapter + question number as the unique key. Importing the same number again updates that record.
- HTML is sanitized before display, but still review AI content carefully.
- For 100–150 questions, import in batches (for example 20–30 at a time), so an error is easier to find and fix.

### 7. Deploy free on Cloudflare Pages
1. Create a GitHub repository and push this project.
2. In https://pages.cloudflare.com/, create a Pages project and connect the repository.
3. Build command: `npm run build`
4. Build output directory: `dist`
5. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as Pages environment variables.
6. Deploy. Keep the Supabase project URL and public anon/publishable key in frontend environment variables only. Row Level Security is what protects the data; the anon key itself is not a secret.

## Current scope / known limitations
- Class 9 only, Physics and Chemistry only.
- Login is ID + password, but the ID is internally mapped to a synthetic email for Supabase Auth.
- Student creation is done from the Supabase dashboard, not yet through a bulk student manager.
- Admin can add chapters/topics and import JSON; solution editing in the UI is a later enhancement.
- Topics can be filtered after topic IDs are assigned to solutions.
- The current solution list is loaded into the browser for search. For very large libraries, switch to server-side search/pagination.
- Password reset email will not work with synthetic placeholder addresses. Admin must reset passwords manually unless a verified email/domain or a dedicated backend login is implemented.
- Always test policies with a non-admin student account before sharing the URL.
