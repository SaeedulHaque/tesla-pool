/** Strategy: today a lookup table, tomorrow a routing service. */
export interface DistanceProvider {
  /** Road distance in metres between two zones; 0 for the same zone. */
  distanceM(fromZoneId: number, toZoneId: number): number;
}
