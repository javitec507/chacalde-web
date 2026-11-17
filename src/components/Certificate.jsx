import { nameFontSize, NAME_BOX } from '../lib/name.js';

// The certificate exactly as printed (816 x 528 CSS px = half letter at 96 dpi).
export default function Certificate({ name = '', placeholder = 'Tu nombre aquí' }) {
  const text = String(name || '').trim();
  const empty = !text;
  const size = empty ? 15 : nameFontSize(text);
  return (
    <div className="cert" aria-hidden="true">
      <div className="cert__b1" />
      <div className="cert__b2" />
      <img className="cert__logo" src="/img/logo-black.png" alt="" />
      <div className="cert__div" />
      <div className="cert__org">
        DISQUE
        <br />
        CONSULTORIOS
        <br />
        CHACALDE
      </div>
      <img className="cert__icon" src="/img/icon.png" alt="" />
      <div className="cert__title">CERTIFICADO DE NO INCAPACIDAD</div>
      <div className="cert__rule" />

      <div className="cert__t" style={{ left: 48, top: 190 }}>
        Yo, <b>Chacalde,</b> certifico la no incapacidad del disque paciente:
      </div>
      <div className="cert__ln" style={{ left: NAME_BOX.left, top: 206, width: NAME_BOX.width }} />
      <div
        className={`cert__name${empty ? ' cert__name--empty' : ''}`}
        style={{ top: NAME_BOX.line - size, fontSize: size }}
      >
        {empty ? placeholder : text}
      </div>

      <div className="cert__t" style={{ left: 48, top: 221 }}>
        No ha sido evaluado y se considera estar incapacitado.
      </div>
      <div className="cert__t" style={{ left: 122, top: 259 }}>
        Por:
      </div>
      <div className="cert__v" style={{ left: 175, top: 256 }}>
        RAZONES NO RELACIONADAS A GTA VI
      </div>
      <div className="cert__ln" style={{ left: 168, top: 281, width: 525 }} />
      <div className="cert__t" style={{ left: 122, top: 296 }}>
        Del:
      </div>
      <div className="cert__v" style={{ left: 180, top: 292 }}>
        19 DE NOVIEMBRE DE 2026.
      </div>
      <div className="cert__ln" style={{ left: 168, top: 318, width: 525 }} />

      <img className="cert__seal" src="/img/sello.svg" alt="" />
      <div className="cert__t" style={{ left: 193, top: 347 }}>
        <b>Observación:</b> Hasta pronta mejoría.
      </div>
      <img className="cert__sign" src="/img/firma.svg" alt="" />
      <div className="cert__ln" style={{ left: 508, top: 461, width: 247 }} />
      <div className="cert__nofirma">NO FIRMA</div>
    </div>
  );
}
