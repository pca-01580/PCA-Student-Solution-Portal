import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import DOMPurify from 'dompurify';
import { createClient } from '@supabase/supabase-js';
import {
  Atom, FlaskConical, Search, LogOut, BookOpen, ShieldCheck, Upload,
  ChevronRight, ArrowLeft, CircleHelp, CheckCircle2, AlertCircle, Plus,
  FileText, Database, X, GraduationCap
} from 'lucide-react';
import './styles.css';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

const SUBJECTS = ['Physics', 'Chemistry'];
const bnSubject = (s) => s === 'Physics' ? 'ফিজিক্স' : 'কেমিস্ট্রি';

const PROGRAM_LABELS = {
  '9': 'ক্লাস ৯',
  '10': 'ক্লাস ১০ / SSC',
  'hsc': 'HSC',
  'admission': 'এডমিশন'
};

function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');
  const [selectedClass, setSelectedClass] = useState('9'); // ডিফোল্ট ক্লাস ৯
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
    const { data, error: e } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', uid)
      .maybeSingle();

    if (e) {
      console.error('Supabase Profile Error:', e);
      setError(`ডাটাবেস ত্রুটি (${e.code || ''}): ${e.message}`);
      setLoading(false);
      return;
    }

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
      supabase.from('chapters').select('*').order('sort_order'),
      supabase.from('topics').select('*').order('sort_order'),
      supabase.from('solutions').select('*, topics(title), chapters(title,subject,class_level)').order('question_number')
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
    if (!supabase) { setError('Supabase সেটআপ করা হয়নি। .env ফাইল পূরণ করো।'); return; }
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

  // সিলেক্ট করা ক্লাসের উপর ভিত্তি করে ফিল্টারিং
  const visibleChapters = chapterList.filter(c => c.subject === subject && (c.class_level === selectedClass || !c.class_level));
  const chapterTopics = topics.filter(t => t.chapter_id === activeChapter?.id);
  const visibleSolutions = useMemo(() => {
    let list = solutions.filter(s => s.status === 'published' || profile?.role === 'admin');
    if (activeChapter) list = list.filter(s => s.chapter_id === activeChapter.id);
    else list = list.filter(s => s.chapters?.subject === subject && (s.chapters?.class_level === selectedClass || !s.chapters?.class_level));
    if (activeTopic !== 'all') list = list.filter(s => s.topic_id === activeTopic);
    const q = query.trim().toLocaleLowerCase();
    if (q) list = list.filter(s =>
      String(s.question_number).includes(q) ||
      (s.title || '').toLocaleLowerCase().includes(q) ||
      (s.topics?.title || '').toLocaleLowerCase().includes(q)
    );
    return list;
  }, [solutions, activeChapter, activeTopic, query, subject, selectedClass, profile]);

  async function addChapter(e) {
    e.preventDefault(); setError(''); setNotice('');
    if (!newChapter.trim() || profile?.role !== 'admin') return;
    const { error: e1 } = await supabase.from('chapters').insert({
      class_level: selectedClass, subject, title: newChapter.trim(), sort_order: visibleChapters.length + 1
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
    else { setNotice(`${payload.length}টি অঙ্ক যোগ/আপডেট হয়েছে।`); await loadContent(); }
  }

  async function setSolutionStatus(solution, status) {
    const { error: e1 } = await supabase.from('solutions').update({ status, updated_at: new Date().toISOString() }).eq('id', solution.id);
    if (e1) setError(e1.message);
    else { setNotice(`অঙ্ক ${solution.question_number}: ${status} করা হয়েছে।`); await loadContent(); }
  }

  if (!supabase) return <SetupScreen />;
  if (loading) return <div className="center-screen"><div className="spinner"/><p>লোড হচ্ছে…</p></div>;
  if (!session || !profile) {
    return <LoginScreen {...{studentId,setStudentId,password,setPassword,selectedClass,setSelectedClass,login,error}} />;
  }

  return (
    <div className="app-shell">
      {/* টপবার / হেডার */}
      <header className="topbar">
        <div className="brand-mark">
          <img src="/logo.png" alt="PCA Logo" className="app-logo" onError={(e)=>{e.target.style.display='none';}} />
          <Atom size={28} className="fallback-logo-icon" />
        </div>
        <div className="brand-copy">
          <strong className="chandrabati-title">ফিজিক্স & কেমিস্ট্রি <span className="english-with">with</span> আনন্দ</strong>
          <span>STUDENT PORTAL · {PROGRAM_LABELS[selectedClass]}</span>
        </div>
        <div className="topbar-right">
          {profile.role === 'admin' && <span className="admin-pill"><ShieldCheck size={14}/> Admin</span>}
          <span className="id-pill">{profile.student_id}</span>
          <button className="icon-button" title="লগআউট" onClick={logout}><LogOut size={18}/></button>
        </div>
      </header>

      <main className="main-content">
        <div className="welcome-row">
          <div>
            <p className="eyebrow">{PROGRAM_LABELS[selectedClass]?.toUpperCase()} · LEARNING LIBRARY</p>
            <h1>স্বাগতম, {profile.full_name || 'শিক্ষার্থী'}!</h1>
            <p className="muted">যে অধ্যায়ের সমাধান দরকার, সেটি বেছে নাও।</p>
          </div>
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

        {/* ১. অধ্যায় সিলেক্ট করা না থাকলে: অধ্যায়ের গ্রিড */}
        {!activeChapter ? (
          <section className="chapter-selection-section">
            <div className="section-heading">
              <h2>{bnSubject(subject)} অধ্যায়সমূহ - {PROGRAM_LABELS[selectedClass]} ({visibleChapters.length})</h2>
            </div>
            
            {visibleChapters.length === 0 ? (
              <p className="empty-note">এই শ্রেণির জন্য এখনো কোনো অধ্যায় যোগ করা হয়নি।</p>
            ) : (
              <div className="chapter-cards-grid">
                {visibleChapters.map(c => (
                  <button key={c.id} className="chapter-card-box" onClick={() => { setActiveChapter(c); setActiveTopic('all'); setSelectedSolution(null); setQuery(''); }}>
                    <span className="chapter-num">{String(c.sort_order).padStart(2,'0')}</span>
                    <span className="chapter-card-title">{c.title}</span>
                    <ChevronRight size={20} className="chapter-card-arrow"/>
                  </button>
                ))}
              </div>
            )}

            {profile.role === 'admin' && (
              <form className="inline-form admin-add-chapter" onSubmit={addChapter}>
                <input value={newChapter} onChange={e=>setNewChapter(e.target.value)} placeholder="নতুন অধ্যায়ের নাম"/>
                <button title="অধ্যায় যোগ" type="submit"><Plus size={17}/> অধ্যায় যোগ</button>
              </form>
            )}
          </section>
        ) : (
          /* ২. অধ্যায় সিলেক্ট করলে: সমাধান পেজ */
          <section className="chapter-detail-page">
            <div className="active-chapter-header">
              <button className="back-button" onClick={() => { setActiveChapter(null); setActiveTopic('all'); setSelectedSolution(null); setQuery(''); }}>
                <ArrowLeft size={18}/> অধ্যায় তালিকায় ফিরুন
              </button>
              <h2>{activeChapter.title}</h2>
            </div>

            {selectedSolution ? (
              <SolutionView solution={selectedSolution} onBack={() => setSelectedSolution(null)} admin={profile.role === 'admin'} onStatus={setSolutionStatus}/>
            ) : (
              <>
                <div className="search-box">
                  <Search size={19}/>
                  <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="অঙ্কের নম্বর, টপিক বা নাম দিয়ে খুঁজুন…"/>
                  {query && <button onClick={()=>setQuery('')}><X size={16}/></button>}
                </div>

                <div className="topic-strip">
                  <button className={activeTopic==='all'?'topic active':'topic'} onClick={()=>setActiveTopic('all')}>সব টপিক</button>
                  {chapterTopics.map(t=>(
                    <button key={t.id} className={activeTopic===t.id?'topic active':'topic'} onClick={()=>setActiveTopic(t.id)}>
                      {t.title}
                    </button>
                  ))}
                </div>

                {profile.role === 'admin' && (
                  <form className="inline-form topic-form" onSubmit={addTopic}>
                    <input value={newTopic} onChange={e=>setNewTopic(e.target.value)} placeholder="এই অধ্যায়ে নতুন টপিক যোগ করো"/>
                    <button type="submit"><Plus size={17}/> টপিক</button>
                  </form>
                )}

                <div className="solution-list">
                  {visibleSolutions.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-icon"><CircleHelp size={26}/></div>
                      <strong>{query ? 'কোনো মিল পাওয়া যায়নি' : 'এখানে এখনো সমাধান নেই'}</strong>
                      <p>{query ? 'অঙ্কের নম্বর বা টপিকের নাম ঠিক আছে কি না দেখো।' : 'সমাধান যোগ হলে এখানে দেখা যাবে।'}</p>
                    </div>
                  ) : (
                    visibleSolutions.map(s=>(
                      <button className="solution-row" key={s.id} onClick={()=>setSelectedSolution(s)}>
                        <span className="question-number">{s.question_number}</span>
                        <span className="solution-meta">
                          <strong>{s.title}</strong>
                          <small>{s.topics?.title || 'টপিক নির্ধারণ করা হয়নি'}{profile.role === 'admin' && s.status !== 'published' ? ` · ${s.status.toUpperCase()}` : ''}</small>
                        </span>
                        <ChevronRight size={18}/>
                      </button>
                    ))
                  )}
                </div>

                {profile.role === 'admin' && (
                  <AdminImport {...{chapterList,importChapter,setImportChapter,importText,setImportText,importStatus,setImportStatus,importSolutions,importBusy}}/>
                )}
              </>
            )}
          </section>
        )}

        <footer className="footer">© ফিজিক্স & কেমিস্ট্রি with আনন্দ · শিক্ষার জন্য, তোমার পাশে।</footer>
      </main>
    </div>
  );
}

