import { cx } from '@/utils/styles.ts';
import { useState } from 'react';
import * as React from 'react';
import type { IconType } from 'react-icons';

export type Option = {
  id: string;
  text: string;
  icon?: IconType;
  style: {
    optionColor: string;
  };
};

type Props = {
  defaultValue: Option;
  options: Option[];
  onChanged: (option: Option) => void;
};

export function ButtonGroup({ defaultValue, options, onChanged }: Props) {
  const [selected, setSelected] = useState(defaultValue);

  const handleSelect = (option: Option) => {
    setSelected(option);
    onChanged(option);
  };

  return (
    <div className="flex flex-row items-center" role="radiogroup">
      {options.map((option) => {
        const isSelected = option.id === selected.id;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={isSelected}
            style={
              {
                '--option-color': option.style.optionColor,
              } as React.CSSProperties
            }
            className={cx(
              'px-3 py-2 flex flex-row items-center gap-2',
              'transition-all duration-200',
              'border border-(--color-section-border) -ml-px first:ml-0 first:rounded-l-md last:rounded-r-md',
              'text-(--color-txt)',
              isSelected ? 'bg-(--option-color)' : 'hover:bg-(--option-color)/40',
            )}
            onClick={() => handleSelect(option)}
          >
            {option.icon && <option.icon className="h-5 w-5" />}
            {option.text}
          </button>
        );
      })}
    </div>
  );
}
