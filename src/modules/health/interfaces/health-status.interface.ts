export interface HealthStatus {
  status: 'ok';
  /** Seconds since the process started */
  uptime: number;
  /** ISO 8601 timestamp in UTC */
  timestamp: string;
}
