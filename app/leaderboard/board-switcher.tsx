"use client";

import { useRef } from "react";
import type { BoardConfig, BoardKey } from "../data";

/**
 * Switches between partner leaderboards.
 *
 * Built as a WAI-ARIA tablist rather than a row of buttons: the panels below
 * are alternate views of the same thing, so arrow keys must move between them
 * and only the active tab should be in the tab order. Screen readers then
 * announce "tab 2 of 2" instead of two unrelated buttons.
 */
export function BoardSwitcher({
  boards,
  active,
  onSelect,
}: {
  boards: readonly BoardConfig[];
  active: BoardKey;
  onSelect: (key: BoardKey) => void;
}) {
  const tabs = useRef<Array<HTMLButtonElement | null>>([]);

  // One board is not a choice; rendering a switcher for it is noise.
  if (boards.length < 2) return null;

  function onKeyDown(event: React.KeyboardEvent, index: number) {
    const last = boards.length - 1;
    let next: number | null = null;

    if (event.key === "ArrowRight") next = index === last ? 0 : index + 1;
    if (event.key === "ArrowLeft") next = index === 0 ? last : index - 1;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = last;
    if (next === null) return;

    event.preventDefault();
    onSelect(boards[next].key);
    // Follow focus, which is what the tab pattern expects when selection
    // moves automatically.
    tabs.current[next]?.focus();
  }

  return (
    <div className="boardSwitch">
      <p className="boardSwitchLabel" id="board-switch-label">
        Switch between <strong>{boards.length}</strong> leaderboards
      </p>
      <div className="boardSwitchTabs" role="tablist" aria-labelledby="board-switch-label">
        {boards.map((board, index) => {
          const selected = board.key === active;
          return (
            <button
              type="button"
              role="tab"
              key={board.key}
              id={`board-tab-${board.key}`}
              aria-selected={selected}
              aria-controls={`board-panel-${board.key}`}
              // Only the active tab is reachable by Tab; arrows move within.
              tabIndex={selected ? 0 : -1}
              ref={(node) => {
                tabs.current[index] = node;
              }}
              className={`boardTab${selected ? " isActive" : ""}`}
              onClick={() => onSelect(board.key)}
              onKeyDown={(event) => onKeyDown(event, index)}
            >
              {board.logo ? (
                <img src={board.logo} alt={board.name} />
              ) : (
                <span className="boardTabName">{board.name}</span>
              )}
              <span className="boardTabPool">{board.pool}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
