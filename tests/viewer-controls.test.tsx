import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ViewerControls } from '../src/components/ViewerControls';
import { placeDisplayName } from '../src/features/route-planner/placeSearch';
import { LocaleProvider } from '../src/i18n/LocaleProvider';
import type { NamedPlaceRecord } from '../src/schema/processed';

const places: NamedPlaceRecord[] = [
  { id: 'start', sourceId: 's', sourceFacility: 'JR', sourceFile: 'a', sourceRecord: 1, name: 'Start gate', category: 'gate', floorId: 'B1', coordinates: [0, 0, 0], routable: true, access: { nodeId: 'n1', distanceMeters: 1, confidence: 'high', reviewStatus: 'automatic', accessibility: 'unknown', componentId: 0, geometry: [[0, 0, 0], [1, 0, 0]] } },
  { id: 'end', sourceId: 'e', sourceFacility: 'JR', sourceFile: 'b', sourceRecord: 2, name: 'End gate', category: 'gate', floorId: 'B1', coordinates: [2, 0, 0], routable: true, access: { nodeId: 'n2', distanceMeters: 1, confidence: 'high', reviewStatus: 'automatic', accessibility: 'unknown', componentId: 0, geometry: [[2, 0, 0], [1, 0, 0]] } },
  { id: 'metro', sourceId: 'm', sourceFacility: 'Metro east area', sourceFile: 'c', sourceRecord: 3, name: 'Metro gate', category: 'gate', floorId: 'B2', coordinates: [4, -10, 0], routable: true, access: { nodeId: 'n3', distanceMeters: 1, confidence: 'high', reviewStatus: 'automatic', accessibility: 'unknown', componentId: 0, geometry: [[4, -10, 0], [3, -10, 0]] } },
  { id: 'toilet', sourceId: 't', sourceFacility: 'JR', sourceFile: 'd', sourceRecord: 4, name: 'East toilet', category: 'toilet', floorId: 'B1', coordinates: [5, 0, 0], routable: true, access: { nodeId: 'n4', distanceMeters: 1, confidence: 'high', reviewStatus: 'reviewed', accessibility: 'yes', componentId: 0, geometry: [[5, 0, 0], [4, 0, 0]] } },
];

const outsideRoute = { status: 'outside-coverage' as const, start: places[0], destination: places[1], reason: 'different-components-in-bounded-extraction' as const };
const okRoute = { status: 'ok' as const, start: places[0], destination: places[1], profile: 'accessible' as const, warnings: [{ code: 'accessibility-fields-unknown' as const, fields: ['width'] }], steps: [{ kind: 'continue' as const, distanceMeters: 2, floorFrom: 'B1', floorTo: 'B1', edgeIds: ['e'] }], network: { nodeIds: ['n1', 'n2'], edgeIds: ['e'], distanceMeters: 2, totalCost: 2 }, accessDistanceMeters: 2, totalDistanceMeters: 4, legs: [] };

