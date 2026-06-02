export const environment = {
  apiUrl: 'https://swapi.info/api',
  // TODO(CI): set via ng build --define '__APP_VERSION__="$GIT_SHA"' in the CI pipeline
  appVersion: 'blue',
  // TODO(CI): set via ng build --define '__DEPLOY_TYPE__="canary"' for canary, '"stable"' for stable
  deployType: 'canary',
};
