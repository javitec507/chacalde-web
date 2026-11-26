import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import BlurText from '../components/reactbits/BlurText.jsx';
import DecryptedText from '../components/reactbits/DecryptedText.jsx';
import ScrollVelocity from '../components/reactbits/ScrollVelocity.jsx';
import HeroCard from './HeroCard.jsx';
import Holo from './Holo.jsx';
import PackLoader from './PackLoader.jsx';
import Reveal, { Burst } from './Reveal.jsx';
import Sheet from './Sheet.jsx';
import { drawShare, num, post, renderCard, shareOrDownload, shrinkPhoto } from './lib.js';
import { askMotion, needsMotionPermission } from './shine.js';
import { isMuted, onMute, setMuted, sfx } from './sound.js';

const TICKER = ['Canjea tu tarjeta aquí', 'Mystery Pack', 'Redemption Card', 'Premios únicos'];
const STEPS = ['Código', 'Premio', 'Datos', 'Listo'];
const EASE = [0.22, 1, 0.36, 1];
const rise = (i = 0) => ({ initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, transition: { delay: 0.12 + i * 0.08, duration: 0.5, ease: EASE } });

function Icon({ d, size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d={d} fill="currentColor" />
    </svg>
  );
}
const I = {
  spark: 'M12 1l2.6 8.4L23 12l-8.4 2.6L12 23l-2.6-8.4L1 12l8.4-2.6z',
  on: 'M3 9v6h4l5 5V4L7 9zm13.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z',
  off: 'M16.5 12a4.5 4.5 0 0 0-2.5-4v2.2l2.5 2.5zM19 12a7 7 0 0 1-.6 2.8l1.5 1.5A9 9 0 0 0 14 3.2v2.1A7 7 0 0 1 19 12zM4.3 3 3 4.3 7.7 9H3v6h4l5 5v-6.7l4.3 4.3a7 7 0 0 1-2.3 1.2v2.1a9 9 0 0 0 3.7-1.8l2 2 1.3-1.3zM12 4 9.9 6.1 12 8.2z',
  back: 'M20 11H7.8l5.6-5.6L12 4l-8 8 8 8 1.4-1.4L7.8 13H20z',
  next: 'M4 11h12.2l-5.6-5.6L12 4l8 8-8 8-1.4-1.4 5.6-5.6H4z',
  cam: 'M9 3 7.2 5H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3.2L15 3zm3 15a5 5 0 1 1 0-10 5 5 0 0 1 0 10zm0-2a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  check: 'M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z',
  search: 'M15.5 14h-.8l-.3-.3A6.5 6.5 0 1 0 14 15.5l.3.3v.8l5 5 1.5-1.5zm-6 0a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9z',
  gift: 'M20 7h-2.2A3 3 0 0 0 12 4.4 3 3 0 0 0 6.2 7H4a1 1 0 0 0-1 1v4h1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8h1V8a1 1 0 0 0-1-1zM15 5a1 1 0 0 1 0 2h-2a2 2 0 0 1 2-2zM9 5a2 2 0 0 1 2 2H9a1 1 0 0 1 0-2zM5 9h6v2H5zm1 4h5v6H6zm12 6h-5v-6h5zm1-8h-6V9h6z',
  truck: 'M20 8h-3V4H3a1 1 0 0 0-1 1v11h2a3 3 0 0 0 6 0h4a3 3 0 0 0 6 0h2v-5zM7 17.5A1.5 1.5 0 1 1 7 14.5a1.5 1.5 0 0 1 0 3zm10 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zM17 12V9.5h2.5L21 12z',
  store: 'M20 4H4v2h16zm1 10v-2l-1-5H4l-1 5v2h1v6h10v-6h4v6h2v-6zm-9 4H6v-4h6z',
  wa: 'M12 2a10 10 0 0 0-8.7 15l-1.3 5 5.1-1.3A10 10 0 1 0 12 2zm5.3 14.1c-.2.6-1.3 1.2-1.8 1.2-.5.1-1 .2-3.3-.7a11 11 0 0 1-4.4-3.9c-.3-.5-1-1.6-1-3s.7-2.1 1-2.4c.3-.3.6-.3.8-.3h.6c.2 0 .4 0 .6.5l.8 2c.1.2.1.4 0 .5l-.4.6-.4.4c-.1.2-.3.3-.1.6.2.3.8 1.4 1.8 2.2 1.2 1.1 2.2 1.4 2.5 1.6.3.1.5.1.7-.1l.9-1.1c.2-.3.4-.2.7-.1l1.9.9c.3.1.5.2.5.3.1.2.1.7-.1 1.3z'
};

