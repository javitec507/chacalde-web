import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { Header, Footer } from './components/Chrome.jsx';
import Home from './components/Home.jsx';
import Loader, { useBoot } from './components/Loader.jsx';
const loadResult = () => import('./components/Result.jsx');
const Result = lazy(loadResult);
import { randomTurno } from './components/ui.jsx';
import { track } from './lib/track.js';

export default function App() {
  const [name, setName] = useState('');
  const [view, setView] = useState('inicio');
  const [submitted, setSubmitted] = useState('');
  const [turno, setTurno] = useState(randomTurno);
  const boot = useBoot();

  // One anonymous visit per page load (the server dedupes repeats).
  useEffect(() => {
    track('visit');
  }, []);

  // Once the site is open, fetch the result page in the background.
  useEffect(() => {
    if (boot.ready) loadResult();
  }, [boot.ready]);

  // Browser back button returns to the form.
  useEffect(() => {
    const onPop = () => setView(window.location.hash === '#alta' && submitted ? 'alta' : 'inicio');
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [submitted]);

  const submit = useCallback((n) => {
    track('cert');
    setSubmitted(n);
    setView('alta');
    window.history.pushState({}, '', '#alta');
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  const back = useCallback(() => {
    setView('inicio');
    setTurno(randomTurno());
    if (window.location.hash === '#alta') window.history.back();
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  useEffect(() => {
    if (window.location.hash === '#alta' && !submitted) window.history.replaceState({}, '', window.location.pathname);
  }, [submitted]);

  return (
    <>
      <AnimatePresence>{!boot.ready && <Loader key="boot" progress={boot.progress} />}</AnimatePresence>
      {boot.ready && (
        <Site view={view} back={back} submitted={submitted} turno={turno} name={name} setName={setName} submit={submit} />
      )}
    </>
  );
}

function Site({ view, back, submitted, turno, name, setName, submit }) {
  return (
    <>
      <a className="sr-only" href="#top">
        Saltar al contenido
      </a>
      <Header onBack={view === 'alta' ? back : null} />
      {view === 'alta' ? (
        <Suspense fallback={<Loader label="Llenando tu nota" sub="Firmando, sellando y armando tus historias" turno={turno} />}>
          <Result name={submitted} turno={turno} onBack={back} />
        </Suspense>
      ) : (
        <Home name={name} setName={setName} onSubmit={submit} turno={turno} />
      )}
      <Footer />
    </>
  );
}
