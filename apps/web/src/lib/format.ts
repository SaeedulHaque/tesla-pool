const bdt = new Intl.NumberFormat('en-BD', {
  style: 'currency',
  currency: 'BDT',
  currencyDisplay: 'narrowSymbol',
});

/** Money is integer paisa everywhere; it becomes taka only here, at the edge. */
export function formatBDT(paisa: number): string {
  return bdt.format(paisa / 100);
}

export function formatKm(metres: number): string {
  return `${(metres / 1000).toFixed(1)} km`;
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-BD', { hour: 'numeric', minute: '2-digit' });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-BD', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}
