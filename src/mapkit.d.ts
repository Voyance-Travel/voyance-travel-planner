/**
 * Type declarations for Apple MapKit JS
 * @see https://developer.apple.com/documentation/mapkitjs
 */

declare namespace mapkit {
  function init(options: { authorizationCallback: (done: (token: string) => void) => void }): void;

  class Coordinate {
    constructor(latitude: number, longitude: number);
    latitude: number;
    longitude: number;
  }

  class CoordinateRegion {
    constructor(center: Coordinate, span: CoordinateSpan);
  }

  class CoordinateSpan {
    constructor(latitudeDelta: number, longitudeDelta: number);
  }

  class Padding {
    constructor(top: number, right: number, bottom: number, left: number);
  }

  class Map {
    constructor(element: HTMLElement, options?: MapConstructorOptions);
    center: Coordinate;
    region: CoordinateRegion;
    showsCompass: string;
    showsScale: string;
    showsMapTypeControl: boolean;
    isZoomEnabled: boolean;
    isScrollEnabled: boolean;
    colorScheme: string;
    addAnnotation(annotation: any): void;
    addAnnotations(annotations: any[]): void;
    addOverlay(overlay: any): void;
    showItems(items: any[], options?: ShowItemsOptions): void;
    destroy(): void;

    static readonly ColorSchemes: {
      Light: string;
      Dark: string;
    };
  }

  interface MapConstructorOptions {
    showsCompass?: string;
    showsScale?: string;
    showsMapTypeControl?: boolean;
    isZoomEnabled?: boolean;
    isScrollEnabled?: boolean;
    colorScheme?: string;
    center?: Coordinate;
    region?: CoordinateRegion;
  }

  interface ShowItemsOptions {
    padding?: Padding;
    animate?: boolean;
  }

  const FeatureVisibility: {
    Hidden: string;
    Visible: string;
    Adaptive: string;
  };

  class MarkerAnnotation {
    constructor(coordinate: Coordinate, options?: MarkerAnnotationOptions);
  }

  interface MarkerAnnotationOptions {
    glyphText?: string;
    color?: string;
    title?: string;
  }

  class PolylineOverlay {
    constructor(coordinates: Coordinate[], options?: { style?: Style });
  }

  class Style {
    constructor(options?: StyleOptions);
  }

  interface StyleOptions {
    lineWidth?: number;
    strokeColor?: string;
    strokeOpacity?: number;
    lineDash?: number[];
  }
}
