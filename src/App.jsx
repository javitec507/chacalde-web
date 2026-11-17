import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Header, Footer } from './components/Chrome.jsx';
import Home from './components/Home.jsx';
const Result = lazy(() => import('./components/Result.jsx'));
import { randomTurno } from './components/ui.jsx';

export default function App() {
  const [name, setName] = useState('');
  const [view, setView] = useState('inicio');
  const [submitted, setSubmitted] = useState('');
  const [turno, setTurno] = useState(randomTurno);

  // Browser back button returns to the form.
  useEffect(() => {
    const onPop = () => setView(window.location.hash === '#alta' && submitted ? 'alta' : 'inicio');
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [submitted]);

  const submit = useCallback((n) => {
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
      <a className="sr-only" href="#top">
        Saltar al contenido
      </a>
      <Header onBack={view === 'alta' ? back : null} />
      {view === 'alta' ? (
        <Suspense fallback={<main className="wrap result" id="top"><p className="lead">Atendiendo…</p></main>}>
          <Result name={submitted} turno={turno} onBack={back} />
        </Suspense>
      ) : (
        <Home name={name} setName={setName} onSubmit={submit} turno={turno} />
      )}
      <Footer />
    </>
  );
}
