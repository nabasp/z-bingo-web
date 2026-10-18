import { useContext } from 'react';
import { SocialContext, type SocialValue } from './socialContext';

/** Access the friends list, requests and live invitations. */
export function useSocial(): SocialValue {
  const ctx = useContext(SocialContext);
  if (!ctx) {
    throw new Error('useSocial must be used within a SocialProvider');
  }
  return ctx;
}
