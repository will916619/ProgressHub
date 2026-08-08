import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity,
  ArrowLeft,
  Baby,
  BarChart3,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Gamepad2,
  HelpCircle,
  HeartPulse,
  Home,
  LogOut,
  Plus,
  ShieldCheck,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInAnonymously,
  signOut,
  signInWithPopup,
} from 'firebase/auth';
import { auth, db, firebaseReady } from './services/firebase';
import './styles.css';

const behaviorOptions = [
  'Calm transition',
  'Completed routine',
  'Used communication tool',
  'Sensory overload',
  'Aggression',
  'Self-injury concern',
  'Refused activity',
  'Sleep disruption',
];

const moodOptions = ['Calm', 'Happy', 'Tired', 'Anxious', 'Frustrated', 'Overwhelmed'];

const availableGames = [
  { id: 'pacman', name: 'Pac-Man' },
];

function App() {
  const [user, setUser] = useState(null);
  const [childSession, setChildSession] = useState(() => readChildSession());
  const [authLoading, setAuthLoading] = useState(true);
  const [route, setRoute] = useState(() => getRoute());

  useEffect(() => {
    const handlePopState = () => setRoute(getRoute());
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (!firebaseReady) {
      setAuthLoading(false);
      return undefined;
    }

    return onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
  }, []);

  if (!firebaseReady) {
    return <FirebaseSetupNotice />;
  }

  if (authLoading) {
    return (
      <main className="center-shell">
        <div className="loading-mark" />
      </main>
    );
  }

  if (!user && route === 'resources') {
    return <PublicResourcesPage onNavigate={setRoute} />;
  }

  if (!user) {
    return <AuthScreen route={route} onNavigate={setRoute} onChildLogin={setChildSession} />;
  }

  if (user.isAnonymous && childSession) {
    return <ChildPortal route={route} onNavigate={setRoute} childSession={childSession} onSessionChange={setChildSession} />;
  }

  if (user.isAnonymous) {
    return <AuthScreen route={route} onNavigate={setRoute} onChildLogin={setChildSession} />;
  }

  return (
    <ParentPortal user={user} route={route} onNavigate={setRoute} />
  );
}

function FirebaseSetupNotice() {
  return (
    <main className="setup-screen">
      <section className="setup-panel">
        <ShieldCheck size={34} />
        <h1>Connect Firebase to start ProgressHub</h1>
        <p>
          Add your Firebase web app values to a local <code>.env</code> file using
          the keys in <code>.env.example</code>, then restart the app.
        </p>
      </section>
    </main>
  );
}
     
