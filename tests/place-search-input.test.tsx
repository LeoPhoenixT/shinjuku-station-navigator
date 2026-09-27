import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PlaceSearchInput } from '../src/components/PlaceSearchInput';
import { buildPlaceSearchIndex, placeDisplayName } from '../src/features/route-planner/placeSearch';
import { places } from './fixtures/places';

const searchIndex = buildPlaceSearchIndex(places);

function renderSearch(kind: 'start' | 'destination' = 'start') {
  const onChange = vi.fn();
  render(<PlaceSearchInput kind={kind} searchIndex={searchIndex} value="start" onChange={onChange} />);
  return { onChange, input: screen.getByRole('combobox') };
}

describe('place search input', () => {
  it('selects an option from the keyboard and preserves combobox relationships', () => {
    const { input, onChange } = renderSearch();
    fireEvent.focus(input);
    const listbox = screen.getByRole('listbox');
    expect(input).toHaveAttribute('aria-controls', listbox.id);
    expect(input).toHaveAttribute('aria-activedescendant', `${listbox.id}-0`);
    fireEvent.change(input, { target: { value: 'End gate' } });
    expect(screen.getByRole('option', { name: /End gate/i })).toBeInTheDocument();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onChange).toHaveBeenCalledWith('end');
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  it('groups results and clears the selected endpoint for an empty query', () => {
    const { input, onChange } = renderSearch();
    fireEvent.focus(input);
    expect(screen.getByRole('group', { name: 'Floor B2 · Metro east area · Gate' })).toBeInTheDocument();
    fireEvent.change(input, { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith('');
    expect(within(screen.getByRole('listbox')).getAllByRole('option')).toHaveLength(4);
  });

  it('discards an unfinished query when focus leaves the search', () => {
    const { input, onChange } = renderSearch();
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'unknown destination' } });
    expect(input).toHaveValue('unknown destination');
    fireEvent.blur(input, { relatedTarget: document.body });
    expect(input).toHaveValue(placeDisplayName(places[0]));
    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('syncs the displayed name when the selected endpoint changes externally', () => {
    const onChange = vi.fn();
    const view = render(<PlaceSearchInput kind="start" searchIndex={searchIndex} value="start" onChange={onChange} />);
    const input = screen.getByRole('combobox');
    expect(input).toHaveValue(placeDisplayName(places[0]));
    view.rerender(<PlaceSearchInput kind="start" searchIndex={searchIndex} value="end" onChange={onChange} />);
    expect(input).toHaveValue(placeDisplayName(places[1]));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('uses category shortcuts and keeps them available while focus moves inside the search', () => {
    const { input } = renderSearch('destination');
    fireEvent.focus(input);
    const categories = screen.getByRole('group', { name: 'Destination categories' });
    const toilets = within(categories).getByRole('button', { name: 'Toilets' });
    fireEvent.blur(input, { relatedTarget: toilets });
    fireEvent.focus(toilets);
    expect(categories).toBeInTheDocument();
    fireEvent.click(toilets);
    expect(toilets).toHaveAttribute('aria-pressed', 'true');
    expect(within(screen.getByRole('listbox')).getAllByRole('option')).toHaveLength(1);
    expect(screen.getByRole('option')).toHaveTextContent('East toilet');
    fireEvent.keyDown(toilets, { key: 'Escape' });
    expect(screen.queryByRole('group', { name: 'Destination categories' })).not.toBeInTheDocument();
    expect(input).toHaveFocus();
    fireEvent.focus(input);
    fireEvent.blur(input, { relatedTarget: document.body });
    expect(screen.queryByRole('group', { name: 'Destination categories' })).not.toBeInTheDocument();
  });
});
