import { Skeleton } from "@/components/ui/skeleton";

export default function PersonLoading() {
  return (
    <main className="container max-w-3xl py-8">
      <Skeleton className="h-4 w-32" />
      <div className="mt-6 flex items-center gap-4">
        <Skeleton className="h-[72px] w-[72px] rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <Skeleton className="mt-8 h-5 w-24" />
      <Skeleton className="mt-4 h-10 w-full" />
      <Skeleton className="mt-2 h-6 w-2/3" />
      <div className="mt-8 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
    </main>
  );
}
