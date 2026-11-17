import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import BlurText from './reactbits/BlurText.jsx';
import ScrollVelocity from './reactbits/ScrollVelocity.jsx';
import TiltedCard from './reactbits/TiltedCard.jsx';
import Magnet from './reactbits/Magnet.jsx';
import DecryptedText from './reactbits/DecryptedText.jsx';
import Certificate from './Certificate.jsx';
import { Arrow, ArrowUp, ArrowOut, Cross, Scaled, useMedia } from './ui.jsx';
import { cleanName, NAME_MAX } from '../lib/name.js';
import { cssMatrix3d } from '../lib/homography.js';
import { PHOTOS } from '../data/photos.js';

// Where the certificate sits on each hero photo (in that photo's px).
const DESK_QUAD = [
  [154.066, 222.719],
  [762.18, 222.719],
  [763.1, 616.2],
  [155.0, 616.2]
];
const MOBILE_QUAD = [
  [86.5, 381.3],
  [995.9, 379.5],
  [995.9, 963.2],
  [86.5, 974.5]
];

const ease = [0.16, 1, 0.3, 1];

function Intake({ name, setName, onSubmit, error, turno, variant }) {
  const desk = variant === 'desk';
  return (
    <motion.form
      className={`intake ${desk ? 'intake--desk' : 'intake--stack'}`}
      onSubmit={onSubmit}
      noValidate
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.9, delay: desk ? 0.45 : 0.3, ease }}
    >
      {desk && (
        <>
          <h2 className="display">Hoja de admisión</h2>
          <p className="intake__lead">
            Escribe tu nombre y sal con tu Certificado de No Incapacidad, en PDF y en fotos del consultorio listas para
            compartir. No sirve para faltar a nada; sirve para que todos sepan dónde vas a estar el 19.
          </p>
        </>
      )}
      <div className="field-group">
        <label htmlFor={`nombre-${variant}`}>Nombre del disque paciente</label>
        <input
          id={`nombre-${variant}`}
          className="field"
          type="text"
          name="nombre"
          autoComplete="name"
          maxLength={NAME_MAX}
          placeholder="Escribe tu nombre"
          value={name}
          onChange={(e) => setName(cleanName(e.target.value))}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? `err-${variant}` : undefined}
        />
        {error ? (
          <span id={`err-${variant}`} className="error" role="alert">
            {error}
          </span>
        ) : (
          desk && <span className="hint">Así sale en la nota. Mírala a la izquierda mientras escribes.</span>
        )}
        <Magnet padding={40} magnetStrength={6} disabled={!desk} wrapperClassName="magnet-wrap" innerClassName="magnet-in" style={{ display: 'block', width: '100%', marginTop: desk ? 14 : 6 }}>
          <button type="submit" className="btn btn--ink">
            Sacar mi certificado <Arrow />
          </button>
        </Magnet>
      </div>
      <div className="intake__foot">
        <span>{desk ? 'Se arma en tu navegador. No guardamos tu nombre.' : 'No guardamos tu nombre.'}</span>
        <span className="turno">
          Tu turno{' '}
          <b>
            №{' '}
            <DecryptedText text={turno} animateOn="view" sequential characters="0123456789" speed={45} useOriginalCharsOnly={false} />
          </b>
        </span>
      </div>
    </motion.form>
  );
}

