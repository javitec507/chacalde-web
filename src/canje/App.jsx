// Mystery Pack · canje, the simple version: code → prize → one short form → done. Made for the phone first.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Foil from './Foil.jsx';
import Holo from './Holo.jsx';
import { num, post, renderCard, shareOrDownload, shrinkPhoto } from './lib.js';

// Where the code sits on the sample card (percent of the card). Matches the sample art.
const CODE_ZONE = { left: '9.6%', top: '73.4%', width: '80.8%', height: '11.9%' };
const EMPTY_FORM = { name: '', phone: '', email: '', delivery: '', address: '', consent: false };

function readHash() {
  try {
    return decodeURIComponent(location.hash.slice(1));
  } catch {
    return '';
  }
}

function Header() {
  return (
    <header className="top">
      <img src="/img/logo-white.png" alt="Chacalde" />
      <span>Mystery Pack</span>
    </header>
  );
}

function CodeScreen({ cfg, code, setCode, busy, err, onCheck }) {
  return (
    <section className="screen">
      <div className="sample">
        <img src={`${cfg.assets}/hero-front.jpg`} alt="Redemption Card: el código va en el recuadro de abajo" />
        <Foil src={`${cfg.assets}/hero-front.jpg`} />
        <span className="zone" style={CODE_ZONE} />
      </div>
      <h1 className="display">Canjea tu tarjeta</h1>
      <p className="lead">Escribe el código de tu Redemption Card. Está en el recuadro “Código de canje”.</p>
      <form
        className="stack"
        autoComplete="off"
        onSubmit={(e) => {
          e.preventDefault();
          onCheck(code);
        }}
      >
        <input
          className="code"
          name="code"
          inputMode="text"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck="false"
          maxLength={24}
          placeholder="MP26-XX-XXXX-XXXX"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          aria-label="Código de canje"
          aria-invalid={Boolean(err)}
        />
        {err ? (
          <p className="err" role="alert">
            {err}
          </p>
        ) : null}
        <button className="btn" type="submit" disabled={busy || code.trim().length < 8}>
          {busy ? 'Revisando…' : 'Revisar código'}
        </button>
      </form>
    </section>
  );
}

function PrizeScreen({ S, onClaim, onAgain }) {
  const c = S.card;
  return (
    <section className="screen">
      <p className="lbl">{S.taken ? 'Este código ya se usó' : '¡Te ganaste!'}</p>
      <Holo card={c} img={S.img} className="flip" stamp={S.taken ? <div className="stamp gray">YA CANJEADA</div> : null} />
      <h2 className="display">{c.name || 'Tu premio'}</h2>
      <p className="meta">
        <span className="sw" style={{ background: c.color }} />
        {c.variant} · N° {num(c)}
      </p>
      {S.taken ? (
        <>
          <p className="lead">Este premio ya fue reclamado. Si crees que es un error, escríbenos con una foto de tu tarjeta.</p>
          <button className="btn line" type="button" onClick={onAgain}>
            Probar otro código
          </button>
        </>
      ) : (
        <button className="btn" type="button" onClick={onClaim}>
          Reclamar mi premio
        </button>
      )}
    </section>
  );
}

const PHONE_OK = (p) => String(p || '').replace(/\D/g, '').length >= 7;
const EMAIL_OK = (e) => !e || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

