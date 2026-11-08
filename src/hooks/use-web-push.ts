"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api";
import { pushApi } from "@/lib/features/push/api";
import type { PushState } from "@/lib/features/push/types";
import {
  pushSupported,
  readLocalSubscriptionId,
  registerServiceWorker,
  serializeSubscription,
  urlBase64ToUint8Array,
  writeLocalSubscriptionId,
} from "@/lib/push";
import { useAuth } from "@/providers/auth-provider";

const TEST_COOLDOWN_MS = 60_000;

export function useWebPush() {
  const { agent } = useAuth();

  const userId = agent?.id ?? null;

  const [state, setState] = useState<PushState>("checking");

  const [publicKey, setPublicKey] = useState<string | null>(null);

  const [subscriptionId, setSubscriptionId] = useState<number | null>(null);

  const [busy, setBusy] = useState(false);

  const [cooldownUntil, setCooldownUntil] = useState(0);

  const [error, setError] = useState<string | null>(null);

  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;

    return () => {
      mounted.current = false;
    };
  }, []);

  /**
   * Startup / login reconciliation. Never prompts for permission — it only
   * reports the current state and re-registers an already granted subscription
   * so the backend points it at the account that just signed in.
   */
  const reconcile = useCallback(async () => {
    if (!userId) return;

    if (!pushSupported()) {
      setState("unsupported");

      return;
    }

    setState("checking");
    setError(null);

    try {
      const config = await pushApi.config();

      if (!mounted.current) return;

      if (!config.enabled || !config.publicKey) {
        setState("backendDisabled");

        return;
      }

      setPublicKey(config.publicKey);

      if (Notification.permission === "denied") {
        setState("denied");

        return;
      }

      if (Notification.permission !== "granted") {
        setState("prompt");

        return;
      }

      const registration = await registerServiceWorker();

      await navigator.serviceWorker.ready;

      const existing = await registration.pushManager.getSubscription();

      if (!existing) {
        writeLocalSubscriptionId(userId, null);

        if (!mounted.current) return;

        setSubscriptionId(null);
        setState("prompt");

        return;
      }

      const record = await pushApi.subscribe(serializeSubscription(existing));

      if (!mounted.current) return;

      writeLocalSubscriptionId(userId, record.id);
      setSubscriptionId(record.id);
      setState(record.enabled ? "enabled" : "prompt");
    } catch (err) {
      if (!mounted.current) return;

      if (err instanceof ApiError && err.status === 503) {
        setState("backendDisabled");

        return;
      }

      // 401 is handled by the shared refresh layer; anything else still lets
      // the user enable manually.
      setState("prompt");
      setError("push.errorGeneric");
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setState("checking");
      setSubscriptionId(null);

      return;
    }

    setSubscriptionId(readLocalSubscriptionId(userId));
    void reconcile();
  }, [userId, reconcile]);

  /** Must run from a user gesture — permission is never requested on load. */
  const enable = useCallback(async () => {
    if (!userId || busy) return;

    setBusy(true);
    setError(null);

    try {
      if (!pushSupported()) {
        setState("unsupported");

        return;
      }

      let key = publicKey;

      if (!key) {
        const config = await pushApi.config();

        if (!config.enabled || !config.publicKey) {
          setState("backendDisabled");

          return;
        }

        key = config.publicKey;
        setPublicKey(key);
      }

      const permission = await Notification.requestPermission();

      if (permission === "denied") {
        setState("denied");

        return;
      }

      if (permission !== "granted") {
        setState("prompt");

        return;
      }

      const registration = await registerServiceWorker();

      await navigator.serviceWorker.ready;

      const subscription =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(key),
        }));

      const record = await pushApi.subscribe(
        serializeSubscription(subscription),
      );

      if (!mounted.current) return;

      writeLocalSubscriptionId(userId, record.id);
      setSubscriptionId(record.id);
      setState("enabled");
    } catch (err) {
      if (!mounted.current) return;

      if (err instanceof ApiError && err.status === 503) {
        setState("backendDisabled");
      } else if (err instanceof ApiError && err.status === 400) {
        setError("push.errorTooMany");
      } else {
        setError("push.errorGeneric");
      }
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, [userId, busy, publicKey]);

  /** Disable server delivery first, then unsubscribe in the browser. */
  const disable = useCallback(async () => {
    if (!userId || busy) return;

    setBusy(true);
    setError(null);

    try {
      if (subscriptionId !== null) {
        try {
          await pushApi.unsubscribe(subscriptionId);
        } catch (err) {
          // 404 means it is already gone or owned elsewhere — safe to continue.
          if (!(err instanceof ApiError && err.status === 404)) throw err;
        }
      }

      const registration = await navigator.serviceWorker.getRegistration("/");

      const subscription = await registration?.pushManager.getSubscription();

      await subscription?.unsubscribe();

      writeLocalSubscriptionId(userId, null);

      if (!mounted.current) return;

      setSubscriptionId(null);
      setState("prompt");
    } catch {
      if (mounted.current) setError("push.errorGeneric");
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, [userId, busy, subscriptionId]);

  const sendTest = useCallback(async () => {
    if (subscriptionId === null || busy || Date.now() < cooldownUntil) return;

    setBusy(true);
    setError(null);

    try {
      await pushApi.test(subscriptionId);

      if (mounted.current) setCooldownUntil(Date.now() + TEST_COOLDOWN_MS);
    } catch (err) {
      if (!mounted.current) return;

      if (err instanceof ApiError && err.status === 429) {
        setCooldownUntil(Date.now() + TEST_COOLDOWN_MS);
        setError("push.errorCooldown");
      } else if (err instanceof ApiError && err.status === 404) {
        setError("push.errorGeneric");
        void reconcile();
      } else {
        setError("push.errorGeneric");
      }
    } finally {
      if (mounted.current) setBusy(false);
    }
  }, [subscriptionId, busy, cooldownUntil, reconcile]);

  return {
    state,
    busy,
    error,
    subscriptionId,
    cooldownUntil,
    enable,
    disable,
    sendTest,
    reconcile,
  };
}