{/* লগইন স্ক্রিন - যেখানে ক্লাস নির্বাচন করার অপশন যুক্ত করা হয়েছে */}
function LoginScreen({studentId,setStudentId,password,setPassword,selectedClass,setSelectedClass,login,error}) {
  return (
    <div className="login-page">
      <div className="login-decoration decor-one"/>
      <div className="login-decoration decor-two"/>
      <div className="login-card">
        <div className="login-logo-container">
          <img src="/logo.png" alt="PCA Logo" className="login-main-logo" onError={(e)=>{e.target.style.display='none';}} />
          <Atom size={36} className="fallback-login-icon"/>
        </div>
        
        <h1 className="chandrabati-login-title">ফিজিক্স & কেমিস্ট্রি <span className="english-with">with</span> আনন্দ</h1>
        <p className="eyebrow">STUDENT SOLUTION PORTAL</p>
        <p className="muted">তোমার শ্রেণি, আইডি এবং পাসওয়ার্ড দিয়ে প্রবেশ করো।</p>

        <form onSubmit={login} className="login-form">
          <label>
            শ্রেণি / কোর্স নির্বাচন করো
            <select value={selectedClass} onChange={e=>setSelectedClass(e.target.value)} className="class-select-input">
              <option value="9">ক্লাস ৯ (Class 9)</option>
              <option value="10">ক্লাস ১০ / SSC</option>
              <option value="hsc">HSC (একাদশ-দ্বাদশ)</option>
              <option value="admission">এডমিশন (Admission)</option>
            </select>
          </label>

          <label>
            Student ID
            <input autoComplete="username" value={studentId} onChange={e=>setStudentId(e.target.value.replace(/\D/g,'').slice(0,7))} placeholder="2609001" inputMode="numeric" required maxLength={7}/>
            <small>৭ ডিজিট · 2609 দিয়ে শুরু</small>
          </label>

          <label>
            Password
            <input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="তোমার পাসওয়ার্ড" required/>
          </label>

          {error && <div className="alert error"><AlertCircle size={17}/>{error}</div>}

          <button className="primary-button" type="submit">লগইন করো <ChevronRight size={18}/></button>
        </form>

        <div className="login-note">
          <ShieldCheck size={16}/>
          <span>শুধু অনুমোদিত শিক্ষার্থীরা প্রবেশ করতে পারবে। নতুন আইডির জন্য অফিসে যোগাযোগ করো।</span>
        </div>
      </div>
      <p className="login-foot">A PCA Learning Platform</p>
    </div>
  );
}

