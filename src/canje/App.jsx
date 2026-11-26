// Mystery Pack · canje: one screen per step, each fits the screen (no scrolling), button at the bottom.
// code → reveal → datos → entrega → fotos → confirmar → done. Phone: one column. Desktop: card left, step right.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import BlurText from '../components/reactbits/BlurText.jsx';
import DecryptedText from '../components/reactbits/DecryptedText.jsx';
import Holo from './Holo.jsx';
import PackLoader from './PackLoader.jsx';
import Reveal, { Burst } from './Reveal.jsx';
import Sample from './Sample.jsx';
import { num, post, renderCard, shareOrDownload, shrinkPhoto } from './lib.js';

const EMPTY_FORM = { name: '', phone: '', email: '', delivery: '', address: '', consent: false };
const EASE = [0.22, 1, 0.36, 1];
const PHONE_OK = (p) => String(p || '').replace(/\D/g, '').length >= 7;
const EMAIL_OK = (e) => !e || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
const fade = (i = 0) => ({ initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { delay: 0.1 + i * 0.07, duration: 0.4, ease: EASE } });

function readHash() {
  try {
    return decodeURIComponent(location.hash.slice(1));
  } catch {
    return '';
  }
}

const flow = (photoCheck) => ['code', 'reveal', 'datos', 'entrega', ...(photoCheck ? ['fotos'] : []), 'confirmar', 'done'];
const FORM = ['datos', 'entrega', 'fotos', 'confirmar'];

/** One screen: visual (card) + body + the button at the bottom. Phone: stacked. Desktop: side by side. */
function Step({ visual, mobileVisual = true, children, actions, className = '' }) {
  const kind = `${visual && mobileVisual ? 'step--v' : 'step--nv'}${visual ? ' step--dv' : ''}`;
  return (
    <div className={`step ${kind} ${className}`}>
      {visual ? <div className={`step-visual${mobileVisual ? '' : ' desk'}`}>{visual}</div> : null}
      <div className="step-main">
        <div className="step-body">{children}</div>
        {actions ? <div className="step-actions">{actions}</div> : null}
      </div>
    </div>
  );
}

function PrizeChip({ S }) {
  return (
    <div className="chip">
      <img src={S.img} alt="" />
      <span>
        <b>{S.card.name}</b>
        <small>
          {S.card.variant} · N° {num(S.card)}
        </small>
      </span>
    </div>
  );
}

function FormHead({ S, title, onBack }) {
  const steps = FORM.filter((k) => k !== 'fotos' || S.photoCheck);
  const i = steps.indexOf(S.step) + 1;
  return (
    <>
      <div className="formhead">
        <button type="button" className="back" onClick={onBack}>
          ← Atrás
        </button>
        <span className="lbl">
          Paso {i} de {steps.length}
        </span>
      </div>
      <PrizeChip S={S} />
      <BlurText key={title} tag="h2" className="display h2" text={title} animateBy="words" trigger="load" delay={70} />
    </>
  );
}

