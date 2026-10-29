import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MapLegend } from '../src/components/MapLegend';
import type { MapLegendItem } from '../src/map/mapLegend';

const items: MapLegendItem[] = [
  { id: 'restricted', section: 'spaces', label: 'Restricted / non-public', kind: 'surface', color: '#4c1d3d', emphasis: 'restricted' },
  { id: 'route', section: 'route', label: 'Same-floor route', kind: 'route', color: '#fb923c' },
];

describe('map legend disclosure', () => {
  it('starts collapsed and toggles labeled groups through a native summary', () => {
    render(<MapLegend items={items} />);
    expect(screen.getByRole('region', { name: 'Visible map layers' })).not.toBeVisible();
    const toggle = screen.getByLabelText('Expand map legend');
    expect(toggle.tagName).toBe('SUMMARY');
    fireEvent.click(toggle);
    expect(screen.getByRole('region', { name: 'Spaces legend' })).toHaveTextContent('Restricted / non-public');
    expect(within(screen.getByLabelText('Visible map layers')).getByText('Same-floor route')).toBeVisible();
    fireEvent.click(screen.getByLabelText('Collapse map legend'));
    expect(screen.getByRole('region', { name: 'Visible map layers' })).not.toBeVisible();
  });
});
