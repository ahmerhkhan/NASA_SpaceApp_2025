import React, { useEffect, useRef } from "react";
import * as Cesium from "cesium";
import { Mission, SimulationResult } from "../types";
import "cesium/Build/Cesium/Widgets/widgets.css";
import { getLoadedCities, preloadCities } from "../utils/geocoding";
import { populationAffectedByZones } from "../lib/impact";

// ✅ Cesium Ion token
Cesium.Ion.defaultAccessToken =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIyNjQ3MmFkNy00NzRiLTRmYjUtYTFmMC0yYmRhZjFmOWMxMmUiLCJpZCI6MzQyMDc3LCJpYXQiOjE3NTg1MzQ1MjZ9.HxIFbJ0YQjbZfGpLouoII6gXMlzaxmpN6wrO5lGyPX0";

interface CesiumGlobeProps {
  mission: Mission;
  onRunSimulation?: (result: SimulationResult) => void;
  isSimulating?: boolean;
  externalSelection?: {
    lat: number;
    lng: number;
    city?: string;
    country?: string;
    population?: number;
  } | null;
  onLocationSelected?: (
    lat: number,
    lng: number,
    details?: { city?: string; country?: string; population?: number }
  ) => void;
}

function easeOutQuad(t: number) { return 1 - (1 - t) * (1 - t); }

