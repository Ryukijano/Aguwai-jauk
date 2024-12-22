export interface School {
  id: string;
  name: string;
  type: 'government' | 'private';
  location: {
    city: string;
    district: string;
    address: string;
  };
  contact: {
    email: string;
    phone: string;
    website?: string;
  };
  details: {
    establishedYear: number;
    accreditation?: string;
    facilities: string[];
  };
}