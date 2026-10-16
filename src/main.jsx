import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import DOMPurify from 'dompurify';
import { createClient } from '@supabase/supabase-js';
import {
  Atom, FlaskConical, Search, LogOut, BookOpen, ShieldCheck, Upload,
  ChevronRight, ArrowLeft, CircleHelp, CheckCircle2, AlertCircle, Plus,
  RefreshCw, FileText, Database, X
} from 'lucide-react';
import './styles.css';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

const SUBJECTS = ['Physics', 'Chemistry'];
const bnSubject = (s) => s === 'Physics' ? 'ফিজিক্স' : 'কেমিস্ট্রি';

function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');
  const [subject, setSubject] = useState('Physics');
  const [chapterList, setChapterList] = useState([]);
  const [topics, setTopics] = useState([]);
  const [solutions, setSolutions] = useState([]);
  const [activeChapter, setActiveChapter] = useState(null);
  const [activeTopic, setActiveTopic] = useState('all');
  const [query, setQuery] = useState('');
  const [selectedSolution, setSelectedSolution] = useState(null);
  const [importText, setImportText] = useState('');
  const [importChapter, setImportChapter] = useState('');
  const [importStatus, setImportStatus] = useState('draft');
  const [importBusy, setImportBusy] = useState(false);
  const [newChapter, setNewChapter] = useState('');
  const [newTopic, setNewTopic] = useState('');

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) loadProfile(data.session.user.id);
      else setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) {
        setLoading(true);
        setTimeout(() => loadProfile(nextSession.user.id), 0);
      } else {
        setProfile(null); setLoading(false);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function loadProfile(uid) {
    const { data, error: e } = await supabase.from('profiles')
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
    const email = `${studentId}@students.pca.invalid`;
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
            )}
            {profile.role === 'admin' && <form className="inline-form" onSubmit={addChapter}><input value={newChapter} onChange={e=>setNewChapter(e.target.value)} placeholder="নতুন অধ্যায়ের নাম"/><button title="অধ্যায় যোগ" type="submit"><Plus size={17}/></button></form>}
          </aside>

          <section className="content-panel">
            {selectedSolution ? <SolutionView solution={selectedSolution} onBack={() => setSelectedSolution(null)} admin={profile.role === 'admin'} onStatus={setSolutionStatus}/> :
              <>
                <div className="content-title-row"><div><p className="eyebrow">{activeChapter ? activeChapter.subject.toUpperCase() : 'SOLUTION LIBRARY'}</p><h2>{activeChapter?.title || `${bnSubject(subject)} সমাধান লাইব্রেরি`}</h2></div><span className="result-count">{visibleSolutions.length}টি সমাধান</span></div>
                <div className="search-box"><Search size={19}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="অঙ্কের নম্বর, টপিক বা নাম দিয়ে খুঁজুন…"/>{query && <button onClick={()=>setQuery('')}><X size={16}/></button>}</div>
                {activeChapter && <div className="topic-strip"><button className={activeTopic==='all'?'topic active':'topic'} onClick={()=>setActiveTopic('all')}>সব টপিক</button>{chapterTopics.map(t=><button key={t.id} className={activeTopic===t.id?'topic active':'topic'} onClick={()=>setActiveTopic(t.id)}>{t.title}</button>)}</div>}
                {profile.role === 'admin' && activeChapter && <form className="inline-form topic-form" onSubmit={addTopic}><input value={newTopic} onChange={e=>setNewTopic(e.target.value)} placeholder="এই অধ্যায়ে নতুন টপিক যোগ করো"/><button type="submit"><Plus size={17}/> টপিক</button></form>}
                <div className="solution-list">
                  {visibleSolutions.length === 0 ? <div className="empty-state"><div className="empty-icon"><CircleHelp size={26}/></div><strong>{query ? 'কোনো মিল পাওয়া যায়নি' : 'এখানে এখনো সমাধান নেই'}</strong><p>{query ? 'অঙ্কের নম্বর বা টপিকের নাম ঠিক আছে কি না দেখো।' : 'সমাধান যোগ হলে এখানে দেখা যাবে।'}</p></div> :
                    visibleSolutions.map(s=><button className="solution-row" key={s.id} onClick={()=>setSelectedSolution(s)}>
                      <span className="question-number">{s.question_number}</span><span className="solution-meta"><strong>{s.title}</strong><small>{s.topics?.title || 'টপিক নির্ধারণ করা হয়নি'}{profile.role === 'admin' && s.status !== 'published' ? ` · ${s.status.toUpperCase()}` : ''}</small></span><ChevronRight size={18}/>
                    </button>)}
                </div>
                {profile.role === 'admin' && <AdminImport {...{chapterList,importChapter,setImportChapter,importText,setImportText,importStatus,setImportStatus,importSolutions,importBusy}}/>}
              </>
            }
          </section>
        </section>
        <footer className="footer">© Physics & Chemistry with Ananda · শিক্ষার জন্য, তোমার পাশে।</footer>
      </main>
    </div>
  );
}

function LoginScreen({studentId,setStudentId,password,setPassword,login,error}) {
  return <div className="login-page"><div className="login-decoration decor-one"/><div className="login-decoration decor-two"/>
    <div className="login-card"><div className="login-logo"><Atom size={31}/></div><p className="eyebrow">PHYSICS & CHEMISTRY WITH ANANDA</p><h1>Student Solution Portal</h1><p className="muted">তোমার আইডি দিয়ে লগইন করে সমাধান লাইব্রেরিতে প্রবেশ করো।</p>
      <form onSubmit={login} className="login-form"><label>Student ID<input autoComplete="username" value={studentId} onChange={e=>setStudentId(e.target.value.replace(/\D/g,'').slice(0,7))} placeholder="2609001" inputMode="numeric" required maxLength={7}/><small>৭ ডিজিট · 2609 দিয়ে শুরু</small></label><label>Password<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="তোমার পাসওয়ার্ড" required/></label>
        {error && <div className="alert error"><AlertCircle size={17}/>{error}</div>}<button className="primary-button" type="submit">লগইন করো <ChevronRight size={18}/></button></form>
      <div className="login-note"><ShieldCheck size={16}/><span>শুধু অনুমোদিত শিক্ষার্থীরা প্রবেশ করতে পারবে। নতুন আইডির জন্য অফিসে যোগাযোগ করো।</span></div>
    </div><p className="login-foot">A PCA Learning Platform</p>
  </div>;
}

