import { ArrowBack } from './ui.jsx';

export function Header({ onBack }) {
  return (
    <header className="site-header">
      <div className="site-header__in">
        <a className="brand" href="/" aria-label="Chacalde, inicio">
          <img src="/img/logo-white.png" alt="Chacalde" width="95" height="34" />
          <span>
            Disque
            <br />
            Consultorios
          </span>
        </a>
        {onBack ? (
          <button type="button" className="back-link" onClick={onBack}>
            <ArrowBack /> Sacar otro certificado
          </button>
        ) : (
          <>
            <nav className="nav" aria-label="Principal">
              <a className="navlink" href="#como">Cómo funciona</a>
              <a className="navlink" href="#fotos">Fotos</a>
              <a className="navlink" href="#aviso">Letra pequeña</a>
            </nav>
            <span className="chip">
              <span className="dot" aria-hidden="true" />
              <b>ABIERTO</b>
              <span className="chip__txt">hasta nuevo aviso</span>
            </span>
          </>
        )}
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="wrap site-footer__in">
        <img className="site-footer__icon" src="/img/icon.png" alt="" aria-hidden="true" width="52" height="54" />
        <a href="#top" aria-label="Chacalde, volver arriba">
          <img className="site-footer__logo" src="/img/logo-black.png" alt="Chacalde" />
        </a>
        <span className="site-footer__txt">Disque Consultorios Chacalde · chacalde.com</span>
        <nav aria-label="Pie de página">
          <a className="navlink" href="/#como">Cómo funciona</a>
          <a className="navlink" href="/#fotos">Fotos</a>
          <a className="navlink" href="/#aviso">Letra pequeña</a>
        </nav>
        <p className="site-footer__fine">Contenido de humor. Esta nota no es válida para ningún trámite.</p>
      </div>
    </footer>
  );
}
