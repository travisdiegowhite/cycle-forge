import { useState, useRef, useEffect } from 'react';
import { Search, MapPin, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface SearchResult {
  id: string;
  place_name: string;
  center: [number, number];
  place_type: string[];
  properties: {
    category?: string;
  };
}

interface PlaceSearchProps {
  onPlaceSelect: (place: SearchResult) => void;
  mapboxToken: string;
  proximity?: [number, number]; // [longitude, latitude] for biasing results
  country?: string; // ISO 3166-1 alpha-2 country code (e.g., 'us', 'ca')
}

export const PlaceSearch = ({ onPlaceSelect, mapboxToken, proximity, country }: PlaceSearchProps) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();
  const searchRef = useRef<HTMLDivElement>(null);

  const searchPlaces = async (searchQuery: string) => {
    if (!searchQuery.trim() || !mapboxToken) return;

    setIsLoading(true);
    try {
      // Build query parameters
      const params = new URLSearchParams({
        access_token: mapboxToken,
        types: 'poi', // Focus only on points of interest (businesses, landmarks)
        limit: '8'
      });
      
      // Add proximity bias if provided (helps localize results)
      if (proximity) {
        params.append('proximity', `${proximity[0]},${proximity[1]}`);
        
        // Add a tight bounding box around the proximity point (roughly 10km radius)
        const lat = proximity[1];
        const lng = proximity[0];
        const offset = 0.09; // ~10km in degrees
        const bbox = [lng - offset, lat - offset, lng + offset, lat + offset];
        params.append('bbox', bbox.join(','));
      }
      
      // Add country filter if provided
      if (country) {
        params.append('country', country);
      }

      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          searchQuery
        )}.json?${params.toString()}`
      );
      
      if (response.ok) {
        const data = await response.json();
        setResults(data.features || []);
        setShowResults(true);
      }
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (value: string) => {
    setQuery(value);
    
    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Set new timeout for search
    if (value.trim()) {
      searchTimeoutRef.current = setTimeout(() => {
        searchPlaces(value);
      }, 300);
    } else {
      setResults([]);
      setShowResults(false);
    }
  };

  const handlePlaceSelect = (place: SearchResult) => {
    onPlaceSelect(place);
    setQuery('');
    setResults([]);
    setShowResults(false);
  };

  // Close results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getPlaceIcon = (placeType: string[]) => {
    if (placeType.includes('poi')) return '📍';
    if (placeType.includes('address')) return '🏠';
    if (placeType.includes('place')) return '🏙️';
    return '📌';
  };

  return (
    <div ref={searchRef} className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search for places..."
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          className="pl-10 pr-10 bg-background/10 backdrop-blur-md border-white/20 text-foreground placeholder:text-muted-foreground"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      {showResults && results.length > 0 && (
        <Card className="absolute top-full mt-2 w-full max-h-80 overflow-y-auto bg-background/95 backdrop-blur-md border-white/20 z-50">
          <div className="p-2">
            {results.map((place) => (
              <Button
                key={place.id}
                variant="ghost"
                className="w-full justify-start p-3 h-auto text-left hover:bg-accent/50"
                onClick={() => handlePlaceSelect(place)}
              >
                <div className="flex items-start gap-3 w-full">
                  <span className="text-lg mt-0.5">{getPlaceIcon(place.place_type)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-foreground truncate">
                      {place.place_name.split(',')[0]}
                    </div>
                    <div className="text-sm text-muted-foreground truncate">
                      {place.place_name.split(',').slice(1).join(',').trim()}
                    </div>
                    {place.place_type.length > 0 && (
                      <div className="text-xs text-muted-foreground mt-1">
                        {place.place_type.join(', ')}
                      </div>
                    )}
                  </div>
                  <MapPin className="h-4 w-4 text-primary mt-1 flex-shrink-0" />
                </div>
              </Button>
            ))}
          </div>
        </Card>
      )}

      {showResults && results.length === 0 && !isLoading && query.trim() && (
        <Card className="absolute top-full mt-2 w-full bg-background/95 backdrop-blur-md border-white/20 z-50">
          <div className="p-4 text-center text-muted-foreground">
            No places found for "{query}"
          </div>
        </Card>
      )}
    </div>
  );
};