function SetupScreen() {
  return <div className="setup-page"><div className="login-card setup-card"><div className="login-logo"><Database size={29}/></div><p className="eyebrow">INITIAL SETUP</p><h1>Supabase সংযোগ বাকি</h1><p>ওয়েবসাইট চালু করতে প্রজেক্টের URL ও publishable/anon key সেট করতে হবে।</p></div></div>;
}

function SolutionView({solution,onBack,admin,onStatus}) {
  useEffect(() => {
    if (window.MathJax && window.MathJax.typesetPromise) {
      window.MathJax.typesetPromise();
    }
  }, [solution]);

  return <div className="solution-view"><button className="back-button" onClick={onBack}><ArrowLeft size={17}/> সমাধানের তালিকায় ফিরুন</button>
    <div className="solution-view-heading"><span className="question-number large">{solution.question_number}</span><div><p className="eyebrow">STEP-BY-STEP SOLUTION</p><h2>{solution.title}</h2><p className="muted">{solution.topics?.title || 'টপিক নির্ধারণ করা হয়নি'}</p></div></div>
    {admin && <div className="admin-status-bar"><span>বর্তমান স্ট্যাটাস: <b>{solution.status}</b></span>{solution.status !== 'published' && <button className="small-button" onClick={()=>onStatus(solution,'published')}>Publish</button>}{solution.status === 'published' && <button className="small-button secondary" onClick={()=>onStatus(solution,'draft')}>Unpublish</button>}</div>}
    {solution.question_html && <section className="solution-block"><h3>প্রশ্ন</h3><div className="rich-content" dangerouslySetInnerHTML={{__html:DOMPurify.sanitize(solution.question_html)}}/></section>}
    <section className="solution-block"><h3>সমাধান</h3>{solution.solution_html ? <div className="rich-content" dangerouslySetInnerHTML={{__html:DOMPurify.sanitize(solution.solution_html)}}/> : <p className="muted">এই অঙ্কের সমাধান এখনো যোগ করা হয়নি।</p>}</section>
  </div>;
}

function AdminImport({chapterList,importChapter,setImportChapter,importText,setImportText,importStatus,setImportStatus,importSolutions,importBusy}) {
  const example = `[{"question_number": 1, "title": "প্রশ্ন ১", "solution_html": "<p>সমাধান...</p>"}]`;
  return <details className="import-panel"><summary><Upload size={18}/> AI-এর তৈরি সমাধান Paste / Import</summary><div className="import-inner"><form onSubmit={importSolutions}><label>অধ্যায় নির্বাচন<select value={importChapter} onChange={e=>setImportChapter(e.target.value)} required><option value="">অধ্যায় বেছে নাও</option>{chapterList.map(c=><option value={c.id} key={c.id}>{c.subject} — {c.title}</option>)}</select></label><label>JSON কনটেন্ট<textarea value={importText} onChange={e=>setImportText(e.target.value)} placeholder={example} rows={8} required/></label><button className="primary-button" disabled={importBusy} type="submit">{importBusy ? 'Import হচ্ছে…' : 'Import করো'}</button></form></div></details>;
}

createRoot(document.getElementById('root')).render(<App/>);
