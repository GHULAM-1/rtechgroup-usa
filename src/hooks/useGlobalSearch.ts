import { useState, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { searchService, SearchResults } from "@/lib/searchService";

export const useGlobalSearch = () => {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Search query
  const {
    data: results,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["global-search", debouncedQuery],
    queryFn: () => searchService.searchAll(debouncedQuery),
    enabled: debouncedQuery.length > 0,
    staleTime: 30000, // 30 seconds
  });

  const openSearch = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeSearch = useCallback(() => {
    setIsOpen(false);
    setQuery("");
    setDebouncedQuery("");
  }, []);

  const clearSearch = useCallback(() => {
    setQuery("");
    setDebouncedQuery("");
  }, []);

  // Get total results count
  const totalResults = results
    ? Object.values(results).reduce((total, categoryResults) => total + categoryResults.length, 0)
    : 0;

  // Get flattened results for navigation
  const allResults = results
    ? [
        ...results.customers,
        ...results.vehicles,
        ...results.rentals,
        ...results.fines,
        ...results.payments,
        ...results.plates,
      ]
    : [];

  return {
    query,
    setQuery,
    results: results || {
      customers: [],
      vehicles: [],
      rentals: [],
      fines: [],
      payments: [],
      plates: [],
    },
    isLoading,
    error,
    isOpen,
    openSearch,
    closeSearch,
    clearSearch,
    totalResults,
    allResults,
    hasQuery: debouncedQuery.length > 0,
  };
};