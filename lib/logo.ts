/** Turns a picked file into a small PNG data URI suitable for a proposal
 * header.
 *
 * Downscaling happens here, in the browser, before anything is stored — a
 * 4MB logo would otherwise be copied onto every proposal that uses it. What
 * lands in the database is a few tens of KB. */

/** What we'll even open. Anything larger is a photo, not a logo. */
export const MAX_LOGO_BYTES = 4 * 1024 * 1024;

/** Long edge after downscaling. A proposal header renders the logo at ~48px,
 * so 480px still has plenty of detail left for print. */
export const MAX_LOGO_EDGE = 480;

/** Ceiling on the stored string. Only an unusually detailed image survives
 * downscaling and still exceeds this. */
export const MAX_LOGO_DATA_URI = 300_000;

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("That image couldn't be opened."));
    image.src = src;
  });
}

function fitWithin(width: number, height: number, edge: number) {
  const scale = Math.min(1, edge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export async function fileToLogoDataUri(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Pick an image file.");
  }
  if (file.size > MAX_LOGO_BYTES) {
    throw new Error(
      `That file is ${(file.size / 1024 / 1024).toFixed(1)}MB — keep it under 4MB.`
    );
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(objectUrl);
    // An SVG without intrinsic dimensions gives 0 here and would draw nothing.
    if (!image.naturalWidth || !image.naturalHeight) {
      throw new Error(
        "That image has no fixed size. Export it as a PNG and try again."
      );
    }

    const { width, height } = fitWithin(
      image.naturalWidth,
      image.naturalHeight,
      MAX_LOGO_EDGE
    );

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Couldn't process that image.");
    context.drawImage(image, 0, 0, width, height);

    // PNG, not JPEG: a logo on a white proposal header almost always needs its
    // transparency, and JPEG would flatten it to a visible box.
    const dataUri = canvas.toDataURL("image/png");
    if (dataUri.length > MAX_LOGO_DATA_URI) {
      throw new Error(
        "That image is too detailed to store. A flat logo — PNG with a transparent background — works best."
      );
    }
    return dataUri;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
