export type BrowserCoordinates = {
  latitude: number;
  longitude: number;
};

type BrowserGeolocationResult =
  | { ok: true; coordinates: BrowserCoordinates }
  | { ok: false; message: string };

type BrowserGeolocationOptions = {
  positionOptions?: PositionOptions;
  unsupportedMessage?: string;
  deniedMessage?: string;
  locationOffMessage?: string;
  unavailableMessage?: string;
};

const PERMISSION_DENIED = 1;
const POSITION_UNAVAILABLE = 2;
const TIMEOUT = 3;

const defaultPositionOptions: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 60_000,
  timeout: 15_000
};

const defaultMessages = {
  unsupported: "Location sharing is not available in this browser.",
  denied: "Location is blocked for this site. Turn on Location in your browser site settings, then try again.",
  locationOff: "Location is off. Please turn on location services, then press OK to allow location access.",
  unavailable: "Could not read your location. Please turn on location services, allow location access, and try again."
};

function isGeolocationError(error: unknown): error is GeolocationPositionError {
  return Boolean(error && typeof error === "object" && "code" in error);
}

function readBrowserPosition(positionOptions: PositionOptions) {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, positionOptions);
  });
}

function coordinatesFromPosition(position: GeolocationPosition): BrowserCoordinates {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude
  };
}

export async function queryBrowserGeolocationPermission() {
  if (typeof navigator === "undefined" || !navigator.permissions?.query) return null;

  try {
    return await navigator.permissions.query({ name: "geolocation" });
  } catch {
    return null;
  }
}

async function getGeolocationPermissionState() {
  const permission = await queryBrowserGeolocationPermission();
  return permission?.state ?? null;
}

function shouldShowLocationOffPrompt(error: unknown) {
  if (!isGeolocationError(error)) return true;
  return error.code === POSITION_UNAVAILABLE || error.code === TIMEOUT;
}

function messageForError(error: unknown, options: BrowserGeolocationOptions) {
  if (isGeolocationError(error) && error.code === PERMISSION_DENIED) {
    return options.deniedMessage ?? defaultMessages.denied;
  }

  return options.unavailableMessage ?? defaultMessages.unavailable;
}

export async function requestBrowserCoordinates(options: BrowserGeolocationOptions = {}): Promise<BrowserGeolocationResult> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return {
      ok: false,
      message: options.unsupportedMessage ?? defaultMessages.unsupported
    };
  }

  const positionOptions = options.positionOptions ?? defaultPositionOptions;
  let locationOffPromptShown = false;

  const permissionState = await getGeolocationPermissionState();
  if ((permissionState === "prompt" || permissionState === "denied") && typeof window !== "undefined") {
    locationOffPromptShown = true;
    const shouldRequestAccess = window.confirm(options.locationOffMessage ?? defaultMessages.locationOff);

    if (!shouldRequestAccess) {
      return {
        ok: false,
        message: permissionState === "denied"
          ? options.deniedMessage ?? defaultMessages.denied
          : options.unavailableMessage ?? defaultMessages.unavailable
      };
    }
  }

  try {
    const position = await readBrowserPosition(positionOptions);
    return { ok: true, coordinates: coordinatesFromPosition(position) };
  } catch (error) {
    if (shouldShowLocationOffPrompt(error) && !locationOffPromptShown && typeof window !== "undefined") {
      const shouldRetry = window.confirm(options.locationOffMessage ?? defaultMessages.locationOff);

      if (shouldRetry) {
        try {
          const position = await readBrowserPosition(positionOptions);
          return { ok: true, coordinates: coordinatesFromPosition(position) };
        } catch (retryError) {
          return { ok: false, message: messageForError(retryError, options) };
        }
      }
    }

    return { ok: false, message: messageForError(error, options) };
  }
}
