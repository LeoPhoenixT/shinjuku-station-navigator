import { lazy, Suspense } from 'react';
import { useI18n } from '../i18n/context.js';
import { SURFACE_CONTEXT_SOURCE } from '../schema/surfaceContext.js';
import './App.css';

const FloorViewer = lazy(() => import('../components/FloorViewer.js').then((module) => ({ default: module.FloorViewer })));

export function App() {
  const { t } = useI18n();
  return (
    <main className="app-shell">
      <h1 className="visually-hidden">{t('app.title')}</h1>

      <section className="viewer-panel" aria-label={t('app.viewerLabel')}>
        <Suspense fallback={<div className="viewer-status">{t('app.loadingRenderer')}</div>}><FloorViewer /></Suspense>
      </section>
      <footer className="data-attribution">
        {t('attribution.sourcePrefix')}{' '}
        <a href="https://www.geospatial.jp/ckan/dataset/mlit-indoor-shinjuku-r2" target="_blank" rel="noreferrer">
          {t('attribution.dataset')}
        </a>
        {' '}{t('attribution.modifiedSuffix')} ·{' '}
        <a href="https://www.geospatial.jp/ckan/dataset/ecabe2e2-21a9-4a72-8dee-0b34e2c34fb6/resource/e3b28fde-5546-4c9d-956b-69363d707835/download/.pdf" target="_blank" rel="noreferrer">
          {t('attribution.terms')}
        </a>
        {' · '}
        <a href={SURFACE_CONTEXT_SOURCE} target="_blank" rel="noreferrer">{t('attribution.surface')}</a>
        {' '}{t('attribution.surfaceModified')}
        {' ('}<a href="https://www.gsi.go.jp/kikakuchousei/kikakuchousei40182.html" target="_blank" rel="noreferrer">{t('attribution.surfaceTerms')}</a>{')'}
      </footer>
    </main>
  );
}
