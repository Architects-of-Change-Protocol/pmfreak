export function ProgramErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-rose-300/20 bg-rose-300/[0.06] px-6 py-8 text-center">
      <p className="text-sm font-semibold text-rose-300">Something went wrong</p>
      <p className="mt-1 text-sm text-rose-200/70">{message}</p>
    </div>
  );
}
