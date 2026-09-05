import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth/authContext.js';
import { useActionPermission } from '../components/auth/useActionPermission.js';
import { fetchExperiences, registerParticipation, fetchParticipations } from './experiencesClient.js';
import { adaptExperienceResponse, adaptParticipationResponse } from './experiencesModel.js';

export function useExperiences() {
  const { account, status: authStatus } = useAuth();
  const canReadExperiences = useActionPermission('ACCESS_SELL'); // Or any basic read permission
  const [experiences, setExperiences] = useState({ data: [], status: 'idle', error: null });
  const [participations, setParticipations] = useState({ data: [], status: 'idle', error: null });

  const loadExperiences = useCallback(async (controller) => {
    setExperiences(prev => ({ ...prev, status: 'loading', error: null }));
    try {
      const res = await fetchExperiences(account.propertyId, controller.signal);
      const data = res.map(adaptExperienceResponse);
      setExperiences({ data, status: 'ready', error: null });
    } catch (err) {
      if (err.name === 'AbortError') return;
      setExperiences(prev => ({ ...prev, status: 'error', error: err.message }));
    }
  }, [account?.propertyId]);

  const loadParticipations = useCallback(async (experienceId, controller) => {
    setParticipations(prev => ({ ...prev, status: 'loading', error: null }));
    try {
      const res = await fetchParticipations(account.propertyId, experienceId, controller.signal);
      const data = res.map(adaptParticipationResponse);
      setParticipations({ data, status: 'ready', error: null });
    } catch (err) {
      if (err.name === 'AbortError') return;
      setParticipations(prev => ({ ...prev, status: 'error', error: err.message }));
    }
  }, [account?.propertyId]);

  useEffect(() => {
    if (authStatus !== 'authenticated' || !account?.id || !account?.propertyId || !canReadExperiences) {
      setExperiences({ data: [], status: 'idle', error: null });
      return;
    }
    const controller = new AbortController();
    loadExperiences(controller);
    return () => controller.abort();
  }, [account?.id, account?.propertyId, authStatus, canReadExperiences, loadExperiences]);

  const handleRegisterParticipation = async (experienceId, payload) => {
    const res = await registerParticipation(account.propertyId, experienceId, payload);
    const adapted = adaptParticipationResponse(res);
    setParticipations(prev => ({ ...prev, data: [...prev.data, adapted] }));
    return adapted;
  };

  return {
    experiences,
    participations,
    loadExperiences,
    loadParticipations,
    handleRegisterParticipation
  };
}
