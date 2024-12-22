import React from 'react';

export function StatsSection() {
  const stats = [
    {
      label: 'Active Teaching Positions',
      value: '1,000+',
      description: 'Open positions across Assam'
    },
    {
      label: 'Registered Schools',
      value: '500+',
      description: 'Verified institutions'
    },
    {
      label: 'Successful Placements',
      value: '5,000+',
      description: 'Teachers placed in 2023'
    },
    {
      label: 'Average Salary',
      value: '₹4.2L',
      description: 'Annual package'
    }
  ];

  return (
    <section className="bg-white">
      <div className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat, index) => (
            <div key={index} className="text-center">
              <div className="text-4xl font-extrabold text-indigo-600">
                {stat.value}
              </div>
              <div className="mt-2 text-lg font-medium text-gray-900">
                {stat.label}
              </div>
              <div className="mt-1 text-sm text-gray-500">
                {stat.description}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}