function renderProps(debug = false, overrides = {}) {
  return {
    debug, setDebug: vi.fn(), showAllSourceLinks: false, setShowAllSourceLinks: vi.fn(), places, startId: 'start', destinationId: 'end', setStartId: vi.fn(), setDestinationId: vi.fn(), swapPlaces: vi.fn(), clearRoute: vi.fn(),
    route: outsideRoute, profile: 'shortest' as const, setProfile: vi.fn(), routeDirty: false, submitRoute: vi.fn(),
    showOfficialNetwork: true, setShowOfficialNetwork: vi.fn(), showOfficialNodes: false, setShowOfficialNodes: vi.fn(),
    showTwsi: false, setShowTwsi: vi.fn(),
    showFacilities: true, setShowFacilities: vi.fn(), facilityCategories: [{ code: 'F001', label: 'Toilet', count: 2 }, { code: 'F012', label: 'Elevator', count: 1 }, { code: 'named-place:gate', label: 'Ticket gates', count: 3 }], enabledFacilityCategories: new Set(['F001', 'F012', 'named-place:gate']), toggleFacilityCategory: vi.fn(), showAllFacilityCategories: vi.fn(), clearAllFacilityCategories: vi.fn(), resetFacilityCategories: vi.fn(), showStructuralDetails: true, setShowStructuralDetails: vi.fn(),
    floorIds: ['B3', 'B2', 'B1', '0', '1', '2', '3', '4'], visibleFloors: ['B1'], routeFloorIds: [], activeFloor: 'B1', floorViewMode: 'focused' as const, selectFloor: vi.fn(), showStack: vi.fn(), showRouteFloors: vi.fn(), toggleCustomFloor: vi.fn(),
    rotationEnabled: false, setRotationEnabled: vi.fn(),
    fitRoute: vi.fn(), fitStation: vi.fn(), zoomIn: vi.fn(), zoomOut: vi.fn(), showNorthView: vi.fn(), showAngledView: vi.fn(), cameraHeading: 0,
    selectedStepIndex: undefined, onStepSelect: vi.fn(), legendItems: [], ...overrides,
  };
}

function renderControls(overrides = {}) {
  const props = renderProps(false, overrides);
  render(<ViewerControls {...props} />);
  return props;
}

