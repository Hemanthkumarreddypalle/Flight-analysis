import type {
  Client,
  CompileTimeMetadata,
  MediaReference,
  MediaUpload,
  ObjectTypeDefinition,
  OsdkObjectCreatePropertyType,
  PropertyKeys,
} from "@osdk/client";
import { createEditBatch, type Edits, uploadMedia } from "@osdk/functions";

type ObjectCreateProperties<S extends ObjectTypeDefinition> = {
  [P in PropertyKeys<S>]?: OsdkObjectCreatePropertyType<
    CompileTimeMetadata<S>["properties"][P]
  >;
};

/**
 * Ontology Edit Function helper:
 * uploads media to the temporary media set and returns a create-object edit
 * with the uploaded media reference set on the specified media property.
 */
export async function createObjectEditWithUploadedMedia<
  S extends ObjectTypeDefinition,
>(
  client: Client,
  objectType: S,
  mediaPropertyApiName: keyof ObjectCreateProperties<S> & string,
  file: Blob & { readonly name: string },
  baseProperties: ObjectCreateProperties<S> = {},
): Promise<Edits.Object<S>[]> {
  const mediaReference = await uploadMedia(client, {
    data: file,
    fileName: file.name,
  });

  const batch = createEditBatch<Edits.Object<S>>(client);
  const properties = {
    ...baseProperties,
    [mediaPropertyApiName]: mediaReference,
  } as ObjectCreateProperties<S>;

  batch.create(objectType, properties as never);
  return batch.getEdits();
}

/**
 * Action helper:
 * builds a MediaUpload payload from a browser File.
 */
export function createMediaUpload(file: File): MediaUpload {
  return { data: file, fileName: file.name };
}

/**
 * Action helper:
 * accepts an existing MediaReference from an object's media property.
 */
export function useExistingMediaReference(
  mediaReference: MediaReference,
): MediaReference {
  return mediaReference;
}
