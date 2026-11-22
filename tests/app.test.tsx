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
    expect(screen.getByRole('link', { name: 'MLIT dataset terms' })).toHaveAttribute('href', 'https://www.geospatial.jp/ckan/dataset/ecabe2e2-21a9-4a72-8dee-0b34e2c34fb6/resource/e3b28fde-5546-4c9d-956b-69363d707835/download/.pdf');
    expect(screen.getByRole('link', { name: 'GSI Optimized Vector Tiles' })).toHaveAttribute('href', 'https://github.com/gsi-cyberjapan/optimal_bvmap');
    expect(screen.getByText(/adapted by this project/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'GSI terms' })).toHaveAttribute('href', 'https://www.gsi.go.jp/kikakuchousei/kikakuchousei40182.html');
    expect(screen.getByLabelText('Shinjuku multi-floor indoor map')).toBeInTheDocument();
    expect(screen.getByText(/Loading map renderer/i)).toBeInTheDocument();
  });
});
