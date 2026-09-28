import { useEffect, useId, useMemo, useRef, useState, type ChangeEvent, type FocusEvent, type KeyboardEvent } from 'react';
import { buildPlaceIdIndex, groupPlacesByFloorArea, placeDisplayName, type PlaceSearchIndex } from '../features/route-planner/placeSearch.js';
import { categoryDisplayName, floorLongName, placeSecondaryText, publicPlaceName } from '../places/placePresentation.js';
import type { NamedPlaceRecord } from '../schema/processed.js';
import type { PlaceTranslationsDataset } from '../schema/placeTranslations.js';
import { useI18n } from '../i18n/context.js';

interface PlaceSearchInputProps {
  readonly kind: 'start' | 'destination';
  readonly searchIndex: PlaceSearchIndex;
  readonly translations?: PlaceTranslationsDataset;
  readonly value: string;
  readonly onChange: (id: string) => void;
}

export function PlaceSearchInput({ kind, searchIndex, translations, value, onChange }: PlaceSearchInputProps) {
  const { locale, t } = useI18n();
  const label = t(kind === 'start' ? 'planner.start' : 'planner.destination');
  const searchLabel = locale === 'en' ? label.toLocaleLowerCase('en') : label;
  const listId = useId();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const selected = searchIndex.findById(value);
  const [query, setQuery] = useState(selected ? placeDisplayName(selected, locale, translations) : value);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [category, setCategory] = useState<NamedPlaceRecord['category'] | 'all'>('all');
  const selectedText = selected ? placeDisplayName(selected, locale, translations) : value;
  const searchTerm = open && query === selectedText ? '' : query;
  const allResults = useMemo(
    () => searchIndex.search(searchTerm, locale).filter((place) => category === 'all' || place.category === category),
    [category, locale, searchIndex, searchTerm],
  );
  const visibleResults = useMemo(() => allResults.slice(0, 100), [allResults]);
  const groups = useMemo(() => groupPlacesByFloorArea(visibleResults, locale, translations), [locale, translations, visibleResults]);
  const matches = useMemo(() => groups.flatMap((group) => group.places), [groups]);
  const matchIndexById = useMemo(() => buildPlaceIdIndex(matches), [matches]);

  useEffect(() => setQuery(selected ? placeDisplayName(selected, locale, translations) : value), [locale, selected, translations, value]);

  const close = () => {
    setOpen(false);
    setQuery(selectedText);
  };
  const choose = (place: NamedPlaceRecord) => {
    onChange(place.id);
    setQuery(placeDisplayName(place, locale, translations));
    setOpen(false);
  };
  const handleQueryChange = (event: ChangeEvent<HTMLInputElement>) => {
    const next = event.target.value;
    setQuery(next);
    setOpen(true);
    setActiveIndex(0);
    if (next.length === 0) onChange('');
    const exact = searchIndex.findByDisplayName(next, locale);
    if (exact) onChange(exact.id);
  };
  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget)) return;
    close();
  };
  const handleContainerKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape') return;
    inputRef.current?.focus();
    close();
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => Math.min(index + 1, Math.max(0, matches.length - 1)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((index) => Math.max(0, index - 1));
    } else if (event.key === 'Enter' && open && matches[activeIndex]) {
      event.preventDefault();
      choose(matches[activeIndex]);
    }
  };

  const categoryShortcuts = ([
    ['gate', t('search.gates')], ['exit', t('search.exits')], ['toilet', t('search.toilets')], ['elevator', t('search.elevators')], ['locker', t('search.lockers')],
  ] as const).filter(([candidate]) => searchIndex.categories.includes(candidate));

  return <div className="place-search" onBlur={handleBlur} onKeyDown={handleContainerKeyDown}><label htmlFor={inputId}>{label}</label>
    <input
      ref={inputRef}
      id={inputId}
      type="search"
      role="combobox"
      aria-label={t('search.inputLabel', { label: searchLabel })}
      aria-autocomplete="list"
      aria-controls={listId}
      aria-expanded={open}
      aria-activedescendant={open && matches[activeIndex] ? `${listId}-${activeIndex}` : undefined}
      value={query}
      placeholder={t('search.placeholder')}
      onFocus={() => setOpen(true)}
      onKeyDown={handleKeyDown}
      onChange={handleQueryChange}
      autoComplete="off"
    />
    {open && categoryShortcuts.length > 1 && <div className="place-shortcuts" role="group" aria-label={t('search.categories', { label })}>
      <button type="button" aria-pressed={category === 'all'} onMouseDown={(event) => event.preventDefault()} onClick={() => { setCategory('all'); setActiveIndex(0); }}>{t('search.all')}</button>
      {categoryShortcuts.map(([candidate, text]) => <button type="button" key={candidate} aria-pressed={category === candidate} onMouseDown={(event) => event.preventDefault()} onClick={() => { setCategory(candidate); setActiveIndex(0); }}>{text}</button>)}
    </div>}
    {open && matches.length > 0 && <ul className="place-options" id={listId} role="listbox">
      {allResults.length > visibleResults.length && <li className="place-option-limit" role="status">{t('search.limit', { count: allResults.length })}</li>}
      {groups.map((group) => {
        const floor = floorLongName(group.floorId, locale);
        const categoryName = categoryDisplayName(group.category, locale);
        return <li className="place-option-group" key={`${group.floorId}:${group.areaId}:${group.category}`} role="group" aria-label={t('search.group', { floor, area: group.area, category: categoryName })}>
        <div className="place-option-heading"><strong>{floor}</strong><span>{group.area} · {categoryName}</span></div>
        {group.places.map((place) => {
          const index = matchIndexById.indexOf(place.id)!;
          return <div
            className="place-option"
            id={`${listId}-${index}`}
            key={place.id}
            role="option"
            aria-selected={index === activeIndex}
            onMouseDown={(event) => { event.preventDefault(); choose(place); }}
          ><strong>{publicPlaceName(place, locale, translations)}</strong><span>{placeSecondaryText(place, locale, translations)}</span></div>;
        })}
      </li>;
      })}
    </ul>}
  </div>;
}
