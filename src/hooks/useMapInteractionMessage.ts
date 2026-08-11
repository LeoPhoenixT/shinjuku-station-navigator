import { useEffect, useState } from 'react';

export function useMapInteractionMessage(timeoutMilliseconds = 3200) {
  const [message, setMessage] = useState<string>();

  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(() => setMessage(undefined), timeoutMilliseconds);
    return () => window.clearTimeout(timeout);
  }, [message, timeoutMilliseconds]);

  return {
    interactionMessage: message,
    setInteractionMessage: setMessage,
    clearInteractionMessage: () => setMessage(undefined),
  };
}
