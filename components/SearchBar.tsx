import React, { useState, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { searchCities } from "../utils/geocoding";

interface CityRecord {
  name: string;
  country?: string;
  lat: number;
  lon: number;
  population?: number;
}

interface SearchBarProps {
  onLocationSelected: (
    city: string,
    country: string,
    population: number,
    lat: number,
    lng: number
  ) => void;
  placeholder?: string;
  className?: string;
  minQueryLength?: number;
  maxResults?: number;
}

const SearchIcon = () => (
  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

export default function SearchBar({
  onLocationSelected,
  placeholder = "Search for a city...",
  className = "",
  minQueryLength = 2,
  maxResults = 10
}: SearchBarProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CityRecord[]>([]);
  const [open, setOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  
  const inputRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    return () => { 
      if (debounceRef.current) window.clearTimeout(debounceRef.current); 
    };
  }, []);


  const doSearch = useCallback(async (q: string) => {
    console.log('SearchBar: doSearch called with:', q);
    if (!q || q.trim().length < minQueryLength) { 
      console.log('SearchBar: Query too short, closing dropdown');
      setResults([]); 
      setOpen(false); 
      return; 
    }
    
    console.log('SearchBar: Starting search...');
    setIsLoading(true);
    try {
      const res = await searchCities(q, 50);
      console.log('SearchBar: Search results:', res.length);
      setResults(res.slice(0, maxResults));
      setOpen(true);
      setSelectedIndex(-1);
      console.log('SearchBar: Dropdown should be open now, open:', true, 'results.length:', res.slice(0, maxResults).length);
    } catch (error) {
      console.error("Search error:", error);
      setResults([]);
      setOpen(false);
    } finally {
      setIsLoading(false);
    }
  }, [minQueryLength, maxResults]);

  const onChange = (v: string) => {
    setQuery(v);
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => doSearch(v), 300);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || results.length === 0) {
      if (e.key === 'Enter' && results.length > 0) {
        select(results[0]);
      }
      return;
    }
    
    if (e.key === 'ArrowDown') { 
      e.preventDefault(); 
      setSelectedIndex(i => Math.min(i + 1, results.length - 1)); 
    }
    if (e.key === 'ArrowUp') { 
      e.preventDefault(); 
      setSelectedIndex(i => Math.max(i - 1, 0)); 
    }
    if (e.key === 'Enter') { 
      e.preventDefault(); 
      if (selectedIndex >= 0) select(results[selectedIndex]); 
      else if (results.length > 0) select(results[0]); 
    }
    if (e.key === 'Escape') { 
      setOpen(false); 
    }
  };

  useEffect(() => {
    if (selectedIndex >= 0) {
      const el = document.getElementById(`search-result-${selectedIndex}`);
      if (el) el.scrollIntoView({ block: "nearest" });
    }
  }, [selectedIndex]);

  const select = (city: CityRecord) => {
    setQuery(city.name);
    setOpen(false);
    setResults([]);
    onLocationSelected(city.name, city.country || '', city.population || 0, city.lat, city.lon);
  };

  // Click outside closes dropdown
  useEffect(() => {
    if (!open) return;
    
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  return (
    <div ref={containerRef} className={`relative ${className}`} style={{ overflow: 'visible' }}>
      <div className="relative">
        <input
          ref={inputRef}
          id="city-search-input"
          type="text"
          value={query}
          onChange={e => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => { 
            if (results.length > 0) {
              setOpen(true);
            }
          }}
          placeholder={placeholder}
          aria-autocomplete="list"
          aria-expanded={open}
          className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 pl-10 pr-10 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          autoComplete="off"
        />
        <div className="absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
          <SearchIcon />
        </div>

        {isLoading && (
          <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500" aria-hidden />
          </div>
        )}
      </div>

      {open && results.length > 0 && (
        <div 
          className="absolute top-full left-0 right-0 mt-2 bg-gray-800 border border-gray-600 rounded-lg shadow-lg max-h-64 overflow-y-auto"
          style={{ 
            zIndex: 10000,
            position: 'absolute'
          }}
        >
          {results.map((c, i) => (
            <div
              id={`search-result-${i}`}
              key={`${c.lat}-${c.lon}-${c.name}`}
              onClick={() => select(c)}
              className={`px-3 py-2 cursor-pointer transition-colors ${
                i === selectedIndex 
                  ? 'bg-gray-700 text-white' 
                  : 'text-gray-300 hover:bg-gray-700'
              }`}
              onMouseEnter={() => setSelectedIndex(i)}
            >
              <div className="font-semibold text-sm">{c.name}</div>
              <div className="text-xs text-gray-400">
                {c.country || ''}
              </div>
            </div>
          ))}
          {results.length === 0 && !isLoading && (
            <div className="px-3 py-2 text-gray-400 text-sm">No results found</div>
          )}
        </div>
      )}
    </div>
  );
}