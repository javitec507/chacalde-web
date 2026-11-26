import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import BlurText from '../components/reactbits/BlurText.jsx';
import DecryptedText from '../components/reactbits/DecryptedText.jsx';
import ScrollVelocity from '../components/reactbits/ScrollVelocity.jsx';
import HeroCard from './HeroCard.jsx';
import Holo from './Holo.jsx';
import { drawShare, num, post, renderCard, shareOrDownload, shrinkPhoto } from './lib.js';
import { askMotion, needsMotionPermission } from './shine.js';

const TICKER = ['Canjea tu tarjeta aquí', 'Mystery Pack', 'Redemption Card', 'Premios únicos'];

function Spark() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 1l2.6 8.4L23 12l-8.4 2.6L12 23l-2.6-8.4L1 12l8.4-2.6z" fill="currentColor" />
    </svg>
  );
}

function Ticker() {
  const row = (
    <span className="tk-row">
      {TICKER.map((t) => (
        <span key={t} className="tk-item">
          <span>{t}</span>
          <Spark />
        </span>
      ))}
    </span>
  );
  return (
    <div className="ticker" aria-hidden="true">
      <ScrollVelocity texts={[row]} velocity={55} numCopies={4} parallaxClassName="parallax" scrollerClassName="scroller" />
    </div>
  );
}

const rise = (i = 0) => ({ initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { delay: 0.15 + i * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] } });

function Header({ preview, test }) {
  return (
    <>
      {preview ? <div className="preview">VISTA PREVIA · los canjes no se guardan</div> : test ? <div className="preview">CÓDIGO DE PRUEBA · no se guarda nada</div> : null}
      <header className="top">
        <div className="in">
          <img src="/img/logo-white.png" alt="Chacalde" />
          <span>Mystery Pack</span>
        </div>
      </header>
    </>
  );
}

function CodeStep({ cfg, code, setCode, busy, err, onCheck }) {
  const inputRef = useRef(null);
  return (
    <>
      <Ticker />
      <section className="hero">
        <div className="hero-copy">
          <motion.p className="lbl" {...rise(0)}>
            Mystery Pack · Redemption Card
          </motion.p>
          <BlurText tag="h1" className="display h1" text="Canjea tu tarjeta aquí" animateBy="words" trigger="load" delay={110} direction="top" />
          <motion.p className="lead" {...rise(2)}>
            ¿Te salió una Redemption Card? Escribe el código de canje que trae impreso y mira qué te ganaste.
          </motion.p>
          <motion.form
            className="codebox"
            autoComplete="off"
            onSubmit={(e) => {
              e.preventDefault();
              onCheck(inputRef.current.value);
            }}
            {...rise(3)}
          >
            <input
              ref={inputRef}
              name="code"
              inputMode="text"
              autoCapitalize="characters"
              spellCheck="false"
              maxLength={24}
              placeholder="MP26-XX-XXXX-XXXX"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              aria-label="Código de canje"
            />
            <button className="btn wide" type="submit" disabled={busy}>
              {busy ? 'Revisando…' : 'Revisar código'}
            </button>
            {err ? (
              <p className="err" role="alert">
                {err}
              </p>
            ) : null}
          </motion.form>
          <motion.ol className="steps" {...rise(4)}>
            <li>
              <b>1</b> Escribe el código
            </li>
            <li>
              <b>2</b> Mira tu premio
            </li>
            <li>
              <b>3</b> Reclámalo
            </li>
          </motion.ol>
          <motion.p className="note" {...rise(5)}>
            Si llegaste por el QR, el código ya está puesto. Sin letras que se confunden: no hay O, I ni L, ni 0 ni 1.
          </motion.p>
        </div>
        <HeroCard assets={cfg.assets} />
      </section>
    </>
  );
}

