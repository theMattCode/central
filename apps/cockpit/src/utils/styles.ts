export function cx(...classNames: (string | undefined)[]): string {
  return classNames.filter((value) => value && value.length > 0).join(' ');
}
