import type { NuclearPlugin, NuclearPluginAPI } from '@nuclearplayer/plugin-sdk';

import { METADATA_PROVIDER_ID, STREAMING_PROVIDER_ID } from './config';
import { createMetadataProvider } from './metadata-provider';
import { createStreamingProvider } from './streaming-provider';
import { clearCdnCache } from './track-url-cache';

const plugin: NuclearPlugin = {
  onEnable(api: NuclearPluginAPI) {
    const metadata = createMetadataProvider(api);
    const streaming = createStreamingProvider(api);
    api.Providers.register(metadata);
    api.Providers.register(streaming);
  },
  onDisable(api: NuclearPluginAPI) {
    api.Providers.unregister(METADATA_PROVIDER_ID);
    api.Providers.unregister(STREAMING_PROVIDER_ID);
    clearCdnCache();
  },
};

export default plugin;