export default function App({ cfg }) {
  const reduce = useReducedMotion();
  const [hashCode] = useState(() => {
    const c = readHash();
    if (c) history.replaceState(null, '', location.pathname);
    return c;
  });
  const [S, setS] = useState(() => ({
    step: cfg.closed ? 'closed' : 'loading',
    dir: 1,
    code: hashCode,
    card: null,
    taken: false,
    photoCheck: true,
    delivery: [],
    photos: {},
    previews: {},
    uploading: {},
    img: null,
    result: null,
    err: '',
    busy: false,
    shown: false,
    form: EMPTY_FORM
  }));
  const patch = useCallback((o) => setS((s) => ({ ...s, ...(typeof o === 'function' ? o(s) : o) })), []);
  const api = (action, data, headers) => post(cfg.api, action, data, headers);
  const stepRef = useRef(S.step);
  useLayoutEffect(() => {
    stepRef.current = S.step;
  });

  // Forward pushes a history entry, so the phone's back button walks back through the steps.
  const go = (step, extra = {}) => {
    history.pushState({ s: step }, '');
    patch({ step, dir: 1, err: '', ...extra });
  };
  const back = () => history.back();
  useEffect(() => {
    const onPop = (e) => {
      const cur = stepRef.current;
      if (cur === 'done' || cur === 'closed' || cur === 'loading') {
        history.pushState({ s: cur }, '');
        return;
      }
      const to = (e.state && e.state.s) || 'code';
      patch((s) => ({ step: to !== 'code' && !s.card ? 'code' : to, dir: -1, err: '' }));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [patch]);

  const check = async (input) => {
    const code = String(input || '').trim();
    if (!code) return;
    patch({ code, busy: true, err: '' });
    const r = await api('check', { code });
    if (r.status === 200 || r.status === 409) {
      const img = (await renderCard(r.card, cfg.assets)).toDataURL('image/jpeg', 0.92);
      go('reveal', { card: r.card, taken: r.status === 409, photoCheck: r.photoCheck !== false, delivery: r.delivery || ['Retiro en persona'], img, busy: false, shown: false, photos: {}, previews: {}, uploading: {}, form: EMPTY_FORM });
    } else {
      patch({ busy: false, step: 'code', err: r.error || 'No pudimos revisar el código.' });
    }
  };
  const checkRef = useRef(check);
  useLayoutEffect(() => {
    checkRef.current = check;
  });

  const afterLoader = () => {
    history.replaceState({ s: 'code' }, '');
    if (hashCode) {
      patch({ step: 'checking' });
      checkRef.current(hashCode);
    } else patch({ step: 'code' });
  };

  const photo = async (side, file) => {
    if (!file) return;
    patch((s) => ({ err: '', uploading: { ...s.uploading, [side]: true } }));
    try {
      const blob = await shrinkPhoto(file);
      const url = URL.createObjectURL(blob);
      patch((s) => ({ previews: { ...s.previews, [side]: url } }));
      const r = await api('photo', blob, { 'Content-Type': 'image/jpeg', 'X-Code': S.code });
      if (r.status !== 200) throw new Error(r.error);
      patch((s) => ({ photos: { ...s.photos, [side]: r.photo }, uploading: { ...s.uploading, [side]: false } }));
    } catch (e) {
      patch((s) => {
        const previews = { ...s.previews };
        delete previews[side];
        return { previews, uploading: { ...s.uploading, [side]: false }, err: e.message || 'No pudimos subir la foto. Prueba otra vez.' };
      });
    }
  };

  const claim = async () => {
    patch({ busy: true, err: '' });
    const f = { ...S.form, delivery: S.form.delivery || S.delivery[0] || '' };
    const r = await api('claim', { code: S.code, ...f, photos: S.photos });
    if (r.status === 200) {
      history.replaceState({ s: 'done' }, '');
      patch({ busy: false, result: r, step: 'done', dir: 1 });
    } else {
      const msg = r.error || 'No se pudo registrar. Intenta otra vez.';
      const to = /foto/i.test(msg) && S.photoCheck ? 'fotos' : /nombre|whatsapp|correo/i.test(msg) ? 'datos' : null;
      patch({ busy: false, err: msg, ...(to ? { step: to, dir: -1 } : {}) });
    }
  };

  // ---------- validation, one step at a time ----------
  const f = S.form;
  const delivery = f.delivery || S.delivery[0] || '';
  const ship = delivery.toLowerCase().includes('env');
  const upd = (k) => (e) => patch({ form: { ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }, err: '' });
  const uploading = S.uploading.front || S.uploading.back;
  const next = () => {
    const order = flow(S.photoCheck);
    const i = order.indexOf(S.step);
    let miss = '';
    if (S.step === 'datos') miss = f.name.trim().length < 3 ? 'Escribe tu nombre completo.' : !PHONE_OK(f.phone) ? 'Escribe un número de WhatsApp válido.' : !EMAIL_OK(f.email.trim()) ? 'Revisa tu correo.' : '';
    if (S.step === 'entrega') miss = ship && f.address.trim().length < 8 ? 'Escribe la dirección de entrega.' : '';
    if (S.step === 'fotos') miss = uploading ? 'Espera a que terminen de subir.' : !(S.photos.front && S.photos.back) ? 'Sube la foto del frente y del reverso.' : '';
    if (S.step === 'confirmar') miss = !f.consent ? 'Marca la casilla para aceptar.' : '';
    if (miss) return patch({ err: miss });
    if (S.step === 'confirmar') return claim();
    go(order[i + 1]);
  };
  const enter = (e) => {
    e.preventDefault();
    next();
  };

  // ---------- screens ----------
  const ar = (c) => ({ '--ar': (c.card.trimW / c.card.trimH).toFixed(4) });
  const prizeVisual = S.card ? (
    <div className="cardbox" style={ar(S.card)}>
      <Holo card={S.card} img={S.img} />
    </div>
  ) : null;
  const errLine = S.err ? (
    <p className="err" role="alert">
      {S.err}
    </p>
  ) : null;

  let screen = null;
  if (S.step === 'closed') {
    screen = (
      <Step>
        <BlurText tag="h1" className="display h1" text="La campaña de canje terminó" animateBy="words" trigger="load" delay={90} />
        <motion.p className="lead" {...fade(2)}>
          Gracias a todos los que reclamaron su premio.
        </motion.p>
      </Step>
    );
  } else if (S.step === 'checking') {
    screen = (
      <Step className="step--wait">
        <span className="spin" aria-hidden="true" />
        <p className="lead">Buscando tu premio…</p>
      </Step>
    );
  } else if (S.step === 'code') {
    screen = (
      <Step
        className="step--code"
        visual={<Sample assets={cfg.assets} />}
        actions={
          <button className="btn" type="submit" form="code-form" disabled={S.busy || S.code.trim().length < 8}>
            {S.busy ? 'Revisando…' : 'Revisar código'}
          </button>
        }
      >
        <BlurText tag="h1" className="display h1" text="Canjea tu tarjeta" animateBy="words" trigger="load" delay={90} />
        <motion.p className="lead" {...fade(2)}>
          Escribe el código de tu Redemption Card.
        </motion.p>
        <motion.form id="code-form" autoComplete="off" onSubmit={(e) => (e.preventDefault(), check(S.code))} {...fade(3)}>
          <motion.input
            key={S.err || 'ok'}
            animate={S.err ? { x: [0, -9, 9, -6, 6, -2, 0] } : { x: 0 }}
            transition={{ duration: 0.4 }}
            className="code"
            name="code"
            inputMode="text"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck="false"
            maxLength={24}
            placeholder="MP26-XX-XXXX-XXXX"
            value={S.code}
            onChange={(e) => patch({ code: e.target.value.toUpperCase(), err: '' })}
            aria-label="Código de canje"
            aria-invalid={Boolean(S.err)}
          />
        </motion.form>
        {errLine}
      </Step>
    );
  } else if (S.step === 'reveal' && S.card) {
    const c = S.card;
    screen = (
      <Step
        className="step--reveal"
        visual={<Reveal card={c} img={S.img} assets={cfg.assets} taken={S.taken} onShown={() => patch({ shown: true })} />}
        actions={
          S.shown ? (
            <motion.div {...fade(3)}>
              {S.taken ? (
                <button className="btn line" type="button" onClick={() => go('code', { code: '', card: null })}>
                  Probar otro código
                </button>
              ) : (
                <button className="btn" type="button" onClick={() => go('datos')}>
                  Reclamar mi premio
                </button>
              )}
            </motion.div>
          ) : null
        }
      >
        {S.shown ? (
          <>
            <motion.p className="lbl" {...fade(0)}>
              {S.taken ? 'Este código ya se usó' : '¡Te ganaste!'}
            </motion.p>
            <BlurText tag="h2" className="display h2" text={c.name || 'Tu premio'} animateBy="words" trigger="load" delay={80} />
            <motion.p className="meta" {...fade(2)}>
              <span className="sw" style={{ background: c.color }} />
              {c.variant} · N° <DecryptedText text={num(c)} animateOn="view" sequential characters="0123456789" speed={60} />
            </motion.p>
            {S.taken ? (
              <motion.p className="lead" {...fade(3)}>
                Este premio ya fue reclamado. Si crees que es un error, escríbenos con una foto de tu tarjeta.
              </motion.p>
            ) : null}
          </>
        ) : (
          <motion.p className="lbl" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.1, repeat: Infinity }}>
            Revelando tu premio…
          </motion.p>
        )}
      </Step>
    );
  } else if (S.step === 'datos' && S.card) {
    screen = (
      <Step visual={prizeVisual} mobileVisual={false} actions={<button className="btn" type="submit" form="step-form">Siguiente</button>}>
        <FormHead S={S} title="¿A quién se lo entregamos?" onBack={back} />
        <form id="step-form" className="fields" onSubmit={enter} noValidate>
          <label className="f">
            Nombre completo
            <input name="name" maxLength={80} autoComplete="name" value={f.name} onChange={upd('name')} />
          </label>
          <label className="f">
            WhatsApp
            <input name="phone" maxLength={30} inputMode="tel" autoComplete="tel" placeholder="+507 6000-0000" value={f.phone} onChange={upd('phone')} />
          </label>
          <label className="f">
            Correo (opcional)
            <input name="email" type="email" maxLength={120} autoComplete="email" value={f.email} onChange={upd('email')} />
          </label>
        </form>
        {errLine}
      </Step>
    );
  } else if (S.step === 'entrega' && S.card) {
    screen = (
      <Step visual={prizeVisual} mobileVisual={false} actions={<button className="btn" type="submit" form="step-form">Siguiente</button>}>
        <FormHead S={S} title="¿Cómo te lo entregamos?" onBack={back} />
        <form id="step-form" className="fields" onSubmit={enter} noValidate>
          {S.delivery.map((d) => (
            <label key={d} className={`opt${d === delivery ? ' on' : ''}`}>
              <input type="radio" name="delivery" value={d} checked={d === delivery} onChange={() => patch({ form: { ...f, delivery: d }, err: '' })} /> {d}
            </label>
          ))}
          {ship ? (
            <label className="f">
              Dirección
              <textarea name="address" maxLength={300} value={f.address} onChange={upd('address')} placeholder="Corregimiento, calle, casa o edificio" />
            </label>
          ) : null}
        </form>
        {errLine}
      </Step>
    );
  } else if (S.step === 'fotos' && S.card) {
    screen = (
      <Step
        visual={prizeVisual}
        mobileVisual={false}
        actions={
          <button className="btn" type="submit" form="step-form" disabled={uploading}>
            {uploading ? 'Subiendo fotos…' : 'Siguiente'}
          </button>
        }
      >
        <FormHead S={S} title="Fotos de tu tarjeta" onBack={back} />
        <form id="step-form" className="fields" onSubmit={enter} noValidate>
          <p className="note">Frente y reverso de tu Redemption Card. Que se lea bien el código.</p>
          <div className="photos">
            {[
              ['front', 'Frente'],
              ['back', 'Reverso']
            ].map(([side, title]) => (
              <label key={side} className={`ph${S.photos[side] ? ' ok' : ''}`}>
                {S.previews[side] ? <img src={S.previews[side]} alt="" /> : <span>+ {title}</span>}
                {S.uploading[side] ? <em>Subiendo…</em> : S.photos[side] ? <i>✓</i> : null}
                <input type="file" accept="image/*" capture="environment" aria-label={`Foto del ${title.toLowerCase()}`} onChange={(e) => photo(side, e.target.files[0])} />
              </label>
            ))}
          </div>
        </form>
        {errLine}
      </Step>
    );
  } else if (S.step === 'confirmar' && S.card) {
    screen = (
      <Step
        visual={prizeVisual}
        mobileVisual={false}
        actions={
          <button className="btn" type="submit" form="step-form" disabled={S.busy}>
            {S.busy ? 'Enviando…' : 'Canjear'}
          </button>
        }
      >
        <FormHead S={S} title="Confirma tu canje" onBack={back} />
        <form id="step-form" className="fields" onSubmit={enter} noValidate>
          <dl className="sum">
            <div>
              <dt>Nombre</dt>
              <dd>{f.name}</dd>
            </div>
            <div>
              <dt>WhatsApp</dt>
              <dd>{f.phone}</dd>
            </div>
            <div>
              <dt>Entrega</dt>
              <dd>
                {delivery}
                {ship && f.address ? ` · ${f.address}` : ''}
              </dd>
            </div>
          </dl>
          <label className="consent">
            <input type="checkbox" name="consent" checked={f.consent} onChange={upd('consent')} /> Acepto que usen estos datos solo para entregarme el premio. Se borran 90 días después de la entrega.
          </label>
        </form>
        {errLine}
      </Step>
    );
  } else if (S.step === 'done' && S.result) {
    const share = { card: S.card, img: S.img, no: S.result.no };
    screen = (
      <Step
        className="step--done"
        visual={<DoneCard S={S} />}
        actions={
          <motion.div className="two-btns" {...fade(4)}>
            <button className="btn" type="button" onClick={() => shareOrDownload({ kind: 'story', ...share })}>
              Compartir
            </button>
            <button className="btn line" type="button" onClick={() => shareOrDownload({ kind: 'story', ...share }, true)}>
              Descargar imagen
            </button>
          </motion.div>
        }
      >
        <motion.p className="lbl" {...fade(0)}>
          Canje registrado
        </motion.p>
        <p className="ticket">
          <DecryptedText text={S.result.no} animateOn="view" sequential characters="0123456789" speed={70} />
        </p>
        <BlurText tag="h2" className="display h2" text="¡Listo!" animateBy="words" trigger="load" delay={100} />
        <motion.p className="lead" {...fade(2)}>
          {S.result.test ? 'Fue con el código de prueba: no se registró nada ni se guardaron datos.' : 'Te escribimos por WhatsApp para coordinar la entrega.'}
        </motion.p>
      </Step>
    );
  }

  const order = flow(S.photoCheck);
  const at = order.indexOf(S.step);
  const progress = at < 0 ? 0 : at / (order.length - 1);

  return (
    <div className="app">
      <AnimatePresence>{S.step === 'loading' ? <PackLoader key="pk" assets={cfg.assets} onDone={afterLoader} /> : null}</AnimatePresence>
      <header className="top">
        <img src="/img/logo-white.png" alt="Chacalde" />
        <span>Mystery Pack</span>
      </header>
      <div className="bar" aria-hidden="true">
        <motion.i initial={false} animate={{ scaleX: progress }} transition={{ duration: 0.5, ease: EASE }} />
      </div>
      <div className="stage">
        <AnimatePresence mode="wait" custom={S.dir} initial={false}>
          {screen ? (
            <motion.div
              key={S.step}
              className="slide"
              custom={S.dir}
              variants={{ in: (d) => ({ opacity: 0, x: reduce ? 0 : d * 48 }), on: { opacity: 1, x: 0 }, out: (d) => ({ opacity: 0, x: reduce ? 0 : d * -48 }) }}
              initial="in"
              animate="on"
              exit="out"
              transition={{ duration: 0.28, ease: EASE }}
            >
              {screen}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}

function DoneCard({ S }) {
  const [slam, setSlam] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSlam(true), 450);
    return () => clearTimeout(t);
  }, []);
  return (
    <div className="cardbox" style={{ '--ar': (S.card.card.trimW / S.card.card.trimH).toFixed(4) }}>
      <Holo card={S.card} img={S.img} stamp={slam ? <div className="stamp">CANJEADO</div> : null} />
      {slam ? <Burst seed={7} count={30} /> : null}
    </div>
  );
}