function AuthScreen({ route, onNavigate, onChildLogin }) {
  const [message, setMessage] = useState('');
  const [childCode, setChildCode] = useState('');
  const [childMessage, setChildMessage] = useState('');

  async function handleGoogleSignIn() {
    setMessage('');

    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
    } catch (error) {
      setMessage(readableAuthError(error));
    }
  }

  async function handleChildLogin(event) {
    event.preventDefault();
    setChildMessage('');

    try {
      const code = normalizeAccessCode(childCode);
      if (!code) return;
      await signInAnonymously(auth);
      const accessSnapshot = await getDoc(doc(db, 'childAccess', code));

      if (!accessSnapshot.exists()) {
        setChildMessage('That child access code was not found.');
        await signOut(auth);
        return;
      }

      const session = { accessCode: code, ...accessSnapshot.data() };
      saveChildSession(session);
      onChildLogin(session);
    } catch (error) {
      setChildMessage(readableAuthError(error));
    }
  }

  return (
    <main className="auth-screen">
      <section className="auth-hero" aria-label="ProgressHub overview">
        <TopToolbar
          activeView="home"
          homeLabel="Home"
          onHome={() => navigateTo('/', onNavigate)}
          onResources={() => navigateTo('/resources', onNavigate)}
        />
        <div className="brand-row">
          <HeartPulse />
          <span>ProgressHub</span>
        </div>
        <h1>Daily care tracking for families who need clarity fast.</h1>
        <p>
          Log behavior, spot patterns, and give children a playful break in one
          private parent workspace.
        </p>
        <div className="trust-strip">
          <span><BarChart3 size={17} /> Pattern summaries</span>
          <span><Gamepad2 size={17} /> Pac-Man game</span>
        </div>
      </section>

      <section className="auth-card" aria-label="Sign in with Google">
        <div className="auth-section">
          <h2>Parent sign in</h2>
          <p className="auth-card-copy">
            Parents use Google to manage care notes and game permissions.
          </p>
          <div className="stack">
            {message && <p className="form-error">{message}</p>}
            <button className="primary-button google-button" onClick={handleGoogleSignIn} type="button">
              <span className="google-mark" aria-hidden="true">G</span>
              Sign in with Google
            </button>
          </div>
        </div>

        <div className="auth-divider" />

        <div className="auth-section">
          <h2>Child games</h2>
          <p className="auth-card-copy">
            Children enter the access code created by their parent.
          </p>
          <form className="stack" onSubmit={handleChildLogin}>
            <input
              value={childCode}
              onChange={(event) => setChildCode(event.target.value.toUpperCase())}
              placeholder="Access code"
              autoComplete="off"
              required
            />
            {childMessage && <p className="form-error">{childMessage}</p>}
            <button className="primary-button" type="submit">
              <Gamepad2 size={18} />
              Open games
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

function PublicResourcesPage({ onNavigate }) {
  return (
    <main className="public-page">
      <header className="public-header">
        <div className="brand-row compact">
          <HeartPulse />
          <span>ProgressHub</span>
        </div>
        <TopToolbar
          activeView="resources"
          homeLabel="Home"
          onHome={() => navigateTo('/', onNavigate)}
          onResources={() => navigateTo('/resources', onNavigate)}
        />
      </header>
      <section className="public-content">
        <p className="eyebrow">Public resources</p>
        <h1>Helpful links</h1>
        <p className="public-copy">
          Placeholder links for school, government, insurance, and community support.
        </p>
        <ResourcesPage />
      </section>
    </main>
  );
}

function ParentPortal({ user, route, onNavigate }) {
  const [children, setChildren] = useState([]);
  const [logs, setLogs] = useState([]);
  const [selectedChildId, setSelectedChildId] = useState('');
  const activeView = route === 'behavior' || route === 'resources' ? route : 'dashboard';

  useEffect(() => {
    const childQuery = query(collection(db, 'children'), where('parentId', '==', user.uid));
    return onSnapshot(childQuery, (snapshot) => {
      const nextChildren = snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() }))
        .sort((a, b) => timestampMillis(b.createdAt) - timestampMillis(a.createdAt));
      setChildren(nextChildren);
      setSelectedChildId((current) => current || nextChildren[0]?.id || '');
    });
  }, [user.uid]);

  useEffect(() => {
    const logQuery = query(collection(db, 'behaviorLogs'), where('parentId', '==', user.uid));
    return onSnapshot(logQuery, (snapshot) => {
      setLogs(
        snapshot.docs
          .map((item) => ({ id: item.id, ...item.data() }))
          .sort((a, b) => timestampMillis(b.createdAt) - timestampMillis(a.createdAt)),
      );
    });
  }, [user.uid]);

  const selectedChild = children.find((child) => child.id === selectedChildId);
  const childLogs = selectedChildId ? logs.filter((log) => log.childId === selectedChildId) : logs;
  const stats = useMemo(() => summarizeLogs(childLogs), [childLogs]);

  return (
    <main className="app-shell">
      <aside className="sidebar" aria-label="Main navigation">
        <div className="brand-row compact">
          <HeartPulse />
          <span>ProgressHub</span>
        </div>
        <nav>
          <NavButton icon={<Home />} label="Dashboard" active={activeView === 'dashboard'} onClick={() => navigateTo('/dashboard', onNavigate)} />
          <NavButton icon={<Activity />} label="Behavior" active={activeView === 'behavior'} onClick={() => navigateTo('/behavior', onNavigate)} />
        </nav>
        <button className="ghost-button signout" onClick={handleSignOut} type="button">
          <LogOut size={18} />
          Sign out
        </button>
      </aside>

      <section className="content-shell">
        <header className="topbar">
          <div>
            <p className="eyebrow">Parent workspace</p>
            <h1>{activeView === 'resources' ? 'Resources' : selectedChild ? `${selectedChild.name}'s care notes` : 'Care dashboard'}</h1>
          </div>
          <div className="topbar-actions">
            <TopToolbar
              activeView={activeView}
              homeLabel="Home"
              onHome={() => navigateTo('/dashboard', onNavigate)}
              onResources={() => navigateTo('/resources', onNavigate)}
            />
            {activeView !== 'resources' && (
              <ChildSelector children={children} selectedChildId={selectedChildId} onChange={setSelectedChildId} />
            )}
          </div>
        </header>

        {activeView === 'dashboard' && (
          <Dashboard children={children} selectedChild={selectedChild} childLogs={childLogs} stats={stats} userId={user.uid} />
        )}
        {activeView === 'behavior' && (
          <BehaviorTracker children={children} selectedChildId={selectedChildId} logs={childLogs} userId={user.uid} />
        )}
        {activeView === 'resources' && <ResourcesPage />}
      </section>
    </main>
  );

  function handleSignOut() {
    clearChildSession();
    signOut(auth);
  }
}

function TopToolbar({ activeView, homeLabel, onHome, onResources }) {
  return (
    <nav className="top-toolbar" aria-label="Quick navigation">
      <button className={activeView !== 'resources' ? 'active' : ''} onClick={onHome} type="button">
        <Home size={17} />
        {homeLabel}
      </button>
      <button className={activeView === 'resources' ? 'active' : ''} onClick={onResources} type="button">
        <BookOpen size={17} />
        Resources
      </button>
    </nav>
  );
}

function NavButton({ icon, label, active, onClick }) {
  return (
    <button className={`nav-button ${active ? 'active' : ''}`} onClick={onClick} type="button">
      {React.cloneElement(icon, { size: 19 })}
      <span>{label}</span>
    </button>
  );
}

function ChildSelector({ children, selectedChildId, onChange }) {
  if (!children.length) return null;

  return (
    <label className="child-select">
      Child
      <select value={selectedChildId} onChange={(event) => onChange(event.target.value)}>
        {children.map((child) => (
          <option key={child.id} value={child.id}>{child.name}</option>
        ))}
      </select>
    </label>
  );
}

