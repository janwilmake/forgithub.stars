export interface Env {
  GITHUB_STARS_CACHE: KVNamespace;
  CHUNK_PROCESSOR: DurableObjectNamespace;
}

export type Env2 = {
  GITHUB_STARS_CACHE: KVNamespace;
  CHUNK_PROCESSOR: DurableObjectNamespace;
};

type Env3 = {
  GITHUB_STARS_CACHE: KVNamespace;
  CHUNK_PROCESSOR: DurableObjectNamespace;
};

interface Env4 {
  GITHUB_STARS_CACHE: KVNamespace;
  CHUNK_PROCESSOR: DurableObjectNamespace;
}
