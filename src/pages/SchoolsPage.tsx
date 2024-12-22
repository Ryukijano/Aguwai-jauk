import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSchools } from '../lib/api/schools';

export default function SchoolsPage() {
  const { data: schools, isLoading } = useQuery({
    queryKey: ['schools'],
    queryFn: getSchools
  });

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Loading schools...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Schools in Assam</h1>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {schools?.map((school) => (
          <div key={school.id} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">{school.name}</h3>
            <p className="text-gray-600 mt-2">{school.type}</p>
            <p className="text-gray-600 mt-1">{school.location.city}, {school.location.district}</p>
          </div>
        ))}
      </div>
    </div>
  );
}