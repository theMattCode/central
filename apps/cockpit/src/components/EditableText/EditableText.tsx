import { type HTMLAttributes, useCallback, useState } from 'react';
import { MdCheck as CheckIcon } from 'react-icons/md';
import { Button } from '@/components/Button/Button.tsx';
import { cx } from '@/utils/styles.ts';

type Props = {
  slots?: {
    text?: HTMLAttributes<HTMLSpanElement>['className'];
    input?: HTMLAttributes<HTMLInputElement>['className'];
  };
  value: string;
  initialEditing: boolean;
  onChange: (value: string) => void;
};

export function EditableText({ value, initialEditing, slots }: Props) {
  const [isEditing, setIsEditing] = useState(initialEditing);
  const activateEditing = useCallback(() => setIsEditing(true), []);
  const deactivateEditing = useCallback(() => setIsEditing(false), []);

  if (isEditing) {
    return (
      <span className="w-full flex items-center gap-2">
        {value}
        <Button icon={CheckIcon} onClick={deactivateEditing} shape="square" inline={true} />
      </span>
    );
  }

  return (
    <span
      className={cx(
        'group inline-flex items-center gap-2 wrap-break-word underline underline-offset-4 decoration-dotted',
        slots?.input,
      )}
      onClick={activateEditing}
    >
      {value}
    </span>
  );
}
