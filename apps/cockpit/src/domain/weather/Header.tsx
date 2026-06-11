import type { WeatherDataLoaded, WeatherLocation } from '@/domain/weather/model/model.ts';
import { MdOutlineLocationOn as LocationIcon, MdUpdate as UpdateIcon } from 'react-icons/md';
import { getFormattedDate } from '@/utils/formatting.ts';

type Props = {
  location: WeatherLocation;
  data: WeatherDataLoaded;
};

export function Header({ location: { label, latitude, longitude }, data }: Props) {
  const locationUrl = `https://www.google.com/maps?q=${latitude.toFixed(4)},${longitude.toFixed(4)}`;
  return (
    <header className="flex flex-col">
      <div className="flex flex-row items-center justify-between">
        <span className="text-lg">{label}</span>
        <button className="text-2xl px-2 py-1 hover:text-(--color-pri)" onClick={data.refresh} type="button">
          <UpdateIcon />
        </button>
      </div>
      <div className="flex flex-row items-center justify-between text-(--color-txt-sec) text-xs">
        <div className="flex flex-row items-center gap-1">
          <LocationIcon />
          <a href={locationUrl} target="_blank">
            {latitude.toFixed(4)}, {longitude.toFixed(4)}
          </a>
        </div>
        <span className="text-(--color-txt-sec)">{getFormattedDate()}</span>
      </div>
    </header>
  );
}
