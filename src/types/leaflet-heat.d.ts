import 'leaflet';

declare module 'leaflet' {
  interface HeatLayerOptions {
    radius?: number;
    blur?: number;
    maxZoom?: number;
    max?: number;
    minOpacity?: number;
  }

  class HeatLayer extends Layer {
    setLatLngs(latlngs: Array<[number, number, number?]>): this;
    addLatLng(latlng: [number, number, number?]): this;
    redraw(): this;
  }

  function heatLayer(latlngs: Array<[number, number, number?]>, options?: HeatLayerOptions): HeatLayer;
}

declare module 'leaflet.heat' {}
