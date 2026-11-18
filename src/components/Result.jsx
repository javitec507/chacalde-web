import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import Loader from './Loader.jsx';
import DecryptedText from './reactbits/DecryptedText.jsx';
import GlareHover from './reactbits/GlareHover.jsx';
import Certificate from './Certificate.jsx';
import { Download, Printer, Share, Scaled } from './ui.jsx';
import { download, generateAll, makeZip, shareFiles, PHOTOS } from '../lib/generate.js';
import { firstName } from '../lib/name.js';
import { track } from '../lib/track.js';

const ease = [0.16, 1, 0.3, 1];

// Can this device share image files (phones: yes; most desktops: no)?
let shareSupport;
function canShareFiles() {
  if (shareSupport === undefined) {
    try {
      shareSupport = Boolean(navigator.canShare && navigator.canShare({ files: [new File([''], 'x.jpg', { type: 'image/jpeg' })] }));
    } catch {
      shareSupport = false;
    }
  }
  return shareSupport;
}

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
  const [sel, setSel] = useState(0);
  const ctaRef = useRef(null);
  const [bar, setBar] = useState(false);
  const [busy, setBusy] = useState('');
  const urls = useObjectUrls(result);
  const printFrame = useRef(null);

  // The waiting room stays up until the files are made (and at least a moment, so it reads).
  const [reveal, setReveal] = useState(false);
  const started = useRef(0);

  useEffect(() => {
    let alive = true;
    started.current = performance.now();
    setReveal(false);
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

  useEffect(() => {
    if (!(ready || error)) return undefined;
    const wait = Math.max(500, 1600 - (performance.now() - started.current));
    const t = setTimeout(() => setReveal(true), wait);
    return () => clearTimeout(t);
  }, [ready, error]);
  const base = result?.base || 'chacalde';

  const onPdf = () => {
    if (!ready) return;
    track('pdf');
    download(result.pdf, `${base}-certificado.pdf`);
  };
  const onPrint = () => {
    if (!ready) return;
    track('print');
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
  const fileOf = (it, i, kind) =>
    new File([kind === 'story' ? it.story : it.post], `${base}-${kind === 'story' ? 'historia' : 'post'}-${i + 1}-${it.id}.jpg`, { type: 'image/jpeg' });

  // Share files through the phone's share sheet (Instagram, WhatsApp…); where that isn't possible, download them.
  const share = async (files, fallback) => {
    if (!ready) return;
    try {
      setBusy('share');
      const ok = await shareFiles(files);
      if (ok) track('share');
      else await fallback();
    } catch (e) {
      if (e?.name !== 'AbortError') console.error(e);
    } finally {
      setBusy('');
    }
  };
  const shareStory = (i) =>
    share([fileOf(result.items[i], i, 'story')], async () => {
      track('photo');
      download(result.items[i].story, fileOf(result.items[i], i, 'story').name);
    });
  const shareAll = (kind) =>
    share(
      result.items.map((it, i) => fileOf(it, i, kind)),
      async () => {
        track('zip');
        download(await makeZip(result), `${base}.zip`);
      }
    );
  const downloadOne = (i, kind) => {
    if (!ready) return;
    track('photo');
    download(kind === 'story' ? result.items[i].story : result.items[i].post, fileOf(result.items[i], i, kind).name);
  };
  const onZip = async () => {
    if (!ready) return;
    setBusy('zip');
    track('zip');
    try {
      download(await makeZip(result), `${base}.zip`);
    } finally {
      setBusy('');
    }
  };

  // Phones: while the main share button is still below the screen, keep a copy of it pinned at the bottom.
  useEffect(() => {
    if (!reveal) return undefined;
    const cta = ctaRef.current;
    if (!cta || !('IntersectionObserver' in window)) return undefined;
    const io = new IntersectionObserver(([e]) => setBar(!e.isIntersecting && e.boundingClientRect.top > 0));
    io.observe(cta);
    return () => io.disconnect();
  }, [reveal]);

  const current = urls?.items[sel];
  const shareLabel = canShareFiles() ? 'Compartir en historias' : 'Descargar historia';

  return (
    <>
      <AnimatePresence>
        {!reveal && (
          <Loader
            key="gen"
            progress={ready ? 1 : progress * 0.96}
            label="Llenando tu nota"
            sub="Firmando, sellando y armando tus historias"
            turno={turno}
          />
        )}
      </AnimatePresence>
      {reveal && (
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
            Tu historia está lista, con tu nombre. Elige una de las 4 y súbela a Instagram o WhatsApp.
          </p>
        </motion.div>
      </div>

      {error && (
        <p className="error" role="alert" style={{ marginTop: 24, color: '#ff6b6b' }}>
          {error}
        </p>
      )}

      <section className="share" aria-labelledby="h-share">
        <motion.div className="share__stage" initial={{ opacity: 0, y: 40, rotate: -2 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ duration: 0.9, delay: 0.25, ease }}>
          <div className="share__phone">
            {current ? (
              <img key={current.storyUrl} src={current.storyUrl} alt={`Tu historia ${current.label}, con tu nombre`} width={1080} height={1920} />
            ) : (
              <div className="out-skel">Preparando…</div>
            )}
          </div>
        </motion.div>

        <motion.div className="share__side" initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, delay: 0.4, ease }}>
          <h2 id="h-share" className="display">Tu historia</h2>
          <p className="share__lead">Formato 9:16, lista para subir. Toca otra foto para cambiarla.</p>
          <div className="share__thumbs" role="radiogroup" aria-label="Elige tu historia">
            {PHOTOS.map((p, i) => {
              const it = urls?.items.find((x) => x.id === p.id);
              return (
                <button key={p.id} type="button" role="radio" aria-checked={i === sel} onClick={() => setSel(i)} disabled={!it}>
                  {it ? <img src={it.storyUrl} alt="" width={1080} height={1920} /> : <span className="out-skel" />}
                  <span className="share__thumb-label">{p.label}</span>
                </button>
              );
            })}
          </div>
          <button ref={ctaRef} type="button" className="btn btn--paper share__cta" onClick={() => shareStory(sel)} disabled={!ready || busy === 'share'}>
            {shareLabel} {canShareFiles() ? <Share size={24} /> : <Download size={22} />}
          </button>
          <div className="share__row">
            <button type="button" className="btn btn--line-light" onClick={() => downloadOne(sel, 'story')} disabled={!ready}>
              <Download /> Descargar esta
            </button>
            <button type="button" className="btn btn--line-light" onClick={() => shareAll('story')} disabled={!ready || busy === 'share'}>
              <Share /> Las 4 historias
            </button>
          </div>
          <p className="share__hint">
            {canShareFiles()
              ? 'En el menú elige Instagram → Historia, o WhatsApp → Mi estado.'
              : 'Desde la compu se descarga: pásala a tu teléfono y súbela a tus historias.'}
          </p>
        </motion.div>
      </section>

      <section className="result__photos" aria-labelledby="h-feed">
        <div className="result__photos-head">
          <div>
            <h2 id="h-feed" className="display">También para el feed</h2>
            <p>Las mismas 4 fotos en formato post (4:5), con tu nombre en grande.</p>
          </div>
          <button type="button" className="btn btn--line-light result__feed-share" onClick={() => shareAll('post')} disabled={!ready || busy === 'share'}>
            <Share /> {canShareFiles() ? 'Compartir los 4 posts' : 'Descargar los 4 posts'}
          </button>
        </div>
        <div className="out-grid out-grid--small">
          {PHOTOS.map((p, i) => {
            const it = urls?.items.find((x) => x.id === p.id);
            return (
              <motion.figure key={p.id} initial={{ opacity: 0, y: 50 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8, delay: i * 0.06, ease }}>
                {it ? (
                  <GlareHover borderRadius="0px" glareOpacity={0.3} glareSize={40} width="100%" height="auto" background="transparent">
                    <img src={it.postUrl} alt={`${p.label}, post con tu nombre`} width={1080} height={1350} loading="lazy" />
                  </GlareHover>
                ) : (
                  <div className="out-skel" style={{ aspectRatio: '4 / 5' }}>
                    Preparando…
                  </div>
                )}
                {it && (
                  <button type="button" className="dl" aria-label={`Descargar post ${p.label}`} onClick={() => downloadOne(i, 'post')}>
                    <Download />
                  </button>
                )}
                <figcaption className="out-cap">
                  <b>{p.label}</b>
                  <span>1080 × 1350</span>
                </figcaption>
              </motion.figure>
            );
          })}
        </div>
      </section>

      <section className="result__pdf" aria-labelledby="h-pdf">
        <div className="result__grid">
          <motion.div className="preview" initial={{ y: 0 }} whileInView={{ y: [0, 0, 3, 0] }} viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.35, delay: 0.6, times: [0, 0.01, 0.4, 1] }}>
            <div className="preview__box">
              <Scaled w={816} h={528}>
                <Certificate name={name} />
              </Scaled>
            </div>
            <motion.div
              className="stamp"
              aria-hidden="true"
              initial={{ opacity: 0, scale: 2.6, rotate: -14 }}
              whileInView={{ opacity: 0.82, scale: 1, rotate: -8 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ delay: 0.3, type: 'spring', stiffness: 520, damping: 18, mass: 0.9 }}
            >
              <b>ATENDIDO</b>
              <span>19 NOV 2026</span>
            </motion.div>
          </motion.div>

          <div className="receipt">
            <h2 id="h-pdf" className="display">Tu nota en PDF</h2>
            <dl>
              <dt>Paciente</dt>
              <dd>
                <b>{name}</b>
              </dd>
              <dt>Desde</dt>
              <dd>19 de noviembre de 2026</dd>
              <dt>Observación</dt>
              <dd>Cero validez, pero tu dale</dd>
              <dt>Turno</dt>
              <dd className="led-ink">№ {turno}</dd>
              <dt>Firma</dt>
              <dd>Mayer Mizrachi Matalon (no firma)</dd>
              <dt style={{ borderBottom: '1px solid #e0e0e0' }}>Validez</dt>
              <dd style={{ borderBottom: '1px solid #e0e0e0' }}>Ninguna</dd>
            </dl>
            <div className="receipt__row" style={{ marginTop: 20 }}>
              <button type="button" className="btn btn--line" onClick={onPdf} disabled={!ready}>
                <Download /> Descargar PDF
              </button>
              <button type="button" className="btn btn--line" onClick={onPrint} disabled={!ready}>
                <Printer /> Imprimir
              </button>
            </div>
            <p className="receipt__fine">
              Media carta (8.5 × 5.5 in), una página.{' '}
              <button type="button" onClick={onBack}>
                Corregir nombre
              </button>
            </p>
          </div>
        </div>
      </section>

      <AnimatePresence>
        {bar && (
          <motion.div className="sharebar" initial={{ y: 90 }} animate={{ y: 0 }} exit={{ y: 90 }} transition={{ duration: 0.35, ease }}>
            <button type="button" className="btn btn--paper" onClick={() => shareStory(sel)} disabled={!ready || busy === 'share'}>
              {shareLabel} {canShareFiles() ? <Share size={24} /> : <Download size={22} />}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="result__zip">
        <button type="button" className="btn btn--paper" onClick={onZip} disabled={!ready || busy === 'zip'}>
          <Download size={22} /> Descargar todo (.zip)
        </button>
        <span>Historias, posts y PDF. Recuerda: es una broma, no la presentes en ningún trámite.</span>
      </div>
      <iframe ref={printFrame} title="Imprimir certificado" style={{ position: 'absolute', width: 0, height: 0, border: 0, visibility: 'hidden' }} />
    </main>
      )}
    </>
  );
}
