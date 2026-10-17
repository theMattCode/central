export function ErrorMessage({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="col-span-full rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300"
    >
      {message}
    </div>
  );
}
