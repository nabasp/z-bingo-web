/*
 * Waived for the debounce effect below. The rule assumes an effect that writes
 * state is deriving it from props, and would have you compute it during render
 * — but a debounced network search is a genuine external side effect whose
 * in-flight and settled states cannot be derived from the query alone.
 */
/* eslint-disable react-hooks/set-state-in-effect */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSocial } from '../context';
import type { PublicUser } from '../types';
import type { SearchRelation } from '../components/SearchResultRow';

/** Wait for typing to settle before querying. */
const DEBOUNCE_MS = 300;

/** Matches the server's minimum — below this it returns nothing anyway. */
const MIN_LENGTH = 2;

/**
 * Handle search, debounced.
 *
 * Debouncing is a courtesy to the server and a necessity for the listener:
 * without it every keystroke replaces the result list, and a screen reader
 * announcing a live region would restart mid-sentence on each one.
 */
export function useFriendSearch() {
  const { search, friends, requests, sendRequest } = useSocial();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PublicUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  // Guards against an earlier, slower response overwriting a later one.
  const latest = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_LENGTH) {
      setResults([]);
      setSearched(false);
      setSearching(false);
      return;
    }

    setSearching(true);
    const token = ++latest.current;
    const timer = setTimeout(async () => {
      const found = await search(trimmed);
      if (token !== latest.current) return;
      setResults(found);
      setSearching(false);
      setSearched(true);
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query, search]);

  /** How an existing relationship should be described on a result row. */
  const relationOf = useCallback(
    (userId: string): SearchRelation => {
      if (friends.some(f => f.id === userId)) return 'friend';
      const request = requests.find(r => r.user.id === userId);
      if (!request) return 'none';
      return request.direction;
    },
    [friends, requests],
  );

  const add = useCallback(
    async (userId: string) => {
      await sendRequest(userId);
      // The row stays, now reading "Request already sent" — removing it would
      // leave the listener unsure whether the action worked.
    },
    [sendRequest],
  );

  return {
    query,
    setQuery,
    results,
    searching,
    /** True once a query has run and come back — distinguishes "none" from "not yet". */
    searched,
    relationOf,
    add,
    minLength: MIN_LENGTH,
  };
}
