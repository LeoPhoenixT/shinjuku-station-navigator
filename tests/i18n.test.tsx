import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LocaleProvider } from '../src/i18n/LocaleProvider';
import { DEFAULT_LOCALE, LOCALE_STORAGE_KEY } from '../src/i18n/config';
import { useI18n } from '../src/i18n/context';
import { isLocale, translate } from '../src/i18n/types';
import { en } from '../src/i18n/catalogs/en';
import { ja } from '../src/i18n/catalogs/ja';
import { formatFloorChanges, formatRouteInstruction, formatRouteWarning } from '../src/i18n/formatters';
import { floorDisplayName } from '../src/places/placePresentation';
import type { RouteStep } from '../src/routing/routeInstructions';
import type { NamedPlaceRecord } from '../src/schema/processed';

function LocaleHarness() {
  const { locale, setLocale, t } = useI18n();
  return <>
    <output aria-label="active locale">{locale}</output>
    <span>{t('route.summary', { start: 'A', destination: 'B', time: '1 min', distance: 12 })}</span>
    <button type="button" onClick={() => setLocale('ja')}>日本語</button>
  </>;
}

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

beforeEach(() => {
  Object.defineProperty(window, 'localStorage', { configurable: true, value: memoryStorage() });
});

afterEach(() => {
  localStorage.removeItem(LOCALE_STORAGE_KEY);
  document.documentElement.lang = 'en';
});

describe('Phase 1 internationalization', () => {
  it('keeps English and Japanese catalog keys aligned', () => {
    expect(Object.keys(ja).sort()).toEqual(Object.keys(en).sort());
  });

  it('supports only the declared locales and defaults invalid stored values to English', () => {
    expect(isLocale('en')).toBe(true);
    expect(isLocale('ja')).toBe(true);
    expect(isLocale('fr')).toBe(false);
    localStorage.setItem(LOCALE_STORAGE_KEY, 'fr');

    render(<LocaleProvider><LocaleHarness /></LocaleProvider>);

    expect(screen.getByLabelText('active locale')).toHaveTextContent(DEFAULT_LOCALE);
    expect(document.documentElement.lang).toBe('en');
  });

  it('interpolates typed messages and switches the document language immediately', () => {
    render(<LocaleProvider initialLocale="en"><LocaleHarness /></LocaleProvider>);
    expect(screen.getByText('A → B · 1 min · 12 m')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '日本語' }));

    expect(screen.getByLabelText('active locale')).toHaveTextContent('ja');
    expect(screen.getByText('A → B・1 min・12 m')).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('ja');
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('ja');
  });

  it('restores the persisted locale in a new provider instance', () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'ja');
    render(<LocaleProvider><LocaleHarness /></LocaleProvider>);

    expect(screen.getByLabelText('active locale')).toHaveTextContent('ja');
    expect(translate('ja', 'planner.actions.show')).toBe('経路を表示');
  });

  it('formats floors, counts, every route step, and every warning in both locales', () => {
    const start: NamedPlaceRecord = {
      id: 'start', sourceId: 'start', sourceFacility: 'JR', sourceFile: 'fixture', sourceRecord: 1,
      name: '中央改札', category: 'gate', floorId: 'B1', coordinates: [0, 0, 0], routable: true,
      access: { nodeId: 'a', distanceMeters: 1, confidence: 'high', reviewStatus: 'reviewed', accessibility: 'unknown', componentId: 0, geometry: [[0, 0, 0], [1, 0, 0]] },
    };
    const destination = { ...start, id: 'destination', name: '東口', floorId: '0' };
    const steps: RouteStep[] = [
      { kind: 'access', distanceMeters: 1, floorFrom: 'B1', floorTo: 'B1', edgeIds: [] },
      { kind: 'continue', distanceMeters: 12, floorFrom: 'B1', floorTo: 'B1', edgeIds: ['one'] },
      { kind: 'turn-left', distanceMeters: 8, floorFrom: 'B1', floorTo: 'B1', edgeIds: ['two'] },
      { kind: 'turn-right', distanceMeters: 9, floorFrom: 'B1', floorTo: 'B1', edgeIds: ['three'] },
      { kind: 'transition', distanceMeters: 4, floorFrom: 'B1', floorTo: '0', movement: 'elevator', edgeIds: ['four'] },
      { kind: 'arrive', distanceMeters: 2, floorFrom: '0', floorTo: '0', edgeIds: [] },
    ];

    for (const locale of ['en', 'ja'] as const) {
      for (const step of steps) {
        const message = formatRouteInstruction(step, start, destination, locale);
        expect(message.length).toBeGreaterThan(5);
        expect(message).not.toMatch(/\{[a-z]+\}/i);
      }
      expect(formatRouteWarning({ code: 'accessibility-fields-unknown', fields: ['width'] }, [start, destination], locale)).toContain('width');
      expect(formatRouteWarning({ code: 'accessibility-access-unverified', placeIds: ['start'] }, [start, destination], locale)).toContain('中央改札');
    }

    expect(floorDisplayName('B1', 'en')).toBe('B1');
    expect(floorDisplayName('B1', 'ja')).toBe('地下1階');
    expect(formatFloorChanges(1, 'en')).toBe('1 floor change');
    expect(formatFloorChanges(2, 'en')).toBe('2 floor changes');
    expect(formatFloorChanges(2, 'ja')).toBe('階の移動 2回');
    expect(translate('en', 'route.status.chooseEndpoints')).toContain('Choose');
    expect(translate('ja', 'route.status.chooseEndpoints')).toContain('選択');
    expect(translate('en', 'app.dataLoadFailure', { message: 'fixture' })).toContain('fixture');
    expect(translate('ja', 'app.dataLoadFailure', { message: 'fixture' })).toContain('fixture');
  });
});
