import type { WeatherLocation } from '@/domain/weather/model/model.ts';
import { MdOutlineLocation_on as LocationIcon, MdFillUpdate as UpdateIcon } from 'solid-icons/md';
import { getFormattedDate } from '@/utils/formatting.ts';

type Props = {
  location: WeatherLocation;
  isRefreshing: boolean;
  onRefresh: () => void;
};

export function Header(props: Props) {
  const locationUrl = () =>
    `https://www.google.com/maps?q=${props.location.latitude.toFixed(4)},${props.location.longitude.toFixed(4)}`;
  return (
    <header class="flex flex-col">
      <div class="flex flex-row items-center justify-between">
        <span class="text-lg">{props.location.label}</span>
        <button
          aria-label="Refresh weather"
          class="text-2xl px-2 py-1 hover:text-(--color-pri) disabled:opacity-50"
          disabled={props.isRefreshing}
          onClick={props.onRefresh}
          type="button"
        >
          <UpdateIcon />
        </button>
      </div>
      <div class="flex flex-row items-center justify-between text-(--color-txt-sec) text-xs">
        <div class="flex flex-row items-center gap-1">
          <LocationIcon />
          <a href={locationUrl()} target="_blank">
            {props.location.latitude.toFixed(4)}, {props.location.longitude.toFixed(4)}
          </a>
        </div>
        <span class="text-(--color-txt-sec)">{getFormattedDate()}</span>
      </div>
    </header>
  );
}
