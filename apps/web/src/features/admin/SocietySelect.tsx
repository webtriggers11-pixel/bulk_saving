import { useEffect, useState, type ChangeEvent } from 'react';
import { Input } from '../../components/ui/input';
import { Select } from '../../components/ui/select';
import { ShowMore } from '../../components/ui/show-more';
import { useAdminSocieties, useAdminSociety } from './useAdmin';

/** One page of options at a time: the most a native select stays usable with (FEAT-044). */
export const SOCIETY_PICKER_PAGE = 50;
const DEBOUNCE_MS = 300;

interface SocietySelectProps {
  value: string;
  onChange: (societyId: string) => void;
  /** The empty option's text: "All societies", "Select a society"… */
  emptyLabel: string;
  /** Names the search box, so two pickers on a page aren't announced alike (V2 P3-3). Default "Search societies". */
  searchLabel?: string;
  /** From `Field`: id and aria wiring for the select. */
  id: string;
  'aria-invalid'?: true;
  'aria-describedby'?: string;
  disabled?: boolean;
  /** Makes the empty option unselectable (a required choice). */
  emptyDisabled?: boolean;
}

/**
 * A society picker that scales (FEAT-044, ADR-0035). The societies list is paged on the
 * server, so a picker can't load them all. It shows the first 50 by name, with a search box
 * once there are more than that (name, city or PIN code; it stays once shown) and a "Show more"
 * button under the select (V2 P3-2: an option that loads would fire on every arrow key). A
 * chosen society that isn't on a loaded page is still shown, fetched by id.
 */
export function SocietySelect({ value, onChange, emptyLabel, searchLabel = 'Search societies', id, disabled, emptyDisabled, ...aria }: SocietySelectProps) {
  const [text, setText] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setQ(text.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [text]);

  const societies = useAdminSocieties(q ? { q } : {}, SOCIETY_PICKER_PAGE);
  const loaded = societies.data ?? [];
  const chosenLoaded = value === '' || loaded.some((s) => s.id === value);
  const chosen = useAdminSociety(chosenLoaded ? '' : value);
  // Sticky (V2 P3-1): once shown, the box stays even when a search narrows the list.
  const [searchable, setSearchable] = useState(false);
  useEffect(() => {
    if ((societies.total ?? 0) > SOCIETY_PICKER_PAGE) setSearchable(true);
  }, [societies.total]);

  function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    onChange(event.target.value);
  }

  return (
    <div className="flex flex-col gap-2">
      {searchable && (
        <Input
          id={`${id}-search`}
          type="search"
          aria-label={searchLabel}
          placeholder="Search by name, city or PIN code"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={disabled}
        />
      )}
      <Select id={id} value={value} onChange={handleChange} disabled={disabled} {...aria}>
        <option value="" disabled={emptyDisabled}>
          {emptyLabel}
        </option>
        {!chosenLoaded && chosen.data && <option value={chosen.data.id}>{chosen.data.name}</option>}
        {loaded.map((society) => (
          <option key={society.id} value={society.id}>
            {society.name}
          </option>
        ))}
      </Select>
      <ShowMore
        hasMore={societies.hasMore}
        loaded={loaded.length}
        total={societies.total}
        busy={societies.loadingMore}
        onMore={societies.loadMore}
        noun={['society', 'societies']}
        pageSize={SOCIETY_PICKER_PAGE}
        data-testid={`${id}-more`}
      />
      {q !== '' && societies.total === 0 && (
        <p role="status" className="text-meta text-ink-muted">
          No society matches “{q}”.
        </p>
      )}
    </div>
  );
}
