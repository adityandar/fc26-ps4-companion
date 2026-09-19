const POSITIONS: Readonly<Record<number, string>> = {
  0: 'GK', 1: 'SW', 2: 'RWB', 3: 'RB', 4: 'CB', 5: 'CB', 6: 'CB', 7: 'LB', 8: 'LWB',
  9: 'CDM', 10: 'CDM', 11: 'CDM', 12: 'RM', 13: 'CM', 14: 'CM', 15: 'CM', 16: 'LM',
  17: 'CAM', 18: 'CAM', 19: 'CAM', 20: 'RF', 21: 'CF', 22: 'LF', 23: 'RW', 24: 'ST',
  25: 'ST', 26: 'ST', 27: 'LW', 28: 'SUB', 29: 'RES',
};

export function positionName(code: number | null | undefined): string | null {
  return code === null || code === undefined ? null : POSITIONS[code] ?? `#${code}`;
}
