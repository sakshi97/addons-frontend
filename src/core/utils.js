/* global window */
/* eslint-disable react/prop-types */
import url from 'url';

import { oneLine } from 'common-tags';
import config from 'config';
import mozCompare from 'mozilla-version-comparator';
import React from 'react';
import { asyncConnect as defaultAsyncConnect } from 'redux-connect';

import { loadAddons } from 'core/reducers/addons';
import { fetchAddon } from 'core/api';
import GenericError from 'core/components/ErrorPage/GenericError';
import NotFound from 'core/components/ErrorPage/NotFound';
import {
  ADDON_TYPE_OPENSEARCH,
  API_ADDON_TYPES_MAPPING,
  CATEGORY_COLORS,
  VISIBLE_ADDON_TYPES_MAPPING,
  INCOMPATIBLE_FIREFOX_FOR_IOS,
  INCOMPATIBLE_NO_OPENSEARCH,
  INCOMPATIBLE_NOT_FIREFOX,
  INCOMPATIBLE_OVER_MAX_VERSION,
  INCOMPATIBLE_UNDER_MIN_VERSION,
} from 'core/constants';
import { AddonTypeNotFound } from 'core/errors';
import log from 'core/logger';
import purify from 'core/purify';


export function gettext(str) {
  return str;
}

export function ngettext(singular, plural, n) {
  if (n === 1) {
    return singular;
  }
  return plural;
}

export function getClientConfig(_config) {
  const clientConfig = {};
  // eslint-disable-next-line no-restricted-syntax
  for (const key of _config.get('clientConfigKeys')) {
    clientConfig[key] = _config.get(key);
  }
  return clientConfig;
}

export function convertBoolean(value) {
  switch (value) {
    case true:
    case 1:
    case '1':
    case 'true':
      return true;
    default:
      return false;
  }
}

/*
 * This is a very simplistic check of the user-agent string in order to redirect to
 * the right set of AMO data.
 *
 * More complete UA detection for compatibility will take place elsewhere.
 *
 */
export function getClientApp(userAgentString) {
  // We are going to return android as the application if it's *any* android browser.
  // whereas the previous behaviour was to only return 'android' for FF Android.
  // This way we are showing more relevant content, and if we prompt for the user to download
  // firefox we can prompt them to download Firefox for Android.
  if (/android/i.test(userAgentString)) {
    return 'android';
  }
  return 'firefox';
}

export function isValidClientApp(value, { _config = config } = {}) {
  return _config.get('validClientApplications').includes(value);
}

export function sanitizeHTML(text, allowTags = []) {
  // TODO: Accept tags to allow and run through dom-purify.
  return {
    __html: purify.sanitize(text, { ALLOWED_TAGS: allowTags }),
  };
}

// Convert new lines to HTML breaks.
export function nl2br(text) {
  return (text || '').replace(/(?:\r\n|\r|\n)/g, '<br />');
}

/*
 * Sanitizes user inputted HTML, allowing some tags.
 *
 * This also converts new lines to breaks (<br />) as a convenience when
 * users did not write entirely in HTML.
 *
 * This is meant to display things like an add-on's description or version
 * release notes. The allowed tags are meant to match what you see in the
 * Developer Hub when you hover over the *Some HTML Supported* link under
 * the textarea field.
 */
export function sanitizeUserHTML(text) {
  return sanitizeHTML(nl2br(text), [
    'a',
    'abbr',
    'acronym',
    'b',
    'blockquote',
    'br',
    'code',
    'em',
    'i',
    'li',
    'ol',
    'strong',
    'ul',
  ]);
}

export function findAddon(state, slug) {
  return state.addons[slug];
}

export function refreshAddon({ addonSlug, apiState, dispatch } = {}) {
  return fetchAddon({ slug: addonSlug, api: apiState })
    .then(({ entities }) => dispatch(loadAddons(entities)));
}

// asyncConnect() helper for loading an add-on by slug.
//
// This accepts component properties and returns a promise
// that resolves when the requested add-on exists in state.
//
// If the add-on does not exist in state, it is fetched first.
//
export function loadAddonIfNeeded(
  { store: { dispatch, getState }, params: { slug } },
  { _refreshAddon = refreshAddon } = {},
) {
  const state = getState();
  const addon = findAddon(state, slug);
  if (addon) {
    log.info(`Found add-on ${slug}, ${addon.id} in state`);
    return Promise.resolve();
  }
  log.info(`Add-on ${slug} not found in state; fetching from API`);
  // This loads the add-on into state.
  return _refreshAddon({ addonSlug: slug, apiState: state.api, dispatch });
}