function Hero(props) {
  const wide = useMedia('(min-width: 1100px)', true);
  const deskMatrix = useMemo(() => cssMatrix3d(816, 528, DESK_QUAD), []);
  const mobileMatrix = useMemo(() => cssMatrix3d(816, 528, MOBILE_QUAD), []);

  if (wide) {
    return (
      <section aria-labelledby="h-hero">
        <div className="hero__band">
          <h1 id="h-hero" className="sr-only">Certificado de No Incapacidad</h1>
          <Meta />
        </div>
        <Scaled w={1440} h={823} className="desk">
          <img className="desk__photo" src="/img/escritorio-ancho.jpg" width="1440" height="823" alt="Escritorio de consultorio de noche, visto desde arriba, con la nota y tu nombre" fetchpriority="high" />
          <div className="cert-on-paper" style={{ transform: deskMatrix }}>
            <Certificate name={props.name} />
          </div>
          <Intake {...props} variant="desk" />
        </Scaled>
      </section>
    );
  }

  return (
    <section aria-labelledby="h-hero-m" className="mhero">
      <h1 id="h-hero-m" className="sr-only">Certificado de No Incapacidad</h1>
      <p className="mhero__lead">Tu Certificado de No Incapacidad, con tu nombre.</p>
      <div className="mhero__photo">
        <Scaled w={1080} h={1350}>
          <img src="/img/cenital-base.jpg" width="1080" height="1350" alt="Escritorio del consultorio de noche, visto desde arriba, con la nota y tu nombre" style={{ position: 'absolute', inset: 0, width: 1080, height: 1350 }} fetchpriority="high" />
          <div className="cert-on-paper" style={{ transform: mobileMatrix }}>
            <Certificate name={props.name} />
          </div>
        </Scaled>
      </div>
      <Intake {...props} variant="stack" />
    </section>
  );
}

function Meta() {
  const rows = [
    ['Documento', 'Certificado de No Incapacidad'],
    ['Observación', 'Hasta pronta mejoría'],
    ['Desde', '19.11.2026'],
    ['Validez', 'Ninguna']
  ];
  return (
    <dl className="meta">
      {rows.map(([k, v], i) => (
        <motion.div key={k} initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.7 + i * 0.08, ease }}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </motion.div>
      ))}
    </dl>
  );
}

function TickerRow({ items }) {
  return (
    <span className="ticker__item">
      {items.map((t) => (
        <span key={t} className="ticker__item">
          <span>{t}</span>
          <Cross size={22} />
        </span>
      ))}
    </span>
  );
}

function Ticker() {
  return (
    <div className="ticker" aria-hidden="true">
      <div className="ticker__row ticker__row--light">
        <ScrollVelocity
          texts={[<TickerRow key="a" items={['Certificado de No Incapacidad', 'Disque consultorios', 'Hasta pronta mejoría', 'Hasta nuevo aviso']} />]}
          velocity={60}
          numCopies={4}
          parallaxClassName="parallax"
          scrollerClassName="scroller"
        />
      </div>
      <div className="ticker__row ticker__row--dark">
        <ScrollVelocity
          texts={[<TickerRow key="b" items={['No firma', 'Disque paciente', 'No ha sido evaluado', 'Razones no relacionadas']} />]}
          velocity={-50}
          numCopies={4}
          parallaxClassName="parallax"
          scrollerClassName="scroller"
        />
      </div>
    </div>
  );
}

const DIRECTORY = [
  { title: 'Admisión', desc: 'Escribes tu nombre en la hoja de admisión.', floor: 'Planta baja', icon: <Arrow size={28} /> },
  { title: 'Consultorio', desc: 'La nota se llena sola con tu nombre. No duele.', floor: 'Piso 1', icon: <ArrowUp size={28} /> },
  { title: 'Alta', desc: 'Descargas el PDF y las fotos del consultorio para tus historias.', floor: 'Piso 2', icon: <ArrowOut size={26} />, line: true }
];

