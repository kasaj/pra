import { Activity, DayEntry } from '../types';

const STORAGE_KEY = 'pra_data';

export const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export const getTodayDate = (): string => {
  return new Date().toISOString().split('T')[0];
};

export const loadAllData = (): DayEntry[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
};

export const saveAllData = (data: DayEntry[]): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

export const getDayEntry = (date: string): DayEntry | undefined => {
  const data = loadAllData();
  return data.find((entry) => entry.date === date);
};

export const saveDayEntry = (entry: DayEntry): void => {
  const data = loadAllData();
  const index = data.findIndex((e) => e.date === entry.date);

  if (index >= 0) {
    data[index] = entry;
  } else {
    data.push(entry);
  }

  // Seřadit podle data
  data.sort((a, b) => b.date.localeCompare(a.date));
  saveAllData(data);
};

export const addActivity = (activity: Activity): void => {
  const activityDate = activity.startedAt
    ? new Date(activity.startedAt).toISOString().split('T')[0]
    : getTodayDate();
  const entry = getDayEntry(activityDate) || { date: activityDate, activities: [] };
  entry.activities.push(activity);
  saveDayEntry(entry);
};

export const getRecentDays = (count: number): DayEntry[] => {
  const data = loadAllData();
  return data.slice(0, count);
};

export const updateActivityById = (id: string, updates: Partial<Activity>): void => {
  const data = loadAllData();
  for (const entry of data) {
    const idx = entry.activities.findIndex((a) => a.id === id);
    if (idx >= 0) {
      const updated = { ...entry.activities[idx], ...updates };
      const newDate = updated.startedAt
        ? new Date(updated.startedAt).toISOString().split('T')[0]
        : entry.date;

      if (newDate !== entry.date) {
        // Move activity to the correct day
        entry.activities.splice(idx, 1);
        const targetEntry = data.find(e => e.date === newDate) || { date: newDate, activities: [] };
        targetEntry.activities.push(updated);
        if (!data.find(e => e.date === newDate)) data.push(targetEntry);
        // Remove empty days
        const filtered = data.filter(e => e.activities.length > 0);
        filtered.sort((a, b) => b.date.localeCompare(a.date));
        saveAllData(filtered);
      } else {
        entry.activities[idx] = updated;
        saveAllData(data);
      }
      return;
    }
  }
};

export const findActivityById = (id: string): { activity: Activity; date: string } | null => {
  const data = loadAllData();
  for (const entry of data) {
    const activity = entry.activities.find((a) => a.id === id);
    if (activity) return { activity, date: entry.date };
  }
  return null;
};

export const createLinkedActivity = (originalId: string, type: string): Activity => {
  const newId = generateId();
  const now = new Date().toISOString();

  // Add link reference to original
  updateActivityById(originalId, {
    linkedActivityIds: [
      ...((findActivityById(originalId)?.activity.linkedActivityIds) || []),
      newId,
    ],
  });

  const newActivity: Activity = {
    id: newId,
    type,
    startedAt: now,
    completedAt: now,
    durationMinutes: null,
    linkedFromId: originalId,
  };

  addActivity(newActivity);
  return newActivity;
};

export const deleteActivitiesByIds = (ids: string[]): void => {
  const data = loadAllData();
  const idSet = new Set(ids);

  const updatedData = data
    .map((entry) => ({
      ...entry,
      activities: entry.activities.filter((a) => !idSet.has(a.id)),
    }))
    .filter((entry) => entry.activities.length > 0);

  saveAllData(updatedData);
};