function MotionButton() {
  const [show, setShow] = useState(needsMotionPermission);
  if (!show) return null;
  return (
    <button
      className="btn line motion"
      type="button"
      onClick={async () => {
        await askMotion();
        setShow(false);
      }}
    >
      Mover el brillo con el teléfono
    </button>
  );
}

function RevealStep({ S, onClaim, onAgain }) {
  const c = S.card;
  return (
    <section className="hero hero--reveal">
      <div className="stage">
        <Holo card={c} img={S.img} flip stamp={S.taken ? <div className="stamp gray">YA CANJEADA</div> : null} />
        <MotionButton />
      </div>
      <div className="prize">
        <motion.p className="lbl" {...rise(4)}>
          {S.taken ? 'Este código ya se usó' : '¡Felicidades! Te ganaste'}
        </motion.p>
        <BlurText tag="h2" className="display" text={c.name || 'Tu premio'} animateBy="words" trigger="load" delay={90} />
        <motion.p className="meta" {...rise(6)}>
          <span className="sw" style={{ background: c.color }} />
          {(c.variant || '').toUpperCase()} · N° <DecryptedText text={num(c)} animateOn="view" sequential characters="0123456789" speed={60} />
        </motion.p>
        {S.taken ? (
          <motion.div {...rise(7)}>
            <p className="lead">Este premio ya fue reclamado. Si crees que es un error, escríbenos con una foto de tu tarjeta.</p>
            <button className="btn line" type="button" style={{ marginTop: 20 }} onClick={onAgain}>
              Probar otro código
            </button>
          </motion.div>
        ) : (
          <motion.div {...rise(7)}>
            <p className="lead">Es una carta única de tu Mystery Pack. Reclámala y te contactamos para entregártela.</p>
            <button className="btn wide" type="button" style={{ marginTop: 22 }} onClick={onClaim}>
              Reclamar mi premio
            </button>
          </motion.div>
        )}
      </div>
    </section>
  );
}

function PhotoTile({ side, title, hint, preview, ok, onFile }) {
  return (
    <label className={`ph${ok ? ' ok' : ''}`}>
      {preview ? (
        <img src={preview} alt="" />
      ) : (
        <span>
          <b>{title}</b>
          {hint}
        </span>
      )}
      <input type="file" accept="image/*" capture="environment" onChange={(e) => onFile(side, e.target.files[0])} />
    </label>
  );
}

