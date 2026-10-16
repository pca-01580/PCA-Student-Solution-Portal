import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import DOMPurify from 'dompurify';
import { createClient } from '@supabase/supabase-js';
import {
  Atom, FlaskConical, Search, LogOut, BookOpen, ShieldCheck, Upload,
  ChevronRight, ArrowLeft, CircleHelp, CheckCircle2, AlertCircle, Plus,
  FileText, Database, X, Ruler, Gauge, Hammer, Sparkles, Scale,
  Thermometer, Radio, Sun, Compass, Battery, Zap, Magnet, Cpu,
  Orbit, Grid, Link, Calculator, TestTube, Mountain, Flame, Layers
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
  'hsc': 'HSC (একাদশ-দ্বাদশ)',
  'admission': 'এডমিশন টেস্ট'
};

const BENGALI_ORDINALS = [
  'প্রথম', 'দ্বিতীয়', 'তৃতীয়', 'চতুর্থ', 'পঞ্চম',
  'ষষ্ঠ', 'সপ্তম', 'অষ্টম', 'নবম', 'দশম',
  'একাদশ', 'দ্বাদশ', 'ত্রয়োদশ', 'চতুর্দশ', 'পঞ্চদশ',
  'ষোড়শ', 'সপ্তদশ', 'অষ্টাদশ', 'উনবিংশ', 'বিংশ'
];

function getBengaliOrdinal(index) {
  return BENGALI_ORDINALS[index] || `${index + 1}তম`;
}

// অধ্যায়ের নাম থেকে যেকোনো প্রকার অতিরিক্ত প্রিফিক্স মুছে ফেলার ফাংশন
function cleanChapterTitle(title) {
  if (!title) return '';
  return title
    .replace(/^(?:[\d১-৯0-9a-zA-Zমষতম্থ্রর্ডন্সষ্ঠম]+\s*)?অধ্যায়\s*[:ঃ.-]?\s*/i, '')
    .replace(/^[০-৯0-9]+\s*[:ঃ.-]?\s*/i, '')
    .replace(/^[মষ]\s*/i, '')
    .replace(/^[:\sঃ.-]+/, '')
    .trim();
}

function getChapterIcon(title = '', subject = '') {
  const t = title.toLowerCase();
  if (t.includes('রাশি') || t.includes('পরিমাণ') || t.includes('পরিমাপ')) return Ruler;
  if (t.includes('গতি')) return Gauge;
  if (t.includes('বল')) return Hammer;
  if (t.includes('কাজ') || t.includes('ক্ষমতা') || t.includes('শক্তি')) return Sparkles;
  if (t.includes('অবস্থা') || t.includes('চাপ')) return Scale;
  if (t.includes('তাপ')) return Thermometer;
  if (t.includes('তরঙ্গ') || t.includes('শব্দ')) return Radio;
  if (t.includes('প্রতিফলন')) return Sun;
  if (t.includes('প্রতিসরণ') || t.includes('আলো')) return Compass;
  if (t.includes('স্থির') && (t.includes('বিদ্যুৎ') || t.includes('তড়িৎ'))) return Battery;
  if (t.includes('চল') && (t.includes('বিদ্যুৎ') || t.includes('তড়িৎ'))) return Zap;
  if (t.includes('চৌম্বক') || t.includes('চুম্বক')) return Magnet;
  if (t.includes('তেজস্ক্রিয়') || t.includes('ইলেকট্রনিক্স')) return Cpu;

  if (t.includes('ধারণা')) return FlaskConical;
  if (t.includes('গঠন') || t.includes('পরমাণু')) return Orbit;
  if (t.includes('পর্যায়')) return Grid;
  if (t.includes('বন্ধন')) return Link;
  if (t.includes('মোল')) return Calculator;
  if (t.includes('বিক্রিয়া')) return Sparkles;
  if (t.includes('এসিড') || t.includes('ক্ষার')) return TestTube;
  if (t.includes('খনিজ') || t.includes('সম্পদ')) return Mountain;
  if (t.includes('জীবাশ্ম') || t.includes('হাইড্রোকার্বন')) return Flame;

  return subject === 'Physics' ? Atom : FlaskConical;
}