function SetupScreen() {
  return <div className="setup-page"><div className="login-card setup-card"><div className="login-logo"><Database size={29}/></div><p className="eyebrow">INITIAL SETUP</p><h1>Supabase সংযোগ বাকি</h1><p>ওয়েবসাইট চালু করতে প্রজেক্টের URL ও publishable/anon key সেট করতে হবে।</p><ol><li>README.md অনুসারে Supabase project তৈরি করো।</li><li>প্রজেক্টের SQL Editor-এ <code>supabase/schema.sql</code> চালাও।</li><li><code>.env.example</code> কপি করে <code>.env</code> তৈরি করো এবং দুইটি মান বসাও।</li><li>তারপর <code>npm run dev</code> চালাও।</li></ol><div className="alert"><AlertCircle size={17}/>Service role key কখনো frontend-এ বসাবে না।</div></div></div>;
}

function SolutionView({solution,onBack,admin,onStatus}) {
  return <div className="solution-view"><button className="back-button" onClick={onBack}><ArrowLeft size={17}/> সমাধানের তালিকায় ফিরুন</button>
    <div className="solution-view-heading"><span className="question-number large">{solution.question_number}</span><div><p className="eyebrow">STEP-BY-STEP SOLUTION</p><h2>{solution.title}</h2><p className="muted">{solution.topics?.title || 'টপিক নির্ধারণ করা হয়নি'}</p></div></div>
    {admin && <div className="admin-status-bar"><span>বর্তমান স্ট্যাটাস: <b>{solution.status}</b></span>{solution.status !== 'published' && <button className="small-button" onClick={()=>onStatus(solution,'published')}>Publish</button>}{solution.status === 'published' && <button className="small-button secondary" onClick={()=>onStatus(solution,'draft')}>Unpublish</button>}</div>}
    {solution.question_html && <section className="solution-block"><h3>প্রশ্ন</h3><div className="rich-content" dangerouslySetInnerHTML={{__html:DOMPurify.sanitize(solution.question_html)}}/></section>}
    <section className="solution-block"><h3>সমাধান</h3>{solution.solution_html ? <div className="rich-content" dangerouslySetInnerHTML={{__html:DOMPurify.sanitize(solution.solution_html)}}/> : <p className="muted">এই অঙ্কের সমাধান এখনো যোগ করা হয়নি।</p>}</section>
  </div>;
}

function AdminImport({chapterList,importChapter,setImportChapter,importText,setImportText,importStatus,setImportStatus,importSolutions,importBusy}) {
  const example = `[
  {
    "question_number": 1,
    "title": "চাপ নির্ণয়",
    "topic_title": "চাপ",
    "question_html": "<p>প্রশ্নের বিবরণ এখানে লিখবে।</p>",
    "solution_html": "<h3>দেওয়া আছে</h3><p>বল, F = 100 N</p><h3>সূত্র</h3><p>চাপ, P = F/A</p><h3>সমাধান</h3><p>প্রয়োজনীয় মান বসিয়ে হিসাব করো।</p><p><b>উত্তর:</b> ...</p>"
  }
]`;
  return <details className="import-panel"><summary><Upload size={18}/> AI-এর তৈরি সমাধান Paste / Import</summary><div className="import-inner"><p className="muted">AI-এর কাছ থেকে JSON array নাও। প্রথমে অল্প কয়েকটি অঙ্ক দিয়ে পরীক্ষা করো, সূত্র ও উত্তর যাচাই করে তারপর Publish করো।</p>
    <form onSubmit={importSolutions}><label>অধ্যায় নির্বাচন<select value={importChapter} onChange={e=>setImportChapter(e.target.value)} required><option value="">অধ্যায় বেছে নাও</option>{chapterList.map(c=><option value={c.id} key={c.id}>{c.subject} — {c.title}</option>)}</select></label>
      <label>কীভাবে যোগ হবে<select value={importStatus} onChange={e=>setImportStatus(e.target.value)}><option value="draft">Draft — যাচাইয়ের পর Publish</option><option value="published">Published — সঙ্গে সঙ্গে শিক্ষার্থীরা দেখবে</option></select></label>
      <label>JSON কনটেন্ট<textarea value={importText} onChange={e=>setImportText(e.target.value)} placeholder={example} rows={10} required/></label>
      <div className="import-actions"><button type="button" className="secondary-button" onClick={()=>setImportText(example)}>নমুনা বসাও</button><button className="primary-button" disabled={importBusy} type="submit">{importBusy ? 'Import হচ্ছে…' : 'Import করো'}</button></div>
    </form><div className="import-tip"><FileText size={16}/><span><code>topic_title</code> দিলে import-এর আগে ওই অধ্যায়ে একই নামের টপিক তৈরি করে তার <code>topic_id</code> ব্যবহার করো। বর্তমান প্রাথমিক ভার্সনে JSON-এ <code>topic_id</code> দিলে সরাসরি যুক্ত হবে।</span></div>
  </div></details>;
}

createRoot(document.getElementById('root')).render(<App/>);