export function isAllowedOrigin(urlString, {
  allowedOrigins = [config.get('amoCDN')],
} = {}) {
  let parsedURL;
  try {
    parsedURL = url.parse(urlString);
  } catch (e) {
    log.error(`invalid urlString provided to isAllowedOrigin: ${urlString}`);
    return false;
  }

  return allowedOrigins.includes(`${parsedURL.protocol}//${parsedURL.host}`);
}

export function addQueryParams(urlString, queryParams = {}) {
  const urlObj = url.parse(urlString, true);
  // Clear search, since query object will only be used if search
  // property doesn't exist.
  urlObj.search = undefined;
  urlObj.query = { ...urlObj.query, ...queryParams };
  return url.format(urlObj);
}

export function apiAddonTypeIsValid(addonType) {
  return Object.prototype.hasOwnProperty.call(
    API_ADDON_TYPES_MAPPING, addonType
  );
}

export function apiAddonType(addonType) {
  if (!apiAddonTypeIsValid(addonType)) {
    throw new AddonTypeNotFound(
      `"${addonType}" not found in API_ADDON_TYPES_MAPPING`);
  }
  return API_ADDON_TYPES_MAPPING[addonType];
}

export function visibleAddonType(addonType) {
  if (!Object.prototype.hasOwnProperty.call(
    VISIBLE_ADDON_TYPES_MAPPING, addonType
  )) {
    throw new AddonTypeNotFound(
      `"${addonType}" not found in VISIBLE_ADDON_TYPES_MAPPING`);
  }
  return VISIBLE_ADDON_TYPES_MAPPING[addonType];
}

export function getErrorComponent(status) {
  switch (status) {
    case 404:
      return NotFound;
    default:
      return GenericError;
  }
}

export function isValidLocaleUrlException(value, { _config = config } = {}) {
  return _config.get('validLocaleUrlExceptions').includes(value);
}

export function isValidClientAppUrlException(value, { _config = config } = {}) {
  return _config.get('validClientAppUrlExceptions').includes(value);
}

export function isValidTrailingSlashUrlException(
  value, { _config = config } = {}
) {
  return _config.get('validTrailingSlashUrlExceptions').includes(value);
}

/*
 * Make sure a callback returns a rejected promise instead of throwing an error.
 *
 * If the callback throws an error, a rejected promise will be returned
 * instead. If the callback runs without an error, its return value is not
 * altered. In other words, it may or may not return a promise and that's ok.
 */
export const safePromise = (callback) => (...args) => {
  try {
    return callback(...args);
  } catch (error) {
    return Promise.reject(error);
  }
};

/*
 * A wrapper around asyncConnect to make it safer to use.
 *
 * You don't need to specify deferred: true because it will be set
 * automatically. Example of usage:
 *
 * export default compose(
 *   safeAsyncConnect([{ promise: loadInitialData }]),
 * )(SomeComponent);
 */
export function safeAsyncConnect(
  configs, { asyncConnect = defaultAsyncConnect } = {}
) {
  const safeConfigs = configs.map((conf) => {
    let key = conf.key;
    if (!key) {
      // If asyncConnect does not get a key in its config, it
      // will not dispatch LOAD_FAIL for thrown errors!
      // Other than that, the key is used to set a magic component
      // property (which we never rely on) so it's really not so
      // important.
      key = '__safeAsyncConnect_key__';
    }
    if (!conf.promise) {
      // This is the only way we use asyncConnect() for now.
      throw new Error(
        oneLine`Expected safeAsyncConnect() config to define a promise:
        ${JSON.stringify(conf)}`);
    }
    return {
      ...conf,
      key,
      deferred: true,
      promise: safePromise(conf.promise),
    };
  });
  return asyncConnect(safeConfigs);
}

