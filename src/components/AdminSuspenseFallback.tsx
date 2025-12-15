import { Skeleton } from '@/components/ui/skeleton';
export function AdminSuspenseFallback() {
  return (
    <div className="p-8">
      <Skeleton className="h-12 w-1/3 mb-8" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}