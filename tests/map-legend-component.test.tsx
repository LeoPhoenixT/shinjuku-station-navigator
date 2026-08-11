import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MapLegend } from '../src/components/MapLegend';
import type { MapLegendItem } from '../src/map/mapLegend';

const items: MapLegendItem[] = [
  { id: 'restricted', section: 'spaces', label: 'Restricted / non-public', kind: 'surface', color: '#4c1d3d', emphasis: 'restricted' },
  { id: 'route', section: 'route', label: 'Same-floor route', kind: 'route', color: '#fb923c' },
];

describe('map legend disclosure', () => {
  it('starts collapsed on desktop with a compact route key and exposes groups on demand', () => {
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn().mockReturnValue({ matches: false }) });
    render(<MapLegend items={items} />);
    expect(screen.getByRole('region', { name: 'Visible map layers' })).not.toBeVisible();
    fireEvent.click(screen.getByLabelText('Expand map legend'));
    expect(screen.getByRole('region', { name: 'Spaces legend' })).toHaveTextContent('Restricted / non-public');
  });

  it('starts collapsed on narrow screens and is keyboard-native through summary', () => {
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn().mockReturnValue({ matches: true }) });
    render(<MapLegend items={items} />);
    const toggle = screen.getByLabelText('Expand map legend');
    expect(toggle.tagName).toBe('SUMMARY');
    fireEvent.click(toggle);
    expect(within(screen.getByLabelText('Visible map layers')).getByText('Same-floor route')).toBeVisible();
  });
});
