export function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-10 h-10 border-4 border-primary-200 border-t-primary-500 rounded-full animate-spin" />
    </div>
  );
}
