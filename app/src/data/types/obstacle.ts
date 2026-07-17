export interface UpdateTrailObstacleRequest {
  description?: string;
  issueType?: string;
}

export interface CreateTrailObstacleRequest {
  description: string;
  issueType: string;
  trailIdentifier: string;
  incidentLongitude: number | null;
  incidentLatitude: number | null;
}

export interface TrailObstacle {
  identifier: string;
  userIdentifier: string;
  description: string;
  issueType: string;
  incidentLongitude?: number;
  incidentLatitude?: number;
  createdAt: string;
  solvedVotes?: TrailObstacleSolvedVote[];
}

export interface TrailObstacleSolvedVote {
  userIdentifier: string;
  trailObstacleIdentifier: string;
}
