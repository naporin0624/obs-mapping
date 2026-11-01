import type { MappingSourceInfo, ObsClient, VendorResult } from '../../obs/client';

export type SourcesResult = VendorResult<{ sources: MappingSourceInfo[] }>;

export type CatalogDeps = {
  client: () => ObsClient;
  onSources: (result: SourcesResult) => void;
  onInputs: (inputs: string[]) => void;
};

/** Source and input lists; a newer request supersedes an older one still in flight. */
export const createCatalog = (d: CatalogDeps) => {
  let sourcesRequest = 0;
  let inputsRequest = 0;
  let disposed = false;

  const reloadSources = async (): Promise<void> => {
    sourcesRequest = sourcesRequest + 1;
    const mine = sourcesRequest;
    const result = await d.client().listMappingSources();
    if (!disposed && mine === sourcesRequest) d.onSources(result);
  };

  const reloadInputs = async (): Promise<void> => {
    inputsRequest = inputsRequest + 1;
    const mine = inputsRequest;
    const inputs = await d.client().listInputs();
    if (!disposed && mine === inputsRequest) d.onInputs(inputs);
  };

  return {
    reloadSources,
    reloadInputs,
    dispose: (): void => {
      disposed = true;
    },
  };
};
