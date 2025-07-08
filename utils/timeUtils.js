// utils/timeUtils.js

export function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const hrs = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return hrs > 0 ? `${hrs}h ${remainingMins}m` : `${mins} min`;
}
