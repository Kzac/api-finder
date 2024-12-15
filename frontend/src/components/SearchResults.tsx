import React from 'react';

interface Business {
  name: string;
  address: string;
  phone?: string;
  website?: string;
  rating?: number;
  total_ratings?: number;
  alreadyExported?: boolean;
}

interface SearchResultsProps {
  results: Business[] | undefined;
}

export const SearchResults: React.FC<SearchResultsProps> = ({ results }) => {
  if (!results || !Array.isArray(results) || results.length === 0) {
    return null;
  }

  return (
    <div className="mt-8">
      <div className="text-gray-700 mb-4">
        {results.length} résultat(s) trouvé(s)
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {results.map((business, index) => (
          <div 
            key={index} 
            className={`bg-white p-4 rounded-lg shadow relative ${
              business.alreadyExported ? 'border-2 border-yellow-400' : ''
            }`}
          >
            {business.alreadyExported && (
              <div className="absolute top-2 right-2 bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs">
                Déjà dans Notion
              </div>
            )}
            <h3 className="text-lg font-semibold text-gray-800 mb-2">{business.name}</h3>
            <p className="text-gray-600 mb-2">{business.address}</p>
            {business.phone && (
              <p className="text-gray-600 mb-2">
                <a href={`tel:${business.phone}`} className="hover:text-blue-600">
                  📞 {business.phone}
                </a>
              </p>
            )}
            {business.rating && (
              <p className="text-gray-600 mb-2">
                ⭐ {business.rating}/5 ({business.total_ratings} avis)
              </p>
            )}
            {business.website && (
              <a 
                href={business.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800"
              >
                🌐 Site web
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default SearchResults; 