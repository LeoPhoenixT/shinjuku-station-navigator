import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../i18n/context.js';
import { floorDisplayName } from '../places/placePresentation.js';
import type { ViewerDisplayViewModel, ViewerNavigationViewModel } from './viewerViewModels.js';

interface MapToolbarProps {
  readonly navigation: ViewerNavigationViewModel;
  readonly display: ViewerDisplayViewModel;
  readonly canFitRoute: boolean;
  readonly settingsOpen?: boolean;
  readonly onSettingsOpenChange?: (open: boolean) => void;
}

export function MapToolbar(props: MapToolbarProps) {
  const { floors, camera } = props.navigation;
  const { layers, diagnostics } = props.display;
  const { locale, setLocale, t } = useI18n();
  const floorListRef = useRef<HTMLDivElement>(null);
  const settingsTriggerRef = useRef<HTMLElement>(null);
  const settingsCloseRef = useRef<HTMLButtonElement>(null);
  const settingsWasOpenRef = useRef(Boolean(props.settingsOpen));
  const [floorOverflow, setFloorOverflow] = useState({ before: false, after: false });
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false);
  const updateFloorOverflow = useCallback(() => {
    const list = floorListRef.current;
    if (!list) return;
    const horizontal = list.scrollWidth > list.clientWidth + 1;
    const position = horizontal ? list.scrollLeft : list.scrollTop;
    const maximum = horizontal ? list.scrollWidth - list.clientWidth : list.scrollHeight - list.clientHeight;
    setFloorOverflow({ before: position > 1, after: maximum - position > 1 });
  }, []);
  const moveFloorList = (direction: -1 | 1) => {
    const list = floorListRef.current;
    if (!list) return;
    const horizontal = list.scrollWidth > list.clientWidth + 1;
    const distance = Math.max(80, (horizontal ? list.clientWidth : list.clientHeight) * 0.72) * direction;
    list.scrollTo?.({
      left: horizontal ? list.scrollLeft + distance : list.scrollLeft,
      top: horizontal ? list.scrollTop : list.scrollTop + distance,
      behavior: 'smooth',
    });
  };
  useEffect(() => {
    const list = floorListRef.current;
    if (!list) return;
    const activeButton = [...list.querySelectorAll<HTMLElement>('[data-floor-id]')].find(({ dataset }) => dataset.floorId === floors.activeFloor);
    activeButton?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    updateFloorOverflow();
    const update = () => updateFloorOverflow();
    list.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => { list.removeEventListener('scroll', update); window.removeEventListener('resize', update); };
  }, [floors.activeFloor, floors.floorIds, updateFloorOverflow]);
  useLayoutEffect(() => {
    const settingsOpen = Boolean(props.settingsOpen);
    if (settingsOpen && !settingsWasOpenRef.current) {
      settingsCloseRef.current?.focus();
    } else if (!settingsOpen && settingsWasOpenRef.current) {
      const trigger = settingsTriggerRef.current;
      if (trigger?.isConnected) trigger.focus();
    }
    settingsWasOpenRef.current = settingsOpen;
  }, [props.settingsOpen]);
  const modifiedDisplayCount = Number(layers.showFacilities) + Number(layers.showStructuralDetails) + Number(layers.showOfficialNetwork);
  const focusedSelection = floors.floorViewMode === 'focused';
  const publicVisibleCount = floors.floorIds.filter((floorId) => floors.visibleFloors.includes(floorId)).length;
  const runMobileTool = (action: () => void) => { action(); setMobileToolsOpen(false); };
  return <>
    <aside className="floor-rail" aria-label={t('map.floorControls')}>
      <div className="floor-rail-modes" role="group" aria-label={t('map.floorViewMode')}>
        <button type="button" aria-pressed={floors.floorViewMode === 'route'} disabled={!props.canFitRoute} onClick={floors.showRouteFloors}>{t('map.routeFloors')}</button>
        <button type="button" aria-pressed={floors.floorViewMode === 'stack'} onClick={floors.showStack}>{t('map.allFloors')}</button>
      </div>
      <div className={`floor-rail-scroll-wrap ${floorOverflow.before ? 'has-floor-before' : ''} ${floorOverflow.after ? 'has-floor-after' : ''}`}>
        <button type="button" className="floor-scroll-button floor-scroll-before" aria-label={t('map.previousFloors')} disabled={!floorOverflow.before} onClick={() => moveFloorList(-1)}><span className="floor-arrow-desktop" aria-hidden="true">↑</span><span className="floor-arrow-mobile" aria-hidden="true">‹</span></button>
        <div className="floor-rail-levels" role="radiogroup" aria-label={t('map.floorFocus')} ref={floorListRef}>
        {[...floors.floorIds].reverse().map((floorId) => <button
          type="button"
          role="radio"
          key={`focus:${floorId}`}
          aria-label={t('map.focusFloor', {
            floor: floorDisplayName(floorId, locale),
            route: floors.routeFloorIds.includes(floorId) ? t('map.onRoute') : '',
          })}
          data-floor-id={floorId}
          aria-checked={focusedSelection && floors.activeFloor === floorId}
          className={`${focusedSelection && floors.activeFloor === floorId ? 'floor-active' : ''} ${floors.routeFloorIds.includes(floorId) ? 'floor-on-route' : ''}`}
          onClick={() => floors.selectFloor(floorId)}
        ><span>{floorId === '0' ? 'G' : floorId}</span>{floors.routeFloorIds.includes(floorId) && <i aria-hidden="true" />}</button>)}
        </div>
        <button type="button" className="floor-scroll-button floor-scroll-after" aria-label={t('map.nextFloors')} disabled={!floorOverflow.after} onClick={() => moveFloorList(1)}><span className="floor-arrow-desktop" aria-hidden="true">↓</span><span className="floor-arrow-mobile" aria-hidden="true">›</span></button>
      </div>
    </aside>

    <aside className={`camera-toolbar ${mobileToolsOpen || props.settingsOpen ? 'camera-toolbar-open' : ''}`} aria-label={t('map.cameraControls')}>
      <button type="button" className="mobile-tools-toggle" aria-expanded={mobileToolsOpen} onClick={() => setMobileToolsOpen((open) => !open)}>{t('map.tools')}</button>
      <button type="button" className="desktop-camera-control" onClick={camera.fitRoute} disabled={!props.canFitRoute} aria-label={t('map.fitRoute')} title={t('map.fitRoute')}>{t('map.route')}</button>
      <button type="button" className="desktop-camera-control" onClick={camera.fitStation} aria-label={t('map.fitStation')} title={t('map.fitStation')}>{t('map.station')}</button>
      <button type="button" className="desktop-camera-control" onClick={camera.zoomOut} aria-label={t('map.zoomOut')} title={t('map.zoomOut')}>−</button>
      <button type="button" className="desktop-camera-control" onClick={camera.zoomIn} aria-label={t('map.zoomIn')} title={t('map.zoomIn')}>＋</button>
      <button type="button" className="compass-control" onClick={() => runMobileTool(camera.showNorthView)} aria-label={t('map.northUp')} title={t('map.heading', { degrees: camera.cameraHeading })}><span className="compass-needle" style={{ transform: `rotate(${-camera.cameraHeading}deg)` }}>↑</span><span>N</span></button>
      <button type="button" onClick={() => runMobileTool(camera.showAngledView)} aria-label={t('map.angled3d')} title={t('map.angled3d')}>3D</button>
      <details className="map-settings" open={props.settingsOpen}>
        <summary ref={settingsTriggerRef} aria-label={t('map.settingsLabel')} onClick={props.onSettingsOpenChange ? (event) => { event.preventDefault(); setMobileToolsOpen(false); props.onSettingsOpenChange?.(!props.settingsOpen); } : undefined}>{t('map.settings')}{modifiedDisplayCount > 0 && <i aria-label={t('map.activeDisplayGroups', { count: modifiedDisplayCount })}>{modifiedDisplayCount}</i>}</summary>
      </details>
    </aside>
    {props.settingsOpen && typeof document !== 'undefined' && createPortal(<div className="settings-layer">
      <div className="settings-menu" role="dialog" aria-modal="false" aria-label={t('settings.dialog')} onKeyDown={(event) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        props.onSettingsOpenChange?.(false);
      }}>
          <header className="settings-panel-header"><span><strong>{t('settings.title')}</strong><small>{t('settings.subtitle')}</small></span><button ref={settingsCloseRef} type="button" aria-label={t('settings.close')} onClick={() => props.onSettingsOpenChange?.(false)}>{t('settings.done')}</button></header>

          <fieldset className="settings-quick-grid"><legend>{t('settings.displayLayers')}</legend>
            <label><input type="checkbox" checked={layers.showFacilities} onChange={(event) => layers.setShowFacilities(event.target.checked)} /><span><strong>{t('settings.markers')}</strong><small>{t('settings.markersHelp')}</small></span></label>
            <label><input type="checkbox" checked={layers.showStructuralDetails} onChange={(event) => layers.setShowStructuralDetails(event.target.checked)} /><span><strong>{t('settings.outlines')}</strong><small>{t('settings.outlinesHelp')}</small></span></label>
            <label><input type="checkbox" checked={layers.showOfficialNetwork} onChange={(event) => layers.setShowOfficialNetwork(event.target.checked)} /><span><strong>{t('settings.walkingNetwork')}</strong><small>{t('settings.walkingNetworkHelp')}</small></span></label>
          </fieldset>

          <fieldset><legend>{t('language.title')}</legend><div className="settings-segments language-segments" role="radiogroup" aria-label={t('language.title')}>
            <label><input type="radio" name="app-locale" value="en" checked={locale === 'en'} onChange={() => setLocale('en')} /><span>{t('language.english')}</span></label>
            <label><input type="radio" name="app-locale" value="ja" checked={locale === 'ja'} onChange={() => setLocale('ja')} /><span>{t('language.japanese')}</span></label>
          </div></fieldset>

          <details className="settings-subsection"><summary>{t('settings.markerCategories')} <span>{layers.showFacilities ? t('settings.categoriesEnabled', { enabled: layers.enabledFacilityCategories.size, total: layers.facilityCategories.length }) : t('settings.markersHidden')}</span></summary><div className="settings-subsection-body">
            <div className="settings-inline-actions"><button type="button" disabled={!layers.showFacilities} onClick={layers.showAllFacilityCategories}>{t('settings.showAll')}</button><button type="button" disabled={!layers.showFacilities || layers.enabledFacilityCategories.size === 0} onClick={layers.clearAllFacilityCategories}>{t('settings.clearAll')}</button><button type="button" disabled={!layers.showFacilities} onClick={layers.resetFacilityCategories}>{t('settings.resetDefaults')}</button></div>
            <div className="facility-category-grid" role="group" aria-label={t('settings.markerCategories')}>{layers.facilityCategories.map((category) => <label key={category.code}><input type="checkbox" checked={layers.enabledFacilityCategories.has(category.code)} disabled={!layers.showFacilities} onChange={() => layers.toggleFacilityCategory(category.code)} /><span>{category.label}<small>{category.count}</small></span></label>)}</div>
          </div></details>

          <details className="settings-subsection"><summary>{t('settings.visibleFloors')} <span>{publicVisibleCount === floors.floorIds.length ? t('settings.allFloorCount', { count: floors.floorIds.length }) : t('settings.someFloorCount', { visible: publicVisibleCount, total: floors.floorIds.length })}</span></summary><div className="settings-subsection-body facility-category-grid" role="group" aria-label={t('settings.customFloors')}>{[...floors.floorIds].reverse().map((floorId) => <label key={floorId}><input type="checkbox" checked={floors.visibleFloors.includes(floorId)} onChange={() => floors.toggleCustomFloor(floorId)} /><span>{floorId === '0' ? 'G' : floorId}</span></label>)}</div></details>

          <fieldset><legend>{t('settings.viewInteraction')}</legend><label className="settings-row"><input type="checkbox" checked={camera.rotationEnabled} onChange={(event) => camera.setRotationEnabled(event.target.checked)} /> {t('settings.freeRotation')}</label></fieldset>

          <details className="settings-subsection"><summary>{t('settings.developerDiagnostics')}</summary><div className="settings-subsection-body">
            <label className="settings-row"><input type="checkbox" checked={diagnostics.debug} onChange={(event) => diagnostics.setDebug(event.target.checked)} /> {t('settings.debugMode')}</label>
            {diagnostics.debug && <><label className="settings-row"><input type="checkbox" checked={diagnostics.showAllSourceLinks} onChange={(event) => diagnostics.setShowAllSourceLinks(event.target.checked)} /> {t('settings.allSourceLinks')}</label><label className="settings-row"><input type="checkbox" checked={diagnostics.showTwsi} onChange={(event) => diagnostics.setShowTwsi(event.target.checked)} /> {t('settings.twsi')}</label><label className="settings-row"><input type="checkbox" checked={diagnostics.showOfficialNodes} onChange={(event) => diagnostics.setShowOfficialNodes(event.target.checked)} /> {t('settings.nodeIds')}</label></>}
          </div></details>
      </div>
    </div>, document.body)}
  </>;
}
