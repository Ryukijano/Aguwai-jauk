import { supabase } from '../supabase/client';
import { School } from '../../types';

export async function getSchools(): Promise<School[]> {
  const { data, error } = await supabase
    .from('schools')
    .select('*')
    .order('name');

  if (error) {
    console.error('Error fetching schools:', error);
    return [];
  }

  return data;
}

export async function getSchoolById(id: string): Promise<School | null> {
  const { data, error } = await supabase
    .from('schools')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching school:', error);
    return null;
  }

  return data;
}