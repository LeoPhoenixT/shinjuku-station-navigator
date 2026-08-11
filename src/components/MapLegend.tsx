import { useState, type CSSProperties } from 'react';
import { groupMapLegendItems, type MapLegendItem } from '../map/mapLegend.js';
import { useI18n } from '../i18n/context.js';

export function MapLegend({ items, open: controlledOpen, onOpenChange }: { items: MapLegendItem[]; open?: boolean; onOpenChange?: (open: boolean) => void }) {
  const { t } = useI18n();
  const [localOpen, setLocalOpen] = useState(false);
  const open = controlledOpen ?? localOpen;
  const setOpen = (next: boolean) => controlledOpen === undefined ? setLocalOpen(next) : onOpenChange?.(next);
  const groups = groupMapLegendItems(items);
  const routeKey = groups.find((group) => group.section === 'route')?.items.slice(0, 4) ?? [];
  return <details className="map-legend" open={open}>
    <summary aria-label={t(open ? 'legend.collapse' : 'legend.expand')} onClick={(event) => { event.preventDefault(); setOpen(!open); }}>
      <span>{t('legend.title')}</span>
      {!open && routeKey.length > 0 && <span className="legend-route-key" aria-hidden="true">{routeKey.map((item) => <i key={item.id} className={`legend-swatch legend-swatch-${item.kind}${item.emphasis ? ` legend-swatch-${item.emphasis}` : ''}`} style={{ '--legend-color': item.color } as CSSProperties}>{item.symbol}</i>)}</span>}
      <span aria-hidden="true">{open ? '−' : '+'}</span>
    </summary>
    <div className="map-legend-panel" role="region" aria-label={t('legend.visibleLayers')}>
      {groups.map((group) => {
        const section = t(`legend.section.${group.section}`);
        return <section key={group.section} aria-label={t('legend.group', { section })}>
        <h2>{section}</h2>
        <ul>{group.items.map((item) => <li key={item.id}>
          <i
            aria-hidden="true"
            className={`legend-swatch legend-swatch-${item.kind}${item.emphasis ? ` legend-swatch-${item.emphasis}` : ''}`}
            style={{ '--legend-color': item.color } as CSSProperties}
          >{item.symbol}</i>
          <span>{item.label}</span>
        </li>)}</ul>
      </section>;
      })}
    </div>
  </details>;
}