export default function CesiumGlobe({
  mission,
  externalSelection,
  onLocationSelected,
  isSimulating,
  onRunSimulation,
}: CesiumGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Cesium.Viewer | null>(null);
  const markerRef = useRef<Cesium.Entity | null>(null);
  const preUpdateRef = useRef<Cesium.Event.RemoveCallback | null>(null);

  useEffect(() => {
    let mounted = true;
    let handler: Cesium.ScreenSpaceEventHandler | undefined;
    let viewer: Cesium.Viewer | null = null;

    async function init() {
      if (!containerRef.current || !mounted) return;
      try {
        // ✅ Create Viewer with zoom & UI controls
        viewer = new Cesium.Viewer(containerRef.current, {
          animation: false,
          timeline: false,
          geocoder: false,
          homeButton: false,
          baseLayerPicker: false,
          sceneModePicker: false,
          navigationHelpButton: true,
          fullscreenButton: true,
          selectionIndicator: false,
          infoBox: false,
          requestRenderMode: true,
          globe: new Cesium.Globe(Cesium.Ellipsoid.WGS84),
        });

        viewerRef.current = viewer;
        const scene = viewer.scene;
        scene.backgroundColor = Cesium.Color.BLACK;

        // ✅ Imagery & Terrain (no Google tiles to avoid licensing issues)
        viewer.imageryLayers.removeAll();
        const bingLayer = await Cesium.IonImageryProvider.fromAssetId(3);
        viewer.imageryLayers.addImageryProvider(bingLayer);

        // ✅ Add World Terrain
        viewer.terrainProvider = await Cesium.createWorldTerrainAsync();

        // ✅ Camera default (zoomed-out start)
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(0, 20, 45_000_000),
          duration: 0.5,
        });

        // ✅ Enable zoom / rotate / tilt
        const ssc = scene.screenSpaceCameraController;
        ssc.enableZoom = true;
        ssc.enableRotate = true;
        ssc.enableTilt = true;

        // ✅ Click to pick location
        handler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
        handler.setInputAction((movement: any) => {
          if (!mounted || !viewer) return;
          const cartesian = viewer.scene.pickPosition(movement.position) || viewer.camera.pickEllipsoid(movement.position, Cesium.Ellipsoid.WGS84);
          if (!cartesian) return;

          const cartographic = Cesium.Cartographic.fromCartesian(cartesian);
          const lat = Cesium.Math.toDegrees(cartographic.latitude);
          const lng = Cesium.Math.toDegrees(cartographic.longitude);

          // Remove old marker
          if (markerRef.current) viewer.entities.remove(markerRef.current);

          // Simple coordinate display - no complex city matching
          const locationText = `${lat.toFixed(2)}°N, ${lng.toFixed(2)}°E`;
          
          markerRef.current = viewer.entities.add({
            position: Cesium.Cartesian3.fromDegrees(lng, lat, 0),
            point: {
              pixelSize: 10,
              color: Cesium.Color.CYAN,
              outlineColor: Cesium.Color.WHITE,
              outlineWidth: 2,
              heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
            label: {
              text: locationText,
              font: "16px sans-serif",
              pixelOffset: new Cesium.Cartesian2(0, -20),
              fillColor: Cesium.Color.WHITE,
              showBackground: true,
              backgroundColor: Cesium.Color.fromAlpha(Cesium.Color.BLACK, 0.6),
              heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            }
          });

          // Notify parent with coordinate data
          onLocationSelected?.(lat, lng, { 
            city: locationText,
            country: '',
            population: 0 
          });

          // Gentle flyTo selected spot at a comfortable altitude
          viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(lng, lat, 1_000_000), duration: 0.8 });
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
      } catch (e) {
        console.error("Cesium init failed", e);
      }
    }

    init();

    return () => {
      mounted = false;
      if (handler) handler.destroy();
      if (viewer) viewer.destroy();
      viewerRef.current = null;
      markerRef.current = null;
    };
  }, [onLocationSelected]);

  // ✅ External fly-to location
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !externalSelection) return;
    const { lat, lng, city, country, population } = externalSelection;
    
    // Remove old marker
    if (markerRef.current) viewer.entities.remove(markerRef.current);
    
    // Add new marker with city info
    markerRef.current = viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(lng, lat, 0),
      point: {
        pixelSize: 12,
        color: Cesium.Color.YELLOW,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
      label: {
        text: `${city || 'Selected Location'}${country ? `, ${country}` : ''}`,
        font: "16px sans-serif",
        pixelOffset: new Cesium.Cartesian2(0, -25),
        fillColor: Cesium.Color.WHITE,
        showBackground: true,
        backgroundColor: Cesium.Color.fromAlpha(Cesium.Color.BLACK, 0.7),
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      }
    });
    
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(lng, lat, 1_000_000),
      duration: 1.0,
    });
  }, [externalSelection]);

  // Start meteor animation when simulation begins and a result is available
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || !isSimulating || !mission?.result) return;
    const res = mission.result as SimulationResult;
    const lon = res.longitude;
    const lat = res.latitude;

    // Stage camera: zoomed-out cinematic
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(lon, lat, 30_000_000),
      duration: 1.0,
    });

    // Meteor entity (smaller, angled entry, brighter glow trail)
    const meteor = viewer.entities.add({
      id: 'meteor',
      position: new Cesium.ConstantPositionProperty(Cesium.Cartesian3.fromDegrees(lon, lat, 2000000)),
      ellipsoid: {
        radii: new Cesium.Cartesian3(30000, 30000, 30000),
        material: Cesium.Color.fromCssColorString('#6e6258').withAlpha(0.95),
        outline: false,
      }
    });

    const trailPositions: Cesium.Cartesian3[] = [];
    const trail = viewer.entities.add({
      id: 'meteor-trail',
      polyline: {
        positions: new Cesium.CallbackProperty(() => trailPositions.slice(), false),
        width: 14,
        material: new Cesium.PolylineGlowMaterialProperty({ color: Cesium.Color.fromCssColorString('#ffa34d'), glowPower: 0.7 }),
      }
    });
    const trail2 = viewer.entities.add({
      id: 'meteor-trail-outer',
      polyline: {
        positions: new Cesium.CallbackProperty(() => trailPositions.slice(), false),
        width: 22,
        material: new Cesium.PolylineGlowMaterialProperty({ color: Cesium.Color.fromCssColorString('#ffde7a').withAlpha(0.5), glowPower: 0.3 })
      }
    });

    // angled entry from NW to ground
    const startCart = Cesium.Cartesian3.fromDegrees(lon - 1.2, lat + 0.6, 2_000_000);
    const endCart = Cesium.Cartesian3.fromDegrees(lon, lat, 0);
    const t0 = Date.now();
    const durationMs = 3500;
    const scratch = new Cesium.Cartesian3();

    // Follow camera
    viewer.scene.screenSpaceCameraController.enableRotate = false;
    viewer.scene.screenSpaceCameraController.enableTranslate = false;
    viewer.scene.screenSpaceCameraController.enableTilt = false;

    const remove = viewer.scene.preUpdate.addEventListener(() => {
      const elapsed = Date.now() - t0;
      const t = Math.min(1, elapsed / durationMs);
      const tt = easeOutQuad(t);
      Cesium.Cartesian3.lerp(startCart, endCart, tt, scratch);
      (meteor.position as Cesium.ConstantPositionProperty).setValue(scratch);
      trailPositions.push(Cesium.Cartesian3.clone(scratch));
      // Camera lookAt with offset
      viewer.camera.lookAt(scratch, new Cesium.Cartesian3(0, -800000, 400000));
      if (elapsed >= durationMs) {
        remove();
        // Flash
        viewer.entities.add({ position: endCart, point: { pixelSize: 40, color: Cesium.Color.WHITE } });
        // Cleanup meteor after brief delay
        setTimeout(() => { viewer.entities.remove(meteor); viewer.entities.remove(trail); const tr2 = viewer.entities.getById('meteor-trail-outer'); if (tr2) viewer.entities.remove(tr2); }, 300);
        // Release camera and show zones
        viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);

        // Draw impact zones
        const craterM = res.crater_m / 2;
        const blastM = res.blast_radius_m;
        const thermalM = res.thermal_radius_m;
        const center = Cesium.Cartesian3.fromDegrees(lon, lat);
        viewer.entities.add({ id: 'craterZone', position: center, ellipse: { semiMajorAxis: craterM, semiMinorAxis: craterM, material: Cesium.Color.RED.withAlpha(0.35), outline: false } });
        viewer.entities.add({ id: 'blastZone', position: center, ellipse: { semiMajorAxis: blastM, semiMinorAxis: blastM, material: Cesium.Color.ORANGE.withAlpha(0.22), outline: false } });
        viewer.entities.add({ id: 'thermalZone', position: center, ellipse: { semiMajorAxis: thermalM, semiMinorAxis: thermalM, material: Cesium.Color.YELLOW.withAlpha(0.18), outline: false } });

        // Remove old zone labels if exist
        const oldCraterLabel = viewer.entities.getById('craterLabel'); if (oldCraterLabel) viewer.entities.remove(oldCraterLabel);
        const oldBlastLabel = viewer.entities.getById('blastLabel'); if (oldBlastLabel) viewer.entities.remove(oldBlastLabel);
        const oldThermalLabel = viewer.entities.getById('thermalLabel'); if (oldThermalLabel) viewer.entities.remove(oldThermalLabel);

        // Place labels at zone edges with geographic offset to avoid overlap
        const kmToDeg = (km: number) => km / 111; // approx conversion for small distances
        const craterLat = lat + kmToDeg((craterM/1000) + 5);
        const blastLat = lat + kmToDeg((blastM/1000) + 10);
        const thermalLat = lat + kmToDeg((thermalM/1000) + 15);
        viewer.entities.add({ id: 'craterLabel', position: Cesium.Cartesian3.fromDegrees(lon, craterLat, 0), label: { text: `Crater ${(craterM/1000).toFixed(1)} km radius`, font: '14px sans-serif', pixelOffset: new Cesium.Cartesian2(0, -10), fillColor: Cesium.Color.WHITE, showBackground: true, backgroundColor: Cesium.Color.fromAlpha(Cesium.Color.BLACK, 0.55), heightReference: Cesium.HeightReference.CLAMP_TO_GROUND } });
        viewer.entities.add({ id: 'blastLabel', position: Cesium.Cartesian3.fromDegrees(lon, blastLat, 0), label: { text: `Blast ${(blastM/1000).toFixed(1)} km`, font: '13px sans-serif', pixelOffset: new Cesium.Cartesian2(0, -10), fillColor: Cesium.Color.fromCssColorString('#ffa34d'), showBackground: true, backgroundColor: Cesium.Color.fromAlpha(Cesium.Color.BLACK, 0.55), heightReference: Cesium.HeightReference.CLAMP_TO_GROUND } });
        viewer.entities.add({ id: 'thermalLabel', position: Cesium.Cartesian3.fromDegrees(lon, thermalLat, 0), label: { text: `Thermal ${(thermalM/1000).toFixed(1)} km`, font: '13px sans-serif', pixelOffset: new Cesium.Cartesian2(0, -10), fillColor: Cesium.Color.fromCssColorString('#ffe680'), showBackground: true, backgroundColor: Cesium.Color.fromAlpha(Cesium.Color.BLACK, 0.55), heightReference: Cesium.HeightReference.CLAMP_TO_GROUND } });

        // Final camera to show all zones
        const maxRadius = Math.max(craterM, blastM, thermalM);
        const altitude = Math.max(maxRadius * 2.0, 300000);
        viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(lon, lat, altitude), duration: 1.2 });

        // Compute population affected by crater/blast/thermal zones using city points from geocoding
        (async () => {
          try {
            // Ensure cities are loaded from the same dataset used by geocoding for consistency
            await preloadCities();
            const cities = getLoadedCities();
            const pointCities = cities
              .map((c: any) => ({
                geometry: { coordinates: [c.lon, c.lat] as [number, number] },
                properties: { city: c.name, country: c.country, population: c.population || 0 }
              }))
              .filter((p: any) => Number.isFinite(p.geometry.coordinates[0]) && Number.isFinite(p.geometry.coordinates[1]));

            const zones = populationAffectedByZones(
              pointCities,
              lat,
              lon,
              res.blast_radius_km,
              res.thermal_radius_km,
              res.crater_km / 2
            );

            const topCities = zones.cityResults.slice(0, 10).map(c => ({
              name: c.city,
              country: c.country || '',
              population: c.population || 0,
              distance: c.distance_km,
              zones: c.zones
            }));

            const withPop: SimulationResult = {
              ...res, 
              population_affected: zones.thermalPop,
              affectedCities: topCities,
              crater_population_total: zones.craterPop,
              blast_population_total: zones.blastPop,
              thermal_population_total: zones.thermalPop
            } as SimulationResult;
            onRunSimulation?.(withPop);
          } catch {
            onRunSimulation?.(res);
          }
        })();
      }
    });

    preUpdateRef.current = remove;

    return () => {
      try { remove && remove(); } catch {}
      viewer.scene.screenSpaceCameraController.enableRotate = true;
      viewer.scene.screenSpaceCameraController.enableTranslate = true;
      viewer.scene.screenSpaceCameraController.enableTilt = true;
      const ent = viewer.entities.getById('meteor'); if (ent) viewer.entities.remove(ent);
      const tr = viewer.entities.getById('meteor-trail'); if (tr) viewer.entities.remove(tr);
    };
  }, [isSimulating, mission?.result, onRunSimulation]);

  return (
    <div
      style={{
        position: "relative",
        height: "70vh",
        maxWidth: "1200px",
        margin: "0 auto",
        borderRadius: "1rem",
        overflow: "hidden",
      }}
      className="w-full h-full"
    >
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />
      <button
        onClick={() => {
          const viewer = viewerRef.current;
          if (!viewer) return;
          // Clear previous impact entities
          ['craterZone','blastZone','thermalZone','craterLabel','blastLabel','thermalLabel','meteor','meteor-trail'].forEach(id => {
            const ent = viewer.entities.getById(id as any);
            if (ent) viewer.entities.remove(ent);
          });
          // Fly back to a staging view
          viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(0, 20, 45_000_000), duration: 0.8 });
        }}
        title="Replay"
        style={{ position: 'absolute', right: 64, top: 12, background: 'rgba(0,0,0,0.55)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)', padding: '8px 10px', borderRadius: 8, cursor: 'pointer' }}
      >⟲ Replay</button>
    </div>
  );
}