function FormStep({ S, setForm, onPhoto, onSubmit }) {
  const c = S.card;
  const f = S.form;
  const needsAddress = (f.delivery || S.delivery[0] || '').toLowerCase().includes('env');
  const upd = (k) => (e) => setForm({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  return (
    <section className="two">
      <div className="stage">
        <Holo card={c} img={S.img} />
        <p className="meta" style={{ font: '900 18px Doto,monospace' }}>
          <span className="sw" style={{ background: c.color }} />
          {c.name} · {num(c)}
        </p>
      </div>
      <motion.div {...rise(0)}>
        <p className="lbl">Último paso</p>
        <h2 className="display h2">¿A quién se lo entregamos?</h2>
        <form
          style={{ marginTop: 22 }}
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit();
          }}
        >
          <label className="f">
            Nombre completo
            <input name="name" required maxLength={80} autoComplete="name" value={f.name} onChange={upd('name')} />
          </label>
          <label className="f">
            WhatsApp
            <input name="phone" required maxLength={30} inputMode="tel" autoComplete="tel" placeholder="+507 6000-0000" value={f.phone} onChange={upd('phone')} />
          </label>
          <label className="f">
            Correo (opcional)
            <input name="email" type="email" maxLength={120} autoComplete="email" value={f.email} onChange={upd('email')} />
          </label>
          <label className="f">
            Entrega
            <select name="delivery" value={f.delivery || S.delivery[0] || ''} onChange={upd('delivery')}>
              {S.delivery.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
          </label>
          {needsAddress ? (
            <label className="f">
              Dirección y referencias
              <textarea name="address" maxLength={300} value={f.address} onChange={upd('address')} />
            </label>
          ) : null}
          {S.photoCheck ? (
            <div>
              <p className="lbl" style={{ margin: '6px 0 10px' }}>
                Fotos de tu Redemption Card
              </p>
              <div className="photos">
                <PhotoTile side="front" title="Frente" hint="Toca para tomar la foto" preview={S.previews.front} ok={Boolean(S.photos.front)} onFile={onPhoto} />
                <PhotoTile side="back" title="Reverso" hint="Toca para tomar la foto" preview={S.previews.back} ok={Boolean(S.photos.back)} onFile={onPhoto} />
              </div>
              <p className="note">Que se lea bien el código de canje. Con esto confirmamos que la tarjeta física es tuya.</p>
            </div>
          ) : null}
          <label className="consent">
            <input type="checkbox" name="consent" required checked={f.consent} onChange={upd('consent')} /> Acepto que usen estos datos solo para entregarme el premio. Se borran 90 días después de la entrega.
          </label>
          {S.err ? (
            <p className="err" role="alert">
              {S.err}
            </p>
          ) : null}
          <button className="btn wide" type="submit" disabled={S.busy}>
            {S.busy ? 'Enviando…' : 'Canjear ahora'}
          </button>
        </form>
      </motion.div>
    </section>
  );
}

function DoneStep({ S }) {
  const c = S.card;
  const cvRef = useRef(null);
  const share = { card: c, img: S.img, no: S.result.no };
  useEffect(() => {
    if (cvRef.current) drawShare(cvRef.current, { kind: 'story', ...share });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [S.result.no]);
  return (
    <section className="two">
      <div className="stage">
        <Holo card={c} img={S.img} stamp={<div className="stamp">CANJEADO</div>} />
      </div>
      <div>
        <p className="lbl">Canje registrado</p>
        <p className="ticket">
          <DecryptedText text={S.result.no} animateOn="view" sequential characters="0123456789" speed={70} />
        </p>
        <h2 className="display h2" style={{ marginTop: 10 }}>
          ¡Es tuyo!
        </h2>
        {S.result.test ? (
          <p className="lead">Así se ve un canje de verdad. Como fue con el código de prueba, no se registró nada ni se guardaron datos ni fotos.</p>
        ) : (
          <p className="lead">
            Te escribimos por WhatsApp para coordinar la entrega de <b>{c.name}</b> ({c.variant} · N° {num(c)}). Guarda este número de canje.
          </p>
        )}
        <div className="share" style={{ marginTop: 26 }}>
          <p className="lbl" style={{ margin: 0 }}>
            Presúmelo
          </p>
          <canvas ref={cvRef} width="1080" height="1920" aria-label="Historia para compartir" />
          <div className="row">
            <button className="btn" type="button" onClick={() => shareOrDownload({ kind: 'story', ...share })}>
              Compartir historia
            </button>
            <button className="btn line" type="button" onClick={() => shareOrDownload({ kind: 'story', ...share }, true)}>
              Descargar
            </button>
            <button className="btn line" type="button" onClick={() => shareOrDownload({ kind: 'post', ...share }, true)}>
              Post 4:5
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function ClosedStep() {
  return (
    <section className="hero">
      <div className="hero-copy">
        <p className="lbl">Mystery Pack</p>
        <BlurText tag="h1" className="display h1" text="La campaña de canje terminó." animateBy="words" trigger="load" delay={110} />
        <p className="lead">Gracias a todos los que reclamaron su premio.</p>
      </div>
      <div className="stage">
        <div className="pack">CERRADO</div>
      </div>
    </section>
  );
}

const EMPTY_FORM = { name: '', phone: '', email: '', delivery: '', address: '', consent: false };

export default function App({ cfg }) {
  const reduce = useReducedMotion();
  const [S, setS] = useState(() => ({ step: cfg.closed ? 'closed' : 'code', code: '', card: null, taken: false, photoCheck: true, delivery: [], photos: {}, previews: {}, img: null, result: null, err: '', busy: false, form: EMPTY_FORM }));
  const patch = useCallback((o) => setS((s) => ({ ...s, ...(typeof o === 'function' ? o(s) : o) })), []);
  const api = (action, data, headers) => post(cfg.api, action, data, headers);

  const check = async (input) => {
    const code = String(input || '').trim();
    if (!code) return;
    patch({ code, busy: true, err: '' });
    const r = await api('check', { code });
    if (r.status === 200 || r.status === 409) {
      const img = (await renderCard(r.card, cfg.assets)).toDataURL('image/jpeg', 0.92);
      patch({ busy: false, card: r.card, taken: r.status === 409, photoCheck: r.photoCheck !== false, delivery: r.delivery || ['Retiro en persona'], img, step: 'reveal' });
      window.scrollTo(0, 0);
    } else {
      patch({ busy: false, err: r.error || 'No pudimos revisar el código.' });
    }
  };

  const photo = async (side, file) => {
    if (!file) return;
    patch({ err: '' });
    try {
      const blob = await shrinkPhoto(file);
      const url = URL.createObjectURL(blob);
      patch((s) => ({ previews: { ...s.previews, [side]: url } }));
      const r = await api('photo', blob, { 'Content-Type': 'image/jpeg', 'X-Code': S.code });
      if (r.status !== 200) throw new Error(r.error);
      patch((s) => ({ photos: { ...s.photos, [side]: r.photo } }));
    } catch (e) {
      patch((s) => {
        const previews = { ...s.previews };
        delete previews[side];
        return { previews, err: e.message || 'No pudimos subir la foto. Prueba otra vez.' };
      });
    }
  };

  const claim = async () => {
    patch({ busy: true, err: '' });
    const f = { ...S.form, delivery: S.form.delivery || S.delivery[0] || '' };
    const r = await api('claim', { code: S.code, ...f, photos: S.photos });
    if (r.status === 200) {
      patch({ busy: false, result: r, step: 'done' });
      window.scrollTo(0, 0);
    } else {
      patch({ busy: false, err: r.error || 'No se pudo registrar. Intenta otra vez.' });
    }
  };

  // A QR opens /canje#CODE: the code never reaches server logs.
  const checkRef = useRef(check);
  useLayoutEffect(() => {
    checkRef.current = check;
  });
  useEffect(() => {
    const fromHash = () => {
      let code = '';
      try {
        code = decodeURIComponent(location.hash.slice(1));
      } catch {
        /* not a code */
      }
      if (code && !cfg.closed) {
        history.replaceState(null, '', location.pathname);
        checkRef.current(code);
      }
    };
    fromHash();
    window.addEventListener('hashchange', fromHash);
    return () => window.removeEventListener('hashchange', fromHash);
  }, [cfg.closed]);

  let body;
  if (S.step === 'closed') body = <ClosedStep />;
  else if (S.step === 'code') body = <CodeStep cfg={cfg} code={S.code} setCode={(code) => patch({ code })} busy={S.busy} err={S.err} onCheck={check} />;
  else if (S.step === 'reveal') body = <RevealStep S={S} onClaim={() => (patch({ step: 'form', err: '' }), window.scrollTo(0, 0))} onAgain={() => patch({ step: 'code', code: '', err: '' })} />;
  else if (S.step === 'form') body = <FormStep S={S} setForm={(form) => patch({ form })} onPhoto={photo} onSubmit={claim} />;
  else body = <DoneStep S={S} />;

  return (
    <>
      <Header preview={cfg.preview} test={Boolean(S.card && S.card.test && S.step !== 'code')} />
      <AnimatePresence mode="wait">
        <motion.main key={S.step} initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
          {body}
        </motion.main>
      </AnimatePresence>
    </>
  );
}
