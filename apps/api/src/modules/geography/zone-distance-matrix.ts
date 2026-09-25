import type { EntityManager } from '@mikro-orm/postgresql';
import { ValidationFailedError } from '../../shared/domain/domain-error';
import type { DistanceProvider } from './distance-provider';
import { ZoneDistance } from './zone-distance.entity';
import { Zone } from './zone.entity';

export interface ZoneInfo {
  id: number;
  code: string;
  name: string;
  latitude: number;
  longitude: number;
}

/** Zones and the distance table, loaded once at startup (reference data never changes at runtime). */
export class ZoneDistanceMatrix implements DistanceProvider {
  private readonly metres = new Map<string, number>();
  private readonly byId: Map<number, ZoneInfo>;

  constructor(zones: readonly ZoneInfo[], distances: readonly ZoneDistanceRow[]) {
    this.byId = new Map(zones.map((zone) => [zone.id, zone]));
    for (const row of distances) {
      this.metres.set(ZoneDistanceMatrix.key(row.fromZoneId, row.toZoneId), row.distanceM);
    }
  }

  static async load(em: EntityManager): Promise<ZoneDistanceMatrix> {
    const [zones, distances] = await Promise.all([
      em.find(Zone, {}, { orderBy: { id: 'asc' } }),
      em.find(ZoneDistance, {}),
    ]);
    return new ZoneDistanceMatrix(
      zones.map((zone) => ({
        id: zone.id,
        code: zone.code,
        name: zone.name,
        latitude: Number(zone.latitude),
        longitude: Number(zone.longitude),
      })),
      distances,
    );
  }

  distanceM(fromZoneId: number, toZoneId: number): number {
    if (fromZoneId === toZoneId) return 0;
    const distance = this.metres.get(ZoneDistanceMatrix.key(fromZoneId, toZoneId));
    if (distance === undefined) {
      throw new ValidationFailedError('No route is defined between those zones.');
    }
    return distance;
  }

  zones(): ZoneInfo[] {
    return [...this.byId.values()].sort((a, b) => a.id - b.id);
  }

  zone(id: number): ZoneInfo | undefined {
    return this.byId.get(id);
  }

  requireZone(id: number): ZoneInfo {
    const zone = this.byId.get(id);
    if (!zone) throw new ValidationFailedError('Unknown zone.');
    return zone;
  }

  private static key(from: number, to: number): string {
    return `${from}>${to}`;
  }
}

export interface ZoneDistanceRow {
  fromZoneId: number;
  toZoneId: number;
  distanceM: number;
}
