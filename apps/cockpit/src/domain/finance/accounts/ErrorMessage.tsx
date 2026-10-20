export function ErrorMessage(props: { message: string }) {
  return (
    <div
      role="alert"
      class="col-span-full rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300"
    >
      {props.message}
    </div>
  );
}
