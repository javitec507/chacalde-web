import { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import DecryptedText from './reactbits/DecryptedText.jsx';
import GlareHover from './reactbits/GlareHover.jsx';
import Certificate from './Certificate.jsx';
import { Download, Printer, Share, Scaled } from './ui.jsx';
import { download, generateAll, makeZip, shareFiles, PHOTOS } from '../lib/generate.js';
import { firstName } from '../lib/name.js';

const ease = [0.16, 1, 0.3, 1];

function useObjectUrls(result) {
  return useMemo(() => {
    if (!result) return null;
    return {
      pdf: URL.createObjectURL(result.pdf),
      items: result.items.map((it) => ({ ...it, postUrl: URL.createObjectURL(it.post), storyUrl: URL.createObjectURL(it.story) }))
    };
  }, [result]);
}

export default function Result({ name, turno, onBack }) {
  const [result, setResult] = useState(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  const [fmt, setFmt] = useState('post');
  const [busy, setBusy] = useState('');
  const urls = useObjectUrls(result);
  const printFrame = useRef(null);

  useEffect(() => {
    let alive = true;
    setResult(null);
    setError('');
    setProgress(0);
    generateAll(name, turno, (p) => alive && setProgress(p))
      .then((r) => alive && setResult(r))
      .catch((e) => {
        console.error(e);
        if (alive) setError('No pudimos armar tus archivos en este navegador. Recarga la página e inténtalo otra vez.');
      });
    return () => {
      alive = false;
    };
  }, [name, turno]);

  useEffect(
    () => () => {
      if (!urls) return;
      URL.revokeObjectURL(urls.pdf);
      urls.items.forEach((it) => {
        URL.revokeObjectURL(it.postUrl);
        URL.revokeObjectURL(it.storyUrl);
      });
    },
    [urls]
  );

  const ready = Boolean(result && urls);
  const base = result?.base || 'chacalde';

  const onPdf = () => ready && download(result.pdf, `${base}-certificado.pdf`);
  const onPrint = () => {
    if (!ready) return;
    const f = printFrame.current;
    f.onload = () => {
      try {
        f.contentWindow.focus();
        f.contentWindow.print();
      } catch {
        window.open(urls.pdf, '_blank', 'noopener');
      }
    };
    f.src = urls.pdf;
  };
  const filesFor = (kind) =>
    result.items.map((it, i) => new File([kind === 'story' ? it.story : it.post], `${base}-${kind === 'story' ? 'historia' : 'post'}-${i + 1}.jpg`, { type: 'image/jpeg' }));
  const onShare = async () => {
    if (!ready) return;
    try {
      setBusy('share');
      const ok = await shareFiles(filesFor(fmt), 'Hasta nuevo aviso. Saca el tuyo en chacalde.com');
      if (!ok) download(await makeZip(result), `${base}.zip`);
    } catch (e) {
      if (e?.name !== 'AbortError') console.error(e);
    } finally {
      setBusy('');
    }
  };
  const onZip = async () => {
    if (!ready) return;
    setBusy('zip');
    try {
      download(await makeZip(result), `${base}.zip`);
    } finally {
      setBusy('');
    }
  };

  const story = fmt === 'story';

  return (
    <main className="wrap result" id="top">
      <div className="result__top">
        <div className="led" role="status">
          <span className="led__num">
            <DecryptedText text={turno} animateOn="view" sequential characters="0123456789" speed={50} />
          </span>
          <span className="led__lbl">TURNO · PASE A RETIRAR</span>
        </div>
        <motion.div style={{ flex: '1 1 520px', minWidth: 0 }} initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.15, ease }}>
          <h1 className="display result__title">{firstName(name)}, ya estás de alta.</h1>
          <p className="lead" style={{ marginTop: 16 }}>
            Tu Certificado de No Incapacidad está listo. Descárgalo, compártelo y nos vemos el 19 (o no).
          </p>
        </motion.div>
      </div>

      <div className="result__grid">
        <motion.div className="preview" initial={{ y: 0 }} animate={{ y: [0, 0, 3, 0] }} transition={{ duration: 0.35, delay: 1.3, times: [0, 0.01, 0.4, 1] }}>
          <div className="preview__box">
            <Scaled w={816} h={528}>
              <Certificate name={name} />
            </Scaled>
          </div>
          <motion.div
            className="stamp"
            aria-hidden="true"
            initial={{ opacity: 0, scale: 2.6, rotate: -14 }}
            animate={{ opacity: 0.82, scale: 1, rotate: -8 }}
            transition={{ delay: 1, type: 'spring', stiffness: 520, damping: 18, mass: 0.9 }}
          >
            <b>ATENDIDO</b>
            <span>19 NOV 2026</span>
          </motion.div>
        </motion.div>

        <motion.div className="receipt" initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.4, ease }}>
          <h2 className="display">Tu nota</h2>
          <dl>
            <dt>Paciente</dt>
            <dd>
              <b>{name}</b>
            </dd>
            <dt>Desde</dt>
            <dd>19 de noviembre de 2026</dd>
            <dt>Observación</dt>
            <dd>Hasta pronta mejoría</dd>
            <dt>Turno</dt>
            <dd className="led-ink">№ {turno}</dd>
            <dt>Firma</dt>
            <dd>No firma</dd>
            <dt style={{ borderBottom: '1px solid #e0e0e0' }}>Validez</dt>
            <dd style={{ borderBottom: '1px solid #e0e0e0' }}>Ninguna</dd>
          </dl>
          <div className="receipt__actions">
            <button type="button" className="btn btn--ink" onClick={onPdf} disabled={!ready}>
              {ready ? 'Descargar PDF' : `Preparando… ${Math.round(progress * 100)}%`} <Download size={22} />
            </button>
            <div className="receipt__row">
              <button type="button" className="btn btn--line" onClick={onPrint} disabled={!ready}>
                <Printer /> Imprimir
              </button>
              <button type="button" className="btn btn--line" onClick={onShare} disabled={!ready || busy === 'share'}>
                <Share /> Compartir
              </button>
            </div>
            <p className="receipt__fine">
              PDF media carta (8.5 × 5.5 in), una página.{' '}
              <button type="button" onClick={onBack}>
                Corregir nombre
              </button>
            </p>
          </div>
        </motion.div>
      </div>

      {error && (
        <p className="error" role="alert" style={{ marginTop: 24, color: '#ff6b6b' }}>
          {error}
        </p>
      )}

      <section className="result__photos" aria-labelledby="h-out">
        <div className="result__photos-head">
          <div>
            <h2 id="h-out" className="display">Fotos para compartir</h2>
            <p>Con tu nombre ya puesto. Toca la flecha para bajar cada una.</p>
          </div>
          <div className="seg" role="group" aria-label="Formato de las fotos">
            <button type="button" aria-pressed={!story} onClick={() => setFmt('post')}>
              Post 4:5
            </button>
            <button type="button" aria-pressed={story} onClick={() => setFmt('story')}>
              Historia 9:16
            </button>
          </div>
        </div>

        <div className="out-grid">
          {PHOTOS.map((p, i) => {
            const it = urls?.items.find((x) => x.id === p.id);
            const src = it ? (story ? it.storyUrl : it.postUrl) : null;
            return (
              <motion.figure key={p.id} initial={{ opacity: 0, y: 60, scale: 0.95 }} whileInView={{ opacity: 1, y: 0, scale: 1 }} viewport={{ once: true }} transition={{ duration: 0.8, delay: i * 0.07, ease }}>
                {src ? (
                  <GlareHover borderRadius="0px" glareOpacity={0.35} glareSize={40} width="100%" height="auto" background="transparent">
                    <img src={src} alt={`${p.label}, ${story ? 'historia' : 'post'} con tu nombre`} width={1080} height={story ? 1920 : 1350} />
                  </GlareHover>
                ) : (
                  <div className="out-skel" style={{ aspectRatio: story ? '9 / 16' : '4 / 5' }}>
                    Preparando…
                  </div>
                )}
                {it && (
                  <button
                    type="button"
                    className="dl"
                    aria-label={`Descargar ${p.label}`}
                    onClick={() => download(story ? it.story : it.post, `${base}-${story ? 'historia' : 'post'}-${i + 1}-${p.id}.jpg`)}
                  >
                    <Download />
                  </button>
                )}
                <figcaption className="out-cap">
                  <b>{p.label}</b>
                  <span>{story ? '1080 × 1920' : '1080 × 1350'}</span>
                </figcaption>
              </motion.figure>
            );
          })}
        </div>

        <div className="result__zip">
          <button type="button" className="btn btn--paper" onClick={onZip} disabled={!ready || busy === 'zip'}>
            <Download size={22} /> Descargar todo (.zip)
          </button>
          <span>Recuerda: es una broma. No la presentes en ningún trámite.</span>
        </div>
      </section>
      <iframe ref={printFrame} title="Imprimir certificado" style={{ position: 'absolute', width: 0, height: 0, border: 0, visibility: 'hidden' }} />
    </main>
  );
}
