import type { RoutePlannerDraft, RoutePlannerState } from '../features/route-planner/useRoutePlanner.js';
import type { PlaceTranslationsDataset } from '../schema/placeTranslations.js';
import type { NamedPlaceRecord } from '../schema/processed.js';
import type { FloorViewMode } from '../map/displayPreferences.js';
import type { MapLegendItem } from '../map/mapLegend.js';

export interface PlannerViewModel {
  readonly places: NamedPlaceRecord[];
  readonly translations?: PlaceTranslationsDataset;
  readonly draft: RoutePlannerDraft;
  readonly displayedRoute: RoutePlannerState['displayedRoute'];
  readonly swapPlaces: () => void;
  readonly clearRoute: () => void;
  readonly submitRoute: () => void;
}

export interface ViewerNavigationViewModel {
  readonly floors: {
    readonly floorIds: string[];
    readonly visibleFloors: string[];
    readonly routeFloorIds: string[];
    readonly activeFloor: string;
    readonly floorViewMode: FloorViewMode;
    readonly selectFloor: (floorId: string) => void;
    readonly showStack: () => void;
    readonly showRouteFloors: () => void;
    readonly toggleCustomFloor: (floorId: string) => void;
  };
  readonly camera: {
    readonly rotationEnabled: boolean;
    readonly setRotationEnabled: (value: boolean) => void;
    readonly fitRoute: () => void;
    readonly fitStation: () => void;
    readonly zoomIn: () => void;
    readonly zoomOut: () => void;
    readonly showNorthView: () => void;
    readonly showAngledView: () => void;
    readonly cameraHeading: number;
    readonly selectedStepIndex?: number;
    readonly selectStep: (index: number) => void;
  };
}

export interface ViewerDisplayViewModel {
  readonly layers: {
    readonly showOfficialNetwork: boolean;
    readonly setShowOfficialNetwork: (value: boolean) => void;
    readonly showFacilities: boolean;
    readonly setShowFacilities: (value: boolean) => void;
    readonly facilityCategories: Array<{ code: string; label: string; count: number }>;
    readonly enabledFacilityCategories: ReadonlySet<string>;
    readonly toggleFacilityCategory: (code: string) => void;
    readonly showAllFacilityCategories: () => void;
    readonly clearAllFacilityCategories: () => void;
    readonly resetFacilityCategories: () => void;
    readonly showStructuralDetails: boolean;
    readonly setShowStructuralDetails: (value: boolean) => void;
  };
  readonly diagnostics: {
    readonly debug: boolean;
    readonly setDebug: (value: boolean) => void;
    readonly showAllSourceLinks: boolean;
    readonly setShowAllSourceLinks: (value: boolean) => void;
    readonly showOfficialNodes: boolean;
    readonly setShowOfficialNodes: (value: boolean) => void;
    readonly showTwsi: boolean;
    readonly setShowTwsi: (value: boolean) => void;
  };
}

export interface ViewerFeedbackViewModel {
  readonly interactionMessage?: string;
}

export interface ViewerLegendViewModel {
  readonly items: MapLegendItem[];
}