function Dashboard({ children, selectedChild, childLogs, stats, userId }) {
  return (
    <div className="dashboard-grid">
      <section className="profile-panel">
        <div className="panel-heading">
          <h2>Children</h2>
          <Baby size={22} />
        </div>
        <ChildForm userId={userId} />
        <div className="child-list">
          {children.map((child) => (
            <article className="child-card" key={child.id}>
              <div>
                <h3>{child.name}</h3>
                <p>{child.age ? `${child.age} years old` : 'Age not set'} - {child.supportNeeds || 'Support notes open'}</p>
                <p className="access-code">Child code: <strong>{child.accessCode || 'Not set'}</strong></p>
                <GamePermissionEditor child={child} />
              </div>
              <button className="icon-button" aria-label={`Delete ${child.name}`} onClick={() => deleteChild(child)} type="button">
                <Trash2 size={17} />
              </button>
            </article>
          ))}
          {!children.length && <p className="empty-text">Add a child profile to begin tracking.</p>}
        </div>
      </section>

      <section className="insights-panel">
        <div className="panel-heading">
          <h2>{selectedChild ? 'Today at a glance' : 'Family overview'}</h2>
          <CalendarDays size={22} />
        </div>
        <div className="stat-grid">
          <Stat label="Logs" value={childLogs.length} />
          <Stat label="Positive moments" value={stats.positive} />
          <Stat label="Needs support" value={stats.support} />
          <Stat label="Most noted mood" value={stats.topMood || 'None'} />
        </div>
        <RecentTimeline logs={childLogs.slice(0, 5)} />
      </section>
    </div>
  );
}

function ChildForm({ userId }) {
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [supportNeeds, setSupportNeeds] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    const accessCode = generateAccessCode();
    const childRef = await addDoc(collection(db, 'children'), {
      parentId: userId,
      role: 'child',
      name,
      age,
      supportNeeds,
      accessCode,
      allowedGames: ['pacman'],
      createdAt: serverTimestamp(),
    });

    await setDoc(doc(db, 'childAccess', accessCode), {
      parentId: userId,
      childId: childRef.id,
      childName: name,
      role: 'child',
      allowedGames: ['pacman'],
      createdAt: serverTimestamp(),
    });

    setName('');
    setAge('');
    setSupportNeeds('');
  }

  return (
    <form className="mini-form" onSubmit={handleSubmit}>
      <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Child name" required />
      <input value={age} onChange={(event) => setAge(event.target.value)} placeholder="Age" inputMode="numeric" />
      <input value={supportNeeds} onChange={(event) => setSupportNeeds(event.target.value)} placeholder="Support notes" />
      <button className="primary-button" type="submit"><Plus size={17} /> Add child and create code</button>
    </form>
  );
}

