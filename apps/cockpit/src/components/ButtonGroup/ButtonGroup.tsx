import { createSignal, For, untrack } from 'solid-js';
import type { IconTypes } from 'solid-icons';
import { Icon } from '@/components/Icon/Icon.tsx';

export type Option = {
  id: string;
  text: string;
  icon?: IconTypes;
  style: {
    optionColor: string;
  };
};

type Props = {
  defaultValue: Option;
  value?: Option;
  options: Option[];
  onChanged: (option: Option) => void;
};

export function ButtonGroup(props: Props) {
  const [internalValue, setInternalValue] = createSignal(untrack(() => props.defaultValue));
  const selected = () => props.value ?? internalValue();

  const handleSelect = (option: Option) => {
    if (props.value === undefined) {
      setInternalValue(option);
    }
    props.onChanged(option);
  };

  return (
    <div class="flex flex-row items-center" role="radiogroup">
      <For each={props.options}>
        {(option) => {
          const isSelected = () => option.id === selected().id;
          return (
            <button
              type="button"
              role="radio"
              aria-checked={isSelected() ? 'true' : 'false'}
              style={{ '--option-color': option.style.optionColor }}
              class={[
                'px-3 py-2 flex flex-row items-center gap-2 transition-all duration-200 glass-control first:rounded-l-md last:rounded-r-md text-(--color-txt)',
                {
                  'border-(--option-color)': isSelected(),
                  'hover:border-(--option-color)/40': !isSelected(),
                },
              ]}
              onClick={() => handleSelect(option)}
            >
              {option.icon && (
                <Icon
                  icon={option.icon}
                  class={[
                    'h-5 w-5',
                    {
                      'text-(--option-color)': isSelected(),
                      'hover:text-(--option-color)/40': !isSelected(),
                    },
                  ]}
                />
              )}
              {option.text}
            </button>
          );
        }}
      </For>
    </div>
  );
}
