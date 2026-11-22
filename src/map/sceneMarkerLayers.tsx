import { Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react';
import type { NamedPlaceRecord } from '../schema/processed.js';
import type { PlaceTranslationsDataset } from '../schema/placeTranslations.js';
import { useI18n } from '../i18n/context.js';
import { formatIndoorMapCategory } from '../i18n/formatters.js';
import { floorLongName, publicAreaName, publicPlaceName } from '../places/placePresentation.js';
import { facilityMarkerMatchesPreferences, GATE_BADGE_COLOR, GATE_BADGE_SYMBOL, placeMarkerDetail } from './displayPreferences.js';
import { routablePlaceForFacility, selectVisibleFacilityMarkers, type FacilityMarkerCandidate } from './facilityMarkers.js';
import { displayElevation } from './stackedElevation.js';

type RouteAction = (place: NamedPlaceRecord, target: 'start' | 'destination') => void;

export function FacilityMarkerLayer({ candidates, floors, stacked, places, translations, enabledCategories, onRouteAction }: { candidates: FacilityMarkerCandidate[]; floors: string[]; stacked: boolean; places: NamedPlaceRecord[]; translations?: PlaceTranslationsDataset; enabledCategories: ReadonlySet<string>; onRouteAction: RouteAction }) {
  const { locale, t } = useI18n();
  const camera = useThree((state) => state.camera);
  const initialZoom = 'zoom' in camera && typeof camera.zoom === 'number' ? camera.zoom : 1;
  const zoomRef = useRef(initialZoom);
  const [zoom, setZoom] = useState(initialZoom);
  const [selectedId, setSelectedId] = useState<string>();
  useFrame(() => {
    const nextZoom = 'zoom' in camera && typeof camera.zoom === 'number' ? Math.round(camera.zoom * 4) / 4 : 1;
    if (zoomRef.current !== nextZoom) {
      zoomRef.current = nextZoom;
      setZoom(nextZoom);
    }
  });
  const visible = useMemo(() => selectVisibleFacilityMarkers(candidates.filter((marker) => facilityMarkerMatchesPreferences(marker, enabledCategories)), floors, zoom), [candidates, enabledCategories, floors, zoom]);
  useEffect(() => {
    if (selectedId && !visible.some(({ id }) => id === selectedId)) setSelectedId(undefined);
  }, [selectedId, visible]);
  useEffect(() => {
    if (!selectedId) return;
    const dismiss = (event: PointerEvent) => {
      const owner = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-popup-owner]') : null;
      if (owner?.dataset.popupOwner !== selectedId) setSelectedId(undefined);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [selectedId]);
  return <>{visible.map((marker) => {
    const selected = marker.id === selectedId;
    const floorName = floorLongName(marker.floorId, locale);
    const categoryName = formatIndoorMapCategory('Facility', marker.categoryCode, locale);
    const place = routablePlaceForFacility(marker, places);
    const label = place ? publicPlaceName(place, locale, translations) : categoryName;
    const area = marker.sourceFacility ? publicAreaName(marker.sourceFacility, locale, translations) : t('place.unknownArea');
    const accessibleLabel = t('place.markerLabel', { label, floor: floorName, area });
    return <group key={marker.id} position={[marker.coordinates[0], displayElevation(marker.coordinates[1], stacked) + 2.35, marker.coordinates[2]]}>
      <Html center zIndexRange={[3, 0]} wrapperClass={selected ? 'map-html-layer map-popup-layer' : 'map-html-layer'}>
        <div className="source-facility-marker-wrap" data-popup-owner={marker.id}>
          <button type="button" className={`source-facility-marker source-facility-priority-${marker.priority}`} aria-label={accessibleLabel} aria-pressed={selected} title={accessibleLabel} onClick={() => setSelectedId(selected ? undefined : marker.id)}>{marker.icon}</button>
          {selected && <div className="source-facility-detail"><strong>{label}</strong><span>{floorName} · {area}</span>{place ? <span className="facility-route-actions"><button type="button" onClick={() => { onRouteAction(place, 'start'); setSelectedId(undefined); }}>{t('place.setStart')}</button><button type="button" onClick={() => { onRouteAction(place, 'destination'); setSelectedId(undefined); }}>{t('place.routeHere')}</button></span> : <span>{t('place.routingUnsupported')}</span>}</div>}
        </div>
      </Html>
    </group>;
  })}</>;
}

const GATE_DETAIL_ZOOM_MULTIPLIER = 1.7;
const PLACE_MARKER_OFFSET = 3.55;

export function PlaceLayer({ places, translations, startId, destinationId, debug, stacked, showGates, detailedGateFloors, fittedZoomRef, onRouteAction }: { places: NamedPlaceRecord[]; translations?: PlaceTranslationsDataset; startId: string; destinationId: string; debug: boolean; stacked: boolean; showGates: boolean; detailedGateFloors: string[]; fittedZoomRef: RefObject<number>; onRouteAction: RouteAction }) {
  const { locale, t } = useI18n();
  const camera = useThree((state) => state.camera);
  const container = useThree(({ gl }) => gl.domElement.parentElement);
  const portal = container ? { current: container } : undefined;
  const [zoomedIn, setZoomedIn] = useState(false);
  useFrame(() => {
    const next = camera.zoom >= fittedZoomRef.current * GATE_DETAIL_ZOOM_MULTIPLIER;
    if (zoomedIn !== next) setZoomedIn(next);
  });
  const [selectedId, setSelectedId] = useState<string>();
  const markers = useMemo(() => places.flatMap((place) => {
    if (!debug && !place.routable) return [];
    const emphasized = detailedGateFloors.includes(place.floorId);
    const showGateNames = debug || (zoomedIn && emphasized);
    const detail = placeMarkerDetail(place, startId, destinationId, showGates, showGateNames);
    return detail ? [{ place, detail, emphasized }] : [];
  }), [debug, destinationId, detailedGateFloors, places, showGates, startId, zoomedIn]);
  useEffect(() => {
    if (!selectedId) return;
    const dismiss = (event: PointerEvent) => {
      const owner = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-popup-owner]') : null;
      if (owner?.dataset.popupOwner !== selectedId) setSelectedId(undefined);
    };
    document.addEventListener('pointerdown', dismiss);
    return () => document.removeEventListener('pointerdown', dismiss);
  }, [selectedId]);
  return <>
    {markers.map(({ place, detail, emphasized }) => {
      const badge = detail === 'icon';
      const start = place.id === startId;
      const destination = place.id === destinationId;
      const selected = place.id === selectedId;
      const color = start ? '#22c55e' : destination ? '#ef4444' : place.routable ? '#a78bfa' : '#f59e0b';
      const name = publicPlaceName(place, locale, translations);
      const area = publicAreaName(place.sourceFacility, locale, translations);
      const floorName = floorLongName(place.floorId, locale);
      return <group key={place.id} position={[place.coordinates[0], displayElevation(place.coordinates[1], stacked) + PLACE_MARKER_OFFSET, place.coordinates[2]]}>
        {!badge && <mesh><sphereGeometry args={[start || destination ? 1.2 : 0.72, 12, 12]} /><meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} /></mesh>}
        {(start || destination) && <mesh rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[1.45, 1.8, 24]} /><meshBasicMaterial color={color} /></mesh>}
        <Html portal={portal} position={[start ? -2.5 : destination ? 2.5 : 0, 1.55, 0]} center zIndexRange={badge ? [1, 0] : [4, 0]} wrapperClass={selected ? 'map-html-layer map-popup-layer' : 'map-html-layer'}><div className="place-label-wrap" data-popup-owner={place.id} data-floor-id={place.floorId}>
          {badge ? (
            <button type="button" className={`source-facility-marker gate-badge${emphasized ? '' : ' gate-badge-context'}`} style={{ '--facility-marker-border': GATE_BADGE_COLOR } as CSSProperties} aria-label={t('place.markerLabel', { label: name, floor: floorName, area })} aria-pressed={selected} title={name} onClick={() => setSelectedId(selected ? undefined : place.id)}>{GATE_BADGE_SYMBOL}</button>
          ) : (
            <button type="button" className={`place-label ${start ? 'place-label-start' : destination ? 'place-label-destination' : ''} ${place.routable ? '' : 'place-label-warning'}`} aria-pressed={selected} title={t('place.title', { name, area, distance: place.access.distanceMeters.toFixed(1) })} onClick={() => setSelectedId(selected ? undefined : place.id)}>{start ? `A · ${name}` : destination ? `B · ${name}` : name}</button>
          )}
          {selected && <div className="source-facility-detail place-label-detail"><strong>{name}</strong><span>{floorName} · {area}</span>{debug && <span title={place.id}>{place.name} · {place.sourceFacility}</span>}<span className="facility-route-actions"><button type="button" onClick={() => { onRouteAction(place, 'start'); setSelectedId(undefined); }}>{t('place.setStart')}</button><button type="button" onClick={() => { onRouteAction(place, 'destination'); setSelectedId(undefined); }}>{t('place.routeHere')}</button></span></div>}
        </div></Html>
      </group>;
    })}
  </>;
}
