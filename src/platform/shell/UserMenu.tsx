export function UserMenu({ fullName, role }: { fullName: string; role: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-slate-200">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-500/20 text-xs font-semibold uppercase" aria-hidden="true">
        {fullName.charAt(0)}
      </span>
      <span className="flex flex-col leading-tight">
        <span>{fullName}</span>
        <span className="text-xs text-slate-400 capitalize">{role}</span>
      </span>
    </div>
  );
}
