// AOC Recognition Runtime — injected runtime context
//
// No Date.now(), no random IDs, no nondeterministic hashing anywhere in
// this feature. Every service and policy receives its clock/id generator
// through this context so tests stay fully deterministic.

export type RecognitionRuntimeClock = {
  now(): string;
};

export type RecognitionRuntimeIdGenerator = {
  nextId(prefix: string): string;
};

export type RecognitionRuntimeContext = {
  clock: RecognitionRuntimeClock;
  ids: RecognitionRuntimeIdGenerator;
};
