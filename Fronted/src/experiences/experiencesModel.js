export const adaptExperienceResponse = (experience) => {
  return {
    ...experience,
    id: experience.id,
    name: experience.name,
    capacity: experience.capacity,
    status: experience.status,
  };
};

export const adaptParticipationResponse = (participation) => {
  return {
    ...participation,
    id: participation.id,
    experienceId: participation.experienceId,
    stayId: participation.stayId,
    status: participation.status,
    peopleCount: participation.peopleCount,
  };
};
