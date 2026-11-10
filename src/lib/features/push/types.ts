export interface PushConfig {
  enabled: boolean;
  publicKey: string | null;
}

export interface PushSubscriptionRecord {
  id: number;
  enabled: boolean;
}

export interface PushSubscriptionPayload {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export type PushState =
  | "checking"
  | "unsupported"
  | "backendDisabled"
  | "denied"
  | "prompt"
  | "enabled";
