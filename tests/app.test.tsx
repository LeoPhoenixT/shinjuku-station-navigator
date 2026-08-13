import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/app/App';

vi.mock('@react-three/fiber', () => ({
  Canvas: () => <div data-testid="mock-canvas" />,
}));

vi.mock('@react-three/drei', () => ({
  OrbitControls: () => <div data-testid="mock-orbit-controls" />,
}));

describe('App', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(() => new Promise(() => undefined)));
  });

  it('renders the compact map-first shell and floor viewer loading state', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Shinjuku Station Navigator' })).toBeInTheDocument();
    expect(screen.queryByText('About & data')).not.toBeInTheDocument();
    expect(screen.queryByText(/search named places, route across/i)).not.toBeInTheDocument();
    expect(screen.getByText(/modified for this application/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Shinjuku Station Area Indoor Map Open Data/ })).toHaveAttribute('href', 'https://www.geospatial.jp/ckan/dataset/mlit-indoor-shinjuku-r2');
    expect(screen.getByRole('link', { name: 'Government Standard Terms of Use (Version 2.0)' })).toHaveAttribute('href', expect.stringContaining('20220706_resources_data_betten_01.pdf'));
    expect(screen.getByLabelText('Shinjuku multi-floor indoor map')).toBeInTheDocument();
    expect(screen.getByText(/Loading map renderer/i)).toBeInTheDocument();
  });
});
