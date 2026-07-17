// Barrel for app data types. Types are grouped by domain in sibling files;
// importing from '@/data/types' re-exports all of them so existing imports
// keep working. New code may also import from a specific module,
// e.g. '@/data/types/trail'.
export * from './geo';
export * from './trail';
export * from './review';
export * from './user';
export * from './hike';
export * from './friends';
export * from './obstacle';
export * from './facility';
