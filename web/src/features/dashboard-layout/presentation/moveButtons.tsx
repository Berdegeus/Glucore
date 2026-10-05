import { useEffect, useRef, useState } from 'react';
import styles from './moveButtons.module.css';

export const MOVE_BEFORE_LABEL = 'Mover para antes';
export const MOVE_AFTER_LABEL = 'Mover para depois';

/** What a screen reader hears after a move: where the widget is now. */
export const movedAnnouncement = (title: string, position: number, count: number): string =>
  `${title} movido para a posição ${position} de ${count}`;

type Direction = -1 | 1;

interface MoveButtonsProps {
  /** Already resolved text of the widget, for the names and the announcement. */
  title: string;
  /** Where the widget is now (0 is first). */
  index: number;
  count: number;
  /** Called with the position the widget should take. */
  onMove(toIndex: number): void;
}

/**
 * "Mover para antes" and "Mover para depois" (LAY-05): the keyboard equivalent
 * of dragging, reachable with Tab and fired with Enter or Space. The move is
 * announced in an `aria-live="polite"` region. After a move the focus stays on
 * the button just used, or goes to the other one when that button reached the
 * end of the grid and turned off, so repeated presses never lose the place.
 */
export function MoveButtons({ title, index, count, onMove }: MoveButtonsProps) {
  const [announced, setAnnounced] = useState<{ index: number; text: string } | null>(null);
  const pending = useRef<Direction | null>(null);
  const before = useRef<HTMLButtonElement>(null);
  const after = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const direction = pending.current;
    pending.current = null;
    if (direction === null) return;
    const wanted = direction === -1 ? before.current : after.current;
    const other = direction === -1 ? after.current : before.current;
    (wanted?.disabled ? other : wanted)?.focus();
  }, [index]);

  function move(direction: Direction) {
    const target = index + direction;
    pending.current = direction;
    setAnnounced({ index: target, text: movedAnnouncement(title, target + 1, count) });
    onMove(target);
  }

  return (
    <span className={styles.group}>
      <button
        ref={before}
        type="button"
        className={styles.button}
        disabled={index <= 0}
        aria-label={`${MOVE_BEFORE_LABEL}: ${title}`}
        onClick={() => move(-1)}
      >
        {MOVE_BEFORE_LABEL}
      </button>
      <button
        ref={after}
        type="button"
        className={styles.button}
        disabled={index >= count - 1}
        aria-label={`${MOVE_AFTER_LABEL}: ${title}`}
        onClick={() => move(1)}
      >
        {MOVE_AFTER_LABEL}
      </button>
      {/* The text only counts while it is still true: a drag that moves the widget again clears it. */}
      <span className={styles.announcement} role="status" aria-live="polite">
        {announced?.index === index ? announced.text : ''}
      </span>
    </span>
  );
}
