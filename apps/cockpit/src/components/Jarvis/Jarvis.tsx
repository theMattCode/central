import './jarvis.css';
import { cx } from '@/utils/styles.ts';

export function Jarvis() {
  return (
    <div className="relative w-full h-full">
      <Circle className="outermost" />
      <Circle className="outer" />
      <Circle className="middle" />
      <Circle className="middle2" />
      <Circle className="middle3" />
      <Circle className="inner" />
      <Circle className="innermost3" />
      <Circle className="innermost2" />
      <Circle className="innermost" />
    </div>
  );
}

function Circle({ className }: { className: string }) {
  return <div className={cx('rounded-[50%] absolute top-1/2 left-1/2 -translate-1/2', className)} />;
}
