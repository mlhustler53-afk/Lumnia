import { cn } from "@/lib/utils";

function Bone({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-white/10", className)} />;
}

/** Matches SongCard layout to prevent shift. */
export function SongCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "glass rounded-[32px] p-5",
        className
      )}
      aria-hidden
    >
      <Bone className="mb-5 aspect-square w-full rounded-[24px]" />
      <Bone className="mb-2 h-4 w-[85%]" />
      <Bone className="h-3 w-1/2" />
    </div>
  );
}

export function SongCardSkeletonGrid({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {Array.from({ length: count }).map((_, i) => (
        <SongCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Matches PlaylistCard layout. */
export function PlaylistCardSkeleton() {
  return (
    <div className="glass rounded-3xl p-4" aria-hidden>
      <Bone className="mb-4 aspect-square w-full rounded-2xl" />
      <Bone className="mb-2 h-4 w-3/4" />
      <Bone className="h-3 w-1/3" />
    </div>
  );
}

export function PlaylistCardSkeletonGrid({ count = 5 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: count }).map((_, i) => (
        <PlaylistCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function SectionHeaderSkeleton() {
  return (
    <div className="mb-6 space-y-2" aria-hidden>
      <Bone className="h-8 w-48" />
      <Bone className="h-4 w-64" />
    </div>
  );
}

export function RecommendationSectionSkeleton() {
  return (
    <section aria-hidden>
      <SectionHeaderSkeleton />
      <SongCardSkeletonGrid count={4} />
    </section>
  );
}

export function HomeHeroSkeleton() {
  return (
    <section
      className="relative overflow-hidden rounded-[40px] border border-violet-500/20 bg-gradient-to-br from-violet-950/80 via-black/60 to-fuchsia-950/50 p-8 md:p-12"
      aria-hidden
    >
      <div className="space-y-4 max-w-xl">
        <Bone className="h-4 w-32" />
        <Bone className="h-12 w-full max-w-md" />
        <Bone className="h-5 w-80 max-w-full" />
        <div className="flex gap-3 pt-2">
          <Bone className="h-11 w-36 rounded-full" />
          <Bone className="h-11 w-28 rounded-full" />
        </div>
      </div>
    </section>
  );
}

export function SearchResultsSkeleton() {
  return (
    <section aria-busy="true" aria-label="Loading search results">
      <Bone className="mb-8 h-9 w-56" />
      <SongCardSkeletonGrid count={10} />
    </section>
  );
}

export function PlayerBarSkeleton() {
  return (
    <div className="flex items-center gap-4 px-4" aria-hidden>
      <Bone className="h-14 w-14 shrink-0 rounded-xl md:h-16 md:w-16" />
      <div className="min-w-0 flex-1 space-y-2">
        <Bone className="h-4 w-40" />
        <Bone className="h-3 w-24" />
      </div>
    </div>
  );
}
