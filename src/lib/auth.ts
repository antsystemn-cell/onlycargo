import { supabase } from "@/integrations/supabase/client";

// Convert phone number to email format for Supabase auth
export function phoneToEmail(phone: string): string {
  // Remove any non-digit characters
  const cleanPhone = phone.replace(/\D/g, '');
  return `${cleanPhone}@cargo.local`;
}

// Extract phone from email format
export function emailToPhone(email: string): string {
  return email.split('@')[0];
}

// Validate Mongolian phone number (8 digits starting with 8, 9, 7, or 6)
export function isValidMongolianPhone(phone: string): boolean {
  const cleanPhone = phone.replace(/\D/g, '');
  return /^[6-9]\d{7}$/.test(cleanPhone);
}

export async function signUp(phone: string, password: string) {
  const email = phoneToEmail(phone);
  const redirectUrl = `${window.location.origin}/`;
  
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: redirectUrl
    }
  });
  
  return { data, error };
}

export async function signIn(phone: string, password: string) {
  const email = phoneToEmail(phone);
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  
  return { data, error };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function isUserAdmin(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .eq('role', 'admin')
    .maybeSingle();
  
  return !error && data !== null;
}