function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [studentId, setStudentId] = useState('');
  const [password, setPassword] = useState('');
  const [selectedClass, setSelectedClass] = useState('9');
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
      (s.topics?.title || '').toLocaleLowerCase().includes(q) ||
      (s.question_text || '').toLocaleLowerCase().includes(q)
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
  if (loading) return <div className="center-screen"><div className="modern-loader"/><p>পোর্টাল প্রস্তুত হচ্ছে…</p></div>;
  if (!session || !profile) {
    return <LoginScreen {...{studentId,setStudentId,password,setPassword,selectedClass,setSelectedClass,login,error}} />;
  }

  return (
    <div className={`app-shell theme-${subject.toLowerCase()}`}>
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand-mark">
            <img src="/logo.png" alt="PCA Logo" className="app-logo" onError={(e)=>{e.target.style.display='none';}} />
            <Atom size={30} className="fallback-logo-icon" />
          </div>
          <div className="brand-copy">
            <strong className="chandrabati-title">ফিজিক্স & কেমিস্ট্রি <span className="english-with">with</span> আনন্দ</strong>
            <span className="badge-class-pill">{PROGRAM_LABELS[selectedClass]}</span>
          </div>
          <div className="topbar-right">
            {profile.role === 'admin' && <span className="admin-pill"><ShieldCheck size={14}/> Admin</span>}
            <span className="id-pill">ID: {profile.student_id}</span>
            <button className="icon-button logout-btn" title="লগআউট" onClick={logout}><LogOut size={18}/></button>
          </div>
        </div>
      </header>

      <main className="main-content">
        <div className="welcome-banner">
          <div className="banner-text">
            <p className="eyebrow-tag">{PROGRAM_LABELS[selectedClass]?.toUpperCase()} • SMART SOLUTION LIBRARY</p>
            <h1>স্বাগতম, <span className="highlight-name">{profile.full_name || 'শিক্ষার্থী'}</span>!</h1>
            <p className="muted-desc">ফিজিক্স এবং কেমিস্ট্রির গাণিতিক সমস্যার সহজ ও নিখুঁত সমাধান।</p>
          </div>
          <div className="banner-badge-icon"><BookOpen size={36}/></div>
        </div>

        {error && <div className="alert error"><AlertCircle size={18}/><span>{error}</span><button onClick={() => setError('')}><X size={16}/></button></div>}
        {notice && <div className="alert success"><CheckCircle2 size={18}/><span>{notice}</span><button onClick={() => setNotice('')}><X size={16}/></button></div>}

        {/* বিষয় নির্বাচন (Physics / Chemistry) - ক্লিন ও বড় ফন্টে */}
        <section className="subject-selector-grid">
          {SUBJECTS.map(s => (
            <button key={s} className={`subject-tab-card ${s === subject ? 'active-tab' : ''} ${s.toLowerCase()}`} onClick={() => {setSubject(s);setActiveChapter(null);setActiveTopic('all');setSelectedSolution(null);setQuery('');}}>
              <div className="subject-tab-icon">
                {s === 'Physics' ? <Atom size={32}/> : <FlaskConical size={32}/>}
              </div>
              <div className="subject-tab-info">
                <strong className="subject-title-lg">{bnSubject(s)}</strong>
              </div>
              <ChevronRight className="subject-tab-arrow" size={24}/>
            </button>
          ))}
        </section>

        {/* ১. অধ্যায় গ্রিড ভিউ */}
        {!activeChapter ? (
          <section className="chapter-section-container">
            <div className="section-title-bar">
              <h2><Layers size={22}/> {bnSubject(subject)} অধ্যায়সমূহ ({visibleChapters.length})</h2>
            </div>
            
            {visibleChapters.length === 0 ? (
              <div className="empty-chapter-box">
                <CircleHelp size={32}/>
                <p>এই শ্রেণির জন্য এখনো কোনো অধ্যায় যোগ করা হয়নি।</p>
              </div>
            ) : (
              <div className="chapter-grid-modern">
                {visibleChapters.map((c, index) => {
                  const cleanedTitle = cleanChapterTitle(c.title);
                  const ordinal = getBengaliOrdinal(index);
                  const ChapterIcon = getChapterIcon(c.title, subject);

                  return (
                    <div 
                      key={c.id} 
                      className="chapter-glass-card" 
                      onClick={() => { setActiveChapter(c); setActiveTopic('all'); setSelectedSolution(null); setQuery(''); }}
                    >
                      <div className="chapter-square-avatar">
                        <ChapterIcon size={24} />
                      </div>
                      <div className="chapter-details">
                        <span className="ordinal-tag">{ordinal} অধ্যায়</span>
                        <h3 className="chapter-main-title">{cleanedTitle}</h3>
                      </div>
                      <div className="arrow-btn"><ChevronRight size={18}/></div>
                    </div>
                  );
                })}
              </div>
            )}

            {profile.role === 'admin' && (
              <form className="admin-inline-card" onSubmit={addChapter}>
                <input value={newChapter} onChange={e=>setNewChapter(e.target.value)} placeholder="+ নতুন অধ্যায়ের নাম লিখুন"/>
                <button className="btn-primary" type="submit"><Plus size={16}/> অধ্যায় যোগ</button>
              </form>
            )}
          </section>
        ) : (
          /* ২. নির্বাচিত অধ্যায়ের সমাধান ভিউ */
          <section className="chapter-detail-container">
            <div className="chapter-header-nav">
              <button className="btn-back-link" onClick={() => { setActiveChapter(null); setActiveTopic('all'); setSelectedSolution(null); setQuery(''); }}>
                <ArrowLeft size={18}/> অধ্যায় তালিকায় ফিরুন
              </button>
              <h2 className="selected-chapter-heading">
                {getBengaliOrdinal(visibleChapters.findIndex(c => c.id === activeChapter.id))} অধ্যায়: {cleanChapterTitle(activeChapter.title)}
              </h2>
            </div>

            {selectedSolution ? (
              <SolutionView solution={selectedSolution} onBack={() => setSelectedSolution(null)} admin={profile.role === 'admin'} onStatus={setSolutionStatus}/>
            ) : (
              <>
                <div className="search-bar-wrapper">
                  <Search size={20} className="search-icon"/>
                  <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="অঙ্কের নম্বর, প্রশ্ন বা টপিকের নাম দিয়ে খুঁজুন…"/>
                  {query && <button className="clear-search" onClick={()=>setQuery('')}><X size={16}/></button>}
                </div>

                <div className="topic-pill-strip">
                  <button className={activeTopic==='all'?'pill-item active':'pill-item'} onClick={()=>setActiveTopic('all')}>সব টপিক</button>
                  {chapterTopics.map(t=>(
                    <button key={t.id} className={activeTopic===t.id?'pill-item active':'pill-item'} onClick={()=>setActiveTopic(t.id)}>
                      {t.title}
                    </button>
                  ))}
                </div>

                {profile.role === 'admin' && (
                  <form className="admin-inline-card" onSubmit={addTopic}>
                    <input value={newTopic} onChange={e=>setNewTopic(e.target.value)} placeholder="+ নতুন টপিকের নাম"/>
                    <button className="btn-primary" type="submit"><Plus size={16}/> টপিক</button>
                  </form>
                )}

                <div className="solution-card-list">
                  {visibleSolutions.length === 0 ? (
                    <div className="empty-chapter-box">
                      <CircleHelp size={32}/>
                      <strong>{query ? 'কোনো সমাধান পাওয়া যায়নি' : 'এখানে এখনো সমাধান আপলোড করা হয়নি'}</strong>
                      <p>{query ? 'অঙ্কের নম্বর বা বানান ঠিক আছে কি না পুনরায় দেখুন।' : 'দ্রুত সমাধান যুক্ত করা হবে।'}</p>
                    </div>
                  ) : (
                    visibleSolutions.map(s=>(
                      <div className="solution-item-card" key={s.id} onClick={()=>setSelectedSolution(s)}>
                        <div className="math-num-badge">
                          <small>অঙ্ক</small>
                          <strong>{s.question_number}</strong>
                        </div>
                        <div className="solution-info">
                          <span className="topic-name-tag">{s.topics?.title || 'সাধারণ প্রশ্ন'}</span>
                          <h4 className="solution-item-title">{s.question_text ? s.question_text.replace(/<[^>]*>?/gm, '').slice(0, 90) + '...' : s.title}</h4>
                          {profile.role === 'admin' && s.status !== 'published' && <span className="status-indicator">{s.status.toUpperCase()}</span>}
                        </div>
                        <ChevronRight size={20} className="card-arrow"/>
                      </div>
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

        <footer className="footer-bar">© ফিজিক্স & কেমিস্ট্রি with আনন্দ • PCA Student Portal</footer>
      </main>
    </div>
  );
}

function LoginScreen({studentId,setStudentId,password,setPassword,selectedClass,setSelectedClass,login,error}) {
  return (
    <div className="login-viewport">
      <div className="login-glass-card">
        <div className="login-brand-header">
          <img src="/logo.png" alt="PCA Logo" className="login-brand-logo" onError={(e)=>{e.target.style.display='none';}} />
          <Atom size={42} className="login-fallback-icon"/>
          <h1 className="chandrabati-login-title">ফিজিক্স & কেমিস্ট্রি <span className="english-with">with</span> আনন্দ</h1>
          <p className="portal-sub">STUDENT SOLUTION PORTAL</p>
        </div>

        <form onSubmit={login} className="login-form-modern">
          <div className="form-group">
            <label>শ্রেণি / কোর্স নির্বাচন করো</label>
            <select value={selectedClass} onChange={e=>setSelectedClass(e.target.value)} className="select-custom">
              <option value="9">ক্লাস ৯ (Class 9)</option>
              <option value="10">ক্লাস ১০ / SSC</option>
              <option value="hsc">HSC (একাদশ-দ্বাদশ)</option>
              <option value="admission">এডমিশন (Admission)</option>
            </select>
          </div>

          <div className="form-group">
            <label>Student ID</label>
            <input autoComplete="username" value={studentId} onChange={e=>setStudentId(e.target.value.replace(/\D/g,'').slice(0,7))} placeholder="2609001" inputMode="numeric" required maxLength={7} className="input-custom"/>
            <small className="hint-text">৭ ডিজিট • 2609 দিয়ে শুরু</small>
          </div>

          <div className="form-group">
            <label>Password</label>
            <input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="তোমার পাসওয়ার্ড" required className="input-custom"/>
          </div>

          {error && <div className="alert error"><AlertCircle size={18}/><span>{error}</span></div>}

          <button className="btn-login-submit" type="submit">লগইন করো <ChevronRight size={18}/></button>
        </form>

        <div className="login-footer-note">
          <ShieldCheck size={16}/>
          <span>PCA অনুমোদিত শিক্ষার্থীরাই প্রবেশ করতে পারবে।</span>
        </div>
      </div>
    </div>
  );
}

function SetupScreen() {
  return <div className="center-screen"><div className="login-glass-card"><h1>Supabase সংযোগ বাকি</h1></div></div>;
}

function SolutionView({solution,onBack,admin,onStatus}) {
  useEffect(() => {
    if (window.MathJax && window.MathJax.typesetPromise) {
      window.MathJax.typesetPromise();
    }
  }, [solution]);

  return (
    <div className="solution-full-view">
      <button className="btn-back-link" onClick={onBack}><ArrowLeft size={18}/> সমাধান তালিকায় ফিরুন</button>
      
      <div className="solution-card-header">
        <div className="badge-lg">অঙ্ক {solution.question_number}</div>
        <div>
          <span className="topic-tag">{solution.topics?.title || 'সাধারণ টপিক'}</span>
          <h2>{solution.title}</h2>
        </div>
      </div>

      {admin && (
        <div className="admin-status-bar">
          <span>স্ট্যাটাস: <b>{solution.status}</b></span>
          {solution.status !== 'published' ? (
            <button className="btn-sm btn-pub" onClick={()=>onStatus(solution,'published')}>Publish</button>
          ) : (
            <button className="btn-sm btn-draft" onClick={()=>onStatus(solution,'draft')}>Unpublish</button>
          )}
        </div>
      )}

      {solution.question_html && (
        <div className="solution-content-block question-block">
          <h3><CircleHelp size={20}/> প্রশ্ন</h3>
          <div className="rich-render" dangerouslySetInnerHTML={{__html:DOMPurify.sanitize(solution.question_html)}}/>
        </div>
      )}

      <div className="solution-content-block answer-block">
        <h3><CheckCircle2 size={20}/> সমাধান (Step-by-Step)</h3>
        {solution.solution_html ? (
          <div className="rich-render" dangerouslySetInnerHTML={{__html:DOMPurify.sanitize(solution.solution_html)}}/>
        ) : (
          <p className="muted-desc">এই অঙ্কের সমাধান এখনো আপলোড করা হয়নি।</p>
        )}
      </div>
    </div>
  );
}

function AdminImport({chapterList,importChapter,setImportChapter,importText,setImportText,importStatus,setImportStatus,importSolutions,importBusy}) {
  const example = `[{"question_number": 1, "title": "প্রশ্ন ১", "solution_html": "<p>সমাধান...</p>"}]`;
  return (
    <details className="admin-import-drawer">
      <summary><Upload size={18}/> AI সমাধান Import/Paste</summary>
      <form onSubmit={importSolutions} className="admin-import-form">
        <select value={importChapter} onChange={e=>setImportChapter(e.target.value)} required className="select-custom">
          <option value="">অধ্যায় বেছে নাও</option>
          {chapterList.map(c=><option value={c.id} key={c.id}>{c.subject} — {c.title}</option>)}
        </select>
        <textarea value={importText} onChange={e=>setImportText(e.target.value)} placeholder={example} rows={6} required className="input-custom"/>
        <button className="btn-primary" disabled={importBusy} type="submit">{importBusy ? 'Importing…' : 'Import'}</button>
      </form>
    </details>
  );
}

createRoot(document.getElementById('root')).render(<App/>);