function How() {
  return (
    <section id="como" className="section" aria-labelledby="h-como">
      <div className="wrap split">
        <div className="split__lead">
          <BlurText tag="h2" className="display h2" text="Tres ventanillas. Cero filas." animateBy="words" direction="bottom" delay={90} />
          <p className="lead">Llegas, escribes tu nombre y sales con tu nota. Sin cita, sin cupo y sin que nadie te diga “es un momentito”.</p>
        </div>
        <motion.div
          className="split__body directory"
          role="list"
          aria-label="Directorio del consultorio"
          initial={{ opacity: 0, y: 70, scale: 0.96 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.9, ease }}
        >
          <div className="directory__head">
            <span>DIRECTORIO</span>
            <span>PISO</span>
          </div>
          {DIRECTORY.map((d, i) => (
            <motion.div
              key={d.title}
              role="listitem"
              className="directory__row"
              initial={{ opacity: 0, x: -56 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.8, delay: 0.15 + i * 0.12, ease }}
            >
              <span className={`directory__icon${d.line ? ' directory__icon--line' : ''}`}>{d.icon}</span>
              <span>
                <span className="directory__title">{d.title}</span>
                <span className="directory__desc">{d.desc}</span>
              </span>
              <span className="directory__floor">{d.floor}</span>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function Photos() {
  const hover = useMedia('(hover: hover) and (pointer: fine)', true);
  return (
    <section id="fotos" className="section photos" aria-labelledby="h-fotos">
      <div className="wrap">
        <div className="photos__head">
          <BlurText tag="h2" className="display h2" text="Tu nota, desde todos los ángulos." animateBy="words" direction="bottom" delay={80} />
          <p className="lead">
            Cuatro fotos del consultorio con tu nombre ya puesto, en formato post (4:5) e historia (9:16). Listas para Instagram y WhatsApp.
          </p>
        </div>
        <div className="photo-grid">
          {PHOTOS.map((p, i) => (
            <motion.figure
              key={p.id}
              style={{ margin: 0 }}
              initial={{ opacity: 0, y: 80, scale: 0.94 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.9, delay: i * 0.08, ease }}
            >
              {hover ? (
                <TiltedCard
                  imageSrc={`/img/ejemplo-${p.id}.jpg`}
                  altText={`La nota en la foto ${p.label}`}
                  containerWidth="100%"
                  containerHeight="auto"
                  imageWidth="100%"
                  imageHeight="100%"
                  style={{ aspectRatio: '4 / 5' }}
                  radius={0}
                  rotateAmplitude={10}
                  scaleOnHover={1.03}
                  showTooltip={false}
                  flipOnClick={false}
                  parallax={0}
                  gyroscope={false}
                  intro={false}
                  glare={0.35}
                  shadow={0.6}
                />
              ) : (
                <img className="photo-plain" src={`/img/ejemplo-${p.id}.jpg`} alt={`La nota en la foto ${p.label}`} loading="lazy" width="1080" height="1350" />
              )}
              <figcaption className="photo-cap">
                <b>{p.label}</b>
                <span>{p.note}</span>
              </figcaption>
            </motion.figure>
          ))}
        </div>
      </div>
    </section>
  );
}

function Notice() {
  return (
    <section id="aviso" className="section" aria-labelledby="h-aviso">
      <div className="wrap split">
        <div className="split__lead">
          <BlurText tag="h2" className="display h2" text="Letra pequeña. Es corta, léela." animateBy="words" direction="bottom" delay={80} />
          <p className="lead">Esto es para reírse y compartir. Si alguien la toma en serio, el problema no es la nota.</p>
          <a className="uplink navlink" href="#top">
            Volver a la ventanilla <ArrowUp size={18} />
          </a>
        </div>
        <motion.div
          className="split__body notice"
          initial={{ opacity: 0, y: 100, rotate: -8 }}
          whileInView={{ opacity: 1, y: 0, rotate: -0.6 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ type: 'spring', stiffness: 120, damping: 16 }}
        >
          <span className="notice__tape" aria-hidden="true" style={{ left: 48, transform: 'rotate(-4deg)' }} />
          <span className="notice__tape" aria-hidden="true" style={{ right: 48, transform: 'rotate(3deg)' }} />
          <div className="notice__paper">
            <p className="notice__title">AVISO</p>
            <ul>
              <li>Este certificado es una broma. No tiene validez médica, laboral, académica ni matrimonial.</li>
              <li>No lo presentes en tu trabajo, escuela, universidad ni ante ninguna autoridad.</li>
              <li>No lleva firma: dice “NO FIRMA” por algo.</li>
              <li>Tu nombre solo se usa para armar la nota en tu navegador. No lo guardamos.</li>
            </ul>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

export default function Home({ name, setName, onSubmit, turno }) {
  const [error, setError] = useState('');
  const submit = (e) => {
    e.preventDefault();
    const n = name.trim();
    if (n.length < 2) {
      setError('Escribe tu nombre para poder llenar la nota.');
      return;
    }
    setError('');
    onSubmit(n);
  };
  const set = (v) => {
    if (error) setError('');
    setName(v);
  };
  return (
    <main id="top">
      <Hero name={name} setName={set} onSubmit={submit} error={error} turno={turno} />
      <Ticker />
      <How />
      <Photos />
      <Notice />
    </main>
  );
}
