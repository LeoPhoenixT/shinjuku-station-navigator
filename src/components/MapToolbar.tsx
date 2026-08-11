import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { FloorViewMode } from '../map/displayPreferences.js';
import { useI18n } from '../i18n/context.js';
import { floorDisplayName } from '../places/placePresentation.js';

interface FacilityCategoryOption { code: string; label: string; count: number }

interface MapToolbarProps {
  floorIds: string[];
  visibleFloors: string[];
  routeFloorIds: string[];
  activeFloor: string;
  floorViewMode: FloorViewMode;
  selectFloor: (floorId: string) => void;
  showStack: () => void;
  showRouteFloors: () => void;
  toggleCustomFloor: (floorId: string) => void;
  canFitRoute: boolean;
  fitRoute: () => void;
  fitStation: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  showNorthView: () => void;
  showAngledView: () => void;
  cameraHeading: number;
  rotationEnabled: boolean;
  setRotationEnabled: (value: boolean) => void;
  showFacilities: boolean;
  setShowFacilities: (value: boolean) => void;
  facilityCategories: FacilityCategoryOption[];
  enabledFacilityCategories: ReadonlySet<string>;
  toggleFacilityCategory: (code: string) => void;
  showAllFacilityCategories: () => void;
  clearAllFacilityCategories: () => void;
  resetFacilityCategories: () => void;
  showStructuralDetails: boolean;
  setShowStructuralDetails: (value: boolean) => void;
  debug: boolean;
  setDebug: (value: boolean) => void;
  showAllSourceLinks: boolean;
  setShowAllSourceLinks: (value: boolean) => void;
  showOfficialNetwork: boolean;
  setShowOfficialNetwork: (value: boolean) => void;
  showOfficialNodes: boolean;
  setShowOfficialNodes: (value: boolean) => void;
  showTwsi: boolean;
  setShowTwsi: (value: boolean) => void;
  settingsOpen?: boolean;
  onSettingsOpenChange?: (open: boolean) => void;
}

