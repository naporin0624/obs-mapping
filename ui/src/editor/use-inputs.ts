import { useCallback, useEffect, useState } from 'react';
import type { ObsClient } from '../obs/client';

/** OBS input names that can be assigned to a surface (loaded when online, refreshable). */
export const useInputs = (client: ObsClient, online: boolean): { inputs: string[]; reload: () => void } => {
  const [inputs, setInputs] = useState<string[]>([]);
  const reload = useCallback(() => {
    void (async () => {
      setInputs(await client.listInputs());
    })();
  }, [client]);

  useEffect(() => {
    if (online) reload();
  }, [online, reload]);

  return { inputs, reload };
};