export function trimAndAddProtocolToUrl(urlToCheck) {
  let urlToReturn = urlToCheck ? urlToCheck.trim() : null;
  if (urlToReturn && !urlToReturn.match(/^https?:\/\//)) {
    urlToReturn = `http://${urlToReturn}`;
  }
  return urlToReturn;
}

/*
 * A decorator to render a 404 when a config key is false.
 *
 * For example, if you had a config key like this:
 *
 * module.exports = {
 *   allowMyComponent: false,
 * };
 *
 * then you could make your component appear as a 404 like this:
 *
 * class MyComponent extends React.Component {
 *   render() { ... }
 * }
 *
 * export default compose(
 *   render404IfConfigKeyIsFalse('allowMyComponent'),
 * )(MyComponent);
 */
export function render404IfConfigKeyIsFalse(
  configKey, { _config = config } = {}
) {
  if (!configKey) {
    throw new TypeError('configKey cannot be empty');
  }
  return (Component) => (props) => {
    if (!_config.get(configKey)) {
      log.debug(`config.${configKey} was false; not rendering ${Component}`);
      return <NotFound />;
    }
    return <Component {...props} />;
  };
}

export function getCompatibleVersions({ _log = log, addon, clientApp } = {}) {
  let maxVersion = null;
  let minVersion = null;
  if (
    addon && addon.current_version && addon.current_version.compatibility
  ) {
    if (addon.current_version.compatibility[clientApp]) {
      maxVersion = addon.current_version.compatibility[clientApp].max;
      minVersion = addon.current_version.compatibility[clientApp].min;
    } else if (addon.type === ADDON_TYPE_OPENSEARCH) {
      _log.info(oneLine`addon is type ${ADDON_TYPE_OPENSEARCH}; no
        compatibility info found but this is expected.`, { addon, clientApp });
    } else {
      _log.error(
        'addon found with no compatibility info for valid clientApp',
        { addon, clientApp }
      );
    }
  }

  return { maxVersion, minVersion };
}

export function isCompatibleWithUserAgent({
  _log = log, _window = typeof window !== 'undefined' ? window : {},
  addon, maxVersion, minVersion, userAgentInfo,
} = {}) {
  // If the userAgent is false there was likely a programming error.
  if (!userAgentInfo) {
    throw new Error('userAgentInfo is required');
  }

  const { browser, os } = userAgentInfo;

  // We need a Firefox browser compatible with add-ons (Firefox for iOS does
  // not currently support add-ons).
  if (browser.name === 'Firefox' && os.name === 'iOS') {
    return { compatible: false, reason: INCOMPATIBLE_FIREFOX_FOR_IOS };
  }

  if (browser.name === 'Firefox') {
    // Do version checks, if this add-on has minimum or maximum version
    // requirements.
    // The mozilla-version-comparator API is quite strange; a result of
    // `1` means the first argument is higher in version than the second.
    //
    // Being over the maxVersion, oddly, is not actually a reason to
    // disable the install button or mark the add-on as incompatible
    // with this version of Firefox. But we log the version mismatch
    // here so it's not totally silent and a future developer isn't as
    // confused by this as tofumatt was.
    // See: https://github.com/mozilla/addons-frontend/issues/2074#issuecomment-286983423
    if (maxVersion && mozCompare(browser.version, maxVersion) === 1) {
      if (addon.current_version.is_strict_compatibility_enabled) {
        return { compatible: false, reason: INCOMPATIBLE_OVER_MAX_VERSION };
      }

      _log.info(oneLine`maxVersion ${maxVersion} for add-on lower than
        browser version ${browser.version}, but add-on still marked as
        compatible because we largely ignore maxVersion. See:
        https://github.com/mozilla/addons-frontend/issues/2074`);
    }

    // A result of `-1` means the second argument is a lower version than the
    // first.
    if (minVersion && mozCompare(browser.version, minVersion) === -1) {
      if (minVersion === '*') {
        _log.error(oneLine`minVersion of "*" was passed to
          isCompatibleWithUserAgent(); bad add-on version data`,
          { browserVersion: browser.version, minVersion }
        );
      }

      // `minVersion` is always respected, regardless of
      // `is_strict_compatibility_enabled`'s value.
      return { compatible: false, reason: INCOMPATIBLE_UNDER_MIN_VERSION };
    }

    if (
      addon.type === ADDON_TYPE_OPENSEARCH &&
      !(_window.external && 'AddSearchProvider' in _window.external)
    ) {
      return { compatible: false, reason: INCOMPATIBLE_NO_OPENSEARCH };
    }

    // If we made it here we're compatible (yay!)
    return { compatible: true, reason: null };
  }

  // This means the client is not Firefox, so it's incompatible.
  return { compatible: false, reason: INCOMPATIBLE_NOT_FIREFOX };
}

export function getClientCompatibility({
  addon, clientApp, userAgentInfo,
} = {}) {
  const { maxVersion, minVersion } = getCompatibleVersions({
    addon, clientApp });
  const { compatible, reason } = isCompatibleWithUserAgent({
    addon, maxVersion, minVersion, userAgentInfo });

  return { compatible, maxVersion, minVersion, reason };
}

export function getCategoryColor(category) {
  if (!category) {
    throw new Error('category is required.');
  }

  const maxColors = CATEGORY_COLORS[category.type];

  if (!maxColors) {
    throw new Error(
      `addonType "${category.type}" not found in CATEGORY_COLORS.`);
  }

  if (category.id > maxColors) {
    const color = parseInt(category.id / maxColors, 10);

    if (color > maxColors) {
      return maxColors;
    }

    return color;
  }

  return category.id;
}

export function parsePage(page) {
  const parsed = parseInt(page, 10);
  return Number.isNaN(parsed) || parsed < 1 ? 1 : parsed;
}
