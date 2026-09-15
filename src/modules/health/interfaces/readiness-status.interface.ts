export interface ReadinessStatus {
  status: 'ok' | 'error';
  database: 'up' | 'down';
}
