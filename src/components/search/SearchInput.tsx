import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { JobFilters } from '../../types/job';
import { Select } from '../ui/Select';
import { SUBJECTS, DISTRICTS } from '../../lib/constants';
import { useLangChain } from '../../hooks/useLangChain';
import { useLangGraph } from '../../hooks/useLangGraph';

interface SearchInputProps {
  onSearch: (filters: Partial<JobFilters>) => void;
}

export function SearchInput({ onSearch }: SearchInputProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [location, setLocation] = useState('');
  const [subject, setSubject] = useState('');
  const { processNaturalLanguageQuery } = useLangChain();
  const { visualizeSearchResults } = useLangGraph();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const filters = {
      search: searchTerm,
      location,
      subject
    };
    const processedFilters = await processNaturalLanguageQuery(filters);
    onSearch(processedFilters);
    visualizeSearchResults(processedFilters);
  };

  return (
    <form onSubmit={handleSubmit} className="relative">
      <div className="flex flex-col md:flex-row gap-4 bg-white p-2 rounded-lg shadow-lg">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search for teaching jobs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 rounded-md border-0 focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <Select
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          options={DISTRICTS}
          placeholder="Select District"
          className="md:w-48"
        />

        <Select
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          options={SUBJECTS}
          placeholder="Select Subject"
          className="md:w-48"
        />

        <button
          type="submit"
          className="w-full md:w-auto px-6 py-3 bg-indigo-600 text-white font-medium rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          Search Jobs
        </button>
      </div>
    </form>
  );
}
