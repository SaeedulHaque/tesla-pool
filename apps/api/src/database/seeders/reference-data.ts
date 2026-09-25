/** Reference data for the demo city. Distances are round-number estimates, see README. */

export interface ZoneSeed {
  id: number;
  code: string;
  name: string;
  latitude: string;
  longitude: string;
}

export const ZONE_SEEDS: readonly ZoneSeed[] = [
  { id: 1, code: 'BANANI', name: 'Banani', latitude: '23.79370', longitude: '90.40660' },
  { id: 2, code: 'GULSHAN_1', name: 'Gulshan 1', latitude: '23.78060', longitude: '90.41670' },
  { id: 3, code: 'GULSHAN_2', name: 'Gulshan 2', latitude: '23.79250', longitude: '90.41430' },
  { id: 4, code: 'MOHAKHALI', name: 'Mohakhali', latitude: '23.77810', longitude: '90.40070' },
  { id: 5, code: 'FARMGATE', name: 'Farmgate', latitude: '23.75610', longitude: '90.38720' },
  { id: 6, code: 'DHANMONDI', name: 'Dhanmondi', latitude: '23.74610', longitude: '90.37420' },
  { id: 7, code: 'MIRPUR_10', name: 'Mirpur 10', latitude: '23.80690', longitude: '90.36870' },
  { id: 8, code: 'UTTARA', name: 'Uttara', latitude: '23.87590', longitude: '90.37950' },
  {
    id: 9,
    code: 'BASHUNDHARA',
    name: 'Bashundhara R/A',
    latitude: '23.81930',
    longitude: '90.45260',
  },
];

/** One row per unordered pair, in metres; the seeder stores both directions. */
export const DISTANCE_SEEDS_M: readonly (readonly [string, string, number])[] = [
  ['BANANI', 'MOHAKHALI', 3_000],
  ['BANANI', 'GULSHAN_1', 2_000],
  ['GULSHAN_1', 'MOHAKHALI', 2_500],
  ['BANANI', 'GULSHAN_2', 1_500],
  ['BANANI', 'FARMGATE', 4_000],
  ['BANANI', 'DHANMONDI', 6_500],
  ['BANANI', 'MIRPUR_10', 6_000],
  ['BANANI', 'UTTARA', 9_000],
  ['BANANI', 'BASHUNDHARA', 5_000],
  ['GULSHAN_1', 'GULSHAN_2', 1_500],
  ['GULSHAN_1', 'FARMGATE', 5_000],
  ['GULSHAN_1', 'DHANMONDI', 7_500],
  ['GULSHAN_1', 'MIRPUR_10', 8_000],
  ['GULSHAN_1', 'UTTARA', 10_500],
  ['GULSHAN_1', 'BASHUNDHARA', 3_500],
  ['GULSHAN_2', 'MOHAKHALI', 3_000],
  ['GULSHAN_2', 'FARMGATE', 5_000],
  ['GULSHAN_2', 'DHANMONDI', 7_500],
  ['GULSHAN_2', 'MIRPUR_10', 7_500],
  ['GULSHAN_2', 'UTTARA', 9_500],
  ['GULSHAN_2', 'BASHUNDHARA', 3_000],
  ['MOHAKHALI', 'FARMGATE', 2_500],
  ['MOHAKHALI', 'DHANMONDI', 5_000],
  ['MOHAKHALI', 'MIRPUR_10', 5_500],
  ['MOHAKHALI', 'UTTARA', 10_000],
  ['MOHAKHALI', 'BASHUNDHARA', 6_000],
  ['FARMGATE', 'DHANMONDI', 2_500],
  ['FARMGATE', 'MIRPUR_10', 6_000],
  ['FARMGATE', 'UTTARA', 11_500],
  ['FARMGATE', 'BASHUNDHARA', 8_500],
  ['DHANMONDI', 'MIRPUR_10', 7_500],
  ['DHANMONDI', 'UTTARA', 13_000],
  ['DHANMONDI', 'BASHUNDHARA', 10_000],
  ['MIRPUR_10', 'UTTARA', 9_500],
  ['MIRPUR_10', 'BASHUNDHARA', 10_500],
  ['UTTARA', 'BASHUNDHARA', 9_000],
];

export const CAST = {
  jashim: { fullName: 'Jashim', phone: '+8801800000001', role: 'DRIVER' },
  kamal: { fullName: 'Kamal', phone: '+8801800000002', role: 'DRIVER' },
  nusrat: { fullName: 'Nusrat', phone: '+8801800000003', role: 'PASSENGER' },
  rafiq: { fullName: 'Rafiq', phone: '+8801800000004', role: 'PASSENGER' },
  shirin: { fullName: 'Shirin', phone: '+8801800000005', role: 'PASSENGER' },
} as const;

export const VEHICLE_SEEDS = [
  { driver: 'jashim', displayName: 'Bullet', plateNumber: 'DM-TA-11-0001', seatCapacity: 3 },
  { driver: 'kamal', displayName: 'Toofan', plateNumber: 'DM-TA-11-0002', seatCapacity: 3 },
] as const;