function FormScreen({ S, setForm, onPhoto, onSubmit, onBack }) {
  const f = S.form;
  const delivery = f.delivery || S.delivery[0] || '';
  const ship = delivery.toLowerCase().includes('env');
  const upd = (k) => (e) => setForm({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const uploading = S.uploading.front || S.uploading.back;
  const [local, setLocal] = useState('');
  const submit = (e) => {
    e.preventDefault();
    const miss =
      f.name.trim().length < 3
        ? 'Escribe tu nombre completo.'
        : !PHONE_OK(f.phone)
          ? 'Escribe un número de WhatsApp válido.'
          : !EMAIL_OK(f.email.trim())
            ? 'Revisa tu correo.'
            : ship && f.address.trim().length < 8
              ? 'Escribe la dirección de entrega.'
              : S.photoCheck && !(S.photos.front && S.photos.back)
                ? 'Sube la foto del frente y del reverso de tu tarjeta.'
                : !f.consent
                  ? 'Marca la casilla para aceptar.'
                  : '';
    setLocal(miss);
    if (!miss) onSubmit();
  };
  const err = local || S.err;
  return (
    <section className="screen screen--form">
      <button type="button" className="back" onClick={onBack}>
        ← Volver
      </button>
      <h2 className="display">¿A quién se lo entregamos?</h2>
      <p className="lead">
        {S.card.name} · {S.card.variant} N° {num(S.card)}
      </p>
      <form className="stack" onSubmit={submit} noValidate>
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
        <fieldset className="f">
          <legend>Entrega</legend>
          {S.delivery.map((d) => (
            <label key={d} className={`opt${d === delivery ? ' on' : ''}`}>
              <input type="radio" name="delivery" value={d} checked={d === delivery} onChange={() => setForm({ ...f, delivery: d })} /> {d}
            </label>
          ))}
        </fieldset>
        {ship ? (
          <label className="f">
            Dirección
            <textarea name="address" maxLength={300} value={f.address} onChange={upd('address')} placeholder="Corregimiento, calle, casa o edificio" />
          </label>
        ) : null}
        {S.photoCheck ? (
          <div className="f">
            <span>Fotos de tu tarjeta</span>
            <div className="photos">
              {[
                ['front', 'Frente'],
                ['back', 'Reverso']
              ].map(([side, title]) => (
                <label key={side} className={`ph${S.photos[side] ? ' ok' : ''}`}>
                  {S.previews[side] ? <img src={S.previews[side]} alt="" /> : <span>+ {title}</span>}
                  {S.uploading[side] ? <em>Subiendo…</em> : null}
                  <input type="file" accept="image/*" capture="environment" aria-label={`Foto del ${title.toLowerCase()}`} onChange={(e) => onPhoto(side, e.target.files[0])} />
                </label>
              ))}
            </div>
            <small>Que se lea bien el código.</small>
          </div>
        ) : null}
        <label className="consent">
          <input type="checkbox" name="consent" checked={f.consent} onChange={upd('consent')} /> Acepto que usen estos datos solo para entregarme el premio. Se borran 90 días después de la entrega.
        </label>
        {err ? (
          <p className="err" role="alert">
            {err}
          </p>
        ) : null}
        <button className="btn" type="submit" disabled={S.busy || uploading}>
          {S.busy ? 'Enviando…' : uploading ? 'Subiendo fotos…' : 'Canjear'}
        </button>
      </form>
    </section>
  );
}

function DoneScreen({ S }) {
  const c = S.card;
  const share = { card: c, img: S.img, no: S.result.no };
  return (
    <section className="screen">
      <Holo card={c} img={S.img} stamp={<div className="stamp">CANJEADO</div>} />
      <p className="lbl">Canje registrado</p>
      <p className="ticket">{S.result.no}</p>
      <h2 className="display">¡Listo!</h2>
      <p className="lead">{S.result.test ? 'Fue con el código de prueba: no se registró nada ni se guardaron datos.' : 'Te escribimos por WhatsApp para coordinar la entrega. Guarda tu número de canje.'}</p>
      <button className="btn" type="button" onClick={() => shareOrDownload({ kind: 'story', ...share })}>
        Compartir
      </button>
      <button className="btn line" type="button" onClick={() => shareOrDownload({ kind: 'story', ...share }, true)}>
        Descargar imagen
      </button>
    </section>
  );
}

export default function App({ cfg }) {
  const [hashCode] = useState(() => {
    const c = readHash();
    if (c) history.replaceState(null, '', location.pathname);
    return c;
  });
  const [S, setS] = useState(() => ({
    screen: cfg.closed ? 'closed' : hashCode ? 'checking' : 'code',
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

  // The phone's back button goes back one screen (never back into a finished claim).
  const go = (screen, extra = {}) => {
    history.pushState({ s: screen }, '');
    patch({ screen, err: '', ...extra });
    window.scrollTo(0, 0);
  };
  useEffect(() => {
    const onPop = (e) => {
      if (screenRef.current === 'done' || screenRef.current === 'closed') {
        history.pushState({ s: screenRef.current }, '');
        return;
      }
      const s = (e.state && e.state.s) || 'code';
      patch((st) => ({ screen: s !== 'code' && !st.card ? 'code' : s, err: '' }));
      window.scrollTo(0, 0);
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
      if (!history.state) history.replaceState({ s: 'code' }, '');
      go('prize', { card: r.card, taken: r.status === 409, photoCheck: r.photoCheck !== false, delivery: r.delivery || ['Retiro en persona'], img, busy: false, photos: {}, previews: {}, uploading: {} });
    } else {
      patch({ busy: false, screen: 'code', err: r.error || 'No pudimos revisar el código.' });
    }
  };

  const checkRef = useRef(check);
  useLayoutEffect(() => {
    checkRef.current = check;
  });
  useEffect(() => {
    if (hashCode && !cfg.closed) checkRef.current(hashCode);
  }, [hashCode, cfg.closed]);

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
      patch({ busy: false, result: r, screen: 'done' });
      window.scrollTo(0, 0);
    } else {
      patch({ busy: false, err: r.error || 'No se pudo registrar. Intenta otra vez.' });
    }
  };

  let body;
  if (S.screen === 'closed')
    body = (
      <section className="screen">
        <h1 className="display">La campaña de canje terminó</h1>
        <p className="lead">Gracias a todos los que reclamaron su premio.</p>
      </section>
    );
  else if (S.screen === 'checking')
    body = (
      <section className="screen screen--wait" aria-live="polite">
        <span className="spin" aria-hidden="true" />
        <p className="lead">Buscando tu premio…</p>
      </section>
    );
  else if (S.screen === 'prize' && S.card) body = <PrizeScreen S={S} onClaim={() => go('form')} onAgain={() => go('code', { code: '', card: null })} />;
  else if (S.screen === 'form' && S.card) body = <FormScreen S={S} setForm={(form) => patch({ form, err: '' })} onPhoto={photo} onSubmit={claim} onBack={() => history.back()} />;
  else if (S.screen === 'done' && S.result) body = <DoneScreen S={S} />;
  else body = <CodeScreen cfg={cfg} code={S.code} setCode={(code) => patch({ code, err: '' })} busy={S.busy} err={S.err} onCheck={check} />;

  return (
    <>
      <Header />
      <main key={S.screen}>{body}</main>
    </>
  );
}
