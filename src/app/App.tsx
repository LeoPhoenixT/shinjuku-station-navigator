import { lazy, Suspense } from 'react';
import { useI18n } from '../i18n/context.js';
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
        <a href="https://www.digital.go.jp/assets/contents/node/basic_page/field_ref_resources/f7fde41d-ffca-4b2a-9b25-94b8a701a037/a0f187e6/20220706_resources_data_betten_01.pdf" target="_blank" rel="noreferrer">
          {t('attribution.terms')}
        </a>
      </footer>
    </main>
  );
}