export function MapToolbar(props: MapToolbarProps) {
  const { locale, setLocale, t } = useI18n();
  const floorListRef = useRef<HTMLDivElement>(null);
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
    const activeButton = [...list.querySelectorAll<HTMLElement>('[data-floor-id]')].find(({ dataset }) => dataset.floorId === props.activeFloor);
    activeButton?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    updateFloorOverflow();
    const update = () => updateFloorOverflow();
    list.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => { list.removeEventListener('scroll', update); window.removeEventListener('resize', update); };
  }, [props.activeFloor, props.floorIds, updateFloorOverflow]);
  const modifiedDisplayCount = Number(props.showFacilities) + Number(props.showStructuralDetails) + Number(props.showOfficialNetwork);
  const focusedSelection = props.floorViewMode === 'focused';
  const publicVisibleCount = props.floorIds.filter((floorId) => props.visibleFloors.includes(floorId)).length;
  const runMobileTool = (action: () => void) => { action(); setMobileToolsOpen(false); };
  return <>
    <aside className="floor-rail" aria-label={t('map.floorControls')}>
      <div className="floor-rail-modes" role="group" aria-label={t('map.floorViewMode')}>
        <button type="button" aria-pressed={props.floorViewMode === 'route'} disabled={!props.canFitRoute} onClick={props.showRouteFloors}>{t('map.routeFloors')}</button>
        <button type="button" aria-pressed={props.floorViewMode === 'stack'} onClick={props.showStack}>{t('map.allFloors')}</button>
      </div>
      <div className={`floor-rail-scroll-wrap ${floorOverflow.before ? 'has-floor-before' : ''} ${floorOverflow.after ? 'has-floor-after' : ''}`}>
        <button type="button" className="floor-scroll-button floor-scroll-before" aria-label={t('map.previousFloors')} disabled={!floorOverflow.before} onClick={() => moveFloorList(-1)}><span className="floor-arrow-desktop" aria-hidden="true">↑</span><span className="floor-arrow-mobile" aria-hidden="true">‹</span></button>
        <div className="floor-rail-levels" role="radiogroup" aria-label={t('map.floorFocus')} ref={floorListRef}>
        {[...props.floorIds].reverse().map((floorId) => <button
          type="button"
          role="radio"
          key={`focus:${floorId}`}
          aria-label={t('map.focusFloor', {
            floor: floorDisplayName(floorId, locale),
            route: props.routeFloorIds.includes(floorId) ? t('map.onRoute') : '',
          })}
          data-floor-id={floorId}
          aria-checked={focusedSelection && props.activeFloor === floorId}
          className={`${focusedSelection && props.activeFloor === floorId ? 'floor-active' : ''} ${props.routeFloorIds.includes(floorId) ? 'floor-on-route' : ''}`}
          onClick={() => props.selectFloor(floorId)}
        ><span>{floorId === '0' ? 'G' : floorId}</span>{props.routeFloorIds.includes(floorId) && <i aria-hidden="true" />}</button>)}
        </div>
        <button type="button" className="floor-scroll-button floor-scroll-after" aria-label={t('map.nextFloors')} disabled={!floorOverflow.after} onClick={() => moveFloorList(1)}><span className="floor-arrow-desktop" aria-hidden="true">↓</span><span className="floor-arrow-mobile" aria-hidden="true">›</span></button>
      </div>
    </aside>

    <aside className={`camera-toolbar ${mobileToolsOpen || props.settingsOpen ? 'camera-toolbar-open' : ''}`} aria-label={t('map.cameraControls')}>
      <button type="button" className="mobile-tools-toggle" aria-expanded={mobileToolsOpen} onClick={() => setMobileToolsOpen((open) => !open)}>{t('map.tools')}</button>
      <button type="button" className="desktop-camera-control" onClick={props.fitRoute} disabled={!props.canFitRoute} aria-label={t('map.fitRoute')} title={t('map.fitRoute')}>{t('map.route')}</button>
      <button type="button" className="desktop-camera-control" onClick={props.fitStation} aria-label={t('map.fitStation')} title={t('map.fitStation')}>{t('map.station')}</button>
      <button type="button" className="desktop-camera-control" onClick={props.zoomOut} aria-label={t('map.zoomOut')} title={t('map.zoomOut')}>−</button>
      <button type="button" className="desktop-camera-control" onClick={props.zoomIn} aria-label={t('map.zoomIn')} title={t('map.zoomIn')}>＋</button>
      <button type="button" className="compass-control" onClick={() => runMobileTool(props.showNorthView)} aria-label={t('map.northUp')} title={t('map.heading', { degrees: props.cameraHeading })}><span className="compass-needle" style={{ transform: `rotate(${-props.cameraHeading}deg)` }}>↑</span><span>N</span></button>
      <button type="button" onClick={() => runMobileTool(props.showAngledView)} aria-label={t('map.angled3d')} title={t('map.angled3d')}>3D</button>
      <details className="map-settings" open={props.settingsOpen}>
        <summary aria-label={t('map.settingsLabel')} onClick={props.onSettingsOpenChange ? (event) => { event.preventDefault(); setMobileToolsOpen(false); props.onSettingsOpenChange?.(!props.settingsOpen); } : undefined}>{t('map.settings')}{modifiedDisplayCount > 0 && <i aria-label={t('map.activeDisplayGroups', { count: modifiedDisplayCount })}>{modifiedDisplayCount}</i>}</summary>
      </details>
    </aside>
    {props.settingsOpen && typeof document !== 'undefined' && createPortal(<div className="settings-layer">
      <div className="settings-menu" role="dialog" aria-modal="false" aria-label={t('settings.dialog')}>
          <header className="settings-panel-header"><span><strong>{t('settings.title')}</strong><small>{t('settings.subtitle')}</small></span><button type="button" aria-label={t('settings.close')} onClick={() => props.onSettingsOpenChange?.(false)}>{t('settings.done')}</button></header>

          <fieldset className="settings-quick-grid"><legend>{t('settings.displayLayers')}</legend>
            <label><input type="checkbox" checked={props.showFacilities} onChange={(event) => props.setShowFacilities(event.target.checked)} /><span><strong>{t('settings.markers')}</strong><small>{t('settings.markersHelp')}</small></span></label>
            <label><input type="checkbox" checked={props.showStructuralDetails} onChange={(event) => props.setShowStructuralDetails(event.target.checked)} /><span><strong>{t('settings.outlines')}</strong><small>{t('settings.outlinesHelp')}</small></span></label>
            <label><input type="checkbox" checked={props.showOfficialNetwork} onChange={(event) => props.setShowOfficialNetwork(event.target.checked)} /><span><strong>{t('settings.walkingNetwork')}</strong><small>{t('settings.walkingNetworkHelp')}</small></span></label>
          </fieldset>

          <fieldset><legend>{t('language.title')}</legend><div className="settings-segments language-segments" role="radiogroup" aria-label={t('language.title')}>
            <label><input type="radio" name="app-locale" value="en" checked={locale === 'en'} onChange={() => setLocale('en')} /><span>{t('language.english')}</span></label>
            <label><input type="radio" name="app-locale" value="ja" checked={locale === 'ja'} onChange={() => setLocale('ja')} /><span>{t('language.japanese')}</span></label>
          </div></fieldset>

          <details className="settings-subsection"><summary>{t('settings.markerCategories')} <span>{props.showFacilities ? t('settings.categoriesEnabled', { enabled: props.enabledFacilityCategories.size, total: props.facilityCategories.length }) : t('settings.markersHidden')}</span></summary><div className="settings-subsection-body">
            <div className="settings-inline-actions"><button type="button" disabled={!props.showFacilities} onClick={props.showAllFacilityCategories}>{t('settings.showAll')}</button><button type="button" disabled={!props.showFacilities || props.enabledFacilityCategories.size === 0} onClick={props.clearAllFacilityCategories}>{t('settings.clearAll')}</button><button type="button" disabled={!props.showFacilities} onClick={props.resetFacilityCategories}>{t('settings.resetDefaults')}</button></div>
            <div className="facility-category-grid" role="group" aria-label={t('settings.markerCategories')}>{props.facilityCategories.map((category) => <label key={category.code}><input type="checkbox" checked={props.enabledFacilityCategories.has(category.code)} disabled={!props.showFacilities} onChange={() => props.toggleFacilityCategory(category.code)} /><span>{category.label}<small>{category.count}</small></span></label>)}</div>
          </div></details>

          <details className="settings-subsection"><summary>{t('settings.visibleFloors')} <span>{publicVisibleCount === props.floorIds.length ? t('settings.allFloorCount', { count: props.floorIds.length }) : t('settings.someFloorCount', { visible: publicVisibleCount, total: props.floorIds.length })}</span></summary><div className="settings-subsection-body facility-category-grid" role="group" aria-label={t('settings.customFloors')}>{[...props.floorIds].reverse().map((floorId) => <label key={floorId}><input type="checkbox" checked={props.visibleFloors.includes(floorId)} onChange={() => props.toggleCustomFloor(floorId)} /><span>{floorId === '0' ? 'G' : floorId}</span></label>)}</div></details>

          <fieldset><legend>{t('settings.viewInteraction')}</legend><label className="settings-row"><input type="checkbox" checked={props.rotationEnabled} onChange={(event) => props.setRotationEnabled(event.target.checked)} /> {t('settings.freeRotation')}</label></fieldset>

          <details className="settings-subsection"><summary>{t('settings.developerDiagnostics')}</summary><div className="settings-subsection-body">
            <label className="settings-row"><input type="checkbox" checked={props.debug} onChange={(event) => props.setDebug(event.target.checked)} /> {t('settings.debugMode')}</label>
            {props.debug && <><label className="settings-row"><input type="checkbox" checked={props.showAllSourceLinks} onChange={(event) => props.setShowAllSourceLinks(event.target.checked)} /> {t('settings.allSourceLinks')}</label><label className="settings-row"><input type="checkbox" checked={props.showTwsi} onChange={(event) => props.setShowTwsi(event.target.checked)} /> {t('settings.twsi')}</label><label className="settings-row"><input type="checkbox" checked={props.showOfficialNodes} onChange={(event) => props.setShowOfficialNodes(event.target.checked)} /> {t('settings.nodeIds')}</label></>}
          </div></details>
      </div>
    </div>, document.body)}
  </>;
}