describe('viewer controls', () => {
  it('exposes named route selectors and reports bounded coverage clearly', () => {
    const props = renderControls();
    fireEvent.change(screen.getByLabelText('Search destination place'), { target: { value: placeDisplayName(places[0]) } });
    expect(props.setDestinationId).toHaveBeenCalledWith('start');
    expect(screen.getByRole('alert')).toHaveTextContent('supported bounded coverage');
  });

  it('supports keyboard selection in the named-place combobox', () => {
    const props = renderControls();
    const startSearch = screen.getByLabelText('Search start place');
    fireEvent.focus(startSearch);
    fireEvent.change(startSearch, { target: { value: 'End gate' } });
    expect(screen.getByRole('option', { name: /End gate/i })).toBeInTheDocument();
    fireEvent.keyDown(startSearch, { key: 'Enter' });
    expect(props.setStartId).toHaveBeenCalledWith('end');
  });

  it('groups searchable places by floor, area, and category', () => {
    renderControls();
    fireEvent.focus(screen.getByLabelText('Search start place'));
    expect(screen.getByRole('group', { name: 'Floor B1 · JR · Gate' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Floor B2 · Metro east area · Gate' })).toBeInTheDocument();
  });

  it('clears an endpoint and shows every grouped option for an empty search', () => {
    const props = renderControls();
    const startSearch = screen.getByLabelText('Search start place');
    fireEvent.change(startSearch, { target: { value: '' } });
    expect(props.setStartId).toHaveBeenCalledWith('');
    expect(within(screen.getByRole('listbox')).getAllByRole('option')).toHaveLength(4);
    expect(screen.getByRole('group', { name: 'Floor B2 · Metro east area · Gate' })).toBeInTheDocument();
  });

  it('filters destination discovery through category shortcuts', () => {
    renderControls();
    fireEvent.focus(screen.getByLabelText('Search destination place'));
    fireEvent.click(within(screen.getByRole('group', { name: 'Destination categories' })).getByRole('button', { name: 'Toilets' }));
    const options = within(screen.getByRole('listbox')).getAllByRole('option');
    expect(options).toHaveLength(1);
    expect(options[0]).toHaveTextContent('East toilet');
  });

  it('clears both route endpoints from one action', () => {
    const props = renderControls();
    fireEvent.click(screen.getByRole('button', { name: 'Clear route' }));
    expect(props.clearRoute).toHaveBeenCalledOnce();
  });

  it('prompts for endpoints after a route is cleared', () => {
    renderControls({ startId: '', destinationId: '', route: { status: 'invalid-place', placeId: '', reason: 'not-found' } });
    expect(screen.getByRole('status')).toHaveTextContent('Choose a start and destination');
    expect(screen.getByRole('button', { name: 'Clear route' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Share route' })).toBeDisabled();
  });

  it('uses the compact planner shell when a narrow viewport has no route request', () => {
    const originalMatchMedia = window.matchMedia;
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn().mockReturnValue({ matches: true }) });
    renderControls({ startId: '', destinationId: '', route: { status: 'invalid-place', placeId: '', reason: 'not-found' } });
    expect(screen.getByRole('region', { name: 'Route planner' })).toHaveClass('planner-card-empty');
    expect(screen.getByRole('button', { name: 'Edit route' })).toBeVisible();
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: originalMatchMedia });
  });

  it('exposes the pedestrian network normally and keeps raw overlays in debug mode', () => {
    const { rerender } = render(<ViewerControls {...renderProps(false)} />);
    fireEvent.click(screen.getByLabelText('Map settings'));
    expect(screen.getByRole('group', { name: 'Display layers' })).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Walking network/i })).toBeInTheDocument();
    fireEvent.click(screen.getByText('Developer diagnostics'));
    rerender(<ViewerControls {...renderProps(true)} />);
    expect(screen.getByRole('checkbox', { name: /Walking network/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Node IDs')).toBeInTheDocument();
    expect(screen.getByLabelText('Tactile guidance (TWSI)')).toBeInTheDocument();
  });

  it('exposes rotation, camera, and zoom controls without a map-click mode', () => {
    const props = renderControls({ route: okRoute });
    fireEvent.click(screen.getByRole('button', { name: 'Edit route' }));
    expect(screen.queryByRole('group', { name: 'Map click selection' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Map settings'));
    expect(screen.getByRole('dialog', { name: 'Map display settings' }).closest('.camera-toolbar')).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Map display settings' }).parentElement).toHaveClass('settings-layer');
    fireEvent.click(screen.getByLabelText('Free rotation'));
    fireEvent.click(screen.getByRole('checkbox', { name: /Markers/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Building outlines/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Fit route' }));
    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }));
    fireEvent.click(screen.getByRole('button', { name: 'North-up view' }));
    expect(props.setRotationEnabled).toHaveBeenCalledWith(true);
    expect(props.setShowFacilities).toHaveBeenCalledWith(false);
    expect(props.setShowStructuralDetails).toHaveBeenCalledWith(false);
    expect(props.fitRoute).toHaveBeenCalledOnce();
    expect(props.zoomIn).toHaveBeenCalledOnce();
    expect(props.showNorthView).toHaveBeenCalledOnce();
    expect(screen.getByTitle('Map heading 0 degrees. Reset north-up.')).toBeInTheDocument();
  });

  it('emphasizes a floor without using the visibility control and can restore the complete stack', () => {
    const props = renderControls({ floorViewMode: 'stack', visibleFloors: ['B3', 'B2', 'B1', '0', '1', '2', '3', '4'] });
    expect(screen.getByRole('button', { name: 'Previous floors' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next floors' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'Emphasize Ground floor' }));
    fireEvent.click(screen.getByRole('button', { name: 'All floors' }));
    expect(props.selectFloor).toHaveBeenCalledWith('0');
    expect(props.toggleCustomFloor).not.toHaveBeenCalled();
    expect(props.showStack).toHaveBeenCalledOnce();
  });

  it('marks the focused floor in the top floor bar', () => {
    renderControls({ floorViewMode: 'focused', visibleFloors: ['B1', '0'], activeFloor: 'B1' });
    expect(screen.getByRole('radio', { name: 'Emphasize B1 floor' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Emphasize Ground floor' })).not.toBeChecked();
  });

  it('supports marker category and custom-floor preferences', () => {
    const props = renderControls();
    fireEvent.click(screen.getByLabelText('Map settings'));
    fireEvent.click(screen.getByText(/Marker categories/));
    fireEvent.click(screen.getByRole('checkbox', { name: /Toilet/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Ticket gates/ }));
    fireEvent.click(screen.getByText(/Visible floors/));
    fireEvent.click(within(screen.getByRole('group', { name: 'Custom visible floors' })).getByRole('checkbox', { name: 'G' }));
    expect(props.toggleFacilityCategory).toHaveBeenCalledWith('F001');
    expect(props.toggleFacilityCategory).toHaveBeenCalledWith('named-place:gate');
    expect(props.toggleCustomFloor).toHaveBeenCalledWith('0');
  });

  it('clears every enabled marker category at once', () => {
    const props = renderControls();
    fireEvent.click(screen.getByLabelText('Map settings'));
    fireEvent.click(screen.getByText(/Marker categories/));
    fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(props.clearAllFacilityCategories).toHaveBeenCalledOnce();
  });

  it('disables marker detail controls when markers are hidden', () => {
    renderControls({ showFacilities: false });
    fireEvent.click(screen.getByLabelText('Map settings'));
    fireEvent.click(screen.getByText(/Marker categories/));
    expect(within(screen.getByRole('group', { name: 'Marker categories' })).getByRole('checkbox', { name: /Toilet/ })).toBeDisabled();
  });

  it('shows only route floors when a route is available', () => {
    const unavailable = renderControls();
    expect(screen.getByRole('button', { name: 'Route floors' })).toBeDisabled();
    unavailable.showRouteFloors.mockClear();
  });

  it('activates the route-floor view for a valid route', () => {
    const props = renderControls({ route: okRoute });
    fireEvent.click(screen.getByRole('button', { name: 'Route floors' }));
    expect(props.showRouteFloors).toHaveBeenCalledOnce();
  });

  it('swaps places and selects every routing profile', () => {
    const props = renderControls();
    fireEvent.click(screen.getByRole('button', { name: 'Swap start and destination' }));
    fireEvent.change(screen.getByLabelText('Route profile'), { target: { value: 'accessible' } });
    expect(props.swapPlaces).toHaveBeenCalledOnce();
    expect(props.setProfile).toHaveBeenCalledWith('accessible');
    expect(screen.getByRole('option', { name: 'Prefer elevators' })).toBeInTheDocument();
  });

  it('submits route changes explicitly and disables submission without a changed valid draft', () => {
    const unchanged = renderControls({ route: okRoute });
    fireEvent.click(screen.getByRole('button', { name: 'Edit route' }));
    expect(screen.getByRole('button', { name: 'Update route' })).toBeDisabled();
    unchanged.submitRoute.mockClear();
  });

  it('applies a changed draft through the route submission action', () => {
    const props = renderControls({ route: okRoute, routeDirty: true });
    fireEvent.click(screen.getByRole('button', { name: 'Edit route' }));
    fireEvent.click(screen.getByRole('button', { name: 'Update route' }));
    expect(props.submitRoute).toHaveBeenCalledOnce();
  });

  it('expands vertical directions, discloses warnings, and focuses a step', () => {
    const props = renderControls({ route: okRoute });
    expect(screen.getByText('Continue on B1 for 2.0 m.')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Unknown segments are allowed by policy');
    fireEvent.click(screen.getByRole('button', { name: /Show directions/i }));
    fireEvent.click(screen.getByRole('button', { name: /Continue on B1/i }));
    expect(props.onStepSelect).toHaveBeenCalledWith(0);
  });

  it('moves through route steps with explicit previous and next controls', () => {
    const steps = [
      { kind: 'continue' as const, distanceMeters: 2, floorFrom: 'B1', floorTo: 'B1', edgeIds: ['one'] },
      { kind: 'transition' as const, distanceMeters: 3, floorFrom: 'B1', floorTo: '0', movement: 'elevator' as const, edgeIds: ['two'] },
      { kind: 'arrive' as const, distanceMeters: 1, floorFrom: '0', floorTo: '0', edgeIds: [] },
    ];
    const first = renderControls({ route: { ...okRoute, steps }, selectedStepIndex: 0 });
    expect(screen.getByLabelText('Previous route step')).toBeDisabled();
    fireEvent.click(screen.getByLabelText('Next route step'));
    expect(first.onStepSelect).toHaveBeenCalledWith(1);
  });

  it('shows a structured collapsed journey summary with persistent warnings', () => {
    renderControls({ route: okRoute });
    expect(screen.getAllByText(/Start gate.*End gate/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/About 1 min/)).toHaveLength(1);
    expect(screen.getByText(/4.0 m.*0 floor changes.*Wheelchair accessible/)).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Accessibility data is incomplete');
    expect(screen.getByText(/Elevator operation, congestion, and temporary closures are not live/)).toBeInTheDocument();
    expect(screen.getByText(/Movement types: walking/)).toBeInTheDocument();
  });

  it('starts valid routes collapsed and reopens the planner on demand', () => {
    renderControls({ route: okRoute });
    expect(screen.queryByLabelText('Search start place')).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Start gate to End gate' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Edit route' }));
    expect(screen.getByLabelText('Search start place')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Start gate to End gate' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Hide planner' }));
    expect(screen.queryByLabelText('Search start place')).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Start gate to End gate' })).toBeInTheDocument();
  });

  it('copies the complete current route URL with transient feedback', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    renderControls();
    fireEvent.click(screen.getByRole('button', { name: 'Share route' }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(window.location.href));
    expect(screen.getByRole('status')).toHaveTextContent('Route link copied');
  });

  it('keeps only one major overlay expanded on narrow screens', () => {
    const originalMatchMedia = window.matchMedia;
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn().mockReturnValue({ matches: true }) });
    renderControls({ route: okRoute });
    fireEvent.click(screen.getByRole('button', { name: 'Edit route' }));
    expect(screen.getByLabelText('Search start place')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Show directions/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Hide planner' }));
    fireEvent.click(screen.getByRole('button', { name: /Show directions/i }));
    expect(screen.queryByLabelText('Search start place')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Hide directions/i })).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Map settings'));
    expect(screen.getByRole('button', { name: /Show directions/i })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Display layers' })).toBeVisible();
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: originalMatchMedia });
  });

  it('collapses mobile map tools after applying a camera preset', () => {
    const props = renderControls();
    const tools = screen.getByRole('button', { name: 'Map tools' });
    fireEvent.click(tools);
    expect(tools).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'North-up view' }));
    expect(tools).toHaveAttribute('aria-expanded', 'false');
    expect(props.showNorthView).toHaveBeenCalledOnce();
  });

  it('starts with the legend collapsed when the viewport is short', () => {
    const originalMatchMedia = window.matchMedia;
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: vi.fn().mockImplementation((query: string) => ({ matches: query.includes('max-height') })) });
    renderControls();
    expect(screen.getByLabelText('Expand map legend')).toBeInTheDocument();
    Object.defineProperty(window, 'matchMedia', { configurable: true, value: originalMatchMedia });
  });

  it('switches a live route to Japanese without changing route state or URL', () => {
    const props = renderProps(false, { route: okRoute });
    const originalUrl = window.location.href;
    render(<LocaleProvider initialLocale="en"><ViewerControls {...props} /></LocaleProvider>);
    expect(screen.getByText('Continue on B1 for 2.0 m.')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Map settings'));
    fireEvent.click(screen.getByRole('radio', { name: '日本語' }));

    expect(document.documentElement.lang).toBe('ja');
    expect(screen.getByText('地下1階を2.0 m進みます。')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '経路を編集' })).toBeInTheDocument();
    expect(props.submitRoute).not.toHaveBeenCalled();
    expect(window.location.href).toBe(originalUrl);
  });
});
