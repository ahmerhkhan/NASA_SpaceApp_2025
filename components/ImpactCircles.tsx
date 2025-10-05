import React from 'react';
import { Circle, Tooltip } from 'react-leaflet';
import type { Mission, ImpactVisualEffects } from '../types';
import { generateDamageZones } from '../lib/physics';

interface ImpactCirclesProps {
  mission: Mission;
  showResults?: boolean;
  visualEffects?: ImpactVisualEffects;
}

export default function ImpactCircles({ mission, showResults = true, visualEffects }: ImpactCirclesProps) {
  if (!mission?.result || !showResults) return null;

  const damageZones = generateDamageZones(mission.result, visualEffects);

  return (
    <>
      {damageZones.map((zone, index) => (
        <Circle
          key={zone.type}
          center={[mission.lat, mission.lng]}
          radius={zone.radius_m}
          pathOptions={{
            color: zone.color,
            weight: 2,
            fillOpacity: zone.opacity,
            fillColor: zone.color,
            dashArray: zone.type === 'thermal' ? '5, 5' : undefined
          }}
        >
          <Tooltip direction="center" permanent>
            <div className="zone-tooltip">
              <strong>{zone.description}</strong>
            </div>
          </Tooltip>
        </Circle>
      ))}
    </>
  );
}