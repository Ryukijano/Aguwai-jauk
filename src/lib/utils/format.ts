export const formatSalary = (amount: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
};

export const formatLocation = (city: string, district: string): string => {
  return `${city}, ${district}`;
};