function useMuted() {
  return useSyncExternalStore(onMute, isMuted, () => false);
}

function Header() {
  const muted = useMuted();
  return (
    <header className="top">
      <div className="in">
        <img src="/img/logo-white.png" alt="Chacalde" />
        <span>Mystery Pack</span>
        <button type="button" className="mute" onClick={() => setMuted(!muted)} aria-pressed={!muted} aria-label={muted ? 'Activar sonido' : 'Silenciar'}>
          <Icon d={muted ? I.off : I.on} size={18} />
          <span>{muted ? 'Sin sonido' : 'Sonido'}</span>
        </button>
      </div>
    </header>
  );
}

function Progress({ at }) {
  return (
    <nav className="prog" aria-label="Pasos del canje">
      <ol>
        {STEPS.map((s, i) => (
          <li key={s} className={i < at ? 'done' : i === at ? 'now' : ''} aria-current={i === at ? 'step' : undefined}>
            <span className="prog-bar">
              <motion.i initial={false} animate={{ scaleX: i < at ? 1 : i === at ? 0.5 : 0 }} transition={{ duration: 0.6, ease: EASE }} />
            </span>
            <span className="prog-label">
              {i < at ? <Icon d={I.check} size={13} /> : <b>{i + 1}</b>} {s}
            </span>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function Ticker() {
  const row = (
    <span className="tk-row">
      {TICKER.map((t) => (
        <span key={t} className="tk-item">
          <span>{t}</span>
          <Icon d={I.spark} />
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

function Cta({ children, onClick, disabled, kind = '', type = 'button', icon = I.next }) {
  return (
    <button className={`btn wide ${kind}`} type={type} onClick={onClick} disabled={disabled}>
      <span>{children}</span>
      {icon ? <Icon d={icon} size={20} /> : null}
    </button>
  );
}

// ---------- screens ----------
function Intro({ cfg, hasCode, onStart }) {
  const list = [
    ['Encuentra tu código', 'Está impreso en tu Redemption Card.', I.search],
    ['Descubre tu premio', 'Lo revelamos al instante.', I.gift],
    ['Dinos a quién se lo entregamos', 'Nombre, WhatsApp y una foto de la tarjeta.', I.truck]
  ];
  return (
    <section className="scr scr-intro">
      <Ticker />
      <div className="scr-grid">
        <div className="scr-visual">
          <HeroCard assets={cfg.assets} mode="loop" />
        </div>
        <div className="scr-copy">
          <motion.p className="lbl" {...rise(0)}>
            Mystery Pack · Redemption Card
          </motion.p>
          <BlurText tag="h1" className="display h1" text="¡Hola! Vamos a canjear tu tarjeta" animateBy="words" trigger="load" delay={90} />
          <motion.p className="lead" {...rise(2)}>
            {hasCode ? 'Ya tenemos tu código. Son 3 pasos y te llevamos de la mano.' : 'Te salió una Redemption Card en tu Mystery Pack. Son 3 pasos y te llevamos de la mano.'}
          </motion.p>
          <ol className="walk">
            {list.map(([t, d, ic], i) => (
              <motion.li key={t} {...rise(3 + i)}>
                <span className="walk-n">{i + 1}</span>
                <span className="walk-i">
                  <Icon d={ic} size={22} />
                </span>
                <span>
                  <b>{t}</b>
                  <small>{d}</small>
                </span>
              </motion.li>
            ))}
          </ol>
          <motion.div className="cta-bar" {...rise(6)}>
            <Cta onClick={onStart}>{hasCode ? 'Ver mi premio' : 'Empezar'}</Cta>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function Find({ cfg, onWrite, onBack }) {
  return (
    <section className="scr">
      <div className="scr-grid">
        <div className="scr-visual">
          <HeroCard assets={cfg.assets} mode="front" />
        </div>
        <div className="scr-copy">
          <motion.p className="lbl" {...rise(0)}>
            Paso 1 de 3
          </motion.p>
          <BlurText tag="h2" className="display h2" text="Busca tu código de canje" animateBy="words" trigger="load" delay={90} />
          <motion.p className="lead" {...rise(2)}>
            Está en el recuadro <b>“Código de canje”</b> de tu tarjeta. Son letras y números, así: <span className="mono">MP26-XX-XXXX-XXXX</span>
          </motion.p>
          <motion.div className="cta-bar" {...rise(3)}>
            <Cta onClick={onWrite} icon={I.next}>
              Escribir mi código
            </Cta>
            <button type="button" className="link" onClick={onBack}>
              <Icon d={I.back} size={16} /> Volver
            </button>
          </motion.div>
        </div>
      </div>
    </section>
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

function Prize({ cfg, S, onClaim, onAgain }) {
  const c = S.card;
  const [shown, setShown] = useState(false);
  return (
    <section className="scr">
      <div className="scr-grid scr-grid--flip">
        <div className="scr-visual">
          <Reveal card={c} img={S.img} assets={cfg.assets} taken={S.taken} onShown={() => setShown(true)} />
          {shown ? <MotionButton /> : null}
        </div>
        <div className="scr-copy">
          {shown ? (
            <>
              <motion.p className="lbl" {...rise(0)}>
                {S.taken ? 'Este código ya se usó' : 'Paso 2 de 3 · ¡Felicidades! Te ganaste'}
              </motion.p>
              <BlurText tag="h2" className="display h2" text={c.name || 'Tu premio'} animateBy="words" trigger="load" delay={90} />
              <motion.p className="meta" {...rise(2)}>
                <span className="sw" style={{ background: c.color }} />
                {(c.variant || '').toUpperCase()} · N° <DecryptedText text={num(c)} animateOn="view" sequential characters="0123456789" speed={60} />
              </motion.p>
              <motion.p className="lead" {...rise(3)}>
                {S.taken ? 'Este premio ya fue reclamado. Si crees que es un error, escríbenos con una foto de tu tarjeta.' : 'Es una carta única de tu Mystery Pack. Reclámala y te la entregamos.'}
              </motion.p>
              <motion.div className="cta-bar" {...rise(4)}>
                {S.taken ? (
                  <Cta onClick={onAgain} kind="line" icon={I.back}>
                    Probar otro código
                  </Cta>
                ) : (
                  <Cta onClick={onClaim}>Reclamar mi premio</Cta>
                )}
              </motion.div>
            </>
          ) : (
            <motion.p className="lbl suspense" initial={{ opacity: 0 }} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1.1, repeat: Infinity }}>
              Revelando tu premio…
            </motion.p>
          )}
        </div>
      </div>
    </section>
  );
}

function Done({ S }) {
  const c = S.card;
  const cvRef = useRef(null);
  const [slam, setSlam] = useState(false);
  const share = { card: c, img: S.img, no: S.result.no };
  useEffect(() => {
    const t = setTimeout(() => {
      setSlam(true);
      sfx('stamp');
      sfx('sparkle', { delay: 0.15 });
    }, 500);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (cvRef.current) drawShare(cvRef.current, { kind: 'story', ...share });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [S.result.no]);
  const next = S.result.test
    ? ['Así se ve un canje de verdad.', 'Como fue con el código de prueba, no se registró nada.', 'No se guardaron datos ni fotos.']
    : ['Te escribimos por WhatsApp para coordinar.', 'Revisamos tus fotos y preparamos tu premio.', 'Guarda tu número de canje.'];
  return (
    <section className="scr scr-done">
      <div className="scr-grid scr-grid--flip">
        <div className="scr-visual">
          <div className="done-card">
            <Holo card={c} img={S.img} stamp={slam ? <div className="stamp">CANJEADO</div> : null} />
            {slam ? <Burst seed={7} count={34} /> : null}
          </div>
        </div>
        <div className="scr-copy">
          <motion.p className="lbl" {...rise(0)}>
            Canje registrado
          </motion.p>
          <p className="ticket">
            <DecryptedText text={S.result.no} animateOn="view" sequential characters="0123456789" speed={70} />
          </p>
          <BlurText tag="h2" className="display h2" text="¡Es tuyo!" animateBy="words" trigger="load" delay={120} />
          <ol className="walk walk--small">
            {next.map((t, i) => (
              <motion.li key={t} {...rise(2 + i)}>
                <span className="walk-n">{i + 1}</span>
                <span>
                  <b>{t}</b>
                </span>
              </motion.li>
            ))}
          </ol>
          <motion.div className="share" {...rise(5)}>
            <p className="lbl" style={{ margin: 0 }}>
              Presúmelo
            </p>
            <canvas ref={cvRef} width="1080" height="1920" aria-label="Historia para compartir" />
            <div className="share-btns">
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
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function Closed() {
  return (
    <section className="scr">
      <div className="scr-grid">
        <div className="scr-copy">
          <p className="lbl">Mystery Pack</p>
          <BlurText tag="h1" className="display h1" text="La campaña de canje terminó." animateBy="words" trigger="load" delay={110} />
          <p className="lead">Gracias a todos los que reclamaron su premio.</p>
        </div>
        <div className="scr-visual">
          <div className="pack-closed">CERRADO</div>
        </div>
      </div>
    </section>
  );
}

// ---------- pop-ups ----------
function CodeSheet({ code, setCode, busy, err, onCheck }) {
  const ref = useRef(null);
  useEffect(() => {
    const t = setTimeout(() => ref.current?.focus(), 250);
    return () => clearTimeout(t);
  }, []);
  return (
    <form
      className="sform"
      autoComplete="off"
      onSubmit={(e) => {
        e.preventDefault();
        onCheck(ref.current.value);
      }}
    >
      <p className="lbl">Paso 1 · Tu código</p>
      <h3 className="display h3">Escribe tu código</h3>
      <motion.div className="codebox" animate={err ? { x: [0, -10, 10, -7, 7, -3, 0] } : { x: 0 }} transition={{ duration: 0.45 }} key={err || 'ok'}>
        <input
          ref={ref}
          name="code"
          inputMode="text"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck="false"
          maxLength={24}
          placeholder="MP26-XX-XXXX-XXXX"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            sfx('tick', { gain: 0.7, rate: 0.9 + Math.random() * 0.25 });
          }}
          aria-label="Código de canje"
          aria-invalid={Boolean(err)}
        />
      </motion.div>
      {err ? (
        <p className="err" role="alert">
          {err}
        </p>
      ) : (
        <p className="note">Sin letras que se confunden: no hay O, I ni L, ni 0 ni 1.</p>
      )}
      <Cta type="submit" disabled={busy || code.trim().length < 8} icon={busy ? null : I.next}>
        {busy ? 'Revisando…' : 'Revisar código'}
      </Cta>
    </form>
  );
}

const PHONE_OK = (p) => String(p || '').replace(/\D/g, '').length >= 7;
const EMAIL_OK = (e) => !e || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

function ClaimSheet({ S, setForm, onPhoto, onSubmit, step, setStep }) {
  const f = S.form;
  const steps = ['datos', 'entrega', ...(S.photoCheck ? ['fotos'] : []), 'confirmar'];
  const key = steps[step];
  const delivery = f.delivery || S.delivery[0] || '';
  const ship = delivery.toLowerCase().includes('env');
  const upd = (k) => (e) => setForm({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const uploading = S.uploading.front || S.uploading.back;
  const valid = {
    datos: f.name.trim().length >= 3 && PHONE_OK(f.phone) && EMAIL_OK(f.email.trim()),
    entrega: Boolean(delivery) && (!ship || f.address.trim().length >= 8),
    fotos: Boolean(S.photos.front && S.photos.back) && !uploading,
    confirmar: f.consent
  }[key];
  const go = (d) => {
    sfx(d > 0 ? 'pop' : 'tick');
    setStep(Math.max(0, Math.min(steps.length - 1, step + d)));
  };
  const titles = { datos: '¿A quién se lo entregamos?', entrega: '¿Cómo te lo hacemos llegar?', fotos: 'Fotos de tu tarjeta', confirmar: 'Revisa y confirma' };
  return (
    <form
      className="sform"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        if (key === 'confirmar') onSubmit();
        else go(1);
      }}
    >
      <div className="sdots" aria-label={`Paso 3 · ${step + 1} de ${steps.length}`}>
        <span className="lbl" style={{ margin: 0 }}>
          Paso 3 · {step + 1} de {steps.length}
        </span>
        <span className="dots">
          {steps.map((s, i) => (
            <i key={s} className={i <= step ? 'on' : ''} />
          ))}
        </span>
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={key} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.22, ease: EASE }} className="sstep">
          <h3 className="display h3">{titles[key]}</h3>
          {key === 'datos' ? (
            <>
              <label className="f">
                Nombre completo
                <input name="name" required maxLength={80} autoComplete="name" value={f.name} onChange={upd('name')} />
              </label>
              <label className="f">
                <span>
                  WhatsApp <Icon d={I.wa} size={14} />
                </span>
                <input name="phone" required maxLength={30} inputMode="tel" autoComplete="tel" placeholder="+507 6000-0000" value={f.phone} onChange={upd('phone')} />
              </label>
              <label className="f">
                Correo (opcional)
                <input name="email" type="email" maxLength={120} autoComplete="email" value={f.email} onChange={upd('email')} />
              </label>
              <p className="note">Solo para entregarte el premio. Se borra 90 días después de la entrega.</p>
            </>
          ) : null}
          {key === 'entrega' ? (
            <>
              <div className="tiles" role="radiogroup" aria-label="Forma de entrega">
                {S.delivery.map((d) => {
                  const on = d === delivery;
                  return (
                    <button
                      key={d}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      className={`tile${on ? ' on' : ''}`}
                      onClick={() => {
                        setForm({ ...f, delivery: d });
                        sfx('tick');
                      }}
                    >
                      <Icon d={d.toLowerCase().includes('env') ? I.truck : I.store} size={26} />
                      <span>{d}</span>
                      <i className="tick">
                        <Icon d={I.check} size={14} />
                      </i>
                    </button>
                  );
                })}
              </div>
              {ship ? (
                <label className="f">
                  Dirección y referencias
                  <textarea name="address" maxLength={300} value={f.address} onChange={upd('address')} placeholder="Corregimiento, calle, casa o edificio, y una referencia" />
                </label>
              ) : null}
            </>
          ) : null}
          {key === 'fotos' ? (
            <>
              <p className="note" style={{ marginTop: 0 }}>
                Tómale foto a tu Redemption Card por los dos lados. Que se lea bien el código. Así confirmamos que la tarjeta física es tuya.
              </p>
              <div className="photos">
                {[
                  ['front', 'Frente'],
                  ['back', 'Reverso']
                ].map(([side, title]) => (
                  <label key={side} className={`ph${S.photos[side] ? ' ok' : ''}`}>
                    {S.previews[side] ? (
                      <img src={S.previews[side]} alt="" />
                    ) : (
                      <span>
                        <Icon d={I.cam} size={28} />
                        <b>{title}</b>
                        Toca para tomar la foto
                      </span>
                    )}
                    {S.uploading[side] ? <span className="ph-busy">Subiendo…</span> : S.photos[side] ? <span className="ph-ok"><Icon d={I.check} size={16} /></span> : null}
                    <input type="file" accept="image/*" capture="environment" onChange={(e) => onPhoto(side, e.target.files[0])} />
                  </label>
                ))}
              </div>
            </>
          ) : null}
          {key === 'confirmar' ? (
            <>
              <dl className="sum">
                <div>
                  <dt>Premio</dt>
                  <dd>
                    {S.card.name} · {S.card.variant} N° {num(S.card)}
                  </dd>
                </div>
                <div>
                  <dt>Nombre</dt>
                  <dd>{f.name}</dd>
                </div>
                <div>
                  <dt>WhatsApp</dt>
                  <dd>{f.phone}</dd>
                </div>
                {f.email ? (
                  <div>
                    <dt>Correo</dt>
                    <dd>{f.email}</dd>
                  </div>
                ) : null}
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
            </>
          ) : null}
        </motion.div>
      </AnimatePresence>
      {S.err ? (
        <p className="err" role="alert">
          {S.err}
        </p>
      ) : null}
      <div className="snav">
        {step > 0 ? (
          <button type="button" className="btn line" onClick={() => go(-1)} aria-label="Atrás">
            <Icon d={I.back} size={20} />
          </button>
        ) : null}
        <Cta type="submit" disabled={!valid || S.busy} icon={key === 'confirmar' ? null : I.next}>
          {key === 'confirmar' ? (S.busy ? 'Enviando…' : 'Canjear ahora') : key === 'fotos' && uploading ? 'Subiendo fotos…' : 'Siguiente'}
        </Cta>
      </div>
    </form>
  );
}

// ---------- the journey ----------
const EMPTY_FORM = { name: '', phone: '', email: '', delivery: '', address: '', consent: false };

function readHash() {
  try {
    return decodeURIComponent(location.hash.slice(1));
  } catch {
    return '';
  }
}

export default function App({ cfg }) {
  const reduce = useReducedMotion();
  const [hashCode] = useState(() => {
    const c = readHash();
    if (c) history.replaceState(null, '', location.pathname);
    return c;
  });
  const [S, setS] = useState(() => ({
    screen: cfg.closed ? 'closed' : 'pack',
    sheet: null,
    claimStep: 0,
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
    form: EMPTY_FORM
  }));
  const patch = useCallback((o) => setS((s) => ({ ...s, ...(typeof o === 'function' ? o(s) : o) })), []);
  const api = (action, data, headers) => post(cfg.api, action, data, headers);
  const screenRef = useRef(S.screen);
  useLayoutEffect(() => {
    screenRef.current = S.screen;
  });

  // Phone back button: closes the pop-up, or goes back one screen (never back into a finished claim).
  const go = (screen, extra = {}) => {
    history.pushState({ s: screen }, '');
    patch({ screen, sheet: null, err: '', ...extra });
    window.scrollTo(0, 0);
  };
  const openSheet = (sheet, extra = {}) => {
    history.pushState({ s: screenRef.current, sheet }, '');
    patch({ sheet, err: '', ...extra });
    sfx('pop');
  };
  const closeSheet = useCallback(() => {
    if (history.state && history.state.sheet) history.back();
    else patch({ sheet: null });
  }, [patch]);
  useEffect(() => {
    const onPop = (e) => {
      const st = e.state || {};
      if (screenRef.current === 'done' || screenRef.current === 'closed') {
        history.pushState({ s: screenRef.current }, '');
        patch({ sheet: null });
        return;
      }
      const screen = st.s && st.s !== 'pack' ? st.s : screenRef.current === 'pack' ? 'pack' : 'intro';
      patch((s) => ({ sheet: st.sheet || null, screen: screen === 'reveal' && !s.card ? 'find' : screen }));
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
      const fresh = { card: r.card, taken: r.status === 409, photoCheck: r.photoCheck !== false, delivery: r.delivery || ['Retiro en persona'], img, busy: false, photos: {}, previews: {}, uploading: {}, claimStep: 0 };
      if (history.state && history.state.sheet) history.replaceState({ s: 'reveal' }, '');
      else history.pushState({ s: 'reveal' }, '');
      patch({ ...fresh, screen: 'reveal', sheet: null });
      window.scrollTo(0, 0);
    } else {
      sfx('error');
      const err = r.error || 'No pudimos revisar el código.';
      if (S.sheet === 'code') patch({ busy: false, err });
      else {
        history.pushState({ s: 'find' }, '');
        history.pushState({ s: 'find', sheet: 'code' }, '');
        patch({ busy: false, err, screen: 'find', sheet: 'code' });
      }
    }
  };

  const photo = async (side, file) => {
    if (!file) return;
    sfx('shutter');
    patch((s) => ({ err: '', uploading: { ...s.uploading, [side]: true } }));
    try {
      const blob = await shrinkPhoto(file);
      const url = URL.createObjectURL(blob);
      patch((s) => ({ previews: { ...s.previews, [side]: url } }));
      const r = await api('photo', blob, { 'Content-Type': 'image/jpeg', 'X-Code': S.code });
      if (r.status !== 200) throw new Error(r.error);
      patch((s) => ({ photos: { ...s.photos, [side]: r.photo }, uploading: { ...s.uploading, [side]: false } }));
    } catch (e) {
      sfx('error');
      patch((s) => {
        const previews = { ...s.previews };
        delete previews[side];
        return { previews, uploading: { ...s.uploading, [side]: false }, err: e.message || 'No pudimos subir la foto. Prueba otra vez.' };
      });
    }
  };

  const claim = async () => {
    sfx('pen');
    patch({ busy: true, err: '' });
    const f = { ...S.form, delivery: S.form.delivery || S.delivery[0] || '' };
    const r = await api('claim', { code: S.code, ...f, photos: S.photos });
    if (r.status === 200) {
      history.replaceState({ s: 'done' }, '');
      patch({ busy: false, result: r, screen: 'done', sheet: null });
      window.scrollTo(0, 0);
    } else {
      sfx('error');
      const msg = r.error || 'No se pudo registrar. Intenta otra vez.';
      const steps = ['datos', 'entrega', ...(S.photoCheck ? ['fotos'] : []), 'confirmar'];
      const back = /foto/i.test(msg) ? 'fotos' : /nombre|whatsapp|correo/i.test(msg) ? 'datos' : null;
      patch({ busy: false, err: msg, ...(back && steps.includes(back) ? { claimStep: steps.indexOf(back) } : {}) });
    }
  };

  const afterPack = () => {
    history.replaceState({ s: 'intro' }, '');
    patch({ screen: 'intro' });
  };

  const at = { find: 0, reveal: S.sheet === 'claim' ? 2 : 1, done: 3 }[S.screen];
  let body;
  if (S.screen === 'closed') body = <Closed />;
  else if (S.screen === 'intro') body = <Intro cfg={cfg} hasCode={Boolean(S.code)} onStart={() => (S.code && !S.card ? check(S.code) : go('find'))} />;
  else if (S.screen === 'find') body = <Find cfg={cfg} onWrite={() => openSheet('code')} onBack={() => history.back()} />;
  else if (S.screen === 'reveal') body = <Prize cfg={cfg} S={S} onClaim={() => openSheet('claim')} onAgain={() => go('find', { code: '', card: null })} />;
  else if (S.screen === 'done') body = <Done S={S} />;

  if (S.screen === 'pack') return <PackLoader assets={cfg.assets} hasCode={Boolean(S.code)} onDone={afterPack} />;

  return (
    <>
      <Header />
      {at !== undefined ? <Progress at={at} /> : null}
      <AnimatePresence mode="wait">
        <motion.main key={S.screen} initial={reduce ? false : { opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={reduce ? { opacity: 0 } : { opacity: 0, x: -40 }} transition={{ duration: 0.3, ease: EASE }}>
          {body}
        </motion.main>
      </AnimatePresence>
      <Sheet open={S.sheet === 'code'} onClose={closeSheet} label="Escribe tu código">
        <CodeSheet code={S.code} setCode={(code) => patch({ code, err: '' })} busy={S.busy} err={S.err} onCheck={check} />
      </Sheet>
      <Sheet open={S.sheet === 'claim'} onClose={closeSheet} label="Datos para la entrega">
        {S.card ? <ClaimSheet S={S} setForm={(form) => patch({ form, err: '' })} onPhoto={photo} onSubmit={claim} step={S.claimStep} setStep={(claimStep) => patch({ claimStep, err: '' })} /> : null}
      </Sheet>
    </>
  );
}