function GamePermissionEditor({ child }) {
  const allowedGameIds = child.allowedGames || [];

  async function handleToggle(gameId, checked) {
    const nextGames = checked
      ? Array.from(new Set([...allowedGameIds, gameId]))
      : allowedGameIds.filter((allowedGameId) => allowedGameId !== gameId);

    await updateDoc(doc(db, 'children', child.id), { allowedGames: nextGames });

    if (child.accessCode) {
      await setDoc(doc(db, 'childAccess', child.accessCode), {
        parentId: child.parentId,
        childId: child.id,
        childName: child.name,
        role: 'child',
        allowedGames: nextGames,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    }
  }

  return (
    <div className="permission-panel">
      <p>Allowed games</p>
      {availableGames.map((game) => (
        <label className="toggle-row" key={game.id}>
          <input
            type="checkbox"
            checked={allowedGameIds.includes(game.id)}
            onChange={(event) => handleToggle(game.id, event.target.checked)}
          />
          <span>{game.name}</span>
        </label>
      ))}
    </div>
  );
}

async function deleteChild(child) {
  await deleteDoc(doc(db, 'children', child.id));
  if (child.accessCode) {
    await deleteDoc(doc(db, 'childAccess', child.accessCode));
  }
}

function BehaviorTracker({ children, selectedChildId, logs, userId }) {
  return (
    <div className="behavior-layout">
      <BehaviorForm children={children} selectedChildId={selectedChildId} userId={userId} />
      <section className="log-panel">
        <div className="panel-heading">
          <h2>Behavior history</h2>
          <Activity size={22} />
        </div>
        <RecentTimeline logs={logs} showDelete />
      </section>
    </div>
  );
}

function BehaviorForm({ children, selectedChildId, userId }) {
  const [childId, setChildId] = useState(selectedChildId);
  const [behavior, setBehavior] = useState(behaviorOptions[0]);
  const [mood, setMood] = useState(moodOptions[0]);
  const [intensity, setIntensity] = useState(3);
  const [notes, setNotes] = useState('');
  const [saveState, setSaveState] = useState('idle');

  useEffect(() => {
    setChildId(selectedChildId);
  }, [selectedChildId]);

  async function handleSubmit(event) {
    event.preventDefault();
    if (!childId) return;

    try {
      setSaveState('saving');
      await addDoc(collection(db, 'behaviorLogs'), {
        parentId: userId,
        childId,
        behavior,
        mood,
        intensity: Number(intensity),
        notes,
        createdAt: serverTimestamp(),
      });
      setBehavior(behaviorOptions[0]);
      setMood(moodOptions[0]);
      setIntensity(3);
      setNotes('');
      setSaveState('saved');
      window.setTimeout(() => setSaveState('idle'), 2400);
    } catch (error) {
      setSaveState(error.code === 'permission-denied' ? 'permission-denied' : 'error');
    }
  }

  return (
    <section className="form-panel">
      <div className="panel-heading">
        <h2>New behavior note</h2>
        <Sparkles size={22} />
      </div>
      <form className="stack" onSubmit={handleSubmit}>
        <label>
          <FieldLabel
            label="Child"
            help="Choose which child this behavior note should be saved under in Firebase."
          />
          <select value={childId} onChange={(event) => setChildId(event.target.value)} required>
            <option value="" disabled>Select child</option>
            {children.map((child) => <option key={child.id} value={child.id}>{child.name}</option>)}
          </select>
        </label>
        <label>
          <FieldLabel
            label="Behavior"
            help="Pick the main behavior or event you observed so patterns are easier to review later."
          />
          <select value={behavior} onChange={(event) => setBehavior(event.target.value)}>
            {behaviorOptions.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label>
          <FieldLabel
            label="Mood"
            help="Record how the child seemed emotionally during the event."
          />
          <select value={mood} onChange={(event) => setMood(event.target.value)}>
            {moodOptions.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label>
          <FieldLabel
            label={`Intensity: ${intensity}`}
            help="Rate how strong the behavior was from 1, very mild, to 5, very intense."
          />
          <input value={intensity} onChange={(event) => setIntensity(event.target.value)} type="range" min="1" max="5" />
        </label>
        <label>
          <FieldLabel
            label="Notes"
            help="Add details such as triggers, supports used, what helped, and anything to share with caregivers."
          />
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows="4" placeholder="Triggers, supports used, what helped..." />
        </label>
        <button className="primary-button" type="submit" disabled={!children.length || saveState === 'saving'}>
          <CheckCircle2 size={18} />
          {saveState === 'saving' ? 'Saving...' : 'Save note'}
        </button>
        {saveState === 'saved' && <p className="save-status success">Saved to Firebase.</p>}
        {saveState === 'permission-denied' && (
          <p className="save-status error">
            Firebase blocked this save. Publish the Firestore rules included with this project.
          </p>
        )}
        {saveState === 'error' && <p className="save-status error">Could not save to Firebase. Check your connection and Firestore rules.</p>}
      </form>
    </section>
  );
}

function FieldLabel({ label, help }) {
  return (
    <span className="field-label">
      <span>{label}</span>
      <span className="tooltip-wrap">
        <HelpCircle size={16} aria-hidden="true" />
        <span className="tooltip" role="tooltip">{help}</span>
      </span>
    </span>
  );
}

function RecentTimeline({ logs, showDelete = false }) {
  if (!logs.length) {
    return <p className="empty-text">No behavior notes yet.</p>;
  }

  return (
    <div className="timeline">
      {logs.map((log) => (
        <article className="timeline-item" key={log.id}>
          <span className={`mood-dot mood-${log.mood?.toLowerCase() || 'calm'}`} />
          <div>
            <h3>{log.behavior}</h3>
            <p>{log.mood} - intensity {log.intensity} - {formatDate(log.createdAt)}</p>
            {log.notes && <p className="note-copy">{log.notes}</p>}
          </div>
          {showDelete && (
            <button className="icon-button" aria-label="Delete behavior note" onClick={() => deleteDoc(doc(db, 'behaviorLogs', log.id))} type="button">
              <Trash2 size={17} />
            </button>
          )}
        </article>
      ))}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Games({ allowedGames = availableGames.map((game) => game.id) }) {
  const canPlayPacman = allowedGames.includes('pacman');

  return (
    <section className="game-layout">
      <div className="game-copy">
        <p className="eyebrow">Entertainment break</p>
        <h2>Pac-Man</h2>
        <p>{canPlayPacman ? 'Use arrow keys, WASD, or the on-screen controls to collect dots and avoid the ghosts.' : 'Ask your parent to turn on Pac-Man for this child account.'}</p>
      </div>
      {canPlayPacman ? <PacManGame /> : (
        <div className="locked-game">
          <ShieldCheck size={30} />
          <p>Pac-Man is locked.</p>
        </div>
      )}
    </section>
  );
}

const resourceTree = {
  title: 'California Special Needs Resource Guide',
  description: 'This website is designed to provide consolidated information for families of special needs children and individuals of resources available from government, insurance providers, school districts, and communities, most relevant to California.',
  children: [
    {
      slug: 'identify-needs',
      title: 'How Families Identify Needs',
      description: 'Start here to review common signs, symptoms, and professional diagnosis pathways.',
      children: [
        {
          slug: 'possible-symptoms',
          title: 'Possible Symptoms',
          description: 'Information about possible symptoms of Autism Spectrum Disorder (ASD) and Attention-Deficit/Hyperactivity Disorder (ADHD).',
          children: [
            {
              slug: 'asd-symptoms',
              title: 'Autism Spectrum Disorder (ASD) Symptoms',
              description: 'Review external medical and public health resources about signs and symptoms of ASD.',
              links: [
                { label: 'CDC: Autism signs and symptoms', href: 'https://www.cdc.gov/autism/signs-symptoms/index.html' },
                { label: 'Mayo Clinic: Autism spectrum disorder symptoms and causes', href: 'https://www.mayoclinic.org/diseases-conditions/autism-spectrum-disorder/symptoms-causes/syc-20352928' },
              ],
            },
            {
              slug: 'adhd-symptoms',
              title: 'Attention-Deficit/Hyperactivity Disorder (ADHD)',
              description: 'Review public health information about ADHD.',
              links: [
                { label: 'CDC: About ADHD', href: 'https://www.cdc.gov/adhd/about/index.html' },
              ],
            },
          ],
        },
        {
          slug: 'diagnosis',
          title: 'Diagnosis from Medical Professionals',
          description: 'Professionals who may diagnose ASD or ADHD.',
          children: [
            {
              slug: 'asd-diagnosis',
              title: 'Doctors Who Can Diagnose ASD',
              description: 'Examples include psychiatrists, developmental pediatricians, child or pediatric neurologists, clinical psychologists, neuropsychologists, and other qualified professionals.',
            },
            {
              slug: 'adhd-diagnosis',
              title: 'Doctors Who Can Diagnose ADHD',
              description: 'Examples include general practitioners, pediatricians, psychiatrists, neurologists, psychologists, and other qualified professionals.',
            },
          ],
        },
      ],
    },
    {
      slug: 'resources',
      title: 'Resources Available for Special Needs Families',
      description: 'Explore government, insurance, school district, and community resource paths.',
      children: [
        {
          slug: 'government',
          title: 'Government Resources',
          description: 'California public programs and agencies that may support families.',
          children: [
            {
              slug: 'regional-centers',
              title: 'Services Provided by California Regional Centers',
              description: 'Programs administered through the California Department of Developmental Services.',
              links: [
                { label: 'Traditional Program: California Department of Developmental Services Regional Centers', href: 'https://www.dds.ca.gov/rc/' },
                { label: 'Self-Determination Program (SDP)', href: 'https://www.dds.ca.gov/initiatives/sdp/' },
              ],
            },
            {
              slug: 'ihss',
              title: 'California In-Home Supportive Services (IHSS)',
              description: 'California IHSS information from the Department of Social Services.',
              links: [
                { label: 'California In-Home Supportive Services (IHSS)', href: 'https://www.cdss.ca.gov/in-home-supportive-services' },
              ],
            },
          ],
        },
        {
          slug: 'health-insurance',
          title: 'Health Insurance Resources',
          description: 'Services and insurance pathways that may help cover therapies.',
          children: [
            {
              slug: 'covered-services',
              title: 'Resources Potentially Covered by Health Insurance',
              description: 'Coverage depends on diagnosis, plan rules, eligibility, medical necessity, and provider network.',
              children: [
                {
                  slug: 'aba-therapy',
                  title: 'ABA Therapy',
                  description: 'Applied Behavior Analysis (ABA) therapy is a behavioral treatment that uses positive reinforcement to build communication, social, and daily living skills while reducing harmful behaviors, primarily for individuals with autism.',
                },
                {
                  slug: 'speech-therapy',
                  title: 'Speech Therapy',
                  description: 'Speech therapy evaluates and treats communication, cognitive, and swallowing disorders by a speech-language pathologist (SLP).',
                },
                {
                  slug: 'occupational-therapy',
                  title: 'Occupational Therapy',
                  description: 'Occupational therapy may support daily living, sensory, motor, and functional skills.',
                },
              ],
            },
            {
              slug: 'insurance-types',
              title: 'Types of Insurance or Funding Paths',
              description: 'Common ways families may access ABA, speech, and occupational therapies.',
              children: [
                {
                  slug: 'private-insurance',
                  title: 'Private Insurance',
                  description: 'Private insurance may be available through parents employment or personal purchase. Examples include Aetna, Anthem Blue Cross, UnitedHealthcare, Cigna, and other plans.',
                },
                {
                  slug: 'regional-center-eligibility',
                  title: 'Regional Center Eligibility',
                  description: 'California Regional Center services require eligibility review and evaluation by regional centers.',
                  links: [
                    { label: 'California DDS: Regional Center eligibility', href: 'https://www.dds.ca.gov/general/eligibility/' },
                  ],
                },
                {
                  slug: 'medi-cal',
                  title: 'Medi-Cal',
                  description: 'Medi-Cal is California Medicaid. Standard applications may require meeting requirements such as income limits.',
                  links: [
                    { label: 'Apply for Medi-Cal', href: 'https://www.dhcs.ca.gov/medi-cal/apply/' },
                  ],
                },
              ],
            },
          ],
        },
        {
          slug: 'school-district',
          title: 'School District Resources',
          description: 'Supports that may be available through school districts.',
          children: [
            {
              slug: 'iep',
              title: 'Individualized Education Program (IEP)',
              description: 'IEPs may provide school-based supports and services for eligible students. School district-specific links can be added later.',
            },
          ],
        },
        {
          slug: 'communities',
          title: 'Community Resources',
          description: 'Community-provided resources and links can be added later.',
        },
      ],
    },
  ],
};

function ResourcesPage() {
  const [resourcePath, setResourcePath] = useState(() => getResourcePath());
  const currentNode = findResourceNode(resourcePath) || resourceTree;
  const breadcrumbs = getResourceBreadcrumbs(resourcePath);
  const hasChildren = !!currentNode.children?.length;
  const hasLinks = !!currentNode.links?.length;
  const parentPath = resourcePath.slice(0, -1);

  useEffect(() => {
    const handlePopState = () => setResourcePath(getResourcePath());
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  function openResourcePath(nextPath) {
    const url = `/resources${nextPath.length ? `/${nextPath.join('/')}` : ''}`;
    window.history.pushState({}, '', url);
    setResourcePath(nextPath);
  }

  return (
    <>
      <section className="resource-statement">
        {resourcePath.length > 0 && (
          <button className="resource-back" onClick={() => openResourcePath(parentPath)} type="button">
            <ArrowLeft size={17} />
            Back
          </button>
        )}
        <nav className="resource-breadcrumbs" aria-label="Resource hierarchy">
          <button onClick={() => openResourcePath([])} type="button">Resources</button>
          {breadcrumbs.map((crumb) => (
            <React.Fragment key={crumb.path.join('/')}>
              <ChevronRight size={14} />
              <button onClick={() => openResourcePath(crumb.path)} type="button">{crumb.title}</button>
            </React.Fragment>
          ))}
        </nav>
        <h2>{currentNode.title}</h2>
        <p>{currentNode.description}</p>
      </section>

      {hasChildren && (
        <section className="resources-layout">
          {currentNode.children.map((child) => {
            const nextPath = [...resourcePath, child.slug];
            return (
              <button className="resource-card resource-action-card" key={child.slug} onClick={() => openResourcePath(nextPath)} type="button">
                <div className="resource-heading">
                  <div>
                    <h2>{child.title}</h2>
                    <p>{child.description}</p>
                  </div>
                  <ChevronRight size={22} />
                </div>
              </button>
            );
          })}
        </section>
      )}

      {hasLinks && (
        <section className="resource-card resource-link-card">
          <div className="resource-heading">
            <div>
              <h2>Resource Links</h2>
              <p>Open the resource that best matches what you need.</p>
            </div>
            <BookOpen size={22} />
          </div>
          <div className="resource-links">
            {currentNode.links.map((link) => (
              <a href={link.href} key={link.label} target="_blank" rel="noreferrer">
                <span>{link.label}</span>
                <ExternalLink size={16} />
              </a>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function ChildPortal({ route, onNavigate, childSession, onSessionChange }) {
  const [access, setAccess] = useState(childSession);
  const activeView = route === 'resources' ? 'resources' : 'games';

  useEffect(() => {
    if (!childSession?.accessCode) return undefined;

    return onSnapshot(doc(db, 'childAccess', childSession.accessCode), (snapshot) => {
      if (!snapshot.exists()) {
        clearChildSession();
        onSessionChange(null);
        signOut(auth);
        return;
      }

      const nextAccess = { accessCode: childSession.accessCode, ...snapshot.data() };
      setAccess(nextAccess);
      saveChildSession(nextAccess);
      onSessionChange(nextAccess);
    });
  }, [childSession?.accessCode, onSessionChange]);

  function handleSignOut() {
    clearChildSession();
    onSessionChange(null);
    signOut(auth);
  }

  return (
    <main className="child-shell">
      <header className="child-topbar">
        <div className="brand-row compact">
          <HeartPulse />
          <span>ProgressHub</span>
        </div>
        <div className="topbar-actions">
          <TopToolbar
            activeView={activeView === 'resources' ? 'resources' : 'games'}
            homeLabel="Home"
            onHome={() => navigateTo('/games', onNavigate)}
            onResources={() => navigateTo('/resources', onNavigate)}
          />
          <button className="ghost-button" onClick={handleSignOut} type="button">
            <LogOut size={18} />
            Sign out
          </button>
        </div>
      </header>
      <section className="child-content">
        <p className="eyebrow">{activeView === 'resources' ? 'Helpful links' : 'Child games'}</p>
        <h1>{activeView === 'resources' ? 'Resources' : access?.childName ? `${access.childName}'s games` : 'Games'}</h1>
        {activeView === 'games' && <Games allowedGames={access?.allowedGames || []} />}
        {activeView === 'resources' && <ResourcesPage />}
      </section>
    </main>
  );
}

const tile = 22;
const map = [
  '###################',
  '#........#........#',
  '#.###.##.#.##.###.#',
  '#o#.............#o#',
  '#.###.#.###.#.###.#',
  '#.....#..#..#.....#',
  '#####.## # ##.#####',
  '    #.#     #.#    ',
  '#####.# ### #.#####',
  '     .  # #  .     ',
  '#####.# ### #.#####',
  '    #.#     #.#    ',
  '#####.# ### #.#####',
  '#........#........#',
  '#.###.##.#.##.###.#',
  '#o..#.........#..o#',
  '###.#.#.###.#.#.###',
  '#.....#..#..#.....#',
  '#.#######.#######.#',
  '#.................#',
  '###################',
];

const directions = {
  ArrowUp: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  w: { x: 0, y: -1 },
  s: { x: 0, y: 1 },
  a: { x: -1, y: 0 },
  d: { x: 1, y: 0 },
};

function PacManGame() {
  const canvasRef = useRef(null);
  const requestRef = useRef(0);
  const [gameState, setGameState] = useState(() => createGameState());

  useEffect(() => {
    function handleKeyDown(event) {
      const direction = directions[event.key];
      if (!direction) return;
      event.preventDefault();
      setGameState((current) => ({ ...current, nextDirection: direction, status: current.status === 'ready' ? 'playing' : current.status }));
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const context = canvasRef.current.getContext('2d');
    let previous = performance.now();

    function frame(now) {
      const delta = Math.min((now - previous) / 1000, 0.08);
      previous = now;
      setGameState((current) => updateGame(current, delta));
      drawGame(context, gameState);
      requestRef.current = requestAnimationFrame(frame);
    }

    requestRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(requestRef.current);
  }, [gameState]);

  function press(direction) {
    setGameState((current) => ({ ...current, nextDirection: direction, status: current.status === 'ready' ? 'playing' : current.status }));
  }

  function restart() {
    setGameState(createGameState());
  }

  return (
    <div className="game-frame">
      <div className="game-hud">
        <span>Score <strong>{gameState.score}</strong></span>
        <span>Lives <strong>{gameState.lives}</strong></span>
        <button className="ghost-button" onClick={restart} type="button">Reset</button>
      </div>
      <canvas
        ref={canvasRef}
        width={map[0].length * tile}
        height={map.length * tile}
        aria-label="Pac-Man maze game"
      />
      <div className="touch-controls" aria-label="Game controls">
        <button onClick={() => press({ x: 0, y: -1 })} type="button">Up</button>
        <button onClick={() => press({ x: -1, y: 0 })} type="button">Left</button>
        <button onClick={() => press({ x: 1, y: 0 })} type="button">Right</button>
        <button onClick={() => press({ x: 0, y: 1 })} type="button">Down</button>
      </div>
    </div>
  );
}

function createGameState() {
  return {
    maze: map.map((row) => row.split('')),
    pacman: { x: 9, y: 15, direction: { x: 1, y: 0 }, progress: 0 },
    nextDirection: { x: 1, y: 0 },
    ghosts: [
      { x: 9, y: 9, direction: { x: 1, y: 0 }, color: '#ff4d6d' },
      { x: 8, y: 9, direction: { x: -1, y: 0 }, color: '#2dd4bf' },
      { x: 10, y: 9, direction: { x: 0, y: -1 }, color: '#f97316' },
    ],
    score: 0,
    lives: 3,
    status: 'ready',
    tick: 0,
  };
}

function updateGame(state, delta) {
  if (state.status !== 'playing') return state;

  const nextState = { ...state, tick: state.tick + delta, maze: state.maze.map((row) => [...row]) };
  if (nextState.tick < 0.16) return nextState;
  nextState.tick = 0;

  const pacDirection = canMove(nextState.pacman.x, nextState.pacman.y, nextState.nextDirection)
    ? nextState.nextDirection
    : nextState.pacman.direction;
  const pacman = moveEntity(nextState.pacman, pacDirection);
  nextState.pacman = pacman;

  const cell = nextState.maze[pacman.y]?.[pacman.x];
  if (cell === '.') {
    nextState.score += 10;
    nextState.maze[pacman.y][pacman.x] = ' ';
  }
  if (cell === 'o') {
    nextState.score += 50;
    nextState.maze[pacman.y][pacman.x] = ' ';
  }

  nextState.ghosts = nextState.ghosts.map((ghost, index) => {
    const options = Object.values(directions).filter((direction) => canMove(ghost.x, ghost.y, direction));
    const preferred = chooseGhostDirection(ghost, pacman, options, index);
    return moveEntity(ghost, preferred);
  });

  if (nextState.ghosts.some((ghost) => ghost.x === pacman.x && ghost.y === pacman.y)) {
    nextState.lives -= 1;
    nextState.pacman = { x: 9, y: 15, direction: { x: 1, y: 0 }, progress: 0 };
    nextState.ghosts = createGameState().ghosts;
    nextState.status = nextState.lives <= 0 ? 'gameover' : 'ready';
  }

  const dotsLeft = nextState.maze.some((row) => row.some((cellItem) => cellItem === '.' || cellItem === 'o'));
  if (!dotsLeft) nextState.status = 'won';

  return nextState;
}

function canMove(x, y, direction) {
  const targetX = wrapX(x + direction.x);
  const targetY = y + direction.y;
  return map[targetY]?.[targetX] !== '#';
}

function moveEntity(entity, direction) {
  if (!canMove(entity.x, entity.y, direction)) return { ...entity, direction };
  return {
    ...entity,
    x: wrapX(entity.x + direction.x),
    y: entity.y + direction.y,
    direction,
  };
}

function wrapX(x) {
  if (x < 0) return map[0].length - 1;
  if (x >= map[0].length) return 0;
  return x;
}

function chooseGhostDirection(ghost, pacman, options, index) {
  if (!options.length) return ghost.direction;
  const distance = (direction) => {
    const x = wrapX(ghost.x + direction.x);
    const y = ghost.y + direction.y;
    return Math.abs(x - pacman.x) + Math.abs(y - pacman.y);
  };
  const sorted = [...options].sort((a, b) => distance(a) - distance(b));
  return index === 1 ? sorted[sorted.length - 1] : sorted[0];
}

function drawGame(context, state) {
  if (!context) return;
  context.clearRect(0, 0, map[0].length * tile, map.length * tile);
  context.fillStyle = '#071019';
  context.fillRect(0, 0, map[0].length * tile, map.length * tile);

  state.maze.forEach((row, y) => {
    row.forEach((cell, x) => {
      const px = x * tile;
      const py = y * tile;
      if (cell === '#') {
        context.fillStyle = '#2563eb';
        context.fillRect(px + 2, py + 2, tile - 4, tile - 4);
      }
      if (cell === '.' || cell === 'o') {
        context.fillStyle = '#f8fafc';
        context.beginPath();
        context.arc(px + tile / 2, py + tile / 2, cell === 'o' ? 5 : 2, 0, Math.PI * 2);
        context.fill();
      }
    });
  });

  context.fillStyle = '#facc15';
  context.beginPath();
  context.arc(state.pacman.x * tile + tile / 2, state.pacman.y * tile + tile / 2, tile * 0.4, 0.25 * Math.PI, 1.75 * Math.PI);
  context.lineTo(state.pacman.x * tile + tile / 2, state.pacman.y * tile + tile / 2);
  context.fill();

  state.ghosts.forEach((ghost) => {
    context.fillStyle = ghost.color;
    context.beginPath();
    context.arc(ghost.x * tile + tile / 2, ghost.y * tile + tile / 2, tile * 0.38, Math.PI, 0);
    context.lineTo(ghost.x * tile + tile * 0.88, ghost.y * tile + tile * 0.86);
    context.lineTo(ghost.x * tile + tile * 0.12, ghost.y * tile + tile * 0.86);
    context.closePath();
    context.fill();
  });

  if (state.status === 'ready' || state.status === 'gameover' || state.status === 'won') {
    context.fillStyle = 'rgba(7, 16, 25, 0.78)';
    context.fillRect(0, 0, map[0].length * tile, map.length * tile);
    context.fillStyle = '#ffffff';
    context.font = '700 24px Inter, sans-serif';
    context.textAlign = 'center';
    const message = state.status === 'won' ? 'You won!' : state.status === 'gameover' ? 'Game over' : 'Press an arrow to play';
    context.fillText(message, (map[0].length * tile) / 2, (map.length * tile) / 2);
  }
}

function summarizeLogs(logs) {
  const positiveSet = new Set(['Calm transition', 'Completed routine', 'Used communication tool']);
  const moodCounts = logs.reduce((acc, log) => {
    acc[log.mood] = (acc[log.mood] || 0) + 1;
    return acc;
  }, {});
  const topMood = Object.entries(moodCounts).sort((a, b) => b[1] - a[1])[0]?.[0];
  return {
    positive: logs.filter((log) => positiveSet.has(log.behavior)).length,
    support: logs.filter((log) => Number(log.intensity) >= 4).length,
    topMood,
  };
}

function readableAuthError(error) {
  if (error.code === 'auth/popup-closed-by-user') return 'The Google sign-in window was closed before finishing.';
  if (error.code === 'auth/popup-blocked') return 'Your browser blocked the Google sign-in window.';
  if (error.code === 'auth/unauthorized-domain') return 'Add this website domain to Firebase Authentication authorized domains.';
  if (error.code === 'permission-denied') return 'Firebase blocked this request. Publish the updated Firestore rules.';
  return 'Something went wrong. Please try again.';
}

function formatDate(timestamp) {
  const date = timestamp?.toDate ? timestamp.toDate() : new Date();
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function timestampMillis(timestamp) {
  return timestamp?.toMillis ? timestamp.toMillis() : 0;
}

function generateAccessCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
}

function normalizeAccessCode(code) {
  return code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function readChildSession() {
  try {
    const storedSession = window.localStorage.getItem('progresshub-child-session');
    return storedSession ? JSON.parse(storedSession) : null;
  } catch (error) {
    return null;
  }
}

function saveChildSession(session) {
  window.localStorage.setItem('progresshub-child-session', JSON.stringify(session));
}

function clearChildSession() {
  window.localStorage.removeItem('progresshub-child-session');
}

function getRoute() {
  const path = window.location.pathname.replace(/^\/+|\/+$/g, '');
  if (path === 'resources' || path.startsWith('resources/')) return 'resources';
  if (path === 'behavior') return 'behavior';
  if (path === 'games') return 'games';
  if (path === 'dashboard') return 'dashboard';
  return 'home';
}

function navigateTo(path, onNavigate) {
  if (window.location.pathname !== path) {
    window.history.pushState({}, '', path);
  }
  onNavigate(getRoute());
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function getResourcePath() {
  const parts = window.location.pathname.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
  return parts[0] === 'resources' ? parts.slice(1) : [];
}

function findResourceNode(path) {
  return path.reduce((node, slug) => node?.children?.find((child) => child.slug === slug), resourceTree);
}

function getResourceBreadcrumbs(path) {
  const crumbs = [];
  let node = resourceTree;

  path.forEach((slug, index) => {
    node = node?.children?.find((child) => child.slug === slug);
    if (node) {
      crumbs.push({ title: node.title, path: path.slice(0, index + 1) });
    }
  });

  return crumbs;
}

createRoot(document.getElementById('root')).render(<App />);
