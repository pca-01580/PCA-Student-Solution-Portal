
      .select('*').eq('user_id', uid).maybeSingle();
    if (e) setError(e.message);
    if (!data || !data.active) {
      setProfile(null);
      setError('এই অ্যাকাউন্টের সক্রিয় প্রোফাইল পাওয়া যায়নি। Admin-এর সঙ্গে যোগাযোগ করো।');
    } else {
      setProfile(data);
      setError('');
      await loadContent();
    }
    setLoading(false);
  }

  async function loadContent() {
    const [c, t, s] = await Promise.all([
      supabase.from('chapters').select('*').eq('class_level', '9').order('sort_order'),
      supabase.from('topics').select('*').order('sort_order'),
      supabase.from('solutions').select('*, topics(title), chapters(title,subject)').order('question_number')
    ]);
    if (c.error || t.error || s.error) {
      setError(c.error?.message || t.error?.message || s.error?.message || 'ডেটা লোড করা যায়নি।');
      return;
    }
    setChapterList(c.data || []);
    setTopics(t.data || []);
    setSolutions(s.data || []);
  }

  async function login(e) {
    e.preventDefault(); setError(''); setNotice('');
    if (!/^2609\d{3}$/.test(studentId)) {
      setError('সঠিক ৭ ডিজিটের Student ID দাও। ID অবশ্যই 2609 দিয়ে শুরু হবে।'); return;
    }
    if (!supabase) { setError('Supabase সেটআপ করা হয়নি। README.md অনুসরণ করে .env ফাইল পূরণ করো।'); return; }
    // Student IDs map to synthetic auth emails. Public sign-up must remain disabled.
    const email = studentId === '2609000'
      ? 'classroompca2@gmail.com'
      : `${studentId}@students.pca.invalid`;
    const { error: e2 } = await supabase.auth.signInWithPassword({ email, password });
    if (e2) setError('আইডি বা পাসওয়ার্ড সঠিক নয়, অথবা অ্যাকাউন্ট সক্রিয় নয়।');
  }

  async function logout() {
    await supabase?.auth.signOut();
    setSession(null); setProfile(null); setActiveChapter(null); setSelectedSolution(null);
  }

  const visibleChapters = chapterList.filter(c => c.subject === subject);
  const chapterTopics = topics.filter(t => t.chapter_id === activeChapter?.id);
  const visibleSolutions = useMemo(() => {
    let list = solutions.filter(s => s.status === 'published' || profile?.role === 'admin');
    if (activeChapter) list = list.filter(s => s.chapter_id === activeChapter.id);
    else list = list.filter(s => s.chapters?.subject === subject);
    if (activeTopic !== 'all') list = list.filter(s => s.topic_id === activeTopic);
    const q = query.trim().toLocaleLowerCase();
    if (q) list = list.filter(s =>
      String(s.question_number).includes(q) ||
      (s.title || '').toLocaleLowerCase().includes(q) ||
      (s.topics?.title || '').toLocaleLowerCase().includes(q)
    );
    return list;
  }, [solutions, activeChapter, activeTopic, query, subject, profile]);

  async function addChapter(e) {
    e.preventDefault(); setError(''); setNotice('');
    if (!newChapter.trim() || profile?.role !== 'admin') return;
    const { error: e1 } = await supabase.from('chapters').insert({
      class_level: '9', subject, title: newChapter.trim(), sort_order: visibleChapters.length + 1
    });
    if (e1) setError(e1.message);
    else { setNewChapter(''); setNotice('অধ্যায় যোগ হয়েছে।'); await loadContent(); }
  }

  async function addTopic(e) {
    e.preventDefault(); setError(''); setNotice('');
    if (!newTopic.trim() || !activeChapter || profile?.role !== 'admin') return;
    const { error: e1 } = await supabase.from('topics').insert({
      chapter_id: activeChapter.id, title: newTopic.trim(), sort_order: chapterTopics.length + 1
    });
    if (e1) setError(e1.message);
    else { setNewTopic(''); setNotice('টপিক যোগ হয়েছে।'); await loadContent(); }
  }

  async function importSolutions(e) {
    e.preventDefault(); setError(''); setNotice('');
    if (profile?.role !== 'admin') return;
    if (!importChapter) { setError('যে অধ্যায়ে সমাধান যোগ করবে সেটি নির্বাচন করো।'); return; }
    let rows;
    try {
      rows = JSON.parse(importText);
      if (!Array.isArray(rows) || rows.length === 0) throw new Error('একটি JSON array দিতে হবে।');
      for (const r of rows) {
        if (!Number.isInteger(Number(r.question_number)) || Number(r.question_number) < 1) throw new Error('প্রতিটি অঙ্কে positive question_number লাগবে।');
        if (!r.title || typeof r.solution_html !== 'string') throw new Error('প্রতিটি অঙ্কে title এবং solution_html থাকতে হবে।');
        if (r.status && !['draft','published','missing'].includes(r.status)) throw new Error('status হবে draft, published অথবা missing।');
      }
    } catch (err) { setError(`Import করা যায়নি: ${err.message}`); return; }
    setImportBusy(true);
    const payload = rows.map(r => ({
      chapter_id: importChapter,
      topic_id: r.topic_id || null,
      question_number: Number(r.question_number),
      title: String(r.title),
      question_html: String(r.question_html || ''),
      solution_html: String(r.solution_html || ''),
      status: importStatus,
      created_by: session.user.id,
      updated_at: new Date().toISOString()
    }));
    const { error: e1 } = await supabase.from('solutions').upsert(payload, { onConflict: 'chapter_id,question_number' });
    setImportBusy(false);
    if (e1) setError(`Import ব্যর্থ: ${e1.message}`);
    else { setNotice(`${payload.length}টি অঙ্ক ${importStatus === 'draft' ? 'Draft হিসেবে' : 'Publish করে'} যোগ/আপডেট হয়েছে।`); await loadContent(); }
  }

  async function setSolutionStatus(solution, status) {
    const { error: e1 } = await supabase.from('solutions').update({ status, updated_at: new Date().toISOString() }).eq('id', solution.id);
    if (e1) setError(e1.message);
    else { setNotice(`অঙ্ক ${solution.question_number}: ${status} করা হয়েছে।`); await loadContent(); }
  }

  if (!supabase) return <SetupScreen />;
  if (loading) return <div className="center-screen"><div className="spinner"/><p>লোড হচ্ছে…</p></div>;
  if (!session || !profile) return <LoginScreen {...{studentId,setStudentId,password,setPassword,login,error}} />;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-mark"><Atom size={25}/></div>
        <div className="brand-copy"><strong>PHYSICS & CHEMISTRY</strong><span>WITH ANANDA · STUDENT PORTAL</span></div>
        <div className="topbar-right">
          {profile.role === 'admin' && <span className="admin-pill"><ShieldCheck size={14}/> Admin</span>}
          <span className="id-pill">{profile.student_id}</span>
          <button className="icon-button" title="লগআউট" onClick={logout}><LogOut size={18}/></button>
        </div>
      </header>

      <main className="main-content">
        <div className="welcome-row">
          <div><p className="eyebrow">CLASS 9 · LEARNING LIBRARY</p><h1>স্বাগতম, {profile.full_name || 'শিক্ষার্থী'}!</h1><p className="muted">যে অধ্যায়ের সমাধান দরকার, সেটি বেছে নাও।</p></div>
          <div className="welcome-icon"><BookOpen size={30}/></div>
        </div>

        {error && <div className="alert error"><AlertCircle size={17}/>{error}<button onClick={() => setError('')}><X size={15}/></button></div>}
        {notice && <div className="alert success"><CheckCircle2 size={17}/>{notice}<button onClick={() => setNotice('')}><X size={15}/></button></div>}

        <section className="subject-grid">
          {SUBJECTS.map(s => <button key={s} className={`subject-card ${s === subject ? 'chosen' : ''} ${s === 'Chemistry' ? 'chemistry' : ''}`} onClick={() => {setSubject(s);setActiveChapter(null);setActiveTopic('all');setSelectedSolution(null);setQuery('');}}>
            <span className="subject-icon">{s === 'Physics' ? <Atom size={26}/> : <FlaskConical size={26}/>}</span>
            <span><strong>{bnSubject(s)}</strong><small>{s === 'Physics' ? 'সূত্র, ধারণা ও গাণিতিক সমস্যা' : 'বিক্রিয়া, ধারণা ও গাণিতিক সমস্যা'}</small></span><ChevronRight className="subject-arrow"/>
          </button>)}
        </section>

        <section className="workspace">
          <aside className="sidebar">
            <div className="section-heading"><span>{activeChapter ? 'অধ্যায়' : `${bnSubject(subject)} অধ্যায়সমূহ`}</span><span className="count">{visibleChapters.length}</span></div>
            {visibleChapters.length === 0 ? <p className="empty-note">এখনো কোনো অধ্যায় যোগ করা হয়নি।</p> : visibleChapters.map(c =>
              <button key={c.id} className={`chapter-button ${activeChapter?.id === c.id ? 'active' : ''}`} onClick={() => {setActiveChapter(c);setActiveTopic('all');setSelectedSolution(null);}}>
                <span className="chapter-num">{String(c.sort_order).padStart(2,'0')}</span><span>{c.title}</span><ChevronRight size={16}/>
              </button>
